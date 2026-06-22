# Luminar — v2 Improvements Plan

> Created 2026-06-22. Covers: nomenclature standardization, generation quality
> (scene/duration/quiz rules + better prompts), and a production-grade UI/UX
> overhaul. Builds on `docs/PLAN.md` (v1).

## 0. Decisions (confirmed)

1. **Nomenclature:** standardize everything to **luminar** — remove all legacy
   "video" naming across code **and** DB. (Audit found the DB is *already*
   video-free, so DB work is a separate clarity pass, not a video→luminar rename.)
2. **Design direction:** **learning-brand (Brilliant-style)** — polished, warm,
   colorful, light illustration, gentle gamification (progress/streaks), delightful
   micro-interactions. Motivating, not corporate.
3. **UI/UX scope:** **all surfaces** — watch/player, create flow, home/dashboard,
   landing + auth + profile.

### Assumptions to veto in one line (else I proceed as stated)

- **Duration targets** (total narration audio, @130 wpm):
  - 2-min → **2:00–2:30** (≥3 scenes/SVGs) · 260–325 words
  - 3-min → **3:00–3:40** (4–5 scenes/SVGs) · 390–477 words
  - 5-min → **5:00–5:50** (7–8 scenes/SVGs) · 650–758 words
- **Quiz counts** scale with scenes: **2-min → 3, 3-min → 5, 5-min → 8**
  (≈ one per scene, never gating after scene 1). Current is `{2:2, 3:4, 5:7}`.

---

## Workstream A — Nomenclature standardization (video → luminar) — ✅ DONE

**Goal:** one consistent vocabulary. Today the codebase mixes "video" and
"luminar"; "video" is legacy.

**Completed:** deleted pure aliases/dups (`models/video.py`, `schemas/video.py`,
`schemas/profile.py`, `api/v1/videos.py`); renamed `jobs/video_jobs.py` →
`luminar_jobs.py`, `VideoBlueprint` → `LuminarBlueprint`, ws_manager `video_id` →
`luminar_id`, profile API fields `total_videos/ready_videos/recent_videos` →
`*_luminars`; fixed dead deferred routers (social/export/rooms) off the deleted
alias; frontend removed `videoApi`/`VideoSchema`/`Video` type, `VideoStatus` →
`LuminarStatus`, `myVideos` → `myLuminars`, `LuminarCard` prop `video`→`luminar`,
and user-facing copy. **DB needed no changes (already video-free).** Real
YouTube-video identifiers in `data_extractor` correctly left alone. Verified:
backend imports (17 routes), `tsc`, `eslint` (0), `build`, and the e2e harness all
green.

### A1. Backend code
| Current | New |
|---|---|
| `app/jobs/video_jobs.py` | `app/jobs/luminar_jobs.py` |
| `generate_script_job` / `generate_assets_job` | keep (already luminar-centric) |
| `VideoBlueprint` (orchestrator) | `LuminarBlueprint` |
| `app/models/video.py` (`Luminar as Video` alias) | **delete** the alias module |
| any `video`-suffixed vars/comments | `luminar` |

### A2. Frontend code
| Current | New |
|---|---|
| `videoApi` (alias in `lib/api.ts`) | **delete**; callers use `luminarApi` |
| `myVideos`, `video_id` shim | `myLuminars`, `luminar_id` |
| `VideoStatus` (generating route) | `LuminarStatus` |
| `VideoSchema` / `Video` type (schemas) | **delete** alias; use `Luminar` |
| `onFavoriteToggle(videoId, …)` (LuminarCard) | `(luminarId, …)` |

### A3. Database — clarity audit (NOT video→luminar; DB is already clean)
- The schema has **zero** `video`-named tables/columns. So no video migration.
- Separate, optional **naming-clarity audit**: I'll produce a short list of any
  columns whose names are ambiguous and propose renames **for your approval
  before** touching prod. Each approved rename = a reversible Alembic migration
  (`ALTER … RENAME`), applied to prod with the same safe, verified flow used for
  `0002` (inspect → transactional apply → verify). **No speculative DB renames.**

