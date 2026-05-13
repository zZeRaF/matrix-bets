// Matrix Bets — scène 3D du splash (Three.js low-poly Matrix)
// 3 robots humanoïdes (attaquant, défenseur, gardien), but, ballon avec trail.
// Animation 7s : course → dribble → frappe → vol ballon → plongeon gardien → but.

import * as THREE from "three";

const ANIM_DURATION = 7.0;

let renderer, scene, camera, clock;
let player, defender, keeper;
let ball, ballTrail, ballTrailPoints;
let goalNet, particlesAura;
let animationId;
let resizeObserver = null;

// ─── Materials ───
const matPlayerBody = new THREE.MeshStandardMaterial({
  color: 0x002010, emissive: 0x003a1a, emissiveIntensity: 0.7,
  metalness: 0.75, roughness: 0.35,
});
const matPlayerGlow = new THREE.MeshStandardMaterial({
  color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 2.4,
  metalness: 0.4, roughness: 0.25,
});
const matPlayerAccent = new THREE.MeshStandardMaterial({
  color: 0x00aa44, emissive: 0x00ff66, emissiveIntensity: 0.7,
  metalness: 0.5, roughness: 0.3,
});

// Défenseur — orange/rouge (adversaire)
const matDefBody = new THREE.MeshStandardMaterial({
  color: 0x301010, emissive: 0x4a1a08, emissiveIntensity: 0.6,
  metalness: 0.7, roughness: 0.4,
});
const matDefGlow = new THREE.MeshStandardMaterial({
  color: 0xff5520, emissive: 0xff3a10, emissiveIntensity: 2.0,
  metalness: 0.4, roughness: 0.3,
});

// Gardien — jaune/cyan (neutre intermédiaire)
const matKeeperBody = new THREE.MeshStandardMaterial({
  color: 0x102030, emissive: 0x103048, emissiveIntensity: 0.6,
  metalness: 0.7, roughness: 0.35,
});
const matKeeperGlow = new THREE.MeshStandardMaterial({
  color: 0x00b0f0, emissive: 0x00d0ff, emissiveIntensity: 2.0,
  metalness: 0.4, roughness: 0.25,
});

const matGoal = new THREE.MeshStandardMaterial({
  color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 1.6,
  metalness: 0.85, roughness: 0.3,
});
const matBall = new THREE.MeshStandardMaterial({
  color: 0xffffff, emissive: 0x00ff66, emissiveIntensity: 1.5,
  metalness: 0.7, roughness: 0.2,
});

// ─── Build Humanoid robot (paramétrable) ───
function buildHumanoid(opts) {
  const { scale = 1, matBody, matGlow, matAccent } = opts;
  const accent = matAccent || matGlow;
  const g = new THREE.Group();
  const parts = {};

  // Tête
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), matBody);
  head.position.y = 2.55;
  g.add(head);

  // Visière
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.02), matGlow);
  visor.position.set(0, 2.6, 0.26);
  g.add(visor);

  // Yeux LED
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

  // Cou + torse
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), matBody);
  neck.position.y = 2.22;
  g.add(neck);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.42), matBody);
  torso.position.y = 1.65;
  g.add(torso);

  // Réacteur
  const reactor = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), matGlow);
  reactor.position.set(0, 1.7, 0.23);
  g.add(reactor);

  // Épaules
  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), matBody);
  shoulderL.position.set(-0.46, 2.05, 0);
  g.add(shoulderL);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.46;
  g.add(shoulderR);

  // Bras (pivot à l'épaule)
  function buildArm(sign) {
    const arm = new THREE.Group();
    arm.position.set(sign * 0.46, 2.05, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), matBody);
    upper.position.y = -0.28;
    arm.add(upper);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 0.16), matBody);
    fore.position.y = -0.76;
    arm.add(fore);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), accent);
    hand.position.y = -1.05;
    arm.add(hand);
    return arm;
  }
  parts.armL = buildArm(-1);
  parts.armR = buildArm(1);
  g.add(parts.armL);
  g.add(parts.armR);

  // Jambes
  function buildLeg(sign) {
    const leg = new THREE.Group();
    leg.position.set(sign * 0.18, 1.18, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, 0.24), matBody);
    thigh.position.y = -0.3;
    leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), matBody);
    shin.position.y = -0.78;
    leg.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.4), accent);
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
  parts.group = g;
  g.scale.set(scale, scale, scale);
  return parts;
}

