# Animals at the Tower (HRP)

A web app for Historic Royal Palaces: families explore the Tower of London using an interactive map to discover animals once kept in the Royal Menagerie. At each location, visitors learn the animal's story, view 3D models and AR, and collect achievements.

## Overview

- **Front-end:** Static HTML/CSS/JS. Landing → Nickname (new users) or Menu → Find the animals (Map), Animals grid, Badges; 3D model viewer with AR (ARCore / ARKit Quick Look).
- **Theme:** Centralised in `styles/theme.css` (HRP colours, Pirata One display title, button and text colours).
- **Data:** `data/assets.json` holds animals (items) and badges; map hotspots and badge grid are driven from this file.
- **Backend:** Optional Flask CMS in `cms/` for editing `data/assets.json`. The app runs without it by loading the JSON directly.

## Running the project

**Front-end (static):**  
Serve the project folder over HTTP (e.g. `npx serve .` or your local server). Open `index.html` as the entry point.

**Backend (CMS):**  
From the project folder:
```bash
cd cms
pip install -r requirements.txt
# Set FLASK_APP=app.py and run flask run (or python -m flask run)
```
Then open the CMS URL (e.g. http://127.0.0.1:5000) to log in and edit assets.

## Customising

- **Logo:** HRP logo is at `assets/svg/HRP_logo.svg` and is used on landing, menu, nickname and games.
- **Theme:** Edit `styles/theme.css` for colours, fonts (`--Display-Font-Family` for the main title, `--font-family-primary` for body).
- **Content:** Edit `data/assets.json` for animals (items), badges and map hotspots. See **Documentation.md** for the schema and optional `place` field.

For a full list of files and behaviour, see **Documentation.md**.

## AR and 3D models

- **Android (ARCore):** The AR button is shown once the model has loaded. On Android, Scene Viewer is preferred so tapping AR opens the native AR viewer when available.
- **iOS (Quick Look):** Tapping AR opens the USDZ in Apple’s Quick Look. For the model to **animate in Quick Look**, the USDZ file must be exported with animations included (same as in the GLB). If the GLB has animations but the USDZ does not, re-export the USDZ from a tool that preserves animation (e.g. Reality Converter, or your 3D pipeline) and replace the file in `assets/models/`.
