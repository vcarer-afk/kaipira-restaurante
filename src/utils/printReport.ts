/**
 * Utilitário Universal de Impressão e PDF sem Erro de OKLCH (Tailwind CSS v4)
 * Evita html2canvas e gera saída de impressão/PDF nativo A4 limpa e compatível.
 */
export const imprimirRelatorioLimpo = (titulo: string, conteudoHtml: string) => {
  const documentoHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${titulo}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 8mm 8mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #000000;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.35;
          }
          .topo-zero {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          h1, h2, h3, h4 {
            margin: 4px 0;
            text-transform: uppercase;
            color: #111111;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            margin-bottom: 8px;
            font-size: 11px;
          }
          th, td {
            border: 1px solid #cccccc;
            padding: 5px 7px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2 !important;
            font-weight: bold;
            color: #222222;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-mono { font-family: 'Courier New', Courier, monospace; }
          .bold { font-weight: bold; }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .card-bloco {
            border: 1px solid #dddddd;
            border-radius: 6px;
            padding: 8px 10px;
            margin-bottom: 10px;
            page-break-inside: avoid;
            break-inside: avoid;
            background: #fafafa;
          }
          /* Suporte a cores de texto e badges comuns no tema escuro convertidos para impressão limpa */
          .text-amber-400, .text-amber-500 { color: #b45309 !important; }
          .text-emerald-400, .text-emerald-500 { color: #047857 !important; }
          .text-blue-400, .text-blue-500 { color: #1d4ed8 !important; }
          .text-red-400, .text-red-500 { color: #b91c1c !important; }
          .text-neutral-400, .text-neutral-500 { color: #555555 !important; }
          .text-white { color: #111111 !important; }
          .bg-neutral-850, .bg-neutral-900, .bg-neutral-950 { background: #ffffff !important; color: #111111 !important; }
          .border-neutral-800, .border-neutral-700 { border-color: #e5e7eb !important; }
        </style>
      </head>
      <body>
        <div class="topo-zero">
          ${conteudoHtml}
        </div>
      </body>
    </html>
  `;

  // 1. Tenta abrir via popup window (padrão)
  let printWindow: Window | null = null;
  try {
    printWindow = window.open('', '_blank', 'width=950,height=850');
  } catch {}

  if (printWindow) {
    try {
      printWindow.document.open();
      printWindow.document.write(documentoHtml);
      printWindow.document.close();
      printWindow.focus();

      setTimeout(() => {
        try {
          printWindow?.print();
          printWindow?.close();
        } catch {}
      }, 350);
      return;
    } catch {}
  }

  // 2. Fallback resiliente para iframes sandboxed onde window.open é bloqueado
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(documentoHtml);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch {}
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 1000);
      }, 350);
    }
  } catch (err) {
    console.error('Erro ao acionar impressão:', err);
  }
};
