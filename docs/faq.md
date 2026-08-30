---
title: FAQ
description: Questions this control has actually been asked.
order: 8
---

# FAQ

## Can I use it on a model-driven form?

No. It binds no column, and a model-driven form hosts a code component on one.
Use a command-bar button, which is the tool that job already has.

## My action runs twice. Why?

You have wired both `OnSelect` and `OnChange`. Every press writes the output
properties *and* raises the event, so handling both runs your formula twice.
Remove one — keep `OnSelect` unless you have a reason not to.

## `OnSelect` does nothing. What now?

Handle `OnChange` instead and read `Self.LastAction`:

```powerfx
If(Self.LastAction = "confirm" || Self.LastAction = "press", DoTheThing())
```

Every press writes the outputs whether or not the host binds the event, so this
path always works. If you find that `OnSelect` never fires in your environment,
please [open an issue](https://github.com/pcfhub/pcf-action-button/issues) and
say which environment — that is a thing we would like to know.

## Why does nothing happen the first time I press it?

**Require confirmation** is on. The first press arms the button and changes its
label; the second acts.

## Can I change how long the confirmation waits?

No — it is four seconds and it is not a property. See *Limitations* for why.

## Can I have my own icon?

No. There are two glyphs and an off switch. Put what the button does in the
label, in words: it is what a screen reader reads anyway, and it is the only part
of the button that can say what your action actually is.

## Does it need any permissions?

No. The control declares no `feature-usage`, so importing it prompts for nothing.
It reads the app's theme, its own properties and the user's language.

## Is it accessible?

The button is a real `<button>` with its label as its accessible name, so it is
in the tab order and works from the keyboard with no extra wiring. Arming a
confirmation changes that name — which a screen reader announces, because focus
is on the button — and is also announced through a polite live region. Escape
cancels. Under High Contrast the armed state is redrawn with a dashed border,
since the colour is gone.

## Where do I report a problem?

[github.com/pcfhub/pcf-action-button/issues](https://github.com/pcfhub/pcf-action-button/issues).
