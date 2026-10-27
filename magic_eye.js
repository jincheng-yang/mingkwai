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

d3.csv('dev/wubi06.csv').then(data => {
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
}).catch(error => console.error('Unable to load magic-eye characters:', error));

document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const key = event.key;
    const newRow = 'GFDSAHJKLMTREWQYUIOPNBVCX'.indexOf(key);
    const newCol = 'qazwsxedcrfvtgbyhnujmikolp[]'.indexOf(key);
    const choice = '12345678 '.indexOf(key);
    if (key.length !== 1 || (newRow === -1 && newCol === -1 && choice === -1)) return;
    event.preventDefault();

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
        ind = choice;
        activeStrikeKey = key;
        playSound(sound_keydown);
        const character = choice === 8 ? '　' : Array.from(block.chars)[choice] || '　';
        document.getElementById('text').textContent += character;
        if (choice !== 8) {
            d3.select('#text').interrupt().transition()
                .duration(reducedEyeMotion.matches ? 0 : 100).style('padding-top', '10px');
        }
    }
});

function releaseStrike() {
    if (activeStrikeKey === null) return;
    activeStrikeKey = null;
    playSound(sound_keyup);
    d3.select('#text').interrupt().transition()
        .duration(reducedEyeMotion.matches ? 0 : 100).style('padding-top', '0px');
}
document.addEventListener('keyup', event => {
    if (event.key === activeStrikeKey) releaseStrike();
});
window.addEventListener('blur', releaseStrike);
