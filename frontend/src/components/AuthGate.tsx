// PATH: src/components/AuthGate.tsx | REQ-ID: TERAPIA-AUTH-01
// FAZA 2: wejście do grupy. Kolejność: logowanie (link na e-mail / Google) → imię + zgoda na zasady (wersjonowana)
// → „czekasz na akceptację” (admin wpuszcza) → aplikacja. W demo bramka nic nie robi.
// Uprawnienia trzyma baza (RLS): niewpuszczony i tak nie dostanie żadnych danych grupy — ten ekran jest tylko dla ludzi.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Clock, LogOut, Mail, ShieldX } from 'lucide-react';
import { DATA_MODE, GOOGLE_LOGIN, redirectUrl, supabase } from '../services/supabaseClient';
import { supabaseSource } from '../services/groupData';
import { RULES_VERSION } from '../demo/rules';
import { Onboarding } from './Onboarding';
import { CrisisBox } from './RulesPanel';

export interface MemberRow {
  id: string; name: string; role: 'therapist' | 'participant'; status: 'pending' | 'approved' | 'blocked' | 'removed';
  emoji: string; color: string; photo_url: string | null; real_name: string; about: string;
  show_photo: boolean; show_real_name: boolean; show_about: boolean;
}

export interface AuthState {
  mode: 'demo' | 'supabase';
  uid: string;
  email: string;
  isAdmin: boolean;
  member: MemberRow | null;
  acceptedAt?: string;
  /** Zapis profilu (imię, ikonka, przełączniki „pokaż grupie”). */
  saveMember(patch: Partial<MemberRow>): Promise<void>;
  /** Ponowna akceptacja zasad (zakładka Zasady → „pokaż zgodę”). */
  accept(firstName: string): Promise<void>;
  signOut(): Promise<void>;
}

const DEMO_AUTH: AuthState = {
  mode: 'demo', uid: '', email: '', isAdmin: false, member: null,
  saveMember: async () => {}, accept: async () => {}, signOut: async () => {},
};

const Ctx = createContext<AuthState>(DEMO_AUTH);
export const useAuth = () => useContext(Ctx);

const card = 'bg-panel border border-line rounded-3xl shadow-2xl w-full max-w-md p-6 text-fg';
const btn = 'tap w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = `${btn} bg-sky-500/20 border-sky-400/30 text-acc hover:bg-sky-500/30`;
const btnGhost = `${btn} border-line text-fg2 hover:bg-surf2`;

const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-[100dvh] bg-bg flex items-center justify-center px-4 py-8 text-fg">{children}</div>
);

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true } });
    setBusy(false);
    if (error) setErr(/rate|limit|seconds/i.test(error.message) ? 'Za dużo prób w krótkim czasie — spróbuj za kilka minut.' : error.message);
    else setSent(true);
  };
  const google = async () => {
    setErr('');
    const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
    if (error) setErr(error.message);
  };
  return (
    <Screen>
      <div className={card}>
        <h1 className="text-2xl font-extrabold">Wejście do grupy</h1>
        <p className="mt-2 text-base text-fg2">Zaloguj się adresem e-mail. Po pierwszym wejściu prowadząca musi Cię wpuścić — do tego czasu nie widzisz nic z grupy.</p>
        {sent ? (
          <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <p className="text-base font-semibold text-ok">Wysłaliśmy link na {email.trim()}</p>
            <p className="mt-1 text-sm text-fg2">Otwórz pocztę na tym urządzeniu i stuknij link — wrócisz tutaj zalogowany(-a). Nie widzisz maila? Sprawdź „Spam”.</p>
            <button className={`${btnGhost} mt-3`} onClick={() => setSent(false)}>Inny adres</button>
          </div>
        ) : (
          <form onSubmit={sendLink} className="mt-5 flex flex-col gap-3">
            <label className="text-sm text-mut" htmlFor="login-email">Adres e-mail</label>
            <input id="login-email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)}
              className="tap w-full rounded-xl border border-line bg-surf px-4 text-base text-fg" placeholder="imie@przyklad.pl" />
            <button type="submit" className={btnPrimary} disabled={busy || !email.includes('@')}><Mail className="w-5 h-5" />{busy ? 'Wysyłam…' : 'Wyślij link do logowania'}</button>
          </form>
        )}
        {GOOGLE_LOGIN && !sent && (
          <>
            <div className="my-4 flex items-center gap-3 text-sm text-mut"><span className="h-px flex-1 bg-line" />albo<span className="h-px flex-1 bg-line" /></div>
            <button className={btnGhost} onClick={google}><span className="font-extrabold">G</span>Zaloguj przez Google</button>
          </>
        )}
        {err && <p role="alert" className="mt-3 text-sm text-warn">{err}</p>}
        <p className="mt-5 text-sm text-mut">Grupa zobaczy tylko Twoje imię. Adres e-mail widzi wyłącznie prowadząca.</p>
      </div>
    </Screen>
  );
}

