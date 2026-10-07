import { FilteredListSkeleton } from "@/app/_components/skeleton";

export default function Loading() {
  return <FilteredListSkeleton rows={10} filters={3} />;
}
