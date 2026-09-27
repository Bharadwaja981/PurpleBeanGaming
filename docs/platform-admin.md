# Platform administration

PurpleBeanGaming separates global operations from tournament organization. `platform_admins` is the canonical membership table: super admins manage roles and configuration, platform moderators handle reports/cases/sanctions, and support agents see only support resources. Tournament organizer membership never grants a platform role.

Every server action or RPC must re-authorize; hiding navigation is not a security boundary. High-impact changes require explicit confirmation, and admin impersonation is intentionally unavailable. The dashboard exposes operational aggregates without infrastructure secrets.

Maintenance mode preserves safe public reads and admin access while the database rejects critical participant mutations. Only a super admin can toggle it, using the confirmation token required by `set_platform_config`.

The Phase 08B browser console exposes role management, organizer review, announcements, configuration, and operational queues. Audit search uses URL-preserved server filters for actor, event, tournament, entity, and date, with explicit page size and previous/next navigation. Payload JSON is deliberately omitted from the browser DTO.
