// Módulo imobiliário: casos do relatório da ImobIA conferidos à mão e regras da LC 214/2025
const test = require('node:test');
const assert = require('node:assert/strict');
const IM = require('../motor/imobiliario.js');
const IPCA = require('../motor/ipca.js');

const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const ref = {cbs: 0.0921, ibs: 0.187};
const cod = (r, c) => r.tributos.filter(t => t.codigo === c).reduce((s, t) => s + t.valor, 0);
function venda(extra) {
  return Object.assign({operacao: 'venda', ano: 2026, referencia: ref,
    venda: {valor: 1000000, custo: 200000, aquisicao: {ano: 2015, mes: 1}, mes: 6, corretagem: 0, tipo: 'residencial_usado', natureza: 'estoque'},
    pf: {}, pj: {socios: {quantidade: 1}}}, extra);
}

test('PF, imóvel de 06/1980 vendido em 06/2026: IRPF de R$ 13.712,28 (art. 18 aplicado uma vez)', () => {
  const r = IM.calcular(venda({venda: {valor: 1000000, custo: 200000, aquisicao: {ano: 1980, mes: 6}, mes: 6, tipo: 'residencial_usado'}}));
  assert.equal(cod(r.perfis.pf, 'IRPF'), 13712.28);
});

test('PF, imóvel de 06/2010 vendido em 06/2026: IRPF de R$ 61.354,28', () => {
  const r = IM.calcular(venda({venda: {valor: 1000000, custo: 200000, aquisicao: {ano: 2010, mes: 6}, mes: 6, tipo: 'residencial_usado'}}));
  assert.equal(cod(r.perfis.pf, 'IRPF'), 61354.28);
});

test('redutor de ajuste: R$ 200 mil de 01/2015 corrigidos pelo IPCA viram R$ 379.117,35', () => {
  const r = IM.redutorAjuste({custo: 200000, aquisicao: {ano: 2015, mes: 1}}, {ano: 2027, mes: 6});
  assert.ok(perto(r.valor, 379117.35));
});

test('PJ no Presumido vende R$ 1 mi em 2027: IRPJ + adicional + CSLL = R$ 24.800', () => {
  const r = IM.calcular(venda({ano: 2027, venda: {valor: 1000000, custo: 200000, aquisicao: {ano: 2015, mes: 1}, mes: 6, tipo: 'residencial_novo', natureza: 'estoque'}}));
  const p = r.perfis.pjPresumido;
  assert.ok(perto(cod(p, 'IRPJ') + cod(p, 'CSLL'), 24800));
  assert.equal(cod(p, 'PIS'), 0);
});

test('PJ vende em 2027: CBS = base × (9,21% − 0,1) × 50% e IBS = base × 0,1% × 50%, base após os dois redutores', () => {
  const e = venda({ano: 2027, venda: {valor: 1000000, custo: 200000, aquisicao: {ano: 2015, mes: 1}, mes: 6, tipo: 'residencial_novo', natureza: 'estoque'}});
  const r = IM.calcular(e);
  const social = 100000 * IPCA.fator({ano: 2025, mes: 2}, {ano: 2027, mes: 5});
  const base = 1000000 - 379117.35 - social;
  assert.ok(perto(cod(r.perfis.pjPresumido, 'CBS'), base * 0.0911 * 0.5, 0.05));
  assert.ok(perto(cod(r.perfis.pjPresumido, 'IBS'), base * 0.001 * 0.5, 0.05));
});

test('mesma venda em 2033: CBS 4,605% e IBS 9,35% sobre a base', () => {
  const r = IM.calcular(venda({ano: 2033, venda: {valor: 1000000, custo: 200000, aquisicao: {ano: 2015, mes: 1}, mes: 6, tipo: 'comercial', natureza: 'estoque'}}));
  const base = 1000000 - 379117.35;
  assert.ok(perto(cod(r.perfis.pjPresumido, 'CBS'), base * 0.04605, 0.05));
  assert.ok(perto(cod(r.perfis.pjPresumido, 'IBS'), base * 0.0935, 0.05));
});

test('PF contribuinte aluga R$ 10 mil/mês em 2033: IR R$ 1.674,29 (com desconto simplificado) e CBS/IBS com 70% de redução', () => {
  const r = IM.calcular({operacao: 'locacao', ano: 2033, meses: 1, referencia: ref,
    locacao: {aluguel: 10000, imoveis: 1, residencial: true, despesas: 0, descontoSimplificado: true},
    pf: {locacaoAnoAnterior: 300000, imoveisLocadosAnoAnterior: 4}, pj: {}});
  const pf = r.perfis.pf;
  assert.ok(r.pfContribuinte.sim);
  assert.ok(perto(cod(pf, 'IRPF'), 1674.29));
  const social = 600 * IPCA.fator({ano: 2025, mes: 2}, {ano: 2032, mes: 12});
  assert.ok(perto(cod(pf, 'CBS'), (10000 - social) * 0.0921 * 0.3));
  assert.ok(perto(cod(pf, 'IBS'), (10000 - social) * 0.187 * 0.3));
});

