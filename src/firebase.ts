import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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
