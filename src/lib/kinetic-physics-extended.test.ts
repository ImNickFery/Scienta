import test from "node:test";
import assert from "node:assert/strict";
import {
  ELECTRON_REST_ENERGY_MEV,
  STEFAN_BOLTZMANN_W_M2_K4,
  WIEN_DISPLACEMENT_M_K,
  WIEN_X5,
  blackbodyChromaticityHex,
  computeBlackbodyCieChromaticity,
  computeLorenzInvariants,
  computeOscillatorMetrics,
  computePlanckBlackbody,
  computeRelativityMetrics,
  evaluateDrivenDampedAnalytical,
  evaluateFreeDampedAnalytical,
  integrateLorenzTwinRK4,
  lorentzTransformEvent,
  planckSpectralRadianceKw,
  probePlanckAtWavelength,
  rayleighJeansRadianceKw,
  relativisticVelocityAdd,
  sampleOscillatorBode,
  simulateOscillatorRK4,
} from "./kinetic-physics-extended";

test("CODATA 2022 / SI 2019 thermodynamic and relativistic constants match benchmarks", () => {
  // Exact Wien root (x - 5) e^x + 5 = 0
  const wienResidual = (WIEN_X5 - 5) * Math.exp(WIEN_X5) + 5;
  assert.ok(Math.abs(wienResidual) < 1e-13, `Wien root residual too large: ${wienResidual}`);

  // Wien displacement constant b = 2.897771955...e-3 m·K
  assert.ok(Math.abs(WIEN_DISPLACEMENT_M_K - 2.897771955e-3) < 1e-11);

  // Stefan-Boltzmann constant σ = 5.670374419...e-8 W·m⁻²·K⁻⁴
  assert.ok(Math.abs(STEFAN_BOLTZMANN_W_M2_K4 - 5.670374419e-8) < 1e-15);

  // Electron rest energy 0.51099895069 MeV
  assert.ok(Math.abs(ELECTRON_REST_ENERGY_MEV - 0.51099895069) < 1e-7);
});

