module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }

    const cidade = body.cidade || 'São Paulo';
    const bairro = body.bairro || '';
    const minUnidades = body.minUnidades || 200;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no Vercel.' });
    }

    const regiao = bairro ? `${bairro}, ${cidade}` : cidade;

    const prompt = `Liste 20 condomínios residenciais reais localizados EXCLUSIVAMENTE em ${regiao} com mais de ${minUnidades} unidades. Apenas de ${regiao}, não de outros lugares. Para cada um: nome, endereço, bairro, telefone (ou null), email (ou null), administradora (ou null), número de unidades, se é Existente ou Lançamento recente, e perfil de renda (Alta/Media/Baixa). Retorne APENAS JSON array.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ 
        error: data.error?.message || `Erro ${geminiRes.status} na API Gemini` 
      });
    }

    const text = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('')
      .trim();

    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
};
