import { useEffect, useState } from 'react';
import { ContentBlock, Module, ModuleVideo } from './types';
import { clipSeconds, youTubeId } from './videoClip';

// Runs cb once the YouTube IFrame API is loaded (loads it the first time).
export const withYouTubeApi = (cb: () => void) => {
  const w = window as any;
  if (w.YT && w.YT.Player) return cb();
  if (!document.getElementById('youtube-iframe-api')) {
    const script = document.createElement('script');
    script.id = 'youtube-iframe-api';
    script.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(script);
  }
  const previous = w.onYouTubeIframeAPIReady;
  w.onYouTubeIframeAPIReady = () => {
    previous?.();
    cb();
  };
};

// A YouTube video's full length in seconds (null if it can't be read), read
// from an off-screen player - no API key needed. Lengths don't change, so
// they're kept in localStorage.
// ponytail: one player at a time, so a first visit with many videos fills in
// over a few seconds each; probe a few in parallel if that gets slow.
const KEY = 'yt-length:';
const probes = new Map<string, Promise<number | null>>();
let queue: Promise<unknown> = Promise.resolve();

const probe = (videoId: string) => new Promise<number | null>(resolve => withYouTubeApi(() => {
  const w = window as any;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:320px;height:180px;';
  const target = document.createElement('div');
  box.appendChild(target);
  document.body.appendChild(box);
  let player: any;
  let poll: ReturnType<typeof setInterval> | undefined;
  const done = (sec: number | null) => {
    clearInterval(poll);
    clearTimeout(timeout);
    try { player?.destroy?.(); } catch { /* half-initialised player */ }
    box.remove();
    resolve(sec);
  };
  const timeout = setTimeout(() => done(null), 15000);
  player = new w.YT.Player(target, {
    videoId,
    events: {
      // The length can read 0 for a moment after onReady.
      onReady: () => { poll = setInterval(() => { const d = player.getDuration?.(); if (d > 0) done(d); }, 200); },
      onError: () => done(null),
    },
  });
}));

export const youTubeLength = (videoId: string): Promise<number | null> => {
  try {
    const saved = localStorage.getItem(KEY + videoId);
    if (saved) return Promise.resolve(Number(saved));
  } catch { /* storage blocked */ }
  if (!probes.has(videoId)) {
    const p = queue.then(() => probe(videoId)).then(sec => {
      if (sec) try { localStorage.setItem(KEY + videoId, String(Math.round(sec))); } catch { /* storage blocked */ }
      return sec;
    });
    queue = p;
    probes.set(videoId, p);
  }
  return probes.get(videoId)!;
};

// A lesson's videos: its module video plus any video blocks.
const lessonVideos = (mod: Module, moduleVideos: ModuleVideo[]) => [
  ...moduleVideos.filter(v => v.moduleId === mod.id),
  ...(mod.contentBlocks ?? []).filter((b): b is Extract<ContentBlock, { type: 'video' }> => b.type === 'video' && !!b.url),
];

export interface LessonLength { sec: number; videos: number; unknown: number }

// Watch time per lesson id. `unknown` counts videos whose length isn't known
// (still loading, not YouTube, or unreadable).
export const useLessonLengths = (modules: Module[], moduleVideos: ModuleVideo[]): Record<string, LessonLength> => {
  const [lengths, setLengths] = useState<Record<string, number | null>>({});
  const ids = [...new Set(modules.flatMap(m => lessonVideos(m, moduleVideos)).flatMap(v => {
    const id = youTubeId(v.url);
    return id && v.end === undefined ? [id] : [];
  }))];
  useEffect(() => {
    let live = true;
    ids.forEach(id => youTubeLength(id).then(sec => { if (live) setLengths(l => (id in l ? l : { ...l, [id]: sec })); }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')]);
  return Object.fromEntries(modules.map(m => {
    const vids = lessonVideos(m, moduleVideos);
    const secs = vids.map(v => { const id = youTubeId(v.url); return id ? clipSeconds(lengths[id] ?? undefined, v.start, v.end) : undefined; });
    return [m.id, { sec: secs.reduce<number>((t, s) => t + (s ?? 0), 0), videos: vids.length, unknown: secs.filter(s => s === undefined).length }];
  }));
};