### A4. Execution
- Mechanical rename pass; rely on `tsc`, `eslint`, backend import check, and the
  Playwright harness to catch breakage. Update `routeTree.gen.ts` consumers via
  types, not hand edits. Update `CLAUDE.md` references.
- Low risk, high churn → **do this FIRST** so later work isn't rewritten.

---

## Workstream B — Generation quality — ✅ DONE (code); prompt tuning needs a real gen

**Completed:** new `app/core/luminar_spec.py` is the single source of truth
(2-min: 3–4 scenes / 2:00–2:30 / 3Q · 3-min: 4–5 / 3:00–3:40 / 5Q · 5-min: 7–8 /
5:00–5:50 / 8Q). Phase 1 now **enforces** scene count (corrective retry → clamp)
and **targets total duration** via a word budget (corrective retry if out of
range). `quiz_count_for_duration` reads the spec. Rewrote the orchestrator
(pedagogical arc), script (word budget + concrete VISUAL_CUEs), and SVG-animator
(staggered-to-narration, production-grade visuals, viewBox) prompts. Backend
imports clean; spec math verified. **Prompt *quality* can only be judged by a real
generation (OpenAI spend) — defer that tuning to when you want to spend.**

### (original plan below)

The orchestrator already *suggests* the right scene counts but nothing
**enforces** them, there's **no total-duration target**, and prompts are thin.

### B1. Enforce structure (scenes = animated SVGs)
- Pass explicit targets into the orchestrator and **validate the blueprint**:
  scene count within the tier's range; if not, one bounded re-ask or clamp.
  Reject "2 scenes for a 2-min" — minimum 3.
- Since one SVG is generated per scene, enforcing scene count enforces SVG count.

### B2. Duration targeting (the 2:00–2:30 requirement)
- Give the **script agent a word budget** per luminar (derived from tier, see §0)
  and instruct it to distribute across scenes.
- After Phase 1, **validate** `sum(estimated_duration_ms)` falls in the tier
  range; if short/long, one corrective regen (or per-scene trim/expand).
