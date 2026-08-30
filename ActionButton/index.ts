import { IInputs, IOutputs } from './generated/ManifestTypes';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * How long an armed confirmation waits before reverting itself.
 *
 * A constant rather than an input property, and that is a decision rather than
 * an omission. It is a safety revert, not a feature: at 500ms it builds a button
 * a screen-reader or switch user cannot complete, and at 60s it leaves one armed
 * long after the user has moved on, so the next stray click is a confirmed
 * delete. Nothing in the properties pane lets a maker *test* the value they
 * typed, and a setting whose correct value cannot be discovered from the tool
 * that sets it gets set wrong.
 *
 * Four seconds rather than pcf-copy-field's three: three is long enough to read
 * a confirmation and not long enough to read it, decide, and move a pointer.
 */
const CONFIRM_TIMEOUT_MS = 4000;

/**
 * Fluent's own path data, at the 16px cut rather than the 20px one scaled down.
 * Fluent redraws each size instead of scaling, so a 20px glyph in a 16px box has
 * strokes a fifth too thin. Copied from @fluentui/react-icons.
 */
const ICON_PATHS = {
    send: 'M1.18 1.12a.5.5 0 0 1 .54-.07l13 6.5a.5.5 0 0 1 0 .9l-13 6.5a.5.5 0 0 1-.7-.6L2.98 8 1.02 1.65a.5.5 0 0 1 .16-.53M3.87 8.5l-1.55 5.03L13.38 8 2.32 2.47 3.87 7.5H9.5a.5.5 0 0 1 0 1z',
    delete: 'M7 3h2a1 1 0 0 0-2 0M6 3a2 2 0 1 1 4 0h4a.5.5 0 0 1 0 1h-.56l-1.2 8.84A2.5 2.5 0 0 1 9.74 15h-3.5a2.5 2.5 0 0 1-2.48-2.16L2.57 4H2a.5.5 0 0 1 0-1zm1 3.5a.5.5 0 0 0-1 0v5a.5.5 0 0 0 1 0zM9.5 6c.28 0 .5.22.5.5v5a.5.5 0 0 1-1 0v-5c0-.28.22-.5.5-.5m-4.74 6.7c.1.75.74 1.3 1.49 1.3h3.5a1.5 1.5 0 0 0 1.5-1.3L12.42 4H3.57z',
} as const;

/**
 * Which glyphs mirror themselves in a right-to-left app, read from the icons
 * package rather than guessed: `Send16Regular` carries `flipInRtl: true` and
 * `Delete16Regular` does not. An arrow points the way the text runs; a bin does
 * not have a handedness.
 */
const ICON_FLIPS_IN_RTL = { send: true, delete: false } as const;

type IconName = keyof typeof ICON_PATHS;

/**
 * The events this control raises, named rather than left to `IEventBag`.
 *
 * `ComponentFramework.Context` declares `events` as **non-optional**, so the
 * type system will never make anyone guard it — and the generated
 * `ManifestTypes.d.ts` says nothing about events at all, because
 * `manifestTypesGenerator` reads only `type-group`, `property` and `data-set`.
 * So the types agree that `context.events.OnSelect()` compiles, and neither the
 * types nor the manifest is evidence that the platform binds a callable to that
 * name at runtime.
 *
 * Declaring `OnSelect` optional here is how the guard in `raise()` survives a
 * reviewer who notices the platform types say it cannot be missing. See SPEC.md,
 * *Not verified*.
 */
interface ActionButtonEvents {
    OnSelect?: () => void;
}

/**
 * A button, for a canvas app.
 *
 * **It binds no column, and that is why it is canvas-only.** A button does not
 * read or write a value: it reports that somebody pressed it. A model-driven
 * form hosts a code component on a column and has no Power Fx to bind an event
 * to, so the form-side answer to "I want a button" is a command-bar button, and
 * `docs/model-driven.md` does not exist.
 *
 * **Every press reaches the maker twice on purpose.** `raise()` writes the
 * output properties and calls `notifyOutputChanged()`, and then raises
 * `OnSelect` if the host supplied a bag holding one. Not one or the other: a
 * maker who wired `OnSelect` gets it, a maker who wired `OnChange` on
 * `PressCount` gets it, and a host that populates no events bag is
 * indistinguishable from one that does. The cost is a hazard the docs state
 * plainly — a maker who wires both gets the action twice.
 *
 * **`pressCount` exists because `OnChange` fires on a change, not on a write.**
 * Two consecutive confirmed presses both writing `lastAction: "confirm"` are one
 * change and one silence, and the maker sees a button that works once.
 */
