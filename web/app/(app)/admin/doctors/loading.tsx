import { CardsSkeleton } from "@/app/_components/skeleton";

export default function Loading() {
  return <CardsSkeleton cards={3} rows={3} />;
}
