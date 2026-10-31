// Shared by the candidate selector and the mechanical animation.
const machineLayout = Object.freeze({
    groupCount: 6,
    rollersPerGroup: 6,
    facesPerRoller: 8,
    columnCount: 28,
    rowKeys: 'GFDSA!HJKLM@TREWQ#YUIOP$NBVCX%^&*()Z',
    columnKeys: 'qazwsxedcrfvtgbyhnujmik9ol0p'
});

const magicEye = document.getElementById('magic_eye');
const candidateTable = document.getElementById('table');
let rect = magicEye.getBoundingClientRect();
let rect2 = { width: 66, height: 114 };
let spacing = [32, 32];
let blocks = [];

// These values also drive the mechanical animation.
var row = machineLayout.rowKeys.indexOf('P');
var col = machineLayout.columnKeys.indexOf('b');
var largeFrom = Math.PI * 2 * Math.floor(row / machineLayout.rollersPerGroup) / machineLayout.groupCount;
var largeTo = largeFrom;
var mediumFrom = Math.PI * 2 * (row % machineLayout.rollersPerGroup) / machineLayout.rollersPerGroup;
var mediumTo = mediumFrom;
var ind = -1;

const sound_keydown = new Audio('assets/audio/keydown.mp3');
const sound_keyup = new Audio('assets/audio/keyup.mp3');
const sound_swoosh = new Audio('assets/audio/swoosh.mp3');
sound_swoosh.volume = 0.1;
const sound_gear = Array.from({ length: 4 }, (_, index) => new Audio(`assets/audio/gear${index + 1}.mp3`));
const reducedEyeMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeStrikeKey = null;
let rowMoveStartedAt = -1000;
let columnMoveStartedAt = -1000;
let rowFrom = row;
let columnFrom = col;
let cardLayers = [];
let cardRasterCache = null;
let cardOffsets = [];
let lastCardRow = null;
let readerCover = null;
let readerMotion = null;
let readerMarkerCache = null;
let lastReaderColumn = null;
let readerViewport = null;
const readerSlitPadding = 4;
const readerOpacityControl = document.getElementById('reader-opacity');
const readerOpacityValue = document.getElementById('reader-opacity-value');
let readerCoverOpacity = Number(readerOpacityControl?.value ?? 80) / 100;

function updateReaderOpacity() {
    const percent = Math.max(0, Math.min(100, Number(readerOpacityControl.value)));
    readerCoverOpacity = percent / 100;
    document.getElementById('card-reader-mask')?.setAttribute('fill-opacity', readerCoverOpacity);
    readerOpacityControl.setAttribute('aria-valuetext', `${percent}%`);
    readerOpacityValue.value = `${percent}%`;
}
readerOpacityControl?.addEventListener('input', updateReaderOpacity);

// Return to the previous typing focus after mouse/touch adjustment. Leave the
// native range interaction intact, including Tab and arrow-key access.
let readerOpacityPointer = null;
let readerOpacityPreviousFocus = null;
readerOpacityControl?.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    readerOpacityPointer = event.pointerId;
    readerOpacityPreviousFocus = document.activeElement === readerOpacityControl
        ? document.getElementById('text') : document.activeElement;
});
function restoreReaderOpacityFocus(event) {
    if (event.pointerId !== readerOpacityPointer) return;
    readerOpacityPointer = null;
    if (document.activeElement === readerOpacityControl) {
        if (readerOpacityPreviousFocus?.isConnected && readerOpacityPreviousFocus !== document.body) {
            readerOpacityPreviousFocus.focus({ preventScroll: true });
        } else {
            readerOpacityControl.blur();
        }
    }
    readerOpacityPreviousFocus = null;
}
window.addEventListener('pointerup', restoreReaderOpacityFocus);
window.addEventListener('pointercancel', restoreReaderOpacityFocus);

// The mechanical animation follows selection state, independent of the reader UI.
function currentMechanismSelection(now = performance.now()) {
    const progress = startedAt => reducedEyeMotion.matches ? 1
        : d3.easeCubicInOut(Math.max(0, Math.min(1, (now - startedAt) / 1000)));
    const rowProgress = progress(rowMoveStartedAt);
    const columnProgress = progress(columnMoveStartedAt);
    return {
        // The former vertical table position, expressed in row spacings.
        row: rowFrom + (row - rowFrom) * rowProgress,
        large: largeFrom + (largeTo - largeFrom) * rowProgress,
        medium: mediumFrom + (mediumTo - mediumFrom) * rowProgress,
        column: columnFrom + (col - columnFrom) * columnProgress
    };
}

