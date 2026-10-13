/* ===== Tabelas e cálculo dos regimes (validado) ===== */
const SIMPLES = {
  comercio: [
    {ate:180000,  aliq:0.040, ded:0,      icms:0.34},
    {ate:360000,  aliq:0.073, ded:5940,   icms:0.34},
    {ate:720000,  aliq:0.095, ded:13860,  icms:0.335},
    {ate:1800000, aliq:0.107, ded:22500,  icms:0.335},
    {ate:3600000, aliq:0.143, ded:87300,  icms:0.335},
    {ate:4800000, aliq:0.190, ded:378000, icms:0}
  ],
  industria: [
    {ate:180000,  aliq:0.045, ded:0,      icms:0.32},
    {ate:360000,  aliq:0.078, ded:5940,   icms:0.32},
    {ate:720000,  aliq:0.100, ded:13860,  icms:0.32},
    {ate:1800000, aliq:0.112, ded:22500,  icms:0.32},
    {ate:3600000, aliq:0.147, ded:85500,  icms:0.32},
    {ate:4800000, aliq:0.300, ded:720000, icms:0}
  ],
  servicos: [
    {ate:180000,  aliq:0.060, ded:0,      icms:0},
    {ate:360000,  aliq:0.112, ded:9360,   icms:0},
    {ate:720000,  aliq:0.135, ded:17640,  icms:0},
    {ate:1800000, aliq:0.160, ded:35640,  icms:0},
    {ate:3600000, aliq:0.210, ded:125640, icms:0},
    {ate:4800000, aliq:0.330, ded:648000, icms:0}
  ],
  servicos4: [
    {ate:180000,  aliq:0.045, ded:0,      icms:0},
    {ate:360000,  aliq:0.090, ded:8100,   icms:0},
    {ate:720000,  aliq:0.102, ded:12420,  icms:0},
    {ate:1800000, aliq:0.140, ded:39780,  icms:0},
    {ate:3600000, aliq:0.220, ded:183780, icms:0},
    {ate:4800000, aliq:0.330, ded:828000, icms:0}
  ],
  servicos5: [
    {ate:180000,  aliq:0.155, ded:0,      icms:0},
    {ate:360000,  aliq:0.180, ded:4500,   icms:0},
    {ate:720000,  aliq:0.195, ded:9900,   icms:0},
    {ate:1800000, aliq:0.205, ded:17100,  icms:0},
    {ate:3600000, aliq:0.230, ded:62100,  icms:0},
    {ate:4800000, aliq:0.305, ded:540000, icms:0}
  ]
};
const CPP_PATRONAL = 0.20;
const FATOR_R_MINIMO = 0.28;
const LIMITE_SIMPLES = 4800000;
const NOMES = {simples:'Simples Nacional', hibrido:'Simples híbrido', presumido:'Lucro Presumido', real:'Lucro Real'};
const FAIXAS = [5000, 10000, 15000, 20000, 40000, 60000, 100000, 200000, 350000];

