import { AdminListSkeleton } from "@/components/admin/admin-skeletons";

export default function Loading() {
  return <AdminListSkeleton title="w-28" rows={6} withFilters={false} action={false} />;
}
