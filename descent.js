// The descent and the wave, from the pilot's seat.
// Everything here is drawn and synthesised for this page: the lander ("Heron", a flying boat with a glass nose), its cockpit, the
// companion ("WREN", a ball in a gimbal that rolls out in a hoop to scout) and every sound. flight.js holds the physics, cockpit.js
// the shapes, diorama.js the wide model view; this file shows it, lights it, sounds it, shakes it and cuts between views.
import { createFlight, FL, shakeOf } from './flight.js';
import { buildLander, buildHoop, drawDisplay, BC, BR, PANEL } from './cockpit.js';
import { createDiorama, BLOCKS } from './diorama.js';

export function createDescent(ctx) {
  const { THREE, scene, camera, renderer, state, W, waterH, C, HMAX, GRAV, DAY, SKY, sky, sun, hemi, glow, SUN_DIR, particles, spray, mist, white, wake,
    say, hint, fade, SFX, XR, rig, xrCam, vign, panel, COARSE, V, clamp, lerp, smooth, wash, craft, waterMats, floorMat, placeWorld, buzzOK, Q } = ctx;
  const flight = createFlight({ g: GRAV, C, HMAX, W, waterH, prof: ctx.prof, envX: ctx.envX, zOff: ctx.zOff });
  const L = flight.L;
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const K = buildLander({ THREE, V, wash, COARSE });
  const { ship, stick, lever, inst, ic, iTex, ghost, wren, wrenBall, wrenRing, wrenEye, lights, lightIx, setToggle, toggleIx, tState, sway, bodyMeshes, needleArm, handR, handL } = K;
  scene.add(ship);
  const ig = ic.getContext('2d');
  const SUN0 = SUN_DIR.clone(), SUNCOL0 = sun.color.clone(), _v = V(), _v2 = V(), _q = new THREE.Quaternion();
  let quality = COARSE ? 1 : 0;

  // ---------- the glass, from inside: rain beads that slide down when slow and are blown back in streaks when fast, mist in the cloud,
  // a sheet of sea water after the splash that drains from the top, the sun's glare, and a faint sheen at grazing angles ----------
  const glass = new THREE.Mesh(new THREE.SphereGeometry(BR - 0.05, 48, 32), new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uRain: { value: 0 }, uSpeed: { value: 0 }, uWash: { value: 0 }, uDrain: { value: 1 }, uHeat: { value: 0 }, uFog: { value: 0 }, uFlash: { value: 0 },
      uSun: { value: V(0, 0.3, 1) }, uSunI: { value: 0 }, uLit: { value: 1 }, uEye: { value: V(...FL.EYE).sub(V(...BC)) }, uQ: { value: COARSE ? 0 : 1 }, uSide: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime, uRain, uSpeed, uWash, uDrain, uHeat, uFog, uFlash, uSunI, uLit, uQ, uSide; uniform vec3 uSun, uEye; varying vec3 vP;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y); }
      float streak(vec2 p){ return smoothstep(0.6, 0.86, vn(vec2(p.x, p.y * 0.22))) * (0.5 + 0.5 * vn(vec2(p.x * 2.3 + 7.0, p.y * 0.6 + 3.0))); }
      // one layer of beads in cells: x = dome, y = rim, z = highlight. Each column slides at its own pace (flow along +y of p).
      vec3 beads(vec2 p, float dens, float seed, float slide, float stretch){
        float col = floor(p.x); p.y += slide * (0.35 + 0.65 * h2(vec2(col, seed)));
        vec2 i = floor(p), f = fract(p);
        float pres = h2(i + seed), r2 = h2(i + seed + 7.1);
        vec2 c = vec2(0.3 + 0.4 * h2(i + seed + 3.3), 0.3 + 0.4 * h2(i + seed + 5.7));
        float rad = mix(0.1, 0.3, r2 * r2);
        vec2 d = (f - c) / rad; d.y /= stretch;
        float q = dot(d, d), on = step(pres, dens) * step(q, 1.0);
        float rim = on * smoothstep(0.45, 1.0, q) * smoothstep(-0.2, 0.6, d.y + 0.2);
        float hl = on * (1.0 - smoothstep(0.0, 0.35, length(d - vec2(-0.32, -0.38))));
        return vec3(on * (1.0 - q), rim, hl);
      }
      void main(){
        vec3 d = normalize(vP);
        float th = acos(clamp(d.z, -1.0, 1.0)), az = atan(d.x, d.y);
        float fast = smoothstep(0.05, 0.35, uSpeed);
        // streaks: slow, the runs go down the glass; fast, the airflow drags them back from the nose
        float air = streak(vec2(az * 9.0, th * 14.0 - uTime * (2.0 + 26.0 * uSpeed)));
        float grav = streak(vec2(atan(d.x, d.z) * 12.0, d.y * 16.0 + uTime * 3.0));
        float s = mix(grav, air, fast);
        // beads: speed blows most of them off (wiped by the airflow); the rest are pulled back and stretched
        float dens = uRain * mix(0.62, 0.22, fast);
        vec2 pg = vec2(atan(d.x, d.z) * 26.0, -d.y * 30.0), pa = vec2(az * 14.0, th * 32.0);
        vec3 b = beads(mix(pg, pa, fast), dens, 1.0, uTime * mix(0.25, 9.0 * uSpeed, fast), mix(1.2, 2.4, fast));
        if (uQ > 0.5) { vec3 b2 = beads(mix(pg, pa, fast) * 2.3 + 11.0, dens * 0.9, 4.0, uTime * mix(0.12, 6.0 * uSpeed, fast), mix(1.1, 1.8, fast)); b = max(b, b2 * vec3(0.8, 0.8, 0.7)); }
        // mist on the glass in the cloud, thicker low down and toward the frame
        float mistA = uFog * (0.2 + 0.25 * vn(d.xy * 7.0 + d.z * 3.0)) * (0.5 + (1.0 - smoothstep(-0.8, -0.1, d.y)) + 0.6 * smoothstep(0.9, 1.5, th));
        // a sheet of water after a splash: it drains from the top down, leaving runs below its edge
        float edge = 1.05 - 2.4 * uDrain + (vn(vec2(az * 4.0, uTime * 0.6)) - 0.5) * 0.25;
        float sheetA = uWash * (0.62 + 0.38 * vn(vec2(az * 3.0, th * 5.0 - uTime * 4.0))) * (1.0 - smoothstep(edge - 0.12, edge + 0.05, d.y)) * (0.8 + 0.4 * smoothstep(0.55, 0.75, vn(vec2(az * 11.0, th * 9.0 - uTime * 6.0))));
        float sn = vn(vec2(az * 6.0, th * 8.0 - uTime * 5.0)) * 0.6 + vn(vec2(az * 15.0, th * 20.0 - uTime * 9.0)) * 0.4;
        float ridge = (1.0 - smoothstep(0.0, 0.07, abs(sn - 0.5))) * sheetA;
        float runs = uWash * smoothstep(edge - 0.05, edge + 0.3, d.y) * smoothstep(0.62, 0.9, vn(vec2(atan(d.x, d.z) * 30.0, d.y * 3.0 + uTime * 1.6))) * 0.6;
        float heat = uHeat * (1.0 - smoothstep(0.3, 1.5, th)) * (0.5 + 0.5 * vn(vec2(az * 7.0, th * 9.0 - uTime * 30.0)));
        // where you look toward the sun, the wet glass glows and the beads catch it
        vec3 vd = normalize(vP - uEye); float sa = max(dot(vd, uSun), 0.0);
        float glare = uSunI * (pow(sa, 28.0) * 0.32 + pow(sa, 5.0) * 0.07);
        float sheen = pow(1.0 - abs(dot(vd, d)), 4.0) * 0.12;
        float wet = clamp(uRain + uWash, 0.0, 1.0);
        float a = uRain * s * 0.36 + b.x * 0.22 + b.y * 0.36 + b.z * 0.5 + mistA + sheetA * 0.55 + ridge * 0.55 + runs * 0.45 + heat * 0.5 + glare * (0.35 + wet) + sheen;
        vec3 col = vec3(0.93, 0.955, 0.975) * uLit;
        col = mix(col, vec3(0.42, 0.45, 0.54) * uLit, clamp((b.y * 0.5 + ridge * 0.8) / max(a, 0.001), 0.0, 1.0));
        col += vec3(1.0, 0.95, 0.84) * (b.z * (0.6 + 1.6 * uSunI * sa) + glare * 2.0);
        col = mix(col, vec3(1.0, 0.62, 0.38), heat / (heat + a + 0.001));
        col += uFlash * vec3(0.8, 0.84, 1.0);
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.93) * smoothstep(-0.92, -0.74, d.y));
      }` }));
  glass.position.set(...BC); glass.renderOrder = 20; glass.frustumCulled = false; ship.add(glass);
  const gU = glass.material.uniforms;

  // ---------- light inside: the display's glow, lightning, the sun through the glass (the shadows of the ribs move as you bank) ----------
  const cabin = new THREE.PointLight(new THREE.Color('#cfe4ef'), 0, 2.4, 2); cabin.position.set(0, 1.5, 3.05); ship.add(cabin);

  // ---------- WREN outside: the same ball at the hub of a hoop it rolls along the sand ----------
  const hoop = buildHoop({ THREE, V, M: K.M, lit: K.lit }); scene.add(hoop.g);
  const dio = createDiorama({ THREE, V, COARSE, waterH, outMeshes: K.outMeshes, glassOut: K.glassOut, makeHoop: () => buildHoop({ THREE, V, M: K.M, lit: K.lit }), WAVE_GLSL: ctx.WAVE_GLSL, wu: ctx.wu, SUN_DIR, softDot: ctx.softDot, FL });

  // ---------- the instrument display ----------
  let dip = 0, dispStale = true;
  const compact = () => innerHeight < 560 || innerWidth < 640;
  let minFont = 26;
  function drawInstruments() {
    minFont = drawDisplay(ig, { L, T: state.T, DAY, C, waveAlive: W.alive, flash: Math.floor(state.now * 4) % 2 === 0, fd: !L.auto && L.ap < 0.5, dip }, compact());
    iTex.needsUpdate = true;
  }

  // ---------- weather and water ----------
  const steam = particles(COARSE ? 700 : 1500, { size: 6.5, color: new THREE.Color('#f3f5f8'), opacity: 0.3, gravity: -2.2, drag: 1.3 });
  const sheet = particles(COARSE ? 500 : 900, { size: 6.5, color: new THREE.Color('#f8fbfc'), opacity: 0.32, gravity: GRAV, drag: 0.5 });
  const wisp = particles(COARSE ? 90 : 160, { size: 120, color: new THREE.Color('#eef1f6'), opacity: 0.2 }); wisp.mat.fog = false;
  const fine = particles(COARSE ? 600 : 1400, { size: 0.07, color: new THREE.Color('#ffffff'), opacity: 0.9, gravity: GRAV, drag: 0.25 }); fine.mat.visible = false; // drops thrown at the glass: not drawn (they would fly through it); they wet the glass shader
  // rain: a few hundred streaks in a box that travels with the eye; each lies along the wind it meets
  const RN = COARSE ? 220 : 420, RBOX = [34, 26, 60];
  const rBase = new Float32Array(RN * 3), rPos = new Float32Array(RN * 6), rOff = V(); for (let i = 0; i < RN * 3; i++) rBase[i] = Math.random();
  const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  const RAIN0 = new THREE.Color('#f2f5f8'), RAINSUN = new THREE.Color('#fff4dc');
  const rain = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({ color: RAIN0.clone(), transparent: true, opacity: 0, depthWrite: false, fog: false }));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  // the top of the overcast, seen from above on the way in
  const deck = new THREE.Mesh(new THREE.CircleGeometry(90000, 48).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uA: { value: 0 }, uTime: { value: 0 }, uHor: { value: SKY.hor }, uSun: { value: SUN_DIR } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uA, uTime; uniform vec3 uHor, uSun; varying vec3 vW;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y); }
      void main(){ vec2 p = vW.xz * 0.0006 + vec2(uTime * 0.004, 0.0); float n = vn(p) * 0.45 + vn(p * 2.8 + 4.0) * 0.32 + vn(p * 8.3 + 9.0) * 0.23;
        float far = smoothstep(7000.0, 60000.0, length(vW.xz - cameraPosition.xz));
        vec3 v = normalize(vW - cameraPosition); float toward = pow(max(dot(normalize(vec3(v.x, 0.0, v.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0), 3.0);
        vec3 col = mix(mix(vec3(0.66, 0.71, 0.84), vec3(0.99, 0.985, 0.98), smoothstep(0.28, 0.7, n)), uHor, far);   // lit tops, blue hollows
        col += vec3(1.0, 0.9, 0.75) * toward * 0.12 * smoothstep(0.4, 0.8, n);
        gl_FragColor = vec4(col, uA); }` }));
  deck.position.y = FL.CLOUD_TOP - 60; deck.renderOrder = -5; deck.frustumCulled = false; deck.visible = false; scene.add(deck);
  // light through the breaks under the overcast: long soft beams standing on the sea, slanted along the sun
  const NSH = COARSE ? 6 : 10, shBase = new Float32Array(NSH * 4 * 3), shCorner = new Float32Array(NSH * 4 * 2), shSize = new Float32Array(NSH * 4 * 3), shIdx = [];
  for (let i = 0; i < NSH; i++) { const c = [[0, 0], [1, 0], [1, 1], [0, 1]]; c.forEach((q, k) => shCorner.set(q, (i * 4 + k) * 2)); shIdx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); }
  const shGeo = new THREE.BufferGeometry(); shGeo.setAttribute('position', new THREE.BufferAttribute(shBase, 3)); shGeo.setAttribute('aCorner', new THREE.BufferAttribute(shCorner, 2)); shGeo.setAttribute('aSize', new THREE.BufferAttribute(shSize, 3)); shGeo.setIndex(shIdx);
  const shafts = new THREE.Mesh(shGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { uAxis: { value: SUN_DIR }, uA: { value: 0 }, uTime: { value: 0 }, uCol: { value: new THREE.Color('#fff0d6') } },
    vertexShader: `uniform vec3 uAxis; attribute vec2 aCorner; attribute vec3 aSize; varying vec2 vUv; varying float vSeed;
      void main(){ vec3 top = position + uAxis * aSize.y; vec3 mid = mix(position, top, aCorner.y);
        vec3 side = normalize(cross(uAxis, normalize(cameraPosition - mid)));
        vec3 p = mid + side * (aCorner.x - 0.5) * aSize.x * mix(1.0, 0.55, aCorner.y); vUv = aCorner; vSeed = aSize.z;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uA, uTime; uniform vec3 uCol; varying vec2 vUv; varying float vSeed;
      void main(){ float x = 1.0 - abs(vUv.x - 0.5) * 2.0; float a = x * x * smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y));
        a *= uA * (0.55 + 0.45 * sin(uTime * 0.21 + vSeed * 6.28)); gl_FragColor = vec4(uCol * a * 0.2, 1.0); }` }));
  shafts.frustumCulled = false; shafts.visible = false; shafts.renderOrder = -2; scene.add(shafts);
  const shState = Array.from({ length: NSH }, () => ({ x: 0, z: 0, w: 0, seed: Math.random(), set: false }));
  function placeShafts(eye) {
    const fx = Math.sin(L.yaw), fz = Math.cos(L.yaw), len = FL.CLOUD_BASE / Math.max(0.15, SUN_DIR.y);
    shState.forEach((s, i) => {
      const ahead = (s.x - eye.x) * fx + (s.z - eye.z) * fz;
      if (!s.set || ahead < -400 || ahead > 14000) { const d = 1500 + Math.random() * 9000, a = (Math.random() - 0.5) * 1.6 + L.yaw; Object.assign(s, { x: eye.x + Math.sin(a) * d, z: eye.z + Math.cos(a) * d, w: 260 + Math.random() * 520, set: true }); }
      for (let k = 0; k < 4; k++) { shBase.set([s.x, 0, s.z], (i * 4 + k) * 3); shSize.set([s.w, len, s.seed], (i * 4 + k) * 3); }
    });
    shGeo.attributes.position.needsUpdate = true; shGeo.attributes.aSize.needsUpdate = true;
  }
  // foam left on the water behind the hull, and rings spreading where it touches
  const WN = 80, wkPts = [], wkPos = new Float32Array(WN * 2 * 3), wkA = new Float32Array(WN * 2 * 2), wkIdx = [];
  for (let i = 0; i < WN - 1; i++) { const a = i * 2; wkIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const wkGeo = new THREE.BufferGeometry(); wkGeo.setAttribute('position', new THREE.BufferAttribute(wkPos, 3)); wkGeo.setAttribute('aA', new THREE.BufferAttribute(wkA, 2)); wkGeo.setIndex(wkIdx);
  const wakeFoam = new THREE.Mesh(wkGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms: { ...THREE.UniformsLib.fog, uTime: { value: 0 } },
    vertexShader: `attribute vec2 aA; varying vec2 vA; varying vec3 vW2;
      #include <fog_pars_vertex>
      void main(){ vA = aA; vW2 = position; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; varying vec2 vA; varying vec3 vW2;
      #include <fog_pars_fragment>
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y); }
      void main(){ float across = abs(vA.x * 2.0 - 1.0); float n = vn(vW2.xz * 0.9) * 0.6 + vn(vW2.xz * 3.1 + 5.0) * 0.4;
        float a = vA.y * (1.0 - smoothstep(0.55, 1.0, across)) * smoothstep(0.32, 0.62, n + 0.25 * (1.0 - across));
        gl_FragColor = vec4(vec3(0.97, 0.985, 0.99), a * 0.8);
      #include <fog_fragment>
      }` }));
  wakeFoam.frustumCulled = false; wakeFoam.renderOrder = 2; scene.add(wakeFoam);
  const ringMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uR: { value: 0 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uR; varying vec2 vU; void main(){ float r = length(vU); float a = smoothstep(0.8, 0.93, r) * (1.0 - smoothstep(0.95, 1.0, r)) + 0.35 * smoothstep(0.55, 0.65, r) * (1.0 - smoothstep(0.66, 0.75, r)); gl_FragColor = vec4(0.97, 0.985, 0.99, a * uR); }' });
  const ripples = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), ringMat.clone()); m.visible = false; m.renderOrder = 1; scene.add(m); return { m, t: 9, k: 1, v: 6 }; });
  let ripN = 0;
  // the block draws the real thing: the same particle buffers (spray, engine plumes, foam, mist and spindrift) and the same foam and rings
  dio.mirror(spray, 0.9, '#f6fafc', 0.9, 1.2, 14); dio.mirror(steam, 6.5, '#f3f5f8', 0.35, 1.5, 70); dio.mirror(wake, 1.6, '#f8fbfc', 0.6, 1, 16); dio.mirror(mist, 58, '#f6f6f8', 0.22, 2, 90);
  if (!COARSE) { dio.mirror(sheet, 6.5, '#f8fbfc', 0.3, 1.2, 60); dio.mirror(white, 45, '#fbfcfd', 0.45, 2, 80); }
  dio.share(wakeFoam); for (const r of ripples) dio.share(r.m);
  const ripple = (x, z, k = 1, v = 6) => { const r = ripples[ripN++ % ripples.length]; Object.assign(r, { t: 0, k, v }); r.m.position.set(x, 0, z); r.m.visible = true; };

  const OVER = new THREE.Color('#c9cdd6'), FOG0 = scene.fog.color.clone(), DENS0 = scene.fog.density, USKY0 = waterMats[0].userData.u.uSky.value.clone(), _c = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1);
  const env = { above: 1, inC: 0, below: 0, shade: 0, flash: 0, exposure: 1, lum: 1, sunI: 1 };
  const LT = { next: 2.5, t: 9, thunder: 0, n: 0 };
  // is the eye in the wave's shadow? March toward the sun over the wave's surface
  function shadeAt(x, y, z) { if (!W.alive) return 0; let s = 0; for (let i = 1; i <= 16; i++) { const d = i * i * 28; s = Math.max(s, clamp((waterH(x + SUN_DIR.x * d, z + SUN_DIR.z * d) - (y + SUN_DIR.y * d)) / 30, 0, 1)); if (s >= 1) break; } return s; }
  function weather(p, real) {
    const y = p.y, above = smooth(FL.CLOUD_TOP - 250, FL.CLOUD_TOP + 250, y), below = 1 - smooth(FL.CLOUD_BASE - 350, FL.CLOUD_BASE + 150, y), inC = clamp(1 - above - below, 0, 1);
    Object.assign(env, { above, inC, below });
    // the sun sinks a little over the flight; it stands low ahead, behind where the wave comes from
    const el = lerp(0.42, 0.25, smooth(0, 120, L.T)); SUN_DIR.set(-0.3 * Math.cos(el), Math.sin(el), 0.95 * Math.cos(el)).normalize();
    env.shade += (shadeAt(p.x, p.y, p.z) - env.shade) * Math.min(1, real * 3);
    // lightning in the cloud: a double flicker, thunder a moment later
    LT.t += real; LT.next -= real;
    if (inC > 0.35 && LT.next <= 0) { LT.t = 0; LT.next = 3 + Math.random() * 5; LT.thunder = 0.35 + Math.random() * 1.1; LT.n++; }
    const lt = LT.t; env.flash = (lt < 0.07 ? 1 : lt < 0.14 ? 0.2 : lt < 0.22 ? 0.8 : lt < 0.7 ? Math.exp(-(lt - 0.22) * 9) * 0.8 : 0) * (XR.on ? 0.4 : 1) * clamp(inC + below * 0.3, 0, 1);
    if (LT.thunder > 0 && (LT.thunder -= real) <= 0) thunder();
    scene.fog.density = Math.exp(above * Math.log(1.5e-5) + inC * Math.log(1.1e-2) + below * Math.log(1.1e-4));
    scene.fog.color.copy(FOG0).lerp(OVER, 1 - above).lerp(WHITE, env.flash * 0.5);
    const su = sky.material.uniforms; su.uOver.value = clamp(inC + below * 0.9, 0, 1); su.uSunA.value = (above + below * 0.75) * (1 - env.shade * 0.9); su.uBreak.value = below * 0.75; su.uFlash.value = env.flash * 0.5;
    // the sun: full above the cloud, a glow inside it, through the breaks below it; and gone in the wave's shadow
    env.sunI = (above + 0.12 * inC + 0.62 * below) * (1 - 0.88 * env.shade);
    sun.intensity = 2.7 * above + 0.35 * inC + 1.3 * below * (1 - 0.97 * env.shade); sun.color.copy(SUNCOL0).lerp(_c.set('#ffd9b0'), below * 0.35);
    hemi.intensity = 1.2 * above + 1.05 * inC + 1.25 * below - 0.45 * env.shade + env.flash * 2.2; glow.intensity = 1.15 * above;
    for (const m of waterMats) { const u = m.userData.u; u.uSky.value.copy(USKY0).lerp(_c.copy(OVER).multiplyScalar(0.92), 1 - above); u.uSunA.value = env.sunI; u.uShadeHere.value = env.shade; u.uFlash.value = env.flash; }
    deck.visible = above > 0.02; deck.material.uniforms.uA.value = above; deck.material.uniforms.uTime.value = state.now;
    // the eye adapts: the cloud and the wave's shadow are dark, the open sea is bright
    env.lum = (sun.intensity * Math.max(0.15, SUN_DIR.y) * 0.9 + hemi.intensity * 0.75) / (2.7 * 0.4 * 0.9 + 1.2 * 0.75);
    const tgt = clamp(Math.pow(1 / Math.max(0.2, env.lum), 0.3), 0.9, 1.32);
    env.exposure += (tgt - env.exposure) * Math.min(1, real / 1.4); renderer.toneMappingExposure = XR.on ? 1 : env.exposure;
  }
  function clearWeather() {
    for (const ps of [spray, mist, white, wake, steam, sheet, wisp, fine]) if (ps.mat.userData.base) ps.mat.color.copy(ps.mat.userData.base);
    for (const m of waterMats) { const u = m.userData.u; u.uPatch.value = 0; u.uSunA.value = 0; u.uShadeHere.value = 0; u.uFlash.value = 0; u.uSky.value.copy(USKY0); }
    scene.fog.density = DENS0; scene.fog.color.copy(FOG0); const su = sky.material.uniforms; su.uOver.value = 0; su.uSunA.value = 0; su.uBreak.value = 0; su.uFlash.value = 0;
    sun.intensity = 2.7; sun.color.copy(SUNCOL0); hemi.intensity = 1.2; glow.intensity = 1.15; deck.visible = false; rain.visible = false; shafts.visible = false; SUN_DIR.copy(SUN0); renderer.toneMappingExposure = 1;
  }

  // ---------- input: mouse or finger (drag = stick, holding = throttle), keys, gamepad; looking round: right-drag, two fingers, the mouse ----------
  const cv = renderer.domElement, keys = new Set(), ptr = { id: null, x0: 0, y0: 0, sx: 0, sy: 0 }, pad = { sx: 0, sy: 0, hold: 0, n: 0 }, xin = { sx: 0, sy: 0, src: null, p0: null };
  const look = { x: 0, y: 0, dx: 0, dy: 0, drag: null, hx: 0, hy: 0, hAt: -99, relAt: -99, touches: new Map() };
  let testIn = null, forceAuto = null;
  const flying = () => state.game === 'fly' && state.phase !== 'idle';
  cv.addEventListener('contextmenu', (e) => { if (flying()) e.preventDefault(); });
  cv.addEventListener('pointerdown', (e) => {
    if (!flying()) return;
    if (e.pointerType === 'touch') look.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const two = look.touches.size >= 2;
    if (e.button === 2 || e.button === 1 || two) {
      if (two && ptr.id !== null) { ptr.id = null; ptr.sx = ptr.sy = 0; state.hold = false; }
      look.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; return;
    }
    if (ptr.id !== null) return; ptr.id = e.pointerId; ptr.x0 = e.clientX; ptr.y0 = e.clientY; ptr.sx = ptr.sy = 0;
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && e.buttons === 0) { look.hx = e.clientX / innerWidth * 2 - 1; look.hy = e.clientY / innerHeight * 2 - 1; look.hAt = state.now; }
    if (look.touches.has(e.pointerId)) look.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (look.drag && (e.pointerId === look.drag.id || look.touches.size >= 2)) { const k = look.touches.size >= 2 ? 0.5 : 1;
      look.dx = clamp(look.dx - (e.clientX - look.drag.x) * 0.0055 * k, -1.3, 1.3); look.dy = clamp(look.dy - (e.clientY - look.drag.y) * 0.0045 * k, -0.55, 0.65); look.drag.x = e.clientX; look.drag.y = e.clientY; look.relAt = state.now; return; }
    if (e.pointerId !== ptr.id) return; const r = Math.max(60, Math.min(innerWidth, innerHeight) * 0.2); ptr.sx = clamp((e.clientX - ptr.x0) / r, -1, 1); ptr.sy = clamp((e.clientY - ptr.y0) / r, -1, 1);
  });
  const pUp = (e) => { look.touches.delete(e.pointerId); if (look.drag && (e.pointerId === look.drag.id || look.touches.size < 2)) { look.drag = null; look.relAt = state.now; } if (e.pointerId === ptr.id) { ptr.id = null; ptr.sx = ptr.sy = 0; } };
  cv.addEventListener('pointerup', pUp); cv.addEventListener('pointercancel', pUp); cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') look.hAt = -99; });
  const ORDER = ['in', 'out', 'close', 'mid', 'far'];
  addEventListener('keydown', (e) => { if (!flying()) return; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) { keys.add(e.code); e.preventDefault(); state.lastInput = state.now; }
    if (e.code === 'KeyV') cycleView(); });
  addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
  const key = (a, b) => (keys.has(a) || keys.has(b) ? 1 : 0);
  function readPads() {
    pad.sx = pad.sy = pad.hold = 0; pad.n = 0; if (!navigator.getGamepads) return;
    let list; try { list = navigator.getGamepads(); } catch { return; }
    for (const g of list) { if (!g || !g.connected) continue; pad.n++; const dz = (v) => (Math.abs(v) < 0.14 ? 0 : (v - Math.sign(v) * 0.14) / 0.86);
      const ax = dz(g.axes[0] || 0), ay = dz(g.axes[1] || 0); if (Math.abs(ax) > Math.abs(pad.sx)) pad.sx = ax; if (Math.abs(ay) > Math.abs(pad.sy)) pad.sy = ay;
      look.px = dz(g.axes[2] || 0); look.py = dz(g.axes[3] || 0);
      pad.hold = Math.max(pad.hold, g.buttons[7] ? g.buttons[7].value : 0, g.buttons[0] && g.buttons[0].pressed ? 1 : 0); }
  }
  function input() {
    if (testIn) return { auto: false, ...testIn };
    readPads();
    const sx = clamp(ptr.sx + key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft') + pad.sx + xin.sx, -1, 1), sy = clamp(ptr.sy + key('KeyS', 'ArrowDown') - key('KeyW', 'ArrowUp') + pad.sy + xin.sy, -1, 1);
    const hold = Math.max(state.hold ? 1 : 0, pad.hold);
    if (Math.abs(sx) > 0.04 || Math.abs(sy) > 0.04 || hold > 0.05) state.lastInput = state.now;
    const watching = XR.on && XR.mode === 'watch';
    const auto = forceAuto !== null ? forceAuto : watching || state.now - state.lastInput > 2.5;
    return { auto, sx, sy, hold };
  }
  const steering = () => testIn !== null || forceAuto === false || state.now - state.lastInput < 2.5;

  // ---------- views: the cockpit, outside, and the live model block at three sizes. Every change is a glide, never a cut: the camera flies
  // out of the cockpit (or back in), the block fades in over the world in linear light, and the block's size eases continuously, so a
  // change of scale is one pull-out. The block slides to keep the lander framed and leads toward the wave. The director picks a wide view
  // at a few beats, only while the flight computer flies and nobody has touched anything; a pilot can pick any view (V) and keep flying ----------
  let userView = 'in', view = 'in';
  const CUT = { on: !Q.has('nocuts'), n: 0, log: [] };
  const VS = { mix: 0, mixE: 0, wIn: 1, logS: Math.log(120), cx: 0, cz: 0, az: -2.3, step: 'close', snap: true, lab: {}, capAt: -9, barW: 0, len: 0, trackAt: 0, wtrackAt: 0 };
  const isDioV = (v) => v === 'close' || v === 'mid' || v === 'far';
  const isDio = () => VS.mix > 0.5;
  function cycleView() { setView(ORDER[(ORDER.indexOf(userView) + 1) % ORDER.length]); }
  function setView(v, now = false) {
    userView = v;
    if (now) { view = v; VS.mix = VS.mixE = isDioV(v) ? 1 : 0; VS.wIn = v === 'in' ? 1 : 0; if (isDioV(v)) { VS.step = v; VS.logS = Math.log(BLOCKS[v]); const t = blockTarget(v, BLOCKS[v]); VS.cx = t.x; VS.cz = t.z; VS.snap = true; } }
    const b = $('view'); if (b) b.textContent = { in: 'outside', out: 'close', close: '3 km', mid: '9 km', far: 'cockpit' }[v] || 'view';
  }
  function director() {
    if (XR.on || !CUT.on || userView !== 'in' || !L.auto || steering() || L.fade) return userView;
    const ph = L.phase, t = L.t;
    if ((ph === 'still' || ph === 'splash') && WR.trip && (WR.st === 'drop' || WR.st === 'out') && L.T - WR.tripAt > 0.3 && L.T - WR.tripAt < 4.6 && L.wave > FL.ALARM + 250) return 'close';
    if (ph === 'alarm' && t > 3.8 && t < 7.8) return 'far';
    if (ph === 'climb' && t > 1.2 && t < 4.8 && !L.late) return 'mid';
    if (ph === 'out' && t > 2.2 && t < 6.6) return 'far';
    if (ph === 'entry' && L.loop > 0 && t > 0.3 && t < 3.6) return 'far';
    return 'in';
  }
  // where the block wants its centre: on the lander, a little ahead of it, sharing the frame with the wave once the wave is near enough
  function blockTarget(step, S) {
    let x = L.x + L.vx * 0.4, z = L.z + L.vz * 0.4;
    if (step === 'close' && WR.out) { x = (x + WR.x) / 2; z = (z + WR.z) / 2; }
    const crest = W.alive ? W.zc + ctx.zOff(L.x) : null;
    if (crest !== null && Math.abs(crest - L.z) < S * 0.7) z = L.z + (crest - L.z) * 0.45;
    else if (crest !== null && crest > L.z) z += Math.min(S * 0.22, (crest - L.z) * 0.3);
    else if (crest !== null) z -= S * 0.12;
    else z += S * 0.12;
    return { x: clamp(x, L.x - S * 0.3, L.x + S * 0.3), z: clamp(z, L.z - S * 0.3, L.z + S * 0.3) };
  }
  function views(real) {
    const want = director();
    if (want !== view) { view = want; CUT.n++; CUT.log.push(`${L.phase}:${view}`); if (CUT.log.length > 20) CUT.log.shift();
      if (isDioV(view) && VS.mix < 0.05) { VS.step = view; VS.logS = Math.log(BLOCKS[view] * 0.6); const t = blockTarget(view, BLOCKS[view]); VS.cx = t.x; VS.cz = t.z; VS.snap = true; } }
    VS.mix = isDioV(view) ? Math.min(1, VS.mix + real / 0.75) : Math.max(0, VS.mix - real / 0.65); VS.mixE = VS.mix * VS.mix * (3 - 2 * VS.mix);
    VS.wIn = view === 'in' ? Math.min(1, VS.wIn + real / 0.9) : Math.max(0, VS.wIn - real / 0.9);
    if (isDioV(view)) VS.step = view;
    VS.logS += (Math.log(BLOCKS[VS.step]) - VS.logS) * (1 - Math.exp(-real * 2.2));
    const S = Math.exp(VS.logS), t = blockTarget(VS.step, S), k = 1 - Math.exp(-real * 2.5);
    VS.cx += (t.x - VS.cx) * k; VS.cz += (t.z - VS.cz) * k;
    const azT = -2.3 + 0.16 * Math.sin(state.now * 0.045) + (W.alive && Math.abs(L.wave) < S * 0.6 ? 0.22 : 0);
    VS.az += (azT - VS.az) * Math.min(1, real * 0.8);
    // the tracks the block draws: where the lander has been, and WREN's path
    if (state.now - VS.trackAt > 0.12) { VS.trackAt = state.now; dio.landerTrack.push(L.x, L.y + 0.6, L.z); }
    if (WR.out && state.now - VS.wtrackAt > 0.1) { VS.wtrackAt = state.now; dio.wrenTrack.push(WR.x, -0.4 + Math.max(0, waterH(WR.x, WR.z)), WR.z); }
  }

  // ---------- shake: three bands of smooth motion, each fed by what causes it ----------
  const wob = (t, f, k) => Math.sin(TAU * f * t + k) * 0.6 + Math.sin(TAU * f * 1.67 * t + k * 1.7 + 1) * 0.4;
  const band = { lo: 0, mid: 0, hi: 0, kick: 0 };
  function bands() { const s = L.shake; band.lo = 0.6 * s.air + 0.25 * s.water + 0.5 * s.hit + 0.6 * band.kick; band.mid = 0.5 * s.thr + 0.6 * s.alpha + 0.5 * s.water + 0.6 * s.hit + 0.2 * s.air + 0.8 * band.kick; band.hi = 0.6 * s.thr + 0.35 * s.water + 0.3 * L.heat + 0.5 * L.buffet; return band; }
  const jig = (k, lo, mid, hi) => { const t = state.now; return lo * band.lo * wob(t, 1.3, k) + mid * band.mid * wob(t, 7.3, k * 2.1) + hi * band.hi * wob(t, 23, k * 3.3); };
  // rumble motors and phone haptics follow the same signal
  const hap = { rumble: 0, vibrate: 0, xr: 0, at: 0, vibAt: 0, strong: 0, weak: 0 };
  function haptics() {
    if (state.now - hap.at < 0.09) return; hap.at = state.now;
    const s = L.shake; hap.strong = clamp(0.5 * s.air + 0.6 * s.water + s.hit + 0.3 * s.thr + band.kick, 0, 1); hap.weak = clamp(0.7 * s.thr + 0.5 * s.alpha + 0.3 * s.air + 0.4 * s.water, 0, 1);
    if (hap.strong + hap.weak > 0.05 && navigator.getGamepads) { let list = []; try { list = navigator.getGamepads(); } catch { /* blocked */ }
      for (const g of list) { const va = g && g.vibrationActuator; if (!va || !va.playEffect) continue; try { const r = va.playEffect('dual-rumble', { startDelay: 0, duration: 140, weakMagnitude: hap.weak, strongMagnitude: hap.strong }); if (r && r.catch) r.catch(() => {}); hap.rumble++; } catch { /* not this pad */ } } }
    if (buzzOK() && s.total > 0.45 && state.now - hap.vibAt > lerp(0.6, 0.2, clamp(s.total - 0.45, 0, 1))) { hap.vibAt = state.now; try { navigator.vibrate(Math.round(10 + 30 * clamp(s.total / 1.6, 0, 1))); hap.vibrate++; } catch { /* not allowed */ } }
    if (XR.on && XR.session) for (const src of XR.session.inputSources) { const h = src.gamepad && src.gamepad.hapticActuators && src.gamepad.hapticActuators[0]; if (h && h.pulse && s.total > 0.12) { try { h.pulse(clamp(s.total / 1.6, 0, 1), 100); hap.xr++; } catch { /* none */ } } }
  }

  // ---------- sound: every layer is an oscillator or filtered noise, built once and reused on every loop ----------
  let A = null; const al = { pull: 0, intake: 0, drop: 0, creak: 0, relay: 0, nz: 1 };
  function buildAudio() {
    const n = SFX.nodes; if (!n) return; const { ac, out, wet, nb, br } = n;
    const gain = (v) => { const g = ac.createGain(); g.gain.value = v; return g; };
    const filt = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const loop = (buf) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * buf.duration); return s; };
    const bed = (buf, f, toWet = 0) => { const g = gain(0); loop(buf).connect(f); f.connect(g); g.connect(out); if (toWet) { const w = gain(toWet); g.connect(w); w.connect(wet); } return { g, f }; };
    A = { ac, out, wet, br, gain, filt };
    A.engF = filt('lowpass', 200); A.eng = gain(0); A.engF.connect(A.eng); A.eng.connect(out);
    A.osc = [49, 49.6, 73.8].map((f, i) => { const o = ac.createOscillator(); o.type = i === 2 ? 'square' : 'sawtooth'; o.frequency.value = f; const g = gain(i === 2 ? 0.35 : 1); o.connect(g); g.connect(A.engF); o.start(); return o; });
    A.whine = ac.createOscillator(); A.whine.type = 'triangle'; A.whine.frequency.value = 300; A.whineG = gain(0); A.whine.connect(A.whineG); A.whineG.connect(out); A.whine.start();
    A.roar = bed(br, filt('bandpass', 140, 0.6), 0.3); A.rattle = bed(nb, filt('bandpass', 210, 5)); A.wind = bed(nb, filt('bandpass', 400, 0.6));
    A.rain = bed(nb, filt('highpass', 5200)); A.water = bed(nb, filt('bandpass', 3200, 0.8), 0.15); A.steam = bed(nb, filt('highpass', 1800), 0.2);
    A.drum = bed(br, filt('bandpass', 170, 1.1)); // water drumming on the hull
    // the cabin's own hum: avionics and fans, steady, quiet, under everything
    A.hum = gain(0); A.hum.connect(out); for (const [f, v] of [[120, 0.5], [240, 0.22], [361, 0.08]]) { const o = ac.createOscillator(); o.frequency.value = f; const g = gain(v); o.connect(g); g.connect(A.hum); o.start(); }
    A.fan = bed(nb, filt('bandpass', 900, 0.5));
    // WREN's hoop rolling through the water, heard from the cockpit
    A.hoopO = ac.createOscillator(); A.hoopO.type = 'triangle'; A.hoopO.frequency.value = 160; A.hoopG = gain(0); A.hoopO.connect(A.hoopG); A.hoopG.connect(out); A.hoopO.start();
    A.hoopW = bed(nb, filt('bandpass', 1600, 1.4));
  }
  const tone = (kind, k = 1) => { if (!A) return; const ac = A.ac, t = ac.currentTime;
    const noise = (f, q, dur, v, type = 'bandpass', toWet = 0) => { const s = ac.createBufferSource(); s.buffer = A.br; const fl = A.filt(type, f, q), g = A.gain(0); s.connect(fl); fl.connect(g); g.connect(A.out); if (toWet) { const w = A.gain(toWet); g.connect(w); w.connect(A.wet); }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.start(t, Math.random() * 1.5, dur + 0.1); return fl; };
    if (kind === 'click') { SFX.burst(3600 + Math.random() * 800, 2.5, 0.016, 0.08 * k, 'bandpass', 0); SFX.blip(2100, 0.01, 0.03 * k, 'square', 0); }
    else if (kind === 'relay') SFX.blip(820 + Math.random() * 380, 0.007, 0.02, 'square', 0);
    else if (kind === 'creak') { const f = noise(320 + Math.random() * 260, 16, 0.42, 0.06 * k, 'bandpass', 0.05); f.frequency.setTargetAtTime(220 + Math.random() * 120, t, 0.2); }
    else if (kind === 'clunk') { noise(240, 1.4, 0.16, 0.22 * k, 'lowpass', 0.1); SFX.blip(150, 0.08, 0.1 * k, 'sine', 0); }
    else if (kind === 'thunder') { const f = noise(220, 0.7, 3.4, 0.5 * k, 'lowpass', 0.6); f.frequency.setTargetAtTime(90, t + 0.2, 0.8); }
    else if (kind === 'cough') { noise(110, 0.9, 0.32, 0.55 * k, 'lowpass', 0.25); noise(700, 0.8, 0.22, 0.22 * k, 'bandpass', 0.1); SFX.burst(2400, 0.7, 0.4, 0.12 * k, 'highpass', 0.2); }
    else if (kind === 'chime') [880, 1175].forEach((f, i) => setTimeout(() => SFX.blip(f, 0.16, 0.035, 'triangle', 0.2), i * 110));
  };
  function thunder() { tone('thunder', clamp(0.5 + env.inC, 0.4, 1.2)); }
  function sound(real) {
    if (!A) { buildAudio(); if (!A) return; }
    const t = A.ac.currentTime, set = (p, v, k = 0.08) => { if (Number.isFinite(v)) p.setTargetAtTime(v, t, k); }, s = L.shake, pw = Math.max(0, L.power), main = L.main ? 1 : 0.3;
    set(A.eng.gain, (0.02 + 0.16 * Math.pow(pw, 0.8) * main + 0.015 * L.thr) * (1 - 0.5 * L.sput), 0.05);
    A.osc.forEach((o, i) => set(o.frequency, (i === 2 ? 73.5 : 49 + i * 0.6) * (1 + 0.9 * (L.rpm || L.thr) * (0.4 + 0.6 * pw)), 0.15));
    set(A.engF.frequency, 160 + 1100 * pw * main, 0.1);
    set(A.whine.frequency, 280 + 1300 * (L.rpm || L.thr), 0.3); set(A.whineG.gain, 0.006 + 0.02 * L.thr, 0.2);
    set(A.roar.g.gain, 0.8 * pw * pw * main, 0.08); set(A.roar.f.frequency, 110 + 160 * pw, 0.2);
    set(A.rattle.g.gain, clamp(0.05 * band.mid + 0.04 * band.lo, 0, 0.14) * (0.6 + 0.4 * wob(state.now, 9, 2)), 0.03);
    set(A.wind.g.gain, 0.34 * Math.pow(clamp(L.V / 300, 0, 1.4), 1.6), 0.2); set(A.wind.f.frequency, 260 + L.V * 5, 0.3);
    set(A.rain.g.gain, L.rain * (0.03 + 0.09 * clamp(L.V / 200, 0, 1)), 0.2);
    set(A.water.g.gain, clamp(L.contact * L.V / 60 * 0.3 + L.prox * 0.1, 0, 0.4), 0.06);
    set(A.steam.g.gain, 0.3 * L.eject + 0.12 * pw * main * Math.exp(-Math.max(0, L.hk) / 10), 0.06);
    const drum = L.rain * (0.02 + 0.05 * (1 - clamp(L.V / 150, 0, 1))) + L.contact * clamp(Math.hypot(L.vx, L.vz) / 40, 0, 1) * 0.16 + washT * 0.18;
    set(A.drum.g.gain, drum * (0.7 + 0.3 * wob(state.now, 3.1, 5)), 0.05);
    set(A.hum.gain, 0.008, 0.5); set(A.fan.g.gain, 0.006, 0.5);
    const wv = WR.out ? Math.hypot(WR.vx, WR.vz) : 0, wd = WR.out ? Math.hypot(WR.x - L.x, WR.z - L.z) : 99;
    set(A.hoopG.gain, clamp(wv / 12, 0, 1) * 0.03 / (1 + wd / 12), 0.1); set(A.hoopO.frequency, 120 + wv * 14, 0.1); set(A.hoopW.g.gain, clamp(wv / 12, 0, 1) * 0.05 / (1 + wd / 15), 0.1);
    // single raindrops on the glass
    al.drop -= real; if (L.rain > 0.05 && al.drop <= 0) { al.drop = 0.03 + Math.random() * 0.1 / L.rain; SFX.burst(5200 + Math.random() * 3000, 5, 0.02, 0.035 * L.rain, 'bandpass', 0); }
    // the canopy creaks under load
    al.creak -= real; const dn = Math.abs(L.nz - al.nz) / Math.max(real, 1e-3); al.nz = L.nz;
    if (al.creak <= 0 && (Math.abs(L.nz - 1) > 0.9 || dn > 4) && L.contact < 0.5) { al.creak = 0.8 + Math.random(); tone('creak', clamp(Math.abs(L.nz - 1) / 1.5, 0.4, 1.3)); }
    al.pull -= real; if (L.pullup && al.pull <= 0) { al.pull = 0.34; SFX.blip(1480, 0.1, 0.09, 'square', 0); }
    if (L.shaker && al.pull <= 0) { al.pull = 0.12; SFX.burst(90, 2, 0.08, 0.12, 'lowpass', 0); }
    al.intake -= real; if (L.alarmOn && L.main && al.intake <= 0) { al.intake = 1.0; SFX.blip(660, 0.16, 0.07, 'square', 0.05); setTimeout(() => SFX.blip(520, 0.2, 0.07, 'square', 0.05), 190); }
    const near = W.alive ? smooth(6000, 300, Math.abs(L.wave)) : 0, ph = L.phase;
    SFX.update(ph === 'climb' ? 0.95 : ph === 'face' ? 0.8 : ph === 'out' ? 0.6 : ph === 'still' ? 0.3 : 0.18 + near * 0.5, near, W.spill * 0.5 + (ph === 'wipe' ? 0.6 : 0), -1 / 3);
  }
  function quiet() { if (!A) return; const t = A.ac.currentTime; for (const g of [A.eng, A.whineG, A.roar.g, A.rattle.g, A.wind.g, A.rain.g, A.water.g, A.steam.g, A.drum.g, A.hum, A.fan.g, A.hoopG, A.hoopW.g]) g.gain.setTargetAtTime(0, t, 0.1); }

  // ---------- what WREN says (all original lines) ----------
  const LINES = {
    entry: [[1.0, 'Through the top of the air. Hold her steady while the hull cools.', 3.6, 'first'], [1.0, 'Down we go again.', 2.4, 'again']],
    cloud: [[0.8, 'Cloud tops. It rains all the way down from here.', 3.4, 'first'], [8.5, 'Gravity is one point three. She falls faster than you think.', 3.8, 'first']],
    approach: [[0.6, 'Out of the cloud. Sea below: knee-deep, as far as the radar reaches.', 4.0, 'first'], [7.5, 'High ground on the horizon, dead ahead.', 3.2]],
    skim: [[1.0, 'Ride the cushion of air and let the speed bleed off.', 3.4, 'first']],
    splash: [[0.3, 'Floats are wet. Brace.', 2.2]],
    still: [[0.9, 'Down. Half a metre of water under us.', 2.6, 'stayfirst'], [0.9, 'Again.', 1.8, 'stayagain'], [4.4, 'Every tick is a day at home.', 2.8, 'stay']],
    alarm: [[0.2, 'It is water. All of it, coming at 124 metres a second. Throttle!', 4.0], [5.6, 'Intakes are flooded. Keep the power on and cough it out.', 3.6]],
    face: [[0.8, 'It has us. The nose is lifting, and that drains the engines.', 3.4]],
    climb: [[0.3, 'Engines clean. Stand her on her tail!', 2.8]],
    out: [[0.4, '', 3.8]],
    wipe: [[0.5, 'It broke over us.', 2.4]],
  };
  let wiped = false, fired = new Set(), cuePhase = '', days0 = 0, lastSkipped = 0, washT = 0, drainT = 1, frameN = 0, speakT = 0;
  function cues() {
    if (L.phase !== cuePhase) { cuePhase = L.phase; fired = new Set(); }
    const list = LINES[cuePhase]; if (!list) return;
    list.forEach((c, i) => {
      if (fired.has(i) || L.t < c[0]) return; const again = L.loop > 0;
      const tag = c[3] || ''; if ((/first/.test(tag) && again) || (/again/.test(tag) && !again) || (/stay/.test(tag) && WR.trip)) return;
      fired.add(i);
      let text = c[1];
      if (cuePhase === 'out') { const d = state.ticks - days0; text = `Over the top. That visit cost ${ctx.fmtDays(d)} at home.`; }
      if (cuePhase === 'climb' && L.late) text = 'No time to land. Main engines: over the top!';
      if (cuePhase === 'alarm' && i === 0 && WR.out) text = 'That is not a mountain. It is water! Coming back. Throttle up!';
      speak(text, c[2]);
    });
  }
  function speak(text, sec) { say(text, 'WREN', sec); SFX.bot(); speakT = sec; }

  // ---------- WREN's outing: after a splash-down it drops through its chute, rolls out in its hoop to sound the water and look at the
  // horizon, and races back aboard when the wave is recognised. The flight computer never waits for it; it is always aboard before lift-off ----------
  const WR = { st: 'perch', t: 0, out: false, trip: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, heading: 0, spin: 0, lean: 0, tx: 0, tz: 0, log: [], leftAt: -1, backAt: -1, lineN: 0 };
  const PERCH = wren.position.clone();
  function wrenGo(st) { WR.st = st; WR.t = 0; WR.log.push(`${st}@${L.phase}`); if (WR.log.length > 30) WR.log.shift(); }
  function wrenHome(now = true) { WR.out = false; hoop.g.visible = false; wren.visible = true; wren.position.copy(PERCH); wren.scale.setScalar(1); if (now) wrenGo('perch'); }
  function wrenStep(dt) {
    WR.t += dt;
    const shipLocal = (x, y, z) => _v2.set(x, y, z).applyMatrix4(ship.matrixWorld);
    if (WR.st === 'perch') {
      const slow = (L.phase === 'still' && L.t > 0.4) || (L.phase === 'splash' && Math.hypot(L.vx, L.vz) < 7 && L.t > 3);
      if (slow && !WR.trip && WR.armed && W.alive && L.wave > FL.ALARM + 650 && !L.fade) { WR.trip = true; WR.tripAt = L.T; wrenGo('drop'); speak(L.loop ? 'Floats down. Going out.' : 'Floats down. I will go and look.', 2.4); tone('click'); }
    } else if (WR.st === 'drop') { // down the chute in the starboard console
      const k = Math.min(1, WR.t / 0.6); wren.position.set(lerp(PERCH.x, -0.62, k), lerp(PERCH.y, 1.12, k * k), lerp(PERCH.z, 2.72, k)); wren.scale.setScalar(1 - 0.5 * k);
      if (k >= 1) { wren.visible = false; tone('clunk'); const p = shipLocal(-1.5, 0, 0.9); Object.assign(WR, { out: true, x: p.x, z: p.z, vx: 0, vz: 0, heading: L.yaw - 0.5, spin: 0, leftAt: L.T });
        const t = shipLocal(-7, 0, 17); WR.tx = t.x; WR.tz = t.z; ripple(p.x, p.z, 0.6, 3); SFX.splash(0.25); wrenGo('out'); }
    } else if (WR.st === 'out' || WR.st === 'back') {
      const back = WR.st === 'back';
      if (back) { const t = shipLocal(-1.5, 0, 0.9); WR.tx = t.x; WR.tz = t.z; }
      const dx = WR.tx - WR.x, dz = WR.tz - WR.z, d = Math.hypot(dx, dz), vmax = back ? 13 : 7.5, sp = Math.min(vmax, d * 1.4 + 0.5);
      const want = Math.atan2(dx, dz), turn = Math.atan2(Math.sin(want - WR.heading), Math.cos(want - WR.heading));
      WR.heading += clamp(turn, -dt * 3, dt * 3); WR.lean += (clamp(-turn * 0.8, -0.35, 0.35) * Math.min(1, sp / 6) - WR.lean) * Math.min(1, dt * 4);
      const v = Math.hypot(WR.vx, WR.vz), nv = v + clamp(sp - v, -dt * 14, dt * (back ? 9 : 5));
      WR.vx = Math.sin(WR.heading) * nv; WR.vz = Math.cos(WR.heading) * nv;
      if (W.alive) WR.vz -= C * clamp(waterH(WR.x, WR.z) / 40, 0, 1) * 0.5; // the rising water drags at it
      WR.x += WR.vx * dt; WR.z += WR.vz * dt; WR.spin -= nv * dt / hoop.R;
      const far_ = Math.hypot(WR.x - L.x, WR.z - L.z) > 5;
      if (far_ && nv > 2 && Math.random() < dt * 8 * nv / 6) wake.spawn(WR.x + (Math.random() - 0.5) * 0.3, 0, WR.z + (Math.random() - 0.5) * 0.3, 0, 0, 0, 2.2 + Math.random());
      if (far_ && nv > 4 && Math.random() < dt * 25) spray.spawn(WR.x, waterH(WR.x, WR.z) + 0.1, WR.z, -WR.vx * 0.2 + (Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 2.5 * nv / 8, -WR.vz * 0.2 + (Math.random() - 0.5) * 1.5, 0.5 + Math.random() * 0.4);
      if (!back && d < 1.2) { wrenGo('scout'); WR.vx = WR.vz = 0; }
      if (back && d < 1.4) { wrenGo('dock'); hoop.g.visible = false; WR.out = false; WR.backAt = L.T; wren.visible = true; tone('clunk'); setTimeout(() => tone('chime'), 120); }
      if (!back && (L.phase === 'alarm' || L.wave < FL.ALARM)) wrenGo('back');
    } else if (WR.st === 'scout') { // sounds the water with its aerial lamp, then turns to the horizon
      const want = 0; WR.heading += clamp(Math.atan2(Math.sin(want - WR.heading), Math.cos(want - WR.heading)), -dt * 1.2, dt * 1.2); WR.lean *= 0.9;
      if (WR.t > 0.4 && WR.lineN === 0) { WR.lineN = 1; speak(L.loop ? 'Half a metre. Sand.' : 'Forty-eight centimetres. Sand.', 2.2); }
      if (L.phase === 'alarm' || L.wave < FL.ALARM) wrenGo('back');
    } else if (WR.st === 'dock') { // back up the chute onto its perch
      const k = Math.min(1, WR.t / 0.5); wren.position.set(lerp(-0.62, PERCH.x, k), lerp(1.12, PERCH.y, Math.sqrt(k)), lerp(2.72, PERCH.z, k)); wren.scale.setScalar(0.5 + 0.5 * k);
      if (k >= 1) { wrenHome(true); speak('Aboard. Go!', 1.8); }
    }
    // never left behind: if the flight leaves the water, it is aboard
    if (WR.st !== 'perch' && WR.st !== 'dock' && (L.phase === 'climb' || L.phase === 'out' || L.phase === 'wipe' || L.phase === 'entry')) { WR.late = WR.st; wrenHome(true); }
    if (WR.out) {
      hoop.g.visible = true; WR.y = -0.5 + hoop.R + Math.max(0, waterH(WR.x, WR.z));
      hoop.g.position.set(WR.x, WR.y, WR.z); hoop.g.rotation.set(0, WR.heading, WR.lean); hoop.roll.rotation.z = WR.spin;
      hoop.lamp.material.color.setRGB(2.8, 1.9, 0.8).multiplyScalar(WR.st === 'scout' ? 0.6 + 0.6 * (Math.sin(state.now * 9) > 0 ? 1 : 0) : 1);
      hoop.hub.rotation.y = WR.st === 'scout' ? Math.sin(state.now * 0.7) * 0.4 : 0;
    }
  }

  function onEvent(e) {
    if (e === 'reset') { days0 = state.ticks; lastSkipped = 0; for (const p of [steam, sheet, wisp, spray, mist, white, fine]) p.clear(); XR.spot = ''; XR.pendingSpot = ''; xs.centred = false;
      washT = 0; drainT = 1; wkPts.length = 0; wiped = false; pend.length = 0; for (const r of ripples) { r.t = 9; r.m.visible = false; } LT.t = 9; LT.next = 2.5; LT.thunder = 0; band.kick = 0; dip = 0; look.dx = look.dy = 0;
      wrenHome(true); dio.landerTrack.clear(); dio.wrenTrack.clear(); WR.trip = false; WR.armed = false; WR.lineN = 0; WR.late = ''; for (const s of shState) s.set = false; }
    else if (e === 'contact') { SFX.splash(clamp(0.25 + L.hit * 0.5, 0.2, 1)); washT = Math.max(washT, clamp(L.hit, 0.2, 1)); drainT = 0; burst(clamp(L.hit, 0.3, 1.5)); ripple(L.x, L.z, 1, 8); }
    else if (e === 'splash') { SFX.splash(1); washT = 1; drainT = 0; burst(1.6); ripple(L.x, L.z, 1.4, 9); ripple(L.x, L.z + 6, 1, 6); toggleSeq(['rail0', 'rail1', 'rail2', 'rail3'], 1, 0.6); WR.armed = true; }
    else if (e === 'clear') { [660, 880, 1320].forEach((f, i) => setTimeout(() => SFX.blip(f, 0.12, 0.06, 'triangle', 0.2), i * 90)); toggleSeq(['rail4', 'rail5', 'rail6', 'rail7'], 1, 0.1); }
    else if (e === 'cough') { const k = clamp(L.ingest * 1.4, 0.35, 1); tone('cough', k); band.kick = Math.max(band.kick, 0.9 * k); dip = 1; coughBurst(k); }
    else if (e === 'wipe') { SFX.wipe(); say('', '', 0); wiped = true; }
    else if (e === 'skip') { const sec = L.skipped - lastSkipped; lastSkipped = L.skipped; state.T += sec; say(`${Math.round(sec)} seconds later. ${ctx.fmtDays(Math.round(sec / DAY))} have gone by at home.`, '', 3.4); }
    else if (e === 'still' && wiped) { wiped = false; steam.clear(); sheet.clear(); spray.clear(); white.clear(); XR.spot = ''; XR.pendingSpot = ''; }
    else if (e === 'alarm') toggleSeq(['ov4', 'ov5'], 1, 0.2);
    else if (e === 'climb') toggleSeq(['lw0', 'lw1', 'lw2', 'lw3'], -1, 0.05);
  }
  // switches flipped by the systems: a click each
  const pend = [];
  function toggleSeq(ids, s, delay) { ids.forEach((id, i) => pend.push({ at: state.now + delay + i * 0.13, id, s })); }
  function switches() { for (let i = pend.length - 1; i >= 0; i--) { const p = pend[i]; if (state.now >= p.at) { pend.splice(i, 1); const ix = toggleIx[p.id]; if (ix !== undefined && tState[ix] !== p.s) { setToggle(ix, p.s); tone('click'); } } } }
  // the status lights: what they show, and a relay tick when one changes
  const LCOL = { off: new THREE.Color(0.08, 0.09, 0.12), teal: new THREE.Color(0.45, 1.6, 1.35), gold: new THREE.Color(1.8, 1.4, 0.45), coral: new THREE.Color(2.0, 0.62, 0.48), white: new THREE.Color(1.5, 1.5, 1.6) };
  const lState = {};
  function statusLights() {
    const fl = Math.floor(state.now * 4) % 2 === 0, fl2 = Math.floor(state.now * 2.5) % 2 === 0, flooded = L.main && L.ingest > 0.03;
    const want = {
      O0: L.ap > 0.5 ? 'gold' : 'off', O1: L.brake > 0.08 ? 'gold' : 'off', O2: L.contact > 0.3 ? 'teal' : 'off', O3: L.main ? 'teal' : 'off', O4: flooded ? (fl ? 'coral' : 'off') : L.main ? 'teal' : 'off',
      O5: W.alive && L.wave < FL.ALARM && L.wave > -200 ? (fl ? 'coral' : 'off') : 'off',
      L0: L.power > 0.05 ? 'teal' : 'off', L1: L.power > 0.4 ? 'teal' : 'off', L2: L.power > 0.8 ? 'teal' : 'off', L3: L.cough > 0.3 ? 'coral' : 'off', L4: L.rain > 0.2 ? 'white' : 'off', L5: L.heat > 0.1 ? 'coral' : 'off',
      R0: WR.out ? (fl2 ? 'gold' : 'off') : 'teal', R1: WR.st === 'scout' ? 'gold' : 'off', R2: L.cushion > 0.35 ? 'teal' : 'off', R3: L.shaker ? 'coral' : 'off', R4: L.pullup ? 'coral' : 'off', R5: env.inC > 0.3 ? 'white' : 'off',
    };
    let changed = 0;
    for (const id in want) { if (lState[id] === want[id]) continue; lState[id] = want[id]; const i = lightIx[id]; if (i === undefined) continue; lights.setColorAt(i, LCOL[want[id]]); changed++; }
    if (changed) { lights.instanceColor.needsUpdate = true; if (state.now - al.relay > 0.09 && flying()) { al.relay = state.now; tone('relay'); } }
  }
  // water thrown up by a touch on the sea: droplets and soft sheets, carried along with the hull
  const _w = V(), _w2 = V();
  const local = (x, y, z) => _w.set(x, y, z).applyMatrix4(ship.matrixWorld);
  function burst(k) {
    const n = Math.round((COARSE ? 90 : 180) * k), wy = waterH(L.x, L.z);
    for (let i = 0; i < n; i++) { const sd = Math.random() < 0.5 ? -1 : 1, p = local(sd * (0.6 + Math.random() * 6), 0, -3 + Math.random() * 6);
      spray.spawn(p.x, wy + 0.3, p.z, L.vx * 0.8 + (Math.random() - 0.5) * 16, 5 + Math.random() * 14 * k, L.vz * 0.8 + (Math.random() - 0.5) * 16, 0.9 + Math.random()); }
    for (let i = 0; i < n / 4; i++) { const p = local((Math.random() - 0.5) * 9, 0, 1 + Math.random() * 5);
      sheet.spawn(p.x, wy + 0.5, p.z, L.vx * 0.9 + (Math.random() - 0.5) * 8, 4 + Math.random() * 9 * k, L.vz * 0.9 + (Math.random() - 0.5) * 8, 0.8 + Math.random() * 0.8); }
    for (let i = 0; i < n; i++) { const p = local((Math.random() - 0.5) * 3, 0.3 + Math.random(), 3.6 + Math.random() * 2); fine.spawn(p.x, p.y, p.z, L.vx * 0.9 + (Math.random() - 0.5) * 5, 2 + Math.random() * 6 * k, L.vz * 0.9 + (Math.random() - 0.5) * 5, 0.5 + Math.random() * 0.5); }
  }
  // one cough: a slug of water and steam out of both nozzles at once
  function coughBurst(k) {
    const f = [Math.sin(L.yaw) * Math.cos(L.pitch), Math.sin(L.pitch), Math.cos(L.yaw) * Math.cos(L.pitch)], n = Math.round((COARSE ? 40 : 90) * k);
    for (let i = 0; i < n; i++) { const sd = i % 2 ? -1 : 1, p = local(sd * 1.75, 2.62, -4.1), sp = 30 + Math.random() * 40;
      steam.spawn(p.x, p.y, p.z, L.vx - f[0] * sp + (Math.random() - 0.5) * 12, L.vy + 3 + Math.random() * 8, L.vz - f[2] * sp + (Math.random() - 0.5) * 12, 1.6 + Math.random() * 1.6);
      spray.spawn(p.x, p.y, p.z, L.vx - f[0] * sp * 1.4 + (Math.random() - 0.5) * 16, L.vy + 4 + Math.random() * 14, L.vz - f[2] * sp * 1.4 + (Math.random() - 0.5) * 16, 1 + Math.random()); }
  }
  let wkAt = 0;
  function effects(dt) {
    const wy = waterH(L.x, L.z), Vh = Math.hypot(L.vx, L.vz);
    // skimming: the pressure under the wing lifts spray off the sea well before the floats touch, and touching throws sheets of it
    const skim = Math.exp(-Math.max(0, L.hk) / 4) * clamp((Vh - 25) / 60, 0, 1.4) + L.contact * clamp(Vh / 30, 0, 1.5);
    if (skim > 0.03) {
      let n = Math.floor(dt * (COARSE ? 220 : 420) * skim + Math.random());
      while (n-- > 0) { const sd = Math.random() < 0.5 ? -1 : 1, p = local(sd * (1.2 + Math.random() * 5.6), 0, -4 + Math.random() * 7);
        spray.spawn(p.x, wy + 0.2, p.z, L.vx * 0.55 + sd * Math.cos(L.yaw) * -6 + (Math.random() - 0.5) * 6, 2 + Math.random() * (5 + 8 * skim), L.vz * 0.55 + (Math.random() - 0.5) * 6, 0.6 + Math.random() * 0.7); }
      let m = Math.floor(dt * (COARSE ? 40 : 80) * skim + Math.random());
      while (m-- > 0) { const sd = Math.random() < 0.5 ? -1 : 1, p = local(sd * (1.5 + Math.random() * 4), 0, 0.5 + Math.random() * 5);
        sheet.spawn(p.x, wy + 0.4, p.z, L.vx * 0.82 + (Math.random() - 0.5) * 5, 2.5 + Math.random() * 6, L.vz * 0.82 + (Math.random() - 0.5) * 5, 0.5 + Math.random() * 0.6); }
      // the rooster tail: the wing's downwash digs a trough and throws a plume up behind, longer and higher the faster it goes
      const rt = Math.exp(-Math.max(0, L.hk) / 2.5) * clamp((Vh - 40) / 80, 0, 1.3) * (1 - L.contact * 0.5);
      let r = Math.floor(dt * (COARSE ? 160 : 320) * rt + Math.random());
      while (r-- > 0) { const p = local((Math.random() - 0.5) * 2.4, 0, -6 - Math.random() * 5);
        spray.spawn(p.x, wy + 0.2, p.z, L.vx * (0.5 + Math.random() * 0.3) + (Math.random() - 0.5) * 4, (6 + Vh * 0.11) * (0.6 + Math.random() * 0.6), L.vz * (0.5 + Math.random() * 0.3) + (Math.random() - 0.5) * 4, 0.9 + Math.random() * 0.9); }
      // droplets thrown at the glass when it is this low
      let g = Math.floor(dt * (COARSE ? 90 : 220) * skim * Math.exp(-Math.max(0, L.hk) / 2.5) + Math.random());
      while (g-- > 0) { const p = local((Math.random() - 0.5) * 2.4, 0.4, 4 + Math.random() * 3); fine.spawn(p.x, wy + 0.3, p.z, L.vx * 0.94 + (Math.random() - 0.5) * 3, 3 + Math.random() * 5, L.vz * 0.94 + (Math.random() - 0.5) * 3, 0.4 + Math.random() * 0.4); }
    }
    // foam left behind on the water
    wkAt -= dt;
    if (wkAt <= 0 && (L.contact > 0.2 || L.hk < 5 || (L.main && L.power > 0.3 && L.hk < 8))) { wkAt = 0.09;
      const last = wkPts[wkPts.length - 1]; if (!last || Math.hypot(L.x - last.x, L.z - last.z) > 1.5 || state.now - last.t > 0.5) { const p = local(0, 0, -2.5); wkPts.push({ x: p.x, z: p.z, t: state.now, k: clamp(0.35 + L.contact * 0.5 + Vh / 120 + L.power * 0.5, 0, 1) }); if (wkPts.length > WN) wkPts.shift(); } }
    // the engines blowing the water out: steam and spray from both nozzles, and steam rolling forward round the nose
    const ej = L.eject, blow = L.power * (L.main ? 1 : 0) * Math.exp(-Math.max(0, L.hk) / 9);
    if (ej > 0.02 || blow > 0.05) {
      const f = [Math.sin(L.yaw) * Math.cos(L.pitch), Math.sin(L.pitch), Math.cos(L.yaw) * Math.cos(L.pitch)];
      let n = Math.floor(dt * (COARSE ? 110 : 260) * (ej * (0.4 + L.cough) + blow * 0.7) + Math.random());
      while (n-- > 0) { const sd = Math.random() < 0.5 ? -1 : 1, p = local(sd * 1.75, 2.62, -4.1), sp = 22 + Math.random() * 50 * (0.3 + L.power + L.sput);
        steam.spawn(p.x, p.y, p.z, L.vx - f[0] * sp + (Math.random() - 0.5) * 9, L.vy - f[1] * sp + Math.random() * 5, L.vz - f[2] * sp + (Math.random() - 0.5) * 9, 1.4 + Math.random() * 1.6);
        if (Math.random() < 0.7) spray.spawn(p.x, p.y, p.z, L.vx - f[0] * sp * 1.3 + (Math.random() - 0.5) * 14, L.vy + 2 + Math.random() * 12, L.vz - f[2] * sp * 1.3 + (Math.random() - 0.5) * 14, 0.9 + Math.random() * 0.9);
        if (L.hk < 6 && Math.random() < 0.5) { const q = local(sd * (1 + Math.random() * 2.5), 0, -7 - Math.random() * 14); sheet.spawn(q.x, wy + 0.4, q.z, L.vx - f[0] * 12 + (Math.random() - 0.5) * 8, 5 + Math.random() * 12, L.vz - f[2] * 12 + (Math.random() - 0.5) * 8, 0.8 + Math.random() * 0.9); } }
      let k = Math.floor(dt * (COARSE ? 8 : 14) * (ej * 1.2 + blow) + Math.random());
      while (k-- > 0) { const sd = Math.random() < 0.5 ? -1 : 1, p = local(sd * (4 + Math.random() * 3), 0.6 + Math.random() * 1.5, -1 + Math.random() * 4); const vx = p.x, vy = p.y, vz = p.z, o = _w2.set(sd, 0, 0.6).transformDirection(ship.matrixWorld);
        steam.spawn(vx, Math.max(vy, wy + 0.4), vz, L.vx + o.x * (2 + Math.random() * 3), L.vy + 1.5 + Math.random() * 2.5, L.vz + o.z * (2 + Math.random() * 3), 1.6 + Math.random() * 1.8); }
    }
    // in the cloud: pale shreds go by
    if (env.inC > 0.2 && L.V > 40) { let n = Math.floor(dt * 26 * env.inC + Math.random());
      while (n-- > 0) { const d = 250 + Math.random() * 500, k = d / L.V; wisp.spawn(L.x + L.vx * k + (Math.random() - 0.5) * 260, L.y + L.vy * k + (Math.random() - 0.5) * 200, L.z + L.vz * k + (Math.random() - 0.5) * 260, 0, 0, 0, 2.6 + Math.random()); } }
    // mist rolling ahead of the wave's foot, where it first lifts the sea
    if (W.alive && L.wave < 12000 && L.wave > -500) { let n = Math.floor(dt * (COARSE ? 50 : 110) + Math.random());
      while (n-- > 0) { const x = L.x + (Math.random() - 0.5) * 5000, e = ctx.envX(x), s = -300 - Math.random() * 1300, z = W.zc + ctx.zOff(x) + s, h = W.H * e * ctx.prof(s);
        mist.spawn(x, h + 10 + Math.random() * 50, z, (Math.random() - 0.5) * 6, 2 + Math.random() * 6, -C * (0.75 + Math.random() * 0.2), 3 + Math.random() * 3); } }
    steam.update(dt); sheet.update(dt); wisp.update(dt); fine.update(dt);
    // the foam ribbon and the rings
    const age = 9, n = wkPts.length; for (let i = 0; i < WN; i++) { const o = i * 6, a = i * 4;
      if (i >= n) { wkPos.fill(0, o, o + 6); wkA.fill(0, a, a + 4); continue; }
      const p = wkPts[i], q = wkPts[Math.min(n - 1, i + 1)], r = wkPts[Math.max(0, i - 1)], dx = q.x - r.x, dz = q.z - r.z, dl = Math.hypot(dx, dz) || 1, ag = state.now - p.t, w = 1.4 + ag * 1.3, y = Math.max(0, waterH(p.x, p.z)) + 0.04;
      const nx = -dz / dl * w, nz = dx / dl * w; wkPos.set([p.x + nx, y, p.z + nz, p.x - nx, y, p.z - nz], o); const al_ = clamp(1 - ag / age, 0, 1) * p.k * (i === 0 || i === n - 1 ? 0 : 1); wkA.set([0, al_, 1, al_], a); }
    wkGeo.attributes.position.needsUpdate = true; wkGeo.attributes.aA.needsUpdate = true; wakeFoam.material.uniforms.uTime.value = state.now;
    for (const r of ripples) { if (r.t > 6) { r.m.visible = false; continue; } r.t += dt; const rad = 1.5 + r.v * r.t * (1 - r.t / 14); r.m.scale.setScalar(rad); r.m.position.y = Math.max(0, waterH(r.m.position.x, r.m.position.z)) + 0.03; r.m.material.uniforms.uR.value = clamp(1 - r.t / 6, 0, 1) * r.k * 0.75; }
  }
  const _rv = V(), _cf = V();
  function rainLines(eye) {
    const k = L.rain * (0.25 + 0.75 * env.inC + 0.6 * env.below); rain.visible = k > 0.03; if (!rain.visible) return;
    _rv.set(-L.vx, -11 - L.vy, -L.vz); const sp = _rv.length(), len = clamp(sp * 0.022, 0.5, 5); // the rain falls at 11 m/s; the rest is our own speed
    rOff.addScaledVector(_rv, state.dtFly || 0); const ux = _rv.x / sp, uy = _rv.y / sp, uz = _rv.z / sp;
    for (let i = 0; i < RN; i++) { const j = i * 3, o = i * 6;
      const x = ((rBase[j] * RBOX[0] + rOff.x) % RBOX[0] + RBOX[0]) % RBOX[0] - RBOX[0] / 2 + eye.x, y = ((rBase[j + 1] * RBOX[1] + rOff.y) % RBOX[1] + RBOX[1]) % RBOX[1] - RBOX[1] / 2 + eye.y, z = ((rBase[j + 2] * RBOX[2] + rOff.z) % RBOX[2] + RBOX[2]) % RBOX[2] - RBOX[2] / 2 + eye.z;
      rPos[o] = x; rPos[o + 1] = y; rPos[o + 2] = z; rPos[o + 3] = x - ux * len; rPos[o + 4] = y - uy * len; rPos[o + 5] = z - uz * len; }
    rGeo.attributes.position.needsUpdate = true;
    // rain is lit by the sun when you look toward it
    camera.getWorldDirection(_cf); const fw = Math.pow(Math.max(0, _cf.dot(SUN_DIR)), 3) * env.sunI;
    rain.material.color.copy(RAIN0).lerp(RAINSUN, clamp(fw * 1.5, 0, 1)); rain.material.opacity = (0.34 + 0.3 * fw) * clamp(k, 0, 1);
  }

  // ---------- one step of the experience ----------
  function start() {
    state.game = 'fly'; state.phase = 'fly'; state.t = 0; craft.visible = false; ship.visible = true; wake.clear(); setView('in', true);
    flight.reset(0); cuePhase = ''; fade(false); for (const m of waterMats) { m.userData.u.uPatch.value = 1; m.roughness = 0.42; }
    const b = $('view'); if (b) b.hidden = false; document.body.classList.add('fly');
  }
  // the title: the lander at rest on the knee-deep sea
  function pose() { ship.visible = true; craft.visible = false; Object.assign(L, { x: 0, y: -FL.DRAFT, z: 0, pitch: 0, roll: 0, yaw: 0, vx: 0, vy: 0, vz: 0, V: 0, hk: -FL.DRAFT, gam: 0, phase: 'title' }); ship.position.set(0, -FL.DRAFT, 0); ship.rotation.set(0, 0, 0); ship.updateMatrixWorld(true); drawInstruments(); }
  function stop() { Object.assign(clear, { want: 0, y: 0, shown: 0, hold: 0 }); for (const id of CLEAR_IDS) { const e = $(id); if (e) e.style.translate = ''; } ship.visible = false; craft.visible = true; hoop.g.visible = false; clearWeather(); quiet(); for (const m of waterMats) m.roughness = 0.32; const b = $('view'); if (b) b.hidden = true; document.body.classList.remove('fly'); setView('in', true); }
  function restart() { flight.reset(L.loop + 1); fade(false); }
  function update(dt) {
    state.dtFly = dt;
    const inp = input();
    flight.step(dt, inp);
    for (const e of L.events.splice(0)) onEvent(e);
    fade(L.fade);
    // the hull in the world; a wipe-out tumbles it
    const tumble = L.phase === 'wipe' ? L.spin : 0, level = XR.on && XR.mode === 'ride' && xs.level;
    ship.position.set(L.x, L.y, L.z);
    ship.rotation.set(level ? 0 : -L.pitch + tumble * 1.3, L.yaw, level ? 0 : L.roll + Math.sin(tumble * 2) * 0.6);
    ship.updateMatrixWorld(true);
    band.kick *= Math.exp(-dt * 6); dip *= Math.exp(-dt * 7);
    bands();
    // the side stick follows the hand (and shakes in the buffet), the throttle follows the left hand
    const shk = L.shaker ? 0.035 * Math.sin(state.now * 2 * Math.PI * 16) : 0;
    stick.rotation.set(-L.sy * 0.32 + jig(11, 0.02, 0.03, 0.012) + shk, 0, L.sx * 0.32 + jig(12, 0.02, 0.03, 0.012));
    lever.rotation.x = -0.55 + L.thr * 1.1 + jig(13, 0.01, 0.02, 0.012);
    needleArm.parent.rotation.z = -1.1 + 2.2 * (L.main ? L.ingest : 0) + jig(17, 0.01, 0.04, 0.02);
    // things that hang swing with the g
    const sf = _v.set(-L.ny, L.nz, L.nx); // the push of the seat, in the lander's own axes (x is to the left)
    for (const s of sway) { const tz = Math.atan2(-sf.x, Math.max(0.2, sf.y)), tx = Math.atan2(sf.z, Math.max(0.2, sf.y)), w2 = GRAV / s.len * 0.25;
      s.vz += (-(s.az - tz) * w2 - s.vz * 2.2) * dt; s.vx += (-(s.ax - tx) * w2 - s.vx * 2.2) * dt; s.az += s.vz * dt; s.ax += s.vx * dt;
      s.g.rotation.set(s.ax + jig(21, 0.02, 0.05, 0.01), 0, s.az + jig(22, 0.02, 0.05, 0.01)); }
    // WREN on its perch turns to the wave once it matters, otherwise to the way ahead; it turns to you when it speaks
    const toWave = W.alive && L.wave < 9000 && L.wave > 0 ? 1 : 0;
    speakT = Math.max(0, speakT - dt);
    wrenBall.rotation.y = lerp(wrenBall.rotation.y, speakT > 0.4 && !WR.out ? Math.PI + 0.55 : toWave ? 0.15 : Math.sin(state.now * 0.4) * 0.6, 0.06);
    wrenBall.rotation.x = lerp(wrenBall.rotation.x, toWave ? -clamp(Math.atan2(HMAX, Math.max(300, L.wave)), 0, 1.1) : 0.1, 0.05) + jig(16, 0.01, 0.02, 0.01);
    wrenRing.rotation.y = Math.sin(state.now * 0.3) * 0.2 + wrenBall.rotation.y * 0.3; wrenRing.rotation.x = jig(18, 0.05, 0.08, 0.02);
    wrenEye.color.setRGB(1.5, 1.05, 0.42).multiplyScalar(speakT > 0 ? 1.3 + 0.4 * Math.sin(state.now * 30) : 1);
    wrenStep(dt); switches();
    if ((++frameN % 3 === 0 || dispStale) && !state.skipRender) { drawInstruments(); dispStale = false; } else if (state.skipRender) dispStale = true; /* frames that are not drawn do not paint the display */
    if (frameN % 3 === 0) statusLights();
    washT = Math.max(0, washT - dt * 0.28); drainT = Math.min(1, drainT + dt / 3.2);
    gU.uTime.value = state.now; gU.uRain.value = clamp(L.rain + fine.live() / (COARSE ? 300 : 600), 0, 1.2); gU.uSpeed.value = clamp(L.V / 220, 0, 1); gU.uWash.value = washT; gU.uDrain.value = drainT; gU.uHeat.value = L.heat;
    gU.uFog.value = env.inC * 0.8 + (L.phase === 'still' || L.phase === 'alarm' ? 0.1 : 0); gU.uFlash.value = env.flash * 0.5;
    gU.uSun.value.copy(SUN_DIR).applyQuaternion(_q.copy(ship.quaternion).invert()); gU.uSunI.value = env.sunI; gU.uLit.value = clamp(0.55 + 0.45 * env.lum, 0.5, 1.15);
    // light in the cabin: the display glows more in the dark, the lightning floods it
    const dark = clamp(1 - env.lum, 0, 1);
    cabin.intensity = 0.25 + 1.6 * dark + 6 * env.flash; cabin.color.setRGB(0.8 + env.flash * 0.2, 0.9, 0.95);
    ghost.material.opacity = clamp(0.06 * dark, 0, 0.06) * (view === 'in' ? 1 : 0);
    effects(dt); cues(); haptics(); views(dt / Math.max(0.3, state.timeScale || 1));
    // text
    const takeoff = L.phase === 'alarm' || L.phase === 'face' || L.phase === 'climb';
    if (XR.on) hint('');
    else if (isDio()) hint(L.auto ? `autopilot <i>· ${COARSE ? 'drag still flies her' : 'the stick still flies her · V: next view'}</i>` : (COARSE ? 'drag: stick <i>· hold: throttle</i>' : 'the stick flies her from here too <i>· V: next view</i>'));
    else if (L.auto) hint(`autopilot <i>· ${COARSE ? 'drag to fly' : 'drag or WASD to fly'}</i>`); // short enough to hang between the grab loops (looking round is in #help)
    else hint(takeoff ? (COARSE ? 'keep holding: full throttle' : 'hold (or space): full throttle') : L.phase === 'still' ? '' : (COARSE ? 'follow the ring <i>· hold: throttle</i>' : 'steer to the ring <i>· hold: throttle</i>'));
    $('thr').style.opacity = view === 'in' || isDio() ? 0 : 1; $('thr').firstChild.style.width = (L.thr * 100).toFixed(0) + '%';
    fdCue();
  }
  // the words at the top keep clear of the two grab loops: where a loop hangs (or swings) into their band they step down below it, eased
  const LOOP_PTS = [[0, -0.04], [-0.06, -0.2], [0.06, -0.2], [0, -0.262], [-0.058, -0.15], [0.058, -0.15]], CLEAR_IDS = ['hint', 'caption', 'help'];
  const clear = { at: -9, want: 0, y: 0, shown: 0 };
  function loopRects() {
    const out = []; camera.updateMatrixWorld(); // (the renderer would do this, but stepped frames are not drawn)
    for (const s of sway.slice(0, 2)) { s.g.updateMatrixWorld(true); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = false;
      for (const [x, y] of LOOP_PTS) { _v.set(x, y, 0).applyMatrix4(s.g.matrixWorld).project(camera); if (_v.z > 1) behind = true;
        const px = (_v.x + 1) / 2 * innerWidth, py = (1 - _v.y) / 2 * innerHeight; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      if (!behind) out.push([x0, y0, x1, y1]); }
    return out;
  }
  function keepClear(dt) {
    if (state.now - clear.at > 0.1 || state.now < clear.at) { clear.at = state.now; let want = 0;
      if (!XR.on && VS.wIn > 0.5 && document.body.classList.contains('fly')) {
        const loops = loopRects();
        for (const id of CLEAR_IDS) { const e = $(id); if (!e || !e.textContent.trim() || (id === 'hint' ? !e.classList.contains('on') : e.style.opacity === '0')) continue;
          const r = e.getBoundingClientRect(); if (r.width < 1) continue; const top = r.top - clear.y, bot = r.bottom - clear.y;
          for (const q of loops) if (q[2] > r.left - 12 && q[0] < r.right + 12 && q[3] > top - 8 && q[1] < bot + 8) want = Math.max(want, q[3] + 10 - top); }
      }
      // a loop swinging into the words moves them at once; they come back up only once it has stayed clear for a while (no bobbing with the swing)
      if (want > clear.want) { clear.want = want; clear.hold = state.now; } else if (state.now - (clear.hold || 0) > 1.2 && (clear.want - want > 6 || want === 0)) { clear.want = want; clear.hold = state.now; } }
    const y = clear.y + (clear.want - clear.y) * Math.min(1, dt * (clear.want > clear.y ? 20 : 3)); // out of a loop's way quickly, back up gently
    clear.y = Math.abs(y - clear.want) < 0.5 ? clear.want : y;
    if (Math.abs(clear.y - clear.shown) >= 0.5 || (clear.y === 0 && clear.shown !== 0)) { clear.shown = clear.y; const t = clear.y ? `0 ${clear.y.toFixed(1)}px` : ''; for (const id of CLEAR_IDS) { const e = $(id); if (e) e.style.translate = t; } }
  }
  // the flight director on the glass: a ring where the computer would put the stick; steer the little cross into it
  function fdCue() {
    const el = $('fd'); if (!el) return;
    const on = !XR.on && VS.wIn > 0.9 && VS.mix < 0.1 && !L.auto && L.ap < 0.5 && ['entry', 'cloud', 'approach', 'skim', 'climb', 'out'].includes(L.phase);
    el.classList.toggle('on', on); if (!on) return;
    const R = Math.min(innerWidth, innerHeight) * 0.16, dx = clamp(L.fd.sx - L.sx, -1, 1) * R, dy = clamp(L.fd.sy - L.sy, -1, 1) * R;
    el.firstChild.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`; el.classList.toggle('good', Math.hypot(dx, dy) < R * 0.18); el.classList.toggle('thr', L.fd.hold > 0.5 && L.thr < 0.8);
  }

  // ---------- the eye ----------
  const EYE = V(...FL.EYE), qFlip = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI), qHead = new THREE.Quaternion(), eHead = new THREE.Euler(0, 0, 0, 'YXZ'), head = V(), _eye = V();
  let lookS = 0, turnS = 0;
  function cameraIn(real) {
    // the head rides on the neck: it lags the g (down, back, and to the outside of a turn) and takes its share of every band of shake
    const tx = clamp(-(L.nz - 1) * 0.022, -0.06, 0.05), tz = clamp(-L.nx * 0.03, -0.07, 0.07), ty = clamp(L.ny * 0.04, -0.06, 0.06);
    head.set(ty + jig(1, 0.012, 0.004, 0.0012), tx + jig(4, 0.02, 0.006, 0.0015), tz + jig(5, 0.006, 0.003, 0.001));
    camera.position.copy(EYE).add(head).applyMatrix4(ship.matrixWorld);
    // in a steep climb the pilot looks down through the glass at the water; in a dive, up a little; into a turn, toward its inside
    lookS += (clamp((L.pitch - 0.45) * 0.5, 0, 0.3) - lookS) * Math.min(1, real * 2.5);
    turnS += (clamp(-L.roll * 0.22 - L.rollRate * 0.05, -0.32, 0.32) - turnS) * Math.min(1, real * 2);
    // free look: right-drag or two fingers, the mouse's place on the screen when not steering, a gamepad's right stick; and WREN when it is out
    const st = steering(), hov = state.now - look.hAt < 6 && !st && !look.drag ? 1 : 0;
    const dz = (v) => Math.sign(v) * Math.max(0, Math.abs(v) - 0.28) / 0.72;
    if (!look.drag && state.now - look.relAt > 1.6) { const k = Math.min(1, real * 1.2); look.dx -= look.dx * k; look.dy -= look.dy * k; }
    let wy = 0; if (WR.out && (WR.st === 'scout' || WR.st === 'back') && !st) { _v2.set(WR.x, WR.y, WR.z); ship.worldToLocal(_v2); wy = clamp(Math.atan2(_v2.x, _v2.z - EYE.z) * 0.45, -0.32, 0.32); }
    const tyaw = look.dx - dz(look.hx) * 0.75 * hov + (look.px || 0) * 0.9 * (st ? 0 : 1) + (Math.abs(look.dx) < 0.05 && !hov ? wy : 0), tpit = look.dy - dz(look.hy) * 0.38 * hov - (look.py || 0) * 0.5 * (st ? 0 : 1);
    look.x += (tyaw - look.x) * Math.min(1, real * 5); look.y += (tpit - look.y) * Math.min(1, real * 5);
    // a tall (portrait) screen sees much more below the panel: lift the gaze so the panel sits at the bottom edge and the height goes to the sky and the wave
    const tall = clamp((0.8 / camera.aspect - 1) / 0.5, 0, 1);
    eHead.set(-0.22 + 0.32 * tall - lookS + look.y + jig(7, 0.012, 0.004, 0.001), turnS + look.x + jig(8, 0.006, 0.002, 0.0006), -L.roll * 0.12 + jig(9, 0.01, 0.004, 0.001));
    camera.quaternion.copy(ship.quaternion).multiply(qFlip).multiply(qHead.setFromEuler(eHead));
    const fov = 68 * (camera.aspect < 1 ? clamp(0.8 / camera.aspect, 1, 1.62) : 1);
    if (Math.abs(camera.fov - fov) > 0.01 || camera.near !== 0.06) { camera.fov = fov; camera.near = 0.06; camera.updateProjectionMatrix(); }
  }
  function cameraOut() {
    const a = 0.9 + state.now * 0.07, takeoff = L.phase === 'still' || L.phase === 'alarm' || L.phase === 'face', d = takeoff ? 30 : 38;
    camera.position.set(L.x + Math.sin(a) * d, L.y + (takeoff ? 5 : 9), L.z + Math.cos(a) * d);
    const wy = waterH(camera.position.x, camera.position.z); if (camera.position.y < wy + 1.5) camera.position.y = wy + 1.5;
    camera.lookAt(L.x, L.y + 2, L.z);
    const fov = 46 * (camera.aspect < 1 ? clamp(0.8 / camera.aspect, 1, 1.6) : 1);
    if (Math.abs(camera.fov - fov) > 0.01 || camera.near !== 0.4) { camera.fov = fov; camera.near = 0.4; camera.updateProjectionMatrix(); }
  }
  // the sun's shadow box: tight round the cockpit when you sit in it (sharp shadows of the ribs on the panel), wider outside
  let shadowBox = 0;
  function shadowFit(r) { if (shadowBox === r) return; shadowBox = r; Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r }); sun.shadow.camera.updateProjectionMatrix(); }
  function follow(p) {
    placeWorld(p); deck.position.x = p.x; deck.position.z = p.z;
    const inside = VS.wIn > 0.5 && !XR.on, c = inside ? local(0, 1.6, 2.6) : _w.set(L.x, L.y, L.z); shadowFit(inside ? 4 : 22);
    sun.position.copy(c).addScaledVector(SUN_DIR, 200); sun.target.position.copy(c);
    weather(p, state.dtFly || 1 / 60); rainLines(p);
    const pl = clamp(0.38 + 0.62 * env.lum, 0.36, 1.05) + env.flash * 0.4;
    for (const ps of [spray, mist, white, wake, steam, sheet, wisp, fine]) { const m = ps.mat; (m.userData.base ||= m.color.clone()); m.color.copy(m.userData.base).multiplyScalar(pl); }
    shafts.visible = quality < 3 && env.below > 0.3 && env.sunI > 0.1 && !isDio(); if (shafts.visible) { placeShafts(p); shafts.material.uniforms.uA.value = env.below * env.sunI; shafts.material.uniforms.uTime.value = state.now; }
    if (floorMat && floorMat.userData.u) floorMat.userData.u.uTime.value = state.now;
  }
  // the world camera: the cockpit, outside, or on the way between them along a rising arc
  const _pa = V(), _qa = new THREE.Quaternion(), _pb = V(), _qb = new THREE.Quaternion(), _up = V(0, 1, 0);
  function worldCamera(real) {
    const e = VS.wIn * VS.wIn * (3 - 2 * VS.wIn);
    if (e >= 0.999 || XR.on) { cameraIn(real); return; }
    if (e <= 0.001) { cameraOut(); return; }
    cameraIn(real); _pa.copy(camera.position); _qa.copy(camera.quaternion); const fA = camera.fov, nA = camera.near;
    cameraOut(); _pb.copy(camera.position); _qb.copy(camera.quaternion); const fB = camera.fov, nB = camera.near, u = 1 - e;
    camera.position.lerpVectors(_pa, _pb, u).addScaledVector(_up, Math.sin(Math.PI * u) * 6);
    camera.quaternion.slerpQuaternions(_qa, _qb, u * u * (3 - 2 * u)); camera.fov = lerp(fA, fB, u); camera.near = lerp(nA, nB, u); camera.updateProjectionMatrix();
  }
  // the live model block and its words: a scale bar, labels that follow their subjects, and a caption with the live numbers
  const fmtM = (d) => (Math.abs(d) < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`);
  function dioUpdate(real) {
    const el = $('dio');
    if (VS.mix <= 0.001 || XR.on) { el.classList.remove('on'); el.style.opacity = ''; VS.lab = {}; return; }
    const S = Math.exp(VS.logS);
    dio.update({ S, cx: VS.cx, cz: VS.cz, L, wren: WR, az: VS.az, aspect: innerWidth / innerHeight, dt: real, rainK: L.rain * (0.4 + 0.6 * clamp(env.below + env.inC, 0, 1)), over: clamp(env.inC + env.below * 0.9, 0, 1), sunA: env.sunI, step: VS.step, W, snap: VS.snap, now: state.now });
    VS.snap = false;
    const st = dio.st; el.classList.add('on'); el.style.opacity = VS.mixE.toFixed(3);
    // a scale bar of a round length about 110 px long, eased as the scale changes
    const nice = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000], want = 110 / st.ppm, len = nice.find((n) => n >= want * 0.7) || 5000;
    if (len !== VS.len) { VS.len = len; el.querySelector('.len').textContent = len >= 1000 ? `${len / 1000} km` : `${len} m`; VS.barW = len * st.ppm; }
    VS.barW += (len * st.ppm - VS.barW) * Math.min(1, real * 10); el.querySelector('.bar').style.width = VS.barW.toFixed(1) + 'px';
    if (state.now - VS.capAt > 0.25) { VS.capAt = state.now;
      const parts = [`Sea ${fmtM(S)} across, half a metre deep`];
      if (W.alive && L.wave > -3000 && L.wave < 30000) parts.push(L.wave > 0 ? `the wave: ${fmtM(L.wave)} away · ${Math.round(L.wave / C)} s` : `the wave: past, ${fmtM(-L.wave)} on`);
      parts.push(L.hk > 3 ? `the lander: ${fmtM(L.hk)} up · ${Math.round(L.V)} m/s` : 'the lander: 13 m, on the water');
      el.querySelector('.cap').textContent = parts.join(' · '); }
    const lab = (cls, show, x, y, z, text) => { const e = el.querySelector(cls); e.style.opacity = show ? 1 : 0; if (!show) { delete VS.lab[cls]; return; }
      const p = dio.project(x, y, z), q = VS.lab[cls] || (VS.lab[cls] = [p[0], p[1]]), k = Math.min(1, real * 14); q[0] += (p[0] - q[0]) * k; q[1] += (p[1] - q[1]) * k;
      e.style.transform = `translate(${q[0].toFixed(1)}px, ${q[1].toFixed(1)}px)`; if (text && e.lastChild.textContent !== text) e.lastChild.textContent = text; };
    const small = S < 400;
    lab('.lp', dio.mini.visible, L.x, L.y + (small ? 3 : 6 + S * 0.07), L.z, small ? 'Heron, the lander' : 'the lander');
    lab('.wp', WR.out && small, WR.x, WR.y + 1 + S * 0.06, WR.z, 'WREN');
    lab('.hp', st.crestIn, L.x, st.hmax, st.crestAt, `wave ${(Math.round(st.hmax / 10) * 10).toLocaleString('en')} m`);
    // two labels close together (the lander just under the crest, on a narrow screen): the lander's name drops below its pin
    const word = (cls, dy) => { const q = VS.lab[cls]; if (!q) return null; const w = el.querySelector(cls + ' span').offsetWidth; return [q[0] + 6, q[1] + dy - 4, q[0] + 14 + w, q[1] + dy + 14]; };
    const dot = (cls) => { const q = VS.lab[cls]; return q ? [q[0] - 6, q[1] - 6, q[0] + 6, q[1] + 6] : null; };
    const meet = (a, b) => !!(a && b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]);
    const lp = word('.lp', -17), crowd = ['.hp', '.wp'].some((c) => meet(lp, word(c, -17)) || meet(lp, dot(c)));
    el.querySelector('.lp').classList.toggle('low', crowd);
    // and if the wave's name would run over the lander's pin, it goes to the left of its own dot
    const hq = VS.lab['.hp'], hw = word('.hp', -17), hl = hq && hw ? [2 * hq[0] - hw[2], hw[1], 2 * hq[0] - hw[0], hw[3]] : null, lw = word('.lp', crowd ? 8 : -17);
    el.querySelector('.hp').classList.toggle('left', meet(hw, dot('.lp')) || meet(hw, lw) ? !(meet(hl, dot('.lp')) || meet(hl, lw)) : false);
  }
  function cam(real) {
    worldCamera(real); follow(camera.position); dioUpdate(real); keepClear(real); // (after the camera is placed: at 360 m/s a frame-old camera is metres behind the loops)
    for (const m of bodyMeshes) m.visible = !XR.on; handR.visible = handL.visible = !XR.on;
  }
  // what to draw: the world, the block, or the block fading in over the world
  const target = () => (VS.mix > 0.001 ? { scene: dio.scene, camera: dio.cam, mix: VS.mixE } : null);

  // ---------- in a headset ----------
  // Seat (the default): you are in the pilot's seat; the cockpit round you is the fixed frame of reference. "Level" (default) keeps that
  // cockpit upright, so the world never tilts under you: the lander's pitch and roll are shown on the instruments instead. "Tilt"
  // gives the true attitude. The view is never shaken; the stick, the instruments and the controllers' motors are. Watch: you stand
  // on the water near where it lands and never move on your own. "Model" puts the wide block on a little table in front of you.
  const xs = { centred: false, level: true, head: V(), anchor: V(40, 0, 15), mode: '', p0: null, model: false };
  const table = new THREE.Group(); rig.add(table);
  const _rq = new THREE.Quaternion(), _h = V();
  function xr(real, frame) {
    xin.sx = xin.sy = 0;
    if (XR.mode !== xs.mode) { xs.mode = XR.mode; xs.centred = false; XR.spot = ''; XR.pendingSpot = ''; }
    if (XR.mode === 'ride') {
      if (!xs.centred && renderer.xr.isPresenting) { xs.head.copy(xrCam.position); if (xs.head.lengthSq() > 0 || !XR.floor) { xs.centred = true; panel.position.set(xs.head.x + 0.4, xs.head.y - 0.34, xs.head.z - 0.46); panel.rotation.set(-0.5, -0.6, 0, 'YXZ'); } }
      _rq.copy(ship.quaternion).multiply(qFlip); rig.quaternion.copy(_rq);
      rig.position.copy(EYE).applyMatrix4(ship.matrixWorld).sub(_h.copy(xs.head).applyQuaternion(_rq));
      const k = clamp(Math.abs(L.vy) / 320 + Math.abs(L.pitchRate) * (xs.level ? 0.1 : 0.5) + Math.abs(L.nz - 1) * 0.08, 0, 0.55);
      vign.material.uniforms.a.value += (k - vign.material.uniforms.a.value) * Math.min(1, real * 3); vign.visible = vign.material.uniforms.a.value > 0.02;
      XR.fadeTo = L.fade ? 1 : L.phase === 'wipe' ? 0.85 : 0;
      if (frame && XR.session) { const ref = renderer.xr.getReferenceSpace();
        for (const src of XR.session.inputSources) { const gp = src.gamepad; if (gp && gp.axes && gp.axes.length >= 4) { const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v); xin.sx += dz(gp.axes[2]); xin.sy += dz(gp.axes[3]); } }
        const src = XR.holdSrc; if (src && XR.holds.get(src) === 'hold') { const pose = frame.getPose(src.gripSpace || src.targetRaySpace, ref);
          if (pose) { const p = pose.transform.position; if (!xs.p0 || xs.src !== src) { xs.p0 = { x: p.x, y: p.y, z: p.z }; xs.src = src; } xin.sx += clamp((p.x - xs.p0.x) / 0.12, -1, 1); xin.sy += clamp((p.z - xs.p0.z) / 0.12, -1, 1); } } else { xs.p0 = null; xs.src = null; } }
      xin.sx = clamp(xin.sx, -1, 1); xin.sy = clamp(xin.sy, -1, 1);
    } else {
      vign.visible = false; rig.quaternion.identity();
      if (!XR.spot) { XR.spot = 'a'; xs.anchor.set(40, 0, 15); panel.position.set(0, XR.floor ? 0.92 : -0.62, -0.55); panel.rotation.set(-0.55, 0, 0); xs.centred = false; }
      const landed = L.phase === 'still' || L.phase === 'alarm';
      if (XR.spot === 'a' && !XR.pendingSpot && landed && Math.hypot(L.x + 34 - xs.anchor.x, L.z - 65 - xs.anchor.z) > 90) XR.pendingSpot = 'a2';
      if ((XR.spot === 'a' || XR.spot === 'a2') && !XR.pendingSpot && W.alive && waterH(xs.anchor.x, xs.anchor.z) > 0.6) XR.pendingSpot = 'b';
      if (XR.pendingSpot) { XR.fadeTo = 1; if (XR.fade > 0.98) { XR.spot = XR.pendingSpot; XR.pendingSpot = ''; XR.cuts = (XR.cuts || 0) + 1; if (XR.spot === 'b') xs.anchor.set(46, 0, W.zc + 2600); else xs.anchor.set(L.x + 34, 0, L.z - 65); } }
      else XR.fadeTo = L.fade ? 1 : 0;
      rig.position.set(xs.anchor.x, Math.max(0, waterH(xs.anchor.x, xs.anchor.z)), xs.anchor.z); rig.rotation.set(0, XR.spot === 'b' ? 0 : Math.PI, 0);
    }
    // the tabletop model: below and in front of where the head sits, never moving the viewer
    if (xs.model) {
      const first = dio.model.parent !== table; if (first) table.add(dio.model);
      const step = L.phase === 'climb' || L.phase === 'face' ? 'mid' : 'far', S = BLOCKS[step], t = blockTarget(step, S);
      if (first || xs.tStep !== step) { xs.tStep = step; xs.tcx = t.x; xs.tcz = t.z; } xs.tcx += (t.x - xs.tcx) * Math.min(1, real * 2); xs.tcz += (t.z - xs.tcz) * Math.min(1, real * 2);
      dio.update({ S, cx: xs.tcx, cz: xs.tcz, L, wren: WR, az: 0, aspect: 1, dt: real, rainK: L.rain * 0.6, over: clamp(env.inC + env.below * 0.9, 0, 1), sunA: env.sunI, step, W, snap: first, now: state.now });
      const hp = XR.mode === 'ride' ? xs.head : _h.set(0, XR.floor ? 1.4 : 0, 0); table.position.set(hp.x - 0.42, hp.y - 0.36, hp.z - 0.46); table.scale.setScalar(0.32); table.visible = true; /* front-left, over the throttle side: the instruments and the menu stay clear */
    } else if (dio.model.parent === table) { dio.scene.add(dio.model); table.visible = false; }
    rig.updateMatrixWorld(true);
    follow(_eye.copy(xrCam.position).applyMatrix4(rig.matrixWorld));
    for (const m of bodyMeshes) m.visible = false; handR.visible = handL.visible = false;
  }
  function setQuality(l) { quality = l; gU.uQ.value = l === 0 ? 1 : 0; dio.setQuality(l); }

  const api = { L, flight, FL, shakeOf, hap, xs, env, ship, stick, lever, band, inst, glass, cabin, dio, hoop, WR, CUT, VS, look, lights, lightIx, LCOL, lState, tState, toggleIx, sway, LT,
    get view() { return view; }, get userView() { return userView; }, setView, cycleView, input: (o) => { testIn = o; }, auto: (v) => { forceAuto = v; }, cuts: (on) => { CUT.on = on; },
    rain: () => ({ visible: rain.visible, streaks: RN, opacity: +rain.material.opacity.toFixed(3), glass: +gU.uRain.value.toFixed(2), wash: +washT.toFixed(2), drain: +drainT.toFixed(2), fog: +gU.uFog.value.toFixed(2) }),
    live: () => ({ spray: spray.live(), sheet: sheet.live(), steam: steam.live(), wisp: wisp.live(), fine: fine.live(), wake: wkPts.length, ripples: ripples.filter((r) => r.m.visible).length }),
    audio: () => (A ? { built: true, state: A.ac.state, eng: +A.eng.gain.value.toFixed(3), wind: +A.wind.g.gain.value.toFixed(3), rain: +A.rain.g.gain.value.toFixed(3), drum: +A.drum.g.gain.value.toFixed(3) } : { built: false }),
    light: () => ({ sun: +sun.intensity.toFixed(3), hemi: +hemi.intensity.toFixed(3), exposure: +env.exposure.toFixed(3), shade: +env.shade.toFixed(3), sunI: +env.sunI.toFixed(3), flash: +env.flash.toFixed(3), cabin: +cabin.intensity.toFixed(3), sunDir: SUN_DIR.toArray().map((v) => +v.toFixed(3)),
      over: +sky.material.uniforms.uOver.value.toFixed(3), skySun: +sky.material.uniforms.uSunA.value.toFixed(3), waterSun: +waterMats[0].userData.u.uSunA.value.toFixed(3), shafts: shafts.visible, lightning: LT.n }),
    minFont: () => minFont, compact, pads: () => pad.n, target };
  return { flight, L, start, stop, pose, restart, update, camera: cam, xr, sound, quiet, api, xs, setView, cycleView, target, setQuality, get view() { return view; }, model: (on) => { xs.model = on; } };
}
