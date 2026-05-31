const API_BASE = 'https://projektmelody-archive.onrender.com';

function getIdFromPath(pathname) {
  const prefix = '/api/videos/';
  if (!pathname.startsWith(prefix)) return '';
  const rest = pathname.slice(prefix.length);
  if (!rest) return '';
  if (rest.includes('/')) return '';
  const id = decodeURIComponent(rest);
  if (!/^[a-zA-Z0-9._-]{1,200}$/.test(id)) return '';
  return id;
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const id = getIdFromPath(url.pathname || '');
  if (!id) return new Response('Bad Request', { status: 400 });

  const upstream = await fetch(`${API_BASE}/api/videos/${encodeURIComponent(id)}`, {
    headers: { accept: 'application/json' }
  });
  const body = await upstream.text();

  const headers = new Headers();
  headers.set('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');

  return new Response(body, { status: upstream.status, headers });
}

