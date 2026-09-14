import React, { useEffect, useRef, useState } from 'react';
import { shouldShowSteam } from '../utils/visualFxUtils.js';
import './ProductVisualFX.css';

/**
 * ProductVisualFX
 * Sistem modular inteligent de efecte vizuale pentru ecranul de detalii și Category Hero Banner:
 * 1. Parallax 3D Tilt & Specular Sheen (la atingere / mișcare)
 * 2. Abur cald organic inteligent (Strict: Supe, Wok, Burgeri calzi, Cartofi calzi - FĂRĂ sushi, FĂRĂ bețe sushi)
 * 3. Efect de Gheață & Răcoritor (Băuturi: cristale sclipitoare, bule reci, abur înghețat)
 * 4. Efect de Logo Brand Plutitor (Deserturi: mici chips-uri cu logo brand plutind lin)
 * 5. Fără abur la sosuri, băuturi, deserturi, bețe sushi sau sushi rece
 */
export default function ProductVisualFX({
  heroRef,
  effects = { parallax: true, steam: true, ice: true, brandFloat: true },
  isHotProduct = null,
  product = null,
  brandLogo = null,
  brandId = null,
  categoryName = null,
}) {
  const canvasRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false });
  const animFrameRef = useRef(null);


  // Clasificare inteligentă a tipului de produs
  const catLower = (product?.categoryName || product?.parentGroupName || product?.categoryId || '').toLowerCase();
  const nameLower = (product?.name || '').toLowerCase();

  // 1. SOSURI: Fără abur, fără alte efecte
  const isSauce = Boolean(
    catLower.includes('sos') || catLower.includes('sauce') || catLower.includes('dip') ||
    nameLower.includes('sos ') || nameLower.startsWith('sos') || nameLower.includes('sauce') || 
    nameLower.includes('ketchup') || nameLower.includes('maionez') || nameLower.includes('mayo') || 
    nameLower.includes('mustar') || nameLower.includes('muștar') || nameLower.includes('garlic') || 
    nameLower.includes('usturoi') || nameLower.includes('sweet chili') || nameLower.includes('tartar') || 
    nameLower.includes('remoulade') || nameLower.includes('dip')
  );

  // 2. DESERTURI: Fără abur, cu mici logo-uri brand plutind lin
  const isDessert = !isSauce && Boolean(
    catLower.includes('desert') || catLower.includes('dessert') || catLower.includes('dulce') || 
    catLower.includes('sweet') || catLower.includes('prajitur') || catLower.includes('inghetat') || 
    nameLower.includes('desert') || nameLower.includes('brownie') || nameLower.includes('lava cake') || 
    nameLower.includes('cheesecake') || nameLower.includes('tiramisu') || nameLower.includes('churros') || 
    nameLower.includes('clatit') || nameLower.includes('pancake') || nameLower.includes('waffle') || 
    nameLower.includes('donut') || nameLower.includes('gogoas') || nameLower.includes('inghetata') || 
    nameLower.includes('înghețată') || nameLower.includes('ice cream') || nameLower.includes('muffin') || 
    nameLower.includes('cookie') || nameLower.includes('tart') || nameLower.includes('ecler')
  );

  // 3. BĂUTURI: Fără abur, cu efect de gheață & bule efervescente reci
  // REGULĂ STRICTĂ: Bulele apar EXCLUSIV la categoria dedicată de băuturi / răcoritoare!
  // NICIODATĂ la mâncare, sushi, platouri, seturi sau combo-uri chiar dacă au băutură inclusă (ex: Combo Big Set + Cola)
  const isFoodOrMeal = Boolean(
    /combo|set|platou|box|meniu|menu|roll|sushi|maki|nigiri|sashimi|gunkan|uramaki|burger|crispy|strips|nuggets|cartofi|fries|wrap|shaorma|pizza|wok|supa|supă/i.test(nameLower) ||
    /mancare|mâncare|food|sushi|roll|burger|pui|chicken|set|combo|platou|box|cartofi|fries|wok|supe/i.test(catLower)
  );

  const isDrinkCategory = Boolean(
    catLower.includes('bautur') || catLower.includes('băutur') || catLower.includes('drink') || 
    catLower.includes('beverage') || catLower.includes('racoritoare') || catLower.includes('răcoritoare') || 
    catLower.includes('suc') || catLower.includes('bere') || catLower.includes('cocktail') || 
    catLower.includes('limonad') || catLower.includes('bar') || catLower.includes('apa') || catLower.includes('apă')
  );

  const isStandaloneDrink = Boolean(
    nameLower.startsWith('coca-cola') || nameLower.startsWith('coca cola') || nameLower.startsWith('cola ') || 
    nameLower.startsWith('pepsi') || nameLower.startsWith('fanta') || nameLower.startsWith('sprite') || 
    nameLower.startsWith('apa ') || nameLower.startsWith('apă ') ||
    nameLower.startsWith('bere ') || nameLower.startsWith('beer ') || nameLower.startsWith('cidru ') || 
    nameLower.startsWith('limonad') || nameLower.startsWith('lemonade') || nameLower.startsWith('smoothie') || 
    nameLower.startsWith('frappe') || nameLower.startsWith('ayran') || nameLower.startsWith('ice tea') || 
    nameLower.startsWith('lipton') || nameLower.startsWith('fuze') || nameLower.startsWith('red bull') || 
    nameLower.startsWith('energy drink')
  );

  const isColdDrink = !isSauce && !isDessert && !isFoodOrMeal && (isDrinkCategory || isStandaloneDrink);

  // 4. MÂNCARE CALDĂ: Abur exclusiv la mâncare fierbinte validată (Supe, Wok, Burgeri/Pui cald)
  const isHot = (isHotProduct !== null && isHotProduct !== undefined)
    ? Boolean(isHotProduct)
    : shouldShowSteam(product, brandId, categoryName);

  // Detectăm dacă este un combo / set cald cu 3 sau mai multe produse fierbinți (ex: 3 Dublu Burgeri, Trio)
  const isCombo = isHot && Boolean(
    /combo|trio|duo|share|platou|box|3\s*dublu|2\s*dublu|3\s*burgeri|3x/i.test(product?.name || '') ||
    /alege\s*[2345]|3\s*dublu|3\s*burgeri|2\s*burgeri/i.test(product?.description || '')
  );

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
        rx: -normY * 10,
        ry: normX * 12,
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

  // Aplicăm Slow Breathe Zoom pe toate produsele și transformare 3D la interacțiune/tilt
  useEffect(() => {
    if (!heroRef?.current) return;
    const imgEl = heroRef.current.querySelector('.hero-kfc-bg-img') || 
                  heroRef.current.querySelector('.ps-hero-img') || 
                  heroRef.current.querySelector('img');
    if (!imgEl) return;

    if (effects.parallax && tilt.active) {
      imgEl.classList.remove('ps-hero-breathe');
      heroRef.current.style.perspective = '1000px';
      imgEl.style.transform = `scale(1.04) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(18px)`;
      imgEl.style.transition = 'transform 0.08s ease-out';
      imgEl.style.willChange = 'transform';
    } else {
      imgEl.style.transform = '';
      imgEl.style.transition = '';
      imgEl.classList.add('ps-hero-breathe');
    }

    return () => {
      imgEl.classList.remove('ps-hero-breathe');
    };
  }, [tilt, effects.parallax, heroRef, product]);

  // ─── 2. CANVAS ENGINE (ABUR, BULE & ECRAN ÎNGHEȚAT LA BĂUTURI, DESERTURI) ───
  useEffect(() => {
    const showSteam = Boolean(effects.steam && isHot);
    const showColdDrink = Boolean(isColdDrink);

    if (!showSteam && !showColdDrink) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = canvas.offsetWidth || 0);
    let height = (canvas.height = canvas.offsetHeight || 0);

    const onResize = () => {
      if (!canvas) return;
      if (canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
      }
    };
    window.addEventListener('resize', onResize);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && canvas) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          if (cr.width > 0 && cr.height > 0) {
            width = (canvas.width = Math.round(cr.width));
            height = (canvas.height = Math.round(cr.height));
          }
        }
      });
      resizeObserver.observe(canvas);
    }

    // ─── A. PARTICULE STEAM (Abur fierbinte pe carne/brânză) ───
    const steamParticles = [];
    const MAX_STEAM = isCombo ? 36 : 24;

    const createSteamParticle = (initialRandomProgress = false) => {
      let startX, startY;

      if (isCombo) {
        // Distribuim aburii exclusiv pe partea superioară a celor 3 produse din compoziție (stânga, dreapta, centru)
        const zone = Math.floor(Math.random() * 3);
        if (zone === 0) {
          startX = width * (0.22 + Math.random() * 0.15);
          startY = height * (0.20 + Math.random() * 0.08);
        } else if (zone === 1) {
          startX = width * (0.63 + Math.random() * 0.15);
          startY = height * (0.20 + Math.random() * 0.08);
        } else {
          startX = width * (0.38 + Math.random() * 0.24);
          startY = height * (0.24 + Math.random() * 0.08);
        }
      } else {
        // Produs individual (Supe, Wok, Burgeri calzi): aburul iese organic din centrul/suprafața preparatului și urcă lin
        startX = width * (0.28 + Math.random() * 0.44);
        startY = height * (0.32 + Math.random() * 0.16);
      }

      const maxLife = 130 + Math.random() * 50;
      const initialLife = initialRandomProgress ? Math.random() * maxLife : 0;
      const currentY = startY - (initialRandomProgress ? (initialLife * 0.7) : 0);

      return {
        x: startX,
        y: currentY,
        baseX: startX,
        startY: startY,
        vx: (Math.random() - 0.5) * 0.35,
        vy: 0.65 + Math.random() * 0.60,
        radius: 14 + Math.random() * 14,
        growth: 0.38 + Math.random() * 0.28,
        alpha: 0,
        maxAlpha: isCombo ? (0.28 + Math.random() * 0.14) : (0.32 + Math.random() * 0.18),
        life: initialLife,
        maxLife: maxLife,
        swayFreq: 0.016 + Math.random() * 0.02,
        swayAmp: 14 + Math.random() * 16,
      };
    };

    // ─── B. PARTICULE BĂUTURI RECI (Bule Efervescente & Cristale Sclipitoare) ───
    const bubbleParticles = [];
    const MAX_BUBBLES = 22;
    const createBubbleParticle = (initialRandom = false) => {
      return {
        x: width * (0.28 + Math.random() * 0.44),
        y: initialRandom ? height * (0.34 + Math.random() * 0.38) : height * (0.70 + Math.random() * 0.10),
        r: 2.2 + Math.random() * 3.5,
        vy: 0.85 + Math.random() * 1.15,
        sway: Math.random() * Math.PI * 2,
        alpha: 0.35 + Math.random() * 0.45,
      };
    };

    const iceParticles = [];
    const MAX_ICE = 14;
    const createIceParticle = (initialRandom = false) => {
      return {
        x: width * (0.26 + Math.random() * 0.48),
        y: height * (0.30 + Math.random() * 0.45),
        radius: 3 + Math.random() * 4.5,
        life: initialRandom ? Math.random() * 100 : 0,
        maxLife: 100 + Math.random() * 80,
        maxAlpha: 0.70 + Math.random() * 0.30,
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.025,
      };
    };

    let initialized = false;
    const initParticles = () => {
      steamParticles.length = 0;
      bubbleParticles.length = 0;
      iceParticles.length = 0;

      if (showSteam) {
        for (let i = 0; i < MAX_STEAM; i++) {
          steamParticles.push(createSteamParticle(true));
        }
      }

      if (showColdDrink) {
        for (let i = 0; i < MAX_BUBBLES; i++) bubbleParticles.push(createBubbleParticle(true));
        for (let i = 0; i < MAX_ICE; i++) iceParticles.push(createIceParticle(true));
      }

      initialized = true;
    };

    if (width > 20 && height > 20) {
      initParticles();
    }

    // ─── LOOP DE RANDARE 60 FPS ───
    let isRunning = true;
    let frame = 0;

    const render = () => {
      if (!isRunning) return;
      frame++;

      // Asigurăm măsurarea exactă a dimensiunilor containerului chiar dacă montarea a fost asincronă
      if (canvas.offsetWidth > 20 && canvas.offsetHeight > 20) {
        if (width !== canvas.offsetWidth || height !== canvas.offsetHeight || !initialized) {
          width = (canvas.width = canvas.offsetWidth);
          height = (canvas.height = canvas.offsetHeight);
          if (!initialized) {
            initParticles();
          }
        }
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Randare Steam (Abur cald)
      if (showSteam && initialized) {
        for (let i = 0; i < steamParticles.length; i++) {
          const p = steamParticles[i];
          p.life++;
          p.y -= p.vy;
          p.x = p.baseX + Math.sin(p.life * p.swayFreq) * p.swayAmp;
          p.radius += p.growth;

          const progress = p.life / p.maxLife;
          if (progress < 0.2) {
            p.alpha = (progress / 0.2) * p.maxAlpha;
          } else if (progress > 0.6) {
            p.alpha = Math.max(0, (1 - (progress - 0.6) / 0.4) * p.maxAlpha);
          } else {
            p.alpha = p.maxAlpha;
          }

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

          if (p.life >= p.maxLife || p.y + p.radius < 0) {
            steamParticles[i] = createSteamParticle(false);
          }
        }
      }

      // 2. Randare Băuturi Reci (Bule Efervescente & Cristale Sclipitoare)
      if (showColdDrink && initialized) {
        // A. Bule efervescente naturale care urcă
        for (let i = 0; i < bubbleParticles.length; i++) {
          const b = bubbleParticles[i];
          b.sway += 0.035;
          b.y -= b.vy;
          b.x += Math.sin(b.sway) * 0.45;

          ctx.save();
          ctx.strokeStyle = `rgba(255, 255, 255, ${b.alpha * 0.85})`;
          ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha * 0.18})`;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Punct specular lucios
          ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha * 0.92})`;
          ctx.beginPath();
          ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.32, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          if (b.y < height * 0.28) {
            bubbleParticles[i] = createBubbleParticle(false);
          }
        }

        // B. Cristale sclipitoare de gheață (Diamond Flashes)
        for (let i = 0; i < iceParticles.length; i++) {
          const p = iceParticles[i];
          p.life++;
          p.rot += p.vRot;

          const progress = p.life / p.maxLife;
          const currentAlpha = Math.sin(progress * Math.PI) * p.maxAlpha;

          if (currentAlpha > 0.05) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);

            // Halo alb translucid
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.radius * 2);
            grad.addColorStop(0, `rgba(255, 255, 255, ${currentAlpha * 0.9})`);
            grad.addColorStop(0.5, `rgba(255, 255, 255, ${currentAlpha * 0.35})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, p.radius * 2, 0, Math.PI * 2);
            ctx.fill();

            // Stea de diamant în 4 colțuri
            ctx.strokeStyle = `rgba(255, 255, 255, ${currentAlpha * 0.95})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(0, -p.radius * 1.5);
            ctx.lineTo(0, p.radius * 1.5);
            ctx.moveTo(-p.radius * 1.5, 0);
            ctx.lineTo(p.radius * 1.5, 0);
            ctx.stroke();

            ctx.restore();
          }

          if (p.life >= p.maxLife) {
            iceParticles[i] = createIceParticle(false);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      window.removeEventListener('resize', onResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [effects.steam, effects.ice, isHot, isColdDrink, isCombo]);

  return (
    <div className="ps-vfx-layer" aria-hidden="true">
      {/* Luciu discret de glazură pentru deserturi */}
      {isDessert && <div className="ps-dessert-sheen" />}

      {/* Reflexie luminoasă speculară pentru efectul Parallax 3D */}
      {effects.parallax && tilt.active && (
        <div 
          className="ps-vfx-specular"
          style={{
            background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 70%)`
          }}
        />
      )}

      {/* Canvas pentru Abur Cald și Bule Băuturi Reci */}
      {(isHot || isColdDrink) && (
        <canvas ref={canvasRef} className="ps-vfx-canvas" />
      )}
    </div>
  );
}
