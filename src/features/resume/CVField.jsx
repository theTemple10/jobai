export default function CVField({label,value,onChange,multiline,...props}) {
  return <label className="field">{label}{multiline?<textarea rows={4} value={value} onChange={event=>onChange(event.target.value)} {...props}/>:<input value={value} onChange={event=>onChange(event.target.value)} {...props}/>}</label>;
}
