import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// ─── CONSTANTS ───
const RB = {x:28,y:18};
const RP = 45, RS = 1.6;
const SPEED_BASE = 9;

// ─── STATE ───
let sc, cam, ren, comp, ship, grid;
let score=0, fuel=100, fMax=100, ammo=100, aMax=100, lives=3, inv=0;
let hiSc=parseInt(localStorage.getItem('srHS')||'0');
let totalCoins=parseInt(localStorage.getItem('srCoins')||'0');
let wave=0, waveKills=0, waveNeed=0, frame=0;
let gameState = 'intro'; // intro, menu, playing, garage, help, gameover
let combo=0, comboTimer=0, comboMult=1;
let boss=null, bossActive=false;
let nitroActive=false;
let velocity = { x: 0, y: 0 };
const thrust = 0.45;
const friction = 0.92;
let audio=null;
let enemies=[], bullets=[], eBullets=[], parts=[], pickups=[], asteroids=[], orbs=[];
let trailL=[], trailR=[], ribL, ribR, exhaust;
let cx=0, cy=0, firing=false;
const keys={};
let notifs=[], popups=[];
let shake=0, glitch=0;
let shield=0, maxShield=1, shieldTimer=0;
let power=0, powerMax=100, powerMode=false, powerTimer=0;
let hyperCD=0;
let ufo=null, ufoTimer=0;
let starLayers=[], nebClouds=[], dust, planet, ring;
let exTimer=0;

// ─── SOUND ───
const SFX={noise:null,init(){if(!audio)return;const b=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.noise=b;},
play(t,p={}){if(!audio)return;const g=audio.createGain();g.connect(audio.destination);const _=audio.currentTime;
if(t==='las'){const o=audio.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(p.f||800,_);o.frequency.exponentialRampToValueAtTime(40,_+0.1);g.gain.setValueAtTime(0.06,_);g.gain.exponentialRampToValueAtTime(0.001,_+0.1);o.connect(g);o.start();o.stop(_+0.1);}
if(t==='exp'){const s=audio.createBufferSource();s.buffer=this.noise;const f=audio.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(p.f||500,_);g.gain.setValueAtTime(p.v||0.25,_);g.gain.exponentialRampToValueAtTime(0.001,_+0.5);s.connect(f);f.connect(g);s.start();s.stop(_+0.5);}
if(t==='pck'){const o=audio.createOscillator();o.type='sine';o.frequency.setValueAtTime(800,_);o.frequency.linearRampToValueAtTime(1600,_+0.12);g.gain.setValueAtTime(0.08,_);g.gain.exponentialRampToValueAtTime(0.001,_+0.18);o.connect(g);o.start();o.stop(_+0.18);}
if(t==='pow'){const o=audio.createOscillator();o.type='square';o.frequency.setValueAtTime(300,_);o.frequency.linearRampToValueAtTime(1500,_+0.35);g.gain.setValueAtTime(0.1,_);g.gain.exponentialRampToValueAtTime(0.001,_+0.4);o.connect(g);o.start();o.stop(_+0.4);}
if(t==='hit'){const s=audio.createBufferSource();s.buffer=this.noise;const f=audio.createBiquadFilter();f.type='highpass';f.frequency.setValueAtTime(3000,_);g.gain.setValueAtTime(0.12,_);g.gain.exponentialRampToValueAtTime(0.001,_+0.12);s.connect(f);f.connect(g);s.start();s.stop(_+0.12);}
if(t==='wav'){(p.seq||[400,500,600,700]).forEach((f,i)=>{const o=audio.createOscillator();o.type='square';o.frequency.setValueAtTime(f,_+i*0.08);const gg=audio.createGain();gg.gain.setValueAtTime(0.05,_+i*0.08);gg.gain.exponentialRampToValueAtTime(0.001,_+i*0.08+0.12);o.connect(gg);gg.connect(audio.destination);o.start(_+i*0.08);o.stop(_+i*0.08+0.12);});}
}};

