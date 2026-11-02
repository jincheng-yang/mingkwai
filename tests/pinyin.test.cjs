const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const rowKeys = 'GFDSA!HJKLM@TREWQ#YUIOP$NBVCX%^&*()Z';
const columnKeys = 'qazwsxedcrfvtgbyhnujmik9ol0p';
function parser() {
    const context = { window: {}, Date: undefined, performance: undefined };
    vm.createContext(context);
    vm.runInContext(source('pinyin.js'), context);
    // The parser runs without performance, Date, timers or a clock argument.
    return { input: context.window.createPinyinParser() };
}
function spell(input, text) {
    let result;
    for (const key of text) result = input.push(key);
    return result;
}
function csv(name) {
    const lines = source(name).trim().split('\n');
    const headers = lines.shift().split(',');
    return lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [headers[i], value])));
}

test('ZH and growing finals move only their respective mechanical controls', () => {
    const { input } = parser();
    assert.equal(input.push('Z').rowKey, 'Z');
    assert.equal(input.push('H').rowKey, 'V');
    for (const [key, column] of [['u', 'u'], ['a', 'x'], ['n', 'r'], ['g', 'l']]) {
        const result = input.push(key);
        assert.equal(result.rowKey, null);
        assert.equal(result.columnKey, column);
    }
    assert.equal(input.text, 'uang');
});

test('ZH/CH/SH require uppercase H and work without a clock; lowercase h stays a column key', () => {
    for (const [initial, row] of [['Z', 'V'], ['C', 'I'], ['S', 'U']]) {
        const { input } = parser();
        input.push(initial);
        assert.equal(input.push('H').rowKey, row);
        input.push(initial);
        const lower = input.push('h');
        assert.equal(lower.rowKey, null);
        assert.equal(lower.columnKey, 'h');
    }
});

test('every compound final is recognized without consulting a clock', () => {
    const finals = { ai:'d',ei:'w',ao:'c',ou:'z',an:'j',en:'f',ang:'h',eng:'g',ong:'s',ia:'x',ie:'p',iao:'n',iu:'q',ian:'m',in:'b',iang:'l',ing:'k',iong:'s',ua:'x',uo:'o',uai:'k',ui:'v',uan:'r',un:'y',uang:'l',ue:'t',ve:'t' };
    for (const [final, code] of Object.entries(finals)) {
        const { input } = parser();
        assert.equal(spell(input, final).columnKey, code, final);
        assert.equal(input.push('a').columnKey, 'a', `${final} falls back on a new letter`);
    }
});

test('Ming followed by a and invalid syllable sequences always move the pressed key', () => {
    const { input } = parser();
    assert.equal(spell(input, 'Ming').columnKey, 'k');
    assert.equal(input.push('a').columnKey, 'a');
    assert.equal(input.text, 'a');
    assert.equal(input.push('z').columnKey, 'z');
    assert.equal(input.push('Q').rowKey, 'Q');
    assert.equal(input.push('x').columnKey, 'x');
    assert.equal(input.push('b').columnKey, 'b');
    // Intermediate prefixes also preserve direct movement before a full match.
    assert.equal(input.push('i').columnKey, 'i');
    assert.equal(input.push('o').columnKey, 'o');
    assert.equal(input.push('n').columnKey, 'n');
    assert.equal(input.push('g').columnKey, 's');
});

test('zero-initial combinations retain Xiaohe codes; uppercase vowels do not move columns', () => {
    for (const [text, column] of Object.entries({ Ai:'i',An:'n',Ang:'h',Ao:'o',Ei:'i',En:'n',Eng:'g',Er:'r',Ou:'u',Ong:'s' })) {
        const { input } = parser();
        const first = input.push(text[0]);
        assert.equal(first.rowKey, text[0]);
        assert.equal(first.columnKey, null);
        assert.equal(spell(input, text.slice(1)).columnKey, column, text);
    }
    const { input } = parser();
    assert.equal(input.push('ü').columnKey, 'v');
    assert.equal(input.push('e').columnKey, 't');
});

test('non-letter keys do not change the buffer or interrupt a continuation', () => {
    const { input } = parser();
    input.push('u');
    for (const key of ['Backspace', 'Enter', '\n', ' ', '1', 'Tab', '!', '9', '0']) {
        assert.equal(input.push(key), null);
        assert.equal(input.text, 'u', key);
    }
    assert.equal(input.push('a').columnKey, 'x');
});

