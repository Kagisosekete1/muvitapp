import React from 'react';
import { Pin, X } from 'lucide-react';

interface PinnedMessageProps {
  username: string;
  content: string;
  canUnpin: boolean;
  onUnpin: () => void;
}

const PinnedMessage: React.FC<PinnedMessageProps> = ({ username, content, canUnpin, onUnpin }) => {
  return (
    <div className="mx-4 mb-2 bg-pink-500/20 backdrop-blur-sm border border-pink-500/30 rounded-xl px-3 py-2 flex items-start gap-2 animate-fade-in">
      <Pin className="w-3 h-3 text-pink-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-pink-400 text-xs font-semibold">@{username}</span>
        <p className="text-white text-sm truncate">{content}</p>
      </div>
      {canUnpin && (
        <button onClick={onUnpin} className="text-white/50 hover:text-white flex-shrink-0">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default PinnedMessage;