// ─── UI HELPERS ───
function showScreen(id) {
    document.querySelectorAll('.game-screen').forEach(s => s.classList.add('hidden'));
    const screen = document.getElementById(id);
    if (screen) screen.classList.remove('hidden');
    const hud = document.getElementById('hud');
    if (id === 'none') { if (hud) hud.classList.remove('hidden'); } else { if (hud) hud.classList.add('hidden'); }
}

function updateGarageUI() {
    const hpLvl = parseInt(localStorage.getItem('upg_hp') || '0');
    const amLvl = parseInt(localStorage.getItem('upg_am') || '0');
    if (document.getElementById('hpLevel')) document.getElementById('hpLevel').textContent = `LVL: ${hpLvl}`;
    if (document.getElementById('ammoLevel')) document.getElementById('ammoLevel').textContent = `LVL: ${amLvl}`;
    if (document.getElementById('totalCoinsDisplay')) document.getElementById('totalCoinsDisplay').textContent = totalCoins;
}

function bootSequence() {
    gameState = 'intro'; showScreen('introScreen');
    const log = document.getElementById('aiLog');
    const lines = ["[SYNC] CONNECTING TO STAR-RAIL...", "[READY] PILOT INTERFACE ACTIVE"];
    let i = 0;
    const interval = setInterval(() => {
        if (i < lines.length) { if (log) log.innerHTML += lines[i] + "<br>"; i++; }
        else { clearInterval(interval); document.getElementById('bootPrompt').style.opacity = 1; document.getElementById('introScreen').onclick = () => { SFX.play('wav', {seq:[600, 800]}); showMenu(); }; }
    }, 600);
}

function showMenu() { gameState = 'menu'; showScreen('startScreen'); if (document.getElementById('totalCoinsDisplay')) document.getElementById('totalCoinsDisplay').textContent = totalCoins; }

function startGame() {
    gameState = 'playing'; showScreen('none'); score = 0; combo = 0; comboMult = 1; velocity = {x:0, y:0};
    const hpLvl = parseInt(localStorage.getItem('upg_hp') || '0');
    const amLvl = parseInt(localStorage.getItem('upg_am') || '0');
    lives = 3 + hpLvl; aMax = 100 + amLvl * 20; ammo = aMax; fuel = 100;
    [...enemies,...bullets,...eBullets,...asteroids,...pickups,...parts,...orbs].forEach(e=>{if(e.parent)sc.remove(e);});
    enemies.length=0;bullets.length=0;eBullets.length=0;asteroids.length=0;pickups.length=0;parts.length=0;orbs.length=0;ufo=null;boss=null;bossActive=false;
    ship.position.set(0,0,0); startWave(0);
}

// ─── VFX ───
function mkRib(c){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(RP*3*2),3));const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0.3,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));m.userData.prev=new THREE.Vector3(0,0,0);return m;}
function initRib(){return Array.from({length:RP},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0}));}
function upRib(m,pts,an,t,dS){const a=m.geometry.attributes.position,N=pts.length;pts[0].x=an.x;pts[0].y=an.y;pts[0].z=an.z;
for(let i=1;i<N;i++){const c=pts[i],p=pts[i-1];const dx=p.x-c.x,dy=p.y-c.y,dz=p.z-c.z,di=Math.sqrt(dx*dx+dy*dy+dz*dz)||.001;const rl=RS*(1+(i/N)*.12),st=di-rl,fo=st*.35;c.vx+=(dx/di)*fo;c.vy+=(dy/di)*fo-.005;c.vz+=(dz/di)*fo;c.vx*=.94;c.vy*=.94;c.vz*=.94;const tf=i/N,fl=.015*tf*tf;c.vx+=Math.sin(t*2.1+i*1.1)*fl;c.vy+=Math.cos(t*1.7+i*.9)*fl*.4;c.x+=c.vx;c.y+=c.vy;c.z+=c.vz;const d2=Math.sqrt((c.x-p.x)**2+(c.y-p.y)**2+(c.z-p.z)**2)||.001;if(d2>RS*2.5){const cl=RS*2.5/d2;c.x=p.x+(c.x-p.x)*cl;c.y=p.y+(c.y-p.y)*cl;c.z=p.z+(c.z-p.z)*cl;c.vx*=.3;c.vy*=.3;c.vz*=.3;}
const r=1-i/N,w=(.6*r+.02)*(.9+.1*Math.sin(t*.5+i*.15));const sx=c.x-p.x,sy=c.y-p.y,sl=Math.sqrt(sx*sx+sy*sy)||.001,px=-sy/sl*w,py=sx/sl*w;a.setXYZ(i*2,c.x-px,c.y-py,c.z);a.setXYZ(i*2+1,c.x+px,c.y+py,c.z);}
a.setXYZ(0,an.x-.08,an.y,an.z);a.setXYZ(1,an.x+.08,an.y,an.z);a.needsUpdate=true;}

