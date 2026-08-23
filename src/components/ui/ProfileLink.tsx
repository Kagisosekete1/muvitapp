import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ProfileLinkProps {
  username: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Reusable component for navigating to a user's profile.
 * Wrap any avatar or username with this to enable profile navigation.
 */
const ProfileLink: React.FC<ProfileLinkProps> = ({ username, children, className = '', onClick }) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e);
    if (username) {
      navigate(`/user/${username}`);
    }
  };

  return (
    <button
      type="button"
      className={`cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};

export default ProfileLink;
