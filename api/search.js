export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { cidade, bairro, minUnidades } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' });

  const prompt = `Liste 10 condomínios residenciais reais em ${cidade}${bairro ? `, ${bairro}` : ''} com mais de ${minUnidades} unidades. Responda SOMENTE com JSON array, sem explicações, sem markdown:\n[{"nome":"...","endereco":"...","bairro":"...","cidade":"${cidade}","telefone":null,"email":null,"administradora":null,"unidades":300}]`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.1, 
            maxOutputTokens: 4096,
            responseMimeType: 'application/json'
          }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'Erro Gemini' });

    const rawText = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('')
      .trim();

    // Retorna o texto bruto — o frontend vai fazer o parse
    res.status(200).json({ text: rawText });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
