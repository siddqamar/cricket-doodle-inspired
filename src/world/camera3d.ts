import * as THREE from 'three';
import { CAM3D } from '../config/constants';
import { clamp, lerp } from '../utils/math';

export type CamPose = {
  pos: readonly [number, number, number] | THREE.Vector3;
  look: readonly [number, number, number] | THREE.Vector3;
  lerp?: number;
  snap?: boolean;
};

function toV3(v: readonly [number, number, number] | THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  if (v instanceof THREE.Vector3) return out.copy(v);
  return out.set(v[0], v[1], v[2]);
}

/**
 * Smooth cinematic camera for the 3D pitch.
 */
export class Camera3D {
  readonly camera: THREE.PerspectiveCamera;
  reducedMotion = false;

  private targetPos = new THREE.Vector3(...CAM3D.rest.pos);
  private targetLook = new THREE.Vector3(...CAM3D.rest.look);
  private curPos = new THREE.Vector3(...CAM3D.rest.pos);
  private curLook = new THREE.Vector3(...CAM3D.rest.look);
  private rate: number = CAM3D.lerp;
  private shake = 0;
  private readonly _shake = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 200);
    this.camera.position.copy(this.curPos);
    this.camera.lookAt(this.curLook);
    this.reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  reset(snap = true): void {
    this.setPose({ pos: CAM3D.rest.pos, look: CAM3D.rest.look, snap, lerp: CAM3D.lerp });
    if (snap) this.shake = 0;
  }

  setPose(pose: CamPose): void {
    toV3(pose.pos, this.targetPos);
    toV3(pose.look, this.targetLook);
    if (this.reducedMotion) {
      // Blend toward rest so motion is gentler
      this.targetPos.lerp(new THREE.Vector3(...CAM3D.rest.pos), 0.55);
      this.targetLook.lerp(new THREE.Vector3(...CAM3D.rest.look), 0.45);
    }
    this.rate = pose.lerp ?? CAM3D.lerp;
    if (pose.snap) {
      this.curPos.copy(this.targetPos);
      this.curLook.copy(this.targetLook);
      this.camera.position.copy(this.curPos);
      this.camera.lookAt(this.curLook);
    }
  }

  addShake(amount: number): void {
    const a = this.reducedMotion ? amount * 0.25 : amount;
    this.shake = Math.max(this.shake, a);
  }

  update(dt: number): void {
    const t = 1 - Math.exp(-this.rate * dt);
    this.curPos.lerp(this.targetPos, t);
    this.curLook.lerp(this.targetLook, t);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 7);
      const m = this.shake * 0.12;
      this._shake.set(
        (Math.random() * 2 - 1) * m,
        (Math.random() * 2 - 1) * m * 0.6,
        (Math.random() * 2 - 1) * m,
      );
    } else {
      this._shake.set(0, 0, 0);
    }

    this.camera.position.copy(this.curPos).add(this._shake);
    this.camera.lookAt(this.curLook);
  }

  /** Track a world point while preserving height bias. */
  follow(point: THREE.Vector3, zoomOut = 0, height = 4): void {
    const dist = lerp(10, 16, clamp(zoomOut, 0, 1));
    this.setPose({
      pos: new THREE.Vector3(point.x + dist * 0.45, height + zoomOut * 5, point.z + dist * 0.55),
      look: new THREE.Vector3(point.x, point.y + 0.5, point.z),
      lerp: CAM3D.hitLerp,
    });
  }
}
