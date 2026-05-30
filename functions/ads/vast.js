export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '5938356';
  if (!/^\d{1,20}$/.test(id)) {
    return new Response('Bad Request', { status: 400 });
  }

  const getHeader = name => request.headers.get(name) || '';
  const upstreamHeaders = new Headers();
  upstreamHeaders.set('user-agent', getHeader('user-agent') || 'Mozilla/5.0');
  upstreamHeaders.set('accept', getHeader('accept') || 'application/xml,text/xml,*/*');
  if (getHeader('accept-language')) upstreamHeaders.set('accept-language', getHeader('accept-language'));
  if (getHeader('sec-ch-ua')) upstreamHeaders.set('sec-ch-ua', getHeader('sec-ch-ua'));
  if (getHeader('sec-ch-ua-mobile')) upstreamHeaders.set('sec-ch-ua-mobile', getHeader('sec-ch-ua-mobile'));
  if (getHeader('sec-ch-ua-platform')) upstreamHeaders.set('sec-ch-ua-platform', getHeader('sec-ch-ua-platform'));
  if (getHeader('sec-ch-ua-platform-version')) upstreamHeaders.set('sec-ch-ua-platform-version', getHeader('sec-ch-ua-platform-version'));
  if (getHeader('sec-ch-ua-arch')) upstreamHeaders.set('sec-ch-ua-arch', getHeader('sec-ch-ua-arch'));
  if (getHeader('sec-ch-ua-model')) upstreamHeaders.set('sec-ch-ua-model', getHeader('sec-ch-ua-model'));
  if (getHeader('sec-ch-ua-bitness')) upstreamHeaders.set('sec-ch-ua-bitness', getHeader('sec-ch-ua-bitness'));
  if (getHeader('sec-ch-ua-full-version-list')) upstreamHeaders.set('sec-ch-ua-full-version-list', getHeader('sec-ch-ua-full-version-list'));

  const extractVastAdTagUri = xml => {
    const m = xml.match(/<VASTAdTagURI\b[^>]*>([\s\S]*?)<\/VASTAdTagURI>/i);
    if (!m) return '';
    return String(m[1] || '')
      .replace(/<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      .trim();
  };

  const isSafeUrl = u => {
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost') return false;
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
      if (/^\[.*\]$/.test(host)) return false;
      return u.length <= 2048;
    } catch {
      return false;
    }
  };

  let next = `https://s.magsrv.com/v1/vast.php?id=${id}`;
  let res = null;
  let body = '';

  for (let i = 0; i < 4; i++) {
    res = await fetch(next, { headers: upstreamHeaders });
    body = await res.text();
    const wrapper = extractVastAdTagUri(body);
    if (!wrapper || !isSafeUrl(wrapper)) break;
    next = wrapper;
  }

  const headers = new Headers();
  headers.set('content-type', 'application/xml; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('access-control-allow-origin', '*');

  return new Response(body, {
    status: res.status,
    headers
  });
}
