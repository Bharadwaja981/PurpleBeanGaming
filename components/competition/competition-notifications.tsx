"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";

type Notice = {
  id: string;
  event_type: string;
  read_at: string | null;
  created_at: string;
};

export function CompetitionNotifications({ notices }: { notices: Notice[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function markRead(id: string) {
    const { error } = await createClient().rpc("mark_competition_notification_read", {
      p_notification_id: id,
    });
    setMessage(error ? "Unable to mark notification read." : "Notification marked read.");
    if (!error) router.refresh();
  }

  return (
    <section aria-label="Competition notifications">
      <h2 className="text-xl font-bold">Notifications</h2>
      <div className="mt-3 space-y-2">
        {notices.length === 0 ? <p className="muted">No notifications yet.</p> : null}
        {notices.map((notice) => (
          <Card className="flex items-center justify-between gap-3 p-4" key={notice.id}>
            <div>
              <strong>{notice.event_type.replaceAll("_", " ")}</strong>
              <p className="muted text-sm">{new Date(notice.created_at).toLocaleString()}</p>
            </div>
            {notice.read_at ? (
              <span className="muted text-sm">Read</span>
            ) : (
              <button className="rounded border px-3 py-2" onClick={() => markRead(notice.id)}>
                Mark read
              </button>
            )}
          </Card>
        ))}
      </div>
      {message ? <p className="mt-2 text-sm" role="status">{message}</p> : null}
    </section>
  );
}
