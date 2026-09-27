# Incident response

Severity: SEV-1 is active data/security loss or platform-wide outage; SEV-2 is major workflow degradation; SEV-3 is contained impact; SEV-4 is low-risk defect.

The incident lead records start time, impact, affected environments, safe request IDs, decisions, and owners. Contain first: disable the affected integration, revoke credentials, enable maintenance, or roll back only when appropriate. Never place tokens, private evidence, raw authorization headers, or sensitive user content in incident chat or tickets.

Recovery requires health/readiness checks, invariant tests for affected domains, backlog review, and a controlled user-flow smoke test. Close only after monitoring is stable. Produce a blameless review with timeline, root cause, detection gap, corrective actions, and deadlines.

Security/privacy incidents additionally require counsel and regulatory-notification assessment. Public communications must be factual and approved.
