# Moderation operations

Reports are private submissions. A reporter can see their own workflow status, but reported users cannot see the report, reporter identity, evidence path, moderator notes, or assignment. Moderators convert reports into canonical cases and append notes; notes are not editable.

Case resolution uses a revision value so concurrent reviewers cannot both commit a terminal resolution. Every case creation and resolution is audited. Abuse signals are review prompts only and never trigger automatic punishment.

Evidence belongs in the private `moderation-evidence` bucket under the reporter's user-ID prefix. Access is limited to that owner and authorized platform moderators; public listing is disabled.

The browser workflow is report submission → moderator case creation → append-only internal note → scoped sanction → user appeal → eligible reviewer resolution. User-facing pages expose only the safe sanction reason and never the reporter, assignment, case summary, or notes.
