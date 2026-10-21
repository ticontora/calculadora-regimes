/* Efeitos da tela de introdução: símbolos subindo e valores das barras contando. Desligado com "reduzir movimento". */
(function () {
  'use strict';
  var calmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (v) { return 'R$ ' + Math.round(v).toLocaleString('pt-BR'); };
  document.querySelectorAll('.barra .valor').forEach(function (el) {
    var alvo = Number(el.getAttribute('data-alvo')) || 0;
    if (calmo) { el.textContent = fmt(alvo); return; }
    var atraso = parseFloat(getComputedStyle(el.parentNode).getPropertyValue('--d')) * 1000 || 0;
    setTimeout(function () {
      var ini = performance.now(), dur = 900;
      (function passo(t) {
        var p = Math.min(1, (t - ini) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(alvo * e);
        if (p < 1) requestAnimationFrame(passo);
      })(ini);
    }, atraso);
  });
  var box = document.getElementById('particulas');
  if (!box || calmo) return;
  var simbolos = ['R$', '%', '§', 'R$', '%', '+'];
  for (var i = 0; i < 16; i++) {
    var s = document.createElement('span');
    s.textContent = simbolos[i % simbolos.length];
    s.style.left = (Math.random() * 96 + 2) + '%';
    s.style.fontSize = (11 + Math.random() * 12) + 'px';
    s.style.animationDuration = (12 + Math.random() * 14) + 's';
    s.style.animationDelay = (-Math.random() * 20) + 's';
    box.appendChild(s);
  }
})();
