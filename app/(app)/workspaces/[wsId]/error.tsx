"use client";

import { ErrorView } from "@/components/shared/ErrorView";

export default function WorkspaceError({
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
      title="Failed to load workspace"
      description="We couldn't load this workspace. It may have been deleted or you may not have permission to view it."
    />
  );
}
