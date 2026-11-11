"""Sincroniza a Calculadora Societária com o repositório de referência do Societário.

Uso: python3 co/sincronizar.py <pasta do clone de societario-cmd/calculadora-regimes-co>

Lê a estrutura da página de referência (não depende de números de linha):
- motores: os arquivos que o build.py deles embute no template, na ordem do template;
- abas: os botões da navegação, menos "geral" (a aba de regimes, que aqui é a Calculadora Geral Tributária);
- painéis: cada <main id="aba-X">; scripts de tela: os <script> grandes, menos o da aba geral.
Gera co/*.js, co/co.css, co/co-ui.js, os testes testes/co-*.test.js, os blocos do index.html entre
CO:INICIO/CO:FIM e CO-SCRIPTS:INICIO/CO-SCRIPTS:FIM, e co/ORIGEM.json com o commit de origem.
Não edite à mão os arquivos gerados: a próxima sincronização sobrescreve.
"""
import json, re, subprocess, sys, pathlib, datetime

REF = pathlib.Path(sys.argv[1]).resolve()
CO = pathlib.Path(__file__).resolve().parent
RAIZ = CO.parent
avisos = []

t = (REF / 'template.html').read_text(encoding='utf-8')
build = (REF / 'build.py').read_text(encoding='utf-8')
try:
    commit = subprocess.run(['git', '-C', str(REF), 'rev-parse', 'HEAD'], capture_output=True, text=True, check=True).stdout.strip()
except Exception:
    commit = 'desconhecido'
curto = commit[:7]

def renomear_globais(s):
    s = re.sub(r'\braiz\.Motor\b', 'raiz.MotorCO', s)
    s = re.sub(r'\braiz\.IPCA\b', 'raiz.IpcaCO', s)
    s = re.sub(r'\bwindow\.Motor\b', 'window.MotorCO', s)
    s = re.sub(r'\bwindow\.IPCA\b', 'window.IpcaCO', s)
    return s

# Classes que colidem com o estilo desta calculadora: ganham prefixo co-
CLASSES = ['cartao', 'cartoes', 'btn', 'check', 'secao', 'aviso', 'avisos', 'tag', 'acoes', 'selo']
def renomear_classes(s):
    def attr(m):
        val = ' '.join(('co-' + c) if c in CLASSES else c for c in m.group(2).split(' '))
        return m.group(1) + val + m.group(3)
    s = re.sub(r'''(class=\\?")([^"\\']*)(\\?"|')''', attr, s)
    s = re.sub(r"(classList\.(?:add|remove|toggle|contains)\(')(%s)(')" % '|'.join(CLASSES), lambda m: m.group(1) + 'co-' + m.group(2) + m.group(3), s)
    s = re.sub(r"(['\" (>,])\.(%s)(?=[\s.:,\['\")>]|$)" % '|'.join(CLASSES), lambda m: m.group(1) + '.co-' + m.group(2), s)
    return s

# ---------- Motores (lista e ordem vêm do build.py e do template) ----------
variaveis = dict(re.findall(r"(\w+)\s*=\s*open\('([\w.-]+\.js)'", build))
marcador_arquivo = {mk: variaveis[v] for mk, v in re.findall(r"replace\('/\*(\w+)\*/',\s*(\w+)\)", build) if v in variaveis}
ordem = [mk for mk in re.findall(r'<script>\s*/\*(\w+)\*/\s*</script>', t) if mk in marcador_arquivo]
motores = [marcador_arquivo[mk] for mk in ordem]
if not motores:
    sys.exit('ERRO: não achei os motores no build.py/template.html da referência')

