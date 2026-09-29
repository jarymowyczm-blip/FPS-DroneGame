import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { FlightController } from './movement.js';
import { EffectsSystem } from './effects.js';
import { CombatSystem } from './combat.js';
import { createArena, createDrone, disposeDrone, DRONE_TYPES } from './arena.js';
import { GameUI } from './ui.js';
import { AudioSystem } from './audio.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#091321');
scene.fog = new THREE.FogExp2('#0b1725', 0.0039);
const camera = new THREE.PerspectiveCamera(77, innerWidth / innerHeight, 0.08, 260);
camera.rotation.order = 'YXZ';
scene.add(camera);
scene.add(new THREE.HemisphereLight('#89dfff', '#11152b', 1.8));
scene.add(new THREE.AmbientLight('#41607b', 0.62));
const keyLight = new THREE.DirectionalLight('#c5f5ff', 2.2);
keyLight.position.set(-22, 44, -20);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -62;
keyLight.shadow.camera.right = 62;
keyLight.shadow.camera.top = 62;
keyLight.shadow.camera.bottom = -62;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight('#fc58a6', 0.62);
rimLight.position.set(26, 17, 30);
scene.add(rimLight);
const cameraShake = new THREE.Group();
camera.add(cameraShake);

createArena(scene);
const effects = new EffectsSystem(scene);
const ui = new GameUI();
const audio = new AudioSystem();

const game = {
  mode: 'menu',
  health: 100,
  boost: 100,
  boosting: false,
  damageFlash: 0,
  focus: false,
  keys: Object.create(null),
  mouseDown: false,
  rightMouse: false,
  kills: 0,
  screenShake: 0,
};
const player = createDrone(0, 'blue');  player.position.set(0, 5, 0);
  scene.add(player);
  effects.addEngine(player);
const flight = new FlightController(camera, player, game);
const bots = [];
const roster = [];
const clock = new THREE.Clock();

function makeBot(team, index, pilotName) {
  const kind = team === 'red' ? (index + 1) % DRONE_TYPES.length : (index + 3) % DRONE_TYPES.length;
  const spec = DRONE_TYPES[kind];
  const group = createDrone(kind, team);
  scene.add(group);
  const angle = index * 2.399 + (team === 'red' ? Math.PI : 0);
  const radius = team === 'red' ? 23 : 29;
  group.position.set(Math.cos(angle) * radius, 7 + (index % 4) * 2.5, Math.sin(angle) * radius);
  const turret = new THREE.Group();turret.position.set(0,-.15,-.3);group.add(turret);for(const side of [-1,1]){const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.028,.05,.48,8),new THREE.MeshStandardMaterial({color:'#111a21',metalness:.7,roughness:.28}));barrel.rotation.x=Math.PI/2;barrel.position.set(side*.16,-.1,-.32);turret.add(barrel);const hot=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:team==='red'?'#ff558a':'#61eaff'}));hot.position.set(side*.16,-.1,-.55);turret.add(hot)}group.userData.turret=turret;
  effects.addEngine(group, team === 'blue' ? '#57eaff' : spec.color);
  return {
    group, team, index, kind, spec, pilotName,
    health: spec.health, alive: true, respawn: 0,
    phase: Math.random() * 6, fireTimer: 0.8 + Math.random() * 1.6,
  };
}

