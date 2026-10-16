/*
 * Leituras automáticas do resultado (texto próprio, curto). Sem DOM.
 * Cada item: {tipo: 'ok' | 'info' | 'alerta', texto}
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./parametros.js'), require('./simples.js'), require('./regimes.js'));
  else { raiz.Motor = raiz.Motor || {}; raiz.Motor.insights = fabrica(raiz.Motor.parametros, raiz.Motor.simples, raiz.Motor.regimes); }
})(typeof self !== 'undefined' ? self : this, function (P, S, M) {
  'use strict';

  const brl = v => v.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0});
  const pct = v => (v * 100).toLocaleString('pt-BR', {maximumFractionDigits: 1}) + '%';

  function gerar(res, e) {
    const itens = [];
    const R = res.regimes;
    const rk = res.ranking;
    const sufixo = res.meses === 1 ? 'por mês' : res.meses === 12 ? 'por ano' : 'no período';
    if (rk.length > 1) {
      const a = R[rk[0]], b = R[rk[1]];
      itens.push({tipo: 'ok', texto: a.nome + ' deixa ' + brl(a.sobra - b.sobra) + ' ' + sufixo + ' a mais do que ' + b.nome + ' em ' + res.ano + '.'});
    }
    const rbt12 = (e.receita || 0) * 12;
    const cfg = P.ATIVIDADES[e.atividade] || P.ATIVIDADES.comercio;

    // Fator R perto do limite
    if (cfg.tabela === 'servicos5' && e.fatorR && res.fatorR !== null) {
      if (res.fatorR < P.FATOR_R_MINIMO && res.fatorR >= 0.2) {
        const falta = (P.FATOR_R_MINIMO - res.fatorR) * (e.receita || 0);
        itens.push({tipo: 'info', texto: 'Fator R em ' + pct(res.fatorR) + '. Com mais ' + brl(falta) + ' de folha por mês (pró-labore incluído), a empresa passa ao Anexo III.'});
      } else if (res.fatorR >= P.FATOR_R_MINIMO && res.fatorR < 0.31) {
        itens.push({tipo: 'alerta', texto: 'Fator R em ' + pct(res.fatorR) + ', perto do limite de 28%. Uma queda na folha leva ao Anexo V.'});
      }
    }
    // Perto da troca de faixa
    if (res.faixa && res.faixa.indice < 5) {
      const folga = res.faixa.teto - rbt12;
      if (folga === 0) itens.push({tipo: 'info', texto: 'Faturamento de 12 meses exatamente no teto da ' + res.faixa.faixa + 'ª faixa: qualquer aumento muda a faixa do Simples.'});
      else if (folga > 0 && folga < res.faixa.teto * 0.05) itens.push({tipo: 'info', texto: 'Faturamento de 12 meses a ' + brl(folga) + ' da próxima faixa do Simples.'});
    }
    if (rbt12 > P.SUBLIMITE && rbt12 <= P.LIMITE_SIMPLES && cfg.tabela) {
      itens.push({tipo: 'alerta', texto: 'Acima do sublimite de R$ 3,6 milhões: ICMS e ISS saem do DAS e passam a ser pagos pelas regras normais.'});
    }
    if (R.presumido.lc224 > 0) {
      itens.push({tipo: 'info', texto: 'Receita acima de R$ 5 milhões por ano: a LC 224/2025 aumenta a presunção do Lucro Presumido em 10% sobre a parte excedente.'});
    }
    // Reforma
    if (res.ano >= 2027 && R.simplesFora && R.simplesFora.elegivel) {
      const dif = R.simplesFora.total - R.simples.total;
      if (res.comprador && res.comprador.tomaCredito) {
        const ganho = (R.simplesFora.creditoComprador || 0) - (R.simples.creditoComprador || 0);
        itens.push({tipo: 'info', texto: 'Seu cliente toma crédito. Com CBS/IBS fora do DAS, ele aproveita ' + brl(ganho) + ' a mais de crédito, e a empresa paga ' + brl(Math.abs(dif)) + (dif >= 0 ? ' a mais' : ' a menos') + ' de imposto. Compare os dois números antes de negociar preço.'});
      } else {
        itens.push({tipo: 'info', texto: 'Quem compra é consumidor final ou não toma crédito: tirar CBS/IBS do DAS custaria ' + brl(dif) + ' a mais sem benefício para o cliente.'});
      }
    }
    if (res.ano === 2026) itens.push({tipo: 'info', texto: 'Em 2026 a CBS (0,9%) e o IBS (0,1%) são de teste e compensados com PIS/COFINS. Arraste o ano para ver 2027 em diante.'});
    // Distribuição
    const melhor = rk.length ? R[rk[0]] : null;
    if (melhor && melhor.distribuicao) {
      const d = melhor.distribuicao;
      if (d.porSocio.retidoMes > 0 && !d.isento) {
        itens.push({tipo: 'alerta', texto: 'Cada sócio recebe ' + brl(d.porSocio.dividendosMes) + ' por mês em dividendos: acima de R$ 50 mil, há retenção de 10% sobre o total do mês, e dividir em vários pagamentos no mesmo mês não evita.'});
      }
      if (d.porSocio.rendimentoAnual > P.IRPFM.limiteInferior && !d.isento) {
        itens.push({tipo: 'info', texto: 'Renda anual do sócio de ' + brl(d.porSocio.rendimentoAnual) + ': entra na tributação mínima (IRPFM) com alíquota de ' + pct(d.porSocio.aliquotaIrpfm) + ' antes do redutor.'});
      }
    }
    if (rk.length && R[rk[0]].sobra < 0) itens.push({tipo: 'alerta', texto: 'Mesmo no melhor regime os tributos passam do lucro informado. Confira a margem.'});
    return itens;
  }

  // Avisos de dado faltante: o que acontece com o resultado sem a informação
  function faltas(e) {
    const cfg = P.ATIVIDADES[e.atividade] || P.ATIVIDADES.comercio;
    const a = [];
    if (cfg.icms && !(e.compras > 0) && !e.semCompras) a.push({campo: 'compras', texto: 'Sem as compras, Lucro Real e CBS/IBS ficam sem crédito: o imposto sai MAIOR.'});
    if (!(e.margem > 0)) a.push({campo: 'margem', texto: 'Sem a margem, o IRPJ e a CSLL do Lucro Real ficam zerados: o Real sai MENOR do que o devido.'});
    if (cfg.tabela === 'servicos5' && e.fatorR && !(e.folha > 0)) a.push({campo: 'folha', texto: 'Sem a folha, o Fator R fica abaixo de 28% e o Simples vai para o Anexo V: imposto MAIOR.'});
    if (cfg.icms && !(e.icms > 0)) a.push({campo: 'icms', texto: 'Sem o ICMS, Presumido e Real ficam sem o imposto estadual: saem MENORES do que o devido.'});
    if (cfg.iss && !(e.iss > 0)) a.push({campo: 'iss', texto: 'Sem o ISS, Presumido e Real ficam sem o imposto municipal: saem MENORES do que o devido.'});
    return a;
  }

  return {gerar, faltas};
});