async function keyboard(mode = 'pinyin') {
    let now = 0;
    class Element {
        constructor() { this.handlers = new Map(); this.textContent = ''; }
        addEventListener(name, callback) { this.handlers.set(name, callback); }
        setAttribute() {}
        closest() { return this; }
    }
    const surface = new Element(), toggle = new Element(), document = new Element();
    document.documentElement = { clientWidth: 1280, style: { setProperty() {} }, classList: { toggle() {} } };
    document.getElementById = id => id === 'text' ? surface : toggle;
    const printed = [];
    const paper = { surface, duration: 300, text: '', resetPan() {}, restore() {}, release() {}, carriageReturn() { printed.push('\n'); }, strike(char) { printed.push(char); } };
    const rows = csv(mode === 'pinyin' ? 'dev/pinyin/pinyin.csv' : 'dev/shuangpin-xiaohe/shuangpin-xiaohe.csv');
    const window = { typewriterPaper: paper, simulatorLoading: { active: false, scheme: { id: mode, initialRow: 'Z', initialColumn: 'i' }, loadText: async () => '', fail(error) { throw error; } },
        matchMedia: query => ({ matches: query.includes('reduced-motion'), addEventListener() {} }), addEventListener() {}, innerHeight: 844, screen: { availHeight: 844 } };
    const context = { window, document, Element, navigator: {}, performance: { now: () => now }, setTimeout, clearTimeout,
        Audio: class { play() { return Promise.resolve(); } pause() {} }, d3: { csvParse: () => rows } };
    vm.createContext(context);
    for (const name of ['machine-state.js', 'pinyin.js', 'keyboard.js']) vm.runInContext(source(name), context);
    await window.keyboardController.ready;
    return { api: window.keyboardController, printed, surface, document, rows, time(value) { now = value; },
        selection() { return rowKeys[window.machineState.targetVerticalPosition] + columnKeys[window.machineState.targetHorizontalPosition]; },
        print(char) {
            const block = rows[window.machineState.targetVerticalPosition * 28 + window.machineState.targetHorizontalPosition];
            const choice = [...block.chars].indexOf(char);
            assert.notEqual(choice, -1, `${char} is on the selected card`);
            window.keyboardController.typeKey(String(choice + 1));
        } };
}

test('arbitrarily long real input gaps preserve initial and final combinations', async () => {
    const k = await keyboard();
    k.api.typeKey('Z');
    k.time(1e12);
    k.api.typeKey('H');
    assert.equal(k.selection(), 'Vi');
    k.api.typeKey('u');
    k.time(2e12);
    k.api.typeKey('Enter');
    k.api.typeKey('a');
    assert.equal(k.selection(), 'Vx');
    k.time(3e12);
    k.api.typeKey('n');
    assert.equal(k.selection(), 'Vr');
    k.time(4e12);
    k.api.typeKey('g');
    assert.equal(k.selection(), 'Vl');
});

test('pinyin prints real candidates and Ming then a moves to a regardless of the hint', async () => {
    const k = await keyboard();
    for (const key of 'ZHuang') k.api.typeKey(key);
    assert.equal(k.selection(), 'Vl');
    k.print('庄');
    assert.deepEqual(k.printed, ['庄']);
    assert.equal(k.api.pinyinBuffer, 'uang');
    for (const key of 'Ming') k.api.typeKey(key);
    assert.equal(k.selection(), 'Mk');
    k.print('明');
    assert.deepEqual(k.printed, ['庄', '明']);
    assert.equal(k.api.pinyinBuffer, 'ing');
    k.api.typeKey('a');
    assert.equal(k.selection(), 'Ma');
});

test('Backspace, Enter, space, printing and symbols leave the letter buffer intact', async () => {
    const k = await keyboard();
    k.api.typeKey('u');
    for (const key of ['Backspace', 'Enter', '\n', ' ', '1', 'Tab', '!', '9', '0']) {
        k.api.typeKey(key);
        assert.equal(k.api.pinyinBuffer, 'u', key);
    }
    assert.equal(k.selection(), '!0');
    k.api.typeKey('a');
    assert.equal(k.selection(), '!x');
    assert.equal(k.api.pinyinBuffer, 'ua');
});

test('desktop Backspace and Tab keep their default behavior; Enter only returns paper', async () => {
    const k = await keyboard();
    function key(key) {
        let prevented = false;
        k.document.handlers.get('keydown')({ key, code: 'Key' + key, target: k.surface, preventDefault() { prevented = true; } });
        return prevented;
    }
    for (const char of 'Ming') assert.equal(key(char), true);
    assert.equal(key('Backspace'), false);
    assert.equal(key('Tab'), false);
    assert.equal(k.selection(), 'Mk');
    assert.equal(k.api.pinyinBuffer, 'ing');
    assert.equal(key('Enter'), true);
    assert.equal(k.api.pinyinBuffer, 'ing');
    assert.equal(k.printed.at(-1), '\n');
    key('a');
    assert.equal(k.selection(), 'Ma');
});

test('mobile insertion, deletion and linebreak preserve the same mechanical semantics', async () => {
    const k = await keyboard();
    const input = (inputType, data) => k.surface.handlers.get('beforeinput')({ inputType, data, cancelable: true, preventDefault() {} });
    input('insertText', 'ZHuang');
    assert.equal(k.selection(), 'Vl');
    input('deleteContentBackward', null);
    assert.equal(k.selection(), 'Vl');
    assert.equal(k.api.pinyinBuffer, 'uang');
    input('insertParagraph', null);
    assert.equal(k.api.pinyinBuffer, 'uang');
    assert.equal(k.printed.at(-1), '\n');
    input('insertText', 'a');
    assert.equal(k.selection(), 'Va');
    k.surface.handlers.get('input')({ inputType: 'deleteContentBackward' });
    assert.equal(k.api.pinyinBuffer, 'a');
});

