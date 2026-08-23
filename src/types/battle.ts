export type BattleStatus = 'open' | 'completed' | 'cancelled';
export type BattleSide = 'challenger' | 'opponent';

export interface BattleProfile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified?: boolean | null;
}

export interface Battle {
  id: string;
  title: string;
  prompt: string | null;
  challenger_id: string;
  opponent_id: string | null;
  challenger_reel_id: string | null;
  opponent_reel_id: string | null;
  challenger_video_url: string | null;
  opponent_video_url: string | null;
  challenger_thumbnail_url: string | null;
  opponent_thumbnail_url: string | null;
  challenger_caption: string | null;
  opponent_caption: string | null;
  status: BattleStatus;
  challenger_votes: number;
  opponent_votes: number;
  winner_id: string | null;
  winner_side: BattleSide | null;
  bonus_coins: number;
  starts_at: string;
  ends_at: string;
  results_recorded_at: string | null;
  created_at: string;
  updated_at: string;
  challenger?: BattleProfile | null;
  opponent?: BattleProfile | null;
}

export interface BattleVote {
  id: string;
  battle_id: string;
  voter_id: string;
  voted_for_user_id: string;
  voted_side: BattleSide;
  created_at: string;
}
