// PATH: src/components/ChangePassword.tsx | REQ-ID: TERAPIA-AUTH-PASS-01
// Zmiana hasła w Ustawieniach → Profil (Bartek 08.11: konto zakłada admin z hasłem tymczasowym, osoba zmienia je sama).
// Tylko dla kont z logowaniem e-mail + hasło — przy samym Google nie ma czego zmieniać.
import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

export const ChangePassword: React.FC = () => {
  const [hasPassword, setHasPassword] = useState(false);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void supabase?.auth.getUser().then(({ data }) => setHasPassword(!!data.user?.identities?.some(i => i.provider === 'email')));
  }, []);
  if (!supabase || !hasPassword) return null;

  const save = async () => {
    setMsg(null);
    if (pass.length < 8) return setMsg({ ok: false, text: 'Hasło musi mieć co najmniej 8 znaków.' });
    if (pass !== pass2) return setMsg({ ok: false, text: 'Hasła się różnią — wpisz dwa razy to samo.' });
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password: pass });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: /different from the old/i.test(error.message) ? 'Nowe hasło musi być inne niż obecne.' : error.message });
    setPass(''); setPass2('');
    setMsg({ ok: true, text: 'Hasło zmienione. Przy następnym logowaniu użyj nowego.' });
  };

  const input = 'w-full h-11 rounded-xl border border-line bg-surf px-3 text-base text-fg';
  return (
    <div className="mx-4 mt-4 p-3 rounded-xl border border-line bg-surf space-y-2">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-fg2"><KeyRound className="w-4 h-4" />Zmień hasło</span>
      <input type="password" autoComplete="new-password" placeholder="Nowe hasło (co najmniej 8 znaków)" aria-label="Nowe hasło"
        value={pass} onChange={e => setPass(e.target.value)} className={input} />
      <input type="password" autoComplete="new-password" placeholder="Powtórz nowe hasło" aria-label="Powtórz nowe hasło"
        value={pass2} onChange={e => setPass2(e.target.value)} className={input} />
      <button type="button" onClick={() => void save()} disabled={busy || !pass}
        className="tap h-11 px-4 rounded-xl bg-sky-500/20 text-acc border border-sky-400/30 font-semibold cursor-pointer disabled:opacity-50">
        {busy ? 'Chwila…' : 'Zapisz nowe hasło'}
      </button>
      {msg && <p className={`text-sm ${msg.ok ? 'text-ok' : 'text-bad'}`} role="status">{msg.text}</p>}
    </div>
  );
};
