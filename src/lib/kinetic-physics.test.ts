import test from "node:test";
import assert from "node:assert/strict";
import {
  CRITICAL_IMPACT_RS,
  EARTH_CIRCULAR_SPEED_KM_S,
  HAWKING_SUN_NANO_K,
  QUANTUM_WELL_BASE_EV_NM2,
  SCHWARZSCHILD_SUN_KM,
  computeDoubleSlit,
  computeHorizonCurvature,
  computeKeplerOrbit,
  computePhotonDeflection,
  computeQuantumObservables,
  computeQuantumWellMetrics,
  doubleSlitIntensity,
  probeDoubleSlitExact,
  sampleQuantumSuperposition,
  traceSchwarzschildGeodesic,
  trueAnomalyToMeanAnomaly,
  wavelengthToHex,
} from "./kinetic-physics";

test("CODATA 2022 / IAU 2015 derived constants match published benchmarks", () => {
  assert.ok(Math.abs(SCHWARZSCHILD_SUN_KM - 2.9532500765) < 1e-6);
  assert.ok(Math.abs(HAWKING_SUN_NANO_K - 61.7024) < 1e-3);
  assert.ok(Math.abs(EARTH_CIRCULAR_SPEED_KM_S - 29.7846918) < 1e-5);
  assert.ok(Math.abs(QUANTUM_WELL_BASE_EV_NM2 - 0.37603016) < 1e-6);
  assert.ok(Math.abs(CRITICAL_IMPACT_RS - 2.59807621135) < 1e-10);
});

test("wavelengthToHex maps visible spectrum accurately", () => {
  assert.equal(wavelengthToHex(660), "#ff0000");
  assert.equal(wavelengthToHex(532).startsWith("#"), true);
  assert.equal(wavelengthToHex(450).length, 7);
});

test("computeDoubleSlit & probeDoubleSlitExact obey exact non-paraxial Huygens-Fresnel superposition", () => {
  const res = computeDoubleSlit(532, 0.5, 1.5, 0.1);
  // Exact non-paraxial hyperbola y₁ where Δr(y₁) = λ identically:
  const atY1 = probeDoubleSlitExact(res.fringeSpacingMm, 532, 0.5, 1.5, 0.1);
  assert.ok(
    Math.abs(atY1.pathDiffNm - 532) < 1e-9,
    `Exact first bright fringe path diff must equal λ=532nm, got ${atY1.pathDiffNm}`
  );
  assert.ok(Math.abs(atY1.orderM - 1.0) < 1e-11);
  // Close to paraxial 1.596 mm (exact non-paraxial differs by ~9e-7 mm)
  assert.ok(Math.abs(res.fringeSpacingMm - 1.596) < 1e-5);
  // Photon energy hc/λ at 532 nm ≈ 2.33053 eV
  assert.ok(Math.abs(res.photonEnergyEv - 2.33053) < 1e-4);
  assert.ok(Math.abs(res.missingOrder - 5.0) < 1e-9);

  // Central peak y = 0 -> normalized intensity = 1 exactly, path diff = 0
  const center = probeDoubleSlitExact(0, 532, 0.5, 1.5, 0.1);
  assert.ok(Math.abs(center.intensity - 1) < 1e-14);
  assert.equal(center.pathDiffNm, 0);

  // Exact symmetry I(+y) === I(-y) to machine precision
  for (const yMm of [0.42, 1.85, 5.75]) {
    const pos = probeDoubleSlitExact(yMm, 532, 0.5, 1.5, 0.1);
    const neg = probeDoubleSlitExact(-yMm, 532, 0.5, 1.5, 0.1);
    assert.ok(Math.abs(pos.intensity - neg.intensity) < 1e-14);
    assert.ok(Math.abs(pos.pathDiffNm + neg.pathDiffNm) < 1e-12);
  }

  // First dark fringe near y = Δy / 2: exact order = 0.5, tiny finite-distance (A₁ - A₂)² residual < 2e-4 at L=1.5m
  const firstMin = probeDoubleSlitExact(res.fringeSpacingMm / 2, 532, 0.5, 1.5, 0.1);
  assert.ok(Math.abs(firstMin.orderM - 0.5) < 1e-5);
  assert.ok(firstMin.interference < 1e-10);
  assert.ok(firstMin.intensity < 2e-4);

  // In true far-field Fraunhofer limit (L = 50 m), A₁ -> A₂ so dark fringe vanishes to < 1e-7
  const farRes = computeDoubleSlit(532, 0.5, 50, 0.1);
  const farMin = probeDoubleSlitExact(farRes.fringeSpacingMm / 2, 532, 0.5, 50, 0.1);
  assert.ok(farMin.intensity < 1e-7);

  // Missing order m = d/a = 5: interference cos²(5π)=1 but single-slit sinc²(π)≈0!
  const missing = probeDoubleSlitExact(res.fringeSpacingMm * 5, 532, 0.5, 1.5, 0.1);
  assert.ok(missing.interference > 0.999);
  assert.ok(missing.envelope < 1e-6);
  assert.ok(missing.intensity < 1e-6);

  // Backwards-compatible wrapper
  assert.ok(Math.abs(doubleSlitIntensity(0, 532, 0.5, 1.5) - 1) < 1e-14);
});

