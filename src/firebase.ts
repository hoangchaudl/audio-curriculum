import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Note: Firebase web config (including apiKey) is NOT a secret - it's safe to
// ship in client code by design. The actual security boundary is (a) Firebase
// Auth requiring real credentials to sign in, and (b) firestore.rules
// restricting what a signed-in user can read/write. Both of those are now
// enforced - see store.tsx and firestore.rules.
const firebaseConfig = {
  apiKey: "AIzaSyAZNatSB8AaZvBPk8E8QyKhnf32KzxgbIU",
  authDomain: "gen-lang-client-0559782052.firebaseapp.com",
  projectId: "gen-lang-client-0559782052",
  storageBucket: "gen-lang-client-0559782052.firebasestorage.app",
  messagingSenderId: "174937594009",
  appId: "1:174937594009:web:7f577c12da185f6d6f0008"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-c456c147-46b9-4e54-85ab-b4d0cb0f170c");

// Firebase Auth handles real sign-in (email + password). This requires
// Email/Password sign-in to be enabled once in the Firebase console:
// Firebase Console -> Build -> Authentication -> Sign-in method -> Email/Password -> Enable.
// (Needs project admin/owner access - not something the app can do for you.)
export const auth = getAuth(app);
