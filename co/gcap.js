/* Módulo Ganho de Capital da Pessoa Física na venda de imóveis — Controller & Oraculu's. Regras conferidas em 06/11/2026.
 * Fontes: Lei 7.713/1988, arts. 3º e 18 (redução para aquisição até 1988); Lei 8.981/1995, art. 21, com a Lei 13.259/2016 (15% a 22,5%);
 * Lei 9.250/1995, art. 23 (único imóvel até R$ 440 mil); Lei 11.196/2005, arts. 39 (reinvestimento em 180 dias) e 40 (FR1 e FR2);
 * IN SRF 84/2001: art. 17 (custo com benfeitorias), art. 19 (valor de alienação; corretagem; condomínio, inciso IV), art. 29, parágrafo 1º,
 * II, "a" (limite de R$ 440 mil pela parte de cada condômino), art. 31 (venda a prazo) e art. 32 (DARF 4600 até o último dia útil do mês seguinte);
 * IN SRF 599/2005 (FR1/FR2 por data de cada parcela do custo); Lei 9.430/1996, art. 61 (multa de mora de 0,33% ao dia, até 20%, e juros Selic).
 * Depende de venda.js (Venda.fatoresPF e Venda.impostoGC). Sem DOM: roda no navegador e no Node. */
(function (raiz) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const V = node ? require('./venda.js') : raiz.Venda;
  const ISENCAO_UNICO = 440000;
  const brl = v => (v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2});
  const rot = s => { const [a, m] = String(s).split('-'); return m + '/' + a; };

  // Páscoa (algoritmo de Meeus) para os feriados móveis
  function pascoa(a) {
    const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3);
    const i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4, m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451);
    const mes = Math.floor((i + m - 7 * n + 114) / 31), dia = ((i + m - 7 * n + 114) % 31) + 1;
    return new Date(Date.UTC(a, mes - 1, dia));
  }
  const iso = d => d.toISOString().slice(0, 10);
  function feriados(a) {
    const p = pascoa(a), mov = n => iso(new Date(p.getTime() + n * 864e5));
    return new Set(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25', '12-31'].map(x => a + '-' + x)
      .concat([mov(-48), mov(-47), mov(-2), mov(60)])); // carnaval (segunda e terça), Sexta-feira Santa, Corpus Christi; 31/12 sem expediente bancário
  }
  // Último dia útil do mês seguinte ao mês informado (AAAA-MM ou AAAA-MM-DD)
  function vencimento(mes) {
    let [a, m] = String(mes).split('-').map(Number);
    m += 1; if (m > 12) { m = 1; a += 1; }
    let d = new Date(Date.UTC(a, m, 0));
    const fer = feriados(a);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || fer.has(iso(d))) d = new Date(d.getTime() - 864e5);
    return iso(d);
  }
  // Acréscimos por atraso: multa de 0,33% ao dia até 20% e juros (Selic acumulada informada + 1% no mês do pagamento)
  function acrescimos(valor, venc, pagamento, selicAcum) {
    if (!pagamento || pagamento <= venc) return {dias: 0, multa: 0, juros: 0, total: valor};
    const dias = Math.round((Date.parse(pagamento) - Date.parse(venc)) / 864e5);
    const multa = valor * Math.min(.2, .0033 * dias);
    const mesmoMes = pagamento.slice(0, 7) === venc.slice(0, 7);
    const juros = mesmoMes ? 0 : valor * ((+selicAcum || 0) + .01);
    return {dias, multa, juros, total: valor + multa + juros};
  }

  /* e: {venda: 'AAAA-MM', valorVenda, corretagem, origem: 'compra'|'heranca'|'doacao',
   *     aquisicao: {data: 'AAAA-MM', valor}, benfeitorias: [{data, valor, descricao}],
   *     proprietarios: [{nome, pct (fração), unico (bool: único imóvel e sem venda em 5 anos), reinvestido (R$ em residencial em 180 dias), residencial (bool)}],
   *     recebimentos: [{data: 'AAAA-MM', valor}] (venda a prazo; vazio = tudo no mês da venda),
   *     pagamento: 'AAAA-MM-DD' (opcional, para acréscimos), selicAcumulada (fração)} */
  function calcular(e) {
    const venda = e.venda, V0 = Math.max(0, +e.valorVenda || 0), corr = Math.max(0, +e.corretagem || 0);
    const parcelas = [{descricao: e.origem === 'heranca' ? 'Herança (valor do inventário)' : e.origem === 'doacao' ? 'Doação (valor da doação)' : 'Aquisição', data: e.aquisicao.data, valor: Math.max(0, +e.aquisicao.valor || 0)}]
      .concat((e.benfeitorias || []).filter(b => +b.valor > 0 && b.data).map(b => ({descricao: b.descricao || 'Benfeitoria', data: b.data, valor: +b.valor})));
    const custo = parcelas.reduce((s, p) => s + p.valor, 0);
    const alienacao = V0 - corr;
    const ganhoBruto = alienacao - custo;
    const memoria = [], avisos = [];
    memoria.push('Valor de alienação: ' + brl(V0) + (corr ? ' − corretagem paga pelo vendedor ' + brl(corr) + ' = ' + brl(alienacao) + ' (IN SRF 84/2001, art. 19, parágrafo 4º)' : '') + '.');
    memoria.push('Custo de aquisição: ' + brl(custo) + ' (' + parcelas.map(p => p.descricao + ' ' + rot(p.data) + ' ' + brl(p.valor)).join('; ') + '). Valores históricos, sem correção (Lei 9.249/1995, art. 17).');
    // Rateio do ganho pelas parcelas do custo, cada uma com os fatores da sua data
    const ganho = Math.max(0, ganhoBruto);
    const porParcela = parcelas.map(p => {
      const f = V.fatoresPF(p.data, venda), prop = custo > 0 ? p.valor / custo : 1 / parcelas.length;
      const g = ganho * prop, base = g * (1 - f.red7713) * f.fr1 * f.fr2;
      return Object.assign({}, p, {prop, ganho: g, red7713: f.red7713, fr1: f.fr1, fr2: f.fr2, m1: f.m1, m2: f.m2, base});
    });
    const baseTotal = porParcela.reduce((s, p) => s + p.base, 0);
    if (ganhoBruto <= 0) memoria.push('Sem ganho de capital (alienação menor ou igual ao custo). Informe a operação no GCAP mesmo assim.');
    else {
      memoria.push('Ganho bruto: ' + brl(ganho) + '.' + (parcelas.length > 1 ? ' Rateado entre as parcelas do custo na proporção de cada uma, com os fatores pela data de cada parcela (IN SRF 84/2001, art. 17; IN SRF 599/2005).' : ''));
      porParcela.forEach(p => memoria.push(p.descricao + ' (' + rot(p.data) + '): ganho ' + brl(p.ganho) + (p.red7713 ? ' × (1 − ' + Math.round(p.red7713 * 100) + '% da Lei 7.713/1988, art. 18)' : '') +
        ' × FR1 ' + p.fr1.toFixed(6).replace('.', ',') + ' (1/1,0060^' + p.m1 + ') × FR2 ' + p.fr2.toFixed(6).replace('.', ',') + ' (1/1,0035^' + p.m2 + ') = ' + brl(p.base) + '.'));
    }
    // Proprietários (condomínio): cada um apura a sua parte (IN SRF 84/2001, art. 19, IV)
    let props = (e.proprietarios || []).filter(p => +p.pct > 0);
    if (!props.length) props = [{nome: 'Proprietário', pct: 1}];
    const somaPct = props.reduce((s, p) => s + +p.pct, 0);
    if (Math.abs(somaPct - 1) > .0001) avisos.push('A soma das participações é ' + (somaPct * 100).toFixed(2).replace('.', ',') + '%, não 100%. Confira a matrícula.');
    const resultado = props.map(p => {
      const pct = +p.pct, valorParte = V0 * pct, baseParte = baseTotal * pct;
      let base = baseParte, isencao = '';
      if (p.unico && valorParte <= ISENCAO_UNICO && ganho > 0) { base = 0; isencao = 'Isento: único imóvel, parte de ' + brl(valorParte) + ' até R$ 440 mil e sem outra venda de imóvel em 5 anos (Lei 9.250/1995, art. 23; IN SRF 84/2001, art. 29, parágrafo 1º, II, "a").'; }
      else if (+p.reinvestido > 0 && p.residencial !== false && ganho > 0) {
        const fr = Math.min(1, +p.reinvestido / (valorParte || 1));
        base = baseParte * (1 - fr);
        isencao = 'Isenção de ' + (fr * 100).toFixed(2).replace('.', ',') + '% (' + brl(+p.reinvestido) + ' aplicados em imóvel residencial no país em 180 dias ÷ ' + brl(valorParte) + '; Lei 11.196/2005, art. 39). Usável uma vez a cada 5 anos.';
      }
      if (p.unico && valorParte > ISENCAO_UNICO && ganho > 0) avisos.push((p.nome || 'Proprietário') + ': a parte na venda (' + brl(valorParte) + ') passa de R$ 440 mil; a isenção do único imóvel não se aplica.');
      const ir = V.impostoGC(base);
      return {nome: p.nome || 'Proprietário', pct, valorParte, ganho: ganho * pct, baseParte, base, isencao, ir};
    });
    const irTotal = resultado.reduce((s, r) => s + r.ir, 0);
    // DARF: um por recebimento, proporcional (art. 31) e vencendo no último dia útil do mês seguinte (art. 32)
    let receb = (e.recebimentos || []).filter(r => +r.valor > 0 && r.data);
    if (!receb.length) receb = [{data: venda, valor: V0}];
    const somaRec = receb.reduce((s, r) => s + +r.valor, 0);
    if (Math.abs(somaRec - V0) > 1) avisos.push('Os recebimentos somam ' + brl(somaRec) + ' e a venda é de ' + brl(V0) + '. O IR é rateado pelos valores recebidos informados.');
    const darfs = receb.map(r => {
      const fr = somaRec > 0 ? +r.valor / somaRec : 0, valor = irTotal * fr, venc = vencimento(r.data);
      return {mes: r.data, recebido: +r.valor, fracao: fr, valor, vencimento: venc, atraso: acrescimos(valor, venc, e.pagamento, e.selicAcumulada)};
    }).filter(d => d.valor > 0 || receb.length === 1);
    if (receb.length > 1) memoria.push('Venda a prazo: IR proporcional a cada recebimento, com DARF até o último dia útil do mês seguinte a cada um (IN SRF 84/2001, arts. 31 e 32).');
    memoria.push('Alíquotas progressivas por ganho: 15% até R$ 5 milhões, 17,5% até R$ 10 milhões, 20% até R$ 30 milhões e 22,5% acima (Lei 8.981/1995, art. 21). DARF código 4600.');
    if (e.origem === 'heranca') avisos.push('Herança: custo = valor pelo qual o imóvel entrou na declaração do herdeiro (o do falecido ou o atribuído no inventário) e data = abertura da sucessão. Se o inventário atribuiu valor maior que o declarado pelo falecido, a diferença já foi tributada no espólio (Lei 9.532/1997, art. 23).');
    if (e.origem === 'doacao') avisos.push('Doação: custo = valor pelo qual o doador transferiu (o da declaração dele ou o de mercado, caso em que ele pagou o ganho) e data = data da doação. Doação com reserva de usufruto: confira o custo da nua-propriedade e do usufruto.');
    if (e.pagamento && darfs.some(d => d.atraso.dias > 0)) avisos.push('Pagamento em atraso: multa de 0,33% por dia, até 20%, e juros pela Selic acumulada informada mais 1% no mês do pagamento (Lei 9.430/1996, art. 61). Gere o DARF atualizado no Sicalc da Receita.');
    return {venda, V0, corr, alienacao, custo, ganhoBruto, ganho, parcelas: porParcela, baseTotal, proprietarios: resultado, irTotal, darfs, memoria, avisos};
  }

  const api = {calcular, vencimento, acrescimos, feriados, ISENCAO_UNICO};
  if (node) module.exports = api; else raiz.GCAP = api;
})(typeof self !== 'undefined' ? self : this);
