/*
 * Tela da calculadora. O cálculo fica em motor/ (Motor.regimes, Motor.insights...) e
 * o rascunho/histórico em dados/armazenamento.js. Este arquivo só lê campos e desenha.
 */
'use strict';
const Motor = window.Motor;
const P = Motor.parametros;
const NOMES = Motor.regimes.NOMES;
const ORDEM = Motor.regimes.ORDEM;

/* ===== Formatação e campos ===== */
const fmtBRL = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
const fmtNum = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const fmtPct = v => (v * 100).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
function parseBRL(s){ const d = (s || '').replace(/\D/g, ''); return d ? parseInt(d, 10) / 100 : 0; }
function vazio(id){ return ($(id).value || '').trim() === ''; }
function lerNum(id){ const v = parseFloat($(id).value); return isNaN(v) || v < 0 ? 0 : v; }
function radio(nome){ const r = document.querySelector('input[name="' + nome + '"]:checked'); return r ? r.value : null; }
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
// Campos de dinheiro: R$ fixo à esquerda, digitação a partir dos centavos
const CAMPOS_MOEDA = ['receita', 'folha', 'prolabore', 'outras', 'irOutras'];
CAMPOS_MOEDA.forEach(id => $(id).addEventListener('input', () => {
  const d = $(id).value.replace(/\D/g, '');
  $(id).value = d ? fmtNum.format(parseInt(d, 10) / 100) : '';
}));

// Zera as entradas quando o CNPJ é apagado por completo
function zerarEntradas(){
  ['receita', 'folha', 'margem', 'compras', 'icms', 'iss', 'cnae'].forEach(id => { $(id).value = ''; });
  $('semcompras').checked = false;
  aplicarCnae();
  atualizar();
}

/* ===== Consulta de CNPJ (extensão tem permissão para publica.cnpj.ws) ===== */
// Endereço do Cloudflare Worker (proxy). Troque pela URL que o Cloudflare gerar.
const PROXY_CNPJ = 'SUBSTITUA-PELA-URL-DO-WORKER';
async function consultarProxy(d){
  const r = await fetch(PROXY_CNPJ + '/cnpj/' + d);
  if (r.status === 404) throw new Error('CNPJ não encontrado na base pública.');
  if (!r.ok) throw new Error('Não foi possível consultar agora. Tente de novo em instantes.');
  return await r.json();
}
// Tenta o proxy; se não estiver configurado ou não responder, tenta a publica.cnpj.ws e a BrasilAPI
async function consultarCnpj(d){
  if (!PROXY_CNPJ.startsWith('SUBSTITUA')){
    try {
      return await consultarProxy(d);
    } catch (e){
      if (!(e instanceof TypeError)) throw e;
    }
  }
  try {
    return await consultarPublica(d);
  } catch (e){
    if (!(e instanceof TypeError)) throw e;
  }
  try {
    return await consultarBrasilApi(d);
  } catch (e){
    throw new Error('Este navegador não conseguiu consultar a base de CNPJ. Digite a razão social manualmente.');
  }
}
async function consultarPublica(d){
  const r = await fetch('https://publica.cnpj.ws/cnpj/' + d);
  if (r.status === 404) throw new Error('CNPJ não encontrado na base pública.');
  if (r.status === 429) throw new Error('Muitas consultas seguidas. Aguarde um minuto e tente de novo.');
  if (!r.ok) throw new Error('Não foi possível consultar agora. Tente de novo em instantes.');
  const j = await r.json();
  return {
    razao: j.razao_social || '',
    cnae: (j.estabelecimento && j.estabelecimento.atividade_principal && j.estabelecimento.atividade_principal.id) || '',
    cnaeDesc: (j.estabelecimento && j.estabelecimento.atividade_principal && j.estabelecimento.atividade_principal.descricao) || '',
    situacao: (j.estabelecimento && j.estabelecimento.situacao_cadastral) || 'Não informada'
  };
}
async function consultarBrasilApi(d){
  const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + d);
  if (!r.ok) throw new Error('BrasilAPI indisponível');
  const j = await r.json();
  return {
    razao: j.razao_social || '',
    cnae: j.cnae_fiscal ? String(j.cnae_fiscal).padStart(7, '0') : '',
    cnaeDesc: j.cnae_fiscal_descricao || '',
    situacao: j.descricao_situacao_cadastral ? j.descricao_situacao_cadastral.charAt(0) + j.descricao_situacao_cadastral.slice(1).toLowerCase() : 'Não informada'
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
  $('acao-msg').className = 'status';
  $('acao-msg').textContent = '';
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
    $('cnpj-msg').textContent = d.length ? `Faltam ${14 - d.length} dígitos.` : 'Preenche razão social e atividade.';
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
    if (e.cnae){ $('cnae').value = mascaraCnae(e.cnae); aplicarCnae(e.cnaeDesc); }
  } catch (err){
    if (digitosCnpj() !== d) return;
    ultimoCnpj = '';
    $('cnpj-msg').className = 'status bad';
    $('cnpj-msg').textContent = err.message;
  }
}