// ─── Build But ───
function buildGoal() {
  const g = new THREE.Group();
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 12), matGoal);
  postL.position.set(-2.5, 1.5, 0);
  g.add(postL);
  const postR = postL.clone();
  postR.position.x = 2.5;
  g.add(postR);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.16, 12), matGoal);
  bar.position.set(0, 3, 0);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);

  // Filet
  const netMat = new THREE.LineBasicMaterial({
    color: 0x82ffb4, opacity: 0.45, transparent: true,
  });
  const pts = [];
  for (let i = -3; i <= 3; i++) {
    const x = i * (2.5 / 3);
    pts.push(x, 0, 0, x * 0.65, 3, -1.6);
    pts.push(x, 0, 0, x, 3, 0);
  }
  for (let y = 0; y <= 3; y += 0.5) {
    pts.push(-1.65, y, -1.6, 1.65, y, -1.6);
    pts.push(-2.5, y, 0, -1.65, y, -1.6);
    pts.push(2.5, y, 0, 1.65, y, -1.6);
  }
  pts.push(-2.5, 0, 0, 2.5, 0, 0);
  pts.push(-1.65, 0, -1.6, 1.65, 0, -1.6);
  const netGeom = new THREE.BufferGeometry();
  netGeom.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  goalNet = new THREE.LineSegments(netGeom, netMat);
  g.add(goalNet);

  return g;
}

// ─── Ballon + trail ───
function buildBall() {
  return new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), matBall);
}

function buildBallTrail() {
  // Trail = ligne dynamique avec N points qui suivent le ballon (FIFO)
  const trailLength = 22;
  ballTrailPoints = new Array(trailLength).fill(null).map(() => new THREE.Vector3(0, 0, 0));
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(trailLength * 3);
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x00ff66, opacity: 0.85, transparent: true,
    linewidth: 2,
  });
  return new THREE.Line(geom, mat);
}

function updateBallTrail(currentPos) {
  // Shift FIFO et ajoute le nouveau point en fin
  for (let i = 0; i < ballTrailPoints.length - 1; i++) {
    ballTrailPoints[i].copy(ballTrailPoints[i + 1]);
  }
  ballTrailPoints[ballTrailPoints.length - 1].copy(currentPos);
  const positions = ballTrail.geometry.attributes.position.array;
  for (let i = 0; i < ballTrailPoints.length; i++) {
    positions[i * 3] = ballTrailPoints[i].x;
    positions[i * 3 + 1] = ballTrailPoints[i].y;
    positions[i * 3 + 2] = ballTrailPoints[i].z;
  }
  ballTrail.geometry.attributes.position.needsUpdate = true;
}

function resetBallTrail(pos) {
  if (!ballTrailPoints) return;
  for (let p of ballTrailPoints) p.copy(pos);
}

// ─── Field grille ───
function buildField() {
  const g = new THREE.Group();
  const grid = new THREE.GridHelper(80, 80, 0x00ff66, 0x0a4d2a);
  grid.position.y = 0.001;
  grid.material.opacity = 0.5;
  grid.material.transparent = true;
  g.add(grid);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x001a08, roughness: 0.95, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);
  return g;
}

