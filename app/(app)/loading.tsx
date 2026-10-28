import { PageSkeleton } from "@/components/app/skeletons";

// Instant feedback on navigation; also lets <Link> prefetch the shell and this state
export default function Loading() {
  return <PageSkeleton />;
}
