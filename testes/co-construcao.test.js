const K = require('../co/construcao.js'); const assert = require('assert');
const inc = {receita: 10000000, terreno: 1500000, obra: 5000000, obraAte2026: .3, obraCredito: .7, despesas: 800000, unidades: 20, social: false, cbsRef: .113, ibsRef: .187};
const r26 = K.incorporacao(inc, 2026), r27 = K.incorporacao(inc, 2027);
const tot = r => Object.fromEntries(Object.entries(r.regimes).map(([k, g]) => [k, g.elegivel ? Math.round(g.total) : 'n/e']));
console.log('incorp 2026', tot(r26)); console.log('incorp 2027', tot(r27)); console.log('incorp 2033', tot(K.incorporacao(inc, 2033)));
assert.strictEqual(Math.round(r26.regimes.ret.total), 400000);       // 4%
assert.strictEqual(Math.round(r27.regimes.ret.total), 400000);       // 1,92% + 2,08%
assert.strictEqual(Math.round(K.incorporacao(Object.assign({}, inc, {social: true}), 2027).regimes.ret.total), 100000); // 0,31+0,16+0,53
const c = {receita: 6000000, folha: 1800000, margem: .15, material: .35, comMaterial: true, iss: .03, dedMaterialIss: true, cprb: true, ratTerceiros: .088, cbsRef: .113, ibsRef: .187};
for (const a of [2026, 2027, 2028]) { const r = K.construtora(c, a); console.log('construtora', a, tot(r)); }
// CPRB 2026: 6M × 4,5% × 60% + 1,8M × (10% + 8,8%)
const prev26 = K.construtora(c, 2026).regimes.presumido.itens.find(i => /CPRB/.test(i.nome)).valor;
assert.strictEqual(Math.round(prev26), Math.round(6000000 * .045 * .6 + 1800000 * (.10 + .088)));
console.log('CONSTRUCAO OK');
// aferição: 1.000 m² × 80% × 2.400 × 20% = 384.000; créditos 200.000; diferença 184.000 × 36,8%
const af = K.incorporacao(Object.assign({}, inc, {area: 1000, equivalencia: .8, vau: 2400, tipoObra: 'alvenaria', folhaObra: 150000, maoObraNotas: 50000, aliqAfericao: .368}), 2027).afericao;
assert.strictEqual(Math.round(af.rmt), 384000); assert.strictEqual(Math.round(af.inss), Math.round(184000 * .368));
// IPCA corrige o redutor
const a0 = K.incorporacao(inc, 2027).regimes.presumido.total, a1 = K.incorporacao(Object.assign({}, inc, {ipca: .2}), 2027).regimes.presumido.total;
assert.ok(a1 < a0);
// retenção 3,5% com CPRB em 2026, 11% em 2028
assert.strictEqual(K.construtora(c, 2026).retencoes.pInss, .035); assert.strictEqual(K.construtora(c, 2028).retencoes.pInss, .11);
console.log('AFERICAO/RETENCAO OK');

// --- Loteamento art. 486 e redutor social atualizado (05/11/2026) ---
{
  const C2 = require('../co/construcao.js');
  const base = {receita: 2000000, terreno: 300000, obra: 500000, obraAte2026: 0, obraCredito: 0, despesas: 0, unidades: 0, lotes: 20, cbsRef: 11.3, ibsRef: 18.7};
  const sem = C2.incorporacao(base, 2027);
  if (sem.regimes.lote) throw new Error('art. 486 só com a opção marcada');
  const com = C2.incorporacao(Object.assign({}, base, {loteamento: true}), 2027);
  const l = com.regimes.lote;
  const cbsIbs = l.itens.find(i => i.nome.startsWith('CBS/IBS')).valor;
  if (Math.abs(cbsIbs - 73000) > 0.01) throw new Error('3,65% de 2 mi = 73.000, veio ' + cbsIbs);
  if (C2.incorporacao(Object.assign({}, base, {loteamento: true}), 2026).regimes.lote) throw new Error('art. 486 não se aplica em 2026');
  // redutor social informado (valor do mês) substitui o nominal
  const a = C2.incorporacao(Object.assign({}, base, {lotes: 1, unidades: 1}), 2027);
  const b = C2.incorporacao(Object.assign({}, base, {lotes: 1, unidades: 1, redSocialUnidade: 108211.06, redSocialLote: 32463.32}), 2027);
  if (!(b.regimes.presumido.total < a.regimes.presumido.total)) throw new Error('redutor social atualizado deve reduzir a CBS/IBS');
  console.log('ok loteamento 486 e redutor social atualizado');
}
