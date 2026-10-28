const magicEye = document.getElementById('magic_eye');
const candidateTable = document.getElementById('table');
let rect = magicEye.getBoundingClientRect();
let rect2 = { width: 66, height: 114 };
let spacing = [32, 32];
let blocks = [];

// These values also drive the mechanical animation.
var row = 19;
var col = 14;
var tableFrom = 0;
var tableTo = 0;
var largeFrom = Math.PI * 2 * Math.floor(row / 5) / 5;
var largeTo = largeFrom;
var mediumFrom = Math.PI * 2 * (row % 5) / 5;
var mediumTo = mediumFrom;
var ind = -1;

const sound_keydown = new Audio('assets/audio/keydown.mp3');
const sound_keyup = new Audio('assets/audio/keyup.mp3');
const sound_swoosh = new Audio('assets/audio/swoosh.mp3');
sound_swoosh.volume = 0.1;
const sound_gear = Array.from({ length: 4 }, (_, index) => new Audio(`assets/audio/gear${index + 1}.mp3`));
const reducedEyeMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeStrikeKey = null;

function playSound(sound) {
    // Audio availability must not prevent selection or typing.
    sound.play().catch(() => {});
}

function selectedCell() {
    return candidateTable.rows[row]?.cells[col];
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
    const firstCell = candidateTable.querySelector('td');
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
    tableFrom = tableTo = position.top;
    largeFrom = largeTo = Math.PI * 2 * Math.floor(row / 5) / 5;
    mediumFrom = mediumTo = Math.PI * 2 * (row % 5) / 5;
    d3.select(candidateTable).style('left', `${position.left}px`).style('top', `${position.top}px`);

    const openingWidth = position.width + 2 * spacing[0] / 3;
    const openingHeight = position.height + 2 * spacing[1] / 3;
    d3.select('#magic-eye-mask')
        .style('width', `${openingWidth}px`)
        .style('height', `${openingHeight}px`);
}

layoutMagicEye();
new ResizeObserver(layoutMagicEye).observe(magicEye);
document.fonts.ready.then(layoutMagicEye);

window.simulatorLoading.loadText('dev/wubi06.csv', 'candidateDownload', 28354).then(source => {
    const data = d3.csvParse(source);
    blocks = data;
    // Build the same markup in Jekyll and plain static previews.
    const body = document.createElement('tbody');
    let tableRow;
    data.forEach((block, index) => {
        if (index % 28 === 0) tableRow = body.insertRow();
        const cell = tableRow.insertCell();
        const card = document.createElement('div');
        card.className = 'eight';
        const characters = document.createElement('p');
        characters.className = 'characters';
        const choices = Array.from(block.chars || '');
        const originalCount = Array.from(block.original || '').length;
        for (let choice = 0; choice < 8; choice++) {
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
        const hintText = document.createElement('i');
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
    const newRow = 'GFDSAHJKLMTREWQYUIOPNBVCX'.indexOf(key);
    const newCol = 'qazwsxedcrfvtgbyhnujmikolp[]'.indexOf(key);
    const choice = '12345678 '.indexOf(key);
    if (key.length !== 1 || (newRow === -1 && newCol === -1 && choice === -1)) return;

    if (newRow !== -1 && newRow !== row) {
        const middleDiff = Math.abs(newRow - row) % 5;
        const largeDiff = Math.floor(Math.abs(newRow - row) / 5);
        playSound(sound_gear[Math.max(middleDiff, largeDiff) - 1]);
        const currentTop = parseFloat(candidateTable.style.top) || 0;
        const progress = tableFrom === tableTo ? 1 : Math.max(0, Math.min(1, (currentTop - tableFrom) / (tableTo - tableFrom)));
        largeFrom += (largeTo - largeFrom) * progress;
        mediumFrom += (mediumTo - mediumFrom) * progress;
        tableFrom = currentTop;
        row = newRow;
        largeTo = Math.PI * 2 * Math.floor(row / 5) / 5;
        mediumTo = Math.PI * 2 * (row % 5) / 5;
        const position = selectedPosition();
        if (position) {
            tableTo = position.top;
            d3.select(candidateTable).interrupt('row').transition('row')
                .duration(reducedEyeMotion.matches ? 0 : 1000).style('top', `${tableTo}px`);
        }
    }
    if (newCol !== -1) {
        if (key >= 'a' && key <= 'z') {
            const distance = Math.abs(newCol - col);
            sound_swoosh.playbackRate = 1 / Math.min(2, 1 + distance / 10);
            sound_swoosh.preservesPitch = true;
            sound_swoosh.currentTime = 0;
            playSound(sound_swoosh);
        }
        col = newCol;
        const position = selectedPosition();
        if (position) {
            // Independent transitions allow the two-letter code to be typed quickly.
            d3.select(candidateTable).interrupt('column').transition('column')
                .duration(reducedEyeMotion.matches ? 0 : 1000).style('left', `${position.left}px`);
        }
    }
    if (choice !== -1) {
        const block = blocks[row * 28 + col];
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
    if (event.key.length !== 1 || !'GFDSAHJKLMTREWQYUIOPNBVCXqazwsxedcrfvtgbyhnujmikolp[]12345678 '.includes(event.key)) return;
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
