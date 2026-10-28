// The mechanism follows the same selection and strike state as the magic eye.
(() => {
    const container = document.getElementById('animation');
    const table = document.getElementById('table');
    const paper = document.getElementById('text');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', '明快打字机三级滚筒，随键盘选字转动');
    container.appendChild(renderer.domElement);

    const steel = new THREE.MeshStandardMaterial({
        color: 0xb5bcb8, metalness: 0.55, roughness: 0.38,
        flatShading: true
    });
    const brass = new THREE.MeshStandardMaterial({
        color: 0xb99a60, metalness: 0.65, roughness: 0.3
    });
    const darkMetal = new THREE.MeshStandardMaterial({
        color: 0x374846, metalness: 0.4, roughness: 0.48
    });
    const rollerRadius = 1;
    const capRadius = 1.025;
    const rollerOrbitRadius = 2;
    const mediumOrbitRadius = 5;
    const rollerGeometry = new THREE.CylinderGeometry(rollerRadius, rollerRadius, 20, 8);
    const capGeometry = new THREE.CylinderGeometry(capRadius, capRadius, 0.16, 8);
    const axleGeometry = new THREE.CylinderGeometry(0.24, 0.24, 21.4, 24);
    // User inspection stays separate from the keyboard-driven roller pivots.
    const mechanism = new THREE.Group();
    scene.add(mechanism);
    const large = new THREE.Group();
    mechanism.add(large);
    const rollers = [];
    const turn = Math.PI * 2;

    // Wrap the five roller centers with tangent lines and circular corners.
    // Each corner is concentric with a roller; its beveled edge matches the cap.
    const hubOutline = new THREE.Shape();
    for (let corner = 0; corner < 5; corner++) {
        const angle = Math.PI + turn * corner / 5;
        hubOutline.absarc(
            rollerOrbitRadius * Math.cos(angle),
            rollerOrbitRadius * Math.sin(angle),
            rollerRadius,
            angle - Math.PI / 5,
            angle + Math.PI / 5,
            false
        );
    }
    hubOutline.closePath();
    const hubGeometry = new THREE.ExtrudeGeometry(hubOutline, {
        depth: 0.1, steps: 1, curveSegments: 12,
        bevelEnabled: true, bevelThickness: 0.02,
        bevelSize: capRadius - rollerRadius, bevelSegments: 2
    });
    // Map the outline onto the y/z plane and center its 0.14-unit thickness on x.
    hubGeometry.translate(0, 0, -0.05);
    hubGeometry.rotateX(Math.PI / 2);
    hubGeometry.rotateZ(Math.PI / 2);

    function cylinder(geometry, material, parent, x = 0) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.z = Math.PI / 2;
        mesh.rotation.x = Math.PI / 8;
        mesh.position.x = x;
        parent.add(mesh);
        return mesh;
    }

    for (let i = 0; i < 5; i++) {
        const medium = new THREE.Group();
        const angle = turn * i / 5;
        medium.position.set(0, -mediumOrbitRadius * Math.cos(angle), mediumOrbitRadius * Math.sin(angle));
        large.add(medium);
        for (let j = 0; j < 5; j++) {
            const small = new THREE.Group();
            const angle = turn * j / 5;
            small.position.set(0, -rollerOrbitRadius * Math.cos(angle), rollerOrbitRadius * Math.sin(angle));
            small.rotation.x = -angle;
            medium.add(small);
            cylinder(rollerGeometry, steel, small);
            cylinder(axleGeometry, darkMetal, small);
            cylinder(capGeometry, brass, small, -10);
            cylinder(capGeometry, brass, small, 10);
            rollers.push(small);
        }
        for (const x of [-10.4, 10.4]) {
            const endPlate = new THREE.Mesh(hubGeometry, darkMetal);
            endPlate.position.x = x;
            medium.add(endPlate);
        }
    }
    cylinder(new THREE.CylinderGeometry(0.4, 0.4, 22.4, 32), brass, large);

    // Two five-spoke wheels carry the pentagonal assemblies on the central shaft.
    // Their radius matches the orbit of the five medium rollers, so each spoke
    // meets a pentagon's pivot rather than an edge of its rotating end plate.
    const wheelRimGeometry = new THREE.TorusGeometry(mediumOrbitRadius, 0.14, 16, 96);
    const wheelTrimGeometry = new THREE.TorusGeometry(mediumOrbitRadius, 0.035, 12, 96);
    const spokeGeometry = new THREE.CylinderGeometry(0.18, 0.1, mediumOrbitRadius, 16);
    const wheelHubGeometry = new THREE.CylinderGeometry(0.72, 0.72, 0.48, 32);
    const bearingGeometry = new THREE.CylinderGeometry(0.28, 0.28, 0.45, 24);
    const pivotCapGeometry = new THREE.CylinderGeometry(0.38, 0.38, 0.08, 24);
    for (const side of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.name = side < 0 ? 'left-support-wheel' : 'right-support-wheel';
        wheel.position.x = side * 10.85;
        large.add(wheel);

        const rim = new THREE.Mesh(wheelRimGeometry, darkMetal);
        rim.rotation.y = Math.PI / 2;
        wheel.add(rim);
        const trim = new THREE.Mesh(wheelTrimGeometry, brass);
        trim.rotation.y = Math.PI / 2;
        trim.position.x = side * 0.13;
        wheel.add(trim);
        cylinder(wheelHubGeometry, brass, wheel);

        for (let i = 0; i < 5; i++) {
            const angle = turn * i / 5;
            const y = -mediumOrbitRadius * Math.cos(angle);
            const z = mediumOrbitRadius * Math.sin(angle);
            const spoke = new THREE.Mesh(spokeGeometry, steel);
            spoke.name = `spoke-${i}`;
            spoke.rotation.x = -angle;
            spoke.position.set(0, y / 2, z / 2);
            wheel.add(spoke);

            // Short journals join the wheel to the independently turning plates.
            const bearing = cylinder(bearingGeometry, brass, wheel, -side * 0.225);
            bearing.name = `bearing-${i}`;
            bearing.position.y = y;
            bearing.position.z = z;
            const cap = cylinder(pivotCapGeometry, darkMetal, wheel, side * 0.16);
            cap.position.y = y;
            cap.position.z = z;
        }
    }

    scene.add(new THREE.HemisphereLight(0xf5faff, 0x74634b, 1.1));
    const keyLight = new THREE.DirectionalLight(0xffefda, 1.7);
    keyLight.position.set(-8, -12, 15);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xd4e9ef, 0.85);
    fillLight.position.set(10, -4, -6);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
    rimLight.position.set(2, 8, 10);
    scene.add(rimLight);

    // A wooden instrument eyepiece follows the selected column.
    const carriage = new THREE.Group();
    const lensRadius = 0.68;
    const walnut = new THREE.MeshStandardMaterial({
        color: 0x966638, metalness: 0, roughness: 0.78
    });
    const woodTextureLoader = new THREE.TextureLoader();
    const woodMapFiles = [
        ['map', 'assets/textures/wood-color.jpg'],
        ['normalMap', 'assets/textures/wood-normal.jpg'],
        ['roughnessMap', 'assets/textures/wood-roughness.jpg']
    ];
    let woodMapsLoaded = 0;
    const woodMapsReady = Promise.all(woodMapFiles.map(([slot, path]) => new Promise((resolve, reject) => {
        woodTextureLoader.load(path, texture => {
            // Only color maps contain sRGB data; normal/roughness stay linear.
            texture.encoding = slot === 'map' ? THREE.sRGBEncoding : THREE.LinearEncoding;
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
            texture.needsUpdate = true;
            window.simulatorLoading.report('wood', ++woodMapsLoaded / woodMapFiles.length);
            resolve([slot, texture]);
        }, undefined, reject);
    }))).then(entries => {
        window.simulatorLoading.ready('wood');
        return Object.fromEntries(entries);
    });
    // A hollow, turned barrel replaces the handheld magnifier silhouette.
    const eyepieceBack = 0.18;
    const barrelProfile = [
        [0.66, -0.28], [0.76, -0.28], [0.85, -0.20],
        [0.88, -0.08], [0.85, 0.10], [0.77, eyepieceBack],
        [0.69, eyepieceBack], [0.66, -0.28]
    ].map(([radius, depth]) => new THREE.Vector2(radius, depth));
    const eyepiece = new THREE.Mesh(new THREE.LatheGeometry(barrelProfile, 64), walnut);
    carriage.add(eyepiece);
    function eyepieceRing(radius, thickness, depth, material) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 12, 64), material);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = depth;
        carriage.add(ring);
    }
    eyepieceRing(0.755, 0.055, -0.27, walnut);
    eyepieceRing(0.665, 0.012, -0.29, brass);
    eyepieceRing(0.86, 0.012, -0.10, brass);
    const engravedWood = new THREE.MeshStandardMaterial({ color: 0x352014, roughness: 0.9 });
    // Four pointed compass markers aim inward toward the optical opening.
    const markerShape = new THREE.Shape();
    markerShape.moveTo(-0.045, 0.055);
    markerShape.lineTo(0.045, 0.055);
    markerShape.lineTo(0, -0.075);
    markerShape.closePath();
    const markerGeometry = new THREE.ExtrudeGeometry(markerShape, { depth: 0.01, bevelEnabled: false });
    markerGeometry.rotateX(Math.PI / 2);
    for (let tick = 0; tick < 4; tick++) {
        const angle = tick * Math.PI / 2;
        const mark = new THREE.Mesh(markerGeometry, engravedWood);
        mark.position.set(0.75 * Math.sin(angle), -0.33, 0.75 * Math.cos(angle));
        mark.rotation.y = angle;
        carriage.add(mark);
    }
    // Restore the intermediate hour ticks between the four cardinal pointers.
    const hourMarkGeometry = new THREE.BoxGeometry(0.012, 0.008, 0.028);
    for (let hour = 0; hour < 12; hour++) {
        if (hour % 3 === 0) continue;
        const angle = hour * Math.PI / 6;
        const mark = new THREE.Mesh(hourMarkGeometry, engravedWood);
        mark.position.set(0.75 * Math.sin(angle), -0.327, 0.75 * Math.cos(angle));
        mark.rotation.y = angle;
        carriage.add(mark);
    }
    // Skew the pyramids so their rear faces lie flat on the
    // eyepiece's back plane, with the front faces sloping toward each tip.
    const pyramidLength = 0.51;
    const pyramidFront = eyepieceBack - 0.21;
    const pyramidBaseRadius = 0.74;
    const pyramidCorners = [
        [-0.10, pyramidFront, 0], [0.10, pyramidFront, 0],
        [0.10, eyepieceBack, 0], [-0.10, eyepieceBack, 0],
        [0, eyepieceBack, pyramidLength]
    ];
    const pyramidFaces = [[0, 3, 2], [0, 2, 1], [0, 1, 4], [3, 4, 2], [0, 4, 3], [1, 2, 4]];
    const pyramidGeometry = new THREE.BufferGeometry();
    pyramidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(
        pyramidFaces.flatMap(face => face.flatMap(vertex => pyramidCorners[vertex])), 3
    ));
    pyramidGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(
        pyramidFaces.flatMap(() => [0, 0, 1, 0, 0.5, 1]), 2
    ));
    pyramidGeometry.computeVertexNormals();
    const pyramidWood = walnut.clone();
    pyramidWood.flatShading = true;
    for (let point = 0; point < 4; point++) {
        const angle = point * Math.PI / 2;
        const pyramid = new THREE.Mesh(pyramidGeometry, pyramidWood);
        pyramid.position.set(pyramidBaseRadius * Math.sin(angle), 0, pyramidBaseRadius * Math.cos(angle));
        pyramid.rotation.y = angle;
        carriage.add(pyramid);
    }
    carriage.position.set(0, -8.3, 0);
    mechanism.add(carriage);

    // Render a tightly cropped, supersampled view of the actual raised type.
    // The normal canvas antialiasing does not apply to offscreen render targets.
    const LensRenderTarget = renderer.capabilities.isWebGL2
        ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget;
    const lensView = new LensRenderTarget(256, 256, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false
    });
    lensView.texture.encoding = renderer.outputEncoding;
    const lensCamera = new THREE.PerspectiveCamera();
    const lensMaterial = new THREE.ShaderMaterial({
        uniforms: {
            sceneImage: { value: lensView.texture },
            resolution: { value: new THREE.Vector2() },
            lensCenter: { value: new THREE.Vector2() },
            captureOrigin: { value: new THREE.Vector2() },
            captureSize: { value: new THREE.Vector2() },
            captureResolution: { value: new THREE.Vector2(256, 256) },
            magnification: { value: 1.9 }
        },
        vertexShader: `
            varying vec2 lensUv;
            void main() {
                lensUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D sceneImage;
            uniform vec2 resolution;
            uniform vec2 lensCenter;
            uniform vec2 captureOrigin;
            uniform vec2 captureSize;
            uniform vec2 captureResolution;
            uniform float magnification;
            varying vec2 lensUv;
            void main() {
                vec2 p = lensUv * 2.0 - 1.0;
                float radius = length(p);
                vec2 screenUv = gl_FragCoord.xy / resolution;
                // Slightly less enlargement near the rim suggests curved glass.
                float zoom = magnification - 0.22 * radius * radius;
                vec2 sourceUv = lensCenter + (screenUv - lensCenter) / zoom;
                vec2 sampleUv = (sourceUv - captureOrigin) / captureSize;
                vec2 inset = 0.5 / captureResolution;
                vec4 behind = texture2D(sceneImage, clamp(sampleUv, inset, 1.0 - inset));
                vec3 color = mix(vec3(0.83, 0.92, 0.93), behind.rgb, behind.a);
                color *= vec3(0.98, 1.0, 1.0);
                float edge = smoothstep(0.82, 1.0, radius);
                float reflection = (1.0 - smoothstep(0.015, 0.055, abs(radius - 0.76)))
                    * smoothstep(0.25, 0.65, p.y) * (1.0 - smoothstep(-0.2, 0.45, p.x));
                color = mix(color, vec3(0.94, 0.98, 1.0), 0.16 * edge + 0.32 * reflection);
                gl_FragColor = vec4(color, max(behind.a, 0.16 + 0.25 * edge + 0.3 * reflection));
            }
        `,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        // The captured scene already has the renderer's tone mapping and encoding.
        toneMapped: false
    });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(lensRadius - 0.025, 64), lensMaterial);
    lens.rotation.x = Math.PI / 2;
    lens.position.y = -0.29;
    carriage.add(lens);
    const projectedLensCenter = new THREE.Vector3();
    const projectedLensCorner = new THREE.Vector3();

    function renderLensView() {
        const uniforms = lensMaterial.uniforms;
        const { x: width, y: height } = uniforms.resolution.value;
        projectedLensCenter.setFromMatrixPosition(lens.matrixWorld).project(camera);
        const centerX = (projectedLensCenter.x * 0.5 + 0.5) * width;
        const centerY = (projectedLensCenter.y * 0.5 + 0.5) * height;
        // Project the enclosing square, including perspective when the glass tilts.
        let halfExtent = 1;
        for (const x of [-lensRadius, lensRadius]) {
            for (const y of [-lensRadius, lensRadius]) {
                projectedLensCorner.set(x, y, 0).applyMatrix4(lens.matrixWorld).project(camera);
                halfExtent = Math.max(halfExtent,
                    Math.abs((projectedLensCorner.x - projectedLensCenter.x) * width / 2),
                    Math.abs((projectedLensCorner.y - projectedLensCenter.y) * height / 2));
            }
        }
        const minimumZoom = uniforms.magnification.value - 0.22;
        const cropSize = Math.ceil(halfExtent * 2 / minimumZoom + 4);
        // Bucket sizes avoid reallocating GPU buffers on every drag/zoom frame.
        const targetSize = Math.min(2048, renderer.capabilities.maxTextureSize,
            THREE.MathUtils.ceilPowerOfTwo(Math.max(256, halfExtent * 4)));
        if (lensView.width !== targetSize) {
            lensView.setSize(targetSize, targetSize);
            uniforms.captureResolution.value.set(targetSize, targetSize);
        }
        uniforms.lensCenter.value.set(centerX / width, centerY / height);
        uniforms.captureOrigin.value.set((centerX - cropSize / 2) / width, (centerY - cropSize / 2) / height);
        uniforms.captureSize.value.set(cropSize / width, cropSize / height);
        lensCamera.copy(camera);
        lensCamera.setViewOffset(width, height,
            centerX - cropSize / 2, height - centerY - cropSize / 2, cropSize, cropSize);
        carriage.visible = false;
        try {
            renderer.setRenderTarget(lensView);
            renderer.render(scene, lensCamera);
        } finally {
            renderer.setRenderTarget(null);
            carriage.visible = true;
        }
    }

    // Keep the original raised type, loading the shared font only once.
    const textMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444, metalness: 0.1, roughness: 1
    });
    Promise.all([
        window.simulatorLoading.loadText('dev/wubi06.txt', 'rollerText', 16999),
        window.simulatorLoading.loadText('assets/FangSong_GB2312_Regular.json', 'rollerFont', 9580942)
            .then(source => new THREE.FontLoader().parse(JSON.parse(source))),
        woodMapsReady
    ]).then(async ([data, font, woodMaps]) => {
        for (const material of [walnut, pyramidWood]) {
            Object.assign(material, woodMaps);
            material.color.setRGB(1.25, 1.25, 1.25);
            material.normalScale.set(0.35, 0.35);
            material.needsUpdate = true;
        }
        const lines = data.split(/\r?\n/);
        const totalFaces = rollers.length * 8;
        let completed = 0;
        let batchStarted = performance.now();
        for (const [rowIndex, roller] of rollers.entries()) {
            for (let face = 0; face < 8; face++) {
                const geometry = new THREE.TextGeometry(lines[rowIndex * 8 + face] || '', {
                    font, size: 0.5, height: 0.1,
                    curveSegments: 6, bevelEnabled: false
                });
                const label = new THREE.Mesh(geometry, textMaterial);
                const angle = turn * face / 8;
                label.rotation.x = Math.PI / 2 - angle;
                label.position.set(
                    -9.75,
                    -0.92 * Math.cos(angle) - 0.25 * Math.sin(angle),
                    0.92 * Math.sin(angle) - 0.25 * Math.cos(angle)
                );
                roller.add(label);
                window.simulatorLoading.report('mechanism', ++completed / totalFaces);
                // Yield during geometry construction so the browser can paint
                // progress updates and keep the instruction screen responsive.
                if (performance.now() - batchStarted >= 12) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    batchStarted = performance.now();
                }
            }
        }
        window.simulatorLoading?.ready('mechanism');
    }).catch(error => {
        console.error('Unable to load roller lettering:', error);
        window.simulatorLoading?.fail(error);
    });

    // A longer viewing distance reduces perspective distortion at the ends.
    // Match the original framing at the mechanism's center without stretching it.
    const viewingDistance = 15 * Math.tan(THREE.MathUtils.degToRad(75 / 2))
        / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, -viewingDistance, 0);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);

    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    canvas.title = '拖动旋转 · 滚动或双指捏合缩放 · 双击或连续轻触两次恢复视角';
    canvas.setAttribute('aria-label', '明快打字机三级滚筒；拖动调整水平和俯仰角度，滚动或双指捏合缩放，双击或连续轻触两次恢复视角');
    let yaw = 0;
    let pitch = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const viewResetDuration = 300;
    let viewReset = null;
    const pitchLimit = THREE.MathUtils.degToRad(85);
    function rotateView(dx, dy) {
        yaw += dx * 0.005;
        yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        pitch = THREE.MathUtils.clamp(pitch + dy * 0.005, -pitchLimit, pitchLimit);
        // Rebuild from two angles so mixed drags cannot accumulate roll.
        // Z is the mechanism's upright axis; X is the screen's horizontal axis.
        mechanism.rotation.set(pitch, 0, yaw, 'XZY');
    }
    const pointers = new Map();
    let pinch = null;
    let tap = null;
    let lastTap = null;
    function pointerDistance() {
        const [first, second] = [...pointers.values()];
        return Math.hypot(second.x - first.x, second.y - first.y);
    }
    function zoomView(zoom) {
        camera.zoom = THREE.MathUtils.clamp(zoom, 0.5, 6);
        camera.updateProjectionMatrix();
    }
    function resetView() {
        // Touch browsers may also synthesize dblclick after the second tap.
        if (viewReset) return;
        viewReset = { yaw, pitch, zoom: camera.zoom, started: performance.now() };
        updateResetView(viewReset.started);
    }
    function updateResetView(now) {
        if (!viewReset) return;
        const progress = reducedMotion.matches ? 1
            : THREE.MathUtils.clamp((now - viewReset.started) / viewResetDuration, 0, 1);
        const eased = progress * progress * (3 - 2 * progress);
        yaw = viewReset.yaw * (1 - eased);
        pitch = viewReset.pitch * (1 - eased);
        mechanism.rotation.set(pitch, 0, yaw, 'XZY');
        zoomView(1 + (viewReset.zoom - 1) * (1 - eased));
        if (progress === 1) viewReset = null;
    }
    canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0 || pointers.size >= 2) return;
        viewReset = null;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        canvas.setPointerCapture(event.pointerId);
        if (pointers.size === 2) {
            pinch = { distance: Math.max(1, pointerDistance()), zoom: camera.zoom };
            tap = lastTap = null;
        } else if (event.pointerType === 'touch') {
            tap = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
        } else {
            tap = lastTap = null;
        }
        canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', event => {
        const previous = pointers.get(event.pointerId);
        if (!previous) return;
        if (tap && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 12) {
            tap = lastTap = null;
        }
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 2 && pinch) {
            zoomView(pinch.zoom * pointerDistance() / pinch.distance);
        } else {
            rotateView(event.clientX - previous.x, event.clientY - previous.y);
        }
    });
    function endDrag(event) {
        if (!pointers.delete(event.pointerId)) return;
        const now = performance.now();
        const isTap = event.type === 'pointerup' && tap?.id === event.pointerId
            && now - tap.time <= 250
            && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= 12;
        if (isTap) {
            if (lastTap && now - lastTap.time <= 350
                && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) <= 24) {
                resetView();
                lastTap = null;
            } else {
                lastTap = { x: tap.x, y: tap.y, time: now };
            }
        } else {
            lastTap = null;
        }
        tap = null;
        pinch = null;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        canvas.style.cursor = pointers.size ? 'grabbing' : 'grab';
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', endDrag);
    canvas.addEventListener('wheel', event => {
        if (event.metaKey) return;
        viewReset = null;
        event.preventDefault();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
        const delta = THREE.MathUtils.clamp(event.deltaY * unit, -100, 100);
        // Trackpad pinches arrive as Ctrl+wheel events with smaller deltas.
        const sensitivity = event.ctrlKey ? 0.01 : 0.002;
        zoomView(camera.zoom * Math.exp(-delta * sensitivity));
    }, { passive: false });
    canvas.addEventListener('dblclick', resetView);

    function resize() {
        const { width, height } = container.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height);
        renderer.getDrawingBufferSize(lensMaterial.uniforms.resolution.value);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
    // Resize the drawing buffer together with its next render. Clearing it
    // from ResizeObserver would expose a blank canvas between animation frames.
    let rendererNeedsResize = true;
    new ResizeObserver(() => { rendererNeedsResize = true; }).observe(container);

    const clock = new THREE.Clock();
    let initialized = false;
    function animate() {
        if (rendererNeedsResize) {
            resize();
            rendererNeedsResize = false;
        }
        updateResetView(performance.now());
        const delta = Math.min(clock.getDelta(), 0.05);
        const blend = !initialized || reducedMotion.matches ? 1 : 1 - Math.exp(-22 * delta);
        const top = parseFloat(table.style.top) || 0;
        const progress = tableTo === tableFrom ? 1 : THREE.MathUtils.clamp((top - tableFrom) / (tableTo - tableFrom), 0, 1);
        const selection = reducedMotion.matches ? 1 : progress;
        const largeAngle = THREE.MathUtils.lerp(largeFrom, largeTo, selection);
        const mediumAngle = THREE.MathUtils.lerp(mediumFrom, mediumTo, selection);
        large.rotation.x = THREE.MathUtils.lerp(large.rotation.x, largeAngle, blend);
        large.children.slice(0, 5).forEach((medium, i) => {
            medium.rotation.x = THREE.MathUtils.lerp(medium.rotation.x, -turn * i / 5 + mediumAngle, blend);
        });
        const strike = THREE.MathUtils.clamp(parseFloat(paper.style.getPropertyValue('--strike-progress')) || 0, 0, 1);
        rollers.forEach((roller, index) => {
            const faceAngle = index === row && ind >= 0 && ind < 8 ? turn * ind / 8 * strike : 0;
            const target = -turn * (index % 5) / 5 + faceAngle;
            roller.rotation.x = THREE.MathUtils.lerp(roller.rotation.x, target, blend);
        });
        const firstColumn = rect.width / 2 - rect2.width / 2 - Number(spacing[0]);
        const columnWidth = rect2.width + Number(spacing[0]);
        const tableLeft = parseFloat(table.style.left);
        // The CSV-built table has no inline position on the first frames.
        // Never feed NaN into lerp: it would keep the carriage invisible forever.
        const column = Number.isFinite(tableLeft) && columnWidth > 0
            ? THREE.MathUtils.clamp((firstColumn - tableLeft) / columnWidth, 0, 27)
            : col;
        carriage.position.x = THREE.MathUtils.lerp(carriage.position.x, -9.75 + (column + 0.5) * 19.5 / 28, blend);
        initialized = true;
        scene.updateMatrixWorld(true);
        camera.updateMatrixWorld();
        renderLensView();
        renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(animate);
    document.addEventListener('visibilitychange', () => {
        clock.getDelta();
        renderer.setAnimationLoop(document.hidden ? null : animate);
    });
})();