function playSound(sound) {
    // Audio availability must not prevent selection or typing.
    sound.play().catch(() => {});
}

function selectedCell() {
    return candidateTable?.rows[row]?.cells[col];
}

function selectedPosition() {
    const cell = selectedCell();
    if (!cell) return null;
    const cellBounds = cell.getBoundingClientRect();
    const tableBounds = candidateTable.getBoundingClientRect();
    // Use real cell offsets rather than assuming all rows have the first row's height.
    return {
        left: rect.width / 2 - (cellBounds.left - tableBounds.left) - cellBounds.width / 2,
        top: rect.height / 2 - (cellBounds.top - tableBounds.top) - cellBounds.height / 2,
        width: cellBounds.width,
        height: cellBounds.height
    };
}

function layoutMagicEye() {
    const firstCell = candidateTable?.querySelector('td');
    if (!firstCell) return;
    // Stop existing movement before measuring. Neither clipping nor font swaps
    // should leave the selected card outside the clear aperture.
    d3.select(candidateTable).interrupt('row').interrupt('column');
    rect = magicEye.getBoundingClientRect();
    rect2 = firstCell.getBoundingClientRect();
    spacing = getComputedStyle(candidateTable).borderSpacing.split(/\s+/).map(parseFloat);
    if (spacing.length === 1) spacing[1] = spacing[0];
    const position = selectedPosition();
    if (!position) return;
    d3.select(candidateTable).style('left', `${position.left}px`).style('top', `${position.top}px`);

    const openingWidth = position.width + 2 * spacing[0] / 3;
    const openingHeight = position.height + 2 * spacing[1] / 3;
    d3.select('#magic-eye-mask')
        .style('width', `${openingWidth}px`)
        .style('height', `${openingHeight}px`);
}

layoutMagicEye();
new ResizeObserver(() => {
    layoutMagicEye();
    layoutCardReader();
}).observe(magicEye);
document.fonts.ready.then(layoutMagicEye);

function eyeSvgElement(name, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
}

function readerApertureAt(column) {
    const slit = window.MingKwaiCards.slitAt(column);
    return {
        x: slit.x - readerSlitPadding, y: slit.y - readerSlitPadding,
        width: slit.width + 2 * readerSlitPadding, height: slit.height + 2 * readerSlitPadding,
        rx: slit.rx + readerSlitPadding
    };
}

function layoutCardReader() {
    if (!readerCover) return;
    const bounds = magicEye.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const { width, height, selectionShift } = window.MingKwaiCards;
    const cardWidth = width - selectionShift;
    // Reserve a left gutter for the slider while the cover reaches every edge.
    const leftInset = readerOpacityControl ? 64 : 16;
    const rightInset = 16;
    const scale = Math.min(Math.max(1, bounds.width - leftInset - rightInset) / cardWidth, Math.max(1, bounds.height - 24) / height);
    const viewWidth = bounds.width / scale;
    const viewHeight = bounds.height / scale;
    const viewport = {
        x: selectionShift + (cardWidth - viewWidth) / 2 - (leftInset - rightInset) / (2 * scale),
        y: (height - viewHeight) / 2,
        width: viewWidth, height: viewHeight
    };
    document.getElementById('card-stack-art').setAttribute('viewBox', `${viewport.x} ${viewport.y} ${viewWidth} ${viewHeight}`);
    readerViewport = viewport;
    layoutReaderCover();
    if (cardRasterCache) {
        const rasterScale = scale * (window.devicePixelRatio || 1);
        const rasterizing = Promise.all([
            cardRasterCache.ensureScale(rasterScale),
            readerMarkerCache.ensureScale(rasterScale)
        ]);
        rasterizing.catch(error => {
            console.error('Unable to cache card artwork:', error);
            window.simulatorLoading?.fail(error);
        });
        return rasterizing;
    }
}

