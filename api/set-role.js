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
  const srHeaders = { 'apikey': SRK, 'Authorization': `Bearer ${SRK}`, 'Content-Type': 'application/json' };

  try {
    // Verifica JWT e obtém o caller
    const userRes = await fetch(`${BASE}/auth/v1/user`, {
      headers: { 'apikey': SRK, 'Authorization': `Bearer ${jwt}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });
    const caller = await userRes.json();

    // Verifica role do caller
    const roleRes = await fetch(
      `${BASE}/rest/v1/perfis?user_id=eq.${caller.id}&select=role`,
      { headers: srHeaders }
    );
    const roleData = await roleRes.json();
    const callerRole = roleData?.[0]?.role || 'jogador';
    if (!['admin', 'super_user'].includes(callerRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Admin só pode gerenciar jogador/embaixador; super_user pode atribuir admin também
    if (callerRole === 'admin' && role === 'admin') {
      return res.status(403).json({ error: 'Admin não pode promover outros admins' });
    }

    // Impede qualquer um de tocar em super_user
    const targetRoleRes = await fetch(
      `${BASE}/rest/v1/perfis?user_id=eq.${target_user_id}&select=role`,
      { headers: srHeaders }
    );
    const targetRoleData = await targetRoleRes.json();
    const targetCurrentRole = targetRoleData?.[0]?.role || 'jogador';
    if (targetCurrentRole === 'super_user') {
      return res.status(403).json({ error: 'Não é possível alterar role de super_user' });
    }

    // Upsert com service role (bypassa RLS)
    const upsertRes = await fetch(`${BASE}/rest/v1/perfis`, {
      method: 'POST',
      headers: { ...srHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: target_user_id, role }),
    });
    if (!upsertRes.ok) {
      const err = await upsertRes.text();
      return res.status(500).json({ error: err });
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
