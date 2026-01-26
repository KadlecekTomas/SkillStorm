# README_ADVANCED.md

This file captures non-MVP concepts that are intentionally deferred, but are required for long-term correctness, trust, and extensibility.

## 1) Workspace and Organization Model (future)
- Introduce an explicit Workspace table with types: SYSTEM, SCHOOL, COMPETITION.
- Keep Organization as a school entity; do not overload it for personal workspaces.
- Store last_active_workspace_id per user for deterministic login context.
- Add workspace_memberships with roles scoped to workspace type.

Rationale: prevents semantic overload (personal vs school), enables competition layer without hacks, and avoids implicit context switching.

## 2) Invitations and Join Codes
- Replace orgId-based join with explicit invite codes:
  - short-lived join tokens with max uses
  - role preselection and optional approval flow
- Invite link format: /join/<token>
- Admin can revoke tokens and view audit history.

Rationale: orgId is not a safe or explainable join code; invites must be auditable.

## 3) Regional and External Analytics
- Aggregation tiers: School -> District -> Region -> National.
- All aggregated analytics are anonymized by default:
  - minimum group sizes
  - suppression of outliers
- Export endpoints provide only aggregated data, never student-level data.

Rationale: protects privacy and supports policy-level reporting.

## 4) Competition (Olympiads) Layer
- Competition is a separate domain:
  - competition_id, season, organizer, ruleset, consent requirements
  - participants can be from multiple schools or individual users
- Metrics:
  - percentiles, achievement tiers, participation rates
  - no class averages from competitions
- UI separation:
  - competition dashboards do not blend into school grading views

Rationale: competitions are enrichment, not grading; mixing them biases evaluation.

## 5) Data Export and Integrations
- Export formats: CSV, JSON, and anonymized aggregates.
- Per-export audit log with actor, scope, and data categories.
- Webhooks for external systems (SIS, LMS, competitions).
- Rate-limited public API with per-tenant API keys.

Rationale: supports ecosystem integration while preserving auditability.

## 6) Long-term Progress Model
- Progress is computed per subject, per academic year, per student:
  - mastery by topic level
  - improvement trajectory over time
  - gaps vs curriculum expectations
- Store computed snapshots per term for fast comparisons.

Rationale: enables longitudinal analytics without recomputing historical data.

## 7) Parent Access Policy
- Parent view is read-only and does not expose peer comparisons.
- Parent access is tied to verified guardian relationships.
- Sensitive categories (behavioral, special needs) are excluded by default.

Rationale: keeps parent signals actionable without exposing harmful comparisons.

## 8) Audit and Compliance
- Extend audit log to include:
  - export actions
  - invitation lifecycle
  - access denials
- Add retention policies and GDPR export request handling.

Rationale: schools require defensible compliance trails.

## 9) Multi-tenant Performance
- Use per-organization versioned caches for list endpoints.
- Add read-optimized materialized views for:
  - class results, subject trends, cohort comparisons
- Partition large analytics tables by academic year.

Rationale: keeps performance stable as data grows.

