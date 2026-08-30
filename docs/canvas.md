---
title: Canvas apps
description: Adding Action Button to a canvas app or custom page, and handling its event.
order: 3
---

# Using it in a canvas app

:::steps
1. From **Insert → Get more components**, open the **Code** tab and import
   **Action Button**.
2. Place it from **Insert → Code components**.
3. Set **Label**, and write a formula in **OnSelect**.
:::

## Handling the press

`OnSelect` is the property you already use on a built-in button, and it works the
same way here:

```powerfx
Remove(Expenses, ThisItem);
Notify("Expense removed", NotificationType.Success)
```

## Confirming first

Set **Require confirmation** to `true` and give a **Confirmation label**. Nothing
else changes: `OnSelect` still runs on the press that acts, and it does not run
on the press that asks.

| Property | Value |
| --- | --- |
| Label | `"Delete record"` |
| Require confirmation | `true` |
| Confirmation label | `"Delete permanently?"` |
| Icon | `Delete` |

The confirmation reverts itself after four seconds, when the user presses
Escape, and when focus leaves the button. There is no property for the timeout,
on purpose — it is a safety revert rather than a setting, and a value nobody can
test from the properties pane is a value that gets set wrong.

## The other way to hear about a press

The control also writes two output properties on every action:

| Output | What it holds |
| --- | --- |
| `PressCount` | How many times the button has acted. Starts at `0`. |
| `LastAction` | `"press"` for a single-press button, `"confirm"` for the second press of a confirmation. |

So `OnChange` is a working alternative to `OnSelect`:

```powerfx
If(Self.LastAction = "confirm", Remove(Expenses, ThisItem))
```

**`PressCount` is why that works twice.** `OnChange` fires when an output
*changes*, not when the control writes one — so two consecutive presses that both
report `"confirm"` would be one event and one silence. The counter increases
every time, which makes the second press a change.

:::callout{type=warning}
**Do not wire both.** If you handle `OnSelect` *and* `OnChange`, a single press
runs both formulas and the action happens twice. Pick one — `OnSelect` unless you
have a reason.
:::

## Sizing and state

The button fills the box you draw, so size the component rather than the button.
Set the component's **DisplayMode** to `DisplayMode.Disabled` to disable it; an
armed confirmation is dropped when that happens, rather than being left waiting.
