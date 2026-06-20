import { Suspense } from "react";
import { VideoDashboard } from "./video-dashboard";

export default function VideoDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">読み込み中…</div>}>
      <VideoDashboard />
    </Suspense>
  );
}
