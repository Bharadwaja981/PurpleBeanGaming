"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export function CaptainMatchActions({
  matchId,
  teamId,
  players,
  pendingSubmissionId,
}: {
  matchId: string;
  teamId: string;
  players: Array<{ id: string; ign: string }>;
  pendingSubmissionId?: string;
}) {
  const [selected, setSelected] = useState(
      players.slice(0, 5).map((p) => p.id),
    ),
    [a, setA] = useState(2),
    [b, setB] = useState(0),
    [disputeReason, setDisputeReason] = useState(""),
    [message, setMessage] = useState(""),
    router = useRouter();
  async function call(
    kind: "checkin" | "lineup" | "submit" | "confirm" | "dispute",
  ) {
    const s = createClient();
    let result;
    if (kind === "checkin")
      result = await s.rpc("check_in_team", {
        p_match_id: matchId,
        p_team_id: teamId,
        p_request_id: crypto.randomUUID(),
        p_override: false,
      });
    else if (kind === "lineup")
      result = await s.rpc("confirm_match_lineup", {
        p_match_id: matchId,
        p_team_id: teamId,
        p_player_ids: selected,
        p_request_id: crypto.randomUUID(),
      });
    else if (kind === "submit")
      result = await s.rpc("submit_match_result", {
        p_match_id: matchId,
        p_team_a_score: a,
        p_team_b_score: b,
        p_evidence_path: "",
        p_notes: "",
        p_request_id: crypto.randomUUID(),
      });
    else
      result = await s.rpc("respond_to_match_result", {
        p_submission_id: pendingSubmissionId!,
        p_confirm: kind === "confirm",
        p_reason: kind === "dispute" ? disputeReason.trim() : "",
        p_request_id: crypto.randomUUID(),
      });
    setMessage(result.error?.message ?? "Saved");
    router.refresh();
  }
  return (
    <div className="mt-4 space-y-4 border-t border-[var(--line)] pt-4">
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border px-3 py-2"
          onClick={() => call("checkin")}
        >
          Check in team
        </button>
        <button
          className="rounded border px-3 py-2"
          onClick={() => call("lineup")}
          disabled={selected.length !== 5}
        >
          Confirm lineup ({selected.length}/5)
        </button>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Active lineup</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <label key={p.id}>
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, p.id]
                      : selected.filter((id) => id !== p.id),
                  )
                }
              />{" "}
              {p.ign}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-end gap-2">
        <label>
          Your score
          <input
            className="block w-20 rounded bg-[#081016] p-2"
            type="number"
            value={a}
            onChange={(e) => setA(Number(e.target.value))}
          />
        </label>
        <label>
          Opponent
          <input
            className="block w-20 rounded bg-[#081016] p-2"
            type="number"
            value={b}
            onChange={(e) => setB(Number(e.target.value))}
          />
        </label>
        <button
          className="rounded bg-[var(--accent)] px-3 py-2 text-black"
          onClick={() => call("submit")}
        >
          Submit result
        </button>
      </div>
      {pendingSubmissionId ? (
        <div className="space-y-2">
          <label className="block text-sm">
            Dispute reason
            <textarea
              className="mt-1 block min-h-20 w-full rounded bg-[#081016] p-2"
              value={disputeReason}
              onChange={(event) => setDisputeReason(event.target.value)}
              placeholder="Explain what is incorrect about the submitted result"
            />
          </label>
          <div className="flex gap-2">
          <button
            className="rounded border px-3 py-2"
            onClick={() => call("confirm")}
          >
            Confirm result
          </button>
          <button
            className="rounded border border-red-400 px-3 py-2 text-red-300"
            onClick={() => call("dispute")}
            disabled={!disputeReason.trim()}
          >
            Dispute result
          </button>
          </div>
        </div>
      ) : null}
      <p role="status" className="text-sm text-[var(--muted)]">
        {message}
      </p>
    </div>
  );
}
