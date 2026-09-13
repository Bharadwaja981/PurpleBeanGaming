"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { appealSanctionAction, deactivateAccountAction, replyTicketAction, ticketStatusAction } from "@/app/account-operations-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TicketActions({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function reply(data: FormData) {
    const result = await replyTicketAction(ticketId, String(data.get("message") ?? ""));
    setMessage("error" in result ? result.error : "Reply sent.");
    if ("ok" in result) router.refresh();
  }
  async function update(action: "close" | "reopen") {
    const result = await ticketStatusAction(ticketId, action);
    setMessage("error" in result ? result.error : `Ticket ${action === "close" ? "closed" : "reopened"}.`);
    if ("ok" in result) router.refresh();
  }
  return <div className="card mt-6 p-5"><form action={reply} className="flex flex-col gap-3 sm:flex-row"><Input name="message" required minLength={2} placeholder="Add a reply"/><Button>Reply</Button></form><div className="mt-3 flex items-center gap-3">{status === "closed" ? <Button type="button" variant="secondary" onClick={() => update("reopen")}>Reopen</Button> : <Button type="button" variant="secondary" onClick={() => update("close")}>Close</Button>}{message && <span aria-live="polite" className="text-sm text-[var(--accent)]">{message}</span>}</div></div>;
}

export function DeactivateAccount() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(data: FormData) {
    const result = await deactivateAccountAction(String(data.get("confirmation") ?? ""), String(data.get("reason") ?? ""));
    setMessage("error" in result ? result.error : "Account deactivated.");
    if ("ok" in result) router.refresh();
  }
  return <form action={submit} className="card mt-6 grid gap-3 p-5"><h2 className="text-xl font-bold">Deactivate account</h2><p className="muted text-sm">This signs you out of active participation. Reactivation requires support review.</p><Input name="reason" required minLength={5} placeholder="Reason"/><Input name="confirmation" required placeholder="Type DEACTIVATE to confirm"/><Button className="w-fit" variant="danger">Deactivate</Button>{message && <p aria-live="polite" className="text-sm text-[var(--accent)]">{message}</p>}</form>;
}

export function SanctionAppealForm({ sanctionId }: { sanctionId: string }) {
  const [message, setMessage] = useState("");
  async function submit(data: FormData) { const result = await appealSanctionAction(sanctionId, String(data.get("reason") ?? "")); setMessage("error" in result ? result.error : "Appeal submitted."); }
  return <form action={submit} className="mt-3 flex flex-col gap-2 sm:flex-row"><Input name="reason" required minLength={10} placeholder="Explain why this should be reviewed"/><Button variant="secondary">Appeal</Button>{message && <span aria-live="polite" className="text-sm text-[var(--accent)]">{message}</span>}</form>;
}
