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
// Períodos: o resultado mensal é multiplicado pelo número de meses
const PERIODOS = {1:{nome:'Mensal', sufixo:'por mês'}, 2:{nome:'Bimestral', sufixo:'por bimestre'}, 6:{nome:'Semestral', sufixo:'por semestre'}, 12:{nome:'Anual', sufixo:'por ano'}};
function periodoInfo(n){ return PERIODOS[n] || PERIODOS[1]; }
const FATOR_R_MINIMO = 0.28;
const LIMITE_SIMPLES = 4800000;
const NOMES = {simples:'Simples Nacional', hibrido:'Simples híbrido (ICMS fora do DAS)', presumido:'Lucro Presumido', real:'Lucro Real', ret:'RET (incorporação)'};
// Regras por atividade: tabela do Simples (null = vedado), ISS e presunção de IRPJ/CSLL no Presumido
const ATIVIDADES = {
  comercio:         {tabela:'comercio',  iss:false, pIR:0.08, pCS:0.12, anexo:'Anexo I'},
  industria:        {tabela:'industria', iss:false, pIR:0.08, pCS:0.12, anexo:'Anexo II'},
  servicos:         {tabela:'servicos',  iss:true,  pIR:0.32, pCS:0.32, anexo:'Anexo III'},
  servicos4:        {tabela:'servicos4', iss:true,  pIR:0.32, pCS:0.32, anexo:'Anexo IV'},
  servicos5:        {tabela:'servicos5', iss:true,  pIR:0.32, pCS:0.32, anexo:'Anexo V'},
  construcao_total: {tabela:'servicos4', iss:true,  pIR:0.08, pCS:0.12, anexo:'Anexo IV'},
  construcao_mo:    {tabela:'servicos4', iss:true,  pIR:0.32, pCS:0.32, anexo:'Anexo IV'},
  locacao:          {tabela:null, iss:false, pIR:0.32, pCS:0.32, anexo:'Não pode optar pelo Simples', vedacao:'locação de imóveis próprios é vedada (LC 123, art. 17, XV)'},
  holding:          {tabela:null, iss:true,  pIR:0.32, pCS:0.32, anexo:'Não pode optar pelo Simples', vedacao:'empresa que participa do capital de outra é vedada (LC 123, art. 3º, § 4º, VII)'},
  incorporacao:     {tabela:null, iss:false, pIR:0.08, pCS:0.12, anexo:'Não pode optar pelo Simples', vedacao:'loteamento e incorporação são vedados (LC 123, art. 17, XIV)', ret:true}
};
// RET da incorporação (Lei 10.931/2004, arts. 4º e 8º): 4% = IRPJ 1,26% + CSLL 0,66% + PIS 0,37% + COFINS 1,71%
const RET = {irpj:0.0126, csll:0.0066, pis:0.0037, cofins:0.0171};
// Cenário 2027: fatia de CBS + IBS dentro do DAS, por anexo e faixa (assume a fatia de PIS + COFINS de hoje)
const CBS_IBS_DAS = {
  comercio:  [15.50, 15.50, 15.50, 15.50, 15.50, 34.40],
  industria: [14.00, 14.00, 14.00, 14.00, 14.00, 25.50],
  servicos:  [15.60, 17.10, 16.60, 16.60, 15.60, 19.50],
  servicos4: [21.50, 25.00, 24.00, 23.00, 22.00, 25.00],
  servicos5: [17.15, 17.15, 18.15, 19.15, 17.15, 20.00]
};
// Comprador que toma crédito de IBS/CBS: regime regular (Real, Presumido ou Simples que optou pelo regime regular)
const COMPRADOR_TOMA_CREDITO = ['pj_real', 'pj_presumido', 'pj_simples_regular'];
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
  const cfg = ATIVIDADES[p.atividade] || ATIVIDADES.comercio;
  const cpp = CPP_PATRONAL * (p.folha || 0);
  // Fator R: serviços do Anexo V passam ao Anexo III se folha/receita >= 28%
  let ativ = cfg.tabela;
  let fatorR = null;
  // Fator R só vale para atividades da lista do Anexo V (marcadas pelo usuário)
  if (ativ === 'servicos5' && p.fatorR){
    fatorR = R > 0 ? (p.folha || 0) / R : 0;
    ativ = fatorR >= FATOR_R_MINIMO ? 'servicos' : 'servicos5';
  }
  const anexoBase = cfg.anexo;
  const anexo = (p.atividade === 'servicos5' && ativ === 'servicos')
    ? 'Anexo III (Fator R ' + Math.round(fatorR * 100) + '%)' : anexoBase;
  const antes = R * p.margem;
  const icmsRate = isCom ? p.icms : 0;
  const icmsDebito = R * icmsRate;
  const comprasCred = R * p.compras;
  const icmsCredito = comprasCred * icmsRate;
  const icmsNormal = Math.max(0, icmsDebito - icmsCredito);
  const issR = cfg.iss ? p.iss * R : 0;
  const out = {};

  const rbt12 = R * 12;
  const aliq = ativ ? simplesEfetiva(rbt12, ativ) : null;
  const faixa = ativ ? faixaDe(rbt12, ativ) : null;
  if (aliq === null){
    const motivoS = ativ ? 'Faturamento acima de R$ 4,8 mi por ano' : cfg.vedacao;
    out.simples = {elegivel:false, motivo: motivoS};
    out.hibrido = {elegivel:false, motivo: motivoS};
  } else {
    const icmsFora6 = isCom && faixa.icms === 0 ? icmsNormal : 0;
    // Anexo IV: a CPP fica fora do DAS e é paga pela folha
    const cppS = ativ === 'servicos4' ? cpp : 0;
    const impS = R * aliq + icmsFora6 + cppS;
    out.simples = {elegivel:true, imposto: impS, efetiva: R>0 ? impS/R : aliq, liquido: antes - impS};
    if (!isCom){
      out.hibrido = {elegivel:false, motivo:'Híbrido só se aplica a comércio e indústria'};
    } else {
      const dasSemIcms = R * aliq * (1 - faixa.icms);
      const icmsHibrido = p.credHibrido ? icmsNormal : icmsDebito;
      const impH = dasSemIcms + icmsHibrido;
      out.hibrido = {elegivel:true, imposto: impH, efetiva: R>0 ? impH/R : 0, liquido: antes - impH};
    }
  }

  const baseP = R * cfg.pIR;
  const irpjP = 0.15*baseP + 0.10*Math.max(0, baseP - 20000);
  const baseCsllP = R * cfg.pCS;
  const csllP = 0.09*baseCsllP;
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
  // RET: só incorporação com patrimônio de afetação; a CPP sobre a folha continua à parte
  const impRet = (RET.irpj + RET.csll + RET.pis + RET.cofins) * R + cpp;
  out.ret = cfg.ret
    ? {elegivel:true, imposto: impRet, efetiva: R>0 ? impRet/R : 0, liquido: antes - impRet}
    : {elegivel:false, motivo:'Só para incorporação com patrimônio de afetação'};
  // Comprador e crédito de IBS/CBS (cenário 2027): mesmo preço final cobrado (faturamento informado)
  const t27 = (p.cbs27 || 0) + (p.ibs27 || 0);
  const tomaCredito = COMPRADOR_TOMA_CREDITO.includes(p.comprador);
  const linhasC = [];
  const destacado = t27 > 0 ? R * t27 / (1 + t27) : 0;
  if (aliq !== null){
    const idx = SIMPLES[ativ].indexOf(faixa);
    const fatia = (CBS_IBS_DAS[ativ] ? CBS_IBS_DAS[ativ][idx] : 0) / 100;
    const credDas = tomaCredito ? R * aliq * fatia : 0;
    linhasC.push({nome:'Fornecedor no Simples, IBS/CBS no DAS', curto:'Simples (IBS/CBS no DAS)', pago:R, credito:credDas, liquido:R - credDas,
      nota:'Crédito limitado ao IBS/CBS pago no DAS: ' + (aliq*fatia*100).toLocaleString('pt-BR', {maximumFractionDigits:2}) + '% do valor'});
    linhasC.push({nome:'Fornecedor no Simples híbrido da reforma (IBS/CBS fora do DAS)', curto:'Simples híbrido da reforma', pago:R, credito: tomaCredito ? destacado : 0, liquido:R - (tomaCredito ? destacado : 0),
      nota:'IBS/CBS destacado pelo regime regular'});
  }
  linhasC.push({nome:'Fornecedor no Lucro Presumido ou Real', curto:'Lucro Presumido ou Real', pago:R, credito: tomaCredito ? destacado : 0, liquido:R - (tomaCredito ? destacado : 0),
    nota:'IBS/CBS destacado pelo regime regular'});
  out.comprador = {linhas: linhasC, tomaCredito, destacado};
  // Memória de cálculo mensal, linha a linha (Presumido e Real)
  const pctTxt = v => (v*100).toLocaleString('pt-BR', {maximumFractionDigits:2}) + '%';
  const brl = v => v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
  const lin = (t, base, aliq, valor, nota) => ({t, base, aliq, valor, nota});
  const baseRealPC = Math.max(0, baseTrib - comprasCred);
  const linhasP = [
    lin('Lucro antes dos impostos', antes, '', null, 'Entrada da tela'),
    lin('IRPJ (parcela de 15%)', baseP, '15%', 0.15*baseP, 'Base = receita × presunção de ' + pctTxt(cfg.pIR)),
    lin('IRPJ adicional', Math.max(0, baseP-20000), '10%', 0.10*Math.max(0, baseP-20000), 'Só sobre a parte da base acima de R$ 20.000 no mês'),
    lin('CSLL', baseCsllP, '9%', csllP, 'Base = receita × presunção de ' + pctTxt(cfg.pCS)),
    lin('PIS', baseTrib, '0,65%', 0.0065*baseTrib, 'Base = receita − ICMS destacado'),
    lin('COFINS', baseTrib, '3%', 0.03*baseTrib, 'Base = receita − ICMS destacado'),
  ];
  if (cfg.iss) linhasP.push(lin('ISS', R, pctTxt(p.iss), issR, 'Alíquota municipal × receita'));
  if (isCom) linhasP.push(lin('ICMS a recolher', icmsDebito, pctTxt(icmsRate), icmsNormal, 'Débito ' + brl(icmsDebito) + ' − crédito ' + brl(icmsCredito)));
  linhasP.push(lin('CPP patronal 20%', p.folha || 0, '20%', cpp, 'Custo sobre a folha, fora do DAS'));
  const linhasR = [
    lin('Lucro antes dos impostos', antes, '', null, 'Entrada da tela'),
    lin('PIS', baseRealPC, '1,65%', 0.0165*baseRealPC, 'Base = receita − ICMS − compras com crédito'),
    lin('COFINS', baseRealPC, '7,6%', 0.076*baseRealPC, 'Mesma base do PIS'),
  ];
  if (cfg.iss) linhasR.push(lin('ISS', R, pctTxt(p.iss), issR, 'Alíquota municipal × receita'));
  linhasR.push(lin('CPP patronal 20%', p.folha || 0, '20%', cpp, 'Custo sobre a folha, dedutível no lucro real'));
  linhasR.push(lin('Lucro tributável (base de IRPJ e CSLL)', lucroTrib, '', null, 'Lucro antes dos impostos − CPP − PIS − COFINS − ISS'));
  linhasR.push(lin('IRPJ (parcela de 15%)', Math.max(0, lucroTrib), '15%', lucroTrib > 0 ? 0.15*lucroTrib : 0, 'Sobre o lucro tributável positivo'));
  linhasR.push(lin('IRPJ adicional', Math.max(0, lucroTrib-20000), '10%', lucroTrib > 0 ? 0.10*Math.max(0, lucroTrib-20000) : 0, 'Acima de R$ 20.000 no mês'));
  linhasR.push(lin('CSLL', Math.max(0, lucroTrib), '9%', csllR, 'Sobre o lucro tributável positivo'));
  if (isCom) linhasR.push(lin('ICMS a recolher', icmsDebito, pctTxt(icmsRate), icmsNormal, 'Débito ' + brl(icmsDebito) + ' − crédito ' + brl(icmsCredito)));
  // Memória de cálculo mensal: Simples Nacional e híbrido
  let memoS = null, memoH = null;
  if (aliq !== null){
    const cppSm = ativ === 'servicos4' ? cpp : 0;
    const icmsF6 = isCom && faixa.icms === 0 ? icmsNormal : 0;
    const linhasS = [
      lin('Receita dos últimos 12 meses (RBT12)', rbt12, '', null, 'Mensal × 12. Define a faixa da tabela'),
      lin('RBT12 × alíquota nominal', rbt12*faixa.aliq, pctTxt(faixa.aliq), null, 'Alíquota nominal da faixa sobre a receita de 12 meses'),
      lin('(−) Parcela a deduzir', faixa.ded, '', null, 'Valor fixo da faixa na tabela do anexo'),
      lin('(=) Imposto anual da faixa', rbt12*faixa.aliq - faixa.ded, '', null, '÷ RBT12 = alíquota efetiva de ' + pctTxt(aliq)),
      lin('DAS do mês (alíquota efetiva)', R, pctTxt(aliq), R*aliq, 'Faturamento do mês × alíquota efetiva. Já inclui os tributos do DAS'),
    ];
    if (isCom && faixa.icms === 0) linhasS.push(lin('ICMS fora do DAS (6ª faixa)', icmsDebito, pctTxt(icmsRate), icmsF6, 'Débito − crédito, pelo regime normal de ICMS'));
    if (cppSm) linhasS.push(lin('CPP patronal 20% (Anexo IV)', p.folha || 0, '20%', cppSm, 'Paga pela folha, fora do DAS'));
    memoS = {linhas: linhasS, total: R*aliq + icmsF6 + cppSm};
    if (isCom){
      const dasSemIcms = R*aliq*(1 - faixa.icms);
      const icmsH = p.credHibrido ? icmsNormal : icmsDebito;
      const notaH = p.credHibrido ? 'Débito − crédito: ' + brl(icmsDebito) + ' − ' + brl(icmsCredito) : 'Sem crédito: débito integral de ' + brl(icmsDebito);
      memoH = {linhas: [
        lin('DAS sem a parcela do ICMS', R, pctTxt(aliq), dasSemIcms, 'DAS × (1 − partilha do ICMS de ' + pctTxt(faixa.icms) + ')'),
        lin('ICMS pelo regime normal', icmsDebito, pctTxt(icmsRate), icmsH, notaH),
      ], total: dasSemIcms + icmsH};
    }
  }
  const memoRet = cfg.ret ? {linhas: [
    lin('IRPJ (RET)', R, '1,26%', RET.irpj*R, 'Pagamento unificado sobre a receita recebida'),
    lin('CSLL (RET)', R, '0,66%', RET.csll*R, 'Pagamento unificado sobre a receita recebida'),
    lin('PIS (RET)', R, '0,37%', RET.pis*R, 'Pagamento unificado sobre a receita recebida'),
    lin('COFINS (RET)', R, '1,71%', RET.cofins*R, 'Pagamento unificado sobre a receita recebida'),
    lin('CPP patronal 20%', p.folha || 0, '20%', cpp, 'Não faz parte do RET'),
  ], total: impRet} : null;
  out.memoria = {simples: memoS, hibrido: memoH, presumido: {linhas: linhasP, total: impP}, real: {linhas: linhasR, total: impR}, ret: memoRet};
  out.anexo = anexo;
  // Escala impostos e sobra para o período (a alíquota efetiva continua mensal)
  const meses = p.periodo || 1;
  for (const k of ['simples','hibrido','presumido','real','ret']){
    if (out[k] && out[k].elegivel){ out[k].imposto *= meses; out[k].liquido *= meses; }
  }
  for (const l of out.comprador.linhas){ l.pago *= meses; l.credito *= meses; l.liquido *= meses; }
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
  $('cnae').value = '';
  aplicarCnae();
  $('icms').value = '0';
  $('iss').value = '0';
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
  $('atividade').disabled = travar;
  $('linha-trava').hidden = !travar;
  atualizarFatorR();
}
$('btn-destravar').addEventListener('click', () => { travarEnquadramento(false); $('atividade').focus(); });
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

