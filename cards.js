// Shared SVG artwork for the single-card preview and the magic-eye stack.
(() => {
    'use strict';
    const NS = 'http://www.w3.org/2000/svg';
    const WIDTH = 1832;
    const HEIGHT = 478;
    const MARGIN = 48;
    const PITCH = 62;
    const SLIT_WIDTH = 26.4;
    const SLIT_TOP = 102;
    const ROW_PITCH = 30;
    const SLIT_HEIGHT = ROW_PITCH * 9;
    const BODY_TOP = 60;
    const BODY_BOTTOM = 417;
    const TAB_TOP = 8;
    const TAB_WIDTH = 64;
    const BOTTOM_TAB_WIDTH = 44;
    const BOTTOM_TAB_HEIGHT = 52;
    const TAB_SIDE_INSET = 10;
    const TAB_SIDE_RADIUS = (BOTTOM_TAB_HEIGHT ** 2 / 4 + TAB_SIDE_INSET ** 2) / (2 * TAB_SIDE_INSET);
    const TAB_JOIN_SIZE = 4;
    const TAB_SLIT_WIDTH = 4;
    const TAB_SLIT_HEIGHT = 24;

    function element(name, attributes = {}, text) {
        const node = document.createElementNS(NS, name);
        for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function text(x, y, value, className, anchor = 'middle') {
        return element('text', { x, y, class: className, 'text-anchor': anchor }, value);
    }
    function codeBadge(x, y, radius) {
        return element('circle', { class: 'code-badge', cx: x, cy: y, r: radius });
    }
    function roundedRectPath({ x, y, width, height, rx = 0 }) {
        const r = Math.min(rx, width / 2, height / 2);
        return `M${x + r} ${y} H${x + width - r} A${r} ${r} 0 0 1 ${x + width} ${y + r}
            V${y + height - r} A${r} ${r} 0 0 1 ${x + width - r} ${y + height}
            H${x + r} A${r} ${r} 0 0 1 ${x} ${y + height - r}
            V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
    }
    function createCard(card, index, count, { idPrefix = `card-${index}`, bodyOpacity = 1, shadow: drawShadow = true } = {}) {
        const svg = element('g', { class: 'mingkwai-card', opacity: 1, 'data-card-key': card.key });
        const tabLeft = MARGIN + index * (WIDTH - 2 * MARGIN - TAB_WIDTH) / Math.max(1, count - 1);
        const tabCenter = tabLeft + TAB_WIDTH / 2;
        const tabBottom = BODY_BOTTOM + BOTTOM_TAB_HEIGHT;
        const tabSlitLeft = tabCenter - TAB_SLIT_WIDTH / 2;
        // Halve the old clearance above the slit and lift both circle centers
        // by the same amount. The lower arcs extend to the unchanged bottom edge.
        const tabSlitTop = BODY_BOTTOM + (BOTTOM_TAB_HEIGHT - TAB_SLIT_HEIGHT) / 4;
        const tabArcCenterY = tabSlitTop + TAB_SLIT_HEIGHT / 2;
        function tabSideAt(y) {
            const rise = Math.abs(y - tabArcCenterY);
            const run = Math.sqrt(TAB_SIDE_RADIUS ** 2 - rise ** 2);
            const halfWidth = BOTTOM_TAB_WIDTH / 2 + TAB_SIDE_RADIUS - TAB_SIDE_INSET - run;
            return {
                y, left: tabCenter - halfWidth, right: tabCenter + halfWidth,
                joinRun: TAB_JOIN_SIZE * rise / run
            };
        }
        const tabArcTop = tabSideAt(BODY_BOTTOM + TAB_JOIN_SIZE);
        const tabArcBottom = tabSideAt(tabBottom - TAB_JOIN_SIZE);
        const title = element('title', { id: `${idPrefix}-card-title` }, `字卡 ${card.key}，28 道竖缝`);
        const description = element('desc', { id: `${idPrefix}-card-description` }, '米色字卡顶部带圆角梯形索引签。底部凸耳的细竖缝和内凹圆弧中心偏上，圆弧向下延伸到底边，无文字。28 道主竖缝比字宽百分之二十，每道缝右侧竖排八个字，第九行为红色提示码。');
        const defs = element('defs');
        const paper = element('linearGradient', { id: `${idPrefix}-paper`, x1: '0', y1: '0', x2: '0', y2: '1' });
        paper.append(element('stop', { offset: '0', 'stop-color': '#fff7e2' }), element('stop', { offset: '1', 'stop-color': '#eee1bf' }));
        const cutouts = card.blocks.map((block, column) => roundedRectPath({
            x: MARGIN + column * PITCH,
            y: SLIT_TOP, width: SLIT_WIDTH, height: SLIT_HEIGHT, rx: 2
        }));
        cutouts.push(roundedRectPath({
            x: tabSlitLeft, y: tabSlitTop,
            width: TAB_SLIT_WIDTH, height: TAB_SLIT_HEIGHT, rx: TAB_SLIT_WIDTH / 2
        }));
        defs.append(paper);
        if (drawShadow) {
            const shadow = element('filter', { id: `${idPrefix}-paper-shadow`, x: '-5%', y: '-20%', width: '110%', height: '150%' });
            shadow.append(element('feDropShadow', { dx: '0', dy: '6', stdDeviation: '5', 'flood-color': '#16281b', 'flood-opacity': '.25' }));
            defs.append(shadow);
        }
        // Keep the same circular curvature. Separate upper and lower tangent
        // joins accommodate the raised centers without changing the tab height.
        const topTabOutline = `Q${tabLeft + 2} ${BODY_TOP} ${tabLeft + 3} ${BODY_TOP - 4}
            L${tabLeft + 13} ${TAB_TOP + 4} Q${tabLeft + 14} ${TAB_TOP} ${tabLeft + 18} ${TAB_TOP}
            H${tabLeft + TAB_WIDTH - 18}
            Q${tabLeft + TAB_WIDTH - 14} ${TAB_TOP} ${tabLeft + TAB_WIDTH - 13} ${TAB_TOP + 4}
            L${tabLeft + TAB_WIDTH - 3} ${BODY_TOP - 4} Q${tabLeft + TAB_WIDTH - 2} ${BODY_TOP} ${tabLeft + TAB_WIDTH + 2} ${BODY_TOP}`;
        const rightEdgeOutline = `Q${WIDTH - 1} ${BODY_TOP} ${WIDTH - 1} ${BODY_TOP + 10}
            V${BODY_BOTTOM - 10} Q${WIDTH - 1} ${BODY_BOTTOM} ${WIDTH - 11} ${BODY_BOTTOM}`;
        const bottomTabStart = tabArcTop.right + tabArcTop.joinRun + TAB_JOIN_SIZE;
        const bottomTabOutline = `Q${tabArcTop.right + tabArcTop.joinRun} ${BODY_BOTTOM} ${tabArcTop.right} ${tabArcTop.y}
            A${TAB_SIDE_RADIUS} ${TAB_SIDE_RADIUS} 0 0 0 ${tabArcBottom.right} ${tabArcBottom.y}
            Q${tabArcBottom.right + tabArcBottom.joinRun} ${tabBottom} ${tabArcBottom.right + tabArcBottom.joinRun - TAB_JOIN_SIZE} ${tabBottom}
            H${tabArcBottom.left - tabArcBottom.joinRun + TAB_JOIN_SIZE}
            Q${tabArcBottom.left - tabArcBottom.joinRun} ${tabBottom} ${tabArcBottom.left} ${tabArcBottom.y}
            A${TAB_SIDE_RADIUS} ${TAB_SIDE_RADIUS} 0 0 0 ${tabArcTop.left} ${tabArcTop.y}
            Q${tabArcTop.left - tabArcTop.joinRun} ${BODY_BOTTOM} ${tabArcTop.left - tabArcTop.joinRun - TAB_JOIN_SIZE} ${BODY_BOTTOM}`;
        const leftEdgeOutline = `Q1 ${BODY_BOTTOM} 1 ${BODY_BOTTOM - 10} V${BODY_TOP + 10} Q1 ${BODY_TOP} 11 ${BODY_TOP}`;
        const outline = `M11 ${BODY_TOP} H${tabLeft - 2} ${topTabOutline}
            H${WIDTH - 11} ${rightEdgeOutline}
            H${bottomTabStart} ${bottomTabOutline}
            H11 ${leftEdgeOutline} Z`;
        // Even-odd filling cuts real holes in the stock without mask surfaces.
        const perforatedOutline = `${outline} ${cutouts.join(' ')}`;
        const stock = element('g', drawShadow ? { filter: `url(#${idPrefix}-paper-shadow)` } : {});
        // A continuous base fill prevents a hairline between separately clipped
        // regions. Opaque tab fills cover that base; lettering stays outside it.
        stock.append(element('path', { class: 'card-body', d: perforatedOutline, 'fill-rule': 'evenodd', fill: `url(#${idPrefix}-paper)`, 'fill-opacity': bodyOpacity }));
        if (bodyOpacity < 1) {
            const tabClip = element('clipPath', { id: `${idPrefix}-tab-regions`, clipPathUnits: 'userSpaceOnUse' });
            tabClip.append(
                element('rect', { x: 0, y: 0, width: WIDTH, height: BODY_TOP }),
                element('rect', { x: 0, y: BODY_BOTTOM, width: WIDTH, height: HEIGHT - BODY_BOTTOM })
            );
            defs.append(tabClip);
            stock.append(element('path', { class: 'card-tabs', d: perforatedOutline, 'fill-rule': 'evenodd', fill: `url(#${idPrefix}-paper)`, 'clip-path': `url(#${idPrefix}-tab-regions)` }));
        }
        stock.append(element('path', { class: 'card-outline', d: outline, fill: 'none', stroke: '#c3ac7d', 'stroke-width': 1 }));
        svg.replaceChildren(title, description, defs, stock);
        svg.append(text(tabCenter, 35, card.key, 'tab-key'));
        svg.append(text(tabCenter, 51, String(index + 1).padStart(2, '0'), 'tab-number'));
        svg.append(element('rect', {
            x: tabSlitLeft - .5, y: tabSlitTop - .5,
            width: TAB_SLIT_WIDTH + 1, height: TAB_SLIT_HEIGHT + 1, rx: (TAB_SLIT_WIDTH + 1) / 2,
            fill: 'none', stroke: '#8e7f60', 'stroke-width': '.65'
        }));
        card.blocks.forEach((block, column) => {
            const slitLeft = MARGIN + column * PITCH;
            const textX = slitLeft + (SLIT_WIDTH + PITCH) / 2;
            const station = element('g', { 'data-column': column + 1 });
            station.append(element('title', {}, `${card.key}${block.key}：${block.chars}${block.hint ? `；翻页 ${block.hint}` : ''}`));
            station.append(text(textX, SLIT_TOP - 18, block.key, 'column-key'));
            station.append(element('rect', { x: slitLeft - .5, y: SLIT_TOP - .5, width: SLIT_WIDTH + 1, height: SLIT_HEIGHT + 1, rx: 2.5, fill: 'none', stroke: '#8e7f60', 'stroke-width': '.65' }));
            const characters = Array.from(block.chars);
            for (let choice = 0; choice < 8; choice++) {
                if (!characters[choice] || characters[choice] === '　') continue;
                const className = choice >= block.originalCount ? 'character borrowed' : 'character';
                station.append(text(textX, SLIT_TOP + 23 + choice * ROW_PITCH, characters[choice], className));
            }
            if (block.hint) {
                const hintCenter = SLIT_TOP + 8.5 * ROW_PITCH;
                station.append(codeBadge(textX, hintCenter, 11));
                station.append(text(textX, hintCenter + 5, block.hint, 'hint-code'));
            }
            station.append(text(textX, SLIT_TOP + SLIT_HEIGHT + 23, String(column + 1).padStart(2, '0'), 'station-number'));
            svg.append(station);
        });
        return svg;
    }

    function groupCards(rows) {
        const grouped = new Map();
        for (const row of rows) {
            if (!grouped.has(row.key1)) grouped.set(row.key1, { key: row.key1, blocks: [] });
            grouped.get(row.key1).blocks.push({ key: row.key2, chars: row.chars, originalCount: Array.from(row.original).length, hint: row.hint });
        }
        const result = Array.from(grouped.values());
        if (result.length !== 36 || result.some(card => card.blocks.length !== 28)) throw new Error('Unexpected card dimensions');
        return result;
    }
    window.MingKwaiCards = Object.freeze({
        width: WIDTH, height: HEIGHT, createCard, groupCards, roundedRectPath,
        slitAt: column => ({ x: MARGIN + column * PITCH, y: SLIT_TOP, width: SLIT_WIDTH, height: SLIT_HEIGHT, rx: 2 }),
        // Shift each text column into the common slit immediately to its left.
        selectionShift: -PITCH / 2
    });
})();
