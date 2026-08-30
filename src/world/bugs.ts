import * as THREE from 'three';
import { iridescentShellMaterial, metallicShellMaterial, holographicShellMaterial } from './shaders';

export type BugKind = 'striker' | 'partner' | 'bowler' | 'fielder';

export type BugPalette = {
  shell: number;
  belly: number;
  limb: number;
  eye: number;
  accent: number;
  helmet?: number;
};

export const PALETTES: Record<BugKind, BugPalette> = {
  striker: {
    shell: 0x2d6a4f,
    belly: 0x95d5b2,
    limb: 0x1b4332,
    eye: 0xfff3b0,
    accent: 0xf4d35e,
    helmet: 0x40916c,
  },
  partner: {
    shell: 0x457b9d,
    belly: 0xa8dadc,
    limb: 0x1d3557,
    eye: 0xe0fbfc,
    accent: 0xf1faee,
    helmet: 0x1d3557,
  },
  bowler: {
    shell: 0xe9c46a,
    belly: 0xffe8a3,
    limb: 0x6d6875,
    eye: 0xfff8e7,
    accent: 0xe76f51,
  },
  fielder: {
    shell: 0x6d6875,
    belly: 0xb8b0c0,
    limb: 0x3d3a44,
    eye: 0xffe5d9,
    accent: 0xe76f51,
  },
};

function mat(color: number, opts?: { rough?: number; metal?: number; emissive?: number }) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.rough ?? 0.55,
    metalness: opts?.metal ?? 0.08,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissive ? 0.35 : 0,
  });
}

function getShellMaterial(color: number, accentColor: number, shaderType?: string): THREE.Material {
  switch (shaderType) {
    case 'iridescent':
      return iridescentShellMaterial(color, accentColor);
    case 'metallic':
      return metallicShellMaterial(color);
    case 'holographic':
      return holographicShellMaterial(color);
    default:
      return mat(color, { rough: 0.4, metal: 0.15 });
  }
}

/**
 * Stylized cricket-insect hero: shell, big eyes, antennae, optional bat/helmet.
 */
