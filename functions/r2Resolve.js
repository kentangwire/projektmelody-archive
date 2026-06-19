const PREFIX_BINDINGS = [
  { prefix: 'my-videos/', binding: 'R2_MY_VIDEOS' },
  { prefix: 'recent-vods/', binding: 'R2_RECENT_VODS' },
  { prefix: '20-vods/', binding: 'R2_20_VODS' },
];

export function r2LookupPlans(urlKey) {
  const plans = [];

  for (const { prefix, binding } of PREFIX_BINDINGS) {
    if (!urlKey.startsWith(prefix)) continue;
    const stripped = urlKey.slice(prefix.length);
    plans.push({ binding, key: stripped });
    plans.push({ binding, key: urlKey });
    plans.push({ binding: 'R2_VIDEOS', key: stripped });
  }

  plans.push({ binding: 'R2_VIDEOS', key: urlKey });

  const seen = new Set();
  return plans.filter((p) => {
    const id = `${p.binding}:${p.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function r2Get(env, urlKey, options = {}) {
  for (const plan of r2LookupPlans(urlKey)) {
    const bucket = env[plan.binding];
    if (!bucket) continue;
    const obj = options.range
      ? await bucket.get(plan.key, { range: options.range })
      : await bucket.get(plan.key);
    if (obj) return { obj, plan };
  }
  return null;
}

export async function r2Head(env, urlKey) {
  for (const plan of r2LookupPlans(urlKey)) {
    const bucket = env[plan.binding];
    if (!bucket) continue;
    const obj = await bucket.head(plan.key);
    if (obj) return { obj, plan };
  }
  return null;
}
