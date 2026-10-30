import { Suspense } from "react";
import { Board } from "@/components/Board";

export default function BoardPage() {
  return (
    <Suspense>
      <Board />
    </Suspense>
  );
}
