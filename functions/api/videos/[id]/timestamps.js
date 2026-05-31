const API_BASE = 'https://projektmelody-archive.onrender.com';

function getClientIp(req) {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return String(xff).split(',')[0].trim();
  return '';
}

function getIdFromPath(pathname) {
  const prefix = '/api/videos/';
  if (!pathname.startsWith(prefix)) return '';
  const rest = pathname.slice(prefix.length);
  const parts = rest.split('/');
  if (parts.length !== 2) return '';
  if (parts[1] !== 'timestamps') return '';
  const id = decodeURIComponent(parts[0] || '');
  if (!/^[a-zA-Z0-9._-]{1,200}$/.test(id)) return '';
  return id;
}

export async function onRequestPost({ request }) {
  const url = new URL(request.url);
  const id = getIdFromPath(url.pathname || '');
  if (!id) return new Response('Bad Request', { status: 400 });

  const clientIp = getClientIp(request);
  const headers = new Headers();
  headers.set('accept', 'application/json');
  headers.set('content-type', request.headers.get('content-type') || 'application/json');
  if (clientIp) {
    headers.set('x-forwarded-for', clientIp);
    headers.set('x-real-ip', clientIp);
  }

  const body = await request.text();
  const upstream = await fetch(`${API_BASE}/api/videos/${encodeURIComponent(id)}/timestamps`, {
    method: 'POST',
    headers,
    body
  });

  const resBody = await upstream.text();
  const resHeaders = new Headers();
  resHeaders.set('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  resHeaders.set('cache-control', 'no-store');

  return new Response(resBody, { status: upstream.status, headers: resHeaders });
}

