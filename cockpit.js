// The lander "Heron" (a flying boat with a glass nose) and the inside of its cockpit: seat, ribs, consoles, an overhead pod, a side
// stick and a throttle, switches and status lights, hanging grab loops, the primary display, and the companion WREN (a ball in a
// gimbal). Every shape is an original design for this page, built from boxes, tubes and spheres and merged by material so the whole
// craft is a few dozen draw calls. Nothing here moves on its own: descent.js drives the parts this file hands back.
export const BC = [0, 1.45, 2.55], BR = 1.3; // the glass nose: its centre and radius
export const PANEL = { c: [0, 1.2, 3.44], tilt: 0.55, w: 1.06, h: 0.3855, IW: 1100, IH: 400 };

export function buildLander({ THREE, V, wash, COARSE }) {
  const TAU = Math.PI * 2;
  const PAL = { hull: '#f7f0e2', belly: '#e98f7d', teal: '#78bcb8', gold: '#f1d074', dark: '#3b4158', steel: '#c9ccd6', pad: '#8d93b0', ink: '#2a2e3e', glove: '#fbf6ec', lite: '#bfe3de' };
  const M = {}; for (const k in PAL) M[k] = wash(PAL[k]);
  const buckets = { out: {}, in: {}, body: {} };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function put(where, mat, geo, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); geo.dispose();
    g.applyMatrix4(_m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl)));
    (buckets[where][mat] ||= []).push(g);
  }
  function merged(list) {
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for (const g of list) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.count * 3; g.dispose(); }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out;
  }
  const tubeGeo = (pts, r, seg = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), pts.length * 4, r, seg);
  const rodGeo = (a, b, r) => { const d = V(...b).sub(V(...a)), g = new THREE.CylinderGeometry(r, r, d.length(), 8); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize())); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); return g; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const onBall = (az, el, r = BR - 0.02) => [BC[0] + Math.sin(az) * Math.cos(el) * r, BC[1] + Math.sin(el) * r, BC[2] + Math.cos(az) * Math.cos(el) * r];
  // a rib of the canopy: a flat bar following the glass, w wide and t deep, standing in from the glass toward the middle of the bubble
  function ribGeo(pts, w, t) {
    const P = pts.map((p) => V(...p)), n = P.length, c = V(...BC), pos = [];
    const ring = P.map((p, i) => { const tan = P[Math.min(n - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize(), rad = p.clone().sub(c).normalize(), b = rad.clone().cross(tan).normalize();
      const o0 = p.clone().addScaledVector(b, -w / 2), o1 = p.clone().addScaledVector(b, w / 2); return [o0, o1, o1.clone().addScaledVector(rad, -t), o0.clone().addScaledVector(rad, -t)]; });
    const quad = (a, b, cc, d) => { for (const q of [a, b, cc, a, cc, d]) pos.push(q.x, q.y, q.z); };
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; quad(ring[i][k], ring[i][k2], ring[i + 1][k2], ring[i + 1][k]); }
    quad(ring[0][3], ring[0][2], ring[0][1], ring[0][0]); quad(ring[n - 1][0], ring[n - 1][1], ring[n - 1][2], ring[n - 1][3]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    // make sure the faces look outward from the bar's own middle (the winding depends on which way the path runs)
    const p0 = g.attributes.position, nn = g.attributes.normal, mid = ring[0][0].clone().add(ring[0][2]).multiplyScalar(0.5), a = V(p0.getX(0), p0.getY(0), p0.getZ(0)).add(V(p0.getX(2), p0.getY(2), p0.getZ(2))).multiplyScalar(0.5);
    if (a.sub(mid).dot(V(nn.getX(0), nn.getY(0), nn.getZ(0))) < 0) { const arr = p0.array; for (let i = 0; i < arr.length; i += 9) for (let k = 0; k < 3; k++) { const tmp = arr[i + 3 + k]; arr[i + 3 + k] = arr[i + 6 + k]; arr[i + 6 + k] = tmp; } g.computeVertexNormals(); }
    return g;
  }
  const arc = (f, n) => Array.from({ length: n }, (_, i) => f(i / (n - 1)));

  const ship = new THREE.Group(); ship.rotation.order = 'YXZ'; ship.visible = false;
  // ---------- outside ----------
  {
    // hull: a long rounded boat body with a coral planing bottom and keel
    put('out', 'hull', new THREE.SphereGeometry(1, 28, 16), [0, 1.0, -1.9], [0, 0, 0], [1.25, 0.82, 4.3]);
    put('out', 'belly', new THREE.SphereGeometry(1, 28, 8, 0, TAU, Math.PI * 0.6, Math.PI * 0.4), [0, 1.0, -1.9], [0, 0, 0], [1.27, 0.84, 4.33]);
    put('out', 'belly', box(0.24, 0.3, 6.2), [0, 0.15, -1.7]);
    put('out', 'teal', new THREE.TorusGeometry(1.2, 0.08, 8, 28), [0, 1.42, 1.72]);
    // gull wings with drooping tips, each ending in a float
    const wing = (a, b, chord, thick, mat = 'hull') => { const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); put('out', mat, box(len, thick, chord), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [0, 0, Math.atan2(dy, dx)]); };
    for (const sd of [-1, 1]) {
      wing([sd * 0.9, 1.72, -1.3], [sd * 3.9, 2.5, -1.5], 2.3, 0.17); wing([sd * 3.9, 2.5, -1.55], [sd * 6.5, 1.7, -1.7], 1.6, 0.13);
      wing([sd * 5.9, 1.9, -1.0], [sd * 6.5, 1.7, -1.0], 0.5, 0.14, 'teal');
      wing([sd * 1.6, 1.93, -2.5], [sd * 3.7, 2.47, -2.62], 0.34, 0.2, 'gold'); // air brake panels on the trailing edge
      put('out', 'belly', new THREE.CapsuleGeometry(0.27, 1.7, 4, 10), [sd * 6.5, 0.62, -1.6], [Math.PI / 2, 0, 0]);
      put('out', 'steel', rodGeo([sd * 6.5, 1.7, -1.3], [sd * 6.5, 0.8, -1.3], 0.05)); put('out', 'steel', rodGeo([sd * 6.5, 1.7, -2.0], [sd * 6.5, 0.8, -2.0], 0.05));
      // engines on top of the wing roots: gold intake lips, dark nozzles
      put('out', 'hull', new THREE.CylinderGeometry(0.5, 0.42, 3.2, 16), [sd * 1.75, 2.62, -2.0], [Math.PI / 2, 0, 0]);
      put('out', 'gold', new THREE.TorusGeometry(0.5, 0.075, 8, 20), [sd * 1.75, 2.62, -0.4]);
      put('out', 'dark', new THREE.CylinderGeometry(0.3, 0.37, 0.5, 14), [sd * 1.75, 2.62, -3.8], [Math.PI / 2, 0, 0]);
      put('out', 'dark', new THREE.CircleGeometry(0.42, 16), [sd * 1.75, 2.62, -0.42]);
      put('out', 'hull', box(0.3, 0.5, 1.8), [sd * 1.75, 2.2, -1.9]);
      // a V tail
      put('out', 'teal', box(0.1, 2.5, 1.3), [sd * 0.8, 2.5, -5.5], [0.25, 0, -sd * 0.62]);
    }
    // the cradle on the starboard side where WREN's hoop rides
    put('out', 'steel', new THREE.TorusGeometry(0.2, 0.03, 6, 14), [-1.22, 1.0, 0.9], [0, Math.PI / 2, 0]);
  }
  // ---------- inside ----------
  const P0 = V(...PANEL.c), TILT = PANEL.tilt, pu = V(0, Math.cos(TILT), Math.sin(TILT)), pn = V(0, Math.sin(TILT), -Math.cos(TILT)); // the panel's up, and its face toward the eye
  const onPanel = (x, u, n = 0) => { const p = P0.clone().addScaledVector(pu, u).addScaledVector(pn, n); return [x, p.y, p.z]; };
  const lightAt = [], toggleAt = [];
  {
    // floor pan, heel plate and rudder pedals
    put('in', 'pad', new THREE.CylinderGeometry(0.56, 0.56, 0.05, 28), [0, 0.74, 2.42]); put('in', 'dark', new THREE.CylinderGeometry(0.3, 0.3, 0.012, 20), [0, 0.772, 2.75]);
    for (const sd of [-1, 1]) { put('in', 'steel', rodGeo([sd * 0.17, 0.76, 2.98], [sd * 0.17, 0.93, 3.1], 0.012)); put('in', 'dark', box(0.11, 0.16, 0.015), [sd * 0.17, 0.96, 3.11], [-0.5, 0, 0]); put('in', 'gold', box(0.11, 0.012, 0.02), [sd * 0.17, 1.03, 3.15], [-0.5, 0, 0]); }
    // the bulkhead behind the seat: a hatch with a wheel, stowage, a bottle, cable runs
    put('in', 'hull', new THREE.CircleGeometry(1.24, 32), [0, 1.45, 1.74]);
    put('in', 'teal', new THREE.TorusGeometry(0.42, 0.04, 6, 24), [0, 1.5, 1.76]); put('in', 'pad', new THREE.CircleGeometry(0.4, 24), [0, 1.5, 1.752]);
    put('in', 'steel', new THREE.TorusGeometry(0.12, 0.014, 6, 18), [0, 1.5, 1.81]); for (let i = 0; i < 3; i++) { const a = i * TAU / 3; put('in', 'steel', rodGeo([0, 1.5, 1.81], [Math.cos(a) * 0.12, 1.5 + Math.sin(a) * 0.12, 1.81], 0.008)); }
    for (const sd of [-1, 1]) { put('in', 'pad', box(0.34, 0.42, 0.14), [sd * 0.8, 1.02, 1.83]); put('in', 'gold', box(0.06, 0.03, 0.02), [sd * 0.8, 1.16, 1.91]); put('in', 'dark', box(0.34, 0.012, 0.15), [sd * 0.8, 1.02, 1.835]); }
    put('in', 'gold', new THREE.CapsuleGeometry(0.06, 0.26, 4, 10), [-0.86, 1.72, 1.84]); put('in', 'steel', new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), [-0.86, 1.93, 1.84]);
    put('in', 'dark', tubeGeo([[0.7, 1.24, 1.8], [0.74, 1.6, 1.79], [0.6, 2.05, 1.8], [0.3, 2.42, 1.8]], 0.012)); put('in', 'belly', tubeGeo([[0.78, 1.24, 1.8], [0.84, 1.7, 1.79], [0.66, 2.2, 1.8]], 0.009));
    // the seat: pedestal, pan with bolsters, a shell back, cushions, a headrest with wings, shoulder straps
    put('in', 'dark', box(0.26, 0.3, 0.3), [0, 0.92, 2.14]); put('in', 'hull', box(0.54, 0.05, 0.56), [0, 1.085, 2.2]); put('in', 'pad', box(0.46, 0.07, 0.5), [0, 1.13, 2.21]);
    for (const sd of [-1, 1]) put('in', 'pad', box(0.06, 0.1, 0.48), [sd * 0.24, 1.15, 2.21]);
    put('in', 'hull', box(0.52, 0.9, 0.06), [0, 1.56, 1.9], [-0.1, 0, 0]); put('in', 'pad', box(0.42, 0.62, 0.06), [0, 1.48, 1.95], [-0.1, 0, 0]);
    put('in', 'pad', box(0.25, 0.2, 0.07), [0, 2.02, 2.0]); for (const sd of [-1, 1]) { put('in', 'pad', box(0.035, 0.2, 0.3), [sd * 0.165, 2.01, 2.16], [0, sd * 0.2, 0]); put('in', 'gold', box(0.04, 0.03, 0.31), [sd * 0.168, 2.12, 2.16], [0, sd * 0.2, 0]); }
    for (const sd of [-1, 1]) put('body', 'dark', box(0.045, 0.74, 0.008), [sd * 0.1, 1.53, 2.19], [0.42, 0, sd * 0.02]);
    put('body', 'gold', new THREE.CylinderGeometry(0.035, 0.035, 0.015, 12), [0, 1.2, 2.36], [Math.PI / 2 - 0.4, 0, 0]);
    // the pilot's legs (cream suit, as plain as the gloves): thighs to the knees, shins down to the pedals
    for (const sd of [-1, 1]) { put('body', 'pad', new THREE.CapsuleGeometry(0.064, 0.36, 4, 10), [sd * 0.13, 1.2, 2.56], [Math.PI / 2 - 0.06, 0, sd * 0.04]); put('body', 'pad', new THREE.CapsuleGeometry(0.052, 0.34, 4, 10), [sd * 0.155, 1.07, 2.95], [-0.8, 0, 0]); put('body', 'pad', new THREE.CapsuleGeometry(0.058, 0.12, 4, 8), [sd * 0.17, 0.92, 3.08], [Math.PI / 2 - 0.5, 0, 0]); }
    // canopy ribs: flat bars with depth, a paler strip down each face where the light catches
    const rib = (pts, w = 0.07, t = 0.045) => { put('in', 'teal', ribGeo(pts, w, t)); put('in', 'lite', ribGeo(pts.map((p) => { const d = V(...p).sub(V(...BC)); return V(...BC).addScaledVector(d, 1 - (t + 0.002) / d.length()).toArray(); }), w * 0.28, 0.004)); };
    for (const sd of [-1, 1]) { rib(arc((k) => onBall(sd * 0.72, -1.0 + k * 2.5), 22)); rib(arc((k) => onBall(sd * 1.75, -0.65 + k * 2.1), 16), 0.06, 0.04); }
    rib(arc((k) => onBall(-1.95 + k * 3.9, -0.2), 30), 0.06, 0.04);
    rib(arc((k) => onBall(-0.72 + k * 1.44, 0.95), 14), 0.06, 0.04); // the eyebrow, which carries the overhead pod
    put('in', 'teal', new THREE.SphereGeometry(0.07, 12, 8), onBall(0, 1.5), [0, 0, 0], [1, 0.5, 1]);
    for (const sd of [-1, 1]) for (const [az, el] of [[0.72, -0.2], [0.72, 0.95], [1.75, -0.2]]) put('in', 'gold', new THREE.CylinderGeometry(0.016, 0.016, 0.012, 8), onBall(sd * az, el, BR - 0.07), [Math.PI / 2, 0, 0]);
    // the main panel: a bezel round the display, a glare shield over it, a switch rail under it, a wing panel each side
    put('in', 'ink', box(PANEL.w + 0.09, PANEL.h + 0.08, 0.05), onPanel(0, 0, -0.03), [TILT, 0, 0]);
    put('in', 'dark', box(PANEL.w + 0.2, 0.028, 0.26), onPanel(0, PANEL.h / 2 + 0.05, 0.07), [TILT + 0.1, 0, 0]);
    put('in', 'pad', box(PANEL.w + 0.2, 0.012, 0.03), onPanel(0, PANEL.h / 2 + 0.035, 0.2), [TILT + 0.1, 0, 0]);
    put('in', 'dark', box(0.84, 0.075, 0.04), onPanel(0, -PANEL.h / 2 - 0.085, -0.02), [TILT, 0, 0]);
    for (let i = 0; i < 8; i++) toggleAt.push({ id: 'rail' + i, p: onPanel(-0.35 + i * 0.1, -PANEL.h / 2 - 0.085, 0.005), rx: TILT - Math.PI / 2 });
    for (const sd of [-1, 1]) {
      const C = V(sd * 0.69, 1.18, 3.3), yaw = sd * 0.62, q = new THREE.Quaternion().setFromEuler(new THREE.Euler(TILT, yaw, 0)), at = (a, b, n = 0.025) => C.clone().add(V(a, b, -n).applyQuaternion(q)).toArray();
      put('in', 'ink', box(0.3, 0.36, 0.04), C.toArray(), [TILT, yaw, 0]); put('in', 'dark', box(0.26, 0.012, 0.012), at(0, 0.03, 0.022), [TILT, yaw, 0]);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) lightAt.push({ id: (sd > 0 ? 'L' : 'R') + (r * 3 + c), p: at(-0.085 + c * 0.085, 0.13 - r * 0.055, 0.024) });
      for (let c = 0; c < 4; c++) toggleAt.push({ id: (sd > 0 ? 'lw' : 'rw') + c, p: at(-0.09 + c * 0.06, -0.12, 0.02), rx: TILT - Math.PI / 2, ry: yaw });
      if (sd > 0) { put('in', 'steel', new THREE.TorusGeometry(0.055, 0.008, 6, 20), at(0.0, -0.035, 0.024), [TILT, yaw, 0]); put('in', 'hull', new THREE.CircleGeometry(0.052, 20), at(0.0, -0.035, 0.0215), [TILT + Math.PI, yaw, 0]); }
      else { for (let i = 0; i < 6; i++) put('in', 'hull', new THREE.CylinderGeometry(0.011, 0.011, 0.014, 8), at(-0.1 + i * 0.04, -0.04, 0.026), [TILT + Math.PI / 2, yaw, 0]); }
      put('in', 'dark', rodGeo([sd * 0.42, 1.0, 3.5], [sd * 0.46, 0.76, 2.72], 0.02));
    }
    put('in', 'dark', rodGeo([0, 0.98, 3.52], [0, 0.76, 3.0], 0.03));
    // the overhead pod on the eyebrow rib: status lights over a row of switches
    const Po = V(...onBall(0, 0.95, BR - 0.13)), ot = -0.42, ou = V(0, Math.cos(ot), Math.sin(ot)), on_ = V(0, Math.sin(ot), -Math.cos(ot)), onPod = (x, u, n = 0) => { const p = Po.clone().addScaledVector(ou, u).addScaledVector(on_, n); return [x, p.y, p.z]; };
    put('in', 'ink', box(0.54, 0.12, 0.07), Po.toArray(), [ot, 0, 0]); put('in', 'teal', box(0.56, 0.014, 0.085), onPod(0, -0.064), [ot, 0, 0]);
    for (const sd of [-1, 1]) put('in', 'teal', rodGeo(onPod(sd * 0.2, 0.05, -0.02), onBall(sd * 0.22, 0.97, BR - 0.05), 0.014));
    for (let i = 0; i < 6; i++) lightAt.push({ id: 'O' + i, p: onPod(-0.2 + i * 0.08, 0.028, 0.038) });
    for (let i = 0; i < 6; i++) toggleAt.push({ id: 'ov' + i, p: onPod(-0.2 + i * 0.08, -0.026, 0.035), rx: ot - Math.PI / 2 });
    // side consoles: throttle quadrant and trim wheel to the left hand, the side stick and a breaker strip to the right
    for (const sd of [-1, 1]) { put('in', 'hull', box(0.27, 0.4, 0.9), [sd * 0.66, 0.95, 2.6]); put('in', 'ink', box(0.275, 0.014, 0.905), [sd * 0.66, 1.156, 2.6]); put('in', 'teal', box(0.28, 0.02, 0.91), [sd * 0.66, 1.0, 2.6]); }
    put('in', 'steel', box(0.03, 0.006, 0.24), [0.62, 1.166, 2.96]); put('in', 'gold', new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), [0.72, 1.165, 2.62], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 5; i++) toggleAt.push({ id: 'lc' + i, p: [0.71, 1.163, 2.3 + i * 0.055], rx: 0 });
    for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) { put('in', 'dark', new THREE.CylinderGeometry(0.011, 0.011, 0.02, 8), [-0.6 - r * 0.07, 1.17, 2.24 + i * 0.045]); put('in', 'hull', new THREE.CylinderGeometry(0.008, 0.008, 0.006, 8), [-0.6 - r * 0.07, 1.183, 2.24 + i * 0.045]); }
    put('in', 'steel', tubeGeo([[-0.74, 1.16, 2.62], [-0.74, 1.24, 2.66], [-0.74, 1.24, 2.8], [-0.74, 1.16, 2.84]], 0.011)); // a grab bar
    put('in', 'gold', new THREE.TorusGeometry(0.05, 0.01, 6, 18), [-0.62, 1.166, 2.72], [Math.PI / 2, 0, 0]); put('in', 'dark', new THREE.CircleGeometry(0.046, 18), [-0.62, 1.165, 2.72], [-Math.PI / 2, 0, 0]); // WREN's chute
    // WREN's perch on the starboard wing panel, and the cord from it down to the console
    put('in', 'dark', new THREE.CylinderGeometry(0.014, 0.02, 0.09, 8), [-0.69, 1.4, 3.37]);
    put('in', 'dark', tubeGeo([[-0.69, 1.36, 3.37], [-0.76, 1.3, 3.2], [-0.78, 1.22, 3.0], [-0.72, 1.17, 2.9]], 0.006));
    for (const where of ['out', 'in', 'body']) for (const k in buckets[where]) { const m = new THREE.Mesh(merged(buckets[where][k]), M[k]); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.userData.where = where; ship.add(m); }
  }
  const bodyMeshes = ship.children.filter((m) => m.userData.where === 'body'), outMeshes = ship.children.filter((m) => m.userData.where === 'out');
  const part = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }; // small parts: no shadow pass of their own
  const lit = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), fog: false });
  // navigation lamps on the wing tips and the tail
  ship.add(part(new THREE.SphereGeometry(0.07, 8, 6), lit(2.6, 0.6, 0.5), 6.5, 1.72, -0.72), part(new THREE.SphereGeometry(0.07, 8, 6), lit(0.5, 2.2, 1.2), -6.5, 1.72, -0.72));

  // the glass from outside: a tinted bubble
  const glassOut = new THREE.Mesh(new THREE.SphereGeometry(BR, 28, 18), new THREE.MeshStandardMaterial({ color: '#8fa6c4', roughness: 0.25, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false }));
  glassOut.position.set(...BC); ship.add(glassOut);

  // the primary display: one canvas, redrawn a few times a second
  const ic = document.createElement('canvas'); ic.width = PANEL.IW; ic.height = PANEL.IH;
  const iTex = new THREE.CanvasTexture(ic); iTex.colorSpace = THREE.SRGBColorSpace; iTex.anisotropy = 8;
  const inst = new THREE.Mesh(new THREE.PlaneGeometry(PANEL.w, PANEL.h), new THREE.MeshBasicMaterial({ map: iTex, fog: false, toneMapped: false }));
  inst.position.set(...onPanel(0, 0, 0.002)); inst.rotation.set(-TILT, Math.PI, 0, 'YXZ'); ship.add(inst);
  // its faint reflection in the canopy above the glare shield, which shows when the cockpit is darker than the display
  const ghost = new THREE.Mesh(new THREE.PlaneGeometry(PANEL.w * 0.9, PANEL.h * 0.9), new THREE.MeshBasicMaterial({ map: iTex, fog: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  ghost.position.set(0, 1.66, 3.78); ghost.rotation.set(0.5, Math.PI, 0, 'YXZ'); ghost.scale.set(0.7, -0.7, 1); ghost.renderOrder = 19; ship.add(ghost);

  // the side stick (right hand) and the throttle (left hand): both move with what you do, and shiver with the airframe
  const hand = (side) => { const g = new THREE.Group();
    g.add(part(new THREE.SphereGeometry(1, 12, 8).scale(0.046, 0.04, 0.056), M.glove), part(new THREE.CapsuleGeometry(0.014, 0.05, 3, 8).rotateX(0.9), M.glove, side * 0.036, 0.016, 0.02),
      part(new THREE.CapsuleGeometry(0.036, 0.04, 4, 10).rotateX(Math.PI / 2), M.glove, side * 0.008, -0.01, -0.1), part(new THREE.TorusGeometry(0.04, 0.012, 6, 14), M.belly, side * 0.004, -0.004, -0.07));
    return g; };
  const stick = new THREE.Group(); stick.position.set(-0.62, 1.16, 2.98);
  stick.add(part(new THREE.CylinderGeometry(0.03, 0.04, 0.03, 12), M.dark, 0, 0.015, 0), part(new THREE.CylinderGeometry(0.012, 0.015, 0.14, 8), M.steel, 0, 0.09, 0), part(new THREE.CapsuleGeometry(0.024, 0.1, 4, 10), M.dark, 0, 0.21, 0), part(new THREE.SphereGeometry(0.014, 10, 8), M.belly, 0, 0.29, -0.012));
  const handR = hand(1); handR.position.set(0, 0.22, -0.012); handR.rotation.set(0.25, 0.18, 0); stick.add(handR); ship.add(stick);
  const lever = new THREE.Group(); lever.position.set(0.62, 1.16, 2.96);
  lever.add(part(new THREE.CylinderGeometry(0.009, 0.009, 0.19, 8), M.steel, 0, 0.095, 0), part(new THREE.CylinderGeometry(0.026, 0.026, 0.085, 12).rotateZ(Math.PI / 2), M.gold, 0, 0.2, 0));
  const handL = hand(-1); handL.position.set(0, 0.215, -0.02); handL.rotation.set(0.5, -0.12, 0); lever.add(handL); ship.add(lever);
  // the needle of the intake gauge on the port wing panel
  const needle = new THREE.Group(); { const C = V(0.69, 1.18, 3.3), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(TILT, 0.62, 0)); needle.position.copy(C).add(V(0, -0.035, -0.026).applyQuaternion(q)); needle.quaternion.copy(q);
    needle.add(new THREE.Mesh(box(0.006, 0.046, 0.003).translate(0, 0.02, 0), lit(1.9, 0.6, 0.5))); const hold = new THREE.Group(); hold.add(needle); ship.add(hold); }
  const needleArm = needle.children[0];

  // WREN: a cream ball in a teal gimbal ring with one amber eye, perched on the starboard wing panel. It looks at what matters.
  const wren = new THREE.Group(); wren.position.set(-0.69, 1.52, 3.37);
  const wrenBall = new THREE.Group(), wrenEye = lit(1.5, 1.05, 0.42);
  wrenBall.add(part(new THREE.SphereGeometry(0.068, 20, 14), M.hull), part(new THREE.SphereGeometry(0.018, 10, 8), wrenEye, 0, 0.012, 0.055), part(new THREE.TorusGeometry(0.03, 0.005, 6, 14), M.dark, 0, 0.012, 0.05), part(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6), M.gold, 0.02, 0.088, -0.01));
  const wrenRing = part(new THREE.TorusGeometry(0.086, 0.009, 6, 24), M.teal);
  wren.add(wrenBall, wrenRing); ship.add(wren);

  // status lights (one instanced mesh) and toggle switches (another)
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0115, 10, 6).scale(1, 1, 0.55), new THREE.MeshBasicMaterial({ fog: false, toneMapped: false }), lightAt.length);
  const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), col = new THREE.Color(0.1, 0.1, 0.14);
  lightAt.forEach((l, i) => { const side = l.id[0] === 'L' ? 0.62 : l.id[0] === 'R' ? -0.62 : 0, tilt = l.id[0] === 'O' ? -0.42 : TILT; qq.setFromEuler(_e.set(tilt + Math.PI, side, 0)); lights.setMatrixAt(i, mm.compose(_p.set(...l.p), qq, _s.set(1, 1, 1))); lights.setColorAt(i, col); });
  lights.frustumCulled = false; ship.add(lights);
  const toggles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0035, 0.0055, 0.03, 6).translate(0, 0.015, 0), M.steel, toggleAt.length); toggles.frustumCulled = false; ship.add(toggles);
  const tState = toggleAt.map((t, i) => (i * 7 % 3 === 0 ? -1 : 1));
  function setToggle(i, s) { const t = toggleAt[i]; tState[i] = s; qq.setFromEuler(_e.set((t.rx || 0) + s * 0.42, t.ry || 0, 0, 'YXZ')); _e.order = 'XYZ'; toggles.setMatrixAt(i, mm.compose(_p.set(...t.p), qq, _s.set(1, 1, 1))); toggles.instanceMatrix.needsUpdate = true; }
  toggleAt.forEach((t, i) => setToggle(i, tState[i]));
  const lightIx = Object.fromEntries(lightAt.map((l, i) => [l.id, i])), toggleIx = Object.fromEntries(toggleAt.map((t, i) => [t.id, i]));

  // things that hang and sway with the g: two grab loops from the eyebrow, and a paper wren on a thread from the pod
  const sway = [];
  const hang = (p, len, build) => { const g = new THREE.Group(); g.position.set(...p); build(g, len); ship.add(g); sway.push({ g, len, ax: 0, az: 0, vx: 0, vz: 0 }); return g; };
  for (const sd of [-1, 1]) hang(onBall(sd * 0.52, 0.92, BR - 0.09), 0.2, (g, len) => { g.add(part(box(0.022, len - 0.05, 0.005), M.pad, 0, -(len - 0.05) / 2, 0), part(new THREE.TorusGeometry(0.047, 0.009, 6, 18), M.gold, 0, -len, 0)); });
  hang([0.3, 2.3, 3.2], 0.13, (g, len) => { g.add(part(new THREE.CylinderGeometry(0.0012, 0.0012, len, 4), M.dark, 0, -len / 2, 0));
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.04, 0, 0, -0.03, 0.04, 0.02, -0.005, 0, 0, 0.04, -0.04, 0.02, -0.005, 0, 0, -0.03, 0, 0, 0.04, 0, -0.012, 0.0, 0, 0, -0.03], 3)); bg.computeVertexNormals();
    const bird = new THREE.Mesh(bg, wash(PAL.gold, { side: THREE.DoubleSide })); bird.position.y = -len - 0.006; g.add(bird); });

  return { ship, M, PAL, glassOut, inst, ic, iTex, ghost, stick, lever, handR, handL, needleArm, wren, wrenBall, wrenRing, wrenEye, lights, lightIx, toggles, toggleIx, setToggle, tState, sway, bodyMeshes, outMeshes, part, lit, onPanel };
}

