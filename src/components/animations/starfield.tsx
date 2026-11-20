"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

export function Starfield({ density = 140 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSmallViewport = window.matchMedia("(max-width: 639px)").matches;
    const animateLoop = !reducedMotion;
    const frameIntervalMs = isSmallViewport ? 33 : 0;

    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let mouseX = 0;
    let mouseY = 0;
    let raf = 0;
    let visible = true;
    let lastDraw = 0;

    function renderFrame(t: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      const parallaxX = animateLoop ? mouseX * 6 : 0;
      const parallaxY = animateLoop ? mouseY * 6 : 0;

      for (const s of stars) {
        const alpha = animateLoop
          ? s.baseAlpha * (0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase))
          : s.baseAlpha;
        ctx.beginPath();
        ctx.fillStyle = `rgba(245, 245, 250, ${alpha})`;
        ctx.arc(s.x + parallaxX, s.y + parallaxY, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function resize() {
      const current = canvasRef.current;
      if (!current || !ctx) return;
      width = current.clientWidth;
      height = current.clientHeight;
      if (width === 0 || height === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      current.width = Math.round(width * dpr);
      current.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.floor((width * height) / (10000 / (density / 140)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.3 + 0.2,
        baseAlpha: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 0.012 + 0.004,
        twinklePhase: Math.random() * Math.PI * 2,
      }));

      renderFrame(0);
    }

    function onMouseMove(e: MouseEvent) {
      const current = canvasRef.current;
      if (!current || !visible) return;
      const rect = current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }

    function tick(t: number) {
      if (!visible) {
        raf = 0;
        return;
      }
      if (frameIntervalMs === 0 || t - lastDraw >= frameIntervalMs) {
        lastDraw = t;
        renderFrame(t);
      }
      raf = requestAnimationFrame(tick);
    }

    // Defer initial canvas sizing by one frame so it never forces layout during hydration.
    const initRaf = requestAnimationFrame(() => {
      resize();
      if (animateLoop && visible) {
        raf = requestAnimationFrame(tick);
      }
    });

    let observer: IntersectionObserver | null = null;
    if (animateLoop && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          visible = entries.some((entry) => entry.isIntersecting);
          if (visible && raf === 0) {
            raf = requestAnimationFrame(tick);
          } else if (!visible && raf !== 0) {
            cancelAnimationFrame(raf);
            raf = 0;
          }
        },
        { threshold: 0 }
      );
      observer.observe(canvas);
    }

    window.addEventListener("resize", resize, { passive: true });
    if (animateLoop) {
      window.addEventListener("mousemove", onMouseMove, { passive: true });
    }

    return () => {
      cancelAnimationFrame(initRaf);
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      if (animateLoop) {
        window.removeEventListener("mousemove", onMouseMove);
      }
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
