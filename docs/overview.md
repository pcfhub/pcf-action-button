---
title: Overview
description: A button for canvas apps that raises OnSelect, with an optional two-step confirm.
order: 1
---

# Action Button

A button, for a canvas app. Set its label, optionally give it a glyph, and
handle **OnSelect** in Power Fx — the same property you already reach for on a
built-in button. Turn on **Require confirmation** and the first press asks
instead of acting.

::image{src=media/screenshot-armed.png alt="Action Button armed: a red-outlined button reading Delete permanently?" zoom}

## Why this one

Canvas already has a button, and for most screens it is the right answer. This
one exists for the case the built-in button does not cover: **a destructive
action that should be confirmed without a dialog.**

The usual workaround is a context variable, a second button and a
`Visible` formula on both — five moving parts a maintainer has to read as one
idea. Here the confirmation is the button. The first press swaps the label to
whatever you wrote, turns it red, and announces itself to a screen reader; the
second press raises `OnSelect`. It reverts on its own after four seconds, on
Escape, and when focus leaves — so a confirmation nobody completed is never left
sitting armed for the next stray click.

Two other things it does that a plain button does not:

- **It reports every press, not just distinct ones.** `PressCount` increases on
  each action, so a maker handling `OnChange` sees the second identical press as
  well as the first. A button that reports only "what happened" and not "how many
  times" appears to work once.
- **It asks for nothing at install.** No `feature-usage` entries, so no
  permission prompt: it reads the app's theme, its own properties and the user's
  language, and raises an event.

## This is a canvas control

It binds no column, and that is the design — a button reports that somebody
pressed it, it does not read or write a value. A model-driven form hosts a code
component *on a column* and has no Power Fx to bind an event to, so there is no
sensible way to place this on a form. **The form-side answer to "I want a
button" is a command-bar button**, which is a different tool and a better one for
that job.

There is deliberately no *Model-driven apps* page for this control.
