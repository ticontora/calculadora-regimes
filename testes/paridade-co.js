// Paridade com a calculadora do Societário: abre a página de referência e esta calculadora,
// percorre cada aba da Calculadora Societária com os valores padrão e exige o mesmo texto de resultado.
// Uso: node testes/paridade-co.js <pasta do clone de societario-cmd/calculadora-regimes-co>
// Requer o pacote playwright com o Chromium instalado.
const http = require('http');
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');

const REF = path.resolve(process.argv[2] || '../ref');
const NOS = path.resolve(__dirname, '..');
const TIPOS = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png'};

function servir(raiz) {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      const p = path.join(raiz, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!p.startsWith(raiz) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, {'Content-Type': TIPOS[path.extname(p)] || 'application/octet-stream'});
      fs.createReadStream(p).pipe(res);
    }).listen(0, () => ok(s));
  });
}

(async () => {
  if (!fs.existsSync(path.join(REF, 'index.html'))) throw new Error('index.html da referência não encontrado em ' + REF);
  const origem = JSON.parse(fs.readFileSync(path.join(NOS, 'co', 'ORIGEM.json'), 'utf8'));
  const [sRef, sNos] = await Promise.all([servir(REF), servir(NOS)]);
  const navegador = await chromium.launch();
  const erros = [];
  async function ler(url, nossa) {
    const p = await navegador.newPage({viewport: {width: 1280, height: 900}});
    p.on('pageerror', e => erros.push((nossa ? 'nossa: ' : 'referência: ') + e.message));
    // bloqueia rede externa (CNPJ, CDN): o resultado não depende dela
    await p.route(u => !u.hostname || !['127.0.0.1', 'localhost'].includes(u.hostname), r => r.abort());
    await p.goto(url);
    await p.waitForTimeout(600);
    if (nossa) {
      await p.getByRole('button', {name: /Entrar/}).click();
      await p.waitForTimeout(700);
      await p.click('[data-modo="co"]');
    }
    const r = {};
    for (const aba of origem.abas) {
      await p.click((nossa ? '#main-co ' : '') + `[data-aba="${aba}"]`);
      await p.waitForTimeout(300);
      r[aba] = await p.evaluate(a => {
        const s = document.getElementById('aba-' + a);
        return [...s.querySelectorAll('table td, table th, [id$="cartoes"]')].map(x => x.innerText.trim()).join('|');
      }, aba);
    }
    await p.close();
    return r;
  }
  const ref = await ler(`http://127.0.0.1:${sRef.address().port}/index.html`, false);
  const nos = await ler(`http://127.0.0.1:${sNos.address().port}/index.html`, true);
  await navegador.close(); sRef.close(); sNos.close();
  let falhou = erros.length > 0;
  for (const aba of origem.abas) {
    const igual = ref[aba] === nos[aba] && ref[aba].length > 0;
    if (!igual) falhou = true;
    console.log((igual ? 'IDÊNTICO  ' : 'DIFERENTE ') + aba + ' (' + ref[aba].length + ' caracteres)');
  }
  erros.forEach(e => console.log('ERRO DE JAVASCRIPT: ' + e));
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
