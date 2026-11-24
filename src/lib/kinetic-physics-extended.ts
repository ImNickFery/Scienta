/**
 * Extended exact CODATA-2022 / SI-2019 / CIE-1931 / RK4 physics simulation engines
 * for the Scienta Living Optical Lab (Experiments 5–8):
 *   5. Planck Blackbody Radiation, CIE 1931 2° Colorimetry & Rayleigh-Jeans UV Catastrophe
 *   6. Damped Driven Harmonic Oscillator & Bode Resonance (RK4 + Exact Closed-Form Analytic)
 *   7. Special Relativity: Lorentz Kinematics & Minkowski Spacetime (Exact SI c)
 *   8. Lorenz Strange Attractor & Full Coupled 3-Vector Benettin Lyapunov Spectrum (RK4)
 *
 * Zero DOM dependencies so every physical law, symmetry, and conservation invariant
 * is verified directly by automated unit tests.
 */

import { PHYSICS_CONSTANTS } from "./kinetic-physics";

// ---------------------------------------------------------------------------
// Exact Derived Constants (SI 2019 / CODATA 2022)
// ---------------------------------------------------------------------------

/** Exact solution of (x - 5) e^x + 5 = 0 for Wien's displacement law (to 16 digits). */
export const WIEN_X5 = 4.965114231744276;

/** Exact Wien displacement constant b = hc / (x_5 k_B) in m·K (2.897771955...e-3 m·K). */
export const WIEN_DISPLACEMENT_M_K =
  (PHYSICS_CONSTANTS.H * PHYSICS_CONSTANTS.C) / (WIEN_X5 * PHYSICS_CONSTANTS.K_B);

/** Exact Stefan-Boltzmann constant σ = 2π⁵ k_B⁴ / (15 c² h³) in W·m⁻²·K⁻⁴. */
export const STEFAN_BOLTZMANN_W_M2_K4 =
  (2 * Math.pow(Math.PI, 5) * Math.pow(PHYSICS_CONSTANTS.K_B, 4)) /
  (15 * Math.pow(PHYSICS_CONSTANTS.C, 2) * Math.pow(PHYSICS_CONSTANTS.H, 3));

/** Exact electron rest energy m_e c² in MeV (CODATA 2022: 0.51099895069 MeV). */
export const ELECTRON_REST_ENERGY_MEV =
  (PHYSICS_CONSTANTS.M_ELECTRON * PHYSICS_CONSTANTS.C * PHYSICS_CONSTANTS.C) /
  (PHYSICS_CONSTANTS.E_CHARGE * 1e6);

/** Muon mean rest lifetime τ_μ in seconds (CODATA / PDG: 2.1969811e-6 s). */
export const MUON_LIFETIME_S = 2.196_9811e-6;

// ---------------------------------------------------------------------------
// 5. Planck Blackbody Radiation & True CIE 1931 2° Colorimetry
// ---------------------------------------------------------------------------

export interface CieChromaticity {
  /** CIE 1931 chromaticity coordinate x = X / (X + Y + Z). */
  x: number;
  /** CIE 1931 chromaticity coordinate y = Y / (X + Y + Z). */
  y: number;
  /** IEC 61966-2-1 sRGB hex color. */
  hex: string;
}

export interface PlanckBlackbodyMetrics {
  temperatureK: number;
  emissivity: number;
  /** Exact Wien peak wavelength λ_peak = b / T (nm). */
  peakWavelengthNm: number;
  /** Peak spectral radiance B_λ(λ_peak, T) in kW·sr⁻¹·m⁻²·nm⁻¹. */
  peakRadianceKw: number;
  /** Peak ideal blackbody radiance (ε = 1) in kW·sr⁻¹·m⁻²·nm⁻¹. */
  idealPeakRadianceKw: number;
  /** Exact Stefan-Boltzmann total radiant exitance j* = ε σ T⁴ in MW/m². */
  totalFluxMWm2: number;
  /** Peak photon energy hc / λ_peak in eV. */
  peakPhotonEnergyEv: number;
  /** Fraction of total radiant power emitted inside visible spectrum 380–750 nm (%). */
  visibleFractionPct: number;
  /** Exact CIE 1931 2° integrated blackbody chromaticity & sRGB hex. */
  cie: CieChromaticity;
  /** Convenience hex alias matching cie.hex. */
  chromaticityHex: string;
  /** Morgan-Keenan stellar spectral class approximation for T. */
  spectralClass: "M" | "K" | "G" | "F" | "A" | "B";
}

export interface PlanckProbeResult {
  wavelengthNm: number;
  /** Exact Planck spectral radiance in kW·sr⁻¹·m⁻²·nm⁻¹. */
  planckKw: number;
  /** Ideal (ε = 1) Planck radiance in kW·sr⁻¹·m⁻²·nm⁻¹. */
  idealPlanckKw: number;
  /** Classical Rayleigh-Jeans radiance in kW·sr⁻¹·m⁻²·nm⁻¹. */
  rayleighJeansKw: number;
  /** Quantum suppression factor B_Planck / B_RJ ∈ (0, 1]. */
  quantumSuppressionRatio: number;
  /** Photon energy hc / λ in eV. */
  photonEnergyEv: number;
}

/**
 * Exact Wyman–Sloan–Shirley (2013) multi-lobe piecewise-Gaussian analytical fit
 * to the official CIE 1931 2° Standard Observer color matching functions (x̄, ȳ, z̄)
 * across visible wavelengths λ ∈ [380, 780] nm.
 */
