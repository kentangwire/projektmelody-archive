/** Allowed community tags (sync with public/tags.json). */
export const TAG_ALLOWLIST = new Set([
  'VTuber', 'ProjektMelody', 'AI', 'Cyberpunk', 'Anime', 'Hentai', '3D', 'Virtual', 'Android',
  'Lush', 'Lovense', 'Interactive', 'Toy', 'Vibe', 'OhMiBod', 'VR', 'MotionCapture', 'Tease',
  'Cosplay', 'Gamer', 'Nerd', 'Lewd', 'Echi', 'DirtyTalk', 'CamGirl', 'Sub', 'Dom',
  'Feet', 'Thighs', 'BigBoobs', 'Ass', 'Fetish', 'Cum', 'Squirt',
  'LovenseLush', 'ToyControl', 'TipDriven', 'VibeLevel', 'MaxVibe', 'DiceRoll', 'WheelSpin',
  'TokenGoal', 'CumulativeVibe', 'Twerking', 'LewdDancing', 'Ahegao', 'Hypnotic', 'Teasing',
  'Striptease', 'FingerSucking', 'AssClap', 'Bounce', 'Moaning', 'GamerGirl', 'NerdTalk',
  'CuteButLewd', 'WholesomeHentai', 'DegenerateChat', 'Asmr', 'ProjektMelodyClip',
  'MelodyChaturbate', 'VTuberHentai', '3DAvatar', 'CamgirlSimulation', 'VirtualSexDoll'
]);

export function normalizeTag(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/^#+/, '');
  if (!s || s.length > 48) return '';
  if (!/^[A-Za-z0-9&]+$/.test(s)) return '';
  return TAG_ALLOWLIST.has(s) ? s : '';
}

export const MAX_TAGS_PER_USER = 8;