PDFJS_LOADER = """  // pdf.js só é baixado quando alguém envia um PDF (evita ~1 MB em toda abertura da página)
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  function carregarPdfjs() {
    if (raiz.pdfjsLib) return Promise.resolve(raiz.pdfjsLib);
    return new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js';
      s.onload = () => { try { raiz.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; } catch (e) {} ok(raiz.pdfjsLib); };
      s.onerror = () => erro(new Error('Leitor de PDF indisponível.'));
      document.head.appendChild(s);
    });
  }
"""
pdf_preguicoso = False
for f in motores:
    s = renomear_globais((REF / f).read_text(encoding='utf-8'))
    if f == 'docs.js':
        alvo = re.search(r"const lib = raiz\.pdfjsLib;\s*\n\s*if \(!lib\) throw new Error\([^)]*\);", s)
        ancora = s.find('async function textoDoPdf')
        if alvo and ancora > 0:
            s = s[:alvo.start()] + 'const lib = await carregarPdfjs();' + s[alvo.end():]
            ancora = s.find('async function textoDoPdf')
            ini_linha = s.rfind('\n', 0, ancora) + 1
            s = s[:ini_linha] + PDFJS_LOADER + s[ini_linha:]
            pdf_preguicoso = True
        else:
            avisos.append('docs.js mudou: pdf.js volta a ser carregado na abertura da página.')
    (CO / f).write_text(s, encoding='utf-8')

# ---------- Testes deles ----------
TESTES = RAIZ / 'testes'
for velho in TESTES.glob('co-*.test.js'):
    velho.unlink()
for arq in sorted((REF / 'testes').glob('*.test.js')):
    s = arq.read_text(encoding='utf-8')
    s = re.sub(r"require\('\.\./([\w.-]+\.js)'\)", r"require('../co/\1')", s)
    (TESTES / ('co-' + arq.name)).write_text(s, encoding='utf-8')

# ---------- CSS ----------
css_src = re.search(r'<style>(.*?)</style>', t, re.S).group(1)
css_src = re.sub(r'/\*.*?\*/', '', css_src, flags=re.S)
css_src = re.sub(r':root\s*\{[^{}]*\}', '', css_src, count=1)
css_src = re.sub(r'@media \(prefers-color-scheme: dark\)\s*\{\s*[^{}]*\{[^{}]*\}\s*\}', '', css_src, count=1)
regras = []
def escopo(sel):
    sel = sel.strip()
    if not sel or sel in ('*', 'body', 'header', 'footer') or sel.startswith(('header', 'footer', 'body', ':root')):
        return None
    if sel.startswith('[hidden]'):
        return '#main-co ' + sel
    if sel == 'main':
        return '#main-co .co-aba'
    sel = renomear_classes(' ' + sel)[1:]
    return '#main-co ' + sel
def processar(bloco):
    out = []
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', bloco):
        sels = [escopo(s) for s in m.group(1).split(',')]
        sels = [s for s in sels if s]
        if sels:
            out.append(', '.join(sels) + ' {' + m.group(2).strip() + '}')
    return out
pos = 0
for m in re.finditer(r'@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}', css_src):
    regras += processar(css_src[pos:m.start()])
    internas = processar(m.group(2))
    if internas:
        regras.append('@media' + m.group(1).rstrip() + ' {\n  ' + '\n  '.join(internas) + '\n}')
    pos = m.end()
regras += processar(css_src[pos:])
tokens = """/* Abas do Societário (societario-cmd/calculadora-regimes-co). Gerado por co/sincronizar.py: não edite à mão. */
#main-co {
  --navy: var(--ink); --navy-2: var(--ink2); --gold: #c9a227;
  --surface: #ffffff; --surface-2: #faf8f3; --line: #e3ddcf;
  --text: var(--ink); --text-2: var(--ink2); --muted: var(--mut);
  --s1: #2a5bd7; --s2: #c2410c; --s3: #157148; --s4: #a16207;
  --ok-bg: #e5f2ea; --ok: #157148; --warn-bg: #fcefe2; --warn: #a84b06;
  font-size: 14px; line-height: 1.45; padding-top: 8px;
}
#main-co .co-cab { max-width: 1280px; margin: 0 auto; padding: 8px 20px 0; }
#main-co .co-cab h2 { margin: 0; font-size: 20px; color: var(--ink); }
#main-co .co-cab p { margin: 4px 0 0; color: var(--mut); font-size: 13px; }
#main-co .co-abas { flex-wrap: wrap; border-bottom: 1px solid var(--navy); }
#main-co .co-abas button { min-height: 40px; }
#main-co .co-aba > * { min-width: 0; }
#main-co .co-rodape { max-width: 1280px; margin: 0 auto; padding: 0 20px 30px; color: var(--muted); font-size: 12px; }
"""
fim_css = """
/* Ajustes desta calculadora (contraste dos campos e celular) */
#main-co input, #main-co select, #main-co textarea { border-color: var(--campo); }
#main-co input:focus, #main-co select:focus { outline: 3px solid var(--foco); outline-offset: 1px; }
#main-co .co-check input { min-height: 0; width: 18px; height: 18px; }
@media (max-width: 700px) {
  #main-co .co-abas { flex-wrap: nowrap; overflow-x: auto; padding: 10px 12px 0; }
  #main-co .co-abas button { white-space: nowrap; padding: 8px 12px; }
  #main-co .co-cartoes, #main-co .faixa-box { grid-template-columns: 1fr; }
  #main-co .linha2 { grid-template-columns: 1fr; }
  #main-co [id$="cartoes"] { grid-template-columns: 1fr !important; }
  #main-co .co-aba table { display: block; overflow-x: auto; max-width: 100%; }
  #main-co .co-aba { padding: 12px; }
}
"""
(CO / 'co.css').write_text(tokens + '\n'.join(regras) + '\n' + fim_css, encoding='utf-8')

