/* Módulo Venda de Imóveis — Controller & Oraculu's
 * Compara a venda de um ou mais imóveis pela pessoa física e pela pessoa jurídica (Presumido e Real), com CBS/IBS a partir de 2027.
 * Parâmetros conferidos em 05/11/2026. Depende de motor.js (Motor.aliquotas, Motor.PARAM) e ipca.js (IPCA.fator, IPCA.redutorSocial).
 * Fontes:
 *  PF — Lei 7.713/1988, art. 18 (redução para aquisição até 1988); Lei 11.196/2005, arts. 39 (reinvestimento em 180 dias) e 40 (FR1/FR2);
 *       Lei 9.250/1995, art. 23 (único imóvel até R$ 440 mil); Lei 8.981/1995, art. 21, com a Lei 13.259/2016 (15% a 22,5%);
 *       LC 214/2025, art. 251 (quando a PF é contribuinte de CBS/IBS).
 *  PJ — Lei 9.249/1995, arts. 15 e 20 (presunção 8%/12%); Lei 9.430/1996, arts. 25, II, e 29 (ganho de capital no Presumido);
 *       Lei 9.718/1998, art. 3º, parágrafo 2º, IV, e Lei 10.833/2003, art. 1º, parágrafo 3º, II (sem PIS/COFINS na venda do ativo não circulante);
 *       IN RFB 1.700/2017, art. 215, parágrafo 14; Lei 9.250/1995, art. 6º-A, com a Lei 15.270/2025 (IRRF de 10% sobre lucros acima de R$ 50 mil/mês).
 *  CBS/IBS — LC 214/2025, arts. 12, 251, 257 a 259, 261 e 488; Res. CGIBS 6/2026, arts. 375 e 376.
 * Sem DOM: roda no navegador e no Node. */