export class ActionButton implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container!: HTMLDivElement;
    private button!: HTMLButtonElement;
    private caption!: HTMLSpanElement;
    private status!: HTMLParagraphElement;

    /** Built once in `init` and shown or hidden by class, never rebuilt. */
    private icons!: Record<IconName, Element>;

    private notifyOutputChanged!: () => void;

    /**
     * Re-captured on every render, alongside `events`.
     *
     * A click handler and a timer have no `context` of their own, and holding
     * the first one's `resources` forever is the bug this exists to avoid — the
     * platform hands down a fresh context each pass and the old one is not
     * promised to keep working.
     */
    private resources!: ComponentFramework.Resources;
    private events: ActionButtonEvents | undefined;

    /*
     * The outputs.
     *
     * **Both start at a non-nullable value and are only ever assigned one, and
     * that is load-bearing rather than tidy.** `refreshTypes` generates
     * `pressCount?: number` and `lastAction?: string`, so the moment either can
     * be `null`, `?? undefined` becomes the edit that makes `tsc` go quiet — and
     * `undefined` means *no change*, so the output stops being observable. That
     * is the bug pcf-star-rating shipped. A model-driven form is forgiving about
     * it; canvas is strict, and this control has no other host.
     *
     * Do not "tidy" `''` into `null` here.
     */
    private pressCount = 0;
    private lastAction = '';

    /** Whether a confirmation is waiting for its second press. */
    private armed = false;
    private confirmTimer: number | undefined;

    /* What the click handler needs and cannot read from a context it lacks. */
    private confirmRequired = false;
    private interactive = true;
    private labelText = '';
    private confirmText = '';

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
        this.container = container;
        this.container.classList.add('ActionButton');

        this.button = document.createElement('button');
        this.button.className = 'ActionButton-button';
        /*
         * Explicitly `button`. The default is `submit`, and a code component in
         * a canvas app can sit inside a real form — where a button that was only
         * meant to raise an event posts the form instead.
         */
        this.button.type = 'button';

        this.icons = {
            send: createIcon('send'),
            delete: createIcon('delete'),
        };

        this.caption = document.createElement('span');
        this.caption.className = 'ActionButton-caption';

        /*
         * Both glyphs are appended once and hidden by attribute. Rebuilding them
         * in `updateView` would rebuild them constantly — and the confirmation
         * runs on a timer that `updateView` knows nothing about, so anything the
         * render touches is something the confirmation can lose.
         */
        this.button.append(this.icons.send, this.icons.delete, this.caption);

        this.button.addEventListener('click', this.onClick);
        this.button.addEventListener('blur', this.onBlur);
        this.button.addEventListener('keydown', this.onKeyDown);

        this.status = document.createElement('p');
        this.status.className = 'ActionButton-status';
        /*
         * Polite, and the region is the *second* channel rather than the first.
         * Arming swaps the button's own accessible name from "Submit" to
         * "Delete permanently?", which a screen reader announces on its own
         * because focus is on the button. `assertive` would interrupt the
         * announcement this is here to back up.
         */
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');

        this.container.append(this.button, this.status);

        this.render(context);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.render(context);
    }

    /**
     * Both outputs, every time, and no `??` anywhere in it.
     *
     * `undefined` means "no change" to the platform, so a nullish-coalescing
     * default here would silently stop a press being observable. The guarantee
     * is upheld in the field declarations rather than defended for here.
     */
    public getOutputs(): IOutputs {
        return { pressCount: this.pressCount, lastAction: this.lastAction };
    }

    public destroy(): void {
        /*
         * The timer first. A control removed from a screen mid-confirmation
         * otherwise leaves a `setTimeout` holding a reference to a detached
         * element — the platform does not clean that up, because from its side
         * the control simply stopped being.
         */
        this.clearTimer();

        this.button.removeEventListener('click', this.onClick);
        this.button.removeEventListener('blur', this.onBlur);
        this.button.removeEventListener('keydown', this.onKeyDown);
    }

    private render(context: ComponentFramework.Context<IInputs>): void {
        this.resources = context.resources;
        this.events = (context as ComponentFramework.Context<IInputs, ActionButtonEvents>).events;

        this.applyTheme(context);

        // Canvas relies on this; nothing else hides a code component for it.
        const visible = context.mode.isVisible;
        this.container.classList.toggle('ActionButton--hidden', !visible);

        if (!visible) {
            this.disarm(false);
            return;
        }

        /*
         * One reason to be inert, not two. There is no bound column, so there is
         * no field-level security to consult — `mode.isControlDisabled` is what
         * a canvas app's `DisplayMode.Disabled` arrives as, and it is the whole
         * story. Saying so is better than carrying the scaffold's `security`
         * branch and leaving a reader to wonder which one applies.
         */
        this.interactive = !context.mode.isControlDisabled;
        this.button.disabled = !this.interactive;
        this.container.classList.toggle('ActionButton--disabled', !this.interactive);

        this.confirmRequired = asBoolean(context.parameters.confirmRequired.raw, false);

        /*
         * Disarming lives here rather than in the click handler, so every way of
         * taking the confirmation away — the maker switching it off, the app
         * disabling the control, the screen hiding it — is handled once. That is
         * what makes "armed while confirm is off" unreachable rather than
         * defended against.
         */
        if (!this.confirmRequired || !this.interactive) {
            this.disarm(false);
        }

        const label = context.parameters.label.raw ?? '';
        this.labelText = label !== '' ? label : this.resources.getString('ActionButton_DefaultLabel');

        const confirmLabel = context.parameters.confirmLabel.raw ?? '';
        this.confirmText =
            confirmLabel !== '' ? confirmLabel : this.resources.getString('ActionButton_Confirm');

        this.applyIcon(context.parameters.icon.raw);
        this.paint();

        /*
         * `dir` on the control's own root rather than a class, so a nested
         * element can be selected with `[dir="rtl"]` from the stylesheet without
         * knowing how far up the ancestor is.
         */
        this.container.dir = context.userSettings.isRTL ? 'rtl' : 'ltr';
    }

    /**
     * Picks which set of colour fallbacks the stylesheet uses.
     *
     * Only the fallbacks. The stylesheet reads Fluent's design tokens through
     * `var()`, so on a host that publishes them this changes nothing at all.
     * It matters where nothing does — which for a canvas-only control is most
     * of the time, and includes PCFHub's demo harness.
     *
     * `@media (prefers-color-scheme: dark)` is the obvious hook and it asks the
     * wrong question: an app carries its own theme and the operating system's
     * setting says nothing about it. Absent means absent — no class, light
     * fallbacks, the same guess the host made by not saying.
     */
    private applyTheme(context: ComponentFramework.Context<IInputs>): void {
        const isDarkTheme = context.fluentDesignLanguage?.isDarkTheme;

        if (isDarkTheme === undefined) {
            return;
        }

        this.container.classList.toggle('ActionButton--dark', isDarkTheme);
    }

    private applyIcon(raw: string | null): void {
        const name: IconName | null = raw === 'send' || raw === 'delete' ? raw : null;

        (Object.keys(this.icons) as IconName[]).forEach((key) => {
            const icon = this.icons[key];

            if (key === name) {
                icon.removeAttribute('hidden');
            } else {
                // The attribute, plus a `[hidden]` rule in the stylesheet: an
                // author `display` on the glyph beats the user-agent one.
                icon.setAttribute('hidden', 'hidden');
            }
        });

        this.container.classList.toggle('ActionButton--has-icon', name !== null);
    }

    /** The button's text, which is also its accessible name. */
    private paint(): void {
        /*
         * No `aria-label`. The button says what it does in words, so a label
         * would be a second name that can disagree with the first — and when it
         * is armed, the visible text and the announced text have to be the same
         * sentence or the confirmation means two different things depending on
         * how you are reading it.
         */
        this.caption.textContent = this.armed ? this.confirmText : this.labelText;
        this.container.classList.toggle('ActionButton--armed', this.armed);
    }

    private onClick = (): void => {
        /*
         * Guarded here rather than trusted to `button.disabled`. A disabled
         * button does not fire a click in a browser, but the control should not
         * depend on that: `dev/dom.js` dispatches whatever it is handed, and a
         * control whose safety rests on the DOM refusing is one nothing can
         * assert.
         */
        if (!this.interactive) {
            return;
        }

        if (this.confirmRequired && !this.armed) {
            this.arm();
            return;
        }

        this.clearTimer();
        this.armed = false;
        this.paint();

        this.raise(this.confirmRequired ? 'confirm' : 'press');
    };

    /**
     * Leaving the button abandons the confirmation, silently.
     *
     * Silently because the user is already somewhere else: a live region firing
     * after focus has moved describes a control the user is no longer looking
     * at. Escape is the deliberate cancel and it does announce.
     */
    private onBlur = (): void => {
        this.disarm(false);
    };

    private onKeyDown = (event: Event): void => {
        if (!this.armed || (event as KeyboardEvent).key !== 'Escape') {
            return;
        }

        if (typeof event.preventDefault === 'function') {
            event.preventDefault();
        }

        this.disarm(true);
    };

    private arm(): void {
        this.armed = true;
        this.paint();
        this.announce('ActionButton_Armed');

        this.confirmTimer = window.setTimeout(() => {
            this.confirmTimer = undefined;
            this.disarm(true, 'ActionButton_TimedOut');
        }, CONFIRM_TIMEOUT_MS);
    }

    private disarm(announce: boolean, key = 'ActionButton_Cancelled'): void {
        this.clearTimer();

        if (!this.armed) {
            return;
        }

        this.armed = false;
        this.paint();

        if (announce) {
            this.announce(key);
        }
    }

    /**
     * Write the outputs, tell the platform, then raise the event.
     *
     * In that order, because the handler is the maker's Power Fx: a formula that
     * throws must not take the outputs down with it, and a maker relying on
     * `OnChange` should see the press whatever `OnSelect` does.
     */
    private raise(action: 'press' | 'confirm'): void {
        this.pressCount += 1;
        this.lastAction = action;
        this.notifyOutputChanged();

        const events = this.events;

        if (events === undefined || typeof events.OnSelect !== 'function') {
            return;
        }

        try {
            /*
             * Called as a member, never through a saved reference. `const raise
             * = events.OnSelect; raise();` drops `this`, and the bag is a
             * platform object whose implementation is not visible from here.
             */
            events.OnSelect();
        } catch (error) {
            // The maker's formula threw. Their problem to fix, and not a reason
            // for this control to stop working — but silence would leave them
            // with a button that half-works and no clue why.
            console.error('ActionButton: the OnSelect handler threw.', error);
        }
    }

    /**
     * Blanked before it is set, so a repeat announces.
     *
     * A live region announces a *change* to its contents, so writing the same
     * string twice is silent — and two identical confirmations in a row is
     * exactly what this control produces. The region is emptied rather than
     * hidden for the same family of reason: one removed from the accessibility
     * tree between announcements is one some screen readers stop watching.
     */
    private announce(key: string): void {
        this.status.textContent = '';
        this.status.textContent = this.resources.getString(key);
    }

    private clearTimer(): void {
        if (this.confirmTimer !== undefined) {
            window.clearTimeout(this.confirmTimer);
            this.confirmTimer = undefined;
        }
    }
}