// WREN outside the ship: the same ball, carried at the hub of a hoop it rolls along the seabed like a coin on its edge. A gyroscope
// rather than a walker: nothing on it steps.
export function buildHoop({ THREE, V, M, lit }) {
  const R = 0.66, g = new THREE.Group(), roll = new THREE.Group(), hub = new THREE.Group();
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  add(roll, new THREE.TorusGeometry(R, 0.045, 8, 40), M.teal); add(roll, new THREE.TorusGeometry(R - 0.06, 0.018, 6, 40), M.gold);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3, x0 = Math.cos(a), y0 = Math.sin(a), m = add(roll, new THREE.CylinderGeometry(0.012, 0.012, R - 0.2, 6), M.steel, x0 * (R + 0.2) / 2 * 0.98, y0 * (R + 0.2) / 2 * 0.98, 0); m.rotation.z = a - Math.PI / 2; }
  add(roll, new THREE.TorusGeometry(0.2, 0.014, 6, 24), M.steel);
  // the hub stays level while the hoop turns round it
  add(hub, new THREE.TorusGeometry(0.15, 0.012, 6, 24).rotateY(Math.PI / 2), M.teal); add(hub, new THREE.SphereGeometry(0.1, 18, 14), M.hull);
  add(hub, new THREE.SphereGeometry(0.03, 10, 8), lit(2.4, 1.6, 0.6), 0, 0.02, 0.085); add(hub, new THREE.CylinderGeometry(0.005, 0.005, 0.12, 6), M.gold, 0.03, 0.14, -0.02);
  const lamp = add(hub, new THREE.SphereGeometry(0.022, 8, 6), lit(2.8, 1.9, 0.8), 0.03, 0.21, -0.02);
  roll.rotation.y = Math.PI / 2; g.add(roll, hub); g.visible = false;
  return { g, roll, hub, lamp, R };
}

