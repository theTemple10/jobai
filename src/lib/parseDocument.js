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
  const { unzipSync, strFromU8 } = await import('fflate');
  let total = 0;
  const documents = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter(entry) {
      total += entry.originalSize;
      if (entry.originalSize > 5 * 1024 * 1024 || total > 20 * 1024 * 1024) throw new Error('This Word document is too complex. Please export a simpler PDF.');
      return /^word\/(document|header\d+|footer\d+)\.xml$/.test(entry.name);
    },
  });
  if (!documents['word/document.xml']) throw new Error('This file is not a supported Word document.');
  return Object.entries(documents).map(([, bytes]) => {
    const xml = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('This Word document could not be read. Please try a PDF.');
    return Array.from(xml.getElementsByTagNameNS('*', 'p')).map(paragraph =>
      Array.from(paragraph.getElementsByTagNameNS('*', 't')).map(run => run.textContent).join('')
    ).join('\n');
  }).join('\n').trim();
}
