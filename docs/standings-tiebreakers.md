# Standings and tiebreakers

Standings derive exclusively from canonical completed or forfeited matches. Win, loss, games won, games lost, game difference, and configured points are recalculated from match results; no standings table is client-editable.

The configured default order is points, head-to-head, game difference, games won, then stable team name. Two-team ties use their completed head-to-head result where available. Multi-team ties use the completed matches among the tied teams as a mini-table before the remaining configured criteria. A later correction is made through audited dispute resolution and therefore recalculates the table from its source.

Each configured metric becomes one element of a lexicographically compared numeric sort key. Head-to-head points are calculated only from completed matches against teams in the same points cohort, giving mini-table behavior for multi-team ties. Identical configured sort keys are marked TIEBREAK_REQUIRED; the team-name display fallback never authorizes qualification.

Dedicated two-team fixtures verify all three boundary cases: head-to-head resolves equal points when available; game difference resolves when head-to-head is tied or unavailable; and equality across every configured metric returns `TIEBREAK_REQUIRED`. An unresolved qualification tie cannot create qualifiers or knockout slots.
