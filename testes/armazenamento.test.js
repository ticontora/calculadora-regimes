const test = require('node:test');
const assert = require('node:assert/strict');
const criar = require('../dados/armazenamento.js');

function memoria() {
  const m = {};
  return {getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }};
}

test('rascunho: grava, lê e limpa', () => {
  const A = criar(memoria());
  assert.ok(A.salvarRascunho({receita: 10}) instanceof Date);
  assert.equal(A.lerRascunho().dados.receita, 10);
  A.limparRascunho();
  assert.equal(A.lerRascunho(), null);
});

test('histórico: mais recente primeiro e remoção por id', () => {
  const A = criar(memoria());
  const a = A.salvarNoHistorico({titulo: 'A'});
  A.salvarNoHistorico({titulo: 'B'});
  assert.deepEqual(A.listarHistorico().map(i => i.titulo), ['B', 'A']);
  A.removerDoHistorico(a.id);
  assert.deepEqual(A.listarHistorico().map(i => i.titulo), ['B']);
});

test('sem armazenamento (modo privado bloqueado): não quebra', () => {
  const quebrado = {getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); }, removeItem() { throw new Error('bloqueado'); }};
  const A = criar(quebrado);
  assert.equal(A.salvarRascunho({}), null);
  assert.equal(A.lerRascunho(), null);
  assert.deepEqual(A.listarHistorico(), []);
  assert.doesNotThrow(() => A.limparRascunho());
});
