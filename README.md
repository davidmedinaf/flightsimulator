# Procedure Trainer (proof of concept)

A tablet-friendly web app that walks a student through a flight deck procedure for a 737 MAX flight simulator. Each step shows the instruction from the manual and, where the control is on the panel photo, highlights it.

> Simulator training aid only. Not a certified aviation procedure system. Follow approved training materials and instructor guidance.

The app is not connected to a simulator. It presents steps; it does not check that any switch or indication is in the stated condition.

## What the POC covers

One procedure: the forward overhead panel part of *Preflight Procedure – PF*, from "Flight control panel … Check" to "ENGINE START switches … OFF" (FCOM NP.21.22 – NP.21.26, PDF pages 160 – 164).

- 91 steps, in the order and wording of the source.
- 84 steps highlight one or more controls on the forward overhead panel photo.
- 7 steps are text-only: six refer to items that are not on the forward overhead panel (fuel quantity, brake pressure, MFD SYSTEM switch, system A and B pressure, hydraulic quantity, accumulator pressure indicator) and one is an information note.

## Run it locally

Requires Node.js 20 or later.

```
npm install
npm run dev
```

`npm run dev` prints a local address and a network address. To try it on a tablet before deploying, open the network address on a tablet connected to the same Wi-Fi.

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Type-checks and builds the static site into `dist/` |
| `npm run preview` | Serves the built site |
| `npm run check:data` | Validates the procedure and panel data files |

## Publish it

The build is a plain static site with relative paths, so it works on any static host.

### GitHub Pages (set up in this repository)

1. On GitHub, open the repository, then **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or open **Actions → Deploy to GitHub Pages → Run workflow**).

The site is then served at `https://<user>.github.io/<repository>/`. Every later push to `main` redeploys it.

### Vercel (alternative)

1. Sign in at vercel.com with the GitHub account.
2. **Add New → Project**, import this repository. Vercel detects Vite; keep the defaults.
3. **Deploy**. Vercel shows the public URL when it finishes.

## How it is organised

```
public/panels/                      panel photos
src/data/panels/*.controls.json     where each control is on a photo
src/data/procedures/*.json          the steps of each procedure
src/data/index.ts                   registry of panels and procedures
src/engine.ts                       step navigation (next, previous, branching, saved progress)
src/components/                     panel view, step card, mapping review
scripts/check-data.mjs              data validation
```

Procedure text, panel photos, control coordinates and navigation logic are separate, so procedures and panels can be added without touching the app code.

### Control coordinates

Each control is a rectangle `[x, y, width, height]`, normalised from 0 to 1 against the panel image. The highlight is drawn in an overlay on top of the photo, which is never edited or stretched.

The **Mapping review** screen (from the home screen) draws every mapped rectangle on the photo. Tap a box to see what it is meant to mark. To correct a position, edit its `rect` in the controls file.

### Adding a procedure

Add a JSON file in `src/data/procedures/` and list it in `src/data/index.ts`. Each step has:

| Field | Meaning |
|---|---|
| `id` | Unique within the procedure |
| `type` | `section`, `action`, `check`, `note` or `choice` |
| `level`, `group` | Indentation in the source and the heading the step belongs to |
| `title`, `target` | Item name and required position or condition, in the source's wording |
| `body`, `bullets`, `notes` | Extra source text, notes and cautions |
| `controls` | Ids of the controls to highlight |
| `textOnly` | `off-panel` or `info`, for steps with nothing to highlight |
| `pdfPage`, `ref` | Source reference |
| `next`, `choices` | Optional branching (see below) |

Steps run in list order. For a branch, give a step `"type": "choice"` and a `choices` list of `{ "label", "next" }`; each branch then rejoins the main path with an explicit `next`. Previous always retraces the path the student actually took. The current procedure is linear and uses neither field.

### Adding a panel

Put the photo in `public/panels/`, create a `<panel-id>.controls.json` next to the existing one, and register the panel in `src/data/index.ts`. A step on that panel sets `"panel": "<panel-id>"`.

## Known limitations

- **Mapping not yet confirmed by an instructor.** Positions were measured on the photo and checked visually against it and against the FCOM panel diagrams.
- **Wing anti-ice lights.** The photo shows a third, unlabelled light block above R VALVE that is not in the FCOM diagram. The lower pair was taken as L VALVE / R VALVE. This is flagged in the app.
- **One photo, one aircraft state.** The photo shows an unpowered flight deck, so lights the procedure expects to be illuminated appear dark.
- **Six off-panel steps are text-only** until photos of those panels are supplied.
- **No simulator connection, accounts or backend.** Progress is remembered only in the browser it was made in.

## Source material and sharing

The step text is excerpted from the 737 Flight Crew Operations Manual, which is marked Boeing Proprietary. Only the excerpts needed for this exercise are included; the manual itself is not in this repository and must not be added to it. The publication of these excerpts was accepted for this proof of concept only and has to be reviewed before the app is offered as a public product.
