import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationUpdate, createConversationRenderer } from '../public/conversation.js';
import { createSession, advance, publicSession } from '../lib/tutor.js';

const message = id => ({ id: String(id), role: 'tutor', text: 'Seguimos cuando quieras.' });
const windowOf = (start, count = 30) => Array.from({ length: count }, (_, i) => message(start + i));

// Small DOM substitute with variable-height bubbles, clamped scroll and node identity.
function logFixture() {
  const log = { children: [], clientHeight: 180, top: 0, replacements: 0,
    get scrollHeight() { return this.children.reduce((height, node) => height + node.height, 0); },
    get scrollTop() { return this.top; },
    set scrollTop(value) { this.top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); },
    get firstElementChild() { return this.children[0]; },
    getBoundingClientRect() { return { top: 0 }; },
    replaceChildren() { this.children = []; this.replacements++; },
    append(node) { this.children.push(node); }
  };
  const makeBubble = item => ({ item, height: 40 + (Number(item.id) % 3) * 10,
    getBoundingClientRect() {
      const top = log.children.slice(0, log.children.indexOf(this)).reduce((sum, node) => sum + node.height, 0) - log.scrollTop;
      return { top, bottom: top + this.height };
    },
    remove() { log.children.splice(log.children.indexOf(this), 1); }
  });
  return { log, render: createConversationRenderer(makeBubble) };
}

test('rolling window retains 29 messages with identical text and adds just the new ID', () => {
  const { log, render } = logFixture();
  render(log, windowOf(0), 'session'); const original = [...log.children];
  render(log, windowOf(1), 'session');
  assert.equal(log.replacements, 1);
  assert.equal(log.children.length, 30);
  log.children.slice(0, 29).forEach((node, i) => assert.equal(node, original[i + 1]));
  assert.equal(log.children.at(-1).item.id, '30');
});

test('a skipped snapshot prunes multiple messages and retains their shared suffix', () => {
  assert.deepEqual(conversationUpdate(windowOf(0), windowOf(4), true), { reset: false, remove: 4, append: windowOf(30, 4) });
});

test('scroll follows new messages only while reading the bottom', () => {
  const { log, render } = logFixture();
  render(log, windowOf(0), 'session');
  render(log, windowOf(1), 'session');
  assert.equal(log.scrollTop, log.scrollHeight - log.clientHeight);
  log.scrollTop = 350; const anchor = log.children[9]; const position = anchor.getBoundingClientRect().top;
  render(log, windowOf(2), 'session');
  assert.equal(anchor.getBoundingClientRect().top, position);
  assert.notEqual(log.scrollTop, log.scrollHeight - log.clientHeight);
});

test('unrelated renders do not move history, rebuild bubbles or append announcements', () => {
  const { log, render } = logFixture();
  render(log, windowOf(0), 'session'); log.scrollTop = 150;
  const nodes = [...log.children];
  render(log, structuredClone(windowOf(0)), 'session');
  assert.equal(log.scrollTop, 150); assert.equal(log.replacements, 1);
  log.children.forEach((node, i) => assert.equal(node, nodes[i]));
});

test('changed sessions, recovered histories and edited messages replace the obsolete log', () => {
  const original = windowOf(0);
  assert.equal(conversationUpdate(original, original, false).reset, true);
  assert.equal(conversationUpdate(original, [message('recovered')], true).reset, true);
  assert.equal(conversationUpdate(original, original.map((item, i) => i === 5 ? { ...item, text: 'Changed' } : item), true).reset, true);
});

test('when the oldest visible bubble expires, scrolling clamps at the first surviving message', () => {
  const { log, render } = logFixture();
  render(log, windowOf(0), 'session'); log.scrollTop = 10;
  render(log, windowOf(1), 'session');
  assert.equal(log.scrollTop, 0);
  assert.equal(log.children[0].item.id, '1');
});

test('server IDs survive polling and rolling history, while repeated texts remain distinct', async () => {
  const session = createSession(); const initial = publicSession(session);
  assert.equal(publicSession(session).messages[0].id, initial.messages[0].id);
  for (let i = 0; i < 32; i++) await advance(session, { type: i % 2 ? 'resume' : 'pause' });
  const previous = publicSession(session).messages.map(item => ({ ...item }));
  const next = await advance(session, { type: 'pause' });
  assert.equal(new Set(next.messages.map(item => item.id)).size, 30);
  assert.deepEqual(next.messages.slice(0, 29), previous.slice(1));
  assert.deepEqual(conversationUpdate(previous, next.messages, true), { reset: false, remove: 1, append: next.messages.slice(-1) });
});
