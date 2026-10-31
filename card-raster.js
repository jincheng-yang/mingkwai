// Rasterize the shared SVG artwork once; only PNG images remain in the live stack.
(() => {
    'use strict';
    const NS = 'http://www.w3.org/2000/svg';

    function drawText(context, node, style) {
        context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        context.textBaseline = 'alphabetic';
        const anchor = node.getAttribute('text-anchor');
        context.textAlign = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';
        const x = Number(node.getAttribute('x'));
        const y = Number(node.getAttribute('y'));
        const spacing = parseFloat(style.letterSpacing) || 0;
        if ('letterSpacing' in context) {
            context.letterSpacing = `${spacing}px`;
            context.fillText(node.textContent, x, y);
        } else if (spacing) {
            // Older Safari versions do not support canvas letterSpacing.
            const letters = Array.from(node.textContent);
            const widths = letters.map(letter => context.measureText(letter).width);
            const width = widths.reduce((sum, value) => sum + value, 0) + spacing * (letters.length - 1);
            let left = x - (context.textAlign === 'center' ? width / 2 : context.textAlign === 'right' ? width : 0);
            context.textAlign = 'left';
            letters.forEach((letter, index) => {
                context.fillText(letter, left, y);
                left += widths[index] + spacing;
            });
        } else {
            context.fillText(node.textContent, x, y);
        }
    }

    function drawCard(canvas, card, scale) {
        const { width, height, roundedRectPath } = window.MingKwaiCards;
        canvas.width = Math.ceil(width * scale);
        canvas.height = Math.ceil(height * scale);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas rendering is unavailable');
        context.scale(canvas.width / width, canvas.height / height);
        for (const node of card.querySelectorAll('path, rect, circle, text')) {
            if (node.closest('defs')) continue;
            const style = getComputedStyle(node);
            context.save();
            const clipReference = node.getAttribute('clip-path');
            if (clipReference) {
                // Translucent stock keeps opaque tabs; clip their extra fill
                // while generating the PNG, without retaining a live SVG clip.
                const clip = new Path2D();
                card.querySelector(clipReference.slice(4, -1)).querySelectorAll('rect').forEach(rect => {
                    clip.rect(Number(rect.getAttribute('x')), Number(rect.getAttribute('y')),
                        Number(rect.getAttribute('width')), Number(rect.getAttribute('height')));
                });
                context.clip(clip);
            }
            const fill = node.getAttribute('fill') ?? style.fill;
            if (fill.startsWith('url(')) {
                const bounds = node.getBBox();
                const gradient = context.createLinearGradient(0, bounds.y, 0, bounds.y + bounds.height);
                // The shared artwork uses the same vertical paper gradient.
                card.querySelectorAll('linearGradient stop').forEach(stop => {
                    gradient.addColorStop(Number(stop.getAttribute('offset')), stop.getAttribute('stop-color'));
                });
                context.fillStyle = gradient;
            } else if (fill !== 'none') {
                context.fillStyle = fill;
            }
            if (node.localName === 'text') {
                drawText(context, node, style);
            } else {
                let path;
                if (node.localName === 'path') {
                    path = new Path2D(node.getAttribute('d'));
                } else if (node.localName === 'rect') {
                    path = new Path2D(roundedRectPath({
                        x: Number(node.getAttribute('x')), y: Number(node.getAttribute('y')),
                        width: Number(node.getAttribute('width')), height: Number(node.getAttribute('height')),
                        rx: Number(node.getAttribute('rx'))
                    }));
                } else {
                    path = new Path2D();
                    path.arc(Number(node.getAttribute('cx')), Number(node.getAttribute('cy')), Number(node.getAttribute('r')), 0, Math.PI * 2);
                }
                if (fill !== 'none') {
                    context.globalAlpha = Number(style.fillOpacity);
                    context.fill(path, node.getAttribute('fill-rule') || 'nonzero');
                }
                if (style.stroke !== 'none') {
                    context.globalAlpha = Number(style.strokeOpacity);
                    context.strokeStyle = style.stroke;
                    context.lineWidth = parseFloat(style.strokeWidth);
                    context.stroke(path);
                }
            }
            context.restore();
        }
    }

    async function replaceImage(canvas, image, previousUrl) {
        const blob = await new Promise((resolve, reject) => canvas.toBlob(value => {
            if (value) resolve(value);
            else reject(new Error('Unable to encode cached image'));
        }, 'image/png'));
        const url = URL.createObjectURL(blob);
        try {
            const decoded = new Image();
            decoded.src = url;
            await decoded.decode();
        } catch (error) {
            URL.revokeObjectURL(url);
            throw error;
        }
        image.setAttribute('href', url);
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return url;
    }

    function createMarkerCache() {
        const { slitAt, roundedRectPath } = window.MingKwaiCards;
        const slit = slitAt(0);
        const rowHeight = slit.height / 9;
        const width = 24;
        const height = rowHeight * 8 + 24;
        const top = slit.y + rowHeight / 2 - 12;
        const image = document.createElementNS(NS, 'image');
        for (const [key, value] of Object.entries({
            id: 'card-reader-markers', x: -12, y: top, width, height,
            opacity: 1, 'aria-hidden': 'true', 'pointer-events': 'none', preserveAspectRatio: 'none'
        })) image.setAttribute(key, value);
        let requestedScale = 0;
        let completedScale = 0;
        let url = null;
        let pending = null;

        async function rebuild() {
            await document.fonts.ready;
            const canvas = document.createElement('canvas');
            try {
                while (completedScale < requestedScale) {
                    const scale = requestedScale;
                    canvas.width = Math.ceil(width * scale);
                    canvas.height = Math.ceil(height * scale);
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error('Canvas rendering is unavailable');
                    context.scale(canvas.width / width, canvas.height / height);
                    context.translate(12, -top);
                    for (let choice = 0; choice < 9; choice++) {
                        context.save();
                        context.translate(0, slit.y + (choice + 0.5) * rowHeight);
                        context.fillStyle = '#f7f3e8';
                        context.strokeStyle = '#bdb6a5';
                        context.lineWidth = 0.8;
                        const badge = new Path2D();
                        if (choice < 8) {
                            badge.addPath(new Path2D(roundedRectPath({ x: -11, y: -11, width: 22, height: 22, rx: 5 })));
                        } else {
                            badge.arc(0, 0, 11, 0, Math.PI * 2);
                        }
                        context.fill(badge);
                        context.stroke(badge);
                        if (choice < 8) {
                            context.fillStyle = '#24382f';
                            context.font = '14px Menlo, Consolas, monospace';
                            context.textAlign = 'center';
                            context.fillText(String(choice + 1), 0, 5);
                        } else {
                            context.strokeStyle = '#24382f';
                            context.lineWidth = 1.5;
                            context.lineCap = context.lineJoin = 'round';
                            context.stroke(new Path2D('M-6 0H6 M2 -4L6 0L2 4'));
                        }
                        context.restore();
                    }
                    url = await replaceImage(canvas, image, url);
                    completedScale = scale;
                }
            } finally {
                canvas.width = canvas.height = 0;
            }
        }

        function ensureScale(scale) {
            requestedScale = Math.max(requestedScale, Math.min(4, Math.ceil(scale * 4) / 4));
            if (!pending && completedScale < requestedScale) pending = rebuild().finally(() => { pending = null; });
            return pending || Promise.resolve();
        }
        return { image, ensureScale };
    }

    function createCache(cards, onProgress = () => {}) {
        const { width, height, createCard } = window.MingKwaiCards;
        const images = cards.map(card => {
            const image = document.createElementNS(NS, 'image');
            image.setAttribute('width', width);
            image.setAttribute('height', height);
            image.setAttribute('preserveAspectRatio', 'none');
            image.setAttribute('data-card-key', card.key);
            const title = document.createElementNS(NS, 'title');
            title.textContent = `字卡 ${card.key}，28 道竖缝`;
            image.append(title);
            return image;
        });
        const urls = [];
        // Bound decoded image memory on large or high-density displays.
        const maxScale = Math.sqrt(256 * 1024 * 1024 / (cards.length * width * height * 4));
        let requestedScale = 0;
        let completedScale = 0;
        let pending = null;

        async function rebuild() {
            await document.fonts.ready;
            const stage = document.createElementNS(NS, 'svg');
            stage.setAttribute('viewBox', `0 0 ${width} ${height}`);
            stage.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;visibility:hidden;pointer-events:none`;
            stage.setAttribute('aria-hidden', 'true');
            document.body.append(stage);
            const canvas = document.createElement('canvas');
            try {
                while (completedScale < requestedScale) {
                    const scale = requestedScale;
                    for (let index = 0; index < cards.length; index++) {
                        const card = createCard(cards[index], index, cards.length, {
                            idPrefix: `raster-card-${index}`, bodyOpacity: 0.5, shadow: false
                        });
                        stage.replaceChildren(card);
                        drawCard(canvas, card, scale);
                        urls[index] = await replaceImage(canvas, images[index], urls[index]);
                        onProgress((index + 1) / cards.length);
                        // Yield between cards so initialization and resize remain responsive.
                        await new Promise(resolve => requestAnimationFrame(resolve));
                    }
                    completedScale = scale;
                }
            } finally {
                stage.remove();
                canvas.width = canvas.height = 0;
            }
        }

        function ensureScale(scale) {
            // Reuse sharper images on shrink; bucket small resize changes.
            requestedScale = Math.max(requestedScale, Math.min(maxScale, Math.ceil(scale * 4) / 4));
            if (!pending && completedScale < requestedScale) {
                pending = rebuild().finally(() => { pending = null; });
            }
            return pending || Promise.resolve();
        }
        return { images, ensureScale };
    }

    window.MingKwaiCardRaster = Object.freeze({ createCache, createMarkerCache });
})();
