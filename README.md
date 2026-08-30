# Action Button

A button for canvas apps that raises OnSelect, with an optional two-step confirm.

[![Build](https://github.com/pcfhub/pcf-action-button/actions/workflows/build.yml/badge.svg)](https://github.com/pcfhub/pcf-action-button/actions/workflows/build.yml)
[![Release](https://github.com/pcfhub/pcf-action-button/actions/workflows/release.yml/badge.svg)](https://github.com/pcfhub/pcf-action-button/actions/workflows/release.yml)

Documentation lives on [PCFHub](https://pcfhub.dev/components/pcf-action-button), built
from the `docs/` directory in this repository. Edit the Markdown here; the hub
recompiles it.


## What it does

A button for a canvas app: a label, optionally a glyph, and `OnSelect` in Power
Fx. Turn on **Require confirmation** and the first press asks instead of acting.

Canvas already has a button, and for most screens it is the right answer. This
one is for the case it does not cover — **a destructive action that should be
confirmed without a dialog.** The usual workaround is a context variable, a
second button and a `Visible` formula on both; here the confirmation is the
button. The first press swaps the label, turns it red and announces itself; the
second raises the event. It reverts on a four-second timer, on Escape, and when
focus leaves, so a confirmation nobody completed is never left armed for the next
stray click.

Three decisions are worth knowing.

**It binds no column, so it is canvas-only.** A button reports that somebody
pressed it — it does not read or write a value. A model-driven form hosts a code
component *on a column* and has no Power Fx to bind an event to, so
`docs/model-driven.md` does not exist and the overview says why. The form-side
answer to "I want a button" is a command-bar button.

**Every press reaches the maker twice, on purpose.** `raise()` writes the output
properties and calls `notifyOutputChanged()`, and *then* raises `OnSelect` if
the host bound one. Not one or the other: a maker who wired `OnSelect` gets it,
a maker who wired `OnChange` on `PressCount` gets it, and a host that populates
no events bag is indistinguishable from one that does. The cost is stated in the
docs — wiring both runs the action twice.

**`PressCount` exists because `OnChange` fires on a change, not on a write.**
Two consecutive confirmed presses both reporting `"confirm"` would be one event
and one silence, and the maker would see a button that works once. The counter
makes the repeat observable. It is the same class of bug as `pcf-star-rating`'s
`?? undefined` clear, and this control gets the strict host by default.

## Properties

| Property | Type | Usage | Default | What it controls |
| --- | --- | --- | --- | --- |
| `label` | SingleLine.Text | input | `Submit` | The button's text, and its accessible name |
| `confirmRequired` | TwoOptions | input | `false` | Whether the first press asks instead of acting |
| `confirmLabel` | SingleLine.Text | input | *(empty)* | What it says once armed; empty uses the localised default |
| `icon` | Enum: `none` \| `send` \| `delete` | input | `none` | An optional glyph before the label |
| `pressCount` | Whole.None | output | `0` | How many times the button has acted |
| `lastAction` | SingleLine.Text | output | *(empty)* | `press` or `confirm` |

**No bound properties**, and that is what makes the control canvas-only.

`label` also carries `pfx-default-value='"Submit"'` — a Power Fx *expression*,
not a value, which is why the attribute is delimited with single quotes so the
formula keeps its own `"`. Written `pfx-default-value="Submit"` the formula
would be the identifier `Submit`, which resolves to nothing. Where a host reads
it, it beats `default-value`; the two are kept in step by hand.

**One event: `<common-event name="OnSelect" />`.** `pcf-scripts` reserves the
names `OnSelect` and `OnChange` for `<common-event>` and rejects a custom
`<event>` using either, so this is the element the manifest needs. `OnChange` is
not declared — it is implicit for a component with outputs.

**No `<feature-usage>`**, so a maker installing this is prompted for nothing.
Strings ship in five languages — 1033 English, 3082 Spanish, 1036 French, 1031
German, 1041 Japanese. The control bundles no framework: it is a `standard`
control writing DOM and inline SVG, and it reads Fluent's design tokens through
`var()` with literal fallbacks — which matter more here than usual, because a
canvas app publishes no tokens at all.

## On the hub

`demo.fidelity` is **`limited`**, and the reason is the one thing the harness
cannot be: an app.

Everything a visitor touches is real — the label, the glyph, the two-step
confirm, the timeout, Escape, the output properties. What is missing is the far
side: `OnSelect` reaches no Power Fx, because there is no formula behind the
demo. And it is not known whether the hub's harness supplies a `context.events`
bag at all, which means a press there may be exercising the control's fallback
path rather than its event path. Both are stated in `demo.limitations` rather
than left for a visitor to wonder about.

Four presets: **A plain button**, **Two-step delete** (press once and wait to see
it revert), **With a glyph**, and **A long label, confirmed**, which is the one
that shows the button wrapping instead of overflowing and holding its size
between the two labels. Every input property is set in every preset — a manifest
`default-value` reaches the harness as the raw XML string, and
`Boolean("false")` is `true`.

## Install

Download the managed solution from the
[latest release](https://github.com/pcfhub/pcf-action-button/releases/latest), or from
the component's page on the hub, and import it into your environment.

## Develop

```bash
npm install
npm start          # the PCF test harness
npm run build
npm run lint
npm run check      # what CI runs first: placeholders, pcfhub.json, control shape
npm run smoke      # assertions against the built bundle — see dev/
npm run harness    # serves dev/harness.html and opens it
```

`npm start` renders the control; `dev/` is for the states it cannot reach. Build
first, then `npm run smoke` for the assertions, or `npm run harness` for the
switches — field-level security, a failed business rule, a host that publishes
no theme or no column metadata, and for a dataset control, more than one page.
Both read the bundle `npm run build` wrote, and both are described in the header
of `dev/smoke.js`.

`npm run harness` serves the repository over `http://` rather than leaving you to
open the file: over `file://` a dataset fixture cannot be fetched and a module
script is refused, and both arrive as an empty control with a CORS error. It
takes `--port` and `--no-open`, and needs no dependency — `dev/serve.js` is
`node:http`. A React (virtual) control has no harness page, and the script says
so rather than serving a 404.

Run `npm run refreshTypes` after every manifest edit — until you do,
`context.parameters` is typed from the old manifest and `tsc` will accept code that
cannot work.

To pack the solution locally you need msbuild — either Visual Studio or the
Visual Studio Build Tools:

```bash
cd Solution
msbuild /t:build /restore /p:configuration=Release
```

Both zips land in `Solution/bin/Release`. This is the only local step that compiles
in **production** mode, so a green `npm run build` is not evidence the shipping
bundle compiles — and the pack is incremental, so delete `obj/`, `out/`,
`Solution/obj/` and `Solution/bin/` first if you intend to quote a bundle size from
it.

## Release

1. Bump the version in **three** places, in one commit — they are checked
   against each other in CI:
   - `ActionButton/ControlManifest.Input.xml` → `<control version="…">`
   - `Solution/src/Other/Solution.xml` → `<Version>`
   - `package.json` → `"version"`
2. Tag it: `git tag v1.2.3 && git push --tags`

The release workflow builds, packs both solution types, and attaches them to a
GitHub Release. PCFHub picks the release up from its webhook within seconds, or
from the hourly sweep otherwise. A sync imports a draft; a person publishes it.

## Repository layout

| Path | What it is |
| --- | --- |
| `ActionButton/` | The control: manifest, entry point, CSS, localised strings |
| `Solution/` | The Dataverse solution that packages it |
| `dev/` | A stand-in host: `npm run smoke` asserts, `harness.html` shows |
| `SPEC.md` | What building this corrected, and what is verified versus read |
| `docs/` | The pages PCFHub publishes — see the comments in each file |
| `media/` | Images and video referenced from the docs |
| `pcfhub.json` | The hub's manifest: identity, links, docs path, demo |
| `scripts/` | Template setup and the CI guard that keeps it adopted |

## Licence

[MIT](LICENSE)
