/* Motor da Calculadora de Regimes — Controller & Oraculu's
 * Parâmetros conferidos em 05/11/2026. Valores mensais; o resultado anual é ×12.
 * Sem DOM: roda no navegador e no Node (testes). */
(function (raiz) {
  'use strict';

  const PARAM = {
    versao: '2026-11-05',
    limiteSimples: 4800000,
    fatorR: 0.28,
    // Faixas: [teto RBT12, alíquota nominal, parcela a deduzir] — LC 123/2006, Anexos I a V
    // pc = % do DAS que é PIS+COFINS (vira CBS/IBS em 2027); loc = % do DAS que é ICMS/ISS
    anexos: {
      I:   {nome: 'Anexo I', faixas: [[180000,.04,0],[360000,.073,5940],[720000,.095,13860],[1800000,.107,22500],[3600000,.143,87300],[4800000,.19,378000]],
            pc: [15.5,15.5,15.5,15.5,15.5,34.4], loc: [34,34,33.5,33.5,33.5,0], cppNoDas: true},
      II:  {nome: 'Anexo II', faixas: [[180000,.045,0],[360000,.078,5940],[720000,.10,13860],[1800000,.112,22500],[3600000,.147,85500],[4800000,.30,720000]],
            pc: [14,14,14,14,14,25.5], loc: [32,32,32,32,32,0], cppNoDas: true},
      III: {nome: 'Anexo III', faixas: [[180000,.06,0],[360000,.112,9360],[720000,.135,17640],[1800000,.16,35640],[3600000,.21,125640],[4800000,.33,648000]],
            pc: [15.6,17.1,16.6,16.6,15.6,19.5], loc: [33.5,32,32.5,32.5,33.5,0], cppNoDas: true},
      IV:  {nome: 'Anexo IV', faixas: [[180000,.045,0],[360000,.09,8100],[720000,.102,12420],[1800000,.14,39780],[3600000,.22,183780],[4800000,.33,828000]],
            pc: [21.5,25,24,23,22,25], loc: [44.5,40,40,40,40,0], cppNoDas: false},
      V:   {nome: 'Anexo V', faixas: [[180000,.155,0],[360000,.18,4500],[720000,.195,9900],[1800000,.205,17100],[3600000,.23,62100],[4800000,.305,540000]],
            pc: [17.15,17.15,18.15,19.15,17.15,20], loc: [14,17,19,21,23.5,0], cppNoDas: true}
    },
    // Atividades: anexo do Simples, tributo local e presunção do Presumido (Lei 9.249/1995, arts. 15 e 20)
    atividades: {
      comercio:   {nome: 'Comércio', anexo: 'I', local: 'ICMS', pIR: .08, pCS: .12},
      industria:  {nome: 'Indústria', anexo: 'II', local: 'ICMS', pIR: .08, pCS: .12},
      servicos3:  {nome: 'Serviços — Anexo III', anexo: 'III', local: 'ISS', pIR: .32, pCS: .32},
      servicos4:  {nome: 'Serviços — Anexo IV (limpeza, vigilância, obras, advocacia)', anexo: 'IV', local: 'ISS', pIR: .32, pCS: .32},
      servicos5:  {nome: 'Serviços — Anexo V (sujeito ao Fator R)', anexo: 'V', local: 'ISS', pIR: .32, pCS: .32, fatorR: true},
      construcao: {nome: 'Construção com fornecimento de material', anexo: 'IV', local: 'ISS', pIR: .08, pCS: .12},
      locacao:    {nome: 'Locação de imóveis próprios (vedada ao Simples)', anexo: null, local: '—', pIR: .32, pCS: .32, vedacao: 'Locação de imóveis próprios é vedada ao Simples (LC 123/2006, art. 17, XV).'},
      holding:    {nome: 'Holding / participação em outras empresas (vedada ao Simples)', anexo: null, local: '—', pIR: .32, pCS: .32, vedacao: 'Sociedade que participa do capital de outra é vedada ao Simples (LC 123/2006, art. 3º, parágrafo 4º, VII).'},
      incorporacao: {nome: 'Incorporação / loteamento (vedada ao Simples)', anexo: null, local: '—', pIR: .08, pCS: .12, vedacao: 'Incorporação e loteamento são vedados ao Simples (LC 123/2006, art. 17, XIV).'},
      vedado:     {nome: 'Outra atividade vedada ao Simples', anexo: null, local: 'ISS', pIR: .32, pCS: .32, vedacao: 'Atividade vedada ao Simples Nacional (LC 123/2006, art. 17).'}
    },
    irpj: {aliq: .15, adicional: .10, limiteMes: 20000},
    csll: .09,
    pisCofinsCumul: .0365,
    pisCofinsNaoCumul: .0925,
    cpp: .20,
    lc224: {limiteAno: 5000000, acrescimo: .10},
    dividendos: {limiteMes: 50000, aliq: .10},
    // ICMS/ISS remanescentes: EC 132/2023, ADCT, arts. 128 e 129
    fatorLocal: {2026: 1, 2027: 1, 2028: 1, 2029: .9, 2030: .8, 2031: .7, 2032: .6, 2033: 0},
    fracaoIbs: {2029: .1, 2030: .2, 2031: .3, 2032: .4, 2033: 1},
    anos: [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]
  };

  function aliquotas(ano, cbsRef, ibsRef) {
    if (ano === 2026) return {cbs: .009, ibs: .001, teste: true};
    if (ano <= 2028) return {cbs: Math.max(0, cbsRef - .001), ibs: .001, teste: false};
    return {cbs: cbsRef, ibs: ibsRef * PARAM.fracaoIbs[ano], teste: false};
  }

  function faixa(rbt12, anexo, ano) {
    const tab = PARAM.anexos[anexo];
    let i = tab.faixas.findIndex(f => rbt12 <= f[0]);
    if (i < 0) return null;
    let nominal = tab.faixas[i][1];
    if (i === 5 && (ano === 2027 || ano === 2028)) nominal -= .001; // LC 214/2025, art. 519
    const pd = tab.faixas[i][2];
    const efetiva = rbt12 > 0 ? (rbt12 * nominal - pd) / rbt12 : tab.faixas[0][1];
    return {indice: i, numero: i + 1, nominal, pd, efetiva, pc: tab.pc[i] / 100, loc: tab.loc[i] / 100, cppNoDas: tab.cppNoDas, nomeAnexo: tab.nome};
  }

  const r2 = v => Math.round(v * 100) / 100;

  function calcular(e, ano) {
    const at = PARAM.atividades[e.atividade] || PARAM.atividades.comercio;
    const R = Math.max(0, +e.receita || 0);
    const F = Math.max(0, +e.folha || 0);
    const C = Math.max(0, +e.compras || 0);
    const lucroAntes = R * (+e.margem || 0);
    const icms = at.local === 'ICMS' ? (+e.icms || 0) : 0;
    const iss = at.local === 'ISS' ? (+e.iss || 0) : 0;
    const fL = PARAM.fatorLocal[ano];
    const red = +e.reducao || 0;
    const encargos = PARAM.cpp + (+e.ratTerceiros || 0);
    const ali = aliquotas(ano, +e.cbsRef, +e.ibsRef);

    // Tributo local (ICMS com crédito das compras; ISS sem crédito)
    const localDeb = R * (icms + iss) * fL;
    const localCred = C * icms * fL;
    const localLiq = Math.max(0, localDeb - localCred);
    const localNome = at.local;

    // CBS/IBS no regime regular (preço total mantido: tributo contido no valor da venda)
    function regular() {
      const tCheia = ali.cbs + ali.ibs;
      const tVenda = tCheia * (1 - red);
      const baseVenda = Math.max(0, R - localDeb);
      const deb = tVenda * baseVenda / (1 + tVenda);
      const baseCompra = Math.max(0, C - C * icms * fL);
      const cred = tCheia * baseCompra / (1 + tCheia);
      const liq = Math.max(0, deb - cred);
      const saldoCredor = Math.max(0, cred - deb);
      const pCbs = tCheia > 0 ? ali.cbs / tCheia : 0;
      return {deb, cred, liq, saldoCredor, cbs: liq * pCbs, ibs: liq * (1 - pCbs), tVenda};
    }
    const reg = ano >= 2027 ? regular() : null;

    const out = {ano, ali, regimes: {}, avisos: []};
    const memo = (texto, valor) => ({texto, valor});

    /* ---------- Simples Nacional ---------- */
    let anexo = at.anexo, fatorR = null;
    if (at.fatorR) {
      fatorR = R > 0 ? F / R : 0;
      if (fatorR >= PARAM.fatorR) anexo = 'III';
    }
    out.fatorR = fatorR;
    out.anexo = anexo;
    const rbt12 = R * 12;
    const fx = anexo && rbt12 <= PARAM.limiteSimples ? faixa(rbt12, anexo, ano) : null;
    out.faixa = fx;
    if (!fx) {
      const motivo = !anexo ? at.vedacao : 'Receita acima de R$ 4,8 milhões por ano (LC 123/2006, art. 3º, II).';
      out.regimes.simples = {elegivel: false, motivo};
      out.regimes.hibrido = {elegivel: false, motivo};
    } else {
      const sexta = fx.indice === 5;
      const localFora = sexta ? localLiq : 0;
      const cppFora = fx.cppNoDas ? 0 : F * PARAM.cpp;
      // Puro
      const das = R * fx.efetiva;
      const cbsIbsNoDas = ano >= 2027 ? das * (fx.pc + fx.loc * (1 - fL)) : 0;
      const itensP = [{nome: 'DAS', valor: das}];
      if (cbsIbsNoDas) itensP.push({nome: '  dos quais CBS/IBS', valor: cbsIbsNoDas, info: true});
      // Acima do sublimite, o IBS (sucessor do ICMS/ISS) também é pago fora do DAS — PREMISSA por analogia ao art. 13-A da LC 123
      const ibsFora = sexta && reg ? reg.ibs : 0;
      if (localFora) itensP.push({nome: localNome + ' fora do DAS (acima do sublimite)', valor: localFora});
      if (ibsFora) itensP.push({nome: 'IBS fora do DAS (acima do sublimite)', valor: ibsFora});
      if (cppFora) itensP.push({nome: 'CPP 20% (Anexo IV, fora do DAS)', valor: cppFora});
      const totP = das + localFora + ibsFora + cppFora;
      out.regimes.simples = {
        elegivel: true, itens: itensP, total: totP, credito: cbsIbsNoDas,
        memoria: [
          memo(fx.nomeAnexo + (at.fatorR ? (anexo === 'III' ? ' (Fator R ' + (fatorR * 100).toFixed(1) + '% ≥ 28%)' : ' (Fator R ' + (fatorR * 100).toFixed(1) + '% < 28%)') : '') + ', ' + fx.numero + 'ª faixa', null),
          memo('RBT12 = receita mensal × 12', rbt12),
          memo('Alíquota nominal ' + (fx.nominal * 100).toFixed(2) + '%, parcela a deduzir', fx.pd),
          memo('Alíquota efetiva = (RBT12 × nominal − PD) ÷ RBT12 = ' + (fx.efetiva * 100).toFixed(4) + '%', null),
          memo('DAS = receita × alíquota efetiva', das)
        ]
      };
      // Híbrido
      if (ano < 2027) {
        out.regimes.hibrido = {elegivel: false, motivo: 'Opção existe a partir de 2027 (LC 214/2025, art. 41, parágrafo 3º).'};
      } else {
        const receitaDas = R - reg.deb;
        const fatiaTirada = fx.pc + fx.loc * (1 - fL);
        const dasH = receitaDas * fx.efetiva * (1 - fatiaTirada);
        const itensH = [{nome: 'DAS sem a fatia de CBS/IBS', valor: dasH}, {nome: 'CBS', valor: reg.cbs}, {nome: 'IBS', valor: reg.ibs}];
        if (localFora) itensH.push({nome: localNome + ' fora do DAS (acima do sublimite)', valor: localFora});
        if (cppFora) itensH.push({nome: 'CPP 20% (Anexo IV, fora do DAS)', valor: cppFora});
        out.regimes.hibrido = {
          elegivel: true, itens: itensH, total: dasH + reg.liq + localFora + cppFora, credito: reg.deb, saldoCredor: reg.saldoCredor,
          memoria: [
            memo('Receita para o DAS = receita − CBS/IBS contidos no preço', receitaDas),
            memo('DAS = receita do DAS × ' + (fx.efetiva * 100).toFixed(4) + '% × (1 − ' + (fatiaTirada * 100).toFixed(2) + '% de fatia CBS/IBS)', dasH),
            memo('Débito CBS/IBS = ' + (reg.tVenda * 100).toFixed(2) + '% × base ÷ (1 + alíquota)', reg.deb),
            memo('(−) Crédito das compras', -reg.cred)
          ]
        };
      }
    }

    /* ---------- Lucro Presumido ---------- */
    {
      const recBruta = reg ? R - reg.deb : R;
      const anual = recBruta * 12;
      const fracExc = anual > PARAM.lc224.limiteAno ? (anual - PARAM.lc224.limiteAno) / anual : 0;
      const pesoCsll = ano === 2026 ? 0.75 : 1; // CSLL majorada só a partir de abr/2026
      const pIR = at.pIR * (1 + PARAM.lc224.acrescimo * fracExc);
      const pCS = at.pCS * (1 + PARAM.lc224.acrescimo * fracExc * pesoCsll);
      const baseIR = recBruta * pIR;
      const irpj = PARAM.irpj.aliq * baseIR + PARAM.irpj.adicional * Math.max(0, baseIR - PARAM.irpj.limiteMes);
      const csll = PARAM.csll * recBruta * pCS;
      const itens = [{nome: 'IRPJ', valor: irpj}, {nome: 'CSLL', valor: csll}];
      let consumo;
      if (!reg) {
        consumo = PARAM.pisCofinsCumul * Math.max(0, R - R * icms * fL); // ICMS fora da base (Tema 69 STF)
        itens.push({nome: 'PIS/COFINS cumulativo (3,65%)', valor: consumo});
      } else {
        consumo = reg.liq;
        itens.push({nome: 'CBS', valor: reg.cbs}, {nome: 'IBS', valor: reg.ibs});
      }
      if (localLiq) itens.push({nome: localNome, valor: localLiq});
      const cpp = F * encargos;
      itens.push({nome: 'CPP + encargos sobre a folha', valor: cpp});
      const memoria = [
        memo('Presunção IRPJ ' + (pIR * 100).toFixed(2) + '% / CSLL ' + (pCS * 100).toFixed(2) + '%' + (fracExc > 0 ? ' (acréscimo da LC 224/2025 sobre a receita acima de R$ 5 mi)' : ''), null),
        memo('Base do IRPJ', baseIR),
        memo('IRPJ = 15% + 10% sobre o que passar de R$ 20 mil/mês', irpj),
        memo('CSLL = 9% × receita × presunção', csll)
      ];
      if (fracExc > 0) out.avisos.push('Lucro Presumido com receita acima de R$ 5 milhões: aplicado o acréscimo da LC 224/2025, que está sendo discutido em liminares e ADIs no STF.');
      out.regimes.presumido = {elegivel: anual <= 78000000, motivo: 'Receita acima de R$ 78 milhões por ano.', itens, total: irpj + csll + consumo + localLiq + cpp, credito: reg ? reg.deb : 0, saldoCredor: reg ? reg.saldoCredor : 0, memoria};
    }

    /* ---------- Lucro Real ---------- */
    {
      let consumo;
      const itens = [];
      if (!reg) {
        consumo = Math.max(0, PARAM.pisCofinsNaoCumul * (R - R * icms * fL) - PARAM.pisCofinsNaoCumul * C);
        itens.push({nome: 'PIS/COFINS não cumulativo (9,25% − créditos)', valor: consumo});
      } else {
        consumo = reg.liq;
        itens.push({nome: 'CBS', valor: reg.cbs}, {nome: 'IBS', valor: reg.ibs});
      }
      if (localLiq) itens.push({nome: localNome, valor: localLiq});
      const cpp = F * encargos;
      itens.push({nome: 'CPP + encargos sobre a folha', valor: cpp});
      const lucroReal = Math.max(0, lucroAntes - consumo - localLiq - cpp);
      const irpj = PARAM.irpj.aliq * lucroReal + PARAM.irpj.adicional * Math.max(0, lucroReal - PARAM.irpj.limiteMes);
      const csll = PARAM.csll * lucroReal;
      itens.unshift({nome: 'IRPJ', valor: irpj}, {nome: 'CSLL', valor: csll});
      out.regimes.real = {
        elegivel: true, itens, total: irpj + csll + consumo + localLiq + cpp, credito: reg ? reg.deb : 0, saldoCredor: reg ? reg.saldoCredor : 0,
        memoria: [
          memo('Lucro antes dos tributos = receita × margem', lucroAntes),
          memo('(−) tributos sobre consumo e folha (dedutíveis)', -(consumo + localLiq + cpp)),
          memo('Lucro real', lucroReal),
          memo('IRPJ 15% + adicional 10% acima de R$ 20 mil/mês', irpj),
          memo('CSLL 9%', csll)
        ]
      };
    }

    /* ---------- Distribuição aos sócios (Lei 15.270/2025) ---------- */
    const nS = Math.max(1, Math.round(+e.socios || 1));
    const pDist = Math.min(1, Math.max(0, +e.distribuicao || 0));
    Object.keys(out.regimes).forEach(k => {
      const g = out.regimes[k];
      if (!g.elegivel) return;
      g.efetiva = R > 0 ? g.total / R : 0;
      g.sobra = lucroAntes - g.total;
      const dist = Math.max(0, g.sobra) * pDist;
      const porSocio = dist / nS;
      const aplica = (k === 'simples' || k === 'hibrido') ? e.retemSimples !== false : true;
      g.dividendosSocio = porSocio;
      g.retencao = aplica && porSocio > PARAM.dividendos.limiteMes ? dist * PARAM.dividendos.aliq : 0;
      g.liquidoSocios = dist - g.retencao;
    });

    // Avisos
    const elegs = Object.values(out.regimes).filter(g => g.elegivel);
    if (elegs.length && elegs.every(g => g.sobra < 0)) out.avisos.push('Mesmo no regime mais barato os tributos passam do lucro informado: confira a margem e as compras.');
    if (ano === 2026) out.avisos.push('Em 2026 a CBS (0,9%) e o IBS (0,1%) são de teste e compensados com PIS/COFINS: custo zero se as obrigações acessórias forem cumpridas. Arraste para 2027 para ver a reforma.');
    if (fx && fx.indice === 5) out.avisos.push('Receita acima do sublimite de R$ 3,6 milhões: ' + localNome + ' sai do DAS e é pago pelas regras normais.');
    if (at.fatorR && fatorR !== null && fatorR >= .28 && fatorR < .31) out.avisos.push('Fator R em ' + (fatorR * 100).toFixed(1) + '%, perto do limite de 28%: uma queda na folha leva ao Anexo V.');
    if (at.fatorR && fatorR !== null && fatorR < .28) out.avisos.push('Fator R em ' + (fatorR * 100).toFixed(1) + '%: faltam ' + brl((.28 - fatorR) * R) + ' de folha por mês (pró-labore incluído) para ir ao Anexo III.');
    if (reg && (reg.saldoCredor > 0)) out.avisos.push('Os créditos das compras superam os débitos de CBS/IBS no regime regular: há saldo credor a ressarcir (LC 214/2025).');
    if (fx && fx.indice < 5) {
      const folga = fx.indice >= 0 ? PARAM.anexos[anexo].faixas[fx.indice][0] - rbt12 : 0;
      if (folga > 0 && folga < PARAM.anexos[anexo].faixas[fx.indice][0] * .05) out.avisos.push('Receita de 12 meses a ' + brl(folga) + ' da próxima faixa do Simples.');
    }
    return out;
  }

  function brl(v) { return (v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0}); }

  function projecao(e) { return PARAM.anos.map(a => calcular(e, a)); }

  const api = {PARAM, calcular, projecao, aliquotas, faixa, brl, r2};
  if (typeof module === 'object' && module.exports) module.exports = api; else raiz.MotorCO = api;
})(typeof self !== 'undefined' ? self : this);