/* ===== Entradas ===== */
function entradas(){
  return {
    receita: parseBRL($('receita').value),
    cnae: ($('cnae').value || '').replace(/\D/g, ''),
    atividade: $('atividade').value,
    folha: parseBRL($('folha').value),
    periodo: parseInt($('periodo').value, 10) || 1,
    comprador: $('comprador').value,
    cbs27: num('cbs27') / 100,
    ibs27: num('ibs27') / 100,
    fatorR: $('fatorr').checked,
    semCompras: $('semcompras').checked,
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
// Comércio e indústria precisam de compras com crédito (ou confirmação de que não há)
function faltaCompras(p){
  return (p.atividade === 'comercio' || p.atividade === 'industria') && p.receita > 0 && p.compras === 0 && !p.semCompras;
}
function renderMemoria(res){
  const box = $('memoria');
  const bloco = (nome, k) => {
    if (!res[k].elegivel) return '';
    const m = res.memoria[k];
    const val = v => (v === null || v === undefined) ? '—' : fmtBRL.format(v);
    const linhas = m.linhas.map(l => `<tr><td>${l.t}</td><td>${val(l.base)}</td><td>${l.aliq || '—'}</td><td>${val(l.valor)}</td><td class="nota">${l.nota || ''}</td></tr>`).join('');
    return `<h3>${nome} (mensal)</h3><div class="tablewrap"><table><thead><tr><th>Tributo</th><th>Base</th><th>Alíquota</th><th>Valor</th><th>Como foi calculado</th></tr></thead><tbody>${linhas}<tr class="total"><td>Total</td><td></td><td></td><td>${fmtBRL.format(m.total)}</td><td></td></tr></tbody></table></div>`;
  };
  box.innerHTML = bloco('Simples Nacional', 'simples') + bloco('Simples híbrido (ICMS fora do DAS)', 'hibrido') + bloco('Lucro Presumido', 'presumido') + bloco('Lucro Real', 'real') + bloco('RET (incorporação)', 'ret');
}
function renderRegimes(){
  const p = entradas();
  const res = calcRegimes(p);
  renderMemoria(res);
  const rank = ranking(res);
  $('alerta-compras').hidden = !faltaCompras(p);
  const banner = $('banner');
  if (rank.length === 0 || p.receita === 0){
    banner.className = 'banner none';
    banner.innerHTML = '<strong>Informe o faturamento</strong><span>Digite um valor acima de zero para comparar os regimes.</span>';
  } else {
    let txt = '';
    if (rank.length > 1){
      const dif = res[rank[0]].liquido - res[rank[1]].liquido;
      txt = `Sobra ${fmtBRL.format(dif)} ${periodoInfo(p.periodo).sufixo} a mais do que o ${NOMES[rank[1]]}.`;
    }
    banner.className = 'banner';
    banner.innerHTML = `<span>Melhor regime para este faturamento</span><strong>${NOMES[rank[0]]}</strong><span>${txt}</span>`;
  }
  $('tbl-regimes').innerHTML = ['simples','hibrido','presumido','real','ret'].filter(k => k !== 'ret' || res.ret.elegivel).map(k => {
    const r = res[k];
    if (!r.elegivel) return `<tr><td>${NOMES[k]}</td><td class="na" colspan="3">Não se aplica: ${r.motivo}</td></tr>`;
    if (p.receita === 0) return `<tr><td>${NOMES[k]}</td><td data-label="Impostos">—</td><td data-label="Alíquota efetiva">—</td><td data-label="Sobra após impostos">—</td></tr>`;
    const best = rank[0] === k;
    return `<tr class="${best ? 'best' : ''}">
      <td>${NOMES[k]}${best ? '<span class="tag">melhor</span>' : ''}</td>
      <td data-label="Impostos">${fmtBRL.format(r.imposto)}</td>
      <td data-label="Alíquota efetiva">${fmtPct(r.efetiva)}</td>
      <td data-label="Sobra após impostos">${fmtBRL.format(r.liquido)}</td></tr>`;
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
const NOMES_COMPRADOR = {pf:'Pessoa física (consumidor final)', pj_real:'PJ no Lucro Real', pj_presumido:'PJ no Lucro Presumido', pj_simples:'PJ no Simples (recolhe no DAS)', pj_simples_regular:'PJ no Simples com IBS/CBS no regime regular'};
function renderComprador(){
  const p = entradas();
  const res = calcRegimes(p);
  const c = res.comprador;
  const corpo = $('tbl-comprador');
  const resumo = $('comprador-resumo');
  if (p.receita === 0){
    corpo.innerHTML = c.linhas.map(l => `<tr><td>${l.nome}</td><td>—</td><td>—</td><td>—</td></tr>`).join('');
    resumo.textContent = 'Informe o faturamento para ver o custo do comprador.';
    return;
  }
  const menor = Math.min(...c.linhas.map(l => l.liquido));
  corpo.innerHTML = c.linhas.map(l => `<tr class="${c.tomaCredito && l.liquido === menor ? 'best' : ''}"><td>${l.nome}<div class="hint">${l.nota}</div></td><td>${fmtBRL.format(l.pago)}</td><td>${fmtBRL.format(l.credito)}</td><td>${fmtBRL.format(l.liquido)}</td></tr>`).join('');
  if (!c.tomaCredito){
    resumo.textContent = NOMES_COMPRADOR[p.comprador] + ' não aproveita crédito de IBS/CBS: o imposto é custo final, qualquer que seja o regime do fornecedor.';
  } else if (c.linhas.length > 1){
    const dif = c.linhas[0].liquido - c.linhas[1].liquido;
    resumo.textContent = 'Pelo mesmo preço, ' + NOMES_COMPRADOR[p.comprador] + ' paga ' + fmtBRL.format(dif) + ' ' + periodoInfo(p.periodo).sufixo + ' a mais, em custo líquido, comprando de fornecedor no DAS do que de fornecedor com IBS/CBS fora do DAS.';
  } else {
    resumo.textContent = 'Esta atividade não pode optar pelo Simples; o comprador toma crédito integral do IBS/CBS destacado.';
  }
}
// O Fator R só aparece e só pode ser marcado quando a atividade é do Anexo V
function atualizarFatorR(){
  const at = $('atividade').value;
  const anexoV = at === 'servicos5';
  $('linha-fatorr').hidden = !anexoV;
  $('fatorr').disabled = !anexoV || (typeof enquadramentoTravado !== 'undefined' && enquadramentoTravado);
  if (!anexoV) $('fatorr').checked = false;
  // Mostra só os campos que valem para a atividade
  const com = at === 'comercio' || at === 'industria';
  const iss = !!(ATIVIDADES[at] && ATIVIDADES[at].iss);
  document.querySelectorAll('.so-com').forEach(el => { el.hidden = !com; });
  document.querySelectorAll('.so-iss').forEach(el => { el.hidden = !iss; });
}
function atualizar(){ atualizarFatorR(); renderRegimes(); renderFaixas(); renderComprador(); }
['receita','folha','margem','compras','icms','iss','cbs27','ibs27'].forEach(id => $(id).addEventListener('input', atualizar));
['atividade','credhib','fatorr','semcompras','periodo','comprador'].forEach(id => $(id).addEventListener('change', atualizar));

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
    ['CNAE principal', p.cnae ? mascaraCnae(p.cnae) : 'Não informado'],
    ['Período do resultado', periodoInfo(p.periodo).nome],
    ['Atividade', ({comercio:'Comércio', industria:'Indústria', servicos:'Serviços (Anexo III)', servicos4:'Limpeza, vigilância, obras e paisagismo (Anexo IV)', servicos5:'Serviços do Anexo V', construcao_total:'Construção civil: empreitada total com materiais', construcao_mo:'Construção civil: mão de obra ou materiais parciais', locacao:'Locação de imóveis próprios', holding:'Holding de participações', incorporacao:'Incorporação e loteamento'})[p.atividade]],
    ['Anexo do Simples', res.anexo],
    ['Folha de pagamento mensal', fmtBRL.format(p.folha || 0)],
    ['Fator R aplicável (lista do Anexo V)', p.atividade === 'servicos5' ? (p.fatorR ? 'Sim' : 'Não') : '—'],
    ['Lucro antes dos impostos', fmtPct(p.margem) + ' do faturamento'],
    ['Compras com crédito', fmtPct(p.compras) + ' do faturamento'],
    ['ICMS (São Paulo)', fmtPct(p.icms)],
    ['ISS (Guarulhos)', fmtPct(p.iss)],
    ['Crédito de ICMS no híbrido', p.credHibrido ? 'Sim' : 'Não'],
  ]);

  titulo('Resultado: ' + periodoInfo(p.periodo).nome);
  const chaves = ['simples','hibrido','presumido','real'].concat(res.ret.elegivel ? ['ret'] : []);
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
      linhasBox.push('Sobra ' + fmtBRL.format(dif) + ' ' + periodoInfo(p.periodo).sufixo + ' a mais do que o ' + NOMES[rank[1]] + '.');
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

  titulo('Comprador e crédito de IBS/CBS (cenário 2027)');
  texto('Comprador: ' + NOMES_COMPRADOR[p.comprador] + '. CBS ' + fmtPct(p.cbs27) + ' e IBS ' + fmtPct(p.ibs27) + '. Mesmo preço final cobrado em todos os casos.');
  tabela(['Fornecedor','Valor pago','Crédito','Custo líquido'],
         res.comprador.linhas.map(l => [l.curto, fmtBRL.format(l.pago), fmtBRL.format(l.credito), fmtBRL.format(l.liquido)]),
         [CW*0.40, CW*0.20, CW*0.20, CW*0.20], ['l','r','r','r'], -1);
  titulo('Premissas e limites');
  texto('Regras de 2026. Simples Nacional: tabela do Anexo I (comércio), II (indústria) ou III (serviços), pela faixa de faturamento dos últimos 12 meses. Simples híbrido: ICMS fora do DAS, com a partilha do Anexo I (34% nas faixas 1 e 2, 33,5% nas faixas 3 a 5, zero na faixa 6). Lucro Presumido e Lucro Real: IRPJ, CSLL, PIS, COFINS e ICMS. Simples híbrido aplicável a comércio e indústria, até R$ 4,8 milhões por ano.');
  texto('Simplificações: o ICMS é calculado sobre o faturamento como se já estivesse no preço, e a base de PIS e COFINS desconta esse ICMS. Não considera substituição tributária, DIFAL, compensação de prejuízo fiscal, RAT, contribuições a terceiros nem regimes específicos de ICMS. Presunção: comércio e indústria, 8% para IRPJ e 12% para CSLL; serviços, 32% para ambos. Algumas atividades têm presunção diferente e não estão modeladas. PIS e COFINS no Lucro Real são uma apuração simplificada, com crédito sobre as compras informadas.');
  texto('Imobiliário, locação, holding e construção: locação de imóveis próprios, holding de participações e incorporação/loteamento não podem optar pelo Simples (LC 123). Construção usa o Anexo IV; no Presumido, empreitada total com materiais usa 8% (IRPJ) e 12% (CSLL), e os demais casos 32%. Locação e holding usam 32%; incorporação, 8% e 12%. RET de 4% só para incorporação com patrimônio de afetação. Dividendos recebidos pela holding não entram no cálculo. Desoneração da folha e regras cumulativas específicas de PIS/COFINS no Real não estão modeladas.');
  texto('Cenário 2027 (comprador): alíquota da CBS de 2027 ainda não definida (Senado até 15/12/2026); o valor usado é editável. Comprador PF ou no Simples recolhendo no DAS não toma crédito. Comprador do regime regular toma crédito integral do IBS/CBS destacado, ou só do IBS/CBS pago no DAS quando o fornecedor está no DAS (LC 214/2025, art. 47, § 9º). A fatia de IBS/CBS no DAS assume a fatia atual de PIS e COFINS de cada faixa.');
  texto('Períodos: impostos e sobra são o resultado mensal multiplicado pelos meses do período, supondo faturamento, margem e compras iguais em todos os meses. A alíquota efetiva é a do mês.');
  texto('Fator R: só se aplica a atividades da lista do Anexo V, marcadas na tela. Folha dos últimos 12 meses dividida pela receita dos últimos 12 meses, com 28% como limite. Esta análise usa a folha do mês como aproximação da média de 12 meses.');
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
  if (faltaCompras(entradas())){
    msg.className = 'status bad';
    msg.textContent = 'Informe as compras com crédito, ou marque que não há, antes de gerar o PDF.';
    return;
  }
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
  $('fatorr').checked = false;
  $('semcompras').checked = false;
  $('periodo').value = '1';
  $('comprador').value = 'pf';
  $('credhib').value = 'sim';
  atualizar();
}
$('btn-limpar').addEventListener('click', limparConsulta);

atualizar();
