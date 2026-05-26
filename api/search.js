export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { cidade, bairro, minUnidades } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' });

  const prompt = `Pesquise e liste condomínios residenciais reais em ${cidade}${bairro ? `, região de ${bairro}` : ''} com mais de ${minUnidades} unidades. Retorne APENAS um array JSON válido:\n[\n  {\n    "nome": "Nome do condomínio",\n    "endereco": "Endereço completo",\n    "bairro": "Bairro",\n    "cidade": "${cidade}",\n    "telefone": "telefone ou null",\n    "email": "email ou null",\n    "administradora": "nome ou null",\n    "unidades": numero_inteiro\n  }\n]\nListe ao menos 10. Somente o JSON.`;

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.1 } })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'Erro Gemini' });
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
