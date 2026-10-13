# USI · Athlete Management System (AI-native prototype)

A clickable, working prototype of the Athlete Management System inside the Unified Sports Interface (USI), built for the Khelo Tech APM machine test.
Every screen is interactive: actions change real data, and the change shows up everywhere else (dashboard, athlete profile, notifications, Copilot).

The product thinking behind it is in [`docs/product-thinking.txt`](docs/product-thinking.txt).

---

## 1. Open it (1 minute, no install)

1. On this GitHub page click **Code → Download ZIP**, then unzip it.
2. Open **`dist/index.html`** in Chrome or Edge (double-click the file).
3. Stay online the first time — the page loads React and fonts from a public CDN.

No login, no server, no setup. Everything you do is saved in your browser.
To start over at any time: **click the avatar (top right) → Reset demo data.**

> The demo is set on **Tuesday 13 Oct 2026, 07:05**, just before the morning sessions. All names, centres and numbers are fictional.

---

## 2. How to move around

| Where | What it does |
|---|---|
| **Left sidebar** | The 10 modules. |
| **Top bar filter** — Federation › State › Centre › Sport › Squad | Filters every screen. Pick *Maharashtra → Pune HPC* to zoom in. |
| **Avatar (top right) → Switch role** | Become any of 8 people. Same data, different view and permissions. |
| **Copilot button (top right)** | AI assistant, available on every screen. It knows which page and athlete you are looking at. |
| **Bell** | Notifications for the current role. |
| **Ctrl + K** | Search athletes or jump to any screen or action. |

**The 8 roles** (switch from the avatar menu):

| Role | Person | Lands on | Sees |
|---|---|---|---|
| Performance Director | Dr. Anjali Rao | Command Center | Whole federation; medical as summary labels only |
| Coach | Rakesh Patil | Command Center | Only his squads (Pune U-17 and U-20 Sprints) |
| Physiotherapist | Neha Kulkarni | Medical & Injury | Pune HPC, full medical detail |
| Team Doctor | Dr. Vikram Menon | Medical & Injury | Pune HPC, full medical detail, signs clearances |
| Sports Scientist | Arjun Iyer | Sports Science | Pune HPC, readiness and load |
| Nutritionist | Farah Khan | Nutrition | Pune HPC, plans, hydration, supplements |
| Operations Admin | Sanjay Verma | Athletes | Onboarding and documents; **no** wellness or medical data |
| Athlete | Priya Deshmukh | Athlete App | Her own phone app |

---

## 3. Guided walkthrough (about 10 minutes)

Follow the story of **Priya Deshmukh**, 16, a U-17 sprinter at Pune HPC. She is **red** this morning: three bad nights, sore, and her training load jumped after Sunday's trials.

**Step 1 — Director: the federation at a glance** (role: *Performance Director*)
- On **Command Center**, change the top filter to *Maharashtra*, then *Pune HPC*. Every number updates.
- Open **Analytics & BI**: click a state row, then a centre row, to drill down. Move the forecast slider to see injuries avoided. Click **Copy CSV** on the report.

**Step 2 — Coach: act on the AI warning** (role: *Coach*)
- On **Command Center**, find Priya in the red group and the AI card "load jump, elevated injury risk". Every AI card shows its evidence and confidence.
- Click **Switch to recovery session**. Her session is now a recovery version.

**Step 3 — Athlete: the phone app** (role: *Athlete*, or open **Athlete App** as any staff role)
- Priya's home screen shows "Coach adjusted your session: Recovery".
- **Check-in** tab → *Update answers* → tap the 5 scales → *Any pain? Yes* → tap both hamstrings on the body map → **Send check-in**. The physio gets a pain flag; the coach only sees "Monitoring: upper leg".
- **Session** tab → **Rate my session** → pick an effort → the load (RPE × minutes) is added and tomorrow's ACWR is shown.
- Also try **Fuel** (+250 ml water, request a supplement) and **Me** (upload the missing blood test; the AI checks it).
- As staff, use the side panel to preview other athletes, e.g. *Ananya · no check-in* or *Rohan · rehab*.

**Step 4 — Physio: the injury workflow** (role: *Physiotherapist*)
- **Medical & Injury → Overview**: an interactive body heat map. Click a body region to filter the cases.
- **Caseload** board: **Yash More** (groin, reported 06:52) → **Start assessment** → **Record assessment** → **Save assessment → Rehab**. His card moves along the board.
- Click **Rohan Gaikwad**'s card (hamstring, stage 3) → **Return to play** tab → click both stage criteria to tick them → **Sign off stage**.
- Click **Report injury**, pick an athlete, and click a region on the large body map.

