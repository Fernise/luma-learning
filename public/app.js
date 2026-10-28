import { PROGRESS_KEY, SESSION_KEY, readProgress, progressSnapshot, sessionId, buildProgressExport } from './storage.js';
import { partition, sequencePairs, pairDescription, clueSentences } from './exploration.js';
import { createConversationRenderer } from './conversation.js';
import { draftFitsActivity, createDraftArchive } from './recovery.js';
import { requestJSON as request } from './request.js';
const $ = selector => document.querySelector(selector);
let state;
let missions = [];
let busy = false;
let pendingMessage = '';
let speechEnabled = false;
let aiAvailable = false;
let aiStatus;
let useAI = false;
let lastSpoken = '';
let selectedConfidence = null;
let renderedLesson = '';
let renderedVisual = '';
const renderConversation = createConversationRenderer(message => {
  const bubble = element('div', `message ${message.role}`);
  bubble.dataset.messageId = message.id;
  bubble.append(element('span', 'message-label', message.role === 'tutor' ? 'Luma' : 'Tu idea'), element('span', '', message.text));
  return bubble;
});
let labState = { parts: 6, colored: 1, pair: 0, comparison: 'difference', clues: [] };
let greetingIndex = 0;
let view = 'home';
let navigationRevision = 0;
let loadingFamily = false;
let familyRequest = 0;
let dialogVersion = 0;
let dialogReturn = null;
let pendingDialogReturn = null;
let settingsRequest = 0;
let pendingSettingsError = null;
let storage;
let tabStorage;
try { storage = window.localStorage; tabStorage = window.sessionStorage; } catch { /* Storage can be unavailable in private browsing. */ }
let { history: legacyHistory } = readProgress(storage);
let history = [...legacyHistory];
let rememberProgress = false;
let pendingRuns = [];
const draftArchive = createDraftArchive();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, className, action) {
  const node = element('button', className, text);
  node.type = 'button'; node.addEventListener('click', action); return node;
}
function rememberSession(id) { try { if (id) tabStorage?.setItem(SESSION_KEY, id); else tabStorage?.removeItem(SESSION_KEY); } catch { /* The lesson remains usable without browser storage. */ } }
function saveProgress() {
  if (!rememberProgress || !state) return;
  pendingRuns = pendingRuns.filter(run => run.runId !== state.runId);
  if (state.phase !== 'finished') pendingRuns.unshift({ runId: state.runId, missionId: state.mission.id, completed: state.records.length, total: state.total, paused: state.paused, updatedAt: new Date().toISOString() });
  pendingRuns = pendingRuns.slice(0, 20);
  if (!state.records.length) return;
  const snapshot = progressSnapshot(state);
  history = [snapshot, ...history.filter(run => run.id !== state.runId)].filter(Boolean).slice(0, 20);

}
function runs() {
  const current = state?.records.length ? progressSnapshot(state) : null;
  return current ? [current, ...history.filter(run => run.id !== current.id)] : history;
}
function setBusy(value, message = 'Estoy preparando el siguiente paso…') { busy = value; pendingMessage = value ? message : ''; document.body.classList.toggle('busy', value); render(); if (!value) { restoreDialogFocus(); flushSettingsError(); } }
function flushSettingsError() {
  if (!pendingSettingsError || busy || $('#adult-dialog').open) return;
  const message = pendingSettingsError; pendingSettingsError = null;
  showError(message);
}
function showError(message) {
  const notice = $('#adult-dialog').open ? $('#dialog-error') : $('#error');
  notice.replaceChildren(element('span', 'error-message', message)); notice.hidden = false;
  if (notice.id === 'error' && state && state.phase !== 'finished') {
    notice.append(button('Volver a mi idea →', 'error-return', () => {
      navigate('learn');
      const target = !$('#explanation').disabled && !$('#explanation-form').hidden ? $('#explanation') : state.paused ? $('#resume-button') : $('#problem-title');
      target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }));
  }
  notice.focus({ preventScroll: true });
  notice.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  return notice;
}
function navigate(target, updateHash = true) {
  // Even leaving and returning to the same page cancels an earlier recovery's UI effects.
  navigationRevision++;
  view = target === 'learn' && !state ? 'explore' : target;
  document.body.dataset.view = view;
  if (updateHash || target !== view) historyReplaceHash(view);
  if (view !== 'learn') window.speechSynthesis?.cancel();
  $('#error').hidden = true;
  render(); window.scrollTo({ top: 0, behavior: 'instant' });
  $(`#${view === 'learn' ? 'learn' : view === 'family' ? 'family' : view === 'explore' ? 'explore' : 'home'}-title`).focus({ preventScroll: true });
}
function historyReplaceHash(target) { window.history.replaceState(null, '', { home: '#inicio', explore: '#explorar', learn: '#aprender', family: '#familias' }[target]); }
function viewForHash(hash) { return { '#familias': 'family', '#explorar': 'explore', '#aprender': 'learn' }[hash] ?? 'home'; }
async function continueAdventure() {
  if (busy) return;
  if (!state || state.phase === 'finished') { navigate('explore'); return; }
  setBusy(true); $('#error').hidden = true;
  const previous = state; const draft = $('#explanation').value;
  const origin = navigationRevision;
  try {
    const next = await request(`/api/session/${state.id}`, null, 'GET');
    if (origin !== navigationRevision) return;
    const copyDraft = Boolean(draft.trim()) && !draftFitsActivity(previous, next);
    state = next; useAI = state.mode === 'ai';
    if (copyDraft) $('#explanation').value = '';
    navigate(state.phase === 'finished' ? 'explore' : 'learn');
    if (copyDraft) appendDraftCopy(showError('El recorrido recuperado ha cambiado. Conservamos tu idea anterior para que puedas seleccionarla.'), draft);
  }
  catch (error) {
    if (origin !== navigationRevision) return;
    if (error.status === 404) showUnavailableAdventure(draft, 'explore');
    else showError(error.message);
  } finally { setBusy(false); }
}
async function start(missionId = state?.mission.id ?? 'fractions') {
  return switchAdventure(() => request('/api/session', { useAI, missionId }));
}
async function resumeSaved(runId) {
  if (state?.runId === runId) return continueAdventure();
  return switchAdventure(() => request('/api/resume', { runId }));
}
async function switchAdventure(create) {
  if (busy) return;
  const origin = navigationRevision; const previous = state; const draft = $('#explanation').value;
  setBusy(true); $('#error').hidden = true;
  try {
    // Create first so a failed request does not discard the existing activity.
    const next = await create();
    if (origin !== navigationRevision) return;
    saveProgress();
    // Keep an incompatible copy if the editor was cleared by recovery, rather than by editing.
    if (draft.trim() || draftArchive.read(previous)?.fits !== false) draftArchive.save(previous, draft);
    state = next; useAI = state.mode === 'ai'; rememberSession(state.id);
    $('#settings-status').hidden = true;
    const returning = draftArchive.read(state);
    $('#explanation').value = ''; lastSpoken = ''; selectedConfidence = null;
    saveProgress();
    navigate('learn');
    // Lesson rendering resets its editor; restore the matching draft after that reset.
    if (returning?.fits) $('#explanation').value = returning.text;
    const copy = draft.trim() ? draft : returning && !returning.fits ? returning.text : '';
    if (copy) appendDraftCopy(showError('Tu idea anterior sigue disponible para copiarla. Solo se conserva mientras esta página esté abierta.'), copy);
    // Release the old session only after adopting the new one. Navigation during cleanup
    // must not leave an unsaved adventure pointing at a deleted session.
    if (previous?.id) await request(`/api/session/${previous.id}?keepProgress=1`, null, 'DELETE').catch(() => {});
  } catch (error) {
    if (origin !== navigationRevision) return;
    if (error.status === 404) {
      // Refresh expired/removed entries without retrying the mutation or discarding the draft.
      try {
        const saved = await request('/api/progress', null, 'GET');
        if (origin !== navigationRevision) return;
        rememberProgress = saved.enabled; pendingRuns = saved.pending ?? [];
      } catch { /* The previous activity stays available even if refreshing fails. */ }
    }
    if (origin === navigationRevision) showError(error.message);
  }
  finally { setBusy(false); }
}
async function turn(action) {
  if (busy || !state) return;
  const origin = navigationRevision;
  let changed = false;
  setBusy(true, action.type === 'explain' ? 'Estoy leyendo tu idea…' : 'Estoy preparando el siguiente paso…'); $('#error').hidden = true;
  try {
    state = await request('/api/turn', { id: state.id, revision: state.revision, action });
    if (action.type === 'explain') { $('#explanation').value = ''; draftArchive.forget(state.runId); }
    saveProgress(); render();
    changed = true;
  } catch (error) {
    if (origin !== navigationRevision) return;
    if (error.status === 404 || error.code === 'request_timeout' || (error.status === 409 && ['session_changed', 'session_busy'].includes(error.code))) await recoverSession(origin, error.code);
    else showError(error.message);
  } finally { setBusy(false); }
  if (changed && view === 'learn' && origin === navigationRevision) revealFeedback(action);
}

