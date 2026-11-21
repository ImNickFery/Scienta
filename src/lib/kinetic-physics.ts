/**
 * Pure deterministic physics & optics simulation helpers powering the
 * Unslop Kinetic ("Living Optical Lab") interactive bench.
 * Zero DOM dependencies so every formula can be unit-tested directly.
 */

export interface DoubleSlitResult {
  wavelengthNm: number;
  slitSeparationMm: number;
  screenDistanceM: number;
  fringeSpacingMm: number;
  spectralHex: string;
}

export interface KeplerOrbitPoint {
  eccentricAnomalyRad: number;
  trueAnomalyRad: number;
  /** Normalized position in AU relative to the focal star at (0, 0). */
  xAU: number;
  yAU: number;
  radiusAU: number;
  /** Orbital period in Julian years (solar-mass primary). */
  periodYears: number;
  /** Instantaneous orbital speed in km/s via vis-viva equation. */
  speedKmS: number;
}

export interface HorizonResult {
  solarMasses: number;
  schwarzschildKm: number;
  photonSphereKm: number;
  hawkingTempNanoK: number;
}

export interface QuantumWellMetrics {
  n1: number;
  n2: number;
  wellWidthNm: number;
  /** Energy of level n1 in electron-volts (electron in 1D box). */
  energy1Ev: number;
  /** Energy of level n2 in electron-volts. */
  energy2Ev: number;
  /** Energy gap |E2 - E1| in eV. */
  deltaEEv: number;
  /** True when n1 !== n2 so probability density sloshes in time. */
  isSuperposition: boolean;
}

export interface QuantumWaveSample {
  /** Normalized coordinate u = x / L in [0, 1]. */
  u: number;
  /** Real part of ψ(u, t). */
  real: number;
  /** Imaginary part of ψ(u, t). */
  imag: number;
  /** Probability density |ψ(u, t)|² >= 0. */
  probDensity: number;
}

export interface PhotonDeflectionResult {
  /** Impact parameter b in units of Schwarzschild radius r_s. */
  impactParamRs: number;
  /** Critical capture impact parameter b_crit = (3√3 / 2) r_s ≈ 2.598 r_s. */
  criticalImpactRs: number;
  /** True if photon plunges into the black hole (b < b_crit). */
  captured: boolean;
  /** True if photon skims closely near the photon sphere capture ring. */
  nearPhotonRing: boolean;
  /** Deflection angle in degrees (strong-field augmented Einstein formula). */
  deflectionDeg: number;
}

/**
 * Converts a visible light wavelength (380–750 nm) into a restrained,
 * physically faithful hex color for canvas dispersion & interference traces.
 */
