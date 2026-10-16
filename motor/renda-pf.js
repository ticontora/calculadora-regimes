/*
 * Renda da pessoa física: IRPF 2026 com a redução da Lei 15.270/2025, INSS do pró-labore,
 * retenção de 10% sobre dividendos (art. 6º-A) e tributação mínima (IRPFM, arts. 16-A e 16-B).
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./parametros.js'));
  else { raiz.Motor = raiz.Motor || {}; raiz.Motor.rendaPF = fabrica(raiz.Motor.parametros); }
})(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';

  const centavos = v => Math.round(v * 100) / 100;

  function tabelaProgressiva(base, tabela) {
    if (base <= 0) return 0;
    const f = tabela.find(l => base <= l[0]);
    return Math.max(0, base * f[1] - f[2]);
  }

  // Redução da Lei 15.270: pelo rendimento tributável (não pela base), limitada ao imposto
  function reducao(rendimento, imposto, regra) {
    let r = 0;
    if (rendimento <= regra.isentoAte) r = imposto;
    else if (rendimento < regra.zeraEm) r = regra.constante - regra.fator * rendimento;
    return Math.max(0, Math.min(imposto, r));
  }

  // IRPF mensal. deducoesLegais: INSS, dependentes etc. Usa o desconto simplificado se for maior
  // (Lei 9.250/1995, art. 4º, § 2º), salvo quando usarSimplificado = false.
  function irpfMensal(rendimento, deducoesLegais, usarSimplificado) {
    const deducao = usarSimplificado === false ? (deducoesLegais || 0) : Math.max(deducoesLegais || 0, P.DESCONTO_SIMPLIFICADO_MENSAL);
    const base = Math.max(0, rendimento - deducao);
    const tabela = tabelaProgressiva(base, P.IRPF_MENSAL);
    const red = reducao(rendimento, tabela, P.REDUCAO_MENSAL);
    return {rendimento, deducao, base, impostoTabela: centavos(tabela), reducao: centavos(red), imposto: centavos(tabela - red)};
  }

  // IRPF anual (ajuste). PREMISSA: só deduções legais informadas; não simula o desconto simplificado anual.
  function irpfAnual(rendimento, deducoes) {
    const base = Math.max(0, rendimento - (deducoes || 0));
    const tabela = tabelaProgressiva(base, P.IRPF_ANUAL);
    const red = reducao(rendimento, tabela, P.REDUCAO_ANUAL);
    return {rendimento, base, impostoTabela: centavos(tabela), reducao: centavos(red), imposto: centavos(tabela - red)};
  }

  function inssProLabore(proLabore) {
    return centavos(Math.min(proLabore, P.INSS_PRO_LABORE.teto) * P.INSS_PRO_LABORE.aliquota);
  }

  // Art. 6º-A: acima de R$ 50 mil no mês (mesma PJ, mesma PF), retém 10% sobre o total do mês
  function retencaoDividendos(valorMes) {
    return valorMes > P.RETENCAO_DIVIDENDOS.limiteMensal ? centavos(valorMes * P.RETENCAO_DIVIDENDOS.aliquota) : 0;
  }

  // Art. 16-A, § 2º: alíquota do IRPFM
  function aliquotaIrpfm(rendimentoAnual) {
    const I = P.IRPFM;
    if (rendimentoAnual <= I.limiteInferior) return 0;
    if (rendimentoAnual >= I.limiteSuperior) return I.aliquotaMaxima;
    return (rendimentoAnual / I.divisor - 10) / 100;
  }

  // Valor devido do IRPFM antes do redutor (art. 16-A, §§ 3º e 4º)
  function irpfmDevido(rendimentoAnual, deducoes) {
    return Math.max(0, aliquotaIrpfm(rendimentoAnual) * rendimentoAnual - (deducoes || 0));
  }

  /*
   * Custo de levar o lucro ao sócio, por ano e por sócio.
   * e: {dividendosMes (por sócio), proLabore (mensal), outrasRendasAnuais, irOutrasRendas,
   *     irpjCsllAnualPJ, lucroContabilAnualPJ, quantidadeSocios, limiteCarga}
   */
  function custoDistribuicao(e) {
    const divMes = Math.max(0, e.dividendosMes || 0);
    const mesesPagamento = e.mesesPagamento || 12;   // venda de imóvel: um único pagamento
    const divAno = divMes * mesesPagamento;
    const proLabore = Math.max(0, e.proLabore || 0);
    const inssMes = inssProLabore(proLabore);
    const irProLaboreMes = irpfMensal(proLabore, inssMes).imposto;
    const irAjusteProLabore = irpfAnual(proLabore * 12, inssMes * 12).imposto;
    const retidoMes = retencaoDividendos(divMes);
    const outras = Math.max(0, e.outrasRendasAnuais || 0);
    const rendSem = proLabore * 12 + outras;
    const rendCom = rendSem + divAno;
    const deducoes = irAjusteProLabore + Math.max(0, e.irOutrasRendas || 0);
    const devidoSem = irpfmDevido(rendSem, deducoes);
    const devidoCom = irpfmDevido(rendCom, deducoes);
    const acrescimo = Math.max(0, devidoCom - devidoSem);
    // Art. 16-B: redutor quando carga efetiva PJ + carga do IRPFM sobre os dividendos passa do limite
    const ePJ = e.lucroContabilAnualPJ > 0 ? Math.max(0, e.irpjCsllAnualPJ) / e.lucroContabilAnualPJ : 0;
    const ePF = divAno > 0 ? acrescimo / divAno : 0;
    const limite = e.limiteCarga || P.LIMITE_CARGA_PJ_PF.geral;
    const redutor = (divAno > 0 && ePJ + ePF > limite) ? Math.min(acrescimo, divAno * (ePJ + ePF - limite)) : 0;
    const irpfmFinal = Math.max(0, devidoCom - redutor);
    // O IRPFM relativo aos dividendos é o que a distribuição acrescenta; o retido é antecipação (art. 16-A, § 5º)
    const custoDividendos = Math.max(0, irpfmFinal - devidoSem);
    const retidoAno = retidoMes * mesesPagamento;
    return {
      dividendosMes: divMes, dividendosAno: divAno,
      proLabore, inssMes, irProLaboreMes,
      retidoMes, retidoAno,
      rendimentoAnual: rendCom, aliquotaIrpfm: aliquotaIrpfm(rendCom),
      deducoes: centavos(deducoes), devidoAntesRedutor: centavos(devidoCom),
      ePJ, ePF, redutor: centavos(redutor), irpfmFinal: centavos(irpfmFinal),
      custoDividendosAno: centavos(custoDividendos),
      ajusteAno: centavos(custoDividendos - retidoAno),
      liquidoDividendosAno: centavos(divAno - custoDividendos)
    };
  }

  return {irpfMensal, irpfAnual, inssProLabore, retencaoDividendos, aliquotaIrpfm, irpfmDevido, custoDistribuicao, tabelaProgressiva};
});
