"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[TaskFlow global error]", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="mb-2 text-2xl font-bold">Application error</h1>
          <p className="mb-6 max-w-sm text-sm text-gray-500">
            Something went wrong at the application level. Please try again.
          </p>
          {error.digest && (
            <p className="mb-6 font-mono text-[10px] text-gray-400">
              ID: {error.digest}
            </p>
          )}
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
