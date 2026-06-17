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
      // Restore correct tab after OAuth redirect
      if (window.location.hash && window.location.hash !== '#') {
        if (typeof restoreTabFromHash === 'function') restoreTabFromHash();
      }
      if (typeof carregarHistorico === 'function') carregarHistorico();
    }
    if (event === 'SIGNED_OUT') {
      if (typeof renderHistoricoLogout === 'function') renderHistoricoLogout();
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

// ── UI de autenticação ───────────────────────────────────────────
function renderAuthUI() {
  const btn = document.getElementById('authBtn');
  const userInfo = document.getElementById('userInfo');
  if (!btn) return;

  if (currentUser) {
    const nome = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Usuário';
    const avatar = currentUser.user_metadata?.avatar_url;
    btn.style.display = 'none';
    userInfo.style.display = 'flex';
    userInfo.innerHTML = `
      ${avatar ? `<img src="${avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">` : '<span style="font-size:1.2rem">👤</span>'}
      <span style="font-size:0.82rem;color:var(--text2);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nome}</span>
      <button onclick="logout()" style="background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text3);font-size:0.72rem;padding:3px 8px;cursor:pointer;">Sair</button>
    `;
  } else {
    btn.style.display = 'flex';
    userInfo.style.display = 'none';
    userInfo.innerHTML = '';
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