function boom(pos,c=0xff00ff,n=20){const g=new THREE.BufferGeometry(),p=new Float32Array(n*3),v=[];for(let i=0;i<n;i++){p[i*3]=pos.x;p[i*3+1]=pos.y;p[i*3+2]=pos.z;const th=Math.random()*Math.PI*2,ph=Math.random()*Math.PI,sp=5+Math.random()*20;v.push(new THREE.Vector3(Math.sin(ph)*Math.cos(th)*sp,Math.sin(ph)*Math.sin(th)*sp,Math.cos(ph)*sp));}g.setAttribute('position',new THREE.BufferAttribute(p,3));const m=new THREE.Points(g,new THREE.PointsMaterial({color:c,size:1.5,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));m.userData={v,age:0,max:45};sc.add(m);parts.push(m);}
function upP(){for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.userData.age++;const pos=p.geometry.attributes.position.array,v=p.userData.v;for(let j=0;j<v.length;j++){pos[j*3]+=v[j].x;pos[j*3+1]+=v[j].y;pos[j*3+2]+=v[j].z;v[j].multiplyScalar(.96);}p.geometry.attributes.position.needsUpdate=true;p.material.opacity=Math.max(0,1-p.userData.age/p.userData.max);if(p.userData.age>=p.userData.max){sc.remove(p);parts.splice(i,1);}}}