- After Phase 2, the *actual* total is known from TTS — surface it; if wildly out
  of range, flag (it shouldn't be if Phase-1 budgeting holds).

### B3. Better prompts
- **Script prompt rewrite**: explicit pedagogy arc (hook → build → worked example
  → recap), "speak to *you*", jargon control, stronger and more *specific*
  `[VISUAL_CUE:…]` directions (drive richer SVGs), better dialogue-scene rules,
  and the word budget. Keep structured `caption_segments` timing.
- **SVG animator prompt rewrite** for "industry-standard" visuals: clearer layout
  guidance, the educational palette, multiple coordinated `@keyframes`, legible
  type sizes, no overlap, safe margins — and **stagger reveals to match narration
  beats** (so the animation tracks the audio, not just fades in once).
- **Orchestrator prompt**: tighten visual_style selection + quiz-gate placement.

### B4. Quiz scaling
- Update `QUESTIONS_BY_DURATION` → `{2: 3, 3: 5, 5: 8}` (see §0) and ensure
  `quiz_gen` distributes across scenes, none gating after scene 1.

### B5. UX follow-on (from the player bug)
- Inline quizzes currently fire only at scene ends (~30s in). With more scenes,
  gates are more frequent; also add a subtle "checkpoint ahead" affordance and/or
  allow mid-scene gating for long scenes.

---

## Workstream C — Production-grade UI/UX (Brilliant + Linear hybrid, dark mode)

**Direction (confirmed):** Brilliant warmth × Linear precision, **dark mode**, keep
the existing **teal brand** color.

**C0 foundation — ✅ DONE:** added a full `.dark` token set (Linear-grade deep cool
surfaces, teal brightened to pop) in `index.css`; wired `next-themes`
(`ThemeProvider` in `main.tsx`) + a `ThemeToggle`; added `glow-primary` /
`edge-light` utilities.

**C1 landing — ✅ DONE (awaiting your approval):** rebuilt `routes/index.tsx` —
sticky glass header w/ theme toggle, hero (animated player preview w/ caption +
quiz marker), stats strip, **bento** feature grid, 3-step flow w/ connector, CTA,
footer. Light + dark screenshots at `frontend/e2e/__screens__/landing-{light,dark}.png`.
Deleted orphaned `Hero.tsx`. Verified: tsc, lint=0, build, screenshots.

**Theme:** default **light**, system-follow off, `ThemeToggle` added to the in-app
`TopBar` (not just landing). Landing re-overhauled (bolder, product-led: player
mockup + floating quiz card, source pills, visual bento, gamification strip).

**Surfaces — ✅ DONE (light + dark, screenshot-verified):**
- **Landing** — full trend-forward overhaul.
- **Home/dashboard** — welcome band w/ glow, gamified stat cards, polished tabs +
  illustrated empty states.
- **Sign-in** — split layout, glowing brand panel w/ gradient headline + feature
  checkmarks; fixed stale "study rooms" copy.
- **Profile** & **Watch/player** — already at the bar and inherit the new tokens
  cleanly (gradient profile header + stat cards; chaptered dark player). Light
  polish only.
- Per your note, the **create / generating / script-review** flow was left as-is.

Screenshots in `frontend/e2e/__screens__/{landing,home,profile,watch,signin}-{light,dark}.png`.
`surfaces.spec.ts` + `landing.spec.ts` capture them for future visual checks.

### (original plan below)

**Goal:** stop looking like a personal project. Cohesive design system + every
surface elevated, with gentle gamification.

### C0. Design system first (foundation)
- Define **tokens**: a warm, vibrant-but-legible palette (primary + accent +
  semantic), type scale (display/heading/body), spacing, radii, elevation, and a
  **motion language** (durations/easings already partly in use). Centralize in the
  Tailwind theme + CSS vars so every surface is consistent.
- Component pass: buttons, cards, inputs, tabs, dialogs, badges, **and the three
  states every data view needs — loading (skeletons), empty (illustrated), error
  (recoverable)**. Responsive + mobile layouts. Accessibility (focus, contrast,
  reduced-motion). Optional dark mode (tokens make it cheap).
- Will apply the `frontend-design` / `artifact-design` skill guidance for taste.

### C1. Surfaces (priority order)
1. **Watch / player** — core surface. Build on the v1 fixes (inline SVG, chaptered
   timeline, captions, completion). Add: polished scene transitions, a refined
   transport, a "checkpoint" timeline treatment, mastery feedback on quiz answers,
   keyboard hints, mobile player.
2. **Create flow** — make generation feel premium: clear source picker, inline
   validation, a delightful (not spinner-only) generation progress with the real
   pipeline stages, and a strong script-review/approve screen.
3. **Home / dashboard** — luminar library with great cards, progress + streaks,
   filters/tabs, and a genuinely good empty state ("create your first luminar").
4. **Landing + auth + profile** — a real marketing landing (hero, how-it-works,
   value), polished Google sign-in, and a profile/portfolio with mastery viz +
   light achievements.

### C2. Gentle gamification
- Streaks (the `StreakFlame` component exists), per-concept mastery progress,
  completion celebration, "explore next" — surfaced tastefully on home/profile/
  completion. Motivate, don't nag.

---

## Sequencing, risk, verification

1. **A (nomenclature)** first — mechanical, unblocks clean naming for everything
   after. Verify: build + lint + harness green.
2. **B (generation quality)** — prompts + enforcement + quiz scaling. Verify by
   generating across all three tiers (real OpenAI; your call on when to spend) and
   checking scene/SVG counts, total duration in range, quiz counts. The seed/clone
   harness reproduces playback without re-generating.
3. **C (UI/UX)** — largest; design-system foundation then per-surface. Verify each
   surface in the Playwright harness with screenshots (the workflow we just used).

**Risks:** (a) DB clarity renames touch prod — gated behind your approval, applied
with the verified inspect→apply→verify flow; (b) prompt changes need a few real
generations to tune — budget some OpenAI spend; (c) UI overhaul is broad — done
surface-by-surface so it's always shippable, never half-broken.

**Always-green guardrail:** after every workstream, `npm run build`, `npm run
lint`, backend import check, and `npm run test:e2e` must pass.
