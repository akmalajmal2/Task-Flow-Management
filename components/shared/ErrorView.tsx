"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  showBack?: boolean;
}

export function ErrorView({
  error,
  reset,
  title = "Something went wrong",
  description,
  showBack = true,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    console.error("[TaskFlow error]", error);
  }, [error]);

  const msg =
    description ??
    error.message ??
    "An unexpected error occurred. Try refreshing the page.";

  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{msg}</p>
      {error.digest && (
        <p className="mb-6 font-mono text-[10px] text-muted-foreground/60">
          ID: {error.digest}
        </p>
      )}
      <div className="flex items-center gap-3">
        {showBack && (
          <Button variant="outline" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Go back
          </Button>
        )}
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    </div>
  );
}
