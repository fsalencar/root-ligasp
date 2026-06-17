// Contadores Supabase

// ===================== CONTADORES SUPABASE =====================
const SB_URL = 'https://pgfkwumbtzarohkiqcen.supabase.co';
const SB_KEY = 'sb_publishable_W-PlyMDuen4vNawLs0y1IA_yNT3S-w8';

async function sbIncrement(chave) {
  try {
    const res = await fetch(SB_URL + '/rest/v1/contadores?chave=eq.' + chave + '&select=valor', {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
    });
    const data = await res.json();
    if (!data || !data[0]) return;
    const novoValor = (data[0].valor || 0) + 1;
    await fetch(SB_URL + '/rest/v1/contadores?chave=eq.' + chave, {
      method: 'PATCH',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ valor: novoValor })
    });
    const el = document.getElementById('counter_' + chave);
    if (el) el.textContent = novoValor.toLocaleString('pt-BR');
  } catch(e) { console.warn('Counter error:', e); }
}

async function sbLoadCounters() {
  try {
    const res = await fetch(SB_URL + '/rest/v1/contadores?select=chave,valor', {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
    });
    const data = await res.json();
    if (!data || !Array.isArray(data)) return;
    data.forEach(function(row) {
      const el = document.getElementById('counter_' + row.chave);
      if (el) el.textContent = row.valor.toLocaleString('pt-BR');
    });
  } catch(e) { console.warn('Counter load error:', e); }
}
// ===============================================================