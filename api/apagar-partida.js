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
    // Verifica JWT do caller
    const userRes = await fetch(`${BASE}/auth/v1/user`, {
      headers: { 'apikey': SRK, 'Authorization': `Bearer ${jwt}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });
    const caller = await userRes.json();

    // Verifica role
    const roleRes  = await fetch(`${BASE}/rest/v1/perfis?user_id=eq.${caller.id}&select=role&limit=1`, { headers: srHeaders });
    const roleBody = await roleRes.json();
    const role     = roleBody?.[0]?.role || 'jogador';
    if (!['admin', 'super_user'].includes(role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Busca a partida para pegar as URLs das fotos
    const pRes  = await fetch(`${BASE}/rest/v1/partidas_liga?id=eq.${partida_id}&select=foto_pontuacao_url,foto_jogadores_url`, { headers: srHeaders });
    const pBody = await pRes.json();
    const partida = pBody?.[0];

    // Apaga registro
    const delRes = await fetch(`${BASE}/rest/v1/partidas_liga?id=eq.${partida_id}`, {
      method: 'DELETE',
      headers: { ...srHeaders, 'Prefer': 'return=minimal' },
    });
    if (!delRes.ok) {
      const t = await delRes.text();
      return res.status(500).json({ error: t });
    }

    // Tenta apagar fotos do Storage (best-effort)
    const urls = [partida?.foto_pontuacao_url, partida?.foto_jogadores_url].filter(Boolean);
    for (const url of urls) {
      try {
        const match = url.match(/\/fotos-partidas\/(.+)$/);
        if (!match) continue;
        await fetch(`${BASE}/storage/v1/object/fotos-partidas/${match[1]}`, {
          method: 'DELETE',
          headers: { 'apikey': SRK, 'Authorization': `Bearer ${SRK}` },
        });
      } catch { /* best-effort */ }
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
