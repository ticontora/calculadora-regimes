/*
 * Motor de cálculo para o dashboard comercial.
 * Recebe as mesmas entradas de regimes.calcular() e produz KPIs
 * estruturados para cada pacote. Sem DOM.
 *
 * Pacote 1 (Impacto CBS/IBS): compara carga atual vs 2027 vs 2033,
 * crédito CBS/IBS do cliente, e impacto no preço.
 *
 * Pacote 2 (Regime Comparativo): dados para barras empilhadas,
 * selo "melhor regime", break-even.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica(require('./parametros.js'), require('./regimes.js'));
  } else {
    raiz.Motor = raiz.Motor || {};
    raiz.Motor.dashboard = fabrica(raiz.Motor.parametros, raiz.Motor.regimes);
  }
})(typeof self !== 'undefined' ? self : this, function (P, R) {
  'use strict';

  /* ---------- Pacote 1: Impacto CBS/IBS ---------- */

  function impactoCbsIbs(entradas) {
    // Calcula para o ano atual (2026), 2027 e 2033
    const e = Object.assign({}, entradas);
    const anoOriginal = e.ano || 2026;

    const res2026 = R.calcular(Object.assign({}, e, { ano: 2026 }));
    const res2027 = R.calcular(Object.assign({}, e, { ano: 2027 }));
    const res2033 = R.calcular(Object.assign({}, e, { ano: 2033 }));

    // Melhor regime em cada ano
    function melhor(res) {
      if (!res.ranking || !res.ranking.length) return null;
      return res.regimes[res.ranking[0]];
    }

    const m2026 = melhor(res2026);
    const m2027 = melhor(res2027);
    const m2033 = melhor(res2033);

    if (!m2026) return null;

    const receita = (e.receita || 0) * (e.meses || 1);

    // KPI 1: Carga tributária atual (2026)
    const cargaAtual = {
      id: 'carga-atual',
      label: 'Carga tributária atual',
      sublabel: '2026 · ' + m2026.nome,
      valor: m2026.total,
      efetiva: m2026.efetiva,
      regime: m2026.nome,
      tipo: 'moeda'
    };

    // KPI 2: Carga em 2027 (primeiro ano real da reforma)
    const carga2027 = m2027 ? {
      id: 'carga-2027',
      label: 'Carga em 2027',
      sublabel: 'Primeiro ano sem PIS/COFINS · ' + m2027.nome,
      valor: m2027.total,
      efetiva: m2027.efetiva,
      regime: m2027.nome,
      variacao: m2026.total > 0 ? (m2027.total - m2026.total) / m2026.total : 0,
      tipo: 'moeda'
    } : null;

    // KPI 3: Carga em 2033 (sistema novo completo)
    const carga2033 = m2033 ? {
      id: 'carga-2033',
      label: 'Carga em 2033',
      sublabel: 'Sistema novo completo · ' + m2033.nome,
      valor: m2033.total,
      efetiva: m2033.efetiva,
      regime: m2033.nome,
      variacao: m2026.total > 0 ? (m2033.total - m2026.total) / m2026.total : 0,
      tipo: 'moeda'
    } : null;

    // KPI 4: Crédito CBS/IBS do cliente (2027)
    // Quanto o comprador desse contribuinte recupera de CBS/IBS
    const creditoCliente = m2027 ? {
      id: 'credito-cliente',
      label: 'Crédito do cliente',
      sublabel: 'CBS/IBS que o comprador recupera em 2027',
      valor: m2027.creditoComprador || 0,
      percentual: receita > 0 ? (m2027.creditoComprador || 0) / receita : 0,
      regime: m2027.nome,
      tipo: 'moeda'
    } : null;

    // KPI 5: Impacto no preço ao cliente
    // Se o fornecedor recolhe CBS/IBS por fora, o preço ao consumidor muda?
    // Compara custo líquido para comprador PJ no Real entre 2026 e 2027
    const comp2026 = res2026.comprador;
    const comp2027 = res2027.comprador;
    let impactoPreco = null;
    if (comp2027.linhas.length && comp2026.linhas.length) {
      // Custo líquido do melhor regime em cada ano
      const linha2026 = comp2026.linhas.find(l => l.chave === res2026.ranking[0]);
      const linha2027 = comp2027.linhas.find(l => l.chave === res2027.ranking[0]);
      if (linha2026 && linha2027) {
        const custoAntigo = linha2026.liquido || receita;
        const custoNovo = linha2027.liquido || receita;
        impactoPreco = {
          id: 'impacto-preco',
          label: 'Custo para o cliente',
          sublabel: 'Preço líquido (após créditos) em 2027 vs 2026',
          antes: custoAntigo,
          depois: custoNovo,
          variacao: custoAntigo > 0 ? (custoNovo - custoAntigo) / custoAntigo : 0,
          tipo: 'comparativo'
        };
      }
    }

    return {
      pacote: 1,
      kpis: [cargaAtual, carga2027, carga2033, creditoCliente, impactoPreco].filter(Boolean),
      resumo: gerarResumoImpacto(cargaAtual, carga2027, carga2033),
      detalhes: {
        res2026, res2027, res2033,
        melhorRegime2026: m2026.chave,
        melhorRegime2027: m2027 ? m2027.chave : null,
        melhorRegime2033: m2033 ? m2033.chave : null,
        mudouRegime: m2027 && m2026.chave !== m2027.chave
      }
    };
  }

  function gerarResumoImpacto(atual, em2027, em2033) {
    const partes = [];
    if (em2027 && em2027.variacao !== undefined) {
      const dir = em2027.variacao > 0.005 ? 'sobe' : em2027.variacao < -0.005 ? 'cai' : 'fica estável';
      partes.push('Em 2027 a carga ' + dir +
        (Math.abs(em2027.variacao) >= 0.005 ? ' ' + Math.abs(Math.round(em2027.variacao * 100)) + '%' : '') +
        ' com o fim do PIS/COFINS.');
    }
    if (em2033 && em2033.variacao !== undefined) {
      const dir = em2033.variacao > 0.005 ? 'sobe' : em2033.variacao < -0.005 ? 'cai' : 'fica estável';
      partes.push('Em 2033 (sistema completo) ' + dir +
        (Math.abs(em2033.variacao) >= 0.005 ? ' ' + Math.abs(Math.round(em2033.variacao * 100)) + '%' : '') +
        ' em relação a 2026.');
    }
    return partes.join(' ');
  }

  /* ---------- Pacote 2: Regime Comparativo ---------- */

  function regimeComparativo(entradas) {
    const e = Object.assign({}, entradas);
    const res = R.calcular(e);
    const elegiveis = res.ranking.map(k => res.regimes[k]).filter(r => r.elegivel);

    if (!elegiveis.length) return null;

    // Dados para barras empilhadas: cada regime com renda/consumo/folha
    const barras = elegiveis.map(r => {
      const cat = R.porCategoria(r);
      return {
        regime: r.nome,
        chave: r.chave,
        renda: cat.renda,
        consumo: cat.consumo,
        folha: cat.folha,
        total: r.total,
        efetiva: r.efetiva,
        melhor: r.chave === res.ranking[0]
      };
    });

    // Selo "melhor regime"
    const melhor = elegiveis[0];
    const segundo = elegiveis[1];
    const selo = {
      regime: melhor.nome,
      chave: melhor.chave,
      economia: segundo ? melhor.sobra - segundo.sobra : 0,
      economiaPercentual: segundo && segundo.total > 0 ? (segundo.total - melhor.total) / segundo.total : 0,
      vs: segundo ? segundo.nome : null
    };

    // Tabela detalhada: tributo a tributo por regime
    const tributos = {};
    elegiveis.forEach(r => {
      (r.tributos || []).forEach(t => {
        if (!tributos[t.codigo]) tributos[t.codigo] = { codigo: t.codigo, categoria: t.categoria };
        tributos[t.codigo][r.chave] = t.valor;
      });
    });

    return {
      pacote: 2,
      barras,
      selo,
      tabelaDetalhada: Object.values(tributos),
      resultado: res
    };
  }

  /* ---------- Todos os anos (para Pacote 3 e sliders) ---------- */

  function todosAnos(entradas) {
    return R.calcularTodosAnos(entradas);
  }

  return {
    impactoCbsIbs,
    regimeComparativo,
    todosAnos
  };
});
