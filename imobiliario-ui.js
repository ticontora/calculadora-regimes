/*
 * Tela da calculadora imobiliária. Cálculo em motor/imobiliario.js; rascunho e histórico em dados/armazenamento.js.
 * Usa os utilitários globais de calculadora.js ($, fmtBRL, fmtPct, esc, parseBRL, vazio, lerNum, radio).
 */
(function () {
  'use strict';
  const IM = window.Motor.imobiliario;
  const ANOS = window.Motor.parametros.ANOS;
  const MOEDA = ['im-locAnt', 'im-prolabore', 'im-outras', 'im-valor', 'im-custo', 'im-corretagem', 'im-reinvest', 'im-rbt12', 'im-despvenda', 'im-itbi', 'im-contrap', 'im-aluguel', 'im-despesas', 'im-outrasMes', 'im-despPJ'];
  MOEDA.forEach(id => $(id).addEventListener('input', () => {
    const d = $(id).value.replace(/\D/g, '');
    $(id).value = d ? fmtNum.format(parseInt(d, 10) / 100) : '';
  }));
  const SUF = {1: 'por mês', 3: 'por trimestre', 6: 'por semestre', 12: 'por ano'};
  const NOME_PER = {1: 'Mensal', 3: 'Trimestral', 6: 'Semestral', 12: 'Anual'};
  let passo = 1, cat = 'todos', iniciado = false;
  const op = () => radio('im-operacao') || 'venda';

  function aquisicao() {
    const v = ($('im-aquisicao').value || '').split('-');
    return v.length === 2 ? {ano: +v[0], mes: +v[1]} : null;
  }
  function entradas() {
    const venda = op() === 'venda';
    return {
      operacao: op(), ano: parseInt($('im-ano').value, 10) || 2026, meses: venda ? 1 : (parseInt($('im-periodo').value, 10) || 1),
      referencia: {cbs: lerNum('im-refcbs') / 100, ibs: lerNum('im-refibs') / 100},
      perfil: radio('im-perfil') || 'pf',
      venda: {
        valor: parseBRL($('im-valor').value), custo: parseBRL($('im-custo').value), aquisicao: aquisicao() || {ano: 2026, mes: 1},
        mes: parseInt($('im-mes').value, 10) || 6, corretagem: parseBRL($('im-corretagem').value), tipo: $('im-tipo').value,
        itbiLaudemio: parseBRL($('im-itbi').value), contrapartidas: parseBRL($('im-contrap').value),
        unicoImovel: $('im-unico').checked, reinvestido: parseBRL($('im-reinvest').value), usouReinvestimento: $('im-usou').checked,
        natureza: $('im-natureza').value, rbt12Simples: parseBRL($('im-rbt12').value)
      },
      locacao: {
        aluguel: parseBRL($('im-aluguel').value), imoveis: Math.max(1, Math.round(lerNum('im-imoveis')) || 1),
        residencial: $('im-residencial').checked, temporada: $('im-temporada').checked, despesas: parseBRL($('im-despesas').value),
        outrasRendasMensais: parseBRL($('im-outrasMes').value), descontoSimplificado: $('im-simplificado').checked,
        art487: radio('im-transicao') === 'art487', finalidade487: $('im-finalidade').value
      },
      pf: {
        vendasAnoAnterior: lerNum('im-vendasAnt'), construidosAnoAnterior: lerNum('im-constrAnt'),
        vendasAnoCorrente: lerNum('im-vendasAtual'), construidosAnoCorrente: lerNum('im-constrAtual'),
        locacaoAnoAnterior: parseBRL($('im-locAnt').value), imoveisLocadosAnoAnterior: lerNum('im-imoveisAnt')
      },
      pj: {
        despesas: venda ? parseBRL($('im-despvenda').value) : parseBRL($('im-despPJ').value),
        socios: {quantidade: Math.max(1, Math.round(lerNum('im-socios')) || 1), proLabore: parseBRL($('im-prolabore').value),
          outrasRendasAnuais: parseBRL($('im-outras').value), irOutrasRendas: 0, aplicarNoSimples: $('im-divsimples').checked}
      }
    };
  }

  /* ----- Etapas ----- */
  function faltas(n) {
    const f = [];
    if (n === 3) {
      if (op() === 'venda') {
        if (!(parseBRL($('im-valor').value) > 0)) f.push(['im-valor', 'valor de venda']);
        if (vazio('im-custo')) f.push(['im-custo', 'custo de aquisição (pode ser 0)']);
        if (!aquisicao()) f.push(['im-aquisicao', 'mês e ano da aquisição']);
      } else if (!(parseBRL($('im-aluguel').value) > 0)) f.push(['im-aluguel', 'aluguel mensal']);
    }
    return f;
  }
  function limite() { for (let n = 1; n <= 4; n++) if (faltas(n).length) return n; return 5; }
  function visibilidade() {
    const venda = op() === 'venda';
    document.querySelectorAll('#main-imob .im-so-venda').forEach(el => { el.hidden = !venda; });
    document.querySelectorAll('#main-imob .im-so-locacao').forEach(el => { el.hidden = venda; });
    document.querySelectorAll('#main-imob .im-so-487').forEach(el => { el.hidden = venda || radio('im-transicao') !== 'art487'; });
    if (!venda && radio('im-perfil') === 'pjSimples') document.querySelector('input[name="im-perfil"][value="pf"]').checked = true;
    const a = aquisicao();
    const av = $('im-aviso-aquisicao');
    av.hidden = !(a && a.ano < 1994 || (a && a.ano * 12 + a.mes < 1994 * 12 + 7));
    av.textContent = 'Antes de julho de 1994: o redutor de ajuste da CBS/IBS é corrigido a partir de 07/1994, sobre o custo em reais da declaração.';
  }
  function irPara(n) {
    const lim = limite();
    if (n > lim) n = lim;
    passo = n;
    document.querySelectorAll('#main-imob .etapa-im').forEach(s => { s.hidden = Number(s.dataset.etapa) !== n; });
    $('im-resultado').hidden = n !== 5;
    $('im-nav').hidden = n === 5;
    $('im-voltar').hidden = n === 1;
    $('im-proximo').textContent = n === 4 ? 'Ver resultado' : 'Próximo';
    $('im-falta').textContent = '';
    document.querySelectorAll('#main-imob .stepper li').forEach((li, i) => {
      const p = i + 1;
      li.classList.toggle('atual', p === n);
      li.classList.toggle('feito', p < n);
      const b = li.querySelector('button');
      b.disabled = p > lim;
      if (p === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-label', 'Etapa ' + p + ': ' + b.querySelector('.rot').textContent + (p < n ? ', concluída' : '') + (p > lim ? ', bloqueada' : ''));
    });
    visibilidade();
    if (n === 5) render();
    salvarDepois();
  }
  function focar() {
    const alvo = passo === 5 ? $('im-t5') : document.querySelector('#main-imob .etapa-im[data-etapa="' + passo + '"] h2');
    if (!alvo) return;
    alvo.setAttribute('tabindex', '-1');
    alvo.focus({preventScroll: true});
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  $('im-proximo').addEventListener('click', () => {
    const f = faltas(passo);
    if (f.length) { $('im-falta').textContent = 'Preencha para avançar: ' + f.map(x => x[1]).join(', ') + '.'; $(f[0][0]).focus(); return; }
    irPara(passo + 1); focar();
  });
  $('im-voltar').addEventListener('click', () => { irPara(Math.max(1, passo - 1)); focar(); });
  document.querySelectorAll('.passo-im').forEach(b => b.addEventListener('click', () => { irPara(Number(b.dataset.passo)); focar(); }));

  /* ----- Resultado ----- */
  function fase(ano, ref) {
    const a = window.Motor.regimes.aliquotasCbsIbs(ano, ref);
    if (ano === 2026) return 'CBS e IBS de teste, sem custo. IR e PIS/COFINS pelas regras atuais.';
    const red = op() === 'venda' ? 0.5 : 0.7;
    return 'CBS ' + fmtPct(a.cbs) + ' e IBS ' + fmtPct(a.ibs) + ', com redução de ' + Math.round(red * 100) + '% nas operações com imóveis: ' + fmtPct((a.cbs + a.ibs) * (1 - red)) + ' sobre a base.';
  }
  const eleg = res => IM.ORDEM.filter(k => res.perfis[k].elegivel);
  function valorMemo(l) {
    if (typeof l.valor !== 'number') return '—';
    if (/^(Alíquota|Acréscimo)/.test(l.etapa)) return fmtPct(l.valor);
    if (/^Fator/.test(l.etapa)) return l.valor.toLocaleString('pt-BR', {maximumFractionDigits: 6});
    return fmtBRL.format(l.valor);
  }
  function render() {
    const e = entradas();
    $('im-ano-saida').textContent = e.ano;
    $('im-ano').setAttribute('aria-valuetext', String(e.ano));
    $('im-ano-fase').textContent = fase(e.ano, e.referencia);
    const res = IM.calcular(e);
    const ks = eleg(res);
    const melhor = res.ranking[0];
    const atual = e.perfil;
    const suf = e.operacao === 'venda' ? 'na venda' : SUF[e.meses];

    // KPIs
    const m = res.perfis[melhor], s = res.ranking[1] ? res.perfis[res.ranking[1]] : null;
    const a = res.perfis[atual] && res.perfis[atual].elegivel ? res.perfis[atual] : null;
    let k = `<div class="kpi destaque"><span class="r">Melhor forma em ${res.ano}</span><span class="v">${esc(m.nome)}</span><span class="d">${s ? 'Deixa ' + fmtBRL.format(m.noBolso - s.noBolso) + ' a mais que ' + esc(s.nome) : ''}</span></div>`;
    k += `<div class="kpi"><span class="r">Tributos na melhor forma</span><span class="v">${fmtBRL.format(m.total + (m.distribuicao ? m.distribuicao.irSocio : 0))}</span><span class="d">${fmtPct(m.receita > 0 ? (m.total + (m.distribuicao ? m.distribuicao.irSocio : 0)) / m.receita : 0)} do valor, ${suf}</span></div>`;
    k += `<div class="kpi"><span class="r">No bolso do proprietário</span><span class="v">${fmtBRL.format(m.noBolso)}</span><span class="d">${e.operacao === 'venda' ? 'Venda − custo − tributos' : 'Aluguel − despesas − tributos'}</span></div>`;
    if (a) k += `<div class="kpi"><span class="r">Seu cenário atual</span><span class="v">${esc(a.nome)}</span><span class="d">${atual === melhor ? 'Já é a melhor forma' : fmtBRL.format(m.noBolso - a.noBolso) + ' a menos que a melhor'}</span></div>`;
    $('im-kpis').innerHTML = k;

    // Tabela por categoria
    const cel = (kk, v) => `<td class="${kk === melhor ? 'melhor' : ''}">${v}</td>`;
    const somaCat = (r, c) => r.tributos.filter(t => t.categoria === c).reduce((x, t) => x + t.valor, 0);
    let corpo = '';
    if (cat === 'todos') {
      corpo += '<tr><th scope="row">Renda</th>' + ks.map(kk => cel(kk, fmtBRL.format(somaCat(res.perfis[kk], 'renda')))).join('') + '</tr>';
      corpo += '<tr><th scope="row">Consumo</th>' + ks.map(kk => cel(kk, fmtBRL.format(somaCat(res.perfis[kk], 'consumo')))).join('') + '</tr>';
    } else {
      const cods = [];
      ks.forEach(kk => res.perfis[kk].tributos.forEach(t => { if (t.categoria === cat && !cods.includes(t.codigo)) cods.push(t.codigo); }));
      cods.forEach(c => { corpo += `<tr><th scope="row">${esc(c)}</th>` + ks.map(kk => { const v = res.perfis[kk].tributos.filter(t => t.codigo === c).reduce((x, t) => x + t.valor, 0); return cel(kk, v ? fmtBRL.format(v) : '—'); }).join('') + '</tr>'; });
      if (!cods.length) corpo += `<tr><td class="na" colspan="${ks.length + 1}">Nenhum tributo desta categoria.</td></tr>`;
    }
    corpo += '<tr class="total"><th scope="row">Tributos da operação</th>' + ks.map(kk => cel(kk, fmtBRL.format(res.perfis[kk].total))).join('') + '</tr>';
    corpo += '<tr><th scope="row">IR do sócio na distribuição</th>' + ks.map(kk => cel(kk, res.perfis[kk].distribuicao ? fmtBRL.format(res.perfis[kk].distribuicao.irSocio) : '—')).join('') + '</tr>';
    corpo += '<tr><th scope="row">No bolso do proprietário</th>' + ks.map(kk => cel(kk, fmtBRL.format(res.perfis[kk].noBolso))).join('') + '</tr>';
    const fora = IM.ORDEM.filter(kk => !res.perfis[kk].elegivel);
    const cap = fora.length ? '<caption class="hint" style="caption-side:bottom;text-align:left">' + fora.map(kk => esc(res.perfis[kk].nome) + ': não se aplica (' + esc(res.perfis[kk].motivo) + ').').join(' ') + '</caption>' : '';
    $('im-tbl').innerHTML = '<thead><tr><th scope="col">' + (cat === 'todos' ? 'Categoria' : 'Tributo') + '</th>' + ks.map(kk => `<th scope="col" class="${kk === melhor ? 'melhor' : ''}">${esc(res.perfis[kk].nome)}${kk === melhor ? '<span class="tag">melhor</span>' : ''}</th>`).join('') + '</tr></thead><tbody>' + corpo + '</tbody>' + cap;

    // Comparativo
    $('im-comp-dica').textContent = 'Valores ' + suf + '. Empresa: lucro distribuído aos sócios, com a retenção de 10% e a tributação mínima da Lei 15.270/2025.';
    $('im-comparativo').innerHTML = ks.map(kk => {
      const r = res.perfis[kk], d = r.distribuicao;
      let h = `<article class="reg ${kk === melhor ? 'melhor' : ''}"><h3>${esc(r.nome)}${kk === melhor ? '<span class="tag">melhor</span>' : ''}${kk === atual ? '<span class="tag tag-atual">atual</span>' : ''}</h3><dl>`;
      h += `<dt>Tributos da operação</dt><dd>${fmtBRL.format(r.total)}</dd><dt>Carga sobre o valor</dt><dd>${fmtPct(r.efetiva)}</dd><dt>Resultado após tributos</dt><dd>${fmtBRL.format(r.resultado)}</dd>`;
      if (d) h += `<dt>IR retido na fonte</dt><dd>${fmtBRL.format(d.retido)}</dd><dt>IR do sócio no ano</dt><dd>${fmtBRL.format(d.irSocio)}</dd>`;
      h += `<dt>No bolso</dt><dd class="forte">${fmtBRL.format(r.noBolso)}</dd></dl>`;
      if (d && d.isento) h += '<p class="na">Dividendos do Simples tratados como isentos (LC 123, art. 14).</p>';
      return h + '</article>';
    }).join('');

    // Leituras
    const it = IM.insights(res, e);
    if (e.operacao === 'venda' && e.venda.aquisicao.ano * 12 + e.venda.aquisicao.mes > e.ano * 12 + e.venda.mes) it.unshift({tipo: 'alerta', texto: 'A data de aquisição é posterior à data da venda. Confira o ano no slider e o mês na etapa 3.'});
    $('im-insights').innerHTML = it.map(i => `<li class="${i.tipo}">${esc(i.texto)}</li>`).join('');

    // Memória
    $('im-h-memo').textContent = 'Memória de cálculo · ' + (e.operacao === 'venda' ? 'venda' : NOME_PER[e.meses].toLowerCase()) + ' · ' + res.ano;
    $('im-memoria').innerHTML = ks.map(kk => {
      const r = res.perfis[kk];
      const ls = r.memoria.map(l => `<tr><td>${esc(l.etapa)}</td><td>${esc(l.formula)}</td><td>${valorMemo(l)}</td><td>${esc(l.fundamento)}</td></tr>`).join('');
      return `<h3>${esc(r.nome)}</h3><div class="tablewrap"><table><thead><tr><th>Etapa</th><th>Fórmula</th><th>Valor</th><th>Fundamento</th></tr></thead><tbody>${ls}<tr class="total"><td>Tributos da operação</td><td></td><td>${fmtBRL.format(r.total)}</td><td></td></tr></tbody></table></div>`;
    }).join('');
    return res;
  }
  function atualizar() { visibilidade(); if (passo === 5) render(); }
  $('im-form').addEventListener('input', () => { atualizar(); salvarDepois(); });
  $('im-form').addEventListener('change', () => { atualizar(); salvarDepois(); });
  ['im-ano', 'im-periodo'].forEach(id => $(id).addEventListener('input', () => { atualizar(); salvarDepois(); }));
  $('im-periodo').addEventListener('change', atualizar);
  document.querySelectorAll('[data-catim]').forEach(b => b.addEventListener('click', () => {
    cat = b.dataset.catim;
    document.querySelectorAll('[data-catim]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));

  /* ----- Rascunho, histórico, compartilhar ----- */
  const CAMPOS = ['im-vendasAnt', 'im-constrAnt', 'im-vendasAtual', 'im-constrAtual', 'im-locAnt', 'im-imoveisAnt', 'im-socios', 'im-prolabore', 'im-outras', 'im-divsimples',
    'im-valor', 'im-custo', 'im-aquisicao', 'im-mes', 'im-tipo', 'im-corretagem', 'im-unico', 'im-reinvest', 'im-usou', 'im-natureza', 'im-rbt12', 'im-despvenda', 'im-itbi', 'im-contrap',
    'im-aluguel', 'im-imoveis', 'im-despesas', 'im-outrasMes', 'im-despPJ', 'im-residencial', 'im-temporada', 'im-simplificado', 'im-finalidade', 'im-refcbs', 'im-refibs', 'im-ano', 'im-periodo'];
  function coletar() {
    const d = {modo: 'imob', passo};
    CAMPOS.forEach(id => { const el = $(id); d[id] = el.type === 'checkbox' ? el.checked : el.value; });
    ['im-operacao', 'im-perfil', 'im-transicao'].forEach(n => { d[n] = radio(n); });
    return d;
  }
  function aplicar(d) {
    CAMPOS.forEach(id => { if (!(id in d)) return; const el = $(id); if (el.type === 'checkbox') el.checked = !!d[id]; else el.value = d[id]; });
    ['im-operacao', 'im-perfil', 'im-transicao'].forEach(n => { const r = document.querySelector('input[name="' + n + '"][value="' + d[n] + '"]'); if (r) r.checked = true; });
    if (!$('im-periodo').value) $('im-periodo').value = '1';
  }
  let timer = null;
  function salvarDepois() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = window.Armazenamento.salvarRascunho(coletar(), 'imob');
      if (q && !$('main-imob').hidden) $('rascunho').textContent = 'Rascunho salvo às ' + q.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
    }, 500);
  }
  function msg(t, tipo) { $('im-msg').className = 'status' + (tipo ? ' ' + tipo : ''); $('im-msg').textContent = t; }
  $('im-salvar').addEventListener('click', () => {
    const e = entradas();
    const res = IM.calcular(e);
    const titulo = (e.operacao === 'venda' ? 'Venda de imóvel de ' + fmtBRL.format(e.venda.valor) : 'Locação de ' + fmtBRL.format(e.locacao.aluguel) + '/mês');
    const ok = window.Armazenamento.salvarNoHistorico({titulo, resumo: 'Calculadora Imobiliária · melhor: ' + res.perfis[res.ranking[0]].nome + ' · ' + e.ano, dados: coletar()});
    window.renderHistorico();
    msg(ok ? 'Salvo no histórico deste navegador.' : 'Este navegador bloqueou o armazenamento; a simulação não foi salva.', ok ? 'ok' : 'bad');
  });
  $('im-editar').addEventListener('click', () => { irPara(1); focar(); });
  $('im-limpar').addEventListener('click', () => {
    $('im-form').reset();
    $('im-ano').value = '2026'; $('im-periodo').value = '1';
    window.Armazenamento.limparRascunho('imob');
    $('rascunho').textContent = '';
    history.replaceState(null, '', location.pathname + location.search);
    irPara(1); focar();
  });
  function link() {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(coletar())))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.origin + location.pathname + '#i=' + b64;
  }
  function lerLink() {
    const mm = location.hash.match(/^#i=([\w-]+)$/);
    if (!mm) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(mm[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (err) { return null; }
  }
  $('im-compartilhar').addEventListener('click', async () => {
    try {
      const arq = new File([pdf()], nomePdf(), {type: 'application/pdf'});
      if (navigator.canShare && navigator.canShare({files: [arq]})) { await navigator.share({files: [arq], title: 'Análise imobiliária'}); msg('Análise compartilhada.', 'ok'); return; }
    } catch (err) { if (err && err.name === 'AbortError') return; }
    const l = link();
    try { await navigator.clipboard.writeText(l); msg('Link copiado. Ele abre esta simulação com os mesmos números.', 'ok'); }
    catch (err) { msg('Copie o link: ' + l); }
  });

  /* ----- PDF ----- */
  function nomePdf() { return 'analise-imobiliaria-' + (op() === 'venda' ? 'venda' : 'locacao') + '-' + $('im-ano').value + '.pdf'; }
  function pdf() {
    const e = entradas();
    const res = IM.calcular(e);
    const ks = eleg(res);
    const P = window.PdfBase.criarPdf({titulo: e.operacao === 'venda' ? 'Análise imobiliária: venda de imóvel' : 'Análise imobiliária: locação', subtitulo: 'Pessoa física × empresa, ano ' + res.ano});
    const suf = e.operacao === 'venda' ? 'na venda' : SUF[e.meses];
    P.titulo('Dados informados');
    if (e.operacao === 'venda') {
      const tipo = {residencial_usado: 'Residencial usado', residencial_novo: 'Residencial novo', lote: 'Lote residencial', comercial: 'Comercial'}[e.venda.tipo];
      P.pares([['Valor de venda', fmtBRL.format(e.venda.valor)], ['Custo de aquisição', fmtBRL.format(e.venda.custo)], ['Aquisição', String(e.venda.aquisicao.mes).padStart(2, '0') + '/' + e.venda.aquisicao.ano],
        ['Venda', String(e.venda.mes).padStart(2, '0') + '/' + res.ano], ['Tipo', tipo], ['Corretagem', fmtBRL.format(e.venda.corretagem)],
        ['Na empresa', e.venda.natureza === 'ativo' ? 'Ativo' : 'Estoque'], ['Sócios', String(e.pj.socios.quantidade)], ['CBS / IBS de referência', fmtPct(e.referencia.cbs) + ' / ' + fmtPct(e.referencia.ibs)]]);
    } else {
      P.pares([['Aluguel mensal', fmtBRL.format(e.locacao.aluguel)], ['Imóveis', String(e.locacao.imoveis)], ['Uso', e.locacao.temporada ? 'Temporada' : (e.locacao.residencial ? 'Residencial' : 'Não residencial')],
        ['Despesas do proprietário', fmtBRL.format(e.locacao.despesas)], ['Outras rendas da PF', fmtBRL.format(e.locacao.outrasRendasMensais)], ['Transição', e.locacao.art487 ? 'Art. 487 (3,65%)' : 'Regra geral'],
        ['Período', NOME_PER[e.meses]], ['Sócios', String(e.pj.socios.quantidade)], ['CBS / IBS de referência', fmtPct(e.referencia.cbs) + ' / ' + fmtPct(e.referencia.ibs)]]);
    }
    const m = res.perfis[res.ranking[0]], s = res.ranking[1] ? res.perfis[res.ranking[1]] : null;
    P.caixa(['Melhor forma em ' + res.ano + ': ' + m.nome + '.', 'No bolso do proprietário: ' + fmtBRL.format(m.noBolso) + ' ' + suf + (s ? '; ' + fmtBRL.format(m.noBolso - s.noBolso) + ' a mais que ' + s.nome + '.' : '.')]);
    P.titulo('Resultado em ' + res.ano + ' (' + suf + ')');
    P.tabela(['Forma', 'Renda', 'Consumo', 'IR do sócio', 'No bolso'], ks.map(kk => {
      const r = res.perfis[kk];
      const renda = r.tributos.filter(t => t.categoria === 'renda').reduce((x, t) => x + t.valor, 0);
      return [r.nome, fmtBRL.format(renda), fmtBRL.format(r.total - renda), r.distribuicao ? fmtBRL.format(r.distribuicao.irSocio) : '-', fmtBRL.format(r.noBolso)];
    }), [0.32, 0.17, 0.17, 0.16, 0.18], ['l', 'r', 'r', 'r', 'r'], {destaque: i => ks[i] === res.ranking[0]});
    IM.ORDEM.filter(kk => !res.perfis[kk].elegivel).forEach(kk => P.texto(res.perfis[kk].nome + ': não se aplica (' + res.perfis[kk].motivo + ').', 8.5, P.cores.mut));
    P.titulo('Projeção 2026 a 2033: no bolso do proprietário (' + suf + ')');
    const todos = {};
    ANOS.forEach(an => { todos[an] = IM.calcular(Object.assign({}, e, {ano: an})); });
    const cols = IM.ORDEM.filter(kk => ANOS.some(an => todos[an].perfis[kk].elegivel));
    const curto = {pf: 'PF', pjPresumido: 'Presumido', pjReal: 'Real', pjSimples: 'Simples', pjHibrido: 'Simples Híbrido'};
    P.tabela(['Ano'].concat(cols.map(kk => curto[kk])), ANOS.map(an => [String(an)].concat(cols.map(kk => {
      const r = todos[an].perfis[kk];
      return r.elegivel ? fmtBRL.format(r.noBolso) + (todos[an].ranking[0] === kk ? ' *' : '') : '-';
    }))), [0.12].concat(cols.map(() => 0.88 / cols.length)), ['l'].concat(cols.map(() => 'r')), {destaque: i => ANOS[i] === res.ano});
    P.texto('* melhor forma do ano. Redutores corrigidos pelo IPCA até o último mês publicado, sem projeção.', 8, P.cores.mut);
    P.titulo('Leituras do resultado');
    IM.insights(res, e).forEach(i => P.texto('• ' + i.texto));
    P.titulo('Memória de cálculo (' + (e.operacao === 'venda' ? 'venda' : NOME_PER[e.meses].toLowerCase()) + ', ' + res.ano + ')');
    ks.forEach(kk => {
      const r = res.perfis[kk];
      P.texto(r.nome, 10, P.cores.navy);
      const ls = r.memoria.map(l => [l.etapa.trim(), l.formula, valorMemo(l), l.fundamento]);
      ls.push(['Tributos da operação', '', fmtBRL.format(r.total), '']);
      P.tabela(['Etapa', 'Fórmula', 'Valor', 'Fundamento'], ls, [0.25, 0.33, 0.15, 0.27], ['l', 'l', 'r', 'l'], {fs: 7.5, negrito: i => i === ls.length - 1});
    });
    P.titulo('Premissas e pontos a confirmar');
    document.querySelectorAll('#im-limits li').forEach(li => P.texto('• ' + li.textContent, 8.5));
    return P.finalizar();
  }
  $('im-pdf').addEventListener('click', () => {
    try {
      const url = URL.createObjectURL(new Blob([pdf()], {type: 'application/pdf'}));
      const a = document.createElement('a');
      a.href = url; a.download = nomePdf();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      msg('PDF gerado.', 'ok');
    } catch (err) { msg('Não foi possível gerar o PDF: ' + err.message, 'bad'); }
  });

  /* ----- Entrada na calculadora ----- */
  function entrar() {
    if (!iniciado) {
      iniciado = true;
      const lk = lerLink();
      const r = window.Armazenamento.lerRascunho('imob');
      if (lk) { aplicar(lk); irPara(5); msg('Simulação aberta por link compartilhado.', 'ok'); focar(); return; }
      if (r && r.dados) {
        aplicar(r.dados);
        const q = new Date(r.quando);
        irPara(r.dados.passo || 1);
        $('rascunho').textContent = 'Rascunho de ' + q.toLocaleDateString('pt-BR') + ' às ' + q.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) + ' recuperado';
        focar();
        return;
      }
    }
    irPara(passo);
    focar();
  }
  function abrir(d, texto) { iniciado = true; aplicar(d); irPara(5); focar(); msg(texto, 'ok'); }
  window.ImobUI = {entrar, abrir, calcularPdf: pdf, entradas, faltas: () => [1, 2, 3, 4].flatMap(faltas), passo: () => passo,
    atualizar: () => { atualizar(); salvarDepois(); }, irPara};
  visibilidade();
})();
