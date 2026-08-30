/*
 * Drives the real built bundle outside a browser.
 *
 *     npm run build && npm run smoke
 *
 * What it does: installs the DOM, a fake clock and the platform globals, loads
 * `out/controls/ActionButton/bundle.js` the way a canvas app would, presses the
 * button, and asserts what the control did — both what it drew and what it
 * asked the platform for.
 *
 * **This control is why the clock is here.** It is the first field-shaped
 * control in the catalogue with a real timer: an armed confirmation reverts
 * itself after four seconds. `clock.advance()` is what lets that be a passing
 * assertion rather than a comment, and the teardown check at the bottom — which
 * every other field control passes trivially — fails here the moment `destroy`
 * forgets to clear it.
 *
 * **The events bag is a stub with a refusal.** `dev/host.js` takes an `events`
 * option: an array of names it binds, or `null` for a host that publishes no
 * bag at all. `undefined` is a real host — the platform types declare
 * `context.events` as non-optional, so nothing in the type system will make a
 * control guard it, and a manifest `<common-event>` is a claim about the schema
 * rather than about the runtime. Both paths are asserted below.
 *
 * **What passing here does NOT mean.** Every value below is supplied by this
 * file. It cannot tell you that a canvas app binds a callable to `OnSelect` at
 * all — that is the control's headline feature and it is unproven; see SPEC.md
 * under *Not verified*. It also cannot tell you that the button looks right.
 * Use `npm run harness` for the half that has to be seen.
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const dom = require('./dom.js');
const host = require('./host.js');
const clock = require('./clock.js');

const BUNDLE = path.join(root, 'out', 'controls', 'ActionButton', 'bundle.js');

if (!fs.existsSync(BUNDLE)) {
    console.error('\n  No bundle at out/controls/ActionButton. Run npm run build first.\n');
    process.exit(1);
}

/* ----------------------------------------------------------- the platform */

dom.install(global);

/*
 * `vm.runInThisContext` below evaluates the bundle in *this* realm, so the
 * `setTimeout` and `clearTimeout` the control closes over are the ones installed
 * here — no injectable clock parameter, and therefore no production code bent to
 * suit a harness.
 */
const time = clock.install(Date.UTC(2026, 0, 1, 12, 0, 0), global);

const registration = host.captureRegistration(global);

/*
 * No platform libraries to supply. A standard control has no `<platform-library>`
 * entry, so there is no React or Fluent global to stand in for and nothing to
 * render deeply — `updateView` writes into the container, and the container is
 * the result.
 */
vm.runInThisContext(fs.readFileSync(BUNDLE, 'utf8'), { filename: 'bundle.js' });

/* ---------------------------------------------------------------- harness */

const results = [];

function check(label, ok, detail) {
    results.push({ ok, label, detail });
}

// `getString` returns a marked key rather than a real string, so an assertion
// can tell "read from the .resx" apart from "hardcoded in the source".
const marked = (key) => `resx:${key}`;

/**
 * The manifest's own `default-value`s.
 *
 * `dev/host.js` builds `parameters` from `options.inputs` alone, so a declared
 * property that nobody passes arrives as `undefined` — which the platform never
 * does. Seeding every mount with the manifest's defaults is the harness's job;
 * defending against it in the control would be production code bent to suit a
 * rig. These have to be kept in step with ControlManifest.Input.xml.
 */
const MANIFEST_DEFAULTS = {
    label: 'Submit',
    confirmRequired: false,
    confirmLabel: '',
    icon: 'none',
};

const live = [];

function disposeAll() {
    while (live.length > 0) {
        live.pop().destroy();
    }
}