// ─── Particules autour de l'attaquant ───
function buildParticles() {
  const count = 60;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2.5;
    positions[i * 3 + 1] = Math.random() * 3.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x00ff66, size: 0.08, transparent: true, opacity: 0.7, sizeAttenuation: true,
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
  scene.fog = new THREE.Fog(0x001000, 10, 35);

  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  camera.position.set(0, 3.5, 12);
  camera.lookAt(0, 1.6, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // Lights
  scene.add(new THREE.AmbientLight(0x004020, 0.6));
  const dir = new THREE.DirectionalLight(0x00ff66, 1.0);
  dir.position.set(4, 12, 8);
  scene.add(dir);
  const fill = new THREE.PointLight(0x82ffb4, 0.7, 25);
  fill.position.set(-5, 4, 4);
  scene.add(fill);

  // Field
  scene.add(buildField());

  // Goal
  const goal = buildGoal();
  goal.position.set(0, 0, -18);
  scene.add(goal);

  // Player (attaquant)
  player = buildHumanoid({
    scale: 1, matBody: matPlayerBody, matGlow: matPlayerGlow, matAccent: matPlayerAccent,
  });
  player.group.position.set(0, 0, 6);
  scene.add(player.group);

  // Défenseur (entre joueur et but, orange/rouge)
  defender = buildHumanoid({
    scale: 0.95, matBody: matDefBody, matGlow: matDefGlow,
  });
  defender.group.position.set(0, 0, -3);
  scene.add(defender.group);

  // Gardien (dans le but, cyan)
  keeper = buildHumanoid({
    scale: 0.95, matBody: matKeeperBody, matGlow: matKeeperGlow,
  });
  keeper.group.position.set(0, 0, -17.8);
  scene.add(keeper.group);
  // Gardien : pose défensive, bras semi-écartés
  keeper.armL.rotation.z = 0.5;
  keeper.armR.rotation.z = -0.5;

  // Ballon
  ball = buildBall();
  ball.position.set(0.3, 0.15, 5.5);
  scene.add(ball);

  // Trail ballon (initialement invisible)
  ballTrail = buildBallTrail();
  resetBallTrail(ball.position);
  scene.add(ballTrail);

  // Particules autour du joueur
  particlesAura = buildParticles();
  player.group.add(particlesAura);

  clock = new THREE.Clock(false);

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

// ─── Animation ───
function animate() {
  animationId = requestAnimationFrame(animate);
  if (!clock || !player || !ball) return;
  const t = Math.min(clock.getElapsedTime(), ANIM_DURATION);

  // ─── Phase 1 (0-1.8s) : Course pleine vitesse vers le défenseur ───
  if (t < 1.8) {
    const p = t / 1.8;
    player.group.position.z = 6 - p * 8.5; // 6 → -2.5
    const cadence = t * 9;
    player.legL.rotation.x = Math.sin(cadence) * 0.7;
    player.legR.rotation.x = -Math.sin(cadence) * 0.7;
    player.armL.rotation.x = -Math.sin(cadence) * 0.8;
    player.armR.rotation.x = Math.sin(cadence) * 0.8;
    player.group.position.y = Math.abs(Math.sin(cadence)) * 0.1;
    player.torso.rotation.y = Math.sin(cadence) * 0.06;
    ball.position.set(
      player.group.position.x + 0.32,
      0.15 + Math.abs(Math.sin(cadence * 2)) * 0.03,
      player.group.position.z + 0.65
    );
    ball.rotation.x -= 0.2;
    if (t < 0.15) resetBallTrail(ball.position);
    // Caméra suit le joueur, légèrement en hauteur
    camera.position.z = player.group.position.z + 8;
    camera.position.y = 3.5;
    camera.lookAt(0, 1.4, player.group.position.z - 6);
  }
  // ─── Phase 2 (1.8-2.6s) : Dribble du défenseur (feinte gauche/droite) ───
  else if (t < 2.6) {
    const p = (t - 1.8) / 0.8;
    // Joueur passe à GAUCHE du défenseur (offset latéral)
    player.group.position.x = Math.sin(p * Math.PI) * -0.9; // arc à gauche
    player.group.position.z = -2.5 - p * 1.5; // continue d'avancer
    const cadence = (1.8 + p * 0.8) * 11;
    player.legL.rotation.x = Math.sin(cadence) * 0.6;
    player.legR.rotation.x = -Math.sin(cadence) * 0.6;
    player.armL.rotation.x = -Math.sin(cadence) * 0.7;
    player.armR.rotation.x = Math.sin(cadence) * 0.7;
    player.torso.rotation.y = p < 0.5 ? p * 0.4 : (1 - p) * 0.4;
    ball.position.set(
      player.group.position.x + 0.32,
      0.15,
      player.group.position.z + 0.6
    );
    ball.rotation.x -= 0.25;
    // Défenseur : tourne sur lui-même (se fait dribbler)
    defender.group.rotation.y = p * Math.PI * 2;
    defender.torso.rotation.y = p * 0.6;
    defender.armL.rotation.x = -Math.sin(p * 6) * 0.5;
    defender.armR.rotation.x = Math.sin(p * 6) * 0.5;
    defender.group.position.x = p > 0.6 ? (p - 0.6) * 1.5 : 0;
    // Caméra
    camera.position.z = player.group.position.z + 7;
    camera.position.x = player.group.position.x * 0.3;
    camera.lookAt(0, 1.4, player.group.position.z - 5);
  }
  // ─── Phase 3 (2.6-3.4s) : Course finale + élan ───
  else if (t < 3.4) {
    const p = (t - 2.6) / 0.8;
    player.group.position.x = -0.9 + p * 0.9; // recentré
    player.group.position.z = -4 - p * 1.5;
    const cadence = (2.6 + p * 0.8) * 10;
    player.legL.rotation.x = Math.sin(cadence) * 0.7;
    player.legR.rotation.x = -Math.sin(cadence) * 0.7;
    player.armL.rotation.x = -Math.sin(cadence) * 0.8;
    player.armR.rotation.x = Math.sin(cadence) * 0.8;
    player.torso.rotation.y = Math.sin(cadence) * 0.06;
    ball.position.set(player.group.position.x + 0.32, 0.15, player.group.position.z + 0.65);
    ball.rotation.x -= 0.22;
    // Défenseur disparaît sur le côté
    defender.group.position.x = 1.5 + p * 1.5;
    defender.group.position.y = -p * 1;
    defender.group.rotation.y += 0.15;
    camera.position.z = player.group.position.z + 7;
    camera.position.x = 0;
    camera.lookAt(0, 1.5, player.group.position.z - 6);
  }
  // ─── Phase 4 (3.4-4.0s) : Élan (recul jambe + bras équilibre) ───
  else if (t < 4.0) {
    const p = (t - 3.4) / 0.6;
    player.group.position.z = -5.5 - p * 0.5;
    player.group.position.y = 0;
    player.legL.rotation.x = 0;
    player.legR.rotation.x = -1.0 * p * 1.3; // jambe droite recule
    player.armL.rotation.x = -0.5;
    player.armR.rotation.x = 0.5;
    player.torso.rotation.y = -0.2;
    ball.position.set(0.3, 0.15, player.group.position.z + 0.65);
    // Caméra zoom léger
    camera.position.z = player.group.position.z + 6;
    camera.position.y = 3.2;
    camera.lookAt(0, 1.5, player.group.position.z - 8);
  }
  // ─── Phase 5 (4.0-4.7s) : FRAPPE — ballon décolle ───
  else if (t < 4.7) {
    const p = (t - 4.0) / 0.7;
    player.group.position.z = -6;
    player.legR.rotation.x = -1.3 + p * 2.8; // jambe revient avec force
    player.legL.rotation.x = -p * 0.3;
    player.armL.rotation.x = -0.5 - p * 0.5;
    player.armR.rotation.x = 0.5 - p * 0.3;
    player.torso.rotation.y = -0.2 + p * 0.4;
    player.group.position.y = p * 0.2;
    // Ballon décolle au moment du contact (p > 0.3)
    if (p > 0.3) {
      const bp = (p - 0.3) / 0.7;
      ball.position.x = 0.3 + (-0.8 - 0.3) * bp;
      ball.position.y = 0.15 + Math.sin(bp * Math.PI) * 1.8;
      ball.position.z = -5.4 + (-15 - (-5.4)) * bp;
      ball.rotation.x -= 0.5;
      ball.rotation.y += 0.3;
      if (bp > 0.05) updateBallTrail(ball.position);
    }
    // Gardien commence à réagir (anticipe)
    if (p > 0.7) {
      const kp = (p - 0.7) / 0.3;
      keeper.group.position.y = -kp * 0.3;
      keeper.group.rotation.z = kp * 0.4;
    }
    // Caméra dramatique : se rapproche du robot puis pivote vers le but
    camera.position.z = -6 + (1 - p) * 4;
    camera.position.y = 3 - p * 0.5;
    camera.lookAt(player.group.position.x, 1.5, -10 - p * 4);
  }
  // ─── Phase 6 (4.7-5.5s) : Ballon vole + gardien plonge à droite (raté) ───
  else if (t < 5.5) {
    const p = (t - 4.7) / 0.8;
    player.group.position.y = Math.max(0, 0.2 - p * 0.2);
    player.legR.rotation.x = 1.5 - p * 1.5;
    player.legL.rotation.x = -0.3 + p * 0.3;
    player.armL.rotation.x = -1.0 + p * 0.4;
    player.armR.rotation.x = 0.2;
    player.torso.rotation.y = 0.2 - p * 0.2;
    // Trajectoire ballon vers la lucarne haut-gauche du but
    const bp = 1.0 + p * 0.4;
    ball.position.x = 0.3 + (-0.8 - 0.3) * Math.min(1, bp);
    ball.position.y = 0.15 + Math.sin(Math.min(1, bp) * Math.PI) * 1.8 + Math.max(0, bp - 1) * 0.8;
    ball.position.z = -5.4 + (-15 - (-5.4)) * Math.min(1, bp) - Math.max(0, bp - 1) * 2;
    ball.rotation.x -= 0.45;
    ball.rotation.y += 0.25;
    updateBallTrail(ball.position);
    // Gardien plonge à DROITE (côté opposé au tir → manqué)
    keeper.group.position.x = p * 1.2;
    keeper.group.position.y = -0.3 - p * 0.4;
    keeper.group.rotation.z = 0.4 + p * 0.6;
    keeper.armR.rotation.x = -1.2 - p * 0.5;
    keeper.armL.rotation.x = 0.3 + p * 0.3;
    keeper.legL.rotation.x = -0.5 - p * 0.5;
    keeper.legR.rotation.x = 0.2 + p * 0.3;
    // Caméra : suit le ballon vers le but
    camera.position.x = ball.position.x * 0.5;
    camera.position.y = 3 + p * 0.5;
    camera.position.z = -8 - p * 2;
    camera.lookAt(ball.position.x, ball.position.y, ball.position.z);
  }
  // ─── Phase 7 (5.5-6.2s) : But — filet ondule, ballon roule au fond ───
  else if (t < 6.2) {
    const p = (t - 5.5) / 0.7;
    // Ballon dans le filet, rebondit légèrement puis roule
    ball.position.x = -1 + p * 0.5;
    ball.position.y = 1.8 - p * 1.7;
    ball.position.z = -18 + p * 1.2;
    ball.rotation.x -= 0.3;
    ball.rotation.y += 0.2;
    updateBallTrail(ball.position);
    // Filet ondule
    if (goalNet) {
      goalNet.position.z = Math.sin(p * 18) * 0.12 * (1 - p * 0.5);
      goalNet.position.y = Math.sin(p * 14) * 0.05;
    }
    // Gardien reste au sol
    keeper.group.position.x = 1.2;
    keeper.group.position.y = -0.7;
    // Joueur commence sa célébration (lève les bras)
    player.armL.rotation.x = -0.6 + p * -1.0;
    player.armR.rotation.x = 0.2 + p * -1.8;
    player.group.position.z = -6 + Math.sin(p * 4) * 0.1;
    // Caméra : zoom out sur le but
    camera.position.x = -1 + p * 0.5;
    camera.position.y = 3.5 + p * 0.5;
    camera.position.z = -11 - p * 1;
    camera.lookAt(-0.5, 1.5, -17.5);
  }
  // ─── Phase 8 (6.2-7s) : Célébration finale (vue cinéma) ───
  else {
    const p = (t - 6.2) / 0.8;
    // Joueur saute de joie
    player.group.position.y = Math.abs(Math.sin(p * 8)) * 0.4;
    player.armL.rotation.x = -1.6;
    player.armR.rotation.x = -1.6;
    player.legL.rotation.x = Math.sin(p * 10) * 0.2;
    player.legR.rotation.x = -Math.sin(p * 10) * 0.2;
    player.torso.rotation.y = Math.sin(p * 6) * 0.2;
    // Ballon reste au fond du but
    ball.position.set(-0.5, 0.15, -17.5);
    // Filet se calme
    if (goalNet) {
      goalNet.position.z = Math.sin(p * 8) * 0.03;
      goalNet.position.y = 0;
    }
    // Caméra : tourne autour du joueur (orbite)
    const orbitAngle = p * Math.PI * 0.6;
    camera.position.x = Math.sin(orbitAngle) * 5;
    camera.position.z = -5 + Math.cos(orbitAngle) * 5;
    camera.position.y = 3 + Math.sin(p * 4) * 0.3;
    camera.lookAt(player.group.position.x, 2, -6);
  }

  // Particules : tournent en continu autour du joueur
  if (particlesAura) {
    particlesAura.rotation.y += 0.025;
    particlesAura.rotation.x += 0.008;
  }

  renderer.render(scene, camera);
}

// ─── API publique ───
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
