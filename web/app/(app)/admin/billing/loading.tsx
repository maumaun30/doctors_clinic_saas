import { CardsSkeleton } from "@/app/_components/skeleton";

export default function Loading() {
  return <CardsSkeleton cards={1} rows={4} maxWidth={640} />;
}
