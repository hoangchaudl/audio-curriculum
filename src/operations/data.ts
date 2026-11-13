// Operations session, subscriptions and writes. Deliberately independent of
// the Curriculum AppProvider (store.tsx): it shares only the Firebase client
// and auth session, and never starts Curriculum listeners, seeding or
// migrations.
import { useEffect, useState } from 'react';
import { User as FbUser, onAuthStateChanged } from 'firebase/auth';
import {
  DocumentData, Timestamp, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ContentType, OpsAccess, OpsContent, OpsMember, OpsRole, opsAccessFor } from './model';

export interface OpsSession {
  loading: boolean;
  fbUser: FbUser | null;
  email: string; // verified, lowercased; '' if unverified
  name: string;
  theme?: 'light' | 'dark';
  access: OpsAccess;
  // Has a Training Program profile (Operations-only staff don't).
  hasProfile: boolean;
  error: string | null;
  // Re-reads the account after the person clicks the verification link.
  recheckVerification: () => Promise<boolean>;
}

const isoOf = (data: DocumentData): any =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v instanceof Timestamp ? v.toDate().toISOString() : v]));

// Who is signed in and what Operations access they have, kept live: a
// membership change or revocation applies while the page is open.
export const useOpsSession = (): OpsSession => {
  const [fbUser, setFbUser] = useState<FbUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<{ loaded: boolean; exists: boolean; role?: string; name?: string; theme?: 'light' | 'dark' }>({ loaded: false, exists: false });
  const [member, setMember] = useState<{ loaded: boolean; data: OpsMember | null }>({ loaded: false, data: null });
  const [error, setError] = useState<string | null>(null);
  const [, setReloaded] = useState(0);

  useEffect(() => onAuthStateChanged(auth, u => { setFbUser(u); setAuthReady(true); }), []);

  const uid = fbUser?.uid;
  const email = fbUser?.emailVerified && fbUser.email ? fbUser.email.toLowerCase() : '';

  // Own Curriculum profile: existence, admin role and saved theme only.
  useEffect(() => {
    setProfile({ loaded: false, exists: false });
    setError(null);
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid), snap => {
      const d = snap.data();
      setProfile({ loaded: true, exists: snap.exists(), role: d?.role, name: d?.name, theme: d?.theme });
    }, err => {
      console.error('Operations: profile', err);
      setProfile({ loaded: true, exists: false });
      setError('Could not check your account. Check your connection and refresh.');
    });
  }, [uid]);

  useEffect(() => {
    setMember({ loaded: false, data: null });
    if (!uid || !email) { setMember({ loaded: true, data: null }); return; }
    return onSnapshot(doc(db, 'operationsMembers', email), snap => {
      setMember({ loaded: true, data: snap.exists() ? ({ id: snap.id, ...isoOf(snap.data()) } as OpsMember) : null });
    }, err => {
      // Denied = no access; never crash.
      if ((err as { code?: string }).code !== 'permission-denied') {
        console.error('Operations: membership', err);
        setError('Could not check your Operations access. Check your connection and refresh.');
      }
      setMember({ loaded: true, data: null });
    });
  }, [uid, email]);

  // reload() updates emailVerified in place; a fresh ID token carries
  // email_verified to firestore.rules.
  const recheckVerification = async () => {
    const u = auth.currentUser;
    if (!u) return false;
    await u.reload();
    if (u.emailVerified) await u.getIdToken(true);
    setReloaded(n => n + 1);
    return u.emailVerified;
  };

  const loading = !authReady || (!!uid && (!profile.loaded || !member.loaded));
  return {
    loading, fbUser, email, error, recheckVerification,
    name: profile.name || member.data?.name || fbUser?.displayName || fbUser?.email || '',
    theme: profile.theme,
    hasProfile: profile.exists,
    access: uid && !loading ? opsAccessFor(profile.role, member.data) : 'none',
  };
};

