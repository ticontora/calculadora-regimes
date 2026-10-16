/*
 * Peças comuns do PDF (jsPDF): cabeçalho azul-marinho com faixa dourada, títulos, pares, tabelas com quebra
 * de linha e rodapé numerado. Usado pela calculadora imobiliária.
 */
(function (raiz) {
  'use strict';
  const semAcento = s => String(s).replace(/−/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, ' ');

  function criarPdf(cab) {
    const {jsPDF} = raiz.jspdf;
    const doc = new jsPDF({unit: 'mm', format: 'a4'});
    const W = 210, M = 15, CW = W - 2 * M, TOP = 40, BOTTOM = 276;
    const C = {navy: [20, 33, 61], gold: [201, 162, 39], goldSoft: [248, 240, 217], ink: [20, 33, 61], mut: [90, 99, 116], line: [227, 221, 207], zebra: [250, 248, 243], white: [255, 255, 255]};
    const T = semAcento;
    const hoje = new Date().toLocaleDateString('pt-BR');
    let y = TOP;
    function cabecalho() {
      doc.setFillColor(...C.navy); doc.rect(0, 0, W, 30, 'F');
      doc.setFillColor(...C.gold); doc.rect(0, 30, W, 1.2, 'F');
      doc.setTextColor(...C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text(doc.splitTextToSize(T(cab.titulo), CW)[0], M, 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(T(cab.subtitulo + '   |   ' + hoje), M, 21);
      doc.setTextColor(...C.ink);
    }
    function novaPagina() { doc.addPage(); cabecalho(); y = TOP; }
    function garantir(h) { if (y + h > BOTTOM) novaPagina(); }
    function titulo(t) {
      garantir(18); y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...C.navy);
      doc.text(T(t.toUpperCase()), M, y); y += 2;
      doc.setDrawColor(...C.gold); doc.setLineWidth(0.6); doc.line(M, y, M + 24, y);
      y += 6; doc.setLineWidth(0.2); doc.setTextColor(...C.ink);
    }
    function texto(t, tam, cor) {
      const s = tam || 9;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(s); doc.setTextColor(...(cor || C.ink));
      const ls = doc.splitTextToSize(T(t), CW);
      const h = ls.length * s * 0.3528 * 1.25 + 2;
      garantir(h);
      doc.text(ls, M, y + 3);
      y += h;
    }
    function pares(lista) {
      const colW = CW / 3;
      for (let i = 0; i < lista.length; i += 3) {
        garantir(11);
        lista.slice(i, i + 3).forEach((p, j) => {
          const x = M + j * colW;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.mut);
          doc.text(T(p[0]), x, y);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink);
          doc.text(doc.splitTextToSize(T(String(p[1])), colW - 3)[0], x, y + 4.8);
        });
        y += 11;
      }
      y += 1;
    }
    function tabela(cabecalhos, linhas, larguras, alinha, opts) {
      const o = opts || {};
      const fs = o.fs || 8.5, lh = fs * 0.3528 * 1.25, pad = 2;
      const ws = larguras.map(f => f * CW);
      function linhaCab() {
        doc.setFillColor(...C.navy); doc.rect(M, y, CW, 7.5, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(fs); doc.setTextColor(...C.white);
        let x = M;
        cabecalhos.forEach((c, i) => { doc.text(T(c), alinha[i] === 'r' ? x + ws[i] - pad : x + pad, y + 5, {align: alinha[i] === 'r' ? 'right' : 'left'}); x += ws[i]; });
        y += 7.5;
      }
      garantir(15.5);
      linhaCab();
      linhas.forEach((ln, r) => {
        const negrito = o.negrito && o.negrito(r);
        doc.setFont('helvetica', negrito ? 'bold' : 'normal'); doc.setFontSize(fs);
        const partes = ln.map((c, i) => doc.splitTextToSize(T(String(c)), ws[i] - 2 * pad));
        const h = Math.max(...partes.map(p => p.length)) * lh + 2.6;
        if (y + h > BOTTOM) { novaPagina(); linhaCab(); doc.setFont('helvetica', negrito ? 'bold' : 'normal'); doc.setFontSize(fs); }
        doc.setFillColor(...((o.destaque && o.destaque(r)) ? C.goldSoft : (r % 2 ? C.zebra : C.white)));
        doc.rect(M, y, CW, h, 'F');
        doc.setTextColor(...C.ink);
        let x = M;
        partes.forEach((p, i) => { doc.text(p, alinha[i] === 'r' ? x + ws[i] - pad : x + pad, y + lh + 0.4, {align: alinha[i] === 'r' ? 'right' : 'left'}); x += ws[i]; });
        y += h;
      });
      doc.setDrawColor(...C.line); doc.line(M, y, W - M, y);
      y += 6;
    }
    function caixa(linhas) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      const ls = linhas.flatMap(t => doc.splitTextToSize(T(t), CW - 10));
      const h = ls.length * 5 + 7;
      garantir(h + 4);
      doc.setFillColor(...C.goldSoft); doc.rect(M, y, CW, h, 'F');
      doc.setFillColor(...C.gold); doc.rect(M, y, 1.4, h, 'F');
      doc.setTextColor(...C.navy); doc.text(ls, M + 5, y + 6);
      doc.setTextColor(...C.ink);
      y += h + 6;
    }
    function finalizar() {
      const n = doc.internal.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setDrawColor(...C.line); doc.line(M, 282, W - M, 282);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.mut);
        doc.text(T('Estimativa com a legislação vigente em ' + hoje + '. Confirme com o contador responsável.'), M, 287);
        doc.text('Página ' + i + ' de ' + n, W - M, 287, {align: 'right'});
      }
      return doc.output('arraybuffer');
    }
    cabecalho();
    return {doc, titulo, texto, pares, tabela, caixa, finalizar, cores: C};
  }
  raiz.PdfBase = {criarPdf};
})(typeof self !== 'undefined' ? self : this);
