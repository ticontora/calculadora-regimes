// Base legal do assistente. Tudo o que ele pode afirmar sobre lei vem daqui; o que não estiver aqui, ele diz que não sabe.
// Cada item foi conferido no texto oficial (Planalto, Sefaz-SP, BCB) em 16/10/2026, salvo os marcados [CONFIRMAR].
// Ao alterar, mude também BASE_LEGAL_VERSAO.

export const BASE_LEGAL_VERSAO = '2026-10-16.2';

export const BASE_LEGAL = `
# BASE LEGAL — versão ${BASE_LEGAL_VERSAO}

## 1. Simples Nacional (LC 123/2006)
- Alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12 (art. 18, § 1º-A).
- Teto: R$ 4,8 milhões por ano (art. 3º, II). Sublimite de R$ 3,6 milhões: acima dele ICMS e ISS saem do DAS (art. 13-A).
- Fator R (Anexo V → Anexo III): folha de 12 meses ÷ receita de 12 meses ≥ 28% (art. 18, §§ 5º-J e 5º-M). A calculadora usa a folha do mês como aproximação.
- Anexo IV: a CPP de 20% sobre a folha é paga fora do DAS (art. 18, § 5º-C).
- ISS dentro do DAS limitado a 5% da receita; o excesso vai aos tributos federais (Anexos III a V, nota da 5ª faixa).
- Vedações: locação de imóveis próprios (art. 17, XV); loteamento e incorporação (art. 17, XIV); participação no capital de outra empresa (art. 3º, § 4º, VII).
- Compra e venda de imóveis próprios no Simples: Anexo I (Solução de Consulta Cosit nº 39/2017).
- MEI: limite de R$ 81 mil por ano (art. 18-A). Há projetos para aumentar, nenhum sancionado até 10/2026. [CONFIRMAR se mudou]

## 2. Simples de 2027 a 2033 (LC 214/2025, art. 519 e Anexos XVIII a XXII)
- PIS e COFINS saem do DAS; a fatia deles vira CBS e IBS. Em 2027–2028, o IBS fica com uma fatia pequena (ex.: Anexo I, 1ª faixa: CBS 15,33% e IBS 0,17% do DAS).
- De 2029 a 2033 o IBS absorve 10%, 20%, 30%, 40% e 100% da fatia do ICMS/ISS dentro do DAS. O valor total do DAS das faixas 1 a 5 não muda.
- 6ª faixa: alíquota nominal 0,1 ponto menor em 2027 e 2028.
- Simples Híbrido: o optante pode recolher IBS e CBS pelo regime regular, fora do DAS (LC 214/2025, art. 41, § 3º; forma da opção: LC 123, art. 41, § 4º). Assim gera crédito integral ao comprador.
- Fornecedor no DAS: o comprador do regime regular só toma crédito do valor pago no DAS (LC 214/2025, art. 47, § 9º). Pessoa física e empresa do Simples no DAS não tomam crédito.

## 3. Lucro Presumido
- Presunção: IRPJ 8% (comércio e indústria) e 32% (serviços); CSLL 12% e 32% (Lei 9.249/1995, arts. 15 e 20).
- IRPJ 15% + adicional de 10% sobre a base acima de R$ 20 mil por mês do período (art. 3º, § 1º); CSLL 9%.
- PIS 0,65% e COFINS 3% cumulativos até 2026 (Leis 9.715/1998 e 9.718/1998).
- LC 224/2025: acréscimo de 10% nos percentuais de presunção sobre a parte da receita acima de R$ 5 milhões no ano (art. 4º, § 4º, VII e § 5º); IRPJ desde 01/01/2026 e CSLL desde 01/04/2026. A calculadora lê "10%" como relativo (8% vira 8,8%). [CONFIRMAR leitura relativa]

## 4. Lucro Real
- IRPJ 15% + adicional de 10% acima de R$ 20 mil por mês; CSLL 9%. PIS 1,65% e COFINS 7,6% não cumulativos até 2026 (Leis 10.637/2002 e 10.833/2003).
- Prejuízo fiscal: compensação limitada a 30% do lucro de cada período seguinte. A calculadora não simula prejuízo acumulado.

## 5. Reforma (EC 132/2023, ADCT arts. 125 a 129; LC 214/2025)
- 2026: CBS 0,9% e IBS 0,1% de teste, sem custo para quem cumpre as obrigações acessórias. PIS/COFINS seguem devidos.
- 2027–2028: PIS/COFINS extintos; CBS = referência − 0,1 ponto; IBS 0,1%.
- 2029–2032: ICMS e ISS caem para 90%, 80%, 70% e 60%; o IBS sobe. 2033: só CBS e IBS.
- Alíquotas de referência usadas: CBS 9,21% e IBS 18,7% (estimativa do Comitê Gestor, Resolução CGIBS nº 14/2026). A CBS de 2027 será fixada pelo Senado até 15/12/2026; os números da tela são estimativa editável.
- Produtos hortícolas, frutas e ovos do Anexo XV: alíquota zero de CBS/IBS (art. 148). Cesta Básica Nacional do Anexo I: alíquota zero (art. 125). A calculadora NÃO aplica alíquota zero por produto: para feirante de hortifrúti, avise que a CBS/IBS do regime regular na tela pode estar superestimada e que o enquadramento depende da NCM de cada produto.

## 6. ICMS em São Paulo
- Alíquota interna geral de 18%; alguns alimentos 7% ou 12%. A calculadora usa o percentual informado.
- Frutas frescas, flores e hortifrutícolas em estado natural: isentos de ICMS (RICMS/SP, Anexo I, art. 36), exceto quando destinados à industrialização (Resposta à Consulta 33240/2026). Para esses produtos, o ICMS informado na tela deve ser 0.

## 7. Distribuição de lucros (Lei 15.270/2025, desde 01/01/2026)
- Retenção de 10% sobre o TOTAL de lucros pagos no mês pela mesma empresa à mesma pessoa física, quando passar de R$ 50 mil (Lei 9.250/1995, art. 6º-A). Dividir em vários pagamentos no mês não evita.
- Tributação mínima (IRPFM): renda anual acima de R$ 600 mil; alíquota % = renda ÷ 60.000 − 10, até 10% a partir de R$ 1,2 milhão (art. 16-A). O IR retido é antecipação e é ajustado na declaração.
- Redutor quando a carga da empresa + a do sócio passa de 34% (art. 16-B).
- Dividendos do Simples: a Receita aplica a regra; há decisões judiciais afastando pela LC 123, art. 14. A tela tem opção para os dois cenários.
- A calculadora JÁ calcula esta camada no comparativo "com distribuição aos sócios".

## 8. IRPF 2026 (Lei 15.270/2025)
- Redução mensal: rendimento até R$ 5.000 zera o imposto; de R$ 5.000,01 a R$ 7.350, redução de 978,62 − 0,133145 × rendimento (Lei 9.250/1995, art. 3º-A).
- Redução anual: até R$ 60.000 zera; até R$ 88.200, redução de 8.429,73 − 0,095575 × rendimento (art. 11-A).

## 9. Imóveis
- Ganho de capital da pessoa física: 15% até R$ 5 milhões de ganho, depois 17,5%, 20% e 22,5% (Lei 8.981/1995, art. 21). Empresa do Simples vendendo bem do ativo: mesmas alíquotas (Lei 13.259/2016, art. 2º).
- Imóvel adquirido até 1988: redução de 5% por ano até 1988 (100% até 1969) sobre o GANHO, uma única vez (Lei 7.713/1988, art. 18). Fatores FR1 e FR2 (Lei 11.196/2005, art. 40).
- Isenções: único imóvel vendido por até R$ 440 mil, sem outra venda em 5 anos (Lei 9.250/1995, art. 23); reinvestimento em imóvel residencial em 180 dias, proporcional (Lei 11.196/2005, art. 39).
- Aluguel da pessoa física: carnê-leão mensal; dedutíveis IPTU, condomínio e taxa de administração pagos pelo locador (Lei 7.739/1989, art. 14).
- CBS/IBS de imóveis a partir de 2027: redução de 50% nas operações com imóveis e de 70% na locação (LC 214/2025, art. 261). Venda: base menos o redutor de ajuste (custo corrigido pelo IPCA, mais ITBI e laudêmio; arts. 257 e 258) e, para imóvel residencial novo ou lote, o redutor social de R$ 100 mil ou R$ 30 mil (art. 259). Locação residencial: redutor social de R$ 600 por mês por imóvel (art. 260).
- Pessoa física só paga CBS/IBS de imóveis acima dos limites do art. 251: aluguéis acima de R$ 240 mil no ano anterior com mais de 3 imóveis (ou 20% acima no próprio ano); venda de mais de 3 imóveis no ano anterior, ou mais de 1 construído por ela.
- Contrato de locação com prazo determinado assinado até 16/01/2025: opção de 3,65% sobre a receita (art. 487); contrato residencial só até 31/12/2028.
- Locação por temporada (até 90 dias): regras de hotelaria (art. 253). [CONFIRMAR o percentual de redução usado pela calculadora, 40%]

## 10. O que a calculadora NÃO considera (diga quando for relevante)
MEI, substituição tributária, DIFAL, CPRB, RAT e terceiros, prejuízo acumulado, regimes especiais de ICMS, alíquota zero de CBS/IBS por produto, presunções diferentes de 8/12/32%. No imobiliário: cessão de direitos, permuta, incorporação (art. 485), parcelamento do solo (art. 486), art. 488, Lei 14.973 e vários imóveis numa simulação.
`;
