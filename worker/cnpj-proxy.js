// Proxy de consulta de CNPJ para o Cloudflare Worker.
// Recebe GET /cnpj/{14 dígitos}, consulta publica.cnpj.ws (e BrasilAPI como reserva)
// e devolve {razao, situacao} com CORS liberado só para o site do GitHub Pages.

const ORIGENS_PERMITIDAS = ['https://ticontora.github.io'];

function cabecalhos(origin){
  return {
    'Access-Control-Allow-Origin': ORIGENS_PERMITIDAS.includes(origin) ? origin : ORIGENS_PERMITIDAS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
}

function resposta(obj, status, headers){
  return new Response(JSON.stringify(obj), {status, headers});
}

async function consultarFontes(d){
  try {
    const r = await fetch('https://publica.cnpj.ws/cnpj/' + d);
    if (r.ok){
      const j = await r.json();
      return {
        razao: j.razao_social || '',
        cnae: (j.estabelecimento && j.estabelecimento.atividade_principal && j.estabelecimento.atividade_principal.id) || '',
        situacao: (j.estabelecimento && j.estabelecimento.situacao_cadastral) || 'Não informada'
      };
    }
  } catch (e) {}
  try {
    const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + d);
    if (r.ok){
      const j = await r.json();
      return {
        razao: j.razao_social || '',
        cnae: j.cnae_fiscal ? String(j.cnae_fiscal).padStart(7, '0') : '',
        situacao: j.descricao_situacao_cadastral || 'Não informada'
      };
    }
  } catch (e) {}
  return null;
}

export default {
  async fetch(request){
    const origin = request.headers.get('Origin') || '';
    const headers = cabecalhos(origin);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (request.method !== 'GET') return resposta({erro: 'método não permitido'}, 405, headers);
    const m = new URL(request.url).pathname.match(/^\/cnpj\/(\d{14})$/);
    if (!m) return resposta({erro: 'rota inválida'}, 404, headers);
    const dados = await consultarFontes(m[1]);
    if (!dados) return resposta({erro: 'CNPJ não encontrado ou base indisponível'}, 404, headers);
    return resposta(dados, 200, headers);
  }
};