function mount(options = {}) {
    const calls = [];
    const container = dom.createElement('div');

    const context = host.createContext({
        getString: marked,
        ...options,
        calls,
        inputs: { ...MANIFEST_DEFAULTS, ...(options.inputs || {}) },
    });

    const instance = new registration.ctor();

    /*
     * The notification goes into the same log as the platform calls, so an
     * assertion can be about the *order* of the two things a press does — the
     * outputs have to be written and announced before the maker's handler runs,
     * or a formula that throws takes the press with it.
     */
    instance.init(
        context,
        () => {
            calls.push('notifyOutputChanged');
        },
        {},
        container,
    );

    instance.updateView(context);

    const handle = {
        instance,
        container,
        context,
        calls: () => calls,
        outputs: () => instance.getOutputs(),
        notifications: () => calls.filter((call) => call === 'notifyOutputChanged').length,
        raised: () => calls.filter((call) => call.indexOf('events.OnSelect') === 0).length,
        find: (selector) => container.querySelector(selector),
        findAll: (selector) => container.querySelectorAll(selector),
        button: () => container.querySelector('.ActionButton-button'),
        caption: () => container.querySelector('.ActionButton-caption').textContent,
        status: () => container.querySelector('.ActionButton-status').textContent,
        press: () => container.querySelector('.ActionButton-button').click(),
        /** A fresh context, as the platform hands one down on every change. */
        update: (next = {}) =>
            instance.updateView(
                host.createContext({
                    getString: marked,
                    ...options,
                    ...next,
                    calls,
                    inputs: {
                        ...MANIFEST_DEFAULTS,
                        ...(options.inputs || {}),
                        ...(next.inputs || {}),
                    },
                }),
            ),
        destroy: () => {
            instance.destroy();

            const at = live.indexOf(handle);

            if (at !== -1) {
                live.splice(at, 1);
            }
        },
    };

    live.push(handle);

    return handle;
}

/** An event `dev/dom.js` will deliver: no bubbling, no synthesis. */
function fire(element, type, extra = {}) {
    element.dispatchEvent({ type, target: element, preventDefault: () => {}, ...extra });
}

/**
 * Record what is written to an element's `textContent`, rather than what is left
 * in it.
 *
 * The only honest way to test a live region outside a browser. A region
 * announces a *change*, so the control blanks it before every announcement —
 * and `dev/dom.js` records only the final value, where the blank and the second
 * identical message are indistinguishable from one write that changed nothing.
 */
function recordWrites(element) {
    const writes = [];
    const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(element),
        'textContent',
    );

    Object.defineProperty(element, 'textContent', {
        configurable: true,
        get: descriptor.get,
        set(value) {
            writes.push(value);
            descriptor.set.call(this, value);
        },
    });

    return writes;
}

check('bundle registered a control', typeof registration.ctor === 'function');

if (typeof registration.ctor !== 'function') {
    report();
}

/* ------------------------------------------------------------- the button */

const plain = mount({ inputs: { label: 'Send it' } });

check(
    'renders a button that is a button, not a submit',
    plain.button() !== null && plain.button().type === 'button',
    `type=${plain.button() && plain.button().type}`,
);

check('says what the maker told it to say', plain.caption() === 'Send it', plain.caption());

check(
    'falls back to a localised label when the maker cleared it',
    mount({ inputs: { label: '' } }).caption() === 'resx:ActionButton_DefaultLabel',
);

check(
    'names itself with its own text rather than a second name that could disagree',
    plain.button().getAttribute('aria-label') === null,
);

const iconed = mount({ inputs: { icon: 'delete' } });
const glyphs = iconed.findAll('.ActionButton-icon');

check(
    'shows the glyph the maker chose and hides the other',
    glyphs.length === 2 && glyphs.filter((g) => !g.hasAttribute('hidden')).length === 1,
    `${glyphs.filter((g) => !g.hasAttribute('hidden')).length} of ${glyphs.length} shown`,
);

check(
    'and shows no glyph at all when they chose none',
    mount().findAll('.ActionButton-icon').every((g) => g.hasAttribute('hidden')),
);

/* ------------------------------------------------- raising, on two channels */

const pressed = mount();
pressed.press();

check('one press raises OnSelect exactly once', pressed.raised() === 1, pressed.calls().join(' '));

check(
    'and tells the platform its outputs changed',
    pressed.notifications() === 1,
    pressed.calls().join(' '),
);

check(
    'writes the outputs before raising, so a handler that throws cannot take them with it',
    pressed.calls().indexOf('notifyOutputChanged') < pressed.calls().indexOf('events.OnSelect'),
    pressed.calls().join(' '),
);

