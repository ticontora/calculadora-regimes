// Testes do Gestor de Apuração Assistida: leitura, situação, conciliação, regras e travas da RAD
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../motor/apuracao.js');

const CFG = Object.assign({}, A.PADROES);
const BASE = '2026-07-20';
const chave = n => ('3526071111111100011155001' + String(n).padStart(19, '0')).slice(0, 44);
const CLI = {cnpj: '22222222000122', nome: 'Cliente SA'};
const FOR = {cnpj: '11111111000111', nome: 'Fornecedor Ltda'};
const OUT = {cnpj: '33333333000133', nome: 'Outro Ltda'};

function linhaFisco(o) {
  return Object.assign({lado: 'credito', chave: chave(1), emit: FOR, dest: CLI, data: '2026-07-01', competencia: '2026-07',
    vbc: 1000, pcbs: 0.9, vcbs: 9, vibs: 1, aprCbs: 0, aprIbs: 0, extCbs: 0, extIbs: 0, forma: '', finalidade: '', modelo: '55', credPresumido: false}, o);
}
const xmlNFe = (n, emit, dest, vcbs) => `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${chave(n)}" versao="4.00">
  <ide><mod>55</mod><finNFe>1</finNFe><dhEmi>2026-07-01T10:00:00-03:00</dhEmi></ide>
  <emit><CNPJ>${emit.cnpj}</CNPJ><xNome>${emit.nome}</xNome></emit><dest><CNPJ>${dest.cnpj}</CNPJ><xNome>${dest.nome}</xNome></dest>
  <det nItem="1"><imposto><IBSCBS><CST>000</CST><gIBSCBS><vBC>600.00</vBC><gIBSUF><pIBSUF>0.10</pIBSUF><vIBSUF>0.60</vIBSUF></gIBSUF><vIBS>0.60</vIBS><gCBS><pCBS>0.90</pCBS><vCBS>5.40</vCBS></gCBS></gIBSCBS></IBSCBS></imposto></det>
  <det nItem="2"><imposto><IBSCBS><CST>000</CST><gIBSCBS><vBC>400.00</vBC><vIBS>0.40</vIBS><gCBS><pCBS>0.90</pCBS><vCBS>${vcbs}</vCBS></gCBS></gIBSCBS></IBSCBS></imposto></det>
</infNFe></NFe></nfeProc>`;

test('números, datas e CNPJ (inclusive alfanumérico)', () => {
  assert.equal(A.numero('1.234,56'), 1234.56);
  assert.equal(A.numero('1234.56'), 1234.56);
  assert.equal(A.numero('R$ 90,00'), 90);
  assert.equal(A.data('10/07/2026'), '2026-07-10');
  assert.equal(A.competencia('07/2026'), '2026-07');
  assert.equal(A.baseCnpj('12.ABC.345/01DE-35'), '12ABC345');
  assert.equal(A.compSomar('2026-12', 1), '2027-01');
  assert.equal(A.compSomar('2027-01', -1), '2026-12');
});

test('CSV com ponto e vírgula, aspas e apelidos de coluna', () => {
  const linhas = A.lerCSV(A.MODELO_EXTRATO);
  assert.equal(linhas.length, 2);
  const {linhas: ok, erros} = A.normalizarExtrato(linhas);
  assert.deepEqual(erros, []);
  assert.equal(ok[0].lado, 'credito');
  assert.equal(ok[0].vcbs, 90);
  assert.equal(ok[1].forma, 'split');
  assert.equal(A.lerCSV('a;b\n"x;y";"di""z"')[0].a, 'x;y');
  assert.equal(A.normalizarExtrato([{lado: 'x', chave: '123'}]).erros.length, 1);
});

test('XML da NF-e: soma os itens do grupo IBSCBS e lê emitente e destinatário', () => {
  const n = A.lerXmlNFe(xmlNFe(1, FOR, CLI, '3.60'));
  assert.equal(n.chave, chave(1));
  assert.equal(n.vbc, 1000);
  assert.equal(n.vcbs, 9);
  assert.equal(n.vibs, 1);
  assert.equal(n.pcbs, 0.9);
  assert.equal(n.data, '2026-07-01');
  assert.equal(n.dest.cnpj, CLI.cnpj);
  assert.ok(A.lerXmlNFe('<x/>').erro);
});

