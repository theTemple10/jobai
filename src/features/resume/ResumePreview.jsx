import {resumeBlocks} from './resume.js';
export default function ResumePreview({resume}) {
  const blocks=resumeBlocks(resume);
  return <div className="resume-paper">{blocks.length ? blocks.map((block,index)=>{
    const Element=block.type === 'name'?'h2':block.type === 'heading'?'h3':'p';
    return <Element key={index} className={`resume-${block.type}`}>{block.type === 'bullet'?'• ':''}{block.text}</Element>;
  }) : <div className="preview-empty"><span>✧</span><h3>This page is yours.</h3><p>Add a few facts to see your CV take shape.</p></div>}</div>;
}
