import React, { useEffect, useState } from 'react';

interface AnimatedGift {
  id: number;
  emoji: string;
  name: string;
  senderName: string;
  animation: string;
}

interface GiftAnimationProps {
  trigger: AnimatedGift | null;
}

const GiftAnimation: React.FC<GiftAnimationProps> = ({ trigger }) => {
  const [gifts, setGifts] = useState<AnimatedGift[]>([]);

  useEffect(() => {
    if (trigger) {
      setGifts(prev => [...prev, trigger]);
      setTimeout(() => {
        setGifts(prev => prev.filter(g => g.id !== trigger.id));
      }, 3000);
    }
  }, [trigger]);

  return (
    <div className="absolute left-4 bottom-72 z-20 pointer-events-none space-y-2">
      {gifts.map(gift => (
        <div
          key={gift.id}
          className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 animate-fade-in"
        >
          <span className={`text-3xl ${
            gift.animation === 'bounce' ? 'animate-bounce' :
            gift.animation === 'spin' ? 'animate-spin' :
            gift.animation === 'pulse' ? 'animate-pulse' :
            'animate-bounce'
          }`}>
            {gift.emoji}
          </span>
          <div>
            <p className="text-white text-xs font-semibold">@{gift.senderName}</p>
            <p className="text-pink-400 text-[10px]">sent {gift.name}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GiftAnimation;
