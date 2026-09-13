# External match import

Captains in the scheduled match, referees, and tournament organizers may link a positive numeric Dota match ID to a canonical game. Database uniqueness prevents one Dota match from attaching to unrelated games and prevents multiple external games from occupying one canonical game slot.

The background import normalizes match metadata and ten player slots, then reconciles account IDs against locked PurpleBeanGaming lineups and maps Radiant/Dire to canonical teams. States are `pending`, `matched`, `partial`, `participant_mismatch`, and `result_conflict`. External winners are evidence only; users still use the Phase 06 confirmation/dispute workflow for the canonical result. Corrections require authorization, reason, and audit history.

For a series, Game 1, Game 2, and Game 3 are independent canonical `match_games`, each with a unique external Dota match. Series scores continue to come from Phase 06 canonical results. A Dota match cannot be reused by another game or series.
