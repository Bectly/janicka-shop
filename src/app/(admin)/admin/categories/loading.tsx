import { AdminListSkeleton } from "@/components/admin/admin-skeletons";

export default function Loading() {
  return <AdminListSkeleton title="w-32" rows={6} withFilters={false} />;
}
