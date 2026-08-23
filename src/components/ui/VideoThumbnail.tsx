import React, { useState, useEffect } from 'react';
import { AlertCircle, BarChart2, Eye, Heart, MessageCircle } from 'lucide-react';
import { logVideoLoadError } from '@/lib/videoDiagnostics';

interface VideoThumbnailProps {
  videoUrl: string;
  thumbnailUrl?: string | null;
  viewsCount?: number;
  likesCount?: number;
  commentsCount?: number;
  onClick?: () => void;
  onAnalyticsClick?: () => void;
  showAnalytics?: boolean;
  showStats?: boolean;
  className?: string;
}

const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  videoUrl,
  thumbnailUrl,
  viewsCount,
  likesCount,
  commentsCount,
  onClick,
  onAnalyticsClick,
  showAnalytics = false,
  showStats = false,
  className = '',
}) => {
  const [generatedThumbnail, setGeneratedThumbnail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [useVideoFallback, setUseVideoFallback] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setGeneratedThumbnail(null);
    setUseVideoFallback(false);
    setLoadError(null);

    if (!videoUrl) {
      setIsLoading(false);
      setLoadError('Video is unavailable.');
      logVideoLoadError('thumbnail missing video url', videoUrl);
      return;
    }

    // If we have a thumbnail URL, use it directly
    if (thumbnailUrl) {
      setGeneratedThumbnail(thumbnailUrl);
      setIsLoading(false);
      return;
    }

    // Generate thumbnail from video metadata. If canvas capture fails, keep a metadata-only
    // video preview instead of showing the WebView's native black play placeholder.
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    let hasGenerated = false;

    const generateThumbnail = () => {
      if (hasGenerated) return;
      hasGenerated = true;
      
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 360;
        canvas.height = video.videoHeight || 640;
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          if (dataUrl && dataUrl !== 'data:,') {
            setGeneratedThumbnail(dataUrl);
          }
        }
      } catch (e) {
        logVideoLoadError('canvas thumbnail generation failed', videoUrl, e);
        setUseVideoFallback(true);
      } finally {
        setIsLoading(false);
        video.remove();
      }
    };

    const handleLoadedMetadata = () => {
      // Seek to 0.5 second or 10% of duration
      const seekTime = Math.min(0.5, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    const handleSeeked = () => {
      // Wait a frame to ensure the video has rendered
      requestAnimationFrame(() => {
        generateThumbnail();
      });
    };

    const handleError = () => {
      setLoadError('Could not load this Muv preview.');
      logVideoLoadError('thumbnail video failed to load', videoUrl, video.error?.message);
      setIsLoading(false);
      video.remove();
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    // Set timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (!hasGenerated) {
        setIsLoading(false);
        setUseVideoFallback(true);
        logVideoLoadError('thumbnail generation timed out; using video fallback', videoUrl);
        video.remove();
      }
    }, 8000);

    video.src = videoUrl;
    video.load();

    return () => {
      clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      video.remove();
    };
  }, [videoUrl, thumbnailUrl]);

  return (
    <div
      className={`aspect-[9/16] bg-muted relative overflow-hidden cursor-pointer group ${className}`}
      onClick={onClick}
    >
      {/* Thumbnail or Loading State */}
      {generatedThumbnail ? (
        <img
          src={generatedThumbnail}
          alt="Video thumbnail"
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => {
            setGeneratedThumbnail(null);
            setUseVideoFallback(true);
            logVideoLoadError('thumbnail image failed to load', thumbnailUrl || videoUrl);
          }}
        />
      ) : useVideoFallback && videoUrl ? (
        <video
          src={videoUrl}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
          controls={false}
          onLoadedData={() => setIsLoading(false)}
          onError={(event) => {
            setUseVideoFallback(false);
            setLoadError('Could not load this Muv preview.');
            logVideoLoadError('fallback video failed to load', videoUrl, event.currentTarget.error?.message);
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-black">
          {isLoading ? (
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          ) : loadError ? (
            <div className="flex flex-col items-center gap-1 px-2 text-center text-white/80">
              <AlertCircle className="w-5 h-5" />
              <span className="text-[10px] leading-tight">{loadError}</span>
            </div>
          ) : null}
        </div>
      )}

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

      {/* Stats Overlay (likes/comments) - shows when showStats is true */}
      {showStats && (likesCount !== undefined || commentsCount !== undefined) && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex items-center gap-3">
            {likesCount !== undefined && (
              <div className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-white" fill="currentColor" />
                <span className="text-white text-xs font-medium">{likesCount}</span>
              </div>
            )}
            {commentsCount !== undefined && (
              <div className="flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5 text-white" fill="currentColor" />
                <span className="text-white text-xs font-medium">{commentsCount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Button */}
      {showAnalytics && onAnalyticsClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAnalyticsClick();
          }}
          className="absolute top-7 right-1 p-1.5 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
        >
          <BarChart2 className="w-4 h-4 text-white" />
        </button>
      )}

      {/* Views Count - only show if showStats is false */}
      {!showStats && viewsCount !== undefined && (
        <div className="absolute bottom-1 left-1 flex items-center gap-1">
          <Eye className="w-3 h-3 text-white" />
          <span className="text-white text-xs font-medium">{viewsCount}</span>
        </div>
      )}
    </div>
  );
};

export default VideoThumbnail;

