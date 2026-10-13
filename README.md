# Calculadora de regimes tributários (Simples, híbrido, Presumido e Real)

Ferramenta de estimativa para comparar regimes tributários de clientes, com base na legislação de Guarulhos/SP. Roda no navegador.

## Uso
Informe o CNPJ (a razão social preenche sozinha quando a consulta funciona), o faturamento, a atividade e os percentuais de margem, compras, ICMS e ISS. Gere o PDF da análise.

## Atividades e anexos
- Comércio (Anexo I) e indústria (Anexo II), com híbrido.
- Serviços (Anexo III), para atividades que não estão nos Anexos IV e V.
- Serviços de limpeza, vigilância, obras e paisagismo (Anexo IV), com CPP de 20% sobre a folha fora do DAS.
- Serviços do Anexo V, com Fator R apenas quando a atividade estiver marcada como da lista do Fator R.

## Simplificações
- Fator R usa a folha do mês como aproximação da média de 12 meses.
- PIS e COFINS no Lucro Real são apuração simplificada, com crédito sobre as compras informadas.
- Presunção de serviços: 32% para IRPJ e CSLL. Atividades com presunção diferente não estão modeladas.
- Não considera MEI, substituição tributária, DIFAL, RAT, contribuições a terceiros, compensação de prejuízo nem regimes específicos de ICMS.

## Limitações
- Os valores são estimativas e não substituem a apuração do contador. Revise com o contador antes de usar com o cliente.
- A consulta de CNPJ depende de um serviço externo, que pode ser bloqueado pelo navegador.

## Publicação
Repositório público com GitHub Pages ativado na branch `main`, pasta raiz. A pasta `worker/` contém o código do proxy de consulta de CNPJ para o Cloudflare Worker.
