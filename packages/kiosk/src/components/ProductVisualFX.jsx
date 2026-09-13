import React, { useEffect, useRef, useState } from 'react';
import './ProductVisualFX.css';

/**
 * ProductVisualFX
 * Sistem modular de efecte vizuale pentru ecranul de detalii al produsului:
 * 1. Parallax 3D Tilt & Specular Sheen (la atingere / mișcare)
 * 2. Abur cald (Steam/Smoke Canvas cu fizică organică)
 * 3. Zăpadă (Snowflakes Canvas pentru sezonul rece)
 */
export default function ProductVisualFX({
  heroRef,
  effects = { parallax: true, steam: true, snow: false },
  isHotProduct = true,
}) {
  const canvasRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false });
  const animFrameRef = useRef(null);

  // ─── 1. PARALLAX 3D TILT LISTENER ───
  useEffect(() => {
    if (!effects.parallax || !heroRef?.current) return;
    const el = heroRef.current;

    const handleMove = (clientX, clientY) => {
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const midX = rect.width / 2;
      const midY = rect.height / 2;
      
      const normX = Math.max(-1, Math.min(1, (x - midX) / midX));
      const normY = Math.max(-1, Math.min(1, (y - midY) / midY));

      setTilt({
        rx: -normY * 10,       // Max 10 deg vertical tilt
        ry: normX * 12,        // Max 12 deg horizontal tilt
        glareX: 50 + normX * 35,
        glareY: 50 + normY * 35,
        active: true,
      });
    };

    const handleTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleMouseMove = (e) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleReset = () => {
      setTilt(prev => ({ ...prev, rx: 0, ry: 0, glareX: 50, glareY: 50, active: false }));
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('mouseleave', handleReset);
    el.addEventListener('touchend', handleReset);
    el.addEventListener('touchcancel', handleReset);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('mouseleave', handleReset);
      el.removeEventListener('touchend', handleReset);
      el.removeEventListener('touchcancel', handleReset);
    };
  }, [effects.parallax, heroRef]);

  // Aplicăm stilurile de transformare 3D direct pe heroRef
  useEffect(() => {
    if (!heroRef?.current) return;
    const imgEl = heroRef.current.querySelector('.ps-hero-img') || heroRef.current.querySelector('img');
    if (!imgEl) return;

    if (effects.parallax && tilt.active) {
      heroRef.current.style.perspective = '1000px';
      imgEl.style.transform = `scale(1.04) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(18px)`;
      imgEl.style.transition = 'transform 0.08s ease-out';
      imgEl.style.willChange = 'transform';
    } else if (effects.parallax) {
      imgEl.style.transform = 'scale(1) rotateX(0deg) rotateY(0deg) translateZ(0)';
      imgEl.style.transition = 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
    } else {
      imgEl.style.transform = 'none';
      imgEl.style.transition = 'none';
    }
  }, [tilt, effects.parallax, heroRef]);

  // ─── 2. STEAM (ABUR) & SNOW (ZĂPADĂ) CANVAS ENGINE ───
  useEffect(() => {
    const showSteam = effects.steam && isHotProduct;
    const showSnow = effects.snow;

    if (!showSteam && !showSnow) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', onResize);

    // Initializare particule Steam (Abur organic)
    const steamParticles = [];
    const MAX_STEAM = 22;

    const createSteamParticle = (initialRandomY = false) => {
      // Zona de pornire a aburului: centrul produsului (burger/cartofi)
      const startX = width * (0.28 + Math.random() * 0.44);
      const startY = initialRandomY 
        ? height * (0.45 + Math.random() * 0.4) 
        : height * (0.75 + Math.random() * 0.15);

      return {
        x: startX,
        y: startY,
        baseX: startX,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.55 + Math.random() * 0.65, // Viteza de urcare
        radius: 18 + Math.random() * 16,
        growth: 0.35 + Math.random() * 0.3,
        alpha: 0,
        maxAlpha: 0.28 + Math.random() * 0.22, // Densitate abur delicată
        life: initialRandomY ? Math.random() * 100 : 0,
        maxLife: 150 + Math.random() * 60,
        swayFreq: 0.02 + Math.random() * 0.02,
        swayAmp: 14 + Math.random() * 16,
      };
    };

    if (showSteam) {
      for (let i = 0; i < MAX_STEAM; i++) {
        steamParticles.push(createSteamParticle(true));
      }
    }

    // Initializare particule Snow (Zăpadă)
    const snowParticles = [];
    const MAX_SNOW = 35;
    if (showSnow) {
      for (let i = 0; i < MAX_SNOW; i++) {
        snowParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 1.5 + Math.random() * 3,
          vy: 0.6 + Math.random() * 1.2,
          vx: (Math.random() - 0.5) * 0.4,
          sway: Math.random() * Math.PI,
          alpha: 0.4 + Math.random() * 0.5,
        });
      }
    }

    // Loop de randare la 60 FPS
    let isRunning = true;
    const render = () => {
      if (!isRunning) return;
      ctx.clearRect(0, 0, width, height);

      // ─── Randare Steam (Abur) ───
      if (showSteam) {
        for (let i = 0; i < steamParticles.length; i++) {
          const p = steamParticles[i];
          p.life++;
          p.y -= p.vy;
          p.x = p.baseX + Math.sin(p.life * p.swayFreq) * p.swayAmp;
          p.radius += p.growth;

          // Calcul opacitate: fade in lin, apoi fade out spre vârf
          const progress = p.life / p.maxLife;
          if (progress < 0.2) {
            p.alpha = (progress / 0.2) * p.maxAlpha;
          } else if (progress > 0.6) {
            p.alpha = Math.max(0, (1 - (progress - 0.6) / 0.4) * p.maxAlpha);
          } else {
            p.alpha = p.maxAlpha;
          }

          // Desenăm aburul cu gradient radial fin
          if (p.alpha > 0.01 && p.radius > 0) {
            const grad = ctx.createRadialGradient(p.x, p.y, p.radius * 0.1, p.x, p.y, p.radius);
            grad.addColorStop(0, `rgba(255, 255, 255, ${p.alpha * 0.65})`);
            grad.addColorStop(0.35, `rgba(255, 255, 255, ${p.alpha * 0.35})`);
            grad.addColorStop(0.7, `rgba(255, 255, 255, ${p.alpha * 0.12})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.save();
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // Reset când iese din cadru sau expiră viața
          if (p.life >= p.maxLife || p.y + p.radius < 0) {
            steamParticles[i] = createSteamParticle(false);
          }
        }
      }

      // ─── Randare Snow (Zăpadă) ───
      if (showSnow) {
        for (let i = 0; i < snowParticles.length; i++) {
          const s = snowParticles[i];
          s.sway += 0.02;
          s.y += s.vy;
          s.x += Math.sin(s.sway) * 0.5 + s.vx;

          ctx.save();
          ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          if (s.y > height + 5) {
            s.y = -5;
            s.x = Math.random() * width;
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      window.removeEventListener('resize', onResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [effects.steam, effects.snow, isHotProduct]);

  return (
    <div className="ps-vfx-layer" aria-hidden="true">
      {/* Reflexie luminoasă speculară pentru efectul Parallax 3D */}
      {effects.parallax && tilt.active && (
        <div 
          className="ps-vfx-specular"
          style={{
            background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 70%)`
          }}
        />
      )}

      {/* Canvas pentru Abur Cald și Zăpadă */}
      {(effects.steam || effects.snow) && (
        <canvas ref={canvasRef} className="ps-vfx-canvas" />
      )}
    </div>
  );
}
