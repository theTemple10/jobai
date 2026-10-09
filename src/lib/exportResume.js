import { resumeBlocks } from './resume.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const filename = resume => `${(resume.name || 'My CV').replace(/[^a-z0-9 -]/gi, '').trim() || 'My CV'} - CV`;

let fontPromise;
async function pdfFonts() {
  if (!fontPromise) fontPromise = Promise.all(['Regular', 'Bold'].map(async weight => {
    const response = await fetch(`/fonts/NotoSans-${weight}.ttf`);
    if (!response.ok) throw new Error('The PDF font could not load. Please try again or download Word.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    return btoa(binary);
  })).catch(error => {fontPromise = null; throw error;});
  return fontPromise;
}

export async function exportDocx(resume) {
  const {Document, Packer, Paragraph, TextRun, HeadingLevel} = await import('docx');
  const paragraphs = resumeBlocks(resume).map(block => new Paragraph({
    heading: block.type === 'heading' ? HeadingLevel.HEADING_2 : undefined,
    spacing: {before: block.type === 'heading' ? 200 : 0, after: 100},
    bullet: block.type === 'bullet' ? {level: 0} : undefined,
    children: [new TextRun({text: block.text, bold: ['name', 'heading', 'entry'].includes(block.type), size: block.type === 'name' ? 38 : 22, font: 'Arial', color: '172033'})],
    keepNext: ['heading', 'entry'].includes(block.type),
  }));
  const doc = new Document({
    creator: 'JobAI', title: `${resume.name || 'My'} CV`,
    sections: [{properties: {page: {margin: {top: 850, right: 850, bottom: 850, left: 850}}}, children: paragraphs}],
  });
  download(await Packer.toBlob(doc), `${filename(resume)}.docx`);
}

export async function exportPdf(resume) {
  const {jsPDF} = await import('jspdf');
  const pdf = new jsPDF({unit: 'mm', format: 'a4'});
  const [regular, bold] = await pdfFonts();
  pdf.addFileToVFS('NotoSans-Regular.ttf', regular); pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  pdf.addFileToVFS('NotoSans-Bold.ttf', bold); pdf.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  let y = 20;
  const bottom = 277;
  for (const block of resumeBlocks(resume)) {
    const heading = ['name', 'heading', 'entry'].includes(block.type);
    const size = block.type === 'name' ? 20 : block.type === 'heading' ? 12 : 10.5;
    pdf.setFont('NotoSans', heading ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(23, 32, 51);
    if (block.type === 'heading') y += 4;
    const left = block.type === 'bullet' ? 24 : 20;
    const wrapped = pdf.splitTextToSize(block.text, 190 - left);
    const height = size * 0.45;
    if (['heading', 'entry'].includes(block.type) && y + height * (wrapped.length + 2) > bottom) {pdf.addPage(); y = 20;}
    for (let i = 0; i < wrapped.length; i++) {
      if (y + height > bottom) {pdf.addPage(); y = 20;}
      if (block.type === 'bullet' && i === 0) pdf.text('•', 20, y);
      pdf.text(wrapped[i], left, y); y += height;
    }
    y += 2;
  }
  pdf.save(`${filename(resume)}.pdf`);
}

export function exportText(resume) {
  download(new Blob([resumeBlocks(resume).map(b => b.type === 'bullet' ? `- ${b.text}` : b.text).join('\n\n')], {type: 'text/plain;charset=utf-8'}), `${filename(resume)}.txt`);
}