test('base unificada: lado pela empresa da carteira, nota de terceiros fica de fora', () => {
  const xml = [A.lerXmlNFe(xmlNFe(1, FOR, CLI, '3.60')), A.lerXmlNFe(xmlNFe(2, FOR, OUT, '3.60'))];
  const b = A.montarBase({fisco: [linhaFisco()], xml, erp: []}, []);
  assert.equal(b.empresas.length, 1);
  assert.equal(b.empresas[0].base, '22222222');
  assert.equal(b.docs.length, 1);
  assert.equal(b.docs[0].lado, 'credito');
  assert.ok(b.docs[0].xml && b.docs[0].fisco);
  assert.equal(b.semEmpresa.length, 1);
});

test('situação, nível de prazo e valores por tributo', () => {
  const d = A.montarBase({fisco: [linhaFisco({aprCbs: 4})]}, []).docs[0];
  assert.equal(A.situacao(d, 'cbs'), 'apropriado_parcial');
  assert.equal(A.situacao(d, 'ibs'), 'pendente');
  assert.equal(A.naoEfetivado(d, 'total'), 6);
  // emitida em 01/07, prazo 30: em 20/07 está no prazo; em 27/07 atenção; em 05/08 vencido; em 05/09 crítico
  assert.equal(A.nivelPrazo(d, 'cbs', CFG, '2026-07-20'), 'no_prazo');
  assert.equal(A.nivelPrazo(d, 'cbs', CFG, '2026-07-27'), 'atencao');
  assert.equal(A.nivelPrazo(d, 'cbs', CFG, '2026-08-05'), 'vencido');
  assert.equal(A.nivelPrazo(d, 'cbs', CFG, '2026-09-05'), 'critico');
  const deb = A.montarBase({fisco: [linhaFisco({lado: 'debito', emit: CLI, dest: OUT, extCbs: 9, extIbs: 1, forma: 'split'})]}, []).docs[0];
  assert.equal(A.situacao(deb, 'total'), 'extinto');
});

test('resumo: baldes somam o total e o percentual é por valor', () => {
  const fisco = [
    linhaFisco({chave: chave(1), vcbs: 100, aprCbs: 100, data: '2026-07-10'}),
    linhaFisco({chave: chave(2), vcbs: 200, aprCbs: 50, data: '2026-05-01'}),
    linhaFisco({chave: chave(3), vcbs: 300, data: '2026-07-15'}),
  ];
  const docs = A.montarBase({fisco}, []).docs.map(d => A.enriquecer(d, 'cbs', CFG, BASE));
  const r = A.resumoLado(docs, 'credito', CFG);
  assert.equal(r.total, 600);
  assert.equal(r.concluidos.valor, 150);
  assert.equal(r.vencidos.valor, 150);
  assert.equal(r.noPrazo.valor, 300);
  assert.equal(r.concluidos.valor + r.vencidos.valor + r.noPrazo.valor + r.processando.valor, r.total);
  assert.equal(r.percentual, 0.25);
});

test('conciliação: divergente, só no Fisco, só na sua base e conciliado', () => {
  const xml = [A.lerXmlNFe(xmlNFe(1, FOR, CLI, '3.60')), A.lerXmlNFe(xmlNFe(2, FOR, CLI, '4.60')), A.lerXmlNFe(xmlNFe(3, FOR, CLI, '3.60'))];
  const fisco = [linhaFisco({chave: chave(1)}), linhaFisco({chave: chave(2)}), linhaFisco({chave: chave(4)})];
  const docs = A.montarBase({fisco, xml}, []).docs;
  const c = A.conciliar(docs, 'xml', 'credito', 0.01);
  assert.equal(c.grupos.conciliado.length, 1);
  assert.equal(c.grupos.divergente.length, 1);
  assert.deepEqual(c.grupos.divergente[0].campos, ['vcbs']);
  assert.equal(c.grupos.so_fisco.length, 1);
  assert.equal(c.grupos.so_outro.length, 1);
});

test('regras: retenção por critério e condições E/OU', () => {
  const docs = A.montarBase({fisco: [
    linhaFisco({chave: chave(1), data: '2026-06-01', vcbs: 900}),
    linhaFisco({chave: chave(2), data: '2026-07-15', vcbs: 900}),
  ]}, []).docs;
  const r = A.regraPadrao({id: 'x', nome: 'x', criterios: {situacoes: ['pendente'], idadeMinima: 30}});
  assert.equal(A.simularRegra(r, docs, CFG, BASE).docs, 1);
  const r2 = A.regraPadrao({id: 'y', nome: 'y', criterios: {combinacao: 'alguma', condicoes: [{campo: 'aging', op: '>=', valor: '40'}, {campo: 'fornecedor_nome', op: 'contem', valor: 'fornec'}]}});
  assert.equal(A.simularRegra(r2, docs, CFG, BASE).docs, 2);
  r2.criterios.combinacao = 'todas';
  assert.equal(A.simularRegra(r2, docs, CFG, BASE).docs, 1);
});

