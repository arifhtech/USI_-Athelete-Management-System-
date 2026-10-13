/* USI · AMS — Nutrition module.
   Diet plans (phase-based targets in g/kg, Indian meal templates scaled to each athlete), hydration tracking (14-day log, urine colour,
   centre heat, sweat-rate testing), supplement management (batch-tested registry, request → nutritionist → doctor sign-off), meal-logging
   compliance, and body composition + weight-cut tracking for weight-class sports.
   AI: drafts plans from body weight, sport, phase and this week's training load (a human approves), and flags weight cuts, low hydration,
   low compliance, fuelling gaps after load jumps and risky supplement requests.
   Owns db.nutrition. Exposes AMS.nutrition (used by the Athlete App's Fuel tab and the athlete profile). */
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useMemo, useEffect } = React;
  const Frag = React.Fragment;
  const D = AMS.date, C = AMS.calc;
  const MOD = 'nutrition';

  /* ================================================================== styles (tokens only) */
  (function injectStyle() {
    try {
      if (typeof document === 'undefined' || !document.createElement) return;
      if (document.getElementById && document.getElementById('style-' + MOD)) return;
      const el = document.createElement('style');
      el.id = 'style-' + MOD;
      el.textContent = [
        '.nu-swatch{display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid var(--border-strong);vertical-align:-3px}',
        '.nu-urine{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px}',
        '.nu-urine div{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;color:var(--fg-3)}',
        '.nu-urine i{display:block;width:100%;height:22px;border-radius:5px;border:1px solid var(--border)}',
        '.nu-meal td{vertical-align:top}',
        '.nu-meal tr.tot td{font-weight:600;background:var(--surface-2)}',
        '.nu-cmp{display:grid;grid-template-columns:minmax(0,1.3fr) repeat(3,minmax(0,1fr));gap:6px 10px;font-size:12.5px;align-items:center}',
        '.nu-cmp .h{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3);font-weight:600}',
        '.nu-cond{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:4px 12px;align-items:center;padding:8px 16px;border-bottom:1px solid var(--border)}',
        '.nu-cond:last-child{border-bottom:0}',
      ].join('\n');
      (document.head || document.body).appendChild(el);
    } catch (e) { /* style injection unavailable (server render) */ }
  })();

  /* ================================================================== reference data */
  const WEIGHT_SPORTS = ['Boxing', 'Wrestling', 'Weightlifting'];
  const MACROS = {
    Sprints: { protein: 1.8, carbsTrain: 5.0, carbsRest: 3.5, fat: 1.0 },
    Jumps: { protein: 1.8, carbsTrain: 5.0, carbsRest: 3.5, fat: 1.0 },
    'Middle distance': { protein: 1.6, carbsTrain: 7.0, carbsRest: 5.0, fat: 1.0 },
    Throws: { protein: 2.0, carbsTrain: 5.0, carbsRest: 4.0, fat: 1.2 },
    Weightlifting: { protein: 2.0, carbsTrain: 5.0, carbsRest: 4.0, fat: 1.1 },
    Boxing: { protein: 2.0, carbsTrain: 4.5, carbsRest: 3.0, fat: 0.9 },
    Freestyle: { protein: 2.0, carbsTrain: 4.5, carbsRest: 3.0, fat: 0.9 },
    Hockey: { protein: 1.7, carbsTrain: 6.0, carbsRest: 4.0, fat: 1.0 },
  };
  const SWEAT = { Athletics: 1.0, Hockey: 1.3, Boxing: 1.2, Wrestling: 1.4, Weightlifting: 0.8 };
  // Centre conditions today (°C, % relative humidity)
  const WEATHER = { PUN: [29, 62], MUM: [31, 78], BLR: [26, 70], PAT: [31, 55], SNP: [34, 68], BPL: [30, 58], GUW: [30, 82], TVM: [30, 80], BBS: [32, 79] };
  // Foods per unit: [name, [unit, plural], kcal, protein, carbs, fat, whole-number portions?, size per unit, measure].
  // Whole foods are served in whole numbers; measured foods are shown in g/ml; the rest in ¼ portions. Protein and carb foods scale separately.
  const FOODS = {
    poha: ['Poha', ['plate', 'plates'], 300, 6, 54, 7], upma: ['Vegetable upma', ['plate', 'plates'], 250, 6, 40, 8],
    idli: ['Idli', ['idli', 'idlis'], 60, 2, 12, 0.4, 1], sambar: ['Sambar', ['bowl', 'bowls'], 130, 6, 20, 3],
    banana: ['Banana', ['banana', 'bananas'], 105, 1.3, 27, 0.4, 1], dates: ['Dates', ['date', 'dates'], 23, 0.2, 6, 0, 1],
    smoothie: ['Banana-peanut smoothie', ['glass', 'glasses'], 380, 14, 50, 14, 0, 300, 'ml'], oatsmoothie: ['Banana-oat smoothie', ['glass', 'glasses'], 330, 12, 58, 6, 0, 300, 'ml'],
    egg: ['Boiled egg', ['boiled egg', 'boiled eggs'], 78, 6.3, 0.6, 5.3, 1], omelette: ['Egg omelette', ['two-egg omelette', 'two-egg omelettes'], 190, 13, 2, 14, 1],
    toast: ['Whole-wheat toast', ['slice of whole-wheat toast', 'slices of whole-wheat toast'], 75, 3, 13, 1, 1], roti: ['Roti', ['roti', 'rotis'], 120, 4, 23, 2, 1],
    rice: ['Steamed rice', ['cup', 'cups'], 210, 4, 46, 0.5], dal: ['Dal', ['bowl', 'bowls'], 180, 11, 28, 3], rajma: ['Rajma', ['bowl', 'bowls'], 230, 13, 38, 3],
    paneer: ['Paneer bhurji', ['serving', 'servings'], 300, 18, 6, 23, 0, 100, 'g paneer'], tofu: ['Tofu bhurji', ['serving', 'servings'], 220, 20, 6, 13, 0, 150, 'g tofu'],
    soya: ['Soya chunk curry', ['serving', 'servings'], 175, 26, 17, 1, 0, 50, 'g soya chunks'],
    chicken: ['Chicken curry', ['serving', 'servings'], 330, 38, 8, 16, 0, 150, 'g chicken'], fish: ['Fish curry', ['serving', 'servings'], 280, 32, 6, 14, 0, 150, 'g fish'],
    eggcurry: ['Egg curry', ['egg curry (2 eggs)', 'egg curries (2 eggs each)'], 260, 14, 10, 18, 1], curd: ['Curd', ['bowl', 'bowls'], 120, 7, 9, 6, 0, 200, 'g'],
    sabzi: ['Mixed veg sabzi', ['bowl', 'bowls'], 150, 4, 18, 7], fruit: ['Seasonal fruit', ['bowl', 'bowls'], 120, 1.5, 30, 0.5],
    chana: ['Roasted chana', ['handful', 'handfuls'], 150, 8, 24, 2.5, 0, 40, 'g'], milk: ['Milk', ['glass', 'glasses'], 150, 8, 12, 8, 0, 250, 'ml'],
    soymilk: ['Soy milk', ['glass', 'glasses'], 130, 8, 10, 6, 0, 250, 'ml'], sprouts: ['Sprouts chaat', ['bowl', 'bowls'], 160, 10, 26, 1.5],
  };
  const PROTEIN_FOODS = new Set(['egg', 'omelette', 'paneer', 'tofu', 'soya', 'chicken', 'fish', 'eggcurry', 'curd', 'milk', 'soymilk', 'dal', 'rajma', 'sprouts', 'chana']);
  const frac = (q) => { const w = Math.floor(q + 1e-9), r = AMS.round(q - w, 2); return ((w ? String(w) : '') + ({ 0.25: '¼', 0.5: '½', 0.75: '¾' }[r] || '')) || '0'; };
  const PRE = { slot: 'Pre-training', time: '06:15', trainOnly: true, items: [['banana', 1], ['dates', 3]] };
  const BED = { slot: 'Bedtime', time: '21:45', items: [['milk', 1]] };
  const MEALS = {
    Vegetarian: [PRE, { slot: 'Breakfast', time: '09:00', items: [['poha', 1], ['curd', 1], ['fruit', 1]] }, { slot: 'Lunch', time: '13:00', items: [['roti', 3], ['rice', 1], ['rajma', 1], ['soya', 1], ['sabzi', 1]] }, { slot: 'Evening snack', time: '16:30', items: [['smoothie', 1], ['chana', 1]] }, { slot: 'Dinner', time: '20:00', items: [['roti', 3], ['dal', 1], ['paneer', 1], ['sabzi', 1]] }, BED],
    Eggetarian: [PRE, { slot: 'Breakfast', time: '09:00', items: [['omelette', 1], ['toast', 2], ['fruit', 1]] }, { slot: 'Lunch', time: '13:00', items: [['roti', 3], ['rice', 1], ['dal', 1], ['sabzi', 1], ['curd', 1]] }, { slot: 'Evening snack', time: '16:30', items: [['smoothie', 1], ['egg', 2]] }, { slot: 'Dinner', time: '20:00', items: [['roti', 3], ['dal', 1], ['eggcurry', 1], ['sabzi', 1]] }, BED],
    'Non-vegetarian': [PRE, { slot: 'Breakfast', time: '09:00', items: [['idli', 4], ['sambar', 1], ['egg', 2]] }, { slot: 'Lunch', time: '13:00', items: [['rice', 1.5], ['roti', 2], ['chicken', 1], ['sabzi', 1], ['curd', 1]] }, { slot: 'Evening snack', time: '16:30', items: [['smoothie', 1], ['fruit', 1]] }, { slot: 'Dinner', time: '20:00', items: [['roti', 3], ['dal', 1], ['fish', 1], ['sabzi', 1]] }, BED],
  };
  const LACTOSE_SWAP = { curd: 'sprouts', milk: 'soymilk', paneer: 'tofu' };
  const PEANUT_SWAP = { smoothie: 'oatsmoothie' };
  const REGISTRY = [
    { id: 'SUP-WHEY', product: 'Whey protein isolate', category: 'Protein', tested: true, cert: 'Informed Sport, batch tested', note: 'Post-session, 25 g' },
    { id: 'SUP-CRE', product: 'Creatine monohydrate', category: 'Performance', tested: true, cert: 'Informed Sport, batch tested', note: '3 g daily' },
    { id: 'SUP-ORS', product: 'Electrolyte sachets', category: 'Hydration', tested: true, cert: 'NSF Certified for Sport', note: 'Hot or double-session days' },
    { id: 'SUP-BA', product: 'Beta-alanine', category: 'Performance', tested: true, cert: 'Informed Sport, batch tested', note: 'Tingling is normal; split doses' },
    { id: 'SUP-CAF', product: 'Caffeine 100 mg tablets', category: 'Performance', tested: true, cert: 'NSF Certified for Sport', note: 'Max 3 mg/kg; not after 14:00' },
    { id: 'SUP-VD3', product: 'Vitamin D3 60,000 IU', category: 'Micronutrient', tested: true, cert: 'Pharmaceutical grade (Rx)', note: 'Weekly, only after a blood test' },
    { id: 'SUP-IRON', product: 'Iron + folic acid', category: 'Micronutrient', tested: true, cert: 'Pharmaceutical grade (Rx)', note: 'Doctor prescription only' },
    { id: 'SUP-OM3', product: 'Omega-3 fish oil', category: 'Health', tested: true, cert: 'Informed Sport, batch tested', note: '2 g EPA+DHA daily' },
    { id: 'SUP-BICARB', product: 'Sodium bicarbonate capsules', category: 'Performance', tested: true, cert: 'Informed Sport, batch tested', note: 'Trial in training first (gut upset)' },
    { id: 'SUP-ASH', product: 'Ashwagandha extract (local brand)', category: 'Herbal', tested: false, risk: 'Herbal products are not batch-tested; contamination with prohibited substances has been reported.' },
    { id: 'SUP-PRE', product: 'Imported pre-workout "X-Plode"', category: 'Stimulant', tested: false, risk: 'Similar imported pre-workouts contained undeclared stimulants on the WADA prohibited list.' },
    { id: 'SUP-MASS', product: 'Mass gainer (unbranded)', category: 'Protein', tested: false, risk: 'Unbranded gainers have been linked to anabolic agent contamination; not batch-tested.' },
  ];
  const MONTHS6 = ['2026-05-08', '2026-06-09', '2026-07-10', '2026-08-10', '2026-09-10', '2026-10-09'];
  const DEXA = ['PUN', 'BLR', 'PAT', 'BBS'];
  const URINE = [[1, 'Very pale'], [2, 'Pale'], [3, 'Straw'], [4, 'Light yellow'], [5, 'Yellow'], [6, 'Dark yellow'], [7, 'Amber'], [8, 'Brown']];
  const urineTone = (n) => (n <= 3 ? 'good' : n <= 5 ? 'warn' : 'bad');
  const urineFill = (n) => (n <= 5 ? 'color-mix(in srgb, var(--warn) ' + (8 + n * 15) + '%, var(--surface))' : 'color-mix(in srgb, var(--bad) ' + ((n - 5) * 25) + '%, var(--warn))');

  /* ================================================================== helpers */
  const nut = () => (AMS.db && AMS.db.nutrition) || {};
  const ath = (id) => AMS.org.athlete(id);
  const first = (a) => (a && a.name ? a.name.split(' ')[0] : '');
  const r1 = (v) => AMS.round(v, 1);
  const fmtL = (ml) => (Math.round((ml || 0) / 100) / 10).toFixed(1) + ' L';
  const pctTone = (p) => (p == null ? '' : p >= 80 ? 'good' : p >= 60 ? 'warn' : 'bad');
  const denied = (msg) => { AMS.toast(msg, 'bad'); return null; };
  const meName = () => (AMS.me() || {}).name || AMS.roleLabel(AMS.ui.role);
  const canEditNut = () => AMS.canEdit('nutrition');
  const canSeeNut = (role) => { const r = role || AMS.ui.role; return r !== 'athlete' && AMS.access('nutrition', r) !== 'none'; };
  const variantOf = (s, a) => (s && s.mods && s.mods[a.id] && s.mods[a.id].variant) || 'none';
  const macrosFor = (a) => MACROS[a.discipline] || MACROS[a.sport] || MACROS.Sprints;
  const centreOf = (a) => (a.tempAssignment && a.tempAssignment.active ? a.tempAssignment.centreId : a.centreId);
  const weatherOf = (cid) => { const w = WEATHER[cid] || [30, 60]; const idx = w[0] + 0.1 * (w[1] - 40); return { temp: w[0], hum: w[1], idx, level: idx >= 36 ? 'Very high' : idx >= 33 ? 'High' : idx >= 30 ? 'Moderate' : 'Low', tone: idx >= 36 ? 'bad' : idx >= 33 ? 'warn' : idx >= 30 ? 'info' : 'good' }; };
  const nutritionistFor = (a) => AMS.db.staff.find((s) => s.role === 'nutritionist' && s.centreId === a.centreId) || AMS.db.staff.find((s) => s.role === 'nutritionist');
  const categoryLimit = (a) => (WEIGHT_SPORTS.includes(a.sport) ? parseFloat(a.events) || null : null);
  const dayTypeFor = (a) => { const s = AMS.todaySessionFor(a); return s && variantOf(s, a) !== 'excluded' ? 'Training day' : 'Rest day'; };
  const pastDate = (i, n) => D.add(AMS.TODAY, i - (n || 14)); // index i of a 14-day history ending yesterday
  function nextComp(a) { return (AMS.db.competitions || []).filter((c) => c.date >= AMS.TODAY && (c.sports || []).includes(a.sport)).sort((x, y) => x.date.localeCompare(y.date))[0] || null; }

  function planOf(a) { return (nut().plans || {})[a.id] || null; }
  function targetsFor(a, p, day) {
    const w = a.weightKg || 60;
    const carbs = day === 'Rest day' ? p.carbsRest : p.carbsTrain;
    return { kcal: Math.round(((p.protein * 4 + carbs * 4 + p.fat * 9) * w) / 10) * 10, protein: Math.round(p.protein * w), carbs: Math.round(carbs * w), fat: Math.round(p.fat * w), perKg: { protein: p.protein, carbs, fat: p.fat } };
  }
  /** Rounded portion of one food at scale f (whole items to whole numbers, others to halves). */
  const portionOf = (k, q, f) => { const fd = FOODS[k]; return fd[6] ? Math.max(1, Math.round(q * f)) : Math.max(fd[7] && fd[8] !== 'ml' ? 0.25 : 0.5, Math.round(q * f * 4) / 4); };
  const labelOf = (k, qty) => { const fd = FOODS[k]; return fd[6] ? qty + ' ' + (qty === 1 ? fd[1][0] : fd[1][1]) : fd[7] ? fd[0] + ', ' + (fd[8] === 'ml' ? Math.round((qty * fd[7]) / 25) * 25 : Math.round((qty * fd[7]) / 5) * 5) + ' ' + fd[8] : fd[0] + ', ' + frac(qty) + ' ' + (qty > 1 ? fd[1][1] : fd[1][0]); };
  /** Best scale factors for protein foods and carb foods, scored on the ROUNDED portions so the plan that is served hits
      the energy, protein and carbohydrate targets (energy weighted highest). */
  function fitFactors(raw, t) {
    let best = [1, 1], err = Infinity;
    const items = raw.flatMap((m) => m.items);
    for (let fp = 0.4; fp <= 2.5001; fp += 0.1) {
      for (let fc = 0.3; fc <= 2.5001; fc += 0.1) {
        let K = 0, P = 0, Cb = 0;
        items.forEach(([k, q]) => { const fd = FOODS[k], n = portionOf(k, q, PROTEIN_FOODS.has(k) ? fp : fc); K += fd[2] * n; P += fd[3] * n; Cb += fd[4] * n; });
        const e = 4 * (K / t.kcal - 1) ** 2 + 1.5 * (P / t.protein - 1) ** 2 + (Cb / t.carbs - 1) ** 2;
        if (e < err) { err = e; best = [fp, fc]; }
      }
    }
    return best;
  }
  function mealsFor(a, p, day) {
    const rest = day === 'Rest day';
    const tpl = (MEALS[p.preference] || MEALS.Vegetarian).filter((m) => !(rest && m.trainOnly));
    const al = p.allergies || [];
    const swap = (k) => (al.includes('Lactose') && LACTOSE_SWAP[k]) || (al.includes('Peanut') && PEANUT_SWAP[k]) || k;
    const t = targetsFor(a, p, day);
    const raw = tpl.map((m) => ({ slot: m.slot, time: m.time, items: m.items.map(([k, q]) => [swap(k), q]) }));
    const [fp, fc] = fitFactors(raw, t);
    const meals = raw.map((m) => {
      const items = m.items.map(([k, q]) => {
        const fd = FOODS[k], f = PROTEIN_FOODS.has(k) ? fp : fc;
        const qty = portionOf(k, q, f);
        const label = labelOf(k, qty);
        return { key: k, name: fd[0], label, qty, kcal: fd[2] * qty, protein: fd[3] * qty, carbs: fd[4] * qty, fat: fd[5] * qty };
      });
      return { slot: m.slot, time: m.time, items, kcal: Math.round(AMS.sum(items.map((x) => x.kcal))), protein: Math.round(AMS.sum(items.map((x) => x.protein))), carbs: Math.round(AMS.sum(items.map((x) => x.carbs))), fat: Math.round(AMS.sum(items.map((x) => x.fat))) };
    });
    const tot = { kcal: AMS.sum(meals.map((m) => m.kcal)), protein: AMS.sum(meals.map((m) => m.protein)), carbs: AMS.sum(meals.map((m) => m.carbs)), fat: AMS.sum(meals.map((m) => m.fat)) };
    return { meals, totals: tot, targets: t };
  }
  function defaultSweat(a) { const w = weatherOf(centreOf(a)); return r1((SWEAT[a.sport] || 1.0) * (w.temp >= 32 ? 1.15 : 1)); }
  function sweatRateOf(a) { const s = (nut().sweat || {})[a.id]; return s ? s.rate : defaultSweat(a); }
  function targetMl(a, day) {
    const s = AMS.todaySessionFor(a);
    const train = (day || dayTypeFor(a)) === 'Training day';
    const hours = train ? (s ? s.duration : 75) / 60 : 0;
    return Math.round(((a.weightKg || 60) * 35 + sweatRateOf(a) * 1000 * hours) / 100) * 100;
  }
  const waterToday = (a) => ((nut().water || {})[a.id] || []).filter((e) => e.date === AMS.TODAY);
  function hydOf(a) { return (nut().hyd || {})[a.id] || null; }
  function hydRatio7(a) { const h = hydOf(a); if (!h || !h.L || !h.L.length) return null; return AMS.mean(h.L.slice(-7)) / (h.target || 3); }
  function compOf(a) { return (nut().compliance || {})[a.id] || null; }
  function comp7(a) { const c = compOf(a); return c && c.length ? Math.round(AMS.mean(c.slice(-7))) : null; }
  function bodyOf(a) { return ((nut().body || {})[a.id] || []).map(([kg, bf], i) => ({ date: MONTHS6[i], kg, bf, lean: r1(kg * (1 - bf / 100)), method: DEXA.includes(a.centreId) ? 'DEXA' : 'Skinfold (ISAK)' })); }
  function cutOf(a) {
    const w = (nut().weighIns || {})[a.id], limit = categoryLimit(a);
    if (!w || !w.length || !limit) return null;
    const start = w[0], current = w[w.length - 1];
    const cutPct = r1(((start - current) / start) * 100);
    const above = r1(current - limit);
    const status = cutPct > 3 ? 'Cut risk' : cutPct > 2 || above > limit * 0.05 ? 'Watch' : 'On track';
    return { limit, start, current, cutPct, above, series: w, status, tone: status === 'Cut risk' ? 'bad' : status === 'Watch' ? 'warn' : 'good' };
  }
  function requestsOf(aid) { return (nut().requests || []).filter((r) => r.athleteId === aid); }
  const product = (id) => (nut().registry || REGISTRY).find((x) => x.id === id);
  const suppTone = (s) => (s === 'Approved' ? 'good' : s === 'Rejected' || s === 'Blocked' ? 'bad' : s === 'Doctor sign-off' ? 'warn' : 'info');

  /** AI plan draft: body weight, sport, phase, this week's load, weight-cut status, rehab and logging behaviour → new targets with reasons. */
  function draftFor(a) {
    const cur = planOf(a) || basePlan(a);
    const base = macrosFor(a);
    const acwr = C.acwr(a), wk = C.weekLoad(a);
    const norm = AMS.mean([1, 2, 3].map((k) => C.weekLoad(a, k))) || wk;
    const loadUp = norm ? (wk - norm) / norm : 0;
    const cut = cutOf(a), age = D.ageOn(a.dob);
    const inj = AMS.db.injuries.find((i) => i.athleteId === a.id && i.status !== 'Closed' && i.status !== 'Monitoring');
    const comp = nextComp(a), c7 = comp7(a);
    let protein = cur.protein, carbsTrain = cur.carbsTrain, carbsRest = cur.carbsRest, fat = cur.fat, phase = cur.phase;
    const why = [];
    if (acwr >= 1.3 || loadUp > 0.2) {
      const add = acwr >= 1.5 ? 1.0 : 0.5;
      carbsTrain = r1(Math.min(base.carbsTrain + 2, Math.max(carbsTrain, base.carbsTrain) + add));
      why.push({ label: 'Load this week', value: wk.toLocaleString('en-IN') + ' AU (' + (loadUp >= 0 ? '+' : '') + Math.round(loadUp * 100) + '%)', tone: 'warn', text: 'Training load is ' + Math.round(loadUp * 100) + '% above the 4-week normal (ACWR ' + acwr.toFixed(2) + '): +' + add + ' g/kg carbohydrate on training days to cover the extra work and protect recovery.' });
    }
    if (cut && cut.cutPct > 3) {
      phase = 'Weight-making (supervised)'; protein = Math.max(protein, 2.2); carbsTrain = Math.max(carbsTrain, 3.5); fat = Math.max(fat, 0.8);
      why.push({ label: '14-day weight change', value: '−' + cut.cutPct + '%', tone: 'bad', text: 'Lost ' + cut.cutPct + '% in 14 days' + (age < 18 ? ' as an under-18 athlete' : '') + '. Slow the cut to at most 0.5 kg a week: protein 2.2 g/kg, carbs at least 3.5 g/kg on training days, no fluid restriction.' });
    }
    if (inj && inj.status !== 'Reported') {
      protein = Math.max(protein, 2.0); carbsTrain = Math.max(base.carbsRest, r1(carbsTrain - 1)); phase = 'Return to play';
      why.push({ label: 'Rehab', value: AMS.medicalFull() ? inj.regionLabel : AMS.bodyZone(inj.region), tone: 'info', text: 'In rehab: protein 2.0 g/kg supports tissue repair; training-day carbs lowered 1 g/kg for the reduced load.' });
    }
    if (comp && D.diff(comp.date, AMS.TODAY) <= 21 && !(cut && cut.cutPct > 3) && !inj) {
      phase = 'Pre-competition';
      why.push({ label: comp.name, value: D.rel(comp.date), tone: 'info', text: 'Competition in ' + D.diff(comp.date, AMS.TODAY) + ' days: rehearse race-day breakfast and carb timing in training this week.' });
    }
    if (c7 != null && c7 < 60) why.push({ label: 'Meal logging', value: c7 + '%', tone: 'warn', text: 'Only ' + c7 + '% of meals logged this week: the plan keeps to hostel-mess dishes the athlete already eats.' });
    if (!why.length) why.push({ label: 'Stable', value: 'no change', tone: 'good', text: 'Load, weight and body composition are stable. The current targets still fit; this draft re-confirms them for 4 weeks.' });
    return { phase, protein: r1(protein), carbsTrain: r1(carbsTrain), carbsRest: r1(carbsRest), fat: r1(fat), why, confidence: AMS.round(0.72 + Math.min(0.2, why.length * 0.05), 2), createdAt: AMS.TODAY + 'T' + AMS.clockTime(), by: 'AI draft' };
  }
  function basePlan(a) { const m = macrosFor(a); return { phase: 'General prep', preference: 'Vegetarian', allergies: [], protein: m.protein, carbsTrain: m.carbsTrain, carbsRest: m.carbsRest, fat: m.fat, status: 'Draft' }; }

  /* ================================================================== public API (Athlete App, athlete profile, copilot) */
  AMS.nutrition = {
    planFor: (aid) => { const a = ath(aid); return a ? planOf(a) : null; },
    targets: (aid, day) => { const a = ath(aid), p = a && planOf(a); return p ? targetsFor(a, p, day || dayTypeFor(a)) : null; },
    todayPlan: (aid) => {
      const a = ath(aid), p = a && planOf(a);
      if (!p) return null;
      const day = dayTypeFor(a), m = mealsFor(a, p, day);
      return { dayType: day, status: p.status, kcal: m.targets.kcal, protein: m.targets.protein, carbs: m.targets.carbs, fat: m.targets.fat, meals: m.meals.map((x) => ({ slot: x.slot, time: x.time, kcal: x.kcal, items: x.items.map((i) => ({ name: i.label })) })) };
    },
    hydrationToday: (aid) => { const a = ath(aid); if (!a) return null; const e = waterToday(a); return { ml: AMS.sum(e.map((x) => x.ml)), targetMl: targetMl(a), entries: e }; },
    registry: () => (nut().registry || REGISTRY),
    requestsFor: (aid) => requestsOf(aid),
    weightCut: (aid) => { const a = ath(aid); return a ? cutOf(a) : null; },
    compliance7: (aid) => { const a = ath(aid); return a ? comp7(a) : null; },
    draftFor: (aid) => { const a = ath(aid); return a ? draftFor(a) : null; },
  };

  /* ================================================================== seed */
  AMS.registerSeed('nutrition', function (db, rng) {
    const N = { plans: {}, hyd: {}, water: {}, compliance: {}, body: {}, weighIns: {}, sweat: {}, sweatTests: [], registry: REGISTRY.map((x) => Object.assign({}, x)), requests: [], reviews: {}, reminders: [] };
    const act = db.athletes.filter((a) => a.enrollment === 'Active');
    const hero = db.meta.heroAthleteId;
    const sq = (id) => db.athletes.filter((a) => a.squadId === id && a.enrollment === 'Active');
    const hasOpenInj = (a) => db.injuries.some((i) => i.athleteId === a.id && i.status !== 'Closed');
    const pickClean = (list, n) => list.filter((a) => !hasOpenInj(a) && !a.tempAssignment).slice(n, n + 1)[0];
    const cutters = [pickClean(sq('SQ-PUN-BOX17'), 6), pickClean(sq('SQ-SNP-WR20'), 5), pickClean(sq('SQ-GUW-BOX17'), 3)].filter(Boolean);
    const cutSet = new Set(cutters.map((a) => a.id));
    act.forEach((a) => {
      const age = D.ageOn(a.dob, AMS.TODAY);
      const limit = WEIGHT_SPORTS.includes(a.sport) ? parseFloat(a.events) || null : null;
      // Weight-class athletes walk around a little above their category; cutters are dropping fast.
      if (limit) a.weightKg = cutSet.has(a.id) ? r1(limit * (1 + 0.012 + rng() * 0.01)) : r1(limit * (1 + 0.01 + rng() * 0.04));
      /* weigh-ins (14 mornings, last = today) */
      if (limit) {
        const cutPct = cutSet.has(a.id) ? 0.036 + rng() * 0.012 : 0;
        const start = a.weightKg * (1 + cutPct) / (1 - 0.002);
        N.weighIns[a.id] = Array.from({ length: 14 }, (_, i) => r1(i === 13 ? a.weightKg : start + ((a.weightKg - start) * i) / 13 + rng.norm(0, cutPct ? 0.12 : 0.25)));
      }
      /* body composition: 6 monthly measurements */
      const female = a.gender === 'F';
      const bfBase = (female ? 21 : 11) + (a.discipline === 'Throws' || a.sport === 'Weightlifting' ? 3 : 0) + rng.norm(0, female ? 2.2 : 1.8);
      const drift = rng.norm(-0.15, 0.12);
      const kgDrift = rng.norm(0.1, 0.25);
      N.body[a.id] = MONTHS6.map((date, i) => {
        const back = 5 - i;
        let kg = a.weightKg - kgDrift * back + rng.norm(0, 0.35);
        if (cutSet.has(a.id)) kg = i === 5 ? a.weightKg + 0.4 : a.weightKg * 1.045 + rng.norm(0, 0.3);
        const bf = AMS.clamp(bfBase - drift * back + rng.norm(0, 0.4), 6, 32);
        return [r1(kg), r1(bf)];
      });
      if (a.id === hero) N.body[a.id] = MONTHS6.map((d, i) => [r1(51.2 + i * 0.16), r1(19.6 - i * 0.12)]);
      /* hydration: 14 past days vs target, urine colour */
      const w = WEATHER[a.centreId] || [30, 60];
      const rate = (SWEAT[a.sport] || 1) * (w[0] >= 32 ? 1.15 : 1);
      const target = Math.round(((a.weightKg * 35) + rate * 1000 * 1.25) / 100) / 10;
      const low = a.squadId === 'SQ-SNP-WR20';
      const mu = low ? 0.64 : a.centreId === 'GUW' || a.centreId === 'TVM' ? 0.86 : 0.93;
      const L = [], urine = [];
      for (let i = 0; i < 14; i++) {
        const ratio = AMS.clamp(rng.norm(mu, low ? 0.07 : 0.09) - (cutSet.has(a.id) && i > 6 ? 0.12 : 0), 0.35, 1.35);
        L.push(r1(target * ratio));
        urine.push(AMS.clamp(Math.round(ratio >= 1 ? 2 + rng() * 1.4 : ratio >= 0.85 ? 3 + rng() * 1.5 : ratio >= 0.7 ? 4.5 + rng() * 1.5 : 6 + rng() * 1.6), 1, 8));
      }
      N.hyd[a.id] = { L, urine, target };
      /* water logged so far this morning (Pune athletes who have checked in) */
      if (a.id === hero) N.water[a.id] = [{ date: AMS.TODAY, at: '06:35', ml: 250 }, { date: AMS.TODAY, at: '06:58', ml: 250 }];
      else if (a.centreId === 'PUN' && a.wellness && a.wellness[27] && rng.chance(0.7)) N.water[a.id] = Array.from({ length: rng.int(1, 3) }, (_, k) => ({ date: AMS.TODAY, at: '06:' + String(10 + k * 17 + rng.int(0, 9)).padStart(2, '0'), ml: rng.pick([250, 250, 500]) }));
      /* meal-logging compliance, 14 past days */
      const lowComp = rng.chance(0.08) || (a.squadId === 'SQ-SNP-WR20' && rng.chance(0.3));
      const cBase = lowComp ? rng.norm(0.45, 0.08) : rng.norm(0.82, 0.08);
      N.compliance[a.id] = Array.from({ length: 14 }, (_, i) => { const dow = D.dowIndex(pastDate(i)); return Math.round(AMS.clamp(cBase + rng.norm(0, 0.1) - (dow === 0 ? 0.15 : 0), 0, 1) * 100); });
      /* plan */
      const m = macrosFor(a);
      const inj = db.injuries.find((i) => i.athleteId === a.id && ['Rehab', 'Assessment', 'Clearance'].includes(i.status));
      const phase = cutSet.has(a.id) ? 'Weight-making' : inj ? 'Return to play' : a.squadId === 'SQ-PUN-SPR17' || a.squadId === 'SQ-PUN-SPR20' ? 'Pre-competition' : a.sport === 'Boxing' ? 'Specific prep' : 'General prep';
      const pref = a.id === hero ? 'Eggetarian' : rng.pick(['Vegetarian', 'Vegetarian', 'Vegetarian', 'Non-vegetarian', 'Non-vegetarian', 'Eggetarian']);
      const allergies = rng.chance(0.06) ? ['Lactose'] : rng.chance(0.03) ? ['Peanut'] : [];
      const roll = rng();
      const status = a.id === hero ? 'Published' : roll < 0.07 ? 'None' : roll < 0.13 ? 'Draft' : 'Published';
      if (status !== 'None') {
        const nu = db.staff.find((s) => s.role === 'nutritionist' && s.centreId === a.centreId);
        N.plans[a.id] = {
          phase, preference: pref, allergies, status,
          protein: r1(m.protein + rng.norm(0, 0.08)), carbsTrain: r1(m.carbsTrain + rng.norm(0, 0.2) - (cutSet.has(a.id) ? 1.5 : 0)), carbsRest: r1(m.carbsRest + rng.norm(0, 0.15) - (cutSet.has(a.id) ? 1 : 0)), fat: r1(m.fat + rng.norm(0, 0.05)),
          updated: D.add(AMS.TODAY, -rng.int(9, 58)), by: nu ? nu.name : 'Nutritionist', history: [],
        };
        if (a.id === hero) Object.assign(N.plans[a.id], { protein: 1.8, carbsTrain: 5.0, carbsRest: 3.5, fat: 1.0, updated: '2026-09-02', by: 'Farah Khan' });
      }
    });
    /* sweat-rate tests */
    const tests = [[sq('SQ-PUN-SPR17')[4], 1.08], [sq('SQ-PUN-SPR20')[3], 1.21], [sq('SQ-SNP-WR20')[0], 1.62], [sq('SQ-SNP-WR20')[3], 1.74], [sq('SQ-PUN-BOX17')[0], 1.35]].filter((x) => x[0]);
    tests.forEach(([a, rate], k) => {
      const t = { id: 'SWT-' + (301 + k), athleteId: a.id, date: D.add(AMS.TODAY, -(4 + k * 3)), rate, pre: r1(a.weightKg + 0.6), post: r1(a.weightKg - rate * 0.6), fluidMl: 600, urineMl: 0, minutes: 75, lossPct: r1((rate * 0.6 / a.weightKg) * 100), by: k < 2 || k === 4 ? 'Farah Khan' : 'Pooja Phogat' };
      N.sweatTests.push(t); N.sweat[a.id] = { rate, date: t.date, by: t.by };
    });
    /* supplement requests */
    const byName = (n) => db.athletes.find((a) => a.name === n);
    const rq = (a, pid, status, daysAgo, reason, extra) => {
      if (!a) return;
      const p = REGISTRY.find((x) => x.id === pid);
      const r = Object.assign({ id: 'SRQ-' + (501 + N.requests.length), athleteId: a.id, productId: pid, product: p.product, status, requested: D.add(AMS.TODAY, -daysAgo), reason, history: [{ date: D.add(AMS.TODAY, -daysAgo), by: a.name, text: 'Requested from the athlete app' }] }, extra || {});
      if (status === 'Doctor sign-off' || status === 'Approved') r.history.unshift({ date: D.add(AMS.TODAY, -daysAgo + 1), by: 'Farah Khan', text: 'Nutritionist approved — sent for doctor sign-off' });
      if (status === 'Approved') r.history.unshift({ date: D.add(AMS.TODAY, -daysAgo + 2), by: 'Dr. Vikram Menon', text: 'Doctor signed off' });
      if (status === 'Rejected') r.history.unshift({ date: D.add(AMS.TODAY, -daysAgo + 1), by: 'Farah Khan', text: 'Rejected: ' + r.note });
      if (status === 'Blocked') r.history.unshift({ date: D.add(AMS.TODAY, -daysAgo), by: 'System', text: 'Blocked automatically: product is not batch-tested' });
      N.requests.push(r);
    };
    rq(db.athletes.find((a) => a.id === hero), 'SUP-WHEY', 'Approved', 40, 'Recovery after evening sessions');
    rq(byName('Kavya Nair'), 'SUP-IRON', 'Doctor sign-off', 3, 'Low ferritin on September blood test');
    rq(byName('Rohan Gaikwad'), 'SUP-CRE', 'Requested', 2, 'Strength phase during rehab');
    rq(byName('Aman Shinde'), 'SUP-OM3', 'Requested', 1, 'Recommended by a teammate');
    rq(cutters[0], 'SUP-PRE', 'Blocked', 1, 'Energy for training while making weight');
    rq(sq('SQ-PUN-SPR20')[4], 'SUP-CAF', 'Approved', 21, 'Competition mornings only');
    rq(sq('SQ-PUN-JMP20')[2], 'SUP-MASS', 'Rejected', 9, 'Want to gain weight', { note: 'Unbranded gainer, not batch-tested. Switched to food-first plan + whey.' });
    rq(sq('SQ-SNP-WR20')[1], 'SUP-ORS', 'Approved', 12, 'Heavy sweating in the mat hall');
    rq(sq('SQ-SNP-WR20')[7], 'SUP-ASH', 'Blocked', 4, 'Recovery and sleep');
    rq(sq('SQ-BLR-SPRSR')[3], 'SUP-BA', 'Requested', 5, '400 m speed endurance block');
    rq(sq('SQ-PAT-WL')[2], 'SUP-CRE', 'Approved', 30, 'Strength block');
    db.nutrition = N;
  });

  /* ================================================================== workflow actions */
  function logHydration(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    const own = AMS.ui.role === 'athlete' && AMS.me() && AMS.me().id === a.id;
    if (!own && !canSeeNut()) return denied(AMS.roleLabel(AMS.ui.role) + ' cannot record nutrition data');
    const ml = AMS.clamp(Math.round(+p.ml || 250), 50, 2000);
    const before = AMS.sum(waterToday(a).map((e) => e.ml)), target = targetMl(a);
    AMS.mutate((db) => {
      const n = db.nutrition || (db.nutrition = {});
      n.water = n.water || {};
      n.water[a.id] = (n.water[a.id] || []).filter((e) => D.diff(AMS.TODAY, e.date) <= 7).concat({ date: AMS.TODAY, at: AMS.clockTime(), ml });
      if (before < target && before + ml >= target) AMS.log({ type: 'nutrition', text: a.name + ' reached today\'s water target (' + fmtL(target) + ')', athleteId: a.id, by: a.name, role: 'athlete' });
    });
    AMS.toast('+' + ml + ' ml · ' + fmtL(before + ml) + ' of ' + fmtL(target), 'good');
    return 'Logged ' + ml + ' ml';
  }

  function generatePlan(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    if (!canEditNut()) return denied('Only nutritionists can draft diet plans');
    const draft = draftFor(a);
    AMS.mutate((db) => {
      const n = db.nutrition;
      if (!n.plans[a.id]) n.plans[a.id] = Object.assign(basePlan(a), { status: 'Draft', updated: AMS.TODAY, by: meName(), history: [] });
      n.plans[a.id].draft = draft;
    }, { toast: 'AI drafted a plan for ' + a.name + ' — review and approve', toastKind: 'ai', log: { type: 'nutrition', text: 'AI plan draft for ' + a.name + ': ' + draft.why.map((w) => w.label).join(', '), athleteId: a.id } });
    return 'Draft ready: ' + draft.carbsTrain + ' g/kg carbs on training days';
  }

  function approvePlan(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    if (!canEditNut()) return denied('Only nutritionists can publish diet plans');
    const plan = planOf(a);
    if (!plan) return denied('No plan to approve for ' + a.name);
    const d = plan.draft;
    AMS.mutate((db) => {
      const x = db.nutrition.plans[a.id];
      const prev = { protein: x.protein, carbsTrain: x.carbsTrain, carbsRest: x.carbsRest, fat: x.fat, phase: x.phase, date: x.updated };
      if (d) Object.assign(x, { phase: d.phase, protein: d.protein, carbsTrain: d.carbsTrain, carbsRest: d.carbsRest, fat: d.fat });
      x.history = [prev].concat(x.history || []).slice(0, 6);
      x.status = 'Published'; x.updated = AMS.TODAY; x.by = meName(); x.draft = null; x.approvedFrom = d ? 'AI draft' : 'Manual';
      const t = targetsFor(a, x, 'Training day');
      AMS.notify({ toRole: 'athlete', title: 'New diet plan published', text: 'Your plan was updated by ' + meName() + ': ' + t.kcal + ' kcal on training days, ' + t.carbs + ' g carbs, ' + t.protein + ' g protein.', athleteId: a.id, module: 'nutrition' });
      AMS.notify({ toRole: 'coach', title: 'Diet plan updated', text: a.name + ': ' + x.phase + ' plan published (' + t.kcal + ' kcal on training days).', athleteId: a.id, module: 'nutrition' });
    }, { toast: 'Plan published for ' + a.name, log: { type: 'nutrition', text: 'Diet plan published for ' + a.name + (d ? ' (from AI draft, human-approved)' : ''), athleteId: a.id } });
    return 'Published';
  }

  function discardDraft(p) {
    const a = ath(p.athleteId), plan = a && planOf(a);
    if (!plan || !plan.draft) return null;
    if (!canEditNut()) return denied('Only nutritionists can change diet plans');
    AMS.mutate((db) => { db.nutrition.plans[a.id].draft = null; if (db.nutrition.plans[a.id].status === 'Draft' && !(db.nutrition.plans[a.id].history || []).length) db.nutrition.plans[a.id].status = 'Draft'; }, { toast: 'Draft discarded', toastKind: 'info', log: { type: 'nutrition', text: 'AI plan draft discarded for ' + a.name, athleteId: a.id } });
    return 'Discarded';
  }

  function requestSupplement(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    const own = AMS.ui.role === 'athlete' && AMS.me() && AMS.me().id === a.id;
    if (!own && !canSeeNut()) return denied(AMS.roleLabel(AMS.ui.role) + ' cannot handle supplement requests');
    const prod = product(p.productId);
    if (!prod) return denied('Pick a product first');
    if (requestsOf(a.id).some((r) => r.productId === prod.id && !['Rejected'].includes(r.status))) return denied(prod.product + ' is already requested');
    const status = prod.tested ? 'Requested' : 'Blocked';
    let id = null;
    AMS.mutate((db) => {
      id = 'SRQ-' + (501 + db.nutrition.requests.length) + '-' + AMS.uid('R').slice(-3);
      const hist = [{ date: AMS.TODAY, by: own ? a.name : a.name + ' (via ' + meName() + ')', text: 'Requested' + (p.reason ? ': ' + p.reason : '') }];
      if (!prod.tested) hist.unshift({ date: AMS.TODAY, by: 'System', text: 'Blocked automatically: product is not batch-tested (anti-doping risk)' });
      db.nutrition.requests.unshift({ id, athleteId: a.id, productId: prod.id, product: prod.product, status, requested: AMS.TODAY, reason: String(p.reason || '').slice(0, 200), history: hist });
      AMS.notify({ toRole: 'nutritionist', title: prod.tested ? 'Supplement request' : 'Blocked supplement request', text: a.name + ' requested ' + prod.product + (prod.tested ? '.' : ' — NOT batch-tested, blocked automatically. Talk to the athlete about a tested alternative.'), athleteId: a.id, module: 'nutrition' });
      if (!prod.tested) AMS.notify({ toRole: 'doctor', title: 'Anti-doping risk', text: a.name + ' asked for ' + prod.product + ' (not batch-tested). Request blocked.', athleteId: a.id, module: 'nutrition' });
      AMS.log({ type: 'nutrition', text: a.name + ' requested ' + prod.product + (prod.tested ? '' : ' — blocked (not batch-tested)'), athleteId: a.id, by: a.name, role: own ? 'athlete' : AMS.ui.role });
    });
    AMS.toast(prod.tested ? 'Request sent to the nutritionist' : prod.product + ' is not batch-tested — request blocked', prod.tested ? 'good' : 'bad');
    return prod.tested ? 'Requested' : 'Blocked';
  }

  /** Supplement workflow: nutritionist review → doctor sign-off → Approved / Rejected (reason required to reject). */
  function reviewSupplement(p) {
    const r = (nut().requests || []).find((x) => x.id === p.requestId);
    if (!r) return null;
    const role = AMS.ui.role, a = ath(r.athleteId);
    const approve = p.decision === 'approve';
    if (!approve && !String(p.note || '').trim()) return denied('Add a reason before rejecting');
    let next;
    if (r.status === 'Requested') { if (role !== 'nutritionist') return denied('The nutritionist reviews requests first'); next = approve ? 'Doctor sign-off' : 'Rejected'; }
    else if (r.status === 'Doctor sign-off') { if (role !== 'doctor') return denied('Waiting for the team doctor to sign off'); next = approve ? 'Approved' : 'Rejected'; }
    else if (r.status === 'Blocked') { if (approve) return denied('Not batch-tested products cannot be approved'); if (!['nutritionist', 'doctor'].includes(role)) return denied('Only the nutritionist or doctor can close this'); next = 'Rejected'; }
    else return denied('Already ' + r.status.toLowerCase());
    AMS.mutate((db) => {
      const x = db.nutrition.requests.find((y) => y.id === r.id);
      x.status = next; x.decidedBy = meName(); if (!approve) x.note = p.note;
      x.history.unshift({ date: AMS.TODAY, by: meName(), text: next === 'Doctor sign-off' ? 'Nutritionist approved — sent for doctor sign-off' : next === 'Approved' ? 'Doctor signed off' + (p.note ? ': ' + p.note : '') : 'Rejected: ' + p.note });
      if (next === 'Doctor sign-off') AMS.notify({ toRole: 'doctor', title: 'Supplement sign-off', text: a.name + ': ' + r.product + ' approved by the nutritionist, needs your sign-off.', athleteId: a.id, module: 'nutrition' });
      AMS.notify({ toRole: 'athlete', title: 'Supplement ' + (next === 'Approved' ? 'approved' : next === 'Rejected' ? 'not approved' : 'with the doctor'), text: r.product + ': ' + (next === 'Approved' ? 'approved. Take it as advised.' : next === 'Rejected' ? p.note : 'nutritionist approved, waiting for the team doctor.'), athleteId: a.id, module: 'nutrition' });
    }, { toast: r.product + ' → ' + next, toastKind: next === 'Rejected' ? 'info' : 'good', log: { type: 'nutrition', text: 'Supplement ' + r.product + ' for ' + a.name + ': ' + next, athleteId: a.id } });
    return next;
  }

  function sweatTest(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    if (!canEditNut() && !AMS.canEdit('readiness')) return denied('Only the nutritionist or sports scientist can record sweat tests');
    const pre = +p.pre, post = +p.post, fluid = +p.fluidMl || 0, urine = +p.urineMl || 0, min = +p.minutes || 0;
    if (!(pre > 20 && post > 20 && min >= 20)) return denied('Enter pre and post weight and the session length');
    const rate = r1(((pre - post) * 1000 + fluid - urine) / 1000 / (min / 60));
    if (!(rate > 0.1 && rate < 4)) return denied('That sweat rate (' + rate + ' L/h) looks wrong — check the weights');
    const lossPct = r1(((pre - post) / pre) * 100);
    AMS.mutate((db) => {
      const n = db.nutrition;
      const t = { id: AMS.uid('SWT'), athleteId: a.id, date: AMS.TODAY, rate, pre, post, fluidMl: fluid, urineMl: urine, minutes: min, lossPct, by: meName() };
      n.sweatTests.unshift(t);
      n.sweat[a.id] = { rate, date: AMS.TODAY, by: meName() };
      if (n.hyd[a.id]) n.hyd[a.id].target = Math.round(((a.weightKg * 35) + rate * 1000 * 1.25) / 100) / 10;
      if (lossPct > 2) AMS.notify({ toRole: 'coach', title: 'Dehydration in session', text: a.name + ' lost ' + lossPct + '% body mass in ' + min + ' min (sweat rate ' + rate + ' L/h). Plan drink breaks every 15 min.', athleteId: a.id, module: 'nutrition' });
    }, { toast: 'Sweat rate ' + rate + ' L/h · hydration target updated', log: { type: 'nutrition', text: 'Sweat-rate test for ' + a.name + ': ' + rate + ' L/h, ' + lossPct + '% body mass lost', athleteId: a.id } });
    return rate + ' L/h';
  }

  function remind(p) {
    const ids = (p.athleteIds || []).filter((id) => ath(id));
    if (!ids.length) return denied('Nobody to remind');
    if (!canSeeNut() || AMS.ui.role === 'scientist' && false) return denied('Not available in this role');
    const kind = p.kind === 'hydration' ? 'hydration' : 'meals';
    AMS.mutate((db) => {
      ids.slice(0, 60).forEach((id) => AMS.notify({ toRole: 'athlete', title: kind === 'hydration' ? 'Drink up' : 'Log your meals', text: kind === 'hydration' ? 'You have been under your water target this week. Aim for ' + fmtL(targetMl(ath(id))) + ' today and check your urine colour (3 or lighter).' : 'Please log today\'s meals in the app; it takes 20 seconds a meal and keeps your plan accurate.', athleteId: id, module: 'nutrition' }));
      db.nutrition.reminders.unshift({ date: AMS.TODAY, at: AMS.clockTime(), kind, n: ids.length, by: meName() });
      db.meta.remindersSent = (db.meta.remindersSent || 0) + ids.length;
    }, { toast: (kind === 'hydration' ? 'Hydration' : 'Meal-logging') + ' reminder sent to ' + ids.length + ' athletes', log: { type: 'nutrition', text: (kind === 'hydration' ? 'Hydration' : 'Meal-logging') + ' reminder sent to ' + ids.length + ' athletes' } });
    return 'Reminded ' + ids.length;
  }

  function weightCutReview(p) {
    const a = ath(p.athleteId), cut = a && cutOf(a);
    if (!a || !cut) return null;
    if (!canSeeNut()) return denied('Not available in this role');
    AMS.mutate((db) => {
      db.nutrition.reviews[a.id] = { date: AMS.TODAY, by: meName(), cutPct: cut.cutPct };
      db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Weight-cut review — ' + a.name + ' (−' + cut.cutPct + '% in 14 days)', ownerRole: 'doctor', module: 'nutrition', status: 'Open', created: AMS.TODAY, due: D.add(AMS.TODAY, 1), athleteId: a.id });
      db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Safe weight-making plan — ' + a.name, ownerRole: 'nutritionist', module: 'nutrition', status: 'Open', created: AMS.TODAY, due: D.add(AMS.TODAY, 1), athleteId: a.id });
      AMS.notify({ toRole: 'doctor', title: 'Weight-cut review', text: a.name + ' (' + D.ageOn(a.dob) + ') lost ' + cut.cutPct + '% in 14 days, now ' + cut.current + ' kg for the ' + cut.limit + ' kg category. Please review hydration and safety.', athleteId: a.id, module: 'nutrition' });
      AMS.notify({ toRole: 'coach', title: 'Weight cut paused for review', text: a.name + ': nutritionist and doctor reviewing the weight cut. No extra sweat sessions until cleared.', athleteId: a.id, module: 'nutrition' });
    }, { toast: 'Weight-cut review requested — doctor and coach notified', log: { type: 'nutrition', text: 'Weight-cut review opened for ' + a.name + ' (−' + cut.cutPct + '%)', athleteId: a.id } });
    return 'Review requested';
  }

  AMS.registerAction('nutrition.logHydration', logHydration);
  AMS.registerAction('nutrition.generatePlan', generatePlan);
  AMS.registerAction('nutrition.approvePlan', approvePlan);
  AMS.registerAction('nutrition.discardDraft', discardDraft);
  AMS.registerAction('nutrition.requestSupplement', requestSupplement);
  AMS.registerAction('nutrition.reviewSupplement', reviewSupplement);
  AMS.registerAction('nutrition.sweatTest', sweatTest);
  AMS.registerAction('nutrition.remind', remind);
  AMS.registerAction('nutrition.weightCutReview', weightCutReview);

  /* ================================================================== AI detectors */
  const scoped = (ctx) => ctx.athletes;
  AMS.registerDetector('nutrition.weightCut', function (ctx) {
    if (!canSeeNut(ctx.role)) return [];
    return scoped(ctx).map((a) => ({ a, w: cutOf(a) })).filter((x) => x.w && x.w.cutPct > 3).map(({ a, w }) => {
      const age = D.ageOn(a.dob), u18 = age < 18, comp = nextComp(a);
      const reviewed = (nut().reviews || {})[a.id];
      return {
        id: 'wcut:' + a.id + ':' + AMS.TODAY, kind: 'nutrition', severity: u18 || w.cutPct > 5 ? 'high' : 'med', module: MOD,
        title: a.name + ' — lost ' + w.cutPct + '% body weight in 14 days',
        summary: (u18 ? 'Under-18 athlete. ' : '') + 'Down from ' + w.start + ' kg to ' + w.current + ' kg, still ' + w.above + ' kg above the ' + w.limit + ' kg limit' + (comp ? ' with ' + D.diff(comp.date, AMS.TODAY) + ' days to ' + comp.name : '') + '. More than 3% in two weeks raises dehydration and injury risk.' + (reviewed ? ' Review opened ' + D.rel(reviewed.date) + '.' : ' Review the cut with the doctor.'),
        athleteIds: [a.id], confidence: 0.91,
        evidence: [{ label: '14-day change', value: '−' + w.cutPct + '%', tone: 'bad' }, { label: 'Category', value: w.limit + ' kg', tone: 'info' }, { label: 'Above limit', value: w.above + ' kg', tone: 'warn' }].concat(u18 ? [{ label: 'Age', value: String(age), tone: 'warn' }] : []),
        actions: [{ label: 'Review cut with doctor', action: 'nutrition.weightCutReview', payload: { athleteId: a.id }, primary: true }, { label: 'Open weight tracking', action: 'go', payload: { module: MOD, params: { tab: 'body', athleteId: a.id } } }],
      };
    });
  });
  AMS.registerDetector('nutrition.lowHydration', function (ctx) {
    if (!canSeeNut(ctx.role)) return [];
    const bySq = AMS.groupBy(scoped(ctx).filter((a) => hydOf(a)), 'squadId');
    return Object.entries(bySq).map(([sqid, list]) => {
      const ratio = AMS.mean(list.map(hydRatio7));
      if (list.length < 3 || ratio >= 0.75) return null;
      const s = AMS.org.squad(sqid), c = AMS.org.centre(s.centreId), wx = weatherOf(s.centreId);
      const dark = list.filter((a) => (hydOf(a).urine || []).slice(-7).filter((u) => u >= 6).length >= 3).length;
      return {
        id: 'hyd:' + sqid + ':' + AMS.TODAY, kind: 'nutrition', severity: ratio < 0.68 ? 'high' : 'med', module: MOD,
        title: s.name + ' at ' + c.short + ' — drinking ' + Math.round(ratio * 100) + '% of target',
        summary: '7-day average across ' + list.length + ' athletes; ' + dark + ' logged urine colour 6 or darker on 3+ days. Today ' + wx.temp + '°C and ' + wx.hum + '% humidity (' + wx.level.toLowerCase() + ' heat stress).',
        athleteIds: list.map((a) => a.id), confidence: 0.84,
        evidence: [{ label: 'Of target', value: Math.round(ratio * 100) + '%', tone: 'bad' }, { label: 'Dark urine 3+ days', value: dark + '/' + list.length, tone: 'warn' }, { label: 'Heat', value: wx.temp + '°C · ' + wx.hum + '%', tone: wx.tone }],
        actions: [{ label: 'Send hydration reminder', action: 'nutrition.remind', payload: { athleteIds: list.map((a) => a.id), kind: 'hydration' }, primary: true }, { label: 'Book sweat-rate tests', action: 'task.create', payload: { title: 'Sweat-rate testing — ' + s.name + ' (' + c.short + ')', ownerRole: 'nutritionist', module: MOD } }],
      };
    }).filter(Boolean);
  });
  AMS.registerDetector('nutrition.lowCompliance', function (ctx) {
    if (!canSeeNut(ctx.role)) return [];
    const low = scoped(ctx).filter((a) => { const c = comp7(a); return c != null && c < 50; }).sort((x, y) => comp7(x) - comp7(y));
    if (low.length < 2) return [];
    return [{
      id: 'mlog:' + AMS.TODAY + ':' + low.length, kind: 'nutrition', severity: low.length > 8 ? 'med' : 'low', module: MOD,
      title: low.length + ' athletes logged under half their meals this week',
      summary: 'Lowest: ' + low.slice(0, 3).map((a) => a.name + ' (' + comp7(a) + '%)').join(', ') + '. Plans cannot be checked without logs; a reminder at 13:30 and 20:30 usually lifts logging by about 20 points.',
      athleteIds: low.map((a) => a.id), confidence: 0.8,
      evidence: [{ label: 'Under 50%', value: String(low.length), tone: 'warn' }, { label: 'Lowest', value: comp7(low[0]) + '%', tone: 'bad' }],
      actions: [{ label: 'Remind ' + low.length + ' athletes', action: 'nutrition.remind', payload: { athleteIds: low.map((a) => a.id), kind: 'meals' }, primary: true }, { label: 'Open compliance grid', action: 'go', payload: { module: MOD, params: { tab: 'compliance' } } }],
    }];
  });
  AMS.registerDetector('nutrition.unapprovedSupplement', function (ctx) {
    if (!canSeeNut(ctx.role)) return [];
    const reqs = (nut().requests || []).filter((r) => ctx.ids.has(r.athleteId));
    const out = [];
    reqs.filter((r) => r.status === 'Blocked' && D.diff(AMS.TODAY, r.requested) <= 7).forEach((r) => {
      const a = ath(r.athleteId), p = product(r.productId) || {};
      out.push({
        id: 'supp-block:' + r.id, kind: 'nutrition', severity: 'high', module: MOD,
        title: a.name + ' asked for a non-batch-tested supplement',
        summary: r.product + ' was blocked automatically. ' + (p.risk || '') + ' Talk to the athlete before they buy it themselves and offer a tested alternative.',
        athleteIds: [a.id], confidence: 0.95,
        evidence: [{ label: 'Product', value: r.product, tone: 'bad' }, { label: 'Batch-tested', value: 'No', tone: 'bad' }, { label: 'Requested', value: D.rel(r.requested), tone: 'info' }],
        actions: [{ label: 'Ask nutritionist to counsel', action: 'notify', payload: { toRole: 'nutritionist', athleteId: a.id, text: 'Please speak to ' + a.name + ' about ' + r.product + ' (not batch-tested) and suggest a tested alternative.' }, primary: true }, { label: 'Open supplement queue', action: 'go', payload: { module: MOD, params: { tab: 'supplements' } } }],
      });
    });
    const waiting = reqs.filter((r) => (r.status === 'Requested' || r.status === 'Doctor sign-off') && (ctx.role !== 'doctor' || r.status === 'Doctor sign-off'));
    if (waiting.length && ['nutritionist', 'doctor', 'director'].includes(ctx.role)) {
      const oldest = waiting.slice().sort((x, y) => x.requested.localeCompare(y.requested))[0];
      out.push({
        id: 'supp-wait:' + AMS.TODAY + ':' + waiting.length + ':' + ctx.role, kind: 'nutrition', severity: D.diff(AMS.TODAY, oldest.requested) > 2 ? 'med' : 'low', module: MOD,
        title: waiting.length + ' supplement request' + (waiting.length > 1 ? 's' : '') + ' waiting for ' + (ctx.role === 'doctor' ? 'your sign-off' : 'review'),
        summary: 'Oldest: ' + ath(oldest.athleteId).name + ', ' + oldest.product + ' (' + D.rel(oldest.requested) + '). Unanswered requests push athletes to buy supplements on their own.',
        athleteIds: waiting.map((r) => r.athleteId), confidence: 0.9,
        evidence: [{ label: 'Waiting', value: String(waiting.length), tone: 'warn' }, { label: 'Oldest', value: D.rel(oldest.requested), tone: 'info' }],
        actions: [{ label: 'Open supplement queue', action: 'go', payload: { module: MOD, params: { tab: 'supplements' } }, primary: true }],
      });
    }
    return out;
  });
  AMS.registerDetector('nutrition.fuelForLoad', function (ctx) {
    if (!canSeeNut(ctx.role)) return [];
    return scoped(ctx).filter((a) => { const p = planOf(a); return p && !p.draft && C.acwr(a) >= 1.5 && p.carbsTrain < macrosFor(a).carbsTrain + 0.6 && a.availability !== 'Unavailable'; }).slice(0, 6).map((a) => {
      const p = planOf(a), acwr = C.acwr(a), wk = C.weekLoad(a);
      const nutr = ctx.role === 'nutritionist';
      return {
        id: 'fuel:' + a.id + ':' + AMS.TODAY, kind: 'nutrition', severity: 'med', module: MOD,
        title: a.name + ' — training load jumped, diet plan has not',
        summary: 'This week ' + wk.toLocaleString('en-IN') + ' AU (ACWR ' + acwr.toFixed(2) + ') on a plan of ' + p.carbsTrain + ' g/kg carbohydrate set ' + D.rel(p.updated) + '. Under-fuelling during a load jump adds to injury risk.',
        athleteIds: [a.id], confidence: 0.76,
        evidence: [{ label: 'ACWR', value: acwr.toFixed(2), tone: 'bad' }, { label: 'Carbs (training day)', value: p.carbsTrain + ' g/kg', tone: 'warn' }, { label: 'Plan updated', value: D.rel(p.updated), tone: 'info' }],
        actions: nutr ? [{ label: 'Draft updated plan', action: 'nutrition.generatePlan', payload: { athleteId: a.id }, primary: true }, { label: 'Open plan', action: 'go', payload: { module: MOD, params: { tab: 'plans', athleteId: a.id } } }]
          : [{ label: 'Ask nutritionist to review', action: 'notify', payload: { toRole: 'nutritionist', athleteId: a.id, text: a.name + ': load jump (ACWR ' + acwr.toFixed(2) + '). Please review fuelling — plan is ' + p.carbsTrain + ' g/kg carbs.' }, primary: true }],
      };
    });
  });

  /* ================================================================== shared UI bits */
  function NoEdit({ what }) { return html`<span className="tiny faint row tight"><${UI.Icon} name="lock" size=${12} />${what || 'Only nutritionists can change this'}</span>`; }
  function UrineScale({ value }) {
    return html`<div className="nu-urine">${URINE.map(([n, label]) => html`<div key=${n} title=${label}><i style=${{ background: urineFill(n), outline: value === n ? '2px solid var(--accent)' : 'none' }} /><span>${n}</span></div>`)}</div>`;
  }
  function AthletePicker({ list, value, onChange }) {
    const opts = list.slice().sort((x, y) => x.name.localeCompare(y.name)).map((a) => ({ value: a.id, label: a.name + ' · ' + (AMS.org.squad(a.squadId) || {}).name }));
    return html`<${UI.Select} value=${value} onChange=${onChange} options=${opts} />`;
  }

  /* ================================================================== tabs */
  function Overview({ list, setTab, setPick, v }) {
    const s = useMemo(() => {
      const withData = list.filter((a) => hydOf(a));
      const plans = list.map((a) => planOf(a));
      const pub = plans.filter((p) => p && p.status === 'Published').length;
      const draft = plans.filter((p) => p && (p.status === 'Draft' || p.draft)).length;
      const none = plans.filter((p) => !p).length;
      const comps = list.map(comp7).filter((x) => x != null);
      const onTarget = withData.filter((a) => hydRatio7(a) >= 0.9).length;
      const compDaily = Array.from({ length: 14 }, (_, i) => Math.round(AMS.mean(list.map((a) => (compOf(a) || [])[i]).filter((x) => x != null))));
      const hydDaily = Array.from({ length: 14 }, (_, i) => Math.round(AMS.mean(withData.map((a) => hydOf(a).L[i] / hydOf(a).target)) * 100));
      const squads = AMS.groupBy(list, 'squadId');
      const bySquad = Object.entries(squads).map(([id, l]) => ({ id, name: (AMS.org.squad(id) || {}).name + ' · ' + (AMS.org.centre((AMS.org.squad(id) || {}).centreId) || {}).short, comp: Math.round(AMS.mean(l.map(comp7).filter((x) => x != null))), hyd: Math.round(AMS.mean(l.map(hydRatio7).filter((x) => x != null)) * 100) }));
      const cuts = list.map((a) => ({ a, w: cutOf(a) })).filter((x) => x.w && x.w.status !== 'On track');
      return { pub, draft, none, total: list.length, comp: comps.length ? Math.round(AMS.mean(comps)) : null, onTarget, withData: withData.length, compDaily, hydDaily, bySquad, cuts };
    }, [v, list.length]);
    const insights = AMS.ai.insights({ module: MOD });
    const flagged = new Set(insights.flatMap((i) => i.athleteIds || []));
    const centres = [...new Set(list.map(centreOf))];
    const cov = s.total ? Math.round((s.pub / s.total) * 100) : 0;
    const hydPct = s.withData ? Math.round((s.onTarget / s.withData) * 100) : 0;
    return html`<div className="col loose">
      <div className="grid g4">
        <${UI.KPI} label="Plan coverage" icon="book" value=${cov} unit="%" foot=${s.pub + ' of ' + s.total + ' published · ' + s.draft + (s.draft === 1 ? ' draft' : ' drafts')} tone=${cov >= 85 ? 'good' : 'warn'} onClick=${() => setTab('plans')} />
        <${UI.KPI} label="Meal logging (7 days)" icon="check" value=${s.comp == null ? '—' : s.comp} unit="%" spark=${s.compDaily} sparkTone=${pctTone(s.comp)} foot="Share of meals logged in the app" onClick=${() => setTab('compliance')} />
        <${UI.KPI} label="Hydration on target" icon="droplet" value=${hydPct} unit="%" spark=${s.hydDaily} sparkTone="info" foot=${s.onTarget + ' of ' + s.withData + ' athletes at 90%+ of target'} onClick=${() => setTab('hydration')} />
        <${UI.KPI} label="Athletes flagged by AI" icon="sparkles" value=${flagged.size} foot=${s.cuts.length + (s.cuts.length === 1 ? ' weight-class athlete' : ' weight-class athletes') + ' to watch'} tone=${flagged.size ? 'warn' : 'good'} onClick=${() => setTab('body')} />
      </div>
      <div className="grid g-main">
        <${UI.Card} title="Needs attention" ai=${true} hint=${insights.length + ' AI flags'} flush>
          <${UI.InsightList} insights=${insights} max=${6} empty="No nutrition flags in this scope" />
        <//>
        <div className="col">
          <${UI.Card} title="Conditions today" icon="sun" hint="Heat stress by centre" flush>
            <div>${centres.slice(0, 9).map((cid) => { const w = weatherOf(cid), c = AMS.org.centre(cid); return html`<div key=${cid} className="nu-cond">
              <span className="small ellipsis" style=${{ fontWeight: 600 }}>${c ? c.short : cid}</span><span className="small tnum">${w.temp}°C · ${w.hum}%</span><${UI.Pill} tone=${w.tone}>${w.level}<//></div>`; })}</div>
          <//>
          <${UI.Card} title="Plan status" icon="book">
            <div className="row" style=${{ gap: 16 }}>
              <${UI.Donut} size=${110} thickness=${14} data=${[{ label: 'Published', value: s.pub, tone: 'good' }, { label: 'Draft', value: s.draft, tone: 'ai' }, { label: 'No plan', value: s.none, tone: 'warn' }]} center=${html`<span><b className="num" style=${{ fontSize: 22 }}>${cov}%</b><br /><span className="tiny faint">covered</span></span>`} onSlice=${() => setTab('plans')} />
              <div className="col tight small"><span><${UI.Dot} tone="good" /> ${s.pub} published</span><span><${UI.Dot} tone="ai" /> ${s.draft} draft / awaiting approval</span><span><${UI.Dot} tone="warn" /> ${s.none} without a plan</span></div>
            </div>
          <//>
        </div>
      </div>
      <div className="grid g2">
        <${UI.Card} title="Meal logging by squad" icon="check" hint="7-day average">
          <${UI.HBars} labelWidth=${190} format=${(x) => x + '%'} max=${100} data=${s.bySquad.slice().sort((x, y) => x.comp - y.comp).slice(0, 10).map((q) => ({ label: q.name, value: q.comp || 0, tone: pctTone(q.comp), onClick: () => setTab('compliance', { squadId: q.id }) }))} />
        <//>
        <${UI.Card} title="Hydration by squad" icon="droplet" hint="% of target, 7-day average">
          <${UI.HBars} labelWidth=${190} format=${(x) => x + '%'} max=${110} data=${s.bySquad.slice().sort((x, y) => x.hyd - y.hyd).slice(0, 10).map((q) => ({ label: q.name, value: q.hyd || 0, tone: q.hyd >= 90 ? 'good' : q.hyd >= 75 ? 'warn' : 'bad', onClick: () => setTab('hydration', { squadId: q.id }) }))} />
        <//>
      </div>
    </div>`;
  }

  function PlanDetail({ a }) {
    const p = planOf(a);
    const [day, setDay] = useState(dayTypeFor(a));
    const edit = canEditNut();
    const nu = nutritionistFor(a);
    if (!p) return html`<${UI.Card} title=${a.name} icon="book">
      <${UI.Empty} icon="book" title="No diet plan yet">${a.name} has no plan. ${edit ? 'Let the AI draft one from body weight, sport, phase and this week\'s load, then review it.' : (nu ? nu.name : 'The nutritionist') + ' has not created one yet.'}<//>
      ${edit && html`<div className="row" style=${{ justifyContent: 'center' }}><button className="btn ai" onClick=${() => AMS.runAction('nutrition.generatePlan', { athleteId: a.id })}><${UI.Icon} name="sparkles" size=${14} />AI draft a plan</button></div>`}
    <//>`;
    const m = mealsFor(a, p, day);
    const t = m.targets;
    const d = p.draft;
    const cut = cutOf(a);
    const preview = d ? targetsFor(a, d, 'Training day') : null;
    const cur = targetsFor(a, p, 'Training day');
    return html`<div className="col">
      <${UI.Card} title=${html`<span className="row tight">${a.name}<${UI.Pill} tone=${p.status === 'Published' ? 'good' : 'ai'}>${p.status}<//>${d && html`<${UI.Pill} tone="ai">AI draft waiting<//>`}</span>`}
        actions=${html`<${UI.Seg} size="sm" value=${day} onChange=${setDay} options=${['Training day', 'Rest day']} /><button className="btn sm" onClick=${() => AMS.openAthlete(a.id, 'nutrition')}>Profile</button>`}>
        <div className="col" style=${{ gap: 14 }}>
          <${UI.DL} cols=${4} items=${[['Phase', p.phase], ['Preference', p.preference], ['Allergies', (p.allergies || []).length ? p.allergies.join(', ') : 'None'], ['Body weight', a.weightKg + ' kg' + (cut ? ' · ' + cut.limit + ' kg class' : '')], ['Today', dayTypeFor(a)], ['Updated', D.fmt(p.updated) + ' · ' + p.by], ['Sweat rate', sweatRateOf(a) + ' L/h' + ((nut().sweat || {})[a.id] ? ' (tested)' : ' (estimate)')], ['Water target', fmtL(targetMl(a, day))]]} />
          <div className="grid g4 keep">
            <${UI.KPI} label="Energy" value=${t.kcal.toLocaleString('en-IN')} unit="kcal" foot=${day} />
            <${UI.KPI} label="Protein" value=${t.protein} unit="g" foot=${t.perKg.protein + ' g/kg'} />
            <${UI.KPI} label="Carbohydrate" value=${t.carbs} unit="g" foot=${t.perKg.carbs + ' g/kg'} />
            <${UI.KPI} label="Fat" value=${t.fat} unit="g" foot=${t.perKg.fat + ' g/kg'} />
          </div>
          <div className="tbl-wrap"><table className="tbl compact nu-meal">
            <thead><tr><th>Meal</th><th>What to eat</th><th className="num">kcal</th><th className="num">Protein</th><th className="num">Carbs</th><th className="num hide-sm">Fat</th></tr></thead>
            <tbody>
              ${m.meals.map((x) => html`<tr key=${x.slot}><td style=${{ whiteSpace: 'nowrap' }}><b>${x.slot}</b><div className="tiny faint">${x.time}</div></td><td className="small">${x.items.map((i) => i.label).join(' · ')}</td><td className="num">${x.kcal}</td><td className="num">${x.protein} g</td><td className="num">${x.carbs} g</td><td className="num hide-sm">${x.fat} g</td></tr>`)}
              <tr className="tot"><td>Total</td><td className="small muted">Target ${t.kcal} kcal · ${t.protein} g protein · ${t.carbs} g carbs</td><td className="num">${Math.round(m.totals.kcal)}</td><td className=${'num ' + (Math.abs(m.totals.protein - t.protein) > t.protein * 0.15 ? 'warn' : '')}>${Math.round(m.totals.protein)} g</td><td className="num">${Math.round(m.totals.carbs)} g</td><td className="num hide-sm">${Math.round(m.totals.fat)} g</td></tr>
            </tbody>
          </table></div>
          <span className="tiny faint">Portions are scaled to the energy target from the ${p.preference.toLowerCase()} hostel-mess menu${(p.allergies || []).length ? ', with ' + p.allergies.join(' and ').toLowerCase() + '-free swaps' : ''}.</span>
        </div>
      <//>
      <${UI.Card} title="AI plan assistant" ai=${true} hint="drafts, a nutritionist approves">
        ${d ? html`<div className="col" style=${{ gap: 12 }}>
          <div className="nu-cmp">
            <span className="h">Target (training day)</span><span className="h">Current</span><span className="h">AI draft</span><span className="h">Change</span>
            ${[['Phase', p.phase, d.phase], ['Protein g/kg', p.protein, d.protein], ['Carbs g/kg', p.carbsTrain, d.carbsTrain], ['Carbs g/kg (rest)', p.carbsRest, d.carbsRest], ['Fat g/kg', p.fat, d.fat], ['Energy kcal', cur.kcal, preview.kcal]].map(([k, x, y]) => html`<${Frag} key=${k}><span>${k}</span><span className="tnum">${x}</span><span className="tnum" style=${{ fontWeight: 600 }}>${y}</span><span className=${typeof x === 'number' ? (y > x ? 'good' : y < x ? 'warn' : 'faint') : 'faint'}>${typeof x === 'number' ? (y === x ? '—' : (y > x ? '+' : '') + AMS.round(y - x, 1)) : x === y ? '—' : 'changed'}</span><//>`)}
          </div>
          <div className="col tight">${d.why.map((w, i) => html`<div key=${i} className="small"><b>${w.label}:</b> ${w.text}</div>`)}</div>
          <${UI.Evidence} items=${d.why.map((w) => ({ label: w.label, value: w.value, tone: w.tone }))} />
          <div className="row between wrap"><span className="tiny faint">${Math.round(d.confidence * 100)}% confidence · drafted ${d.createdAt.slice(11, 16)} · nothing changes until a nutritionist approves</span>
            ${edit ? html`<span className="row tight"><button className="btn sm" onClick=${() => AMS.runAction('nutrition.discardDraft', { athleteId: a.id })}>Discard</button><button className="btn sm primary" onClick=${() => AMS.runAction('nutrition.approvePlan', { athleteId: a.id })}><${UI.Icon} name="check" size=${13} />Approve & publish</button></span>` : html`<${NoEdit} what="Waiting for the nutritionist to approve" />`}</div>
        </div>` : html`<div className="col" style=${{ gap: 10 }}>
          <span className="small muted">The assistant re-checks ${first(a)}'s targets against body weight (${a.weightKg} kg), sport, phase, this week's load (${C.weekLoad(a).toLocaleString('en-IN')} AU, ACWR ${C.acwr(a).toFixed(2)})${cut ? ', the weight cut' : ''} and meal-logging (${comp7(a) == null ? '—' : comp7(a) + '%'}). It drafts; a nutritionist approves before anything reaches the athlete.</span>
          <div className="row tight wrap">
            ${edit ? html`<button className="btn ai sm" onClick=${() => AMS.runAction('nutrition.generatePlan', { athleteId: a.id })}><${UI.Icon} name="sparkles" size=${13} />Draft an updated plan</button>` : html`<${NoEdit} />`}
            ${edit && p.status !== 'Published' && html`<button className="btn sm primary" onClick=${() => AMS.runAction('nutrition.approvePlan', { athleteId: a.id })}>Publish as is</button>`}
            <${UI.AskCopilot} prompt=${'Is ' + first(a) + ' fuelled for this week\'s load?'} label="Ask Copilot" />
          </div>
        </div>`}
      <//>
      ${(p.history || []).length > 0 && html`<${UI.Card} title="Plan history" icon="clock">
        <${UI.Timeline} items=${p.history.map((h) => ({ date: D.fmt(h.date), title: h.phase + ' · ' + h.protein + ' g/kg protein, ' + h.carbsTrain + ' g/kg carbs', text: 'Fat ' + h.fat + ' g/kg · rest-day carbs ' + h.carbsRest + ' g/kg', icon: 'book' }))} />
      <//>`}
    </div>`;
  }

  function Plans({ list, sel, setSel }) {
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('all');
    const rows = list.filter((a) => (!q || a.name.toLowerCase().includes(q.toLowerCase())) && (filter === 'all' || (filter === 'draft' ? (planOf(a) && (planOf(a).status === 'Draft' || planOf(a).draft)) : filter === 'none' ? !planOf(a) : planOf(a) && planOf(a).status === 'Published')));
    const a = list.find((x) => x.id === sel) || list[0];
    return html`<div className="grid g-side">
      <${UI.Card} title="Athletes" icon="users" hint=${rows.length} flush>
        <div className="col" style=${{ gap: 8, padding: '10px 12px' }}>
          <${UI.Search} value=${q} onChange=${setQ} placeholder="Find athlete" />
          <${UI.Seg} size="sm" value=${filter} onChange=${setFilter} options=${[{ id: 'all', label: 'All' }, { id: 'draft', label: 'Drafts' }, { id: 'none', label: 'No plan' }, { id: 'pub', label: 'Published' }]} />
        </div>
        <${UI.Table} compact=${true} maxHeight=${560} rows=${rows} selectedId=${a && a.id} onRow=${(r) => setSel(r.id)} empty="No athletes match"
          columns=${[
            { key: 'name', label: 'Athlete', render: (r) => html`<div className="col tight" style=${{ gap: 0 }}><b className="small">${r.name}</b><span className="tiny faint">${(AMS.org.squad(r.squadId) || {}).name}</span></div>`, sort: (r) => r.name },
            { key: 'st', label: 'Plan', render: (r) => { const p = planOf(r); return p ? html`<${UI.Pill} tone=${p.draft ? 'ai' : p.status === 'Published' ? 'good' : 'ai'}>${p.draft ? 'AI draft' : p.status}<//>` : html`<${UI.Pill} tone="warn">None<//>`; }, sort: (r) => (planOf(r) ? planOf(r).status : 'Z') },
          ]} />
      <//>
      ${a ? html`<${PlanDetail} key=${a.id} a=${a} />` : html`<${UI.Empty} title="No athletes in scope" />`}
    </div>`;
  }

  function Hydration({ list, params, v }) {
    const [squad, setSquad] = useState(params.squadId || '');
    const [form, setForm] = useState({ athleteId: '', pre: '', post: '', fluidMl: '600', urineMl: '0', minutes: '75' });
    const rows = list.filter((a) => hydOf(a) && (!squad || a.squadId === squad));
    const squads = [...new Set(list.map((a) => a.squadId))].map((id) => ({ value: id, label: (AMS.org.squad(id) || {}).name + ' · ' + ((AMS.org.centre((AMS.org.squad(id) || {}).centreId) || {}).short) }));
    const centres = [...new Set(rows.map(centreOf))];
    const fa = ath(form.athleteId);
    const pre = +form.pre, post = +form.post, min = +form.minutes;
    const rate = pre > 20 && post > 20 && min >= 20 ? r1(((pre - post) * 1000 + (+form.fluidMl || 0) - (+form.urineMl || 0)) / 1000 / (min / 60)) : null;
    const loss = pre > 20 && post > 20 ? r1(((pre - post) / pre) * 100) : null;
    const set = (k) => (e) => setForm(Object.assign({}, form, { [k]: e.target ? e.target.value : e }));
    const tests = (nut().sweatTests || []).filter((t) => list.some((a) => a.id === t.athleteId)).slice(0, 6);
    return html`<div className="col loose">
      <div className="grid g-main">
        <${UI.Card} title="Team hydration board" icon="droplet" hint=${rows.length + ' athletes'} flush actions=${html`<${UI.Select} value=${squad} onChange=${setSquad} placeholder="All squads" options=${squads} />${canSeeNut() && rows.length > 0 && html`<button className="btn sm" onClick=${() => AMS.runAction('nutrition.remind', { athleteIds: rows.filter((a) => hydRatio7(a) < 0.85).map((a) => a.id), kind: 'hydration' })}>Remind under 85%</button>`}`}>
          <${UI.Table} compact=${true} maxHeight=${520} rows=${rows} initialSort=${{ key: 'r7', dir: 'asc' }}
            columns=${[
              { key: 'name', label: 'Athlete', render: (a) => html`<${UI.AthleteCell} athlete=${a} size=${26} />`, sort: (a) => a.name },
              { key: 'today', label: 'Today', render: (a) => { const ml = AMS.sum(waterToday(a).map((e) => e.ml)), t = targetMl(a); return html`<div className="col tight" style=${{ gap: 3, minWidth: 110 }}><span className="tiny tnum">${fmtL(ml)} / ${fmtL(t)}</span><${UI.Meter} value=${ml} max=${t} tone="info" /></div>`; }, sort: (a) => AMS.sum(waterToday(a).map((e) => e.ml)) / targetMl(a) },
              { key: 'r7', label: '7-day', num: true, render: (a) => { const r = Math.round(hydRatio7(a) * 100); return html`<span className=${r >= 90 ? 'good' : r >= 75 ? 'warn' : 'bad'} style=${{ fontWeight: 600 }}>${r}%</span>`; }, sort: (a) => hydRatio7(a) },
              { key: 'trend', label: '14 days', hideSm: true, sort: false, render: (a) => { const h = hydOf(a); return html`<${UI.Sparkline} data=${h.L.map((x) => x / h.target)} width=${90} height=${22} tone="info" />`; } },
              { key: 'urine', label: 'Urine', render: (a) => { const u = hydOf(a).urine.slice(-1)[0]; return html`<span className="row tight"><span className="nu-swatch" style=${{ background: urineFill(u) }} /><span className=${'small ' + urineTone(u)}>${u}</span></span>`; }, sort: (a) => hydOf(a).urine.slice(-1)[0] },
              { key: 'sweat', label: 'Sweat', num: true, hideSm: true, render: (a) => html`<span className=${(nut().sweat || {})[a.id] ? '' : 'faint'}>${sweatRateOf(a)} L/h</span>`, sort: (a) => sweatRateOf(a) },
            ]} />
        <//>
        <div className="col">
          <${UI.Card} title="Heat and humidity" icon="sun" flush>
            <div>${centres.slice(0, 6).map((cid) => { const w = weatherOf(cid); const c = AMS.org.centre(cid); return html`<div key=${cid} className="nu-cond"><div className="col tight" style=${{ gap: 0 }}><b className="small">${c ? c.short : cid}</b><span className="tiny faint">${w.level === 'Low' || w.level === 'Moderate' ? 'Normal drink breaks' : 'Drink breaks every 15 min; add electrolytes'}</span></div><span className="small tnum">${w.temp}°C · ${w.hum}%</span><${UI.Pill} tone=${w.tone}>${w.level}<//></div>`; })}</div>
          <//>
          <${UI.Card} title="Urine colour scale" icon="info" hint="1–3 well hydrated">
            <${UrineScale} />
            <div className="row between tiny faint" style=${{ marginTop: 6 }}><span>Well hydrated</span><span>Drink more</span><span>Dehydrated</span></div>
          <//>
        </div>
      </div>
      <div className="grid g2">
        <${UI.Card} title="Sweat-rate test" icon="scale" hint="weigh before and after a session">
          ${canEditNut() || AMS.canEdit('readiness') ? html`<div className="col" style=${{ gap: 10 }}>
            <${UI.Field} label="Athlete"><${AthletePicker} list=${list} value=${form.athleteId} onChange=${(id) => setForm(Object.assign({}, form, { athleteId: id, pre: ath(id) ? String(ath(id).weightKg + 0.6) : '' }))} /><//>
            <div className="grid g4 keep">
              <${UI.Field} label="Pre (kg)"><input className="input" inputMode="decimal" value=${form.pre} onChange=${set('pre')} /><//>
              <${UI.Field} label="Post (kg)"><input className="input" inputMode="decimal" value=${form.post} onChange=${set('post')} /><//>
              <${UI.Field} label="Drank (ml)"><input className="input" inputMode="numeric" value=${form.fluidMl} onChange=${set('fluidMl')} /><//>
              <${UI.Field} label="Minutes"><input className="input" inputMode="numeric" value=${form.minutes} onChange=${set('minutes')} /><//>
            </div>
            ${rate != null ? html`<div className="ai-box row between wrap"><span className="small"><b>${rate} L/h</b> sweat rate · <span className=${loss > 2 ? 'bad' : ''}>${loss}% body mass lost</span>${loss > 2 ? ' (above 2%: performance drops)' : ''}</span><span className="tiny muted">Drink ${Math.round(rate * 1000 * 0.8 / 4 / 10) * 10} ml every 15 min in similar sessions</span></div>` : html`<span className="tiny faint">Enter pre and post weights to see the sweat rate.</span>`}
            <div className="row" style=${{ justifyContent: 'flex-end' }}><button className="btn primary sm" disabled=${!fa || rate == null} onClick=${() => { if (AMS.runAction('nutrition.sweatTest', { athleteId: form.athleteId, pre, post, fluidMl: +form.fluidMl, urineMl: +form.urineMl, minutes: min })) setForm({ athleteId: '', pre: '', post: '', fluidMl: '600', urineMl: '0', minutes: '75' }); }}>Save test · update target</button></div>
          </div>` : html`<${NoEdit} what="Sweat tests are recorded by the nutritionist or sports scientist" />`}
        <//>
        <${UI.Card} title="Recent sweat tests" icon="clock" flush>
          ${tests.length ? html`<div className="list">${tests.map((t) => { const a = ath(t.athleteId); return html`<div key=${t.id} className="list-item"><${UI.AthleteCell} athlete=${a} size=${26} sub=${D.fmt(t.date) + ' · ' + t.minutes + ' min · ' + t.by} /><span className="grow" /><span className="small tnum" style=${{ fontWeight: 600 }}>${t.rate} L/h</span><${UI.Pill} tone=${t.lossPct > 2 ? 'bad' : 'good'}>${t.lossPct}%<//></div>`; })}</div>` : html`<${UI.Empty} icon="scale" title="No sweat tests in this scope" />`}
        <//>
      </div>
    </div>`;
  }

  function Supplements({ list }) {
    const ids = new Set(list.map((a) => a.id));
    const reqs = (nut().requests || []).filter((r) => ids.has(r.athleteId));
    const reg = nut().registry || REGISTRY;
    const role = AMS.ui.role;
    const [notes, setNotes] = useState({});
    const [stat, setStat] = useState('open');
    const shown = reqs.filter((r) => stat === 'all' || (stat === 'open' ? ['Requested', 'Doctor sign-off', 'Blocked'].includes(r.status) : r.status === 'Approved'));
    const using = (pid) => reqs.filter((r) => r.productId === pid && r.status === 'Approved').length;
    const act = (r, decision) => { const note = notes[r.id] || ''; if (AMS.runAction('nutrition.reviewSupplement', { requestId: r.id, decision, note })) setNotes(Object.assign({}, notes, { [r.id]: '' })); };
    const mine = (r) => (r.status === 'Requested' && role === 'nutritionist') || (r.status === 'Doctor sign-off' && role === 'doctor') || (r.status === 'Blocked' && ['nutritionist', 'doctor'].includes(role));
    return html`<div className="col loose">
      <div className="grid g4">
        <${UI.KPI} label="Waiting for nutritionist" value=${reqs.filter((r) => r.status === 'Requested').length} icon="clock" />
        <${UI.KPI} label="Waiting for doctor" value=${reqs.filter((r) => r.status === 'Doctor sign-off').length} icon="medical" />
        <${UI.KPI} label="Blocked (not tested)" value=${reqs.filter((r) => r.status === 'Blocked').length} icon="shield" tone=${reqs.some((r) => r.status === 'Blocked') ? 'bad' : ''} />
        <${UI.KPI} label="Approved and in use" value=${reqs.filter((r) => r.status === 'Approved').length} icon="shield-check" />
      </div>
      <${UI.Card} title="Request queue" icon="pill" hint="athlete → nutritionist → team doctor" flush actions=${html`<${UI.Seg} size="sm" value=${stat} onChange=${setStat} options=${[{ id: 'open', label: 'Open' }, { id: 'approved', label: 'Approved' }, { id: 'all', label: 'All' }]} />`}>
        ${shown.length ? html`<div className="list">${shown.map((r) => { const a = ath(r.athleteId), p = product(r.productId) || {}; return html`<div key=${r.id} className="list-item" style=${{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div style=${{ width: 220, flex: 'none' }}><${UI.AthleteCell} athlete=${a} size=${28} /></div>
          <div className="col tight grow" style=${{ gap: 3, minWidth: 220 }}>
            <span className="row tight wrap"><b className="small">${r.product}</b><${UI.Pill} tone=${p.tested ? 'good' : 'bad'}>${p.tested ? 'Batch-tested' : 'Not tested'}<//><${UI.Pill} tone=${suppTone(r.status)}>${r.status}<//></span>
            <span className="tiny muted">${r.reason ? '"' + r.reason + '" · ' : ''}requested ${D.rel(r.requested)}${r.note ? ' · ' + r.note : ''}</span>
            ${!p.tested && html`<span className="tiny bad row tight"><${UI.Icon} name="alert" size=${12} />${p.risk || 'Not batch-tested: anti-doping risk.'}</span>`}
            <span className="tiny faint">${(r.history || []).slice(0, 2).map((h) => D.fmt(h.date) + ' ' + h.by + ': ' + h.text).join(' · ')}</span>
          </div>
          ${mine(r) ? html`<div className="col tight" style=${{ gap: 6, width: 260 }}>
            <input className="input" placeholder=${r.status === 'Blocked' ? 'Note to athlete (required)' : 'Reason if rejecting'} value=${notes[r.id] || ''} onChange=${(e) => setNotes(Object.assign({}, notes, { [r.id]: e.target.value }))} />
            <div className="row tight">${r.status !== 'Blocked' && html`<button className="btn sm primary" onClick=${() => act(r, 'approve')}><${UI.Icon} name="check" size=${13} />${r.status === 'Requested' ? 'Approve → doctor' : 'Sign off'}</button>`}<button className="btn sm" onClick=${() => act(r, 'reject')}>${r.status === 'Blocked' ? 'Close with note' : 'Reject'}</button></div>
          </div>` : ['Requested', 'Doctor sign-off'].includes(r.status) ? html`<span className="tiny faint" style=${{ width: 160 }}>Waiting for ${r.status === 'Requested' ? 'the nutritionist' : 'the team doctor'}</span>` : null}
        </div>`; })}</div>` : html`<${UI.Empty} icon="pill" title="Nothing in this view" />`}
      <//>
      <${UI.Card} title="Supplement registry" icon="shield-check" hint="only batch-tested products can be approved" flush>
        <${UI.Table} compact=${true} rows=${reg} columns=${[
          { key: 'product', label: 'Product', render: (x) => html`<b className="small">${x.product}</b>` },
          { key: 'category', label: 'Category' },
          { key: 'tested', label: 'Anti-doping', render: (x) => html`<${UI.Pill} tone=${x.tested ? 'good' : 'bad'}>${x.tested ? 'Batch-tested' : 'Not tested'}<//>`, sort: (x) => (x.tested ? 1 : 0) },
          { key: 'cert', label: 'Certification / risk', hideSm: true, render: (x) => html`<span className=${'tiny ' + (x.tested ? 'muted' : 'bad')}>${x.tested ? x.cert : x.risk}</span>` },
          { key: 'note', label: 'Use', hideSm: true, render: (x) => html`<span className="tiny muted">${x.note || (x.tested ? '' : 'Blocked')}</span>` },
          { key: 'using', label: 'In use', num: true, render: (x) => using(x.id) || '—', sort: (x) => using(x.id) },
        ]} />
      <//>
    </div>`;
  }

  function Compliance({ list, params }) {
    const [squad, setSquad] = useState(params.squadId || '');
    const rows = list.filter((a) => compOf(a) && (!squad || a.squadId === squad)).sort((x, y) => comp7(x) - comp7(y));
    const squads = [...new Set(list.map((a) => a.squadId))].map((id) => ({ value: id, label: (AMS.org.squad(id) || {}).name + ' · ' + ((AMS.org.centre((AMS.org.squad(id) || {}).centreId) || {}).short) }));
    const cols = Array.from({ length: 14 }, (_, i) => { const d = pastDate(i); return D.dow(d).slice(0, 1) + ' ' + d.slice(8); });
    const low = rows.filter((a) => comp7(a) < 60);
    const last = (nut().reminders || []).find((r) => r.kind === 'meals');
    return html`<div className="col loose">
      <div className="grid g4">
        <${UI.KPI} label="Average (7 days)" value=${rows.length ? Math.round(AMS.mean(rows.map(comp7))) : '—'} unit="%" tone=${pctTone(rows.length ? AMS.mean(rows.map(comp7)) : null)} />
        <${UI.KPI} label="At 80% or more" value=${rows.filter((a) => comp7(a) >= 80).length} foot=${'of ' + rows.length + ' athletes'} />
        <${UI.KPI} label="Under 60%" value=${low.length} tone=${low.length ? 'warn' : 'good'} />
        <${UI.KPI} label="Last reminder" value=${last ? last.at : '—'} foot=${last ? last.n + ' athletes · ' + last.by : 'None sent today'} />
      </div>
      <${UI.Card} title="Meal logging, last 14 days" icon="grid" hint="% of planned meals logged · lowest first" actions=${html`<${UI.Select} value=${squad} onChange=${setSquad} placeholder="All squads" options=${squads} />${canSeeNut() && low.length > 0 && html`<button className="btn sm primary" onClick=${() => AMS.runAction('nutrition.remind', { athleteIds: low.map((a) => a.id), kind: 'meals' })}><${UI.Icon} name="send" size=${13} />Remind ${low.length} under 60%</button>`}`}>
        ${rows.length ? html`<${UI.HeatGrid} cols=${cols} labelW=${190} rows=${rows.slice(0, 40).map((a) => ({ label: a.name + ' · ' + comp7(a) + '%', onClick: () => AMS.openAthlete(a.id, 'nutrition'), cells: compOf(a).map((c, i) => ({ label: c, tone: pctTone(c), title: a.name + ' · ' + D.fmt(pastDate(i)) + ': ' + c + '% of meals logged' })) }))} />` : html`<${UI.Empty} icon="grid" title="No logging data in this scope" />`}
        ${rows.length > 40 && html`<div className="tiny faint" style=${{ marginTop: 6 }}>Showing the 40 lowest of ${rows.length}. Narrow by squad to see everyone.</div>`}
      <//>
    </div>`;
  }

  function Body({ list, sel, setSel }) {
    const [mode, setMode] = useState('athlete');
    const a = list.find((x) => x.id === sel) || list[0];
    const wc = list.map((x) => ({ a: x, w: cutOf(x) })).filter((x) => x.w).sort((x, y) => y.w.cutPct - x.w.cutPct);
    const series = a ? bodyOf(a) : [];
    const cut = a ? cutOf(a) : null;
    const squads = AMS.groupBy(list.filter((x) => bodyOf(x).length), 'squadId');
    const sqRows = Object.entries(squads).map(([id, l]) => ({ id, label: (AMS.org.squad(id) || {}).name, now: r1(AMS.mean(l.map((x) => bodyOf(x)[5].bf))), then: r1(AMS.mean(l.map((x) => bodyOf(x)[0].bf))), n: l.length })).sort((x, y) => x.now - y.now);
    return html`<div className="col loose">
      ${wc.length > 0 && html`<${UI.Card} title="Weight-class athletes" icon="scale" hint="14-day morning weigh-ins vs category limit" flush>
        <${UI.Table} compact=${true} maxHeight=${320} rows=${wc.map((x) => Object.assign({ id: x.a.id }, x))} onRow=${(r) => { setSel(r.a.id); setMode('athlete'); }} selectedId=${a && a.id}
          columns=${[
            { key: 'name', label: 'Athlete', render: (r) => html`<${UI.AthleteCell} athlete=${r.a} size=${26} />`, sort: (r) => r.a.name },
            { key: 'cat', label: 'Category', render: (r) => r.w.limit + ' kg', sort: (r) => r.w.limit },
            { key: 'cur', label: 'Today', num: true, render: (r) => r.w.current + ' kg', sort: (r) => r.w.current },
            { key: 'above', label: 'Above limit', num: true, render: (r) => html`<span className=${r.w.above > r.w.limit * 0.04 ? 'warn' : ''}>${r.w.above > 0 ? '+' : ''}${r.w.above} kg</span>`, sort: (r) => r.w.above },
            { key: 'chg', label: '14-day change', num: true, render: (r) => html`<span className=${r.w.cutPct > 3 ? 'bad' : r.w.cutPct > 2 ? 'warn' : ''} style=${{ fontWeight: 600 }}>${r.w.cutPct > 0 ? '−' : '+'}${Math.abs(r.w.cutPct)}%</span>`, sort: (r) => r.w.cutPct },
            { key: 'trend', label: 'Trend', sort: false, hideSm: true, render: (r) => html`<${UI.Sparkline} data=${r.w.series} width=${90} height=${22} tone=${r.w.tone} />` },
            { key: 'st', label: 'Status', render: (r) => html`<${UI.Pill} tone=${r.w.tone}>${r.w.status}<//>`, sort: (r) => r.w.cutPct },
          ]} />
      <//>`}
      <${UI.Card} title="Body composition" icon="pulse" actions=${html`<${UI.Seg} size="sm" value=${mode} onChange=${setMode} options=${[{ id: 'athlete', label: 'Athlete' }, { id: 'squad', label: 'Squads' }]} />${mode === 'athlete' && html`<${AthletePicker} list=${list} value=${a ? a.id : ''} onChange=${setSel} />`}`}>
        ${mode === 'squad' ? html`<div className="col" style=${{ gap: 10 }}>
          <span className="small muted">Average body fat by squad, latest measurement vs six months ago.</span>
          <${UI.BarChart} height=${230} data=${sqRows.map((q) => ({ label: q.label.replace(/ \(.*\)/, ''), values: [q.then, q.now] }))} keys=${[{ name: 'May 2026', tone: 'cat-3' }, { name: 'Oct 2026', tone: 'accent' }]} yFormat=${(x) => x + '%'} />
        </div>` : a && series.length ? html`<div className="col" style=${{ gap: 14 }}>
          <${UI.DL} cols=${4} items=${[['Latest', D.fmt(series[5].date) + ' · ' + series[5].method], ['Weight', series[5].kg + ' kg (' + (series[5].kg >= series[0].kg ? '+' : '') + r1(series[5].kg - series[0].kg) + ')'], ['Body fat', series[5].bf + '% (' + (series[5].bf >= series[0].bf ? '+' : '') + r1(series[5].bf - series[0].bf) + ')'], ['Lean mass', series[5].lean + ' kg (' + (series[5].lean >= series[0].lean ? '+' : '') + r1(series[5].lean - series[0].lean) + ')']]} />
          <div className="grid g2">
            <div className="col tight"><span className="tiny faint upper">Weight and lean mass (kg)</span><${UI.LineChart} height=${190} series=${[{ name: 'Weight', data: series.map((m) => ({ x: D.fmt(m.date), y: m.kg })), tone: 'accent' }, { name: 'Lean mass', data: series.map((m) => ({ x: D.fmt(m.date), y: m.lean })), tone: 'cat-2' }]} /></div>
            <div className="col tight"><span className="tiny faint upper">Body fat (%)</span><${UI.LineChart} height=${190} series=${[{ name: 'Body fat', data: series.map((m) => ({ x: D.fmt(m.date), y: m.bf })), tone: 'cat-4', area: true }]} /></div>
          </div>
          ${cut && html`<div className="col tight"><div className="row between"><span className="tiny faint upper">Morning weigh-ins, last 14 days</span><${UI.Pill} tone=${cut.tone}>${cut.status} · ${cut.cutPct > 0 ? '−' : '+'}${Math.abs(cut.cutPct)}%<//></div>
            <${UI.LineChart} height=${190} series=${[{ name: 'Weight', data: cut.series.map((y, i) => ({ x: D.fmt(D.add(AMS.TODAY, i - 13)), y })), tone: cut.tone }]} refs=${[{ y: cut.limit, label: cut.limit + ' kg limit', tone: 'bad' }]} />
            ${cut.cutPct > 3 && html`<div className="ai-box row between wrap" style=${{ gap: 10 }}><span className="small"><b>${first(a)} lost ${cut.cutPct}% in 14 days</b>${D.ageOn(a.dob) < 18 ? ' as an under-18 athlete' : ''}. Safe weight-making is at most 0.5 kg a week, with no fluid restriction or sweat suits.</span>${(nut().reviews || {})[a.id] ? html`<${UI.Pill} tone="info">Review opened ${D.rel(nut().reviews[a.id].date)}<//>` : html`<button className="btn sm ai" onClick=${() => AMS.runAction('nutrition.weightCutReview', { athleteId: a.id })}><${UI.Icon} name="medical" size=${13} />Review with doctor</button>`}</div>`}
          </div>`}
        </div>` : html`<${UI.Empty} icon="pulse" title="No measurements in this scope" />`}
      <//>
    </div>`;
  }

  /* ================================================================== page */
  const TABS = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' }, { id: 'plans', label: 'Diet plans', icon: 'book' }, { id: 'hydration', label: 'Hydration', icon: 'droplet' },
    { id: 'supplements', label: 'Supplements', icon: 'pill' }, { id: 'compliance', label: 'Compliance', icon: 'check' }, { id: 'body', label: 'Body composition', icon: 'scale' },
  ];
  function Page({ params }) {
    const { db, v } = AMS.useStore();
    const p = params || {};
    const [tab, setTabState] = UI.useLocal('nu-tab', 'overview');
    const [sub, setSub] = useState({});
    const [sel, setSel] = useState(p.athleteId || null);
    useEffect(() => { if (p.tab) setTabState(p.tab); }, [p.tab]);
    useEffect(() => { if (p.athleteId) setSel(p.athleteId); }, [p.athleteId]);
    const list = AMS.scopedAthletes();
    const cur = TABS.some((t) => t.id === (p.tab || tab)) ? (p.tab && !sub.touched ? p.tab : tab) : 'overview';
    const setTab = (t, extra) => { setTabState(t); setSub(Object.assign({ touched: true }, extra || {})); };
    const selId = sel && list.some((a) => a.id === sel) ? sel : (list.find((a) => a.id === db.meta.heroAthleteId) || list[0] || {}).id;
    if (selId) AMS.setFocus({ athleteId: selId });
    const reqs = (db.nutrition && db.nutrition.requests || []).filter((r) => list.some((a) => a.id === r.athleteId));
    const pendingSupp = reqs.filter((r) => r.status === 'Requested' || r.status === 'Doctor sign-off').length;
    const drafts = list.filter((a) => { const pl = planOf(a); return pl && (pl.draft || pl.status === 'Draft'); }).length;
    const prm = Object.assign({}, p, sub.squadId ? { squadId: sub.squadId } : {});
    if (!db.nutrition) return html`<div className="page"><${UI.PageHead} title="Nutrition" /><${UI.Empty} icon="apple" title="Nutrition data is loading" /></div>`;
    const role = AMS.ui.role;
    return html`<div className="page">
      <${UI.PageHead} title="Nutrition" sub=${'Diet plans, hydration, supplements, compliance and body composition · ' + list.length + ' athletes in scope'}
        actions=${html`${role !== 'nutritionist' && html`<span className="tiny faint row tight"><${UI.Icon} name="eye" size=${13} />View only · ${AMS.roleLabel(role)}</span>`}<${UI.AskCopilot} prompt="Who has nutrition flags today?" label="Ask Copilot" />`} />
      <${UI.Tabs} value=${cur} onChange=${(t) => setTab(t)} tabs=${TABS.map((t) => Object.assign({}, t, t.id === 'supplements' ? { count: pendingSupp || null } : t.id === 'plans' ? { count: drafts || null } : {}))} />
      ${cur === 'overview' && html`<${Overview} list=${list} setTab=${setTab} v=${v} />`}
      ${cur === 'plans' && html`<${Plans} list=${list} sel=${selId} setSel=${setSel} />`}
      ${cur === 'hydration' && html`<${Hydration} key=${'h' + (prm.squadId || '')} list=${list} params=${prm} v=${v} />`}
      ${cur === 'supplements' && html`<${Supplements} list=${list} />`}
      ${cur === 'compliance' && html`<${Compliance} key=${'c' + (prm.squadId || '')} list=${list} params=${prm} />`}
      ${cur === 'body' && html`<${Body} list=${list} sel=${selId} setSel=${setSel} />`}
    </div>`;
  }

  /* ================================================================== athlete profile tab */
  function AthleteNutrition({ athlete }) {
    AMS.useStore();
    const a = athlete;
    const p = planOf(a), hyd = hydOf(a), c7 = comp7(a), body = bodyOf(a), cut = cutOf(a);
    const ml = AMS.sum(waterToday(a).map((e) => e.ml)), t = targetMl(a);
    const reqs = requestsOf(a.id);
    const tg = p ? targetsFor(a, p, dayTypeFor(a)) : null;
    return html`<div className="col">
      <div className="grid g3">
        <${UI.KPI} label=${'Plan · ' + dayTypeFor(a).toLowerCase()} value=${tg ? tg.kcal.toLocaleString('en-IN') : '—'} unit=${tg ? 'kcal' : ''} foot=${p ? p.phase + ' · ' + p.status : 'No plan yet'} onClick=${() => AMS.go(MOD, { tab: 'plans', athleteId: a.id })} />
        <${UI.KPI} label="Water today" value=${fmtL(ml).replace(' L', '')} unit=${'/ ' + fmtL(t)} foot=${hyd ? '7-day ' + Math.round(hydRatio7(a) * 100) + '% of target' : ''} spark=${hyd ? hyd.L : null} sparkTone="info" />
        <${UI.KPI} label="Meal logging" value=${c7 == null ? '—' : c7} unit="%" foot="Last 7 days" tone=${pctTone(c7)} spark=${compOf(a)} sparkTone=${pctTone(c7) || 'accent'} />
      </div>
      ${tg && html`<${UI.Card} title="Targets" icon="book" hint=${p.preference + ((p.allergies || []).length ? ' · ' + p.allergies.join(', ') + '-free' : '')}>
        <${UI.DL} cols=${4} items=${[['Protein', tg.protein + ' g (' + tg.perKg.protein + ' g/kg)'], ['Carbs', tg.carbs + ' g (' + tg.perKg.carbs + ' g/kg)'], ['Fat', tg.fat + ' g'], ['Updated', D.fmt(p.updated) + ' · ' + p.by]]} />
        ${p.draft && html`<div className="tiny ai-c" style=${{ marginTop: 8 }}>AI draft waiting for approval: ${p.draft.why.map((w) => w.label).join(', ')}</div>`}
      <//>`}
      ${cut && html`<${UI.Card} title="Weight class" icon="scale" hint=${cut.limit + ' kg'}>
        <div className="row between wrap"><span className="small">${cut.current} kg today · ${cut.above > 0 ? '+' : ''}${cut.above} kg vs limit · ${cut.cutPct > 0 ? '−' : '+'}${Math.abs(cut.cutPct)}% in 14 days</span><${UI.Pill} tone=${cut.tone}>${cut.status}<//></div>
        <${UI.Sparkline} data=${cut.series} width=${260} height=${36} tone=${cut.tone} />
      <//>`}
      ${body.length > 0 && html`<${UI.Card} title="Body composition" icon="pulse" hint=${body[5].method}>
        <${UI.DL} cols=${3} items=${[['Weight', body[5].kg + ' kg'], ['Body fat', body[5].bf + '%'], ['Lean mass', body[5].lean + ' kg']]} />
        <div style=${{ marginTop: 8 }}><${UI.LineChart} height=${140} series=${[{ name: 'Body fat %', data: body.map((m) => ({ x: D.fmt(m.date), y: m.bf })), tone: 'cat-4' }]} /></div>
      <//>`}
      <${UI.Card} title="Supplements" icon="pill" flush>
        ${reqs.length ? html`<div className="list">${reqs.map((r) => html`<div key=${r.id} className="list-item"><span className="small grow">${r.product}</span><span className="tiny faint">${D.fmt(r.requested)}</span><${UI.Pill} tone=${suppTone(r.status)}>${r.status}<//></div>`)}</div>` : html`<${UI.Empty} icon="pill" title="No supplements on file" />`}
      <//>
    </div>`;
  }
  AMS.registerAthleteTab({ id: 'nutrition', label: 'Nutrition', order: 40, roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist', 'athlete'], component: AthleteNutrition });

  AMS.registerModule({
    id: 'nutrition', label: 'Nutrition', icon: 'apple', group: 'performance', order: 5, roles: ['director', 'coach', 'nutritionist', 'scientist', 'physio', 'doctor'], component: Page,
    badge: () => {
      if (!AMS.db || !AMS.db.nutrition) return null;
      const role = AMS.ui.role;
      if (role !== 'nutritionist' && role !== 'doctor') return null;
      const ids = new Set(AMS.scopedAthletes().map((a) => a.id));
      const n = AMS.db.nutrition.requests.filter((r) => ids.has(r.athleteId) && (role === 'doctor' ? r.status === 'Doctor sign-off' : r.status === 'Requested' || r.status === 'Blocked')).length;
      return n ? { n, tone: 'warn' } : null;
    },
    get sampleParams() {
      const cutter = AMS.db && AMS.db.athletes.find((a) => cutOf(a) && cutOf(a).cutPct > 3);
      return [{}, { tab: 'plans' }, { tab: 'hydration' }, { tab: 'supplements' }, { tab: 'compliance' }, { tab: 'body' }].concat(cutter ? [{ tab: 'body', athleteId: cutter.id }, { tab: 'plans', athleteId: cutter.id }] : []);
    },
  });
  AMS.registerCommand({ id: 'nutrition.supplements', label: 'Supplement requests', group: 'Nutrition', icon: 'pill', keywords: 'supplement anti-doping batch tested approve', roles: ['nutritionist', 'doctor', 'director'], run: () => AMS.go(MOD, { tab: 'supplements' }) });
  AMS.registerCommand({ id: 'nutrition.weight', label: 'Weight-cut tracking', group: 'Nutrition', icon: 'scale', keywords: 'weight cut making weight boxing wrestling category', run: () => AMS.go(MOD, { tab: 'body' }) });
  AMS.registerCommand({ id: 'nutrition.sweat', label: 'Log a sweat-rate test', group: 'Nutrition', icon: 'droplet', keywords: 'sweat rate hydration test', roles: ['nutritionist', 'scientist'], run: () => AMS.go(MOD, { tab: 'hydration' }) });

  /* ================================================================== self-tests */
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const T = (name, role, fn) => AMS.selfTests.push({ name: 'nutrition: ' + name, role, fn });
  const heroA = () => ath(AMS.db.meta.heroAthleteId);
  const cutter = () => AMS.db.athletes.find((a) => a.squadId === 'SQ-PUN-BOX17' && cutOf(a) && cutOf(a).cutPct > 3);

  T('logging water adds to today and the athlete app reads the same total', 'athlete', () => {
    const pr = heroA(); const h0 = AMS.nutrition.hydrationToday(pr.id).ml;
    AMS.runAction('nutrition.logHydration', { athleteId: pr.id, ml: 500 });
    assert(AMS.nutrition.hydrationToday(pr.id).ml === h0 + 500, 'hydration total did not move');
  });
  T('AI drafts more carbohydrate for Priya\'s load jump and the nutritionist publishes it', 'nutritionist', () => {
    const pr = heroA(); const before = planOf(pr).carbsTrain;
    AMS.runAction('nutrition.generatePlan', { athleteId: pr.id });
    const d = planOf(pr).draft; assert(d && d.carbsTrain > before, 'draft did not raise carbs (' + before + ' → ' + (d && d.carbsTrain) + ')');
    assert(d.why.some((w) => /Load/.test(w.label)), 'draft does not explain the load jump');
    assert(planOf(pr).carbsTrain === before, 'draft changed the live plan before approval');
    AMS.runAction('nutrition.approvePlan', { athleteId: pr.id });
    assert(planOf(pr).carbsTrain === d.carbsTrain && !planOf(pr).draft && planOf(pr).status === 'Published', 'approval did not publish the draft');
    assert(AMS.db.notifications.some((n) => n.toRole === 'athlete' && n.athleteId === pr.id && /plan/.test(n.title)), 'athlete not notified');
  });
  T('coaches cannot change plans', 'coach', () => {
    const pr = heroA(); const r = AMS.runAction('nutrition.generatePlan', { athleteId: pr.id });
    assert(r == null && !planOf(pr).draft, 'coach was allowed to draft a plan');
  });
  T('supplement request → nutritionist → doctor sign-off → approved; untested products are blocked', 'athlete', () => {
    const pr = heroA();
    AMS.runAction('nutrition.requestSupplement', { athleteId: pr.id, productId: 'SUP-CRE', reason: 'Speed block' });
    const r = requestsOf(pr.id).find((x) => x.productId === 'SUP-CRE'); assert(r && r.status === 'Requested', 'request not created');
    AMS.ui.role = 'doctor'; assert(AMS.runAction('nutrition.reviewSupplement', { requestId: r.id, decision: 'approve' }) == null, 'doctor skipped the nutritionist');
    AMS.ui.role = 'nutritionist'; AMS.runAction('nutrition.reviewSupplement', { requestId: r.id, decision: 'approve' });
    assert(requestsOf(pr.id).find((x) => x.id === r.id).status === 'Doctor sign-off', 'not sent to doctor');
    AMS.ui.role = 'doctor'; AMS.runAction('nutrition.reviewSupplement', { requestId: r.id, decision: 'approve' });
    assert(requestsOf(pr.id).find((x) => x.id === r.id).status === 'Approved', 'doctor sign-off did not approve');
    AMS.ui.role = 'athlete';
    AMS.runAction('nutrition.requestSupplement', { athleteId: pr.id, productId: 'SUP-MASS' });
    assert(requestsOf(pr.id).find((x) => x.productId === 'SUP-MASS').status === 'Blocked', 'untested product was not blocked');
  });
  T('weight-cut detector flags the Pune U-17 boxer and the review alerts the doctor', 'nutritionist', () => {
    const b = cutter(); assert(b, 'no Pune boxer cutting weight in the seed');
    const ins = AMS.ai.insights({ module: 'nutrition' }).find((i) => i.id.startsWith('wcut:' + b.id));
    assert(ins && ins.severity === 'high', 'weight cut not flagged as high');
    AMS.runAction('nutrition.weightCutReview', { athleteId: b.id });
    assert(AMS.db.tasks.some((t) => t.ownerRole === 'doctor' && t.athleteId === b.id && /Weight-cut/.test(t.title)), 'doctor task missing');
    assert(AMS.db.notifications.some((n) => n.toRole === 'doctor' && n.athleteId === b.id), 'doctor not notified');
  });
  T('sweat-rate test updates the athlete\'s hydration target', 'nutritionist', () => {
    const pr = heroA(); const t0 = targetMl(pr);
    const res = AMS.runAction('nutrition.sweatTest', { athleteId: pr.id, pre: 52.6, post: 51.4, fluidMl: 700, urineMl: 0, minutes: 75 });
    assert(res && sweatRateOf(pr) === 1.5, 'sweat rate not stored (' + sweatRateOf(pr) + ')');
    assert(targetMl(pr) !== t0, 'target did not change');
  });
  T('director sees Sonipat wrestling low hydration; Operations sees no nutrition flags', 'director', () => {
    assert(AMS.ai.insights({ module: 'nutrition' }).some((i) => i.id.startsWith('hyd:SQ-SNP-WR20')), 'Sonipat wrestling hydration not flagged');
    AMS.ui.role = 'ops';
    assert(!AMS.ai.insights().some((i) => i.module === 'nutrition'), 'ops can see nutrition insights');
    AMS.ui.role = 'director';
  });
})();
