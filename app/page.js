'use client';

import { Suspense } from 'react';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from './page.module.css';

const CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || 'PUNE_CLIENT_ID_AICI';

function getRedirectUri() {
  if (typeof window === 'undefined') return '';
  return window.location.hostname === 'localhost'
    ? 'http://localhost:3000/auth/callback'
    : `${process.env.NEXT_PUBLIC_SITE_URL || 'https://panel-pr.vercel.app'}/auth/callback`;
}

function LoginInner() {
  const params  = useSearchParams();
  const router  = useRouter();
  const [state, setState] = useState('idle');
  const canvasRef = useRef(null);

  useEffect(() => {
    if (params.get('denied')) setState('denied');
    else if (params.get('error')) setState('error');

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    let raf;

    const pts = Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
      r: Math.random() * 1.2 + .3, a: Math.random(),
    }));

    function draw() {
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139,92,246,${p.a * .25})`;
        ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(139,92,246,${(1 - d / 100) * .06})`;
            ctx.lineWidth = .5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }
    draw();

    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, [params]);

  function loginWithDiscord() {
    const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(getRedirectUri())}&response_type=code&scope=identify`;
    window.location.href = url;
  }

  return (
    <main className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas}/>
      <div className={styles.orb1}/><div className={styles.orb2}/><div className={styles.orb3}/>
      <div className={styles.grid}/>

      <div className={styles.card}>
        <div className={styles.cardAccent}/>
        <div className={styles.logoWrap}>
          <div className={styles.logoRing}/>
          <img src="/logo_pr.png" alt="PR" className={styles.logo}/>
        </div>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            <span className={styles.titlePR}>PR</span>
            <span className={styles.titleDot}/>
            <span className={styles.titleSub}>Panel</span>
          </h1>
          <p className={styles.subtitle}>Sistem Management · Relații Publice</p>
        </div>
        <div className={styles.divider}>
          <span className={styles.dividerLine}/><span className={styles.dividerText}>autentificare</span><span className={styles.dividerLine}/>
        </div>

        {state === 'denied' && (
          <div className={styles.alertDenied}>
            <span className={styles.alertIcon}>⛔</span>
            <div>
              <strong>Acces refuzat</strong>
              <p>Contul tău Discord nu este pe lista de acces. Contactează un administrator.</p>
            </div>
          </div>
        )}
        {state === 'error' && (
          <div className={styles.alertError}>
            <span className={styles.alertIcon}>⚠️</span>
            <div>
              <strong>Eroare de autentificare</strong>
              <p>Ceva nu a mers bine. Încearcă din nou.</p>
            </div>
          </div>
        )}

        <button className={styles.discordBtn} onClick={loginWithDiscord}>
          <svg className={styles.discordIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          <span>Conectează-te cu Discord</span>
          <div className={styles.btnShine}/>
        </button>

        <p className={styles.restricted}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Acces restricționat · Doar membri autorizați
        </p>
        <div className={styles.cardGlow}/>
      </div>

      <div className={styles.footer}>Panel PR &copy; {new Date().getFullYear()} · Sistem Intern</div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', background:'#050308', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div className="cb-spinner"/>
      </div>
    }>
      <LoginInner/>
    </Suspense>
  );
}
