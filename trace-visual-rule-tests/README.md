# TRACE — Visual Rule Tests

Four Canvas sketches, one page, each isolating one rule from the TRACE System
Identity Proposal. Plain HTML + CSS + vanilla JS, no framework, no build step.

## Run locally

Open `index.html` directly in a browser, or serve the folder so the
background asset loads correctly:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy (Netlify, drag-and-drop — no account setup beyond signing in)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag this whole folder (`trace-visual-rule-tests`) onto the page.
3. Netlify gives you a live URL immediately. That URL is what you submit.

## Deploy (Vercel, via GitHub)

1. Push this folder to a new GitHub repo:
   ```
   git init
   git add .
   git commit -m "TRACE visual rule tests"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. In Vercel, "Add New Project" → import that repo → deploy with default
   settings (static site, no build command needed).

## File structure

```
index.html     four <section> blocks, one per test, each with its own <canvas>
style.css      dark, restrained, monospace — same visual register as the proposal
script.js      shared geometry/projection helpers, then four independent tests
assets/
  concrete-background.png   same background asset used in the proposal PDF
```

## What each test isolates

| Test | Rule tested | Input |
|---|---|---|
| 1. Sigil seed | Law 1 — geometry fixed per instance, one generating rule | click to regenerate |
| 2. Behavior rule | Law 4 — deflection, force increasing row by row | none (pure demonstration) |
| 3. Gesture language | Q06 — drag maps to exactly one parameter (yaw) | horizontal drag |
| 4. Atmosphere constraint | depth fog, opacity driven by real z-distance | checkbox (testing aid only) |
