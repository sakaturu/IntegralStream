import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAmd-g8ytfN4AXCaFX_K9J_-blAEoyP_UU",
  authDomain: "integralstream-87a5c.firebaseapp.com",
  projectId: "integralstream-87a5c",
  storageBucket: "integralstream-87a5c.firebasestorage.app",
  messagingSenderId: "206989148445",
  appId: "1:206989148445:web:58069d7bfec108216ea1f4",
  measurementId: "G-BXCJFX7VEQ"
};

// Initialise only once (hot-reload safe)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);

// ─── Collection/doc paths ────────────────────────────────────────────────────
// Matches the Firestore path you already have: /library/main
const VIDEO_REF  = () => doc(db, 'library', 'main');
const MUSIC_REF  = () => doc(db, 'library', 'music');
const REVIEWS_REF = () => doc(db, 'library', 'musicReviews');

// ─── Videos ──────────────────────────────────────────────────────────────────
export async function loadVideosFromFirestore(): Promise<any[] | null> {
  try {
    const snap = await getDoc(VIDEO_REF());
    if (!snap.exists()) return null;
    const data = snap.data();
    return data?.videos ?? null;
  } catch (e) {
    console.warn('[Firestore] loadVideos failed', e);
    return null;
  }
}

export async function saveVideosToFirestore(videos: any[]): Promise<void> {
  try {
    // Strip data-URL thumbnails and large blobs before saving
    const clean = videos.map(v => ({
      ...v,
      thumbnail: v.thumbnail?.startsWith('data:') ? '' : (v.thumbnail || ''),
    }));
    await setDoc(VIDEO_REF(), { videos: clean, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('[Firestore] saveVideos failed', e);
  }
}

export function subscribeToVideos(callback: (videos: any[]) => void): Unsubscribe {
  return onSnapshot(VIDEO_REF(), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data?.videos) callback(data.videos);
  }, (err) => console.warn('[Firestore] videos snapshot error', err));
}

// ─── Music tracks ─────────────────────────────────────────────────────────────
export async function loadMusicFromFirestore(): Promise<any[] | null> {
  try {
    const snap = await getDoc(MUSIC_REF());
    if (!snap.exists()) return null;
    const data = snap.data();
    return data?.tracks ?? null;
  } catch (e) {
    console.warn('[Firestore] loadMusic failed', e);
    return null;
  }
}

export async function saveMusicToFirestore(tracks: any[]): Promise<void> {
  try {
    const clean = tracks.map(t => ({
      ...t,
      thumbnail: t.thumbnail?.startsWith('data:') ? '' : (t.thumbnail || ''),
    }));
    await setDoc(MUSIC_REF(), { tracks: clean, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('[Firestore] saveMusic failed', e);
  }
}

export function subscribeToMusic(callback: (tracks: any[]) => void): Unsubscribe {
  return onSnapshot(MUSIC_REF(), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data?.tracks) callback(data.tracks);
  }, (err) => console.warn('[Firestore] music snapshot error', err));
}

// ─── Music reviews ────────────────────────────────────────────────────────────
export async function loadMusicReviewsFromFirestore(): Promise<any[] | null> {
  try {
    const snap = await getDoc(REVIEWS_REF());
    if (!snap.exists()) return null;
    const data = snap.data();
    return data?.reviews ?? null;
  } catch (e) {
    console.warn('[Firestore] loadReviews failed', e);
    return null;
  }
}

export async function saveMusicReviewsToFirestore(reviews: any[]): Promise<void> {
  try {
    await setDoc(REVIEWS_REF(), { reviews, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('[Firestore] saveReviews failed', e);
  }
}

// ─── Music genres ─────────────────────────────────────────────────────────────
const GENRES_REF = () => doc(db, 'library', 'musicGenres');

export async function loadGenresFromFirestore(): Promise<string[] | null> {
  try {
    const snap = await getDoc(GENRES_REF());
    if (!snap.exists()) return null;
    const data = snap.data();
    return data?.genres ?? null;
  } catch (e) {
    console.warn('[Firestore] loadGenres failed', e);
    return null;
  }
}

export async function saveGenresToFirestore(genres: string[]): Promise<void> {
  try {
    await setDoc(GENRES_REF(), { genres, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('[Firestore] saveGenres failed', e);
  }
}

export async function loadDeletedGenresFromFirestore(): Promise<string[] | null> {
  try {
    const snap = await getDoc(GENRES_REF());
    if (!snap.exists()) return null;
    const data = snap.data();
    return data?.deletedGenres ?? null;
  } catch (e) {
    console.warn('[Firestore] loadDeletedGenres failed', e);
    return null;
  }
}

export async function saveDeletedGenresToFirestore(deleted: string[]): Promise<void> {
  try {
    await setDoc(GENRES_REF(), { deletedGenres: deleted, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('[Firestore] saveDeletedGenres failed', e);
  }
}
