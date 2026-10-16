/*
 * Camada de dados: rascunho automático e histórico de simulações, no navegador de quem usa.
 * Nada sai do computador. Tudo protegido com try/catch: sem armazenamento, a calculadora funciona igual.
 * O armazenamento pode ser trocado (testes usam um objeto em memória).
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica;
  else raiz.Armazenamento = fabrica(function () { try { return raiz.localStorage; } catch (e) { return null; } }());
})(typeof self !== 'undefined' ? self : this, function (armazenamento) {
  'use strict';

  const CHAVE_RASCUNHO = 'calc-regimes:rascunho:v1';
  const CHAVE_HISTORICO = 'calc-regimes:historico:v1';
  const MAX_HISTORICO = 30;

  function ler(chave) {
    try { const t = armazenamento && armazenamento.getItem(chave); return t ? JSON.parse(t) : null; }
    catch (e) { return null; }
  }
  function gravar(chave, valor) {
    try { if (!armazenamento) return false; armazenamento.setItem(chave, JSON.stringify(valor)); return true; }
    catch (e) { return false; }
  }
  function apagar(chave) {
    try { if (armazenamento) armazenamento.removeItem(chave); } catch (e) { /* sem armazenamento */ }
  }

  // "nome" separa o rascunho de cada calculadora (vazio = regimes; 'imob' = imobiliário)
  function salvarRascunho(dados, nome) {
    const quando = new Date().toISOString();
    return gravar(CHAVE_RASCUNHO + (nome ? ':' + nome : ''), {quando, dados}) ? new Date(quando) : null;
  }
  function lerRascunho(nome) { return ler(CHAVE_RASCUNHO + (nome ? ':' + nome : '')); }
  function limparRascunho(nome) { apagar(CHAVE_RASCUNHO + (nome ? ':' + nome : '')); }
  // Última calculadora usada
  function lerModo() { return ler('calc-regimes:modo:v1'); }
  function salvarModo(m) { gravar('calc-regimes:modo:v1', m); }

  function listarHistorico() {
    const l = ler(CHAVE_HISTORICO);
    return Array.isArray(l) ? l : [];
  }
  function salvarNoHistorico(item) {
    const lista = listarHistorico();
    const novo = Object.assign({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), criadoEm: new Date().toISOString()}, item);
    lista.unshift(novo);
    return gravar(CHAVE_HISTORICO, lista.slice(0, MAX_HISTORICO)) ? novo : null;
  }
  function removerDoHistorico(id) {
    gravar(CHAVE_HISTORICO, listarHistorico().filter(i => i.id !== id));
  }

  return {salvarRascunho, lerRascunho, limparRascunho, lerModo, salvarModo, listarHistorico, salvarNoHistorico, removerDoHistorico};
});
