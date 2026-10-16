// IRPF 2026 (Lei 15.270), retenção de dividendos, IRPFM, LC 224 e regressões do motor
const test = require('node:test');
const assert = require('node:assert/strict');
const PF = require('../motor/renda-pf.js');
const M = require('../motor/regimes.js');

const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

test('IRPF mensal: até R$ 5.000 o imposto zera com a redução', () => {
  const r = PF.irpfMensal(5000, 0);
  assert.ok(r.impostoTabela > 0);
  assert.equal(r.imposto, 0);
});

test('IRPF mensal: R$ 6.000 tem redução de 978,62 − 0,133145 × 6.000', () => {
  const r = PF.irpfMensal(6000, 0);
  const tabela = (6000 - 607.20) * 0.275 - 908.73;
  assert.ok(perto(r.impostoTabela, tabela));
  assert.ok(perto(r.reducao, 978.62 - 0.133145 * 6000));
});

test('IRPF mensal: a partir de R$ 7.350 não há redução', () => {
  assert.equal(PF.irpfMensal(7350, 0).reducao, 0);
  assert.equal(PF.irpfMensal(9000, 0).reducao, 0);
});

test('IRPF anual: até R$ 60.000 zera; acima de R$ 88.200 não reduz', () => {
  assert.equal(PF.irpfAnual(60000, 0).imposto, 0);
  assert.equal(PF.irpfAnual(90000, 0).reducao, 0);
  const r = PF.irpfAnual(70000, 0);
  assert.ok(perto(r.reducao, 8429.73 - 0.095575 * 70000));
});

test('retenção de dividendos: R$ 50.000 no mês não retém; R$ 50.000,01 retém 10% do total', () => {
  assert.equal(PF.retencaoDividendos(50000), 0);
  assert.equal(PF.retencaoDividendos(50000.01), 5000);
});

test('IRPFM: alíquota zero até R$ 600 mil, 5% em R$ 900 mil, 10% a partir de R$ 1,2 mi', () => {
  assert.equal(PF.aliquotaIrpfm(600000), 0);
  assert.ok(Math.abs(PF.aliquotaIrpfm(900000) - 0.05) < 1e-12);
  assert.equal(PF.aliquotaIrpfm(1200000), 0.10);
  assert.equal(PF.aliquotaIrpfm(5000000), 0.10);
});

test('IRPFM com redutor: PJ com carga de 34% não paga IRPFM adicional sobre os dividendos', () => {
  const d = PF.custoDistribuicao({dividendosMes: 100000, irpjCsllAnualPJ: 340000, lucroContabilAnualPJ: 1000000});
  assert.equal(d.retidoMes, 10000);
  assert.ok(d.devidoAntesRedutor > 0);
  assert.equal(d.custoDividendosAno, 0);
});

test('IRPFM sem redutor: PJ com carga baixa paga a alíquota cheia e o retido é antecipação', () => {
  const d = PF.custoDistribuicao({dividendosMes: 100000, irpjCsllAnualPJ: 50000, lucroContabilAnualPJ: 1000000});
  // REND 1,2 mi → 10% = 120.000; ePJ 5% + ePF 10% = 15% < 34%
  assert.ok(perto(d.custoDividendosAno, 120000));
  assert.ok(perto(d.ajusteAno, 0));
});

const ref = {cbs: 0.0921, ibs: 0.187};

test('LC 224: presunção com +10% só na receita acima de R$ 5 mi por ano', () => {
  const r = M.calcular({receita: 500000, atividade: 'comercio', folha: 0, margem: 0.1, compras: 0, icms: 0, ano: 2026, meses: 1, referencia: ref});
  const irpj = r.regimes.presumido.tributos.find(t => t.codigo === 'IRPJ').valor;
  const base = 500000 * 0.08 * (1 + 0.10 * (1 - 5000000 / 6000000));
  assert.ok(perto(irpj, 0.15 * base + 0.10 * (base - 20000), 1e-6));
});

test('LC 224: abaixo de R$ 5 mi por ano não há acréscimo', () => {
  const r = M.calcular({receita: 400000, atividade: 'comercio', folha: 0, margem: 0.1, compras: 0, icms: 0, ano: 2026, meses: 1, referencia: ref});
  assert.equal(r.regimes.presumido.lc224, 0);
});

test('Lucro Real deduz o ICMS da base de IRPJ/CSLL', () => {
  const r = M.calcular({receita: 100000, atividade: 'comercio', folha: 0, margem: 0.3, compras: 0.5, icms: 0.18, ano: 2026, meses: 1, referencia: ref}).regimes.real;
  const icms = 100000 * 0.18 - 50000 * 0.18;
  const pc = (100000 - 18000 - 50000) * 0.0925;
  const lucro = 30000 - icms - pc;
  const csll = r.tributos.find(t => t.codigo === 'CSLL').valor;
  assert.ok(perto(csll, 0.09 * lucro, 1e-6));
});

test('serviços na 6ª faixa do Simples pagam ISS fora do DAS', () => {
  const r = M.calcular({receita: 350000, atividade: 'servicos', folha: 0, margem: 0.2, compras: 0, iss: 0.05, ano: 2026, meses: 1, referencia: ref}).regimes.simples;
  assert.ok(r.tributos.some(t => t.codigo === 'ISS' && Math.abs(t.valor - 17500) < 1e-6));
});

test('período anual = 12 × mensal (exceto ajustes anuais)', () => {
  const e = {receita: 50000, atividade: 'servicos', folha: 8000, margem: 0.25, compras: 0, iss: 0.05, ano: 2027, referencia: ref, comprador: 'pj_real'};
  const m = M.calcular(Object.assign({}, e, {meses: 1}));
  const a = M.calcular(Object.assign({}, e, {meses: 12}));
  for (const k of M.ORDEM) {
    if (!m.regimes[k].elegivel) continue;
    assert.ok(perto(a.regimes[k].total, 12 * m.regimes[k].total, 1e-6), k);
  }
});

test('memória: a soma das linhas de tributo é o total de cada regime', () => {
  const r = M.calcular({receita: 80000, atividade: 'comercio', folha: 9000, margem: 0.12, compras: 0.55, icms: 0.18, ano: 2030, meses: 6, referencia: ref});
  for (const k of M.ORDEM) {
    const g = r.regimes[k];
    if (!g.elegivel) continue;
    const soma = g.memoria.filter(l => l.codigo).reduce((s, l) => s + l.valor, 0);
    assert.ok(perto(soma, g.total, 1e-6), k);
  }
});
