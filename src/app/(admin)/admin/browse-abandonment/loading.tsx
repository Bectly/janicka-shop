import { AdminListSkeleton } from "@/components/admin/admin-skeletons";

export default function Loading() {
  return <AdminListSkeleton title="w-32" rows={8} withFilters={false} action={false} />;
}
