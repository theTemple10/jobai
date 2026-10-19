import { BRAND } from '../lib/brand.js';

export function ProductHeader({route = 'home', user = null, theme = 'system', onThemeChange = () => {}}) {
  return <header className="product-header"><div className="container product-nav"><a className="brand" href="/" aria-label={`${BRAND.name} home`}><img className="brand-symbol" src="/brand-mark.svg" width="42" height="42" alt="" /><span>{BRAND.name}<small>by Philos Digital Labs</small></span></a><nav aria-label="Main navigation"><a href="/builder" aria-current={route === 'builder' ? 'page' : undefined}>CV builder</a><a href="/jobs" aria-current={route === 'jobs' ? 'page' : undefined}>Find jobs</a><a href="/account" aria-current={route === 'account' ? 'page' : undefined}>{user ? 'My workspace' : 'Save my progress'}</a></nav><button className="theme-toggle" onClick={onThemeChange} aria-label={`Theme: ${theme}. Switch theme.`} title={`Theme: ${theme}`}>{theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}</button></div></header>;
}
export function ProductFooter() {
  return <footer className="product-footer"><div className="container"><a className="footer-brand" href="/">{BRAND.name}<span> {BRAND.tagline}</span></a><div className="footer-links"><a href="/privacy">Your data & privacy</a><a href="/help">Help & support</a></div><p>Built by Philos Digital Labs. You review your documents and submit applications yourself.</p><p>CVs and selected profile facts are sent to our AI provider when you choose writing assistance. Account saving is optional.</p></div></footer>;
}
export default function PublicLayout({children, route}) {
  return <div className="product-app"><ProductHeader route={route} />{children}<ProductFooter /></div>;
}
