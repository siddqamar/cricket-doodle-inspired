import * as THREE from 'three';
import { FIELD3D } from '../config/constants';

export function buildStadium(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'stadium';

  // Outfield disc
  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(FIELD3D.boundaryR + 2, 64),
    new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.95,
    }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  root.add(grass);

  // Lighter grass ring bands
  for (let i = 0; i < 4; i++) {
    const r0 = 6 + i * 4;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r0, r0 + 1.6, 64),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x40916c : 0x358f63,
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    ring.receiveShadow = true;
    root.add(ring);
  }

  // Pitch strip
  const pitch = new THREE.Mesh(
    new THREE.BoxGeometry(FIELD3D.pitchWidth, 0.04, FIELD3D.pitchHalf * 2),
    new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.9 }),
  );
  pitch.position.y = 0.02;
  pitch.receiveShadow = true;
  root.add(pitch);

  // Crease lines
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f0e6 });
  for (const z of [FIELD3D.stumpStrikerZ - 0.5, FIELD3D.stumpBowlerZ + 0.5]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(FIELD3D.pitchWidth + 0.4, 0.02, 0.06), lineMat);
    line.position.set(0, 0.045, z);
    root.add(line);
  }

  // Boundary rope
  const rope = new THREE.Mesh(
    new THREE.TorusGeometry(FIELD3D.boundaryR, 0.08, 8, 96),
    new THREE.MeshStandardMaterial({
      color: 0xf4d35e,
      emissive: 0xf4d35e,
      emissiveIntensity: 0.15,
      roughness: 0.4,
    }),
  );
  rope.rotation.x = Math.PI / 2;
  rope.position.y = 0.08;
  root.add(rope);

  // Crowd stands (simple colored blocks around)
  const standMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.85 });
  const crowdColors = [0xe76f51, 0xf4d35e, 0x52b788, 0x457b9d, 0xe9c46a, 0xff85a1];
  for (let a = 0; a < Math.PI * 2; a += 0.18) {
    const r = FIELD3D.boundaryR + 3.5;
    const standH = 1.2 + Math.random() * 1.5;
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, standH, 1.2),
      standMat,
    );
    stand.position.set(Math.cos(a) * r, standH / 2, Math.sin(a) * r);
    stand.lookAt(0, stand.position.y, 0);
    root.add(stand);

    // Crowd blobs
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 6),
        new THREE.MeshStandardMaterial({
          color: crowdColors[(k + Math.floor(a * 10)) % crowdColors.length],
          roughness: 0.7,
        }),
      );
      c.position.set(
        Math.cos(a) * (r - 0.3),
        1.1 + k * 0.35 + Math.random() * 0.2,
        Math.sin(a) * (r - 0.3),
      );
      root.add(c);
    }
  }

  // Sky dome (inward)
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(80, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0x7ec8e3,
      side: THREE.BackSide,
    }),
  );
  root.add(sky);

  // Soft ground plane beyond for shadows
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  root.add(ground);

  return root;
}

export function createBall(): THREE.Mesh {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xd62828,
      roughness: 0.45,
      metalness: 0.1,
    }),
  );
  ball.castShadow = true;
  // Seam
  const seam = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.008, 6, 20),
    new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.5 }),
  );
  seam.rotation.x = Math.PI / 2;
  ball.add(seam);
  return ball;
}
