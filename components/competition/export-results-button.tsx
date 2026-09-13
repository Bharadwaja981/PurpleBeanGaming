"use client";
import { useState } from "react";
export function ExportResultsButton({
  tournamentId,
  kind,
}: {
  tournamentId: string;
  kind: "matches" | "standings";
}) {
  const [status, setStatus] = useState("");
  function download() {
    setStatus("Preparing…");
    const a = document.createElement("a");
    a.href = `/api/competition-export?tournamentId=${encodeURIComponent(tournamentId)}&kind=${kind}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus("Downloaded");
  }
  return (
    <div>
      <button
        onClick={download}
        className="rounded border border-[var(--accent)] px-3 py-2 text-sm"
        disabled={status === "Preparing…"}
      >
        Export {kind === "matches" ? "Match Results" : "Standings"}
      </button>
      <span className="ml-2 text-xs text-[var(--muted)]" role="status">
        {status}
      </span>
    </div>
  );
}
