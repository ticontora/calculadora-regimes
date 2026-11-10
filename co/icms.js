/* Módulo ICMS por estado — Controller & Oraculu's. Alíquotas internas gerais (modais) conferidas em 06/11/2026.
 * Regras: CF, art. 155, parágrafo 2º, IV a VIII (EC 87/2015); LC 87/1996, arts. 12, 13 e 20; LC 190/2022 (DIFAL para não contribuinte);
 * Res. do Senado 22/1989 (12% e 7%) e 13/2012 (4% para importados); Convênio ICMS 236/2021 (DIFAL, base dupla);
 * Convênio ICMS 142/2018, cláusula 9ª (MVA ajustada na ST interestadual); EC 132/2023, ADCT, art. 128 (redução do ICMS em 2029–2032 e extinção em 2033).
 * Alíquota modal = regra geral; produtos com alíquota própria (cesta básica, energia, combustíveis, supérfluos) devem ser informados na tela.
 * Sem DOM: roda no navegador e no Node. */
(function (raiz) {
  'use strict';
  const M = typeof module === 'object' && module.exports ? require('./motor.js') : raiz.MotorCO;

  // interna: alíquota geral; fcp: adicional de fundo de pobreza aplicado em regra geral; ssExES: Sul/Sudeste, exceto ES (origem de 7% para N/NE/CO/ES)
  const UF = {
    AC: {nome: 'Acre', interna: .19, fcp: 0},
    AL: {nome: 'Alagoas', interna: .205, fcp: 0, obs: '20,5% desde 01/04/2026 (lei estadual de dez/2025; antes 19%). Fundo de pobreza em produtos específicos.'},
    AM: {nome: 'Amazonas', interna: .20, fcp: 0},
    AP: {nome: 'Amapá', interna: .18, fcp: 0},
    BA: {nome: 'Bahia', interna: .205, fcp: 0, obs: 'Fundo de pobreza de 2% em produtos específicos.'},
    CE: {nome: 'Ceará', interna: .20, fcp: 0},
    DF: {nome: 'Distrito Federal', interna: .20, fcp: 0},
    ES: {nome: 'Espírito Santo', interna: .17, fcp: 0},
    GO: {nome: 'Goiás', interna: .19, fcp: 0, obs: 'Lei 11.651/1991, art. 27, I, com a Lei 22.460/2023.'},
    MA: {nome: 'Maranhão', interna: .23, fcp: 0, obs: 'Maior alíquota geral do país.'},
    MG: {nome: 'Minas Gerais', interna: .18, fcp: 0, ss: true, obs: 'Fundo de pobreza de 2% em produtos específicos.'},
    MS: {nome: 'Mato Grosso do Sul', interna: .17, fcp: 0},
    MT: {nome: 'Mato Grosso', interna: .17, fcp: 0},
    PA: {nome: 'Pará', interna: .19, fcp: 0},
    PB: {nome: 'Paraíba', interna: .20, fcp: 0},
    PE: {nome: 'Pernambuco', interna: .205, fcp: 0},
    PI: {nome: 'Piauí', interna: .225, fcp: 0},
    PR: {nome: 'Paraná', interna: .195, fcp: 0, ss: true},
    RJ: {nome: 'Rio de Janeiro', interna: .20, fcp: .02, ss: true, obs: '20% + 2% do FECP (Lei 2.657/1996; LC 210/2023): carga de 22%.'},
    RN: {nome: 'Rio Grande do Norte', interna: .20, fcp: 0},
    RO: {nome: 'Rondônia', interna: .195, fcp: 0},
    RR: {nome: 'Roraima', interna: .20, fcp: 0},
    RS: {nome: 'Rio Grande do Sul', interna: .17, fcp: 0, ss: true},
    SC: {nome: 'Santa Catarina', interna: .17, fcp: 0, ss: true},
    SE: {nome: 'Sergipe', interna: .19, fcp: 0, obs: 'Adicional do FECOEP em produtos específicos.'},
    SP: {nome: 'São Paulo', interna: .18, fcp: 0, ss: true, obs: 'RICMS-SP, art. 52, I (18%); alíquotas de 7%, 12% e 25% para mercadorias específicas (arts. 53 a 55).'},
    TO: {nome: 'Tocantins', interna: .20, fcp: 0}
  };

  // Alíquota interestadual (Res. Senado 22/1989 e 13/2012)
  function interestadual(origem, destino, importado) {
    if (origem === destino) return null;
    if (importado) return .04;
    const o = UF[origem], d = UF[destino];
    return o && o.ss && !(d && d.ss) ? .07 : .12;
  }

  // Fator da reforma: ICMS a 90%, 80%, 70% e 60% em 2029–2032; extinto em 2033 (EC 132/2023, ADCT, art. 128)
  function fatorReforma(ano) { return ano <= 2028 ? 1 : ano >= 2033 ? 0 : 1 - .1 * (ano - 2028); }

  const brl = v => (v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 2});
  const pc = v => (v * 100).toFixed(2).replace('.', ',') + '%';

  /* e: {origem, destino, destinatario: 'revenda'|'consumo'|'naocontrib', importado,
   *     produtos, frete, despesas (seguro e outras), desconto, ipi,
   *     valorComICMS (bool: valores já incluem o ICMS, padrão true; se false, faz o gross-up),
   *     reducaoBC (fração), aliqInterna (override destino/operação interna), fcp (override), aliqOrigemInterna (override p/ interna),
   *     baseDifal: 'dupla'|'unica', st: {ativo, mva, aliqInterna, fcp}} */
  function calcular(e) {
    const interna = e.origem === e.destino;
    const uo = UF[e.origem] || {}, ud = UF[e.destino] || {};
    const aliqDest = e.aliqInterna != null && e.aliqInterna !== '' ? +e.aliqInterna : (ud.interna || 0);
    const fcpDest = e.fcp != null && e.fcp !== '' ? +e.fcp : (ud.fcp || 0);
    const ai = interna ? aliqDest : interestadual(e.origem, e.destino, e.importado);
    const fcpOp = interna ? fcpDest : 0;
    const red = Math.min(1, Math.max(0, +e.reducaoBC || 0));
    const consumidorFinal = e.destinatario !== 'revenda';
    // IPI integra a base quando o destino é consumo/uso ou não contribuinte (LC 87/1996, art. 13, parágrafo 2º)
    const ipiNaBase = consumidorFinal;
    const n = k => Math.max(0, +e[k] || 0);
    let soma = n('produtos') + n('frete') + n('despesas') - n('desconto') + (ipiNaBase ? n('ipi') : 0);
    const memoria = [], avisos = [];
    const comICMS = e.valorComICMS !== false;
    let valorOp = soma;
    if (!comICMS) { valorOp = soma / (1 - (ai + fcpOp) * (1 - red)); memoria.push('Valores informados sem ICMS: o imposto é calculado por dentro, então a base é ' + brl(soma) + ' ÷ (1 − ' + pc((ai + fcpOp) * (1 - red)) + ') = ' + brl(valorOp) + ' (LC 87/1996, art. 13, parágrafo 1º, I).'); }
    const base = valorOp * (1 - red);
    const icms = base * ai, fcp = base * fcpOp;
    memoria.push('Base de cálculo: produtos + frete + despesas − desconto' + (ipiNaBase ? ' + IPI (destinatário consumidor final)' : '') + (red ? ', com redução de ' + pc(red) : '') + ' = ' + brl(base) + '.');
    memoria.push((interna ? 'Operação interna em ' + (uo.nome || e.origem) : 'Operação interestadual ' + e.origem + ' → ' + e.destino + (e.importado ? ' com importado (conteúdo de importação acima de 40%)' : '')) + ': alíquota ' + pc(ai) + (fcpOp ? ' + FCP ' + pc(fcpOp) : '') + ' → ICMS ' + brl(icms) + (fcpOp ? ' + FCP ' + brl(fcp) : '') + '.');
    const out = {interna, aliqOperacao: ai, aliqDestino: aliqDest, fcpDestino: fcpDest, base, valorOp, icms, fcp, difal: 0, fcpDifal: 0, st: 0, fcpSt: 0, memoria, avisos};

    // DIFAL — EC 87/2015, LC 190/2022
    if (!interna && consumidorFinal) {
      const dupla = e.destinatario === 'naocontrib' || e.baseDifal !== 'unica';
      let difal, baseDest;
      if (aliqDest + fcpDest <= ai) { difal = 0; baseDest = base; }
      else if (dupla) {
        baseDest = (base - icms) / (1 - aliqDest - fcpDest);
        difal = baseDest * aliqDest - icms;
        memoria.push('DIFAL com base dupla (Convênio ICMS 236/2021; LC 87/1996, art. 13, parágrafo 1º, I, com a LC 190/2022): (' + brl(base) + ' − ' + brl(icms) + ') ÷ (1 − ' + pc(aliqDest + fcpDest) + ') = ' + brl(baseDest) + '; DIFAL = ' + brl(baseDest) + ' × ' + pc(aliqDest) + ' − ' + brl(icms) + ' = ' + brl(difal) + '.');
      } else {
        baseDest = base; difal = base * (aliqDest - ai);
        memoria.push('DIFAL com base única: ' + brl(base) + ' × (' + pc(aliqDest) + ' − ' + pc(ai) + ') = ' + brl(difal) + '.');
      }
      out.difal = Math.max(0, difal); out.fcpDifal = baseDest * fcpDest; out.baseDifal = baseDest;
      if (fcpDest) memoria.push('FCP do destino sobre a base do DIFAL: ' + brl(baseDest) + ' × ' + pc(fcpDest) + ' = ' + brl(out.fcpDifal) + '.');
      memoria.push(e.destinatario === 'naocontrib' ? 'Não contribuinte: o remetente recolhe o DIFAL ao estado de destino (GNRE ou inscrição no destino), conforme a LC 190/2022.' : 'Contribuinte (uso, consumo ou ativo imobilizado): o destinatário recolhe o DIFAL no seu estado. Confira se a lei do destino usa base única ou dupla.');
      if (e.destinatario !== 'naocontrib') avisos.push('Base do DIFAL para contribuinte: varia por estado. A tela usa ' + (dupla ? 'base dupla' : 'base única') + '; ajuste conforme a legislação do destino. Optante do Simples recolhe o DIFAL de entrada só se a lei do estado prever (LC 123/2006, art. 13, parágrafo 1º, XIII, "h").');
    }

    // ICMS-ST — LC 87/1996, arts. 6º a 10; Convênio ICMS 142/2018
    if (e.st && e.st.ativo) {
      const mva = Math.max(0, +e.st.mva || 0);
      const aIntST = e.st.aliqInterna != null && e.st.aliqInterna !== '' ? +e.st.aliqInterna : aliqDest;
      const fcpST = e.st.fcp != null && e.st.fcp !== '' ? +e.st.fcp : fcpDest;
      let mvaAj = mva;
      if (!interna && aIntST > ai) mvaAj = (1 + mva) * (1 - ai) / (1 - aIntST) - 1;
      const baseST = (valorOp + (ipiNaBase ? 0 : n('ipi'))) * (1 + mvaAj) * (1 - red); // valor da operação com ICMS próprio, IPI, frete e despesas
      out.st = Math.max(0, baseST * aIntST - icms); out.fcpSt = Math.max(0, baseST * fcpST - fcp); out.baseST = baseST; out.mvaAjustada = mvaAj;
      memoria.push('ICMS-ST: MVA ' + pc(mva) + (mvaAj !== mva ? ', ajustada para ' + pc(mvaAj) + ' = (1 + MVA) × (1 − ' + pc(ai) + ') ÷ (1 − ' + pc(aIntST) + ') − 1 (Convênio ICMS 142/2018, cláusula 9ª)' : '') + '. Base ST (com IPI) = ' + brl(baseST) + '; ST = ' + brl(baseST) + ' × ' + pc(aIntST) + ' − ICMS próprio ' + brl(icms) + ' = ' + brl(out.st) + '.');
      if (fcpST) memoria.push('FCP-ST: ' + brl(baseST) + ' × ' + pc(fcpST) + ' − FCP próprio = ' + brl(out.fcpSt) + '.');
      if (consumidorFinal && !interna) avisos.push('Com ST para consumidor final, confira se o protocolo/convênio do produto prevê ST nessa operação; em regra o DIFAL substitui a ST quando a mercadoria vai para uso e consumo.');
      avisos.push('A MVA e a sujeição à ST dependem do produto (NCM/CEST) e do convênio ou protocolo entre os estados. Confira no RICMS do destino.');
    }
    out.total = icms + fcp + out.difal + out.fcpDifal + out.st + out.fcpSt;
    out.cargaPct = out.valorOp ? out.total / out.valorOp : 0;
    if (ud.obs && !interna) avisos.push(ud.nome + ': ' + ud.obs);
    if (uo.obs && interna) avisos.push(uo.nome + ': ' + uo.obs);
    out.projecao = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map(a => ({ano: a, fator: fatorReforma(a), total: out.total * fatorReforma(a)}));
    return out;
  }

  /* Previsão com a reforma até 2033 (EC 132/2023; LC 214/2025): a mesma operação ano a ano.
   * ICMS (com FCP, DIFAL e ST) a 100% até 2028, 90/80/70/60% em 2029–2032 e zero em 2033; PIS/COFINS até 2026;
   * CBS e IBS por fora, sobre o valor da operação sem ICMS e sem PIS/COFINS (LC 214/2025, art. 12, parágrafo 2º, e art. 13 a partir de 2027).
   * p: {cbsRef, ibsRef, reducao (0, .3, .6, 1), pisCofins (.0365 | .0925 | 0)} */
  function previsao(r, p) {
    const cbsRef = p.cbsRef != null ? +p.cbsRef : .113, ibsRef = p.ibsRef != null ? +p.ibsRef : .187;
    const red = Math.min(1, Math.max(0, +p.reducao || 0)), pc0 = Math.max(0, +p.pisCofins || 0);
    const icmsBase = r.total;
    const semICMS = Math.max(0, r.valorOp - r.icms - r.fcp); // valor da mercadoria sem o ICMS próprio
    return [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map(ano => {
      const f = fatorReforma(ano), ali = M.aliquotas(ano, cbsRef, ibsRef);
      const icms = icmsBase * f;
      const pisCofins = ano <= 2026 ? semICMS * pc0 : 0; // Tema 69 do STF: ICMS fora da base
      const base = semICMS; // premissa: preço líquido da mercadoria constante; ICMS por dentro, CBS/IBS por fora
      const cbs = base * ali.cbs * (1 - red), ibs = base * ali.ibs * (1 - red);
      const teste = !!ali.teste;
      const custo = icms + pisCofins + (teste ? 0 : cbs + ibs);
      return {ano, base, fatorICMS: f, aliqCbs: ali.cbs * (1 - red), aliqIbs: ali.ibs * (1 - red), icms, pisCofins, cbs, ibs, teste, total: custo, pct: r.valorOp ? custo / r.valorOp : 0};
    });
  }

  const api = {UF, interestadual, fatorReforma, calcular, previsao};
  if (typeof module === 'object' && module.exports) module.exports = api; else raiz.ICMS = api;
})(typeof self !== 'undefined' ? self : this);
