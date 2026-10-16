// Testes de cada faixa do Simples (Anexos I a V) e da partilha 2026–2033
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../motor/parametros.js');
const S = require('../motor/simples.js');

const perto = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const ANEXOS = ['comercio', 'industria', 'servicos', 'servicos4', 'servicos5'];

// Valor esperado escrito à mão a partir das tabelas da LC 123 (RBT12 no meio de cada faixa)
const ESPERADO_2026 = {
  comercio:  [[120000, 0.04], [300000, (300000 * 0.073 - 5940) / 300000], [600000, (600000 * 0.095 - 13860) / 600000], [1200000, (1200000 * 0.107 - 22500) / 1200000], [2400000, (2400000 * 0.143 - 87300) / 2400000], [4200000, (4200000 * 0.19 - 378000) / 4200000]],
  industria: [[120000, 0.045], [300000, (300000 * 0.078 - 5940) / 300000], [600000, (600000 * 0.10 - 13860) / 600000], [1200000, (1200000 * 0.112 - 22500) / 1200000], [2400000, (2400000 * 0.147 - 85500) / 2400000], [4200000, (4200000 * 0.30 - 720000) / 4200000]],
  servicos:  [[120000, 0.06], [300000, (300000 * 0.112 - 9360) / 300000], [600000, (600000 * 0.135 - 17640) / 600000], [1200000, (1200000 * 0.16 - 35640) / 1200000], [2400000, (2400000 * 0.21 - 125640) / 2400000], [4200000, (4200000 * 0.33 - 648000) / 4200000]],
  servicos4: [[120000, 0.045], [300000, (300000 * 0.09 - 8100) / 300000], [600000, (600000 * 0.102 - 12420) / 600000], [1200000, (1200000 * 0.14 - 39780) / 1200000], [2400000, (2400000 * 0.22 - 183780) / 2400000], [4200000, (4200000 * 0.33 - 828000) / 4200000]],
  servicos5: [[120000, 0.155], [300000, (300000 * 0.18 - 4500) / 300000], [600000, (600000 * 0.195 - 9900) / 600000], [1200000, (1200000 * 0.205 - 17100) / 1200000], [2400000, (2400000 * 0.23 - 62100) / 2400000], [4200000, (4200000 * 0.305 - 540000) / 4200000]]
};

for (const anexo of ANEXOS) {
  ESPERADO_2026[anexo].forEach(([rbt12, esperado], i) => {
    test(`${anexo}, ${i + 1}ª faixa (RBT12 ${rbt12}): alíquota efetiva de 2026`, () => {
      const r = S.aliquotaEfetiva(rbt12, anexo, 2026);
      assert.equal(r.faixa, i + 1);
      assert.ok(perto(r.efetiva, esperado), `${r.efetiva} ≠ ${esperado}`);
    });
  });

  test(`${anexo}: limites das faixas (180 mil fica na 1ª; 180.000,01 vai para a 2ª)`, () => {
    assert.equal(S.aliquotaEfetiva(180000, anexo, 2026).faixa, 1);
    assert.equal(S.aliquotaEfetiva(180000.01, anexo, 2026).faixa, 2);
    assert.equal(S.aliquotaEfetiva(4800000, anexo, 2026).faixa, 6);
    assert.equal(S.aliquotaEfetiva(4800000.01, anexo, 2026), null);
  });

  for (const ano of P.ANOS) {
    test(`${anexo}, ${ano}: partilha de cada faixa soma 100%`, () => {
      for (let i = 0; i < 6; i++) {
        const f = S.partilha(anexo, i, ano);
        const soma = Object.values(f).reduce((s, v) => s + v, 0);
        assert.ok(perto(soma, 100, 1e-6), `faixa ${i + 1}: ${soma}`);
      }
    });
  }

  test(`${anexo}: a partilha 2026 reparte o DAS sem sobra (soma dos tributos = DAS)`, () => {
    for (let i = 0; i < 6; i++) {
      const partes = S.repartirDas(1000, 10000, S.partilha(anexo, i, 2026));
      const soma = partes.reduce((s, p) => s + p.valor, 0);
      assert.ok(perto(soma, 1000, 1e-6));
    }
  });
}

test('6ª faixa: nominal 0,1 p.p. menor em 2027–2028 e de volta em 2029', () => {
  assert.ok(perto(S.faixaDoAno('comercio', 5, 2026).nominal, 0.19));
  assert.ok(perto(S.faixaDoAno('comercio', 5, 2027).nominal, 0.189));
  assert.ok(perto(S.faixaDoAno('comercio', 5, 2028).nominal, 0.189));
  assert.ok(perto(S.faixaDoAno('comercio', 5, 2029).nominal, 0.19));
  assert.ok(perto(S.faixaDoAno('industria', 5, 2027).nominal, 0.299));
});

test('teto de 5% do ISS no DAS: excesso vai aos tributos federais e o DAS não muda', () => {
  // Anexo IV, 5ª faixa, RBT12 de R$ 3,6 mi: efetiva ≈ 16,9%; ISS = 40% → 6,76% da receita > 5%
  const r = S.aliquotaEfetiva(3600000, 'servicos4', 2026);
  const receita = 300000;
  const das = receita * r.efetiva;
  const partes = S.repartirDas(das, receita, S.partilha('servicos4', 4, 2026));
  const iss = partes.find(p => p.codigo === 'ISS');
  assert.ok(perto(iss.valor, 0.05 * receita, 1e-6));
  assert.ok(perto(partes.reduce((s, p) => s + p.valor, 0), das, 1e-6));
});
