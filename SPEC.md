# Action Button

A button for canvas apps that raises OnSelect, with an optional two-step confirm.

This is the first control in the catalogue to declare an **event**, the first
field-shaped one with **no bound property**, and the first field control with a
**real timer**. Most of what follows is about those three.

## What the build disagreed with

**`<event>` and `<common-event>` are two elements, and the tooling enforces it.**
Read out of the installed `pcf-scripts@1.51.1` before a line was written, because
the documentation does not say it plainly:

- `ManifestSchema.json` declares `eventAttribs` (`name`, `display-name-key`,
  `description-key`, `pfx-default-value`, `hidden`) and `commonEventAttribs`,
  which accepts **only** `name` — an enum of exactly `OnSelect` and `OnChange` —
  and `pfx-default-value`. No display or description keys on a common event, so
  it contributes nothing to the hub's API reference.
- `manifestSchemaValidator.js`'s `validateEventNodes` rejects a custom `<event>`
  named `OnSelect` or `OnChange`, case-insensitively: *"is a reserved system
  event name, use common-event instead"*.
- Every attribute bag is `additionalProperties: false` and
  `treatValidationErrorsAsWarnings` is `"off"`, so a misspelled attribute fails
  the build rather than being ignored. That is the good news: this surface tells
  you when you are wrong.
- The whole feature is gated on the flag `pcfAllowEvents`, which is `"on"` in
  `pcf-scripts`' own `featureflags.json`. A future version shipping it off would
  stop this manifest building, and the message would say so.

**`refreshTypes` emits nothing at all for an event.** `manifestTypesGenerator.js`
reads only `type-group`, `property` and `data-set`, so `ManifestTypes.d.ts`
carries no `events` member and nothing checks a call against the manifest. It
compiles anyway: `@types/powerapps-component-framework@1.3.18` declares
`Context<TInputs, TEvents = IEventBag>` with **non-optional** `events`, so
`context.events.OnSelect()` type-checks whether or not the manifest declares it —
and would type-check just as happily if it were spelled `OnSelct`.

**`pfx-default-value` is a Power Fx expression, not a value.** The attribute has
to be delimited with `'` so the formula can keep its own `"`:
`pfx-default-value='"Submit"'`. Written `pfx-default-value="Submit"` the formula
is the *identifier* `Submit`, which resolves to nothing.

**The hub’s validator accepted it, once.** One `npm run check` run reached
pcfhub.dev and returned no errors; a later run timed out and fell back to the
structural checks with a warning, which is what that check does when offline. So
the hub has no objection to a `<common-event>` on the evidence of a single
round trip — enough to write the docs against, not enough to call settled.

## Platform behaviour worth knowing

**A `getOutputs()` that reports only *what* happened reports nothing on a
repeat.** `OnChange` fires when an output changes, not when the control writes
one, so two consecutive confirmed presses both setting `lastAction: "confirm"`
are one event and one silence. `pressCount` exists solely to make the repeat
observable, and it increments only inside `raise()` — the press that *arms* a
confirmation is not an action and does not count.

This is the same family as `pcf-star-rating`'s `?? undefined` clear, and a
canvas-only control meets it on hard mode: a model-driven form is forgiving about
an unobservable output, and canvas is not. Both outputs here start at a
non-nullable value and are only ever assigned one, so `?? undefined` never
becomes the edit that quiets `tsc`.

**`context.mode.isControlDisabled` is the whole disabled story for a control with
no bound column.** There is no `security` to consult, because there is no column
to secure. Saying so is better than carrying the scaffold's field-level-security
branch and leaving a reader to work out which half applies.

**One `export` per entry file.** `pcf-scripts`' `sourceCodeValidator.js` counts
`export` modifiers on top-level nodes of `index.ts` and fails at two. Everything
beside the control class — `asBoolean`, `createIcon`, the icon table — is
module-private for that reason rather than by preference.

**`Send16Regular` carries `flipInRtl: true` and `Delete16Regular` does not**, read
from `@fluentui/react-icons` rather than guessed. An arrow points the way the
text runs; a bin has no handedness. Both glyphs are taken at the 16px cut rather
than the 20px one scaled down, because Fluent redraws each size.

## The dev rig

Three changes were made here and **promoted to `_template/dev/host.js` in the
same change**, because none of them is specific to this control:

