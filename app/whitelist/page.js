'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './whitelist.module.css';
import TopBar from '../../components/TopBar';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';


const GRADE_OPTIONS = ['Membru PR', 'Adjunct PR', 'Manager PR', 'Supervizor PR', 'Conducere Spital'];
const GRADE_COLORS  = {
  'Membru PR':        '#9d7bff',
  'Adjunct PR':       '#6366f1',
  'Manager PR':       '#ffb454',
  'Supervizor PR':    '#5eb3f5',
  'Conducere Spital': '#3ddc84',
};
const EMPTY_FORM = { discord_id: '', full_name: '', rank: 'Membru PR', employee_id: '', callsign: '', join_date: '' };

function FormModal({ title, onSubmit, form, setForm, saving, onClose }) {
  const GRADE_OPTIONS = ['Membru PR', 'Adjunct PR', 'Manager PR', 'Supervizor PR', 'Conducere Spital'];
  const GRADE_COLORS  = {
    'Membru PR':        '#9d7bff',
    'Adjunct PR':       '#6366f1',
    'Manager PR':       '#ffb454',
    'Supervizor PR':    '#5eb3f5',
    'Conducere Spital': '#3ddc84',
  };
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Discord ID *</label>
            <input className={styles.input} placeholder="ex: 123456789012345678"
              value={form.discord_id} onChange={e => setForm(f => ({ ...f, discord_id: e.target.value }))}/>
            <span className={styles.hint}>Settings → Advanced → Developer Mode → click dreapta → Copy ID</span>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Nume Complet *</label>
            <input className={styles.input} placeholder="Prenume Nume"
              value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}/>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Grad</label>
            <select className={styles.select} value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))}>
              {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>ID Angajat</label>
            <input className={styles.input} placeholder="ex: PR-001"
              value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}/>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Callsign</label>
            <input className={styles.input} placeholder="ex: PR-7"
              value={form.callsign} onChange={e => setForm(f => ({ ...f, callsign: e.target.value }))}/>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Data Intrării</label>
            <input type="date" className={styles.input}
              value={form.join_date} onChange={e => setForm(f => ({ ...f, join_date: e.target.value }))}/>
          </div>
        </div>
        <div className={styles.preview}>
          <div className={styles.previewLabel}>Preview</div>
          <div className={styles.previewCard}>
            <div className={styles.previewAvatar}>
              {form.full_name ? form.full_name.split(' ').map(w => w[0]).slice(0, 2).join('') : '?'}
            </div>
            <div className={styles.previewInfo}>
              <span className={styles.previewName}>{form.full_name || 'Nume Complet'}</span>
              <div className={styles.previewMeta}>
                {form.callsign && <span className={styles.csBadge}>{form.callsign}</span>}
                <span className={styles.previewId}>{form.discord_id || 'Discord ID'}</span>
              </div>
            </div>
            <div className={styles.previewRight}>
              <span className={styles.gradeBadge} style={{ color: GRADE_COLORS[form.rank], background: GRADE_COLORS[form.rank] + '18', borderColor: GRADE_COLORS[form.rank] + '44' }}>
                {form.rank}
              </span>
              {form.employee_id && <span className={styles.empId}>{form.employee_id}</span>}
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Anulează</button>
          <button className={styles.saveBtn} onClick={onSubmit} disabled={saving}>
            {saving ? <><span className={styles.savingDot}/>Se salvează...</> : title.includes('Adaugă') ? '+ Adaugă' : '✓ Salvează'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WhitelistPage() {
  const router = useRouter();
  const [user,       setUser]       = useState(null);
  const [list,       setList]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [addModal,   setAddModal]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [delTarget,  setDelTarget]  = useState(null);
  const [toast,      setToast]      = useState(null);
  const toastRef = useRef();

  useEffect(() => {
    const stored = sessionStorage.getItem('pr_user');
    if (!stored) { router.replace('/'); return; }
    const u = JSON.parse(stored);
    if (!['Adjunct PR', 'Manager PR', 'Supervizor PR', 'Conducere Spital'].includes(u.rank)) {
      router.replace('/dashboard'); return;
    }
    setUser(u);

    const wq = query(collection(db, 'whitelist'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(wq, (snap) => {
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }

  async function submitAdd() {
    if (!form.discord_id.trim() || !form.full_name.trim()) {
      showToast('Discord ID și Nume sunt obligatorii.', 'error'); return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'whitelist', form.discord_id.trim()), {
        ...form,
        added_by: user.full_name,
        created_at: new Date().toISOString(),
      });
      showToast('Adăugat în whitelist!'); setAddModal(false); setForm(EMPTY_FORM);
    } catch (e) { showToast('Eroare: ' + e.message, 'error'); }
    setSaving(false);
  }

  async function submitEdit() {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'whitelist', editTarget.id), { ...form });
      showToast('Modificat!'); setEditTarget(null); setForm(EMPTY_FORM);
    } catch (e) { showToast('Eroare: ' + e.message, 'error'); }
    setSaving(false);
  }

  async function confirmDelete() {
    if (!delTarget) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'whitelist', delTarget.id));
      showToast('Eliminat din whitelist.'); setDelTarget(null);
    } catch (e) { showToast('Eroare la ștergere.', 'error'); }
    setSaving(false);
  }

  function openEdit(entry) {
    setEditTarget(entry);
    setForm({
      discord_id:  entry.discord_id  || '',
      full_name:   entry.full_name   || '',
      rank:        entry.rank        || 'Membru PR',
      employee_id: entry.employee_id || '',
      callsign:    entry.callsign    || '',
      join_date:   entry.join_date   ? entry.join_date.split('T')[0] : '',
    });
  }

  const filtered = list.filter(e => {
    const q = search.toLowerCase();
    return e.full_name?.toLowerCase().includes(q) || e.discord_id?.includes(q) || e.rank?.toLowerCase().includes(q) || e.callsign?.toLowerCase().includes(q);
  });

  function logout() { sessionStorage.removeItem('pr_user'); router.replace('/'); }


  return (
    <div className={styles.root}>
      <div className={styles.bgOrb1}/><div className={styles.bgOrb2}/>

      

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Whitelist</h1>
            <p className={styles.headerSub}>{list.length} persoane autorizate</p>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.searchWrap}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className={styles.searchInput} placeholder="Caută..." value={search} onChange={e => setSearch(e.target.value)}/>
              {search && <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>}
            </div>
            <button className={styles.addBtn} onClick={() => { setForm(EMPTY_FORM); setAddModal(true); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Adaugă
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className={styles.statsBar}>
          {GRADE_OPTIONS.map(g => {
            const count = list.filter(e => e.rank === g).length;
            const color = GRADE_COLORS[g];
            return (
              <div key={g} className={styles.statChip}>
                <span className={styles.statDot} style={{ background: color }}/>
                <span className={styles.statLabel}>{g}</span>
                <span className={styles.statNum} style={{ color }}>{count}</span>
              </div>
            );
          })}
        </div>

        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.loadState}><div className={styles.spinner}/><span>Se încarcă...</span></div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <p>{search ? `Niciun rezultat pentru "${search}"` : 'Lista whitelist este goală.'}</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th><th>Nume Complet</th><th>Discord ID</th><th>Grad</th>
                  <th>ID Angajat</th><th>Callsign</th><th>Data Intrării</th>
                  <th>Adăugat de</th><th style={{ textAlign: 'right' }}>Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const color = GRADE_COLORS[e.rank] || '#9d7bff';
                  return (
                    <tr key={e.id} className={styles.row} style={{ animationDelay: `${i * .03}s` }}>
                      <td className={styles.rowNum}>{i + 1}</td>
                      <td><span className={styles.fullName}>{e.full_name}</span></td>
                      <td className={styles.mono}>{e.discord_id}</td>
                      <td>
                        <span className={styles.gradeBadge} style={{ color, background: color + '18', borderColor: color + '44' }}>{e.rank}</span>
                      </td>
                      <td className={styles.mono}>{e.employee_id || <span className={styles.dash}>—</span>}</td>
                      <td>{e.callsign ? <span className={styles.csBadge}>{e.callsign}</span> : <span className={styles.dash}>—</span>}</td>
                      <td className={styles.dateCell}>{e.join_date ? new Date(e.join_date).toLocaleDateString('ro-RO') : <span className={styles.dash}>—</span>}</td>
                      <td className={styles.addedBy}>{e.added_by || '—'}</td>
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.editBtn} onClick={() => openEdit(e)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editează
                          </button>
                          <button className={styles.delBtn} onClick={() => setDelTarget(e)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {(addModal || editTarget) && (
        <FormModal
          title={editTarget ? 'Editează Intrare' : 'Adaugă în Whitelist'}
          onSubmit={editTarget ? submitEdit : submitAdd}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => { setAddModal(false); setEditTarget(null); }}
        />
      )}

      {delTarget && (
        <div className={styles.overlay} onClick={() => setDelTarget(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 className={styles.confirmTitle}>Elimini din whitelist?</h3>
            <p className={styles.confirmSub}><strong>{delTarget.full_name}</strong> nu va mai putea accesa panelul.</p>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setDelTarget(null)}>Anulează</button>
              <button className={styles.deleteBtn} onClick={confirmDelete} disabled={saving}>
                {saving ? 'Se șterge...' : 'Da, elimină'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TopBar user={user} title="Whitelist"/>

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
