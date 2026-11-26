// Day/night for a given moment and place.
// With latitude/longitude: real sunrise/sunset (NOAA approximation).
// Without: day is 07:00-19:00 in the given time zone.

const rad = Math.PI / 180;

function localHour(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour').value);
  const m = Number(parts.find((p) => p.type === 'minute').value);
  return h + m / 60;
}

/** Sunrise and sunset in minutes after 00:00 UTC for the UTC date of `now`. */
export function sunTimesUTC(now, lat, lon) {
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  const n = Math.floor((now.getTime() - start) / 86400000) + 1;
  const g = ((2 * Math.PI) / 365) * (n - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const c = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (c > 1) return { polar: 'night' };
  if (c < -1) return { polar: 'day' };
  const ha = Math.acos(c) / rad;
  return { sunrise: 720 - 4 * (lon + ha) - eq, sunset: 720 - 4 * (lon - ha) - eq };
}

/**
 * Returns { night: boolean, progress: 0..1 } where progress is how far the sun
 * (by day) or the moon (by night) has travelled across the sky.
 */
export function skyPhase({ now = new Date(), timeZone = 'UTC', lat, lon, phase = 'auto' } = {}) {
  if (phase === 'day') return { night: false, progress: 0.35 };
  if (phase === 'night') return { night: true, progress: 0.35 };
  let rise;
  let set;
  let t;
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const st = sunTimesUTC(now, lat, lon);
    if (st.polar) return { night: st.polar === 'night', progress: 0.5 };
    rise = st.sunrise / 60;
    set = st.sunset / 60;
    t = now.getUTCHours() + now.getUTCMinutes() / 60;
  } else {
    rise = 7;
    set = 19;
    t = localHour(now, timeZone);
  }
  const norm = (h) => ((h % 24) + 24) % 24;
  const dayLen = norm(set - rise);
  const since = norm(t - rise);
  if (since <= dayLen) return { night: false, progress: since / dayLen };
  return { night: true, progress: (since - dayLen) / (24 - dayLen) };
}
