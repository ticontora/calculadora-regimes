/* Módulo ITCMD — Controller & Oraculu's. Regras conferidas em 06/11/2026.
 * Normas gerais: CF, art. 155, I e parágrafo 1º, VI (progressividade obrigatória, EC 132/2023); LC 227/2026, arts. 146 a 164
 * (base = valor de mercado, art. 152; quotas não negociadas: no mínimo o patrimônio líquido ajustado a valor de mercado, art. 154, II).
 * São Paulo: Lei 10.705/2000 — alíquota única de 4% (art. 16), ainda sem lei de progressividade em 2026; base = valor venal do bem
 * (art. 9º); imóvel urbano não inferior ao valor venal do IPTU (art. 13); nua-propriedade = 2/3 e usufruto = 1/3 (art. 9º, parágrafo 2º);
 * isenções do art. 6º em UFESPs (UFESP 2026 = R$ 38,42, Comunicado DICAR 88/2025); doações entre as mesmas partes somam no ano civil.
 * Quotas em SP: Lei 10.705/2000, art. 14, parágrafo 3º (valor patrimonial). O TJSP tem aceitado o patrimônio líquido contábil;
 * a SEFAZ-SP (RC 33.625/2026) e a LC 227/2026 exigem valor de mercado — por isso há dois cenários.
 * Projeção: PL 409/2025 (Alesp), não aprovado — 1% até 10 mil UFESPs, 2% até 85 mil, 3% até 280 mil, 4% acima (por faixa).
 * Sem DOM: roda no navegador e no Node. */
