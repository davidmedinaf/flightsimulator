# Procedure Trainer (proof of concept)

A tablet-friendly web app for practising a flight deck procedure for a 737 MAX flight simulator. It shows a schematic of the forward overhead panel that can be operated: switches move when tapped and the lights respond.

> Simulator training aid only. Not a certified aviation procedure system. Follow approved training materials and instructor guidance.

The app is not connected to a simulator. Its panel is a practice panel with simplified behaviour; it cannot see the state of any real switch or indication.

## What the POC covers

One procedure: the forward overhead panel part of *Preflight Procedure – PF*, from "Flight control panel … Check" to "ENGINE START switches … OFF" (FCOM NP.21.22 – NP.21.26, PDF pages 160 – 164).

It can be worked through in two ways:

- **Step by step.** The 91 steps of the manual one at a time, in its order and wording. The steps of the current sub-panel are listed on the right, and any step can be opened directly, from that list or from **All steps**.
- **Practice.** The same procedure as 12 sub-panels. Each shows the actions to perform and the checks to make, grouped; lights that must show the same state are one line. Only the controls of one line are highlighted at a time: the line tapped on the right, or else the next open one.

84 steps highlight controls on the panel. 7 are text-only: six refer to items that are not on the forward overhead panel (fuel quantity, brake pressure, MFD SYSTEM switch, system A and B pressure, hydraulic quantity, accumulator pressure indicator) and one is an information note.

### The practice panel

- 66 switches and selectors can be operated. A tap moves a switch to its next position.
- Guarded switches: only the guard opens and closes.
- Lights have three states: extinguished, illuminated dim and illuminated.
- 64 steps are verified against the panel. An action counts as done when the panel shows it; a check can only be ticked when the panel really shows what it asks for.
- The panel starts as the reference photo shows it, with the yaw damper, fuel pumps, window heat, electric hydraulic pumps, packs and similar still to be set.

Light behaviour is a simplification for an airplane on the ground with electrical power and both engines shut down. Each rule and its source are written in `src/data/panels/fwd-overhead.schematic.ts` and shown under the **i** button of the steps that rely on it.

## Run it locally

Requires Node.js 22.18 or later.

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
| `npm run check:data` | Validates the data and dry-runs the procedure on the practice panel |

A link can open the app at a given place: `#guided/<step id>` or `#practice/<section id>`.

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
public/panels/                        reference photo of the panel
src/data/panels/*.controls.json       where each control is, measured on the photo
src/data/panels/*.schematic.ts        the schematic drawing, switch positions and light rules
src/data/procedures/*.json            the steps of each procedure and its practice sections
src/data/index.ts                     registry of panels and procedures
src/engine.ts                         step navigation (next, previous, jump, branching, saved progress)
src/sim.ts                            practice panel state: switch positions, derived lights
src/practice.ts                       builds the grouped practice sections from the steps
src/components/                       schematic, panel view, step and practice panes, mapping review
scripts/check-data.mjs                data validation
```

Procedure text, panel drawing, control coordinates, panel behaviour and navigation logic are separate, so procedures and panels can be added without touching the app code.

### Control coordinates

Each control is a rectangle `[x, y, width, height]`, normalised from 0 to 1 against the reference photo. The schematic is drawn in the same coordinate space and takes the position of every control a step refers to from these rectangles; highlights are drawn in an overlay on top.

The **Mapping review** screen (from the home screen) draws every mapped rectangle on the schematic or on the photo. Tap a box to see what it is meant to mark. To correct a position, edit its `rect` in the controls file.

### Steps

Add a JSON file in `src/data/procedures/` and list it in `src/data/index.ts`. Each step has:

| Field | Meaning |
|---|---|
| `id` | Unique within the procedure |
| `type` | `section`, `action`, `check`, `note` or `choice` |
| `level`, `group` | Indentation in the source and the heading the step belongs to |
| `title`, `target` | Item name and required position or condition, in the source's wording |
| `body`, `bullets`, `notes` | Extra source text, notes and cautions |
| `controls` | Ids of the controls to highlight |
| `expect` | What the practice panel must show: switch id → position, light id → `off`, `dim` or `on`, guarded switch id → `closed` |
| `when` | The expectation only applies while these switches are in these positions |
| `short` | Name used when several checks are merged into one practice line |
| `textOnly` | `off-panel` or `info`, for steps with nothing to highlight |
| `pdfPage`, `ref` | Source reference |
| `next`, `choices` | Optional branching (see below) |

Steps run in list order. For a branch, give a step `"type": "choice"` and a `choices` list of `{ "label", "next" }`; each branch then rejoins the main path with an explicit `next`. Previous always retraces the path the student actually took. The current procedure is linear and uses neither field.

### Practice sections

`practice` in the procedure file lists the sub-panels and the steps each covers. By default the lines of a section are built from its steps:

- every action is one line;
- checks whose lights must all be extinguished, all illuminated dim or all illuminated are merged into one line each;
- a switch whose only requirement is a closed guard is listed as a check;
- notes and cautions stay with their line.

A section can instead spell out its `initial` state, `actions` and `checks` by hand, each line naming the steps it stands for. The flight control panel does, using the instructor's wording.

### Adding a panel

Create `<panel-id>.controls.json` and `<panel-id>.schematic.ts` next to the existing ones and register the panel in `src/data/index.ts`. A step on that panel sets `"panel": "<panel-id>"`.

## Known limitations

- **Simplified panel behaviour.** Lights follow the switches directly. Momentary and in-transit indications, failures, and anything that depends on engines, APU or flight phase are not modelled. Lights that the procedure does not check stay extinguished.
- **Decoration.** Parts of the panel the procedure does not use (electrical meters, generators, door lights, voice recorder and others) are drawn approximately and cannot be operated.
- **Initial state.** Taken from the reference photo where it could be read; CAB/UTIL, IFE/PASS SEAT and TRIM AIR start OFF by assumption.
- **Grouping rules.** Only the flight control panel follows instructor-written rules. The other sub-panels use the default grouping until their rules are supplied.
- **Mapping not yet confirmed by an instructor.** Positions were measured on the photo and checked visually against it and against the FCOM panel diagrams.
- **Wing anti-ice lights.** The photo shows a third, unlabelled light block above R VALVE that is not in the FCOM diagram. The lower pair was taken as L VALVE / R VALVE. This is flagged in the app.
- **Six off-panel steps are text-only** until drawings of those panels are added.
- **No simulator connection, accounts or backend.** Progress is remembered only in the browser it was made in.

## Source material and sharing

The step text is excerpted from the 737 Flight Crew Operations Manual, which is marked Boeing Proprietary. Only the excerpts needed for this exercise are included; the manual itself is not in this repository and must not be added to it. The publication of these excerpts was accepted for this proof of concept only and has to be reviewed before the app is offered as a public product.