**Step 5 — Doctor: return to play** (role: *Team Doctor*)
- Open **Kavya Nair** (ankle, waiting for clearance) → **Review & clear** → **Sign clearance & close case**. A graded return-to-load plan is created. Only the doctor can do this.

**Step 6 — Operations: onboarding** (role: *Operations Admin*)
- **Athletes → Onboarding & verification**: click an application (e.g. Riya Shinde). The AI has already pre-checked each document and flagged a date-of-birth mismatch.
- Try **Verify** on a document, **Return to applicant** with a reason, **Approve**, and **Merge** the duplicate (Rahul Yadav) from the queue.
- **Coach assignment** tab → Sakshi Malik → click the **Assign …** button with the AI-recommended coach.
- Note: Operations cannot open Medical or see wellness data.

**Step 7 — Nutritionist: AI drafts, a human approves** (role: *Nutritionist*)
- **Nutrition → Diet plans → Priya** → **Draft an updated plan**. The AI raises her carbohydrate because of the load jump and explains why. Then click **Approve & publish**.
- **Body composition**: Deepak Sawant (16) lost 4.6% in 14 days. Click **Review with doctor**.
- **Supplements**: approve a request (it then goes to the doctor). Untested products are blocked automatically.

**Step 8 — Copilot** (any role)
- Click **Copilot** and ask: *"who is at risk today?"*, *"why is Priya red?"*, *"move red athletes to recovery"* (it asks you to confirm), *"compare centres"*, *"explain ACWR"*.
- Ask the same question as Coach and as Operations: the answers respect what each role is allowed to see.
- **AI Operations** page: every AI flag, the automation rules, and an audit of AI actions.

---

## 4. What is in the prototype

| Module | Highlights |
|---|---|
| **Command Center** | Role-aware KPIs, readiness by squad, injury alerts, AI recommendations, drill-down through the org ladder |
| **Athlete Management** | Registry, profile, onboarding and approval, AI document checks, duplicate merge, coach assignment, profile completion |
| **Training & Periodisation** | Season / week plans, session builder, exercise library, attendance, RPE, workload and ACWR |
| **Medical & Injury** (priority) | Interactive front/back body map, injury reporting, caseload board, rehab stages, doctor clearance, graded return, injury analytics |
| **Sports Science** | Readiness monitoring, fatigue analytics, wearable / GPS data, recovery tracking, AI risk model |
| **Nutrition** | Diet plans, hydration and sweat tests, supplement approval, meal-logging compliance, body composition, weight-cut tracking |
| **Assessments & TID** | Field testing, benchmarks, talent scoring, progression |
| **Analytics & BI** | Federation KPIs, drill-down, injury forecast, reports with CSV and scheduling |
| **AI Copilot / AI Operations** | Assistant on every screen, AI inbox, automations, audit |
| **Athlete App** | Mobile check-in, session and RPE, rehab, fuel, documents |

**AI rules used everywhere:** the AI always shows *why* (the numbers behind each warning), compares each athlete with their *own* normal, and never changes medical status by itself — it drafts, a person confirms.

---

## 5. For technical reviewers

- **One shared athlete record** (`src/data.js`); every module reads and writes it through one store (`AMS.mutate`), which is why a change in one place appears everywhere.
- **Org ladder** Federation → State → Centre → Sport → Squad → Athlete is used for filtering, permissions and roll-ups.
- **Role-based access** per data domain (`AMS.RBAC` in `src/core.js`), including summary-only medical labels for non-medical roles.
- **Modules** are independent files in `src/modules/`. React 18 + htm, no build step for development.
- `node tools/build.js` creates the single-file `dist/index.html`.
- Tests: `cd tools && npm install && cd ..` then `node tools/smoke.js` — renders every screen for all 8 roles and runs the workflow self-tests (should print `OK`).

```
src/core.js      store, permissions, org ladder, calculations (readiness, ACWR, risk), AI engine
src/data.js      demo data: 9 centres, 19 squads, 160+ athletes, sessions, injuries, applications, tests
src/ui.js        component kit and charts
src/shell.js     app frame: navigation, filters, role switcher, notifications, search, Copilot host
src/modules/     dashboard, athletes, training, medical, science, nutrition, assessments, analytics, copilot, athlete-app
dist/index.html  the whole prototype in one file
```