async function recoverSession(origin, reason) {
  const draft = $('#explanation').value;
  const previous = state;
  try {
    const next = await request(`/api/session/${state.id}`, null, 'GET');
    if (origin !== navigationRevision) return;
    const copyDraft = Boolean(draft.trim()) && (!draftFitsActivity(previous, next) || (reason === 'request_timeout' && previous.revision !== next.revision));
    state = next;
    useAI = state.mode === 'ai';
    if (copyDraft) $('#explanation').value = '';
    render();
    const notice = showError(reason === 'session_changed' ? 'Tu recorrido ha cambiado en otra pantalla. Hemos actualizado el avance. No hemos reenviado tu idea. Revisa el ejercicio antes de volver a intentarlo.' : reason === 'session_busy' ? 'Hay otra respuesta en curso. No hemos reenviado tu idea. Espera un momento y revisa el recorrido.' : reason === 'request_timeout' ? 'La respuesta tardó demasiado. Hemos revisado el recorrido sin reenviar tu idea. Comprueba si aparece en la conversación antes de volver a enviarla.' : 'Hemos recuperado tu recorrido. No hemos reenviado tu idea. Revisa el avance antes de volver a intentarlo.');
    if (copyDraft) appendDraftCopy(notice, draft);
  } catch (error) {
    if (origin !== navigationRevision) return;
    if (error.status !== 404) { showError(error.message); return; }
    showUnavailableAdventure(draft, 'home', reason === 'session_removed');
  }
}

function showUnavailableAdventure(draft, destination, removed = false) {
  if (removed) {
    rememberProgress = false; history = []; legacyHistory = []; pendingRuns = []; draftArchive.clear();
    try { storage?.removeItem(PROGRESS_KEY); } catch { /* The deleted session still stays removed when browser storage is unavailable. */ }
  }
  else saveProgress();
  state = undefined; rememberSession(null); navigate(destination);
  const notice = showError(removed ? 'Este recorrido se ha borrado en otra pantalla. Puedes copiar tu idea antes de elegir otra aventura.' : 'Este recorrido ya no está disponible. Puedes copiar tu idea antes de elegir otra aventura.');
  appendDraftCopy(notice, draft);
  if (destination === 'home') notice.append(button('Elegir otra aventura →', 'error-return', () => navigate('explore')));
}

function appendDraftCopy(notice, draft) {
  if (!draft.trim()) return;
  const label = element('label', 'recovered-draft-label', 'Tu idea escrita'); label.htmlFor = 'recovered-draft';
  const copy = element('textarea', 'recovered-draft'); copy.id = 'recovered-draft'; copy.value = draft; copy.readOnly = true; copy.rows = 3;
  notice.append(label, copy, button('Seleccionar mi idea', 'error-return', () => { copy.focus(); copy.select(); }));
}

