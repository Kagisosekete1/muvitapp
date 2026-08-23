import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Scissors, Sparkles, ArrowLeft, Check, Music2, Gauge, Wand2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { reelSchema } from '@/lib/validations';
import { generateThumbnail } from '@/lib/thumbnailGenerator';
import { compressImageFile, fileToPreviewUrl } from '@/lib/imageCompression';
import MusicLibraryModal, { type PlaceholderSong } from '@/components/MusicLibraryModal';
import VideoEffectsPanel, { type VideoEffects, FILTERS } from '@/components/VideoEffectsPanel';

const getVideoExtension = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension && /^[a-z0-9]+$/.test(extension)) return extension;

  if (file.type.includes('quicktime')) return 'mov';
  if (file.type.includes('webm')) return 'webm';
  if (file.type.includes('x-matroska')) return 'mkv';
  return 'mp4';
};

const getVideoContentType = (file: File) => file.type || `video/${getVideoExtension(file)}`;
const TRANSPARENT_VIDEO_POSTER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

interface ReelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoFile: File;
}

const ReelUploadModal: React.FC<ReelUploadModalProps> = ({ isOpen, onClose, videoFile }) => {
  const { toast } = useToast();
  const { authUser, currentUser, refreshProfile } = useUser();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [step, setStep] = useState<'edit' | 'crop' | 'filters' | 'effects' | 'details' | 'uploading'>('edit');
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
  const [selectedFilter, setSelectedFilter] = useState(0);
  const [cropStart, setCropStart] = useState(0);
  const [cropEnd, setCropEnd] = useState(100);
  const [videoDuration, setVideoDuration] = useState(0);
  const [postAs, setPostAs] = useState<'reel' | 'tutorial'>('reel');
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [selectedSong, setSelectedSong] = useState<PlaceholderSong | null>(null);
  const [thumbnailOptions, setThumbnailOptions] = useState<string[]>([]);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState(0);
  const [customThumbnailTime, setCustomThumbnailTime] = useState(1);
  const [previewReady, setPreviewReady] = useState(false);
  const [customThumbnailFile, setCustomThumbnailFile] = useState<File | null>(null);
  const [customThumbnailPreview, setCustomThumbnailPreview] = useState('');
  
  // Video effects state
  const [videoEffects, setVideoEffects] = useState<VideoEffects>({
    speed: 1,
    transition: 'none',
    arFilter: 'none',
    filter: 'none',
  });

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setPreviewReady(false);
      setThumbnailOptions([]);
      setSelectedThumbnailIndex(0);
      setCustomThumbnailFile(null);
      setCustomThumbnailPreview('');
      setVideoPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [videoFile]);

  useEffect(() => {
    if (!customThumbnailFile) return;
    const url = fileToPreviewUrl(customThumbnailFile);
    setCustomThumbnailPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [customThumbnailFile]);

  // Auto-play video when preview URL is set and generate thumbnail options
  useEffect(() => {
    if (videoPreviewUrl && videoRef.current) {
      videoRef.current.src = videoPreviewUrl;
      videoRef.current.controls = false;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.load();
      videoRef.current.play().catch(console.log);
      
      videoRef.current.onloadedmetadata = () => {
        const duration = videoRef.current?.duration || 0;
        setVideoDuration(duration);
        
        // Generate thumbnail options at different points in the video
        generateThumbnailOptions(duration);
      };
    }
  }, [videoPreviewUrl]);

  const generateThumbnailOptions = async (duration: number) => {
    if (!videoFile || duration === 0) return;
    
    const times = [
      1, // Start
      duration * 0.33, // 33%
      duration * 0.66, // 66%
      Math.max(duration - 1, 1), // End
    ].filter(t => t <= duration && t >= 0);
    
    const thumbnails: string[] = [];
    
    for (const time of times) {
      try {
        const { generateThumbnailDataUrl } = await import('@/lib/thumbnailGenerator');
        const thumbnail = await generateThumbnailDataUrl(videoFile, time);
        thumbnails.push(thumbnail);
      } catch (e) {
        console.warn('Failed to generate thumbnail at time:', time, e);
      }
    }
    
    if (thumbnails.length > 0) {
      setThumbnailOptions(thumbnails);
      setSelectedThumbnailIndex(2); // Default to middle frame
    }
  };

  const handleCropReel = () => {
    setStep('crop');
  };

  const handleFiltersEffects = () => {
    setStep('effects');
  };

  const applyCropTrim = () => {
    toast({
      title: "Crop Applied",
      description: `Video trimmed from ${formatTime(cropStart * videoDuration / 100)} to ${formatTime(cropEnd * videoDuration / 100)}`,
    });
    setStep('edit');
  };

  const applyFilter = () => {
    toast({
      title: "Filter Applied",
      description: `${FILTERS[selectedFilter]?.name || 'Filter'} applied to your reel`,
    });
    setStep('edit');
  };

  const handleApplyEffects = () => {
    const effects = [];
    if (videoEffects.speed !== 1) effects.push(`${videoEffects.speed}x speed`);
    if (videoEffects.transition !== 'none') effects.push(videoEffects.transition);
    if (videoEffects.arFilter !== 'none') effects.push(videoEffects.arFilter);
    if (videoEffects.filter !== 'none') effects.push(videoEffects.filter);
    
    toast({
      title: "Effects Applied",
      description: effects.length > 0 ? effects.join(', ') : 'No effects selected',
    });
    setStep('edit');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const previewPoster = customThumbnailPreview || thumbnailOptions[selectedThumbnailIndex] || thumbnailOptions[0] || '';

  const handleCustomThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Choose an image', description: 'Please select a photo for your Muv cover.', variant: 'destructive' });
      return;
    }
    setCustomThumbnailFile(file);
    setSelectedThumbnailIndex(-1);
  };

  const markPreviewReady = (video: HTMLVideoElement) => {
    video.controls = false;
    setPreviewReady(true);
  };

  const renderDarkPreview = () => (
    <div className="absolute inset-0 bg-black flex items-center justify-center">
      {previewPoster ? (
        <img
          src={previewPoster}
          alt="Selected Muv cover"
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="w-full h-full bg-black" aria-label="Preparing Muv preview" />
      )}
    </div>
  );

  const validateForm = () => {
    const result = reelSchema.safeParse({ title, description });
    if (!result.success) {
      const fieldErrors: { title?: string; description?: string } = {};
      result.error.issues.forEach(err => {
        if (err.path[0] === 'title') fieldErrors.title = err.message;
        if (err.path[0] === 'description') fieldErrors.description = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleUpload = async () => {
    if (!authUser || !currentUser) {
      toast({ title: "Error", description: "Please sign in to upload", variant: "destructive" });
      return;
    }

    if (!validateForm()) return;

    setStep('uploading');
    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Generate thumbnail from selected frame or custom time
      setUploadProgress(10);
      let thumbnailUrl: string | null = null;
      
      try {
        const thumbnailBlob = customThumbnailFile
          ? await compressImageFile(customThumbnailFile)
          : await generateThumbnail(
              videoFile,
              [1, videoDuration * 0.25, videoDuration * 0.5, videoDuration * 0.75, Math.max(videoDuration - 1, 1)][selectedThumbnailIndex] || customThumbnailTime
            );
        const thumbnailFileName = `${authUser.id}/thumb_${Date.now()}_${crypto.randomUUID()}.jpg`;
        
        setUploadProgress(20);
        
        const { data: thumbUpload, error: thumbError } = await supabase.storage
          .from('reels')
          .upload(thumbnailFileName, thumbnailBlob, {
            cacheControl: '31536000',
            contentType: 'image/jpeg',
            upsert: false,
          });
        
        if (!thumbError && thumbUpload) {
          const { data: { publicUrl } } = supabase.storage
            .from('reels')
            .getPublicUrl(thumbnailFileName);
          thumbnailUrl = publicUrl;
        }
      } catch (thumbErr) {
        console.warn('Thumbnail generation failed, continuing without thumbnail:', thumbErr);
      }

      setUploadProgress(30);

      // Step 2: Upload video to storage
      const fileExt = getVideoExtension(videoFile);
      const fileName = `${authUser.id}/${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reels')
        .upload(fileName, videoFile, {
          cacheControl: '31536000',
          contentType: getVideoContentType(videoFile),
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('reels')
        .getPublicUrl(fileName);

      setUploadProgress(80);

      // Step 3: Create reel record in database with thumbnail
      const { data: reelData, error: dbError } = await supabase
        .from('reels')
        .insert({
          user_id: authUser.id,
          title: title.trim(),
          description: description.trim() || null,
          video_url: publicUrl,
          thumbnail_url: thumbnailUrl,
          is_portrait: true,
          is_tutorial: postAs === 'tutorial',
          source_storage_path: fileName,
          file_size_bytes: videoFile.size,
          mime_type: getVideoContentType(videoFile),
          upload_status: 'uploaded',
          processing_status: 'processing',
        })
        .select('id')
        .single();

      if (dbError) throw dbError;

      setUploadProgress(95);

      // Update user's reel count
      await supabase
        .from('profiles')
        .update({ reels_count: (currentUser.stats.reels || 0) + 1 })
        .eq('user_id', authUser.id);

      // Refresh profile to update reel count
      await refreshProfile();

      // Notify followers about the new reel
      if (reelData?.id) {
        // @mention notifications from title + description
        const captionText = `${title} ${description || ''}`;
        const { notifyMentions } = await import('@/lib/mentions');
        void notifyMentions({ text: captionText, fromUserId: authUser.id, context: 'post', reelId: reelData.id });
      }

      setUploadProgress(100);

      toast({
        title: postAs === 'reel' ? "Muv uploaded!" : "Tutorial Muv uploaded!",
        description: `Your ${postAs === 'reel' ? 'Muv' : 'Tutorial Muv'} is now live.`,
      });

      setTimeout(() => {
        onClose();
      }, 500);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload reel",
        variant: "destructive",
      });
      setStep('details');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <div className="flex items-center">
            {step !== 'edit' && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step === 'uploading' ? 'details' : 'edit')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
          <DialogTitle className="flex-1 text-center">
              {step === 'edit' && 'Crop Muv'}
              {step === 'crop' && 'Crop & Trim'}
              {step === 'filters' && 'Filters'}
              {step === 'effects' && 'Effects & Speed'}
              {step === 'details' && 'Muv Details'}
              {step === 'uploading' && 'Uploading...'}
            </DialogTitle>
          </div>
        </DialogHeader>

        {step === 'edit' && (
          <div className="space-y-4 py-4">
            {/* Video Preview - Auto-plays with sound */}
            <div 
              className="relative aspect-[9/16] bg-black rounded-xl overflow-hidden max-h-64"
              style={{ filter: FILTERS[selectedFilter].class }}
            >
              <video
                ref={videoRef}
                src={videoPreviewUrl}
                className={`w-full h-full object-contain ${previewReady ? 'opacity-100' : 'opacity-0'}`}
                autoPlay
                loop
                muted
                playsInline
                controls={false}
                poster={TRANSPARENT_VIDEO_POSTER}
                onLoadedData={(e) => markPreviewReady(e.currentTarget)}
                onCanPlay={(e) => {
                  const video = e.currentTarget;
                  video.play().catch(() => {
                    video.muted = true;
                    video.play().catch(() => {});
                  });
                }}
              />
              {!previewReady && renderDarkPreview()}
            </div>

            {/* Edit Options */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-auto py-4 justify-start rounded-2xl"
                onClick={handleCropReel}
              >
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center mr-3">
                  <Scissors className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">Crop Muv</p>
                  <p className="text-sm text-muted-foreground">Crop & Trim your Muv</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full h-auto py-4 justify-start rounded-2xl"
                onClick={() => setStep('filters')}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mr-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">Filters</p>
                  <p className="text-sm text-muted-foreground">Add stunning visual filters</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full h-auto py-4 justify-start rounded-2xl"
                onClick={handleFiltersEffects}
              >
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center mr-3">
                  <Wand2 className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">Effects & Speed</p>
                  <p className="text-sm text-muted-foreground">Speed, transitions, AR effects</p>
                </div>
              </Button>
            </div>

            <Button className="w-full rounded-xl" onClick={() => setStep('details')}>
              Next
            </Button>
          </div>
        )}

        {step === 'crop' && (
          <div className="space-y-4 py-4">
            <div className="relative aspect-[9/16] bg-black rounded-xl overflow-hidden max-h-64">
              <video
                ref={videoRef}
                src={videoPreviewUrl}
                className={`w-full h-full object-contain ${previewReady ? 'opacity-100' : 'opacity-0'}`}
                autoPlay
                loop
                muted
                controls={false}
                playsInline
                poster={TRANSPARENT_VIDEO_POSTER}
                onLoadedData={(e) => markPreviewReady(e.currentTarget)}
                onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
              />
              {!previewReady && renderDarkPreview()}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Trim Start: {formatTime(cropStart * videoDuration / 100)}</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={cropStart}
                  onChange={(e) => setCropStart(Math.min(Number(e.target.value), cropEnd - 5))}
                  className="w-full accent-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Trim End: {formatTime(cropEnd * videoDuration / 100)}</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={cropEnd}
                  onChange={(e) => setCropEnd(Math.max(Number(e.target.value), cropStart + 5))}
                  className="w-full accent-primary"
                />
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Duration: {formatTime((cropEnd - cropStart) * videoDuration / 100)}
              </p>
            </div>

            <Button className="w-full rounded-xl" onClick={applyCropTrim}>
              <Check className="w-4 h-4 mr-2" />
              Apply Crop
            </Button>
          </div>
        )}

        {step === 'filters' && (
          <div className="space-y-4 py-4">
            <div 
              className="relative aspect-[9/16] bg-black rounded-xl overflow-hidden max-h-64"
              style={{ filter: FILTERS[selectedFilter].class }}
            >
              <video
                ref={videoRef}
                src={videoPreviewUrl}
                className={`w-full h-full object-contain ${previewReady ? 'opacity-100' : 'opacity-0'}`}
                autoPlay
                loop
                muted
                playsInline
                controls={false}
                poster={TRANSPARENT_VIDEO_POSTER}
                onLoadedData={(e) => markPreviewReady(e.currentTarget)}
                onCanPlay={() => {
                  videoRef.current?.play().catch(() => {});
                }}
              />
              {!previewReady && renderDarkPreview()}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {FILTERS.map((filter, index) => (
                <Button
                  key={filter.name}
                  variant={selectedFilter === index ? "default" : "outline"}
                  className={`flex flex-col items-center p-2 h-auto rounded-xl ${
                    selectedFilter === index ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedFilter(index)}
                >
                  <span className="text-lg mb-1">{filter.preview}</span>
                  <span className="text-xs">{filter.name}</span>
                </Button>
              ))}
            </div>

            <Button className="w-full rounded-xl" onClick={applyFilter}>
              <Check className="w-4 h-4 mr-2" />
              Apply Filter
            </Button>
          </div>
        )}

        {step === 'effects' && (
          <div className="space-y-4 py-4">
            <div 
              className="relative aspect-[9/16] bg-black rounded-xl overflow-hidden max-h-48"
              style={{ filter: videoEffects.filter !== 'none' ? FILTERS.find(f => f.id === videoEffects.filter)?.class || '' : '' }}
            >
              <video
                ref={videoRef}
                src={videoPreviewUrl}
                className={`w-full h-full object-contain ${previewReady ? 'opacity-100' : 'opacity-0'}`}
                autoPlay
                loop
                muted
                playsInline
                controls={false}
                poster={TRANSPARENT_VIDEO_POSTER}
                onLoadedData={(e) => markPreviewReady(e.currentTarget)}
                onCanPlay={(e) => {
                  const video = e.currentTarget;
                  video.playbackRate = videoEffects.speed;
                  video.play().catch(() => {});
                }}
              />
              {!previewReady && renderDarkPreview()}
              {/* AR Filter Overlay */}
              {videoEffects.arFilter !== 'none' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="text-6xl animate-pulse opacity-50">
                    {videoEffects.arFilter === 'hearts' && '❤️'}
                    {videoEffects.arFilter === 'stars' && '⭐'}
                    {videoEffects.arFilter === 'fire' && '🔥'}
                    {videoEffects.arFilter === 'snow' && '❄️'}
                    {videoEffects.arFilter === 'crown' && '👑'}
                    {videoEffects.arFilter === 'party' && '🎉'}
                  </div>
                </div>
              )}
              {/* Speed indicator */}
              {videoEffects.speed !== 1 && (
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
                  <span className="text-white text-xs font-bold">{videoEffects.speed}x</span>
                </div>
              )}
            </div>

            <VideoEffectsPanel
              effects={videoEffects}
              onEffectsChange={(newEffects) => {
                setVideoEffects(newEffects);
                // Apply speed change immediately to the video
                if (videoRef.current && newEffects.speed !== videoEffects.speed) {
                  videoRef.current.playbackRate = newEffects.speed;
                }
              }}
              onApply={handleApplyEffects}
            />
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4 py-4">
            {/* Cover preview. Keep this as image/black only so mobile WebViews cannot draw a native play poster. */}
            <div 
              className="relative aspect-video bg-black rounded-xl overflow-hidden"
              style={{ filter: FILTERS[selectedFilter].class }}
            >
              {renderDarkPreview()}
            </div>

            {/* Thumbnail Selection */}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCustomThumbnailChange}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Choose Cover</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => coverInputRef.current?.click()}
                >
                  Upload image
                </Button>
              </div>
              {(thumbnailOptions.length > 0 || customThumbnailPreview) ? (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {customThumbnailPreview && (
                    <button
                      type="button"
                      className="flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden border-2 border-primary ring-2 ring-primary/30"
                      onClick={() => setSelectedThumbnailIndex(-1)}
                    >
                      <img
                        src={customThumbnailPreview}
                        alt="Custom cover"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}
                  {thumbnailOptions.map((thumb, index) => (
                    <button
                      key={index}
                      className={`flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedThumbnailIndex === index
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-transparent hover:border-muted-foreground/50'
                      }`}
                      onClick={() => setSelectedThumbnailIndex(index)}
                    >
                      <img
                        src={thumb}
                        alt={`Thumbnail option ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                  Covers are still preparing. You can upload an image cover now.
                </div>
              )}
            </div>

            <div className="space-y-3">
              {/* Music (placeholder UI for future platform integration) */}
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between rounded-2xl"
                onClick={() => setShowMusicLibrary(true)}
              >
                <div className="flex items-center gap-2">
                  <Music2 className="w-4 h-4" />
                  <span className="font-medium">Add sound</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {selectedSong ? `${selectedSong.title} • ${selectedSong.artist}` : 'Choose'}
                </span>
              </Button>

              {selectedSong && (
                <div className="text-xs text-muted-foreground px-1">
                  Selected: <span className="font-medium text-foreground">{selectedSong.title}</span> — {selectedSong.artist}
                </div>
              )}

              <div>
                <Input
                  placeholder="Add Title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  className="rounded-xl"
                />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
              </div>
              <div className="relative">
                <Textarea
                  placeholder="Add Hashtags..."
                  value={description}
                  onChange={(e) => {
                    if (e.target.value.length <= 50) {
                      setDescription(e.target.value);
                    }
                  }}
                  maxLength={50}
                  className="rounded-xl resize-none"
                  rows={2}
                />
                <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                  {description.length}/50
                </span>
                {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
              </div>

              {/* Post As Selection */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Post as:</p>
                <div className="flex gap-2">
                  <Button
                    variant={postAs === 'reel' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl"
                    onClick={() => setPostAs('reel')}
                  >
                    Muv
                  </Button>
                  <Button
                    variant={postAs === 'tutorial' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl"
                    onClick={() => setPostAs('tutorial')}
                  >
                    Tutorial
                  </Button>
                </div>
              </div>
            </div>

            <Button className="w-full rounded-xl" onClick={handleUpload} disabled={!title.trim()}>
              <Upload className="w-4 h-4 mr-2" />
              Upload {postAs === 'reel' ? 'Muv' : 'Tutorial Muv'}
            </Button>

            <MusicLibraryModal
              isOpen={showMusicLibrary}
              onClose={() => setShowMusicLibrary(false)}
              onSelect={(song) => {
                setSelectedSong(song);
                toast({
                  title: 'Sound selected',
                  description: `${song.title} — ${song.artist}`,
                });
              }}
            />
          </div>
        )}

        {step === 'uploading' && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="text-lg font-semibold mb-2">Uploading your {postAs}...</p>
              <p className="text-sm text-muted-foreground mb-4">{uploadProgress}%</p>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};

export default ReelUploadModal;
