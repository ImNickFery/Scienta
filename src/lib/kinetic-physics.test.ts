import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDoubleSlit,
  computeHorizonCurvature,
  computeKeplerOrbit,
  computePhotonDeflection,
  computeQuantumWellMetrics,
  doubleSlitIntensity,
  sampleQuantumSuperposition,
  wavelengthToHex,
} from "./kinetic-physics";

test("wavelengthToHex maps visible spectrum boundaries to valid hex colors", () => {
  const violet = wavelengthToHex(400);
  const green = wavelengthToHex(532);
  const red = wavelengthToHex(660);
  assert.match(violet, /^#[0-9a-f]{6}$/);
  assert.match(green, /^#[0-9a-f]{6}$/);
  assert.match(red, /^#[0-9a-f]{6}$/);
  assert.notEqual(violet, red);
  assert.notEqual(green, red);
});

test("computeDoubleSlit and doubleSlitIntensity satisfy Young's interference law", () => {
  // λ = 500 nm, d = 0.5 mm, L = 1.5 m -> Δy = (500 * 1.5) / (0.5 * 1000) = 1.5 mm
  const res = computeDoubleSlit(500, 0.5, 1.5);
  assert.ok(Math.abs(res.fringeSpacingMm - 1.5) < 1e-6);

  // Central maximum at x = 0 must equal 1.0
  assert.equal(doubleSlitIntensity(0, 500, 0.5, 1.5), 1);

  // First dark minimum at x = Δy / 2 must be ~0
  const firstMin = doubleSlitIntensity(res.fringeSpacingMm / 2, 500, 0.5, 1.5);
  assert.ok(firstMin < 1e-9);

  // First bright fringe at x = Δy must remain strictly positive and below central peak
  const firstMax = doubleSlitIntensity(res.fringeSpacingMm, 500, 0.5, 1.5);
  assert.ok(firstMax > 0.5 && firstMax < 1);
});

test("computeKeplerOrbit matches Earth circular orbit and speeds up at perihelion", () => {
  // Circular 1 AU orbit: T = 1 yr, v ≈ 29.78 km/s everywhere
  const earth = computeKeplerOrbit(1.0, 0.0, 0);
  assert.ok(Math.abs(earth.periodYears - 1.0) < 1e-6);
  assert.ok(Math.abs(earth.radiusAU - 1.0) < 1e-6);
  assert.ok(Math.abs(earth.speedKmS - 29.7847) < 0.01);

  // Elliptical orbit (e = 0.6): perihelion (M = 0) must be closer and faster than aphelion (M = π)
  const perihelion = computeKeplerOrbit(2.0, 0.6, 0);
  const aphelion = computeKeplerOrbit(2.0, 0.6, Math.PI);
  assert.ok(perihelion.radiusAU < aphelion.radiusAU);
  assert.ok(perihelion.speedKmS > aphelion.speedKmS * 3.5);
  // Conservation of angular momentum: r_p * v_p == r_a * v_a
  const L1 = perihelion.radiusAU * perihelion.speedKmS;
  const L2 = aphelion.radiusAU * aphelion.speedKmS;
  assert.ok(Math.abs(L1 - L2) < 1e-4);
});

test("computeHorizonCurvature scales Schwarzschild radius linearly and Hawking temperature inversely", () => {
  const sun = computeHorizonCurvature(1);
  assert.ok(Math.abs(sun.schwarzschildKm - 2.95325) < 1e-4);
  assert.ok(Math.abs(sun.photonSphereKm - 1.5 * sun.schwarzschildKm) < 1e-4);

  const tenSun = computeHorizonCurvature(10);
  assert.ok(Math.abs(tenSun.schwarzschildKm - 10 * sun.schwarzschildKm) < 1e-4);
  assert.ok(Math.abs(tenSun.hawkingTempNanoK - sun.hawkingTempNanoK / 10) < 1e-4);
});

test("computePhotonDeflection captures rays inside b_crit ≈ 2.598 r_s and bends outer rays", () => {
  const captured = computePhotonDeflection(2.0);
  assert.equal(captured.captured, true);

  const skimming = computePhotonDeflection(2.8);
  assert.equal(skimming.captured, false);
  assert.equal(skimming.nearPhotonRing, true);
  assert.ok(skimming.deflectionDeg > 40);

  const distant = computePhotonDeflection(10);
  assert.equal(distant.captured, false);
  assert.equal(distant.nearPhotonRing, false);
  assert.ok(distant.deflectionDeg > 10 && distant.deflectionDeg < skimming.deflectionDeg);
});

test("sampleQuantumSuperposition preserves unit total probability and sloshes when n1 !== n2", () => {
  const metrics = computeQuantumWellMetrics(1, 2, 1.0);
  assert.equal(metrics.isSuperposition, true);
  assert.ok(Math.abs(metrics.energy2Ev - 4 * metrics.energy1Ev) < 1e-6);

  // Numerical integration ∫₀¹ |ψ(u, t)|² du ≈ 1 at arbitrary phase time
  const steps = 400;
  let integral = 0;
  for (let i = 0; i < steps; i++) {
    const u = (i + 0.5) / steps;
    integral += sampleQuantumSuperposition(u, 1, 2, 0.73).probDensity / steps;
  }
  assert.ok(Math.abs(integral - 1.0) < 1e-3);

  // Stationary state (n1 === n2): |ψ|² is independent of time
  const s0 = sampleQuantumSuperposition(0.25, 2, 2, 0).probDensity;
  const s1 = sampleQuantumSuperposition(0.25, 2, 2, 1.9).probDensity;
  assert.ok(Math.abs(s0 - s1) < 1e-9);

  // Superposition (n1 = 1, n2 = 2): probability shifts between left & right halves over time
  const pLeftT0 = sampleQuantumSuperposition(0.25, 1, 2, 0).probDensity;
  const pLeftTPi3 = sampleQuantumSuperposition(0.25, 1, 2, Math.PI / 3).probDensity;
  assert.notEqual(Math.round(pLeftT0 * 100), Math.round(pLeftTPi3 * 100));
});
