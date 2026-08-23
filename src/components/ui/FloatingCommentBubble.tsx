import React from 'react';

interface FloatingCommentBubbleProps {
  show: boolean;
  avatarUrl?: string;
  username?: string;
  content?: string;
}

/**
 * A short-lived bubble that floats up from the right action bar when
 * another user comments on the currently-playing Muv in realtime.
 */
const FloatingCommentBubble: React.FC<FloatingCommentBubbleProps> = ({
  show,
  avatarUrl,
  username,
  content,
}) => {
  if (!show || !username) return null;

  return (
    <div
      className="pointer-events-none absolute right-16 bottom-32 z-30 flex items-center gap-2 max-w-[60%] animate-comment-float"
      key={`${username}-${content}`}
    >
      <img
        src={avatarUrl || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=60&h=60&fit=crop&crop=face'}
        alt={username}
        className="w-7 h-7 rounded-full object-cover border border-white/70 flex-shrink-0"
      />
      <div className="bg-black/70 backdrop-blur-md text-white rounded-2xl rounded-bl-sm px-3 py-1.5 text-xs shadow-lg">
        <span className="font-semibold text-primary mr-1">@{username}</span>
        <span className="opacity-90 line-clamp-2">{content}</span>
      </div>
      <style>{`
        @keyframes commentFloat {
          0%   { opacity: 0; transform: translateY(20px) scale(0.9); }
          15%  { opacity: 1; transform: translateY(0)    scale(1);   }
          80%  { opacity: 1; transform: translateY(-10px) scale(1);  }
          100% { opacity: 0; transform: translateY(-30px) scale(0.95); }
        }
        .animate-comment-float {
          animation: commentFloat 3.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default FloatingCommentBubble;
