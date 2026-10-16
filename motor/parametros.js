/*
 * Parâmetros legais da calculadora.
 * Só dados: nenhuma regra de cálculo aqui. Cada parâmetro traz a fonte.
 * Itens marcados com "PREMISSA" ainda precisam de confirmação jurídica.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else { raiz.Motor = raiz.Motor || {}; raiz.Motor.parametros = fabrica(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

  /* ---------- Simples Nacional ---------- */

  // Limites: LC 123/2006, art. 3º, II (R$ 4,8 mi) e art. 13-A (sublimite de ICMS/ISS de R$ 3,6 mi)
  const LIMITE_SIMPLES = 4800000;
  const SUBLIMITE = 3600000;

  // Faixas de 2026: [teto da RBT12, alíquota nominal, parcela a deduzir]
  // Fonte: LC 123/2006, Anexos I a V (redação da LC 155/2016)
  const SIMPLES_FAIXAS = {
    comercio:  [[180000, 0.040, 0], [360000, 0.073, 5940], [720000, 0.095, 13860], [1800000, 0.107, 22500], [3600000, 0.143, 87300],  [4800000, 0.190, 378000]],
    industria: [[180000, 0.045, 0], [360000, 0.078, 5940], [720000, 0.100, 13860], [1800000, 0.112, 22500], [3600000, 0.147, 85500],  [4800000, 0.300, 720000]],
    servicos:  [[180000, 0.060, 0], [360000, 0.112, 9360], [720000, 0.135, 17640], [1800000, 0.160, 35640], [3600000, 0.210, 125640], [4800000, 0.330, 648000]],
    servicos4: [[180000, 0.045, 0], [360000, 0.090, 8100], [720000, 0.102, 12420], [1800000, 0.140, 39780], [3600000, 0.220, 183780], [4800000, 0.330, 828000]],
    servicos5: [[180000, 0.155, 0], [360000, 0.180, 4500], [720000, 0.195, 9900],  [1800000, 0.205, 17100], [3600000, 0.230, 62100],  [4800000, 0.305, 540000]]
  };

  // 6ª faixa em 2027 e 2028: alíquota nominal 0,1 p.p. menor; volta ao valor de 2026 a partir de 2029.
  // Fonte: LC 214/2025, art. 519 e Anexos XVIII a XXII (nova redação dos Anexos I a V da LC 123)
  const AJUSTE_NOMINAL_6A_2027_2028 = -0.001;

  // Partilha do DAS em 2026, em % do valor do DAS, por faixa (1ª a 6ª).
  // Fonte: LC 123/2006, Anexos I a V, tabelas "Percentual de Repartição dos Tributos"
  const PARTILHA_2026 = {
    comercio: [
      {irpj: 5.5, csll: 3.5, cofins: 12.74, pis: 2.76, cpp: 41.5, icms: 34.0},
      {irpj: 5.5, csll: 3.5, cofins: 12.74, pis: 2.76, cpp: 41.5, icms: 34.0},
      {irpj: 5.5, csll: 3.5, cofins: 12.74, pis: 2.76, cpp: 42.0, icms: 33.5},
      {irpj: 5.5, csll: 3.5, cofins: 12.74, pis: 2.76, cpp: 42.0, icms: 33.5},
      {irpj: 5.5, csll: 3.5, cofins: 12.74, pis: 2.76, cpp: 42.0, icms: 33.5},
      {irpj: 13.5, csll: 10.0, cofins: 28.27, pis: 6.13, cpp: 42.1}
    ],
    industria: [
      {irpj: 5.5, csll: 3.5, cofins: 11.51, pis: 2.49, cpp: 37.5, ipi: 7.5, icms: 32.0},
      {irpj: 5.5, csll: 3.5, cofins: 11.51, pis: 2.49, cpp: 37.5, ipi: 7.5, icms: 32.0},
      {irpj: 5.5, csll: 3.5, cofins: 11.51, pis: 2.49, cpp: 37.5, ipi: 7.5, icms: 32.0},
      {irpj: 5.5, csll: 3.5, cofins: 11.51, pis: 2.49, cpp: 37.5, ipi: 7.5, icms: 32.0},
      {irpj: 5.5, csll: 3.5, cofins: 11.51, pis: 2.49, cpp: 37.5, ipi: 7.5, icms: 32.0},
      {irpj: 8.5, csll: 7.5, cofins: 20.96, pis: 4.54, cpp: 23.5, ipi: 35.0}
    ],
    servicos: [
      {irpj: 4.0, csll: 3.5, cofins: 12.82, pis: 2.78, cpp: 43.4, iss: 33.5},
      {irpj: 4.0, csll: 3.5, cofins: 14.05, pis: 3.05, cpp: 43.4, iss: 32.0},
      {irpj: 4.0, csll: 3.5, cofins: 13.64, pis: 2.96, cpp: 43.4, iss: 32.5},
      {irpj: 4.0, csll: 3.5, cofins: 13.64, pis: 2.96, cpp: 43.4, iss: 32.5},
      {irpj: 4.0, csll: 3.5, cofins: 12.82, pis: 2.78, cpp: 43.4, iss: 33.5},
      {irpj: 35.0, csll: 15.0, cofins: 16.03, pis: 3.47, cpp: 30.5}
    ],
    servicos4: [
      {irpj: 18.8, csll: 15.2, cofins: 17.67, pis: 3.83, iss: 44.5},
      {irpj: 19.8, csll: 15.2, cofins: 20.55, pis: 4.45, iss: 40.0},
      {irpj: 20.8, csll: 15.2, cofins: 19.73, pis: 4.27, iss: 40.0},
      {irpj: 17.8, csll: 19.2, cofins: 18.90, pis: 4.10, iss: 40.0},
      {irpj: 18.8, csll: 19.2, cofins: 18.08, pis: 3.92, iss: 40.0},
      {irpj: 53.5, csll: 21.5, cofins: 20.55, pis: 4.45}
    ],
    servicos5: [
      {irpj: 25.0, csll: 15.0, cofins: 14.10, pis: 3.05, cpp: 28.85, iss: 14.0},
      {irpj: 23.0, csll: 15.0, cofins: 14.10, pis: 3.05, cpp: 27.85, iss: 17.0},
      {irpj: 24.0, csll: 15.0, cofins: 14.92, pis: 3.23, cpp: 23.85, iss: 19.0},
      {irpj: 21.0, csll: 15.0, cofins: 15.74, pis: 3.41, cpp: 23.85, iss: 21.0},
      {irpj: 23.0, csll: 12.5, cofins: 14.10, pis: 3.05, cpp: 23.85, iss: 23.5},
      {irpj: 35.0, csll: 15.5, cofins: 16.44, pis: 3.56, cpp: 29.5}
    ]
  };

  // 2027 e 2028: PIS e COFINS saem; a fatia deles vira CBS + IBS. Fatia do IBS por faixa (1ª a 5ª), em %.
  // Fonte: LC 214/2025, Anexos XVIII a XXII (tabelas de 2027 e 2028)
  const IBS_NO_DAS_2027_2028 = {
    comercio:  [0.17, 0.17, 0.17, 0.17, 0.17],
    industria: [0.15, 0.15, 0.15, 0.15, 0.15],
    servicos:  [0.17, 0.19, 0.19, 0.19, 0.17],
    servicos4: [0.24, 0.27, 0.26, 0.25, 0.24],
    servicos5: [0.19, 0.19, 0.20, 0.21, 0.19]
  };
  // 6ª faixa em 2027 e 2028: fatia da CBS (os demais tributos absorvem o restante na proporção de 2026).
  // Fonte: LC 214/2025, Anexos XVIII a XXII.
  // PREMISSA: a fatia da CBS vem da tabela; a redistribuição proporcional dos demais tributos foi
  // conferida no Anexo I (13,58 / 10,06 / 42,34) e aplicada por analogia aos Anexos II a V.
  const CBS_6A_FAIXA_2027_2028 = {comercio: 34.02, industria: 25.22, servicos: 19.29, servicos4: 24.70, servicos5: 19.78};

  // Parte da fatia do ICMS/ISS que passa ao IBS, ano a ano (vale dentro do DAS e no regime regular).
  // Fonte: EC 132/2023, ADCT, arts. 128 e 129 (redução de 10% ao ano de 2029 a 2032 e extinção em 2033);
  //        LC 214/2025, Anexos XVIII a XXII (repartição IBS × ICMS/ISS)
  const TRANSICAO_ICMS_ISS = {2026: 0, 2027: 0, 2028: 0, 2029: 0.1, 2030: 0.2, 2031: 0.3, 2032: 0.4, 2033: 1};

  // ISS dentro do DAS limitado a 5% da receita; o excesso vai aos tributos federais da faixa.
  // Fonte: LC 123/2006, Anexos III, IV e V, nota da 5ª faixa
  const TETO_ISS_DAS = 0.05;

  // Fator R. Fonte: LC 123/2006, art. 18, §§ 5º-J e 5º-M (folha de 12 meses ≥ 28% da receita de 12 meses)
  const FATOR_R_MINIMO = 0.28;

  /* ---------- Regimes regulares (Presumido, Real, RET) ---------- */

  // IRPJ: 15% + adicional de 10% sobre a parcela acima de R$ 20 mil por mês. Fonte: Lei 9.249/1995, art. 3º, § 1º
  const IRPJ = {aliquota: 0.15, adicional: 0.10, limiteAdicionalMes: 20000};
  // CSLL: 9% para as demais pessoas jurídicas. Fonte: Lei 7.689/1988, art. 3º, III
  const CSLL = 0.09;
  // PIS/COFINS cumulativo (Presumido). Fonte: Lei 9.715/1998 (PIS 0,65%) e Lei 9.718/1998, art. 8º (COFINS 3%)
  const PIS_COFINS_CUMULATIVO = {pis: 0.0065, cofins: 0.03};
  // PIS/COFINS não cumulativo (Real). Fonte: Lei 10.637/2002, art. 2º (1,65%) e Lei 10.833/2003, art. 2º (7,6%)
  const PIS_COFINS_NAO_CUMULATIVO = {pis: 0.0165, cofins: 0.076};
  // CPP patronal de 20% sobre a folha. Fonte: Lei 8.212/1991, art. 22, I e III
  const CPP = 0.20;

  // Acréscimo de 10% nos percentuais de presunção sobre a receita que passar de R$ 5 mi no ano.
  // Fonte: LC 224/2025, art. 4º, § 4º, VII e § 5º; efeitos: IRPJ desde 1º/1/2026 e CSLL desde 1º/4/2026 (art. de vigência)
  // PREMISSA: "acréscimo de 10%" lido como relativo (8% vira 8,8%; 32% vira 35,2%).
  const LC224 = {acrescimo: 0.10, limiteAnual: 5000000, inicioCsll2026: 4};

  // RET da incorporação: 4% = IRPJ 1,26% + CSLL 0,66% + PIS 0,37% + COFINS 1,71%. Fonte: Lei 10.931/2004, arts. 4º e 8º
  // A partir de 2027 a parcela de PIS/COFINS (2,08%) vira CBS/IBS no RET de transição.
  // Fonte: LC 214/2025, art. 485. PREMISSA: percentual de 2,08% mantido; confirmar a regra de cada ano.
  const RET = {irpj: 0.0126, csll: 0.0066, pis: 0.0037, cofins: 0.0171, cbsIbsTransicao: 0.0208};

  // Enquadramento por atividade: tabela do Simples, ISS, presunção de IRPJ/CSLL no Presumido, vedações.
  // Presunção: Lei 9.249/1995, art. 15, § 1º (8% e 32%) e art. 20 (CSLL 12% e 32%)
  // Vedações: LC 123/2006, art. 17, XIV e XV; art. 3º, § 4º, VII
  const ATIVIDADES = {
    comercio:         {tabela: 'comercio',  icms: true,  iss: false, pIR: 0.08, pCS: 0.12, anexo: 'Anexo I'},
    industria:        {tabela: 'industria', icms: true,  iss: false, pIR: 0.08, pCS: 0.12, anexo: 'Anexo II'},
    servicos:         {tabela: 'servicos',  icms: false, iss: true,  pIR: 0.32, pCS: 0.32, anexo: 'Anexo III'},
    servicos4:        {tabela: 'servicos4', icms: false, iss: true,  pIR: 0.32, pCS: 0.32, anexo: 'Anexo IV'},
    servicos5:        {tabela: 'servicos5', icms: false, iss: true,  pIR: 0.32, pCS: 0.32, anexo: 'Anexo V'},
    construcao_total: {tabela: 'servicos4', icms: false, iss: true,  pIR: 0.08, pCS: 0.12, anexo: 'Anexo IV'},
    construcao_mo:    {tabela: 'servicos4', icms: false, iss: true,  pIR: 0.32, pCS: 0.32, anexo: 'Anexo IV'},
    locacao:          {tabela: null, icms: false, iss: false, pIR: 0.32, pCS: 0.32, anexo: 'Não pode optar pelo Simples', vedacao: 'locação de imóveis próprios é vedada no Simples (LC 123, art. 17, XV)'},
    holding:          {tabela: null, icms: false, iss: true,  pIR: 0.32, pCS: 0.32, anexo: 'Não pode optar pelo Simples', vedacao: 'empresa que participa do capital de outra é vedada no Simples (LC 123, art. 3º, § 4º, VII)'},
    incorporacao:     {tabela: null, icms: false, iss: false, pIR: 0.08, pCS: 0.12, anexo: 'Não pode optar pelo Simples', vedacao: 'incorporação e loteamento são vedados no Simples (LC 123, art. 17, XIV)', ret: true}
  };

  /* ---------- CBS e IBS ---------- */

  // Alíquotas de referência (editáveis na tela). Estimativa do CGIBS, Resolução CGIBS nº 14/2026 (31/7/2026):
  // CBS 9,21% e IBS 18,7%. PREMISSA: a CBS de 2027 só será fixada pelo Senado até 15/12/2026.
  const REFERENCIA_CBS_IBS = {cbs: 0.0921, ibs: 0.187};

  // Cronograma. Fonte: EC 132/2023, ADCT, arts. 125 a 129; LC 214/2025, arts. 343 a 348.
  // 2026: CBS 0,9% e IBS 0,1% de teste, compensados com PIS/COFINS (custo zero se cumpridas as obrigações acessórias).
  // 2027–2028: CBS = referência − 0,1 p.p.; IBS 0,1% (0,05% estadual + 0,05% municipal); PIS/COFINS extintos.
  // 2029–2032: IBS = 10%, 20%, 30% e 40% da referência. PREMISSA: proporção linear da referência.
  // 2033: alíquotas cheias; ICMS e ISS extintos.
  const CRONOGRAMA_CBS_IBS = {
    2026: {teste: true, cbsFixa: 0.009, ibsFixa: 0.001, pisCofins: true},
    2027: {cbsAjuste: -0.001, ibsFixa: 0.001, pisCofins: false},
    2028: {cbsAjuste: -0.001, ibsFixa: 0.001, pisCofins: false},
    2029: {cbsAjuste: 0, ibsFracao: 0.1, pisCofins: false},
    2030: {cbsAjuste: 0, ibsFracao: 0.2, pisCofins: false},
    2031: {cbsAjuste: 0, ibsFracao: 0.3, pisCofins: false},
    2032: {cbsAjuste: 0, ibsFracao: 0.4, pisCofins: false},
    2033: {cbsAjuste: 0, ibsFracao: 1.0, pisCofins: false}
  };
  // Simples com CBS/IBS fora do DAS: opção a partir de 2027. Fonte: LC 214/2025, art. 41, § 3º
  // Crédito do comprador quando o fornecedor recolhe no DAS: só o valor pago no DAS. Fonte: LC 214/2025, art. 47, § 9º
  const INICIO_OPCAO_FORA_DAS = 2027;

  /* ---------- Pessoa física ---------- */

  // Tabela progressiva mensal (a partir de 05/2025). Fonte: Lei 15.191/2025 (conversão da MP 1.294/2025)
  const IRPF_MENSAL = [[2428.80, 0, 0], [2826.65, 0.075, 182.16], [3751.05, 0.15, 394.16], [4664.68, 0.225, 675.49], [Infinity, 0.275, 908.73]];
  // Redução mensal a partir de 01/2026. Fonte: Lei 9.250/1995, art. 3º-A, incluído pela Lei 15.270/2025
  const REDUCAO_MENSAL = {isentoAte: 5000, reducaoMaxima: 312.89, constante: 978.62, fator: 0.133145, zeraEm: 7350};
  // Tabela anual do ano-calendário 2026 (12 × faixas mensais; parcelas recalculadas). Fonte: Lei 15.191/2025.
  // PREMISSA: parcelas a deduzir conferidas por fonte secundária e pela continuidade da tabela.
  const IRPF_ANUAL = [[29145.60, 0, 0], [33919.80, 0.075, 2185.92], [45012.60, 0.15, 4729.91], [55976.16, 0.225, 8105.85], [Infinity, 0.275, 10904.66]];
  // Redução anual (exercício 2027). Fonte: Lei 9.250/1995, art. 11-A, incluído pela Lei 15.270/2025
  const REDUCAO_ANUAL = {isentoAte: 60000, reducaoMaxima: 2694.15, constante: 8429.73, fator: 0.095575, zeraEm: 88200};
  // Desconto simplificado mensal e dedução por dependente. Fonte: Lei 9.250/1995, art. 4º, III e § 1º (valores de 05/2025)
  const DESCONTO_SIMPLIFICADO_MENSAL = 607.20;
  const DEDUCAO_DEPENDENTE_MENSAL = 189.59;
  // INSS do sócio sobre o pró-labore: 11% até o teto. Fonte: Lei 8.212/1991, art. 21 e art. 30, § 4º;
  // teto de 2026: Portaria Interministerial MPS/MF nº 13/2026 (R$ 8.475,55)
  const INSS_PRO_LABORE = {aliquota: 0.11, teto: 8475.55};

  // Retenção de 10% sobre lucros e dividendos acima de R$ 50 mil no mês, da mesma PJ para a mesma PF,
  // sobre o total pago no mês. Fonte: Lei 9.250/1995, art. 6º-A, incluído pela Lei 15.270/2025
  const RETENCAO_DIVIDENDOS = {aliquota: 0.10, limiteMensal: 50000};
  // IRPFM: rendimentos anuais acima de R$ 600 mil; alíquota % = REND/60.000 − 10, até 10% a partir de R$ 1,2 mi.
  // Fonte: Lei 9.250/1995, art. 16-A, incluído pela Lei 15.270/2025
  const IRPFM = {limiteInferior: 600000, limiteSuperior: 1200000, aliquotaMaxima: 0.10, divisor: 60000};
  // Redutor do IRPFM: soma das cargas efetivas PJ + PF acima do limite. Fonte: Lei 9.250/1995, art. 16-B, § 1º
  const LIMITE_CARGA_PJ_PF = {geral: 0.34, seguradoras: 0.40, bancos: 0.45};

  /* ---------- Ganho de capital na venda de imóvel por pessoa física ---------- */

  // Redução por ano de aquisição: 100% até 1969, menos 5 p.p. por ano até 5% em 1988. Fonte: Lei 7.713/1988, art. 18
  const REDUCAO_ART18 = {anoIntegral: 1969, ultimoAno: 1988, passo: 0.05};
  // Fatores de redução FR1 = 1/1,0060^m1 e FR2 = 1/1,0035^m2. Fonte: Lei 11.196/2005, art. 40; IN SRF 599/2005, art. 2º
  // m1: meses de jan/1996 (ou da aquisição, se posterior) até nov/2005, contando a fração.
  // m2: meses de dez/2005 (ou da aquisição, se posterior) até o mês da venda.
  // PREMISSA: contagem de meses conferida com o caso de teste; validar no GCAP com outras datas.
  const FATORES_REDUCAO = {fr1: 1.0060, fr2: 1.0035, inicioFr1: {ano: 1996, mes: 1}, fimFr1: {ano: 2005, mes: 11}, inicioFr2: {ano: 2005, mes: 12}};
  // Alíquotas progressivas do ganho de capital. Fonte: Lei 8.981/1995, art. 21, com redação da Lei 13.259/2016
  const ALIQUOTAS_GANHO_CAPITAL = [[5000000, 0.15], [10000000, 0.175], [30000000, 0.20], [Infinity, 0.225]];

  /* ---------- Operações com bens imóveis ---------- */
  const IMOBILIARIO = {
    // Redução das alíquotas de CBS/IBS: 50% nas operações com imóveis; 70% na locação, cessão onerosa e arrendamento.
    // Fonte: LC 214/2025, art. 261, caput e parágrafo único
    reducaoVenda: 0.50, reducaoLocacao: 0.70,
    // Locação residencial de até 90 dias segue as regras de hotelaria. Fonte: LC 214/2025, art. 253.
    // PREMISSA: redução de 40% das regras de hotelaria; sem redutor social.
    reducaoTemporada: 0.40,
    // Redutor social: R$ 100 mil por imóvel residencial novo, R$ 30 mil por lote residencial (venda) e
    // R$ 600 por mês por imóvel residencial (locação), corrigidos pelo IPCA desde a publicação da LC 214 (16/01/2025).
    // Fonte: LC 214/2025, arts. 259 e 260 (redação da LC 227/2026). PREMISSA: correção a partir de fev/2025.
    redutorSocialNovo: 100000, redutorSocialLote: 30000, redutorSocialLocacaoMes: 600, inicioCorrecao: {ano: 2025, mes: 2},
    // PF contribuinte do regime regular. Fonte: LC 214/2025, art. 251, §§ 1º, 2º e 5º
    pfLimiteLocacao: 240000, pfImoveisLocacao: 3, pfVendas: 3, pfConstruidos: 1, pfFolgaAnoCorrente: 0.20,
    // Regimes de transição. Fonte: LC 214/2025, art. 487 (locação de contratos anteriores a 16/01/2025: 3,65%);
    // arts. 485 e 486 (incorporação e parcelamento do solo) ficam "sob consulta" nesta versão.
    art487: 0.0365,
    // Isenção do único imóvel até R$ 440 mil, sem outra alienação em 5 anos. Fonte: Lei 9.250/1995, art. 23
    isencaoUnicoImovel: 440000,
    // Isenção por reinvestimento em imóvel residencial em 180 dias, proporcional. Fonte: Lei 11.196/2005, art. 39
    reinvestimentoDias: 180,
    // PJ: presunção na venda de imóveis (atividade imobiliária) e na locação. Fonte: Lei 9.249/1995, arts. 15 e 20
    presuncaoVenda: {irpj: 0.08, csll: 0.12}, presuncaoLocacao: {irpj: 0.32, csll: 0.32}
  };

  /* ---------- Categorias de tributo ---------- */
  const CATEGORIAS = {
    renda:   {nome: 'Renda', tributos: ['IRPJ', 'CSLL', 'IRPF']},
    consumo: {nome: 'Consumo', tributos: ['PIS', 'COFINS', 'IPI', 'ICMS', 'ISS', 'CBS', 'IBS', 'CBS/IBS (RET)']},
    folha:   {nome: 'Folha', tributos: ['CPP']}
  };

  return {
    ANOS, LIMITE_SIMPLES, SUBLIMITE, SIMPLES_FAIXAS, AJUSTE_NOMINAL_6A_2027_2028, PARTILHA_2026,
    IBS_NO_DAS_2027_2028, CBS_6A_FAIXA_2027_2028, TRANSICAO_ICMS_ISS, TETO_ISS_DAS, FATOR_R_MINIMO,
    IRPJ, CSLL, PIS_COFINS_CUMULATIVO, PIS_COFINS_NAO_CUMULATIVO, CPP, LC224, RET, ATIVIDADES,
    REFERENCIA_CBS_IBS, CRONOGRAMA_CBS_IBS, INICIO_OPCAO_FORA_DAS,
    IRPF_MENSAL, REDUCAO_MENSAL, IRPF_ANUAL, REDUCAO_ANUAL, DESCONTO_SIMPLIFICADO_MENSAL, DEDUCAO_DEPENDENTE_MENSAL,
    INSS_PRO_LABORE, RETENCAO_DIVIDENDOS, IRPFM, LIMITE_CARGA_PJ_PF,
    REDUCAO_ART18, FATORES_REDUCAO, ALIQUOTAS_GANHO_CAPITAL, CATEGORIAS, IMOBILIARIO
  };
});