function initEx(){const n=25,g=new THREE.BufferGeometry(),p=new Float32Array(n*3),s=new Float32Array(n);g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('size',new THREE.BufferAttribute(s,1));const m=new THREE.Points(g,new THREE.PointsMaterial({color:0xff6600,size:2,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));m.userData.p=Array.from({length:n},()=>({a:false,x:0,y:0,z:0,vx:0,vy:0,vz:0,l:0,mx:12,sz:0}));exhaust=m;sc.add(exhaust);}
function upEx(thr){const ps=exhaust.userData.p,pos=exhaust.geometry.attributes.position.array,sz=exhaust.geometry.attributes.size.array;if(thr){exTimer++;if(exTimer%2===0){const p=ps.find(p=>!p.a);if(p){p.a=true;p.x=ship.position.x;p.y=ship.position.y;p.z=ship.position.z+3;p.vx=(Math.random()-.5)*2;p.vy=(Math.random()-.5)*2;p.vz=2+Math.random()*4;p.l=0;p.mx=10;p.sz=2;}}}
for(let i=0;i<ps.length;i++){const p=ps[i];if(!p.a){pos[i*3]=0;pos[i*3+1]=0;pos[i*3+2]=0;sz[i]=0;continue;}p.l++;p.x+=p.vx;p.y+=p.vy;p.z+=p.vz;p.vx*=.95;p.vy*=.95;const r=p.l/p.mx;pos[i*3]=p.x;pos[i*3+1]=p.y;pos[i*3+2]=p.z;sz[i]=p.sz*(1-r)*2.5;if(p.l>=p.mx)p.a=false;}
exhaust.geometry.attributes.position.needsUpdate=true;exhaust.geometry.attributes.size.needsUpdate=true;}

function createSpeedLines() {
    const container = document.getElementById('speedLinesContainer');
    if (!container) return;
    for (let i = 0; i < 40; i++) {
        const line = document.createElement('div'); line.className = 'speed-line';
        line.style.left = Math.random() * 100 + '%'; line.style.top = Math.random() * 100 + '%';
        line.style.animationDelay = Math.random() * 2 + 's'; container.appendChild(line);
    }
}

// ─── BOSS & ENEMIES ───
function spawnMothership(){
    const geo=new THREE.BoxGeometry(40,15,60);const mat=new THREE.MeshPhongMaterial({color:0x222222,emissive:0xff0000,emissiveIntensity:0.3,wireframe:true});
    boss=new THREE.Mesh(geo,mat);boss.position.set(0,0,-800);boss.userData={hp:100,maxHp:100,type:'boss',shootTimer:0};
    sc.add(boss);bossActive=true;notify('WARNING: BOSS DETECTED','#ff0000');
}

function spawnAsteroid(x,y,sz,type='normal'){const w=wave;let cr=0x888888;const r=sz*3+2;const geo=new THREE.DodecahedronGeometry(r,0);const mat=new THREE.MeshPhongMaterial({color:0x333333,emissive:cr,emissiveIntensity:0.5,wireframe:true});
const m=new THREE.Mesh(geo,mat);m.position.set(x||(Math.random()-.5)*80,y||(Math.random()-.5)*40,-600-Math.random()*300);
m.userData={sz,type,r,hp:sz*2,vx:(Math.random()-.5)*(1+w*0.02),vy:(Math.random()-.5)*(1+w*0.02),speed:3+w*0.3};sc.add(m);asteroids.push(m);}

function spawnEnemy(type){
  const x=(Math.random()-.5)*70,y=(Math.random()-.5)*40;
  let geo,col,hp,sz,spd,mat,aim=null;
  if(type==='chaser'){sz=2.5;geo=new THREE.IcosahedronGeometry(sz,0);col=0xff00ff;hp=1;spd=8;mat=new THREE.MeshPhongMaterial({color:0x333333,emissive:col,emissiveIntensity:0.8,wireframe:true});}
  else if(type==='shooter'){sz=3;geo=new THREE.DodecahedronGeometry(sz,0);col=0x00ff88;hp=2;spd=5;mat=new THREE.MeshPhongMaterial({color:0x003322,emissive:col,emissiveIntensity:0.7,wireframe:true});aim=60;}
  else if(type==='tank'){sz=5;geo=new THREE.OctahedronGeometry(sz,1);col=0xff4400;hp=4;spd=3;mat=new THREE.MeshPhongMaterial({color:0x442200,emissive:col,emissiveIntensity:0.6});}
  const m=new THREE.Mesh(geo,mat);m.position.set(x,y,-800);m.userData={hp,type,speed:spd,col,aimTimer:aim};sc.add(m);enemies.push(m);
}

function spawnUFO(type='large'){
    const side = Math.random() < 0.5 ? -1 : 1;
    const r = type === 'small' ? 3 : 6;
    const geo = new THREE.IcosahedronGeometry(r, 0);
    const mat = new THREE.MeshPhongMaterial({color: type==='small'?0xff00ff:0xffffff, emissive: type==='small'?0xff00ff:0xffffff, emissiveIntensity: 0.5, wireframe: true});
    const m = new THREE.Mesh(geo, mat);
    m.position.set(side * 60, (Math.random() - 0.5) * 30, -300);
    m.userData = { type, hp: type==='small'?1:3, speed: type==='small'?1.2:0.8, side: -side, shootTimer: 0 };
    sc.add(m); ufo = m;
}

// ─── COMBAT ───
function fire(){
  if(ammo<=0)return;if(frame%6!==0)return;
  const laser=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,12),new THREE.MeshBasicMaterial({color:0x00ffff}));
  laser.position.copy(ship.position);laser.userData={v:new THREE.Vector3(0,0,-85)};sc.add(laser);bullets.push(laser);ammo--;SFX.play('las');
}

function enemyFire(e){const b=new THREE.Mesh(new THREE.SphereGeometry(0.5,6,6),new THREE.MeshBasicMaterial({color:0xff4444}));
b.position.copy(e.position);let dir=new THREE.Vector3((ship.position.x-e.position.x)*0.02,(ship.position.y-e.position.y)*0.02,1).normalize();
b.userData={v:dir.multiplyScalar(14)};sc.add(b);eBullets.push(b);}

