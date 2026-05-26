export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { cidade, bairro, minUnidades } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada.' });

  const prompt = `Pesquise na web e liste condomínios residenciais reais em ${cidade}${bairro ? `, região de ${bairro}` : ''} com mais de ${minUnidades} unidades. Retorne APENAS um array JSON válido:\n[\n  {\n    "nome": "Nome do condomínio",\n    "endereco": "Endereço completo",\n    "bairro": "Bairro",\n    "cidade": "${cidade}",\n    "telefone": "telefone ou null",\n    "email": "email ou null",\n    "administradora": "nome ou null",\n    "unidades": numero_inteiro\n  }\n]\nListe ao menos 10 condomínios reais. Somente o JSON, sem texto.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'Erro API' });
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
