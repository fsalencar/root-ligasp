module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://root-ligasp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Missing name' });

  const BASE    = process.env.SUPABASE_URL;
  const SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const srHeaders = { 'apikey': SRK, 'Authorization': `Bearer ${SRK}`, 'Content-Type': 'application/json' };

  try {
    // Verifica JWT e obtém user
    const userRes = await fetch(`${BASE}/auth/v1/user`, {
      headers: { 'apikey': SRK, 'Authorization': `Bearer ${jwt}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userRes.json();

    // Busca entradas com nome igual (case-insensitive) e sem player_user_id
    // Exclui entradas do próprio user_id (que ele já vê na lista)
    const nameLike = encodeURIComponent(name.trim());
    const r = await fetch(
      `${BASE}/rest/v1/jogadores?nome=ilike.${nameLike}&player_user_id=is.null&user_id=neq.${user.id}&select=id,nome,user_id`,
      { headers: srHeaders }
    );
    const entries = await r.json();
    return res.json({ entries: Array.isArray(entries) ? entries : [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