function layoutReaderCover() {
    if (!readerCover || !readerViewport) return;
    const { x, y, width, height } = readerViewport;
    const { slitAt, roundedRectPath } = window.MingKwaiCards;
    const travel = slitAt(machineLayout.columnCount - 1).x - slitAt(0).x;
    // Overscan covers every viewport edge throughout the full column travel.
    const margin = travel + 1;
    const opening = roundedRectPath(readerApertureAt(0));
    const coveredPath = `M${x - margin} ${y - 1} h${width + 2 * margin} v${height + 2} h${-width - 2 * margin} Z ${opening}`;
    readerCover.setAttribute('d', coveredPath);
}

async function renderCardStack(data) {
    const { groupCards, width, height, selectionShift } = window.MingKwaiCards;
    const cards = groupCards(data);
    const stack = document.getElementById('card-stack-art');
    stack.setAttribute('viewBox', `${selectionShift} 0 ${width - selectionShift} ${height}`);
    cardRasterCache = window.MingKwaiCardRaster.createCache(cards, fraction => {
        window.simulatorLoading?.report('candidates', fraction);
    });
    cardLayers = cardRasterCache.images;
    cardOffsets = cards.map(() => NaN);
    lastCardRow = null;
    // Later cards sit above earlier ones, exposing a selected tab as it moves left.
    const layers = eyeSvgElement('g', { id: 'card-stack-layers' });
    layers.replaceChildren(...cardLayers);

    // Draw the cached stack once beneath the cover's clear opening.
    readerCover = eyeSvgElement('path', {
        id: 'card-reader-mask', fill: '#d3d8cc', 'fill-opacity': readerCoverOpacity,
        'fill-rule': 'evenodd', 'pointer-events': 'none'
    });
    readerMarkerCache = window.MingKwaiCardRaster.createMarkerCache();
    const slit = window.MingKwaiCards.slitAt(0);
    const markerX = slit.x + slit.width / 2 + selectionShift;
    readerMarkerCache.image.setAttribute('transform', `translate(${markerX} 0)`);
    readerMotion = eyeSvgElement('g', { id: 'card-reader-motion' });
    readerMotion.append(readerCover, readerMarkerCache.image);
    stack.replaceChildren(layers, readerMotion);
    lastReaderColumn = null;
    await layoutCardReader();
    const selection = currentMechanismSelection();
    updateCardStack(selection.row);
    updateCardReader(selection.column);
}

function updateCardReader(animatedColumn) {
    if (!readerCover || animatedColumn === lastReaderColumn) return;
    lastReaderColumn = animatedColumn;
    const { slitAt } = window.MingKwaiCards;
    const offset = slitAt(animatedColumn).x - slitAt(0).x;
    readerMotion.setAttribute('transform', `translate(${offset} 0)`);
}

function updateCardStack(animatedRow) {
    if (!cardLayers.length || animatedRow === lastCardRow) return;
    lastCardRow = animatedRow;
    const { selectionShift } = window.MingKwaiCards;
    cardLayers.forEach((layer, index) => {
        // Only a card within half a row of the old vertical selection moves.
        // Smoothstep gives a soft approach and departure, with full travel at
        // the row center. Passing intermediate rows briefly reveals their cards.
        const proximity = Math.max(0, 1 - Math.abs(animatedRow - index) / 0.5);
        const engagement = proximity * proximity * (3 - 2 * proximity);
        const offset = Math.round(selectionShift * engagement * 1000) / 1000;
        if (offset === cardOffsets[index]) return;
        layer.setAttribute('transform', `translate(${offset} 0)`);
        cardOffsets[index] = offset;
    });
}