function revealFeedback(action) {
  if (state.phase === 'finished') { $('#completion-screen').focus(); return; }
  const narrow = window.matchMedia('(max-width: 999px)').matches;
  const target = state.paused ? $('#resume-button') : action.type === 'next' ? $('#problem-title') : state.phase === 'complete' ? $('#next-button') : action.type === 'hint' && state.visual ? $('#visual-aid') : narrow ? $('#tutor-title') : $('#explanation');
  // Render has enabled the destination. Keyboard users can continue from the new state.
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: narrow ? 'start' : 'nearest', behavior: 'instant' });
}
function speak(text) {
  if (view !== 'learn' || !speechEnabled || !('speechSynthesis' in window) || !text || text === lastSpoken) return;
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'es-ES'; utterance.rate = .9; speechSynthesis.speak(utterance); lastSpoken = text;
}
function render() {
  $('#home-view').hidden = view !== 'home'; $('#explore-view').hidden = view !== 'explore'; $('#learn-view').hidden = view !== 'learn'; $('#family-view').hidden = view !== 'family';
  const section = view === 'learn' ? 'explore' : view;
  for (const [id, route] of [['home-nav', 'home'], ['explore-nav', 'explore'], ['family-nav', 'family']]) {
    const node = $(`#${id}`); node.classList.toggle('selected', section === route); if (section === route) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
  }
  const breadcrumb = view === 'learn' && state ? `${state.mission.tag} / ${state.mission.topic}` : view === 'family' ? 'Mi espacio / Familias' : view === 'explore' ? 'Mi espacio / Explorar' : 'Mi espacio / Inicio';
  $('#breadcrumb').textContent = breadcrumb;
  $('#mode-label').textContent = state?.assessment?.source === 'guard' ? 'Seguimos con el ejercicio' : state?.fallback ? 'Guía local en este turno · IA temporalmente no disponible' : state?.mode === 'ai' ? (state?.messages?.at(-1)?.questionSource === 'ai' ? 'Pregunta adaptada con IA' : 'IA activada · Guía del ejercicio') : 'Guía local';
  $('#tutor-status').hidden = !busy || view !== 'learn'; $('#tutor-status').textContent = pendingMessage;
  $('#conversation').setAttribute('aria-busy', String(busy));
  $('#path-title').textContent = state?.mission.title ?? 'Tu próxima aventura';
  $('.topic-icon').textContent = state?.mission.icon ?? '✦';
  $('#path-meta').textContent = `${state?.mission.tag ?? 'Razonamiento'} · 8–11 años`;
  $('#lesson-list').replaceChildren(...(state?.mission.lessonTitles ?? ['Observar', 'Explicar', 'Comprobar']).map((title, index) => element('li', state && index < state.records.length ? 'done' : index === (state?.index ?? 0) ? 'current' : '', title)));
  renderHome();
  renderExplore();
  if (state) renderLesson();
  if (view === 'family') renderFamily();
  for (const id of ['hero-start', 'continue-button', 'explore-continue-button', 'restart-button', 'settings-button', 'family-settings', 'choose-next']) $(`#${id}`).disabled = busy;
}
function renderHome() {
  const active = state && state.phase !== 'finished';
  $('#hero-start').textContent = active ? 'Continuar mi aventura →' : 'Elegir mi aventura →';
  $('#continue-card').hidden = !active;
  if (active) { $('#continue-title').textContent = state.mission.title; $('#continue-description').textContent = `${state.records.length} de ${state.total} situaciones terminadas. Tu idea te espera aquí.`; }
  $('#catalog-count').textContent = `${missions.reduce((sum, mission) => sum + mission.total, 0)} actividades · 5 por expedición`;
  $('#mission-grid').replaceChildren(...missionCards());
  renderPending($('#home-pending'), true);
}
function renderPending(container, omitCurrent = false) {
  const entries = pendingRuns.filter(run => !omitCurrent || run.runId !== state?.runId);
  container.hidden = !rememberProgress || !entries.length;
  if (container.hidden) { container.replaceChildren(); return; }
  container.replaceChildren(element('h2', '', 'Tus aventuras pendientes'), element('p', 'storage-note', 'Puedes retomarlas durante 7 días en este navegador. La conversación y las ideas escritas no se guardan.'));
  const list = element('ul', 'pending-list');
  entries.forEach((run, index) => {
    const mission = missions.find(item => item.id === run.missionId);
    if (!mission) return;
    const item = element('li', 'continue-card'); const info = element('div');
    info.append(element('strong', '', mission.title), element('p', '', `${run.completed} de ${run.total} situaciones terminadas${run.paused ? ' · En pausa' : ''}`));
    const date = run.updatedAt ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(run.updatedAt)) : '';
    info.append(element('small', 'pending-date', `Aventura ${index + 1}${date ? ` · Última vez: ${date}` : ''}`));
    const resume = button('Retomar →', 'secondary-button', () => resumeSaved(run.runId));
    resume.setAttribute('aria-label', `Retomar ${mission.title}, aventura ${index + 1}: ${run.completed} de ${run.total} situaciones`);
    resume.disabled = busy || (view === 'family' && loadingFamily);
    item.append(info, resume); list.append(item);
  });
  container.append(list);
}
function renderExplore() {
  const active = state && state.phase !== 'finished';
  $('#explore-continue-card').hidden = !active;
  if (active) { $('#explore-continue-title').textContent = state.mission.title; $('#explore-continue-description').textContent = `${state.records.length} de ${state.total} situaciones terminadas. Tu idea te espera aquí.`; }
  $('#explore-count').textContent = `${missions.reduce((sum, mission) => sum + mission.total, 0)} actividades · 3 islas · 5 descubrimientos por aventura`;
  $('#explore-grid').replaceChildren(...missionCards('h2'));
}
function missionCards(heading = 'h3') {
  const active = state && state.phase !== 'finished';
  const allRuns = runs();
  return missions.map(mission => {
    const card = element('article', `mission-card ${mission.color}`);
    const art = element('div', `mission-art art-${mission.id}`); art.setAttribute('aria-hidden', 'true');
    const island = element('div', 'island-land'); island.append(element('span', 'island-tree tree-one'), element('span', 'island-tree tree-two'), element('span', 'island-pebble')); art.append(island, element('span', 'island-number', `0${missions.indexOf(mission) + 1}`));
    if (mission.id === 'fractions') {
      const circle = element('div', 'fraction-disc'); art.append(circle, element('span', 'art-caption', 'Una parte. Muchas preguntas.'));
    } else if (mission.id === 'patterns') {
      const tiles = element('div', 'pattern-tiles'); ['2', '4', '8', '?'].forEach(text => tiles.append(element('span', '', text))); art.append(tiles, element('span', 'art-caption', '¿Qué cambia? ¿Qué se repite?'));
    } else { const shapes = element('div', 'logic-shapes'); ['◇', '○', '△'].forEach(text => shapes.append(element('span', '', text))); art.append(shapes, element('span', 'art-caption', 'Las pistas abren caminos.')); }
    card.append(art);
    const content = element('div', 'mission-content');
    content.append(element('span', 'mission-tag', `${mission.topic} · Expediciones de 5`), element(heading, '', mission.title), element('p', '', mission.description));
    const meta = element('div', 'mission-meta'); meta.append(element('span', '', `${mission.total} actividades para explorar`), element('span', '', mission.skill)); content.append(meta);
    const matching = allRuns.filter(run => run.missionId === mission.id);
    const finished = matching.some(run => run.finished);
    const isActive = active && state.mission.id === mission.id;
    content.append(element('div', 'mission-status', isActive ? `En curso · ${state.records.length}/${state.total}` : finished ? 'Ya explorado · puedes volver a probar' : 'Listo para descubrir'));
    const open = button(isActive ? 'Seguir explorando →' : finished ? 'Volver a esta isla →' : 'Viajar a esta isla →', 'mission-start', () => isActive ? continueAdventure() : start(mission.id)); open.disabled = busy; content.append(open);
    card.append(content); return card;
  });
}
function renderLesson() {
  const { lesson, phase, paused, mission } = state;
  const terminal = ['complete', 'finished'].includes(phase);
  const lessonKey = `${state.id}:${lesson.id}`;
  if (renderedLesson !== lessonKey) {
    selectedConfidence = state.confidence; renderedLesson = lessonKey; $('#explanation').value = '';
    labState = { parts: 6, colored: 1, pair: 0, comparison: 'difference', clues: [] };
    const starters = lesson.kind === 'pattern' ? [['Entre dos números…', 'Entre dos números veo que…'], ['Mi regla es…', 'Mi regla es…'], ['La pruebo en…', 'La pruebo en otra pareja y…']] : lesson.kind === 'logic' ? [['La pista dice…', 'La pista dice…'], ['De ahí sé que…', 'De ahí sé que…'], ['Falta saber…', 'Falta saber…']] : [['He comparado…', 'He comparado las cantidades y…'], ['Las partes son…', 'Las partes son…'], ['Lo comprobaría…', 'Lo comprobaría repartiendo…']];
    document.querySelectorAll('[data-starter]').forEach((node, index) => { node.textContent = starters[index][0]; node.dataset.starter = starters[index][1]; });
  }
  $('#learn-title').textContent = phase === 'finished' ? '¡Una isla explorada!' : 'Ponte el gorro de explorador.';
  $('#thinking-steps').hidden = phase === 'finished';
  document.querySelectorAll('[data-thinking]').forEach(node => { const current = node.dataset.thinking === (phase === 'answer' ? 'choose' : terminal ? 'check' : 'explain'); node.classList.toggle('active', current); if (current) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current'); });
  $('#adaptation-note').hidden = !state.adaptive || phase === 'finished';
  $('#adaptation-note').textContent = state.adaptation === 'more-support' ? 'Un paso para practicar con más calma.' : state.adaptation === 'more-challenge' ? 'Probemos un pequeño reto nuevo.' : state.adaptation === 'new-context' ? 'Lleva tu idea a otro lugar.' : 'Cinco descubrimientos, a tu ritmo.';
  $('#exercise-workspace').hidden = phase === 'finished'; $('#completion-screen').hidden = phase !== 'finished';
  $('#problem-title').textContent = lesson.title; $('#problem-context').textContent = lesson.context; $('#problem-prompt').textContent = lesson.prompt;
  $('#problem-category').textContent = lesson.transfer ? 'PRUEBA EN UN CONTEXTO NUEVO' : lesson.kind === 'logic' ? 'SIGUE LAS PISTAS' : lesson.kind === 'pattern' ? 'ENCUENTRA Y COMPRUEBA' : 'OBSERVA Y COMPARA';
  $('#mission-pill').textContent = `✦ ${mission.topic}`;
  $('#step-label').textContent = phase === 'finished' ? 'Exploración terminada' : `Exploración ${state.index + 1} de ${state.total}`;
  $('#session-progress').replaceChildren(...Array.from({ length: state.total }, (_, index) => element('span', index < state.records.length ? 'done' : index === state.index ? 'current' : '')));
  $('#session-progress').setAttribute('aria-valuemax', state.total); $('#session-progress').setAttribute('aria-valuenow', state.records.length);
  $('.fraction-scene').hidden = lesson.unit !== 'pizza';
  $('#sequence-display').hidden = !lesson.sequence;
  $('#sequence-display').replaceChildren(...(lesson.sequence ?? []).map(number => element('span', '', number)), ...(lesson.sequence ? [element('span', 'unknown', '?')] : []));
  $('#confidence-picker').hidden = state.choice !== null || terminal;
  document.querySelectorAll('[data-confidence]').forEach(node => { node.setAttribute('aria-pressed', String(selectedConfidence === node.dataset.confidence)); node.disabled = busy || paused; });
  $('#answers').replaceChildren();
  const options = lesson.fractions ?? lesson.options;
  options.forEach((option, index) => {
    const answer = element('button', `answer-button${lesson.fractions ? '' : ' text-answer'}${state.choice === index ? ' selected' : ''}`); answer.type = 'button';
    answer.setAttribute('aria-label', `Elegir ${Array.isArray(option) ? option.join('/') : option}`); answer.setAttribute('aria-pressed', String(state.choice === index)); answer.disabled = busy || paused || terminal;
    answer.append(element('span', 'answer-label', index === 0 ? 'A' : 'B'));
    if (lesson.fractions) { const fraction = element('span', 'fraction'); fraction.append(element('span', 'numerator', option[0]), element('span', 'denominator', option[1])); answer.append(fraction); }
    else answer.append(element('span', 'answer-text', option));
    answer.addEventListener('click', () => turn({ type: 'answer', choice: index, confidence: selectedConfidence })); $('#answers').append(answer);
  });
  renderVisual(lesson);
  renderConversation($('#conversation'), state.messages, state.id);
  $('.tutor-card').dataset.pose = paused ? 'rest' : terminal ? 'celebrate' : phase === 'reflect' ? 'think' : 'ready';
  $('#companion-status').textContent = paused ? 'Tu idea puede esperar. Descansa.' : terminal ? 'Has comprobado tu elección' : phase === 'reflect' ? 'Probemos otra forma de mirarlo' : 'Una pregunta cada vez';
  const canExplain = !paused && ['reflect', 'explain'].includes(phase);
  $('#writing-starters').hidden = !canExplain;
  document.querySelectorAll('[data-starter]').forEach(node => { node.disabled = busy || !canExplain; });
  $('#explanation-form').hidden = terminal || paused; $('#explanation').disabled = busy || !canExplain; $('#send-button').disabled = busy || !canExplain;
  $('#explanation').placeholder = canExplain ? 'Creo que… porque…' : 'Primero, elige una opción.';
  $('#hint-button').disabled = busy || paused || terminal; $('#pause-button').disabled = busy || paused || phase === 'finished';
  $('#next-button').hidden = phase !== 'complete' || paused; $('#next-button').disabled = busy; $('#next-button').textContent = state.index === state.total - 1 ? 'Terminar y ver mi recorrido →' : 'Siguiente descubrimiento →';
  $('#resume-button').hidden = !paused; $('#resume-button').disabled = busy;
  $('#review-activity').disabled = busy;
  $('#restart-button').hidden = true;
  if (phase === 'finished') {
    renderMetrics($('#completion-stats'), [progressSnapshot(state)], true);
    const stamps = ['Has explorado esta isla'];
    if (state.records.some(record => record.attempts > 1)) stamps.push('Has revisado una elección');
    if (state.records.some(record => record.reasoning === 'supported')) stamps.push('Has explicado tu idea');
    if (state.records.some(record => record.help > 0)) stamps.push('Has utilizado pistas');
    $('#idea-passport').replaceChildren(...stamps.map(text => element('span', 'passport-stamp', `✧ ${text}`)));
  }
  const lastTutor = [...state.messages].reverse().find(message => message.role === 'tutor'); if (!busy) speak(lastTutor?.text);
}
function renderVisual(lesson) {
  $('#visual-aid').hidden = !state.visual;
  if (!state.visual) return;
  const visualKey = `${state.id}:${lesson.id}`;
  if (renderedVisual === visualKey) { updateLab(lesson); return; }
  $('#fraction-bars').replaceChildren(); $('#exploration-lab').replaceChildren();
  if (lesson.fractions) {
    $('#visual-title').textContent = 'Cantidades enteras iguales'; $('#visual-caption').textContent = 'Las dos barras tienen la misma longitud. Observa las divisiones y las partes coloreadas.';
    lesson.fractions.forEach(([numerator, denominator]) => {
      const row = element('div', 'bar-row'); const bar = element('div', 'fraction-bar'); bar.style.setProperty('--parts', denominator); bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', `${numerator} de ${denominator} partes iguales coloreadas`);
      for (let i = 0; i < denominator; i++) bar.append(element('span', `fraction-piece${i < numerator ? ' filled' : ''}`));
      row.append(element('span', 'bar-label', `${numerator}/${denominator}`), bar); $('#fraction-bars').append(row);
    });
  } else if (lesson.sequence) {
    $('#visual-title').textContent = 'Mira lo que cambia entre pasos'; $('#visual-caption').textContent = 'Comprueba la relación en más de una pareja. El último paso lo decides tú.';
    // The pair explorer below shows only existing terms; it never computes the missing term.
  } else {
    $('#visual-title').textContent = 'Lo que sabemos'; $('#visual-caption').textContent = 'Vuelve a las pistas. Una conclusión debe respetarlas todas.';
    // The clue board below contains only facts already visible in the activity.
  }
  renderLab(lesson);
  renderedVisual = visualKey;
  updateLab(lesson);
}
function renderLab(lesson) {
  const lab = $('#exploration-lab');
  const disabled = busy || state.paused || ['complete', 'finished'].includes(state.phase);
  lab.append(element('span', 'lab-tag', '✧ MESA DE EXPLORACIÓN'));
  if (lesson.fractions) {
    lab.append(element('h4', '', 'Prueba otro reparto'), element('p', '', 'Esta barra es otro ejemplo. Cambia el reparto o las partes coloreadas. El entero siempre mide lo mismo.'));
    const drawing = element('div', 'lab-whole'); drawing.style.setProperty('--parts', labState.parts); drawing.setAttribute('role', 'img'); drawing.setAttribute('aria-label', `Una barra entera dividida en ${labState.parts} partes iguales, ${labState.colored} ${labState.colored === 1 ? 'coloreada' : 'coloreadas'}`);
    partition(labState.parts, labState.colored).forEach(piece => drawing.append(element('span', piece.filled ? 'lab-piece filled' : 'lab-piece')));
    const controls = element('div', 'lab-controls'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Cambiar el reparto');
    const fewer = button('−', 'lab-step', () => { labState.parts--; labState.colored = Math.min(labState.colored, labState.parts); updateLab(lesson); $(labState.parts === 2 ? '#lab-more' : '#lab-fewer').focus({ preventScroll: true }); }); fewer.id = 'lab-fewer'; fewer.setAttribute('aria-label', 'Dividir en menos partes'); fewer.disabled = disabled || labState.parts <= 2;
    const more = button('+', 'lab-step', () => { labState.parts++; updateLab(lesson); $(labState.parts === 10 ? '#lab-fewer' : '#lab-more').focus({ preventScroll: true }); }); more.id = 'lab-more'; more.setAttribute('aria-label', 'Dividir en más partes'); more.disabled = disabled || labState.parts >= 10;
    const value = element('output', 'lab-value', `${labState.parts} partes iguales`); value.id = 'lab-part-count'; value.setAttribute('aria-live', 'polite'); value.setAttribute('aria-atomic', 'true'); fewer.setAttribute('aria-describedby', value.id); more.setAttribute('aria-describedby', value.id);
    controls.append(fewer, value, more);
    const paintControls = element('div', 'lab-controls'); paintControls.setAttribute('role', 'group'); paintControls.setAttribute('aria-label', 'Cambiar las partes coloreadas');
    const remove = button('−', 'lab-step', () => { labState.colored--; updateLab(lesson); $(labState.colored === 0 ? '#lab-paint-more' : '#lab-paint-less').focus({ preventScroll: true }); }); remove.id = 'lab-paint-less'; remove.setAttribute('aria-label', 'Colorear una parte menos'); remove.disabled = disabled || labState.colored === 0;
    const add = button('+', 'lab-step', () => { labState.colored++; updateLab(lesson); $(labState.colored === labState.parts ? '#lab-paint-less' : '#lab-paint-more').focus({ preventScroll: true }); }); add.id = 'lab-paint-more'; add.setAttribute('aria-label', 'Colorear una parte más'); add.disabled = disabled || labState.colored === labState.parts;
    const quantity = element('output', 'lab-value', `${labState.colored} ${labState.colored === 1 ? 'coloreada' : 'coloreadas'} · ${labState.colored}/${labState.parts}`); quantity.id = 'lab-color-count'; quantity.setAttribute('aria-live', 'polite'); quantity.setAttribute('aria-atomic', 'true'); remove.setAttribute('aria-describedby', quantity.id); add.setAttribute('aria-describedby', quantity.id); paintControls.append(remove, quantity, add);
    lab.append(drawing, controls, paintControls, element('p', 'lab-question', 'Predice primero: ¿qué cambia al repartir? ¿Y al colorear una parte más?'));
  } else if (lesson.sequence) {
    lab.append(element('h4', '', 'Investiga los saltos'), element('p', '', 'Toca dos números vecinos. Compara su salto con el de otra pareja.'));
    const pairs = sequencePairs(lesson.sequence);
    const modes = element('div', 'comparison-modes'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Qué quieres comparar');
    const availableModes = pairs.every(pair => pair.from > 0 && Number.isInteger(pair.to / pair.from)) ? [['difference', 'Ver el salto'], ['ratio', 'Comparar cantidades']] : [['difference', 'Ver el salto']];
    if (availableModes.length === 1) labState.comparison = 'difference';
    availableModes.forEach(([mode, label]) => { const control = button(label, 'pair-button', () => { labState.comparison = mode; updateLab(lesson); }); control.dataset.comparison = mode; control.setAttribute('aria-pressed', String(labState.comparison === mode)); control.disabled = disabled; modes.append(control); }); if (availableModes.length > 1) lab.append(modes);
    const tabs = element('div', 'pair-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Elige una pareja conocida');
    pairs.forEach((pair, index) => { const control = button(`${pair.from} → ${pair.to}`, 'pair-button pair-step', () => { labState.pair = index; updateLab(lesson); }); control.setAttribute('aria-label', `Comparar ${pair.from} con ${pair.to}`); control.setAttribute('aria-pressed', String(labState.pair === index)); control.disabled = disabled; tabs.append(control); });
    const result = element('div', 'pair-result'); result.id = 'lab-pair-result'; result.setAttribute('role', 'status'); result.setAttribute('aria-atomic', 'true');
    const visualPair = element('span'); visualPair.setAttribute('aria-hidden', 'true'); const visualChange = element('strong'); visualChange.setAttribute('aria-hidden', 'true'); const description = element('span', 'sr-only'); description.id = 'lab-pair-description'; result.append(visualPair, visualChange, description);
    const question = element('p', 'lab-question'); question.id = 'lab-pair-question';
    lab.append(tabs, result, question);
  } else {
    lab.append(element('h4', '', 'Tu tablero de pistas'), element('p', '', 'Marca cada pista después de revisarla. Tú decides qué puedes deducir.'));
    const clues = element('div', 'clue-list'); clues.setAttribute('role', 'group'); clues.setAttribute('aria-label', 'Pistas para revisar');
    (lesson.facts ?? clueSentences(lesson.context)).forEach((text, index) => { const clue = button('', 'clue-toggle', () => { labState.clues[index] = !labState.clues[index]; updateLab(lesson); }); const check = element('span', 'clue-check', labState.clues[index] ? '✓' : '○'); check.setAttribute('aria-hidden', 'true'); clue.append(check, element('span', '', text)); clue.setAttribute('aria-pressed', String(!!labState.clues[index])); clue.disabled = disabled; clues.append(clue); });
    lab.append(clues, element('p', 'lab-question', 'Marcar una pista significa que la has revisado. ¿Tu elección respeta todas?'));
  }
  lab.querySelector('h4').id = 'lab-title';
}
function updateLab(lesson) {
  const lab = $('#exploration-lab');
  const disabled = busy || state.paused || ['complete', 'finished'].includes(state.phase);
  const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  lab.querySelectorAll('button').forEach(node => { node.disabled = disabled; });
  if (lesson.fractions) {
    const drawing = lab.querySelector('.lab-whole');
    drawing.style.setProperty('--parts', labState.parts);
    drawing.setAttribute('aria-label', `Una barra entera dividida en ${labState.parts} partes iguales, ${labState.colored} ${labState.colored === 1 ? 'coloreada' : 'coloreadas'}`);
    if (drawing.children.length !== labState.parts) drawing.replaceChildren(...partition(labState.parts, labState.colored).map(piece => element('span', piece.filled ? 'lab-piece filled' : 'lab-piece')));
    else Array.from(drawing.children).forEach((piece, index) => piece.classList.toggle('filled', index < labState.colored));
    $('#lab-fewer').disabled = disabled || labState.parts <= 2; $('#lab-more').disabled = disabled || labState.parts >= 10;
    $('#lab-paint-less').disabled = disabled || labState.colored === 0; $('#lab-paint-more').disabled = disabled || labState.colored === labState.parts;
    text($('#lab-part-count'), `${labState.parts} partes iguales`);
    text($('#lab-color-count'), `${labState.colored} ${labState.colored === 1 ? 'coloreada' : 'coloreadas'} · ${labState.colored}/${labState.parts}`);
  } else if (lesson.sequence) {
    lab.querySelectorAll('[data-comparison]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.comparison === labState.comparison)));
    lab.querySelectorAll('.pair-step').forEach((node, index) => node.setAttribute('aria-pressed', String(index === labState.pair)));
    const pair = sequencePairs(lesson.sequence)[labState.pair]; const result = $('#lab-pair-result');
    text(result.children[0], `${pair.from} → ${pair.to}`);
    text(result.children[1], labState.comparison === 'difference' ? `${pair.difference > 0 ? '+' : ''}${pair.difference}` : `×${pair.to / pair.from}`);
    text($('#lab-pair-description'), pairDescription(pair, labState.comparison));
    text($('#lab-pair-question'), labState.comparison === 'difference' ? '¿El salto siempre es igual? ¿Ves otra relación entre los números?' : 'El signo × indica cuántas veces cabe una cantidad en la siguiente. ¿Esta relación se repite?');
  } else lab.querySelectorAll('.clue-toggle').forEach((node, index) => {
    node.setAttribute('aria-pressed', String(!!labState.clues[index]));
    text(node.querySelector('.clue-check'), labState.clues[index] ? '✓' : '○');
  });
}
function renderMetrics(container, selectedRuns, child = false) {
  const records = selectedRuns.flatMap(run => run?.records ?? []);
  const metrics = [[records.length, 'Situaciones terminadas'], [records.filter(record => record.reasoning === 'supported').length, child ? 'Ideas explicadas' : 'Explicaciones reconocidas'], [records.filter(record => record.help > 0).length, 'Situaciones con pistas']];
  container.classList.add('summary-metrics'); container.replaceChildren(...metrics.map(([number, label]) => { const metric = element('div'); metric.append(element('strong', '', number), element('small', '', label)); return metric; }));
}
function recordTable(run) {
  const mission = missions.find(item => item.id === run.missionId); const table = element('table', 'record-table'); const head = element('thead'); const heading = element('tr');
  const columns = ['Situación', 'Apoyo', 'Explicación'];
  columns.forEach(title => { const cell = element('th', '', title); cell.scope = 'col'; heading.append(cell); }); head.append(heading); table.append(head);
  const body = element('tbody'); run.records.forEach((record, index) => {
    const row = element('tr'); const reason = record.reasoning === 'supported' ? `Reconocida por el prototipo${record.reasoningAttempts > 1 ? ' · tras revisar la explicación' : ''}` : record.reasoning === 'needs-review' ? 'Para seguir explorando' : 'No solicitada';
    const titleIndex = record.lessonId ? mission?.lessonIds.indexOf(record.lessonId) : index;
    const title = titleIndex >= 0 ? mission.lessonTitles[titleIndex] : `Situación ${index + 1}`;
    [title + (record.transfer ? ' · contexto nuevo' : ''), record.help ? `${record.help} pasos de apoyo` : record.attempts > 1 ? 'Con revisión' : 'Sin pistas', reason].forEach((text, index) => { const cell = element('td', '', text); cell.dataset.label = columns[index]; row.append(cell); });
    body.append(row);
  }); table.append(body); return table;
}
function renderFamily() {
  $('#family-status').hidden = !loadingFamily;
  const allRuns = runs(); renderMetrics($('#family-overview'), allRuns);
  renderPending($('#family-pending'));
  $('#export-progress').disabled = !allRuns.length;
  $('#family-history').replaceChildren();
  if (!allRuns.length) { const empty = element('div', 'family-empty'); empty.append(element('span', '', '♡'), element('h3', '', 'Cada recorrido empieza con una pregunta.'), element('p', '', 'Cuando termine una situación, verás aquí las pistas utilizadas y las explicaciones reconocidas.'), button('Elegir una aventura →', 'primary-button', () => navigate('home'))); $('#family-history').append(empty); }
  allRuns.forEach(run => {
    const mission = missions.find(item => item.id === run.missionId); const item = element('details', 'history-run'); item.open = allRuns.length === 1;
    const summary = element('summary'); const text = element('div'); text.append(element('strong', '', mission?.title ?? 'Exploración'), element('small', '', `${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(run.savedAt))} · ${run.records.length}/${run.total ?? ({ fractions: 5, patterns: 4, logic: 4 }[run.missionId] ?? run.records.length)} situaciones · ${run.finished ? 'Terminado' : 'En curso'}`)); summary.append(element('span', 'history-icon', mission?.icon ?? '✧'), text, element('span', 'history-arrow', '⌄')); item.append(summary, recordTable(run)); $('#family-history').append(item);
  });
  $('#storage-note').textContent = rememberProgress ? 'Guardado local activado. Conservamos hasta 20 recorridos en la base de datos de este ordenador, sin conversaciones ni explicaciones escritas. El punto de reanudación dura hasta 7 días. Puedes borrar los datos de este navegador en Opciones de guardado.' : 'Guardado desactivado. Aquí aparece la sesión actual; no se conservará su resumen al cerrar la pestaña. Puedes activar el guardado en Opciones de guardado.';
}
function restoreDialogFocus() {
  const dialog = $('#adult-dialog');
  if (!pendingDialogReturn || dialog.open || busy) return;
  const { opener, navigation, version } = pendingDialogReturn;
  pendingDialogReturn = null;
  if (navigation !== navigationRevision || version !== dialogVersion || !opener?.isConnected || opener.disabled || !opener.getClientRects().length) return;
  // Respect a newer error, navigation target or deliberate focus elsewhere.
  const active = document.activeElement;
  if (active && active !== document.body && active !== opener && !dialog.contains(active)) return;
  opener.focus({ preventScroll: true });
}
function openDialog(title, content, opener = document.activeElement) {
  const dialog = $('#adult-dialog');
  dialogVersion++;
  dialogReturn = { opener: dialog.open ? dialogReturn?.opener : opener, navigation: navigationRevision, version: dialogVersion };
  pendingDialogReturn = null;
  $('#dialog-title').textContent = title; $('#dialog-content').replaceChildren(content); $('#dialog-error').hidden = true;
  if (!dialog.open) dialog.showModal();
}
function showProgress() {
  const content = element('div'); content.append(element('p', '', 'Observaciones de la sesión actual. Una elección correcta no confirma por sí sola comprensión; el reconocimiento de explicaciones es provisional.'));
  const metrics = element('div'); renderMetrics(metrics, state ? [progressSnapshot(state)] : []); content.append(metrics);
  if (state?.records.length) content.append(recordTable(progressSnapshot(state))); else content.append(element('p', '', 'Todavía no hay situaciones terminadas.'));
  const confidenceLabels = { exploring: 'Estoy probando', 'fairly-sure': 'Bastante seguro', sure: 'Muy seguro' };
  const confidenceRecords = state?.records.filter(record => record.confidence) ?? [];
  if (confidenceRecords.length) { content.append(element('h3', '', 'Cómo se sentía al elegir (opcional)')); confidenceRecords.forEach((record, index) => content.append(element('p', '', `${record.title}: «${confidenceLabels[record.confidence]}».`))); }
  content.append(button('Ver todos los recorridos →', 'dialog-primary', () => { $('#adult-dialog').close(); navigate('family'); })); openDialog('Una mirada al recorrido', content);
}
function showMethod() {
  const content = element('div');
  [['Una pregunta cada vez', 'Pedimos explicar, comparar y comprobar. Una elección equivocada no recibe la solución.'], ['La confianza también cuenta', 'Confirmamos las elecciones correctas. En algunas situaciones pedimos explicarlas, sin fingir que están mal.'], ['El apoyo crece cuando hace falta', 'Pasamos de una pregunta a una representación y después a un ejemplo diferente. También podemos parar.'], ['Comprender a tu manera', 'Terminamos con un contexto nuevo. Una sesión no demuestra aprendizaje duradero.']].forEach(([title, description]) => content.append(element('h3', '', title), element('p', '', description)));
  openDialog('Primero pensamos. Después comprobamos.', content);
}
async function showSettings(event) {
  const opener = event?.currentTarget ?? document.activeElement;
  const origin = navigationRevision, previousDialog = dialogVersion, requestId = ++settingsRequest;
  let config;
  try { config = await request('/api/config', null, 'GET'); } catch { /* Settings remain usable if the local server is temporarily unavailable. */ }
  if (requestId !== settingsRequest || origin !== navigationRevision || previousDialog !== dialogVersion || busy) return;
  if (config) { aiAvailable = config.aiAvailable; aiStatus = config.ai; }
  const content = element('div'); content.append(element('p', '', 'No pedimos nombres ni creamos perfiles. La conversación permanece en memoria y caduca tras una hora de inactividad. Si activas el guardado, el progreso se conserva en la base de datos local de este ordenador y la pestaña puede recuperar la actividad tras reiniciar el servidor.'));
  const storageLabel = element('label', 'settings-label'); const storageBox = element('input'); storageBox.type = 'checkbox'; storageBox.checked = rememberProgress;
  const storageCopy = element('span', '', 'Recordar el recorrido en este dispositivo'); storageCopy.append(element('small', '', 'Hasta 20 recorridos y puntos de reanudación de hasta 7 días. Guardamos actividades, elección actual, intentos, pistas y categorías de explicación; nunca conversaciones ni explicaciones escritas. Al activarlo, una cookie de este ordenador vincula el navegador con el progreso durante un año. No la usamos para publicidad ni seguimiento entre webs. Puedes retirarla y borrar el progreso con el botón de abajo. El progreso será visible para quien use este navegador.')); storageLabel.append(storageBox, storageCopy); content.append(storageLabel);
  const aiLabel = element('label', 'settings-label'); const aiBox = element('input'); aiBox.type = 'checkbox'; aiBox.checked = useAI; aiBox.disabled = !aiAvailable;
  const aiCopy = element('span', '', 'Usar IA para interpretar y adaptar preguntas'); aiCopy.append(element('small', '', aiAvailable ? 'Prueba para adultos: el ejercicio, tu explicación y hasta tres preguntas anteriores de Luma se enviarán a OpenAI. Evita datos personales. La IA puede proponer una pregunta breve con vocabulario limitado; si no supera los controles usamos la guía local. Pedimos no guardar la respuesta en la API; esto no elimina los registros de seguridad del proveedor.' : 'No hay un proveedor configurado. Todos los recorridos funcionan en modo local.')); aiLabel.append(aiBox, aiCopy); content.append(aiLabel);
  if (aiAvailable && aiStatus) {
    content.append(element('p', '', `${aiStatus.model} · ${aiStatus.calls} de ${aiStatus.maxCalls} llamadas desde que se inició el servidor · ${aiStatus.successes} ${aiStatus.successes === 1 ? 'interpretación recibida' : 'interpretaciones recibidas'}. Máximo ${aiStatus.maxSessionCalls} llamadas por expedición. Al alcanzar el límite seguimos con la guía local. Es un límite de llamadas, no de euros; reiniciar el servidor lo restablece.`));
    content.append(element('p', '', `Preguntas propuestas que superaron el filtro: ${aiStatus.questionsAccepted ?? 0}; descartadas: ${aiStatus.questionsRejected ?? 0}. Esto no equivale a preguntas mostradas ni a validación pedagógica. Tokens comunicados por el proveedor: ${aiStatus.inputTokens ?? 0} de entrada y ${aiStatus.outputTokens ?? 0} de salida; no son un cálculo en euros. Espera de la última llamada: ${aiStatus.lastLatencyMs ?? "sin medir"} ms; máximo observado: ${aiStatus.maxLatencyMs ?? 0} ms.`));
    content.append(element('p', '', `Mensajes reconducidos antes de llamar a OpenAI: ${aiStatus.guardedInputs ?? 0}. La IA interpreta y propone preguntas sobre el ejercicio actual; no dispone de navegación, ejecución de código ni acceso a archivos.`));
    const reasons = { credentials: 'La clave no se ha podido validar.', quota: 'OpenAI indica que no hay cuota o saldo disponible.', access: 'La clave no tiene acceso a este servicio.', model: 'El modelo configurado no está disponible.', limit: 'Se ha alcanzado el límite de llamadas de esta beta.', cooldown: 'Esperamos 30 segundos antes de volver a intentar la conexión.' };
    if (aiStatus.blockedReason) content.append(element('p', 'mode-warning', `${reasons[aiStatus.blockedReason] || 'La IA no está disponible.'} La guía local sigue funcionando.${['credentials', 'quota', 'access', 'model'].includes(aiStatus.blockedReason) ? ' Revisa la configuración y reinicia el servidor.' : ''}`));
  }
  content.append(button('Guardar opciones', 'dialog-primary', async event => {
    if (busy) return;
    const savingDialog = dialogVersion, savingNavigation = navigationRevision;
    const ownsDialog = () => $('#adult-dialog').open && dialogVersion === savingDialog;
    const requestedStorage = storageBox.checked, requestedAI = aiBox.checked;
    const saveButton = event.currentTarget;
    saveButton.disabled = true; saveButton.textContent = 'Guardando opciones…';
    storageBox.disabled = aiBox.disabled = true;
    $('#dialog-error').hidden = true; setBusy(true);
    try {
      if (requestedStorage) {
        const saved = await request('/api/progress/enable', { consent: true, sessionId: state?.id });
        if (rememberProgress && !saved.enabled) { state = undefined; rememberSession(null); } rememberProgress = saved.enabled; pendingRuns = saved.pending ?? []; history = [...saved.history, ...legacyHistory.filter(run => !saved.history.some(item => item.id === run.id))].slice(0, 20); saveProgress();
      } else if (rememberProgress) {
        await request('/api/progress', null, 'DELETE');
        rememberProgress = false; history = []; legacyHistory = []; pendingRuns = []; draftArchive.clear(); state = undefined; rememberSession(null); storage?.removeItem(PROGRESS_KEY);
      }
      const changedAI = useAI !== requestedAI; useAI = requestedAI;
      const current = ownsDialog() && savingNavigation === navigationRevision;
      if (ownsDialog()) $('#adult-dialog').close();
      if (!state && view === 'learn') navigate('home'); else render();
      if (changedAI && state && current) { setBusy(false); await start(state.mission.id); }
      else if (changedAI && state) {
        $('#settings-status').textContent = 'Modo actualizado. Se usará al empezar otra aventura.';
        $('#settings-status').hidden = false;
      }
    } catch (error) {
      const message = `No se han aplicado las opciones: ${error.message}`;
      if (ownsDialog()) showError(message);
      else pendingSettingsError = message;
    }
    finally {
      saveButton.disabled = false; saveButton.textContent = 'Guardar opciones';
      storageBox.disabled = false; aiBox.disabled = !aiAvailable;
      setBusy(false);
    }
  }));
  content.append(element('p', '', 'Cambiar el modo de IA empieza una sesión nueva al guardar. Si cierras estas opciones durante el guardado, el cambio se aplicará al empezar otra aventura. Desactivar el guardado borra los recorridos y las actividades guardadas de este navegador, también en otras pestañas.'));
  content.append(button('Borrar recorrido y sesión de este dispositivo', 'dialog-secondary', async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (rememberProgress) await request('/api/progress', null, 'DELETE');
      else if (state?.id) await request(`/api/session/${state.id}`, null, 'DELETE');
      storage?.removeItem(PROGRESS_KEY); rememberSession(null); history = []; legacyHistory = []; pendingRuns = []; draftArchive.clear(); rememberProgress = false; state = undefined; $('#explanation').value = ''; window.speechSynthesis?.cancel(); $('#adult-dialog').close(); navigate('home');
    } catch (error) { showError(`No se ha completado el borrado. ${error.message}`); }
    finally { setBusy(false); }
  })); openDialog('Opciones para adultos', content, opener);
}
function exportProgress() {
  const summary = buildProgressExport(runs(), missions);
  const json = JSON.stringify(summary, null, 2); const content = element('div');
  content.append(element('p', '', 'Descarga el resumen o selecciona el texto para copiarlo. Si tu panel de vista previa no admite descargas, puedes usar esta copia.'));
  const label = element('label', 'export-label', 'Resumen JSON'); label.htmlFor = 'export-json';
  const preview = element('textarea', 'export-json'); preview.id = 'export-json'; preview.readOnly = true; preview.value = json;
  content.append(label, preview, button('Seleccionar resumen', 'dialog-secondary', () => { preview.focus(); preview.select(); }));
  content.append(button('Descargar archivo JSON', 'dialog-primary', () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })); const link = element('a'); link.href = url; link.download = 'luma-recorrido.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  })); openDialog('Exportar recorrido', content);
}
$('.skip-link').addEventListener('click', event => { event.preventDefault(); $('#main-content').focus(); $('#main-content').scrollIntoView({ block: 'start', behavior: 'instant' }); });
document.querySelectorAll('[data-starter]').forEach(node => node.addEventListener('click', () => { if (!$('#explanation').value.trim()) $('#explanation').value = node.dataset.starter; $('#explanation').focus(); }));
$('#explanation-form').addEventListener('submit', event => { event.preventDefault(); turn({ type: 'explain', text: $('#explanation').value }); });
$('#explanation').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('#explanation-form').requestSubmit(); } });
document.querySelectorAll('[data-confidence]').forEach(node => node.addEventListener('click', () => { selectedConfidence = selectedConfidence === node.dataset.confidence ? null : node.dataset.confidence; render(); }));
$('#hint-button').addEventListener('click', () => turn({ type: 'hint' })); $('#pause-button').addEventListener('click', () => turn({ type: 'pause' })); $('#resume-button').addEventListener('click', () => turn({ type: 'resume' })); $('#next-button').addEventListener('click', () => turn({ type: 'next' }));
$('#review-activity').addEventListener('click', () => { $('#problem-title').focus({ preventScroll: true }); $('#problem-title').scrollIntoView({ block: 'start', behavior: 'instant' }); });
$('#hero-start').addEventListener('click', () => state && state.phase !== 'finished' ? continueAdventure() : navigate('explore'));
$('#greet-luma').addEventListener('click', () => {
  const greetings = ['¡Hola! ¿Qué isla te da más curiosidad?', 'Cambiar de idea también es descubrir.', 'Una buena pista empieza con: ¿por qué?', '¿Listo para una buena pregunta?'];
  $('#luma-greeting').textContent = greetings[greetingIndex++ % greetings.length];
  $('#greet-luma').classList.remove('waving'); void $('#greet-luma').offsetWidth; $('#greet-luma').classList.add('waving');
});
$('#continue-button').addEventListener('click', continueAdventure);
$('#explore-continue-button').addEventListener('click', continueAdventure);
$('#home-nav').addEventListener('click', () => navigate('home')); $('.brand').addEventListener('click', event => { event.preventDefault(); navigate('home'); });
$('#explore-nav').addEventListener('click', () => navigate('explore'));
async function openFamily() {
  const requestId = ++familyRequest;
  loadingFamily = true; navigate('family');
  try {
    const saved = await request('/api/progress', null, 'GET');
    if (requestId !== familyRequest) return;
    rememberProgress = saved.enabled; pendingRuns = saved.pending ?? []; history = [...saved.history, ...legacyHistory.filter(run => !saved.history.some(item => item.id === run.id))].slice(0, 20);
  } catch (error) {
    if (requestId === familyRequest && view === 'family') showError(error.message);
  } finally {
    if (requestId === familyRequest) { loadingFamily = false; if (view === 'family') renderFamily(); }
  }
}
$('#family-nav').addEventListener('click', openFamily); $('#home-family-button').addEventListener('click', openFamily);
$('#progress-button').addEventListener('click', showProgress); $('#completion-progress').addEventListener('click', showProgress); $('#choose-next').addEventListener('click', () => navigate('explore'));
$('#method-nav').addEventListener('click', showMethod); $('#settings-button').addEventListener('click', showSettings); $('#family-settings').addEventListener('click', showSettings); $('#export-progress').addEventListener('click', exportProgress);
$('#close-dialog').addEventListener('click', () => $('#adult-dialog').close()); $('#adult-dialog').addEventListener('click', event => { if (event.target === $('#adult-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } });
$('#adult-dialog').addEventListener('close', () => {
  if ($('#adult-dialog').open) return;
  pendingDialogReturn = dialogReturn; dialogReturn = null;
  restoreDialogFocus();
  flushSettingsError();
});
$('#sound-button').addEventListener('click', () => { speechEnabled = !speechEnabled; $('#sound-button').setAttribute('aria-pressed', String(speechEnabled)); $('#sound-button').textContent = speechEnabled ? '◖ Lectura activada' : '◖ Leer en voz alta'; if (!speechEnabled) window.speechSynthesis?.cancel(); else { lastSpoken = ''; speak([...state?.messages ?? []].reverse().find(message => message.role === 'tutor')?.text); } });
if (!('speechSynthesis' in window)) $('#sound-button').hidden = true;
window.addEventListener('hashchange', () => navigate(viewForHash(location.hash), false));
let startupError;
try {
  const [config, catalog, saved] = await Promise.all([request('/api/config', null, 'GET'), request('/api/missions', null, 'GET'), request('/api/progress', null, 'GET')]); aiAvailable = config.aiAvailable; aiStatus = config.ai; missions = catalog.missions; rememberProgress = saved.enabled; pendingRuns = saved.pending ?? []; history = [...saved.history, ...legacyHistory.filter(run => !saved.history.some(item => item.id === run.id))].slice(0, 20);
  const id = sessionId(tabStorage);
  if (id) { try { state = await request(`/api/session/${id}`, null, 'GET'); useAI = state.mode === 'ai'; } catch { rememberSession(null); } }
} catch { startupError = 'No se ha podido cargar Luma. Comprueba que el servidor esté en marcha y recarga la página.'; }
navigate(viewForHash(location.hash));
if (startupError) showError(startupError);
