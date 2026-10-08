import { useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, Pause, Play, Upload } from 'lucide-react';

interface BattleVideoSurfaceProps {
  videoUrl: string | null | undefined;
  posterUrl?: string | null;
  label: string;
  className?: string;
}

/**
 * Battle clips need one calm, consistent playback surface. Native browser
 * controls are intentionally avoided because they crowd the side-by-side vote
 * layout and differ wildly between Android browsers.
 */
const BattleVideoSurface = ({ videoUrl, posterUrl, label, className = '' }: BattleVideoSurfaceProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setFailed(false);
  }, [videoUrl]);

  useEffect(() => () => {
    videoRef.current?.pause();
  }, []);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video || failed) return;

    try {
      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
    } catch {
      setFailed(true);
    }
  };

  if (!videoUrl) {
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-2 bg-secondary p-4 text-center text-muted-foreground ${className}`}>
        <Upload className="h-7 w-7" />
        <span className="text-xs font-medium">Waiting for response</span>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      <video
        ref={videoRef}
        src={videoUrl}
        poster={posterUrl || undefined}
        className={`h-full w-full object-contain transition-opacity duration-200 ${ready && !failed ? 'opacity-100' : 'opacity-0'}`}
        playsInline
        loop
        preload="metadata"
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        onLoadedData={() => setReady(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          setFailed(true);
          setReady(false);
        }}
      />

      {!ready && !failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-white">
          {posterUrl && <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
          <LoaderCircle className="relative h-6 w-6 animate-spin" />
          <span className="relative text-xs font-medium">Loading Muv</span>
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-secondary p-4 text-center text-muted-foreground">
          <AlertCircle className="h-7 w-7" />
          <span className="text-xs font-medium">This battle video is unavailable</span>
        </div>
      )}

      {ready && !failed && (
        <button
          type="button"
          aria-label={`${playing ? 'Pause' : 'Play'} ${label}`}
          onClick={togglePlayback}
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg transition-opacity ${playing ? 'opacity-0 hover:opacity-100 focus-within:opacity-100' : 'opacity-100'}`}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
          </span>
        </button>
      )}
    </div>
  );
};

export default BattleVideoSurface;
