import { ListSkeleton } from "@/app/_components/skeleton";

// Generic fallback for any (app) page without its own loading.tsx.
export default function Loading() {
  return <ListSkeleton rows={6} avatar />;
}
