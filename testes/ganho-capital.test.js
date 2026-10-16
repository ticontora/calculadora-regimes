// Teste obrigatório: imóvel adquirido em 1980. A redução do art. 18 da Lei 7.713/88 deve ser aplicada UMA vez.
const test = require('node:test');
const assert = require('node:assert/strict');
const GC = require('../motor/ganho-capital.js');

const venda1980 = {valorVenda: 1000000, custoAquisicao: 200000, aquisicao: {ano: 1980, mes: 6}, venda: {ano: 2026, mes: 6}};

test('imóvel de 06/1980 vendido em 06/2026: IR de R$ 13.712,28', () => {
  const r = GC.calcular(venda1980);
  assert.equal(r.imposto, 13712.28);
});

test('a redução do art. 18 entra uma única vez (não dá os R$ 7.541,75 da aplicação dupla)', () => {
  const r = GC.calcular(venda1980);
  assert.notEqual(r.imposto, 7541.75);
  assert.equal(r.percentualArt18, 0.45);
  // Ganho após a redução = ganho bruto × 55%, e o imposto incide sobre esse ganho já reduzido, sem nova redução
  assert.equal(r.ganhoAposArt18, 800000 * 0.55);
  const semNovaReducao = Math.round(r.ganhoAposArt18 * r.fr1 * r.fr2 * 0.15 * 100) / 100;
  assert.equal(r.imposto, semNovaReducao);
  const etapasReducao = r.memoria.filter(l => /art\. 18/.test(l.fundamento));
  assert.equal(etapasReducao.length, 1);
});

test('contagem de meses do caso de 1980: m1 = 119 e m2 = 246', () => {
  const r = GC.calcular(venda1980);
  assert.equal(r.m1, 119);
  assert.equal(r.m2, 246);
});

test('imóvel de 06/2010: sem art. 18 nem FR1; FR2 com 192 meses; IR de R$ 61.354,28', () => {
  const r = GC.calcular({valorVenda: 1000000, custoAquisicao: 200000, aquisicao: {ano: 2010, mes: 6}, venda: {ano: 2026, mes: 6}});
  assert.equal(r.percentualArt18, 0);
  assert.equal(r.m1, 0);
  assert.equal(r.m2, 192);
  assert.equal(r.imposto, 61354.28);
});

test('tabela do art. 18: 100% até 1969, 95% em 1970, 5% em 1988, zero a partir de 1989', () => {
  assert.equal(GC.percentualArt18(1969), 1);
  assert.ok(Math.abs(GC.percentualArt18(1970) - 0.95) < 1e-12);
  assert.ok(Math.abs(GC.percentualArt18(1988) - 0.05) < 1e-12);
  assert.equal(GC.percentualArt18(1989), 0);
});

test('alíquotas progressivas: 15% até R$ 5 mi e 17,5% na fatia seguinte', () => {
  assert.equal(GC.impostoPorFaixa(5000000), 750000);
  assert.equal(GC.impostoPorFaixa(6000000), 750000 + 175000);
});
