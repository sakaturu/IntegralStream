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
export const saveUserData = async (username: string, data: Record<string, any>) => {
  try {
    await setDoc(doc(db, 'users', username), { ...data, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Firebase saveUserData error:', e);
  }
};

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
export const saveLibrary = async (data: Record<string, any>) => {
  try {
    // Never save empty video arrays - safety guard
    if (!data.videos || data.videos.length === 0) {
      console.warn('saveLibrary blocked: refusing to save empty video array');
      return;
    }
    await setDoc(doc(db, 'library', 'main'), { ...data, updatedAt: Date.now() });
    // Also save backup every time (with timestamp)
    await setDoc(doc(db, 'library', 'backup'), { ...data, backedUpAt: Date.now() });
  } catch (e) {
    console.error('Firebase saveLibrary error:', e);
  }
};

export const loadLibrary = async (): Promise<Record<string, any> | null> => {
  try {
    const snap = await getDoc(doc(db, 'library', 'main'));
    if (snap.exists() && snap.data().videos?.length > 0) return snap.data();
    // If main is empty, try backup
    console.warn('Main library empty, trying backup...');
    const backup = await getDoc(doc(db, 'library', 'backup'));
    return backup.exists() ? backup.data() : null;
  } catch (e) {
    console.error('Firebase loadLibrary error:', e);
    return null;
  }
};

export const subscribeToLibrary = (callback: (data: Record<string, any>) => void) => {
  return onSnapshot(doc(db, 'library', 'main'), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
};
