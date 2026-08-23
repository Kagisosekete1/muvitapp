import React from 'react';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 14,
  md: 18,
  lg: 22,
};

const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ size = 'sm', className }) => {
  const s = sizeMap[size];
  
  return (
    <svg
      viewBox="0 0 24 24"
      width={s}
      height={s}
      className={cn('flex-shrink-0 inline-block', className)}
      aria-label="Verified"
    >
      {/* Facebook-style star/shield shape */}
      <path
        d="M12 0 L14.7 4.1 L19.5 3.5 L18 8.1 L22 11.3 L18.3 14.1 L19.5 18.8 L15 17.5 L12 21.5 L9 17.5 L4.5 18.8 L5.7 14.1 L2 11.3 L6 8.1 L4.5 3.5 L9.3 4.1 Z"
        fill="hsl(217, 91%, 60%)"
      />
      {/* White checkmark */}
      <path
        d="M9.5 12.5 L11 14.5 L15 9.5"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default VerifiedBadge;
