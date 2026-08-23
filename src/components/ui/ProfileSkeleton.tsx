import { Skeleton } from '@/components/ui/skeleton';

export const ProfileStatsSkeleton = () => (
  <div className="flex items-center gap-6 mb-4">
    {[0, 1, 2].map((i) => (
      <div key={i} className="text-center flex flex-col items-center p-2">
        <Skeleton className="h-6 w-10 mb-1" />
        <Skeleton className="h-3 w-14" />
      </div>
    ))}
  </div>
);

export const ProfileGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid grid-cols-3 gap-0.5 px-0.5 pt-0.5">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="aspect-[9/16] rounded-none" />
    ))}
  </div>
);

export const ProfileHeaderSkeleton = () => (
  <div className="flex flex-col items-center mb-6">
    <Skeleton className="w-24 h-24 rounded-full mb-3" />
    <Skeleton className="h-6 w-32 mb-1" />
    <Skeleton className="h-4 w-48 mb-4" />
    <ProfileStatsSkeleton />
    <div className="flex gap-2 w-full">
      <Skeleton className="flex-1 h-10 rounded-xl" />
      <Skeleton className="flex-1 h-10 rounded-xl" />
    </div>
  </div>
);