function faixaDe(rbt12, atividade){
  const tab = SIMPLES[atividade];
  if (rbt12 <= 0) return tab[0];
  return tab.find(f => rbt12 <= f.ate) || tab[tab.length-1];
}
function simplesEfetiva(rbt12, atividade){
  if (rbt12 > LIMITE_SIMPLES) return null;
  const f = faixaDe(rbt12, atividade);
  if (rbt12 <= 0) return f.aliq;
  return (rbt12 * f.aliq - f.ded) / rbt12;
}
function calcRegimes(p){
  const R = p.receita;
  const isCom = p.atividade === 'comercio' || p.atividade === 'industria';
  const cpp = CPP_PATRONAL * (p.folha || 0);
  // Fator R: serviços do Anexo V passam ao Anexo III se folha/receita >= 28%
  let ativ = p.atividade;
  let fatorR = null;
  if (ativ === 'servicos5'){
    fatorR = R > 0 ? (p.folha || 0) / R : 0;
    ativ = fatorR >= FATOR_R_MINIMO ? 'servicos' : 'servicos5';
  }
  const anexoBase = {comercio:'Anexo I', industria:'Anexo II', servicos:'Anexo III', servicos4:'Anexo IV', servicos5:'Anexo V'}[p.atividade];
  const anexo = (p.atividade === 'servicos5' && ativ === 'servicos')
    ? 'Anexo III (Fator R ' + Math.round(fatorR * 100) + '%)' : anexoBase;
  const antes = R * p.margem;
  const icmsRate = isCom ? p.icms : 0;
  const icmsDebito = R * icmsRate;
  const comprasCred = R * p.compras;
  const icmsCredito = comprasCred * icmsRate;
  const icmsNormal = Math.max(0, icmsDebito - icmsCredito);
  const issR = isCom ? 0 : p.iss * R;
  const out = {};

  const rbt12 = R * 12;
  const aliq = simplesEfetiva(rbt12, ativ);
  const faixa = faixaDe(rbt12, ativ);
  if (aliq === null){
    out.simples = {elegivel:false, motivo:'Faturamento acima de R$ 4,8 mi por ano'};
    out.hibrido = {elegivel:false, motivo:'Faturamento acima de R$ 4,8 mi por ano'};
  } else {
    const icmsFora6 = isCom && faixa.icms === 0 ? icmsNormal : 0;
    // Anexo IV: a CPP fica fora do DAS e é paga pela folha
    const cppS = ativ === 'servicos4' ? cpp : 0;
    const impS = R * aliq + icmsFora6 + cppS;
    out.simples = {elegivel:true, imposto: impS, efetiva: R>0 ? impS/R : aliq, liquido: antes - impS};
    if (!isCom){
      out.hibrido = {elegivel:false, motivo:'Híbrido só se aplica a comércio'};
    } else {
      const dasSemIcms = R * aliq * (1 - faixa.icms);
      const icmsHibrido = p.credHibrido ? icmsNormal : icmsDebito;
      const impH = dasSemIcms + icmsHibrido;
      out.hibrido = {elegivel:true, imposto: impH, efetiva: R>0 ? impH/R : 0, liquido: antes - impH};
    }
  }

  const baseP = R * (isCom ? 0.08 : 0.32);
  const irpjP = 0.15*baseP + 0.10*Math.max(0, baseP - 20000);
  const csllP = 0.09*baseP;
  const baseTrib = R - icmsDebito;
  const pisCofinsP = (0.0065 + 0.03) * baseTrib;
  const impP = irpjP + csllP + pisCofinsP + issR + icmsNormal + cpp;
  out.presumido = {elegivel:true, imposto: impP, efetiva: R>0 ? impP/R : 0, liquido: antes - impP};

  const pisCofinsR = Math.max(0, 0.0925 * (baseTrib - comprasCred));
  const lucroTrib = antes - cpp - pisCofinsR - issR;
  const irpjR = lucroTrib > 0 ? 0.15*lucroTrib + 0.10*Math.max(0, lucroTrib - 20000) : 0;
  const csllR = lucroTrib > 0 ? 0.09*lucroTrib : 0;
  const impR = pisCofinsR + issR + irpjR + csllR + icmsNormal + cpp;
  out.real = {elegivel:true, imposto: impR, efetiva: R>0 ? impR/R : 0, liquido: antes - impR};
  out.anexo = anexo;
  return out;
}
function ranking(res){
  return Object.keys(NOMES).filter(k => res[k].elegivel).sort((a,b) => res[b].liquido - res[a].liquido);
}

/* ===== Formatação ===== */
const fmtBRL = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'});
const fmtPct = v => (v*100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) + '%';
const $ = id => document.getElementById(id);
function num(id){ const v = parseFloat($(id).value); return isNaN(v) || v < 0 ? 0 : v; }
function parseBRL(s){ const d = (s || '').replace(/\D/g, ''); return d ? parseInt(d, 10) / 100 : 0; }
function digitosCnpj(){ return ($('cnpj').value || '').replace(/\D/g, ''); }
function mascaraCnpj(v){
  const d = v.replace(/\D/g, '').slice(0, 14);
  let s = d.slice(0, 2);
  if (d.length > 2)  s += '.' + d.slice(2, 5);
  if (d.length > 5)  s += '.' + d.slice(5, 8);
  if (d.length > 8)  s += '/' + d.slice(8, 12);
  if (d.length > 12) s += '-' + d.slice(12, 14);
  return s;
}