# ---------- Abas e painéis ----------
nav_ref = re.search(r'<nav class="abas"[^>]*>(.*?)</nav>', t, re.S).group(1)
abas = [(k, re.sub(r'\s+', ' ', r).strip()) for k, r in re.findall(r'data-aba="([\w-]+)"[^>]*>([^<]*)</button>', nav_ref) if k != 'geral']
paineis = []
for k, _ in abas:
    m = re.search(r'<main id="aba-%s"[^>]*>(.*?)</main>' % re.escape(k), t, re.S)
    if not m:
        sys.exit('ERRO: aba "%s" sem painel <main id="aba-%s">' % (k, k))
    paineis.append('<section class="co-aba" id="aba-%s" role="tabpanel"%s>%s</section>' % (k, '' if not paineis else ' hidden', m.group(1)))
paineis_html = renomear_classes('\n'.join(paineis))
nav = '\n'.join('  <button type="button" role="tab" data-aba="%s" aria-selected="%s">%s</button>' % (k, 'true' if i == 0 else 'false', r) for i, (k, r) in enumerate(abas))
descricao = ', '.join(r for _, r in abas)
bloco_paineis = ('<!-- CO:INICIO (gerado por co/sincronizar.py a partir de societario-cmd/calculadora-regimes-co@%s) -->\n<main id="main-co" hidden>\n' % curto +
    '<div class="co-cab"><h2>Calculadora Societária</h2><p>%s.</p></div>\n' % descricao +
    '<nav class="abas co-abas" role="tablist" aria-label="Áreas da calculadora societária">\n' + nav + '\n</nav>\n' + paineis_html +
    '\n<p class="co-rodape">Estimativa para apoio ao estudo tributário; não substitui o parecer. Módulos do Departamento Societário e de Legalização.</p>\n</main>\n<!-- CO:FIM -->')

# ---------- Scripts de tela ----------
telas = []
for m in re.finditer(r'<script>(.*?)</script>', t, re.S):
    b = m.group(1)
    if len(b.strip()) < 300 or re.fullmatch(r'\s*/\*\w+\*/\s*', b) or 'GlobalWorkerOptions' in b:
        continue
    if "$('form')" in b:  # tela da aba de regimes deles: aqui é a Calculadora Geral Tributária
        continue
    telas.append(b.strip('\n'))
ui = renomear_globais('\n'.join(telas))
ui = ui.replace("document.querySelectorAll('.abas button')", "document.querySelectorAll('#main-co .co-abas button')")
ui = ui.replace("document.querySelectorAll('main[id^=\"aba-\"]')", "document.querySelectorAll('#main-co .co-aba')")
ui = ui.replace("document.querySelector('.abas button", "document.querySelector('#main-co .co-abas button")
ini = ui.find("const geral = document.getElementById('atividade');")
if ini >= 0:  # ligação com a aba de regimes deles, que não existe aqui
    ini = ui.rfind('\n', 0, ini) + 1
    fim = ui.find('  sugerir();\n})();', ini)
    if fim > 0:
        ui = ui[:ini] + ui[fim + len('  sugerir();\n'):]
    else:
        avisos.append('Bloco que liga a aba de obra à aba de regimes mudou; conferir co-ui.js.')
