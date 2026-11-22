import { useEffect, useState } from 'react';

/** Minimal hash router – works on any static host and makes game links shareable. */
export function parseHash(): string[] {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h.split('?')[0].split('/').filter(Boolean);
}

export function useRoute(): string[] {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(path: string) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
}

export function sessionLink(id: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/session/${id}`;
}
