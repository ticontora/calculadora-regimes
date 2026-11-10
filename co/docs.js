/* Leitura de documentos do imóvel — Controller & Oraculu's (06/11/2026)
 * Matrícula (certidão do Registro de Imóveis) e certidão de valor venal (Prefeitura).
 * 1) PDF com texto: lido no próprio navegador com pdf.js (nada é enviado).
 * 2) PDF digitalizado ou imagem: na versão do Claude, o Claude lê o documento (capacidade "sample");
 *    no site público, o usuário preenche os campos à mão.
 * O resultado é sempre para CONFERÊNCIA: a leitura automática não substitui a análise da matrícula.
 * As funções de leitura de texto (lerMatricula, lerVenal) não dependem do navegador e rodam no Node. */
(function (raiz) {
  'use strict';

  const num = s => s == null ? null : +String(s).replace(/\./g, '').replace(',', '.');
  const limpa = s => String(s || '').replace(/\s+/g, ' ').trim();
  const todos = (re, t) => { const out = []; let m; const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); while ((m = r.exec(t))) out.push(m); return out; };
  const VALOR = /R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})/;

  const ONUS = [
    ['Hipoteca', /hipotec/i], ['Alienação fiduciária', /aliena[çc][ãa]o\s+fiduci[áa]ria/i], ['Penhora', /penhor/i],
    ['Indisponibilidade', /indisponibilidade/i], ['Arresto/sequestro', /\b(arresto|sequestro)\b/i], ['Usufruto', /usufruto/i],
    ['Servidão', /servid[ãa]o/i], ['Cláusula de inalienabilidade/impenhorabilidade', /inalienabilidade|impenhorabilidade|incomunicabilidade/i],
    ['Ação ajuizada / citação', /a[çc][ãa]o\s+(?:de\s+)?execu[çc][ãa]o|ajuizamento|cita[çc][ãa]o/i], ['Bem de família', /bem\s+de\s+fam[íi]lia/i]
  ];

  // Matrícula: número, cartório, endereço, áreas, inscrição municipal, valores dos registros, ônus
  function lerMatricula(texto) {
    const t = String(texto || '');
    const r = {tipo: 'matricula', campos: {}, valores: [], onus: [], avisos: []};
    const mat = t.match(/matr[ií]cula\s*(?:n[ºo°.\s]*)?[:\-]?\s*(\d{1,3}(?:\.\d{3})+|\d{3,7})/i);
    if (mat) r.campos.matricula = mat[1];
    const cri = t.match(/(\d{1,2}\s*[ºo°]?\s*(?:Oficial|Cart[óo]rio|Of[íi]cio)[^\n]{0,60}?Registro\s+de\s+Im[óo]veis[^\n]{0,60})/i) || t.match(/((?:Oficial|Cart[óo]rio)\s+de\s+Registro\s+de\s+Im[óo]veis[^\n]{0,60})/i);
    if (cri) r.campos.cartorio = limpa(cri[1]).replace(/[,.;:\-]+$/, '');
    const ins = t.match(/(?:contribuinte|inscri[çc][ãa]o\s+(?:imobili[áa]ria|municipal|cadastral)|cadastro\s+municipal|SQL)\s*(?:n[ºo°.\s]*)?[:\-]?\s*([\d][\d.\-\/ ]{5,30}\d)/i);
    if (ins) r.campos.inscricao = limpa(ins[1]);
    const end = t.match(/(?:situad[oa]|localizad[oa])\s+(?:na|no|à|a)\s+((?:Rua|Avenida|Av\.|Alameda|Travessa|Estrada|Rodovia|Praça|Largo)[^\n;]{5,120})/i);
    if (end) r.campos.endereco = limpa(end[1]).replace(/,\s*(?:com|contendo|medindo|tendo)\b.*$/i, '').replace(/[,.;]+$/, '');
    const areas = todos(/[áa]rea\s+(total|constru[íi]da|privativa|[úu]til|comum|do\s+terreno)?\s*(?:de\s+)?([\d.]+,\d{1,4}|\d+)\s*(?:m²|m2|metros\s+quadrados)/i, t)
      .map(m => ({tipo: limpa(m[1] || 'área').toLowerCase(), m2: num(m[2])}));
    if (areas.length) r.campos.areas = areas.slice(0, 6);
    // Valores próximos de "valor/preço/venda/compra" — o último é o da transação mais recente registrada
    todos(/(?:valor|pre[çc]o|importância|quantia|pela\s+quantia|venda|compra|transmitid[oa])[\s\S]{0,80}?R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})/i, t)
      .filter(m => !/hipotec|garantia|d[íi]vida|financiamento|fiduci/i.test(m[0]))
      .forEach(m => r.valores.push({valor: num(m[1]), trecho: limpa(m[0]).slice(-120), pos: m.index}));
    if (r.valores.length) r.campos.ultimoValor = r.valores[r.valores.length - 1].valor;
    const regs = todos(/\b(R|AV)\s*[.\-]?\s*(\d{1,3})\s*[\/\-]\s*(\d{1,3}(?:\.\d{3})+|\d{3,7})/g, t);
    if (regs.length) r.campos.atos = regs.length;
    ONUS.forEach(([nome, re]) => {
      const m = t.match(re);
      if (m) {
        const pos = m.index, perto = t.slice(pos, pos + 600);
        r.onus.push({tipo: nome, cancelado: /cancel|baixa|extin[çc]|libera[çc]/i.test(perto), trecho: limpa(t.slice(Math.max(0, pos - 60), pos + 140))});
      }
    });
    if (!mat) r.avisos.push('Número da matrícula não encontrado no texto.');
    if (r.onus.length) r.avisos.push('Há menção a ônus ou restrição: confira na matrícula se o registro foi cancelado (averbação de cancelamento) antes de qualquer transmissão ou integralização.');
    return r;
  }

  // Certidão de valor venal (IPTU) ou de valor venal de referência (ITBI)
  function lerVenal(texto) {
    const t = String(texto || '');
    const r = {tipo: 'venal', campos: {}, avisos: []};
    const ref = t.match(/valor\s+venal\s+de\s+refer[êe]ncia[^\d]{0,60}?([\d]{1,3}(?:\.\d{3})*,\d{2})/i);
    if (ref) r.campos.valorReferencia = num(ref[1]);
    const vv = t.match(/valor\s+venal(?!\s+de\s+refer)(?:\s+(?:total|do\s+im[óo]vel|para\s+(?:o\s+)?exerc[íi]cio[^\n]{0,15}))?[^\d]{0,60}?([\d]{1,3}(?:\.\d{3})*,\d{2})/i);
    if (vv) r.campos.valorVenal = num(vv[1]);
    const terreno = t.match(/valor\s+(?:venal\s+)?do\s+terreno[^\d]{0,40}?([\d]{1,3}(?:\.\d{3})*,\d{2})/i);
    if (terreno) r.campos.valorTerreno = num(terreno[1]);
    const constr = t.match(/valor\s+(?:venal\s+)?da\s+constru[çc][ãa]o[^\d]{0,40}?([\d]{1,3}(?:\.\d{3})*,\d{2})/i);
    if (constr) r.campos.valorConstrucao = num(constr[1]);
    const ex = t.match(/exerc[íi]cio\s*(?:de\s*)?[:\-]?\s*(20\d{2}|19\d{2})/i);
    if (ex) r.campos.exercicio = ex[1];
    const ins = t.match(/(?:contribuinte|inscri[çc][ãa]o\s+(?:imobili[áa]ria|municipal|cadastral)|cadastro|SQL|n[ºo°]\s*do\s+im[óo]vel)\s*(?:n[ºo°.\s]*)?[:\-]?\s*([\d][\d.\-\/ ]{5,30}\d)/i);
    if (ins) r.campos.inscricao = limpa(ins[1]);
    const end = t.match(/(?:endere[çc]o|local(?:iza[çc][ãa]o)?\s+do\s+im[óo]vel|logradouro)\s*[:\-]?\s*([^\n]{5,120})/i);
    if (end) r.campos.endereco = limpa(end[1]);
    if (!ref && !vv) r.avisos.push('Valor venal não encontrado no texto.');
    if (vv && !ref) r.avisos.push('A certidão traz o valor venal do IPTU. Para o ITBI, a prefeitura pode usar outro valor (valor venal de referência); pelo Tema 1.113 do STJ vale o valor declarado.');
    return r;
  }

  /* ---------- Navegador ---------- */
  // pdf.js só é baixado quando alguém envia um PDF (evita ~1 MB em toda abertura da página)
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  function carregarPdfjs() {
    if (raiz.pdfjsLib) return Promise.resolve(raiz.pdfjsLib);
    return new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js';
      s.onload = () => { try { raiz.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; } catch (e) {} ok(raiz.pdfjsLib); };
      s.onerror = () => erro(new Error('Leitor de PDF indisponível.'));
      document.head.appendChild(s);
    });
  }
  async function textoDoPdf(arquivo) {
    const lib = await carregarPdfjs();
    const dados = new Uint8Array(await arquivo.arrayBuffer());
    const doc = await lib.getDocument({data: dados, isEvalSupported: false}).promise;
    let texto = '';
    for (let p = 1; p <= Math.min(doc.numPages, 30); p++) {
      const pg = await doc.getPage(p);
      const c = await pg.getTextContent();
      let linhaY = null;
      c.items.forEach(it => { const y = it.transform ? Math.round(it.transform[5]) : null; texto += (linhaY !== null && y !== linhaY ? '\n' : ' ') + it.str; linhaY = y; });
      texto += '\n';
    }
    return {texto, paginas: doc.numPages, doc};
  }
  async function imagensDoPdf(doc, max) {
    const out = [];
    for (let p = 1; p <= Math.min(doc.numPages, max || 4); p++) {
      const pg = await doc.getPage(p);
      const vp = pg.getViewport({scale: 1.6});
      const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
      await pg.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise;
      out.push(await new Promise(res => cv.toBlob(res, 'image/jpeg', .85)));
    }
    return out;
  }

  const ESQUEMA = 'Responda SOMENTE com um objeto JSON, sem texto fora dele, com as chaves: tipoDocumento ("matricula" ou "venal"), matricula, cartorio, municipio, endereco, inscricao, areas (lista de {tipo, m2}), proprietarios (lista de nomes; NÃO inclua CPF, RG ou outros números de documento), ultimoValor (número, valor da transmissão mais recente registrada), dataUltimoValor, valorVenal (número), valorReferencia (número, valor venal de referência), exercicio, onus (lista de {tipo, registro, cancelado: true/false}), observacoes (até 3 frases). Use null quando não houver o dado. Números com ponto decimal, sem "R$".';

  // Leitura pelo Claude (versão publicada no Claude). Retorna null se indisponível.
  async function lerComClaude(tipoEsperado, texto, imagens) {
    let sample = null;
    try { sample = raiz.claude && await raiz.claude.use('sample'); } catch (e) { sample = null; }
    if (!sample) return null;
    const instr = 'Você é assistente de um escritório de contabilidade e lê um documento imobiliário brasileiro (' + (tipoEsperado === 'venal' ? 'certidão de valor venal da Prefeitura' : 'certidão de matrícula do Registro de Imóveis') + '). Extraia os dados para conferência. ' + ESQUEMA;
    const opts = {modelTier: 'default'};
    let entrada = instr;
    if (texto && texto.trim().length > 40) entrada += '\n\nTEXTO DO DOCUMENTO:\n' + texto.slice(0, 60000);
    else if (imagens && imagens.length) {
      const lim = sample.limits ? await sample.limits() : {images: false};
      if (!lim || !lim.images) return {erro: 'Leitura de imagens indisponível nesta versão.'};
      opts.images = imagens.slice(0, 4);
      entrada += '\n\nO documento segue nas imagens anexas (páginas digitalizadas).';
    } else return {erro: 'Documento sem texto e sem imagem.'};
    let v;
    try { v = sample.json ? await sample.json(entrada, opts) : JSON.parse((await sample(entrada, opts)).text); }
    catch (e) { return {erro: e && e.code === 'not_granted' ? 'Leitura pelo Claude não autorizada.' : e && e.code === 'rate_limited' ? 'Muitas leituras seguidas: aguarde um pouco.' : 'Não foi possível ler o documento pelo Claude.'}; }
    return {dados: v};
  }

  // Lê um arquivo (PDF ou imagem): texto local primeiro; se não houver texto, Claude (quando disponível)
  async function ler(arquivo, tipoEsperado) {
    const pdf = /pdf$/i.test(arquivo.type) || /\.pdf$/i.test(arquivo.name);
    let texto = '', imagens = [], origem = '';
    if (pdf) {
      const x = await textoDoPdf(arquivo);
      texto = x.texto;
      if (texto.replace(/\s/g, '').length < 40) { imagens = await imagensDoPdf(x.doc, 4); texto = ''; }
    } else if (/^image\//.test(arquivo.type)) imagens = [arquivo];
    if (texto) {
      const r = tipoEsperado === 'venal' ? lerVenal(texto) : lerMatricula(texto);
      r.origem = 'texto do PDF, lido no navegador';
      const faltou = tipoEsperado === 'venal' ? !(r.campos.valorVenal || r.campos.valorReferencia) : !r.campos.matricula;
      if (faltou) { const c = await lerComClaude(tipoEsperado, texto, null); if (c && c.dados) return deClaude(c.dados, tipoEsperado, 'texto do PDF, interpretado pelo Claude'); }
      return r;
    }
    const c = await lerComClaude(tipoEsperado, '', imagens);
    if (c && c.dados) return deClaude(c.dados, tipoEsperado, 'documento digitalizado, lido pelo Claude');
    origem = c && c.erro ? c.erro : 'Documento digitalizado (sem texto). No site público, a leitura de imagem não está disponível: abra a calculadora pelo Claude ou preencha os valores à mão.';
    return {tipo: tipoEsperado, campos: {}, onus: [], valores: [], avisos: [origem], origem: 'não lido'};
  }
  function deClaude(d, tipo, origem) {
    d = d || {};
    const r = {tipo: d.tipoDocumento || tipo, campos: {}, onus: [], valores: [], avisos: [], origem};
    ['matricula', 'cartorio', 'municipio', 'endereco', 'inscricao', 'ultimoValor', 'dataUltimoValor', 'valorVenal', 'valorReferencia', 'exercicio'].forEach(k => { if (d[k] != null && d[k] !== '') r.campos[k] = d[k]; });
    if (Array.isArray(d.areas) && d.areas.length) r.campos.areas = d.areas;
    if (Array.isArray(d.proprietarios) && d.proprietarios.length) r.campos.proprietarios = d.proprietarios.join('; ');
    if (Array.isArray(d.onus)) r.onus = d.onus.map(o => ({tipo: o.tipo || 'Ônus', cancelado: !!o.cancelado, trecho: o.registro || ''}));
    if (d.observacoes) r.avisos.push(String(d.observacoes));
    if (r.onus.some(o => !o.cancelado)) r.avisos.push('Há ônus ou restrição sem cancelamento identificado: confira na matrícula.');
    return r;
  }

  const api = {lerMatricula, lerVenal, ler, lerComClaude};
  if (typeof module === 'object' && module.exports) module.exports = api; else raiz.DocImovel = api;
})(typeof self !== 'undefined' ? self : this);
