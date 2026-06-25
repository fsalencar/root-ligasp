module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://root-ligasp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

  const { partida_id } = req.body || {};
  if (!partida_id) return res.status(400).json({ error: 'Missing partida_id' });

  const BASE = process.env.SUPABASE_URL;
  const SRK  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!BASE || !SRK) return res.status(500).json({ error: 'Missing server config' });

  const srHeaders = {
    'apikey': SRK,
    'Authorization': `Bearer ${SRK}`,
    'Content-Type': 'application/json',
  };

  try {
    const userRes = await fetch(`${BASE}/auth/v1/user`, {
      headers: { 'apikey': SRK, 'Authorization': `Bearer ${jwt}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });
    const caller = await userRes.json();

    const roleRes  = await fetch(`${BASE}/rest/v1/perfis?user_id=eq.${caller.id}&select=role&limit=1`, { headers: srHeaders });
    const roleBody = await roleRes.json();
    const role     = roleBody?.[0]?.role || 'jogador';
    if (!['admin', 'super_user', 'embaixador'].includes(role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const restRes = await fetch(`${BASE}/rest/v1/partidas_liga?id=eq.${partida_id}`, {
      method: 'PATCH',
      headers: { ...srHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ deleted_at: null }),
    });
    if (!restRes.ok) {
      const t = await restRes.text();
      return res.status(500).json({ error: t });
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
