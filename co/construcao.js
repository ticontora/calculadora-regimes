/* Módulo Construção e Incorporação — Controller & Oraculu's
 * Parâmetros conferidos em 05/11/2026. Valores ANUAIS. Depende de motor.js (Motor.aliquotas, Motor.calcular).
 * Fontes: Lei 10.931/2004, arts. 4º e 8º (RET); LC 214/2025, arts. 251 a 262 e 485 (redação da LC 227/2026);
 * Lei 12.546/2011, art. 7º, IV, com a transição da Lei 14.973/2024 (CPRB); Lei 9.249/1995, arts. 15 e 20.
 * Sem DOM: roda no navegador e no Node. */
(function (raiz) {
  'use strict';
  const M = (typeof module === 'object' && module.exports) ? require('./motor.js') : raiz.MotorCO;

  const PC = {
    // RET 4%: IRPJ 1,26 + CSLL 0,66 + PIS 0,37 + COFINS 1,71 (Lei 10.931/2004, art. 4º)
    // RET 1% (interesse social): IRPJ 0,31 + CSLL 0,16 + PIS 0,07 + COFINS 0,46 (art. 4º, parágrafo 6º)
    // A partir de 2027, PIS/COFINS dão lugar a CBS/IBS unificados: 2,08% e 0,53% (LC 214/2025, art. 485, redação da LC 227/2026)
    ret: {
      normal: {irpj: .0126, csll: .0066, pis: .0037, cofins: .0171, cbsIbs: .0208},
      social: {irpj: .0031, csll: .0016, pis: .0007, cofins: .0046, cbsIbs: .0053}
    },
    reducaoImoveis: .5,            // LC 214/2025, art. 261
    // Redutor social: R$ 100 mil por imóvel residencial novo e R$ 30 mil por lote (LC 214/2025, art. 259),
    // atualizados mensalmente pelo IPCA desde a publicação da LC (art. 259, § 3º). Valor nominal aqui; o valor do mês entra pela tela.
    redutorSocialUnidade: 100000,
    redutorSocialLote: 30000,
    // Parcelamento do solo com pedido de registro (Lei 6.766/1979) antes de 01/01/2029: opção por IBS+CBS de 3,65% da receita
    // bruta recebida, sem créditos e sem redutores de ajuste e social (LC 214/2025, art. 486; Res. CGIBS 6/2026, art. 462)
    loteamento486: .0365,
    // CPRB construção civil: 4,5% da receita (Lei 12.546/2011, art. 7º, IV); transição da Lei 14.973/2024
    cprb: {aliquota: .045, fatorReceita: {2026: .6, 2027: .4}, cppFolha: {2026: .10, 2027: .15}},
    // Aferição indireta da obra (IN RFB 2.021/2021, art. 25): RMT = área × % equivalência × VAU × % por tipo
    afericao: {tipo: {alvenaria: .20, madeira: .15, social: .12}, aliquotaTotal: .368},
    // Retenção sobre cessão de mão de obra/empreitada (Lei 8.212/1991, art. 31): 11%; 3,5% para optante da CPRB (Lei 12.546/2011, art. 7º, parágrafo 6º)
    retencao: {normal: .11, cprb: .035},
    presuncao: {comMaterial: {ir: .08, cs: .12}, semMaterial: {ir: .32, cs: .32}, imoveis: {ir: .08, cs: .12}}
  };

  const P = M.PARAM;
  function irpjCsll(baseIR, baseCS, anual) {
    const lim = P.irpj.limiteMes * 12;
    const irpj = P.irpj.aliq * baseIR + P.irpj.adicional * Math.max(0, baseIR - lim);
    return {irpj, csll: P.csll * baseCS};
  }
  function lc224(recAnual, pIR, pCS, ano) {
    const frac = recAnual > P.lc224.limiteAno ? (recAnual - P.lc224.limiteAno) / recAnual : 0;
    const peso = ano === 2026 ? .75 : 1;
    return {pIR: pIR * (1 + P.lc224.acrescimo * frac), pCS: pCS * (1 + P.lc224.acrescimo * frac * peso), aplicou: frac > 0};
  }
  const memo = (texto, valor) => ({texto, valor});

  /* ---------- Incorporação / venda de unidades ---------- */
  // e: {receita, terreno, obra, obraAte2026 (0–1), obraCredito (0–1), despesas, unidades, lotes, social, cbsRef, ibsRef, iss}
  function incorporacao(e, ano) {
    const R = Math.max(0, +e.receita || 0);
    const terreno = Math.max(0, +e.terreno || 0);
    const obra = Math.max(0, +e.obra || 0);
    const despesas = Math.max(0, +e.despesas || 0);
    const lucroAntes = R - terreno - obra - despesas;
    const ali = M.aliquotas(ano, +e.cbsRef, +e.ibsRef);
    const tCheia = ali.cbs + ali.ibs;
    const out = {ano, ali, regimes: {}, avisos: [], lucroAntes};
    const ret = e.social ? PC.ret.social : PC.ret.normal;

    // RET
    {
      const itens = [{nome: 'IRPJ (RET)', valor: R * ret.irpj}, {nome: 'CSLL (RET)', valor: R * ret.csll}];
      let consumo;
      if (ano <= 2026) { consumo = R * (ret.pis + ret.cofins); itens.push({nome: 'PIS/COFINS (RET)', valor: consumo}); }
      else { consumo = R * ret.cbsIbs; itens.push({nome: 'CBS/IBS unificados (RET de transição)', valor: consumo}); }
      const tot = itens.reduce((s, i) => s + i.valor, 0);
      out.regimes.ret = {nome: e.social ? 'RET 1% (interesse social)' : 'RET 4%', elegivel: true, itens, total: tot, credito: 0,
        memoria: [memo((ano <= 2026 ? 'RET ' : 'RET de transição ') + (e.social ? '1%' : '4%') + ' sobre a receita recebida', R),
          memo(ano <= 2026 ? 'IRPJ ' + (ret.irpj * 100).toFixed(2) + '% + CSLL ' + (ret.csll * 100).toFixed(2) + '% + PIS/COFINS ' + ((ret.pis + ret.cofins) * 100).toFixed(2) + '%'
            : 'IRPJ ' + (ret.irpj * 100).toFixed(2) + '% + CSLL ' + (ret.csll * 100).toFixed(2) + '% + CBS/IBS ' + (ret.cbsIbs * 100).toFixed(2) + '% (LC 214, art. 485)', tot)]};
    }

    // CBS/IBS no regime regular de imóveis (Presumido e Real a partir de 2027)
    let reg = null;
    if (ano >= 2027) {
      const tVenda = tCheia * (1 - PC.reducaoImoveis);
      const redAjuste = (terreno + obra * (+e.obraAte2026 || 0)) * (1 + Math.max(0, +e.ipca || 0)); // atualizado pelo IPCA (art. 258)
      const vUn = +e.redSocialUnidade > 0 ? +e.redSocialUnidade : PC.redutorSocialUnidade;
      const vLote = +e.redSocialLote > 0 ? +e.redSocialLote : PC.redutorSocialLote;
      const redSocial = (Math.max(0, +e.unidades || 0) * vUn) + (Math.max(0, +e.lotes || 0) * vLote);
      const base0 = Math.max(0, R - redAjuste);
      const base = Math.max(0, base0 - redSocial);
      // CBS/IBS são "por fora" (LC 214, art. 12, § 2º, I). Se a receita informada já embute o tributo, extrai-se por dentro.
      // Art. 488: a partir de 2029, os custos de 2027–2032 sujeitos a ICMS/ISS deduzem só a base do IBS (não vale com art. 485/486)
      const ded488 = ano >= 2029 ? Math.min(base, Math.max(0, +e.ded488 || 0)) : 0;
      const tC = ali.cbs * (1 - PC.reducaoImoveis), tI = ali.ibs * (1 - PC.reducaoImoveis);
      const div = e.precoSemTributo ? 1 : 1 + tVenda;
      const debC = tC * base / div, debI = tI * (base - ded488) / div;
      const deb = debC + debI;
      const obraNova = obra * (1 - (+e.obraAte2026 || 0)) * (+e.obraCredito || 0);
      const cred = tCheia * obraNova / (1 + tCheia);
      const liq = Math.max(0, deb - cred);
      const pCbs = tCheia ? ali.cbs / tCheia : 0;
      // crédito rateado pela proporção CBS/IBS da alíquota cheia; débito separado por tributo
      const cbsL = Math.max(0, debC - cred * pCbs), ibsL = Math.max(0, debI - cred * (1 - pCbs));
      reg = {tVenda, redAjuste, redSocial, base, ded488, deb, cred, liq: cbsL + ibsL, cbs: cbsL, ibs: ibsL, saldoCredor: Math.max(0, cred - deb)};
    }

    // Presumido
    {
      const recBruta = reg && !e.precoSemTributo ? R - reg.deb : R;
      const q = lc224(recBruta, PC.presuncao.imoveis.ir, PC.presuncao.imoveis.cs, ano);
      const {irpj, csll} = irpjCsll(recBruta * q.pIR, recBruta * q.pCS);
      const itens = [{nome: 'IRPJ', valor: irpj}, {nome: 'CSLL', valor: csll}];
      let consumo;
      if (!reg) { consumo = R * P.pisCofinsCumul; itens.push({nome: 'PIS/COFINS cumulativo (3,65%)', valor: consumo}); }
      else { consumo = reg.liq; itens.push({nome: 'CBS', valor: reg.cbs}, {nome: 'IBS', valor: reg.ibs}); }
      if (q.aplicou) out.avisos.push('Presumido com receita acima de R$ 5 milhões: aplicado o acréscimo de presunção da LC 224/2025 (em discussão no STF).');
      out.regimes.presumido = {nome: 'Lucro Presumido', elegivel: true, itens, total: irpj + csll + consumo, credito: reg ? reg.deb : 0,
        memoria: [memo('Presunção IRPJ ' + (q.pIR * 100).toFixed(2) + '% e CSLL ' + (q.pCS * 100).toFixed(2) + '% (venda de imóveis)', recBruta)].concat(reg ? memRegular(reg) : [])};
    }

    // Real
    {
      let consumo; const itens = [];
      if (!reg) {
        consumo = Math.max(0, P.pisCofinsNaoCumul * (R - terreno - obra));
        itens.push({nome: 'PIS/COFINS não cumulativo (com crédito do custo do imóvel)', valor: consumo});
      } else { consumo = reg.liq; itens.push({nome: 'CBS', valor: reg.cbs}, {nome: 'IBS', valor: reg.ibs}); }
      const lucro = Math.max(0, lucroAntes - consumo);
      const {irpj, csll} = irpjCsll(lucro, lucro);
      itens.unshift({nome: 'IRPJ', valor: irpj}, {nome: 'CSLL', valor: csll});
      out.regimes.real = {nome: 'Lucro Real', elegivel: true, itens, total: irpj + csll + consumo, credito: reg ? reg.deb : 0,
        memoria: [memo('Lucro antes dos tributos = receita − terreno − obra − despesas', lucroAntes), memo('Lucro real', lucro)].concat(reg ? memRegular(reg) : [])};
    }

    // Loteamento: regime de transição do art. 486 (alternativa ao regime regular, a partir de 2027)
    if (ano >= 2027 && e.loteamento) {
      const q = lc224(R, PC.presuncao.imoveis.ir, PC.presuncao.imoveis.cs, ano);
      const {irpj, csll} = irpjCsll(R * q.pIR, R * q.pCS);
      const cbsIbs = R * PC.loteamento486;
      out.regimes.lote = {nome: 'Loteamento art. 486 (Presumido)', elegivel: true,
        itens: [{nome: 'IRPJ', valor: irpj}, {nome: 'CSLL', valor: csll}, {nome: 'CBS/IBS 3,65% (art. 486)', valor: cbsIbs}],
        total: irpj + csll + cbsIbs, credito: 0,
        memoria: [memo('CBS/IBS de 3,65% sobre a receita bruta recebida, sem créditos e sem redutores (LC 214, art. 486)', cbsIbs),
          memo('IRPJ/CSLL pelo Presumido sobre a receita', irpj + csll)]};
      out.avisos.push('Loteamento (art. 486): exige pedido de registro do parcelamento até 31/12/2028; afasta o redutor de ajuste e o redutor social, e o comprador contribuinte não toma crédito.');
    }
    if (reg && reg.saldoCredor > 0) out.avisos.push('No regime regular, os créditos da obra superam o débito de CBS/IBS do ano: há saldo credor a compensar ou ressarcir.');
    if (ano >= 2027) out.avisos.push('RET de transição (LC 214, art. 485): exige patrimônio de afetação e opção pelo RET efetivada até 31/12/2028. Quem compra imóvel de incorporação no RET não toma crédito de CBS/IBS.');
    if (ano === 2026) out.avisos.push('Em 2026 a CBS (0,9%) e o IBS (0,1%) são de teste e compensados: o cálculo usa PIS/COFINS. Veja 2027 para a reforma.');
    out.afericao = afericao(e);
    fechar(out, lucroAntes, R);
    return out;
  }

  // INSS da obra por aferição indireta no Sero (IN RFB 2.021/2021). Independe do regime de IRPJ/CBS.
  // e: {area, equivalencia (0–1), vau, tipoObra ('alvenaria'|'madeira'|'social'), folhaObra, maoObraNotas, aliqAfericao}
  function afericao(e) {
    const area = Math.max(0, +e.area || 0);
    if (!area) return null;
    const eq = Math.min(1, Math.max(0, +e.equivalencia || 0));
    const vau = Math.max(0, +e.vau || 0);
    const pTipo = PC.afericao.tipo[e.tipoObra] || PC.afericao.tipo.alvenaria;
    const cod = area * eq * vau;
    const rmt = cod * pTipo;
    const creditos = Math.max(0, +e.folhaObra || 0) + Math.max(0, +e.maoObraNotas || 0);
    const diferenca = Math.max(0, rmt - creditos);
    const aliq = +e.aliqAfericao || PC.afericao.aliquotaTotal;
    return {area, eq, vau, pTipo, cod, rmt, creditos, diferenca, aliq, inss: diferenca * aliq,
      memoria: [memo('Área equivalente = ' + area.toLocaleString('pt-BR') + ' m² × ' + (eq * 100).toFixed(0) + '%', null),
        memo('Custo da obra por destinação (COD) = área equivalente × VAU R$ ' + vau.toLocaleString('pt-BR'), cod),
        memo('RMT = COD × ' + (pTipo * 100) + '% (' + (e.tipoObra === 'madeira' ? 'madeira ou mista' : e.tipoObra === 'social' ? 'alvenaria, interesse social' : 'alvenaria') + '; IN RFB 2.021/2021)', rmt),
        memo('(−) Remuneração já declarada na obra (DCTFWeb/eSocial no CNO) e mão de obra das notas de empreiteiros', -creditos),
        memo('Diferença a recolher como base', diferenca),
        memo('INSS da aferição = diferença × ' + (aliq * 100).toFixed(1).replace('.', ',') + '%', diferenca * aliq)]};
  }

  function memRegular(reg) {
    return [
      memo('Redutor de ajuste (terreno + obra incorrida até 2026, corrigidos pelo IPCA; LC 214, art. 258)', -reg.redAjuste),
      memo('Redutor social (R$ 100 mil por unidade residencial nova, R$ 30 mil por lote; art. 259)', -reg.redSocial),
      memo('Base de CBS/IBS', reg.base),
      reg.ded488 ? memo('(−) Dedução só na base do IBS: aquisições de 2027 a 2032 com ICMS/ISS (LC 214, art. 488)', -reg.ded488) : null,
      memo('Débito com alíquota reduzida em 50% (' + (reg.tVenda * 100).toFixed(2) + '%; art. 261)', reg.deb),
      memo('(−) Crédito dos insumos da obra adquiridos a partir de 2027', -reg.cred)
    ].filter(Boolean);
  }

  /* ---------- Construtora (empreitada) ---------- */
  // e: {receita, folha, margem, material (0–1 da receita), comMaterial (bool), iss, dedMaterialIss (bool), cprb (bool), ratTerceiros, cbsRef, ibsRef}
  function construtora(e, ano) {
    const R = Math.max(0, +e.receita || 0);
    const F = Math.max(0, +e.folha || 0);
    const mat = R * Math.min(1, Math.max(0, +e.material || 0));
    const lucroAntes = R * (+e.margem || 0);
    const ali = M.aliquotas(ano, +e.cbsRef, +e.ibsRef);
    const tCheia = ali.cbs + ali.ibs;
    const fL = P.fatorLocal[ano];
    const issBase = R - (e.dedMaterialIss ? mat : 0);
    const iss = Math.max(0, issBase * (+e.iss || 0) * fL);
    const enc = +e.ratTerceiros || 0;
    const out = {ano, ali, regimes: {}, avisos: [], lucroAntes};

    // Encargo previdenciário: CPP cheia ou CPRB na transição
    function previdencia(cprb) {
      if (!cprb || ano >= 2028) return {valor: F * (P.cpp + enc), texto: 'CPP 20%' + (enc ? ' + encargos' : '') + ' sobre a folha'};
      const fr = PC.cprb.fatorReceita[ano], cf = PC.cprb.cppFolha[ano];
      return {valor: R * PC.cprb.aliquota * fr + F * (cf + enc), texto: 'CPRB ' + (PC.cprb.aliquota * fr * 100).toFixed(2).replace('.', ',') + '% da receita + CPP ' + (cf * 100) + '% da folha (Lei 14.973/2024)'};
    }

    let reg = null;
    if (ano >= 2027) {
      const tVenda = tCheia * (1 - PC.reducaoImoveis);
      const base = Math.max(0, R - R * (+e.iss || 0) * fL);
      // CBS/IBS são "por fora" (LC 214, art. 12, § 2º, I). Se a receita informada já embute o tributo, extrai-se por dentro.
      const deb = e.precoSemTributo ? tVenda * base : tVenda * base / (1 + tVenda);
      const cred = e.comMaterial ? tCheia * mat / (1 + tCheia) : 0;
      const liq = Math.max(0, deb - cred);
      const pCbs = tCheia ? ali.cbs / tCheia : 0;
      reg = {tVenda, deb, cred, liq, cbs: liq * pCbs, ibs: liq * (1 - pCbs)};
    }

    ['presumido', 'real'].forEach(k => {
      const prev = previdencia(!!e.cprb);
      const itens = [];
      let consumo;
      if (!reg) {
        consumo = k === 'presumido' ? R * P.pisCofinsCumul : Math.max(0, P.pisCofinsNaoCumul * (R - mat));
        itens.push({nome: k === 'presumido' ? 'PIS/COFINS cumulativo (3,65%)' : 'PIS/COFINS não cumulativo (com crédito dos materiais)', valor: consumo});
      } else { consumo = reg.liq; itens.push({nome: 'CBS', valor: reg.cbs}, {nome: 'IBS', valor: reg.ibs}); }
      if (iss) itens.push({nome: 'ISS', valor: iss});
      itens.push({nome: e.cprb && ano < 2028 ? 'CPRB + CPP (transição)' : 'CPP + encargos sobre a folha', valor: prev.valor});
      let irpj, csll, mem;
      if (k === 'presumido') {
        const recBruta = reg && !e.precoSemTributo ? R - reg.deb : R;
        const pres = e.comMaterial ? PC.presuncao.comMaterial : PC.presuncao.semMaterial;
        const q = lc224(recBruta, pres.ir, pres.cs, ano);
        ({irpj, csll} = irpjCsll(recBruta * q.pIR, recBruta * q.pCS));
        mem = [memo('Presunção IRPJ ' + (q.pIR * 100).toFixed(2) + '% / CSLL ' + (q.pCS * 100).toFixed(2) + '% (' + (e.comMaterial ? 'empreitada com material' : 'só mão de obra') + ')', recBruta)];
      } else {
        const lucro = Math.max(0, lucroAntes - consumo - iss - prev.valor);
        ({irpj, csll} = irpjCsll(lucro, lucro));
        mem = [memo('Lucro real = lucro antes dos tributos − consumo − ISS − previdência', lucro)];
      }
      itens.unshift({nome: 'IRPJ', valor: irpj}, {nome: 'CSLL', valor: csll});
      mem.push(memo(prev.texto, prev.valor));
      if (reg) mem.push(memo('CBS/IBS com redução de 50% (' + (reg.tVenda * 100).toFixed(2) + '%) menos crédito dos materiais', reg.liq));
      out.regimes[k] = {nome: k === 'presumido' ? 'Lucro Presumido' : 'Lucro Real', elegivel: true, itens, total: itens.reduce((s, i) => s + i.valor, 0), credito: reg ? reg.deb : 0, memoria: mem};
    });

    // Simples Nacional (Anexo IV) pelo motor geral, com valores mensais
    const sm = M.calcular({atividade: e.comMaterial ? 'construcao' : 'servicos4', receita: R / 12, folha: F / 12, compras: e.comMaterial ? mat / 12 : 0,
      margem: +e.margem || 0, iss: +e.iss || 0, cbsRef: +e.cbsRef, ibsRef: +e.ibsRef, socios: 1, distribuicao: 0}, ano);
    const s = sm.regimes.simples;
    out.regimes.simples = s.elegivel ? {nome: 'Simples Nacional (Anexo IV)', elegivel: true, itens: s.itens.map(i => ({nome: i.nome, valor: i.valor * 12, info: i.info})), total: s.total * 12, credito: s.credito * 12,
      memoria: s.memoria.map(m => memo(m.texto, m.valor === null ? null : m.valor * 12))} : {nome: 'Simples Nacional (Anexo IV)', elegivel: false, motivo: s.motivo};

    // Comparativo previdenciário
    if (ano <= 2027) {
      const cpp = F * (P.cpp + enc), alt = previdencia(true).valor;
      out.avisos.push('Previdência em ' + ano + ': CPP cheia ' + M.brl(cpp) + ' × CPRB na transição ' + M.brl(alt) + ' — ' + (alt < cpp ? 'a CPRB economiza ' + M.brl(cpp - alt) : 'a CPP cheia sai mais barata em ' + M.brl(alt - cpp)) + '. A opção pela CPRB é anual e irretratável. Em 2028 a CPRB acaba.');
    }
    if (ano === 2026) out.avisos.push('Em 2026 a CBS (0,9%) e o IBS (0,1%) são de teste e compensados: o cálculo usa PIS/COFINS.');
    const cprbAtiva = !!e.cprb && ano <= 2027;
    const pRet = cprbAtiva ? PC.retencao.cprb : PC.retencao.normal;
    const baseRet = Math.max(0, R - (e.comMaterial ? mat : 0));
    out.retencoes = {inss: baseRet * pRet, pInss: pRet, baseInss: baseRet, iss: e.issRetido ? iss : 0, cprbAtiva};
    out.avisos.push('Retenções na fonte: INSS de ' + (pRet * 100).toFixed(1).replace('.', ',') + '% sobre ' + M.brl(baseRet) + ' = ' + M.brl(out.retencoes.inss) + (e.issRetido ? ' e ISS retido de ' + M.brl(iss) : '') + ' no ano. Não aumentam a carga: o INSS retido é compensado na DCTFWeb e o excedente pode ser restituído.');
    fechar(out, lucroAntes, R);
    return out;
  }

  function fechar(out, lucroAntes, R) {
    Object.values(out.regimes).forEach(g => { if (!g.elegivel) return; g.efetiva = R > 0 ? g.total / R : 0; g.sobra = lucroAntes - g.total; });
  }

  function projecao(tipo, e) { return P.anos.map(a => (tipo === 'incorporacao' ? incorporacao : construtora)(e, a)); }

  const api = {PC, incorporacao, construtora, projecao};
  if (typeof module === 'object' && module.exports) module.exports = api; else raiz.Construcao = api;
})(typeof self !== 'undefined' ? self : this);
