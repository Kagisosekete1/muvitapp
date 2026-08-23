import React, { useState, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';

interface FloatingHeart {
  id: number;
  x: number;
  color: string;
  size: number;
  duration: number;
}

const HEART_COLORS = [
  '#ec4899', // pink-500
  '#f43f5e', // rose-500
  '#ef4444', // red-500
  '#a855f7', // purple-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
];

interface FloatingHeartsProps {
  trigger: number; // Increment this to trigger a new heart
}

const FloatingHearts: React.FC<FloatingHeartsProps> = ({ trigger }) => {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  const addHeart = useCallback(() => {
    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      x: Math.random() * 60 + 20, // 20-80% from right
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      size: Math.random() * 12 + 16, // 16-28px
      duration: Math.random() * 1 + 2, // 2-3 seconds
    };
    
    setHearts(prev => [...prev, newHeart]);
    
    // Remove heart after animation
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, newHeart.duration * 1000);
  }, []);

  useEffect(() => {
    if (trigger > 0) {
      // Add multiple hearts for more visual impact
      addHeart();
      setTimeout(() => addHeart(), 100);
      setTimeout(() => addHeart(), 200);
    }
  }, [trigger, addHeart]);

  return (
    <div className="absolute right-4 bottom-56 w-20 h-64 pointer-events-none overflow-hidden">
      {hearts.map(heart => (
        <div
          key={heart.id}
          className="absolute animate-float-up"
          style={{
            right: `${heart.x}%`,
            bottom: 0,
            animationDuration: `${heart.duration}s`,
          }}
        >
          <Heart
            className="drop-shadow-lg"
            style={{
              width: heart.size,
              height: heart.size,
              color: heart.color,
              fill: heart.color,
            }}
          />
        </div>
      ))}
      
      <style>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) scale(1) rotate(0deg);
            opacity: 1;
          }
          25% {
            transform: translateY(-60px) scale(1.1) rotate(-10deg);
            opacity: 1;
          }
          50% {
            transform: translateY(-120px) scale(1.2) rotate(10deg);
            opacity: 0.8;
          }
          75% {
            transform: translateY(-180px) scale(1.1) rotate(-5deg);
            opacity: 0.5;
          }
          100% {
            transform: translateY(-240px) scale(0.8) rotate(0deg);
            opacity: 0;
          }
        }
        .animate-float-up {
          animation: float-up ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default FloatingHearts;
