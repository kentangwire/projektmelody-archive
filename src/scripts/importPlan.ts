export type SourceVideo = {
  id: string;
  title: string;
  date?: string;
  tags?: string[];
  hlsSrc?: string;
};

export type ImportVideo = {
  id: string;
  title: string;
  description: string;
  hlsMasterUrl: string;
  createdAtIso: string;
  tagNames: string[];
};

export type ImportPlan = {
  tagNames: string[];
  videos: ImportVideo[];
};

export type BuildImportPlanOptions = {
  pagesOrigin: string;
};

function toIsoMidnight(date: string | undefined): string {
  const d = String(date || '').trim();
  if (!d) return new Date(0).toISOString();
  return new Date(`${d}T00:00:00.000Z`).toISOString();
}

function joinUrl(origin: string, path: string): string {
  const o = origin.replace(/\/+$/, '');
  const p = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${o}${p}`;
}

export function buildImportPlan(source: SourceVideo[], opts: BuildImportPlanOptions): ImportPlan {
  const pagesOrigin = String(opts.pagesOrigin || '').trim();
  const origin = pagesOrigin.replace(/\/+$/, '');

  const tagSet = new Set<string>();
  const videos: ImportVideo[] = [];

  for (const raw of source) {
    const id = String(raw?.id || '').trim();
    if (!id) continue;
    const title = String(raw?.title || '').trim();
    const tagNames = Array.from(new Set((raw?.tags || []).map(t => String(t || '').trim()).filter(Boolean)));
    tagNames.forEach(t => tagSet.add(t));
    const hlsSrc = String(raw?.hlsSrc || '').trim();
    const hlsMasterUrl = hlsSrc ? joinUrl(origin, hlsSrc) : '';

    videos.push({
      id,
      title,
      description: '',
      hlsMasterUrl,
      createdAtIso: toIsoMidnight(raw?.date),
      tagNames
    });
  }

  return { tagNames: Array.from(tagSet), videos };
}