export function createBug(
  kind: BugKind,
  scale = 1,
  palette?: BugPalette,
  shellShader?: 'standard' | 'iridescent' | 'metallic' | 'holographic',
): THREE.Group {
  const p = palette ?? PALETTES[kind];
  const root = new THREE.Group();
  root.name = kind;
  root.userData.kind = kind;

  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  const shellMat = getShellMaterial(p.shell, p.accent, shellShader);

  // Abdomen shell with ridge stripe
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 24, 18),
    shellMat,
  );
  shell.scale.set(1, 0.85, 1.25);
  shell.position.set(0, 0.55, 0);
  shell.castShadow = true;
  body.add(shell);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.08, 0.85),
    mat(p.accent, { rough: 0.35, metal: 0.2, emissive: p.accent }),
  );
  stripe.position.set(0, 0.88, 0.05);
  body.add(stripe);

  // Thorax segment
  const thorax = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 14, 10),
    shellMat,
  );
  thorax.scale.set(0.9, 0.7, 0.8);
  thorax.position.set(0, 0.6, 0.22);
  thorax.castShadow = true;
  body.add(thorax);

  // Belly
  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 14, 12),
    mat(p.belly, { rough: 0.7 }),
  );
  belly.scale.set(1.05, 0.9, 1.1);
  belly.position.set(0, 0.42, 0.08);
  body.add(belly);

  // Head
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.72, 0.38);
  body.add(head);

  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 20, 16),
    shellMat,
  );
  skull.castShadow = true;
  head.add(skull);

  // Mandibles
  for (const side of [-1, 1]) {
    const mandible = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.01, 0.12, 6),
      mat(p.limb, { rough: 0.5 }),
    );
    mandible.position.set(side * 0.08, -0.12, 0.2);
    mandible.rotation.z = side * 0.4;
    mandible.rotation.x = 0.6;
    head.add(mandible);
  }

  // Glossy compound eyes
  for (const side of [-1, 1]) {
    const eyeWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 14, 12),
      mat(p.eye, { rough: 0.25, metal: 0.05 }),
    );
    eyeWhite.position.set(side * 0.14, 0.04, 0.18);
    head.add(eyeWhite);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 10, 8),
      mat(0x1a1a1a, { rough: 0.2, metal: 0.4 }),
    );
    pupil.position.set(side * 0.14, 0.04, 0.26);
    head.add(pupil);

    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 6, 6),
      mat(0xffffff, { rough: 0.1 }),
    );
    glint.position.set(side * 0.12, 0.08, 0.3);
    head.add(glint);
  }

  // Antennae
  for (const side of [-1, 1]) {
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.35, 6),
      mat(p.limb, { rough: 0.6 }),
    );
    ant.position.set(side * 0.1, 0.28, 0.05);
    ant.rotation.z = side * 0.35;
    ant.rotation.x = -0.4;
    head.add(ant);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      mat(p.accent, { emissive: p.accent }),
    );
    tip.position.set(side * 0.18, 0.48, -0.05);
    head.add(tip);
  }

  if (p.helmet && (kind === 'striker' || kind === 'partner')) {
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mat(p.helmet, { rough: 0.35, metal: 0.25 }),
    );
    helm.position.set(0, 0.08, -0.02);
    head.add(helm);
    const grill = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.12, 0.04),
      mat(0x222222, { metal: 0.5, rough: 0.3 }),
    );
    grill.position.set(0, -0.02, 0.24);
    head.add(grill);
  }

  // Legs
  const legMat = mat(p.limb, { rough: 0.65 });
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.45, 6), legMat);
      const z = -0.2 + i * 0.2;
      leg.position.set(side * 0.32, 0.22, z);
      leg.rotation.z = side * (0.55 + i * 0.08);
      leg.rotation.x = (i - 1) * 0.15;
      leg.castShadow = true;
      body.add(leg);
    }
  }

  // Wings / elytra hints
  const wingMat = new THREE.MeshStandardMaterial({
    color: p.belly,
    roughness: 0.2,
    metalness: 0.3,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI),
      wingMat,
    );
    wing.scale.set(0.55, 0.25, 0.9);
    wing.position.set(side * 0.28, 0.7, -0.05);
    wing.rotation.y = side * 0.4;
    wing.rotation.z = side * 0.5;
    body.add(wing);
  }

  if (kind === 'striker' || kind === 'partner') {
    // Pads
    for (const side of [-1, 1]) {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.35, 0.12),
        mat(0xf8f9fa, { rough: 0.8 }),
      );
      pad.position.set(side * 0.16, 0.2, 0.22);
      body.add(pad);
    }
  }

  if (kind === 'striker') {
    const batPivot = new THREE.Group();
    batPivot.name = 'batPivot';
    batPivot.position.set(0.38, 0.55, 0.15);
    body.add(batPivot);

    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.035, 0.35, 8),
      mat(0x5c4033, { rough: 0.7 }),
    );
    handle.position.y = 0.1;
    batPivot.add(handle);

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.55, 0.05),
      mat(0xc4a574, { rough: 0.55 }),
    );
    blade.position.y = -0.28;
    blade.castShadow = true;
    batPivot.add(blade);

    const sticker = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.2, 0.052),
      mat(p.accent, { emissive: p.accent }),
    );
    sticker.position.y = -0.25;
    batPivot.add(sticker);

    // Rest pose: bat cocked
    batPivot.rotation.z = -0.9;
    batPivot.rotation.x = 0.2;
  }

  if (kind === 'bowler') {
    const ballHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      mat(0xd62828, { rough: 0.4 }),
    );
    ballHand.name = 'heldBall';
    ballHand.position.set(0.35, 0.7, 0.15);
    body.add(ballHand);
  }

  root.scale.setScalar(scale);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return root;
}

export function setBatSwing(bug: THREE.Group, t: number): void {
  const pivot = bug.getObjectByName('batPivot');
  if (!pivot) return;
  // 0 idle cocked → 1 follow-through
  const ease = t * t * (3 - 2 * t);
  pivot.rotation.z = -0.9 + ease * 2.5;
  pivot.rotation.x = 0.2 - ease * 0.3;
}

