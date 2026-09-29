import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

export class FlightController {
  constructor(camera, drone, state) {
    this.camera = camera;
    this.drone = drone;
    this.state = state;
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.fovBase = camera.fov;
    this.focus = false;
    this.thirdPerson = false;
    this.lookTarget = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
  }
  reset(position) {
    this.drone.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.camera.position.copy(position);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.fov = this.fovBase;
    this.camera.updateProjectionMatrix();
  }
  look(dx, dy, sensitivity = 0.0021) {
    this.heading -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, -Math.PI * 0.485, Math.PI * 0.485);
  }
  forward() {
    return new THREE.Vector3(-Math.sin(this.heading) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.heading) * Math.cos(this.pitch));
  }
  update(dt, keys, boostAvailable, time) {
    const boostInput = keys.ShiftLeft || keys.ShiftRight;
    const boosted = boostInput && boostAvailable > 0.4;
    const focus = this.focus;
    const maxSpeed = (focus ? 10 : 17) * (boosted ? 1.75 : 1);
    const forward = Number(!!keys.KeyW) - Number(!!keys.KeyS);
    const strafe = Number(!!keys.KeyD) - Number(!!keys.KeyA);
    const lift = Number(!!keys.Space) - Number(!!keys.ControlLeft || !!keys.ControlRight);
    const forwardDir = this.forward();
    const rightDir = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    const input = new THREE.Vector3().addScaledVector(forwardDir, forward).addScaledVector(rightDir, strafe);
    if (input.lengthSq() > 1) input.normalize();
    const target = input.multiplyScalar(maxSpeed);
    target.y = lift * maxSpeed * 0.76;
    const response = forward || strafe || lift ? (boosted ? 3.2 : 5.5) : 2.15;
    this.velocity.lerp(target, 1 - Math.exp(-response * dt));
    const coastSpeed = this.velocity.length();
    this.drone.position.addScaledVector(this.velocity, dt);
    this.drone.position.x = THREE.MathUtils.clamp(this.drone.position.x, -48, 48);
    this.drone.position.z = THREE.MathUtils.clamp(this.drone.position.z, -48, 48);
    this.drone.position.y = THREE.MathUtils.clamp(this.drone.position.y, 2.2, 27);
    this.roll = THREE.MathUtils.damp(this.roll, THREE.MathUtils.clamp(-strafe * 0.24, -0.26, 0.26), 4.5, dt);
    this.drone.rotation.set(this.pitch * 0.58, this.heading, this.roll, 'YXZ');
    const forward3d = this.forward();
    const bob = Math.sin(time * 0.004) * (coastSpeed > 0.2 ? 0.012 : 0.02);
    this.camera.up.copy(this.up);
    const wantedFov = this.focus ? 53 : this.fovBase + (boosted ? 11 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, wantedFov, 5.5, dt);
    this.camera.updateProjectionMatrix();
    if (this.thirdPerson) {
      const behind = new THREE.Vector3(Math.sin(this.heading) * 8.3, 3.2, Math.cos(this.heading) * 8.3);
      this.cameraTarget.copy(this.drone.position).add(behind);
      this.camera.position.lerp(this.cameraTarget, 1 - Math.exp(-8 * dt));
      this.lookTarget.copy(this.drone.position).addScaledVector(forward3d, 4.5);
      this.camera.lookAt(this.lookTarget);
    } else {
      this.camera.position.copy(this.drone.position).addScaledVector(forward3d, .62).add(new THREE.Vector3(0, .16 + bob, 0));
      this.camera.rotation.set(this.pitch, this.heading, this.roll * 0.45, 'YXZ');
    }
    return { boosted, coastSpeed, forward, strafe, lift, focus };
  }
}
