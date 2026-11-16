/*
 * Privacidade (LGPD): aviso de armazenamento local, preferências e exclusão dos dados deste site no navegador.
 * O site não usa cookies. Usa só o armazenamento local do navegador (localStorage), para o rascunho,
 * o histórico, a última calculadora aberta e os dados do Gestor de Apuração.
 * Quem escolhe "Não salvar" continua usando tudo, mas os dados são apagados ao fechar ou sair da página.
 */
(function () {
  'use strict';
  const CHAVE_PREF = 'calc-regimes-privacidade:v1'; // guarda só a escolha (estritamente necessária)
  const PREFIXOS = ['calc-regimes:', 'co-calc-'];   // só as chaves desta calculadora: o endereço github.io é compartilhado
  const CFG = window.PRIVACIDADE_CONFIG || {};
  const ls = (() => { try { const s = window.localStorage; s.getItem('x'); return s; } catch (e) { return null; } })();
  const base = (document.currentScript && document.currentScript.src || '').replace(/dados\/privacidade\.js.*$/, '');

  function lerPref() { try { return JSON.parse(ls.getItem(CHAVE_PREF)) || null; } catch (e) { return null; } }
  function gravarPref(salvar) { try { ls.setItem(CHAVE_PREF, JSON.stringify({salvar, em: new Date().toISOString(), versao: CFG.versao || '1.0'})); } catch (e) {} }
  function chaves() {
    const out = [];
    if (!ls) return out;
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && PREFIXOS.some(p => k.startsWith(p))) out.push(k); }
    return out;
  }
  function tamanho() { return chaves().reduce((s, k) => s + k.length + (ls.getItem(k) || '').length, 0) * 2; }
  function apagarDados() { chaves().forEach(k => { try { ls.removeItem(k); } catch (e) {} }); }
  function apagarTudo() { apagarDados(); try { ls.removeItem(CHAVE_PREF); } catch (e) {} }
  function salvando() { const p = lerPref(); return !p || p.salvar !== false; }

  // Quem recusou: nada fica no navegador depois da visita
  function aplicar() {
    if (salvando()) return;
    apagarDados();
  }
  aplicar(); // roda antes dos scripts da calculadora: quem recusou começa sem dados antigos
  window.addEventListener('pagehide', aplicar);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') aplicar(); });

  /* ---------- Aviso e preferências ---------- */
  const CSS = `
  .pv-aviso{position:fixed;left:12px;right:12px;bottom:12px;z-index:1000;max-width:760px;margin:0 auto;background:#fff;color:#14213d;border:1px solid #cfc7b4;border-top:3px solid #c9a227;border-radius:12px;box-shadow:0 10px 30px rgba(20,33,61,.18);padding:16px 18px;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .pv-aviso h2{margin:0 0 6px;font-size:16px;color:#14213d}
  .pv-aviso p{margin:0 0 12px;color:#2b3a5c}
  .pv-aviso a{color:#1f4fbf}
  .pv-botoes{display:flex;flex-wrap:wrap;gap:8px}
  .pv-botoes button{font:inherit;font-weight:600;border-radius:10px;padding:10px 16px;min-height:44px;cursor:pointer;border:1.5px solid #14213d}
  .pv-sim{background:#14213d;color:#fff}
  .pv-nao{background:#fff;color:#14213d}
  .pv-botoes button:focus-visible,.pv-aviso a:focus-visible{outline:3px solid #1f4fbf;outline-offset:2px}
  .pv-ok{margin:10px 0 0;color:#157148;font-weight:600}
  @media (max-width:560px){.pv-botoes button{flex:1 1 100%}}`;

  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function fechar() { const a = document.getElementById('pv-aviso'); if (a) a.remove(); }
  function mostrar(modo) {
    fechar();
    if (!document.getElementById('pv-css')) { const s = document.createElement('style'); s.id = 'pv-css'; s.textContent = CSS; document.head.appendChild(s); }
    const pref = lerPref();
    const atual = modo === 'pref'
      ? '<p><b>Escolha atual:</b> ' + (salvando() ? 'salvar neste navegador' : 'não salvar (apaga ao sair)') + '. ' + chaves().length + ' item(ns) desta calculadora guardados agora.</p>'
      : '';
    const aviso = el(
      '<section class="pv-aviso" id="pv-aviso" role="dialog" aria-modal="false" aria-labelledby="pv-tit">' +
      '<h2 id="pv-tit">Privacidade nesta calculadora</h2>' +
      '<p>Não usamos cookies nem rastreamento. Para você não perder o que digitou, o rascunho e o histórico ficam <b>só neste navegador</b>; nada vai para servidor nosso. ' +
      'A consulta de CNPJ envia o número digitado à BrasilAPI e à CNPJ.ws. <a href="' + base + 'cookies.html">Cookies e armazenamento</a> · <a href="' + base + 'privacidade.html">Política de privacidade</a></p>' +
      atual +
      '<div class="pv-botoes">' +
      '<button type="button" class="pv-sim" data-pv="sim">Salvar neste navegador</button>' +
      '<button type="button" class="pv-nao" data-pv="nao">Não salvar (apagar ao sair)</button>' +
      (modo === 'pref' ? '<button type="button" class="pv-nao" data-pv="apagar">Apagar meus dados agora</button>' : '') +
      '</div><p class="pv-ok" id="pv-ok" role="status" aria-live="polite"></p></section>');
    aviso.addEventListener('click', e => {
      const b = e.target.closest('[data-pv]'); if (!b) return;
      if (b.dataset.pv === 'sim') { gravarPref(true); fechar(); }
      if (b.dataset.pv === 'nao') { gravarPref(false); fechar(); }
      if (b.dataset.pv === 'apagar') { apagarDados(); document.getElementById('pv-ok').textContent = 'Dados desta calculadora apagados deste navegador. Recarregue a página para começar do zero.'; }
    });
    document.body.appendChild(aviso);
    if (modo === 'pref') aviso.querySelector('button').focus();
  }

  window.Privacidade = {
    abrirPreferencias: () => mostrar('pref'),
    apagarDados, apagarTudo, chaves, tamanho, salvando, lerPref, gravarPref, config: CFG
  };

  function preencher() {
    document.querySelectorAll('[data-cfg]').forEach(n => {
      const v = CFG[n.dataset.cfg];
      if (v) n.textContent = n.dataset.prefixo ? n.dataset.prefixo + v : v;
    });
    document.querySelectorAll('[data-se-cfg]').forEach(n => { n.hidden = !CFG[n.dataset.seCfg]; });
    document.querySelectorAll('[data-sem-cfg]').forEach(n => { n.hidden = !!CFG[n.dataset.semCfg]; });
    document.querySelectorAll('a[data-email]').forEach(a => { const v = CFG[a.dataset.email]; if (v) { a.href = 'mailto:' + v; a.textContent = v; } });
  }
  function iniciar() {
    preencher();
    document.querySelectorAll('[data-pv-abrir]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); mostrar('pref'); }));
    if (!lerPref() && !document.documentElement.hasAttribute('data-sem-aviso')) mostrar('primeira');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
