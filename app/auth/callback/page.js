'use client';

import { Suspense } from 'react';
import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

function CallbackInner() {
  const router    = useRouter();
  const params    = useSearchParams();
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = params.get('code');
    if (!code) { router.replace('/'); return; }

    (async () => {
      try {
        // 1. Schimb codul Discord -> date utilizator (server-side, are nevoie de client_secret)
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!res.ok || !data.discordId) { router.replace('/?error=1'); return; }

        const { discordId, discordTag, discordAvatar } = data;

        // 2. Verifică whitelist direct din Firestore
        const wlRef  = doc(db, 'whitelist', discordId);
        const wlSnap = await getDoc(wlRef);
        if (!wlSnap.exists()) { router.replace('/?denied=1'); return; }
        const entry = wlSnap.data();

        // 3. Upsert membru
        const memberRef  = doc(db, 'members', discordId);
        const memberSnap = await getDoc(memberRef);
        const existing   = memberSnap.exists() ? memberSnap.data() : null;

        const memberData = {
          discord_id:     discordId,
          discord_tag:    discordTag,
          discord_avatar: discordAvatar || existing?.discord_avatar || '',
          // Gradul/numele din 'members' sunt sursa de adevăr după prima logare —
          // whitelist se folosește doar pentru a popula un membru nou.
          full_name:      existing?.full_name ?? entry.full_name,
          rank:           existing?.rank      ?? entry.rank,
          status:         existing?.status || 'Activ',
          callsign:       existing?.callsign    ?? entry.callsign    ?? '',
          employee_id:    existing?.employee_id ?? entry.employee_id ?? '',
          notes:          existing?.notes ?? '',
          join_date:      existing?.join_date ?? entry.join_date ?? new Date().toISOString(),
          updated_at:     new Date().toISOString(),
        };

        await setDoc(memberRef, memberData, { merge: true });

        sessionStorage.setItem('pr_user', JSON.stringify(memberData));
        router.replace('/hub');
      } catch (e) {
        console.error(e);
        router.replace('/?error=1');
      }
    })();
  }, []);

  return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'var(--bg)', gap:20,
    }}>
      <div className="cb-spinner"/>
      <p style={{ color:'#4A4560', fontSize:13, letterSpacing:'.5px', fontFamily:'var(--font-body)' }}>
        Se verifică accesul...
      </p>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
        <div className="cb-spinner"/>
      </div>
    }>
      <CallbackInner/>
    </Suspense>
  );
}
