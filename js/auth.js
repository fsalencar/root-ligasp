// ===================== AUTENTICAÇÃO SUPABASE =====================

const SUPABASE_URL = 'https://pgfkwumbtzarohkiqcen.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_W-PlyMDuen4vNawLs0y1IA_yNT3S-w8';

// Carrega o SDK do Supabase dinamicamente
let supabaseClient = null;

async function initSupabase() {
  if (supabaseClient) return supabaseClient;
  const module = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const createClient = module.createClient;
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,  // handles OAuth callback automatically
    }
  });

  // Listener de mudança de sessão
  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    renderAuthUI();
    if (event === 'SIGNED_IN') {
      hideAuthModal();
      if (typeof restoreTabFromHash === 'function') restoreTabFromHash();
      if (typeof carregarHistorico === 'function') carregarHistorico();
      // Inicia Ludopedia e depois pré-preenche o slot do próprio usuário
      if (typeof initLudopedia === 'function') {
        initLudopedia().then(() => {
          if (typeof carregarJogadoresCadastrados === 'function') carregarJogadoresCadastrados();
          if (typeof preencherSlotProprio === 'function') preencherSlotProprio();
        });
      } else {
        if (typeof carregarJogadoresCadastrados === 'function') carregarJogadoresCadastrados();
        if (typeof preencherSlotProprio === 'function') preencherSlotProprio();
      }
    }
    if (event === 'SIGNED_OUT') {
      if (typeof renderHistoricoLogout === 'function') renderHistoricoLogout();
      if (typeof renderLudopediaStatus === 'function') renderLudopediaStatus(); // mantém chip se tiver token
    }
  });

  // Verifica sessão atual (inclui OAuth callback)
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;
  renderAuthUI();

  // Se voltou de OAuth redirect, limpa o hash da URL
  if (window.location.hash.includes('access_token') || window.location.hash.includes('error')) {
    history.replaceState(null, '', window.location.pathname);
  }

  return supabaseClient;
}

let currentUser = null;

// ── Login ────────────────────────────────────────────────────────
async function loginGoogle() {
  const sb = await initSupabase();
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  });
}

async function loginEmail(email, senha) {
  const sb = await initSupabase();
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    if (error.message.includes('Invalid login')) {
      // Tenta cadastrar
      const { error: signUpError } = await sb.auth.signUp({ email, password: senha });
      if (signUpError) throw signUpError;
      showAuthMsg('Conta criada! Verifique seu email para confirmar.');
    } else {
      throw error;
    }
  }
}

async function logout() {
  const sb = await initSupabase();
  await sb.auth.signOut();
}

// Detecta retorno de redirect OAuth do Supabase (não da Ludopedia)
(function () {
  const p = new URLSearchParams(window.location.search);
  if (p.has('code') && !localStorage.getItem('ludo_connecting')) {
    const btn = document.getElementById('authBtn');
    if (btn) { btn.textContent = '⏳ Conectando...'; btn.disabled = true; btn.style.opacity = '0.7'; }
  }
})();

// ── UI de autenticação ───────────────────────────────────────────
function renderAuthUI() {
  const btn = document.getElementById('authBtn');
  const userInfo = document.getElementById('userInfo');
  if (!btn) return;

  if (currentUser) {
    const nome   = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Usuário';
    const avatar = currentUser.user_metadata?.avatar_url;
    const ludoNome = (typeof ludoUser !== 'undefined') ? (ludoUser?.usuario || ludoUser?.nm_usuario) : null;
    const temLudo  = (typeof ludoToken !== 'undefined') && ludoToken;

    btn.style.display = 'none';
    userInfo.style.display = 'flex';
    userInfo.innerHTML = `
      <button onclick="abrirModalPerfil()" style="display:flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;padding:0;max-width:160px;" title="Ver perfil">
        <div style="position:relative;flex-shrink:0;">
          ${avatar
            ? `<img src="${avatar}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">`
            : `<div style="width:30px;height:30px;border-radius:50%;background:var(--surface2);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1rem;">👤</div>`}
          ${temLudo ? `<span style="position:absolute;bottom:-2px;right:-2px;width:13px;height:13px;background:#3a8a28;border-radius:50%;border:2px solid var(--surface);font-size:0.45rem;display:flex;align-items:center;justify-content:center;">🎲</span>` : ''}
        </div>
        <span style="font-size:0.82rem;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nome}</span>
      </button>
      <button onclick="logout()" style="background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text3);font-size:0.72rem;padding:3px 8px;cursor:pointer;flex-shrink:0;">Sair</button>
    `;
  } else {
    btn.style.display = 'flex';
    userInfo.style.display = 'none';
    userInfo.innerHTML = '';
  }
}

