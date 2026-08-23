export type Screen = 'home' | 'discover' | 'create' | 'inbox' | 'profile' | 'video' | 'user-profile';

export interface Reel {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl: string;
    verified?: boolean;
    followers?: number;
  };
  stats: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
  isLiked?: boolean;
  createdAt: string;
  tags?: string[];
  soundTrack?: {
    title: string;
    artist: string;
    coverUrl?: string;
  };
}

export interface Story {
  id: number;
  username: string;
  avatarUrl: string;
  videoUrl: string;
  timestamp?: string;
  isViewed?: boolean;
}