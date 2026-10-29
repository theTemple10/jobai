import {useId} from 'react';
export default function CVField({label,value,onChange,multiline,options,...props}) {
  const list=useId();
  return <label className="field">{label}{multiline?<textarea rows={4} value={value} onChange={event=>onChange(event.target.value)} {...props}/>:<><input value={value} list={options?list:undefined} onChange={event=>onChange(event.target.value)} {...props}/>{options && <datalist id={list}>{options.map(option=><option key={option} value={option}/>)}</datalist>}</>}</label>;
}
