// Leitura de matrícula e certidão de valor venal (06/11/2026) — textos fictícios
const D = require('../co/docs.js');
const ok = (c, m) => { if (!c) throw new Error(m); };
const MAT = `2º OFICIAL DE REGISTRO DE IMÓVEIS DE GUARULHOS - SP
MATRÍCULA Nº 90.123   FICHA 01
IMÓVEL: Apartamento nº 52, situado na Rua das Palmeiras, nº 100, Vila Galvão, Guarulhos/SP, com área privativa de 65,40 m², área total de 98,12 m².
Contribuinte nº 084.32.11.0456.00.000.
PROPRIETÁRIO: JOÃO DA SILVA.
R.1/90.123 - Guarulhos, 10 de março de 2015. Por escritura de venda e compra, JOÃO DA SILVA vendeu o imóvel a MARIA SOUZA pelo valor de R$ 350.000,00.
R.2/90.123 - HIPOTECA em favor do Banco X, para garantia de R$ 200.000,00.
AV.3/90.123 - CANCELAMENTO da hipoteca objeto do R.2, por autorização do credor.
R.4/90.123 - Por escritura de 05/06/2022, MARIA SOUZA vendeu o imóvel a PEDRO LIMA pelo preço de R$ 480.000,00.`;
const m = D.lerMatricula(MAT);
ok(m.campos.matricula === '90.123', 'número da matrícula');
ok(/2º OFICIAL DE REGISTRO DE IMÓVEIS DE GUARULHOS/i.test(m.campos.cartorio), 'cartório: ' + m.campos.cartorio);
ok(m.campos.ultimoValor === 480000, 'último valor: ' + m.campos.ultimoValor);
ok(m.campos.areas.some(a => a.m2 === 65.4), 'área privativa');
ok(/084\.32\.11/.test(m.campos.inscricao), 'inscrição');
ok(/Rua das Palmeiras/.test(m.campos.endereco), 'endereço');
const h = m.onus.find(o => o.tipo === 'Hipoteca'); ok(h && h.cancelado, 'hipoteca cancelada detectada');
const VEN = `PREFEITURA DE GUARULHOS - CERTIDÃO DE VALOR VENAL
Exercício: 2026
Inscrição Cadastral: 084.32.11.0456.00.000
Endereço: Rua das Palmeiras, 100 - Vila Galvão
Valor do Terreno: R$ 120.500,00
Valor da Construção: R$ 210.300,00
Valor Venal Total: R$ 330.800,00`;
const v = D.lerVenal(VEN);
ok(v.campos.valorVenal === 330800, 'valor venal: ' + v.campos.valorVenal);
ok(v.campos.exercicio === '2026', 'exercício');
ok(v.campos.valorTerreno === 120500 && v.campos.valorConstrucao === 210300, 'terreno e construção');
const R = D.lerVenal('Certidão de Valor Venal de Referência para fins de ITBI. VALOR VENAL DE REFERÊNCIA: R$ 612.345,67. Exercício 2026');
ok(R.campos.valorReferencia === 612345.67, 'valor venal de referência');
console.log('DOCS OK');