// ── Modal de perfil ──────────────────────────────────────────────
async function abrirModalPerfil() {
  const modal = document.getElementById('modalJogadores');
  if (!modal || !currentUser) return;

  const nome   = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Usuário';
  const avatar = currentUser.user_metadata?.avatar_url;
  const email  = currentUser.email || '';
  const userId = currentUser.id;
  const temLudo   = (typeof ludoToken !== 'undefined') && ludoToken;
  const ludoNome  = temLudo ? ((typeof ludoUser !== 'undefined') ? (ludoUser?.usuario || ludoUser?.nm_usuario || '—') : '—') : null;
  const ludoIdNum = (typeof ludoUser !== 'undefined') ? ludoUser?.id_usuario : null;

  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:360px;width:95%;text-align:center;">
      <div class="modal-header" style="justify-content:flex-end;">
        <button onclick="fecharGerenciarJogadores()" class="modal-close-btn">×</button>
      </div>

      <!-- Avatar -->
      <div style="position:relative;display:inline-block;margin-bottom:0.75rem;">
        ${avatar
          ? `<img src="${avatar}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid var(--border);">`
          : `<div style="width:72px;height:72px;border-radius:50%;background:var(--surface2);border:3px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto;">👤</div>`}
      </div>
      <div style="font-size:1.05rem;font-weight:600;color:var(--text1);margin-bottom:2px;">${nome}</div>
      <div style="font-size:0.75rem;color:var(--text3);font-family:sans-serif;margin-bottom:1rem;">${email}</div>

      <!-- Ludopedia -->
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:0.75rem;margin-bottom:0.75rem;text-align:left;">
        <div style="font-size:0.7rem;color:var(--text3);font-family:sans-serif;letter-spacing:0.05em;margin-bottom:6px;">LUDOPEDIA</div>
        ${temLudo ? `
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.2rem;">🎲</span>
            <div style="flex:1;">
              <div style="font-family:sans-serif;font-size:0.88rem;color:#80d060;font-weight:600;">${ludoNome}</div>
              ${ludoIdNum ? `<div style="font-family:sans-serif;font-size:0.7rem;color:var(--text3);">ID: ${ludoIdNum}</div>` : ''}
            </div>
            <button class="ludo-btn-sm" style="color:#f09080;border-color:rgba(240,144,128,0.3);" onclick="desconectarLudopedia();fecharGerenciarJogadores();">Desconectar</button>
          </div>` : `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-family:sans-serif;font-size:0.82rem;color:var(--text3);">Não conectado</span>
            <button class="ludo-btn-sm" onclick="fecharGerenciarJogadores();conectarLudopedia();">Conectar</button>
          </div>`}
      </div>

      <!-- QR Code do perfil -->
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:0.75rem;margin-bottom:0.75rem;">
        <div style="font-size:0.7rem;color:var(--text3);font-family:sans-serif;letter-spacing:0.05em;margin-bottom:8px;">MEU QR CODE</div>
        <div id="perfilQRBox" style="margin:0 auto;width:164px;height:164px;"></div>
        <div style="font-family:sans-serif;font-size:0.72rem;color:var(--text3);margin-top:6px;line-height:1.4;">
          Compartilhe para ser adicionado em partidas
        </div>
        <button class="ludo-btn-sm" style="margin-top:6px;" onclick="navigator.clipboard.writeText('${userId}').then(()=>this.textContent='✓ Copiado!').catch(()=>this.textContent='ID: ${userId.slice(0,8)}...')">Copiar meu ID</button>
      </div>

      <button onclick="logout();fecharGerenciarJogadores();" style="background:transparent;border:1px solid var(--border);border-radius:var(--radius);color:var(--text3);font-size:0.82rem;padding:0.4rem 1rem;cursor:pointer;width:100%;">Sair da conta</button>
    </div>`;

  // Gera QR Code com o ID do usuário
  if (typeof _gerarQRCode === 'function') {
    await _gerarQRCode('perfilQRBox', `https://root-ligasp.vercel.app/?pid=${userId}`);
  }
}

function showAuthModal() {
  document.getElementById('authModal').style.display = 'flex';
}
function hideAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

function showAuthMsg(msg, isError = false) {
  const el = document.getElementById('authMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#f09080' : '#80d060';
  el.style.display = 'block';
}

async function submitEmailLogin() {
  const email = document.getElementById('authEmail').value.trim();
  const senha = document.getElementById('authSenha').value;
  if (!email || !senha) { showAuthMsg('Preencha email e senha.', true); return; }
  try {
    await loginEmail(email, senha);
    hideAuthModal();
  } catch(e) {
    showAuthMsg(e.message || 'Erro ao entrar.', true);
  }
}