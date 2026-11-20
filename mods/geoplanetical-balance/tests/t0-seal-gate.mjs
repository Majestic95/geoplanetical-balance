// Port watch shared by the N13 and EN10 tests. N13 (K6a, the sanctions seed record __geobalSeed) and EN10 (zcr, the
// settled-margin record __geobalMarginPct0) write extra keys into state restored from the game's economic T0
// checkpoint. The game's runtime seal (the function holding "economic T0 runtime seal advanced time") compares that
// state with the checkpoint and fails on extra keys, but it is skipped for a checkpoint whose bytes were certified:
// the gate is `X=!1;function G(e){return X||!e||!S.has(e)}`, the checkpoint validator adds the payload to S when called
// with {bytesCertified:!0}, and the loader of the shipped checkpoint calls it that way. This returns what no longer
// holds on the given bundle text (empty when the gate still skips the seal). Read by text, anchored on stable strings.
const fnAt = (text, i) => { const s = text.lastIndexOf('function ', i); return { name: text.slice(s + 9, text.indexOf('(', s)), start: s }; };
export function sealGateProblems(text) {
  const out = [];
  const sealAt = text.indexOf('economic T0 runtime seal advanced time');
  if (sealAt < 0) return ['the runtime seal ("economic T0 runtime seal advanced time") is gone: re-read how checkpoint state is checked'];
  const seal = fnAt(text, sealAt).name;
  const call = new RegExp(`([\\w$]+)\\(a\\.checkpointPayload\\)&&${seal.replace(/\$/g, '\\$')}\\(e,a\\.checkpointPayload\\)`).exec(text);
  if (!call) return [`the seal ${seal} is no longer called behind a gate on the checkpoint payload`];
  const gate = call[1].replace(/\$/g, '\\$');
  const def = new RegExp(`([\\w$]+)=!1;function ${gate}\\(e\\)\\{return \\1\\|\\|!e\\|\\|!([\\w$]+)\\.has\\(e\\)\\}`).exec(text);
  if (!def) return [`the seal gate ${call[1]} is no longer "constant false || no payload || payload not certified"`];
  const set = def[2].replace(/\$/g, '\\$');
  if (!new RegExp(`\\{bytesCertified:a=!1\\}=\\{\\}\\)\\{[^]{0,4000}?a&&${set}\\.add\\(e\\)`).test(text)) out.push(`the checkpoint validator no longer adds certified payloads to ${def[2]}`);
  if (!text.includes('{bytesCertified:!0}')) out.push('no loader certifies the checkpoint bytes any more');
  return out;
}
export const SEAL_GATE_HINT = 'N13 and EN10 write extra keys (__geobalSeed, __geobalMarginPct0) into checkpoint-restored state; the runtime seal now runs on it, so they must move after the genesis seal (bIt) or become seal-safe';
