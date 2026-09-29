import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const FORWARD = new THREE.Vector3(0, 0, -1);
const RIGHT = new THREE.Vector3(1, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export class FlightController {
  constructor(camera, drone, state) {
    this.camera = camera;
    this.drone = drone;
    this.state = state;
    this.velocity = new THREE.Vector3();
    this.orientation = new THREE.Quaternion();
    this.rollVelocity = 0;
    this.fovBase = camera.fov;
    this.focus = false;
    this.thirdPerson = false;
    this.lookTarget = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.forwardVector = new THREE.Vector3();
    this.rightVector = new THREE.Vector3();
    this.upVector = new THREE.Vector3();
    this.targetVelocity = new THREE.Vector3();
    this.velocityDelta = new THREE.Vector3();
    this.yawRotation = new THREE.Quaternion();
    this.pitchRotation = new THREE.Quaternion();
    this.rollRotation = new THREE.Quaternion();
  }

  reset(position) {
    this.drone.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.orientation.identity();
    this.rollVelocity = 0;
    this.camera.position.copy(position);
    this.camera.up.copy(WORLD_UP);
    this.camera.quaternion.identity();
    this.camera.fov = this.fovBase;
    this.camera.updateProjectionMatrix();
    this.drone.quaternion.copy(this.orientation);
  }

  look(dx, dy, sensitivity = 0.00235) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

    // Yaw around world-up, then pitch around the craft's local right axis. Using
    // quaternions avoids the Euler pole clamp, so repeated pitches can loop freely.
    this.yawRotation.setFromAxisAngle(WORLD_UP, -dx * sensitivity);
    this.orientation.premultiply(this.yawRotation);
    this.pitchRotation.setFromAxisAngle(RIGHT, -dy * sensitivity);
    this.orientation.multiply(this.pitchRotation).normalize();
  }

  forward() {
    return this.forwardVector.copy(FORWARD).applyQuaternion(this.orientation);
  }

  update(dt, keys, boostAvailable, time) {
    const boostInput = keys.ShiftLeft || keys.ShiftRight;
    const boosted = boostInput && boostAvailable > 0.4;
    const focus = this.focus;
    const maxSpeed = (focus ? 10 : 17) * (boosted ? 1.75 : 1);
    const forwardInput = Number(!!keys.KeyW) - Number(!!keys.KeyS);
    const strafeInput = Number(!!keys.KeyD) - Number(!!keys.KeyA);
    const liftInput = Number(!!keys.Space) - Number(!!keys.ControlLeft || !!keys.ControlRight);
    const rollInput = Number(!!keys.KeyE) - Number(!!keys.KeyQ);

    // Q/E add a damped roll rate around the drone's forward axis; releasing either
    // key eases the rotation to a stop instead of snapping the craft upright.
    this.rollVelocity = THREE.MathUtils.damp(this.rollVelocity, rollInput * 2.1, rollInput ? 5.5 : 3.2, dt);
    if (Math.abs(this.rollVelocity) > 0.0001) {
      this.rollRotation.setFromAxisAngle(FORWARD, this.rollVelocity * dt);
      this.orientation.multiply(this.rollRotation).normalize();
    }

    this.forwardVector.copy(FORWARD).applyQuaternion(this.orientation);
    this.rightVector.copy(RIGHT).applyQuaternion(this.orientation);
    this.targetVelocity.set(0, 0, 0)
      .addScaledVector(this.forwardVector, forwardInput)
      .addScaledVector(this.rightVector, strafeInput)
      .addScaledVector(WORLD_UP, liftInput);
    const hasInput = this.targetVelocity.lengthSq() > 0;
    if (hasInput) this.targetVelocity.normalize().multiplyScalar(maxSpeed);

    // Accelerate toward the requested velocity rather than snapping direction each
    // frame. The craft keeps a little momentum when keys are released for a smoother,
    // more controllable flight feel.
    this.velocityDelta.subVectors(this.targetVelocity, this.velocity);
    const acceleration = boosted ? 34 : focus ? 22 : 27;
    const deceleration = 15;
    const maxChange = (hasInput ? acceleration : deceleration) * dt;
    if (this.velocityDelta.length() > maxChange) this.velocityDelta.setLength(maxChange);
    this.velocity.add(this.velocityDelta);

    const coastSpeed = this.velocity.length();
    this.drone.position.addScaledVector(this.velocity, dt);
    this.drone.position.x = THREE.MathUtils.clamp(this.drone.position.x, -48, 48);
    this.drone.position.z = THREE.MathUtils.clamp(this.drone.position.z, -48, 48);
    this.drone.position.y = THREE.MathUtils.clamp(this.drone.position.y, 2.2, 27);
    this.drone.quaternion.copy(this.orientation);

    this.forwardVector.copy(FORWARD).applyQuaternion(this.orientation);
    this.upVector.set(0, 1, 0).applyQuaternion(this.orientation).normalize();
    const bob = Math.sin(time * 0.004) * (coastSpeed > 0.2 ? 0.012 : 0.02);
    const wantedFov = focus ? 53 : this.fovBase + (boosted ? 11 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, wantedFov, 5.5, dt);
    this.camera.updateProjectionMatrix();

    if (this.thirdPerson) {
      this.cameraTarget.copy(this.drone.position)
        .addScaledVector(this.forwardVector, -8.3)
        .addScaledVector(WORLD_UP, 3.2);
      this.camera.position.lerp(this.cameraTarget, 1 - Math.exp(-8 * dt));
      this.lookTarget.copy(this.drone.position).addScaledVector(this.forwardVector, 4.5);
      this.camera.up.copy(this.upVector);
      this.camera.lookAt(this.lookTarget);
    } else {
      this.camera.position.copy(this.drone.position)
        .addScaledVector(this.forwardVector, 0.62)
        .addScaledVector(this.upVector, 0.16 + bob);
      this.camera.quaternion.copy(this.orientation);
    }

    return { boosted, coastSpeed, forward: forwardInput, strafe: strafeInput, lift: liftInput, roll: rollInput, focus };
  }
}
