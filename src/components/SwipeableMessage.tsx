import React, { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';

interface SwipeableMessageProps {
  children: React.ReactNode;
  onDelete: () => void;
  canDelete: boolean;
}

const SwipeableMessage: React.FC<SwipeableMessageProps> = ({ 
  children, 
  onDelete, 
  canDelete 
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canDelete) return;
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !canDelete) return;
    const currentX = e.touches[0].clientX;
    const diff = startX.current - currentX;
    
    // Only allow left swipe (negative translateX means swipe left)
    if (diff > 0) {
      setTranslateX(Math.min(diff, 80)); // Max 80px
    } else {
      setTranslateX(0);
    }
  };

  const handleTouchEnd = () => {
    if (!canDelete) return;
    setIsDragging(false);
    
    if (translateX > 60) {
      // Trigger delete
      onDelete();
    }
    setTranslateX(0);
  };

  // Mouse events for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canDelete) return;
    startX.current = e.clientX;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canDelete) return;
    const currentX = e.clientX;
    const diff = startX.current - currentX;
    
    if (diff > 0) {
      setTranslateX(Math.min(diff, 80));
    } else {
      setTranslateX(0);
    }
  };

  const handleMouseUp = () => {
    if (!canDelete) return;
    setIsDragging(false);
    
    if (translateX > 60) {
      onDelete();
    }
    setTranslateX(0);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setTranslateX(0);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Delete background */}
      {canDelete && (
        <div 
          className="absolute inset-y-0 right-0 flex items-center justify-end bg-destructive px-4"
          style={{ width: translateX > 0 ? `${translateX}px` : '0px' }}
        >
          <Trash2 className="w-5 h-5 text-white" />
        </div>
      )}
      
      {/* Message content */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `translateX(-${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
        className="relative bg-background"
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableMessage;
