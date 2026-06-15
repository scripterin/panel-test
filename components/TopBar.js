'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getStoredTheme, toggleTheme } from '../lib/theme';
import styles from './TopBar.module.css';

export default function TopBar({ user: initialUser, title = '', isHub = false }) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [theme, setTheme] = useState('dark');

  useEffect(() => { if (initialUser) setUser(initialUser); }, [initialUser]);
  useEffect(() => { setTheme(getStoredTheme()); }, []);

  useEffect(() => {
    if (!initialUser?.discord_id) return;
    const ref = doc(db, 'members', initialUser.discord_id);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const stored = sessionStorage.getItem('pr_user');
      const session = stored ? JSON.parse(stored) : {};
      const updated = { ...session, ...data };
      sessionStorage.setItem('pr_user', JSON.stringify(updated));
      setUser(updated);
    });
    return unsub;
  }, [initialUser?.discord_id]);

  function logout() { sessionStorage.removeItem('pr_user'); router.replace('/'); }
  function onToggleTheme() { setTheme(toggleTheme()); }

  if (!user) return null;

  return (
    <header className={styles.wrap}>
      {/* Left pill */}
      <div className={styles.pill}>
        {isHub ? (
          <div className={styles.brand}>
            <img src="/logo_pr.png" alt="PR" className={styles.brandLogo}/>
            <span className={styles.brandText}>Panel PR</span>
          </div>
        ) : (
          <button className={styles.back} onClick={() => router.push('/hub')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span className={styles.backText}>Hub</span>
          </button>
        )}
        {title && <span className={styles.pageTitle}>{title}</span>}
      </div>

      {/* Center theme toggle pill */}
      <button className={styles.themeToggle} onClick={onToggleTheme} aria-label="Comută tema" data-on={theme === 'light'}>
        <span className={styles.themeIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </span>
        <span className={styles.themeKnob}/>
        <span className={styles.themeIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
        </span>
      </button>

      {/* Right pill */}
      <div className={styles.pill}>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.full_name}</span>
          <span className={styles.userRank}>{user.rank}</span>
        </div>
        <img src={user.discord_avatar || '/logo_pr.png'} alt="" className={styles.avatar}/>
        <button className={styles.logout} onClick={logout} title="Deconectare">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
