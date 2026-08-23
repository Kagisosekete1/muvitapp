import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { compressImageFile, fileToPreviewUrl } from '@/lib/imageCompression';
import { logVideoLoadError } from '@/lib/videoDiagnostics';

interface EditReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  reel: {
    id: string;
    title: string;
    description?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
  } | null;
  onUpdate?: () => void;
}

const EditReelModal: React.FC<EditReelModalProps> = ({ isOpen, onClose, reel, onUpdate }) => {
  const { toast } = useToast();
  const { authUser } = useUser();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [thumbnailOptions, setThumbnailOptions] = useState<string[]>([]);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState(0);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [customThumbnailFile, setCustomThumbnailFile] = useState<File | null>(null);
  const [customThumbnailPreview, setCustomThumbnailPreview] = useState('');

  useEffect(() => {
    if (reel) {
      setTitle(reel.title || '');
      setDescription(reel.description || '');
      setThumbnailOptions(reel.thumbnailUrl ? [reel.thumbnailUrl] : []);
      setSelectedThumbnailIndex(0);
      setCustomThumbnailFile(null);
      setCustomThumbnailPreview('');
    }
  }, [reel]);

  useEffect(() => {
    if (!customThumbnailFile) return;
    const url = fileToPreviewUrl(customThumbnailFile);
    setCustomThumbnailPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [customThumbnailFile]);

  useEffect(() => {
    if (!isOpen || !reel?.videoUrl) return;

    let cancelled = false;
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const generated: string[] = [];
    let objectUrl = '';

    const cleanup = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      video.remove();
      canvas.remove();
    };

    const captureAt = (time: number) => new Promise<string>((resolve, reject) => {
      const done = () => {
        try {
          canvas.width = video.videoWidth || 720;
          canvas.height = video.videoHeight || 1280;
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (error) {
          reject(error);
        }
      };

      video.onseeked = done;
      video.onerror = () => reject(new Error('Could not load this Muv for cover selection.'));
      try {
        video.currentTime = Math.min(Math.max(time, 0), Math.max((video.duration || 1) - 0.1, 0));
      } catch {
        done();
      }
    });

    const generateOptions = async () => {
      if (!ctx) return;
      setThumbnailLoading(true);
      try {
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.src = reel.videoUrl;

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Could not read this Muv video.'));
        });

        const duration = Number.isFinite(video.duration) ? video.duration : 1;
        const times = [1, duration * 0.33, duration * 0.66, Math.max(duration - 1, 1)];
        for (const time of times) {
          if (cancelled) return;
          generated.push(await captureAt(time));
        }

        if (!cancelled && generated.length) {
          setThumbnailOptions(generated);
          setSelectedThumbnailIndex(0);
        }
      } catch (error) {
        logVideoLoadError('could not generate edit thumbnails', reel.videoUrl, error);
      } finally {
        if (!cancelled) setThumbnailLoading(false);
        cleanup();
      }
    };

    generateOptions();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isOpen, reel?.videoUrl]);

  const uploadSelectedThumbnail = async () => {
    if (!reel || !authUser) {
      return undefined;
    }

    const selected = thumbnailOptions[selectedThumbnailIndex];
    if (!customThumbnailFile && !selected?.startsWith('data:')) return undefined;

    const blob = customThumbnailFile
      ? await compressImageFile(customThumbnailFile)
      : await (await fetch(selected)).blob();
    const path = `${authUser.id}/${reel.id}-cover-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('reels').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('reels').getPublicUrl(path);
    return data.publicUrl;
  };

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

  const handleSave = async () => {
    if (!reel) return;
    
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for your Muv.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const newThumbnailUrl = await uploadSelectedThumbnail();
      const { error } = await supabase
        .from('reels')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          ...(newThumbnailUrl ? { thumbnail_url: newThumbnailUrl } : {}),
        })
        .eq('id', reel.id);

      if (error) throw error;

      toast({
        title: 'Muv updated',
        description: 'Your Muv has been updated successfully.',
      });

      onUpdate?.();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message || 'Could not update Muv.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border rounded-3xl">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Edit Muv</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Choose Cover</Label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCustomThumbnailChange}
            />
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
              {(customThumbnailPreview || thumbnailOptions[selectedThumbnailIndex]) ? (
                <img
                  src={customThumbnailPreview || thumbnailOptions[selectedThumbnailIndex]}
                  alt="Selected Muv cover"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-black" />
              )}
              {thumbnailLoading && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-sm">
                  Loading covers...
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => coverInputRef.current?.click()}
            >
              <ImagePlus className="w-4 h-4 mr-2" />
              Upload image cover
            </Button>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`aspect-[9/16] rounded-lg overflow-hidden bg-black border-2 ${
                    selectedThumbnailIndex === index ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'
                  }`}
                  onClick={() => setSelectedThumbnailIndex(index)}
                  disabled={!thumbnailOptions[index]}
                >
                  {thumbnailOptions[index] && (
                    <img
                      src={thumbnailOptions[index]}
                      alt={`Cover option ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Title
            </Label>
            <Input
              id="title"
              key="edit-title-input"
              defaultValue={title}
              onBlur={(e) => setTitle(e.target.value)}
              placeholder="Enter Muv title"
              className="rounded-xl"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground text-right">
              {title.length}/100
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Hashtags
            </Label>
            <Textarea
              id="description"
              key="edit-description-input"
              defaultValue={description}
              onBlur={(e) => setDescription(e.target.value)}
              placeholder="Add hashtags like #dance #hiphop"
              className="rounded-xl resize-none"
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/500
            </p>
          </div>

          <div className="bg-secondary/30 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">
              💡 Tip: Use hashtags like #dance #challenge to help others discover your Muv.
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditReelModal;