check(
    'reports what kind of press it was',
    pressed.outputs().lastAction === 'press',
    JSON.stringify(pressed.outputs()),
);

pressed.press();

check(
    'counts every press, so a repeat of the same action is still a change the app can see',
    pressed.outputs().pressCount === 2 && pressed.outputs().lastAction === 'press',
    JSON.stringify(pressed.outputs()),
);

check(
    'starts the count at zero rather than at nothing — an undefined output means "no change"',
    mount().outputs().pressCount === 0 && mount().outputs().lastAction === '',
    JSON.stringify(mount().outputs()),
);

/*
 * The host that publishes no events bag. `context.events` is typed as always
 * present, so this is the case the type system promises cannot happen.
 */
const noEvents = mount({ events: null });
noEvents.press();

check(
    'still writes its outputs on a host that publishes no events bag, and does not throw',
    noEvents.outputs().pressCount === 1 && noEvents.raised() === 0,
    noEvents.calls().join(' '),
);

const thrower = mount();
thrower.context.events.OnSelect = () => {
    throw new Error('the maker’s formula threw');
};

const consoleError = console.error;
console.error = () => {};
thrower.press();
console.error = consoleError;

check(
    'a handler that throws leaves the press recorded rather than swallowing it',
    thrower.outputs().pressCount === 1 && thrower.outputs().lastAction === 'press',
    JSON.stringify(thrower.outputs()),
);

/* -------------------------------------------------------- the confirmation */

const confirming = mount({ inputs: { confirmRequired: true, confirmLabel: 'Delete it?' } });

confirming.press();

check(
    'the first press of a confirmation raises nothing',
    confirming.raised() === 0 && confirming.outputs().pressCount === 0,
    confirming.calls().join(' '),
);

check('and the button asks instead', confirming.caption() === 'Delete it?', confirming.caption());

check(
    'and says so where a screen reader will hear it',
    confirming.status() === 'resx:ActionButton_Armed',
    confirming.status(),
);

confirming.press();

check(
    'the second press raises it, once',
    confirming.raised() === 1 && confirming.outputs().pressCount === 1,
    confirming.calls().join(' '),
);

check(
    'and reports it as a confirmation rather than as a plain press',
    confirming.outputs().lastAction === 'confirm',
    JSON.stringify(confirming.outputs()),
);

check(
    'and puts the button back to its own label afterwards',
    confirming.caption() === 'Submit',
    confirming.caption(),
);

const timedOut = mount({ inputs: { confirmRequired: true } });
timedOut.press();
time.advance(4000);

check(
    'an armed confirmation reverts itself after four seconds',
    timedOut.caption() === 'Submit' && timedOut.status() === 'resx:ActionButton_TimedOut',
    `${timedOut.caption()} / ${timedOut.status()}`,
);

check(
    'and raises nothing when it does',
    timedOut.raised() === 0 && timedOut.outputs().pressCount === 0,
);

const escaped = mount({ inputs: { confirmRequired: true } });
escaped.press();
fire(escaped.button(), 'keydown', { key: 'Escape' });

check(
    'Escape cancels an armed confirmation and says so',
    escaped.caption() === 'Submit' && escaped.status() === 'resx:ActionButton_Cancelled',
    `${escaped.caption()} / ${escaped.status()}`,
);

const blurred = mount({ inputs: { confirmRequired: true } });
blurred.press();
const blurStatus = blurred.status();
fire(blurred.button(), 'blur');

check(
    'leaving the button abandons the confirmation, and silently — the user is elsewhere',
    blurred.caption() === 'Submit' && blurred.status() === blurStatus,
    `${blurred.caption()} / ${blurred.status()}`,
);

const repeating = mount({ inputs: { confirmRequired: true } });
const writes = recordWrites(repeating.find('.ActionButton-status'));

repeating.press();
fire(repeating.button(), 'keydown', { key: 'Escape' });
repeating.press();

check(
    'blanks the live region before each announcement, so an identical second one still announces',
    writes.filter((value) => value === '').length >= 2 &&
        writes[writes.length - 2] === '' &&
        writes[writes.length - 1] === 'resx:ActionButton_Armed',
    JSON.stringify(writes),
);

