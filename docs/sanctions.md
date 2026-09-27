# Sanctions and appeals

Sanctions are durable records with a scope, type, reason, start, optional expiry, issuer, and revocation metadata. Supported scopes are platform, tournament, registration, captain access, and organizer access. Historical tournament data is never deleted by a sanction.

Active means the record is enabled, not revoked, started, and unexpired. Enforcement occurs in database authorization and mutation paths. Organizers can never issue global sanctions; global bans require a super admin and explicit confirmation.

The sanctioned user may submit one appeal per sanction. Eligible moderators resolve it, preferably someone other than the original issuer for serious actions. Approval revokes the sanction through an audited transition—never a silent edit.
