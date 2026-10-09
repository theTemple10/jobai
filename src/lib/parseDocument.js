import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export async function extractPdfText(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({data: await file.arrayBuffer()}).promise;
  try {
    const pages = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    return pages.join('\n').trim();
  } finally {await pdf.destroy();}
}

export async function extractDocxText(file) {
  const mammoth = await import('mammoth/mammoth.browser');
  const result = await mammoth.extractRawText({arrayBuffer: await file.arrayBuffer()});
  return (result.value || '').trim();
}
