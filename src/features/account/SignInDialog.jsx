import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import SignInForm from './SignInForm.jsx';

export default function SignInDialog({onClose}) {
  const dialog=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;
    const app=document.querySelector('.product-app');
    const overflow=document.body.style.overflow;
    if(app) app.inert=true;
    document.body.style.overflow='hidden';
    dialog.current?.querySelector('input')?.focus();
    function keydown(event) {
      if(event.key==='Escape') {event.preventDefault();onClose();}
      if(event.key!=='Tab') return;
      const controls=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')];
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    }
    document.addEventListener('keydown',keydown);
    return ()=>{document.removeEventListener('keydown',keydown);if(app) app.inert=false;document.body.style.overflow=overflow;previous?.focus();};
  },[onClose]);
  return createPortal(<div className="auth-overlay"><div ref={dialog} className="auth-dialog" role="dialog" aria-modal="true" aria-label="Sign in and continue"><button className="text-link auth-close" onClick={onClose}>Close sign-in</button><SignInForm inline/></div></div>,document.body);
}