// ---------- the primary display ----------
// Drawn for the size it will have on the screen: on a desktop everything fits; on a phone (compact) only what you fly by, large.
export function drawDisplay(g, d, compact) {
  const W = PANEL.IW, H = PANEL.IH, ink = '#f6f2ee', dim = 'rgba(246,242,238,.6)', teal = '#8fd0c8', coral = '#f2907c', gold = '#f1d074', bg = '#1b1e2a', cellC = '#262a3a';
  const F = (px, w = 500) => `${w} ${px}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  const cell = (x, y, w, h, c = cellC) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, 14); g.fill(); };
  const text = (t, x, y, px, col = ink, w = 500, al = 'left') => { g.fillStyle = col; g.font = F(px, w); g.textAlign = al; g.fillText(t, x, y); };
  const flash = d.flash, L = d.L, sm = compact ? 44 : 26;
  g.globalAlpha = 1; g.fillStyle = bg; g.fillRect(0, 0, W, H);
  if (d.dip > 0) { g.fillStyle = `rgba(0,0,0,${0.35 * d.dip})`; } // (drawn at the end) the screen dips when an engine coughs
  const h = Math.max(0, L.hk), altT = h >= 1000 ? (h / 1000).toFixed(h >= 10000 ? 1 : 2) : h < 100 ? h.toFixed(1) : String(Math.round(h)), altU = h >= 1000 ? 'km' : 'm';
  const waveOn = d.waveAlive && L.wave < 20000 && L.wave > -3000, tti = Math.max(0, L.wave) / d.C, ttiT = `${Math.floor(tti / 60)}:${String(Math.floor(tti % 60)).padStart(2, '0')}`, waveHot = waveOn && L.wave < 4900 && L.wave > -200;
  const dd = d.T / d.DAY, days = Math.floor(dd), hrs = Math.floor((dd - days) * 24), mm = Math.floor(d.T / 60), ss = Math.floor(d.T % 60), here = `${mm}:${String(ss).padStart(2, '0')}`;
  const slow = L.V < 62 && L.contact < 0.3 && L.hk > 2, flooded = L.main && L.ingest > 0.03;
  // the attitude ball, with the flight director's ring: put the little cross in the ring and you are flying what the computer would
  const att = (x, y, w, hh) => {
    g.save(); g.beginPath(); g.roundRect(x, y, w, hh, 14); g.clip(); const cx = x + w / 2, cy = y + hh / 2, k = hh * 0.95;
    g.translate(cx, cy); g.rotate(-L.roll); g.translate(0, L.pitch * k);
    g.fillStyle = '#7f95bd'; g.fillRect(-900, -1400, 1800, 1400); g.fillStyle = '#5c8f8c'; g.fillRect(-900, 0, 1800, 1400); g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.moveTo(-900, 0); g.lineTo(900, 0); g.stroke();
    g.lineWidth = 2; g.fillStyle = ink; g.font = F(compact ? 30 : 22); g.textAlign = 'center';
    for (let a = -80; a <= 80; a += compact ? 20 : 10) { if (!a) continue; const yy = -a * Math.PI / 180 * k, hw = a % 20 ? 20 : 38; g.beginPath(); g.moveTo(-hw, yy); g.lineTo(hw, yy); g.stroke(); if (a % 20 === 0) g.fillText(String(Math.abs(a)), hw + 26, yy + 8); }
    g.restore();
    g.save(); g.beginPath(); g.roundRect(x, y, w, hh, 14); g.clip();
    g.strokeStyle = gold; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 70, cy); g.lineTo(cx - 28, cy); g.lineTo(cx, cy + 16); g.lineTo(cx + 28, cy); g.lineTo(cx + 70, cy); g.stroke();
    if (d.fd) { const fx = cx + (L.fd.sx - L.sx) * 86, fy = cy + (L.fd.sy - L.sy) * 86, on = Math.hypot(L.fd.sx - L.sx, L.fd.sy - L.sy) < 0.16;
      g.strokeStyle = on ? teal : coral; g.lineWidth = 5; g.beginPath(); g.arc(fx, fy, 22, 0, 7); g.stroke(); g.beginPath(); g.moveTo(cx - 10, cy); g.lineTo(cx + 10, cy); g.moveTo(cx, cy - 10); g.lineTo(cx, cy + 10); g.strokeStyle = ink; g.lineWidth = 3; g.stroke(); }
    g.fillStyle = 'rgba(27,30,42,.72)'; g.beginPath(); g.roundRect(x + 10, y + 10, compact ? 142 : 96, compact ? 50 : 34, 8); g.fill(); text(d.fd ? 'MANUAL' : 'AUTO', x + 18, y + (compact ? 46 : 35), compact ? 32 : 22, d.fd ? coral : gold, 700);
    if (L.pullup && flash) { g.fillStyle = coral; g.beginPath(); g.roundRect(cx - 110, y + hh - 62, 220, 50, 10); g.fill(); text('PULL UP', cx, y + hh - 26, 34, bg, 800, 'center'); }
    else if (L.shaker && flash) { g.fillStyle = coral; g.beginPath(); g.roundRect(cx - 90, y + hh - 62, 180, 50, 10); g.fill(); text('STALL', cx, y + hh - 26, 34, bg, 800, 'center'); }
    g.restore();
  };
  const thr = (x, y, w, hh) => { const bx = x + w / 2 - 17, by = y + 44, bh = hh - 58;
    cell(x, y, w, hh); text('THR', x + w / 2, y + 32, sm, dim, 600, 'center');
    g.fillStyle = 'rgba(246,242,238,.12)'; g.fillRect(bx, by, 34, bh); g.fillStyle = flooded ? coral : teal; g.fillRect(bx, by + bh * (1 - Math.min(1, L.power)), 34, bh * Math.min(1, L.power));
    g.fillStyle = gold; g.fillRect(bx - 10, by + bh * (1 - L.thr) - 3, 54, 6);
    if (d.fd && L.fd.hold > 0.5 && L.thr < 0.8 && flash) { g.fillStyle = coral; g.beginPath(); g.moveTo(bx + 17, by - 4); g.lineTo(bx + 46, by + 22); g.lineTo(bx - 12, by + 22); g.fill(); } };
  if (compact) {
    cell(10, 10, 300, 236); text('SPEED', 28, 58, sm, dim, 600); text(String(Math.round(L.V)), 28, 180, 128, slow ? coral : ink, 500); text('m/s', 28, 226, 34, dim);
    att(322, 10, 456, 236);
    cell(790, 10, 300, 236); text('HEIGHT', 808, 58, sm, dim, 600); text(altT, 808, 180, altT.length > 4 ? 96 : 128, ink, 500); text(`${altU} · ${L.vy >= 0 ? '▲' : '▼'}${Math.abs(Math.round(L.vy))}`, 808, 226, 34, dim);
    cell(10, 258, 370, 132, waveHot && flash ? coral : cellC); text('WAVE', 28, 306, sm, waveHot && flash ? bg : dim, 600); text(waveOn ? ttiT : '—', 28, 374, 64, waveHot && flash ? bg : waveOn ? ink : dim, 600); if (waveOn) text(`${(Math.max(0, L.wave) / 1000).toFixed(1)} km`, 362, 374, 40, waveHot && flash ? bg : dim, 500, 'right');
    cell(392, 258, 316, 132); text('EARTH', 410, 306, sm, dim, 600); text(`+${days} d`, 410, 374, 64, gold, 600);
    cell(720, 258, 370, 132, flooded && flash ? '#4a2f36' : cellC); text(flooded ? 'INTAKE WATER' : L.main ? 'ENGINES' : 'THRUST', 738, 306, sm, flooded ? coral : dim, 600);
    g.fillStyle = 'rgba(246,242,238,.12)'; g.fillRect(738, 330, 334, 40); g.fillStyle = flooded ? coral : teal; g.fillRect(738, 330, 334 * (flooded ? L.ingest : Math.min(1, L.power)), 40);
  } else {
    thr(10, 10, 104, 276);
    cell(124, 10, 250, 276); text('AIRSPEED m/s', 142, 46, sm, dim, 600); text(String(Math.round(L.V)), 142, 138, 96, slow ? coral : ink); text('stall 58', 142, 186, sm, slow ? coral : dim);
    text(`brake ${Math.round(L.brake * 100)}%`, 142, 224, sm, L.brake > 0.05 ? gold : dim); text(`ref ${Math.round(L.vref || 0)}`, 142, 262, sm, dim);
    att(384, 10, 332, 276);
    cell(726, 10, 250, 276); text('RADAR ALT ' + altU, 744, 46, sm, dim, 600); text(altT, 744, 138, altT.length > 4 ? 76 : 96);
    text(`${L.vy >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(L.vy))} m/s`, 744, 186, 30, Math.abs(L.vy) > 120 ? gold : ink); text(`${L.nz.toFixed(1)} g`, 744, 224, sm, Math.abs(L.nz) > 2.3 ? coral : dim); text(L.cushion > 0.35 ? 'air cushion' : `path ${(L.gam * 57.3).toFixed(0)}°`, 744, 262, sm, L.cushion > 0.35 ? teal : dim);
    cell(986, 10, 104, 276, waveHot && flash ? coral : cellC); const wc = waveHot && flash ? bg : ink;
    text('WAVE', 1038, 46, sm, waveHot && flash ? bg : dim, 600, 'center');
    if (waveOn) { text((Math.max(0, L.wave) / 1000).toFixed(1), 1038, 110, 50, wc, 600, 'center'); text('km', 1038, 142, sm, waveHot && flash ? bg : dim, 500, 'center'); text(ttiT, 1038, 214, 44, waveHot ? (flash ? bg : coral) : ink, 600, 'center'); text('to go', 1038, 250, 24, waveHot && flash ? bg : dim, 500, 'center'); }
    else { text('—', 1038, 120, 50, dim, 500, 'center'); text('clear', 1038, 214, sm, dim, 500, 'center'); }
    // the lower strip: intakes, the two clocks, annunciators
    cell(10, 296, 404, 94, flooded && flash ? '#4a2f36' : cellC); const st = !L.main ? 'ENGINES: DESCENT' : flooded ? (L.thr > 0.2 ? (L.pitch > 0.2 ? 'INTAKES DRAINING' : 'INTAKES FLOODED') : 'INTAKES FLOODED') : 'ENGINES CLEAR';
    text(st, 26, 330, sm, flooded ? coral : L.main ? teal : dim, 700); g.fillStyle = 'rgba(246,242,238,.12)'; g.fillRect(26, 346, 290, 26); g.fillStyle = flooded ? coral : teal; g.fillRect(26, 346, 290 * (L.main ? L.ingest : 0), 26);
    text(L.main ? `${Math.round(L.ingest * 100)}%` : '', 400, 370, 30, flooded ? coral : dim, 600, 'right');
    cell(424, 296, 404, 94); text('HERE', 440, 330, sm, dim, 600); text(here, 440, 376, 40, ink, 600); text('EARTH', 600, 330, sm, dim, 600); text(`+${days} d ${String(hrs).padStart(2, '0')} h`, 600, 376, 40, gold, 600);
    const ann = (t, x, w, on, c) => { g.fillStyle = on ? c : 'rgba(246,242,238,.07)'; g.beginPath(); g.roundRect(x, 296, w, 94, 14); g.fill(); text(t, x + w / 2, 353, sm, on ? bg : 'rgba(246,242,238,.35)', 800, 'center'); };
    ann('MAIN', 838, 120, L.main, teal); ann(d.fd ? 'HAND' : 'AUTO', 968, 122, !d.fd, gold);
  }
  if (d.dip > 0) { g.fillStyle = `rgba(0,0,0,${0.4 * d.dip})`; g.fillRect(0, 0, W, H); }
  return compact ? 44 : 26; // the smallest type used, in canvas pixels
}