1. **An `events` option** — an array of names the host binds, or `null` for a
   host that publishes no bag at all. The refusal is the case worth having: the
   platform types make `context.events` non-optional, so nothing will ever force
   a control to guard it, and a manifest declaration is a claim about the schema
   rather than about the runtime.
2. **`calls` and `log()` replacing the ad-hoc `tracked` array**, in the dataset
   rig's format (`trackContainerResize(true)`, `events.OnSelect`). The two rigs
   now read the same, and `_template`'s own `smoke.js` and `harness.js` were
   updated with it.
3. **An operand-order bug in `createContext`.**
   `Object.assign(parameters, { value, placeholder })` put the literals *last*,
   so they silently overwrote anything a caller passed in `options.inputs` — a
   control with its own `placeholder` input could not be tested with a different
   placeholder, and nothing said so. Upstream the operands are reversed; here the
   bound pair is deleted outright, because this control binds nothing and a stub
   that hands it a `value` would be more capable than the platform.

**This is the first field control whose teardown assertion is not trivial.** An
armed confirmation holds a four-second `setTimeout`; `dev/smoke.js` asserts that
the timer exists while armed and is gone after `destroy()`, and it fails if that
line is removed.

**The live region is asserted on its writes, not on its contents.** A region
announces a *change*, so the control blanks it before every announcement — and
`dev/dom.js` records only the final value, where a blank followed by a repeated
message is indistinguishable from one write that changed nothing. The suite
installs a recording accessor over `textContent`. That is the only honest way to
test a live region outside a browser.

## Demo

`fidelity: "limited"`. Everything a visitor touches is real — the label, the
glyph, the confirm swap, the timeout, Escape, the outputs. Two things are not:
`OnSelect` reaches no Power Fx, because there is no app behind the demo; and it
is not known whether the harness supplies a `context.events` bag at all, so a
press there may be exercising the fallback rather than the event path. Both are
written into `demo.limitations`.

Moving to `full` needs an answer to the second one, which is a question about the
hub rather than about this control.

## Not verified

**That `context.events.OnSelect` is populated at runtime for a
`<common-event>`.** This is the control's headline feature and nothing on this
machine can prove it. The schema proves the manifest compiles; the type
definitions promise a bag unconditionally, which is a promise about types. The
control therefore feature-detects and always writes its outputs first, so a host
that binds nothing still produces a working button.

*What would prove it:* import the managed solution, put the control on a canvas
screen, set `OnSelect = Notify("hit", NotificationType.Information)` and press.
A notification proves the bag is populated. Then clear `OnSelect`, set
`OnChange = Notify(Self.PressCount)` and press twice — two notifications with
different numbers prove the fallback *and* prove that `pressCount` is what makes
a repeat observable.

*If the first fails:* put `Self.PressCount` in a label on the same screen. If it
updates and `OnSelect` never fires, the `<common-event>` is decorative here,
which would be a `docs/limitations.md` entry and possibly a
`<common-event name="OnChange" />` after all.

**That `pfx-default-value='"Submit"'` behaves as the quoting rule says** in the
canvas properties pane, and that it beats `default-value`.

**That msbuild packs and Dataverse imports a solution whose manifest carries a
`<common-event>`.** Nothing before the pack exercises that element.

**That every Power Fx snippet in `docs/` runs.** Nothing in the pipeline reads a
fenced code block — `pcf-date-range-picker/SPEC.md` records a formula that was
wrong for a release. Every snippet in `canvas.md`, `examples.md` and `faq.md`
must be pasted into a real app before the tag.

**That the control appears at all in a model-driven context.** It should not, and
the docs say it does not, but nobody has tried to add it to a form to see what
the maker experience of that refusal looks like.

## Promoting a finding

The skill's `references/control-patterns.md` has **no events section**. These
belong in one:

- `<event>` versus `<common-event>`, the reserved names, and the `pcfAllowEvents`
  flag.
- `refreshTypes` emitting nothing for events, and `context.events` being
  non-optional — so the guard is written against the type rather than with it.
- `pfx-default-value`'s quoting rule and its precedence over `default-value`.
- The outputs-and-event double channel, and the double-fire hazard it buys.
- `pressCount`: why a control with outputs needs a counter, not just a state.

And one for *Standard controls*: **one `export` per entry file**.