const combat = new CombatSystem(scene, camera, effects, (event, bot, target) => {
  if (event === 'hit') { audio.hit(); if (bot) bot.group.userData.hitFlash = 0.16; }
  if (event === 'elimination' && bot) {
    if (game.mode !== 'match') return;
    bot.respawn = 2.4;
    if (bot.team === 'red') game.kills += 1;
    ui.killFeed(target?.pilotName||'YOU',bot.pilotName||bot.spec.name);
    const pilot = roster.find((member) => member.name === bot.pilotName);
    if (pilot) pilot.score += 1;
    audio.explosion();
    ui.toast('DRONE DISABLED  +1 ELIM');
  }
  if (event === 'playerDamage') {
    game.damageFlash = 0.9;
    game.screenShake = Math.max(game.screenShake, 0.16);
    audio.damage();
  }
  if (event === 'reload') {
    audio.reload();
    ui.toast('ENERGY CELL SWAP');
  }
  if (event === 'reloaded') ui.toast('ARC-9 CHARGED');
  if (event === 'botElimination') { audio.explosion(); if (target) { effects.explosion(target.group.position,0xff77a6,.65); ui.killFeed(bot?.pilotName||'ALLY',target.pilotName||target.spec.name); } if (bot) { const pilot=roster.find(member=>member.name===bot.pilotName); if(pilot)pilot.score+=1; } }
  if (event === 'destroyed') endMatch(false);
});

function rosterReset() {
  roster.splice(0, roster.length,
    { name: 'YOU', score: 0, you: true },
    ...['NOVA', 'KITE', 'VEX', 'ECHO', 'ROOK'].map((name) => ({ name, score: 0, you: false })));
}
function resetMatch() {
  effects.clear();
  for (const bot of bots) { effects.removeEngine(bot.group); scene.remove(bot.group); disposeDrone(bot.group); }
  bots.length = 0;
  for (let i = 0; i < 5; i++) bots.push(makeBot('red', i, ['NOVA', 'KITE', 'VEX', 'ECHO', 'ROOK'][i]));
  for (let i = 0; i < 2; i++) bots.push(makeBot('blue', i, 'ALLY-' + (i + 1)));
  combat.reset(bots.filter((bot) => bot.team === 'red'), bots);
  rosterReset();
  game.health = 100;
  game.boost = 100;
  game.boosting = false;
  game.damageFlash = 0;
  game.kills = 0;
  game.screenShake = 0;
  game.rightMouse = false;
  game.mouseDown = false;
  game.thirdPerson = false;
  flight.thirdPerson = false;
  flight.focus = false;
  flight.reset(new THREE.Vector3(0, 5, 3));
  ui.setCamera('fpv');
}

function startMatch() {
  audio.init();
  game.mode = 'countdown';
  player.visible = true;
  game.keys = Object.create(null);
  $('#countdownNumber').textContent = '3';
  resetMatch();
  ui.showMatch();
  ui.countdown(() => {
    if (game.mode === 'countdown') game.mode = 'match';
  });
}
function endMatch(won) {
  if (!['match', 'countdown'].includes(game.mode)) return;
  game.mode = 'end';
  game.paused = false;
  ui.clock(0);
  game.mouseDown = false;
  player.visible = false;
  document.exitPointerLock?.();
  ui.end(won, roster);
}
function togglePause() {
  if (game.mode === 'countdown') { game.mode = 'pause'; ui.pause(); }
  else if (game.mode === 'match') {
    game.mode = 'pause';
    game.mouseDown = false;
    game.rightMouse = false;
    document.exitPointerLock?.();
    ui.pause();
  } else if (game.mode === 'pause') {
    game.mode = 'match';
    ui.resume();
    player.visible = true;
    if (innerWidth > 720) canvas.requestPointerLock?.();
  }
}
function switchCamera() {
  flight.thirdPerson = !flight.thirdPerson;
  ui.setCamera(flight.thirdPerson ? 'chase' : 'fpv');
  ui.toast(flight.thirdPerson ? 'CHASE CAMERA' : 'FPV CAMERA');
}
function aimDirection() { return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize(); }

