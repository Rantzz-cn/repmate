import { getAll, get, put, remove } from './db.js';
import { exercises as seeds, starterProgram, defaultProfile } from './seed-data.js';
import { routes, currentRoute, startRouter } from './router.js';
import { esc, toast, confirmModal } from './ui.js';
import { newWorkout, workoutStats, overload } from './workout.js';
import { filterExercises, alternatives } from './exercises.js';
import { activeProgram, scheduledDay } from './programs.js';
import { aggregate, drawChart } from './progress.js';
import { startTimer } from './timer.js';
import { setupPWA } from './pwa.js';
import { requireSession, signOut } from './auth.js';

const app = document.querySelector('#app');
const reportError = (error, context) => window.__REPMATE_CAPTURE_ERROR__?.(error, context);
const syncStatus = document.querySelector('#sync-status');
const updateSyncStatus = ({ status, pending = 0 }) => {
  if (!syncStatus) return;
  syncStatus.className = `sync-status sync-status--${status}`;
  syncStatus.textContent = status === 'offline' ? `Offline${pending ? ` · ${pending} pending` : ''}` : status === 'syncing' ? `Syncing${pending ? ` · ${pending}` : ''}` : 'Synced';
  syncStatus.hidden = false;
  clearTimeout(updateSyncStatus.timer);
  if (status === 'synced') updateSyncStatus.timer = setTimeout(() => { syncStatus.hidden = true; }, 1800);
};
window.addEventListener('repmate:sync', (event) => updateSyncStatus(event.detail));
if (!navigator.onLine) updateSyncStatus({ status: 'offline' });
let state = {
  exercises: [],
  programs: [],
  workouts: [],
  profile: null,
  active: null,
  filters: { q: '', muscle: '', equipment: '' },
};
const nav = [
  ['today', 'Today'],
  ['program', 'Program'],
  ['exercises', 'Exercises'],
  ['progress', 'Progress'],
  ['profile', 'Profile'],
];
const navIcons = {
  today: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/>',
  program: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  exercises: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
  progress: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const navIcon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${navIcons[name]}</svg>`;
const routePaths = {
  today: '/app',
  program: '/app/programs',
  exercises: '/app/exercises',
  workout: '/app/workout',
  progress: '/app/progress',
  profile: '/app/profile',
};
const routeHref = (route) => routePaths[route] || '/app';
const navHTML = () =>
  nav
    .map(
      ([r, n]) =>
        `<a href="${routeHref(r)}" class="nav-link ${currentRoute() === r ? 'active' : ''}" ${currentRoute() === r ? 'aria-current="page"' : ''}><span class="nav-icon">${navIcon(r)}</span><span>${n}</span></a>`,
    )
    .join('');
function renderNav() {
  document.querySelector('#desktop-nav').innerHTML = navHTML();
  document.querySelector('#mobile-nav').innerHTML = navHTML();
}
function normalizeAssetUrls(root = document) {
  root.querySelectorAll('[src^="assets/"]').forEach((element) => {
    element.setAttribute('src', `/${element.getAttribute('src')}`);
  });
}
async function initializeAccount(user) {
  if (!(await getAll('exercises')).length)
    for (const x of seeds) {
      if (x.name === 'Dumbbell Biceps Curl') x.video = '/assets/videos/bicepcurls.mp4';
      await put('exercises', x);
    }

  // Remove the original demo records from accounts created before real-data onboarding.
  await Promise.all([
    remove('programs', 'program-ppl'),
    remove('workouts', 'sample-1'),
  ]);

  const profiles = await getAll('profile');
  let profile = profiles[0];
  if (!profile) {
    profile = {
      ...defaultProfile,
      name:
        user?.user_metadata?.name ||
        user?.user_metadata?.full_name ||
        defaultProfile.name,
    };
    await put('profile', profile);
  }

  if (profile.muscleMapVersion !== 3) {
    const savedExercises = new Map(
      (await getAll('exercises')).map((exercise) => [exercise.id, exercise]),
    );
    for (const source of seeds) {
      const saved = savedExercises.get(source.id);
      if (!saved) continue;
      saved.name = source.name;
      saved.equipment = source.equipment;
      saved.movement = source.movement;
      saved.primaryMuscle = source.primaryMuscle;
      saved.secondaryMuscles = [...source.secondaryMuscles];
      await put('exercises', saved);
    }
    profile.muscleMapVersion = 3;
    await put('profile', profile);
  }

  if (!profile.starterProgramInitialized) {
    if (!(await getAll('programs')).length) {
      await put('programs', starterProgram);
    }
    profile.starterProgramInitialized = true;
    await put('profile', profile);
  }
}
async function load() {
  state.exercises = await getAll('exercises');
  const curl = state.exercises.find((x) => x.name === 'Dumbbell Biceps Curl');
  if (curl && curl.video !== '/assets/videos/bicepcurls.mp4') {
    curl.video = '/assets/videos/bicepcurls.mp4';
    await put('exercises', curl);
  }
  state.programs = await getAll('programs');
  state.workouts = await getAll('workouts');
  state.profile = await get('profile', 'me');
  state.active = await get('activeWorkout', 'active');
}
const exMap = () => new Map(state.exercises.map((x) => [x.id, x]));
const head = (title, sub, action = '') =>
  `<header class="page-head"><div><p class="eyebrow">${esc(sub)}</p><h1>${esc(title)}</h1></div>${action}</header>`;
const metric = (n, l) =>
  `<div class="card metric"><strong>${n}</strong><span class="muted">${l}</span></div>`;
function buddyMessage(day, recent) {
  if (state.active)
    return `Your ${state.active.name} session is waiting. Finish what you started. You are already in motion.`;
  const complete = state.workouts
      .filter((w) => w.completedAt)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)),
    streak = workoutStreak();
  if (complete.length > 1) {
    const latest = workoutStats(complete[0]).volume,
      previous = workoutStats(complete[1]).volume,
      change = previous ? Math.round(((latest - previous) / previous) * 100) : 0;
    if (change >= 5)
      return `Strong progress. Your last session volume increased ${change}%. Keep the form clean and build patiently.`;
    if (change < 0)
      return 'One quieter session does not erase progress. Show up, control the reps, and let consistency do the work.';
  }
  if (streak >= 2)
    return `${streak} training days in a row. Protect the streak with controlled, quality work.`;
  if (day?.exercises?.length)
    return `${day.name} is ready: ${day.exercises.length} exercises. Today’s goal is simple. One good set at a time.`;
  if (recent)
    return 'Recovery is part of progress. Recharge today so the next session stays strong.';
  return 'Your plan is ready. One focused session is all it takes to begin.';
}
function workoutStreak() {
  const days = new Set(
    state.workouts
      .filter((w) => w.completedAt)
      .map((w) => new Date(w.completedAt).toISOString().slice(0, 10)),
  );
  if (!days.size) return 0;
  let streak = 0,
    date = new Date();
  for (let i = 0; i < 365; i++) {
    const key = date.toISOString().slice(0, 10);
    if (days.has(key)) streak++;
    else if (i > 0) break;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}
function homeOverview() {
  const program = activeProgram(state.programs),
    now = Date.now(),
    week = state.workouts.filter((w) => w.completedAt && now - new Date(w.completedAt) < 604800000),
    volume = week.reduce((sum, w) => sum + workoutStats(w).volume, 0);
  let next = null;
  for (let offset = 0; offset < 7 && !next; offset++) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const day = program?.days.find(
      (item) => item.weekday === date.getDay() && item.exercises.length,
    );
    if (day) next = { day, offset };
  }
  return `<section class="home-overview" aria-label="Training snapshot"><div class="home-overview__lead"><p class="eyebrow">Weekly Volume</p><strong>${Math.round(volume).toLocaleString()}</strong><span>${state.profile.units} lifted</span></div><div class="home-overview__stats"><div><span>Streak</span><strong>${workoutStreak()} day${workoutStreak() === 1 ? '' : 's'}</strong></div><div><span>This Week</span><strong>${week.length} session${week.length === 1 ? '' : 's'}</strong></div><div><span>Next Workout</span><strong>${esc(next?.day.name || 'Rest')}</strong><small>${next?.offset === 0 ? 'Today' : next?.offset === 1 ? 'Tomorrow' : next ? `In ${next.offset} days` : 'Not scheduled'}</small></div></div></section>`;
}
function enhanceHomepage() {
  const form = document.querySelector('#recovery-form');
  if (!form) return;
  const heading = form.previousElementSibling;
  if (heading)
    heading.innerHTML =
      '<div><p class="eyebrow">Coach Check-In</p><h2>Today’s Readiness</h2></div><span class="badge">One tap</span>';
  form.outerHTML = `<section class="card readiness-panel"><div class="readiness-options" role="group" aria-label="Choose today’s readiness"><button class="readiness-option" data-action="readiness" data-level="strong"><span>↑</span><strong>Strong</strong><small>Ready to push</small></button><button class="readiness-option" data-action="readiness" data-level="steady"><span>→</span><strong>Steady</strong><small>Train as planned</small></button><button class="readiness-option" data-action="readiness" data-level="sore"><span>↓</span><strong>Sore</strong><small>Adjust intensity</small></button></div><div class="readiness-advice"><span class="readiness-advice__logo"><img src="assets/images/logo.png" alt="RepMate"></span><p>Choose how you feel and RepMate will adjust today’s coaching focus.</p></div></section>`;
}
const goriPhrases = [
  'Control the weight. Own every rep.',
  'Strong form builds lasting strength.',
  'Train with purpose, not just intensity.',
  'The best set is the one performed well.',
  'Small improvements become serious progress.',
];
let goriPhraseIndex = new Date().getMinutes() % goriPhrases.length;
function goriMessage() {
  const count = filterExercises(state.exercises, state.filters).length;
  if (state.filters.q)
    return `${count} match${count === 1 ? '' : 'es'} found. Choose quality over variety.`;
  if (state.filters.muscle) return `${state.filters.muscle} focus selected. Make every rep count.`;
  if (state.filters.equipment)
    return `${state.filters.equipment} movements ready. Pick one and master it.`;
  return goriPhrases[goriPhraseIndex];
}
function stripDeveloperExerciseControls() {
  document.querySelector('[data-action="add-exercise"]')?.remove();
  document
    .querySelectorAll('[data-action="delete-exercise"]')
    .forEach((control) => control.remove());
}
function enhanceExercises() {
  stripDeveloperExerciseControls();
  app.insertAdjacentHTML(
    'beforeend',
    `<button class="gori-float" data-action="gori-motivate" aria-label="Get another motivation from Gori Mate"><span class="gori-float__bubble"><b>Gori Mate</b><span>${esc(goriMessage())}</span></span><img src="assets/images/gorillamate.png" alt=""></button>`,
  );
}
function updateGoriMessage() {
  const message = document.querySelector('.gori-float__bubble>span');
  if (message) message.textContent = goriMessage();
}
function enhanceProgram() {
  document.querySelectorAll('.program-day').forEach((row) => {
    const start = row.querySelector('[data-action="start-workout"]');
    if (!start || start.disabled) return;
    const program = state.programs.find((item) => item.id === start.dataset.program),
      day = program?.days.find((item) => item.id === start.dataset.day);
    if (!day) return;
    const targets = [
      ...new Set(
        day.exercises.map((item) => exMap().get(item.exerciseId)?.primaryMuscle).filter(Boolean),
      ),
    ];
    const summary = row.querySelector('p');
    if (summary)
      summary.innerHTML = `${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'} · ${targets.map((target) => `<span class="muscle-name">${esc(target)}</span>`).join(', ')} · ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.weekday]}`;
    const actions = document.createElement('div');
    actions.className = 'program-day__actions';
    actions.innerHTML = `<button class="btn small ghost program-icon-btn" data-action="customize-day" data-program="${program.id}" data-day="${day.id}" aria-label="Edit ${esc(day.name)} workout" title="Edit workout"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Zm10-13 4 4M13 6l4 4"/></svg></button><button class="btn small program-icon-btn program-icon-btn--danger" data-action="delete-routine" data-program="${program.id}" data-day="${day.id}" aria-label="Delete ${esc(day.name)} routine" title="Delete routine"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"/></svg></button>`;
    start.classList.add('primary');
    start.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5"/></svg>';
    start.setAttribute('aria-label', `Start ${day.name} workout`);
    start.setAttribute('title', 'Start workout');
    start.before(actions);
    actions.append(start);
  });
}
function enhanceProgramDashboard() {
  const active = activeProgram(state.programs);
  if (active) {
    const trainingDays = active.days.filter((day) => day.exercises.length);
    const totalExercises = trainingDays.reduce((sum, day) => sum + day.exercises.length, 0);
    document.querySelector('.page-head')?.insertAdjacentHTML(
      'afterend',
      `<section class="program-overview"><div><p class="eyebrow">Active Plan</p><h2>${esc(active.name)}</h2><p>${esc(active.split)}</p></div><div class="program-overview__metrics"><span><strong>${trainingDays.length}</strong> Training Days</span><span><strong>${totalExercises}</strong> Exercises</span></div></section>`,
    );
  }

  document.querySelectorAll('#app > .list > .card').forEach((card) => {
    card.classList.add('program-card');
    const footer = card.querySelector(':scope > .actions');
    footer?.classList.add('program-card__footer');
    const program = state.programs.find((item) => item.id === footer?.querySelector('[data-id]')?.dataset.id);
    if (program && !card.querySelector('.program-body-map')) {
      card.querySelector(':scope > .list-row')?.insertAdjacentHTML('afterend', programBodyMap(program));
    }
    if (footer && program && !footer.querySelector('[data-action="new-routine"]')) {
      footer.insertAdjacentHTML('afterbegin', `<button class="btn small" data-action="new-routine" data-program="${program.id}">+ Add Routine</button>`);
    }
    if (card.querySelector('.badge')?.textContent.trim() === 'Active') {
      footer?.querySelector('[data-action="activate-program"]')?.remove();
    }
    const copy = footer?.querySelector('[data-action="duplicate-program"]');
    if (copy) copy.textContent = 'Copy Plan';
  });

  document.querySelectorAll('.program-day').forEach((row, index) => {
    const start = row.querySelector('[data-action="start-workout"]');
    const program = state.programs.find((item) => item.id === start?.dataset.program);
    const day = program?.days.find((item) => item.id === start?.dataset.day);
    if (!day) return;
    row.classList.add(day.exercises.length ? 'program-day--training' : 'program-day--rest');
    const info = row.firstElementChild;
    info?.insertAdjacentHTML('afterbegin', `<span class="program-day__number">${String(index + 1).padStart(2, '0')}</span>`);
    const targets = [...new Set(day.exercises.map((item) => exMap().get(item.exerciseId)?.primaryMuscle).filter(Boolean))];
    const summary = row.querySelector('p');
    if (summary) {
      summary.innerHTML = day.exercises.length
        ? `<span class="program-day__schedule">${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'} · ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.weekday]}</span><span class="program-day__targets">${targets.map((target) => `<b>${esc(target)}</b>`).join('')}</span>`
        : `<span class="program-day__schedule">Recovery · ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.weekday]}</span>`;
    }
  });
  mountProgramBodyMaps();
}

