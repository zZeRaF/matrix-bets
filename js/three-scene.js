// Matrix Bets — scène 3D du splash (Three.js low-poly Matrix)
// Robot humanoïde primitif qui court, frappe, marque. Animation 7s.

import * as THREE from "three";

const ANIM_DURATION = 7.0;

let renderer, scene, camera, clock;
let robot, ball, animationId;
const parts = {};
let resizeObserver = null;

// ─── Materials ───
const matMetal = new THREE.MeshStandardMaterial({
  color: 0x002010,
  emissive: 0x003a1a,
  emissiveIntensity: 0.6,
  metalness: 0.75,
  roughness: 0.35,
});
const matGlow = new THREE.MeshStandardMaterial({
  color: 0x00ff66,
  emissive: 0x00ff66,
  emissiveIntensity: 2.2,
  metalness: 0.4,
  roughness: 0.25,
});
const matGoal = new THREE.MeshStandardMaterial({
  color: 0x00ff66,
  emissive: 0x00ff66,
  emissiveIntensity: 1.6,
  metalness: 0.85,
  roughness: 0.3,
});
const matBall = new THREE.MeshStandardMaterial({
  color: 0x00ff66,
  emissive: 0x00ff66,
  emissiveIntensity: 1.3,
  metalness: 0.7,
  roughness: 0.2,
});

// ─── Build Robot ───
function buildRobot() {
  const g = new THREE.Group();

  // Tête (légèrement aplatie)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), matMetal);
  head.position.y = 2.55;
  g.add(head);

  // Visière (plaque émissive horizontale)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.02), matGlow);
  visor.position.set(0, 2.6, 0.26);
  g.add(visor);

  // 2 yeux LED ponctuels
  const eyeGeom = new THREE.SphereGeometry(0.045, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeom, matGlow);
  eyeL.position.set(-0.12, 2.6, 0.27);
  g.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeom, matGlow);
  eyeR.position.set(0.12, 2.6, 0.27);
  g.add(eyeR);

  // Antenne
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.18, 6),
    matGoal
  );
  antenna.position.set(0, 2.92, 0);
  g.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), matGlow);
  antennaTip.position.set(0, 3.04, 0);
  g.add(antennaTip);

  // Cou
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), matMetal);
  neck.position.y = 2.22;
  g.add(neck);

  // Torse
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.42), matMetal);
  torso.position.y = 1.65;
  g.add(torso);

  // Réacteur central (cœur lumineux)
  const reactor = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), matGlow);
  reactor.position.set(0, 1.7, 0.23);
  g.add(reactor);

  // Épaules
  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), matMetal);
  shoulderL.position.set(-0.46, 2.05, 0);
  g.add(shoulderL);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.46;
  g.add(shoulderR);

  // ─── Bras (group pivot à l'épaule pour rotation x) ───
  function buildArm(sign) {
    const arm = new THREE.Group();
    arm.position.set(sign * 0.46, 2.05, 0);
    // Bras supérieur
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), matMetal);
    upper.position.y = -0.28;
    arm.add(upper);
    // Avant-bras
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 0.16), matMetal);
    fore.position.y = -0.76;
    arm.add(fore);
    // Main (gantelet lumineux)
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), matGlow);
    hand.position.y = -1.05;
    hand.material = new THREE.MeshStandardMaterial({
      color: 0x00aa44, emissive: 0x00ff66, emissiveIntensity: 0.6,
      metalness: 0.5, roughness: 0.3,
    });
    arm.add(hand);
    return arm;
  }
  parts.armL = buildArm(-1);
  parts.armR = buildArm(1);
  g.add(parts.armL);
  g.add(parts.armR);

  // ─── Jambes ───
  function buildLeg(sign) {
    const leg = new THREE.Group();
    leg.position.set(sign * 0.18, 1.18, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, 0.24), matMetal);
    thigh.position.y = -0.3;
    leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), matMetal);
    shin.position.y = -0.78;
    leg.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.4), matGlow);
    foot.material = new THREE.MeshStandardMaterial({
      color: 0x00aa44, emissive: 0x00ff66, emissiveIntensity: 0.5,
      metalness: 0.5, roughness: 0.3,
    });
    foot.position.set(0, -1.1, 0.08);
    leg.add(foot);
    return leg;
  }
  parts.legL = buildLeg(-1);
  parts.legR = buildLeg(1);
  g.add(parts.legL);
  g.add(parts.legR);

  parts.head = head;
  parts.torso = torso;
  return g;
}