export function wavelengthToHex(wavelengthNm: number): string {
  const wl = Math.min(750, Math.max(380, wavelengthNm));
  let r = 0;
  let g = 0;
  let b = 0;

  if (wl < 440) {
    r = -(wl - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (wl < 490) {
    r = 0;
    g = (wl - 440) / (490 - 440);
    b = 1;
  } else if (wl < 510) {
    r = 0;
    g = 1;
    b = -(wl - 510) / (510 - 490);
  } else if (wl < 580) {
    r = (wl - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (wl < 645) {
    r = 1;
    g = -(wl - 645) / (645 - 580);
    b = 0;
  } else {
    r = 1;
    g = 0;
    b = 0;
  }

  // Soft rolloff near spectral edges
  let factor = 1;
  if (wl < 420) factor = 0.35 + 0.65 * ((wl - 380) / (420 - 380));
  else if (wl > 700) factor = 0.35 + 0.65 * ((750 - wl) / (750 - 700));

  const gamma = 0.82;
  const toByte = (c: number) =>
    c <= 0 ? 0 : Math.min(255, Math.round(255 * Math.pow(c * factor, gamma)));

  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(toByte(r))}${hex(toByte(g))}${hex(toByte(b))}`;
}

/**
 * Young's double-slit fringe spacing: Δy = (λ · L) / d.
 * λ in nm, d in mm, L in m -> returns Δy in mm.
 */
export function computeDoubleSlit(
  wavelengthNm: number,
  slitSeparationMm: number,
  screenDistanceM = 1.5
): DoubleSlitResult {
  const safeWl = Math.min(750, Math.max(380, wavelengthNm));
  const safeD = Math.min(2.0, Math.max(0.1, slitSeparationMm));
  const safeL = Math.max(0.2, screenDistanceM);
  // λ (nm) = λ * 1e-9 m; d (mm) = d * 1e-3 m -> Δy (m) = (λ*1e-9 * L)/(d*1e-3) = (λ*L/d)*1e-6 m = (λ*L/d)*1e-3 mm
  const fringeSpacingMm = (safeWl * safeL) / (safeD * 1000);
  return {
    wavelengthNm: safeWl,
    slitSeparationMm: safeD,
    screenDistanceM: safeL,
    fringeSpacingMm,
    spectralHex: wavelengthToHex(safeWl),
  };
}

/**
 * Normalized double-slit intensity I(x) ∈ [0, 1] at screen coordinate x (mm),
 * combining two-slit interference cos²(β) with finite single-slit envelope sinc²(α).
 */
export function doubleSlitIntensity(
  screenXMm: number,
  wavelengthNm: number,
  slitSeparationMm: number,
  screenDistanceM = 1.5
): number {
  const { fringeSpacingMm } = computeDoubleSlit(wavelengthNm, slitSeparationMm, screenDistanceM);
  const interferenceArg = (Math.PI * screenXMm) / fringeSpacingMm;
  const interference = Math.cos(interferenceArg) ** 2;
  // Single-slit width a = 0.22 * d produces realistic central envelope
  const envelopeArg = interferenceArg * 0.22;
  const envelope = Math.abs(envelopeArg) < 1e-6 ? 1 : (Math.sin(envelopeArg) / envelopeArg) ** 2;
  return interference * envelope;
}

/**
 * Solves Kepler's equation M = E - e·sin(E) via Newton-Raphson and returns
 * the planet's coordinates, orbital period, and vis-viva orbital speed.
 */
export function computeKeplerOrbit(
  semiMajorAU: number,
  eccentricity: number,
  meanAnomalyRad: number
): KeplerOrbitPoint {
  const a = Math.min(5, Math.max(0.4, semiMajorAU));
  const e = Math.min(0.82, Math.max(0, eccentricity));
  const M = ((meanAnomalyRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) {
    const f = E - e * Math.sin(E) - M;
    const fPrime = 1 - e * Math.cos(E);
    E -= f / fPrime;
  }

  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const xAU = a * (cosE - e);
  const yAU = a * Math.sqrt(1 - e * e) * sinE;
  const radiusAU = Math.hypot(xAU, yAU);
  const trueAnomalyRad = Math.atan2(yAU, xAU);

  // Kepler's 3rd law around 1 M☉: T(years) = a^(3/2)
  const periodYears = Math.pow(a, 1.5);
  // Vis-viva: v = v_earth * sqrt(2/r - 1/a), v_earth ≈ 29.7847 km/s
  const speedKmS = 29.7847 * Math.sqrt(Math.max(0, 2 / radiusAU - 1 / a));

  return {
    eccentricAnomalyRad: E,
    trueAnomalyRad,
    xAU,
    yAU,
    radiusAU,
    periodYears,
    speedKmS,
  };
}

/**
 * Computes relativistic black hole horizon metrics for a non-rotating mass M (in solar masses).
 */
export function computeHorizonCurvature(solarMasses: number): HorizonResult {
  const m = Math.min(100, Math.max(1, solarMasses));
  // 2 G M_sun / c^2 ≈ 2.95325 km
  const schwarzschildKm = 2.95325 * m;
  const photonSphereKm = 1.5 * schwarzschildKm;
  // Hawking temperature for 1 M_sun ≈ 61.69 nK, scales as 1/M
  const hawkingTempNanoK = 61.69 / m;
  return {
    solarMasses: m,
    schwarzschildKm,
    photonSphereKm,
    hawkingTempNanoK,
  };
}

/**
 * Evaluates relativistic photon deflection and capture threshold for a photon
 * approaching a Schwarzschild black hole with impact parameter b (in units of r_s).
 */
export function computePhotonDeflection(impactParamRs: number): PhotonDeflectionResult {
  const b = Math.max(0.2, Math.abs(impactParamRs));
  const criticalImpactRs = (3 * Math.sqrt(3)) / 2; // ≈ 2.598076 r_s
  const captured = b < criticalImpactRs;
  const nearPhotonRing = !captured && b < criticalImpactRs * 1.28;

  if (captured) {
    return {
      impactParamRs: b,
      criticalImpactRs,
      captured: true,
      nearPhotonRing: false,
      deflectionDeg: 180,
    };
  }

  // Weak-field Einstein term (2 r_s / b) + second-order Schwarzschild correction (15π/16)(r_s/b)²
  const rad = 2 / b + ((15 * Math.PI) / 16) * (1 / (b * b));
  const deflectionDeg = Math.min(175, (rad * 180) / Math.PI);
  return {
    impactParamRs: b,
    criticalImpactRs,
    captured: false,
    nearPhotonRing,
    deflectionDeg,
  };
}

/**
 * Computes electron energy eigenvalues E_n = n² h² / (8 m_e L²) in eV
 * for a 1D infinite quantum potential well of width L (in nm).
 */
export function computeQuantumWellMetrics(
  n1: number,
  n2: number,
  wellWidthNm = 1.0
): QuantumWellMetrics {
  const level1 = Math.min(6, Math.max(1, Math.round(n1)));
  const level2 = Math.min(6, Math.max(1, Math.round(n2)));
  const L = Math.min(4, Math.max(0.4, wellWidthNm));
  // Ground-state constant h² / (8 m_e) ≈ 0.37603 eV·nm²
  const baseEv = 0.37603 / (L * L);
  const energy1Ev = level1 * level1 * baseEv;
  const energy2Ev = level2 * level2 * baseEv;
  return {
    n1: level1,
    n2: level2,
    wellWidthNm: L,
    energy1Ev,
    energy2Ev,
    deltaEEv: Math.abs(energy2Ev - energy1Ev),
    isSuperposition: level1 !== level2,
  };
}

/**
 * Samples the normalized time-dependent quantum wavefunction ψ(u, t)
 * at dimensionless position u = x/L ∈ [0, 1] and phase time t (in radians/ω₁).
 * Satisfies ∫₀¹ |ψ(u, t)|² du = 1 for both stationary states and equal superpositions.
 */
export function sampleQuantumSuperposition(
  u: number,
  n1: number,
  n2: number,
  phaseTime: number
): QuantumWaveSample {
  const clampedU = Math.min(1, Math.max(0, u));
  const level1 = Math.min(6, Math.max(1, Math.round(n1)));
  const level2 = Math.min(6, Math.max(1, Math.round(n2)));

  const phi1 = Math.SQRT2 * Math.sin(level1 * Math.PI * clampedU);
  const omega1 = level1 * level1;

  if (level1 === level2) {
    const real = phi1 * Math.cos(omega1 * phaseTime);
    const imag = -phi1 * Math.sin(omega1 * phaseTime);
    return {
      u: clampedU,
      real,
      imag,
      probDensity: real * real + imag * imag,
    };
  }

  const phi2 = Math.SQRT2 * Math.sin(level2 * Math.PI * clampedU);
  const omega2 = level2 * level2;
  const norm = Math.SQRT1_2;

  const real =
    norm * (phi1 * Math.cos(omega1 * phaseTime) + phi2 * Math.cos(omega2 * phaseTime));
  const imag =
    -norm * (phi1 * Math.sin(omega1 * phaseTime) + phi2 * Math.sin(omega2 * phaseTime));

  return {
    u: clampedU,
    real,
    imag,
    probDensity: real * real + imag * imag,
  };
}

