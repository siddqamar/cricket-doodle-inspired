import * as THREE from 'three';
import { glowTrailMaterial } from './shaders';

type Particle = {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
};

const CONFETTI = [0xf4d35e, 0xffffff, 0xe76f51, 0x52b788, 0x7ec8e3, 0xff85a1];

export class Fx3D {
  readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private readonly max: number;

  constructor(max = 120) {
    this.max = max;
    this.group.name = 'fx';
  }

  clear(): void {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles.length = 0;
  }

  burst(pos: THREE.Vector3, color: number, n = 16, reduced = false): void {
    const count = reduced ? Math.ceil(n * 0.35) : n;
    for (let i = 0; i < count; i++) this.spawn(pos, color, 2 + Math.random() * 6, 0.08);
  }

  confetti(pos: THREE.Vector3, n = 40, reduced = false): void {
    const count = reduced ? Math.ceil(n * 0.3) : n;
    for (let i = 0; i < count; i++) {
      const c = CONFETTI[Math.floor(Math.random() * CONFETTI.length)]!;
      this.spawn(pos, c, 4 + Math.random() * 10, 0.1, true);
    }
  }

  private spawn(
    pos: THREE.Vector3,
    color: number,
    speed: number,
    size: number,
    confetti = false,
  ): void {
    if (this.particles.length >= this.max) {
      const old = this.particles.shift()!;
      this.group.remove(old.mesh);
      old.mesh.geometry.dispose();
      (old.mesh.material as THREE.Material).dispose();
    }
    const geo = confetti
      ? new THREE.BoxGeometry(size, size * 0.4, size * 0.15)
      : new THREE.SphereGeometry(size, 6, 6);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, transparent: true }),
    );
    mesh.position.copy(pos);
    const a = Math.random() * Math.PI * 2;
    const elev = confetti ? 0.6 + Math.random() * 0.9 : Math.random() * Math.PI;
    const vel = new THREE.Vector3(
      Math.cos(a) * Math.sin(elev) * speed,
      Math.cos(elev) * speed * (confetti ? 1.2 : 0.8),
      Math.sin(a) * Math.sin(elev) * speed,
    );
    this.group.add(mesh);
    this.particles.push({
      mesh,
      vel,
      life: 0.6 + Math.random() * 0.7,
      maxLife: 1.3,
    });
  }

  /** Spawn glow trail particles behind a fast-moving ball. */
  trail(pos: THREE.Vector3, vel: THREE.Vector3, color: number, reduced = false): void {
    const speed = vel.length();
    if (speed < 8 || reduced) return;
    const count = Math.min(3, Math.floor(speed / 10));
    for (let i = 0; i < count; i++) {
      const trailPos = pos.clone().addScaledVector(vel.clone().normalize(), -i * 0.3);
      this.spawnTrail(trailPos, color, 0.06 - i * 0.015);
    }
  }

  /** Radial trail burst for dramatic moments. */
  trailBurst(pos: THREE.Vector3, color: number, n = 8, reduced = false): void {
    const count = reduced ? Math.ceil(n * 0.3) : n;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const p = pos.clone();
      p.x += Math.cos(a) * 0.3;
      p.z += Math.sin(a) * 0.3;
      this.spawnTrail(p, color, 0.05);
    }
  }

  private spawnTrail(pos: THREE.Vector3, color: number, size: number): void {
    if (this.particles.length >= this.max) {
      const old = this.particles.shift()!;
      this.group.remove(old.mesh);
      old.mesh.geometry.dispose();
      (old.mesh.material as THREE.Material).dispose();
    }
    const geo = new THREE.SphereGeometry(size, 4, 4);
    const mesh = new THREE.Mesh(geo, glowTrailMaterial(color));
    mesh.position.copy(pos);
    this.group.add(mesh);
    this.particles.push({
      mesh,
      vel: new THREE.Vector3(0, 0, 0),
      life: 0.25 + Math.random() * 0.15,
      maxLife: 0.4,
    });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 4;
      p.mesh.rotation.z += dt * 3;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        mat.dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}
