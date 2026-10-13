/* USI · AMS — Sports Science module.
   Readiness monitoring, fatigue analytics (ACWR × readiness quadrant), wearable integrations (Catapult / Polar / WHOOP / Garmin),
   GPS analytics, recovery tracking (HRV / RHR / sleep + interventions) and an explainable AI risk model with anomaly detection.
   Owns db.wearables (seeded below). Every state change goes through registered actions → AMS.mutate → activity + bell + copilot. */
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useMemo, useEffect, useRef } = React;
  const D = AMS.date, C = AMS.calc;
  const MOD = 'science';

  /* ================================================================== constants */
  const CAT_CENTRES = ['PUN', 'BLR', 'PAT', 'BBS'];     // centres on the federation Catapult licence
  const WHOOP_CENTRES = ['PUN', 'SNP', 'GUW', 'BLR'];   // WHOOP Unite team licence
  const GARMIN_CENTRES = ['PAT'];                         // Garmin Health API (national camp)
  const POLAR_CENTRES = ['PUN', 'MUM', 'BLR', 'BPL'];    // Polar Team Pro
  const VENDOR_MODEL = { Catapult: 'Catapult Vector', WHOOP: 'WHOOP 4.0', Polar: 'Polar H10', Garmin: 'Garmin Forerunner 965' };
  const SCI_ROLES = ['director', 'coach', 'scientist', 'physio', 'doctor', 'nutritionist'];
  const INTERVENTIONS = [
    { id: 'Ice bath', icon: 'droplet', dur: 10, note: '10–12 °C, 10 min. Not within 6 h after strength work.' },
    { id: 'Contrast bath', icon: 'droplet', dur: 15, note: '3 rounds hot 3 min / cold 1 min.' },
    { id: 'Massage', icon: 'heart', dur: 30, note: 'Soft-tissue flush, lower limb focus.' },
    { id: 'Compression', icon: 'layers', dur: 60, note: 'Pneumatic boots, 60 min post-session.' },
    { id: 'Nap', icon: 'moon', dur: 20, note: '20-min nap 13:30–14:00, hostel quiet room.' },
    { id: 'Pool recovery', icon: 'droplet', dur: 20, note: 'Deep-water walking and mobility.' },
    { id: 'Sleep hygiene', icon: 'bed', dur: 0, note: 'Screens off 21:30, lights out 22:00, room 24 °C.' },
  ];
  const FACTORS = [
    { key: 'acwr', label: 'Load jump (ACWR)', tone: 'cat-1' },
    { key: 'well', label: 'Wellness vs own normal', tone: 'cat-2' },
    { key: 'hrv', label: 'HRV vs own baseline', tone: 'cat-4' },
    { key: 'speed', label: 'Top-speed drop', tone: 'cat-3' },
    { key: 'sleep', label: 'Sleep debt', tone: 'cat-5' },
    { key: 'mono', label: 'Monotony', tone: 'cat-6' },
    { key: 'hist', label: 'Injury history', tone: 'warn' },
    { key: 'rtp', label: 'Recent return to play', tone: 'info' },
  ];
  const MODEL = {
    name: 'USI Load-Response Risk Model', version: '2.3', owner: 'Federation Sports Science Unit',
    trained: '1,284 athlete-seasons (2019–2025), 412 time-loss injuries, 9 centres', validated: '30 Aug 2026 · held-out 2025 season',
    auc: 0.71, calibration: 'Brier 0.081', horizon: 'Time-loss soft-tissue injury in the next 7 days',
  };

  /* ================================================================== small utils */
  const fmtN = (v, d) => (v == null || isNaN(v) ? '—' : AMS.round(v, d || 0).toLocaleString('en-IN'));
  const minutesOf = (t) => { const p = String(t || '00:00').split(':').map(Number); return p[0] * 60 + (p[1] || 0); };
  const nowStamp = () => AMS.TODAY + 'T' + AMS.clockTime();
  function hoursSince(ts) {
    if (!ts) return 999;
    return (D.diff(AMS.TODAY, ts.slice(0, 10)) * 1440 + minutesOf(AMS.clockTime()) - minutesOf(ts.slice(11, 16))) / 60;
  }
  function syncLabel(ts) {
    const h = hoursSince(ts);
    if (h < 1) return Math.max(1, Math.round(h * 60)) + ' min ago';
    if (h < 24) return Math.round(h) + ' h ago';
    return Math.round(h / 24) + ' d ago';
  }
  const sd = (arr) => { const a = arr.filter((x) => x != null); if (a.length < 2) return 0; const m = AMS.mean(a); return Math.sqrt(AMS.mean(a.map((x) => (x - m) ** 2))); };
  const first = (a) => (a && a.name ? a.name.split(' ')[0] : '');
  const W = () => (AMS.db && AMS.db.wearables) || null;
  const me = () => AMS.me() || { name: 'System' };
  const canSci = () => AMS.canEdit('readiness');                               // sports scientist
  const canRecovery = () => AMS.canEdit('readiness') || AMS.ui.role === 'physio'; // scientist + physio log recovery work
  const canTrain = () => AMS.canEdit('training');                               // coach adjusts sessions
  const LOCK_SCI = 'Only sports science staff can change wearable pairings and integrations.';

  /* ================================================================== seed: db.wearables */
  AMS.registerSeed('wearables', function (db, rng) {
    const T = AMS.TODAY;
    const r1 = (v) => Math.round(v * 10) / 10;
    const clamp = AMS.clamp;
    const act = db.athletes.filter((a) => a.enrollment === 'Active');
    const hero = db.athletes.find((a) => a.id === db.meta.heroAthleteId);
    const openInj = new Set(db.injuries.filter((i) => i.status !== 'Closed' && i.availability !== 'Available').map((i) => i.athleteId));
    const sessMap = {};
    db.sessions.forEach((s) => { sessMap[s.squadId + '|' + s.date] = s; });
    const w = { connectors: [], devices: [], gps: {}, bio: {}, pmax: {}, interventions: [], dataQuality: [], garminBacklog: {}, whoopPending: {}, model: { threshold: 55, history: [] }, reviewed: {} };

    // athletes whose data is sitting on unmatched devices (unit swaps that were never re-paired)
    const punCat = act.filter((a) => a.centreId === 'PUN' && a.devices.includes('Catapult Vector') && a.id !== hero.id && !openInj.has(a.id));
    const orphanCat = punCat[punCat.length - 1];
    const punWhoop = act.filter((a) => a.centreId === 'PUN' && a.devices.includes('WHOOP 4.0') && a.id !== hero.id && a !== orphanCat && !openInj.has(a.id));
    const orphanWhoop = punWhoop[punWhoop.length - 1];
    const blrCat = act.filter((a) => a.centreId === 'BLR' && a.devices.includes('Catapult Vector') && !(a.tempAssignment && a.tempAssignment.active));
    const orphanBlr = blrCat[blrCat.length - 1];
    const wrestler = act.filter((a) => a.squadId === 'SQ-SNP-WR20' && a.availability === 'Available' && a.devices.includes('WHOOP 4.0'))[0];
    const hockeyDrop = act.filter((a) => a.squadId === 'SQ-BBS-HOCSR' && a.availability === 'Available' && a.devices.includes('Catapult Vector'))[1];

    /* ---------- GPS (Catapult) */
    const PROFILE = { Speed: [2700, 0.17, 0.42, 0.95, 1.25], Endurance: [4300, 0.24, 0.22, 0.9, 0.55], Power: [2300, 0.09, 0.3, 0.88, 1.1], Technical: [2400, 0.07, 0.25, 0.86, 0.9], Tactical: [7400, 0.12, 0.2, 0.9, 0.6], Competition: [1900, 0.22, 0.5, 0.97, 0.9] };
    const DIST_MULT = { Sprints: 1, Jumps: 0.85, Throws: 0.6, 'Middle distance': 2.4, Hockey: 1 };
    const PMAX = { Sprints: [34.6, 30.9], Jumps: [33.2, 30.1], Throws: [28.4, 25.8], 'Middle distance': [30.5, 27.6], Hockey: [30.8, 28.6] };
    function genGps(a, fromIdx) {
      const out = [];
      const pm = w.pmax[a.id];
      const sqId = a.tempAssignment && a.tempAssignment.active ? a.tempAssignment.squadId : a.squadId;
      const nz = a.loads.slice(13, 41).filter((x) => x > 0);
      const meanLoad = AMS.mean(nz) || 400;
      const rehab = openInj.has(a.id);
      for (let i = fromIdx || 27; i <= 40; i++) {
        const load = a.loads[i];
        if (!load) continue;
        const date = AMS.date.add(T, i - 41);
        const s = sessMap[sqId + '|' + date];
        const type = s ? s.type : 'Competition';
        const prof = PROFILE[type];
        if (!prof) continue; // gym / recovery sessions — vest not worn
        const rel = clamp(load / meanLoad, 0.6, 1.6);
        const mult = a.sport === 'Hockey' && type !== 'Tactical' ? 1.8 : (DIST_MULT[a.discipline] || 1);
        let dist = Math.round(prof[0] * mult * (0.8 + 0.25 * rel) * (1 + rng.norm(0, 0.06)));
        let vf = clamp(prof[3] + rng.norm(0, 0.012), 0.75, 0.995);
        if (rehab) { dist = Math.round(dist * 0.5); vf = Math.min(vf, 0.71 + rng() * 0.02); }
        const hsr = Math.round(dist * prof[1] * (0.9 + rng() * 0.2) * (rehab ? 0.4 : 1));
        const sprint = rehab ? 0 : Math.round(hsr * prof[2] * (0.85 + rng() * 0.3));
        const accels = Math.round((dist / 100) * prof[4] * (0.85 + rng() * 0.3));
        out.push({ date, totalDistance: dist, hsr, sprintDist: sprint, vmax: r1(pm * vf), accels, decels: Math.round(accels * (0.8 + rng() * 0.15)), playerLoad: Math.round(dist * 0.1 * (0.9 + rng() * 0.2)), durationMin: s ? s.duration : 45, type: s ? s.title : 'Competition / trial' });
      }
      return out;
    }
    const gpsAth = act.filter((a) => a.devices.includes('Catapult Vector') && CAT_CENTRES.includes(a.centreId));
    gpsAth.forEach((a) => {
      const pm = PMAX[a.discipline] || PMAX[a.sport] || PMAX.Sprints;
      w.pmax[a.id] = r1(clamp(rng.norm(a.gender === 'F' ? pm[1] : pm[0], 0.9), 22, 37));
    });
    w.pmax[hero.id] = 31.4;
    gpsAth.forEach((a) => {
      let g = genGps(a);
      if (a === orphanCat || a === orphanBlr) g = g.filter((x) => x.date < '2026-10-08');
      if (g.length) w.gps[a.id] = g;
    });
    // story: Priya — top speed falling over the last 3 sessions (fatigue after the state-meet trials)
    const pg = w.gps[hero.id] || [];
    if (pg.length >= 6) {
      const recent = pg.slice(-3), earlier = pg.slice(0, -3).slice().sort((a, b) => b.vmax - a.vmax);
      [31.0, 30.7, 30.5].forEach((v, k) => { if (earlier[k]) earlier[k].vmax = v; });
      [28.8, 29.0, 28.1].forEach((v, k) => { recent[k].vmax = v; });
      recent[1].type = 'State Open qualifying trial (100 m + 200 m)';
      recent[1].sprintDist = 300; recent[1].hsr = 520; recent[1].totalDistance = 2140;
    }
    // story: a Bhubaneswar hockey forward losing top-end speed
    if (hockeyDrop && w.gps[hockeyDrop.id] && w.gps[hockeyDrop.id].length >= 6) {
      const g = w.gps[hockeyDrop.id]; const earlier = g.slice(0, -3).map((x) => x.vmax).sort((a, b) => b - a).slice(0, 3);
      const bp = AMS.mean(earlier); g.slice(-3).forEach((x, k) => { x.vmax = r1(bp * (0.925 + k * 0.004)); });
    }
    // guard: nobody else shows a false speed drop
    Object.keys(w.gps).forEach((id) => {
      if (id === hero.id || (hockeyDrop && id === hockeyDrop.id)) return;
      const g = w.gps[id]; if (g.length < 6) return;
      const bp = AMS.mean(g.slice(0, -3).map((x) => x.vmax).sort((a, b) => b - a).slice(0, 3));
      const recent = g.slice(-3); const peak = Math.max(...recent.map((x) => x.vmax));
      if (!openInj.has(id) && peak < bp * 0.955) { const best = recent.reduce((m, x) => (x.vmax > m.vmax ? x : m), recent[0]); best.vmax = r1(bp * (0.975 + rng() * 0.02)); }
    });

    /* ---------- HRV / RHR / sleep / recovery (WHOOP + Garmin) — index 27 = this morning */
    function genBio(a) {
      const base = clamp(rng.norm(a.gender === 'F' ? 76 : 70, 12), 44, 112), s = base * 0.075;
      const rhr0 = clamp(rng.norm(a.gender === 'F' ? 56 : 52, 4.5), 42, 66);
      const b = { src: 'WHOOP', hrv: [], rhr: [], sleep: [], rec: [] };
      for (let k = 0; k < 28; k++) {
        const li = k + 14;
        const fat = a.loads[li - 1] ? (a.loads[li - 1] - 520) / 900 : -0.2;
        const hrv = Math.round(base * (1 - 0.05 * fat) + rng.norm(0, s));
        const rhr = Math.round(rhr0 + 1.5 * fat + rng.norm(0, 1.6));
        const wl = a.wellness[k];
        const sl = wl && wl.sleepHrs ? wl.sleepHrs : r1(clamp(rng.norm(7.4, 0.6), 5, 9.5));
        b.hrv.push(hrv); b.rhr.push(rhr); b.sleep.push(sl);
        b.rec.push(Math.round(clamp(62 + ((hrv - base) / base) * 160 + (sl - 7.3) * 6 - (rhr - rhr0) * 2 + rng.norm(0, 5), 5, 99)));
      }
      // keep everyone except story athletes inside their own normal for the last 3 mornings
      const m = AMS.mean(b.hrv.slice(0, 24)), sdv = sd(b.hrv.slice(0, 24)) || s;
      for (let k = 25; k < 28; k++) if (b.hrv[k] < m - 1.4 * sdv) b.hrv[k] = Math.round(m - sdv * (0.3 + rng() * 0.8));
      return b;
    }
    const bioAth = act.filter((a) => (a.devices.includes('WHOOP 4.0') && WHOOP_CENTRES.includes(a.centreId)) || a.squadId === 'SQ-PAT-CAMP');
    bioAth.forEach((a) => { const b = genBio(a); if (a.squadId === 'SQ-PAT-CAMP') b.src = 'Garmin'; w.bio[a.id] = b; });
    const pb = w.bio[hero.id];
    if (pb) {
      for (let k = 0; k < 25; k++) pb.hrv[k] = Math.round(78 + (pb.hrv[k] - AMS.mean(pb.hrv.slice(0, 25))) * 0.7);
      [[64, 55, 6.4, 41], [58, 58, 5.6, 29], [51, 61, 5.4, 18]].forEach(([h, r, sl, rc], k) => { pb.hrv[25 + k] = h; pb.rhr[25 + k] = r; pb.sleep[25 + k] = sl; pb.rec[25 + k] = rc; });
      for (let k = 0; k < 25; k++) pb.rhr[k] = Math.round(53 + (pb.rhr[k] - AMS.mean(pb.rhr.slice(0, 25))) * 0.6);
    }
    if (wrestler && w.bio[wrestler.id]) {
      const b = w.bio[wrestler.id]; const m = AMS.mean(b.hrv.slice(0, 24)); const r0 = AMS.mean(b.rhr.slice(0, 24));
      [0.8, 0.73, 0.67].forEach((f, k) => { b.hrv[25 + k] = Math.round(m * f); b.rhr[25 + k] = Math.round(r0 + 5 + k * 2); b.sleep[25 + k] = [6.1, 5.7, 5.5][k]; b.rec[25 + k] = [38, 27, 21][k]; });
    }
    // Garmin (Patiala camp): last 3 nights not imported — OAuth token expired on 10 Oct
    act.filter((a) => a.squadId === 'SQ-PAT-CAMP').forEach((a) => {
      const b = w.bio[a.id]; if (!b) return;
      w.garminBacklog[a.id] = { hrv: b.hrv.slice(25), rhr: b.rhr.slice(25), sleep: b.sleep.slice(25), rec: b.rec.slice(25) };
      for (let k = 25; k < 28; k++) { b.hrv[k] = null; b.rhr[k] = null; b.sleep[k] = null; b.rec[k] = null; }
    });
    // WHOOP straps that have not synced this morning
    const unsynced = punWhoop.filter((a) => a !== orphanWhoop && w.bio[a.id]).slice(0, 3);
    unsynced.forEach((a) => {
      const b = w.bio[a.id];
      w.whoopPending[a.id] = { hrv: b.hrv[27], rhr: b.rhr[27], sleep: b.sleep[27], rec: b.rec[27] };
      b.hrv[27] = null; b.rhr[27] = null; b.sleep[27] = null; b.rec[27] = null;
    });

    /* ---------- devices */
    let n = 0;
    gpsAth.forEach((a) => {
      if (a === orphanCat || a === orphanBlr) {
        w.devices.push({ serial: 'CAT-V7-' + (40210 + n++), vendor: 'Catapult', model: 'Vector S7', athleteId: a.id, centreId: a.centreId, battery: 0, lastSync: '2026-10-07T09:40', status: 'Retired', retiredOn: '2026-10-08', note: 'Battery fault — unit returned to Catapult' });
        return;
      }
      const g = w.gps[a.id] || [];
      w.devices.push({ serial: 'CAT-V7-' + (40210 + n++), vendor: 'Catapult', model: 'Vector S7', athleteId: a.id, centreId: a.centreId, battery: rng.chance(0.08) ? rng.int(8, 19) : rng.int(42, 100), lastSync: (g.length ? g[g.length - 1].date : '2026-10-10') + 'T' + (rng.chance(0.5) ? '09:' : '10:') + String(rng.int(10, 55)), status: 'Active' });
    });
    n = 0;
    bioAth.forEach((a) => {
      if (a.squadId === 'SQ-PAT-CAMP') { w.devices.push({ serial: 'GRM-965-' + (31120 + n++), vendor: 'Garmin', model: 'Forerunner 965', athleteId: a.id, centreId: 'PAT', battery: rng.int(30, 90), lastSync: '2026-10-10T06:20', status: 'Active' }); return; }
      w.devices.push({ serial: 'WHP-4A-' + (77010 + n++), vendor: 'WHOOP', model: '4.0', athleteId: a.id, centreId: a.centreId, battery: rng.chance(0.06) ? rng.int(5, 15) : rng.int(35, 100), lastSync: w.whoopPending[a.id] ? '2026-10-12T05:48' : T + 'T06:' + String(rng.int(10, 58)), status: 'Active' });
    });
    if (orphanWhoop && w.bio[orphanWhoop.id]) {
      const b = w.bio[orphanWhoop.id]; delete w.bio[orphanWhoop.id];
      w.devices = w.devices.filter((d) => d.athleteId !== orphanWhoop.id || d.vendor !== 'WHOOP');
      w.devices.push({ serial: 'WHP-4A-77391', vendor: 'WHOOP', model: '4.0', athleteId: null, centreId: 'PUN', battery: 71, lastSync: T + 'T06:12', firstSeen: '2026-09-15', status: 'Unmatched', orphan: { bio: b }, note: 'Strap registered under hostel shared account' });
    }
    n = 0;
    act.filter((a) => a.centreId === 'PUN' && a.devices.includes('Polar H10')).forEach((a) => {
      w.devices.push({ serial: 'POL-H10-' + (5520 + n++), vendor: 'Polar', model: 'H10', athleteId: a.id, centreId: 'PUN', battery: rng.int(20, 100), lastSync: '2026-10-12T19:0' + rng.int(1, 9), status: 'Active' });
    });
    if (orphanCat) {
      const og = genGps(orphanCat, 35);
      w.devices.push({ serial: 'CAT-V7-40388', vendor: 'Catapult', model: 'Vector S7', athleteId: null, centreId: 'PUN', battery: 64, lastSync: '2026-10-12T09:20', firstSeen: '2026-10-08', status: 'Unmatched', orphan: { gps: og }, note: 'Replacement unit issued from Pune store' });
    }
    if (orphanBlr) {
      const og = genGps(orphanBlr, 35);
      w.devices.push({ serial: 'CAT-V7-40391', vendor: 'Catapult', model: 'Vector S7', athleteId: null, centreId: 'BLR', battery: 88, lastSync: '2026-10-12T08:55', firstSeen: '2026-10-09', status: 'Unmatched', orphan: { gps: og }, note: 'Replacement unit — Bengaluru store' });
    }

    /* ---------- connectors */
    const cnt = (vendor) => { const ds = w.devices.filter((d) => d.vendor === vendor && d.status !== 'Retired'); return { devicesActive: ds.length, athletesMapped: ds.filter((d) => d.athleteId).length }; };
    const hist = (base, hrs, ok) => Array.from({ length: 7 }, (_, k) => ({ at: AMS.date.add(T, -k) + 'T' + hrs, records: Math.max(0, Math.round(base * (0.8 + rng() * 0.4))), ok: ok ? ok(k) : true }));
    w.connectors = [
      Object.assign({ id: 'CON-CAT', vendor: 'Catapult', product: 'OpenField Cloud API', type: 'GPS', status: 'Connected', lastSync: T + 'T05:10', centres: CAT_CENTRES, cadence: 'Nightly 05:00 + on demand', auth: 'API key · rotates 31 Jan 2027', errors: 2, syncLog: hist(41, '05:10') }, cnt('Catapult')),
      Object.assign({ id: 'CON-POL', vendor: 'Polar', product: 'Polar Team Pro', type: 'HR', status: 'Connected', lastSync: '2026-10-12T19:05', centres: POLAR_CENTRES, cadence: 'After each session', auth: 'OAuth 2.0 · team account', errors: 1, syncLog: hist(28, '19:05') }, cnt('Polar')),
      Object.assign({ id: 'CON-WHP', vendor: 'WHOOP', product: 'WHOOP Unite (team)', type: 'HRV/sleep', status: 'Degraded', lastSync: T + 'T06:45', centres: WHOOP_CENTRES, cadence: 'Every 30 min, 05:00–09:00', auth: 'OAuth 2.0 · per-athlete consent', errors: 3, syncLog: hist(58, '06:45', (k) => k !== 0) }, cnt('WHOOP')),
      Object.assign({ id: 'CON-GRM', vendor: 'Garmin', product: 'Garmin Health API', type: 'HRV/sleep', status: 'Token expired', lastSync: '2026-10-10T06:20', centres: GARMIN_CENTRES, cadence: 'Push on device sync', auth: 'OAuth 1.0a · expired 10 Oct 22:14', errors: 1, syncLog: hist(6, '06:20', (k) => k > 2).map((s, k) => (k <= 2 ? Object.assign(s, { records: 0, note: '401 Unauthorized' }) : s)) }, cnt('Garmin')),
    ];

    /* ---------- data-quality issues */
    const punSpr = act.filter((a) => a.squadId === 'SQ-PUN-SPR20' && w.gps[a.id]).slice(2, 6).map((a) => a.id);
    w.dataQuality = [
      { id: 'DQ-301', connectorId: 'CON-CAT', severity: 'warn', title: 'Low satellite lock on Track 2', text: '12 Oct 07:30 session: 4 files with HDOP > 2.0. Distance and HSR may be under-reported by about 6%.', athleteIds: punSpr, centreId: 'PUN', status: 'Open', raised: '2026-10-12' },
      { id: 'DQ-302', connectorId: 'CON-CAT', severity: 'info', title: 'Session split across two files', text: 'U-20 Sprints 10 Oct: unit restarted mid-session; two files for the same athlete.', athleteIds: punSpr.slice(0, 1), centreId: 'PUN', status: 'Open', raised: '2026-10-10' },
      { id: 'DQ-303', connectorId: 'CON-WHP', severity: 'warn', title: 'Straps not synced this morning', text: 'No overnight HRV for ' + unsynced.length + ' athletes. Readiness falls back to the check-in only.', athleteIds: unsynced.map((a) => a.id), centreId: 'PUN', status: 'Open', raised: T, kind: 'whoop-unsynced' },
      { id: 'DQ-304', connectorId: 'CON-POL', severity: 'info', title: 'Heart-rate dropouts > 20%', text: 'Strap contact lost repeatedly during the 12 Oct tempo session (dry electrodes).', athleteIds: act.filter((a) => a.centreId === 'PUN' && a.devices.includes('Polar H10')).slice(0, 1).map((a) => a.id), centreId: 'PUN', status: 'Open', raised: '2026-10-12' },
      { id: 'DQ-305', connectorId: 'CON-GRM', severity: 'bad', title: 'Garmin authorisation expired', text: '3 nights of HRV and sleep missing for ' + Object.keys(w.garminBacklog).length + ' athletes at the national camp.', athleteIds: Object.keys(w.garminBacklog), centreId: 'PAT', status: 'Open', raised: '2026-10-11', kind: 'garmin-token' },
    ];

    /* ---------- recovery interventions (last 14 days + prescribed today) */
    let rid = 600;
    const punAth = act.filter((a) => a.centreId === 'PUN');
    const staffNames = ['Arjun Iyer', 'Neha Kulkarni'];
    for (let d = 13; d >= 1; d--) {
      const date = AMS.date.add(T, -d);
      if (AMS.date.dowIndex(date) === 0) continue;
      const k = rng.int(2, 4);
      for (let j = 0; j < k; j++) {
        const a = rng.pick(punAth); const iv = rng.pick(INTERVENTIONS);
        w.interventions.push({ id: 'RCV-' + rid++, athleteId: a.id, date, time: rng.pick(['10:30', '13:30', '17:45', '19:00']), type: iv.id, durationMin: iv.dur, status: rng.chance(0.8) ? 'Completed' : 'Missed', by: rng.pick(staffNames), note: '' });
      }
    }
    w.interventions.push({ id: 'RCV-' + rid++, athleteId: hero.id, date: '2026-10-11', time: '19:00', type: 'Ice bath', durationMin: 10, status: 'Completed', by: 'Arjun Iyer', note: 'After State Open qualifying trial' });
    w.interventions.push({ id: 'RCV-' + rid++, athleteId: hero.id, date: '2026-10-12', time: '13:30', type: 'Nap', durationMin: 20, status: 'Missed', by: 'Arjun Iyer', note: 'School test clashed' });
    const rohan = act.find((a) => a.name === 'Rohan Gaikwad');
    if (rohan) w.interventions.push({ id: 'RCV-' + rid++, athleteId: rohan.id, date: T, time: '16:00', type: 'Massage', durationMin: 30, status: 'Prescribed', by: 'Neha Kulkarni', note: 'Hamstring flush after stage-3 strides' });
    db.wearables = w;
  });

  /* ================================================================== pure analytics (exposed as AMS.sci) */
  function gpsOf(id) { const w = W(); return (w && w.gps[id]) || []; }
  function bioOf(id) { const w = W(); return (w && w.bio[id]) || null; }
  function pmaxOf(id) { const w = W(); return (w && w.pmax[id]) || null; }
  /** HRV vs own baseline (mornings 0–23 = own 3-week normal). */
  function hrvStats(id) {
    const b = bioOf(id); if (!b) return null;
    const base = b.hrv.slice(0, 24).filter((x) => x != null);
    if (base.length < 8) return null;
    const mean = AMS.mean(base), s = sd(base) || 1;
    let li = 27; while (li > 0 && b.hrv[li] == null) li--;
    const latest = b.hrv[li];
    const r3 = b.hrv.slice(25, 28).filter((x) => x != null);
    const rhrBase = AMS.mean(b.rhr.slice(0, 24).filter((x) => x != null));
    const rhrLatest = b.rhr[li];
    const sl3 = b.sleep.slice(25, 28).filter((x) => x != null);
    return {
      src: b.src, mean: AMS.round(mean, 1), sd: AMS.round(s, 1), latest, latestIdx: li, stale: li < 27, z: AMS.round((latest - mean) / s, 1),
      recent3: r3.length ? AMS.round(AMS.mean(r3), 1) : null, falling: r3.length === 3 && r3[0] > r3[1] && r3[1] > r3[2],
      rhrBase: AMS.round(rhrBase, 1), rhrLatest, rhrDelta: rhrLatest != null ? Math.round(rhrLatest - rhrBase) : null,
      sleep3: sl3.length ? AMS.round(AMS.mean(sl3), 1) : null, recovery: b.rec[li],
    };
  }
  /** Top-speed exposure vs own baseline: peak of the last 3 GPS sessions vs mean of the 3 best earlier sessions. */
  function speedStats(id) {
    const g = gpsOf(id); if (g.length < 5) return null;
    const pm = pmaxOf(id);
    const recent = g.slice(-3), earlier = g.slice(0, -3);
    const basePeak = AMS.mean(earlier.map((x) => x.vmax).sort((a, b) => b - a).slice(0, 3));
    const recentPeak = Math.max(...recent.map((x) => x.vmax));
    const wk = g.filter((x) => D.diff(AMS.TODAY, x.date) <= 7);
    const peak7 = wk.length ? Math.max(...wk.map((x) => x.vmax)) : null;
    return { basePeak: AMS.round(basePeak, 1), recentPeak, drop: AMS.round(((recentPeak - basePeak) / basePeak) * 100, 1), pmax: pm, pct7: pm && peak7 ? Math.round((peak7 / pm) * 100) : null, last: g[g.length - 1], recent };
  }
  /** Readiness for an earlier morning (wellness index wi, 27 = today) — same formula as core, load as of that morning. */
  function dayReadiness(a, wi) {
    if (wi === 27) { const r = C.readiness(a); return r.checkedIn ? r : Object.assign({}, r, { missing: true }); }
    const w = a.wellness[wi]; if (!w) return null;
    let s = C.wellnessScore(w);
    const r = C.acwr(a, wi + 13);
    if (r >= 1.5) s -= 15; else if (r > 1.3) s -= 7;
    s = AMS.clamp(Math.round(s), 0, 100);
    return { score: s, band: s >= 70 ? 'good' : s >= 50 ? 'warn' : 'bad', acwr: r };
  }
  function acuteChronic(a, days) {
    const L = a.loads || []; const out = [];
    for (let i = 41 - (days || 28); i <= 40; i++) out.push({ date: AMS.series.loadDate(i), load: L[i] || 0, acute: Math.round(AMS.mean(L.slice(i - 6, i + 1))), chronic: Math.round(AMS.mean(L.slice(Math.max(0, i - 27), i + 1))) });
    return out;
  }
  /** Explainable risk model: points per factor, compared to each athlete's own normal. */
  function riskModel(a) {
    const parts = [];
    const add = (key, pts, value, note) => { if (pts > 0.4) parts.push(Object.assign({ key, points: AMS.round(pts, 1), value, note }, FACTORS.find((f) => f.key === key))); };
    const r = C.acwr(a);
    add('acwr', r >= 1.5 ? 22 + Math.min(8, (r - 1.5) * 20) : r > 1.3 ? 12 : r < 0.8 ? 4 : 0, r.toFixed(2), r >= 1.5 ? 'load jump' : r > 1.3 ? 'rising' : 'under-loaded');
    const recent = C.wellnessAvg(a, 25, 28), base = C.wellnessBaseline(a);
    if (recent && base) { const dlt = recent - base; add('well', dlt < -5 ? Math.min(18, -dlt * 0.9) : 0, Math.round(dlt) + ' pts', '3-day avg vs own 3-wk normal'); }
    const h = hrvStats(a.id);
    if (h && h.z < -1) add('hrv', Math.min(18, (-h.z - 1) * 9 + 4), h.z.toFixed(1) + ' SD', h.latest + ' ms vs ' + Math.round(h.mean));
    const sp = speedStats(a.id);
    if (sp && a.availability === 'Available' && sp.drop < -3) add('speed', Math.min(12, (-sp.drop - 3) * 3 + 3), sp.drop + '%', sp.recentPeak + ' vs ' + sp.basePeak + ' km/h');
    const sl = (a.wellness || []).slice(25, 28).filter(Boolean).map((x) => x.sleepHrs);
    const slAvg = h && h.sleep3 ? h.sleep3 : sl.length ? AMS.mean(sl) : null;
    if (slAvg && slAvg < 7) add('sleep', Math.min(10, (7 - slAvg) * 6), AMS.round(slAvg, 1) + ' h', '3-night average');
    const mono = C.monotony(a); if (mono > 2) add('mono', Math.min(8, (mono - 2) * 10 + 3), mono.toFixed(1), 'last 7 days');
    const prior = AMS.db.injuries.filter((i) => i.athleteId === a.id && i.status === 'Closed' && D.diff(AMS.TODAY, i.dateOfInjury) < 365).length;
    if (prior) add('hist', Math.min(10, prior * 5), prior + ' in 12 mo', 'time-loss history');
    if (a.returnedOn && D.diff(AMS.TODAY, a.returnedOn) < 28) add('rtp', 10, D.rel(a.returnedOn), 'graded return window');
    parts.sort((x, y) => y.points - x.points);
    const score = AMS.clamp(Math.round(6 + AMS.sum(parts.map((p) => p.points))), 1, 99);
    const conf = AMS.round(0.55 + (h ? 0.12 : 0) + (sp ? 0.1 : 0) + ((a.wellness || []).slice(21, 28).filter(Boolean).length / 7) * 0.1, 2);
    return { score, band: score >= 60 ? 'bad' : score >= 35 ? 'warn' : 'good', parts, confidence: Math.min(0.92, conf) };
  }
  /** Anomaly detection — each athlete against their own baseline. */
  function anomalies(list) {
    const out = [];
    list.forEach((a) => {
      const h = hrvStats(a.id);
      if (h && !h.stale && h.z <= -2) out.push({ key: 'hrv:' + a.id + ':' + AMS.TODAY, athleteId: a.id, kind: 'hrv', severity: h.z <= -2.5 ? 'high' : 'med', title: 'HRV ' + Math.abs(h.z).toFixed(1) + ' SD below own baseline', detail: h.latest + ' ms this morning vs ' + Math.round(h.mean) + ' ± ' + Math.round(h.sd) + ' ms normal' + (h.falling ? ', falling 3 mornings running' : ''), value: h.z.toFixed(1) + ' SD' });
      if (h && !h.stale && h.rhrDelta != null && h.rhrDelta >= 7) out.push({ key: 'rhr:' + a.id + ':' + AMS.TODAY, athleteId: a.id, kind: 'rhr', severity: 'med', title: 'Resting HR +' + h.rhrDelta + ' bpm', detail: h.rhrLatest + ' bpm vs ' + Math.round(h.rhrBase) + ' bpm own normal', value: '+' + h.rhrDelta + ' bpm' });
      const sp = speedStats(a.id);
      if (sp && a.availability === 'Available' && sp.drop <= -5) out.push({ key: 'speed:' + a.id + ':' + AMS.TODAY, athleteId: a.id, kind: 'speed', severity: sp.drop <= -7 ? 'high' : 'med', title: 'Top speed ' + Math.abs(sp.drop) + '% below own baseline', detail: 'Peak of last 3 sessions ' + sp.recentPeak + ' km/h vs ' + sp.basePeak + ' km/h normal', value: sp.drop + '%' });
      const sl = h ? h.sleep3 : null;
      if (sl != null && sl < 6) out.push({ key: 'sleep:' + a.id + ':' + AMS.TODAY, athleteId: a.id, kind: 'sleep', severity: 'low', title: 'Sleep under 6 h for 3 nights', detail: 'Average ' + sl + ' h (target 8–9 h for under-18s)', value: sl + ' h' });
    });
    const rank = { high: 0, med: 1, low: 2 };
    return out.sort((x, y) => rank[x.severity] - rank[y.severity]);
  }
  /** Suggested owner for an unmatched device: athlete at the same centre who lists that vendor but has no active paired unit. */
  function suggestFor(dev) {
    const w = W(); if (!w) return null;
    const model = VENDOR_MODEL[dev.vendor];
    const cands = AMS.db.athletes.filter((a) => a.enrollment === 'Active' && a.centreId === dev.centreId && a.devices.includes(model) && !w.devices.some((d) => d.athleteId === a.id && d.vendor === dev.vendor && d.status !== 'Retired'));
    if (!cands.length) return null;
    const a = cands[0];
    const retired = w.devices.find((d) => d.athleteId === a.id && d.vendor === dev.vendor && d.status === 'Retired');
    const reasons = ['Lists a ' + model + ' in profile', 'No active ' + dev.vendor + ' unit paired'];
    if (retired) reasons.push('Previous unit ' + retired.serial + ' retired ' + D.fmt(retired.retiredOn));
    if (dev.firstSeen) reasons.push('Unit first seen ' + D.fmt(dev.firstSeen));
    return { athlete: a, reasons, confidence: cands.length === 1 ? (retired ? 0.94 : 0.81) : 0.55, others: cands.length - 1 };
  }
  function connectorStats(c) {
    const w = W();
    const ds = w.devices.filter((d) => d.vendor === c.vendor && d.status !== 'Retired');
    const issues = w.dataQuality.filter((q) => q.connectorId === c.id && q.status === 'Open');
    const okRate = c.syncLog.length ? Math.round((c.syncLog.filter((s) => s.ok).length / c.syncLog.length) * 100) : 0;
    return { devices: ds.length, mapped: ds.filter((d) => d.athleteId).length, unmatched: ds.filter((d) => !d.athleteId).length, issues: issues.length, okRate, hours: hoursSince(c.lastSync), stale: hoursSince(c.lastSync) > 24 };
  }
  function deviceVisible(d) {
    const s = AMS.effectiveScope();
    if (d.athleteId) { const a = AMS.org.athlete(d.athleteId); return !!a && AMS.inScope(a, s); }
    if (s.lock && s.lock.squadIds) return false;
    const c = AMS.org.centre(d.centreId);
    if (s.centreId && d.centreId !== s.centreId) return false;
    if (s.stateId && c && c.stateId !== s.stateId) return false;
    return true;
  }
  AMS.sci = { gpsOf, bioOf, pmaxOf, hrvStats, speedStats, dayReadiness, acuteChronic, riskModel, anomalies, suggestFor, connectorStats, MODEL };

  /* ================================================================== actions */
  AMS.registerAction('device.match', function (p) {
    const w = W(); const dev = w && w.devices.find((d) => d.serial === p.serial);
    const a = AMS.org.athlete(p.athleteId);
    if (!dev || !a) { AMS.toast('Device or athlete not found', 'bad'); return null; }
    let imported = 0;
    AMS.mutate((db) => {
      const ww = db.wearables; const d = ww.devices.find((x) => x.serial === p.serial);
      d.athleteId = a.id; d.status = 'Active'; d.matchedBy = me().name; d.matchedAt = nowStamp();
      if (d.orphan && d.orphan.gps) { imported = d.orphan.gps.length; ww.gps[a.id] = (ww.gps[a.id] || []).concat(d.orphan.gps).sort((x, y) => x.date.localeCompare(y.date)); if (!ww.pmax[a.id]) ww.pmax[a.id] = AMS.round(Math.max(...ww.gps[a.id].map((x) => x.vmax)) / 0.95, 1); }
      if (d.orphan && d.orphan.bio) { imported = 28; ww.bio[a.id] = d.orphan.bio; }
      delete d.orphan;
      const ath = AMS.byId(db.athletes, a.id); const model = VENDOR_MODEL[d.vendor];
      if (model && !ath.devices.includes(model)) ath.devices.push(model);
      const con = ww.connectors.find((c) => c.vendor === d.vendor);
      if (con) { con.athletesMapped = ww.devices.filter((x) => x.vendor === d.vendor && x.athleteId && x.status !== 'Retired').length; }
      AMS.notify({ toRole: 'coach', title: 'Wearable paired', text: d.vendor + ' ' + d.serial + ' is now paired to ' + a.name + (imported ? '; ' + imported + (d.vendor === 'WHOOP' ? ' nights' : ' GPS sessions') + ' attributed.' : '.'), athleteId: a.id, module: MOD });
    }, { toast: p.serial + ' paired to ' + a.name + (imported ? ' · ' + imported + (dev.vendor === 'WHOOP' ? ' nights' : ' sessions') + ' attributed' : ''), log: { type: 'integration', text: dev.vendor + ' unit ' + p.serial + ' paired to ' + a.name, athleteId: a.id } });
    return 'Paired';
  });
  AMS.registerAction('connector.sync', function (p) {
    const w = W(); const c = w && w.connectors.find((x) => x.id === p.connectorId);
    if (!c) { AMS.toast('Connector not found', 'bad'); return null; }
    let records = 0, note = '';
    AMS.mutate((db) => {
      const ww = db.wearables; const con = ww.connectors.find((x) => x.id === p.connectorId);
      if (con.vendor === 'Garmin') {
        Object.keys(ww.garminBacklog || {}).forEach((id) => { const b = ww.bio[id], bk = ww.garminBacklog[id]; if (!b) return; for (let k = 0; k < 3; k++) { b.hrv[25 + k] = bk.hrv[k]; b.rhr[25 + k] = bk.rhr[k]; b.sleep[25 + k] = bk.sleep[k]; b.rec[25 + k] = bk.rec[k]; } records += 3; });
        ww.garminBacklog = {};
        ww.devices.filter((d) => d.vendor === 'Garmin').forEach((d) => { d.lastSync = nowStamp(); });
        con.auth = 'OAuth 1.0a · re-authorised ' + D.fmt(AMS.TODAY) + ' by ' + me().name;
        note = 'Re-authorised; back-filled ' + records + ' athlete-nights';
      } else if (con.vendor === 'WHOOP') {
        Object.keys(ww.whoopPending || {}).forEach((id) => { const b = ww.bio[id], v = ww.whoopPending[id]; if (!b) return; b.hrv[27] = v.hrv; b.rhr[27] = v.rhr; b.sleep[27] = v.sleep; b.rec[27] = v.rec; records++; const d = ww.devices.find((x) => x.athleteId === id && x.vendor === 'WHOOP'); if (d) d.lastSync = nowStamp(); });
        ww.whoopPending = {};
        records += 4;
        note = records > 4 ? 'Pulled ' + (records - 4) + ' late straps + 4 updates' : '4 updated recoveries';
      } else if (con.vendor === 'Catapult') {
        records = 0; note = 'No new sessions since 05:10 import (next squad session 07:30)';
      } else { records = 12; note = '12 HR files from last evening'; }
      ww.dataQuality.forEach((q) => { if (q.connectorId === con.id && q.status === 'Open' && (q.kind === 'garmin-token' || q.kind === 'whoop-unsynced')) { q.status = 'Resolved'; q.resolution = 'Auto-resolved by sync'; q.resolvedBy = me().name; q.resolvedAt = nowStamp(); } });
      con.status = 'Connected'; con.lastSync = nowStamp();
      con.errors = ww.dataQuality.filter((q) => q.connectorId === con.id && q.status === 'Open').length;
      con.syncLog.unshift({ at: nowStamp(), records, ok: true, note, manual: true }); con.syncLog.length = Math.min(con.syncLog.length, 8);
      if (con.vendor === 'Garmin') AMS.notify({ toRole: 'coach', title: 'Garmin data restored', text: 'HRV and sleep for the national camp are back (3 nights back-filled).', module: MOD });
    }, { toast: c.vendor + ' synced · ' + (records ? records + ' records' : 'up to date'), toastKind: 'good', log: { type: 'integration', text: c.vendor + ' ' + c.product + ' synced manually — ' + (note || records + ' records') } });
    return 'Synced';
  });
  AMS.registerAction('recovery.log', function (p) {
    const a = AMS.org.athlete(p.athleteId);
    if (!a) { AMS.toast('Athlete not found', 'bad'); return null; }
    const iv = INTERVENTIONS.find((x) => x.id === p.type) || INTERVENTIONS[4];
    const status = p.status || 'Prescribed';
    AMS.mutate((db) => {
      db.wearables.interventions.unshift({ id: AMS.uid('RCV'), athleteId: a.id, date: p.date || AMS.TODAY, time: p.time || (status === 'Completed' ? AMS.clockTime() : '13:30'), type: iv.id, durationMin: p.durationMin != null ? +p.durationMin : iv.dur, status, by: me().name, role: AMS.ui.role, note: p.note || iv.note });
      if (status === 'Prescribed') {
        AMS.notify({ toRole: 'athlete', title: 'Recovery added to your day', text: iv.id + (iv.dur ? ' · ' + (p.durationMin || iv.dur) + ' min' : '') + ' — ' + (p.note || iv.note), athleteId: a.id, module: MOD });
        AMS.notify({ toRole: 'coach', title: 'Recovery prescribed', text: a.name + ': ' + iv.id + ' today' + (p.reason ? ' (' + p.reason + ')' : '') + '.', athleteId: a.id, module: MOD });
      }
    }, { toast: iv.id + (status === 'Prescribed' ? ' prescribed for ' : ' logged for ') + first(a), log: { type: 'recovery', text: iv.id + ' ' + status.toLowerCase() + ' for ' + a.name + (p.reason ? ' — ' + p.reason : ''), athleteId: a.id } });
    return status === 'Prescribed' ? 'Prescribed' : 'Logged';
  });
  AMS.registerAction('recovery.status', function (p) {
    const w = W(); const iv = w && w.interventions.find((x) => x.id === p.id); if (!iv) return null;
    const a = AMS.org.athlete(iv.athleteId);
    AMS.mutate((db) => { const x = db.wearables.interventions.find((y) => y.id === p.id); x.status = p.status; x.closedBy = me().name; x.closedAt = AMS.clockTime(); },
      { toast: iv.type + ' marked ' + p.status.toLowerCase(), toastKind: p.status === 'Completed' ? 'good' : 'info', log: { type: 'recovery', text: iv.type + ' for ' + (a ? a.name : '') + ' marked ' + p.status.toLowerCase(), athleteId: iv.athleteId } });
    return p.status;
  });
  AMS.registerAction('dq.resolve', function (p) {
    const w = W(); const q = w && w.dataQuality.find((x) => x.id === p.id); if (!q) return null;
    AMS.mutate((db) => { const x = db.wearables.dataQuality.find((y) => y.id === p.id); x.status = 'Resolved'; x.resolution = p.resolution || 'Verified'; x.resolvedBy = me().name; x.resolvedAt = nowStamp(); const con = db.wearables.connectors.find((c) => c.id === x.connectorId); if (con) con.errors = db.wearables.dataQuality.filter((y) => y.connectorId === con.id && y.status === 'Open').length; },
      { toast: 'Data issue resolved — ' + (p.resolution || 'verified'), log: { type: 'integration', text: 'Data-quality issue "' + q.title + '" resolved: ' + (p.resolution || 'verified') } });
    return 'Resolved';
  });
  AMS.registerAction('science.threshold', function (p) {
    const w = W(); if (!w) return null; const old = w.model.threshold;
    AMS.mutate((db) => { db.wearables.model.threshold = +p.value; db.wearables.model.history.unshift({ at: nowStamp(), from: old, to: +p.value, by: me().name }); },
      { toast: 'Risk alert threshold set to ' + p.value, log: { type: 'science', text: 'Risk-model alert threshold changed ' + old + ' → ' + p.value } });
    return 'Saved';
  });
  AMS.registerAction('science.review', function (p) {
    const a = p.athleteId && AMS.org.athlete(p.athleteId);
    AMS.mutate((db) => { db.wearables.reviewed[p.key] = { by: me().name, role: AMS.ui.role, at: AMS.clockTime(), action: p.label || 'Reviewed' }; },
      { toast: 'Marked reviewed', toastKind: 'info', log: { type: 'science', text: (p.label || 'Reviewed') + ': ' + (p.title || 'anomaly') + (a ? ' — ' + a.name : ''), athleteId: p.athleteId } });
    return 'Reviewed';
  });

  /* ================================================================== AI detectors */
  function sessionAction(a, variant, label) {
    const s = AMS.todaySessionFor(a);
    if (!s || (s.mods && s.mods[a.id])) return null;
    return { label: label || 'Switch to recovery session', action: 'session.modifyForAthlete', payload: { athleteId: a.id, sessionId: s.id, variant: variant || 'recovery' } };
  }
  AMS.registerDetector('science.hrvDrop', function (ctx) {
    if (!ctx.db.wearables) return [];
    return ctx.athletes.map((a) => {
      const h = hrvStats(a.id);
      if (!h || h.stale || h.z > -2) return null;
      const sess = ctx.role === 'coach' ? sessionAction(a, 'recovery') : null;
      const acts = [];
      if (sess) acts.push(Object.assign(sess, { primary: true }));
      acts.push({ label: 'Prescribe nap + sleep hygiene', action: 'recovery.log', payload: { athleteId: a.id, type: 'Nap', status: 'Prescribed', reason: 'HRV ' + h.z + ' SD below baseline' }, primary: !sess });
      if (ctx.role !== 'coach') acts.push({ label: 'Tell coach', action: 'notify', payload: { toRole: 'coach', athleteId: a.id, text: a.name + ': overnight HRV ' + h.latest + ' ms (' + h.z + ' SD below own normal' + (h.rhrDelta > 0 ? ', resting HR +' + h.rhrDelta : '') + '). Suggest no high-intensity work today.' } });
      return {
        id: 'sci-hrv:' + a.id + ':' + AMS.TODAY, kind: 'risk', severity: h.z <= -2.5 ? 'high' : 'med', module: MOD, roles: SCI_ROLES,
        title: a.name + ' — HRV ' + Math.abs(h.z).toFixed(1) + ' SD below own baseline',
        summary: 'Overnight HRV (rMSSD) ' + h.latest + ' ms vs own 3-week normal ' + Math.round(h.mean) + ' ± ' + Math.round(h.sd) + ' ms' + (h.falling ? ', falling 3 mornings running' : '') + (h.rhrDelta >= 4 ? '; resting HR up ' + h.rhrDelta + ' bpm' : '') + '. Autonomic fatigue — avoid max-intensity work until it recovers.',
        athleteIds: [a.id], confidence: h.falling ? 0.84 : 0.74,
        evidence: [{ label: 'HRV today', value: h.latest + ' ms', tone: 'bad' }, { label: 'Own normal', value: Math.round(h.mean) + ' ms', tone: 'good' }, { label: 'z-score', value: String(h.z), tone: 'bad' }].concat(h.rhrDelta != null ? [{ label: 'Resting HR', value: (h.rhrDelta >= 0 ? '+' : '') + h.rhrDelta + ' bpm', tone: h.rhrDelta >= 5 ? 'warn' : 'info' }] : []).concat(h.sleep3 ? [{ label: 'Sleep 3 nights', value: h.sleep3 + ' h', tone: h.sleep3 < 6.5 ? 'warn' : 'info' }] : []),
        actions: acts,
      };
    }).filter(Boolean);
  });
  AMS.registerDetector('science.speedDrop', function (ctx) {
    if (!ctx.db.wearables) return [];
    return ctx.athletes.filter((a) => a.availability === 'Available').map((a) => {
      const sp = speedStats(a.id);
      if (!sp || sp.drop > -5) return null;
      const acts = [];
      const sess = ctx.role === 'coach' ? sessionAction(a, 'reduced', 'Reduce today\'s volume (−40%)') : null;
      if (sess) acts.push(Object.assign(sess, { primary: true }));
      acts.push({ label: 'Ask physio for a hamstring screen', action: 'notify', payload: { toRole: 'physio', athleteId: a.id, text: a.name + ': top speed ' + Math.abs(sp.drop) + '% below own baseline over the last 3 sessions (' + sp.recentPeak + ' vs ' + sp.basePeak + ' km/h). Quick posterior-chain screen please.' }, primary: !sess });
      acts.push({ label: 'Open load & wellness', action: 'open.athlete', payload: { athleteId: a.id, tab: 'science' } });
      return {
        id: 'sci-speed:' + a.id + ':' + AMS.TODAY, kind: 'risk', severity: sp.drop <= -7 ? 'high' : 'med', module: MOD, roles: SCI_ROLES,
        title: a.name + ' — top speed down ' + Math.abs(sp.drop) + '% vs own baseline',
        summary: 'Peak velocity of the last 3 GPS sessions is ' + sp.recentPeak + ' km/h against a normal of ' + sp.basePeak + ' km/h' + (sp.pmax ? ' (personal max ' + sp.pmax + ')' : '') + '. A drop in max velocity with high load is an early neuromuscular-fatigue and hamstring-risk signal.',
        athleteIds: [a.id], confidence: 0.77,
        evidence: [{ label: 'Recent peak', value: sp.recentPeak + ' km/h', tone: 'bad' }, { label: 'Own baseline', value: sp.basePeak + ' km/h', tone: 'good' }, { label: 'Change', value: sp.drop + '%', tone: 'bad' }, { label: 'ACWR', value: C.acwr(a).toFixed(2), tone: C.acwrBand(C.acwr(a)) }],
        actions: acts,
      };
    }).filter(Boolean);
  });
  AMS.registerDetector('science.unmatchedDevice', function (ctx) {
    const w = ctx.db.wearables; if (!w) return [];
    return w.devices.filter((d) => !d.athleteId && d.status === 'Unmatched' && deviceVisible(d)).map((d) => {
      const s = suggestFor(d);
      const data = d.orphan && d.orphan.gps ? d.orphan.gps.length + ' GPS sessions' : d.orphan && d.orphan.bio ? '28 nights of HRV/sleep' : 'data';
      const acts = [];
      if (s) acts.push({ label: 'Pair to ' + s.athlete.name, action: 'device.match', payload: { serial: d.serial, athleteId: s.athlete.id }, primary: true });
      acts.push({ label: 'Open wearables', action: 'go', payload: { module: MOD, params: { tab: 'wearables' } }, primary: !s });
      return {
        id: 'sci-dev:' + d.serial, kind: 'ops', severity: 'low', module: MOD, roles: ['scientist', 'director'],
        title: d.vendor + ' ' + d.serial + ' is recording but not paired',
        summary: data + ' from ' + (AMS.org.centre(d.centreId) || {}).short + ' are not attributed to any athlete, so they are missing from load and readiness.' + (s ? ' Most likely owner: ' + s.athlete.name + ' (' + s.reasons.slice(0, 2).join('; ').toLowerCase() + ').' : ''),
        athleteIds: s ? [s.athlete.id] : [], confidence: s ? s.confidence : 0.4,
        evidence: [{ label: 'Last seen', value: syncLabel(d.lastSync), tone: 'info' }, { label: 'Unattributed', value: data, tone: 'warn' }].concat(s ? [{ label: 'Match', value: Math.round(s.confidence * 100) + '%', tone: 'good' }] : []),
        actions: acts,
      };
    });
  });
  AMS.registerDetector('science.syncStale', function (ctx) {
    const w = ctx.db.wearables; if (!w) return [];
    return w.connectors.filter((c) => hoursSince(c.lastSync) > 24).map((c) => {
      const n = c.vendor === 'Garmin' ? Object.keys(w.garminBacklog || {}).length : connectorStats(c).mapped;
      return {
        id: 'sci-sync:' + c.id + ':' + c.lastSync, kind: 'ops', severity: hoursSince(c.lastSync) > 48 ? 'med' : 'low', module: MOD, roles: ['scientist', 'director'],
        title: c.vendor + ' has not synced for ' + Math.round(hoursSince(c.lastSync) / 24) + ' days',
        summary: c.product + ' — ' + c.status.toLowerCase() + '. HRV and sleep for ' + n + ' athletes are missing, so their readiness uses check-ins only.',
        athleteIds: [], confidence: 0.97,
        evidence: [{ label: 'Last sync', value: D.fmt(c.lastSync.slice(0, 10)) + ' ' + c.lastSync.slice(11, 16), tone: 'bad' }, { label: 'Status', value: c.status, tone: 'bad' }, { label: 'Athletes affected', value: String(n), tone: 'warn' }],
        actions: [{ label: c.status === 'Token expired' ? 'Re-authorise & sync' : 'Sync now', action: 'connector.sync', payload: { connectorId: c.id }, primary: true }],
      };
    });
  });

  /* ================================================================== module-scoped CSS (theme tokens only) */
  (function injectCss() {
    try {
      if (typeof document === 'undefined' || document.getElementById('style-science')) return;
      const el = document.createElement('style');
      el.id = 'style-science';
      el.textContent = [
        '.sci-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
        '@media (max-width:1000px){.sci-board{grid-template-columns:minmax(0,1fr)}}',
        '.sci-col{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-lg);display:flex;flex-direction:column;min-width:0}',
        '.sci-col-h{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px}',
        '.sci-chip{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer;min-width:0}',
        '.sci-chip:hover{background:var(--surface)}',
        '.sci-chip:last-child{border-bottom:0}',
        '.sci-stack{display:flex;height:12px;border-radius:3px;overflow:hidden;background:var(--surface-3);min-width:120px}',
        '.sci-stack>span{display:block;height:100%}',
        '.sci-dots{display:flex;gap:3px}',
        '.sci-dots>i{width:10px;height:10px;border-radius:2px;display:block}',
        '.sci-zone-label{font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}',
      ].join('\n');
      document.head.appendChild(el);
    } catch (e) { /* no DOM */ }
  })();

  /* ================================================================== shared view helpers */
  const bandTone = (b) => b || 'neutral';
  function useScienceData(v) {
    const athletes = AMS.scopedAthletes();
    return useMemo(() => {
      const rows = athletes.map((a) => {
        const rd = C.readiness(a);
        return { id: a.id, a, rd, acwr: C.acwr(a), risk: riskModel(a), hrv: hrvStats(a.id), sp: speedStats(a.id) };
      });
      return { athletes, rows, byId: Object.fromEntries(rows.map((r) => [r.id, r])) };
    }, [v, athletes.length, AMS.ui.role, JSON.stringify(AMS.ui.scope)]);
  }
  function LockNote({ text }) {
    return html`<div className="row tight small faint" style=${{ gap: 6 }}><${UI.Icon} name="lock" size=${13} />${text}</div>`;
  }
  function squadOptions(list) {
    const ids = [...new Set(list.map((a) => a.squadId))];
    return ids.map((id) => ({ value: id, label: AMS.org.squad(id).name + ' · ' + AMS.org.centre(AMS.org.squad(id).centreId).short }));
  }

  /* ================================================================== READINESS tab */
  function ReadinessTab({ data, onPick }) {
    const [squad, setSquad] = UI.useLocal('sci:squad', '');
    const [band, setBand] = useState('all');
    const [q, setQ] = useState('');
    const [showAll, setShowAll] = useState(false);
    const list = data.rows.filter((r) => (!squad || r.a.squadId === squad) && (!q || r.a.name.toLowerCase().includes(q.toLowerCase())));
    const filtered = list.filter((r) => band === 'all' || (band === 'none' ? !r.rd.checkedIn : r.rd.band === band));
    const cols = { bad: [], warn: [], good: [] };
    filtered.forEach((r) => cols[r.rd.band].push(r));
    Object.values(cols).forEach((c) => c.sort((x, y) => x.rd.score - y.rd.score));
    const missing = list.filter((r) => !r.rd.checkedIn && r.a.availability !== 'Unavailable');
    const reds = list.filter((r) => r.rd.band === 'bad' && r.a.availability !== 'Unavailable');
    const redsToMove = reds.filter((r) => { const s = AMS.todaySessionFor(r.a); return s && !(s.mods && s.mods[r.id]); });
    const days = AMS.date.range(AMS.date.add(AMS.TODAY, -13), 14);
    const gridRows = filtered.slice().sort((x, y) => x.rd.score - y.rd.score).slice(0, showAll ? 200 : 24).map((r) => ({
      label: r.a.name, onClick: () => onPick(r.id),
      cells: days.map((d, k) => { const x = dayReadiness(r.a, 14 + k); if (!x) return { label: '·', title: D.fmt(d) + ': no check-in' }; return { label: x.score, tone: x.band, title: r.a.name + ' · ' + D.fmtLong(d) + ': readiness ' + x.score + (x.acwr ? ' · ACWR ' + x.acwr.toFixed(2) : '') + (x.missing ? ' (no check-in, 3-day avg)' : '') }; }),
    }));
    const insights = AMS.ai.insights({ module: MOD }).filter((i) => i.kind !== 'ops').slice(0, 4);
    const avg = list.length ? Math.round(AMS.mean(list.map((r) => r.rd.score))) : 0;
    return html`<div className="col loose">
      <div className="row wrap between">
        <div className="row wrap tight">
          <${UI.Select} value=${squad} onChange=${setSquad} options=${squadOptions(data.athletes)} placeholder="All squads in scope" />
          <${UI.Seg} value=${band} onChange=${setBand} options=${[{ id: 'all', label: 'All ' + list.length }, { id: 'bad', label: 'Red ' + list.filter((r) => r.rd.band === 'bad').length }, { id: 'warn', label: 'Amber ' + list.filter((r) => r.rd.band === 'warn').length }, { id: 'good', label: 'Green ' + list.filter((r) => r.rd.band === 'good').length }, { id: 'none', label: 'No check-in ' + list.filter((r) => !r.rd.checkedIn).length }]} />
          <${UI.Search} value=${q} onChange=${setQ} placeholder="Find athlete" style=${{ width: 180 }} />
        </div>
        <div className="row wrap tight">
          ${missing.length > 0 && html`<button className="btn sm" onClick=${() => AMS.runAction('checkin.remind', { athleteIds: missing.map((r) => r.id) })}><${UI.Icon} name="bell" size=${13} />Remind ${missing.length} to check in</button>`}
          ${canTrain() && redsToMove.length > 0 && html`<button className="btn sm ai" onClick=${() => { redsToMove.forEach((r) => AMS.runAction('session.modifyForAthlete', { athleteId: r.id, variant: 'recovery' })); }}><${UI.Icon} name="zap" size=${13} />Move ${redsToMove.length} red to recovery</button>`}
          ${!canTrain() && reds.length > 0 && AMS.ui.role === 'scientist' && html`<button className="btn sm ai" onClick=${() => AMS.runAction('notify', { toRole: 'coach', text: 'Red today (' + reds.length + '): ' + reds.map((r) => r.a.name + ' ' + r.rd.score).join(', ') + '. Recommend recovery or reduced sessions.' })}><${UI.Icon} name="send" size=${13} />Send red list to coach</button>`}
        </div>
      </div>
      <div className="grid g-main">
        <div className="sci-board">
          ${[['bad', 'Red · act before session'], ['warn', 'Amber · watch'], ['good', 'Green · train as planned']].map(([b, label]) => html`<div key=${b} className="sci-col">
            <div className="sci-col-h"><span className="row tight"><${UI.Dot} tone=${b} />${label}</span><span className="pill">${cols[b].length}</span></div>
            <div style=${{ maxHeight: 420, overflowY: 'auto' }}>
              ${cols[b].length === 0 && html`<div className="small faint" style=${{ padding: 12 }}>Nobody here.</div>`}
              ${cols[b].slice(0, 40).map((r) => { const top = r.rd.factors[0]; const mod = (AMS.todaySessionFor(r.a) || {}).mods; return html`<div key=${r.id} className="sci-chip" onClick=${() => onPick(r.id)}>
                <${UI.Ring} value=${r.rd.score} tone=${r.rd.band} size=${30} />
                <div className="col tight grow" style=${{ gap: 1, minWidth: 0 }}>
                  <span className="ellipsis" style=${{ fontWeight: 600, fontSize: 12.5 }}>${r.a.name}</span>
                  <span className="tiny faint ellipsis">${top ? top.label + ' ' + top.value : r.rd.checkedIn ? 'No flags' : 'No check-in yet'}${mod && mod[r.id] ? ' · ' + mod[r.id].variant : ''}</span>
                </div>
                <${UI.AcwrPill} value=${r.acwr} />
              </div>`; })}
            </div>
          </div>`)}
        </div>
        <${UI.Card} ai title="AI flags for this group" hint=${insights.length + ' open'} flush>
          <${UI.InsightList} insights=${insights} compact empty="No readiness or load flags" />
          <div className="card-b row wrap tight" style=${{ borderTop: '1px solid var(--border)' }}><${UI.AskCopilot} prompt="Who should train lighter today and why?" label="Who should train lighter today?" /></div>
        <//>
      </div>
      <${UI.Card} title="Readiness heat map — last 14 mornings" icon="grid" hint=${'Squad avg today ' + avg + ' · each athlete is scored against their own normal'} actions=${filtered.length > 24 && html`<button className="btn ghost sm" onClick=${() => setShowAll(!showAll)}>${showAll ? 'Show worst 24' : 'Show all ' + filtered.length}</button>`}>
        ${gridRows.length ? html`<${UI.HeatGrid} rows=${gridRows} cols=${days.map((d) => D.dow(d).slice(0, 2) + ' ' + d.slice(8))} cellW=${30} labelW=${160} />` : html`<${UI.Empty} title="No athletes match these filters" />`}
        <div className="legend" style=${{ marginTop: 8 }}><span><i style=${{ background: 'var(--good)' }} />Green ≥ 70</span><span><i style=${{ background: 'var(--warn)' }} />Amber 50–69</span><span><i style=${{ background: 'var(--bad)' }} />Red under 50</span><span className="faint">· = no check-in that morning. Readiness = 5-question wellness, minus a penalty when ACWR > 1.3.</span></div>
      <//>
    </div>`;
  }

  /* ================================================================== FATIGUE tab */
  function Quadrant({ rows, selectedId, onSelect }) {
    const ref = useRef(null);
    const Wd = UI.useWidth(ref, 640), H = 360;
    const pad = { l: 44, r: 14, t: 14, b: 38 };
    const x0 = 0.4, x1 = 2.1;
    const X = (v) => pad.l + ((AMS.clamp(v, x0, x1) - x0) / (x1 - x0)) * (Wd - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - AMS.clamp(v, 0, 100) / 100) * (H - pad.t - pad.b);
    const zones = [
      { x: [1.3, x1], y: [0, 50], tone: 'bad', label: 'Overreaching — act today' },
      { x: [x0, 1.3], y: [0, 50], tone: 'warn', label: 'Fatigued at normal load' },
      { x: [1.3, x1], y: [50, 100], tone: 'info', label: 'Coping with a load jump' },
      { x: [0.8, 1.3], y: [70, 100], tone: 'good', label: 'Ready to train' },
      { x: [x0, 0.8], y: [50, 100], tone: 'info', label: 'Under-loaded' },
    ];
    const zoneLabel = (z) => { const lx = z.x[0] === x0 ? X(z.x[0]) + 6 : X(z.x[0]) + 6; const ly = z.y[1] === 100 ? Y(100) + 13 : Y(z.y[0]) - 6; return html`<text x=${lx} y=${ly} className="sci-zone-label" style=${{ fill: 'var(--' + z.tone + ')' }}>${z.label}</text>`; };
    return html`<div ref=${ref} style=${{ position: 'relative', width: '100%' }}>
      <svg width=${Wd} height=${H} className="chart" style=${{ display: 'block' }} role="img" aria-label="ACWR versus readiness scatter">
        ${zones.map((z, i) => html`<rect key=${'z' + i} x=${X(z.x[0])} y=${Y(z.y[1])} width=${Math.max(0, X(z.x[1]) - X(z.x[0]))} height=${Math.max(0, Y(z.y[0]) - Y(z.y[1]))} fill=${'var(--' + z.tone + ')'} opacity="0.07" />`)}
        ${[0, 25, 50, 70, 100].map((t) => html`<g key=${'y' + t}><line className="grid-line" x1=${pad.l} x2=${Wd - pad.r} y1=${Y(t)} y2=${Y(t)} /><text x=${pad.l - 6} y=${Y(t) + 3.5} textAnchor="end">${t}</text></g>`)}
        ${[0.5, 0.8, 1.0, 1.3, 1.5, 1.8, 2.0].map((t) => html`<g key=${'x' + t}><line x1=${X(t)} x2=${X(t)} y1=${pad.t} y2=${H - pad.b} stroke=${t === 1.5 ? 'var(--bad)' : 'var(--chart-grid)'} strokeDasharray=${t === 1.5 || t === 0.8 || t === 1.3 ? '4 4' : null} /><text x=${X(t)} y=${H - pad.b + 14} textAnchor="middle">${t.toFixed(1)}</text></g>`)}
        <text x=${(Wd + pad.l) / 2} y=${H - 6} textAnchor="middle">ACWR (7-day vs 28-day load) →</text>
        <text x=${12} y=${(H - pad.b) / 2} textAnchor="middle" transform=${'rotate(-90 12 ' + (H - pad.b) / 2 + ')'}>Readiness today →</text>
        ${zones.map((z, i) => html`<g key=${'zl' + i}>${zoneLabel(z)}</g>`)}
        ${rows.map((r) => {
          const jx = ((AMS.hue(r.id) % 9) - 4) * 0.7, jy = ((AMS.hue(r.id + 'y') % 9) - 4) * 0.7;
          const sel = r.id === selectedId;
          const showName = r.rd.band === 'bad' && r.acwr >= 1.3;
          return html`<g key=${r.id} style=${{ cursor: 'pointer' }} onClick=${() => onSelect(r.id)}>
            <circle cx=${X(r.acwr) + jx} cy=${Y(r.rd.score) + jy} r=${sel ? 8 : 5.5} fill=${'var(--' + r.rd.band + ')'} fillOpacity=${sel ? 1 : 0.78} stroke=${sel ? 'var(--fg)' : 'var(--surface)'} strokeWidth=${sel ? 2 : 1}><title>${r.a.name} · ACWR ${r.acwr.toFixed(2)} · readiness ${r.rd.score}</title></circle>
            ${(showName || sel) && html`<text x=${X(r.acwr) + jx + 9} y=${Y(r.rd.score) + jy + 3.5} style=${{ fill: 'var(--fg-2)', fontWeight: 600 }}>${first(r.a)}</text>`}
          </g>`;
        })}
      </svg>
    </div>`;
  }
  function FatigueTab({ data, selected, setSelected }) {
    const rows = data.rows.filter((r) => r.a.availability !== 'Unavailable');
    const sel = data.byId[selected] || rows.slice().sort((x, y) => y.risk.score - x.risk.score)[0];
    if (sel) AMS.setFocus({ athleteId: sel.id });
    const zoneCount = { over: rows.filter((r) => r.acwr >= 1.3 && r.rd.score < 50).length, fat: rows.filter((r) => r.acwr < 1.3 && r.rd.score < 50).length, cope: rows.filter((r) => r.acwr >= 1.3 && r.rd.score >= 50).length, ready: rows.filter((r) => r.acwr >= 0.8 && r.acwr < 1.3 && r.rd.score >= 70).length };
    const ac = sel ? acuteChronic(sel.a, 28) : [];
    const mono = useMemo(() => data.rows.map((r) => { const wl = C.weekLoad(r.a), prev = C.weekLoad(r.a, 1); return { id: r.id, a: r.a, wl, prev, chg: prev ? Math.round(((wl - prev) / prev) * 100) : 0, mono: C.monotony(r.a), strain: C.strain(r.a), acwr: r.acwr, rd: r.rd }; }), [data]);
    return html`<div className="col loose">
      <div className="grid g4">
        <${UI.KPI} label="Overreaching zone" value=${zoneCount.over} foot="ACWR ≥ 1.3 and readiness under 50" tone=${zoneCount.over ? 'bad' : ''} icon="alert" />
        <${UI.KPI} label="Fatigued at normal load" value=${zoneCount.fat} foot="Look for non-training stress" tone=${zoneCount.fat ? 'warn' : ''} icon="moon" />
        <${UI.KPI} label="Coping with a load jump" value=${zoneCount.cope} foot="Monitor — fine today" icon="trend-up" />
        <${UI.KPI} label="Ready to train" value=${zoneCount.ready} foot=${'of ' + rows.length + ' available athletes'} tone="good" icon="check" />
      </div>
      <div className="grid g-main">
        <${UI.Card} title="Fatigue quadrant — load vs readiness" icon="target" hint="Tap a dot to inspect">
          <${Quadrant} rows=${rows} selectedId=${sel && sel.id} onSelect=${setSelected} />
        <//>
        ${sel ? html`<${UI.Card} title=${sel.a.name} icon="user" hint=${AMS.org.squad(sel.a.squadId).name} actions=${html`<button className="btn ghost sm" onClick=${() => AMS.openAthlete(sel.id, 'science')}>Profile<${UI.Icon} name="chev-r" size=${13} /></button>`}>
          <div className="col">
            <div className="row wrap" style=${{ gap: 16 }}>
              <${UI.Readiness} athlete=${sel.a} size=${44} showLabel />
              <div className="col tight" style=${{ gap: 2 }}><span className="upper">ACWR</span><${UI.AcwrPill} value=${sel.acwr} /></div>
              <div className="col tight" style=${{ gap: 2 }}><span className="upper">Risk model</span><${UI.Pill} tone=${sel.risk.band}>${sel.risk.score} / 100<//></div>
              <div className="col tight" style=${{ gap: 2 }}><span className="upper">Availability</span><${UI.AvailabilityPill} value=${sel.a.availability} /></div>
            </div>
            <${UI.Evidence} items=${sel.rd.factors.concat(sel.hrv && sel.hrv.z < -1 ? [{ label: 'HRV', value: sel.hrv.z + ' SD', tone: 'bad' }] : []).concat(sel.sp && sel.sp.drop < -3 ? [{ label: 'Top speed', value: sel.sp.drop + '%', tone: 'warn' }] : [])} />
            <${UI.DL} cols=${2} items=${[['This week', fmtN(C.weekLoad(sel.a)) + ' AU'], ['Last week', fmtN(C.weekLoad(sel.a, 1)) + ' AU'], ['Monotony', C.monotony(sel.a).toFixed(2)], ['Strain', fmtN(C.strain(sel.a))]]} />
            <${ActionsFor} a=${sel.a} reason=${'ACWR ' + sel.acwr.toFixed(2) + ', readiness ' + sel.rd.score} />
          </div>
        <//>` : html`<${UI.Card} title="Athlete"><${UI.Empty} title="No athletes in scope" /><//>`}
      </div>
      ${sel && html`<div className="grid g2">
        <${UI.Card} title=${'Acute vs chronic load — ' + sel.a.name} icon="chart" hint="Rolling 7-day vs 28-day average (AU/day)">
          <${UI.LineChart} height=${210} series=${[{ name: 'Daily load', data: ac.map((p) => ({ x: D.fmt(p.date), y: p.load })), tone: 'var(--fg-3)', width: 1, area: true }, { name: 'Acute (7-day)', data: ac.map((p) => ({ x: D.fmt(p.date), y: p.acute })), tone: 'bad' }, { name: 'Chronic (28-day)', data: ac.map((p) => ({ x: D.fmt(p.date), y: p.chronic })), tone: 'cat-2', dashed: true }]} yFormat=${(v) => Math.round(v)} />
        <//>
        <${UI.Card} title="ACWR — last 4 weeks" icon="trend-up" hint="0.8–1.3 sweet spot · ≥ 1.5 load jump">
          <${UI.LineChart} height=${210} yMin=${0.4} yMax=${2.2} series=${[{ name: 'ACWR', data: C.acwrSeries(sel.a, 28).map((p) => ({ x: D.fmt(p.date), y: p.value })), tone: 'accent', area: false }]} bands=${[{ from: 0.8, to: 1.3, tone: 'good', label: 'Sweet spot' }, { from: 1.3, to: 1.5, tone: 'warn', label: 'Rising' }, { from: 1.5, to: 2.2, tone: 'bad', label: 'Load jump' }]} />
        <//>
      </div>`}
      <${UI.Card} title="Monotony & strain — this week" icon="layers" hint="Monotony = mean ÷ SD of daily load (> 2.0 = too little variation) · Strain = weekly load × monotony" flush>
        <${UI.Table} compact maxHeight=${420} initialSort=${{ key: 'strain', dir: 'desc' }} onRow=${(r) => setSelected(r.id)} selectedId=${sel && sel.id} rows=${mono} columns=${[
          { key: 'name', label: 'Athlete', render: (r) => html`<${UI.AthleteCell} athlete=${r.a} size=${26} />`, sort: (r) => r.a.name },
          { key: 'wl', label: 'Week load', num: true, render: (r) => fmtN(r.wl) },
          { key: 'chg', label: 'vs last wk', num: true, render: (r) => html`<span className=${r.chg > 30 ? 'bad' : r.chg > 15 ? 'warn' : r.chg < -30 ? 'info' : 'faint'}>${r.chg > 0 ? '+' : ''}${r.chg}%</span>` },
          { key: 'mono', label: 'Monotony', num: true, render: (r) => html`<span className=${r.mono > 2 ? 'warn' : ''} style=${{ fontWeight: r.mono > 2 ? 600 : 400 }}>${r.mono.toFixed(2)}</span>` },
          { key: 'strain', label: 'Strain', num: true, render: (r) => fmtN(r.strain) },
          { key: 'acwr', label: 'ACWR', render: (r) => html`<${UI.AcwrPill} value=${r.acwr} />` },
          { key: 'rd', label: 'Readiness', hideSm: true, sort: (r) => r.rd.score, render: (r) => html`<${UI.Pill} tone=${r.rd.band}>${r.rd.score}<//>` },
        ]} />
      <//>
    </div>`;
  }
  /** One-tap, role-aware actions for an athlete (coach adjusts the session; scientist/physio prescribe recovery or alert the coach). */
  function ActionsFor({ a, reason }) {
    const s = AMS.todaySessionFor(a);
    const mod = s && s.mods && s.mods[a.id];
    return html`<div className="row wrap tight">
      ${canTrain() && s && !mod && html`<button className="btn sm ai" onClick=${() => AMS.runAction('session.modifyForAthlete', { athleteId: a.id, sessionId: s.id, variant: 'recovery' })}><${UI.Icon} name="zap" size=${13} />Recovery version of ${s.title}</button>`}
      ${canTrain() && s && !mod && html`<button className="btn sm" onClick=${() => AMS.runAction('session.modifyForAthlete', { athleteId: a.id, sessionId: s.id, variant: 'reduced' })}>Reduce volume −40%</button>`}
      ${mod && html`<${UI.Pill} tone="info" dot>Today: ${mod.variant} (set ${mod.at})<//>`}
      ${canRecovery() && html`<button className="btn sm" onClick=${() => AMS.runAction('recovery.log', { athleteId: a.id, type: 'Nap', status: 'Prescribed', reason })}><${UI.Icon} name="moon" size=${13} />Prescribe nap</button>`}
      ${!canTrain() && AMS.ui.role !== 'coach' && html`<button className="btn sm" onClick=${() => AMS.runAction('notify', { toRole: 'coach', athleteId: a.id, text: a.name + ': ' + reason + '. Suggest a lighter session today.' })}><${UI.Icon} name="send" size=${13} />Tell coach</button>`}
      ${AMS.ui.role === 'coach' && html`<button className="btn sm" onClick=${() => AMS.runAction('notify', { toRole: 'physio', athleteId: a.id, text: a.name + ': ' + reason + '. Quick screen before session please.' })}>Ask physio to screen</button>`}
    </div>`;
  }

  /* ================================================================== WEARABLES tab */
  function ConnectorCard({ c }) {
    const st = connectorStats(c);
    const tone = c.status === 'Connected' ? 'good' : c.status === 'Degraded' ? 'warn' : 'bad';
    return html`<div className=${'card sev-stripe ' + tone}>
      <div className="card-b col" style=${{ gap: 10 }}>
        <div className="row between top">
          <div className="col tight" style=${{ gap: 2 }}><span style=${{ fontWeight: 700, fontSize: 15 }}>${c.vendor}</span><span className="tiny faint">${c.product}</span></div>
          <div className="col tight" style=${{ alignItems: 'flex-end', gap: 4 }}><${UI.Pill} tone=${tone} dot>${c.status}<//><span className="tag">${c.type}</span></div>
        </div>
        <div className="row between small"><span className="muted">Last sync</span><span className=${st.stale ? 'bad' : ''} style=${{ fontWeight: 600 }}>${syncLabel(c.lastSync)} · ${c.lastSync.slice(11, 16)}</span></div>
        <div className="row between small"><span className="muted">Sync health (7 runs)</span><span className="sci-dots">${c.syncLog.slice(0, 7).reverse().map((s, i) => html`<i key=${i} title=${s.at.replace('T', ' ') + ' · ' + s.records + ' records' + (s.note ? ' · ' + s.note : '')} style=${{ background: s.ok ? 'var(--good)' : 'var(--bad)' }} />`)}</span></div>
        <div className="grid g3" style=${{ gap: 8 }}>
          <div className="col tight" style=${{ gap: 0 }}><span className="upper">Devices</span><span className="num" style=${{ fontSize: 20 }}>${st.devices}</span></div>
          <div className="col tight" style=${{ gap: 0 }}><span className="upper">Mapped</span><span className="num" style=${{ fontSize: 20 }}>${st.mapped}</span></div>
          <div className="col tight" style=${{ gap: 0 }}><span className="upper">Issues</span><span className=${'num ' + (st.issues ? 'warn' : '')} style=${{ fontSize: 20 }}>${st.issues + st.unmatched}</span></div>
        </div>
        <div className="tiny faint">${c.centres.map((id) => AMS.org.centre(id).short).join(' · ')} · ${c.cadence}</div>
        <div className="tiny faint">${c.auth}</div>
        ${canSci() ? html`<button className=${AMS.cx('btn sm', c.status === 'Token expired' ? 'primary' : '')} onClick=${() => AMS.runAction('connector.sync', { connectorId: c.id })}><${UI.Icon} name="refresh" size=${13} />${c.status === 'Token expired' ? 'Re-authorise & sync' : 'Sync now'}</button>` : html`<${LockNote} text="Sync is run by sports science" />`}
      </div>
    </div>`;
  }
  function UnmatchedRow({ d }) {
    const s = suggestFor(d);
    const [pick, setPick] = useState(s ? s.athlete.id : '');
    const cands = AMS.db.athletes.filter((a) => a.enrollment === 'Active' && a.centreId === d.centreId);
    const data = d.orphan && d.orphan.gps ? d.orphan.gps.length + ' GPS sessions · ' + fmtN(AMS.sum(d.orphan.gps.map((x) => x.totalDistance)) / 1000, 1) + ' km' : d.orphan && d.orphan.bio ? '28 nights HRV/sleep' : '—';
    return html`<div className="list-item" style=${{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <span style=${{ width: 34, height: 34, borderRadius: 8, background: 'var(--warn-weak)', color: 'var(--warn)', display: 'grid', placeItems: 'center', flex: 'none' }}><${UI.Icon} name=${d.vendor === 'Catapult' ? 'gps' : 'watch'} size=${17} /></span>
      <div className="col tight grow" style=${{ gap: 4, minWidth: 220 }}>
        <div className="row wrap tight"><span className="mono" style=${{ fontWeight: 600 }}>${d.serial}</span><span className="tag">${d.vendor} ${d.model}</span><span className="tiny faint">${AMS.org.centre(d.centreId).short} · last seen ${syncLabel(d.lastSync)} · battery ${d.battery}%</span></div>
        <div className="small muted">Unattributed data: <b>${data}</b>${d.note ? ' · ' + d.note : ''}</div>
        ${s && html`<div className="ai-box small" style=${{ padding: '8px 10px' }}><span className="row wrap tight"><${UI.AIChip} label="Suggested owner" /><b>${s.athlete.name}</b><span className="faint">${Math.round(s.confidence * 100)}% match</span></span><div className="tiny muted" style=${{ marginTop: 3 }}>${s.reasons.join(' · ')}</div></div>`}
      </div>
      ${canSci() ? html`<div className="row tight wrap" style=${{ marginLeft: 'auto' }}>
        <${UI.Select} value=${pick} onChange=${setPick} options=${cands.map((a) => ({ value: a.id, label: a.name + ' · ' + AMS.org.squad(a.squadId).name }))} placeholder="Choose athlete" style=${{ maxWidth: 220 }} />
        <button className="btn sm primary" disabled=${!pick} onClick=${() => AMS.runAction('device.match', { serial: d.serial, athleteId: pick })}><${UI.Icon} name="link" size=${13} />Match</button>
      </div>` : html`<${LockNote} text=${LOCK_SCI} />`}
    </div>`;
  }
  function WearablesTab({ v }) {
    const w = W();
    const [showResolved, setShowResolved] = useState(false);
    const devs = w.devices.filter(deviceVisible);
    const unmatched = devs.filter((d) => !d.athleteId && d.status === 'Unmatched');
    const lowBatt = devs.filter((d) => d.athleteId && d.status === 'Active' && d.battery < 20);
    const dq = w.dataQuality.filter((q) => (showResolved || q.status === 'Open') && (!q.centreId || deviceVisible({ centreId: q.centreId })));
    const centres = useMemo(() => {
      const list = AMS.scopedAthletes();
      const by = AMS.groupBy(list, 'centreId');
      return Object.entries(by).map(([cid, as]) => {
        const gps = as.filter((a) => gpsOf(a.id).length).length, hrv = as.filter((a) => bioOf(a.id)).length;
        const listed = as.filter((a) => a.devices.includes('Catapult Vector') || a.devices.includes('WHOOP 4.0')).length;
        const gap = !CAT_CENTRES.includes(cid) && as.some((a) => a.devices.includes('Catapult Vector')) ? 'Catapult units listed but centre not on licence' : !WHOOP_CENTRES.includes(cid) && !GARMIN_CENTRES.includes(cid) && as.some((a) => a.devices.includes('WHOOP 4.0')) ? 'Personal WHOOPs not linked to team account' : '';
        return { id: cid, centre: AMS.org.centre(cid), n: as.length, gps, hrv, listed, cov: Math.round((Math.max(gps, hrv) / as.length) * 100), gap };
      }).sort((a, b) => b.n - a.n);
    }, [v]);
    return html`<div className="col loose">
      <div className="grid g4">${w.connectors.map((c) => html`<${ConnectorCard} key=${c.id} c=${c} />`)}</div>
      <div className="grid g-main">
        <${UI.Card} title="Unmatched devices" icon="link" hint=${unmatched.length + ' recording without an athlete'} flush>
          ${unmatched.length ? html`<div className="list">${unmatched.map((d) => html`<${UnmatchedRow} key=${d.serial} d=${d} />`)}</div>` : html`<${UI.Empty} icon="check" title="Every active device is paired">New units appear here the first time they sync.<//>`}
        <//>
        <${UI.Card} title="Device fleet" icon="watch" hint=${devs.filter((d) => d.status !== 'Retired').length + ' in scope'}>
          <div className="col">
            <${UI.HBars} data=${['Catapult', 'WHOOP', 'Polar', 'Garmin'].map((vd, i) => ({ label: vd, value: devs.filter((d) => d.vendor === vd && d.status !== 'Retired').length, tone: UI.CAT[i] }))} labelWidth=${80} />
            <div className="divider" />
            <div className="row between small"><span className="muted">Low battery (under 20%)</span><b className=${lowBatt.length ? 'warn' : ''}>${lowBatt.length}</b></div>
            ${lowBatt.slice(0, 4).map((d) => html`<div key=${d.serial} className="row between tiny"><span className="ellipsis">${(AMS.org.athlete(d.athleteId) || {}).name} · ${d.vendor}</span><span className="warn">${d.battery}%</span></div>`)}
            <div className="row between small"><span className="muted">Retired this month</span><b>${devs.filter((d) => d.status === 'Retired').length}</b></div>
          </div>
        <//>
      </div>
      <div className="grid g2">
        <${UI.Card} title="Data-quality issues" icon="alert" hint=${w.dataQuality.filter((q) => q.status === 'Open').length + ' open'} actions=${html`<${UI.Toggle} checked=${showResolved} onChange=${setShowResolved} label="Show resolved" id="sci-dq-res" />`} flush>
          ${dq.length ? html`<div className="list">${dq.map((q) => { const con = w.connectors.find((c) => c.id === q.connectorId); return html`<div key=${q.id} className=${'list-item sev-stripe ' + (q.status === 'Open' ? q.severity : 'good')} style=${{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="col tight grow" style=${{ gap: 3, minWidth: 220 }}>
              <div className="row wrap tight"><b className="small">${q.title}</b><span className="tag">${con ? con.vendor : ''}</span><span className="tiny faint">${D.fmt(q.raised)}</span>${q.status === 'Resolved' && html`<${UI.Pill} tone="good">Resolved · ${q.resolution}<//>`}</div>
              <div className="small muted">${q.text}</div>
              ${q.athleteIds.length > 0 && html`<div className="tiny faint">${q.athleteIds.map((id) => (AMS.org.athlete(id) || {}).name).filter(Boolean).join(', ')}</div>`}
            </div>
            ${q.status === 'Open' && (canSci() ? html`<div className="row tight wrap">
              ${q.kind ? html`<button className="btn sm" onClick=${() => AMS.runAction('connector.sync', { connectorId: q.connectorId })}><${UI.Icon} name="refresh" size=${13} />Sync ${con.vendor}</button>` : html`<button className="btn sm" onClick=${() => AMS.runAction('dq.resolve', { id: q.id, resolution: 'Re-imported' })}>Re-import</button>`}
              <${UI.Menu} items=${[{ label: 'Mark data as verified', icon: 'check', onClick: () => AMS.runAction('dq.resolve', { id: q.id, resolution: 'Verified' }) }, { label: 'Exclude from load analysis', icon: 'eye', onClick: () => AMS.runAction('dq.resolve', { id: q.id, resolution: 'Excluded from analysis' }) }, { label: 'Merge files', icon: 'merge', onClick: () => AMS.runAction('dq.resolve', { id: q.id, resolution: 'Files merged' }) }]} />
            </div>` : null)}
          </div>`; })}</div>` : html`<${UI.Empty} icon="check" title="No open data issues" />`}
        <//>
        <${UI.Card} title="Coverage by centre" icon="building" hint="Who has objective data behind their readiness" flush>
          <${UI.Table} compact rows=${centres} columns=${[
            { key: 'c', label: 'Centre', render: (r) => html`<span className="col tight" style=${{ gap: 0 }}><b className="small">${r.centre.short}</b>${r.gap && html`<span className="tiny warn">${r.gap}</span>`}</span>`, sort: (r) => r.centre.short },
            { key: 'n', label: 'Athletes', num: true },
            { key: 'gps', label: 'GPS', num: true },
            { key: 'hrv', label: 'HRV', num: true },
            { key: 'cov', label: 'Coverage', render: (r) => html`<span className="row tight"><${UI.Meter} value=${r.cov} tone=${r.cov >= 60 ? 'good' : r.cov >= 30 ? 'warn' : 'bad'} style=${{ width: 60 }} /><span className="tiny tnum">${r.cov}%</span></span>` },
          ]} />
        <//>
      </div>
    </div>`;
  }

  /* ================================================================== GPS tab */
  function GpsTab({ data, selected, setSelected }) {
    const withGps = data.athletes.filter((a) => gpsOf(a.id).length);
    const squads = squadOptions(withGps);
    const [squad, setSquad] = UI.useLocal('sci:gps-squad', '');
    const sq = squads.find((s) => s.value === squad) ? squad : (squads.find((s) => s.value === 'SQ-PUN-SPR17') || squads[0] || {}).value;
    const members = withGps.filter((a) => a.squadId === sq);
    const dates = [...new Set(members.flatMap((a) => gpsOf(a.id).map((x) => x.date)))].sort().reverse().slice(0, 6);
    const [dateSel, setDate] = useState('');
    const date = dates.includes(dateSel) ? dateSel : dates[0];
    const [metric, setMetric] = useState('hsr');
    const rows = members.map((a) => { const s = gpsOf(a.id).find((x) => x.date === date); const pm = pmaxOf(a.id); const sp = speedStats(a.id); return { id: a.id, a, s, pm, pct: s && pm ? Math.round((s.vmax / pm) * 100) : null, sp }; });
    const withS = rows.filter((r) => r.s);
    const avg = (k) => (withS.length ? AMS.mean(withS.map((r) => r.s[k])) : 0);
    const selA = (data.byId[selected] && gpsOf(selected).length ? data.byId[selected].a : null) || (members.find((a) => a.id === AMS.db.meta.heroAthleteId) || members[0]);
    if (selA) AMS.setFocus({ athleteId: selA.id });
    const g = selA ? gpsOf(selA.id) : [];
    const pmSel = selA ? pmaxOf(selA.id) : null;
    const lowExposure = withGps.filter((a) => a.availability === 'Available').map((a) => ({ a, sp: speedStats(a.id) })).filter((x) => x.sp && x.sp.pct7 != null && x.sp.pct7 < 90).sort((x, y) => x.sp.pct7 - y.sp.pct7);
    const METRICS = [{ id: 'hsr', label: 'HSR', unit: 'm' }, { id: 'totalDistance', label: 'Distance', unit: 'm' }, { id: 'sprintDist', label: 'Sprint', unit: 'm' }, { id: 'vmax', label: 'Vmax', unit: 'km/h' }, { id: 'playerLoad', label: 'Player load', unit: '' }];
    const mt = METRICS.find((m) => m.id === metric);
    const sess = date && AMS.db.sessions.find((s) => s.squadId === sq && s.date === date);
    if (!sq) return html`<${UI.Card} title="GPS analytics"><${UI.Empty} icon="gps" title="No GPS data in this scope">Catapult is licensed at ${CAT_CENTRES.map((c) => AMS.org.centre(c).short).join(', ')}.<//><//>`;
    return html`<div className="col loose">
      <div className="row wrap between">
        <div className="row wrap tight">
          <${UI.Select} value=${sq} onChange=${(x) => { setSquad(x); setDate(''); }} options=${squads} />
          <${UI.Seg} value=${date} onChange=${setDate} options=${dates.map((d) => ({ id: d, label: D.dow(d) + ' ' + d.slice(8) }))} size="sm" />
        </div>
        <span className="small muted">${sess ? sess.title + ' · ' + sess.duration + ' min · ' + sess.location : 'Competition / trial day'} · ${withS.length}/${members.length} units</span>
      </div>
      <div className="grid g5">
        <${UI.KPI} label="Avg distance" value=${fmtN(avg('totalDistance'))} unit="m" icon="run" />
        <${UI.KPI} label="Avg HSR (>19.8 km/h)" value=${fmtN(avg('hsr'))} unit="m" icon="zap" />
        <${UI.KPI} label="Avg sprint (>25 km/h)" value=${fmtN(avg('sprintDist'))} unit="m" icon="bolt" />
        <${UI.KPI} label="Squad top speed" value=${withS.length ? Math.max(...withS.map((r) => r.s.vmax)).toFixed(1) : '—'} unit="km/h" icon="gps" />
        <${UI.KPI} label="Hit ≥ 90% max speed" value=${withS.filter((r) => r.pct >= 90).length + '/' + withS.length} foot="max-velocity exposure" icon="target" />
      </div>
      <${UI.Card} title="Session analytics" icon="gps" hint=${D.fmtLong(date || AMS.TODAY)} flush>
        <${UI.Table} compact rows=${rows} onRow=${(r) => setSelected(r.id)} selectedId=${selA && selA.id} initialSort=${{ key: 'hsr', dir: 'desc' }} columns=${[
          { key: 'name', label: 'Athlete', render: (r) => html`<${UI.AthleteCell} athlete=${r.a} size=${26} sub=${r.a.availability !== 'Available' ? AMS.medicalLabel(AMS.db.injuries.find((i) => i.athleteId === r.id && i.status !== 'Closed')) || r.a.availability : r.a.events} />`, sort: (r) => r.a.name },
          { key: 'dist', label: 'Distance m', num: true, sort: (r) => (r.s ? r.s.totalDistance : -1), render: (r) => (r.s ? fmtN(r.s.totalDistance) : html`<span className="faint">no file</span>`) },
          { key: 'hsr', label: 'HSR m', num: true, sort: (r) => (r.s ? r.s.hsr : -1), render: (r) => (r.s ? fmtN(r.s.hsr) : '—') },
          { key: 'spr', label: 'Sprint m', num: true, sort: (r) => (r.s ? r.s.sprintDist : -1), render: (r) => (r.s ? fmtN(r.s.sprintDist) : '—') },
          { key: 'vmax', label: 'Vmax', num: true, sort: (r) => (r.s ? r.s.vmax : -1), render: (r) => (r.s ? r.s.vmax.toFixed(1) : '—') },
          { key: 'pct', label: '% personal max', sort: (r) => r.pct || 0, render: (r) => (r.pct != null ? html`<span className="row tight"><${UI.Meter} value=${r.pct} tone=${r.pct >= 90 ? 'good' : r.pct >= 80 ? 'warn' : 'bad'} style=${{ width: 56 }} /><span className="tiny tnum">${r.pct}%</span></span>` : '—') },
          { key: 'acc', label: 'Acc / Dec', num: true, hideSm: true, sort: (r) => (r.s ? r.s.accels : -1), render: (r) => (r.s ? r.s.accels + ' / ' + r.s.decels : '—') },
          { key: 'pl', label: 'Player load', num: true, hideSm: true, sort: (r) => (r.s ? r.s.playerLoad : -1), render: (r) => (r.s ? fmtN(r.s.playerLoad) : '—') },
          { key: 'trend', label: 'Speed vs baseline', hideSm: true, sort: (r) => (r.sp ? r.sp.drop : 0), render: (r) => (r.sp ? html`<span className=${r.sp.drop <= -5 ? 'bad' : r.sp.drop <= -3 ? 'warn' : 'faint'} style=${{ fontWeight: r.sp.drop <= -5 ? 600 : 400 }}>${r.sp.drop > 0 ? '+' : ''}${r.sp.drop}%</span>` : '—') },
        ]} />
      <//>
      <div className="grid g2">
        <${UI.Card} title="Squad comparison" icon="chart" actions=${html`<${UI.Seg} value=${metric} onChange=${setMetric} size="sm" options=${METRICS.map((m) => ({ id: m.id, label: m.label }))} />`}>
          ${withS.length ? html`<${UI.HBars} labelWidth=${130} format=${(x) => (metric === 'vmax' ? x.toFixed(1) : fmtN(x))} data=${withS.slice().sort((x, y) => y.s[metric] - x.s[metric]).map((r) => ({ label: r.a.name, value: r.s[metric], tone: r.id === (selA && selA.id) ? 'accent' : r.s[metric] > avg(metric) * 1.25 ? 'warn' : 'cat-5', onClick: () => setSelected(r.id) }))} />
          <div className="tiny faint" style=${{ marginTop: 8 }}>Squad average ${metric === 'vmax' ? avg(metric).toFixed(1) : fmtN(avg(metric))} ${mt.unit}. Amber = more than 25% above the squad average.</div>` : html`<${UI.Empty} title="No files for this session" />`}
        <//>
        ${selA && html`<${UI.Card} title=${'Trend — ' + selA.name} icon="trend-up" hint=${pmSel ? 'personal max ' + pmSel + ' km/h' : ''} actions=${html`<button className="btn ghost sm" onClick=${() => AMS.openAthlete(selA.id, 'science')}>Profile</button>`}>
          <${UI.LineChart} height=${170} series=${[{ name: 'Vmax km/h', data: g.map((x) => ({ x: D.fmt(x.date), y: x.vmax })), tone: 'accent', area: false }]} refs=${pmSel ? [{ y: pmSel, label: 'Personal max', tone: 'good' }, { y: AMS.round(pmSel * 0.9, 1), label: '90%', tone: 'warn' }] : []} yFormat=${(x) => AMS.round(x, 1)} />
          <${UI.BarChart} height=${150} data=${g.map((x) => ({ label: D.fmt(x.date), values: [x.hsr, x.sprintDist] }))} keys=${[{ name: 'HSR m', tone: 'cat-1' }, { name: 'Sprint m', tone: 'cat-3' }]} />
        <//>`}
      </div>
      <${UI.Card} ai title="Max-velocity exposure" hint="Athletes not reaching 90% of personal max in 7 days carry higher hamstring risk when they next sprint flat-out">
        ${lowExposure.length ? html`<div className="col tight">
          ${lowExposure.slice(0, 6).map((x) => html`<div key=${x.a.id} className="row between wrap" style=${{ gap: 8 }}>
            <${UI.AthleteCell} athlete=${x.a} size=${26} sub=${'7-day peak ' + x.sp.pct7 + '% of ' + x.sp.pmax + ' km/h'} />
            <button className="btn sm" onClick=${() => AMS.runAction('notify', { toRole: 'coach', athleteId: x.a.id, text: x.a.name + ' has not exceeded ' + x.sp.pct7 + '% of max velocity in 7 days. Add 2–3 × flying 20 m at 95% this week.' })}><${UI.Icon} name="send" size=${13} />Suggest flying 20s to coach</button>
          </div>`)}
        </div>` : html`<div className="small muted">Every available athlete in scope touched ≥ 90% of personal max this week.</div>`}
      <//>
    </div>`;
  }

  /* ================================================================== RECOVERY tab */
  function InterventionForm({ athletes, defaultId }) {
    const [aid, setAid] = useState(defaultId || (athletes[0] && athletes[0].id) || '');
    const [type, setType] = useState('Nap');
    const [dur, setDur] = useState('20');
    const [status, setStatus] = useState('Prescribed');
    const [note, setNote] = useState('');
    useEffect(() => { if (defaultId) setAid(defaultId); }, [defaultId]);
    if (!canRecovery()) return html`<${LockNote} text="Recovery work is logged by sports science and physio staff." />`;
    return html`<div className="col">
      <div className="grid g2" style=${{ gap: 10 }}>
        <${UI.Field} label="Athlete"><${UI.Select} value=${aid} onChange=${setAid} options=${athletes.map((a) => ({ value: a.id, label: a.name }))} /><//>
        <${UI.Field} label="Intervention"><${UI.Select} value=${type} onChange=${(t) => { setType(t); setDur(String((INTERVENTIONS.find((x) => x.id === t) || {}).dur || 0)); }} options=${INTERVENTIONS.map((x) => x.id)} /><//>
        <${UI.Field} label="Duration (min)"><input className="input" type="number" min="0" max="120" value=${dur} onChange=${(e) => setDur(e.target.value)} /><//>
        <${UI.Field} label="Status"><${UI.Seg} value=${status} onChange=${setStatus} options=${['Prescribed', 'Completed']} size="sm" /><//>
      </div>
      <${UI.Field} label="Note" help=${(INTERVENTIONS.find((x) => x.id === type) || {}).note}><input className="input" value=${note} onChange=${(e) => setNote(e.target.value)} placeholder="Optional — e.g. after sprint session" /><//>
      <div className="row"><button className="btn primary" disabled=${!aid} onClick=${() => { AMS.runAction('recovery.log', { athleteId: aid, type, durationMin: +dur || 0, status, note: note || undefined }); setNote(''); }}><${UI.Icon} name="plus" size=${14} />${status === 'Prescribed' ? 'Prescribe' : 'Log completed'}</button></div>
    </div>`;
  }
  function RecoveryTab({ data, selected, setSelected, v }) {
    const w = W();
    const withBio = data.athletes.filter((a) => bioOf(a.id));
    const selA = (selected && bioOf(selected) && AMS.org.athlete(selected)) || withBio.find((a) => a.id === AMS.db.meta.heroAthleteId) || withBio.slice().sort((x, y) => ((hrvStats(x.id) || {}).z || 0) - ((hrvStats(y.id) || {}).z || 0))[0];
    if (selA) AMS.setFocus({ athleteId: selA.id });
    const b = selA ? bioOf(selA.id) : null, h = selA ? hrvStats(selA.id) : null;
    const xs = AMS.date.range(AMS.date.add(AMS.TODAY, -27), 28).map((d) => D.fmt(d));
    const ids = new Set(data.athletes.map((a) => a.id));
    const ivs = w.interventions.filter((x) => ids.has(x.athleteId) && D.diff(AMS.TODAY, x.date) <= 14).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
    const [ivFilter, setIvFilter] = useState('all');
    const shownIvs = ivs.filter((x) => ivFilter === 'all' || x.status === ivFilter);
    const adherence = useMemo(() => {
      const by = AMS.groupBy(ivs.filter((x) => x.status !== 'Prescribed'), 'athleteId');
      return Object.entries(by).map(([id, l]) => ({ a: AMS.org.athlete(id), done: l.filter((x) => x.status === 'Completed').length, total: l.length })).filter((x) => x.a && x.total >= 2).map((x) => Object.assign(x, { pct: Math.round((x.done / x.total) * 100) })).sort((x, y) => x.pct - y.pct);
    }, [v, data]);
    const totalDone = ivs.filter((x) => x.status === 'Completed').length, totalClosed = ivs.filter((x) => x.status !== 'Prescribed').length;
    const squadRows = withBio.map((a) => ({ id: a.id, a, h: hrvStats(a.id) })).filter((r) => r.h);
    return html`<div className="col loose">
      <div className="grid g-main">
        <${UI.Card} title=${selA ? 'HRV, heart rate & sleep — ' + selA.name : 'HRV & sleep'} icon="heart" hint=${h ? h.src + ' · overnight' : ''} actions=${html`<${UI.Select} value=${selA ? selA.id : ''} onChange=${setSelected} options=${withBio.map((a) => ({ value: a.id, label: a.name }))} />`}>
          ${b && h ? html`<div className="col">
            <div className="grid g4 keep" style=${{ gap: 10 }}>
              <div className="col tight" style=${{ gap: 0 }}><span className="upper">HRV (rMSSD)</span><span className=${'num ' + (h.z <= -2 ? 'bad' : h.z <= -1 ? 'warn' : '')} style=${{ fontSize: 24 }}>${h.latest}<small className="faint" style=${{ fontSize: 13 }}> ms</small></span><span className="tiny faint">${h.z > 0 ? '+' : ''}${h.z} SD vs ${Math.round(h.mean)} normal${h.stale ? ' · not synced today' : ''}</span></div>
              <div className="col tight" style=${{ gap: 0 }}><span className="upper">Resting HR</span><span className=${'num ' + (h.rhrDelta >= 7 ? 'bad' : h.rhrDelta >= 4 ? 'warn' : '')} style=${{ fontSize: 24 }}>${h.rhrLatest == null ? '—' : h.rhrLatest}<small className="faint" style=${{ fontSize: 13 }}> bpm</small></span><span className="tiny faint">${h.rhrDelta == null ? '' : (h.rhrDelta >= 0 ? '+' : '') + h.rhrDelta + ' vs normal'}</span></div>
              <div className="col tight" style=${{ gap: 0 }}><span className="upper">Sleep (3 nights)</span><span className=${'num ' + (h.sleep3 < 6 ? 'bad' : h.sleep3 < 7 ? 'warn' : '')} style=${{ fontSize: 24 }}>${h.sleep3 == null ? '—' : h.sleep3}<small className="faint" style=${{ fontSize: 13 }}> h</small></span><span className="tiny faint">target 8–9 h</span></div>
              <div className="col tight" style=${{ gap: 0 }}><span className="upper">Recovery</span><span className=${'num ' + (h.recovery < 34 ? 'bad' : h.recovery < 67 ? 'warn' : 'good')} style=${{ fontSize: 24 }}>${h.recovery == null ? '—' : h.recovery}<small className="faint" style=${{ fontSize: 13 }}>%</small></span><span className="tiny faint">${h.src} score</span></div>
            </div>
            <${UI.LineChart} height=${190} series=${[{ name: 'HRV ms', data: b.hrv.map((y, i) => ({ x: xs[i], y })), tone: 'cat-4' }]} bands=${[{ from: h.mean - h.sd, to: h.mean + h.sd, tone: 'good', label: 'Own normal ±1 SD' }]} refs=${[{ y: AMS.round(h.mean - 2 * h.sd, 0), label: '−2 SD', tone: 'bad' }]} />
            <div className="grid g2">
              <${UI.LineChart} height=${140} series=${[{ name: 'Resting HR', data: b.rhr.map((y, i) => ({ x: xs[i], y })), tone: 'bad' }]} refs=${[{ y: Math.round(h.rhrBase), label: 'normal', tone: 'fg-3' }]} />
              <${UI.BarChart} height=${140} data=${b.sleep.map((y, i) => ({ label: xs[i], value: y || 0, tone: y != null && y < 6 ? 'bad' : y != null && y < 7 ? 'warn' : 'cat-2' }))} refY=${8} refLabel="8 h" yFormat=${(x) => AMS.round(x, 1)} />
            </div>
            <${ActionsFor} a=${selA} reason=${'HRV ' + h.z + ' SD vs own normal, sleep ' + h.sleep3 + ' h'} />
          </div>` : html`<${UI.Empty} icon="watch" title="No HRV device in this scope">HRV comes from WHOOP (${WHOOP_CENTRES.map((c) => AMS.org.centre(c).short).join(', ')}) and Garmin (national camp).<//>`}
        <//>
        <${UI.Card} title="Prescribe / log recovery" icon="plus">
          <${InterventionForm} athletes=${data.athletes} defaultId=${selA && selA.id} />
          <div className="divider" style=${{ margin: '12px 0' }} />
          <div className="col tight">
            <div className="row between small"><span className="muted">Adherence (14 days)</span><b className=${totalClosed && totalDone / totalClosed < 0.75 ? 'warn' : 'good'}>${totalClosed ? Math.round((totalDone / totalClosed) * 100) : 0}%</b></div>
            <${UI.Meter} value=${totalDone} max=${totalClosed || 1} tone=${totalClosed && totalDone / totalClosed < 0.75 ? 'warn' : 'good'} />
            <div className="tiny faint">${totalDone} completed of ${totalClosed} prescribed · ${ivs.filter((x) => x.status === 'Prescribed').length} open</div>
            ${adherence.slice(0, 4).map((x) => html`<div key=${x.a.id} className="row between tiny"><span className="ellipsis clickable" onClick=${() => setSelected(x.a.id)}>${x.a.name}</span><span className=${x.pct < 60 ? 'bad' : x.pct < 80 ? 'warn' : 'good'}>${x.done}/${x.total} · ${x.pct}%</span></div>`)}
          </div>
        <//>
      </div>
      <div className="grid g2">
        <${UI.Card} title="Recovery interventions" icon="clipboard" hint=${ivs.length + ' in 14 days'} actions=${html`<${UI.Seg} size="sm" value=${ivFilter} onChange=${setIvFilter} options=${['all', 'Prescribed', 'Completed', 'Missed'].map((x) => ({ id: x, label: x === 'all' ? 'All' : x }))} />`} flush>
          <${UI.Table} compact maxHeight=${380} rows=${shownIvs} empty="No interventions logged" columns=${[
            { key: 'date', label: 'When', render: (x) => html`<span className="tiny tnum">${D.fmt(x.date)} ${x.time}</span>`, sort: (x) => x.date + x.time },
            { key: 'a', label: 'Athlete', render: (x) => html`<${UI.AthleteCell} athlete=${AMS.org.athlete(x.athleteId)} size=${24} sub=${x.note || ''} />`, sort: (x) => (AMS.org.athlete(x.athleteId) || {}).name },
            { key: 'type', label: 'Type', render: (x) => html`<span className="row tight"><${UI.Icon} name=${(INTERVENTIONS.find((i) => i.id === x.type) || {}).icon || 'heart'} size=${13} />${x.type}${x.durationMin ? html`<span className="faint tiny">${x.durationMin}′</span>` : null}</span>` },
            { key: 'status', label: 'Status', render: (x) => x.status === 'Prescribed' && canRecovery() ? html`<span className="row tight"><button className="btn xs good" onClick=${(e) => { e.stopPropagation(); AMS.runAction('recovery.status', { id: x.id, status: 'Completed' }); }}>Done</button><button className="btn xs" onClick=${(e) => { e.stopPropagation(); AMS.runAction('recovery.status', { id: x.id, status: 'Missed' }); }}>Missed</button></span>` : html`<${UI.Pill} tone=${x.status === 'Completed' ? 'good' : x.status === 'Missed' ? 'bad' : 'info'}>${x.status}<//>` },
            { key: 'by', label: 'By', hideSm: true, render: (x) => html`<span className="tiny faint">${x.by}</span>` },
          ]} />
        <//>
        <${UI.Card} title="Squad overnight recovery" icon="moon" hint="Sorted by HRV vs own normal" flush>
          <${UI.Table} compact maxHeight=${380} rows=${squadRows} onRow=${(r) => setSelected(r.id)} selectedId=${selA && selA.id} initialSort=${{ key: 'z', dir: 'asc' }} columns=${[
            { key: 'a', label: 'Athlete', render: (r) => html`<${UI.AthleteCell} athlete=${r.a} size=${24} />`, sort: (r) => r.a.name },
            { key: 'z', label: 'HRV z', num: true, sort: (r) => r.h.z, render: (r) => html`<span className=${r.h.z <= -2 ? 'bad' : r.h.z <= -1 ? 'warn' : ''} style=${{ fontWeight: r.h.z <= -2 ? 600 : 400 }}>${r.h.stale ? html`<span className="faint tiny">no sync</span>` : (r.h.z > 0 ? '+' : '') + r.h.z}</span>` },
            { key: 'rhr', label: 'RHR Δ', num: true, sort: (r) => r.h.rhrDelta || 0, render: (r) => (r.h.rhrDelta == null || r.h.stale ? '—' : (r.h.rhrDelta >= 0 ? '+' : '') + r.h.rhrDelta) },
            { key: 'sl', label: 'Sleep 3n', num: true, sort: (r) => r.h.sleep3 || 0, render: (r) => (r.h.sleep3 == null ? '—' : html`<span className=${r.h.sleep3 < 6 ? 'bad' : r.h.sleep3 < 7 ? 'warn' : ''}>${r.h.sleep3} h</span>`) },
            { key: 'rec', label: 'Recovery', num: true, hideSm: true, sort: (r) => r.h.recovery || 0, render: (r) => (r.h.recovery == null || r.h.stale ? '—' : r.h.recovery + '%') },
          ]} />
        <//>
      </div>
    </div>`;
  }

  /* ================================================================== RISK tab */
  function StackBar({ parts, max }) {
    const m = max || 100;
    return html`<span className="sci-stack" title=${parts.map((p) => p.label + ': +' + p.points).join('\n')}>${parts.map((p) => html`<span key=${p.key} style=${{ width: (p.points / m) * 100 + '%', background: UI.color(p.tone) }} />`)}</span>`;
  }
  function AnomalyRow({ x }) {
    const a = AMS.org.athlete(x.athleteId);
    const rev = W().reviewed[x.key];
    const s = AMS.todaySessionFor(a);
    const mod = s && s.mods && s.mods[a.id];
    const done = (label) => AMS.runAction('science.review', { key: x.key, athleteId: a.id, title: x.title, label });
    return html`<div className=${'list-item sev-stripe ' + ({ high: 'bad', med: 'warn', low: 'info' }[x.severity])} style=${{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div className="col tight grow" style=${{ gap: 3, minWidth: 220 }}>
        <div className="row wrap tight"><${UI.AthleteCell} athlete=${a} size=${24} sub=${x.title} /></div>
        <div className="small muted">${x.detail}</div>
        ${rev && html`<span className="tiny good row tight"><${UI.Icon} name="check" size=${12} />${rev.action} · ${rev.by} ${rev.at}</span>`}
      </div>
      ${!rev && html`<div className="row tight wrap">
        ${canTrain() && s && !mod && html`<button className="btn sm ai" onClick=${() => { AMS.runAction('session.modifyForAthlete', { athleteId: a.id, sessionId: s.id, variant: x.kind === 'speed' ? 'reduced' : 'recovery' }); done('Session adjusted'); }}><${UI.Icon} name="zap" size=${13} />${x.kind === 'speed' ? 'Reduce volume' : 'Recovery session'}</button>`}
        ${canRecovery() && (x.kind === 'hrv' || x.kind === 'sleep' || x.kind === 'rhr') && html`<button className="btn sm ai" onClick=${() => { AMS.runAction('recovery.log', { athleteId: a.id, type: x.kind === 'sleep' ? 'Sleep hygiene' : 'Nap', status: 'Prescribed', reason: x.title }); done('Recovery prescribed'); }}><${UI.Icon} name="moon" size=${13} />Prescribe recovery</button>`}
        ${!canTrain() && html`<button className="btn sm" onClick=${() => { AMS.runAction('notify', { toRole: x.kind === 'speed' ? 'physio' : 'coach', athleteId: a.id, text: a.name + ': ' + x.title + ' — ' + x.detail + '.' }); done('Sent to ' + (x.kind === 'speed' ? 'physio' : 'coach')); }}><${UI.Icon} name="send" size=${13} />${x.kind === 'speed' ? 'Ask physio to screen' : 'Tell coach'}</button>`}
        <button className="btn sm ghost" onClick=${() => done('Reviewed — no action')}>Reviewed</button>
      </div>`}
    </div>`;
  }
  function RiskTab({ data, onPick, v }) {
    const w = W();
    const [thr, setThr] = useState(w.model.threshold);
    const [showAll, setShowAll] = useState(false);
    useEffect(() => { setThr(w.model.threshold); }, [w.model.threshold]);
    const ranked = data.rows.slice().sort((x, y) => y.risk.score - x.risk.score);
    const flagged = ranked.filter((r) => r.risk.score >= thr);
    const shown = showAll ? ranked : ranked.slice(0, Math.max(12, flagged.length));
    const maxPts = Math.max(60, ...ranked.slice(0, 1).map((r) => AMS.sum(r.risk.parts.map((p) => p.points))));
    const anoms = useMemo(() => anomalies(data.athletes), [v, data]);
    const open = anoms.filter((x) => !w.reviewed[x.key]);
    const totals = FACTORS.map((f) => ({ label: f.label, value: AMS.round(AMS.sum(flagged.map((r) => (r.risk.parts.find((p) => p.key === f.key) || {}).points || 0)), 0), tone: f.tone })).filter((x) => x.value > 0).sort((x, y) => y.value - x.value);
    return html`<div className="col loose">
      <div className="grid g-main">
        <${UI.Card} ai title="Predicted injury risk — next 7 days" hint=${flagged.length + ' of ' + ranked.length + ' at or above ' + thr} flush actions=${html`<div className="row tight">
          <span className="tiny faint">Alert at</span>
          <input type="range" min="30" max="85" step="5" value=${thr} onChange=${(e) => setThr(+e.target.value)} aria-label="Risk alert threshold" style=${{ width: 110 }} />
          <b className="small tnum" style=${{ width: 22 }}>${thr}</b>
          ${thr !== w.model.threshold && (canSci() ? html`<button className="btn xs primary" onClick=${() => AMS.runAction('science.threshold', { value: thr })}>Save</button>` : html`<span className="tiny faint">preview only</span>`)}
        </div>`}>
          <div className="tbl-wrap"><table className="tbl compact">
            <thead><tr><th style=${{ width: 32 }}>#</th><th>Athlete</th><th className="num">Score</th><th>Why (contribution)</th><th className="hide-sm">Top factors</th><th className="hide-sm">Today</th></tr></thead>
            <tbody>${shown.map((r, i) => html`<tr key=${r.id} className="clickable" onClick=${() => onPick(r.id)} style=${{ cursor: 'pointer', opacity: r.risk.score >= thr ? 1 : 0.62 }}>
              <td className="tiny faint">${i + 1}</td>
              <td><${UI.AthleteCell} athlete=${r.a} size=${26} /></td>
              <td className="num"><${UI.Pill} tone=${r.risk.score >= thr ? r.risk.band === 'good' ? 'warn' : r.risk.band : ''}>${r.risk.score}<//></td>
              <td style=${{ minWidth: 140 }}><${StackBar} parts=${r.risk.parts} max=${maxPts} /></td>
              <td className="hide-sm"><span className="row wrap tight">${r.risk.parts.slice(0, 2).map((p) => html`<span key=${p.key} className="evidence"><span className="dot" style=${{ width: 6, height: 6, background: UI.color(p.tone) }} />${p.label} <b>${p.value}</b></span>`)}${!r.risk.parts.length && html`<span className="tiny faint">No factors above own normal</span>`}</span></td>
              <td className="hide-sm"><${UI.Pill} tone=${r.rd.band}>${r.rd.score}<//></td>
            </tr>`)}</tbody>
          </table></div>
          <div className="card-b row between wrap" style=${{ borderTop: '1px solid var(--border)' }}>
            <div className="legend">${FACTORS.map((f) => html`<span key=${f.key}><i style=${{ background: UI.color(f.tone) }} />${f.label}</span>`)}</div>
            ${ranked.length > shown.length || showAll ? html`<button className="btn ghost sm" onClick=${() => setShowAll(!showAll)}>${showAll ? 'Show flagged only' : 'Show all ' + ranked.length}</button>` : null}
          </div>
        <//>
        <div className="col">
          <${UI.Card} ai title="Model card" hint=${'v' + MODEL.version}>
            <div className="col" style=${{ gap: 10 }}>
              <div className="small"><b>${MODEL.name}</b> · ${MODEL.owner}</div>
              <${UI.DL} cols=${2} items=${[['Predicts', MODEL.horizon], ['Validation', 'AUC ' + MODEL.auc + ' · ' + MODEL.calibration], ['Trained on', MODEL.trained], ['Last validated', MODEL.validated]]} />
              <div><span className="upper">Inputs (each vs the athlete's own normal)</span><div className="row wrap tight" style=${{ marginTop: 4 }}>${['sRPE load → ACWR, monotony', 'Morning wellness (5 items)', 'Overnight HRV & RHR (WHOOP/Garmin)', 'GPS top speed (Catapult)', 'Sleep hours', 'Injury history (12 mo)', 'Return-to-play window'].map((x) => html`<span key=${x} className="tag">${x}</span>`)}</div></div>
              <div><span className="upper">Limitations</span><ul className="small muted" style=${{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
                <li>Advisory only — it never changes availability or medical status; a coach or physio decides.</li>
                <li>HRV and speed inputs exist only for athletes with paired devices (${Object.keys(w.bio).length} HRV, ${Object.keys(w.gps).length} GPS); others are scored on load + wellness, with lower confidence.</li>
                <li>Few under-16 and para athletes in training data; treat their scores with caution.</li>
                <li>Not a diagnosis: does not detect bone-stress or illness directly.</li>
              </ul></div>
              <div className="row between small"><span className="muted">Staff acted on AI warnings</span><b>${AMS.ai.actedRate()}%</b></div>
              ${w.model.history.length > 0 && html`<div className="tiny faint">Threshold changed ${w.model.history[0].from} → ${w.model.history[0].to} by ${w.model.history[0].by}, ${w.model.history[0].at.slice(11)}</div>`}
            </div>
          <//>
          <${UI.Card} title="What is driving flagged risk" icon="sliders">
            ${totals.length ? html`<${UI.HBars} data=${totals} labelWidth=${150} />` : html`<div className="small muted">Nobody above the threshold.</div>`}
          <//>
        </div>
      </div>
      <${UI.Card} title="Anomaly detection" icon="pulse" hint=${open.length + ' new today · HRV < −2 SD, top speed < −5%, RHR +7 bpm, sleep < 6 h × 3'} flush>
        ${anoms.length ? html`<div className="list">${anoms.map((x) => html`<${AnomalyRow} key=${x.key} x=${x} />`)}</div>` : html`<${UI.Empty} icon="check" title="No anomalies against personal baselines" />`}
      <//>
    </div>`;
  }

  /* ================================================================== page */
  const TABS = [
    { id: 'readiness', label: 'Readiness', icon: 'pulse' },
    { id: 'fatigue', label: 'Fatigue & load', icon: 'target' },
    { id: 'wearables', label: 'Wearables', icon: 'watch' },
    { id: 'gps', label: 'GPS', icon: 'gps' },
    { id: 'recovery', label: 'Recovery', icon: 'moon' },
    { id: 'risk', label: 'AI risk', icon: 'sparkles' },
  ];
  function Page({ params }) {
    const { v } = AMS.useStore();
    const p = params || {};
    const [tab, setTab] = useState(p.tab || 'readiness');
    const [selected, setSelected] = useState(p.athleteId || null);
    useEffect(() => { if (p.tab) setTab(p.tab); if (p.athleteId) setSelected(p.athleteId); }, [p.tab, p.athleteId]);
    const w = W();
    const data = useScienceData(v);
    if (!w) return html`<div className="page"><${UI.PageHead} title="Sports Science" /><${UI.Empty} title="Wearable data not loaded" /></div>`;
    const rows = data.rows;
    const reds = rows.filter((r) => r.rd.band === 'bad').length, ambers = rows.filter((r) => r.rd.band === 'warn').length;
    const jumps = rows.filter((r) => r.acwr >= 1.5).length;
    const anoms = anomalies(data.athletes);
    const covered = data.athletes.filter((a) => gpsOf(a.id).length || bioOf(a.id)).length;
    const conOk = w.connectors.filter((c) => c.status === 'Connected' && !connectorStats(c).stale).length;
    const unmatched = w.devices.filter((d) => !d.athleteId && d.status === 'Unmatched' && deviceVisible(d)).length;
    const flagged = rows.filter((r) => r.risk.score >= w.model.threshold).length;
    const pick = (id) => { setSelected(id); AMS.openAthlete(id, 'science'); };
    const counts = { readiness: reds || null, fatigue: jumps || null, wearables: unmatched + w.dataQuality.filter((q) => q.status === 'Open').length || null, risk: flagged || null, recovery: null, gps: null };
    const avg = rows.length ? Math.round(AMS.mean(rows.map((r) => r.rd.score))) : 0;
    const trend = AMS.date.range(AMS.date.add(AMS.TODAY, -6), 7).map((d, k) => { const vals = data.athletes.map((a) => dayReadiness(a, 21 + k)).filter(Boolean).map((x) => x.score); return vals.length ? Math.round(AMS.mean(vals)) : null; });
    return html`<div className="page">
      <${UI.PageHead} title="Sports Science" sub=${'Readiness, load, wearables and recovery for ' + data.athletes.length + ' athletes · Catapult import ' + syncLabel((w.connectors.find((c) => c.vendor === 'Catapult') || {}).lastSync)} actions=${html`
        <${UI.AskCopilot} prompt="Summarise readiness and load risks for today" label="Summarise today" />
        ${canSci() && html`<button className="btn" onClick=${() => w.connectors.filter((c) => connectorStats(c).stale || c.status !== 'Connected').forEach((c) => AMS.runAction('connector.sync', { connectorId: c.id }))} disabled=${conOk === w.connectors.length}><${UI.Icon} name="refresh" size=${14} />Sync stale feeds</button>`}`} />
      <div className="grid g5">
        <${UI.KPI} label="Squad readiness" value=${avg} unit="/100" spark=${trend} sparkTone=${avg >= 70 ? 'good' : 'warn'} foot=${reds + ' red · ' + ambers + ' amber'} onClick=${() => setTab('readiness')} icon="pulse" />
        <${UI.KPI} label="Load jump (ACWR ≥ 1.5)" value=${jumps} tone=${jumps ? 'bad' : ''} foot=${rows.filter((r) => r.acwr > 1.3 && r.acwr < 1.5).length + ' rising (1.3–1.5)'} onClick=${() => setTab('fatigue')} icon="trend-up" />
        <${UI.KPI} label="Anomalies vs own baseline" value=${anoms.length} tone=${anoms.some((x) => x.severity === 'high') ? 'bad' : anoms.length ? 'warn' : ''} foot=${anoms.filter((x) => x.kind === 'hrv').length + ' HRV · ' + anoms.filter((x) => x.kind === 'speed').length + ' speed'} onClick=${() => setTab('risk')} icon="sparkles" />
        <${UI.KPI} label="Wearable coverage" value=${data.athletes.length ? Math.round((covered / data.athletes.length) * 100) : 0} unit="%" foot=${covered + ' athletes with GPS or HRV'} onClick=${() => setTab('wearables')} icon="watch" />
        <${UI.KPI} label="Feeds healthy" value=${conOk + '/' + w.connectors.length} tone=${conOk < w.connectors.length ? 'warn' : 'good'} foot=${unmatched + ' unmatched device' + (unmatched === 1 ? '' : 's')} onClick=${() => setTab('wearables')} icon="refresh" />
      </div>
      <${UI.Tabs} tabs=${TABS.map((t) => Object.assign({}, t, { count: counts[t.id] }))} value=${tab} onChange=${setTab} />
      ${tab === 'readiness' && html`<${ReadinessTab} data=${data} onPick=${pick} />`}
      ${tab === 'fatigue' && html`<${FatigueTab} data=${data} selected=${selected} setSelected=${setSelected} />`}
      ${tab === 'wearables' && html`<${WearablesTab} v=${v} />`}
      ${tab === 'gps' && html`<${GpsTab} data=${data} selected=${selected} setSelected=${setSelected} />`}
      ${tab === 'recovery' && html`<${RecoveryTab} data=${data} selected=${selected} setSelected=${setSelected} v=${v} />`}
      ${tab === 'risk' && html`<${RiskTab} data=${data} onPick=${pick} v=${v} />`}
    </div>`;
  }

  /* ================================================================== athlete profile tab */
  function AthleteScienceTab({ athlete }) {
    AMS.useStore();
    const a = athlete;
    if (!a) return null;
    if (!AMS.can('readiness', 'own')) return html`<${UI.Empty} icon="lock" title="No access to load and wellness data">Your role does not include readiness data.<//>`;
    const rd = C.readiness(a), r = C.acwr(a), h = hrvStats(a.id), sp = speedStats(a.id), risk = riskModel(a);
    const base = C.wellnessBaseline(a);
    const wx = (a.wellness || []).map((w, i) => ({ x: D.fmt(AMS.series.wellDate(i)), y: w ? C.wellnessScore(w) : null }));
    const acw = C.acwrSeries(a, 28);
    const b = bioOf(a.id);
    const xs = AMS.date.range(AMS.date.add(AMS.TODAY, -27), 28).map((d) => D.fmt(d));
    const g = gpsOf(a.id), last = g[g.length - 1];
    const anoms = anomalies([a]);
    const ivs = W() ? W().interventions.filter((x) => x.athleteId === a.id).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time)).slice(0, 5) : [];
    const ins = AMS.ai.insights({ athleteId: a.id }).filter((i) => i.module === MOD).slice(0, 3);
    return html`<div className="col">
      <div className="grid g4 keep" style=${{ gap: 10 }}>
        <div className="card kpi"><div className="k-label">Readiness</div><div className="row tight"><${UI.Ring} value=${rd.score} tone=${rd.band} size=${36} /><span className=${rd.band} style=${{ fontWeight: 600 }}>${C.bandLabel(rd.band)}</span></div></div>
        <div className="card kpi"><div className="k-label">ACWR</div><div className=${'k-value ' + C.acwrBand(r)}>${r.toFixed(2)}</div><div className="k-foot">${C.acwrLabel(r)}</div></div>
        <div className="card kpi"><div className="k-label">HRV vs normal</div><div className=${'k-value ' + (h && h.z <= -2 ? 'bad' : h && h.z <= -1 ? 'warn' : '')}>${h ? (h.z > 0 ? '+' : '') + h.z : '—'}<small>SD</small></div><div className="k-foot">${h ? h.latest + ' ms · ' + h.src : 'No HRV device'}</div></div>
        <div className="card kpi"><div className="k-label">Risk model</div><div className=${'k-value ' + risk.band}>${risk.score}</div><div className="k-foot">${risk.parts[0] ? risk.parts[0].label : 'No factors'}</div></div>
      </div>
      ${ins.length > 0 && html`<div className="card ai" style=${{ overflow: 'hidden' }}><${UI.InsightList} insights=${ins} compact /></div>`}
      <${UI.Card} title="Wellness — 28 mornings" icon="pulse" hint=${'own normal ' + Math.round(base || 0)}>
        <${UI.LineChart} height=${160} yMin=${0} yMax=${100} series=${[{ name: 'Wellness', data: wx, tone: 'cat-2', area: true }]} refs=${base ? [{ y: Math.round(base), label: 'own normal', tone: 'good' }, { y: Math.round(base - 12), label: '−12', tone: 'warn' }] : []} />
      <//>
      <${UI.Card} title="Acute:chronic workload ratio" icon="trend-up" hint="0.8–1.3 sweet spot">
        <${UI.LineChart} height=${160} yMin=${0.4} yMax=${2.2} series=${[{ name: 'ACWR', data: acw.map((p) => ({ x: D.fmt(p.date), y: p.value })), tone: 'accent' }]} bands=${[{ from: 0.8, to: 1.3, tone: 'good' }, { from: 1.3, to: 1.5, tone: 'warn' }, { from: 1.5, to: 2.2, tone: 'bad' }]} />
      <//>
      ${b && h && html`<${UI.Card} title="Overnight HRV & sleep" icon="heart" hint=${h.src}>
        <${UI.LineChart} height=${150} series=${[{ name: 'HRV ms', data: b.hrv.map((y, i) => ({ x: xs[i], y })), tone: 'cat-4' }]} bands=${[{ from: h.mean - h.sd, to: h.mean + h.sd, tone: 'good' }]} refs=${[{ y: Math.round(h.mean - 2 * h.sd), label: '−2 SD', tone: 'bad' }]} />
        <${UI.BarChart} height=${110} data=${b.sleep.map((y, i) => ({ label: xs[i], value: y || 0, tone: y != null && y < 6 ? 'bad' : y != null && y < 7 ? 'warn' : 'cat-2' }))} refY=${8} refLabel="8 h" />
      <//>`}
      <${UI.Card} title="Latest GPS session" icon="gps" hint=${last ? D.fmtLong(last.date) : ''}>
        ${last ? html`<div className="col">
          <${UI.DL} cols=${4} items=${[['Distance', fmtN(last.totalDistance) + ' m'], ['HSR', fmtN(last.hsr) + ' m'], ['Sprint', fmtN(last.sprintDist) + ' m'], ['Vmax', last.vmax + ' km/h'], ['% of max', sp && sp.pmax ? Math.round((last.vmax / sp.pmax) * 100) + '%' : '—'], ['Accels / decels', last.accels + ' / ' + last.decels], ['Player load', fmtN(last.playerLoad)], ['Session', last.type]]} />
          <div className="row tight small"><span className="muted">Vmax, last ${g.length} sessions</span><${UI.Sparkline} data=${g.map((x) => x.vmax)} width=${140} height=${28} tone=${sp && sp.drop <= -5 ? 'bad' : 'accent'} />${sp && html`<span className=${sp.drop <= -5 ? 'bad' : 'faint'}>${sp.drop > 0 ? '+' : ''}${sp.drop}% vs own baseline</span>`}</div>
        </div>` : html`<div className="small muted">No GPS unit paired${a.devices.includes('Catapult Vector') && !CAT_CENTRES.includes(a.centreId) ? ' — centre not on Catapult licence' : ''}.</div>`}
      <//>
      ${(anoms.length > 0 || ivs.length > 0) && html`<${UI.Card} title="Anomalies & recovery" icon="moon">
        <div className="col tight">
          ${anoms.map((x) => html`<div key=${x.key} className="row tight small"><${UI.Dot} tone=${x.severity === 'high' ? 'bad' : 'warn'} /><b>${x.title}</b><span className="muted">${x.detail}</span></div>`)}
          ${ivs.map((x) => html`<div key=${x.id} className="row between small"><span>${D.fmt(x.date)} · ${x.type}${x.durationMin ? ' ' + x.durationMin + ' min' : ''}</span><${UI.Pill} tone=${x.status === 'Completed' ? 'good' : x.status === 'Missed' ? 'bad' : 'info'}>${x.status}<//></div>`)}
        </div>
      <//>`}
      ${AMS.ui.role !== 'athlete' && html`<${ActionsFor} a=${a} reason=${'readiness ' + rd.score + ', ACWR ' + r.toFixed(2)} />`}
    </div>`;
  }
  AMS.registerAthleteTab({ id: 'science', label: 'Load & wellness', order: 25, roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist', 'athlete'], component: AthleteScienceTab });

  /* ================================================================== live tick: late WHOOP straps trickle in */
  AMS.onTick(function (n) {
    const w = AMS.db && AMS.db.wearables;
    if (!w || n % 4 !== 0) return;
    const ids = Object.keys(w.whoopPending || {});
    if (!ids.length) return;
    const id = ids[0], b = w.bio[id], v = w.whoopPending[id];
    if (b) { b.hrv[27] = v.hrv; b.rhr[27] = v.rhr; b.sleep[27] = v.sleep; b.rec[27] = v.rec; }
    delete w.whoopPending[id];
    const d = w.devices.find((x) => x.athleteId === id && x.vendor === 'WHOOP'); if (d) d.lastSync = nowStamp();
    const q = w.dataQuality.find((x) => x.kind === 'whoop-unsynced' && x.status === 'Open');
    if (q) { q.athleteIds = q.athleteIds.filter((x) => x !== id); if (!q.athleteIds.length) { q.status = 'Resolved'; q.resolution = 'All straps synced'; q.resolvedBy = 'System'; q.resolvedAt = nowStamp(); } }
    const a = AMS.org.athlete(id);
    AMS.db.activity.unshift({ id: AMS.uid('ACT'), at: nowStamp(), text: 'WHOOP synced late for ' + (a ? a.name : id) + ' — HRV ' + v.hrv + ' ms', by: 'System', role: 'system', athleteId: id, type: 'integration' });
  });

  /* ================================================================== commands */
  [['readiness', 'Squad readiness board', 'pulse'], ['fatigue', 'Fatigue quadrant (ACWR × readiness)', 'target'], ['wearables', 'Wearable integrations & unmatched devices', 'watch'], ['gps', 'GPS session analytics', 'gps'], ['recovery', 'Recovery & HRV', 'moon'], ['risk', 'AI injury-risk model', 'sparkles']].forEach(([tab, label, icon]) => {
    AMS.registerCommand({ id: 'science.' + tab, label: 'Sports science: ' + label, group: 'Sports science', icon, keywords: 'science ' + tab + ' ' + label.toLowerCase(), roles: ['director', 'coach', 'scientist', 'physio', 'doctor'], run: () => AMS.go(MOD, { tab }) });
  });

  /* ================================================================== self-tests */
  AMS.selfTests.push({ name: 'science: Priya is flagged for HRV drop and top-speed drop vs her own baseline', role: 'scientist', fn: () => {
    const ins = AMS.ai.insights({ athleteId: 'ATH-10421' });
    if (!ins.some((i) => i.id.startsWith('sci-hrv:ATH-10421'))) throw new Error('no HRV-drop insight for Priya');
    if (!ins.some((i) => i.id.startsWith('sci-speed:ATH-10421'))) throw new Error('no speed-drop insight for Priya');
    const top = AMS.scopedAthletes().map((a) => ({ id: a.id, s: riskModel(a).score })).sort((x, y) => y.s - x.s).slice(0, 3).map((x) => x.id);
    if (!top.includes('ATH-10421')) throw new Error('Priya not in top-3 risk at Pune: ' + top.join(','));
  } });
  AMS.selfTests.push({ name: 'science: matching an unmatched Catapult unit attributes its GPS sessions', role: 'scientist', fn: () => {
    const w = AMS.db.wearables; const d = w.devices.find((x) => x.status === 'Unmatched' && x.vendor === 'Catapult' && x.centreId === 'PUN');
    if (!d) throw new Error('no unmatched Pune Catapult unit');
    const s = suggestFor(d); if (!s) throw new Error('no suggested owner');
    const before = gpsOf(s.athlete.id).length, orphan = d.orphan.gps.length;
    const ins = AMS.ai.insights().find((i) => i.id === 'sci-dev:' + d.serial);
    if (!ins) throw new Error('unmatched-device insight missing');
    AMS.runAction('device.match', { serial: d.serial, athleteId: s.athlete.id });
    if (d.athleteId !== s.athlete.id) throw new Error('device not paired');
    if (gpsOf(s.athlete.id).length !== before + orphan) throw new Error('orphan sessions not attributed');
    if (AMS.ai.insights().some((i) => i.id === 'sci-dev:' + d.serial)) throw new Error('insight still open after pairing');
  } });
  AMS.selfTests.push({ name: 'science: Garmin re-authorise + sync back-fills 3 nights and clears the stale-sync alert', role: 'scientist', fn: () => {
    const w = AMS.db.wearables; const c = w.connectors.find((x) => x.vendor === 'Garmin');
    if (!AMS.ai.insights().some((i) => i.id.startsWith('sci-sync:' + c.id))) throw new Error('stale-sync insight missing');
    const id = Object.keys(w.garminBacklog)[0]; if (!id) throw new Error('no backlog');
    AMS.runAction('connector.sync', { connectorId: c.id });
    if (c.status !== 'Connected' || c.lastSync.slice(0, 10) !== AMS.TODAY) throw new Error('connector not updated');
    if (w.bio[id].hrv[27] == null) throw new Error('night not back-filled');
    if (AMS.ai.insights().some((i) => i.id.startsWith('sci-sync:' + c.id))) throw new Error('stale insight still showing');
  } });
  AMS.selfTests.push({ name: 'science: prescribing recovery logs it, notifies and shows in the activity feed', role: 'scientist', fn: () => {
    const w = AMS.db.wearables; const n = w.interventions.length, act = AMS.db.activity.length, nt = AMS.db.notifications.length;
    AMS.runAction('recovery.log', { athleteId: 'ATH-10421', type: 'Nap', status: 'Prescribed', reason: 'HRV drop' });
    if (w.interventions.length !== n + 1 || w.interventions[0].athleteId !== 'ATH-10421') throw new Error('intervention not logged');
    if (AMS.db.activity.length <= act || AMS.db.notifications.length < nt + 2) throw new Error('no activity/notification');
    AMS.runAction('recovery.status', { id: w.interventions[0].id, status: 'Completed' });
    if (w.interventions[0].status !== 'Completed') throw new Error('status not updated');
  } });
  AMS.selfTests.push({ name: 'science: coach one-tap from HRV insight puts Priya on a recovery session', role: 'coach', fn: () => {
    const i = AMS.ai.insights({ athleteId: 'ATH-10421' }).find((x) => x.id.startsWith('sci-hrv:'));
    if (!i) throw new Error('coach does not see HRV insight');
    const act = i.actions.find((x) => x.action === 'session.modifyForAthlete' && x.payload.variant === 'recovery');
    if (!act) throw new Error('no recovery-session action');
    AMS.ai.act(i, act);
    const s = AMS.todaySessionFor(AMS.org.athlete('ATH-10421'));
    if (!s.mods['ATH-10421'] || s.mods['ATH-10421'].variant !== 'recovery') throw new Error('session not modified');
  } });
  AMS.selfTests.push({ name: 'science: resolving a data-quality issue and saving the risk threshold change state', role: 'scientist', fn: () => {
    const w = AMS.db.wearables; const q = w.dataQuality.find((x) => x.status === 'Open' && !x.kind);
    AMS.runAction('dq.resolve', { id: q.id, resolution: 'Verified' });
    if (q.status !== 'Resolved') throw new Error('issue not resolved');
    AMS.runAction('science.threshold', { value: 45 });
    if (w.model.threshold !== 45 || !w.model.history.length) throw new Error('threshold not saved');
  } });

  /* ================================================================== module registration */
  AMS.registerModule({
    id: 'science', label: 'Sports Science', icon: 'pulse', group: 'performance', order: 4, roles: ['director', 'coach', 'scientist', 'physio', 'doctor'], component: Page, short: 'Science',
    badge: () => { const w = W(); if (!w) return null; const n = w.devices.filter((d) => d.status === 'Unmatched').length + w.connectors.filter((c) => hoursSince(c.lastSync) > 24).length; return n ? { n, tone: 'warn' } : null; },
    sampleParams: [{}, { tab: 'fatigue' }, { tab: 'wearables' }, { tab: 'gps' }, { tab: 'recovery' }, { tab: 'risk' }, { tab: 'fatigue', athleteId: 'ATH-10421' }],
  });
})();
