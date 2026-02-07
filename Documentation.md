# Animals at the Tower (HRP) – Developer Documentation

---

## 1. File and folder structure

| Path | Purpose |
|------|--------|
| `index.html` | Landing: title "ANIMALS AT THE TOWER", subtitle, "Find the animals" (→ nickname or menu), Map / Badges / Animals buttons, Settings. |
| `data/assets.json` | Data for animals (`items`) and `gameBadges`. Each item has name, description, model (GLB/USDZ), badge, optional `place`, and optional `mapHotspot`. Used by Map, Badges and Animals pages. |
| `pages/nickname.html` | New-user flow: create nickname, then redirect to menu. |
| `pages/menu.html` | Hub: "Find the animals" → map, Map, Badges, Animals; Settings; back to landing. |
| `pages/animals.html` | Grid of animals from `items`; each card links to `badges.html?badge=<id>` to open animal detail. |
| `pages/games.html` | List of game links (optional). |
| `pages/map.html` | Map image + tappable hotspots from `assets.json`; tap opens model viewer and AR. |
| `pages/badges.html` | Badge grid from JSON; tap opens Animal details popup (3D model, story, Found date, Place, Replay game). Supports `?badge=<id>` to open a specific animal. |
| `pages/leaderboard.html` | Daily and monthly leaderboards (optional). |
| `scripts/landing-ani.js` | Landing animation (CreateJS). |
| `scripts/model-viewer.js` | 3D GLB viewer and AR (webxr, scene-viewer, quick-look). Defaults: exposure 1.25, shadow-intensity 0.6, xr-environment. See [modelviewer.dev](https://modelviewer.dev/) and [AR examples](https://modelviewer.dev/examples/augmentedreality/index.html). **AR floor placement:** If a model appears to float above the detected floor on Android, the GLB was likely exported with its origin or pivot above the ground. Re-export with the origin at the bottom (y=0 = floor contact point); [model-viewer has no API for vertical offset](https://github.com/google/model-viewer/discussions/1885). |
| `scripts/settings.js` | Shared settings: haptics, sound, music, How to play, Permissions. |
| `styles/theme.css` | **Centralised theme:** `:root` colours, `--Display-Font-Family` (Pirata One), `--font-family-primary`, button and background colours. Load first on every page. |
| `cms/` | Flask backend for editing `data/assets.json`. |

---

## 2. Landing

- **Title:** "ANIMALS AT THE TOWER" uses display font (Pirata One) and theme text colour.
- **Subtitle:** "Locate the Creatures around the Tower of London."
- **Main CTA:** "Find the animals" → nickname (new user) or menu (returning). Secondary: Map, Badges, Animals.
- **Logo:** `assets/svg/HRP_logo.svg`. Loading screen uses the same logo.

---

## 3. Menu

- **Title:** "ANIMALS AT THE TOWER" (display font). Copy describes discovering animals from the Royal Menagerie.
- **Buttons:** Find the animals → map; Map, Badges; Animals → `animals.html`.

---

## 4. Animals page

- **Grid:** Built from `data/assets.json` `items`. Each card shows badge icon and animal name; link to `badges.html?badge=<item.badge.id>`.

---

## 5. Map

- **Map image:** Replace `assets/map-placeholder.png` with the Tower of London map when available.
- **Hotspots:** Items with `mapHotspot: { xPercent, yPercent }` get a tappable pin; tap opens model viewer with that item’s `model.url` and `model.usdz`.

---

## 6. Badges and Animal detail

- **Badge grid:** From `items[].badge` and `gameBadges`. Collected state in `localStorage.collectedBadges`.
- **Animal details popup:** Title "ANIMAL DETAILS". When the item has `model.url`, the 3D model is shown in the popup; otherwise the badge icon. Shows animal name (uppercase), historical description (`item.description`), Found date, Place (`item.place` if present), and "Replay game" when `gamePath` is set.
- **URL:** `badges.html?badge=<badgeId>` opens the detail popup for that badge on load.

---

## 7. Theme (theme.css)

- **Colours:** `--background` (#C0DCB2), `--background-alt` / `--background-cream` (#F1DCB8), `--text-color` / `--primary-color` (#514848), button text `#FFFFFF`, accents (terracotta, navy, sage).
- **Display title:** `.display-title` uses `--Display-Font-Family` (Pirata One), 80px, uppercase, letter-spacing -1.5px.

---

## 8. Data schema (assets.json)

- **items:** Each entry: `id`, `name`, `scientificName`, `description`, `badgeDescription`, `location`, `radiusMeters`, `icon`, `model` (url, usdz, scale, rotation), `ping`, `badge` (id, name, icon, description, gamePath), optional `place`, optional `mapHotspot` (xPercent, yPercent).
- **gameBadges:** Array of game badges (id, name, description, icon, gamePath).

---

## 9. CMS

- Run from `cms/`; edits `data/assets.json`. Optional `place` can be added to the item schema and edit form for "Place: Tower of London" in the animal detail popup.

---

## 10. Customer.io (optional)

- `scripts/customer-io-helper.js`: syncs user and badge data when the Customer.io snippet is present.
