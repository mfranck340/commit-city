/** Streaks and highlights computed from the flat list of days (oldest first). */
export function computeStats(days, today = new Date().toISOString().slice(0, 10)) {
  const past = days.filter((d) => d.date <= today);
  let longest = 0;
  let run = 0;
  for (const d of past) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  let i = past.length - 1;
  if (i >= 0 && past[i].count === 0) i--; // today not committed yet doesn't break the streak
  for (; i >= 0 && past[i].count > 0; i--) current++;

  const best = past.reduce((b, d) => (d.count > (b?.count ?? -1) ? d : b), null);
  const total = past.reduce((s, d) => s + d.count, 0);
  const active = past.filter((d) => d.count > 0).length;
  return { total, longest, current, best, active };
}
