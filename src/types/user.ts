export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio?: string;
  verified?: boolean;
  stats: {
    following: number;
    followers: number;
    reels: number;
  };
  isFollowing?: boolean;
}

export interface UserStats {
  following: number;
  followers: number;
  reels: number;
  tutorials: number;
  savedTags: number;
}
