/* USI · AMS — base demo data. Deterministic (seeded) so every reload tells the same story.
   Tenant: a fictional national athletics-led multi-sport federation. "Today" is Tue 13 Oct 2026, 07:05. */
(function () {
  'use strict';
  const AMS = window.AMS;

  const STATES = [
    { id: 'MH', name: 'Maharashtra' }, { id: 'KA', name: 'Karnataka' }, { id: 'PB', name: 'Punjab' }, { id: 'HR', name: 'Haryana' },
    { id: 'MP', name: 'Madhya Pradesh' }, { id: 'AS', name: 'Assam' }, { id: 'KL', name: 'Kerala' }, { id: 'OD', name: 'Odisha' },
  ];
  const CENTRES = [
    { id: 'PUN', stateId: 'MH', name: 'Pune High Performance Centre', short: 'Pune HPC', type: 'High Performance Centre' },
    { id: 'MUM', stateId: 'MH', name: 'Mumbai Athletics Academy', short: 'Mumbai Academy', type: 'Academy' },
    { id: 'BLR', stateId: 'KA', name: 'Bengaluru High Performance Centre', short: 'Bengaluru HPC', type: 'High Performance Centre' },
    { id: 'PAT', stateId: 'PB', name: 'Patiala National Training Centre', short: 'Patiala NTC', type: 'National Centre' },
    { id: 'SNP', stateId: 'HR', name: 'Sonipat Regional Centre', short: 'Sonipat RC', type: 'Regional Centre' },
    { id: 'BPL', stateId: 'MP', name: 'Bhopal Sports Academy', short: 'Bhopal Academy', type: 'Academy' },
    { id: 'GUW', stateId: 'AS', name: 'Guwahati Regional Centre', short: 'Guwahati RC', type: 'Regional Centre' },
    { id: 'TVM', stateId: 'KL', name: 'Thiruvananthapuram Athletics Centre', short: 'Tvm Centre', type: 'Academy' },
    { id: 'BBS', stateId: 'OD', name: 'Bhubaneswar Hockey Centre', short: 'Bhubaneswar HC', type: 'High Performance Centre' },
  ];
  // [id, centre, sport, discipline, ageGroup, size, sessionSlot]
  const SQUADS = [
    ['SQ-PUN-SPR17', 'PUN', 'Athletics', 'Sprints', 'U-17', 12, '07:30'],
    ['SQ-PUN-SPR20', 'PUN', 'Athletics', 'Sprints', 'U-20', 10, '07:30'],
    ['SQ-PUN-JMP20', 'PUN', 'Athletics', 'Jumps', 'U-20', 8, '08:00'],
    ['SQ-PUN-BOX17', 'PUN', 'Boxing', 'Boxing', 'U-17', 8, '16:30'],
    ['SQ-MUM-SPR17', 'MUM', 'Athletics', 'Sprints', 'U-17', 9, '06:45'],
    ['SQ-MUM-MD20', 'MUM', 'Athletics', 'Middle distance', 'U-20', 8, '06:30'],
    ['SQ-BLR-SPRSR', 'BLR', 'Athletics', 'Sprints', 'Senior', 8, '07:00'],
    ['SQ-BLR-JMPSR', 'BLR', 'Athletics', 'Jumps', 'Senior', 7, '07:30'],
    ['SQ-PAT-CAMP', 'PAT', 'Athletics', 'Sprints', 'Senior', 6, '07:00'],
    ['SQ-PAT-THR', 'PAT', 'Athletics', 'Throws', 'Senior', 7, '08:00'],
    ['SQ-PAT-WL', 'PAT', 'Weightlifting', 'Weightlifting', 'Senior', 7, '09:00'],
    ['SQ-SNP-WR20', 'SNP', 'Wrestling', 'Freestyle', 'U-20', 10, '06:00'],
    ['SQ-SNP-BOXSR', 'SNP', 'Boxing', 'Boxing', 'Senior', 8, '16:00'],
    ['SQ-BPL-HOC20', 'BPL', 'Hockey', 'Hockey', 'U-20', 12, '17:00'],
    ['SQ-GUW-BOX17', 'GUW', 'Boxing', 'Boxing', 'U-17', 9, '16:00'],
    ['SQ-GUW-WL17', 'GUW', 'Weightlifting', 'Weightlifting', 'U-17', 7, '08:30'],
    ['SQ-TVM-SPR17', 'TVM', 'Athletics', 'Sprints', 'U-17', 9, '06:30'],
    ['SQ-TVM-MD17', 'TVM', 'Athletics', 'Middle distance', 'U-17', 7, '06:15'],
    ['SQ-BBS-HOCSR', 'BBS', 'Hockey', 'Hockey', 'Senior', 12, '17:30'],
  ];
  const FIRST_F = ['Priya', 'Ananya', 'Kavya', 'Sneha', 'Riya', 'Pooja', 'Meera', 'Ishita', 'Diya', 'Aarti', 'Simran', 'Neha', 'Tanvi', 'Jyoti', 'Lalremsiami', 'Anjali', 'Shreya', 'Nikita', 'Manpreet', 'Komal', 'Bhavani', 'Gayatri', 'Sakshi', 'Harshita', 'Mitali', 'Roshni', 'Asha', 'Deepika', 'Nandini', 'Sanjana', 'Ritika', 'Aparna', 'Lovlina', 'Monika', 'Pallavi'];
  const FIRST_M = ['Rohan', 'Aman', 'Arjun', 'Yash', 'Rahul', 'Vikas', 'Siddharth', 'Karan', 'Aditya', 'Manish', 'Harpreet', 'Sumit', 'Deepak', 'Nikhil', 'Pranav', 'Abhishek', 'Gurjeet', 'Tejas', 'Akash', 'Ravi', 'Sandeep', 'Bikash', 'Jeremy', 'Omkar', 'Vishal', 'Ankit', 'Rajat', 'Mohit', 'Sachin', 'Imran', 'Varun', 'Dhruv', 'Kunal', 'Lakshya', 'Sunil'];
  const LAST = {
    MH: ['Deshmukh', 'Patil', 'Gaikwad', 'Kulkarni', 'Jadhav', 'More', 'Shinde', 'Pawar', 'Joshi', 'Sawant'],
    KA: ['Gowda', 'Shetty', 'Rao', 'Hegde', 'Naik', 'Kamath'], PB: ['Singh', 'Gill', 'Sandhu', 'Dhillon', 'Brar', 'Kaur'],
    HR: ['Malik', 'Dahiya', 'Yadav', 'Punia', 'Sangwan', 'Phogat'], MP: ['Tiwari', 'Chouhan', 'Verma', 'Mishra', 'Rajput'],
    AS: ['Borah', 'Gogoi', 'Das', 'Saikia', 'Baruah', 'Kalita'], KL: ['Nair', 'Menon', 'Pillai', 'Varghese', 'Thomas', 'Kurian'],
    OD: ['Lakra', 'Tirkey', 'Ekka', 'Kujur', 'Barla', 'Minz'],
  };
  const STAFF_NAMES = {
    coach: ['Rakesh Patil', 'Suresh Nair', 'Meenakshi Gowda', 'Harjit Sandhu', 'Pradeep Malik', 'Joseph Varghese', 'Nirmala Borah', 'Anil Tiwari', 'Rajiv Shetty', 'Kamal Lakra', 'Vinod Dahiya', 'Deepa Menon', 'Gurpreet Brar', 'Mahesh Jadhav', 'Ritu Sangwan', 'Biren Gogoi', 'Sheela Kurian', 'Tarun Ekka', 'Asif Khan'],
    physio: ['Neha Kulkarni', 'Rohit Hegde', 'Amanpreet Gill', 'Kiran Yadav', 'Ruchi Mishra', 'Pankaj Das', 'Leena Thomas', 'Sanjay Minz', 'Swati Joshi'],
    scientist: ['Arjun Iyer', 'Divya Rao', 'Manjot Dhillon', 'Ashok Punia', 'Sameer Verma', 'Tapan Saikia', 'Anu Pillai', 'Ravi Kujur', 'Mansi Sawant'],
    nutritionist: ['Farah Khan', 'Shalini Kamath', 'Navneet Kaur', 'Pooja Phogat', 'Kavita Chouhan', 'Mridula Baruah', 'Reshma Nair', 'Elina Barla', 'Gauri Pawar'],
  };

  const RTP_TEMPLATES = {
    'lower-muscle': [
      { name: 'Protect & walk', targetDays: 4, criteria: ['Pain-free walking', 'Full knee extension', 'Isometric strength ≥ 70% of other leg'] },
      { name: 'Jogging', targetDays: 5, criteria: ['Jog 15 min pain-free', 'No tenderness next morning'] },
      { name: 'Running ≤ 70%', targetDays: 5, criteria: ['Strides at 70% max speed', 'Nordic strength ≥ 85% of other leg'] },
      { name: 'Sprinting ≥ 90%', targetDays: 5, criteria: ['Sprint at 90–95% max velocity', 'GPS top speed ≥ 95% of pre-injury'] },
      { name: 'Full training', targetDays: 7, criteria: ['Complete 2 full sessions with squad', 'No symptoms 24 h after'] },
      { name: 'Cleared to compete', targetDays: 0, criteria: ['Team doctor clearance signed'] },
    ],
    ligament: [
      { name: 'Protect & mobilise', targetDays: 5, criteria: ['Swelling controlled', 'Full weight bearing'] },
      { name: 'Strength & balance', targetDays: 7, criteria: ['Single-leg balance 30 s', 'Calf raises ≥ 90% of other leg'] },
      { name: 'Running', targetDays: 6, criteria: ['Straight-line running pain-free', 'Hop test ≥ 85%'] },
      { name: 'Agility & cutting', targetDays: 6, criteria: ['Change of direction at full speed', 'Hop test ≥ 95%'] },
      { name: 'Full training', targetDays: 7, criteria: ['Two full sessions without symptoms'] },
      { name: 'Cleared to compete', targetDays: 0, criteria: ['Team doctor clearance signed'] },
    ],
    concussion: [
      { name: 'Symptom-limited activity', targetDays: 2, criteria: ['Symptoms settled at rest 24 h'] },
      { name: 'Light aerobic', targetDays: 1, criteria: ['Bike 15 min, no symptoms'] },
      { name: 'Sport-specific exercise', targetDays: 1, criteria: ['Shadow drills, no head impact'] },
      { name: 'Non-contact drills', targetDays: 2, criteria: ['Pad work, cognitive test at baseline'] },
      { name: 'Full contact practice', targetDays: 2, criteria: ['Sparring without symptoms'] },
      { name: 'Cleared to compete', targetDays: 0, criteria: ['Team doctor clearance signed'] },
    ],
    upper: [
      { name: 'Protect', targetDays: 5, criteria: ['Pain at rest ≤ 2/10'] },
      { name: 'Range of motion', targetDays: 7, criteria: ['Full pain-free range'] },
      { name: 'Strength', targetDays: 10, criteria: ['Strength ≥ 85% of other side'] },
      { name: 'Sport-specific loading', targetDays: 7, criteria: ['Technical lifts at 80% 1RM'] },
      { name: 'Full training', targetDays: 7, criteria: ['Full sessions, no symptoms'] },
      { name: 'Cleared to compete', targetDays: 0, criteria: ['Team doctor clearance signed'] },
    ],
    tendon: [
      { name: 'Load management', targetDays: 7, criteria: ['Morning pain ≤ 3/10'] },
      { name: 'Isometrics', targetDays: 7, criteria: ['5 × 45 s holds, pain ≤ 3/10'] },
      { name: 'Isotonic strength', targetDays: 10, criteria: ['Heavy slow resistance tolerated'] },
      { name: 'Energy storage', targetDays: 7, criteria: ['Hops and bounds, pain ≤ 3/10 next day'] },
      { name: 'Full training', targetDays: 7, criteria: ['Full sessions, stable symptoms'] },
      { name: 'Cleared to compete', targetDays: 0, criteria: ['Team doctor clearance signed'] },
    ],
  };
  AMS.RTP_TEMPLATES = RTP_TEMPLATES;
  AMS.rtpTemplateFor = function (region, type) {
    if (/concussion|head/.test(region || '') || /Concussion/.test(type || '')) return 'concussion';
    if (/Tendin/.test(type || '') || /achilles|patellar/.test(region || '')) return 'tendon';
    if (/Ligament|Sprain/.test(type || '') || /ankle|knee/.test(region || '')) return 'ligament';
    if (/shoulder|elbow|wrist|hand|arm/.test(region || '')) return 'upper';
    return 'lower-muscle';
  };
  AMS.makeRtpStages = (key) => (RTP_TEMPLATES[key] || RTP_TEMPLATES['lower-muscle']).map((s) => ({ name: s.name, targetDays: s.targetDays, criteria: s.criteria.map((c) => ({ text: c, met: false })), signedBy: null, signedAt: null }));

  const EXERCISES = [
    ['EX-001', 'A-skips & B-skips', 'Speed', 'Drills', '3 × 30 m'], ['EX-002', 'Wicket runs', 'Speed', 'Max velocity', '4 × 40 m'],
    ['EX-003', 'Block starts', 'Speed', 'Acceleration', '6 × 30 m'], ['EX-004', 'Flying 30 m', 'Speed', 'Max velocity', '4 × 30 m'],
    ['EX-005', 'Sled push', 'Speed', 'Acceleration', '5 × 20 m'], ['EX-006', 'Hill sprints (8%)', 'Speed', 'Acceleration', '6 × 40 m'],
    ['EX-007', 'Speed endurance 150 m', 'Conditioning', 'Speed endurance', '3 × 150 m'], ['EX-008', 'Tempo runs 200 m', 'Conditioning', 'Aerobic', '8 × 200 m'],
    ['EX-009', 'Back squat', 'Strength', 'Lower body', '4 × 5'], ['EX-010', 'Romanian deadlift', 'Strength', 'Posterior chain', '3 × 6'],
    ['EX-011', 'Nordic hamstring curl', 'Strength', 'Injury prevention', '3 × 5'], ['EX-012', 'Hip thrust', 'Strength', 'Posterior chain', '4 × 8'],
    ['EX-013', 'Power clean', 'Strength', 'Olympic lifts', '5 × 3'], ['EX-014', 'Split squat (rear foot elevated)', 'Strength', 'Single leg', '3 × 8/leg'],
    ['EX-015', 'Copenhagen plank', 'Strength', 'Injury prevention', '3 × 20 s'], ['EX-016', 'Calf raises (single leg)', 'Strength', 'Injury prevention', '3 × 15'],
    ['EX-017', 'Box jumps', 'Plyometrics', 'Vertical', '4 × 5'], ['EX-018', 'Bounding', 'Plyometrics', 'Horizontal', '4 × 30 m'],
    ['EX-019', 'Hurdle hops', 'Plyometrics', 'Reactive', '5 × 6'], ['EX-020', 'Depth jumps', 'Plyometrics', 'Reactive', '4 × 4'],
    ['EX-021', 'Dynamic warm-up', 'Mobility', 'Warm-up', '15 min'], ['EX-022', 'Hip mobility circuit', 'Mobility', 'Hips', '10 min'],
    ['EX-023', 'Foam rolling', 'Recovery', 'Soft tissue', '10 min'], ['EX-024', 'Pool recovery', 'Recovery', 'Active recovery', '20 min'],
    ['EX-025', 'Contrast bath', 'Recovery', 'Passive', '15 min'], ['EX-026', 'Easy bike', 'Recovery', 'Aerobic', '20 min'],
    ['EX-027', 'Isometric hamstring bridge', 'Rehab', 'Hamstring', '5 × 30 s'], ['EX-028', 'Single-leg balance', 'Rehab', 'Ankle', '3 × 30 s'],
    ['EX-029', 'Pad work rounds', 'Boxing', 'Technical', '6 × 3 min'], ['EX-030', 'Controlled sparring', 'Boxing', 'Sparring', '4 × 2 min'],
    ['EX-031', 'Footwork ladder', 'Boxing', 'Footwork', '10 min'], ['EX-032', 'Takedown chains', 'Wrestling', 'Technical', '8 × 1 min'],
    ['EX-033', 'Live wrestling', 'Wrestling', 'Live', '5 × 3 min'], ['EX-034', 'Drag-flick practice', 'Hockey', 'Set pieces', '40 reps'],
    ['EX-035', 'Small-sided games 5v5', 'Hockey', 'Tactical', '6 × 4 min'], ['EX-036', 'Snatch technique', 'Weightlifting', 'Technical', '6 × 2'],
    ['EX-037', 'Clean & jerk', 'Weightlifting', 'Competition lift', '5 × 2'], ['EX-038', 'Front squat', 'Strength', 'Lower body', '5 × 3'],
    ['EX-039', 'Long jump approach runs', 'Technical', 'Jumps', '8 runs'], ['EX-040', 'Medicine ball throws', 'Plyometrics', 'Upper body', '4 × 6'],
  ].map(([id, name, category, focus, dose]) => ({ id, name, category, focus, dose }));

  const SESSION_PLANS = {
    Sprints: [['Acceleration + block starts', 'Speed', 'High', 90, ['EX-021', 'EX-001', 'EX-003', 'EX-005', 'EX-011']], ['Lower-body strength', 'Strength', 'High', 75, ['EX-021', 'EX-009', 'EX-010', 'EX-014', 'EX-015']], ['Tempo & mobility', 'Endurance', 'Low', 60, ['EX-021', 'EX-008', 'EX-022', 'EX-023']], ['Max velocity', 'Speed', 'High', 90, ['EX-021', 'EX-001', 'EX-002', 'EX-004', 'EX-016']], ['Plyometrics + power', 'Power', 'Moderate', 70, ['EX-021', 'EX-017', 'EX-018', 'EX-013']], ['Speed endurance', 'Endurance', 'High', 80, ['EX-021', 'EX-007', 'EX-023']]],
    Jumps: [['Approach + take-off', 'Technical', 'Moderate', 90, ['EX-021', 'EX-039', 'EX-019']], ['Strength & power', 'Strength', 'High', 75, ['EX-009', 'EX-013', 'EX-017']], ['Reactive plyos', 'Power', 'High', 70, ['EX-020', 'EX-019', 'EX-018']], ['Recovery & mobility', 'Recovery', 'Low', 45, ['EX-022', 'EX-024']]],
    'Middle distance': [['Threshold 5 × 1 km', 'Endurance', 'High', 85, ['EX-021', 'EX-008']], ['Easy run + strides', 'Endurance', 'Low', 60, ['EX-021', 'EX-002']], ['Hill reps', 'Endurance', 'High', 75, ['EX-006', 'EX-016']], ['Strength circuit', 'Strength', 'Moderate', 60, ['EX-014', 'EX-016', 'EX-015']]],
    Throws: [['Throws technical', 'Technical', 'Moderate', 90, ['EX-040', 'EX-021']], ['Heavy strength', 'Strength', 'High', 90, ['EX-009', 'EX-013', 'EX-038']], ['Power & plyos', 'Power', 'Moderate', 60, ['EX-017', 'EX-040']]],
    Weightlifting: [['Snatch volume', 'Technical', 'High', 100, ['EX-036', 'EX-038']], ['Clean & jerk heavy', 'Strength', 'High', 100, ['EX-037', 'EX-009']], ['Accessory + mobility', 'Strength', 'Low', 60, ['EX-022', 'EX-012']]],
    Boxing: [['Technical pad rounds', 'Technical', 'Moderate', 90, ['EX-031', 'EX-029']], ['Controlled sparring', 'Sparring', 'High', 80, ['EX-030', 'EX-029']], ['Strength & conditioning', 'Strength', 'Moderate', 60, ['EX-013', 'EX-040']]],
    Freestyle: [['Technique chains', 'Technical', 'Moderate', 90, ['EX-032']], ['Live wrestling', 'Sparring', 'High', 90, ['EX-033', 'EX-032']], ['Strength', 'Strength', 'Moderate', 60, ['EX-009', 'EX-012']]],
    Hockey: [['Small-sided games', 'Tactical', 'High', 90, ['EX-021', 'EX-035']], ['Set pieces + drag flicks', 'Technical', 'Moderate', 75, ['EX-034']], ['Speed & agility', 'Speed', 'High', 60, ['EX-003', 'EX-019']], ['Recovery', 'Recovery', 'Low', 45, ['EX-024', 'EX-023']]],
  };
  const INTENSITY_RPE = { High: 7.4, Moderate: 5.6, Low: 3.4 };

  AMS.baseSeed = function () {
    const R = AMS.rng(20261013);
    const TODAY = AMS.TODAY;
    const db = {
      meta: { tenant: 'National Athletics & Multi-Sport Federation', tenantShort: 'NAMSF', heroAthleteId: 'ATH-10421', builtFor: TODAY, remindersSent: 0 },
      org: { states: STATES, centres: CENTRES, squads: [] },
      staff: [], athletes: [], applications: [], injuries: [], sessions: [], exercises: EXERCISES.slice(), tests: [], testDefs: [],
      tasks: [], notifications: [], activity: [], aiState: { dismissed: {}, done: {}, acted: 0, dismissedCount: 0, baselineActed: 61, baselineShown: 23 },
      competitions: [
        { id: 'CMP-1', name: 'National Inter-Zone Junior Championships', date: '2026-11-21', location: 'Bhubaneswar', level: 'National', sports: ['Athletics'] },
        { id: 'CMP-2', name: 'National Youth Games (U-17)', date: '2027-01-24', location: 'Guwahati', level: 'National', sports: ['Athletics', 'Boxing', 'Wrestling', 'Weightlifting', 'Hockey'] },
        { id: 'CMP-3', name: 'Asian U-20 Championships — selection trials', date: '2027-03-06', location: 'Patiala', level: 'International trials', sports: ['Athletics'] },
        { id: 'CMP-4', name: 'State Open Meet', date: '2026-10-31', location: 'Pune', level: 'State', sports: ['Athletics'] },
        { id: 'CMP-5', name: 'Senior National Boxing Championships', date: '2026-12-08', location: 'Bengaluru', level: 'National', sports: ['Boxing'] },
      ],
    };

    /* ---------- staff */
    const staffId = (role, i) => 'S-' + role.slice(0, 3).toUpperCase() + String(i + 1).padStart(2, '0');
    db.staff.push({ id: 'S-DIR01', name: 'Dr. Anjali Rao', role: 'director', title: 'Performance Director', persona: true, centreId: null });
    db.staff.push({ id: 'S-OPS01', name: 'Sanjay Verma', role: 'ops', title: 'Athlete Operations Lead', persona: true, centreId: null });
    db.staff.push({ id: 'S-OPS02', name: 'Leela Rajan', role: 'ops', title: 'Verification Officer', centreId: null });
    db.staff.push({ id: 'S-DOC01', name: 'Dr. Vikram Menon', role: 'doctor', title: 'Team Doctor', persona: true, centreId: 'PUN' });
    db.staff.push({ id: 'S-DOC02', name: 'Dr. Harleen Bedi', role: 'doctor', title: 'Team Doctor', centreId: 'PAT' });
    db.staff.push({ id: 'S-DOC03', name: 'Dr. Prakash Rao', role: 'doctor', title: 'Team Doctor', centreId: 'BLR' });
    CENTRES.forEach((c, i) => {
      ['physio', 'scientist', 'nutritionist'].forEach((role) => {
        db.staff.push({ id: staffId(role, i), name: STAFF_NAMES[role][i], role, title: { physio: 'Physiotherapist', scientist: 'Sports Scientist', nutritionist: 'Nutritionist' }[role], centreId: c.id, persona: c.id === 'PUN' });
      });
    });
    SQUADS.forEach((s, i) => {
      const [id, centreId, sport, discipline, ageGroup] = s;
      const coachIdx = id === 'SQ-PUN-SPR20' ? 0 : i;
      const coachId = 'S-COA' + String(coachIdx + 1).padStart(2, '0');
      if (!db.staff.find((x) => x.id === coachId)) db.staff.push({ id: coachId, name: STAFF_NAMES.coach[coachIdx], role: 'coach', title: (ageGroup === 'Senior' ? 'Head ' : '') + discipline + ' Coach', centreId, persona: coachIdx === 0, squads: [] });
      db.staff.find((x) => x.id === coachId).squads.push(id);
      db.org.squads.push({ id, centreId, sport, discipline, ageGroup, name: ageGroup + ' ' + discipline + (sport !== discipline && !['Sprints', 'Jumps', 'Middle distance', 'Throws'].includes(discipline) ? ' (' + sport + ')' : '') + (id === 'SQ-PAT-CAMP' ? ' — National Camp' : ''), coachId, slot: s[6] });
    });
    db.staff.find((x) => x.id === 'S-COA01').title = 'Head Sprints Coach';

    /* ---------- athletes */
    let seq = 10400;
    const used = new Set();
    const mkName = (gender, stateId) => {
      for (let k = 0; k < 50; k++) {
        const n = R.pick(gender === 'F' ? FIRST_F : FIRST_M) + ' ' + R.pick(LAST[stateId]);
        if (!used.has(n)) { used.add(n); return n; }
      }
      return 'Athlete ' + seq;
    };
    const ageRange = { 'U-17': [14, 16], 'U-20': [17, 19], Senior: [20, 29] };
    const EVENTS = { Sprints: ['100m, 200m', '200m, 400m', '100m, 4×100m', '400m'], Jumps: ['Long jump', 'Triple jump', 'High jump', 'Long jump, Triple jump'], 'Middle distance': ['800m', '1500m', '800m, 1500m', '3000m'], Throws: ['Javelin', 'Shot put', 'Discus', 'Hammer'], Weightlifting: ['49 kg', '55 kg', '61 kg', '67 kg', '73 kg', '81 kg'], Boxing: ['51 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '69 kg'], Freestyle: ['57 kg', '61 kg', '65 kg', '74 kg', '86 kg'], Hockey: ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'] };
    const DEVICES = { Athletics: ['Catapult Vector', 'Polar H10', 'WHOOP 4.0'], Hockey: ['Catapult Vector', 'Polar H10'], Boxing: ['WHOOP 4.0', 'Polar H10'], Wrestling: ['WHOOP 4.0'], Weightlifting: ['WHOOP 4.0', 'Velocity tracker'] };

    db.org.squads.forEach((sq) => {
      const def = SQUADS.find((s) => s[0] === sq.id);
      const centre = CENTRES.find((c) => c.id === sq.centreId);
      const n = def[5];
      const femaleShare = sq.sport === 'Wrestling' ? 0.3 : sq.sport === 'Hockey' ? (sq.id === 'SQ-BPL-HOC20' ? 1 : 0) : 0.5;
      for (let k = 0; k < n; k++) {
        const gender = R.chance(femaleShare) ? 'F' : 'M';
        const [lo, hi] = ageRange[sq.ageGroup];
        const age = R.int(lo, hi);
        const dob = AMS.date.add(TODAY, -(age * 365 + R.int(20, 340)));
        const id = 'ATH-' + seq++;
        const a = {
          id, name: mkName(gender, centre.stateId), gender, dob, sport: sq.sport, discipline: sq.discipline,
          events: R.pick(EVENTS[sq.discipline] || EVENTS[sq.sport] || ['—']),
          squadId: sq.id, centreId: sq.centreId, stateId: centre.stateId, coachId: sq.coachId,
          enrollment: 'Active', availability: 'Available', availabilityReason: '',
          enrolledOn: AMS.date.add(TODAY, -R.int(90, 1400)),
          level: sq.ageGroup === 'Senior' ? R.pick(['National', 'National', 'International']) : R.pick(['District', 'State', 'State', 'National']),
          tags: [], profileCompletion: R.int(78, 100), missingFields: [],
          verification: { status: 'Verified', by: 'Leela Rajan', on: null },
          docs: [], guardian: null,
          bloodGroup: R.pick(['B+', 'O+', 'A+', 'AB+', 'O-', 'B-']),
          heightCm: R.int(gender === 'F' ? 152 : 163, gender === 'F' ? 178 : 192), weightKg: 0,
          dominantSide: R.chance(0.85) ? 'Right' : 'Left',
          devices: (DEVICES[sq.sport] || []).filter(() => R.chance(0.7)),
          wellness: [], loads: [], tempAssignment: null, returnedOn: null,
          phone: '+91 9' + R.int(10, 99) + 'xx xx' + R.int(100, 999),
          baseRPE: R.norm(0, 0.5), wellBase: AMS.clamp(R.norm(3.9, 0.35), 3.1, 4.6), loadMult: AMS.clamp(R.norm(1, 0.12), 0.75, 1.3),
        };
        a.weightKg = Math.round(a.heightCm - (gender === 'F' ? 108 : 102) + R.int(-5, 6));
        a.verification.on = AMS.date.add(a.enrolledOn, R.int(2, 6));
        if (a.profileCompletion < 100) a.missingFields = R.pick([['Emergency contact'], ['Blood test report'], ['Passport'], ['Bank details (stipend)'], ['Previous coach reference', 'Passport']]);
        if (age < 18) a.guardian = { name: R.pick(['Sunita', 'Ramesh', 'Geeta', 'Mahesh', 'Lata', 'Vijay']) + ' ' + a.name.split(' ')[1], relation: R.pick(['Mother', 'Father']), consent: true, consentOn: a.enrolledOn };
        a.docs = [
          { id: id + '-D1', type: 'Aadhaar card', status: 'Verified', on: a.verification.on, ai: { ok: true, confidence: 0.97, note: 'Name and DOB match application' } },
          { id: id + '-D2', type: 'Birth certificate', status: 'Verified', on: a.verification.on, ai: { ok: true, confidence: 0.95, note: 'DOB matches Aadhaar' } },
          { id: id + '-D3', type: 'Medical fitness certificate', status: R.chance(0.12) ? 'Expiring' : 'Verified', on: a.verification.on, expires: AMS.date.add(TODAY, R.int(8, 300)), ai: { ok: true, confidence: 0.9, note: 'Signed by registered practitioner' } },
        ];
        if (age < 18) a.docs.push({ id: id + '-D4', type: 'Guardian consent', status: 'Verified', on: a.verification.on, ai: { ok: true, confidence: 0.93, note: 'Signature present; guardian ID matched' } });
        const tagPool = ['Khelo India scheme', 'TOPS development', 'Talent pathway', 'Scholarship', 'Hostel resident', 'Day scholar', 'Left-footed', 'Para-eligible'];
        a.tags = tagPool.filter(() => R.chance(0.16)).slice(0, 3);
        db.athletes.push(a);
      }
    });

    /* ---------- the hero: Priya Deshmukh, 16, U-17 sprinter at Pune HPC */
    const pr = db.athletes.find((a) => a.squadId === 'SQ-PUN-SPR17');
    used.delete(pr.name);
    const prOldId = pr.id;
    Object.assign(pr, {
      id: 'ATH-10421', name: 'Priya Deshmukh', gender: 'F', dob: '2010-03-22', events: '100m, 200m', level: 'State',
      enrolledOn: '2026-02-10', tags: ['Khelo India scheme', 'Talent pathway', 'Hostel resident'], profileCompletion: 92, missingFields: ['Blood test report'],
      guardian: { name: 'Sunita Deshmukh', relation: 'Mother', consent: true, consentOn: '2026-02-06' }, heightCm: 164, weightKg: 52, dominantSide: 'Right',
      devices: ['Catapult Vector', 'WHOOP 4.0'], wellBase: 4.1, loadMult: 1.0, baseRPE: 0.2, pb: { '100m': '12.08', '200m': '24.71' },
      tempAssignment: { centreId: 'PAT', squadId: 'SQ-PAT-CAMP', label: 'National U-18 Sprint Camp', from: '2026-11-02', to: '2026-12-13', active: false },
      verification: { status: 'Verified', by: 'Leela Rajan', on: '2026-02-12' },
      discoveredAt: { event: 'District Talent Hunt, Pune', date: '2026-01-18', by: 'Talent scout · Mahesh Jadhav' },
    });
    pr.docs.forEach((d, i) => { d.id = 'ATH-10421-D' + (i + 1); d.on = '2026-02-12'; });
    if (!pr.docs.find((d) => d.type === 'Guardian consent')) pr.docs.push({ id: 'ATH-10421-D4', type: 'Guardian consent', status: 'Verified', on: '2026-02-12', ai: { ok: true, confidence: 0.93, note: 'Signature present; guardian ID matched' } });
    void prOldId;
    // keep ids unique: the generated athlete that already held the hero id gets a fresh one
    db.athletes.forEach((a) => { if (a !== pr && a.id === 'ATH-10421') { a.id = 'ATH-' + seq++; a.docs.forEach((d, i) => { d.id = a.id + '-D' + (i + 1); }); } });

    // Named supporting cast at Pune
    const rename = (squadId, idx, patch) => { const a = db.athletes.filter((x) => x.squadId === squadId)[idx]; used.delete(a.name); Object.assign(a, patch); return a; };
    const rohan = rename('SQ-PUN-SPR20', 0, { name: 'Rohan Gaikwad', gender: 'M', dob: '2008-07-04', events: '100m, 200m', level: 'National' });
    const aman = rename('SQ-PUN-SPR20', 1, { name: 'Aman Shinde', gender: 'M', dob: '2007-11-19', events: '400m' });
    const kavya = rename('SQ-PUN-JMP20', 0, { name: 'Kavya Nair', gender: 'F', dob: '2008-01-30', events: 'Long jump, Triple jump', level: 'National' });
    const sneha = rename('SQ-PUN-SPR17', 1, { name: 'Sneha Patil', gender: 'F', dob: '2010-09-02', events: '200m, 400m' });
    const yash = rename('SQ-PUN-SPR17', 2, { name: 'Yash More', gender: 'M', dob: '2010-05-15', events: '100m, 200m' });
    const ananya = rename('SQ-PUN-SPR17', 3, { name: 'Ananya Joshi', gender: 'F', dob: '2011-02-11', events: '100m, 4×100m', tags: ['Talent pathway'] });
    [rohan, aman, kavya, sneha, yash, ananya].forEach((a) => { a.guardian = AMS.date.ageOn(a.dob) < 18 ? { name: 'Parent of ' + a.name.split(' ')[0], relation: 'Father', consent: true, consentOn: a.enrolledOn } : null; });

    // Camp athletes on temporary assignment (home Bengaluru, currently at Patiala camp)
    db.athletes.filter((a) => a.squadId === 'SQ-BLR-SPRSR').slice(0, 2).forEach((a) => { a.tempAssignment = { centreId: 'PAT', squadId: 'SQ-PAT-CAMP', label: 'Senior Relay Camp', from: '2026-09-28', to: '2026-11-08', active: true }; a.tags = a.tags.concat(['On national camp']); });

    /* ---------- sessions & loads (42 days) and wellness (28 days) */
    const sqAth = AMS.groupBy(db.athletes, 'squadId');
    const loadsById = {}; db.athletes.forEach((a) => { loadsById[a.id] = new Array(42).fill(0); });
    let sessN = 5000;
    db.org.squads.forEach((sq) => {
      const plans = SESSION_PLANS[sq.discipline] || SESSION_PLANS[sq.sport] || SESSION_PLANS.Sprints;
      const members = sqAth[sq.id] || [];
      for (let i = 0; i < 49; i++) { // 0..41 past+today, 42..48 next 7 days
        const date = AMS.date.add(TODAY, i - 41);
        const dow = AMS.date.dowIndex(date);
        if (dow === 0) continue; // Sunday rest
        const plan = plans[(i + sq.id.length) % plans.length];
        const isRecoveryDay = dow === 3 && plans.length > 3;
        const [title, type, intensity, duration, exIds] = isRecoveryDay ? (plans.find((p) => p[2] === 'Low') || plan) : plan;
        // progressive block: chronic build over 6 weeks, deload week 3
        const week = Math.floor(i / 7);
        const blockMult = [0.9, 0.95, 0.86, 0.97, 1.0, 1.03, 1.0][Math.min(week, 6)];
        const isToday = i === 41, isPast = i < 41, isFuture = i > 41;
        const keep = i >= 27; // store session objects for last 14 days + today + next 7
        const s = keep ? {
          id: 'SES-' + sessN++, squadId: sq.id, date, start: sq.slot, duration, title, type, intensity,
          plannedRPE: Math.round(INTENSITY_RPE[intensity]), location: sq.sport === 'Athletics' ? R.pick(['Track 1', 'Track 2', 'Gym A']) : sq.sport === 'Hockey' ? 'Turf 1' : sq.sport === 'Boxing' ? 'Ring hall' : sq.sport === 'Wrestling' ? 'Mat hall' : 'Lifting platform',
          coachId: sq.coachId, blocks: exIds.map((e) => ({ exerciseId: e, dose: (EXERCISES.find((x) => x.id === e) || {}).dose })),
          status: isPast ? 'Completed' : 'Planned', attendance: {}, rpe: {}, mods: {}, notes: '',
        } : null;
        members.forEach((a) => {
          if (isFuture) return;
          if (isToday) return;
          const absent = R.chance(0.06);
          if (s) s.attendance[a.id] = absent ? (R.chance(0.5) ? 'excused' : 'absent') : (R.chance(0.05) ? 'late' : 'present');
          if (absent) return;
          const rpe = AMS.clamp(Math.round(INTENSITY_RPE[intensity] + a.baseRPE + R.norm(0, 0.7)), 1, 10);
          const load = Math.round(rpe * duration * blockMult * a.loadMult);
          loadsById[a.id][i] += load;
          if (s) s.rpe[a.id] = rpe;
        });
        if (s) db.sessions.push(s);
      }
    });
    // Priya: last 7 days — trials + extra speed block → sharp spike
    const prL = loadsById[pr.id];
    for (let i = 34; i <= 40; i++) if (prL[i]) prL[i] = Math.round(prL[i] * 1.75);
    prL[39] += 640; // State Open qualifying trial (Sun double)
    for (let i = 13; i <= 33; i++) prL[i] = Math.round(prL[i] * 0.72); // school exam weeks in Sept: reduced training → low chronic base
    // A few other spikes for realism
    [db.athletes.find((a) => a.squadId === 'SQ-BPL-HOC20'), db.athletes.filter((a) => a.squadId === 'SQ-SNP-WR20')[2], db.athletes.filter((a) => a.squadId === 'SQ-MUM-SPR17')[1], yash].forEach((a, k) => {
      const L = loadsById[a.id]; for (let i = 34; i <= 40; i++) if (L[i]) L[i] = Math.round(L[i] * (1.42 + k * 0.05));
    });
    // Under-loaded returning athletes
    [rohan, aman].forEach((a) => { const L = loadsById[a.id]; for (let i = 27; i <= 40; i++) L[i] = Math.round(L[i] * 0.35); });

    db.athletes.forEach((a) => {
      a.loads = loadsById[a.id];
      const w = [];
      for (let d = 0; d < 28; d++) {
        const li = d + 14;
        const fatigue = a.loads[li - 1] ? (a.loads[li - 1] - 520) / 900 : -0.2;
        const v = (k) => AMS.clamp(Math.round(a.wellBase + R.norm(0, 0.55) - (k === 'soreness' ? fatigue * 1.2 : fatigue * 0.4)), 1, 5);
        w.push({ sleep: v('sleep'), soreness: v('soreness'), mood: v('mood'), stress: v('stress'), energy: v('energy'), sleepHrs: AMS.round(AMS.clamp(R.norm(7.6, 0.7), 5, 9.5), 1), at: '06:' + String(R.int(5, 59)).padStart(2, '0') });
      }
      // today's check-in: 71% have submitted by 07:05
      if (!R.chance(0.71)) w[27] = null;
      a.wellness = w;
    });
    // Priya's story: three bad nights, high soreness
    Object.assign(pr.wellness[25], { sleep: 3, soreness: 3, mood: 3, stress: 3, energy: 3, sleepHrs: 6.4 });
    Object.assign(pr.wellness[26], { sleep: 2, soreness: 2, mood: 3, stress: 3, energy: 2, sleepHrs: 5.6 });
    pr.wellness[27] = { sleep: 2, soreness: 2, mood: 2, stress: 3, energy: 2, sleepHrs: 5.4, at: '06:31', note: 'Both hamstrings tight after Sunday trial' };
    const sw = sneha.wellness; [24, 25, 26].forEach((i) => { if (sw[i]) Object.assign(sw[i], { mood: 2, stress: 2, energy: 2, sleep: 3 }); }); sw[27] = { sleep: 2, soreness: 3, mood: 2, stress: 2, energy: 2, sleepHrs: 6.0, at: '06:48' };
    ananya.wellness[27] = null; yash.wellness[27] = { sleep: 4, soreness: 2, mood: 4, stress: 4, energy: 3, sleepHrs: 7.1, at: '06:40' };

    // Realistic past compliance: ~10% of mornings missed (more at Patiala, a camp-heavy centre). Separate RNG keeps the rest of the seed stable.
    const RW = AMS.rng(4242);
    db.athletes.forEach((a) => { if (a.id === pr.id || a.id === sneha.id) return; for (let d = 0; d < 27; d++) if (a.wellness[d] && RW.chance(a.centreId === 'PAT' ? 0.17 : a.centreId === 'GUW' ? 0.14 : 0.08)) a.wellness[d] = null; });

    /* ---------- injuries */
    let injN = 2030;
    const mkInj = (a, o) => {
      const tpl = AMS.rtpTemplateFor(o.region, o.type);
      const inj = Object.assign({
        id: 'INJ-' + injN++, athleteId: a.id, view: 'back', side: 'R', context: 'Training', path: 'case', availability: 'Modified',
        reportedBy: 'Coach', physioId: db.staff.find((s) => s.role === 'physio' && s.centreId === a.centreId).id,
        doctorId: (db.staff.find((s) => s.role === 'doctor' && s.centreId === a.centreId) || db.staff.find((s) => s.id === 'S-DOC01')).id,
        rtpTemplate: tpl, rtpStages: AMS.makeRtpStages(tpl), rtpStage: 0, stageSince: null, stageTargetDays: 5,
        timeline: [], notes: [], painLog: [], clearance: null, setbacks: 0,
      }, o);
      for (let k = 0; k < inj.rtpStage; k++) { inj.rtpStages[k].signedBy = AMS.org ? null : null; inj.rtpStages[k].criteria.forEach((c) => { c.met = true; }); inj.rtpStages[k].signedBy = db.staff.find((s) => s.id === inj.physioId).name; inj.rtpStages[k].signedAt = AMS.date.add(inj.dateOfInjury, 3 + k * 5); }
      inj.stageTargetDays = (inj.rtpStages[inj.rtpStage] || {}).targetDays || 5;
      // pain log since injury
      const days = AMS.date.diff(TODAY, inj.dateOfInjury);
      for (let d = 0; d <= Math.min(days, 30); d++) inj.painLog.push({ date: AMS.date.add(inj.dateOfInjury, d), pain: AMS.clamp(Math.round((inj.severity === 'severe' ? 8 : inj.severity === 'moderate' ? 6 : 4) * Math.exp(-d / 9) + R.norm(0, 0.6)), 0, 10) });
      inj.timeline.unshift({ date: inj.dateOfInjury, type: 'report', by: inj.reportedBy, text: 'Injury reported: ' + inj.regionLabel + ' — ' + (inj.mechanism || inj.type) });
      if (inj.status !== 'Reported') inj.timeline.unshift({ date: AMS.date.add(inj.dateOfInjury, 1), type: 'assessment', by: db.staff.find((s) => s.id === inj.physioId).name, text: 'Assessment: ' + inj.diagnosis });
      for (let k = 0; k < inj.rtpStage; k++) inj.timeline.unshift({ date: inj.rtpStages[k].signedAt, type: 'stage', by: inj.rtpStages[k].signedBy, text: 'Stage passed: ' + inj.rtpStages[k].name });
      db.injuries.push(inj);
      if (inj.status !== 'Closed') { a.availability = inj.availability; a.availabilityReason = AMS.bodyZone(inj.region); }
      return inj;
    };
    // Rohan — R hamstring, rehab stage 3 (Running ≤70%), running long
    const rInj = mkInj(rohan, { region: 'hamstring', side: 'R', view: 'back', regionLabel: 'Right hamstring', diagnosis: 'Grade 2 hamstring strain (biceps femoris, long head)', type: 'Muscle strain', grade: 2, severity: 'moderate', mechanism: 'Max-velocity sprint, 50 m mark', dateOfInjury: '2026-09-21', status: 'Rehab', rtpStage: 2, stageSince: '2026-10-06', expectedReturn: '2026-10-30', reportedBy: 'Rakesh Patil' });
    rInj.notes.push({ date: '2026-10-11', by: 'Neha Kulkarni', role: 'physio', text: 'Strides at 70% tolerated, mild tightness at end range. Nordic ratio 0.81 (target 0.85). Hold stage 3 for 2–3 more days.' });
    // Kavya — L ankle sprain, Full training done, awaiting doctor clearance
    const kInj = mkInj(kavya, { region: 'ankle', side: 'L', view: 'front', regionLabel: 'Left ankle', diagnosis: 'Grade 2 lateral ankle sprain (ATFL)', type: 'Ligament sprain', grade: 2, severity: 'moderate', mechanism: 'Landing from triple jump, inversion', dateOfInjury: '2026-09-08', status: 'Clearance', rtpStage: 5, stageSince: '2026-10-11', expectedReturn: '2026-10-14', reportedBy: 'Coach Meenakshi' });
    kInj.notes.push({ date: '2026-10-12', by: 'Neha Kulkarni', role: 'physio', text: 'Hop test 97% LSI, full jump approach sessions × 2 without symptoms. Requesting clearance from Dr. Menon.' });
    // Aman — L calf strain with setback
    const aInj = mkInj(aman, { region: 'calf', side: 'L', view: 'back', regionLabel: 'Left calf', diagnosis: 'Grade 1 medial gastrocnemius strain', type: 'Muscle strain', grade: 1, severity: 'minor', mechanism: 'Bend running, 300 m', dateOfInjury: '2026-09-29', status: 'Rehab', rtpStage: 1, stageSince: '2026-10-09', expectedReturn: '2026-10-24', setbacks: 1 });
    aInj.timeline.unshift({ date: '2026-10-09', type: 'setback', by: 'Neha Kulkarni', text: 'Setback: tightness during 70% strides. Moved back to Jogging stage.' });
    // Sneha — patellar tendon, light path (monitoring)
    mkInj(sneha, { region: 'knee', side: 'R', view: 'front', regionLabel: 'Right knee (patellar tendon)', diagnosis: 'Patellar tendon irritation', type: 'Tendinopathy', grade: 1, severity: 'minor', mechanism: 'Gradual onset, plyometric block', dateOfInjury: '2026-10-07', status: 'Monitoring', path: 'light', availability: 'Available', rtpStage: 0 });
    sneha.availability = 'Available';
    // Yash — reported this morning, awaiting physio
    mkInj(yash, { region: 'groin', side: 'L', view: 'front', regionLabel: 'Left groin (adductor)', diagnosis: 'Suspected adductor strain — awaiting assessment', type: 'Muscle strain', grade: null, severity: 'minor', mechanism: 'Felt pull during yesterday\'s acceleration drills', dateOfInjury: '2026-10-12', status: 'Reported', reportedBy: 'Yash More (athlete app)', availability: 'Modified' });
    // Other centres
    const pick = (sqid, i) => db.athletes.filter((a) => a.squadId === sqid)[i];
    mkInj(pick('SQ-GUW-BOX17', 1), { region: 'head', side: 'C', view: 'front', regionLabel: 'Head', diagnosis: 'Sport-related concussion', type: 'Concussion', grade: null, severity: 'moderate', mechanism: 'Sparring, clean right hook', dateOfInjury: '2026-10-08', status: 'Rehab', rtpStage: 2, stageSince: '2026-10-12', availability: 'Unavailable', expectedReturn: '2026-10-19' });
    mkInj(pick('SQ-PAT-WL', 0), { region: 'shoulder', side: 'R', view: 'front', regionLabel: 'Right shoulder', diagnosis: 'Rotator cuff tendinopathy (supraspinatus)', type: 'Tendinopathy', grade: null, severity: 'moderate', mechanism: 'Overload — snatch volume', dateOfInjury: '2026-09-15', status: 'Rehab', rtpStage: 2, stageSince: '2026-10-02', expectedReturn: '2026-11-05', availability: 'Modified' });
    mkInj(pick('SQ-BPL-HOC20', 3), { region: 'knee', side: 'L', view: 'front', regionLabel: 'Left knee (ACL)', diagnosis: 'ACL rupture — post reconstruction (week 14)', type: 'Ligament rupture', grade: 3, severity: 'severe', mechanism: 'Non-contact pivot in match', dateOfInjury: '2026-07-05', status: 'Rehab', rtpStage: 2, stageSince: '2026-09-20', stageTargetDays: 28, expectedReturn: '2027-03-15', availability: 'Unavailable' });
    mkInj(pick('SQ-SNP-WR20', 4), { region: 'lower_back', side: 'C', view: 'back', regionLabel: 'Lower back', diagnosis: 'Lumbar facet irritation', type: 'Joint irritation', grade: null, severity: 'minor', mechanism: 'Live wrestling, bridging', dateOfInjury: '2026-10-05', status: 'Rehab', rtpStage: 1, stageSince: '2026-10-10', expectedReturn: '2026-10-20', availability: 'Modified' });
    mkInj(pick('SQ-BBS-HOCSR', 5), { region: 'hamstring', side: 'L', view: 'back', regionLabel: 'Left hamstring', diagnosis: 'Grade 1 hamstring strain', type: 'Muscle strain', grade: 1, severity: 'minor', mechanism: 'Sprint to circle', dateOfInjury: '2026-10-10', status: 'Assessment', rtpStage: 0, availability: 'Modified' });
    mkInj(pick('SQ-MUM-MD20', 2), { region: 'shin', side: 'R', view: 'front', regionLabel: 'Right shin', diagnosis: 'Medial tibial stress syndrome', type: 'Bone stress', grade: null, severity: 'minor', mechanism: 'Mileage increase', dateOfInjury: '2026-10-03', status: 'Monitoring', path: 'light', availability: 'Available' });
    mkInj(pick('SQ-BLR-JMPSR', 1), { region: 'achilles', side: 'L', view: 'back', regionLabel: 'Left Achilles', diagnosis: 'Mid-portion Achilles tendinopathy', type: 'Tendinopathy', grade: null, severity: 'moderate', mechanism: 'Gradual onset', dateOfInjury: '2026-09-02', status: 'Rehab', rtpStage: 3, stageSince: '2026-10-05', expectedReturn: '2026-10-26', availability: 'Modified' });
    mkInj(pick('SQ-TVM-SPR17', 0), { region: 'quad', side: 'R', view: 'front', regionLabel: 'Right quadriceps', diagnosis: 'Quadriceps contusion', type: 'Contusion', grade: 1, severity: 'minor', mechanism: 'Collision during relay change-over', dateOfInjury: '2026-10-11', status: 'Rehab', rtpStage: 1, stageSince: '2026-10-12', expectedReturn: '2026-10-18', availability: 'Modified' });
    // Closed history (faded marks on the body map)
    const hist = [
      [pr, { region: 'shin', side: 'L', view: 'front', regionLabel: 'Left shin', diagnosis: 'Medial tibial stress syndrome', type: 'Bone stress', severity: 'minor', dateOfInjury: '2026-03-02', closedOn: '2026-03-30', mechanism: 'Spike in track volume after enrolment' }],
      [rohan, { region: 'hamstring', side: 'R', view: 'back', regionLabel: 'Right hamstring', diagnosis: 'Grade 1 hamstring strain', type: 'Muscle strain', severity: 'minor', dateOfInjury: '2025-12-14', closedOn: '2026-01-04', mechanism: 'Flying 30 m' }],
      [kavya, { region: 'ankle', side: 'L', view: 'front', regionLabel: 'Left ankle', diagnosis: 'Grade 1 lateral ankle sprain', type: 'Ligament sprain', severity: 'minor', dateOfInjury: '2026-04-19', closedOn: '2026-05-06', mechanism: 'Landing' }],
      [aman, { region: 'calf', side: 'L', view: 'back', regionLabel: 'Left calf', diagnosis: 'Calf cramp / strain', type: 'Muscle strain', severity: 'minor', dateOfInjury: '2026-06-11', closedOn: '2026-06-20' }],
    ];
    hist.forEach(([a, o]) => {
      const inj = mkInj(a, Object.assign({ status: 'Closed', rtpStage: 5, availability: 'Available' }, o));
      inj.clearance = { by: 'Dr. Vikram Menon', date: o.closedOn, conditions: 'Graded return over 2 weeks' };
      inj.timeline.unshift({ date: o.closedOn, type: 'clearance', by: 'Dr. Vikram Menon', text: 'Cleared to return. Graded load plan applied.' });
    });
    // Random closed history across the federation for analytics
    for (let k = 0; k < 46; k++) {
      const a = R.pick(db.athletes);
      const reg = R.pick([['hamstring', 'back', 'Hamstring', 'Muscle strain'], ['ankle', 'front', 'Ankle', 'Ligament sprain'], ['knee', 'front', 'Knee', 'Tendinopathy'], ['lower_back', 'back', 'Lower back', 'Joint irritation'], ['shoulder', 'front', 'Shoulder', 'Tendinopathy'], ['calf', 'back', 'Calf', 'Muscle strain'], ['groin', 'front', 'Groin', 'Muscle strain'], ['wrist', 'front', 'Wrist', 'Ligament sprain'], ['head', 'front', 'Head', 'Concussion']]);
      const side = reg[0] === 'lower_back' || reg[0] === 'head' ? 'C' : R.pick(['L', 'R']);
      const d0 = AMS.date.add(TODAY, -R.int(20, 330));
      const dur = R.int(6, 45);
      const inj = mkInj(a, { region: reg[0], side, view: reg[1], regionLabel: (side === 'L' ? 'Left ' : side === 'R' ? 'Right ' : '') + reg[2].toLowerCase(), diagnosis: reg[3] + ' — ' + reg[2].toLowerCase(), type: reg[3], severity: R.pick(['minor', 'minor', 'moderate', 'severe']), dateOfInjury: d0, closedOn: AMS.date.add(d0, dur), status: 'Closed', rtpStage: 5, availability: 'Available', context: R.pick(['Training', 'Training', 'Competition']) });
      inj.daysLost = dur;
      if (AMS.date.diff(TODAY, inj.closedOn) < 0) { inj.closedOn = AMS.date.add(TODAY, -2); }
    }
    db.injuries.forEach((i) => { if (i.status === 'Closed' && !i.daysLost) i.daysLost = AMS.date.diff(i.closedOn || TODAY, i.dateOfInjury); });
    // returned recently → graded return-to-load
    const ret = db.athletes.filter((a) => a.squadId === 'SQ-PUN-SPR17')[5];
    ret.returnedOn = '2026-10-01';

    /* ---------- onboarding / verification queue */
    const APPS = [
      ['Riya Shinde', 'F', '2011-06-14', 'PUN', 'SQ-PUN-SPR17', 'Athletics', '100m, 200m', 'Verifying', 6, [['Aadhaar card', 'Verified', true, 0.98, 'Name and DOB match'], ['Birth certificate', 'Flagged', false, 0.41, 'DOB differs: certificate shows 14 Jun 2010, Aadhaar shows 14 Jun 2011'], ['Guardian consent', 'Pending', true, 0.9, 'Signature present'], ['Medical fitness certificate', 'Verified', true, 0.93, 'Valid till Aug 2027']]],
      ['Omkar Jadhav', 'M', '2010-12-02', 'PUN', 'SQ-PUN-SPR17', 'Athletics', '400m', 'Applied', 1, [['Aadhaar card', 'Pending', true, 0.96, 'Name and DOB match'], ['Birth certificate', 'Pending', true, 0.94, 'DOB matches Aadhaar'], ['Guardian consent', 'Missing', null, null, ''], ['Medical fitness certificate', 'Pending', true, 0.88, 'Signed by registered practitioner']]],
      ['Lalrinpuii Ralte', 'F', '2009-08-21', 'GUW', 'SQ-GUW-BOX17', 'Boxing', '51 kg', 'Verifying', 7, [['Aadhaar card', 'Verified', true, 0.97, 'Name and DOB match'], ['Birth certificate', 'Verified', true, 0.95, 'DOB matches'], ['Guardian consent', 'Verified', true, 0.92, 'Signature present'], ['Medical fitness certificate', 'Flagged', false, 0.52, 'Image blurred — registration number unreadable']]],
      ['Rahul Yadav', 'M', '2007-03-09', 'SNP', 'SQ-SNP-WR20', 'Wrestling', '65 kg', 'Verifying', 3, [['Aadhaar card', 'Verified', true, 0.97, 'Name and DOB match'], ['Birth certificate', 'Verified', true, 0.96, 'DOB matches'], ['Medical fitness certificate', 'Verified', true, 0.9, 'Valid']]],
      ['Gurnoor Kaur', 'F', '2006-11-30', 'PAT', 'SQ-PAT-THR', 'Athletics', 'Javelin', 'Applied', 2, [['Aadhaar card', 'Pending', true, 0.95, 'Name and DOB match'], ['Birth certificate', 'Pending', true, 0.93, 'DOB matches'], ['Medical fitness certificate', 'Pending', true, 0.9, 'Valid'], ['Previous competition records', 'Pending', true, 0.86, 'State meet 2026 result found: 47.12 m']]],
      ['Abhinav Kurian', 'M', '2010-04-18', 'TVM', 'SQ-TVM-MD17', 'Athletics', '800m, 1500m', 'Docs returned', 9, [['Aadhaar card', 'Verified', true, 0.97, 'OK'], ['Birth certificate', 'Verified', true, 0.95, 'OK'], ['Guardian consent', 'Returned', false, 0.3, 'Guardian signature missing on page 2'], ['Medical fitness certificate', 'Verified', true, 0.91, 'OK']]],
      ['Sakshi Malik', 'F', '2008-02-25', 'SNP', 'SQ-SNP-WR20', 'Wrestling', '57 kg', 'Approved', 12, [['Aadhaar card', 'Verified', true, 0.98, 'OK'], ['Birth certificate', 'Verified', true, 0.96, 'OK'], ['Medical fitness certificate', 'Verified', true, 0.93, 'OK']]],
      ['Tejas Sawant', 'M', '2009-09-09', 'MUM', 'SQ-MUM-SPR17', 'Athletics', '100m', 'Verifying', 4, [['Aadhaar card', 'Verified', true, 0.96, 'OK'], ['Birth certificate', 'Verified', true, 0.94, 'OK'], ['Guardian consent', 'Verified', true, 0.9, 'OK'], ['Medical fitness certificate', 'Pending', true, 0.89, 'Valid till Mar 2027']]],
      ['Bhavani Devi R.', 'F', '2007-07-27', 'BLR', 'SQ-BLR-SPRSR', 'Athletics', '400m', 'Applied', 0, [['Aadhaar card', 'Pending', null, null, 'AI check running…'], ['Birth certificate', 'Pending', null, null, ''], ['Medical fitness certificate', 'Missing', null, null, '']]],
    ];
    let appN = 801;
    APPS.forEach(([name, gender, dob, centreId, squadId, sport, events, stage, daysAgo, docs]) => {
      const p = {
        id: 'APP-' + appN++, name, gender, dob, centreId, squadId, sport, events, stage, submitted: AMS.date.add(TODAY, -daysAgo),
        source: R.pick(['Talent hunt referral', 'Online application', 'Academy transfer', 'State association nomination']),
        guardian: AMS.date.ageOn(dob) < 18 ? { name: 'Guardian of ' + name.split(' ')[0], relation: R.pick(['Mother', 'Father']), consent: stage !== 'Applied' } : null,
        docs: docs.map(([type, status, ok, conf, note], i) => ({ id: 'APP-' + appN + '-D' + i, type, status, ai: ok == null ? null : { ok, confidence: conf, note } })),
        duplicateOf: null, coachId: null, history: [{ date: AMS.date.add(TODAY, -daysAgo), text: 'Application submitted', by: name }], returnReason: null,
      };
      if (stage === 'Docs returned') p.returnReason = 'Guardian signature missing on consent form (page 2)';
      if (stage === 'Approved') p.coachId = null; // awaiting coach assignment
      db.applications.push(p);
    });
    // duplicate candidate: Rahul Yadav matches an existing Sonipat athlete
    const dupTarget = db.athletes.find((a) => a.squadId === 'SQ-SNP-WR20' && a.gender === 'M');
    used.delete(dupTarget.name); dupTarget.name = 'Rahul Yadav'; dupTarget.dob = '2007-03-09';
    db.applications.find((p) => p.name === 'Rahul Yadav').duplicateOf = { athleteId: dupTarget.id, score: 0.94, reasons: ['Same name', 'Same date of birth', 'Same centre', 'Aadhaar last 4 digits match'] };
    // Inactive / pipeline states for the registry
    const tvm = db.athletes.filter((a) => a.squadId === 'SQ-TVM-MD17');
    tvm[tvm.length - 1].enrollment = 'Inactive';
    db.athletes.filter((a) => a.squadId === 'SQ-PAT-THR')[6].enrollment = 'Transferred';

    /* ---------- tests (field testing) */
    db.testDefs = [
      { id: 'sprint30', name: '30 m sprint', unit: 's', lowerBetter: true, sports: ['Athletics', 'Hockey'], battery: 'Speed' },
      { id: 'flying20', name: 'Flying 20 m', unit: 's', lowerBetter: true, sports: ['Athletics'], battery: 'Speed' },
      { id: 'slj', name: 'Standing long jump', unit: 'cm', lowerBetter: false, sports: ['Athletics', 'Hockey', 'Boxing', 'Wrestling', 'Weightlifting'], battery: 'Power' },
      { id: 'cmj', name: 'Countermovement jump', unit: 'cm', lowerBetter: false, sports: ['Athletics', 'Hockey', 'Boxing', 'Wrestling', 'Weightlifting'], battery: 'Power' },
      { id: 'yoyo', name: 'Yo-Yo IR1', unit: 'm', lowerBetter: false, sports: ['Hockey', 'Boxing', 'Wrestling', 'Athletics'], battery: 'Endurance' },
      { id: 'mbt', name: 'Medicine ball throw (3 kg)', unit: 'm', lowerBetter: false, sports: ['Boxing', 'Wrestling', 'Weightlifting', 'Athletics'], battery: 'Power' },
    ];
    const testDates = ['2026-03-14', '2026-06-20', '2026-09-26'];
    db.athletes.forEach((a) => {
      const ageAdj = AMS.clamp((AMS.date.ageOn(a.dob) - 14) / 8, 0, 1);
      const g = a.gender === 'F' ? 1 : 0;
      const talent = R.norm(0, 1);
      testDates.forEach((d, k) => {
        if (AMS.date.diff(d, a.enrolledOn) < 0 && a.id !== pr.id) return;
        const prog = k * 0.012;
        const res = {};
        db.testDefs.forEach((t) => {
          if (!t.sports.includes(a.sport)) return;
          const z = talent * 0.8 + R.norm(0, 0.4);
          const v = {
            sprint30: (4.55 + g * 0.35 - ageAdj * 0.4 - z * 0.12) * (1 - prog),
            flying20: (2.35 + g * 0.22 - ageAdj * 0.22 - z * 0.07) * (1 - prog),
            slj: (205 - g * 25 + ageAdj * 45 + z * 14) * (1 + prog),
            cmj: (34 - g * 6 + ageAdj * 10 + z * 3.5) * (1 + prog),
            yoyo: (1180 - g * 220 + ageAdj * 600 + z * 160) * (1 + prog * 1.5),
            mbt: (6.4 - g * 1.4 + ageAdj * 2.6 + z * 0.6) * (1 + prog),
          }[t.id];
          res[t.id] = t.unit === 's' ? AMS.round(v, 2) : t.id === 'yoyo' ? Math.round(v / 40) * 40 : AMS.round(v, 1);
        });
        db.tests.push({ id: 'TST-' + a.id + '-' + k, athleteId: a.id, date: d, results: res, enteredBy: 'Field testing team' });
      });
    });
    // Priya's first field test at the district talent hunt
    db.tests.filter((t) => t.athleteId === pr.id).forEach((t, k) => { t.results.sprint30 = [4.52, 4.44, 4.37][k]; t.results.flying20 = [2.31, 2.27, 2.22][k]; t.results.slj = [218, 224, 231][k]; t.results.cmj = [36.1, 37.4, 38.9][k]; if (t.results.yoyo != null) t.results.yoyo = [960, 1120, 1280][k]; if (t.results.mbt != null) t.results.mbt = [5.1, 5.6, 6.1][k]; });
    db.tests.unshift({ id: 'TST-PR-0', athleteId: pr.id, date: '2026-01-18', results: { sprint30: 4.61, flying20: 2.36, slj: 211, cmj: 34.8 }, enteredBy: 'District Talent Hunt, Pune', event: 'District Talent Hunt' });

    /* ---------- tasks, notifications, activity */
    db.tasks.push(
      { id: 'TSK-1', title: 'Assign coach to Sakshi Malik', ownerRole: 'ops', module: 'athletes', status: 'Open', due: TODAY, created: '2026-10-11', ref: 'APP-807' },
      { id: 'TSK-2', title: 'Doctor clearance — Kavya Nair (ankle)', ownerRole: 'doctor', module: 'medical', status: 'Open', due: '2026-10-14', created: '2026-10-12', athleteId: kavya.id, ref: kInj.id },
      { id: 'TSK-3', title: 'Assess Yash More — left groin', ownerRole: 'physio', module: 'medical', status: 'Open', due: TODAY, created: TODAY, athleteId: yash.id },
      { id: 'TSK-4', title: 'Review Rohan Gaikwad stage 3 criteria', ownerRole: 'physio', module: 'medical', status: 'Open', due: TODAY, created: '2026-10-11', athleteId: rohan.id, ref: rInj.id },
      { id: 'TSK-5', title: 'Publish Week 42 microcycle — U-17 Sprints', ownerRole: 'coach', module: 'training', status: 'Done', due: '2026-10-11', created: '2026-10-09' },
      { id: 'TSK-6', title: 'Upload blood test report — Priya Deshmukh', ownerRole: 'athlete', module: 'athletes', status: 'Open', due: '2026-10-20', created: '2026-10-05', athleteId: pr.id },
    );
    db.notifications.push(
      { id: 'NTF-1', toRole: 'coach', title: 'Injury reported', text: 'Yash More reported left groin pain from the athlete app.', athleteId: yash.id, at: TODAY + 'T06:52', read: false },
      { id: 'NTF-2', toRole: 'physio', title: 'New injury to assess', text: 'Yash More — left groin, reported 06:52.', athleteId: yash.id, at: TODAY + 'T06:52', read: false },
      { id: 'NTF-3', toRole: 'doctor', title: 'Clearance requested', text: 'Neha Kulkarni requested return-to-play clearance for Kavya Nair.', athleteId: kavya.id, at: '2026-10-12T17:40', read: false },
      { id: 'NTF-4', toRole: 'ops', title: 'Approved — coach needed', text: 'Sakshi Malik approved 2 days ago and still has no coach.', at: '2026-10-12T10:05', read: false },
      { id: 'NTF-5', toRole: 'director', title: 'Weekly centre report ready', text: 'Week 41 report: injuries down 12% vs last month across 9 centres.', at: '2026-10-12T08:00', read: true },
      { id: 'NTF-6', toRole: 'scientist', title: 'Wearable sync', text: '41 Catapult sessions imported overnight; 2 unmatched devices.', at: TODAY + 'T05:10', read: false },
      { id: 'NTF-7', toRole: 'nutritionist', title: 'Low hydration compliance', text: 'U-20 Freestyle at Sonipat logged 58% hydration targets last week.', at: '2026-10-12T19:20', read: false },
    );
    const act = (t, text, by, role, athleteId, type) => db.activity.push({ id: 'ACT-' + db.activity.length, at: TODAY + 'T' + t, text, by, role, athleteId, type });
    act('06:52', 'Yash More reported left groin pain (athlete app)', 'Yash More', 'athlete', yash.id, 'injury');
    act('06:31', 'Priya Deshmukh checked in — readiness 30 (red)', 'Priya Deshmukh', 'athlete', pr.id, 'checkin');
    act('05:10', '41 GPS sessions imported from Catapult', 'System', 'system', null, 'integration');
    db.activity.push({ id: 'ACT-x1', at: '2026-10-12T17:40', text: 'Clearance requested for Kavya Nair', by: 'Neha Kulkarni', role: 'physio', athleteId: kavya.id, type: 'medical' });
    db.activity.push({ id: 'ACT-x2', at: '2026-10-12T16:05', text: 'Week 42 microcycle published for U-17 Sprints', by: 'Rakesh Patil', role: 'coach', type: 'training' });
    db.activity.push({ id: 'ACT-x3', at: '2026-10-12T10:05', text: 'Sakshi Malik approved — awaiting coach assignment', by: 'Leela Rajan', role: 'ops', type: 'onboarding' });

    // clean internal generator fields
    db.athletes.forEach((a) => { a.baseRPE = AMS.round(a.baseRPE, 2); a.wellBase = AMS.round(a.wellBase, 2); a.loadMult = AMS.round(a.loadMult, 2); });
    return db;
  };
})();
