/*
 * Operações com imóveis: venda e locação, por pessoa física e por empresa (Presumido, Real, Simples),
 * de 2026 a 2033. Renda (IRPF, IRPJ, CSLL) e consumo (PIS/COFINS até 2026; CBS/IBS de 2027 em diante,
 * com as reduções, o redutor de ajuste e o redutor social da LC 214/2025). Sem DOM.
 *
 * Entrada:
 *  {operacao: 'venda' | 'locacao', ano, meses, referencia: {cbs, ibs},
 *   venda: {valor, custo, aquisicao: {ano, mes}, mes, corretagem, tipo: 'residencial_novo' | 'residencial_usado' | 'lote' | 'comercial',
 *           itbiLaudemio, contrapartidas, unicoImovel, reinvestido, usouReinvestimento, natureza: 'estoque' | 'ativo', rbt12Simples},
 *   locacao: {aluguel, imoveis, residencial, temporada, despesas, outrasRendasMensais, descontoSimplificado, art487, finalidade487},
 *   pf: {locacaoAnoAnterior, imoveisLocadosAnoAnterior, vendasAnoAnterior, construidosAnoAnterior, vendasAnoCorrente, construidosAnoCorrente},
 *   pj: {despesas, socios: {quantidade, proLabore, outrasRendasAnuais, irOutrasRendas, aplicarNoSimples}}}
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica(require('./parametros.js'), require('./ipca.js'), require('./ganho-capital.js'),
      require('./renda-pf.js'), require('./simples.js'), require('./regimes.js'));
  } else {
    const M = raiz.Motor;
    raiz.Motor.imobiliario = fabrica(M.parametros, M.ipca, M.ganhoCapital, M.rendaPF, M.simples, M.regimes);
  }
})(typeof self !== 'undefined' ? self : this, function (P, IPCA, GC, PF, S, REG) {
  'use strict';

  const I = P.IMOBILIARIO;
  const NOMES = {
    pf: 'Pessoa física',
    pjPresumido: 'Empresa no Lucro Presumido',
    pjReal: 'Empresa no Lucro Real',
    pjSimples: 'Empresa no Simples',
    pjHibrido: 'Empresa no Simples Híbrido'
  };
  const ORDEM = ['pf', 'pjPresumido', 'pjReal', 'pjSimples', 'pjHibrido'];
  const CATEGORIA = {IRPF: 'renda', IRPJ: 'renda', CSLL: 'renda', PIS: 'consumo', COFINS: 'consumo', CBS: 'consumo', IBS: 'consumo', CPP: 'folha', ICMS: 'consumo', ISS: 'consumo', IPI: 'consumo', 'CBS/IBS (transição)': 'consumo'};
  const brl = v => v.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  const pct = v => (v * 100).toLocaleString('pt-BR', {maximumFractionDigits: 4}) + '%';
  const linha = (etapa, formula, valor, fundamento, codigo) => ({etapa, formula, valor, fundamento, codigo: codigo || null});
  const mesAnterior = d => d.mes === 1 ? {ano: d.ano - 1, mes: 12} : {ano: d.ano, mes: d.mes - 1};
  const fundTransicao = 'EC 132/2023, ADCT, arts. 125 a 129; LC 214/2025, arts. 343 a 348';

  function montar(chave, linhas, receita, resultadoAntes) {
    const tributos = [];
    linhas.forEach(l => {
      if (!l.codigo) return;
      const ex = tributos.find(t => t.codigo === l.codigo);
      if (ex) ex.valor += l.valor; else tributos.push({codigo: l.codigo, categoria: CATEGORIA[l.codigo] || 'consumo', valor: l.valor});
    });
    const total = tributos.reduce((s, t) => s + t.valor, 0);
    return {chave, nome: NOMES[chave], elegivel: true, tributos, memoria: linhas, total, receita,
      efetiva: receita > 0 ? total / receita : 0, resultado: resultadoAntes - total};
  }
  const inelegivel = (chave, motivo) => ({chave, nome: NOMES[chave], elegivel: false, motivo});

  // PF contribuinte do regime regular (LC 214, art. 251)
  function pfContribuinte(e, ano) {
    const pf = e.pf || {};
    const limite = I.pfLimiteLocacao * IPCA.fator(I.inicioCorrecao, {ano: ano - 1, mes: 12});
    const motivos = [];
    if (e.operacao === 'locacao') {
      if ((pf.locacaoAnoAnterior || 0) > limite && (pf.imoveisLocadosAnoAnterior || 0) > I.pfImoveisLocacao)
        motivos.push('no ano anterior, aluguéis acima de ' + brl(limite) + ' com mais de 3 imóveis (art. 251, § 1º, I)');
      const anual = (e.locacao.aluguel || 0) * 12;
      if (anual > limite * (1 + I.pfFolgaAnoCorrente))
        motivos.push('aluguéis do ano acima de ' + brl(limite * (1 + I.pfFolgaAnoCorrente)) + ' (art. 251, § 2º, II)');
    } else {
      if ((pf.vendasAnoAnterior || 0) > I.pfVendas) motivos.push('mais de 3 imóveis vendidos no ano anterior (art. 251, § 1º, II)');
      if ((pf.construidosAnoAnterior || 0) > I.pfConstruidos) motivos.push('mais de 1 imóvel construído vendido no ano anterior (art. 251, § 1º, III)');
      if ((pf.vendasAnoCorrente || 0) > I.pfVendas || (pf.construidosAnoCorrente || 0) > I.pfConstruidos) motivos.push('limite de vendas ultrapassado no próprio ano (art. 251, § 2º, I)');
    }
    return {sim: motivos.length > 0, motivos, limiteLocacao: limite};
  }

  // Redutor de ajuste: valor de aquisição + ITBI/laudêmio + contrapartidas, corrigidos pelo IPCA (arts. 257 e 258)
  function redutorAjuste(v, dataOperacao) {
    const ate = mesAnterior(dataOperacao);
    const de = v.aquisicao;
    const f = IPCA.fator(de, ate);
    const base = (v.custo || 0) + (v.itbiLaudemio || 0) + (v.contrapartidas || 0);
    return {valor: base * f, fator: f, base, antes1994: de.ano * 12 + de.mes < 1994 * 12 + 7};
  }
  function redutorSocialVenda(tipo, dataOperacao) {
    const nominal = tipo === 'residencial_novo' ? I.redutorSocialNovo : tipo === 'lote' ? I.redutorSocialLote : 0;
    return nominal * IPCA.fator(I.inicioCorrecao, mesAnterior(dataOperacao));
  }

  // CBS/IBS de uma operação com imóvel por contribuinte do regime regular
  function cbsIbsImovel(ctx) {
    const {ano, ali, operacao, valor, linhas, redutorAj, redutorSoc, loc} = ctx;
    if (ano < P.INICIO_OPCAO_FORA_DAS) {
      linhas.push(linha('CBS 0,9% e IBS 0,1% (teste)', 'apurados e compensados; custo zero em 2026', 0, fundTransicao));
      return;
    }
    if (operacao === 'locacao' && loc.art487 && (loc.finalidade487 !== 'residencial' || ano <= 2028)) {
      linhas.push(linha('CBS/IBS pelo regime de transição', brl(valor) + ' × 3,65%', valor * I.art487, 'LC 214/2025, art. 487 (contrato anterior a 16/01/2025)', 'CBS/IBS (transição)'));
      return;
    }
    let reducao = operacao === 'venda' ? I.reducaoVenda : I.reducaoLocacao;
    let social = redutorSoc || 0;
    let fundRed = operacao === 'venda' ? 'LC 214/2025, art. 261, caput' : 'LC 214/2025, art. 261, parágrafo único';
    if (operacao === 'locacao' && loc.temporada) { reducao = I.reducaoTemporada; social = 0; fundRed = 'LC 214/2025, art. 253 (regras de hotelaria); PREMISSA'; }
    let base = valor;
    if (operacao === 'venda' && redutorAj) {
      linhas.push(linha('(−) Redutor de ajuste', brl(redutorAj.base) + ' × IPCA acumulado ' + redutorAj.fator.toLocaleString('pt-BR', {maximumFractionDigits: 6}), -Math.min(base, redutorAj.valor), 'LC 214/2025, arts. 257 e 258'));
      base = Math.max(0, base - redutorAj.valor);
    }
    if (social > 0) {
      const usado = Math.min(base, social);
      linhas.push(linha('(−) Redutor social', operacao === 'venda' ? brl(social) + ' por imóvel (corrigido pelo IPCA)' : brl(social / Math.max(1, loc.imoveis || 1)) + ' por mês × ' + (loc.imoveis || 1) + ' imóvel(is)', -usado, operacao === 'venda' ? 'LC 214/2025, art. 259' : 'LC 214/2025, art. 260'));
      base -= usado;
    }
    const aCbs = ali.cbs * (1 - reducao), aIbs = ali.ibs * (1 - reducao);
    linhas.push(linha('Base de CBS/IBS', 'valor − redutores', base, 'LC 214/2025, art. 255'));
    linhas.push(linha('CBS', brl(base) + ' × ' + pct(ali.cbs) + ' × (1 − ' + pct(reducao) + ')', base * aCbs, fundRed, 'CBS'));
    linhas.push(linha('IBS', brl(base) + ' × ' + pct(ali.ibs) + ' × (1 − ' + pct(reducao) + ')', base * aIbs, fundRed, 'IBS'));
  }

  function irpjPresumido(linhas, receitaBase, presIR, presCS, limiteAdicional, ano, rotulo) {
    const anual = receitaBase * (limiteAdicional === 60000 ? 1 : 12);
    const frac = anual > P.LC224.limiteAnual ? 1 - P.LC224.limiteAnual / anual : 0;
    const pIR = presIR * (1 + P.LC224.acrescimo * frac);
    const pCS = presCS * (1 + P.LC224.acrescimo * frac);
    if (frac > 0) linhas.push(linha('Acréscimo da LC 224/2025', '+10% na presunção sobre a receita acima de R$ 5 mi no ano', frac, 'LC 224/2025, art. 4º, § 4º, VII e § 5º'));
    const baseIR = receitaBase * pIR;
    const irpj = 0.15 * baseIR, adic = 0.10 * Math.max(0, baseIR - limiteAdicional), csll = 0.09 * receitaBase * pCS;
    linhas.push(linha('IRPJ 15%', brl(receitaBase) + ' × presunção ' + pct(pIR) + ' × 15%', irpj, 'Lei 9.249/1995, arts. 3º e 15', 'IRPJ'));
    linhas.push(linha('IRPJ adicional 10%', '(' + brl(baseIR) + ' − ' + brl(limiteAdicional) + ') × 10%' + rotulo, adic, 'Lei 9.249/1995, art. 3º, § 1º', 'IRPJ'));
    linhas.push(linha('CSLL 9%', brl(receitaBase) + ' × presunção ' + pct(pCS) + ' × 9%', csll, 'Lei 9.249/1995, art. 20', 'CSLL'));
    return irpj + adic + csll;
  }
  function irpjLucro(linhas, lucro, limiteAdicional, rotulo, fundLucro) {
    linhas.push(linha('Lucro tributável', fundLucro.formula, lucro, fundLucro.fundamento));
    const irpj = lucro > 0 ? 0.15 * lucro : 0;
    const adic = lucro > 0 ? 0.10 * Math.max(0, lucro - limiteAdicional) : 0;
    const csll = lucro > 0 ? 0.09 * lucro : 0;
    linhas.push(linha('IRPJ 15%', brl(Math.max(0, lucro)) + ' × 15%', irpj, 'Lei 9.249/1995, art. 3º', 'IRPJ'));
    linhas.push(linha('IRPJ adicional 10%', '(lucro − ' + brl(limiteAdicional) + ') × 10%' + rotulo, adic, 'Lei 9.249/1995, art. 3º, § 1º', 'IRPJ'));
    linhas.push(linha('CSLL 9%', brl(Math.max(0, lucro)) + ' × 9%', csll, 'Lei 7.689/1988, art. 3º', 'CSLL'));
    if (lucro < 0) linhas.push(linha('Prejuízo fiscal', 'compensável em períodos seguintes, até 30% do lucro de cada período', lucro, 'Lei 9.065/1995, art. 15'));
    return irpj + adic + csll;
  }

  function calcularVenda(e, out) {
    const ano = out.ano, ali = out.aliquotas;
    const v = e.venda;
    const valor = Math.max(0, v.valor || 0);
    const data = {ano, mes: v.mes || 6};
    const corretagem = Math.max(0, v.corretagem || 0);
    const custo = Math.max(0, v.custo || 0);
    const rAj = redutorAjuste(v, data);
    const rSoc = redutorSocialVenda(v.tipo, data);
    out.redutores = {ajuste: rAj, social: rSoc};
    const reforma = ano >= P.INICIO_OPCAO_FORA_DAS;
    const pfc = pfContribuinte(e, ano);
    out.pfContribuinte = pfc;
    const resultadoAntes = valor - corretagem - custo;

    /* Pessoa física */
    const lf = [];
    const gc = GC.calcular({valorVenda: valor - corretagem, custoAquisicao: custo, aquisicao: v.aquisicao, venda: data});
    lf.push(linha('Valor de venda − corretagem', brl(valor) + ' − ' + brl(corretagem), valor - corretagem, 'IN SRF 84/2001, art. 19'));
    gc.memoria.slice(0, 5).forEach(l => lf.push(linha(l.etapa, l.formula, l.valor, l.fundamento)));
    let ir = gc.imposto, notaIsencao = '';
    if (v.unicoImovel && valor <= I.isencaoUnicoImovel) { ir = 0; notaIsencao = 'isento: único imóvel até R$ 440 mil, sem outra venda em 5 anos (Lei 9.250/1995, art. 23)'; }
    else if ((v.tipo === 'residencial_novo' || v.tipo === 'residencial_usado') && v.reinvestido > 0 && !v.usouReinvestimento) {
      const fr = Math.min(1, v.reinvestido / valor);
      ir = gc.imposto * (1 - fr);
      notaIsencao = pct(fr) + ' do ganho isento por reinvestimento em imóvel residencial em 180 dias (Lei 11.196/2005, art. 39)';
    }
    lf.push(linha('IRPF sobre o ganho de capital', notaIsencao || 'alíquotas de 15% a 22,5% por faixa de ganho', ir, notaIsencao ? 'Lei 9.250/1995, art. 23; Lei 11.196/2005, art. 39' : 'Lei 8.981/1995, art. 21', 'IRPF'));
    if (pfc.sim) cbsIbsImovel({ano, ali, operacao: 'venda', valor, linhas: lf, redutorAj: rAj, redutorSoc: rSoc});
    else lf.push(linha('CBS/IBS', 'não contribuinte: abaixo dos limites do art. 251', 0, 'LC 214/2025, art. 251'));
    out.perfis.pf = montar('pf', lf, valor, resultadoAntes);
    out.perfis.pf.gc = gc;

    /* Empresa: Presumido */
    const estoque = v.natureza !== 'ativo';
    const lp = [];
    if (estoque) {
      irpjPresumido(lp, valor, I.presuncaoVenda.irpj, I.presuncaoVenda.csll, 60000, ano, ' (limite do trimestre)');
      if (!reforma) {
        lp.push(linha('PIS 0,65%', brl(valor) + ' × 0,65%', valor * 0.0065, 'Lei 9.715/1998 (receita de venda de imóvel de estoque)', 'PIS'));
        lp.push(linha('COFINS 3%', brl(valor) + ' × 3%', valor * 0.03, 'Lei 9.718/1998, art. 8º', 'COFINS'));
      }
    } else {
      const ganho = valor - custo;
      lp.push(linha('Ganho de capital (ativo)', brl(valor) + ' − ' + brl(custo), ganho, 'Lei 9.430/1996, art. 25, II'));
      irpjLucro(lp, ganho, 60000, ' (limite do trimestre)', {formula: 'ganho somado à base do trimestre', fundamento: 'Lei 9.430/1996, art. 25, II'});
      if (!reforma) lp.push(linha('PIS/COFINS', 'não incidem na venda de bem do ativo', 0, 'Lei 9.718/1998, art. 3º, § 2º, IV'));
    }
    cbsIbsImovel({ano, ali, operacao: 'venda', valor, linhas: lp, redutorAj: rAj, redutorSoc: rSoc});
    out.perfis.pjPresumido = montar('pjPresumido', lp, valor, resultadoAntes);

    /* Empresa: Real */
    const lr = [];
    let pc = 0;
    if (!reforma && estoque) {
      pc = valor * 0.0925;
      lr.push(linha('PIS 1,65%', brl(valor) + ' × 1,65% (sem créditos)', valor * 0.0165, 'Lei 10.637/2002; PREMISSA: sem créditos', 'PIS'));
      lr.push(linha('COFINS 7,6%', brl(valor) + ' × 7,6% (sem créditos)', valor * 0.076, 'Lei 10.833/2003; PREMISSA: sem créditos', 'COFINS'));
    }
    const despPJ = Math.max(0, (e.pj && e.pj.despesas) || 0);
    const lucroR = valor - custo - corretagem - despPJ - pc;
    irpjLucro(lr, lucroR, 60000, ' (limite do trimestre)', {formula: 'venda − custo − corretagem − despesas' + (pc ? ' − PIS/COFINS' : ''), fundamento: 'Decreto-Lei 1.598/1977, art. 6º'});
    cbsIbsImovel({ano, ali, operacao: 'venda', valor, linhas: lr, redutorAj: rAj, redutorSoc: rSoc});
    out.perfis.pjReal = montar('pjReal', lr, valor, resultadoAntes - despPJ);

    /* Empresa: Simples (Anexo I para compra e venda de imóveis próprios; ganho de capital fora do DAS para o ativo) */
    const rbt12 = Math.max(valor, v.rbt12Simples || 0);
    if (!estoque) {
      const ls = [];
      const ganho = Math.max(0, valor - custo);
      const irGc = GC.impostoPorFaixa(ganho);
      ls.push(linha('Ganho de capital (ativo)', brl(valor) + ' − ' + brl(custo), ganho, 'Lei 13.259/2016, art. 2º'));
      ls.push(linha('IR sobre o ganho, fora do DAS', '15% a 22,5% por faixa de ganho', irGc, 'Lei 13.259/2016, art. 2º; LC 123/2006, art. 13, § 1º, VI', 'IRPJ'));
      ls.push(linha('CBS/IBS', 'PREMISSA: venda do ativo fora do DAS sem CBS/IBS; confirmar', 0, 'LC 214/2025, art. 251'));
      out.perfis.pjSimples = montar('pjSimples', ls, valor, resultadoAntes);
      out.perfis.pjHibrido = inelegivel('pjHibrido', 'para imóvel do ativo, use a empresa no Simples');
    } else if (rbt12 > P.LIMITE_SIMPLES) {
      out.perfis.pjSimples = inelegivel('pjSimples', 'faturamento de 12 meses acima de R$ 4,8 milhões');
      out.perfis.pjHibrido = inelegivel('pjHibrido', 'faturamento de 12 meses acima de R$ 4,8 milhões');
    } else {
      const efe = S.aliquotaEfetiva(rbt12, 'comercio', ano);
      const fatias = S.partilha('comercio', efe.indice, ano);
      const ls = [
        linha('Receita de 12 meses (RBT12)', 'informada, incluindo a venda', rbt12, 'LC 123/2006, art. 18, § 1º'),
        linha('Alíquota efetiva (Anexo I, ' + efe.faixa + 'ª faixa)', '(RBT12 × ' + pct(efe.nominal) + ' − ' + brl(efe.deducao) + ') ÷ RBT12', efe.efetiva, 'Solução de Consulta Cosit nº 39/2017; LC 123/2006, art. 18, § 4º, I'),
        linha('DAS sobre a venda', brl(valor) + ' × ' + pct(efe.efetiva), valor * efe.efetiva, 'LC 123/2006, art. 18')
      ];
      S.repartirDas(valor * efe.efetiva, valor, fatias).forEach(p => ls.push(linha('  ' + p.codigo + ' dentro do DAS', 'DAS × ' + p.fatia.toLocaleString('pt-BR', {maximumFractionDigits: 2}) + '%', p.valor, 'Partilha do DAS', p.codigo)));
      out.perfis.pjSimples = montar('pjSimples', ls, valor, resultadoAntes);
      if (!reforma) out.perfis.pjHibrido = inelegivel('pjHibrido', 'opção existe a partir de 2027 (LC 214/2025, art. 41, § 3º)');
      else {
        const semCbsIbs = Object.assign({}, fatias);
        const tirada = (semCbsIbs.cbs || 0) + (semCbsIbs.ibs || 0);
        delete semCbsIbs.cbs; delete semCbsIbs.ibs;
        const lh = [ls[0], ls[1], linha('DAS sem a fatia de CBS/IBS', brl(valor) + ' × ' + pct(efe.efetiva) + ' × (1 − ' + tirada.toLocaleString('pt-BR', {maximumFractionDigits: 2}) + '%)', valor * efe.efetiva * (1 - tirada / 100), 'LC 214/2025, art. 41, § 3º')];
        S.repartirDas(valor * efe.efetiva, valor, semCbsIbs).forEach(p => lh.push(linha('  ' + p.codigo + ' dentro do DAS', 'DAS × ' + p.fatia.toLocaleString('pt-BR', {maximumFractionDigits: 2}) + '%', p.valor, 'Partilha do DAS', p.codigo)));
        cbsIbsImovel({ano, ali, operacao: 'venda', valor, linhas: lh, redutorAj: rAj, redutorSoc: rSoc});
        out.perfis.pjHibrido = montar('pjHibrido', lh, valor, resultadoAntes);
      }
    }
    out.resultadoAntes = resultadoAntes;
    out.mesesDistribuicao = 1;
  }

  function calcularLocacao(e, out) {
    const ano = out.ano, ali = out.aliquotas;
    const L = e.locacao;
    const A = Math.max(0, L.aluguel || 0);
    const D = Math.max(0, L.despesas || 0);
    const nImoveis = Math.max(1, Math.round(L.imoveis || 1));
    const data = {ano, mes: 1};
    const social = (L.residencial && !L.temporada) ? I.redutorSocialLocacaoMes * nImoveis * IPCA.fator(I.inicioCorrecao, mesAnterior(data)) : 0;
    out.redutores = {social};
    const reforma = ano >= P.INICIO_OPCAO_FORA_DAS;
    const pfc = pfContribuinte(e, ano);
    out.pfContribuinte = pfc;

    /* Pessoa física: carnê-leão (marginal sobre outras rendas) */
    const lf = [];
    const rend = Math.max(0, A - D);
    const outras = Math.max(0, L.outrasRendasMensais || 0);
    const usarSimpl = !!L.descontoSimplificado;
    const comAluguel = PF.irpfMensal(outras + rend, 0, usarSimpl);
    const semAluguel = PF.irpfMensal(outras, 0, usarSimpl);
    const irAluguel = Math.max(0, comAluguel.imposto - semAluguel.imposto);
    lf.push(linha('Aluguel tributável', brl(A) + ' − despesas pagas pelo locador ' + brl(D), rend, 'Lei 7.739/1989, art. 14'));
    lf.push(linha('IRPF com o aluguel', 'tabela mensal 2026 sobre ' + brl(outras + rend) + (usarSimpl ? ' (com desconto simplificado)' : '') + ', menos a redução da Lei 15.270', comAluguel.imposto, 'Lei 9.250/1995, arts. 3º-A e 4º; Lei 15.270/2025'));
    if (outras > 0) lf.push(linha('(−) IRPF sem o aluguel', 'mesmo cálculo só com as outras rendas de ' + brl(outras), -semAluguel.imposto, 'Imposto que já seria devido'));
    lf.push(linha('IRPF do aluguel (carnê-leão e ajuste)', 'diferença atribuível ao aluguel', irAluguel, 'Lei 7.713/1988, art. 8º', 'IRPF'));
    if (pfc.sim) cbsIbsImovel({ano, ali, operacao: 'locacao', valor: A, linhas: lf, redutorSoc: social, loc: L});
    else lf.push(linha('CBS/IBS', 'não contribuinte: abaixo dos limites do art. 251', 0, 'LC 214/2025, art. 251'));
    out.perfis.pf = montar('pf', lf, A, A - D);

    /* Empresa: Presumido */
    const lp = [];
    irpjPresumido(lp, A, I.presuncaoLocacao.irpj, I.presuncaoLocacao.csll, 20000, ano, ' (limite do mês)');
    if (!reforma) {
      lp.push(linha('PIS 0,65%', brl(A) + ' × 0,65%', A * 0.0065, 'Lei 9.715/1998', 'PIS'));
      lp.push(linha('COFINS 3%', brl(A) + ' × 3%', A * 0.03, 'Lei 9.718/1998, art. 8º', 'COFINS'));
    }
    cbsIbsImovel({ano, ali, operacao: 'locacao', valor: A, linhas: lp, redutorSoc: social, loc: L});
    const despPJ = Math.max(0, (e.pj && e.pj.despesas) || 0);
    out.perfis.pjPresumido = montar('pjPresumido', lp, A, A - D - despPJ);

    /* Empresa: Real */
    const lr = [];
    let pc = 0;
    if (!reforma) {
      pc = A * 0.0925;
      lr.push(linha('PIS 1,65%', brl(A) + ' × 1,65% (sem créditos)', A * 0.0165, 'Lei 10.637/2002; PREMISSA: sem créditos', 'PIS'));
      lr.push(linha('COFINS 7,6%', brl(A) + ' × 7,6% (sem créditos)', A * 0.076, 'Lei 10.833/2003; PREMISSA: sem créditos', 'COFINS'));
    }
    irpjLucro(lr, A - D - despPJ - pc, 20000, ' (limite do mês)', {formula: 'aluguel − despesas' + (pc ? ' − PIS/COFINS' : ''), fundamento: 'Decreto-Lei 1.598/1977, art. 6º; PREMISSA: sem depreciação'});
    cbsIbsImovel({ano, ali, operacao: 'locacao', valor: A, linhas: lr, redutorSoc: social, loc: L});
    out.perfis.pjReal = montar('pjReal', lr, A, A - D - despPJ);

    out.perfis.pjSimples = inelegivel('pjSimples', 'locação de imóveis próprios é vedada no Simples (LC 123/2006, art. 17, XV)');
    out.perfis.pjHibrido = inelegivel('pjHibrido', 'locação de imóveis próprios é vedada no Simples (LC 123/2006, art. 17, XV)');
    out.resultadoAntes = A - D;
    out.mesesDistribuicao = 12;
  }

  function calcular(e) {
    const ano = e.ano || 2026;
    const out = {ano, operacao: e.operacao, aliquotas: REG.aliquotasCbsIbs(ano, e.referencia), perfis: {}};
    if (e.operacao === 'locacao') calcularLocacao(e, out); else calcularVenda(e, out);

    // Custo de levar o lucro da empresa ao sócio (Lei 15.270/2025)
    const so = (e.pj && e.pj.socios) || {};
    const qtd = Math.max(1, Math.round(so.quantidade || 1));
    ORDEM.forEach(k => {
      const r = out.perfis[k];
      if (!r.elegivel) return;
      if (k === 'pf') { r.noBolso = r.resultado; return; }
      const disponivel = Math.max(0, r.resultado);
      const renda = r.tributos.filter(t => t.categoria === 'renda').reduce((s, t) => s + t.valor, 0);
      const consumo = r.total - renda;
      const isento = (k === 'pjSimples' || k === 'pjHibrido') && so.aplicarNoSimples === false;
      const d = PF.custoDistribuicao({
        dividendosMes: disponivel / qtd, mesesPagamento: out.mesesDistribuicao,
        proLabore: so.proLabore || 0, outrasRendasAnuais: so.outrasRendasAnuais || 0, irOutrasRendas: so.irOutrasRendas || 0,
        irpjCsllAnualPJ: renda * out.mesesDistribuicao, lucroContabilAnualPJ: (out.resultadoAntes - consumo) * out.mesesDistribuicao
      });
      const custo = isento ? 0 : d.custoDividendosAno * qtd / out.mesesDistribuicao;
      r.distribuicao = {isento, porSocio: d, retido: isento ? 0 : d.retidoMes * qtd, irSocio: custo, distribuido: disponivel};
      r.noBolso = disponivel - custo;
    });

    // Período (só locação; a venda é um evento único)
    const meses = e.operacao === 'locacao' ? (e.meses || 1) : 1;
    out.meses = meses;
    ORDEM.forEach(k => {
      const r = out.perfis[k];
      if (!r.elegivel || meses === 1) return;
      r.tributos.forEach(t => { t.valor *= meses; });
      r.memoria.forEach(l => { if (!/^(Acréscimo|Alíquota)/.test(l.etapa)) l.valor *= meses; });
      ['total', 'receita', 'resultado', 'noBolso'].forEach(c => { r[c] *= meses; });
      if (r.distribuicao) ['retido', 'irSocio', 'distribuido'].forEach(c => { r.distribuicao[c] *= meses; });
    });
    out.ranking = ORDEM.filter(k => out.perfis[k].elegivel).sort((a, b) => out.perfis[b].noBolso - out.perfis[a].noBolso);
    return out;
  }

  function insights(res, e) {
    const it = [];
    const R = res.perfis;
    const b = res.ranking.length ? R[res.ranking[0]] : null;
    if (b && res.ranking.length > 1) {
      const s = R[res.ranking[1]];
      it.push({tipo: 'ok', texto: b.nome + ' deixa ' + brl(b.noBolso - s.noBolso) + ' a mais no bolso do proprietário do que ' + s.nome + ', já com o IR sobre a distribuição.'});
    }
    const pfc = res.pfContribuinte;
    if (pfc) it.push(pfc.sim
      ? {tipo: 'alerta', texto: 'A pessoa física é contribuinte de CBS/IBS: ' + pfc.motivos.join('; ') + '.'}
      : {tipo: 'info', texto: 'A pessoa física não é contribuinte de CBS/IBS nesta operação (abaixo dos limites do art. 251 da LC 214).'});
    if (res.ano === 2026) it.push({tipo: 'info', texto: 'Em 2026 a CBS e o IBS são de teste, sem custo. Arraste o ano para ver 2027 em diante.'});
    if (e.operacao === 'venda') {
      const v = e.venda;
      if (v.aquisicao.ano <= 1988) it.push({tipo: 'info', texto: 'Imóvel adquirido até 1988: a redução do art. 18 da Lei 7.713 diminui o ganho uma única vez, e não o imposto de novo.'});
      if (!v.unicoImovel && v.valor <= I.isencaoUnicoImovel) it.push({tipo: 'info', texto: 'Venda até R$ 440 mil: se for o único imóvel e não houve outra venda em 5 anos, o ganho é isento.'});
      if (res.redutores && res.redutores.ajuste && res.redutores.ajuste.antes1994) it.push({tipo: 'alerta', texto: 'Aquisição anterior a julho de 1994: o redutor de ajuste foi corrigido a partir de 07/1994 sobre o custo em reais. Avalie usar o valor de referência (art. 258, I, b).'});
      if (v.natureza !== 'ativo') it.push({tipo: 'info', texto: 'Empresa tratada como imobiliária (imóvel de estoque). Se o imóvel for do ativo de uma empresa de outra atividade, troque na etapa 3.'});
    } else {
      const L = e.locacao;
      if (L.art487 && L.finalidade487 === 'residencial' && res.ano > 2028) it.push({tipo: 'alerta', texto: 'O regime de 3,65% para contrato residencial antigo só vale até 31/12/2028; a partir de 2029 o cálculo volta à regra geral.'});
      if (!L.descontoSimplificado) it.push({tipo: 'info', texto: 'Carnê-leão calculado sem o desconto simplificado mensal (lado conservador). Marque a opção se o seu contador usa.'});
    }
    return it;
  }

  return {calcular, insights, pfContribuinte, redutorAjuste, NOMES, ORDEM};
});