const withdrawn = mount({ inputs: { confirmRequired: true } });
withdrawn.press();
withdrawn.update({ inputs: { confirmRequired: false } });

check(
    'the maker switching confirmation off mid-flight disarms it',
    withdrawn.caption() === 'Submit',
    withdrawn.caption(),
);

withdrawn.press();

check(
    'and the next press acts immediately rather than asking again',
    withdrawn.outputs().pressCount === 1 && withdrawn.outputs().lastAction === 'press',
    JSON.stringify(withdrawn.outputs()),
);

/* ------------------------------------------------------ the maker's settings */

const stringly = mount({ inputs: { confirmRequired: 'false' } });
stringly.press();

check(
    'reads the string "false" a host may hand over as false, not as truthy',
    stringly.outputs().pressCount === 1,
    `pressCount ${stringly.outputs().pressCount}`,
);

check(
    'falls back to a localised confirmation when the maker wrote none',
    (() => {
        const view = mount({ inputs: { confirmRequired: true, confirmLabel: '' } });
        view.press();
        return view.caption() === 'resx:ActionButton_Confirm';
    })(),
);

/* ----------------------------------------------- the states a screen produces */

const disabled = mount({ disabled: true });
disabled.press();

check(
    'a disabled button raises nothing',
    disabled.raised() === 0 && disabled.outputs().pressCount === 0,
    disabled.calls().join(' '),
);

const disarmedByHost = mount({ inputs: { confirmRequired: true } });
disarmedByHost.press();
disarmedByHost.update({ disabled: true });

check(
    'and disabling one mid-confirmation drops the confirmation rather than leaving it armed',
    disarmedByHost.caption() === 'Submit',
    disarmedByHost.caption(),
);

check(
    'a hidden control draws nothing',
    mount({ visible: false }).container.classList.contains('ActionButton--hidden'),
);

check(
    'takes no position on the theme when the host publishes none',
    !mount({ host: 'canvas' }).container.classList.contains('ActionButton--dark'),
);

check(
    'and follows the host into dark when it publishes one',
    mount({ dark: true }).container.classList.contains('ActionButton--dark'),
);

/* ------------------------------------------------------ what destroy owes */

/*
 * **This is the first field control in the catalogue where these two are not
 * trivial.** An armed confirmation holds a `setTimeout` for four seconds, and a
 * control removed from a screen mid-confirmation leaves it firing against a
 * detached element — the platform does not clean that up, because from its side
 * the control simply stopped being.
 */
disposeAll();

const timersBefore = time.pending();
const listeners = () =>
    Object.values(dom.document.listeners).reduce((total, list) => total + list.length, 0);
const listenersBefore = listeners();

const armedThenGone = mount({ inputs: { confirmRequired: true } });
armedThenGone.press();

check(
    'an armed confirmation is holding a timer',
    time.pending() === timersBefore + 1,
    `${timersBefore} → ${time.pending()}`,
);

armedThenGone.destroy();

check(
    'destroy() releases every timer the control took',
    time.pending() === timersBefore,
    `${timersBefore} → ${time.pending()}`,
);

check(
    'and every document-level listener',
    listeners() === listenersBefore,
    `${listenersBefore} → ${listeners()}`,
);

const rerendered = mount({ inputs: { confirmRequired: true } });
const afterFirst = time.pending();

rerendered.update();
rerendered.update();
rerendered.update();

check(
    'and re-rendering does not add one',
    time.pending() === afterFirst,
    `${afterFirst} → ${time.pending()}`,
);

disposeAll();

report();

function report() {
    const failed = results.filter((result) => !result.ok);

    for (const result of results) {
        const detail = result.detail ? `  — ${result.detail}` : '';

        console.log(`  ${result.ok ? 'ok  ' : 'FAIL'}  ${result.label}${detail}`);
    }

    console.log(
        failed.length > 0
            ? `\n  ${failed.length} of ${results.length} failed\n`
            : `\n  ${results.length} passed — the control's own decisions only; see SPEC.md for what a real canvas app still has to confirm\n`,
    );

    process.exit(failed.length > 0 ? 1 : 0);
}