function updateBot(bot, dt, time) {
  for (const rotor of bot.group.userData.rotors) rotor.rotation.y += dt * 38;
  bot.group.traverse((part) => { if (part.userData.orbit) part.rotation.z += dt * 1.25; });
  const hitFlash = Math.max(0, (bot.group.userData.hitFlash || 0) - dt);
  bot.group.userData.hitFlash = hitFlash;
  if (bot.group.userData.core?.material?.emissiveIntensity !== undefined) bot.group.userData.core.material.emissiveIntensity = hitFlash > 0 ? hitFlash * 5 : 0;
  if (!bot.alive) {
    bot.respawn -= dt;
    if (bot.respawn <= 0) {
      bot.alive = true;
      bot.health = bot.spec.health;
      bot.group.visible = true;
      const angle = Math.random() * Math.PI * 2;
      bot.group.position.set(Math.cos(angle) * 27, 6 + Math.random() * 14, Math.sin(angle) * 27);
    }
    return;
  }

  bot.phase += dt * bot.spec.speed;
  const playerVector = player.position.clone().sub(bot.group.position);
  let target = player.position;
  let distance = playerVector.length();
  if (bot.team === 'blue') {
    const enemy = bots.filter((candidate) => candidate.team === 'red' && candidate.alive)
      .sort((a, b) => a.group.position.distanceTo(bot.group.position) - b.group.position.distanceTo(bot.group.position))[0];
    if (enemy) { target = enemy.group.position; distance = target.distanceTo(bot.group.position); }
  }

  const direction = target.clone().sub(bot.group.position);
  const flatDirection = new THREE.Vector3(direction.x, 0, direction.z);
  if (flatDirection.lengthSq() > 0.01) {
    bot.group.rotation.y = THREE.MathUtils.damp(bot.group.rotation.y, Math.atan2(-flatDirection.x, -flatDirection.z), 2.8, dt);
  }
  const aimTarget = bot.team === 'red' ? player.position : bots.find((candidate) => candidate.team === 'red' && candidate.alive)?.group.position;
  if (aimTarget) { const toTarget=aimTarget.clone().sub(bot.group.position); bot.group.userData.turret?.rotation.set(-Math.atan2(toTarget.y,Math.hypot(toTarget.x,toTarget.z)),Math.atan2(-toTarget.x,-toTarget.z)-bot.group.rotation.y,0); }
  bot.group.position.y = THREE.MathUtils.clamp(bot.group.position.y + Math.sin(time * 0.0018 + bot.phase) * dt * 1.1, 2.6, 26);
  if (distance > 13) bot.group.position.addScaledVector(direction.normalize(), dt * bot.spec.speed * 3.2);
  else {
    bot.group.position.x += Math.cos(bot.phase * 1.3) * dt * 2;
    bot.group.position.z += Math.sin(bot.phase * 1.1) * dt * 2;
  }
  bot.group.position.x = THREE.MathUtils.clamp(bot.group.position.x, -47, 47);
  bot.group.position.z = THREE.MathUtils.clamp(bot.group.position.z, -47, 47);
  bot.fireTimer -= dt;
  if (bot.fireTimer <= 0 && distance < 75 && game.mode === 'match') {
    bot.fireTimer = 1.2 + Math.random() * 1.5;
  }
}

function update(dt, time) {
  if (game.mode !== 'match') return;
  game.focus = game.rightMouse;
  flight.focus = game.focus;
  const motion = flight.update(dt, game.keys, game.boost, time);
  game.boosting = motion.boosted;
  if (game.mouseDown && game.boosting && game.boost > 0) { combat.ammo = Math.min(combat.weapon.capacity, combat.ammo + 5 * dt); combat.reload = 0; }
  game.boost = motion.boosted ? Math.max(0, game.boost - 31 * dt) : Math.min(100, game.boost + 17 * dt);
  audio.boost(game.boosting);
  audio.flight(motion.coastSpeed, game.boosting);

  if (game.mouseDown && !game.boosting) combat.shoot(camera.position.clone(), aimDirection(), game.focus);
  combat.focusOn(game.focus);
  game.drone = player;
  combat.update(dt, game);
  if (game.mode !== 'match') return;
  combat.updateBots(dt, game, bots, effects);
  for (const bot of bots) {
    if (!bot.alive && bot.respawn > 0) { bot.respawn -= dt; if (bot.respawn <= 0) { bot.alive = true; bot.health = bot.spec.health; bot.group.visible = true; const angle=Math.random()*Math.PI*2; bot.group.position.set(Math.cos(angle)*27,6+Math.random()*14,Math.sin(angle)*27); } }
    if (bot.alive) updateBot(bot, dt, time);
  }

  cameraShake.position.set(0, 0, 0);
  player.userData.speed = motion.coastSpeed;
  if (game.screenShake > 0) {
    cameraShake.position.set((Math.random() - 0.5) * game.screenShake * 0.12, (Math.random() - 0.5) * game.screenShake * 0.1, 0);
  }
  const trailDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
  const trailOrigin = player.position.clone().add(new THREE.Vector3(0, -0.28, 0.68).applyQuaternion(player.quaternion));
  effects.trail(trailOrigin, trailDirection, game.boosting ? 0x74f0ff : 0x49d9ff);
  effects.update(dt, time, game.boosting);
  game.damageFlash = Math.max(0, game.damageFlash - dt * 1.4);
  game.screenShake = Math.max(0, game.screenShake - dt * 1.2);
  roster[0].score = game.kills;
  if (game.kills >= 10) { endMatch(true); return; }
  if (combat.timer >= 180) { endMatch(false); return; }
  ui.clock(dt);
  ui.hud(game, combat, roster);
}

