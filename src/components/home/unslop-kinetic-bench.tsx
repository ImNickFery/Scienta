"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import {
  Atom,
  CircleDot,
  Crosshair,
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
  type SchwarzschildGeodesicResult,
} from "@/lib/kinetic-physics";
import type { Locale } from "@/lib/i18n/config";

type LabMode = "slit" | "orbit" | "horizon" | "quantum";

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
  const [probeReadout, setProbeReadout] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const pointerRef = useRef<PointerPos | null>(null);
  const lastUiSyncRef = useRef(0);

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
            : `E_n = \\frac{n^2 h^2}{8m_e L^2},\\quad \\sigma_x\\sigma_p \\ge \\tfrac{\\hbar}{2}`;
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
    } else {
      setQuantumN1(1);
      setQuantumN2(2);
      setWellWidthNm(1.0);
    }
    setPlaying(true);
  };

  const handleSelectMode = (nextMode: LabMode) => {
    setMode(nextMode);
    pointerRef.current = null;
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

    // Direct orbital phase scrubbing when dragging inside Keplerian orbit
    if (mode === "orbit" && down) {
      const dx = nx - 0.52;
      const dy = ny - 0.5;
      const angle = ((Math.atan2(dy, dx) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      phaseRef.current = angle / 0.85;
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

        // Exact Fraunhofer single-slit diffraction envelope sinc²(β) dashed guide
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.34)"
          : "rgba(17, 22, 27, 0.32)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let py = 16; py <= height - 16; py += 2) {
          const screenMm = ((py - centerY) / (height / 2)) * screenHalfSpanMm;
          const probe = probeDoubleSlitExact(screenMm, wavelengthNm, slitSepMm, 1.5, slitWidthMm);
          const px = screenX + probe.envelope * curveMaxWidth;
          if (py === 16) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // Exact non-paraxial interference × diffraction curve
        ctx.beginPath();
        for (let py = 16; py <= height - 16; py += 1.5) {
          const screenMm = ((py - centerY) / (height / 2)) * screenHalfSpanMm;
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
          const screenMm = ((py - centerY) / (height / 2)) * screenHalfSpanMm;
          const probe = probeDoubleSlitExact(screenMm, wavelengthNm, slitSepMm, 1.5, slitWidthMm);
          ctx.fillStyle = waveColor;
          ctx.globalAlpha = probe.intensity * 0.94;
          ctx.fillRect(screenX - 3, py, 3, 2);
        }
        ctx.globalAlpha = 1;

        // Interactive Non-Paraxial Optical Probe on hover
        if (ptr) {
          const py = Math.min(height - 18, Math.max(18, ptr.ny * height));
          const screenMm = ((py - centerY) / (height / 2)) * screenHalfSpanMm;
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

        // Shaded equal-area sector swept over ΔM = 0.48 rad (identical area at perihelion & aphelion)
        ctx.beginPath();
        ctx.moveTo(starX, starY);
        const sweepSteps = 28;
        for (let i = 0; i <= sweepSteps; i++) {
          const m = meanAnomaly - 0.48 + (0.48 * i) / sweepSteps;
          const pt = computeKeplerOrbit(semiMajorAU, eccentricity, m);
          ctx.lineTo(starX + pt.xAU * scalePxPerAU, starY + pt.yAU * scalePxPerAU);
        }
        ctx.closePath();
        ctx.fillStyle = accent;
        ctx.globalAlpha = isDark ? 0.22 : 0.16;
        ctx.fill();
        ctx.globalAlpha = 1;

        const planetX = starX + current.xAU * scalePxPerAU;
        const planetY = starY + current.yAU * scalePxPerAU;

        // Radius vector from star to planet
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(starX, starY);
        ctx.lineTo(planetX, planetY);
        ctx.stroke();

        // EXACT analytic velocity tangent vector (vxKmS, vyKmS) scaled by speed
        const vNorm = Math.hypot(current.vxKmS, current.vyKmS) || 1;
        const ux = current.vxKmS / vNorm;
        const uy = current.vyKmS / vNorm;
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
        const quantKey = Math.round(signedImpactRs * 200);
        if (quantKey !== cachedImpactKey || !cachedLaserGeodesic) {
          cachedImpactKey = quantKey;
          cachedLaserGeodesic = traceSchwarzschildGeodesic(signedImpactRs, {
            rViewRs: Math.max(16, Math.ceil((width * 0.65) / rsPx)),
            maxSteps: 2200,
            stepRad: 0.012,
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
      } else {
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

          nextProbeText = `x=${(u * wellWidthNm).toFixed(3)}nm · |ψ|²=${s.probDensity.toFixed(3)} · Re=${s.real.toFixed(2)} · Im=${s.imag.toFixed(2)}`;
        }
      }

      // Unified throttled UI telemetry sync (~10Hz) across all 4 instruments
      if (now - lastUiSyncRef.current > 95) {
        lastUiSyncRef.current = now;
        setProbeReadout(nextProbeText);
        if (nextOrbitSync) setLiveOrbit(nextOrbitSync);
        if (nextQuantumSync) setLiveQuantum(nextQuantumSync);
      }

      // Calibration corner ruler marks (always LTR so units never clip on RTL pages)
      ctx.save();
      ctx.direction = "ltr";
      ctx.textAlign = "left";
      ctx.fillStyle = inkMuted;
      ctx.font = "11px ui-monospace, SFMono-Regular, monospace";
      const tag =
        mode === "slit"
          ? `λ=${wavelengthNm}nm  d=${slitSepMm.toFixed(2)}mm  a=${slitWidthMm.toFixed(3)}mm`
          : mode === "orbit"
            ? `e=${eccentricity.toFixed(3)}  a=${semiMajorAU.toFixed(3)}AU  ε=${orbitReference.specificEnergyKm2S2.toFixed(1)}km²/s²`
            : mode === "horizon"
              ? `M=${solarMasses.toFixed(1)}M☉  rₛ=${horizonMetrics.schwarzschildKm.toFixed(2)}km  b_crit=${horizonMetrics.criticalImpactKm.toFixed(1)}km`
              : `n₁=${quantumN1}  n₂=${quantumN2}  L=${wellWidthNm.toFixed(2)}nm  ⟨x⟩=${(currentQuantumMeanU * wellWidthNm).toFixed(2)}nm`;
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
  ]);

  const tabs: { id: LabMode; icon: typeof Waves; labelFa: string; labelEn: string }[] = [
    { id: "slit", icon: Waves, labelFa: "تداخل دو شکاف", labelEn: "Double-slit" },
    { id: "orbit", icon: Orbit, labelFa: "مدار کپلری", labelEn: "Kepler orbit" },
    { id: "horizon", icon: CircleDot, labelFa: "افق نسبیتی", labelEn: "Event horizon" },
    { id: "quantum", icon: Atom, labelFa: "چاه کوانتومی", labelEn: "Quantum well" },
  ];

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
          : isFa
            ? "حرکت نشانگر برای سنجش |ψ(x)|²، Re و Im"
            : "Move pointer to sample |ψ(x)|², Re & Im";

  const solverBadge =
    mode === "slit"
      ? "NON-PARAXIAL · CODATA 2022"
      : mode === "orbit"
        ? "HALLEY <10⁻¹⁴ · IAU 2015"
        : mode === "horizon"
          ? "RK4 SCHWARZSCHILD · EXACT"
          : "ANALYTIC ħ · CODATA 2022";

  return (
    <div
      id="kinetic-bench"
      className="overflow-hidden rounded-t-2xl border border-b-0 border-(--color-border-strong) bg-(--color-bg-elevated) shadow-[0_-10px_32px_rgba(15,20,22,0.08)]"
    >
      {/* Top instrument header bar */}
      <div className="flex flex-col gap-2.5 border-b border-(--color-border-subtle) px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-(--color-text-tertiary)">
            <span
              dir="ltr"
              className="font-[family-name:var(--font-mono)] font-medium text-(--color-accent-purple)"
            >
              01 / LAB
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-(--color-text-secondary)">
              {isFa ? "میز شبیه‌ساز دقیق فیزیک" : "Precision live physics bench"}
            </span>
          </div>

          <div className="flex items-center gap-1 lg:hidden">
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
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label={isFa ? "انتخاب آزمایش زنده" : "Select physics experiment"}
            className="grid w-full grid-cols-2 gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-1 sm:inline-flex sm:w-auto sm:flex-wrap sm:items-center"
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
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 sm:justify-start sm:py-1 ${
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

          <div className="hidden items-center gap-1 lg:flex">
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
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
            </button>
          </div>
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
                      : isFa
                        ? "شبیه‌سازی دقیق برهم‌نهی موج کوانتومی و عدم قطعیت هایزنبرگ"
                        : "Exact 1D quantum potential well wavefunction & Heisenberg simulation"
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
                      : isFa
                        ? "تراز و هایزنبرگ"
                        : "Eigen & ħ/2"}
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
                    onChange={(e) => setSlitSepMm(Number(e.target.value))}
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
                      <bdi dir="ltr">{slitWidthMm.toFixed(3)} mm</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-slit-width"
                    type="range"
                    min={0.02}
                    max={0.2}
                    step={0.005}
                    value={slitWidthMm}
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
                    step={0.05}
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
                  step={0.5}
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
          </div>
        </div>
      </div>
    </div>
  );
}