window.simulatorLoading.loadText('dev/wubi06.csv', 'candidateDownload', 43933).then(async source => {
    const data = d3.csvParse(source);
    blocks = data;
    if (!candidateTable) {
        await renderCardStack(data);
        window.simulatorLoading?.ready('candidates');
        return;
    }
    // Build the same markup in Jekyll and plain static previews.
    const body = document.createElement('tbody');
    let tableRow;
    data.forEach((block, index) => {
        if (index % machineLayout.columnCount === 0) tableRow = body.insertRow();
        const cell = tableRow.insertCell();
        const card = document.createElement('div');
        card.className = 'eight';
        const characters = document.createElement('p');
        characters.className = 'characters';
        const choices = Array.from(block.chars || '');
        const originalCount = Array.from(block.original || '').length;
        for (let choice = 0; choice < machineLayout.facesPerRoller; choice++) {
            const borrowed = choice >= originalCount && choices[choice];
            const character = document.createElement(borrowed ? 'em' : 'span');
            character.className = 'candidate';
            character.textContent = choices[choice] || '　';
            // Keys 1–4 run down the right column; 5–8 down the left.
            character.style.gridColumn = choice < 4 ? '2' : '1';
            character.style.gridRow = String(choice % 4 + 1);
            characters.append(character);
        }
        const hint = document.createElement('span');
        hint.className = 'hint';
        const hintText = document.createElement('code');
        hintText.textContent = block.hint || '';
        hint.append(hintText);
        card.append(characters, hint);
        cell.append(card);
    });
    candidateTable.replaceChildren(body);
    layoutMagicEye();
    window.simulatorLoading?.ready('candidates');
}).catch(error => {
    console.error('Unable to load magic-eye characters:', error);
    window.simulatorLoading?.fail(error);
});

const typingSurface = document.getElementById('text');
const printingPoint = document.getElementById('printing-point');
const keyboardToggle = document.getElementById('keyboard-toggle');
let typedText = typingSurface.textContent;
let activeStrikeIsMobile = false;
const mobileKeys = [];
let mobileTyping = false;
const strikeDuration = 300;
let strikeStartedAt = 0;
let strikeReleaseTimer = null;
let composing = false;
const touchKeyboard = window.matchMedia('(any-pointer: coarse)');

function typeKey(key, mobile = false) {
    const newRow = machineLayout.rowKeys.indexOf(key);
    const newCol = machineLayout.columnKeys.indexOf(key);
    const choice = '12345678 '.indexOf(key);
    if (key.length !== 1 || (newRow === -1 && newCol === -1 && choice === -1)) return;

    if (newRow !== -1 && newRow !== row) {
        const middleDiff = Math.abs(newRow % machineLayout.rollersPerGroup - row % machineLayout.rollersPerGroup);
        const largeDiff = Math.abs(Math.floor(newRow / machineLayout.rollersPerGroup) - Math.floor(row / machineLayout.rollersPerGroup));
        const gearSteps = Math.max(middleDiff, largeDiff);
        playSound(sound_gear[Math.min(gearSteps, sound_gear.length) - 1]);
        const now = performance.now();
        const current = currentMechanismSelection(now);
        rowFrom = current.row;
        largeFrom = current.large;
        mediumFrom = current.medium;
        rowMoveStartedAt = now;
        row = newRow;
        largeTo = Math.PI * 2 * Math.floor(row / machineLayout.rollersPerGroup) / machineLayout.groupCount;
        mediumTo = Math.PI * 2 * (row % machineLayout.rollersPerGroup) / machineLayout.rollersPerGroup;
        const position = selectedPosition();
        if (position) {
            d3.select(candidateTable).interrupt('row').transition('row')
                .duration(reducedEyeMotion.matches ? 0 : 1000).style('top', `${position.top}px`);
        }
        window.requestMechanismRender?.(1600);
    }
    if (newCol !== -1 && newCol !== col) {
        const distance = Math.abs(newCol - col);
        sound_swoosh.playbackRate = 1 / Math.min(2, 1 + distance / 10);
        sound_swoosh.preservesPitch = true;
        sound_swoosh.currentTime = 0;
        playSound(sound_swoosh);
        const now = performance.now();
        columnFrom = currentMechanismSelection(now).column;
        columnMoveStartedAt = now;
        col = newCol;
        const position = selectedPosition();
        if (position) {
            // Independent transitions allow the two-letter code to be typed quickly.
            d3.select(candidateTable).interrupt('column').transition('column')
                .duration(reducedEyeMotion.matches ? 0 : 1000).style('left', `${position.left}px`);
        }
        window.requestMechanismRender?.(1600);
    }
    if (choice !== -1) {
        const block = blocks[row * machineLayout.columnCount + col];
        if (!block && choice !== 8) return;
        releaseStrike();
        ind = choice;
        activeStrikeKey = key;
        activeStrikeIsMobile = mobile;
        strikeStartedAt = performance.now();
        playSound(sound_keydown);
        const character = choice === 8 ? '　' : Array.from(block.chars)[choice] || '　';
        typedText += character;
        typingSurface.textContent = typedText;
        const range = document.createRange();
        range.setStart(typingSurface.firstChild, typedText.length - character.length);
        range.setEnd(typingSurface.firstChild, typedText.length);
        const advance = range.getBoundingClientRect().width || parseFloat(getComputedStyle(typingSurface).fontSize);
        // Compensate immediately for the appended glyph, keeping the previous
        // text in place until release advances the paper by one glyph.
        d3.select(typingSurface).interrupt()
            .style('--paper-offset', `${advance}px`)
            .transition().duration(reducedEyeMotion.matches ? 0 : strikeDuration)
            .style('--strike-progress', choice === 8 ? '0' : '1');
        d3.select(printingPoint).interrupt().transition()
            .duration(reducedEyeMotion.matches ? 0 : strikeDuration)
            .style('--marker-offset', `${advance}px`);
        window.requestMechanismRender?.(700);
    }
}