function today() {
  const p = activeProgram(state.programs),
    d = scheduledDay(p),
    recent = state.workouts
      .filter((x) => x.completedAt)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  return `${head(`Hi, ${state.profile.name}`, date)}<section class="buddy-card" aria-label="RepMate coach"><img src="assets/images/repmate.png" alt="RepMate, your workout coach"><div class="buddy-card__bubble"><p class="eyebrow">RepMate</p><p>${esc(buddyMessage(d, recent))}</p></div></section>${state.active ? `<div class="card"><p class="eyebrow">Session in progress</p><h2 style="margin:6px 0">You have an unfinished ${esc(state.active.name)} workout.</h2><div class="actions"><a class="btn primary" href="${routeHref('workout')}">Resume Workout</a><button class="btn danger" data-action="discard-workout">Discard</button></div></div>` : ''}<section class="card hero"><p class="eyebrow">${d?.exercises?.length ? 'Today’s training' : 'Recovery day'}</p><h2>${esc(d?.name || 'Rest & recover')}</h2><p class="muted">${d?.exercises?.length ? `${d.muscles.join(' · ')} · ${d.exercises.length} exercises · about ${state.profile.duration} min` : 'No workout is scheduled today. Light movement and quality sleep support your next session.'}</p>${d?.exercises?.length ? `<div class="actions"><button class="btn primary" data-action="start-workout" data-day="${d.id}">Start Workout</button></div>` : ''}</section><div class="section-title"><h2>Recovery check-in</h2><span class="badge" id="recovery-advice">Optional</span></div><form class="card form-grid" id="recovery-form">${['Energy', 'Sleep quality', 'Soreness'].map((x) => `<div class="field"><label>${x}</label><div class="rating" data-rating="${x.toLowerCase().split(' ')[0]}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-value="${n}" aria-label="${x} ${n} out of 5">${n}</button>`).join('')}</div></div>`).join('')}<div class="field"><label for="recovery-note">Note</label><textarea id="recovery-note" name="note" rows="2" placeholder="Anything affecting training today?"></textarea></div><button class="btn" type="submit">Save check-in</button></form><div class="section-title"><h2>Recent workout</h2></div>${recent ? historyCard(recent) : '<div class="card empty">Complete a workout to see it here.</div>'}`;
}
function historyCard(w) {
  const s = workoutStats(w);
  return `<article class="card list-row"><div><h3>${esc(w.name)}</h3><p>${new Date(w.completedAt).toLocaleDateString()} · ${Math.round((w.duration || 0) / 60)} min · ${s.sets} sets · ${Math.round(s.volume).toLocaleString()} ${state.profile.units}</p></div><button class="btn small" data-action="view-history" data-id="${w.id}">View</button></article>`;
}
function cleanHome() {
  const recent = state.workouts.filter((item) => item.completedAt).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0], now = Date.now(), week = state.workouts.filter((item) => item.completedAt && now - new Date(item.completedAt) < 604800000), volume = week.reduce((sum, item) => sum + workoutStats(item).volume, 0), active = state.active;
  const greeting = `Hi, ${state.profile.name}`;
  const readinessIcons = {
    strong: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-7 12h6l-1 8 7-12h-6l1-8Z"/></svg>',
    steady: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h3l2-5 3 9 2-6h6"/><path d="M4 5h16M4 21h16"/></svg>',
    sore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15a8 8 0 1 1-8-11 6 6 0 0 0 8 11Z"/><path d="M17 4v4M15 6h4"/></svg>',
  };
  return `${head(greeting, new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()))}<section class="buddy-card home-buddy" aria-label="RepMate coach"><img src="assets/images/repmate.png" alt="RepMate workout coach"><div class="buddy-card__bubble"><p class="eyebrow">RepMate</p><p>${active ? `Your ${esc(active.name)} session is waiting.` : recent ? 'Ready when you are.' : 'Let’s start your first session.'}</p></div></section>${active ? `<section class="home-active"><div><p class="eyebrow">Active Workout</p><h2>${esc(active.name)}</h2><p>${active.current + 1} of ${active.exercises.length} exercises</p></div><a class="btn primary" href="${routeHref('workout')}">Resume</a></section>` : ''}<section class="home-stats" aria-label="Weekly training statistics"><div><strong>${Math.round(volume).toLocaleString()}</strong><span>${esc(state.profile.units)} Volume</span></div><div><strong>${workoutStreak()}</strong><span>Day Streak</span></div><div><strong>${week.length}</strong><span>Sessions</span></div></section><div class="home-section-label"><h2>How are you feeling?</h2><span>Today</span></div><section class="readiness-panel home-readiness"><div class="readiness-options" role="group" aria-label="Choose how you feel today"><button class="readiness-option" data-action="readiness" data-level="strong"><span>${readinessIcons.strong}</span><strong>Great</strong><small>High energy</small></button><button class="readiness-option" data-action="readiness" data-level="steady"><span>${readinessIcons.steady}</span><strong>Okay</strong><small>Usual pace</small></button><button class="readiness-option" data-action="readiness" data-level="sore"><span>${readinessIcons.sore}</span><strong>Sore</strong><small>Take it easy</small></button></div></section><div class="home-section-label"><h2>Recent Workout</h2></div>${recent ? `<article class="home-recent"><div><h3>${esc(recent.name)}</h3><p>${new Date(recent.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${Math.round((recent.duration || 0) / 60)} min</p></div><button class="home-recent__view" data-action="view-history" data-id="${recent.id}" aria-label="View ${esc(recent.name)} workout">→</button></article>` : '<div class="home-empty">Your completed workouts will appear here.</div>'}`;
}
function enhanceCleanHome() {
  if (state.active || document.querySelector('.home-plan')) return;
  const plan = scheduledDay(activeProgram(state.programs)), buddy = document.querySelector('.home-buddy');
  if (!buddy) return;
  const hasProgram = Boolean(activeProgram(state.programs));
  const card = !hasProgram
    ? `<section class="home-plan home-plan--empty"><div class="home-plan__icon" aria-hidden="true">+</div><div><p class="home-plan__label">No program yet</p><h2>Build your first routine</h2><p>Choose days and exercises when you are ready.</p></div><a class="home-plan__start" href="${routeHref('program')}">Set up</a></section>`
    : plan?.exercises?.length
    ? `<section class="home-plan"><div class="home-plan__icon" aria-hidden="true">${navIcon('exercises')}</div><div><p class="eyebrow">Today’s Plan</p><h2>${esc(plan.name)}</h2><p>${plan.exercises.length} exercises · ${esc(plan.muscles.slice(0, 3).join(', '))}</p></div><button class="home-plan__start" data-action="start-workout" data-day="${plan.id}" aria-label="Start ${esc(plan.name)} workout">Start</button></section>`
    : `<section class="home-plan home-plan--rest"><div class="home-plan__icon" aria-hidden="true">○</div><div><p class="eyebrow">Today’s Plan</p><h2>Recovery</h2><p>Rest, move lightly, and recharge.</p></div></section>`;
  buddy.insertAdjacentHTML('afterend', card);
}
function workout() {
  const w = state.active;
  if (!w) {
    location.replace('/app');
    return '';
  }
  const item = w.exercises[w.current],
    ex = exMap().get(item.exerciseId),
    done = w.exercises.flatMap((x) => x.sets).filter((s) => s.done).length,
    total = w.exercises.flatMap((x) => x.sets).length,
    elapsed = Math.floor((Date.now() - new Date(w.startedAt)) / 1000);
  return `<div class="workout-top">${head(w.name, `Active · ${Math.floor(elapsed / 60)} min`, `<span class="badge" id="saved">Saved</span>`)}<div class="progress"><span style="width:${Math.round((done / total) * 100) || 0}%"></span></div></div><section class="card"><p class="eyebrow">Exercise ${w.current + 1} of ${w.exercises.length}</p><h2 style="margin:5px 0">${esc(ex.name)}</h2><div class="chips"><span class="chip">${esc(ex.primaryMuscle)}</span><span class="chip">${esc(ex.repRange)}</span><span class="chip">${ex.rest}s rest</span></div><div class="video-card"><img src="${esc(exerciseMedia(ex))}" alt="${esc(ex.name)} animated form demonstration"></div><div class="actions"><button class="btn small" data-action="replace" data-index="${w.current}">Replace exercise</button></div><h3 style="margin-top:18px">Form cues</h3><p class="muted">${ex.cues.map(esc).join(' · ')}</p></section><section class="card" id="sets"><h3>Working sets</h3>${item.sets.map((s, i) => setRow(s, i)).join('')}<button class="btn" data-action="add-set">+ Add set</button><p class="muted" style="margin-top:12px">${esc(overload(item))}</p></section><section class="card"><div class="field"><label for="exercise-notes">Exercise notes</label><textarea id="exercise-notes" data-workout-field="notes" rows="2">${esc(item.notes)}</textarea></div></section><div class="sticky-controls"><button class="btn" data-action="prev-ex" ${w.current === 0 ? 'disabled' : ''}>Previous</button><button class="btn primary" data-action="next-ex">${w.current === w.exercises.length - 1 ? 'Finish' : 'Next exercise'}</button></div>`;
}
function setRow(s, i) {
  return `<div class="set-row" data-set="${i}"><span class="set-index">${i + 1}</span><div class="field"><label>Weight</label><input inputmode="decimal" type="number" min="0" step="0.5" data-set-field="weight" value="${s.weight}"></div><div class="field"><label>Reps</label><input inputmode="numeric" type="number" min="0" data-set-field="reps" value="${s.reps}"></div><div class="field"><label>RIR</label><input inputmode="numeric" type="number" min="0" max="10" data-set-field="rir" value="${s.rir}"></div><input class="check" aria-label="Complete set ${i + 1}" type="checkbox" data-set-field="done" ${s.done ? 'checked' : ''}><button class="remove-set" type="button" data-action="remove-set" data-index="${i}" aria-label="Remove set ${i + 1}">−</button></div>`;
}

function validateCurrentExercise() {
  const item = state.active.exercises[state.active.current];
  const exercise = exMap().get(item.exerciseId);
  const weightRequired = exercise?.equipment !== 'bodyweight';
  const rows = [...document.querySelectorAll('#sets [data-set]')];
  const touched = item.sets.map((set, index) => ({ set, index })).filter(({ set }) => set.done || Number(set.weight) > 0 || Number(set.reps) > 0);
  const invalid = touched.filter(({ set }) => Number(set.reps) <= 0 || (weightRequired && Number(set.weight) <= 0));
  const completed = item.sets.some((set) => set.done && Number(set.reps) > 0 && (!weightRequired || Number(set.weight) > 0));

  rows.forEach((row) => {
    row.classList.remove('set-row--error');
    row.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
  });
  document.querySelector('.set-validation')?.remove();
  if (completed && !invalid.length) return true;

  let targets = invalid;
  let message = weightRequired
    ? 'Enter the weight and reps, then mark at least one set complete.'
    : 'Enter the reps, then mark at least one set complete.';
  if (!invalid.length && touched.length) {
    targets = touched.filter(({ set }) => !set.done);
    message = 'Mark at least one logged set complete before continuing.';
  }
  if (!targets.length) targets = [{ set: item.sets[0], index: 0 }];

  targets.forEach(({ set, index }) => {
    const row = rows[index];
    if (!row) return;
    row.classList.add('set-row--error');
    if (weightRequired && Number(set.weight) <= 0) row.querySelector('[data-set-field="weight"]')?.setAttribute('aria-invalid', 'true');
    if (Number(set.reps) <= 0) row.querySelector('[data-set-field="reps"]')?.setAttribute('aria-invalid', 'true');
  });

  const notice = document.createElement('p');
  notice.className = 'set-validation';
  notice.setAttribute('role', 'alert');
  notice.textContent = message;
  document.querySelector('#sets h3')?.insertAdjacentElement('afterend', notice);
  const firstInvalid = document.querySelector('#sets [aria-invalid="true"]') || document.querySelector('#sets .set-row--error .check');
  firstInvalid?.focus({ preventScroll: true });
  document.querySelector('#sets .set-row--error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  toast(message);
  return false;
}
function program() {
  if (!state.programs.length) {
    return `${head('Program', 'Plan your training', '<button class="btn small" data-action="new-program">+ New</button>')}
      <section class="program-empty" aria-labelledby="program-empty-title">
        <span class="program-empty__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z"/><path d="M8 8h6M8 12h4M19 8v6M16 11h6"/></svg>
        </span>
        <p class="eyebrow">Your Training Starts Here</p>
        <h2 id="program-empty-title">Create a Program</h2>
        <p>Build your weekly plan, choose your training days, and add the exercises you want to perform.</p>
        <button class="btn primary" data-action="new-program">Create Program</button>
      </section>`;
  }
  return `${head('Program', 'Plan your training', '<button class="btn small" data-action="new-program">+ New</button>')}<div class="list">${state.programs.map((p) => `<article class="card"><div class="list-row"><div><span class="eyebrow">${esc(p.split)}</span><h2>${esc(p.name)}</h2></div><span class="badge">${p.active ? 'Active' : 'Inactive'}</span></div>${p.days.map((d) => `<div class="program-day list-row"><div><h3>${esc(d.name)}</h3><p>${d.exercises.length ? `${d.exercises.length} exercises · ${d.muscles.join(', ')}` : 'Rest day'} · ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.weekday]}</p></div><button class="btn small" data-action="start-workout" data-day="${d.id}" data-program="${p.id}" ${!d.exercises.length ? 'disabled' : ''}>Start</button></div>`).join('')}<div class="actions" style="margin-top:14px"><button class="btn small" data-action="duplicate-program" data-id="${p.id}">Duplicate</button><button class="btn small" data-action="activate-program" data-id="${p.id}">Activate</button><button class="btn small danger" data-action="delete-program" data-id="${p.id}">Delete</button></div></article>`).join('')}</div>`;
}
function exerciseBenefit(x) {
  if (x.type === 'compound')
    return x.movement.includes('pull')
      ? 'Building back strength and pulling power'
      : x.movement === 'squat' || x.movement === 'hinge'
        ? 'Lower-body strength and muscle'
        : 'Strength and overall muscle gain';
  return x.primaryMuscle === 'core'
    ? 'Core control and stability'
    : `Focused ${x.primaryMuscle} development`;
}
function bodyMap(muscle) {
  const target = (part) => (muscle === part ? 'target' : '');
  return `<section class="body-map" aria-label="${esc(muscle)} muscle body map"><div class="body-map__head"><span>Body Map</span><span><b>Primary</b> / Secondary</span></div><div class="body-map__views"><div class="body-map__view"><span>Front</span><svg viewBox="0 0 140 260" role="img" aria-label="Front body highlighting ${esc(muscle)}"><circle class="body-part" cx="70" cy="25" r="16"/><path class="body-part ${target('shoulders')}" d="M40 58Q48 43 70 46Q92 43 100 58L92 78H48Z"/><path class="body-part ${target('chest')}" d="M48 60Q58 51 69 59V88Q54 88 46 78ZM92 60Q82 51 71 59V88Q86 88 94 78Z"/><path class="body-part ${target('core')}" d="M56 89H84L88 139H52Z"/><path class="body-part ${target('biceps')} ${target('triceps')}" d="M38 60Q27 70 24 101L33 108L48 78Z M102 60Q113 70 116 101L107 108L92 78Z"/><path class="body-part ${target('quadriceps')} ${target('glutes')}" d="M53 139H69L65 203H45Z M71 139H87L95 203H75Z"/><path class="body-part ${target('calves')}" d="M45 204H65L60 246H48Z M75 204H95L92 246H80Z"/></svg></div><div class="body-map__view"><span>Back</span><svg viewBox="0 0 140 260" role="img" aria-label="Back body highlighting ${esc(muscle)}"><circle class="body-part" cx="70" cy="25" r="16"/><path class="body-part ${target('shoulders')}" d="M40 58Q48 43 70 46Q92 43 100 58L94 73H46Z"/><path class="body-part ${target('back')}" d="M48 59Q70 72 92 59L86 131Q70 142 54 131Z"/><path class="body-part ${target('biceps')} ${target('triceps')}" d="M38 60Q27 70 24 106L34 111L48 74Z M102 60Q113 70 116 106L106 111L92 74Z"/><path class="body-part ${target('glutes')}" d="M52 132Q70 125 70 151Q52 163 46 148ZM88 132Q70 125 70 151Q88 163 94 148Z"/><path class="body-part ${target('hamstrings')}" d="M48 151H69L64 205H44Z M71 151H92L96 205H76Z"/><path class="body-part ${target('calves')}" d="M44 206H64L59 247H47Z M76 206H96L93 247H81Z"/></svg></div></div><p class="body-map__legend"><span></span>${esc(muscle)} is the primary target</p></section>`;
}
const muscleIds = {
  chest: ['chest-upper-left', 'chest-lower-left', 'chest-upper-right', 'chest-lower-right'],
  back: [
    'traps-upper-left',
    'traps-mid-left',
    'traps-lower-left',
    'traps-upper-right',
    'traps-mid-right',
    'traps-lower-right',
    'lats-upper-left',
    'lats-mid-left',
    'lats-lower-left',
    'lats-upper-right',
    'lats-mid-right',
    'lats-lower-right',
  ],
  shoulders: [
    'shoulder-front-left',
    'shoulder-side-left',
    'shoulder-front-right',
    'shoulder-side-right',
    'deltoid-rear-left',
    'deltoid-rear-right',
  ],
  biceps: ['biceps-left', 'biceps-right'],
  triceps: [
    'triceps-long-left',
    'triceps-lateral-left',
    'triceps-long-right',
    'triceps-lateral-right',
  ],
  core: [
    'abs-upper-left',
    'abs-upper-right',
    'abs-lower-left',
    'abs-lower-right',
    'obliques-left',
    'obliques-right',
  ],
  quadriceps: ['quads-left', 'quads-right'],
  hamstrings: [
    'hamstrings-medial-left',
    'hamstrings-lateral-left',
    'hamstrings-medial-right',
    'hamstrings-lateral-right',
  ],
  glutes: [
    'gluteus-medius-left',
    'gluteus-maximus-left',
    'gluteus-medius-right',
    'gluteus-maximus-right',
  ],
  calves: [
    'calves-gastroc-medial-left',
    'calves-gastroc-lateral-left',
    'calves-soleus-left',
    'calves-gastroc-medial-right',
    'calves-gastroc-lateral-right',
    'calves-soleus-right',
  ],
};

function programMuscleState(program) {
  const scores = new Map();
  program.days
    .flatMap((day) => day.exercises)
    .forEach((item) => {
      const exercise = exMap().get(item.exerciseId);
      if (!exercise) return;
      scores.set(exercise.primaryMuscle, (scores.get(exercise.primaryMuscle) || 0) + 2);
      exercise.secondaryMuscles.forEach((muscle) => {
        scores.set(muscle, (scores.get(muscle) || 0) + 1);
      });
    });

  const maxScore = Math.max(...scores.values(), 1);
  return Object.fromEntries(
    [...scores].flatMap(([muscle, score]) =>
      (muscleIds[muscle] || []).map((id) => [
        id,
        { intensity: Math.max(3, Math.round((score / maxScore) * 8)), selected: true },
      ]),
    ),
  );
}

function programBodyMap(program) {
  return `<section class="program-body-map" data-program-body="${esc(program.id)}" aria-label="Muscles trained by ${esc(program.name)}">
    <header><span>Muscle Coverage</span><small>Primary and supporting targets</small></header>
    <div class="program-body-map__charts">
      <div><span>Front</span><div class="program-body-map__front"></div></div>
      <div><span>Back</span><div class="program-body-map__back"></div></div>
    </div>
  </section>`;
}

function mountProgramBodyMaps() {
  if (!window.BodyMuscles) return;
  const { BodyChart, ViewSide } = window.BodyMuscles;
  document.querySelectorAll('[data-program-body]').forEach((container) => {
    const program = state.programs.find((item) => item.id === container.dataset.programBody);
    if (!program) return;
    const bodyState = programMuscleState(program);
    new BodyChart(container.querySelector('.program-body-map__front'), {
      view: ViewSide.FRONT,
      bodyState,
      ariaLabel: `Front muscles trained by ${program.name}`,
      enableTransitions: true,
    });
    new BodyChart(container.querySelector('.program-body-map__back'), {
      view: ViewSide.BACK,
      bodyState,
      ariaLabel: `Back muscles trained by ${program.name}`,
      enableTransitions: true,
    });
  });
}
const mismatchedAnimations = new Set();
const animatedExercises = new Set(
  seeds.filter((exercise) => !mismatchedAnimations.has(exercise.name)).map((exercise) => exercise.name),
);
const mediaSlug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
const exerciseMedia = (exercise) =>
  animatedExercises.has(exercise.name)
    ? `/assets/animations/${mediaSlug(exercise.name)}.gif`
    : '/assets/images/fallback.webp';
function anatomyMap(exercise) {
  return `<section class="body-map body-map--anatomical" aria-label="Muscles trained by ${esc(exercise.name)}"><div class="body-map__head"><span>Body Map</span><span><b>Primary</b> / Secondary</span></div><div class="body-map__views"><div class="body-map__view"><span>Front</span><div id="anatomy-front" class="anatomy-chart"></div></div><div class="body-map__view"><span>Back</span><div id="anatomy-back" class="anatomy-chart"></div></div></div></section>`;
}
function mountBodyCharts(exercise) {
  if (!window.BodyMuscles) return;
  const { BodyChart, ViewSide } = window.BodyMuscles,
    primaryState = (muscleIds[exercise.primaryMuscle] || []).map((id) => [id, { intensity: 8, selected: true }]),
    secondaryState = exercise.secondaryMuscles.flatMap((muscle) =>
      (muscleIds[muscle] || []).map((id) => [id, { intensity: 4, selected: true }]),
    ),
    state = Object.fromEntries([...secondaryState, ...primaryState]);
  new BodyChart(document.querySelector('#anatomy-front'), {
    view: ViewSide.FRONT,
    bodyState: state,
    ariaLabel: `Front muscles trained by ${exercise.name}`,
    enableTransitions: true,
  });
  new BodyChart(document.querySelector('#anatomy-back'), {
    view: ViewSide.BACK,
    bodyState: state,
    ariaLabel: `Back muscles trained by ${exercise.name}`,
    enableTransitions: true,
  });
}
function exerciseLibrary() {
  const items = filterExercises(state.exercises, state.filters),
    muscles = [...new Set(state.exercises.map((x) => x.primaryMuscle))].sort(),
    equipment = [...new Set(state.exercises.map((x) => x.equipment))].sort();
  return `${head('Exercises', `${state.exercises.length} movements`, '<button class="btn primary small" data-action="add-exercise">+ Add</button>')}<div class="filters"><input class="search" data-filter="q" value="${esc(state.filters.q)}" type="search" placeholder="Search exercises" aria-label="Search exercises"><select data-filter="muscle" aria-label="Filter by muscle"><option value="">All muscles</option>${muscles.map((x) => `<option ${state.filters.muscle === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><select data-filter="equipment" aria-label="Filter by equipment"><option value="">All equipment</option>${equipment.map((x) => `<option ${state.filters.equipment === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div><div class="exercise-grid">${items.map((x, i) => `<article class="card exercise-card" role="button" tabindex="0" data-action="view-exercise" data-id="${x.id}" aria-label="View ${esc(x.name)} details" style="--card-index:${i}"><div class="exercise-card__media"><img src="${esc(exerciseMedia(x))}" alt="${animatedExercises.has(x.name) ? `${esc(x.name)} animated form preview` : 'RepMate exercise placeholder'}" loading="lazy"><button class="btn icon-btn exercise-card__favorite" data-action="favorite" data-id="${x.id}" aria-label="${x.favorite ? 'Remove from' : 'Add to'} favorites" aria-pressed="${x.favorite}">${x.favorite ? '★' : '☆'}</button><span class="badge exercise-card__type">${esc(x.type)}</span>${animatedExercises.has(x.name) ? '<span class="exercise-card__play" aria-hidden="true">▶</span>' : ''}</div><div class="exercise-card__body"><div><p class="eyebrow">${esc(x.equipment)} · ${esc(x.repRange)}</p><h3>${esc(x.name)}</h3></div><dl class="exercise-card__facts"><div><dt>Muscles</dt><dd>${esc(x.primaryMuscle)}${x.secondaryMuscles.length ? `, ${esc(x.secondaryMuscles.join(', '))}` : ''}</dd></div><div><dt>Good for</dt><dd>${esc(exerciseBenefit(x))}</dd></div></dl><span class="exercise-card__link">${animatedExercises.has(x.name) ? 'View animation' : 'View details'} <span aria-hidden="true">→</span></span>${x.custom ? `<button class="btn small danger" data-action="delete-exercise" data-id="${x.id}">Delete</button>` : ''}</div></article>`).join('') || '<div class="card empty">No exercises match these filters.</div>'}</div>`;
}
function refreshExerciseResults() {
  const current = document.querySelector('.exercise-grid');
  if (!current) return;
  const template = document.createElement('template');
  template.innerHTML = exerciseLibrary();
  const next = template.content.querySelector('.exercise-grid');
  current.replaceChildren(...next.childNodes);
  stripDeveloperExerciseControls();
  updateGoriMessage();
}
function progress() {
  const a = aggregate(state.workouts),
    complete = state.workouts.filter((x) => x.completedAt),
    thisWeek = complete.filter((x) => Date.now() - new Date(x.completedAt) < 604800000).length,
    weights = complete.map((w) => workoutStats(w).volume).reverse();
  const chartEmpty = complete.length < 2
    ? `<div class="progress-chart-empty"><span aria-hidden="true">${navIcon('exercises')}</span><p>Complete two workouts to see your training trend.</p></div>`
    : '';
  return `${head('Progress', 'Strength over time')}<div class="stats progress-metrics">${metric(a.workouts, 'Workouts')}${metric(thisWeek, 'This week')}${metric(a.sets, 'Total sets')}${metric(`${Math.round(a.volume).toLocaleString()} ${state.profile.units}`, 'Total volume')}</div><section class="card progress-chart-card"><h2>Training volume</h2><p class="muted">Completed session volume</p><div class="canvas-wrap"><canvas id="progress-chart" aria-label="Workout volume trend"></canvas>${chartEmpty}</div></section><div class="section-title"><h2>Workout history</h2></div><div class="list">${
    complete
      .sort((x, y) => new Date(y.completedAt) - new Date(x.completedAt))
      .map(historyCard)
      .join('') || '<div class="card empty">No completed workouts yet.</div>'
  }</div>`;
}
function profile() {
  const p = state.profile;
  const initial = (p.name || 'R').trim().charAt(0).toUpperCase();
  return `${head('Profile', 'Your account')}<section class="profile-summary"><div class="profile-avatar" aria-hidden="true">${esc(initial)}</div><div><h2>${esc(p.name)}</h2><p>${esc(p.goal)}</p></div></section><form id="profile-form" class="profile-settings"><section class="card profile-section"><div class="profile-section__head"><h2>Training Preferences</h2><p>Personalize how RepMate plans and records your sessions.</p></div><div class="profile-fields"><div class="field"><label for="name">Display name</label><input id="name" name="name" value="${esc(p.name)}" required maxlength="40" autocomplete="name"></div><div class="field"><label for="goal">Training goal</label><select id="goal" name="goal">${['Maintain muscle while cutting', 'Build muscle', 'Strength', 'General fitness', 'Custom'].map((x) => `<option ${p.goal === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label for="units">Weight units</label><select id="units" name="units"><option value="kg" ${p.units === 'kg' ? 'selected' : ''}>Kilograms (kg)</option><option value="lb" ${p.units === 'lb' ? 'selected' : ''}>Pounds (lb)</option></select></div><div class="field"><label for="theme">Appearance</label><select id="theme" name="theme"><option value="dark" ${p.theme === 'dark' ? 'selected' : ''}>Dark</option><option value="light" ${p.theme === 'light' ? 'selected' : ''}>Light</option></select></div></div></section><section class="card profile-section"><div class="profile-section__head"><h2>Workout Feedback</h2><p>Choose the cues you want during training.</p></div><label class="profile-toggle"><span><b>Rest timer notifications</b><small>Alert me when a rest period ends.</small></span><input type="checkbox" name="notifications" ${p.notifications ? 'checked' : ''}></label><label class="profile-toggle"><span><b>Vibration</b><small>Use haptics for set and timer feedback.</small></span><input type="checkbox" name="vibration" ${p.vibration ? 'checked' : ''}></label></section><button class="btn primary profile-save" type="submit">Save changes</button></form><section class="profile-account"><button class="btn" type="button" data-install>Install RepMate</button><button class="btn ghost" type="button" data-action="logout">Sign out</button></section>`;
}
function enhanceActiveWorkout() {
  if (!state.active) return;
  const item = state.active.exercises[state.active.current];
  const exercise = exMap().get(item.exerciseId);
  const sets = document.querySelector('#sets');
  const heading = sets?.querySelector(':scope > h3');
  if (heading) {
    heading.outerHTML = `<header class="workout-set-card__head"><span class="set-drag" aria-hidden="true">≡</span><div><h3>${esc(exercise.name)}</h3><div class="workout-set-card__tags"><span>${esc(exercise.primaryMuscle)}</span><span>${esc(exercise.equipment)}</span></div></div><button class="set-menu" type="button" aria-label="Exercise options">•••</button></header>`;
  }
  sets?.classList.add('workout-set-card');
  if (sets && !sets.querySelector('.set-column-labels')) {
    sets.querySelector('.workout-set-card__head')?.insertAdjacentHTML(
      'afterend',
      `<div class="set-column-labels" aria-hidden="true"><span>Set</span><span>Weight (${esc(state.profile.units)})</span><span>Reps</span><span>Done</span><span>Remove</span></div>`,
    );
  }
  sets?.querySelector('[data-action="add-set"]')?.classList.add('add-set-cta');

  const media = document.querySelector('.video-card');
  if (media && !document.querySelector('.active-workout-map')) {
    media.insertAdjacentHTML('afterend', anatomyMap(exercise));
    const map = media.nextElementSibling;
    map.classList.add('active-workout-map');
    mountBodyCharts(exercise);
  }
}
function render() {
  renderNav();
  const route = currentRoute();
  app.innerHTML =
    route === 'workout'
      ? workout()
      : route === 'program'
        ? program()
        : route === 'exercises'
          ? exerciseLibrary()
          : route === 'progress'
            ? progress()
            : route === 'profile'
              ? profile()
              : cleanHome();
  if (route === 'today') enhanceCleanHome();
  if (route === 'exercises') {
    enhanceExercises();
    const detailId = location.pathname.match(/^\/app\/exercises\/([^/]+)$/)?.[1];
    if (detailId) requestAnimationFrame(() => {
      const exercise = exMap().get(decodeURIComponent(detailId));
      if (exercise && !document.querySelector('#modal').open) showExerciseDetails(exercise);
    });
  }
  if (route === 'program') {
    enhanceProgram();
    enhanceProgramDashboard();
  }
  if (route === 'workout') enhanceActiveWorkout();
  normalizeAssetUrls(app);
  app.classList.remove('page-enter');
  requestAnimationFrame(() => app.classList.add('page-enter'));
  if (route === 'progress')
    requestAnimationFrame(() =>
      drawChart(
        document.querySelector('#progress-chart'),
        state.workouts.filter((x) => x.completedAt).map((x) => workoutStats(x).volume),
      ),
    );
}
async function saveActive() {
  await put('activeWorkout', state.active);
  const s = document.querySelector('#saved');
  if (s) {
    s.textContent = 'Saved';
    setTimeout(() => (s.textContent = 'Autosave on'), 900);
  }
}
function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type.startsWith('image/')) return reject(new Error('Please select an image file.'));
    if (file.size > 8e6) return reject(new Error('Choose an image smaller than 8 MB.'));
    const image = new Image(),
      url = URL.createObjectURL(file),
      timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        reject(new Error('The photo took too long to process. Try a smaller JPG or PNG.'));
      }, 15000);
    image.onload = () => {
      clearTimeout(timeout);
      try {
        const scale = Math.min(1, 1200 / Math.max(image.width, image.height)),
          canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.74));
      } catch (_) {
        reject(new Error('This photo could not be prepared for offline storage.'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be read.'));
    };
    image.src = url;
  });
}
function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
async function workoutShareImage(workout) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const stats = workoutStats(workout);
  const width = 1080, height = 1920, margin = 64;
  canvas.width = width;
  canvas.height = height;
  const contain = (image, x, y, boxWidth, boxHeight) => {
    const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
    const drawWidth = image.width * scale, drawHeight = image.height * scale;
    ctx.drawImage(image, x + (boxWidth - drawWidth) / 2, y + (boxHeight - drawHeight) / 2, drawWidth, drawHeight);
  };
  const containVisible = (image, x, y, boxWidth, boxHeight) => {
    const scan = document.createElement('canvas');
    scan.width = image.naturalWidth || image.width;
    scan.height = image.naturalHeight || image.height;
    const scanContext = scan.getContext('2d', { willReadFrequently: true });
    scanContext.drawImage(image, 0, 0);
    const pixels = scanContext.getImageData(0, 0, scan.width, scan.height).data;
    let left = scan.width, top = scan.height, right = 0, bottom = 0;
    for (let py = 0; py < scan.height; py++) {
      for (let px = 0; px < scan.width; px++) {
        if (pixels[(py * scan.width + px) * 4 + 3] < 18) continue;
        left = Math.min(left, px); top = Math.min(top, py); right = Math.max(right, px); bottom = Math.max(bottom, py);
      }
    }
    if (left > right || top > bottom) return contain(image, x, y, boxWidth, boxHeight);
    const sourceWidth = right - left + 1, sourceHeight = bottom - top + 1;
    const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
    const drawWidth = sourceWidth * scale, drawHeight = sourceHeight * scale;
    ctx.drawImage(image, left, top, sourceWidth, sourceHeight, x + (boxWidth - drawWidth) / 2, y + (boxHeight - drawHeight) / 2, drawWidth, drawHeight);
  };
  const cover = (image, x, y, boxWidth, boxHeight) => {
    const scale = Math.max(boxWidth / image.width, boxHeight / image.height);
    const drawWidth = image.width * scale, drawHeight = image.height * scale;
    ctx.drawImage(image, x + (boxWidth - drawWidth) / 2, y + (boxHeight - drawHeight) / 2, drawWidth, drawHeight);
  };
  const titleFontSize = (text) => {
    let size = 78;
    while (size > 42) {
      ctx.font = `900 ${size}px Inter, Arial`;
      if (ctx.measureText(text).width <= width - margin * 2) break;
      size -= 2;
    }
    return size;
  };

  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#121212'; ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 72) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y <= height; y += 72) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  try {
    containVisible(await loadCanvasImage('/assets/images/whitelogo.png'), margin, 34, 370, 108);
  } catch (_) {
    ctx.fillStyle = '#fff'; ctx.font = '800 42px Inter, Arial'; ctx.fillText('RepMate', margin, 100);
  }
  ctx.textAlign = 'right'; ctx.fillStyle = '#8c8c8c'; ctx.font = '650 20px Inter, Arial'; ctx.fillText('WORKOUT RECAP', width - margin, 91); ctx.textAlign = 'left';

  const mediaX = 48, mediaY = 150, mediaWidth = width - 96, mediaHeight = 900;
  ctx.save(); ctx.beginPath(); ctx.roundRect(mediaX, mediaY, mediaWidth, mediaHeight, 34); ctx.clip();
  if (workout.photo) {
    try { cover(await loadCanvasImage(workout.photo), mediaX, mediaY, mediaWidth, mediaHeight); }
    catch (_) { ctx.fillStyle = '#f4f4f2'; ctx.fillRect(mediaX, mediaY, mediaWidth, mediaHeight); }
  } else {
    ctx.fillStyle = '#f4f4f2'; ctx.fillRect(mediaX, mediaY, mediaWidth, mediaHeight);
    try { containVisible(await loadCanvasImage('/assets/images/logo.png'), mediaX + 90, mediaY + 210, mediaWidth - 180, 360); }
    catch (_) { ctx.fillStyle = '#101010'; ctx.font = '900 84px Inter, Arial'; ctx.textAlign = 'center'; ctx.fillText('REPMATE', width / 2, mediaY + 470); ctx.textAlign = 'left'; }
    ctx.fillStyle = '#777'; ctx.font = '600 24px Inter, Arial'; ctx.textAlign = 'center'; ctx.fillText('SESSION COMPLETE', width / 2, mediaY + 610); ctx.textAlign = 'left';
  }
  const fade = ctx.createLinearGradient(0, mediaY + 600, 0, mediaY + mediaHeight);
  fade.addColorStop(0, 'transparent'); fade.addColorStop(1, 'rgba(5,5,5,.72)'); ctx.fillStyle = fade; ctx.fillRect(mediaX, mediaY + 600, mediaWidth, 300); ctx.restore();
  ctx.strokeStyle = '#292929'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(mediaX, mediaY, mediaWidth, mediaHeight, 34); ctx.stroke();

  const contentY = 1120;
  ctx.fillStyle = '#9a9a9a'; ctx.font = '700 21px Inter, Arial'; ctx.fillText('REPMATE / WORKOUT COMPLETE', margin, contentY);
  const title = workout.name.toUpperCase(), titleSize = titleFontSize(title);
  ctx.fillStyle = '#fff'; ctx.font = `900 ${titleSize}px Inter, Arial`; ctx.fillText(title, margin, contentY + 88);
  ctx.fillStyle = '#8f8f8f'; ctx.font = '600 23px Inter, Arial'; ctx.fillText(new Date(workout.completedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(), margin, contentY + 132);

  const metrics = [[`${Math.max(1, Math.round(workout.duration / 60))}`, 'MINUTES'], [`${Math.round(stats.volume).toLocaleString()}`, `${state.profile.units.toUpperCase()} VOLUME`], [`${stats.sets}`, 'SETS']];
  const metricsY = 1310, metricsWidth = width - margin * 2, metricWidth = metricsWidth / 3;
  ctx.fillStyle = '#101010'; ctx.beginPath(); ctx.roundRect(margin, metricsY, metricsWidth, 154, 24); ctx.fill(); ctx.strokeStyle = '#292929'; ctx.stroke();
  metrics.forEach(([value, label], index) => {
    const x = margin + index * metricWidth;
    if (index) { ctx.strokeStyle = '#292929'; ctx.beginPath(); ctx.moveTo(x, metricsY + 28); ctx.lineTo(x, metricsY + 126); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.font = '750 39px Doto, monospace'; ctx.textAlign = 'center'; ctx.fillText(value, x + metricWidth / 2, metricsY + 69);
    ctx.fillStyle = '#858585'; ctx.font = '650 17px Inter, Arial'; ctx.fillText(label, x + metricWidth / 2, metricsY + 108);
  });
  ctx.textAlign = 'left'; ctx.fillStyle = '#8f8f8f'; ctx.font = '700 18px Inter, Arial'; ctx.fillText('TOP MOVEMENTS', margin, 1530);
  workout.exercises.map((item) => ({ name: exMap().get(item.exerciseId)?.name || 'Exercise', volume: item.sets.filter((set) => set.done).reduce((sum, set) => sum + set.weight * set.reps, 0) })).sort((a, b) => b.volume - a.volume).slice(0, 4).forEach((item, index) => {
    const y = 1590 + index * 64, label = item.name.length > 35 ? `${item.name.slice(0, 32)}…` : item.name;
    ctx.fillStyle = '#ededed'; ctx.font = '600 24px Inter, Arial'; ctx.fillText(label, margin, y);
    ctx.textAlign = 'right'; ctx.fillStyle = '#888'; ctx.font = '600 21px Doto, monospace'; ctx.fillText(`${Math.round(item.volume).toLocaleString()} ${state.profile.units.toUpperCase()}`, width - margin, y); ctx.textAlign = 'left';
  });
  ctx.strokeStyle = '#252525'; ctx.beginPath(); ctx.moveTo(margin, 1840); ctx.lineTo(width - margin, 1840); ctx.stroke();
  ctx.fillStyle = '#8a8a8a'; ctx.font = '600 18px Inter, Arial'; ctx.fillText('TRAIN. TRACK. REPEAT.', margin, 1880);
  ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '700 18px Inter, Arial'; ctx.fillText('REPMATE', width - margin, 1880); ctx.textAlign = 'left';
  return canvas;
}
async function showShareRecap(workout) {
  const canvas = await workoutShareImage(workout), imageUrl = canvas.toDataURL('image/png'), d = document.querySelector('#modal'), c = document.querySelector('#modal-content');
  c.innerHTML = `<div class="share-recap"><p class="eyebrow">Ready to Share</p><h2>Your Workout Recap</h2><img src="${imageUrl}" alt="RepMate recap for ${esc(workout.name)}"><div class="actions"><button class="btn" data-recap-close>Done</button><button class="btn" data-recap-save>Save Image</button><button class="btn primary" data-recap-share>Share</button></div></div>`;
  c.querySelector('[data-recap-close]').onclick = () => d.close();
  c.querySelector('[data-recap-save]').onclick = () => { const link = document.createElement('a'); link.href = imageUrl; link.download = `repmate-${workout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`; link.click(); };
  c.querySelector('[data-recap-share]').onclick = async () => { const blob = await canvasBlob(canvas), file = new File([blob], 'repmate-workout.png', { type: 'image/png' }); if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) { try { await navigator.share({ title: `${workout.name} workout`, text: 'Workout complete with RepMate.', files: [file] }); } catch (_) {} } else { c.querySelector('[data-recap-save]').click(); toast('Sharing is unavailable here, so the recap was saved instead.'); } };
  d.addEventListener('close', () => {
    if (location.pathname !== '/app/progress') location.assign('/app/progress');
  }, { once: true });
  d.showModal();
}
function requestSessionPhoto() {
  return new Promise((resolve) => {
    const d = document.querySelector('#modal'),
      c = document.querySelector('#modal-content');
    d.className = 'finish-photo-dialog';
    c.innerHTML = `<div class="finish-photo"><p class="eyebrow">Workout Complete</p><h2>Save This Session</h2><p class="muted">Optionally add a photo to remember today’s progress.</p><label class="photo-picker" for="session-photo"><span>＋</span><strong>Add Session Photo</strong><small>JPG, PNG or WebP · max 8 MB</small></label><input class="hidden" id="session-photo" type="file" accept="image/*"><img class="session-photo-preview hidden" alt="Selected session preview"><p class="photo-save-status" role="status" aria-live="polite"></p><div class="actions"><button type="button" class="btn" data-photo-skip>Skip photo</button><button type="button" class="btn primary" data-photo-finish>Finish workout</button></div></div>`;
    const input = c.querySelector('#session-photo'),
      preview = c.querySelector('.session-photo-preview'),
      status = c.querySelector('.photo-save-status'),
      finishButton = c.querySelector('[data-photo-finish]');
    let settled = false,
      done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
    d.onclose = () => {
      d.classList.remove('finish-photo-dialog');
      if (!settled) done(null);
    };
    d.oncancel = (event) => {
      event.preventDefault();
      d.close();
    };
    d.onclick = (event) => {
      if (event.target === d) d.close();
    };
    input.onchange = () => {
      if (input.files[0]) {
        status.textContent = 'Photo selected and ready to save offline.';
        preview.src = URL.createObjectURL(input.files[0]);
        preview.classList.remove('hidden');
      }
    };
    c.querySelector('[data-photo-skip]').onclick = () => {
      d.close();
      done(null);
    };
    finishButton.onclick = async () => {
      finishButton.disabled = true;
      finishButton.textContent = 'Preparing photo…';
      status.textContent = input.files[0] ? 'Compressing your photo for offline storage…' : 'Saving your workout…';
      try {
        const photo = await compressPhoto(input.files[0]);
        d.close();
        done(photo);
      } catch (error) {
        reportError(error, { feature: 'session-photo-processing' });
        status.textContent = `${error.message} You can choose another image or finish without it.`;
        status.classList.add('is-error');
        input.value = '';
        preview.classList.add('hidden');
        finishButton.disabled = false;
        finishButton.textContent = 'Finish without photo';
      }
    };
    d.showModal();
  });
}
async function finishWorkout() {
  const w = state.active,
    s = workoutStats(w);
  if (!s.sets) return toast('Complete at least one set first.');
  w.photo = await requestSessionPhoto();
  w.id = w.sessionId;
  w.completedAt = new Date().toISOString();
  w.duration = Math.floor((new Date(w.completedAt) - new Date(w.startedAt)) / 1000);
  try {
    await put('workouts', w);
  } catch (error) {
    reportError(error, { feature: 'workout-save', hasPhoto: Boolean(w.photo) });
    if (!w.photo) throw error;
    w.photo = null;
    await put('workouts', w);
    toast('Workout saved, but the photo could not fit in offline storage.');
  }
  await remove('activeWorkout', 'active');
  state.workouts.push(w);
  state.active = null;
  toast('Workout complete. Great work.');
  setTimeout(() => showShareRecap(w), 120);
}
function openForm(title, html, onSave) {
  const d = document.querySelector('#modal'),
    c = document.querySelector('#modal-content');
  c.innerHTML = `<h2>${esc(title)}</h2><form id="dialog-form" class="form-grid" style="margin-top:16px">${html}<div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`;
  d.showModal();
  c.querySelector('[data-close]').onclick = () => d.close();
  c.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    if (e.target.querySelector('input[type="search"]:focus')) return;
    const result = await onSave(new FormData(e.target));
    if (result !== false) d.close();
  };
}
function showExerciseDetails(x) {
  const d = document.querySelector('#modal'),
    c = document.querySelector('#modal-content');
  d.classList.add('exercise-dialog');
  document.body.classList.add('detail-open');
  const hitList = [x.primaryMuscle, ...x.secondaryMuscles].join(', ');
  const mediaCredit = animatedExercises.has(x.name)
    ? '<p class="media-credit">Exercise animation provided by <a href="https://exercisedb.dev/" target="_blank" rel="noopener">AscendAPI ExerciseDB</a>.</p>'
    : '<p class="media-credit">Animation pending exact movement verification.</p>';
  c.innerHTML = `<header class="exercise-detail__topbar"><button class="exercise-detail__back" data-close aria-label="Back to exercises">${navIcon('today')}</button><span>Exercise</span><span aria-hidden="true"></span></header><section class="exercise-detail__hero"><div class="exercise-detail__title"><p class="eyebrow">${esc(x.primaryMuscle)}</p><h1>${esc(x.name)}</h1><p>${esc(x.equipment)} · ${esc(x.repRange)}</p></div><div class="exercise-detail__media"><img src="${esc(exerciseMedia(x))}" alt="${animatedExercises.has(x.name) ? `${esc(x.name)} animated form demonstration` : 'RepMate exercise placeholder'}"></div></section>${anatomyMap(x)}<section class="exercise-detail__coaching"><dl class="exercise-detail__facts"><div><dt>Muscles Trained</dt><dd>${esc(hitList)}</dd></div><div><dt>Good For</dt><dd>${esc(exerciseBenefit(x))}</dd></div></dl><div class="section-title"><h2>How to Perform</h2></div><p>${esc(x.execution)}</p><div class="section-title"><h2>Form Cues</h2></div><ul class="cue-list">${x.cues.map((cue) => `<li>${esc(cue)}</li>`).join('')}</ul><div class="section-title"><h2>Avoid</h2></div><p class="muted">${x.mistakes.map(esc).join(' · ')}</p>${mediaCredit}<button class="btn primary cta-wide" data-close>Back to Exercises</button></section>`;
  d.onclose = () => {
    d.classList.remove('exercise-dialog');
    document.body.classList.remove('detail-open');
    if (location.pathname.startsWith('/app/exercises/')) location.assign('/app/exercises');
  };
  d.showModal();
  mountBodyCharts(x);
  c.querySelectorAll('[data-close]').forEach((button) => (button.onclick = () => d.close()));
}
function showWorkoutHistory(workout) {
  const dialog = document.querySelector('#modal'), content = document.querySelector('#modal-content'), stats = workoutStats(workout), map = exMap();
  content.innerHTML = `<section class="history-detail"><header class="history-detail__head"><div><p class="eyebrow">Completed Session</p><h2>${esc(workout.name)}</h2><p>${new Date(workout.completedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p></div><button class="history-detail__close" type="button" data-history-close aria-label="Close workout details">×</button></header>${workout.photo ? `<img class="history-detail__photo" src="${workout.photo}" alt="Photo from ${esc(workout.name)} session">` : ''}<div class="history-detail__metrics"><div><strong>${Math.max(1, Math.round((workout.duration || 0) / 60))}</strong><span>Minutes</span></div><div><strong>${stats.sets}</strong><span>Sets</span></div><div><strong>${Math.round(stats.volume).toLocaleString()}</strong><span>${esc(state.profile.units)} Volume</span></div></div><div class="history-detail__exercises">${workout.exercises.map((item) => { const exercise = map.get(item.exerciseId), sets = item.sets.filter((set) => set.done); return `<article><div><strong>${esc(exercise?.name || 'Exercise')}</strong><span>${esc(exercise?.primaryMuscle || '')}</span></div><p>${sets.map((set) => `${set.weight} ${state.profile.units} × ${set.reps}`).join(' · ') || 'No completed sets'}</p></article>`; }).join('')}</div><footer class="history-detail__actions"><button type="button" class="btn primary" data-action="share-workout" data-id="${workout.id}">Share Recap</button><button type="button" class="btn danger" data-history-delete="${workout.id}">Delete</button></footer></section>`;
  content.querySelector('[data-history-close]').onclick = () => dialog.close();
  dialog.classList.add('history-dialog');
  dialog.onclose = () => dialog.classList.remove('history-dialog');
  dialog.showModal();
}
function customizeProgramDay(button) {
  const program = state.programs.find((item) => item.id === button.dataset.program),
    day = program?.days.find((item) => item.id === button.dataset.day);
  if (!day) return;
  const selected = new Map(day.exercises.map((item) => [item.exerciseId, item])),
    savedOrder = day.exercises.map((item) => item.exerciseId),
    weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  openForm(
    `Customize ${day.name}`,
    `<div class="field"><label for="training-weekday">Training Day</label><select id="training-weekday" name="weekday">${weekdays.map((name, index) => `<option value="${index}" ${day.weekday === index ? 'selected' : ''}>${name}</option>`).join('')}</select></div><input type="hidden" name="exerciseOrder" value="${savedOrder.join(',')}"><p class="muted">Choose exercises, then arrange the exact order you want to perform them.</p><div class="exercise-picker">${state.exercises.map((exercise) => `<label class="exercise-picker__item"><input type="checkbox" name="exerciseId" value="${exercise.id}" ${selected.has(exercise.id) ? 'checked' : ''}><span><strong>${esc(exercise.name)}</strong><small>${esc(exercise.primaryMuscle)} · ${esc(exercise.equipment)}</small></span></label>`).join('')}</div>`,
    async (form) => {
      const checked = new Set(form.getAll('exerciseId')),
        ids = String(form.get('exerciseOrder') || '').split(',').filter((id) => checked.has(id));
      if (!ids.length) {
        toast('Keep at least one exercise in the workout.');
        return false;
      }
      day.weekday = Number(form.get('weekday'));
      day.exercises = ids.map(
        (id) => selected.get(id) || { exerciseId: id, sets: 3, minReps: 8, maxReps: 12 },
      );
      day.muscles = [
        ...new Set(ids.map((id) => exMap().get(id)?.primaryMuscle).filter(Boolean)),
      ].map((name) => name.charAt(0).toUpperCase() + name.slice(1));
      await put('programs', program);
      render();
      toast(`${day.name} is scheduled for ${weekdays[day.weekday]}.`);
    },
  );
}
function addProgramRoutine(button) {
  const program = state.programs.find((item) => item.id === button.dataset.program);
  if (!program) return;
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], used = new Set(program.days.map((day) => day.weekday));
  openForm(
    'Add Routine',
    `<div class="field"><label for="new-routine-name">Routine Name</label><input id="new-routine-name" name="name" placeholder="e.g. Pull Day" required></div><div class="field"><label for="new-routine-day">Training Day</label><select id="new-routine-day" name="weekday">${weekdays.map((name, index) => `<option value="${index}" ${used.has(index) ? 'disabled' : ''}>${name}${used.has(index) ? ' (already used)' : ''}</option>`).join('')}</select></div><input type="hidden" name="exerciseOrder" value=""><p class="muted">Choose exercises, then arrange your workout flow.</p><div class="exercise-picker">${state.exercises.map((exercise) => `<label class="exercise-picker__item"><input type="checkbox" name="exerciseId" value="${exercise.id}"><span><strong>${esc(exercise.name)}</strong><small>${esc(exercise.primaryMuscle)} · ${esc(exercise.equipment)}</small></span></label>`).join('')}</div>`,
    async (form) => {
      const checked = new Set(form.getAll('exerciseId')),
        ids = String(form.get('exerciseOrder') || '').split(',').filter((id) => checked.has(id));
      if (!ids.length) {
        toast('Select at least one exercise for this routine.');
        return false;
      }
      const weekday = Number(form.get('weekday'));
      if (program.days.some((day) => day.weekday === weekday)) {
        toast('That training day already has a routine.');
        return false;
      }
      program.days.push({
        id: crypto.randomUUID(),
        name: form.get('name').trim(),
        weekday,
        muscles: [...new Set(ids.map((id) => exMap().get(id)?.primaryMuscle).filter(Boolean))].map((name) => name.charAt(0).toUpperCase() + name.slice(1)),
        exercises: ids.map((exerciseId) => ({ exerciseId, sets: 3, minReps: 8, maxReps: 12 })),
      });
      program.days.sort((a, b) => a.weekday - b.weekday);
      await put('programs', program);
      render();
      toast(`${form.get('name').trim()} added.`);
    },
  );
  const dialog = document.querySelector('#modal');
  dialog.classList.add('program-customize-dialog');
  dialog.onclose = () => dialog.classList.remove('program-customize-dialog');
  enhanceCustomizeUX();
}
function enhanceCustomizeUX() {
  const dialog = document.querySelector('#modal'),
    picker = dialog.querySelector('.exercise-picker');
  if (!picker) return;
  dialog.classList.add('program-customize-dialog');
  picker.previousElementSibling?.remove();
  picker.insertAdjacentHTML(
    'beforebegin',
    `<section class="routine-order" aria-labelledby="routine-order-title"><div class="routine-order__head"><div><strong id="routine-order-title">Workout order</strong><small>Drag or use the buttons to reorder</small></div><span class="selected-count"></span></div><div class="routine-order__list"></div></section><div class="exercise-picker__toolbar"><label class="exercise-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search exercises" aria-label="Search exercises in this workout"></label></div>`,
  );
  const count = dialog.querySelector('.selected-count'),
    search = dialog.querySelector('.exercise-search input'),
    checkboxes = [...picker.querySelectorAll('input[type="checkbox"]')],
    orderInput = dialog.querySelector('input[name="exerciseOrder"]'),
    orderList = dialog.querySelector('.routine-order__list'),
    exerciseById = new Map(state.exercises.map((exercise) => [exercise.id, exercise])),
    checkedIds = () => new Set(checkboxes.filter((box) => box.checked).map((box) => box.value)),
    readOrder = () => String(orderInput?.value || '').split(',').filter(Boolean),
    normalizedOrder = () => {
      const checked = checkedIds(), order = readOrder().filter((id) => checked.has(id));
      checkboxes.forEach((box) => { if (box.checked && !order.includes(box.value)) order.push(box.value); });
      return order;
    },
    renderOrder = () => {
      const order = normalizedOrder();
      if (orderInput) orderInput.value = order.join(',');
      orderList.innerHTML = order.map((id, index) => {
        const exercise = exerciseById.get(id), name = exercise?.name || 'Exercise';
        return `<article class="routine-order__item" draggable="true" data-order-id="${id}"><span class="routine-order__grip" aria-hidden="true">⠿</span><span class="routine-order__number">${String(index + 1).padStart(2, '0')}</span><span class="routine-order__name"><strong>${esc(name)}</strong><small>${esc(exercise?.primaryMuscle || '')}</small></span><span class="routine-order__actions"><button type="button" data-order-move="up" aria-label="Move ${esc(name)} up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-order-move="down" aria-label="Move ${esc(name)} down" ${index === order.length - 1 ? 'disabled' : ''}>↓</button></span></article>`;
      }).join('') || '<p class="routine-order__empty">Select an exercise to build your workout flow.</p>';
    },
    updateCount = () => {
      const total = checkboxes.filter((box) => box.checked).length;
      count.textContent = `${total} selected`;
      renderOrder();
    };
  updateCount();
  checkboxes.forEach((box) => box.addEventListener('change', updateCount));
  orderList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-order-move]'), item = event.target.closest('[data-order-id]');
    if (!button || !item) return;
    const order = normalizedOrder(), index = order.indexOf(item.dataset.orderId), target = index + (button.dataset.orderMove === 'up' ? -1 : 1);
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    orderInput.value = order.join(',');
    renderOrder();
  });
  let draggedId = null;
  orderList.addEventListener('dragstart', (event) => { draggedId = event.target.closest('[data-order-id]')?.dataset.orderId || null; });
  orderList.addEventListener('dragover', (event) => event.preventDefault());
  orderList.addEventListener('drop', (event) => {
    event.preventDefault();
    const targetId = event.target.closest('[data-order-id]')?.dataset.orderId;
    if (!draggedId || !targetId || draggedId === targetId) return;
    const order = normalizedOrder(), from = order.indexOf(draggedId), to = order.indexOf(targetId);
    order.splice(to, 0, order.splice(from, 1)[0]);
    orderInput.value = order.join(',');
    renderOrder();
  });
  const filterExercises = () => {
    const normalize = (value) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(),
      terms = normalize(search.value).split(/\s+/).filter(Boolean);
    picker
      .querySelectorAll('.exercise-picker__item')
      .forEach((item) => {
        const searchableText = normalize(item.textContent);
        item.hidden = terms.length > 0 && !terms.every((term) => searchableText.includes(term));
      });
    picker.scrollTop = 0;
  };
  search.addEventListener('input', filterExercises);
  search.addEventListener('search', filterExercises);
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      filterExercises();
    }
  });
  const save = dialog.querySelector('#dialog-form .primary');
  if (save) save.textContent = 'Save changes';
  dialog.onclose = () => dialog.classList.remove('program-customize-dialog');
}
document.addEventListener(
  'click',
  (event) => {
    const button = event.target.closest('[data-action="customize-day"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    customizeProgramDay(button);
    enhanceCustomizeUX();
  },
  true,
);
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  if (a === 'readiness') {
    const messages = {
        strong: [
          'Train normally. Keep 1 to 2 reps in reserve and earn every rep.',
          'You feel strong. Use it with control. Quality reps beat reckless weight.',
        ],
        steady: [
          'Follow the plan and keep the same working weights today.',
          'Steady is enough. Execute the plan and stack another consistent session.',
        ],
        sore: [
          'Reduce one accessory set and avoid training to failure today.',
          'Your body is asking for control. Adjust the effort, keep the habit, and recover well.',
        ],
      },
      [advice, coach] = messages[b.dataset.level];
    document
      .querySelectorAll('.readiness-option')
      .forEach((option) => option.classList.toggle('selected', option === b));
    const adviceElement = document.querySelector('.readiness-advice p');
    if (adviceElement) adviceElement.textContent = advice;
    const coachElement = document.querySelector('.buddy-card__bubble p:last-child');
    if (coachElement) coachElement.textContent = coach.split('.')[0] + '.';
    await put('recovery', {
      id: new Date().toISOString().slice(0, 10),
      level: b.dataset.level,
      advice,
      createdAt: new Date().toISOString(),
    });
    return;
  }
  if (a === 'gori-motivate') {
    goriPhraseIndex = (goriPhraseIndex + 1) % goriPhrases.length;
    const bubble = document.querySelector('.gori-float__bubble>span');
    if (bubble) bubble.textContent = goriPhrases[goriPhraseIndex];
    return;
  }
  if (a === 'start-workout') {
    if (
      state.active &&
      !(await confirmModal('Replace active workout?', 'Your unfinished workout will be discarded.'))
    )
      return;
    const p = state.programs.find(
        (x) => x.id === (b.dataset.program || activeProgram(state.programs).id),
      ),
      d = p.days.find((x) => x.id === b.dataset.day);
    state.active = newWorkout(p, d, exMap());
    await saveActive();
    location.assign('/app/workout');
  }
  if (
    a === 'discard-workout' &&
    (await confirmModal(
      'Discard workout?',
      'All entries in this unfinished session will be deleted.',
      'Discard',
    ))
  ) {
    await remove('activeWorkout', 'active');
    state.active = null;
    render();
  }
  if (a === 'add-set') {
    state.active.exercises[state.active.current].sets.push({
      weight: 0,
      reps: 0,
      rir: 2,
      done: false,
    });
    await saveActive();
    render();
  }
  if (a === 'remove-set') {
    const sets = state.active.exercises[state.active.current].sets;
    if (sets.length <= 1) {
      toast('Keep at least one set for this exercise.');
      return;
    }
    const index = Number(b.dataset.index);
    const set = sets[index];
    const hasData = set.done || Number(set.weight) > 0 || Number(set.reps) > 0;
    if (hasData && !(await confirmModal('Remove this set?', 'The logged weight and repetitions will be deleted.', 'Remove'))) return;
    sets.splice(index, 1);
    await saveActive();
    render();
    return;
  }
  if (a === 'prev-ex') {
    state.active.current = Math.max(0, state.active.current - 1);
    await saveActive();
    render();
  }
  if (a === 'next-ex') {
    if (!validateCurrentExercise()) return;
    if (state.active.current === state.active.exercises.length - 1) await finishWorkout();
    else {
      state.active.current++;
      await saveActive();
      render();
    }
  }
  if (a === 'favorite') {
    const x = exMap().get(b.dataset.id);
    x.favorite = !x.favorite;
    await put('exercises', x);
    render();
  }
  if (a === 'view-exercise') {
    location.assign(`/app/exercises/${encodeURIComponent(b.dataset.id)}`);
  }
  if (a === 'customize-day') {
    const p = state.programs.find((item) => item.id === b.dataset.program),
      day = p?.days.find((item) => item.id === b.dataset.day);
    if (!day) return;
    const selected = new Map(day.exercises.map((item) => [item.exerciseId, item]));
    openForm(
      `Customize ${day.name}`,
      `<p class="muted">Choose the exercises you want for this training day. Muscle targets update automatically.</p><div class="exercise-picker">${state.exercises.map((exercise) => `<label class="exercise-picker__item"><input type="checkbox" name="exerciseId" value="${exercise.id}" ${selected.has(exercise.id) ? 'checked' : ''}><span><strong>${esc(exercise.name)}</strong><small>${esc(exercise.primaryMuscle)} · ${esc(exercise.equipment)}</small></span></label>`).join('')}</div>`,
      async (form) => {
        const ids = form.getAll('exerciseId');
        if (!ids.length) {
          toast('Keep at least one exercise in the workout.');
          return;
        }
        day.exercises = ids.map(
          (id) => selected.get(id) || { exerciseId: id, sets: 3, minReps: 8, maxReps: 12 },
        );
        day.muscles = [
          ...new Set(ids.map((id) => exMap().get(id)?.primaryMuscle).filter(Boolean)),
        ].map((name) => name.charAt(0).toUpperCase() + name.slice(1));
        await put('programs', p);
        render();
        toast(`${day.name} workout updated.`);
      },
    );
  }
  if (a === 'new-routine') addProgramRoutine(b);
  if (
    a === 'logout' &&
    (await confirmModal(
      'Sign out of RepMate?',
      'Your synced training data will remain available when you sign in again.',
      'Sign Out',
    ))
  ) {
    await signOut();
  }
  if (a === 'delete-routine') {
    const program = state.programs.find((item) => item.id === b.dataset.program),
      routine = program?.days.find((item) => item.id === b.dataset.day);
    if (!program || !routine) return;
    if (!(await confirmModal(`Delete ${routine.name}?`, 'This routine and its exercise setup will be permanently removed.', 'Delete Routine'))) return;
    program.days = program.days.filter((item) => item.id !== routine.id);
    await put('programs', program);
    render();
    toast(`${routine.name} removed.`);
  }
  if (a === 'replace') {
    const cur = exMap().get(state.active.exercises[+b.dataset.index].exerciseId),
      alts = alternatives(cur, state.exercises);
    openForm(
      'Replace exercise',
      `<div class="field"><label for="replacement">Recommended alternatives</label><select id="replacement" name="id">${alts.map((x) => `<option value="${x.item.id}">${esc(x.item.name)} (${x.item.primaryMuscle === cur.primaryMuscle ? 'same muscle' : 'similar pattern'})</option>`).join('')}</select></div>`,
      async (f) => {
        state.active.exercises[state.active.current].exerciseId = f.get('id');
        await saveActive();
        render();
      },
    );
  }
  if (a === 'duplicate-program') {
    const p = structuredClone(state.programs.find((x) => x.id === b.dataset.id));
    p.id = crypto.randomUUID();
    p.name += ' Copy';
    p.active = false;
    await put('programs', p);
    state.programs.push(p);
    render();
  }
  if (a === 'activate-program') {
    for (const p of state.programs) {
      p.active = p.id === b.dataset.id;
      await put('programs', p);
    }
    render();
  }
  if (a === 'delete-program') {
    if (state.programs.length === 1) return toast('Keep at least one program.');
    if (await confirmModal('Delete program?', 'Workout history will remain.', 'Delete')) {
      await remove('programs', b.dataset.id);
      state.programs = state.programs.filter((x) => x.id !== b.dataset.id);
      render();
    }
  }
  if (a === 'new-program')
    openForm(
      'Create program',
      `<div class="field"><label for="program-name">Program Name</label><input id="program-name" name="name" placeholder="e.g. My Strength Plan" required></div><div class="field"><label for="program-split">Training Style</label><select id="program-split" name="split"><option>Full Body</option><option>Upper Lower</option><option>Push Pull Legs</option><option>Custom Split</option></select></div><div class="field"><label for="routine-name">First Routine</label><input id="routine-name" name="routineName" placeholder="e.g. Upper Body" required></div><div class="field"><label for="routine-day">Training Day</label><select id="routine-day" name="weekday">${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => `<option value="${index}" ${index === 1 ? 'selected' : ''}>${day}</option>`).join('')}</select></div><p class="muted">Select the exercises for this routine.</p><div class="exercise-picker">${state.exercises.map((exercise) => `<label class="exercise-picker__item"><input type="checkbox" name="exerciseId" value="${exercise.id}"><span><strong>${esc(exercise.name)}</strong><small>${esc(exercise.primaryMuscle)} · ${esc(exercise.equipment)}</small></span></label>`).join('')}</div>`,
      async (f) => {
        const ids = f.getAll('exerciseId');
        if (!ids.length) {
          toast('Select at least one exercise for your routine.');
          return false;
        }
        const muscles = [...new Set(ids.map((id) => exMap().get(id)?.primaryMuscle).filter(Boolean))];
        const p = {
          id: crypto.randomUUID(),
          name: f.get('name').trim(),
          split: f.get('split'),
          active: false,
          days: [{
            id: crypto.randomUUID(),
            name: f.get('routineName').trim(),
            weekday: Number(f.get('weekday')),
            muscles: muscles.map((name) => name.charAt(0).toUpperCase() + name.slice(1)),
            exercises: ids.map((exerciseId) => ({ exerciseId, sets: 3, minReps: 8, maxReps: 12 })),
          }],
        };
        await put('programs', p);
        state.programs.push(p);
        render();
      },
    );
  if (a === 'view-history') {
    const workout = state.workouts.find((item) => item.id === b.dataset.id);
    if (workout) showWorkoutHistory(workout);
  }
  if (false && a === 'view-history') {
    const w = state.workouts.find((x) => x.id === b.dataset.id),
      m = exMap();
    openForm(
      w.name,
      `<p class="muted">${new Date(w.completedAt).toLocaleString()}</p>${w.photo ? `<img class="history-photo" src="${w.photo}" alt="Photo from ${esc(w.name)} session">` : ''}${w.exercises
        .map(
          (x) =>
            `<div class="card"><strong>${esc(m.get(x.exerciseId)?.name || 'Exercise')}</strong><p class="muted">${x.sets
              .filter((s) => s.done)
              .map((s) => `${s.weight} ${state.profile.units} × ${s.reps}`)
              .join(' · ')}</p></div>`,
        )
        .join(
          '',
        )}<div class="actions"><button type="button" class="btn primary" data-action="share-workout" data-id="${w.id}">Share Recap</button><button type="button" class="btn danger" data-history-delete="${w.id}">Delete workout</button></div>`,
      async () => {},
    );
  }
  if (a === 'share-workout') {
    const workout = state.workouts.find((item) => item.id === b.dataset.id);
    document.querySelector('#modal')?.close();
    if (workout) setTimeout(() => showShareRecap(workout), 80);
  }
});
document.addEventListener('input', async (e) => {
  if (e.target.matches('input[type="number"][data-set-field="weight"], input[type="number"][data-set-field="reps"]') && /^0\d/.test(e.target.value)) {
    e.target.value = String(Number(e.target.value));
  }
  if (e.target.dataset.filter) {
    state.filters[e.target.dataset.filter] = e.target.value;
    refreshExerciseResults();
    return;
  }
  if (!state.active) return;
  const row = e.target.closest('[data-set]');
  if (row && e.target.dataset.setField) {
    const s = state.active.exercises[state.active.current].sets[+row.dataset.set],
      key = e.target.dataset.setField,
      val = key === 'done' ? e.target.checked : Math.max(0, Number(e.target.value));
    const becameDone = key === 'done' && val && !s.done;
    s[key] = val;
    await saveActive();
    if (becameDone) {
      const activeExercise = exMap().get(state.active.exercises[state.active.current].exerciseId);
      startTimer(state.active.exercises[state.active.current].rest, activeExercise?.name || 'Next set');
    }
  }
  if (e.target.dataset.workoutField === 'notes') {
    state.active.exercises[state.active.current].notes = e.target.value;
    await saveActive();
  }
});
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (e.target.id === 'profile-form') {
    const f = new FormData(e.target);
    Object.assign(state.profile, {
      name: f.get('name').trim(),
      goal: f.get('goal'),
      units: f.get('units'),
      theme: f.get('theme'),
      notifications: f.has('notifications'),
      vibration: f.has('vibration'),
    });
    await put('profile', state.profile);
    localStorage.setItem('theme', state.profile.theme);
    document.documentElement.dataset.theme = state.profile.theme;
    if (state.profile.notifications && Notification.permission === 'default')
      Notification.requestPermission();
    toast('Settings saved.');
    render();
  }
  if (e.target.id === 'recovery-form') {
    const vals = [...e.target.querySelectorAll('.selected')].map((x) => +x.dataset.value),
      avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1),
      advice =
        avg < 2.4
          ? 'Consider a recovery day'
          : avg < 3.2
            ? 'Avoid training to failure'
            : avg < 4
              ? 'Keep the same weight'
              : 'Train normally';
    await put('recovery', {
      id: new Date().toISOString().slice(0, 10),
      values: vals,
      note: e.target.note.value,
      advice,
    });
    toast(advice);
    document.querySelector('#recovery-advice').textContent = advice;
  }
});
document.addEventListener('click', (e) => {
  const r = e.target.closest('[data-rating] button');
  if (r) {
    [...r.parentElement.children].forEach((x) => x.classList.toggle('selected', x === r));
  }
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest('button,input,select,textarea,a')) return;
  const card = e.target.closest('.exercise-card[data-action="view-exercise"]');
  if (card && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    location.assign(`/app/exercises/${encodeURIComponent(card.dataset.id)}`);
  }
});
document.addEventListener('focusin', (e) => {
  if (e.target.matches('input[type="number"][data-set-field="weight"], input[type="number"][data-set-field="reps"]') && Number(e.target.value) === 0) {
    e.target.value = '';
  }
});
document.addEventListener('focusout', (e) => {
  if (e.target.matches('input[type="number"][data-set-field="weight"], input[type="number"][data-set-field="reps"]') && e.target.value === '') {
    e.target.value = '0';
    e.target.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
document.querySelector('#modal-content').addEventListener('click', async (e) => {
  if (
    e.target.dataset.historyDelete &&
    (await confirmModal(
      'Delete workout?',
      'This completed session will be permanently removed.',
      'Delete',
    ))
  ) {
    await remove('workouts', e.target.dataset.historyDelete);
    state.workouts = state.workouts.filter((x) => x.id !== e.target.dataset.historyDelete);
    document.querySelector('#modal').close();
    render();
  }
});
async function init() {
  try {
    let savedTheme = 'dark';
    try { savedTheme = localStorage.getItem('theme') || 'dark'; } catch (_) { /* Use the safe default. */ }
    document.documentElement.dataset.theme = savedTheme;
    const session = await requireSession();
    await initializeAccount(session.user);
    await load();
    setupPWA();
    startRouter(render);
  } catch (err) {
    reportError(err, { feature: 'app-initialization', online: navigator.onLine });
    console.error(err);
    app.innerHTML = `
      <div class="card empty app-load-error" role="alert">
        <h2>We couldn't open your training</h2>
        <p>Your account data is safe. Check your connection, close any other RepMate tabs, then try again.</p>
        <button class="btn btn-primary" type="button" data-retry-app>Try again</button>
        <a class="btn btn-secondary" href="/login">Return to sign in</a>
      </div>`;
    app.querySelector('[data-retry-app]')?.addEventListener('click', () => window.location.reload());
  }
}
init();
