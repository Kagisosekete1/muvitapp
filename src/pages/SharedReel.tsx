import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NotificationReelModal from '@/components/NotificationReelModal';
import muvitLogo from '@/assets/muvit-logo.png';

const SharedReel = () => {
  const { reelId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!reelId) navigate('/', { replace: true });
  }, [reelId, navigate]);

  if (!reelId) return null;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/80">
        <img src={muvitLogo} alt="Muv'it" className="w-16 h-16 rounded-2xl" />
        <p className="text-sm">Opening Muv'z...</p>
      </div>
      <NotificationReelModal
        isOpen={true}
        onClose={() => navigate('/', { replace: true })}
        reelId={reelId}
      />
    </div>
  );
};

export default SharedReel;
