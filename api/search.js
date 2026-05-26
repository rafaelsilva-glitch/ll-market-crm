export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { cidade, bairro, minUnidades } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' });

  const regiao = bairro ? `${bairro}, ${cidade}` : cidade;

  const prompt = `Você é um especialista em mercado imobiliário brasileiro.

Liste 20 condomínios residenciais reais localizados EXCLUSIVAMENTE em ${regiao} com mais de ${minUnidades} unidades.

IMPORTANTE: Traga APENAS condomínios que ficam em ${regiao}. Não inclua condomínios de outras cidades ou bairros.

Para cada condomínio, inclua:
- telefone: telefone real da portaria ou administradora (se não souber, use null)
- email: email real (se não souber, use null)
- administradora: nome da empresa administradora (se não souber, use null)
- contato: se não tiver telefone nem email, coloque "Visita presencial"
- status: "Existente" se o condomínio já existe há mais de 2 anos, ou "Lançamento recente" se foi lançado nos últimos 2 anos
- renda: "Alta" para condomínios de alto padrão/luxo, "Media" para padrão médio, "Baixa" para HIS/MCMV/popular

Responda SOMENTE com JSON array:
[{
  "nome": "Nome real do condomínio",
  "endereco": "Endereço completo com rua e número",
  "bairro": "Bairro exato em ${regiao}",
  "cidade": "${cidade}",
  "telefone": "telefone ou null",
  "email": "email ou null",
  "administradora": "nome ou null",
  "contato": "telefone disponível ou Visita presencial",
  "unidades": 300,
  "status": "Existente",
  "renda": "Media"
}]`;

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
            maxOutputTokens: 8192,
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

    res.status(200).json({ text: rawText });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
