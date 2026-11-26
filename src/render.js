// commit-city renderer: contribution calendar -> animated isometric city (SVG).
//
// Grid: every week is a column (X), every weekday a row (Y). Weeks are grouped
// into city blocks separated by avenues, and the whole district is wrapped by
// two boulevards. An autonomous car drives a closed loop through every avenue.
//
// Isometric projection (2:1): screen = ((x - y) * A, (x + y) * A / 2 - z)

import { shade, mix } from './color.js';
import { rng } from './random.js';
import { THEMES } from './themes.js';
import { STYLES } from './styles.js';
import { skyPhase } from './sun.js';
import { computeStats } from './stats.js';
import { toWeeks } from './github.js';

const A = 12; // half tile width in px
const MARGIN_DEFAULT = 0.12; // sidewalk around each lot
const BLOCK_WEEKS = 4;
const SLAB = 16; // thickness of the ground slab
const MAX_H = 104; // tallest skyscraper (px)
const PAD = 24;
const HEADROOM = 126;
const FONT = "'Segoe UI', Ubuntu, 'Helvetica Neue', Helvetica, Arial, sans-serif";

const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function render({ login, days, theme = 'dark', style = 'minimal', accent = '#FF3670', secondsPerCell = 0.22, today, title, months = 12, charts = [], languages = null, layout = 'blocks', block = '6x5', rows = 'auto', seasons = true, hemisphere = 'north', events = [], eventColor = '#A78BFA', craneColor, privateColor = '#14B8A6', now = new Date(), timeZone = 'UTC', lat, lon, phase = 'auto' } = {}) {
  const S = STYLES[style];
  if (!S) throw new Error(`Unknown style "${style}" (use ${Object.keys(STYLES).join(', ')})`);
  if (!THEMES[theme]) throw new Error(`Unknown theme "${theme}"`);
  const T = { ...THEMES[theme], ...(S[theme] || {}) };
  const resolve = (c) => (c === 'ACCENT' ? accent : c === 'ACCENT_SOFT' ? mix(accent, T.night ? '#30363d' : '#ffffff', 0.35) : c);
  for (const k of Object.keys(T)) {
    if (Array.isArray(T[k])) T[k] = T[k].map(resolve);
    else if (typeof T[k] === 'string') T[k] = resolve(T[k]);
  }
  const MARGIN = S.margin ?? MARGIN_DEFAULT;
  if (craneColor) T.craneColor = craneColor;
  // Day or night depends on the time of day, independently of the light/dark palette.
  const sky0 = skyPhase({ now, timeZone, lat, lon, phase });
  const night = sky0.night;
  // Light: at night everything gets a deep blue tint so the lights stand out; by day the
  // dark palette gets warm sunlight so it doesn't look like night.
  const toneTarget = night ? '#0a0f2c' : '#9fb3d9';
  const toneAmt = night ? (T.night ? 0.32 : 0.4) : (T.night ? 0.14 : 0);
  const tone = (c) => (toneAmt ? mix(c, toneTarget, toneAmt) : c);
  for (const k of ['skyTop', 'skyBottom', 'slabTop', 'slabLeft', 'slabRight', 'slabGrass', 'road', 'roadLine', 'curbTop', 'curbSide', 'grass', 'grassDark', 'trees', 'trunk', 'houses', 'roofs', 'blocks', 'towers', 'glass', 'pond', 'roofGarden', 'car', 'carSide', 'carGlass', 'window']) {
    if (Array.isArray(T[k])) T[k] = T[k].map(tone);
    else if (typeof T[k] === 'string') T[k] = tone(T[k]);
  }
  if (night && !T.night) {
    T.skyTop = '#8a96c2';
    T.skyBottom = '#dfe3f0';
  }
  if (!night && T.night) {
    T.skyTop = mix(T.skyTop, '#3b5b8f', 0.55);
    T.skyBottom = mix(T.skyBottom, '#1b2335', 0.3);
  }
  const lit = ['#ffd25a', '#ffe27a', '#ffbf47', '#fff2b8'];
  const unlit = T.window;
  const beamOpacity = night ? Math.max(T.beam || 0, 0.4) : 0;
  const lampGlow = night ? 0.85 : 0;
  today = today ?? days[days.length - 1]?.date;
  months = Math.max(1, Math.min(12, Math.round(Number(months) || 12)));
  if (layout !== 'calendar') {
    // blocks of 30 days: N months = N blocks
    const m2 = String(block).match(/^(\d+)\s*x\s*(\d+)$/);
    const per = m2 ? Math.max(2, Math.min(10, Number(m2[1]))) * Math.max(2, Math.min(10, Number(m2[2]))) : 30;
    days = days.filter((d) => d.date <= today).slice(-months * per);
  } else if (months < 12) {
    const cut = new Date(today + 'T00:00:00Z');
    cut.setUTCMonth(cut.getUTCMonth() - months);
    cut.setUTCDate(cut.getUTCDate() - cut.getUTCDay()); // start on a Sunday
    const c = cut.toISOString().slice(0, 10);
    days = days.filter((d) => d.date >= c);
  }
  const weeks = toWeeks(days);
  const stats = computeStats(days, today);

  // ---------- layout ----------
  // cells: [{gx, gy, day}], roads at roadCols (x) and roadRows (y), blocks = curb rectangles
  const cells = [];
  const blocks = [];
  const parks = [];
  let roadCols;
  let roadRows;
  let NX;
  let NY;
  if (layout === 'calendar') {
    roadCols = [0];
    let x = 1;
    weeks.forEach((wk, w) => {
      wk.forEach((day, wd) => day && cells.push({ gx: x, gy: 1 + wd, day }));
      x++;
      if ((w + 1) % BLOCK_WEEKS === 0 || w === weeks.length - 1) roadCols.push(x++);
    });
    NX = x;
    NY = 9;
    roadRows = [0, NY - 1];
    for (let k = 0; k < roadCols.length - 1; k++) blocks.push([roadCols[k] + 1, 1, roadCols[k + 1], NY - 1]);
  } else {
    // sequential days packed into city blocks of BC x BR lots (6x5 = 30 days, about a month)
    const m = String(block).match(/^(\d+)\s*x\s*(\d+)$/);
    const BC = Math.max(2, Math.min(10, m ? Number(m[1]) : 6));
    const BR = Math.max(2, Math.min(10, m ? Number(m[2]) : 5));
    const per = BC * BR;
    const nBlocks = Math.max(1, Math.ceil(days.length / per));
    const blockRowsN = rows === 'auto' || !Number(rows) ? (nBlocks <= 6 ? 1 : 2) : Math.max(1, Math.min(Number(rows), 3, nBlocks));
    const bpr = Math.ceil(nBlocks / blockRowsN);
    NX = 1 + bpr * (BC + 1);
    NY = 1 + blockRowsN * (BR + 1);
    roadCols = Array.from({ length: bpr + 1 }, (_, i) => i * (BC + 1));
    roadRows = Array.from({ length: blockRowsN + 1 }, (_, i) => i * (BR + 1));
    days.forEach((day, i) => {
      const b = Math.floor(i / per);
      const k = i % per;
      const bc = b % bpr;
      const br = Math.floor(b / bpr);
      cells.push({ gx: 1 + bc * (BC + 1) + Math.floor(k / BR), gy: 1 + br * (BR + 1) + (k % BR), day });
    });
    // empty block slots (and the unused part of the last block) become parks
    for (let b = nBlocks - 1; b < bpr * blockRowsN; b++) {
      const x0 = 1 + (b % bpr) * (BC + 1);
      const y0 = 1 + Math.floor(b / bpr) * (BR + 1);
      const usedCols = b === nBlocks - 1 ? Math.ceil((days.length - b * per) / BR) : 0;
      if (usedCols < BC) parks.push([x0 + usedCols, y0, x0 + BC, y0 + BR]);
    }
    for (let b = 0; b < nBlocks; b++) {
      const x0 = 1 + (b % bpr) * (BC + 1);
      const y0 = 1 + Math.floor(b / bpr) * (BR + 1);
      const used = Math.min(per, days.length - b * per);
      blocks.push([x0, y0, x0 + Math.min(BC, Math.ceil(used / BR)), y0 + BR]);
    }
  }
  const cityW = (NX + NY) * A + PAD * 2;
  const chartList = (Array.isArray(charts) ? charts : String(charts).split(','))
    .map((c) => c.trim()).filter((c) => ['months', 'weekdays', 'languages', 'recent', 'split'].includes(c))
    .filter((c) => c !== 'languages' || (languages && languages.length))
    .filter((c) => c !== 'split' || days.some((d) => d.private > 0));
  // charts go in a column to the right of the map, under the title
  const CARD_W = 300;
  const CARD_H = 106;
  const CARD_GAP = 12;
  const nCharts = chartList.length;
  const cityAreaW = Math.max(cityW, nCharts ? 0 : 720);
  const width = Math.ceil(cityAreaW + (nCharts ? CARD_W + PAD : 0));
  const ox = PAD + NY * A + (cityAreaW - cityW) / 2;
  const oy = HEADROOM;
  const cityBottom = Math.ceil(oy + ((NX + NY) * A) / 2 + SLAB);
  const leftX = ox - NY * A;
  const yEdge = (xx) => oy + (NY * A) / 2 + SLAB + (xx - leftX) / 2;
  const cardX = width - PAD - CARD_W;
  const cardTop = 112;
  const cardBottom = nCharts ? cardTop + nCharts * CARD_H + (nCharts - 1) * CARD_GAP : 0;
  const showLegend = S.mono && days.some((d) => d.private > 0);
  const footTop = Math.ceil(yEdge(PAD + 380) + 24);
  const footBottom = footTop + (showLegend ? 16 : 0) + 16;
  const height = Math.max(cityBottom, footBottom, cardBottom) + PAD;

  const P = (gx, gy, z = 0) => [ox + (gx - gy) * A, oy + ((gx + gy) * A) / 2 - z];
  const pts = (...ps) => ps.map(([a, b]) => `${r1(a)},${r1(b)}`).join(' ');
  const poly = (fill, ...ps) => `<polygon points="${pts(...ps)}" fill="${fill}"/>`;

  // ---------- defs ----------
  const defs = [];
  defs.push(`<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.skyTop}"/><stop offset="1" stop-color="${T.skyBottom}"/></linearGradient>`);
  defs.push(`<radialGradient id="glow"><stop offset="0" stop-color="${T.lamp}" stop-opacity=".9"/><stop offset="1" stop-color="${T.lamp}" stop-opacity="0"/></radialGradient>`);
  defs.push(`<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6c8" stop-opacity=".9"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></linearGradient>`);

  // Window patterns live in "face space": x in tile units, y in px (see face()).
  const fw = 1 - 2 * MARGIN;
  const winPatterns = [];
  for (let v = 0; v < 3; v++) {
    const pr = rng(`win-${v}-${theme}`);
    const cols = 4;
    const rows = 4;
    const cw = fw / cols;
    let cells = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const on = night && pr() < 0.62;
        const col = on ? pr.pick(lit) : unlit;
        if (on) cells += `<rect x="${r3(c * cw + cw * 0.05)}" y="${r * 6 + 0.8}" width="${r3(cw * 0.9)}" height="5.4" fill="${col}" opacity=".28"/>`;
        cells += `<rect x="${r3(c * cw + cw * 0.17)}" y="${r * 6 + 1.6}" width="${r3(cw * 0.66)}" height="3.8" fill="${col}"${on ? '' : ' opacity=".85"'}/>`;
      }
    }
    defs.push(`<pattern id="w${v}" patternUnits="userSpaceOnUse" width="${r3(fw)}" height="24">${cells}</pattern>`);
    winPatterns.push(`w${v}`);
  }
  // glass curtain wall (skyscrapers)
  defs.push(`<pattern id="glass" patternUnits="userSpaceOnUse" width="0.095" height="5"><rect width="0.095" height="5" fill="#ffffff" opacity="0"/><rect x="0.085" width="0.01" height="5" fill="#ffffff" opacity=".28"/><rect y="4.4" width="0.095" height=".6" fill="#ffffff" opacity=".22"/>${T.night ? '<rect x="0.02" y="1" width="0.05" height="2.6" fill="#9be7ff" opacity=".35"/>' : ''}</pattern>`);

  // ---------- primitives ----------
  // A vertical face drawn as a rect in its own (u,v) space so patterns follow the wall.
  function face(side, x0, y0, x1, y1, ztop, h, fill, pattern) {
    let m;
    let w;
    if (side === 'left') {
      // wall at y = y1, u runs along +x
      const [ex, ey] = P(x0, y1, ztop);
      m = `matrix(${A} ${A / 2} 0 1 ${r1(ex)} ${r1(ey)})`;
      w = x1 - x0;
    } else {
      // wall at x = x1, u runs along +y
      const [ex, ey] = P(x1, y0, ztop);
      m = `matrix(${-A} ${A / 2} 0 1 ${r1(ex)} ${r1(ey)})`;
      w = y1 - y0;
    }
    const W = Math.round(w * 1000) / 1000;
    const H = r1(h);
    return `<g transform="${m}"><rect width="${W}" height="${H}" fill="${fill}"/>${pattern ? `<rect width="${W}" height="${H}" fill="url(#${pattern})"/>` : ''}</g>`;
  }

  function box(x0, y0, x1, y1, z0, h, color, opts = {}) {
    const zt = z0 + h;
    const top = opts.top ?? shade(color, 0.12);
    const left = opts.left ?? color;
    const right = opts.right ?? shade(color, -0.18);
    if (opts.simple) {
      return (
        poly(left, P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, zt), P(x0, y1, zt)) +
        poly(right, P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, zt), P(x1, y1, zt)) +
        poly(top, P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt))
      );
    }
    return (
      face('left', x0, y0, x1, y1, zt, h, left, opts.pattern) +
      face('right', x0, y0, x1, y1, zt, h, right, opts.pattern) +
      poly(top, P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt))
    );
  }

  function tree(gx, gy, r, date = today) {
    const [sx, sy] = P(gx, gy);
    const c = seasonTree(date, r);
    const s = r.range(0.85, 1.25);
    if (r() < 0.4) {
      // conifer
      return `<rect x="${r1(sx - 0.7)}" y="${r1(sy - 3)}" width="1.4" height="3" fill="${T.trunk}"/>` +
        `<polygon points="${pts([sx - 3.6 * s, sy - 2.5], [sx + 3.6 * s, sy - 2.5], [sx, sy - 13 * s])}" fill="${c}"/>` +
        `<polygon points="${pts([sx, sy - 13 * s], [sx + 3.6 * s, sy - 2.5], [sx, sy - 2.5])}" fill="${shade(c, -0.2)}"/>`;
    }
    return `<rect x="${r1(sx - 0.7)}" y="${r1(sy - 4)}" width="1.4" height="4" fill="${T.trunk}"/>` +
      `<circle cx="${r1(sx)}" cy="${r1(sy - 7 * s)}" r="${r1(4 * s)}" fill="${c}"/>` +
      `<circle cx="${r1(sx - 1.2 * s)}" cy="${r1(sy - 8.2 * s)}" r="${r1(1.8 * s)}" fill="${shade(c, 0.18)}"/>`;
  }

  // ---------- buildings ----------
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const heightOf = (c) => 5 + (MAX_H - 5) * Math.pow(c / maxCount, 0.62);

  function minimalBuilding(gx, gy, day) {
    const x0 = gx + MARGIN, y0 = gy + MARGIN, x1 = gx + 1 - MARGIN, y1 = gy + 1 - MARGIN;
    const lvl = Math.max(1, Math.min(4, day.level || 1));
    if (day.count === 0) {
      let out = '';
      if (T.park === 'OUTLINE') out += `<polygon points="${pts(P(x0, y0, 1.5), P(x1, y0, 1.5), P(x1, y1, 1.5), P(x0, y1, 1.5))}" fill="none" stroke="${T.ink}" stroke-width=".6" opacity=".35"/>`;
      else if (T.park) out += poly(T.park, P(x0, y0, 1.5), P(x1, y0, 1.5), P(x1, y1, 1.5), P(x0, y1, 1.5));
      if (S.trees === 'round' && rng(day.date)() < 0.45) {
        const [sx, sy] = P(gx + 0.5, gy + 0.5, 1.5);
        out += `<ellipse cx="${r1(sx)}" cy="${r1(sy)}" rx="3.5" ry="1.6" fill="#000" opacity=".08"/><circle cx="${r1(sx)}" cy="${r1(sy - 4.5)}" r="4" fill="${T.treeColor}"/>`;
      }
      return out;
    }
    const h = heightOf(day.count);
    const zt = h;
    const faces = (top, left, right, stroke) => {
      const st = stroke ? ` stroke="${stroke}" stroke-width=".8" stroke-linejoin="round"` : '';
      const pg = (f, ...ps) => `<polygon points="${pts(...ps)}" fill="${f}"${st}/>`;
      return pg(left, P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, zt), P(x0, y1, zt)) +
        pg(right, P(x1, y1, 0), P(x1, y0, 0), P(x1, y0, zt), P(x1, y1, zt)) +
        pg(top, P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt));
    };
    if (S.kind === 'line') {
      const top = lvl === 4 ? mix(T.fill, accent, 0.35) : shade(T.fill, T.night ? 0.04 : 0.02);
      return faces(top, T.fill, mix(T.fill, T.ink, 0.08), T.ink);
    }
    if (S.kind === 'glow') {
      const t = [0.25, 0.5, 0.75, 1][lvl - 1];
      const top = mix(T.face, accent, t);
      let out = faces(top, T.face, shade(T.face, T.night ? -0.25 : -0.06));
      if (lvl === 4 && T.night) {
        const [sx, sy] = P(gx + 0.5, gy + 0.5, zt);
        out += `<ellipse cx="${r1(sx)}" cy="${r1(sy)}" rx="9" ry="4.5" fill="${accent}" opacity=".25"><animate attributeName="opacity" values=".1;.35;.1" dur="${r1(rng(day.date).range(2.5, 4))}s" repeatCount="indefinite"/></ellipse>`;
      }
      return out;
    }
    const base = T.ramp[lvl - 1];
    return faces(shade(base, 0.12), base, shade(base, -0.14));
  }

  // Single-colour mode: the taller the building, the more intense the colour.
  function mono(h) {
    if (!S.mono) return null;
    const t = Math.max(0, Math.min(1, (h - 5) / (MAX_H - 5)));
    return tone(mix(T.night ? '#262c34' : '#eef0f3', accent, 0.14 + 0.86 * Math.pow(t, 0.7)));
  }
  function monoPriv(h) {
    const t = Math.max(0, Math.min(1, (h - 5) / (MAX_H - 5)));
    return tone(mix(T.night ? '#262c34' : '#eef0f3', privateColor, 0.14 + 0.86 * Math.pow(t, 0.7)));
  }
  const hasPrivate = S.mono && days.some((d) => d.private > 0);

  // ---------- seasons ----------
  const SEASONS = {
    winter: { trees: ['#eef3f8', '#e2e9f1', '#f6f9fc'], grass: '#f2f6fa', dark: { trees: ['#6b7688', '#5f6a7c', '#7a8597'], grass: '#3a4250' } },
    spring: { trees: ['#f5b8cb', '#a9d99f', '#f8d2de', '#bfe3a8'], grass: '#d3ebc8', dark: { trees: ['#a0657a', '#4f7a52', '#8f5a6e'], grass: '#26352a' } },
    summer: { trees: ['#5fae5a', '#4c9c4f', '#79c06f'], grass: '#c3e2b4', dark: { trees: ['#2f6b3c', '#295f35', '#3a7a47'], grass: '#1e3326' } },
    autumn: { trees: ['#e08a3c', '#d4632f', '#e9b44c', '#c9772e'], grass: '#eadfc4', dark: { trees: ['#8a4d22', '#7a3a1d', '#8f6a26'], grass: '#352b1f' } },
  };
  const seasonOf = (date) => {
    let m = Number(date.slice(5, 7));
    if (hemisphere === 'south') m = ((m + 5) % 12) + 1;
    return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
  };
  const seasonAmt = S.mono ? 0.6 : 0.85;
  const seasonTree = (date, r) => {
    const base = r.pick(T.trees);
    if (!seasons || !date) return base;
    const se = SEASONS[seasonOf(date)];
    return tone(mix(base, r.pick(T.night ? se.dark.trees : se.trees), seasonAmt));
  };
  const seasonGrass = (date, base) => {
    if (!seasons || !date) return base;
    const se = SEASONS[seasonOf(date)];
    return tone(mix(base, T.night ? se.dark.grass : se.grass, seasonAmt * 0.8));
  };

  // ---------- events ----------
  const evList = (events || []).filter((e) => e && e.from).map((e) => ({ ...e, to: e.to || e.from }));
  const eventOf = (date) => evList.find((e) => date >= e.from && date <= e.to);

  function building(gx, gy, day) {
    if (S.kind !== 'classic') return minimalBuilding(gx, gy, day);
    const r = rng(day.date);
    const x0 = gx + MARGIN;
    const y0 = gy + MARGIN;
    const x1 = gx + 1 - MARGIN;
    const y1 = gy + 1 - MARGIN;
    const cx = gx + 0.5;
    const cy = gy + 0.5;
    let out = '';

    if (day.count === 0) {
      out += poly(seasonGrass(day.date, r() < 0.5 ? T.grass : T.grassDark), P(x0, y0, 1.5), P(x1, y0, 1.5), P(x1, y1, 1.5), P(x0, y1, 1.5));
      const roll = r();
      if (roll < 0.62) {
        const n = 1 + Math.floor(r() * 3);
        const spots = [[0.3, 0.3], [0.7, 0.35], [0.35, 0.72], [0.72, 0.7]].sort(() => r() - 0.5).slice(0, n);
        spots.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
        for (const [u, v] of spots) out += tree(gx + u, gy + v, r, day.date);
      } else if (roll < 0.72) {
        // tiny pond
        const [sx, sy] = P(cx, cy, 1.5);
        out += `<ellipse cx="${r1(sx)}" cy="${r1(sy)}" rx="5.5" ry="2.7" fill="${T.pond ?? (T.night ? '#24476b' : '#7cc7ef')}"/>`;
      }
      return out;
    }

    const h = heightOf(day.count);
    const lvl = day.level || 1;
    // public/private split: public floors at the bottom, private floors on top
    const pubShare = S.mono && day.private > 0 ? Math.max(0, Math.min(1, (day.count - day.private) / day.count)) : 1;
    const cPub = mono(h);
    const cPriv = S.mono ? monoPriv(h) : null;
    const topCol = pubShare < 1 ? cPriv : cPub;
    const body = (bx0, by0, bx1, by1, z0, hh, opts, adj = 0, Htop = h) => {
      if (!S.mono || pubShare >= 1) return box(bx0, by0, bx1, by1, z0, hh, shade(cPub ?? opts.col, adj), opts);
      const zs = Htop * pubShare;
      let o = '';
      const a0 = z0, a1 = Math.min(z0 + hh, zs);
      if (a1 - a0 > 0.4) o += box(bx0, by0, bx1, by1, a0, a1 - a0, shade(cPub, adj), opts);
      const b0 = Math.max(z0, zs), b1 = z0 + hh;
      if (b1 - b0 > 0.4) o += box(bx0, by0, bx1, by1, b0, b1 - b0, shade(cPriv, adj), opts);
      return o;
    };
    if (lvl === 1 || h < 12) {
      // house with hip roof
      const col = mono(h) ?? r.pick(T.houses);
      const hh = Math.min(h, 9) + 3;
      let roof = S.mono ? shade(topCol, T.night ? 0.15 : -0.15) : r.pick(T.roofs);
      if (seasons && seasonOf(day.date) === 'winter') roof = mix(roof, T.night ? '#8d97a8' : '#ffffff', 0.6); // snow
      out += body(x0 + 0.06, y0 + 0.06, x1 - 0.06, y1 - 0.06, 0, hh, { col, pattern: night ? r.pick(winPatterns) : null }, 0, hh);
      const a = [cx, cy, hh + 6];
      const e = 0.04;
      const c00 = P(x0 + e, y0 + e, hh), c10 = P(x1 - e, y0 + e, hh), c11 = P(x1 - e, y1 - e, hh), c01 = P(x0 + e, y1 - e, hh);
      const ap = P(...a);
      out += poly(shade(roof, -0.1), c00, c10, ap) + poly(shade(roof, -0.1), c00, c01, ap);
      out += poly(roof, c01, c11, ap) + poly(shade(roof, -0.25), c11, c10, ap);
      return out;
    }
    if (lvl === 2 || h < 30) {
      const col = mono(h) ?? r.pick(T.blocks);
      out += body(x0, y0, x1, y1, 0, h, { col, pattern: r.pick(winPatterns) });
      // rooftop details
      if (r() < 0.6) out += box(cx - 0.12, cy - 0.1, cx + 0.12, cy + 0.12, h, 3, shade(topCol ?? col, -0.25), { simple: true });
      else out += box(x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, h, 1.2, T.roofGarden ?? (T.night ? '#2f7a55' : '#7fcf73'), { simple: true });
      return out;
    }
    if (lvl === 3) {
      const col = mono(h) ?? r.pick(T.towers);
      const h1 = h * 0.72;
      out += body(x0, y0, x1, y1, 0, h1, { col, pattern: r.pick(winPatterns) });
      out += body(x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, h1, h - h1, { col: shade(col, 0.06), pattern: r.pick(winPatterns) }, 0.06);
      return out;
    }
    // level 4: skyscraper with accent crown and blinking beacon
    const col = mono(h) ?? r.pick(T.glass);
    out += body(x0, y0, x1, y1, 0, h, { col, pattern: night ? r.pick(winPatterns) : 'glass' });
    out += box(x0, y0, x1, y1, h, 2.5, pubShare < 1 ? privateColor : accent, { simple: true, top: shade(topCol ?? col, 0.2) });
    out += box(x0 + 0.16, y0 + 0.16, x1 - 0.16, y1 - 0.16, h + 2.5, 4, shade(topCol ?? col, 0.1), { simple: true });
    const [ax, ay] = P(cx, cy, h + 6.5);
    out += `<line x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(ax)}" y2="${r1(ay - 11)}" stroke="${shade(col, -0.3)}" stroke-width="1"/>`;
    out += `<circle cx="${r1(ax)}" cy="${r1(ay - 11)}" r="1.6" fill="#ff3b3b"><animate attributeName="opacity" values="1;.15;1" dur="${r1(r.range(1.6, 2.6))}s" repeatCount="indefinite"/></circle>`;
    return out;
  }


  // Today's lot: the building rises floor by floor inside its scaffolding, with a crane.
  function construction(gx, gy, day) {
    const d = day.count ? day : { ...day, count: Math.max(1, Math.round(maxCount * 0.15)), level: 2 };
    const h = heightOf(d.count) + (d.level === 4 ? 8 : 0);
    const inner = building(gx, gy, d);
    const left = P(gx, gy + 1)[0] - 2;
    const right = P(gx + 1, gy)[0] + 2;
    const bottom = P(gx + 1, gy + 1)[1] + 2;
    const top = P(gx, gy)[1] - h - 24;
    const full = bottom - top;
    const dur = 8;
    let o = `<clipPath id="cc-grow"><rect x="${r1(left)}" y="${r1(bottom)}" width="${r1(right - left)}" height="0">` +
      `<animate attributeName="y" values="${r1(bottom)};${r1(top)};${r1(top)};${r1(bottom)}" keyTimes="0;.7;.94;1" dur="${dur}s" repeatCount="indefinite"/>` +
      `<animate attributeName="height" values="0;${r1(full)};${r1(full)};0" keyTimes="0;.7;.94;1" dur="${dur}s" repeatCount="indefinite"/></rect></clipPath>`;
    // dashed foundation
    const m = MARGIN - 0.04;
    o += `<polygon points="${pts(P(gx + m, gy + m, 1.6), P(gx + 1 - m, gy + m, 1.6), P(gx + 1 - m, gy + 1 - m, 1.6), P(gx + m, gy + 1 - m, 1.6))}" fill="none" stroke="${T.craneColor}" stroke-width=".8" stroke-dasharray="2 2"/>`;
    o += `<g clip-path="url(#cc-grow)">${inner}</g>`;
    // scaffolding: wireframe of the final volume
    const x0 = gx + m, y0 = gy + m, x1 = gx + 1 - m, y1 = gy + 1 - m;
    const ln = (a, b) => `<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}"/>`;
    let sc = '';
    for (const [px, py] of [[x0, y1], [x1, y1], [x1, y0]]) sc += ln(P(px, py, 0), P(px, py, h));
    for (let z = 8; z <= h; z += 8) sc += ln(P(x0, y1, z), P(x1, y1, z)) + ln(P(x1, y1, z), P(x1, y0, z));
    sc += ln(P(x0, y1, h), P(x1, y1, h)) + ln(P(x1, y1, h), P(x1, y0, h)) + ln(P(x0, y0, h), P(x1, y0, h)) + ln(P(x0, y0, h), P(x0, y1, h));
    o += `<g stroke="${T.craneColor}" stroke-width=".9" opacity=".9">${sc}</g>`;
    o += crane(gx, gy, h);
    return o;
  }

  function crane(gx, gy, baseH) {
    const [mx, my] = P(gx + 0.15, gy + 0.85);
    const top = my - Math.max(baseH + 26, 42);
    const c = T.craneColor;
    const jibL = 30;
    let s = `<g stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round">`;
    s += `<line x1="${r1(mx)}" y1="${r1(my)}" x2="${r1(mx)}" y2="${r1(top)}"/>`;
    s += `<line x1="${r1(mx - 2)}" y1="${r1(my)}" x2="${r1(mx - 2)}" y2="${r1(top)}"/>`;
    for (let yy = my - 6; yy > top + 4; yy -= 6) s += `<line x1="${r1(mx - 2)}" y1="${r1(yy)}" x2="${r1(mx)}" y2="${r1(yy - 6)}" stroke-width=".7"/>`;
    s += `<line x1="${r1(mx - 12)}" y1="${r1(top)}" x2="${r1(mx + jibL)}" y2="${r1(top)}"/>`;
    s += `<line x1="${r1(mx - 1)}" y1="${r1(top - 6)}" x2="${r1(mx + jibL)}" y2="${r1(top)}" stroke-width=".7"/>`;
    s += `<line x1="${r1(mx - 1)}" y1="${r1(top - 6)}" x2="${r1(mx - 12)}" y2="${r1(top)}" stroke-width=".7"/></g>`;
    s += `<rect x="${r1(mx - 14)}" y="${r1(top)}" width="6" height="5" fill="${shade(c, -0.35)}"/>`;
    s += `<rect x="${r1(mx - 4.5)}" y="${r1(top + 1)}" width="5" height="4.5" fill="${c}"/>`; // cabin
    s += `<circle cx="${r1(mx - 1)}" cy="${r1(top - 7.5)}" r="1.8" fill="${c}"><animate attributeName="opacity" values="1;.2;1" dur="1.1s" repeatCount="indefinite"/></circle>`;
    // "today" tag
    const tagY = top - 22;
    s += `<g font-family="${FONT}"><rect x="${r1(mx - 18)}" y="${r1(tagY)}" width="36" height="13" rx="6.5" fill="${c}"/>` +
      `<text x="${r1(mx)}" y="${r1(tagY + 9.4)}" font-size="8.5" font-weight="700" text-anchor="middle" fill="${T.night ? '#0d1117' : '#ffffff'}">TODAY</text>` +
      `<line x1="${r1(mx)}" y1="${r1(tagY + 13)}" x2="${r1(mx - 1)}" y2="${r1(top - 9.5)}" stroke="${c}" stroke-width=".8"/></g>`;
    // trolley + hook moving along the jib
    s += `<g><animateTransform attributeName="transform" type="translate" values="0 0;18 0;18 0;0 0;0 0" keyTimes="0;.35;.5;.85;1" dur="9s" repeatCount="indefinite"/>`;
    s += `<line x1="${r1(mx + 8)}" y1="${r1(top)}" x2="${r1(mx + 8)}" y2="${r1(top + 14)}" stroke="${c}" stroke-width=".8"><animate attributeName="y2" values="${r1(top + 14)};${r1(top + 24)};${r1(top + 14)}" dur="9s" repeatCount="indefinite"/></line>`;
    s += `<rect x="${r1(mx + 6.5)}" y="${r1(top + 14)}" width="3.4" height="3.4" fill="${shade(c, -0.3)}"><animate attributeName="y" values="${r1(top + 14)};${r1(top + 24)};${r1(top + 14)}" dur="9s" repeatCount="indefinite"/></rect></g>`;
    return s;
  }

  // ---------- autonomous car ----------
  // Route: serpentine through every avenue, then back along the outer boulevard.
  const route = [];
  const push = (gx, gy) => {
    const last = route[route.length - 1];
    if (!last || last[0] !== gx || last[1] !== gy) route.push([gx, gy]);
  };
  roadCols.forEach((rc, k) => {
    const down = k % 2 === 0;
    for (let i = 0; i < NY; i++) push(rc, down ? i : NY - 1 - i);
    const next = roadCols[k + 1];
    const yRow = down ? NY - 1 : 0;
    if (next !== undefined) for (let gx = rc + 1; gx < next; gx++) push(gx, yRow);
  });
  const endY = route[route.length - 1][1];
  for (let gx = roadCols[roadCols.length - 1] - 1; gx > 0; gx--) push(gx, endY);
  if (endY !== 0) for (let gy = NY - 1; gy > 0; gy--) push(0, gy);
  const N = route.length;
  // the car stops for a while next to each event
  const dwell = new Array(N).fill(0);
  const STOP = Math.round(4.5 / secondsPerCell); // ~4.5 s parked at each event
  for (const ev of evList) {
    const lot = cells.find((c) => c.day.date >= ev.from && c.day.date <= ev.to);
    if (!lot) continue;
    let best = 0;
    let bd = Infinity;
    route.forEach(([rx, ry], i) => {
      const dd = Math.abs(rx - lot.gx) + Math.abs(ry - lot.gy);
      if (dd < bd) { bd = dd; best = i; }
    });
    dwell[best] = STOP;
    ev.stopAt = best;
  }
  const arr = [];
  let U = 0;
  for (let i = 0; i < N; i++) { arr.push(U); U += dwell[i] + 1; }
  const dur = r1(U * secondsPerCell);
  const LANE = 0.17;

  const dirOf = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx > 0) return 'px';
    if (dx < 0) return 'nx';
    return dy > 0 ? 'py' : 'ny';
  };
  const normal = { px: [0, -1], nx: [0, 1], py: [1, 0], ny: [-1, 0] }; // keeps the car on its own lane
  const pieces = [];
  const off = (dir) => normal[dir];
  for (let i = 0; i < N; i++) {
    const a = route[i];
    const pa = route[(i - 1 + N) % N];
    const b = route[(i + 1) % N];
    const dIn = dirOf(pa, a);
    const d = dirOf(a, b);
    const nIn = off(dIn);
    const nOut = off(d);
    const entry = [(pa[0] + a[0]) / 2 + 0.5 + LANE * nIn[0], (pa[1] + a[1]) / 2 + 0.5 + LANE * nIn[1]];
    const nc = dIn === d ? nOut : [nIn[0] + nOut[0], nIn[1] + nOut[1]];
    const center = [a[0] + 0.5 + LANE * nc[0], a[1] + 0.5 + LANE * nc[1]];
    const exit = [(a[0] + b[0]) / 2 + 0.5 + LANE * nOut[0], (a[1] + b[1]) / 2 + 0.5 + LANE * nOut[1]];
    const t = arr[i] / U;
    const h = 0.5 / U;
    const w = dwell[i] / U;
    pieces.push(i === 0
      ? { cell: a, dir: dIn, from: entry, to: center, t0: 1 - h, t1: 1 }
      : { cell: a, dir: dIn, from: entry, to: center, t0: t - h, t1: t });
    if (w) pieces.push({ cell: a, dir: dIn, from: center, to: center, t0: t, t1: t + w, stop: true });
    pieces.push({ cell: a, dir: d, from: center, to: exit, t0: t + w, t1: t + w + h });
  }
  pieces.sort((p, q) => p.t0 - q.t0);
  // Merge consecutive halves in the same cell with the same heading.
  const merged = [];
  for (const p of pieces) {
    const q = merged[merged.length - 1];
    if (q && !q.stop && !p.stop && q.cell === p.cell && q.dir === p.dir && Math.abs(q.t1 - p.t0) < 1e-9) {
      q.to = p.to;
      q.t1 = p.t1;
    } else merged.push({ ...p });
  }

  // car sprites, one per heading (drawn around the ground point 0,0)
  const carDefs = [];
  const Q = (gx, gy, z = 0) => [(gx - gy) * A, ((gx + gy) * A) / 2 - z];
  const qp = (fill, ...ps) => `<polygon points="${ps.map(([a, b]) => `${r1(a)},${r1(b)}`).join(' ')}" fill="${fill}"/>`;
  function qbox(x0, y0, x1, y1, z0, h, top, left, right) {
    const zt = z0 + h;
    return qp(left, Q(x0, y1, z0), Q(x1, y1, z0), Q(x1, y1, zt), Q(x0, y1, zt)) +
      qp(right, Q(x1, y1, z0), Q(x1, y0, z0), Q(x1, y0, zt), Q(x1, y1, zt)) +
      qp(top, Q(x0, y0, zt), Q(x1, y0, zt), Q(x1, y1, zt), Q(x0, y1, zt));
  }
  for (const d of ['px', 'nx', 'py', 'ny']) {
    const along = d === 'px' || d === 'nx';
    const L = 0.3;
    const W = 0.16;
    const [hx, hy] = along ? [L, W] : [W, L];
    const fwd = { px: [1, 0], nx: [-1, 0], py: [0, 1], ny: [0, -1] }[d];
    let s = '';
    // lidar pulse on the ground
    s += `<ellipse cx="0" cy="0" rx="2" ry="1" fill="none" stroke="${accent}" stroke-width="1.6"><animate attributeName="rx" values="3;28" dur="1.4s" repeatCount="indefinite"/><animate attributeName="ry" values="1.5;13" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0" dur="1.4s" repeatCount="indefinite"/></ellipse>`;
    if (beamOpacity) {
      const f0 = [fwd[0] * hx, fwd[1] * hy];
      const side = along ? [0, 1] : [1, 0];
      const pA = Q(f0[0] - side[0] * 0.1, f0[1] - side[1] * 0.1, 1.5);
      const pB = Q(f0[0] + side[0] * 0.1, f0[1] + side[1] * 0.1, 1.5);
      const pC = Q(f0[0] + fwd[0] * 0.75 + side[0] * 0.28, f0[1] + fwd[1] * 0.75 + side[1] * 0.28, 0);
      const pD = Q(f0[0] + fwd[0] * 0.75 - side[0] * 0.28, f0[1] + fwd[1] * 0.75 - side[1] * 0.28, 0);
      s += `<polygon points="${[pA, pB, pC, pD].map(([a, b]) => `${r1(a)},${r1(b)}`).join(' ')}" fill="#fff3b0" opacity="${beamOpacity}"/>`;
    }
    // shadow
    s += `<ellipse cx="0" cy="1" rx="7" ry="3.2" fill="#000" opacity=".25"/>`;
    // body + cabin
    s += qbox(-hx, -hy, hx, hy, 1, 4.2, T.car, shade(T.carSide, 0), shade(T.carSide, -0.15));
    // accent stripe
    s += qbox(-hx - 0.001, -hy - 0.001, hx + 0.001, hy + 0.001, 2.6, 1.1, T.car, accent, shade(accent, -0.2));
    const ix = along ? 0.06 : 0.015;
    const iy = along ? 0.015 : 0.06;
    const shiftX = along ? -fwd[0] * 0.03 : 0;
    const shiftY = along ? 0 : -fwd[1] * 0.03;
    s += qbox(-hx + ix + shiftX, -hy + iy + shiftY, hx - ix + shiftX, hy - iy + shiftY, 5.2, 3.2, shade(T.car, -0.05), T.carGlass, shade(T.carGlass, -0.2));
    // lidar puck
    s += `<ellipse cx="0" cy="-8.4" rx="2" ry="1" fill="${shade(T.puck || '#2c3040', -0.2)}"/><rect x="-2" y="-10.6" width="4" height="2.2" fill="${T.puck || '#2c3040'}"/><ellipse cx="0" cy="-10.6" rx="2" ry="1" fill="${accent}"><animate attributeName="opacity" values="1;.4;1" dur=".6s" repeatCount="indefinite"/></ellipse>`;
    // lights on the visible faces: x-max face (+x) and y-max face (+y)
    const lightOn = (faceDir, color) => {
      if (faceDir === 'x') {
        const a1 = Q(hx, -hy * 0.7, 3.4), a2 = Q(hx, -hy * 0.25, 3.4), b1 = Q(hx, hy * 0.25, 3.4), b2 = Q(hx, hy * 0.7, 3.4);
        return [a1, a2, b1, b2];
      }
      const a1 = Q(-hx * 0.7, hy, 3.4), a2 = Q(-hx * 0.25, hy, 3.4), b1 = Q(hx * 0.25, hy, 3.4), b2 = Q(hx * 0.7, hy, 3.4);
      return [a1, a2, b1, b2];
    };
    const lightFace = along ? 'x' : 'y';
    const isFront = d === 'px' || d === 'py';
    const lc = isFront ? '#fff6c8' : '#ff4040';
    const [l1, l2, l3, l4] = lightOn(lightFace, lc);
    s += `<g stroke="${lc}" stroke-width="1.5" stroke-linecap="round"><line x1="${r1(l1[0])}" y1="${r1(l1[1])}" x2="${r1(l2[0])}" y2="${r1(l2[1])}"/><line x1="${r1(l3[0])}" y1="${r1(l3[1])}" x2="${r1(l4[0])}" y2="${r1(l4[1])}"/></g>`;
    carDefs.push(`<g id="car-${d}">${s}</g>`);
  }
  defs.push(...carDefs);

  const kt = (t) => Math.round(t * 1e5) / 1e5;
  const carPiece = (p) => {
    const [x0s, y0s] = P(p.from[0], p.from[1]);
    const [x1s, y1s] = P(p.to[0], p.to[1]);
    const t0 = kt(p.t0);
    const t1 = kt(p.t1);
    const vis = t0 === 0 ? `values="1;0" keyTimes="0;${t1}"` : t1 >= 1 ? `values="0;1" keyTimes="0;${t0}"` : `values="0;1;0" keyTimes="0;${t0};${t1}"`;
    const a = `${r1(x0s)} ${r1(y0s)}`;
    const b = `${r1(x1s)} ${r1(y1s)}`;
    const tr = t0 === 0 ? `values="${a};${b};${b}" keyTimes="0;${t1};1"` : t1 >= 1 ? `values="${a};${a};${b}" keyTimes="0;${t0};1"` : `values="${a};${a};${b};${b}" keyTimes="0;${t0};${t1};1"`;
    return `<use href="#car-${p.dir}" opacity="0"><animate attributeName="opacity" ${vis} calcMode="discrete" dur="${dur}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" ${tr} dur="${dur}s" repeatCount="indefinite"/></use>`;
  };

  // ---------- assemble drawables in painter's order ----------
  const items = []; // {d: depth, o: tiebreak, s: svg}
  for (const [px0, py0, px1, py1] of S.trees ? parks : []) {
    const pr = rng(`park-${px0}-${py0}`);
    for (let gx = px0; gx < px1; gx++) {
      for (let gy = py0; gy < py1; gy++) {
        if (pr() < 0.45) items.push({ d: gx + gy, o: gx, s: tree(gx + pr.range(0.25, 0.75), gy + pr.range(0.25, 0.75), pr, today) });
      }
    }
  }
  const pins = [];
  const evFirst = new Set();
  for (const ev of evList) {
    const c = cells.find((cc) => cc.day.date >= ev.from && cc.day.date <= ev.to);
    if (c) evFirst.add(c.day.date);
  }
  for (const { gx, gy, day } of cells) {
    const ev = eventOf(day.date);
    if (!ev || !evFirst.has(day.date)) continue;
    const inRange = cells.filter((cc) => cc.day.date >= ev.from && cc.day.date <= ev.to);
    const top = Math.max(...inRange.map((cc) => (cc.day.count ? heightOf(cc.day.count) : 0))) + 14;
    // thumbtack stuck in the lot; its label shows while the car is parked next to it
    // (and on hover when the SVG is opened directly; GitHub serves READMEs images without hover)
    const [gxp, gyp] = P(gx + 0.5, gy + 0.5, 1.6);
    const [px, py] = P(gx + 0.5, gy + 0.5, top);
    const label = esc(ev.label || 'event');
    const dates = ev.from === ev.to ? ev.from : `${ev.from} → ${ev.to}`;
    const lw = Math.max(16 + label.length * 6.9, 16 + dates.length * 5.5);
    const ly = py - 54;
    const head = `<line x1="${r1(gxp)}" y1="${r1(gyp)}" x2="${r1(px)}" y2="${r1(py - 6)}" stroke="${T.night ? '#c9d1d9' : '#6b7280'}" stroke-width="1"/>` +
      `<ellipse cx="${r1(gxp)}" cy="${r1(gyp)}" rx="2.5" ry="1.2" fill="#000" opacity=".25"/>` +
      `<path d="M${r1(px - 3)},${r1(py - 6)} L${r1(px + 3)},${r1(py - 6)} L${r1(px + 4.5)},${r1(py - 12)} L${r1(px - 4.5)},${r1(py - 12)} Z" fill="${shade(eventColor, -0.25)}"/>` +
      `<ellipse cx="${r1(px)}" cy="${r1(py - 15)}" rx="7" ry="4.5" fill="${eventColor}"/><ellipse cx="${r1(px)}" cy="${r1(py - 17)}" rx="7" ry="4.5" fill="${shade(eventColor, 0.15)}"/>` +
      `<ellipse cx="${r1(px - 2.5)}" cy="${r1(py - 18.5)}" rx="2" ry="1.1" fill="#fff" opacity=".7"/>`;
    const card = `<rect x="${r1(px - lw / 2)}" y="${r1(ly)}" width="${r1(lw)}" height="32" rx="7" fill="${T.chipBg}" stroke="${eventColor}" stroke-width="1.4"/>` +
      `<text x="${r1(px)}" y="${r1(ly + 13.5)}" font-size="11.5" font-weight="700" text-anchor="middle" fill="${T.text}">${label}</text>` +
      `<text x="${r1(px)}" y="${r1(ly + 26)}" font-size="9" text-anchor="middle" fill="${T.subtext}">${dates}</text>`;
    let show = '';
    if (ev.stopAt !== undefined) {
      const t0 = arr[ev.stopAt] / U;
      const t1 = (arr[ev.stopAt] + dwell[ev.stopAt]) / U;
      const e = 0.4 / U;
      const k = [0, Math.max(0, t0 - e), t0, t1, Math.min(1, t1 + e), 1].map(kt);
      show = `<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="${k.join(';')}" dur="${dur}s" repeatCount="indefinite"/>`;
    }
    const pin = `<g class="cc-pin" font-family="${FONT}"><title>${label} (${dates})</title>${head}` +
      `<g opacity="0">${show}${card}</g><g class="cc-hover">${card}</g></g>`;
    pins.push(pin);
  }
  for (const { gx, gy, day } of cells) {
    const s = day.date === today && S.crane ? construction(gx, gy, day) : building(gx, gy, day);
    items.push({ d: gx + gy, o: gx, s });
  }
  // street lamps at intersections (corner of the cell, away from the lanes)
  for (const rc of S.lamps || night ? roadCols : []) {
    for (const gy of roadRows) {
      const lx = rc + 0.06;
      const ly = gy + (gy === 0 ? 0.06 : 0.94);
      const [sx, sy] = P(lx, ly);
      const pole = T.night ? '#59607a' : '#9aa1ad';
      let s = '';
      if (lampGlow) s += `<ellipse cx="${r1(sx + 4)}" cy="${r1(sy + 1.5)}" rx="9" ry="4.5" fill="url(#glow)" opacity=".7"/>`;
      s += `<path d="M${r1(sx)},${r1(sy)} V${r1(sy - 12)} q0,-2 2,-2 h2.2" fill="none" stroke="${pole}" stroke-width="1" stroke-linecap="round"/>`;
      s += `<rect x="${r1(sx + 3)}" y="${r1(sy - 14.6)}" width="2.6" height="1.4" rx=".6" fill="${pole}"/>`;
      if (lampGlow) s += `<circle cx="${r1(sx + 4.3)}" cy="${r1(sy - 12.6)}" r="4" fill="url(#glow)"/><circle cx="${r1(sx + 4.3)}" cy="${r1(sy - 12.9)}" r=".9" fill="#fff8e0"/>`;
      items.push({ d: Math.floor(lx) + Math.floor(ly), o: lx, s });
    }
  }
  for (const p of merged) items.push({ d: p.cell[0] + p.cell[1] + 0.5, o: p.cell[0], s: carPiece(p) });
  items.sort((a, b) => a.d - b.d || a.o - b.o);

  // ---------- ground ----------
  let ground = '';
  // slab sides
  ground += poly(T.slabLeft, P(0, NY), P(NX, NY), P(NX, NY, -SLAB), P(0, NY, -SLAB));
  ground += poly(T.slabRight, P(NX, NY), P(NX, 0), P(NX, 0, -SLAB), P(NX, NY, -SLAB));
  ground += poly(T.slabGrass, P(0, NY), P(NX, NY), P(NX, NY, -3), P(0, NY, -3));
  ground += poly(shade(T.slabGrass, -0.15), P(NX, NY), P(NX, 0), P(NX, 0, -3), P(NX, NY, -3));
  ground += poly(T.road, P(0, 0), P(NX, 0), P(NX, NY), P(0, NY));
  // lane markings
  const dash = `stroke="${T.roadLine}" stroke-width="1" stroke-dasharray="4 4" fill="none" opacity=".8"`;
  for (const gy of S.lanes ? roadRows : []) {
    const [a1, b1] = P(0.5, gy + 0.5);
    const [a2, b2] = P(NX - 0.5, gy + 0.5);
    ground += `<line x1="${r1(a1)}" y1="${r1(b1)}" x2="${r1(a2)}" y2="${r1(b2)}" ${dash}/>`;
  }
  for (const rc of S.lanes ? roadCols : []) {
    const [a1, b1] = P(rc + 0.5, 0.5);
    const [a2, b2] = P(rc + 0.5, NY - 0.5);
    ground += `<line x1="${r1(a1)}" y1="${r1(b1)}" x2="${r1(a2)}" y2="${r1(b2)}" ${dash}/>`;
  }
  // blocks (raised sidewalks) + zebra crossings
  for (const [px0, py0, px1, py1] of parks) {
    ground += box(px0, py0, px1, py1, 0, 1.5, T.grass, { simple: true, left: T.curbSide, right: shade(T.curbSide, -0.12) });
  }
  for (const [bx0, by0, bx1, by1] of blocks) {
    if (bx1 <= bx0) continue;
    ground += box(bx0, by0, bx1, by1, 0, 1.5, T.curbTop, { simple: true, left: T.curbSide, right: shade(T.curbSide, -0.12) });
  }
  const zebra = (gx, gy, horizontal) => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const t = 0.2 + i * 0.17;
      const q = horizontal
        ? [P(gx + 0.05, gy + t), P(gx + 0.3, gy + t), P(gx + 0.3, gy + t + 0.08), P(gx + 0.05, gy + t + 0.08)]
        : [P(gx + t, gy + 0.05), P(gx + t + 0.08, gy + 0.05), P(gx + t + 0.08, gy + 0.3), P(gx + t, gy + 0.3)];
      s += poly(T.roadLine, ...q);
    }
    return `<g opacity=".55">${s}</g>`;
  };
  for (const rc of S.zebra ? roadCols : []) {
    for (const rr of roadRows) {
      if (rr > 0) ground += zebra(rc, rr - 1 + 0.65, false);
      if (rr < NY - 1) ground += zebra(rc, rr + 1, false);
    }
  }

  // event lots: coloured outline on the ground
  {
    let er = '';
    for (const { gx, gy, day } of cells) {
      if (!eventOf(day.date)) continue;
      const m = 0.06;
      er += `<polygon points="${pts(P(gx + m, gy + m, 1.6), P(gx + 1 - m, gy + m, 1.6), P(gx + 1 - m, gy + 1 - m, 1.6), P(gx + m, gy + 1 - m, 1.6))}"/>`;
    }
    if (er) ground += `<g fill="${eventColor}" fill-opacity=".22" stroke="${eventColor}" stroke-width="1.2">${er}</g>`;
  }

  // ---------- sun shadows (day only) ----------
  if (!night) {
    const pr = sky0.progress;
    const elev = Math.sin(Math.PI * pr);
    let vx = 1 - pr, vy = pr;
    const nrm = Math.hypot(vx, vy) || 1;
    vx /= nrm; vy /= nrm;
    const k = (0.018 + 0.05 * (1 - elev)) / 1; // ground units per px of height
    let sh = '';
    for (const { gx, gy, day } of cells) {
      if (!day.count) continue;
      const h = heightOf(day.count);
      const x0 = gx + MARGIN, y0 = gy + MARGIN, x1 = gx + 1 - MARGIN, y1 = gy + 1 - MARGIN;
      const dx = vx * h * k, dy = vy * h * k;
      sh += `<polygon points="${pts(P(x0, y0, 1.6), P(x1, y0, 1.6), P(x1 + dx, y0 + dy, 1.6), P(x1 + dx, y1 + dy, 1.6), P(x0 + dx, y1 + dy, 1.6), P(x0, y1, 1.6))}"/>`;
    }
    ground += `<g fill="${T.night ? '#000000' : '#1f2a44'}" opacity="${T.night ? 0.35 : 0.13}">${sh}</g>`;
  }

  // ---------- sky ----------
  let sky = `<rect width="${width}" height="${height}" fill="url(#sky)"/>`;
  const sr = rng(`sky-${theme}`);
  // sun or moon travelling along an arc over the top-left of the image
  const arcL = PAD + 40;
  const arcR = Math.max(arcL + 120, cityAreaW * 0.5);
  const cxS = arcL + (arcR - arcL) * sky0.progress;
  const cyS = 78 - Math.sin(Math.PI * sky0.progress) * 44;
  if (night) {
    const starCol = T.night ? '#ffffff' : '#9aa5b8';
    const nStars = S.sky ? 70 : 28;
    for (let i = 0; i < nStars; i++) {
      const sx = r1(sr() * width);
      const sy = r1(sr() * (S.sky ? height * 0.75 : 150));
      const rr = r1(sr() * 0.9 + 0.3);
      const tw = sr() < 0.35 ? `<animate attributeName="opacity" values="1;.2;1" dur="${r1(sr() * 3 + 2)}s" begin="${r1(sr() * 3)}s" repeatCount="indefinite"/>` : '';
      sky += `<circle cx="${sx}" cy="${sy}" r="${rr}" fill="${starCol}" opacity="${r1(sr() * 0.5 + (T.night ? 0.35 : 0.25))}">${tw}</circle>`;
    }
    const moon = T.night ? '#fdf3c7' : '#c3cad6';
    sky += `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="7s" repeatCount="indefinite"/>` +
      `<circle cx="${r1(cxS)}" cy="${r1(cyS)}" r="30" fill="${moon}" opacity=".12"><animate attributeName="r" values="26;36;26" dur="5s" repeatCount="indefinite"/><animate attributeName="opacity" values=".18;.06;.18" dur="5s" repeatCount="indefinite"/></circle>` +
      `<circle cx="${r1(cxS)}" cy="${r1(cyS)}" r="17" fill="${moon}"/><circle cx="${r1(cxS + 8)}" cy="${r1(cyS - 5)}" r="15" fill="${T.skyTop}"/>` +
      `<circle cx="${r1(cxS - 7)}" cy="${r1(cyS + 4)}" r="2" fill="${shade(moon, -0.12)}"/><circle cx="${r1(cxS - 3)}" cy="${r1(cyS + 10)}" r="1.3" fill="${shade(moon, -0.12)}"/></g>`;
  } else {
    sky += `<circle cx="${r1(cxS)}" cy="${r1(cyS)}" r="21" fill="#ffd250" opacity=".25"/>` +
      `<circle cx="${r1(cxS)}" cy="${r1(cyS)}" r="16" fill="#ffd250"><animate attributeName="r" values="16;17.5;16" dur="4s" repeatCount="indefinite"/></circle>` +
      `<circle cx="${r1(cxS - 5)}" cy="${r1(cyS - 5)}" r="5.5" fill="#ffeaa0" opacity=".85"/>`;
    if (S.sky) {
      for (let i = 0; i < 4; i++) {
        const cy = r1(30 + sr() * 120);
        const sc = r1(0.7 + sr() * 0.6);
        const d0 = r1(sr() * -120);
        const cc = T.night ? '#3a4170' : '#ffffff';
        sky += `<g opacity=".9"><animateTransform attributeName="transform" type="translate" values="-160 0;${width + 60} 0" dur="${r1(90 + sr() * 60)}s" begin="${d0}s" repeatCount="indefinite"/>` +
          `<g transform="translate(0 ${cy}) scale(${sc})"><ellipse cx="40" cy="10" rx="34" ry="11" fill="${cc}"/><ellipse cx="28" cy="2" rx="16" ry="12" fill="${cc}"/><ellipse cx="50" cy="0" rx="18" ry="14" fill="${cc}"/></g></g>`;
      }
    }
  }

  // the sun works like a flashlight: a cone of warm light aimed at the city
  let sunlight = '';
  if (!night) {
    // light reaching the four corners of the city, plus a soft ray to each corner
    const corners = [P(0, 0, 0), P(NX, 0, 0), P(NX, NY, 0), P(0, NY, 0)];
    const ptsAll = [[cxS, cyS], ...corners].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p2 of ptsAll) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p2) <= 0) lower.pop(); lower.push(p2); }
    const upper = [];
    for (const p2 of [...ptsAll].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p2) <= 0) upper.pop(); upper.push(p2); }
    const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    const [ccx, ccy] = P(NX / 2, NY / 2);
    const k = T.night ? 1.4 : 1;
    let rays = '';
    corners.forEach(([qx, qy], i) => {
      const ang = Math.atan2(qy - cyS, qx - cxS);
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      const w = 7;
      rays += `<polygon points="${pts([cxS + nx * 1.5, cyS + ny * 1.5], [qx + nx * w, qy + ny * w], [qx - nx * w, qy - ny * w], [cxS - nx * 1.5, cyS - ny * 1.5])}"><animate attributeName="opacity" values="1;.45;1" dur="${4 + i}s" repeatCount="indefinite"/></polygon>`;
    });
    sunlight = `<defs><radialGradient id="cc-beam" gradientUnits="userSpaceOnUse" cx="${r1(cxS)}" cy="${r1(cyS)}" r="${r1(Math.hypot(ccx - cxS, ccy - cyS) * 1.6)}"><stop offset="0" stop-color="#ffd98a" stop-opacity="${r3(0.2 * k)}"/><stop offset="1" stop-color="#ffd98a" stop-opacity="${r3(0.03 * k)}"/></radialGradient></defs>` +
      `<g fill="url(#cc-beam)" pointer-events="none"><polygon points="${pts(...hull)}" opacity=".35"/><g opacity=".28">${rays}</g></g>`;
  }

  // ---------- text ----------
  const fmtN = (n) => n.toLocaleString('en-US');
  const name = title ?? `${login}'s Commit City`;
  let text = `<g font-family="${FONT}" text-anchor="end">`;
  text += `<text x="${width - PAD}" y="42" font-size="24" font-weight="700" fill="${T.text}">${esc(name)}</text>`;
  text += `<text x="${width - PAD}" y="64" font-size="13" fill="${T.subtext}"><tspan fill="${accent}" font-weight="700">${fmtN(stats.total)}</tspan> contributions · ${fmtN(stats.active)} active days · last ${months === 12 ? '12 months' : months === 1 ? 'month' : months + ' months'}</text>`;
  const chips = [
    ['longest streak', `${stats.longest} d`],
    ['current streak', `${stats.current} d`],
    ['best day', stats.best ? `${stats.best.count}` : '0'],
  ];
  let cxp = width - PAD;
  for (let i = chips.length - 1; i >= 0; i--) {
    const [label, val] = chips[i];
    const w = 22 + (label.length + val.length + 1) * 6.1;
    cxp -= w;
    text += `<rect x="${r1(cxp)}" y="76" width="${r1(w)}" height="22" rx="11" fill="${T.chipBg}" stroke="${T.chipBorder}"/>`;
    text += `<text x="${r1(cxp + w / 2)}" y="91" text-anchor="middle" font-size="11.5" fill="${T.subtext}">${label} <tspan fill="${T.text}" font-weight="700">${esc(val)}</tspan></text>`;
    cxp -= 8;
  }
  text += `</g>`;
  const fy = footTop + (showLegend ? 16 : 0);
  text += `<g font-family="${FONT}" font-size="11" fill="${T.subtext}"><text x="${PAD}" y="${fy}">1 building = 1 day · height = contributions</text>`;
  if (showLegend) {
    const ly = footTop;
    text += `<g font-family="${FONT}" font-size="11" fill="${T.subtext}"><rect x="${PAD}" y="${ly - 8}" width="9" height="9" rx="2" fill="${accent}"/><text x="${PAD + 14}" y="${ly}">public</text><rect x="${PAD + 62}" y="${ly - 8}" width="9" height="9" rx="2" fill="${privateColor}"/><text x="${PAD + 76}" y="${ly}">private</text><text x="${PAD + 124}" y="${ly}" opacity=".8">· mixed days: public floors below, private above</text></g>`;
  }
  text += `<text x="${PAD}" y="${fy + 16}" opacity=".75">commit-city · updated ${esc(today)}</text></g>`;


  // ---------- optional charts ----------
  let chartSvg = '';
  if (chartList.length) {
    const gap = CARD_GAP;
    const cw = CARD_W;
    const cy0 = cardTop;
    const ch = CARD_H;
    const soft = mix(T.chipBg, accent, 0.25);
    const card = (x, title, note = '') => `<rect x="${r1(x)}" y="${cy0}" width="${r1(cw)}" height="${ch}" rx="12" fill="${T.chipBg}" stroke="${T.chipBorder}"/>` +
      `<text x="${r1(x + 14)}" y="${cy0 + 21}" font-size="11.5" font-weight="700" fill="${T.text}">${title}</text>` +
      (note ? `<text x="${r1(x + cw - 14)}" y="${cy0 + 21}" font-size="10" text-anchor="end" fill="${T.subtext}">${note}</text>` : '');
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    chartList.forEach((c, i) => {
      const x = cardX;
      chartSvg += `<g transform="translate(0 ${i * (ch + gap)})">`;
      if (c === 'months') {
        // smooth area chart with a gradient and the peak highlighted
        const map = new Map();
        for (const d of days) map.set(d.date.slice(0, 7), (map.get(d.date.slice(0, 7)) || 0) + d.count);
        const keys = [...map.keys()].sort().slice(-months - 1);
        const vals = keys.map((k) => map.get(k));
        const max = Math.max(1, ...vals);
        const L = x + 18, R = x + cw - 18, Tp = cy0 + 34, B = cy0 + ch - 22;
        const px = (k) => (keys.length === 1 ? (L + R) / 2 : L + (k * (R - L)) / (keys.length - 1));
        const py = (v) => B - (v / max) * (B - Tp);
        const P2 = vals.map((v, k) => [px(k), py(v)]);
        let d = `M${r1(P2[0][0])},${r1(P2[0][1])}`;
        for (let k = 1; k < P2.length; k++) {
          const [x0, y0] = P2[k - 1];
          const [x1, y1] = P2[k];
          const mx = (x0 + x1) / 2;
          d += ` C${r1(mx)},${r1(y0)} ${r1(mx)},${r1(y1)} ${r1(x1)},${r1(y1)}`;
        }
        const area = `${d} L${r1(P2[P2.length - 1][0])},${B} L${r1(P2[0][0])},${B} Z`;
        const peak = vals.indexOf(max);
        let o = card(x, 'Contributions per month', `peak ${MONTHS[Number(keys[peak].slice(5)) - 1]} · ${max}`);
        o += `<defs><linearGradient id="cc-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity=".45"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient></defs>`;
        for (let g = 1; g <= 3; g++) o += `<line x1="${L}" x2="${R}" y1="${r1(B - (g * (B - Tp)) / 3)}" y2="${r1(B - (g * (B - Tp)) / 3)}" stroke="${T.chipBorder}" stroke-dasharray="2 3"/>`;
        o += `<path d="${area}" fill="url(#cc-area)"/><path d="${d}" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>`;
        P2.forEach(([cx, cy], k) => {
          o += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${k === peak ? 3.6 : 2}" fill="${k === peak ? accent : T.chipBg}" stroke="${accent}" stroke-width="1.4"><title>${keys[k]}: ${vals[k]}</title></circle>`;
          if (keys.length <= 7 || k % 2 === (keys.length - 1) % 2) o += `<text x="${r1(cx)}" y="${B + 13}" font-size="8.5" text-anchor="middle" fill="${T.subtext}">${MONTHS[Number(keys[k].slice(5)) - 1]}</text>`;
        });
        chartSvg += o;
      } else if (c === 'weekdays') {
        // punch card: one bubble per weekday, area proportional to contributions
        const sums = new Array(7).fill(0);
        for (const d of days) sums[d.weekday] += d.count;
        const order = [1, 2, 3, 4, 5, 6, 0];
        const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const max = Math.max(1, ...sums);
        const best = sums.indexOf(max);
        const full = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
        let o = card(x, 'Busiest weekdays', `${full[best]} rule`);
        const step = (cw - 28) / 7;
        const cyy = cy0 + 34 + (ch - 56) / 2;
        const rmax = Math.min(step * 0.42, (ch - 56) / 2);
        order.forEach((k, j) => {
          const cx = x + 14 + step * (j + 0.5);
          const rr = Math.max(1.5, Math.sqrt(sums[k] / max) * rmax);
          o += `<circle cx="${r1(cx)}" cy="${r1(cyy)}" r="${r1(rmax)}" fill="none" stroke="${T.chipBorder}" stroke-dasharray="2 2"/>`;
          o += `<circle cx="${r1(cx)}" cy="${r1(cyy)}" r="${r1(rr)}" fill="${k === best ? accent : soft}"><title>${names[k]}: ${sums[k]}</title></circle>`;
          o += `<text x="${r1(cx)}" y="${cy0 + ch - 9}" font-size="8.5" text-anchor="middle" fill="${k === best ? T.text : T.subtext}"${k === best ? ' font-weight="700"' : ''}>${names[k]}</text>`;
        });
        chartSvg += o;
      } else if (c === 'recent') {
        // last 30 days as dots: size and colour grow with contributions, today is ringed
        const last = days.slice(-30);
        const max = Math.max(1, ...last.map((d) => d.count));
        const total = last.reduce((a2, d) => a2 + d.count, 0);
        const active = last.filter((d) => d.count > 0).length;
        let o = card(x, 'Last 30 days', `${total} contributions · ${active} active`);
        const cols = 15;
        const stepX = (cw - 28) / cols;
        const y0 = cy0 + 46;
        const stepY = 26;
        const rmax = Math.min(stepX, stepY) * 0.42;
        last.forEach((d, i) => {
          const cx = x + 14 + stepX * ((i % cols) + 0.5);
          const cyy = y0 + Math.floor(i / cols) * stepY;
          const t = d.count / max;
          const rr = d.count ? Math.max(2.4, Math.sqrt(t) * rmax) : 1.6;
          const col = d.count ? mix(soft, d.private && d.private >= d.count ? privateColor : accent, 0.25 + 0.75 * t) : T.chipBorder;
          o += `<circle cx="${r1(cx)}" cy="${r1(cyy)}" r="${r1(rr)}" fill="${col}"><title>${d.date}: ${d.count}</title></circle>`;
          if (d.date === today) o += `<circle cx="${r1(cx)}" cy="${r1(cyy)}" r="${r1(rmax + 2)}" fill="none" stroke="${T.craneColor}" stroke-width="1.4"/>`;
        });
        o += `<text x="${r1(x + 14)}" y="${cy0 + ch - 9}" font-size="8.5" fill="${T.subtext}">${last[0]?.date.slice(5) ?? ''}</text><text x="${r1(x + cw - 14)}" y="${cy0 + ch - 9}" font-size="8.5" text-anchor="end" fill="${T.subtext}">today</text>`;
        chartSvg += o;
      } else if (c === 'split') {
        // public vs private donut
        const priv = days.reduce((a2, d) => a2 + (d.private || 0), 0);
        const all = days.reduce((a2, d) => a2 + d.count, 0) || 1;
        const pubN = all - priv;
        let o = card(x, 'Public vs private');
        const R0 = Math.min(30, (ch - 44) / 2);
        const cx = x + 20 + R0;
        const cyy = cy0 + 30 + (ch - 30) / 2 - 4;
        const circ = 2 * Math.PI * R0;
        const fp = pubN / all;
        o += `<circle cx="${r1(cx)}" cy="${r1(cyy)}" r="${r1(R0)}" fill="none" stroke="${privateColor}" stroke-width="9"/>`;
        o += `<circle cx="${r1(cx)}" cy="${r1(cyy)}" r="${r1(R0)}" fill="none" stroke="${accent}" stroke-width="9" stroke-dasharray="${r1(fp * circ)} ${r1(circ)}" transform="rotate(-90 ${r1(cx)} ${r1(cyy)})"/>`;
        const lx = cx + R0 + 18;
        o += `<circle cx="${r1(lx)}" cy="${cy0 + 47}" r="3.5" fill="${accent}"/><text x="${r1(lx + 8)}" y="${cy0 + 50}" font-size="10" fill="${T.subtext}">public <tspan fill="${T.text}" font-weight="700">${pubN} · ${Math.round(fp * 100)}%</tspan></text>`;
        o += `<circle cx="${r1(lx)}" cy="${cy0 + 65}" r="3.5" fill="${privateColor}"/><text x="${r1(lx + 8)}" y="${cy0 + 68}" font-size="10" fill="${T.subtext}">private <tspan fill="${T.text}" font-weight="700">${priv} · ${100 - Math.round(fp * 100)}%</tspan></text>`;
        chartSvg += o;
      } else if (c === 'languages') {
        // donut + legend
        const top = languages.slice(0, 5);
        const total = top.reduce((a2, l) => a2 + l.count, 0) || 1;
        let o = card(x, 'Languages I commit in');
        const R0 = Math.min(30, (ch - 44) / 2);
        const cx = x + 20 + R0;
        const cyy = cy0 + 30 + (ch - 30) / 2 - 4;
        const circ = 2 * Math.PI * R0;
        let acc = 0;
        top.forEach((l, k) => {
          const frac = l.count / total;
          const col = l.color || mix(accent, T.chipBg, k * 0.18);
          o += `<circle cx="${r1(cx)}" cy="${r1(cyy)}" r="${r1(R0)}" fill="none" stroke="${col}" stroke-width="9" stroke-dasharray="${r1(Math.max(frac * circ - 1.5, 0.5))} ${r1(circ)}" stroke-dashoffset="${r1(-acc * circ)}" transform="rotate(-90 ${r1(cx)} ${r1(cyy)})"/>`;
          acc += frac;
          const lx = cx + R0 + 18;
          const ly = cy0 + 40 + k * 13;
          o += `<circle cx="${r1(lx)}" cy="${ly - 3}" r="3.5" fill="${col}"/><text x="${r1(lx + 8)}" y="${ly}" font-size="10" fill="${T.subtext}">${esc(l.name)} <tspan fill="${T.text}" font-weight="700">${Math.round(frac * 100)}%</tspan></text>`;
        });
        chartSvg += o;
      }
      chartSvg += '</g>';
    });
    chartSvg = `<g font-family="${FONT}">${chartSvg}</g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(name)}: ${stats.total} contributions shown as an isometric city">` +
    `<title>${esc(name)}</title><style>.cc-hover{opacity:0;transition:opacity .2s}.cc-pin:hover .cc-hover{opacity:1}</style><defs>${defs.join('')}</defs>${sky}${text}${chartSvg}<g>${ground}</g><g>${items.map((i) => i.s).join('')}</g>${sunlight}${pins.join('')}</svg>`;
}