export function cie1931ColorMatching(wavelengthNm: number): {
  xBar: number;
  yBar: number;
  zBar: number;
} {
  const wl = wavelengthNm;
  const t1 = (wl - 442.0) * (wl < 442.0 ? 0.0624 : 0.0374);
  const t2 = (wl - 599.8) * (wl < 599.8 ? 0.0264 : 0.0323);
  const t3 = (wl - 501.1) * (wl < 501.1 ? 0.049 : 0.0382);
  const xBar =
    0.362 * Math.exp(-0.5 * t1 * t1) +
    1.056 * Math.exp(-0.5 * t2 * t2) -
    0.065 * Math.exp(-0.5 * t3 * t3);

  const u1 = (wl - 568.8) * (wl < 568.8 ? 0.0213 : 0.0247);
  const u2 = (wl - 530.9) * (wl < 530.9 ? 0.0613 : 0.0322);
  const yBar = 0.821 * Math.exp(-0.5 * u1 * u1) + 0.286 * Math.exp(-0.5 * u2 * u2);

  const v1 = (wl - 437.0) * (wl < 437.0 ? 0.0845 : 0.0278);
  const v2 = (wl - 459.0) * (wl < 459.0 ? 0.0385 : 0.0725);
  const zBar = 1.217 * Math.exp(-0.5 * v1 * v1) + 0.681 * Math.exp(-0.5 * v2 * v2);

  return {
    xBar: Math.max(0, xBar),
    yBar: Math.max(0, yBar),
    zBar: Math.max(0, zBar),
  };
}

/**
 * Exact Planck spectral radiance B_λ(λ, T) in kW·sr⁻¹·m⁻²·nm⁻¹.
 * Uses Math.expm1 for full numerical precision at both UV and IR extremes.
 */
export function planckSpectralRadianceKw(
  wavelengthNm: number,
  temperatureK: number,
  emissivity = 1.0
): number {
  const safeWlNm = Math.max(10, wavelengthNm);
  const safeT = Math.min(25_000, Math.max(300, temperatureK));
  const safeEps = Math.min(1, Math.max(0.05, emissivity));

  const wlM = safeWlNm * 1e-9;
  const exponent =
    (PHYSICS_CONSTANTS.H * PHYSICS_CONSTANTS.C) / (wlM * PHYSICS_CONSTANTS.K_B * safeT);

  if (exponent > 700) return 0;

  const denom = Math.expm1(exponent);
  if (denom <= 0) return 0;

  // B_λ in W·sr⁻¹·m⁻³ -> multiply by 1e-12 to convert W/m³ to kW/(m²·nm)
  const radianceWM3 =
    (2 * PHYSICS_CONSTANTS.H * PHYSICS_CONSTANTS.C * PHYSICS_CONSTANTS.C) /
    (Math.pow(wlM, 5) * denom);
  return safeEps * radianceWM3 * 1e-12;
}

/**
 * Classical Rayleigh-Jeans spectral radiance B_RJ(λ, T) = ε · 2 c k_B T / λ⁴
 * in kW·sr⁻¹·m⁻²·nm⁻¹. Diverges as λ⁻⁴ (Ultraviolet Catastrophe).
 */
export function rayleighJeansRadianceKw(
  wavelengthNm: number,
  temperatureK: number,
  emissivity = 1.0
): number {
  const safeWlNm = Math.max(10, wavelengthNm);
  const safeT = Math.min(25_000, Math.max(300, temperatureK));
  const safeEps = Math.min(1, Math.max(0.05, emissivity));
  const wlM = safeWlNm * 1e-9;

  const radianceWM3 =
    (2 * PHYSICS_CONSTANTS.C * PHYSICS_CONSTANTS.K_B * safeT) / Math.pow(wlM, 4);
  return safeEps * radianceWM3 * 1e-12;
}

/**
 * Integrates blackbody spectral radiance against the CIE 1931 2° Standard Observer
 * over [380, 780] nm via composite Simpson's rule and converts to exact IEC 61966-2-1 sRGB.
 */
export function computeBlackbodyCieChromaticity(temperatureK: number): CieChromaticity {
  const safeT = Math.min(25_000, Math.max(1000, temperatureK));
  const a = 380;
  const b = 780;
  const steps = 80; // 5 nm even Simpson grid
  const h = (b - a) / steps;

  let X = 0;
  let Y = 0;
  let Z = 0;

  for (let i = 0; i <= steps; i++) {
    const wl = a + i * h;
    const w = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2;
    const rad = planckSpectralRadianceKw(wl, safeT, 1.0);
    const { xBar, yBar, zBar } = cie1931ColorMatching(wl);
    X += w * rad * xBar;
    Y += w * rad * yBar;
    Z += w * rad * zBar;
  }

  const sum = Math.max(1e-18, X + Y + Z);
  const cx = X / sum;
  const cy = Y / sum;
  const cz = 1 - cx - cy;

  // Normalize XYZ to Y = 1 for luminous chromaticity display, then apply exact IEC 61966-2-1 sRGB matrix
  const Yn = 1.0;
  const Xn = (cx / Math.max(1e-9, cy)) * Yn;
  const Zn = (cz / Math.max(1e-9, cy)) * Yn;

  let rLin = 3.2406 * Xn - 1.5372 * Yn - 0.4986 * Zn;
  let gLin = -0.9689 * Xn + 1.8758 * Yn + 0.0415 * Zn;
  let bLin = 0.0557 * Xn - 0.204 * Yn + 1.057 * Zn;

  rLin = Math.max(0, rLin);
  gLin = Math.max(0, gLin);
  bLin = Math.max(0, bLin);
  const maxC = Math.max(1e-9, rLin, gLin, bLin);
  rLin /= maxC;
  gLin /= maxC;
  bLin /= maxC;

  // Exact IEC 61966-2-1 sRGB electro-optical transfer function
  const encodeSrgb = (c: number) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  const toByte = (c: number) =>
    Math.min(255, Math.max(0, Math.round(255 * encodeSrgb(c))));
  const hexByte = (n: number) => n.toString(16).padStart(2, "0");

  return {
    x: cx,
    y: cy,
    hex: `#${hexByte(toByte(rLin))}${hexByte(toByte(gLin))}${hexByte(toByte(bLin))}`,
  };
}

export function blackbodyChromaticityHex(temperatureK: number): string {
  return computeBlackbodyCieChromaticity(temperatureK).hex;
}

/**
 * Computes exact Planck blackbody telemetry, Wien displacement peak,
 * Stefan-Boltzmann radiant flux, CIE 1931 chromaticity, and 2.5 nm Simpson visible fraction.
 */
