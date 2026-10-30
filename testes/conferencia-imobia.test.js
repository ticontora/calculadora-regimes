// Conferência com os resultados documentados da calculadora de referência (relatório de 16/10/2026).
// Onde ela erra contra a lei, o teste fixa o valor da LEI e diz a diferença.
const test = require('node:test');
const assert = require('node:assert');
const IM = require('../motor/imobiliario.js');
const GC = require('../motor/ganho-capital.js');

const ref = {cbs: 0.0921, ibs: 0.187};
const soma = (p, ...c) => p.tributos.filter(t => c.includes(t.codigo)).reduce((s, t) => s + t.valor, 0);
const cent = v => Math.round(v * 100) / 100;
const venda = (ano, extra) => IM.calcular(Object.assign({operacao: 'venda', ano, referencia: ref,
  venda: {valor: 1e6, custo: 2e5, aquisicao: {ano: 2015, mes: 1}, mes: 6, tipo: 'residencial_novo', natureza: 'estoque'}, pf: {}, pj: {}}, extra));
const locacao = extra => IM.calcular(Object.assign({operacao: 'locacao', ano: 2033, meses: 1, referencia: ref,
  locacao: {aluguel: 10000, imoveis: 1, residencial: true, descontoSimplificado: true},
  pf: {locacaoAnoAnterior: 300000, imoveisLocadosAnoAnterior: 4}, pj: {}}, extra));

test('ganho de capital, imóvel de 06/2010: igual à referência (R$ 61.354,28 sobre ganho de R$ 409.029)', () => {
  const r = GC.calcular({valorVenda: 1e6, custoAquisicao: 2e5, aquisicao: {ano: 2010, mes: 6}, venda: {ano: 2026, mes: 6}});
  assert.strictEqual(cent(r.imposto), 61354.28);
  assert.strictEqual(Math.round(r.ganhoTributavel), 409029);
});

test('ganho de capital, imóvel de 06/1980: segue a lei (R$ 13.712,28), não a referência (R$ 7.541,75, art. 18 aplicado 2 vezes)', () => {
  const r = GC.calcular({valorVenda: 1e6, custoAquisicao: 2e5, aquisicao: {ano: 1980, mes: 6}, venda: {ano: 2026, mes: 6}});
  assert.strictEqual(cent(r.imposto), 13712.28);
});

test('redutor de ajuste: R$ 200 mil de 01/2015 corrigidos = R$ 379.117,35 (igual à referência)', () => {
  assert.strictEqual(cent(venda(2027).redutores.ajuste.valor), 379117.35);
});

test('venda PJ Presumido: alíquotas iguais à referência (2027: 4,555% + 0,05%; 2033: 4,605% + 9,35%) e IRPJ+CSLL R$ 24.800', () => {
  for (const [ano, cbs, ibs] of [[2027, 0.04555, 0.0005], [2033, 0.04605, 0.0935]]) {
    const r = venda(ano, {corrigirRedutorSocial: false});
    const base = 1e6 - r.redutores.ajuste.valor - 100000;
    const p = r.perfis.pjPresumido;
    assert.strictEqual(cent(soma(p, 'CBS')), cent(base * cbs), 'CBS ' + ano);
    assert.strictEqual(cent(soma(p, 'IBS')), cent(base * ibs), 'IBS ' + ano);
    assert.strictEqual(cent(soma(p, 'IRPJ', 'CSLL')), 24800);
  }
});

test('locação PF contribuinte 2033 sem corrigir o redutor social: idêntica à referência', () => {
  const p = locacao({corrigirRedutorSocial: false}).perfis.pf;
  assert.strictEqual(cent(soma(p, 'IRPF')), 1674.29);
  assert.strictEqual(cent(soma(p, 'CBS')), 259.72);
  assert.strictEqual(cent(soma(p, 'IBS')), 527.34);
});

test('padrão segue a lei: redutor social corrigido pelo IPCA deixa a CBS/IBS menor que a da referência', () => {
  const p = locacao().perfis.pf;
  assert.ok(soma(p, 'CBS') < 259.72 && soma(p, 'IBS') < 527.34);
  assert.ok(venda(2027).redutores.social > 100000);
  assert.strictEqual(venda(2027, {corrigirRedutorSocial: false}).redutores.social, 100000);
});