/* ===== CNAE: escolhe a atividade e o Fator R ===== */
// CNAEs vedados no Simples que a calculadora trata (fora da tabela CNAE_TABELA)
const CNAE_EXTRA = {
  '6810202': ['Aluguel de imóveis próprios', 'locacao'],
  '6810203': ['Loteamento de imóveis próprios', 'incorporacao'],
  '4110700': ['Incorporação de empreendimentos imobiliários', 'incorporacao'],
  '6462000': ['Holdings de instituições não-financeiras', 'holding'],
  '6463800': ['Outras sociedades de participação, exceto holdings', 'holding']
};
function mascaraCnae(v){
  const d = String(v || '').replace(/\D/g, '').slice(0, 7);
  if (d.length <= 4) return d;
  if (d.length === 5) return d.slice(0, 4) + '-' + d.slice(4);
  return d.slice(0, 4) + '-' + d.slice(4, 5) + '/' + d.slice(5);
}
function classificarCnae(d){
  if (CNAE_EXTRA[d]) return {desc: CNAE_EXTRA[d][0], atividade: CNAE_EXTRA[d][1], fatorR: false, vedado: true, aviso: ''};
  const t = (typeof CNAE_TABELA !== 'undefined') ? CNAE_TABELA[d] : null;
  if (!t) return null;
  const [desc, anexos, fr] = t;
  const lista = anexos.split('/');
  let atividade, aviso = '';
  if (fr){
    atividade = 'servicos5';
    if (lista.includes('IV')) aviso = 'A lista indica os Anexos IV e V para este CNAE; confira com o contador.';
  } else {
    const a = lista[0];
    const construcao = ['41', '42', '43'].includes(d.slice(0, 2));
    atividade = a === 'I' ? 'comercio' : a === 'II' ? 'industria' : a === 'III' ? 'servicos' : a === 'IV' ? (construcao ? 'construcao_mo' : 'servicos4') : 'servicos5';
    if (lista.length > 1) aviso = 'CNAE em mais de um anexo (' + anexos + '); confira a atividade exercida.';
    if (atividade === 'construcao_mo') aviso = 'Se for empreitada total com materiais, troque a atividade para "empreitada total".';
  }
  return {desc, atividade, fatorR: !!fr, vedado: false, anexos, aviso};
}
var enquadramentoTravado = false;
function travarEnquadramento(travar){
  enquadramentoTravado = travar;
  const sel = $('atividade');
  sel.setAttribute('aria-disabled', travar ? 'true' : 'false');
  sel.classList.toggle('travado', travar);
  $('linha-trava').hidden = !travar;
  atualizarFatorR();
}
$('btn-destravar').addEventListener('click', () => { travarEnquadramento(false); $('atividade').focus(); });
// Travado: o campo segue focável e legível, mas não muda de valor
$('atividade').addEventListener('mousedown', e => { if (enquadramentoTravado) e.preventDefault(); });
$('atividade').addEventListener('keydown', e => { if (enquadramentoTravado && e.key !== 'Tab' && e.key !== 'Shift') e.preventDefault(); });
function mostrarAtividade(texto){
  const caixa = $('caixa-atividade');
  caixa.hidden = !texto;
  $('cnae-atividade').textContent = texto || '';
}
function aplicarCnae(descApi){
  const d = ($('cnae').value || '').replace(/\D/g, '');
  const info = $('cnae-info');
  if (d.length === 0){ travarEnquadramento(false); mostrarAtividade(''); info.className = 'status'; info.textContent = 'Define a atividade e o Fator R automaticamente.'; return; }
  if (d.length < 7){ travarEnquadramento(false); mostrarAtividade(''); info.className = 'status'; info.textContent = 'Faltam ' + (7 - d.length) + ' dígitos.'; return; }
  const c = classificarCnae(d);
  if (!c){
    travarEnquadramento(false);
    mostrarAtividade(descApi || '');
    info.className = 'status bad';
    info.textContent = 'CNAE fora da tabela. Pode ser atividade vedada no Simples; escolha o enquadramento manualmente.';
    return;
  }
  $('atividade').value = c.atividade;
  $('fatorr').checked = c.fatorR;
  travarEnquadramento(true);
  mostrarAtividade(c.desc);
  const destino = c.vedado ? 'Não pode optar pelo Simples.' : (c.fatorR ? 'Sujeito ao Fator R: Anexo III ou V, conforme a folha.' : 'Anexo ' + c.anexos + '.');
  info.className = 'status ok';
  info.textContent = destino + (c.aviso ? ' ' + c.aviso : '');
  atualizar();
}
$('cnae').addEventListener('input', () => { $('cnae').value = mascaraCnae($('cnae').value); aplicarCnae(); });

/* ===== Entradas para o motor ===== */
function entradas(){
  const distribuir = radio('distribuir') === 'sim';
  return {
    receita: parseBRL($('receita').value),
    folha: parseBRL($('folha').value),
    cnae: ($('cnae').value || '').replace(/\D/g, ''),
    atividade: $('atividade').value,
    fatorR: $('fatorr').checked,
    margem: lerNum('margem') / 100,
    compras: lerNum('compras') / 100,
    semCompras: $('semcompras').checked,
    icms: lerNum('icms') / 100,
    iss: lerNum('iss') / 100,
    ano: parseInt($('ano').value, 10) || 2026,
    meses: parseInt($('periodo').value, 10) || 1,
    referencia: {cbs: lerNum('refcbs') / 100, ibs: lerNum('refibs') / 100},
    comprador: radio('comprador') || 'pf',
    distribuir,
    socios: {
      quantidade: Math.max(1, Math.round(lerNum('socios')) || 1),
      percentual: distribuir ? Math.min(100, lerNum('percentual')) / 100 : 0,
      proLabore: parseBRL($('prolabore').value),
      outrasRendasAnuais: parseBRL($('outras').value),
      irOutrasRendas: parseBRL($('irOutras').value),
      aplicarNoSimples: $('divsimples').checked
    }
  };
}
const SUFIXO = {1: 'por mês', 2: 'por bimestre', 6: 'por semestre', 12: 'por ano'};
const NOME_PERIODO = {1: 'Mensal', 2: 'Bimestral', 6: 'Semestral', 12: 'Anual'};

