/*
 * Gestor de Apuração Assistida (IBS/CBS): leitura de arquivos, conciliação em três vias,
 * situação de cada crédito e débito, motor de regras, fila de ações e simulação de RAD.
 *
 * Funções puras, sem DOM: o mesmo arquivo roda no navegador e no Node (testes).
 * Nada aqui consulta a Receita. Os dados vêm de arquivos que o usuário importa:
 *   - "xml":   NF-e da sua base (o que a empresa emitiu e recebeu)
 *   - "fisco": extrato da apuração assistida (layout próprio, ver MODELO_EXTRATO)
 *   - "erp":   exportação do ERP (opcional)
 *
 * PREMISSAS que dependem de confirmação estão marcadas com "PREMISSA".
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else { raiz.Motor = raiz.Motor || {}; raiz.Motor.apuracao = fabrica(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIA = 86400000;

  /* ===== Parâmetros padrão (todos ajustáveis em Configurações > Prazos) ===== */
  const PADROES = {
    // PREMISSA: dias, contados da emissão, em que se espera o débito do fornecedor extinto.
    prazoRecolhimentoDias: 30,
    diasAtencaoAntes: 5,       // vira "atenção" X dias antes do vencimento
    diasCriticoDepois: 30,     // vira "crítico" X dias depois do vencimento
    diasFupAntesRad: 10,       // espera da cobrança ao fornecedor antes de o crédito ficar elegível para RAD
    // PREMISSA: dia do mês seguinte até o qual a competência aceita ajuste. Confirmar na regulamentação.
    diaFimAjuste: 20,
    diasAvisoFimAjuste: 5,
    diasDadoDesatualizado: 3,  // extrato mais velho que isso gera alerta na tela
    tolerancia: 0.01,          // R$ de diferença aceita na conciliação
    tetoRadPadrao: 0,          // R$ por empresa e competência. 0 = RAD desligado até alguém definir o teto
    contaTransitoria: 'CBS/IBS a apropriar (transitória)',
    contaDefinitiva: 'CBS/IBS a recuperar',
  };

  const SITUACOES = {
    credito: [
      ['aguardando', 'Aguardando processamento'],
      ['pendente', 'Pendente'],
      ['apropriado_parcial', 'Apropriado parcial'],
      ['apropriado_total', 'Apropriado total'],
    ],
    debito: [
      ['aguardando', 'Aguardando processamento'],
      ['nao_extinto', 'Não extinto'],
      ['extinto_parcial', 'Extinto parcial'],
      ['extinto', 'Extinto'],
    ],
  };
  const ROTULO_SITUACAO = Object.fromEntries([...SITUACOES.credito, ...SITUACOES.debito]);

  const FONTES = [['fisco', 'Apuração do Fisco'], ['xml', 'Sua base (XML)'], ['erp', 'ERP']];
  const CAMPOS_DIVERGENCIA = [['vbc', 'Base de cálculo'], ['pcbs', 'Alíquota CBS'], ['vcbs', 'Valor CBS'], ['vibs', 'Valor IBS']];
  const TRATATIVAS = [
    ['pendencia', 'Pendência no painel', 'O documento é retido e sinalizado para decisão humana. Nada é executado.'],
    ['erp', 'Lançamento no ERP', 'Gera o lançamento (transitória → definitiva, ou baixa de débito) para importar no ERP.'],
    ['rad', 'RAD (recolhimento pelo adquirente)', 'Gera a lista de RADs a emitir no portal da apuração. Sujeita a fornecedor autorizado e teto.'],
    ['evento', 'Evento fiscal', 'Lista o evento a registrar na nota junto ao Fisco.'],
    ['ncnd', 'Nota de crédito/débito', 'Lista a NC/ND a emitir para ajuste na apuração.'],
  ];
  const ROTULO_TRATATIVA = Object.fromEntries(TRATATIVAS.map(t => [t[0], t[1]]));

  const CAMPOS_CONDICAO = [
    ['valor_potencial', 'Valor potencial', 'num'],
    ['valor_nao_efetivado', 'Valor não apropriado / não extinto', 'num'],
    ['aging', 'Aging (dias)', 'num'],
    ['fornecedor_cnpj', 'CNPJ da contraparte', 'txt'],
    ['fornecedor_nome', 'Nome da contraparte', 'txt'],
    ['finalidade', 'Finalidade da NF-e (1 normal, 2 compl., 3 ajuste, 4 devolução)', 'txt'],
    ['modelo', 'Modelo (55, 65...)', 'txt'],
    ['forma_extincao', 'Forma de extinção (split, pagamento, compensacao, rad)', 'txt'],
    ['erp_contabilizado', 'Contabilizado no ERP (sim/nao)', 'txt'],
    ['erp_pago', 'Pago no ERP (sim/nao)', 'txt'],
  ];
  const OPERADORES = {num: ['>=', '<=', '=', '!='], txt: ['=', '!=', 'contem']};

  /* ===== Utilitários ===== */
  const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
  function numero(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    let s = String(v == null ? '' : v).trim().replace(/[R$\s%]/g, '');
    if (!s) return 0;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return isFinite(n) ? n : 0;
  }
  // CNPJ: aceita o formato alfanumérico (a partir de 2026); mantém só 0-9 e A-Z
  const limparCnpj = c => String(c || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const baseCnpj = c => limparCnpj(c).slice(0, 8);
  function data(v) {
    const s = String(v || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return m[3] + '-' + m[2] + '-' + m[1];
    return '';
  }
  function competencia(v) {
    const s = String(v || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})/);
    if (m) return m[1] + '-' + m[2];
    m = s.match(/^(\d{2})\/(\d{4})$/);
    if (m) return m[2] + '-' + m[1];
    const d = data(s);
    return d ? d.slice(0, 7) : '';
  }
  const ms = d => Date.parse(d + 'T00:00:00Z');
  const dias = (de, ate) => (de && ate) ? Math.floor((ms(ate) - ms(de)) / DIA) : 0;
  function compSomar(comp, n) {
    const [a, m] = comp.split('-').map(Number);
    const t = a * 12 + (m - 1) + n;
    return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0');
  }
  const simNao = v => /^(s|sim|1|true|y|yes|x)$/i.test(String(v == null ? '' : v).trim());
  const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ===== CSV ===== */
  function lerCSV(texto) {
    const t = String(texto || '').replace(/^﻿/, '');
    const primeira = t.split(/\r?\n/, 1)[0] || '';
    const sep = (primeira.split(';').length >= primeira.split(',').length) ? ';' : ',';
    const linhas = [];
    let linha = [], campo = '', aspas = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (aspas) {
        if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && t[i + 1] === '\n') i++;
        linha.push(campo); campo = '';
        if (linha.some(x => x.trim() !== '')) linhas.push(linha);
        linha = [];
      } else campo += c;
    }
    linha.push(campo);
    if (linha.some(x => x.trim() !== '')) linhas.push(linha);
    if (!linhas.length) return [];
    const cab = linhas[0].map(h => semAcento(h).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    return linhas.slice(1).map(l => Object.fromEntries(cab.map((h, i) => [h, (l[i] || '').trim()])));
  }
  function csv(linhas, colunas) {
    const esc = v => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [colunas.map(c => esc(c[1])).join(';')]
      .concat(linhas.map(l => colunas.map(c => esc(typeof c[0] === 'function' ? c[0](l) : l[c[0]])).join(';')))
      .join('\r\n');
  }

  // Apelidos aceitos no cabeçalho dos CSVs
  const APELIDOS = {
    lado: ['lado', 'tipo', 'natureza', 'credito_debito'],
    chave: ['chave', 'chave_acesso', 'chave_dfe', 'chave_nfe'],
    cnpjEmit: ['cnpj_emitente', 'emitente_cnpj', 'cnpj_fornecedor'],
    nomeEmit: ['nome_emitente', 'emitente', 'razao_emitente', 'fornecedor'],
    cnpjDest: ['cnpj_destinatario', 'destinatario_cnpj', 'cnpj_tomador', 'cnpj_adquirente'],
    nomeDest: ['nome_destinatario', 'destinatario', 'razao_destinatario', 'tomador'],
    data: ['data_emissao', 'data', 'dhemi', 'emissao'],
    competencia: ['competencia', 'periodo', 'mes'],
    vbc: ['base_calculo', 'vbc', 'base'],
    pcbs: ['aliquota_cbs', 'pcbs'],
    vcbs: ['valor_cbs', 'vcbs', 'cbs'],
    vibs: ['valor_ibs', 'vibs', 'ibs'],
    aprCbs: ['cbs_apropriada', 'credito_cbs_apropriado', 'apropriado_cbs'],
    aprIbs: ['ibs_apropriado', 'ibs_apropriada', 'credito_ibs_apropriado', 'apropriado_ibs'],
    extCbs: ['cbs_extinta', 'debito_cbs_extinto', 'extinto_cbs'],
    extIbs: ['ibs_extinto', 'ibs_extinta', 'debito_ibs_extinto', 'extinto_ibs'],
    forma: ['forma_extincao', 'modalidade_extincao', 'extincao'],
    finalidade: ['finalidade', 'finnfe'],
    modelo: ['modelo', 'mod'],
    credPresumido: ['credito_presumido', 'cred_presumido'],
    contabilizado: ['contabilizado'],
    pago: ['pago', 'pagamento'],
  };
  function campo(linha, nome) {
    for (const a of APELIDOS[nome]) if (linha[a] != null && linha[a] !== '') return linha[a];
    return '';
  }
  function ladoDe(v) {
    const s = semAcento(String(v || '')).toLowerCase();
    if (/^(c|cred|credito|entrada|e)$/.test(s)) return 'credito';
    if (/^(d|deb|debito|saida|s)$/.test(s)) return 'debito';
    return '';
  }
  function formaDe(v) {
    const s = semAcento(String(v || '')).toLowerCase();
    if (!s) return '';
    if (s.indexOf('split') >= 0 || s.indexOf('liquida') >= 0) return 'split';
    if (s.indexOf('adquirente') >= 0 || s === 'rad') return 'rad';
    if (s.indexOf('compens') >= 0) return 'compensacao';
    if (s.indexOf('pag') >= 0 || s.indexOf('darf') >= 0 || s.indexOf('pcont') >= 0) return 'pagamento';
    return s;
  }

  function linhaBase(l) {
    return {
      lado: ladoDe(campo(l, 'lado')),
      chave: String(campo(l, 'chave')).replace(/\D/g, ''),
      emit: {cnpj: limparCnpj(campo(l, 'cnpjEmit')), nome: campo(l, 'nomeEmit')},
      dest: {cnpj: limparCnpj(campo(l, 'cnpjDest')), nome: campo(l, 'nomeDest')},
      data: data(campo(l, 'data')),
      competencia: competencia(campo(l, 'competencia')),
      vbc: numero(campo(l, 'vbc')), pcbs: numero(campo(l, 'pcbs')),
      vcbs: numero(campo(l, 'vcbs')), vibs: numero(campo(l, 'vibs')),
      finalidade: String(campo(l, 'finalidade')), modelo: String(campo(l, 'modelo')),
      credPresumido: simNao(campo(l, 'credPresumido')),
    };
  }
  // Extrato da apuração assistida (layout próprio: o layout oficial de exportação do portal não foi verificado)
  function normalizarExtrato(linhas) {
    const ok = [], erros = [];
    linhas.forEach((l, i) => {
      const b = linhaBase(l);
      if (!b.chave || b.chave.length !== 44) { erros.push('Linha ' + (i + 2) + ': chave com ' + b.chave.length + ' dígitos (precisa de 44).'); return; }
      if (!b.lado) { erros.push('Linha ' + (i + 2) + ': coluna "lado" deve ser credito ou debito.'); return; }
      b.aprCbs = numero(campo(l, 'aprCbs')); b.aprIbs = numero(campo(l, 'aprIbs'));
      b.extCbs = numero(campo(l, 'extCbs')); b.extIbs = numero(campo(l, 'extIbs'));
      b.forma = formaDe(campo(l, 'forma'));
      ok.push(b);
    });
    return {linhas: ok, erros};
  }
  function normalizarErp(linhas) {
    const ok = [], erros = [];
    linhas.forEach((l, i) => {
      const b = linhaBase(l);
      if (!b.chave || b.chave.length !== 44) { erros.push('Linha ' + (i + 2) + ': chave inválida.'); return; }
      b.contabilizado = simNao(campo(l, 'contabilizado'));
      b.pago = simNao(campo(l, 'pago'));
      ok.push(b);
    });
    return {linhas: ok, erros};
  }

  /* ===== XML da NF-e (grupo IBSCBS, NT 2025.002) =====
   * PREMISSA: nomes de tags conforme a NT 2025.002 (IBSCBS > gIBSCBS > vBC, vIBS, gCBS > pCBS/vCBS;
   * total em IBSCBSTot). Se o total existir, ele prevalece sobre a soma dos itens. */
  function tag(xml, nome) {
    const m = xml.match(new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>'));
    return m ? m[1] : null;
  }
  function tags(xml, nome) {
    const re = new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>', 'g');
    const out = []; let m;
    while ((m = re.exec(xml))) out.push(m[1]);
    return out;
  }
  const txt = (xml, nome) => { const v = xml && tag(xml, nome); return v == null ? '' : v.trim(); };
  function lerXmlNFe(texto) {
    const x = String(texto || '');
    const inf = x.match(/<(?:\w+:)?infNFe[^>]*\sId="(?:NFe)?(\d{44})"/);
    if (!inf) return {erro: 'Não parece uma NF-e (sem infNFe com chave de 44 dígitos).'};
    const ide = tag(x, 'ide') || '', emit = tag(x, 'emit') || '', dest = tag(x, 'dest') || '';
    let vbc = 0, vcbs = 0, vibs = 0, pcbs = 0, temGrupo = false;
    tags(x, 'det').forEach(det => {
      const g = tag(det, 'IBSCBS'); if (!g) return;
      temGrupo = true;
      const gg = tag(g, 'gIBSCBS') || g;
      vbc += numero(txt(gg, 'vBC'));
      const gcbs = tag(gg, 'gCBS') || '';
      vcbs += numero(txt(gcbs, 'vCBS'));
      if (!pcbs) pcbs = numero(txt(gcbs, 'pCBS'));
      const vi = txt(gg, 'vIBS');
      vibs += vi !== '' ? numero(vi) : numero(txt(gg, 'vIBSUF')) + numero(txt(gg, 'vIBSMun'));
    });
    const tot = tag(x, 'IBSCBSTot');
    if (tot) {
      temGrupo = true;
      const b = txt(tot, 'vBCIBSCBS'); if (b !== '') vbc = numero(b);
      const c = txt(tag(tot, 'gCBS') || '', 'vCBS'); if (c !== '') vcbs = numero(c);
      const i = txt(tag(tot, 'gIBS') || '', 'vIBS'); if (i !== '') vibs = numero(i);
    }
    const doc = (bloco) => limparCnpj(txt(bloco, 'CNPJ') || txt(bloco, 'CPF'));
    return {
      chave: inf[1], modelo: txt(ide, 'mod'), finalidade: txt(ide, 'finNFe'),
      data: data(txt(ide, 'dhEmi') || txt(ide, 'dEmi')),
      emit: {cnpj: doc(emit), nome: txt(emit, 'xNome')},
      dest: {cnpj: doc(dest), nome: txt(dest, 'xNome')},
      vbc: r2(vbc), pcbs, vcbs: r2(vcbs), vibs: r2(vibs), temGrupo,
      credPresumido: /vCredPres>\s*[1-9]/.test(x),
    };
  }

  /* ===== Base unificada: um documento por (lado, chave) ===== */
  function montarBase(fontes, empresasCad) {
    const empresas = new Map();
    (empresasCad || []).forEach(e => empresas.set(e.base || baseCnpj(e.cnpj), Object.assign({regime: 'regular'}, e, {base: e.base || baseCnpj(e.cnpj)})));
    const novasEmpresas = [];
    function garantirEmpresa(p) {
      const b = baseCnpj(p.cnpj);
      if (!b) return null;
      if (!empresas.has(b)) { const e = {base: b, cnpj: p.cnpj, nome: p.nome || p.cnpj, regime: 'regular'}; empresas.set(b, e); novasEmpresas.push(e); }
      return empresas.get(b);
    }
    const mapa = new Map();
    function obter(lado, l) {
      const id = lado + ':' + l.chave;
      let d = mapa.get(id);
      if (!d) {
        const emp = lado === 'credito' ? l.dest : l.emit, cp = lado === 'credito' ? l.emit : l.dest;
        d = {id, chave: l.chave, lado, empresa: {cnpj: emp.cnpj, base: baseCnpj(emp.cnpj), nome: emp.nome},
          contraparte: {cnpj: cp.cnpj, base: baseCnpj(cp.cnpj), nome: cp.nome},
          data: '', competencia: '', modelo: '', finalidade: '', credPresumido: false, xml: null, fisco: null, erp: null};
        mapa.set(id, d);
      }
      // Metadados: a nota (XML) manda; depois o Fisco; depois o ERP
      ['data', 'competencia', 'modelo', 'finalidade'].forEach(k => { if (!d[k] && l[k]) d[k] = l[k]; });
      if (l.credPresumido) d.credPresumido = true;
      if (!d.empresa.nome) d.empresa.nome = (lado === 'credito' ? l.dest : l.emit).nome || '';
      if (!d.contraparte.nome) d.contraparte.nome = (lado === 'credito' ? l.emit : l.dest).nome || '';
      return d;
    }
    (fontes.fisco || []).forEach(l => {
      garantirEmpresa(l.lado === 'credito' ? l.dest : l.emit);
      const d = obter(l.lado, l);
      d.fisco = {vbc: l.vbc, pcbs: l.pcbs, vcbs: l.vcbs, vibs: l.vibs, aprCbs: l.aprCbs, aprIbs: l.aprIbs, extCbs: l.extCbs, extIbs: l.extIbs, forma: l.forma};
    });
    const semEmpresa = [];
    (fontes.xml || []).forEach(n => {
      let usado = false;
      const valores = {vbc: n.vbc, pcbs: n.pcbs, vcbs: n.vcbs, vibs: n.vibs};
      if (empresas.has(baseCnpj(n.dest.cnpj))) { const d = obter('credito', n); d.xml = valores; d.data = n.data || d.data; usado = true; }
      if (empresas.has(baseCnpj(n.emit.cnpj))) { const d = obter('debito', n); d.xml = valores; d.data = n.data || d.data; usado = true; }
      if (!usado) semEmpresa.push(n);
    });
    (fontes.erp || []).forEach(l => {
      let lado = l.lado;
      if (!lado) lado = mapa.has('credito:' + l.chave) ? 'credito' : (mapa.has('debito:' + l.chave) ? 'debito' : '');
      if (!lado) return;
      const d = obter(lado, l);
      d.erp = {vbc: l.vbc, pcbs: l.pcbs, vcbs: l.vcbs, vibs: l.vibs, contabilizado: l.contabilizado, pago: l.pago};
    });
    const docs = [...mapa.values()].map(d => {
      if (!d.competencia && d.data) d.competencia = d.data.slice(0, 7);
      const e = empresas.get(d.empresa.base);
      if (e) d.empresa.nome = d.empresa.nome || e.nome;
      return d;
    });
    return {docs, empresas: [...empresas.values()], novasEmpresas, semEmpresa};
  }

  /* ===== Valores e situação de um documento ===== */
  const de = (f, t) => !f ? 0 : t === 'cbs' ? f.vcbs : t === 'ibs' ? f.vibs : f.vcbs + f.vibs;
  function potencial(doc, t) { return r2(de(doc.fisco || doc.xml || doc.erp, t)); }
  function efetivado(doc, t) {
    const f = doc.fisco; if (!f) return 0;
    const [c, i] = doc.lado === 'credito' ? [f.aprCbs, f.aprIbs] : [f.extCbs, f.extIbs];
    return r2(t === 'cbs' ? c : t === 'ibs' ? i : c + i);
  }
  const naoEfetivado = (doc, t) => r2(Math.max(0, potencial(doc, t) - efetivado(doc, t)));
  function situacao(doc, t, tol) {
    tol = tol == null ? PADROES.tolerancia : tol;
    if (!doc.fisco) return 'aguardando';
    const p = potencial(doc, t), e = efetivado(doc, t);
    const cred = doc.lado === 'credito';
    if (e >= p - tol) return cred ? 'apropriado_total' : 'extinto';
    if (e > tol) return cred ? 'apropriado_parcial' : 'extinto_parcial';
    return cred ? 'pendente' : 'nao_extinto';
  }
  const concluido = s => s === 'apropriado_total' || s === 'extinto';
  // Nível de prazo: no_prazo → atencao → vencido → critico (ou ok, se já apropriado/extinto)
  function nivelPrazo(doc, t, cfg, dataBase) {
    const s = situacao(doc, t, cfg.tolerancia);
    if (concluido(s)) return 'ok';
    const a = dias(doc.data, dataBase), p = cfg.prazoRecolhimentoDias;
    if (a > p + cfg.diasCriticoDepois) return 'critico';
    if (a > p) return 'vencido';
    if (a >= p - cfg.diasAtencaoAntes) return 'atencao';
    return 'no_prazo';
  }
  function enriquecer(doc, t, cfg, dataBase) {
    return Object.assign({}, doc, {
      potencial: potencial(doc, t), efetivado: efetivado(doc, t), naoEfetivado: naoEfetivado(doc, t),
      situacao: situacao(doc, t, cfg.tolerancia), aging: dias(doc.data, dataBase), nivel: nivelPrazo(doc, t, cfg, dataBase),
    });
  }

  /* ===== Filtro global ===== */
  function filtrar(docs, f) {
    if (!f) return docs;
    const forn = semAcento(String(f.fornecedor || '')).toLowerCase().trim();
    const fornNum = limparCnpj(f.fornecedor || '');
    return docs.filter(d => {
      if (f.empresas && f.empresas.length && f.empresas.indexOf(d.empresa.base) < 0) return false;
      if (forn && !(semAcento(d.contraparte.nome || '').toLowerCase().indexOf(forn) >= 0 || (fornNum.length >= 4 && d.contraparte.cnpj.indexOf(fornNum) >= 0))) return false;
      if (f.situacoes && f.situacoes.length && f.situacoes.indexOf(d.situacao) < 0) return false;
      if (f.niveis && f.niveis.length && f.niveis.indexOf(d.nivel) < 0) return false;
      if (f.valorMin !== '' && f.valorMin != null && d.potencial < numero(f.valorMin)) return false;
      if (f.valorMax !== '' && f.valorMax != null && d.potencial > numero(f.valorMax)) return false;
      if (f.agingMin !== '' && f.agingMin != null && d.aging < numero(f.agingMin)) return false;
      if (f.agingMax !== '' && f.agingMax != null && d.aging > numero(f.agingMax)) return false;
      if (f.chave && d.chave.indexOf(String(f.chave).replace(/\D/g, '')) < 0) return false;
      if (f.competencia && d.competencia !== f.competencia) return false;
      return true;
    });
  }

  /* ===== Visão geral ===== */
  function resumoLado(docs, lado, cfg) {
    const ds = docs.filter(d => d.lado === lado);
    const r = {total: 0, efetivado: 0, docs: ds.length, docsConcluidos: 0,
      vencidos: {valor: 0, docs: 0}, noPrazo: {valor: 0, docs: 0}, processando: {valor: 0, docs: 0}, concluidos: {valor: 0, docs: 0}};
    ds.forEach(d => {
      r.total += d.potencial; r.efetivado += d.efetivado;
      if (d.situacao === 'aguardando') { r.processando.valor += d.potencial; r.processando.docs++; return; }
      r.concluidos.valor += d.efetivado;
      if (concluido(d.situacao)) { r.concluidos.docs++; r.docsConcluidos++; return; }
      const b = d.aging > cfg.prazoRecolhimentoDias ? r.vencidos : r.noPrazo;
      b.valor += d.naoEfetivado; b.docs++;
    });
    ['total', 'efetivado'].forEach(k => { r[k] = r2(r[k]); });
    ['vencidos', 'noPrazo', 'processando', 'concluidos'].forEach(k => { r[k].valor = r2(r[k].valor); });
    r.percentual = r.total ? r.efetivado / r.total : 0;
    return r;
  }
  function topContrapartes(docs, lado, n) {
    const g = new Map();
    docs.filter(d => d.lado === lado && !concluido(d.situacao) && d.situacao !== 'aguardando').forEach(d => {
      const k = d.contraparte.base || d.contraparte.cnpj;
      const x = g.get(k) || {base: k, cnpj: d.contraparte.cnpj, nome: d.contraparte.nome, valor: 0, docs: 0, maxAging: 0};
      x.valor += d.naoEfetivado; x.docs++; x.maxAging = Math.max(x.maxAging, d.aging);
      g.set(k, x);
    });
    return [...g.values()].map(x => Object.assign(x, {valor: r2(x.valor)})).sort((a, b) => b.valor - a.valor).slice(0, n || 5);
  }
  const FAIXAS_AGING = [[0, 7, '0 a 7 dias'], [8, 15, '8 a 15 dias'], [16, 30, '16 a 30 dias'], [31, 60, '31 a 60 dias'], [61, Infinity, '+60 dias']];
  function matrizAging(docs, lado, competencias) {
    const pend = docs.filter(d => d.lado === lado && !concluido(d.situacao) && d.situacao !== 'aguardando');
    const linhas = FAIXAS_AGING.map(f => ({rotulo: f[2], valores: competencias.map(c => r2(pend
      .filter(d => d.competencia === c && d.aging >= f[0] && d.aging <= f[1]).reduce((s, d) => s + d.naoEfetivado, 0)))}));
    const total = r2(pend.reduce((s, d) => s + d.naoEfetivado, 0));
    return {competencias, linhas, total, docs: pend.length};
  }
  function saldoApuracao(docs, comp, t, manual) {
    manual = manual || {};
    const doMes = docs.filter(d => d.competencia === comp && d.fisco);
    const creditos = r2(doMes.filter(d => d.lado === 'credito').reduce((s, d) => s + efetivado(d, t), 0));
    const debitos = r2(doMes.filter(d => d.lado === 'debito').reduce((s, d) => s + potencial(d, t), 0));
    const anterior = r2(numero(manual.anterior)), redutores = r2(numero(manual.redutores));
    const saldo = r2(anterior + creditos - debitos - redutores);
    const informado = manual.informado === '' || manual.informado == null ? null : r2(numero(manual.informado));
    return {anterior, creditos, debitos, redutores, saldo, natureza: saldo >= 0 ? 'credor' : 'devedor',
      informado, bate: informado == null ? null : Math.abs(informado - saldo) <= PADROES.tolerancia * 10};
  }
  // Projeção: média dos últimos 3 meses apropriados (tendência) + o pendente ainda no prazo como "a apropriar"
  function projecao(docs, t, dataBase, mesesPassados, mesesFuturos) {
    const atual = dataBase.slice(0, 7);
    const cred = docs.filter(d => d.lado === 'credito');
    const real = [];
    for (let i = (mesesPassados || 3) - 1; i >= 0; i--) {
      const c = compSomar(atual, -i);
      real.push({competencia: c, realizado: r2(cred.filter(d => d.competencia === c).reduce((s, d) => s + efetivado(d, t), 0))});
    }
    const ult = real.slice(-3), media = r2(ult.reduce((s, x) => s + x.realizado, 0) / (ult.length || 1));
    const aApropriar = r2(cred.filter(d => d.situacao === 'pendente' || d.situacao === 'apropriado_parcial' || d.situacao === 'aguardando')
      .reduce((s, d) => s + d.naoEfetivado, 0));
    const fut = [];
    for (let i = 1; i <= (mesesFuturos || 3); i++) fut.push({competencia: compSomar(atual, i), tendencia: media, aApropriar: i === 1 ? aApropriar : 0});
    return {realizado: real, projetado: fut, media, aApropriar, total: r2(real.reduce((s, x) => s + x.realizado, 0) + fut.reduce((s, x) => s + x.tendencia + x.aApropriar, 0))};
  }
  function estadoCompetencia(comp, dataBase, cfg, concluidas) {
    if (concluidas && concluidas[comp]) return {estado: 'concluida', rotulo: 'Concluída'};
    const atual = dataBase.slice(0, 7);
    if (comp === atual) return {estado: 'corrente', rotulo: 'Corrente'};
    if (comp > atual) return {estado: 'futura', rotulo: 'Futura'};
    if (comp === compSomar(atual, -1)) {
      const dia = Number(dataBase.slice(8, 10)), resta = cfg.diaFimAjuste - dia;
      if (resta >= 0) return {estado: 'em_ajuste', rotulo: 'Em ajuste', diasRestantes: resta, perto: resta <= cfg.diasAvisoFimAjuste};
    }
    return {estado: 'encerrada', rotulo: 'Prazo de ajuste encerrado'};
  }

  /* ===== Conciliação em três vias ===== */
  function comparar(a, b, tol) {
    const dif = [];
    if (Math.abs(a.vbc - b.vbc) > tol) dif.push('vbc');
    if (Math.abs(a.pcbs - b.pcbs) > 0.0001) dif.push('pcbs');
    if (Math.abs(a.vcbs - b.vcbs) > tol) dif.push('vcbs');
    if (Math.abs(a.vibs - b.vibs) > tol) dif.push('vibs');
    return dif;
  }
  // par: 'xml' (sua base × Fisco) ou 'erp' (ERP × Fisco)
  function conciliar(docs, par, lado, tol) {
    tol = tol == null ? PADROES.tolerancia : tol;
    const g = {divergente: [], so_fisco: [], so_outro: [], conciliado: []};
    docs.filter(d => d.lado === lado).forEach(d => {
      const a = d[par], b = d.fisco;
      if (!a && !b) return;
      if (!a) { g.so_fisco.push({doc: d, campos: []}); return; }
      if (!b) { g.so_outro.push({doc: d, campos: []}); return; }
      const campos = comparar(a, b, tol);
      g[campos.length ? 'divergente' : 'conciliado'].push({doc: d, campos});
    });
    const soma = arr => r2(arr.reduce((s, x) => s + (x.doc.fisco ? de(x.doc.fisco, 'total') : de(x.doc[par], 'total')), 0));
    const total = Object.values(g).reduce((s, a) => s + a.length, 0);
    return {grupos: g, valores: Object.fromEntries(Object.keys(g).map(k => [k, soma(g[k])])),
      total, percentual: total ? g.conciliado.length / total : 0};
  }

  /* ===== Regras ===== */
  function regraPadrao(o) {
    return Object.assign({
      origem: 'padrao', ligada: true, tributo: 'cbs', lado: 'credito', empresas: [], fornecedores: [], competencia: 'qualquer',
      criterios: {situacoes: [], presenca: {fisco: '', xml: '', erp: ''}, divergencia: [], valorMinimo: 0, idadeMinima: 0,
        exigeFupVencido: false, somenteCredPresumido: false, finalidades: [], combinacao: 'todas', condicoes: []},
      tratativa: 'pendencia', modo: 'observacao', descricao: '',
    }, o, {criterios: Object.assign({
      situacoes: [], presenca: {fisco: '', xml: '', erp: ''}, divergencia: [], valorMinimo: 0, idadeMinima: 0,
      exigeFupVencido: false, somenteCredPresumido: false, finalidades: [], combinacao: 'todas', condicoes: []}, o.criterios || {})});
  }
  const REGRAS_PADRAO = [
    regraPadrao({id: 'p-cred-apropriado-erp', nome: 'Crédito apropriado: transferir da transitória para a definitiva', origem: 'padrao',
      descricao: 'Quando o Fisco apropria o crédito e o ERP (importado) ainda não contabilizou, gera o lançamento contábil.',
      criterios: {situacoes: ['apropriado_total', 'apropriado_parcial'], presenca: {fisco: '', xml: '', erp: 'precisa'}, combinacao: 'todas', condicoes: [{campo: 'erp_contabilizado', op: '=', valor: 'nao'}]},
      tratativa: 'erp', modo: 'observacao'}),
    regraPadrao({id: 'p-cred-vencido', nome: 'Crédito não apropriado depois do prazo: cobrar fornecedor', origem: 'padrao_ajustavel',
      descricao: 'O débito do fornecedor segue não extinto depois do prazo de recolhimento. Abre pendência para o follow-up.',
      criterios: {situacoes: ['pendente', 'apropriado_parcial'], idadeMinima: 30}, tratativa: 'pendencia'}),
    regraPadrao({id: 'p-cred-rad', nome: 'Fornecedor sem recolhimento depois do follow-up: RAD', origem: 'padrao_ajustavel',
      descricao: 'Vencido o follow-up sem recolhimento, o crédito fica elegível para RAD (LC 214, art. 36). Só para fornecedor autorizado e dentro do teto.',
      criterios: {situacoes: ['pendente', 'apropriado_parcial'], presenca: {fisco: 'precisa', xml: '', erp: ''}, exigeFupVencido: true, valorMinimo: 500},
      tratativa: 'rad', modo: 'observacao'}),
    regraPadrao({id: 'p-divergencia', nome: 'Divergência entre a nota e a apuração', origem: 'padrao',
      descricao: 'A nota existe na sua base e no Fisco, mas base, alíquota ou valor não conferem.',
      criterios: {presenca: {fisco: 'precisa', xml: 'precisa', erp: ''}, divergencia: ['vbc', 'pcbs', 'vcbs', 'vibs']}, tratativa: 'pendencia'}),
    regraPadrao({id: 'p-nao-na-apuracao', nome: 'Nota da sua base que não aparece na apuração', origem: 'padrao',
      descricao: 'A nota está nos XMLs importados, mas não veio no extrato do Fisco depois de 3 dias.',
      criterios: {presenca: {fisco: 'nao_pode', xml: 'precisa', erp: ''}, idadeMinima: 3}, tratativa: 'pendencia'}),
    regraPadrao({id: 'p-deb-split', nome: 'Débito já extinto por split ou RAD do cliente: não pagar de novo', origem: 'padrao', lado: 'debito',
      descricao: 'O cliente já quitou o tributo (split payment ou recolhimento pelo adquirente). Baixa no ERP para não gerar DARF em dobro.',
      criterios: {situacoes: ['extinto', 'extinto_parcial'], combinacao: 'alguma',
        condicoes: [{campo: 'forma_extincao', op: '=', valor: 'split'}, {campo: 'forma_extincao', op: '=', valor: 'rad'}]},
      tratativa: 'erp', modo: 'observacao'}),
    regraPadrao({id: 'p-deb-aberto', nome: 'Débito não extinto há mais de 25 dias', origem: 'padrao_ajustavel', lado: 'debito',
      descricao: 'Débito de saída ainda sem extinção. Conferir recebimento, split e pagamento.',
      criterios: {situacoes: ['nao_extinto', 'extinto_parcial'], idadeMinima: 25}, tratativa: 'pendencia'}),
  ];

  function valorCondicao(d, c) {
    switch (c) {
      case 'valor_potencial': return d.potencial;
      case 'valor_nao_efetivado': return d.naoEfetivado;
      case 'aging': return d.aging;
      case 'fornecedor_cnpj': return d.contraparte.cnpj;
      case 'fornecedor_nome': return d.contraparte.nome || '';
      case 'finalidade': return d.finalidade || '';
      case 'modelo': return d.modelo || '';
      case 'forma_extincao': return (d.fisco && d.fisco.forma) || '';
      case 'erp_contabilizado': return d.erp && d.erp.contabilizado ? 'sim' : 'nao';
      case 'erp_pago': return d.erp && d.erp.pago ? 'sim' : 'nao';
      default: return '';
    }
  }
  function testaCondicao(d, cond) {
    if (!cond || !cond.campo) return true;
    const tipo = (CAMPOS_CONDICAO.find(c => c[0] === cond.campo) || [])[2] || 'txt';
    const v = valorCondicao(d, cond.campo);
    if (tipo === 'num') {
      const a = Number(v), b = numero(cond.valor);
      return cond.op === '>=' ? a >= b : cond.op === '<=' ? a <= b : cond.op === '!=' ? a !== b : a === b;
    }
    const a = semAcento(String(v)).toLowerCase(), b = semAcento(String(cond.valor || '')).toLowerCase().trim();
    return cond.op === 'contem' ? a.indexOf(b) >= 0 : cond.op === '!=' ? a !== b : a === b;
  }
  // d já enriquecido com o tributo da regra
  function regraRetem(r, d, cfg, dataBase) {
    if (r.lado !== d.lado) return false;
    if (r.empresas && r.empresas.length && r.empresas.indexOf(d.empresa.base) < 0) return false;
    if (r.fornecedores && r.fornecedores.length && r.fornecedores.indexOf(d.contraparte.base) < 0) return false;
    const atual = dataBase.slice(0, 7);
    if (r.competencia === 'corrente' && d.competencia !== atual) return false;
    if (r.competencia === 'anterior' && d.competencia !== compSomar(atual, -1)) return false;
    const c = r.criterios;
    if (c.situacoes.length && c.situacoes.indexOf(d.situacao) < 0) return false;
    for (const f of ['fisco', 'xml', 'erp']) {
      if (c.presenca[f] === 'precisa' && !d[f]) return false;
      if (c.presenca[f] === 'nao_pode' && d[f]) return false;
    }
    if (c.divergencia.length) {
      if (!d.xml || !d.fisco) return false;
      const dif = comparar(d.xml, d.fisco, cfg.tolerancia);
      if (!c.divergencia.some(x => dif.indexOf(x) >= 0)) return false;
    }
    if (c.valorMinimo && d.potencial < c.valorMinimo) return false;
    if (c.idadeMinima && d.aging < c.idadeMinima) return false;
    if (c.exigeFupVencido && d.aging < cfg.prazoRecolhimentoDias + cfg.diasFupAntesRad) return false;
    if (c.somenteCredPresumido && !d.credPresumido) return false;
    if (c.finalidades.length && c.finalidades.indexOf(String(d.finalidade)) < 0) return false;
    const conds = (c.condicoes || []).filter(x => x && x.campo);
    if (conds.length) {
      const ok = c.combinacao === 'alguma' ? conds.some(x => testaCondicao(d, x)) : conds.every(x => testaCondicao(d, x));
      if (!ok) return false;
    }
    return true;
  }
  const modoEfetivo = r => r.tratativa === 'pendencia' ? 'observacao' : r.modo;

  /* ===== Execução: regras → fila de ações (com travas da RAD) =====
   * contexto: {docs, regras, cfg, dataBase, decisoes, autorizados: {empresaBase: [fornecedorBase]}, tetos: {empresaBase: R$}, empresas}
   * decisoes[idAcao] = 'aprovada' | 'descartada' | 'concluida' */
  function executar(ctx) {
    const {docs, regras, cfg, dataBase} = ctx;
    const decisoes = ctx.decisoes || {}, autorizados = ctx.autorizados || {}, tetos = ctx.tetos || {};
    const regime = Object.fromEntries((ctx.empresas || []).map(e => [e.base, e.regime || 'regular']));
    const acoes = [], porRegra = {}, retidaPor = {};
    const cache = {};
    const enr = (d, t) => { const k = d.id + '|' + t; return cache[k] || (cache[k] = enriquecer(d, t, cfg, dataBase)); };
    regras.forEach(r => {
      porRegra[r.id] = 0;
      if (!r.ligada) return;
      docs.forEach(d0 => {
        const d = enr(d0, r.tributo || 'cbs');
        if (!regraRetem(r, d, cfg, dataBase)) return;
        porRegra[r.id]++;
        (retidaPor[d0.id] = retidaPor[d0.id] || []).push(r.nome);
        const id = r.id + '|' + d0.id, modo = modoEfetivo(r);
        let status = modo === 'automacao' ? 'pronta' : 'aguardando_decisao', motivo = '';
        const dec0 = decisoes[id], dec = dec0 && typeof dec0 === 'object' ? dec0.status : dec0;
        if (dec === 'aprovada') status = 'pronta';
        if (dec === 'descartada') status = 'descartada';
        if (dec === 'concluida') status = 'concluida';
        const valor = r.tratativa === 'erp' && d.lado === 'credito' ? (d.efetivado || d.potencial)
          : r.tratativa === 'erp' ? d.potencial : (d.naoEfetivado || d.potencial);
        acoes.push({id, regra: r, doc: d, tratativa: r.tratativa, modo, status, motivo, valor: r2(valor)});
      });
    });
    // Travas da RAD: regime regular, fornecedor autorizado e teto por empresa (mais antigos primeiro)
    const usado = {};
    // Teto por competência: só contam as RADs concluídas no mês da data-base
    acoes.filter(a => a.tratativa === 'rad' && a.status === 'concluida').forEach(a => {
      const dec = decisoes[a.id], em = dec && typeof dec === 'object' ? String(dec.em || '') : '';
      if (em && em.slice(0, 7) !== dataBase.slice(0, 7)) return;
      usado[a.doc.empresa.base] = (usado[a.doc.empresa.base] || 0) + a.valor;
    });
    acoes.filter(a => a.tratativa === 'rad' && (a.status === 'pronta' || a.status === 'aguardando_decisao'))
      .sort((a, b) => b.doc.aging - a.doc.aging || b.valor - a.valor)
      .forEach(a => {
        const e = a.doc.empresa.base;
        if (regime[e] === 'simples') { a.status = 'bloqueada'; a.motivo = 'Empresa no Simples Nacional: o art. 36 exige adquirente do regime regular.'; return; }
        if ((autorizados[e] || []).indexOf(a.doc.contraparte.base) < 0) { a.status = 'bloqueada'; a.motivo = 'Fornecedor não autorizado para RAD.'; return; }
        const teto = tetos[e] != null ? numero(tetos[e]) : cfg.tetoRadPadrao;
        if ((usado[e] || 0) + a.valor > teto + 0.001) { a.status = 'bloqueada'; a.motivo = teto ? 'Teto de RAD da empresa atingido nesta competência.' : 'Teto de RAD não definido (R$ 0).'; return; }
        usado[e] = (usado[e] || 0) + a.valor;
      });
    const cont = {aguardando_decisao: 0, pronta: 0, bloqueada: 0, concluida: 0, descartada: 0};
    acoes.forEach(a => { cont[a.status]++; });
    return {acoes, porRegra, retidaPor, contagem: cont, radUsado: usado};
  }

  // Quantos documentos uma regra reteria (para mostrar o efeito antes de ligar)
  function simularRegra(r, docs, cfg, dataBase) {
    let n = 0, valor = 0;
    docs.forEach(d0 => { const d = enriquecer(d0, r.tributo || 'cbs', cfg, dataBase); if (regraRetem(Object.assign({}, r, {ligada: true}), d, cfg, dataBase)) { n++; valor += d.naoEfetivado || d.potencial; } });
    return {docs: n, valor: r2(valor)};
  }

  /* ===== Alertas da tela (substituem o e-mail: a calculadora não tem servidor) ===== */
  function alertas(ctx) {
    const {docsEnr, cfg, dataBase, dataExtrato, execucao, semEmpresa, concluidas, avisos} = ctx;
    const on = k => !avisos || avisos[k] !== false;
    const out = [];
    if (!dataExtrato) out.push({nivel: 'critico', chave: 'sem_extrato', texto: 'Nenhum extrato da apuração importado: créditos e débitos aparecem como "aguardando processamento".'});
    else if (on('desatualizado') && dias(dataExtrato, dataBase) > cfg.diasDadoDesatualizado)
      out.push({nivel: 'critico', chave: 'desatualizado', texto: 'O extrato da apuração é de ' + dataExtrato.split('-').reverse().join('/') + ' (' + dias(dataExtrato, dataBase) + ' dias). Os números podem estar velhos: importe um extrato novo.'});
    const anterior = compSomar(dataBase.slice(0, 7), -1), est = estadoCompetencia(anterior, dataBase, cfg, concluidas);
    if (on('fim_ajuste') && est.estado === 'em_ajuste' && est.perto)
      out.push({nivel: 'atencao', chave: 'fim_ajuste', texto: 'Competência ' + anterior.split('-').reverse().join('/') + ': ' + (est.diasRestantes ? 'faltam ' + est.diasRestantes + ' dia(s) para o fim do ajuste.' : 'hoje é o último dia de ajuste.')});
    const venc = docsEnr.filter(d => d.lado === 'credito' && d.nivel === 'vencido'), crit = docsEnr.filter(d => d.lado === 'credito' && d.nivel === 'critico');
    if (on('vencido') && venc.length) out.push({nivel: 'atencao', chave: 'vencido', texto: venc.length + ' crédito(s) passaram do prazo sem apropriação (R$ ' + fmt(venc.reduce((s, d) => s + d.naoEfetivado, 0)) + ').'});
    if (on('critico') && crit.length) out.push({nivel: 'critico', chave: 'critico', texto: crit.length + ' crédito(s) críticos, mais de ' + (cfg.prazoRecolhimentoDias + cfg.diasCriticoDepois) + ' dias (R$ ' + fmt(crit.reduce((s, d) => s + d.naoEfetivado, 0)) + ').'});
    if (execucao) {
      const bloq = execucao.acoes.filter(a => a.status === 'bloqueada');
      const teto = bloq.filter(a => a.motivo.indexOf('Teto') === 0), naoAut = bloq.filter(a => a.motivo.indexOf('não autorizado') >= 0);
      if (on('teto_rad') && teto.length) out.push({nivel: 'atencao', chave: 'teto_rad', texto: teto.length + ' RAD(s) bloqueadas por teto da empresa.'});
      if (on('rad_nao_autorizado') && naoAut.length) out.push({nivel: 'info', chave: 'rad_nao_autorizado', texto: naoAut.length + ' RAD(s) bloqueadas: fornecedor não autorizado.'});
    }
    if (on('sem_empresa') && semEmpresa && semEmpresa.length)
      out.push({nivel: 'info', chave: 'sem_empresa', texto: semEmpresa.length + ' XML(s) sem empresa cadastrada (nem emitente nem destinatário estão na carteira).'});
    return out;
  }
  function fmt(v) { return r2(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  const MODELO_EXTRATO = [
    'lado;chave;cnpj_emitente;nome_emitente;cnpj_destinatario;nome_destinatario;data_emissao;competencia;base_calculo;aliquota_cbs;valor_cbs;valor_ibs;cbs_apropriada;ibs_apropriado;cbs_extinta;ibs_extinto;forma_extincao',
    'credito;35260711111111000111550010000012341000012345;11.111.111/0001-11;Fornecedor Exemplo Ltda;22.222.222/0001-22;Cliente Exemplo SA;10/07/2026;2026-07;10000,00;0,90;90,00;10,00;90,00;10,00;;;',
    'debito;35260722222222000122550010000056781000056789;22.222.222/0001-22;Cliente Exemplo SA;33.333.333/0001-33;Comprador Exemplo Ltda;12/07/2026;2026-07;5000,00;0,90;45,00;5,00;;;45,00;5,00;split',
  ].join('\r\n');
  const MODELO_ERP = [
    'lado;chave;base_calculo;aliquota_cbs;valor_cbs;valor_ibs;contabilizado;pago',
    'credito;35260711111111000111550010000012341000012345;10000,00;0,90;90,00;10,00;nao;sim',
  ].join('\r\n');

  return {
    PADROES, SITUACOES, ROTULO_SITUACAO, FONTES, CAMPOS_DIVERGENCIA, TRATATIVAS, ROTULO_TRATATIVA, CAMPOS_CONDICAO, OPERADORES,
    FAIXAS_AGING, REGRAS_PADRAO, MODELO_EXTRATO, MODELO_ERP,
    numero, limparCnpj, baseCnpj, data, competencia, dias, compSomar, r2, lerCSV, csv,
    normalizarExtrato, normalizarErp, lerXmlNFe, montarBase,
    potencial, efetivado, naoEfetivado, situacao, nivelPrazo, enriquecer, concluido, filtrar,
    resumoLado, topContrapartes, matrizAging, saldoApuracao, projecao, estadoCompetencia,
    comparar, conciliar, regraPadrao, regraRetem, modoEfetivo, executar, simularRegra, alertas,
  };
});
