// Testes da transição CBS/IBS 2026–2033 (alíquotas, partilha do DAS e regimes regulares)
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../motor/simples.js');
const M = require('../motor/regimes.js');

const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const ref = {cbs: 0.0921, ibs: 0.187};

test('cronograma de alíquotas CBS/IBS', () => {
  const a26 = M.aliquotasCbsIbs(2026, ref);
  assert.ok(a26.teste && perto(a26.cbs, 0.009) && perto(a26.ibs, 0.001));
  const a27 = M.aliquotasCbsIbs(2027, ref);
  assert.ok(perto(a27.cbs, 0.0911) && perto(a27.ibs, 0.001));
  const a28 = M.aliquotasCbsIbs(2028, ref);
  assert.ok(perto(a28.cbs, 0.0911) && perto(a28.ibs, 0.001));
  [[2029, 0.1], [2030, 0.2], [2031, 0.3], [2032, 0.4], [2033, 1]].forEach(([ano, f]) => {
    const a = M.aliquotasCbsIbs(ano, ref);
    assert.ok(perto(a.cbs, 0.0921), 'CBS cheia em ' + ano);
    assert.ok(perto(a.ibs, 0.187 * f), 'IBS em ' + ano);
  });
});

test('Anexo I, 1ª faixa: partilha oficial de 2027 a 2033', () => {
  const p27 = S.partilha('comercio', 0, 2027);
  assert.ok(perto(p27.cbs, 15.33) && perto(p27.ibs, 0.17) && perto(p27.icms, 34));
  assert.equal(p27.pis, undefined);
  const p29 = S.partilha('comercio', 0, 2029);
  assert.ok(perto(p29.cbs, 15.5) && perto(p29.icms, 30.6) && perto(p29.ibs, 3.4));
  const p32 = S.partilha('comercio', 0, 2032);
  assert.ok(perto(p32.icms, 20.4) && perto(p32.ibs, 13.6));
  const p33 = S.partilha('comercio', 0, 2033);
  assert.ok(perto(p33.ibs, 34) && p33.icms === undefined);
});

test('Anexo I, 6ª faixa em 2027: 13,58 / 10,06 / 34,02 / 42,34', () => {
  const p = S.partilha('comercio', 5, 2027);
  assert.ok(perto(p.cbs, 34.02));
  assert.ok(perto(p.irpj, 13.58, 0.005) && perto(p.csll, 10.06, 0.005) && perto(p.cpp, 42.34, 0.005));
});

test('Anexo III, 5ª faixa em 2029: ISS 30,15% e IBS 3,35%', () => {
  const p = S.partilha('servicos', 4, 2029);
  assert.ok(perto(p.iss, 30.15) && perto(p.ibs, 3.35) && perto(p.cbs, 15.6));
});

const base = {receita: 100000, atividade: 'comercio', folha: 10000, margem: 0.15, compras: 0.6, icms: 0.18, iss: 0, meses: 1, referencia: ref, comprador: 'pf'};
const cod = (r, c) => r.tributos.filter(t => t.codigo === c).reduce((s, t) => s + t.valor, 0);

test('Presumido: PIS/COFINS em 2026; CBS/IBS de 2027 em diante; teste de 2026 com custo zero', () => {
  const r26 = M.calcular(Object.assign({}, base, {ano: 2026})).regimes.presumido;
  assert.ok(cod(r26, 'PIS') > 0 && cod(r26, 'COFINS') > 0);
  assert.equal(cod(r26, 'CBS'), 0);
  const r27 = M.calcular(Object.assign({}, base, {ano: 2027})).regimes.presumido;
  assert.equal(cod(r27, 'PIS'), 0);
  assert.ok(cod(r27, 'CBS') > 0 && cod(r27, 'IBS') > 0);
});

test('ICMS do regime regular cai 10% ao ano de 2029 a 2032 e some em 2033', () => {
  const icms = ano => cod(M.calcular(Object.assign({}, base, {ano})).regimes.presumido, 'ICMS');
  const cheio = 100000 * 0.18 * (1 - 0.6);
  assert.ok(perto(icms(2028), cheio));
  assert.ok(perto(icms(2029), cheio * 0.9));
  assert.ok(perto(icms(2032), cheio * 0.6));
  assert.equal(icms(2033), 0);
});

test('CBS/IBS do Presumido em 2027: débito sem ICMS na base, menos crédito das compras', () => {
  const r = M.calcular(Object.assign({}, base, {ano: 2027})).regimes.presumido;
  const t = 0.0911 + 0.001;
  const debito = t * (100000 - 18000) / (1 + t);
  const credito = t * 60000 * (1 - 0.18) / (1 + t);
  assert.ok(perto(cod(r, 'CBS') + cod(r, 'IBS'), debito - credito, 1e-6));
});

test('Simples com CBS/IBS fora do DAS só existe a partir de 2027', () => {
  assert.equal(M.calcular(Object.assign({}, base, {ano: 2026})).regimes.simplesFora.elegivel, false);
  const r = M.calcular(Object.assign({}, base, {ano: 2027})).regimes.simplesFora;
  assert.equal(r.elegivel, true);
  assert.ok(cod(r, 'CBS') > 0);
});

test('Simples no DAS: total do DAS igual de 2026 a 2028 nas faixas 1 a 5 (só muda a partilha)', () => {
  const das = ano => M.calcular(Object.assign({}, base, {ano})).regimes.simples.das;
  assert.ok(perto(das(2026), das(2027)) && perto(das(2027), das(2029)) && perto(das(2029), das(2033)));
});

test('a soma dos tributos do Simples é o DAS (sem itens fora do DAS)', () => {
  for (const ano of [2026, 2027, 2030, 2033]) {
    const r = M.calcular(Object.assign({}, base, {ano})).regimes.simples;
    assert.ok(perto(r.total, r.das, 1e-6), String(ano));
  }
});