function WaitingScreen({ name, status, onSignOut }: { name: string; status: MemberRow['status']; onSignOut: () => void }) {
  const refused = status === 'blocked' || status === 'removed';
  return (
    <Screen>
      <div className={card}>
        {refused ? <ShieldX className="w-10 h-10 text-warn" /> : <Clock className="w-10 h-10 text-acc" />}
        <h1 className="mt-3 text-2xl font-extrabold">{refused ? 'Brak dostępu do grupy' : `Dzień dobry, ${name}`}</h1>
        <p className="mt-2 text-base text-fg2">
          {refused
            ? 'Prowadząca nie wpuściła tego konta do grupy albo je wyłączyła. Jeśli to pomyłka, skontaktuj się z prowadzącą.'
            : 'Czekasz na akceptację prowadzącej. Gdy Cię wpuści, ta strona sama się otworzy — nie musisz nic klikać.'}
        </p>
        <div className="mt-4"><CrisisBox /></div>
        <button className={`${btnGhost} mt-5`} onClick={onSignOut}><LogOut className="w-5 h-5" />Wyloguj</button>
      </div>
    </Screen>
  );
}

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (DATA_MODE === 'demo') return <Ctx.Provider value={DEMO_AUTH}>{children}</Ctx.Provider>;
  return <SupabaseGate>{children}</SupabaseGate>;
};

const SupabaseGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sb = supabase!;
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [member, setMember] = useState<MemberRow | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | undefined>();
  const [err, setErr] = useState('');

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  const uid = session?.user.id ?? '';
  const loadMe = useCallback(async () => {
    if (!uid) return;
    supabaseSource?.setUser(uid);
    let m, c, a;
    try {
      [m, c, a] = await Promise.all([
        sb.from('members').select('*').eq('id', uid).maybeSingle(),
        sb.from('consents').select('accepted_at').eq('member_id', uid).eq('rules_version', RULES_VERSION).maybeSingle(),
        sb.rpc('is_admin'),
      ]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e)); // brak sieci / blokada — komunikat zamiast wiecznego „Wczytywanie…”
      return;
    }
    if (m.error) { setErr(m.error.message); return; }
    setMember((m.data as MemberRow) ?? null);
    setAcceptedAt((c.data as { accepted_at: string } | null)?.accepted_at);
    setIsAdmin(a.data === true);
  }, [sb, uid]);

  useEffect(() => { void loadMe(); }, [loadMe]);

  // „Czekasz na akceptację”: strona sama sprawdza co 15 s i przy powrocie do aplikacji
  const waiting = !!member && member.status === 'pending' && !isAdmin;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(loadMe, 15_000);
    const vis = () => { if (document.visibilityState === 'visible') void loadMe(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [waiting, loadMe]);

  const accept = useCallback(async (firstName: string) => {
    const name = firstName.trim();
    const up = member
      ? await sb.from('members').update({ name }).eq('id', uid)
      : await sb.from('members').insert({ id: uid, name });
    if (up.error) throw new Error(up.error.message);
    const c = await sb.from('consents').upsert({ member_id: uid, rules_version: RULES_VERSION }, { onConflict: 'member_id,rules_version', ignoreDuplicates: true });
    if (c.error) throw new Error(c.error.message);
    await loadMe();
  }, [sb, uid, member, loadMe]);

  const saveMember = useCallback(async (patch: Partial<MemberRow>) => {
    const { id: _i, status: _s, role: _r, ...safe } = patch;
    const r = await sb.from('members').update(safe).eq('id', uid);
    if (r.error) throw new Error(r.error.message);
    await loadMe();
  }, [sb, uid, loadMe]);

  const signOut = useCallback(async () => {
    await sb.auth.signOut();
    setMember(undefined); setAcceptedAt(undefined); setIsAdmin(false);
  }, [sb]);

  if (session === undefined) return <Screen><p className="text-base text-mut">Wczytywanie…</p></Screen>;
  if (!session) return <LoginScreen />;
  if (err) return <Screen><div className={card}><p className="text-base text-warn">Błąd połączenia z grupą: {err}</p><button className={`${btnGhost} mt-4`} onClick={() => { setErr(''); void loadMe(); }}>Spróbuj ponownie</button></div></Screen>;
  if (member === undefined) return <Screen><p className="text-base text-mut">Wczytywanie…</p></Screen>;

  const googleName = String(session.user.user_metadata?.given_name ?? session.user.user_metadata?.full_name ?? '').split(' ')[0];
  if (!member || !acceptedAt) {
    return (
      <Screen>
        <Onboarding initialName={member?.name ?? googleName} onDone={n => { accept(n).catch(e => setErr(String(e.message ?? e))); }} />
      </Screen>
    );
  }
  if (member.status !== 'approved' && !isAdmin) return <WaitingScreen name={member.name} status={member.status} onSignOut={signOut} />;

  const value: AuthState = { mode: 'supabase', uid, email: session.user.email ?? '', isAdmin, member, acceptedAt, saveMember, accept, signOut };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
