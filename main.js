/**
 * main.js — Three.js personal portfolio
 * Fixes: removed GridHelper (was causing blue flash due to multi-material array)
 *        replaced with custom ShaderMaterial dot-grid plane
 * New:   full drag-to-move on the main icosahedron (mouse + touch)
 */

import * as THREE from 'three';

/* ─────────────────────────────────────────────
   1. SCENE SETUP
───────────────────────────────────────────── */
const canvas   = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6);

/* ─────────────────────────────────────────────
   2. PARTICLES
───────────────────────────────────────────── */
const PARTICLE_COUNT = 2200;

const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors    = new Float32Array(PARTICLE_COUNT * 3);
const sizes     = new Float32Array(PARTICLE_COUNT);

const color1 = new THREE.Color('#4cc9f0');
const color2 = new THREE.Color('#ffffff');
const color3 = new THREE.Color('#1a4a5a');

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const i3    = i * 3;
  const r     = 3.5 + Math.random() * 3;
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);

  positions[i3]     = r * Math.sin(phi) * Math.cos(theta);
  positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  positions[i3 + 2] = r * Math.cos(phi);

  const t = Math.random();
  let c;
  if (t < 0.55)      c = color1.clone().lerp(color2, Math.random() * 0.3);
  else if (t < 0.85) c = color2.clone().lerp(color1, Math.random() * 0.5);
  else               c = color3.clone().lerp(color1, Math.random() * 0.5);

  colors[i3]     = c.r;
  colors[i3 + 1] = c.g;
  colors[i3 + 2] = c.b;
  sizes[i]       = Math.random() * 2.5 + 0.5;
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particleGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
particleGeo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

