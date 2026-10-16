// Cloudflare Worker do Assistente Tributário.
// Recebe POST /chat {messages} do site no GitHub Pages, acrescenta o prompt, a base legal e as ferramentas,
// chama a API do Claude e devolve a resposta. A chave da API fica só aqui (segredo do Worker).
// As ferramentas rodam NO NAVEGADOR, com o motor da calculadora: o modelo nunca calcula imposto de cabeça.
//
// Segredos e variáveis:
//   ANTHROPIC_API_KEY  (obrigatório)  npx wrangler secret put ANTHROPIC_API_KEY
//   CODIGO_ACESSO      (opcional)     o site manda o mesmo valor no cabeçalho X-Codigo-Acesso
//   ORIGENS_EXTRAS     (opcional)     origens a mais, separadas por vírgula (ex.: http://localhost:8080 para testes)
//   LIMITE             (opcional)     limite de chamadas por IP (wrangler.toml)

import { BASE_LEGAL, BASE_LEGAL_VERSAO } from './base-legal.js';

const ORIGENS = ['https://ticontora.github.io'];
const MODELO = 'claude-sonnet-5-5';
const MAX_TOKENS = 1600;
const MAX_MENSAGENS = 50;
const MAX_BYTES = 160_000;

export const PROMPT_SISTEMA = `Você é o Assistente Tributário da Calculadora de Regimes Tributários de um escritório de contabilidade de Guarulhos/SP. A carteira é formada principalmente por feirantes. Quem fala com você é o contador ou o cliente.

A calculadora tem duas partes: "Regimes da empresa" (Simples, Simples Híbrido, Presumido, Real e RET, de 2026 a 2033, com o lucro levado aos sócios) e "Imobiliário" (venda ou locação de imóvel por pessoa física ou empresa).

REGRAS
1. Números: NUNCA calcule imposto de cabeça. Todo valor, alíquota ou comparação sai das ferramentas ler_tela, simular_regimes ou simular_imovel, que rodam o motor da calculadora. Se a ferramenta não devolveu o número, você não o informa. Pode somar ou subtrair valores que as ferramentas devolveram, dizendo de onde vieram.
2. Lei: só afirme regra que esteja na BASE LEGAL, citando o artigo. Item [CONFIRMAR] vai com a ressalva "ainda a confirmar". Fora da base, diga que não está na sua base e que o contador deve confirmar.
3. Explicar o resultado: chame ler_tela, mostre de onde vem cada valor (linha da memória de cálculo) e por que um regime ficou à frente.
4. Ajudar a preencher: pergunte um ou dois dados por vez, em linguagem simples (quanto vende por mês, quanto sobra, quanto compra com nota). Antes de usar preencher_regimes ou preencher_imovel, repita os valores e espere o "sim". A tela só muda se a pessoa clicar em Aplicar.
5. Recomendar: rode simulações dos cenários relevantes (faturamento atual, +20% e −20%; 2026 e 2027; com e sem distribuição de lucros; comprador pessoa física e empresa, quando fizer sentido). Use todos_os_anos para mostrar a transição até 2033. Mostre uma tabela curta e diga qual sai mais barato NESTA estimativa, com as ressalvas: é estimativa, veja a seção 10 da base, e a troca de regime é decisão do contador responsável.
6. Feirante de hortifrúti: lembre que frutas e hortaliças em estado natural têm ICMS isento em SP e CBS/IBS zero (seções 5 e 6) e que a tela não aplica isso sozinha.
7. Dados pessoais: não peça CPF, CNPJ, nome ou endereço. Você não recebe esses dados.

ESTILO
- Português do Brasil, direto, frases curtas. Valores em R$ com duas casas; percentuais com duas casas.
- Até ~150 palavras, salvo pedido de detalhe. Tabela markdown simples para comparar regimes.
- Nunca diga que o resultado é garantido ou oficial.

Base legal versão ${BASE_LEGAL_VERSAO}.`;

const PERIODO = { type: 'integer', enum: [1, 3, 6, 12], description: 'Meses do período mostrado: 1 mensal, 3 trimestral, 6 semestral, 12 anual' };
const ANO = { type: 'integer', minimum: 2026, maximum: 2033 };