test("computeKeplerOrbit & trueAnomalyToMeanAnomaly achieve machine precision (<1e-13)", () => {
  // Earth circular benchmark
  const earth = computeKeplerOrbit(1.0, 0.0, 0.0);
  assert.ok(Math.abs(earth.periodYears - 1.0000174) < 1e-4);
  assert.ok(Math.abs(earth.speedKmS - 29.78469) < 1e-4);
  assert.ok(earth.keplerResidual < 1e-13);

  // Extreme eccentricity Halley's Comet benchmark (e = 0.967)
  const a = 2.4;
  const e = 0.967;
  const mu = EARTH_CIRCULAR_SPEED_KM_S * EARTH_CIRCULAR_SPEED_KM_S;
  const expectedE = -mu / (2 * a);
  const expectedH = Math.sqrt(mu * a * (1 - e * e));

  for (let i = 0; i < 32; i++) {
    const M = (i / 32) * 2 * Math.PI;
    const pt = computeKeplerOrbit(a, e, M);
    assert.ok(pt.keplerResidual < 1e-13, `residual too high: ${pt.keplerResidual}`);
    // Specific orbital energy ε = v²/2 - μ/r = -μ/(2a)
    const energy = 0.5 * pt.speedKmS * pt.speedKmS - mu / pt.radiusAU;
    assert.ok(Math.abs(energy - expectedE) < 1e-10, `energy drift: ${energy} vs ${expectedE}`);
    // Specific angular momentum h = x*vy - y*vx
    const h = pt.xAU * pt.vyKmS - pt.yAU * pt.vxKmS;
    assert.ok(Math.abs(h - expectedH) < 1e-10, `angular momentum drift: ${h} vs ${expectedH}`);

    // Exact inverse round-trip: trueAnomaly -> MeanAnomaly -> computeKeplerOrbit recovers same ν!
    const recoveredM = trueAnomalyToMeanAnomaly(pt.trueAnomalyRad, e);
    const roundTrip = computeKeplerOrbit(a, e, recoveredM);
    const dPos = Math.hypot(roundTrip.xAU - pt.xAU, roundTrip.yAU - pt.yAU);
    assert.ok(dPos < 1e-12, `Inverse Kepler round-trip error too high: ${dPos}`);
  }

  // Perihelion faster than aphelion
  const peri = computeKeplerOrbit(1.5, 0.5, 0);
  const aph = computeKeplerOrbit(1.5, 0.5, Math.PI);
  assert.ok(peri.speedKmS > aph.speedKmS * 2.9);
  assert.ok(Math.abs(peri.radiusAU - 0.75) < 1e-12);
  assert.ok(Math.abs(aph.radiusAU - 2.25) < 1e-12);
});

test("computeHorizonCurvature returns exact Schwarzschild, photon sphere, ISCO, and Hawking scales", () => {
  const bh10 = computeHorizonCurvature(10);
  assert.ok(Math.abs(bh10.schwarzschildKm - 29.5325) < 1e-3);
  assert.ok(Math.abs(bh10.photonSphereKm - bh10.schwarzschildKm * 1.5) < 1e-9);
  assert.ok(Math.abs(bh10.iscoKm - bh10.schwarzschildKm * 3.0) < 1e-9);
  assert.ok(Math.abs(bh10.hawkingTempNanoK - 6.17024) < 1e-3);
});

