const C = require('../co/icms.js'), assert = require('assert');
const near = (a, b, t = 0.01) => assert.ok(Math.abs(a - b) < t, a + ' ≠ ' + b);
assert.strictEqual(Object.keys(C.UF).length, 27);
// Interestaduais
assert.strictEqual(C.interestadual('SP', 'BA'), .07); assert.strictEqual(C.interestadual('SP', 'ES'), .07);
assert.strictEqual(C.interestadual('SP', 'RJ'), .12); assert.strictEqual(C.interestadual('BA', 'SP'), .12);
assert.strictEqual(C.interestadual('ES', 'BA'), .12); assert.strictEqual(C.interestadual('SP', 'MG', true), .04);
assert.strictEqual(C.interestadual('SP', 'SP'), null);
// Interna SP 18% sobre 1.000
const i = C.calcular({origem: 'SP', destino: 'SP', destinatario: 'revenda', produtos: 1000});
near(i.icms, 180); near(i.total, 180);
// Interna RJ com FCP 2%
near(C.calcular({origem: 'RJ', destino: 'RJ', destinatario: 'revenda', produtos: 1000}).total, 220);
// Gross-up: 1.000 sem ICMS em SP → base 1.219,51
near(C.calcular({origem: 'SP', destino: 'SP', destinatario: 'revenda', produtos: 1000, valorComICMS: false}).base, 1000 / .82);
// Redução de base de 33,33%
near(C.calcular({origem: 'SP', destino: 'SP', destinatario: 'revenda', produtos: 1000, reducaoBC: 1 / 3}).icms, 120);
// DIFAL não contribuinte SP → BA (7% / 20,5%), base dupla
const d = C.calcular({origem: 'SP', destino: 'BA', destinatario: 'naocontrib', produtos: 1000});
near(d.icms, 70); near(d.baseDifal, 930 / .795); near(d.difal, 930 / .795 * .205 - 70);
// Base única para contribuinte
near(C.calcular({origem: 'SP', destino: 'BA', destinatario: 'consumo', produtos: 1000, baseDifal: 'unica'}).difal, 135);
// IPI na base para consumidor final, fora para revenda
near(C.calcular({origem: 'SP', destino: 'SP', destinatario: 'consumo', produtos: 1000, ipi: 100}).base, 1100);
near(C.calcular({origem: 'SP', destino: 'SP', destinatario: 'revenda', produtos: 1000, ipi: 100}).base, 1000);
// Revenda interestadual não tem DIFAL
assert.strictEqual(C.calcular({origem: 'SP', destino: 'BA', destinatario: 'revenda', produtos: 1000}).difal, 0);
// ST interna SP: MVA 40%, IPI 100 → base 1.540; ST = 277,20 − 180
const s = C.calcular({origem: 'SP', destino: 'SP', destinatario: 'revenda', produtos: 1000, ipi: 100, st: {ativo: true, mva: .4}});
near(s.baseST, 1540); near(s.st, 1540 * .18 - 180);
// ST interestadual SP → MG (12% / 18%): MVA ajustada = 1,4 × 0,88 / 0,82 − 1
const s2 = C.calcular({origem: 'SP', destino: 'MG', destinatario: 'revenda', produtos: 1000, st: {ativo: true, mva: .4}});
near(s2.mvaAjustada, 1.4 * .88 / .82 - 1, 1e-9); near(s2.st, 1000 * (1 + s2.mvaAjustada) * .18 - 120);
// Reforma
assert.deepStrictEqual([2028, 2029, 2030, 2031, 2032, 2033].map(C.fatorReforma).map(x => Math.round(x * 10) / 10), [1, .9, .8, .7, .6, 0]);
console.log('ICMS OK');
// Previsão: SP interna 10.000, não cumulativo
const pr = C.previsao(C.calcular({origem: 'SP', destino: 'SP', destinatario: 'revenda', produtos: 10000}), {pisCofins: .0925, cbsRef: .113, ibsRef: .187});
near(pr[0].total, 1800 + 8200 * .0925); assert.ok(pr[0].teste);
near(pr[1].cbs, 8200 * .112); near(pr[1].ibs, 8.2); near(pr[3].icms, 1620); near(pr[3].ibs, 8200 * .0187);
near(pr[7].icms, 0); near(pr[7].total, 8200 * .3);
// Redução de 60%
near(C.previsao(C.calcular({origem: 'SP', destino: 'SP', destinatario: 'revenda', produtos: 10000}), {reducao: .6})[7].total, 8200 * .3 * .4);
console.log('ICMS previsão OK');
