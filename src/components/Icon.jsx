const paths = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  location: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  document: <><path d="M14 3H6v18h12V7l-4-4Z" /><path d="M14 3v5h4M9 12h6M9 16h6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="3" /><path d="M8 7V4h8v3M3 12c6 4 12 4 18 0M12 12v4" /></>,
  spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />,
};
export default function Icon({name, size = 20, ...props}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.arrow}</svg>;
}
