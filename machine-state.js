// Shared configuration and the animated selection: horizontal columns 0–27 and vertical cards 0–35.
const machineLayout = Object.freeze({
    rollerRadius: 1,
    capRadius: 1.025,
    cameraFov: 35,
    groupCount: 6,
    rollersPerGroup: 6,
    facesPerRoller: 8,
    columnCount: 28,
    rowKeys: 'GFDSA!HJKLM@TREWQ#YUIOP$NBVCX%^&*()Z',
    columnKeys: window.simulatorLoading.scheme.columnKeys || 'qazwsxedcrfvtgbyhnujmik9ol0p'
});

(() => {
    'use strict';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const moveDuration = 1000;
    const turn = Math.PI * 2;
    function forwardAngle(angle, current) {
        return Math.max(current, angle + Math.ceil((current - angle) / turn - 1e-10) * turn);
    }
    function rowValues(row, current) {
        const large = turn * Math.floor(row / machineLayout.rollersPerGroup) / machineLayout.groupCount;
        const medium = turn * (row % machineLayout.rollersPerGroup) / machineLayout.rollersPerGroup;
        return { position: row,
            large: current ? forwardAngle(large, current.large) : large,
            medium,
            centerGear: current ? -forwardAngle(medium / 2, -current.centerGear) : -medium / 2 };
    }
    function createAxis(initial, maxPosition, targets) {
        const listeners = new Set();
        let current = targets(initial);
        let target = current;
        let from = current;
        let started = 0;
        let frame = null;
        function publish() { for (const listener of listeners) listener(current.position); }
        function sample(now) {
            const t = Math.max(0, Math.min(1, (now - started) / moveDuration));
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            return Object.fromEntries(Object.keys(target).map(key => [key, from[key] + (target[key] - from[key]) * eased]));
        }
        function tick(now) {
            frame = null;
            current = sample(now);
            publish();
            if (now - started < moveDuration) frame = requestAnimationFrame(tick);
        }
        function set(value, { immediate = false } = {}) {
            if (!Number.isInteger(value) || value < 0 || value > maxPosition) {
                throw new RangeError(`Selection must be an integer between 0 and ${maxPosition}.`);
            }
            const now = performance.now();
            if (frame !== null) {
                current = sample(now);
                cancelAnimationFrame(frame);
                frame = null;
            }
            from = current;
            target = targets(value, current);
            started = now;
            if (immediate || reducedMotion.matches || Object.keys(target).every(key => target[key] === from[key])) current = target;
            else frame = requestAnimationFrame(tick);
            publish();
            return { from: { ...from }, to: { ...target } };
        }
        return { get current() { return current; }, get target() { return target.position; }, set,
            subscribe(listener) { listeners.add(listener); listener(current.position); return () => listeners.delete(listener); } };
    }
    const horizontal = createAxis(machineLayout.columnKeys.indexOf(window.simulatorLoading.scheme.initialColumn),
        machineLayout.columnCount - 1, position => ({ position }));
    const vertical = createAxis(machineLayout.rowKeys.indexOf(window.simulatorLoading.scheme.initialRow),
        machineLayout.groupCount * machineLayout.rollersPerGroup - 1, rowValues);
    let strikeFace = -1;
    reducedMotion.addEventListener('change', () => {
        if (!reducedMotion.matches) return;
        horizontal.set(horizontal.target, { immediate: true });
        vertical.set(vertical.target, { immediate: true });
    });
    window.machineState = Object.freeze({
        get horizontalPosition() { return horizontal.current.position; },
        set horizontalPosition(value) { horizontal.set(value); },
        get targetHorizontalPosition() { return horizontal.target; },
        get verticalPosition() { return vertical.current.position; },
        set verticalPosition(value) { vertical.set(value); },
        get targetVerticalPosition() { return vertical.target; },
        get carriageX() { return -9.75 + (horizontal.current.position + 0.5) * 19.5 / machineLayout.columnCount; },
        get mechanismSelection() {
            const { position: row, large, medium, centerGear } = vertical.current;
            return { row, large, medium, centerGear, column: horizontal.current.position };
        },
        get strikeFace() { return strikeFace; },
        setStrikeFace(value) {
            if (!Number.isInteger(value) || value < -1 || value > machineLayout.facesPerRoller) throw new RangeError('Invalid type face.');
            strikeFace = value;
        },
        setHorizontalPosition: horizontal.set,
        setVerticalPosition: vertical.set,
        subscribeHorizontalPosition: horizontal.subscribe,
        subscribeVerticalPosition: vertical.subscribe
    });
})();
