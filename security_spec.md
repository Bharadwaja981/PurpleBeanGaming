# Purple Bean Gaming — Security Specification

## 1. Data Invariants
1. **Default Deny:** All unspecified document paths are inaccessible (`match /{document=**} { allow read, write: if false; }`).
2. **Public Read-Only Data:** Tournaments, published matches, teams, and public player profiles are viewable by all users (including unauthenticated spectators).
3. **Admin & Organizer Access:** Organizers or Superadmins can mutate tournaments, update status stages, and seed teams. Admin status is validated via `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` or bootstrapped admin email `11106cm009@gmail.com`.
4. **Registration Identity:** Players can only register with their own `request.auth.uid`. Registrations cannot self-approve; only organizers or admins can mark status as 'approved'.
5. **Auction Integrity:** Captains can only bid if authenticated. Bids must strictly increment and identify the bidding captain's verified user ID.
6. **Dispute Access:** Disputes can be created by team captains or players involved in the match. Only organizers/referees can resolve or dismiss disputes.
7. **Document ID Safety:** All target document IDs must satisfy `isValidId(id)` (`id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
8. **Temporal Integrity:** Mutations enforce strict server timestamps (`request.time`) or immutable creation timestamps.

---

## 2. The Dirty Dozen Payloads (Security Attack Vectors)
1. **Ghost Field Poisoning:** An attacker attempts to submit a registration containing an unauthorized `approved: true` field.
2. **Identity Spoofing in Registration:** An attacker submits a player registration where `userId` does not match `request.auth.uid`.
3. **Self-Promotion to Admin:** A user attempts to create a document in `/admins/{uid}` claiming `role: "superadmin"`.
4. **Unauthorized Tournament Deletion:** A standard player attempts to delete a tournament.
5. **Negative/Zero Bid Injection:** A captain submits a bid with amount `<= 0` or NaN.
6. **Bypassing Document ID Limits:** An attacker creates a document with a 2KB junk character ID string.
7. **Tampering With Match Winner:** An unverified spectator sends an update to `/matches/{matchId}` setting `winnerTeamId` without organizer privileges.
8. **Terminal State Mutation:** Attempting to alter results or auction states of an already `completed` tournament without admin override.
9. **Fake Server Timestamp:** A user submits an update passing a forged historical timestamp string instead of server timestamp.
10. **Arbitrary Team Credit Injection:** A captain modifies team budget directly in `/teams/{teamId}` without going through the auction room.
11. **Dispute Self-Resolution:** A participant creates a dispute and immediately sets `status: "resolved"` in their own favor.
12. **Unauthenticated Write:** An unauthenticated request attempts to create or update any record.
