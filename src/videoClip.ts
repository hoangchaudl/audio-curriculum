// Play only part of a YouTube video: admins type start/end as "12:30" (or
// "1:02:03" / "90"), we store whole seconds, and YouTubePlayer plays just
// that range and stops by itself.

export const youTubeId = (url: string) => url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/)?.[1] ?? null;

// What the player should do at playback time t for a clip: stop at (or
// after - e.g. dragged past) the end, jump back if dragged before the start.
export const clipAction = (t: number, start?: number, end?: number): 'finish' | 'toStart' | null => {
  if (end !== undefined && t >= end) return 'finish';
  if (start !== undefined && t < start - 1) return 'toStart';
  return null;
};

// "12:30" -> 750, "1:02:03" -> 3723, "90" -> 90, "" -> undefined.
export const parseClipTime = (text: string): number | undefined => {
  const t = text.trim();
  if (!t) return undefined;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return NaN;
  return t.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
};

// 750 -> "12:30", 3723 -> "1:02:03".
export const formatClipTime = (sec: number | undefined): string => {
  if (sec === undefined) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

export const clipProblem = (start?: number, end?: number): string | null => {
  if (Number.isNaN(start) || Number.isNaN(end)) return 'Use minutes:seconds, e.g. 12:30';
  if (start !== undefined && end !== undefined && end <= start) return 'End must be after start';
  return null;
};

// Only the keys that are set - Firestore rejects `undefined` values.
export const clipFields = (start?: number, end?: number) => ({
  ...(start !== undefined && !Number.isNaN(start) ? { start } : {}),
  ...(end !== undefined && !Number.isNaN(end) ? { end } : {}),
});

// "Watch 12:30 – 18:00 (5 min 30 s)" or null for the whole video.
export const clipLabel = (start?: number, end?: number): string | null => {
  if (start === undefined && end === undefined) return null;
  const from = formatClipTime(start ?? 0);
  if (end === undefined) return `Watch from ${from}`;
  const len = end - (start ?? 0);
  return `Watch ${from} – ${formatClipTime(end)} (${Math.floor(len / 60)} min${len % 60 ? ` ${len % 60} s` : ''})`;
};
