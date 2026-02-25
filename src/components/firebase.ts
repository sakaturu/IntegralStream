import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAmd-g8ytfN4AXCaFX_K9J_-blAEoyP_UU",
  authDomain: "integralstream-87a5c.firebaseapp.com",
  projectId: "integralstream-87a5c",
  storageBucket: "integralstream-87a5c.firebasestorage.app",
  messagingSenderId: "206989148445",
  appId: "1:206989148445:web:58069d7bfec108216ea1f4",
  measurementId: "G-BXCJFX7VEQ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ── USER DATA ──────────────────────────────────────────────
// Saves a user's full profile to Firestore under users/{username}
export const saveUserData = async (username: string, data: Record<string, any>) => {
  try {
    await setDoc(doc(db, 'users', username), { ...data, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Firebase saveUserData error:', e);
  }
};

// Loads a user's profile from Firestore
export const loadUserData = async (username: string): Promise<Record<string, any> | null> => {
  try {
    const snap = await getDoc(doc(db, 'users', username));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error('Firebase loadUserData error:', e);
    return null;
  }
};

// ── GLOBAL LIBRARY ─────────────────────────────────────────
// Saves the shared video library + categories to Firestore
export const saveLibrary = async (data: Record<string, any>) => {
  try {
    await setDoc(doc(db, 'library', 'main'), { ...data, updatedAt: Date.now() });
  } catch (e) {
    console.error('Firebase saveLibrary error:', e);
  }
};

// Loads the shared video library from Firestore
export const loadLibrary = async (): Promise<Record<string, any> | null> => {
  try {
    const snap = await getDoc(doc(db, 'library', 'main'));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error('Firebase loadLibrary error:', e);
    return null;
  }
};

// Listen for real-time library changes (so all users see updates live)
export const subscribeToLibrary = (callback: (data: Record<string, any>) => void) => {
  return onSnapshot(doc(db, 'library', 'main'), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
};