export function setCelebrate(bug: THREE.Group, amount: number, time: number): void {
  const body = bug.getObjectByName('body');
  if (!body) return;
  if (amount <= 0) {
    body.position.y = 0;
    body.rotation.z = 0;
    return;
  }
  body.position.y = Math.abs(Math.sin(time * 10)) * 0.12 * Math.min(1, amount);
  body.rotation.z = Math.sin(time * 8) * 0.12 * Math.min(1, amount);
  const pivot = bug.getObjectByName('batPivot');
  if (pivot) {
    pivot.rotation.z = -1.4 + Math.sin(time * 9) * 0.35;
  }
}

export function setBowlerPhase(bug: THREE.Group, phase: number): void {
  // phase 0..1 run-up to release
  bug.position.y = Math.abs(Math.sin(phase * Math.PI * 4)) * 0.08;
  bug.rotation.x = Math.sin(phase * Math.PI) * 0.15;
  const held = bug.getObjectByName('heldBall');
  if (held) held.visible = phase < 0.98;
}

/**
 * End-to-end running bob + lean. `t` is free-running elapsed time;
 * `intensity` 0 = idle reset, 1 = full sprint.
 */
export function setRunCycle(bug: THREE.Group, t: number, intensity = 1): void {
  const body = bug.getObjectByName('body');
  if (!body) return;
  if (intensity <= 0.001) {
    body.position.y = 0;
    body.rotation.x = 0;
    body.rotation.z = 0;
    return;
  }
  const i = Math.min(1, intensity);
  // Bob frequency scaled with the slower end-to-end run pace (~1.4s)
  body.position.y = Math.abs(Math.sin(t * 11.2)) * 0.1 * i;
  body.rotation.x = -0.12 * i + Math.sin(t * 11.2) * 0.04 * i;
  body.rotation.z = Math.sin(t * 11.2) * 0.08 * i;
}

export type FielderPose = 'idle' | 'alert' | 'chase' | 'dive' | 'throw';

/**
 * Lightweight body language for fielders. Pose drives lean / crouch;
 * `t` animates bob while chasing or celebrating a save.
 */
export function setFielderPose(
  bug: THREE.Group,
  pose: FielderPose,
  t = 0,
  intensity = 1,
): void {
  const body = bug.getObjectByName('body');
  if (!body) return;
  const i = Math.min(1, Math.max(0, intensity));

  switch (pose) {
    case 'idle':
      body.position.y = Math.sin(t * 2) * 0.02;
      body.rotation.x = 0;
      body.rotation.z = 0;
      break;
    case 'alert':
      body.position.y = 0.04 * i;
      body.rotation.x = -0.08 * i;
      body.rotation.z = Math.sin(t * 8) * 0.05 * i;
      break;
    case 'chase':
      body.position.y = Math.abs(Math.sin(t * 16)) * 0.09 * i;
      body.rotation.x = -0.18 * i;
      body.rotation.z = Math.sin(t * 16) * 0.1 * i;
      break;
    case 'dive':
      body.position.y = 0.02;
      body.rotation.x = 0.55 * i;
      body.rotation.z = 0.35 * i;
      break;
    case 'throw':
      body.position.y = 0.06 * i;
      body.rotation.x = -0.25 * i;
      body.rotation.z = -0.15 * i;
      break;
  }
}

/** Reset body offsets after a play so idle stacking stays clean. */
export function resetBugBody(bug: THREE.Group): void {
  const body = bug.getObjectByName('body');
  if (!body) return;
  body.position.y = 0;
  body.rotation.x = 0;
  body.rotation.z = 0;
  bug.position.y = 0;
}

export function createStumps(atBowlerEnd = false): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(0x8b5a2b, { rough: 0.7 });
  for (let i = -1; i <= 1; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.72, 8), wood);
    s.position.set(i * 0.1, 0.36, 0);
    s.castShadow = true;
    g.add(s);
  }
  const bail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.05), wood);
  bail.position.set(0, 0.74, 0);
  g.add(bail);
  g.userData.broken = 0;
  if (atBowlerEnd) g.rotation.y = Math.PI;
  return g;
}

export function breakStumps(stumps: THREE.Group, amount: number): void {
  stumps.children.forEach((c, i) => {
    c.rotation.z = amount * (i - 1) * 0.8;
    c.rotation.x = amount * 0.4;
    c.position.y = Math.max(0.1, 0.36 - amount * 0.15);
  });
}
