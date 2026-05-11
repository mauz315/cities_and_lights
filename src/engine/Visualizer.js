import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Perlin noise algorithm for natural-looking terrain
const perlin = {
    rand_vect: function(){ let theta = Math.random() * 2 * Math.PI; return {x: Math.cos(theta), y: Math.sin(theta)}; },
    dot_prod_grid: function(x, y, vx, vy){
        let g_vect;
        let d_vect = {x: x - vx, y: y - vy};
        if (this.gradients[[vx,vy]]){ g_vect = this.gradients[[vx,vy]]; } else { g_vect = this.rand_vect(); this.gradients[[vx,vy]] = g_vect; }
        return d_vect.x * g_vect.x + d_vect.y * g_vect.y;
    },
    smootherstep: function(x){ return 6*x**5 - 15*x**4 + 10*x**3; },
    interp: function(x, a, b){ return a + this.smootherstep(x) * (b-a); },
    seed: function(){ this.gradients = {}; this.memory = {}; },
    get: function(x, y) {
        if (this.memory.hasOwnProperty([x,y])) return this.memory[[x,y]];
        let xf = Math.floor(x); let yf = Math.floor(y);
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
};
perlin.seed();

class Visualizer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.mountains = [];
        this.data = [];
        
        // Ensure baseUrl always ends with a slash and is robust
        this.baseUrl = import.meta.env.BASE_URL;
        if (!this.baseUrl.endsWith('/')) {
            this.baseUrl += '/';
        }
        
        console.log("Visualizer initialized. Base URL is:", this.baseUrl);

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        this.container.appendChild(this.renderer.domElement);
        this.camera.position.set(0, 30, 80);
        this.controls.enableDamping = true;

        const ambientLight = new THREE.AmbientLight(0xcccccc, 1.5);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(20, 50, 30);
        this.scene.add(directionalLight);

        this.setupControls();
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.animate();
    }

    setupControls() {
        document.getElementById('pan-button')?.addEventListener('click', () => this.setControlMode('pan'));
        document.getElementById('zoom-button')?.addEventListener('click', () => this.setControlMode('zoom'));
        document.getElementById('rotate-button')?.addEventListener('click', () => this.setControlMode('rotate'));
    }

    setControlMode(mode) {
        this.controls.enablePan = mode === 'pan';
        this.controls.enableZoom = mode === 'zoom';
        this.controls.enableRotate = mode === 'rotate';
    }

    async loadData() {
        const jsonUrl = `${this.baseUrl}assets/data/mountains_data.json`;
        console.log("Attempting to fetch data from:", jsonUrl);
        
        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                console.error("Fetch failed with status:", response.status, response.statusText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.data = await response.json();
            console.log("Data loaded successfully. City count:", this.data.length);
            
            this.createMountains(this.data);
            this.populateCitySelector(this.data);
        } catch (error) {
            console.error("CRITICAL ERROR: Could not load mountain data:", error);
            // Optional: Display a visual error to the user on screen here
            this.showErrorOnScreen("Failed to load map data. Please check console.");
        }
    }
    
    showErrorOnScreen(message) {
        const errDiv = document.createElement('div');
        errDiv.style.position = 'absolute';
        errDiv.style.top = '50%';
        errDiv.style.left = '50%';
        errDiv.style.transform = 'translate(-50%, -50%)';
        errDiv.style.color = 'red';
        errDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
        errDiv.style.padding = '20px';
        errDiv.style.zIndex = '9999';
        errDiv.innerText = message;
        document.body.appendChild(errDiv);
    }

    createMountains(data) {
        const textureLoader = new THREE.TextureLoader();
        
        const industrialUrl = `${this.baseUrl}assets/textures/industrial.jpg`;
        const naturalUrl = `${this.baseUrl}assets/textures/natural.jpg`;
        
        console.log("Loading textures from:", industrialUrl, "and", naturalUrl);

        // Add error callbacks to the texture loader to see if they fail
        const industrialTexture = textureLoader.load(
            industrialUrl, 
            undefined, // onLoad callback
            undefined, // onProgress callback
            (err) => console.error("Error loading industrial texture:", err) // onError callback
        );
        
        const naturalTexture = textureLoader.load(
            naturalUrl,
            undefined,
            undefined,
            (err) => console.error("Error loading natural texture:", err)
        );

        data.forEach((cityData, index) => {
            const geometry = new THREE.PlaneGeometry(cityData.baseWidth * 40 + 15, cityData.baseWidth * 40 + 15, 100, 100);
            const positionAttribute = geometry.attributes.position;
            const vertex = new THREE.Vector3();

            for (let i = 0; i < positionAttribute.count; i++) {
                vertex.fromBufferAttribute(positionAttribute, i);
                const dist = Math.sqrt(vertex.x**2 + vertex.y**2);
                const normalizedDist = dist / ((cityData.baseWidth * 40 + 15) / 2);
                let height = cityData.peakHeight * 25 * (1 - normalizedDist);
                const noise = perlin.get(vertex.x * 0.1 * (1 + cityData.roughness), vertex.y * 0.1 * (1 + cityData.roughness));
                height += noise * 5 * cityData.roughness;
                if (normalizedDist < 0.5) {
                    height *= 1 + (0.5 - normalizedDist) * cityData.peakSharpness;
                }
                positionAttribute.setZ(i, height);
            }
            geometry.computeVertexNormals();

            const material = new THREE.MeshStandardMaterial({
                map: cityData.textureID === 'industrial' ? industrialTexture : naturalTexture,
                roughness: 0.7,
                metalness: 0.2
            });

            const mountain = new THREE.Mesh(geometry, material);
            mountain.rotation.x = -Math.PI / 2;
            mountain.position.x = (index - (data.length - 1) / 2) * 60;
            mountain.userData = cityData;
            
            this.scene.add(mountain);
            this.mountains.push(mountain);
        });
        
        console.log("Successfully created", this.mountains.length, "mountains in the scene.");
    }

    populateCitySelector(data) {
        const container = document.getElementById('city-buttons');
        if (!container) return;
        container.innerHTML = ''; // Clear existing buttons
        data.forEach((cityData, index) => {
            const button = document.createElement('button');
            button.className = 'w-full flex justify-between items-center px-4 py-2.5 hover:bg-white/5 transition-colors group';
            button.innerHTML = `<span class="font-body-md text-on-surface-variant group-hover:text-on-surface transition-colors">${cityData.city}</span>`;
            button.onclick = () => this.focusOnMountain(index);
            container.appendChild(button);
        });
    }

    focusOnMountain(index) {
        if (this.mountains[index]) {
            const targetPosition = this.mountains[index].position;
            // Simple focus - for a smoother transition, you would use a tweening library like GSAP
            this.camera.position.x = targetPosition.x;
            this.camera.position.z = targetPosition.z + 60;
            this.controls.target.copy(targetPosition);

            this.updateMountainDetailsPanel(this.data[index]);
        }
    }

    updateMountainDetailsPanel(cityData) {
        const detailsPanel = document.getElementById('mountain-details');
        if (!detailsPanel) return;

        detailsPanel.innerHTML = ''; // Clear previous details
        detailsPanel.classList.remove('hidden');

        const title = document.createElement('h3');
        title.className = 'font-bold text-lg mb-2 text-on-surface';
        title.textContent = cityData.city;
        detailsPanel.appendChild(title);

        const list = document.createElement('ul');
        list.className = 'space-y-1 text-sm';
        detailsPanel.appendChild(list);

        for (const [key, value] of Object.entries(cityData)) {
            if (key === 'city') continue; // Skip the city name itself
            const listItem = document.createElement('li');
            listItem.className = 'flex justify-between gap-4 border-b border-white/10 pb-1';
            const valueFormatted = typeof value === 'number' ? value.toFixed(2) : value;
            listItem.innerHTML = `<span class="text-on-surface-variant capitalize">${key.replace(/([A-Z])/g, ' $1').trim()}:</span> <span class="font-bold text-surface-tint">${valueFormatted}</span>`;
            list.appendChild(listItem);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

export default Visualizer;
