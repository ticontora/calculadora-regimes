/*
 * Assistente Tributário (IA): painel de conversa dentro da calculadora.
 * As perguntas vão ao Worker (worker/assistente), que chama a API do Claude com a chave guardada lá.
 * As ferramentas rodam AQUI, com o motor da calculadora (Motor.regimes e Motor.imobiliario):
 * a IA não calcula imposto de cabeça. CNPJ, razão social e CNAE nunca são enviados.
 * Configuração em assistente-config.js: window.ASSISTENTE_CONFIG = {url, codigo}.
 * Carregar depois de calculadora.js e imobiliario-ui.js.
 */
(function () {
  'use strict';
  const CFG = Object.assign({url: '', codigo: '', maxRodadas: 6}, window.ASSISTENTE_CONFIG || {});
  const M = window.Motor;
  if (!M || !M.regimes || typeof entradas !== 'function') { console.warn('Assistente: calculadora não carregada.'); return; }
  const r2 = v => Math.round(v * 100) / 100;
  const pc = v => r2(v * 100);

  /* ===== Resumos enviados à IA (sem dados de identificação) ===== */
  function resumoRegimes(e, res, comMemoria) {
    const regimes = {};
    M.regimes.ORDEM.forEach(k => {
      const r = res.regimes[k];
      if (!r.elegivel) { regimes[r.nome] = {aplica: false, motivo: r.motivo}; return; }
      const trib = {};
      r.tributos.forEach(t => { trib[t.codigo] = r2(t.valor); });
      const o = {tributos: trib, total: r2(r.total), carga_sobre_faturamento_pct: pc(r.efetiva), sobra_na_empresa: r2(r.sobra)};
      if (e.distribuir && r.distribuicao) {
        const d = r.distribuicao;
        o.com_distribuicao = {dividendos: r2(d.distribuidoMes), ir_retido_fonte: r2(d.retidoMes), ir_socio_no_ano: r2(d.irpfmMes), liquido_socios: r2(d.liquidoSociosMes), dividendos_isentos_simples: d.isento};
      }
      if (comMemoria) o.memoria_de_calculo = r.memoria.map(l => ({etapa: l.etapa.trim(), formula: l.formula, valor: r2(l.valor), fundamento: l.fundamento}));
      regimes[r.nome] = o;
    });
    return {
      calculadora: 'regimes da empresa',
      entradas: {
        faturamento_mensal: e.receita, atividade: e.atividade, lucro_antes_impostos_pct: pc(e.margem), folha_mensal: e.folha,
        compras_com_credito_pct: pc(e.compras), sem_compras_com_credito: e.semCompras, icms_pct: pc(e.icms), iss_pct: pc(e.iss),
        fator_r_marcado: e.fatorR, ano: e.ano, periodo_meses: e.meses, comprador: e.comprador, distribuir_lucro: e.distribuir,
        socios: e.socios.quantidade, pro_labore_por_socio: e.socios.proLabore, cbs_ref_pct: pc(e.referencia.cbs), ibs_ref_pct: pc(e.referencia.ibs)
      },
      valores_sao_do_periodo_de_meses: e.meses,
      anexo_simples: res.anexo, faixa_simples: res.faixa ? res.faixa.faixa : null, fator_r: res.fatorR === null ? null : pc(res.fatorR),
      regimes,
      ranking_maior_sobra_primeiro: res.ranking.map(k => res.regimes[k].nome),
      credito_do_comprador: res.comprador.linhas.map(l => ({regime_da_empresa: l.nome, credito: r2(l.credito), custo_para_cliente: r2(l.liquido)})),
      leituras: M.insights.gerar(res, e).map(i => i.texto)
    };
  }
  function anosRegimes(e) {
    const out = {};
    M.parametros.ANOS.forEach(a => {
      const r = M.regimes.calcular(Object.assign({}, e, {ano: a}));
      const linha = {};
      M.regimes.ORDEM.forEach(k => { if (r.regimes[k].elegivel) linha[r.regimes[k].nome] = r2(r.regimes[k].total); });
      linha.melhor = r.regimes[r.ranking[0]].nome;
      out[a] = linha;
    });
    return out;
  }
  function resumoImovel(e, res, comMemoria) {
    const formas = {};
    M.imobiliario.ORDEM.forEach(k => {
      const r = res.perfis[k];
      if (!r.elegivel) { formas[r.nome] = {aplica: false, motivo: r.motivo}; return; }
      const trib = {};
      r.tributos.forEach(t => { trib[t.codigo] = r2(t.valor); });
      const o = {tributos: trib, total: r2(r.total), carga_sobre_valor_pct: pc(r.efetiva), resultado_apos_tributos: r2(r.resultado), no_bolso_do_proprietario: r2(r.noBolso)};
      if (r.distribuicao) o.ir_do_socio_na_distribuicao = r2(r.distribuicao.irSocio);
      if (comMemoria) o.memoria_de_calculo = r.memoria.map(l => ({etapa: l.etapa.trim(), formula: l.formula, valor: r2(l.valor), fundamento: l.fundamento}));
      formas[r.nome] = o;
    });
    const ent = e.operacao === 'venda'
      ? {operacao: 'venda', ano: e.ano, valor_venda: e.venda.valor, custo_aquisicao: e.venda.custo, aquisicao: e.venda.aquisicao.ano + '-' + String(e.venda.aquisicao.mes).padStart(2, '0'), mes_venda: e.venda.mes, tipo: e.venda.tipo, corretagem: e.venda.corretagem, unico_imovel: e.venda.unicoImovel, reinvestido: e.venda.reinvestido, natureza_na_empresa: e.venda.natureza}
      : {operacao: 'locacao', ano: e.ano, periodo_meses: e.meses, aluguel_mensal: e.locacao.aluguel, imoveis: e.locacao.imoveis, residencial: e.locacao.residencial, temporada: e.locacao.temporada, despesas_mensais: e.locacao.despesas, outras_rendas_mensais: e.locacao.outrasRendasMensais, contrato_antigo_487: e.locacao.art487};
    return {
      calculadora: 'imobiliário', perfil_atual: res.perfis[e.perfil] ? res.perfis[e.perfil].nome : null, entradas: ent,
      pessoa_fisica_paga_cbs_ibs: res.pfContribuinte ? res.pfContribuinte.sim : null,
      formas, ranking_mais_no_bolso_primeiro: res.ranking.map(k => res.perfis[k].nome),
      leituras: M.imobiliario.insights(res, e).map(i => i.texto)
    };
  }
  function anosImovel(e) {
    const out = {};
    M.parametros.ANOS.forEach(a => {
      const r = M.imobiliario.calcular(Object.assign({}, e, {ano: a}));
      const linha = {};
      M.imobiliario.ORDEM.forEach(k => { if (r.perfis[k].elegivel) linha[r.perfis[k].nome + ' (no bolso)'] = r2(r.perfis[k].noBolso); });
      linha.melhor = r.perfis[r.ranking[0]].nome;
      out[a] = linha;
    });
    return out;
  }
  function modo() {
    if (!document.getElementById('main-imob').hidden) return 'imob';
    if (!document.getElementById('main-regimes').hidden) return 'regimes';
    return 'escolha';
  }

  /* ===== Ferramentas ===== */
  function lerTela() {
    const m = modo();
    if (m === 'escolha') return {tela: 'escolha da calculadora', aviso: 'A pessoa ainda não abriu nenhuma calculadora. Pergunte se é sobre a empresa (regimes) ou sobre imóvel.'};
    if (m === 'regimes') {
      const e = entradas();
      const falta = [1, 2, 3, 4].flatMap(n => faltas(n).map(f => f[1]));
      if (!(e.receita > 0)) return {tela: 'regimes da empresa', faltando: falta, aviso: 'Sem faturamento preenchido ainda.'};
      return Object.assign({tela: 'regimes da empresa', campos_ainda_vazios: falta}, resumoRegimes(e, M.regimes.calcular(e), true));
    }
    const e = window.ImobUI.entradas();
    const falta = window.ImobUI.faltas().map(f => f[1]);
    if (falta.length) return {tela: 'imobiliário', operacao: e.operacao, faltando: falta};
    return Object.assign({tela: 'imobiliário'}, resumoImovel(e, M.imobiliario.calcular(e), true));
  }
  function simularRegimes(a) {
    const e = entradas();
    const x = a || {};
    const num = (k, f) => { if (x[k] !== undefined) { if (typeof x[k] !== 'number' || x[k] < 0) throw new Error(k + ' inválido'); f(x[k]); } };
    num('receita', v => { e.receita = v; }); num('folha', v => { e.folha = v; });
    num('margem', v => { e.margem = v / 100; }); num('compras', v => { e.compras = v / 100; });
    num('icms', v => { e.icms = v / 100; }); num('iss', v => { e.iss = v / 100; });
    num('pro_labore', v => { e.socios.proLabore = v; }); num('outras_rendas_anuais', v => { e.socios.outrasRendasAnuais = v; });
    num('cbs_ref', v => { e.referencia.cbs = v / 100; }); num('ibs_ref', v => { e.referencia.ibs = v / 100; });
    if (x.atividade) { if (!M.parametros.ATIVIDADES[x.atividade]) throw new Error('atividade inválida'); e.atividade = x.atividade; }
    if (x.fatorR !== undefined) e.fatorR = !!x.fatorR;
    if (x.ano) e.ano = x.ano;
    if (x.periodo) e.meses = x.periodo;
    if (x.comprador) e.comprador = x.comprador;
    if (x.socios) e.socios.quantidade = x.socios;
    if (x.distribuir !== undefined) { e.distribuir = !!x.distribuir; e.socios.percentual = x.distribuir ? (e.socios.percentual || 1) : 0; }
    if (!(e.receita > 0)) throw new Error('falta o faturamento mensal');
    const out = Object.assign({cenario: x.rotulo || 'cenário'}, resumoRegimes(e, M.regimes.calcular(e), false));
    if (x.todos_os_anos) out.total_de_tributos_por_ano = anosRegimes(e);
    return out;
  }
  function simularImovel(a) {
    const e = window.ImobUI.entradas();
    const x = a || {};
    if (x.operacao) e.operacao = x.operacao;
    if (x.ano) e.ano = x.ano;
    if (x.periodo) e.meses = e.operacao === 'venda' ? 1 : x.periodo;
    const v = e.venda, l = e.locacao;
    const mapa = {valor_venda: n => { v.valor = n; }, custo_aquisicao: n => { v.custo = n; }, corretagem: n => { v.corretagem = n; }, reinvestido: n => { v.reinvestido = n; },
      aluguel_mensal: n => { l.aluguel = n; }, despesas_mensais: n => { l.despesas = n; }, outras_rendas_mensais: n => { l.outrasRendasMensais = n; },
      alugueis_ano_anterior: n => { e.pf.locacaoAnoAnterior = n; }};
    Object.keys(mapa).forEach(k => { if (x[k] !== undefined) { if (typeof x[k] !== 'number' || x[k] < 0) throw new Error(k + ' inválido'); mapa[k](x[k]); } });
    if (x.aquisicao) { const m = /^(\d{4})-(\d{2})$/.exec(x.aquisicao); if (!m) throw new Error('aquisicao deve ser AAAA-MM'); v.aquisicao = {ano: +m[1], mes: +m[2]}; }
    if (x.mes_venda) v.mes = x.mes_venda;
    if (x.tipo) v.tipo = x.tipo;
    if (x.natureza) v.natureza = x.natureza;
    if (x.unico_imovel !== undefined) v.unicoImovel = !!x.unico_imovel;
    if (x.imoveis) l.imoveis = x.imoveis;
    ['residencial', 'temporada'].forEach(k => { if (x[k] !== undefined) l[k] = !!x[k]; });
    if (x.desconto_simplificado !== undefined) l.descontoSimplificado = !!x.desconto_simplificado;
    if (x.contrato_antigo_487 !== undefined) l.art487 = !!x.contrato_antigo_487;
    if (x.finalidade_487) l.finalidade487 = x.finalidade_487;
    if (x.vendas_ano_anterior !== undefined) e.pf.vendasAnoAnterior = x.vendas_ano_anterior;
    if (x.imoveis_alugados_ano_anterior !== undefined) e.pf.imoveisLocadosAnoAnterior = x.imoveis_alugados_ano_anterior;
    if (x.socios) e.pj.socios.quantidade = x.socios;
    if (e.operacao === 'venda' && !(v.valor > 0)) throw new Error('falta o valor de venda');
    if (e.operacao === 'locacao' && !(l.aluguel > 0)) throw new Error('falta o aluguel mensal');
    const out = Object.assign({cenario: x.rotulo || 'cenário'}, resumoImovel(e, M.imobiliario.calcular(e), false));
    if (x.todos_os_anos) out.resultado_por_ano = anosImovel(e);
    return out;
  }

  /* ===== Preencher a tela (só depois de a pessoa clicar em Aplicar) ===== */
  const $id = id => document.getElementById(id);
  function moeda(id, v) { $id(id).value = fmtNum.format(Number(v) || 0); }
  function marcarRadio(nome, valor) { const r = document.querySelector('input[name="' + nome + '"][value="' + valor + '"]'); if (!r) throw new Error('opção inválida'); r.checked = true; }
  const ROT_REG = {receita: 'Faturamento mensal', atividade: 'Atividade', margem: 'Lucro antes dos impostos (%)', folha: 'Folha mensal', compras: 'Compras com crédito (%)',
    semCompras: 'Não há compras com crédito', icms: 'ICMS (%)', iss: 'ISS (%)', fatorR: 'Atividade do Fator R', ano: 'Ano', periodo: 'Período (meses)',
    comprador: 'Quem compra', distribuir: 'Distribuir lucro aos sócios', socios: 'Número de sócios', pro_labore: 'Pró-labore por sócio'};
  const ROT_IMO = {operacao: 'Operação', ano: 'Ano', valor_venda: 'Valor de venda', custo_aquisicao: 'Custo de aquisição', aquisicao: 'Aquisição (AAAA-MM)', mes_venda: 'Mês da venda',
    tipo: 'Tipo de imóvel', aluguel_mensal: 'Aluguel mensal', imoveis: 'Imóveis alugados', despesas_mensais: 'Despesas mensais'};
  const MOEDA_REG = ['receita', 'folha', 'pro_labore'], MOEDA_IMO = ['valor_venda', 'custo_aquisicao', 'aluguel_mensal', 'despesas_mensais'];
  function aplicarRegimes(c) {
    const feitos = [], ignorados = [];
    const set = (k, f) => { if (c[k] === undefined) return; try { f(c[k]); feitos.push(k); } catch (err) { ignorados.push(k + ': ' + err.message); } };
    set('receita', v => moeda('receita', v)); set('folha', v => moeda('folha', v)); set('pro_labore', v => moeda('prolabore', v));
    set('margem', v => { $id('margem').value = v; }); set('compras', v => { $id('compras').value = v; }); set('icms', v => { $id('icms').value = v; }); set('iss', v => { $id('iss').value = v; });
    set('semCompras', v => { $id('semcompras').checked = !!v; });
    set('atividade', v => {
      if (enquadramentoTravado) throw new Error('travada pelo CNAE; destrave na tela');
      if (![...$id('atividade').options].some(o => o.value === v)) throw new Error('opção inválida');
      $id('atividade').value = v;
    });
    set('fatorR', v => { if ($id('fatorr').disabled) throw new Error('só vale para atividade do Anexo V'); $id('fatorr').checked = !!v; });
    set('ano', v => { $id('ano').value = String(v); }); set('periodo', v => { $id('periodo').value = String(v); });
    set('comprador', v => marcarRadio('comprador', v)); set('distribuir', v => marcarRadio('distribuir', v ? 'sim' : 'nao'));
    set('socios', v => { $id('socios').value = v; });
    if (modo() !== 'regimes') mostrarModo('regimes');
    atualizar();
    salvarRascunhoDepois();
    return {feitos, ignorados, ainda_faltam: [1, 2, 3, 4].flatMap(n => faltas(n).map(f => f[1]))};
  }
  function aplicarImovel(c) {
    const feitos = [], ignorados = [];
    const set = (k, f) => { if (c[k] === undefined) return; try { f(c[k]); feitos.push(k); } catch (err) { ignorados.push(k + ': ' + err.message); } };
    set('operacao', v => marcarRadio('im-operacao', v));
    set('ano', v => { $id('im-ano').value = String(v); });
    set('valor_venda', v => moeda('im-valor', v)); set('custo_aquisicao', v => moeda('im-custo', v));
    set('aquisicao', v => { if (!/^\d{4}-\d{2}$/.test(v)) throw new Error('use AAAA-MM'); $id('im-aquisicao').value = v; });
    set('mes_venda', v => { $id('im-mes').value = String(v); }); set('tipo', v => { $id('im-tipo').value = v; });
    set('aluguel_mensal', v => moeda('im-aluguel', v)); set('imoveis', v => { $id('im-imoveis').value = v; }); set('despesas_mensais', v => moeda('im-despesas', v));
    if (modo() !== 'imob') mostrarModo('imob');
    window.ImobUI.atualizar();
    return {feitos, ignorados, ainda_faltam: window.ImobUI.faltas().map(f => f[1])};
  }

  /* ===== Interface: botão no topo e painel lateral (não cobre a tela até ser aberto) ===== */
  const css = `
  .asst-abrir{background:var(--gold);color:var(--ink);border:0;border-radius:9px;padding:8px 14px;min-height:40px;cursor:pointer;font-weight:700;font-size:13.5px}
  .asst-abrir:hover{background:#dbb53a}.asst-abrir:focus-visible{outline:3px solid #fff;outline-offset:2px}
  .asst-painel{position:fixed;top:0;right:0;bottom:0;z-index:60;width:min(420px,100vw);display:flex;flex-direction:column;background:var(--card);color:var(--ink);border-left:1px solid var(--line2);box-shadow:-8px 0 30px rgba(20,33,61,.18)}
  .asst-painel[hidden]{display:none}
  .asst-topo{display:flex;align-items:center;gap:6px;padding:12px 14px;background:var(--ink);color:#fff;border-bottom:3px solid var(--gold)}
  .asst-topo h2{flex:1;margin:0;font-size:16px;color:#fff}
  .asst-topo button{border:1px solid rgba(255,255,255,.4);background:none;color:#fff;cursor:pointer;font-size:13px;padding:6px 10px;border-radius:8px;min-height:36px}
  .asst-topo button:focus-visible{outline:3px solid #fff;outline-offset:1px}
  .asst-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.5;background:var(--bg)}
  .asst-m{max-width:92%;padding:9px 12px;border-radius:12px;overflow-wrap:anywhere}
  .asst-u{align-self:flex-end;background:var(--ink);color:#fff}
  .asst-a{align-self:flex-start;background:#fff;border:1px solid var(--line)}
  .asst-a p{margin:0 0 6px}.asst-a p:last-child{margin:0}.asst-a ul,.asst-a ol{margin:4px 0;padding-left:18px}
  .asst-a table{border-collapse:collapse;font-size:12.5px;margin:6px 0;width:100%}.asst-a td,.asst-a th{border:1px solid var(--line);padding:3px 6px;text-align:left}
  .asst-nota{align-self:center;font-size:12px;color:var(--mut)}
  .asst-card{align-self:stretch;border:1px solid var(--gold);background:var(--gold-soft);border-radius:12px;padding:10px 12px;font-size:13.5px}
  .asst-card ul{margin:6px 0;padding-left:18px}.asst-card .acoes{display:flex;gap:8px;align-items:center;margin-top:8px}
  .asst-card button{border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;border:1px solid var(--ink);min-height:38px}
  .asst-card .sim{background:var(--ink);color:#fff}.asst-card .nao{background:#fff;color:var(--ink)}
  .asst-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line);background:#fff}
  .asst-form textarea{flex:1;resize:none;height:48px;border:1px solid var(--campo);border-radius:10px;padding:10px;font:inherit;font-size:14px;line-height:1.35;color:inherit}
  .asst-form textarea:focus{outline:3px solid var(--foco);outline-offset:1px}
  .asst-form button{border:0;border-radius:10px;padding:0 16px;background:var(--ink);color:#fff;font-weight:700;font-size:14px;cursor:pointer;min-height:48px}
  .asst-form button:disabled{background:#8e97a8;cursor:default}
  .asst-rodape{font-size:11.5px;color:var(--mut);padding:0 12px 10px;background:#fff}
  @media (min-width:1200px){body.asst-aberto{padding-right:420px}}
  @media print{.asst-abrir,.asst-painel{display:none!important}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'asst-abrir'; btn.id = 'btn-assistente'; btn.textContent = 'Assistente IA';
  btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'asst-painel');
  btn.hidden = !CFG.url;
  const topo = document.querySelector('.topo-in');
  topo.insertBefore(btn, document.getElementById('btn-trocar'));
  const painel = document.createElement('aside');
  painel.className = 'asst-painel'; painel.id = 'asst-painel'; painel.hidden = true;
  painel.setAttribute('aria-labelledby', 'asst-titulo');
  painel.innerHTML = `
    <div class="asst-topo"><h2 id="asst-titulo">Assistente tributário</h2><button type="button" data-a="novo">Nova conversa</button><button type="button" data-a="fechar" aria-label="Fechar o assistente">Fechar</button></div>
    <div class="asst-msgs" role="log" aria-live="polite"></div>
    <form class="asst-form"><textarea rows="2" placeholder="Pergunte sobre o resultado, a lei ou peça ajuda para preencher" aria-label="Sua pergunta"></textarea><button type="submit">Enviar</button></form>
    <p class="asst-rodape">Perguntas processadas pela API da Anthropic. Os números vêm do motor da calculadora; CNPJ e nome não são enviados. Não substitui o contador.</p>`;
  document.body.appendChild(painel);
  const msgs = painel.querySelector('.asst-msgs');
  const form = painel.querySelector('form');
  const campo = form.querySelector('textarea');
  const enviar = form.querySelector('button');

  const escH = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const inline = s => escH(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  function markdown(txt) {
    const ls = String(txt).split('\n'); let h = '', i = 0;
    while (i < ls.length) {
      const l = ls[i];
      if (/^\s*\|/.test(l)) {
        const t = []; while (i < ls.length && /^\s*\|/.test(ls[i])) t.push(ls[i++]);
        const rows = t.filter(x => !/^\s*\|[\s:|-]+\|\s*$/.test(x)).map(x => x.trim().replace(/^\||\|$/g, '').split('|'));
        h += '<table>' + rows.map((c, n) => '<tr>' + c.map(v => n === 0 ? `<th>${inline(v.trim())}</th>` : `<td>${inline(v.trim())}</td>`).join('') + '</tr>').join('') + '</table>';
        continue;
      }
      if (/^\s*[-*] /.test(l)) { let li = ''; while (i < ls.length && /^\s*[-*] /.test(ls[i])) li += `<li>${inline(ls[i++].replace(/^\s*[-*] /, ''))}</li>`; h += `<ul>${li}</ul>`; continue; }
      if (/^\s*\d+[.)] /.test(l)) { let li = ''; while (i < ls.length && /^\s*\d+[.)] /.test(ls[i])) li += `<li>${inline(ls[i++].replace(/^\s*\d+[.)] /, ''))}</li>`; h += `<ol>${li}</ol>`; continue; }
      if (l.trim()) h += `<p>${inline(l.replace(/^#+\s*/, ''))}</p>`;
      i++;
    }
    return h;
  }
  function bolha(tipo, conteudo, html) {
    const d = document.createElement('div');
    d.className = 'asst-m ' + (tipo === 'u' ? 'asst-u' : 'asst-a');
    if (html) d.innerHTML = conteudo; else d.textContent = conteudo;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
  }
  function nota(t) { const d = document.createElement('div'); d.className = 'asst-nota'; d.textContent = t; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; }
  function confirmar(campos, rotulos, moedas, justificativa) {
    return new Promise(resolve => {
      const card = document.createElement('div'); card.className = 'asst-card';
      const itens = Object.entries(campos).map(([k, v]) => {
        const val = moedas.includes(k) ? fmtBRL.format(Number(v) || 0) : typeof v === 'boolean' ? (v ? 'sim' : 'não') : v;
        return `<li>${escH(rotulos[k] || k)}: <strong>${escH(val)}</strong></li>`;
      }).join('');
      card.innerHTML = `<div><strong>Preencher a calculadora com estes valores?</strong></div>${justificativa ? `<div>${escH(justificativa)}</div>` : ''}<ul>${itens}</ul><div class="acoes"><button type="button" class="sim">Aplicar</button><button type="button" class="nao">Agora não</button></div>`;
      msgs.appendChild(card); msgs.scrollTop = msgs.scrollHeight;
      card.querySelector('.sim').focus();
      const fim = ok => { card.querySelectorAll('button').forEach(b => { b.disabled = true; }); card.querySelector('.acoes').insertAdjacentHTML('beforeend', `<span>${ok ? 'Aplicado.' : 'Não aplicado.'}</span>`); resolve(ok); };
      card.querySelector('.sim').addEventListener('click', () => fim(true));
      card.querySelector('.nao').addEventListener('click', () => fim(false));
    });
  }

  /* ===== Conversa ===== */
  let historico = [], ocupado = false;
  function aparar() {
    // Corta sempre numa pergunta de texto do usuário, para nunca separar um tool_use do seu tool_result
    if (historico.length <= 30) return;
    for (let i = historico.length - 30; i < historico.length; i++) {
      if (historico[i].role === 'user' && typeof historico[i].content === 'string') { historico = historico.slice(i); return; }
    }
  }
  async function chamarWorker() {
    const h = {'Content-Type': 'application/json'};
    if (CFG.codigo) h['X-Codigo-Acesso'] = CFG.codigo;
    const r = await fetch(CFG.url, {method: 'POST', headers: h, body: JSON.stringify({messages: historico})});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'Falha ao falar com o assistente (' + r.status + ').');
    return j;
  }
  async function executar(b) {
    try {
      const inp = b.input || {};
      if (b.name === 'ler_tela') { nota('Lendo a calculadora…'); return lerTela(); }
      if (b.name === 'simular_regimes') { nota('Simulando: ' + (inp.rotulo || 'cenário') + '…'); return simularRegimes(inp); }
      if (b.name === 'simular_imovel') { nota('Simulando: ' + (inp.rotulo || 'cenário') + '…'); return simularImovel(inp); }
      if (b.name === 'preencher_regimes' || b.name === 'preencher_imovel') {
        const c = inp.campos || {};
        if (!Object.keys(c).length) throw new Error('nenhum campo informado');
        const reg = b.name === 'preencher_regimes';
        const ok = await confirmar(c, reg ? ROT_REG : ROT_IMO, reg ? MOEDA_REG : MOEDA_IMO, inp.justificativa);
        if (!ok) return {aplicado: false, motivo: 'A pessoa preferiu não aplicar.'};
        return Object.assign({aplicado: true}, reg ? aplicarRegimes(c) : aplicarImovel(c), {tela: lerTela()});
      }
      throw new Error('ferramenta desconhecida: ' + b.name);
    } catch (err) { return {erro: String(err.message || err)}; }
  }
  async function perguntar(texto) {
    ocupado = true; enviar.disabled = true;
    historico.push({role: 'user', content: texto}); aparar();
    const pensando = nota('Pensando…');
    try {
      for (let rodada = 0; rodada < CFG.maxRodadas; rodada++) {
        const resp = await chamarWorker();
        historico.push({role: 'assistant', content: resp.content});
        const txt = resp.content.filter(x => x.type === 'text').map(x => x.text).join('\n').trim();
        if (txt) bolha('a', markdown(txt), true);
        if (resp.stop_reason !== 'tool_use') break;
        const resultados = [];
        for (const b of resp.content.filter(x => x.type === 'tool_use')) {
          const out = await executar(b);
          resultados.push({type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out), is_error: !!out.erro});
        }
        historico.push({role: 'user', content: resultados});
        if (rodada === CFG.maxRodadas - 1) bolha('a', 'Parei aqui para não entrar em ciclo. Reformule a pergunta, por favor.');
      }
    } catch (err) {
      while (historico.length && historico[historico.length - 1].role === 'user') historico.pop();
      bolha('a', escH(err.message || 'Erro inesperado.'), true);
    } finally {
      pensando.remove(); ocupado = false; enviar.disabled = false; campo.focus();
    }
  }
  function abrir(v) {
    painel.hidden = !v; btn.setAttribute('aria-expanded', String(v));
    document.body.classList.toggle('asst-aberto', v);
    if (v) {
      if (!msgs.childElementCount) bolha('a', markdown('Olá! Posso **explicar o resultado** da tela, **comparar regimes** em outros cenários e anos, **tirar dúvidas** de lei (com o artigo) ou **ajudar a preencher**. Funciona nas duas calculadoras: regimes da empresa e imobiliário.'), true);
      campo.focus();
    }
  }
  btn.addEventListener('click', () => abrir(painel.hidden));
  painel.addEventListener('click', e => {
    const a = e.target.closest('button[data-a]'); if (!a) return;
    if (a.dataset.a === 'fechar') { abrir(false); btn.focus(); }
    if (a.dataset.a === 'novo' && !ocupado) { historico = []; msgs.innerHTML = ''; abrir(true); }
  });
  painel.addEventListener('keydown', e => { if (e.key === 'Escape') { abrir(false); btn.focus(); } });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const t = campo.value.trim(); if (!t || ocupado) return;
    campo.value = ''; bolha('u', t); perguntar(t);
  });
  campo.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

  window.__assistente = {lerTela, simularRegimes, simularImovel, aplicarRegimes, aplicarImovel, markdown};
})();
