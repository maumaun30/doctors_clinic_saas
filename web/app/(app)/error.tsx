"use client";

import { ErrorView } from "@/app/_components/error-view";

export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} />;
}
