/*
 * Comparação de regimes por ano (2026–2033): Simples (CBS/IBS no DAS), Simples com CBS/IBS fora do DAS,
 * Lucro Presumido, Lucro Real e RET. Cada regime devolve tributos por categoria e memória de cálculo
 * com fórmula, valor e fundamento legal. Sem DOM: roda no navegador e no Node.
 *
 * Entrada (valores mensais, frações em decimal):
 *  {receita, atividade, folha, fatorR, margem, compras, icms, iss, ano, meses,
 *   referencia: {cbs, ibs}, comprador,
 *   socios: {quantidade, distribuir, percentual, proLabore, outrasRendasAnuais, irOutrasRendas, aplicarNoSimples}}
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica(require('./parametros.js'), require('./simples.js'), require('./renda-pf.js'));
  } else {
    raiz.Motor = raiz.Motor || {};
    raiz.Motor.regimes = fabrica(raiz.Motor.parametros, raiz.Motor.simples, raiz.Motor.rendaPF);
  }
})(typeof self !== 'undefined' ? self : this, function (P, S, PF) {
  'use strict';

  const NOMES = {
    simples: 'Simples Nacional',
    simplesFora: 'Simples com CBS/IBS fora do DAS',
    presumido: 'Lucro Presumido',
    real: 'Lucro Real',
    ret: 'RET (incorporação)'
  };
  const ORDEM = ['simples', 'simplesFora', 'presumido', 'real', 'ret'];
  const COMPRADOR_TOMA_CREDITO = ['pj_real', 'pj_presumido', 'pj_simples_regular'];

  const CATEGORIA = {};
  Object.keys(P.CATEGORIAS).forEach(c => P.CATEGORIAS[c].tributos.forEach(t => { CATEGORIA[t] = c; }));

  const pct = v => (v * 100).toLocaleString('pt-BR', {maximumFractionDigits: 4}) + '%';
  const brl = v => v.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  function aliquotasCbsIbs(ano, referencia) {
    const c = P.CRONOGRAMA_CBS_IBS[ano];
    const ref = referencia || P.REFERENCIA_CBS_IBS;
    if (c.teste) return {cbs: c.cbsFixa, ibs: c.ibsFixa, teste: true};
    const ibs = c.ibsFixa !== undefined ? c.ibsFixa : ref.ibs * c.ibsFracao;
    return {cbs: Math.max(0, ref.cbs + c.cbsAjuste), ibs, teste: false};
  }

  // Monta um regime a partir de linhas de memória. Linhas com "codigo" são tributos.
  function montar(chave, linhas, antes, receita) {
    const tributos = [];
    linhas.forEach(l => {
      if (!l.codigo) return;
      const ex = tributos.find(t => t.codigo === l.codigo);
      if (ex) ex.valor += l.valor; else tributos.push({codigo: l.codigo, categoria: CATEGORIA[l.codigo] || 'consumo', valor: l.valor});
    });
    const total = tributos.reduce((s, t) => s + t.valor, 0);
    return {chave, nome: NOMES[chave], elegivel: true, tributos, memoria: linhas, total, efetiva: receita > 0 ? total / receita : 0, sobra: antes - total};
  }
  const linha = (etapa, formula, valor, fundamento, codigo) => ({etapa, formula, valor, fundamento, codigo: codigo || null});

  function calcular(e) {
    const ano = e.ano || 2026;
    const meses = e.meses || 1;
    const R = Math.max(0, e.receita || 0);
    const cfg = P.ATIVIDADES[e.atividade] || P.ATIVIDADES.comercio;
    const antes = R * (e.margem || 0);
    const folha = Math.max(0, e.folha || 0);
    const C = R * (e.compras || 0);
    const trans = P.TRANSICAO_ICMS_ISS[ano];
    const fatorIcmsIss = 1 - trans;
    const icmsAliq = cfg.icms ? (e.icms || 0) * fatorIcmsIss : 0;
    const issAliq = cfg.iss ? (e.iss || 0) * fatorIcmsIss : 0;
    const icmsDebito = R * icmsAliq;
    const icmsCredito = C * icmsAliq;
    const icmsLiquido = Math.max(0, icmsDebito - icmsCredito);
    const issValor = R * issAliq;
    const cpp = P.CPP * folha;
    const ali = aliquotasCbsIbs(ano, e.referencia);
    const t = ali.cbs + ali.ibs;
    const reforma = ano >= P.INICIO_OPCAO_FORA_DAS;
    const fundTransicao = 'EC 132/2023, ADCT, arts. 125 a 129; LC 214/2025, arts. 343 a 348';
    const notaTransicao = trans > 0 ? ' (alíquota reduzida a ' + Math.round(fatorIcmsIss * 100) + '% em ' + ano + ')' : '';

    // CBS/IBS no regime regular: mesmo preço total cobrado; base sem ICMS/ISS; crédito das compras
    function cbsIbsRegular(baseExtraExclusao) {
      const baseVenda = Math.max(0, R - (baseExtraExclusao || 0));
      const debito = t * baseVenda / (1 + t);
      const credito = t * C * (1 - icmsAliq) / (1 + t);
      const cbs = Math.max(0, (debito - credito) * ali.cbs / t);
      const ibs = Math.max(0, (debito - credito) * ali.ibs / t);
      return {baseVenda, debito, credito, cbs, ibs};
    }

    const out = {ano, meses, aliquotasCbsIbs: ali, regimes: {}, avisos: []};

    /* ----- Simples Nacional ----- */
    let tabela = cfg.tabela;
    let fatorR = null;
    if (tabela === 'servicos5' && e.fatorR) {
      fatorR = R > 0 ? folha / R : 0;
      if (fatorR >= P.FATOR_R_MINIMO) tabela = 'servicos';
    }
    const rbt12 = R * 12;
    const efe = tabela ? S.aliquotaEfetiva(rbt12, tabela, ano) : null;
    out.anexo = !tabela ? cfg.anexo : (cfg.tabela === 'servicos5' && tabela === 'servicos'
      ? 'Anexo III (Fator R ' + Math.round(fatorR * 100) + '%)' : cfg.anexo);
    out.fatorR = fatorR;
    out.faixa = efe;
    if (!efe) {
      const motivo = tabela ? 'faturamento acima de R$ 4,8 milhões por ano' : cfg.vedacao;
      out.regimes.simples = {chave: 'simples', nome: NOMES.simples, elegivel: false, motivo};
      out.regimes.simplesFora = {chave: 'simplesFora', nome: NOMES.simplesFora, elegivel: false, motivo};
    } else {
      const fatias = S.partilha(tabela, efe.indice, ano);
      const sexta = efe.indice === 5;
      const icmsFora = sexta && cfg.icms ? icmsLiquido : 0;
      const issFora = sexta && cfg.iss ? issValor : 0;
      const cppFora = tabela === 'servicos4' ? cpp : 0;
      const cab = [
        linha('Receita dos últimos 12 meses (RBT12)', 'faturamento mensal × 12', rbt12, 'LC 123/2006, art. 18, § 1º'),
        linha('Alíquota nominal da ' + efe.faixa + 'ª faixa (' + out.anexo + ')', pct(efe.nominal) + (sexta && reforma && ano <= 2028 ? ' (−0,1 p.p. em 2027–2028)' : ''), efe.nominal, 'LC 123/2006, Anexos I a V; LC 214/2025, Anexos XVIII a XXII'),
        linha('Parcela a deduzir', 'valor fixo da faixa', efe.deducao, 'LC 123/2006, Anexos I a V'),
        linha('Alíquota efetiva', '(' + brl(rbt12) + ' × ' + pct(efe.nominal) + ' − ' + brl(efe.deducao) + ') ÷ ' + brl(rbt12), efe.efetiva, 'LC 123/2006, art. 18, § 1º-A')
      ];
      cab.forEach(l => { l.fixo = true; l.tipo = l.etapa.indexOf('Alíquota') === 0 ? 'pct' : 'brl'; });

      // Variante 1: CBS/IBS dentro do DAS
      const das = R * efe.efetiva;
      const partes = S.repartirDas(das, R, fatias);
      const linhasS = cab.slice();
      linhasS.push(linha('DAS do período', brl(R) + ' × ' + pct(efe.efetiva), das, 'LC 123/2006, art. 18'));
      partes.forEach(p => linhasS.push(linha('  ' + p.codigo + ' dentro do DAS', 'DAS × ' + p.fatia.toLocaleString('pt-BR', {maximumFractionDigits: 2}) + '%' + (p.codigo === 'ISS' && p.valor < das * p.fatia / 100 - 0.005 ? ' (limitado a 5% da receita)' : ''), p.valor, 'Partilha do DAS (LC 123/2006 e LC 214/2025, anexos)', p.codigo)));
      let ibsFora6 = 0;
      if (sexta && reforma) {
        const reg = cbsIbsRegular(icmsDebito + issValor);
        ibsFora6 = reg.ibs;
        linhasS.push(linha('IBS fora do DAS (acima do sublimite)', pct(ali.ibs) + ' sobre as vendas − crédito das compras', ibsFora6, 'LC 123/2006, art. 13-A (por analogia); PREMISSA', 'IBS'));
      }
      if (icmsFora) linhasS.push(linha('ICMS fora do DAS (acima do sublimite)', brl(icmsDebito) + ' − ' + brl(icmsCredito) + notaTransicao, icmsFora, 'LC 123/2006, art. 13-A', 'ICMS'));
      if (issFora) linhasS.push(linha('ISS fora do DAS (acima do sublimite)', brl(R) + ' × ' + pct(issAliq) + notaTransicao, issFora, 'LC 123/2006, art. 13-A', 'ISS'));
      if (cppFora) linhasS.push(linha('CPP patronal (Anexo IV, fora do DAS)', brl(folha) + ' × 20%', cppFora, 'LC 123/2006, art. 18, § 5º-C; Lei 8.212/1991, art. 22', 'CPP'));
      const simples = montar('simples', linhasS, antes, R);
      simples.das = das;
      simples.fatiaCbsIbs = ((fatias.cbs || 0) + (fatias.ibs || 0)) / 100;
      simples.creditoComprador = das * simples.fatiaCbsIbs;
      simples.irpjCsll = partes.filter(p => p.codigo === 'IRPJ' || p.codigo === 'CSLL').reduce((s, p) => s + p.valor, 0);
      out.regimes.simples = simples;

      // Variante 2: CBS/IBS fora do DAS (opção a partir de 2027)
      if (!reforma) {
        out.regimes.simplesFora = {chave: 'simplesFora', nome: NOMES.simplesFora, elegivel: false, motivo: 'opção existe a partir de 2027 (LC 214/2025, art. 41, § 3º)'};
      } else {
        const reg = cbsIbsRegular((icmsFora ? icmsDebito : 0) + (issFora ? issValor : 0));
        const baseDas = R - reg.debito;
        const fatiasSem = Object.assign({}, fatias);
        const fatiaTirada = (fatiasSem.cbs || 0) + (fatiasSem.ibs || 0);
        delete fatiasSem.cbs; delete fatiasSem.ibs;
        const dasFora = baseDas * efe.efetiva * (1 - fatiaTirada / 100);
        const partesF = S.repartirDas(baseDas * efe.efetiva, baseDas, fatiasSem);
        const linhasF = cab.slice();
        linhasF.push(linha('Receita para o DAS', brl(R) + ' − CBS/IBS contidos no preço (' + brl(reg.debito) + ')', baseDas, 'LC 214/2025, art. 41, § 3º; PREMISSA'));
        linhasF.push(linha('DAS sem a fatia de CBS/IBS', brl(baseDas) + ' × ' + pct(efe.efetiva) + ' × (1 − ' + fatiaTirada.toLocaleString('pt-BR', {maximumFractionDigits: 2}) + '%)', dasFora, 'LC 214/2025, art. 41, § 3º'));
        partesF.forEach(p => linhasF.push(linha('  ' + p.codigo + ' dentro do DAS', 'DAS × ' + p.fatia.toLocaleString('pt-BR', {maximumFractionDigits: 2}) + '%', p.valor, 'Partilha do DAS (LC 123/2006 e LC 214/2025, anexos)', p.codigo)));
        linhasF.push(linha('CBS/IBS sobre as vendas (débito)', pct(t) + ' × ' + brl(reg.baseVenda) + ' ÷ (1 + ' + pct(t) + ')', reg.debito, 'LC 214/2025, arts. 12 e 41'));
        linhasF.push(linha('(−) Crédito de CBS/IBS das compras', pct(t) + ' × compras ÷ (1 + ' + pct(t) + ')', -reg.credito, 'LC 214/2025, art. 47; PREMISSA: fornecedores do regime regular'));
        linhasF.push(linha('CBS a recolher', '(débito − crédito) × ' + pct(ali.cbs) + ' ÷ ' + pct(t), reg.cbs, 'LC 214/2025, arts. 41 e 47', 'CBS'));
        linhasF.push(linha('IBS a recolher', '(débito − crédito) × ' + pct(ali.ibs) + ' ÷ ' + pct(t), reg.ibs, 'LC 214/2025, arts. 41 e 47', 'IBS'));
        if (icmsFora) linhasF.push(linha('ICMS fora do DAS (acima do sublimite)', brl(icmsDebito) + ' − ' + brl(icmsCredito) + notaTransicao, icmsFora, 'LC 123/2006, art. 13-A', 'ICMS'));
        if (issFora) linhasF.push(linha('ISS fora do DAS (acima do sublimite)', brl(R) + ' × ' + pct(issAliq) + notaTransicao, issFora, 'LC 123/2006, art. 13-A', 'ISS'));
        if (cppFora) linhasF.push(linha('CPP patronal (Anexo IV, fora do DAS)', brl(folha) + ' × 20%', cppFora, 'LC 123/2006, art. 18, § 5º-C', 'CPP'));
        const sf = montar('simplesFora', linhasF, antes, R);
        sf.creditoComprador = reg.debito;
        sf.irpjCsll = partesF.filter(p => p.codigo === 'IRPJ' || p.codigo === 'CSLL').reduce((s, p) => s + p.valor, 0);
        out.regimes.simplesFora = sf;
      }
    }

    /* ----- Lucro Presumido ----- */
    const regP = reforma ? cbsIbsRegular(icmsDebito + issValor) : null;
    const receitaBruta = reforma ? R - regP.debito : R;
    const anual = receitaBruta * 12;
    const fracExcesso = anual > P.LC224.limiteAnual ? 1 - P.LC224.limiteAnual / anual : 0;
    const fatorCsll224 = (ano === 2026 && meses === 12) ? (12 - P.LC224.inicioCsll2026 + 1) / 12 : 1;
    const pIR = cfg.pIR * (1 + P.LC224.acrescimo * fracExcesso);
    const pCS = cfg.pCS * (1 + P.LC224.acrescimo * fracExcesso * fatorCsll224);
    const baseIR = receitaBruta * pIR;
    const baseCS = receitaBruta * pCS;
    const irpjP = P.IRPJ.aliquota * baseIR;
    const adicP = P.IRPJ.adicional * Math.max(0, baseIR - P.IRPJ.limiteAdicionalMes);
    const csllP = P.CSLL * baseCS;
    const linhasP = [linha('Lucro antes dos impostos', brl(R) + ' × ' + pct(e.margem || 0), antes, 'Informado')];
    if (reforma) linhasP.push(linha('Receita bruta (sem CBS/IBS)', brl(R) + ' − ' + brl(regP.debito), receitaBruta, 'LC 214/2025, art. 12; PREMISSA: mesmo preço total ao cliente'));
    if (fracExcesso > 0) linhasP.push(linha('Acréscimo da LC 224/2025', '+10% na presunção sobre ' + pct(fracExcesso) + ' da receita (parte acima de R$ 5 mi/ano)' + (fatorCsll224 < 1 ? '; CSLL só a partir de abril' : ''), fracExcesso, 'LC 224/2025, art. 4º, § 4º, VII e § 5º'));
    linhasP.push(linha('IRPJ 15%', brl(receitaBruta) + ' × presunção ' + pct(pIR) + ' × 15%', irpjP, 'Lei 9.249/1995, arts. 3º e 15', 'IRPJ'));
    linhasP.push(linha('IRPJ adicional 10%', '(' + brl(baseIR) + ' − R$ 20.000) × 10%', adicP, 'Lei 9.249/1995, art. 3º, § 1º', 'IRPJ'));
    linhasP.push(linha('CSLL 9%', brl(receitaBruta) + ' × presunção ' + pct(pCS) + ' × 9%', csllP, 'Lei 9.249/1995, art. 20; Lei 7.689/1988, art. 3º', 'CSLL'));
    if (!reforma) {
      const basePC = R - icmsDebito;
      linhasP.push(linha('PIS 0,65%', '(' + brl(R) + ' − ICMS) × 0,65%', basePC * P.PIS_COFINS_CUMULATIVO.pis, 'Lei 9.715/1998; STF, Tema 69', 'PIS'));
      linhasP.push(linha('COFINS 3%', '(' + brl(R) + ' − ICMS) × 3%', basePC * P.PIS_COFINS_CUMULATIVO.cofins, 'Lei 9.718/1998, art. 8º; STF, Tema 69', 'COFINS'));
      linhasP.push(linha('CBS 0,9% e IBS 0,1% (teste)', 'apurados e compensados com PIS/COFINS', 0, fundTransicao));
    } else {
      linhasP.push(linha('CBS/IBS sobre as vendas (débito)', pct(t) + ' × ' + brl(regP.baseVenda) + ' ÷ (1 + ' + pct(t) + ')', regP.debito, 'LC 214/2025, art. 12'));
      linhasP.push(linha('(−) Crédito de CBS/IBS das compras', pct(t) + ' × compras ÷ (1 + ' + pct(t) + ')', -regP.credito, 'LC 214/2025, art. 47; PREMISSA: fornecedores do regime regular'));
      linhasP.push(linha('CBS a recolher', '(débito − crédito) × parte da CBS', regP.cbs, fundTransicao, 'CBS'));
      linhasP.push(linha('IBS a recolher', '(débito − crédito) × parte do IBS', regP.ibs, fundTransicao, 'IBS'));
    }
    if (cfg.iss && trans < 1) linhasP.push(linha('ISS', brl(R) + ' × ' + pct(issAliq) + notaTransicao, issValor, 'LC 116/2003', 'ISS'));
    if (cfg.icms && trans < 1) linhasP.push(linha('ICMS a recolher', brl(icmsDebito) + ' − ' + brl(icmsCredito) + notaTransicao, icmsLiquido, 'LC 87/1996; RICMS do estado', 'ICMS'));
    linhasP.push(linha('CPP patronal 20%', brl(folha) + ' × 20%', cpp, 'Lei 8.212/1991, art. 22', 'CPP'));
    const presumido = montar('presumido', linhasP, antes, R);
    presumido.irpjCsll = irpjP + adicP + csllP;
    presumido.creditoComprador = reforma ? regP.debito : 0;
    presumido.lc224 = fracExcesso;
    out.regimes.presumido = presumido;

    /* ----- Lucro Real ----- */
    const linhasR = [linha('Lucro antes dos impostos', brl(R) + ' × ' + pct(e.margem || 0), antes, 'Informado')];
    let consumoReal;
    if (!reforma) {
      const basePC = Math.max(0, R - icmsDebito - C);
      const pis = basePC * P.PIS_COFINS_NAO_CUMULATIVO.pis;
      const cof = basePC * P.PIS_COFINS_NAO_CUMULATIVO.cofins;
      linhasR.push(linha('PIS 1,65%', '(' + brl(R) + ' − ICMS − compras) × 1,65%', pis, 'Lei 10.637/2002, arts. 2º e 3º', 'PIS'));
      linhasR.push(linha('COFINS 7,6%', '(' + brl(R) + ' − ICMS − compras) × 7,6%', cof, 'Lei 10.833/2003, arts. 2º e 3º', 'COFINS'));
      linhasR.push(linha('CBS 0,9% e IBS 0,1% (teste)', 'apurados e compensados com PIS/COFINS', 0, fundTransicao));
      consumoReal = pis + cof;
    } else {
      linhasR.push(linha('CBS/IBS sobre as vendas (débito)', pct(t) + ' × ' + brl(regP.baseVenda) + ' ÷ (1 + ' + pct(t) + ')', regP.debito, 'LC 214/2025, art. 12'));
      linhasR.push(linha('(−) Crédito de CBS/IBS das compras', pct(t) + ' × compras ÷ (1 + ' + pct(t) + ')', -regP.credito, 'LC 214/2025, art. 47; PREMISSA: fornecedores do regime regular'));
      linhasR.push(linha('CBS a recolher', '(débito − crédito) × parte da CBS', regP.cbs, fundTransicao, 'CBS'));
      linhasR.push(linha('IBS a recolher', '(débito − crédito) × parte do IBS', regP.ibs, fundTransicao, 'IBS'));
      consumoReal = regP.cbs + regP.ibs;
    }
    if (cfg.iss && trans < 1) linhasR.push(linha('ISS', brl(R) + ' × ' + pct(issAliq) + notaTransicao, issValor, 'LC 116/2003', 'ISS'));
    if (cfg.icms && trans < 1) linhasR.push(linha('ICMS a recolher', brl(icmsDebito) + ' − ' + brl(icmsCredito) + notaTransicao, icmsLiquido, 'LC 87/1996; RICMS do estado', 'ICMS'));
    linhasR.push(linha('CPP patronal 20%', brl(folha) + ' × 20%', cpp, 'Lei 8.212/1991, art. 22', 'CPP'));
    const lucroTrib = antes - cpp - issValor - icmsLiquido - consumoReal;
    linhasR.push(linha('Lucro tributável', 'lucro antes dos impostos − CPP − ISS − ICMS − ' + (reforma ? 'CBS/IBS' : 'PIS/COFINS'), lucroTrib, 'Decreto-Lei 1.598/1977, art. 6º; PREMISSA: sem adições, exclusões nem prejuízo a compensar'));
    const irpjR = lucroTrib > 0 ? P.IRPJ.aliquota * lucroTrib : 0;
    const adicR = lucroTrib > 0 ? P.IRPJ.adicional * Math.max(0, lucroTrib - P.IRPJ.limiteAdicionalMes) : 0;
    const csllR = lucroTrib > 0 ? P.CSLL * lucroTrib : 0;
    linhasR.push(linha('IRPJ 15%', brl(Math.max(0, lucroTrib)) + ' × 15%', irpjR, 'Lei 9.249/1995, art. 3º', 'IRPJ'));
    linhasR.push(linha('IRPJ adicional 10%', '(lucro tributável − R$ 20.000) × 10%', adicR, 'Lei 9.249/1995, art. 3º, § 1º', 'IRPJ'));
    linhasR.push(linha('CSLL 9%', brl(Math.max(0, lucroTrib)) + ' × 9%', csllR, 'Lei 7.689/1988, art. 3º', 'CSLL'));
    const real = montar('real', linhasR, antes, R);
    real.irpjCsll = irpjR + adicR + csllR;
    real.creditoComprador = reforma ? regP.debito : 0;
    out.regimes.real = real;

    /* ----- RET (só incorporação) ----- */
    if (!cfg.ret) {
      out.regimes.ret = {chave: 'ret', nome: NOMES.ret, elegivel: false, motivo: 'só para incorporação com patrimônio de afetação'};
    } else {
      const linhasT = [
        linha('Lucro antes dos impostos', brl(R) + ' × ' + pct(e.margem || 0), antes, 'Informado'),
        linha('IRPJ (RET)', brl(R) + ' × 1,26%', R * P.RET.irpj, 'Lei 10.931/2004, art. 8º', 'IRPJ'),
        linha('CSLL (RET)', brl(R) + ' × 0,66%', R * P.RET.csll, 'Lei 10.931/2004, art. 8º', 'CSLL')
      ];
      if (!reforma) {
        linhasT.push(linha('PIS (RET)', brl(R) + ' × 0,37%', R * P.RET.pis, 'Lei 10.931/2004, art. 8º', 'PIS'));
        linhasT.push(linha('COFINS (RET)', brl(R) + ' × 1,71%', R * P.RET.cofins, 'Lei 10.931/2004, art. 8º', 'COFINS'));
      } else {
        linhasT.push(linha('CBS/IBS no RET de transição', brl(R) + ' × 2,08%', R * P.RET.cbsIbsTransicao, 'LC 214/2025, art. 485; PREMISSA', 'CBS/IBS (RET)'));
      }
      linhasT.push(linha('CPP patronal 20%', brl(folha) + ' × 20%', cpp, 'Lei 8.212/1991, art. 22 (fora do RET)', 'CPP'));
      const ret = montar('ret', linhasT, antes, R);
      ret.irpjCsll = R * (P.RET.irpj + P.RET.csll);
      ret.creditoComprador = 0;
      out.regimes.ret = ret;
    }

    /* ----- Distribuição de lucros ao sócio (custo para levar o lucro à PF) ----- */
    const so = e.socios || {};
    const qtd = Math.max(1, Math.round(so.quantidade || 1));
    ORDEM.forEach(k => {
      const r = out.regimes[k];
      if (!r.elegivel) return;
      const disponivel = Math.max(0, r.sobra) * (so.percentual === undefined ? 1 : so.percentual);
      const consumoFolha = r.tributos.filter(x => x.categoria !== 'renda').reduce((s, x) => s + x.valor, 0);
      const lucroContabil = antes - consumoFolha;
      const isento = (k === 'simples' || k === 'simplesFora') && so.aplicarNoSimples === false;
      const d = PF.custoDistribuicao({
        dividendosMes: disponivel / qtd,
        proLabore: so.proLabore || 0,
        outrasRendasAnuais: so.outrasRendasAnuais || 0,
        irOutrasRendas: so.irOutrasRendas || 0,
        irpjCsllAnualPJ: r.irpjCsll * 12,
        lucroContabilAnualPJ: lucroContabil * 12
      });
      const custoMes = isento ? 0 : d.custoDividendosAno * qtd / 12;
      const retidoMes = isento ? 0 : d.retidoMes * qtd;
      r.distribuicao = {
        socios: qtd, isento, porSocio: d,
        distribuidoMes: disponivel,
        retidoMes, irpfmMes: custoMes,
        totalComDistribuicao: r.total + custoMes,
        liquidoSociosMes: disponivel - custoMes
      };
    });

    /* ----- Período: escala os valores mensais ----- */
    ORDEM.forEach(k => {
      const r = out.regimes[k];
      if (!r.elegivel) return;
      r.tributos.forEach(x => { x.valor *= meses; });
      r.memoria.forEach(l => { if (!l.fixo && l.etapa.indexOf('Acréscimo da LC') !== 0) l.valor *= meses; });
      ['total', 'sobra', 'das', 'creditoComprador', 'irpjCsll'].forEach(c => { if (typeof r[c] === 'number') r[c] *= meses; });
      if (r.distribuicao) ['distribuidoMes', 'retidoMes', 'irpfmMes', 'totalComDistribuicao', 'liquidoSociosMes'].forEach(c => { r.distribuicao[c] *= meses; });
    });
    out.receitaPeriodo = R * meses;
    out.lucroPeriodo = antes * meses;

    out.ranking = ORDEM.filter(k => out.regimes[k].elegivel).sort((a, b) => out.regimes[b].sobra - out.regimes[a].sobra);

    /* ----- Comprador: crédito de CBS/IBS que ele aproveita (2027+) ----- */
    const toma = COMPRADOR_TOMA_CREDITO.includes(e.comprador);
    out.comprador = {
      tomaCredito: toma,
      linhas: reforma ? ORDEM.filter(k => out.regimes[k].elegivel).map(k => {
        const credito = toma ? (out.regimes[k].creditoComprador || 0) : 0;
        return {chave: k, nome: NOMES[k], pago: R * meses, credito, liquido: R * meses - credito};
      }) : []
    };
    return out;
  }

  // Resultado para todos os anos (para o slider e o PDF)
  function calcularTodosAnos(e) {
    const r = {};
    P.ANOS.forEach(a => { r[a] = calcular(Object.assign({}, e, {ano: a})); });
    return r;
  }

  // Subtotais por categoria de um regime
  function porCategoria(regime) {
    const s = {renda: 0, consumo: 0, folha: 0};
    (regime.tributos || []).forEach(t => { s[t.categoria] += t.valor; });
    return s;
  }

  return {calcular, calcularTodosAnos, porCategoria, aliquotasCbsIbs, NOMES, ORDEM, COMPRADOR_TOMA_CREDITO};
});
