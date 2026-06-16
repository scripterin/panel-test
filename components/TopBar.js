'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getStoredTheme, toggleTheme } from '../lib/theme';
import styles from './TopBar.module.css';

const TYPE_META = {
  promotion:  { label:'Grad modificat',   icon:<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/> },
  inactivity: { label:'Status modificat', icon:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></> },
  event:      { label:'Eveniment nou',    icon:<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></> },
  offer:      { label:'Eveniment oferit', icon:<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  account:    { label:'Cont actualizat',  icon:<><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></> },
};

export default function TopBar({ user: initialUser, title = '', isHub = false }) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [theme, setTheme] = useState('dark');
  const [notifs, setNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

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

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('created_at', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const readKey = user ? `pr_notifs_read_${user.discord_id}` : null;
  const [readIds, setReadIds] = useState([]);
  useEffect(() => {
    if (!readKey) return;
    try { setReadIds(JSON.parse(localStorage.getItem(readKey) || '[]')); } catch { setReadIds([]); }
  }, [readKey]);

  const unreadCount = notifs.filter(n => !readIds.includes(n.id)).length;

  function openNotifs() {
    setNotifOpen(o => !o);
    if (!notifOpen) {
      const allIds = notifs.map(n => n.id);
      setReadIds(allIds);
      if (readKey) localStorage.setItem(readKey, JSON.stringify(allIds));
    }
  }

  function logout() { sessionStorage.removeItem('pr_user'); router.replace('/'); }
  function onToggleTheme() { setTheme(toggleTheme()); }

  if (!user) return null;

  const callsignTag = user.callsign ? `[${user.callsign}] ` : '';

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        {!isHub && (
          <button className={styles.backIcon} onClick={() => router.push('/hub')} title="Înapoi la Hub">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="17" height="17">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        <span className={styles.crumb}>
          <span className={styles.crumbBrand}>Panel PR</span>
          {title && <><span className={styles.crumbSep}>/</span><span className={styles.crumbPage}>{title}</span></>}
        </span>
      </div>

      <button className={styles.themeToggle} onClick={onToggleTheme} aria-label="Comută tema" data-on={theme === 'light'}>
        <span className={styles.themeIconWrap}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </span>
        <span className={styles.themeKnob}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="11" height="11">
            {theme === 'light'
              ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>
              : <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>}
          </svg>
        </span>
        <span className={styles.themeIconWrap}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
        </span>
      </button>

      <div className={styles.right}>
        <div className={styles.notifWrap} ref={notifRef}>
          <button className={styles.notifBtn} onClick={openNotifs} title="Notificări">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && <span className={styles.notifDot}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {notifOpen && (
            <div className={styles.notifDropdown}>
              <div className={styles.notifHead}>Notificări</div>
              <div className={styles.notifList}>
                {notifs.length === 0 && <div className={styles.notifEmpty}>Nicio notificare.</div>}
                {notifs.map(n => {
                  const meta = TYPE_META[n.type] || TYPE_META.account;
                  return (
                    <div key={n.id} className={styles.notifItem}>
                      <div className={styles.notifIcon}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14" strokeLinecap="round" strokeLinejoin="round">{meta.icon}</svg>
                      </div>
                      <div className={styles.notifBody}>
                        <span className={styles.notifTitle}>{n.title}</span>
                        <span className={styles.notifTime}>{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button className={styles.userChip} onClick={logout} title="Click pentru deconectare">
          <span className={styles.userLabel}>{callsignTag}{user.full_name}</span>
          <img src={user.discord_avatar || '/logo_pr.png'} alt="" className={styles.avatar}/>
        </button>
      </div>
    </header>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'acum';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}z`;
}

export async function pushNotification(type, title) {
  try {
    await addDoc(collection(db, 'notifications'), { type, title, created_at: new Date().toISOString() });
  } catch (e) { console.error('notif error', e); }
}
