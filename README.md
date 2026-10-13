# USI · Athlete Management System — AI-native prototype

High-fidelity, clickable prototype of the Athlete Management System (AMS) module inside the Unified Sports Interface (USI).
Built for the Khelo Tech APM machine test. Companion to the Product Thinking Document (text version in `docs/product-thinking.txt`).

All 9 mandatory modules plus the athlete mobile app are clickable: Command Center, Athlete Management, Training & Periodisation, Medical & Injury Intelligence (priority module, interactive body map), Sports Science, Nutrition, Assessments & TID, Analytics & BI, AI Copilot / AI Operations, and the Athlete App.

**Open it:** `dist/index.html` (double-click; works offline except fonts/CDN scripts) or the published prototype link.

## What to try (5 minutes)
1. **Command Center as the Performance Director** — switch the org ladder in the top bar (Federation → State → Centre → Sport → Squad) and watch every KPI re-roll. Click a centre row to drill down.
2. **Switch role → Coach (Rakesh Patil)** — Priya Deshmukh is red before the 07:30 session (3 bad nights, soreness, load jump ACWR 1.74). Accept the AI suggestion “Switch to recovery session” in one tap.
3. **Medical & Injury (Physio Neha Kulkarni)** — report Priya's hamstring tightness on the interactive body map; assess Yash More's groin; sign off Rohan Gaikwad's rehab stage.
4. **Switch role → Team Doctor** — clear Kavya Nair to return; a graded return-to-load plan is created.
5. **Athletes (Ops Sanjay Verma)** — verify documents with AI pre-checks, return a document with a reason, merge a duplicate, approve an application, assign a coach.
6. **Copilot** (top-right) — ask “who is at risk today?”, “why is Priya red?”, “move red athletes to recovery”.
7. **Athlete App** — Priya's phone: 30-second morning check-in with a pain body map, post-session RPE, rehab pain score, water and supplement requests; the staff screens update live. Try "Ananya · no check-in" in the side panel for a fresh check-in.
8. **Nutrition (Nutritionist Farah Khan)** — AI drafts a higher-carb plan for Priya's load jump (approve to publish), a U-17 boxer cutting 4.6% in 14 days is flagged for a doctor review, supplement requests go nutritionist → doctor, untested products are blocked.
9. **Analytics & BI** — click a state, then a centre, to drill down; 4-week injury forecast with a what-if slider; report preview with Copy CSV and scheduling.

Everything you change persists in your browser. User menu → *Reset demo data* restores the 13 Oct 2026, 07:05 starting point.

## Architecture
- **One shared athlete record** (`src/data.js`) that every module reads and writes through one store (`AMS.mutate`) — the product doc's core idea, enforced in code.
- **Org ladder** Federation → State → Centre → Sport → Squad → Athlete does three jobs: filter, permission (role locks) and roll-up (`AMS.effectiveScope`, `AMS.scopedAthletes`).
- **Role-based access** per data domain (`AMS.RBAC`), including summary-only medical for non-medical roles (`AMS.medicalLabel`).
- **AI layer** = registered detectors (explainable insights with evidence, confidence and one-tap actions) + registered actions (the same code path used by buttons, AI insights and the Copilot). AI drafts; humans confirm anything medical.
- **Modules** are independent files (`src/modules/*.js`) that register pages, drawers, modals, athlete-profile tabs, detectors, actions, commands, seeds and self-tests.
- React 18 + htm, no build step. `node tools/build.js` inlines everything into `dist/index.html`. `node tools/smoke.js` server-renders every module for all 8 roles and runs workflow self-tests.

```
src/core.js      store, RBAC, org ladder, calculations (readiness, ACWR, risk), AI engine, registries
src/data.js      deterministic demo data: 9 centres, 19 squads, 160+ athletes, sessions, injuries, applications, tests
src/ui.js        component kit + SVG charts
src/shell.js     app shell: navigation, ladder filter, role switcher, notifications, command palette, live simulation
src/modules/     dashboard, athletes, training, medical, science, nutrition, assessments, analytics, copilot, athlete-app
tools/           build + smoke test
```

All names, centres and figures are fictional demo data.
