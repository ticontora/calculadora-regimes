/*
 * Simples Nacional: faixa, alíquota efetiva e partilha do DAS por ano (2026–2033).
 * Funções puras; os números vêm de parametros.js.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./parametros.js'));
  else { raiz.Motor = raiz.Motor || {}; raiz.Motor.simples = fabrica(raiz.Motor.parametros); }
})(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';

  const ROTULO = {irpj: 'IRPJ', csll: 'CSLL', cofins: 'COFINS', pis: 'PIS', cpp: 'CPP', ipi: 'IPI', icms: 'ICMS', iss: 'ISS', cbs: 'CBS', ibs: 'IBS'};
  const FEDERAIS = ['irpj', 'csll', 'cofins', 'pis', 'cpp', 'ipi', 'cbs'];

  function indiceFaixa(rbt12, tabela) {
    const faixas = P.SIMPLES_FAIXAS[tabela];
    const i = faixas.findIndex(f => rbt12 <= f[0]);
    return i === -1 ? faixas.length - 1 : i;
  }

  // Alíquota nominal e parcela a deduzir da faixa no ano
  function faixaDoAno(tabela, indice, ano) {
    const [teto, nominal, deducao] = P.SIMPLES_FAIXAS[tabela][indice];
    const ajuste = (indice === 5 && (ano === 2027 || ano === 2028)) ? P.AJUSTE_NOMINAL_6A_2027_2028 : 0;
    return {teto, nominal: nominal + ajuste, deducao};
  }

  // Alíquota efetiva = (RBT12 × nominal − parcela a deduzir) ÷ RBT12 (LC 123, art. 18, § 1º-A)
  function aliquotaEfetiva(rbt12, tabela, ano) {
    if (rbt12 > P.LIMITE_SIMPLES) return null;
    const indice = indiceFaixa(rbt12, tabela);
    const f = faixaDoAno(tabela, indice, ano);
    const efetiva = rbt12 > 0 ? (rbt12 * f.nominal - f.deducao) / rbt12 : f.nominal;
    return {indice, faixa: indice + 1, nominal: f.nominal, deducao: f.deducao, teto: f.teto, efetiva};
  }

  // Partilha do DAS (em %, soma 100) para o anexo, a faixa e o ano
  function partilha(tabela, indice, ano) {
    const base = Object.assign({}, P.PARTILHA_2026[tabela][indice]);
    if (ano <= 2026) return base;
    const pisCofins = (base.pis || 0) + (base.cofins || 0);
    delete base.pis; delete base.cofins;
    if (ano <= 2028) {
      if (indice === 5) {
        const cbs = P.CBS_6A_FAIXA_2027_2028[tabela];
        const resto = Object.keys(base);
        const soma = resto.reduce((s, k) => s + base[k], 0);
        resto.forEach(k => { base[k] = base[k] * (100 - cbs) / soma; });
        base.cbs = cbs;
        return base;
      }
      const ibs = P.IBS_NO_DAS_2027_2028[tabela][indice];
      base.cbs = pisCofins - ibs;
      base.ibs = ibs;
      return base;
    }
    // 2029 em diante: CBS fica com a fatia de PIS + COFINS; IBS absorve parte da fatia do ICMS/ISS
    base.cbs = pisCofins;
    const t = P.TRANSICAO_ICMS_ISS[ano];
    ['icms', 'iss'].forEach(k => {
      if (base[k] === undefined) return;
      base.ibs = (base.ibs || 0) + base[k] * t;
      base[k] = base[k] * (1 - t);
      if (base[k] < 1e-9) delete base[k];
    });
    return base;
  }

  // Reparte o valor do DAS entre os tributos, com o teto de 5% do ISS (excesso vai aos federais)
  function repartirDas(valorDas, receita, fatias) {
    const valores = {};
    Object.keys(fatias).forEach(k => { valores[k] = valorDas * fatias[k] / 100; });
    if (valores.iss !== undefined && receita > 0 && valores.iss > P.TETO_ISS_DAS * receita) {
      const excesso = valores.iss - P.TETO_ISS_DAS * receita;
      valores.iss = P.TETO_ISS_DAS * receita;
      const fed = FEDERAIS.filter(k => valores[k] !== undefined);
      const somaFed = fed.reduce((s, k) => s + valores[k], 0);
      fed.forEach(k => { valores[k] += excesso * valores[k] / somaFed; });
    }
    return Object.keys(valores).map(k => ({chave: k, codigo: ROTULO[k], valor: valores[k], fatia: fatias[k]}));
  }

  return {indiceFaixa, faixaDoAno, aliquotaEfetiva, partilha, repartirDas, ROTULO};
});
