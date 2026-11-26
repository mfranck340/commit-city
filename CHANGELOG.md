# Changelog

## 1.0.2 (2026-11-26)

- Fix: the public/private split no longer fails when the token cannot see some repositories (they come back as `null`); those contributions now count as private instead of turning the whole city public.

## 1.0.1 (2026-11-26)

- Action renamed to "Commit City by mfranck340" for the GitHub Marketplace.

## 1.0.0 (2026-11-26)

First release.

- Isometric city from the contribution calendar: one lot per day, blocks of 30 days.
- Building types by activity (houses, apartment blocks, towers, skyscrapers), height and colour intensity by contributions.
- Today's lot is a building site with scaffolding, a crane and a rising building.
- Autonomous car with lidar that drives every avenue, keeps its lane, is occluded by buildings and stops at events.
- Day and night that follow the clock (time zone and optional coordinates), moving sun and moon, shadows, lit windows and street lamps.
- Seasons for trees, grass and roofs.
- Public and private contributions in different colours.
- Events as thumbtacks with labels.
- Optional charts: months, weekdays, last 30 days, public vs private, languages.
- Styles: minimal (default), classic, blueprint, neon and clay. Light and dark palettes.
- GitHub Action and zero-dependency Node.js CLI.
