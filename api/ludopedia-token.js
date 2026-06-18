module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://root-ligasp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://root-ligasp.vercel.app/',
      client_id: process.env.LUDOPEDIA_CLIENT_ID,
      client_secret: process.env.LUDOPEDIA_CLIENT_SECRET,
    });

    const response = await fetch('https://ludopedia.com.br/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { return res.status(500).json({ error: 'Resposta inválida da Ludopedia', raw: text }); }

    if (!response.ok) return res.status(400).json({ error: data.error_description || data.error || 'Falha na autenticação' });

    return res.json({ access_token: data.access_token });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
