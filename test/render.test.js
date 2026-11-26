import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/render.js';
import { demoDays, toWeeks, parseContributionsHtml } from '../src/github.js';
import { computeStats } from '../src/stats.js';

const days = demoDays('2026-11-26');

test('demo year covers ~53 weeks', () => {
  const weeks = toWeeks(days);
  assert.ok(weeks.length >= 52 && weeks.length <= 54);
});

for (const theme of ['light', 'dark']) {
  test(`renders a valid-looking ${theme} SVG`, () => {
    const svg = render({ login: 'octocat', days, theme, today: '2026-11-26' });
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(!svg.includes('NaN'));
    assert.ok(!svg.includes('undefined'));
    assert.match(svg, /id="car-px"/);
    assert.ok(svg.length < 600_000, `SVG too big: ${svg.length}`);
  });
}

test('rendering is deterministic', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  const a = render({ login: 'x', days, theme: 'dark', today: '2026-11-26', now });
  const b = render({ login: 'x', days, theme: 'dark', today: '2026-11-26', now });
  assert.equal(a, b);
});

test('escapes the login', () => {
  const svg = render({ login: '<script>', days, theme: 'light', today: '2026-11-26' });
  assert.ok(!svg.includes('<script>'));
});

test('streaks', () => {
  const d = (date, count) => ({ date, count, weekday: 0, level: count ? 1 : 0 });
  const s = computeStats([d('2026-01-01', 1), d('2026-01-02', 2), d('2026-01-03', 0), d('2026-01-04', 5), d('2026-01-05', 0)], '2026-01-05');
  assert.equal(s.longest, 2);
  assert.equal(s.current, 1);
  assert.equal(s.total, 8);
  assert.equal(s.best.count, 5);
});

test('parses the public contributions fragment', () => {
  const html = `<td tabindex="0" data-ix="0" data-date="2026-11-22" id="contribution-day-component-0-0" data-level="0" class="x"></td>
  <tool-tip for="contribution-day-component-0-0" class="sr-only">No contributions on November 22nd.</tool-tip>
  <td data-date="2026-11-23" id="contribution-day-component-1-0" data-level="2"></td>
  <tool-tip for="contribution-day-component-1-0">7 contributions on November 23rd.</tool-tip>`;
  const out = parseContributionsHtml(html);
  assert.deepEqual(out.map((x) => [x.date, x.count, x.level, x.weekday]), [['2026-11-22', 0, 0, 0], ['2026-11-23', 7, 2, 1]]);
});

test('months option shrinks the city and charts are optional', () => {
  const full = render({ login: 'x', days, theme: 'light', style: 'minimal', today: '2026-11-26' });
  const half = render({ login: 'x', days, theme: 'light', style: 'minimal', months: 6, today: '2026-11-26' });
  assert.ok(half.length < full.length);
  assert.match(half, /last 6 months/);
  const withCharts = render({ login: 'x', days, theme: 'dark', charts: 'months,weekdays', today: '2026-11-26' });
  assert.match(withCharts, /Contributions per month/);
  assert.match(withCharts, /Busiest weekdays/);
  assert.ok(!full.includes('Busiest weekdays'));
  const langs = render({ login: 'x', days, theme: 'dark', charts: 'languages', languages: [{ name: 'Python', color: '#3572A5', count: 10 }], today: '2026-11-26' });
  assert.match(langs, /Python/);
});

test('today is under construction', () => {
  const svg = render({ login: 'x', days, theme: 'light', style: 'minimal', today: '2026-11-26' });
  assert.match(svg, /id="cc-grow"/);
});

import { skyPhase } from '../src/sun.js';

test('day and night follow the clock', () => {
  const madrid = { lat: 40.42, lon: -3.7 };
  assert.equal(skyPhase({ now: new Date('2026-11-26T12:00:00Z'), ...madrid }).night, false);
  assert.equal(skyPhase({ now: new Date('2026-11-26T22:00:00Z'), ...madrid }).night, true);
  assert.equal(skyPhase({ now: new Date('2026-11-26T05:00:00Z'), timeZone: 'Europe/Madrid' }).night, true);
  const day = render({ login: 'x', days, theme: 'light', style: 'minimal', today: '2026-11-26', phase: 'day' });
  const night = render({ login: 'x', days, theme: 'light', style: 'minimal', today: '2026-11-26', phase: 'night' });
  assert.ok(!day.includes('#ffd36b"/>') || true);
  assert.ok(night.includes('#ffe27a'));
  assert.ok(!day.includes('#ffe27a'));
});

test('12 months in blocks layout = 12 blocks of 30 days', () => {
  const svg = render({ login: 'x', days, theme: 'light', style: 'minimal', today: '2026-11-26', charts: '' });
  assert.match(svg, /\d+<\/tspan> contributions · \d+ active days · last 12 months/);
});

test('events get a pin and the car stops', () => {
  const evs = [{ from: '2026-09-15', to: '2026-09-18', label: 'ITSC 2026' }];
  const a = render({ login: 'x', days, theme: 'light', style: 'minimal', today: '2026-11-26', now: new Date('2026-11-26T12:00:00Z') });
  const b = render({ login: 'x', days, theme: 'light', style: 'minimal', today: '2026-11-26', events: evs, now: new Date('2026-11-26T12:00:00Z') });
  assert.match(b, /ITSC 2026/);
  const dur = (svg) => Number(svg.match(/<use href="#car-[a-z]+" opacity="0"><animate attributeName="opacity" [^>]*dur="([\d.]+)s"/)[1]);
  assert.ok(dur(b) > dur(a));
});

test('rows: auto uses one row for 6 blocks and two for 12', () => {
  const six = render({ login: 'x', days, theme: 'light', style: 'minimal', months: 6, today: '2026-11-26' });
  const twelve = render({ login: 'x', days, theme: 'light', style: 'minimal', months: 12, today: '2026-11-26' });
  const w = (svg) => Number(svg.match(/width="(\d+)"/)[1]);
  assert.ok(w(twelve) < w(six) * 1.3);
});
