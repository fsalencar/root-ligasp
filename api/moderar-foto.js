module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://root-ligasp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const SE_USER   = process.env.SIGHTENGINE_USER;
  const SE_SECRET = process.env.SIGHTENGINE_SECRET;

  // Se não configurado, libera (fail open)
  if (!SE_USER || !SE_SECRET) return res.json({ ok: true, skipped: true });

  const BASE = process.env.SUPABASE_URL;
  const SRK  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    // Verifica JWT
    const userRes = await fetch(`${BASE}/auth/v1/user`, {
      headers: { 'apikey': SRK, 'Authorization': `Bearer ${jwt}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });

    // Chama Sightengine
    const params = new URLSearchParams({
      url,
      models: 'nudity-2.0,gore,weapon,recreational_drug,violence,self-harm,hate-2.0',
      api_user: SE_USER,
      api_secret: SE_SECRET,
    });

    const seRes  = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`);
    const seData = await seRes.json();

    if (seData.status !== 'success') {
      // Erro na API externa — fail open para não bloquear usuários legítimos
      console.warn('Sightengine error:', JSON.stringify(seData));
      return res.json({ ok: true, skipped: true });
    }

    const nudity    = seData.nudity            || {};
    const gore      = seData.gore              || {};
    const weapon    = seData.weapon            || {};
    const drug      = seData.recreational_drug || {};
    const viol      = seData.violence          || {};
    const selfharm = seData.self_harm || {};
    const hate     = seData.hate      || {};

    const reprovada =
      (nudity.sexual_activity  ?? 0) > 0.5 ||
      (nudity.sexual_display   ?? 0) > 0.5 ||
      (nudity.erotica          ?? 0) > 0.6 ||
      (gore.prob               ?? 0) > 0.5 ||
      (weapon.classes?.firearm ?? 0) > 0.7 ||
      (weapon.classes?.knife   ?? 0) > 0.7 ||
      (drug.prob               ?? 0) > 0.7 ||
      (viol.prob               ?? 0) > 0.7 ||
      (selfharm.prob           ?? 0) > 0.7 ||
      (hate.prob               ?? 0) > 0.7;

    if (reprovada) {
      return res.json({ ok: false, reason: 'Conteúdo impróprio detectado na foto.' });
    }

    return res.json({ ok: true });
  } catch (e) {
    // Fail open em caso de falha de rede ou timeout
    console.warn('Moderation check failed:', e.message);
    return res.json({ ok: true, skipped: true });
  }
};
