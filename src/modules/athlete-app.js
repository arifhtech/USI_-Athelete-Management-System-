/* USI · AMS — Athlete App (mobile-first).
   What an athlete sees on their phone: a 30-second morning check-in (with a pain body map), today's session including the coach's
   adjustment, post-session RPE (Borg CR-10), rehab stage + daily pain score, water / meals / supplement requests, documents and consent.
   Everything an athlete submits goes through registered actions → AMS.mutate, so it lands in the staff screens in real time:
   Command Center readiness, Medical inbox (light-path flags), Training load + ACWR, Nutrition, and the Ops verification queue.
   Staff roles see the same phone beside a panel that explains where each tap lands. What they can preview follows RBAC
   (a coach never sees the diagnosis, Operations never sees wellness or medical data). Owns db.athleteApp (fallback stores). */
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useEffect, useMemo } = React;
  const Frag = React.Fragment;
  const D = AMS.date, C = AMS.calc;
  const MOD = 'athlete-app';

  /* ================================================================== styles (tokens only) */
  (function injectStyle() {
    try {
      if (typeof document === 'undefined' || !document.createElement) return;
      if (document.getElementById && document.getElementById('style-' + MOD)) return;
      const el = document.createElement('style');
      el.id = 'style-' + MOD;
      el.textContent = [
        '.aa-stage{display:flex;justify-content:center;align-items:flex-start;gap:28px;flex-wrap:wrap;padding:4px 0 40px}',
        '.aa-side{width:400px;max-width:100%;display:flex;flex-direction:column;gap:14px;min-width:0}',
        '.aa-screen{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13.5px;color:var(--fg)}',
        '.aa-status{display:flex;justify-content:space-between;align-items:center;padding:10px 24px 4px;font:600 12px var(--font-ui)}',
        '.aa-batt{width:21px;height:11px;border:1.5px solid var(--fg-2);border-radius:3px;position:relative;display:inline-block}',
        '.aa-batt i{position:absolute;top:1px;bottom:1px;left:1px;right:5px;background:var(--fg-2);border-radius:1px}',
        '.aa-head{display:flex;align-items:center;gap:10px;padding:6px 14px 10px;border-bottom:1px solid var(--border)}',
        '.aa-badge{position:absolute;top:1px;right:1px;min-width:15px;height:15px;padding:0 4px;border-radius:8px;background:var(--bad);color:var(--surface);font:600 9.5px/15px var(--font-ui);text-align:center}',
        '.aa-body{flex:1;overflow-y:auto;padding:14px 14px 20px;display:flex;flex-direction:column;gap:12px;min-height:0}',
        '.aa-tabs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid var(--border);background:var(--surface);padding:6px 4px 14px}',
        '.aa-tab{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:0;color:var(--fg-3);font:500 10.5px var(--font-ui);cursor:pointer;padding:4px 0;position:relative}',
        '.aa-tab.on{color:var(--accent)}',
        '.aa-tab .aa-dot{position:absolute;top:1px;left:calc(50% + 6px);width:7px;height:7px;border-radius:50%;background:var(--bad);border:1.5px solid var(--surface)}',
        '.aa-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;min-width:0}',
        '.aa-tap{cursor:pointer;text-align:left;width:100%;font:inherit;color:inherit}',
        '.aa-tap:hover{border-color:var(--border-strong)}',
        '.aa-h1{font:600 20px/1.2 var(--font-display);margin:0}',
        '.aa-row{display:flex;align-items:center;gap:10px;min-width:0}',
        '.aa-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
        '.aa-ico{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none;background:var(--surface-3);color:var(--fg-2)}',
        '.aa-ico.accent{background:var(--accent-weak);color:var(--accent)}.aa-ico.warn{background:var(--warn-weak);color:var(--warn)}.aa-ico.bad{background:var(--bad-weak);color:var(--bad)}.aa-ico.good{background:var(--good-weak);color:var(--good)}.aa-ico.info{background:var(--info-weak);color:var(--info)}',
        '.aa-task{display:flex;align-items:center;gap:10px;padding:7px 0;border:0;border-top:1px solid var(--border);background:none;cursor:pointer;color:inherit;font:inherit;text-align:left;width:100%}',
        '.aa-mini{gap:4px}',
        '.aa-q{display:flex;flex-direction:column;gap:6px}',
        '.aa-scale{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}',
        '.aa-scale button{display:flex;flex-direction:column;align-items:center;gap:1px;padding:7px 2px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--fg-2);font:600 15px var(--font-ui);cursor:pointer;min-width:0}',
        '.aa-scale button small{font-weight:500;font-size:9.5px;color:var(--fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
        '.aa-scale button.on{background:var(--accent);border-color:var(--accent);color:var(--surface)}',
        '.aa-scale button.on small{color:var(--surface)}',
        '.aa-big{width:100%;height:46px;border-radius:12px;font-size:14.5px;justify-content:center}',
        '.aa-step{display:flex;align-items:center;gap:12px}',
        '.aa-step .btn{width:40px;height:40px;border-radius:50%;justify-content:center;padding:0}',
        '.aa-stepv{font-size:22px;font-weight:600;min-width:76px;text-align:center}',
        '.aa-rpe{display:flex;flex-direction:column;gap:5px}',
        '.aa-rpe button{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;padding:6px 10px;border-radius:10px;border:1px solid var(--border);background:var(--surface);cursor:pointer;text-align:left;font:500 13px var(--font-ui);color:var(--fg)}',
        '.aa-rpe button.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-weak)}',
        '.aa-rpev{width:34px;height:34px;border-radius:9px;display:inline-grid;place-items:center;font:600 16px var(--font-display);flex:none}',
        '.aa-rpev.good{background:var(--good-weak);color:var(--good)}.aa-rpev.info{background:var(--info-weak);color:var(--info)}.aa-rpev.warn{background:var(--warn-weak);color:var(--warn)}.aa-rpev.bad{background:var(--bad-weak);color:var(--bad)}',
        '.aa-pain{display:grid;grid-template-columns:repeat(11,minmax(0,1fr));gap:3px}',
        '.aa-pain button{height:30px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font:600 11.5px var(--font-ui);color:var(--fg-2);cursor:pointer;padding:0;min-width:0}',
        '.aa-pain button.on{background:var(--accent);border-color:var(--accent);color:var(--surface)}',
        '.aa-pain button:disabled{cursor:not-allowed;opacity:.55}',
        '.aa-spot{display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}',
        '.aa-bm{display:flex;justify-content:center;padding:4px 0}',
        '.aa-regions{display:flex;flex-wrap:wrap;gap:6px}',
        '.aa-stages{display:flex;flex-direction:column}',
        '.aa-stages .s{display:flex;gap:10px;align-items:flex-start;padding:5px 0}',
        '.aa-stages .s i{width:22px;height:22px;border-radius:50%;flex:none;display:grid;place-items:center;font:600 11px var(--font-ui);font-style:normal;background:var(--surface-3);color:var(--fg-3)}',
        '.aa-stages .s.done i{background:var(--good-weak);color:var(--good)}',
        '.aa-stages .s.cur i{background:var(--accent);color:var(--surface)}',
        '.aa-check{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer}',
        '.aa-check:last-child{border-bottom:0}',
        '.aa-check.ro{cursor:default}',
        '.aa-box{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--border-strong);display:grid;place-items:center;flex:none;color:var(--surface)}',
        '.aa-box.on{background:var(--good);border-color:var(--good)}',
        '.aa-water{height:10px;border-radius:5px;background:var(--surface-3);overflow:hidden}',
        '.aa-water i{display:block;height:100%;background:var(--info);border-radius:5px;transition:width .4s}',
        '.aa-meal{display:flex;flex-direction:column;gap:2px;padding:7px 0;border-top:1px solid var(--border)}',
        '.aa-banner{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:var(--info-weak);border:1px solid color-mix(in srgb, var(--info) 28%, transparent)}',
        '.aa-banner.warn{background:var(--warn-weak);border-color:color-mix(in srgb, var(--warn) 30%, transparent)}',
        '.aa-banner.good{background:var(--good-weak);border-color:color-mix(in srgb, var(--good) 30%, transparent)}',
        '.aa-banner.bad{background:var(--bad-weak);border-color:color-mix(in srgb, var(--bad) 30%, transparent)}',
        '.aa-lock{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:40px 18px;color:var(--fg-3)}',
        '.aa-note{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-top:1px solid var(--border)}',
        '.aa-miss{display:flex;flex-direction:column;gap:6px;padding:8px 0;border-top:1px solid var(--border)}',
        '.aa-link{background:none;border:0;padding:0;color:var(--fg-3);text-decoration:underline;cursor:pointer;font:inherit;align-self:flex-start}',
        '.aa-flow{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border)}',
        '.aa-flow:last-child{border-bottom:0}',
        '@media (max-width:760px){.aa-side{width:100%;padding:0 12px}.aa-stage{padding:0 0 24px;gap:16px}}',
      ].join('\n');
      (document.head || document.body).appendChild(el);
    } catch (e) { /* style injection unavailable (server render) */ }
  })();

  /* ================================================================== constants */
  const TABS = [
    { id: 'home', label: 'Home', icon: 'dashboard' },
    { id: 'checkin', label: 'Check-in', icon: 'heart' },
    { id: 'session', label: 'Session', icon: 'run' },
    { id: 'rehab', label: 'Rehab', icon: 'medical' },
    { id: 'fuel', label: 'Fuel', icon: 'apple' },
    { id: 'me', label: 'Me', icon: 'user' },
  ];
  const TAB_DOMAIN = { checkin: 'readiness', session: 'training', rehab: 'medical', fuel: 'nutrition' };
  const DOMAIN_WORDS = { readiness: 'wellness and readiness', training: 'training', medical: 'medical', nutrition: 'nutrition' };
  const SCALES = [
    { key: 'sleep', label: 'Sleep quality', icon: 'moon', words: ['Awful', 'Poor', 'OK', 'Good', 'Great'] },
    { key: 'soreness', label: 'Muscle soreness', icon: 'pulse', words: ['Very sore', 'Sore', 'Some', 'Slight', 'None'] },
    { key: 'mood', label: 'Mood', icon: 'heart', words: ['Very low', 'Low', 'OK', 'Good', 'Great'] },
    { key: 'stress', label: 'Stress', icon: 'zap', words: ['Very high', 'High', 'Some', 'Low', 'None'] },
    { key: 'energy', label: 'Energy', icon: 'bolt', words: ['Drained', 'Low', 'OK', 'Good', 'Full'] },
  ];
  const SCALE_KEYS = SCALES.map((s) => s.key);
  // Borg CR-10 (session RPE, Foster) — 1 tap after the session
  const BORG = [
    [1, 'Very, very easy', 'Barely an effort'], [2, 'Easy', 'Could chat the whole time'], [3, 'Moderate', 'Breathing harder, still comfortable'],
    [4, 'Somewhat hard', 'Starting to work'], [5, 'Hard', 'Challenging but steady'], [6, 'Hard +', 'Short answers only'],
    [7, 'Very hard', 'Tough to keep going'], [8, 'Very hard +', 'Could not have done much more'], [9, 'Extremely hard', 'Almost my limit'], [10, 'Maximal', 'Absolute limit'],
  ];
  const PAIN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const VARIANT_SCALE = { none: 1, reduced: 0.6, recovery: 0.35, rehab: 0.4, excluded: 0 };
  const VARIANT_SHORT = { none: 'Full session', reduced: 'Reduced volume', recovery: 'Recovery', rehab: 'Rehab programme', excluded: 'Rest' };
  const VARIANT_TONE = { recovery: 'info', reduced: 'warn', rehab: 'info', excluded: 'bad' };
  const RECOVERY_BLOCKS = [['Dynamic warm-up', '15 min'], ['Pool recovery', '20 min'], ['Foam rolling', '10 min'], ['Easy bike', '20 min']];
  const CENTER = new Set(['head', 'neck', 'abdomen', 'lower_back']);
  const REGION_NAMES = {
    head: 'Head', neck: 'Neck', shoulder: 'Shoulder', chest: 'Chest', upper_arm: 'Upper arm', elbow: 'Elbow', forearm: 'Forearm', wrist: 'Wrist', hand: 'Hand',
    abdomen: 'Abdomen', hip_flexor: 'Hip flexor', groin: 'Groin', quad: 'Quadriceps', knee: 'Knee', shin: 'Shin', ankle: 'Ankle', foot: 'Foot',
    upper_back: 'Upper back', lower_back: 'Lower back', glute: 'Glute', hamstring: 'Hamstring', calf: 'Calf', achilles: 'Achilles',
  };
  const BACK_REGIONS = new Set(['upper_back', 'lower_back', 'glute', 'hamstring', 'calf', 'achilles']);
  const REGION_FALLBACK = ['hamstring', 'quad', 'groin', 'hip_flexor', 'knee', 'shin', 'calf', 'achilles', 'ankle', 'foot', 'lower_back', 'shoulder'];
  const DOC_FIELDS = ['Blood test report', 'Passport', 'Previous coach reference', 'Guardian consent'];
  // Today's rehab exercises per RTP template, one list per stage (index = rtpStage)
  const REHAB = {
    'lower-muscle': [
      [['Isometric bridge holds', '5 × 30 s'], ['Walking', '15 min'], ['Easy bike', '20 min']],
      [['Easy jog on grass', '2 × 8 min'], ['Isometric bridge holds', '5 × 30 s'], ['Hip mobility circuit', '10 min']],
      [['Strides at 70%', '6 × 60 m'], ['Assisted Nordic curls', '3 × 5'], ['Single-leg RDL', '3 × 8 / leg']],
      [['A- and B-skips', '3 × 30 m'], ['Build-ups to 90%', '4 × 60 m'], ['Nordic curls', '3 × 5']],
      [['Squad session as advised', 'full'], ['Nordic curls', '2 × 5'], ['Foam rolling', '10 min']],
      [['Maintenance Nordic curls', '2 × 5'], ['Foam rolling', '10 min']],
    ],
    ligament: [
      [['Ankle alphabet', '3 rounds'], ['Supported single-leg balance', '3 × 30 s'], ['Ice and elevation', '15 min']],
      [['Single-leg balance, eyes closed', '3 × 30 s'], ['Calf raises', '3 × 15'], ['Band eversion', '3 × 15']],
      [['Straight-line jog', '2 × 10 min'], ['Hop and stick', '3 × 8'], ['Calf raises', '3 × 15']],
      [['Lateral shuffles', '4 × 20 m'], ['Figure-of-8 runs', '4 reps'], ['Single-leg hops', '3 × 10']],
      [['Squad session as advised', 'full'], ['Balance maintenance', '5 min']],
      [['Balance maintenance', '5 min'], ['Calf raises', '2 × 15']],
    ],
    tendon: [
      [['Isometric holds', '5 × 45 s'], ['Easy bike', '20 min']],
      [['Heavier isometric holds', '5 × 45 s'], ['Hip and core circuit', '15 min']],
      [['Heavy slow resistance', '4 × 8, 3 s up / 3 s down'], ['Calf raises', '3 × 15']],
      [['Pogo hops', '3 × 20'], ['Bounds', '4 × 20 m'], ['Isometric holds', '3 × 45 s']],
      [['Squad session as advised', 'full'], ['Isometric holds', '3 × 45 s']],
      [['Isometric holds', '3 × 45 s']],
    ],
    concussion: [
      [['Screen break in the evening', 'from 20:00'], ['Short walk', '10 min']],
      [['Easy bike', '15 min'], ['Symptom check afterwards', '2 min']],
      [['Shadow drills, no contact', '3 × 2 min'], ['Skipping rope', '5 min']],
      [['Pad work, non-contact', '4 × 2 min'], ['Cognitive test with physio', '15 min']],
      [['Controlled sparring as advised', 'as advised'], ['Symptom check afterwards', '2 min']],
      [['Normal training', 'full']],
    ],
    upper: [
      [['Rest the arm as advised', 'all day'], ['Grip squeezes', '3 × 15']],
      [['Pendulum swings', '3 × 1 min'], ['Wall slides', '3 × 10']],
      [['Band external rotation', '3 × 12'], ['Scapular rows', '3 × 12']],
      [['Technical lifts at 60–80%', 'as advised'], ['Band work', '3 × 12']],
      [['Squad session as advised', 'full'], ['Band work', '2 × 12']],
      [['Band work', '2 × 12']],
    ],
  };
  const LIGHT_PLAN = [['Easy mobility', '10 min'], ['Foam rolling', '10 min'], ['Ice if sore after training', '10 min']];
  const WAITING_PLAN = [['Rest the area', 'until assessed'], ['Easy mobility in a pain-free range', '10 min']];
  const SUPP_FALLBACK = [
    { id: 'SUP-WHEY', product: 'Whey protein isolate', category: 'Protein', tested: true, note: 'Post-session, 25 g' },
    { id: 'SUP-CRE', product: 'Creatine monohydrate', category: 'Performance', tested: true, note: '3 g daily' },
    { id: 'SUP-ORS', product: 'Electrolyte sachets', category: 'Hydration', tested: true, note: 'Hot or double-session days' },
    { id: 'SUP-VD3', product: 'Vitamin D3 60,000 IU', category: 'Micronutrient', tested: true, note: 'Weekly, after a blood test' },
    { id: 'SUP-IRON', product: 'Iron + folic acid', category: 'Micronutrient', tested: true, note: 'Doctor prescription only' },
    { id: 'SUP-PRE', product: 'Imported pre-workout "X-Plode"', category: 'Stimulant', tested: false, risk: 'Not batch-tested; similar products have contained undeclared stimulants.' },
  ];
  const STORY = [
    { name: 'Priya Deshmukh', label: 'Priya · red today', why: 'Readiness red: three bad nights, load jump, hamstrings tight' },
    { name: 'Ananya Joshi', label: 'Ananya · no check-in', why: 'Has not checked in yet: try a fresh 30-second check-in' },
    { name: 'Rohan Gaikwad', label: 'Rohan · rehab', why: 'Right hamstring, rehab stage 3 running long' },
    { name: 'Yash More', label: 'Yash · pain reported', why: 'Reported groin pain at 06:52, waiting for the physio' },
    { name: 'Kavya Nair', label: 'Kavya · clearance', why: 'Left ankle, waiting for doctor clearance' },
  ];
  const FLOWS = [
    { tab: 'checkin', icon: 'heart', title: 'Morning check-in', lands: 'Readiness on the Command Center and Sports Science boards. A red check-in notifies the coach.', module: 'dashboard' },
    { tab: 'checkin', icon: 'medical', title: 'Pain spot on the body map', lands: 'Medical inbox as a light-path flag for the physio. The coach gets the summary label only.', module: 'medical' },
    { tab: 'session', icon: 'run', title: 'Session RPE', lands: 'sRPE load (RPE × minutes) in Training, and tomorrow\'s ACWR.', module: 'training' },
    { tab: 'rehab', icon: 'pulse', title: 'Rehab pain score and exercises', lands: 'The injury case pain chart. A jump of 2 or more points prompts the physio to review.', module: 'medical' },
    { tab: 'fuel', icon: 'droplet', title: 'Water and supplement requests', lands: 'Nutrition hydration board and the supplement review queue (nutritionist, then doctor).', module: 'nutrition' },
    { tab: 'me', icon: 'file', title: 'Document upload', lands: 'AI pre-check, then the Ops verification queue. Closes the profile task.', module: 'athletes' },
  ];

  /* ================================================================== helpers */
  const ath = (id) => AMS.org.athlete(id);
  const first = (a) => (a && a.name ? a.name.split(' ')[0] : '');
  const minutesOf = (t) => { const p = String(t || '00:00').split(':').map(Number); return p[0] * 60 + (p[1] || 0); };
  const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const fmtL = (ml) => (Math.round((ml || 0) / 100) / 10).toFixed(1) + ' L';
  const denied = (msg) => { AMS.toast(msg, 'bad'); return null; };
  const actLog = (a, text, type) => ({ type: type || 'athlete-app', text, athleteId: a.id, by: a.name, role: 'athlete' });
  const isOwn = (athleteId) => AMS.ui.role === 'athlete' && !!AMS.me() && AMS.me().id === athleteId;
  const squadOf = (a) => (a.tempAssignment && a.tempAssignment.active ? a.tempAssignment.squadId : a.squadId);
  const centreOf = (a) => (a.tempAssignment && a.tempAssignment.active ? a.tempAssignment.centreId : a.centreId);
  const sqName = (a) => { const s = AMS.org.squad(squadOf(a)); return s ? s.name : a.sport; };
  const coachOf = (a) => { const s = AMS.org.squad(squadOf(a)); return AMS.org.staff((s && s.coachId) || a.coachId); };
  const coachName = (a) => { const c = coachOf(a); return c ? 'Coach ' + c.name.split(' ')[0] : 'Your coach'; };
  const staffAt = (role, a) => AMS.db.staff.find((s) => s.role === role && s.centreId === centreOf(a)) || AMS.db.staff.find((s) => s.role === role && s.centreId === a.centreId) || AMS.db.staff.find((s) => s.role === role);
  const physioOf = (a) => staffAt('physio', a);
  const nutritionistOf = (a) => staffAt('nutritionist', a);
  const regionLabel = (region, side) => (side === 'L' ? 'Left ' : side === 'R' ? 'Right ' : '') + (side === 'L' || side === 'R' ? (REGION_NAMES[region] || region).toLowerCase() : (REGION_NAMES[region] || region));
  const variantOf = (s, a) => (s && s.mods && s.mods[a.id] && s.mods[a.id].variant) || 'none';
  const variantScale = (v) => { const V = AMS.training && AMS.training.VARIANTS; return V && V[v] ? V[v].scale : (VARIANT_SCALE[v] != null ? VARIANT_SCALE[v] : 1); };
  const endTime = (s) => hhmm(minutesOf(s.start) + (s.duration || 0));
  const sessionOver = (s) => !!s && (s.status === 'Completed' || minutesOf(AMS.clockTime()) >= minutesOf(s.start) + (s.duration || 0));
  const openInjuries = (a) => AMS.db.injuries.filter((i) => i.athleteId === a.id && i.status !== 'Closed');
  const painToday = (i) => { const e = (i.painLog || []).filter((x) => x.date === AMS.TODAY).slice(-1)[0]; return e ? e.pain : null; };
  const matchOpen = (a, spot) => openInjuries(a).find((i) => i.region === spot.region && (i.side === spot.side || i.side === 'C' || spot.side === 'C'));
  const bandWords = (b) => ({ good: 'ready to train', warn: 'train with care', bad: 'recovery first' }[b] || '');
  const statusTone = (s) => ({ Reported: 'bad', Assessment: 'warn', Rehab: 'info', Clearance: 'accent', Monitoring: 'warn', Closed: 'good' }[s] || '');
  const docTone = (s) => ({ Verified: 'good', Pending: 'info', Flagged: 'bad', Expiring: 'warn', Returned: 'warn', Missing: 'bad' }[s] || '');
  const suppTone = (s) => (/Approved/.test(s) ? 'good' : /Reject|Block/.test(s) ? 'bad' : /Doctor/.test(s) ? 'warn' : 'info');
  const rpeTone = (v) => (v <= 2 ? 'good' : v <= 4 ? 'info' : v <= 6 ? 'warn' : 'bad');
  const painWords = (p) => (p === 0 ? 'No pain' : p <= 3 ? 'Mild — the physio will check it' : p <= 6 ? 'Moderate — expect a quick screen before training' : 'Severe — please do not train on it until the physio sees you');
  const appStore = () => (AMS.db && AMS.db.athleteApp) || {};
  const appState = (db) => { if (!db.athleteApp) db.athleteApp = { water: {}, rehabDone: {}, supplements: [] }; const s = db.athleteApp; s.water = s.water || {}; s.rehabDone = s.rehabDone || {}; s.supplements = s.supplements || []; return s; };
  function streakOf(a) { const w = a.wellness || []; let i = w[27] ? 27 : 26, n = 0; while (i >= 0 && w[i]) { n++; i--; } return n; }
  function usualSleep(a) { return AMS.mean((a.wellness || []).slice(6, 27).filter(Boolean).map((x) => x.sleepHrs)) || 7.5; }
  function nextCompetition(a) { return (AMS.db.competitions || []).filter((c) => c.date >= AMS.TODAY && (c.sports || []).includes(a.sport)).sort((x, y) => x.date.localeCompare(y.date))[0] || null; }
  function upcomingFor(a, n) { const sq = squadOf(a); return AMS.db.sessions.filter((s) => s.squadId === sq && s.date > AMS.TODAY).sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start)).slice(0, n); }
  function notificationsFor(a) { const hero = a.id === AMS.db.meta.heroAthleteId; return AMS.db.notifications.filter((n) => n.toRole === 'athlete' && (n.athleteId ? n.athleteId === a.id : hero)); }
  function latestDocs(a) { const m = {}; (a.docs || []).forEach((d) => { if (d.status !== 'Superseded') m[d.type] = d; }); return Object.values(m); }

  /** What the current role may preview on each phone tab (RBAC per data domain). */
  function tabAccess(tabId, role) {
    role = role || AMS.ui.role;
    if (role === 'athlete') return { ok: true, level: 'own' };
    const dom = TAB_DOMAIN[tabId];
    if (!dom) return { ok: true, level: 'view' };
    const lvl = AMS.access(dom, role);
    if (lvl === 'none') return { ok: false, level: 'none', reason: AMS.roleLabel(role) + ' has no access to athlete ' + DOMAIN_WORDS[dom] + ' data under the USI role policy.' };
    return { ok: true, level: lvl };
  }
  const seesDiagnosis = (a) => isOwn(a.id) || AMS.medicalFull();

  /* ---------- nutrition adapter (nutrition.js exposes AMS.nutrition; app keeps working without it) */
  const N = () => (AMS.nutrition && typeof AMS.nutrition === 'object' ? AMS.nutrition : null);
  function defaultWaterTarget(a) { const sess = AMS.todaySessionFor(a); return Math.round(((a.weightKg || 60) * 35 + (sess && variantOf(sess, a) !== 'excluded' ? 600 : 0)) / 100) * 100; }
  function hydrationOf(a) {
    const n = N();
    if (n && typeof n.hydrationToday === 'function') {
      try { const h = n.hydrationToday(a.id); if (h) return { ml: h.ml || 0, target: h.targetMl || h.target || defaultWaterTarget(a), entries: h.entries || [], source: 'nutrition' }; } catch (e) { /* fall through */ }
    }
    const list = ((appStore().water || {})[a.id] || []).filter((e) => e.date === AMS.TODAY);
    return { ml: AMS.sum(list.map((e) => e.ml)), target: defaultWaterTarget(a), entries: list, source: 'app' };
  }
  function mealPlanOf(a) { const n = N(); if (n && typeof n.todayPlan === 'function') { try { return n.todayPlan(a.id) || null; } catch (e) { return null; } } return null; }
  function registryList() { const n = N(); if (n && typeof n.registry === 'function') { try { const r = n.registry(); if (r && r.length) return r; } catch (e) { /* fallback */ } } return SUPP_FALLBACK; }
  function supplementsOf(a) {
    const n = N();
    if (n && typeof n.requestsFor === 'function') { try { return n.requestsFor(a.id) || []; } catch (e) { /* fallback */ } }
    return (appStore().supplements || []).filter((r) => r.athleteId === a.id);
  }

  /* ---------- rehab plan for today */
  function rehabPlanFor(inj) {
    if (!inj) return [];
    if (inj.status === 'Monitoring' || inj.path === 'light') return LIGHT_PLAN;
    if (inj.status === 'Reported' || inj.status === 'Assessment') return WAITING_PLAN;
    const tpl = REHAB[inj.rtpTemplate] || REHAB['lower-muscle'];
    return tpl[AMS.clamp(inj.rtpStage || 0, 0, tpl.length - 1)];
  }
  const doneToday = (inj) => (((appStore().rehabDone || {})[inj.id] || {})[AMS.TODAY] || []);
  function blocksFor(a, sess, variant) {
    if (variant === 'excluded') return [];
    if (variant === 'recovery') return RECOVERY_BLOCKS;
    if (variant === 'rehab') { const inj = openInjuries(a).find((i) => i.path !== 'light') || openInjuries(a)[0]; return inj ? rehabPlanFor(inj) : RECOVERY_BLOCKS; }
    return (sess.blocks || []).map((b) => { const ex = AMS.byId(AMS.db.exercises, b.exerciseId); return [ex ? ex.name : b.exerciseId, (b.dose || (ex && ex.dose) || '') + (variant === 'reduced' ? ' · −40%' : '')]; });
  }
  function modReason(a) {
    const r = C.readiness(a), acwr = C.acwr(a);
    const parts = [];
    if (r.band === 'bad') parts.push('readiness is red (' + r.score + ')');
    else if (r.band === 'warn') parts.push('readiness is amber (' + r.score + ')');
    if (acwr >= 1.3) parts.push('this week\'s load is ' + Math.round((acwr - 1) * 100) + '% above your 4-week normal');
    if (a.availability !== 'Available') parts.push('you are on ' + a.availability.toLowerCase() + ' training');
    const comp = nextCompetition(a);
    return parts.length ? 'Because your ' + parts.join(' and ') + '.' + (comp && D.diff(comp.date, AMS.TODAY) <= 30 ? ' The aim is to have you fresh for ' + comp.name + ' (' + D.fmt(comp.date) + ').' : '') : 'Based on today\'s readiness and your recent load.';
  }

  /** The athlete-facing AI explanation of today's readiness: specific, evidence-backed, compared with their own normal. */
  function aiTip(a) {
    const r = C.readiness(a), w = C.todayWellness(a) || {}, base = C.wellnessBaseline(a), acwr = C.acwr(a);
    const score = C.wellnessScore(w);
    const diff = base && score != null ? Math.round(score - base) : 0;
    const usual = AMS.round(usualSleep(a), 1);
    const sess = AMS.todaySessionFor(a), variant = variantOf(sess, a);
    const lines = [], ev = [];
    if (base && score != null) ev.push({ label: 'Today vs your normal', value: (diff >= 0 ? '+' : '') + diff + ' pts', tone: diff <= -12 ? 'bad' : diff < -5 ? 'warn' : 'good' });
    if (w.sleepHrs != null) ev.push({ label: 'Sleep', value: w.sleepHrs + ' h (usual ' + usual + ')', tone: w.sleepHrs < usual - 0.7 ? 'warn' : 'good' });
    ev.push({ label: 'ACWR', value: acwr.toFixed(2), tone: C.acwrBand(acwr) });
    if (w.soreness != null) ev.push({ label: 'Soreness', value: w.soreness + '/5', tone: w.soreness <= 2 ? 'bad' : w.soreness === 3 ? 'warn' : 'good' });
    if (base && score != null && diff <= -12) lines.push('Your answers are ' + Math.abs(diff) + ' points below your own normal of ' + Math.round(base) + ', so the app compares you with you, not with the squad.');
    if (w.sleepHrs != null && w.sleepHrs < usual - 0.7) lines.push('You slept ' + w.sleepHrs + ' h, about ' + AMS.round(usual - w.sleepHrs, 1) + ' h less than usual. Aim for lights out by 22:00 tonight and a 20-minute nap after lunch.');
    if (acwr >= 1.5) lines.push('Your training load this week is ' + Math.round((acwr - 1) * 100) + '% above your 4-week normal (ACWR ' + acwr.toFixed(2) + '). ' + coachName(a) + ' can see this and may lighten today\'s session.');
    else if (acwr > 1.3) lines.push('Load is climbing (ACWR ' + acwr.toFixed(2) + '). Keep recovery habits tight this week.');
    if (w.soreness != null && w.soreness <= 2) lines.push('Soreness is ' + w.soreness + '/5. If it feels sharp, one-sided or gets worse when you sprint, mark it under "Any pain?" so the physio checks it.');
    if ((w.mood != null && w.mood <= 2) || (w.stress != null && w.stress <= 2)) lines.push('Mood or stress is low today. Your coach sees a flag. Talk to them, or to the centre counsellor (10:00–17:00), if something is on your mind.');
    const flagged = AMS.db.injuries.filter((i) => i.athleteId === a.id && i.status !== 'Closed' && i.dateOfInjury === AMS.TODAY && i.source === 'athlete-app');
    if (flagged.length) {
      const what = flagged.map((i) => (seesDiagnosis(a) ? i.regionLabel.toLowerCase() : AMS.bodyZone(i.region)) + (painToday(i) != null ? ' (' + painToday(i) + '/10)' : '')).join(' and ');
      lines.push('You flagged ' + what + '. ' + ((physioOf(a) || {}).name || 'The physio') + ' will check it before training.');
      ev.push({ label: 'Pain flags', value: String(flagged.length), tone: 'warn' });
    }
    if (variant !== 'none' && sess) lines.push(coachName(a) + ' has already switched you to ' + VARIANT_SHORT[variant].toLowerCase() + ' for ' + sess.title + '.');
    if (!lines.length) lines.push((diff >= 0 ? 'All five answers are at or above your normal.' : 'Your answers are close to your normal (' + diff + ' pts).') + ' Hydrate well, about ' + fmtL(defaultWaterTarget(a)) + ' today, and train as planned.');
    else if (r.band === 'good' && !flagged.length && lines.length === 1 && variant === 'none') lines.push('Overall you are in a good place to train as planned.');
    const headline = { good: 'Good to go: train as planned', warn: 'Take it steady today', bad: 'Your body is asking for recovery today' }[r.band];
    return { headline, lines: lines.slice(0, 4), ev: ev.slice(0, 5), confidence: w.sleep ? 0.86 : 0.6 };
  }

  /** Home-screen to-do list, derived from the shared record (same data the staff see). */
  function tasksFor(a) {
    const out = [];
    const sess = AMS.todaySessionFor(a);
    const role = AMS.ui.role;
    if (tabAccess('checkin', role).ok && !C.todayWellness(a)) out.push({ id: 'chk', icon: 'heart', tone: 'warn', title: 'Morning check-in', sub: 'About 30 seconds · ' + coachName(a) + ' sees it before ' + (sess ? sess.start : 'training'), tab: 'checkin' });
    if (tabAccess('session', role).ok && sess && variantOf(sess, a) !== 'excluded' && !(sess.rpe || {})[a.id] && sessionOver(sess)) out.push({ id: 'rpe', icon: 'run', tone: 'accent', title: 'Rate today\'s session', sub: sess.title + ' · one tap', tab: 'session' });
    if (tabAccess('rehab', role).ok) {
      openInjuries(a).forEach((i) => {
        if (painToday(i) == null && ['Rehab', 'Monitoring', 'Clearance'].includes(i.status)) out.push({ id: 'pain:' + i.id, icon: 'pulse', tone: 'info', title: 'Log today\'s pain score', sub: seesDiagnosis(a) ? i.regionLabel : AMS.bodyZone(i.region), tab: 'rehab' });
        const plan = rehabPlanFor(i), done = doneToday(i);
        if (i.status === 'Rehab' && plan.length && done.length < plan.length) out.push({ id: 'rehab:' + i.id, icon: 'medical', tone: 'info', title: 'Today\'s rehab: ' + done.length + '/' + plan.length + ' done', sub: ((i.rtpStages || [])[i.rtpStage] || {}).name || 'Rehab', tab: 'rehab' });
      });
    }
    AMS.db.tasks.filter((t) => t.status === 'Open' && t.ownerRole === 'athlete' && t.athleteId === a.id).forEach((t) => out.push({ id: t.id, icon: 'upload', tone: 'warn', title: t.title.replace(/ — .*$/, ''), sub: 'Due ' + D.fmt(t.due) + ' · ' + D.rel(t.due), tab: 'me' }));
    return out;
  }

  /* ================================================================== workflow actions */
  function submitCheckin(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    if (AMS.ui.role === 'athlete' && !isOwn(a.id)) return denied('You can only check in for yourself');
    if (AMS.ui.role !== 'athlete' && !AMS.can('readiness', 'view')) return denied(AMS.roleLabel(AMS.ui.role) + ' cannot record wellness data');
    if (SCALE_KEYS.some((k) => !(+p[k] >= 1 && +p[k] <= 5))) return denied('Answer all five questions first');
    const prev = C.todayWellness(a);
    const prevBand = prev ? C.readiness(a).band : null;
    const entry = { sleep: +p.sleep, soreness: +p.soreness, mood: +p.mood, stress: +p.stress, energy: +p.energy, sleepHrs: AMS.round(AMS.clamp(+p.sleepHrs || 7.5, 3, 12), 1), at: AMS.clockTime() };
    const note = String(p.note || '').trim().slice(0, 240);
    if (note) entry.note = note;
    let after = null;
    AMS.mutate((db) => {
      const x = AMS.byId(db.athletes, a.id);
      x.wellness[27] = entry;
      after = C.readiness(x);
      if (after.band === 'bad' && prevBand !== 'bad') {
        const why = SCALES.filter((s) => entry[s.key] <= 2).map((s) => s.label.toLowerCase() + ' ' + entry[s.key] + '/5').concat(entry.sleepHrs < 6.5 ? [entry.sleepHrs + ' h sleep'] : []).join(', ');
        const sess = AMS.todaySessionFor(x);
        AMS.notify({ toRole: 'coach', title: 'Red check-in: ' + x.name, text: x.name + ' checked in red (' + after.score + ')' + (why ? ': ' + why : '') + '.' + (sess ? ' Today: ' + sess.title + ' ' + sess.start + '.' : '') + (note ? ' Note: "' + note + '"' : ''), athleteId: x.id, module: 'dashboard' });
      }
      AMS.log(actLog(x, x.name + (prev ? ' updated today\'s check-in' : ' completed the morning check-in') + ' — readiness ' + after.score + ' (' + C.bandLabel(after.band).toLowerCase() + ')', 'checkin'));
    });
    if (!after) return null;
    const spots = (p.pains || []).filter((s) => s && s.region);
    const flagged = spots.map((s) => flagPain(a, s, note)).filter(Boolean);
    AMS.toast('Check-in sent · readiness ' + after.score + ' (' + C.bandLabel(after.band) + ')' + (flagged.length ? ' · ' + flagged.length + ' pain flag' + (flagged.length > 1 ? 's' : '') + ' sent to the physio' : ''), after.band === 'bad' ? 'info' : 'good');
    return 'Readiness ' + after.score + ' (' + C.bandLabel(after.band) + ')' + (flagged.length ? ', ' + flagged.length + ' pain flag(s)' : '');
  }

  /** One pain spot from the check-in: adds to an existing case's pain log, or opens a light-path flag (medical module), or falls back to a Reported injury. */
  function flagPain(a, spot, note) {
    const side = CENTER.has(spot.region) ? 'C' : (spot.side || 'C');
    const pain = AMS.clamp(Math.round(+spot.pain || 0), 0, 10);
    const label = regionLabel(spot.region, side);
    const existing = matchOpen(a, { region: spot.region, side });
    if (existing) {
      AMS.mutate((db) => {
        const x = AMS.byId(db.injuries, existing.id);
        x.painLog = (x.painLog || []).filter((e) => e.date !== AMS.TODAY).concat({ date: AMS.TODAY, pain });
        x.timeline.unshift({ date: AMS.TODAY, type: 'note', by: a.name + ' (athlete app)', text: 'Morning check-in: ' + label.toLowerCase() + ' pain ' + pain + '/10' });
        AMS.notify({ toRole: 'physio', title: 'Pain update from check-in', text: a.name + ' — ' + x.regionLabel + ' pain ' + pain + '/10 at morning check-in.', athleteId: a.id, module: 'medical' });
        AMS.log(actLog(a, 'Pain ' + pain + '/10 logged at check-in — ' + a.name, 'medical'));
      });
      return existing.id;
    }
    const text = label + ' — ' + pain + '/10 at morning check-in' + (note ? '. Athlete note: "' + note + '"' : '');
    if (AMS.actions['injury.flagLight']) {
      const id = AMS.runAction('injury.flagLight', { athleteId: a.id, region: spot.region, side, pain, note: text, source: 'athlete-app', type: 'Tightness / niggle' });
      if (id && typeof id === 'string') {
        const viaStaff = AMS.ui.role !== 'athlete';
        const meNm = (AMS.me() || {}).name;
        AMS.mutate((db) => {
          // Staff previewing the phone act on the athlete's behalf: attribute the report to the athlete, not to the previewer.
          if (viaStaff && meNm) {
            db.activity.slice(0, 4).forEach((x) => { if (x.athleteId === a.id && x.by === meNm && /flag|injur/i.test(x.text)) { x.by = a.name; x.role = 'athlete'; } });
            db.notifications.slice(0, 4).forEach((n) => { if (n.athleteId === a.id && n.text && n.text.indexOf('Reported by ' + meNm) >= 0) n.text = n.text.replace('Reported by ' + meNm, 'Reported by ' + a.name + ' (athlete app)'); });
          }
          const inj = AMS.byId(db.injuries, id);
          if (!inj) return;
          inj.source = 'athlete-app';
          inj.reportedBy = a.name + ' (athlete app)';
          (inj.timeline || []).forEach((t) => { if (t.type === 'report') t.by = a.name + ' (athlete app)'; });
          (inj.notes || []).forEach((n) => { if (n.date === AMS.TODAY && viaStaff) { n.by = a.name; n.role = 'athlete'; } });
          if (AMS.ui.role === 'coach') AMS.notify({ toRole: 'coach', title: 'Athlete being monitored', text: a.name + ': ' + AMS.medicalLabel(inj, 'coach') + '. Physio will update availability.', athleteId: a.id, module: 'medical' });
        });
      }
      return id || null;
    }
    // Fallback (medical module not loaded): a Reported injury following the CONTRACT shape, physio + coach notified.
    let id = null;
    AMS.mutate((db) => {
      id = AMS.uid('INJ');
      const tpl = AMS.rtpTemplateFor(spot.region, 'Tightness / niggle');
      const stages = AMS.makeRtpStages(tpl);
      const physio = physioOf(a), doctor = staffAt('doctor', a);
      const inj = {
        id, athleteId: a.id, region: spot.region, side, view: BACK_REGIONS.has(spot.region) ? 'back' : 'front', regionLabel: label,
        diagnosis: 'Reported in check-in: tightness, ' + label.toLowerCase() + ' — awaiting assessment', type: 'Tightness / niggle', grade: null, severity: pain >= 7 ? 'moderate' : 'minor',
        mechanism: 'Reported in morning check-in', context: 'Training', dateOfInjury: AMS.TODAY, status: 'Reported', path: 'case', availability: a.availability,
        reportedBy: a.name + ' (athlete app)', reportedAt: AMS.TODAY + 'T' + AMS.clockTime(), physioId: physio ? physio.id : null, doctorId: doctor ? doctor.id : null,
        rtpTemplate: tpl, rtpStages: stages, rtpStage: 0, stageSince: null, stageTargetDays: stages[0].targetDays, expectedReturn: null,
        timeline: [{ date: AMS.TODAY, type: 'report', by: a.name + ' (athlete app)', text: 'Injury reported: ' + text }], notes: [], painLog: [{ date: AMS.TODAY, pain }], clearance: null, setbacks: 0, source: 'athlete-app',
      };
      db.injuries.push(inj);
      AMS.notify({ toRole: 'physio', title: 'New injury to assess', text: a.name + ' — ' + label + ', pain ' + pain + '/10 (athlete app, ' + AMS.clockTime() + ').', athleteId: a.id, module: 'medical' });
      AMS.notify({ toRole: 'coach', title: 'Injury reported', text: a.name + ': ' + AMS.medicalLabel(inj, 'coach') + '. Physio will update availability.', athleteId: a.id, module: 'medical' });
      AMS.log(actLog(a, 'Pain reported in check-in — ' + a.name + ' (' + AMS.bodyZone(spot.region) + ')', 'injury'));
    });
    return id;
  }

  /** Post-session RPE (Borg CR-10). sRPE load = RPE × minutes × variant scale, recorded once (the coach's session.complete sees loadRecorded and does not double-count). */
  function recordRpe(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    if (AMS.ui.role === 'athlete' && !isOwn(a.id)) return denied('You can only rate your own sessions');
    if (AMS.ui.role !== 'athlete' && !AMS.can('training', 'view')) return denied(AMS.roleLabel(AMS.ui.role) + ' cannot record training data');
    const s = p.sessionId ? AMS.byId(AMS.db.sessions, p.sessionId) : AMS.todaySessionFor(a);
    if (!s) return denied('No session to rate today');
    if (s.date !== AMS.TODAY) return denied('Only today\'s session can be rated in the app');
    const variant = variantOf(s, a);
    if (variant === 'excluded') return denied(first(a) + ' was rested from this session');
    if (!(+p.rpe >= 1 && +p.rpe <= 10)) return denied('Pick how hard it felt, 1 to 10');
    const rpe = Math.round(+p.rpe);
    const load = Math.round(rpe * (s.duration || 0) * variantScale(variant));
    let next = null, changed = false;
    AMS.mutate((db) => {
      const x = AMS.byId(db.sessions, s.id);
      x.rpe = x.rpe || {}; x.rpeApp = x.rpeApp || {}; x.attendance = x.attendance || {};
      const rec = x.loadRecorded || (x.loadRecorded = {});
      changed = x.rpe[a.id] != null;
      x.rpe[a.id] = rpe; x.rpeApp[a.id] = AMS.clockTime();
      if (!x.attendance[a.id]) x.attendance[a.id] = 'present';
      const delta = load - (rec[a.id] || 0);
      if (delta) C.recordLoad(db, a.id, delta, 41);
      rec[a.id] = load;
      const live = AMS.byId(db.athletes, a.id);
      next = C.acwr(live, 41);
      if (next >= 1.5) AMS.notify({ toRole: 'scientist', title: 'Load jump after today\'s session', text: a.name + ' rated ' + s.title + ' ' + rpe + '/10 (' + load + ' AU). Projected ACWR tomorrow ' + next.toFixed(2) + '.', athleteId: a.id, module: 'science' });
      AMS.log(actLog(live, a.name + (changed ? ' changed' : ' rated') + ' ' + s.title + ' RPE ' + rpe + '/10 → ' + load + ' AU (athlete app)', 'training'));
    });
    AMS.toast('Effort ' + rpe + '/10 saved · ' + load + ' AU added to your training load', 'good');
    return 'RPE ' + rpe + ' · ' + load + ' AU' + (next != null ? ' · ACWR tomorrow ' + next.toFixed(2) : '');
  }

  function rehabPain(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!isOwn(inj.athleteId) && !AMS.medicalFull()) return denied('Pain scores come from the athlete or medical staff only');
    if (AMS.actions['injury.logPain']) return AMS.runAction('injury.logPain', { injuryId: inj.id, pain: p.pain });
    const a = ath(inj.athleteId), pain = AMS.clamp(Math.round(+p.pain || 0), 0, 10);
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      x.painLog = (x.painLog || []).filter((e) => e.date !== AMS.TODAY).concat({ date: AMS.TODAY, pain });
    }, { toast: 'Pain ' + pain + '/10 recorded', log: actLog(a, 'Pain score ' + pain + '/10 — ' + a.name, 'medical') });
    return 'Pain recorded';
  }

  function rehabExercise(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj || !p.name) return null;
    if (!isOwn(inj.athleteId) && !AMS.medicalFull()) return denied('Only the athlete or medical staff can tick rehab exercises');
    const a = ath(inj.athleteId);
    const plan = rehabPlanFor(inj);
    let completed = false, nowDone = false;
    AMS.mutate((db) => {
      const st = appState(db);
      const byDay = st.rehabDone[inj.id] || (st.rehabDone[inj.id] = {});
      const list = (byDay[AMS.TODAY] || []).slice();
      const k = list.indexOf(p.name);
      if (k >= 0) list.splice(k, 1); else { list.push(p.name); nowDone = true; }
      byDay[AMS.TODAY] = list;
      completed = nowDone && plan.length > 0 && plan.every(([n]) => list.includes(n));
      if (completed) {
        const x = AMS.byId(db.injuries, inj.id);
        const stage = (x.rtpStages || [])[x.rtpStage];
        x.timeline.unshift({ date: AMS.TODAY, type: 'note', by: a.name + ' (athlete app)', text: 'Completed today\'s rehab: ' + plan.length + '/' + plan.length + ' exercises' + (stage ? ' (stage ' + (x.rtpStage + 1) + ', ' + stage.name + ')' : '') });
        AMS.notify({ toRole: 'physio', title: 'Rehab done', text: a.name + ' completed today\'s rehab (' + plan.length + ' exercises).', athleteId: a.id, module: 'medical' });
        AMS.log(actLog(a, a.name + ' completed today\'s rehab exercises (athlete app)', 'medical'));
      }
    });
    if (completed) AMS.toast('All rehab done for today. ' + (physioOf(a) ? physioOf(a).name.split(' ')[0] : 'The physio') + ' has been told.', 'good');
    return nowDone ? 'Ticked' : 'Unticked';
  }

  function logWater(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    if (AMS.ui.role === 'athlete' && !isOwn(a.id)) return denied('You can only log your own water');
    if (AMS.ui.role !== 'athlete' && !AMS.can('nutrition', 'view')) return denied(AMS.roleLabel(AMS.ui.role) + ' cannot record nutrition data');
    const ml = AMS.clamp(Math.round(+p.ml || 250), 50, 2000);
    if (AMS.actions['nutrition.logHydration']) return AMS.runAction('nutrition.logHydration', { athleteId: a.id, ml });
    const before = hydrationOf(a);
    AMS.mutate((db) => {
      const st = appState(db);
      (st.water[a.id] = st.water[a.id] || []).push({ date: AMS.TODAY, at: AMS.clockTime(), ml });
      st.water[a.id] = st.water[a.id].filter((e) => D.diff(AMS.TODAY, e.date) <= 14);
      if (before.ml < before.target && before.ml + ml >= before.target) AMS.log(actLog(a, a.name + ' reached today\'s water target (' + fmtL(before.target) + ')', 'nutrition'));
    });
    AMS.toast('+' + ml + ' ml · ' + fmtL(before.ml + ml) + ' of ' + fmtL(before.target), 'good');
    return 'Logged ' + ml + ' ml';
  }

  function requestSupplement(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    if (AMS.ui.role === 'athlete' && !isOwn(a.id)) return denied('You can only request supplements for yourself');
    if (AMS.ui.role !== 'athlete' && !AMS.can('nutrition', 'view')) return denied(AMS.roleLabel(AMS.ui.role) + ' cannot handle supplement requests');
    if (AMS.actions['nutrition.requestSupplement']) return AMS.runAction('nutrition.requestSupplement', { athleteId: a.id, productId: p.productId, reason: p.reason });
    const prod = registryList().find((x) => x.id === p.productId);
    if (!prod) return denied('Pick a product first');
    if (supplementsOf(a).some((r) => r.productId === prod.id && !/Reject/.test(r.status))) return denied(prod.product + ' is already requested');
    const nut = nutritionistOf(a);
    AMS.mutate((db) => {
      appState(db).supplements.unshift({ id: AMS.uid('SRQ'), athleteId: a.id, productId: prod.id, product: prod.product, tested: !!prod.tested, reason: String(p.reason || '').slice(0, 200), status: 'Requested', requested: AMS.TODAY, at: AMS.clockTime() });
      AMS.notify({ toRole: 'nutritionist', title: 'Supplement request', text: a.name + ' requested ' + prod.product + (prod.tested ? '.' : ' — NOT batch-tested (anti-doping risk).') + (p.reason ? ' Reason: ' + p.reason : ''), athleteId: a.id, module: 'nutrition' });
      AMS.log(actLog(a, a.name + ' requested ' + prod.product + ' (athlete app)', 'nutrition'));
    });
    AMS.toast('Request sent to ' + (nut ? nut.name : 'the nutritionist'), prod.tested ? 'good' : 'info');
    return 'Requested';
  }

  function uploadDoc(p) {
    const a = ath(p.athleteId);
    if (!a || !p.type) return null;
    if (AMS.ui.role === 'athlete' && !isOwn(a.id)) return denied('You can only upload your own documents');
    if (AMS.ui.role !== 'athlete' && AMS.access('documents') === 'none') return denied(AMS.roleLabel(AMS.ui.role) + ' cannot handle athlete documents');
    if (AMS.actions['athlete.uploadDoc']) return AMS.runAction('athlete.uploadDoc', { athleteId: a.id, type: p.type, quality: p.quality || 'clear' });
    const ok = (p.quality || 'clear') === 'clear';
    const ai = ok ? { ok: true, confidence: 0.94, note: 'Readable; name and date of birth match the profile' } : { ok: false, confidence: 0.44, note: 'Image blurred — fields unreadable; retake in good light' };
    AMS.mutate((db) => {
      const x = AMS.byId(db.athletes, a.id);
      x.docs.push({ id: AMS.uid(x.id + '-D'), type: p.type, status: ok ? 'Pending' : 'Flagged', on: AMS.TODAY, ai });
      if (ok) {
        const i = x.missingFields.indexOf(p.type);
        if (i >= 0) { x.missingFields.splice(i, 1); x.profileCompletion = x.missingFields.length ? Math.min(99, x.profileCompletion + 4) : 100; }
        db.tasks.forEach((t) => { if (t.status === 'Open' && t.athleteId === x.id && t.title.toLowerCase().includes(p.type.toLowerCase())) t.status = 'Done'; });
      }
      AMS.log(actLog(x, p.type + ' uploaded by ' + x.name + ' · AI ' + (ok ? 'pass' : 'flag'), 'document'));
    }, { toast: ok ? p.type + ' uploaded, AI pre-check passed' : p.type + ' flagged by AI: ' + ai.note, toastKind: ok ? 'ai' : 'bad' });
    return ok ? 'Passed' : 'Flagged';
  }

  function updateProfile(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    if (!isOwn(a.id) && !AMS.canEdit('athletes')) return denied('Only the athlete or Operations can edit the profile');
    if (AMS.actions['athlete.updateProfile']) return AMS.runAction('athlete.updateProfile', { athleteId: a.id, patch: p.patch });
    AMS.mutate((db) => {
      const x = AMS.byId(db.athletes, a.id);
      Object.assign(x, p.patch || {});
      if (p.field) { const i = x.missingFields.indexOf(p.field); if (i >= 0) x.missingFields.splice(i, 1); x.profileCompletion = x.missingFields.length ? Math.min(99, x.profileCompletion + 4) : 100; }
    }, { toast: 'Profile updated', log: actLog(a, a.name + ' updated their profile (athlete app)', 'profile') });
    return 'Saved';
  }

  function consentRequest(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    AMS.mutate((db) => {
      db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Collect guardian consent — ' + a.name, ownerRole: 'ops', module: 'athletes', status: 'Open', created: AMS.TODAY, due: D.add(AMS.TODAY, 3), athleteId: a.id });
      AMS.notify({ toRole: 'ops', title: 'Consent link requested', text: a.name + ' asked for a consent link to be sent to ' + ((a.guardian && a.guardian.name) || 'their guardian') + '.', athleteId: a.id, module: 'athletes' });
    }, { toast: 'Consent link requested — Operations will send it to your guardian', log: actLog(a, a.name + ' requested a guardian consent link', 'profile') });
    return 'Requested';
  }

  function markRead(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    const ids = new Set(notificationsFor(a).filter((n) => !n.read && (!p.ids || p.ids.includes(n.id))).map((n) => n.id));
    if (!ids.size) return '0';
    AMS.mutate((db) => { db.notifications.forEach((n) => { if (ids.has(n.id)) n.read = true; }); });
    return ids.size + ' read';
  }

  function clearCheckin(p) {
    const a = ath(p.athleteId);
    if (!a || !C.todayWellness(a)) return null;
    if (AMS.ui.role === 'athlete' || !AMS.can('readiness', 'view')) return denied('Not available in this role');
    AMS.mutate((db) => { AMS.byId(db.athletes, a.id).wellness[27] = null; }, { toast: first(a) + '\'s check-in cleared (demo) — try it again on the phone', toastKind: 'info' });
    return 'Cleared';
  }

  AMS.registerAction('app.checkin', submitCheckin);
  AMS.registerAction('app.rpe', recordRpe);
  AMS.registerAction('app.rehabPain', rehabPain);
  AMS.registerAction('app.rehabExercise', rehabExercise);
  AMS.registerAction('app.hydration', logWater);
  AMS.registerAction('app.supplementRequest', requestSupplement);
  AMS.registerAction('app.uploadDoc', uploadDoc);
  AMS.registerAction('app.profile', updateProfile);
  AMS.registerAction('app.consentRequest', consentRequest);
  AMS.registerAction('app.markRead', markRead);
  AMS.registerAction('app.clearCheckin', clearCheckin);
  AMS.registerAction('app.open', (p) => { AMS.go(MOD, { athleteId: p.athleteId, tab: p.tab }); return 'Opened'; });

  AMS.registerSeed('athleteApp', function (db) {
    db.athleteApp = { water: {}, rehabDone: {}, supplements: [] };
    const hero = db.athletes.find((a) => a.id === db.meta.heroAthleteId);
    if (hero) db.athleteApp.water[hero.id] = [{ date: AMS.TODAY, at: '06:35', ml: 250 }, { date: AMS.TODAY, at: '06:58', ml: 250 }];
  });

  /* ================================================================== small UI pieces */
  function Lock({ reason }) {
    return html`<div className="aa-lock">
      <${UI.Icon} name="lock" size=${26} />
      <div style=${{ fontWeight: 600, color: 'var(--fg-2)' }}>Not visible in your role</div>
      <div className="small">${reason}</div>
      <div className="tiny">The athlete sees this screen on their own phone. Switch role to Athlete or Coach to preview it.</div>
    </div>`;
  }
  function Label({ children, right }) {
    return html`<div className="row between"><span className="tiny faint upper">${children}</span>${right}</div>`;
  }
  function ModBanner({ a, sess, compact }) {
    const m = (sess && sess.mods || {})[a.id];
    if (!m) return null;
    const by = m.by === 'coach' ? coachName(a) : m.by === 'auto' ? 'Set automatically from your availability' : AMS.roleLabel(m.by);
    return html`<div className=${'aa-banner ' + (VARIANT_TONE[m.variant] || '')}>
      <${UI.Icon} name="info" size=${16} style=${{ flex: 'none', marginTop: 1 }} />
      <div className="col tight" style=${{ gap: 2 }}>
        <b style=${{ fontSize: 13 }}>Coach adjusted your session: ${VARIANT_SHORT[m.variant] || m.variant}</b>
        ${!compact && html`<span className="tiny muted">${by}${m.at ? ' at ' + m.at : ''}. ${modReason(a)}</span>`}
      </div>
    </div>`;
  }

  /* ================================================================== phone screens */
  function Home({ a, go }) {
    const role = AMS.ui.role;
    const canReady = tabAccess('checkin', role).ok, canTrain = tabAccess('session', role).ok, canFuel = tabAccess('fuel', role).ok;
    const w = C.todayWellness(a), r = C.readiness(a);
    const sess = AMS.todaySessionFor(a), variant = variantOf(sess, a);
    const tasks = tasksFor(a);
    const hyd = canFuel ? hydrationOf(a) : null;
    const comp = nextCompetition(a), camp = a.tempAssignment;
    const hour = minutesOf(AMS.clockTime()) / 60;
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const rated = sess && (sess.rpe || {})[a.id];
    return html`<${Frag}>
      <div className="col tight" style=${{ gap: 2 }}><span className="tiny faint upper">${D.fmtLong(AMS.TODAY)}</span><h2 className="aa-h1">${greet}, ${first(a)}</h2></div>
      ${!canReady && html`<div className="aa-banner"><${UI.Icon} name="lock" size=${15} style=${{ flex: 'none' }} /><span className="tiny">Previewing as ${AMS.roleLabel(role)}: you see ${first(a)}'s profile, tasks and documents only. Wellness, training, medical and nutrition screens stay hidden.</span></div>`}
      ${canReady && (w ? html`<button className="aa-card aa-tap" onClick=${() => go('checkin')}>
          <div className="aa-row">
            <${UI.Ring} value=${r.score} tone=${r.band} size=${60} thickness=${6} />
            <div className="col tight grow" style=${{ gap: 2, minWidth: 0 }}>
              <span className="tiny faint upper">Today's readiness</span>
              <span className=${r.band} style=${{ fontWeight: 600, fontSize: 15 }}>${C.bandLabel(r.band)} · ${bandWords(r.band)}</span>
              <span className="tiny muted">Checked in ${w.at} · your normal is ${Math.round(C.wellnessBaseline(a))}</span>
            </div>
            <${UI.Icon} name="chev-r" size=${16} />
          </div>
        </button>` : html`<div className="aa-card" style=${{ borderColor: 'var(--accent)' }}>
          <div className="aa-row"><span className="aa-ico accent"><${UI.Icon} name="heart" size=${18} /></span>
            <div className="col tight grow" style=${{ gap: 1 }}><b>Morning check-in</b><span className="tiny muted">5 taps, about 30 seconds. ${coachName(a)} sees it before ${sess ? sess.start : 'training'}.</span></div></div>
          <button className="btn primary aa-big" onClick=${() => go('checkin')}>Check in now</button>
        </div>`)}
      ${canTrain && html`<div className="aa-card">
        <${Label} right=${sess && html`<span className="tiny faint">${sess.start}–${endTime(sess)}</span>`}>Today's session<//>
        ${sess ? html`<${Frag}>
          <div className="aa-row"><span className=${'aa-ico ' + (variant === 'none' ? '' : VARIANT_TONE[variant] || '')}><${UI.Icon} name=${variant === 'none' || variant === 'reduced' ? 'run' : variant === 'excluded' ? 'bed' : 'refresh'} size=${18} /></span>
            <div className="col tight grow" style=${{ gap: 1, minWidth: 0 }}><b className="ellipsis">${variant === 'none' || variant === 'reduced' ? sess.title : VARIANT_SHORT[variant]}</b><span className="tiny muted ellipsis">${sess.location} · ${sess.duration} min${variant === 'none' ? ' · ' + String(sess.intensity).toLowerCase() + ' intensity' : ''}</span></div>
            ${rated && html`<${UI.Pill} tone="good">RPE ${rated}<//>`}</div>
          ${variant !== 'none' && html`<${ModBanner} a=${a} sess=${sess} compact=${true} />`}
          <button className="btn sm" onClick=${() => go('session')}>Session details<${UI.Icon} name="chev-r" size=${13} /></button>
        <//>` : html`<span className="small muted">No session for your squad today. Rest day.</span>`}
      </div>`}
      ${tasks.length > 0 && html`<div className="aa-card" style=${{ gap: 4 }}>
        <${Label} right=${html`<span className="tiny faint">${tasks.length}</span>`}>To do<//>
        ${tasks.map((t) => html`<button key=${t.id} className="aa-task" onClick=${() => go(t.tab)}>
          <span className=${'aa-ico ' + (t.tone || '')} style=${{ width: 30, height: 30 }}><${UI.Icon} name=${t.icon} size=${15} /></span>
          <span className="col tight grow" style=${{ gap: 0, minWidth: 0 }}><span className="ellipsis" style=${{ fontWeight: 600, fontSize: 13 }}>${t.title}</span>${t.sub && html`<span className="tiny muted ellipsis">${t.sub}</span>`}</span>
          <${UI.Icon} name="chev-r" size=${14} />
        </button>`)}
      </div>`}
      ${(canReady || hyd) && html`<div className="aa-two">
        ${canReady && html`<div className="aa-card aa-mini"><span className="tiny faint upper">Check-in streak</span><span className="num" style=${{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>${streakOf(a)}<small className="faint" style=${{ fontSize: 12, marginLeft: 4 }}>days</small></span><span className="tiny muted">${streakOf(a) >= 7 ? 'Keep it going' : 'Every morning counts'}</span></div>`}
        ${hyd && html`<button className="aa-card aa-mini aa-tap" onClick=${() => go('fuel')}><span className="tiny faint upper">Water today</span><span className="num" style=${{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>${fmtL(hyd.ml)}</span><div className="aa-water"><i style=${{ width: AMS.clamp(Math.round((hyd.ml / hyd.target) * 100), 0, 100) + '%' }} /></div><span className="tiny muted">of ${fmtL(hyd.target)}</span></button>`}
      </div>`}
      ${(comp || camp) && html`<div className="aa-card">
        ${comp && html`<div className="aa-row"><span className="aa-ico"><${UI.Icon} name="flag" size=${15} /></span><div className="col tight grow" style=${{ gap: 0, minWidth: 0 }}><b className="ellipsis" style=${{ fontSize: 13 }}>${comp.name}</b><span className="tiny muted">${comp.location} · ${D.fmt(comp.date)} · ${D.rel(comp.date)}</span></div></div>`}
        ${camp && html`<div className="aa-row"><span className="aa-ico accent"><${UI.Icon} name="pin" size=${15} /></span><div className="col tight grow" style=${{ gap: 0, minWidth: 0 }}><b className="ellipsis" style=${{ fontSize: 13 }}>${camp.label}</b><span className="tiny muted">${(AMS.org.centre(camp.centreId) || {}).short} · ${D.fmt(camp.from)} to ${D.fmt(camp.to)} · ${camp.active ? 'you are on camp now' : 'starts ' + D.rel(camp.from)}</span></div></div>`}
      </div>`}
    <//>`;
  }

  function PainPicker({ a, spots, sel, onPick, setSpots }) {
    const BM = UI.BodyMap;
    const open = openInjuries(a);
    const marks = open.map((i) => ({ id: i.id, region: i.region, side: i.side, severity: i.severity, status: i.status, label: 'Already being treated' }))
      .concat(spots.map((s, k) => ({ id: 'spot' + k, region: s.region, side: s.side, severity: s.pain >= 7 ? 'severe' : s.pain >= 4 ? 'moderate' : 'minor', status: 'New', label: 'Today: pain ' + s.pain + '/10' })));
    const setPain = (k, v) => setSpots((l) => l.map((s, i) => (i === k ? Object.assign({}, s, { pain: v }) : s)));
    const remove = (k) => setSpots((l) => l.filter((_, i) => i !== k));
    return html`<div className="col" style=${{ gap: 10 }}>
      ${BM ? html`<div className="aa-bm"><${BM} marks=${marks} selected=${sel} onSelect=${onPick} compact=${true} height=${250} showLegend=${false} layer="current" /></div>`
        : html`<div className="aa-regions">${REGION_FALLBACK.map((id) => CENTER.has(id)
          ? html`<button key=${id} className="btn sm" onClick=${() => onPick(id, 'C', regionLabel(id, 'C'))}>${REGION_NAMES[id]}</button>`
          : html`<${Frag} key=${id}><button className="btn sm" onClick=${() => onPick(id, 'L', regionLabel(id, 'L'))}>L ${REGION_NAMES[id]}</button><button className="btn sm" onClick=${() => onPick(id, 'R', regionLabel(id, 'R'))}>R ${REGION_NAMES[id]}</button><//>`)}</div>`}
      <span className="tiny faint" style=${{ textAlign: 'center' }}>Tap where it hurts. Both sides tight? Tap both.</span>
      ${spots.map((s, k) => { const ex = matchOpen(a, s); return html`<div key=${s.region + ':' + s.side} className="aa-spot">
        <div className="row between"><b style=${{ fontSize: 13 }}>${s.label}</b><button className="btn ghost xs icon" aria-label=${'Remove ' + s.label} onClick=${() => remove(k)}><${UI.Icon} name="x" size=${12} /></button></div>
        <div className="aa-pain" role="radiogroup" aria-label=${'Pain for ' + s.label}>${PAIN.map((n) => html`<button key=${n} type="button" role="radio" aria-checked=${s.pain === n} className=${s.pain === n ? 'on' : ''} onClick=${() => setPain(k, n)}>${n}</button>`)}</div>
        <span className="tiny faint">${ex ? 'Already being treated. This adds today\'s pain to your rehab log.' : painWords(s.pain)}</span>
      </div>`; })}
    </div>`;
  }

  function CheckinResult({ a, go, sent, onEdit }) {
    const w = C.todayWellness(a), r = C.readiness(a), tip = aiTip(a);
    const physio = physioOf(a);
    const flags = AMS.db.injuries.filter((i) => i.athleteId === a.id && i.status !== 'Closed' && i.dateOfInjury === AMS.TODAY && (i.source === 'athlete-app' || (sent && sent.spots.some((s) => s.region === i.region))));
    const showDx = seesDiagnosis(a);
    return html`<${Frag}>
      <div className="col" style=${{ alignItems: 'center', gap: 6, padding: '4px 0 2px' }}>
        <${UI.Ring} value=${r.score} tone=${r.band} size=${104} thickness=${9} label="Readiness" />
        <b className=${r.band} style=${{ fontSize: 16 }}>${C.bandLabel(r.band)} · ${bandWords(r.band)}</b>
        <span className="tiny muted">${sent ? 'Sent at ' + sent.at : 'Checked in at ' + w.at} · ${streakOf(a)}-day streak</span>
      </div>
      <div className="ai-box col" style=${{ gap: 8 }}>
        <div className="row between"><${UI.AIChip} label="Why this score" /><span className="tiny faint">${Math.round(tip.confidence * 100)}% confidence</span></div>
        <b style=${{ fontSize: 14 }}>${tip.headline}</b>
        ${tip.lines.map((l, i) => html`<div key=${i} className="small">${l}</div>`)}
        <${UI.Evidence} items=${tip.ev} />
      </div>
      ${flags.length > 0 && html`<div className="aa-banner good"><${UI.Icon} name="check" size=${16} style=${{ flex: 'none' }} />
        <div className="col tight" style=${{ gap: 2 }}><b style=${{ fontSize: 13 }}>Pain flag${flags.length > 1 ? 's' : ''} sent to ${physio ? physio.name : 'your physio'}</b>
        <span className="tiny muted">${flags.map((f) => (showDx ? f.regionLabel : AMS.medicalLabel(f))).join(' · ')}. They will check you before training. ${coachName(a)} only sees "${AMS.medicalLabel(flags[0], 'coach')}".</span></div></div>`}
      <div className="aa-card" style=${{ gap: 6 }}>
        <${Label}>Who sees this check-in<//>
        <div className="aa-row small"><${UI.Icon} name="whistle" size=${14} />${coachName(a)}: score, colour and your note</div>
        <div className="aa-row small"><${UI.Icon} name="flask" size=${14} />Sports science: your 28-day trend vs your normal</div>
        <div className="aa-row small"><${UI.Icon} name="medical" size=${14} />${physio ? physio.name : 'Physio'}: pain flags and soreness</div>
      </div>
      <div className="aa-two"><button className="btn" onClick=${onEdit}><${UI.Icon} name="edit" size=${14} />Update answers</button><button className="btn primary" onClick=${() => go('session')}>Today's session</button></div>
    <//>`;
  }

  function CheckIn({ a, go }) {
    const w = C.todayWellness(a);
    const [editing, setEditing] = useState(!w);
    const [vals, setVals] = useState(() => (w ? { sleep: w.sleep, soreness: w.soreness, mood: w.mood, stress: w.stress, energy: w.energy, sleepHrs: w.sleepHrs || 7.5, note: w.note || '' } : { sleepHrs: 7.5, note: '' }));
    const [painOn, setPainOn] = useState('no');
    const [spots, setSpots] = useState([]);
    const [sel, setSel] = useState(null);
    const [sent, setSent] = useState(null);
    if (w && !editing) return html`<${CheckinResult} a=${a} go=${go} sent=${sent} onEdit=${() => { setSent(null); setEditing(true); }} />`;
    const set = (k, x) => setVals((o) => Object.assign({}, o, { [k]: x }));
    const answered = SCALES.filter((s) => vals[s.key]).length;
    const onPick = (region, side, label) => {
      const sd = CENTER.has(region) ? 'C' : side;
      setSel({ region, side: sd });
      setSpots((list) => (list.some((s) => s.region === region && s.side === sd) ? list : list.concat({ region, side: sd, label: label || regionLabel(region, sd), pain: 3 })));
    };
    const submit = () => {
      const pains = painOn === 'yes' ? spots : [];
      const res = AMS.runAction('app.checkin', Object.assign({ athleteId: a.id }, vals, { pains }));
      if (res) { setSent({ at: AMS.clockTime(), spots: pains.slice() }); setEditing(false); setSpots([]); setPainOn('no'); setSel(null); }
    };
    return html`<${Frag}>
      <div className="row between top">
        <div className="col tight" style=${{ gap: 2 }}><h2 className="aa-h1">Morning check-in</h2><span className="tiny muted">${w ? 'Updating today\'s answers (first sent ' + w.at + ')' : 'About 30 seconds · 5 = best'}</span></div>
        <${UI.Pill} tone=${answered === 5 ? 'good' : ''}>${answered}/5<//>
      </div>
      ${SCALES.map((s) => html`<div key=${s.key} className="aa-q">
        <div className="aa-row" style=${{ gap: 6 }}><${UI.Icon} name=${s.icon} size=${14} style=${{ color: 'var(--fg-3)' }} /><b style=${{ fontSize: 13 }}>${s.label}</b>${vals[s.key] && html`<span className="tiny faint" style=${{ marginLeft: 'auto' }}>${s.words[vals[s.key] - 1]}</span>`}</div>
        <div className="aa-scale" role="radiogroup" aria-label=${s.label}>${[1, 2, 3, 4, 5].map((n) => html`<button key=${n} type="button" role="radio" aria-checked=${vals[s.key] === n} className=${vals[s.key] === n ? 'on' : ''} onClick=${() => set(s.key, n)}>${n}<small>${s.words[n - 1]}</small></button>`)}</div>
      </div>`)}
      <div className="aa-q">
        <div className="aa-row" style=${{ gap: 6 }}><${UI.Icon} name="bed" size=${14} style=${{ color: 'var(--fg-3)' }} /><b style=${{ fontSize: 13 }}>Hours slept</b><span className="tiny faint" style=${{ marginLeft: 'auto' }}>usual ${AMS.round(usualSleep(a), 1)} h</span></div>
        <div className="aa-step" style=${{ justifyContent: 'center' }}>
          <button type="button" className="btn" aria-label="Less sleep" onClick=${() => set('sleepHrs', Math.max(3, AMS.round(vals.sleepHrs - 0.5, 1)))}><${UI.Icon} name="minus" /></button>
          <span className="num aa-stepv">${vals.sleepHrs} h</span>
          <button type="button" className="btn" aria-label="More sleep" onClick=${() => set('sleepHrs', Math.min(12, AMS.round(vals.sleepHrs + 0.5, 1)))}><${UI.Icon} name="plus" /></button>
        </div>
      </div>
      <div className="aa-q">
        <b style=${{ fontSize: 13 }}>Any pain or tightness?</b>
        <${UI.Seg} options=${[{ id: 'no', label: 'No' }, { id: 'yes', label: 'Yes, show where' }]} value=${painOn} onChange=${setPainOn} />
        ${painOn === 'yes' && html`<${PainPicker} a=${a} spots=${spots} sel=${sel} onPick=${onPick} setSpots=${setSpots} />`}
      </div>
      <div className="aa-q">
        <b style=${{ fontSize: 13 }}>Anything else for your coach?</b>
        <textarea className="textarea" rows="2" placeholder="Optional, e.g. exams this week, felt sick last night" value=${vals.note} onChange=${(e) => set('note', e.target.value)} />
      </div>
      <button className="btn primary aa-big" disabled=${answered < 5 || (painOn === 'yes' && !spots.length)} onClick=${submit}><${UI.Icon} name="send" size=${15} />${w ? 'Update check-in' : 'Send check-in'}</button>
      ${answered < 5 && html`<span className="tiny faint" style=${{ textAlign: 'center' }}>Answer all five to send</span>`}
      ${painOn === 'yes' && !spots.length && answered === 5 && html`<span className="tiny faint" style=${{ textAlign: 'center' }}>Tap where it hurts on the body, or choose No</span>`}
      ${w && html`<button className="btn ghost sm" onClick=${() => setEditing(false)}>Cancel</button>`}
    <//>`;
  }

  function LoadEffect({ a }) {
    const wk = AMS.sum((a.loads || []).slice(35, 42));
    const next = C.acwr(a, 41);
    return html`<${Frag}>
      <div className="row tight wrap"><span className="evidence">Last 7 days <b>${wk.toLocaleString('en-IN')} AU</b></span><span className="evidence"><span className=${'dot ' + C.acwrBand(next)} style=${{ width: 6, height: 6 }} />ACWR tomorrow <b>${next.toFixed(2)}</b></span></div>
      ${next >= 1.5 && html`<span className="tiny bad">That is a load jump. ${coachName(a)} and the sports scientist will see it and may lighten tomorrow.</span>`}
    <//>`;
  }

  function SessionScreen({ a }) {
    const sess = AMS.todaySessionFor(a);
    const [rating, setRating] = useState(false);
    const [val, setVal] = useState(null);
    const upcoming = upcomingFor(a, 3);
    const Upcoming = () => upcoming.length > 0 && html`<div className="aa-card" style=${{ gap: 4 }}>
      <${Label}>Coming up<//>
      ${upcoming.map((s) => { const v = variantOf(s, a); return html`<div key=${s.id} className="aa-row" style=${{ padding: '5px 0', borderTop: '1px solid var(--border)' }}>
        <span className="tiny faint tnum" style=${{ width: 58, flex: 'none' }}>${D.dow(s.date)} ${s.start}</span>
        <span className="small grow ellipsis">${v === 'none' ? s.title : VARIANT_SHORT[v] + ' (adjusted)'}</span><span className="tiny faint">${s.duration} min</span></div>`; })}
    </div>`;
    if (!sess) return html`<${Frag}><h2 className="aa-h1">Today</h2><div className="aa-card"><b>Rest day</b><span className="small muted">No session for your squad today. Sleep, eat well, and do light mobility if you feel stiff.</span></div><${Upcoming} /><//>`;
    const variant = variantOf(sess, a);
    const rated = (sess.rpe || {})[a.id];
    const recLoad = (sess.loadRecorded || {})[a.id];
    const blocks = blocksFor(a, sess, variant);
    const over = sessionOver(sess);
    const scale = variantScale(variant);
    const send = () => { if (val && AMS.runAction('app.rpe', { athleteId: a.id, sessionId: sess.id, rpe: val })) setRating(false); };
    return html`<${Frag}>
      <div className="col tight" style=${{ gap: 2 }}><span className="tiny faint upper">${D.fmtLong(sess.date)} · ${sess.start}–${endTime(sess)}</span><h2 className="aa-h1">${variant === 'none' || variant === 'reduced' ? sess.title : VARIANT_SHORT[variant]}</h2>
        <span className="tiny muted">${sess.location} · ${sess.duration} min · ${String(sess.intensity).toLowerCase()} intensity · ${coachName(a)}</span></div>
      ${variant !== 'none' && html`<${ModBanner} a=${a} sess=${sess} />`}
      <div className="aa-card" style=${{ gap: 4 }}>
        <${Label} right=${html`<span className="tiny faint">${sess.status === 'Live' ? 'Live now' : sess.status}</span>`}>${variant === 'none' ? 'Your plan' : 'Your version'}<//>
        ${variant === 'excluded' ? html`<span className="small muted">Rest today. No training: sleep, eat and hydrate. ${coachName(a)} will check in with you.</span>`
          : blocks.map(([n, dose], i) => html`<div key=${i} className="aa-row" style=${{ padding: '6px 0', borderTop: i ? '1px solid var(--border)' : 0 }}><span className="tiny faint tnum" style=${{ width: 16 }}>${i + 1}</span><span className="small grow">${n}</span><span className="tiny faint">${dose}</span></div>`)}
        ${variant !== 'none' && variant !== 'reduced' && html`<span className="tiny faint" style=${{ paddingTop: 4 }}>Squad plan today: ${sess.title}. Not for you today.</span>`}
      </div>
      <div className="aa-card">
        <${Label} right=${rated && html`<${UI.Pill} tone="good">Sent<//>`}>Session effort (RPE)<//>
        ${variant === 'excluded' ? html`<span className="small muted">You are resting today, so there is nothing to rate.</span>`
          : rated && !rating ? html`<${Frag}>
            <div className="aa-row"><span className=${'aa-rpev ' + rpeTone(rated)}>${rated}</span>
              <div className="col tight grow" style=${{ gap: 1, minWidth: 0 }}><b>${BORG[rated - 1][1]}</b><span className="tiny muted">${rated} × ${sess.duration} min${scale !== 1 ? ' × ' + scale + ' (' + VARIANT_SHORT[variant].toLowerCase() + ')' : ''} = ${recLoad != null ? recLoad : Math.round(rated * sess.duration * scale)} AU added to your load</span></div></div>
            <${LoadEffect} a=${a} />
            <button className="btn sm" onClick=${() => { setVal(rated); setRating(true); }}>Change rating</button>
          <//>`
          : rating ? html`<${Frag}>
            <span className="small muted">How hard was the whole session, start to finish?</span>
            <div className="aa-rpe" role="radiogroup" aria-label="Session RPE, Borg CR-10">${BORG.map(([n, label, hint]) => html`<button key=${n} type="button" role="radio" aria-checked=${val === n} className=${val === n ? 'on' : ''} onClick=${() => setVal(n)}>
              <span className=${'aa-rpev ' + rpeTone(n)}>${n}</span>
              <span className="col tight" style=${{ gap: 0, minWidth: 0 }}><span style=${{ fontWeight: 600 }}>${label}</span><span className="tiny muted">${hint}</span></span>
              ${val === n ? html`<${UI.Icon} name="check" size=${16} style=${{ color: 'var(--accent)' }} />` : html`<span />`}
            </button>`)}</div>
            <div className="aa-two"><button className="btn" onClick=${() => setRating(false)}>Cancel</button><button className="btn primary" disabled=${!val} onClick=${send}>Send rating</button></div>
          <//>`
          : html`<${Frag}>
            <span className="small muted">${over ? 'Session finished. How hard was it? One tap, 5 seconds.' : 'Rate it within 30 minutes of finishing. The session ends at ' + endTime(sess) + '.'}</span>
            <button className="btn primary aa-big" onClick=${() => setRating(true)}>${over ? 'Rate my session' : 'Finished? Rate my session'}</button>
          <//>`}
      </div>
      <${Upcoming} />
    <//>`;
  }

  function InjuryCard({ a, inj }) {
    const stages = inj.rtpStages || [];
    const days = D.diff(AMS.TODAY, inj.dateOfInjury);
    const light = inj.status === 'Monitoring' || inj.path === 'light';
    const waiting = inj.status === 'Reported' || inj.status === 'Assessment';
    const plan = rehabPlanFor(inj), done = doneToday(inj);
    const pt = painToday(inj);
    const prior = (inj.painLog || []).filter((e) => e.date !== AMS.TODAY).slice(-1)[0];
    const series = (inj.painLog || []).slice(-14).map((e) => e.pain);
    const trend = series.length > 2 ? series[series.length - 1] - series[0] : 0;
    const canEdit = isOwn(a.id) || AMS.medicalFull();
    const physio = AMS.org.staff(inj.physioId);
    return html`<div className="aa-card">
      <div className="row between top" style=${{ gap: 8 }}>
        <div className="col tight" style=${{ gap: 1, minWidth: 0 }}><b>${inj.regionLabel}</b><span className="tiny muted">${inj.diagnosis}</span></div>
        <${UI.Pill} tone=${statusTone(inj.status)}>${inj.status}<//>
      </div>
      <div className="row tight wrap tiny muted" style=${{ gap: '2px 12px' }}><span>Day ${days + 1} since ${D.fmt(inj.dateOfInjury)}</span>${inj.expectedReturn && html`<span>Expected back ${D.fmt(inj.expectedReturn)}</span>`}${physio && html`<span>Physio ${physio.name}</span>`}</div>
      ${light ? html`<div className="aa-banner warn"><${UI.Icon} name="eye" size=${15} style=${{ flex: 'none' }} /><span className="tiny">${physio ? physio.name.split(' ')[0] : 'Your physio'} is keeping an eye on this. There are no rehab stages; log your pain every day. If it goes up, it becomes a full case.</span></div>`
        : waiting ? html`<div className="aa-banner"><${UI.Icon} name="clock" size=${15} style=${{ flex: 'none' }} /><span className="tiny">${inj.status === 'Reported' ? 'Waiting for assessment. The physio has been notified and will see you before training.' : 'Being assessed. Your rehab plan will appear here once the physio confirms it.'}</span></div>`
        : html`<div className="aa-stages">${stages.map((s, k) => html`<div key=${k} className=${AMS.cx('s', k < inj.rtpStage && 'done', k === inj.rtpStage && 'cur')}>
            <i>${k < inj.rtpStage ? html`<${UI.Icon} name="check" size=${12} stroke=${3} />` : k + 1}</i>
            <div className="col tight grow" style=${{ gap: 1, minWidth: 0 }}>
              <span style=${{ fontWeight: k === inj.rtpStage ? 600 : 500, fontSize: 12.5, color: k > inj.rtpStage ? 'var(--fg-3)' : 'var(--fg)' }}>${s.name}</span>
              ${k === inj.rtpStage && html`<span className="tiny faint">${inj.status === 'Clearance' ? 'Waiting for doctor clearance' : 'Since ' + D.fmt(inj.stageSince) + ' · plan ' + (inj.stageTargetDays || s.targetDays) + ' days'}</span>`}
              ${k === inj.rtpStage && (s.criteria || []).map((c, ci) => html`<span key=${ci} className="tiny row tight" style=${{ gap: 6, alignItems: 'flex-start' }}><span className=${c.met ? 'good' : 'faint'} style=${{ flex: 'none' }}><${UI.Icon} name=${c.met ? 'check' : 'clock'} size=${11} /></span>${c.text}</span>`)}
            </div>
          </div>`)}</div>`}
      ${plan.length > 0 && html`<div className="col" style=${{ gap: 0 }}>
        <${Label} right=${html`<span className="tiny faint">${done.length}/${plan.length}</span>`}>Today's rehab<//>
        ${plan.map(([name, dose]) => { const on = done.includes(name); return html`<div key=${name} className=${AMS.cx('aa-check', !canEdit && 'ro')} role="checkbox" aria-checked=${on} tabIndex=${canEdit ? 0 : -1}
            onClick=${() => canEdit && AMS.runAction('app.rehabExercise', { injuryId: inj.id, name })} onKeyDown=${(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); AMS.runAction('app.rehabExercise', { injuryId: inj.id, name }); } }}>
          <span className=${AMS.cx('aa-box', on && 'on')}>${on && html`<${UI.Icon} name="check" size=${12} stroke=${3} />`}</span>
          <span className="grow small" style=${on ? { textDecoration: 'line-through', color: 'var(--fg-3)' } : null}>${name}</span><span className="tiny faint">${dose}</span>
        </div>`; })}
      </div>`}
      <div className="col" style=${{ gap: 6 }}>
        <${Label} right=${series.length > 2 && html`<${UI.Sparkline} data=${series} width=${90} height=${22} tone=${trend > 0 ? 'bad' : 'good'} />`}>Pain today<//>
        <div className="aa-pain" role="radiogroup" aria-label="Pain today">${PAIN.map((n) => html`<button key=${n} type="button" role="radio" aria-checked=${pt === n} className=${pt === n ? 'on' : ''} disabled=${!canEdit} onClick=${() => AMS.runAction('app.rehabPain', { injuryId: inj.id, pain: n })}>${n}</button>`)}</div>
        <span className="tiny faint">${pt != null ? 'Logged ' + pt + '/10 today' + (prior ? ' (last time ' + prior.pain + '/10)' : '') : '0 = no pain, 10 = worst imaginable'}${pt != null && prior && pt - prior.pain >= 2 ? '. Up by 2 or more: the physio will review your stage.' : ''}</span>
      </div>
    </div>`;
  }

  function InjurySummary({ inj }) {
    const st = (inj.rtpStages || [])[inj.rtpStage];
    const allowed = inj.status === 'Monitoring' ? 'Full training, monitored' : inj.availability === 'Unavailable' ? 'Rehab only, no squad training' : 'Modified training only';
    return html`<div className="aa-card">
      <div className="row between"><b>${AMS.medicalLabel(inj)}</b><${UI.Pill} tone=${statusTone(inj.status)}>${inj.status}<//></div>
      <${UI.DL} cols=${2} items=${[
        ['Stage', inj.path === 'light' || inj.status === 'Monitoring' ? 'Light path' : st && inj.status === 'Rehab' ? (inj.rtpStage + 1) + '/' + inj.rtpStages.length + ' · ' + st.name : inj.status],
        ['Expected back', inj.expectedReturn ? D.fmt(inj.expectedReturn) : 'After assessment'],
        ['Allowed', allowed], ['Since', D.fmt(inj.dateOfInjury)]]} />
      <span className="tiny faint">Medical details are visible to medical staff and the athlete only.</span>
    </div>`;
  }

  function Rehab({ a, go }) {
    const open = openInjuries(a).sort((x, y) => y.dateOfInjury.localeCompare(x.dateOfInjury));
    const past = AMS.db.injuries.filter((i) => i.athleteId === a.id && i.status === 'Closed').sort((x, y) => y.dateOfInjury.localeCompare(x.dateOfInjury));
    const full = seesDiagnosis(a);
    const BM = UI.BodyMap;
    const marks = open.map((i) => ({ id: i.id, region: i.region, side: i.side, severity: i.severity, status: i.status, label: i.regionLabel })).concat(past.map((i) => ({ id: i.id, region: i.region, side: i.side, severity: i.severity, status: 'Closed', faded: true, label: i.regionLabel + ' (' + D.fmt(i.dateOfInjury) + ')' })));
    return html`<${Frag}>
      <div className="col tight" style=${{ gap: 2 }}><h2 className="aa-h1">Rehab</h2><span className="tiny muted">${open.length ? open.length + ' active ' + (open.length > 1 ? 'issues' : 'issue') : 'Nothing active right now'}</span></div>
      ${!full && html`<div className="aa-banner"><${UI.Icon} name="lock" size=${15} style=${{ flex: 'none' }} /><span className="tiny">Previewing as ${AMS.roleLabel(AMS.ui.role)}: diagnosis, notes and pain scores are hidden. ${first(a)} sees their own diagnosis; medical staff see everything.</span></div>`}
      ${open.map((i) => (full ? html`<${InjuryCard} key=${i.id} a=${a} inj=${i} />` : html`<${InjurySummary} key=${i.id} inj=${i} />`))}
      ${!open.length && html`<div className="aa-card"><b>No active injuries</b><span className="small muted">Something hurting or tight? Add it in your morning check-in. It goes straight to ${physioOf(a) ? physioOf(a).name : 'your physio'}.</span><button className="btn sm" onClick=${() => go('checkin')}>Report pain in check-in</button></div>`}
      ${BM && full && marks.length > 0 && html`<div className="aa-card"><${Label}>Your body map<//><div className="aa-bm"><${BM} marks=${marks} compact=${true} height=${230} showLegend=${false} /></div></div>`}
      ${past.length > 0 && html`<div className="aa-card" style=${{ gap: 4 }}><${Label}>History<//>
        ${past.slice(0, 5).map((i) => html`<div key=${i.id} className="aa-row small" style=${{ justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid var(--border)' }}><span className="ellipsis">${full ? i.regionLabel + ' · ' + (i.type || '') : 'Past issue: ' + AMS.bodyZone(i.region)}</span><span className="tiny faint" style=${{ whiteSpace: 'nowrap' }}>${D.fmt(i.dateOfInjury)} · ${i.daysLost || Math.max(0, D.diff(i.closedOn || AMS.TODAY, i.dateOfInjury))} d</span></div>`)}
      </div>`}
    <//>`;
  }

  function Fuel({ a }) {
    const hyd = hydrationOf(a);
    const pct = AMS.clamp(Math.round((hyd.ml / (hyd.target || 1)) * 100), 0, 100);
    const plan = mealPlanOf(a);
    const reqs = supplementsOf(a);
    const reg = registryList();
    const nut = nutritionistOf(a);
    const sess = AMS.todaySessionFor(a);
    const [asking, setAsking] = useState(false);
    const [prod, setProd] = useState('');
    const [why, setWhy] = useState('');
    const chosen = reg.find((x) => x.id === prod);
    const left = Math.max(0, hyd.target - hyd.ml);
    const tip = left === 0 ? 'Target reached. Keep sipping with meals.' : sess && minutesOf(AMS.clockTime()) < minutesOf(sess.start) ? 'Drink about 500 ml in the hour before ' + sess.start + ', then 150–250 ml every 15 minutes during the session.' : fmtL(left) + ' to go. Spread it out: a glass with every meal and snack.';
    const send = () => { if (AMS.runAction('app.supplementRequest', { athleteId: a.id, productId: prod, reason: why })) { setAsking(false); setProd(''); setWhy(''); } };
    return html`<${Frag}>
      <h2 className="aa-h1">Fuel</h2>
      <div className="aa-card">
        <${Label} right=${html`<span className="tiny faint">Target ${fmtL(hyd.target)}</span>`}>Water today<//>
        <div className="aa-row" style=${{ alignItems: 'flex-end', gap: 8 }}><span className="num" style=${{ fontSize: 30, fontWeight: 600, lineHeight: 1 }}>${fmtL(hyd.ml)}</span><span className="small muted">${pct}%</span></div>
        <div className="aa-water"><i style=${{ width: pct + '%' }} /></div>
        <div className="aa-two">
          <button className="btn" onClick=${() => AMS.runAction('app.hydration', { athleteId: a.id, ml: 250 })}><${UI.Icon} name="droplet" size=${14} />+250 ml</button>
          <button className="btn" onClick=${() => AMS.runAction('app.hydration', { athleteId: a.id, ml: 500 })}><${UI.Icon} name="droplet" size=${14} />+500 ml</button>
        </div>
        <span className="tiny muted">${tip}</span>
        ${hyd.entries.length > 0 && html`<div className="row tight wrap tiny faint" style=${{ gap: '2px 10px' }}>${hyd.entries.slice(-6).map((e, i) => html`<span key=${i}>${e.at} · ${e.ml} ml</span>`)}</div>`}
      </div>
      <div className="aa-card" style=${{ gap: 4 }}>
        <${Label} right=${plan && html`<span className="tiny faint">${plan.dayType || ''}</span>`}>Today's meals<//>
        ${plan && plan.status && plan.status !== 'Published' && plan.status !== 'Approved' ? html`<span className="small muted">${nut ? nut.name : 'Your nutritionist'} is reviewing a new plan for you. You will be notified when it is published.</span>`
          : plan ? html`<${Frag}>
            <div className="row tight wrap" style=${{ paddingBottom: 4 }}><span className="evidence"><b>${plan.kcal}</b> kcal</span><span className="evidence">Protein <b>${plan.protein} g</b></span><span className="evidence">Carbs <b>${plan.carbs} g</b></span><span className="evidence">Fat <b>${plan.fat} g</b></span></div>
            ${(plan.meals || []).map((m, i) => html`<div key=${i} className="aa-meal"><div className="row between"><b style=${{ fontSize: 12.5 }}>${m.slot}</b><span className="tiny faint">${m.time || ''}${m.kcal ? ' · ' + m.kcal + ' kcal' : ''}</span></div><span className="tiny muted">${(m.items || []).map((it) => it.name + (it.portion ? ' (' + it.portion + ')' : '')).join(', ')}</span></div>`)}
          <//>`
          : html`<span className="small muted">${nut ? nut.name : 'Your nutritionist'} has not published a plan for you yet. You will get a notification when it is ready.</span>`}
      </div>
      <div className="aa-card" style=${{ gap: 6 }}>
        <${Label} right=${html`<button className="btn xs" onClick=${() => setAsking(!asking)}>${asking ? 'Close' : 'Request'}</button>`}>Supplements<//>
        ${reqs.map((r) => html`<div key=${r.id} className="aa-row small" style=${{ justifyContent: 'space-between' }}><span className="ellipsis">${r.product}</span><${UI.Pill} tone=${suppTone(r.status)}>${r.status}<//></div>`)}
        ${!reqs.length && !asking && html`<span className="small muted">No supplements on file. Only take products your nutritionist and doctor approve. Every batch must be anti-doping tested.</span>`}
        ${asking && html`<div className="col" style=${{ gap: 8 }}>
          <${UI.Select} value=${prod} onChange=${setProd} placeholder="Choose a product" options=${reg.map((x) => ({ value: x.id, label: x.product + (x.tested ? '' : ' (not batch-tested)') }))} />
          ${chosen && !chosen.tested && html`<div className="aa-banner bad"><${UI.Icon} name="alert" size=${15} style=${{ flex: 'none' }} /><span className="tiny"><b>Anti-doping risk.</b> ${chosen.risk || 'This product is not batch-tested.'} Requests for untested products are blocked automatically, so choose a batch-tested alternative.</span></div>`}
          ${chosen && chosen.tested && html`<span className="tiny faint">${chosen.category}${chosen.note ? ' · ' + chosen.note : ''} · batch-tested</span>`}
          <input className="input" placeholder="Why do you need it? (optional)" value=${why} onChange=${(e) => setWhy(e.target.value)} />
          <button className="btn primary" disabled=${!prod} onClick=${send}>Send to ${nut ? nut.name.split(' ')[0] : 'the nutritionist'}</button>
          <span className="tiny faint">The nutritionist reviews it first, then the team doctor signs off.</span>
        </div>`}
      </div>
    <//>`;
  }

  function Me({ a }) {
    const own = isOwn(a.id);
    const canDocs = own || AMS.access('documents') !== 'none';
    const canProfile = own || AMS.canEdit('athletes');
    const [checking, setChecking] = useState(null);
    const [contact, setContact] = useState(null);
    const notes = notificationsFor(a);
    const unread = notes.filter((n) => !n.read).length;
    const docs = latestDocs(a);
    const coach = coachOf(a);
    const age = D.ageOn(a.dob);
    const upload = (type, quality) => { setChecking(type); setTimeout(() => { setChecking(null); AMS.runAction('app.uploadDoc', { athleteId: a.id, type, quality }); }, 900); };
    const saveContact = () => { if (AMS.runAction('app.profile', { athleteId: a.id, patch: { emergencyContact: { name: contact.name, phone: contact.phone, relation: 'Family' } }, field: 'Emergency contact' })) setContact(null); };
    const missing = a.missingFields || [];
    return html`<${Frag}>
      <div className="aa-card">
        <div className="aa-row"><${UI.Avatar} name=${a.name} size=${48} />
          <div className="col tight grow" style=${{ gap: 1, minWidth: 0 }}><b style=${{ fontSize: 15 }}>${a.name}</b><span className="tiny muted ellipsis">${sqName(a)} · ${(AMS.org.centre(a.centreId) || {}).short}</span><span className="tiny faint">${a.id} · ${age} yrs · ${a.events}</span></div></div>
        <${UI.DL} cols=${2} items=${[['Coach', coach ? coach.name : '—'], ['Level', a.level], ['Height / weight', a.heightCm + ' cm · ' + a.weightKg + ' kg'], ['Blood group', a.bloodGroup], a.pb && ['Personal bests', Object.entries(a.pb).map(([k, v]) => k + ' ' + v).join(' · ')], (a.tags || []).length > 0 && ['Programmes', a.tags.join(', ')]]} />
      </div>
      <div className="aa-card" style=${{ gap: 4 }}>
        <${Label} right=${html`<span className="tiny faint">${a.profileCompletion}%</span>`}>Profile completion<//>
        <${UI.Meter} value=${a.profileCompletion} tone=${a.profileCompletion >= 100 ? 'good' : 'warn'} />
        ${!missing.length && html`<span className="tiny muted" style=${{ paddingTop: 4 }}>Complete. Nothing missing.</span>`}
        ${missing.map((f) => html`<div key=${f} className="aa-miss">
          <div className="row between" style=${{ gap: 8 }}><span className="small" style=${{ fontWeight: 600 }}>${f}</span>
            ${DOC_FIELDS.includes(f) ? (checking === f ? html`<span className="tiny ai-c row tight"><${UI.Icon} name="sparkles" size=${12} />AI checking…</span>` : html`<button className="btn xs primary" disabled=${!canDocs} onClick=${() => upload(f, 'clear')}><${UI.Icon} name="upload" size=${12} />Upload</button>`)
              : f === 'Emergency contact' ? html`<button className="btn xs" disabled=${!canProfile} onClick=${() => setContact(contact ? null : { name: '', phone: '' })}>${contact ? 'Close' : 'Add'}</button>`
              : html`<button className="btn xs" disabled=${!canProfile} onClick=${() => AMS.runAction('app.profile', { athleteId: a.id, patch: { bankStatus: 'Received' }, field: f })}>Link account</button>`}
          </div>
          ${DOC_FIELDS.includes(f) && checking !== f && canDocs && html`<button className="aa-link tiny" onClick=${() => upload(f, 'blurred')}>Demo: upload a blurry photo to see the AI check reject it</button>`}
          ${/Bank/.test(f) && html`<span className="tiny faint">Verified with a one-rupee test deposit; needed for your stipend.</span>`}
          ${f === 'Emergency contact' && contact && html`<div className="col" style=${{ gap: 6 }}>
            <input className="input" placeholder="Name" value=${contact.name} onChange=${(e) => setContact(Object.assign({}, contact, { name: e.target.value }))} />
            <input className="input" placeholder="Phone" value=${contact.phone} onChange=${(e) => setContact(Object.assign({}, contact, { phone: e.target.value }))} />
            <button className="btn xs primary" disabled=${!contact.name || !contact.phone} onClick=${saveContact}>Save contact</button>
          </div>`}
        </div>`)}
      </div>
      ${canDocs ? html`<div className="aa-card" style=${{ gap: 4 }}>
        <${Label} right=${html`<span className="tiny faint">${docs.length}</span>`}>Documents<//>
        ${docs.map((d) => html`<div key=${d.id} className="aa-row" style=${{ justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
          <div className="col tight" style=${{ gap: 1, minWidth: 0 }}><span className="small" style=${{ fontWeight: 600 }}>${d.type}</span><span className="tiny faint">${d.ai ? 'AI check ' + Math.round(d.ai.confidence * 100) + '% · ' + d.ai.note : 'Uploaded ' + D.fmt(d.on)}${d.expires ? ' · expires ' + D.fmt(d.expires) : ''}</span></div>
          <${UI.Pill} tone=${docTone(d.status)}>${d.status}<//></div>`)}
      </div>` : html`<div className="aa-banner"><${UI.Icon} name="lock" size=${15} style=${{ flex: 'none' }} /><span className="tiny">Documents are visible to the athlete, Operations and medical staff only.</span></div>`}
      ${a.guardian && html`<div className="aa-card" style=${{ gap: 6 }}>
        <${Label}>Guardian consent<//>
        <div className="aa-row" style=${{ justifyContent: 'space-between' }}><span className="small">${a.guardian.name} · ${a.guardian.relation}</span><${UI.Pill} tone=${a.guardian.consent ? 'good' : 'warn'}>${a.guardian.consent ? 'On file' : 'Pending'}<//></div>
        <span className="tiny muted">${a.guardian.consent ? 'Signed ' + D.fmt(a.guardian.consentOn) + '. Covers training, medical care and data sharing under the DPDP Act.' : 'Needed before medical records can be created.'}</span>
        ${!a.guardian.consent && html`<button className="btn xs" onClick=${() => AMS.runAction('app.consentRequest', { athleteId: a.id })}>Send consent link to guardian</button>`}
      </div>`}
      <div className="aa-card" style=${{ gap: 2 }}>
        <${Label} right=${unread > 0 && html`<button className="btn xs ghost" onClick=${() => AMS.runAction('app.markRead', { athleteId: a.id })}>Mark all read</button>`}>Notifications${unread ? ' · ' + unread + ' new' : ''}<//>
        ${notes.length ? notes.slice(0, 8).map((n) => html`<div key=${n.id} className="aa-note">
          <span className=${'dot ' + (n.read ? 'neutral' : 'info')} style=${{ marginTop: 6 }} />
          <div className="col tight grow" style=${{ gap: 1, minWidth: 0 }}><span className="small" style=${{ fontWeight: n.read ? 500 : 600 }}>${n.title}</span><span className="tiny muted">${n.text}</span></div>
          <span className="tiny faint" style=${{ whiteSpace: 'nowrap' }}>${(n.at || '').slice(0, 10) === AMS.TODAY ? (n.at || '').slice(11, 16) : D.fmt((n.at || AMS.TODAY).slice(0, 10))}</span>
        </div>`) : html`<span className="small muted">No notifications.</span>`}
      </div>
      <div className="aa-card" style=${{ gap: 4 }}>
        <${Label}>Who sees your data<//>
        <span className="tiny muted">${coachName(a)}: readiness, training and availability, never your diagnosis.</span>
        <span className="tiny muted">Physio and doctor: everything medical.</span>
        <span className="tiny muted">Nutritionist: food, water, supplements and body composition.</span>
        <span className="tiny muted">Operations: profile and documents only.</span>
      </div>
    <//>`;
  }

  /* ================================================================== phone frame */
  const SCREENS = { home: Home, checkin: CheckIn, session: SessionScreen, rehab: Rehab, fuel: Fuel, me: Me };
  function Phone({ athleteId, tab, setTab }) {
    AMS.useStore();
    const a = ath(athleteId);
    if (!a) return null;
    const role = AMS.ui.role;
    const acc = tabAccess(tab, role);
    const go = (t) => setTab(t);
    const sess = AMS.todaySessionFor(a);
    const nUnread = notificationsFor(a).filter((n) => !n.read).length;
    const dots = {
      checkin: tabAccess('checkin', role).ok && !C.todayWellness(a),
      session: tabAccess('session', role).ok && !!sess && variantOf(sess, a) !== 'excluded' && !(sess.rpe || {})[a.id] && sessionOver(sess),
      rehab: tabAccess('rehab', role).ok && seesDiagnosis(a) && openInjuries(a).some((i) => painToday(i) == null && ['Rehab', 'Monitoring', 'Clearance'].includes(i.status)),
      me: nUnread > 0 || (a.missingFields || []).length > 0,
    };
    const S = SCREENS[tab] || Home;
    return html`<div className="phone" role="region" aria-label=${'Athlete app on ' + a.name + '\'s phone'}>
      <div className="phone-screen"><div className="aa-screen">
        <div className="aa-status"><span className="tnum">${AMS.clockTime()}</span><span className="row tight" style=${{ gap: 6 }}><span className="tiny" style=${{ fontWeight: 600 }}>4G</span><span className="aa-batt"><i /></span></span></div>
        <div className="aa-head">
          <${UI.Avatar} name=${a.name} size=${30} />
          <div className="col tight grow" style=${{ gap: 0, minWidth: 0 }}><span className="ellipsis" style=${{ fontWeight: 600, fontSize: 13.5 }}>${a.name}</span><span className="tiny faint ellipsis">USI Athlete · ${sqName(a)}</span></div>
          <button className="btn ghost icon" aria-label=${'Notifications' + (nUnread ? ', ' + nUnread + ' unread' : '')} onClick=${() => go('me')} style=${{ position: 'relative' }}><${UI.Icon} name="bell" size=${18} />${nUnread > 0 && html`<span className="aa-badge">${nUnread}</span>`}</button>
        </div>
        <div className="aa-body" key=${tab + ':' + a.id}>${acc.ok ? html`<${S} a=${a} go=${go} acc=${acc} />` : html`<${Lock} reason=${acc.reason} />`}</div>
        <nav className="aa-tabs" aria-label="Athlete app navigation">${TABS.map((t) => html`<button key=${t.id} className=${AMS.cx('aa-tab', tab === t.id && 'on')} onClick=${() => go(t.id)} aria-current=${tab === t.id ? 'page' : undefined}>
          <${UI.Icon} name=${t.icon} size=${19} />${t.label}${dots[t.id] && html`<span className="aa-dot" />`}
        </button>`)}</nav>
      </div></div>
    </div>`;
  }

  /* ================================================================== staff side panel */
  function StaffPanel({ a, scoped, onPick, setTab }) {
    const role = AMS.ui.role;
    const w = C.todayWellness(a);
    const sess = AMS.todaySessionFor(a), variant = variantOf(sess, a);
    const open = openInjuries(a);
    const canRead = AMS.can('readiness', 'view'), canTrain = AMS.can('training', 'view'), canMed = AMS.access('medical') !== 'none';
    const options = useMemo(() => {
      const order = (x) => { const k = STORY.findIndex((s) => s.name === x.name); return k < 0 ? 99 : k; };
      return scoped.slice().sort((x, y) => order(x) - order(y) || x.name.localeCompare(y.name)).map((x) => ({ value: x.id, label: x.name + ' · ' + sqName(x) }));
    }, [AMS.version, scoped.length]);
    const story = STORY.map((s) => { const x = scoped.find((y) => y.name === s.name); return x ? Object.assign({ a: x }, s) : null; }).filter(Boolean);
    const modOk = (id) => AMS.modules.some((m) => m.id === id && (!m.roles || m.roles.includes(role)));
    const feed = AMS.db.activity.filter((x) => x.athleteId === a.id).slice(0, 7).map((x) => (!AMS.medicalFull() && ['injury', 'medical'].includes(x.type) ? Object.assign({}, x, { text: canMed ? 'Medical update for ' + a.name + ' (details visible to medical staff)' : null }) : x)).filter((x) => x.text);
    const rated = sess && (sess.rpe || {})[a.id];
    return html`<div className="aa-side">
      <${UI.Card} title="What the athlete sees" icon="phone">
        <div className="col" style=${{ gap: 10 }}>
          <span className="small muted">This is ${first(a)}'s phone. Everything submitted here lands in the staff app in real time, through the same actions the staff screens and the Copilot use.</span>
          <${UI.Field} label="Preview athlete"><${UI.Select} value=${a.id} onChange=${onPick} options=${options} /><//>
          ${story.length > 0 && html`<div className="row tight wrap">${story.map((s) => html`<button key=${s.a.id} className=${AMS.cx('btn xs', s.a.id === a.id && 'primary')} title=${s.why} onClick=${() => onPick(s.a.id)}>${s.label}</button>`)}</div>`}
        </div>
      <//>
      <${UI.Card} title="Live in the staff app" icon="pulse" hint=${AMS.roleLabel(role) + ' view'} actions=${html`<button className="btn xs" onClick=${() => AMS.openAthlete(a.id)}>Profile</button>`}>
        <div className="col" style=${{ gap: 12 }}>
          <${UI.DL} cols=${2} items=${[
            ['Readiness', canRead ? html`<${UI.Readiness} athlete=${a} size=${30} showLabel=${true} />` : html`<span className="faint">Hidden for ${AMS.roleLabel(role)}</span>`],
            ['Check-in', canRead ? (w ? w.at + (w.note ? ' · note' : '') : html`<span className="warn">Not yet</span>`) : '—'],
            ['ACWR', canTrain ? html`<${UI.AcwrPill} athlete=${a} />` : '—'],
            ['Availability', html`<${UI.AvailabilityPill} value=${a.availability} />`],
            ['Today', canTrain ? (sess ? (variant === 'none' ? sess.title + ' ' + sess.start : VARIANT_SHORT[variant] + ' (adjusted)') : 'Rest day') : '—'],
            ['Session RPE', canTrain ? (rated ? rated + '/10 · ' + ((sess.loadRecorded || {})[a.id] || Math.round(rated * sess.duration * variantScale(variant))) + ' AU' : 'Not rated') : '—'],
            ['Medical', canMed ? (open.length ? open.map((i) => AMS.medicalLabel(i)).join('; ') : 'No open issues') : html`<span className="faint">Hidden for Operations</span>`],
            ['Profile', a.profileCompletion + '%' + ((a.missingFields || []).length ? ' · ' + a.missingFields.length + ' missing' : '')],
          ]} />
          <div className="row tight wrap">
            <${UI.AskCopilot} prompt=${'How is ' + first(a) + ' doing?'} />
            ${canRead && w && AMS.ui.role !== 'athlete' && html`<button className="btn sm ghost" onClick=${() => AMS.runAction('app.clearCheckin', { athleteId: a.id })} title="Demo helper: remove today's check-in so you can run it again">Clear today's check-in</button>`}
          </div>
        </div>
      <//>
      <${UI.Card} title="Where each tap lands" icon="link" flush>
        <div>${FLOWS.map((f, i) => { const ok = modOk(f.module); const tabOk = tabAccess(f.tab, role).ok; return html`<div key=${i} className="aa-flow">
          <span className="aa-ico" style=${{ width: 30, height: 30 }}><${UI.Icon} name=${f.icon} size=${15} /></span>
          <div className="col tight" style=${{ gap: 1, minWidth: 0 }}><button className="aa-link" style=${{ textDecoration: 'none', color: 'var(--fg)', fontWeight: 600, fontSize: 13 }} disabled=${!tabOk} onClick=${() => setTab(f.tab)}>${f.title}</button><span className="tiny muted">${f.lands}</span></div>
          ${ok ? html`<button className="btn xs" onClick=${() => AMS.go(f.module)}>Open<${UI.Icon} name="arrow-r" size=${12} /></button>` : html`<span className="faint" title=${'Not available to ' + AMS.roleLabel(role)}><${UI.Icon} name="lock" size=${14} /></span>`}
        </div>`; })}</div>
      <//>
      <${UI.Card} title=${'Latest from ' + first(a)} icon="clock" flush>
        ${feed.length ? html`<div className="list">${feed.map((x) => html`<div key=${x.id} className="list-item" style=${{ alignItems: 'flex-start', padding: '8px 16px' }}>
          <span className="tiny faint tnum" style=${{ width: 54, flex: 'none', paddingTop: 1 }}>${x.at.slice(0, 10) === AMS.TODAY ? x.at.slice(11, 16) : D.fmt(x.at.slice(0, 10))}</span>
          <span className="small grow">${x.text}</span></div>`)}</div>` : html`<${UI.Empty} icon="clock" title="Nothing yet today">Submit something on the phone and it appears here and in the staff modules.<//>`}
      <//>
    </div>`;
  }

  /* ================================================================== page */
  function Page({ params }) {
    const { db, ui } = AMS.useStore();
    const p = params || {};
    const isAth = ui.role === 'athlete';
    const [pick, setPick] = UI.useLocal('aa-athlete', null);
    const [tab, setTab] = useState(p.tab && SCREENS[p.tab] ? p.tab : 'home');
    useEffect(() => { if (p.tab && SCREENS[p.tab]) setTab(p.tab); }, [p.tab]);
    useEffect(() => { if (p.athleteId && p.athleteId !== pick) setPick(p.athleteId); }, [p.athleteId]);
    const scoped = isAth ? [] : AMS.scopedAthletes();
    const want = p.athleteId || pick;
    const a = isAth ? AMS.me() : (scoped.find((x) => x.id === want) || scoped.find((x) => x.id === db.meta.heroAthleteId) || scoped[0]);
    if (a) AMS.setFocus({ athleteId: a.id });
    if (!a) return html`<div className="page"><${UI.PageHead} title="Athlete App" sub="Preview the athlete's phone" /><${UI.Empty} icon="users" title="No athletes in this scope">Widen the org filter in the top bar to pick an athlete to preview.<//></div>`;
    const phone = html`<${Phone} key=${a.id} athleteId=${a.id} tab=${tab} setTab=${setTab} />`;
    if (isAth) return html`<div className="page"><div className="phone-stage">${phone}</div></div>`;
    const onPick = (id) => { setPick(id); setTab('home'); };
    return html`<div className="page">
      <${UI.PageHead} title="Athlete App" sub=${'What ' + first(a) + ' sees on their phone. Check-ins, pain flags, RPE, water and documents show up live in the Command Center, Medical, Training and Nutrition.'}
        actions=${html`<button className="btn" onClick=${() => AMS.openAthlete(a.id)}><${UI.Icon} name="user" size=${14} />Open profile</button>`} />
      <div className="aa-stage">${phone}<${StaffPanel} a=${a} scoped=${scoped} onPick=${onPick} setTab=${setTab} /></div>
    </div>`;
  }

  AMS.registerModule({
    id: 'athlete-app', label: 'Athlete App', icon: 'phone', group: 'mobile', order: 10, roles: null, component: Page, short: 'App',
    badge: () => { if (AMS.ui.role !== 'athlete' || !AMS.db) return null; const me = AMS.me(); const n = me ? tasksFor(me).length : 0; return n ? { n, tone: 'warn' } : null; },
    get sampleParams() {
      const db = AMS.db; if (!db) return [{}];
      const by = (n) => (db.athletes.find((x) => x.name === n) || {}).id;
      return [{}, { tab: 'checkin' }, { tab: 'session' }, { tab: 'rehab' }, { tab: 'fuel' }, { tab: 'me' }, { tab: 'rehab', athleteId: by('Rohan Gaikwad') }, { tab: 'home', athleteId: by('Ananya Joshi') }, { tab: 'checkin', athleteId: by('Ananya Joshi') }];
    },
  });
  AMS.registerCommand({ id: 'athlete-app.open', label: 'Open the Athlete App (phone preview)', group: 'Navigate', icon: 'phone', keywords: 'mobile athlete app phone priya', run: () => AMS.go(MOD) });
  AMS.registerCommand({ id: 'athlete-app.checkin', label: 'Athlete morning check-in', group: 'Athlete app', icon: 'heart', keywords: 'wellness check-in readiness mobile body map pain', run: () => AMS.go(MOD, { tab: 'checkin' }) });
  AMS.registerCommand({ id: 'athlete-app.rpe', label: 'Rate session effort (athlete RPE)', group: 'Athlete app', icon: 'run', keywords: 'rpe borg session load srpe', run: () => AMS.go(MOD, { tab: 'session' }) });

  /* ================================================================== self-tests */
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const hero = () => ath(AMS.db.meta.heroAthleteId);
  const byName = (n) => AMS.db.athletes.find((x) => x.name === n);
  const GOOD = { sleep: 5, soreness: 5, mood: 5, stress: 5, energy: 5, sleepHrs: 8.5 };
  const T = (name, role, fn) => AMS.selfTests.push({ name: 'athlete app: ' + name, role, fn });

  T('check-in writes today\'s wellness and moves readiness', 'athlete', () => {
    const pr = hero(); const before = C.readiness(pr).score;
    assert(AMS.runAction('app.checkin', Object.assign({ athleteId: pr.id, note: 'Slept well after the trial' }, GOOD)), 'check-in rejected');
    const w = pr.wellness[27];
    assert(w && w.sleep === 5 && w.at === AMS.clockTime() && w.note === 'Slept well after the trial', 'wellness[27] not written');
    assert(C.readiness(pr).score > before, 'readiness did not move (' + before + ' → ' + C.readiness(pr).score + ')');
    assert(AMS.db.activity[0].athleteId === pr.id && /check-in/.test(AMS.db.activity[0].text), 'activity not logged');
  });
  T('a first check-in raises the squad check-in rate (coach preview)', 'coach', () => {
    const an = byName('Ananya Joshi'); assert(an && !an.wellness[27], 'Ananya should not have checked in yet');
    const r0 = C.checkinRate(AMS.scopedAthletes());
    AMS.runAction('app.checkin', Object.assign({ athleteId: an.id }, GOOD));
    assert(an.wellness[27] && an.wellness[27].at, 'wellness not written');
    assert(C.checkinRate(AMS.scopedAthletes()) > r0, 'check-in rate did not move');
  });
  T('pain spots on the body map open light-path flags; coach gets the label only', 'athlete', () => {
    const pr = hero();
    AMS.runAction('app.checkin', Object.assign({ athleteId: pr.id, pains: [{ region: 'hamstring', side: 'L', pain: 4 }, { region: 'hamstring', side: 'R', pain: 3 }] }, { sleep: 2, soreness: 2, mood: 3, stress: 3, energy: 2, sleepHrs: 5.5 }));
    const flags = AMS.db.injuries.filter((i) => i.athleteId === pr.id && i.status !== 'Closed' && i.region === 'hamstring');
    assert(flags.length === 2, 'expected 2 hamstring flags, got ' + flags.length);
    assert(flags.every((f) => (f.painLog || []).some((x) => x.date === AMS.TODAY)), 'pain not logged on the flag');
    assert(AMS.db.notifications.some((x) => x.toRole === 'physio' && x.athleteId === pr.id), 'physio not notified');
    const cn = AMS.db.notifications.find((x) => x.toRole === 'coach' && x.athleteId === pr.id && /upper leg/.test(x.text));
    assert(cn && !/hamstring/i.test(cn.text), 'coach should get the summary label only');
  });
  T('post-session RPE adds sRPE load once (no double count when the coach closes the session)', 'athlete', () => {
    const pr = hero(); const s = AMS.todaySessionFor(pr); assert(s, 'no session today');
    const l0 = pr.loads[41], sc = variantScale(variantOf(s, pr));
    AMS.runAction('app.rpe', { athleteId: pr.id, sessionId: s.id, rpe: 6 });
    assert(pr.loads[41] === l0 + Math.round(6 * s.duration * sc), 'load ' + pr.loads[41] + ' ≠ ' + (l0 + Math.round(6 * s.duration * sc)));
    assert(AMS.byId(AMS.db.sessions, s.id).rpe[pr.id] === 6, 'session.rpe not set');
    AMS.runAction('app.rpe', { athleteId: pr.id, sessionId: s.id, rpe: 7 });
    assert(pr.loads[41] === l0 + Math.round(7 * s.duration * sc), 'changing the rating did not replace the load');
    if (AMS.actions['session.complete']) {
      AMS.ui.role = 'coach'; const l1 = pr.loads[41];
      AMS.runAction('session.complete', { sessionId: s.id });
      AMS.ui.role = 'athlete';
      assert(pr.loads[41] === l1, 'session.complete double-counted the app RPE (' + l1 + ' → ' + pr.loads[41] + ')');
    }
  });
  T('a coach-adjusted recovery session scales the athlete\'s load', 'athlete', () => {
    const pr = hero(); const s = AMS.todaySessionFor(pr);
    AMS.ui.role = 'coach'; AMS.runAction('session.modifyForAthlete', { athleteId: pr.id, sessionId: s.id, variant: 'recovery' }); AMS.ui.role = 'athlete';
    assert(variantOf(AMS.byId(AMS.db.sessions, s.id), pr) === 'recovery', 'variant not set');
    const l0 = pr.loads[41];
    AMS.runAction('app.rpe', { athleteId: pr.id, sessionId: s.id, rpe: 3 });
    assert(pr.loads[41] - l0 === Math.round(3 * s.duration * variantScale('recovery')), 'recovery scale not applied');
  });
  T('rehab pain is recorded for medical staff; a coach preview is refused', 'physio', () => {
    const ro = byName('Rohan Gaikwad'); const inj = AMS.db.injuries.find((i) => i.athleteId === ro.id && i.status === 'Rehab');
    assert(inj, 'Rohan rehab case missing');
    AMS.runAction('app.rehabPain', { injuryId: inj.id, pain: 2 });
    let last = AMS.byId(AMS.db.injuries, inj.id).painLog.slice(-1)[0];
    assert(last.date === AMS.TODAY && last.pain === 2, 'pain log not updated');
    AMS.ui.role = 'coach';
    const r = AMS.runAction('app.rehabPain', { injuryId: inj.id, pain: 6 });
    AMS.ui.role = 'physio';
    last = AMS.byId(AMS.db.injuries, inj.id).painLog.slice(-1)[0];
    assert(r == null && last.pain === 2, 'coach was allowed to write a pain score');
    AMS.runAction('app.rehabExercise', { injuryId: inj.id, name: rehabPlanFor(inj)[0][0] });
    assert(doneToday(inj).length === 1, 'rehab exercise tick not stored');
  });
  T('fuel: water taps and supplement requests reach nutrition', 'athlete', () => {
    const pr = hero(); const h0 = hydrationOf(pr).ml;
    AMS.runAction('app.hydration', { athleteId: pr.id, ml: 250 });
    assert(hydrationOf(pr).ml === h0 + 250, 'hydration total did not move (' + h0 + ' → ' + hydrationOf(pr).ml + ')');
    const n0 = supplementsOf(pr).length;
    const prod = registryList().find((x) => x.tested && !supplementsOf(pr).some((r) => r.productId === x.id));
    assert(prod, 'no product left to request');
    AMS.runAction('app.supplementRequest', { athleteId: pr.id, productId: prod.id, reason: 'Post-session recovery' });
    assert(supplementsOf(pr).length === n0 + 1, 'supplement request not stored');
    assert(AMS.db.notifications.some((x) => x.toRole === 'nutritionist' && x.athleteId === pr.id), 'nutritionist not notified');
  });
  T('uploading the blood test report completes Priya\'s profile task; Operations cannot check in', 'athlete', () => {
    const pr = hero(); assert(pr.missingFields.includes('Blood test report'), 'seed changed: blood test not missing');
    AMS.runAction('app.uploadDoc', { athleteId: pr.id, type: 'Blood test report', quality: 'clear' });
    assert(!pr.missingFields.includes('Blood test report'), 'missing field not cleared');
    const t = AMS.db.tasks.find((x) => x.id === 'TSK-6'); assert(t && t.status === 'Done', 'TSK-6 not done');
    AMS.ui.role = 'ops';
    const an = byName('Ananya Joshi');
    const r = AMS.runAction('app.checkin', Object.assign({ athleteId: an.id }, GOOD));
    AMS.ui.role = 'athlete';
    assert(r == null && !an.wellness[27], 'Operations was allowed to write wellness');
  });
})();
