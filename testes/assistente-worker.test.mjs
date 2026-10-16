// Worker do assistente: segurança e formato da chamada à API (fetch simulado; nenhuma chamada real)
import test from 'node:test';
import assert from 'node:assert/strict';
import W, { FERRAMENTAS, PROMPT_SISTEMA } from '../worker/assistente/assistente-proxy.js';
import { BASE_LEGAL } from '../worker/assistente/base-legal.js';

let enviado = null;
globalThis.fetch = async (url, init) => {
  enviado = { url, headers: init.headers, body: JSON.parse(init.body) };
  return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: 1 } }), { status: 200 });
};
const env = { ANTHROPIC_API_KEY: 'sk-teste', CODIGO_ACESSO: 'abc' };
const pedido = (corpo, h = {}) => new Request('https://w.dev/chat', { method: 'POST', headers: { Origin: 'https://ticontora.github.io', 'X-Codigo-Acesso': 'abc', ...h }, body: JSON.stringify(corpo) });
const oi = { messages: [{ role: 'user', content: 'oi' }] };

test('chamada válida: modelo, chave só no servidor, cache no fim do system e 5 ferramentas', async () => {
  const r = await W.fetch(pedido(oi), env);
  assert.equal(r.status, 200);
  assert.equal(enviado.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(enviado.body.model, 'claude-sonnet-5-5');
  assert.equal(enviado.headers['x-api-key'], 'sk-teste');
  assert.deepEqual(enviado.body.system[1].cache_control, { type: 'ephemeral' });
  assert.deepEqual(enviado.body.tools.map(t => t.name), ['ler_tela', 'simular_regimes', 'simular_imovel', 'preencher_regimes', 'preencher_imovel']);
  const corpo = await r.json();
  assert.equal(corpo.content[0].text, 'ok');
  assert.ok(!JSON.stringify(corpo).includes('sk-teste'));
});

test('bloqueios: origem, código, ordem das mensagens, tamanho, rota, limite por IP', async () => {
  assert.equal((await W.fetch(pedido(oi, { Origin: 'https://outro.site' }), env)).status, 403);
  assert.equal((await W.fetch(pedido(oi, { 'X-Codigo-Acesso': 'errado' }), env)).status, 401);
  assert.equal((await W.fetch(pedido({ messages: [{ role: 'assistant', content: 'x' }] }), env)).status, 400);
  assert.equal((await W.fetch(pedido({ messages: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }] }), env)).status, 400);
  assert.equal((await W.fetch(pedido({ messages: [{ role: 'user', content: 'x'.repeat(170000) }] }), env)).status, 413);
  assert.equal((await W.fetch(new Request('https://w.dev/outra', { method: 'POST', headers: { Origin: 'https://ticontora.github.io' } }), env)).status, 404);
  assert.equal((await W.fetch(new Request('https://w.dev/chat', { method: 'OPTIONS', headers: { Origin: 'https://ticontora.github.io' } }), env)).status, 204);
  let n = 0;
  const env2 = { ...env, LIMITE: { limit: async () => ({ success: (++n) < 2 }) } };
  await W.fetch(pedido(oi), env2);
  assert.equal((await W.fetch(pedido(oi), env2)).status, 429);
});

test('origem extra de teste só quando configurada', async () => {
  const local = pedido(oi, { Origin: 'http://localhost:8080' });
  assert.equal((await W.fetch(local, env)).status, 403);
  assert.equal((await W.fetch(pedido(oi, { Origin: 'http://localhost:8080' }), { ...env, ORIGENS_EXTRAS: 'http://localhost:8080' })).status, 200);
});

test('erro da API não vaza detalhe', async () => {
  const antes = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'chave inválida sk-x' } }), { status: 401 });
  const r = await W.fetch(pedido(oi), env);
  globalThis.fetch = antes;
  assert.equal(r.status, 502);
  assert.ok(!(await r.text()).includes('sk-x'));
});

test('base legal e prompt: sem pendências antigas e com as regras de hoje', () => {
  assert.ok(!/9,11% como estimativa/.test(BASE_LEGAL), 'CBS antiga');
  assert.ok(!/NÃO calcula esta camada/.test(BASE_LEGAL), 'distribuição já é calculada');
  assert.ok(/art\. 148/.test(BASE_LEGAL) && /Anexo I, art\. 36/.test(BASE_LEGAL));
  assert.ok(/NUNCA calcule imposto de cabeça/.test(PROMPT_SISTEMA));
  for (const f of FERRAMENTAS) assert.equal(f.input_schema.type, 'object');
});
