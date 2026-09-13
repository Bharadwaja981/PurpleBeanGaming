# Match workflow

The canonical flow is scheduled or rescheduled → check-in → ready → live → awaiting confirmation → completed. A disagreement changes the match to disputed. Forfeit and cancellation are explicit terminal states.

Captains may check in only their own participating team during the database-time window and may confirm only rostered lineups of the configured size. Officials can override check-in or start only through audited RPCs. A browser timer never awards a forfeit.

A captain's result submission is append-only and requires the opposing captain's confirmation. A dispute blocks completion and bracket progression until a tournament-scoped organizer or referee resolves it. Request IDs make sensitive retries idempotent.

Scores are submitted relative to the submitting team and normalized to canonical team-A/team-B order. Concurrent equivalent submissions confirm one result; conflicting submissions preserve both reports and create one dispute. Match row locks serialize confirm-versus-dispute, so a completed result cannot be reopened.

Completion writes an immutable match snapshot containing stage, round, best-of, frozen team names/tags, frozen lineup display identities, canonical score, winner, status, and completion time.

Ordering a rematch preserves the disputed original, its submission, dispute, schedule, and snapshot. The original becomes `rematch_ordered`; a new match receives its own ID and `rematch_of_match_id`, schedule, check-in, lineup, and result lifecycle. Only the replacement inherits the downstream route. When it completes, the original becomes `superseded` and links through `superseded_by_match_id`. The transitions emit `REMATCH_ORDERED`, `REMATCH_CREATED`, and `MATCH_SUPERSEDED` audit events.
