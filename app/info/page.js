'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import TopBar from '../../components/TopBar';
import styles from './info.module.css';

const CAN_MANAGE = ['Adjunct PR', 'Manager PR', 'Supervizor PR', 'Conducere Spital'];

const ICONS = {
  regulament: <path d="M9 12h6m-6 4h6M9 8h6M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>,
  reguli:     <><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/></>,
  tips:       <><path d="M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A6 6 0 1 0 6.5 12c.76.76 1.23 1.52 1.41 2.5"/></>,
  general:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
};

const CATEGORY_OPTS = [
  { key:'regulament', label:'Regulament' },
  { key:'reguli',     label:'Reguli' },
  { key:'tips',       label:'Tips & Tricks' },
  { key:'general',    label:'General' },
];

export default function InfoPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null); // {mode:'new'|'edit', entry?}
  const [form, setForm] = useState({ title:'', body:'', category:'general' });
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const toastRef = useRef();

  const canManage = user && CAN_MANAGE.includes(user.rank);

  useEffect(() => {
    const stored = sessionStorage.getItem('pr_user');
    if (!stored) { router.replace('/'); return; }
    setUser(JSON.parse(stored));

    const q = query(collection(db, 'info_entries'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function showToast(msg, type='success') {
    setToast({ msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }

  function openNew() {
    setForm({ title:'', body:'', category:'general' });
    setModal({ mode:'new' });
  }
  function openEdit(entry) {
    setForm({ title:entry.title, body:entry.body, category:entry.category });
    setModal({ mode:'edit', entry });
  }

  async function submit() {
    if (!form.title.trim() || !form.body.trim()) {
      showToast('Completează titlul și conținutul.', 'error'); return;
    }
    setSaving(true);
    try {
      if (modal.mode === 'new') {
        await addDoc(collection(db, 'info_entries'), {
          ...form, author: user.full_name, created_at: new Date().toISOString(),
        });
        showToast('Secțiune adăugată!');
      } else {
        await updateDoc(doc(db, 'info_entries', modal.entry.id), {
          ...form, updated_at: new Date().toISOString(), updated_by: user.full_name,
        });
        showToast('Secțiune actualizată!');
      }
      setModal(null);
    } catch (e) { showToast('Eroare.', 'error'); }
    setSaving(false);
  }

  async function confirmDelete() {
    if (!delTarget) return;
    try {
      await deleteDoc(doc(db, 'info_entries', delTarget.id));
      showToast('Secțiune ștearsă.');
      setDelTarget(null);
    } catch (e) { showToast('Eroare.', 'error'); }
  }

  const filtered = filter === 'all' ? entries : entries.filter(e => e.category === filter);
  const counts = CATEGORY_OPTS.reduce((acc, c) => ({ ...acc, [c.key]: entries.filter(e => e.category === c.key).length }), {});

  return (
    <div className={styles.root}>
      <div className={styles.bg1}/><div className={styles.bg2}/>
      <TopBar user={user} title="Informații"/>

      <main className={styles.main}>
        <div className={styles.topRow}>
          <div className={styles.filters}>
            <button className={`${styles.filterBtn} ${filter==='all'?styles.filterActive:''}`} onClick={() => setFilter('all')}>
              Toate <span className={styles.filterCount}>{entries.length}</span>
            </button>
            {CATEGORY_OPTS.map(c => (
              <button key={c.key} className={`${styles.filterBtn} ${filter===c.key?styles.filterActive:''}`} onClick={() => setFilter(c.key)}>
                {c.label} <span className={styles.filterCount}>{counts[c.key]||0}</span>
              </button>
            ))}
          </div>
          {canManage && (
            <button className={styles.addBtn} onClick={openNew}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Secțiune nouă
            </button>
          )}
        </div>

        {loading ? (
          <div className={styles.loadState}><div className="cb-spinner"/></div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <span>📋</span>
            <p>{filter==='all' ? 'Nicio secțiune adăugată încă.' : 'Nicio secțiune în această categorie.'}</p>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map((e,i) => {
              const cat = CATEGORY_OPTS.find(c => c.key === e.category) || CATEGORY_OPTS[3];
              return (
                <div key={e.id} className={styles.card} style={{ animationDelay:`${i*.04}s` }}>
                  <div className={styles.cardHead}>
                    <div className={styles.cardIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18" strokeLinecap="round" strokeLinejoin="round">
                        {ICONS[e.category] || ICONS.general}
                      </svg>
                    </div>
                    <div className={styles.cardHeadText}>
                      <span className={styles.cardTitle}>{e.title}</span>
                      <span className={styles.cardCat}>{cat.label}</span>
                    </div>
                    {canManage && (
                      <div className={styles.cardActions}>
                        <button className={styles.iconBtn} onClick={() => openEdit(e)} title="Editează">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => setDelTarget(e)} title="Șterge">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={styles.cardBody}>{e.body}</div>
                  <div className={styles.cardMeta}>
                    {e.author} · {new Date(e.created_at).toLocaleDateString('ro-RO')}
                    {e.updated_by && <span> · editat de {e.updated_by}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add/Edit modal */}
      {modal && (
        <div className={styles.overlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.mhead}>
              <h3>{modal.mode==='new' ? 'Secțiune nouă' : 'Editează secțiune'}</h3>
              <button className={styles.mx} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.mform}>
              <div className={styles.field}>
                <span className={styles.flabel}>Categorie</span>
                <div className={styles.catGrid}>
                  {CATEGORY_OPTS.map(c => (
                    <button key={c.key} className={`${styles.catOpt} ${form.category===c.key?styles.catActive:''}`} onClick={() => setForm(f=>({...f,category:c.key}))}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16" strokeLinecap="round" strokeLinejoin="round">{ICONS[c.key]}</svg>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <span className={styles.flabel}>Titlu</span>
                <input className={styles.inp} placeholder="ex: Reguli generale comportament" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
              </div>
              <div className={styles.field}>
                <span className={styles.flabel}>Conținut</span>
                <textarea className={styles.textarea} placeholder="Scrie conținutul aici..." value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}/>
              </div>
            </div>
            <div className={styles.mfoot}>
              <button className={styles.mcancel} onClick={() => setModal(null)}>Anulează</button>
              <button className={styles.msave} onClick={submit} disabled={saving}>{saving?'Se salvează...':'Salvează'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <div className={styles.overlay} onClick={() => setDelTarget(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </div>
            <div className={styles.confirmTitle}>Ștergi secțiunea?</div>
            <div className={styles.confirmSub}><strong>{delTarget.title}</strong> va fi eliminată permanent.</div>
            <div className={styles.mfoot}>
              <button className={styles.mcancel} onClick={() => setDelTarget(null)}>Anulează</button>
              <button className={styles.deleteBtn} onClick={confirmDelete}>Șterge</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`${styles.toast} ${toast.type==='error'?styles.toastErr:styles.toastOk}`}>{toast.msg}</div>}
    </div>
  );
}
