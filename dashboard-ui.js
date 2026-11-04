/*
 * UI do Dashboard Comercial.
 * Renderiza os pacotes no DOM, gerencia teaser/paywall, e conecta os sliders.
 * Depende de: Motor.parametros, Motor.regimes, Motor.dashboard, Motor.pacotes
 */
'use strict';

(function () {
  const Motor = window.Motor;
  const P = Motor.parametros;
  const Dash = Motor.dashboard;
  const Pac = Motor.pacotes;

  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtPct = v => (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ===== Pacote 1: Impacto CBS/IBS ===== */

  function renderPacote1(container, entradas) {
    const dados = Dash.impactoCbsIbs(entradas);
    if (!dados || !dados.kpis.length) {
      container.innerHTML = '<p class="kpi-vazio">Informe o faturamento para ver o impacto da reforma.</p>';
      return;
    }

    let html = '<div class="kpi-grid">';

    dados.kpis.forEach(kpi => {
      if (kpi.tipo === 'moeda') {
        const temVariacao = kpi.variacao !== undefined && Math.abs(kpi.variacao) >= 0.001;
        const classe = temVariacao ? (kpi.variacao > 0 ? 'up' : 'down') : 'neutral';
        const isDestaque = kpi.id === 'carga-atual';

        html += `<div class="kpi-card${isDestaque ? ' destaque' : ''}" data-kpi="${esc(kpi.id)}">`;
        html += `<span class="label">${esc(kpi.label)}</span>`;
        html += `<span class="valor">${fmtBRL.format(kpi.valor)}</span>`;
        if (temVariacao) {
          html += `<span class="variacao ${classe}"><span class="seta"></span> ${classe === 'up' ? '+' : ''}${fmtPct(kpi.variacao)} vs 2026</span>`;
        }
        html += `<span class="sublabel">${esc(kpi.sublabel)}</span>`;
        if (kpi.efetiva !== undefined) {
          html += `<span class="sublabel">Alíquota efetiva: ${fmtPct(kpi.efetiva)}</span>`;
        }
        html += '</div>';
      } else if (kpi.tipo === 'comparativo') {
        const classe = kpi.variacao > 0.005 ? 'up' : kpi.variacao < -0.005 ? 'down' : 'neutral';
        html += `<div class="kpi-card" data-kpi="${esc(kpi.id)}">`;
        html += `<span class="label">${esc(kpi.label)}</span>`;
        html += `<span class="valor">${fmtBRL.format(kpi.depois)}</span>`;
        html += `<span class="variacao ${classe}"><span class="seta"></span> ${classe === 'up' ? '+' : ''}${fmtPct(kpi.variacao)} vs 2026</span>`;
        html += `<span class="sublabel">${esc(kpi.sublabel)}</span>`;
        html += '</div>';
      }
    });

    html += '</div>';

    // Resumo textual
    if (dados.resumo) {
      html += `<p class="resumo" style="margin-top:12px;font-size:0.9rem;color:var(--dash-muted)">${esc(dados.resumo)}</p>`;
    }

    // Alerta de mudança de regime
    if (dados.detalhes.mudouRegime) {
      html += `<div class="alerta-mudanca" style="margin-top:12px;padding:10px 14px;background:var(--dash-gold-soft);border-left:3px solid var(--dash-gold);border-radius:6px;font-size:0.85rem;color:var(--dash-ink)">`;
      html += `<strong>Atenção:</strong> O melhor regime muda de ${esc(Motor.regimes.NOMES[dados.detalhes.melhorRegime2026])} `;
      html += `(2026) para ${esc(Motor.regimes.NOMES[dados.detalhes.melhorRegime2027])} (2027). Avalie a transição com o contador.`;
      html += '</div>';
    }

    container.innerHTML = html;
  }

  /* ===== Pacote 2: Regime Comparativo ===== */

  function renderPacote2(container, entradas) {
    const dados = Dash.regimeComparativo(entradas);
    if (!dados) {
      container.innerHTML = '<p class="kpi-vazio">Sem dados para comparar.</p>';
      return;
    }

    let html = '';

    // Selo melhor regime
    html += `<div class="selo-melhor">`;
    html += `<span class="selo-icone">\u{1F3C6}</span>`;
    html += `<div class="selo-texto">`;
    html += `<h4>${esc(dados.selo.regime)}</h4>`;
    if (dados.selo.vs) {
      html += `<p>Economiza ${fmtBRL.format(dados.selo.economia)} (${fmtPct(dados.selo.economiaPercentual)}) vs ${esc(dados.selo.vs)}</p>`;
    } else {
      html += `<p>Único regime aplicável</p>`;
    }
    html += `</div></div>`;

    // Legenda
    html += `<div class="barra-legenda" style="margin-top:16px;margin-bottom:8px">`;
    html += `<span class="leg-renda">Renda (IRPJ/CSLL)</span>`;
    html += `<span class="leg-consumo">Consumo (PIS/COFINS/CBS/IBS/ICMS/ISS)</span>`;
    html += `<span class="leg-folha">Folha (CPP)</span>`;
    html += `</div>`;

    // Barras empilhadas
    html += '<div class="barras-container">';
    const maxTotal = Math.max(...dados.barras.map(b => b.total));

    dados.barras.forEach(b => {
      const pRenda = maxTotal > 0 ? (b.renda / maxTotal) * 100 : 0;
      const pConsumo = maxTotal > 0 ? (b.consumo / maxTotal) * 100 : 0;
      const pFolha = maxTotal > 0 ? (b.folha / maxTotal) * 100 : 0;

      html += `<div class="barra-regime${b.melhor ? ' melhor' : ''}">`;
      html += `<div class="regime-nome">${esc(b.regime)}${b.melhor ? ' <span class="badge-free" style="background:var(--dash-gold);color:var(--dash-navy)">melhor</span>' : ''}</div>`;
      html += `<div class="regime-total">${fmtBRL.format(b.total)}</div>`;
      html += `<div class="regime-efetiva">${fmtPct(b.efetiva)} do faturamento</div>`;
      html += `<div class="barra-visual">`;
      if (pRenda > 0) html += `<div class="seg seg-renda" style="width:${pRenda.toFixed(1)}%" title="Renda: ${fmtBRL.format(b.renda)}">${pRenda > 12 ? fmtBRL.format(b.renda) : ''}</div>`;
      if (pConsumo > 0) html += `<div class="seg seg-consumo" style="width:${pConsumo.toFixed(1)}%" title="Consumo: ${fmtBRL.format(b.consumo)}">${pConsumo > 12 ? fmtBRL.format(b.consumo) : ''}</div>`;
      if (pFolha > 0) html += `<div class="seg seg-folha" style="width:${pFolha.toFixed(1)}%" title="Folha: ${fmtBRL.format(b.folha)}">${pFolha > 12 ? fmtBRL.format(b.folha) : ''}</div>`;
      html += `</div>`;
      html += `</div>`;
    });

    html += '</div>';

    container.innerHTML = html;
  }

  /* ===== Teaser para pacotes bloqueados ===== */

  function renderTeaser(container, pacoteId, teaser) {
    if (!teaser) {
      container.innerHTML = '';
      return;
    }

    let html = `<div class="pacote-teaser">`;

    // Conteúdo borrado (placeholder visual)
    html += `<div class="teaser-conteudo"><div class="kpi-grid">`;
    for (let i = 0; i < 3; i++) {
      html += `<div class="kpi-card"><span class="label">Lorem ipsum</span><span class="valor">R$ 0.000,00</span><span class="sublabel">Detalhes do pacote</span></div>`;
    }
    html += `</div></div>`;

    // Overlay
    html += `<div class="teaser-overlay">`;
    html += `<span class="teaser-icone">🔒</span>`;
    html += `<span class="teaser-headline">${esc(teaser.headline)}</span>`;
    html += `<span class="teaser-sub">${esc(teaser.subtexto)}</span>`;
    html += `<button type="button" class="teaser-cta" data-pacote="${pacoteId}">${esc(teaser.cta)}</button>`;
    html += `</div>`;

    html += `</div>`;
    container.innerHTML = html;
  }

  /* ===== Renderização principal ===== */

  function renderDashboard(containerId, entradas) {
    const root = document.getElementById(containerId);
    if (!root) return;

    const receita = entradas.receita || 0;
    if (receita <= 0) {
      root.innerHTML = `<div class="dashboard">
        <div class="dashboard-header">
          <h2>Dashboard</h2>
          <p class="resumo">Informe os dados do cliente para ver a análise.</p>
        </div>
      </div>`;
      return;
    }

    const pacotes = Pac.listar();
    const resultado = Motor.regimes.calcular(entradas);
    const teaserData = Pac.teasers(resultado, entradas);

    let html = `<div class="dashboard">`;

    pacotes.forEach(p => {
      html += `<div class="pacote-secao" data-pacote="${p.id}">`;

      // Título do pacote
      html += `<div class="pacote-titulo">`;
      html += `<span class="numero">${p.id}</span>`;
      html += `<h3>${esc(p.nome)}</h3>`;
      if (p.gratis) html += `<span class="badge-free">free</span>`;
      html += `<span class="subtitulo">${esc(p.subtitulo)}</span>`;
      html += `</div>`;

      // Conteúdo do pacote
      html += `<div id="pacote-${p.id}-conteudo"></div>`;

      html += `</div>`;
    });

    html += `</div>`;
    root.innerHTML = html;

    // Renderiza cada pacote
    pacotes.forEach(p => {
      const el = document.getElementById('pacote-' + p.id + '-conteudo');
      if (!el) return;

      if (p.liberado) {
        switch (p.id) {
          case 1: renderPacote1(el, entradas); break;
          case 2: renderPacote2(el, entradas); break;
          default:
            el.innerHTML = `<p style="color:var(--dash-muted);font-size:0.9rem;padding:12px 0">Pacote ${p.id} em desenvolvimento.</p>`;
        }
      } else {
        renderTeaser(el, p.id, teaserData[p.id]);
      }
    });

    // Eventos dos CTAs de teaser
    root.querySelectorAll('.teaser-cta').forEach(btn => {
      btn.addEventListener('click', function () {
        const pid = parseInt(this.dataset.pacote, 10);
        const ev = new CustomEvent('pacote-upgrade', { detail: { pacote: pid } });
        document.dispatchEvent(ev);
      });
    });
  }

  /* ===== API pública ===== */
  window.DashboardUI = {
    render: renderDashboard,
    renderPacote1,
    renderPacote2,
    renderTeaser
  };
})();
