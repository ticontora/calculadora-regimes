# Calculadora de regimes tributários e imobiliária (2026 a 2033)

Ferramenta de estimativa para comparar regimes tributários de clientes (legislação de Guarulhos/SP). Roda inteira no navegador, sem servidor e sem build.

## Estrutura

```
index.html              tela: stepper de 5 etapas e resultado em camadas
estilo.css              visual (off-white, azul-marinho, dourado)
calculadora.js          tela dos regimes da empresa e escolha da calculadora
imobiliario-ui.js       tela imobiliária (venda e locação)
pdf-base.js             peças comuns do PDF
motor/parametros.js     parâmetros legais, cada um com a fonte; "PREMISSA" = falta confirmar
motor/simples.js        faixa, alíquota efetiva e partilha do DAS por ano
motor/regimes.js        Simples, Simples Híbrido, Presumido, Real e RET, por ano
motor/renda-pf.js       IRPF 2026 (Lei 15.270), retenção de dividendos, IRPFM e redutor
motor/insights.js       leituras automáticas e avisos de dado faltante
motor/ganho-capital.js  IR na venda de imóvel por pessoa física
motor/imobiliario.js    venda e locação: PF, Presumido, Real, Simples e Simples Híbrido, CBS/IBS com redutores
motor/ipca.js           IPCA mensal (BCB, série 433) para os redutores da LC 214
motor/apuracao.js       Gestor de Apuração Assistida: leitura de XML/CSV, conciliação 3 vias, regras, fila e travas da RAD
apuracao-ui.js          tela do Gestor de Apuração Assistida
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

## Gestor de Apuração Assistida

Terceira opção na tela inicial. Acompanha crédito e débito de CBS/IBS nota a nota para uma carteira de empresas clientes.

- Não consulta a Receita. Trabalha com arquivos importados: XMLs das NF-e (grupo IBSCBS), extrato da apuração assistida (CSV, layout próprio com modelo para baixar) e exportação do ERP (opcional). Tudo fica no navegador.
- Abas: Visão geral (saldo da apuração reconstituído, carteira de clientes, baldes de crédito, top fornecedores, aging, farol de conciliação, projeção, competências), Créditos e débitos, Conciliação (sua base × Fisco e ERP × Fisco), Automações (fila), Configurações (regras com editor em 4 passos, empresas e fornecedores com RAD, prazos e avisos) e Importar dados.
- Regras em modo observação (alguém decide) ou automação (entra na fila como pronta). A calculadora não emite RAD nem lança no ERP: gera os CSVs para você executar.
- Travas da RAD (LC 214, art. 36): só empresa do regime regular, só fornecedor autorizado, teto por empresa e competência (padrão R$ 0, ou seja, desligada até alguém definir).
- Premissas: tags da NT 2025.002; layout do extrato próprio (o oficial não foi verificado); prazo de recolhimento do fornecedor e último dia de ajuste configuráveis.

## O que a tela faz

Ao entrar, a pessoa escolhe a calculadora: **Calculadora Geral Tributária** ou **Calculadora Imobiliária**.

Calculadora Imobiliária: operação (venda ou locação), proprietário (PF, Presumido, Real, Simples), valores, regime de transição (art. 487 para contratos de locação antigos) e resultado com comparação PF × empresa, já com o IR na distribuição de lucros. Cessão de direitos, permuta, incorporação (art. 485), parcelamento do solo (art. 486), art. 488 e Lei 14.973 ficam sob consulta.

Calculadora Geral Tributária:

- Etapas: empresa (CNPJ e CNAE travam o enquadramento), faturamento, compras e impostos, sócios e clientes, resultado. "Próximo" só avança com os dados obrigatórios e diz o que falta.
- Avisos de consequência: campo sem dado mostra se o imposto sai maior ou menor.
- Rascunho salvo a cada alteração; histórico de simulações no navegador.
- Resultado: indicadores, tributos por categoria (renda, consumo, folha), comparativo lado a lado sem e com distribuição aos sócios, leituras, crédito do cliente, memória de cálculo com fórmula e fundamento.
- Slider de ano 2026–2033 e período mensal, trimestral, semestral ou anual.
- PDF com projeção 2026–2033 e memória de cálculo. Compartilhar envia o PDF (celular) ou copia um link com os números, sem CNPJ e sem razão social.

## Premissas que dependem de confirmação

Estão marcadas com `PREMISSA` em `motor/parametros.js` e listadas na tela, em "Premissas e pontos a confirmar".

## Publicação

GitHub Pages na branch `main`, pasta raiz. Ao publicar, troque a versão em `version.json` e no `index.html` (script de atualização, `?v=` e rodapé).

## Calculadora Societária (importada em 10/11/2026)

Abas trazidas da calculadora do Departamento Societário e de Legalização (repositório `societario-cmd/calculadora-regimes-co`, de Adão Vicente), com o mesmo resultado, conferido aba por aba contra a página original:

- **Construção e Incorporação** (`co/construcao.js`): RET 4%/1% e RET de transição (LC 214, art. 485), Presumido e Real com redutores, INSS da obra por aferição no Sero, retenções e CPRB da construtora.
- **Venda de imóveis** (`co/venda.js`): vários imóveis, PF × Presumido × Real, estoque × ativo, permuta com e sem torna, corretagem, venda a prazo, prejuízo fiscal no Real, ITBI do comprador, arts. 486 e 488.
- **Ganho de capital PF** (`co/gcap.js`): formato do GCAP com benfeitorias datadas, herança e doação, condomínio, reinvestimento, venda a prazo e DARF 4600 com vencimento e acréscimos.
- **ITBI** (`co/itbi.js`, `co/docs.js`): compra e venda, integralização (STF, Tema 1.348), fusão/incorporação/cisão com atividade preponderante, custas de cartório SP 2026 e leitura da matrícula e da certidão de valor venal em PDF (pdf.js carregado só quando se envia um arquivo).
- **ITCMD** (`co/itcmd.js`): doação e herança, SP e outros estados, usufruto, quotas e projeção do PL 409/2025.
- **ICMS** (`co/icms.js`): 27 estados, interestadual, DIFAL, FCP, ST com MVA ajustada e previsão com a reforma até 2033.

Os motores ficam em `co/` com os nomes globais `MotorCO` e `IpcaCO`, para não colidir com o motor desta calculadora.

### Sincronização automática

O repositório do Societário é a referência da Calculadora Societária. O workflow `.github/workflows/sincronizar-societario.yml` roda a cada 3 horas (ou à mão, em Actions → "Sincronizar com a calculadora do Societário" → Run workflow):

1. baixa `societario-cmd/calculadora-regimes-co` e compara o último commit com o de `co/ORIGEM.json`;
2. se mudou, roda `co/sincronizar.py`, que regenera os motores, as abas (inclusive abas novas), o CSS, a tela e os testes `testes/co-*.test.js`;
3. roda todos os testes e `testes/paridade-co.js`, que abre as duas páginas e exige o mesmo resultado em cada aba;
4. se tudo passar, publica no `main`; se falhar, nada vai para o ar: as mudanças ficam no branch `sincronizacao-falhou/<commit>` e abre uma issue.

A aba "Regimes gerais" deles não é copiada (aqui ela é a Calculadora Geral Tributária, com motor próprio). Quando ela muda, o workflow abre uma issue para revisão.

Não edite à mão `co/*.js`, `co/co.css`, `co/co-ui.js` nem o bloco entre `CO:INICIO` e `CO:FIM` do `index.html`: a próxima sincronização sobrescreve. Ajustes desta calculadora vão em `co/sincronizar.py`.

Na Calculadora Geral Tributária entraram também: redução de CBS/IBS da atividade (30%, 50%, 60% ou 70%, sugerida pelo CNAE), encargos além da CPP de 20% e a CBS de referência de 11,3% (cálculo do TCU de 28/10/2026).
