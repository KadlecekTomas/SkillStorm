# D3 Interactive IT Lab — implementation progress

> Status: CURRENT implementation note under `docs/roadmap/master.md`.
> Updated: 2026-08-09.

## Current vertical slice

The first Build a PC classroom slice is merged in PR #51: solo gameplay, classroom-aware student mode, server-authoritative session controls, semantic events, Mission Control and browser proof.

## Current increment — misconception aggregation

This branch closes the next explicit D3 gap from the master roadmap and Interactive IT Lab vision:

- emit `PLACEMENT_REJECTED` as a privacy-safe semantic event;
- emit `HINT_REQUESTED` when a student explicitly opens diagnostic help;
- aggregate server-side Build a PC events into class progress, intervention priority and misconception clusters;
- expose a teacher-only, host-only analytics projection;
- surface the top misconception and students needing attention in Mission Control;
- keep the privacy invariant: no pointer/cursor/frame/screen/raw media telemetry;
- keep completion distinct from mastery (`POST_OK` remains completion evidence only).

## D3 exit-gate status after this increment

- [ ] real class can complete the activity flow — requires pilot evidence, not code-only proof;
- [x] teacher can identify a misconception cluster from semantic events;
- [x] no pointer/frame streaming;
- [x] reconnect/idempotency foundation remains inherited from D2-C;
- [ ] first reusable capabilities are proven outside the PC-specific renderer;
- [ ] whole-year content pack has machine-mappable RVP/ŠVP path validated end-to-end.

## Next step

Do not start another showcase game yet. After this increment is green, continue D3 with the highest-risk remaining exit-gate item: machine-mappable IT year-pack / curriculum path and reusable capability extraction, then pilot the Build a PC flow with a real class.
