import { Skeleton } from "@/components/ui/skeleton";

export function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-72" /><Skeleton className="h-5 w-full max-w-xl" /></div>
      {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 w-full" />)}
    </div>
  );
}
