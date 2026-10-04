/** Explicit Alpha operator selection; never retries or rotates after an inference error. */
export function selectAlphaGeminiCredentials(keys, index) {
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > 32) throw new Error('Invalid Alpha credential configuration');
  if (index === undefined || index === '') return Object.freeze([...keys]);
  if (typeof index !== 'string' || !/^(0|[1-9][0-9]*)$/.test(index)) throw new Error('Invalid Alpha active credential index');
  const selected = Number(index);
  if (!Number.isSafeInteger(selected) || selected >= keys.length) throw new Error('Invalid Alpha active credential index');
  return Object.freeze([keys[selected]]);
}
