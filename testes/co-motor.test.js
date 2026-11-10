const M = require('../co/motor.js');
const assert = require('assert');
const base = {atividade: 'servicos5', receita: 60000, folha: 20000, margem: .40, iss: .05, compras: 0, cbsRef: .113, ibsRef: .187, socios: 2, distribuicao: 1, reducao: 0};
const t = a => { const r = M.calcular(base, a); const o = {}; for (const k in r.regimes) o[k] = r.regimes[k].elegivel ? Math.round(r.regimes[k].total * 12) : 'n/e'; return [r, o]; };
const [r26, o26] = t(2026); console.log(2026, r26.anexo, r26.faixa.numero, o26);
assert.strictEqual(o26.simples, 79560);
assert.strictEqual(o26.presumido, 165576);
assert.ok(Math.abs(o26.real - 183576) < 20);
for (const a of [2027, 2029, 2033]) console.log(a, t(a)[1]);
// comércio com compras
const com = {atividade: 'comercio', receita: 400000, folha: 30000, margem: .12, icms: .18, compras: 220000, cbsRef: .113, ibsRef: .187, socios: 1, distribuicao: 1};
for (const a of [2026, 2027, 2033]) { const r = M.calcular(com, a); const o = {}; for (const k in r.regimes) o[k] = r.regimes[k].elegivel ? Math.round(r.regimes[k].total * 12) : 'n/e'; console.log('comércio', a, 'faixa', r.faixa && r.faixa.numero, o, 'ret', Math.round(r.regimes.real.retencao)); }
// acima do limite
const big = Object.assign({}, com, {receita: 500000});
const rb = M.calcular(big, 2027); assert.strictEqual(rb.regimes.simples.elegivel, false); console.log('limite ok; LC224 aviso:', rb.avisos.filter(x => x.includes('LC 224')).length);
console.log('OK');
