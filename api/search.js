const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }

    const cidade = body.cidade || 'São Paulo';
    const bairro = body.bairro || '';
    const minUnidades = body.minUnidades || 200;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' });
      return;
    }

    const regiao = bairro ? `${bairro}, ${cidade}` : cidade;
    const prompt = `Liste 15 condomínios residenciais reais em ${regiao} com mais de ${minUnidades} unidades. Somente de ${regiao}. Inclua: nome, endereco, bairro, cidade, telefone (ou null), email (ou null), administradora (ou null), unidades (número inteiro), status (Existente ou Lançamento recente), renda (Alta, Media ou Baixa). Retorne APENAS JSON array válido, sem texto adicional.`;

    const postData = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 55000
      };
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve({ status: response.statusCode, body: data }));
      });
      request.on('error', reject);
      request.on('timeout', () => { request.destroy(); reject(new Error('Timeout na chamada ao Gemini')); });
      request.write(postData);
      request.end();
    });

    const data = JSON.parse(result.body);

    if (result.status !== 200) {
      res.status(result.status).json({ error: data.error?.message || 'Erro na API Gemini' });
      return;
    }

    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    res.status(200).json({ text });

  } catch (err) {
    res.status(500).json({ error: 'Erro: ' + err.message });
  }
};
