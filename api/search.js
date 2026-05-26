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

    const prompt = `Pesquise no Google e liste condomínios residenciais REAIS localizados em ${regiao} com mais de ${minUnidades} unidades.

Para cada condomínio:
- nome: nome real e completo
- endereco: endereço completo com rua e número
- bairro: bairro exato em ${regiao}
- cidade: ${cidade}
- telefone: telefone real da portaria ou administradora (procure no Google Maps, site da construtora ou administradora)
- email: email real se encontrar, senão null
- administradora: nome da administradora ou construtora responsável
- unidades: número OBRIGATÓRIO — se não souber o exato, ESTIME com base no número de torres × andares × apartamentos por andar. Todo condomínio deve ter um número inteiro estimado.
- status: "Lançamento recente" se entregue nos últimos 3 anos, senão "Existente"
- renda: "Alta" para alto padrão/luxo (ticket acima de R$800k), "Media" para médio padrão (R$300k-R$800k), "Baixa" para popular/HIS/MCMV (abaixo de R$300k)

Retorne APENAS o array JSON, sem markdown, sem texto:
[{"nome":"...","endereco":"...","bairro":"...","cidade":"${cidade}","telefone":null,"email":null,"administradora":null,"unidades":300,"status":"Existente","renda":"Media"}]

Liste 15 condomínios reais apenas de ${regiao}. SOMENTE o JSON.`;

    const postData = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
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
      request.on('timeout', () => { request.destroy(); reject(new Error('Timeout — tente novamente')); });
      request.write(postData);
      request.end();
    });

    const data = JSON.parse(result.body);

    if (result.status !== 200) {
      res.status(result.status).json({ error: data.error?.message || 'Erro na API Gemini' });
      return;
    }

    // Extrai texto de todas as partes
    const rawText = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('')
      .trim();

    // Limpa markdown e extrai JSON
    let text = rawText.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    if (!text.startsWith('[')) {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) text = match[0];
    }

    res.status(200).json({ text });

  } catch (err) {
    res.status(500).json({ error: 'Erro: ' + err.message });
  }
};
