import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ProfileLinkProps {
  username: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  preview?: boolean;
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Reusable component for navigating to a user's profile.
 * Wrap any avatar or username with this to enable profile navigation.
 */
const ProfileLink: React.FC<ProfileLinkProps> = ({
  username,
  children,
  className = '',
  onClick,
  preview = false,
  displayName,
  avatarUrl,
}) => {
  const navigate = useNavigate();
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e);
    if (preview) {
      setIsPreviewOpen(true);
      return;
    }
    if (username) {
      navigate(`/user/${username}`);
    }
  };

  const trigger = (
    <button
      type="button"
      className={`cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      onClick={handleClick}
    >
      {children}
    </button>
  );

  if (!preview) return trigger;

  return (
    <>
      {trigger}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-[min(21rem,calc(100vw-2rem))] rounded-3xl border-white/15 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl [&>button:last-child]:hidden">
          <div className="relative overflow-hidden px-5 pb-5 pt-8 text-center">
            <div className="absolute inset-x-0 top-0 h-24 bg-primary/15" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full bg-black/35 text-white hover:bg-black/55"
              onClick={() => setIsPreviewOpen(false)}
              aria-label="Close profile preview"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-primary/15 shadow-xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName || username} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-primary">{(displayName || username || '?')[0]?.toUpperCase()}</span>
              )}
            </div>
            <h2 className="mt-3 text-base font-semibold">{displayName || `@${username}`}</h2>
            <p className="text-sm text-muted-foreground">@{username}</p>
            <Button
              className="mt-5 w-full rounded-xl"
              onClick={() => {
                setIsPreviewOpen(false);
                navigate(`/user/${username}`);
              }}
            >
              View profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileLink;
