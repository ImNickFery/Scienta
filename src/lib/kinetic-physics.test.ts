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

test("computeDoubleSlit & probeDoubleSlitExact obey exact non-paraxial geometry and photon energy", () => {
  const res = computeDoubleSlit(532, 0.5, 1.5, 0.1);
  // Δy = (532e-9 * 1.5) / 0.5e-3 = 1.596e-3 m = 1.596 mm
  assert.ok(Math.abs(res.fringeSpacingMm - 1.596) < 1e-9);
  // Photon energy hc/λ at 532 nm ≈ 2.33053 eV
  assert.ok(Math.abs(res.photonEnergyEv - 2.33053) < 1e-4);
  assert.ok(Math.abs(res.missingOrder - 5.0) < 1e-9);

  // Central peak y = 0 -> intensity 1, path diff 0
  const center = probeDoubleSlitExact(0, 532, 0.5, 1.5, 0.1);
  assert.equal(center.intensity, 1);
  assert.equal(center.pathDiffNm, 0);

  // First dark fringe at y = Δy / 2 -> order ≈ 0.5, intensity ≈ 0
  const firstMin = probeDoubleSlitExact(res.fringeSpacingMm / 2, 532, 0.5, 1.5, 0.1);
  assert.ok(Math.abs(firstMin.orderM - 0.5) < 1e-5);
  assert.ok(firstMin.intensity < 1e-8);

  // Missing order m = d/a = 5: interference cos²(5π)=1 but single-slit sinc²(π)=0!
  const missing = probeDoubleSlitExact(res.fringeSpacingMm * 5, 532, 0.5, 1.5, 0.1);
  assert.ok(missing.interference > 0.999);
  assert.ok(missing.envelope < 1e-6);
  assert.ok(missing.intensity < 1e-6);

  // Backwards-compatible wrapper
  assert.equal(doubleSlitIntensity(0, 532, 0.5, 1.5), 1);
});

test("computeKeplerOrbit solves Halley-Newton to <1e-13 and conserves energy & angular momentum", () => {
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

test("traceSchwarzschildGeodesic & computePhotonDeflection match weak-field GR and strong-field photon ring", () => {
  // 1. Weak-field validation at b = 20 r_s:
  // Exact Einstein + 2nd-order + 3rd-order Schwarzschild series:
  // Δφ = 2/b + (15π/16)/b² + (16/3)/b³
  const bWeak = 20;
  const expectedWeakDeg =
    ((2 / bWeak + ((15 * Math.PI) / 16) / (bWeak * bWeak) + (16 / 3) / (bWeak ** 3)) * 180) /
    Math.PI;
  const weak = computePhotonDeflection(bWeak);
  assert.equal(weak.captured, false);
  assert.ok(
    Math.abs(weak.deflectionDeg - expectedWeakDeg) < 0.005,
    `Weak-field RK4 ${weak.deflectionDeg.toFixed(5)}° vs series ${expectedWeakDeg.toFixed(5)}°`
  );

  // 2. Strong-field photon ring just outside b_crit = 2.598076 r_s:
  // Photon whips > 180° around photon sphere with closest approach just above 1.5 r_s!
  const strong = computePhotonDeflection(2.605);
  assert.equal(strong.captured, false);
  assert.equal(strong.nearPhotonRing, true);
  assert.ok(strong.deflectionDeg > 180, `Expected >180° photon-ring bend, got ${strong.deflectionDeg}`);
  assert.ok(
    strong.closestApproachRs > 1.5 && strong.closestApproachRs < 1.62,
    `Expected r_min near 1.5 r_s, got ${strong.closestApproachRs}`
  );

  // 3. Exact capture threshold across b_crit = 3√3 / 2 ≈ 2.598076 r_s
  const capturedRay = traceSchwarzschildGeodesic(2.58, { rViewRs: 16 });
  assert.equal(capturedRay.captured, true);
  const lastPt = capturedRay.points[capturedRay.points.length - 1];
  assert.ok(Math.abs(lastPt.rRs - 1.0) < 0.02, `Captured ray should terminate at r=r_s, got ${lastPt.rRs}`);

  const escapedRay = traceSchwarzschildGeodesic(2.62, { rViewRs: 16 });
  assert.equal(escapedRay.captured, false);
  assert.ok(escapedRay.points.length > 30);
});

test("Quantum Well exact analytical observables match 4000-point numerical quadrature & obey Heisenberg principle", () => {
  const m = computeQuantumWellMetrics(1, 2, 1.0);
  assert.equal(m.isSuperposition, true);
  assert.equal(m.isSloshingParity, true);
  assert.ok(Math.abs(m.energy2Ev - m.energy1Ev * 4) < 1e-12);
  assert.ok(m.beatPeriodFs > 3.5 && m.beatPeriodFs < 3.8); // h / (3 * 0.37603 eV) ≈ 3.666 fs

  // Numerical integration check for odd-parity sloshing (1, 2) and even-parity breathing (1, 3)
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
    // Heisenberg Uncertainty Principle: σ_x · σ_p >= ħ / 2
    assert.ok(
      exact.heisenbergProductHbar >= 0.5 - 1e-12,
      `Heisenberg violated for (${n1},${n2}): ${exact.heisenbergProductHbar}`
    );
  }

  // Ground state exact benchmark: π * sqrt(1/12 - 1/(2π²)) ≈ 0.5678618
  const ground = computeQuantumObservables(1, 1, 0);
  const expectedGround = Math.PI * Math.sqrt(1 / 12 - 1 / (2 * Math.PI * Math.PI));
  assert.ok(Math.abs(ground.heisenbergProductHbar - expectedGround) < 1e-12);
});
