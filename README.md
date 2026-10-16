# Calculadora de regimes tributários (Simples, Presumido e Real, 2026 a 2033)

Ferramenta de estimativa para comparar regimes tributários de clientes (legislação de Guarulhos/SP). Roda inteira no navegador, sem servidor e sem build.

## Estrutura

```
index.html              tela: stepper de 5 etapas e resultado em camadas
estilo.css              visual (off-white, azul-marinho, dourado)
calculadora.js          só tela: lê campos, desenha, PDF e compartilhar
motor/parametros.js     parâmetros legais, cada um com a fonte; "PREMISSA" = falta confirmar
motor/simples.js        faixa, alíquota efetiva e partilha do DAS por ano
motor/regimes.js        Simples, Simples com CBS/IBS fora do DAS, Presumido, Real e RET, por ano
motor/renda-pf.js       IRPF 2026 (Lei 15.270), retenção de dividendos, IRPFM e redutor
motor/insights.js       leituras automáticas e avisos de dado faltante
motor/ganho-capital.js  IR na venda de imóvel por pessoa física (sem tela)
dados/armazenamento.js  rascunho automático e histórico (localStorage, só neste navegador)
testes/                 testes do motor (node --test)
cnae.js                 tabela de CNAEs → anexo e Fator R
worker/                 proxy de consulta de CNPJ para Cloudflare Worker (não publicado)
```

O motor não toca no DOM: o mesmo arquivo roda no navegador e no Node.

## Testes

```
npm test
```

Cobrem: o IR de imóvel adquirido em 1980 (R$ 13.712,28, com a redução do art. 18 aplicada uma vez), cada faixa de cada anexo do Simples, a partilha 2026–2033, o cronograma CBS/IBS, IRPF 2026, retenção de dividendos, IRPFM, LC 224/2025 e o rascunho/histórico.

## O que a tela faz

- Etapas: empresa (CNPJ e CNAE travam o enquadramento), faturamento, compras e impostos, sócios e clientes, resultado. "Próximo" só avança com os dados obrigatórios e diz o que falta.
- Avisos de consequência: campo sem dado mostra se o imposto sai maior ou menor.
- Rascunho salvo a cada alteração; histórico de simulações no navegador.
- Resultado: indicadores, tributos por categoria (renda, consumo, folha), comparativo lado a lado sem e com distribuição aos sócios, leituras, crédito do cliente, memória de cálculo com fórmula e fundamento.
- Slider de ano 2026–2033 e período mensal, bimestral, semestral ou anual.
- PDF com projeção 2026–2033 e memória de cálculo. Compartilhar envia o PDF (celular) ou copia um link com os números, sem CNPJ e sem razão social.

## Premissas que dependem de confirmação

Estão marcadas com `PREMISSA` em `motor/parametros.js` e listadas na tela, em "Premissas e pontos a confirmar".

## Publicação

GitHub Pages na branch `main`, pasta raiz. Ao publicar, troque a versão em `version.json` e no `index.html` (script de atualização, `?v=` e rodapé).
