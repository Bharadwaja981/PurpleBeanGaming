# PurpleBeanGaming database schema

Integer columns represent MMR and credits. Historical roster rows snapshot tournament MMR. Partial uniqueness prevents a player from occupying two active teams. Bid request IDs are globally unique.

```mermaid
erDiagram
  PROFILES ||--o{ TOURNAMENT_MEMBERS : joins
  TOURNAMENTS ||--o{ TOURNAMENT_MEMBERS : has
  TOURNAMENT_MEMBERS ||--o{ TOURNAMENT_MEMBER_ROLES : grants
  TOURNAMENTS ||--o{ TOURNAMENT_PLAYERS : registers
  TOURNAMENTS ||--o{ TEAMS : contains
  TEAMS ||--o{ TEAM_ROSTER : fields
  TOURNAMENT_PLAYERS ||--o{ TEAM_ROSTER : assigned
  TOURNAMENTS ||--|| TOURNAMENT_RULES : configures
  TOURNAMENTS ||--o{ NOMINATION_ORDER : orders
  TOURNAMENTS ||--o{ AUCTIONS : runs
  AUCTIONS ||--o{ BIDS : receives
  TOURNAMENT_PLAYERS ||--o{ SCOUTING_ENTRIES : scouted
  TOURNAMENT_PLAYERS ||--o{ RATING_REVIEWS : reviewed
  TOURNAMENT_PLAYERS ||--o{ APPEALS : raises
  TOURNAMENTS ||--o{ SUBSTITUTIONS : controls
  TOURNAMENTS ||--o{ AUDIT_EVENTS : records
```

The public API is limited to `public_tournament_summary`, `public_player_pool`, `public_teams`, and `public_auction_state`. Internal tables remain subject to RLS.