const particleMat = new THREE.ShaderMaterial({
  vertexColors: true,
  transparent:  true,
  depthWrite:   false,
  blending:     THREE.AdditiveBlending,
  uniforms: {
    uTime:       { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
  },
  vertexShader: /* glsl */`
    attribute float size;
    attribute vec3 color;
    varying vec3 vColor;
    uniform float uTime;
    uniform float uPixelRatio;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * uPixelRatio * (280.0 / -mvPosition.z);
      gl_Position  = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */`
    varying vec3 vColor;
    void main() {
      float dist = length(gl_PointCoord - 0.5);
      if (dist > 0.5) discard;
      float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
      gl_FragColor = vec4(vColor, alpha * 0.85);
    }
  `,
});

const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

/* ─────────────────────────────────────────────
   3. FLOATING WIREFRAME SHAPES
───────────────────────────────────────────── */
const meshes = [];

const accentMat = new THREE.MeshBasicMaterial({
  color: 0x4cc9f0, wireframe: true, transparent: true, opacity: 0.18,
});
const accentMatDim = new THREE.MeshBasicMaterial({
  color: 0x1a4a5a, wireframe: true, transparent: true, opacity: 0.22,
});

const shapeConfigs = [
  { geo: new THREE.IcosahedronGeometry(0.75, 1), mat: accentMat,    pos: [2.2, 0.4, 0],     speed: 0.35 },
  { geo: new THREE.OctahedronGeometry(0.5, 0),   mat: accentMatDim, pos: [-2.5, -0.8, 0.5],  speed: 0.55 },
  { geo: new THREE.TetrahedronGeometry(0.4, 0),  mat: accentMatDim, pos: [1.4, -1.5, -1],    speed: 0.45 },
  { geo: new THREE.IcosahedronGeometry(0.32, 0), mat: accentMat,    pos: [-1.2, 1.4, 1],     speed: 0.6  },
];

for (const cfg of shapeConfigs) {
  const mesh = new THREE.Mesh(cfg.geo, cfg.mat);
  mesh.position.set(...cfg.pos);
  mesh.userData.speed  = cfg.speed;
  mesh.userData.origin = new THREE.Vector3(...cfg.pos);
  scene.add(mesh);
  meshes.push(mesh);
}

/* ─────────────────────────────────────────────
   4. DOT-GRID PLANE  (replaces GridHelper)
   GridHelper internally uses a material array
   which caused the blue flashing box. This custom
   ShaderMaterial gives full opacity control.
───────────────────────────────────────────── */
const gridGeo = new THREE.PlaneGeometry(24, 24, 1, 1);
const gridMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite:  false,
  side: THREE.DoubleSide,
  uniforms: { uOpacity: { value: 0.0 } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uOpacity;
    void main() {
      // 22×22 grid of soft dots
      vec2 grid = fract(vUv * 22.0);
      float d = length(grid - 0.5);
      float alpha = 1.0 - smoothstep(0.04, 0.12, d);
      gl_FragColor = vec4(0.298, 0.788, 0.941, alpha * uOpacity);
    }
  `,
});

const gridPlane = new THREE.Mesh(gridGeo, gridMat);
gridPlane.rotation.x = -Math.PI / 2;
gridPlane.position.y = -3.5;
scene.add(gridPlane);

// Fade grid in after 300 ms — prevents any first-frame flash
setTimeout(() => {
  let t = 0;
  const fadeIn = setInterval(() => {
    t = Math.min(t + 0.015, 0.18);
    gridMat.uniforms.uOpacity.value = t;
    if (t >= 0.18) clearInterval(fadeIn);
  }, 16);
}, 300);

/* ─────────────────────────────────────────────
   5. POINT LIGHT
───────────────────────────────────────────── */
const pointLight = new THREE.PointLight(0x4cc9f0, 4, 12);
pointLight.position.set(2, 1, 3);
scene.add(pointLight);

/* ─────────────────────────────────────────────
   6. MOUSE PARALLAX + DRAG INTERACTION
   meshes[0] is the main icosahedron — it can be
   grabbed and dragged anywhere in the hero view.
───────────────────────────────────────────── */
const mouse  = { x: 0, y: 0 };
const smooth = { x: 0, y: 0 };     // eased mouse for parallax

// Raycasting helpers
const raycaster    = new THREE.Raycaster();
const dragPlane    = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // world z=0
const dragOffset   = new THREE.Vector3();
const intersection = new THREE.Vector3();

const dragMesh = meshes[0];  // the large icosahedron

let isDragging     = false;
let isHoveringDrag = false;

/** Convert clientX/Y → normalised device coords */
function toNDC(clientX, clientY) {
  return new THREE.Vector2(
    (clientX / window.innerWidth)  *  2 - 1,
    (clientY / window.innerHeight) * -2 + 1,
  );
}

/** Returns true if NDC coords hit the drag mesh */
function hitsDragMesh(ndc) {
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(dragMesh).length > 0;
}

/* ── Down ── */
function onDown(clientX, clientY) {
  const ndc = toNDC(clientX, clientY);
  if (!hitsDragMesh(ndc)) return;

  isDragging = true;
  canvas.style.cursor = 'grabbing';

  // Flag mesh as user-controlled
  dragMesh.userData.dragged = true;

  // Record pointer offset from mesh centre on the drag plane
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(dragPlane, intersection);
  dragOffset.copy(intersection).sub(dragMesh.position);
}

/* ── Move ── */
function onMove(clientX, clientY) {
  const ndc = toNDC(clientX, clientY);

  // Always update parallax tracking
  mouse.x =  (clientX / window.innerWidth  - 0.5) * 2;
  mouse.y = -(clientY / window.innerHeight - 0.5) * 2;

  if (isDragging) {
    // Move mesh along the drag plane to follow pointer
    raycaster.setFromCamera(ndc, camera);
    raycaster.ray.intersectPlane(dragPlane, intersection);
    dragMesh.position.copy(intersection.sub(dragOffset));
    // Update origin so floating animation is relative to new position
    dragMesh.userData.origin.copy(dragMesh.position);
    return;
  }

  // Hover cursor
  isHoveringDrag = hitsDragMesh(ndc);
  canvas.style.cursor = isHoveringDrag ? 'grab' : 'default';
}

/* ── Up ── */
function onUp() {
  if (!isDragging) return;
  isDragging = false;
  dragMesh.userData.dragged = false;
  canvas.style.cursor = isHoveringDrag ? 'grab' : 'default';
}

// Mouse
window.addEventListener('mousedown',  (e) => onDown(e.clientX, e.clientY));
window.addEventListener('mousemove',  (e) => onMove(e.clientX, e.clientY));
window.addEventListener('mouseup',    ()  => onUp());

// Touch (mobile)
canvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  onDown(t.clientX, t.clientY);
  if (isDragging) e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  onMove(t.clientX, t.clientY);
  if (isDragging) e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', () => onUp());

/* ─────────────────────────────────────────────
   7. SCROLL HANDLING
───────────────────────────────────────────── */
let scrollProgress = 0;
const heroEl = document.getElementById('hero');

window.addEventListener('scroll', () => {
  const scrollY   = window.scrollY;
  const maxScroll = heroEl ? heroEl.offsetHeight : window.innerHeight;
  scrollProgress  = Math.min(scrollY / maxScroll, 1);

  document.getElementById('navbar').classList.toggle('scrolled', scrollY > 60);
  revealElements();
});

/* ─────────────────────────────────────────────
   8. SCROLL REVEAL
───────────────────────────────────────────── */
const revealEls = document.querySelectorAll('.reveal');

function revealElements() {
  const winH = window.innerHeight;
  revealEls.forEach((el, i) => {
    if (el.getBoundingClientRect().top < winH * 0.88) {
      setTimeout(() => el.classList.add('visible'), i * 60);
    }
  });
}

setTimeout(revealElements, 100);

/* ─────────────────────────────────────────────
   9. ANIMATION LOOP
───────────────────────────────────────────── */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  particleMat.uniforms.uTime.value = elapsed;

  // Ease parallax tracking
  smooth.x += (mouse.x - smooth.x) * 0.04;
  smooth.y += (mouse.y - smooth.y) * 0.04;

  // Particle field gentle drift
  particles.rotation.y = elapsed * 0.04 + smooth.x * 0.18;
  particles.rotation.x = smooth.y * 0.1  + elapsed * 0.015;

  // Camera parallax
  camera.position.x = smooth.x * 0.4;
  camera.position.y = smooth.y * 0.25 - scrollProgress * 2;
  camera.rotation.z = smooth.x * 0.02;
  camera.lookAt(0, -scrollProgress * 0.5, 0);

  // Dot grid scroll parallax + scroll fade
  gridPlane.position.y = -3.5 - scrollProgress * 2;
  gridMat.uniforms.uOpacity.value *= 1; // driven by fade-in interval; just keep

  // Floating shapes
  for (const mesh of meshes) {
    const s = mesh.userData.speed;
    mesh.rotation.x = elapsed * s * 0.4;
    mesh.rotation.y = elapsed * s * 0.6;

    // If being dragged, skip position animation for this mesh
    if (!mesh.userData.dragged) {
      mesh.position.y = mesh.userData.origin.y
        + Math.sin(elapsed * s * 0.7 + mesh.userData.origin.x) * 0.18;
      mesh.position.x = mesh.userData.origin.x
        + Math.cos(elapsed * s * 0.4) * 0.08
        + smooth.x * 0.12;
    }
  }

  // Scroll fade for particles
  particles.material.opacity = Math.max(0, 1 - scrollProgress * 1.5);

  // Fade grid with scroll
  const baseOpacity = 0.18;
  gridMat.uniforms.uOpacity.value = Math.min(
    gridMat.uniforms.uOpacity.value,
    baseOpacity * Math.max(0, 1 - scrollProgress * 2),
  );

  renderer.render(scene, camera);
}

animate();

/* ─────────────────────────────────────────────
   10. RESIZE
───────────────────────────────────────────── */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  particleMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
});

/* ─────────────────────────────────────────────
   11. CARD GLOW — cursor tracking inside cards
───────────────────────────────────────────── */
document.querySelectorAll('.project-card').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const glow = card.querySelector('.card-glow');
    glow.style.left = `${e.clientX - rect.left - 100}px`;
    glow.style.top  = `${e.clientY - rect.top  - 100}px`;
  });
});

/* ─────────────────────────────────────────────
   12. SMOOTH ANCHOR SCROLLING
───────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const dest = document.querySelector(anchor.getAttribute('href'));
    if (dest) {
      e.preventDefault();
      dest.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
