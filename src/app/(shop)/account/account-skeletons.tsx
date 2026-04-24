import { Skeleton } from "@/components/ui/skeleton";

export function AccountCardListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AccountDashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <div className="rounded-lg border bg-card p-5">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
      <div>
        <Skeleton className="h-5 w-40" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AccountFormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="rounded-lg border bg-card p-5">
      <Skeleton className="h-5 w-32" />
      <div className="mt-4 space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
    </div>
  );
}

export function AccountWishlistSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-28" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-square w-full rounded-md" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
