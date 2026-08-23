export const describeMediaUrl = (url: string | null | undefined) => {
  if (!url) return 'missing-url';
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const tail = parts.slice(-2).join('/');
    return `${parsed.origin}/${tail || 'media'}`;
  } catch {
    return url.length > 96 ? `${url.slice(0, 48)}...${url.slice(-24)}` : url;
  }
};

export const logVideoLoadError = (context: string, url: string | null | undefined, error?: unknown) => {
  if (import.meta.env.PROD) return;
  console.warn(`[Video] ${context}`, {
    url: describeMediaUrl(url),
    error,
  });
};
