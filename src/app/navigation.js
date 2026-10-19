export const ROUTES = {home: '/', builder: '/builder', jobs: '/jobs', account: '/account', privacy: '/privacy', help: '/help'};
export function routeFromLocation(location = window.location) {
  const legacy = Object.keys(ROUTES).find(route => location.hash === `#/${route}`);
  if (legacy) return legacy;
  return Object.keys(ROUTES).find(route => ROUTES[route] === location.pathname.replace(/\/$/, '') || (route === 'home' && location.pathname === '/')) || 'home';
}
export function navigateTo(route) {
  const target = ROUTES[route] || '/';
  if (window.location.pathname !== target || window.location.hash.startsWith('#/')) {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } else window.scrollTo({top: 0});
}
