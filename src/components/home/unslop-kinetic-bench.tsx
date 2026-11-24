"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import {
  Activity,
  Atom,
  CircleDot,
  Compass,
  Crosshair,
  Flame,
  Infinity as InfinityIcon,
  Maximize2,
  Minimize2,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Waves,
} from "lucide-react";
import {
  CRITICAL_IMPACT_RS,
  computeDoubleSlit,
  computeHorizonCurvature,
  computeKeplerOrbit,
  computeQuantumObservables,
  computeQuantumWellMetrics,
  probeDoubleSlitExact,
  sampleQuantumSuperposition,
  traceSchwarzschildGeodesic,
  trueAnomalyToMeanAnomaly,
  type SchwarzschildGeodesicResult,
} from "@/lib/kinetic-physics";
import {
  computeOscillatorMetrics,
  computePlanckBlackbody,
  computeRelativityMetrics,
  integrateLorenzTwinRK4,
  simulateOscillatorRK4,
} from "@/lib/kinetic-physics-extended";
import {
  drawLorenzCanvas,
  drawOscillatorCanvas,
  drawPlanckCanvas,
  drawRelativityCanvas,
} from "./kinetic-bench-renderers-extended";
import type { Locale } from "@/lib/i18n/config";

type LabMode =
  | "slit"
  | "orbit"
  | "horizon"
  | "quantum"
  | "planck"
  | "oscillator"
  | "relativity"
  | "lorenz";

interface PointerPos {
  /** Normalized x in [0, 1] across canvas */
  nx: number;
  /** Normalized y in [0, 1] across canvas */
  ny: number;
  /** True while pointer is actively pressed */
  down: boolean;
}

/**
 * Unslop Kinetic Centerpiece — High-Precision Living 60fps Physics Instrument Bench
 * Powered by exact CODATA-2022 / IAU-2015 constants, non-paraxial Fraunhofer optics,
 * machine-epsilon Halley-Newton orbital mechanics, 4th-order Runge-Kutta Schwarzschild
 * null geodesics, and closed-form analytical quantum Heisenberg observables.
 */
