// The mechanism follows the same selection and strike state as the magic eye.
(() => {
    const container = document.getElementById('animation');
    const paper = document.getElementById('text');
    const { groupCount, rollersPerGroup, facesPerRoller, columnCount } = machineLayout;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(machineLayout.cameraFov, 1, 0.1, 1000);
    const compactDisplay = window.matchMedia('(any-pointer: coarse)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactDisplay ? 1.5 : 2));
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
    const gearBrass = brass.clone();
    gearBrass.color.setHex(0x806638);
    gearBrass.roughness = 0.4;
    const darkMetal = new THREE.MeshStandardMaterial({
        color: 0x374846, metalness: 0.4, roughness: 0.48
    });
    const { rollerRadius, capRadius } = machineLayout;
    // Keep clearance between all six caps and between the rotating assemblies.
    const rollerOrbitRadius = (2 * capRadius + 0.1) / (2 * Math.sin(Math.PI / rollersPerGroup));
    const mediumOrbitRadius = (2 * (rollerOrbitRadius + capRadius) + 0.15) / (2 * Math.sin(Math.PI / groupCount));
    const rollerGeometry = new THREE.CylinderGeometry(rollerRadius, rollerRadius, 20, facesPerRoller);
    const capGeometry = new THREE.CylinderGeometry(capRadius, capRadius, 0.16, facesPerRoller);
    const axleRadius = 0.24;
    const axleSegments = 24;
    const axleHalfLength = 10.7;
    // Reach through the left plate (-10.47 to -10.33), ending behind it.
    const leftSocketDepth = 0.5;
    const leftSocketFloor = -axleHalfLength + leftSocketDepth;
    // Replace the existing left tip with a recessed section of the same length.
    const axleGeometry = new THREE.CylinderGeometry(
        axleRadius, axleRadius, 2 * axleHalfLength - leftSocketDepth, axleSegments
    );
    // Local +y becomes the left end after cylinder() rotates the shaft.
    // Remove that cap so it cannot compete with the brass socket floor.
    const axleIndices = axleGeometry.getIndex();
    const visibleAxleIndices = [];
    for (const group of axleGeometry.groups) {
        if (group.materialIndex === 1) continue;
        for (let index = group.start; index < group.start + group.count; index++) {
            visibleAxleIndices.push(axleIndices.getX(index));
        }
    }
    axleGeometry.setIndex(visibleAxleIndices);
    axleGeometry.clearGroups();
    // User inspection stays separate from the keyboard-driven roller pivots.
    const mechanism = new THREE.Group();
    scene.add(mechanism);
    const large = new THREE.Group();
    mechanism.add(large);
    const mediumGroups = [];
    const rollers = [];
    const turn = Math.PI * 2;

    // Cut into the small circular axle, keeping its original left endpoint.
    function leftSocketOutline() {
        const outline = new THREE.Shape();
        // Match the circular axle's radius, segments, and angular alignment.
        for (let vertex = 0; vertex < axleSegments; vertex++) {
            const angle = turn * vertex / axleSegments - Math.PI / facesPerRoller;
            const u = axleRadius * Math.cos(angle);
            const v = axleRadius * Math.sin(angle);
            if (vertex === 0) outline.moveTo(u, v);
            else outline.lineTo(u, v);
        }
        outline.closePath();
        // After mapping onto the end face, this tip points along local -y:
        // radially outward from the medium group's center in the home position.
        const socket = new THREE.Path();
        socket.moveTo(0, -0.17);
        socket.lineTo(-0.147, 0.085);
        socket.lineTo(0.147, 0.085);
        socket.closePath();
        outline.holes.push(socket);
        return outline;
    }
    function leftSocketGeometry() {
        const geometry = new THREE.ExtrudeGeometry(leftSocketOutline(), {
            depth: leftSocketDepth, steps: 1, bevelEnabled: false
        });
        // Extrusion runs toward the left (-x), with an actual open triangular
        // mouth and three inner walls. The solid axle closes its deep end.
        geometry.rotateY(-Math.PI / 2);
        // Give only the three inner walls the same brass finish as the rims.
        const positions = geometry.getAttribute('position');
        const normals = geometry.getAttribute('normal');
        geometry.clearGroups();
        for (let vertex = 0; vertex < positions.count; vertex += 3) {
            let y = 0, z = 0;
            for (let corner = 0; corner < 3; corner++) {
                y += positions.getY(vertex + corner) / 3;
                z += positions.getZ(vertex + corner) / 3;
            }
            const interior = Math.abs(normals.getX(vertex)) < 0.5
                && Math.hypot(y, z) < 0.2;
            const materialIndex = interior ? 1 : 0;
            const previous = geometry.groups[geometry.groups.length - 1];
            if (previous && previous.materialIndex === materialIndex) previous.count += 3;
            else geometry.addGroup(vertex, 3, materialIndex);
        }
        return geometry;
    }
    const leftSocketWallGeometry = leftSocketGeometry();
    const leftSocketFloorGeometry = new THREE.ShapeGeometry(
        new THREE.Shape(leftSocketOutline().holes[0].getPoints())
    );
    leftSocketFloorGeometry.rotateY(-Math.PI / 2);

    // Wrap the six roller centers with tangent lines and circular corners.
    // Each corner is concentric with a roller; its beveled edge matches the cap.
    const hubOutline = new THREE.Shape();
    for (let corner = 0; corner < rollersPerGroup; corner++) {
        const angle = Math.PI + turn * corner / rollersPerGroup;
        hubOutline.absarc(
            rollerOrbitRadius * Math.cos(angle),
            rollerOrbitRadius * Math.sin(angle),
            rollerRadius,
            angle - Math.PI / rollersPerGroup,
            angle + Math.PI / rollersPerGroup,
            false
        );
    }
    hubOutline.closePath();
    const leftHubOutline = hubOutline.clone();
    for (let roller = 0; roller < rollersPerGroup; roller++) {
        const angle = turn * roller / rollersPerGroup;
        const clearance = new THREE.Path();
        // Round clearance lets the triangular socket turn with its axle without
        // the stationary plate obstructing it. Allow room for the plate bevel.
        clearance.absarc(-rollerOrbitRadius * Math.cos(angle),
            rollerOrbitRadius * Math.sin(angle), axleRadius + 0.04, 0, turn, true);
        leftHubOutline.holes.push(clearance);
    }
    function endPlateGeometry(outline) {
        const geometry = new THREE.ExtrudeGeometry(outline, {
            depth: 0.1, steps: 1, curveSegments: 12,
            bevelEnabled: true, bevelThickness: 0.02,
            bevelSize: capRadius - rollerRadius, bevelSegments: 2
        });
        // Map the outline onto y/z and center its thickness on x.
        geometry.translate(0, 0, -0.05);
        geometry.rotateX(Math.PI / 2);
        geometry.rotateZ(Math.PI / 2);
        return geometry;
    }
    const hubGeometry = endPlateGeometry(hubOutline);
    const leftHubGeometry = endPlateGeometry(leftHubOutline);

    function cylinder(geometry, material, parent, x = 0) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.z = Math.PI / 2;
        mesh.rotation.x = Math.PI / facesPerRoller;
        mesh.position.x = x;
        parent.add(mesh);
        return mesh;
    }

    for (let i = 0; i < groupCount; i++) {
        const medium = new THREE.Group();
        const angle = turn * i / groupCount;
        medium.position.set(0, -mediumOrbitRadius * Math.cos(angle), mediumOrbitRadius * Math.sin(angle));
        large.add(medium);
        mediumGroups.push(medium);
        for (let j = 0; j < rollersPerGroup; j++) {
            const small = new THREE.Group();
            // The 2:1 gear train adds two carrier turns to each middle
            // assembly. Re-index its rollers so selection still places the
            // requested row directly behind the eyepiece when it settles.
            const angle = turn * j / rollersPerGroup + 2 * turn * i / groupCount;
            small.userData.assemblyAngle = angle;
            small.position.set(0, -rollerOrbitRadius * Math.cos(angle), rollerOrbitRadius * Math.sin(angle));
            small.rotation.x = -angle;
            medium.add(small);
            cylinder(rollerGeometry, steel, small);
            cylinder(axleGeometry, darkMetal, small, leftSocketDepth / 2);
            cylinder(capGeometry, brass, small, -10);
            const socket = new THREE.Mesh(leftSocketWallGeometry, [darkMetal, brass]);
            socket.position.x = leftSocketFloor;
            small.add(socket);
            const socketFloor = new THREE.Mesh(leftSocketFloorGeometry, brass);
            socketFloor.position.x = leftSocketFloor;
            small.add(socketFloor);
            cylinder(capGeometry, brass, small, 10);
            rollers.push(small);
        }
        for (const x of [-10.4, 10.4]) {
            const endPlate = new THREE.Mesh(x < 0 ? leftHubGeometry : hubGeometry, darkMetal);
            endPlate.position.x = x;
            medium.add(endPlate);
        }
    }
    cylinder(new THREE.CylinderGeometry(0.4, 0.4, 22.4, 32), brass, large);

    // A continuous, six-armed casting replaces each wheel and its spokes.
    // Broad roots flow into narrow, rounded tips centered on the roller pivots.
    const supportOutline = new THREE.Shape();
    const armRootRadius = mediumOrbitRadius * 0.42;
    const armTipRadius = 0.48;
    const rootTangent = mediumOrbitRadius * 0.15;
    const tipTangent = mediumOrbitRadius * 0.35;
    function supportPoint(angle, radius, tangent = 0) {
        return new THREE.Vector2(
            radius * Math.cos(angle) - tangent * Math.sin(angle),
            radius * Math.sin(angle) + tangent * Math.cos(angle)
        );
    }
    for (let arm = 0; arm < groupCount; arm++) {
        const angle = Math.PI + turn * arm / groupCount;
        const before = angle - Math.PI / groupCount;
        const after = angle + Math.PI / groupCount;
        const valley = supportPoint(before, armRootRadius);
        const rootControl = supportPoint(before, armRootRadius, rootTangent);
        const tipControl = supportPoint(angle, mediumOrbitRadius - tipTangent, -armTipRadius);
        const tipStart = supportPoint(angle, mediumOrbitRadius, -armTipRadius);
        const tipCenter = supportPoint(angle, mediumOrbitRadius);
        if (arm === 0) supportOutline.moveTo(valley.x, valley.y);
        supportOutline.bezierCurveTo(
            rootControl.x, rootControl.y, tipControl.x, tipControl.y, tipStart.x, tipStart.y
        );
        supportOutline.absarc(tipCenter.x, tipCenter.y, armTipRadius,
            angle - Math.PI / 2, angle + Math.PI / 2, false);
        const returnControl = supportPoint(angle, mediumOrbitRadius - tipTangent, armTipRadius);
        const nextRootControl = supportPoint(after, armRootRadius, -rootTangent);
        const nextValley = supportPoint(after, armRootRadius);
        supportOutline.bezierCurveTo(
            returnControl.x, returnControl.y, nextRootControl.x, nextRootControl.y,
            nextValley.x, nextValley.y
        );
    }
    supportOutline.closePath();
    const supportDepth = 0.24;
    const supportBevelThickness = 0.04;
    const supportThickness = supportDepth + 2 * supportBevelThickness;
    const supportGeometry = new THREE.ExtrudeGeometry(supportOutline, {
        depth: supportDepth, steps: 1, curveSegments: 20,
        bevelEnabled: true, bevelThickness: supportBevelThickness, bevelSize: 0.045, bevelSegments: 3
    });
    supportGeometry.translate(0, 0, -supportDepth / 2);
    supportGeometry.rotateX(Math.PI / 2);
    supportGeometry.rotateZ(Math.PI / 2);
    const supportMetal = darkMetal.clone();
    supportMetal.color.setHex(0x1b2826);
    // Illustrative scale, not historical dimensions: a 20-unit roll is 10 in.
    const modelUnitsPerInch = 2;
    const leftSleeveLength = 1.0 * modelUnitsPerInch;
    const leftSleeveOuterRadius = (2.5 / 2) * modelUnitsPerInch;
    const leftSleeveInnerRadius = leftSleeveOuterRadius - supportThickness;
    function sleeveGeometry(outerRadius, innerRadius, stepHeight, stepStart = 0,
        length = leftSleeveLength, stairSweep = turn, taperReturnRadially = false) {
        const stairCount = 6;
        const segmentsPerStair = 32;
        const sectionCount = stairCount + (stairSweep < turn ? 1 : 0);
        const tipWidth = Math.min(outerRadius - innerRadius, 0.01 * modelUnitsPerInch);
        const positions = [];
        const groups = [];
        function point(radius, x, angle) {
            return [x, radius * Math.cos(angle), radius * Math.sin(angle)];
        }
        function quad(a, b, c, d, materialIndex = 0) {
            const start = positions.length / 3;
            for (const [p, q, r] of [[a, b, c], [a, c, d]]) {
                const u = q.map((value, i) => value - p[i]);
                const v = r.map((value, i) => value - p[i]);
                const area = Math.hypot(u[1] * v[2] - u[2] * v[1],
                    u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
                // At the taper's zero-thickness tip, a quad becomes a triangle.
                if (area > 1e-12) positions.push(...p, ...q, ...r);
            }
            const count = positions.length / 3 - start;
            if (!count) return;
            const previous = groups[groups.length - 1];
            if (previous && previous.materialIndex === materialIndex) previous.count += count;
            else groups.push({ start, count, materialIndex });
        }
        for (let section = 0; section < sectionCount; section++) {
            const stair = Math.min(section, stairCount - 1);
            const startAngle = section < stairCount ? stairSweep * section / stairCount : stairSweep;
            const endAngle = section < stairCount ? stairSweep * (section + 1) / stairCount : turn;
            const segments = Math.max(segmentsPerStair,
                Math.ceil((endAngle - startAngle) / turn * stairCount * segmentsPerStair));
            for (let segment = 0; segment < segments; segment++) {
                const t0 = segment / segments;
                const t1 = (segment + 1) / segments;
                const a0 = startAngle + (endAngle - startAngle) * t0;
                const a1 = startAngle + (endAngle - startAngle) * t1;
                const x = -length + stepStart + stair * stepHeight;
                const isReturn = taperReturnRadially && section === sectionCount - 1;
                // Quintic easing gives zero slope and curvature at both ends,
                // smoothly joining the full-width wall and the thin tip.
                const remainingWidth = t => 1 - t * t * t * (t * (6 * t - 15) + 10);
                const radius0 = isReturn ? innerRadius + tipWidth
                    + (outerRadius - innerRadius - tipWidth) * remainingWidth(t0) : outerRadius;
                const radius1 = isReturn ? innerRadius + tipWidth
                    + (outerRadius - innerRadius - tipWidth) * remainingWidth(t1) : outerRadius;
                const outer0 = point(radius0, x, a0);
                const outer1 = point(radius1, x, a1);
                const inner0 = point(innerRadius, x, a0);
                const inner1 = point(innerRadius, x, a1);
                const backOuter0 = point(radius0, 0, a0);
                const backOuter1 = point(radius1, 0, a1);
                const backInner0 = point(innerRadius, 0, a0);
                const backInner1 = point(innerRadius, 0, a1);
                quad(outer0, outer1, backOuter1, backOuter0, 2);
                quad(inner0, backInner0, backInner1, inner1);
                quad(inner0, inner1, outer1, outer0, 1);
                quad(backInner0, backOuter0, backOuter1, backInner1, 1);
            }
            // Close each flat step's riser and the return to stair 1.
            const angle = endAngle;
            const endX = -length + stepStart + stair * stepHeight;
            const nextStair = Math.min((section + 1) % sectionCount, stairCount - 1);
            const nextX = -length + stepStart + nextStair * stepHeight;
            if (taperReturnRadially && section === sectionCount - 1) {
                // Close both exposed faces of the finite-width tip: its deep
                // end and the first stair's wider, shallower radial section.
                const tipRadius = innerRadius + tipWidth;
                quad(point(innerRadius, endX, angle), point(innerRadius, nextX, angle),
                    point(tipRadius, nextX, angle), point(tipRadius, endX, angle), 1);
                quad(point(tipRadius, nextX, angle), point(outerRadius, nextX, angle),
                    point(outerRadius, 0, angle), point(tipRadius, 0, angle), 1);
            } else if (endX !== nextX) {
                const corners = [point(innerRadius, endX, angle),
                    point(innerRadius, nextX, angle),
                    point(outerRadius, nextX, angle),
                    point(outerRadius, endX, angle)];
                // This vertex order naturally faces the exposed side for
                // either jump direction, including the large return seam.
                quad(...corners, 1);
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        for (const group of groups) geometry.addGroup(group.start, group.count, group.materialIndex);
        geometry.computeVertexNormals();
        return geometry;
    }
    const leftSleeveGeometry = sleeveGeometry(leftSleeveOuterRadius,
        leftSleeveInnerRadius, -0.1 * modelUnitsPerInch,
        leftSleeveLength - 0.1 * modelUnitsPerInch, leftSleeveLength, turn, true);
    // Turn the stepped sleeve end-for-end: its level rim is now at the full
    // 1.0-inch outer edge, while its six steps face back toward the machine.
    leftSleeveGeometry.rotateY(Math.PI);
    leftSleeveGeometry.translate(-leftSleeveLength, 0, 0);
    // G is group 0, on local -y. Align the large return seam with that arm.
    leftSleeveGeometry.rotateX(Math.PI);
    // The second tube fits exactly inside the first and retains the same wall
    // thickness. A zero step height gives it a full-length, level circular rim.
    const innerSleeveGeometry = sleeveGeometry(leftSleeveInnerRadius,
        leftSleeveInnerRadius - supportThickness, 0);
    // A thin annular gear collars the inner tube at its machine-side root.
    const sleeveGearThickness = 0.1 * modelUnitsPerInch;
    const sleeveGearOutline = new THREE.Shape();
    const sleeveGearTeeth = 36;
    for (let vertex = 0; vertex < sleeveGearTeeth * 4; vertex++) {
        const angle = turn * vertex / (sleeveGearTeeth * 4);
        const radius = leftSleeveInnerRadius + (vertex % 4 === 1 || vertex % 4 === 2 ? 0.3 : 0.14);
        if (vertex === 0) sleeveGearOutline.moveTo(radius * Math.cos(angle), radius * Math.sin(angle));
        else sleeveGearOutline.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
    }
    sleeveGearOutline.closePath();
    const sleeveGearBore = new THREE.Path();
    sleeveGearBore.absarc(0, 0, leftSleeveInnerRadius, 0, turn, true);
    sleeveGearOutline.holes.push(sleeveGearBore);
    const sleeveGearGeometry = new THREE.ExtrudeGeometry(sleeveGearOutline, {
        depth: sleeveGearThickness, steps: 1, curveSegments: 48, bevelEnabled: false
    });
    finishGearTeeth(sleeveGearGeometry, leftSleeveInnerRadius + 0.14);
    sleeveGearGeometry.rotateY(-Math.PI / 2);
    function finishGearTeeth(geometry, rootRadius) {
        // Before axis mapping, extrusion is along z. Only the perimeter's
        // vertical tooth walls get brass; faces, bores and arm walls stay steel.
        const positions = geometry.getAttribute('position');
        const normals = geometry.getAttribute('normal');
        geometry.clearGroups();
        for (let vertex = 0; vertex < positions.count; vertex += 3) {
            let toothWall = Math.abs(normals.getZ(vertex)) < 0.5;
            for (let corner = 0; corner < 3 && toothWall; corner++) {
                toothWall = Math.hypot(positions.getX(vertex + corner),
                    positions.getY(vertex + corner)) >= rootRadius - 0.00001;
            }
            const materialIndex = toothWall ? 1 : 0;
            const previous = geometry.groups[geometry.groups.length - 1];
            if (previous && previous.materialIndex === materialIndex) previous.count += 3;
            else geometry.addGroup(vertex, 3, materialIndex);
        }
    }
    const supportHubGeometry = new THREE.CylinderGeometry(0.72, 0.72, 0.48, 32);
    const rightSupportHubGeometry = new THREE.CylinderGeometry(0.72, 0.72, supportThickness, 32);
    const bearingGeometry = new THREE.CylinderGeometry(0.28, 0.28, 0.45, 24);
    const pivotCapGeometry = new THREE.CylinderGeometry(0.38, 0.38, 0.08, 24);
    for (const side of [-1, 1]) {
        const support = new THREE.Group();
        support.name = side < 0 ? 'left-starfish-support' : 'right-starfish-support';
        support.position.x = side * 10.85;
        large.add(support);

        // Brass on the bevel traces the smooth boundary of the dark metal face.
        const body = new THREE.Mesh(supportGeometry, [supportMetal, brass]);
        support.add(body);
        cylinder(side > 0 ? rightSupportHubGeometry : supportHubGeometry, brass, support);
        if (side < 0) {
            const sleeve = new THREE.Mesh(leftSleeveGeometry, [steel, brass, steel]);
            sleeve.position.x = -supportThickness / 2;
            support.add(sleeve);
            sleeve.name = 'left-starfish-hollow-cylinder';
            const innerSleeve = new THREE.Mesh(innerSleeveGeometry, [steel, brass, darkMetal]);
            innerSleeve.position.x = sleeve.position.x;
            innerSleeve.name = 'left-starfish-inner-hollow-cylinder';
            support.add(innerSleeve);
            const rootGear = new THREE.Mesh(sleeveGearGeometry, [steel, gearBrass]);
            rootGear.position.x = innerSleeve.position.x;
            rootGear.name = 'left-inner-cylinder-root-gear';
            support.add(rootGear);
        }

        for (let i = 0; i < groupCount; i++) {
            const angle = turn * i / groupCount;
            const y = -mediumOrbitRadius * Math.cos(angle);
            const z = mediumOrbitRadius * Math.sin(angle);
            // Short journals join each arm tip to an independently turning plate.
            const bearing = cylinder(bearingGeometry, brass, support, -side * 0.225);
            bearing.name = `bearing-${i}`;
            bearing.position.y = y;
            bearing.position.z = z;
            // On the right, seat the caps flush so the gears can touch the face.
            const capX = side > 0 ? supportThickness / 2 - 0.04 : side * 0.18;
            const cap = cylinder(pivotCapGeometry, supportMetal, support, capX);
            cap.position.y = y;
            cap.position.z = z;
        }
    }

    // Right-side gearing: equal module and a 2:1 tooth/radius ratio put all
    // six small gears on the existing medium-assembly centers.
    const rightGearThickness = 0.1 * modelUnitsPerInch;
    const rightSupportFaceX = 10.85 + supportThickness / 2;
    const rightGearX = rightSupportFaceX + rightGearThickness / 2;
    const rightGearOuterFaceX = rightGearX + rightGearThickness / 2;
    const smallGearTeeth = 24;
    const smallGearPitchRadius = mediumOrbitRadius / 3;
    const centralGearPitchRadius = 2 * smallGearPitchRadius;
    const gearModule = 2 * smallGearPitchRadius / smallGearTeeth;
    const rightSleeveOuterRadius = (1.6 / 2) * modelUnitsPerInch;
    const rightSleeveInnerRadius = rightSleeveOuterRadius - supportThickness;
    // Keep the two tubes hollow while clearing the center shaft at the root.
    const rightInnerSleeveBoreRadius = Math.max(rightSleeveInnerRadius - supportThickness, 0.4);
    function rightGearGeometry(pitchRadius, teeth, boreRadius, phase = 0, baseRadius = 0) {
        const outline = new THREE.Shape();
        const rootRadius = pitchRadius - 1.25 * gearModule;
        const tipRadius = pitchRadius + gearModule;
        const toothProfile = [
            [-0.5, rootRadius], [-0.35, rootRadius],
            [-0.24, pitchRadius], [-0.12, tipRadius],
            [0.12, tipRadius], [0.24, pitchRadius], [0.35, rootRadius]
        ];
        for (let tooth = 0; tooth < teeth; tooth++) {
            for (const [offset, radius] of toothProfile) {
                const angle = phase + turn * (tooth + offset) / teeth;
                const u = radius * Math.cos(angle), v = radius * Math.sin(angle);
                if (tooth === 0 && offset === -0.5) outline.moveTo(u, v);
                else outline.lineTo(u, v);
            }
        }
        outline.closePath();
        const bore = new THREE.Path();
        bore.absarc(0, 0, boreRadius, 0, turn, true);
        outline.holes.push(bore);
        // Three curved windows leave a small, continuous starfish casting
        // between the shaft hub and the toothed outer ring.
        const windowRadius = rootRadius - Math.max(0.18, rootRadius * 0.12);
        const armTipHalfAngle = 0.22;
        for (let arm = 0; arm < 3; arm++) {
            const start = phase + turn * arm / 3;
            const end = start + turn / 3;
            const opening = new THREE.Path();
            opening.absarc(0, 0, windowRadius,
                start + armTipHalfAngle, end - armTipHalfAngle, false);
            // Tangential controls blend the three arms into rounded tips and
            // broad curved roots, matching the six-arm support's smooth cast.
            const outerReturn = supportPoint(end - armTipHalfAngle, windowRadius, windowRadius * 0.16);
            // Broaden the center and match both tangent and curvature where
            // the two arm curves meet, avoiding a pinched central junction.
            const valleyAngle = (start + end) / 2;
            // All seven wheels share the same arm profile. Keeping the valley
            // outside baseRadius also preserves the center tube's solid base.
            const valleyRadius = Math.max(baseRadius, boreRadius + 0.18, pitchRadius * 0.32);
            const innerEnd = supportPoint(valleyAngle, valleyRadius);
            const valleyTangent = (-(outerReturn.x - innerEnd.x) * Math.sin(valleyAngle)
                + (outerReturn.y - innerEnd.y) * Math.cos(valleyAngle)) / 2;
            const innerReturn = supportPoint(valleyAngle, valleyRadius, valleyTangent);
            opening.bezierCurveTo(outerReturn.x, outerReturn.y,
                innerReturn.x, innerReturn.y, innerEnd.x, innerEnd.y);
            const innerStart = supportPoint(valleyAngle, valleyRadius, -valleyTangent);
            const outerStart = supportPoint(start + armTipHalfAngle, windowRadius, -windowRadius * 0.16);
            const outerEnd = supportPoint(start + armTipHalfAngle, windowRadius);
            opening.bezierCurveTo(innerStart.x, innerStart.y,
                outerStart.x, outerStart.y, outerEnd.x, outerEnd.y);
            opening.closePath();
            outline.holes.push(opening);
        }
        const geometry = new THREE.ExtrudeGeometry(outline, {
            depth: rightGearThickness, steps: 1, curveSegments: 48, bevelEnabled: false
        });
        finishGearTeeth(geometry, rootRadius);
        geometry.translate(0, 0, -rightGearThickness / 2);
        geometry.rotateX(Math.PI / 2);
        geometry.rotateZ(Math.PI / 2);
        return geometry;
    }
    const rightGearing = new THREE.Group();
    rightGearing.name = 'right-six-gear-assembly';
    large.add(rightGearing);
    const centerGear = new THREE.Mesh(
        rightGearGeometry(centralGearPitchRadius, smallGearTeeth * 2, 0.4, 0,
            rightSleeveInnerRadius), [steel, gearBrass]);
    centerGear.name = 'right-center-shaft-gear';
    centerGear.position.x = rightGearX;
    rightGearing.add(centerGear);
    const rightHexCapHeight = 0.08 * modelUnitsPerInch;
    const rightHexCapX = rightGearThickness / 2 + rightHexCapHeight / 2 - 0.01;
    const hexCapBrass = brass.clone();
    hexCapBrass.flatShading = true;
    const centerHexCap = cylinder(new THREE.CylinderGeometry(0.5, 0.5,
        rightHexCapHeight, 6), hexCapBrass, centerGear, rightHexCapX);
    centerHexCap.name = 'right-center-gear-raised-hex-cap';
    const smallHexCapGeometry = new THREE.CylinderGeometry(0.35, 0.35, rightHexCapHeight, 6);
    // Mirror the left pair beyond the gear plane. The inner tube follows the
    // center gear, together with its detached stepped outer sleeve.
    // Pass through the full arm casting, rather than ending against its face.
    // Bury the root slightly in the support so its cap cannot fight the gear's
    // rear face. Keep the original outer rim aligned with the stepped sleeve.
    const rightSleeveRootOverlap = 0.01;
    const rightInnerSleeveGeometry = sleeveGeometry(rightSleeveInnerRadius,
        rightInnerSleeveBoreRadius, 0, 0,
        leftSleeveLength + rightGearThickness + rightSleeveRootOverlap);
    const rightInnerSleeve = new THREE.Mesh(rightInnerSleeveGeometry, [steel, brass, darkMetal]);
    rightInnerSleeve.name = 'right-starfish-inner-hollow-cylinder';
    rightInnerSleeve.rotation.y = Math.PI;
    rightInnerSleeve.position.x = -rightGearThickness / 2 - rightSleeveRootOverlap;
    centerGear.add(rightInnerSleeve);
    // Six 30-degree stairs start 0.1 in deep. The remaining half-circle
    // keeps stair six's axial height while its radial wall tapers to 0.01 in.
    const rightSteppedSleeveGeometry = sleeveGeometry(rightSleeveOuterRadius,
        rightSleeveInnerRadius, -0.1 * modelUnitsPerInch,
        leftSleeveLength - 0.1 * modelUnitsPerInch, leftSleeveLength, Math.PI, true);
    rightSteppedSleeveGeometry.rotateY(Math.PI);
    rightSteppedSleeveGeometry.translate(-leftSleeveLength, 0, 0);
    rightSteppedSleeveGeometry.rotateX(Math.PI);
    const rightSteppedSleeve = new THREE.Mesh(rightSteppedSleeveGeometry, [steel, brass, steel]);
    rightSteppedSleeve.name = 'right-starfish-hollow-cylinder';
    rightSteppedSleeve.rotation.y = Math.PI;
    rightSteppedSleeve.position.x = rightGearThickness / 2;
    centerGear.add(rightSteppedSleeve);
    // Extend the center shaft through the gear and the six pivot journals
    // beyond the starfish, without changing either support or hexagonal plate.
    const journalStartX = rightSupportFaceX - 0.05;
    const journalLength = rightGearOuterFaceX - journalStartX;
    const journalCenterX = (journalStartX + rightGearOuterFaceX) / 2;
    cylinder(new THREE.CylinderGeometry(0.4, 0.4, journalLength, 32), brass,
        rightGearing, journalCenterX);
    const smallRightGearGeometry = rightGearGeometry(smallGearPitchRadius,
        smallGearTeeth, 0.28, Math.PI / smallGearTeeth);
    const rightGearJournalGeometry = new THREE.CylinderGeometry(0.28, 0.28, journalLength, 32);
    const rightSmallGears = [];
    for (let i = 0; i < groupCount; i++) {
        const angle = turn * i / groupCount;
        const y = -mediumOrbitRadius * Math.cos(angle);
        const z = mediumOrbitRadius * Math.sin(angle);
        const gear = new THREE.Mesh(smallRightGearGeometry, [steel, gearBrass]);
        gear.name = `right-small-gear-${i}`;
        // Inherit the corresponding middle roller's selection and animation
        // directly, with its pivot already positioned at this gear's center.
        gear.position.x = rightGearX;
        mediumGroups[i].add(gear);
        rightSmallGears.push(gear);
        const cap = cylinder(smallHexCapGeometry, hexCapBrass, gear, rightHexCapX);
        cap.name = `right-small-gear-${i}-raised-hex-cap`;
        const journal = cylinder(rightGearJournalGeometry, brass, rightGearing, journalCenterX);
        journal.position.y = y;
        journal.position.z = z;
    }

    scene.add(new THREE.HemisphereLight(0xf5faff, 0x74634b, 0.9));
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
    carriage.position.set(0, -(mediumOrbitRadius + rollerOrbitRadius + rollerRadius + 0.3), 0);
    mechanism.add(carriage);

    // Temporarily disable the glass and its extra render pass for comparison.
    const eyepieceGlassEnabled = true;
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
            magnification: { value: 1.5 },
            edgeFalloff: { value: 0.25 }
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
            uniform float edgeFalloff;
            varying vec2 lensUv;
            void main() {
                vec2 p = lensUv * 2.0 - 1.0;
                float radius = length(p);
                vec2 screenUv = gl_FragCoord.xy / resolution;
                // Slightly less enlargement near the rim suggests curved glass.
                float zoom = magnification - edgeFalloff * radius * radius;
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
    lens.visible = eyepieceGlassEnabled;
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
        const minimumZoom = uniforms.magnification.value - uniforms.edgeFalloff.value;
        const cropSize = Math.ceil(halfExtent * 2 / minimumZoom + 4);
        // Bucket sizes avoid reallocating GPU buffers on every drag/zoom frame.
        const targetSize = Math.min(compactDisplay ? 1024 : 2048, renderer.capabilities.maxTextureSize,
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
        color: 0x333333, metalness: 0.1, roughness: 1
    });
    // TextGeometry repeats each triangle's vertices and includes unused UVs.
    // Share identical positions/normals without changing the raised surface.
    function buildTypeGeometry(text, font, curveSegments) {
        const source = new THREE.TextGeometry(text, {
            font, size: 0.5, height: 0.1, curveSegments, bevelEnabled: false
        });
        const positions = source.attributes.position.array;
        const normals = source.attributes.normal.array;
        const vertices = new Map();
        const packedPositions = [], packedNormals = [], indices = [];
        for (let offset = 0; offset < positions.length; offset += 3) {
            const position = [positions[offset], positions[offset + 1], positions[offset + 2]];
            const normal = [normals[offset], normals[offset + 1], normals[offset + 2]];
            const key = [...position, ...normal].join(',');
            let index = vertices.get(key);
            if (index === undefined) {
                index = packedPositions.length / 3;
                vertices.set(key, index);
                packedPositions.push(...position);
                packedNormals.push(...normal);
            }
            indices.push(index);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(packedPositions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(packedNormals, 3));
        geometry.setIndex(indices);
        geometry.computeBoundingSphere();
        source.dispose();
        return geometry;
    }
    const rollerLabels = [];
    const baseTypeGeometry = new WeakMap();
    const detailedTypeLabels = new Set();
    let typeFont = null;
    let typeLines = [];
    let requestedDetailRow = null;
    let typeDetailVersion = 0;
    async function detailSelectedRoller(rowIndex) {
        if (!typeFont || requestedDetailRow === rowIndex) return;
        requestedDetailRow = rowIndex;
        const version = ++typeDetailVersion;
        // Bound the full-detail cache to the selected roller, even after typing
        // through all 36 cards. Every other roller keeps its raised base type.
        for (const label of detailedTypeLabels) {
            label.geometry.dispose();
            label.geometry = baseTypeGeometry.get(label);
        }
        detailedTypeLabels.clear();
        for (const [face, label] of rollerLabels[rowIndex].entries()) {
            if (version !== typeDetailVersion) return;
            label.geometry = buildTypeGeometry(typeLines[rowIndex * facesPerRoller + face] || '', typeFont, 6);
            detailedTypeLabels.add(label);
            requestRender();
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    Promise.all([
        window.simulatorLoading.loadText(window.simulatorLoading.scheme.rollerTextUrl, 'rollerText',
            window.simulatorLoading.scheme.rollerTextBytes),
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
        typeLines = data.split(/\r?\n/);
        const totalFaces = rollers.length * facesPerRoller;
        let completed = 0;
        let batchStarted = performance.now();
        for (const [rowIndex, roller] of rollers.entries()) {
            const labels = [];
            rollerLabels.push(labels);
            for (let face = 0; face < facesPerRoller; face++) {
                const geometry = buildTypeGeometry(typeLines[rowIndex * facesPerRoller + face] || '', font, compactDisplay ? 1 : 2);
                const label = new THREE.Mesh(geometry, textMaterial);
                labels.push(label);
                baseTypeGeometry.set(label, geometry);
                const angle = turn * face / facesPerRoller;
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
        typeFont = font;
        await detailSelectedRoller(window.machineState.targetVerticalPosition);
        requestRender();
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
        requestRender();
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
        requestRender();
    }
    function resetView() {
        // Touch browsers may also synthesize dblclick after the second tap.
        if (viewReset) return;
        viewReset = { yaw, pitch, zoom: camera.zoom, started: performance.now() };
        updateResetView(viewReset.started);
        requestRender(viewResetDuration);
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
    new ResizeObserver(() => {
        rendererNeedsResize = true;
        requestRender();
    }).observe(container);

    const clock = new THREE.Clock();
    let initialized = false;
    let centerGearWorldAngle = 0;
    let frameRequest = null;
    let renderUntil = 0;
    function requestRender(duration = 0) {
        renderUntil = Math.max(renderUntil, performance.now() + duration);
        if (frameRequest === null && !document.hidden) frameRequest = requestAnimationFrame(animate);
    }
    window.requestMechanismRender = requestRender;
    function animate() {
        frameRequest = null;
        if (rendererNeedsResize) {
            resize();
            rendererNeedsResize = false;
        }
        updateResetView(performance.now());
        const delta = Math.min(clock.getDelta(), 0.05);
        const blend = !initialized || reducedMotion.matches ? 1 : 1 - Math.exp(-22 * delta);
        const selection = window.machineState.mechanismSelection;
        const row = window.machineState.targetVerticalPosition;
        const ind = window.machineState.strikeFace;
        if (Math.abs(selection.row - row) < 0.001) {
            detailSelectedRoller(row).catch(error => console.error('Unable to refine roller lettering:', error));
        }
        const largeAngle = selection.large;
        large.rotation.x = THREE.MathUtils.lerp(large.rotation.x, largeAngle, blend);
        // Solve the 2:1 mesh, then rotate each complete middle assembly with
        // its gear. The hexagonal plates and hex caps inherit that same turn.
        centerGearWorldAngle = THREE.MathUtils.lerp(centerGearWorldAngle, selection.centerGear, blend);
        centerGear.rotation.x = centerGearWorldAngle - large.rotation.x;
        mediumGroups.forEach((medium, i) => {
            medium.rotation.x = -turn * i / groupCount - 2 * centerGear.rotation.x;
            rightSmallGears[i].rotation.x = 0;
        });
        const strike = THREE.MathUtils.clamp(parseFloat(paper.style.getPropertyValue('--strike-progress')) || 0, 0, 1);
        rollers.forEach((roller, index) => {
            const faceAngle = index === row && ind >= 0 && ind < facesPerRoller ? turn * ind / facesPerRoller * strike : 0;
            const target = -roller.userData.assemblyAngle + faceAngle;
            roller.rotation.x = THREE.MathUtils.lerp(roller.rotation.x, target, blend);
        });
        initialized = true;
        scene.updateMatrixWorld(true);
        camera.updateMatrixWorld();
        if (eyepieceGlassEnabled) renderLensView();
        renderer.render(scene, camera);
        if (performance.now() < renderUntil) requestRender();
    }
    window.machineState.subscribeHorizontalPosition(() => {
        carriage.position.x = window.machineState.carriageX;
        requestRender();
    });
    window.machineState.subscribeVerticalPosition(() => requestRender(400));
    requestRender();
    document.addEventListener('visibilitychange', () => {
        clock.getDelta();
        if (document.hidden) {
            if (frameRequest !== null) cancelAnimationFrame(frameRequest);
            frameRequest = null;
        } else {
            requestRender(1600);
        }
    });
})();
