// A draft belongs to a particular choice in an unfinished activity, not just its title.
export function draftFitsActivity(before, after) {
  return Boolean(before && after && before.id && before.runId && before.id === after.id && before.runId === after.runId &&
    before.lesson?.id && before.lesson.id === after.lesson?.id &&
    [0, 1].includes(before.choice) && before.choice === after.choice &&
    ['reflect', 'explain'].includes(after.phase));
}

// Page memory only: switching islands must not discard an unsent idea or persist it to disk.
export function createDraftArchive(limit = 20) {
  const drafts = new Map();
  return {
    save(state, text) {
      if (!state?.runId) return;
      drafts.delete(state.runId);
      if (!text.trim()) return;
      drafts.set(state.runId, { text, before: { id: state.id, runId: state.runId, lesson: { id: state.lesson?.id }, choice: state.choice } });
      while (drafts.size > limit) drafts.delete(drafts.keys().next().value);
    },
    read(state) {
      const draft = drafts.get(state?.runId);
      if (!draft) return null;
      return { text: draft.text, fits: draftFitsActivity({ ...draft.before, id: state.id }, state) };
    },
    forget(runId) { drafts.delete(runId); },
    clear() { drafts.clear(); }
  };
}
