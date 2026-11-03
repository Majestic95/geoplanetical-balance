// Runs one game worker bundle inside a Node worker thread with the Web Worker globals it needs.
import { parentPort, workerData, Worker as NodeWorker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

// sourceText: patched text for this bundle (else the file is read); overrides: { bundleFileName: patched text } for
// the workers this one starts, so a mod that patches several bundles is tested as the launcher runs it.
const { bundlePath, sourceText, overrides = {} } = workerData;
const href = pathToFileURL(bundlePath).href;
const BOOT = fileURLToPath(import.meta.url);

const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('file:')) return nativeFetch(input, init);
  try { return new Response(await readFile(fileURLToPath(url)), { status: 200 }); }
  catch { return new Response(null, { status: 404 }); }
};

class WebWorker {
  constructor(url) {
    const u = new URL(String(url), href);
    this.onmessage = null; this.onerror = null; this._l = { message: [], error: [] };
    const path = fileURLToPath(u), name = basename(path);
    const { [name]: own, ...rest } = overrides;
    this._w = new NodeWorker(BOOT, { workerData: { bundlePath: path, sourceText: own, overrides: rest } });
    this._w.on('message', data => this._emit('message', { data }));
    this._w.on('error', error => this._emit('error', { message: error.message, error }));
  }
  _emit(type, ev) { this[`on${type}`]?.(ev); for (const f of this._l[type]) f(ev); }
  postMessage(m, t) { this._w.postMessage(m, Array.isArray(t) ? t : t?.transfer); }
  addEventListener(type, f) { this._l[type]?.push(f); }
  removeEventListener(type, f) { const a = this._l[type]; if (a) a.splice(a.indexOf(f) >>> 0, 1); }
  terminate() { this._w.terminate(); }
}

globalThis.self = globalThis;
globalThis.location = { href };
globalThis.Worker = WebWorker;
globalThis.postMessage = (m, t) => parentPort.postMessage(m, Array.isArray(t) ? t : t?.transfer);
globalThis.onmessage = null;
globalThis.close = () => process.exit(0);
parentPort.on('message', data => globalThis.onmessage?.({ data }));

vm.runInThisContext(sourceText ?? readFileSync(bundlePath, 'utf8'), { filename: href });
