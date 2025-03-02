let rect4 = d3.select("#typewriter").node().getBoundingClientRect();
d3.select("#animation")
    .style("top", rect4.height + "px")
let rect3 = d3.select("#animation").node().getBoundingClientRect();

// Create scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, rect3.width / rect3.height, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(rect3.width, rect3.height);
renderer.setClearColor(0xffffff); // White background
document.getElementById('animation').appendChild(renderer.domElement);

const geometry = new THREE.CylinderGeometry(1, 1, 20, 8);
// Create metallic material
const material = new THREE.MeshPhysicalMaterial({
    color: 0x888888, 
    metalness: 0.1,
    roughness: 1,  
    // clearcoat: 0.2,    
    // clearcoatRoughness: 0,
});
const textMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444, 
    metalness: 0.1,
    roughness: 1,  
    // clearcoat: 0.2,    
    // clearcoatRoughness: 0,
});

const fontLoader = new THREE.FontLoader();

let large = new THREE.Group();
large.position.set(0, 0, 0);
scene.add(large);

for (let i = 0; i < 5; i++) {
    let medium = new THREE.Group();
    let angle = Math.PI * 2 / 5 * i;
    medium.position.set(0, -5 * Math.cos(angle), 5 * Math.sin(angle));
    medium.rotation.x = -angle;
    large.add(medium);

    for (let j = 0; j < 5; j++) {
        let small = new THREE.Group(); // Create a pivot group
        let angle = Math.PI * 2 / 5 * j;
        small.position.set(0, -2 * Math.cos(angle), 2 * Math.sin(angle)); // Move small to desired point
        small.rotation.x = -angle;

        medium.add(small); // Add it to the scene
        let prism = new THREE.Mesh(geometry, material);
        prism.rotation.z = Math.PI / 2; // Align the prism with the screen
        prism.rotation.x = Math.PI / 8; // Adjust angle of the prism
        small.add(prism); // Add the prism to the small group

        fontLoader.load('assets/FangSong_GB2312_Regular.json', function (font) {
            let font_dict = {
                font: font,
                size: 0.5, // Size of the text
                height: 0.1, // Depth of the text (engraving effect)
                curveSegments: 6,
                bevelEnabled: false
            };

            for (let k = 0; k < 8; k++) {
                let textGeometry = new THREE.TextGeometry('' + texts[i * 40 + j * 8 + k], font_dict);
                let textMesh = new THREE.Mesh(textGeometry, textMaterial);
                textMesh.rotation.x = Math.PI / 2; // Align text with the surface
                let angle = Math.PI / 4 * k;
                textMesh.rotation.x -= angle; // Rotate text around the surface
                textMesh.position.set(-9.75, -0.92 * Math.cos(angle) -0.25 * Math.sin(angle), 0.92 * Math.sin(angle) - 0.25 * Math.cos(angle)); // Adjust position on the surface
                small.add(textMesh);
            }
        });
    }
}        

// Position camera
camera.position.set(0, -15, 0);
camera.lookAt(0, 0, 0);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0x3f3f3f, 0.5);
directionalLight.position.set(0, -1.5, 3);
scene.add(directionalLight);

const tableLeft = (rect.width / 2 - rect2.width / 2 - spacing[0] - 0 * (rect2.width / 1 + spacing[0] / 1));
const tableRight = (rect.width / 2 - rect2.width / 2 - spacing[0] - 27 * (rect2.width / 1 + spacing[0] / 1));
let tableLeftNow = tableLeft;
let tableTopNow = 0;
let theta = 0;

const spotLeft = -9.5;
const spotRight = 9.5;
let spotNow = spotLeft;

const spotLight = new THREE.SpotLight(0xffffff, 1, 0, 0.2);
spotLight.position.set(spotLeft, -10, 0);
spotLight.target.position.set(spotLeft, 0, 0);
spotLight.target.updateMatrixWorld();

// spotLight.map = new THREE.TextureLoader().load( url );

spotLight.castShadow = true;

spotLight.shadow.mapSize.width = 1024;
spotLight.shadow.mapSize.height = 1024;

spotLight.shadow.camera.near = 500;
spotLight.shadow.camera.far = 4000;
spotLight.shadow.camera.fov = 30;

scene.add( spotLight );

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    tableLeftNow = d3.select("#table").style("left").replaceAll("px", "");
    spotNow = spotLeft + (spotRight - spotLeft) / (tableRight - tableLeft) * (tableLeftNow - tableLeft);
    spotLight.position.set(spotNow, -10, 0);
    spotLight.target.position.set(spotNow, 0, 0);
    spotLight.target.updateMatrixWorld();

    tableTopNow = d3.select("#table").style("top").replaceAll("px", "");
    theta = (tableTopNow - tableFrom) / (tableTo - tableFrom);
    phi = d3.select("#text").style("padding-top").replaceAll("px", "") / 10;
    console.log(phi);

    large.rotation.x = (largeTo - largeFrom) * theta + largeFrom;
    for (let i = 0; i < 5; i++) {
        large.children[i].rotation.x = -Math.PI * 2 / 5 * i + (mediumTo - mediumFrom) * theta + mediumFrom;
        for (let j = 0; j < 5; j++) {
            large.children[i].children[j].rotation.x = -Math.PI * 2 / 5 * j + Math.PI * 2 / 8 * ind * phi;
        }
    }

    renderer.render(scene, camera);
}

animate();