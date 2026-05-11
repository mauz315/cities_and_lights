import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Perlin noise algorithm for natural-looking terrain
const perlin = {
    rand_vect: function(){
        let theta = Math.random() * 2 * Math.PI;
        return {x: Math.cos(theta), y: Math.sin(theta)};
    },
    dot_prod_grid: function(x, y, vx, vy){
        let g_vect;
        let d_vect = {x: x - vx, y: y - vy};
        if (this.gradients[[vx,vy]]){
            g_vect = this.gradients[[vx,vy]];
        } else {
            g_vect = this.rand_vect();
            this.gradients[[vx,vy]] = g_vect;
        }
        return d_vect.x * g_vect.x + d_vect.y * g_vect.y;
    },
    smootherstep: function(x){
        return 6*x**5 - 15*x**4 + 10*x**3;
    },
    interp: function(x, a, b){
        return a + this.smootherstep(x) * (b-a);
    },
    seed: function(){
        this.gradients = {};
        this.memory = {};
    },
    get: function(x, y) {
        if (this.memory.hasOwnProperty([x,y]))
            return this.memory[[x,y]];
        let xf = Math.floor(x);
        let yf = Math.floor(y);
        //interpolate
        let tl = this.dot_prod_grid(x, y, xf,   yf);
        let tr = this.dot_prod_grid(x, y, xf+1, yf);
        let bl = this.dot_prod_grid(x, y, xf,   yf+1);
        let br = this.dot_prod_grid(x, y, xf+1, yf+1);
        let xt = this.interp(x-xf, tl, tr);
        let xb = this.interp(x-xf, bl, br);
        let v = this.interp(y-yf, xt, xb);
        this.memory[[x,y]] = v;
        return v;
    }
}
perlin.seed();

class Visualizer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.mountains = [];
    }

    init() {
        // Step 1: Environment Setup
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x101018); // Dark, segmented "Night Sky"
        this.container.appendChild(this.renderer.domElement);
        this.camera.position.z = 50;
        this.camera.position.y = 20;

        const ambientLight = new THREE.AmbientLight(0x404040, 2);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 30, 20);
        this.scene.add(directionalLight);

        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.animate();
    }

    async loadData() {
        // Step 2: Fetch and Parse Data
        try {
            const response = await fetch('/assets/data/mountains_data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.createMountains(data);
        } catch (error) {
            console.error("Could not load mountain data:", error);
        }
    }

    createMountains(data) {
        const textureLoader = new THREE.TextureLoader();
        // Placeholder textures - replace with your actual texture paths
        const industrialTexture = textureLoader.load('/assets/textures/industrial.jpg');
        const naturalTexture = textureLoader.load('/assets/textures/natural.jpg');

        data.forEach((cityData, index) => {
            // Step 3: Geometry Initialization
            const geometry = new THREE.PlaneGeometry(
                cityData.baseWidth * 50 + 10, // baseWidth
                cityData.baseWidth * 50 + 10, // baseWidth
                100, // Width segments
                100  // Height segments
            );

            const positionAttribute = geometry.attributes.position;
            const vertex = new THREE.Vector3();

            // Step 4: Procedural Displacement (The "Sculpting")
            for (let i = 0; i < positionAttribute.count; i++) {
                vertex.fromBufferAttribute(positionAttribute, i);

                const dist = Math.sqrt(vertex.x**2 + vertex.y**2);
                const normalizedDist = dist / ((cityData.baseWidth * 50 + 10) / 2);

                // Height: Apply peakHeight with a falloff from the center
                let height = cityData.peakHeight * 30 * (1 - normalizedDist);

                // Jaggedness: Apply Perlin noise based on roughness
                const noise = perlin.get(vertex.x * 0.1 * (1 + cityData.roughness), vertex.y * 0.1 * (1 + cityData.roughness));
                height += noise * 5 * cityData.roughness;

                // Peak Sharpening: Pull vertices near the center higher
                if (normalizedDist < 0.5) {
                    height *= 1 + (0.5 - normalizedDist) * cityData.peakSharpness;
                }

                // Apply the calculated height to the vertex's z-coordinate
                positionAttribute.setZ(i, height);
            }
            geometry.computeVertexNormals(); // Recalculate normals for correct lighting

            // Step 5: Texture and Material Mapping
            const material = new THREE.MeshStandardMaterial({
                map: cityData.textureID === 'industrial' ? industrialTexture : naturalTexture,
                roughness: 0.7,
                metalness: 0.2
            });

            const mountain = new THREE.Mesh(geometry, material);
            mountain.rotation.x = -Math.PI / 2; // Rotate plane to be horizontal

            // Step 6: Instantiation and Positioning
            mountain.position.x = (index - (data.length - 1) / 2) * 60;
            mountain.userData = cityData; // Store data for interaction

            this.scene.add(mountain);
            this.mountains.push(mountain);
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        // Step 7: The Render Loop
        requestAnimationFrame(this.animate.bind(this));

        this.mountains.forEach(mountain => {
            // Animation: Pulsing glow based on the 'glow' variable
            if (mountain.userData.glow > 0.5) {
                const glowIntensity = (Math.sin(Date.now() * 0.002) + 1) / 2;
                // This is a simplified glow. For a real glow effect, you'd use post-processing.
                mountain.material.emissive.set(0xffff00);
                mountain.material.emissiveIntensity = glowIntensity * mountain.userData.glow;
            }
        });

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

export default Visualizer;
