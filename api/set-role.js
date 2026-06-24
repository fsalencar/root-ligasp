module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://root-ligasp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

  const { target_user_id, role } = req.body || {};
  const ALLOWED_ROLES = ['jogador', 'embaixador', 'admin'];
  if (!target_user_id || !ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid target_user_id or role' });
  }

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
    if (!caller?.id) return res.status(401).json({ error: 'Invalid user' });

    // Busca role do caller
    const callerRoleRes = await fetch(
      `${BASE}/rest/v1/perfis?user_id=eq.${caller.id}&select=role&limit=1`,
      { headers: srHeaders }
    );
    const callerRoleBody = await callerRoleRes.json();
    const callerRole = callerRoleBody?.[0]?.role || 'jogador';

    if (!['admin', 'super_user'].includes(callerRole)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    if (callerRole === 'admin' && role === 'admin') {
      return res.status(403).json({ error: 'Admin não pode promover outros admins' });
    }

    // Impede alterar super_user
    const targetRoleRes = await fetch(
      `${BASE}/rest/v1/perfis?user_id=eq.${target_user_id}&select=role&limit=1`,
      { headers: srHeaders }
    );
    const targetRoleBody = await targetRoleRes.json();
    if (targetRoleBody?.[0]?.role === 'super_user') {
      return res.status(403).json({ error: 'Não é possível alterar role de super_user' });
    }

    // Upsert via on_conflict (funciona independente de o registro existir ou não)
    const upsertRes = await fetch(
      `${BASE}/rest/v1/perfis?on_conflict=user_id`,
      {
        method: 'POST',
        headers: { ...srHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: target_user_id, role }),
      }
    );

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      return res.status(500).json({ error: errText });
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
