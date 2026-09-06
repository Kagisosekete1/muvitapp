const SERVICE_RESTRICTED_PATTERNS = [
  'exceed_cached_egress_quota',
  'service for this project is restricted',
  'services restricted',
  'project is restricted',
  'remove spend caps',
  '402',
];

export const isSupabaseServiceRestricted = (error: unknown) => {
  const message = getRawSupabaseErrorMessage(error).toLowerCase();
  return SERVICE_RESTRICTED_PATTERNS.some((pattern) => message.includes(pattern));
};

export const getSupabaseUserMessage = (
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) => {
  if (isSupabaseServiceRestricted(error)) {
    return "Muv'it is temporarily paused while our backend service is being restored. Please try again soon.";
  }

  const rawMessage = getRawSupabaseErrorMessage(error);
  return rawMessage || fallback;
};

export const logSupabaseError = (scope: string, error: unknown) => {
  if (import.meta.env.PROD) return;
  console.error(`[Supabase:${scope}]`, error);
};

const getRawSupabaseErrorMessage = (error: unknown) => {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '');
  }
  return String(error);
};
