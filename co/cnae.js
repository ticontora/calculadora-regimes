/* Enquadramento por CNAE — Controller & Oraculu's
 * Regras próprias, montadas a partir da LC 123/2006, art. 17 (vedações) e art. 18, parágrafos 5º-B a 5º-I e 5º-M (anexos),
 * e da LC 214/2025, arts. 127 a 138 e 251 a 261 (reduções de CBS/IBS).
 * A regra de prefixo mais longo vence. Resultado é SUGESTÃO: conferir o caso concreto.
 * Sem DOM: roda no navegador e no Node. */
(function (raiz) {
  'use strict';

  // [prefixo do CNAE (só dígitos), atividade da calculadora, nota]
  // atividades: comercio, industria, servicos3, servicos4, servicos5 (Fator R), construcao, locacao, holding, incorporacao, vedado
  const REGRAS = [
    // Seções gerais
    ['01', 'comercio', 'Produção rural: confira o enquadramento (produtor rural PJ, Anexo I/II conforme o caso).'],
    ['02', 'comercio', 'Produção florestal: confira o enquadramento.'],
    ['03', 'comercio', 'Pesca e aquicultura: confira o enquadramento.'],
    ['05', 'industria'], ['06', 'vedado', 'Extração de petróleo e gás não pode optar pelo Simples.'], ['07', 'industria'], ['08', 'industria'], ['09', 'industria'],
    ['1', 'industria'], ['2', 'industria'], ['30', 'industria'], ['31', 'industria'], ['32', 'industria'], ['33', 'industria'],
    ['35', 'vedado', 'Geração, transmissão e distribuição de energia elétrica são vedadas ao Simples (LC 123, art. 17, VII).'],
    ['36', 'servicos3'], ['37', 'servicos3'], ['38', 'servicos3'], ['39', 'servicos3'],
    ['41', 'construcao', 'Construção de edifícios: Anexo IV. Se for só mão de obra, troque para Anexo IV (serviços).'],
    ['4110700', 'incorporacao', 'Incorporação imobiliária é vedada ao Simples (LC 123, art. 17, XIV). Avalie RET com patrimônio de afetação.'],
    ['42', 'construcao', 'Obras de infraestrutura: Anexo IV.'],
    ['43', 'servicos4', 'Serviços especializados de construção: Anexo IV. Com fornecimento de material, troque para "Construção com material".'],
    ['45', 'comercio'], ['46', 'comercio'], ['47', 'comercio'],
    ['461', 'servicos5', 'Representação comercial / intermediação: Anexo V, ou III com Fator R ≥ 28% (LC 123, art. 18, parágrafo 5º-I, IV).'],
    ['49', 'servicos3', 'Transporte: intermunicipal e interestadual de cargas tem ICMS (Anexo III sem ISS). Confira.'],
    ['50', 'servicos3', 'Transporte aquaviário: confira.'], ['51', 'servicos3', 'Transporte aéreo: confira.'],
    ['52', 'servicos3'], ['5250803', 'servicos5', 'Despachante aduaneiro / comissária: Anexo V ou III com Fator R.'],
    ['53', 'servicos3'],
    ['55', 'servicos3'], ['56', 'comercio', 'Restaurantes e bares: Anexo I (fornecimento de alimentação, ICMS).'],
    ['58', 'servicos3'], ['59', 'servicos3'], ['60', 'servicos3'],
    ['61', 'servicos3', 'Telecomunicações: tributação específica (ICMS). Confira.'],
    ['62', 'servicos5', 'Tecnologia da informação: Anexo V, ou III com Fator R ≥ 28%.'],
    ['6203100', 'servicos3', 'Licenciamento de software não customizável: Anexo III.'],
    ['63', 'servicos3'], ['6391700', 'servicos5', 'Agência de notícias (jornalismo): Anexo V ou III com Fator R.'],
    ['64', 'vedado', 'Atividade financeira vedada ao Simples (LC 123, art. 17, I).'],
    ['65', 'vedado', 'Seguros e previdência: vedados ao Simples.'],
    ['66', 'servicos3', 'Auxiliares financeiros: confira se não há vedação.'],
    ['6462', 'holding', 'Holding de instituições não financeiras: vedada ao Simples (LC 123, art. 3º, parágrafo 4º, VII).'],
    ['6463', 'holding', 'Outras sociedades de participação: vedadas ao Simples.'],
    ['6810201', 'servicos3', 'Compra e venda de imóveis próprios: operações com imóveis têm redução de 50% de CBS/IBS (LC 214, art. 261). Confira a presunção de 8% no Presumido.'],
    ['6810202', 'locacao', 'Locação de imóveis próprios: vedada ao Simples (LC 123, art. 17, XV). Redução de 70% de CBS/IBS (LC 214, art. 261).'],
    ['6810203', 'incorporacao', 'Loteamento de imóveis próprios: vedado ao Simples (LC 123, art. 17, XIV).'],
    ['682', 'servicos3', 'Intermediação e administração de imóveis: redução de 50% de CBS/IBS (LC 214, art. 261).'],
    ['69117', 'servicos4', 'Advocacia: Anexo IV (LC 123, art. 18, parágrafo 5º-C, VII).'],
    ['6912', 'vedado', 'Cartórios: não optam pelo Simples.'],
    ['6920601', 'servicos3', 'Contabilidade: Anexo III (LC 123, art. 18, parágrafo 5º-B, XIV).'],
    ['6920602', 'servicos5', 'Consultoria e auditoria contábil e tributária: Anexo V ou III com Fator R.'],
    ['70', 'servicos5', 'Consultoria e gestão: Anexo V ou III com Fator R (LC 123, art. 18, parágrafo 5º-I, VI).'],
    ['71', 'servicos5', 'Engenharia, arquitetura e análises técnicas: Anexo V ou III com Fator R.'],
    ['72', 'servicos5', 'Pesquisa e desenvolvimento: Anexo V ou III com Fator R.'],
    ['73', 'servicos5', 'Publicidade: Anexo V ou III com Fator R.'],
    ['7320', 'servicos3', 'Pesquisa de mercado: confira (Anexo III).'],
    ['74', 'servicos5', 'Design e atividades técnicas: Anexo V ou III com Fator R.'],
    ['7410202', 'servicos4', 'Design de interiores (decoração): Anexo IV (LC 123, art. 18, parágrafo 5º-C, I).'],
    ['7420', 'servicos3', 'Fotografia: Anexo III.'],
    ['75', 'servicos5', 'Medicina veterinária: Anexo V ou III com Fator R.'],
    ['77', 'servicos3', 'Locação de bens móveis: confira (locação sem operador não tem ISS).'],
    ['781', 'servicos5', 'Seleção e agenciamento de mão de obra: Anexo V ou III com Fator R.'],
    ['782', 'vedado', 'Locação/fornecimento de mão de obra (cessão): vedada ao Simples (LC 123, art. 17, XII), salvo exceções do Anexo IV.'],
    ['783', 'vedado', 'Fornecimento de recursos humanos (cessão de mão de obra): vedado ao Simples, salvo exceções.'],
    ['79', 'servicos3'],
    ['801', 'servicos4', 'Vigilância e segurança privada: Anexo IV (LC 123, art. 18, parágrafo 5º-C, VI).'],
    ['802', 'servicos3'], ['803', 'servicos3'],
    ['811', 'servicos4', 'Apoio a edifícios / conservação: Anexo IV.'],
    ['812', 'servicos4', 'Limpeza e conservação: Anexo IV.'], ['8122200', 'servicos3', 'Imunização e controle de pragas: Anexo III.'],
    ['813', 'servicos4', 'Paisagismo: Anexo IV.'],
    ['82', 'servicos3'],
    ['84', 'vedado', 'Administração pública.'],
    ['85', 'servicos3', 'Educação: Anexo III. Redução de 60% de CBS/IBS para os serviços de educação listados na LC 214 (art. 129).'],
    ['86', 'servicos5', 'Saúde: Anexo V ou III com Fator R. Redução de 60% de CBS/IBS (LC 214, art. 130).'],
    ['8650004', 'servicos3', 'Fisioterapia: Anexo III (LC 123, art. 18, parágrafo 5º-B, XVI). Redução de 60% de CBS/IBS.'],
    ['87', 'servicos3'], ['88', 'servicos3'],
    ['90', 'servicos5', 'Atividades artísticas: Anexo V ou III com Fator R.'], ['91', 'servicos3'], ['92', 'vedado', 'Jogos e apostas.'],
    ['93', 'servicos3'], ['94', 'servicos3'], ['95', 'servicos3'], ['96', 'servicos3'], ['97', 'servicos3']
  ];

  // Redução de CBS/IBS sugerida: [prefixo, redução, nota]
  const REDUCOES = [
    ['41', .5, 'construção'], ['42', .5, 'construção'], ['43', .5, 'construção'],
    ['6810201', .5, 'venda de imóveis'], ['6810202', .7, 'locação de imóveis'], ['682', .5, 'intermediação/administração de imóveis'], ['4110700', .5, 'incorporação'],
    ['85', .6, 'educação'], ['86', .6, 'saúde'], ['8650004', .6, 'saúde'],
    ['69117', .3, 'advocacia (profissão regulamentada)'], ['692', .3, 'contabilidade (profissão regulamentada)'],
    ['711', .3, 'engenharia e arquitetura (profissão regulamentada)'], ['75', .3, 'medicina veterinária (profissão regulamentada)'],
    ['7020', .3, 'administração/economia, se exercida por profissional habilitado'], ['9313', .3, 'educação física (profissão regulamentada)']
  ];

  const so = c => String(c || '').replace(/\D/g, '');

  function busca(lista, cnae) {
    const c = so(cnae);
    let melhor = null;
    lista.forEach(r => { if (c.startsWith(r[0]) && (!melhor || r[0].length > melhor[0].length)) melhor = r; });
    return melhor;
  }

  function enquadrar(cnae) {
    const c = so(cnae);
    if (c.length < 4) return null;
    const r = busca(REGRAS, c);
    const red = busca(REDUCOES, c);
    return {
      cnae: c,
      formatado: c.length === 7 ? c.slice(0, 4) + '-' + c[4] + '/' + c.slice(5) : c,
      atividade: r ? r[1] : 'servicos3',
      nota: r ? (r[2] || '') : 'CNAE não mapeado: tratado como serviço do Anexo III. Confira.',
      reducao: red ? red[1] : 0,
      motivoReducao: red ? red[2] : ''
    };
  }

  function validarCnpj(v) {
    const c = so(v);
    if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    const dv = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += +c[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return dv(12) === +c[12] && dv(13) === +c[13];
  }

  // Normaliza a resposta da BrasilAPI ou da publica.cnpj.ws
  function normalizar(j) {
    if (j && j.cnae_fiscal) {
      const reg = (j.regime_tributario || []).slice().sort((a, b) => b.ano - a.ano)[0];
      return {
        razao: j.razao_social, fantasia: j.nome_fantasia, situacao: j.descricao_situacao_cadastral,
        municipio: j.municipio, uf: j.uf, abertura: j.data_inicio_atividade,
        principal: {codigo: String(j.cnae_fiscal), descricao: j.cnae_fiscal_descricao},
        secundarios: (j.cnaes_secundarios || []).filter(s => s.codigo).map(s => ({codigo: String(s.codigo), descricao: s.descricao})),
        simples: j.opcao_pelo_simples === true, mei: j.opcao_pelo_mei === true,
        regime: reg ? reg.forma_de_tributacao + ' (' + reg.ano + ')' : null,
        natureza: j.natureza_juridica || null
      };
    }
    if (j && j.estabelecimento) {
      const e = j.estabelecimento;
      return {
        razao: j.razao_social, fantasia: e.nome_fantasia, situacao: e.situacao_cadastral,
        municipio: e.cidade && e.cidade.nome, uf: e.estado && e.estado.sigla, abertura: e.data_inicio_atividade,
        principal: {codigo: e.atividade_principal && e.atividade_principal.id, descricao: e.atividade_principal && e.atividade_principal.descricao},
        secundarios: (e.atividades_secundarias || []).map(s => ({codigo: s.id, descricao: s.descricao})),
        simples: !!(j.simples && j.simples.simples === 'Sim'), mei: !!(j.simples && j.simples.mei === 'Sim'),
        regime: null, natureza: j.natureza_juridica && j.natureza_juridica.descricao
      };
    }
    return null;
  }

  async function consultar(cnpj) {
    const c = so(cnpj);
    const fontes = ['https://brasilapi.com.br/api/cnpj/v1/' + c, 'https://publica.cnpj.ws/cnpj/' + c];
    let ultimo = null;
    for (const url of fontes) {
      try {
        const r = await fetch(url, {headers: {Accept: 'application/json'}});
        if (r.status === 404) throw new Error('CNPJ não encontrado na base da Receita.');
        if (!r.ok) { ultimo = new Error('Consulta indisponível (HTTP ' + r.status + ').'); continue; }
        const d = normalizar(await r.json());
        if (d) return d;
      } catch (e) {
        if (/não encontrado/.test(e.message)) throw e;
        ultimo = e;
      }
    }
    throw new Error('Não foi possível consultar o CNPJ agora. Digite o CNAE principal no campo ao lado.' + (ultimo && /Failed to fetch|NetworkError|Load failed/i.test(ultimo.message) ? ' (Este ambiente bloqueia consultas externas.)' : ''));
  }

  const api = {enquadrar, validarCnpj, normalizar, consultar, REGRAS, REDUCOES};
  if (typeof module === 'object' && module.exports) module.exports = api; else raiz.CNAE = api;
})(typeof self !== 'undefined' ? self : this);