export function UnslopKineticBench({ locale }: { locale: Locale }) {
  const isFa = locale === "fa";

  const [mode, setMode] = useState<LabMode>("slit");
  const [playing, setPlaying] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Experiment 1: Exact Non-Paraxial Double-Slit Optics
  const [wavelengthNm, setWavelengthNm] = useState(532);
  const [slitSepMm, setSlitSepMm] = useState(0.45);
  const [slitWidthMm, setSlitWidthMm] = useState(0.09);

  // Experiment 2: Machine-Precision Keplerian Two-Body Orbit
  const [eccentricity, setEccentricity] = useState(0.52);
  const [semiMajorAU, setSemiMajorAU] = useState(1.4);

  // Experiment 3: Exact RK4 Schwarzschild Event Horizon
  const [solarMasses, setSolarMasses] = useState(21.2);

  // Experiment 4: Exact 1D Infinite Quantum Potential Well
  const [quantumN1, setQuantumN1] = useState(1);
  const [quantumN2, setQuantumN2] = useState(2);
  const [wellWidthNm, setWellWidthNm] = useState(1.0);

  // Experiment 5: Exact Planck Blackbody Radiation (CODATA 2022)
  const [planckTempK, setPlanckTempK] = useState(5772);
  const [planckEmissivity, setPlanckEmissivity] = useState(1.0);

  // Experiment 6: Exact Damped Driven Harmonic Oscillator & Bode Resonance
  const [oscFreqHz, setOscFreqHz] = useState(1.5);
  const [oscZeta, setOscZeta] = useState(0.15);
  const [oscDriveRatio, setOscDriveRatio] = useState(0.95);

  // Experiment 7: Exact Special Relativity & Minkowski Spacetime
  const [relBeta, setRelBeta] = useState(0.8);
  const [relProperYr, setRelProperYr] = useState(4.0);

  // Experiment 8: Exact Lorenz Strange Attractor & Full 12D Benettin Lyapunov Chaos
  const [lorenzRho, setLorenzRho] = useState(28.0);
  const [lorenzSigma, setLorenzSigma] = useState(10.0);
  const [lorenzBeta, setLorenzBeta] = useState(8 / 3);

  // Live telemetry driven from the animation frame (throttled ~10Hz)
  const [liveOrbit, setLiveOrbit] = useState(() => {
    const pt = computeKeplerOrbit(1.4, 0.52, 0);
    return {
      speedKmS: pt.speedKmS,
      radiusAU: pt.radiusAU,
      flightPathDeg: pt.flightPathDeg,
      perihelionAU: pt.perihelionAU,
      aphelionAU: pt.aphelionAU,
    };
  });
  const [liveQuantum, setLiveQuantum] = useState(() => {
    const obs = computeQuantumObservables(1, 2, 0);
    return {
      meanU: obs.meanU,
      sigmaU: obs.sigmaU,
      heisenbergHbar: obs.heisenbergProductHbar,
    };
  });
  const [liveLorenzSep, setLiveLorenzSep] = useState(1e-5);
  const [probeReadout, setProbeReadout] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const pointerRef = useRef<PointerPos | null>(null);
  const lastUiSyncRef = useRef(0);
  const lorenzAzimuthRef = useRef(-Math.PI / 4);
  const lorenzDragLastNxRef = useRef<number | null>(null);

  // Exact physics derivations
  const slitMetrics = useMemo(
    () => computeDoubleSlit(wavelengthNm, slitSepMm, 1.5, slitWidthMm),
    [wavelengthNm, slitSepMm, slitWidthMm]
  );
  const orbitReference = useMemo(
    () => computeKeplerOrbit(semiMajorAU, eccentricity, 0),
    [semiMajorAU, eccentricity]
  );
  const horizonMetrics = useMemo(
    () => computeHorizonCurvature(solarMasses),
    [solarMasses]
  );
  const quantumMetrics = useMemo(
    () => computeQuantumWellMetrics(quantumN1, quantumN2, wellWidthNm),
    [quantumN1, quantumN2, wellWidthNm]
  );
  const planckMetrics = useMemo(
    () => computePlanckBlackbody(planckTempK, planckEmissivity),
    [planckTempK, planckEmissivity]
  );
  const oscMetrics = useMemo(
    () => computeOscillatorMetrics(oscFreqHz, oscZeta, oscDriveRatio),
    [oscFreqHz, oscZeta, oscDriveRatio]
  );
  const oscTrajectory = useMemo(
    () =>
      mode === "oscillator"
        ? simulateOscillatorRK4(oscFreqHz, oscZeta, oscDriveRatio, {
            durationS: oscMetrics.recommendedDurationS,
            dt: 0.004,
          })
        : [],
    [mode, oscFreqHz, oscZeta, oscDriveRatio, oscMetrics.recommendedDurationS]
  );
  const relMetrics = useMemo(
    () => computeRelativityMetrics(relBeta, relProperYr),
    [relBeta, relProperYr]
  );
  const lorenzResult = useMemo(
    () =>
      mode === "lorenz"
        ? integrateLorenzTwinRK4(lorenzSigma, lorenzRho, lorenzBeta, {
            dt: 0.005,
            transientSteps: 800,
            steps: 3600,
            lyapunovExtraSteps: 8000,
            sampleStride: 2,
            perturbation: 1e-5,
          })
        : null,
    [mode, lorenzSigma, lorenzRho, lorenzBeta]
  );

  // Pre-integrated ambient Schwarzschild null geodesics (exact RK4 from u = 0)
  const ambientGeodesics = useMemo<SchwarzschildGeodesicResult[]>(() => {
    const impacts = [-4.6, -3.35, -2.75, 2.75, 3.35, 4.6];
    return impacts.map((b) =>
      traceSchwarzschildGeodesic(b, { rViewRs: 18, maxSteps: 1800, stepRad: 0.015 })
    );
  }, []);

  // Pre-rendered KaTeX governing equation for each active instrument
  const renderedFormula = useMemo(() => {
    const tex =
      mode === "slit"
        ? `I = \\cos^2\\!\\left(\\tfrac{\\pi\\Delta r}{\\lambda}\\right)\\operatorname{sinc}^2\\!\\left(\\tfrac{\\pi a\\sin\\theta}{\\lambda}\\right)`
        : mode === "orbit"
          ? `M = E - e\\sin E,\\quad v = \\sqrt{\\mu\\!\\left(\\tfrac{2}{r}-\\tfrac{1}{a}\\right)}`
          : mode === "horizon"
            ? `\\frac{d^2 u}{d\\phi^2} = \\tfrac{3}{2}u^2 - u,\\quad b_{\\text{crit}} = \\tfrac{3\\sqrt{3}}{2}r_s`
            : mode === "quantum"
              ? `E_n = \\frac{n^2 h^2}{8m_e L^2},\\quad \\sigma_x\\sigma_p \\ge \\tfrac{\\hbar}{2}`
              : mode === "planck"
                ? `B_\\lambda = \\frac{2hc^2}{\\lambda^5}\\frac{1}{e^{hc/\\lambda k_B T}-1},\\quad j^* = \\varepsilon\\sigma T^4`
                : mode === "oscillator"
                  ? `\\ddot{x}+2\\zeta\\omega_0\\dot{x}+\\omega_0^2 x = \\tfrac{F_0}{m}\\cos(\\omega_d t)`
                  : mode === "relativity"
                    ? `\\gamma = \\frac{1}{\\sqrt{1-\\beta^2}},\\quad (ct')^2 - x'^2 = (ct)^2 - x^2`
                    : `\\dot{x}=\\sigma(y-x),\\;\\dot{y}=x(\\rho-z)-y,\\;\\dot{z}=xy-\\beta z`;
    try {
      return katex.renderToString(tex, {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return tex;
    }
  }, [mode]);

  const handleReset = () => {
    phaseRef.current = 0;
    pointerRef.current = null;
    lorenzDragLastNxRef.current = null;
    setProbeReadout(null);
    if (mode === "slit") {
      setWavelengthNm(532);
      setSlitSepMm(0.45);
      setSlitWidthMm(0.09);
    } else if (mode === "orbit") {
      setEccentricity(0.52);
      setSemiMajorAU(1.4);
    } else if (mode === "horizon") {
      setSolarMasses(21.2);
    } else if (mode === "quantum") {
      setQuantumN1(1);
      setQuantumN2(2);
      setWellWidthNm(1.0);
    } else if (mode === "planck") {
      setPlanckTempK(5772);
      setPlanckEmissivity(1.0);
    } else if (mode === "oscillator") {
      setOscFreqHz(1.5);
      setOscZeta(0.15);
      setOscDriveRatio(0.95);
    } else if (mode === "relativity") {
      setRelBeta(0.8);
      setRelProperYr(4.0);
    } else {
      setLorenzRho(28.0);
      setLorenzSigma(10.0);
      setLorenzBeta(8 / 3);
      lorenzAzimuthRef.current = -Math.PI / 4;
    }
    setPlaying(true);
  };

  const handleSelectMode = (nextMode: LabMode) => {
    setMode(nextMode);
    pointerRef.current = null;
    lorenzDragLastNxRef.current = null;
    setProbeReadout(null);
  };

  const updatePointerFromEvent = (
    e: React.PointerEvent<HTMLCanvasElement>,
    downOverride?: boolean
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const down = downOverride ?? (pointerRef.current?.down ?? false);
    pointerRef.current = { nx, ny, down };

    // Exact inverse Kepler orbital scrubbing: pointer angle around focal star is true anomaly ν → exact M
    if (mode === "orbit" && down) {
      const w = Math.max(260, rect.width);
      const h = Math.max(200, rect.height);
      const cx = w * 0.52;
      const cy = h * 0.5;
      const maxOrbitPx = Math.min(w * 0.37, h * 0.41);
      const scalePxPerAU =
        maxOrbitPx / Math.max(semiMajorAU * (1 + eccentricity * 0.55), 0.7);
      const cPx = semiMajorAU * scalePxPerAU * eccentricity;
      const starX = cx + cPx * 0.55;
      const starY = cy;
      const dx = nx * w - starX;
      const dy = -(ny * h - starY); // upward +y matches prograde CCW orbital plane
      const trueAnomaly = Math.atan2(dy, dx);
      const meanAnomaly = trueAnomalyToMeanAnomaly(trueAnomaly, eccentricity);
      phaseRef.current = meanAnomaly / 0.85;
    }

    // Direct 3D azimuth rotation when dragging inside Lorenz strange attractor
    if (mode === "lorenz") {
      if (down) {
        if (lorenzDragLastNxRef.current !== null) {
          lorenzAzimuthRef.current += (nx - lorenzDragLastNxRef.current) * Math.PI * 2.2;
        }
        lorenzDragLastNxRef.current = nx;
      } else {
        lorenzDragLastNxRef.current = null;
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let rafId = 0;
    let lastTs = performance.now();

    // Cache interactive Schwarzschild geodesic across frames while impact parameter stays constant
    let cachedImpactKey = Number.NaN;
    let cachedLaserGeodesic: SchwarzschildGeodesicResult | null = null;

    const drawFrame = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - lastTs) / 1000));
      lastTs = now;

      const ptr = pointerRef.current;
      const scrubbingOrbit = mode === "orbit" && ptr?.down;

      if (playing && !reducedMotion && !scrubbingOrbit) {
        phaseRef.current = Math.max(0, phaseRef.current + dt);
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(260, Math.round(rect.width));
      const height = Math.max(200, Math.round(rect.height));

      if (
        canvas.width !== Math.round(width * dpr) ||
        canvas.height !== Math.round(height * dpr)
      ) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Live CSS tokens so Light/Dark and Aurora/Emerald stay exact
      const rootStyles = getComputedStyle(document.documentElement);
      const bgColor = rootStyles.getPropertyValue("--color-bg-deep").trim() || "#0f1416";
      const inkPrimary =
        rootStyles.getPropertyValue("--color-text-primary").trim() || "#edf2f5";
      const inkMuted =
        rootStyles.getPropertyValue("--color-text-tertiary").trim() || "#7c8b94";
      const accent =
        rootStyles.getPropertyValue("--color-accent-purple").trim() || "#c84b24";
      const isDark = document.documentElement.dataset.colorScheme === "dark";
      const gridLine = isDark
        ? "rgba(237, 242, 245, 0.065)"
        : "rgba(17, 22, 27, 0.065)";
      const axisLine = isDark
        ? "rgba(237, 242, 245, 0.2)"
        : "rgba(17, 22, 27, 0.2)";

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      // Calibrated 28px optical bench grid
      ctx.strokeStyle = gridLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 28; x < width; x += 28) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = 28; y < height; y += 28) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();

      const t = phaseRef.current;
      let nextProbeText: string | null = null;
      let currentQuantumMeanU = 0.5;
      let nextOrbitSync: typeof liveOrbit | null = null;
      let nextQuantumSync: typeof liveQuantum | null = null;
      let nextLorenzSep: number | null = null;

      if (mode === "slit") {
        const barrierX = Math.round(width * 0.22);
        const screenX = Math.round(width * 0.76);
        const centerY = height / 2;
        const slitHalfGap = 11 + slitSepMm * 22;
        const waveStepPx = 10 + ((wavelengthNm - 380) / 370) * 14;
        const waveColor = slitMetrics.spectralHex;

        // Incoming coherent plane wavefronts
        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.26)"
          : "rgba(17, 22, 27, 0.22)";
        ctx.lineWidth = 1.2;
        const planeOffset = (((t * 36) % waveStepPx) + waveStepPx) % waveStepPx;
        for (let x = planeOffset; x < barrierX - 6; x += waveStepPx) {
          ctx.beginPath();
          ctx.moveTo(x, 20);
          ctx.lineTo(x, height - 20);
          ctx.stroke();
        }

        // Propagating circular Huygens wave fronts
        ctx.save();
        ctx.beginPath();
        ctx.rect(barrierX, 8, screenX - barrierX, height - 16);
        ctx.clip();

        const maxRadius = Math.hypot(screenX - barrierX, height);
        const radialOffset = (((t * 42) % waveStepPx) + waveStepPx) % waveStepPx;
        ctx.strokeStyle = waveColor;
        ctx.lineWidth = 1.3;

        for (const slitY of [centerY - slitHalfGap, centerY + slitHalfGap]) {
          for (let r = radialOffset; r < maxRadius; r += waveStepPx) {
            if (r <= 0.5) continue;
            const alpha = Math.max(0.08, 0.54 * (1 - r / maxRadius));
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(barrierX, slitY, r, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
          }
        }
        ctx.restore();
        ctx.globalAlpha = 1;

        // Optical barrier plate with apertures scaled proportionally to slit width a
        ctx.strokeStyle = inkPrimary;
        ctx.lineWidth = 2.5;
        const slitAperturePx = Math.max(2.5, Math.min(9, slitWidthMm * 44));
        ctx.beginPath();
        ctx.moveTo(barrierX, 14);
        ctx.lineTo(barrierX, centerY - slitHalfGap - slitAperturePx);
        ctx.moveTo(barrierX, centerY - slitHalfGap + slitAperturePx);
        ctx.lineTo(barrierX, centerY + slitHalfGap - slitAperturePx);
        ctx.moveTo(barrierX, centerY + slitHalfGap + slitAperturePx);
        ctx.lineTo(barrierX, height - 26);
        ctx.stroke();

        // Detector screen axis
        ctx.strokeStyle = axisLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenX + 0.5, 14);
        ctx.lineTo(screenX + 0.5, height - 14);
        ctx.stroke();

        const curveMaxWidth = Math.max(42, width - screenX - 18);
        const screenHalfSpanMm = 7.5;
        const pyToScreenMm = (py: number) => ((centerY - py) / (height / 2)) * screenHalfSpanMm;

        // Calibrated mm scale ticks on detector screen (+5, 0, -5 mm)
        ctx.save();
        ctx.direction = "ltr";
        ctx.font = "9px ui-monospace, SFMono-Regular, monospace";
        ctx.fillStyle = inkMuted;
        ctx.textAlign = "right";
        for (const mmTick of [-5, 0, 5]) {
          const ty = centerY - (mmTick / screenHalfSpanMm) * (height / 2);
          if (ty > 18 && ty < height - 22) {
            ctx.strokeStyle = axisLine;
            ctx.beginPath();
            ctx.moveTo(screenX - 6, ty + 0.5);
            ctx.lineTo(screenX, ty + 0.5);
            ctx.stroke();
            ctx.fillText(mmTick === 0 ? "0" : `${mmTick > 0 ? "+" : ""}${mmTick}`, screenX - 8, ty + 3);
          }
        }
        ctx.restore();

        // Exact Fraunhofer single-slit diffraction envelope sinc²(β) dashed guide
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.34)"
          : "rgba(17, 22, 27, 0.32)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let py = 16; py <= height - 16; py += 2) {
          const screenMm = pyToScreenMm(py);
          const probe = probeDoubleSlitExact(screenMm, wavelengthNm, slitSepMm, 1.5, slitWidthMm);
          const px = screenX + probe.envelope * curveMaxWidth;
          if (py === 16) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // Exact non-paraxial Huygens-Fresnel superposition curve
        ctx.beginPath();
        for (let py = 16; py <= height - 16; py += 1.5) {
          const screenMm = pyToScreenMm(py);
          const probe = probeDoubleSlitExact(screenMm, wavelengthNm, slitSepMm, 1.5, slitWidthMm);
          const px = screenX + probe.intensity * curveMaxWidth;
          if (py === 16) ctx.moveTo(screenX, py);
          ctx.lineTo(px, py);
        }
        ctx.lineTo(screenX, height - 16);
        ctx.closePath();
        ctx.fillStyle = waveColor;
        ctx.globalAlpha = isDark ? 0.24 : 0.18;
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = waveColor;
        ctx.lineWidth = 1.75;
        ctx.stroke();

        // Crisp detector fringe strip
        for (let py = 16; py <= height - 16; py += 2) {
          const screenMm = pyToScreenMm(py);
          const probe = probeDoubleSlitExact(screenMm, wavelengthNm, slitSepMm, 1.5, slitWidthMm);
          ctx.fillStyle = waveColor;
          ctx.globalAlpha = probe.intensity * 0.94;
          ctx.fillRect(screenX - 3, py, 3, 2);
        }
        ctx.globalAlpha = 1;

        // Interactive Non-Paraxial Optical Probe on hover
        if (ptr) {
          const py = Math.min(height - 18, Math.max(18, ptr.ny * height));
          const screenMm = pyToScreenMm(py);
          const probe = probeDoubleSlitExact(screenMm, wavelengthNm, slitSepMm, 1.5, slitWidthMm);
          const px = screenX + probe.intensity * curveMaxWidth;

          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(barrierX, centerY - slitHalfGap);
          ctx.lineTo(screenX, py);
          ctx.moveTo(barrierX, centerY + slitHalfGap);
          ctx.lineTo(screenX, py);
          ctx.moveTo(screenX, py);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          const signStr = screenMm >= 0 ? "+" : "";
          nextProbeText = `y=${signStr}${screenMm.toFixed(2)}mm · Δr=${probe.pathDiffNm >= 0 ? "+" : ""}${Math.round(probe.pathDiffNm)}nm (${probe.orderM.toFixed(2)}λ) · I/I₀=${probe.intensity.toFixed(3)}`;
        }
      } else if (mode === "orbit") {
        const cx = width * 0.52;
        const cy = height * 0.5;
        const maxOrbitPx = Math.min(width * 0.37, height * 0.41);
        const scalePxPerAU =
          maxOrbitPx / Math.max(semiMajorAU * (1 + eccentricity * 0.55), 0.7);
        const aPx = semiMajorAU * scalePxPerAU;
        const bPx = aPx * Math.sqrt(Math.max(0.01, 1 - eccentricity * eccentricity));
        const cPx = aPx * eccentricity;
        const ellipseCenterX = cx - cPx * 0.45;
        const starX = ellipseCenterX + cPx;
        const starY = cy;

        // Crosshair axes through focal star
        ctx.strokeStyle = axisLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, starY + 0.5);
        ctx.lineTo(width - 16, starY + 0.5);
        ctx.moveTo(starX + 0.5, 16);
        ctx.lineTo(starX + 0.5, height - 16);
        ctx.stroke();

        // Perihelion / aphelion & empty focus markers
        const periX = ellipseCenterX + aPx;
        const aphX = ellipseCenterX - aPx;
        const emptyFocusX = ellipseCenterX - cPx;
        ctx.fillStyle = inkMuted;
        ctx.beginPath();
        ctx.arc(periX, cy, 2.3, 0, Math.PI * 2);
        ctx.arc(aphX, cy, 2.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = axisLine;
        ctx.beginPath();
        ctx.arc(emptyFocusX, cy, 3, 0, Math.PI * 2);
        ctx.stroke();

        // Orbital ellipse path
        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.38)"
          : "rgba(17, 22, 27, 0.34)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(ellipseCenterX, cy, aPx, bPx, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Mean anomaly progresses at constant angular rate (Kepler's 2nd Law exact!)
        const meanAnomaly = (t * 0.85) % (Math.PI * 2);
        const current = computeKeplerOrbit(semiMajorAU, eccentricity, meanAnomaly);

        // Shaded equal-area sector swept over ΔM = 0.48 rad (prograde CCW astronomical view)
        ctx.beginPath();
        ctx.moveTo(starX, starY);
        const sweepSteps = 28;
        for (let i = 0; i <= sweepSteps; i++) {
          const m = meanAnomaly - 0.48 + (0.48 * i) / sweepSteps;
          const pt = computeKeplerOrbit(semiMajorAU, eccentricity, m);
          ctx.lineTo(starX + pt.xAU * scalePxPerAU, starY - pt.yAU * scalePxPerAU);
        }
        ctx.closePath();
        ctx.fillStyle = accent;
        ctx.globalAlpha = isDark ? 0.22 : 0.16;
        ctx.fill();
        ctx.globalAlpha = 1;

        const planetX = starX + current.xAU * scalePxPerAU;
        const planetY = starY - current.yAU * scalePxPerAU;

        // Radius vector from star to planet
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(starX, starY);
        ctx.lineTo(planetX, planetY);
        ctx.stroke();

        // EXACT analytic velocity tangent vector (vxKmS, -vyKmS in screen coords) scaled by speed
        const vNorm = Math.hypot(current.vxKmS, current.vyKmS) || 1;
        const ux = current.vxKmS / vNorm;
        const uy = -current.vyKmS / vNorm;
        const arrowLen = Math.min(58, Math.max(16, current.speedKmS * 0.82));
        const tipX = planetX + ux * arrowLen;
        const tipY = planetY + uy * arrowLen;
        ctx.strokeStyle = inkPrimary;
        ctx.lineWidth = 1.65;
        ctx.beginPath();
        ctx.moveTo(planetX, planetY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Crisp arrowhead
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - ux * 6 - uy * 3.5, tipY - uy * 6 + ux * 3.5);
        ctx.lineTo(tipX - ux * 6 + uy * 3.5, tipY - uy * 6 - ux * 3.5);
        ctx.closePath();
        ctx.fillStyle = inkPrimary;
        ctx.fill();

        // Focal star
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(starX, starY, 6.5, 0, Math.PI * 2);
        ctx.fill();

        // Orbiting body
        ctx.fillStyle = inkPrimary;
        ctx.beginPath();
        ctx.arc(planetX, planetY, 5, 0, Math.PI * 2);
        ctx.fill();

        // Micro apsis annotations
        ctx.save();
        ctx.direction = "ltr";
        ctx.font = "10px ui-monospace, SFMono-Regular, monospace";
        ctx.fillStyle = inkMuted;
        ctx.textAlign = "left";
        if (periX + 6 < width - 24) ctx.fillText("rₚ", periX + 6, cy - 5);
        ctx.textAlign = "right";
        if (aphX - 6 > 24) ctx.fillText("rₐ", aphX - 6, cy - 5);
        ctx.restore();

        if (ptr) {
          const nuDeg = ((current.trueAnomalyRad * 180) / Math.PI + 360) % 360;
          nextProbeText = `ν=${nuDeg.toFixed(1)}° · r=${current.radiusAU.toFixed(3)}AU · v=${current.speedKmS.toFixed(2)}km/s · γ=${current.flightPathDeg >= 0 ? "+" : ""}${current.flightPathDeg.toFixed(1)}°`;
        }

        nextOrbitSync = {
          speedKmS: current.speedKmS,
          radiusAU: current.radiusAU,
          flightPathDeg: current.flightPathDeg,
          perihelionAU: current.perihelionAU,
          aphelionAU: current.aphelionAU,
        };
      } else if (mode === "horizon") {
        const cx = width * 0.54;
        const cy = height * 0.5;
        // Scale Schwarzschild radius cleanly so both photon sphere (1.5 r_s) and ISCO (3.0 r_s) fit crisply
        const rsPx = Math.min(height * 0.135, 13 + (solarMasses / 65) * 18);
        const photonPx = rsPx * 1.5;
        const iscoPx = rsPx * 3.0;

        // Concentric exact relativistic surfaces: ISCO (3 r_s) & outer gravitational reference (5 r_s)
        ctx.save();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.22)"
          : "rgba(17, 22, 27, 0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, iscoPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.08)"
          : "rgba(17, 22, 27, 0.08)";
        ctx.beginPath();
        ctx.arc(cx, cy, rsPx * 5.0, 0, Math.PI * 2);
        ctx.stroke();

        // Photon sphere dashed circle (r = 1.5 r_s)
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(cx, cy, photonPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Micro surface tags positioned on distinct axes so they never overlap at any mass
        ctx.save();
        ctx.direction = "ltr";
        ctx.textAlign = "left";
        ctx.font = "9.5px ui-monospace, SFMono-Regular, monospace";
        ctx.fillStyle = accent;
        ctx.fillText("1.5rₛ", cx + 6, cy - photonPx - 4);
        ctx.fillStyle = inkMuted;
        ctx.fillText("ISCO 3rₛ", cx + iscoPx * 0.74 + 5, cy + iscoPx * 0.74 + 4);
        ctx.restore();

        // Helper to draw an exact RK4 Schwarzschild geodesic polyline + travelling photon pulse
        const drawGeodesic = (
          geo: SchwarzschildGeodesicResult,
          strokeColor: string,
          lineWidth: number,
          pulsePhase: number,
          pulseRadius: number
        ) => {
          const pts = geo.points;
          if (pts.length < 2) return;
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            const x = cx + pts[i].xRs * rsPx;
            const y = cy - pts[i].yRs * rsPx;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.stroke();

          // Travelling photon pulse along exact geodesic arc
          const idxFloat = (((pulsePhase % 1) + 1) % 1) * (pts.length - 1);
          const idx0 = Math.floor(idxFloat);
          const idx1 = Math.min(pts.length - 1, idx0 + 1);
          const frac = idxFloat - idx0;
          const px = cx + (pts[idx0].xRs + (pts[idx1].xRs - pts[idx0].xRs) * frac) * rsPx;
          const py = cy - (pts[idx0].yRs + (pts[idx1].yRs - pts[idx0].yRs) * frac) * rsPx;
          ctx.fillStyle = strokeColor;
          ctx.beginPath();
          ctx.arc(px, py, pulseRadius, 0, Math.PI * 2);
          ctx.fill();
        };

        // Render ambient exact RK4 deflected null geodesics
        const ambientColor = isDark
          ? "rgba(237, 242, 245, 0.28)"
          : "rgba(17, 22, 27, 0.28)";
        ambientGeodesics.forEach((geo, idx) => {
          drawGeodesic(geo, ambientColor, 1.1, t * 0.34 + idx * 0.17, 2.2);
        });

        // Critical photon capture shadow boundaries ±b_crit = ±(3√3/2) r_s on incoming left bench
        const bCritOffsetPx = CRITICAL_IMPACT_RS * rsPx;
        ctx.save();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = isDark ? "rgba(220, 38, 38, 0.32)" : "rgba(220, 38, 38, 0.28)";
        ctx.lineWidth = 1;
        for (const sgn of [-1, 1]) {
          const by = cy + sgn * bCritOffsetPx;
          if (by > 10 && by < height - 10) {
            ctx.beginPath();
            ctx.moveTo(10, by + 0.5);
            ctx.lineTo(cx - rsPx * 2.2, by + 0.5);
            ctx.stroke();
          }
        }
        ctx.restore();

        // Interactive User-Aimed Test Laser Photon:
        // Defaults to b = 2.66 r_s (just outside b_crit = 2.598 r_s) so strong-field lensing >120° is immediately visible!
        const aimY = ptr
          ? Math.min(height - 14, Math.max(14, ptr.ny * height))
          : cy - rsPx * 2.68;
        // Convert screen offset to signed physical impact parameter b / r_s (positive above horizon)
        const rawSignedImpact = (cy - aimY) / rsPx;
        const signedImpactRs =
          Math.abs(rawSignedImpact) < 0.3
            ? rawSignedImpact >= 0
              ? 0.3
              : -0.3
            : rawSignedImpact;
        const quantKey = Math.round(signedImpactRs * 250);
        if (quantKey !== cachedImpactKey || !cachedLaserGeodesic) {
          cachedImpactKey = quantKey;
          cachedLaserGeodesic = traceSchwarzschildGeodesic(signedImpactRs, {
            rViewRs: Math.max(16, Math.ceil((width * 0.65) / rsPx)),
            maxSteps: 4800,
            stepRad: 0.009,
          });
        }

        const laserGeo = cachedLaserGeodesic;
        const laserColor = laserGeo.captured ? "#dc2626" : accent;
        drawGeodesic(laserGeo, laserColor, 2.1, t * 0.45, 4);

        // Laser emitter notch aligned to asymptotic impact parameter b on left edge
        const emitterY = Math.min(height - 10, Math.max(10, cy - signedImpactRs * rsPx));
        ctx.fillStyle = laserColor;
        ctx.fillRect(8, emitterY - 3, 8, 6);

        // Matte Schwarzschild event horizon disk (r = r_s)
        ctx.fillStyle = isDark ? "#050708" : "#11161b";
        ctx.beginPath();
        ctx.arc(cx, cy, rsPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = inkPrimary;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Always show live RK4 laser telemetry when pointer is on canvas
        if (ptr) {
          nextProbeText = laserGeo.captured
            ? `b=${laserGeo.impactParamRs.toFixed(3)}rₛ < ${CRITICAL_IMPACT_RS.toFixed(3)}rₛ · CAPTURED AT r=rₛ`
            : `b=${laserGeo.impactParamRs.toFixed(3)}rₛ · Δφ=${laserGeo.deflectionDeg.toFixed(1)}° · r_min=${laserGeo.closestApproachRs.toFixed(2)}rₛ`;
        }
      } else if (mode === "quantum") {
        // Experiment 4: Exact 1D Infinite Quantum Potential Well Superposition |ψ(x, t)|²
        const padX = 44;
        const wellLeft = padX;
        const wellRight = width - padX;
        const wellWidth = wellRight - wellLeft;
        const baseY = Math.round(height * 0.78);
        const topY = 24;
        const usableH = baseY - topY;
        const phaseT = t * 1.35;

        // Infinite potential barrier walls (x = 0 and x = L)
        ctx.strokeStyle = inkPrimary;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(wellLeft, topY);
        ctx.lineTo(wellLeft, baseY);
        ctx.lineTo(wellRight, baseY);
        ctx.lineTo(wellRight, topY);
        ctx.stroke();

        // Midline axis for Re(ψ) and Im(ψ)
        const waveMidY = topY + usableH * 0.56;
        ctx.strokeStyle = axisLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wellLeft, waveMidY + 0.5);
        ctx.lineTo(wellRight, waveMidY + 0.5);
        ctx.stroke();

        // Probability density |ψ(x, t)|² filled area & crisp curve
        const samples = 180;
        const probScale = usableH * 0.24;
        ctx.beginPath();
        ctx.moveTo(wellLeft, baseY);
        for (let i = 0; i <= samples; i++) {
          const u = i / samples;
          const s = sampleQuantumSuperposition(u, quantumN1, quantumN2, phaseT);
          const x = wellLeft + u * wellWidth;
          const y = baseY - Math.min(usableH - 6, s.probDensity * probScale);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(wellRight, baseY);
        ctx.closePath();
        ctx.fillStyle = accent;
        ctx.globalAlpha = isDark ? 0.24 : 0.18;
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
          const u = i / samples;
          const s = sampleQuantumSuperposition(u, quantumN1, quantumN2, phaseT);
          const x = wellLeft + u * wellWidth;
          const y = baseY - Math.min(usableH - 6, s.probDensity * probScale);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Imaginary part Im(ψ(x, t)) subtle dashed hairline
        const ampScale = usableH * 0.22;
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.3)"
          : "rgba(17, 22, 27, 0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
          const u = i / samples;
          const s = sampleQuantumSuperposition(u, quantumN1, quantumN2, phaseT);
          const x = wellLeft + u * wellWidth;
          const y = waveMidY - s.imag * ampScale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // Real part Re(ψ(x, t)) crisp hairline
        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.78)"
          : "rgba(17, 22, 27, 0.7)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
          const u = i / samples;
          const s = sampleQuantumSuperposition(u, quantumN1, quantumN2, phaseT);
          const x = wellLeft + u * wellWidth;
          const y = waveMidY - s.real * ampScale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // EXACT analytical <x(t)> and ±σ_x(t) uncertainty bracket along bottom rail
        const exactObs = computeQuantumObservables(quantumN1, quantumN2, phaseT);
        currentQuantumMeanU = exactObs.meanU;
        const meanX = wellLeft + exactObs.meanU * wellWidth;
        const leftSigmaX = Math.max(wellLeft, wellLeft + (exactObs.meanU - exactObs.sigmaU) * wellWidth);
        const rightSigmaX = Math.min(wellRight, wellLeft + (exactObs.meanU + exactObs.sigmaU) * wellWidth);

        // ±σ_x horizontal uncertainty bar
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(leftSigmaX, baseY + 6);
        ctx.lineTo(rightSigmaX, baseY + 6);
        ctx.moveTo(leftSigmaX, baseY + 3);
        ctx.lineTo(leftSigmaX, baseY + 9);
        ctx.moveTo(rightSigmaX, baseY + 3);
        ctx.lineTo(rightSigmaX, baseY + 9);
        ctx.stroke();

        // Exact <x> triangle pointer
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(meanX, baseY + 1);
        ctx.lineTo(meanX - 4.5, baseY + 9);
        ctx.lineTo(meanX + 4.5, baseY + 9);
        ctx.closePath();
        ctx.fill();

        nextQuantumSync = {
          meanU: exactObs.meanU,
          sigmaU: exactObs.sigmaU,
          heisenbergHbar: exactObs.heisenbergProductHbar,
        };

        // Interactive Quantum Position Probe on hover
        if (ptr) {
          const px = Math.min(wellRight, Math.max(wellLeft, ptr.nx * width));
          const u = (px - wellLeft) / wellWidth;
          const s = sampleQuantumSuperposition(u, quantumN1, quantumN2, phaseT);
          const py = baseY - Math.min(usableH - 6, s.probDensity * probScale);

          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = inkPrimary;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, topY);
          ctx.lineTo(px, baseY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = inkPrimary;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          nextProbeText = `x=${(u * wellWidthNm).toFixed(3)}nm · |ψ|²=${s.probDensity.toFixed(3)} · Re=${s.real.toFixed(2)} · ⟨p⟩=${exactObs.meanPHbarOverL >= 0 ? "+" : ""}${exactObs.meanPHbarOverL.toFixed(2)}ħ/L`;
        }
      } else if (mode === "planck") {
        nextProbeText = drawPlanckCanvas(
          ctx,
          { width, height, t, isDark, inkPrimary, inkMuted, accent, axisLine, ptr },
          planckTempK,
          planckEmissivity,
          planckMetrics
        );
      } else if (mode === "oscillator") {
        const res = drawOscillatorCanvas(
          ctx,
          { width, height, t, isDark, inkPrimary, inkMuted, accent, axisLine, ptr },
          oscMetrics,
          oscTrajectory
        );
        nextProbeText = res.probeText;
      } else if (mode === "relativity") {
        nextProbeText = drawRelativityCanvas(
          ctx,
          { width, height, t, isDark, inkPrimary, inkMuted, accent, axisLine, ptr },
          relMetrics
        );
      } else if (mode === "lorenz" && lorenzResult) {
        const azimuth =
          lorenzAzimuthRef.current +
          (playing && !reducedMotion && !ptr?.down ? t * 0.14 : 0);
        const res = drawLorenzCanvas(
          ctx,
          { width, height, t, isDark, inkPrimary, inkMuted, accent, axisLine, ptr },
          lorenzResult,
          azimuth
        );
        nextProbeText = res.probeText;
        nextLorenzSep = res.liveSeparation;
      }

      // Unified throttled UI telemetry sync (~10Hz) across all 8 instruments
      if (now - lastUiSyncRef.current > 95) {
        lastUiSyncRef.current = now;
        setProbeReadout(nextProbeText);
        if (nextOrbitSync) setLiveOrbit(nextOrbitSync);
        if (nextQuantumSync) setLiveQuantum(nextQuantumSync);
        if (nextLorenzSep !== null) setLiveLorenzSep(nextLorenzSep);
      }

      // Calibration corner ruler marks (always LTR so units never clip on RTL pages)
      ctx.save();
      ctx.direction = "ltr";
      ctx.textAlign = "left";
      ctx.fillStyle = inkMuted;
      ctx.font = "11px ui-monospace, SFMono-Regular, monospace";
      const lorenzBetaStr = Math.abs(lorenzBeta - 8 / 3) < 0.004 ? "8/3" : lorenzBeta.toFixed(2);
      const tag =
        mode === "slit"
          ? `λ=${wavelengthNm}nm  d=${slitSepMm.toFixed(2)}mm  a=${slitMetrics.slitWidthMm.toFixed(3)}mm`
          : mode === "orbit"
            ? `e=${eccentricity.toFixed(3)}  a=${semiMajorAU.toFixed(3)}AU  ε=${orbitReference.specificEnergyKm2S2.toFixed(1)}km²/s²`
            : mode === "horizon"
              ? `M=${solarMasses.toFixed(1)}M☉  rₛ=${horizonMetrics.schwarzschildKm.toFixed(2)}km  b_crit=${horizonMetrics.criticalImpactKm.toFixed(1)}km`
              : mode === "quantum"
                ? `n₁=${quantumN1}  n₂=${quantumN2}  L=${wellWidthNm.toFixed(2)}nm  ⟨x⟩=${(currentQuantumMeanU * wellWidthNm).toFixed(2)}nm`
                : mode === "planck"
                  ? `T=${planckTempK}K  ε=${planckEmissivity.toFixed(2)}  λₚ=${planckMetrics.peakWavelengthNm.toFixed(1)}nm  j*=${planckMetrics.totalFluxMWm2.toFixed(2)}MW/m²`
                  : mode === "oscillator"
                    ? `f₀=${oscFreqHz.toFixed(2)}Hz  ζ=${oscZeta.toFixed(2)}  ω/ω₀=${oscDriveRatio.toFixed(2)}  Q=${oscMetrics.qualityFactorQ.toFixed(2)}`
                    : mode === "relativity"
                      ? `β=${relBeta.toFixed(3)}c  γ=${relMetrics.gamma.toFixed(3)}  η=${relMetrics.rapidity.toFixed(3)}  L/L₀=${(relMetrics.contractionRatio * 100).toFixed(1)}%`
                      : `σ=${lorenzSigma.toFixed(1)}  ρ=${lorenzRho.toFixed(1)}  β=${lorenzBetaStr}  λ₁=${(lorenzResult?.metrics.lyapunovMax ?? 0).toFixed(3)}  D_KY=${(lorenzResult?.metrics.kaplanYorkeDim ?? 0).toFixed(2)}`;
      ctx.fillText(tag, 12, height - 10);
      ctx.restore();

      if (playing && !reducedMotion) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafId);
  }, [
    mode,
    playing,
    expanded,
    wavelengthNm,
    slitSepMm,
    slitWidthMm,
    slitMetrics.slitWidthMm,
    slitMetrics.spectralHex,
    eccentricity,
    semiMajorAU,
    orbitReference.specificEnergyKm2S2,
    solarMasses,
    horizonMetrics.schwarzschildKm,
    horizonMetrics.criticalImpactKm,
    ambientGeodesics,
    quantumN1,
    quantumN2,
    wellWidthNm,
    planckTempK,
    planckEmissivity,
    planckMetrics,
    oscFreqHz,
    oscZeta,
    oscDriveRatio,
    oscMetrics,
    oscTrajectory,
    relBeta,
    relMetrics,
    lorenzSigma,
    lorenzRho,
    lorenzBeta,
    lorenzResult,
  ]);

  const tabs: { id: LabMode; icon: typeof Waves; labelFa: string; labelEn: string }[] = [
    { id: "slit", icon: Waves, labelFa: "تداخل دو شکاف", labelEn: "Double-slit" },
    { id: "orbit", icon: Orbit, labelFa: "مدار کپلری", labelEn: "Kepler orbit" },
    { id: "horizon", icon: CircleDot, labelFa: "افق نسبیتی", labelEn: "Event horizon" },
    { id: "quantum", icon: Atom, labelFa: "چاه کوانتومی", labelEn: "Quantum well" },
    { id: "planck", icon: Flame, labelFa: "جسم سیاه", labelEn: "Blackbody" },
    { id: "oscillator", icon: Activity, labelFa: "نوسان تشدید", labelEn: "Resonance" },
    { id: "relativity", icon: Compass, labelFa: "نسبیت خاص", labelEn: "Relativity" },
    { id: "lorenz", icon: InfinityIcon, labelFa: "آشوب لورنتس", labelEn: "Lorenz chaos" },
  ];

  const activeTabIndex = Math.max(
    1,
    tabs.findIndex((item) => item.id === mode) + 1
  );

  const probeHint =
    mode === "slit"
      ? isFa
        ? "حرکت نشانگر برای سنجش دقیق Δr و I/I₀"
        : "Move pointer to probe exact Δr & I/I₀"
      : mode === "orbit"
        ? isFa
          ? "بکشید تا سیاره را روی مدار دقیق حرکت دهید"
          : "Drag canvas to scrub orbital phase"
        : mode === "horizon"
          ? isFa
            ? "حرکت عمودی نشانگر برای شلیک لیزر فوتونی RK4"
            : "Move vertically to aim exact RK4 photon beam"
          : mode === "quantum"
            ? isFa
              ? "حرکت نشانگر برای سنجش |ψ(x)|²، Re و Im"
              : "Move pointer to sample |ψ(x)|², Re & Im"
            : mode === "planck"
              ? isFa
                ? "حرکت نشانگر روی طیف برای سنجش دقیق B_λ و نسبت کوانتومی"
                : "Move pointer along λ to probe B_λ & UV suppression"
              : mode === "oscillator"
                ? isFa
                  ? "حرکت نشانگر روی نمودار بود برای سنجش بهره dB و اختلاف فاز δ"
                  : "Hover Bode curve to probe exact gain (dB) & phase lag δ"
                : mode === "relativity"
                  ? isFa
                    ? "حرکت نشانگر روی نمودار مینکوفسکی برای تبدیل دقیق لورنتس"
                    : "Hover Minkowski spacetime to Lorentz-transform (x, ct) → (x', ct')"
                  : isFa
                    ? "بکشید برای چرخش سه‌بعدی جاذب و مشاهده واگرایی دوقلو"
                    : "Drag horizontally to orbit 3D attractor & inspect twin divergence";

  const solverBadge =
    mode === "slit"
      ? "HUYGENS-FRESNEL · CODATA 2022"
      : mode === "orbit"
        ? "HALLEY <10⁻¹⁴ · IAU 2015"
        : mode === "horizon"
          ? "RK4 SCHWARZSCHILD · CARDANO"
          : mode === "quantum"
            ? "ANALYTIC ħ · EHRENFEST"
            : mode === "planck"
              ? "CIE 1931 + SIMPSON · CODATA 2022"
              : mode === "oscillator"
                ? "RK4 + BODE ANALYTIC · EXACT"
                : mode === "relativity"
                  ? "MINKOWSKI · EXACT SI c"
                  : "12D RK4 BENETTIN · D_KY";

  return (
    <div
      id="kinetic-bench"
      className="overflow-hidden rounded-t-2xl border border-b-0 border-(--color-border-strong) bg-(--color-bg-elevated) shadow-[0_-10px_32px_rgba(15,20,22,0.08)]"
    >
      {/* Top instrument header bar — Row 1: Title & Playback Controls */}
      <div className="flex items-center justify-between gap-3 border-b border-(--color-border-subtle) px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 text-xs text-(--color-text-tertiary)">
          <span
            dir="ltr"
            className="shrink-0 font-[family-name:var(--font-mono)] font-medium text-(--color-accent-purple)"
          >
            01 / LAB
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate font-medium text-(--color-text-secondary)">
            {isFa ? "میز شبیه‌ساز دقیق فیزیک" : "Precision live physics bench"}
          </span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span
            dir="ltr"
            className="hidden shrink-0 font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-tertiary) sm:inline"
          >
            {String(activeTabIndex).padStart(2, "0")} / 08
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={
              playing
                ? isFa
                  ? "توقف شبیه‌سازی"
                  : "Pause simulation"
                : isFa
                  ? "ادامه شبیه‌سازی"
                  : "Play simulation"
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
          >
            {playing ? (
              <Pause className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : (
              <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            aria-label={isFa ? "بازنشانی پارامترها" : "Reset parameters"}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            data-kinetic-expand
            aria-pressed={expanded}
            aria-label={
              expanded
                ? isFa
                  ? "نمای استاندارد آزمایشگاه"
                  : "Standard lab view"
                : isFa
                  ? "گسترش نمای آزمایشگاه"
                  : "Expand lab view"
            }
            className="hidden h-8 w-8 items-center justify-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) lg:flex"
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {/* Row 2: Precision 8-Instrument Segmented Selector Rail */}
      <div className="border-b border-(--color-border-subtle) bg-(--color-bg-secondary)/60 px-3 py-2 sm:px-6">
        <div
          role="tablist"
          aria-label={isFa ? "انتخاب آزمایش زنده" : "Select physics experiment"}
          className="grid w-full grid-cols-2 gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-1 sm:grid-cols-4 xl:grid-cols-8"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-kinetic-tab={tab.id}
                onClick={() => handleSelectMode(tab.id)}
                className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-150 ${
                  active
                    ? "bg-(--color-bg-elevated) text-(--color-text-primary) shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{isFa ? tab.labelFa : tab.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main bench body: 7/5 split or expanded 12-col cinema bench */}
      <div
        className={`grid divide-y divide-(--color-border-subtle) ${
          expanded
            ? "grid-cols-1"
            : "lg:grid-cols-12 lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse"
        }`}
      >
        {/* Live Interactive Canvas Viewport */}
        <div className={`relative p-4 sm:p-5 ${expanded ? "" : "lg:col-span-7"}`}>
          <div
            className={`relative w-full overflow-hidden rounded-xl border border-(--color-border-subtle) ${
              expanded ? "h-[350px] sm:h-[400px]" : "h-[264px] sm:h-[304px]"
            }`}
          >
            <canvas
              ref={canvasRef}
              dir="ltr"
              onPointerMove={(e) => updatePointerFromEvent(e)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                updatePointerFromEvent(e, true);
              }}
              onPointerUp={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
                updatePointerFromEvent(e, false);
              }}
              onPointerLeave={() => {
                pointerRef.current = null;
                lorenzDragLastNxRef.current = null;
                setProbeReadout(null);
              }}
              aria-label={
                mode === "slit"
                  ? isFa
                    ? "شبیه‌سازی دقیق غیرپاراگزیال تداخل موج دو شکاف"
                    : "Exact non-paraxial double-slit wave interference simulation"
                  : mode === "orbit"
                    ? isFa
                      ? "شبیه‌سازی دقیق مدار بیضوی کپلر با حلگر هالی"
                      : "Machine-precision Keplerian elliptical orbit simulation"
                    : mode === "horizon"
                      ? isFa
                        ? "شبیه‌سازی دقیق ژئودزیک نور شوارتزشیلد با انتگرال‌گیر RK4"
                        : "Exact RK4 Schwarzschild null geodesic simulation"
                      : mode === "quantum"
                        ? isFa
                          ? "شبیه‌سازی دقیق برهم‌نهی موج کوانتومی و عدم قطعیت هایزنبرگ"
                          : "Exact 1D quantum potential well wavefunction & Heisenberg simulation"
                        : mode === "planck"
                          ? isFa
                            ? "شبیه‌سازی دقیق طیف تابش جسم سیاه پلانک و فاجعه فرابنفش"
                            : "Exact Planck blackbody radiation spectrum and Rayleigh-Jeans UV catastrophe"
                          : mode === "oscillator"
                            ? isFa
                              ? "شبیه‌سازی دقیق نوسانگر هماهنگ میرای واداشته، فضای فاز و منحنی تشدید بود"
                              : "Exact RK4 damped driven harmonic oscillator phase space and Bode resonance"
                            : mode === "relativity"
                              ? isFa
                                ? "شبیه‌سازی دقیق نمودار فضا-زمان مینکوفسکی، اتساع زمان و انقباض طول لورنتس"
                                : "Exact Minkowski spacetime diagram, Lorentz time dilation and length contraction"
                              : isFa
                                ? "شبیه‌سازی دقیق جاذب شگفت لورنتس و واگرایی آشوبی دوقلو با RK4"
                                : "Exact RK4 Lorenz strange attractor and twin-trajectory Lyapunov divergence"
              }
              className="block h-full w-full cursor-crosshair touch-none"
            />
          </div>

          {/* Interactive Pointer Telemetry & Solver Provenance Footer */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-(--color-text-tertiary)">
            <span className="inline-flex items-center gap-1.5">
              <Crosshair className="h-3.5 w-3.5 shrink-0 text-(--color-accent-purple)" strokeWidth={1.5} />
              {probeReadout ? (
                <span
                  dir="ltr"
                  className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                >
                  {probeReadout}
                </span>
              ) : (
                <span>{probeHint}</span>
              )}
            </span>
            <span dir="ltr" className="font-[family-name:var(--font-mono)] tabular-nums opacity-80">
              {solverBadge}
            </span>
          </div>
        </div>

        {/* Precision Controls, Curated Presets, Live KaTeX & Exact Readouts */}
        <div
          className={
            expanded
              ? "grid grid-cols-1 items-start gap-5 p-4 sm:p-5 lg:grid-cols-12"
              : "flex flex-col justify-between gap-4 p-4 sm:p-5 lg:col-span-5"
          }
        >
          <div className={expanded ? "space-y-3 lg:col-span-4" : "space-y-3"}>
            {/* Live Governing Equation Strip */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3.5 py-2.5">
              <span className="shrink-0 text-xs text-(--color-text-tertiary)">
                {mode === "slit"
                  ? isFa
                    ? "تداخل و پراش"
                    : "Interference"
                  : mode === "orbit"
                    ? isFa
                      ? "کپلر و ویس-ویوا"
                      : "Kepler law"
                    : mode === "horizon"
                      ? isFa
                        ? "ژئودزیک نوری"
                        : "Null geodesic"
                      : mode === "quantum"
                        ? isFa
                          ? "تراز و هایزنبرگ"
                          : "Eigen & ħ/2"
                        : mode === "planck"
                          ? isFa
                            ? "پلانک و استفان"
                            : "Planck law"
                          : mode === "oscillator"
                            ? isFa
                              ? "تشدید هماهنگ"
                              : "Driven ODE"
                            : mode === "relativity"
                              ? isFa
                                ? "لورنتس و مینکوفسکی"
                                : "Lorentz inv."
                              : isFa
                                ? "سامانه لورنتس"
                                : "Lorenz ODE"}
              </span>
              <div
                dir="ltr"
                className="overflow-x-auto text-xs text-(--color-text-primary) sm:text-[13px]"
                dangerouslySetInnerHTML={{ __html: renderedFormula }}
              />
            </div>

            {/* Curated Real-World Scientific Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              {mode === "slit" &&
                [
                  { labelFa: "بنفش ۴۰۵nm", labelEn: "Violet 405nm", wl: 405, d: 0.35, a: 0.07 },
                  { labelFa: "Nd:YAG ۵۳۲nm", labelEn: "Nd:YAG 532nm", wl: 532, d: 0.45, a: 0.09 },
                  { labelFa: "He-Ne ۶۳۳nm", labelEn: "He-Ne 633nm", wl: 633, d: 0.6, a: 0.12 },
                ].map((preset) => {
                  const active =
                    wavelengthNm === preset.wl &&
                    Math.abs(slitSepMm - preset.d) < 0.01 &&
                    Math.abs(slitWidthMm - preset.a) < 0.005;
                  return (
                    <button
                      key={preset.labelEn}
                      type="button"
                      onClick={() => {
                        setWavelengthNm(preset.wl);
                        setSlitSepMm(preset.d);
                        setSlitWidthMm(preset.a);
                      }}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-bg-deep)"
                          : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                      }`}
                    >
                      {isFa ? preset.labelFa : preset.labelEn}
                    </button>
                  );
                })}

              {mode === "orbit" &&
                [
                  { labelFa: "عطارد (۰.۲۰۶)", labelEn: "Mercury", e: 0.206, a: 0.387 },
                  { labelFa: "زمین (۰.۰۱۷)", labelEn: "Earth", e: 0.017, a: 1.0 },
                  { labelFa: "بیضوی شدید", labelEn: "Eccentric", e: 0.78, a: 2.1 },
                ].map((preset) => {
                  const active =
                    Math.abs(eccentricity - preset.e) < 0.005 &&
                    Math.abs(semiMajorAU - preset.a) < 0.02;
                  return (
                    <button
                      key={preset.labelEn}
                      type="button"
                      onClick={() => {
                        setEccentricity(preset.e);
                        setSemiMajorAU(preset.a);
                      }}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-bg-deep)"
                          : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                      }`}
                    >
                      {isFa ? preset.labelFa : preset.labelEn}
                    </button>
                  );
                })}

              {mode === "horizon" &&
                [
                  { labelFa: "ستاره‌ای ۵M☉", labelEn: "Stellar 5M☉", m: 5.0 },
                  { labelFa: "Cygnus X-1", labelEn: "Cygnus X-1", m: 21.2 },
                  { labelFa: "GW150914 (62M☉)", labelEn: "GW150914", m: 62.0 },
                ].map((preset) => {
                  const active = Math.abs(solarMasses - preset.m) < 0.1;
                  return (
                    <button
                      key={preset.labelEn}
                      type="button"
                      onClick={() => setSolarMasses(preset.m)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-bg-deep)"
                          : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                      }`}
                    >
                      {isFa ? preset.labelFa : preset.labelEn}
                    </button>
                  );
                })}

              {mode === "quantum" &&
                [
                  { labelFa: "پایه (۱+۱)", labelEn: "Ground (1+1)", a: 1, b: 1, L: 1.0 },
                  { labelFa: "نوسان (۱+۲)", labelEn: "Slosh (1+2)", a: 1, b: 2, L: 1.0 },
                  { labelFa: "تنفس (۱+۳)", labelEn: "Breathe (1+3)", a: 1, b: 3, L: 1.0 },
                ].map((preset) => {
                  const active =
                    quantumN1 === preset.a &&
                    quantumN2 === preset.b &&
                    Math.abs(wellWidthNm - preset.L) < 0.02;
                  return (
                    <button
                      key={preset.labelEn}
                      type="button"
                      onClick={() => {
                        setQuantumN1(preset.a);
                        setQuantumN2(preset.b);
                        setWellWidthNm(preset.L);
                      }}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-bg-deep)"
                          : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                      }`}
                    >
                      {isFa ? preset.labelFa : preset.labelEn}
                    </button>
                  );
                })}

              {mode === "planck" &&
                [
                  { labelFa: "تنگستن ۲۸۰۰K", labelEn: "Tungsten 2800K", T: 2800, eps: 0.35 },
                  { labelFa: "خورشید ۵۷۷۲K", labelEn: "Sun 5772K", T: 5772, eps: 1.0 },
                  { labelFa: "رجل‌الجبار ۱۱۰۰۰K", labelEn: "Rigel 11000K", T: 11000, eps: 1.0 },
                ].map((preset) => {
                  const active =
                    Math.abs(planckTempK - preset.T) < 25 &&
                    Math.abs(planckEmissivity - preset.eps) < 0.02;
                  return (
                    <button
                      key={preset.labelEn}
                      type="button"
                      onClick={() => {
                        setPlanckTempK(preset.T);
                        setPlanckEmissivity(preset.eps);
                      }}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-bg-deep)"
                          : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                      }`}
                    >
                      {isFa ? preset.labelFa : preset.labelEn}
                    </button>
                  );
                })}

              {mode === "oscillator" &&
                [
                  { labelFa: "تشدید تیز (Q=6.25)", labelEn: "Sharp Q=6.25", f: 1.5, z: 0.08, r: 0.99 },
                  { labelFa: "میرایی بحرانی", labelEn: "Critical ζ=1", f: 1.5, z: 1.0, r: 1.0 },
                  { labelFa: "فرامیرا (ζ=1.35)", labelEn: "Overdamped", f: 1.2, z: 1.35, r: 0.6 },
                ].map((preset) => {
                  const active =
                    Math.abs(oscFreqHz - preset.f) < 0.03 &&
                    Math.abs(oscZeta - preset.z) < 0.015 &&
                    Math.abs(oscDriveRatio - preset.r) < 0.015;
                  return (
                    <button
                      key={preset.labelEn}
                      type="button"
                      onClick={() => {
                        setOscFreqHz(preset.f);
                        setOscZeta(preset.z);
                        setOscDriveRatio(preset.r);
                      }}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-bg-deep)"
                          : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                      }`}
                    >
                      {isFa ? preset.labelFa : preset.labelEn}
                    </button>
                  );
                })}

              {mode === "relativity" &&
                [
                  { labelFa: "۰.۶۰c (γ=1.25)", labelEn: "0.60c (γ=1.25)", b: 0.6, tau: 4.0 },
                  { labelFa: "۰.۸۶۶c (اتساع ۲×)", labelEn: "0.866c (γ=2.00)", b: Math.sqrt(3) / 2, tau: 4.0 },
                  { labelFa: "میون کیهانی ۰.۹۹۵c", labelEn: "Muon 0.995c", b: 0.995, tau: 4.0 },
                ].map((preset) => {
                  const active = Math.abs(relBeta - preset.b) < 0.002;
                  return (
                    <button
                      key={preset.labelEn}
                      type="button"
                      onClick={() => {
                        setRelBeta(preset.b);
                        setRelProperYr(preset.tau);
                      }}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-bg-deep)"
                          : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                      }`}
                    >
                      {isFa ? preset.labelFa : preset.labelEn}
                    </button>
                  );
                })}

              {mode === "lorenz" &&
                [
                  { labelFa: "لورنتس کلاسیک", labelEn: "Classic ρ=28", s: 10.0, r: 28.0, b: 8 / 3 },
                  { labelFa: "مارپیچ پایدار", labelEn: "Stable ρ=15", s: 10.0, r: 15.0, b: 8 / 3 },
                  { labelFa: "آشوب عمیق ρ=40", labelEn: "Deep ρ=40", s: 10.0, r: 40.0, b: 8 / 3 },
                ].map((preset) => {
                  const active =
                    Math.abs(lorenzSigma - preset.s) < 0.25 &&
                    Math.abs(lorenzRho - preset.r) < 0.3 &&
                    Math.abs(lorenzBeta - preset.b) < 0.02;
                  return (
                    <button
                      key={preset.labelEn}
                      type="button"
                      onClick={() => {
                        setLorenzSigma(preset.s);
                        setLorenzRho(preset.r);
                        setLorenzBeta(preset.b);
                        phaseRef.current = 0;
                      }}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-bg-deep)"
                          : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                      }`}
                    >
                      {isFa ? preset.labelFa : preset.labelEn}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Interactive Precision Parameter Sliders */}
          <div className={expanded ? "space-y-2.5 lg:col-span-4" : "space-y-2.5"}>
            {mode === "slit" && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-wl" className="text-(--color-text-secondary)">
                      {isFa ? "طول موج نور (λ)" : "Wavelength (λ)"}
                    </label>
                    <span
                      dir="ltr"
                      className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <span
                        className="h-2 w-2 rounded-xs"
                        style={{ backgroundColor: slitMetrics.spectralHex }}
                        aria-hidden="true"
                      />
                      <bdi dir="ltr">{wavelengthNm} nm</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-wl"
                    type="range"
                    min={380}
                    max={750}
                    step={1}
                    value={wavelengthNm}
                    onChange={(e) => setWavelengthNm(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-slit" className="text-(--color-text-secondary)">
                      {isFa ? "فاصله دو شکاف (d)" : "Slit separation (d)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{slitSepMm.toFixed(2)} mm</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-slit"
                    type="range"
                    min={0.15}
                    max={1.5}
                    step={0.01}
                    value={slitSepMm}
                    onChange={(e) => {
                      const nextD = Number(e.target.value);
                      setSlitSepMm(nextD);
                      const maxA = Number(Math.min(0.2, nextD * 0.65).toFixed(3));
                      if (slitWidthMm > maxA) setSlitWidthMm(maxA);
                    }}
                    className="kinetic-slider w-full"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-slit-width" className="text-(--color-text-secondary)">
                      {isFa ? "پهنای هر شکاف (a)" : "Slit aperture (a)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{slitMetrics.slitWidthMm.toFixed(3)} mm</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-slit-width"
                    type="range"
                    min={0.02}
                    max={Number(Math.min(0.2, slitSepMm * 0.65).toFixed(3))}
                    step={0.005}
                    value={slitMetrics.slitWidthMm}
                    onChange={(e) => setSlitWidthMm(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>
              </>
            )}

            {mode === "orbit" && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-ecc" className="text-(--color-text-secondary)">
                      {isFa ? "خروج از مرکز مدار (e)" : "Eccentricity (e)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{eccentricity.toFixed(3)}</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-ecc"
                    type="range"
                    min={0}
                    max={0.9}
                    step={0.005}
                    value={eccentricity}
                    onChange={(e) => setEccentricity(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-axis" className="text-(--color-text-secondary)">
                      {isFa ? "نیم‌محور بزرگ (a)" : "Semi-major axis (a)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{semiMajorAU.toFixed(3)} AU</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-axis"
                    type="range"
                    min={0.35}
                    max={3.0}
                    step={0.001}
                    value={semiMajorAU}
                    onChange={(e) => setSemiMajorAU(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>
              </>
            )}

            {mode === "horizon" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="kinetic-mass" className="text-(--color-text-secondary)">
                    {isFa ? "جرم سیاه‌چاله (M)" : "Black hole mass (M)"}
                  </label>
                  <span
                    dir="ltr"
                    className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">{solarMasses.toFixed(1)} M☉</bdi>
                  </span>
                </div>
                <input
                  id="kinetic-mass"
                  type="range"
                  min={1}
                  max={65}
                  step={0.1}
                  value={solarMasses}
                  onChange={(e) => setSolarMasses(Number(e.target.value))}
                  className="kinetic-slider w-full"
                />
              </div>
            )}

            {mode === "quantum" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="kinetic-n1" className="text-(--color-text-secondary)">
                        {isFa ? "تراز n₁" : "State n₁"}
                      </label>
                      <span
                        dir="ltr"
                        className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                      >
                        <bdi dir="ltr">{quantumN1}</bdi>
                      </span>
                    </div>
                    <input
                      id="kinetic-n1"
                      type="range"
                      min={1}
                      max={6}
                      step={1}
                      value={quantumN1}
                      onChange={(e) => setQuantumN1(Number(e.target.value))}
                      className="kinetic-slider w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="kinetic-n2" className="text-(--color-text-secondary)">
                        {isFa ? "تراز n₂" : "State n₂"}
                      </label>
                      <span
                        dir="ltr"
                        className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                      >
                        <bdi dir="ltr">{quantumN2}</bdi>
                      </span>
                    </div>
                    <input
                      id="kinetic-n2"
                      type="range"
                      min={1}
                      max={6}
                      step={1}
                      value={quantumN2}
                      onChange={(e) => setQuantumN2(Number(e.target.value))}
                      className="kinetic-slider w-full"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-well-width" className="text-(--color-text-secondary)">
                      {isFa ? "پهنای چاه پتانسیل (L)" : "Well width (L)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{wellWidthNm.toFixed(2)} nm</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-well-width"
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.05}
                    value={wellWidthNm}
                    onChange={(e) => setWellWidthNm(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>
              </>
            )}

            {mode === "planck" && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-planck-temp" className="text-(--color-text-secondary)">
                      {isFa ? "دمای مطلق (T)" : "Temperature (T)"}
                    </label>
                    <span
                      dir="ltr"
                      className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <span
                        className="h-2 w-2 rounded-xs border border-(--color-border-strong)"
                        style={{ backgroundColor: planckMetrics.chromaticityHex }}
                        aria-hidden="true"
                      />
                      <bdi dir="ltr">{planckTempK} K</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-planck-temp"
                    type="range"
                    min={1500}
                    max={12000}
                    step={1}
                    value={planckTempK}
                    onChange={(e) => setPlanckTempK(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-planck-eps" className="text-(--color-text-secondary)">
                      {isFa ? "گسیل‌پذیری سطح (ε)" : "Surface emissivity (ε)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{planckEmissivity.toFixed(2)}</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-planck-eps"
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.01}
                    value={planckEmissivity}
                    onChange={(e) => setPlanckEmissivity(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>
              </>
            )}

            {mode === "oscillator" && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-osc-f0" className="text-(--color-text-secondary)">
                      {isFa ? "بسامد طبیعی (f₀)" : "Natural frequency (f₀)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{oscFreqHz.toFixed(2)} Hz</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-osc-f0"
                    type="range"
                    min={0.5}
                    max={3.0}
                    step={0.01}
                    value={oscFreqHz}
                    onChange={(e) => setOscFreqHz(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-osc-zeta" className="text-(--color-text-secondary)">
                      {isFa ? "نسبت میرایی (ζ)" : "Damping ratio (ζ)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{oscZeta.toFixed(2)}</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-osc-zeta"
                    type="range"
                    min={0.05}
                    max={1.4}
                    step={0.01}
                    value={oscZeta}
                    onChange={(e) => setOscZeta(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-osc-drive" className="text-(--color-text-secondary)">
                      {isFa ? "نسبت بسامد محرک (ω/ω₀)" : "Drive ratio (ω/ω₀)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{oscDriveRatio.toFixed(2)}</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-osc-drive"
                    type="range"
                    min={0.2}
                    max={2.2}
                    step={0.01}
                    value={oscDriveRatio}
                    onChange={(e) => setOscDriveRatio(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>
              </>
            )}

            {mode === "relativity" && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-rel-beta" className="text-(--color-text-secondary)">
                      {isFa ? "سرعت نسبی (β = v/c)" : "Velocity (β = v/c)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{relBeta.toFixed(3)} c</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-rel-beta"
                    type="range"
                    min={0}
                    max={0.999}
                    step={0.001}
                    value={relBeta}
                    onChange={(e) => setRelBeta(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-rel-tau" className="text-(--color-text-secondary)">
                      {isFa ? "زمان ویژه سفینه (τ₀)" : "Proper mission time (τ₀)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{relProperYr.toFixed(1)} yr</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-rel-tau"
                    type="range"
                    min={1.0}
                    max={10.0}
                    step={0.5}
                    value={relProperYr}
                    onChange={(e) => setRelProperYr(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>
              </>
            )}

            {mode === "lorenz" && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-lorenz-rho" className="text-(--color-text-secondary)">
                      {isFa ? "عدد رایلی (ρ)" : "Rayleigh number (ρ)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{lorenzRho.toFixed(1)}</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-lorenz-rho"
                    type="range"
                    min={0.5}
                    max={45.0}
                    step={0.5}
                    value={lorenzRho}
                    onChange={(e) => setLorenzRho(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="kinetic-lorenz-sigma" className="text-(--color-text-secondary)">
                        {isFa ? "پرانتل (σ)" : "Prandtl (σ)"}
                      </label>
                      <span
                        dir="ltr"
                        className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                      >
                        <bdi dir="ltr">{lorenzSigma.toFixed(1)}</bdi>
                      </span>
                    </div>
                    <input
                      id="kinetic-lorenz-sigma"
                      type="range"
                      min={4.0}
                      max={18.0}
                      step={0.5}
                      value={lorenzSigma}
                      onChange={(e) => setLorenzSigma(Number(e.target.value))}
                      className="kinetic-slider w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="kinetic-lorenz-beta" className="text-(--color-text-secondary)">
                        {isFa ? "ضریب هندسی (β)" : "Geometry (β)"}
                      </label>
                      <span
                        dir="ltr"
                        className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                      >
                        <bdi dir="ltr">
                          {Math.abs(lorenzBeta - 8 / 3) < 0.004 ? "8/3" : lorenzBeta.toFixed(2)}
                        </bdi>
                      </span>
                    </div>
                    <input
                      id="kinetic-lorenz-beta"
                      type="range"
                      min={0.5}
                      max={4.0}
                      step={0.01}
                      value={lorenzBeta}
                      onChange={(e) => setLorenzBeta(Number(e.target.value))}
                      className="kinetic-slider w-full"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Exact CODATA / RK4 / Analytical Readouts */}
          <div
            className={
              expanded
                ? "grid w-full grid-cols-2 gap-2.5 lg:col-span-4"
                : "grid w-full grid-cols-2 gap-2.5"
            }
          >
            {mode === "slit" && (
              <>
                <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "گام فریز (Δy)" : "Fringe spacing"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">{slitMetrics.fringeSpacingMm.toFixed(3)} mm</bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "انرژی فوتون / مرتبه غایب" : "Photon E / missing m"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">
                      {slitMetrics.photonEnergyEv.toFixed(3)} eV · d/a={slitMetrics.missingOrder.toFixed(1)}
                    </bdi>
                  </div>
                </div>
              </>
            )}

            {mode === "orbit" && (
              <>
                <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "تندی لحظه‌ای (v)" : "Live speed (v)"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">{liveOrbit.speedKmS.toFixed(2)} km/s</bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "دوره تناوب / rₚ – rₐ" : "Period / rₚ – rₐ"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">
                      {orbitReference.periodYears.toFixed(3)} yr · {liveOrbit.perihelionAU.toFixed(2)}–{liveOrbit.aphelionAU.toFixed(2)} AU
                    </bdi>
                  </div>
                </div>
              </>
            )}

            {mode === "horizon" && (
              <>
                <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "افق رویداد (rₛ)" : "Horizon (rₛ)"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">{horizonMetrics.schwarzschildKm.toFixed(2)} km</bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "ISCO / دمای هاوکینگ" : "ISCO / Hawking Tₕ"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">
                      {horizonMetrics.iscoKm.toFixed(1)} km · {horizonMetrics.hawkingTempNanoK.toFixed(2)} nK
                    </bdi>
                  </div>
                </div>
              </>
            )}

            {mode === "quantum" && (
              <>
                <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "شکاف انرژی / دوره تپش" : "ΔE / Beat period"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">
                      {quantumMetrics.isSuperposition
                        ? `${quantumMetrics.deltaEEv.toFixed(3)} eV · ${quantumMetrics.beatPeriodFs.toFixed(2)} fs`
                        : `${quantumMetrics.energy1Ev.toFixed(3)} eV · ∞`}
                    </bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "عدم قطعیت هایزنبرگ" : "Heisenberg σₓσₚ"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">{liveQuantum.heisenbergHbar.toFixed(3)} ħ ≥ 0.500</bdi>
                  </div>
                </div>
              </>
            )}

            {mode === "planck" && (
              <>
                <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "قله وین (λₚ) / شار کل" : "Wien λₚ / Total flux"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">
                      {planckMetrics.peakWavelengthNm.toFixed(1)} nm · {planckMetrics.totalFluxMWm2.toFixed(2)} MW/m²
                    </bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "توان مرئی / انرژی قله" : "Visible % / Peak E"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">
                      {planckMetrics.visibleFractionPct.toFixed(1)}% · {planckMetrics.peakPhotonEnergyEv.toFixed(2)} eV
                    </bdi>
                  </div>
                </div>
              </>
            )}

            {mode === "oscillator" && (
              <>
                <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "بزرگ‌نمایی M / فاز δ" : "Gain M(ω) / Phase δ"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">
                      {oscMetrics.magnification.toFixed(2)}× · {oscMetrics.phaseLagDeg.toFixed(1)}°
                    </bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "ضریب کیفیت Q / رژیم" : "Q-factor / Regime"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">
                      Q={oscMetrics.qualityFactorQ.toFixed(2)} ·{" "}
                      {oscMetrics.regime === "underdamped"
                        ? isFa
                          ? "فرو‌میرا"
                          : "Underdamped"
                        : oscMetrics.regime === "critical"
                          ? isFa
                            ? "بحرانی"
                            : "Critical"
                          : isFa
                            ? "فرامیرا"
                            : "Overdamped"}
                    </bdi>
                  </div>
                </div>
              </>
            )}

            {mode === "relativity" && (
              <>
                <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "ضریب لورنتس γ / اتساع زمان" : "Lorentz γ / Earth Δt"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">
                      γ={relMetrics.gamma.toFixed(3)} · {relMetrics.dilatedTimeYr.toFixed(2)} yr
                    </bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? (
                      <>
                        دوپلر / بقای میون <bdi dir="ltr">10 km</bdi>
                      </>
                    ) : (
                      "Doppler / 10km Muon"
                    )}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">
                      D={relMetrics.dopplerApproach.toFixed(2)}× · {relMetrics.muonSurvival10KmPct.toFixed(1)}%
                    </bdi>
                  </div>
                </div>
              </>
            )}

            {mode === "lorenz" && lorenzResult && (
              <>
                <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? (
                      <>
                        نمای لیاپانوف <bdi dir="ltr">λ₁</bdi> / رژیم
                      </>
                    ) : (
                      "Lyapunov λ₁ / Regime"
                    )}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">
                      {lorenzResult.metrics.lyapunovMax >= 0 ? "+" : ""}
                      {lorenzResult.metrics.lyapunovMax.toFixed(3)} ·{" "}
                      {lorenzResult.metrics.regime === "chaotic"
                        ? isFa
                          ? "آشوبی"
                          : "Chaotic"
                        : lorenzResult.metrics.regime === "stable"
                          ? isFa
                            ? "پایدار"
                            : "Stable"
                          : isFa
                            ? "مبدأ"
                            : "Origin"}
                    </bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? (
                      <>
                        بُعد فراکتال <bdi dir="ltr">D_KY</bdi> / <bdi dir="ltr">∇·F</bdi>
                      </>
                    ) : (
                      "Fractal D_KY / ∇·F"
                    )}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">
                      {lorenzResult.metrics.kaplanYorkeDim > 0
                        ? `D=${lorenzResult.metrics.kaplanYorkeDim.toFixed(2)}`
                        : `‖Δr‖=${liveLorenzSep < 0.01 ? liveLorenzSep.toExponential(1) : liveLorenzSep.toFixed(2)}`}{" "}
                      · {lorenzResult.metrics.divergenceRate.toFixed(2)}
                    </bdi>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
