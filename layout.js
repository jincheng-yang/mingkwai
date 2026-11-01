// Pane sizes are independent of the paper's physical dimensions and pan position.
(() => {
    'use strict';
    const root = document.documentElement;
    const paperDivider = document.getElementById('paper-divider');
    const readerDivider = document.getElementById('reader-divider');
    let paperHeight = null;
    let readerRatio = 0.4;
    let machineRatio = 2 / 3;
    let drag = null;
    let lastTap = null;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const sideways = () => root.classList.contains('mobile-keyboard-open');
    function metrics() {
        const height = window.visualViewport?.height || innerHeight;
        const top = window.visualViewport?.offsetTop || 0;
        const width = root.clientWidth;
        const line = parseFloat(getComputedStyle(document.getElementById('text')).lineHeight);
        const minimum = Math.min(60, height / 5);
        const p = clamp(paperHeight ?? line * 1.5, Math.min(line, height / 4), Math.max(line, height - minimum * 2 - 12));
        const reader = clamp(height * readerRatio, minimum, Math.max(minimum, height - p - minimum - 12));
        return { height, top, width, line, minimum, p, reader };
    }
    function update() {
        const m = metrics();
        root.style.setProperty('--paper-window-height', `${m.p}px`);
        root.style.setProperty('--reader-window-height', `${m.reader}px`);
        root.style.setProperty('--machine-pane-width', `${(m.width - 6) * machineRatio}px`);
        readerDivider.setAttribute('aria-orientation', sideways() ? 'vertical' : 'horizontal');
        for (const [divider, value, min, max] of [
            [paperDivider, m.p, Math.min(m.line, m.height / 4), Math.max(m.line, m.height - m.minimum * 2 - 12)],
            [readerDivider, sideways() ? machineRatio * 100 : m.height - m.reader - 6,
                sideways() ? 20 : m.p + m.minimum + 6, sideways() ? 80 : m.height - m.minimum - 6]
        ]) {
            divider.setAttribute('aria-valuenow', String(Math.round(value)));
            divider.setAttribute('aria-valuemin', String(Math.round(min)));
            divider.setAttribute('aria-valuemax', String(Math.round(max)));
        }
        window.requestMechanismRender?.(500);
    }
    function move(divider, coordinate) {
        const m = metrics();
        if (divider === paperDivider) paperHeight = clamp(coordinate - m.top,
            Math.min(m.line, m.height / 4), Math.max(m.line, m.height - m.minimum * 2 - 12));
        else if (sideways()) machineRatio = clamp(coordinate / (m.width - 6), 0.2, 0.8);
        else readerRatio = clamp((m.height - (coordinate - m.top) - 6) / m.height,
            m.minimum / m.height, (m.height - m.p - m.minimum - 12) / m.height);
        update();
    }
    function reset(divider) {
        if (divider === paperDivider) paperHeight = null;
        else if (sideways()) machineRatio = 2 / 3;
        else readerRatio = 0.4;
        update();
    }
    for (const divider of [paperDivider, readerDivider]) {
        divider.title = '拖动调整大小；方向键微调；双击恢复';
        divider.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            event.preventDefault();
            const vertical = divider === readerDivider && sideways();
            const coordinate = vertical ? event.clientX : event.clientY;
            const bounds = divider.getBoundingClientRect();
            drag = { id: event.pointerId, offset: coordinate - (vertical ? bounds.left : bounds.top), coordinate, moved: false };
            divider.setPointerCapture(event.pointerId);
            root.classList.add('resizing-panes');
        });
        divider.addEventListener('pointermove', event => {
            if (!drag || event.pointerId !== drag.id) return;
            const coordinate = divider === readerDivider && sideways() ? event.clientX : event.clientY;
            if (Math.abs(coordinate - drag.coordinate) > 3) drag.moved = true;
            if (drag.moved) move(divider, coordinate - drag.offset);
        });
        function finish(event) {
            if (!drag || event.pointerId !== drag.id) return;
            if (event.type !== 'pointercancel' && !drag.moved) {
                if (lastTap?.divider === divider && performance.now() - lastTap.time < 350) {
                    reset(divider);
                    lastTap = null;
                } else lastTap = { divider, time: performance.now() };
            } else lastTap = null;
            drag = null;
            root.classList.remove('resizing-panes');
        }
        divider.addEventListener('pointerup', finish);
        divider.addEventListener('pointercancel', finish);
        divider.addEventListener('lostpointercapture', finish);
        divider.addEventListener('keydown', event => {
            const vertical = divider === readerDivider && sideways();
            const direction = vertical ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 };
            if (event.key === 'Home') { event.preventDefault(); reset(divider); return; }
            if (!(event.key in direction)) return;
            event.preventDefault();
            const rect = divider.getBoundingClientRect();
            move(divider, (vertical ? rect.left : rect.top) + direction[event.key] * (event.shiftKey ? 30 : 10));
        });
    }
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.keyboardController.onKeyboardChange(update);
    document.fonts.ready.then(update);
    update();
})();