function takeDamage(){
  if(inv>0)return;
  if(shield>0){shield--;inv=30;shake=10;SFX.play('hit');return;}
  lives--;inv=120;shake=20;power=Math.max(0,power-20);SFX.play('exp');boom(ship.position,0xff3366,40);
  if(lives<=0){
    if(score>hiSc){hiSc=score;localStorage.setItem('srHS',String(hiSc));}
    localStorage.setItem('srCoins', String(totalCoins));
    gameState = 'gameover'; showScreen('gameOverScreen'); document.getElementById('finalScore').textContent = score;
  }
}

function registerKill(pos,val=100){
  score += Math.floor(val * comboMult); waveKills++; combo++; comboTimer = 180; boom(pos,0xff00ff,15); totalCoins += 5;
  if(waveKills>=waveNeed){
    if(wave%5===4&&!bossActive)spawnMothership();
    else { wave++; waveKills=0; waveNeed=8+wave*2; notify(`WAVE ${wave+1}`,'#00ffff'); SFX.play('wav'); }
  }
}

function notify(text,color='#00ffff'){notifs.push({text,color,timer:60});}
function popup(text,color='#ffffff'){popups.push({text,color,life:60});}
function upNotifs(){const e=document.getElementById('n');if(!e)return;if(notifs.length>0){const n=notifs[0];e.textContent=n.text;e.style.color=n.color;e.style.opacity=Math.min(1,n.timer/30);n.timer--;if(n.timer<=0)notifs.shift();}else e.style.opacity=0;}

function ui(){
    const $=id=>document.getElementById(id);
    if($('s'))$('s').textContent=score.toString().padStart(6,'0');
    if($('f'))$('f').style.width=Math.max(0,fuel/fMax*100)+'%';
    if($('a'))$('a').style.width=(ammo/aMax*100)+'%';
    if($('l'))$('l').textContent='♥'.repeat(Math.max(0,lives));
    if($('p'))$('p').textContent=`ENERGY ${Math.floor(power/powerMax*100)}%`;
    if($('w'))$('w').textContent=`WAVE ${wave+1}`;
    if($('k'))$('k').textContent=`${waveKills}/${waveNeed}`;
    if($('comboUI')) {
        if(combo>1){ $('comboUI').style.display='block'; $('comboMult').textContent=comboMult; }
        else $('comboUI').style.display='none';
    }
}

function startWave(n){wave=n;waveKills=0;waveNeed=8+wave*2;notify(`WAVE ${wave+1}`,'#00ffff');SFX.play('wav');const rockCount=2+Math.floor(wave/2);for(let i=0;i<rockCount;i++)spawnAsteroid(null,null,3);}

function hyperDrive(){if(hyperCD>0)return;hyperCD=120;inv=40;glitch=20;boom(ship.position,0x00aaff,30);
ship.position.set((Math.random()-.5)*40,(Math.random()-.5)*20,0);SFX.play('hyp');popup('HYPER!','#00aaff');}

function setupTouch(){const jz=document.getElementById('jz'),jk=document.getElementById('jk'),fb=document.getElementById('fb'),hb=document.getElementById('hb');
if(!jz||!fb)return;jz.addEventListener('touchstart',e=>{e.preventDefault();});
jz.addEventListener('touchmove',e=>{e.preventDefault();const t=e.touches[0],r=jz.getBoundingClientRect(),dx=t.clientX-r.left-r.width/2,dy=t.clientY-r.top-r.height/2,md=40,d=Math.sqrt(dx*dx+dy*dy);cx=d>md?dx/d:dx/md;cy=d>md?-dy/d:-dy/md;if(jk)jk.style.transform=`translate(${Math.max(-md,Math.min(md,dx))}px,${Math.max(-md,Math.min(md,dy))}px)`;});
jz.addEventListener('touchend',e=>{e.preventDefault();cx=0;cy=0;if(jk)jk.style.transform='translate(0px,0px)';});
fb.addEventListener('touchstart',e=>{e.preventDefault();firing=true;});fb.addEventListener('touchend',e=>{e.preventDefault();firing=false;});
if(hb)hb.addEventListener('touchstart',e=>{e.preventDefault();nitroActive=true;});hb.addEventListener('touchend',e=>{e.preventDefault();nitroActive=false;});}

