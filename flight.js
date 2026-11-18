// The lander's flight: a point mass with wings, two engines and floats, on a world with 130% of Earth's gravity.
// No drawing here, only numbers, so the same code can be stepped by the page, by the tests and by Node.
//
// Assumptions (the film and Kip Thorne's book give the gravity, the wave's height and the depth of the water, not a lander):
//   air: as dense as Earth's at the surface, thinning with a scale height of 8.5 km / 1.3 = 6.5 km
//   the lander ("Heron", an invented flying boat): 9 t, 46 m2 of wing, 13 m span, lift slope 3.2 per radian, stalls at 20 degrees,
//     zero-lift drag 0.05 (floats down), air brakes add 0.22; it weighs 114 kN here, so it stalls at about 58 m/s, 14% faster than on Earth
//   engines: 12% of weight in the descent (propellant is saved for the way up), 2.6 times weight once armed on the water (3.4 Earth g)
//   water: buoyancy balances weight at a draft of 0.45 m; planing lift and drag grow with speed; floating, the hull is dragged
//     along with the water of the wave
//   handling: the bank and the pitch rate have inertia (the hull is heavy and the air thin on the way in), the fly-by-wire holds the
//     flight path when the stick is let go (trim), the wing buffets and the stick shakes short of the stall, the overcast is full of
//     gusts and a wandering crosswind, and a hand-over between the pilot and the flight computer is blended over most of a second
export const FL = { M: 9000, S: 46, SPAN: 13, CLA: 3.2, A0: -0.035, AMAX: 0.35, CD0: 0.05, K: 0.15, CDB: 0.22, TAPP: 0.12, TMAIN: 2.6,
  RHO0: 1.2, HS: 6500, CLOUD_TOP: 5800, CLOUD_BASE: 2400, QMAX: 0.8, BANK: 1.0, DRAFT: 0.45, VTD: 64, Y0: 8400, D0: 13600, V0: 400,
  WAVE_AHEAD: 17200, ALARM: 4900, EYE: [0, 1.95, 2.3] };

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const pw = (xs, ys, x) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[ys.length - 1]; };
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// smooth, repeatable "noise" from a few sines that never line up
const nz1 = (t, k) => Math.sin(t * 1.7 + k) * 0.5 + Math.sin(t * 2.9 + k * 1.3) * 0.3 + Math.sin(t * 4.7 + k * 2.1) * 0.2;

// How hard everything shakes, from what is physically going on. Each part feeds different frequencies in the cockpit, the rumble
// motors and the sound: air (buffet, low), alpha (pre-stall burble), thr (engine, mid and high), water (slap and chatter), hit (impacts).
export function shakeOf({ q = 0, turb = 0, alphaN = 0, power = 0, sput = 0, contact = 0, vh = 0, prox = 0, hit = 0, heat = 0 }) {
  const air = clamp(q / 22000, 0, 1.4) * (0.22 + 0.78 * turb) + heat * 0.5;
  const alpha = alphaN * clamp(q / 4000, 0, 1);
  const thr = Math.pow(clamp(power, 0, 1), 0.7) * 0.8 + sput * 0.5;
  const water = contact * clamp(vh / 45, 0.15, 1.2) + prox * 0.35;
  return { air, alpha, thr, water, hit, total: clamp(0.6 * air + 0.5 * alpha + 0.65 * thr + 0.7 * water + hit, 0, 2.2) };
}

// the speed the flight computer wants at each distance from the landing mark; it works the air brakes to get it
const V_REF = (d) => pw([-1e9, 0, 350, 2300, 4600, 9200, 14400], [60, FL.VTD, 78, 172, 200, 300, 400], d);

