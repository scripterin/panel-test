'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import TopBar from '../../components/TopBar';
import styles from './logs.module.css';

const CAN_VIEW = ['Adjunct PR', 'Manager PR', 'Supervizor PR', 'Conducere Spital'];

const TYPE_META = {
  promotion:  { label:'Modificare grad', color:'99,102,241',  icon:<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/> },
  inactivity: { label:'Status membru',    color:'255,180,84',  icon:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></> },
  event:      { label:'Eveniment postat', color:'255,180,84',  icon:<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></> },
  whitelist:  { label:'Whitelist',        color:'61,220,132',  icon:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/> },
  offer:      { label:'Eveniment oferit', color:'157,123,255', icon:<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
};

export default function LogsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [inactivity, setInactivity] = useState([]);
  const [events, setEvents] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [memberEvents, setMemberEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('pr_user');
    if (!stored) { router.replace('/'); return; }
    const u = JSON.parse(stored);
    if (!CAN_VIEW.includes(u.rank)) { router.replace('/hub'); return; }
    setUser(u);

    const unsubs = [
      onSnapshot(collection(db, 'promotions'), s => setPromotions(s.docs.map(d => ({ id:d.id, ...d.data() })))),
      onSnapshot(collection(db, 'inactivity_log'), s => setInactivity(s.docs.map(d => ({ id:d.id, ...d.data() })))),
      onSnapshot(collection(db, 'events'), s => { setEvents(s.docs.map(d => ({ id:d.id, ...d.data() }))); setLoading(false); }),
      onSnapshot(collection(db, 'whitelist'), s => setWhitelist(s.docs.map(d => ({ id:d.id, ...d.data() })))),
      onSnapshot(collection(db, 'member_events'), s => setMemberEvents(s.docs.map(d => ({ id:d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const logEntries = useMemo(() => {
    const entries = [];

    promotions.forEach(p => entries.push({
      id: 'promo-'+p.id, type:'promotion', date: p.date,
      title: `${p.full_name} — ${p.old_rank} → ${p.new_rank}`,
      sub: `Modificat de ${p.changed_by || 'necunoscut'}`,
    }));

    inactivity.forEach(l => entries.push({
      id: 'inact-'+l.id, type:'inactivity', date: l.date,
      title: `${l.full_name} → ${l.status}`,
      sub: l.rank || '',
    }));

    events.forEach(e => entries.push({
      id: 'ev-'+e.id, type:'event', date: e.created_at || e.date,
      title: `Eveniment postat: ${e.type}`,
      sub: `de ${e.created_by || '—'} · ${e.location || ''}`,
    }));

    whitelist.forEach(w => entries.push({
      id: 'wl-'+w.id, type:'whitelist', date: w.created_at,
      title: `${w.full_name} adăugat în whitelist`,
      sub: `de ${w.added_by || '—'} · ${w.rank || ''}`,
    }));

    memberEvents.forEach(m => entries.push({
      id: 'offer-'+m.id, type:'offer', date: m.created_at,
      title: `Eveniment oferit lui ${m.member_name}`,
      sub: `de ${m.offered_by || '—'} · participare ${m.event_date ? new Date(m.event_date).toLocaleDateString('ro-RO') : ''}`,
    }));

    return entries
      .filter(e => e.date)
      .sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [promotions, inactivity, events, whitelist, memberEvents]);

  const filtered = logEntries.filter(e => {
    if (filter !== 'all' && e.type !== filter) return false;
    if (search && !(`${e.title} ${e.sub}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const counts = Object.keys(TYPE_META).reduce((acc, k) => ({ ...acc, [k]: logEntries.filter(e => e.type===k).length }), {});

  return (
    <div className={styles.root}>
      <div className={styles.bg1}/><div className={styles.bg2}/>
      <TopBar user={user} title="Loguri"/>

      <main className={styles.main}>
        <div className={styles.topRow}>
          <div className={styles.searchWrap}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className={styles.searchInput} placeholder="Caută în loguri..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <span className={styles.totalCount}>{filtered.length} {filtered.length===1?'rezultat':'rezultate'}</span>
        </div>

        <div className={styles.filters}>
          <button className={`${styles.filterBtn} ${filter==='all'?styles.filterActive:''}`} onClick={() => setFilter('all')}>
            Toate <span className={styles.filterCount}>{logEntries.length}</span>
          </button>
          {Object.entries(TYPE_META).map(([key, meta]) => (
            <button key={key} className={`${styles.filterBtn} ${filter===key?styles.filterActive:''}`} style={{'--fc':meta.color}} onClick={() => setFilter(key)}>
              {meta.label} <span className={styles.filterCount}>{counts[key]||0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.loadState}><div className="cb-spinner"/></div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}><span>🗂️</span><p>Niciun log găsit.</p></div>
        ) : (
          <div className={styles.timeline}>
            {filtered.map((e,i) => {
              const meta = TYPE_META[e.type];
              return (
                <div key={e.id} className={styles.logRow} style={{ animationDelay:`${Math.min(i*.02,.4)}s`, '--lc':meta.color }}>
                  <div className={styles.logIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16" strokeLinecap="round" strokeLinejoin="round">{meta.icon}</svg>
                  </div>
                  <div className={styles.logBody}>
                    <span className={styles.logTitle}>{e.title}</span>
                    {e.sub && <span className={styles.logSub}>{e.sub}</span>}
                  </div>
                  <span className={styles.logTag} style={{ color:`rgb(${meta.color})`, background:`rgba(${meta.color},.12)` }}>{meta.label}</span>
                  <span className={styles.logDate}>{new Date(e.date).toLocaleString('ro-RO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