test("Planck blackbody obeys Stefan-Boltzmann integral, Wien peak, CIE 1931 Planckian locus & Rayleigh-Jeans limit", () => {
  const T = 5772; // Nominal solar photosphere (IAU 2015)
  const m = computePlanckBlackbody(T, 1.0);

  // Sun peak wavelength ≈ 502.04 nm
  assert.ok(Math.abs(m.peakWavelengthNm - 502.0395) < 0.01);
  // Solar surface radiant flux ≈ 62.94 MW/m²
  assert.ok(Math.abs(m.totalFluxMWm2 - 62.94) < 0.05);
  // Solar visible power fraction (380–750 nm) is ~42.5–43.5%
  assert.ok(m.visibleFractionPct > 42 && m.visibleFractionPct < 45);
  assert.equal(m.spectralClass, "G");
  assert.match(blackbodyChromaticityHex(T), /^#[0-9a-f]{6}$/);

  // CIE 1931 2° Planckian locus benchmark:
  // At T = 6504 K (D65-adjacent blackbody), CIE x ≈ 0.3135, y ≈ 0.3236
  const cie6504 = computeBlackbodyCieChromaticity(6504);
  assert.ok(
    Math.abs(cie6504.x - 0.3135) < 0.005 && Math.abs(cie6504.y - 0.3236) < 0.005,
    `CIE 1931 6504K mismatch: (${cie6504.x.toFixed(4)}, ${cie6504.y.toFixed(4)})`
  );
  // At T = 2856 K (CIE Illuminant A tungsten), CIE x ≈ 0.4476, y ≈ 0.4074
  const cieA = computeBlackbodyCieChromaticity(2856);
  assert.ok(
    Math.abs(cieA.x - 0.4476) < 0.006 && Math.abs(cieA.y - 0.4074) < 0.006,
    `CIE 1931 Illuminant A mismatch: (${cieA.x.toFixed(4)}, ${cieA.y.toFixed(4)})`
  );

  // Verify peak is true maximum: B(λ_peak) > B(λ_peak ± 1 nm)
  const bPeak = planckSpectralRadianceKw(m.peakWavelengthNm, T);
  const bLeft = planckSpectralRadianceKw(m.peakWavelengthNm - 1, T);
  const bRight = planckSpectralRadianceKw(m.peakWavelengthNm + 1, T);
  assert.ok(bPeak > bLeft && bPeak > bRight);

  // Verify Stefan-Boltzmann law: π ∫₀^∞ B_λ dλ = σ T⁴ via composite Simpson quadrature
  const wlMin = 50;
  const wlMax = 40_000;
  const steps = 4000;
  const h = (wlMax - wlMin) / steps;
  let integral = 0;
  for (let i = 0; i <= steps; i++) {
    const wl = wlMin + i * h;
    const w = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2;
    integral += w * planckSpectralRadianceKw(wl, T, 1.0);
  }
  const numFluxMWm2 = (Math.PI * ((integral * h) / 3) * 1000) * 1e-6;
  const relErr = Math.abs(numFluxMWm2 - m.totalFluxMWm2) / m.totalFluxMWm2;
  assert.ok(relErr < 2e-4, `Stefan-Boltzmann integral relative error too large: ${relErr}`);

  // Verify Rayleigh-Jeans IR convergence: B_Planck / B_RJ -> 1 at λ = 500,000 nm
  const irProbe = probePlanckAtWavelength(500_000, T, 1.0);
  assert.ok(Math.abs(irProbe.quantumSuppressionRatio - 1) < 0.005);

  // Verify UV catastrophe: at 150 nm, Rayleigh-Jeans vastly exceeds Planck
  const uvPlanck = planckSpectralRadianceKw(150, T);
  const uvRJ = rayleighJeansRadianceKw(150, T);
  assert.ok(uvRJ > uvPlanck * 1000);
});

test("Damped driven harmonic oscillator matches exact Bode phase, resonance peak, and FULL driven RK4 vs analytical", () => {
  // At driveRatio = 1.0, phase lag MUST be exactly 90° for any ζ > 0
  for (const zeta of [0.08, 0.25, 0.7, 1.0, 1.5]) {
    const bode = sampleOscillatorBode(1.0, zeta);
    assert.ok(Math.abs(bode.phaseLagDeg - 90) < 1e-12);
    assert.ok(Math.abs(bode.magnification - 1 / (2 * zeta)) < 1e-12);
  }

  // Exact resonance peak occurs at r_res = sqrt(1 - 2ζ²) when ζ < 1/√2
  const osc = computeOscillatorMetrics(1.5, 0.2, 0.95);
  assert.equal(osc.regime, "underdamped");
  assert.ok(osc.resonanceRatio !== null);
  const expectedR = Math.sqrt(1 - 2 * 0.04);
  assert.ok(Math.abs(osc.resonanceRatio - expectedR) < 1e-12);
  const atPeak = sampleOscillatorBode(osc.resonanceRatio, 0.2).magnification;
  assert.ok(Math.abs(atPeak - osc.peakMagnification) < 1e-12);
  assert.ok(atPeak > sampleOscillatorBode(osc.resonanceRatio - 0.01, 0.2).magnification);
  assert.ok(atPeak > sampleOscillatorBode(osc.resonanceRatio + 0.01, 0.2).magnification);

  // Critical and overdamped regimes have no resonance peak > 1
  const crit = computeOscillatorMetrics(1.5, 1.0, 1.0);
  assert.equal(crit.regime, "critical");
  assert.equal(crit.resonanceRatio, null);

  // 1. Unforced decay RK4 vs exact closed-form analytical across all 3 damping regimes
  for (const zeta of [0.2, 1.0, 1.4]) {
    const samples = simulateOscillatorRK4(1.2, zeta, 1.0, {
      durationS: 1.5,
      dt: 0.002,
      x0: 1.0,
      v0: 0.5,
      driveAmp: 0,
    });
    const last = samples[samples.length - 1];
    const exact = evaluateFreeDampedAnalytical(1.2, zeta, 1.0, 0.5, last.t);
    assert.ok(
      Math.abs(last.x - exact.x) < 1e-7,
      `Free RK4 vs analytical mismatch at ζ=${zeta}: ${last.x} vs ${exact.x}`
    );
  }

  // 2. FULL DRIVEN (transient + steady-state) RK4 vs exact closed-form analytical solution!
  for (const [zeta, driveRatio] of [
    [0.08, 0.99],
    [0.25, 1.35],
    [1.0, 1.0],
    [1.35, 0.6],
  ]) {
    const samples = simulateOscillatorRK4(1.5, zeta, driveRatio, {
      durationS: 3.0,
      dt: 0.002,
      x0: 0,
      v0: 0,
      driveAmp: 1.0,
    });
    const w0 = 2 * Math.PI * 1.5;
    for (const checkIdx of [250, 750, samples.length - 1]) {
      const s = samples[checkIdx];
      const exact = evaluateDrivenDampedAnalytical(1.5, zeta, driveRatio, s.t, 0, 0, 1.0);
      assert.ok(
        Math.abs(s.x - exact.x) < 1e-5,
        `Driven RK4 x(t) mismatch at ζ=${zeta}, r=${driveRatio}, t=${s.t}: ${s.x} vs ${exact.x}`
      );
      assert.ok(
        Math.abs(s.vNorm - exact.v / w0) < 1e-5,
        `Driven RK4 v/ω₀ mismatch at ζ=${zeta}, r=${driveRatio}, t=${s.t}`
      );
    }
  }
});

test("Special Relativity obeys exact Lorentz invariance, inverse boost recovery, Doppler & velocity addition", () => {
  // Exact textbook Lorentz factors
  assert.ok(Math.abs(computeRelativityMetrics(0.6).gamma - 1.25) < 1e-14);
  assert.ok(Math.abs(computeRelativityMetrics(0.8).gamma - 5 / 3) < 1e-14);
  assert.ok(Math.abs(computeRelativityMetrics(Math.sqrt(3) / 2).gamma - 2.0) < 1e-14);

  // Doppler reciprocity D(β) * D(-β) = 1
  const m = computeRelativityMetrics(0.995, 4.0);
  assert.ok(Math.abs(m.dopplerApproach * m.dopplerRecede - 1.0) < 1e-14);
  // Cosmic muon at 0.995c (γ ≈ 10.01) survives ~21.9% across 10 km (vs ~0% classically)
  assert.ok(m.muonSurvival10KmPct > 20 && m.muonSurvival10KmPct < 24);

  // Spacetime interval invariance s² = (ct)² - x² = (ct')² - (x')² across extreme boosts
  const events: Array<[number, number, number]> = [
    [1.2, 3.5, 0.8],
    [-2.7, 1.1, 0.95],
    [4.0, 4.0, 0.99],
    [0.5, -2.2, 0.995],
  ];
  for (const [x, ct, beta] of events) {
    const tr = lorentzTransformEvent(x, ct, beta);
    const s2Original = ct * ct - x * x;
    const s2Primed = tr.ctPrime * tr.ctPrime - tr.xPrime * tr.xPrime;
    assert.ok(
      Math.abs(s2Original - s2Primed) < 1e-11,
      `Interval invariance broken: ${s2Original} vs ${s2Primed}`
    );

    // Inverse boost recovers original (x, ct)
    const inv = lorentzTransformEvent(tr.xPrime, tr.ctPrime, -beta);
    assert.ok(Math.abs(inv.xPrime - x) < 1e-11);
    assert.ok(Math.abs(inv.ctPrime - ct) < 1e-11);
  }

  // Relativistic velocity addition never exceeds c
  const added = relativisticVelocityAdd(0.95, 0.95);
  assert.ok(added > 0.99 && added < 1.0);
  assert.ok(Math.abs(added - 1.9 / (1 + 0.9025)) < 1e-15);
});

test("Lorenz 12D coupled RK4 obeys exact fixed points, Liouville Lyapunov sum, λ₁ ≈ 0.9056 & Kaplan-Yorke D_KY ≈ 2.062", () => {
  const inv = computeLorenzInvariants(10, 28, 8 / 3);
  // ∇·F = -(10 + 1 + 8/3) = -13.666666...
  assert.ok(Math.abs(inv.divergenceRate - -(11 + 8 / 3)) < 1e-12);
  // Hopf bifurcation threshold ρ_H = 470 / 19 ≈ 24.73684
  assert.ok(inv.hopfThresholdRho !== null);
  assert.ok(Math.abs(inv.hopfThresholdRho - 470 / 19) < 1e-12);

  // Verify fixed point C+ satisfies F(C+) = 0 identically
  assert.ok(inv.fixedPointPos !== null);
  const { x, y, z } = inv.fixedPointPos;
  assert.ok(Math.abs(10 * (y - x)) < 1e-12);
  assert.ok(Math.abs(x * (28 - z) - y) < 1e-12);
  assert.ok(Math.abs(x * y - (8 / 3) * z) < 1e-12);

  // Classic chaotic Lorenz (σ=10, ρ=28, β=8/3): published spectrum ≈ [+0.9056, 0.0000, -14.5723], D_KY ≈ 2.062
  const chaotic = integrateLorenzTwinRK4(10, 28, 8 / 3, {
    dt: 0.005,
    transientSteps: 800,
    steps: 3600,
    lyapunovExtraSteps: 12_000,
    sampleStride: 2,
    perturbation: 1e-5,
  });
  const [l1, l2, l3] = chaotic.metrics.lyapunovSpectrum;
  assert.equal(chaotic.metrics.regime, "chaotic");
  // Exact Liouville phase-space contraction identity: λ₁ + λ₂ + λ₃ === ∇·F = -(σ + 1 + β)
  const liouvilleErr = Math.abs(l1 + l2 + l3 - chaotic.metrics.divergenceRate);
  assert.ok(
    liouvilleErr < 5e-4,
    `Liouville trace identity violated: sum=${(l1 + l2 + l3).toFixed(6)} vs ∇·F=${chaotic.metrics.divergenceRate.toFixed(6)}`
  );
  // Published Lorenz benchmarks: λ₁ ≈ 0.9056, λ₂ ≈ 0, λ₃ ≈ -14.572, D_KY ≈ 2.062
  assert.ok(
    Math.abs(l1 - 0.9056) < 0.06,
    `Expected classic Lorenz λ₁ ≈ 0.9056, got ${l1.toFixed(4)}`
  );
  assert.ok(
    Math.abs(l2) < 0.04,
    `Expected neutral flow exponent λ₂ ≈ 0, got ${l2.toFixed(4)}`
  );
  assert.ok(
    Math.abs(chaotic.metrics.kaplanYorkeDim - 2.062) < 0.015,
    `Expected Kaplan-Yorke fractal dim D_KY ≈ 2.062, got ${chaotic.metrics.kaplanYorkeDim.toFixed(4)}`
  );
  // Twin trajectories starting 1e-5 apart must diverge dramatically (> 1.0)
  const maxSep = Math.max(...chaotic.separations);
  assert.ok(maxSep > 1.0, `Expected butterfly divergence > 1.0, got ${maxSep}`);

  // Pre-chaos stable spiral (ρ=15 < ρ_H): λ₁ < 0 and Liouville sum still exact!
  const stable = integrateLorenzTwinRK4(10, 15, 8 / 3, {
    dt: 0.005,
    transientSteps: 40,
    steps: 3000,
    lyapunovExtraSteps: 4000,
    sampleStride: 5,
    perturbation: 1e-4,
  });
  const [sl1, sl2, sl3] = stable.metrics.lyapunovSpectrum;
  assert.equal(stable.metrics.regime, "stable");
  assert.ok(sl1 < 0, `Expected stable λ₁ < 0, got ${sl1}`);
  assert.ok(Math.abs(sl1 + sl2 + sl3 - stable.metrics.divergenceRate) < 5e-4);
});