test('carnê-leão sem desconto simplificado (padrão conservador): R$ 10 mil → R$ 1.841,27', () => {
  const r = IM.calcular({operacao: 'locacao', ano: 2026, meses: 1, referencia: ref, locacao: {aluguel: 10000, imoveis: 1, residencial: true, despesas: 0}, pf: {}, pj: {}});
  assert.ok(perto(cod(r.perfis.pf, 'IRPF'), 10000 * 0.275 - 908.73));
});

test('PF abaixo dos limites do art. 251 não paga CBS/IBS', () => {
  const r = IM.calcular({operacao: 'locacao', ano: 2030, meses: 1, referencia: ref, locacao: {aluguel: 5000, imoveis: 2, residencial: true}, pf: {}, pj: {}});
  assert.equal(r.pfContribuinte.sim, false);
  assert.equal(cod(r.perfis.pf, 'CBS'), 0);
});

test('locação no Simples é vedada', () => {
  const r = IM.calcular({operacao: 'locacao', ano: 2027, meses: 1, referencia: ref, locacao: {aluguel: 5000, imoveis: 1}, pf: {}, pj: {}});
  assert.equal(r.perfis.pjSimples.elegivel, false);
});

test('art. 487: 3,65% sobre o aluguel; contrato residencial só até 2028', () => {
  const base = {operacao: 'locacao', meses: 1, referencia: ref, locacao: {aluguel: 20000, imoveis: 1, residencial: true, art487: true, finalidade487: 'residencial'}, pf: {}, pj: {}};
  const r28 = IM.calcular(Object.assign({}, base, {ano: 2028}));
  assert.ok(perto(cod(r28.perfis.pjPresumido, 'CBS/IBS (transição)'), 730));
  const r29 = IM.calcular(Object.assign({}, base, {ano: 2029}));
  assert.equal(cod(r29.perfis.pjPresumido, 'CBS/IBS (transição)'), 0);
  assert.ok(cod(r29.perfis.pjPresumido, 'CBS') > 0);
});

test('isenção do único imóvel até R$ 440 mil', () => {
  const r = IM.calcular(venda({venda: {valor: 400000, custo: 100000, aquisicao: {ano: 2010, mes: 1}, mes: 6, tipo: 'residencial_usado', unicoImovel: true}}));
  assert.equal(cod(r.perfis.pf, 'IRPF'), 0);
});

test('reinvestimento de metade do valor isenta metade do imposto', () => {
  const sem = IM.calcular(venda({venda: {valor: 1000000, custo: 200000, aquisicao: {ano: 2010, mes: 6}, mes: 6, tipo: 'residencial_usado'}}));
  const com = IM.calcular(venda({venda: {valor: 1000000, custo: 200000, aquisicao: {ano: 2010, mes: 6}, mes: 6, tipo: 'residencial_usado', reinvestido: 500000}}));
  assert.ok(perto(cod(com.perfis.pf, 'IRPF'), cod(sem.perfis.pf, 'IRPF') / 2));
});

test('empresa vendendo imóvel do ativo: ganho de capital no Presumido e sem PIS/COFINS', () => {
  const r = IM.calcular(venda({venda: {valor: 1000000, custo: 200000, aquisicao: {ano: 2015, mes: 1}, mes: 6, tipo: 'comercial', natureza: 'ativo'}}));
  const p = r.perfis.pjPresumido;
  assert.equal(cod(p, 'PIS'), 0);
  assert.ok(perto(cod(p, 'CSLL'), 800000 * 0.09));
  assert.ok(perto(cod(p, 'IRPJ'), 800000 * 0.15 + (800000 - 60000) * 0.10));
});

test('memória: soma das linhas de tributo = total de cada perfil', () => {
  for (const op of ['venda', 'locacao']) {
    for (const ano of [2026, 2027, 2031, 2033]) {
      const r = IM.calcular(op === 'venda'
        ? venda({ano, venda: {valor: 800000, custo: 300000, aquisicao: {ano: 2018, mes: 3}, mes: 4, tipo: 'residencial_novo', natureza: 'estoque', rbt12Simples: 1200000}, pf: {vendasAnoAnterior: 4}})
        : {operacao: 'locacao', ano, meses: 3, referencia: ref, locacao: {aluguel: 30000, imoveis: 3, residencial: true, despesas: 2000}, pf: {locacaoAnoAnterior: 400000, imoveisLocadosAnoAnterior: 5}, pj: {}});
      for (const k of IM.ORDEM) {
        const g = r.perfis[k];
        if (!g.elegivel) continue;
        const soma = g.memoria.filter(l => l.codigo).reduce((s, l) => s + l.valor, 0);
        assert.ok(perto(soma, g.total, 1e-6), op + ' ' + ano + ' ' + k);
      }
    }
  }
});
