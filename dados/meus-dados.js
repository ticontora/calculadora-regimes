/* Página "Seus dados e exclusão": lista o que esta calculadora guarda neste navegador, baixa uma cópia e apaga. */
(function () {
  'use strict';
  const P = window.Privacidade;
  const $ = id => document.getElementById(id);
  const NOMES = {
    'calc-regimes:rascunho:v1': 'Rascunho da Calculadora Geral Tributária',
    'calc-regimes:rascunho:v1:imob': 'Rascunho da Calculadora Imobiliária',
    'calc-regimes:historico:v1': 'Histórico de simulações',
    'calc-regimes:modo:v1': 'Última calculadora aberta',
    'calc-regimes:apuracao:dados:v1': 'Arquivos importados no Gestor de Apuração',
    'calc-regimes:apuracao:config:v1': 'Regras e prazos do Gestor de Apuração',
    'co-calc-obra': 'Valores da aba Construção e Incorporação'
  };
  const kb = n => n < 1024 ? n + ' bytes' : (n / 1024).toLocaleString('pt-BR', {maximumFractionDigits: 1}) + ' KB';
  function listar() {
    const ks = P.chaves();
    const pref = P.lerPref();
    let h = '<p><b>Sua escolha:</b> ' + (!pref ? 'ainda não escolhida (salvando)' : pref.salvar ? 'salvar neste navegador' : 'não salvar (apaga ao sair)') + '.</p>';
    if (!ks.length) { $('md-lista').innerHTML = h + '<p>Nenhum dado desta calculadora está guardado neste navegador.</p>'; return; }
    h += '<div class="tabela"><table><thead><tr><th>O que é</th><th>Nome técnico</th><th>Tamanho</th></tr></thead><tbody>';
    ks.forEach(k => {
      const v = localStorage.getItem(k) || '';
      let extra = '';
      if (k === 'calc-regimes:historico:v1') { try { extra = ' (' + JSON.parse(v).length + ' simulações)'; } catch (e) {} }
      const nome = document.createElement('span'); nome.textContent = (NOMES[k] || k) + extra;
      const tec = document.createElement('code'); tec.textContent = k;
      h += '<tr><td>' + nome.innerHTML + '</td><td>' + tec.outerHTML + '</td><td>' + kb((k.length + v.length) * 2) + '</td></tr>';
    });
    $('md-lista').innerHTML = h + '</tbody></table></div>';
  }
  function msg(t) { $('md-ok').textContent = t; }
  $('md-apagar').addEventListener('click', () => { P.apagarDados(); listar(); msg('Dados desta calculadora apagados deste navegador.'); });
  $('md-apagar-tudo').addEventListener('click', () => { P.apagarTudo(); listar(); msg('Tudo apagado, inclusive a sua escolha. Na próxima visita a calculadora pergunta de novo.'); });
  $('md-baixar').addEventListener('click', () => {
    const dados = {};
    P.chaves().forEach(k => { const v = localStorage.getItem(k); try { dados[k] = JSON.parse(v); } catch (e) { dados[k] = v; } });
    const blob = new Blob([JSON.stringify({exportado_em: new Date().toISOString(), origem: location.origin + location.pathname.replace(/[^/]*$/, ''), dados}, null, 2)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'meus-dados-calculadora.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    msg('Cópia baixada.');
  });
  listar();
})();
