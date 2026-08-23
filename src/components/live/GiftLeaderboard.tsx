import React from 'react';
import { Trophy, Coins } from 'lucide-react';

interface LeaderboardEntry {
  username: string;
  avatarUrl?: string;
  totalCoins: number;
}

interface GiftLeaderboardProps {
  entries: LeaderboardEntry[];
}

const MEDAL_COLORS = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];

const GiftLeaderboard: React.FC<GiftLeaderboardProps> = ({ entries }) => {
  if (entries.length === 0) return null;

  const top3 = entries.slice(0, 3);

  return (
    <div className="flex items-center gap-1.5 overflow-hidden">
      {top3.map((entry, i) => (
        <div
          key={entry.username}
          className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5"
        >
          <Trophy className={`w-3 h-3 ${MEDAL_COLORS[i]}`} />
          <span className="text-white text-[10px] truncate max-w-[50px]">@{entry.username}</span>
          <div className="flex items-center gap-0.5">
            <Coins className="w-2.5 h-2.5 text-yellow-400" />
            <span className="text-yellow-400 text-[10px]">{entry.totalCoins}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GiftLeaderboard;
