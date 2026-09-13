# Bracket progression

Single-elimination slots form a protected directed graph using next-match and next-slot references. Only the database completion routine can copy a canonical winner into an empty downstream slot. Row locks and the empty-slot predicate prevent duplicate advancement during retries or races.

Byes are represented by an empty first-round participant slot and must be advanced by the server-side progression workflow. Unresolved disputes cannot advance. The final completed match determines champion and runner-up for the immutable competition snapshot.

A disputed original loses its downstream route when a rematch is ordered. The linked replacement inherits that route, and the guarded completion function prevents a `rematch_ordered` or `superseded` original from advancing. Concurrent rematch creation and bracket completion tests run 20 iterations each and permit exactly one replacement and one downstream slot assignment.

The generic builder supports 4, 6, 8, 12, and 16 entrants. A bye does not create a match or affect win statistics: its team is placed directly into the correct downstream slot and BRACKET_BYE_ADVANCED is audited. The resulting bracket always contains entrants minus one playable matches.

Double elimination is deferred and is not advertised as implemented.

Phase 06C validation covers round robin, 8-team groups-to-knockout cross-seeding, 8-team elimination, and 6-team elimination with byes. Persisted `group_knockout_seed_mappings` are the source of truth for public bracket slots.
