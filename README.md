<div align="center">

# commit-city

**Turn your GitHub contribution history into a living isometric city, with an autonomous car patrolling its streets.**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/commit-city-dark.svg" />
  <img src="docs/commit-city-light.svg" alt="commit-city preview" width="100%" />
</picture>

<sub>Snapshot of <a href="https://github.com/mfranck340">@mfranck340</a>'s city. See it live on the profile.</sub>

</div>

## What you get

A single, self-contained animated SVG (no JavaScript, no external fonts) that you can drop into your profile README. It comes in a light and a dark version, and GitHub shows the one that matches the visitor's theme.

| Your activity | In the city |
| --- | --- |
| Every day | One lot, in chronological order |
| Every 30 days | A city block of 6x5 lots, surrounded by avenues |
| No contributions | A park with trees |
| A few contributions | A house with a pitched roof |
| A good day | An apartment block |
| A great day | An office tower with a setback |
| Your best days | A skyscraper with a crown and a blinking beacon |
| Today | A building site: scaffolding, a crane and the building rising floor by floor |
| Private repositories | Their own colour. Mixed days get public floors below and private floors above |
| Important dates | A thumbtack on the lot. The car parks next to it and its label pops up |

Height and colour intensity grow with the number of contributions. Rendering is deterministic, so the same day always gets the same building.

### A city that follows the clock

- **Day**: the sun travels across the sky and shines on the city, buildings cast shadows that move with it, and the windows are off.
- **Night**: the moon and stars come out, windows and street lamps light up and the car turns on its headlights.
- **Seasons**: snow on trees and roofs in winter, blossoms in spring, green summers and orange autumns, following the month of each block.

Give it your time zone (and optionally your coordinates for real sunrise and sunset times) and run the workflow every hour.

### The autonomous car

A small self-driving car with a spinning lidar drives a closed loop through every avenue. It keeps to its lane, turns at intersections, is hidden behind buildings in front of it and stops for a moment at each of your events.

### Charts

Optional charts in a column to the right of the city:

- `months`: contributions per month (area chart)
- `weekdays`: your busiest weekdays (punch card)
- `recent`: the last 30 days, one dot per day
- `split`: public vs private (needs private data)
- `languages`: languages you commit in (needs a token)

Leave `charts` empty to get just the city.

## Use it in your profile README

**1.** In your profile repository (`<username>/<username>`), create `.github/workflows/commit-city.yml`:

```yaml
name: Commit City

on:
  schedule:
    - cron: '5 * * * *' # every hour, so day and night follow the clock
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: commit-city
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: mfranck340/commit-city@main
        with:
          output-dir: dist
          timezone: Europe/Madrid
          events: |
            2026-09-15..2026-09-18 My conference
            2026-11-20 Release day

      # Publish the images to an "output" branch with a single commit,
      # so main's history doesn't fill up with hourly commits.
      - name: Publish to the output branch
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          cd dist
          git init -q -b output
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -q -m "Commit City $(date -u +'%Y-%m-%d %H:%M') UTC"
          git push -q --force "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" output
```

**2.** Run it once from the **Actions** tab (*Run workflow*) so the `output` branch is created.

**3.** Add the city to your `README.md` (replace `<username>`):

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/<username>/<username>/output/commit-city-dark.svg" />
  <img src="https://raw.githubusercontent.com/<username>/<username>/output/commit-city-light.svg" alt="My commit city" width="100%" />
</picture>
```

A simpler variant that commits the images to your main branch once a day is in [`examples/commit-city.yml`](examples/commit-city.yml).

### Private contributions

The calendar only gives a total per day. commit-city counts the contributions made in public repositories, and whatever is left of the total is drawn as private. For that to work, either:

- enable **Private contributions** in your GitHub profile settings, or
- create a fine-grained or classic token with `read:user` access, save it as the `COMMIT_CITY_TOKEN` secret and pass `token: ${{ secrets.COMMIT_CITY_TOKEN }}`.

### Inputs

| Input | Default | Description |
| --- | --- | --- |
| `username` | repository owner | GitHub login to render |
| `token` | `github.token` | Token for the GraphQL API |
| `output-dir` | `commit-city` | Where the SVGs are written |
| `themes` | `light,dark` | Palettes to render |
| `style` | `minimal` | `minimal`, `classic`, `blueprint`, `neon` or `clay` |
| `months` | `12` | How many months to show (1 to 12). One block = 30 days |
| `block` | `6x5` | Block size in lots (columns x rows) |
| `rows` | `auto` | Rows of blocks: `auto` (1 row up to 6 blocks, otherwise 2), `1`, `2` or `3` |
| `charts` | `months,weekdays,recent` | Charts to the right of the city. Empty for none |
| `color` | `#FF3670` | Main colour. Buildings get more intense the taller they are |
| `private-color` | `#14B8A6` | Colour for private contributions |
| `crane-color` | amber | Colour of today's construction site |
| `events` | *(empty)* | One per line: `YYYY-MM-DD Label` or `YYYY-MM-DD..YYYY-MM-DD Label` |
| `event-color` | `#A78BFA` | Colour of the event thumbtacks |
| `seasons` | `true` | Trees, grass and roofs follow the season |
| `hemisphere` | `north` | `north` or `south`, for the seasons |
| `timezone` | `UTC` | IANA time zone for day and night, e.g. `Europe/Madrid` |
| `latitude` / `longitude` | *(empty)* | For real sunrise and sunset. Without them, day is 07:00 to 19:00 |
| `phase` | `auto` | `auto`, or force `day` / `night` |
| `layout` | `blocks` | `blocks`, or `calendar` for weeks as columns like the GitHub graph |
| `year` | *(empty)* | Render a calendar year (e.g. `2025`) instead of the last months |

Files written: `commit-city-light.svg` and `commit-city-dark.svg`.

## Run it locally

Requires Node.js 18 or newer. There are no dependencies.

```bash
git clone https://github.com/mfranck340/commit-city
cd commit-city

# offline demo city
node src/cli.js --demo --charts months,weekdays,recent --out out

# your real data (a token is optional; without it the public contributions page is used)
GITHUB_TOKEN=ghp_xxx node src/cli.js --user <login> --timezone Europe/Madrid \
  --charts months,weekdays,recent --events "2026-09-15..2026-09-18 My conference" --out out

npm test
```

Every action input is also available as a CLI flag (`--style`, `--months`, `--color`, `--events`, `--phase night`, ...).

## Credits

Inspired by [yoshi389111/github-profile-3d-contrib](https://github.com/yoshi389111/github-profile-3d-contrib). commit-city is an independent implementation with its own renderer and city design.

## License

[MIT](LICENSE) © Franck Fierro
