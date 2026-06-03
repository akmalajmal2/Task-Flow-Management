"use client";

import { ErrorView } from "@/components/shared/ErrorView";

export default function BoardError({
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
      title="Failed to load board"
      description="We couldn't load this board. It may have been deleted or you may not have access."
    />
  );
}
