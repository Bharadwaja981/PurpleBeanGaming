import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicDraftNav } from "@/components/draft/public-nav";
import { CompetitionLiveRefresh } from "@/components/competition/competition-live-refresh";
import { Card } from "@/components/ui/card";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params,
    q = await searchParams,
    s = await createClient();
  const { data: t } = await s
    .from("public_tournament_summary")
    .select("id,name")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) notFound();
  let query = s
    .from("public_matches")
    .select("*")
    .eq("tournament_id", t.id!)
    .order("scheduled_at")
    .limit(100);
  if (q.stage) query = query.eq("stage_id", q.stage);
  if (q.group) query = query.eq("group_id", q.group);
  if (q.team)
    query = query.or("team_a_id.eq." + q.team + ",team_b_id.eq." + q.team);
  if (q.status) query = query.eq("status", q.status as never);
  if (q.date)
    query = query
      .gte("scheduled_at", q.date + "T00:00:00Z")
      .lt("scheduled_at", q.date + "T23:59:59Z");
  const { data: matches } = await query;
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 p-4 py-10 md:p-8">
      <CompetitionLiveRefresh tournamentId={t.id!} />
      <PublicDraftNav slug={slug} />
      <header>
        <p className="text-sm uppercase tracking-[.2em] text-[var(--accent)]">
          Competition
        </p>
        <h1 className="mt-2 text-3xl font-bold">{t.name} Schedule</h1>
      </header>
      <form className="grid gap-3 rounded-xl border border-[var(--line)] p-4 sm:grid-cols-3">
        <label>
          Status
          <select
            name="status"
            defaultValue={q.status ?? ""}
            className="mt-1 w-full rounded bg-[#081016] p-2"
          >
            <option value="">All</option>
            {[
              "scheduled",
              "check_in",
              "ready",
              "live",
              "awaiting_confirmation",
              "disputed",
              "rematch_ordered",
              "superseded",
              "completed",
              "forfeit",
              "cancelled",
              "rescheduled",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            name="date"
            type="date"
            defaultValue={q.date}
            className="mt-1 w-full rounded bg-[#081016] p-2"
          />
        </label>
        <button className="self-end rounded bg-[var(--accent)] px-4 py-2 font-semibold text-black">
          Filter
        </button>
      </form>
      <div className="space-y-3">
        {(matches ?? []).map((m) => (
          <Card className="grid gap-3 p-5 sm:grid-cols-[1fr_auto]" key={m.id}>
            <div>
              <p className="text-xs uppercase text-[var(--muted)]">
                {m.stage_name}
                {m.group_name ? " · " + m.group_name : ""} · Round{" "}
                {m.round_number}
              </p>
              <Link
                className="mt-1 block text-lg font-bold hover:text-[var(--accent)]"
                href={"/tournaments/" + slug + "/matches/" + m.id}
              >
                {m.team_a_name ?? "TBD"} vs {m.team_b_name ?? "TBD"}
              </Link>
              <p className="muted text-sm">
                {m.scheduled_at
                  ? new Date(m.scheduled_at).toLocaleString()
                  : "Time TBD"}{" "}
                · Best of {m.best_of}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="font-semibold">
                {m.team_a_score ?? "–"} : {m.team_b_score ?? "–"}
              </p>
              <p className="text-sm uppercase">
                {(m.status ?? "scheduled").replaceAll("_", " ")}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
