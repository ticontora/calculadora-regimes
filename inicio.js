/* Roda antes da calculadora: atualização automática e proteção dos formulários.
 * Fica em arquivo (e não dentro do HTML) para a política de segurança de conteúdo (CSP) não precisar liberar scripts embutidos. */
(function () {
  'use strict';
  // Se houver versão nova publicada, recarrega sem precisar de Ctrl+F5
  var meta = document.querySelector('meta[name="versao-site"]');
  var VERSAO = meta ? meta.content : '';
  if (VERSAO && location.protocol.indexOf('http') === 0 && window.fetch) {
    fetch('version.json?t=' + Date.now(), {cache: 'no-store'})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.v || j.v === VERSAO) return;
        var u = new URL(location.href);
        if (u.searchParams.get('v') === j.v) return;
        u.searchParams.set('v', j.v);
        location.replace(u.toString());
      })
      .catch(function () {});
  }
  // Enter num campo não envia formulário nem recarrega a página (os cálculos são ao vivo)
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
})();
