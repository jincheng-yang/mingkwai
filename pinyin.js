// A short key-sequence buffer over the mechanical row/column controls.
(() => {
    'use strict';
    const initialKeys = Object.freeze({ ZH: 'V', CH: 'I', SH: 'U' });
    // Same sound positions as dev/shuangpin-xiaohe/generate_shuangpin-xiaohe.py.
    const finalKeys = Object.freeze({
        ai: 'd', ei: 'w', ao: 'c', ou: 'z', an: 'j', en: 'f',
        ang: 'h', eng: 'g', ong: 's', ia: 'x', ie: 'p', iao: 'n',
        iu: 'q', ian: 'm', in: 'b', iang: 'l', ing: 'k', iong: 's',
        ua: 'x', uo: 'o', uai: 'k', ui: 'v', uan: 'r', un: 'y',
        uang: 'l', ue: 't', ve: 't',
        Ai: 'i', An: 'n', Ang: 'h', Ao: 'o',
        Ei: 'i', En: 'n', Eng: 'g', Er: 'r', Ou: 'u', Ong: 's'
    });
    const combinations = [...Object.keys(initialKeys), ...Object.keys(finalKeys)];
    window.createPinyinParser = () => {
        let buffer = '';
        function push(key) {
            key = key === 'ü' ? 'v' : key;
            if (!/^[A-Za-z]$/.test(key)) return null;
            const candidate = buffer + key;
            // Unknown continuations always fall back to the pressed key itself.
            buffer = combinations.some(combination => combination.startsWith(candidate)) ? candidate : key;
            return {
                rowKey: initialKeys[buffer] || (/^[A-Z]$/.test(key) ? key : null),
                columnKey: finalKeys[buffer] || (/^[a-z]$/.test(key) ? key : null),
                buffer
            };
        }
        return Object.freeze({ push, get text() { return buffer; } });
    };
})();