ui = renomear_classes(ui)
(CO / 'co-ui.js').write_text('/* Interação das abas do Societário. Gerado por co/sincronizar.py: não edite à mão. */\n' + ui.strip() + '\n', encoding='utf-8')

ids_html = set(re.findall(r'id="([^"]+)"', paineis_html))
for i in sorted(set(re.findall(r"(?:\$|getElementById)\('([\w-]+)'\)", ui)) - ids_html):
    if i in ('atividade', 'cnae', 'form', 'buscar', 'aplicar-cnae'):
        avisos.append('co-ui.js ainda referencia o campo "%s" da aba de regimes deles.' % i)

# ---------- index.html ----------
idx_p = RAIZ / 'index.html'
idx = idx_p.read_text(encoding='utf-8')
idx = re.sub(r'<!-- CO:INICIO.*?<!-- CO:FIM -->', lambda _: bloco_paineis, idx, count=1, flags=re.S)
tags = []
if not pdf_preguicoso:
    tags += ['<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>',
             "<script>try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {}</script>"]
tags += ['<script src="co/%s?v=%s"></script>' % (f, curto) for f in motores + ['co-ui.js']]
bloco_scripts = '<!-- CO-SCRIPTS:INICIO -->\n' + '\n'.join(tags) + '\n<!-- CO-SCRIPTS:FIM -->'
if '<!-- CO-SCRIPTS:INICIO -->' in idx:
    idx = re.sub(r'<!-- CO-SCRIPTS:INICIO -->.*?<!-- CO-SCRIPTS:FIM -->', lambda _: bloco_scripts, idx, count=1, flags=re.S)
else:  # primeira vez: troca as tags soltas da importação manual
    idx = re.sub(r'(?:<script src="co/[\w.-]+\.js\?v=[\w.-]+"></script>\n?)+', lambda _: bloco_scripts + '\n', idx, count=1)
idx = re.sub(r'href="co/co\.css\?v=[\w.-]+"', 'href="co/co.css?v=%s"' % curto, idx)
idx_p.write_text(idx, encoding='utf-8')

# ---------- Aba de regimes deles (não é portada automaticamente) ----------
import hashlib
geral = (REF / 'motor.js').read_text(encoding='utf-8') if (REF / 'motor.js').exists() else ''
mg = re.search(r'<main id="aba-geral".*?</main>', t, re.S)
geral += mg.group(0) if mg else ''
geral += ''.join(m.group(1) for m in re.finditer(r'<script>(.*?)</script>', t, re.S) if "$('form')" in m.group(1))
hash_geral = hashlib.sha256(geral.encode('utf-8')).hexdigest()[:16]
try:
    anterior = json.loads((CO / 'ORIGEM.json').read_text(encoding='utf-8'))
except Exception:
    anterior = {}
geral_mudou = bool(anterior.get('hash_geral')) and anterior.get('hash_geral') != hash_geral
commit_anterior = anterior.get('commit', '')

(CO / 'ORIGEM.json').write_text(json.dumps({
    'repositorio': 'https://github.com/societario-cmd/calculadora-regimes-co',
    'commit': commit, 'sincronizado_em': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'),
    'abas': [k for k, _ in abas], 'motores': motores, 'hash_geral': hash_geral, 'avisos': avisos}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(CO / 'co-paineis.html').unlink(missing_ok=True)
print('ok: commit %s, %d abas (%s), %d motores, %d regras CSS' % (curto, len(abas), ', '.join(k for k, _ in abas), len(motores), len(regras)))
for a in avisos:
    print('AVISO:', a)
if geral_mudou:
    print('GERAL_MUDOU: a aba de regimes da referência mudou entre %s e %s; revisar a Calculadora Geral Tributária.' % (commit_anterior[:7], curto))
