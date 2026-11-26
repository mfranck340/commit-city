// Fetches a user's contribution calendar.
// 1. GraphQL API (needs a token; GITHUB_TOKEN inside Actions is enough).
// 2. Fallback without token: the public contributions HTML fragment.

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const QUERY = `query($login: String!, $from: DateTime, $to: DateTime) {
  user(login: $login) {
    login
    name
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 50) {
        repository { primaryLanguage { name color } }
        contributions { totalCount }
      }
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date weekday contributionCount contributionLevel } }
      }
    }
  }
}`;

export async function fetchWithGraphQL(login, token, { from, to } = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'commit-city',
    },
    body: JSON.stringify({ query: QUERY, variables: { login, from, to } }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
  if (!json.data.user) throw new Error(`User "${login}" not found`);
  const cal = json.data.user.contributionsCollection.contributionCalendar;
  const days = cal.weeks.flatMap((w) =>
    w.contributionDays.map((d) => ({
      date: d.date,
      weekday: d.weekday,
      count: d.contributionCount,
      level: LEVELS[d.contributionLevel] ?? 0,
    })),
  );
  const langs = new Map();
  for (const r of json.data.user.contributionsCollection.commitContributionsByRepository || []) {
    const l = r.repository.primaryLanguage;
    if (!l) continue;
    const cur = langs.get(l.name) || { name: l.name, color: l.color, count: 0 };
    cur.count += r.contributions.totalCount;
    langs.set(l.name, cur);
  }
  const languages = [...langs.values()].sort((a, b) => b.count - a.count);
  return { login: json.data.user.login, name: json.data.user.name, days, languages };
}

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

export function parseContributionsHtml(html) {
  const counts = {};
  for (const m of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const a = attrs(m[1]);
    const n = m[2].trim().match(/^(\d[\d,]*|No) contributions?/);
    if (a.for && n) counts[a.for] = n[1] === 'No' ? 0 : Number(n[1].replace(/,/g, ''));
  }
  const days = [];
  for (const m of html.matchAll(/<td\b([^>]*data-date="[^"]+"[^>]*)>/g)) {
    const a = attrs(m[1]);
    const level = Number(a['data-level'] ?? 0);
    days.push({
      date: a['data-date'],
      weekday: new Date(a['data-date'] + 'T00:00:00Z').getUTCDay(),
      level,
      count: counts[a.id] ?? (level > 0 ? level : 0),
    });
  }
  days.sort((x, y) => (x.date < y.date ? -1 : 1));
  return days;
}

export async function fetchWithoutToken(login) {
  const res = await fetch(`https://github.com/users/${encodeURIComponent(login)}/contributions`, {
    headers: { 'User-Agent': 'commit-city' },
  });
  if (!res.ok) throw new Error(`Could not load contributions page (HTTP ${res.status})`);
  const days = parseContributionsHtml(await res.text());
  if (!days.length) throw new Error('Contributions page had no calendar data');
  return { login, name: null, days };
}

export async function fetchContributions(login, token, opts) {
  if (token) return fetchWithGraphQL(login, token, opts);
  return fetchWithoutToken(login);
}

/** Group a flat, date-sorted list of days into Sunday-first weeks. */
export function toWeeks(days) {
  const weeks = [];
  let cur = null;
  for (const d of days) {
    if (!cur || d.weekday === 0) {
      cur = new Array(7).fill(null);
      weeks.push(cur);
    }
    cur[d.weekday] = d;
  }
  return weeks;
}

/** Synthetic year used by --demo and the tests. */
export function demoDays(seedDate = new Date().toISOString().slice(0, 10)) {
  const end = new Date(seedDate + 'T00:00:00Z');
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364 - start.getUTCDay());
  const days = [];
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let t = new Date(start); t <= end; t.setUTCDate(t.getUTCDate() + 1)) {
    const wd = t.getUTCDay();
    const season = 0.6 + 0.4 * Math.sin((t.getUTCMonth() / 12) * Math.PI * 2);
    let c = rand() < (wd === 0 || wd === 6 ? 0.35 : 0.8) ? Math.floor(rand() * 9 * season) : 0;
    if (rand() < 0.04) c += 12 + Math.floor(rand() * 20);
    days.push({ date: t.toISOString().slice(0, 10), weekday: wd, count: c, level: 0 });
  }
  return assignLevels(days);
}

/** Quartile levels like GitHub when we only have counts. */
export function assignLevels(days) {
  const max = Math.max(1, ...days.map((d) => d.count));
  for (const d of days) d.level = d.count === 0 ? 0 : Math.min(4, Math.ceil((d.count / max) * 4));
  return days;
}

// ---------- public / private split ----------
// The calendar only gives a total per day. We count, per day, the contributions made in
// PUBLIC repositories; whatever is left of the total is private.
const SPLIT_QUERY = `query($login: String!, $from: DateTime, $to: DateTime) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository { isPrivate }
        contributions(first: 100) { nodes { occurredAt commitCount } }
      }
      issueContributionsByRepository(maxRepositories: 100) {
        repository { isPrivate }
        contributions(first: 100) { nodes { occurredAt } }
      }
      pullRequestContributionsByRepository(maxRepositories: 100) {
        repository { isPrivate }
        contributions(first: 100) { nodes { occurredAt } }
      }
      pullRequestReviewContributionsByRepository(maxRepositories: 100) {
        repository { isPrivate }
        contributions(first: 100) { nodes { occurredAt } }
      }
      repositoryContributions(first: 100) { nodes { occurredAt repository { isPrivate } } }
    }
  }
}`;

async function gql(token, query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'commit-city' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL HTTP ${res.status}`);
  const json = await res.json();
  // Partial errors (e.g. a repository the token cannot read) still come with usable data.
  if (json.errors && !json.data) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

/** Adds `private` (count) to each day. Queries in ~3 month windows so no repo exceeds 100 days. */
export async function addPrivateSplit(login, token, days) {
  if (!token || !days.length) return days;
  const pub = new Map();
  const add = (date, n) => pub.set(date, (pub.get(date) || 0) + n);
  const first = new Date(days[0].date + 'T00:00:00Z');
  const last = new Date(days[days.length - 1].date + 'T23:59:59Z');
  for (let from = new Date(first); from <= last; ) {
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 90);
    const end = to > last ? last : to;
    const data = await gql(token, SPLIT_QUERY, { login, from: from.toISOString(), to: end.toISOString() });
    const c = data?.user?.contributionsCollection;
    if (!c) throw new Error('no contributionsCollection in the response');
    // A repository the token cannot see comes back as null: count it as private.
    const isPublic = (repo) => repo?.isPrivate === false;
    const nodes = (r) => (r?.contributions?.nodes || []).filter(Boolean);
    for (const r of c.commitContributionsByRepository || []) {
      if (isPublic(r?.repository)) for (const n of nodes(r)) add(n.occurredAt.slice(0, 10), n.commitCount || 0);
    }
    for (const key of ['issueContributionsByRepository', 'pullRequestContributionsByRepository', 'pullRequestReviewContributionsByRepository']) {
      for (const r of c[key] || []) if (isPublic(r?.repository)) for (const n of nodes(r)) add(n.occurredAt.slice(0, 10), 1);
    }
    for (const n of c.repositoryContributions?.nodes || []) if (n && isPublic(n.repository)) add(n.occurredAt.slice(0, 10), 1);
    from = new Date(end.getTime() + 1000);
  }
  for (const d of days) d.private = Math.max(0, d.count - (pub.get(d.date) || 0));
  return days;
}
