import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);

export class EffectsSystem {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.items = [];
    this.engineEmitters = [];
    this.sharedSparkGeo = new THREE.IcosahedronGeometry(0.055, 0);
    this.glowGeo = new THREE.SphereGeometry(0.16, 8, 6);
  }

  disposeObject(root) {
    const disposedMaterials = new Set();
    root.traverse((node) => {
      if (node.geometry && node.geometry !== this.sharedSparkGeo && node.geometry !== this.glowGeo) {
        node.geometry.dispose();
      }
      for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
        if (material && !disposedMaterials.has(material)) {
          disposedMaterials.add(material);
          material.dispose();
        }
      }
    });
  }

  removeEngine(drone) {
    const emitter = this.engineEmitters.find((item) => item.userData.owner === drone);
    if (emitter) {
      emitter.parent?.remove(emitter);
      this.disposeObject(emitter);
      this.engineEmitters = this.engineEmitters.filter((item) => item !== emitter);
    }
  }

  addEngine(drone, color = '#53dfff') {
    const emitter = new THREE.Group();
    drone.add(emitter);
    for (const side of [-1, 1]) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(.16, .9, 10),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      flame.position.set(side * .68, -.16, .98);
      flame.rotation.x = Math.PI;
      flame.scale.set(.65, 1, 1.5);
      emitter.add(flame);

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(.15, 10, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .65, blending: THREE.AdditiveBlending }),
      );
      glow.position.set(side * .68, -.16, .78);
      glow.scale.set(.65, .65, 1.6);
      emitter.add(glow);
      const light = new THREE.PointLight(color, .45, 2.7);
      light.position.copy(glow.position);
      emitter.add(light);
    }
    emitter.userData.owner = drone;
    this.engineEmitters.push(emitter);
    return emitter;
  }

  trail(origin, direction, color, intensity = 1) {
    if (Math.random() > .78) return;
    const mesh = new THREE.Mesh(
      this.sharedSparkGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, blending: THREE.AdditiveBlending }),
    );
    mesh.position.copy(origin).add(new THREE.Vector3((Math.random() - .5) * .7, (Math.random() - .5) * .45, (Math.random() - .5) * .7));
    mesh.scale.setScalar((.45 + Math.random() * .7) * intensity);
    this.root.add(mesh);
    this.items.push({
      mesh,
      velocity: direction.clone().multiplyScalar(-1.5).add(new THREE.Vector3((Math.random() - .5) * .9, -.7 - Math.random(), (Math.random() - .5) * .9)),
      life: .28 + Math.random() * .36,
      max: .64,
      gravity: .7,
    });
  }

  tracer(start, end, color, width = .025, duration = .11) {
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 0.001) return;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(width * .45, width, 1, 6, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
    mesh.scale.y = length;
    this.root.add(mesh);

    const orb = new THREE.Mesh(
      this.glowGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .85, blending: THREE.AdditiveBlending }),
    );
    orb.scale.setScalar(width * 3.5);
    orb.position.copy(end);
    this.root.add(orb);
    this.items.push({ mesh, life: duration, max: duration, fade: true });
    this.items.push({ mesh: orb, life: duration * .8, max: duration * .8, fade: true });
  }

  impact(point, normal, color = '#65eaff', strength = 1) {
    const count = Math.round(12 * strength);
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        this.sharedSparkGeo,
        new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? '#ffffff' : color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending }),
      );
      mesh.position.copy(point);
      mesh.scale.setScalar(.45 + Math.random() * .9);
      this.root.add(mesh);
      const velocity = normal.clone().multiplyScalar(1 + Math.random() * 4)
        .add(new THREE.Vector3((Math.random() - .5) * 5, Math.random() * 4, (Math.random() - .5) * 5));
      this.items.push({ mesh, velocity, life: .22 + Math.random() * .35, max: .57, gravity: 3.7 });
    }
    this.flash(point, color, strength * 3.5, 5 * strength, .13);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(.22, .026, 6, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.position.copy(point);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    this.root.add(ring);
    this.items.push({ mesh: ring, life: .28, max: .28, pulse: true });
  }

  explosion(point, color = '#ffad53', scale = 1) {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(.52, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#fff1c9', transparent: true, opacity: .94, blending: THREE.AdditiveBlending }),
    );
    flash.position.copy(point);
    flash.scale.setScalar(.3);
    this.root.add(flash);
    this.items.push({ mesh: flash, life: .22, max: .22, expand: true });

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(.72, 12, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .72, wireframe: true, blending: THREE.AdditiveBlending }),
    );
    shell.position.copy(point);
    shell.scale.setScalar(.2);
    this.root.add(shell);
    this.items.push({ mesh: shell, life: .5, max: .5, expand: true });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(.65, .045, 8, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .95, blending: THREE.AdditiveBlending }),
    );
    ring.position.copy(point);
    this.root.add(ring);
    this.items.push({ mesh: ring, life: .52, max: .52, expand: true, ring: true });

    for (let i = 0; i < 38; i++) {
      const shard = new THREE.Mesh(
        this.sharedSparkGeo,
        new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? '#fff2bf' : color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending }),
      );
      shard.position.copy(point);
      shard.scale.setScalar(.4 + Math.random() * 1.6);
      this.root.add(shard);
      const velocity = new THREE.Vector3(Math.random() - .5, Math.random() - .35, Math.random() - .5)
        .normalize().multiplyScalar((2 + Math.random() * 9) * scale);
      this.items.push({ mesh: shard, velocity, life: .3 + Math.random() * .55, max: .85, gravity: 2.2 });
    }
    this.flash(point, color, 9 * scale, 14 * scale, .28);
  }

  flash(position, color, intensity, range, duration) {
    const light = new THREE.PointLight(color, intensity, range, 2);
    light.position.copy(position);
    this.root.add(light);
    this.items.push({ mesh: light, life: duration, max: duration, light: true });
  }

  muzzle(position, direction, color, power = 1) {
    const aim = direction.clone().normalize();
    const burst = new THREE.Group();
    burst.position.copy(position);
    burst.quaternion.setFromUnitVectors(FORWARD, aim);

    const makeGlowMaterial = (glowColor, opacity) => new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(.15 * power, 12, 8), makeGlowMaterial('#ffffff', 1));
    core.position.z = -.08 * power;
    core.scale.set(.9, .9, 1.65);
    burst.add(core);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(.23 * power, .82 * power, 9), makeGlowMaterial(color, .94));
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -.4 * power;
    burst.add(flame);

    const hotCore = new THREE.Mesh(new THREE.ConeGeometry(.105 * power, .6 * power, 7), makeGlowMaterial('#ecffff', .98));
    hotCore.rotation.x = -Math.PI / 2;
    hotCore.position.z = -.36 * power;
    burst.add(hotCore);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(.17 * power, .026 * power, 7, 24),
      makeGlowMaterial(color, .95),
    );
    ring.position.z = -.04 * power;
    ring.userData.flashRing = true;
    burst.add(ring);
    this.root.add(burst);
    this.items.push({ mesh: burst, life: .12, max: .12, muzzleFlash: true });

    this.tracer(position, position.clone().addScaledVector(aim, 2.8 * power), color, .045 * power, .085);
    this.flash(position, color, 7 * power, 5 * power, .11);

    const side = new THREE.Vector3().crossVectors(aim, UP);
    if (side.lengthSq() < .01) side.set(1, 0, 0);
    side.normalize();
    for (let i = 0; i < 5; i++) {
      const spark = new THREE.Mesh(
        this.sharedSparkGeo,
        makeGlowMaterial(i % 2 ? color : '#ffffff', .95),
      );
      spark.position.copy(position);
      spark.scale.setScalar(.12 + Math.random() * .1);
      this.root.add(spark);
      const velocity = aim.clone().multiplyScalar(2 + Math.random() * 3)
        .addScaledVector(side, (Math.random() - .5) * 5)
        .add(new THREE.Vector3(0, (Math.random() - .5) * 3, 0));
      this.items.push({ mesh: spark, velocity, life: .08 + Math.random() * .06, max: .14, fade: true });
    }
  }

  update(dt, time = 0, boost = false) {
    for (const emitter of this.engineEmitters) {
      const owner = emitter.userData.owner;
      if (owner) emitter.scale.setScalar(1 + Math.min((owner.userData.speed || 0) / 50, .6));
      for (const child of emitter.children) {
        if (child.isPointLight) child.intensity = boost ? 1.1 : .36;
        else child.material.opacity = boost ? .85 : .43;
        if (child.geometry?.type === 'ConeGeometry') child.scale.set(1, boost ? 1.7 : .72, 1);
      }
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.life -= dt;
      const progress = THREE.MathUtils.clamp(item.life / item.max, 0, 1);
      if (item.velocity) {
        item.mesh.position.addScaledVector(item.velocity, dt);
        if (item.gravity) item.velocity.y -= item.gravity * dt;
      }
      if (item.fade && item.mesh.material) item.mesh.material.opacity = progress;
      if (item.light) item.mesh.intensity *= Math.max(0, 1 - dt * 12);
      if (item.pulse) {
        item.mesh.scale.setScalar(1 + (1 - progress) * 7);
        item.mesh.material.opacity = progress;
      }
      if (item.expand) {
        item.mesh.scale.setScalar(.25 + (1 - progress) * 4.5);
        if (item.mesh.material) item.mesh.material.opacity = progress;
      }
      if (item.muzzleFlash) {
        item.mesh.scale.setScalar(.72 + (1 - progress) * .5);
        item.mesh.traverse((part) => {
          if (part.userData.flashRing) part.scale.setScalar(1 + (1 - progress) * 1.8);
          if (part.material) part.material.opacity = progress;
        });
      }
      if (item.life <= 0) {
        this.root.remove(item.mesh);
        this.disposeObject(item.mesh);
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const item of this.items) {
      this.root.remove(item.mesh);
      this.disposeObject(item.mesh);
    }
    this.items = [];
  }
}
