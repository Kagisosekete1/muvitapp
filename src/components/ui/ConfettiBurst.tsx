import React, { useState, useEffect, useCallback } from 'react';

interface Confetti {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  size: number;
  velocityX: number;
  velocityY: number;
}

const CONFETTI_COLORS = [
  '#ec4899', // pink
  '#f43f5e', // rose
  '#a855f7', // purple
  '#3b82f6', // blue
  '#22c55e', // green
  '#eab308', // yellow
  '#f97316', // orange
  '#06b6d4', // cyan
];

interface ConfettiBurstProps {
  trigger: number; // Increment to trigger burst
  milestone?: number; // The milestone that was reached
}

const ConfettiBurst: React.FC<ConfettiBurstProps> = ({ trigger, milestone }) => {
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [showMilestone, setShowMilestone] = useState(false);

  const createBurst = useCallback(() => {
    const particles: Confetti[] = [];
    const count = 50;

    for (let i = 0; i < count; i++) {
      particles.push({
        id: Date.now() + i,
        x: 50 + (Math.random() - 0.5) * 20,
        y: 40 + (Math.random() - 0.5) * 10,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        size: Math.random() * 8 + 4,
        velocityX: (Math.random() - 0.5) * 15,
        velocityY: Math.random() * -12 - 5,
      });
    }

    setConfetti(particles);
    setShowMilestone(true);

    // Clear confetti after animation
    setTimeout(() => {
      setConfetti([]);
    }, 3000);

    // Hide milestone text
    setTimeout(() => {
      setShowMilestone(false);
    }, 2500);
  }, []);

  useEffect(() => {
    if (trigger > 0) {
      createBurst();
    }
  }, [trigger, createBurst]);

  if (confetti.length === 0 && !showMilestone) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Confetti particles */}
      {confetti.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size * 0.6,
            backgroundColor: particle.color,
            transform: `rotate(${particle.rotation}deg)`,
            '--velocity-x': `${particle.velocityX}px`,
            '--velocity-y': `${particle.velocityY}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* Milestone celebration text */}
      {showMilestone && milestone && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-milestone-pop bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 bg-clip-text text-transparent text-center">
            <div className="text-5xl font-black drop-shadow-lg">🎉</div>
            <div className="text-3xl font-black mt-2">{milestone} Viewers!</div>
            <div className="text-lg font-semibold mt-1 text-white/80">Amazing!</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateX(0) translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateX(calc(var(--velocity-x) * 20)) translateY(calc(100vh + var(--velocity-y) * -30)) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall 3s ease-out forwards;
        }
        
        @keyframes milestone-pop {
          0% {
            transform: scale(0) rotate(-10deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(5deg);
            opacity: 1;
          }
          70% {
            transform: scale(0.9) rotate(-3deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        .animate-milestone-pop {
          animation: milestone-pop 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ConfettiBurst;
