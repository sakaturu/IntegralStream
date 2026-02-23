export type VideoCategory = string;

export interface Review {
  id: string;
  rating: number;
  text: string;
  user: string;
  timestamp: number;
  isApproved: boolean;
}

export interface VideoItem {
  id: string;
  prompt: string;
  category: VideoCategory;
  url: string; // YouTube Video ID or Veo URL
  thumbnail?: string;
  timestamp: number;
  status: 'ready' | 'generating' | 'error';
  progress?: string;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  rating: number; // 0 to 5
  isFavorite: boolean;
  isLiked: boolean;
  isDisliked: boolean; // Track dislike state
  reviews?: Review[];
}

export type AspectRatio = '16:9' | '9:16';
export type Resolution = '720p' | '1080p';

export interface GenerationConfig {
  prompt: string;
  category: VideoCategory;
  aspectRatio: AspectRatio;
  resolution: Resolution;
}