# SkillStorm — AI-Assisted Development Workflow

> **Status:** `CURRENT / RUNBOOK`  
> **Owner:** Engineering + Product  
> **Last verified:** 2026-08-07  
> **Scope:** how humans and coding agents collaborate on SkillStorm without bypassing architecture, security, Git or evidence gates  
> **Authority:** this workflow is subordinate to [`README.md`](./README.md), [`roadmap/master.md`](./roadmap/master.md), security/privacy contracts and executable repository configuration.

---

## 0. Principle

SkillStorm uses AI coding tools as implementation accelerators, not as sources of product authority.

The workflow is intentionally **tool-neutral**. Claude Code, Codex or another capable coding agent may execute a task, but the repository contracts, current code, tests and reviewed decisions remain the source of truth.

---

# 1. Division of responsibility

## Human owner

Owns:

- product intent;
- classroom reality;
- irreversible architecture decisions;
- privacy/security risk acceptance;
- scope and prioritization;
- review of evidence and user-visible behavior.

## Reasoning/planning assistant

May help:

- translate a product goal into implementation invariants;
- identify risks and dependencies;
- draft acceptance criteria/test matrices;
- challenge assumptions;
- reconcile current code with documentation.

It does not supersede repository truth.

## Coding agent

May:

- inspect the repository;
- implement a scoped change;
- create migrations/tests;
- run verification;
- report findings;
- prepare commits/PRs according to the task.

It must not invent missing product authority or silently widen scope.

---

# 2. Context lives in versioned sources

A new implementation session should start from current repository context, for example:

```text
Read docs/README.md.
Follow docs/roadmap/master.md for priority.
For Interactive Curriculum obey PRODUCTION-CONTRACT.md and CURRICULUM-DATA-CONTRACT.md.
Inspect current code/schema/tests before changing anything.
```

Do not rely on an old chat transcript, stale prompt or historical audit as the primary source of truth.

### Current precedence

Use [`docs/README.md`](./README.md) for the complete hierarchy.

In short:

```text
security/privacy/tenant invariants
→ normative production/data contracts
→ Master Roadmap
→ current implementation contracts
→ approved vision/design docs
→ task-specific instructions
→ historical snapshots (context only)
```

A prompt cannot legitimately override a higher-precedence safety/architecture contract without an explicit reviewed contract change.

---

# 3. Anatomy of a strong implementation task

A coding task should state:

```text
GOAL
What observable product/engineering outcome is required?

SCOPE
Which domain/files/workflow are in scope?

CURRENT SOURCE OF TRUTH
Which docs/code/tests must be read first?

INVARIANTS
What must not regress? Include tenant, privacy, accessibility and data-history rules.

ACCEPTANCE CRITERIA
What must be true when finished?

EVIDENCE
Which tests, screenshots, DB checks, network checks or diffs prove it?

OUT OF SCOPE
What must not be started in this change?

GIT CONTRACT
Target branch/base; commit/PR expectations; no destructive history rewrite unless explicitly authorized.
```

The task should not freeze implementation details that the repository proves are already different unless changing those details is itself the goal.

---

# 4. Inspect before editing

Before implementation, the agent should establish:

```text
current branch / worktree
working tree state
relevant schema/migrations
current API/data path
existing tests
current documentation status/precedence
dependent or overlapping active changes
```

If the prompt conflicts with the repository, report the conflict and implement the safest scope consistent with the authoritative contract rather than blindly reproducing stale instructions.

---

# 5. Irreversible vs. reversible decisions

Require explicit human review for high-impact decisions such as:

- destructive migrations;
- tenant/RBAC model changes;
- identity/authentication architecture;
- privacy/retention changes;
- curriculum provenance/versioning semantics;
- public API/event contracts that are expensive to migrate;
- deletion of user/content history;
- paid/child-facing commerce mechanics.

Routine implementation inside an already approved contract can proceed autonomously within scope.

### Unexpected design decision

Do not hide it in code.

Record:

```text
problem
options considered
chosen temporary/permanent decision
why
what evidence supports it
whether a human decision is still required
```

