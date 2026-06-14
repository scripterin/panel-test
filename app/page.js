'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

const CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1479877035919937607';

function getRedirectUri() {
  if (typeof window === 'undefined') return '';
  return window.location.hostname === 'localhost'
    ? 'https://test-panel-alpha.vercel.app/auth/callback'
    : `${process.env.NEXT_PUBLIC_SITE_URL || 'https://test-panel-alpha.vercel.app'}/auth/callback`;
}

function LoginInner() {
  const params = useSearchParams();
  const [state, setState] = useState('idle');

  useEffect(() => {
    if (params.get('denied')) setState('denied');
    else if (params.get('error')) setState('error');
  }, [params]);

  function loginWithDiscord() {
    const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(getRedirectUri())}&response_type=code&scope=identify`;
    window.location.href = url;
  }

  return (
    <main className={styles.root}>
      <div className={styles.aurora}/>
      <div className={styles.grain}/>

      <div className={styles.content}>
        <div className={styles.logoFloat}>
          <img src="/logo_pr.png" alt="PR" className={styles.logo}/>
        </div>

        <h1 className={styles.title}>Panel PR</h1>
        <p className={styles.subtitle}>Sistem Management · Relații Publice</p>

        <div className={styles.card}>
          {state === 'denied' && (
            <div className={styles.alert}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              <div>
                <strong>Acces refuzat</strong>
                <p>Contul tău Discord nu este pe lista de acces.</p>
              </div>
            </div>
          )}
          {state === 'error' && (
            <div className={styles.alert} style={{ '--ac':'245,158,11' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
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
          </button>

          <p className={styles.restricted}>Acces restricționat · Doar membri autorizați</p>
        </div>
      </div>

      <div className={styles.footer}>Panel PR &copy; {new Date().getFullYear()} · Sistem Intern</div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div className="cb-spinner"/>
      </div>
    }>
      <LoginInner/>
    </Suspense>
  );
}
