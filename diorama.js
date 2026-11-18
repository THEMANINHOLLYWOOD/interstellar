// The wide view: a live square block cut out of the knee-deep sea, floating on the paper like a model on a table, seen from
// three-quarters above with an orthographic camera (no perspective, so sizes compare honestly). It is not an illustration: every frame
// it draws the running simulation. The sea's surface and the cut faces of the water take their height on the GPU from the same wave
// formula and the same uniforms the flight uses; the lander, WREN, their tracks, the spray, the engine plumes, the foam, the rings, the
// spindrift and the mist are the real ones, sharing their geometry. True scale throughout (the chop alone is raised in the close block
// so it can be seen). The block's size eases continuously between 120 m, 3 km and 9 km, so changing scale reads as one pull-out.
export const BLOCKS = { close: 120, mid: 3000, far: 9000 };

export function createDiorama({ THREE, V, COARSE, waterH, outMeshes, glassOut, makeHoop, WAVE_GLSL, wu, SUN_DIR, softDot, FL }) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#ebe6ee');
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -8, 8);
  const hemi = new THREE.HemisphereLight(new THREE.Color('#f2f1fb'), new THREE.Color('#d8c8b6'), 1.5); scene.add(hemi);
  const key = new THREE.DirectionalLight(new THREE.Color('#fff0dc'), 2.2); key.castShadow = !COARSE; // phones: no shadow pass for the block
  key.shadow.mapSize.set(COARSE ? 1024 : 2048, COARSE ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -0.9, right: 0.9, top: 0.9, bottom: -0.9, near: 0.05, far: 8 }); key.shadow.bias = -0.0008;
  scene.add(key, key.target);
  const model = new THREE.Group(); scene.add(model);             // everything; moved as one onto the headset's table
  const unit = new THREE.Group(); model.add(unit);                // the block's own coordinates: one block wide, heights in blocks
  const root = new THREE.Group(); model.add(root);                // metres, scaled by 1 / block size
  const world = new THREE.Group(); root.add(world);               // world metres, offset so the block's centre is at the origin
  let N = COARSE ? 72 : 128;
  // the block's uniforms: its centre and size, plus the sea's own uniforms (the wave's height and place, time, its breaking)
  const bu = { uCenter: { value: new THREE.Vector2() }, uS: { value: 120 }, uChopK: { value: 1 }, uOver: { value: 0 }, uDepth: { value: 0.5 },
    uH: { value: 0 }, uFlat: { value: 0 }, uPatch: { value: 0 }, uSky: { value: new THREE.Color('#d9dbe6') }, uQ: { value: COARSE ? 0.5 : 1 }, uSunDir: { value: SUN_DIR }, uSunA: { value: 0.6 }, uShadeHere: { value: 0 }, uFlash: { value: 0 }, ...wu };
  const GL_FNS = `
    uniform vec2 uCenter; uniform float uS, uChopK, uOver, uDepth;
    float h2_(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn_(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
      return mix(mix(h2_(i), h2_(i + vec2(1.0, 0.0)), w.x), mix(h2_(i + vec2(0.0, 1.0)), h2_(i + vec2(1.0, 1.0)), w.x), w.y); }
    float fb_(vec2 p){ return vn_(p) * 0.55 + vn_(p * 2.07 + 5.3) * 0.3 + vn_(p * 4.3 + 1.7) * 0.15; }
    float shadeAt_(vec3 p){ float s = 0.0; for (int i = 1; i <= 22; i++) { float d = float(i * i) * 15.0; vec3 q = p + uSunDir * d; s = max(s, smoothstep(-30.0, 60.0, waveW(q.xz) - q.y)); } return s; }`;
  // the sea's surface (and, with SKIRT, the four cut faces of the water column under it)
  function seaMaterial(skirt) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: skirt ? 0.7 : 0.42, metalness: 0, transparent: true, side: skirt ? THREE.DoubleSide : THREE.FrontSide });
    if (skirt) m.defines = { SKIRT: 1 };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, bu);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + WAVE_GLSL + GL_FNS + '\nvarying vec3 vW; varying float vHt; varying float vS; varying float vRel; varying float vJ; varying float vUp;')
        .replace('#include <beginnormal_vertex>', `vec2 w_ = uCenter + position.xz * uS;
          vec3 cn_ = vec3(0.0, 1.0, 0.0); float cj_ = 1.0; vec3 cd_ = vec3(0.0);
          if (uChopK > 0.0) cd_ = chopD(w_, uTime, cn_, cj_);
          float h_ = waveW(w_) + cd_.y * uChopK;
          #ifdef SKIRT
            vec3 objectNormal = normal;
          #else
            float e_ = max(1.5, uS * 0.004);
            float hx_ = waveW(w_ + vec2(e_, 0.0)) - waveW(w_ - vec2(e_, 0.0)), hz_ = waveW(w_ + vec2(0.0, e_)) - waveW(w_ - vec2(0.0, e_));
            vec3 objectNormal = normalize(vec3(-hx_, 2.0 * e_, -hz_) + vec3(cn_.x, 0.0, cn_.z) * uChopK * 1.1 * e_);
          #endif`)
        .replace('#include <begin_vertex>', `
          #ifdef SKIRT
            float top_ = position.y; vec3 transformed = vec3(position.x, mix(-uDepth, h_ + 0.02 * uS / 120.0, top_) / uS, position.z); vUp = top_;
          #else
            vec3 transformed = vec3(position.x, h_ / uS, position.z); vUp = 1.0;
          #endif
          vW = vec3(w_.x, h_, w_.y); vHt = h_; vS = w_.y - uZc - zOff(w_.x); vRel = prof(vS) * clamp(uHW * envX(w_.x) / 60.0, 0.0, 1.0); vJ = mix(1.0, cj_, min(1.0, uChopK));`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + WAVE_GLSL + GL_FNS + '\nvarying vec3 vW; varying float vHt; varying float vS; varying float vRel; varying float vJ; varying float vUp;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float front = step(vS, 0.0);
          // shallow water: a clear aqua-teal in the near blocks (the pale tint went grey under the block's light); the 9 km block keeps
          // its paler flats so the wave stands out of them. Eased by the block size, so a pull-out never jumps.
          vec3 shallow = mix(vec3(0.27, 0.61, 0.75), vec3(0.74, 0.92, 0.9), smoothstep(1500.0, 6000.0, uS));
          vec3 col = mix(shallow, vec3(0.47, 0.71, 0.84), smoothstep(0.6, 60.0, vHt));
          col = mix(col, vec3(0.30, 0.50, 0.76), smoothstep(150.0, 900.0, vHt));
          col = mix(col, vec3(0.56, 0.87, 0.85), smoothstep(0.8, 0.995, vRel) * front * 0.8);              // light through the thin crest
          float foam = 0.0;
          #ifdef SKIRT
            // the water column seen in section: paler near the surface, deeper below, a line of foam at the top
            col = mix(col * 0.78, col * 1.05, vUp); foam = smoothstep(0.985, 1.0, vUp) * smoothstep(3.0, 40.0, vHt) * 0.8;
            diffuseColor.rgb = mix(col, vec3(0.97, 0.98, 0.985), foam); diffuseColor.a = mix(0.62, 0.86, smoothstep(1.0, 80.0, vHt));
          #else
            float sheet = smoothstep(0.56, 0.84, fb_(vec2(vW.x * 0.03, vS * 0.0045 - uTime * 0.42))) * smoothstep(0.1, 0.5, vRel) * front;  // drawn up the face
            float crest = smoothstep(0.955, 1.0, vRel) * (0.55 + 0.45 * fb_(vW.xz * 0.018 + uTime * 0.15));
            float spill = front * step(0.001, uSpill) * smoothstep(1.0 - 0.78 * uSpill, 1.0 - 0.78 * uSpill + 0.1, vRel) * (1.0 - smoothstep(uSpillX * 0.8, uSpillX, abs(vW.x)));
            float caps = (1.0 - smoothstep(0.84, 0.9, vJ)) * smoothstep(0.45, 0.7, fb_(vW.xz * 0.35 + uTime * 0.2)) * step(0.5, uChopK) * 0.8;
            float lanes = smoothstep(0.6, 0.72, fb_(vec2(vW.x * 0.012, vW.z * 0.0022) + 9.0)) * 0.25 * (1.0 - vRel) * smoothstep(400.0, 3000.0, uS);
            foam = clamp(sheet * 0.5 + crest + spill * 0.8 + caps + lanes, 0.0, 1.0);
            // shadows of the overcast sliding over the sea, and the wave's own shadow advancing ahead of it
            float cl = smoothstep(0.5, 0.72, fb_(vW.xz / 2600.0 + vec2(uTime * 0.006, uTime * 0.0025)));
            float sh = uQ > 0.75 && uHW > 1.0 ? shadeAt_(vW) : 0.0;
            col *= 1.0 - 0.1 * cl * uOver - 0.38 * sh;
            diffuseColor.rgb = mix(col, vec3(0.975, 0.98, 0.985), foam);
            diffuseColor.a = mix(0.9, 1.0, max(smoothstep(0.5, 18.0, vHt), foam));
          #endif`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          #ifndef SKIRT
          { vec2 rp = vW.xz / (uS * 0.012); vec2 g = (vec2(vn_(rp + uTime * 0.3), vn_(rp + 7.0 - uTime * 0.25)) - 0.5) * 0.09;
            normal = normalize(normal + mat3(viewMatrix) * vec3(-g.x, 0.0, -g.y)); }
          #endif`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          #ifndef SKIRT
          { vec3 sv = normalize(mat3(viewMatrix) * uSunDir); float bl = pow(max(-sv.z, 0.0), 3.0);
            totalEmissiveRadiance += vec3(0.5, 0.95, 0.86) * bl * smoothstep(0.62, 0.97, vRel) * front * uSunA * 0.8 * (1.0 - foam * 0.5); }
          #endif`);
    };
    return m;
  }
  const top = new THREE.PlaneGeometry(1, 1, N, N).rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(top, seaMaterial(false)); sea.receiveShadow = true; sea.frustumCulled = false; sea.renderOrder = 1; unit.add(sea);
  function skirtGeo(n) { // four strips round the edge: x, z on the edge, y = 0 at the sand and 1 at the surface; normals outward
    const pos = [], nor = [], idx = [], edges = [[[-0.5, -0.5], [0.5, -0.5], [0, -1]], [[0.5, -0.5], [0.5, 0.5], [1, 0]], [[0.5, 0.5], [-0.5, 0.5], [0, 1]], [[-0.5, 0.5], [-0.5, -0.5], [-1, 0]]];
    for (const [a, b, nn] of edges) { const o = pos.length / 3;
      for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; pos.push(x, 0, z, x, 1, z); nor.push(nn[0], 0, nn[1], nn[0], 0, nn[1]); }
      for (let i = 0; i < n; i++) { const k = o + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
  }
  const skirt = new THREE.Mesh(skirtGeo(N), seaMaterial(true)); skirt.frustumCulled = false; skirt.renderOrder = 2; unit.add(skirt);
  // soil under the sand: soft layered sediment and a few pebbles, painted once
  const soil = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#f1dcb9'); gr.addColorStop(0.35, '#e9c2a4'); gr.addColorStop(0.7, '#d5a597'); gr.addColorStop(1, '#ab8d9f'); g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
    for (const [y0, col, amp] of [[22, 'rgba(240,206,170,.45)', 2], [34, 'rgba(228,176,146,.55)', 4], [50, 'rgba(218,164,146,.4)', 3], [66, 'rgba(206,150,142,.5)', 5], [82, 'rgba(190,140,146,.4)', 3], [98, 'rgba(164,124,148,.5)', 4]]) { g.fillStyle = col; g.beginPath(); g.moveTo(0, 128); for (let x = 0; x <= 512; x += 6) g.lineTo(x, y0 + Math.sin(x * 0.021 + y0) * amp + Math.sin(x * 0.07 + y0) * amp * 0.4); g.lineTo(512, 128); g.fill(); }
    for (let i = 0; i < 160; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,246,228,.5)' : 'rgba(120,92,118,.22)'; g.beginPath(); g.ellipse(Math.random() * 512, 12 + Math.random() * 112, 1.5 + Math.random() * 3, 1 + Math.random() * 2, 0, 0, 7); g.fill(); }
    g.fillStyle = '#f6e6c8'; g.fillRect(0, 0, 512, 6); g.fillStyle = 'rgba(200,170,130,.35)'; g.fillRect(0, 6, 512, 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...o });
  const sideM = mat({ map: soil, roughness: 1 }), sandM = mat({ color: '#efdcbc', roughness: 1 }), baseM = mat({ color: '#9f8698' });
  const block = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [sideM, sideM, sandM, baseM, sideM, sideM]); block.receiveShadow = true; root.add(block);
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(70,58,96,.34)'); gr.addColorStop(1, 'rgba(70,58,96,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })); root.add(shadow);
  // rain falling through the block's volume, slanted by the wind, at a pace you can see at any scale
  const RN = COARSE ? 160 : 360, rb = new Float32Array(RN * 3), rp = new Float32Array(RN * 6); for (let i = 0; i < RN * 3; i++) rb[i] = Math.random();
  const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({ color: '#9aa6bf', transparent: true, opacity: 0, depthWrite: false })); rain.frustumCulled = false; unit.add(rain);
  // the cloud base, when the lander is up near it or above it: a soft drifting layer at its true height
  const cloud = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.06).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uA: { value: 0 }, uTime: wu.uTime, uCenter: bu.uCenter, uS: bu.uS },
    vertexShader: 'varying vec2 vU; void main(){ vU = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA, uTime, uS; uniform vec2 uCenter; varying vec2 vU;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y); }
      void main(){ vec2 w = (uCenter + vU * uS) / 2600.0 + vec2(uTime * 0.006, uTime * 0.0025); float n = vn(w) * 0.6 + vn(w * 2.7 + 3.0) * 0.4;
        float e = (1.0 - smoothstep(0.42, 0.53, abs(vU.x))) * (1.0 - smoothstep(0.42, 0.53, abs(vU.y)));
        gl_FragColor = vec4(vec3(0.98, 0.98, 0.99), uA * e * smoothstep(0.42, 0.74, n) * 0.5); }` }));
  cloud.renderOrder = 6; cloud.visible = false; unit.add(cloud);
  // the lander at true size (the same geometry and paint as the real one), a ring on the water round it, a pin above it, and its track
  const mini = new THREE.Group(); mini.rotation.order = 'YXZ'; for (const m of outMeshes) { const c = new THREE.Mesh(m.geometry, m.material); c.castShadow = true; mini.add(c); }
  { const g = new THREE.Mesh(glassOut.geometry, glassOut.material); g.position.copy(glassOut.position); mini.add(g); } world.add(mini);
  const coral = new THREE.MeshBasicMaterial({ color: '#e7826f' }), goldM = new THREE.MeshBasicMaterial({ color: '#f1d074' }), cream = new THREE.MeshBasicMaterial({ color: '#fbf7f0' });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), coral); world.add(ring);
  const pin = new THREE.Group(); pin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6).translate(0, 0.5, 0), coral), new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8).translate(0, 1, 0), coral)); world.add(pin);
  const hoop = makeHoop(); hoop.g.visible = false; world.add(hoop.g);
  const wpin = new THREE.Group(); wpin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6).translate(0, 0.5, 0), cream), new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8).translate(0, 1, 0), goldM)); world.add(wpin);
  function track(n, color) { const pos = new Float32Array(n * 6), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setDrawRange(0, 0);
    const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false })); line.frustumCulled = false; world.add(line);
    const pts = [];
    return { line, push(x, y, z) { pts.push(x, y, z); if (pts.length > n * 3) pts.splice(0, 3); },
      clear() { pts.length = 0; g.setDrawRange(0, 0); },
      clip(cx, cz, h) { let k = 0; const inb = (i) => Math.abs(pts[i] - cx) < h && Math.abs(pts[i + 2] - cz) < h; // segments with both ends inside the block
        for (let i = 3; i < pts.length; i += 3) if (inb(i) && inb(i - 3)) { pos.set([pts[i - 3], pts[i - 2], pts[i - 1], pts[i], pts[i + 1], pts[i + 2]], k * 6); k++; }
        g.attributes.position.needsUpdate = true; g.setDrawRange(0, k * 2); } }; }
  const landerTrack = track(260, '#e7826f'), wrenTrack = track(160, '#d9b44a');
  // the real particle systems (spray, engine plumes, foam dots, mist, spindrift), drawn again here from the same buffers, sized for this scale
  const mirrors = [];
  function mirror(sys, worldSize, color, opacity, minPx = 1.2, maxPx = 60) {
    const m = new THREE.PointsMaterial({ map: softDot, color: new THREE.Color(color), transparent: true, opacity, depthWrite: false, sizeAttenuation: false });
    const p = new THREE.Points(sys.geo, m); p.frustumCulled = false; world.add(p); mirrors.push({ p, worldSize, minPx, maxPx }); return p;
  }
  // meshes from the world (the foam ribbon behind the hull, the rings on the water) shown here too: same geometry and paint
  const clones = [];
  function share(mesh) { const c = new THREE.Mesh(mesh.geometry, mesh.material); c.frustumCulled = false; c.renderOrder = 3; world.add(c); clones.push({ src: mesh, c }); return c; }

  const st = { S: 120, cx: 0, cz: 0, hmax: 0, crestZ: 0, crestIn: false, ppm: 0, top: 0, spanM: 0, az: -2.3, step: 'close', fit: null, inside: true };
  { const b = new THREE.Box3().setFromObject(mini); st.spanM = +Math.max(b.max.x - b.min.x, b.max.z - b.min.z).toFixed(2); st.lenM = +(b.max.z - b.min.z).toFixed(2); }
  const _v = V(), _c = new THREE.Vector3();
  const zOff = (x) => 420 * (x / 7000) ** 2;

  // one frame: the block at size S centred on (cx, cz), everything in it as it is now
  function update({ S, cx, cz, L, wren, az, aspect, dt = 1 / 60, rainK = 0, over = 0, sunA = 0.6, step = '', W = null, snap = false, now = 0 }) {
    const T = S * (S < 300 ? 0.07 : 0.045);
    Object.assign(st, { S, cx, cz, az, step });
    bu.uS.value = S; bu.uCenter.value.set(cx, cz); bu.uOver.value = over; bu.uSunA.value = sunA;
    bu.uChopK.value = S < 400 ? 1.6 * (1 - Math.min(1, Math.max(0, (S - 160) / 240))) : 0; // the chop raised so it shows in the close block, gone by 400 m
    root.scale.setScalar(1 / S); world.position.set(-cx, 0, -cz);
    block.scale.set(S, T, S); block.position.y = -0.5 - T / 2;
    shadow.scale.set(S * 1.6, 1, S * 1.6); shadow.position.y = -0.5 - T - S * 0.06;
    key.position.copy(SUN_DIR).multiplyScalar(3); key.intensity = 1.2 + 1.4 * sunA; hemi.intensity = 1.35 + 0.3 * (1 - over);
    // the highest water in the block (for framing and the crest label): along the lander's line, where the ridge is highest
    let hm = 0, cz_ = cz;
    for (let i = 0; i <= 48; i++) { const z = cz - S / 2 + S * i / 48, h = waterH(L.x, z); if (h > hm) { hm = h; cz_ = z; } }
    st.hmax = hm; st.crestZ = W && W.alive ? W.zc + zOff(L.x) : 1e9; st.crestIn = !!(W && W.alive) && Math.abs(st.crestZ - cz) < S / 2 && hm > 300; st.crestAt = cz_;
    // the lander, WREN and their markers (rings and pins keep a size you can see at this scale)
    const lx = L.x - cx, lz = L.z - cz; st.inside = Math.abs(lx) < S / 2 && Math.abs(lz) < S / 2;
    mini.visible = st.inside; mini.position.set(L.x, L.y, L.z); mini.rotation.set(-L.pitch, L.yaw, L.roll);
    const big = S > 400, mk = S * 0.012;
    ring.visible = st.inside && big && L.y < 40; ring.position.set(L.x, Math.max(0, waterH(L.x, L.z)) + 0.3, L.z); ring.scale.setScalar(mk);
    pin.visible = st.inside && big; pin.position.set(L.x, L.y + 6, L.z); pin.scale.set(S * 0.6, S * 0.07, S * 0.6);
    hoop.g.visible = !!(wren && wren.out) && Math.abs(wren.x - cx) < S / 2 && Math.abs(wren.z - cz) < S / 2;
    if (hoop.g.visible) { hoop.g.position.set(wren.x, wren.y, wren.z); hoop.g.rotation.set(0, wren.heading, wren.lean || 0); hoop.roll.rotation.z = wren.spin; }
    wpin.visible = hoop.g.visible && S < 400; wpin.position.set(wren.x, wren.y + 0.8, wren.z); wpin.scale.set(S * 0.4, S * 0.06, S * 0.4);
    // rain through the volume, the cloud base, the mirrored particles and meshes
    const rtop = Math.max(0.12, Math.min(0.45, (st.top || hm) / S + 0.08));
    rain.visible = rainK > 0.04; if (rain.visible) { const fall = now * 0.22, wx = 0.035;
      for (let i = 0; i < RN; i++) { const j = i * 3, o = i * 6, y = ((rb[j + 1] - fall * (0.8 + 0.4 * rb[j])) % 1 + 1) % 1 * rtop, x = rb[j] - 0.5 + wx * (y / rtop), z = rb[j + 2] - 0.5;
        rp[o] = x; rp[o + 1] = y; rp[o + 2] = z; rp[o + 3] = x - wx * 0.12; rp[o + 4] = y + 0.024; rp[o + 5] = z; }
      rGeo.attributes.position.needsUpdate = true; rain.material.opacity = Math.min(0.55, rainK * 0.5); }
    const cy = FL.CLOUD_BASE / S, upNear = L.y > FL.CLOUD_BASE * 0.8 || L.phase === 'entry' || L.phase === 'cloud';
    cloud.visible = S > 2000 && upNear; if (cloud.visible) { cloud.position.y = cy; cloud.material.uniforms.uA.value = Math.min(1, (S - 2000) / 2000) * (L.y > FL.CLOUD_BASE ? 1 : 0.6); }
    const ppmDev = (innerWidth / Math.max(1e-6, (st.fit ? st.fit.hw * 2 : 1.2)) / S) * Math.min(devicePixelRatio, 2);
    for (const m of mirrors) m.p.material.size = Math.min(m.maxPx, Math.max(m.minPx, m.worldSize * ppmDev));
    landerTrack.clip(cx, cz, S / 2); wrenTrack.clip(cx, cz, S / 2);
    for (const c of clones) { c.c.position.copy(c.src.position); c.c.scale.copy(c.src.scale); c.c.quaternion.copy(c.src.quaternion); c.c.visible = c.src.visible && S < 1500; }
    // the camera: 30 degrees up, from three-quarters, fitted round the block and anything standing above it, eased so nothing jumps
    st.top = Math.max(hm, st.inside ? L.y + (big ? S * 0.07 : 3) : 0, cloud.visible ? cy * S + S * 0.02 : 0);
    const el = Math.PI / 6; cam.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(3);
    cam.up.set(0, 1, 0); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) for (const sy of [-0.5 / S - T / S, st.top / S]) { _v.set(sx, sy, sz).applyMatrix4(cam.matrixWorldInverse); x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y); }
    const t = { mx: (x0 + x1) / 2, my: (y0 + y1) / 2 - (y1 - y0) * 0.03, hw: (x1 - x0) / 2 * 1.14, hh: (y1 - y0) / 2 * 1.24 };
    if (t.hw / t.hh > aspect) t.hh = t.hw / aspect; else t.hw = t.hh * aspect;
    if (!st.fit || snap) st.fit = { ...t }; else { const k = 1 - Math.exp(-dt * 3.2); for (const q of ['mx', 'my', 'hw', 'hh']) st.fit[q] += (t[q] - st.fit[q]) * k; }
    const f = st.fit, hw = Math.max(f.hw, f.hh * aspect), hh = hw / aspect;
    Object.assign(cam, { left: f.mx - hw, right: f.mx + hw, top: f.my + hh, bottom: f.my - hh }); cam.updateProjectionMatrix();
    st.ppm = innerWidth / (2 * hw) / S;
  }
  // a point given in world metres, on the screen in CSS pixels
  const _p = V();
  function project(x, y, z) { _p.set((x - st.cx) / st.S, y / st.S, (z - st.cz) / st.S); model.localToWorld(_p); _p.project(cam); return [(_p.x + 1) / 2 * innerWidth, (1 - _p.y) / 2 * innerHeight, _p.z]; }
  function setQuality(l) { bu.uQ.value = l === 0 ? 1 : l === 1 ? 0.5 : 0; const n = l >= 3 ? 40 : COARSE || l >= 1 ? 72 : 128; if (n !== N) { N = n; sea.geometry.dispose(); sea.geometry = new THREE.PlaneGeometry(1, 1, N, N).rotateX(-Math.PI / 2); skirt.geometry.dispose(); skirt.geometry = skirtGeo(N); } }
  return { scene, cam, model, root, unit, world, update, project, st, mini, hoop, mirror, share, landerTrack, wrenTrack, setQuality, BLOCKS, bu, key };
}