Promote lasting decisions into the appropriate current contract/ADR rather than leaving them only in a task report.

---

# 6. Evidence, not reassurance

Statements such as:

```text
"tests pass"
"looks fine"
"tenant-safe"
"production ready"
```

are not sufficient by themselves.

Useful evidence depends on the claim:

| Claim | Expected evidence |
| --- | --- |
| tenant isolation | real two-tenant negative backend E2E |
| no solution leak | server/API/network assertion before reveal |
| migration safe | migrated disposable DB + invariant tests + rollback/deploy reasoning |
| UI works | real-browser scenario/screenshots at relevant viewports/input modes |
| concurrency safe | overlapping requests + persisted DB truth |
| no accidental file scope | `git diff --stat` / changed-file review |
| restore works | successful restore drill + application smoke test |
| curriculum claim | authoritative source + approved versioned mapping/evidence path |

The evidence must test the failure mode, not merely the happy path.

---

# 7. Git discipline

For material work:

- use the intended feature/fix branch;
- inspect existing uncommitted work before editing;
- do not mix unrelated refactors/features;
- commit coherent verified increments;
- do not use stash as long-term storage;
- avoid force-push/history rewrite unless explicitly required and safe;
- open/review a PR before merging protected work;
- update documentation/contracts in the same PR when behavior changes.

One change should be reviewable as one story.

---

# 8. Test discipline

Do not fix a deterministic failure with repeated reruns, arbitrary sleeps or inflated timeouts unless the root cause genuinely requires timing tolerance.

When a test fails:

1. reproduce;
2. determine whether code, fixture, test, environment or infrastructure is wrong;
3. fix the cause;
4. preserve or improve intended coverage;
5. rerun the relevant narrow test;
6. run the wider gate required by the domain.

A skipped/quarantined test is not release evidence unless the release contract explicitly excludes it with replacement coverage.

---

# 9. Database safety

Any destructive automated test operation must obey [`testing/test-database-isolation.md`](./testing/test-database-isolation.md).

Never ask an agent to bypass the database safety guard for convenience.

Production restore uses the dedicated [`ops/backup-restore.md`](./ops/backup-restore.md) procedure, not test tooling.

---

# 10. Documentation discipline

After a change, ask:

```text
Did this alter a normative invariant?
Did this alter current implementation behavior?
Did this alter the Master Roadmap order?
Did this invalidate an old design/audit?
Did this add a new human-authored Markdown file?
```

Then update the correct source of truth and documentation registry in the same PR.

Run:

```bash
npm run docs:validate
```

before calling documentation work complete.

---

# 11. Report format

A useful implementation report is concise but evidence-based:

```text
VERDICT
READY / BLOCKED / PARTIAL

CHANGED
What changed and why.

VERIFIED
Exact tests/checks and results.

NOT VERIFIED / RISKS
Anything that remains uncertain.

GIT
Branch, commit(s), PR, working-tree status.

FOLLOW-UP
Only concrete work that is actually required next.
```

Do not bury a security failure, red CI job or destructive side effect in a footnote.

---

# 12. Anti-patterns

| Anti-pattern | Why it is dangerous | Preferred approach |
| --- | --- | --- |
| "rewrite everything" | unreviewable blast radius | scoped phases/PRs |
| context only in prompts | drift across sessions/tools | versioned repo docs |
| feature + unrelated refactor | hides causality/regressions | separate reviewable changes |
| repeated retry until green | masks deterministic defects | root-cause analysis |
| trusting client tenant IDs | security bug | server-resolved tenant scope |
| claiming future blueprint as implemented | product/docs drift | explicit `CURRENT` vs `VISION` |
| schema invented from an old document | migrations against stale assumptions | inspect current Prisma/migrations first |
| AI says "production ready" without evidence | confidence is not proof | defined production gate |

---

## Final invariant

> **AI may accelerate SkillStorm engineering, but every consequential claim must remain grounded in current repository truth, explicit contracts and reproducible evidence.**