function frame(time) {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.04);
  if (game.mode === 'match') update(dt, time);
  else if (game.mode === 'menu') {
    player.position.set(Math.sin(time * 0.0002) * 3, 5 + Math.sin(time * 0.001) * 0.26, -3);
    player.rotation.set(0.05, Math.sin(time * 0.00015) * 0.18, Math.sin(time * 0.0012) * 0.025);
    for (const rotor of player.userData.rotors) rotor.rotation.y += dt * 48;
    camera.position.set(Math.sin(time * 0.00011) * 6, 10, 27);
    camera.lookAt(0, 5, 0);
    effects.update(dt, time, false);
  } else if (game.mode === 'countdown') {
    for (const rotor of player.userData.rotors) rotor.rotation.y += dt * 45;
    effects.update(dt, time, false);
  } else effects.update(dt, time, false);
  renderer.render(scene, camera);
}

ui.onPlay = startMatch;
ui.onResume = togglePause;  ui.onAbort = () => { game.mode = 'menu'; game.mouseDown = false; player.visible = true; ui.showMenu(); document.exitPointerLock?.(); };
ui.onCamera = switchCamera;
ui.onRestart = startMatch;
$('#quitButton').onclick = () => { game.mode = 'menu'; player.visible = true; ui.showMenu(); document.exitPointerLock?.(); };

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
});
window.addEventListener('keydown', (event) => {
  game.keys[event.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();    if (event.code === 'Escape') togglePause();
    if (event.code === 'KeyV' && game.mode === 'match') switchCamera();
    if (event.code === 'KeyR' && game.mode === 'match') combat.reloadWeapon();
  if (event.code === 'Enter' && game.mode === 'menu') startMatch();
});
window.addEventListener('keyup', (event) => { game.keys[event.code] = false; });
canvas.addEventListener('click', () => {
  if (game.mode === 'match' && innerWidth > 720) canvas.requestPointerLock?.();
});
window.addEventListener('mousedown', (event) => {
  if (game.mode !== 'match') return;
  if (event.button === 0) { game.mouseDown = true; if (innerWidth > 720) canvas.requestPointerLock?.(); }
  if (event.button === 2) { game.rightMouse = true; combat.focusOn(true); }
});
window.addEventListener('mouseup', (event) => {
  if (event.button === 0) game.mouseDown = false;
  if (event.button === 2) { game.rightMouse = false; combat.focusOn(false); }
});
window.addEventListener('mousemove', (event) => {
  if (game.mode === 'match' && document.pointerLockElement === canvas) flight.look(event.movementX, event.movementY, game.rightMouse ? 0.00115 : 0.0021);
});
window.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('blur', () => {
  if (game.mode === 'match') togglePause();
  game.keys = Object.create(null);
  game.mouseDown = false;
  game.rightMouse = false;
});
requestAnimationFrame(frame);
