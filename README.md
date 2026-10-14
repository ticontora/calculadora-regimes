# Calculadora de regimes tributários (Simples, híbrido, Presumido e Real)

Ferramenta de estimativa para comparar regimes tributários de clientes, com base na legislação de Guarulhos/SP. Roda no navegador.

## Uso
Informe o CNPJ (a razão social preenche sozinha quando a consulta funciona), o faturamento, a atividade e os percentuais de margem, compras, ICMS e ISS. Gere o PDF da análise.

## Atividades e anexos
- CNAE principal: ao digitar o CNAE (ou ao consultar o CNPJ), a calculadora escolhe a atividade e marca o Fator R pela tabela `cnae.js` (1.181 CNAEs, lista da Contabilizei, Tabela Simples Nacional 2026). CNAEs de locação de imóveis próprios, loteamento, incorporação e holdings são tratados como vedados no Simples. Construção (divisões 41 a 43) entra como "mão de obra"; se for empreitada total com materiais, troque a atividade.
- Comércio (Anexo I) e indústria (Anexo II), com híbrido.
- Serviços (Anexo III), para atividades que não estão nos Anexos IV e V.
- Serviços de limpeza, vigilância, obras e paisagismo (Anexo IV), com CPP de 20% sobre a folha fora do DAS.
- Serviços do Anexo V, com Fator R apenas quando a atividade estiver marcada como da lista do Fator R.
- Construção civil (Anexo IV no Simples). No Presumido: empreitada total com materiais, 8% (IRPJ) e 12% (CSLL); mão de obra ou materiais parciais, 32%.
- Locação de imóveis próprios, incluindo holding patrimonial: vedada no Simples (LC 123, art. 17, XV); Presumido com 32%, sem ISS.
- Holding de participações (receitas de administração): vedada no Simples (LC 123, art. 3º, § 4º, VII); Presumido com 32%. Dividendos recebidos não entram no cálculo.
- Incorporação e loteamento: vedados no Simples (LC 123, art. 17, XIV); Presumido com 8% e 12%; RET de 4% (Lei 10.931/2004) para incorporação com patrimônio de afetação.

## Comprador e crédito de IBS/CBS (cenário 2027)
- Identifica quem compra: pessoa física, PJ no Lucro Real, PJ no Lucro Presumido, PJ no Simples (DAS) ou PJ no Simples com IBS/CBS no regime regular.
- PF e PJ no DAS não tomam crédito. PJ do regime regular toma crédito integral do IBS/CBS destacado, ou só do IBS/CBS pago no DAS quando o fornecedor recolhe no DAS (LC 214/2025, art. 47, § 9º).
- Compara, pelo mesmo preço final, fornecedor no DAS, fornecedor no Simples híbrido da reforma (IBS/CBS fora do DAS, LC 214, art. 41, § 3º) e fornecedor no Presumido/Real.
- A CBS de 2027 ainda não foi fixada; o campo é editável (padrão 9,11%, estimativa). A fatia de IBS/CBS no DAS assume a fatia atual de PIS e COFINS de cada faixa.
- O "Simples híbrido" da tabela de regimes é outra coisa: deixa o ICMS fora do DAS.

## Simplificações
- Fator R usa a folha do mês como aproximação da média de 12 meses.
- PIS e COFINS no Lucro Real são apuração simplificada, com crédito sobre as compras informadas.
- Presunção de serviços: 32% para IRPJ e CSLL. Atividades com presunção diferente não estão modeladas.
- Não considera desoneração da folha (CPRB) da construção, RET de 1% para habitação de interesse social, nem regras cumulativas específicas de PIS/COFINS no Real para construção e incorporação.
- Não considera MEI, substituição tributária, DIFAL, RAT, contribuições a terceiros, compensação de prejuízo nem regimes específicos de ICMS.

## Limitações
- Os valores são estimativas e não substituem a apuração do contador. Revise com o contador antes de usar com o cliente.
- A consulta de CNPJ depende de um serviço externo, que pode ser bloqueado pelo navegador.

## Publicação
Repositório público com GitHub Pages ativado na branch `main`, pasta raiz. A pasta `worker/` contém o código do proxy de consulta de CNPJ para o Cloudflare Worker.
