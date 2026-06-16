'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, addDoc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import styles from './members.module.css';
import TopBar, { pushNotification } from '../../components/TopBar';


const ALL_GRADES   = ['Conducere Spital', 'Supervizor PR', 'Manager PR', 'Adjunct PR', 'Membru PR'];
const GRADE_OPTIONS = ALL_GRADES;
const CAN_EDIT_GRADES = ['Adjunct PR', 'Manager PR', 'Supervizor PR', 'Conducere Spital'];
const GRADE_ORDER  = ['Conducere Spital', 'Supervizor PR', 'Manager PR', 'Adjunct PR', 'Membru PR'];

const STATUS_OPTIONS = ['Activ', 'Inactiv', 'Concediu', 'Concediu Civil'];
const STATUS_COLORS  = {
  'Activ':          { bg: 'rgba(34,197,94,.1)',   border: 'rgba(34,197,94,.25)',   text: '#4ade80' },
  'activ':          { bg: 'rgba(34,197,94,.1)',   border: 'rgba(34,197,94,.25)',   text: '#4ade80' },
  'Inactiv':        { bg: 'rgba(148,163,184,.1)', border: 'rgba(148,163,184,.2)',  text: '#94a3b8' },
  'inactiv':        { bg: 'rgba(148,163,184,.1)', border: 'rgba(148,163,184,.2)',  text: '#94a3b8' },
  'Concediu':       { bg: 'rgba(245,158,11,.1)',  border: 'rgba(245,158,11,.25)',  text: '#fbbf24' },
  'Concediu Civil': { bg: 'rgba(99,102,241,.1)',  border: 'rgba(99,102,241,.25)',  text: '#818cf8' },
};

const GRADE_ACCENT = {
  'Membru PR':        '#9d7bff',
  'Adjunct PR':       '#6366f1',
  'Manager PR':       '#ffb454',
  'Supervizor PR':    '#5eb3f5',
  'Conducere Spital': '#3ddc84',
};

const sortByGrade = arr => [...arr].sort((a, b) => GRADE_ORDER.indexOf(a.rank) - GRADE_ORDER.indexOf(b.rank));

