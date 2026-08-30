---
title: Limitations
description: What this control does not do, and the constraints it accepts.
order: 7
---

# Limitations

**Canvas apps only.** The control binds no column, so there is nothing to place
it on in a model-driven form. Use a command-bar button there.

**One event, one gesture.** `OnSelect` is raised on the press that acts and
nothing else is raised at all. There is no separate event for a confirmation
being cancelled or timing out — a cancelled confirmation is, from the app's point
of view, a press that never happened. If you need to know about it, you need a
different control.

**Wiring both `OnSelect` and `OnChange` runs your action twice.** The control
writes its outputs *and* raises the event on every press, on purpose: a maker who
uses either one gets a working button, and a host that supplies no event bag is
indistinguishable from one that does. The cost is that using both double-fires.

**The confirmation timeout is fixed at four seconds** and is not a property. It
is a safety revert rather than a setting — short enough that an abandoned
confirmation does not sit armed, long enough to complete by keyboard — and
nothing in the properties pane would let you test a value you typed there.

**`PressCount` never resets.** It counts from `0` for the life of the control
instance. Navigating away from the screen and back creates a new instance, which
starts at `0` again — so it is a change signal, not a running total to store.

**Two glyphs.** `send` and `delete`, or none. Each icon is path data this
repository owns forever, and an icon that does not name the action is decoration.
Anything else belongs in the label.

**No busy or loading state.** The button does not know whether your formula
finished, because Power Fx does not tell it. A long-running action needs the
app's own indicator.

**Under Windows High Contrast**, the armed state loses its red and is drawn with
a dashed border instead. That is deliberate — a confirmation whose only remaining
signal is "this is a button" would be indistinguishable from the state it is
warning about — but it is a different look from the one in the screenshots.