// Zera as entradas e o resultado quando o CNPJ é apagado por completo
function zerarEntradas(){
  $('receita').value = fmtBRL.format(0);
  $('margem').value = '0';
  $('compras').value = '0';
  $('folha').value = fmtBRL.format(0);
  $('icms').value = '0';
  $('iss').value = '0';
  atualizar();
}

/* ===== Consulta de CNPJ (extensão tem permissão para publica.cnpj.ws) ===== */
async function consultarCnpj(d){
  let r;
  try {
    r = await fetch('https://publica.cnpj.ws/cnpj/' + d);
  } catch (e) {
    throw new Error('Este navegador não conseguiu consultar a base de CNPJ. Digite a razão social manualmente.');
  }
  if (r.status === 404) throw new Error('CNPJ não encontrado na base pública.');
  if (r.status === 429) throw new Error('Muitas consultas seguidas. Aguarde um minuto e tente de novo.');
  if (!r.ok) throw new Error('Não foi possível consultar agora. Tente de novo em instantes.');
  const j = await r.json();
  return {
    razao: j.razao_social || '',
    situacao: (j.estabelecimento && j.estabelecimento.situacao_cadastral) || 'Não informada'
  };
}
let cnpjTimer = null;
let ultimoCnpj = '';
// Zera os campos preenchidos pela consulta quando o CNPJ é apagado ou fica incompleto
function limparCliente(){
  clearTimeout(cnpjTimer);
  cnpjTimer = null;
  ultimoCnpj = '';
  $('nome').value = '';
  const sit = $('situacao');
  sit.hidden = true;
  sit.textContent = '';
  sit.className = 'situacao';
  $('pdf-msg').className = 'status';
  $('pdf-msg').textContent = '';
}
$('cnpj').addEventListener('input', () => {
  const campo = $('cnpj');
  campo.value = mascaraCnpj(campo.value);
  const d = digitosCnpj();
  clearTimeout(cnpjTimer);
  if (d.length < 14){
    limparCliente();
    if (d.length === 0) zerarEntradas();
    $('cnpj-msg').className = 'status';
    $('cnpj-msg').textContent = d.length ? `Faltam ${14 - d.length} dígitos.` : 'Digite os 14 números do CNPJ.';
    return;
  }
  if (d === ultimoCnpj) return;
  $('cnpj-msg').className = 'status';
  $('cnpj-msg').textContent = 'Consultando...';
  cnpjTimer = setTimeout(() => buscarEmpresa(d), 400);
});
async function buscarEmpresa(d){
  ultimoCnpj = d;
  try {
    const e = await consultarCnpj(d);
    if (digitosCnpj() !== d) return;
    $('nome').value = e.razao;
    const sit = $('situacao');
    sit.hidden = false;
    sit.textContent = e.situacao;
    const s = e.situacao.toUpperCase();
    sit.className = 'situacao' + (s === 'ATIVA' ? '' : (s === 'SUSPENSA' ? ' warn' : ' bad'));
    $('cnpj-msg').className = 'status ok';
    $('cnpj-msg').textContent = 'Empresa encontrada.';
  } catch (err){
    if (digitosCnpj() !== d) return;
    ultimoCnpj = '';
    $('cnpj-msg').className = 'status bad';
    $('cnpj-msg').textContent = err.message;
  }
}

/* ===== Entradas ===== */
function entradas(){
  return {
    receita: parseBRL($('receita').value),
    atividade: $('atividade').value,
    folha: parseBRL($('folha').value),
    margem: num('margem') / 100,
    compras: num('compras') / 100,
    icms: num('icms') / 100,
    credHibrido: $('credhib').value === 'sim',
    iss: num('iss') / 100
  };
}
$('receita').addEventListener('input', () => {
  $('receita').value = fmtBRL.format(parseBRL($('receita').value));
});
$('folha').addEventListener('input', () => {
  $('folha').value = fmtBRL.format(parseBRL($('folha').value));
});