// ─── INIT ───
function init(){
  sc=new THREE.Scene();sc.background=new THREE.Color(0x010105);sc.fog=new THREE.FogExp2(0x010105,0.0005);
  cam=new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,1,10000);
  ren=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true});
  ren.setSize(window.innerWidth,window.innerHeight);ren.setPixelRatio(Math.min(window.devicePixelRatio,2));
  sc.add(new THREE.AmbientLight(0x333333,2));const pl=new THREE.PointLight(0xff00ff,40,1000);pl.position.set(0,200,-100);sc.add(pl);
  const gg=new THREE.PlaneGeometry(5000,8000);const gm=new THREE.ShaderMaterial({uniforms:{uScroll:{value:0},uColor:{value:new THREE.Color(0x00ffff)},uWave:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;uniform float uScroll;uniform vec3 uColor;uniform float uWave;void main(){vec2 uv=vUv;uv.y+=uScroll;float lineX=step(0.995,fract(uv.x*60.0));float lineY=step(0.995,fract(uv.y*100.0));float grid=max(lineX,lineY);vec3 col=mix(uColor,vec3(1.0,0.5,0.0),uWave*0.3);float fade=pow(1.0-vUv.y,6.0);gl_FragColor=vec4(col,grid*fade*1.5);}',transparent:true,side:THREE.DoubleSide});
  grid=new THREE.Mesh(gg,gm);grid.rotation.x=-Math.PI/2;grid.position.y=-100;sc.add(grid);
  [{count:2000,size:0.7,color:0x8888ff,speed:0.3},{count:1200,size:1.5,color:0xffffaa,speed:0.6}].forEach((cfg,i)=>{
    const g=new THREE.BufferGeometry(),p=new Float32Array(cfg.count*3);for(let j=0;j<cfg.count*3;j++)p[j]=(Math.random()-.5)*12000;g.setAttribute('position',new THREE.BufferAttribute(p,3));
    const m=new THREE.Points(g,new THREE.PointsMaterial({color:cfg.color,size:cfg.size,transparent:true,opacity:0.5+i*0.15,blending:THREE.AdditiveBlending,depthWrite:false}));m.userData={speed:cfg.speed};sc.add(m);starLayers.push(m);
  });
  [{count:100,color:0x442266,size:20}].forEach((cfg,i)=>{
    const g=new THREE.BufferGeometry(),p=new Float32Array(cfg.count*3);for(let j=0;j<cfg.count*3;j++){p[j]=(Math.random()-.5)*400;p[j+1]=(Math.random()-.5)*200;p[j+2]=-500-Math.random()*3000;}g.setAttribute('position',new THREE.BufferAttribute(p,3));
    const m=new THREE.Points(g,new THREE.PointsMaterial({color:cfg.color,size:cfg.size,transparent:true,opacity:0.07,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));m.userData={speed:0.15,phase:Math.random()*10};sc.add(m);nebClouds.push(m);
  });
  const sbg=new THREE.BufferGeometry();const sv=new Float32Array([0,0,-3.5,4.5,-0.8,1.2,-4.5,-0.8,1.2,0,0,-3.5,-4.5,-0.8,1.2,0,1.5,1.2,0,0,-3.5,0,1.5,1.2,4.5,-0.8,1.2,4.5,-0.8,1.2,-4.5,-0.8,1.2,0,1.5,1.2]);
  sbg.setAttribute('position',new THREE.BufferAttribute(sv,3));sbg.computeVertexNormals();
  ship=new THREE.Mesh(sbg,new THREE.MeshStandardMaterial({color:0x2266dd,metalness:0.5,roughness:0.3}));ship.add(new THREE.LineSegments(new THREE.EdgesGeometry(sbg),new THREE.LineBasicMaterial({color:0xff00ff})));sc.add(ship);
  ribL=mkRib(0x00ffff);sc.add(ribL);ribR=mkRib(0x00ffff);sc.add(ribR);trailL=initRib();trailR=initRib();initEx();
  cam.position.set(0,22,65);cam.lookAt(0,0,-25);
  window.addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); if (e.code === 'KeyH') hyperDrive(); });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  try{comp=new EffectComposer(ren);comp.addPass(new RenderPass(sc,cam));comp.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight),0.7,0.15,0.5));}catch(e){comp=null;}
  try{audio=new(window.AudioContext||window.webkitAudioContext)();SFX.init();}catch(e){}
  setupTouch(); createSpeedLines();
  document.getElementById('startBtn').onclick = startGame;
  document.getElementById('garageBtn').onclick = () => { showScreen('garageScreen'); updateGarageUI(); };
  document.getElementById('closeGarageBtn').onclick = showMenu;
  document.getElementById('helpBtn').onclick = () => showScreen('helpScreen');
  document.getElementById('closeHelpBtn').onclick = showMenu;
  document.getElementById('restartBtn').onclick = startGame;
  document.getElementById('buyHp').onclick = () => { if (totalCoins >= 500) { totalCoins -= 500; const lvl = parseInt(localStorage.getItem('upg_hp') || '0') + 1; localStorage.setItem('upg_hp', lvl); localStorage.setItem('srCoins', totalCoins); updateGarageUI(); SFX.play('pck'); } };
  document.getElementById('buyAmmo').onclick = () => { if (totalCoins >= 800) { totalCoins -= 800; const lvl = parseInt(localStorage.getItem('upg_am') || '0') + 1; localStorage.setItem('upg_am', lvl); localStorage.setItem('srCoins', totalCoins); updateGarageUI(); SFX.play('pck'); } };
  bootSequence(); animate();
}

