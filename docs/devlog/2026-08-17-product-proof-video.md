# Automated product proof video

> **Status:** CURRENT / RUNBOOK
> **Date:** 2026-08-17
> **Scope:** Playwright proof-video artifact for repeatable visual evidence of a tested SkillStorm flow.

## Purpose

The normal scenario suite keeps video only on failure. A dedicated product-proof scenario records one curated, deterministic successful flow so CI produces a reviewable video tied to the exact commit under test.

## Current proof flow

`client/tests/scenarios/product-proof-video.scenario.ts`

The first proof video covers Algorithm Lab → Broken Loop:

1. run an intentionally broken loop,
2. inspect trace evidence,
3. reject an unsupported hypothesis,
4. select the evidence-backed diagnosis,
5. repair the loop,
6. re-run successfully,
7. fail a changed transfer case,
8. solve the transfer case and reveal mastery evidence.

This is visual regression evidence, not a claim that the entire Informatics vertical is production-certified. The scenario currently exercises the same scenario-stack backend/frontend used by the real-browser suite; it does not replace the future unmocked teacher → student → persistence certification flow required by the Interactive Curriculum Production Contract.

## Artifact

The scenario writes a stable file:

`client/test-results/proof-videos/skillstorm-broken-loop-proof.webm`

GitHub Actions uploads it as:

`skillstorm-product-proof-videos`

Retention: 14 days.

## Rule

Proof videos supplement assertions. A video that looks correct must never replace machine assertions, persistence/reconnect tests, RBAC checks, or production-contract release gates.
