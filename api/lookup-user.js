module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://root-ligasp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, user_id } = req.body || {};
  if (!email && !user_id) return res.status(400).json({ error: 'Missing email or user_id' });

  const BASE    = process.env.SUPABASE_URL;
  const SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { 'apikey': SRK, 'Authorization': `Bearer ${SRK}`, 'Content-Type': 'application/json' };

  try {
    let user;
    if (user_id) {
      // Busca diretamente pelo UUID
      const r = await fetch(`${BASE}/auth/v1/admin/users/${user_id}`, { headers });
      if (!r.ok) return res.json({ found: false });
      user = await r.json();
    } else {
      // Busca por email
      const listRes = await fetch(`${BASE}/auth/v1/admin/users?page=1&per_page=50`, { headers });
      const listData = await listRes.json();
      user = (listData.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase());
    }
    if (!user) return res.json({ found: false });

    const nome = user.user_metadata?.full_name || email.split('@')[0];

    // Busca token Ludopedia desse usuário
    const tokenRes = await fetch(
      `${BASE}/rest/v1/ludopedia_tokens?user_id=eq.${user.id}&select=nm_usuario,access_token`,
      { headers: { ...headers, 'Prefer': 'return=representation' } }
    );
    const tokens = await tokenRes.json();
    const token = Array.isArray(tokens) ? tokens[0] : null;

    if (!token?.access_token) {
      return res.json({ found: true, nome, email: user.email, ludopedia_id: null, ludopedia_usuario: null });
    }

    // Chama /me da Ludopedia para pegar id_usuario atualizado
    try {
      const meRes = await fetch('https://ludopedia.com.br/api/v1/me', {
        headers: { 'Authorization': `Bearer ${token.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        return res.json({ found: true, nome, email: user.email, ludopedia_id: me.id_usuario || null, ludopedia_usuario: me.usuario || token.nm_usuario });
      }
    } catch {}

    return res.json({ found: true, nome, email: user.email, ludopedia_id: null, ludopedia_usuario: token.nm_usuario || null });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