(function (raiz) {
  'use strict';

  const ESTADOS = {
    SP: {nome: 'São Paulo', aliquota: .04, ufesp: 38.42, fonte: 'Lei 10.705/2000, art. 16 (4% para qualquer valor)',
      isencoes: {doacao: 2500, imovelResidencial: 5000, imovelUnico: 2500, moveis: 1500, depositos: 1000},
      projecoes: [{nome: 'PL 409/2025 (Alesp) — se aprovado, vale no ano seguinte à lei', faixasUfesp: [[10000, .01], [85000, .02], [280000, .03], [Infinity, .04]]}]},
    outro: {nome: 'Outro estado (informar)', aliquota: .04, ufesp: 0, fonte: 'Lei estadual informada pelo usuário', isencoes: null, projecoes: []}
  };

  const brl = v => (v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2});
  const pct = v => (v * 100).toFixed(2).replace('.', ',') + '%';

  // Imposto por faixas (marginal); faixas = [[limite em R$, alíquota], ...]
  function porFaixas(base, faixas) {
    let t = 0, ant = 0;
    for (const [lim, a] of faixas) { if (base > ant) t += (Math.min(base, lim) - ant) * a; ant = lim; if (base <= lim) break; }
    return t;
  }

  // Base de cada bem (fração transmitida; usufruto; base mínima; quotas contábil × ajustado)
  function baseBem(b, e) {
    const frac = Math.min(1, Math.max(0, b.fracao == null || b.fracao === '' ? 1 : +b.fracao));
    let valor, valorFisco, nota = [];
    if (b.tipo === 'quotas') {
      const cont = Math.max(0, +b.plContabil || 0), aj = Math.max(0, +b.plAjustado || 0);
      valor = cont || aj; valorFisco = Math.max(cont, aj);
      nota.push('Quotas: contribuinte usa o patrimônio líquido contábil (aceito pelo TJSP); a SEFAZ-SP e a LC 227/2026, art. 154, II, pedem no mínimo o PL ajustado a valor de mercado.');
    } else {
      const decl = Math.max(0, +b.valor || 0), venal = Math.max(0, +b.venalIptu || 0);
      valor = b.tipo === 'imovelUrbano' && venal > decl ? venal : decl;
      if (b.tipo === 'imovelUrbano' && venal > decl) nota.push('Imóvel urbano: base não inferior ao valor venal do IPTU (Lei 10.705/2000, art. 13).');
      const ref = Math.max(0, +b.valorReferencia || 0);
      valorFisco = Math.max(valor, ref);
      if (ref > valor) nota.push('A SEFAZ-SP pode exigir o valor venal de referência do ITBI (Decreto 55.002/2009); o TJSP afasta essa exigência sem processo administrativo (Tema 1.113 do STJ aplicado ao ITCMD).');
    }
    const usuf = e.operacao === 'doacao' && b.usufruto;
    const fator = usuf ? 2 / 3 : 1;
    return {valorBem: valor * frac, valorBemFisco: valorFisco * frac, base: valor * frac * fator, baseFisco: valorFisco * frac * fator,
      usufruto: usuf, terco: usuf ? valor * frac / 3 : 0, tercoFisco: usuf ? valorFisco * frac / 3 : 0, nota};
  }

  // e: {estado, operacao 'doacao'|'heranca', beneficiarios, doacoesAnteriores (R$ no ano, por donatário), aliquotaOutro, faixasOutro ([[R$, alíquota]]),
  //     bens: [{descricao, tipo 'imovelUrbano'|'imovelRural'|'quotas'|'dinheiro'|'moveis'|'outros', valor, venalIptu, valorReferencia, plContabil, plAjustado, fracao (0–1), usufruto, residencial, unico}]}
  function calcular(e) {
    const est = ESTADOS[e.estado] || ESTADOS.outro;
    const ufesp = e.estado === 'SP' ? est.ufesp : 0;
    const n = Math.max(1, Math.round(+e.beneficiarios || 1));
    const bens = (e.bens || []).filter(b => (+b.valor || 0) + (+b.plContabil || 0) + (+b.plAjustado || 0) > 0);
    const out = {estado: est, ufesp, operacao: e.operacao, beneficiarios: n, linhas: [], memoria: [], avisos: []};
    let base = 0, baseFisco = 0, terco = 0, tercoFisco = 0;
    bens.forEach(b => {
      const x = baseBem(b, e);
      let isento = false, motivo = '';
      if (e.estado === 'SP' && e.operacao === 'heranca') {
        const vInt = (b.tipo === 'imovelUrbano' || b.tipo === 'imovelRural') ? Math.max(+b.valor || 0, +b.venalIptu || 0) : x.valorBem;
        if ((b.tipo === 'imovelUrbano' || b.tipo === 'imovelRural') && b.residencial && vInt <= est.isencoes.imovelResidencial * ufesp) { isento = true; motivo = 'imóvel de residência até 5.000 UFESPs, herdeiros residentes sem outro imóvel (art. 6º, I, a)'; }
        else if ((b.tipo === 'imovelUrbano' || b.tipo === 'imovelRural') && b.unico && vInt <= est.isencoes.imovelUnico * ufesp) { isento = true; motivo = 'único imóvel transmitido, até 2.500 UFESPs (art. 6º, I, b)'; }
        else if (b.tipo === 'moveis' && x.valorBem <= est.isencoes.moveis * ufesp) { isento = true; motivo = 'móveis que guarnecem o imóvel, até 1.500 UFESPs (art. 6º, I, c)'; }
        else if (b.tipo === 'dinheiro' && x.valorBem <= est.isencoes.depositos * ufesp) { isento = true; motivo = 'depósitos e aplicações até 1.000 UFESPs (art. 6º, I, d)'; }
      }
      const lb = isento ? 0 : x.base, lbf = isento ? 0 : x.baseFisco;
      base += lb; baseFisco += lbf; terco += isento ? 0 : x.terco; tercoFisco += isento ? 0 : x.tercoFisco;
      out.linhas.push({descricao: b.descricao || b.tipo, tipo: b.tipo, valorBem: x.valorBem, base: lb, baseFisco: lbf, usufruto: x.usufruto, isento, motivo, nota: x.nota});
    });

    const porBenef = base / n, porBenefFisco = baseFisco / n;
    let imposto, impostoFisco, isencaoDoacao = false;
    const aliq = e.estado === 'SP' ? est.aliquota : Math.max(0, +e.aliquotaOutro || 0);
    const faixasOutro = e.estado !== 'SP' && Array.isArray(e.faixasOutro) && e.faixasOutro.length ? e.faixasOutro : null;
    const calcBenef = b => faixasOutro ? porFaixas(b, faixasOutro) : b * aliq;
    if (e.estado === 'SP' && e.operacao === 'doacao') {
      // Isenção por doador-donatário no ano civil: se a soma do ano passar de 2.500 UFESPs, tributa o total (art. 6º, II, a)
      const anteriores = Math.max(0, +e.doacoesAnteriores || 0);
      const limite = est.isencoes.doacao * ufesp;
      isencaoDoacao = porBenef + anteriores <= limite;
      imposto = isencaoDoacao ? 0 : n * calcBenef(porBenef);
      impostoFisco = porBenefFisco + anteriores <= limite ? 0 : n * calcBenef(porBenefFisco);
      out.memoria.push('Isenção da doação: até 2.500 UFESPs (' + brl(limite) + ' em 2026) por doador e donatário, somadas as doações do ano civil. Por donatário: ' + brl(porBenef) + (anteriores ? ' + ' + brl(anteriores) + ' já doados no ano' : '') + (isencaoDoacao ? ' — isento.' : ' — acima do limite: tributa o total.'));
      if (!isencaoDoacao && anteriores > 0 && anteriores <= limite) out.avisos.push('As doações anteriores do ano, que estavam isentas, passam a ser tributadas junto com esta, porque a soma ultrapassou 2.500 UFESPs.');
    } else {
      imposto = n * calcBenef(porBenef);
      impostoFisco = n * calcBenef(porBenefFisco);
    }
    out.base = base; out.baseFisco = baseFisco; out.porBeneficiario = porBenef; out.imposto = imposto; out.impostoFisco = impostoFisco; out.isencaoDoacao = isencaoDoacao;
    const aliqTexto = faixasOutro ? 'tabela progressiva informada' : pct(aliq);
    out.memoria.unshift('Base total: ' + brl(base) + ' dividida entre ' + n + ' beneficiário(s) = ' + brl(porBenef) + ' cada. Alíquota: ' + aliqTexto + ' (' + est.fonte + '). ITCMD: ' + brl(imposto) + '.');
    if (terco > 0) {
      out.usufruto = {terco, tercoFisco, imposto: calcBenef(terco / n) * n};
      out.memoria.push('Doação com reserva de usufruto: base de 2/3 agora; o 1/3 restante (' + brl(terco) + ', ITCMD estimado ' + brl(out.usufruto.imposto) + ' em valores de hoje) vence na extinção do usufruto, atualizado pela UFESP (Lei 10.705/2000, art. 9º, parágrafo 2º). Há decisões do TJSP afastando esse 1/3 na extinção por morte; a Fazenda cobra.');
    }
    // Projeção (PL 409/2025): só informativa
    out.projecoes = (est.projecoes || []).map(p => {
      const faixas = p.faixasUfesp.map(([u, a]) => [u === Infinity ? Infinity : u * ufesp, a]);
      return {nome: p.nome, imposto: n * porFaixas(porBenef, faixas)};
    });
    if (impostoFisco > imposto + 0.005) out.avisos.push('Cenário da Fazenda (valor de mercado das quotas ou valor de referência do imóvel): ITCMD de ' + brl(impostoFisco) + ' (+' + brl(impostoFisco - imposto) + '). Discutir judicialmente é ato privativo de advogado.');
    if (e.estado === 'SP') out.avisos.push('São Paulo ainda cobra 4% fixo em 2026: a progressividade exigida pela EC 132/2023 e pela LC 227/2026 depende de lei estadual (PL 409/2025 e PL 7/2024 em trâmite) e só valeria no ano seguinte à publicação. Há tese de que a alíquota fixa perdeu validade com a LC 227/2026 — matéria judicial.');
    if (e.estado === 'SP' && e.operacao === 'heranca') out.avisos.push('Isenções de imóvel na herança: conta o valor do imóvel inteiro, não o quinhão (art. 6º, parágrafo 4º, e RC 20.307/2019). Confira as condições (residência, imóvel único).');
    if (bens.some(b => b.tipo === 'quotas')) out.avisos.push('Holding: a LC 227/2026 tende a elevar a base das quotas ao valor de mercado dos imóveis da sociedade; avalie no estudo de holding o momento da doação.');
    return out;
  }

  const api = {ESTADOS, calcular, porFaixas};
  if (typeof module === 'object' && module.exports) module.exports = api; else raiz.ITCMD = api;
})(typeof self !== 'undefined' ? self : this);
