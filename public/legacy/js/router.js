export const routes = ['today', 'program', 'exercises', 'progress', 'profile'];
export function currentRoute() {
  const hashRoute = location.hash.slice(1).split('/')[0];
  if ([...routes, 'workout'].includes(hashRoute)) return hashRoute;
  const pathname = location.pathname.replace(/\/$/, '');
  const routeByPath = {
    '/app': 'today',
    '/app/programs': 'program',
    '/app/exercises': 'exercises',
    '/app/workout': 'workout',
    '/app/progress': 'progress',
    '/app/profile': 'profile',
  };
  if (pathname.startsWith('/app/exercises/')) return 'exercises';
  return routeByPath[pathname] || 'today';
}
export function startRouter(render) {
  addEventListener('hashchange', () => {
    localStorage.setItem('activeTab', currentRoute());
    render();
  });
  render();
}
