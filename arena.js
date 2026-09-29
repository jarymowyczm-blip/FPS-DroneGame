import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const M=(color,roughness=.35,metalness=.55,emissive=null,intensity=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness,emissive:emissive||color,emissiveIntensity:intensity});
function addMesh(parent,geometry,material,pos=[0,0,0],scale=[1,1,1]){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...pos);mesh.scale.set(...scale);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
const sharedArena={};
function arenaMaterial(color,roughness=.35,metalness=.55,emissive=null,intensity=0){const key=[color,roughness,metalness,emissive,intensity].join('|');return sharedArena[key]??(sharedArena[key]=M(color,roughness,metalness,emissive,intensity))}
function box(parent,pos,size,material){return addMesh(parent,new THREE.BoxGeometry(...size),material,pos)}
function neon(parent,pos,color,radius=.045){const mesh=addMesh(parent,new THREE.TorusGeometry(radius,.012,6,18),arenaMaterial(color,.22,.65,color,2),pos);return mesh}
export function createArena(scene){
  const arena=new THREE.Group();scene.add(arena);
  const materials={floor:arenaMaterial('#101e2c',.48,.55),floorDark:arenaMaterial('#09131f',.62,.35),metal:arenaMaterial('#1e3040',.28,.8),wall:arenaMaterial('#152335',.38,.72),glass:new THREE.MeshPhysicalMaterial({color:'#6cecff',metalness:.22,roughness:.12,transparent:true,opacity:.17,transmission:.55,thickness:.6}),cyan:arenaMaterial('#5beaff',.2,.5,'#34ddff',2.4),pink:arenaMaterial('#fa5595',.2,.5,'#ff367b',2.5),lime:arenaMaterial('#d8ff54',.19,.45,'#bfff38',2),white:arenaMaterial('#d6f8ff',.21,.7,'#b9f5ff',.8),dark:arenaMaterial('#060b12',.72,.2)};
  const floor=addMesh(arena,new THREE.PlaneGeometry(150,150),materials.floor,[0,-.35,0]);floor.rotation.x=-Math.PI/2;
  const under=addMesh(arena,new THREE.PlaneGeometry(150,150),arenaMaterial('#091321',.68,.38),[0,-.38,0]);under.rotation.x=-Math.PI/2;
  const floorLines=new THREE.GridHelper(150,30,0x1ec9e8,0x173147);floorLines.position.y=-.31;floorLines.material.transparent=true;floorLines.material.opacity=.16;arena.add(floorLines);
  const floorDecals=new THREE.Group();arena.add(floorDecals);for(let x=-60;x<=60;x+=12)for(let z=-60;z<=60;z+=12){const material=arenaMaterial((Math.abs(x/12+z/12)%2)?'#132235':'#172a3a',.65,.5);addMesh(floorDecals,new THREE.PlaneGeometry(11.4,11.4),material,[x,-.295,z]).rotation.x=-Math.PI/2;}
  const grid=new THREE.GridHelper(120,60,0x3de8ff,0x1e4057);grid.position.y=-.32;grid.material.transparent=true;grid.material.opacity=.28;arena.add(grid);
  const platform=(x,z,w,d,y,accent)=>{const top=box(arena,[x,y,z],[w,.58,d],materials.metal);box(arena,[x,y-.36,z],[w*.92,.15,d*.92],materials.dark);for(const side of [-1,1]){box(arena,[x+side*w*.48,y+.31,z],[.045,.035,d*.92],accent);box(arena,[x,y+.31,z+side*d*.48],[w*.92,.035,.045],accent);const underGlow=addMesh(arena,new THREE.BoxGeometry(w*.76,.025,d*.76),arenaMaterial('#122735',.44,.62,'#36d9ed',.6),[x,y-.47,z]);for(let edge=-1;edge<=1;edge+=2){box(arena,[x+edge*w*.3,y+.293,z],[w*.055,.009,d*.78],materials.wall);box(arena,[x,y+.293,z+edge*d*.3],[w*.78,.009,d*.055],materials.wall)}underGlow.material.transparent=true;underGlow.material.opacity=.5}return top};
  // High and low platforms form a flowing three-dimensional circuit.
  platform(0,0,14,14,0,materials.cyan);platform(-23,-11,18,13,5.8,materials.pink);platform(22,-13,17,15,8.5,materials.cyan);platform(-24,19,19,14,10,materials.cyan);platform(23,20,20,16,5.3,materials.pink);platform(0,-31,19,12,6.7,materials.lime);platform(0,33,20,13,3.6,materials.cyan);platform(-4,1,48,5,3.5,materials.pink);platform(1,-3,5,36,2.1,materials.cyan);
  // Ring bridges and catwalks.
  for(const [x,z,y,w,d,c] of [[-11,-11,2.1,11,1.5,materials.cyan],[12,-10,3.2,1.5,14,materials.pink],[-10,15,5.8,14,1.4,materials.cyan],[11,17,2.4,1.5,13,materials.pink]]){box(arena,[x,y,z],[w,.35,d],materials.wall);box(arena,[x,y+.2,z],[w,.035,.045],c)}
  // Triangular arch gantries frame the skyline and lead the eye through the level.
  const beamBetween=(a,b,r,material)=>{const vA=new THREE.Vector3(...a),vB=new THREE.Vector3(...b),dir=vB.clone().sub(vA),o=addMesh(arena,new THREE.CylinderGeometry(r,r,dir.length(),8),material,vA.clone().add(vB).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return o};
  for(const [cx,cz,y,size,color] of [[-24,0,18,11,materials.cyan],[24,0,22,13,materials.pink],[0,-32,21,12,materials.cyan],[0,34,18,10,materials.pink]]){const a=[cx-size,y-size*.45,cz],b=[cx,y+size*.55,cz],c=[cx+size,y-size*.45,cz];beamBetween(a,b,.27,materials.metal);beamBetween(b,c,.27,materials.metal);beamBetween(c,a,.27,materials.metal);beamBetween(a,c,.08,color);neon(arena,b,color,.42)}
  // Floating cover pods, air rails, illuminated pillars, and glass fins.
  for(let i=0;i<16;i++){const angle=i/16*Math.PI*2,r=31+(i%2)*5,x=Math.cos(angle)*r,z=Math.sin(angle)*r,y=2+(i%4)*3.2;const color=i%2?materials.cyan:materials.pink;const pillar=box(arena,[x,y,z],[2.2,3.3,2.2],materials.wall);pillar.rotation.y=angle;const gl=box(arena,[x,y,z],[2.26,.055,2.26],color);gl.rotation.y=angle;const shield=addMesh(arena,new THREE.BoxGeometry(2.5,3.8,.12),materials.glass,[x,y,z]);shield.rotation.y=angle;box(arena,[x,y+1.72,z],[2.65,.08,.22],color).rotation.y=angle;}
  for(let i=0;i<12;i++){const a=i*Math.PI/6,r=42,x=Math.cos(a)*r,z=Math.sin(a)*r;const p=addMesh(arena,new THREE.CylinderGeometry(.32,.7,18+(i%3)*2,8),materials.metal,[x,8,z]);const band=addMesh(arena,new THREE.TorusGeometry(.74,.065,8,18),i%2?materials.cyan:materials.pink,[x,12,z]);band.rotation.x=Math.PI/2;const light=new THREE.PointLight(i%2?'#38dff9':'#ff478d',1.4,12);light.position.set(x,14,z);arena.add(light)}
  // Neon map sign, floating hologram rings and light towers.
  const holo=new THREE.Group();holo.position.set(0,13,-29);arena.add(holo);for(let i=0;i<3;i++){let ring=addMesh(holo,new THREE.TorusGeometry(4+i*1.3,.035,6,72),new THREE.MeshBasicMaterial({color:i%2?'#ff5b98':'#62efff',transparent:true,opacity:.76,blending:THREE.AdditiveBlending}),[0,i*.5,0]);ring.rotation.x=i*Math.PI/5}const beacon=new THREE.PointLight('#55e7ff',8,42);beacon.position.set(0,14,-29);arena.add(beacon);
  const lampPositions=[[-18,9,-15],[18,12,-18],[-20,14,18],[19,10,22],[0,17,4]];lampPositions.forEach(([x,y,z],i)=>{const color=i%2?'#ff4a91':'#4deaff';for(let side of [-1,1]){const bar=box(arena,[x+side*1.9,y,z],[.08,.08,2],i%2?materials.pink:materials.cyan);bar.rotation.z=side*.22}const l=new THREE.SpotLight(color,34,48,.53,.7,1.3);l.position.set(x,y,z);l.target.position.set(x,-.3,z);arena.add(l,l.target)});
  // Elegant sparse star/dust field and thin boundary rays.
  const points=new Float32Array(1250*3);for(let i=0;i<1250;i++){points[i*3]=(Math.random()-.5)*145;points[i*3+1]=Math.random()*58+3;points[i*3+2]=(Math.random()-.5)*145}const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(points,3));arena.add(new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#b8eaff',size:.075,transparent:true,opacity:.44,sizeAttenuation:true})));
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2,x=Math.cos(a)*55,z=Math.sin(a)*55;beamBetween([x,0,z],[x,15,z],.025,i%2?materials.cyan:materials.pink)}
  return arena;
}
const DRONE_TYPES=[
 {name:'WRAITH',role:'INTERCEPTOR',color:'#4ce9ff',shape:'dart',speed:1.3,health:84},
 {name:'BULWARK',role:'HEAVY FRAME',color:'#ff4f89',shape:'heavy',speed:.65,health:155},
 {name:'SPECTER',role:'GHOST CLASS',color:'#a48aff',shape:'wing',speed:1.05,health:105},
 {name:'VIPER',role:'STRIKE CRAFT',color:'#caff48',shape:'quad',speed:1.12,health:112},
 {name:'NOMAD',role:'RECON FLIGHT',color:'#ffb94a',shape:'ring',speed:1.2,health:92},
 {name:'SENTINEL',role:'GUARD PLATFORM',color:'#ff7070',shape:'tank',speed:.78,health:135}
];
export function disposeDrone(group){const materialCache=new Set();group.traverse(node=>{if(node.geometry)node.geometry.dispose();if(node.material){for(const material of (Array.isArray(node.material)?node.material:[node.material])){if(!materialCache.has(material)){materialCache.add(material);material.dispose()}}}})}
export function createDrone(kind=0,team='red'){
  const spec=DRONE_TYPES[kind%DRONE_TYPES.length],group=new THREE.Group(),ally=team==='blue',glowColor=ally?'#71e9ff':spec.color;
  const dark=M(ally?'#102538':'#1a1929',.29,.78),armor=M(ally?'#24617b':'#3e314b',.28,.72),trim=M(glowColor,.2,.7,glowColor,1.25),glass=new THREE.MeshPhysicalMaterial({color:ally?'#76f7ff':glowColor,emissive:glowColor,emissiveIntensity:.34,metalness:.58,roughness:.12,clearcoat:1,clearcoatRoughness:.1}),black=M('#070c14',.42,.55);
  const add=(g,m,p,s)=>addMesh(group,g,m,p,s),rotors=[],weaponMuzzles=[];
  add(new THREE.CylinderGeometry(.42,.5,.2,12),dark,[0,0,0],[1,1,.72]);
  const core=add(new THREE.SphereGeometry(.56,24,16),armor,[0,.04,0],[1.25,.48,.88]);
  add(new THREE.BoxGeometry(.55,.14,.7),dark,[0,-.13,.08]);
  const cockpit=add(new THREE.SphereGeometry(.25,18,12),glass,[0,.17,-.28],[1,.62,.7]);
  add(new THREE.TorusGeometry(.26,.035,7,28),trim,[0,.17,-.29]);
  add(new THREE.BoxGeometry(.12,.06,.2),black,[0,.23,-.42]);
  add(new THREE.SphereGeometry(.085,12,10),trim,[0,.25,-.52],[1,1,.45]);
  const battery=add(new THREE.BoxGeometry(.32,.2,.43),black,[0,-.2,.25]);
  for(let side of [-1,1]){
    const arm=add(new THREE.BoxGeometry(spec.shape==='heavy'?1.8:1.35,.105,.16),dark,[side*.72,.02,0]);arm.rotation.y=side*.17;
    const strut=add(new THREE.CylinderGeometry(.035,.06,.6,8),trim,[side*.49,-.19,.13]);strut.rotation.z=side*.52;
    for(let z of [-1,1]){
      const x=side*(spec.shape==='heavy'?1.26:1.02),zz=z*(spec.shape==='heavy'?.91:.72);
      add(new THREE.CylinderGeometry(.15,.21,.16,12),armor,[x,.04,zz]);
      add(new THREE.CylinderGeometry(.09,.12,.09,12),trim,[x,.16,zz]);
      const rotorGroup=new THREE.Group();rotorGroup.position.set(x,.225,zz);group.add(rotorGroup);
      addMesh(rotorGroup,new THREE.BoxGeometry(.68,.025,.065),trim,[0,0,0]);const blade=addMesh(rotorGroup,new THREE.BoxGeometry(.55,.018,.055),trim,[0,0,0]);blade.rotation.y=Math.PI/2;rotors.push(rotorGroup);
      const strutFoot=add(new THREE.CylinderGeometry(.025,.03,.24,8),dark,[x,-.17,zz]);
      add(new THREE.SphereGeometry(.052,10,8),new THREE.MeshBasicMaterial({color:side===1?'#ff4565':'#55e9ff'}),[x,.01,zz]);
      const led=new THREE.PointLight(side===1?'#ff4165':'#54eaff',ally?.65:1,2.5);led.position.set(x,.02,zz);group.add(led);
    }
  }
  // Distinct silhouettes: top fin, ring guard, wing plates, or heavier armor.
  if(spec.shape==='dart'){const fin=add(new THREE.ConeGeometry(.34,.86,4),trim,[0,.39,.25]);fin.rotation.x=Math.PI/2;fin.rotation.z=Math.PI/4;add(new THREE.BoxGeometry(.1,.4,.62),armor,[0,.15,.48])}
  if(spec.shape==='heavy'||spec.shape==='tank'){for(let side of [-1,1]){const pod=add(new THREE.BoxGeometry(.52,.26,.8),armor,[side*.58,-.18,.27]);pod.rotation.y=side*.13;add(new THREE.BoxGeometry(.57,.04,.69),trim,[side*.58,-.03,.28])}add(new THREE.SphereGeometry(.57,16,12),armor,[0,.06,.13],[1.38,.5,1.06])}
  if(spec.shape==='wing'){for(let side of [-1,1]){let wing=add(new THREE.ConeGeometry(.58,1.2,4),armor,[side*.76,0,-.06]);wing.rotation.z=side*Math.PI/2;wing.rotation.y=side*.08;add(new THREE.BoxGeometry(.1,.08,.85),trim,[side*.94,.07,.02])}}
  if(spec.shape==='ring'){let ring=add(new THREE.TorusGeometry(1.6,.095,10,40),trim,[0,0,0]);ring.userData.orbit=true;ring.rotation.x=.16;for(let i=0;i<4;i++){let a=i*Math.PI/2;let brace=add(new THREE.BoxGeometry(1.4,.07,.07),armor,[Math.cos(a)*.7,0,Math.sin(a)*.7]);brace.rotation.y=-a}}
  if(spec.shape==='quad'){for(let i=0;i<4;i++){let a=Math.PI*.25+i*Math.PI/2;const blade=add(new THREE.BoxGeometry(.17,.1,1.55),armor,[Math.cos(a)*.8,0,Math.sin(a)*.8]);blade.rotation.y=-a}}
  // Two articulated cannons with heated muzzle collars.
  for(let side of [-1,1]){const barrel=add(new THREE.CylinderGeometry(.045,.085,.5,12),dark,[side*.2,-.11,-.59]);barrel.rotation.x=Math.PI/2;const collar=add(new THREE.CylinderGeometry(.09,.09,.11,12),trim,[side*.2,-.11,-.85]);collar.rotation.x=Math.PI/2;const lens=add(new THREE.SphereGeometry(.06,10,8),new THREE.MeshBasicMaterial({color:glowColor}),[side*.2,-.11,-.92]);weaponMuzzles.push(lens)}
  // Sensor gimbal.
  const neck=add(new THREE.CylinderGeometry(.08,.11,.21,10),black,[0,-.25,-.29]);neck.rotation.x=.3;const gimbal=add(new THREE.Group(),dark,[0,-.36,-.36]);addMesh(gimbal,new THREE.SphereGeometry(.22,16,12),glass,[0,0,0],[1,1,.9]);for(let side of [-1,1])addMesh(gimbal,new THREE.BoxGeometry(.16,.09,.36),trim,[side*.25,0,0]);
  const engine= new THREE.PointLight(glowColor,2.1,5);engine.position.set(0,-.1,.67);group.add(engine);
  group.userData={kind,spec,team,rotors,weaponMuzzles,engine,core,battery,hitMeshes:[core,cockpit,...weaponMuzzles],gimbal};return group;
}
export {DRONE_TYPES};
