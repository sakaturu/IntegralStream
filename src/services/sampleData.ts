import { VideoItem, VideoCategory, Review } from '../types';

/**
 * LIBRARY_VERSION 4221: Added SHAWN hardcoded favorites.
 */
export const LIBRARY_VERSION = 4221;

/**
 * MASTER_IDENTITY: The hardcoded default user for this build.
 */
export const MASTER_IDENTITY = "NEURAL_NODE_01";

/**
 * HARDCODED_FAVORITES: Default vault items for specific identities.
 * These will persist even after browser cache/data is cleared.
 */
export const HARDCODED_FAVORITES: Record<string, string[]> = {
  "NEURAL_NODE_01": [
    "v-int-001", // Tree of Life
    "v-permia-001", // Dome Architecture
    "v-env-001" // Heal the Earth
  ],
  "SHAWN": [
    "v-int-001", // Tree of Life
    "v-int-005", // Personal Soak Area
    "v-permia-001", // Dome Architecture
    "v-env-001", // Heal the Earth
    "v-span-001" // Meditación Guiada
  ]
};

/**
 * BASE LIBRARY DATA
 * A world-class cinematic playlist.
 */
const INITIAL_VIDEO_DATA: any[] = [
  // Integral Serenity
  {
    "id": "v-int-001",
    "prompt": "Tree of Life - Deep Forest Ritual",
    "category": "Integral Serenity",
    "url": "-WlazEoSDLY",
    "thumbnail": "https://img.youtube.com/vi/-WlazEoSDLY/mqdefault.jpg"
  },
  {
    "id": "v-int-002",
    "prompt": "Zen Garden - Water Flow Harmony",
    "category": "Integral Serenity",
    "url": "pESW6LOmVLU",
    "thumbnail": "https://img.youtube.com/vi/pESW6LOmVLU/mqdefault.jpg"
  },
  {
    "id": "v-int-003",
    "prompt": "Fly Over - Mountain Peaks in Mist",
    "category": "Integral Serenity",
    "url": "GdNF0AXZmKc",
    "thumbnail": "https://img.youtube.com/vi/GdNF0AXZmKc/mqdefault.jpg"
  },
  {
    "id": "v-int-004",
    "prompt": "Ancient Roots - Timelapse Growth",
    "category": "Integral Serenity",
    "url": "r_QUhGDxksI",
    "thumbnail": "https://img.youtube.com/vi/r_QUhGDxksI/mqdefault.jpg"
  },
  {
    "id": "v-int-005",
    "prompt": "Personal Soak Area - Thermal Serenity",
    "category": "Integral Serenity",
    "url": "AcyxEMeBDt0",
    "thumbnail": "https://img.youtube.com/vi/AcyxEMeBDt0/mqdefault.jpg"
  },
  {
    "id": "v-int-010",
    "prompt": "Celestial Meditation - Stars and Void",
    "category": "Integral Serenity",
    "url": "668nreJIm8E",
    "thumbnail": "https://img.youtube.com/vi/668nreJIm8E/mqdefault.jpg"
  },

  // Permia Community
  {
    "id": "v-permia-001",
    "prompt": "Dome Architecture - The Geodesic Vision",
    "category": "Permia Community",
    "url": "CFuwwO9XgQA",
    "thumbnail": "https://img.youtube.com/vi/CFuwwO9XgQA/mqdefault.jpg"
  },
  {
    "id": "v-permia-002",
    "prompt": "Permia Living Framework - Modular Design",
    "category": "Permia Community",
    "url": "0jxDFgNmRPg",
    "thumbnail": "https://img.youtube.com/vi/0jxDFgNmRPg/mqdefault.jpg"
  },
  {
    "id": "v-permia-003",
    "prompt": "Intentional Living - Communal Spaces",
    "category": "Permia Community",
    "url": "BxDtPJgK7WE",
    "thumbnail": "https://img.youtube.com/vi/BxDtPJgK7WE/mqdefault.jpg"
  },
  {
    "id": "v-permia-004",
    "prompt": "Sustainable Cities - Vertical Gardens",
    "category": "Permia Community",
    "url": "e-i5S4AbgpA",
    "thumbnail": "https://img.youtube.com/vi/e-i5S4AbgpA/mqdefault.jpg"
  },
  {
    "id": "v-permia-008",
    "prompt": "Solar Village - Energy Independence",
    "category": "Permia Community",
    "url": "2jBiBvFH5sc",
    "thumbnail": "https://img.youtube.com/vi/2jBiBvFH5sc/mqdefault.jpg"
  },

  // Environment
  {
    "id": "v-env-001",
    "prompt": "Heal the Earth - Cinematic Nature 4K",
    "category": "Environment",
    "url": "_5aA54MD4ho",
    "thumbnail": "https://img.youtube.com/vi/_5aA54MD4ho/mqdefault.jpg"
  },
  {
    "id": "v-env-002",
    "prompt": "Peace on Earth - Global Vistas",
    "category": "Environment",
    "url": "SmruzusGWTk",
    "thumbnail": "https://img.youtube.com/vi/SmruzusGWTk/mqdefault.jpg"
  },
  {
    "id": "v-env-004",
    "prompt": "Amazon Rainforest - The Earth's Lungs",
    "category": "Environment",
    "url": "MqHhPApGM0Q",
    "thumbnail": "https://img.youtube.com/vi/MqHhPApGM0Q/mqdefault.jpg"
  },
  {
    "id": "v-env-005",
    "prompt": "Arctic Silence - Glacial Majesty",
    "category": "Environment",
    "url": "Zp9fA-YidYk",
    "thumbnail": "https://img.youtube.com/vi/Zp9fA-YidYk/mqdefault.jpg"
  },

  // Tribal & Dance
  {
    "id": "v-trib-001",
    "prompt": "Desert Echoes - Ritual Dance",
    "category": "Tribal",
    "url": "j3v8G9k9kI0",
    "thumbnail": "https://img.youtube.com/vi/j3v8G9k9kI0/mqdefault.jpg"
  },
  {
    "id": "v-dance-001",
    "prompt": "Urban Flow - Contemporary Movement",
    "category": "Dance",
    "url": "9yc15Hn06Lw",
    "thumbnail": "https://img.youtube.com/vi/9yc15Hn06Lw/mqdefault.jpg"
  },

  // Spanish
  {
    "id": "v-span-001",
    "prompt": "Meditación Guiada - Naturaleza Viva",
    "category": "Spanish",
    "url": "MqHhPApGM0Q",
    "thumbnail": "https://img.youtube.com/vi/MqHhPApGM0Q/mqdefault.jpg"
  }
];

export const getSampleLibrary = (): VideoItem[] => {
  return INITIAL_VIDEO_DATA.map((item, idx) => ({
    ...item,
    timestamp: Date.now() - (idx * 100000),
    status: 'ready',
    viewCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    rating: 0,
    isFavorite: false, 
    isLiked: false,
    isDisliked: false,
    reviews: []
  }));
};

export const getSurpriseVideo = (): VideoItem => {
  const pool = ['dQw4w9WgXcQ', 'CHSnz0DQw68', '5Wn4M_9-H9I', 'X_JBFLs3vAk', 'LXO-jKksQkM'];
  const id = pool[Math.floor(Math.random() * pool.length)];
  return {
    id: `surprise-${Date.now()}`,
    prompt: "Neural Surprise Signal",
    category: 'Fav. Pick',
    url: id,
    timestamp: Date.now(),
    status: 'ready',
    viewCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    rating: 0,
    isFavorite: false,
    isLiked: false,
    isDisliked: false,
    reviews: []
  };
};