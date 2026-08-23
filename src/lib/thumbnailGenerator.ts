/**
 * Generate a thumbnail from a video file at a specific time (default: 1 second)
 * Returns a Blob that can be uploaded to storage
 */
export const generateThumbnail = (
  videoFile: File,
  timeInSeconds: number = 1,
  quality: number = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      URL.revokeObjectURL(video.src);
      video.remove();
      canvas.remove();
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const captureFrame = () => {
      if (settled) return;
      try {
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to generate thumbnail blob'));
            }
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        fail(error instanceof Error ? error : new Error('Failed to generate thumbnail'));
      }
    };

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const seekTime = duration > 0
        ? Math.max(0, Math.min(timeInSeconds, Math.max(duration - 0.1, 0)))
        : 0;

      try {
        video.currentTime = seekTime;
      } catch {
        captureFrame();
      }
    };

    video.onseeked = captureFrame;

    video.onerror = () => {
      fail(new Error('Failed to load video for thumbnail generation'));
    };

    // Set source and start loading
    video.src = URL.createObjectURL(videoFile);
    timeout = setTimeout(() => fail(new Error('Timed out while generating thumbnail')), 8000);
  });
};

/**
 * Generate a data URL thumbnail (for previews)
 */
export const generateThumbnailDataUrl = (
  videoFile: File,
  timeInSeconds: number = 1
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      URL.revokeObjectURL(video.src);
      video.remove();
      canvas.remove();
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const captureFrame = () => {
      if (settled) return;
      try {
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        settled = true;
        cleanup();
        resolve(dataUrl);
      } catch (error) {
        fail(error instanceof Error ? error : new Error('Failed to generate thumbnail preview'));
      }
    };

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const seekTime = duration > 0
        ? Math.max(0, Math.min(timeInSeconds, Math.max(duration - 0.1, 0)))
        : 0;

      try {
        video.currentTime = seekTime;
      } catch {
        captureFrame();
      }
    };

    video.onseeked = captureFrame;

    video.onerror = () => {
      fail(new Error('Failed to load video for thumbnail generation'));
    };

    video.src = URL.createObjectURL(videoFile);
    timeout = setTimeout(() => fail(new Error('Timed out while generating thumbnail preview')), 8000);
  });
};
