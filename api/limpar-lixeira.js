module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://root-ligasp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

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

    // Busca partidas com deleted_at há mais de 7 dias
    const limite = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const listRes  = await fetch(
      `${BASE}/rest/v1/partidas_liga?deleted_at=lt.${encodeURIComponent(limite)}&select=id,foto_pontuacao_url,foto_jogadores_url`,
      { headers: srHeaders }
    );
    const antigas = await listRes.json();

    if (!Array.isArray(antigas) || !antigas.length) return res.json({ ok: true, removidas: 0 });

    // Apaga fotos do storage (best-effort)
    for (const p of antigas) {
      for (const url of [p.foto_pontuacao_url, p.foto_jogadores_url].filter(Boolean)) {
        try {
          const match = url.match(/\/fotos-partidas\/(.+)$/);
          if (match) {
            await fetch(`${BASE}/storage/v1/object/fotos-partidas/${match[1]}`, {
              method: 'DELETE',
              headers: { 'apikey': SRK, 'Authorization': `Bearer ${SRK}` },
            });
          }
        } catch { /* best-effort */ }
      }
    }

    // Hard delete das partidas
    const ids = antigas.map(p => p.id);
    const delRes = await fetch(
      `${BASE}/rest/v1/partidas_liga?id=in.(${ids.join(',')})`,
      { method: 'DELETE', headers: { ...srHeaders, 'Prefer': 'return=minimal' } }
    );
    if (!delRes.ok) {
      const t = await delRes.text();
      return res.status(500).json({ error: t });
    }

    return res.json({ ok: true, removidas: ids.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