/**
 * A TwoOptions the platform may hand over as a string.
 *
 * `default-value="false"` reaches PCFHub's demo harness as the string "false",
 * and `Boolean("false")` is `true` — so a control reading `raw` directly gets
 * the opposite of its own declared default on the one surface the public sees.
 * pcf-sparkline avoided this by defaulting its own TwoOptions to `true`; a
 * button that demands two presses by default would be a worse button, so this
 * one is normalised instead.
 */
function asBoolean(raw: unknown, fallback: boolean): boolean {
    if (typeof raw === 'boolean') {
        return raw;
    }
    if (raw === 'false' || raw === '0' || raw === 0) {
        return false;
    }
    if (raw === 'true' || raw === '1' || raw === 1) {
        return true;
    }
    return fallback;
}

/**
 * An icon, inline.
 *
 * Never an `<img src>`, file or data URL. An image behind `src` renders as an
 * isolated document that cannot see this control's stylesheet, so `currentColor`
 * inside it resolves to black and a dark app gets a black glyph on a dark
 * button. pcf-file-drop shipped exactly that and it was found on a real form.
 */
function createIcon(name: IconName): Element {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute(
        'class',
        ICON_FLIPS_IN_RTL[name] ? 'ActionButton-icon ActionButton-icon--flip' : 'ActionButton-icon',
    );
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    /*
     * Without this, some assistive tooling puts a focusable `<svg>` in the tab
     * order — inside a button that is already a tab stop, which produces a stop
     * that does nothing.
     */
    svg.setAttribute('focusable', 'false');

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICON_PATHS[name]);
    svg.appendChild(path);

    return svg;
}
