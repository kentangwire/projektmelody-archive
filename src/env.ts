export type Env = {
  corsOrigins: string[];
};

export function getEnv(): Env {
  const cors = process.env.CORS_ORIGINS || '';
  const corsOrigins = cors
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return { corsOrigins };
}