test('RAD: só fornecedor autorizado, dentro do teto, mais antigo primeiro e nunca no Simples', () => {
  const fisco = [
    linhaFisco({chave: chave(1), data: '2026-05-01', vcbs: 1000}),
    linhaFisco({chave: chave(2), data: '2026-05-10', vcbs: 800}),
    linhaFisco({chave: chave(3), data: '2026-05-05', vcbs: 700, emit: OUT}),
  ];
  const base = A.montarBase({fisco}, []);
  const regra = Object.assign({}, A.REGRAS_PADRAO.find(r => r.id === 'p-cred-rad'), {modo: 'automacao'});
  const ctx = {docs: base.docs, regras: [regra], cfg: CFG, dataBase: BASE, empresas: base.empresas,
    autorizados: {'22222222': ['11111111']}, tetos: {'22222222': 1500}};
  const ex = A.executar(ctx);
  const st = Object.fromEntries(ex.acoes.map(a => [a.doc.chave, a.status]));
  assert.equal(st[chave(1)], 'pronta');      // mais antigo, cabe no teto
  assert.equal(st[chave(2)], 'bloqueada');   // estouraria o teto (1000 + 800 > 1500)
  assert.equal(st[chave(3)], 'bloqueada');   // fornecedor não autorizado
  assert.equal(ex.radUsado['22222222'], 1000);
  // Modo observação: espera decisão; RAD com teto zero fica bloqueada
  const ex2 = A.executar(Object.assign({}, ctx, {regras: [A.REGRAS_PADRAO.find(r => r.id === 'p-cred-rad')], tetos: {}}));
  assert.ok(ex2.acoes.every(a => a.status === 'bloqueada'));
  // Simples Nacional nunca gera RAD
  const ex3 = A.executar(Object.assign({}, ctx, {empresas: [{base: '22222222', regime: 'simples'}]}));
  assert.ok(ex3.acoes.every(a => a.status === 'bloqueada' && a.motivo.indexOf('Simples') >= 0));
});

test('decisões: aprovar, descartar e concluir; RAD concluída em outro mês não consome o teto', () => {
  const base = A.montarBase({fisco: [linhaFisco({chave: chave(1), data: '2026-05-01', vcbs: 1000}), linhaFisco({chave: chave(2), data: '2026-05-02', vcbs: 1000})]}, []);
  const regra = A.REGRAS_PADRAO.find(r => r.id === 'p-cred-rad');
  const id1 = regra.id + '|credito:' + chave(1), id2 = regra.id + '|credito:' + chave(2);
  const ctx = {docs: base.docs, regras: [regra], cfg: CFG, dataBase: BASE, empresas: base.empresas,
    autorizados: {'22222222': ['11111111']}, tetos: {'22222222': 1000}};
  let ex = A.executar(Object.assign({}, ctx, {decisoes: {[id1]: {status: 'concluida', em: '2026-07-01'}}}));
  assert.equal(ex.acoes.find(a => a.id === id2).status, 'bloqueada');
  ex = A.executar(Object.assign({}, ctx, {decisoes: {[id1]: {status: 'concluida', em: '2026-06-01'}, [id2]: 'aprovada'}}));
  assert.equal(ex.acoes.find(a => a.id === id2).status, 'pronta');
});

test('saldo da apuração e estado da competência', () => {
  const fisco = [linhaFisco({chave: chave(1), vcbs: 100, aprCbs: 100}), linhaFisco({chave: chave(2), lado: 'debito', emit: CLI, dest: OUT, vcbs: 30})];
  const docs = A.montarBase({fisco}, []).docs;
  const s = A.saldoApuracao(docs, '2026-07', 'cbs', {anterior: '10', redutores: '5', informado: '75'});
  assert.equal(s.saldo, 75);
  assert.equal(s.bate, true);
  assert.equal(A.estadoCompetencia('2026-07', BASE, CFG, {}).estado, 'corrente');
  assert.equal(A.estadoCompetencia('2026-06', '2026-07-18', CFG, {}).estado, 'em_ajuste');
  assert.equal(A.estadoCompetencia('2026-06', '2026-07-25', CFG, {}).estado, 'encerrada');
  assert.equal(A.estadoCompetencia('2026-06', BASE, CFG, {'2026-06': {}}).estado, 'concluida');
});

test('alertas: extrato velho aparece, não fica escondido', () => {
  const al = A.alertas({docsEnr: [], cfg: CFG, dataBase: BASE, dataExtrato: '2026-07-10', semEmpresa: [], concluidas: {}});
  assert.ok(al.some(a => a.chave === 'desatualizado'));
});