test('the six previous methods keep their original two-key behavior', async () => {
    for (const mode of ['wubi-06', 'wubi-86', 'wubi-98', 'shuangpin-xiaohe', 'shuangpin-microsoft', 'shuangpin-abc']) {
        const k = await keyboard(mode);
        k.api.typeKey('Z');
        k.time(500);
        k.api.typeKey('H');
        k.api.typeKey('u');
        assert.equal(k.selection(), 'Hu', mode);
        assert.equal(k.api.pinyinBuffer, '');
    }
});

test('pinyin overflow layout covers all characters and avoids continuation hints', () => {
    const rows = csv('dev/pinyin/pinyin.csv');
    assert.equal(rows.length, 36 * 28);
    const characters = [];
    const forbiddenColumns = new Set();
    const finals = ['ai','ei','ao','ou','an','en','ang','eng','ong','ia','ie','iao','iu','ian','in','iang','ing','iong','ua','uo','uai','ui','uan','un','uang','ue','ve','Ai','An','Ang','Ao','Ei','En','Eng','Er','Ou','Ong'];
    for (const final of finals) {
        const { input } = parser();
        let column = null;
        for (let i = 0; i < final.length - 1; i++) {
            column = input.push(final[i]).columnKey || column;
            if (column) forbiddenColumns.add(column + final[i + 1]);
        }
    }
    rows.forEach((row, index) => {
        assert.equal(row.key1, rowKeys[Math.floor(index / 28)]);
        assert.equal(row.key2, columnKeys[index % 28]);
        assert.ok([...row.chars].length <= 8);
        characters.push(...row.chars);
        if ('ZCS'.includes(row.key1)) assert.notEqual(row.hint, 'H', row.key1 + row.key2);
        if (row.hint && columnKeys.includes(row.hint)) assert.ok(!forbiddenColumns.has(row.key2 + row.hint), row.key1 + row.key2 + '→' + row.hint);
    });
    assert.equal(characters.length, 6763);
    assert.equal(new Set(characters).size, 6763);
    assert.deepEqual([...new Set(characters)].sort(), source('dev/gb2312.txt').trim().split('\n').sort());
});

test('actual buffered keys follow every primary-code spelling and its literal overflow hints', () => {
    const rows = csv('dev/pinyin/pinyin.csv');
    const cards = new Map(rows.map(row => [row.key1 + row.key2, row]));
    const primaryCodes = new Set(csv('dev/pinyin/pinyin-code.csv').map(row => row.key1 + row.key2));
    const aliases = new Map([...columnKeys].map(key => [key, [key]]));
    const compounds = { ai:'d',ei:'w',ao:'c',ou:'z',an:'j',en:'f',ang:'h',eng:'g',ong:'s',ia:'x',ie:'p',iao:'n',iu:'q',ian:'m',in:'b',iang:'l',ing:'k',iong:'s',ua:'x',uo:'o',uai:'k',ui:'v',uan:'r',un:'y',uang:'l',ue:'t',ve:'t' };
    for (const [sound, column] of Object.entries(compounds)) aliases.get(column).push(sound);
    const spellings = [];
    for (const code of primaryCodes) {
        const initial = { V: 'ZH', I: 'CH', U: 'SH' }[code[0]] || code[0];
        const finals = 'AEO'.includes(code[0]) ? [code[1]] : aliases.get(code[1]);
        for (const final of finals) spellings.push([code, initial + final]);
    }
    for (const [text, code] of Object.entries({ Ai:'Ai',An:'An',Ang:'Ah',Ao:'Ao',Ei:'Ei',En:'En',Eng:'Eg',Er:'Er',Ou:'Ou',Ong:'Os' })) {
        spellings.push([code, text]);
    }
    const reachable = new Set();
    for (const [code, spelling] of spellings) {
        const { input } = parser();
        let row = 'G', column = 'q';
        function press(key) {
            const selection = input.push(key);
            const nextRow = selection ? selection.rowKey : rowKeys.includes(key) ? key : null;
            const nextColumn = selection ? selection.columnKey : columnKeys.includes(key) ? key : null;
            if (nextRow) row = nextRow;
            if (nextColumn) column = nextColumn;
        }
        for (const key of spelling) press(key);
        assert.equal(row + column, code, spelling);
        const visited = new Set();
        while (true) {
            const cell = row + column;
            assert.ok(!visited.has(cell), `${spelling}: paging cycle at ${cell}`);
            visited.add(cell);
            const card = cards.get(cell);
            for (const char of card.chars) reachable.add(char);
            if (!card.hint) break;
            const literalTarget = rowKeys.includes(card.hint) ? card.hint + column : row + card.hint;
            press(card.hint);
            assert.equal(row + column, literalTarget, `${spelling}: ${cell} hint ${card.hint} must remain mechanical`);
        }
    }
    assert.equal(reachable.size, 6763);
});