/* ===== Etapas ===== */
let passoAtual = 1;
const ROTULOS_FALTA = {};
function ehComercio(){ const c = P.ATIVIDADES[$('atividade').value]; return !!(c && c.icms); }
function temIss(){ const c = P.ATIVIDADES[$('atividade').value]; return !!(c && c.iss); }
// O que falta em cada etapa: [id do campo, rótulo]
function faltas(n){
  const f = [];
  if (n === 1){
    const d = digitosCnpj().length;
    if (d > 0 && d < 14) f.push(['cnpj', 'CNPJ completo (ou apague)']);
  }
  if (n === 2){
    if (!(parseBRL($('receita').value) > 0)) f.push(['receita', 'faturamento mensal']);
    if (vazio('folha')) f.push(['folha', 'folha de pagamento (pode ser 0)']);
    if (vazio('margem')) f.push(['margem', 'lucro antes dos impostos']);
  }
  if (n === 3){
    if (ehComercio() && vazio('compras') && !$('semcompras').checked) f.push(['compras', 'compras com crédito (ou marque que não há)']);
    if (ehComercio() && vazio('icms')) f.push(['icms', 'alíquota de ICMS']);
    if (temIss() && vazio('iss')) f.push(['iss', 'alíquota de ISS']);
  }
  if (n === 4 && radio('distribuir') === 'sim' && !(lerNum('socios') >= 1)) f.push(['socios', 'número de sócios']);
  return f;
}
function primeiroComFalta(){ for (let n = 1; n <= 4; n++) if (faltas(n).length) return n; return 5; }
function irPara(n){
  const limite = primeiroComFalta();
  if (n > limite) n = limite;
  passoAtual = n;
  document.querySelectorAll('.etapa').forEach(s => { s.hidden = Number(s.dataset.etapa) !== n; });
  $('resultado').hidden = n !== 5;
  $('nav-etapas').hidden = n === 5;
  $('btn-voltar').hidden = n === 1;
  $('btn-proximo').textContent = n === 4 ? 'Ver resultado' : 'Próximo';
  $('falta').textContent = '';
  document.querySelectorAll('.stepper li').forEach((li, i) => {
    const p = i + 1;
    li.classList.toggle('atual', p === n);
    li.classList.toggle('feito', p < n || (p < 5 && p !== n && faltas(p).length === 0 && p < limite));
    const b = li.querySelector('button');
    b.disabled = p > limite;
    if (p === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.setAttribute('aria-label', 'Etapa ' + p + ': ' + b.querySelector('.rot').textContent + (li.classList.contains('feito') ? ', concluída' : '') + (p > limite ? ', bloqueada' : ''));
  });
  if (n === 5) atualizar();
  atualizarAvisos();
  salvarRascunhoDepois();
}
function avancar(){
  const f = faltas(passoAtual);
  if (f.length){
    $('falta').textContent = 'Preencha para avançar: ' + f.map(x => x[1]).join(', ') + '.';
    const campo = $(f[0][0]);
    if (campo) campo.focus();
    return;
  }
  irPara(passoAtual + 1);
  focarEtapa();
}
function focarEtapa(){
  const alvo = passoAtual === 5 ? $('t5') : document.querySelector('.etapa[data-etapa="' + passoAtual + '"] h2');
  if (!alvo) return;
  alvo.setAttribute('tabindex', '-1');
  alvo.focus({preventScroll: true});
  window.scrollTo({top: 0, behavior: 'smooth'});
}
$('btn-proximo').addEventListener('click', avancar);
$('btn-voltar').addEventListener('click', () => { irPara(Math.max(1, passoAtual - 1)); focarEtapa(); });
document.querySelectorAll('.stepper .passo').forEach(b => b.addEventListener('click', () => { irPara(Number(b.dataset.passo)); focarEtapa(); }));

// Avisos de consequência ao lado dos campos (o que acontece com o resultado sem o dado)
function atualizarAvisos(){
  const e = entradas();
  const lista = Motor.insights.faltas(e);
  ['margem', 'folha', 'compras', 'icms', 'iss'].forEach(campo => {
    const el = $('aviso-' + campo);
    const a = lista.find(x => x.campo === campo);
    const tocado = !vazio(campo) || (campo === 'compras' && $('semcompras').checked);
    // Só avisa depois que o campo foi preenchido (vazio já trava o "Próximo")
    el.hidden = !(a && tocado);
    el.textContent = a ? a.texto : '';
  });
}

/* ===== Resultado ===== */
let categoria = 'todos';
function faseDoAno(ano, ref){
  const a = Motor.regimes.aliquotasCbsIbs(ano, ref);
  if (ano === 2026) return 'Ano de teste: CBS 0,9% e IBS 0,1% compensados com PIS/COFINS. Regras atuais.';
  if (ano <= 2028) return 'PIS/COFINS extintos. CBS de ' + fmtPct(a.cbs) + ' e IBS de 0,1%. ICMS e ISS cheios.';
  if (ano <= 2032) return 'ICMS e ISS a ' + Math.round((1 - P.TRANSICAO_ICMS_ISS[ano]) * 100) + '% da alíquota. IBS de ' + fmtPct(a.ibs) + '.';
  return 'Sistema novo completo: ICMS e ISS extintos. CBS de ' + fmtPct(a.cbs) + ' e IBS de ' + fmtPct(a.ibs) + '.';
}
function elegiveis(res){ return ORDEM.filter(k => res.regimes[k].elegivel); }

function renderKpis(res, e){
  const box = $('kpis');
  if (!(e.receita > 0)){ box.innerHTML = '<div class="kpi"><span class="r">Resultado</span><span class="v">Informe o faturamento</span></div>'; return; }
  const rk = res.ranking;
  const m = res.regimes[rk[0]];
  const seg = rk[1] ? res.regimes[rk[1]] : null;
  const suf = SUFIXO[e.meses];
  const cargaLucro = res.lucroPeriodo > 0 ? fmtPct(m.total / res.lucroPeriodo) : '—';
  let h = `<div class="kpi destaque"><span class="r">Melhor regime em ${res.ano}</span><span class="v">${esc(m.nome)}</span><span class="d">${seg ? 'Sobra ' + fmtBRL.format(m.sobra - seg.sobra) + ' ' + suf + ' a mais que ' + esc(seg.nome) : 'Único regime aplicável'}</span></div>`;
  h += `<div class="kpi"><span class="r">Tributos da empresa</span><span class="v">${fmtBRL.format(m.total)}</span><span class="d">${suf}</span></div>`;
  h += `<div class="kpi"><span class="r">Carga sobre o faturamento</span><span class="v">${fmtPct(m.efetiva)}</span><span class="d">Faturamento de ${fmtBRL.format(res.receitaPeriodo)}</span></div>`;
  h += `<div class="kpi"><span class="r">Carga sobre o lucro</span><span class="v">${cargaLucro}</span><span class="d">Lucro antes dos impostos de ${fmtBRL.format(res.lucroPeriodo)}</span></div>`;
  if (e.distribuir && m.distribuicao){
    h += `<div class="kpi"><span class="r">Para os sócios, após o IR</span><span class="v">${fmtBRL.format(m.distribuicao.liquidoSociosMes)}</span><span class="d">IR sobre dividendos: ${fmtBRL.format(m.distribuicao.irpfmMes)}</span></div>`;
  }
  box.innerHTML = h;
}

function renderTributos(res){
  const ks = elegiveis(res);
  const melhor = res.ranking[0];
  const head = '<thead><tr><th scope="col">' + (categoria === 'todos' ? 'Categoria' : 'Tributo') + '</th>' + ks.map(k => `<th scope="col" class="${k === melhor ? 'melhor' : ''}">${esc(NOMES[k])}${k === melhor ? '<span class="tag">melhor</span>' : ''}</th>`).join('') + '</tr></thead>';
  const cel = (k, v) => `<td class="${k === melhor ? 'melhor' : ''}">${v}</td>`;
  let corpo = '';
  if (categoria === 'todos'){
    ['renda', 'consumo', 'folha'].forEach(c => {
      corpo += `<tr><th scope="row">${P.CATEGORIAS[c].nome}</th>` + ks.map(k => cel(k, fmtBRL.format(Motor.regimes.porCategoria(res.regimes[k])[c]))).join('') + '</tr>';
    });
  } else {
    const cods = [];
    ks.forEach(k => res.regimes[k].tributos.forEach(t => { if (t.categoria === categoria && !cods.includes(t.codigo)) cods.push(t.codigo); }));
    if (!cods.length) corpo += `<tr><td colspan="${ks.length + 1}" class="na">Nenhum tributo desta categoria no ano escolhido.</td></tr>`;
    cods.forEach(c => {
      corpo += `<tr><th scope="row">${esc(c)}</th>` + ks.map(k => {
        const t = res.regimes[k].tributos.filter(x => x.codigo === c).reduce((s, x) => s + x.valor, 0);
        return cel(k, t ? fmtBRL.format(t) : '—');
      }).join('') + '</tr>';
    });
    corpo += `<tr class="sub"><th scope="row">Subtotal ${P.CATEGORIAS[categoria].nome.toLowerCase()}</th>` + ks.map(k => cel(k, fmtBRL.format(Motor.regimes.porCategoria(res.regimes[k])[categoria]))).join('') + '</tr>';
  }
  corpo += '<tr class="total"><th scope="row">Total de tributos</th>' + ks.map(k => cel(k, fmtBRL.format(res.regimes[k].total))).join('') + '</tr>';
  corpo += '<tr><th scope="row">Carga sobre o faturamento</th>' + ks.map(k => cel(k, fmtPct(res.regimes[k].efetiva))).join('') + '</tr>';
  corpo += '<tr><th scope="row">Sobra na empresa</th>' + ks.map(k => cel(k, fmtBRL.format(res.regimes[k].sobra))).join('') + '</tr>';
  const fora = ORDEM.filter(k => !res.regimes[k].elegivel && !(k === 'ret'));
  let nota = '';
  if (fora.length) nota = '<caption class="hint" style="caption-side:bottom;text-align:left">' + fora.map(k => esc(NOMES[k]) + ': não se aplica (' + esc(res.regimes[k].motivo) + ').').join(' ') + '</caption>';
  $('tbl-trib').innerHTML = head + '<tbody>' + corpo + '</tbody>' + nota;
}

function renderComparativo(res, e){
  const ks = elegiveis(res);
  const suf = SUFIXO[e.meses];
  const melhorSem = res.ranking[0];
  let melhorCom = null;
  if (e.distribuir){
    melhorCom = ks.slice().sort((a, b) => res.regimes[b].distribuicao.liquidoSociosMes - res.regimes[a].distribuicao.liquidoSociosMes)[0];
  }
  $('comp-dica').textContent = e.distribuir
    ? 'Valores ' + suf + '. Melhor mantendo o lucro na empresa: ' + NOMES[melhorSem] + '. Melhor levando o lucro aos sócios: ' + NOMES[melhorCom] + '.'
    : 'Valores ' + suf + '. Lucro mantido na empresa (escolha da etapa 4).';
  $('comparativo').innerHTML = ks.map(k => {
    const r = res.regimes[k];
    const d = r.distribuicao;
    let h = `<article class="reg ${k === melhorSem ? 'melhor' : ''}"><h3>${esc(r.nome)}${k === melhorSem ? '<span class="tag">melhor</span>' : ''}</h3>`;
    h += '<p class="bloco">Sem distribuir</p><dl>';
    h += `<dt>Tributos da empresa</dt><dd>${fmtBRL.format(r.total)}</dd><dt>Carga</dt><dd>${fmtPct(r.efetiva)}</dd><dt>Sobra na empresa</dt><dd class="forte">${fmtBRL.format(r.sobra)}</dd></dl>`;
    if (e.distribuir && d){
      h += `<p class="bloco">Com distribuição aos sócios${k === melhorCom ? ' · melhor' : ''}</p><dl>`;
      h += `<dt>Dividendos pagos</dt><dd>${fmtBRL.format(d.distribuidoMes)}</dd>`;
      h += `<dt>IR retido na fonte</dt><dd>${fmtBRL.format(d.retidoMes)}</dd>`;
      h += `<dt>IR sobre dividendos no ano</dt><dd>${fmtBRL.format(d.irpfmMes)}</dd>`;
      h += `<dt>Líquido para os sócios</dt><dd class="forte">${fmtBRL.format(d.liquidoSociosMes)}</dd>`;
      h += `<dt>Carga empresa + sócio</dt><dd>${fmtPct(res.receitaPeriodo > 0 ? d.totalComDistribuicao / res.receitaPeriodo : 0)}</dd></dl>`;
      if (d.isento) h += '<p class="na">Dividendos do Simples tratados como isentos (LC 123, art. 14).</p>';
    }
    return h + '</article>';
  }).join('');
}

function renderInsights(res, e){
  const itens = Motor.insights.gerar(res, e);
  $('insights').innerHTML = itens.map(i => `<li class="${i.tipo}">${esc(i.texto)}</li>`).join('') || '<li>Sem observações para este cenário.</li>';
}

function renderComprador(res, e){
  const sec = $('secao-comprador');
  const corpo = $('tbl-comprador');
  if (res.ano < 2027){
    $('comprador-dica').textContent = 'O crédito de CBS/IBS para o cliente começa em 2027. Arraste o ano para ver.';
    corpo.innerHTML = '';
    return;
  }
  const c = res.comprador;
  const nomeC = {pf: 'O consumidor final', pj_real: 'A empresa no Lucro Real', pj_presumido: 'A empresa no Presumido', pj_simples: 'A empresa no Simples'}[e.comprador];
  $('comprador-dica').textContent = c.tomaCredito
    ? nomeC + ' toma crédito do CBS/IBS. O custo para ele depende do regime da sua empresa.'
    : nomeC + ' não toma crédito de CBS/IBS: o custo é o preço cheio em qualquer regime.';
  const menor = Math.min(...c.linhas.map(l => l.liquido));
  corpo.innerHTML = c.linhas.map(l => `<tr><td>${esc(l.nome)}${c.tomaCredito && l.liquido === menor ? '<span class="tag">menor custo</span>' : ''}</td><td>${fmtBRL.format(l.pago)}</td><td>${fmtBRL.format(l.credito)}</td><td>${fmtBRL.format(l.liquido)}</td></tr>`).join('');
  sec.hidden = false;
}

const FAIXAS = [5000, 10000, 15000, 20000, 40000, 60000, 100000, 200000, 350000];
function renderFaixas(e){
  $('tbl-faixa').innerHTML = FAIXAS.map(R => {
    const r = Motor.regimes.calcular(Object.assign({}, e, {receita: R}));
    const m = r.regimes[r.ranking[0]];
    return `<tr${R === e.receita ? ' class="total"' : ''}><td>${fmtBRL.format(R)}</td><td>${esc(m.nome)}</td><td>${fmtBRL.format(m.sobra)}</td></tr>`;
  }).join('');
}

function valorMemoria(l){
  if (typeof l.valor !== 'number') return '—';
  if (/^(Alíquota|Acréscimo)/.test(l.etapa)) return fmtPct(l.valor);
  return fmtBRL.format(l.valor);
}
function renderMemoria(res, e){
  $('h-memo').textContent = 'Memória de cálculo · ' + NOME_PERIODO[e.meses].toLowerCase() + ' · ' + res.ano;
  $('memoria').className = 'memo';
  $('memoria').innerHTML = elegiveis(res).map(k => {
    const r = res.regimes[k];
    const linhas = r.memoria.map(l => `<tr><td>${esc(l.etapa)}</td><td>${esc(l.formula)}</td><td>${valorMemoria(l)}</td><td>${esc(l.fundamento)}</td></tr>`).join('');
    return `<h3>${esc(r.nome)}</h3><div class="tablewrap"><table><thead><tr><th>Etapa</th><th>Fórmula</th><th>Valor</th><th>Fundamento</th></tr></thead><tbody>${linhas}<tr class="total"><td>Total de tributos</td><td></td><td>${fmtBRL.format(r.total)}</td><td></td></tr></tbody></table></div>`;
  }).join('');
}

// O Fator R só aparece e só pode ser marcado quando a atividade é do Anexo V
function atualizarFatorR(){
  const at = $('atividade').value;
  const anexoV = at === 'servicos5';
  $('linha-fatorr').hidden = !anexoV;
  $('fatorr').disabled = !anexoV || enquadramentoTravado;
  if (!anexoV) $('fatorr').checked = false;
  document.querySelectorAll('.so-com').forEach(el => { el.hidden = !ehComercio(); });
  document.querySelectorAll('.so-iss').forEach(el => { el.hidden = !temIss(); });
  document.querySelectorAll('.so-distribuir').forEach(el => { el.hidden = radio('distribuir') !== 'sim'; });
}

function atualizar(){
  atualizarFatorR();
  atualizarAvisos();
  if (passoAtual !== 5) return;
  const e = entradas();
  $('ano-saida').textContent = e.ano;
  $('ano').setAttribute('aria-valuetext', String(e.ano));
  $('ano-fase').textContent = faseDoAno(e.ano, e.referencia);
  const res = Motor.regimes.calcular(e);
  renderKpis(res, e);
  if (!(e.receita > 0)) return;
  renderTributos(res);
  renderComparativo(res, e);
  renderInsights(res, e);
  renderComprador(res, e);
  renderFaixas(e);
  renderMemoria(res, e);
}
$('form').addEventListener('input', () => { atualizar(); salvarRascunhoDepois(); });
$('form').addEventListener('change', () => { atualizar(); salvarRascunhoDepois(); });
['periodo', 'ano'].forEach(id => $(id).addEventListener('input', () => { atualizar(); salvarRascunhoDepois(); }));
$('periodo').addEventListener('change', atualizar);
document.querySelectorAll('.segmentado button').forEach(b => b.addEventListener('click', () => {
  categoria = b.dataset.cat;
  document.querySelectorAll('.segmentado button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  atualizar();
}));

/* ===== Rascunho, histórico e compartilhamento ===== */
const IDS_CAMPOS = ['cnpj', 'nome', 'cnae', 'atividade', 'fatorr', 'receita', 'folha', 'margem', 'compras', 'semcompras', 'icms', 'iss',
  'socios', 'percentual', 'prolabore', 'outras', 'irOutras', 'divsimples', 'refcbs', 'refibs', 'periodo', 'ano'];
function coletarCampos(semIdentificacao){
  const d = {};
  IDS_CAMPOS.forEach(id => {
    if (semIdentificacao && (id === 'cnpj' || id === 'nome')) return;
    const el = $(id);
    d[id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  d.comprador = radio('comprador');
  d.distribuir = radio('distribuir');
  d.travado = enquadramentoTravado;
  d.passo = passoAtual;
  return d;
}
function aplicarCampos(d){
  if (!d) return;
  IDS_CAMPOS.forEach(id => {
    if (!(id in d)) return;
    const el = $(id);
    if (el.type === 'checkbox') el.checked = !!d[id]; else el.value = d[id];
  });
  ['comprador', 'distribuir'].forEach(n => {
    const r = document.querySelector('input[name="' + n + '"][value="' + d[n] + '"]');
    if (r) r.checked = true;
  });
  const atividade = d.atividade;
  const fatorr = d.fatorr;
  if ((d.cnae || '').replace(/\D/g, '').length === 7) aplicarCnae();
  if (!d.travado || $('atividade').value !== atividade){
    travarEnquadramento(false);
    $('atividade').value = atividade;
    atualizarFatorR();
    $('fatorr').checked = !!fatorr && atividade === 'servicos5';
  }
  if (digitosCnpj().length === 14) ultimoCnpj = digitosCnpj();
}
let timerRascunho = null;
function salvarRascunhoDepois(){
  clearTimeout(timerRascunho);
  timerRascunho = setTimeout(() => {
    const quando = window.Armazenamento.salvarRascunho(coletarCampos());
    if (quando) $('rascunho').textContent = 'Rascunho salvo às ' + quando.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
  }, 500);
}

function renderHistorico(){
  const lista = window.Armazenamento.listarHistorico();
  $('historico').innerHTML = lista.length ? lista.map(i => `<li><div class="info"><b>${esc(i.titulo)}</b><small>${esc(i.resumo || '')} · ${new Date(i.criadoEm).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}</small></div><button type="button" class="btn-secundario" data-abrir="${esc(i.id)}">Abrir</button><button type="button" class="btn-secundario" data-excluir="${esc(i.id)}" aria-label="Excluir ${esc(i.titulo)}">Excluir</button></li>`).join('')
    : '<li><div class="info"><small>Nenhuma simulação salva. Use "Salvar no histórico".</small></div></li>';
}
$('historico').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.dataset.excluir){ window.Armazenamento.removerDoHistorico(b.dataset.excluir); renderHistorico(); return; }
  const item = window.Armazenamento.listarHistorico().find(i => i.id === b.dataset.abrir);
  if (item){ aplicarCampos(item.dados); irPara(5); focarEtapa(); msg('Simulação aberta: ' + item.titulo + '.', 'ok'); }
});
function msg(t, tipo){ $('acao-msg').className = 'status' + (tipo ? ' ' + tipo : ''); $('acao-msg').textContent = t; }
$('btn-salvar').addEventListener('click', () => {
  const e = entradas();
  const res = Motor.regimes.calcular(e);
  const titulo = $('nome').value.trim() || $('cnpj').value.trim() || 'Simulação sem nome';
  const resumo = NOMES[res.ranking[0]] + ' · ' + fmtBRL.format(e.receita) + '/mês · ' + e.ano;
  const ok = window.Armazenamento.salvarNoHistorico({titulo, resumo, dados: coletarCampos()});
  renderHistorico();
  msg(ok ? 'Salvo no histórico deste navegador.' : 'Este navegador bloqueou o armazenamento; a simulação não foi salva.', ok ? 'ok' : 'bad');
});
$('btn-editar').addEventListener('click', () => { irPara(1); focarEtapa(); });
function limparTudo(){
  $('form').reset();
  $('cnpj').value = '';
  limparCliente();
  $('cnpj-msg').className = 'status';
  $('cnpj-msg').textContent = 'Preenche razão social e atividade.';
  $('cnae').value = '';
  aplicarCnae();
  $('periodo').value = '1';
  $('ano').value = '2026';
  window.Armazenamento.limparRascunho();
  $('rascunho').textContent = '';
  history.replaceState(null, '', location.pathname + location.search);
  irPara(1);
  focarEtapa();
}
$('btn-limpar').addEventListener('click', limparTudo);

// Link compartilhável: números da simulação no endereço, sem CNPJ e sem razão social
function linkCompartilhavel(){
  const json = JSON.stringify(coletarCampos(true));
  const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return location.origin + location.pathname + '#s=' + b64;
}
function lerLinkCompartilhado(){
  const m = location.hash.match(/^#s=([\w-]+)$/);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch (e){ return null; }
}
$('btn-compartilhar').addEventListener('click', async () => {
  try {
    const bytes = gerarPdfBytes();
    const arquivo = new File([bytes], nomeArquivoPdf(), {type: 'application/pdf'});
    if (navigator.canShare && navigator.canShare({files: [arquivo]})){
      await navigator.share({files: [arquivo], title: 'Análise de regime tributário'});
      msg('Análise compartilhada.', 'ok');
      return;
    }
  } catch (err){
    if (err && err.name === 'AbortError') return;
  }
  const link = linkCompartilhavel();
  try {
    await navigator.clipboard.writeText(link);
    msg('Link copiado. Ele abre esta simulação com os mesmos números, sem CNPJ e sem razão social.', 'ok');
  } catch (e){
    msg('Copie o link: ' + link);
  }
});

/* ===== PDF ===== */
function nomeArquivoPdf(){ return 'analise-' + (digitosCnpj() || 'cliente') + '-' + $('ano').value + '.pdf'; }
const semAcento = s => String(s).replace(/−/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, ' ');
function gerarPdfBytes(){
  const e = entradas();
  const dados = {nome: $('nome').value.trim(), cnpj: $('cnpj').value.trim()};
  const res = Motor.regimes.calcular(e);
  const todos = Motor.regimes.calcularTodosAnos(e);
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({unit: 'mm', format: 'a4'});
  const W = 210, M = 15, CW = W - 2 * M, TOP = 40, BOTTOM = 276;
  const C = {navy: [20, 33, 61], gold: [201, 162, 39], goldSoft: [248, 240, 217], ink: [20, 33, 61], mut: [90, 99, 116], line: [227, 221, 207], zebra: [250, 248, 243], white: [255, 255, 255], ok: [21, 113, 72]};
  const hoje = new Date().toLocaleDateString('pt-BR');
  let y = TOP;
  const T = s => semAcento(s);
  function cabecalho(){
    doc.setFillColor(...C.navy); doc.rect(0, 0, W, 30, 'F');
    doc.setFillColor(...C.gold); doc.rect(0, 30, W, 1.2, 'F');
    doc.setTextColor(...C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(doc.splitTextToSize(T(dados.nome || 'Cliente não informado'), CW)[0], M, 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(T('CNPJ: ' + (dados.cnpj || 'não informado') + '   |   Análise de regime tributário   |   ' + hoje), M, 21);
    doc.setTextColor(...C.ink);
  }
  function novaPagina(){ doc.addPage(); cabecalho(); y = TOP; }
  function garantir(h){ if (y + h > BOTTOM) novaPagina(); }
  function titulo(t){
    garantir(18); y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...C.navy);
    doc.text(T(t.toUpperCase()), M, y); y += 2;
    doc.setDrawColor(...C.gold); doc.setLineWidth(0.6); doc.line(M, y, M + 24, y);
    y += 6; doc.setLineWidth(0.2); doc.setTextColor(...C.ink);
  }
  function texto(t, tam, cor){
    const s = tam || 9;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(s); doc.setTextColor(...(cor || C.ink));
    const ls = doc.splitTextToSize(T(t), CW);
    const h = ls.length * s * 0.3528 * 1.25 + 2;
    garantir(h);
    doc.text(ls, M, y + 3);
    y += h;
  }
  function pares(lista){
    const colW = CW / 3;
    for (let i = 0; i < lista.length; i += 3){
      garantir(11);
      lista.slice(i, i + 3).forEach((p, j) => {
        const x = M + j * colW;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.mut);
        doc.text(T(p[0]), x, y);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink);
        doc.text(doc.splitTextToSize(T(String(p[1])), colW - 3)[0], x, y + 4.8);
      });
      y += 11;
    }
    y += 1;
  }
  // Tabela com quebra de linha nas células
  function tabela(cab, linhas, larg, alinha, opts){
    const o = opts || {};
    const fs = o.fs || 8.5, lh = fs * 0.3528 * 1.25, pad = 2;
    const ws = larg.map(f => f * CW);
    function linhaCab(){
      doc.setFillColor(...C.navy); doc.rect(M, y, CW, 7.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(fs); doc.setTextColor(...C.white);
      let x = M;
      cab.forEach((c, i) => { doc.text(T(c), alinha[i] === 'r' ? x + ws[i] - pad : x + pad, y + 5, {align: alinha[i] === 'r' ? 'right' : 'left'}); x += ws[i]; });
      y += 7.5;
    }
    garantir(7.5 + 8);
    linhaCab();
    linhas.forEach((ln, r) => {
      doc.setFont('helvetica', (o.negrito && o.negrito(r)) ? 'bold' : 'normal'); doc.setFontSize(fs);
      const partes = ln.map((c, i) => doc.splitTextToSize(T(String(c)), ws[i] - 2 * pad));
      const h = Math.max(...partes.map(p => p.length)) * lh + 2.6;
      if (y + h > BOTTOM){ novaPagina(); linhaCab(); doc.setFont('helvetica', (o.negrito && o.negrito(r)) ? 'bold' : 'normal'); doc.setFontSize(fs); }
      const dest = o.destaque && o.destaque(r);
      doc.setFillColor(...(dest ? C.goldSoft : (r % 2 ? C.zebra : C.white)));
      doc.rect(M, y, CW, h, 'F');
      doc.setTextColor(...C.ink);
      let x = M;
      partes.forEach((p, i) => { doc.text(p, alinha[i] === 'r' ? x + ws[i] - pad : x + pad, y + lh + 0.4, {align: alinha[i] === 'r' ? 'right' : 'left'}); x += ws[i]; });
      y += h;
    });
    doc.setDrawColor(...C.line); doc.line(M, y, W - M, y);
    y += 6;
  }
  function caixa(linhas){
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    const ls = linhas.flatMap(t => doc.splitTextToSize(T(t), CW - 10));
    const h = ls.length * 5 + 7;
    garantir(h + 4);
    doc.setFillColor(...C.goldSoft); doc.rect(M, y, CW, h, 'F');
    doc.setFillColor(...C.gold); doc.rect(M, y, 1.4, h, 'F');
    doc.setTextColor(...C.navy); doc.text(ls, M + 5, y + 6);
    doc.setTextColor(...C.ink);
    y += h + 6;
  }

  const suf = SUFIXO[e.meses];
  const ks = elegiveis(res);
  const melhor = res.regimes[res.ranking[0]];
  cabecalho();
  titulo('Dados informados');
  const atv = $('atividade').options[$('atividade').selectedIndex].text;
  pares([
    ['Atividade', atv], ['Anexo do Simples', res.anexo], ['CNAE principal', e.cnae ? mascaraCnae(e.cnae) : 'Não informado'],
    ['Faturamento mensal', fmtBRL.format(e.receita)], ['Lucro antes dos impostos', fmtPct(e.margem) + ' do faturamento'], ['Folha mensal', fmtBRL.format(e.folha)],
    ['Compras com crédito', fmtPct(e.compras) + ' do faturamento'], ['ICMS / ISS', fmtPct(e.icms) + ' / ' + fmtPct(e.iss)], ['Ano e período', res.ano + ', ' + NOME_PERIODO[e.meses].toLowerCase()],
    ['Sócios', e.distribuir ? e.socios.quantidade + ' (' + fmtPct(e.socios.percentual) + ' do lucro distribuído)' : 'Lucro mantido na empresa'], ['Pró-labore por sócio', fmtBRL.format(e.socios.proLabore)], ['CBS / IBS de referência', fmtPct(e.referencia.cbs) + ' / ' + fmtPct(e.referencia.ibs)]
  ]);

  const seg = res.ranking[1] ? res.regimes[res.ranking[1]] : null;
  caixa(['Melhor regime em ' + res.ano + ': ' + melhor.nome + '.',
    'Tributos de ' + fmtBRL.format(melhor.total) + ' ' + suf + ' (' + fmtPct(melhor.efetiva) + ' do faturamento)' + (seg ? '; sobra ' + fmtBRL.format(melhor.sobra - seg.sobra) + ' a mais que ' + seg.nome + '.' : '.')]);

  titulo('Resultado em ' + res.ano + ' (' + NOME_PERIODO[e.meses].toLowerCase() + ')');
  const cabR = ['Regime', 'Tributos', 'Carga', 'Sobra na empresa'].concat(e.distribuir ? ['Líquido aos sócios'] : []);
  const largR = e.distribuir ? [0.32, 0.17, 0.12, 0.19, 0.2] : [0.4, 0.2, 0.15, 0.25];
  tabela(cabR, ks.map(k => {
    const r = res.regimes[k];
    const l = [r.nome, fmtBRL.format(r.total), fmtPct(r.efetiva), fmtBRL.format(r.sobra)];
    if (e.distribuir) l.push(fmtBRL.format(r.distribuicao.liquidoSociosMes));
    return l;
  }), largR, ['l', 'r', 'r', 'r', 'r'], {destaque: r => ks[r] === res.ranking[0]});
  ORDEM.filter(k => !res.regimes[k].elegivel && k !== 'ret').forEach(k => texto(NOMES[k] + ': não se aplica (' + res.regimes[k].motivo + ').', 8.5, C.mut));

  titulo('Tributos por categoria');
  tabela(['Regime', 'Renda', 'Consumo', 'Folha', 'Total'], ks.map(k => {
    const c = Motor.regimes.porCategoria(res.regimes[k]);
    return [res.regimes[k].nome, fmtBRL.format(c.renda), fmtBRL.format(c.consumo), fmtBRL.format(c.folha), fmtBRL.format(res.regimes[k].total)];
  }), [0.36, 0.16, 0.16, 0.16, 0.16], ['l', 'r', 'r', 'r', 'r'], {destaque: r => ks[r] === res.ranking[0]});

  titulo('Projeção 2026 a 2033: tributos da empresa ' + suf);
  const colsP = ORDEM.filter(k => P.ANOS.some(a => todos[a].regimes[k].elegivel));
  const curtos = {simples: 'Simples (DAS)', simplesFora: 'Simples CBS/IBS fora', presumido: 'Presumido', real: 'Real', ret: 'RET'};
  const largP = [0.12].concat(colsP.map(() => 0.88 / colsP.length));
  tabela(['Ano'].concat(colsP.map(k => curtos[k])).concat([]), P.ANOS.map(a => [String(a)].concat(colsP.map(k => {
    const r = todos[a].regimes[k];
    if (!r.elegivel) return '-';
    return fmtBRL.format(r.total) + (todos[a].ranking[0] === k ? ' *' : '');
  }))), largP, ['l'].concat(colsP.map(() => 'r')), {destaque: r => P.ANOS[r] === res.ano});
  texto('* menor custo do ano. CBS/IBS de 2027 em diante com as alíquotas de referência informadas; IBS de 2029 a 2032 proporcional à referência.', 8, C.mut);

  if (e.distribuir){
    titulo('Lucro levado aos sócios (' + suf + ')');
    tabela(['Regime', 'Dividendos', 'IR retido', 'IR no ano (IRPFM)', 'Líquido aos sócios'], ks.map(k => {
      const d = res.regimes[k].distribuicao;
      return [res.regimes[k].nome, fmtBRL.format(d.distribuidoMes), fmtBRL.format(d.retidoMes), fmtBRL.format(d.irpfmMes), fmtBRL.format(d.liquidoSociosMes)];
    }), [0.3, 0.18, 0.15, 0.18, 0.19], ['l', 'r', 'r', 'r', 'r']);
    texto('Retenção de 10% sobre dividendos acima de R$ 50 mil por mês, por sócio (Lei 9.250/1995, art. 6º-A). O retido é antecipação da tributação mínima (art. 16-A) e é ajustado na declaração; o redutor do art. 16-B limita a carga empresa + sócio a 34%.', 8, C.mut);
  }

  titulo('Leituras do resultado');
  Motor.insights.gerar(res, e).forEach(i => texto('• ' + i.texto, 9));

  if (res.ano >= 2027 && res.comprador.linhas.length){
    titulo('Crédito de CBS/IBS do cliente');
    tabela(['Se a empresa estiver no', 'Cliente paga', 'Crédito', 'Custo do cliente'], res.comprador.linhas.map(l => [l.nome, fmtBRL.format(l.pago), fmtBRL.format(l.credito), fmtBRL.format(l.liquido)]),
      [0.4, 0.2, 0.2, 0.2], ['l', 'r', 'r', 'r']);
  }

  titulo('Memória de cálculo (' + NOME_PERIODO[e.meses].toLowerCase() + ', ' + res.ano + ')');
  ks.forEach(k => {
    const r = res.regimes[k];
    texto(r.nome, 10, C.navy);
    const ls = r.memoria.map(l => [l.etapa.trim(), l.formula, valorMemoria(l), l.fundamento]);
    ls.push(['Total de tributos', '', fmtBRL.format(r.total), '']);
    tabela(['Etapa', 'Fórmula', 'Valor', 'Fundamento'], ls, [0.25, 0.33, 0.15, 0.27], ['l', 'l', 'r', 'l'], {fs: 7.5, negrito: i => i === ls.length - 1});
  });

  titulo('Premissas e pontos a confirmar');
  document.querySelectorAll('.limits li').forEach(li => texto('• ' + li.textContent, 8.5));

  const n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++){
    doc.setPage(i);
    doc.setDrawColor(...C.line); doc.line(M, 282, W - M, 282);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.mut);
    doc.text(T('Estimativa com a legislação vigente em ' + hoje + '. Confirme com o contador responsável.'), M, 287);
    doc.text('Página ' + i + ' de ' + n, W - M, 287, {align: 'right'});
  }
  return doc.output('arraybuffer');
}
$('btn-pdf').addEventListener('click', () => {
  try {
    const blob = new Blob([gerarPdfBytes()], {type: 'application/pdf'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivoPdf();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    msg('PDF gerado.', 'ok');
  } catch (err){
    msg('Não foi possível gerar o PDF: ' + err.message, 'bad');
  }
});

/* ===== Início ===== */
(function iniciar(){
  const compartilhado = lerLinkCompartilhado();
  const rascunho = window.Armazenamento.lerRascunho();
  const intro = $('intro'), app = $('app');
  function abrirApp(){ intro.hidden = true; app.hidden = false; }
  if (compartilhado){
    aplicarCampos(compartilhado);
    abrirApp();
    irPara(5);
    msg('Simulação aberta por link compartilhado.', 'ok');
  } else {
    if (rascunho && rascunho.dados){
      aplicarCampos(rascunho.dados);
      const q = new Date(rascunho.quando);
      $('rascunho').textContent = 'Rascunho de ' + q.toLocaleDateString('pt-BR') + ' às ' + q.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) + ' recuperado';
    }
    irPara(rascunho && rascunho.dados ? (rascunho.dados.passo || 1) : 1);
    $('btn-entrar').addEventListener('click', () => {
      intro.classList.add('saindo');
      setTimeout(() => { abrirApp(); window.scrollTo(0, 0); focarEtapa(); }, 450);
    });
  }
  renderHistorico();
  atualizar();
})();
