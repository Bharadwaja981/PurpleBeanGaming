# PurpleBeanGaming security model

Every public-schema base table has RLS enabled. Policies default to no access. Tournament administration always checks an active organizer role for the row's tournament. Player-controlled registration is permitted only during registration, and a trigger rejects changes to verified/rating/eligibility/draft fields. Teams, rosters, auctions, bids, and audit history have no normal client mutation policy.

Captain scouting is owner-only—even organizers receive no implicit access. Rating reviews are visible to their author and tournament organizers, never peer captains. Appeals are visible to the player and organizer; public views omit evidence. Spectators receive narrow, read-only views without user IDs, reviewer identities, evidence, or private operational payloads.
