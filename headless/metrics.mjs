// Month metrics from a simulation `save.snapshot`: money account totals by type and per-country figures.
import zlib from 'node:zlib';

const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const MONEY = /deposit|reserve|backing|currency|bank-loans|bank-funding|bank-equity|cb-liquidity|liquidity-assets|sovereign/;

// A snapshot part as parsed JSON (parts are raw or encoded; see docs/headless-simulation.md).
export function part(snap, id) {
  const p = snap.artifact.parts.find(x => x.id === id);
  if (!p) throw new Error(`snapshot has no part ${id}`);
  const bytes = p.source === 'raw' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Finance accounts table rows: [id, ownerType, ownerId, countryKey, currencyCode, kind, normal, balanceBn, ...].
export function measure(snap) {
  const f = part(snap, 'finance'), c = part(snap, 'countries');
  const money = {};
  const deposits = {};
  for (const r of f.accounts.rows) {
    const type = r[0].split(':')[0], bn = Number(r[7]) || 0;
    if (MONEY.test(type)) money[type] = (money[type] || 0) + bn;
    if (type === 'hh-deposits') deposits[r[3]] = (deposits[r[3]] || 0) + bn;
  }
  const byCountry = {};
  for (const h of Object.values(f.households)) {
    const e = byCountry[h.countryKey] || (byCountry[h.countryKey] = { plugBn: 0, finIncBnY: 0 });
    e.plugBn += h.operatingIncome?.unrepresentedIncomeBn || 0;
    e.finIncBnY += h.annualFinancialIncomeBn || 0;
  }
  for (const [k, x] of Object.entries(c)) {
    const e = byCountry[k] || (byCountry[k] = { plugBn: 0, finIncBnY: 0 });
    Object.assign(e, { gdp: x.gdpNom, growth: x.growth, inflation: x.inflation, unemployment: x.unemployment,
      approval: x.approval, hhDepositsBn: deposits[k] || 0 });
  }
  return { money, byCountry };
}
