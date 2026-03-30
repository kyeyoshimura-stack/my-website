/**
 * main.js
 * Three.js loaded as UMD global (window.THREE) — no import/module system.
 * Fixes: no importmap, no shared materials, invisible hit-sphere for drag,
 *        dot-grid plane instead of GridHelper, lerped opacity in animate loop.
 */

(function () {
  'use strict';

  /* ── Guard: make sure THREE loaded ── */
  if (!window.THREE) {
    console.error('Three.js not loaded');
    return;
  }
  const THREE = window.THREE;

  /* ════════════════════════════════════
     1. RENDERER + SCENE + CAMERA
  ════════════════════════════════════ */
  const canvas = document.getElementById('three-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 6);

  /* ════════════════════════════════════
     2. PARTICLES
  ════════════════════════════════════ */
  var COUNT = 1800;
  var pPos = new Float32Array(COUNT * 3);
  var pCol = new Float32Array(COUNT * 3);
  var pSz  = new Float32Array(COUNT);

  var c1 = new THREE.Color(0x4cc9f0);
  var c2 = new THREE.Color(0xffffff);
  var c3 = new THREE.Color(0x1a4a5a);

  for (var i = 0; i < COUNT; i++) {
    var i3    = i * 3;
    var r     = 3.5 + Math.random() * 3;
    var theta = Math.random() * Math.PI * 2;
    var phi   = Math.acos(2 * Math.random() - 1);
    pPos[i3]     = r * Math.sin(phi) * Math.cos(theta);
    pPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pPos[i3 + 2] = r * Math.cos(phi);

    var t = Math.random();
    var c = t < 0.55 ? c1.clone().lerp(c2, Math.random() * 0.3)
          : t < 0.85 ? c2.clone().lerp(c1, Math.random() * 0.5)
          :             c3.clone().lerp(c1, Math.random() * 0.5);
    pCol[i3] = c.r; pCol[i3+1] = c.g; pCol[i3+2] = c.b;
    pSz[i]   = Math.random() * 2.5 + 0.5;
  }

  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aColor',   new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute('aSize',    new THREE.BufferAttribute(pSz,  1));

  var pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
    uniforms: {
      uPixelRatio: { value: renderer.getPixelRatio() },
      uOpacity:    { value: 1.0 },
    },
    vertexShader: [
      'attribute float aSize;',
      'attribute vec3  aColor;',
      'varying   vec3  vColor;',
      'uniform   float uPixelRatio;',
      'void main() {',
      '  vColor = aColor;',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_PointSize = aSize * uPixelRatio * (260.0 / -mv.z);',
      '  gl_Position  = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3  vColor;',
      'uniform float uOpacity;',
      'void main() {',
      '  float d = length(gl_PointCoord - 0.5);',
      '  if (d > 0.5) discard;',
      '  float a = 1.0 - smoothstep(0.2, 0.5, d);',
      '  gl_FragColor = vec4(vColor, a * 0.85 * uOpacity);',
      '}'
    ].join('\n'),
  });

  var particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ════════════════════════════════════
     3. WIREFRAME SHAPES
     Each shape gets its own material instance.
  ════════════════════════════════════ */
  var meshes = [];

  function wireMat(hex, op) {
    return new THREE.MeshBasicMaterial({
      color: hex, wireframe: true, transparent: true, opacity: op
    });
  }

  var shapeDefs = [
    { geo: new THREE.IcosahedronGeometry(0.75, 1), hex: 0x4cc9f0, op: 0.30, pos: [ 2.2,  0.4,  0  ], speed: 0.35 },
    { geo: new THREE.OctahedronGeometry(0.5,   0), hex: 0x4cc9f0, op: 0.20, pos: [-2.5, -0.8,  0.5], speed: 0.55 },
    { geo: new THREE.TetrahedronGeometry(0.4,  0), hex: 0x4cc9f0, op: 0.18, pos: [ 1.4, -1.5, -1  ], speed: 0.45 },
    { geo: new THREE.IcosahedronGeometry(0.32, 0), hex: 0x4cc9f0, op: 0.22, pos: [-1.2,  1.4,  1  ], speed: 0.60 },
  ];

  for (var s = 0; s < shapeDefs.length; s++) {
    var d    = shapeDefs[s];
    var mesh = new THREE.Mesh(d.geo, wireMat(d.hex, d.op));
    mesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
    mesh.userData.speed   = d.speed;
    mesh.userData.originX = d.pos[0];
    mesh.userData.originY = d.pos[1];
    mesh.userData.dragged = false;
    scene.add(mesh);
    meshes.push(mesh);
  }

  /* ════════════════════════════════════
     4. INVISIBLE HIT-SPHERE (drag target)
     Wireframe geometry has no fill so raycaster
     almost never hits it. A transparent sphere
     child gives a reliable click surface.
  ════════════════════════════════════ */
  var hitMat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.0, depthWrite: false, side: THREE.FrontSide
  });
  var hitSphere = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 12), hitMat);
  meshes[0].add(hitSphere);   // child of main icosahedron — moves with it

  /* ════════════════════════════════════
     5. DOT-GRID PLANE
     Single ShaderMaterial — no material array,
     no GridHelper flash.
  ════════════════════════════════════ */
  var gridMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite:  false,
    side: THREE.DoubleSide,
    uniforms: { uOp: { value: 0.0 } },
    vertexShader: [
      'varying vec2 vUv;',
      'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
    ].join('\n'),
    fragmentShader: [
      'varying vec2 vUv;',
      'uniform float uOp;',
      'void main() {',
      '  vec2 g  = fract(vUv * 22.0);',
      '  float d = length(g - 0.5);',
      '  float a = 1.0 - smoothstep(0.04, 0.12, d);',
      '  gl_FragColor = vec4(0.298, 0.788, 0.941, a * uOp);',
      '}'
    ].join('\n'),
  });

  var gridPlane = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), gridMat);
  gridPlane.rotation.x = -Math.PI / 2;
  gridPlane.position.y = -3.5;
  scene.add(gridPlane);

  /* Grid fades in 500ms after load */
  var gridReady = false;
  setTimeout(function() { gridReady = true; }, 500);

  /* ════════════════════════════════════
     6. DRAG INTERACTION
  ════════════════════════════════════ */
  var raycaster    = new THREE.Raycaster();
  /* Use a plane at z = dragMesh world z for projection */
  var dragPlane    = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  var dragOffset   = new THREE.Vector3();
  var intersection = new THREE.Vector3();
  var dragMesh     = meshes[0];
  var isDragging   = false;

  function toNDC(cx, cy) {
    return new THREE.Vector2(
      (cx / window.innerWidth ) *  2 - 1,
      (cy / window.innerHeight) * -2 + 1
    );
  }

  function hitsTarget(ndc) {
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(hitSphere, false).length > 0;
  }

  function onDown(cx, cy) {
    var ndc = toNDC(cx, cy);
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
    mouseX =  (cx / window.innerWidth  - 0.5) * 2;
    mouseY = -(cy / window.innerHeight - 0.5) * 2;

    var ndc = toNDC(cx, cy);
    if (!isDragging) {
      canvas.style.cursor = hitsTarget(ndc) ? 'grab' : 'default';
      return;
    }
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
      var np = intersection.clone().sub(dragOffset);
      dragMesh.position.set(np.x, np.y, dragMesh.position.z);
      dragMesh.userData.originX = dragMesh.position.x;
      dragMesh.userData.originY = dragMesh.position.y;
    }
  }

  function onUp() {
    if (!isDragging) return;
    isDragging = false;
    dragMesh.userData.dragged = false;
    canvas.style.cursor = 'default';
  }

  window.addEventListener('mousedown', function(e) { onDown(e.clientX, e.clientY); });
  window.addEventListener('mousemove', function(e) { onMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup',   function()  { onUp(); });

  canvas.addEventListener('touchstart', function(e) {
    var t = e.touches[0]; onDown(t.clientX, t.clientY);
    if (isDragging) e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', function(e) {
    var t = e.touches[0]; onMove(t.clientX, t.clientY);
    if (isDragging) e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', function() { onUp(); });

  /* ════════════════════════════════════
     7. MOUSE + SCROLL STATE
  ════════════════════════════════════ */
  var mouseX = 0, mouseY = 0;
  var smoothX = 0, smoothY = 0;
  var scrollProgress = 0;
  var heroEl = document.getElementById('hero');

  window.addEventListener('scroll', function() {
    var sy = window.scrollY;
    var mh = heroEl ? heroEl.offsetHeight : window.innerHeight;
    scrollProgress = Math.min(sy / mh, 1);
    document.getElementById('navbar').classList.toggle('scrolled', sy > 60);
    revealElements();
  });

  /* ════════════════════════════════════
     8. SCROLL REVEAL
  ════════════════════════════════════ */
  var revealEls = document.querySelectorAll('.reveal');

  function revealElements() {
    var wh = window.innerHeight;
    for (var i = 0; i < revealEls.length; i++) {
      (function(el, idx) {
        if (el.getBoundingClientRect().top < wh * 0.88) {
          setTimeout(function() { el.classList.add('visible'); }, idx * 60);
        }
      })(revealEls[i], i);
    }
  }
  setTimeout(revealElements, 100);

  /* ════════════════════════════════════
     9. ANIMATE LOOP
  ════════════════════════════════════ */
  var clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();

    /* Smooth parallax */
    smoothX += (mouseX - smoothX) * 0.04;
    smoothY += (mouseY - smoothY) * 0.04;

    /* Particles */
    pMat.uniforms.uOpacity.value = Math.max(0, 1 - scrollProgress * 1.5);
    particles.rotation.y = t * 0.04 + smoothX * 0.18;
    particles.rotation.x = smoothY * 0.1 + t * 0.015;

    /* Camera */
    camera.position.x = smoothX * 0.4;
    camera.position.y = smoothY * 0.25 - scrollProgress * 2;
    camera.rotation.z = smoothX * 0.02;
    camera.lookAt(0, -scrollProgress * 0.5, 0);

    /* Grid — lerp toward target opacity */
    var gridTarget = gridReady ? 0.18 * Math.max(0, 1 - scrollProgress * 2) : 0;
    gridMat.uniforms.uOp.value += (gridTarget - gridMat.uniforms.uOp.value) * 0.04;
    gridPlane.position.y = -3.5 - scrollProgress * 2;

    /* Shapes */
    for (var i = 0; i < meshes.length; i++) {
      var m  = meshes[i];
      var sp = m.userData.speed;
      m.rotation.x = t * sp * 0.4;
      m.rotation.y = t * sp * 0.6;
      if (!m.userData.dragged) {
        m.position.y = m.userData.originY + Math.sin(t * sp * 0.7 + m.userData.originX) * 0.18;
        m.position.x = m.userData.originX + Math.cos(t * sp * 0.4) * 0.08 + smoothX * 0.12;
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  /* ════════════════════════════════════
     10. RESIZE
  ════════════════════════════════════ */
  window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    pMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  });

  /* ════════════════════════════════════
     11. CARD GLOW
  ════════════════════════════════════ */
  var cards = document.querySelectorAll('.project-card');
  for (var ci = 0; ci < cards.length; ci++) {
    cards[ci].addEventListener('mousemove', function(e) {
      var rect = this.getBoundingClientRect();
      var glow = this.querySelector('.card-glow');
      if (glow) {
        glow.style.left = (e.clientX - rect.left  - 100) + 'px';
        glow.style.top  = (e.clientY - rect.top   - 100) + 'px';
      }
    });
  }

  /* ════════════════════════════════════
     12. SMOOTH ANCHOR SCROLL
  ════════════════════════════════════ */
  var anchors = document.querySelectorAll('a[href^="#"]');
  for (var ai = 0; ai < anchors.length; ai++) {
    anchors[ai].addEventListener('click', function(e) {
      var dest = document.querySelector(this.getAttribute('href'));
      if (dest) { e.preventDefault(); dest.scrollIntoView({ behavior: 'smooth' }); }
    });
  }

})(); /* end IIFE */
