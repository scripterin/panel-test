'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import TopBar from '../../components/TopBar';
import styles from './hub.module.css';

const CAN_MANAGE = ['Adjunct PR', 'Manager PR', 'Supervizor PR', 'Conducere Spital'];

export default function HubPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ members: 0, active: 0, events: 0, weekEvents: 0 });
  const [leaving, setLeaving] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const stored = sessionStorage.getItem('pr_user');
    if (!stored) { router.replace('/'); return; }
    const u = JSON.parse(stored);
    setUser(u);

    const clock = setInterval(() => setNow(new Date()), 1000);

    // Realtime: sync grad/profil userul curent
    const unsubUser = onSnapshot(doc(db, 'members', u.discord_id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const s2 = sessionStorage.getItem('pr_user');
      const session = s2 ? JSON.parse(s2) : {};
      const updated = { ...session, ...data };
      sessionStorage.setItem('pr_user', JSON.stringify(updated));
      setUser(updated);
    });

    // Realtime: membri (pentru statistici)
    let membersData = [];
    let eventsData  = [];
    function recompute() {
      const d = new Date();
      const day = d.getDay() || 7;
      const mon = new Date(d); mon.setDate(d.getDate() - day + 1); mon.setHours(0,0,0,0);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
      const pr = membersData.filter(m => !['Supervizor PR','Conducere Spital'].includes(m.rank));
      setStats({
        members: pr.length,
        active: pr.filter(m => ['Activ','activ'].includes(m.status)).length,
        events: eventsData.length,
        weekEvents: eventsData.filter(e => { const dd = new Date(e.date); return dd >= mon && dd <= sun; }).length,
      });
    }

    const unsubMembers = onSnapshot(collection(db, 'members'), (snap) => {
      membersData = snap.docs.map(d => d.data());
      recompute();
    });
    const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => {
      eventsData = snap.docs.map(d => d.data());
      recompute();
    });

    return () => { unsubUser(); unsubMembers(); unsubEvents(); clearInterval(clock); };
  }, []);

  function go(path) {
    setLeaving(path);
    setTimeout(() => router.push(path), 260);
  }

  function logout() {
    sessionStorage.removeItem('pr_user');
    router.replace('/');
  }

  if (!user) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div className="cb-spinner"/>
    </div>
  );

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return 'Bună dimineața';
    if (h < 18) return 'Bună ziua';
    return 'Bună seara';
  })();

  const canWhitelist = CAN_MANAGE.includes(user.rank);

  const navTiles = [
    {
      id: 'dashboard', label: 'Dashboard', desc: 'Statistici & overview', path: '/dashboard',
      tc: '139,92,246',
      icon: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    },
    {
      id: 'members', label: 'Membri', desc: 'Lista completă', path: '/members',
      tc: '99,102,241',
      icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    },
    {
      id: 'events', label: 'Evenimente', desc: 'Gestionare & prezență', path: '/events',
      tc: '245,158,11',
      icon: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
      badge: stats.weekEvents,
    },
    canWhitelist ? {
      id: 'whitelist', label: 'Whitelist', desc: 'Acces & permisiuni', path: '/whitelist',
      tc: '16,185,129',
      icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    } : null,
    canWhitelist ? {
      id: 'rapoarte', label: 'Rapoarte', desc: 'Bilunar & statistici', path: '/reports',
      tc: '59,130,246',
      icon: <path d="M18 20V10M12 20V4M6 20v-6"/>,
    } : null,
    {
      id: 'info', label: 'Informații', desc: 'Regulament & reguli', path: '/info',
      tc: '255,138,198',
      icon: <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>,
    },
    canWhitelist ? {
      id: 'logs', label: 'Loguri', desc: 'Istoric acțiuni', path: '/logs',
      tc: '157,123,255',
      icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></>,
    } : null,
  ].filter(Boolean);

  return (
    <div className={`${styles.root} ${leaving ? styles.leaving : ''}`}>
      <div className={styles.bgBlob1}/>
      <div className={styles.bgBlob2}/>

      {/* Top bar */}
      <TopBar user={user} isHub={true}/>

      <main className={styles.main}>

        {/* Hero banner - full width */}
        <div className={styles.hero}>
          <div className={styles.heroLeft}>
            <span className={styles.heroGreeting}>{greeting},</span>
            <h1 className={styles.heroName}>{user.full_name.split(' ')[0]}</h1>
            <p className={styles.heroDate}>
              {now.toLocaleDateString('ro-RO', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>
          <div className={styles.heroRight}>
            <span className={styles.heroTime}>{now.toLocaleTimeString('ro-RO', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span>
            <span className={styles.heroTimeLabel}>ora curentă</span>
          </div>
          <div className={styles.heroGlow}/>
        </div>

        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{stats.members}</span>
            <span className={styles.statLabel}>Membri PR</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum} style={{ color:'var(--green)' }}>{stats.active}</span>
            <span className={styles.statLabel}>Activi</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum} style={{ color:'var(--amber)' }}>{stats.events}</span>
            <span className={styles.statLabel}>Evenimente total</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum} style={{ color:'var(--blue)' }}>{stats.weekEvents}</span>
            <span className={styles.statLabel}>Săptămâna asta</span>
          </div>
        </div>

        {/* Nav grid */}
        <div className={styles.navGrid}>
          {navTiles.map((t, i) => (
            <button
              key={t.id}
              className={`${styles.tile} ${t.soon ? styles.tileSoon : ''}`}
              style={{ '--tc': t.tc, animationDelay: `${.1 + i*.04}s` }}
              onClick={() => !t.soon && go(t.path)}
            >
              <div className={styles.tileIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22" strokeLinecap="round" strokeLinejoin="round">
                  {t.icon}
                </svg>
              </div>
              <div className={styles.tileText}>
                <span className={styles.tileLabel}>{t.label}</span>
                <span className={styles.tileDesc}>{t.desc}</span>
              </div>
              {t.soon ? (
                <span className={styles.soonTag}>Soon</span>
              ) : (
                <>
                  {typeof t.badge === 'number' && t.badge > 0 && (
                    <span className={styles.tileBadge}>{t.badge}</span>
                  )}
                  <svg className={styles.tileArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15">
                    <path d="M7 17 17 7M7 7h10v10"/>
                  </svg>
                </>
              )}
            </button>
          ))}
        </div>
      </main>

      <div className={styles.footer}>Panel PR · Sistem Management</div>
    </div>
  );
}
