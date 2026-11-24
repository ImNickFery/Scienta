/**
 * High-precision 2D Canvas renderers for Experiments 5–8 of the Scienta Living Optical Lab.
 * Shares the calibrated 28px optical bench aesthetic, theme tokens, and pointer probe contract.
 */

import { wavelengthToHex } from "@/lib/kinetic-physics";
import {
  lorentzTransformEvent,
  planckSpectralRadianceKw,
  probePlanckAtWavelength,
  rayleighJeansRadianceKw,
  sampleOscillatorBode,
  type LorenzTwinResult,
  type OscillatorMetrics,
  type OscillatorStateSample,
  type PlanckBlackbodyMetrics,
  type RelativityMetrics,
} from "@/lib/kinetic-physics-extended";

export interface ExtendedCanvasTheme {
  width: number;
  height: number;
  t: number;
  isDark: boolean;
  inkPrimary: string;
  inkMuted: string;
  accent: string;
  axisLine: string;
  ptr: { nx: number; ny: number; down: boolean } | null;
}

// ---------------------------------------------------------------------------
// 5. Planck Blackbody Radiation & UV Catastrophe Canvas
// ---------------------------------------------------------------------------

export function drawPlanckCanvas(
  ctx: CanvasRenderingContext2D,
  theme: ExtendedCanvasTheme,
  temperatureK: number,
  emissivity: number,
  metrics: PlanckBlackbodyMetrics
): string | null {
  const { width, height, t, isDark, inkPrimary, inkMuted, accent, axisLine, ptr } = theme;
  const padL = 44;
  const padR = 18;
  const padT = 22;
  const padB = 42;
  const plotW = Math.max(120, width - padL - padR);
  const plotH = Math.max(100, height - padT - padB);
  const baseY = padT + plotH;

  const wlMin = 100;
  const wlMax = 2600;
  const toX = (wl: number) => padL + ((wl - wlMin) / (wlMax - wlMin)) * plotW;

  // Normalize vertical axis to 1.15× ideal blackbody peak at current T so emissivity visibly scales curve
  const maxRadiance = Math.max(1e-6, metrics.idealPeakRadianceKw * 1.15);
  const toY = (rad: number) => baseY - Math.min(plotH, (rad / maxRadiance) * plotH);

  // Calibrated Visible Spectrum Band (380–750 nm) softly shaded behind curve
  const visX1 = toX(380);
  const visX2 = toX(750);
  const visSteps = 32;
  const stripW = (visX2 - visX1) / visSteps;
  for (let i = 0; i < visSteps; i++) {
    const wl = 380 + ((i + 0.5) / visSteps) * (750 - 380);
    ctx.fillStyle = wavelengthToHex(wl);
    ctx.globalAlpha = isDark ? 0.14 : 0.12;
    ctx.fillRect(visX1 + i * stripW, padT, stripW + 0.6, plotH);
  }
  ctx.globalAlpha = 1;

  // Subtle boundary lines for visible band
  ctx.save();
  ctx.strokeStyle = isDark ? "rgba(237, 242, 245, 0.14)" : "rgba(17, 22, 27, 0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(visX1 + 0.5, padT);
  ctx.lineTo(visX1 + 0.5, baseY);
  ctx.moveTo(visX2 + 0.5, padT);
  ctx.lineTo(visX2 + 0.5, baseY);
  ctx.stroke();
  ctx.restore();

  // Axes
  ctx.strokeStyle = axisLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL + 0.5, padT);
  ctx.lineTo(padL + 0.5, baseY + 0.5);
  ctx.lineTo(padL + plotW, baseY + 0.5);
  ctx.stroke();

  // Wavelength ticks (X) and calibrated radiance ticks (Y)
  ctx.save();
  ctx.direction = "ltr";
  ctx.font = "9.5px ui-monospace, SFMono-Regular, monospace";
  ctx.fillStyle = inkMuted;
  ctx.textAlign = "center";
  for (const tickWl of [500, 1000, 1500, 2000, 2500]) {
    const tx = toX(tickWl);
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.lineTo(tx, baseY + 4);
    ctx.strokeStyle = axisLine;
    ctx.stroke();
    ctx.fillText(`${tickWl}`, tx, baseY + 13);
  }
  // Y-axis calibrated radiance ticks (kW/sr·m²·nm)
  ctx.textAlign = "right";
  const fmtRadTick = (v: number) =>
    v >= 100 ? Math.round(v).toString() : v >= 10 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toExponential(0);
  for (const frac of [0.5, 1.0]) {
    const ty = baseY - frac * plotH;
    ctx.beginPath();
    ctx.moveTo(padL - 3, ty + 0.5);
    ctx.lineTo(padL, ty + 0.5);
    ctx.strokeStyle = axisLine;
    ctx.stroke();
    ctx.fillText(fmtRadTick(maxRadiance * frac), padL - 5, ty + 3);
  }
  ctx.textAlign = "left";
  ctx.fillText("VIS", visX1 + 4, padT + 10);
  ctx.restore();

  // Classical Rayleigh-Jeans divergence curve (Ultraviolet Catastrophe)
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();

  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = isDark ? "rgba(248, 113, 113, 0.65)" : "rgba(220, 38, 38, 0.62)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  let rjStarted = false;
  let rjLabelPos: { x: number; y: number } | null = null;
  for (let i = 0; i <= 180; i++) {
    const wl = wlMin + (i / 180) * (wlMax - wlMin);
    const rj = rayleighJeansRadianceKw(wl, temperatureK, emissivity);
    const x = toX(wl);
    const y = baseY - (rj / maxRadiance) * plotH;
    if (y < padT - 20) {
      rjStarted = false;
      continue;
    }
    if (!rjStarted) {
      ctx.moveTo(x, Math.max(padT - 6, y));
      rjStarted = true;
      if (!rjLabelPos && x < padL + plotW - 76) {
        rjLabelPos = { x: x + 6, y: padT + 13 };
      }
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Ideal blackbody reference (ε = 1) when user adjusts emissivity < 0.99
  if (emissivity < 0.99) {
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = isDark ? "rgba(237, 242, 245, 0.36)" : "rgba(17, 22, 27, 0.34)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const wl = wlMin + (i / 200) * (wlMax - wlMin);
      const rad = planckSpectralRadianceKw(wl, temperatureK, 1.0);
      const x = toX(wl);
      const y = toY(rad);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Exact Planck curve fill & stroke
  ctx.beginPath();
  ctx.moveTo(padL, baseY);
  for (let i = 0; i <= 220; i++) {
    const wl = wlMin + (i / 220) * (wlMax - wlMin);
    const rad = planckSpectralRadianceKw(wl, temperatureK, emissivity);
    ctx.lineTo(toX(wl), toY(rad));
  }
  ctx.lineTo(padL + plotW, baseY);
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.globalAlpha = isDark ? 0.22 : 0.16;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 220; i++) {
    const wl = wlMin + (i / 220) * (wlMax - wlMin);
    const rad = planckSpectralRadianceKw(wl, temperatureK, emissivity);
    const x = toX(wl);
    const y = toY(rad);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Animated spectral scan pulse gliding smoothly along the Planck curve
  const scanFrac = (t * 0.16) % 1;
  const scanWl = wlMin + scanFrac * (wlMax - wlMin);
  const scanRad = planckSpectralRadianceKw(scanWl, temperatureK, emissivity);
  ctx.fillStyle = metrics.chromaticityHex;
  ctx.strokeStyle = inkPrimary;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(toX(scanWl), toY(scanRad), 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // Rayleigh-Jeans micro tag
  if (rjLabelPos) {
    ctx.save();
    ctx.direction = "ltr";
    ctx.font = "9.5px ui-monospace, SFMono-Regular, monospace";
    ctx.fillStyle = isDark ? "rgba(248, 113, 113, 0.85)" : "rgba(185, 28, 28, 0.82)";
    ctx.fillText("Rayleigh-Jeans", rjLabelPos.x, rjLabelPos.y);
    ctx.restore();
  }

  // Exact Wien Peak Marker (if within chart window)
  if (metrics.peakWavelengthNm >= wlMin && metrics.peakWavelengthNm <= wlMax) {
    const px = toX(metrics.peakWavelengthNm);
    const py = toY(metrics.peakRadianceKw);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = inkPrimary;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, baseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(px, py, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.direction = "ltr";
    ctx.font = "9.5px ui-monospace, SFMono-Regular, monospace";
    ctx.fillStyle = inkPrimary;
    const alignRight = px > padL + plotW - 95;
    ctx.textAlign = alignRight ? "right" : "left";
    ctx.fillText(
      `λₚ=${Math.round(metrics.peakWavelengthNm)}nm`,
      alignRight ? px - 7 : px + 7,
      Math.max(padT + 11, py - 5)
    );
    ctx.restore();
  }

  // CIE 1931 2° integrated chromaticity swatch & coordinates in top-right corner
  ctx.save();
  const swX = width - padR - 116;
  const swY = padT + 4;
  ctx.fillStyle = metrics.chromaticityHex;
  ctx.fillRect(swX, swY, 10, 10);
  ctx.strokeStyle = axisLine;
  ctx.strokeRect(swX + 0.5, swY + 0.5, 9, 9);
  ctx.direction = "ltr";
  ctx.font = "9px ui-monospace, SFMono-Regular, monospace";
  ctx.fillStyle = inkMuted;
  ctx.textAlign = "left";
  ctx.fillText(
    `${metrics.spectralClass} (${metrics.cie.x.toFixed(2)},${metrics.cie.y.toFixed(2)})`,
    swX + 14,
    swY + 8.5
  );
  ctx.restore();

  // Interactive Pointer Probe across wavelength axis
  if (ptr) {
    const px = Math.min(padL + plotW, Math.max(padL, ptr.nx * width));
    const wl = wlMin + ((px - padL) / plotW) * (wlMax - wlMin);
    const probe = probePlanckAtWavelength(wl, temperatureK, emissivity);
    const py = toY(probe.planckKw);

    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = inkPrimary;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, padT);
    ctx.lineTo(px, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = inkPrimary;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const radStr =
      probe.planckKw >= 10
        ? probe.planckKw.toFixed(1)
        : probe.planckKw >= 0.1
          ? probe.planckKw.toFixed(2)
          : probe.planckKw.toExponential(1);
    return `λ=${Math.round(wl)}nm · B_λ=${radStr} kW/sr·m²·nm · E=${probe.photonEnergyEv.toFixed(2)}eV · B/B_RJ=${probe.quantumSuppressionRatio.toFixed(3)}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// 6. Damped Driven Harmonic Oscillator & Bode Resonance Canvas
// ---------------------------------------------------------------------------

export function drawOscillatorCanvas(
  ctx: CanvasRenderingContext2D,
  theme: ExtendedCanvasTheme,
  metrics: OscillatorMetrics,
  rk4Trajectory: OscillatorStateSample[]
): { probeText: string | null; liveX: number; liveVNorm: number } {
  const { width, height, t, isDark, inkPrimary, inkMuted, accent, axisLine, ptr } = theme;
  const splitX = Math.round(width * 0.44);
  const padT = 18;
  const padB = 36;

  // Vertical instrument divider between Phase Space (left) & Bode Resonance (right)
  ctx.strokeStyle = axisLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(splitX + 0.5, 10);
  ctx.lineTo(splitX + 0.5, height - 24);
  ctx.stroke();

  // Current animated RK4 state advancing at exact physical simulation time over the adaptive duration
  const nPts = rk4Trajectory.length;
  const totalDur = nPts > 1 ? rk4Trajectory[nPts - 1].t : 6.0;
  const idx = nPts > 1 ? Math.floor(((t % totalDur) / totalDur) * (nPts - 1)) : 0;
  const current = rk4Trajectory[Math.min(nPts - 1, Math.max(0, idx))] ?? {
    t: 0,
    x: 0,
    vNorm: 0,
    drive: 1,
  };

  // Determine symmetric scale for phase space from trajectory + exact analytical steady-state ellipse
  let maxExtent = Math.max(1.25, metrics.magnification, metrics.magnification * metrics.driveRatio);
  for (let i = 0; i < nPts; i += 4) {
    const p = rk4Trajectory[i];
    const m = Math.max(Math.abs(p.x), Math.abs(p.vNorm));
    if (m > maxExtent) maxExtent = m;
  }
  maxExtent = Math.min(14, maxExtent * 1.12);

  // --- LEFT SUB-PANEL: Top Spring-Mass Schematic + Phase Space Portrait (x, v/ω₀) ---
  const leftPad = 14;
  const leftW = splitX - leftPad * 2;
  const springY = padT + 14;
  const eqX = leftPad + leftW * 0.54;
  const massTravelPx = leftW * 0.34;
  const massX = eqX + (current.x / maxExtent) * massTravelPx;

  // Fixed left wall
  ctx.strokeStyle = inkPrimary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftPad + 4, springY - 10);
  ctx.lineTo(leftPad + 4, springY + 10);
  ctx.stroke();

  // Zigzag spring coils
  ctx.strokeStyle = inkMuted;
  ctx.lineWidth = 1.2;
  const coils = 8;
  const springStart = leftPad + 5;
  const springEnd = Math.max(springStart + 18, massX - 9);
  ctx.beginPath();
  ctx.moveTo(springStart, springY);
  for (let c = 1; c < coils; c++) {
    const sx = springStart + (c / coils) * (springEnd - springStart);
    const sy = springY + (c % 2 === 0 ? -5.5 : 5.5);
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(springEnd, springY);
  ctx.stroke();

  // Equilibrium tick
  ctx.strokeStyle = axisLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(eqX + 0.5, springY - 12);
  ctx.lineTo(eqX + 0.5, springY + 12);
  ctx.stroke();

  // Mass block
  ctx.fillStyle = accent;
  ctx.fillRect(massX - 8, springY - 7, 16, 14);
  ctx.strokeStyle = inkPrimary;
  ctx.lineWidth = 1.1;
  ctx.strokeRect(massX - 8, springY - 7, 16, 14);

  // Driving force vector arrow
  const driveLen = current.drive * 18;
  if (Math.abs(driveLen) > 2) {
    ctx.strokeStyle = inkPrimary;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(massX, springY - 13);
    ctx.lineTo(massX + driveLen, springY - 13);
    ctx.stroke();
  }

  // Phase-space portrait area below spring
  const psTop = springY + 24;
  const psBottom = height - padB;
  const psCx = leftPad + leftW * 0.5;
  const psCy = (psTop + psBottom) / 2;
  const psRx = leftW * 0.44;
  const psRy = Math.max(36, (psBottom - psTop) * 0.44);

  // Phase-space axes
  ctx.strokeStyle = axisLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(psCx - psRx, psCy + 0.5);
  ctx.lineTo(psCx + psRx, psCy + 0.5);
  ctx.moveTo(psCx + 0.5, psCy - psRy);
  ctx.lineTo(psCx + 0.5, psCy + psRy);
  ctx.stroke();

  // Exact analytical steady-state limit cycle ellipse: x_p = M cos(φ), v_p/ω₀ = -r M sin(φ)
  const ssRx = (metrics.magnification / maxExtent) * psRx;
  const ssRy = ((metrics.magnification * metrics.driveRatio) / maxExtent) * psRy;
  if (ssRx > 2 && ssRy > 2) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.42)" : "rgba(2, 132, 199, 0.42)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(psCx, psCy, ssRx, ssRy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Full RK4 trajectory trail (transient spiral -> exact analytical steady-state limit cycle)
  ctx.beginPath();
  for (let i = 0; i < nPts; i += 2) {
    const p = rk4Trajectory[i];
    const px = psCx + (p.x / maxExtent) * psRx;
    const py = psCy - (p.vNorm / maxExtent) * psRy;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = isDark ? "rgba(237, 242, 245, 0.25)" : "rgba(17, 22, 27, 0.24)";
  ctx.lineWidth = 1.15;
  ctx.stroke();

  // Active recent trail segment in accent color
  const tailStart = Math.max(0, idx - 180);
  ctx.beginPath();
  for (let i = tailStart; i <= idx; i += 2) {
    const p = rk4Trajectory[i];
    const px = psCx + (p.x / maxExtent) * psRx;
    const py = psCy - (p.vNorm / maxExtent) * psRy;
    if (i === tailStart) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.9;
  ctx.stroke();

  // Current phase-space state point
  const curPx = psCx + (current.x / maxExtent) * psRx;
  const curPy = psCy - (current.vNorm / maxExtent) * psRy;
  ctx.fillStyle = inkPrimary;
  ctx.beginPath();
  ctx.arc(curPx, curPy, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.direction = "ltr";
  ctx.font = "9.5px ui-monospace, SFMono-Regular, monospace";
  ctx.fillStyle = inkMuted;
  ctx.textAlign = "left";
  ctx.fillText("Phase (x, v/ω₀)", leftPad, psTop + 8);
  ctx.restore();

  // --- RIGHT SUB-PANEL: Exact Bode Amplitude Resonance Curve M(ω/ω₀) ---
  const bPadL = splitX + 34;
  const bPadR = 16;
  const bPlotW = Math.max(110, width - bPadL - bPadR);
  const bPlotH = Math.max(100, height - padT - padB);
  const bBaseY = padT + bPlotH;
  const rMax = 2.4;

  // Dynamic Y scale accommodating sharp resonance cleanly
  const yCeiling = Math.max(2.2, Math.min(12.0, metrics.peakMagnification * 1.18));
  const bToX = (r: number) => bPadL + (r / rMax) * bPlotW;
  const bToY = (mag: number) => bBaseY - Math.min(bPlotH, (mag / yCeiling) * bPlotH);

  // Axes
  ctx.strokeStyle = axisLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bPadL + 0.5, padT);
  ctx.lineTo(bPadL + 0.5, bBaseY + 0.5);
  ctx.lineTo(bPadL + bPlotW, bBaseY + 0.5);
  ctx.stroke();

  // Natural frequency r = 1.0 dashed guide
  const r1X = bToX(1.0);
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = isDark ? "rgba(237, 242, 245, 0.25)" : "rgba(17, 22, 27, 0.25)";
  ctx.beginPath();
  ctx.moveTo(r1X, padT);
  ctx.lineTo(r1X, bBaseY);
  ctx.stroke();

  // Half-power (-3 dB = peak / √2) reference line when underdamped resonant
  if (metrics.resonanceRatio !== null && metrics.peakMagnification > 1.25) {
    const hpY = bToY(metrics.peakMagnification * Math.SQRT1_2);
    ctx.strokeStyle = isDark ? "rgba(237, 242, 245, 0.16)" : "rgba(17, 22, 27, 0.16)";
    ctx.beginPath();
    ctx.moveTo(bPadL, hpY);
    ctx.lineTo(bPadL + bPlotW, hpY);
    ctx.stroke();
  }
  ctx.restore();

  // Bode curve fill & stroke
  ctx.beginPath();
  ctx.moveTo(bPadL, bBaseY);
  const bSteps = 140;
  for (let i = 0; i <= bSteps; i++) {
    const r = (i / bSteps) * rMax;
    const s = sampleOscillatorBode(r, metrics.dampingRatio);
    ctx.lineTo(bToX(r), bToY(s.magnification));
  }
  ctx.lineTo(bPadL + bPlotW, bBaseY);
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.globalAlpha = isDark ? 0.2 : 0.14;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= bSteps; i++) {
    const r = (i / bSteps) * rMax;
    const s = sampleOscillatorBode(r, metrics.dampingRatio);
    const x = bToX(r);
    const y = bToY(s.magnification);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Secondary Bode Phase Lag Curve δ(ω/ω₀) ∈ [0°, 180°] passing through exact 90° at r = 1
  const phaseToY = (deg: number) => bBaseY - (deg / 180) * bPlotH;
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.52)" : "rgba(2, 132, 199, 0.55)";
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  for (let i = 0; i <= bSteps; i++) {
    const r = (i / bSteps) * rMax;
    const s = sampleOscillatorBode(r, metrics.dampingRatio);
    const x = bToX(r);
    const y = phaseToY(s.phaseLagDeg);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Exact static gain M = 1.0 reference tick + resonance peak marker r_res = √(1 - 2ζ²)
  const yOne = bToY(1.0);
  if (yOne > padT + 14 && yOne < bBaseY - 8) {
    ctx.strokeStyle = axisLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bPadL - 3, yOne + 0.5);
    ctx.lineTo(bPadL + 3, yOne + 0.5);
    ctx.stroke();
  }

  // Active operating point at current driveRatio
  const opX = bToX(Math.min(rMax, metrics.driveRatio));
  const opY = bToY(metrics.magnification);
  ctx.save();
  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(opX, opY);
  ctx.lineTo(opX, bBaseY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = inkPrimary;
  ctx.beginPath();
  ctx.arc(opX, opY, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Bode labels & calibrated ticks
  ctx.save();
  ctx.direction = "ltr";
  ctx.font = "9px ui-monospace, SFMono-Regular, monospace";
  ctx.fillStyle = inkMuted;
  ctx.textAlign = "left";
  ctx.fillText("Bode M & δ°", bPadL + 6, padT + 9);
  ctx.textAlign = "right";
  ctx.fillText(`${yCeiling.toFixed(1)}×`, bPadL - 4, padT + 6);
  if (yOne > padT + 16 && yOne < bBaseY - 8) {
    ctx.fillText("1×", bPadL - 4, yOne + 3);
  }
  ctx.textAlign = "center";
  for (const rTick of [0.5, 1.0, 1.5, 2.0]) {
    ctx.fillText(rTick.toFixed(1), bToX(rTick), bBaseY + 12);
  }
  ctx.restore();

  // Interactive Pointer Probe
  let probeText: string | null = null;
  if (ptr) {
    const pointerPxX = ptr.nx * width;
    if (pointerPxX >= splitX) {
      const clampedX = Math.min(bPadL + bPlotW, Math.max(bPadL, pointerPxX));
      const rProbe = ((clampedX - bPadL) / bPlotW) * rMax;
      const sample = sampleOscillatorBode(rProbe, metrics.dampingRatio);
      const py = bToY(sample.magnification);

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = inkPrimary;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(clampedX, padT);
      ctx.lineTo(clampedX, bBaseY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = inkPrimary;
      ctx.beginPath();
      ctx.arc(clampedX, py, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const dbSign = sample.gainDb >= 0 ? "+" : "";
      probeText = `ω/ω₀=${rProbe.toFixed(2)} · M=${sample.magnification.toFixed(2)}× (${dbSign}${sample.gainDb.toFixed(1)}dB) · δ=${sample.phaseLagDeg.toFixed(1)}°`;
    } else {
      probeText = `t=${current.t.toFixed(2)}s · x=${current.x >= 0 ? "+" : ""}${current.x.toFixed(2)}A₀ · v/ω₀=${current.vNorm >= 0 ? "+" : ""}${current.vNorm.toFixed(2)}A₀`;
    }
  }

  return {
    probeText,
    liveX: current.x,
    liveVNorm: current.vNorm,
  };
}

// ---------------------------------------------------------------------------
// 7. Special Relativity: Minkowski Spacetime & Dual Clocks Canvas
// ---------------------------------------------------------------------------

export function drawRelativityCanvas(
  ctx: CanvasRenderingContext2D,
  theme: ExtendedCanvasTheme,
  metrics: RelativityMetrics
): string | null {
  const { width, height, t, isDark, inkPrimary, inkMuted, accent, axisLine, ptr } = theme;
  const splitX = Math.round(width * 0.64);
  const padL = 18;
  const padT = 16;
  const padB = 28;
  const diagW = Math.max(140, splitX - padL - 12);
  const diagH = Math.max(120, height - padT - padB);
  const cx = padL + diagW * 0.5;
  const cy = padT + diagH * 0.58;
  const unitPx = Math.min(diagW * 0.145, diagH * 0.175);
  const spanUnits = 3.2;

  const toX = (x: number) => cx + x * unitPx;
  const toY = (ct: number) => cy - ct * unitPx;

  // Vertical divider between Minkowski Diagram (left) and Clocks / Rod (right)
  ctx.strokeStyle = axisLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(splitX + 0.5, 10);
  ctx.lineTo(splitX + 0.5, height - 24);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, diagW, diagH);
  ctx.clip();

  // Invariant timelike proper-time hyperbolas (ct)² - x² = τ² (τ = 1, 2)
  // AND spacelike calibration hyperbola x² - (ct)² = 1 (x > 0) for exact unit rod calibration
  ctx.strokeStyle = isDark ? "rgba(237, 242, 245, 0.16)" : "rgba(17, 22, 27, 0.16)";
  ctx.lineWidth = 1;
  for (const tau of [1, 2]) {
    ctx.beginPath();
    for (let i = -40; i <= 40; i++) {
      const x = (i / 40) * spanUnits;
      const ct = Math.hypot(tau, x);
      const px = toX(x);
      const py = toY(ct);
      if (i === -40) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // Spacelike unit hyperbola x = √(1 + (ct)²)
  ctx.beginPath();
  for (let i = -36; i <= 36; i++) {
    const ct = (i / 36) * spanUnits;
    const x = Math.hypot(1, ct);
    const px = toX(x);
    const py = toY(ct);
    if (i === -36) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Exact 45° invariant light cones (x = ±ct)
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = isDark ? "rgba(250, 204, 21, 0.58)" : "rgba(202, 138, 4, 0.68)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(toX(-spanUnits), toY(-spanUnits));
  ctx.lineTo(toX(spanUnits), toY(spanUnits));
  ctx.moveTo(toX(-spanUnits), toY(spanUnits));
  ctx.lineTo(toX(spanUnits), toY(-spanUnits));
  ctx.stroke();
  ctx.restore();

  // Rest-frame orthogonal axes (x, ct)
  ctx.strokeStyle = axisLine;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(padL, cy + 0.5);
  ctx.lineTo(padL + diagW, cy + 0.5);
  ctx.moveTo(cx + 0.5, padT);
  ctx.lineTo(cx + 0.5, padT + diagH);
  ctx.stroke();

  // Lorentz-boosted primed axes (ct': x = β ct, x': ct = β x)
  const b = metrics.beta;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  // ct' worldline
  ctx.moveTo(toX(-b * spanUnits), toY(-spanUnits));
  ctx.lineTo(toX(b * spanUnits), toY(spanUnits));
  // x' simultaneity line
  ctx.moveTo(toX(-spanUnits), toY(-b * spanUnits));
  ctx.lineTo(toX(spanUnits), toY(b * spanUnits));
  ctx.stroke();

  // Highlight τ = 1 proper-time calibration dot on ct' (x = βγ, ct = γ)
  // and geometric length-contraction intercept on x-axis at x = 1/γ
  const calX = toX(b * metrics.gamma);
  const calY = toY(metrics.gamma);
  if (calY > padT + 4 && calX < padL + diagW - 4) {
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, calY);
    ctx.lineTo(calX, calY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(calX, calY, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Geometric proof of length contraction: contracted segment [0, 1/γ] on rest x-axis
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(toX(0), cy + 0.5);
  ctx.lineTo(toX(metrics.contractionRatio), cy + 0.5);
  ctx.stroke();
  ctx.restore();

  // Animated photon pulse along future light cone + moving traveler along ct' worldline
  const cycle = (t * 0.55) % 2.4;
  // Photon at x = ct = cycle
  ctx.fillStyle = isDark ? "#facc15" : "#ca8a04";
  ctx.beginPath();
  ctx.arc(toX(cycle), toY(cycle), 3.3, 0, Math.PI * 2);
  ctx.fill();

  // Traveler at coordinate time ct = cycle -> x = β * cycle (with Earth simultaneity hairline)
  const travX = toX(b * cycle);
  const travY = toY(cycle);
  ctx.save();
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = isDark ? "rgba(237, 242, 245, 0.25)" : "rgba(17, 22, 27, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, travY);
  ctx.lineTo(travX, travY);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = inkPrimary;
  ctx.beginPath();
  ctx.arc(travX, travY, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Axis labels
  ctx.direction = "ltr";
  ctx.font = "10px ui-monospace, SFMono-Regular, monospace";
  ctx.fillStyle = inkMuted;
  ctx.textAlign = "left";
  ctx.fillText("ct", cx + 5, padT + 11);
  ctx.textAlign = "right";
  ctx.fillText("x", padL + diagW - 5, cy - 5);
  ctx.fillStyle = accent;
  const ctPrimeLabelX = Math.max(cx + 12, Math.min(padL + diagW - 14, toX(b * 2.15) - 6));
  const ctPrimeLabelY = Math.max(padT + 14, toY(2.15));
  ctx.textAlign = "right";
  ctx.fillText("ct'", ctPrimeLabelX, ctPrimeLabelY);
  if (b > 0.05) {
    ctx.textAlign = "left";
    ctx.fillText(
      "x'",
      Math.min(padL + diagW - 18, toX(2.15) + 4),
      Math.min(cy - 6, Math.max(padT + 22, toY(b * 2.15) + 12))
    );
  }

  // Interactive Pointer Probe: exact Lorentz transform + oblique primed-axis projections
  let probeText: string | null = null;
  if (ptr && ptr.nx * width < splitX) {
    const px = Math.min(padL + diagW, Math.max(padL, ptr.nx * width));
    const py = Math.min(padT + diagH, Math.max(padT, ptr.ny * height));
    const evX = (px - cx) / unitPx;
    const evCt = (cy - py) / unitPx;
    const tr = lorentzTransformEvent(evX, evCt, b);

    ctx.save();
    // Subtle orthogonal rest-frame projections onto (x, ct)
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = isDark ? "rgba(237, 242, 245, 0.35)" : "rgba(17, 22, 27, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, py);
    ctx.lineTo(px, py);
    ctx.moveTo(px, cy);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Exact oblique Lorentz projections parallel to x' and ct' onto the primed axes!
    // Intercept on ct' axis (where x' = 0): (β γ ct', γ ct')
    // Intercept on x' axis (where ct' = 0): (γ x', β γ x')
    const ctProjX = toX(b * metrics.gamma * tr.ctPrime);
    const ctProjY = toY(metrics.gamma * tr.ctPrime);
    const xProjX = toX(metrics.gamma * tr.xPrime);
    const xProjY = toY(b * metrics.gamma * tr.xPrime);

    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(ctProjX, ctProjY);
    ctx.moveTo(px, py);
    ctx.lineTo(xProjX, xProjY);
    ctx.stroke();
    ctx.setLineDash([]);

    const dotColor =
      tr.causalClass === "timelike"
        ? accent
        : tr.causalClass === "lightlike"
          ? "#eab308"
          : inkPrimary;
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const kindLabel =
      tr.causalClass === "timelike"
        ? "TIMELIKE"
        : tr.causalClass === "lightlike"
          ? "LIGHTLIKE"
          : "SPACELIKE";
    probeText = `(x,ct)=(${evX.toFixed(2)},${evCt.toFixed(2)}) → (x',ct')=(${tr.xPrime.toFixed(2)},${tr.ctPrime.toFixed(2)}) · s²=${tr.intervalS2.toFixed(2)} ${kindLabel}`;
  }

  ctx.restore();

  // --- RIGHT SUB-PANEL: Synchronized Rest vs Dilated Clocks + Lorentz-Contracted Rod ---
  const rPad = 14;
  const rLeft = splitX + rPad;
  const rW = Math.max(84, width - splitX - rPad * 2);
  const rMid = rLeft + rW / 2;

  // Dual clocks stacked vertically or side-by-side depending on available width
  const clockRadius = Math.min(26, Math.max(18, rW * 0.2));
  const clockRowY = padT + clockRadius + 24;
  const clock1X = rW > 140 ? rLeft + rW * 0.26 : rMid;
  const clock2X = rW > 140 ? rLeft + rW * 0.74 : rMid;
  const clock2Y = rW > 140 ? clockRowY : clockRowY + clockRadius * 2 + 26;

  const drawDial = (
    dx: number,
    dy: number,
    angleRad: number,
    title: string,
    sub: string,
    highlight: boolean
  ) => {
    ctx.save();
    ctx.strokeStyle = highlight ? accent : axisLine;
    ctx.lineWidth = highlight ? 1.7 : 1.25;
    ctx.beginPath();
    ctx.arc(dx, dy, clockRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 12-hour cardinal ticks
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(dx + Math.cos(a) * (clockRadius - 4), dy + Math.sin(a) * (clockRadius - 4));
      ctx.lineTo(dx + Math.cos(a) * (clockRadius - 1), dy + Math.sin(a) * (clockRadius - 1));
      ctx.stroke();
    }

    // Clock hand
    const handAngle = angleRad - Math.PI / 2;
    ctx.strokeStyle = highlight ? accent : inkPrimary;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(
      dx + Math.cos(handAngle) * (clockRadius - 5),
      dy + Math.sin(handAngle) * (clockRadius - 5)
    );
    ctx.stroke();

    ctx.fillStyle = inkPrimary;
    ctx.beginPath();
    ctx.arc(dx, dy, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.direction = "ltr";
    ctx.font = "9.5px ui-monospace, SFMono-Regular, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = highlight ? accent : inkMuted;
    ctx.fillText(title, dx, dy - clockRadius - 6);
    ctx.fillStyle = inkMuted;
    ctx.fillText(sub, dx, dy + clockRadius + 12);
    ctx.restore();
  };

  const restRate = t * 1.4;
  const movingRate = restRate / metrics.gamma;
  drawDial(clock1X, clockRowY, restRate, "REST t", "1.00×", false);
  drawDial(
    clock2X,
    clock2Y,
    movingRate,
    "MOVING τ",
    `${(1 / metrics.gamma).toFixed(2)}×`,
    true
  );

  // Length contraction visual gauge at bottom of right sub-panel
  const rodBaseY = Math.max(clock2Y + clockRadius + 30, height - 66);
  if (rodBaseY < height - 28) {
    const rodMaxW = Math.max(40, rW - 6);
    const contractedW = Math.max(3, rodMaxW * metrics.contractionRatio);

    ctx.save();
    ctx.direction = "ltr";
    ctx.font = "9.5px ui-monospace, SFMono-Regular, monospace";
    ctx.fillStyle = inkMuted;
    ctx.textAlign = "left";
    ctx.fillText("L₀ (rest)", rLeft, rodBaseY - 4);
    ctx.fillStyle = isDark ? "rgba(237, 242, 245, 0.25)" : "rgba(17, 22, 27, 0.22)";
    ctx.fillRect(rLeft, rodBaseY, rodMaxW, 6);

    ctx.fillStyle = accent;
    ctx.fillText(`L = L₀/γ (${(metrics.contractionRatio * 100).toFixed(1)}%)`, rLeft, rodBaseY + 19);
    ctx.fillRect(rLeft, rodBaseY + 23, contractedW, 6);
    ctx.restore();
  }

  return probeText;
}

// ---------------------------------------------------------------------------
// 8. Lorenz Strange Attractor & Twin-Trajectory Butterfly Chaos Canvas
// ---------------------------------------------------------------------------

export function drawLorenzCanvas(
  ctx: CanvasRenderingContext2D,
  theme: ExtendedCanvasTheme,
  lorenz: LorenzTwinResult,
  azimuthRad: number
): { probeText: string | null; liveSeparation: number } {
  const { width, height, t, isDark, inkPrimary, inkMuted, accent, axisLine, ptr } = theme;
  const { pointsA, pointsB, separations, metrics } = lorenz;
  const nPts = pointsA.length;

  const cosA = Math.cos(azimuthRad);
  const sinA = Math.sin(azimuthRad);
  const cx = width * 0.48;
  const cy = height * 0.52;

  // Dynamic projection scale fitted to attractor extent
  const zMid = Math.max(12, metrics.rho * 0.88);
  const xySpan = Math.max(22, Math.sqrt(Math.max(4, metrics.beta * metrics.rho)) * 2.55);
  const scale = Math.min((width * 0.42) / xySpan, (height * 0.42) / Math.max(16, metrics.rho * 0.88));

  const project = (x: number, y: number, z: number): [number, number] => {
    const xr = x * cosA - y * sinA;
    const yr = x * sinA + y * cosA;
    // Slight 14° elevation tilt so 3D butterfly lobes read clearly at every azimuth
    const px = cx + xr * scale;
    const py = cy - (z - zMid) * scale * 0.94 + yr * scale * 0.18;
    return [px, py];
  };

  // Fixed points C₊ and C₋ (exact algebraic convection centers)
  if (metrics.fixedPointPos && metrics.fixedPointNeg) {
    ctx.save();
    for (const [fp, label, side] of [
      [metrics.fixedPointPos, "C₊", 1],
      [metrics.fixedPointNeg, "C₋", -1],
    ] as const) {
      const [fx, fy] = project(fp.x, fp.y, fp.z);
      ctx.strokeStyle = inkMuted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.direction = "ltr";
      ctx.font = "9px ui-monospace, SFMono-Regular, monospace";
      ctx.fillStyle = inkMuted;
      ctx.textAlign = side > 0 ? "left" : "right";
      ctx.fillText(label, fx + side * 6, fy + 3);
    }
    ctx.restore();
  }

  // Animated progress head sweeping smoothly along the twin RK4 trajectories.
  // Offset by 58% at t=0 so first-paint immediately showcases the butterfly divergence!
  const speedPtsPerSec = 140;
  const startOffset = Math.floor(nPts * 0.58);
  const headIdx =
    nPts > 2 ? Math.floor((startOffset + t * speedPtsPerSec) % (nPts - 1)) : 0;

  // Faint full attractor silhouette for primary trajectory
  ctx.beginPath();
  for (let i = 0; i < nPts; i += 2) {
    const p = pointsA[i];
    const [px, py] = project(p.x, p.y, p.z);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = isDark ? "rgba(237, 242, 245, 0.16)" : "rgba(17, 22, 27, 0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Active animated trails up to headIdx (recent 360 samples) for BOTH twin trajectories
  const trailLen = 360;
  const startIdx = Math.max(0, headIdx - trailLen);

  // Twin B (perturbed by δ₀ = 10⁻⁵) in crisp cyan/sky contrast
  const twinColor = isDark ? "#38bdf8" : "#0284c7";
  ctx.beginPath();
  for (let i = startIdx; i <= headIdx; i++) {
    const p = pointsB[i];
    const [px, py] = project(p.x, p.y, p.z);
    if (i === startIdx) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = twinColor;
  ctx.globalAlpha = 0.88;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Primary A in accent color
  ctx.beginPath();
  for (let i = startIdx; i <= headIdx; i++) {
    const p = pointsA[i];
    const [px, py] = project(p.x, p.y, p.z);
    if (i === startIdx) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 1.75;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Live twin beads + separation chord when diverged
  const headA = pointsA[headIdx] ?? pointsA[0];
  const headB = pointsB[headIdx] ?? pointsB[0];
  const liveSep = separations[headIdx] ?? 1e-5;
  const [ax, ay] = project(headA.x, headA.y, headA.z);
  const [bx, by] = project(headB.x, headB.y, headB.z);

  if (Math.hypot(bx - ax, by - ay) > 6) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = inkPrimary;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = twinColor;
  ctx.beginPath();
  ctx.arc(bx, by, 3.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(ax, ay, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = inkPrimary;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // --- Inset Log₁₀ Separation Sparkline (top-right corner) showing exponential butterfly divergence ---
  const boxW = Math.min(124, Math.max(88, width * 0.24));
  const boxH = 44;
  const boxX = width - boxW - 12;
  const boxY = 12;

  ctx.save();
  ctx.fillStyle = isDark ? "rgba(15, 20, 22, 0.78)" : "rgba(255, 255, 255, 0.82)";
  ctx.strokeStyle = axisLine;
  ctx.lineWidth = 1;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

  ctx.beginPath();
  const minLog = -5.5;
  const maxLog = 2.0;
  for (let i = 0; i < nPts; i += 6) {
    const sx = boxX + 4 + (i / Math.max(1, nPts - 1)) * (boxW - 8);
    const logVal = Math.log10(Math.max(1e-6, separations[i]));
    const normY = Math.min(1, Math.max(0, (logVal - minLog) / (maxLog - minLog)));
    const sy = boxY + boxH - 5 - normY * (boxH - 18);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.strokeStyle = twinColor;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // Theoretical Benettin exponential Lyapunov reference slope log₁₀(δ₀) + (λ₁ / ln 10) t
  if (metrics.regime === "chaotic" && metrics.lyapunovMax > 0.05) {
    const log0 = Math.log10(Math.max(1e-6, separations[0] ?? 1e-5));
    const slopePerSample = (metrics.lyapunovMax * lorenz.sampleDt) / Math.LN10;
    const satSample = Math.min(nPts - 1, Math.max(1, (1.4 - log0) / Math.max(1e-6, slopePerSample)));
    const x0 = boxX + 4;
    const y0 = boxY + boxH - 5 - Math.min(1, Math.max(0, (log0 - minLog) / (maxLog - minLog))) * (boxH - 18);
    const x1 = boxX + 4 + (satSample / Math.max(1, nPts - 1)) * (boxW - 8);
    const y1 = boxY + boxH - 5 - Math.min(1, Math.max(0, (1.4 - minLog) / (maxLog - minLog))) * (boxH - 18);
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  // Progress marker inside inset sparkline
  const progX = boxX + 4 + (headIdx / Math.max(1, nPts - 1)) * (boxW - 8);
  const progLog = Math.log10(Math.max(1e-6, liveSep));
  const progNorm = Math.min(1, Math.max(0, (progLog - minLog) / (maxLog - minLog)));
  const progY = boxY + boxH - 5 - progNorm * (boxH - 18);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(progX, progY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.direction = "ltr";
  ctx.font = "8.5px ui-monospace, SFMono-Regular, monospace";
  ctx.fillStyle = inkMuted;
  ctx.textAlign = "left";
  ctx.fillText("log₁₀‖Δr(t)‖", boxX + 5, boxY + 10);
  ctx.restore();

  // Interactive Pointer Probe
  let probeText: string | null = null;
  if (ptr) {
    const azDeg = Math.round(((azimuthRad * 180) / Math.PI) % 360);
    const sepStr = liveSep < 0.01 ? liveSep.toExponential(1) : liveSep.toFixed(2);
    probeText = `t=${(headIdx * lorenz.sampleDt).toFixed(2)} · ‖Δr‖=${sepStr} · r₁=(${headA.x.toFixed(1)},${headA.y.toFixed(1)},${headA.z.toFixed(1)}) · θ=${azDeg}°`;
  }

  return {
    probeText,
    liveSeparation: liveSep,
  };
}
