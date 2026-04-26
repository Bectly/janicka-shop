import { Skeleton } from "@/components/ui/skeleton";

export function AdminHeaderSkeleton({
  titleWidth = "w-40",
  subtitle = true,
  action = false,
}: {
  titleWidth?: string;
  subtitle?: boolean;
  action?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className={`h-8 ${titleWidth}`} />
        {subtitle ? <Skeleton className="mt-2 h-4 w-56" /> : null}
      </div>
      {action ? (
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}

export function AdminListSkeleton({
  title = "w-40",
  rows = 8,
  withFilters = true,
  action = true,
}: {
  title?: string;
  rows?: number;
  withFilters?: boolean;
  action?: boolean;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      <AdminHeaderSkeleton titleWidth={title} action={action} />
      {withFilters ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>
      ) : null}
      <div className="mt-6 overflow-hidden rounded-lg border bg-card">
        <div className="border-b bg-muted/40 px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="hidden h-4 w-20 sm:block" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminStatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <AdminHeaderSkeleton titleWidth="w-32" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
      <AdminStatCardsSkeleton count={4} />
      <AdminStatCardsSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="h-5 w-36" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-4 h-48 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function AdminFormSkeleton({
  title = "w-48",
  fields = 6,
}: {
  title?: string;
  fields?: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <AdminHeaderSkeleton titleWidth={title} />
      <div className="rounded-lg border bg-card p-6">
        <div className="space-y-5">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-10 w-32 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminMailboxSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <AdminHeaderSkeleton titleWidth="w-36" action />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border bg-card">
        <div className="divide-y">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-full max-w-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminSettingsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <AdminHeaderSkeleton titleWidth="w-32" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
        <div className="rounded-lg border bg-card p-6 md:col-span-2">
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mt-8 space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <section>
        <Skeleton className="mb-4 h-3 w-40" />
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <Skeleton className="h-[220px] w-full rounded-md" />
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <Skeleton className="mb-3 h-3 w-56" />
          <div className="overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          </div>
        </section>
        <section>
          <Skeleton className="mb-3 h-3 w-44" />
          <div className="flex min-h-[280px] items-center justify-center rounded-xl border bg-card p-4 shadow-sm">
            <Skeleton className="size-52 rounded-full" />
          </div>
        </section>
      </div>
    </div>
  );
}

export function AdminCoverageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <AdminHeaderSkeleton titleWidth="w-40" />
      <AdminStatCardsSkeleton count={4} />
      <div className="rounded-lg border bg-card p-4">
        <Skeleton className="h-5 w-48" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
