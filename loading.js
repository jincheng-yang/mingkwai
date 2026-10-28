// Keep the instructions available until both the simulator and reader are ready.
(() => {
    const screen = document.getElementById('loading-screen');
    const status = document.getElementById('loading-status');
    const start = document.getElementById('start-typing');
    const label = document.getElementById('start-typing-label');
    const progress = document.getElementById('loading-progress');
    const weights = { d3: 2, three: 2, candidateDownload: 2, candidates: 4, rollerText: 2, rollerFont: 44, wood: 4, font: 10, mechanism: 30 };
    const pending = new Set(Object.keys(weights));
    const fractions = Object.fromEntries(Object.keys(weights).map(part => [part, 0]));
    let failed = false;
    let started = false;

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
        get active() { return screen.open; },
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
            if (!screen.open) return;
            failed = true;
            console.error('Unable to prepare simulator:', error);
            status.textContent = '加载未完成，请检查网络后重试。';
            label.textContent = '重新加载';
            start.disabled = false;
            progress.hidden = true;
            start.removeAttribute('aria-describedby');
        }
    };

    screen.showModal();
    screen.addEventListener('cancel', event => event.preventDefault());
    start.addEventListener('click', () => {
        if (failed) {
            window.location.reload();
            return;
        }
        if (pending.size) return;
        screen.close();
        // This user gesture also allows mobile browsers to open the keyboard.
        document.getElementById('text').focus({ preventScroll: true });
    });
    window.addEventListener('error', event => window.simulatorLoading.fail(event.error || event.message));
    document.fonts.ready.then(() => window.simulatorLoading.ready('font'))
        .catch(error => window.simulatorLoading.fail(error));

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

    // Let the browser paint the empty bar before cached scripts and assets can
    // advance it. Two animation frames provide a paint between the callbacks.
    requestAnimationFrame(() => requestAnimationFrame(async () => {
        started = true;
        renderProgress();
        try {
            await loadScript('https://d3js.org/d3.v7.min.js', 'd3');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'three');
            await loadScript('magic_eye.js');
            await loadScript('animation.js');
        } catch (error) {
            window.simulatorLoading.fail(error);
        }
    }));
})();