// Ferramentas executadas no navegador (aqui só são declaradas ao modelo)
export const FERRAMENTAS = [
  {
    name: 'ler_tela',
    description: 'Lê a calculadora aberta na tela: qual parte está em uso (regimes, imobiliário ou tela de escolha), os dados preenchidos e o resultado do ano escolhido, com memória de cálculo. Use antes de explicar ou recomendar.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'simular_regimes',
    description: 'Roda o motor de regimes da empresa com os dados da tela alterados SÓ para esta simulação (a tela não muda). Percentuais em pontos (20 = 20%). Valores em R$ por mês. todos_os_anos=true devolve o total de cada regime de 2026 a 2033.',
    input_schema: {
      type: 'object',
      properties: {
        receita: { type: 'number', description: 'Faturamento mensal em R$' },
        atividade: { type: 'string', enum: ['comercio', 'industria', 'servicos', 'servicos4', 'servicos5', 'construcao_total', 'construcao_mo', 'locacao', 'holding', 'incorporacao'] },
        margem: { type: 'number', description: 'Lucro antes dos impostos, % do faturamento' },
        folha: { type: 'number', description: 'Folha mensal em R$, com pró-labore' },
        compras: { type: 'number', description: 'Compras com crédito, % do faturamento' },
        icms: { type: 'number' }, iss: { type: 'number' },
        fatorR: { type: 'boolean', description: 'Atividade da lista do Fator R' },
        ano: ANO, periodo: PERIODO,
        comprador: { type: 'string', enum: ['pf', 'pj_real', 'pj_presumido', 'pj_simples'] },
        distribuir: { type: 'boolean', description: 'Levar o lucro aos sócios' },
        socios: { type: 'integer', minimum: 1 },
        pro_labore: { type: 'number', description: 'Pró-labore mensal por sócio, R$' },
        outras_rendas_anuais: { type: 'number', description: 'Outras rendas anuais de cada sócio, R$' },
        cbs_ref: { type: 'number', description: 'CBS de referência, %' }, ibs_ref: { type: 'number', description: 'IBS de referência, %' },
        todos_os_anos: { type: 'boolean' },
        rotulo: { type: 'string', description: 'Nome curto do cenário' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'simular_imovel',
    description: 'Roda o motor imobiliário (venda ou locação; pessoa física, Presumido, Real, Simples e Simples Híbrido) com os dados da tela imobiliária alterados SÓ para esta simulação. Valores em R$. todos_os_anos=true devolve o resultado de 2026 a 2033.',
    input_schema: {
      type: 'object',
      properties: {
        operacao: { type: 'string', enum: ['venda', 'locacao'] },
        ano: ANO, periodo: PERIODO,
        valor_venda: { type: 'number' }, custo_aquisicao: { type: 'number' },
        aquisicao: { type: 'string', description: 'Mês e ano da aquisição, AAAA-MM' },
        mes_venda: { type: 'integer', minimum: 1, maximum: 12 },
        tipo: { type: 'string', enum: ['residencial_usado', 'residencial_novo', 'lote', 'comercial'] },
        corretagem: { type: 'number' }, unico_imovel: { type: 'boolean' }, reinvestido: { type: 'number' },
        natureza: { type: 'string', enum: ['estoque', 'ativo'] },
        aluguel_mensal: { type: 'number' }, imoveis: { type: 'integer', minimum: 1 },
        residencial: { type: 'boolean' }, temporada: { type: 'boolean' },
        despesas_mensais: { type: 'number' }, outras_rendas_mensais: { type: 'number' },
        desconto_simplificado: { type: 'boolean' },
        contrato_antigo_487: { type: 'boolean' }, finalidade_487: { type: 'string', enum: ['residencial', 'nao_residencial'] },
        vendas_ano_anterior: { type: 'integer', minimum: 0 },
        alugueis_ano_anterior: { type: 'number' }, imoveis_alugados_ano_anterior: { type: 'integer', minimum: 0 },
        socios: { type: 'integer', minimum: 1 },
        todos_os_anos: { type: 'boolean' },
        rotulo: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'preencher_regimes',
    description: 'Propõe valores para a calculadora de regimes. A pessoa vê a lista e decide se aplica. Só use depois de ela confirmar os valores na conversa. Mesmas unidades de simular_regimes.',
    input_schema: {
      type: 'object',
      properties: {
        campos: {
          type: 'object',
          properties: {
            receita: { type: 'number' }, atividade: { type: 'string' }, margem: { type: 'number' }, folha: { type: 'number' },
            compras: { type: 'number' }, semCompras: { type: 'boolean' }, icms: { type: 'number' }, iss: { type: 'number' },
            fatorR: { type: 'boolean' }, ano: ANO, periodo: PERIODO,
            comprador: { type: 'string', enum: ['pf', 'pj_real', 'pj_presumido', 'pj_simples'] },
            distribuir: { type: 'boolean' }, socios: { type: 'integer' }, pro_labore: { type: 'number' }
          },
          additionalProperties: false
        },
        justificativa: { type: 'string', description: 'De onde saíram os valores, em uma frase' }
      },
      required: ['campos'],
      additionalProperties: false
    }
  },
  {
    name: 'preencher_imovel',
    description: 'Propõe valores para a calculadora imobiliária. A pessoa vê a lista e decide se aplica. Só use depois de ela confirmar os valores na conversa.',
    input_schema: {
      type: 'object',
      properties: {
        campos: {
          type: 'object',
          properties: {
            operacao: { type: 'string', enum: ['venda', 'locacao'] }, ano: ANO,
            valor_venda: { type: 'number' }, custo_aquisicao: { type: 'number' }, aquisicao: { type: 'string' },
            mes_venda: { type: 'integer' }, tipo: { type: 'string', enum: ['residencial_usado', 'residencial_novo', 'lote', 'comercial'] },
            aluguel_mensal: { type: 'number' }, imoveis: { type: 'integer' }, despesas_mensais: { type: 'number' }
          },
          additionalProperties: false
        },
        justificativa: { type: 'string' }
      },
      required: ['campos'],
      additionalProperties: false
    }
  }
];

function cabecalhos(origin, permitidas) {
  return {
    'Access-Control-Allow-Origin': permitidas.includes(origin) ? origin : permitidas[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Codigo-Acesso',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
}
const resposta = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers });

export function mensagensValidas(m) {
  if (!Array.isArray(m) || m.length === 0 || m.length > MAX_MENSAGENS) return false;
  if (m[0].role !== 'user') return false;
  for (let i = 0; i < m.length; i++) {
    const x = m[i];
    if (!x || (x.role !== 'user' && x.role !== 'assistant')) return false;
    if (i > 0 && m[i - 1].role === x.role) return false;
    if (typeof x.content !== 'string' && !Array.isArray(x.content)) return false;
  }
  return m[m.length - 1].role === 'user';
}

export default {
  async fetch(request, env) {
    const permitidas = ORIGENS.concat((env.ORIGENS_EXTRAS || '').split(',').map(s => s.trim()).filter(Boolean));
    const origin = request.headers.get('Origin') || '';
    const headers = cabecalhos(origin, permitidas);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (new URL(request.url).pathname !== '/chat') return resposta({ erro: 'rota inválida' }, 404, headers);
    if (request.method !== 'POST') return resposta({ erro: 'método não permitido' }, 405, headers);
    if (!permitidas.includes(origin)) return resposta({ erro: 'origem não permitida' }, 403, headers);
    if (env.CODIGO_ACESSO && request.headers.get('X-Codigo-Acesso') !== env.CODIGO_ACESSO)
      return resposta({ erro: 'código de acesso inválido' }, 401, headers);
    if (env.LIMITE) {
      const { success } = await env.LIMITE.limit({ key: request.headers.get('CF-Connecting-IP') || 'desconhecido' });
      if (!success) return resposta({ erro: 'Muitas perguntas seguidas. Aguarde um minuto.' }, 429, headers);
    }
    const texto = await request.text();
    if (texto.length > MAX_BYTES) return resposta({ erro: 'Conversa longa demais. Comece uma nova.' }, 413, headers);
    let corpo;
    try { corpo = JSON.parse(texto); } catch { return resposta({ erro: 'JSON inválido' }, 400, headers); }
    if (!mensagensValidas(corpo.messages)) return resposta({ erro: 'mensagens inválidas' }, 400, headers);

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: MAX_TOKENS,
        // Ferramentas + prompt + base legal são um prefixo fixo: o cache_control no último bloco do system
        // faz a API reaproveitar esse prefixo entre chamadas (leitura a 5% do preço de entrada).
        system: [
          { type: 'text', text: PROMPT_SISTEMA },
          { type: 'text', text: BASE_LEGAL, cache_control: { type: 'ephemeral' } }
        ],
        tools: FERRAMENTAS,
        messages: corpo.messages
      })
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) {
      console.log('erro API', r.status, j && j.error);
      return resposta({ erro: 'O assistente está indisponível agora. Tente de novo em instantes.' }, 502, headers);
    }
    return resposta({ content: j.content, stop_reason: j.stop_reason, usage: j.usage }, 200, headers);
  }
};
