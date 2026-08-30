---
title: API reference
description: Properties, outputs and events, generated from the control manifest.
order: 5
---

# API reference

<!--
  Do not write the property tables by hand. `props-table` renders from what the
  hub parsed out of ControlManifest.Input.xml at the release being viewed, so it
  cannot drift from the control.
-->

## Input properties

::props-table{kind=input}

## Outputs

::props-table{kind=output}

## Events

The control declares one event, `OnSelect`, as a `<common-event>` — the same
name a built-in canvas button uses, so it appears where a maker already looks
for it.

It is raised on the press that acts: once for a plain button, and on the *second*
press of a confirmation. The press that arms a confirmation raises nothing.

`OnSelect` and the output properties are two views of the same press rather than
alternatives — every action writes `PressCount` and `LastAction`, announces the
change, and then raises the event. Handling both means the action runs twice; see
*Canvas apps*.

## Notes

**There are no bound properties.** A button reports that somebody pressed it; it
does not read or write a column. That is also why there is no *Model-driven apps*
page — see *Overview*.

**Label is the accessible name.** The control sets no `aria-label`, so what the
button says is what a screen reader reads. When a confirmation is armed, the
accessible name is the **Confirmation label**, which is what makes the
confirmation audible as well as visible.

**The accepted `Icon` values** are `none`, `send` and `delete`. Two glyphs and
an off switch is the whole set, deliberately — an icon that does not name the
action is decoration, and only you know what your button does. Anything else
belongs in the label, as words.
