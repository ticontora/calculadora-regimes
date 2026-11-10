/* Módulo ITBI — Controller & Oraculu's. Regras conferidas em 05/11/2026.
 * Regras nacionais: CF, art. 156, II e parágrafo 2º, I; CTN, arts. 35 a 38 (art. 38 com redação da LC 227/2026);
 * STJ, Tema 1.113 (base = valor da transação declarado; valor de referência unilateral não pode ser imposto previamente);
 * STF, Tema 796 (imunidade limitada ao valor destinado ao capital) e Tema 1.348 (julgado em 19/10/2026: imunidade
 * na integralização vale ainda que a atividade preponderante seja imobiliária).
 * Municípios: só os conferidos em fonte oficial. Para os demais, o usuário informa as alíquotas.
 * Sem DOM: roda no navegador e no Node. */
(function (raiz) {
  'use strict';

  const MUNICIPIOS = {
    guarulhos: {nome: 'Guarulhos/SP', aliquota: .03, sfh: null, fonte: 'Lei Municipal 8.425/2025, art. 10 (alíquota única de 3%)',
      nota: 'Lei 8.425/2025 trata a integralização como não incidência limitada ao valor do aumento de capital (art. 3º, III) e ainda prevê a regra de atividade preponderante (art. 4º), superada pelo Tema 1.348 do STF.'},
    saopaulo: {nome: 'São Paulo/SP', aliquota: .03, sfh: {aliquota: .005, limiteFinanciado: 120968, limiteImovel: 725808}, fonte: 'Lei 11.154/1991 e Decreto 55.196/2014; limites de 2026 da SF/SP',
      nota: 'SFH, PAR, HIS e consórcio: 0,5% sobre o financiado até R$ 120.968, para imóvel de até R$ 725.808; acima disso, 3%. SFI e carteira hipotecária: 3%. Isenção de primeira aquisição: valor de referência de R$ 245.527,77 em 2026 (conferir requisitos).'},
    sjc: {nome: 'São José dos Campos/SP', aliquota: .02, sfh: {aliquota: .005, limiteFinanciado: Infinity, limiteImovel: Infinity}, fonte: 'LC Municipal 696/2025 e Prefeitura de São José dos Campos (serviço ITBI)',
      nota: 'SFH: 0,5% sobre a parte financiada e 2% sobre o restante.'},
    outro: {nome: 'Outro município (informar alíquotas)', aliquota: .02, sfh: null, fonte: 'Lei municipal informada pelo usuário', nota: 'Confira a lei municipal: alíquota geral, redução para SFH/HIS, isenções e limites do ano.'}
  };

  const brl = v => (v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2});

  function municipio(e) {
    const base = MUNICIPIOS[e.municipio] || MUNICIPIOS.outro;
    if (e.municipio !== 'outro') return base;
    const sfh = (+e.aliqSfh > 0) ? {aliquota: +e.aliqSfh, limiteFinanciado: +e.limFinSfh || Infinity, limiteImovel: +e.limImovelSfh || Infinity} : null;
    return Object.assign({}, base, {nome: e.nomeMunicipio ? e.nomeMunicipio : base.nome, aliquota: +e.aliquota || 0, sfh});
  }

  // Compra e venda, dação, arrematação e demais transmissões onerosas
  function compra(e) {
    const m = municipio(e);
    const declarado = Math.max(0, +e.valorDeclarado || 0);
    const referencia = Math.max(0, +e.valorReferencia || 0);
    const financiado = Math.max(0, +e.financiadoSfh || 0);
    function calc(base) {
      let reduzida = 0, faixaReduzida = 0;
      if (m.sfh && financiado > 0 && base <= m.sfh.limiteImovel) {
        faixaReduzida = Math.min(financiado, m.sfh.limiteFinanciado, base);
        reduzida = faixaReduzida * m.sfh.aliquota;
      }
      const restante = base - faixaReduzida;
      return {base, faixaReduzida, reduzida, restante, normal: restante * m.aliquota, total: reduzida + restante * m.aliquota};
    }
    const a = calc(declarado);
    const memoria = [
      'Base de cálculo: valor da transação declarado, ' + brl(declarado) + ' (STJ, Tema 1.113; CTN, art. 38, com a redação da LC 227/2026).',
      a.faixaReduzida ? 'Parte financiada pelo SFH: ' + brl(a.faixaReduzida) + ' × ' + (m.sfh.aliquota * 100).toFixed(2).replace('.', ',') + '% = ' + brl(a.reduzida) + '.' : null,
      'Restante: ' + brl(a.restante) + ' × ' + (m.aliquota * 100).toFixed(2).replace('.', ',') + '% = ' + brl(a.normal) + '.',
      'ITBI: ' + brl(a.total) + '. Município: ' + m.nome + ' (' + m.fonte + ').'
    ].filter(Boolean);
    const out = {tipo: 'compra', municipio: m, devido: a, memoria, avisos: []};
    if (referencia > declarado) {
      const b = calc(referencia);
      out.cenarioPrefeitura = b;
      out.avisos.push('Se a prefeitura exigir o valor de referência (' + brl(referencia) + '), o ITBI sobe para ' + brl(b.total) + ' (+' + brl(b.total - a.total) + '). Pelo Tema 1.113 do STJ o valor declarado prevalece, e o TJSP tem decidido que a LC 227/2026 não autoriza adotar o valor de referência sem processo administrativo próprio. Contestar judicialmente é ato privativo de advogado.');
    }
    if (m.nota) out.avisos.push(m.nota);
    return out;
  }

  // Integralização de capital com imóveis (holding, conferência de bens)
  // e.imoveis: [{descricao, valorCapital (valor atribuído ao capital), valorTransferido (valor pelo qual entra no patrimônio da PJ), valorMercado}]
  function integralizacao(e) {
    const m = municipio(e);
    const linhas = (e.imoveis || []).filter(i => (+i.valorCapital || 0) || (+i.valorTransferido || 0) || (+i.valorMercado || 0)).map(i => {
      const cap = Math.max(0, +i.valorCapital || 0);
      const transf = Math.max(cap, +i.valorTransferido || cap);
      const merc = Math.max(0, +i.valorMercado || 0);
      const excContrib = Math.max(0, transf - cap);           // Tema 796: excesso sobre o capital (ex.: reserva de capital)
      const excFisco = Math.max(0, Math.max(merc, transf) - cap); // posição de prefeituras: diferença para o valor de mercado
      return {descricao: i.descricao || 'Imóvel', cap, transf, merc, excContrib, excFisco, itbiContrib: excContrib * m.aliquota, itbiFisco: excFisco * m.aliquota};
    });
    const soma = k => linhas.reduce((s, l) => s + l[k], 0);
    const out = {tipo: 'integralizacao', municipio: m, linhas,
      totais: {cap: soma('cap'), transf: soma('transf'), merc: soma('merc'), itbiContrib: soma('itbiContrib'), itbiFisco: soma('itbiFisco')},
      avisos: [], memoria: []};
    out.memoria.push('Imunidade da integralização: CF, art. 156, parágrafo 2º, I. Tema 1.348 do STF (19/10/2026): vale mesmo se a atividade preponderante for compra, venda ou locação de imóveis.');
    out.memoria.push('Limite (Tema 796 do STF): o valor que exceder o destinado ao capital social é tributável. Cenário 1 (tese do contribuinte): só o que entra no patrimônio acima do capital subscrito, como reserva de capital. Cenário 2 (prática de prefeituras): diferença entre o valor de mercado ou de referência e o valor integralizado.');
    out.memoria.push('Alíquota de ' + m.nome + ': ' + (m.aliquota * 100).toFixed(2).replace('.', ',') + '% (' + m.fonte + ').');
    if (out.totais.itbiFisco > out.totais.itbiContrib) out.avisos.push('Diferença entre os cenários: ' + brl(out.totais.itbiFisco - out.totais.itbiContrib) + '. Integralizar pelo valor de mercado (capital igual ao valor transferido) elimina o excesso, mas pode gerar ganho de capital para o sócio pessoa física (Lei 9.249/1995, art. 23). Avaliar em conjunto com o estudo de holding.');
    out.avisos.push('O Tema 1.348 não teve modulação de efeitos até o julgamento. Quem pagou ITBI nos últimos 5 anos pode avaliar a restituição; o pedido judicial é ato privativo de advogado.');
    if (e.municipio === 'guarulhos') out.avisos.push(m.nota);
    return out;
  }


  // Custas de cartório — São Paulo, tabelas de 2026 (Lei Estadual 11.331/2002, valores em UFESP 2026 = R$ 38,42).
  // Cada faixa: [valor até, parcela do tabelião/oficial (base do ISS), total sem ISS]. "null" = acima da última faixa.
  // Fontes: CNB/SP, Tabela 1 (escrituras com valor declarado), e ARISP, Tabela II, item 1 (registro com valor declarado), vigentes desde 08/01/2026.
  const CUSTAS = {SP2026: {
    nome: 'São Paulo — tabelas de 2026 (Lei 11.331/2002)',
    notas: [[1524, 212.51, 352.36], [5761, 317.59, 526.56], [9603, 495.89, 822.17], [19210, 708.41, 1174.53], [38420, 957.54, 1587.61], [76840, 1135.9, 1883.31], [115260, 1348.42, 2235.66], [153680, 1597.56, 2648.74], [192100, 1810.12, 3001.18], [230520, 2025.08, 3357.55], [268940, 2271.77, 3766.61], [307360, 2486.77, 4123.06], [330146, 2735.91, 4536.14], [384200, 2911.79, 4827.74], [768400, 3231.8, 5358.31], [1152600, 3588.44, 5949.62], [1536800, 3979.28, 6597.64], [2345066, 4397.0, 7290.22], [3908444, 6106.97, 10125.35], [5862665, 7939.03, 13162.9], [7816887, 9771.13, 16200.53], [9771109, 11603.2, 19238.09], [11725331, 13435.25, 22275.64], [13679552, 15267.37, 25313.27], [15633774, 17099.42, 28350.83], [17587996, 18931.51, 31388.43], [19542217, 20763.64, 34426.1], [23450661, 24427.8, 40501.28], [27359105, 28091.94, 46576.43], [31267548, 31756.12, 52651.62], [35175992, 35420.24, 58726.76], [null, 39084.46, 64802.03]],
    registro: [[2306, 156.07, 257.2], [5761, 250.43, 412.72], [9603, 449.28, 740.42], [19210, 666.61, 1098.57], [38420, 810.44, 1335.6], [115260, 903.8, 1489.46], [192100, 1153.58, 1901.09], [230520, 1402.84, 2311.88], [268940, 1527.22, 2516.87], [307360, 1652.32, 2723.02], [345780, 1741.87, 2870.61], [384200, 1787.28, 2945.43], [768400, 1992.82, 3284.18], [1152600, 2333.8, 3846.1], [1536800, 2686.76, 4427.79], [1921000, 3039.77, 5009.53], [2305200, 3222.27, 5310.3], [3842000, 4134.74, 6814.06], [5763000, 5777.19, 9520.82], [7684000, 7602.14, 12528.33], [9605000, 9427.09, 15535.85], [11526000, 11252.04, 18543.37], [13447000, 13076.99, 21550.88], [15368000, 14901.94, 24558.39], [17289000, 16726.89, 27565.91], [19210000, 18551.84, 30573.43], [23052000, 21289.27, 35084.71], [26894000, 24939.17, 41099.74], [30736000, 28589.07, 47114.79], [34578000, 32238.97, 53129.83], [38420000, 35888.87, 59144.87], [42262000, 39538.77, 65159.9], [46104000, 43188.67, 71174.94], [49946000, 46838.57, 77189.96], [53788000, 50488.47, 83205.0], [57630000, 54138.37, 89220.04], [65314000, 59613.22, 98242.59], [72998000, 66913.02, 110272.66], [80682000, 74212.82, 122302.74], [88366000, 81512.62, 134332.81], [96050000, 88812.42, 146362.88], [103734000, 96112.22, 158392.94], [111418000, 103412.02, 170423.02], [119102000, 110711.82, 182453.09], [126786000, 118011.62, 194483.15], [134470000, 125311.42, 206513.23], [142154000, 132611.22, 218543.3], [null, 140336.23, 231274.12]],
    fonte: 'CNB/SP, Tabela de Notas 2026, item 1 (escritura com valor declarado); ARISP, Tabela de Registro de Imóveis 2026, Tabela II, item 1 (registro com valor declarado). Valores sem ISS.'
  }};

  function faixa(tab, v) {
    for (const f of tab) if (f[0] === null || v <= f[0]) return {ate: f[0], parcela: f[1], total: f[2]};
    const u = tab[tab.length - 1]; return {ate: null, parcela: u[1], total: u[2]};
  }

  // e: {tabela:'SP2026'|'manual', valorTitulo, valorVenal, escritura (bool), registros (nº de atos com valor), issPct (fração),
  //     garantia (valor do financiamento com alienação fiduciária/hipoteca, registrado à parte), certidoes (R$), manualEscritura, manualRegistro,
  //     imoveis: [{descricao, valorTitulo, valorVenal}] — quando houver vários registros (integralização, reorganização)}
  function custas(e) {
    const iss = Math.max(0, +e.issPct || 0);
    const itens = [], avisos = [];
    const lista = (e.imoveis && e.imoveis.length) ? e.imoveis : [{descricao: 'Imóvel', valorTitulo: e.valorTitulo, valorVenal: e.valorVenal}];
    const base = i => Math.max(+i.valorTitulo || 0, +i.valorVenal || 0);
    if (e.tabela === 'manual') {
      if (e.escritura) itens.push({ato: 'Escritura (valor informado)', base: 0, emolumentos: +e.manualEscritura || 0, iss: 0, total: +e.manualEscritura || 0});
      lista.forEach(i => itens.push({ato: 'Registro — ' + (i.descricao || 'imóvel') + ' (valor informado)', base: base(i), emolumentos: +e.manualRegistro || 0, iss: 0, total: +e.manualRegistro || 0}));
      avisos.push('Valores de custas informados pelo usuário. Peça o orçamento ao tabelionato e ao registro de imóveis do local.');
    } else {
      const T = CUSTAS[e.tabela] || CUSTAS.SP2026;
      if (e.escritura) {
        const b = lista.reduce((s, i) => s + base(i), 0), f = faixa(T.notas, b);
        itens.push({ato: 'Escritura pública (tabelionato de notas)', base: b, emolumentos: f.total, iss: f.parcela * iss, total: f.total + f.parcela * iss, faixa: f});
      }
      lista.forEach(i => {
        const b = base(i), f = faixa(T.registro, b);
        itens.push({ato: 'Registro da transmissão — ' + (i.descricao || 'imóvel'), base: b, emolumentos: f.total, iss: f.parcela * iss, total: f.total + f.parcela * iss, faixa: f});
      });
      if (+e.garantia > 0) {
        const f = faixa(T.registro, +e.garantia);
        itens.push({ato: 'Registro da alienação fiduciária ou hipoteca', base: +e.garantia, emolumentos: f.total, iss: f.parcela * iss, total: f.total + f.parcela * iss, faixa: f});
      }
    }
    if (+e.certidoes > 0) itens.push({ato: 'Certidões e outras despesas informadas', base: 0, emolumentos: +e.certidoes, iss: 0, total: +e.certidoes});
    const total = itens.reduce((s, i) => s + i.total, 0);
    return {itens, total, issPct: iss, avisos, fonte: e.tabela === 'manual' ? 'informado pelo usuário' : (CUSTAS[e.tabela] || CUSTAS.SP2026).fonte};
  }

  // Atividade preponderante — CTN, art. 37. Só decide a imunidade em fusão, incorporação, cisão e extinção;
  // na integralização de capital é informativa (STF, Tema 1.348, julgado em 19/10/2026).
  // e: {operacao:'integralizacao'|'reorganizacao', nova (bool: começou depois da aquisição ou há menos de 2 anos), totalidade (bool),
  //     anos: [{rotulo, receitaTotal, receitaImob}]}
  function preponderancia(e) {
    const anos = (e.anos || []).map(a => ({rotulo: a.rotulo, total: Math.max(0, +a.receitaTotal || 0), imob: Math.max(0, +a.receitaImob || 0)}))
      .map(a => Object.assign(a, {pct: a.total > 0 ? a.imob / a.total : null}));
    const preenchidos = anos.filter(a => a.total > 0);
    const somaT = preenchidos.reduce((s, a) => s + a.total, 0), somaI = preenchidos.reduce((s, a) => s + a.imob, 0);
    const pct = somaT > 0 ? somaI / somaT : null;
    const periodo = e.nova ? 'os 3 primeiros anos seguintes à aquisição (CTN, art. 37, parágrafo 2º)' : 'os 2 anos anteriores e os 2 anos seguintes à aquisição (CTN, art. 37, parágrafo 1º)';
    const completo = preenchidos.length === anos.length && anos.length > 0;
    const preponderante = pct !== null && pct > .5;
    const memoria = ['Período de apuração: ' + periodo + '. Preponderante: mais de 50% da receita operacional vier de compra e venda, locação ou arrendamento mercantil de imóveis ou de direitos sobre eles.'];
    if (pct !== null) memoria.push('Receita imobiliária ' + brl(somaI) + ' de ' + brl(somaT) + ' de receita operacional nos anos informados: ' + (pct * 100).toFixed(1).replace('.', ',') + '%.');
    const avisos = [];
    let conclusao, imune;
    if (e.operacao === 'integralizacao') {
      imune = true;
      conclusao = 'Integralização de capital: imune qualquer que seja a atividade (STF, Tema 1.348, 19/10/2026), salvo simulação ou fraude, até o valor destinado ao capital (Tema 796). O teste abaixo serve só para instruir o pedido, caso a prefeitura ainda o exija.';
      if (preponderante) avisos.push('A atividade é imobiliária preponderante pelos números informados. Antes do Tema 1.348 isso afastaria a imunidade; hoje não afasta. Se a prefeitura negar o pedido com base na lei municipal (ex.: Guarulhos, Lei 8.425/2025, art. 4º), cabe recurso administrativo citando o Tema 1.348; a ação judicial é ato privativo de advogado.');
      avisos.push('Simulação ou fraude continuam afastando a imunidade. Documente o propósito da holding (organização patrimonial, sucessão, gestão) e mantenha escrituração regular. O TJSP tem decidido que o CNAE declarado não basta para o teste e que a ausência de receita não presume simulação.');
    } else {
      if (e.totalidade) {
        imune = true;
        conclusao = 'Transmissão com a totalidade do patrimônio da pessoa jurídica alienante: o teste de preponderância não se aplica (CTN, art. 37, parágrafo 4º). Imune.';
      } else if (pct === null) {
        imune = null;
        conclusao = 'Informe as receitas para verificar a preponderância.';
      } else {
        imune = !preponderante;
        conclusao = (preponderante ? 'Atividade preponderante imobiliária: a imunidade não se aplica e o ITBI é devido pela lei vigente na data da aquisição, sobre o valor do bem nessa data (CTN, art. 37, parágrafo 3º).' : 'Atividade não preponderante: imune (CF, art. 156, parágrafo 2º, I; CTN, art. 36).') + (completo ? '' : ' Resultado parcial: o período ainda não terminou ou faltam anos; a prefeitura costuma reconhecer a imunidade sob condição e reavaliar ao final.');
      }
    }
    const porAno = anos.filter(a => a.pct !== null && a.pct > .5).map(a => a.rotulo);
    if (porAno.length && !preponderante) avisos.push('Algum ano isolado passou de 50% (' + porAno.join(', ') + '). O cálculo usa o período somado; há prefeituras que olham ano a ano. Confira o critério da lei municipal.');
    return {anos, somaT, somaI, pct, preponderante, completo, imune, conclusao, memoria, avisos, periodo};
  }

  // Fusão, incorporação, cisão ou extinção: imune se não houver preponderância imobiliária (CTN, arts. 36 e 37).
  function reorganizacao(e) {
    const m = municipio(e), p = preponderancia(Object.assign({}, e, {operacao: 'reorganizacao'}));
    const linhas = (e.imoveis || []).filter(i => (+i.valorTransferido || 0) || (+i.valorMercado || 0)).map(i => {
      const v = Math.max(0, +i.valorTransferido || +i.valorCapital || 0), merc = Math.max(v, +i.valorMercado || 0);
      return {descricao: i.descricao || 'Imóvel', valor: v, merc, itbiDecl: v * m.aliquota, itbiMerc: merc * m.aliquota};
    });
    const soma = k => linhas.reduce((s, l) => s + l[k], 0);
    const devido = p.imune === true ? 0 : soma('itbiDecl');
    return {tipo: 'reorganizacao', municipio: m, preponderancia: p, linhas, totais: {valor: soma('valor'), merc: soma('merc'), itbiDecl: soma('itbiDecl'), itbiMerc: soma('itbiMerc')}, devido};
  }

  const DOCUMENTOS_IMUNIDADE = [
    'Requerimento de reconhecimento de imunidade no modelo da prefeitura (em Guarulhos, pelo portal de serviços da Secretaria da Fazenda).',
    'Contrato social ou alteração contratual registrada na JUCESP, com a descrição do imóvel, o valor atribuído e a cláusula de integralização; ou protocolo/justificação e ata da fusão, incorporação ou cisão.',
    'Certidão da JUCESP do ato (título para o registro do imóvel, Lei 8.934/1994, art. 64).',
    'Cartão do CNPJ e documentos do representante legal; procuração, se houver.',
    'Matrícula atualizada do imóvel (até 30 dias) e certidão de valor venal ou carnê do IPTU do exercício.',
    'Balanços patrimoniais e DREs do período de apuração, assinados pelo contador com CRC, e balancetes do exercício em curso.',
    'ECD e ECF transmitidas (recibos) e demonstrativo da receita operacional segregada: venda, locação e arrendamento de imóveis × demais receitas.',
    'Empresa nova (menos de 2 anos ou constituída na integralização): declaração de início de atividade e compromisso de apresentar os balanços dos 3 anos seguintes.',
    'Laudo de avaliação, se o imóvel entrou por valor diferente do declarado no IR ou houver reserva de capital.'
  ];

  const api = {MUNICIPIOS, CUSTAS, faixa, custas, preponderancia, DOCUMENTOS_IMUNIDADE, compra, integralizacao, reorganizacao};
  if (typeof module === 'object' && module.exports) module.exports = api; else raiz.ITBI = api;
})(typeof self !== 'undefined' ? self : this);
