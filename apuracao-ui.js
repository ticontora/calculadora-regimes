/*
 * Tela do Gestor de Apuração Assistida. A lógica fica em motor/apuracao.js; aqui só tela, estado e armazenamento.
 * Os dados importados ficam neste navegador (localStorage). Nada é enviado para servidor.
 */
(function () {
  'use strict';
  const A = window.Motor && window.Motor.apuracao;
  if (!A) return;

  /* ===== Utilitários ===== */
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const fmtBRL = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
  const brl = v => fmtBRL.format(v || 0);
  const brlCurto = v => Math.abs(v) >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + ' mi' : Math.abs(v) >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + ' mil' : brl(v);
  const pct = v => Math.round((v || 0) * 100) + '%';
  const dBR = d => d ? d.split('-').reverse().join('/') : '—';
  const compBR = c => c ? c.slice(5) + '/' + c.slice(0, 4) : '—';
  const chaveCurta = c => c ? c.slice(0, 6) + '…' + c.slice(-6) : '—';
  const cnpjFmt = c => c && c.length === 14 ? c.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5') : (c || '—');
  const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const TRIB = {cbs: 'CBS', ibs: 'IBS', total: 'CBS + IBS'};
  const NIVEL = {ok: ['Em dia', 'ok'], no_prazo: ['No prazo', 'mut'], atencao: ['Atenção', 'warn'], vencido: ['Vencido', 'bad'], critico: ['Crítico', 'bad forte']};
  const COR_SIT = {aguardando: 'mut', pendente: 'warn', apropriado_parcial: 'info', apropriado_total: 'ok', nao_extinto: 'warn', extinto_parcial: 'info', extinto: 'ok'};
  const ST_FILA = {aguardando_decisao: ['Aguardando decisão', 'warn'], pronta: ['Pronta', 'info'], bloqueada: ['Bloqueada', 'bad'], concluida: ['Concluída', 'ok'], descartada: ['Descartada', 'mut']};
  const ORIGEM = {padrao: 'Padrão', padrao_ajustavel: 'Padrão ajustável', customizada: 'Customizada'};
  const chip = (t, cls) => '<span class="aa-chip ' + (cls || '') + '">' + esc(t) + '</span>';
  const POR_PAGINA = 25;

  /* ===== Armazenamento (só neste navegador) ===== */
  const K_DADOS = 'calc-regimes:apuracao:dados:v1', K_CONF = 'calc-regimes:apuracao:config:v1';
  const ls = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  function ler(k) { try { const t = ls && ls.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function gravar(k, v) { try { if (!ls) return false; ls.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function dadosVazios() { return {xml: [], fisco: [], erp: [], dataExtrato: '', arquivos: [], demo: false}; }
  function confPadrao() {
    return {cfg: Object.assign({}, A.PADROES), regras: clone(A.REGRAS_PADRAO), empresas: [], autorizados: {}, tetos: {},
      decisoes: {}, concluidas: {}, saldos: {}, filtrosSalvos: [], avisos: {}, dataBase: '', tributo: 'cbs'};
  }
  let dados = Object.assign(dadosVazios(), ler(K_DADOS) || {});
  let conf = Object.assign(confPadrao(), ler(K_CONF) || {});
  conf.cfg = Object.assign({}, A.PADROES, conf.cfg);
  A.REGRAS_PADRAO.forEach(r => { if (!conf.regras.some(x => x.id === r.id)) conf.regras.push(clone(r)); });
  function salvarConf() { gravar(K_CONF, conf); }
  function salvarDados() {
    const ok = gravar(K_DADOS, dados);
    if (!ok) msg('Os dados importados não couberam no armazenamento do navegador: valem só até fechar a página.', 'bad');
    return ok;
  }

  /* ===== Estado da tela ===== */
  const S = {aba: 'visao', lado: 'credito', saldoDet: false, parConc: 'xml', ladoConc: 'credito', grupoConc: '',
    filaStatus: '', filaTrat: '', sel: new Set(), pagina: {docs: 1, conc: 1, fila: 1}, busca: {docs: '', conc: '', fila: ''},
    cfgAba: 'regras', empRad: '', filtro: {}, ordem: {docs: 'aging'}};
  let X = null; // resultado do último cálculo

  function cfgPara(comp) { const c = conf.concluidas[comp]; return c && c.cfg ? c.cfg : conf.cfg; }
  function calcular() {
    const dataBase = conf.dataBase || hoje();
    const b = A.montarBase(dados, conf.empresas);
    if (b.novasEmpresas.length || b.empresas.length !== conf.empresas.length) {
      conf.empresas = b.empresas.map(e => ({base: e.base, cnpj: e.cnpj, nome: e.nome, regime: e.regime || 'regular'}));
      salvarConf();
    }
    const t = conf.tributo;
    const enr = b.docs.map(d => A.enriquecer(d, t, cfgPara(d.competencia), dataBase));
    const exec = A.executar({docs: b.docs, regras: conf.regras, cfg: conf.cfg, dataBase, decisoes: conf.decisoes,
      autorizados: conf.autorizados, tetos: conf.tetos, empresas: conf.empresas});
    const filtrados = A.filtrar(enr, S.filtro);
    const ids = new Set(filtrados.map(d => d.id));
    const alertas = A.alertas({docsEnr: filtrados, cfg: conf.cfg, dataBase, dataExtrato: dados.dataExtrato, execucao: exec,
      semEmpresa: b.semEmpresa, concluidas: conf.concluidas, avisos: conf.avisos});
    const comps = [...new Set(enr.map(d => d.competencia).filter(Boolean))].sort();
    X = {dataBase, base: b, enr, filtrados, ids, exec, alertas, comps, t};
  }
  const nomeEmpresa = base => { const e = conf.empresas.find(x => x.base === base); return e ? e.nome : base; };
  function msg(t, tipo) { const m = $('aa-msg'); if (!m) return; m.className = 'status' + (tipo ? ' ' + tipo : ''); m.textContent = t; }
  function baixar(nome, texto, tipo) {
    const blob = new Blob(['﻿' + texto], {type: (tipo || 'text/csv') + ';charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ===== Moldura: cabeçalho, chips de filtro, alertas, abas ===== */
  function render() {
    calcular();
    const sub = $('aa-sub');
    const nDocs = X.enr.length;
    sub.innerHTML = nDocs
      ? esc(conf.empresas.length + ' empresa(s) · ' + nDocs + ' documento(s) · data-base ' + dBR(X.dataBase) +
        (dados.dataExtrato ? ' · extrato de ' + dBR(dados.dataExtrato) : '')) + (dados.demo ? ' ' + chip('Dados de demonstração (fictícios)', 'warn') : '')
      : 'Importe os XMLs, o extrato da apuração e, se tiver, a exportação do ERP. Ou carregue a demonstração.';
    const sel = $('aa-comp');
    sel.innerHTML = '<option value="">Todas</option>' + X.comps.slice().reverse().map(c => '<option value="' + c + '"' + (S.filtro.competencia === c ? ' selected' : '') + '>' + compBR(c) + '</option>').join('');
    $('aa-trib').value = conf.tributo;
    renderChips();
    $('aa-alertas').innerHTML = X.alertas.map(a => '<p class="aa-alerta ' + a.nivel + '">' + esc(a.texto) + '</p>').join('');
    document.querySelectorAll('#main-apuracao .aa-abas [data-aba]').forEach(b => {
      const at = b.dataset.aba === S.aba; b.classList.toggle('ativa', at); b.setAttribute('aria-selected', at ? 'true' : 'false');
    });
    const c = $('aa-conteudo');
    if (!nDocs && S.aba !== 'importar' && S.aba !== 'config') { c.innerHTML = vazio(); return; }
    c.innerHTML = ({visao: renderVisao, docs: renderDocs, conc: renderConc, fila: renderFila, config: renderConfig, importar: renderImportar}[S.aba])();
  }
  function vazio() {
    return '<section class="card aa-vazio"><h3>Nenhum dado ainda</h3><p>Esta seção não acessa a Receita. Ela trabalha com três arquivos que você importa: ' +
      'os <b>XMLs das NF-e</b> da carteira, o <b>extrato da apuração assistida</b> (CSV) e, se quiser, a <b>exportação do ERP</b>.</p>' +
      '<div class="acoes"><button class="btn" data-acao="aba" data-v="importar">Importar dados</button>' +
      '<button class="btn-secundario" data-acao="demo">Carregar demonstração</button></div></section>';
  }
  function renderChips() {
    const f = S.filtro, ch = [];
    if (f.empresas && f.empresas.length) ch.push(['empresas', 'Empresa: ' + f.empresas.map(nomeEmpresa).join(', ')]);
    if (f.fornecedor) ch.push(['fornecedor', 'Contraparte: ' + f.fornecedor]);
    if (f.situacoes && f.situacoes.length) ch.push(['situacoes', 'Situação: ' + f.situacoes.map(s => A.ROTULO_SITUACAO[s]).join(', ')]);
    if (f.niveis && f.niveis.length) ch.push(['niveis', 'Prazo: ' + f.niveis.map(n => NIVEL[n][0]).join(', ')]);
    if (f.valorMin || f.valorMax) ch.push(['valor', 'Valor: ' + (f.valorMin || '0') + ' a ' + (f.valorMax || '∞')]);
    if (f.agingMin || f.agingMax) ch.push(['aging', 'Aging: ' + (f.agingMin || '0') + ' a ' + (f.agingMax || '∞') + ' dias']);
    if (f.chave) ch.push(['chave', 'Chave: ' + f.chave]);
    if (f.competencia) ch.push(['competencia', 'Competência: ' + compBR(f.competencia)]);
    $('aa-nfiltro').textContent = ch.length ? '(' + ch.length + ')' : '';
    $('aa-chips').innerHTML = ch.length ? ch.map(c => '<button type="button" class="aa-fchip" data-acao="tirar-filtro" data-v="' + c[0] + '">' + esc(c[1]) + ' <span aria-hidden="true">×</span><span class="sr">remover</span></button>').join('') +
      '<button type="button" class="aa-link" data-acao="limpar-filtro">Limpar filtros</button>' : '';
  }

  /* ===== Visão geral ===== */
  function renderVisao() {
    const docs = X.filtrados, t = X.t;
    const comp = S.filtro.competencia || X.dataBase.slice(0, 7);
    const emp = S.filtro.empresas && S.filtro.empresas.length === 1 ? S.filtro.empresas[0] : '';
    const manual = emp ? (conf.saldos[emp + '|' + comp] || {}) : somaSaldos(comp);
    const s = A.saldoApuracao(docs, comp, t, manual);
    const r = A.resumoLado(docs, S.lado, cfgPara(comp));
    const cred = S.lado === 'credito';
    let h = '';
    // Saldo
    h += '<section class="card"><div class="aa-cardcab"><h3>Saldo da apuração · ' + compBR(comp) + ' · ' + TRIB[t] + '</h3>' +
      seg('saldo-det', [['0', 'Resumo'], ['1', 'Detalhes']], S.saldoDet ? '1' : '0') + '</div>';
    if (!S.saldoDet) {
      h += '<div class="aa-saldo"><span class="v ' + (s.saldo < 0 ? 'neg' : '') + '">' + brl(Math.abs(s.saldo)) + '</span><span class="r">Saldo ' + s.natureza + ' (reconstituído do extrato)</span>' +
        (s.bate == null ? chip('Informe o saldo do Fisco em Detalhes para conferir', 'mut') : s.bate ? chip('Bate com o saldo informado pelo Fisco', 'ok') : chip('Não bate com o Fisco: diferença de ' + brl(s.informado - s.saldo), 'bad')) + '</div>';
    } else {
      const inp = (k, v) => emp ? '<input class="aa-inp-num" inputmode="decimal" data-saldo="' + k + '" value="' + esc(v == null ? '' : String(v).replace('.', ',')) + '" aria-label="' + k + '">' : brl(v);
      h += '<div class="tablewrap"><table class="aa-tbl aa-comp"><tbody>' +
        '<tr><td>+</td><td>Saldo anterior transportado</td><td class="n">' + inp('anterior', manual.anterior || 0) + '</td></tr>' +
        '<tr><td>+</td><td>Créditos apropriados no período</td><td class="n">' + brl(s.creditos) + '</td></tr>' +
        '<tr><td>−</td><td>Débitos do período</td><td class="n">' + brl(s.debitos) + '</td></tr>' +
        '<tr><td>−</td><td>Redutores</td><td class="n">' + inp('redutores', manual.redutores || 0) + '</td></tr>' +
        '<tr class="tot"><td>=</td><td>Saldo da competência (' + s.natureza + ')</td><td class="n">' + brl(s.saldo) + '</td></tr>' +
        '<tr><td></td><td>Saldo informado pelo Fisco</td><td class="n">' + inp('informado', manual.informado == null ? '' : manual.informado) + '</td></tr>' +
        '</tbody></table></div>' +
        '<p class="aa-nota">' + (emp ? 'Saldo anterior, redutores e saldo do Fisco são digitados por você (o extrato por nota não traz esses totais).'
          : 'Filtre uma única empresa para digitar saldo anterior, redutores e o saldo do Fisco. Com várias empresas, os valores são somados.') + '</p>';
    }
    h += '</section>';
    // Carteira (contador): uma linha por empresa
    if (conf.empresas.length > 1 && !(S.filtro.empresas && S.filtro.empresas.length === 1)) h += renderCarteira();
    // Créditos / débitos
    h += '<section class="card"><div class="aa-cardcab"><h3>' + (cred ? 'Seus créditos' : 'Seus débitos') + '</h3>' + seg('lado', [['credito', 'Créditos'], ['debito', 'Débitos']], S.lado) + '</div>' +
      '<p class="aa-tot"><span class="r">' + (cred ? 'Apropriável total' : 'Débito total') + '</span> <b>' + brl(r.total) + '</b></p>' +
      '<div class="aa-barra" role="img" aria-label="' + pct(r.percentual) + ' ' + (cred ? 'apropriado' : 'extinto') + '"><i style="width:' + Math.min(100, r.percentual * 100) + '%"></i></div>' +
      '<p class="aa-nota">' + (cred ? 'Apropriação' : 'Extinção') + ': <b>' + pct(r.percentual) + '</b> do valor · ' + r.docsConcluidos + ' de ' + r.docs + ' documentos</p>' +
      '<div class="aa-baldes">' +
      balde('vencido', cred ? 'Pendentes (vencidos)' : 'Não extintos (vencidos)', r.vencidos, 'bad', '+' + cfgPara(comp).prazoRecolhimentoDias + ' dias da emissão') +
      balde('no_prazo', cred ? 'Pendentes (no prazo)' : 'Não extintos (no prazo)', r.noPrazo, 'warn', '') +
      balde('aguardando', 'Aguardando processamento', r.processando, 'mut', 'na sua base, ainda não no extrato') +
      balde('concluido', cred ? 'Apropriado' : 'Extinto', r.concluidos, 'ok', '') + '</div></section>';
    // Top contrapartes e aging
    const top = A.topContrapartes(docs, S.lado, 5);
    const comps = []; for (let i = 4; i >= 0; i--) comps.push(A.compSomar(X.dataBase.slice(0, 7), -i));
    const m = A.matrizAging(docs, S.lado, comps);
    const max = Math.max(1, ...top.map(x => x.valor));
    h += '<div class="aa-grid2"><section class="card"><div class="aa-cardcab"><h3>' + (cred ? 'Fornecedores que mais travam crédito' : 'Clientes com débito em aberto') + '</h3></div>' +
      (top.length ? '<ul class="aa-top">' + top.map(x => '<li><button type="button" class="aa-top-b" data-acao="filtrar-forn" data-v="' + esc(x.cnpj) + '"><span class="n">' + esc(x.nome || cnpjFmt(x.cnpj)) + '</span><b>' + brl(x.valor) + '</b>' +
        '<span class="aa-mini"><i style="width:' + (x.valor / max * 100) + '%"></i></span><small>' + x.docs + ' docs · até ' + x.maxAging + ' dias</small></button></li>').join('') + '</ul>' : '<p class="aa-nota">Nada pendente.</p>') +
      '</section><section class="card"><div class="aa-cardcab"><h3>Aging do pendente</h3></div>' +
      '<p class="aa-tot"><b>' + brl(m.total) + '</b> <span class="r">' + m.docs + ' documentos</span></p>' + heat(m) + '</section></div>';
    // Farol e projeção
    h += '<div class="aa-grid2">' + farol(docs) + projecaoHtml(docs) + '</div>';
    // Competências
    h += competenciasHtml();
    return h;
  }
  function somaSaldos(comp) {
    const lista = (S.filtro.empresas && S.filtro.empresas.length ? S.filtro.empresas : conf.empresas.map(e => e.base)).map(b => conf.saldos[b + '|' + comp] || {});
    const soma = k => lista.reduce((s, x) => s + A.numero(x[k]), 0);
    const temInf = lista.length && lista.every(x => x.informado !== '' && x.informado != null);
    return {anterior: soma('anterior'), redutores: soma('redutores'), informado: temInf ? soma('informado') : null};
  }
  function seg(nome, opcoes, atual) {
    return '<div class="aa-seg" role="group">' + opcoes.map(o => '<button type="button" data-acao="seg" data-seg="' + nome + '" data-v="' + o[0] + '" aria-pressed="' + (o[0] === atual) + '">' + o[1] + '</button>').join('') + '</div>';
  }
  function balde(k, rot, b, cls, dica) {
    return '<button type="button" class="aa-balde ' + cls + '" data-acao="balde" data-v="' + k + '"><span class="r">' + rot + '</span><b>' + brl(b.valor) + '</b><small>' + b.docs + ' documentos' + (dica ? ' · ' + dica : '') + '</small></button>';
  }
  function heat(m) {
    const max = Math.max(1, ...m.linhas.flatMap(l => l.valores));
    return '<div class="tablewrap"><table class="aa-heat"><thead><tr><th>Faixa</th>' + m.competencias.map(c => '<th>' + compBR(c) + '</th>').join('') + '</tr></thead><tbody>' +
      m.linhas.map((l, i) => '<tr><th>' + l.rotulo + '</th>' + l.valores.map(v => '<td style="--a:' + (v ? (0.12 + 0.75 * v / max).toFixed(2) : 0) + '" class="' + (i >= 3 ? 'q' : '') + '">' + (v ? brlCurto(v) : '—') + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }
  // Conciliação com o ERP só faz sentido nas empresas que têm exportação do ERP importada
  function docsPar(docs, par) {
    if (par !== 'erp') return docs;
    const comErp = new Set(docs.filter(d => d.erp).map(d => d.empresa.base));
    return docs.filter(d => comErp.has(d.empresa.base));
  }
  function farol(docs0) {
    const linha = (rot, par) => {
      const docs = docsPar(docs0, par);
      const c1 = A.conciliar(docs, par, 'credito', conf.cfg.tolerancia), c2 = A.conciliar(docs, par, 'debito', conf.cfg.tolerancia);
      const tot = c1.total + c2.total, ok = c1.grupos.conciliado.length + c2.grupos.conciliado.length, p = tot ? ok / tot : 0;
      const pend = tot - ok, cls = !tot ? 'mut' : p >= 0.95 ? 'ok' : p >= 0.8 ? 'warn' : 'bad';
      return '<button type="button" class="aa-farol" data-acao="ver-conc" data-v="' + par + '"><span class="r"><i class="dot ' + cls + '"></i>' + rot + '</span><b>' + (tot ? pct(p) + ' conciliado' : 'sem dados') + '</b>' +
        '<span class="aa-barra ' + cls + '"><i style="width:' + p * 100 + '%"></i></span><small>' + pend + ' pendência(s)' + (par === 'erp' ? ' · só empresas com ERP importado' : '') + '</small></button>';
    };
    return '<section class="card"><div class="aa-cardcab"><h3>Farol de conciliação</h3></div>' + linha('Sua base (XML) × Apuração', 'xml') + linha('ERP × Apuração', 'erp') + '</section>';
  }
  function projecaoHtml(docs) {
    const p = A.projecao(docs, X.t, X.dataBase, 3, 3);
    const cols = p.realizado.map(x => ({c: x.competencia, a: x.realizado, b: 0, real: true})).concat(p.projetado.map(x => ({c: x.competencia, a: x.tendencia, b: x.aApropriar, real: false})));
    const max = Math.max(1, ...cols.map(x => x.a + x.b));
    return '<section class="card"><div class="aa-cardcab"><h3>Projeção de apropriação</h3></div>' +
      '<p class="aa-tot"><b>' + brl(p.total) + '</b> <span class="r">até ' + compBR(p.projetado[p.projetado.length - 1].competencia) + '</span></p>' +
      '<div class="aa-graf">' + cols.map(x => '<div class="col"><div class="pilha" style="height:' + ((x.a + x.b) / max * 120).toFixed(0) + 'px">' +
        (x.b ? '<i class="b" style="flex:' + x.b + '"></i>' : '') + '<i class="' + (x.real ? 'r' : 'p') + '" style="flex:' + Math.max(x.a, 0.0001) + '"></i></div>' +
        '<small>' + brlCurto(x.a + x.b) + '</small><span>' + compBR(x.c) + '</span></div>').join('') + '</div>' +
      '<p class="aa-leg"><i class="r"></i>Realizado <i class="p"></i>Tendência (média dos 3 últimos meses) <i class="b"></i>A apropriar (pendente hoje)</p>' +
      '<p class="aa-nota">Estimativa simples, não previsão: a tendência repete a média recente e o "a apropriar" supõe que o pendente de hoje entra no mês seguinte.</p></section>';
  }
  function competenciasHtml() {
    const atual = X.dataBase.slice(0, 7), lista = [];
    for (let i = 3; i >= 0; i--) lista.push(A.compSomar(atual, -i));
    const cards = lista.map(c => {
      const ds = X.filtrados.filter(d => d.competencia === c);
      const est = A.estadoCompetencia(c, X.dataBase, conf.cfg, conf.concluidas);
      const pend = ds.filter(d => !A.concluido(d.situacao)).length;
      const cr = ds.filter(d => d.lado === 'credito').reduce((s, d) => s + d.potencial, 0), db = ds.filter(d => d.lado === 'debito').reduce((s, d) => s + d.potencial, 0);
      const cls = {concluida: 'ok', corrente: 'info', em_ajuste: 'warn', encerrada: 'mut', futura: 'mut'}[est.estado];
      const podeConcluir = est.estado === 'em_ajuste' || est.estado === 'encerrada';
      return '<div class="aa-compcard ' + (est.estado === 'corrente' ? 'atual' : '') + '"><div class="aa-cardcab"><b>' + compBR(c) + '</b>' + chip(est.rotulo + (est.estado === 'em_ajuste' ? ' · ' + est.diasRestantes + 'd' : ''), cls) + '</div>' +
        '<p><span>Créditos</span><b>' + brl(cr) + '</b></p><p><span>Débitos</span><b>' + brl(db) + '</b></p>' +
        (pend ? '<button type="button" class="aa-link" data-acao="ver-comp" data-v="' + c + '">' + pend + ' pendência(s) →</button>' : '<small>Sem pendências</small>') +
        (podeConcluir ? '<button type="button" class="aa-link" data-acao="concluir-comp" data-v="' + c + '">Concluir competência</button>' : '') +
        (est.estado === 'concluida' ? '<button type="button" class="aa-link" data-acao="reabrir-comp" data-v="' + c + '">Reabrir</button>' : '') + '</div>';
    });
    return '<section class="card"><div class="aa-cardcab"><h3>Apurações por competência</h3></div><div class="aa-comps">' + cards.join('') + '</div>' +
      '<p class="aa-nota">Concluir guarda os prazos e parâmetros com que a competência fechou. A confirmação da apuração em si é feita no portal do Fisco.</p></section>';
  }
  function renderCarteira() {
    const linhas = conf.empresas.map(e => {
      const ds = X.enr.filter(d => d.empresa.base === e.base);
      const r = A.resumoLado(ds, 'credito', conf.cfg);
      const div = A.conciliar(ds, 'xml', 'credito', conf.cfg.tolerancia).grupos.divergente.length;
      const prontas = X.exec.acoes.filter(a => a.doc.empresa.base === e.base && (a.status === 'aguardando_decisao' || a.status === 'pronta')).length;
      return {e, r, div, prontas};
    }).sort((a, b) => b.r.vencidos.valor - a.r.vencidos.valor);
    return '<section class="card"><div class="aa-cardcab"><h3>Carteira de clientes</h3><small class="aa-nota">Clique para filtrar a empresa</small></div><div class="tablewrap"><table class="aa-tbl"><thead><tr>' +
      '<th>Empresa</th><th class="n">Crédito potencial</th><th class="n">Apropriado</th><th class="n">Pendente vencido</th><th class="n">Divergências</th><th class="n">Ações abertas</th></tr></thead><tbody>' +
      linhas.map(l => '<tr class="clica" tabindex="0" data-acao="filtrar-emp" data-v="' + l.e.base + '"><td><b>' + esc(l.e.nome) + '</b><br><small>' + esc(l.e.base) + (l.e.regime === 'simples' ? ' · Simples' : '') + '</small></td>' +
        '<td class="n">' + brl(l.r.total) + '</td><td class="n">' + pct(l.r.percentual) + '</td><td class="n ' + (l.r.vencidos.valor ? 'bad' : '') + '">' + brl(l.r.vencidos.valor) + '</td>' +
        '<td class="n">' + l.div + '</td><td class="n">' + l.prontas + '</td></tr>').join('') + '</tbody></table></div></section>';
  }

  /* ===== Créditos e débitos ===== */
  function paginar(lista, chaveP) {
    const tot = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    S.pagina[chaveP] = Math.min(Math.max(1, S.pagina[chaveP]), tot);
    const p = S.pagina[chaveP];
    return {itens: lista.slice((p - 1) * POR_PAGINA, p * POR_PAGINA),
      nav: '<div class="aa-pag"><span>' + lista.length + ' resultado(s)</span>' + (tot > 1 ? '<button type="button" class="btn-secundario" data-acao="pag" data-p="' + chaveP + '" data-v="-1"' + (p === 1 ? ' disabled' : '') + '>‹</button><span>Página ' + p + ' de ' + tot + '</span><button type="button" class="btn-secundario" data-acao="pag" data-p="' + chaveP + '" data-v="1"' + (p === tot ? ' disabled' : '') + '>›</button>' : '') + '</div>'};
  }
  function busca(lista, termo) {
    const q = String(termo || '').toLowerCase().trim(); if (!q) return lista;
    const qn = q.replace(/\D/g, '');
    return lista.filter(d => (d.contraparte.nome || '').toLowerCase().indexOf(q) >= 0 || (d.empresa.nome || '').toLowerCase().indexOf(q) >= 0 || (qn.length >= 4 && (d.chave.indexOf(qn) >= 0 || d.contraparte.cnpj.indexOf(qn) >= 0)));
  }
  function docsDoLado() {
    const ord = S.ordem.docs;
    const l = busca(X.filtrados.filter(d => d.lado === S.lado), S.busca.docs);
    return l.sort((a, b) => ord === 'valor' ? b.naoEfetivado - a.naoEfetivado : ord === 'data' ? (b.data > a.data ? 1 : -1) : b.aging - a.aging);
  }
  function renderDocs() {
    const cred = S.lado === 'credito', lista = docsDoLado();
    const r = A.resumoLado(X.filtrados, S.lado, conf.cfg);
    const {itens, nav} = paginar(lista, 'docs');
    let h = '<section class="card"><div class="aa-cardcab"><h3>' + (cred ? 'Créditos (notas de entrada)' : 'Débitos (notas de saída)') + ' · ' + TRIB[X.t] + '</h3>' + seg('lado', [['credito', 'Créditos'], ['debito', 'Débitos']], S.lado) + '</div>' +
      '<div class="aa-baldes">' + balde('vencido', 'Vencidos', r.vencidos, 'bad', '') + balde('no_prazo', 'No prazo', r.noPrazo, 'warn', '') + balde('aguardando', 'Aguardando', r.processando, 'mut', '') + balde('concluido', cred ? 'Apropriado' : 'Extinto', r.concluidos, 'ok', '') + '</div>' +
      barraBusca('docs', 'Buscar por contraparte, empresa ou chave', '<label class="aa-ctrl">Ordenar <select data-campo="ordem-docs"><option value="aging"' + (S.ordem.docs === 'aging' ? ' selected' : '') + '>Mais antigos</option><option value="valor"' + (S.ordem.docs === 'valor' ? ' selected' : '') + '>Maior valor em aberto</option><option value="data"' + (S.ordem.docs === 'data' ? ' selected' : '') + '>Emissão mais recente</option></select></label>' +
        '<button type="button" class="btn-secundario" data-acao="exportar-docs">Exportar CSV</button>') +
      '<div class="tablewrap"><table class="aa-tbl"><thead><tr><th>' + (cred ? 'Fornecedor' : 'Cliente') + '</th><th>Empresa</th><th>Comp.</th><th class="n">Potencial</th><th class="n">' + (cred ? 'Apropriado' : 'Extinto') + '</th><th class="n">Em aberto</th><th>Situação</th><th>Prazo</th><th>Retida por</th><th class="n">Aging</th><th>Chave</th></tr></thead><tbody>' +
      (itens.length ? itens.map(d => {
        const ret = X.exec.retidaPor[d.id] || [];
        return '<tr class="clica" tabindex="0" data-acao="detalhe" data-v="' + esc(d.id) + '"><td><b>' + esc(d.contraparte.nome || '—') + '</b><br><small>' + cnpjFmt(d.contraparte.cnpj) + '</small></td><td>' + esc(d.empresa.nome) + '</td><td>' + compBR(d.competencia) + '</td>' +
          '<td class="n">' + brl(d.potencial) + '</td><td class="n">' + brl(d.efetivado) + '</td><td class="n">' + brl(d.naoEfetivado) + '</td>' +
          '<td>' + chip(A.ROTULO_SITUACAO[d.situacao], COR_SIT[d.situacao]) + (d.lado === 'debito' && d.fisco && d.fisco.forma ? '<br><small>via ' + esc(d.fisco.forma) + '</small>' : '') + '</td><td>' + chip(NIVEL[d.nivel][0], NIVEL[d.nivel][1]) + '</td>' +
          '<td class="aa-ret">' + (ret.length ? esc(ret[0]) + (ret.length > 1 ? ' <small>+' + (ret.length - 1) + '</small>' : '') : '—') + '</td><td class="n">' + d.aging + 'd</td><td class="mono" title="' + d.chave + '">' + chaveCurta(d.chave) + '</td></tr>';
      }).join('') : '<tr><td colspan="11" class="aa-nota">Nada com estes filtros.</td></tr>') + '</tbody></table></div>' + nav + '</section>';
    return h;
  }
  function barraBusca(k, ph, extra) {
    return '<div class="aa-barbusca"><input type="search" data-campo="busca-' + k + '" value="' + esc(S.busca[k]) + '" placeholder="' + ph + '" aria-label="' + ph + '">' + (extra || '') + '</div>';
  }
  function detalhe(id) {
    const d = X.enr.find(x => x.id === id); if (!d) return;
    const f = (o, k) => o ? (k === 'pcbs' ? String(o[k]).replace('.', ',') + '%' : brl(o[k])) : '—';
    const dif = d.xml && d.fisco ? A.comparar(d.xml, d.fisco, conf.cfg.tolerancia) : [];
    const acoes = X.exec.acoes.filter(a => a.doc.id === id);
    const linha = (rot, k) => '<tr' + (dif.indexOf(k) >= 0 ? ' class="dif"' : '') + '><th>' + rot + '</th><td class="n">' + f(d.xml, k) + '</td><td class="n">' + f(d.fisco, k) + '</td><td class="n">' + f(d.erp, k) + '</td></tr>';
    abrirDialogo('<h3>' + (d.lado === 'credito' ? 'Crédito' : 'Débito') + ' · ' + esc(d.contraparte.nome || cnpjFmt(d.contraparte.cnpj)) + '</h3>' +
      '<p class="aa-nota mono">' + d.chave + '</p><p>' + esc(d.empresa.nome) + ' · emissão ' + dBR(d.data) + ' · competência ' + compBR(d.competencia) + ' · aging ' + d.aging + ' dias ' + chip(A.ROTULO_SITUACAO[d.situacao], COR_SIT[d.situacao]) + ' ' + chip(NIVEL[d.nivel][0], NIVEL[d.nivel][1]) + '</p>' +
      '<div class="tablewrap"><table class="aa-tbl"><thead><tr><th>Campo</th><th class="n">Sua base (XML)</th><th class="n">Apuração do Fisco</th><th class="n">ERP</th></tr></thead><tbody>' +
      linha('Base de cálculo', 'vbc') + linha('Alíquota CBS', 'pcbs') + linha('Valor CBS', 'vcbs') + linha('Valor IBS', 'vibs') +
      (d.fisco ? '<tr><th>' + (d.lado === 'credito' ? 'Apropriado CBS / IBS' : 'Extinto CBS / IBS') + '</th><td></td><td class="n">' + brl(d.lado === 'credito' ? d.fisco.aprCbs : d.fisco.extCbs) + ' / ' + brl(d.lado === 'credito' ? d.fisco.aprIbs : d.fisco.extIbs) + '</td><td></td></tr>' : '') +
      '</tbody></table></div>' + (dif.length ? '<p class="aa-alerta atencao">Diverge em: ' + dif.map(k => A.CAMPOS_DIVERGENCIA.find(c => c[0] === k)[1]).join(', ') + '.</p>' : '') +
      '<h4>Regras que retêm este documento</h4>' + (acoes.length ? '<ul class="aa-lista">' + acoes.map(a => '<li>' + esc(a.regra.nome) + ' → ' + esc(A.ROTULO_TRATATIVA[a.tratativa]) + ' ' + chip(ST_FILA[a.status][0], ST_FILA[a.status][1]) + (a.motivo ? ' <small>' + esc(a.motivo) + '</small>' : '') + '</li>').join('') + '</ul>' : '<p class="aa-nota">Nenhuma.</p>') +
      '<div class="acoes"><button type="button" class="btn" data-acao="fechar-dlg">Fechar</button></div>');
  }

  /* ===== Conciliação ===== */
  function renderConc() {
    const c = A.conciliar(docsPar(X.filtrados, S.parConc), S.parConc, S.ladoConc, conf.cfg.tolerancia);
    const nomeOutro = S.parConc === 'xml' ? 'sua base' : 'ERP';
    const defs = [['divergente', 'Com divergência', 'bad', 'Existe nos dois lados, mas base, alíquota ou valor não conferem.'],
      ['so_fisco', 'Só na apuração', 'warn', 'Está no extrato do Fisco e não na ' + nomeOutro + '.'],
      ['so_outro', 'Só na ' + nomeOutro, 'mut', 'Está na ' + nomeOutro + ' e ainda não no extrato do Fisco.'],
      ['conciliado', 'Conciliados', 'ok', 'Os campos comparados batem.']];
    let lista = [];
    (S.grupoConc ? [S.grupoConc] : Object.keys(c.grupos)).forEach(g => c.grupos[g].forEach(x => lista.push(Object.assign({g}, x))));
    lista = lista.filter(x => busca([x.doc], S.busca.conc).length);
    const {itens, nav} = paginar(lista, 'conc');
    const outro = d => d[S.parConc];
    return '<section class="card"><div class="aa-cardcab"><h3>Conciliação</h3><div class="aa-cab-ctrl">' +
      seg('par', [['xml', 'Sua base × Apuração'], ['erp', 'ERP × Apuração']], S.parConc) + seg('ladoConc', [['credito', 'Créditos'], ['debito', 'Débitos']], S.ladoConc) + '</div></div>' +
      '<div class="aa-baldes">' + defs.map(dfn => '<button type="button" class="aa-balde ' + dfn[2] + (S.grupoConc === dfn[0] ? ' sel' : '') + '" data-acao="grupo-conc" data-v="' + dfn[0] + '" title="' + esc(dfn[3]) + '"><span class="r">' + dfn[1] + '</span><b>' + brl(c.valores[dfn[0]]) + '</b><small>' + c.grupos[dfn[0]].length + ' documentos</small></button>').join('') + '</div>' +
      '<p class="aa-nota">Comparação pela chave da nota: base de cálculo, alíquota CBS, valor CBS e valor IBS, com tolerância de ' + brl(conf.cfg.tolerancia) + '.' + (S.parConc === 'erp' ? ' Só entram empresas com exportação do ERP importada.' : '') + ' ' + (S.grupoConc ? '<button type="button" class="aa-link" data-acao="grupo-conc" data-v="">Mostrar todos</button>' : '') + '</p>' +
      barraBusca('conc', 'Buscar por contraparte ou chave', '<button type="button" class="btn-secundario" data-acao="exportar-conc">Exportar CSV</button>') +
      '<div class="tablewrap"><table class="aa-tbl"><thead><tr><th>Contraparte</th><th>Empresa</th><th>Comp.</th><th class="n">Fisco (CBS+IBS)</th><th class="n">' + (S.parConc === 'xml' ? 'Sua base' : 'ERP') + ' (CBS+IBS)</th><th>Diverge em</th><th>Resultado</th><th>Chave</th></tr></thead><tbody>' +
      (itens.length ? itens.map(x => {
        const d = x.doc, dfn = defs.find(z => z[0] === x.g);
        return '<tr class="clica" tabindex="0" data-acao="detalhe" data-v="' + esc(d.id) + '"><td>' + esc(d.contraparte.nome || cnpjFmt(d.contraparte.cnpj)) + '</td><td>' + esc(d.empresa.nome) + '</td><td>' + compBR(d.competencia) + '</td>' +
          '<td class="n">' + (d.fisco ? brl(d.fisco.vcbs + d.fisco.vibs) : '—') + '</td><td class="n">' + (outro(d) ? brl(outro(d).vcbs + outro(d).vibs) : '—') + '</td>' +
          '<td>' + (x.campos.length ? x.campos.map(k => A.CAMPOS_DIVERGENCIA.find(z => z[0] === k)[1]).join(', ') : '—') + '</td><td>' + chip(dfn[1], dfn[2]) + '</td><td class="mono" title="' + d.chave + '">' + chaveCurta(d.chave) + '</td></tr>';
      }).join('') : '<tr><td colspan="8" class="aa-nota">Nada aqui.' + (S.parConc === 'erp' && !dados.erp.length ? ' Importe a exportação do ERP para esta conciliação.' : '') + '</td></tr>') + '</tbody></table></div>' + nav + '</section>';
  }

  /* ===== Automações (fila de ações) ===== */
  function filaFiltrada() {
    return X.exec.acoes.filter(a => X.ids.has(a.doc.id) && (!S.filaStatus || a.status === S.filaStatus) && (!S.filaTrat || a.tratativa === S.filaTrat) && busca([a.doc], S.busca.fila).length)
      .sort((a, b) => b.doc.aging - a.doc.aging);
  }
  function renderFila() {
    const todas = X.exec.acoes.filter(a => X.ids.has(a.doc.id));
    const cont = k => todas.filter(a => a.status === k).length;
    const lista = filaFiltrada();
    const {itens, nav} = paginar(lista, 'fila');
    const radPr = todas.filter(a => a.tratativa === 'rad' && a.status === 'pronta');
    const cards = [['aguardando_decisao', 'Aguardando decisão', 'regras em observação: alguém decide'], ['pronta', 'Prontas', 'aprovadas ou em automação'], ['bloqueada', 'Bloqueadas', 'travas da RAD'], ['concluida', 'Concluídas', 'feitas por você']];
    return '<section class="card"><div class="aa-cardcab"><h3>Automações</h3></div>' +
      '<p class="aa-alerta info">A calculadora não emite RAD, não registra evento e não lança no ERP: ela monta a lista. Você executa no portal da apuração ou importa no ERP e marca como concluída.</p>' +
      '<div class="aa-baldes">' + cards.map(c => '<button type="button" class="aa-balde ' + ST_FILA[c[0]][1] + (S.filaStatus === c[0] ? ' sel' : '') + '" data-acao="fila-status" data-v="' + c[0] + '"><span class="r">' + c[1] + '</span><b>' + cont(c[0]) + '</b><small>' + c[2] + '</small></button>').join('') + '</div>' +
      '<div class="aa-barbusca"><input type="search" data-campo="busca-fila" value="' + esc(S.busca.fila) + '" placeholder="Buscar por contraparte ou chave" aria-label="Buscar">' +
      '<label class="aa-ctrl">Tratativa <select data-campo="fila-trat"><option value="">Todas</option>' + A.TRATATIVAS.map(t => '<option value="' + t[0] + '"' + (S.filaTrat === t[0] ? ' selected' : '') + '>' + t[1] + '</option>').join('') + '</select></label>' +
      (S.filaStatus ? '<button type="button" class="aa-link" data-acao="fila-status" data-v="">Todos os status</button>' : '') + '</div>' +
      '<div class="aa-acoes-lote" ' + (S.sel.size ? '' : 'hidden') + '><b>' + S.sel.size + ' selecionada(s)</b>' +
      '<button type="button" class="btn-secundario" data-acao="lote" data-v="aprovada">Aprovar</button><button type="button" class="btn-secundario" data-acao="lote" data-v="concluida">Marcar concluída</button>' +
      '<button type="button" class="btn-secundario" data-acao="lote" data-v="descartada">Descartar</button><button type="button" class="btn-secundario" data-acao="lote" data-v="">Reabrir</button></div>' +
      '<div class="tablewrap"><table class="aa-tbl"><thead><tr><th><input type="checkbox" data-acao="sel-todos" aria-label="Selecionar a página"></th><th>Documento</th><th>Empresa</th><th>Regra</th><th>Tratativa</th><th class="n">Valor</th><th>Status</th><th class="n">Aging</th></tr></thead><tbody>' +
      (itens.length ? itens.map(a => '<tr><td><input type="checkbox" data-acao="sel" data-v="' + esc(a.id) + '"' + (S.sel.has(a.id) ? ' checked' : '') + ' aria-label="Selecionar"></td>' +
        '<td><button type="button" class="aa-link" data-acao="detalhe" data-v="' + esc(a.doc.id) + '">' + esc(a.doc.contraparte.nome || cnpjFmt(a.doc.contraparte.cnpj)) + '</button><br><small class="mono">' + chaveCurta(a.doc.chave) + '</small></td>' +
        '<td>' + esc(a.doc.empresa.nome) + '</td><td>' + esc(a.regra.nome) + '</td><td>' + esc(A.ROTULO_TRATATIVA[a.tratativa]) + '<br><small>' + (a.modo === 'automacao' ? 'Automação' : 'Observação') + '</small></td>' +
        '<td class="n">' + brl(a.valor) + '</td><td>' + chip(ST_FILA[a.status][0], ST_FILA[a.status][1]) + (a.motivo ? '<br><small>' + esc(a.motivo) + '</small>' : '') + '</td><td class="n">' + a.doc.aging + 'd</td></tr>').join('')
        : '<tr><td colspan="8" class="aa-nota">Nenhuma ação com estes filtros.</td></tr>') + '</tbody></table></div>' + nav +
      '<div class="acoes"><button type="button" class="btn" data-acao="exp-rad">Baixar RADs prontas (' + radPr.length + ')</button>' +
      '<button type="button" class="btn-secundario" data-acao="exp-erp">Baixar lançamentos para o ERP</button>' +
      '<button type="button" class="btn-secundario" data-acao="exp-ncnd">Baixar NC/ND e eventos</button>' +
      '<button type="button" class="btn-secundario" data-acao="exp-fila">Exportar fila (CSV)</button></div></section>';
  }
  function decidir(ids, status) {
    const em = X.dataBase;
    ids.forEach(id => { if (status) conf.decisoes[id] = {status, em}; else delete conf.decisoes[id]; });
    salvarConf(); S.sel.clear(); render();
    msg(ids.length + ' ação(ões) ' + ({aprovada: 'aprovada(s)', concluida: 'marcada(s) como concluída(s)', descartada: 'descartada(s)', '': 'reaberta(s)'}[status]) + '.', 'ok');
  }

  /* ===== Configurações ===== */
  function renderConfig() {
    return '<section class="card"><div class="aa-cardcab"><h3>Configurações</h3>' + seg('cfgAba', [['regras', 'Regras'], ['empresas', 'Empresas e fornecedores'], ['prazos', 'Prazos e alertas']], S.cfgAba) + '</div>' +
      ({regras: cfgRegras, empresas: cfgEmpresas, prazos: cfgPrazos}[S.cfgAba])() + '</section>';
  }
  function cfgRegras() {
    const rs = conf.regras, lig = rs.filter(r => r.ligada);
    const k = (rot, v, d) => '<div class="kpi"><span class="r">' + rot + '</span><span class="v">' + v + '</span><span class="d">' + d + '</span></div>';
    return '<div class="kpis">' + k('Ligadas', lig.length, 'valem na próxima execução') + k('Desligadas', rs.length - lig.length, 'não rodam') +
      k('Em observação', lig.filter(r => A.modoEfetivo(r) === 'observacao').length, 'sinalizam; alguém decide') + k('Em automação', lig.filter(r => A.modoEfetivo(r) === 'automacao').length, 'entram direto como "prontas"') + '</div>' +
      '<div class="acoes"><button type="button" class="btn" data-acao="nova-regra">+ Nova regra customizada</button></div>' +
      '<div class="tablewrap"><table class="aa-tbl"><thead><tr><th>Regra</th><th>Origem</th><th>Lado</th><th>Tributo</th><th>Tratativa</th><th>Modo</th><th class="n">Retidas</th><th>Estado</th><th></th></tr></thead><tbody>' +
      rs.map(r => '<tr><td><b>' + esc(r.nome) + '</b>' + (r.descricao ? '<br><small>' + esc(r.descricao) + '</small>' : '') + '</td><td>' + chip(ORIGEM[r.origem] || r.origem, 'mut') + '</td>' +
        '<td>' + (r.lado === 'credito' ? 'Entrada' : 'Saída') + '</td><td>' + TRIB[r.tributo || 'cbs'] + '</td><td>' + esc(A.ROTULO_TRATATIVA[r.tratativa]) + '</td>' +
        '<td>' + (r.tratativa === 'pendencia' ? chip('Observação', 'mut') : seg('modo:' + r.id, [['observacao', 'Observação'], ['automacao', 'Automação']], r.modo)) + '</td>' +
        '<td class="n">' + (X ? X.exec.porRegra[r.id] || 0 : 0) + '</td>' +
        '<td><label class="aa-tog"><input type="checkbox" data-acao="tog-regra" data-v="' + r.id + '"' + (r.ligada ? ' checked' : '') + '><span>' + (r.ligada ? 'Ligada' : 'Desligada') + '</span></label></td>' +
        '<td class="aa-tdacoes"><button type="button" class="aa-link" data-acao="editar-regra" data-v="' + r.id + '">' + (r.origem === 'padrao' ? 'Ver' : 'Editar') + '</button>' +
        (r.origem === 'customizada' ? ' <button type="button" class="aa-link" data-acao="duplicar-regra" data-v="' + r.id + '">Duplicar</button> <button type="button" class="aa-link bad" data-acao="excluir-regra" data-v="' + r.id + '">Excluir</button>'
          : r.origem === 'padrao_ajustavel' ? ' <button type="button" class="aa-link" data-acao="restaurar-regra" data-v="' + r.id + '">Restaurar</button>' : '') + '</td></tr>').join('') +
      '</tbody></table></div><p class="aa-nota">Regra padrão: só liga/desliga e muda o modo. Padrão ajustável: critérios editáveis. Customizada: tudo. Mudanças valem a partir da próxima atualização da tela.</p>';
  }
  function cfgEmpresas() {
    const emp = S.empRad || (conf.empresas[0] && conf.empresas[0].base) || '';
    S.empRad = emp;
    let h = '<h4>Empresas da carteira</h4><p class="aa-nota">Criadas automaticamente a partir do extrato. O regime importa: empresa do Simples Nacional não pode fazer RAD (art. 36 exige adquirente do regime regular).</p>' +
      '<div class="tablewrap"><table class="aa-tbl"><thead><tr><th>Nome</th><th>CNPJ base</th><th>Regime de IBS/CBS</th><th class="n">Documentos</th></tr></thead><tbody>' +
      (conf.empresas.length ? conf.empresas.map(e => '<tr><td><input data-emp-nome="' + e.base + '" value="' + esc(e.nome) + '" aria-label="Nome da empresa"></td><td class="mono">' + esc(e.base) + '</td>' +
        '<td><select data-emp-regime="' + e.base + '" aria-label="Regime"><option value="regular"' + (e.regime !== 'simples' ? ' selected' : '') + '>Regular</option><option value="simples"' + (e.regime === 'simples' ? ' selected' : '') + '>Simples Nacional</option></select></td>' +
        '<td class="n">' + (X ? X.enr.filter(d => d.empresa.base === e.base).length : 0) + '</td></tr>').join('') : '<tr><td colspan="4" class="aa-nota">Nenhuma empresa. Importe um extrato ou cadastre abaixo.</td></tr>') +
      '</tbody></table></div><div class="aa-barbusca"><input id="aa-nova-emp-cnpj" placeholder="CNPJ (aceita alfanumérico)" aria-label="CNPJ"><input id="aa-nova-emp-nome" placeholder="Nome" aria-label="Nome"><button type="button" class="btn-secundario" data-acao="add-emp">Adicionar empresa</button></div>';
    if (!emp) return h;
    const teto = conf.tetos[emp] != null ? conf.tetos[emp] : conf.cfg.tetoRadPadrao;
    const aut = conf.autorizados[emp] || [];
    const forn = X ? A.topContrapartes(X.enr.filter(d => d.empresa.base === emp), 'credito', 999) : [];
    const todos = X ? [...new Map(X.enr.filter(d => d.empresa.base === emp && d.lado === 'credito').map(d => [d.contraparte.base, d.contraparte])).values()] : [];
    const travado = b => (forn.find(f => f.base === b) || {valor: 0}).valor;
    const usado = X ? (X.exec.radUsado[emp] || 0) : 0;
    h += '<h4>Fornecedores com RAD</h4><p class="aa-nota">Para quais fornecedores a empresa pode recolher no lugar deles (LC 214, art. 36), destravando o crédito. Sem autorização ou sem teto, a regra de RAD só bloqueia.</p>' +
      '<div class="aa-barbusca"><label class="aa-ctrl">Empresa <select data-campo="emp-rad">' + conf.empresas.map(e => '<option value="' + e.base + '"' + (e.base === emp ? ' selected' : '') + '>' + esc(e.nome) + '</option>').join('') + '</select></label>' +
      '<label class="aa-ctrl">Teto de RAD por competência (R$) <input class="aa-inp-num" inputmode="decimal" data-campo="teto-rad" value="' + String(teto).replace('.', ',') + '"></label></div>' +
      '<div class="aa-barra"><i style="width:' + (teto ? Math.min(100, usado / teto * 100) : 0) + '%"></i></div><p class="aa-nota">' + brl(usado) + ' em RADs prontas ou concluídas de ' + brl(teto) + ' · ' + brl(aut.reduce((s, b) => s + travado(b), 0)) + ' travados em fornecedores autorizados</p>' +
      '<div class="tablewrap"><table class="aa-tbl"><thead><tr><th>Fornecedor</th><th class="n">Crédito travado</th><th>RAD</th></tr></thead><tbody>' +
      (todos.length ? todos.sort((a, b) => travado(b.base) - travado(a.base)).map(f => '<tr><td><b>' + esc(f.nome || '—') + '</b><br><small>' + cnpjFmt(f.cnpj) + '</small></td><td class="n">' + brl(travado(f.base)) + '</td>' +
        '<td><label class="aa-tog"><input type="checkbox" data-acao="tog-aut" data-v="' + f.base + '"' + (aut.indexOf(f.base) >= 0 ? ' checked' : '') + '><span>' + (aut.indexOf(f.base) >= 0 ? 'Autorizada' : 'Não autorizada') + '</span></label></td></tr>').join('')
        : '<tr><td colspan="3" class="aa-nota">Sem fornecedores.</td></tr>') + '</tbody></table></div>';
    return h;
  }
  const CAMPOS_PRAZO = [
    ['Competência', [['prazoRecolhimentoDias', 'Prazo para o débito do fornecedor ser extinto', 'dias após a emissão', 'Depois disso o crédito pendente conta como vencido. PREMISSA: ajuste ao seu prazo de pagamento.'],
      ['diasAtencaoAntes', 'Marcar em atenção antes do vencimento', 'dias antes', ''], ['diasCriticoDepois', 'Tratar como crítico depois do vencimento', 'dias depois', ''],
      ['diaFimAjuste', 'Último dia de ajuste da competência anterior', 'dia do mês', 'PREMISSA: confirmar o prazo na regulamentação da apuração assistida.'], ['diasAvisoFimAjuste', 'Avisar antes do fim do ajuste', 'dias antes', '']]],
    ['Fornecedor', [['diasFupAntesRad', 'Aguardar resposta à cobrança antes de considerar RAD', 'dias após o vencimento', 'Vencido esse prazo sem recolhimento, o crédito fica elegível para RAD.']]],
    ['Dados e conciliação', [['diasDadoDesatualizado', 'Avisar quando o extrato estiver velho', 'dias', 'Sem isso, um extrato antigo parece atual.'], ['tolerancia', 'Tolerância da conciliação', 'R$', '']]],
  ];
  const AVISOS = [['desatualizado', 'Extrato desatualizado'], ['fim_ajuste', 'Competência perto do fim do ajuste'], ['vencido', 'Crédito passou do vencimento'], ['critico', 'Crédito ficou crítico'],
    ['teto_rad', 'Teto de RAD atingido'], ['rad_nao_autorizado', 'RAD bloqueada por fornecedor não autorizado'], ['sem_empresa', 'XML sem empresa cadastrada']];
  function cfgPrazos() {
    const c = conf.cfg;
    return CAMPOS_PRAZO.map(g => '<h4>' + g[0] + '</h4><div class="aa-prazos">' + g[1].map(p => '<div class="aa-prazo"><div><b>' + p[1] + '</b>' + (p[3] ? '<small>' + p[3] + '</small>' : '') + '</div>' +
      '<label><input class="aa-inp-num" inputmode="decimal" data-cfg="' + p[0] + '" value="' + String(c[p[0]]).replace('.', ',') + '" aria-label="' + esc(p[1]) + '"> <span>' + p[2] + '</span></label></div>').join('') + '</div>').join('') +
      '<h4>Contas contábeis (lançamento transitória → definitiva)</h4><div class="grade2"><label>Conta transitória<input data-cfg-txt="contaTransitoria" value="' + esc(c.contaTransitoria) + '"></label>' +
      '<label>Conta definitiva<input data-cfg-txt="contaDefinitiva" value="' + esc(c.contaDefinitiva) + '"></label></div>' +
      '<h4>Data-base</h4><div class="grade2"><label>Data usada no aging e nos prazos <span class="opc">vazio = hoje</span><input type="date" data-campo="data-base" value="' + esc(conf.dataBase) + '"></label></div>' +
      '<h4>Avisos na tela</h4><div class="aa-avisos">' + AVISOS.map(a => '<label class="aa-tog"><input type="checkbox" data-aviso="' + a[0] + '"' + (conf.avisos[a[0]] !== false ? ' checked' : '') + '><span>' + a[1] + '</span></label>').join('') + '</div>' +
      '<p class="aa-nota">A calculadora não tem servidor, então os avisos aparecem aqui na tela, não por e-mail. Mudança de prazo vale da competência corrente em diante; competência concluída guarda os parâmetros com que fechou.</p>' +
      '<div class="acoes"><button type="button" class="btn-secundario" data-acao="restaurar-prazos">Restaurar padrões</button><button type="button" class="btn-secundario bad" data-acao="zerar">Apagar dados e configurações da apuração</button></div>';
  }

  /* ===== Editor de regra em 4 passos ===== */
  let W = null; // {regra, passo, original}
  function abrirEditor(r, nova) {
    W = {regra: clone(r), passo: 1, nova: !!nova};
    if (r.origem === 'padrao' && !nova) W.passo = 4;
    desenharEditor();
  }
  function desenharEditor() {
    const r = W.regra, c = r.criterios, so = r.origem === 'padrao', crit = r.origem === 'customizada', aj = r.origem !== 'padrao';
    const passos = ['Escopo', 'Critérios', 'Tratativa', 'Revisão'];
    const dis = x => x ? '' : ' disabled';
    let corpo = '';
    if (W.passo === 1) {
      corpo = '<label>Nome da regra<input data-w="nome" value="' + esc(r.nome) + '"' + dis(crit) + ' placeholder="Ex.: Crédito de valor alto sem apropriação"></label>' +
        '<label>Descrição<input data-w="descricao" value="' + esc(r.descricao) + '"' + dis(crit) + '></label>' +
        '<label>Tributo</label>' + radios('tributo', [['cbs', 'CBS'], ['ibs', 'IBS'], ['total', 'CBS + IBS']], r.tributo || 'cbs', crit) +
        '<label>Lado da apuração</label>' + radios('lado', [['credito', 'Créditos (notas de entrada)'], ['debito', 'Débitos (notas de saída)']], r.lado, crit) +
        '<label>Competência</label>' + radios('competencia', [['qualquer', 'Qualquer'], ['corrente', 'Só a corrente'], ['anterior', 'Só a anterior']], r.competencia, aj) +
        '<label>Empresas <span class="opc">nenhuma marcada = todas</span></label><div class="aa-checks">' + conf.empresas.map(e => '<label class="check"><input type="checkbox" data-wl="empresas" value="' + e.base + '"' + (r.empresas.indexOf(e.base) >= 0 ? ' checked' : '') + dis(aj) + '>' + esc(e.nome) + '</label>').join('') + '</div>' +
        '<label>Contrapartes <span class="opc">CNPJ base (8 primeiros), separados por vírgula; vazio = todas</span><input data-w="fornecedores" value="' + esc(r.fornecedores.join(', ')) + '"' + dis(aj) + '></label>';
    } else if (W.passo === 2) {
      corpo = '<label>Situação na apuração <span class="opc">nenhuma = qualquer</span></label><div class="aa-checks">' + A.SITUACOES[r.lado].map(s => '<label class="check"><input type="checkbox" data-wc="situacoes" value="' + s[0] + '"' + (c.situacoes.indexOf(s[0]) >= 0 ? ' checked' : '') + dis(aj) + '>' + s[1] + '</label>').join('') + '</div>' +
        '<label>Onde o documento precisa estar</label><div class="tablewrap"><table class="aa-tbl aa-pres"><thead><tr><th>Fonte</th><th>Indiferente</th><th>Precisa estar</th><th>Não pode estar</th></tr></thead><tbody>' +
        A.FONTES.map(f => '<tr><td>' + f[1] + '</td>' + ['', 'precisa', 'nao_pode'].map(v => '<td><input type="radio" name="pres-' + f[0] + '" data-wp="' + f[0] + '" value="' + v + '"' + ((c.presenca[f[0]] || '') === v ? ' checked' : '') + dis(aj) + ' aria-label="' + f[1] + ' ' + (v || 'indiferente') + '"></td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
        '<label>Divergência entre sua base e o Fisco em <span class="opc">exige a nota nos dois</span></label><div class="aa-checks">' + A.CAMPOS_DIVERGENCIA.map(s => '<label class="check"><input type="checkbox" data-wc="divergencia" value="' + s[0] + '"' + (c.divergencia.indexOf(s[0]) >= 0 ? ' checked' : '') + dis(aj) + '>' + s[1] + '</label>').join('') + '</div>' +
        '<div class="grade2"><label>Valor mínimo (R$)<input class="aa-inp-num" inputmode="decimal" data-wn="valorMinimo" value="' + String(c.valorMinimo || 0).replace('.', ',') + '"' + dis(aj) + '></label>' +
        '<label>Idade mínima (dias desde a emissão)<input class="aa-inp-num" inputmode="numeric" data-wn="idadeMinima" value="' + (c.idadeMinima || 0) + '"' + dis(aj) + '></label></div>' +
        '<label class="check"><input type="checkbox" data-wb="exigeFupVencido"' + (c.exigeFupVencido ? ' checked' : '') + dis(aj) + '> Só depois do prazo de cobrança ao fornecedor (' + (conf.cfg.prazoRecolhimentoDias + conf.cfg.diasFupAntesRad) + ' dias)</label>' +
        '<label class="check"><input type="checkbox" data-wb="somenteCredPresumido"' + (c.somenteCredPresumido ? ' checked' : '') + dis(aj) + '> Só notas com crédito presumido</label>' +
        '<label>Condições avançadas</label><p class="aa-nota">O documento deve atender <select data-w="combinacao"' + dis(aj) + '><option value="todas"' + (c.combinacao !== 'alguma' ? ' selected' : '') + '>todas</option><option value="alguma"' + (c.combinacao === 'alguma' ? ' selected' : '') + '>alguma</option></select> das condições.</p>' +
        (c.condicoes || []).map((k, i) => {
          const tipo = (A.CAMPOS_CONDICAO.find(z => z[0] === k.campo) || [0, 0, 'txt'])[2];
          return '<div class="aa-cond"><select data-cond="' + i + '" data-k="campo"' + dis(aj) + ' aria-label="Campo"><option value="">Escolha o campo</option>' + A.CAMPOS_CONDICAO.map(z => '<option value="' + z[0] + '"' + (z[0] === k.campo ? ' selected' : '') + '>' + z[1] + '</option>').join('') + '</select>' +
            '<select data-cond="' + i + '" data-k="op"' + dis(aj) + ' aria-label="Operador">' + A.OPERADORES[tipo].map(o => '<option' + (o === k.op ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
            '<input data-cond="' + i + '" data-k="valor" value="' + esc(k.valor) + '"' + dis(aj) + ' aria-label="Valor">' + (aj ? '<button type="button" class="aa-link bad" data-acao="w-tirar-cond" data-v="' + i + '">Remover</button>' : '') + '</div>';
        }).join('') + (aj ? '<button type="button" class="btn-secundario" data-acao="w-add-cond">+ Adicionar condição</button>' : '');
    } else if (W.passo === 3) {
      corpo = '<div class="aa-trats">' + A.TRATATIVAS.map(t => '<label class="aa-trat"><input type="radio" name="w-trat" data-w="tratativa" value="' + t[0] + '"' + (r.tratativa === t[0] ? ' checked' : '') + dis(crit) + '><span><b>' + t[1] + '</b><small>' + t[2] + '</small></span></label>').join('') + '</div>' +
        '<label>Modo</label>' + (r.tratativa === 'pendencia' ? '<p class="aa-nota">Pendência no painel é sempre observação.</p>' : radios('modo', [['observacao', 'Observação: entra na fila aguardando sua decisão'], ['automacao', 'Automação: entra na fila já como "pronta"']], r.modo, true)) +
        (r.tratativa === 'rad' ? '<p class="aa-alerta atencao">RAD é dinheiro saindo do caixa da empresa. Mesmo em automação, só passa fornecedor autorizado, dentro do teto, em empresa do regime regular.</p>' : '');
    } else {
      const sim = X ? A.simularRegra(r, X.base.docs, conf.cfg, X.dataBase) : {docs: 0, valor: 0};
      corpo = '<div class="aa-rev"><b>' + esc(r.nome || '(sem nome)') + '</b> ' + chip(ORIGEM[r.origem], 'mut') + '<p>' + esc(r.descricao || '') + '</p>' +
        '<dl><dt>Onde procura</dt><dd>' + (r.lado === 'credito' ? 'Créditos' : 'Débitos') + ' · ' + TRIB[r.tributo || 'cbs'] + ' · ' + (r.empresas.length ? r.empresas.map(nomeEmpresa).join(', ') : 'todas as empresas') + ' · competência ' + r.competencia + '</dd>' +
        '<dt>Quando retém</dt><dd>' + resumoCriterios(r) + '</dd><dt>O que faz</dt><dd>' + A.ROTULO_TRATATIVA[r.tratativa] + ' · ' + (A.modoEfetivo(r) === 'automacao' ? 'Automação' : 'Observação') + '</dd></dl>' +
        '<p class="aa-alerta info">Com os dados de hoje, esta regra reteria <b>' + sim.docs + '</b> documento(s), ' + brl(sim.valor) + '.</p>' +
        '<label class="check"><input type="checkbox" data-wb2="ligada"' + (r.ligada ? ' checked' : '') + '> Ligar a regra ao salvar</label></div>';
    }
    abrirDialogo('<div class="aa-wcab"><h3>' + (W.nova ? 'Nova regra' : esc(r.nome)) + '</h3><span class="aa-nota">' + passos[W.passo - 1] + ' · ' + W.passo + ' de 4</span></div>' +
      '<div class="aa-wpassos">' + passos.map((p, i) => '<button type="button" data-acao="w-ir" data-v="' + (i + 1) + '" class="' + (i + 1 === W.passo ? 'atual' : i + 1 < W.passo ? 'feito' : '') + '">' + p + '</button>').join('') + '</div>' +
      (so ? '<p class="aa-alerta info">Regra padrão: os critérios não mudam. Você pode ligar, desligar e trocar o modo.</p>' : '') +
      '<div class="aa-wcorpo">' + corpo + '</div><p class="status" id="aa-wmsg"></p>' +
      '<div class="acoes"><button type="button" class="btn-secundario" data-acao="' + (W.passo === 1 ? 'fechar-dlg' : 'w-voltar') + '">' + (W.passo === 1 ? 'Cancelar' : '← Voltar') + '</button>' +
      '<button type="button" class="btn" data-acao="' + (W.passo === 4 ? 'w-salvar' : 'w-avancar') + '">' + (W.passo === 4 ? (W.nova ? 'Criar regra' : 'Salvar') : 'Avançar →') + '</button></div>');
  }
  function radios(nome, ops, atual, hab) {
    return '<div class="aa-radios">' + ops.map(o => '<label class="check"><input type="radio" name="w-' + nome + '" data-w="' + nome + '" value="' + o[0] + '"' + (o[0] === atual ? ' checked' : '') + (hab ? '' : ' disabled') + '>' + o[1] + '</label>').join('') + '</div>';
  }
  function resumoCriterios(r) {
    const c = r.criterios, p = [];
    if (c.situacoes.length) p.push('situação ' + c.situacoes.map(s => A.ROTULO_SITUACAO[s]).join(' ou '));
    A.FONTES.forEach(f => { if (c.presenca[f[0]] === 'precisa') p.push('está em ' + f[1]); if (c.presenca[f[0]] === 'nao_pode') p.push('não está em ' + f[1]); });
    if (c.divergencia.length) p.push('diverge em ' + c.divergencia.map(k => A.CAMPOS_DIVERGENCIA.find(z => z[0] === k)[1]).join(' ou '));
    if (c.valorMinimo) p.push('valor ≥ ' + brl(c.valorMinimo));
    if (c.idadeMinima) p.push('emitida há ' + c.idadeMinima + ' dias ou mais');
    if (c.exigeFupVencido) p.push('cobrança ao fornecedor vencida');
    if (c.somenteCredPresumido) p.push('com crédito presumido');
    const conds = (c.condicoes || []).filter(x => x.campo);
    if (conds.length) p.push('(' + conds.map(x => (A.CAMPOS_CONDICAO.find(z => z[0] === x.campo) || [0, x.campo])[1] + ' ' + x.op + ' ' + x.valor).join(c.combinacao === 'alguma' ? ' OU ' : ' E ') + ')');
    return p.length ? esc(p.join('; ')) : 'sempre (sem critério)';
  }
  function lerEditor() {
    const r = W.regra, dlg = $('aa-dlg-in');
    dlg.querySelectorAll('[data-w]').forEach(el => {
      const k = el.dataset.w;
      if (el.type === 'radio') { if (el.checked) r[k] = el.value; }
      else if (k === 'fornecedores') r.fornecedores = el.value.split(/[,;\s]+/).map(A.baseCnpj).filter(Boolean);
      else if (k === 'combinacao') r.criterios.combinacao = el.value;
      else r[k] = el.value;
    });
    const marcados = sel => [...dlg.querySelectorAll(sel)].filter(x => x.checked).map(x => x.value);
    if (dlg.querySelector('[data-wl="empresas"]')) r.empresas = marcados('[data-wl="empresas"]');
    ['situacoes', 'divergencia'].forEach(k => { if (dlg.querySelector('[data-wc="' + k + '"]')) r.criterios[k] = marcados('[data-wc="' + k + '"]'); });
    dlg.querySelectorAll('[data-wp]').forEach(el => { if (el.checked) r.criterios.presenca[el.dataset.wp] = el.value; });
    dlg.querySelectorAll('[data-wn]').forEach(el => { r.criterios[el.dataset.wn] = A.numero(el.value); });
    dlg.querySelectorAll('[data-wb]').forEach(el => { r.criterios[el.dataset.wb] = el.checked; });
    dlg.querySelectorAll('[data-wb2]').forEach(el => { r[el.dataset.wb2] = el.checked; });
    dlg.querySelectorAll('[data-cond]').forEach(el => { const c = r.criterios.condicoes[Number(el.dataset.cond)]; if (c) c[el.dataset.k] = el.value; });
    // Situações que não existem no lado escolhido saem
    const validas = A.SITUACOES[r.lado].map(s => s[0]);
    r.criterios.situacoes = r.criterios.situacoes.filter(s => validas.indexOf(s) >= 0);
    if (r.tratativa === 'rad' && r.lado !== 'credito') r.tratativa = 'pendencia';
  }
  function validarPasso() {
    const r = W.regra;
    if (W.passo === 1 && !r.nome.trim()) return 'Dê um nome à regra.';
    if (W.passo === 3 && r.tratativa === 'rad' && r.lado !== 'credito') return 'RAD só vale para créditos (notas de entrada).';
    return '';
  }

  /* ===== Importar ===== */
  function renderImportar() {
    const arq = dados.arquivos || [];
    const bloco = (k, tit, desc, aceita, multi, modelo) => '<div class="aa-imp"><h4>' + tit + '</h4><p class="aa-nota">' + desc + '</p>' +
      '<label class="btn-secundario aa-file">Escolher arquivo' + (multi ? 's' : '') + '<input type="file" data-imp="' + k + '" accept="' + aceita + '"' + (multi ? ' multiple' : '') + ' hidden></label>' +
      (modelo ? ' <button type="button" class="aa-link" data-acao="modelo" data-v="' + k + '">Baixar modelo</button>' : '') +
      '<p class="aa-nota">' + (dados[k] || []).length + ' registro(s) carregado(s)' + (k === 'fisco' && dados.dataExtrato ? ' · extrato de ' + dBR(dados.dataExtrato) : '') + '</p></div>';
    return '<section class="card"><div class="aa-cardcab"><h3>Importar dados</h3></div>' +
      '<p class="aa-alerta info">Tudo fica neste navegador. Nada é enviado para servidor. Esta seção não consulta a Receita: o extrato da apuração precisa ser exportado do portal e importado aqui.</p>' +
      '<label class="check"><input type="checkbox" id="aa-imp-acrescentar" checked> Acrescentar ao que já existe (desmarque para substituir)</label>' +
      '<div class="aa-imps">' +
      bloco('xml', '1. XMLs das NF-e', 'Notas de entrada e saída da carteira (grupo IBSCBS, NT 2025.002). O lado é decidido pela empresa: destinatário na carteira = crédito; emitente na carteira = débito.', '.xml,text/xml', true, false) +
      bloco('fisco', '2. Extrato da apuração assistida', 'CSV com uma linha por nota: o que o Fisco registrou, quanto já foi apropriado (crédito) ou extinto (débito) e a forma de extinção. Layout próprio desta calculadora: baixe o modelo.', '.csv,text/csv', false, true) +
      bloco('erp', '3. Exportação do ERP (opcional)', 'CSV com valores do ERP por chave e se já foi contabilizado e pago. Usado na conciliação ERP × Apuração e nas regras de lançamento.', '.csv,text/csv', false, true) + '</div>' +
      '<div class="grade2"><label>Data do extrato <span class="opc">quando ele foi gerado no portal</span><input type="date" data-campo="data-extrato" value="' + esc(dados.dataExtrato) + '"></label></div>' +
      '<details class="aa-layout"><summary>Colunas aceitas no extrato</summary><p class="aa-nota">Separador ; ou , · números com vírgula ou ponto · datas dd/mm/aaaa ou aaaa-mm-dd. Obrigatórias: <b>lado</b> (credito/debito) e <b>chave</b> (44 dígitos).</p>' +
      '<ul class="aa-lista"><li>lado, chave, cnpj_emitente, nome_emitente, cnpj_destinatario, nome_destinatario, data_emissao, competencia</li><li>base_calculo, aliquota_cbs, valor_cbs, valor_ibs</li>' +
      '<li>Crédito: cbs_apropriada, ibs_apropriado · Débito: cbs_extinta, ibs_extinto, forma_extincao (split, pagamento, compensacao, rad)</li></ul>' +
      '<p class="aa-nota">O layout oficial de exportação do portal não foi verificado. Se o seu arquivo tiver outros nomes de coluna, renomeie no Excel antes de importar.</p></details>' +
      (arq.length ? '<h4>Últimas importações</h4><ul class="aa-lista">' + arq.slice(-8).reverse().map(a => '<li>' + esc(a.quando) + ' · ' + esc(a.tipo) + ' · ' + esc(a.texto) + '</li>').join('') + '</ul>' : '') +
      '<div class="acoes"><button type="button" class="btn-secundario" data-acao="demo">Carregar demonstração</button><button type="button" class="btn-secundario bad" data-acao="limpar-dados">Apagar dados importados</button></div></section>';
  }
  function lerArquivo(f) { return new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsText(f, 'utf-8'); }); }
  async function importar(tipo, arquivos) {
    const acrescentar = $('aa-imp-acrescentar') ? $('aa-imp-acrescentar').checked : true;
    if (dados.demo) { dados = dadosVazios(); conf.empresas = []; conf.decisoes = {}; conf.saldos = {}; conf.dataBase = ''; salvarConf(); }
    const log = [];
    if (tipo === 'xml') {
      const novos = [], erros = [];
      for (const f of arquivos) {
        const n = A.lerXmlNFe(await lerArquivo(f));
        if (n.erro) erros.push(f.name + ': ' + n.erro); else { if (!n.temGrupo) erros.push(f.name + ': sem grupo IBSCBS (valores zerados).'); novos.push(n); }
      }
      const mapa = new Map((acrescentar ? dados.xml : []).map(n => [n.chave, n]));
      novos.forEach(n => mapa.set(n.chave, n));
      dados.xml = [...mapa.values()];
      log.push(novos.length + ' nota(s) lida(s)'); if (erros.length) log.push(erros.length + ' aviso(s): ' + erros.slice(0, 3).join(' | '));
    } else {
      const texto = await lerArquivo(arquivos[0]);
      const r = (tipo === 'fisco' ? A.normalizarExtrato : A.normalizarErp)(A.lerCSV(texto));
      const mapa = new Map((acrescentar ? dados[tipo] : []).map(l => [l.lado + ':' + l.chave, l]));
      r.linhas.forEach(l => mapa.set(l.lado + ':' + l.chave, l));
      dados[tipo] = [...mapa.values()];
      if (tipo === 'fisco' && !dados.dataExtrato) dados.dataExtrato = hoje();
      log.push(r.linhas.length + ' linha(s) lida(s) de ' + arquivos[0].name); if (r.erros.length) log.push(r.erros.length + ' linha(s) ignorada(s): ' + r.erros.slice(0, 3).join(' | '));
    }
    dados.demo = false;
    dados.arquivos = (dados.arquivos || []).concat({quando: new Date().toLocaleString('pt-BR'), tipo: {xml: 'XML', fisco: 'Extrato', erp: 'ERP'}[tipo], texto: log.join(' · ')}).slice(-20);
    salvarDados(); render(); msg(log.join(' · '), log.length > 1 ? 'bad' : 'ok');
  }

  /* ===== Demonstração (dados fictícios e coerentes entre si) ===== */
  function carregarDemo() {
    let semente = 7;
    const rnd = () => { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };
    const pick = a => a[Math.floor(rnd() * a.length)];
    const dataBase = '2027-03-20';
    const empresas = [
      {cnpj: '10101010000110', base: '10101010', nome: 'Mercado Bom Preço Ltda (fictícia)', regime: 'regular'},
      {cnpj: '20202020000120', base: '20202020', nome: 'Oficina Rota Sul Ltda (fictícia)', regime: 'regular'},
      {cnpj: '30303030000130', base: '30303030', nome: 'Padaria Trigo Fino ME (fictícia)', regime: 'simples'}];
    const forn = [['40404040000140', 'Distribuidora Alfa (fictícia)'], ['50505050000150', 'Atacado Beta (fictícia)'], ['60606060000160', 'Indústria Gama (fictícia)'],
      ['70707070000170', 'Logística Delta (fictícia)'], ['80808080000180', 'Embalagens Épsilon (fictícia)'], ['90909090000190', 'Serviços Zeta (fictícia)']];
    const clientes = [['11121314000115', 'Cliente Ômega (fictício)'], ['21222324000125', 'Cliente Sigma (fictício)'], ['31323334000135', 'Cliente Tau (fictício)']];
    const pc = 8.8, pi = 0.1; // alíquotas ilustrativas
    const fisco = [], xml = [], erp = [];
    let seq = 1;
    const mkChave = (cnpj, d) => ('35' + d.slice(2, 4) + d.slice(5, 7) + cnpj + '55001' + String(seq++).padStart(9, '0') + '1' + String(Math.floor(rnd() * 1e8)).padStart(8, '0') + String(seq % 10)).slice(0, 44);
    const addDias = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') - n * 86400000).toISOString().slice(0, 10);
    empresas.forEach((e, ie) => {
      const nCred = [38, 26, 14][ie], nDeb = [16, 10, 6][ie];
      for (let i = 0; i < nCred; i++) {
        const f = forn[(i + ie) % (ie === 2 ? 3 : forn.length)], idade = Math.floor(rnd() * 110), data = addDias(dataBase, idade);
        const vbc = Math.round((800 + rnd() * (ie === 0 ? 40000 : 15000)) * 100) / 100, vcbs = Math.round(vbc * pc) / 100, vibs = Math.round(vbc * pi) / 100;
        const chave = mkChave(f[0], data);
        const lento = f[0] === '40404040000140' || f[0] === '60606060000160';
        const pApr = idade < 5 ? 0 : rnd() < (lento ? 0.35 : 0.8) ? 1 : rnd() < 0.3 ? 0.5 : 0;
        const noFisco = idade >= 2 && rnd() > 0.05;
        const base = {lado: 'credito', chave, emit: {cnpj: f[0], nome: f[1]}, dest: {cnpj: e.cnpj, nome: e.nome}, data, competencia: data.slice(0, 7), modelo: '55', finalidade: '1', credPresumido: false};
        if (noFisco) fisco.push(Object.assign({}, base, {vbc, pcbs: pc, vcbs, vibs, aprCbs: Math.round(vcbs * pApr * 100) / 100, aprIbs: Math.round(vibs * pApr * 100) / 100, extCbs: 0, extIbs: 0, forma: ''}));
        if (rnd() > 0.08 || !noFisco) {
          const div = noFisco && rnd() < 0.08;
          xml.push(Object.assign({}, base, {vbc: div ? Math.round(vbc * 1.1 * 100) / 100 : vbc, pcbs: pc, vcbs: div ? Math.round(vcbs * 1.1 * 100) / 100 : vcbs, vibs, temGrupo: true}));
        }
        if (ie === 0 && noFisco) erp.push(Object.assign({}, base, {vbc, pcbs: pc, vcbs: rnd() < 0.05 ? vcbs + 10 : vcbs, vibs, contabilizado: pApr === 1 && rnd() < 0.5, pago: true}));
      }
      for (let i = 0; i < nDeb; i++) {
        const c = pick(clientes), idade = Math.floor(rnd() * 80), data = addDias(dataBase, idade);
        const vbc = Math.round((2000 + rnd() * 30000) * 100) / 100, vcbs = Math.round(vbc * pc) / 100, vibs = Math.round(vbc * pi) / 100;
        const chave = mkChave(e.cnpj, data), forma = idade < 3 ? '' : pick(['split', 'split', 'pagamento', 'compensacao', 'rad', '']);
        const base = {lado: 'debito', chave, emit: {cnpj: e.cnpj, nome: e.nome}, dest: {cnpj: c[0], nome: c[1]}, data, competencia: data.slice(0, 7), modelo: '55', finalidade: '1', credPresumido: false};
        if (idade >= 2) fisco.push(Object.assign({}, base, {vbc, pcbs: pc, vcbs, vibs, aprCbs: 0, aprIbs: 0, extCbs: forma ? vcbs : 0, extIbs: forma ? vibs : 0, forma}));
        xml.push(Object.assign({}, base, {vbc, pcbs: pc, vcbs, vibs, temGrupo: true}));
        if (ie === 0) erp.push(Object.assign({}, base, {vbc, pcbs: pc, vcbs, vibs, contabilizado: true, pago: false}));
      }
    });
    dados = {xml, fisco, erp, dataExtrato: '2027-03-19', arquivos: [], demo: true};
    conf.empresas = empresas.map(e => Object.assign({}, e));
    conf.dataBase = dataBase;
    conf.autorizados = {'10101010': ['50505050', '70707070'], '20202020': ['50505050']};
    conf.tetos = {'10101010': 6000, '20202020': 3000};
    conf.decisoes = {}; conf.saldos = {'10101010|2027-03': {anterior: 1250.4, redutores: 0}};
    salvarDados(); salvarConf();
    S.filtro = {}; S.aba = 'visao';
    render(); msg('Demonstração carregada: três empresas e fornecedores fictícios, data-base 20/03/2027, alíquotas ilustrativas.', 'ok');
  }

  /* ===== Filtro global (gaveta) ===== */
  function abrirFiltro() {
    const f = S.filtro, emp = f.empresas || [];
    const sits = S.lado === 'credito' ? A.SITUACOES.credito : A.SITUACOES.debito;
    $('aa-filtro-in').innerHTML = '<div class="aa-cardcab"><h3>Filtros</h3><button type="button" class="aa-link" data-acao="fechar-filtro">Fechar</button></div>' +
      '<p class="aa-nota">O filtro vale em todas as abas.</p>' +
      '<fieldset><legend>Empresa</legend><div class="aa-checks">' + conf.empresas.map(e => '<label class="check"><input type="checkbox" data-f="empresas" value="' + e.base + '"' + (emp.indexOf(e.base) >= 0 ? ' checked' : '') + '>' + esc(e.nome) + '</label>').join('') + '</div></fieldset>' +
      '<label>Contraparte (nome ou CNPJ)<input data-f="fornecedor" value="' + esc(f.fornecedor || '') + '"></label>' +
      '<fieldset><legend>Situação</legend><div class="aa-checks">' + [...A.SITUACOES.credito, ...A.SITUACOES.debito.slice(1)].map(s => '<label class="check"><input type="checkbox" data-f="situacoes" value="' + s[0] + '"' + ((f.situacoes || []).indexOf(s[0]) >= 0 ? ' checked' : '') + '>' + s[1] + '</label>').join('') + '</div></fieldset>' +
      '<fieldset><legend>Prazo</legend><div class="aa-checks">' + Object.keys(NIVEL).map(n => '<label class="check"><input type="checkbox" data-f="niveis" value="' + n + '"' + ((f.niveis || []).indexOf(n) >= 0 ? ' checked' : '') + '>' + NIVEL[n][0] + '</label>').join('') + '</div></fieldset>' +
      '<div class="grade2"><label>Valor mín. (R$)<input data-f="valorMin" inputmode="decimal" value="' + esc(f.valorMin || '') + '"></label><label>Valor máx. (R$)<input data-f="valorMax" inputmode="decimal" value="' + esc(f.valorMax || '') + '"></label>' +
      '<label>Aging mín. (dias)<input data-f="agingMin" inputmode="numeric" value="' + esc(f.agingMin || '') + '"></label><label>Aging máx. (dias)<input data-f="agingMax" inputmode="numeric" value="' + esc(f.agingMax || '') + '"></label></div>' +
      '<label>Chave (parte)<input data-f="chave" inputmode="numeric" value="' + esc(f.chave || '') + '"></label>' +
      '<div class="acoes"><button type="button" class="btn" data-acao="aplicar-filtro">Aplicar</button><button type="button" class="btn-secundario" data-acao="limpar-filtro">Limpar</button></div>' +
      '<h4>Filtros salvos</h4><div class="aa-barbusca"><input id="aa-nome-filtro" placeholder="Nome do filtro" aria-label="Nome do filtro"><button type="button" class="btn-secundario" data-acao="salvar-filtro">Salvar atual</button></div>' +
      (conf.filtrosSalvos.length ? '<ul class="aa-lista">' + conf.filtrosSalvos.map((s, i) => '<li><button type="button" class="aa-link" data-acao="usar-filtro" data-v="' + i + '">' + esc(s.nome) + '</button> <button type="button" class="aa-link" data-acao="copiar-filtro" data-v="' + i + '">Copiar</button> <button type="button" class="aa-link bad" data-acao="apagar-filtro" data-v="' + i + '">Apagar</button></li>').join('') + '</ul>' : '<p class="aa-nota">Nenhum.</p>') +
      '<label>Colar filtro compartilhado<input id="aa-colar-filtro" placeholder="Cole aqui o texto copiado por um colega"></label><button type="button" class="btn-secundario" data-acao="colar-filtro">Usar filtro colado</button>';
    $('aa-filtro').hidden = false; $('aa-btn-filtro').setAttribute('aria-expanded', 'true');
    const p = $('aa-filtro-in').querySelector('input'); if (p) p.focus();
  }
  function lerFiltro() {
    const root = $('aa-filtro-in'), f = {competencia: S.filtro.competencia || ''};
    ['empresas', 'situacoes', 'niveis'].forEach(k => { const v = [...root.querySelectorAll('[data-f="' + k + '"]')].filter(x => x.checked).map(x => x.value); if (v.length) f[k] = v; });
    ['fornecedor', 'valorMin', 'valorMax', 'agingMin', 'agingMax', 'chave'].forEach(k => { const el = root.querySelector('[data-f="' + k + '"]'); if (el && el.value.trim()) f[k] = el.value.trim(); });
    if (!f.competencia) delete f.competencia;
    return f;
  }
  function fecharFiltro() { $('aa-filtro').hidden = true; $('aa-btn-filtro').setAttribute('aria-expanded', 'false'); }
  function aplicarFiltro(f) { S.filtro = f; S.pagina = {docs: 1, conc: 1, fila: 1}; S.sel.clear(); render(); }

  /* ===== Diálogo ===== */
  function abrirDialogo(html) { const d = $('aa-dlg'); $('aa-dlg-in').innerHTML = html; if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); } }
  function fecharDialogo() { const d = $('aa-dlg'); if (d.close) d.close(); else d.removeAttribute('open'); W = null; }
  function confirmar(texto, ok, rotulo) {
    abrirDialogo('<h3>Confirmar</h3><p>' + texto + '</p><div class="acoes"><button type="button" class="btn-secundario" data-acao="fechar-dlg">Cancelar</button><button type="button" class="btn" data-acao="confirmar-ok">' + (rotulo || 'Confirmar') + '</button></div>');
    pendente = ok;
  }
  let pendente = null;

  /* ===== Exportações ===== */
  function exportarAcoes(filtro, nome, colunas) {
    const l = X.exec.acoes.filter(a => X.ids.has(a.doc.id) && filtro(a));
    if (!l.length) { msg('Nada para exportar.', 'bad'); return; }
    baixar(nome, A.csv(l, colunas)); msg(l.length + ' linha(s) exportada(s) em ' + nome + '.', 'ok');
  }
  const colDoc = [[a => a.doc.empresa.nome, 'empresa'], [a => a.doc.empresa.cnpj, 'cnpj_empresa'], [a => a.doc.contraparte.nome, 'contraparte'], [a => a.doc.contraparte.cnpj, 'cnpj_contraparte'], [a => a.doc.chave, 'chave'], [a => dBR(a.doc.data), 'emissao']];
  const dec = v => String(A.r2(v).toFixed(2)).replace('.', ',');

  /* ===== Eventos ===== */
  function ligar() {
    const main = $('main-apuracao');
    main.addEventListener('click', e => {
      const el = e.target.closest('[data-acao]'); if (!el || !main.contains(el)) return;
      const v = el.dataset.v, a = el.dataset.acao;
      switch (a) {
        case 'aba': S.aba = v; render(); break;
        case 'demo': if (dados.xml.length + dados.fisco.length && !dados.demo) confirmar('Substituir os dados importados pela demonstração?', carregarDemo, 'Substituir'); else carregarDemo(); break;
        case 'seg': {
          const k = el.dataset.seg;
          if (k === 'saldo-det') S.saldoDet = v === '1';
          else if (k === 'lado') { S.lado = v; S.pagina.docs = 1; }
          else if (k === 'par') { S.parConc = v; S.grupoConc = ''; S.pagina.conc = 1; }
          else if (k === 'ladoConc') { S.ladoConc = v; S.pagina.conc = 1; }
          else if (k === 'cfgAba') S.cfgAba = v;
          else if (k.indexOf('modo:') === 0) { const r = conf.regras.find(x => x.id === k.slice(5)); if (r) { r.modo = v; salvarConf(); } }
          render(); break;
        }
        case 'balde': {
          const f = Object.assign({}, S.filtro); delete f.situacoes; delete f.niveis;
          if (v === 'vencido') { f.niveis = ['vencido', 'critico']; }
          else if (v === 'no_prazo') { f.niveis = ['no_prazo', 'atencao']; }
          else if (v === 'aguardando') f.situacoes = ['aguardando'];
          else f.situacoes = S.lado === 'credito' ? ['apropriado_total', 'apropriado_parcial'] : ['extinto', 'extinto_parcial'];
          S.aba = 'docs'; aplicarFiltro(f); break;
        }
        case 'filtrar-forn': S.aba = 'docs'; aplicarFiltro(Object.assign({}, S.filtro, {fornecedor: v})); break;
        case 'filtrar-emp': aplicarFiltro(Object.assign({}, S.filtro, {empresas: [v]})); break;
        case 'ver-conc': S.parConc = v; S.aba = 'conc'; S.grupoConc = ''; render(); break;
        case 'ver-comp': S.aba = 'docs'; aplicarFiltro(Object.assign({}, S.filtro, {competencia: v})); break;
        case 'concluir-comp': confirmar('Concluir a competência ' + compBR(v) + '? Os prazos e parâmetros de hoje ficam guardados para ela.', () => { conf.concluidas[v] = {em: X.dataBase, cfg: Object.assign({}, conf.cfg)}; salvarConf(); render(); msg('Competência ' + compBR(v) + ' concluída.', 'ok'); }, 'Concluir'); break;
        case 'reabrir-comp': delete conf.concluidas[v]; salvarConf(); render(); break;
        case 'tirar-filtro': { const f = Object.assign({}, S.filtro); if (v === 'valor') { delete f.valorMin; delete f.valorMax; } else if (v === 'aging') { delete f.agingMin; delete f.agingMax; } else delete f[v]; aplicarFiltro(f); break; }
        case 'limpar-filtro': fecharFiltro(); aplicarFiltro({}); break;
        case 'aplicar-filtro': aplicarFiltro(lerFiltro()); fecharFiltro(); break;
        case 'fechar-filtro': fecharFiltro(); break;
        case 'salvar-filtro': { const n = ($('aa-nome-filtro').value || '').trim() || 'Filtro ' + (conf.filtrosSalvos.length + 1); conf.filtrosSalvos.push({nome: n, filtro: lerFiltro()}); salvarConf(); abrirFiltro(); break; }
        case 'usar-filtro': aplicarFiltro(clone(conf.filtrosSalvos[Number(v)].filtro)); fecharFiltro(); break;
        case 'apagar-filtro': conf.filtrosSalvos.splice(Number(v), 1); salvarConf(); abrirFiltro(); break;
        case 'copiar-filtro': {
          const txt = 'AA-FILTRO:' + JSON.stringify(conf.filtrosSalvos[Number(v)]);
          (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => msg('Filtro copiado. Quem colar precisa ter as mesmas empresas importadas.', 'ok'), () => msg('Não consegui copiar.', 'bad'));
          break;
        }
        case 'colar-filtro': {
          try { const t = $('aa-colar-filtro').value.trim().replace(/^AA-FILTRO:/, ''); const o = JSON.parse(t); conf.filtrosSalvos.push({nome: String(o.nome || 'Filtro colado'), filtro: o.filtro || {}}); salvarConf(); aplicarFiltro(o.filtro || {}); fecharFiltro(); }
          catch (err) { msg('Texto de filtro inválido.', 'bad'); }
          break;
        }
        case 'pag': S.pagina[el.dataset.p] += Number(v); render(); break;
        case 'detalhe': detalhe(v); break;
        case 'fechar-dlg': fecharDialogo(); break;
        case 'confirmar-ok': { const f = pendente; pendente = null; fecharDialogo(); if (f) f(); break; }
        case 'grupo-conc': S.grupoConc = S.grupoConc === v ? '' : v; S.pagina.conc = 1; render(); break;
        case 'fila-status': S.filaStatus = S.filaStatus === v ? '' : v; S.pagina.fila = 1; S.sel.clear(); render(); break;
        case 'sel': if (el.checked) S.sel.add(v); else S.sel.delete(v); render(); break;
        case 'sel-todos': { const {itens} = paginar(filaFiltrada(), 'fila'); itens.forEach(x => { if (el.checked) S.sel.add(x.id); else S.sel.delete(x.id); }); render(); break; }
        case 'lote': {
          const ids = [...S.sel];
          const rads = X.exec.acoes.filter(x => ids.indexOf(x.id) >= 0 && x.tratativa === 'rad');
          if (v === 'aprovada' && rads.length) confirmar('Aprovar ' + rads.length + ' RAD(s), ' + brl(rads.reduce((s, x) => s + x.valor, 0)) + '? Isso é recolhimento com dinheiro da empresa. As travas de fornecedor, teto e regime continuam valendo.', () => decidir(ids, v), 'Aprovar');
          else decidir(ids, v);
          break;
        }
        case 'exp-rad': exportarAcoes(x => x.tratativa === 'rad' && x.status === 'pronta', 'rads-a-emitir.csv',
          colDoc.concat([[x => dec(x.doc.lado === 'credito' && x.doc.fisco ? x.doc.fisco.vcbs - x.doc.fisco.aprCbs : 0), 'cbs_a_recolher'], [x => dec(x.doc.fisco ? x.doc.fisco.vibs - x.doc.fisco.aprIbs : 0), 'ibs_a_recolher'], [x => x.doc.aging, 'aging_dias'], [x => x.regra.nome, 'regra']])); break;
        case 'exp-erp': exportarAcoes(x => x.tratativa === 'erp' && x.status === 'pronta', 'lancamentos-erp.csv',
          colDoc.concat([[x => dBR(X.dataBase), 'data_lancamento'], [x => x.doc.lado === 'credito' ? conf.cfg.contaDefinitiva : 'Débito de CBS/IBS a pagar', 'conta_debito'], [x => x.doc.lado === 'credito' ? conf.cfg.contaTransitoria : 'Baixa: extinto por ' + ((x.doc.fisco && x.doc.fisco.forma) || '—'), 'conta_credito'], [x => dec(x.valor), 'valor'], [x => x.regra.nome, 'historico']])); break;
        case 'exp-ncnd': exportarAcoes(x => (x.tratativa === 'ncnd' || x.tratativa === 'evento') && x.status === 'pronta', 'ncnd-e-eventos.csv',
          colDoc.concat([[x => A.ROTULO_TRATATIVA[x.tratativa], 'acao'], [x => dec(x.valor), 'valor'], [x => x.regra.nome, 'regra']])); break;
        case 'exp-fila': exportarAcoes(() => true, 'fila-de-acoes.csv', colDoc.concat([[x => x.regra.nome, 'regra'], [x => A.ROTULO_TRATATIVA[x.tratativa], 'tratativa'], [x => x.modo, 'modo'], [x => dec(x.valor), 'valor'], [x => ST_FILA[x.status][0], 'status'], [x => x.motivo, 'motivo']])); break;
        case 'exportar-docs': {
          const l = docsDoLado(); if (!l.length) { msg('Nada para exportar.', 'bad'); break; }
          baixar((S.lado === 'credito' ? 'creditos' : 'debitos') + '.csv', A.csv(l, [[d => d.empresa.nome, 'empresa'], [d => d.contraparte.nome, 'contraparte'], [d => d.contraparte.cnpj, 'cnpj_contraparte'], [d => d.chave, 'chave'], [d => dBR(d.data), 'emissao'], [d => compBR(d.competencia), 'competencia'],
            [d => dec(d.potencial), 'potencial'], [d => dec(d.efetivado), S.lado === 'credito' ? 'apropriado' : 'extinto'], [d => dec(d.naoEfetivado), 'em_aberto'], [d => A.ROTULO_SITUACAO[d.situacao], 'situacao'], [d => NIVEL[d.nivel][0], 'prazo'], [d => d.aging, 'aging_dias'], [d => (X.exec.retidaPor[d.id] || []).join(' | '), 'retida_por']]));
          break;
        }
        case 'exportar-conc': {
          const c = A.conciliar(docsPar(X.filtrados, S.parConc), S.parConc, S.ladoConc, conf.cfg.tolerancia), l = [];
          Object.keys(c.grupos).forEach(g => c.grupos[g].forEach(x => l.push({g, d: x.doc, campos: x.campos})));
          const o = S.parConc;
          baixar('conciliacao-' + o + '.csv', A.csv(l, [[x => x.g, 'resultado'], [x => x.d.empresa.nome, 'empresa'], [x => x.d.contraparte.nome, 'contraparte'], [x => x.d.chave, 'chave'],
            [x => x.d.fisco ? dec(x.d.fisco.vbc) : '', 'fisco_base'], [x => x.d.fisco ? dec(x.d.fisco.vcbs) : '', 'fisco_cbs'], [x => x.d.fisco ? dec(x.d.fisco.vibs) : '', 'fisco_ibs'],
            [x => x.d[o] ? dec(x.d[o].vbc) : '', o + '_base'], [x => x.d[o] ? dec(x.d[o].vcbs) : '', o + '_cbs'], [x => x.d[o] ? dec(x.d[o].vibs) : '', o + '_ibs'], [x => x.campos.join(','), 'campos_divergentes']]));
          break;
        }
        case 'nova-regra': abrirEditor(A.regraPadrao({id: 'c-' + Date.now().toString(36), nome: '', origem: 'customizada', ligada: true}), true); break;
        case 'editar-regra': abrirEditor(conf.regras.find(r => r.id === v), false); break;
        case 'duplicar-regra': { const r = clone(conf.regras.find(x => x.id === v)); r.id = 'c-' + Date.now().toString(36); r.nome += ' (cópia)'; r.origem = 'customizada'; r.ligada = false; conf.regras.push(r); salvarConf(); render(); break; }
        case 'excluir-regra': confirmar('Excluir a regra? As decisões tomadas sobre as ações dela continuam guardadas.', () => { conf.regras = conf.regras.filter(r => r.id !== v); salvarConf(); render(); }, 'Excluir'); break;
        case 'restaurar-regra': { const p = A.REGRAS_PADRAO.find(r => r.id === v); const i = conf.regras.findIndex(r => r.id === v); if (p && i >= 0) { conf.regras[i] = clone(p); salvarConf(); render(); msg('Regra restaurada ao padrão.', 'ok'); } break; }
        case 'tog-regra': {
          e.preventDefault();
          const r = conf.regras.find(x => x.id === v);
          const sim = A.simularRegra(r, X.base.docs, conf.cfg, X.dataBase);
          confirmar((r.ligada ? 'Desligar' : 'Ligar') + ' "' + esc(r.nome) + '"? ' + (r.ligada ? 'Ela deixa de reter documentos.' : 'Com os dados de hoje, ela reteria <b>' + sim.docs + '</b> documento(s), ' + brl(sim.valor) + '.'),
            () => { r.ligada = !r.ligada; salvarConf(); render(); msg('Regra ' + (r.ligada ? 'ligada' : 'desligada') + '.', 'ok'); }, r.ligada ? 'Desligar' : 'Ligar');
          break;
        }
        case 'tog-aut': {
          const emp = S.empRad, lista = conf.autorizados[emp] = conf.autorizados[emp] || [];
          const i = lista.indexOf(v); if (i >= 0) lista.splice(i, 1); else lista.push(v);
          salvarConf(); render(); break;
        }
        case 'add-emp': {
          const c = A.limparCnpj($('aa-nova-emp-cnpj').value), n = $('aa-nova-emp-nome').value.trim();
          if (c.length !== 14) { msg('CNPJ precisa ter 14 caracteres.', 'bad'); break; }
          if (!conf.empresas.some(x => x.base === A.baseCnpj(c))) conf.empresas.push({cnpj: c, base: A.baseCnpj(c), nome: n || c, regime: 'regular'});
          salvarConf(); render(); break;
        }
        case 'restaurar-prazos': conf.cfg = Object.assign({}, A.PADROES); salvarConf(); render(); msg('Prazos restaurados.', 'ok'); break;
        case 'zerar': confirmar('Apagar todos os dados importados e as configurações da apuração neste navegador? Não dá para desfazer.', () => { dados = dadosVazios(); conf = confPadrao(); salvarDados(); salvarConf(); S.filtro = {}; render(); msg('Tudo apagado.', 'ok'); }, 'Apagar tudo'); break;
        case 'limpar-dados': confirmar('Apagar os dados importados? As regras e configurações ficam.', () => { dados = dadosVazios(); conf.dataBase = ''; salvarDados(); salvarConf(); S.filtro = {}; render(); msg('Dados apagados.', 'ok'); }, 'Apagar'); break;
        case 'modelo': baixar(v === 'fisco' ? 'modelo-extrato-apuracao.csv' : 'modelo-erp.csv', v === 'fisco' ? A.MODELO_EXTRATO : A.MODELO_ERP); break;
        // Editor de regra
        case 'w-avancar': { lerEditor(); const m = validarPasso(); if (m) { $('aa-wmsg').textContent = m; $('aa-wmsg').className = 'status bad'; break; } W.passo++; desenharEditor(); break; }
        case 'w-voltar': lerEditor(); W.passo--; desenharEditor(); break;
        case 'w-ir': lerEditor(); if (W.regra.origem !== 'padrao' || Number(v) === 4) { W.passo = Number(v); desenharEditor(); } break;
        case 'w-add-cond': lerEditor(); W.regra.criterios.condicoes.push({campo: '', op: '>=', valor: ''}); desenharEditor(); break;
        case 'w-tirar-cond': lerEditor(); W.regra.criterios.condicoes.splice(Number(v), 1); desenharEditor(); break;
        case 'w-salvar': {
          lerEditor();
          const r = W.regra, i = conf.regras.findIndex(x => x.id === r.id);
          if (!r.nome.trim()) { W.passo = 1; desenharEditor(); break; }
          if (i >= 0) conf.regras[i] = r; else conf.regras.push(r);
          salvarConf(); const nova = W.nova; fecharDialogo(); render(); msg(nova ? 'Regra criada.' : 'Regra salva.', 'ok');
          break;
        }
      }
    });
    main.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.imp && el.files && el.files.length) { importar(el.dataset.imp, [...el.files]).catch(() => msg('Não consegui ler o arquivo.', 'bad')); el.value = ''; return; }
      if (el.dataset.cond != null && el.dataset.k === 'campo' && W) { lerEditor(); desenharEditor(); return; }
      if (el.dataset.w === 'lado' || el.dataset.w === 'tratativa') { lerEditor(); desenharEditor(); return; }
      if (el.dataset.saldo) {
        const emp = S.filtro.empresas[0], comp = S.filtro.competencia || X.dataBase.slice(0, 7), k = emp + '|' + comp;
        conf.saldos[k] = Object.assign({}, conf.saldos[k], {[el.dataset.saldo]: el.value.trim() === '' ? (el.dataset.saldo === 'informado' ? '' : 0) : A.numero(el.value)});
        salvarConf(); render(); return;
      }
      if (el.dataset.cfg) { conf.cfg[el.dataset.cfg] = A.numero(el.value); salvarConf(); render(); msg('Prazo salvo. Vale da competência corrente em diante.', 'ok'); return; }
      if (el.dataset.cfgTxt) { conf.cfg[el.dataset.cfgTxt] = el.value; salvarConf(); return; }
      if (el.dataset.aviso) { conf.avisos[el.dataset.aviso] = el.checked; salvarConf(); render(); return; }
      if (el.dataset.empNome) { const x = conf.empresas.find(z => z.base === el.dataset.empNome); if (x) { x.nome = el.value.trim() || x.nome; salvarConf(); render(); } return; }
      if (el.dataset.empRegime) { const x = conf.empresas.find(z => z.base === el.dataset.empRegime); if (x) { x.regime = el.value; salvarConf(); render(); } return; }
      switch (el.dataset.campo) {
        case 'ordem-docs': S.ordem.docs = el.value; render(); break;
        case 'fila-trat': S.filaTrat = el.value; S.pagina.fila = 1; render(); break;
        case 'emp-rad': S.empRad = el.value; render(); break;
        case 'teto-rad': conf.tetos[S.empRad] = A.numero(el.value); salvarConf(); render(); msg('Teto salvo.', 'ok'); break;
        case 'data-base': conf.dataBase = el.value; salvarConf(); render(); break;
        case 'data-extrato': dados.dataExtrato = el.value; salvarDados(); render(); break;
      }
    });
    let tBusca = null;
    main.addEventListener('input', e => {
      const k = e.target.dataset.campo || '';
      if (k.indexOf('busca-') !== 0) return;
      const chaveB = k.slice(6), pos = e.target.selectionStart;
      S.busca[chaveB] = e.target.value; S.pagina[chaveB] = 1;
      clearTimeout(tBusca);
      tBusca = setTimeout(() => { render(); const el = $('aa-conteudo').querySelector('[data-campo="' + k + '"]'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (err) { /* ok */ } } }, 250);
    });
    $('aa-comp').addEventListener('change', e => { const f = Object.assign({}, S.filtro); if (e.target.value) f.competencia = e.target.value; else delete f.competencia; aplicarFiltro(f); });
    $('aa-trib').addEventListener('change', e => { conf.tributo = e.target.value; salvarConf(); render(); });
    $('aa-btn-filtro').addEventListener('click', () => { if ($('aa-filtro').hidden) abrirFiltro(); else fecharFiltro(); });
    document.querySelectorAll('#main-apuracao .aa-abas [data-aba]').forEach(b => b.addEventListener('click', () => { S.aba = b.dataset.aba; S.sel.clear(); render(); }));
    $('aa-dlg').addEventListener('close', () => { W = null; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('aa-filtro').hidden) fecharFiltro(); });
    main.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr.clica')) { e.preventDefault(); e.target.click(); } });
  }

  let ligado = false;
  window.ApuracaoUI = {
    entrar() { if (!ligado) { ligar(); ligado = true; } render(); },
  };
})();