// ─── Build But ───
function buildGoal() {
  const g = new THREE.Group();
  // Poteau gauche
  const postL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 3, 12),
    matGoal
  );
  postL.position.set(-2.5, 1.5, 0);
  g.add(postL);
  // Poteau droit
  const postR = postL.clone();
  postR.position.x = 2.5;
  g.add(postR);
  // Barre transversale
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 5.16, 12),
    matGoal
  );
  bar.position.set(0, 3, 0);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);

  // Filet (lignes vertes pastel)
  const netMat = new THREE.LineBasicMaterial({
    color: 0x82ffb4,
    opacity: 0.45,
    transparent: true,
  });
  const pts = [];
  // Verticales filet arrière
  for (let i = -3; i <= 3; i++) {
    const x = i * (2.5 / 3);
    pts.push(x, 0, 0, x * 0.65, 3, -1.6);
    pts.push(x, 0, 0, x, 3, 0);
  }
  // Horizontales arrière
  for (let y = 0; y <= 3; y += 0.5) {
    pts.push(-1.65, y, -1.6, 1.65, y, -1.6);
    pts.push(-2.5, y, 0, -1.65, y, -1.6);
    pts.push(2.5, y, 0, 1.65, y, -1.6);
  }
  // Ligne de fond
  pts.push(-2.5, 0, 0, 2.5, 0, 0);
  pts.push(-1.65, 0, -1.6, 1.65, 0, -1.6);

  const netGeom = new THREE.BufferGeometry();
  netGeom.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const net = new THREE.LineSegments(netGeom, netMat);
  parts.net = net;
  g.add(net);

  return g;
}

// ─── Build Ball ───
function buildBall() {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), matBall);
  return b;
}

// ─── Sol grille ───
function buildField() {
  const g = new THREE.Group();
  const grid = new THREE.GridHelper(80, 80, 0x00ff66, 0x0a4d2a);
  grid.position.y = 0.001;
  grid.material.opacity = 0.5;
  grid.material.transparent = true;
  g.add(grid);

  // Plan sol pour assombrir
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({
      color: 0x001a08,
      roughness: 0.95,
      metalness: 0,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);

  return g;
}

// ─── Particules électriques autour du robot ───
function buildParticles() {
  const count = 40;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2;
    positions[i * 3 + 1] = Math.random() * 3;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x00ff66,
    size: 0.08,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
  });
  return new THREE.Points(geom, mat);
}

// ─── Init ───
function init() {
  const canvas = document.getElementById("three-canvas");
  if (!canvas) return false;
  const parent = canvas.parentElement;
  const w = parent.clientWidth || 380;
  const h = parent.clientHeight || 220;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000700);
  scene.fog = new THREE.Fog(0x001000, 8, 30);

  camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 100);
  camera.position.set(0, 3.5, 12);
  camera.lookAt(0, 1.6, 0);

  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true,
  });
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // Lights
  const ambient = new THREE.AmbientLight(0x004020, 0.6);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0x00ff66, 1.0);
  dir.position.set(4, 12, 8);
  scene.add(dir);
  const fill = new THREE.PointLight(0x82ffb4, 0.7, 20);
  fill.position.set(-5, 4, 4);
  scene.add(fill);

  // Objects
  scene.add(buildField());
  const goal = buildGoal();
  goal.position.set(0, 0, -18);
  scene.add(goal);

  robot = buildRobot();
  robot.position.set(0, 0, 6);
  scene.add(robot);

  ball = buildBall();
  ball.position.set(0.3, 0.15, 5.5);
  scene.add(ball);

  parts.particles = buildParticles();
  robot.add(parts.particles);

  clock = new THREE.Clock(false);

  // Observe resize
  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(() => onResize());
    resizeObserver.observe(parent);
  }

  return true;
}

