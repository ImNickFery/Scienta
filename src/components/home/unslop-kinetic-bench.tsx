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
  computeDoubleSlit,
  computeHorizonCurvature,
  computeKeplerOrbit,
  computePhotonDeflection,
  computeQuantumWellMetrics,
  doubleSlitIntensity,
  sampleQuantumSuperposition,
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
 * Unslop Kinetic Centerpiece — Living 60fps Interactive Physics Bench
 * Four direct-manipulation physics experiments with real-time HTML5 Canvas,
 * pointer probing & laser aiming, curated scientific presets, live KaTeX
 * equations, and expandable cinema-bench view.
 */
export function UnslopKineticBench({ locale }: { locale: Locale }) {
  const isFa = locale === "fa";

  const [mode, setMode] = useState<LabMode>("slit");
  const [playing, setPlaying] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Experiment 1: Double-slit optics
  const [wavelengthNm, setWavelengthNm] = useState(565);
  const [slitSepMm, setSlitSepMm] = useState(0.45);

  // Experiment 2: Keplerian orbit
  const [eccentricity, setEccentricity] = useState(0.52);
  const [semiMajorAU, setSemiMajorAU] = useState(1.4);

  // Experiment 3: Relativistic event horizon
  const [solarMasses, setSolarMasses] = useState(12);

  // Experiment 4: 1D Quantum Potential Well Superposition
  const [quantumN1, setQuantumN1] = useState(1);
  const [quantumN2, setQuantumN2] = useState(2);

  // Live telemetry driven from the animation frame (throttled ~10Hz)
  const [liveOrbitSpeed, setLiveOrbitSpeed] = useState(() =>
    computeKeplerOrbit(1.4, 0.52, 0).speedKmS
  );
  const [liveOrbitRadius, setLiveOrbitRadius] = useState(() =>
    computeKeplerOrbit(1.4, 0.52, 0).radiusAU
  );
  const [probeReadout, setProbeReadout] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const pointerRef = useRef<PointerPos | null>(null);
  const lastUiSyncRef = useRef(0);

  // Pure physics calculations
  const slitMetrics = useMemo(
    () => computeDoubleSlit(wavelengthNm, slitSepMm, 1.5),
    [wavelengthNm, slitSepMm]
  );
  const orbitPeriod = useMemo(() => Math.pow(semiMajorAU, 1.5), [semiMajorAU]);
  const horizonMetrics = useMemo(
    () => computeHorizonCurvature(solarMasses),
    [solarMasses]
  );
  const quantumMetrics = useMemo(
    () => computeQuantumWellMetrics(quantumN1, quantumN2, 1.0),
    [quantumN1, quantumN2]
  );

  // Pre-rendered KaTeX formula for each active instrument
  const renderedFormula = useMemo(() => {
    const tex =
      mode === "slit"
        ? `\\Delta y = \\frac{\\lambda L}{d}`
        : mode === "orbit"
          ? `v(r) = \\sqrt{GM\\!\\left(\\tfrac{2}{r} - \\tfrac{1}{a}\\right)}`
          : mode === "horizon"
            ? `r_s = \\frac{2GM}{c^2},\\quad b_{\\text{crit}} = \\tfrac{3\\sqrt{3}}{2}r_s`
            : `E_n = \\frac{n^2 h^2}{8mL^2},\\quad |\\psi(x,t)|^2`;
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
      setWavelengthNm(565);
      setSlitSepMm(0.45);
    } else if (mode === "orbit") {
      setEccentricity(0.52);
      setSemiMajorAU(1.4);
    } else if (mode === "horizon") {
      setSolarMasses(12);
    } else {
      setQuantumN1(1);
      setQuantumN2(2);
    }
    setPlaying(true);
  };

  // Switch experiment cleanly and clear stale probe telemetry
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

      if (mode === "slit") {
        const barrierX = Math.round(width * 0.23);
        const screenX = Math.round(width * 0.77);
        const centerY = height / 2;
        const slitHalfGap = 12 + slitSepMm * 22;
        const waveStepPx = 11 + ((wavelengthNm - 380) / 370) * 14;
        const waveColor = slitMetrics.spectralHex;

        // Incoming coherent plane wave fronts
        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.26)"
          : "rgba(17, 22, 27, 0.22)";
        ctx.lineWidth = 1.2;
        const planeOffset = (((t * 36) % waveStepPx) + waveStepPx) % waveStepPx;
        for (let x = planeOffset; x < barrierX - 6; x += waveStepPx) {
          ctx.beginPath();
          ctx.moveTo(x, 22);
          ctx.lineTo(x, height - 22);
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
        ctx.lineWidth = 1.35;

        for (const slitY of [centerY - slitHalfGap, centerY + slitHalfGap]) {
          for (let r = radialOffset; r < maxRadius; r += waveStepPx) {
            if (r <= 0.5) continue;
            const alpha = Math.max(0.08, 0.56 * (1 - r / maxRadius));
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(barrierX, slitY, r, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
          }
        }
        ctx.restore();
        ctx.globalAlpha = 1;

        // Optical barrier plate with two precision apertures
        ctx.strokeStyle = inkPrimary;
        ctx.lineWidth = 2.5;
        const slitAperture = 5;
        ctx.beginPath();
        ctx.moveTo(barrierX, 14);
        ctx.lineTo(barrierX, centerY - slitHalfGap - slitAperture);
        ctx.moveTo(barrierX, centerY - slitHalfGap + slitAperture);
        ctx.lineTo(barrierX, centerY + slitHalfGap - slitAperture);
        ctx.moveTo(barrierX, centerY + slitHalfGap + slitAperture);
        ctx.lineTo(barrierX, height - 14);
        ctx.stroke();

        // Detector screen axis + intensity curve
        ctx.strokeStyle = axisLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenX + 0.5, 14);
        ctx.lineTo(screenX + 0.5, height - 14);
        ctx.stroke();

        const curveMaxWidth = Math.max(38, width - screenX - 20);
        ctx.beginPath();
        for (let py = 16; py <= height - 16; py += 2) {
          const screenMm = ((py - centerY) / (height / 2)) * 6.5;
          const intensity = doubleSlitIntensity(screenMm, wavelengthNm, slitSepMm, 1.5);
          const px = screenX + intensity * curveMaxWidth;
          if (py === 16) ctx.moveTo(screenX, py);
          ctx.lineTo(px, py);
        }
        ctx.lineTo(screenX, height - 16);
        ctx.closePath();
        ctx.fillStyle = waveColor;
        ctx.globalAlpha = isDark ? 0.25 : 0.2;
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = waveColor;
        ctx.lineWidth = 1.75;
        ctx.stroke();

        // Crisp detector fringe strip
        for (let py = 16; py <= height - 16; py += 2) {
          const screenMm = ((py - centerY) / (height / 2)) * 6.5;
          const intensity = doubleSlitIntensity(screenMm, wavelengthNm, slitSepMm, 1.5);
          ctx.fillStyle = waveColor;
          ctx.globalAlpha = intensity * 0.92;
          ctx.fillRect(screenX - 3, py, 3, 2);
        }
        ctx.globalAlpha = 1;

        // Interactive Pointer Probe crosshair along screen
        if (ptr) {
          const py = Math.min(height - 18, Math.max(18, ptr.ny * height));
          const screenMm = ((py - centerY) / (height / 2)) * 6.5;
          const intensity = doubleSlitIntensity(screenMm, wavelengthNm, slitSepMm, 1.5);
          const px = screenX + intensity * curveMaxWidth;
          const orderM = screenMm / slitMetrics.fringeSpacingMm;

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

          nextProbeText = `y=${screenMm >= 0 ? "+" : ""}${screenMm.toFixed(2)}mm · I=${Math.round(
            intensity * 100
          )}% · m=${orderM.toFixed(1)}λ`;
        }
      } else if (mode === "orbit") {
        const cx = width * 0.52;
        const cy = height * 0.5;
        const maxOrbitPx = Math.min(width * 0.37, height * 0.41);
        const scalePxPerAU =
          maxOrbitPx / Math.max(semiMajorAU * (1 + eccentricity * 0.6), 1.0);
        const aPx = semiMajorAU * scalePxPerAU;
        const bPx = aPx * Math.sqrt(1 - eccentricity * eccentricity);
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

        // Perihelion / aphelion tick markers
        const periX = ellipseCenterX + aPx;
        const aphX = ellipseCenterX - aPx;
        ctx.fillStyle = inkMuted;
        ctx.beginPath();
        ctx.arc(periX, cy, 2.2, 0, Math.PI * 2);
        ctx.arc(aphX, cy, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Orbital ellipse path
        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.36)"
          : "rgba(17, 22, 27, 0.32)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(ellipseCenterX, cy, aPx, bPx, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Mean anomaly progresses at constant angular rate
        const meanAnomaly = (t * 0.85) % (Math.PI * 2);
        const current = computeKeplerOrbit(semiMajorAU, eccentricity, meanAnomaly);

        // Shaded equal-area sector swept over ΔM = 0.42 rad (Kepler's 2nd law)
        ctx.beginPath();
        ctx.moveTo(starX, starY);
        const sweepSteps = 20;
        for (let i = 0; i <= sweepSteps; i++) {
          const m = meanAnomaly - 0.42 + (0.42 * i) / sweepSteps;
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

        // Instantaneous velocity tangent vector scaled by vis-viva speed
        const ahead = computeKeplerOrbit(semiMajorAU, eccentricity, meanAnomaly + 0.04);
        const vx = ahead.xAU - current.xAU;
        const vy = ahead.yAU - current.yAU;
        const vNorm = Math.hypot(vx, vy) || 1;
        const arrowLen = Math.min(54, Math.max(16, current.speedKmS * 0.92));
        const tipX = planetX + (vx / vNorm) * arrowLen;
        const tipY = planetY + (vy / vNorm) * arrowLen;
        ctx.strokeStyle = inkPrimary;
        ctx.lineWidth = 1.65;
        ctx.beginPath();
        ctx.moveTo(planetX, planetY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Crisp arrowhead
        const ux = vx / vNorm;
        const uy = vy / vNorm;
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

        if (ptr) {
          nextProbeText = ptr.down
            ? `Scrubbing · r=${current.radiusAU.toFixed(2)}AU · v=${current.speedKmS.toFixed(1)}km/s`
            : `Drag to scrub · r=${current.radiusAU.toFixed(2)}AU · T=${orbitPeriod.toFixed(2)}yr`;
        }

        if (now - lastUiSyncRef.current > 110) {
          lastUiSyncRef.current = now;
          setLiveOrbitSpeed(current.speedKmS);
          setLiveOrbitRadius(current.radiusAU);
        }
      } else if (mode === "horizon") {
        const cx = width * 0.52;
        const cy = height * 0.5;
        const rsPx = 15 + (solarMasses / 50) * 26;
        const photonPx = rsPx * 1.5;
        const critPx = rsPx * 2.598;

        // Concentric gravitational potential contours
        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.12)"
          : "rgba(17, 22, 27, 0.12)";
        ctx.lineWidth = 1;
        for (const mult of [2.1, 3.0, 4.1]) {
          ctx.beginPath();
          ctx.arc(cx, cy, rsPx * mult, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Photon sphere dashed circle (1.5 r_s)
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, photonPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Background ambient deflected null geodesics
        const ambientOffsets = [-3.6, -2.8, 2.8, 3.6];
        ambientOffsets.forEach((bMult, idx) => {
          const b = bMult * rsPx;
          const sign = b >= 0 ? 1 : -1;
          const absB = Math.abs(b);
          const deflectionStrength = (rsPx * rsPx * 1.45) / absB;

          ctx.beginPath();
          const steps = 64;
          for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            const x = 18 + u * (width - 36);
            const dx = x - cx;
            const bend = -sign * deflectionStrength * Math.exp(-(dx * dx) / (2 * absB * absB * 1.6));
            const asymptotic = dx > 0 ? -sign * (deflectionStrength * 0.42) * (dx / (width * 0.45)) : 0;
            const y = cy + b + bend + asymptotic;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = isDark
            ? "rgba(237, 242, 245, 0.25)"
            : "rgba(17, 22, 27, 0.25)";
          ctx.lineWidth = 1.1;
          ctx.stroke();

          // Travelling ambient photon pulses
          const pulseU = (t * 0.36 + idx * 0.23) % 1;
          const x = 18 + pulseU * (width - 36);
          const dx = x - cx;
          const bend = -sign * deflectionStrength * Math.exp(-(dx * dx) / (2 * absB * absB * 1.6));
          const asymptotic = dx > 0 ? -sign * (deflectionStrength * 0.42) * (dx / (width * 0.45)) : 0;
          const y = cy + b + bend + asymptotic;
          ctx.fillStyle = inkMuted;
          ctx.beginPath();
          ctx.arc(x, y, 2.3, 0, Math.PI * 2);
          ctx.fill();
        });

        // Interactive User-Aimed Test Laser Photon (defaults to b = 2.9 r_s when idle, follows cursor Y when hovering)
        const aimY = ptr ? Math.min(height - 16, Math.max(16, ptr.ny * height)) : cy - rsPx * 2.85;
        const aimOffsetPx = aimY - cy;
        const impactRs = Math.max(0.25, Math.abs(aimOffsetPx) / rsPx);
        const deflection = computePhotonDeflection(impactRs);
        const sign = aimOffsetPx >= 0 ? 1 : -1;

        ctx.beginPath();
        const raySteps = 80;
        let pulseX = 18;
        let pulseY = aimY;
        const userPulseU = (t * 0.52) % 1;

        if (deflection.captured) {
          // Captured geodesic plunges cleanly into the Schwarzschild event horizon
          const endX = cx - Math.cos(0.45) * (rsPx * 0.92);
          const endY = cy + sign * Math.sin(0.45) * (rsPx * 0.92);
          for (let i = 0; i <= raySteps; i++) {
            const u = i / raySteps;
            const x = 18 + u * (endX - 18);
            const curve = Math.pow(u, 2.6);
            const y = aimY * (1 - curve) + endY * curve;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            if (Math.abs(u - userPulseU) < 1 / raySteps) {
              pulseX = x;
              pulseY = y;
            }
          }
          ctx.strokeStyle = "#dc2626";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = "#dc2626";
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const absB = Math.max(critPx * 0.92, Math.abs(aimOffsetPx));
          const deflectionStrength = (rsPx * rsPx * 1.95) / absB;
          for (let i = 0; i <= raySteps; i++) {
            const u = i / raySteps;
            const x = 18 + u * (width - 36);
            const dx = x - cx;
            const bend = -sign * deflectionStrength * Math.exp(-(dx * dx) / (2 * absB * absB * 1.35));
            const asymptotic = dx > 0 ? -sign * (deflectionStrength * 0.58) * (dx / (width * 0.42)) : 0;
            const y = cy + aimOffsetPx + bend + asymptotic;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            if (Math.abs(u - userPulseU) < 1 / raySteps) {
              pulseX = x;
              pulseY = y;
            }
          }
          ctx.strokeStyle = accent;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Laser emitter notch on left edge
        ctx.fillStyle = deflection.captured ? "#dc2626" : accent;
        ctx.fillRect(10, aimY - 3, 8, 6);

        // Matte event horizon disk
        ctx.fillStyle = isDark ? "#050708" : "#11161b";
        ctx.beginPath();
        ctx.arc(cx, cy, rsPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = inkPrimary;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (ptr) {
          nextProbeText = deflection.captured
            ? `b=${impactRs.toFixed(2)}rₛ < 2.60rₛ · CAPTURED`
            : `b=${impactRs.toFixed(2)}rₛ · Δφ=${deflection.deflectionDeg.toFixed(1)}°`;
        }
      } else {
        // Experiment 4: 1D Quantum Potential Well Superposition |ψ(x, t)|²
        const padX = 44;
        const wellLeft = padX;
        const wellRight = width - padX;
        const wellWidth = wellRight - wellLeft;
        const baseY = Math.round(height * 0.78);
        const topY = 26;
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

        // Midline axis for Re(ψ)
        const waveMidY = topY + usableH * 0.56;
        ctx.strokeStyle = axisLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wellLeft, waveMidY + 0.5);
        ctx.lineTo(wellRight, waveMidY + 0.5);
        ctx.stroke();

        // Probability density |ψ(x, t)|² filled area & crisp curve
        const samples = 140;
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

        // Real part Re(ψ(x, t)) oscillating hairline
        const ampScale = usableH * 0.22;
        ctx.strokeStyle = isDark
          ? "rgba(237, 242, 245, 0.72)"
          : "rgba(17, 22, 27, 0.65)";
        ctx.lineWidth = 1.35;
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

        // Expected position <x> marker along bottom rail
        let meanU = 0;
        for (let i = 0; i < 100; i++) {
          const u = (i + 0.5) / 100;
          meanU += u * sampleQuantumSuperposition(u, quantumN1, quantumN2, phaseT).probDensity / 100;
        }
        const meanX = wellLeft + meanU * wellWidth;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(meanX, baseY + 2);
        ctx.lineTo(meanX - 5, baseY + 10);
        ctx.lineTo(meanX + 5, baseY + 10);
        ctx.closePath();
        ctx.fill();

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

          nextProbeText = `x/L=${u.toFixed(2)} · |ψ|²=${s.probDensity.toFixed(2)} · Re(ψ)=${s.real.toFixed(2)}`;
        }
      }

      // Sync pointer probe telemetry cleanly (~12Hz)
      if (now - lastUiSyncRef.current > 85) {
        lastUiSyncRef.current = now;
        setProbeReadout(nextProbeText);
      }

      // Calibration corner ruler marks (always LTR so units never clip on RTL pages)
      ctx.save();
      ctx.direction = "ltr";
      ctx.textAlign = "left";
      ctx.fillStyle = inkMuted;
      ctx.font = "11px ui-monospace, SFMono-Regular, monospace";
      const tag =
        mode === "slit"
          ? `λ=${wavelengthNm}nm  d=${slitSepMm.toFixed(2)}mm`
          : mode === "orbit"
            ? `e=${eccentricity.toFixed(2)}  a=${semiMajorAU.toFixed(1)}AU`
            : mode === "horizon"
              ? `M=${solarMasses}M☉  rₛ=${horizonMetrics.schwarzschildKm.toFixed(1)}km`
              : `n₁=${quantumN1}  n₂=${quantumN2}  L=1.0nm`;
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
    slitMetrics.spectralHex,
    slitMetrics.fringeSpacingMm,
    eccentricity,
    semiMajorAU,
    orbitPeriod,
    solarMasses,
    horizonMetrics.schwarzschildKm,
    quantumN1,
    quantumN2,
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
        ? "حرکت نشانگر برای اندازه‌گیری شدت فریز"
        : "Move pointer to probe fringe intensity"
      : mode === "orbit"
        ? isFa
          ? "بکشید تا سیاره را روی مدار حرکت دهید"
          : "Drag canvas to scrub orbital phase"
        : mode === "horizon"
          ? isFa
            ? "حرکت عمودی نشانگر برای نشانه‌گیری لیزر فوتون"
            : "Move vertically to aim test photon beam"
          : isFa
            ? "حرکت نشانگر برای اندازه‌گیری |ψ(x)|²"
            : "Move pointer to sample |ψ(x)|²";

  return (
    <div
      id="kinetic-bench"
      className="overflow-hidden rounded-t-2xl border border-b-0 border-(--color-border-strong) bg-(--color-bg-elevated) shadow-[0_-10px_32px_rgba(15,20,22,0.08)]"
    >
      {/* Top instrument header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5 text-xs text-(--color-text-tertiary)">
          <span
            dir="ltr"
            className="font-[family-name:var(--font-mono)] font-medium text-(--color-accent-purple)"
          >
            01 / LAB
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-medium text-(--color-text-secondary)">
            {isFa ? "میز شبیه‌ساز زنده فیزیک" : "Live physics instrument bench"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label={isFa ? "انتخاب آزمایش زنده" : "Select physics experiment"}
            className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-1"
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
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                    active
                      ? "bg-(--color-bg-elevated) text-(--color-text-primary) shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  <span>{isFa ? tab.labelFa : tab.labelEn}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
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
      </div>

      {/* Main bench body: 7/5 split or expanded stacked 12-col cinema bench */}
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
              expanded ? "h-[340px] sm:h-[390px]" : "h-[248px] sm:h-[282px]"
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
                    ? "شبیه‌سازی زنده تداخل موج دو شکاف"
                    : "Live double-slit wave interference simulation"
                  : mode === "orbit"
                    ? isFa
                      ? "شبیه‌سازی زنده مدار بیضوی کپلر"
                      : "Live Keplerian elliptical orbit simulation"
                    : mode === "horizon"
                      ? isFa
                        ? "شبیه‌سازی زنده خمش نور در افق رویداد"
                        : "Live gravitational light deflection around event horizon"
                      : isFa
                        ? "شبیه‌سازی زنده برهم‌نهی موج کوانتومی در چاه پتانسیل"
                        : "Live quantum wavefunction superposition in a 1D potential well"
              }
              className="block h-full w-full cursor-crosshair touch-none"
            />
          </div>

          {/* Interactive Pointer Telemetry Footer */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-(--color-text-tertiary)">
            <span className="inline-flex items-center gap-1.5">
              <Crosshair className="h-3.5 w-3.5 text-(--color-accent-purple)" strokeWidth={1.5} />
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
            <span dir="ltr" className="font-[family-name:var(--font-mono)] tabular-nums opacity-75">
              60 FPS · REALTIME
            </span>
          </div>
        </div>

        {/* Precision Controls, Curated Presets, Live KaTeX & Readouts */}
        <div
          className={
            expanded
              ? "grid grid-cols-1 items-start gap-5 p-4 sm:p-5 lg:grid-cols-12"
              : "flex flex-col justify-between gap-4 p-4 sm:p-5 lg:col-span-5"
          }
        >
          <div className={expanded ? "space-y-3 lg:col-span-4" : "space-y-4"}>
            {/* Live Formula Strip */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3.5 py-2.5">
              <span className="text-xs text-(--color-text-tertiary)">
                {mode === "slit"
                  ? isFa
                    ? "فاصله فریزها"
                    : "Fringe spacing"
                  : mode === "orbit"
                    ? isFa
                      ? "معادله ویس-ویوا"
                      : "Vis-viva law"
                    : mode === "horizon"
                      ? isFa
                        ? "افق و کره فوتونی"
                        : "Horizon scale"
                      : isFa
                        ? "تراز انرژی کوانتومی"
                        : "Quantized levels"}
              </span>
              <div
                dir="ltr"
                className="overflow-x-auto text-sm text-(--color-text-primary)"
                dangerouslySetInnerHTML={{ __html: renderedFormula }}
              />
            </div>

            {/* Curated Scientific Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              {mode === "slit" &&
                [
                  { labelFa: "بنفش ۴۲۰nm", labelEn: "Violet 420nm", wl: 420, d: 0.35 },
                  { labelFa: "لیزر سبز ۵۳۲nm", labelEn: "Laser 532nm", wl: 532, d: 0.45 },
                  { labelFa: "قرمز ۶۵۰nm", labelEn: "Red 650nm", wl: 650, d: 0.6 },
                ].map((preset) => {
                  const active = wavelengthNm === preset.wl && Math.abs(slitSepMm - preset.d) < 0.01;
                  return (
                    <button
                      key={preset.labelEn}
                      type="button"
                      onClick={() => {
                        setWavelengthNm(preset.wl);
                        setSlitSepMm(preset.d);
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
                  { labelFa: "مدار زمین", labelEn: "Earth", e: 0.02, a: 1.0 },
                  { labelFa: "سیاره بیضوی", labelEn: "Exoplanet", e: 0.52, a: 1.4 },
                  { labelFa: "دنباله‌دار هالی", labelEn: "Comet", e: 0.74, a: 2.2 },
                ].map((preset) => {
                  const active =
                    Math.abs(eccentricity - preset.e) < 0.01 &&
                    Math.abs(semiMajorAU - preset.a) < 0.05;
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
                  { labelFa: "ستاره‌ای ۵M☉", labelEn: "Stellar 5M☉", m: 5 },
                  { labelFa: "ادغام ۲۰M☉", labelEn: "Merger 20M☉", m: 20 },
                  { labelFa: "سنگین ۴۸M☉", labelEn: "Massive 48M☉", m: 48 },
                ].map((preset) => {
                  const active = solarMasses === preset.m;
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
                  { labelFa: "پایه (۱+۱)", labelEn: "Ground (1+1)", a: 1, b: 1 },
                  { labelFa: "برهم‌نهی (۱+۲)", labelEn: "Slosh (1+2)", a: 1, b: 2 },
                  { labelFa: "تپنده (۲+۴)", labelEn: "Beat (2+4)", a: 2, b: 4 },
                ].map((preset) => {
                  const active = quantumN1 === preset.a && quantumN2 === preset.b;
                  return (
                    <button
                      key={preset.labelEn}
                      type="button"
                      onClick={() => {
                        setQuantumN1(preset.a);
                        setQuantumN2(preset.b);
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

          {/* Interactive Parameter Sliders */}
          <div className={expanded ? "space-y-3 lg:col-span-4" : "space-y-3"}>
            {mode === "slit" && (
              <>
                <div className="space-y-1.5">
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
                    min={400}
                    max={700}
                    step={5}
                    value={wavelengthNm}
                    onChange={(e) => setWavelengthNm(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>

                <div className="space-y-1.5">
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
                    min={0.2}
                    max={1.2}
                    step={0.05}
                    value={slitSepMm}
                    onChange={(e) => setSlitSepMm(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>
              </>
            )}

            {mode === "orbit" && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-ecc" className="text-(--color-text-secondary)">
                      {isFa ? "خروج از مرکز مدار (e)" : "Eccentricity (e)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{eccentricity.toFixed(2)}</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-ecc"
                    type="range"
                    min={0}
                    max={0.75}
                    step={0.02}
                    value={eccentricity}
                    onChange={(e) => setEccentricity(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-axis" className="text-(--color-text-secondary)">
                      {isFa ? "نیم‌محور بزرگ (a)" : "Semi-major axis (a)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">{semiMajorAU.toFixed(1)} AU</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-axis"
                    type="range"
                    min={0.6}
                    max={2.6}
                    step={0.1}
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
                    <bdi dir="ltr">{solarMasses} M☉</bdi>
                  </span>
                </div>
                <input
                  id="kinetic-mass"
                  type="range"
                  min={1}
                  max={50}
                  step={1}
                  value={solarMasses}
                  onChange={(e) => setSolarMasses(Number(e.target.value))}
                  className="kinetic-slider w-full"
                />
              </div>
            )}

            {mode === "quantum" && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-n1" className="text-(--color-text-secondary)">
                      {isFa ? "تراز کوانتومی اول (n₁)" : "Primary eigenstate (n₁)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">n₁ = {quantumN1}</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-n1"
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={quantumN1}
                    onChange={(e) => setQuantumN1(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="kinetic-n2" className="text-(--color-text-secondary)">
                      {isFa ? "تراز کوانتومی دوم (n₂)" : "Superposed state (n₂)"}
                    </label>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                    >
                      <bdi dir="ltr">n₂ = {quantumN2}</bdi>
                    </span>
                  </div>
                  <input
                    id="kinetic-n2"
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={quantumN2}
                    onChange={(e) => setQuantumN2(Number(e.target.value))}
                    className="kinetic-slider w-full"
                  />
                </div>
              </>
            )}
          </div>

          {/* Live Computed Telemetry Readouts */}
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
                    {isFa ? "گام تداخل (Δy)" : "Fringe spacing"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">{slitMetrics.fringeSpacingMm.toFixed(2)} mm</bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "فاصله پرده (L)" : "Screen distance"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">1.50 m</bdi>
                  </div>
                </div>
              </>
            )}

            {mode === "orbit" && (
              <>
                <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "تندی لحظه‌ای (v)" : "Live speed"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">{liveOrbitSpeed.toFixed(1)} km/s</bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "دوره تناوب / فاصله" : "Period / radius"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">
                      {orbitPeriod.toFixed(2)} yr · {liveOrbitRadius.toFixed(2)} AU
                    </bdi>
                  </div>
                </div>
              </>
            )}

            {mode === "horizon" && (
              <>
                <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "شعاع افق (rₛ)" : "Horizon radius"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">{horizonMetrics.schwarzschildKm.toFixed(1)} km</bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "کره فوتونی / Tₕ" : "Photon sphere / Tₕ"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-text-primary)"
                  >
                    <bdi dir="ltr">
                      {horizonMetrics.photonSphereKm.toFixed(1)} km ·{" "}
                      {horizonMetrics.hawkingTempNanoK.toFixed(1)} nK
                    </bdi>
                  </div>
                </div>
              </>
            )}

            {mode === "quantum" && (
              <>
                <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "شکاف انرژی (ΔE)" : "Energy gap (ΔE)"}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-0.5 text-start font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-accent-purple)"
                  >
                    <bdi dir="ltr">
                      {quantumMetrics.isSuperposition
                        ? `${quantumMetrics.deltaEEv.toFixed(2)} eV`
                        : `${quantumMetrics.energy1Ev.toFixed(2)} eV`}
                    </bdi>
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                  <div className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "وضعیت موج" : "Wave state"}
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-(--color-text-primary)">
                    {quantumMetrics.isSuperposition
                      ? isFa
                        ? "برهم‌نهی نوسانی زنده"
                        : "Live sloshing beat"
                      : isFa
                        ? "حالت ایستا (تک‌تراز)"
                        : "Stationary eigenstate"}
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
