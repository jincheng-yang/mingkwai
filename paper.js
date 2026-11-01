// Paper rendering, printed ink, carriage return and pan gestures.
(() => {
    'use strict';
    const reducedEyeMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sound_keydown = new Audio('assets/audio/keydown.mp3');
    const sound_keyup = new Audio('assets/audio/keyup.mp3');
    const sound_return = new Audio('assets/audio/return.mp3');
    const sound_pageflip = new Audio('assets/audio/pageflip.mp3');
    let striking = false;
    function playSound(sound) { sound.play().catch(() => {}); }
    function strike(character, blank = false) {
        enqueuePaperJob({ kind: 'strike', character, blank });
    }
    function printStrike(character, blank) {
        releaseStrike();
        striking = true;
        playSound(sound_keydown);
        commitCharacter(character);
        d3.select(typingSurface).interrupt().transition()
            .duration(reducedEyeMotion.matches ? 0 : strikeDuration)
            .style('--strike-progress', blank ? '0' : '1');
        window.requestMechanismRender?.(700);
    }
    function releaseStrike() {
        if (!striking) return;
        striking = false;
        playSound(sound_keyup);
        d3.select(typingSurface).interrupt().transition()
            .duration(reducedEyeMotion.matches ? 0 : strikeDuration).style('--strike-progress', '0');
        feedPaper();
        window.requestMechanismRender?.(700);
    }
    const typingSurface = document.getElementById('text');
    const printingPoint = document.getElementById('printing-point');
    const typingPaper = document.getElementById('paper-sheet');
    let typedText = typingSurface.textContent;
    const strikeDuration = 300;
    let paperAdvance = 0;
    let paperLineAdvance = 0;
    const paperColumns = 20;
    const paperRows = 9;
    const autoReturnDelay = 1000;
    let automaticReturnTimer = null;
    let returnTimer = null;
    let queuedStrikeTimer = null;
    const pendingJobs = [];
    const idleWaiters = [];
    const inkFadeDuration = 200;
    const printedAt = new Map();
    reducedEyeMotion.addEventListener('change', () => {
        if (reducedEyeMotion.matches) printedAt.clear();
    });
    // The supplied paper texture is 2000 × 1333; each page keeps that ratio.
    const paperImageWidth = 2000;
    const paperImageHeight = 1333;

    function paperMetrics() {
        const style = getComputedStyle(typingSurface);
        const lineHeight = parseFloat(style.lineHeight);
        const width = parseFloat(getComputedStyle(typingPaper).width);
        const height = Math.floor(width * paperImageHeight / paperImageWidth * 64) / 64;
        return { height, lineHeight, rows: paperRows,
            verticalMargin: (height - paperRows * lineHeight) / 2,
            margin: 3 * parseFloat(style.fontSize) };
    }

    function paperLineIndex() {
        return typedText.split('\n').length - 1;
    }

    function renderPaper() {
        const lines = typedText.split('\n');
        const metrics = paperMetrics();
        const pageCount = Math.floor(paperLineIndex() / metrics.rows) + 1;
        const fragment = document.createDocumentFragment();
        const fadeStarts = new Map();
        const now = performance.now();
        let offset = 0;
        typingPaper.style.setProperty('--paper-page-height', `${metrics.height}px`);
        typingPaper.style.setProperty('--paper-page-inset', `${metrics.verticalMargin}px`);
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
            const page = document.createElement('span');
            page.className = 'paper-page';
            page.dataset.page = String(pageIndex + 1);
            for (let row = 0; row < metrics.rows; row++) {
                const index = pageIndex * metrics.rows + row;
                if (index > 0 && index < lines.length) {
                    page.append(document.createTextNode('\n'));
                    offset++;
                }
                const line = document.createElement('span');
                line.className = 'paper-line';
                if (index >= lines.length) line.setAttribute('aria-hidden', 'true');
                for (const character of Array.from(lines[index] || '')) {
                    const glyph = document.createElement('span');
                    glyph.className = 'paper-glyph';
                    glyph.textContent = character;
                    const elapsed = now - (printedAt.get(offset) ?? -Infinity);
                    if (!reducedEyeMotion.matches && elapsed < inkFadeDuration) {
                        glyph.classList.add('paper-ink-fade');
                        fadeStarts.set(glyph, printedAt.get(offset));
                    }
                    offset += character.length;
                    line.append(glyph);
                }
                page.append(line);
            }
            fragment.append(page);
        }
        typingSurface.replaceChildren(fragment);
        // Anchor fades to the key's time rather than the next rendering frame,
        // preserving both their duration and progress when the DOM is rebuilt.
        for (const animation of typingSurface.getAnimations({ subtree: true })) {
            const started = fadeStarts.get(animation.effect.target);
            if (started !== undefined) animation.startTime = started;
        }
    }

    function paperBusy() {
        return automaticReturnTimer !== null || returnTimer !== null || queuedStrikeTimer !== null;
    }
    function resolvePaperIdle() {
        if (!paperBusy() && !pendingJobs.length) idleWaiters.splice(0).forEach(resolve => resolve());
    }
    function executePaperJob(job) {
        resetPaperPan({ immediate: true });
        if (job.kind === 'return' || job.character === '\n') performCarriageReturn();
        else if (job.kind === 'strike') printStrike(job.character, job.blank);
        else commitCharacter(job.character);
    }
    function drainPaperJobs() {
        while (!paperBusy() && pendingJobs.length) {
            const job = pendingJobs.shift();
            executePaperJob(job);
            if (job.kind === 'strike' && job.character !== '\n') {
                queuedStrikeTimer = setTimeout(() => {
                    queuedStrikeTimer = null;
                    releaseStrike();
                    drainPaperJobs();
                }, strikeDuration);
            }
        }
        resolvePaperIdle();
    }
    function enqueuePaperJob(job) {
        resetPaperPan({ immediate: true });
        if (paperBusy() || pendingJobs.length) {
            pendingJobs.push(job);
            drainPaperJobs();
        } else {
            executePaperJob(job);
            resolvePaperIdle();
        }
    }
    function appendPaperText(character) {
        enqueuePaperJob({ kind: 'append', character });
    }
    function commitCharacter(character) {
        if (!reducedEyeMotion.matches) printedAt.set(typedText.length, performance.now());
        typedText += character;
        renderPaper();
        layoutPaper(true);
        if (Array.from(typedText.split('\n').at(-1)).length === paperColumns) {
            // Keep the completed line, marker, sound and page in place for 1 s.
            automaticReturnTimer = setTimeout(() => {
                automaticReturnTimer = null;
                performCarriageReturn();
            }, autoReturnDelay);
        }
    }
    function performCarriageReturn() {
        if (automaticReturnTimer !== null) {
            clearTimeout(automaticReturnTimer);
            automaticReturnTimer = null;
        }
        resetPaperPan({ immediate: true });
        releaseStrike();
        const previousPage = Math.floor(paperLineIndex() / paperRows);
        typedText += '\n';
        renderPaper();
        if (Math.floor(paperLineIndex() / paperRows) > previousPage) {
            sound_pageflip.currentTime = 0;
            playSound(sound_pageflip);
        } else {
            sound_return.currentTime = 0;
            playSound(sound_return);
        }
        layoutPaper(true);
        feedPaper();
        returnTimer = setTimeout(() => {
            returnTimer = null;
            drainPaperJobs();
        }, reducedEyeMotion.matches ? 0 : strikeDuration);
    }

    function feedPaper() {
        d3.select(typingPaper).interrupt().transition()
            .duration(reducedEyeMotion.matches ? 0 : strikeDuration)
            .style('--paper-feed', `${paperAdvance}px`)
            .style('--paper-line-feed', `${paperLineAdvance}px`);
    }

    function carriageReturn() {
        // An explicit Enter returns immediately; cancel a scheduled auto return
        // when there is no earlier buffered input that must be printed first.
        if (automaticReturnTimer !== null && !pendingJobs.length
            && returnTimer === null && queuedStrikeTimer === null) {
            performCarriageReturn();
        } else enqueuePaperJob({ kind: 'return' });
        window.requestMechanismRender?.(700);
    }

    function layoutPaper(animateMarker = false) {
        const style = getComputedStyle(typingSurface);
        const glyphWidth = parseFloat(style.fontSize);
        const lineHeight = parseFloat(style.lineHeight);
        const metrics = paperMetrics();
        typingPaper.style.setProperty('--paper-center-offset', `${(typingPaper.parentElement.clientHeight - lineHeight) / 2}px`);
        const margin = metrics.margin;
        paperAdvance = Array.from(typedText.split('\n').at(-1)).length * glyphWidth;
        const line = paperLineIndex();
        const pageIndex = Math.floor(line / metrics.rows);
        const row = line % metrics.rows;
        paperLineAdvance = pageIndex * (metrics.height + lineHeight) + metrics.verticalMargin + row * lineHeight;
        const markerX = margin + 1 + paperAdvance;
        const markerY = paperLineAdvance + lineHeight - 12;
        const marker = d3.select(printingPoint).interrupt();
        if (animateMarker) marker.transition().duration(reducedEyeMotion.matches ? 0 : strikeDuration)
            .style('left', `${markerX}px`).style('top', `${markerY}px`);
        else {
            marker.style('left', `${markerX}px`).style('top', `${markerY}px`);
            d3.select(typingPaper).interrupt().style('--paper-feed', `${paperAdvance}px`)
                .style('--paper-line-feed', `${paperLineAdvance}px`);
        }
    }
    renderPaper();
    layoutPaper();
    const paperViewport = typingPaper.parentElement;
    let previousPaperWidth = typingPaper.offsetWidth;
    new ResizeObserver(() => {
        if (typingPaper.offsetWidth !== previousPaperWidth) {
            previousPaperWidth = typingPaper.offsetWidth;
            renderPaper();
        }
        layoutPaper();
        positionPaper();
    }).observe(paperViewport);

    let paperDrag = null;
    let paperLastTap = null;
    let paperLongPress = null;
    function clearPaperLongPress() {
        if (paperLongPress !== null) clearTimeout(paperLongPress);
        paperLongPress = null;
    }
    function selectPaperGlyph(glyph) {
        if (!glyph?.isConnected) return;
        const selection = window.getSelection();
        if (!selection || (!selection.isCollapsed && selection.containsNode(glyph, true))) return;
        const range = document.createRange();
        range.selectNodeContents(glyph);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    function resetPaperPan({ immediate = false } = {}) {
        clearPaperLongPress();
        if (paperDrag) {
            const id = paperDrag.id;
            paperDrag = null;
            paperViewport.removeAttribute('data-paper-dragging');
            if (paperViewport.hasPointerCapture(id)) paperViewport.releasePointerCapture(id);
        }
        const pan = d3.select(typingPaper).interrupt('paper-pan');
        if (immediate || reducedEyeMotion.matches) {
            pan.style('--paper-pan-x', '0px').style('--paper-pan-y', '0px');
        } else {
            pan.transition('paper-pan').duration(strikeDuration)
                .style('--paper-pan-x', '0px').style('--paper-pan-y', '0px');
        }
    }
    function movePaperPan(x, y) {
        d3.select(typingPaper).interrupt('paper-pan')
            .style('--paper-pan-x', `${x}px`).style('--paper-pan-y', `${y}px`);
    }
    paperViewport.addEventListener('pointerdown', event => {
        if (!event.isPrimary || ![0, 1].includes(event.button) || event.target.closest('button')) return;
        const inkHit = !!event.target.closest('.paper-glyph');
        // Primary mouse dragging on ink belongs to native text selection.
        // Touch ink is left untouched until a swipe wins over a long press.
        if (inkHit && event.pointerType !== 'touch' && event.button === 0) return;
        const nativeTouch = inkHit && event.pointerType === 'touch';
        clearPaperLongPress();
        if (!nativeTouch) event.preventDefault();
        const style = getComputedStyle(typingPaper);
        paperDrag = { id: event.pointerId, x: event.clientX, y: event.clientY,
            panX: parseFloat(style.getPropertyValue('--paper-pan-x')) || 0,
            panY: parseFloat(style.getPropertyValue('--paper-pan-y')) || 0,
            inkHit, paperHit: !!event.target.closest('#paper-sheet'),
            started: performance.now(), moved: false };
        d3.select(typingPaper).interrupt('paper-pan');
        if (!nativeTouch) paperViewport.setPointerCapture(event.pointerId);
        else {
            const glyph = event.target.closest('.paper-glyph');
            paperLongPress = setTimeout(() => {
                paperLongPress = null;
                if (!paperDrag || paperDrag.id !== event.pointerId || paperDrag.moved) return;
                paperDrag.selectedGlyph = glyph;
                selectPaperGlyph(glyph);
            }, 450);
        }
    });
    paperViewport.addEventListener('pointermove', event => {
        if (!paperDrag || event.pointerId !== paperDrag.id) return;
        if (paperDrag.selectedGlyph) return;
        const dx = event.clientX - paperDrag.x, dy = event.clientY - paperDrag.y;
        if (Math.hypot(dx, dy) > 5) paperDrag.moved = true;
        if (!paperDrag.moved) return;
        clearPaperLongPress();
        event.preventDefault();
        if (!paperViewport.hasPointerCapture(event.pointerId)) paperViewport.setPointerCapture(event.pointerId);
        paperViewport.setAttribute('data-paper-dragging', '');
        movePaperPan(paperDrag.panX + dx, paperDrag.panY + dy);
    });
    paperViewport.addEventListener('pointerup', event => {
        if (!paperDrag || event.pointerId !== paperDrag.id) return;
        const drag = paperDrag;
        clearPaperLongPress();
        paperDrag = null;
        paperViewport.removeAttribute('data-paper-dragging');
        if (paperViewport.hasPointerCapture(event.pointerId)) paperViewport.releasePointerCapture(event.pointerId);
        if (drag.selectedGlyph) {
            requestAnimationFrame(() => selectPaperGlyph(drag.selectedGlyph));
            paperLastTap = null;
            return;
        }
        const now = performance.now();
        if (drag.moved || drag.inkHit || now - drag.started > 400) { paperLastTap = null; return; }
        if (paperLastTap && now - paperLastTap.time < 350
            && Math.hypot(event.clientX - paperLastTap.x, event.clientY - paperLastTap.y) < 24) {
            resetPaperPan();
            paperLastTap = null;
        } else {
            paperLastTap = { time: now, x: event.clientX, y: event.clientY };
            if (drag.paperHit) typingSurface.focus({ preventScroll: true });
        }
    });
    function cancelPaperPan() {
        clearPaperLongPress();
        paperDrag = null;
        paperLastTap = null;
        paperViewport.removeAttribute('data-paper-dragging');
    }
    paperViewport.addEventListener('pointercancel', cancelPaperPan);
    paperViewport.addEventListener('lostpointercapture', () => {
        if (paperDrag) cancelPaperPan();
    });
    paperViewport.addEventListener('dblclick', event => {
        if (event.target.closest('button, .paper-glyph')) return;
        event.preventDefault();
        resetPaperPan();
    });
    paperViewport.addEventListener('wheel', event => {
        if (event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? paperViewport.clientHeight : 1;
        const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
        const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY;
        const style = getComputedStyle(typingPaper);
        const x = parseFloat(style.getPropertyValue('--paper-pan-x')) || 0;
        const y = parseFloat(style.getPropertyValue('--paper-pan-y')) || 0;
        movePaperPan(x - dx * unit, y - dy * unit);
    }, { passive: false });

    function positionPaper() {
        // Reference projection is independent of the user's machine camera/zoom.
        const view = document.getElementById('animation').getBoundingClientRect();
        const viewport = paperViewport.getBoundingClientRect();
        const { rollerRadius, capRadius, groupCount, rollersPerGroup, cameraFov } = machineLayout;
        const rollerOrbit = (2 * capRadius + 0.1) / (2 * Math.sin(Math.PI / rollersPerGroup));
        const mediumOrbit = (2 * (rollerOrbit + capRadius) + 0.15) / (2 * Math.sin(Math.PI / groupCount));
        const tanHalfFov = Math.tan(cameraFov * Math.PI / 360);
        const viewingDistance = 15 * Math.tan(75 * Math.PI / 360) / tanHalfFov;
        const lensDistance = viewingDistance - (mediumOrbit + rollerOrbit + rollerRadius + 0.3 + 0.29);
        const x = view.left + view.width / 2
            + window.machineState.carriageX * view.height / (2 * tanHalfFov * lensDistance) - viewport.left;
        // Keep the marker and the glyph on either side of a print/feed visible.
        // Only constrain automatic tracking; deliberate paper panning stays free.
        const keyboard = document.getElementById('keyboard-toggle');
        const keyboardBounds = keyboard.getBoundingClientRect();
        const keyboardVisible = getComputedStyle(keyboard).visibility !== 'hidden'
            && keyboardBounds.width > 0 && keyboardBounds.height > 0;
        const left = keyboardVisible ? Math.max(0, keyboardBounds.right - viewport.left) : 0;
        const glyphWidth = parseFloat(getComputedStyle(typingSurface).fontSize);
        const clearance = Math.max(glyphWidth, printingPoint.getBoundingClientRect().width / 2) + 8;
        const minimum = left + clearance;
        const maximum = viewport.width - clearance;
        const safeX = minimum <= maximum ? Math.max(minimum, Math.min(maximum, x))
            : (left + viewport.width) / 2;
        typingPaper.style.setProperty('--carriage-x', `${safeX}px`);
    }
    const trackingResize = new ResizeObserver(positionPaper);
    trackingResize.observe(document.getElementById('animation'));
    trackingResize.observe(document.getElementById('keyboard-toggle'));
    window.machineState.subscribeHorizontalPosition(positionPaper);
    window.typewriterPaper = Object.freeze({
        surface: typingSurface,
        duration: strikeDuration,
        get text() { return typedText; },
        get pageSize() { const metrics = paperMetrics(); return { height: metrics.height, rows: metrics.rows, columns: paperColumns, verticalMargin: metrics.verticalMargin }; },
        get pendingReturn() { return automaticReturnTimer !== null; },
        whenIdle() {
            if (!paperBusy() && !pendingJobs.length) return Promise.resolve();
            return new Promise(resolve => idleWaiters.push(resolve));
        },
        append: appendPaperText,
        feed: feedPaper,
        carriageReturn,
        strike,
        release: releaseStrike,
        restore: renderPaper,
        resetPan: resetPaperPan
    });
})();