(function (raiz) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const M = node ? require('./motor.js') : raiz.MotorCO;
  const IP = node ? require('./ipca.js') : raiz.IpcaCO;
  const P = M.PARAM;

  const PV = {
    faixasGC: [[5e6, .15], [1e7, .175], [3e7, .20], [Infinity, .225]],
    isencaoUnico: 440000,
    reducaoImoveis: .5,
    redutorSocial: {novo: 100000, lote: 30000},
    presuncao: {ir: .08, cs: .12},
    pisCofinsCumul: .0365, pisCofinsNaoCumul: .0925,
    irpj: .15, adicional: .10, limiteMes: 20000, csll: .09,
    irrfLucros: {aliquota: .10, limiteMes: 50000}
  };
  const memo = (texto, valor) => ({texto, valor});
  const idx = s => IP.idx(s);
  const rot = s => { const [a, m] = String(s).split('-'); return m + '/' + a; };

  // Imposto de ganho de capital da PF, progressivo por operação
  function impostoGC(base) {
    let t = 0, ant = 0;
    for (const [lim, a] of PV.faixasGC) { if (base > ant) t += (Math.min(base, lim) - ant) * a; ant = lim; }
    return t;
  }

  // Fatores de redução da PF (Lei 7.713/1988, art. 18; Lei 11.196/2005, art. 40)
  function fatoresPF(aquisicao, venda) {
    const aAno = +String(aquisicao).slice(0, 4);
    const red7713 = aAno <= 1988 ? Math.min(1, .05 * (1989 - aAno)) : 0;
    const iAq = idx(aquisicao), iV = idx(venda), nov05 = idx('2005-11'), dez05 = idx('2005-12');
    let m1 = 0, m2;
    if (iAq <= nov05) { m1 = Math.max(0, Math.min(nov05, iV) - Math.max(iAq, idx('1996-01'))); m2 = Math.max(0, iV - dez05); }
    else m2 = Math.max(0, iV - iAq);
    const fr1 = 1 / Math.pow(1.006, m1), fr2 = 1 / Math.pow(1.0035, m2);
    return {red7713, m1, m2, fr1, fr2};
  }

  // CBS/IBS de um imóvel no regime regular (LC 214/2025): redutor de ajuste, redutor social, art. 488 e alíquota com redução de 50%
  function cbsIbs(im, e, ali, ano) {
    if (im.permuta) {
      const torna = Math.max(0, +im.torna || 0);
      const tC = ali.cbs * (1 - PV.reducaoImoveis), tI = ali.ibs * (1 - PV.reducaoImoveis);
      const div = e.precoComTributo ? 1 + tC + tI : 1;
      return {redAjuste: 0, redSocial: 0, base: torna, ded488: 0, cbs: tC * torna / div, ibs: tI * torna / div, tC, tI,
        memoria: [memo(im.descricao + ' — permuta: CBS/IBS só sobre a torna; o valor permutado não paga e não entra no redutor (LC 214, art. 252, parágrafos 2º, I, e 3º). Premissa conservadora: torna sem redutor de ajuste', torna),
          memo(im.descricao + ' — CBS/IBS sobre a torna', tC * torna / div + tI * torna / div)]};
    }
    const vref = +im.valorReferencia || 0;
    const fat = IP.fator(im.aquisicao, e.venda);
    let redAjuste, origem;
    if (vref > 0 && idx(im.aquisicao) <= idx('2026-12')) { redAjuste = vref * IP.fator('2027-01', e.venda); origem = 'valor de referência (art. 258, I, b) corrigido pelo IPCA desde 01/2027'; }
    else { redAjuste = (+im.custo || 0) * fat; origem = 'valor de aquisição × IPCA ' + rot(im.aquisicao) + ' a ' + (idx(e.venda) > IP.ultimo ? IP.ultimoRotulo + ' (último publicado)' : rot(e.venda)) + ' (fator ' + fat.toFixed(6).replace('.', ',') + ')'; }
    const R = +im.valor || 0;
    const base0 = Math.max(0, R - redAjuste);
    const nominal = im.tipo === 'novo' ? PV.redutorSocial.novo : im.tipo === 'lote' ? PV.redutorSocial.lote : 0;
    const redSocial = Math.min(base0, nominal ? IP.redutorSocial(nominal, e.venda) : 0);
    const base = base0 - redSocial;
    const ded488 = ano >= 2029 ? Math.min(base, Math.max(0, +im.ded488 || 0)) : 0;
    const tC = ali.cbs * (1 - PV.reducaoImoveis), tI = ali.ibs * (1 - PV.reducaoImoveis);
    const div = e.precoComTributo ? 1 + tC + tI : 1;
    const cbs = tC * base / div, ibs = tI * (base - ded488) / div;
    return {redAjuste, origem, redSocial, base, ded488, cbs, ibs, tC, tI,
      memoria: [memo(im.descricao + ' — redutor de ajuste: ' + origem, -redAjuste),
        memo(im.descricao + ' — redutor social' + (nominal ? ' (R$ ' + nominal.toLocaleString('pt-BR') + ' corrigido pelo IPCA; art. 259)' : ' (não se aplica a imóvel usado ou não residencial)'), -redSocial),
        ded488 ? memo(im.descricao + ' — dedução do art. 488 só na base do IBS (aquisições 2027–2032 com ICMS/ISS)', -ded488) : null,
        memo(im.descricao + ' — base de CBS/IBS', base),
        memo(im.descricao + ' — CBS ' + (tC * 100).toFixed(2).replace('.', ',') + '% + IBS ' + (tI * 100).toFixed(2).replace('.', ',') + '% (alíquotas com redução de 50%, art. 261)' + (e.precoComTributo ? ', extraídas do preço' : ''), cbs + ibs)].filter(Boolean)};
  }

  function irpjCsll(baseIR, baseCS, meses) {
    const lim = PV.limiteMes * meses;
    const irpj = PV.irpj * baseIR, adic = PV.adicional * Math.max(0, baseIR - lim);
    return {irpj, adic, csll: PV.csll * baseCS, lim};
  }
  function lc224(R, ano) {
    const lim = P.lc224.limiteAno, frac = R > lim ? (R - lim) / R : 0;
    return {fIR: 1 + P.lc224.acrescimo * frac, fCS: 1 + P.lc224.acrescimo * frac * (ano === 2026 ? .75 : 1), aplicou: frac > 0};
  }

  // e: {venda 'AAAA-MM', imoveis:[{descricao, valor, custo, aquisicao 'AAAA-MM', tipo 'novo'|'usado'|'lote'|'comercial', contabil, valorReferencia, ded488, reinvest (0–1)}],
  //     corretagem por imóvel; fracaoVista (0–1, PF a prazo); prejuizo (R$, Lucro Real); cbsRef, ibsRef (frações), classificacao 'estoque'|'ativo', trimestral, socios, distribuir, pfContribuinte, unico440, precoComTributo}
  function calcular(e) {
    const ano = +String(e.venda).slice(0, 4);
    const ali = M.aliquotas(ano, +e.cbsRef, +e.ibsRef);
    const reforma = ano >= 2027;
    const ims = (e.imoveis || []).filter(i => +i.valor > 0 || (i.permuta && (+i.torna > 0 || +i.recebido > 0))).map((i, k) => {
      const im = Object.assign({descricao: 'Imóvel ' + (k + 1), tipo: 'usado'}, i);
      const custo = +im.custo || 0, cont = im.contabil != null && im.contabil !== '' ? +im.contabil : custo;
      if (im.permuta) {
        // Permuta: tributa-se a torna, com custo proporcional — torna ÷ (torna + imóvel recebido) (IN SRF 84/2001, art. 23; IN SRF 107/1988)
        const torna = Math.max(0, +im.torna || 0), rec = Math.max(0, +im.recebido || 0);
        const prop = torna + rec > 0 ? torna / (torna + rec) : 0;
        const risco = !!e.permutaRiscoRFB;
        im._rec = risco ? torna + rec : torna; im._custo = risco ? custo : custo * prop; im._cont = risco ? cont : cont * prop; im._prop = prop;
        im.valor = torna + rec;
      } else { im._rec = +im.valor || 0; im._custo = custo; im._cont = cont; }
      return im;
    });
    const out = {ano, ali, cenarios: {}, porImovel: [], avisos: [], meses: e.trimestral ? 3 : 12};
    const Rt = ims.reduce((s, i) => s + i._rec, 0); // receita tributável da PJ (na permuta, a torna)
    const custoT = ims.reduce((s, i) => s + i._custo, 0);

    // CBS/IBS por imóvel (contribuinte do regime regular, a partir de 2027)
    const cbsI = ims.map(i => reforma ? cbsIbs(i, e, ali, ano) : null);
    const cbsT = cbsI.reduce((s, c) => s + (c ? c.cbs : 0), 0), ibsT = cbsI.reduce((s, c) => s + (c ? c.ibs : 0), 0);
    const recLiq = e.precoComTributo && reforma ? Rt - cbsT - ibsT : Rt; // receita bruta sem os tributos destacados

    /* ---------- Pessoa física ---------- */
    {
      const itens = [], mem = [];
      let ir = 0;
      ims.forEach((im, k) => {
        const corr = Math.max(0, +im.corretagem || 0);
        const ganho = im.permuta ? Math.max(0, (+im.torna || 0) - corr - (+im.custo || 0) * im._prop) // permuta: ganho só sobre a torna; sem torna, excluída (IN SRF 84/2001, arts. 23 e 29, IV)
          : Math.max(0, (+im.valor || 0) - corr - (+im.custo || 0)); // corretagem paga pelo vendedor reduz o valor de alienação (IN SRF 84/2001, art. 19, parágrafo 4º)
        const f = fatoresPF(im.aquisicao, e.venda);
        let base = ganho * (1 - f.red7713) * f.fr1 * f.fr2;
        const residencial = im.tipo === 'novo' || im.tipo === 'usado';
        const isentoUnico = !im.permuta && e.unico440 && ims.length === 1 && (+im.valor || 0) <= PV.isencaoUnico;
        if (isentoUnico) base = 0;
        if (residencial && +im.reinvest > 0) base *= 1 - Math.min(1, +im.reinvest);
        const imp = impostoGC(base);
        ir += imp;
        out.porImovel[k] = {descricao: im.descricao, valor: +im.valor || 0, ganhoPF: ganho, basePF: base, irPF: imp, permuta: !!im.permuta};
        if (im.permuta) {
          // Custo do imóvel recebido = custo do dado menos a parcela baixada pela torna (IN SRF 84/2001; IN SRF 107/1988)
          const custoRec = (+im.custo || 0) * (1 - im._prop), contRec = (im.contabil != null && im.contabil !== '' ? +im.contabil : (+im.custo || 0)) * (1 - im._prop);
          Object.assign(out.porImovel[k], {recebido: +im.recebido || 0, torna: +im.torna || 0, municipioRecebido: im.municipioRecebido || '',
            custoRecebidoPF: custoRec, custoRecebidoPJ: e.permutaRiscoRFB ? (+im.recebido || 0) : contRec});
        }
        mem.push(memo(im.descricao + (im.permuta ? ' — permuta: ganho = torna − custo × ' + (im._prop * 100).toFixed(2).replace('.', ',') + '% (torna ÷ torna + imóvel recebido)' + (+im.torna ? '' : '; sem torna, não há ganho tributável') : ' — ganho de capital (venda' + (corr ? ' − corretagem' : '') + ' − custo)'), ganho));
        if (f.red7713) mem.push(memo('Redução da Lei 7.713/1988, art. 18 (aquisição em ' + String(im.aquisicao).slice(0, 4) + '): ' + Math.round(f.red7713 * 100) + '%', null));
        mem.push(memo('FR1 = 1/1,0060^' + f.m1 + ' = ' + f.fr1.toFixed(6).replace('.', ',') + '; FR2 = 1/1,0035^' + f.m2 + ' = ' + f.fr2.toFixed(6).replace('.', ',') + ' (Lei 11.196/2005, art. 40)', null));
        if (isentoUnico) mem.push(memo('Isento: único imóvel, venda até R$ 440 mil (Lei 9.250/1995, art. 23)', null));
        if (residencial && +im.reinvest > 0) mem.push(memo('Isenção proporcional ao valor reinvestido em residencial em 180 dias (' + Math.round(Math.min(1, +im.reinvest) * 100) + '%; Lei 11.196/2005, art. 39)', null));
        mem.push(memo(im.descricao + ' — base tributável e IR (15% a 22,5%)', base), memo('IR sobre ganho de capital', imp));
      });
      itens.push({nome: 'IR sobre ganho de capital (PF)', valor: ir});
      const vista = e.fracaoVista == null || e.fracaoVista === '' ? 1 : Math.min(1, Math.max(0, +e.fracaoVista));
      if (vista < 1) mem.push(memo('Venda a prazo: IR proporcional ao recebido; no mês da venda (' + Math.round(vista * 100) + '% do preço) vence', ir * vista), memo('IR diferido, pago no mês seguinte a cada parcela recebida (IN SRF 84/2001, art. 31)', ir * (1 - vista)));
      let cons = 0;
      if (reforma && e.pfContribuinte) {
        itens.push({nome: 'CBS', valor: cbsT}, {nome: 'IBS', valor: ibsT}); cons = cbsT + ibsT;
        cbsI.forEach(c => { mem.push(...c.memoria); });
      }
      out.cenarios.pf = {nome: 'Pessoa física', itens, irMesVenda: ir * vista, total: ir + cons, irrf: 0, totalComIrrf: ir + cons, liquido: ims.reduce((a, i) => a + (i.permuta ? +i.torna || 0 : +i.valor || 0), 0) - ims.reduce((a, i) => a + Math.max(0, +i.corretagem || 0), 0) - ir - (e.precoComTributo ? cons : 0), memoria: mem};
      if (reforma && !e.pfContribuinte) out.avisos.push('Pessoa física sem CBS/IBS: só vira contribuinte se, no ano anterior, vendeu mais de 3 imóveis ou mais de 1 imóvel construído por ela nos 5 anos anteriores, ou se passar desses limites no próprio ano (LC 214, art. 251). Marque a opção se for o caso.');
    }

    /* ---------- Pessoa jurídica ---------- */
    const ativo = e.classificacao === 'ativo';
    const corrT = ims.reduce((s, i) => s + Math.max(0, +i.corretagem || 0), 0);
    const prejuizo = Math.max(0, +e.prejuizo || 0);
    const contabilT = ims.reduce((s, i) => s + i._cont, 0);
    const meses = out.meses;
    const montarPJ = (regime) => {
      const itens = [], mem = [];
      let consumo = 0;
      // PIS/COFINS até 2026; CBS/IBS a partir de 2027 (PIS/COFINS extintos)
      if (!reforma) {
        let pc = 0;
        if (ativo) mem.push(memo('Sem PIS/COFINS: venda de bem do ativo não circulante (Lei 9.718/1998, art. 3º, parágrafo 2º, IV; Lei 10.833/2003, art. 1º, parágrafo 3º, II)', 0));
        else if (regime === 'presumido') { pc = PV.pisCofinsCumul * Rt; mem.push(memo('PIS/COFINS cumulativos 3,65% sobre a receita', pc)); }
        else { pc = PV.pisCofinsNaoCumul * Math.max(0, Rt - custoT); mem.push(memo('PIS/COFINS 9,25% com crédito sobre o custo do imóvel', pc)); }
        if (pc) itens.push({nome: 'PIS/COFINS', valor: pc});
        consumo = pc;
      } else {
        itens.push({nome: 'CBS', valor: cbsT}, {nome: 'IBS', valor: ibsT});
        consumo = cbsT + ibsT;
        cbsI.forEach(c => mem.push(...c.memoria));
      }
      // IRPJ/CSLL
      let baseIR, baseCS, descr;
      if (ativo) {
        const ganho = Math.max(0, recLiq - contabilT - (regime === 'real' ? corrT : 0));
        baseIR = baseCS = ganho;
        descr = 'Ganho de capital = receita − custo contábil (' + (regime === 'presumido' ? 'Lei 9.430/1996, art. 25, II, e art. 29; IN RFB 1.700/2017, art. 215, parágrafo 14' : 'compõe o lucro real') + ')';
      } else if (regime === 'presumido') {
        const q = lc224(recLiq * 12 / meses, ano);
        baseIR = recLiq * PV.presuncao.ir * q.fIR; baseCS = recLiq * PV.presuncao.cs * q.fCS;
        descr = 'Presunção IRPJ ' + (PV.presuncao.ir * q.fIR * 100).toFixed(2).replace('.', ',') + '% e CSLL ' + (PV.presuncao.cs * q.fCS * 100).toFixed(2).replace('.', ',') + '% sobre a receita (Lei 9.249/1995)';
        if (q.aplicou) out.avisos.push('Receita acima de R$ 5 milhões no ano: aplicado o acréscimo de presunção da LC 224/2025 (em discussão no STF).');
      } else {
        const pc = reforma ? 0 : consumo;
        baseIR = baseCS = Math.max(0, recLiq - custoT - pc - corrT);
        descr = 'Lucro real = receita − custo do imóvel' + (corrT ? ' − corretagem' : '') + (reforma ? '' : ' − PIS/COFINS');
      }
      if (regime === 'real' && prejuizo > 0) {
        const comp = Math.min(prejuizo, .3 * baseIR);
        mem.push(memo('Compensação de prejuízo fiscal e base negativa até 30% do lucro (Lei 9.065/1995, arts. 15 e 16)', -comp));
        baseIR -= comp; baseCS -= Math.min(prejuizo, comp);
        if (ativo) out.avisos.push('Lucro Real com venda do ativo: no IRPJ, prejuízo não operacional só compensa lucro da mesma natureza (Lei 12.973/2014, art. 43; IN RFB 1.700/2017, art. 205); a CSLL não tem essa restrição. Confira a natureza do prejuízo informado.');
      }
      const t = irpjCsll(baseIR, baseCS, meses);
      mem.unshift(memo(descr, baseIR));
      mem.push(memo('IRPJ 15%', t.irpj), memo('Adicional de 10% acima de ' + (meses === 3 ? 'R$ 60 mil (venda num único trimestre)' : 'R$ 240 mil no ano'), t.adic), memo('CSLL 9%', t.csll));
      itens.unshift({nome: 'IRPJ', valor: t.irpj}, {nome: 'Adicional de IRPJ', valor: t.adic}, {nome: 'CSLL', valor: t.csll});
      const total = itens.reduce((s, i) => s + i.valor, 0);
      // Distribuição aos sócios (Lei 15.270/2025)
      const lucroDistr = Math.max(0, recLiq - custoT - corrT - (total - (reforma ? consumo : 0)));
      const socios = Math.max(1, Math.round(+e.socios || 1));
      const porSocio = lucroDistr / socios;
      const irrf = e.distribuir && porSocio > PV.irrfLucros.limiteMes ? lucroDistr * PV.irrfLucros.aliquota : 0;
      if (e.distribuir) mem.push(memo('Lucro distribuído no mês (receita − custo − tributos), ' + socios + ' sócio(s): ' + (porSocio > PV.irrfLucros.limiteMes ? 'acima de R$ 50 mil por sócio, IRRF de 10% sobre o total' : 'até R$ 50 mil por sócio, sem IRRF') + ' (Lei 9.250/1995, art. 6º-A)', irrf));
      return {nome: (regime === 'presumido' ? 'PJ — Lucro Presumido' : 'PJ — Lucro Real') + (ativo ? ' (ativo não circulante)' : ' (estoque)'), itens, total, irrf, totalComIrrf: total + irrf,
        liquido: Rt - corrT - total - irrf + (reforma && !e.precoComTributo ? consumo : 0), lucroDistr, memoria: mem};
    };
    out.cenarios.presumido = montarPJ('presumido');
    out.cenarios.real = montarPJ('real');
    ims.forEach((im, k) => { if (cbsI[k]) Object.assign(out.porImovel[k], {redAjuste: cbsI[k].redAjuste, redSocial: cbsI[k].redSocial, baseCbsIbs: cbsI[k].base, cbsIbs: cbsI[k].cbs + cbsI[k].ibs}); });

    if (ano === 2026) out.avisos.push('Em 2026 a CBS (0,9%) e o IBS (0,1%) são de teste e compensados com PIS/COFINS: o cálculo usa as regras atuais. Mude a data da venda para 2027 ou depois para ver a reforma.');
    if (reforma && ativo) out.avisos.push('Desde 2027 a venda de imóvel do ativo imobilizado ou de investimento da PJ do regime regular também tem CBS/IBS, com redutor de ajuste; a exclusão do PIS/COFINS não se repete na LC 214.');
    if (reforma && idx(e.venda) > IP.ultimo) out.avisos.push('IPCA publicado até ' + IP.ultimoRotulo + '; os meses seguintes entram como 0% até a divulgação (o redutor real será um pouco maior).');
    if (ims.some(i => idx(i.aquisicao) >= idx('2027-01'))) out.avisos.push('Imóvel adquirido a partir de 2027: o redutor de ajuste é o valor da aquisição corrigido (art. 258, III), limitado nas revendas em menos de 3 anos sem comprovação de IR/ITBI (art. 258, parágrafo 5º).');
    if (ims.some(i => i.permuta)) out.avisos.push(e.permutaRiscoRFB
      ? 'Permuta — cenário de risco: o imóvel recebido entra como receita da PJ (entendimento antigo da Receita para o Presumido). O STJ e o CARF afastam essa cobrança, e a Receita passou a tributar só a torna (SC COSIT 99/2024).'
      : 'Permuta: PJ e PF tributam só a torna, com custo proporcional (IN SRF 84/2001, arts. 23 e 29, IV; IN SRF 107/1988; para o Presumido, STJ e SC COSIT 99/2024). CBS/IBS só sobre a torna (LC 214, art. 252). O imóvel recebido fica com o custo do imóvel dado, menos a parcela baixada pela torna; cada permutante paga o ITBI do imóvel que adquire (veja as linhas de ITBI e de patrimônio na tabela).');
    if (corrT) out.avisos.push('Corretagem: reduz o ganho da PF e é despesa no Lucro Real; no Presumido não é dedutível. A partir de 2027, a CBS/IBS cobrada na corretagem dá crédito à PJ contribuinte (não considerado aqui).');
    if (e.distribuir) out.avisos.push('O IRRF de 10% sobre lucros é antecipação do imposto mínimo anual (IRPFM) do sócio; distribuições até R$ 50 mil por mês por sócio não têm retenção. Na PF a comparação considera só o IR de ganho de capital.');
    out.receita = Rt; out.custo = custoT; out.valorTotal = ims.reduce((a, i) => a + (+i.valor || 0), 0);
    return out;
  }

  const api = {PV, calcular, fatoresPF, impostoGC};
  if (node) module.exports = api; else raiz.Venda = api;
})(typeof self !== 'undefined' ? self : this);
