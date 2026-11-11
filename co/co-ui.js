/* Interação das abas do Societário. Gerado por co/sincronizar.py: não edite à mão. */
(function () {
  'use strict';
  const C = window.ICMS;
  const $ = id => document.getElementById(id);
  const brl = v => (v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2});
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const pc = v => (v * 100).toFixed(2).replace('.', ',') + '%';
  const ufs = Object.keys(C.UF).sort();
  ['m-ori', 'm-des'].forEach(id => ufs.forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = k + ' — ' + C.UF[k].nome; $(id).appendChild(o); }));
  $('m-ori').value = 'SP'; $('m-des').value = 'SP';
  function preencher() { const u = C.UF[$('m-des').value]; $('m-aint').value = +(u.interna * 100).toFixed(2); $('m-fcp').value = +(u.fcp * 100).toFixed(2); }
  preencher();
  $('m-des').addEventListener('change', preencher);
  const card = (nome, valor, sub, destaque) => '<div class="co-cartao' + (destaque ? ' melhor' : '') + '"><div class="nome">' + nome + '</div><div class="valor">' + valor + '</div><div class="sub">' + sub + '</div></div>';
  function render() {
    const n = id => parseFloat($(id).value) || 0, dest = $('m-dest').value;
    $('form-icms').querySelector('[data-m="consumo"]').hidden = !(dest === 'consumo' && $('m-ori').value !== $('m-des').value);
    $('form-icms').querySelector('[data-m="st"]').hidden = !$('m-st').checked;
    const e = {origem: $('m-ori').value, destino: $('m-des').value, destinatario: dest, importado: $('m-imp').checked, valorComICMS: $('m-com').checked,
      produtos: n('m-prod'), ipi: n('m-ipi'), frete: n('m-frete'), despesas: n('m-desp'), desconto: n('m-desc'), reducaoBC: n('m-red') / 100,
      aliqInterna: n('m-aint') / 100, fcp: n('m-fcp') / 100, baseDifal: $('m-bd').value,
      st: {ativo: $('m-st').checked, mva: n('m-mva') / 100, aliqInterna: $('m-aist').value === '' ? '' : n('m-aist') / 100}};
    const r = C.calcular(e);
    $('m-cartoes').innerHTML = card('ICMS da operação', brl(r.icms + r.fcp), (r.interna ? 'interna ' : 'interestadual ') + pc(r.aliqOperacao) + (r.fcp ? ' + FCP' : ''), true) +
      card('DIFAL ' + (dest === 'naocontrib' ? '(pago pelo remetente)' : '(pago pelo destinatário)'), brl(r.difal + r.fcpDifal), r.interna || dest === 'revenda' ? 'não se aplica' : 'para ' + e.destino + (r.fcpDifal ? ', com FCP ' + brl(r.fcpDifal) : '')) +
      card('ICMS-ST', brl(r.st + r.fcpSt), e.st.ativo ? 'MVA ' + pc(r.mvaAjustada) + (r.mvaAjustada !== e.st.mva ? ' (ajustada)' : '') : 'não marcada');
    $('m-avisos').innerHTML = r.avisos.map(a => '<div class="co-aviso">' + esc(a) + '</div>').join('');
    const linhas = [['Valor da operação (base antes da redução)', r.valorOp], ['Base de cálculo do ICMS', r.base], ['ICMS próprio (' + pc(r.aliqOperacao) + ')', r.icms]];
    if (r.fcp) linhas.push(['FCP', r.fcp]);
    if (r.difal || r.fcpDifal) linhas.push(['Base do DIFAL', r.baseDifal], ['DIFAL', r.difal], ['FCP do DIFAL', r.fcpDifal]);
    if (e.st.ativo) linhas.push(['Base da ST', r.baseST], ['ICMS-ST', r.st], ['FCP-ST', r.fcpSt]);
    linhas.push(['Total de ICMS na operação', r.total]);
    $('m-res').innerHTML = '<tbody>' + linhas.map((l, i) => '<tr' + (i === linhas.length - 1 ? ' class="total"' : '') + '><td>' + l[0] + '</td><td>' + brl(l[1]) + '</td></tr>').join('') +
      '<tr><td>Carga sobre o valor da operação</td><td>' + pc(r.cargaPct) + '</td></tr></tbody>';
    const pv = C.previsao(r, {cbsRef: n('m-cbs') / 100, ibsRef: n('m-ibs') / 100, reducao: +$('m-redr').value, pisCofins: +$('m-pc').value});
    const lin = (rot, f, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + rot + '</td>' + pv.map(f).join('') + '</tr>';
    const td = v => '<td>' + v + '</td>';
    $('m-proj').innerHTML = '<thead><tr><th>Ano</th>' + pv.map(p => '<th>' + p.ano + '</th>').join('') + '</tr></thead><tbody>' +
      lin('ICMS (% das alíquotas)', p => td(Math.round(p.fatorICMS * 100) + '%')) +
      lin('ICMS total da operação', p => td(brl(p.icms))) +
      lin('PIS/COFINS', p => td(brl(p.pisCofins))) +
      lin('CBS', p => td(brl(p.cbs) + '<div class="dica">' + pc(p.aliqCbs) + (p.teste ? ' teste' : '') + '</div>')) +
      lin('IBS', p => td(brl(p.ibs) + '<div class="dica">' + pc(p.aliqIbs) + (p.teste ? ' teste' : '') + '</div>')) +
      lin('Tributos sobre consumo', p => td(brl(p.total)), 'total') +
      lin('% do valor da operação de 2026', p => td(pc(p.pct))) +
      lin('Variação sobre 2026', p => td((p.total >= pv[0].total ? '+' : '') + brl(p.total - pv[0].total))) + '</tbody>';
    $('m-memoria').innerHTML = r.memoria.map(m => '<li>' + esc(m) + '</li>').join('');
    $('m-orinome').textContent = C.UF[e.origem].nome;
    $('m-tab').innerHTML = '<thead><tr><th>UF</th><th>Estado</th><th>Alíquota geral</th><th>FCP geral</th><th>Interestadual de ' + e.origem + '</th><th>Observação</th></tr></thead><tbody>' +
      ufs.map(k => { const u = C.UF[k], it = C.interestadual(e.origem, k, e.importado); return '<tr' + (k === e.destino ? ' class="total"' : '') + '><td>' + k + '</td><td>' + esc(u.nome) + '</td><td>' + pc(u.interna) + '</td><td>' + (u.fcp ? pc(u.fcp) : '—') + '</td><td>' + (it === null ? 'interna' : pc(it)) + '</td><td>' + esc(u.obs || '') + '</td></tr>'; }).join('') + '</tbody>';
  }
  $('form-icms').addEventListener('input', render);
  $('form-icms').addEventListener('change', render);
  $('form-icms').addEventListener('submit', ev => ev.preventDefault());
  render();
})();
(function () {
  'use strict';
  const G = window.GCAP;
  const $ = id => document.getElementById(id);
  const brl = v => (v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2});
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const dt = s => s ? s.split('-').reverse().join('/') : '';
  const rot = s => { const [a, m] = String(s).split('-'); return m + '/' + a; };
  const caixa = 'border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px';
  function linha(alvo, html) {
    const d = document.createElement('div'); d.className = 'g-item'; d.style.cssText = caixa; d.innerHTML = html + '<button class="co-btn" type="button" style="margin-top:6px">Remover</button>';
    d.querySelector('button').addEventListener('click', () => { d.remove(); render(); });
    $(alvo).appendChild(d);
  }
  const benf = v => linha('g-benf', '<input class="b-desc" type="text" placeholder="Descrição (ex.: ampliação, reforma da cozinha)" value="' + esc(v && v.descricao || '') + '"><div class="linha2"><div><label>Mês</label><input class="b-data" type="month" value="' + (v && v.data || '') + '"></div><div><label>Valor (R$)</label><input class="b-val" type="number" min="0" step="1000" value="' + (v && v.valor || 0) + '"></div></div>');
  const prop = v => linha('g-props', '<div class="linha2"><div><label>Nome</label><input class="p-nome" type="text" value="' + esc(v && v.nome || '') + '"></div><div><label>Participação (%)</label><input class="p-pct" type="number" min="0" max="100" step="0.01" value="' + (v ? v.pct : 100) + '"></div></div>' +
    '<label class="co-check"><input class="p-unico" type="checkbox"> Único imóvel e sem venda de imóvel nos últimos 5 anos</label>' +
    '<label>Valor aplicado em imóvel residencial em até 180 dias (R$)</label><input class="p-rein" type="number" min="0" step="1000" value="0">' +
    '<label class="co-check"><input class="p-res" type="checkbox" checked> O imóvel vendido é residencial (condição do reinvestimento)</label>');
  const receb = v => linha('g-receb', '<div class="linha2"><div><label>Mês do recebimento</label><input class="r-data" type="month" value="' + (v && v.data || '') + '"></div><div><label>Valor recebido (R$)</label><input class="r-val" type="number" min="0" step="1000" value="' + (v && v.valor || 0) + '"></div></div>');
  prop({nome: 'Vendedor', pct: 100});
  $('g-addb').addEventListener('click', () => { benf(); render(); });
  $('g-addp').addEventListener('click', () => { prop({nome: '', pct: 0}); render(); });
  $('g-addr').addEventListener('click', () => { receb(); render(); });
  $('g-prazo').addEventListener('change', () => {
    const on = $('g-prazo').checked; $('g-receb').hidden = !on; $('g-addr').hidden = !on;
    if (on && !$('g-receb').children.length) { const v = +$('g-valor').value || 0; receb({data: $('g-data').value, valor: Math.round(v * .3)}); receb({data: '', valor: Math.round(v * .7)}); }
    render();
  });
  $('g-orig').addEventListener('change', () => { const o = $('g-orig').value; $('g-aqrot').textContent = o === 'heranca' ? 'Mês do óbito' : o === 'doacao' ? 'Mês da doação' : 'Mês da aquisição'; });
  function ler() {
    const n = id => parseFloat($(id).value) || 0, all = (sel, f) => [...document.querySelectorAll(sel)].map(f);
    return {venda: $('g-data').value, valorVenda: n('g-valor'), corretagem: n('g-corr'), origem: $('g-orig').value,
      aquisicao: {data: $('g-aqdata').value, valor: n('g-aqvalor')},
      benfeitorias: all('#g-benf .g-item', d => ({descricao: d.querySelector('.b-desc').value, data: d.querySelector('.b-data').value, valor: +d.querySelector('.b-val').value || 0})),
      proprietarios: all('#g-props .g-item', d => ({nome: d.querySelector('.p-nome').value, pct: (+d.querySelector('.p-pct').value || 0) / 100, unico: d.querySelector('.p-unico').checked, reinvestido: +d.querySelector('.p-rein').value || 0, residencial: d.querySelector('.p-res').checked})),
      recebimentos: $('g-prazo').checked ? all('#g-receb .g-item', d => ({data: d.querySelector('.r-data').value, valor: +d.querySelector('.r-val').value || 0})) : [],
      pagamento: $('g-pag').value, selicAcumulada: n('g-selic') / 100};
  }
  const card = (nome, valor, sub, destaque) => '<div class="co-cartao' + (destaque ? ' melhor' : '') + '"><div class="nome">' + nome + '</div><div class="valor">' + valor + '</div><div class="sub">' + sub + '</div></div>';
  let ultimo = null;
  function render() {
    const e = ler();
    if (!/^\d{4}-\d{2}$/.test(e.venda) || !/^\d{4}-\d{2}$/.test(e.aquisicao.data)) { $('g-cartoes').innerHTML = card('Informe as datas', '—', 'mês da venda e da aquisição'); return; }
    let r; try { r = G.calcular(e); } catch (err) { $('g-cartoes').innerHTML = card('Erro', '—', esc(err.message)); return; }
    ultimo = r;
    const efet = r.ganho > 0 ? r.irTotal / r.ganho : 0;
    $('g-cartoes').innerHTML = card('IR sobre ganho de capital', brl(r.irTotal), r.irTotal ? 'alíquota efetiva ' + (efet * 100).toFixed(2).replace('.', ',') + '% do ganho' : (r.ganho > 0 ? 'isento ou reduzido a zero' : 'sem ganho'), true) +
      card('Ganho de capital', brl(r.ganho), 'base após reduções: ' + brl(r.baseTotal)) +
      card('Líquido para o vendedor', brl(r.V0 - r.corr - r.irTotal), 'venda − corretagem − IR');
    $('g-avisos').innerHTML = r.avisos.map(a => '<div class="co-aviso">' + esc(a) + '</div>').join('');
    $('g-tprop').innerHTML = '<thead><tr><th>Proprietário</th><th>Parte</th><th>Valor da parte</th><th>Ganho</th><th>Base tributável</th><th>IR</th></tr></thead><tbody>' +
      r.proprietarios.map(p => '<tr><td>' + esc(p.nome) + (p.isencao ? '<div class="dica">' + esc(p.isencao) + '</div>' : '') + '</td><td>' + (p.pct * 100).toFixed(2).replace('.', ',') + '%</td><td>' + brl(p.valorParte) + '</td><td>' + brl(p.ganho) + '</td><td>' + brl(p.base) + '</td><td>' + brl(p.ir) + '</td></tr>').join('') +
      '<tr class="total"><td>Total</td><td></td><td>' + brl(r.V0) + '</td><td>' + brl(r.ganho) + '</td><td></td><td>' + brl(r.irTotal) + '</td></tr></tbody>';
    const atr = r.darfs.some(d => d.atraso.dias > 0);
    $('g-tdarf').innerHTML = '<thead><tr><th>Recebimento</th><th>Valor recebido</th><th>IR (principal)</th><th>Vencimento</th>' + (atr ? '<th>Dias de atraso</th><th>Multa</th><th>Juros</th><th>Total</th>' : '') + '</tr></thead><tbody>' +
      r.darfs.map(d => '<tr><td>' + rot(d.mes) + '</td><td>' + brl(d.recebido) + '</td><td>' + brl(d.valor) + '</td><td>' + dt(d.vencimento) + '</td>' + (atr ? '<td>' + d.atraso.dias + '</td><td>' + brl(d.atraso.multa) + '</td><td>' + brl(d.atraso.juros) + '</td><td>' + brl(d.atraso.total) + '</td>' : '') + '</tr>').join('') + '</tbody>';
    $('g-tparc').innerHTML = '<thead><tr><th>Parcela do custo</th><th>Mês</th><th>Valor</th><th>Ganho rateado</th><th>Redução 7.713</th><th>FR1</th><th>FR2</th><th>Base</th></tr></thead><tbody>' +
      r.parcelas.map(p => '<tr><td>' + esc(p.descricao) + '</td><td>' + rot(p.data) + '</td><td>' + brl(p.valor) + '</td><td>' + brl(p.ganho) + '</td><td>' + (p.red7713 ? Math.round(p.red7713 * 100) + '%' : '—') + '</td><td>' + p.fr1.toFixed(6).replace('.', ',') + '</td><td>' + p.fr2.toFixed(6).replace('.', ',') + '</td><td>' + brl(p.base) + '</td></tr>').join('') + '</tbody>';
    $('g-memoria').innerHTML = r.memoria.map(m => '<li>' + esc(m) + '</li>').join('');
  }
  $('g-copiar').addEventListener('click', () => {
    if (!ultimo) return; const r = ultimo;
    const t = ['Ganho de capital — venda de imóvel (pessoa física)', 'Venda em ' + rot(r.venda) + ': ' + brl(r.V0) + (r.corr ? ' (corretagem ' + brl(r.corr) + ')' : ''), 'Custo: ' + brl(r.custo), 'Ganho: ' + brl(r.ganho) + '; base após reduções: ' + brl(r.baseTotal)]
      .concat(r.proprietarios.map(p => p.nome + ' (' + (p.pct * 100).toFixed(2).replace('.', ',') + '%): IR ' + brl(p.ir) + (p.isencao ? ' — ' + p.isencao : '')))
      .concat(r.darfs.map(d => 'DARF 4600: ' + brl(d.valor) + ', vencimento ' + dt(d.vencimento)))
      .concat(['IR total: ' + brl(r.irTotal), 'Estimativa — Controller & Oraculu\'s. Conferir no programa GCAP da Receita Federal.']).join('\n');
    navigator.clipboard && navigator.clipboard.writeText(t).then(() => { $('g-copiar').textContent = 'Copiado!'; setTimeout(() => { $('g-copiar').textContent = 'Copiar resumo'; }, 1500); });
  });
  $('form-gcap').addEventListener('input', render);
  $('form-gcap').addEventListener('change', render);
  $('form-gcap').addEventListener('submit', ev => ev.preventDefault());
  render();
})();
(function () {
  'use strict';
  const K = window.Construcao, M = window.MotorCO;
  const $ = id => document.getElementById(id);
  const brl = v => (v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0});
  const pct = v => ((v || 0) * 100).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 2}) + '%';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const CORES = {ret: '--s1', simples: '--s1', presumido: '--s3', real: '--s4', lote: '--s2'};
  let ano = 2027;

  // Abas
  document.querySelectorAll('#main-co .co-abas button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#main-co .co-abas button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('#main-co .co-aba').forEach(m => { m.hidden = m.id !== 'aba-' + b.dataset.aba; });
    if (b.dataset.aba === 'obra') render();
  }));

  M.PARAM.anos.forEach(a => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = a; b.dataset.ano = a;
    b.addEventListener('click', () => { ano = a; render(); });
    $('o-anos').appendChild(b);
  });

  function ler() {
    const n = id => parseFloat($(id).value) || 0;
    const tipo = $('o-tipo').value;
    const base = {cbsRef: n('o-cbsRef') / 100, ibsRef: n('o-ibsRef') / 100};
    if (tipo === 'incorporacao') return {tipo, e: Object.assign(base, {receita: n('o-receita-i'), terreno: n('o-terreno'), obra: n('o-obra'), obraAte2026: n('o-ate2026') / 100, obraCredito: n('o-credito') / 100, despesas: n('o-despesas'), unidades: n('o-unidades'), lotes: n('o-lotes'), social: $('o-social').checked, loteamento: $('o-loteamento').checked, precoSemTributo: $('o-semtrib').checked, ded488: n('o-ded488'), redSocialUnidade: n('o-rsun'), redSocialLote: n('o-rslote'), ipca: n('o-ipca') / 100, area: n('o-area'), equivalencia: n('o-equiv') / 100, vau: n('o-vau'), tipoObra: $('o-tipoobra').value, folhaObra: n('o-folhaobra'), maoObraNotas: n('o-notas'), aliqAfericao: n('o-aliqaf') / 100})};
    return {tipo, e: Object.assign(base, {receita: n('o-receita-c'), folha: n('o-folha'), margem: n('o-margem') / 100, comMaterial: $('o-commaterial').checked, material: n('o-material') / 100, iss: n('o-iss') / 100, ratTerceiros: n('o-rat') / 100, dedMaterialIss: $('o-dediss').checked, cprb: $('o-cprb').checked, issRetido: $('o-issret').checked})};
  }

  function render() {
    const {tipo, e} = ler();
    document.querySelectorAll('#form-obra [data-tipo]').forEach(g => { g.hidden = g.dataset.tipo !== tipo; });
    const proj = K.projecao(tipo, e);
    const res = proj.find(p => p.ano === ano);
    document.querySelectorAll('#o-anos button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.ano === ano)));
    const ordem = (tipo === 'incorporacao' ? ['ret', 'presumido', 'real', 'lote'] : ['simples', 'presumido', 'real']).filter(k => proj.some(x => x.regimes[k]));
    const eleg = ordem.filter(k => res.regimes[k] && res.regimes[k].elegivel);
    const melhor = eleg.slice().sort((a, b) => res.regimes[a].total - res.regimes[b].total)[0];

    $('o-cartoes').innerHTML = ordem.map(k => {
      const r = res.regimes[k] || {nome: proj.find(x => x.regimes[k]).regimes[k].nome, elegivel: false, motivo: 'Opção disponível a partir de 2027'};
      if (!r.elegivel) return '<div class="co-cartao ne"><div class="nome"><span class="ponto" style="background:var(' + CORES[k] + ')"></span>' + esc(r.nome) + '</div><div class="valor">Não se aplica</div><div class="sub">' + esc(r.motivo) + '</div></div>';
      const top = k === melhor;
      return '<div class="co-cartao' + (top ? ' melhor' : '') + '">' + (top ? '<span class="co-selo">Menor carga</span>' : '') +
        '<div class="nome"><span class="ponto" style="background:var(' + CORES[k] + ')"></span>' + esc(r.nome) + '</div>' +
        '<div class="valor">' + brl(r.total) + '</div><div class="sub">' + pct(r.efetiva) + ' da receita</div>' +
        (top ? '' : '<div class="sub">+' + brl(r.total - res.regimes[melhor].total) + ' no ano</div>') + '</div>';
    }).join('');
    $('o-avisos').innerHTML = res.avisos.map(a => '<div class="co-aviso">' + esc(a) + '</div>').join('');
    let x = '';
    if (res.afericao) {
      const f = res.afericao;
      x = '<h2>INSS da obra — aferição no Sero (independe do regime)</h2><div class="faixa-box" style="margin:0 0 10px"><div><small>RMT calculada</small><b>' + brl(f.rmt) + '</b></div><div><small>Créditos comprovados</small><b>' + brl(f.creditos) + '</b></div><div><small>Diferença</small><b>' + brl(f.diferenca) + '</b></div><div><small>INSS a recolher</small><b>' + brl(f.inss) + '</b></div></div><ul style="margin:0;padding-left:18px;color:var(--text-2);font-size:13px">' + f.memoria.map(m => '<li>' + esc(m.texto) + (m.valor !== null ? ': <b>' + brl(m.valor) + '</b>' : '') + '</li>').join('') + '</ul><div class="dica" style="margin-top:6px">Pode haver redução de 70% com pré-moldados e outras hipóteses da IN RFB 2.021/2021, e a obra com contabilidade regular pode ser aferida pela escrituração. Para a certidão (CND da obra), o valor é recolhido pela DCTFWeb Aferição.</div>';
    } else if (res.retencoes) {
      const r = res.retencoes;
      x = '<h2>Retenções na fonte em ' + ano + ' (caixa)</h2><div class="faixa-box" style="margin:0"><div><small>Base da retenção de INSS</small><b>' + brl(r.baseInss) + '</b></div><div><small>INSS retido (' + (r.pInss * 100).toFixed(1).replace('.', ',') + '%)</small><b>' + brl(r.inss) + '</b></div><div><small>ISS retido</small><b>' + (r.iss ? brl(r.iss) : '—') + '</b></div><div><small>Total retido no ano</small><b>' + brl(r.inss + r.iss) + '</b></div></div>';
    }
    $('o-extra').innerHTML = x; $('o-extra').hidden = !x;

    $('o-titulo-tabela').textContent = 'Tributos por regime em ' + ano + ' (valores anuais)';
    const nomes = [];
    eleg.forEach(k => res.regimes[k].itens.forEach(i => { if (!nomes.includes(i.nome)) nomes.push(i.nome); }));
    let h = '<thead><tr><th>Tributo</th>' + eleg.map(k => '<th>' + esc(res.regimes[k].nome) + '</th>').join('') + '</tr></thead><tbody>';
    nomes.forEach(n => {
      const info = eleg.some(k => (res.regimes[k].itens.find(i => i.nome === n) || {}).info);
      h += '<tr' + (info ? ' class="info"' : '') + '><td>' + esc(n.trim()) + '</td>' + eleg.map(k => { const it = res.regimes[k].itens.find(i => i.nome === n); return '<td>' + (it ? brl(it.valor) : '—') + '</td>'; }).join('') + '</tr>';
    });
    h += '<tr class="total"><td>Total de tributos</td>' + eleg.map(k => '<td>' + brl(res.regimes[k].total) + '</td>').join('') + '</tr>';
    h += '<tr><td>Carga sobre a receita</td>' + eleg.map(k => '<td>' + pct(res.regimes[k].efetiva) + '</td>').join('') + '</tr>';
    h += '<tr><td>Lucro depois dos tributos</td>' + eleg.map(k => '<td>' + brl(res.regimes[k].sobra) + '</td>').join('') + '</tr>';
    h += '<tr><td>Crédito de CBS/IBS para o comprador</td>' + eleg.map(k => '<td>' + (ano >= 2027 ? brl(res.regimes[k].credito) : '—') + '</td>').join('') + '</tr></tbody>';
    $('o-tabela').innerHTML = h;

    let p = '<table><thead><tr><th>Regime</th>' + M.PARAM.anos.map(a => '<th>' + a + '</th>').join('') + '</tr></thead><tbody>';
    ordem.forEach(k => { p += '<tr><td>' + esc(proj.find(x => x.regimes[k]).regimes[k].nome) + '</td>' + proj.map(x => { const r = x.regimes[k]; return '<td' + (x.ano === ano ? ' style="font-weight:bold"' : '') + '>' + (r && r.elegivel ? brl(r.total) : '—') + '</td>'; }).join('') + '</tr>'; });
    $('o-proj').innerHTML = p + '</tbody></table>';

    $('o-memoria').innerHTML = eleg.map(k => { const r = res.regimes[k]; return '<details><summary>' + esc(r.nome) + '</summary><ul>' + (r.memoria || []).map(m => '<li>' + esc(m.texto) + (m.valor !== null && m.valor !== undefined ? ': <b>' + brl(m.valor) + '</b>' : '') + '</li>').join('') + '</ul></details>'; }).join('');
    try { const v = {}; document.querySelectorAll('#form-obra input, #form-obra select').forEach(i => { v[i.id] = i.type === 'checkbox' ? i.checked : i.value; }); localStorage.setItem('co-calc-obra', JSON.stringify(v)); } catch (err) {}
  }
  try { const s = JSON.parse(localStorage.getItem('co-calc-obra') || 'null'); if (s) Object.entries(s).forEach(([id, v]) => { const el = $(id); if (el) { if (el.type === 'checkbox') el.checked = v; else el.value = v; } }); } catch (err) {}
  $('form-obra').addEventListener('input', render);
  $('form-obra').addEventListener('change', render);
  $('form-obra').addEventListener('submit', ev => ev.preventDefault());

  // CNAE de construção/incorporação na aba geral leva ao módulo
})();
(function () {
  'use strict';
  const I = window.ITBI;
  const $ = id => document.getElementById(id);
  const brl = v => (v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2});
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  Object.entries(I.MUNICIPIOS).forEach(([k, m]) => { const o = document.createElement('option'); o.value = k; o.textContent = m.nome; $('i-mun').appendChild(o); });
  function linhaImovel(v) {
    v = v || {};
    const d = document.createElement('div'); d.className = 'imovel'; d.style.cssText = 'border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px';
    d.innerHTML = '<input class="im-desc" type="text" placeholder="Descrição / matrícula" value="' + esc(v.descricao || '') + '">' +
      '<div class="linha2" style="grid-template-columns:1fr 1fr"><div><label>Ao capital</label><input class="im-cap" type="number" min="0" step="1000" value="' + (v.valorCapital || 0) + '"></div>' +
      '<div><label>Transferido</label><input class="im-tr" type="number" min="0" step="1000" value="' + (v.valorTransferido || 0) + '"></div>' +
      '<div><label>Mercado</label><input class="im-mer" type="number" min="0" step="1000" value="' + (v.valorMercado || 0) + '"></div>' +
      '<div><label>Venal</label><input class="im-ven" type="number" min="0" step="1000" value="' + (v.valorVenal || 0) + '"></div></div>' +
      '<button class="co-btn" type="button" style="margin-top:6px">Remover</button>';
    d.querySelector('button').addEventListener('click', () => { d.remove(); render(); });
    $('i-imoveis').appendChild(d);
  }
  linhaImovel({descricao: 'Imóvel 1', valorCapital: 300000, valorTransferido: 300000, valorMercado: 900000});
  $('i-add').addEventListener('click', () => { linhaImovel(); render(); });

  function ler() {
    const n = id => parseFloat($(id).value) || 0;
    return {municipio: $('i-mun').value, nomeMunicipio: $('i-nome').value, aliquota: n('i-aliq') / 100, aliqSfh: n('i-aliqsfh') / 100, limFinSfh: n('i-limfin'), limImovelSfh: n('i-limimo'),
      valorDeclarado: n('i-decl'), financiadoSfh: n('i-fin'), valorReferencia: n('i-ref'),
      imoveis: [...document.querySelectorAll('#i-imoveis .imovel')].map(d => ({descricao: d.querySelector('.im-desc').value, valorCapital: +d.querySelector('.im-cap').value || 0, valorTransferido: +d.querySelector('.im-tr').value || 0, valorMercado: +d.querySelector('.im-mer').value || 0, valorVenal: +d.querySelector('.im-ven').value || 0})),
      nova: $('p-nova').value === '1', totalidade: $('p-tot').checked,
      anos: [...document.querySelectorAll('#p-anos .p-ano')].map(d => ({rotulo: d.dataset.rotulo, receitaTotal: +d.querySelector('.p-rt').value || 0, receitaImob: +d.querySelector('.p-ri').value || 0}))};
  }
const ANOS = {};
  function montarAnos() {
    const a = parseInt($('p-ano').value, 10) || 2026, nova = $('p-nova').value === '1';
    document.querySelectorAll('#p-anos .p-ano').forEach(d => { ANOS[d.dataset.rotulo] = [d.querySelector('.p-rt').value, d.querySelector('.p-ri').value]; });
    const rot = nova ? [a + 1, a + 2, a + 3] : [a - 2, a - 1, a + 1, a + 2];
    $('p-anos').innerHTML = '<div class="linha2" style="grid-template-columns:70px 1fr 1fr;font-size:12px;color:var(--muted)"><div>Ano</div><div>Receita operacional</div><div>Receita imobiliária</div></div>' +
      rot.map(r => { const v = ANOS[r] || ['', '']; return '<div class="p-ano linha2" data-rotulo="' + r + '" style="grid-template-columns:70px 1fr 1fr;align-items:center"><div>' + r + '</div><input class="p-rt" type="number" min="0" step="1000" value="' + esc(v[0]) + '"><input class="p-ri" type="number" min="0" step="1000" value="' + esc(v[1]) + '"></div>'; }).join('');
  }
  montarAnos();
  $('p-ano').addEventListener('change', () => { montarAnos(); render(); });
  $('p-nova').addEventListener('change', () => { montarAnos(); render(); });
  let opAnterior = $('i-op').value;
  function mostrarPrep(p, op) {
    const pc = v => v === null ? '—' : (v * 100).toFixed(1).replace('.', ',') + '%';
    const st = p.imune === true ? '<b style="color:#1a7f37">Imune</b>' : p.imune === false ? '<b style="color:#b42318">Não imune — ITBI devido</b>' : '<b>Pendente</b>';
    let h = '<p>' + st + ' — ' + esc(p.conclusao) + '</p>';
    if (p.anos.some(a => a.total > 0)) h += '<div class="tabela-wrap"><table><thead><tr><th>Ano</th><th>Receita operacional</th><th>Receita imobiliária</th><th>%</th></tr></thead><tbody>' +
      p.anos.map(a => '<tr><td>' + esc(a.rotulo) + '</td><td>' + (a.total ? brl(a.total) : '—') + '</td><td>' + (a.total ? brl(a.imob) : '—') + '</td><td>' + pc(a.pct) + '</td></tr>').join('') +
      '<tr class="total"><td>Período</td><td>' + brl(p.somaT) + '</td><td>' + brl(p.somaI) + '</td><td>' + pc(p.pct) + (p.pct === null ? '' : p.preponderante ? ' — preponderante' : ' — não preponderante') + '</td></tr></tbody></table></div>';
    h += p.avisos.map(a => '<div class="co-aviso" style="margin-top:8px">' + esc(a) + '</div>').join('');
    h += '<details style="margin-top:10px"' + (op === 'integralizacao' ? '' : ' open') + '><summary>Documentos para o pedido de reconhecimento da imunidade</summary><ul>' + I.DOCUMENTOS_IMUNIDADE.map(d => '<li>' + esc(d) + '</li>').join('') +
      '<li>O pedido administrativo pode ser feito pela empresa ou pelo escritório. Mandado de segurança, ação declaratória ou repetição de indébito exigem advogado com OAB.</li></ul></details>';
    $('i-prep').innerHTML = h; $('i-prep-wrap').hidden = false;
  }
  function mostrarCustas(e, op, itbi) {
    const n = id => parseFloat($(id).value) || 0;
    const ce = {tabela: $('c-tab').value, escritura: $('c-esc').checked, issPct: n('c-iss') / 100, certidoes: n('c-cert'), manualEscritura: n('c-mesc'), manualRegistro: n('c-mreg')};
    if (op === 'compra') Object.assign(ce, {valorTitulo: e.valorDeclarado, valorVenal: n('c-venal'), garantia: n('c-gar')});
    else ce.imoveis = e.imoveis.filter(i => i.valorCapital || i.valorTransferido || i.valorMercado || i.valorVenal).map(i => ({descricao: i.descricao, valorTitulo: Math.max(i.valorTransferido, i.valorCapital), valorVenal: i.valorVenal}));
    const c = I.custas(ce);
    $('i-cus').innerHTML = '<thead><tr><th>Ato</th><th>Base (faixa)</th><th>Emolumentos e repasses</th><th>ISS</th><th>Total</th></tr></thead><tbody>' +
      c.itens.map(i => '<tr><td>' + esc(i.ato) + '</td><td>' + (i.base ? brl(i.base) + (i.faixa ? ' (faixa ' + (i.faixa.ate === null ? 'final' : 'até ' + brl(i.faixa.ate)) + ')' : '') : '—') + '</td><td>' + brl(i.emolumentos) + '</td><td>' + brl(i.iss) + '</td><td>' + brl(i.total) + '</td></tr>').join('') +
      '<tr class="total"><td>Custas de cartório</td><td></td><td></td><td></td><td>' + brl(c.total) + '</td></tr>' +
      '<tr class="total"><td>ITBI + custas (custo da transferência)</td><td></td><td></td><td></td><td>' + brl(c.total + itbi) + '</td></tr></tbody>';
    $('i-cus-fonte').textContent = 'Fonte: ' + c.fonte + (c.issPct ? ' ISS de ' + (c.issPct * 100).toFixed(1).replace('.', ',') + '% sobre a parcela do tabelião/oficial.' : '') + ' Não inclui prenotação de título devolvido, diligências, buscas e certidões não informadas.' + (c.avisos.length ? ' ' + c.avisos.join(' ') : '');
  }
  
  const card = (nome, valor, sub, destaque) => '<div class="co-cartao' + (destaque ? ' melhor' : '') + '"><div class="nome">' + nome + '</div><div class="valor">' + valor + '</div><div class="sub">' + sub + '</div></div>';
  function render() {
    const op = $('i-op').value;
    if (op !== opAnterior) { $('c-esc').checked = op === 'compra'; opAnterior = op; }
    const e = ler();
    document.querySelectorAll('#form-itbi [data-op]').forEach(g => { g.hidden = !g.dataset.op.split(' ').includes(op); });
    document.querySelector('#form-itbi [data-c]').hidden = $('c-tab').value !== 'manual';
    $('i-prep-wrap').hidden = true;
    document.querySelector('#form-itbi [data-mun]').hidden = e.municipio !== 'outro';
    if (op === 'compra') {
      const r = I.compra(e);
      $('i-cartoes').innerHTML = card('ITBI devido (valor declarado)', brl(r.devido.total), esc(r.municipio.nome), true) +
        card('Base de cálculo', brl(r.devido.base), r.devido.faixaReduzida ? 'com ' + brl(r.devido.faixaReduzida) + ' na alíquota do SFH' : 'alíquota ' + (r.municipio.aliquota * 100).toFixed(2).replace('.', ',') + '%') +
        (r.cenarioPrefeitura ? card('Se exigirem o valor de referência', brl(r.cenarioPrefeitura.total), '+' + brl(r.cenarioPrefeitura.total - r.devido.total)) : card('Valor de referência', '—', 'não informado ou menor que o declarado'));
      $('i-memoria').innerHTML = r.memoria.map(m => '<li>' + esc(m) + '</li>').join('');
      $('i-avisos').innerHTML = r.avisos.map(a => '<div class="co-aviso">' + esc(a) + '</div>').join('');
      $('i-tab-wrap').hidden = true;
      mostrarCustas(e, op, r.devido.total);
    } else if (op === 'reorganizacao') {
      const r = I.reorganizacao(e), t = r.totais, p = r.preponderancia;
      $('i-cartoes').innerHTML = card('ITBI devido', p.imune === null ? '—' : brl(r.devido), p.imune === true ? 'imune (CTN, arts. 36 e 37)' : p.imune === false ? 'atividade imobiliária preponderante' : 'informe as receitas', true) +
        card('Se não houver imunidade', brl(t.itbiDecl), 'sobre o valor transmitido') +
        card('Pelo valor de mercado', brl(t.itbiMerc), 'se a prefeitura arbitrar');
      $('i-tabela').innerHTML = '<thead><tr><th>Imóvel</th><th>Valor transmitido</th><th>Mercado</th><th>ITBI sem imunidade</th></tr></thead><tbody>' +
        r.linhas.map(l => '<tr><td>' + esc(l.descricao) + '</td><td>' + brl(l.valor) + '</td><td>' + brl(l.merc) + '</td><td>' + brl(l.itbiDecl) + '</td></tr>').join('') + '</tbody>';
      $('i-tab-wrap').hidden = !r.linhas.length;
      $('i-memoria').innerHTML = p.memoria.concat(['Alíquota de ' + r.municipio.nome + ': ' + (r.municipio.aliquota * 100).toFixed(2).replace('.', ',') + '% (' + r.municipio.fonte + ').']).map(m => '<li>' + esc(m) + '</li>').join('');
      $('i-avisos').innerHTML = '';
      mostrarPrep(p, op);
      mostrarCustas(e, op, r.devido);
    } else {

      const r = I.integralizacao(e), t = r.totais;
      $('i-cartoes').innerHTML = card('Cenário 1 — tese do contribuinte', brl(t.itbiContrib), 'excesso sobre o capital (Temas 796 e 1.348)', true) +
        card('Cenário 2 — prática de prefeituras', brl(t.itbiFisco), 'diferença para o valor de mercado') +
        card('Capital integralizado', brl(t.cap), 'mercado: ' + brl(t.merc));
      $('i-tabela').innerHTML = '<thead><tr><th>Imóvel</th><th>Ao capital</th><th>Transferido</th><th>Mercado</th><th>ITBI cenário 1</th><th>ITBI cenário 2</th></tr></thead><tbody>' +
        r.linhas.map(l => '<tr><td>' + esc(l.descricao) + '</td><td>' + brl(l.cap) + '</td><td>' + brl(l.transf) + '</td><td>' + brl(l.merc) + '</td><td>' + brl(l.itbiContrib) + '</td><td>' + brl(l.itbiFisco) + '</td></tr>').join('') +
        '<tr class="total"><td>Total</td><td>' + brl(t.cap) + '</td><td>' + brl(t.transf) + '</td><td>' + brl(t.merc) + '</td><td>' + brl(t.itbiContrib) + '</td><td>' + brl(t.itbiFisco) + '</td></tr></tbody>';
      $('i-tab-wrap').hidden = !r.linhas.length;
      $('i-memoria').innerHTML = r.memoria.map(m => '<li>' + esc(m) + '</li>').join('');
      $('i-avisos').innerHTML = r.avisos.map(a => '<div class="co-aviso">' + esc(a) + '</div>').join('');
      mostrarPrep(I.preponderancia(Object.assign({}, e, {operacao: 'integralizacao'})), op);
      mostrarCustas(e, op, t.itbiContrib);
    }
  }
  // Documentos do imóvel
  const DOC = {matricula: null, venal: null};
  const fmtArea = a => (a || []).map(x => (x.tipo || 'área') + ' ' + String(x.m2).replace('.', ',') + ' m²').join('; ');
  function mostrarDocs() {
    const linhas = [], add = (rot, v) => { if (v != null && v !== '') linhas.push('<tr><td>' + rot + '</td><td>' + v + '</td></tr>'); };
    const m = DOC.matricula, v = DOC.venal;
    if (m) {
      add('Origem da leitura (matrícula)', esc(m.origem));
      add('Matrícula', esc(m.campos.matricula)); add('Cartório', esc(m.campos.cartorio)); add('Endereço', esc(m.campos.endereco));
      add('Inscrição municipal', esc(m.campos.inscricao)); add('Áreas', esc(fmtArea(m.campos.areas))); add('Proprietários', esc(m.campos.proprietarios));
      if (m.campos.ultimoValor) add('Valor da transmissão mais recente registrada', brl(m.campos.ultimoValor) + (m.campos.dataUltimoValor ? ' (' + esc(m.campos.dataUltimoValor) + ')' : ''));
      if (m.campos.atos) add('Atos (R./AV.) encontrados', m.campos.atos);
      add('Ônus e restrições citados', m.onus.length ? m.onus.map(o => esc(o.tipo) + (o.cancelado ? ' — com cancelamento citado' : ' — <b>sem cancelamento identificado</b>')).join('<br>') : 'nenhum encontrado no texto');
    }
    if (v) {
      add('Origem da leitura (certidão)', esc(v.origem));
      add('Exercício', esc(v.campos.exercicio)); add('Inscrição (certidão)', esc(v.campos.inscricao));
      if (v.campos.valorVenal) add('Valor venal (IPTU)', brl(v.campos.valorVenal));
      if (v.campos.valorReferencia) add('Valor venal de referência (ITBI)', brl(v.campos.valorReferencia));
      if (v.campos.valorTerreno) add('Valor do terreno', brl(v.campos.valorTerreno));
      if (v.campos.valorConstrucao) add('Valor da construção', brl(v.campos.valorConstrucao));
    }
    if (m && v && m.campos.inscricao && v.campos.inscricao && m.campos.inscricao.replace(/\D/g, '') !== v.campos.inscricao.replace(/\D/g, '')) linhas.push('<tr><td colspan="2"><b>Atenção:</b> a inscrição municipal da matrícula difere da certidão — confira se os documentos são do mesmo imóvel.</td></tr>');
    const avisos = [].concat(m ? m.avisos : [], v ? v.avisos : []);
    const ref = v && (v.campos.valorReferencia || v.campos.valorVenal);
    const merc = ref || (m && m.campos.ultimoValor);
    let bt = '';
    if (ref) bt += '<button class="co-btn" type="button" id="i-usaref">Usar ' + brl(ref) + ' como valor de referência da prefeitura</button> ';
    if (merc) bt += '<button class="co-btn" type="button" id="i-usaint">Adicionar o imóvel à integralização (mercado ' + brl(merc) + ')</button>';
    $('i-doc').innerHTML = '<div class="tabela-wrap"><table><tbody>' + linhas.join('') + '</tbody></table></div>' +
      avisos.map(a => '<div class="co-aviso" style="margin-top:8px">' + esc(a) + '</div>').join('') + (bt ? '<div style="margin-top:10px">' + bt + '</div>' : '');
    $('i-doc-wrap').hidden = !(m || v);
    const b1 = $('i-usaref'); if (b1) b1.addEventListener('click', () => { $('i-op').value = 'compra'; $('i-ref').value = Math.round(ref * 100) / 100; if (v && v.campos.valorVenal) $('c-venal').value = Math.round(v.campos.valorVenal * 100) / 100; render(); });
    const b2 = $('i-usaint'); if (b2) b2.addEventListener('click', () => {
      $('i-op').value = 'integralizacao';
      const desc = 'Matrícula ' + ((m && m.campos.matricula) || '?') + ((m && m.campos.endereco) ? ' — ' + m.campos.endereco : '');
      const prim = document.querySelector('#i-imoveis .imovel .im-desc');
      if (prim && prim.value === 'Imóvel 1' && document.querySelectorAll('#i-imoveis .imovel').length === 1) prim.closest('.imovel').remove();
      linhaImovel({descricao: desc, valorCapital: 0, valorTransferido: 0, valorMercado: Math.round(merc), valorVenal: v && v.campos.valorVenal ? Math.round(v.campos.valorVenal) : 0}); render();
    });
  }
  async function lerDoc(input, tipo) {
    const f = input.files && input.files[0]; if (!f) return;
    if (!window.DocImovel) return;
    $('i-doc-wrap').hidden = false; $('i-doc').innerHTML = '<div class="dica">Lendo ' + esc(f.name) + '…</div>';
    try { DOC[tipo] = await window.DocImovel.ler(f, tipo === 'venal' ? 'venal' : 'matricula'); }
    catch (e) { DOC[tipo] = {campos: {}, onus: [], valores: [], avisos: ['Não foi possível ler o arquivo (' + (e && e.message ? e.message : 'erro') + '). Preencha os valores à mão.'], origem: 'não lido'}; }
    mostrarDocs();
  }
  $('i-docmat').addEventListener('change', ev => { ev.stopPropagation(); lerDoc($('i-docmat'), 'matricula'); });
  $('i-docven').addEventListener('change', ev => { ev.stopPropagation(); lerDoc($('i-docven'), 'venal'); });

  $('form-itbi').addEventListener('input', render);
  $('form-itbi').addEventListener('change', render);
  $('form-itbi').addEventListener('submit', ev => ev.preventDefault());
  render();
})();
(function () {
  'use strict';
  const V = window.Venda, IP = window.IpcaCO;
  const $ = id => document.getElementById(id);
  const brl = v => (v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2});
  const pct = v => ((v || 0) * 100).toFixed(2).replace('.', ',') + '%';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  $('v-ipca').textContent = IP.ultimoRotulo;
  Object.entries(window.ITBI.MUNICIPIOS).filter(([k]) => k !== 'outro').forEach(([k, m]) => { const o = document.createElement('option'); o.value = k; o.textContent = m.nome; $('v-mun').appendChild(o); });
  const campo = (cls, rot, tipo, val, extra) => '<div><label>' + rot + '</label><input class="' + cls + '" type="' + tipo + '" ' + (extra || 'min="0" step="1000"') + ' value="' + esc(val) + '"></div>';
  function linha(v) {
    v = v || {};
    const d = document.createElement('div'); d.className = 'imovel'; d.style.cssText = 'border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px';
    d.innerHTML = '<input class="vi-desc" type="text" placeholder="Descrição / matrícula" value="' + esc(v.descricao || '') + '">' +
      '<div class="linha2">' + campo('vi-valor', 'Valor de venda', 'number', v.valor || 0) + campo('vi-custo', 'Custo de aquisição', 'number', v.custo || 0) + '</div>' +
      '<div class="linha2">' + campo('vi-aq', 'Mês da aquisição', 'month', v.aquisicao || '2015-01', ' ') +
      '<div><label>Tipo</label><select class="vi-tipo"><option value="novo">Residencial novo</option><option value="usado">Residencial usado</option><option value="lote">Lote residencial</option><option value="comercial">Comercial / outro</option></select></div></div>' +
      '<div class="linha2">' + campo('vi-cont', 'Custo contábil (PJ ativo)', 'number', v.contabil == null ? '' : v.contabil) + campo('vi-ref', 'Valor de referência (opcional)', 'number', v.valorReferencia || 0) + '</div>' +
      '<div class="linha2">' + campo('vi-488', 'Custos 2027–2032 c/ ICMS/ISS', 'number', v.ded488 || 0) + campo('vi-rein', 'PF: % reinvestido em 180 dias', 'number', v.reinvest || 0, 'min="0" max="100" step="5"') + '</div>' +
      '<div class="linha2">' + campo('vi-corr', 'Corretagem paga pelo vendedor', 'number', v.corretagem || 0) + '<div><label>Operação</label><select class="vi-op"><option value="venda">Venda</option><option value="permuta">Permuta</option></select></div></div>' +
      '<div class="linha2 vi-perm" hidden>' + campo('vi-receb', 'Imóvel recebido em permuta (valor)', 'number', v.recebido || 0) + campo('vi-torna', 'Torna recebida em dinheiro', 'number', v.torna || 0) + '</div>' +
      '<div class="vi-perm" hidden><label>Município do imóvel recebido (ITBI que o cliente paga)</label><select class="vi-munrec"><option value="">Mesmo dos imóveis dados</option>' + Object.entries(window.ITBI.MUNICIPIOS).filter(([k]) => k !== 'outro').map(([k, m]) => '<option value="' + k + '">' + esc(m.nome) + '</option>').join('') + '</select></div>' +
      '<button class="co-btn" type="button" style="margin-top:6px">Remover</button>';
    d.querySelector('.vi-tipo').value = v.tipo || 'usado';
    d.querySelector('.vi-op').value = v.permuta ? 'permuta' : 'venda';
    if (v.municipioRecebido) d.querySelector('.vi-munrec').value = v.municipioRecebido;
    const sincr = () => { d.querySelectorAll('.vi-perm').forEach(x => { x.hidden = d.querySelector('.vi-op').value !== 'permuta'; }); };
    d.querySelector('.vi-op').addEventListener('change', sincr); sincr();
    d.querySelector('button').addEventListener('click', () => { d.remove(); render(); });
    $('v-imoveis').appendChild(d);
  }
  linha({descricao: 'Imóvel 1', valor: 1000000, custo: 400000, aquisicao: '2015-06', tipo: 'novo'});
  $('v-add').addEventListener('click', () => { linha({descricao: 'Imóvel ' + ($('v-imoveis').children.length + 1)}); render(); });
  function ler() {
    const n = id => parseFloat($(id).value) || 0;
    return {venda: $('v-data').value || '2027-06', socios: n('v-socios'), cbsRef: n('v-cbs') / 100, ibsRef: n('v-ibs') / 100, classificacao: $('v-class').value,
      trimestral: $('v-trim').checked, distribuir: $('v-dist').checked, precoComTributo: $('v-comtrib').checked, pfContribuinte: $('v-pfcontrib').checked, unico440: $('v-unico').checked,
      imoveis: [...document.querySelectorAll('#v-imoveis .imovel')].map(d => { const q = c => d.querySelector(c).value; return {descricao: q('.vi-desc'), valor: +q('.vi-valor') || 0, custo: +q('.vi-custo') || 0, aquisicao: q('.vi-aq') || '2015-01', tipo: q('.vi-tipo'), contabil: q('.vi-cont') === '' ? null : +q('.vi-cont'), valorReferencia: +q('.vi-ref') || 0, ded488: +q('.vi-488') || 0, reinvest: (+q('.vi-rein') || 0) / 100, corretagem: +q('.vi-corr') || 0, permuta: q('.vi-op') === 'permuta', recebido: +q('.vi-receb') || 0, torna: +q('.vi-torna') || 0, municipioRecebido: q('.vi-munrec')}; }),
      permutaRiscoRFB: $('v-risco').checked,
      fracaoVista: $('v-vista').value === '' ? 1 : n('v-vista') / 100, prejuizo: n('v-prej'), municipio: $('v-mun').value};
  }
  function render() {
    const e = ler(), r = V.calcular(e), C = r.cenarios, ks = ['pf', 'presumido', 'real'];
    const tot = k => e.distribuir ? C[k].totalComIrrf : C[k].total;
    const melhor = ks.slice().sort((a, b) => tot(a) - tot(b))[0];
    $('v-cartoes').innerHTML = ks.map(k => { const c = C[k], top = k === melhor; return '<div class="co-cartao' + (top ? ' melhor' : '') + '">' + (top ? '<span class="co-selo">Menor carga</span>' : '') + '<div class="nome">' + esc(c.nome) + '</div><div class="valor">' + brl(tot(k)) + '</div><div class="sub">' + pct(r.valorTotal ? tot(k) / r.valorTotal : 0) + ' do valor dos imóveis' + (e.distribuir && c.irrf ? ' · inclui IRRF ' + brl(c.irrf) : '') + '</div>' + (top ? '' : '<div class="sub">+' + brl(tot(k) - tot(melhor)) + '</div>') + '</div>'; }).join('');
    $('v-avisos').innerHTML = r.avisos.map(a => '<div class="co-aviso">' + esc(a) + '</div>').join('');
    $('v-titulo').textContent = 'Tributos por cenário — venda em ' + e.venda.split('-').reverse().join('/');
    const nomes = []; ks.forEach(k => C[k].itens.forEach(i => { if (!nomes.includes(i.nome)) nomes.push(i.nome); }));
    let h = '<thead><tr><th>Tributo</th>' + ks.map(k => '<th>' + esc(C[k].nome) + '</th>').join('') + '</tr></thead><tbody>';
    nomes.forEach(n => { h += '<tr><td>' + esc(n) + '</td>' + ks.map(k => { const it = C[k].itens.find(i => i.nome === n); return '<td>' + (it ? brl(it.valor) : '—') + '</td>'; }).join('') + '</tr>'; });
    h += '<tr class="total"><td>Tributos da venda</td>' + ks.map(k => '<td>' + brl(C[k].total) + '</td>').join('') + '</tr>';
    if (e.distribuir) h += '<tr><td>IRRF na distribuição de lucros</td>' + ks.map(k => '<td>' + (C[k].irrf ? brl(C[k].irrf) : '—') + '</td>').join('') + '</tr><tr class="total"><td>Total com a distribuição</td>' + ks.map(k => '<td>' + brl(C[k].totalComIrrf) + '</td>').join('') + '</tr>';
    if (C.pf.irMesVenda < C.pf.itens[0].valor - 0.005) h += '<tr><td>PF: IR que vence no mês seguinte à venda (restante diferido)</td><td>' + brl(C.pf.irMesVenda) + '</td><td>—</td><td>—</td></tr>';
    // ITBI: na permuta, cada permutante paga sobre o imóvel que adquire (Guarulhos, Lei 8.425/2025; São Paulo, Lei 11.154/1991; SJC, LC 696/2025)
    const itbi = (mun, v) => mun && v > 0 ? window.ITBI.compra({municipio: mun, valorDeclarado: v, financiadoSfh: 0, valorReferencia: 0}).devido.total : 0;
    const perm = r.porImovel.filter(l => l.permuta);
    const itbiOutro = r.porImovel.reduce((s, l) => s + itbi(e.municipio, l.valor), 0);
    const itbiCliente = perm.reduce((s, l) => s + itbi(l.municipioRecebido || e.municipio, l.recebido), 0);
    if (e.municipio || itbiCliente) {
      const nomeM = e.municipio ? window.ITBI.MUNICIPIOS[e.municipio].nome : '';
      h += '<tr class="info"><td>ITBI pago pelo ' + (perm.length ? 'comprador ou outro permutante' : 'comprador') + (nomeM ? ' (' + esc(nomeM) + ', valor declarado, sem SFH)' : '') + '</td>' + ks.map(() => '<td>' + brl(itbiOutro) + '</td>').join('') + '</tr>';
      if (perm.length) h += '<tr><td>ITBI pago pelo cliente sobre o imóvel recebido na permuta</td>' + ks.map(() => '<td>' + brl(itbiCliente) + '</td>').join('') + '</tr>';
    }
    h += '<tr><td>Fica com o vendedor em dinheiro (após tributos e corretagem)</td>' + ks.map(k => '<td>' + brl(C[k].liquido) + '</td>').join('') + '</tr>';
    if (perm.length) {
      const rec = perm.reduce((s, l) => s + l.recebido, 0);
      h += '<tr><td>(+) Imóvel recebido na permuta, a valor de mercado</td>' + ks.map(() => '<td>' + brl(rec) + '</td>').join('') + '</tr>';
      h += '<tr class="total"><td>Patrimônio após a operação (dinheiro + imóvel − ITBI do cliente)</td>' + ks.map(k => '<td>' + brl(C[k].liquido + rec - itbiCliente) + '</td>').join('') + '</tr>';
      const cPF = perm.reduce((s, l) => s + l.custoRecebidoPF, 0), cPJ = perm.reduce((s, l) => s + l.custoRecebidoPJ, 0);
      h += '<tr><td>Custo fiscal do imóvel recebido (declaração da PF / contabilidade da PJ)' + (e.permutaRiscoRFB ? ' — no cenário de risco, a PJ registra o valor recebido' : '') + '</td><td>' + brl(cPF) + '</td><td>' + brl(cPJ) + '</td><td>' + brl(cPJ) + '</td></tr>';
    }
    h += '</tbody>';
    $('v-tabela').innerHTML = h;
    const ref = r.ano >= 2027;
    $('v-porimovel').innerHTML = '<thead><tr><th>Imóvel</th><th>Venda</th><th>Ganho PF</th><th>Base PF (após fatores)</th><th>IR PF</th>' + (ref ? '<th>Redutor de ajuste</th><th>Redutor social</th><th>Base CBS/IBS</th><th>CBS+IBS</th>' : '') + '</tr></thead><tbody>' +
      r.porImovel.map(l => '<tr><td>' + esc(l.descricao) + '</td><td>' + brl(l.valor) + '</td><td>' + brl(l.ganhoPF) + '</td><td>' + brl(l.basePF) + '</td><td>' + brl(l.irPF) + '</td>' + (ref ? '<td>' + brl(l.redAjuste) + '</td><td>' + brl(l.redSocial) + '</td><td>' + brl(l.baseCbsIbs) + '</td><td>' + brl(l.cbsIbs) + '</td>' : '') + '</tr>').join('') + '</tbody>';
    $('v-memoria').innerHTML = ks.map(k => '<details' + (k === melhor ? ' open' : '') + '><summary>' + esc(C[k].nome) + '</summary><ul>' + C[k].memoria.map(m => '<li>' + esc(m.texto) + (m.valor !== null && m.valor !== undefined ? ': <b>' + brl(m.valor) + '</b>' : '') + '</li>').join('') + '</ul></details>').join('');
  }
  $('form-venda').addEventListener('input', render);
  $('form-venda').addEventListener('change', render);
  $('form-venda').addEventListener('submit', ev => ev.preventDefault());
  render();
})();
(function () {
  'use strict';
  const T = window.ITCMD;
  const $ = id => document.getElementById(id);
  const brl = v => (v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2});
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const TIPOS = {imovelUrbano: 'Imóvel urbano', imovelRural: 'Imóvel rural', quotas: 'Quotas / ações', dinheiro: 'Dinheiro e aplicações', moveis: 'Móveis que guarnecem a casa', outros: 'Outros bens'};
  const num = (cls, rot, val, extra) => '<div class="' + cls + '-w"><label>' + rot + '</label><input class="' + cls + '" type="number" ' + (extra || 'min="0" step="1000"') + ' value="' + esc(val) + '"></div>';
  function linha(v) {
    v = v || {};
    const d = document.createElement('div'); d.className = 'bem'; d.style.cssText = 'border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px';
    d.innerHTML = '<div class="linha2"><div><label>Tipo</label><select class="tb-tipo">' + Object.entries(TIPOS).map(([k, n]) => '<option value="' + k + '">' + n + '</option>').join('') + '</select></div>' +
      '<div><label>Descrição</label><input class="tb-desc" type="text" value="' + esc(v.descricao || '') + '"></div></div>' +
      '<div class="linha2 tb-val">' + num('tb-valor', 'Valor de mercado declarado', v.valor || 0) + num('tb-venal', 'Valor venal do IPTU', v.venalIptu || 0) + '</div>' +
      '<div class="linha2 tb-quo" hidden>' + num('tb-plc', 'PL contábil da sociedade', v.plContabil || 0) + num('tb-pla', 'PL ajustado a mercado', v.plAjustado || 0) + '</div>' +
      '<div class="linha2">' + num('tb-frac', '% transmitido', v.fracao == null ? 100 : v.fracao * 100, 'min="0" max="100" step="1"') + num('tb-ref', 'Valor de referência do fisco (opcional)', v.valorReferencia || 0) + '</div>' +
      '<label class="co-check tb-usu-w"><input class="tb-usu" type="checkbox"' + (v.usufruto ? ' checked' : '') + '> Doação com reserva de usufruto</label>' +
      '<label class="co-check tb-res-w"><input class="tb-res" type="checkbox"' + (v.residencial ? ' checked' : '') + '> Imóvel de residência dos herdeiros, que não têm outro</label>' +
      '<label class="co-check tb-uni-w"><input class="tb-uni" type="checkbox"' + (v.unico ? ' checked' : '') + '> Único imóvel transmitido</label>' +
      '<button class="co-btn" type="button" style="margin-top:6px">Remover</button>';
    d.querySelector('.tb-tipo').value = v.tipo || 'imovelUrbano';
    d.querySelector('button').addEventListener('click', () => { d.remove(); render(); });
    $('t-bens').appendChild(d);
  }
  linha({descricao: 'Imóvel 1', tipo: 'imovelUrbano', valor: 600000, venalIptu: 350000, usufruto: true});
  $('t-add').addEventListener('click', () => { linha({descricao: 'Bem ' + ($('t-bens').children.length + 1)}); render(); });
  function faixas(txt) {
    const f = String(txt || '').split(';').map(x => x.trim()).filter(Boolean).map(x => { const [l, a] = x.split(':'); return [l && l.trim() ? +l.replace(/\./g, '').replace(',', '.') : Infinity, (+String(a).replace(',', '.') || 0) / 100]; });
    return f.length ? f : null;
  }
  function ler() {
    const op = $('t-op').value, est = $('t-est').value;
    return {estado: est, operacao: op, beneficiarios: +$('t-ben').value || 1, doacoesAnteriores: +$('t-ant').value || 0, aliquotaOutro: (+$('t-aliq').value || 0) / 100, faixasOutro: faixas($('t-faixas').value),
      bens: [...document.querySelectorAll('#t-bens .bem')].map(d => { const q = c => d.querySelector(c); return {tipo: q('.tb-tipo').value, descricao: q('.tb-desc').value, valor: +q('.tb-valor').value || 0, venalIptu: +q('.tb-venal').value || 0,
        plContabil: +q('.tb-plc').value || 0, plAjustado: +q('.tb-pla').value || 0, fracao: (+q('.tb-frac').value || 0) / 100, valorReferencia: +q('.tb-ref').value || 0, usufruto: q('.tb-usu').checked, residencial: q('.tb-res').checked, unico: q('.tb-uni').checked}; })};
  }
  const card = (nome, valor, sub, destaque) => '<div class="co-cartao' + (destaque ? ' melhor' : '') + '"><div class="nome">' + nome + '</div><div class="valor">' + valor + '</div><div class="sub">' + sub + '</div></div>';
  function render() {
    const e = ler();
    document.querySelectorAll('#form-itcmd [data-t="doacao"]').forEach(x => { x.hidden = e.operacao !== 'doacao'; });
    document.querySelector('#form-itcmd [data-t="outro"]').hidden = e.estado !== 'outro';
    document.querySelectorAll('#t-bens .bem').forEach(d => {
      const t = d.querySelector('.tb-tipo').value, imo = t === 'imovelUrbano' || t === 'imovelRural';
      d.querySelector('.tb-val').hidden = t === 'quotas'; d.querySelector('.tb-quo').hidden = t !== 'quotas';
      d.querySelector('.tb-venal-w').hidden = t !== 'imovelUrbano';
      d.querySelector('.tb-usu-w').hidden = e.operacao !== 'doacao';
      d.querySelector('.tb-res-w').hidden = !(imo && e.operacao === 'heranca' && e.estado === 'SP');
      d.querySelector('.tb-uni-w').hidden = !(imo && e.operacao === 'heranca' && e.estado === 'SP');
    });
    const r = T.calcular(e);
    let c = card('ITCMD devido agora', brl(r.imposto), r.estado.nome + (r.isencaoDoacao ? ' — isento' : ''), true);
    c += r.usufruto ? card('1/3 na extinção do usufruto', brl(r.usufruto.imposto), 'em valores de hoje, atualizado pela UFESP') : card('Cenário da Fazenda', brl(r.impostoFisco), r.impostoFisco > r.imposto ? 'valor de mercado / referência' : 'igual ao declarado');
    c += r.projecoes.length ? card('Projeção PL 409/2025 (não aprovado)', brl(r.projecoes[0].imposto), '1% a 4% por faixas') : card('Base por beneficiário', brl(r.porBeneficiario), r.beneficiarios + ' beneficiário(s)');
    $('t-cartoes').innerHTML = c;
    $('t-avisos').innerHTML = r.avisos.map(a => '<div class="co-aviso">' + esc(a) + '</div>').join('');
    $('t-tabela').innerHTML = '<thead><tr><th>Bem</th><th>Valor transmitido</th><th>Base</th><th>Base pelo fisco</th><th>Observação</th></tr></thead><tbody>' +
      r.linhas.map(l => '<tr><td>' + esc(l.descricao) + '</td><td>' + brl(l.valorBem) + '</td><td>' + brl(l.base) + '</td><td>' + brl(l.baseFisco) + '</td><td>' + esc(l.isento ? 'Isento: ' + l.motivo : (l.usufruto ? 'Nua-propriedade (2/3). ' : '') + l.nota.join(' ')) + '</td></tr>').join('') +
      '<tr class="total"><td>Total</td><td>' + brl(r.linhas.reduce((s, l) => s + l.valorBem, 0)) + '</td><td>' + brl(r.base) + '</td><td>' + brl(r.baseFisco) + '</td><td></td></tr></tbody>';
    $('t-memoria').innerHTML = r.memoria.map(m => '<li>' + esc(m) + '</li>').join('');
  }
  $('form-itcmd').addEventListener('input', render);
  $('form-itcmd').addEventListener('change', render);
  $('form-itcmd').addEventListener('submit', ev => ev.preventDefault());
  render();
})();
