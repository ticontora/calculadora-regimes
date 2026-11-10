"""Porta as abas da calculadora do Societário (societario-cmd/calculadora-regimes-co) para esta calculadora.

Uso: python3 co/portar.py <template.html do repositório de referência>
Gera co/co.css, co/co-ui.js e co/co-paineis.html (inserido no index.html entre os marcadores CO:INICIO/CO:FIM).
Foi rodado uma vez na importação; depois disso, edite os arquivos gerados direto.
"""
import re, sys, pathlib

AQUI = pathlib.Path(__file__).resolve().parent
t = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8').split('\n')
linhas = lambda a, b: '\n'.join(t[a - 1:b])  # numeração 1-based, inclusiva

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

# ---------- CSS ----------
css_src = linhas(8, 106)
css_src = re.sub(r':root\s*\{.*?\n  \}\n', '', css_src, count=1, flags=re.S)
css_src = re.sub(r'@media \(prefers-color-scheme: dark\).*?\n  \}\n  \}\n', '', css_src, count=1, flags=re.S)
regras = []
def escopo(sel):
    sel = sel.strip()
    if sel in ('*', 'body', 'header', 'footer') or sel.startswith(('header', 'footer', 'body')):
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
tokens = """/* Abas do Societário (portadas de societario-cmd/calculadora-regimes-co). Gerado por co/portar.py. */
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
fim_css = '''
/* Campos com contraste e foco iguais ao resto da calculadora */
#main-co input, #main-co select, #main-co textarea { border-color: var(--campo); }
#main-co input:focus, #main-co select:focus { outline: 3px solid var(--foco); outline-offset: 1px; }
#main-co .co-check input { min-height: 0; width: 18px; height: 18px; }
'''
(AQUI / 'co.css').write_text(tokens + '\n'.join(regras) + '\n' + fim_css, encoding='utf-8')

# ---------- HTML ----------
paineis = linhas(245, 739)
paineis = re.sub(r'<main id="aba-([a-z]+)" hidden>', r'<section class="co-aba" id="aba-\1" role="tabpanel" hidden>', paineis)
paineis = paineis.replace('</main>', '</section>')
paineis = paineis.replace('<section class="co-aba" id="aba-obra" role="tabpanel" hidden>', '<section class="co-aba" id="aba-obra" role="tabpanel">', 1)
paineis = renomear_classes(paineis)
abas = [('obra', 'Construção e Incorporação'), ('venda', 'Venda de imóveis'), ('gcap', 'Ganho de capital PF'), ('itbi', 'ITBI'), ('itcmd', 'ITCMD'), ('icms', 'ICMS')]
nav = '\n'.join('  <button type="button" role="tab" data-aba="%s" aria-selected="%s">%s</button>' % (k, 'true' if i == 0 else 'false', r) for i, (k, r) in enumerate(abas))
html = ('<!-- CO:INICIO (gerado por co/portar.py) -->\n<main id="main-co" hidden>\n'
        '<div class="co-cab"><h2>Calculadora Societária</h2><p>Construção e incorporação, venda de imóveis, ganho de capital, ITBI, ITCMD e ICMS.</p></div>\n'
        '<nav class="abas co-abas" role="tablist" aria-label="Áreas da calculadora societária">\n' + nav + '\n</nav>\n' + paineis +
        '\n<p class="co-rodape">Estimativa para apoio ao estudo tributário; não substitui o parecer. Módulos do Departamento Societário e de Legalização, parâmetros conferidos em 05/11/2026.</p>\n</main>\n<!-- CO:FIM -->')
(AQUI / 'co-paineis.html').write_text(html, encoding='utf-8')

# ---------- JS ----------
ui = linhas(773, 830) + '\n' + linhas(834, 909) + '\n' + linhas(1186, 1614)
ui = re.sub(r'</?script>', '', ui)
ui = ui.replace('window.Motor', 'window.MotorCO').replace('window.IPCA', 'window.IpcaCO')
ui = ui.replace("document.querySelectorAll('.abas button')", "document.querySelectorAll('#main-co .co-abas button')")
ui = ui.replace("document.querySelectorAll('main[id^=\"aba-\"]')", "document.querySelectorAll('#main-co .co-aba')")
ini = ui.index("  const geral = document.getElementById('atividade');")
fim = ui.index('  sugerir();\n', ini) + len('  sugerir();\n')
ui = ui[:ini] + ui[fim:]  # ligação com a aba de regimes da calculadora de referência (não existe aqui)
ui = renomear_classes(ui)
(AQUI / 'co-ui.js').write_text('/* Interação das abas do Societário. Gerado por co/portar.py a partir de template.html. */\n' + ui.strip() + '\n', encoding='utf-8')
print('ok:', len(regras), 'regras CSS,', paineis.count('class="co-aba"'), 'abas')