/* ===== Telas ===== */
function renderRegimes(){
  const p = entradas();
  const res = calcRegimes(p);
  const rank = ranking(res);
  const banner = $('banner');
  if (rank.length === 0 || p.receita === 0){
    banner.className = 'banner none';
    banner.innerHTML = '<strong>Informe o faturamento</strong><span>Digite um valor acima de zero para comparar os regimes.</span>';
  } else {
    let txt = '';
    if (rank.length > 1){
      const dif = res[rank[0]].liquido - res[rank[1]].liquido;
      txt = `Sobra ${fmtBRL.format(dif)} por mês a mais do que o ${NOMES[rank[1]]}.`;
    }
    banner.className = 'banner';
    banner.innerHTML = `<span>Melhor regime para este faturamento</span><strong>${NOMES[rank[0]]}</strong><span>${txt}</span>`;
  }
  $('tbl-regimes').innerHTML = ['simples','hibrido','presumido','real'].map(k => {
    const r = res[k];
    if (!r.elegivel) return `<tr><td>${NOMES[k]}</td><td class="na" colspan="3">Não se aplica: ${r.motivo}</td></tr>`;
    if (p.receita === 0) return `<tr><td>${NOMES[k]}</td><td>—</td><td>—</td><td>—</td></tr>`;
    const best = rank[0] === k;
    return `<tr class="${best ? 'best' : ''}">
      <td>${NOMES[k]}${best ? '<span class="tag">melhor</span>' : ''}</td>
      <td>${fmtBRL.format(r.imposto)}</td>
      <td>${fmtPct(r.efetiva)}</td>
      <td>${fmtBRL.format(r.liquido)}</td></tr>`;
  }).join('');
}
function renderFaixas(){
  const p = entradas();
  if (p.receita === 0){
    $('tbl-faixa').innerHTML = FAIXAS.map(R => `<tr><td>${fmtBRL.format(R)}</td><td>—</td><td>—</td></tr>`).join('');
    return;
  }
  $('tbl-faixa').innerHTML = FAIXAS.map(R => {
    const res = calcRegimes({...p, receita: R});
    const rank = ranking(res);
    const atual = R === p.receita ? ' class="current"' : '';
    return `<tr${atual}><td>${fmtBRL.format(R)}</td><td>${NOMES[rank[0]]}</td><td>${fmtBRL.format(res[rank[0]].liquido)}</td></tr>`;
  }).join('');
}
function atualizar(){ renderRegimes(); renderFaixas(); }
['receita','folha','margem','compras','icms','iss'].forEach(id => $(id).addEventListener('input', atualizar));
['atividade','credhib'].forEach(id => $(id).addEventListener('change', atualizar));

