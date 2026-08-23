import React from 'react';
import { Heart } from 'lucide-react';

interface DoubleTapLikeAnimationProps {
  show: boolean;
  likerAvatarUrl?: string | null;
  likerUsername?: string | null;
}

const DoubleTapLikeAnimation: React.FC<DoubleTapLikeAnimationProps> = ({
  show,
  likerAvatarUrl,
  likerUsername,
}) => {
  if (!show) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
      <div className="relative flex flex-col items-center animate-scale-in">
        {/* Avatar with heart overlay */}
        {likerAvatarUrl ? (
          <div className="relative mb-2">
            <img
              src={likerAvatarUrl}
              alt={likerUsername || 'User'}
              className="w-16 h-16 rounded-full border-3 border-white shadow-lg object-cover"
            />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center border-2 border-white shadow-md">
              <Heart className="w-4 h-4 text-white fill-white" />
            </div>
          </div>
        ) : (
          <Heart 
            className="w-24 h-24 text-red-500 fill-red-500 animate-ping" 
            style={{ animationDuration: '0.6s' }}
          />
        )}
        
        {/* Username if available */}
        {likerUsername && likerAvatarUrl && (
          <span className="text-white text-sm font-semibold drop-shadow-lg bg-black/40 px-2 py-0.5 rounded-full">
            @{likerUsername} liked
          </span>
        )}
        
        {/* Floating hearts */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <Heart
              key={i}
              className="absolute text-red-500 fill-red-500 opacity-80"
              style={{
                width: `${12 + Math.random() * 8}px`,
                height: `${12 + Math.random() * 8}px`,
                left: `${20 + Math.random() * 60}%`,
                bottom: '40%',
                animation: `floatUp ${0.6 + Math.random() * 0.4}s ease-out forwards`,
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translateY(-80px) scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default DoubleTapLikeAnimation;