// ─── ANIMATE ───
function animate(){
  requestAnimationFrame(animate); const t=performance.now()*0.001; frame++;
  let speed=SPEED_BASE+wave*0.4;
  if(nitroActive&&fuel>5){speed*=2.5;fuel-=0.4;cam.fov=THREE.MathUtils.lerp(cam.fov,95,0.1);document.getElementById('frenzyOverlay').style.display='block';}
  else {cam.fov=THREE.MathUtils.lerp(cam.fov,75,0.1);document.getElementById('frenzyOverlay').style.display='none';}
  cam.updateProjectionMatrix();
  if(grid)grid.material.uniforms.uScroll.value+=0.04;
  starLayers.forEach(l=>{const p=l.geometry.attributes.position.array,sp=l.userData.speed;for(let j=2;j<p.length;j+=3){p[j]+=speed*sp;if(p[j]>200)p[j]=-9800;}l.geometry.attributes.position.needsUpdate=true;});
  nebClouds.forEach(nc=>{const p=nc.geometry.attributes.position.array,sp=nc.userData.speed,ph=nc.userData.phase;for(let j=2;j<p.length;j+=3){p[j]+=speed*sp;p[j-2]+=Math.sin(t*0.1+ph)*0.02;if(p[j]>100){p[j]=-3000-Math.random()*1000;p[j-2]=(Math.random()-.5)*400;}}nc.geometry.attributes.position.needsUpdate=true;});
  if(shake>0)shake*=0.88;
  if(gameState==='playing'){
    if(comboTimer>0){comboTimer--;}else{combo=0;comboMult=1;} comboMult=1+Math.floor(combo/10);
    if(ammo<aMax&&frame%90===0)ammo=Math.min(aMax,ammo+1);
    if(fuel<fMax&&!cx)fuel=Math.min(fMax,fuel+0.015);
    if(frame%Math.max(50,120-wave*3)===0&&!bossActive){
      const r=Math.random(); if(r<0.2)spawnAsteroid(null,null,3); else spawnEnemy(['chaser','shooter','tank'][Math.floor(Math.random()*3)]);
    }

    let inputX=0, inputY=0;
    if(keys['ArrowLeft']||keys['KeyA']) inputX=-1;
    if(keys['ArrowRight']||keys['KeyD']) inputX=1;
    if(keys['ArrowUp']||keys['KeyW']) inputY=1;
    if(keys['ArrowDown']||keys['KeyS']) inputY=-1;
    if(cx||cy){ inputX=cx; inputY=cy; }

    if(inputX !== 0 || inputY !== 0) {
        velocity.x += inputX * thrust;
        velocity.y += inputY * thrust;
        fuel = Math.max(0, fuel - 0.05);
    }
    velocity.x *= friction; velocity.y *= friction;
    ship.position.x += velocity.x; ship.position.y += velocity.y;
    if (ship.position.x < -RB.x) { ship.position.x = -RB.x; velocity.x = 0; }
    if (ship.position.x > RB.x) { ship.position.x = RB.x; velocity.x = 0; }
    if (ship.position.y < -RB.y) { ship.position.y = -RB.y; velocity.y = 0; }
    if (ship.position.y > RB.y) { ship.position.y = RB.y; velocity.y = 0; }

    ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, -velocity.x * 0.15, 0.1);
    ship.rotation.x = THREE.MathUtils.lerp(ship.rotation.x, -velocity.y * 0.1, 0.1);
    upEx(inputX||inputY); cam.lookAt(ship.position.x*0.3,ship.position.y*0.3,-25);
    upRib(ribL,trailL,new THREE.Vector3(ship.position.x-4.5,ship.position.y,ship.position.z+1),t,new THREE.Vector3()); upRib(ribR,trailR,new THREE.Vector3(ship.position.x+4.5,ship.position.y,ship.position.z+1),t,new THREE.Vector3());
    
    if(keys['Space']||firing)fire();

    if(ufo) {
        ufo.position.x += ufo.userData.side * ufo.userData.speed;
        ufo.position.y += Math.sin(frame * 0.05) * 0.2;
        ufo.userData.shootTimer++;
        if(ufo.userData.shootTimer > 80) { enemyFire(ufo); ufo.userData.shootTimer = 0; }
        if(Math.abs(ufo.position.x) > 80) { sc.remove(ufo); ufo = null; }
        if(ufo && ship.position.distanceTo(ufo.position) < 10) { takeDamage(); sc.remove(ufo); ufo = null; }
    } else {
        ufoTimer++; if(ufoTimer > 800) { spawnUFO(Math.random() < 0.3 ? 'small' : 'large'); ufoTimer = 0; }
    }

    for(let i=bullets.length-1;i>=0;i--){
      const b=bullets[i];b.position.add(b.userData.v); if(b.position.z<-1200){sc.remove(b);bullets.splice(i,1);continue;}
      for(let j=asteroids.length-1;j>=0;j--){
        const a=asteroids[j]; if(b.position.distanceTo(a.position)<a.userData.r+2){
          a.userData.hp--; if(a.userData.hp<=0){ sc.remove(a);asteroids.splice(j,1);registerKill(a.position,100); }
          sc.remove(b);bullets.splice(i,1);break;
        }
      }
    }
    for(let i=eBullets.length-1;i>=0;i--){ eBullets[i].position.add(eBullets[i].userData.v); if(eBullets[i].position.z>100){sc.remove(eBullets[i]);eBullets.splice(i,1);} else if(eBullets[i].position.distanceTo(ship.position)<3.5){takeDamage();sc.remove(eBullets[i]);eBullets.splice(i,1);} }
    for(let i=asteroids.length-1;i>=0;i--){ const a=asteroids[i];a.position.z+=speed*0.5; if(a.position.distanceTo(ship.position)<a.userData.r+3){ if(nitroActive){registerKill(a.position,50);sc.remove(a);asteroids.splice(i,1);shake=5;}else{takeDamage();sc.remove(a);asteroids.splice(i,1);}} else if(a.position.z>200){sc.remove(a);asteroids.splice(i,1);} }
    for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; e.position.z+=e.userData.speed||speed; if(e.position.distanceTo(ship.position)<4.5){takeDamage();sc.remove(e);enemies.splice(i,1);} else if(e.position.z>150){sc.remove(e);enemies.splice(i,1);} }
    if(bossActive){ boss.position.z = THREE.MathUtils.lerp(boss.position.z, -200, 0.01); boss.rotation.y += 0.01; if(frame%60===0)enemyFire(boss); if(boss.userData.hp<=0){ registerKill(boss.position,5000); sc.remove(boss); bossActive=false; wave++; notify('BOSS DESTROYED'); } }
    if(inv>0){inv--;ship.visible=frame%6<3;}else ship.visible=true;
  }
  upP();upNotifs();ui();
  try{comp?comp.render():ren.render(sc,cam);}catch(e){ren.render(sc,cam);}
}
init();