test("traceSchwarzschildGeodesic obeys exact null first integral, Cardano turning point, and GR weak/strong limits", () => {
  // 1. Weak-field validation at b = 20 r_s:
  // Exact 6th-order Keeton & Petters (2005) Schwarzschild deflection series in m/b = 1/(2b):
  // Δφ = 4(m/b) + (15π/4)(m/b)² + (128/3)(m/b)³ + (3465π/64)(m/b)⁴ + (3584/5)(m/b)⁵ + (255255π/256)(m/b)⁶
  const bWeak = 20;
  const mb = 1 / (2 * bWeak);
  const expectedWeakDeg =
    ((4 * mb +
      ((15 * Math.PI) / 4) * mb ** 2 +
      (128 / 3) * mb ** 3 +
      ((3465 * Math.PI) / 64) * mb ** 4 +
      (3584 / 5) * mb ** 5 +
      ((255255 * Math.PI) / 256) * mb ** 6) *
      180) /
    Math.PI;
  const weak = computePhotonDeflection(bWeak);
  assert.equal(weak.captured, false);
  assert.ok(
    Math.abs(weak.deflectionDeg - expectedWeakDeg) < 1e-4,
    `Weak-field RK4 ${weak.deflectionDeg.toFixed(6)}° vs 6th-order GR series ${expectedWeakDeg.toFixed(6)}°`
  );

  // 2. Strong-field photon ring just outside b_crit = 2.598076 r_s:
  const strongGeo = traceSchwarzschildGeodesic(2.605, {
    rViewRs: 16,
    maxSteps: 4800,
    stepRad: 0.008,
  });
  assert.equal(strongGeo.captured, false);
  assert.equal(strongGeo.nearPhotonRing, true);
  assert.ok(
    strongGeo.deflectionDeg > 180,
    `Expected >180° photon-ring bend, got ${strongGeo.deflectionDeg}`
  );
  // Exact Cardano root u_max must satisfy u³ - u² + 1/b² = 0 to machine epsilon!
  const uMax = 1 / strongGeo.closestApproachRs;
  const cardanoRes = Math.abs(uMax ** 3 - uMax ** 2 + 1 / (2.605 * 2.605));
  assert.ok(cardanoRes < 1e-14, `Cardano turning point residual too large: ${cardanoRes}`);
  // Exact Schwarzschild null first-integral conservation |(u')² + u²(1-u) - 1/b²| < 1e-9
  assert.ok(
    strongGeo.maxEnergyDrift < 1e-9,
    `Schwarzschild null invariant drift too large: ${strongGeo.maxEnergyDrift}`
  );

  // 3. Exact capture threshold across b_crit = 3√3 / 2 ≈ 2.598076 r_s
  const capturedRay = traceSchwarzschildGeodesic(2.595, { rViewRs: 16, maxSteps: 4800, stepRad: 0.008 });
  assert.equal(capturedRay.captured, true);
  const lastPt = capturedRay.points[capturedRay.points.length - 1];
  assert.ok(Math.abs(lastPt.rRs - 1.0) < 1e-4, `Captured ray should terminate at r=r_s, got ${lastPt.rRs}`);

  const escapedRay = traceSchwarzschildGeodesic(2.601, { rViewRs: 16, maxSteps: 4800, stepRad: 0.008 });
  assert.equal(escapedRay.captured, false);
  assert.ok(escapedRay.points.length > 30);
});

test("Quantum Well exact analytical observables match 4000-point quadrature, Ehrenfest theorem & Heisenberg bound", () => {
  const m = computeQuantumWellMetrics(1, 2, 1.0);
  assert.equal(m.isSuperposition, true);
  assert.equal(m.isSloshingParity, true);
  assert.ok(Math.abs(m.energy2Ev - m.energy1Ev * 4) < 1e-12);
  assert.ok(m.beatPeriodFs > 3.5 && m.beatPeriodFs < 3.8);

  const cases: Array<[number, number, number]> = [
    [1, 1, 0.7],
    [1, 2, 0.0],
    [1, 2, 0.85],
    [1, 3, 0.42],
    [2, 5, 1.15],
  ];

  const steps = 4000;
  const du = 1 / steps;

  for (const [n1, n2, t] of cases) {
    let normSum = 0;
    let meanUSum = 0;
    let meanU2Sum = 0;

    for (let i = 0; i <= steps; i++) {
      const u = i * du;
      const w = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2;
      const p = sampleQuantumSuperposition(u, n1, n2, t).probDensity;
      normSum += w * p;
      meanUSum += w * u * p;
      meanU2Sum += w * u * u * p;
    }

    const norm = (normSum * du) / 3;
    const numMeanU = (meanUSum * du) / 3;
    const numMeanU2 = (meanU2Sum * du) / 3;
    const numSigmaU = Math.sqrt(Math.max(0, numMeanU2 - numMeanU * numMeanU));

    const exact = computeQuantumObservables(n1, n2, t);
    assert.ok(Math.abs(norm - 1.0) < 1e-7, `Norm failed for (${n1},${n2}): ${norm}`);
    assert.ok(
      Math.abs(exact.meanU - numMeanU) < 1e-6,
      `<u(t)> mismatch for (${n1},${n2}): exact=${exact.meanU} num=${numMeanU}`
    );
    assert.ok(
      Math.abs(exact.sigmaU - numSigmaU) < 1e-6,
      `sigma_u(t) mismatch for (${n1},${n2}): exact=${exact.sigmaU} num=${numSigmaU}`
    );
    assert.ok(
      exact.heisenbergProductHbar >= 0.5 - 1e-12,
      `Heisenberg violated for (${n1},${n2}): ${exact.heisenbergProductHbar}`
    );

    // Ehrenfest's theorem verification: d<u>/dτ = (2 / π²) · (<p> / (ħ/L))
    const dt = 1e-6;
    const dMeanUDt =
      (computeQuantumObservables(n1, n2, t + dt).meanU -
        computeQuantumObservables(n1, n2, t - dt).meanU) /
      (2 * dt);
    const ehrenfestRhs = (2 / (Math.PI * Math.PI)) * exact.meanPHbarOverL;
    assert.ok(
      Math.abs(dMeanUDt - ehrenfestRhs) < 1e-7,
      `Ehrenfest violation for (${n1},${n2}): ${dMeanUDt} vs ${ehrenfestRhs}`
    );
  }

  // Ground state exact benchmark: π * sqrt(1/12 - 1/(2π²)) ≈ 0.5678618
  const ground = computeQuantumObservables(1, 1, 0);
  const expectedGround = Math.PI * Math.sqrt(1 / 12 - 1 / (2 * Math.PI * Math.PI));
  assert.ok(Math.abs(ground.heisenbergProductHbar - expectedGround) < 1e-12);
});
