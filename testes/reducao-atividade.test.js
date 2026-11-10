// Redução de CBS/IBS da atividade (LC 214/2025, arts. 127 a 138 e 261), como na calculadora do Societário
const test = require('node:test');
const assert = require('node:assert');
const M = require('../motor/regimes.js');
const ref = {cbs: 0.113, ibs: 0.187};
const base = {atividade: 'comercio', receita: 100000, folha: 0, margem: 0.2, compras: 0, icms: 0, iss: 0, ano: 2033, meses: 1, referencia: ref};
const cod = (r, c) => r.tributos.filter(t => t.codigo === c).reduce((s, t) => s + t.valor, 0);
const cent = v => Math.round(v * 100) / 100;

test('60% de redução: débito a 12% (30% × 0,4) contido no preço, repartido entre CBS e IBS', () => {
  const r = M.calcular(Object.assign({}, base, {reducaoCbsIbs: 0.6})).regimes.presumido;
  const deb = 100000 * 0.12 / 1.12;
  assert.strictEqual(cent(cod(r, 'CBS')), cent(deb * 0.113 / 0.3));
  assert.strictEqual(cent(cod(r, 'IBS')), cent(deb * 0.187 / 0.3));
});

test('sem redução continua igual ao cálculo anterior', () => {
  const a = M.calcular(base).regimes.real, b = M.calcular(Object.assign({}, base, {reducaoCbsIbs: 0})).regimes.real;
  assert.strictEqual(a.total, b.total);
});

test('dentro do DAS a redução não muda o Simples', () => {
  const a = M.calcular(Object.assign({}, base, {receita: 30000})).regimes.simples.total;
  const b = M.calcular(Object.assign({}, base, {receita: 30000, reducaoCbsIbs: 0.6})).regimes.simples.total;
  assert.strictEqual(a, b);
});

test('a redução diminui o crédito que o comprador aproveita', () => {
  const a = M.calcular(base).regimes.presumido, b = M.calcular(Object.assign({}, base, {reducaoCbsIbs: 0.6})).regimes.presumido;
  assert.strictEqual(cent(b.creditoComprador), cent(100000 * 0.12 / 1.12));
  assert.ok(b.creditoComprador < a.creditoComprador);
});

test('encargos além da CPP entram no Presumido e no Real, não no Simples', () => {
  const b2 = Object.assign({}, base, {receita: 30000, folha: 10000});
  const a = M.calcular(b2), b = M.calcular(Object.assign({}, b2, {encargos: 0.058}));
  assert.strictEqual(cent(b.regimes.presumido.total - a.regimes.presumido.total), 580);
  assert.strictEqual(b.regimes.simples.total, a.regimes.simples.total);
});
