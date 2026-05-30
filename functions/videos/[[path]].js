export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname || '';

  const prefix = '/videos/';
  if (!pathname.startsWith(prefix)) {
    return new Response('Not found', { status: 404 });
  }

  const rawKey = pathname.slice(prefix.length);
  const key = decodeURIComponent(rawKey);
  if (!key || key.endsWith('/')) {
    return new Response('Not found', { status: 404 });
  }

  const rangeHeader = context.request.headers.get('Range');
  const bucket = context.env.R2_VIDEOS;

  if (!bucket) {
    return new Response('R2 binding missing', { status: 500 });
  }

  const ext = key.toLowerCase().split('.').pop();
  const contentType =
    ext === 'mp4'
      ? 'video/mp4'
      : ext === 'm3u8'
          ? 'application/vnd.apple.mpegurl'
          : ext === 'ts'
              ? 'video/mp2t'
              : ext === 'm4s'
                  ? 'video/iso.segment'
                  : 'application/octet-stream';

  if (!rangeHeader) {
    const obj = await bucket.get(key);
    if (!obj) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Accept-Ranges', 'bytes');
    if (ext === 'm3u8') headers.set('Cache-Control', 'public, max-age=60');
    else headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (obj.size != null) headers.set('Content-Length', String(obj.size));
    if (obj.httpEtag) headers.set('ETag', obj.httpEtag);

    return new Response(obj.body, { status: 200, headers });
  }

  const sizeProbe = await bucket.head(key);
  if (!sizeProbe) return new Response('Not found', { status: 404 });
  const size = Number(sizeProbe.size);

  const parsed = parseRange(rangeHeader, size);
  if (!parsed) {
    const headers = new Headers();
    headers.set('Content-Range', `bytes */${size}`);
    return new Response('Range Not Satisfiable', { status: 416, headers });
  }

  const { start, end } = parsed;
  const obj = await bucket.get(key, { range: { offset: start, length: end - start + 1 } });
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  if (ext === 'm3u8') headers.set('Cache-Control', 'public, max-age=60');
  else headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);

  return new Response(obj.body, { status: 206, headers });
}

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  const startStr = match[1];
  const endStr = match[2];

  if (startStr === '' && endStr === '') return null;

  let start;
  let end;

  if (startStr === '') {
    const suffixLen = Number(endStr);
    if (!Number.isFinite(suffixLen) || suffixLen <= 0) return null;
    start = Math.max(0, size - suffixLen);
    end = size - 1;
  } else {
    start = Number(startStr);
    if (!Number.isFinite(start) || start < 0) return null;

    if (endStr === '') {
      end = size - 1;
    } else {
      end = Number(endStr);
      if (!Number.isFinite(end) || end < 0) return null;
    }
  }

  if (start >= size) return null;
  if (end >= size) end = size - 1;
  if (end < start) return null;

  return { start, end };
}

