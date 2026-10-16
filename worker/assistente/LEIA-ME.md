# Assistente tributário (IA): como colocar no ar

O assistente tem duas partes:

- **No site** (já publicado): `assistente.js` e `assistente-config.js`. O botão "Assistente IA" só aparece quando `assistente-config.js` tiver o endereço do Worker.
- **Este Worker** na Cloudflare: guarda a chave da API da Anthropic e repassa as perguntas. A chave nunca vai para o site nem para o GitHub.

## 1. Chave da API (no navegador, 5 minutos)
1. Entre em https://platform.claude.com e crie uma chave em **API Keys**.
2. Em **Limits**, defina um teto de gasto mensal (por exemplo, US$ 20). É a proteção contra uso abusivo.
3. Não mande a chave para ninguém, nem para o Claude. Ela vai só no passo 2.

## 2. Publicar o Worker (no seu computador, uma vez)
Precisa do Node.js instalado (https://nodejs.org, versão LTS). Abra o Prompt de Comando na pasta `worker/assistente` e rode:

```
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```

- `login` abre o navegador para entrar na conta Cloudflare (a mesma conta gratuita serve).
- `secret put` pede a chave: cole e tecle Enter. Ela fica guardada só na Cloudflare.
- `deploy` mostra o endereço publicado, algo como `https://assistente-tributario.SEU-NOME.workers.dev`.

Opcional: `npx wrangler secret put CODIGO_ACESSO` para exigir um código. Ele fica visível no código do site: barra curiosos, não é senha.

## 3. Ligar o site ao Worker
Em `assistente-config.js`, na raiz do repositório:

```js
window.ASSISTENTE_CONFIG = {
  url: 'https://assistente-tributario.SEU-NOME.workers.dev/chat',
  codigo: ''
};
```

O endereço não é segredo. Publique no GitHub e o botão "Assistente IA" aparece no topo.

## O que ele faz
- **Explica o resultado** da tela, linha por linha da memória de cálculo.
- **Compara cenários**: faturamento maior ou menor, outro ano de 2026 a 2033, com ou sem distribuição de lucros, outro comprador. Também nas simulações imobiliárias.
- **Tira dúvidas de lei** citando o artigo, só a partir de `base-legal.js`.
- **Ajuda a preencher**: mostra os valores e só preenche depois que a pessoa clica em **Aplicar**.

Os números saem sempre do motor da calculadora, que roda no navegador. O modelo não calcula imposto de cabeça. CNPJ, razão social e CNAE não são enviados.

## Custo
Modelo `claude-sonnet-5-5` (US$ 2 por milhão de tokens de entrada e US$ 10 de saída). A parte fixa (instruções, ferramentas e base legal, cerca de 4.300 tokens) fica em cache e custa 5% do preço normal na releitura. Estimativa: US$ 0,03 a 0,06 por pergunta, conforme o tamanho da conversa. O teto do passo 1 limita o total.

## Manutenção
- Lei mudou: edite `base-legal.js` e troque `BASE_LEGAL_VERSAO`; depois `npx wrangler deploy`.
- Itens marcados `[CONFIRMAR]` em `base-legal.js` são respondidos com a ressalva "ainda a confirmar".
- Testes: `npm test` na raiz do repositório (o Worker é testado sem chamar a API).

## LGPD
O rodapé do painel avisa que as perguntas são processadas pela API da Anthropic. Oriente os usuários a não digitar CPF, CNPJ ou nomes de clientes no chat.
