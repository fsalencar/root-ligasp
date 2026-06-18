module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://root-ligasp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    // 1. Troca o code pelo access_token Ludopedia
    const tokenRes = await fetch('https://ludopedia.com.br/tokenrequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code }).toString(),
    });
    const tokenData = await tokenRes.json();
    const ludoToken = tokenData.access_token;
    if (!ludoToken) return res.status(400).json({ error: 'Token Ludopedia não obtido', raw: tokenData });

    // 2. Busca perfil do usuário na Ludopedia
    const profileRes = await fetch('https://ludopedia.com.br/api/v1/me', {
      headers: { 'Authorization': `Bearer ${ludoToken}` },
    });
    const profile = await profileRes.json();
    const { id_usuario, usuario, thumb } = profile;
    if (!id_usuario) return res.status(400).json({ error: 'Perfil Ludopedia não obtido', raw: profile });

    // 3. Gera magic link Supabase para o usuário Ludopedia (cria se não existir)
    const sbRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: `ludopedia_${id_usuario}@ligasp.internal`,
        data: {
          full_name: usuario,
          avatar_url: thumb || null,
          ludopedia_id: id_usuario,
          ludopedia_usuario: usuario,
          provider: 'ludopedia',
        },
      }),
    });

    const sbData = await sbRes.json();
    if (!sbRes.ok) return res.status(500).json({ error: sbData.message || 'Erro ao criar sessão Supabase', raw: sbData });

    const actionLink = sbData.action_link;
    if (!actionLink) return res.status(500).json({ error: 'action_link não retornado', raw: sbData });

    // Retorna o action_link completo — o frontend redireciona para ele
    // Isso evita problemas de PKCE: o Supabase processa o próprio link e volta já com sessão
    return res.json({
      ludo_token:  ludoToken,
      action_link: actionLink,
      usuario,
      id_usuario,
      thumb:       thumb || null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
