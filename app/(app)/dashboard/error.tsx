"use client";

import { ErrorView } from "@/components/shared/ErrorView";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      error={error}
      reset={reset}
      title="Failed to load dashboard"
      showBack={false}
    />
  );
}