// Content the caller may see. Members query only published documents, so
// the query matches firestore.rules (nothing restricted is downloaded);
// editors and admins read drafts and archived items too. Losing access
// (sign-out, revocation, account switch) drops the listener and the data.
export const useOpsContent = (uid: string | undefined, access: OpsAccess) => {
  const [state, setState] = useState<{ items: OpsContent[]; loaded: boolean; error: string | null }>({ items: [], loaded: false, error: null });
  useEffect(() => {
    setState({ items: [], loaded: false, error: null });
    if (!uid || access === 'none') return;
    const col = collection(db, 'operationsContent');
    const q = access === 'member' ? query(col, where('status', '==', 'published')) : col;
    return onSnapshot(q, snap => setState({
      items: snap.docs.map(d => ({ id: d.id, ...isoOf(d.data({ serverTimestamps: 'estimate' })) }) as OpsContent),
      loaded: true, error: null,
    }), err => {
      console.error('Operations: content', err);
      setState({ items: [], loaded: true, error: friendlyError(err) });
    });
  }, [uid, access]);
  return state;
};

export const useOpsMembers = (enabled: boolean) => {
  const [state, setState] = useState<{ items: OpsMember[]; loaded: boolean; error: string | null }>({ items: [], loaded: false, error: null });
  useEffect(() => {
    setState({ items: [], loaded: false, error: null });
    if (!enabled) return;
    return onSnapshot(collection(db, 'operationsMembers'), snap => setState({
      items: snap.docs.map(d => ({ id: d.id, ...isoOf(d.data()) }) as OpsMember).sort((a, b) => a.email.localeCompare(b.email)),
      loaded: true, error: null,
    }), err => setState({ items: [], loaded: true, error: friendlyError(err) }));
  }, [enabled]);
  return state;
};

export const friendlyError = (err: unknown): string => {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return "You don't have permission to do that. Your access may have changed - refresh to check.";
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'Could not reach the server. Check your connection and try again.';
  if (code === 'invalid-argument') return 'Some fields are not valid. Check the form and try again.';
  return 'Something went wrong. Nothing was saved - please try again.';
};

// --- writes: each resolves only once the server accepted it ---

const stamp = (uid: string) => ({ updatedBy: uid, updatedAt: serverTimestamp() });

export const createDraft = async (uid: string, fields: Record<string, unknown>, revisionOf?: string) => {
  const ref = doc(collection(db, 'operationsContent'));
  await setDoc(ref, {
    ...fields, status: 'draft', ...(revisionOf ? { revisionOf } : {}),
    createdBy: uid, createdAt: serverTimestamp(), ...stamp(uid),
  });
  return ref.id;
};

export const saveContent = (uid: string, id: string, fields: Record<string, unknown>) =>
  updateDoc(doc(db, 'operationsContent', id), { ...fields, ...stamp(uid) });

export const setStatus = (uid: string, id: string, status: 'draft' | 'published' | 'archived') =>
  updateDoc(doc(db, 'operationsContent', id), {
    status, ...stamp(uid), ...(status === 'published' ? { publishedBy: uid, publishedAt: serverTimestamp() } : {}),
  });

// Admin: a revision draft replaces its published original in one atomic
// write, keeping the original's id (links stay valid) and authorship.
export const publishRevision = async (uid: string, draft: OpsContent) => {
  const { id, revisionOf, status: _s, createdBy: _cb, createdAt: _ca, updatedAt: _ua, updatedBy: _ub, publishedAt: _pa, publishedBy: _pb, ...fields } = draft;
  const batch = writeBatch(db);
  batch.update(doc(db, 'operationsContent', revisionOf!), {
    ...fields, status: 'published', ...stamp(uid), publishedBy: uid, publishedAt: serverTimestamp(),
  });
  batch.delete(doc(db, 'operationsContent', id));
  await batch.commit();
};

export const deleteContent = (id: string) => deleteDoc(doc(db, 'operationsContent', id));

export const saveMember = (uid: string, m: { email: string; name: string; role: OpsRole; active: boolean }) => {
  const email = m.email.trim().toLowerCase();
  return setDoc(doc(db, 'operationsMembers', email), { email, name: m.name.trim(), role: m.role, active: m.active, ...stamp(uid) });
};

