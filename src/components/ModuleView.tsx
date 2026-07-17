import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../store';

const SCORE_LABELS: Record<number, string> = { 1: 'Needs Work', 2: 'Fair', 3: 'Good', 4: 'Excellent' };

const getYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  return match ? match[1] : null;
};

const isDirectVideoFile = (url: string): boolean => /\.(mp4|webm|ogg)(\?|$)/i.test(url);

// Embeds the actual YouTube player (instead of a thumbnail link out to
// youtube.com) so we can listen for real playback completion via the
// IFrame Player API, and call onEnded - the signal the homework deadline
// is anchored to. Loads the API script once and reuses it across mounts.
const YouTubePlayer: React.FC<{ videoId: string; onEnded: () => void }> = ({ videoId, onEnded }) => {
  const containerId = useRef(`yt-player-${Math.random().toString(36).slice(2)}`).current;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    let player: any;
    let cancelled = false;
    const w = window as any;

    const createPlayer = () => {
      if (cancelled) return;
      player = new w.YT.Player(containerId, {
        videoId,
        events: {
          onStateChange: (event: any) => {
            if (event.data === w.YT.PlayerState.ENDED) onEndedRef.current();
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
      player?.destroy?.();
    };
  }, [videoId, containerId]);

  return <div id={containerId} className="w-full h-full" />;
};

export const ModuleView: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const { modules, currentUser, submissions, moduleVideos, grades, videoProgress, submitHomework, deleteSubmission, markVideoWatched } = useAppContext();
  const [linkInput, setLinkInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const mod = modules.find(m => m.id === moduleId);
  const sub = submissions.find(s => s.moduleId === moduleId && s.userId === currentUser?.id);
  const video = moduleVideos.find(v => v.moduleId === moduleId);
  const grade = sub ? grades.find(g => g.submissionId === sub.id) : null;

  if (!mod) return <div className="p-10">Module not found</div>;

  const handleSubmit = () => {
    if (linkInput.trim()) {
      submitHomework(moduleId, linkInput);
      setLinkInput('');
    }
  };

  const confirmDelete = () => {
    deleteSubmission(moduleId);
    setShowDeleteConfirm(false);
  };

  const completedCount = submissions.filter(s => s.userId === currentUser?.id && s.status === 'graded').length;
  const progressPercent = Math.round((completedCount / modules.length) * 100);
  const hasPlayableVideo = !!video && video.url !== '#';
  const youtubeId = video ? getYouTubeId(video.url) : null;
  const isDirectVideo = video ? isDirectVideoFile(video.url) : false;

  // Deadline is 7 days after the designer actually finishes this module's
  // video (not just opens it) - watched to the end via the embedded player
  // below, which reports completion through markVideoWatched. A module with
  // no video to watch, or one the designer hasn't finished yet, has no
  // deadline rather than a guessed one.
  const watched = videoProgress.find(v => v.moduleId === moduleId && v.userId === currentUser?.id);
  const deadline = watched ? new Date(new Date(watched.watchedAt).getTime() + 7 * 24 * 60 * 60 * 1000) : null;

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-[#F5FAFF]">
      {/* Top Navbar */}
      <header className="h-20 bg-white border-b-[3px] border-black flex items-center justify-between px-10 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-black text-black">Module {mod.label || mod.order.toString().padStart(2, '0')}: {mod.title}</h2>
          <p className="text-xs text-gray-500 font-bold flex items-center gap-2 mt-1">
            Status:{' '}
            <span className={`px-3 py-1 rounded-full border-2 border-black text-[10px] font-black uppercase tracking-wider ${
              sub?.status === 'graded' ? 'bg-[#3DDC97]/30 text-[#2A8F62]' :
              sub?.status === 'submitted' ? 'bg-[#2E9DF7]/20 text-[#1E40AF]' :
              sub?.status === 'in_progress' ? 'bg-[#F4511E]/20 text-[#C53914]' :
              'bg-gray-100 text-gray-500'
            }`}>
              {sub ? sub.status.replace('_', ' ') : 'Not Started'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-black text-gray-400">Your Pod</span>
            <span className="text-sm font-bold">{currentUser?.pod || 'Unassigned'}</span>
          </div>
        </div>
      </header>

      {/* Page Layout */}
      <div className="flex-1 p-10 flex gap-8 overflow-y-auto">
        {/* Content Section */}
        <div className="flex-1 space-y-6">
          {hasPlayableVideo ? (
            <div className="aspect-video bg-[#2D2D2D] rounded-2xl border-[3px] border-black relative overflow-hidden">
              {youtubeId ? (
                <YouTubePlayer videoId={youtubeId} onEnded={() => markVideoWatched(moduleId)} />
              ) : isDirectVideo ? (
                <video
                  src={video!.url}
                  controls
                  className="w-full h-full"
                  onEnded={() => markVideoWatched(moduleId)}
                />
              ) : (
                <a
                  href={video!.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group absolute inset-0 flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
                  <div className="w-20 h-20 bg-[#2E9DF7] border-[3px] border-black rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                  <div className="absolute bottom-6 left-8 text-white pointer-events-none">
                    <p className="text-xs font-black uppercase tracking-wider opacity-80">Video Tutorial</p>
                    <h3 className="text-lg font-bold">{video!.title}</h3>
                  </div>
                </a>
              )}
            </div>
          ) : (
            <div className="aspect-video bg-gray-100 rounded-2xl border-2 border-dashed border-black relative overflow-hidden flex items-center justify-center">
               <p className="text-gray-400 font-bold">Video coming soon</p>
            </div>
          )}

          {/* Module Description */}
          <div className="bg-white rounded-2xl p-8 border-[3px] border-black">
            <h4 className="text-sm font-black uppercase text-black mb-3 tracking-widest">About this Module</h4>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap mb-6">
              {mod.textContent}
            </p>

            {(mod.objectives || mod.outcomes) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t-2 border-black/10">
                {mod.objectives && mod.objectives.length > 0 && (
                  <div>
                    <h4 className="text-xs font-black text-gray-500 uppercase mb-3 tracking-widest">Objectives</h4>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                      {mod.objectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {mod.outcomes && mod.outcomes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-black text-gray-500 uppercase mb-3 tracking-widest">Outcomes</h4>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                      {mod.outcomes.map((out, i) => (
                        <li key={i}>{out}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Additional Materials */}
          {mod.additionalMaterials && mod.additionalMaterials.length > 0 && (
            <div className="bg-white rounded-2xl p-8 border-[3px] border-black">
              <h4 className="text-sm font-black uppercase text-black mb-4 tracking-widest flex items-center gap-2">
                <span className="text-xl">📚</span> Additional Materials
              </h4>
              <ul className="space-y-3">
                {mod.additionalMaterials.map((material, idx) => (
                  <li key={idx} className="flex items-center justify-between p-4 bg-gray-50 border-2 border-black rounded-xl">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {material.type === 'video' ? '🎥' : material.type === 'book' ? '📖' : '📄'}
                        </span>
                        <span className="text-sm font-bold text-gray-800">{material.title}</span>
                      </div>
                      {material.author && (
                        <span className="text-xs text-gray-500 font-medium ml-7">By {material.author}</span>
                      )}
                    </div>
                    {material.url && (
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-black text-black bg-white border-2 border-black px-3 py-1.5 rounded-full hover:bg-[#2E9DF7] hover:text-white transition-colors"
                      >
                        View Link
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Interaction Panel */}
        <div className="w-80 space-y-6 flex-shrink-0">
          {/* Progress */}
          <div className="bg-white border-[3px] border-black rounded-2xl p-6 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-black rounded-full px-4 py-1.5">
              <span className="text-[10px] font-black text-black tracking-tighter uppercase">Progress</span>
            </div>

            <div className="pt-4 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-black mb-2">
                  <span className="text-gray-500">Course Completion</span>
                  <span className="text-[#2A8F62]">{progressPercent}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 border-2 border-black rounded-full overflow-hidden">
                  <div className="h-full bg-[#3DDC97] rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-black mb-2">
                  <span className="text-gray-500">Grade</span>
                  <span className="text-[#2A8F62]">
                    {grade ? `${grade.score} of 4 — ${SCORE_LABELS[grade.score]}` : 'Not yet graded'}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map(seg => (
                    <div
                      key={seg}
                      className={`flex-1 h-3 rounded-full border-2 border-black ${grade && grade.score >= seg ? 'bg-[#3DDC97]' : 'bg-gray-100'}`}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Homework Materials */}
          {mod.homeworkLink && (
            <div className="bg-[#E0F2FE] border-[3px] border-black rounded-2xl p-6 relative overflow-hidden">
              <h4 className="text-sm font-black mb-3 uppercase text-[#1E40AF] flex items-center gap-2">
                <span className="text-xl">📁</span> Assignment Materials
              </h4>
              <p className="text-[11px] text-[#1E40AF]/80 mb-4 font-medium leading-relaxed">
                {mod.homeworkDescription || 'Download the files needed for this module\'s homework.'}
              </p>
              {deadline && (
                <div className="inline-flex items-center gap-1.5 bg-white border-2 border-black rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#1E40AF] mb-4">
                  <span>⏰</span> Due {deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
              <a
                href={mod.homeworkLink}
                target="_blank"
                rel="noreferrer"
                className="block w-full bg-white text-black text-center font-black uppercase text-xs tracking-wide py-3 rounded-xl border-2 border-black hover:bg-[#2E9DF7] hover:text-white transition-colors"
              >
                Open Google Drive
              </a>
            </div>
          )}

          {/* Submission Card */}
          <div className="bg-white border-[3px] border-black rounded-2xl p-6">
            <h4 className="text-sm font-black text-center mb-4 uppercase text-black">Submit Homework</h4>
            <p className="text-[11px] text-gray-400 text-center mb-6">Paste your Google Drive link with the .WAV bounce of the exercise.</p>

            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="drive.google.com/share/..."
              disabled={sub?.status === 'graded'}
              className="w-full bg-gray-50 border-2 border-black rounded-xl p-4 text-xs mb-4 focus:ring-2 focus:ring-[#2E9DF7] transition-all disabled:opacity-50"
            />

            <button
              onClick={handleSubmit}
              disabled={sub?.status === 'graded' || !linkInput.trim()}
              className="w-full bg-[#F4511E] text-white font-black uppercase text-xs tracking-wide py-4 rounded-xl border-2 border-black hover:bg-black transition-colors disabled:opacity-40 disabled:hover:bg-[#F4511E]"
            >
              {sub?.status === 'graded' ? 'Graded' : sub ? 'Resubmit' : 'Send to Engineer'}
            </button>

            {sub && (
              <div className="mt-6 pt-6 border-t-2 border-dashed border-black/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-2 min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Current Submission</p>
                    <a href={sub.driveLink} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#2E9DF7] truncate hover:underline">
                      {sub.driveLink}
                    </a>
                  </div>
                  {sub.status !== 'graded' && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex-shrink-0 text-[10px] font-black uppercase tracking-wide text-[#B23A2E] bg-white border-2 border-black px-2.5 py-1.5 rounded-full hover:bg-[#B23A2E] hover:text-white transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status Message */}
          {grade && (
             <div className="bg-[#3DDC97]/10 border-2 border-black p-4 rounded-2xl flex flex-col gap-2">
               <div className="flex items-center gap-3">
                 <span className="text-xl">✨</span>
                 <p className="text-[11px] font-bold text-[#2A8F62]">Nice work — This module was graded {grade.score}/4!</p>
               </div>
               {grade.feedback && (
                 <p className="text-xs text-[#2A8F62] italic border-t border-black/10 pt-2 mt-1">"{grade.feedback}"</p>
               )}
             </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white border-[3px] border-black rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-black uppercase text-black mb-2">Delete Submission?</h3>
            <p className="text-sm text-gray-600 mb-6">This cannot be undone. You'll need to submit a new link to send this module to your engineer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-white text-black font-black uppercase text-xs tracking-wide py-3 rounded-xl border-2 border-black hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-[#B23A2E] text-white font-black uppercase text-xs tracking-wide py-3 rounded-xl border-2 border-black hover:bg-black transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