export function computePlanckBlackbody(
  temperatureK: number,
  emissivity = 1.0
): PlanckBlackbodyMetrics {
  const safeT = Math.min(15_000, Math.max(1200, temperatureK));
  const safeEps = Math.min(1, Math.max(0.1, emissivity));

  const peakWavelengthNm = (WIEN_DISPLACEMENT_M_K / safeT) * 1e9;
  const idealPeakRadianceKw = planckSpectralRadianceKw(peakWavelengthNm, safeT, 1.0);
  const peakRadianceKw = idealPeakRadianceKw * safeEps;

  // Exact Stefan-Boltzmann law: j* = ε σ T⁴ (W/m²) -> MW/m²
  const totalFluxWM2 = safeEps * STEFAN_BOLTZMANN_W_M2_K4 * Math.pow(safeT, 4);
  const totalFluxMWm2 = totalFluxWM2 * 1e-6;

  // High-resolution composite Simpson integration over visible band [380, 750] nm (2.5 nm step)
  const steps = 148;
  const a = 380;
  const b = 750;
  const h = (b - a) / steps;
  let simpson = 0;
  for (let i = 0; i <= steps; i++) {
    const wl = a + i * h;
    const w = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2;
    simpson += w * planckSpectralRadianceKw(wl, safeT, 1.0);
  }
  const visibleIdealWM2 = Math.PI * ((simpson * h) / 3) * 1000;
  const idealTotalWM2 = STEFAN_BOLTZMANN_W_M2_K4 * Math.pow(safeT, 4);
  const visibleFractionPct = Math.min(100, Math.max(0, (visibleIdealWM2 / idealTotalWM2) * 100));

  const peakPhotonEnergyEv =
    (PHYSICS_CONSTANTS.H * PHYSICS_CONSTANTS.C) /
    (peakWavelengthNm * 1e-9 * PHYSICS_CONSTANTS.E_CHARGE);

  const spectralClass: PlanckBlackbodyMetrics["spectralClass"] =
    safeT < 3700
      ? "M"
      : safeT < 5200
        ? "K"
        : safeT < 6000
          ? "G"
          : safeT < 7500
            ? "F"
            : safeT < 10_000
              ? "A"
              : "B";

  const cie = computeBlackbodyCieChromaticity(safeT);

  return {
    temperatureK: safeT,
    emissivity: safeEps,
    peakWavelengthNm,
    peakRadianceKw,
    idealPeakRadianceKw,
    totalFluxMWm2,
    peakPhotonEnergyEv,
    visibleFractionPct,
    cie,
    chromaticityHex: cie.hex,
    spectralClass,
  };
}

export function probePlanckAtWavelength(
  wavelengthNm: number,
  temperatureK: number,
  emissivity = 1.0
): PlanckProbeResult {
  const wl = Math.max(50, wavelengthNm);
  const idealPlanckKw = planckSpectralRadianceKw(wl, temperatureK, 1.0);
  const planckKw = idealPlanckKw * Math.min(1, Math.max(0.1, emissivity));
  const rayleighJeansKw = rayleighJeansRadianceKw(wl, temperatureK, emissivity);
  const photonEnergyEv =
    (PHYSICS_CONSTANTS.H * PHYSICS_CONSTANTS.C) / (wl * 1e-9 * PHYSICS_CONSTANTS.E_CHARGE);

  return {
    wavelengthNm: wl,
    planckKw,
    idealPlanckKw,
    rayleighJeansKw,
    quantumSuppressionRatio: rayleighJeansKw > 0 ? planckKw / rayleighJeansKw : 0,
    photonEnergyEv,
  };
}

// ---------------------------------------------------------------------------
// 6. Damped Driven Harmonic Oscillator & Bode Resonance (RK4 + Exact Analytic)
// ---------------------------------------------------------------------------

export type OscillatorRegime = "underdamped" | "critical" | "overdamped";

export interface OscillatorMetrics {
  naturalFreqHz: number;
  omega0RadS: number;
  dampingRatio: number;
  driveRatio: number;
  driveFreqHz: number;
  /** Exact quality factor Q = 1 / (2ζ). */
  qualityFactorQ: number;
  /** Exact steady-state magnification M(r) = A / A_static. */
  magnification: number;
  /** Exact gain in decibels 20 log₁₀ M(r). */
  gainDb: number;
  /** Exact steady-state phase lag δ ∈ [0, 180°]. */
  phaseLagDeg: number;
  /** Exact steady-state phase lag δ in radians. */
  phaseLagRad: number;
  /** Exact amplitude resonance ratio r_res = √(1 - 2ζ²) (null if ζ ≥ 1/√2). */
  resonanceRatio: number | null;
  /** Maximum amplitude magnification across all drive frequencies. */
  peakMagnification: number;
  /** Damped natural frequency f_d = f_0 √(1 - ζ²) (0 if ζ ≥ 1). */
  dampedFreqHz: number;
  /** Normalized time-averaged power absorption (peaks identically at r = 1). */
  avgPowerNorm: number;
  /** Adaptive integration duration (s) sufficient to reveal steady-state convergence. */
  recommendedDurationS: number;
  regime: OscillatorRegime;
}

export interface OscillatorBodeSample {
  ratio: number;
  magnification: number;
  gainDb: number;
  phaseLagDeg: number;
  phaseLagRad: number;
}

export interface OscillatorStateSample {
  t: number;
  /** Displacement x(t) in units of static deflection A_0 = F_0 / k. */
  x: number;
  /** Normalized velocity v(t) / ω_0 in units of A_0. */
  vNorm: number;
  /** Driving waveform cos(ω_d t). */
  drive: number;
}

/**
 * Exact Bode frequency response at arbitrary normalized drive frequency r = ω_d / ω_0.
 */
