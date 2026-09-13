"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createReportAction, createSupportTicketAction } from "@/app/platform-user-actions";
import { appealSanctionAction } from "@/app/account-operations-actions";

export function ReportForm() {
  const [message, setMessage] = useState("");
  async function submit(data: FormData) {
    const reported = String(data.get("reportedUserId") ?? "").trim();
    const result = await createReportAction({ reportedUserId: reported, type: String(data.get("type")), reason: String(data.get("reason")), description: String(data.get("description")) });
    setMessage("error" in result ? result.error : "Report submitted privately for review.");
  }
  return <form action={submit} className="card mt-6 grid gap-4 p-5"><label className="text-sm">Report type<select name="type" className="mt-2 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[#081016] px-3">{["harassment","cheating","smurfing","account_sharing","false_information","no_show","unsportsmanlike_conduct","organizer_misconduct","spam","other"].map(x => <option key={x}>{x}</option>)}</select></label><label className="text-sm">Reported user ID (optional)<Input className="mt-2" name="reportedUserId" /></label><label className="text-sm">Short reason<Input className="mt-2" name="reason" required minLength={3} /></label><label className="text-sm">What happened?<textarea className="mt-2 min-h-32 w-full rounded-lg border border-[var(--line)] bg-[#081016] p-3" name="description" required minLength={10} /></label><p className="muted text-xs">Reports are confidential. Deliberately false reports may themselves be reviewed.</p><Button className="w-fit">Submit report</Button>{message && <p aria-live="polite" className="text-sm text-[var(--accent)]">{message}</p>}</form>;
}

export function SupportForm() {
  const [message, setMessage] = useState("");
  async function submit(data: FormData) {
    const result = await createSupportTicketAction({ category: String(data.get("category")), subject: String(data.get("subject")), message: String(data.get("message")) });
    setMessage("error" in result ? result.error : "Support ticket created.");
  }
  return <form action={submit} className="card mt-6 grid gap-4 p-5"><label className="text-sm">Category<select name="category" className="mt-2 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[#081016] px-3">{["account","tournament","technical","bug","moderation","other"].map(x => <option key={x}>{x}</option>)}</select></label><label className="text-sm">Subject<Input className="mt-2" name="subject" required minLength={3} /></label><label className="text-sm">Message<textarea className="mt-2 min-h-32 w-full rounded-lg border border-[var(--line)] bg-[#081016] p-3" name="message" required minLength={5} /></label><Button className="w-fit">Create ticket</Button>{message && <p aria-live="polite" className="text-sm text-[var(--accent)]">{message}</p>}</form>;
}

export function SanctionAppealForm({ sanctionId }: { sanctionId: string }) {
  const [message, setMessage] = useState("");
  async function submit(data: FormData) { const result = await appealSanctionAction(sanctionId, String(data.get("reason") ?? "")); setMessage("error" in result ? result.error : "Appeal submitted."); }
  return <form action={submit} className="mt-3 flex flex-col gap-2 sm:flex-row"><Input name="reason" required minLength={10} placeholder="Explain why this should be reviewed" /><Button variant="secondary">Appeal</Button>{message && <span className="text-sm text-[var(--accent)]">{message}</span>}</form>;
}
