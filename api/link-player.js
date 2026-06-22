module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://root-ligasp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

  const { entry_ids } = req.body || {};
  if (!Array.isArray(entry_ids) || !entry_ids.length) return res.status(400).json({ error: 'Missing entry_ids' });

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

    // Vincula apenas entradas que ainda não têm player_user_id
    const ids = entry_ids.map(id => `"${id}"`).join(',');
    const r = await fetch(
      `${BASE}/rest/v1/jogadores?id=in.(${ids})&player_user_id=is.null`,
      {
        method: 'PATCH',
        headers: { ...srHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ player_user_id: user.id }),
      }
    );
    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ error: err });
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
