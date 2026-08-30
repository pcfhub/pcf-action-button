---
title: Examples
description: Three complete configurations, with the Power Fx behind them.
order: 6
---

# Examples

## Submit a form

The plain case: one press, one action.

| Property | Value |
| --- | --- |
| Label | `"Submit expenses"` |
| Require confirmation | `false` |
| Confirmation label | *(empty)* |
| Icon | `Send` |

```powerfx
SubmitForm(ExpenseForm)
```

## Delete, with a confirmation

The reason this control exists. The first press asks; nothing happens until the
second.

| Property | Value |
| --- | --- |
| Label | `"Delete record"` |
| Require confirmation | `true` |
| Confirmation label | `"Delete permanently?"` |
| Icon | `Delete` |

```powerfx
Remove(Expenses, Gallery1.Selected);
Notify("Deleted", NotificationType.Success)
```

Nothing in the formula mentions the confirmation — `OnSelect` runs only on the
press that acts, so the two-step behaviour costs the maker nothing to handle.

## One row of a gallery

Inside a gallery, each row gets its own instance and its own count.

| Property | Value |
| --- | --- |
| Label | `"Approve"` |
| Require confirmation | `true` |
| Confirmation label | `"Approve " & ThisItem.Title & "?"` |
| Icon | `None` |

```powerfx
Patch(Expenses, ThisItem, { Status: "Approved" })
```

The confirmation label is a formula like any other property, so it can name the
record the user is about to act on — which is the difference between "Are you
sure?" and a question somebody can actually answer.

## Reacting without OnSelect

If you would rather drive everything from state, handle `OnChange` and read the
outputs. Do not do both — see the warning in *Canvas apps*.

```powerfx
If(
    Self.LastAction = "confirm",
    Remove(Expenses, Gallery1.Selected)
)
```