document.addEventListener('keydown', event => {
    if (window.simulatorLoading?.active) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const editable = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]');
    if (editable && editable !== typingSurface) return;
    // Some software keyboards report physical-looking codes and immediately
    // send keyup. On touch devices, use committed input and a timed strike.
    if (editable && (touchKeyboard.matches || !event.code || event.keyCode === 229)) return;
    if (event.key.length !== 1 || !(machineLayout.rowKeys + machineLayout.columnKeys + '12345678 ').includes(event.key)) return;
    event.preventDefault();
    if (event.repeat) return;
    typeKey(event.key);
});

function typeMobileText(text) {
    typingSurface.textContent = typedText;
    mobileKeys.push(...text || '');
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
    if (composing || event.isComposing || !event.cancelable) return;
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
    while (start < typedText.length && start < edited.length && typedText[start] === edited[start]) start++;
    let oldEnd = typedText.length;
    let newEnd = edited.length;
    while (oldEnd > start && newEnd > start && typedText[oldEnd - 1] === edited[newEnd - 1]) {
        oldEnd--;
        newEnd--;
    }
    return edited.slice(start, newEnd);
}

typingSurface.addEventListener('input', event => {
    if (composing || event.isComposing || typingSurface.textContent === typedText) return;
    // Restore the output when a keyboard delivers a noncancelable edit.
    const insertion = event.inputType?.startsWith('insert');
    typeMobileText(insertion ? event.data ?? insertedSurfaceText() : '');
});
typingSurface.addEventListener('compositionstart', () => { composing = true; });
typingSurface.addEventListener('compositionend', event => {
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
    if (strikeReleaseTimer !== null) {
        clearTimeout(strikeReleaseTimer);
        strikeReleaseTimer = null;
    }
    if (activeStrikeKey === null) return;
    activeStrikeKey = null;
    activeStrikeIsMobile = false;
    playSound(sound_keyup);
    d3.select(typingSurface).interrupt().transition()
        .duration(reducedEyeMotion.matches ? 0 : strikeDuration)
        .style('--strike-progress', '0').style('--paper-offset', '0px');
    d3.select(printingPoint).interrupt().transition()
        .duration(reducedEyeMotion.matches ? 0 : strikeDuration)
        .style('--marker-offset', '0px');
    window.requestMechanismRender?.(700);
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

function resizeVisibleViewport() {
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty('--viewport-height', `${viewport ? viewport.height : window.innerHeight}px`);
    document.documentElement.style.setProperty('--viewport-top', `${viewport ? viewport.offsetTop : 0}px`);
}

// Mobile keyboards often resize only the visual viewport, not the layout
// viewport. Keep both the mechanism and magic eye inside the visible area.
window.visualViewport?.addEventListener('resize', resizeVisibleViewport);
window.visualViewport?.addEventListener('scroll', resizeVisibleViewport);
window.addEventListener('resize', resizeVisibleViewport);
resizeVisibleViewport();

// The instruction screen focuses the typing surface when the user starts.
