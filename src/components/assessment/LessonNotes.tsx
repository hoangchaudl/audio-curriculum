import React, { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { card, input, saveWith, sectionTitle } from './ui';

// The trainee's private notes on a lesson (only they can read them - see
// lessonNotes in firestore.rules). Saved when the box loses focus.
export const LessonNotes: React.FC<{ moduleId: string; userId: string }> = ({ moduleId, userId }) => {
  const ref = doc(db, 'lessonNotes', `${moduleId}_${userId}`);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    getDoc(ref).then(s => {
      if (!live) return;
      const t = (s.data()?.text as string) ?? '';
      setText(t); setSaved(t); setLoaded(true);
    }).catch(e => { console.error('Error loading lesson notes', e); if (live) setLoaded(true); });
    return () => { live = false; };
  }, [moduleId, userId]);

  const save = async () => {
    if (!loaded || text === saved) return;
    if (await saveWith(setDoc(ref, { moduleId, userId, text, updatedAt: serverTimestamp() }))) setSaved(text);
  };

  return (
    <section className={`${card} md:!p-6`}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className={sectionTitle}>My notes</h3>
        <span className="text-[11px] font-bold text-gray-400">{text !== saved ? 'Unsaved' : 'Only you can see these'}</span>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={save}
        disabled={!loaded}
        maxLength={20000}
        rows={6}
        placeholder="Jot down anything you want to remember from this lesson…"
        aria-label="My notes for this lesson"
        className={`${input} resize-y`}
      />
    </section>
  );
};
