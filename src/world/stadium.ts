import * as THREE from 'three';
import { FIELD3D } from '../config/constants';
import type { SkinDef } from '../config/skins';
import { gradientSkyMaterial, gradientGrassMaterial } from './shaders';

export function buildStadium(skin?: SkinDef): THREE.Group {
  const root = new THREE.Group();
  root.name = 'stadium';

  // Outfield disc with Paper.design inspired grass shader
  const grassMat = skin
    ? gradientGrassMaterial(skin.grassColors.center, skin.grassColors.edge, FIELD3D.boundaryR)
    : new THREE.MeshStandardMaterial({
        color: 0x2d6a4f,
        roughness: 0.95,
      });

  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(FIELD3D.boundaryR + 2, 64),
    grassMat,
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  root.add(grass);

  // Lighter grass ring bands only for default / standard material
  if (!skin) {
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
  const ropeColor = skin?.ropeColor ?? 0xf4d35e;
  const rope = new THREE.Mesh(
    new THREE.TorusGeometry(FIELD3D.boundaryR, 0.08, 8, 96),
    new THREE.MeshStandardMaterial({
      color: ropeColor,
      emissive: ropeColor,
      emissiveIntensity: 0.15,
      roughness: 0.4,
    }),
  );
  rope.name = 'boundaryRope';
  rope.rotation.x = Math.PI / 2;
  rope.position.y = 0.08;
  root.add(rope);

  // Crowd stands (simple colored blocks around)
  const standMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.85 });
  const crowdColors = skin?.crowdColors ?? [0xe76f51, 0xf4d35e, 0x52b788, 0x457b9d, 0xe9c46a, 0xff85a1];
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

    // Stadium flags on top of stands
    if (Math.random() > 0.4) {
      const flagMat = new THREE.MeshBasicMaterial({
        color: crowdColors[Math.floor(a * 5) % crowdColors.length],
        side: THREE.DoubleSide,
      });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), flagMat);
      const flagPos = new THREE.Vector3(Math.cos(a) * r, standH + 0.3, Math.sin(a) * r);
      flag.position.copy(flagPos);
      flag.userData = { isFlag: true, basePos: flagPos, angle: a };
      root.add(flag);
    }

    // Crowd units with animated tags for craze jumping
    for (let k = 0; k < 3; k++) {
      const cColor = crowdColors[(k + Math.floor(a * 10)) % crowdColors.length];
      const c = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 6),
        new THREE.MeshStandardMaterial({
          color: cColor,
          emissive: cColor,
          emissiveIntensity: 0,
          roughness: 0.7,
        }),
      );
      const basePos = new THREE.Vector3(
        Math.cos(a) * (r - 0.3),
        1.1 + k * 0.35 + Math.random() * 0.2,
        Math.sin(a) * (r - 0.3),
      );
      c.position.copy(basePos);
      c.userData = {
        isCrowd: true,
        basePos,
        angle: a,
        tier: k,
        jumpSpeed: 11 + Math.random() * 7,
        phaseOffset: Math.random() * Math.PI * 2,
      };
      root.add(c);
    }
  }

  // Sky dome (inward) with Paper.design inspired sky shader
  const skyMat = skin
    ? gradientSkyMaterial(skin.skyColors.top, skin.skyColors.mid, skin.skyColors.bot)
    : new THREE.MeshBasicMaterial({
        color: 0x7ec8e3,
        side: THREE.BackSide,
      });

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(80, 24, 16),
    skyMat,
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

/** Animates stadium crowd units & flags with craze jumping on boundaries. */
export function animateCrowd(root: THREE.Group, time: number, cheerLevel: number): void {
  const isCrazy = cheerLevel > 0.3;
  const multiplier = isCrazy ? Math.min(2.0, cheerLevel * 1.4) : 0.25;

  root.traverse((obj) => {
    if (obj.userData?.isCrowd) {
      const { basePos, angle, jumpSpeed, phaseOffset } = obj.userData;
      // Stadium wave + craze jumping math
      const wave = Math.sin(time * 5 + angle * 4);
      const craze = Math.abs(Math.sin(time * jumpSpeed + phaseOffset));
      const jumpY = (wave * 0.12 + craze * 0.48) * multiplier;

      obj.position.y = basePos.y + jumpY;

      if (isCrazy) {
        const scalePulse = 1 + Math.sin(time * 16 + phaseOffset) * 0.35 * Math.min(1.5, cheerLevel);
        obj.scale.setScalar(scalePulse);
        const mesh = obj as THREE.Mesh;
        if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).emissive) {
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.abs(Math.sin(time * 10 + angle)) * 0.6 * cheerLevel;
        }
      } else {
        obj.scale.set(1, 1, 1);
        const mesh = obj as THREE.Mesh;
        if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).emissive) {
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        }
      }
    } else if (obj.userData?.isFlag) {
      const { basePos, angle } = obj.userData;
      const wave = Math.sin(time * 12 + angle * 3);
      obj.rotation.y = angle + wave * (isCrazy ? 0.9 : 0.2);
      obj.position.y = basePos.y + (isCrazy ? Math.abs(wave) * 0.35 * cheerLevel : 0);
    }
  });
}

export function createBall(color?: number): THREE.Mesh {
  const ballColor = color ?? 0xd62828;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 12),
    new THREE.MeshStandardMaterial({
      color: ballColor,
      roughness: 0.35,
      metalness: 0.1,
    }),
  );
  ball.castShadow = true;
  return ball;
}