export default function MembersPage() {
  const router = useRouter();
  const [user,       setUser]       = useState(null);
  const [members,    setMembers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState(null);
  const toastRef = useRef();

  useEffect(() => {
    const stored = sessionStorage.getItem('pr_user');
    if (!stored) { router.replace('/'); return; }
    const u = JSON.parse(stored);
    setUser(u);

    // Realtime — toți membrii
    const unsub = onSnapshot(collection(db, 'members'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMembers(list);
      setLoading(false);

      // Sync sesiune dacă userul curent a fost modificat
      const me = list.find(m => m.discord_id === u.discord_id);
      if (me) {
        const stored2 = sessionStorage.getItem('pr_user');
        const session = stored2 ? JSON.parse(stored2) : {};
        const updated = { ...session, ...me };
        sessionStorage.setItem('pr_user', JSON.stringify(updated));
        setUser(updated);
      }
    });

    return () => unsub();
  }, []);

  const canEdit = user && CAN_EDIT_GRADES.includes(user.rank);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3200);
  }

  function openEdit(member) {
    setEditTarget(member);
    setEditForm({
      full_name:   member.full_name   || '',
      rank:        member.rank        || '',
      status:      member.status      || 'Activ',
      callsign:    member.callsign    || '',
      discord_id:  member.discord_id  || '',
      employee_id: member.employee_id || '',
      notes:       member.notes       || '',
    });
  }

  async function saveEdit() {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'members', editTarget.id), {
        ...editForm,
        updated_at: new Date().toISOString(),
      });

      // Sincronizează whitelist (grad + nume) ca să nu rămână date vechi
      // care ar suprascrie gradul la următoarea logare
      if (editTarget.discord_id) {
        const wlRef = doc(db, 'whitelist', editTarget.discord_id);
        const wlSnap = await getDoc(wlRef);
        if (wlSnap.exists()) {
          await updateDoc(wlRef, {
            rank: editForm.rank || editTarget.rank,
            full_name: editForm.full_name || editTarget.full_name,
          });
        }
      }

      // Istoric promovări — dacă gradul s-a modificat
      if (editForm.rank && editTarget.rank && editForm.rank !== editTarget.rank) {
        await addDoc(collection(db, 'promotions'), {
          member_id:   editTarget.id,
          discord_id:  editTarget.discord_id || '',
          full_name:   editForm.full_name || editTarget.full_name,
          old_rank:    editTarget.rank,
          new_rank:    editForm.rank,
          changed_by:  user.full_name,
          date:        new Date().toISOString(),
        });
        if (editTarget.discord_id) {
          pushNotification('promotion', `Gradul tău a fost modificat: ${editTarget.rank} → ${editForm.rank}`, editTarget.discord_id);
        }
      } else if (
        editForm.full_name !== editTarget.full_name ||
        editForm.callsign !== editTarget.callsign ||
        editForm.employee_id !== editTarget.employee_id
      ) {
        if (editTarget.discord_id) {
          pushNotification('account', `Contul tău a fost actualizat de ${user.full_name}`, editTarget.discord_id);
        }
      }

      // Istoric inactivitate — dacă statusul devine Inactiv/Concediu (rămâne înregistrat permanent)
      if (editForm.status && editTarget.status !== editForm.status &&
          ['Inactiv', 'Concediu'].includes(editForm.status)) {
        await addDoc(collection(db, 'inactivity_log'), {
          member_id:  editTarget.id,
          discord_id: editTarget.discord_id || '',
          full_name:  editForm.full_name || editTarget.full_name,
          rank:       editForm.rank || editTarget.rank,
          status:     editForm.status,
          date:       new Date().toISOString(),
        });
      }

      showToast('Modificările au fost salvate!');
      setEditTarget(null);
    } catch (e) {
      console.error(e);
      showToast('Eroare: ' + e.message, 'error');
    }
    setSaving(false);
  }

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    return (
      m.full_name?.toLowerCase().includes(q) ||
      m.rank?.toLowerCase().includes(q) ||
      m.callsign?.toLowerCase().includes(q) ||
      m.discord_id?.includes(q) ||
      m.employee_id?.includes(q)
    );
  });

  const prMembers   = sortByGrade(filtered.filter(m => ['Membru PR','Adjunct PR','Manager PR'].includes(m.rank)));
  const supMembers  = sortByGrade(filtered.filter(m => m.rank === 'Supervizor PR'));
  const hospMembers = sortByGrade(filtered.filter(m => m.rank === 'Conducere Spital'));

  function logout() { sessionStorage.removeItem('pr_user'); router.replace('/'); }

  return (
    <div className={styles.root}>
      <div className={styles.bgOrb1}/><div className={styles.bgOrb2}/>

      

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Membri</h1>
            <p className={styles.headerSub}>{members.length} membri înregistrați total</p>
          </div>
          <div className={styles.headerSearch}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className={styles.searchInput} placeholder="Caută după nume, grad, callsign, ID..." value={search} onChange={e => setSearch(e.target.value)}/>
            {search && <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>}
          </div>
        </header>

        {loading ? (
          <div className={styles.loadState}><div className={styles.spinner}/><span>Se încarcă membrii...</span></div>
        ) : (
          <div className={styles.allSections}>
            <MemberSection title="Relații Publice"  members={prMembers}   accent="#9d7bff" canEdit={canEdit} onEdit={openEdit} statusColors={STATUS_COLORS}/>
            {supMembers.length  > 0 && <MemberSection title="Supervizori PR"   members={supMembers}  accent="#5eb3f5" canEdit={canEdit} onEdit={openEdit} statusColors={STATUS_COLORS}/>}
            {hospMembers.length > 0 && <MemberSection title="Conducere Spital" members={hospMembers} accent="#3ddc84" canEdit={canEdit} onEdit={openEdit} statusColors={STATUS_COLORS}/>}
          </div>
        )}
      </main>

      {editTarget && (
        <div className={styles.overlay} onClick={() => setEditTarget(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTop}>
              <div className={styles.modalProfile}>
                <img src={editTarget.discord_avatar || '/logo_pr.png'} alt="" className={styles.modalAvatar}/>
                <div>
                  <div className={styles.modalName}>{editTarget.full_name}</div>
                  <div className={styles.modalSub}>
                    <span className={styles.modalRankBadge} style={{ '--a': GRADE_ACCENT[editTarget.rank] || '#8b5cf6' }}>{editTarget.rank}</span>
                  </div>
                </div>
              </div>
              <button className={styles.modalClose} onClick={() => setEditTarget(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className={styles.modalDivider}/>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Nume Complet</label>
                <input className={styles.input} value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}/>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Grad</label>
                <select className={styles.select} value={editForm.rank} onChange={e => setEditForm(f => ({ ...f, rank: e.target.value }))}>
                  {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label}>Status</label>
                <div className={styles.statusGrid}>
                  {STATUS_OPTIONS.map(s => {
                    const sc = STATUS_COLORS[s] || STATUS_COLORS['Inactiv'];
                    const active = editForm.status === s;
                    return (
                      <button key={s}
                        className={`${styles.statusOption} ${active ? styles.statusSelected : ''}`}
                        style={active ? { background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text } : {}}
                        onClick={() => setEditForm(f => ({ ...f, status: s }))}>
                        <span className={styles.statusDot} style={{ background: active ? sc.text : 'rgba(255,255,255,.2)' }}/>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>ID Angajat</label>
                <input className={styles.input} placeholder="ex: PR-001" value={editForm.employee_id} onChange={e => setEditForm(f => ({ ...f, employee_id: e.target.value }))}/>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Callsign</label>
                <input className={styles.input} placeholder="ex: PR-7" value={editForm.callsign} onChange={e => setEditForm(f => ({ ...f, callsign: e.target.value }))}/>
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label}>Discord ID</label>
                <input className={styles.input} value={editForm.discord_id} onChange={e => setEditForm(f => ({ ...f, discord_id: e.target.value }))}/>
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label}>Notițe</label>
                <textarea className={styles.textarea} placeholder="Observații..." value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}/>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setEditTarget(null)}>Anulează</button>
              <button className={styles.saveBtn} onClick={saveEdit} disabled={saving}>
                {saving ? <><span className={styles.savingDot}/>Se salvează...</> : <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
                  Salvează
                </>}
              </button>
            </div>
          </div>
        </div>
      )}

      <TopBar user={user} title="Membri"/>

      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.type === 'error'
            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function MemberSection({ title, members, accent, canEdit, onEdit, statusColors }) {
  if (members.length === 0) return null;
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionDot} style={{ background: accent }}/>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span className={styles.sectionCount}>{members.length}</span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Membru</th><th>Grad</th><th>Status</th>
              <th>ID Angajat</th><th>Callsign</th><th>Discord ID</th>
              <th>Data Angajării</th>
              {canEdit && <th style={{ textAlign: 'right' }}>Acțiuni</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const sc = statusColors[m.status] || { bg: 'rgba(148,163,184,.1)', border: 'rgba(148,163,184,.2)', text: '#94a3b8' };
              const ga = GRADE_ACCENT[m.rank] || accent;
              return (
                <tr key={m.id} className={styles.row} style={{ animationDelay: `${i * .03}s` }}>
                  <td>
                    <div className={styles.memberCell}>
                      <img src={m.discord_avatar || '/logo_pr.png'} alt={m.full_name} className={styles.avatar}/>
                      <span className={styles.memberName}>{m.full_name}</span>
                    </div>
                  </td>
                  <td><span className={styles.gradeBadge} style={{ '--ga': ga }}>{m.rank}</span></td>
                  <td>
                    <span className={styles.statusBadge} style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                      <span className={styles.statusDot} style={{ background: sc.text }}/>
                      {m.status || '—'}
                    </span>
                  </td>
                  <td className={styles.mono}>{m.employee_id || <span className={styles.dash}>—</span>}</td>
                  <td className={styles.mono}>{m.callsign   || <span className={styles.dash}>—</span>}</td>
                  <td className={styles.mono}>{m.discord_id || <span className={styles.dash}>—</span>}</td>
                  <td className={styles.dateCell}>
                    {m.join_date ? new Date(m.join_date).toLocaleDateString('ro-RO') : <span className={styles.dash}>—</span>}
                  </td>
                  {canEdit && (
                    <td style={{ textAlign: 'right' }}>
                      <button className={styles.editBtn} onClick={() => onEdit(m)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Editează
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}