export function sampleOscillatorBode(ratio: number, dampingRatio: number): OscillatorBodeSample {
  const r = Math.max(0, ratio);
  const z = Math.min(2.0, Math.max(0.02, dampingRatio));
  const realPart = 1 - r * r;
  const imagPart = 2 * z * r;
  const denom = Math.hypot(realPart, imagPart);
  const magnification = denom > 0 ? 1 / denom : 0;
  const phaseLagRad = Math.atan2(imagPart, realPart);
  const phaseLagDeg = (phaseLagRad * 180) / Math.PI;
  const gainDb = 20 * Math.log10(Math.max(1e-9, magnification));

  return {
    ratio: r,
    magnification,
    gainDb,
    phaseLagDeg,
    phaseLagRad,
  };
}

/**
 * Computes exact closed-form damped driven harmonic oscillator observables.
 */
export function computeOscillatorMetrics(
  naturalFreqHz: number,
  dampingRatio: number,
  driveRatio: number
): OscillatorMetrics {
  const f0 = Math.min(5.0, Math.max(0.25, naturalFreqHz));
  const z = Math.min(2.0, Math.max(0.02, dampingRatio));
  const r = Math.min(3.0, Math.max(0.05, driveRatio));
  const omega0RadS = 2 * Math.PI * f0;

  const bode = sampleOscillatorBode(r, z);
  const qualityFactorQ = 1 / (2 * z);

  const hasResonancePeak = z < Math.SQRT1_2;
  const resonanceRatio = hasResonancePeak ? Math.sqrt(1 - 2 * z * z) : null;
  const peakMagnification = hasResonancePeak
    ? 1 / (2 * z * Math.sqrt(1 - z * z))
    : 1.0;

  const regime: OscillatorRegime =
    Math.abs(z - 1.0) < 0.015 ? "critical" : z < 1.0 ? "underdamped" : "overdamped";

  const dampedFreqHz = z < 1 ? f0 * Math.sqrt(1 - z * z) : 0;
  const denomSq = (1 - r * r) ** 2 + (2 * z * r) ** 2;
  const avgPowerNorm = (2 * z * r * r) / denomSq;

  // At least 3.8 decay time constants τ = 1/(ζ ω₀), bounded to [6, 16] seconds for crisp real-time viewing
  const decayTauS = 1 / Math.max(0.1, z * omega0RadS);
  const recommendedDurationS = Math.min(16, Math.max(6, Math.ceil(decayTauS * 3.8)));

  return {
    naturalFreqHz: f0,
    omega0RadS,
    dampingRatio: z,
    driveRatio: r,
    driveFreqHz: f0 * r,
    qualityFactorQ,
    magnification: bode.magnification,
    gainDb: bode.gainDb,
    phaseLagDeg: bode.phaseLagDeg,
    phaseLagRad: bode.phaseLagRad,
    resonanceRatio,
    peakMagnification,
    dampedFreqHz,
    avgPowerNorm,
    recommendedDurationS,
    regime,
  };
}

/**
 * Exact closed-form analytical solution for the unforced damped oscillator:
 *   x'' + 2 ζ ω_0 x' + ω_0² x = 0,  x(0) = x0,  x'(0) = v0
 * Handles underdamped (ζ < 1), critically damped (ζ = 1), and overdamped (ζ > 1).
 */
export function evaluateFreeDampedAnalytical(
  naturalFreqHz: number,
  dampingRatio: number,
  x0: number,
  v0: number,
  t: number
): { x: number; v: number } {
  const w0 = 2 * Math.PI * Math.max(0.1, naturalFreqHz);
  const z = Math.max(0, dampingRatio);

  if (Math.abs(z - 1) < 1e-7) {
    const exp = Math.exp(-w0 * t);
    const c2 = v0 + w0 * x0;
    const x = (x0 + c2 * t) * exp;
    const v = (c2 - w0 * (x0 + c2 * t)) * exp;
    return { x, v };
  }

  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const exp = Math.exp(-z * w0 * t);
    const A = x0;
    const B = (v0 + z * w0 * x0) / wd;
    const cos = Math.cos(wd * t);
    const sin = Math.sin(wd * t);
    const x = exp * (A * cos + B * sin);
    const v = exp * ((-z * w0 * A + wd * B) * cos + (-z * w0 * B - wd * A) * sin);
    return { x, v };
  }

  const s = w0 * Math.sqrt(z * z - 1);
  const r1 = -z * w0 + s;
  const r2 = -z * w0 - s;
  const c1 = (v0 - r2 * x0) / (r1 - r2);
  const c2 = x0 - c1;
  const e1 = Math.exp(r1 * t);
  const e2 = Math.exp(r2 * t);
  return {
    x: c1 * e1 + c2 * e2,
    v: c1 * r1 * e1 + c2 * r2 * e2,
  };
}

/**
 * Exact closed-form FULL solution (transient + steady-state particular integral) for:
 *   x'' + 2 ζ ω_0 x' + ω_0² x = driveAmp · ω_0² cos(ω_d t),  x(0) = x0,  x'(0) = v0
 */
export function evaluateDrivenDampedAnalytical(
  naturalFreqHz: number,
  dampingRatio: number,
  driveRatio: number,
  t: number,
  x0 = 0,
  v0 = 0,
  driveAmp = 1.0
): { x: number; v: number; xSteady: number; vSteady: number } {
  const w0 = 2 * Math.PI * Math.max(0.1, naturalFreqHz);
  const wd = w0 * Math.max(0.01, driveRatio);
  const bode = sampleOscillatorBode(driveRatio, dampingRatio);
  const A = driveAmp * bode.magnification;
  const delta = bode.phaseLagRad;

  // Particular steady-state integral: x_p(t) = A cos(ω_d t - δ)
  const xSteady = A * Math.cos(wd * t - delta);
  const vSteady = -A * wd * Math.sin(wd * t - delta);

  // Homogeneous initial conditions absorbing x_p(0) and x_p'(0)
  const xp0 = A * Math.cos(-delta);
  const vp0 = -A * wd * Math.sin(-delta);
  const hom = evaluateFreeDampedAnalytical(naturalFreqHz, dampingRatio, x0 - xp0, v0 - vp0, t);

  return {
    x: hom.x + xSteady,
    v: hom.v + vSteady,
    xSteady,
    vSteady,
  };
}

