// Card artwork and reader viewport; selection comes from machineState.
const magicEye = document.getElementById('magic_eye');
const candidateTable = document.getElementById('table');
let rect = magicEye.getBoundingClientRect();
let rect2 = { width: 66, height: 114 };
let spacing = [32, 32];

const reducedEyeMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let cardLayers = [];
let cardRasterCache = null;
let cardOffsets = [];
let lastCardRow = null;
let readerCover = null;
let readerMotion = null;
let readerMarkerCache = null;
let cardStackMotion = null;
let mobileKeyboardOpen = false;
let lastReaderColumn = null;
let readerViewport = null;
let readerBackgroundOffset = 0;
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

function selectedCell() {
    return candidateTable?.rows[window.machineState.targetVerticalPosition]?.cells[window.machineState.targetHorizontalPosition];
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
    // Fit the artwork to the available height, allowing horizontal cropping.
    // The opacity control is outside the usable slit travel on every device.
    let leftInset = 16, rightInset = 16, topInset = 12, bottomInset = 12;
    const control = document.querySelector('.reader-opacity-control')?.getBoundingClientRect();
    if (control) {
        if (control.width > control.height) bottomInset = Math.max(bottomInset, bounds.bottom - control.top + 8);
        else leftInset = Math.max(leftInset, control.right - bounds.left + 12);
    }
    const aperture = readerApertureAt(0);
    const availableHeight = Math.max(1, bounds.height - topInset - bottomInset);
    const scale = availableHeight / (mobileKeyboardOpen ? aperture.height : height);
    const viewWidth = bounds.width / scale;
    const viewHeight = bounds.height / scale;
    const centerY = mobileKeyboardOpen ? aperture.y + aperture.height / 2 : height / 2;
    const viewport = {
        x: selectionShift + (cardWidth - viewWidth) / 2 - (leftInset - rightInset) / (2 * scale),
        y: centerY - (topInset + availableHeight / 2) / scale,
        width: viewWidth, height: viewHeight
    };
    const guard = Math.min(12, Math.max(0, (bounds.width - leftInset - rightInset) / 4));
    viewport.slitMin = viewport.x + (leftInset + guard) / scale + aperture.width / 2;
    viewport.slitMax = viewport.x + (bounds.width - rightInset - guard) / scale - aperture.width / 2;
    if (viewport.slitMin > viewport.slitMax) {
        viewport.slitMin = viewport.slitMax = viewport.x + (leftInset + bounds.width - rightInset) / (2 * scale);
    }
    document.getElementById('card-stack-art').setAttribute('viewBox', `${viewport.x} ${viewport.y} ${viewWidth} ${viewHeight}`);
    readerViewport = viewport;
    layoutReaderCover();
    positionCardReader(lastReaderColumn ?? window.machineState.mechanismSelection.column);
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
    const margin = travel + width + 1;
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
    cardStackMotion = layers;

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
    readerBackgroundOffset = 0;
    await layoutCardReader();
    const selection = window.machineState.mechanismSelection;
    updateCardStack(selection.row);
    updateCardReader(selection.column);
}

function updateCardReader(animatedColumn) {
    if (!readerCover || animatedColumn === lastReaderColumn) return;
    lastReaderColumn = animatedColumn;
    positionCardReader(animatedColumn);
}

function positionCardReader(animatedColumn) {
    if (!readerMotion || !cardStackMotion) return;
    const { slitAt } = window.MingKwaiCards;
    const offset = slitAt(animatedColumn).x - slitAt(0).x;
    const aperture = readerApertureAt(0);
    const center = aperture.x + aperture.width / 2;
    const desired = center + offset + readerBackgroundOffset;
    const clamped = Math.max(readerViewport.slitMin, Math.min(readerViewport.slitMax, desired));
    // Preserve the current card offset until the slit reaches a safe boundary.
    readerBackgroundOffset += clamped - desired;
    const coverTransform = `translate(${offset + readerBackgroundOffset} 0)`;
    const cardsTransform = `translate(${readerBackgroundOffset} 0)`;
    if (readerMotion.getAttribute('transform') !== coverTransform) readerMotion.setAttribute('transform', coverTransform);
    if (cardStackMotion.getAttribute('transform') !== cardsTransform) cardStackMotion.setAttribute('transform', cardsTransform);
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

window.keyboardController.ready.then(async data => {
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

window.keyboardController.onKeyboardChange(open => {
    mobileKeyboardOpen = open;
    layoutCardReader();
});
window.machineState.subscribeHorizontalPosition(position => {
    updateCardReader(position);
    if (candidateTable) layoutMagicEye();
});
window.machineState.subscribeVerticalPosition(position => {
    updateCardStack(position);
    if (candidateTable) layoutMagicEye();
});
