'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import UserCard from '../../components/UserCard';
import styles from './reports.module.css';

const CAN_VIEW = ['Adjunct PR', 'Manager PR', 'Supervizor PR', 'Conducere Spital'];
const PERIOD_START = new Date('2026-06-01T00:00:00');
const PERIOD_LEN_DAYS = 14;
const DAY_MS = 86400000;
const RO_DAYS = ['Lun','Mar','Mie','Joi','Vin','Sâm','Dum'];

function periodIndexForDate(date) {
  const diff = Math.floor((date - PERIOD_START) / DAY_MS);
  return Math.floor(diff / PERIOD_LEN_DAYS);
}
function periodRange(index) {
  const start = new Date(PERIOD_START.getTime() + index * PERIOD_LEN_DAYS * DAY_MS);
  const end   = new Date(start.getTime() + (PERIOD_LEN_DAYS - 1) * DAY_MS);
  end.setHours(23,59,59,999);
  return { start, end };
}
function fmtDate(d) {
  return d.toLocaleDateString('ro-RO', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [memberEvents, setMemberEvents] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [inactivityLog, setInactivityLog] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentPeriodIndex = periodIndexForDate(new Date());
  const [periodIndex, setPeriodIndex] = useState(currentPeriodIndex);

  const [hoverPoint, setHoverPoint] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('pr_user');
    if (!stored) { router.replace('/'); return; }
    const u = JSON.parse(stored);
    if (!CAN_VIEW.includes(u.rank)) { router.replace('/hub'); return; }
    setUser(u);

    const unsubs = [
      onSnapshot(collection(db, 'members'), s => setMembers(s.docs.map(d => ({ id:d.id, ...d.data() })))),
      onSnapshot(collection(db, 'events'), s => { setEvents(s.docs.map(d => ({ id:d.id, ...d.data() }))); setLoading(false); }),
      onSnapshot(collection(db, 'member_events'), s => setMemberEvents(s.docs.map(d => ({ id:d.id, ...d.data() })))),
      onSnapshot(collection(db, 'promotions'), s => setPromotions(s.docs.map(d => ({ id:d.id, ...d.data() })))),
      onSnapshot(collection(db, 'sanctions'), s => setSanctions(s.docs.map(d => ({ id:d.id, ...d.data() })))),
      onSnapshot(collection(db, 'inactivity_log'), s => setInactivityLog(s.docs.map(d => ({ id:d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const { start, end } = periodRange(periodIndex);
  const isCurrentPeriod = periodIndex === currentPeriodIndex;
  const isFuture = periodIndex > currentPeriodIndex;

  const report = useMemo(() => {
    // Evenimente finalizate + încasate în perioadă
    const finishedEvents = events.filter(ev =>
      ev.event_status === 'finalizat' && ev.financial_status === 'incasat' &&
      inRange(ev.date, start, end)
    );

    // Grafic pe zile
    const days = [];
    for (let i = 0; i < PERIOD_LEN_DAYS; i++) {
      const d = new Date(start.getTime() + i * DAY_MS);
      const count = finishedEvents.filter(ev => {
        const ed = new Date(ev.date);
        return ed.toDateString() === d.toDateString();
      }).length;
      days.push({ date: d, count, label: RO_DAYS[d.getDay() === 0 ? 6 : d.getDay()-1], dayNum: d.getDate() });
    }

    // Sancțiuni în perioadă
    const periodSanctions = sanctions.filter(s => inRange(s.date || s.created_at, start, end));

    // Promovări în perioadă
    const periodPromotions = promotions.filter(p => inRange(p.date, start, end));

    // Membri inactivi/concediu înregistrați în perioadă
    const periodInactive = inactivityLog.filter(l => inRange(l.date, start, end));

    // Top evenimente — din member_events oferite în perioadă, grupate pe membru
    const offeredInPeriod = memberEvents.filter(me => inRange(me.created_at, start, end));
    const counts = {};
    offeredInPeriod.forEach(me => {
      const key = me.member_id;
      if (!counts[key]) counts[key] = { member_id: key, member_name: me.member_name, count: 0 };
      counts[key].count++;
    });
    const top = Object.values(counts)
      .map(c => {
        const m = members.find(mm => mm.id === c.member_id);
        return {
          ...c,
          rank: m?.rank || '—',
          callsign: m?.callsign || '',
          status: m?.status || '—',
          avatar: m?.discord_avatar || '',
        };
      })
      .sort((a,b) => b.count - a.count);

    return {
      eventCount: finishedEvents.length,
      sanctionCount: periodSanctions.length,
      promotionCount: periodPromotions.length,
      inactiveCount: periodInactive.length,
      days,
      inactiveMembers: periodInactive,
      top,
    };
  }, [events, sanctions, promotions, inactivityLog, memberEvents, members, start, end]);

  function downloadTxt() {
    const lines = [];
    lines.push(`RAPORT BILUNAR PANEL PR`);
    lines.push(`Perioada: ${fmtDate(start)} - ${fmtDate(end)}`);
    lines.push('');
    lines.push(`Evenimente finalizate & încasate: ${report.eventCount}`);
    lines.push(`Sancțiuni acordate: ${report.sanctionCount}`);
    lines.push(`Promovări: ${report.promotionCount}`);
    lines.push(`Membri inactivi/concediu înregistrați: ${report.inactiveCount}`);
    lines.push('');
    lines.push('ACTIVITATE PE ZILE');
    report.days.forEach(d => lines.push(`${d.label} ${d.dayNum}: ${d.count} evenimente`));
    lines.push('');
    lines.push('MEMBRI INACTIVI / CONCEDIU');
    if (report.inactiveMembers.length === 0) lines.push('— niciun membru');
    report.inactiveMembers.forEach(m => lines.push(`${m.full_name} — ${m.status} (${fmtDate(new Date(m.date))})`));
    lines.push('');
    lines.push('TOP EVENIMENTE MEMBRI — PERIOADA CURENTĂ');
    if (report.top.length === 0) lines.push('— niciun eveniment oferit');
    report.top.forEach((t,i) => lines.push(`${i+1}. ${t.member_name} — ${t.rank} ${t.callsign ? '('+t.callsign+')' : ''} — ${t.count} evenimente`));

    const blob = new Blob([lines.join('\n')], { type:'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raport-${fmtDate(start).replace(/\./g,'-')}_${fmtDate(end).replace(/\./g,'-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!user) return null;

  const maxCount = Math.max(...report.days.map(d => d.count), 1);

  // Build smooth SVG path for the wave chart
  const W = 1000, H = 200, PAD = 30;
  const stepX = (W - PAD*2) / (PERIOD_LEN_DAYS - 1);
  const points = report.days.map((d, i) => ({
    x: PAD + i * stepX,
    y: H - PAD - (d.count / maxCount) * (H - PAD*2 - 20),
    ...d,
  }));

  function buildPath(pts) {
    if (pts.length < 2) return '';
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i+1];
      const midX = (p0.x + p1.x) / 2;
      path += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  }
  const linePath = buildPath(points);
  const areaPath = `${linePath} L ${points[points.length-1].x} ${H-PAD} L ${points[0].x} ${H-PAD} Z`;

  return (
    <div className={styles.root}>
      <div className={styles.bg1}/><div className={styles.bg2}/><div className={styles.grid}/>
      <UserCard user={user} title="Rapoarte"/>

      <main className={styles.main}>
        <div className={styles.topRow}>
          <div className={styles.periodNav}>
            <button className={styles.navBtn} onClick={() => setPeriodIndex(i => i-1)} disabled={periodIndex <= 0}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className={styles.periodLabel}>
              <span className={styles.periodTitle}>Raport · {fmtDate(start)} → {fmtDate(end)}</span>
              {isCurrentPeriod && <span className={styles.periodBadge}>Curentă</span>}
              {!isCurrentPeriod && !isFuture && <span className={styles.periodBadgeView}>Vizualizare</span>}
            </div>
            <button className={styles.navBtn} onClick={() => setPeriodIndex(i => i+1)} disabled={isFuture}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <button className={styles.downloadBtn} onClick={downloadTxt}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descarcă Raport TXT
          </button>
        </div>

        {loading ? (
          <div className={styles.loadState}><div className="cb-spinner"/></div>
        ) : (
          <>
            {/* Stat cards */}
            <div className={styles.statsRow}>
              {[
                { label:'Evenimente', sub:'Această perioadă', value: report.eventCount, color:'139,92,246',
                  icon: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></> },
                { label:'Sancțiuni', sub:'Această perioadă', value: report.sanctionCount, color:'245,158,11',
                  icon: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
                { label:'Promovări', sub:'Modificări grad', value: report.promotionCount, color:'34,197,94',
                  icon: <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/> },
                { label:'Inactivi', sub:'Status inactiv/concediu', value: report.inactiveCount, color:'99,102,241',
                  icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></> },
              ].map((s,i) => (
                <div key={s.label} className={styles.statCard} style={{ '--c':s.color, animationDelay:`${i*.05}s` }}>
                  <div className={styles.statIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
                  </div>
                  <div className={styles.statVal}>{s.value}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                  <div className={styles.statSub}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Chart + Inactive members */}
            <div className={styles.midRow}>
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M3 3v18h18"/><path d="M18.7 8 13 13.7l-4-4L3 16"/></svg>
                    Activitate pe zile
                  </span>
                  <span className={styles.cardSub}>{fmtDate(start)} → {fmtDate(end)}</span>
                </div>
                <div className={styles.chartWrap}>
                  <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(139,92,246,0.35)"/>
                        <stop offset="100%" stopColor="rgba(139,92,246,0)"/>
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#areaGrad)"/>
                    <path d={linePath} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round"/>
                    {points.map((p,i) => (
                      <g key={i} onMouseEnter={() => setHoverPoint(i)} onMouseLeave={() => setHoverPoint(null)}>
                        <circle cx={p.x} cy={p.y} r="14" fill="transparent"/>
                        <circle cx={p.x} cy={p.y} r={hoverPoint===i ? 5 : 3.5} fill={p.count>0 ? '#a78bfa' : 'rgba(255,255,255,.15)'}
                          stroke={hoverPoint===i ? '#fff' : 'none'} strokeWidth="1.5"
                          style={{ transition:'r .15s' }}/>
                        {hoverPoint === i && (
                          <g>
                            <rect x={p.x-22} y={p.y-38} width="44" height="24" rx="6" fill="#0f0c24" stroke="rgba(139,92,246,.4)"/>
                            <text x={p.x} y={p.y-21} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="var(--font-display)">{p.count}</text>
                          </g>
                        )}
                      </g>
                    ))}
                  </svg>
                  <div className={styles.chartLabels}>
                    {report.days.map((d,i) => (
                      <div key={i} className={`${styles.chartLabel} ${new Date().toDateString()===d.date.toDateString() ? styles.chartLabelToday : ''}`}>
                        <span>{d.label}</span><span className={styles.chartLabelNum}>{d.dayNum}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    Membri Inactivi / Concediu
                  </span>
                </div>
                <div className={styles.inactiveList}>
                  {report.inactiveMembers.length === 0 && <p className={styles.empty}>Niciun membru înregistrat în această perioadă.</p>}
                  {report.inactiveMembers.map(m => (
                    <div key={m.id} className={styles.inactiveRow}>
                      <span className={styles.inactiveName}>{m.full_name}</span>
                      <span className={`${styles.inactiveStatus} ${m.status==='Concediu' ? styles.statusConcediu : styles.statusInactiv}`}>
                        {m.status}
                      </span>
                      <span className={styles.inactiveRank}>{m.rank}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top table */}
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
                  Evenimente Membri — Perioadă Curentă
                </span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th><th>Nume</th><th>Grad</th><th>Status</th><th>Evenimente Perioadă</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.top.length === 0 && (
                      <tr><td colSpan={5} className={styles.empty}>Niciun eveniment oferit în această perioadă.</td></tr>
                    )}
                    {report.top.map((t,i) => (
                      <tr key={t.member_id}>
                        <td className={styles.rankCol}>{i+1}</td>
                        <td className={styles.nameCol}>{t.member_name}</td>
                        <td><span className={styles.gradeBadge}>{t.rank}</span></td>
                        <td><span className={`${styles.statusBadge} ${t.status==='Activ'?styles.statusActiv: t.status==='Concediu'?styles.statusConcediu:styles.statusInactiv}`}>{t.status}</span></td>
                        <td className={styles.countCol}>{t.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
