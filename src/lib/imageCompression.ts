export async function compressImageFile(
  file: File,
  maxSize = 1280,
  quality = 0.86
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare cover image.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        canvas.remove();
        if (blob) resolve(blob);
        else reject(new Error('Could not compress cover image.'));
      },
      'image/jpeg',
      quality
    );
  });
}

export const fileToPreviewUrl = (file: File) => URL.createObjectURL(file);