/* ===== PDF ===== */
function gerarPdfCore(p, dados, h){
  const {fmtBRL,fmtPct,calcRegimes,ranking,NOMES,FAIXAS,jsPDF} = h;
  const doc = new jsPDF({unit:'mm', format:'a4'});
  const W = 210, M = 16, CW = W - 2*M, TOP = 42, BOTTOM = 272;
  const C = {acc:[31,93,74], ink:[28,28,26], mut:[106,105,98], line:[214,211,202],
             zebra:[246,245,241], soft:[227,239,234], white:[255,255,255]};
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  let y = TOP;
  function cabecalho(){
    doc.setFillColor(...C.acc); doc.rect(0, 0, W, 34, 'F');
    doc.setTextColor(...C.white);
    doc.setFont('helvetica','bold'); doc.setFontSize(16);
    const nome = (dados.nome || 'Cliente não informado').trim();
    doc.text(doc.splitTextToSize(nome, CW)[0], M, 15);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5);
    doc.text('CNPJ: ' + (dados.cnpj || 'não informado'), M, 22);
    doc.text('Análise de regime tributário  |  ' + dataHoje, M, 28);
    doc.setTextColor(...C.ink);
  }
  function novaPagina(){ doc.addPage(); cabecalho(); y = TOP; }
  function garantir(hh){ if (y + hh > BOTTOM) novaPagina(); }
  function titulo(t){
    garantir(18); y += 2;
    doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(...C.acc);
    doc.text(t.toUpperCase(), M, y); y += 2.5;
    doc.setDrawColor(...C.acc); doc.setLineWidth(0.4); doc.line(M, y, W - M, y);
    y += 6; doc.setTextColor(...C.ink); doc.setLineWidth(0.2);
  }
  function pares(lista){
    const colW = CW / 2;
    for (let i = 0; i < lista.length; i += 2){
      garantir(11);
      [lista[i], lista[i+1]].forEach((par, j) => {
        if (!par) return;
        const x = M + j*colW;
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...C.mut);
        doc.text(par[0], x, y);
        doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(...C.ink);
        doc.text(String(par[1]), x, y + 5);
      });
      y += 11;
    }
    y += 2;
  }
  function tabela(cab, linhas, larguras, alinhas, destaque){
    const alt = 7.5;
    garantir(8 + alt);
    doc.setFillColor(...C.acc); doc.rect(M, y, CW, 8, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...C.white);
    let x = M;
    cab.forEach((c, i) => {
      const tx = alinhas[i] === 'r' ? x + larguras[i] - 2.5 : x + 2.5;
      doc.text(c, tx, y + 5.4, {align: alinhas[i] === 'r' ? 'right' : 'left'});
      x += larguras[i];
    });
    y += 8;
    linhas.forEach((ln, r) => {
      garantir(alt);
      const dest = destaque === r;
      doc.setFillColor(...(dest ? C.soft : (r % 2 === 1 ? C.zebra : C.white)));
      doc.rect(M, y, CW, alt, 'F');
      doc.setFont('helvetica', dest ? 'bold' : 'normal'); doc.setFontSize(9); doc.setTextColor(...C.ink);
      let xx = M;
      ln.forEach((c, i) => {
        const tx = alinhas[i] === 'r' ? xx + larguras[i] - 2.5 : xx + 2.5;
        doc.text(String(c), tx, y + 5, {align: alinhas[i] === 'r' ? 'right' : 'left'});
        xx += larguras[i];
      });
      y += alt;
    });
    doc.setDrawColor(...C.line); doc.line(M, y, W - M, y);
    y += 8;
  }
  function caixa(linhasTxt, fundo, cor){
    const pad = 4;
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    const linhas = linhasTxt.flatMap(t => doc.splitTextToSize(t, CW - 2*pad));
    const alt = linhas.length * 5 + 2*pad;
    garantir(alt + 6);
    doc.setFillColor(...fundo); doc.rect(M, y, CW, alt, 'F');
    doc.setTextColor(...cor);
    doc.text(linhas, M + pad, y + pad + 3.5);
    doc.setTextColor(...C.ink);
    y += alt + 7;
  }
  function texto(t, tam){
    const s = tam || 9;
    doc.setFont('helvetica','normal'); doc.setFontSize(s); doc.setTextColor(...C.ink);
    const linhas = doc.splitTextToSize(t, CW);
    const alt = linhas.length * s * 0.3528 * 1.15 + 3;
    garantir(alt);
    doc.text(linhas, M, y + 3);
    y += alt + 1;
  }

  cabecalho();
  const res = calcRegimes(p);
  const rank = ranking(res);

  titulo('Dados informados');
  pares([
    ['Faturamento mensal', fmtBRL.format(p.receita)],
    ['Atividade', ({comercio:'Comércio', industria:'Indústria', servicos:'Serviços em geral', servicos4:'Limpeza, vigilância e obras', servicos5:'Serviços intelectuais'})[p.atividade]],
    ['Anexo do Simples', res.anexo],
    ['Folha de pagamento mensal', fmtBRL.format(p.folha || 0)],
    ['Margem antes de impostos', fmtPct(p.margem)],
    ['Compras com crédito', fmtPct(p.compras) + ' do faturamento'],
    ['ICMS (São Paulo)', fmtPct(p.icms)],
    ['ISS (Guarulhos)', fmtPct(p.iss)],
    ['Crédito de ICMS no híbrido', p.credHibrido ? 'Sim' : 'Não'],
  ]);

  titulo('Resultado mensal');
  const chaves = ['simples','hibrido','presumido','real'];
  const linhasR = chaves.map(k => {
    const r = res[k];
    if (!r.elegivel) return [NOMES[k], '—', '—', 'Não se aplica'];
    return [NOMES[k], fmtBRL.format(r.imposto), fmtPct(r.efetiva), fmtBRL.format(r.liquido)];
  });
  tabela(['Regime','Impostos','Alíquota efetiva','Sobra após impostos'], linhasR,
         [CW*0.38, CW*0.2, CW*0.2, CW*0.22], ['l','r','r','r'],
         rank.length ? chaves.indexOf(rank[0]) : -1);

  if (rank.length){
    const linhasBox = ['Melhor regime para este faturamento: ' + NOMES[rank[0]] + '.'];
    if (rank.length > 1){
      const dif = res[rank[0]].liquido - res[rank[1]].liquido;
      linhasBox.push('Sobra ' + fmtBRL.format(dif) + ' por mês a mais do que o ' + NOMES[rank[1]] + '.');
    }
    caixa(linhasBox, C.soft, C.acc);
  }

  titulo('Qual regime ganha em cada faturamento');
  const linhasF = FAIXAS.map(R => {
    const rr = calcRegimes({...p, receita: R});
    const rk = ranking(rr);
    return [fmtBRL.format(R), rk.length ? NOMES[rk[0]] : '—', rk.length ? fmtBRL.format(rr[rk[0]].liquido) : '—'];
  });
  tabela(['Faturamento mensal','Melhor regime','Sobra no melhor'], linhasF,
         [CW*0.3, CW*0.4, CW*0.3], ['l','l','r'], FAIXAS.indexOf(p.receita));

  titulo('Premissas e limites');
  texto('Regras de 2026. Simples Nacional: tabela do Anexo I (comércio), II (indústria) ou III (serviços), pela faixa de faturamento dos últimos 12 meses. Simples híbrido: ICMS fora do DAS, com a partilha do Anexo I (34% nas faixas 1 e 2, 33,5% nas faixas 3 a 5, zero na faixa 6). Lucro Presumido e Lucro Real: IRPJ, CSLL, PIS, COFINS e ICMS. Simples híbrido aplicável a comércio e indústria, até R$ 4,8 milhões por ano.');
  texto('Simplificações: o ICMS é calculado sobre o faturamento como se já estivesse no preço, e a base de PIS e COFINS desconta esse ICMS. Não considera substituição tributária, DIFAL, compensação de prejuízo fiscal, RAT, contribuições a terceiros nem regimes específicos de ICMS. Serviços usam presunção de 32%; algumas atividades têm presunção menor e não estão modeladas.');
  texto('Fator R: folha dos últimos 12 meses dividida pela receita dos últimos 12 meses, com 28% como limite. Esta análise usa a folha do mês como aproximação da média de 12 meses.');
  texto('CPP patronal de 20% sobre a folha: no Anexo IV, e nos regimes sem DAS (Presumido e Real), é custo à parte. No Simples (Anexos I, II, III e V) já está dentro do DAS. RAT e contribuições a terceiros não são considerados.');
  texto('Legislação considerada: ICMS do estado de São Paulo e ISS de Guarulhos, com as alíquotas informadas acima. A regra de crédito do ICMS fora do DAS em São Paulo não foi confirmada por fonte oficial.');
  texto('Documento de estimativa. Confirme as premissas e a apuração com o contador responsável antes de decidir a troca de regime.');

  const n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++){
    doc.setPage(i);
    doc.setDrawColor(...C.line); doc.setLineWidth(0.2); doc.line(M, 281, W - M, 281);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...C.mut);
    doc.text('Estimativa com base nas regras de 2026. Confirme com o contador responsável.', M, 286);
    doc.text('Página ' + i + ' de ' + n, W - M, 286, {align: 'right'});
  }
  return doc.output('arraybuffer');
}

