// ITCMD — São Paulo 2026 (06/11/2026)
const T = require('../co/itcmd.js');
const ok = (c, m) => { if (!c) throw new Error(m); };
const perto = (a, b, m) => ok(Math.abs(a - b) < .01, m + ': esperado ' + b + ', veio ' + a);
const U = 38.42;
// Herança de imóvel de R$ 500 mil: 4%
perto(T.calcular({estado: 'SP', operacao: 'heranca', beneficiarios: 2, bens: [{tipo: 'imovelUrbano', valor: 500000}]}).imposto, 20000, 'herança 4%');
// Base mínima: valor venal do IPTU maior que o declarado
perto(T.calcular({estado: 'SP', operacao: 'heranca', bens: [{tipo: 'imovelUrbano', valor: 300000, venalIptu: 350000}]}).imposto, 14000, 'base mínima IPTU');
// Isenção: imóvel residencial até 5.000 UFESPs
ok(T.calcular({estado: 'SP', operacao: 'heranca', bens: [{tipo: 'imovelUrbano', valor: 5000 * U, residencial: true}]}).imposto === 0, 'isenção residencial');
ok(T.calcular({estado: 'SP', operacao: 'heranca', bens: [{tipo: 'imovelUrbano', valor: 5000 * U + 1, residencial: true}]}).imposto > 0, 'acima do limite residencial');
// Doação: isenta até 2.500 UFESPs por donatário no ano; acima, tributa o total (inclusive as anteriores somadas)
ok(T.calcular({estado: 'SP', operacao: 'doacao', beneficiarios: 2, bens: [{tipo: 'dinheiro', valor: 2 * 2500 * U}]}).imposto === 0, 'doação isenta por donatário');
perto(T.calcular({estado: 'SP', operacao: 'doacao', beneficiarios: 1, doacoesAnteriores: 50000, bens: [{tipo: 'dinheiro', valor: 60000}]}).imposto, 60000 * .04, 'soma do ano passa o limite');
// Usufruto: 2/3 agora, 1/3 depois
const u = T.calcular({estado: 'SP', operacao: 'doacao', beneficiarios: 1, bens: [{tipo: 'imovelUrbano', valor: 900000, usufruto: true}]});
perto(u.imposto, 600000 * .04, 'nua-propriedade 2/3');
perto(u.usufruto.imposto, 300000 * .04, 'usufruto 1/3 na extinção');
// Quotas: contábil × ajustado
const q = T.calcular({estado: 'SP', operacao: 'doacao', beneficiarios: 1, bens: [{tipo: 'quotas', plContabil: 1000000, plAjustado: 3000000, fracao: .5}]});
perto(q.imposto, 500000 * .04, 'quotas pelo PL contábil');
perto(q.impostoFisco, 1500000 * .04, 'quotas pelo PL ajustado');
// Projeção PL 409/2025: R$ 10 mi em 2025 dava R$ 264,8 mil (UFESP 37,02); conferir a fórmula com a UFESP de 2025
const f = T.porFaixas(10e6, [[10000 * 37.02, .01], [85000 * 37.02, .02], [280000 * 37.02, .03], [Infinity, .04]]);
ok(Math.abs(f - 264800) < 200, 'PL 409/2025 confere com exemplo publicado: ' + f);
// Outro estado com tabela progressiva
perto(T.calcular({estado: 'outro', operacao: 'heranca', faixasOutro: [[100000, .02], [Infinity, .04]], bens: [{tipo: 'dinheiro', valor: 300000}]}).imposto, 2000 + 8000, 'tabela progressiva informada');
console.log('ITCMD OK');
