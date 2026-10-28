const sameMessage = (a, b) => a?.id === b?.id && a?.role === b?.role && a?.text === b?.text;

// A server snapshot may trim the oldest messages, but retained messages keep their IDs.
export function conversationUpdate(previous, next, sameSession) {
  if (sameSession && previous.length) {
    const start = previous.findIndex(message => sameMessage(message, next[0]));
    if (start >= 0 && previous.slice(start).every((message, index) => sameMessage(message, next[index]))) {
      return { reset: false, remove: start, append: next.slice(previous.length - start) };
    }
  }
  return { reset: true, remove: 0, append: next };
}

export function createConversationRenderer(makeBubble) {
  let previous = [];
  let session;
  return (log, messages, sessionId) => {
    const update = conversationUpdate(previous, messages, session === sessionId);
    if (!update.reset && !update.remove && !update.append.length) return;
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    const top = log.getBoundingClientRect().top;
    // Anchor a surviving message before pruning, including when the visible oldest one expires.
    const anchor = update.reset ? null : Array.from(log.children).slice(update.remove)
      .find(node => node.getBoundingClientRect().bottom > top);
    const anchorTop = anchor?.getBoundingClientRect().top;
    if (update.reset) log.replaceChildren();
    else for (let i = 0; i < update.remove; i++) log.firstElementChild.remove();
    for (const message of update.append) log.append(makeBubble(message));
    if (update.reset || atBottom) log.scrollTop = log.scrollHeight;
    else if (anchor) log.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
    previous = messages.map(message => ({ ...message }));
    session = sessionId;
  };
}