function gerarPdfBytes(p, dados){
  return gerarPdfCore(p, dados, {fmtBRL, fmtPct, calcRegimes, ranking, NOMES, FAIXAS, jsPDF: window.jspdf.jsPDF});
}
$('btn-pdf').addEventListener('click', () => {
  const msg = $('pdf-msg');
  msg.className = 'status';
  msg.textContent = '';
  try {
    const bytes = gerarPdfBytes(entradas(), {nome: $('nome').value.trim(), cnpj: $('cnpj').value.trim()});
    const blob = new Blob([bytes], {type: 'application/pdf'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analise-' + (digitosCnpj() || 'cliente') + '.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    msg.className = 'status ok';
    msg.textContent = 'PDF gerado.';
  } catch (err){
    msg.className = 'status bad';
    msg.textContent = 'Não foi possível gerar o PDF: ' + err.message;
  }
});

function limparConsulta(){
  $('cnpj').value = '';
  limparCliente();
  $('cnpj-msg').className = 'status';
  $('cnpj-msg').textContent = 'Digite os 14 números do CNPJ.';
  zerarEntradas();
  $('atividade').value = 'comercio';
  $('credhib').value = 'sim';
  atualizar();
}
$('btn-limpar').addEventListener('click', limparConsulta);

atualizar();
