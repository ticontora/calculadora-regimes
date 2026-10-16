/*
 * IR sobre ganho de capital na venda de imóvel por pessoa física.
 * Ordem: ganho bruto → redução do art. 18 (uma única vez) → FR1 → FR2 → alíquotas por faixa.
 * A redução do art. 18 diminui o GANHO; não se aplica de novo sobre o imposto.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./parametros.js'));
  else { raiz.Motor = raiz.Motor || {}; raiz.Motor.ganhoCapital = fabrica(raiz.Motor.parametros); }
})(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';

  const centavos = v => Math.round(v * 100) / 100;
  const indiceMes = d => d.ano * 12 + (d.mes - 1);

  function percentualArt18(anoAquisicao) {
    const r = P.REDUCAO_ART18;
    if (anoAquisicao <= r.anoIntegral) return 1;
    if (anoAquisicao > r.ultimoAno) return 0;
    return (r.ultimoAno - anoAquisicao + 1) * r.passo;
  }

  // m1: de jan/1996 (ou da aquisição) até nov/2005, contando o mês de início (fração)
  function mesesFr1(aquisicao) {
    const F = P.FATORES_REDUCAO;
    const inicio = Math.max(indiceMes(aquisicao), indiceMes(F.inicioFr1));
    const fim = indiceMes(F.fimFr1);
    return inicio > fim ? 0 : fim - inicio + 1;
  }

  // m2: de dez/2005 (ou da aquisição) até o mês da venda
  function mesesFr2(aquisicao, venda) {
    const inicio = Math.max(indiceMes(aquisicao), indiceMes(P.FATORES_REDUCAO.inicioFr2));
    return Math.max(0, indiceMes(venda) - inicio);
  }

  function impostoPorFaixa(ganho) {
    let restante = ganho, piso = 0, imposto = 0;
    for (const [teto, aliq] of P.ALIQUOTAS_GANHO_CAPITAL) {
      const fatia = Math.min(restante, teto - piso);
      if (fatia <= 0) break;
      imposto += fatia * aliq;
      restante -= fatia;
      piso = teto;
    }
    return imposto;
  }

  /*
   * e: {valorVenda, custoAquisicao, aquisicao: {ano, mes}, venda: {ano, mes}}
   */
  function calcular(e) {
    const ganhoBruto = Math.max(0, e.valorVenda - e.custoAquisicao);
    const pct18 = percentualArt18(e.aquisicao.ano);
    const ganhoAposArt18 = ganhoBruto * (1 - pct18);
    const m1 = mesesFr1(e.aquisicao);
    const m2 = mesesFr2(e.aquisicao, e.venda);
    const fr1 = 1 / Math.pow(P.FATORES_REDUCAO.fr1, m1);
    const fr2 = 1 / Math.pow(P.FATORES_REDUCAO.fr2, m2);
    const ganhoTributavel = ganhoAposArt18 * fr1 * fr2;
    const imposto = centavos(impostoPorFaixa(ganhoTributavel));
    const memoria = [
      {etapa: 'Ganho bruto', formula: 'venda − custo', valor: ganhoBruto, fundamento: 'Lei 7.713/1988, art. 3º, § 2º'},
      {etapa: 'Redução por ano de aquisição', formula: 'ganho × (1 − ' + (pct18 * 100).toFixed(0) + '%)', valor: ganhoAposArt18, fundamento: 'Lei 7.713/1988, art. 18'},
      {etapa: 'Fator FR1', formula: '1 ÷ 1,0060^' + m1, valor: fr1, fundamento: 'Lei 11.196/2005, art. 40, § 1º'},
      {etapa: 'Fator FR2', formula: '1 ÷ 1,0035^' + m2, valor: fr2, fundamento: 'Lei 11.196/2005, art. 40, § 1º'},
      {etapa: 'Ganho tributável', formula: 'ganho reduzido × FR1 × FR2', valor: ganhoTributavel, fundamento: 'IN SRF 599/2005, art. 2º'},
      {etapa: 'Imposto', formula: 'alíquotas de 15% a 22,5% por faixa de ganho', valor: imposto, fundamento: 'Lei 8.981/1995, art. 21'}
    ];
    return {ganhoBruto, percentualArt18: pct18, ganhoAposArt18, m1, m2, fr1, fr2, ganhoTributavel, imposto, memoria};
  }

  return {calcular, percentualArt18, mesesFr1, mesesFr2, impostoPorFaixa};
});
