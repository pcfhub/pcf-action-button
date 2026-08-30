/*
 * The driver: wires the switches on `harness.html` to a real instance of the
 * control.
 *
 * Loaded before the control bundle, because the bundle registers itself the
 * moment it loads and needs somewhere to register. The page calls
 * `window.__harnessStart()` once the bundle has run.
 *
 * **What this page is for, that `npm run smoke` cannot be for.** The suite
 * asserts every decision this control makes and has never seen the button. The
 * confirm swap, the red armed state, the focus ring, whether a long label wraps
 * instead of overflowing, whether the send glyph mirrors in a right-to-left
 * app — all of that is here and nowhere else.
 *
 * Read `harness.html` first.
 */

(function () {
    'use strict';

    var host = window.__pcfHost;
    var registration = host.captureRegistration(window);

    var instance = null;
    var container = null;
    var notifications = 0;

    /**
     * Every platform call the control made, in order.
     *
     * For this control the log is the point rather than a diagnostic: pressing
     * the button is supposed to do two separate things — write its outputs and
     * raise `OnSelect` — and the only place both are visible at once is here.
     */
    var calls = [];

    function options() {
        return {
            host: document.getElementById('harness-host').value,
            formFactor: document.getElementById('harness-formfactor').value,
            calls: calls,
            disabled: document.getElementById('harness-disabled').checked,
            visible: document.getElementById('harness-visible').checked,
            dark: document.getElementById('harness-dark').checked,
            rtl: document.getElementById('harness-rtl').checked,

            /*
             * `null` is a host that publishes no events bag at all. The
             * platform types say that cannot happen; this switch is what makes
             * the control's feature detection something you can watch work
             * rather than something you have to take on trust.
             */
            events: document.getElementById('harness-events').checked ? ['OnSelect'] : null,

            // Every declared input, as the platform always supplies them.
            inputs: {
                label: document.getElementById('harness-label').value,
                confirmRequired: document.getElementById('harness-confirm').checked,
                confirmLabel: document.getElementById('harness-confirmlabel').value,
                icon: document.getElementById('harness-icon').value,
            },
        };
    }

    /*
     * What the platform does after a control says its outputs changed: it reads
     * `getOutputs()` and comes back through `updateView`.
     *
     * There is no bound column here to adopt the answer into — this control
     * writes only output properties, which a canvas app reads with
     * `Self.PressCount` — so the round trip is shorter than the template's. It
     * is still deferred rather than immediate, because the platform is
     * asynchronous and calling back synchronously from inside the control's own
     * click handler would re-enter it mid-update, a shape the platform never
     * produces.
     */
    function notifyOutputChanged() {
        notifications += 1;
        calls.push('notifyOutputChanged');

        window.setTimeout(render, 0);
    }

    function render() {
        var context = host.createContext(options());

        instance.updateView(context);

        var form = document.getElementById('harness-form');
        form.classList.toggle('is-dark', document.getElementById('harness-dark').checked);
        form.dir = context.userSettings.isRTL ? 'rtl' : 'ltr';

        showOutputs();
        showCalls();
    }

    /*
     * `getOutputs()` printed as it actually is, with `undefined` visible.
     *
     * `JSON.stringify` drops undefined values entirely, which hides the single
     * most consequential mistake a control with outputs makes — an `undefined`
     * output means "no change", so a canvas app never sees the press. Each key
     * is formatted by hand and the absence is spelled out.
     */
    function showOutputs() {
        var outputs = instance.getOutputs ? instance.getOutputs() : {};
        var lines = Object.keys(outputs).map(function (key) {
            var value = outputs[key];
            var shown;

            if (value === undefined) {
                shown = 'undefined   <- the platform reads this as "no change"';
            } else if (value === null) {
                shown = 'null        <- an explicit clear';
            } else {
                shown = JSON.stringify(value);
            }

            return '  ' + key + ': ' + shown;
        });

        document.getElementById('harness-outputs').textContent =
            lines.length > 0 ? '{\n' + lines.join('\n') + '\n}' : '{}';

        document.getElementById('harness-notified').textContent =
            'notifyOutputChanged x' + notifications
            + ' · OnSelect x'
            + calls.filter(function (call) {
                return call.indexOf('events.OnSelect') === 0;
            }).length;
    }

    function showCalls() {
        document.getElementById('harness-calls').textContent =
            calls.length > 0
                ? calls
                    .map(function (call, index) {
                        return String(index + 1).padStart(3, ' ') + '  ' + call;
                    })
                    .join('\n')
                : 'Nothing yet. Press the button.';
    }

    window.__harnessStart = function () {
        var status = document.getElementById('harness-status');

        if (typeof registration.ctor !== 'function') {
            status.textContent = 'No control registered — run npm run build, then reload.';

            return;
        }

        var context = host.createContext(options());

        container = document.getElementById('harness-root');
        instance = new registration.ctor();

        instance.init(context, notifyOutputChanged, {}, container);

        var returned = instance.updateView(context);

        if (returned !== undefined) {
            status.textContent =
                'updateView returned a value — this is a virtual control, and this page cannot render one. Use npm start and npm run smoke.';

            return;
        }

        [
            'harness-host',
            'harness-formfactor',
            'harness-disabled',
            'harness-visible',
            'harness-dark',
            'harness-rtl',
            'harness-events',
            'harness-confirm',
            'harness-icon',
        ].forEach(function (id) {
            document.getElementById(id).addEventListener('change', render);
        });

        ['harness-label', 'harness-confirmlabel'].forEach(function (id) {
            document.getElementById(id).addEventListener('input', render);
        });

        /*
         * A confirmation reverts itself on a four-second timer, and the timer
         * calls nothing on this page — the control repaints its own button
         * without going through `updateView`. So the outputs panel would sit
         * stale after a timeout unless something looked again.
         */
        window.setInterval(function () {
            showOutputs();
            showCalls();
        }, 500);

        // The cheapest way to catch work that belongs behind a comparison:
        // press it and watch whether anything moves.
        document.getElementById('harness-rerender').addEventListener('click', render);

        status.textContent = 'Registered ' + registration.name + '.';

        render();
    };
})();
