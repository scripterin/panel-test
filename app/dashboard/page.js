'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import TopBar from '../../components/TopBar';
import styles from './dashboard.module.css';

const EXCLUDE = ['Supervizor PR', 'Conducere Spital'];
const PR_GRADES = ['Membru PR', 'Adjunct PR', 'Manager PR'];
const CAN_POST = ['Adjunct PR', 'Manager PR', 'Supervizor PR', 'Conducere Spital'];

function getWeekRange() {
  const now = new Date(), day = now.getDay() || 7;
  const mon = new Date(now); mon.setDate(now.getDate() - day + 1); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
  return { mon, sun };
}

function AnimNum({ value }) {
  const [display, setDisplay] = useState(0);
  const r = useRef();
  useEffect(() => {
    const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / 900, 1);
      const ease = 1 - Math.pow(1-p, 3);
      setDisplay(Math.round(value * ease));
      if (p < 1) r.current = requestAnimationFrame(step);
    }
    r.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(r.current);
  }, [value]);
  return <>{display}</>;
}

export default function Dashboard() {
  const router = useRouter();
  const [user,   setUser]   = useState(null);
  const [data,   setData]   = useState(null);
  const [loading,setLoading]= useState(true);
  const [annModal, setAnnModal] = useState(false);
  const [sysModal, setSysModal] = useState(false);
  const [annForm,  setAnnForm]  = useState({ title:'', body:'' });
  const [sysForm,  setSysForm]  = useState({ title:'', body:'' });
  const [saving,  setSaving]  = useState(false);
  const toastRef = useRef();
  const [toast,   setToast]   = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('pr_user');
    if (!stored) { router.replace('/'); return; }
    const u = JSON.parse(stored);
    setUser(u);

    let membersData = [], eventsData = [], annData = [], sysData = [];
    let loadedFlags = { m:false, e:false, a:false, s:false };

    function recompute() {
      if (!loadedFlags.m || !loadedFlags.e || !loadedFlags.a || !loadedFlags.s) return;
      const { mon, sun } = getWeekRange();
      const pr = membersData.filter(m => !EXCLUDE.includes(m.rank));
      const recent = [...membersData].sort((a,b) => new Date(b.join_date) - new Date(a.join_date)).slice(0,5);
      const dist = PR_GRADES.map(g => ({ grade: g, count: pr.filter(m => m.rank === g).length }));
      setData({
        totalPR:    pr.length,
        active:     pr.filter(m => ['Activ','activ'].includes(m.status)).length,
        leadership: pr.filter(m => ['Adjunct PR','Manager PR'].includes(m.rank)).length,
        mgr:        pr.filter(m => m.rank === 'Manager PR').length,
        adj:        pr.filter(m => m.rank === 'Adjunct PR').length,
        weekEvents: eventsData.filter(e => { const d = new Date(e.date); return d >= mon && d <= sun; }).length,
        recent,
        announcements: annData,
        sysUpdates:    sysData,
        dist,
      });
      setLoading(false);
    }

    const unsubM = onSnapshot(collection(db, 'members'), (snap) => {
      membersData = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      loadedFlags.m = true;
      // Sync sesiune dacă userul curent a fost modificat
      const me = membersData.find(m => m.discord_id === u.discord_id);
      if (me) {
        const s2 = sessionStorage.getItem('pr_user');
        const ses = s2 ? JSON.parse(s2) : {};
        const upd = { ...ses, ...me };
        sessionStorage.setItem('pr_user', JSON.stringify(upd));
        setUser(upd);
      }
      recompute();
    });

    const unsubE = onSnapshot(collection(db, 'events'), (snap) => {
      eventsData = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      loadedFlags.e = true;
      recompute();
    });

    const annQ = query(collection(db, 'announcements'), orderBy('created_at', 'desc'), limit(5));
    const unsubA = onSnapshot(annQ, (snap) => {
      annData = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      loadedFlags.a = true;
      recompute();
    });

    const sysQ = query(collection(db, 'system_updates'), orderBy('created_at', 'desc'), limit(5));
    const unsubS = onSnapshot(sysQ, (snap) => {
      sysData = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      loadedFlags.s = true;
      recompute();
    });

    return () => { unsubM(); unsubE(); unsubA(); unsubS(); };
  }, []);

  const isLeadership = user && CAN_POST.includes(user.rank);

  function showToast(msg, type='success') {
    setToast({ msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }

  async function submitAnn() {
    if (!annForm.title.trim() || !annForm.body.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: annForm.title, body: annForm.body,
        author: user.full_name, author_rank: user.rank,
        created_at: new Date().toISOString(),
      });
      showToast('Anunț publicat!'); setAnnModal(false); setAnnForm({ title:'', body:'' });
    } catch (e) { showToast('Eroare.', 'error'); }
    setSaving(false);
  }

  async function submitSys() {
    if (!sysForm.title.trim() || !sysForm.body.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'system_updates'), {
        title: sysForm.title, body: sysForm.body,
        author: user.full_name,
        created_at: new Date().toISOString(),
      });
      showToast('Actualizare publicată!'); setSysModal(false); setSysForm({ title:'', body:'' });
    } catch (e) { showToast('Eroare.', 'error'); }
    setSaving(false);
  }

  const maxDist = Math.max(...(data?.dist.map(d => d.count) || [1]), 1);
  const DIST_COLORS = ['#9d7bff','#6366f1','#ffb454'];

  return (
    <div className={styles.root}>
      <div className={styles.bg1}/><div className={styles.bg2}/><div className={styles.grid}/>
      <TopBar user={user} title="Dashboard"/>

      <main className={styles.main}>
        {loading ? (
          <div className={styles.loadState}><div className="cb-spinner"/></div>
        ) : (
          <>
            {/* Stat cards */}
            <div className={styles.statsRow}>
              {[
                { label:'Total Membri PR', value: data.totalPR, color:'157,123,255', icon:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
                { label:'Membri Activi',   value: data.active,  color:'61,220,132', icon:'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3' },
                { label:'Conducere PR',    value: data.leadership, color:'99,102,241', sub:`${data.mgr} mgr · ${data.adj} adj`, icon:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
                { label:'Ev. Săptămâna',  value: data.weekEvents, color:'255,180,84', icon:'M3 4h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M2 10h20' },
              ].map((s, i) => (
                <div key={s.label} className={styles.statCard} style={{ '--c': s.color, animationDelay:`${i*.06}s` }}>
                  <div className={styles.statIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
                      <path d={s.icon} strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className={styles.statBody}>
                    <div className={styles.statVal}><AnimNum value={s.value}/></div>
                    <div className={styles.statLabel}>{s.label}</div>
                    {s.sub && <div className={styles.statSub}>{s.sub}</div>}
                  </div>
                  <div className={styles.statGlow}/>
                </div>
              ))}
            </div>

            <div className={styles.midRow}>
              {/* Distributie */}
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>Distribuție Grade</span>
                  <span className={styles.cardBadge}>{data.totalPR} total</span>
                </div>
                <div className={styles.distList}>
                  {data.dist.map((d, i) => (
                    <div key={d.grade} className={styles.distRow}>
                      <div className={styles.distInfo}>
                        <span className={styles.distGrade}>{d.grade}</span>
                        <span className={styles.distCount} style={{ color: DIST_COLORS[i] }}>{d.count}</span>
                      </div>
                      <div className={styles.distTrack}>
                        <div className={styles.distFill} style={{ width:`${(d.count/maxDist)*100}%`, '--dc': DIST_COLORS[i] }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Membri recenti */}
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>Membri Recenți</span>
                  <span className={styles.cardBadge}>ultimii 5</span>
                </div>
                <div className={styles.recentList}>
                  {data.recent.length === 0 && <p className={styles.empty}>Niciun membru înregistrat.</p>}
                  {data.recent.map(m => {
                    const isActive = ['Activ','activ'].includes(m.status);
                    return (
                      <div key={m.id} className={styles.recentRow}>
                        <img src={m.discord_avatar||'/logo_pr.png'} alt="" className={styles.recentAvatar}/>
                        <div className={styles.recentInfo}>
                          <span className={styles.recentName}>{m.full_name}</span>
                          <span className={styles.recentRank}>{m.rank}</span>
                        </div>
                        <span className={styles.recentStatus} style={{ color: isActive ? 'var(--green)' : 'var(--t3)', background: isActive ? 'rgba(61,220,132,.12)' : 'var(--surface2)', borderColor: isActive ? 'rgba(61,220,132,.25)' : 'var(--border3)' }}>
                          {m.status || '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={styles.botRow}>
              {/* Anunturi */}
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>
                    Anunțuri
                  </span>
                  {isLeadership && <button className={styles.addBtn} onClick={() => setAnnModal(true)}>+ Adaugă</button>}
                </div>
                <div className={styles.feedList}>
                  {data.announcements.length === 0 && <p className={styles.empty}>Niciun anunț.</p>}
                  {data.announcements.map(a => (
                    <div key={a.id} className={styles.feedItem}>
                      <div className={styles.feedDot} style={{ background:'var(--p)' }}/>
                      <div className={styles.feedContent}>
                        <div className={styles.feedTitle}>{a.title}</div>
                        <div className={styles.feedBody}>{a.body}</div>
                        <div className={styles.feedMeta}>
                          <span>{a.author} · {a.author_rank}</span>
                          <span>{new Date(a.created_at).toLocaleDateString('ro-RO')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actualizari */}
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
                    Actualizări Sistem
                  </span>
                  {isLeadership && <button className={styles.addBtn} onClick={() => setSysModal(true)}>+ Adaugă</button>}
                </div>
                <div className={styles.feedList}>
                  {data.sysUpdates.length === 0 && <p className={styles.empty}>Nicio actualizare.</p>}
                  {data.sysUpdates.map(u => (
                    <div key={u.id} className={styles.feedItem}>
                      <div className={styles.feedDot} style={{ background:'var(--amber)' }}/>
                      <div className={styles.feedContent}>
                        <div className={styles.feedTitle}>{u.title}</div>
                        <div className={styles.feedBody}>{u.body}</div>
                        <div className={styles.feedMeta}>
                          <span>{u.author}</span>
                          <span>{new Date(u.created_at).toLocaleDateString('ro-RO')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {annModal && (
        <div className={styles.overlay} onClick={() => setAnnModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}><h3>Anunț nou</h3><button className={styles.modalX} onClick={() => setAnnModal(false)}>✕</button></div>
            <input className={styles.minput} placeholder="Titlu..." value={annForm.title} onChange={e => setAnnForm(f=>({...f,title:e.target.value}))}/>
            <textarea className={styles.mtextarea} placeholder="Conținut..." value={annForm.body} onChange={e => setAnnForm(f=>({...f,body:e.target.value}))}/>
            <div className={styles.modalFoot}>
              <button className={styles.mcancel} onClick={() => setAnnModal(false)}>Anulează</button>
              <button className={styles.msave} onClick={submitAnn} disabled={saving}>{saving ? 'Se salvează...' : 'Publică'}</button>
            </div>
          </div>
        </div>
      )}
      {sysModal && (
        <div className={styles.overlay} onClick={() => setSysModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}><h3>Actualizare nouă</h3><button className={styles.modalX} onClick={() => setSysModal(false)}>✕</button></div>
            <input className={styles.minput} placeholder="Titlu..." value={sysForm.title} onChange={e => setSysForm(f=>({...f,title:e.target.value}))}/>
            <textarea className={styles.mtextarea} placeholder="Detalii..." value={sysForm.body} onChange={e => setSysForm(f=>({...f,body:e.target.value}))}/>
            <div className={styles.modalFoot}>
              <button className={styles.mcancel} onClick={() => setSysModal(false)}>Anulează</button>
              <button className={styles.msave} onClick={submitSys} disabled={saving}>{saving ? 'Se salvează...' : 'Publică'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${toast.type==='error'?styles.toastErr:styles.toastOk}`}>{toast.msg}</div>
      )}
    </div>
  );
}
