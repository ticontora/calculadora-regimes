const I = require('../co/itbi.js'); const assert = require('assert');
// Guarulhos 3%, sem SFH
assert.strictEqual(I.compra({municipio: 'guarulhos', valorDeclarado: 500000, financiadoSfh: 300000}).devido.total, 15000);
// São Paulo: imóvel 600 mil, financiado 400 mil → 0,5% × 120.968 + 3% × (600.000 − 120.968)
const sp = I.compra({municipio: 'saopaulo', valorDeclarado: 600000, financiadoSfh: 400000}).devido.total;
assert.strictEqual(Math.round(sp * 100) / 100, Math.round((120968 * .005 + (600000 - 120968) * .03) * 100) / 100);
// SP acima de 725.808 → 3% em tudo
assert.strictEqual(I.compra({municipio: 'saopaulo', valorDeclarado: 800000, financiadoSfh: 400000}).devido.total, 24000);
// SJC: 0,5% no financiado e 2% no restante
assert.strictEqual(I.compra({municipio: 'sjc', valorDeclarado: 500000, financiadoSfh: 300000}).devido.total, 300000 * .005 + 200000 * .02);
// Outro município
assert.strictEqual(I.compra({municipio: 'outro', aliquota: .025, valorDeclarado: 400000}).devido.total, 10000);
// Valor de referência maior gera cenário
assert.ok(I.compra({municipio: 'guarulhos', valorDeclarado: 500000, valorReferencia: 650000}).cenarioPrefeitura.total === 19500);
// Integralização: capital 300 mil, transferido 300 mil, mercado 900 mil
const r = I.integralizacao({municipio: 'guarulhos', imoveis: [{descricao: 'Apto', valorCapital: 300000, valorTransferido: 300000, valorMercado: 900000}]});
assert.strictEqual(r.totais.itbiContrib, 0); assert.strictEqual(r.totais.itbiFisco, 18000);
// Reserva de capital: transferido 500 mil, capital 300 mil → excesso 200 mil
assert.strictEqual(I.integralizacao({municipio: 'guarulhos', imoveis: [{valorCapital: 300000, valorTransferido: 500000}]}).totais.itbiContrib, 6000);
// Custas SP 2026: faixas e ISS sobre a parcela do tabelião/oficial
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.01, a + ' ≠ ' + b);
assert.deepStrictEqual(I.faixa(I.CUSTAS.SP2026.notas, 1524), {ate: 1524, parcela: 212.51, total: 352.36});
assert.strictEqual(I.faixa(I.CUSTAS.SP2026.notas, 1524.01).total, 526.56);
assert.strictEqual(I.faixa(I.CUSTAS.SP2026.notas, 50e6).total, 64802.03);
assert.strictEqual(I.faixa(I.CUSTAS.SP2026.registro, 2306).total, 257.20);
assert.strictEqual(I.faixa(I.CUSTAS.SP2026.registro, 111e6).parcela, 103412.02);
assert.strictEqual(I.faixa(I.CUSTAS.SP2026.registro, 200e6).total, 231274.12);
assert.strictEqual(I.CUSTAS.SP2026.notas.length, 32); assert.strictEqual(I.CUSTAS.SP2026.registro.length, 48);
// faixas crescentes
['notas', 'registro'].forEach(k => I.CUSTAS.SP2026[k].forEach((f, i, a) => { if (i) { assert.ok(f[1] > a[i - 1][1] && f[2] > a[i - 1][2]); if (f[0] !== null) assert.ok(f[0] > a[i - 1][0]); } assert.ok(f[2] > f[1]); }));
// Compra de 500 mil (venal 300 mil): base = maior valor; escritura 5.358,31 + registro 3.284,18 + ISS 2% sobre 3.231,80 + 1.992,82
const c = I.custas({valorTitulo: 500000, valorVenal: 300000, escritura: true, issPct: .02});
near(c.total, 5358.31 + 3284.18 + .02 * (3231.80 + 1992.82));
// Venal maior que o título define a faixa
assert.strictEqual(I.custas({valorTitulo: 300000, valorVenal: 400000, escritura: false, issPct: 0}).total, 3284.18);
// Integralização: sem escritura, um registro por imóvel, mais alienação fiduciária e certidões
const ci = I.custas({escritura: false, issPct: 0, certidoes: 200, imoveis: [{valorTitulo: 300000, valorVenal: 250000}, {valorTitulo: 100000}]});
near(ci.total, 2723.02 + 1489.46 + 200);
near(I.custas({valorTitulo: 500000, escritura: false, issPct: 0, garantia: 300000}).total, 3284.18 + 2723.02);
// Preponderância (CTN, art. 37)
const anos = (pcts) => pcts.map((p, i) => ({rotulo: 'A' + i, receitaTotal: 100, receitaImob: p}));
let p = I.preponderancia({operacao: 'reorganizacao', anos: anos([40, 60, 50, 45])});
assert.strictEqual(p.pct, .4875); assert.strictEqual(p.preponderante, false); assert.strictEqual(p.imune, true); assert.ok(p.avisos.length === 1);
p = I.preponderancia({operacao: 'reorganizacao', anos: anos([60, 60, 50, 45])});
assert.strictEqual(p.preponderante, true); assert.strictEqual(p.imune, false);
// Exatamente 50% não é preponderante
assert.strictEqual(I.preponderancia({operacao: 'reorganizacao', anos: anos([50, 50, 50])}).preponderante, false);
// Totalidade do patrimônio (art. 37, parágrafo 4º)
assert.strictEqual(I.preponderancia({operacao: 'reorganizacao', totalidade: true, anos: anos([90, 90, 90, 90])}).imune, true);
// Integralização: imune mesmo preponderante (Tema 1.348)
p = I.preponderancia({operacao: 'integralizacao', nova: true, anos: anos([100, 100, 100])});
assert.strictEqual(p.imune, true); assert.ok(p.preponderante); assert.ok(/parágrafo 2º/.test(p.periodo));
// Período incompleto
assert.strictEqual(I.preponderancia({operacao: 'reorganizacao', anos: [{receitaTotal: 100, receitaImob: 10}, {receitaTotal: 0, receitaImob: 0}]}).completo, false);
// Reorganização: devido só se preponderante
const imv = [{descricao: 'Galpão', valorTransferido: 1000000, valorMercado: 1500000}];
assert.strictEqual(I.reorganizacao({municipio: 'guarulhos', anos: anos([10, 10, 10, 10]), imoveis: imv}).devido, 0);
assert.strictEqual(I.reorganizacao({municipio: 'guarulhos', anos: anos([80, 80, 80, 80]), imoveis: imv}).devido, 30000);
console.log('ITBI OK');
