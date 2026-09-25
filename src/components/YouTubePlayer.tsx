import React, { useEffect, useRef } from 'react';
import { clipAction } from '../videoClip';

// Embeds the actual YouTube player (instead of a thumbnail link out to
// youtube.com) so we can listen for real playback completion via the
// IFrame Player API, and call onEnded - the signal the homework deadline
// is anchored to. Loads the API script once and reuses it across mounts.
//
// YT.Player REPLACES the element it's handed with an <iframe>, pulling that
// node out of the document. It must never be given a React-rendered element:
// React would later try to remove a node that's no longer in the DOM and
// throw NotFoundError mid-commit, blanking the whole app (the "blank page
// when switching modules" bug). So React owns only the outer host div, and
// the player gets a throwaway inner div created imperatively here.
//
// Clips: with start/end set, the player starts at `start`, and a watcher
// stops it at `end` - even if the trainee drags past it - rewinds to the
// clip start, and reports it as finished. Dragging before `start` jumps
// back to the start. (YouTube's own end parameter alone can be skipped.)
export const YouTubePlayer: React.FC<{ videoId: string; onEnded?: () => void; start?: number; end?: number }> = ({ videoId, onEnded, start, end }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let player: any;
    let cancelled = false;
    let watch: ReturnType<typeof setInterval> | undefined;
    const w = window as any;
    const from = start ?? 0;

    const target = document.createElement('div');
    host.appendChild(target);

    // Stop at the clip end and rewind, so pressing play again replays the clip.
    const finish = () => {
      player.pauseVideo();
      player.seekTo(from, true);
      onEndedRef.current?.();
    };

    const createPlayer = () => {
      if (cancelled) return;
      player = new w.YT.Player(target, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, ...(start ? { start } : {}), ...(end ? { end } : {}) },
        events: {
          onStateChange: (event: any) => {
            if (event.data === w.YT.PlayerState.ENDED) {
              if (end !== undefined) finish(); else onEndedRef.current?.();
            }
          },
          onReady: () => {
            if (start === undefined && end === undefined) return;
            watch = setInterval(() => {
              if (player?.getPlayerState?.() !== w.YT.PlayerState.PLAYING) return;
              const action = clipAction(player.getCurrentTime(), start, end);
              if (action === 'finish') finish();
              else if (action === 'toStart') player.seekTo(from, true);
            }, 250);
          },
        },
      });
    };

    if (w.YT && w.YT.Player) {
      createPlayer();
    } else {
      if (!document.getElementById('youtube-iframe-api')) {
        const script = document.createElement('script');
        script.id = 'youtube-iframe-api';
        script.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(script);
      }
      const previous = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        previous?.();
        createPlayer();
      };
    }

    return () => {
      cancelled = true;
      clearInterval(watch);
      try {
        player?.destroy?.();
      } catch {
        // A player mid-initialization can throw on destroy; the host wipe
        // below cleans up whatever it left behind either way.
      }
      // Remove whatever YT left in the host (iframe or restored div) so
      // React never sees children it didn't render.
      host.textContent = '';
    };
  }, [videoId, start, end]);

  return <div ref={hostRef} className="w-full h-full" />;
};
