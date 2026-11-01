// Keep the instructions available until both the simulator and reader are ready.
(() => {
    const screen = document.getElementById('loading-screen');
    const status = document.getElementById('loading-status');
    const start = document.getElementById('start-typing');
    const label = document.getElementById('start-typing-label');
    const progress = document.getElementById('loading-progress');
    const typingSurface = document.getElementById('text');
    const schemeControl = document.getElementById('input-scheme');
    const schemes = Object.freeze({
        'wubi-06': Object.freeze({
            id: 'wubi-06', name: '新世纪五笔',
            candidatesUrl: 'dev/wubi-06/wubi-06.csv', candidatesBytes: 49214,
            rollerTextUrl: 'dev/wubi-06/wubi-06.txt', rollerTextBytes: 24479,
            description: '用五笔前两码选字，再按数字键印下汉字。',
            exampleRow: 'J', exampleColumn: 'e', initialRow: 'P', initialColumn: 'b'
        }),
        'wubi-86': Object.freeze({
            id: 'wubi-86', name: '86版五笔',
            candidatesUrl: 'dev/wubi-86/wubi-86.csv', candidatesBytes: 49206,
            rollerTextUrl: 'dev/wubi-86/wubi-86.txt', rollerTextBytes: 24479,
            description: '用86版五笔前两码选字，再按数字键印下汉字。',
            exampleRow: 'J', exampleColumn: 'e', initialRow: 'P', initialColumn: 'b'
        }),
        'wubi-98': Object.freeze({
            id: 'wubi-98', name: '98版五笔',
            candidatesUrl: 'dev/wubi-98/wubi-98.csv', candidatesBytes: 49201,
            rollerTextUrl: 'dev/wubi-98/wubi-98.txt', rollerTextBytes: 24479,
            description: '用98版五笔前两码选字，再按数字键印下汉字。',
            exampleRow: 'J', exampleColumn: 'e', initialRow: 'P', initialColumn: 'b'
        }),
        'shuangpin-xiaohe': Object.freeze({
            id: 'shuangpin-xiaohe', name: '小鹤双拼',
            candidatesUrl: 'dev/shuangpin-xiaohe/shuangpin-xiaohe.csv', candidatesBytes: 49304,
            rollerTextUrl: 'dev/shuangpin-xiaohe/shuangpin-xiaohe.txt', rollerTextBytes: 24479,
            description: '用小鹤双拼的声母码和韵母码选字，再按数字键印下汉字。',
            exampleRow: 'M', exampleColumn: 'k', initialRow: 'Z', initialColumn: 'i'
        }),
        'shuangpin-microsoft': Object.freeze({
            id: 'shuangpin-microsoft', name: '微软双拼',
            candidatesUrl: 'dev/shuangpin-microsoft/shuangpin-microsoft.csv', candidatesBytes: 49304,
            rollerTextUrl: 'dev/shuangpin-microsoft/shuangpin-microsoft.txt', rollerTextBytes: 24479,
            description: '用微软双拼选字，再按数字键印下汉字。韵母 ing 使用分号 ; 键。',
            exampleRow: 'M', exampleColumn: ';', initialRow: 'Z', initialColumn: 'i',
            columnKeys: 'qazwsxedcrfvtgbyhnujmik;ol0p'
        }),
        'shuangpin-abc': Object.freeze({
            id: 'shuangpin-abc', name: '智能ABC双拼',
            candidatesUrl: 'dev/shuangpin-abc/shuangpin-abc.csv', candidatesBytes: 49304,
            rollerTextUrl: 'dev/shuangpin-abc/shuangpin-abc.txt', rollerTextBytes: 24479,
            description: '用智能ABC双拼选字，再按数字键印下汉字。',
            exampleRow: 'M', exampleColumn: 'y', initialRow: 'Z', initialColumn: 'i'
        })
    });
    const requestedScheme = new URL(window.location.href).searchParams.get('scheme');
    const scheme = Object.hasOwn(schemes, requestedScheme) ? schemes[requestedScheme] : schemes['wubi-06'];
    schemeControl.value = scheme.id;
    document.getElementById('loading-caption').textContent = `明快 · ${scheme.name}`;
    document.getElementById('loading-description').textContent = scheme.description;
    document.getElementById('loading-example-row').textContent = scheme.exampleRow;
    document.getElementById('loading-example-column').textContent = scheme.exampleColumn;
    document.title = `明快打字机模拟器 · ${scheme.name}`;
    schemeControl.addEventListener('change', () => {
        if (!Object.hasOwn(schemes, schemeControl.value) || schemeControl.value === scheme.id) return;
        // Reload the selected scheme as one unit, avoiding mixed data or stale
        // asynchronous geometry/cache work from a previously selected scheme.
        const url = new URL(window.location.href);
        url.searchParams.set('scheme', schemeControl.value);
        window.location.replace(url.href);
    });
    const weights = { d3: 2, three: 2, candidateDownload: 2, candidates: 4, rollerText: 2, rollerFont: 44, wood: 4, font: 10, mechanism: 30 };
    const pending = new Set(Object.keys(weights));
    const fractions = Object.fromEntries(Object.keys(weights).map(part => [part, 0]));
    let failed = false;
    let started = false;
    let dismissed = false;
    // The dialog waits for its font, so keep the input inactive during preload.
    typingSurface.inert = true;

    function renderProgress() {
        if (!started) return;
        const sum = Object.entries(weights).reduce((total, [part, weight]) => total + weight * fractions[part], 0);
        const percent = pending.size ? Math.min(99, Math.floor(sum)) : 100;
        progress.value = percent;
        start.style.setProperty('--loading-progress', `${percent}%`);
        label.textContent = `加载中… ${percent}%`;
        status.textContent = fractions.rollerFont < 1
            ? '正在下载字库与字表…'
            : pending.has('mechanism') ? '正在装配字模…' : '正在完成准备…';
    }

    window.simulatorLoading = {
        scheme,
        get active() { return !dismissed; },
        report(part, fraction) {
            if (failed || !pending.has(part)) return;
            fractions[part] = Math.max(fractions[part], Math.min(0.99, Math.max(0, fraction)));
            renderProgress();
        },
        loadText(url, part, expectedBytes) {
            return new Promise((resolve, reject) => {
                const request = new XMLHttpRequest();
                request.open('GET', url);
                request.onprogress = event => {
                    const total = event.lengthComputable ? event.total : expectedBytes;
                    if (total) this.report(part, event.loaded / total);
                };
                request.onload = () => {
                    if (request.status < 200 || request.status >= 300) {
                        reject(new Error(`Unable to load ${url}: ${request.status}`));
                        return;
                    }
                    this.ready(part);
                    resolve(request.responseText);
                };
                request.onerror = () => reject(new Error(`Unable to load ${url}`));
                request.onabort = () => reject(new Error(`Loading cancelled: ${url}`));
                request.send();
            });
        },
        ready(part) {
            if (failed || !pending.delete(part)) return;
            fractions[part] = 1;
            renderProgress();
            if (pending.size) return;
            status.textContent = '已就绪，准备开始打字。';
            label.textContent = '开始打字';
            start.disabled = false;
            progress.hidden = true;
            start.removeAttribute('aria-describedby');
        },
        fail(error) {
            if (dismissed) return;
            failed = true;
            console.error('Unable to prepare simulator:', error);
            status.textContent = '加载未完成，请检查网络后重试。';
            label.textContent = '重新加载';
            start.disabled = false;
            progress.hidden = true;
            start.removeAttribute('aria-describedby');
        }
    };

    screen.addEventListener('cancel', event => event.preventDefault());
    start.addEventListener('click', () => {
        if (failed) {
            window.location.reload();
            return;
        }
        if (pending.size) return;
        dismissed = true;
        screen.close();
        typingSurface.inert = false;
        // Desktop input is captured at document level. Open the mobile keyboard
        // only when the user taps the paper or its keyboard button.
    });
    window.addEventListener('error', event => window.simulatorLoading.fail(event.error || event.message));

    function loadScript(url, part) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                if (part) window.simulatorLoading.ready(part);
                resolve();
            };
            script.onerror = () => reject(new Error(`Unable to load ${url}`));
            document.body.appendChild(script);
        });
    }

    async function startLoading() {
        try {
            // assets/fangsong.ttf is FangSong_GB2312. Explicit loading also
            // fetches it while the dialog is still hidden.
            const faces = await document.fonts.load('16px "FangSong"', '明快打字机模拟器');
            if (!faces.length) throw new Error('FangSong_GB2312 font is unavailable');
            window.simulatorLoading.ready('font');
            screen.showModal();
            if (failed) return;
            // Paint the font-ready dialog before cached scripts advance progress.
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            started = true;
            renderProgress();
            await loadScript('https://d3js.org/d3.v7.min.js', 'd3');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'three');
            await loadScript('cards.js');
            await loadScript('card-raster.js');
            await loadScript('machine-state.js');
            await loadScript('paper.js');
            await loadScript('keyboard.js');
            await loadScript('layout.js');
            await loadScript('magic_eye.js');
            await loadScript('animation.js');
        } catch (error) {
            // A failed font download must still expose the retry button.
            if (!screen.open) screen.showModal();
            window.simulatorLoading.fail(error);
        }
    }
    startLoading();
})();
