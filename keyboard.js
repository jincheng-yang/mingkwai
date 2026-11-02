// Keyboard and composition input, selection updates and candidate lookup.
(() => {
    'use strict';
    const paper = window.typewriterPaper;
    const state = window.machineState;
    const pinyin = window.simulatorLoading.scheme.id === 'pinyin' ? window.createPinyinParser() : null;
    const typingSurface = paper.surface;
    const keyboardToggle = document.getElementById('keyboard-toggle');
    const touchKeyboard = window.matchMedia('(any-pointer: coarse)');
    const keyboardListeners = new Set();
    const mobileKeys = [];
    const strikeDuration = paper.duration;
    let activeStrikeKey = null;
    let activeStrikeIsMobile = false;
    let strikeStartedAt = 0;
    let strikeReleaseTimer = null;
    let mobileTyping = false;
    let composing = false;
    let mobileKeyboardOpen = false;
    let blocks = [];
    const sound_swoosh = new Audio('assets/audio/swoosh.mp3');
    sound_swoosh.volume = 0.1;
    const sound_gear = Array.from({ length: 4 }, (_, index) => new Audio(`assets/audio/gear${index + 1}.mp3`));
    function playSound(sound) { sound.play().catch(() => {}); }
    const ready = window.simulatorLoading.loadText(window.simulatorLoading.scheme.candidatesUrl, 'candidateDownload',
        window.simulatorLoading.scheme.candidatesBytes).then(source => {
        blocks = d3.csvParse(source);
        return blocks;
    });
    ready.catch(error => window.simulatorLoading?.fail(error));
    function carriageReturn() { releaseStrike(); paper.carriageReturn(); }
    function typeKey(key, mobile = false) {
        paper.resetPan({ immediate: true });
        if (key === 'Enter' || key === '\n') { carriageReturn(); return; }
        if (key.length !== 1) return;
        const choice = '12345678 '.indexOf(key);
        let rowKey = key;
        let columnKey = key;
        if (pinyin && /^[A-Za-zü]$/.test(key)) {
            const selection = pinyin.push(key);
            rowKey = selection.rowKey;
            columnKey = selection.columnKey;
        }
        const newRow = rowKey == null ? -1 : machineLayout.rowKeys.indexOf(rowKey);
        const newCol = columnKey == null ? -1 : machineLayout.columnKeys.indexOf(columnKey);
        if (newRow === -1 && newCol === -1 && choice === -1) return;
        const row = state.targetVerticalPosition;
        const col = state.targetHorizontalPosition;
        if (newRow !== -1 && newRow !== row) {
            const movement = state.setVerticalPosition(newRow);
            // World-space turns of the left carrier gear and right center gear.
            // Use the unwrapped angles so one-way wraps and interrupted moves count.
            const angle = Math.max(Math.abs(movement.to.large - movement.from.large),
                Math.abs(movement.to.centerGear - movement.from.centerGear));
            const clip = Math.min(sound_gear.length, Math.max(1, Math.ceil(angle / (Math.PI / 3) - 1e-9)));
            for (const sound of sound_gear) sound.pause();
            sound_gear[clip - 1].currentTime = 0;
            playSound(sound_gear[clip - 1]);
            window.requestMechanismRender?.(1600);
        }
        if (newCol !== -1 && newCol !== col) {
            sound_swoosh.playbackRate = 1 / Math.min(2, 1 + Math.abs(newCol - col) / 10);
            sound_swoosh.preservesPitch = true;
            sound_swoosh.currentTime = 0;
            playSound(sound_swoosh);
            state.setHorizontalPosition(newCol);
        }
        if (choice !== -1) {
            const block = blocks[state.targetVerticalPosition * machineLayout.columnCount + state.targetHorizontalPosition];
            if (!block && choice !== 8) return;
            releaseStrike();
            state.setStrikeFace(choice);
            activeStrikeKey = key;
            activeStrikeIsMobile = mobile;
            strikeStartedAt = performance.now();
            paper.strike(choice === 8 ? '　' : Array.from(block.chars)[choice] || '　', choice === 8);
        }
    }
    document.addEventListener('keydown', event => {
        if (window.simulatorLoading?.active) return;
        paper.resetPan({ immediate: true });
        if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
        const editable = event.target instanceof Element && event.target.closest('input, textarea, select, [role="separator"], [contenteditable="true"]');
        if (editable && editable !== typingSurface) return;
        // Some software keyboards report physical-looking codes and immediately
        // send keyup. On touch devices, use committed input and a timed strike.
        if (editable && (touchKeyboard.matches || !event.code || event.keyCode === 229)) return;
        if (event.key === 'Enter') {
            event.preventDefault();
            if (!event.repeat) carriageReturn();
            return;
        }
        const pinyinKey = pinyin && /^[A-Za-zü]$/.test(event.key);
        if (!pinyinKey && (event.key.length !== 1 || !(machineLayout.rowKeys + machineLayout.columnKeys + '12345678 ').includes(event.key))) return;
        event.preventDefault();
        if (event.repeat) return;
        typeKey(event.key);
    });

    function typeMobileText(text) {
        paper.restore();
        mobileKeys.push(...(text || '').replace(/\r\n?/g, '\n'));
        if (!mobileTyping) runMobileKeys();
    }

    function runMobileKeys() {
        mobileTyping = true;
        while (mobileKeys.length) {
            typeKey(mobileKeys.shift(), true);
            if (activeStrikeKey !== null && activeStrikeIsMobile) {
                const strikeKey = activeStrikeKey;
                setTimeout(() => {
                    if (activeStrikeIsMobile && activeStrikeKey === strikeKey) releaseStrike();
                    setTimeout(runMobileKeys, strikeDuration);
                }, strikeDuration);
                return;
            }
        }
        mobileTyping = false;
    }

    typingSurface.addEventListener('beforeinput', event => {
        paper.resetPan({ immediate: true });
        if (composing || event.isComposing || !event.cancelable) return;
        if (['insertParagraph', 'insertLineBreak'].includes(event.inputType)) {
            event.preventDefault();
            typeMobileText('\n');
            return;
        }
        const insertion = event.inputType.startsWith('insert') && !['insertParagraph', 'insertLineBreak'].includes(event.inputType);
        // Let the browser supply the edit when beforeinput has no text payload.
        // The input fallback will extract it from the edited surface.
        if (insertion && event.data == null) return;
        event.preventDefault();
        if (insertion) typeMobileText(event.data);
    });

    function insertedSurfaceText() {
        const edited = typingSurface.textContent;
        let start = 0;
        while (start < paper.text.length && start < edited.length && paper.text[start] === edited[start]) start++;
        let oldEnd = paper.text.length;
        let newEnd = edited.length;
        while (oldEnd > start && newEnd > start && paper.text[oldEnd - 1] === edited[newEnd - 1]) {
            oldEnd--;
            newEnd--;
        }
        return edited.slice(start, newEnd);
    }

    typingSurface.addEventListener('input', event => {
        paper.resetPan({ immediate: true });
        if (composing || event.isComposing) return;
        if (['insertParagraph', 'insertLineBreak'].includes(event.inputType)) {
            typeMobileText('\n');
            return;
        }
        if (typingSurface.textContent === paper.text) return;
        // Restore the output when a keyboard delivers a noncancelable edit.
        const insertion = event.inputType?.startsWith('insert');
        typeMobileText(insertion ? event.data ?? insertedSurfaceText() : '');
    });
    typingSurface.addEventListener('compositionstart', () => {
        paper.resetPan({ immediate: true });
        composing = true;
    });
    typingSurface.addEventListener('compositionend', event => {
        paper.resetPan({ immediate: true });
        composing = false;
        typeMobileText(event.data ?? insertedSurfaceText());
    });

    function updateKeyboardToggle() {
        const focused = document.activeElement === typingSurface;
        keyboardToggle.setAttribute('aria-pressed', String(focused));
        keyboardToggle.setAttribute('aria-label', focused ? '隐藏键盘' : '显示键盘');
    }

    // Preserve the surface's focus until click so a second tap can dismiss it.
    keyboardToggle.addEventListener('pointerdown', event => event.preventDefault());
    keyboardToggle.addEventListener('click', () => {
        if (document.activeElement === typingSurface) typingSurface.blur();
        else typingSurface.focus({ preventScroll: true });
    });
    typingSurface.addEventListener('focus', updateKeyboardToggle);
    typingSurface.addEventListener('blur', () => {
        releaseStrike();
        updateKeyboardToggle();
    });

    function releaseStrike() {
        if (strikeReleaseTimer !== null) { clearTimeout(strikeReleaseTimer); strikeReleaseTimer = null; }
        if (activeStrikeKey === null) return;
        activeStrikeKey = null;
        activeStrikeIsMobile = false;
        paper.release();
    }
    document.addEventListener('keyup', event => {
        if (activeStrikeIsMobile || event.key !== activeStrikeKey) return;
        const remaining = strikeDuration - (performance.now() - strikeStartedAt);
        if (remaining <= 0) releaseStrike();
        else if (strikeReleaseTimer === null) {
            strikeReleaseTimer = setTimeout(releaseStrike, remaining);
        }
    });
    window.addEventListener('blur', releaseStrike);

    let keyboardClosedHeight = 0;
    let keyboardClosedWidth = 0;

    function resizeVisibleViewport() {
        const viewport = window.visualViewport;
        const visibleHeight = viewport ? viewport.height : window.innerHeight;
        // Normalize pinch zoom so zooming alone does not look like a keyboard.
        const normalizedHeight = visibleHeight * (viewport?.scale || 1);
        const layoutWidth = document.documentElement.clientWidth;
        const focused = document.activeElement === typingSurface;
        if (!keyboardClosedHeight || Math.abs(layoutWidth - keyboardClosedWidth) > 50) {
            // Rotation may occur while the keyboard is already open.
            keyboardClosedHeight = mobileKeyboardOpen && focused
                ? Math.max(normalizedHeight, window.screen.availHeight) : normalizedHeight;
            keyboardClosedWidth = layoutWidth;
        } else if (!focused || !mobileKeyboardOpen) {
            keyboardClosedHeight = Math.max(keyboardClosedHeight, normalizedHeight);
        }
        const threshold = Math.max(100, keyboardClosedHeight * 0.18);
        const keyboardOpen = touchKeyboard.matches && focused && (
            (navigator.virtualKeyboard?.boundingRect.height || 0) > 0
            || keyboardClosedHeight - normalizedHeight > threshold
        );
        document.documentElement.style.setProperty('--viewport-height', `${visibleHeight}px`);
        document.documentElement.style.setProperty('--viewport-top', `${viewport ? viewport.offsetTop : 0}px`);
        if (keyboardOpen !== mobileKeyboardOpen) {
            mobileKeyboardOpen = keyboardOpen;
            document.documentElement.classList.toggle('mobile-keyboard-open', keyboardOpen);
            for (const listener of keyboardListeners) listener(keyboardOpen);
            window.requestMechanismRender?.(1600);
        }
    }

    // Mobile keyboards often resize only the visual viewport, not the layout
    // viewport. Keep both the mechanism and magic eye inside the visible area.
    window.visualViewport?.addEventListener('resize', resizeVisibleViewport);
    window.visualViewport?.addEventListener('scroll', resizeVisibleViewport);
    window.addEventListener('resize', resizeVisibleViewport);
    typingSurface.addEventListener('focus', resizeVisibleViewport);
    typingSurface.addEventListener('blur', resizeVisibleViewport);
    touchKeyboard.addEventListener('change', resizeVisibleViewport);
    navigator.virtualKeyboard?.addEventListener('geometrychange', resizeVisibleViewport);
    resizeVisibleViewport();

    window.keyboardController = Object.freeze({
        ready,
        typeKey,
        releaseStrike,
        get keyboardOpen() { return mobileKeyboardOpen; },
        get pinyinBuffer() { return pinyin?.text || ''; },
        onKeyboardChange(listener) {
            keyboardListeners.add(listener);
            listener(mobileKeyboardOpen);
            return () => keyboardListeners.delete(listener);
        }
    });
})();