export function createFlight(env) {
  const { g, C, HMAX, W, waterH, prof, envX, zOff } = env;
  const WT = FL.M * g;
  const L = { events: [] };
  function reset(loop = 0) {
    const gam = -0.44, psi = -0.03;
    Object.assign(L, { x: 260, y: FL.Y0, z: -FL.D0, vx: FL.V0 * Math.cos(gam) * Math.sin(psi), vy: FL.V0 * Math.sin(gam), vz: FL.V0 * Math.cos(gam) * Math.cos(psi),
      pitch: gam + 0.05, roll: 0, rollRate: 0, yaw: psi, pitchRate: 0, sx: 0, sy: 0, ap: 1, trim: gam, trimT: 0, fd: { sx: 0, sy: 0, hold: 0 }, coughPh: 0, cough: 0, rpm: 0, ny: 0, buffet: 0, shaker: false, cushion: 0, gust: 0, hold: 0, thr: 0, power: 0, ingest: 0, brake: 0, main: false, contact: 0, contactT: 0,
      phase: 'entry', t: 0, T: 0, loop, fade: false, breaking: false, spin: 0, hit: 0, pullup: false, auto: true, alarmOn: false, cleared: false, over: false, alarmAt: 0, skipAt: 0,
      V: FL.V0, gam, alpha: 0.05, nz: 1, nx: 0, hk: FL.Y0, q: 0, turb: 0, heat: 0, rain: 0, prox: 0, eject: 0, sput: 0, cp: null, wave: 1e9, late: false, skipped: 0,
      shake: shakeOf({}) });
    Object.assign(W, { alive: false, H: HMAX, spill: 0, spillX: 0, zc: 1e6 });
    L.events.push('reset');
  }
  function setPhase(p) { L.phase = p; L.t = 0; L.events.push(p); }
  // back on the water where it came to rest, with the wave coming again
  function checkpoint() {
    const c = L.cp || { x: 0, z: 0 };
    Object.assign(L, { x: c.x, y: -FL.DRAFT, z: c.z, vx: 0, vy: 0, vz: 0, pitch: 0, roll: 0, rollRate: 0, yaw: 0, pitchRate: 0, coughPh: 0, cough: 0, thr: 0, power: 0, ingest: 1, main: true, contact: 1,
      fade: false, breaking: false, spin: 0, hit: 0, alarmOn: false, cleared: false, over: false, alarmAt: 0, skipAt: 0, loop: L.loop + 1 });
    Object.assign(W, { alive: true, H: HMAX, spill: 0, spillX: 0, zc: c.z + 5600 });
    setPhase('still');
  }

  // the flight computer flying on its own: what it would do with the stick and the throttle
  function pilot(o) {
    const ph = L.phase; let sx = 0, sy = 0, hold = 0;
    const fly = (gc) => { // the stick that takes the flight path to the angle gc, within 2.5 g and short of the stall
      const nc = clamp(Math.cos(o.gam) + (o.V / g) * clamp(1.6 * (gc - o.gam), -0.3, 0.3), -0.2, 2.5);
      const ar = clamp(nc * WT / (Math.max(o.q, 200) * FL.S * FL.CLA) + FL.A0, -0.08, FL.AMAX - 0.06);
      return clamp((o.gam + ar - L.pitch) * 3.2 / FL.QMAX, -1, 1); };
    const level = () => clamp((L.yaw - clamp(-L.x / 1400, -0.3, 0.3)) * 1.7, -0.6, 0.6);
    if (ph === 'entry' || ph === 'cloud' || ph === 'approach' || ph === 'skim') {
      const landing = o.d < 380 || (o.V < FL.VTD + 10 && o.hk < 12);
      const hs = landing ? -0.6 : 6, above = Math.max(0, o.hk - hs);
      // sink fast, then ease the sink off at a steady 13 m/s2 so the pull-out ends at skimming height
      const sink = Math.min(L.y > FL.CLOUD_TOP ? 190 : 170, Math.sqrt(2 * 13 * above), above / 0.9 + (landing ? 1.2 : 0));
      sy = fly(Math.asin(clamp(-sink / Math.max(o.V, 30), -0.72, 0.3))); sx = level();
      hold = o.V < o.vref - 8 ? 1 : 0;
    } else if (ph === 'alarm' || ph === 'face') { hold = L.T - L.alarmAt >= (o.lag || 0) ? 1 : 0; sy = L.power > 0.45 ? 1 : 0; }
    else if (ph === 'climb') {
      // stand it on its tail until it is thrown high enough to clear the crest, then ease the nose down and fly over the top
      const top = W.H * envX(L.x) + 330, apex = L.y + Math.max(0, L.vy) ** 2 / (2 * g);
      if (!L.over && apex > top) L.over = true;
      if (!L.over) { hold = 1; sy = clamp((1.36 - L.pitch) * 2.2, -1, 1); sx = clamp(L.yaw * 1.5, -0.4, 0.4); }
      else { sy = o.q > 1500 ? fly(clamp((top - L.y) / (Math.max(o.V, 60) * 2.5), -0.25, 1.2)) : clamp((0.3 - L.pitch) * 1.5, -1, 1); sx = level(); hold = clamp((top - apex) / 150 + (130 - o.V) / 40, 0, 1); }
    } else if (ph === 'out') { sy = o.q > 1500 ? fly(0.45) : clamp((0.4 - L.pitch) * 1.5, -1, 1); sx = level(); hold = 0.5; }
    return { sx, sy, hold };
  }

  function sub(dt, input) {
    L.t += dt; L.T += dt;
    if (W.alive) { W.zc -= C * dt; if (L.breaking) { W.spill = Math.min(1, W.spill + dt / 4.5); W.spillX = 700 + 9500 * W.spill ** 1.4; } }
    const ph0 = L.phase;
    if (ph0 === 'wipe') { // tumbling in the white water: nothing to fly
      L.spin += dt * 2.6; L.z -= C * 0.9 * dt; L.y = waterH(L.x, L.z) + 2; L.thr *= Math.exp(-dt * 4); L.power = 0; L.hit = 1.2; L.sx *= 0.9; L.sy *= 0.9;
      L.shake = shakeOf({ contact: 1, vh: 60, hit: 1 }); L.contact = 1; L.hk = 0;
      if (L.t > 2.2) L.fade = true; if (L.t > 3.6) checkpoint(); return;
    }
    const e = 0.5, wy = waterH(L.x, L.z), slz = (waterH(L.x, L.z + e) - waterH(L.x, L.z - e)) / (2 * e);
    const s = L.z - W.zc - zOff(L.x), ex = envX(L.x), p = W.alive ? prof(s) : 0, wvy = C * slz, hk = L.y - wy;
    const V = Math.hypot(L.vx, L.vy, L.vz), Vh = Math.hypot(L.vx, L.vz), d = -L.z;
    const rho = FL.RHO0 * Math.exp(-Math.max(0, L.y) / FL.HS), q = 0.5 * rho * V * V, gam = Math.atan2(L.vy, Math.max(Vh, 1e-3));
    const vref = V_REF(d), crest = W.alive ? W.zc - L.z : 1e9;
    L.wave = crest;

    // ----- phases -----
    let ph = L.phase;
    if (ph === 'entry' && L.y < FL.CLOUD_TOP) setPhase('cloud');
    else if (ph === 'cloud' && L.y < FL.CLOUD_BASE) { setPhase('approach'); Object.assign(W, { alive: true, zc: L.z + FL.WAVE_AHEAD, H: HMAX, spill: 0, spillX: 0 }); }
    else if (ph === 'approach' && hk < 30) setPhase('skim');
    else if ((ph === 'approach' || ph === 'skim') && L.contactT > 0.25 && V < 110) { setPhase('splash'); L.hit += 0.6; }
    else if (ph === 'splash' && (Vh < 2.5 || crest < FL.ALARM)) { setPhase('still'); L.main = true; L.ingest = 1; L.cp = { x: L.x, z: L.z }; }
    else if (ph === 'still' && L.t > 5 && crest > FL.ALARM + C * 22 && !L.skipAt) { L.skipAt = L.t; L.fade = true; } /* landed long before the wave: cut ahead rather than wait */
    else if (ph === 'still' && L.skipAt && L.t > L.skipAt + 1.3 && L.fade) { const sec = (crest - FL.ALARM - C * 8) / C; W.zc -= C * sec; L.T += sec; L.skipped += sec; L.fade = false; L.events.push('skip'); }
    else if (ph === 'still' && !L.fade && (crest < FL.ALARM || wy > 0.3)) { setPhase('alarm'); L.alarmOn = true; L.alarmAt = L.T; }
    else if (ph === 'alarm' && wy > 2) setPhase('face');
    else if ((ph === 'face' || ph === 'alarm') && hk > 4 && L.power > 0.6) setPhase('climb');
    else if (ph === 'climb' && ((s > 60 && hk > 40) || L.y > FL.CLOUD_BASE - 60)) { setPhase('out'); L.breaking = true; L.alarmOn = false; }
    else if (ph === 'out') { if (L.t > 7) L.fade = true; if (L.t > 8.5) { reset(L.loop + 1); return; } }
    // still in the air when the wave is nearly here: arm the main engines and go over it
    if ((ph === 'entry' || ph === 'cloud' || ph === 'approach' || ph === 'skim' || ph === 'splash') && crest < 3600 && L.phase !== 'still') { L.main = true; L.ingest = 0; L.late = true; L.alarmOn = true; L.alarmAt = L.T; setPhase('climb'); }
    ph = L.phase;
    if ((ph === 'face' || ph === 'alarm' || ph === 'climb') && hk < 6 && p * ex > 0.72 && s < 0) { /* still on the water this high up the face: the breaking crest has it */ setPhase('wipe'); L.breaking = true; L.spin = 0; return; }
    if (ph === 'climb' && s > -900) L.breaking = true;

    // ----- stick and throttle -----
    const o = { V, Vh, d, q, gam, hk, vref, lag: input.lag };
    L.auto = !!input.auto;
    // the flight computer always works out what it would do: that is the flight director's cue, and what it flies when it has the lander
    const fdc = pilot(o); L.fd.sx = fdc.sx; L.fd.sy = fdc.sy; L.fd.hold = fdc.hold;
    L.ap = clamp(L.ap + (input.auto ? dt / 0.9 : -dt / 0.3), 0, 1); // taking over is quick; giving it back is eased
    const k = L.ap * L.ap * (3 - 2 * L.ap), mi = input.auto ? { sx: L.sx, sy: L.sy, hold: L.hold } : input;
    const c = k >= 1 ? fdc : { sx: lerp(mi.sx || 0, fdc.sx, k), sy: lerp(mi.sy || 0, fdc.sy, k), hold: lerp(mi.hold || 0, fdc.hold, k) };
    L.sx += (clamp(c.sx, -1, 1) - L.sx) * (1 - Math.exp(-dt * 10)); L.sy += (clamp(c.sy, -1, 1) - L.sy) * (1 - Math.exp(-dt * 10));
    L.hold = clamp(c.hold, 0, 1);
    L.thr += (L.hold - L.thr) * (1 - Math.exp(-dt / 0.7));
    // water in the intakes: thrust comes in coughs until it has been blown and drained out; nose-up on the wave's face drains it fast
    if (L.main && L.thr > 0.2 && L.ingest > 0) { L.ingest = Math.max(0, L.ingest - dt * L.thr * (0.014 + 1.8 * Math.max(0, Math.sin(L.pitch)))); if (L.ingest === 0 && !L.cleared) { L.cleared = true; L.events.push('clear'); } }
    // a flooded engine fires in coughs: each one a kick of thrust and a slug of water out of the nozzle; they come faster as it drains
    let cough = 0;
    if (L.main && L.ingest > 0.03 && L.thr > 0.2) {
      const before = L.coughPh; L.coughPh += dt * L.thr * (0.8 + 3.4 * (1 - L.ingest) ** 1.5);
      if (Math.floor(L.coughPh) > Math.floor(before)) L.events.push('cough');
      const u = (((L.coughPh % 1) + 1) % 1) / 0.42; cough = u < 1 ? Math.exp(-u * 3.2) * Math.min(1, u * 14) * (0.75 + 0.25 * Math.sin(Math.floor(L.coughPh) * 12.9898) ) : 0;
    } else L.coughPh = Math.floor(L.coughPh) + 0.98; /* the first push on the throttle brings a cough at once */
    L.cough = cough;
    L.sput = cough * L.thr * Math.min(1, L.ingest * 3);
    L.power = L.thr * ((1 - L.ingest) ** 2 + 0.2 * Math.min(1, L.ingest * 2) * cough);
    L.rpm += (L.thr * (0.3 + 0.7 * (1 - L.ingest) ** 1.5) + 0.3 * cough * Math.min(1, L.ingest * 2) - L.rpm) * (1 - Math.exp(-dt * 9));
    L.eject = L.main ? L.thr * Math.min(1, L.ingest * 2.5) : 0;
    const T = (L.main ? FL.TMAIN : FL.TAPP) * WT * L.power;
    const bk = ph === 'entry' || ph === 'cloud' || ph === 'approach' || ph === 'skim' || ph === 'splash' ? clamp((V - vref) / 18, 0, 1) : 0;
    L.brake += (bk - L.brake) * (1 - Math.exp(-dt / 0.4));

    // ----- water under the floats -----
    const imm = clamp(wy - L.y, -0.3, 1.2) + 0.3, contact = clamp(imm / 0.3, 0, 1) * (imm > 0 ? 1 : 0); // floats reach 0.3 m below the keel line
    if (contact > 0.2 && L.contact <= 0.2) { L.hit += clamp(Math.abs(L.vy - wvy) / 8 + Vh / 120, 0, 1.5); L.events.push('contact'); }
    L.contact = contact; L.contactT = contact > 0.5 ? L.contactT + dt : 0;

    // ----- attitude -----
    const air = 1 - contact, landing = V < FL.VTD + 22;
    L.turb = smooth(FL.CLOUD_TOP + 300, FL.CLOUD_TOP - 300, L.y) * (0.25 + 0.75 * smooth(FL.CLOUD_BASE - 500, FL.CLOUD_BASE + 200, L.y)) * (ph === 'entry' || ph === 'cloud' || ph === 'approach' || ph === 'skim' ? 1 : 0.4);
    L.heat = smooth(250, 400, V) * smooth(5000, 7600, L.y);
    L.rain = (1 - smooth(FL.CLOUD_TOP - 200, FL.CLOUD_TOP + 300, L.y)) * (ph === 'still' || ph === 'alarm' || ph === 'face' || ph === 'climb' || ph === 'out' ? 0.45 : ph === 'splash' ? 0.7 : 1);
    // gusts: fast chop plus a slow wandering crosswind, both strongest inside the overcast
    const qk = Math.min(1, q / 6000), gF = nz1(L.T, 3), gS = nz1(L.T * 0.19, 11), gV = nz1(L.T, 1);
    L.gust = L.turb * (0.6 * gF + 0.4 * gS);
    // bank: a roll rate with inertia, aimed at the bank the stick asks for; gusts roll it, and the wing drops in the buffet
    const auth = 0.35 + 0.65 * Math.min(1, q / 3500);
    const rollAcc = 9.5 * auth * (L.sx * FL.BANK * (0.12 + 0.88 * air) - L.roll) - 5.2 * L.rollRate + (1.5 * nz1(L.T, 5) * L.turb + 1.1 * L.buffet * nz1(L.T * 3.1, 7)) * air * qk;
    L.rollRate += rollAcc * dt; L.roll += L.rollRate * dt;
    const cy = Math.cos(L.yaw), sy_ = Math.sin(L.yaw), cp = Math.cos(L.pitch), sp = Math.sin(L.pitch), cr = Math.cos(L.roll), sr = Math.sin(L.roll);
    const f = [sy_ * cp, sp, cy * cp], rg = [-cy, 0, sy_], u0 = [-sy_ * sp, cp, -cy * sp];
    const u = [u0[0] * cr + rg[0] * sr, u0[1] * cr + rg[1] * sr, u0[2] * cr + rg[2] * sr], rb = [rg[0] * cr - u0[0] * sr, rg[1] * cr - u0[1] * sr, rg[2] * cr - u0[2] * sr];
    const dot = (a, x, y, z) => a[0] * x + a[1] * y + a[2] * z;
    const alpha = V > 8 ? Math.atan2(-dot(u, L.vx, L.vy, L.vz), Math.max(dot(f, L.vx, L.vy, L.vz), 1e-3)) : 0;
    L.buffet = smooth(FL.AMAX - 0.09, FL.AMAX + 0.02, alpha) * clamp(q / 2500, 0, 1) * air; L.shaker = L.buffet > 0.25;
    let qc = L.sy * FL.QMAX; L.pullup = false;
    // trim: with the stick let go, the fly-by-wire holds the flight path it had (a hand flying it gets a steady platform)
    if (Math.abs(L.sy) < 0.06 && air > 0.5 && q > 1500 && L.ap < 0.5) { L.trimT += dt; if (L.trimT < 0.35) L.trim = gam; else qc += clamp((L.trim - gam) * 1.4, -0.25, 0.25); } else { L.trimT = 0; L.trim = gam; }
    qc += L.buffet * 0.5 * nz1(L.T * 2.7, 13) * air;
    if (q > 1500) { // the fly-by-wire keeps it out of a stall, under 2.6 g, and out of the sea
      if (alpha > FL.AMAX - 0.05) qc -= (alpha - (FL.AMAX - 0.05)) * 5;
      if (alpha < -0.12) qc += (-0.12 - alpha) * 5;
      if (L.nz > 2.6) qc -= (L.nz - 2.6) * 0.6;
      if (L.nz < -0.2) qc += (-0.2 - L.nz) * 0.6;
      const la = 1.8, hp = L.y + L.vy * la - waterH(L.x + L.vx * la, L.z + (L.vz + (W.alive ? C : 0)) * la);
      if (V > 86 && hp < 3 && air > 0.5) { qc += clamp((3 - hp) / 25, 0, 1) * FL.QMAX * 1.2; L.pullup = hp < -4; }
    }
    L.pitchRate += (qc - L.pitchRate) * (1 - Math.exp(-dt * 3.0));
    const onW = Math.atan(slz * cy) + L.sy * (0.1 * Math.min(1, Vh / 30) + 0.6 * clamp(L.power * 1.4, 0, 1)) + (ph === 'splash' ? 0.03 : 0); // with power on, pulling back lifts the bow
    L.pitch = clamp(L.pitch + L.pitchRate * dt * air + (onW - L.pitch) * (1 - Math.exp(-dt * 4)) * contact + nz1(L.T, 9) * 0.12 * L.turb * dt * air, -1.35, 1.48);
    if (Vh > 20 && air > 0.3) L.yaw += wrap(Math.atan2(L.vx, L.vz) - L.yaw) * (1 - Math.exp(-dt * 3));
    else if (contact > 0.3) L.yaw += wrap(0 - L.yaw) * (1 - Math.exp(-dt * 0.3)); // the water drawing back toward the wave turns the hull to face it

    // ----- forces -----
    let ax = 0, ay = 0, az = 0;
    const hw = Math.max(0, hk) + 1.4, ge = (16 * hw / FL.SPAN) ** 2 / (1 + (16 * hw / FL.SPAN) ** 2); // ground effect: less induced drag, a little more lift
    let CL = clamp(FL.CLA * (alpha - FL.A0), -0.6, FL.CLA * (FL.AMAX - FL.A0)); if (alpha > FL.AMAX) CL *= 1 - 0.6 * clamp((alpha - FL.AMAX) / 0.2, 0, 1);
    CL *= (1 + 0.12 * (1 - ge)) * (1 - 0.1 * L.buffet * (0.5 + 0.5 * nz1(L.T * 3.3, 17)));
    const CD = FL.CD0 + L.brake * FL.CDB + FL.K * (0.25 + 0.75 * ge) * CL * CL + (alpha > FL.AMAX ? 0.3 : 0);
    if (V > 8) {
      const vx = L.vx / V, vy = L.vy / V, vz = L.vz / V, k = dot(u, vx, vy, vz);
      let lx = u[0] - k * vx, ly = u[1] - k * vy, lz = u[2] - k * vz; const ln = Math.hypot(lx, ly, lz) || 1; lx /= ln; ly /= ln; lz /= ln;
      const Lf = q * FL.S * CL / FL.M, Df = q * FL.S * CD / FL.M, beta = dot(rb, vx, vy, vz), Sf = -q * FL.S * 1.2 * beta / FL.M;
      ax += Lf * lx - Df * vx + Sf * rb[0]; ay += Lf * ly - Df * vy + Sf * rb[1]; az += Lf * lz - Df * vz + Sf * rb[2];
    }
    // the cushion of air squeezed under the wing close to the water: it pushes back hardest when sinking fast
    const cush = Math.exp(-Math.max(0, hk) / 1.6) * Math.min(1, q / 3000) * air; L.cushion = Math.exp(-Math.max(0, hk) / 5) * Math.min(1, q / 3000) * air;
    ay += g * 0.5 * cush * clamp(0.3 - (L.vy - wvy) / 6, 0, 1.6);
    ax += T / FL.M * f[0]; ay += T / FL.M * f[1]; az += T / FL.M * f[2];
    if (L.turb > 0.01 && air > 0.5) { ay += g * 0.3 * L.turb * gV * qk; ax += g * L.turb * (0.14 * gF + 0.1 * gS) * qk; }
    if (contact > 0) {
      const hs_ = W.alive ? W.H / HMAX : 0, carry = (s < 0 ? Math.min(1, 1.12 * Math.sqrt(p)) : p ** 1.5) * hs_ * ex;
      const rz = L.vz + C * carry, rx = L.vx, rv = Math.hypot(rx, rz), dr = contact * (2.5 + 0.12 * rv + 0.002 * rv * rv);
      if (rv > 1e-3) { ax -= dr * rx / rv; az -= dr * rz / rv; }
      ay += g * clamp((wy - L.y) / FL.DRAFT, 0, 2.2) + 0.004 * rv * rv * contact - 2 * 0.7 * Math.sqrt(g / FL.DRAFT) * (L.vy - wvy) * contact;
    }
    const sfx = ax, sfy = ay, sfz = az; // everything but gravity: what the seat pushes with
    ay -= g;
    L.vx += ax * dt; L.vy += ay * dt; L.vz += az * dt;
    L.x += L.vx * dt; L.y += L.vy * dt; L.z += L.vz * dt;
    // a hull cannot be pushed far under: it rides up with the surface, however fast the surface rises along its path
    { const wyN = waterH(L.x, L.z), deep = wyN - FL.DRAFT * 1.6; if (L.y < deep) { L.y = deep; L.vy = Math.max(L.vy, slz * (L.vz + (W.alive ? C : 0))); } }

    // ----- what the cockpit shows and feels -----
    L.V = V; L.gam = gam; L.alpha = alpha; L.hk = hk; L.q = q; L.vref = vref;
    L.nz += (dot(u, sfx, sfy, sfz) / g - L.nz) * (1 - Math.exp(-dt * 12)); L.nx += (dot(f, sfx, sfy, sfz) / g - L.nx) * (1 - Math.exp(-dt * 12)); L.ny += (dot(rb, sfx, sfy, sfz) / g - L.ny) * (1 - Math.exp(-dt * 12));
    L.hit *= Math.exp(-dt / 0.3);
    L.prox = Math.exp(-Math.max(0, hk) / 5) * Math.min(1, q / 8000) * air;
    L.shake = shakeOf({ q, turb: L.turb, alphaN: Math.max(smooth(FL.AMAX - 0.1, FL.AMAX, alpha), L.buffet), power: L.power * (L.main ? 1 : 0.25), sput: L.sput, contact, vh: Vh, prox: L.prox, hit: L.hit, heat: L.heat });
  }
  function step(dt, input) { const n = dt > 1 / 45 ? 2 : 1; for (let i = 0; i < n; i++) sub(dt / n, input); }
  { const w0 = { ...W }; reset(0); Object.assign(W, w0); L.events.length = 0; } /* give L its fields without touching the sea that is already there */
  return { L, reset, step, checkpoint, setPhase, FL };
}