/**
 * Integrates the exact driven damped harmonic oscillator ODE via 4th-order Runge-Kutta (RK4):
 *   x'' + 2 ζ ω_0 x' + ω_0² x = driveAmp · ω_0² cos(ω_d t)
 * Returns trajectory samples (t, x, v / ω_0, drive) for real-time phase-space & waveform rendering.
 */
export function simulateOscillatorRK4(
  naturalFreqHz: number,
  dampingRatio: number,
  driveRatio: number,
  options?: {
    durationS?: number;
    dt?: number;
    x0?: number;
    v0?: number;
    driveAmp?: number;
  }
): OscillatorStateSample[] {
  const w0 = 2 * Math.PI * Math.min(5.0, Math.max(0.25, naturalFreqHz));
  const z = Math.min(2.0, Math.max(0.02, dampingRatio));
  const wd = w0 * Math.min(3.0, Math.max(0.05, driveRatio));
  const durationS = options?.durationS ?? 6.0;
  const dt = options?.dt ?? 0.004;
  const driveAmp = options?.driveAmp ?? 1.0;

  let t = 0;
  let x = options?.x0 ?? 0;
  let v = options?.v0 ?? 0;

  const steps = Math.max(1, Math.round(durationS / dt));
  const out: OscillatorStateSample[] = [
    { t: 0, x, vNorm: v / w0, drive: driveAmp * Math.cos(0) },
  ];

  const accel = (time: number, pos: number, vel: number) =>
    driveAmp * w0 * w0 * Math.cos(wd * time) - 2 * z * w0 * vel - w0 * w0 * pos;

  for (let i = 0; i < steps; i++) {
    const k1x = v;
    const k1v = accel(t, x, v);

    const k2x = v + 0.5 * dt * k1v;
    const k2v = accel(t + 0.5 * dt, x + 0.5 * dt * k1x, v + 0.5 * dt * k1v);

    const k3x = v + 0.5 * dt * k2v;
    const k3v = accel(t + 0.5 * dt, x + 0.5 * dt * k2x, v + 0.5 * dt * k2v);

    const k4x = v + dt * k3v;
    const k4v = accel(t + dt, x + dt * k3x, v + dt * k3v);

    x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    t += dt;

    out.push({
      t,
      x,
      vNorm: v / w0,
      drive: driveAmp * Math.cos(wd * t),
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// 7. Special Relativity: Lorentz Kinematics & Minkowski Spacetime
// ---------------------------------------------------------------------------

export interface RelativityMetrics {
  /** Dimensionless speed β = v / c ∈ [0, 0.9999]. */
  beta: number;
  /** Physical speed in km/s (exact SI c). */
  speedKmS: number;
  /** Exact Lorentz factor γ = 1 / √((1 - β)(1 + β)). */
  gamma: number;
  /** Exact rapidity η = atanh(β). */
  rapidity: number;
  /** Length contraction ratio L / L₀ = 1 / γ ∈ (0, 1]. */
  contractionRatio: number;
  /** Proper time duration τ₀ on moving clock (years). */
  properTimeYr: number;
  /** Dilated Earth coordinate time Δt = γ τ₀ (years). */
  dilatedTimeYr: number;
  /** Coordinate distance traversed in Earth frame β γ τ₀ (light-years). */
  distanceLy: number;
  /** Relativistic longitudinal Doppler blueshift factor √((1+β)/(1-β)). */
  dopplerApproach: number;
  /** Relativistic longitudinal Doppler redshift factor √((1-β)/(1+β)). */
  dopplerRecede: number;
  /** Relativistic electron kinetic energy (γ - 1) m_e c² in MeV. */
  electronKineticMeV: number;
  /** Classical Newtonian ½ m_e v² kinetic energy in MeV for comparison. */
  newtonianKineticMeV: number;
  /** Fraction (%) of cosmic-ray muons surviving a 10 km atmospheric descent. */
  muonSurvival10KmPct: number;
  /** Tilt angle atan(β) in degrees of primed axes (x', ct') on Minkowski diagram. */
  axisTiltDeg: number;
}

export interface LorentzEventTransform {
  x: number;
  ct: number;
  xPrime: number;
  ctPrime: number;
  /** Exact Minkowski invariant s² = (ct)² - x². */
  intervalS2: number;
  causalClass: "timelike" | "lightlike" | "spacelike";
  /** √|s²| (proper time if timelike, proper distance if spacelike). */
  properMagnitude: number;
}

/**
 * Computes exact special-relativistic observables from β = v/c and proper time τ₀.
 */
export function computeRelativityMetrics(
  beta: number,
  properTimeYr = 4.0
): RelativityMetrics {
  const b = Math.min(0.9999, Math.max(0, beta));
  const tau = Math.min(20, Math.max(0.5, properTimeYr));
  const invGamma = Math.sqrt((1 - b) * (1 + b));
  const gamma = 1 / invGamma;
  const rapidity = Math.atanh(b);
  const speedKmS = (b * PHYSICS_CONSTANTS.C) / 1000;

  const dilatedTimeYr = gamma * tau;
  const distanceLy = b * dilatedTimeYr;

  const dopplerApproach = Math.sqrt((1 + b) / (1 - b));
  const dopplerRecede = Math.sqrt((1 - b) / (1 + b));

  const electronKineticMeV = (gamma - 1) * ELECTRON_REST_ENERGY_MEV;
  const newtonianKineticMeV = 0.5 * b * b * ELECTRON_REST_ENERGY_MEV;

  // Muon survival across h = 10 km atmosphere: P = exp(-h / (β γ c τ_μ))
  const hMeters = 10_000;
  const decayLengthM = b * gamma * PHYSICS_CONSTANTS.C * MUON_LIFETIME_S;
  const muonSurvival10KmPct =
    decayLengthM > 1e-6 ? Math.exp(-hMeters / decayLengthM) * 100 : 0;

  return {
    beta: b,
    speedKmS,
    gamma,
    rapidity,
    contractionRatio: invGamma,
    properTimeYr: tau,
    dilatedTimeYr,
    distanceLy,
    dopplerApproach,
    dopplerRecede,
    electronKineticMeV,
    newtonianKineticMeV,
    muonSurvival10KmPct,
    axisTiltDeg: (Math.atan(b) * 180) / Math.PI,
  };
}

/**
 * Exact 1+1D Lorentz boost transformation of a spacetime event (x, ct)
 * into a frame moving at velocity β along +x. Preserves s² = (ct)² - x² identically.
 */
export function lorentzTransformEvent(
  x: number,
  ct: number,
  beta: number
): LorentzEventTransform {
  const b = Math.min(0.9999, Math.max(-0.9999, beta));
  const gamma = 1 / Math.sqrt((1 - b) * (1 + b));
  const xPrime = gamma * (x - b * ct);
  const ctPrime = gamma * (ct - b * x);
  const intervalS2 = ct * ct - x * x;

  const eps = 0.04;
  const causalClass: LorentzEventTransform["causalClass"] =
    Math.abs(intervalS2) <= eps
      ? "lightlike"
      : intervalS2 > 0
        ? "timelike"
        : "spacelike";

  return {
    x,
    ct,
    xPrime,
    ctPrime,
    intervalS2,
    causalClass,
    properMagnitude: Math.sqrt(Math.abs(intervalS2)),
  };
}

/**
 * Exact Einstein relativistic velocity addition u ⊕ v = (u + v) / (1 + u·v) in units of c.
 */
export function relativisticVelocityAdd(uBeta: number, vBeta: number): number {
  const u = Math.min(0.999999, Math.max(-0.999999, uBeta));
  const v = Math.min(0.999999, Math.max(-0.999999, vBeta));
  return (u + v) / (1 + u * v);
}

// ---------------------------------------------------------------------------
// 8. Lorenz Strange Attractor & Full Coupled 3-Vector Benettin Lyapunov RK4
// ---------------------------------------------------------------------------

export type LorenzRegime = "origin" | "stable" | "chaotic";

export interface LorenzPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface LorenzMetrics {
  sigma: number;
  rho: number;
  beta: number;
  /** Exact phase-space volume contraction rate ∇·F = -(σ + 1 + β) < 0. */
  divergenceRate: number;
  /** Exact subcritical Hopf bifurcation Rayleigh threshold ρ_H (null if σ ≤ β + 1). */
  hopfThresholdRho: number | null;
  /** Exact non-trivial convection fixed point C₊ (null if ρ ≤ 1). */
  fixedPointPos: LorenzPoint3D | null;
  /** Exact non-trivial convection fixed point C₋ (null if ρ ≤ 1). */
  fixedPointNeg: LorenzPoint3D | null;
  /** Full 3D Benettin Lyapunov spectrum [λ₁, λ₂, λ₃] satisfying λ₁ + λ₂ + λ₃ = ∇·F. */
  lyapunovSpectrum: [number, number, number];
  /** Largest Lyapunov exponent λ₁ (s⁻¹). */
  lyapunovMax: number;
  /** Kaplan-Yorke fractal dimension D_KY = 2 + (λ₁ + λ₂) / |λ₃| when chaotic (else 0). */
  kaplanYorkeDim: number;
  /** Lyapunov predictability horizon 1 / λ₁ in model time units (null if non-chaotic). */
  lyapunovHorizon: number | null;
  regime: LorenzRegime;
}

export interface LorenzTwinResult {
  metrics: LorenzMetrics;
  /** Primary trajectory r₁(t). */
  pointsA: LorenzPoint3D[];
  /** Perturbed twin trajectory r₂(t) starting Δx₀ = 1e-5 away. */
  pointsB: LorenzPoint3D[];
  /** Euclidean separation ‖r₂(t) - r₁(t)‖ at each stored sample. */
  separations: number[];
  /** Timestep between stored samples. */
  sampleDt: number;
}

/**
 * Evaluates exact algebraic invariants of the 3D Lorenz convection system:
 *   dx/dt = σ(y - x),  dy/dt = x(ρ - z) - y,  dz/dt = xy - βz
 */
export function computeLorenzInvariants(sigma: number, rho: number, beta: number) {
  const s = Math.min(25, Math.max(2, sigma));
  const r = Math.min(60, Math.max(0.2, rho));
  const b = Math.min(6, Math.max(0.25, beta));

  const divergenceRate = -(s + 1 + b);
  const hopfThresholdRho = s > b + 1 ? (s * (s + b + 3)) / (s - b - 1) : null;

  const fixedPointPos: LorenzPoint3D | null =
    r > 1
      ? {
          x: Math.sqrt(b * (r - 1)),
          y: Math.sqrt(b * (r - 1)),
          z: r - 1,
        }
      : null;

  const fixedPointNeg: LorenzPoint3D | null = fixedPointPos
    ? { x: -fixedPointPos.x, y: -fixedPointPos.y, z: fixedPointPos.z }
    : null;

  return {
    sigma: s,
    rho: r,
    beta: b,
    divergenceRate,
    hopfThresholdRho,
    fixedPointPos,
    fixedPointNeg,
  };
}

/**
 * Integrates two initially δ₀ = 10⁻⁵ separated Lorenz trajectories via exact RK4
 * AND computes the FULL 3-exponent Benettin Lyapunov spectrum [λ₁, λ₂, λ₃] using a
 * true coupled 12D RK4 variational integrator + Gram-Schmidt orthonormalization,
 * guaranteeing Liouville's identity λ₁ + λ₂ + λ₃ = -(σ + 1 + β) and exact D_KY.
 */
export function integrateLorenzTwinRK4(
  sigma = 10,
  rho = 28,
  beta = 8 / 3,
  options?: {
    dt?: number;
    transientSteps?: number;
    steps?: number;
    lyapunovExtraSteps?: number;
    sampleStride?: number;
    perturbation?: number;
  }
): LorenzTwinResult {
  const inv = computeLorenzInvariants(sigma, rho, beta);
  const { sigma: s, rho: r, beta: b } = inv;

  const dt = options?.dt ?? 0.005;
  const transientSteps = options?.transientSteps ?? 800;
  const steps = options?.steps ?? 3600;
  const lyapunovExtraSteps = options?.lyapunovExtraSteps ?? 12_000;
  const sampleStride = Math.max(1, options?.sampleStride ?? 2);
  const eps0 = options?.perturbation ?? 1e-5;

  const rk4StateStep = (x: number, y: number, z: number, h: number): [number, number, number] => {
    const k1x = s * (y - x);
    const k1y = x * (r - z) - y;
    const k1z = x * y - b * z;

    const x2 = x + 0.5 * h * k1x;
    const y2 = y + 0.5 * h * k1y;
    const z2 = z + 0.5 * h * k1z;
    const k2x = s * (y2 - x2);
    const k2y = x2 * (r - z2) - y2;
    const k2z = x2 * y2 - b * z2;

    const x3 = x + 0.5 * h * k2x;
    const y3 = y + 0.5 * h * k2y;
    const z3 = z + 0.5 * h * k2z;
    const k3x = s * (y3 - x3);
    const k3y = x3 * (r - z3) - y3;
    const k3z = x3 * y3 - b * z3;

    const x4 = x + h * k3x;
    const y4 = y + h * k3y;
    const z4 = z + h * k3z;
    const k4x = s * (y4 - x4);
    const k4y = x4 * (r - z4) - y4;
    const k4z = x4 * y4 - b * z4;

    return [
      x + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x),
      y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y),
      z + (h / 6) * (k1z + 2 * k2z + 2 * k3z + k4z),
    ];
  };

  // Start slightly off-origin so all regimes evolve cleanly onto the attractor
  let ax = 1.0;
  let ay = 1.0;
  let az = Math.max(1.0, r * 0.65);

  // Orthonormal 3x3 tangent frame W = [w1, w2, w3] stored as flat 9-tuple
  let w1x = 1, w1y = 0, w1z = 0;
  let w2x = 0, w2y = 1, w2z = 0;
  let w3x = 0, w3y = 0, w3z = 1;

  const logSum = [0, 0, 0];
  const renormInterval = 8;

  // True coupled 12D RK4 step advancing state (ax, ay, az) + all 3 tangent vectors simultaneously
  const coupledStep = (h: number) => {
    // Stage 1 at (ax, ay, az)
    const f1x = s * (ay - ax);
    const f1y = ax * (r - az) - ay;
    const f1z = ax * ay - b * az;

    const j1_1x = s * (w1y - w1x), j1_1y = (r - az) * w1x - w1y - ax * w1z, j1_1z = ay * w1x + ax * w1y - b * w1z;
    const j1_2x = s * (w2y - w2x), j1_2y = (r - az) * w2x - w2y - ax * w2z, j1_2z = ay * w2x + ax * w2y - b * w2z;
    const j1_3x = s * (w3y - w3x), j1_3y = (r - az) * w3x - w3y - ax * w3z, j1_3z = ay * w3x + ax * w3y - b * w3z;

    // Stage 2 at midpoint 1
    const hh = 0.5 * h;
    const x2 = ax + hh * f1x, y2 = ay + hh * f1y, z2 = az + hh * f1z;
    const f2x = s * (y2 - x2);
    const f2y = x2 * (r - z2) - y2;
    const f2z = x2 * y2 - b * z2;

    const u1x = w1x + hh * j1_1x, u1y = w1y + hh * j1_1y, u1z = w1z + hh * j1_1z;
    const u2x = w2x + hh * j1_2x, u2y = w2y + hh * j1_2y, u2z = w2z + hh * j1_2z;
    const u3x = w3x + hh * j1_3x, u3y = w3y + hh * j1_3y, u3z = w3z + hh * j1_3z;

    const j2_1x = s * (u1y - u1x), j2_1y = (r - z2) * u1x - u1y - x2 * u1z, j2_1z = y2 * u1x + x2 * u1y - b * u1z;
    const j2_2x = s * (u2y - u2x), j2_2y = (r - z2) * u2x - u2y - x2 * u2z, j2_2z = y2 * u2x + x2 * u2y - b * u2z;
    const j2_3x = s * (u3y - u3x), j2_3y = (r - z2) * u3x - u3y - x2 * u3z, j2_3z = y2 * u3x + x2 * u3y - b * u3z;

    // Stage 3 at midpoint 2
    const x3 = ax + hh * f2x, y3 = ay + hh * f2y, z3 = az + hh * f2z;
    const f3x = s * (y3 - x3);
    const f3y = x3 * (r - z3) - y3;
    const f3z = x3 * y3 - b * z3;

    const v1x = w1x + hh * j2_1x, v1y = w1y + hh * j2_1y, v1z = w1z + hh * j2_1z;
    const v2x = w2x + hh * j2_2x, v2y = w2y + hh * j2_2y, v2z = w2z + hh * j2_2z;
    const v3x = w3x + hh * j2_3x, v3y = w3y + hh * j2_3y, v3z = w3z + hh * j2_3z;

    const j3_1x = s * (v1y - v1x), j3_1y = (r - z3) * v1x - v1y - x3 * v1z, j3_1z = y3 * v1x + x3 * v1y - b * v1z;
    const j3_2x = s * (v2y - v2x), j3_2y = (r - z3) * v2x - v2y - x3 * v2z, j3_2z = y3 * v2x + x3 * v2y - b * v2z;
    const j3_3x = s * (v3y - v3x), j3_3y = (r - z3) * v3x - v3y - x3 * v3z, j3_3z = y3 * v3x + x3 * v3y - b * v3z;

    // Stage 4 at endpoint
    const x4 = ax + h * f3x, y4 = ay + h * f3y, z4 = az + h * f3z;
    const f4x = s * (y4 - x4);
    const f4y = x4 * (r - z4) - y4;
    const f4z = x4 * y4 - b * z4;

    const p1x = w1x + h * j3_1x, p1y = w1y + h * j3_1y, p1z = w1z + h * j3_1z;
    const p2x = w2x + h * j3_2x, p2y = w2y + h * j3_2y, p2z = w2z + h * j3_2z;
    const p3x = w3x + h * j3_3x, p3y = w3y + h * j3_3y, p3z = w3z + h * j3_3z;

    const j4_1x = s * (p1y - p1x), j4_1y = (r - z4) * p1x - p1y - x4 * p1z, j4_1z = y4 * p1x + x4 * p1y - b * p1z;
    const j4_2x = s * (p2y - p2x), j4_2y = (r - z4) * p2x - p2y - x4 * p2z, j4_2z = y4 * p2x + x4 * p2y - b * p2z;
    const j4_3x = s * (p3y - p3x), j4_3y = (r - z4) * p3x - p3y - x4 * p3z, j4_3z = y4 * p3x + x4 * p3y - b * p3z;

    const h6 = h / 6;
    ax += h6 * (f1x + 2 * f2x + 2 * f3x + f4x);
    ay += h6 * (f1y + 2 * f2y + 2 * f3y + f4y);
    az += h6 * (f1z + 2 * f2z + 2 * f3z + f4z);

    w1x += h6 * (j1_1x + 2 * j2_1x + 2 * j3_1x + j4_1x);
    w1y += h6 * (j1_1y + 2 * j2_1y + 2 * j3_1y + j4_1y);
    w1z += h6 * (j1_1z + 2 * j2_1z + 2 * j3_1z + j4_1z);

    w2x += h6 * (j1_2x + 2 * j2_2x + 2 * j3_2x + j4_2x);
    w2y += h6 * (j1_2y + 2 * j2_2y + 2 * j3_2y + j4_2y);
    w2z += h6 * (j1_2z + 2 * j2_2z + 2 * j3_2z + j4_2z);

    w3x += h6 * (j1_3x + 2 * j2_3x + 2 * j3_3x + j4_3x);
    w3y += h6 * (j1_3y + 2 * j2_3y + 2 * j3_3y + j4_3y);
    w3z += h6 * (j1_3z + 2 * j2_3z + 2 * j3_3z + j4_3z);
  };

  // Modified Gram-Schmidt orthonormalization of [w1, w2, w3]
  const gramSchmidt = (accumulate: boolean) => {
    const n1 = Math.hypot(w1x, w1y, w1z);
    if (n1 > 1e-30 && Number.isFinite(n1)) {
      if (accumulate) logSum[0] += Math.log(n1);
      w1x /= n1; w1y /= n1; w1z /= n1;
    }

    const d21 = w2x * w1x + w2y * w1y + w2z * w1z;
    w2x -= d21 * w1x; w2y -= d21 * w1y; w2z -= d21 * w1z;
    const n2 = Math.hypot(w2x, w2y, w2z);
    if (n2 > 1e-30 && Number.isFinite(n2)) {
      if (accumulate) logSum[1] += Math.log(n2);
      w2x /= n2; w2y /= n2; w2z /= n2;
    }

    const d31 = w3x * w1x + w3y * w1y + w3z * w1z;
    w3x -= d31 * w1x; w3y -= d31 * w1y; w3z -= d31 * w1z;
    const d32 = w3x * w2x + w3y * w2y + w3z * w2z;
    w3x -= d32 * w2x; w3y -= d32 * w2y; w3z -= d32 * w2z;
    const n3 = Math.hypot(w3x, w3y, w3z);
    if (n3 > 1e-30 && Number.isFinite(n3)) {
      if (accumulate) logSum[2] += Math.log(n3);
      w3x /= n3; w3y /= n3; w3z /= n3;
    }
  };

  // Transient warm-up: settle state onto attractor AND align [w1, w2, w3] with Oseledets subspaces
  const settle = r > 18 ? transientSteps : 40;
  for (let i = 1; i <= settle; i++) {
    coupledStep(dt);
    if (i % renormInterval === 0) {
      gramSchmidt(false);
    }
  }
  gramSchmidt(false);

  let bx = ax + eps0;
  let by = ay;
  let bz = az;

  const pointsA: LorenzPoint3D[] = [{ x: ax, y: ay, z: az }];
  const pointsB: LorenzPoint3D[] = [{ x: bx, y: by, z: bz }];
  const separations: number[] = [eps0];

  // Phase 1: Visual twin trajectories + coupled tangent evolution
  for (let i = 1; i <= steps; i++) {
    coupledStep(dt);
    [bx, by, bz] = rk4StateStep(bx, by, bz, dt);

    if (i % renormInterval === 0) {
      gramSchmidt(true);
    }

    if (i % sampleStride === 0) {
      pointsA.push({ x: ax, y: ay, z: az });
      pointsB.push({ x: bx, y: by, z: bz });
      separations.push(Math.hypot(bx - ax, by - ay, bz - az));
    }
  }

  // Phase 2: Allocation-free asymptotic Benettin integration for converged λ₁, λ₂, λ₃
  const totalLyapSteps = steps + lyapunovExtraSteps;
  for (let i = steps + 1; i <= totalLyapSteps; i++) {
    coupledStep(dt);
    if (i % renormInterval === 0) {
      gramSchmidt(true);
    }
  }

  const totalLyapTime = Math.floor(totalLyapSteps / renormInterval) * renormInterval * dt;
  const l1 = totalLyapTime > 0 ? logSum[0] / totalLyapTime : 0;
  const l2 = totalLyapTime > 0 ? logSum[1] / totalLyapTime : 0;
  const l3 = totalLyapTime > 0 ? logSum[2] / totalLyapTime : 0;

  const regime: LorenzRegime = r <= 1 ? "origin" : l1 > 0.05 ? "chaotic" : "stable";
  const kaplanYorkeDim =
    regime === "chaotic" && l3 < -1e-6 ? 2 + (l1 + l2) / Math.abs(l3) : 0;

  return {
    metrics: {
      ...inv,
      lyapunovSpectrum: [l1, l2, l3],
      lyapunovMax: l1,
      kaplanYorkeDim,
      lyapunovHorizon: regime === "chaotic" ? 1 / l1 : null,
      regime,
    },
    pointsA,
    pointsB,
    separations,
    sampleDt: dt * sampleStride,
  };
}
