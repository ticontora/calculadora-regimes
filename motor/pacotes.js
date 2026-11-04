/*
 * Sistema de pacotes da Calculadora Comercial.
 * Define os 6 pacotes cumulativos, controle de acesso por feature flag,
 * e a lógica de teaser (o que mostrar quando o pacote está bloqueado).
 *
 * Pacotes são cumulativos: quem tem o 3 tem 1+2+3.
 * Controle por localStorage ou por token JWT (futuro).
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else { raiz.Motor = raiz.Motor || {}; raiz.Motor.pacotes = fabrica(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Definição dos pacotes ---------- */
  const PACOTES = [
    {
      id: 1,
      slug: 'impacto',
      nome: 'Impacto CBS/IBS',
      subtitulo: 'Quanto a reforma muda para este cliente',
      gratis: true,
      componentes: ['kpi-carga-atual', 'kpi-carga-2027', 'kpi-carga-2033', 'kpi-credito', 'kpi-preco']
    },
    {
      id: 2,
      slug: 'regime',
      nome: 'Regime Comparativo',
      subtitulo: 'Qual regime paga menos, tributo a tributo',
      gratis: false,
      componentes: ['barras-empilhadas', 'selo-melhor', 'breakeven-chart', 'tabela-detalhada']
    },
    {
      id: 3,
      slug: 'projecao',
      nome: 'Projeção 2026–2033',
      subtitulo: 'Timeline da transição com cenários de alíquota',
      gratis: false,
      componentes: ['timeline-transicao', 'cenarios-aliquota', 'tornado-sensibilidade']
    },
    {
      id: 4,
      slug: 'valor',
      nome: 'Valor',
      subtitulo: 'Economia anual e acumulada, impacto no resultado',
      gratis: false,
      componentes: ['economia-anual', 'economia-acumulada', 'impacto-resultado', 'impacto-caixa']
    },
    {
      id: 5,
      slug: 'completo',
      nome: 'Completo',
      subtitulo: 'DRE antes/depois, waterfall, precificação',
      gratis: false,
      componentes: ['dre-comparativo', 'waterfall', 'custo-margem', 'precificacao', 'capital-giro']
    },
    {
      id: 6,
      slug: 'escritorio',
      nome: 'Escritório',
      subtitulo: 'Carteira de clientes, white-label, histórico',
      gratis: false,
      componentes: ['portfolio', 'white-label', 'historico-cloud', 'apuracao-manager']
    }
  ];

  /* ---------- Controle de acesso ---------- */
  const STORAGE_KEY = 'calc_plano';

  // Retorna o nível do plano ativo (1 = free, 6 = completo)
  function nivelAtivo() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return 1; // free
      const parsed = JSON.parse(raw);
      // Suporta tanto {nivel: N} quanto {token: 'jwt...'} (futuro)
      if (parsed.nivel) return Math.max(1, Math.min(6, parsed.nivel));
      // TODO: decodificar JWT e extrair nível
      return 1;
    } catch (e) {
      return 1;
    }
  }

  // Para testes e demo: seta o nível diretamente
  function setarNivel(n) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nivel: n, setadoEm: new Date().toISOString() }));
    } catch (e) { /* silencioso */ }
  }

  // Verifica se um pacote está liberado
  function liberado(pacoteId) {
    return pacoteId <= nivelAtivo();
  }

  // Retorna info do pacote com status de acesso
  function status(pacoteId) {
    const p = PACOTES.find(x => x.id === pacoteId);
    if (!p) return null;
    return Object.assign({}, p, {
      liberado: liberado(pacoteId),
      nivel: nivelAtivo()
    });
  }

  // Lista todos os pacotes com status
  function listar() {
    const nivel = nivelAtivo();
    return PACOTES.map(p => Object.assign({}, p, {
      liberado: p.id <= nivel,
      nivel
    }));
  }

  /* ---------- Teaser: dados headline para pacotes bloqueados ---------- */

  // Dado um resultado completo do motor, gera os headlines de cada pacote bloqueado.
  // O headline mostra UM número chamativo sem detalhes — o suficiente para criar curiosidade.
  function teasers(resultado, entradas) {
    const nivel = nivelAtivo();
    const out = {};

    // Pacote 2: mostra o nome do melhor regime e a diferença
    if (2 > nivel && resultado.ranking && resultado.ranking.length >= 2) {
      const melhor = resultado.regimes[resultado.ranking[0]];
      const segundo = resultado.regimes[resultado.ranking[1]];
      out[2] = {
        headline: melhor.nome,
        subtexto: 'economiza ' + formatarBRL(melhor.sobra - segundo.sobra) + ' vs ' + segundo.nome,
        cta: 'Ver comparação completa'
      };
    }

    // Pacote 3: mostra a variação da carga entre 2026 e 2033
    if (3 > nivel) {
      out[3] = {
        headline: '2026 → 2033',
        subtexto: 'Veja como a carga muda ano a ano',
        cta: 'Ver projeção completa'
      };
    }

    // Pacote 4: placeholder
    if (4 > nivel) {
      out[4] = {
        headline: 'Economia acumulada',
        subtexto: 'Quanto o cliente pode economizar em 8 anos',
        cta: 'Ver análise de valor'
      };
    }

    // Pacote 5: placeholder
    if (5 > nivel) {
      out[5] = {
        headline: 'DRE completa',
        subtexto: 'Resultado antes e depois da reforma',
        cta: 'Ver análise completa'
      };
    }

    // Pacote 6: placeholder
    if (6 > nivel) {
      out[6] = {
        headline: 'Carteira de clientes',
        subtexto: 'Gerencie todos os seus clientes em um lugar',
        cta: 'Ver gestão de escritório'
      };
    }

    return out;
  }

  function formatarBRL(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return {
    PACOTES,
    nivelAtivo,
    setarNivel,
    liberado,
    status,
    listar,
    teasers
  };
});
