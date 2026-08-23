import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

interface StoryBubbleProps {
  avatarUrl: string;
  username: string;
  userId?: string;
  isCurrentUser?: boolean;
  onClick?: () => void;
}

const StoryBubble: React.FC<StoryBubbleProps> = ({ avatarUrl, username, userId, isCurrentUser, onClick }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (userId) {
      navigate(`/user/${username}`);
    }
  };
  return (
    <button
      onClick={handleClick}
      className="flex flex-col items-center space-y-1.5 flex-shrink-0 group"
    >
      <div className="relative transition-transform group-hover:scale-105 duration-200">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/80 to-accent/80 p-[2px]">
          <div className="w-full h-full rounded-xl bg-background p-[2px]">
            <img
              src={avatarUrl}
              alt={username}
              className="w-full h-full rounded-lg object-cover"
            />
          </div>
        </div>
        {isCurrentUser && (
          <div className="absolute -bottom-0.5 -right-0.5 bg-primary rounded-full p-1 shadow-md">
            <Plus className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
          </div>
        )}
      </div>
      <span className="text-xs font-medium text-foreground max-w-[56px] truncate">
        {username}
      </span>
    </button>
  );
};

export default StoryBubble;