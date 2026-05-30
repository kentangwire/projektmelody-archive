export type Env = {
  corsOrigins: string[];
  exoClickVastUrl: string;
};

export function getEnv(): Env {
  const cors = process.env.CORS_ORIGINS || '';
  const corsOrigins = cors
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const exoClickVastUrl =
    process.env.EXOCLICK_VAST_URL || 'https://s.magsrv.com/v1/vast.php?id=5938356';

  return { corsOrigins, exoClickVastUrl };
}