function onResize() {
  if (!renderer || !camera) return;
  const canvas = renderer.domElement;
  const parent = canvas.parentElement;
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ─── Animation loop ───
function animate() {
  animationId = requestAnimationFrame(animate);
  if (!clock || !robot || !ball) return;
  const t = Math.min(clock.getElapsedTime(), ANIM_DURATION);

  // Phase 1 (0-2.5s) : course
  if (t < 2.5) {
    const p = t / 2.5;
    robot.position.z = 6 - p * 7.5; // 6 → -1.5
    const cadence = t * 9;
    parts.legL.rotation.x = Math.sin(cadence) * 0.7;
    parts.legR.rotation.x = -Math.sin(cadence) * 0.7;
    parts.armL.rotation.x = -Math.sin(cadence) * 0.8;
    parts.armR.rotation.x = Math.sin(cadence) * 0.8;
    robot.position.y = Math.abs(Math.sin(cadence)) * 0.1;
    parts.torso.rotation.y = Math.sin(cadence) * 0.06;
    ball.position.x = robot.position.x + 0.32;
    ball.position.y = 0.15;
    ball.position.z = robot.position.z + 0.7;
    ball.rotation.x -= 0.18;
    camera.position.z = robot.position.z + 8;
    camera.position.y = 3.5 - p * 1;
    camera.lookAt(0, 1.4, robot.position.z - 5);
  }
  // Phase 2 (2.5-3.5s) : élan (recul jambe + bras équilibre)
  else if (t < 3.5) {
    const p = (t - 2.5);
    robot.position.z = -1.5 - p * 0.3;
    robot.position.y = 0;
    parts.legL.rotation.x = 0;
    parts.legR.rotation.x = -1.0 * p * 1.4; // jambe droite recule
    parts.armL.rotation.x = -0.4 + p * 0.2;
    parts.armR.rotation.x = 0.3 + p * 0.3;
    parts.torso.rotation.y = 0.15;
    ball.position.set(0.3, 0.15, robot.position.z + 0.7);
  }
  // Phase 3 (3.5-4.3s) : FRAPPE
  else if (t < 4.3) {
    const p = (t - 3.5) / 0.8;
    robot.position.z = -1.8;
    parts.legR.rotation.x = -1.4 + p * 3.0; // jambe revient avec force
    parts.legL.rotation.x = -p * 0.3;
    parts.armL.rotation.x = -0.2 - p * 0.4;
    parts.armR.rotation.x = 0.6 - p * 0.3;
    parts.torso.rotation.y = 0.15 - p * 0.3;
    robot.position.y = p * 0.15;
    // Ballon décolle au moment du contact
    if (p > 0.4) {
      const bp = (p - 0.4) / 0.6;
      ball.position.x = 0.3 + (-0.7 - 0.3) * bp;
      ball.position.y = 0.15 + Math.sin(bp * Math.PI) * 1.6;
      ball.position.z = -1.1 + (-15 - (-1.1)) * bp;
      ball.rotation.x -= 0.5;
    }
  }
  // Phase 4 (4.3-5.5s) : ballon vole + entre dans le filet
  else if (t < 5.5) {
    const p = (t - 4.3) / 1.2;
    robot.position.y = Math.max(0, robot.position.y - 0.01);
    parts.legR.rotation.x = 0.8 - p * 0.8;
    parts.legL.rotation.x = -0.3 + p * 0.3;
    parts.armL.rotation.x = -0.6 + p * 0.4;
    parts.armR.rotation.x = 0.3 + p * 0.3;
    parts.torso.rotation.y = -0.15 + p * 0.15;
    // Continue trajectoire ballon vers but
    const bp = 0.4 + 0.6 * p;
    ball.position.x = 0.3 + (-0.7 - 0.3) * bp - p * 0.3;
    ball.position.y = 0.15 + Math.sin(bp * Math.PI) * 1.6 + p * 0.2;
    ball.position.z = -1.1 + (-15 - (-1.1)) * bp - p * 1.5;
    ball.rotation.x -= 0.4;
    // Filet bouge à l'impact
    if (p > 0.7 && parts.net) {
      parts.net.position.z = Math.sin((p - 0.7) * 30) * 0.1;
    }
  }
  // Phase 5 (5.5-6.5s) : ballon roule dans filet + célébration
  else if (t < 6.5) {
    const p = (t - 5.5);
    robot.position.y = Math.abs(Math.sin(p * 8)) * 0.35;
    parts.armL.rotation.x = -1.6;
    parts.armR.rotation.x = -1.6;
    parts.legL.rotation.x = Math.sin(p * 8) * 0.2;
    parts.legR.rotation.x = -Math.sin(p * 8) * 0.2;
    parts.torso.rotation.y = Math.sin(p * 6) * 0.15;
    // Ballon roule lentement dans le filet
    ball.position.set(-1 + p * 0.5, 0.4 - p * 0.3, -17 + p * 0.3);
    ball.rotation.x -= 0.15;
    if (parts.net) parts.net.position.z = Math.sin(p * 14) * 0.04;
  }
  // Phase 6 (6.5-7s) : pose finale + fade implicite
  else {
    robot.position.y = 0;
    parts.armL.rotation.x = -1.6;
    parts.armR.rotation.x = -1.6;
    parts.legL.rotation.x = 0;
    parts.legR.rotation.x = 0;
    ball.position.set(0, 0.15, -17.5);
  }

  // Particules tournent autour du robot
  if (parts.particles) {
    parts.particles.rotation.y += 0.02;
    parts.particles.rotation.x += 0.005;
  }

  renderer.render(scene, camera);
}

// ─── API publique (déclenchée par app.js) ───
window.startThreeScene = function () {
  if (!scene) {
    const ok = init();
    if (!ok) return;
  }
  if (clock) {
    clock.stop();
    clock.start();
  }
  if (!animationId) animate();
};

window.stopThreeScene = function () {
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;
};
