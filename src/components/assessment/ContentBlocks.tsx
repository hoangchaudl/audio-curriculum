import React from 'react';
import { ContentBlock } from '../../types';
import { Md, card, dateFor, formatDate, sectionTitle } from './ui';

const youTubeId = (url: string) => url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/)?.[1] ?? null;

// Renders admin-authored module/stage content. Every block is optional -
// a module with no video (or no blocks at all) simply renders less.
export const ContentBlocks: React.FC<{ blocks?: ContentBlock[]; startDate?: string }> = ({ blocks, startDate }) => {
  if (!blocks?.length) return null;
  return (
    <div className="space-y-6">
      {blocks.map(block => {
        switch (block.type) {
          case 'richText':
            return <div key={block.id} className={card}><Md>{block.markdown}</Md></div>;
          case 'expectation':
            return (
              <div key={block.id} className="bg-sky rounded-[32px] p-6 border-2 border-surface flex gap-3">
                <span className="text-xl" aria-hidden="true">🎯</span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-navy mb-1">Progress expectation</p>
                  <p className="text-sm text-navy font-medium">{block.text}</p>
                </div>
              </div>
            );
          case 'milestone': {
            const due = formatDate(dateFor(startDate, block.week, block.day));
            return (
              <div key={block.id} className={`${card} flex gap-4 items-start`}>
                <div className="bg-[#F4511E]/15 text-ember rounded-2xl px-3 py-2 text-center flex-shrink-0">
                  <p className="text-[10px] font-black uppercase">Week {block.week}{block.day ? ` · Day ${block.day}` : ''}</p>
                  {due && <p className="text-xs font-bold">{due}</p>}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Milestone</p>
                  <p className="font-bold text-gray-800">{block.title}</p>
                  {block.description && <div className="mt-1"><Md>{block.description}</Md></div>}
                </div>
              </div>
            );
          }
          case 'schedule':
            return (
              <div key={block.id} className={card}>
                <h4 className={`${sectionTitle} mb-4`}>{block.title || 'Schedule'}</h4>
                <ul className="divide-y divide-gray-100">
                  {block.items.map((item, i) => {
                    const when = formatDate(dateFor(startDate, item.week, item.day));
                    return (
                      <li key={i} className="py-2.5 flex items-start gap-3 text-sm">
                        <span className="w-28 flex-shrink-0 text-[11px] font-black uppercase text-gray-500">
                          Wk {item.week}{item.day ? ` · D${item.day}` : ''}
                          {when && <span className="block normal-case font-bold text-gray-400">{when}</span>}
                        </span>
                        <span className="flex-1 text-gray-700 font-medium">{item.task}</span>
                        {item.hours ? <span className="text-xs font-bold text-gray-400 whitespace-nowrap">{item.hours} h</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          case 'video': {
            const yt = youTubeId(block.url);
            return (
              <div key={block.id} className="space-y-2">
                {yt ? (
                  <div className="aspect-video rounded-[32px] overflow-hidden shadow-xl bg-black">
                    <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${yt}`} title={block.title || 'Video'}
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                ) : (
                  <a href={block.url} target="_blank" rel="noreferrer" className={`${card} flex items-center gap-3 hover:shadow-md transition-shadow`}>
                    <span className="text-2xl" aria-hidden="true">🎬</span>
                    <span className="font-bold text-[#2E9DF7] underline">{block.title || block.url}</span>
                  </a>
                )}
                {block.title && yt && <p className="text-xs font-bold text-gray-500 px-2">{block.title}</p>}
              </div>
            );
          }
        }
      })}
    </div>
  );
};
