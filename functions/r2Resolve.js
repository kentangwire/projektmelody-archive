const MY_PREFIX = 'my-videos/';

export function r2LookupPlans(urlKey) {
  const plans = [];
  const stripped = urlKey.startsWith(MY_PREFIX) ? urlKey.slice(MY_PREFIX.length) : null;

  if (stripped) {
    plans.push({ binding: 'R2_MY_VIDEOS', key: stripped });
    plans.push({ binding: 'R2_MY_VIDEOS', key: urlKey });
  }
  plans.push({ binding: 'R2_VIDEOS', key: urlKey });
  if (stripped) plans.push({ binding: 'R2_VIDEOS', key: stripped });

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
