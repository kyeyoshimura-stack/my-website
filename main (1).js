/**
 * main.js — Three.js personal portfolio
 * Fix 1: Blue flashing box — removed GridHelper (multi-material array bug).
 *         Each wireframe shape now gets its OWN material instance.
 *         Grid opacity is lerped in the animate loop (not fought by setInterval).
 * Fix 2: Drag — wireframe has near-zero raycaster hit area.
 *         Added invisible SphereGeometry hit-target as child of the icosahedron.
 */

import * as THREE from 'three';

/* ─── 1. RENDERER ─── */
const canvas   = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6);

/* ─── 2. PARTICLES ─── */
const COUNT = 2200;
const pPos  = new Float32Array(COUNT * 3);
const pCol  = new Float32Array(COUNT * 3);
const pSz   = new Float32Array(COUNT);

const c1 = new THREE.Color('#4cc9f0');
const c2 = new THREE.Color('#ffffff');
const c3 = new THREE.Color('#1a4a5a');

for (let i = 0; i < COUNT; i++) {
  const i3    = i * 3;
  const r     = 3.5 + Math.random() * 3;
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  pPos[i3]     = r * Math.sin(phi) * Math.cos(theta);
  pPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  pPos[i3 + 2] = r * Math.cos(phi);
  const t = Math.random();
  const c = t < 0.55 ? c1.clone().lerp(c2, Math.random() * 0.3)
          : t < 0.85 ? c2.clone().lerp(c1, Math.random() * 0.5)
          :             c3.clone().lerp(c1, Math.random() * 0.5);
  pCol[i3] = c.r; pCol[i3+1] = c.g; pCol[i3+2] = c.b;
  pSz[i]   = Math.random() * 2.5 + 0.5;
}

const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('size',     new THREE.BufferAttribute(pSz,  1));

const pMat = new THREE.ShaderMaterial({
  vertexColors: true,
  transparent:  true,
  depthWrite:   false,
  blending:     THREE.AdditiveBlending,
  uniforms: {
    uTime:       { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uOpacity:    { value: 1.0 },
  },
  vertexShader: `
    attribute float size;
    varying vec3 vColor;
    uniform float uPixelRatio;
    void main() {
      vColor = color;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * uPixelRatio * (280.0 / -mv.z);
      gl_Position  = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    uniform float uOpacity;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = 1.0 - smoothstep(0.2, 0.5, d);
      gl_FragColor = vec4(vColor, a * 0.85 * uOpacity);
    }
  `,
});

const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

/* ─── 3. WIREFRAME SHAPES
   Each gets its OWN material instance — shared materials
   can cause one mesh's state to bleed into another. ─── */
const meshes = [];

function wireMat(hex, opacity) {
  return new THREE.MeshBasicMaterial({ color: hex, wireframe: true, transparent: true, opacity });
}

const shapeDefs = [
  { geo: new THREE.IcosahedronGeometry(0.75, 1), hex: 0x4cc9f0, op: 0.22, pos: [ 2.2,  0.4,  0  ], speed: 0.35 },
  { geo: new THREE.OctahedronGeometry(0.5,   0), hex: 0x2a7a8a, op: 0.18, pos: [-2.5, -0.8,  0.5], speed: 0.55 },
  { geo: new THREE.TetrahedronGeometry(0.4,  0), hex: 0x2a7a8a, op: 0.16, pos: [ 1.4, -1.5, -1  ], speed: 0.45 },
  { geo: new THREE.IcosahedronGeometry(0.32, 0), hex: 0x4cc9f0, op: 0.20, pos: [-1.2,  1.4,  1  ], speed: 0.60 },
];

for (const d of shapeDefs) {
  const mesh = new THREE.Mesh(d.geo, wireMat(d.hex, d.op));
  mesh.position.set(...d.pos);
  mesh.userData.speed   = d.speed;
  mesh.userData.origin  = new THREE.Vector3(...d.pos);
  mesh.userData.dragged = false;
  scene.add(mesh);
  meshes.push(mesh);
}

/* ─── 4. INVISIBLE HIT SPHERE for drag picking
   Wireframe triangles have no fill → raycaster almost never
   intersects them. A solid transparent sphere child gives a
   reliable, large click target that tracks with the mesh. ─── */
const hitSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.9, 8, 8),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
);
meshes[0].add(hitSphere);   // child of main icosahedron — moves with it automatically

/* ─── 5. DOT-GRID PLANE (no GridHelper)
   GridHelper creates [material1, material2] internally.
   Setting .material.opacity only patches one of them → strobe.
   A single ShaderMaterial on a PlaneGeometry has no such issue. ─── */
const gridMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite:  false,
  side: THREE.DoubleSide,
  uniforms: { uOp: { value: 0.0 } },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uOp;
    void main() {
      vec2 g  = fract(vUv * 22.0);
      float d = length(g - 0.5);
      float a = 1.0 - smoothstep(0.04, 0.12, d);
      gl_FragColor = vec4(0.298, 0.788, 0.941, a * uOp);
    }
  `,
});
const gridPlane = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), gridMat);
gridPlane.rotation.x = -Math.PI / 2;
gridPlane.position.y = -3.5;
scene.add(gridPlane);

/* Grid opacity is smoothly lerped in the animate loop (no setInterval fighting). */
let gridReady = false;
setTimeout(() => { gridReady = true; }, 500);

/* ─── 6. DRAG STATE ─── */
const raycaster    = new THREE.Raycaster();
const dragPlane    = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const dragOffset   = new THREE.Vector3();
const intersection = new THREE.Vector3();
const dragMesh     = meshes[0];

let isDragging = false;

function toNDC(cx, cy) {
  return new THREE.Vector2(
    (cx / window.innerWidth ) *  2 - 1,
    (cy / window.innerHeight) * -2 + 1,
  );
}

function hitsTarget(ndc) {
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(hitSphere, false).length > 0;
}

function onDown(cx, cy) {
  const ndc = toNDC(cx, cy);
  if (!hitsTarget(ndc)) return;
  isDragging = true;
  canvas.style.cursor = 'grabbing';
  dragMesh.userData.dragged = true;
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
    dragOffset.copy(intersection).sub(dragMesh.position);
  }
}

function onMove(cx, cy) {
  mouse.x =  (cx / window.innerWidth  - 0.5) * 2;
  mouse.y = -(cy / window.innerHeight - 0.5) * 2;
  const ndc = toNDC(cx, cy);
  if (!isDragging) {
    canvas.style.cursor = hitsTarget(ndc) ? 'grab' : 'default';
    return;
  }
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
    const np = intersection.clone().sub(dragOffset);
    dragMesh.position.set(np.x, np.y, dragMesh.position.z);
    dragMesh.userData.origin.copy(dragMesh.position);
  }
}

function onUp() {
  if (!isDragging) return;
  isDragging = false;
  dragMesh.userData.dragged = false;
  canvas.style.cursor = 'default';
}

window.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
window.addEventListener('mouseup',   ()  => onUp());

canvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0]; onDown(t.clientX, t.clientY);
  if (isDragging) e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  const t = e.touches[0]; onMove(t.clientX, t.clientY);
  if (isDragging) e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', () => onUp());

/* ─── 7. MOUSE + SCROLL STATE ─── */
const mouse  = { x: 0, y: 0 };
const smooth = { x: 0, y: 0 };
let scrollProgress = 0;
const heroEl = document.getElementById('hero');

window.addEventListener('scroll', () => {
  const sy = window.scrollY;
  scrollProgress = Math.min(sy / (heroEl ? heroEl.offsetHeight : window.innerHeight), 1);
  document.getElementById('navbar').classList.toggle('scrolled', sy > 60);
  revealElements();
});

/* ─── 8. SCROLL REVEAL ─── */
const revealEls = document.querySelectorAll('.reveal');
function revealElements() {
  const wh = window.innerHeight;
  revealEls.forEach((el, i) => {
    if (el.getBoundingClientRect().top < wh * 0.88)
      setTimeout(() => el.classList.add('visible'), i * 60);
  });
}
setTimeout(revealElements, 100);

/* ─── 9. ANIMATE ─── */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  smooth.x += (mouse.x - smooth.x) * 0.04;
  smooth.y += (mouse.y - smooth.y) * 0.04;

  /* particles */
  pMat.uniforms.uTime.value    = t;
  pMat.uniforms.uOpacity.value = Math.max(0, 1 - scrollProgress * 1.5);
  particles.rotation.y = t * 0.04 + smooth.x * 0.18;
  particles.rotation.x = smooth.y * 0.1 + t * 0.015;

  /* camera */
  camera.position.x = smooth.x * 0.4;
  camera.position.y = smooth.y * 0.25 - scrollProgress * 2;
  camera.rotation.z = smooth.x * 0.02;
  camera.lookAt(0, -scrollProgress * 0.5, 0);

  /* grid — lerp toward target, no setInterval fighting */
  const gridTarget = gridReady ? 0.18 * Math.max(0, 1 - scrollProgress * 2) : 0;
  gridMat.uniforms.uOp.value += (gridTarget - gridMat.uniforms.uOp.value) * 0.04;
  gridPlane.position.y = -3.5 - scrollProgress * 2;

  /* shapes */
  for (const mesh of meshes) {
    const s = mesh.userData.speed;
    mesh.rotation.x = t * s * 0.4;
    mesh.rotation.y = t * s * 0.6;
    if (!mesh.userData.dragged) {
      mesh.position.y = mesh.userData.origin.y + Math.sin(t * s * 0.7 + mesh.userData.origin.x) * 0.18;
      mesh.position.x = mesh.userData.origin.x + Math.cos(t * s * 0.4) * 0.08 + smooth.x * 0.12;
    }
  }

  renderer.render(scene, camera);
}
animate();

/* ─── 10. RESIZE ─── */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  pMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
});

/* ─── 11. CARD GLOW ─── */
document.querySelectorAll('.project-card').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    const g = card.querySelector('.card-glow');
    g.style.left = `${e.clientX - r.left  - 100}px`;
    g.style.top  = `${e.clientY - r.top   - 100}px`;
  });
});

/* ─── 12. SMOOTH ANCHOR SCROLL ─── */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const dest = document.querySelector(a.getAttribute('href'));
    if (dest) { e.preventDefault(); dest.scrollIntoView({ behavior: 'smooth' }); }
  });
});
