const G = require('../co/gcap.js'), Vd = require('../co/venda.js'), assert = require('assert');
const near = (a, b, t = 0.01) => assert.ok(Math.abs(a - b) < t, a + ' ≠ ' + b);
// Mesmo resultado da aba Venda para um imóvel simples
const venda = Vd.calcular({venda: '2026-09', imoveis: [{descricao: 'Apto', valor: 900000, custo: 400000, aquisicao: '2015-06', tipo: 'usado'}]});
const g = G.calcular({venda: '2026-09', valorVenda: 900000, aquisicao: {data: '2015-06', valor: 400000}});
near(g.irTotal, venda.porImovel[0].irPF);
// Benfeitoria posterior: cada parcela com os fatores da própria data
const f1 = Vd.fatoresPF('2015-06', '2026-09'), f2 = Vd.fatoresPF('2020-03', '2026-09');
const b = G.calcular({venda: '2026-09', valorVenda: 900000, aquisicao: {data: '2015-06', valor: 300000}, benfeitorias: [{data: '2020-03', valor: 100000}]});
near(b.baseTotal, 500000 * .75 * f1.fr1 * f1.fr2 + 500000 * .25 * f2.fr1 * f2.fr2);
// Aquisição em 1980 com redução de 45%; benfeitoria de 1995 sem redução
const r = G.calcular({venda: '2026-09', valorVenda: 500000, aquisicao: {data: '1980-05', valor: 50000}, benfeitorias: [{data: '1995-01', valor: 50000}]});
assert.strictEqual(r.parcelas[0].red7713, .45); assert.strictEqual(r.parcelas[1].red7713, 0);
// Imóvel de 1969: isento
assert.strictEqual(G.calcular({venda: '2026-09', valorVenda: 500000, aquisicao: {data: '1969-01', valor: 1000}}).irTotal, 0);
// Corretagem reduz a alienação
assert.strictEqual(G.calcular({venda: '2026-09', valorVenda: 500000, corretagem: 30000, aquisicao: {data: '2026-01', valor: 300000}}).ganho, 170000);
// Condomínio: R$ 440 mil por condômino (IN 84, art. 29, parágrafo 1º, II, a)
const c = G.calcular({venda: '2026-09', valorVenda: 800000, aquisicao: {data: '2026-01', valor: 500000},
  proprietarios: [{nome: 'A', pct: .5, unico: true}, {nome: 'B', pct: .5, unico: false}]});
assert.strictEqual(c.proprietarios[0].ir, 0); near(c.proprietarios[1].ir, c.proprietarios[1].baseParte * .15);
// Proprietário único acima de 440 mil não isenta
assert.ok(G.calcular({venda: '2026-09', valorVenda: 800000, aquisicao: {data: '2026-01', valor: 500000}, proprietarios: [{pct: 1, unico: true}]}).irTotal > 0);
// Reinvestimento parcial: isenção proporcional
const re = G.calcular({venda: '2026-09', valorVenda: 1000000, aquisicao: {data: '2026-01', valor: 600000}, proprietarios: [{pct: 1, reinvestido: 600000}]});
near(re.proprietarios[0].base, re.baseTotal * .4);
// Venda a prazo: IR rateado e vencimentos
const p = G.calcular({venda: '2026-09', valorVenda: 1000000, aquisicao: {data: '2026-01', valor: 600000}, recebimentos: [{data: '2026-09', valor: 400000}, {data: '2026-12', valor: 600000}]});
near(p.darfs[0].valor, p.irTotal * .4); assert.strictEqual(p.darfs[0].vencimento, '2026-10-30'); assert.strictEqual(p.darfs[1].vencimento, '2027-01-29');
// Vencimentos com feriado: venda em 02/2027 → março/2027 termina numa quarta (31); venda em 03/2026 → 30/04/2026 (quinta)
assert.strictEqual(G.vencimento('2027-02'), '2027-03-31'); assert.strictEqual(G.vencimento('2026-03'), '2026-04-30');
// Venda em 10/2026: 30/11/2026 é segunda; 31/05/2026 domingo → 29/05
assert.strictEqual(G.vencimento('2026-10'), '2026-11-30'); assert.strictEqual(G.vencimento('2026-04'), '2026-05-29');
// Atraso: 10 dias → multa 3,3%; pagamento no mês seguinte com Selic 1% → juros 2%
const a = G.acrescimos(1000, '2026-10-30', '2026-11-09', .01); near(a.multa, 33); near(a.juros, 20);
near(G.acrescimos(1000, '2026-10-30', '2027-06-30', .05).multa, 200);
// Sem ganho
assert.strictEqual(G.calcular({venda: '2026-09', valorVenda: 300000, aquisicao: {data: '2020-01', valor: 350000}}).irTotal, 0);
console.log('GCAP OK');
assert.strictEqual(G.vencimento('2026-11'), '2026-12-30');
console.log('GCAP 31/12 OK');
