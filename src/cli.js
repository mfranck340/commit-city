#!/usr/bin/env node
// commit-city CLI
//   node src/cli.js --user <login> [--out dir] [--themes light,dark] [--accent "#FF3670"]
//                   [--style classic|minimal|blueprint|neon|clay] [--months 1-12]
//                   [--color #RRGGBB] [--crane-color #RRGGBB] [--block 6x5] [--layout blocks|calendar]
//                   [--timezone Europe/Madrid] [--lat 40.42 --lon -3.70] [--phase auto|day|night]
//                   [--charts months,weekdays,languages] [--year 2025] [--demo] [--input calendar.json]
// Token: GITHUB_TOKEN (or COMMIT_CITY_TOKEN). Without a token the public
// contributions page is used instead.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchContributions, demoDays, assignLevels, addPrivateSplit } from './github.js';
import { render } from './render.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const user = args.user || process.env.COMMIT_CITY_USER || process.env.GITHUB_REPOSITORY_OWNER;
const outDir = args.out || process.env.COMMIT_CITY_OUT || 'commit-city';
const themes = String(args.themes || process.env.COMMIT_CITY_THEMES || 'light,dark').split(',').map((s) => s.trim()).filter(Boolean);
const accent = args.color || args.accent || process.env.COMMIT_CITY_COLOR || process.env.COMMIT_CITY_ACCENT || '#FF3670';
const craneColor = args['crane-color'] || process.env.COMMIT_CITY_CRANE_COLOR || undefined;
const layout = args.layout || process.env.COMMIT_CITY_LAYOUT || 'blocks';
const rows = args.rows || process.env.COMMIT_CITY_ROWS || 'auto';
const seasons = String(args.seasons ?? process.env.COMMIT_CITY_SEASONS ?? 'true') !== 'false';
const hemisphere = args.hemisphere || process.env.COMMIT_CITY_HEMISPHERE || 'north';
const eventColor = args['event-color'] || process.env.COMMIT_CITY_EVENT_COLOR || '#A78BFA';
// events: one per line (or separated by ";"): "2026-09-15..2026-09-18 ITSC 2026" or "2026-11-18 ROBOT"
const events = String(args.events || process.env.COMMIT_CITY_EVENTS || '')
  .split(/\n|;/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => {
    const m = l.match(/^(\d{4}-\d{2}-\d{2})(?:\s*(?:\.\.|to|-|–)\s*(\d{4}-\d{2}-\d{2}))?\s*[|:]?\s*(.*)$/);
    if (!m) {
      console.warn(`commit-city: ignoring event "${l}" (use YYYY-MM-DD[..YYYY-MM-DD] Label)`);
      return null;
    }
    return { from: m[1], to: m[2] || m[1], label: m[3].slice(0, 28) };
  })
  .filter(Boolean);
const block = args.block || process.env.COMMIT_CITY_BLOCK || '6x5';
const style = args.style || process.env.COMMIT_CITY_STYLE || 'minimal';
const months = args.months || process.env.COMMIT_CITY_MONTHS || 12;
const charts = String(args.charts || process.env.COMMIT_CITY_CHARTS || '');
const timeZone = args.timezone || process.env.COMMIT_CITY_TIMEZONE || 'UTC';
const lat = args.lat ?? process.env.COMMIT_CITY_LAT;
const lon = args.lon ?? process.env.COMMIT_CITY_LON;
const phase = args.phase || process.env.COMMIT_CITY_PHASE || 'auto';
const privateColor = args['private-color'] || process.env.COMMIT_CITY_PRIVATE_COLOR || '#14B8A6';
const split = String(args.split ?? process.env.COMMIT_CITY_SPLIT ?? 'true') !== 'false';
const year = args.year || process.env.COMMIT_CITY_YEAR || '';
const token = process.env.COMMIT_CITY_TOKEN || process.env.GITHUB_TOKEN || '';

for (const [name, c] of [['color', accent], ['crane-color', craneColor], ['private-color', privateColor], ['event-color', eventColor]]) {
  if (c && !/^#[0-9a-fA-F]{6}$/.test(c)) {
    console.error(`Invalid ${name} "${c}" (use #RRGGBB)`);
    process.exit(1);
  }
}

async function main() {
  let login = user || 'octocat';
  let days;
  let languages = null;
  if (args.demo) {
    days = demoDays(typeof args.demo === 'string' ? args.demo : undefined);
  } else if (args.input) {
    const json = JSON.parse(await readFile(args.input, 'utf8'));
    days = json.days ?? json;
    if (!days.some((d) => d.level)) assignLevels(days);
    languages = json.languages ?? null;
    login = user || login;
  } else {
    if (!user) throw new Error('Missing --user (or run inside GitHub Actions)');
    const opts = year ? { from: `${year}-01-01T00:00:00Z`, to: `${year}-12-31T23:59:59Z` } : {};
    const data = await fetchContributions(user, token, opts);
    login = data.login;
    days = data.days;
    languages = data.languages;
    if (token && split) {
      try {
        await addPrivateSplit(data.login, token, days);
      } catch (e) {
        console.warn(`commit-city: could not split public/private (${e.message}); drawing everything as public`);
      }
    }
  }
  const today = year ? days[days.length - 1].date : new Date().toISOString().slice(0, 10);
  await mkdir(outDir, { recursive: true });
  for (const theme of themes) {
    const svg = render({ login, days, theme, style, accent, craneColor, privateColor, rows, seasons, hemisphere, events, eventColor, timeZone, phase, lat: lat === undefined || lat === '' ? undefined : Number(lat), lon: lon === undefined || lon === '' ? undefined : Number(lon), layout, block, months, charts, languages, today: days.some((d) => d.date === today) ? today : days[days.length - 1].date });
    const file = join(outDir, `commit-city-${theme}.svg`);
    await writeFile(file, svg);
    console.log(`✓ ${file} (${(svg.length / 1024).toFixed(0)} KB)`);
  }
}

main().catch((err) => {
  console.error(`commit-city: ${err.message}`);
  process.exit(1);
});
