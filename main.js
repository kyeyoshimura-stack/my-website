/**
 * main.js — Three.js personal portfolio
 * Scene: animated particle constellation + floating wireframe icosahedra
 * Features: mouse parallax, scroll-based animation, scroll-reveal, navbar scroll
 */

import * as THREE from 'three';

/* ─────────────────────────────────────────────
   1. SCENE SETUP
───────────────────────────────────────────── */
const canvas  = document.getElementById('three-canvas');
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
  const i3 = i * 3;

  // Sphere distribution
  const r     = 3.5 + Math.random() * 3;
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);

  positions[i3]     = r * Math.sin(phi) * Math.cos(theta);
  positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  positions[i3 + 2] = r * Math.cos(phi);

  // Color blend
  const t = Math.random();
  let c;
  if (t < 0.55)      c = color1.clone().lerp(color2, Math.random() * 0.3);
  else if (t < 0.85) c = color2.clone().lerp(color1, Math.random() * 0.5);
  else               c = color3.clone().lerp(color1, Math.random() * 0.5);

  colors[i3]     = c.r;
  colors[i3 + 1] = c.g;
  colors[i3 + 2] = c.b;

  sizes[i] = Math.random() * 2.5 + 0.5;
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
    uTime:      { value: 0 },
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
  color: 0x4cc9f0,
  wireframe: true,
  transparent: true,
  opacity: 0.18,
});
const accentMatDim = new THREE.MeshBasicMaterial({
  color: 0x1a4a5a,
  wireframe: true,
  transparent: true,
  opacity: 0.22,
});

const shapeConfigs = [
  { geo: new THREE.IcosahedronGeometry(0.75, 1), mat: accentMat,    pos: [2.2, 0.4, 0],    speed: 0.35 },
  { geo: new THREE.OctahedronGeometry(0.5, 0),   mat: accentMatDim, pos: [-2.5, -0.8, 0.5], speed: 0.55 },
  { geo: new THREE.TetrahedronGeometry(0.4, 0),  mat: accentMatDim, pos: [1.4, -1.5, -1],   speed: 0.45 },
  { geo: new THREE.IcosahedronGeometry(0.32, 0), mat: accentMat,    pos: [-1.2, 1.4, 1],    speed: 0.6  },
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
   4. SUBTLE GRID PLANE
───────────────────────────────────────────── */
const gridHelper = new THREE.GridHelper(22, 28, 0x4cc9f0, 0x111111);
gridHelper.position.y = -3.5;
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.12;
scene.add(gridHelper);

/* ─────────────────────────────────────────────
   5. AMBIENT GLOW (Point Light)
───────────────────────────────────────────── */
const pointLight = new THREE.PointLight(0x4cc9f0, 4, 12);
pointLight.position.set(2, 1, 3);
scene.add(pointLight);

/* ─────────────────────────────────────────────
   6. MOUSE PARALLAX
───────────────────────────────────────────── */
const mouse = { x: 0, y: 0 };
const target = { x: 0, y: 0 };

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
  mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
});

/* ─────────────────────────────────────────────
   7. SCROLL HANDLING
───────────────────────────────────────────── */
let scrollY    = 0;
let scrollProgress = 0;
const heroEl   = document.getElementById('hero');

window.addEventListener('scroll', () => {
  scrollY = window.scrollY;
  const maxScroll = heroEl ? heroEl.offsetHeight : window.innerHeight;
  scrollProgress = Math.min(scrollY / maxScroll, 1);

  // Navbar
  const navbar = document.getElementById('navbar');
  navbar.classList.toggle('scrolled', scrollY > 60);

  // Scroll reveals
  revealElements();
});

/* ─────────────────────────────────────────────
   8. SCROLL REVEAL
───────────────────────────────────────────── */
const revealEls = document.querySelectorAll('.reveal');

function revealElements() {
  const windowH = window.innerHeight;
  revealEls.forEach((el, i) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < windowH * 0.88) {
      setTimeout(() => el.classList.add('visible'), i * 60);
    }
  });
}

// Run once on load
setTimeout(revealElements, 100);

/* ─────────────────────────────────────────────
   9. ANIMATION LOOP
───────────────────────────────────────────── */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  particleMat.uniforms.uTime.value = elapsed;

  // Smooth mouse follow
  target.x += (mouse.x - target.x) * 0.04;
  target.y += (mouse.y - target.y) * 0.04;

  // Particle field rotation (slow drift)
  particles.rotation.y = elapsed * 0.04 + target.x * 0.18;
  particles.rotation.x = target.y * 0.1 + elapsed * 0.015;

  // Camera parallax from mouse
  camera.position.x = target.x * 0.4;
  camera.position.y = -target.y * 0.25 - scrollProgress * 2;
  camera.rotation.z = target.x * 0.02;
  camera.lookAt(0, -scrollProgress * 0.5, 0);

  // Grid parallax on scroll
  gridHelper.position.y = -3.5 - scrollProgress * 2;

  // Floating shapes
  for (const mesh of meshes) {
    const s = mesh.userData.speed;
    mesh.rotation.x = elapsed * s * 0.4;
    mesh.rotation.y = elapsed * s * 0.6;
    mesh.position.y = mesh.userData.origin.y + Math.sin(elapsed * s * 0.7 + mesh.userData.origin.x) * 0.18;
    mesh.position.x = mesh.userData.origin.x + Math.cos(elapsed * s * 0.4) * 0.08 + target.x * 0.12;
  }

  // Scroll fade out particles
  particles.material.opacity = Math.max(0, 1 - scrollProgress * 1.5);
  gridHelper.material.opacity = 0.12 * Math.max(0, 1 - scrollProgress * 2);

  renderer.render(scene, camera);
}

animate();

/* ─────────────────────────────────────────────
   10. RESIZE HANDLER
───────────────────────────────────────────── */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  particleMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
});

/* ─────────────────────────────────────────────
   11. CARD GLOW — follow cursor inside card
───────────────────────────────────────────── */
document.querySelectorAll('.project-card').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect  = card.getBoundingClientRect();
    const x     = e.clientX - rect.left;
    const y     = e.clientY - rect.top;
    const glow  = card.querySelector('.card-glow');
    glow.style.left = `${x - 100}px`;
    glow.style.top  = `${y - 100}px`;
  });
});

/* ─────────────────────────────────────────────
   12. SMOOTH ANCHOR SCROLLING (fallback)
───────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
