// Public exploration helpers only use visible data, never private answer keys.
export function partition(parts, selected = 1) {
  if (!Number.isInteger(parts) || parts < 2 || parts > 10) throw new RangeError('Choose 2–10 equal parts.');
  if (!Number.isInteger(selected) || selected < 0 || selected > parts) throw new RangeError('Invalid selected pieces.');
  return Array.from({ length: parts }, (_, index) => ({ filled: index < selected, share: 1 / parts }));
}
export function sequencePairs(sequence) {
  if (!Array.isArray(sequence) || sequence.length < 2 || !sequence.every(Number.isFinite)) throw new TypeError('A finite sequence is required.');
  return sequence.slice(1).map((to, index) => ({ from: sequence[index], to, difference: to - sequence[index] }));
}
export function clueSentences(context) {
  return String(context).split(/(?<=[.!?])\s+/).map(text => text.trim()).filter(Boolean);
}

export function pairDescription(pair, comparison = 'difference') {
  if (![pair?.from, pair?.to].every(Number.isFinite)) throw new TypeError('A finite pair is required.');
  if (comparison === 'difference') {
    const change = pair.to - pair.from;
    return `De ${pair.from} a ${pair.to}: ${change === 0 ? 'no cambia la cantidad' : `${change > 0 ? 'aumenta' : 'disminuye'} ${Math.abs(change)}`}.`;
  }
  if (comparison !== 'ratio' || pair.from <= 0 || !Number.isInteger(pair.to / pair.from)) throw new RangeError('An exact ratio from a positive quantity is required.');
  return `De ${pair.from} a ${pair.to}: la segunda cantidad es ${pair.to / pair.from} veces la primera.`;
}
