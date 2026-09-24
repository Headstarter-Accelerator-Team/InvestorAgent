"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Catches rendering errors anywhere on the page so the app never goes blank.
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          The page hit an unexpected error. Your data is fine; try again, and if it keeps
          happening, reload the page.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
