// PATH: src/components/Onboarding.tsx | REQ-ID: TERAPIA-ONBOARDING-01
// Pierwsze wejście: imię (obowiązkowe) → zasady + regulamin + akceptacja. Nie da się zamknąć bez akceptacji.
import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, HeartHandshake, User } from 'lucide-react';
import { APP_TERMS, GROUP_RULES } from '../demo/rules';
import { CrisisBox } from './RulesPanel';

type Step = 'welcome' | 'name' | 'rules';

/** Zwraca komunikat błędu albo null, gdy imię jest poprawne. */
export function validateFirstName(raw: string): string | null {
  const v = raw.trim();
  if (v.length < 2) return 'Imię musi mieć co najmniej 2 znaki.';
  if (v.length > 30) return 'Imię może mieć najwyżej 30 znaków.';
  if (v.toLocaleLowerCase('pl-PL') === 'gość') return 'Wpisz swoje imię zamiast „Gość”.';
  return null;
}

const btnPrimary = 'tap inline-flex items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold border bg-sky-500/20 border-sky-400/30 text-acc hover:bg-sky-500/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const btnGhost = 'tap inline-flex items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold text-mut hover:text-fg hover:bg-surf2 cursor-pointer';

export const Onboarding: React.FC<{ initialName: string; onDone: (firstName: string) => void }> = ({ initialName, onDone }) => {
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState(initialName.trim().toLocaleLowerCase('pl-PL') === 'gość' ? '' : initialName);
  const [touched, setTouched] = useState(false);
  const [agree, setAgree] = useState(false);
  const nameErr = validateFirstName(name);
  const stepNo = step === 'welcome' ? 1 : step === 'name' ? 2 : 3;

  return (
    <div className="fixed inset-0 z-[80] bg-bg/90 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="onb-title"
        className="bg-panel border border-line rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-xl max-h-[94vh] flex flex-col text-fg">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="text-sm text-mut">Krok {stepNo} z 3</span>
          <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2, 3].map(n => (
              <span key={n} className={`h-2 w-8 rounded-full ${n <= stepNo ? 'bg-sky-500/20 border border-sky-400/30' : 'bg-surf2'}`} />
            ))}
          </div>
        </div>

        {step === 'welcome' && (
          <div className="px-5 pb-5 space-y-4 overflow-y-auto">
            <HeartHandshake className="w-10 h-10 text-acc" />
            <h2 id="onb-title" className="text-xl font-bold">Witaj w grupie</h2>
            <p className="text-base text-fg2 leading-relaxed">
              To bezpieczne miejsce na spotkania, materiały i rozmowę z grupą. Zanim wejdziesz, przedstaw się
              i przeczytaj kilka zasad, dzięki którym wszyscy czujemy się tu dobrze.
            </p>
            <div className="flex justify-end pt-2">
              <button type="button" className={btnPrimary} onClick={() => setStep('name')}>
                Zaczynamy<ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'name' && (
          <form className="px-5 pb-5 space-y-4 overflow-y-auto"
            onSubmit={e => { e.preventDefault(); setTouched(true); if (!nameErr) setStep('rules'); }}>
            <h2 id="onb-title" className="text-xl font-bold flex items-center gap-2"><User className="w-5 h-5 text-acc" />Jak masz na imię?</h2>
            <div>
              <label htmlFor="onb-name" className="block text-base font-semibold text-fg2 mb-1">
                Imię <span className="text-bad">(wymagane)</span>
              </label>
              <input id="onb-name" type="text" autoFocus autoComplete="given-name" maxLength={40}
                value={name} onChange={e => setName(e.target.value)} onBlur={() => setTouched(true)}
                aria-invalid={touched && !!nameErr} aria-describedby="onb-name-hint"
                className="tap w-full rounded-xl border border-line bg-surf px-4 py-3 text-lg text-fg outline-none focus:border-sky-400/30 focus:bg-surf2" />
              <p id="onb-name-hint" className="mt-1 text-sm text-mut">Tak zobaczy Cię grupa; może być zdrobnienie.</p>
              {touched && nameErr && <p className="mt-1 text-sm text-bad" role="alert">{nameErr}</p>}
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setStep('welcome')}><ArrowLeft className="w-4 h-4" />Wstecz</button>
              <button type="submit" className={btnPrimary} disabled={!!nameErr}>Dalej<ArrowRight className="w-4 h-4" /></button>
            </div>
          </form>
        )}

        {step === 'rules' && (
          <div className="flex flex-col min-h-0">
            <div className="px-5 pb-3 space-y-4 overflow-y-auto min-h-0">
              <h2 id="onb-title" className="text-xl font-bold">Cześć, {name.trim()}! Kilka zasad</h2>
              <ol className="space-y-2">
                {GROUP_RULES.slice(0, 4).map((r, i) => (
                  <li key={r.title} className="flex gap-3 rounded-2xl border border-line bg-surf p-3">
                    <span className="shrink-0 w-8 h-8 rounded-full bg-sky-500/20 border border-sky-400/30 text-acc font-bold flex items-center justify-center" aria-hidden="true">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-base">{r.title}</p>
                      <p className="text-base text-fg2 leading-relaxed">{r.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-sm text-mut">Pełne zasady znajdziesz później w panelu „Zasady”.</p>

              <CrisisBox compact />

              <div>
                <p className="font-semibold text-base mb-2">Regulamin korzystania</p>
                <div className="max-h-56 overflow-y-auto rounded-2xl border border-line bg-surf p-4 space-y-3" tabIndex={0} aria-label="Regulamin korzystania">
                  {APP_TERMS.map(t => (
                    <div key={t.title}>
                      <p className="font-semibold text-base">{t.title}</p>
                      <p className="text-base text-fg2 leading-relaxed">{t.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-line px-5 py-4 space-y-3 bg-head rounded-b-3xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
                  className="mt-1 w-6 h-6 shrink-0 accent-sky-500 cursor-pointer" />
                <span className="text-base text-fg2 leading-snug">
                  Przeczytałem(-am) i akceptuję zasady grupy i regulamin; rozumiem, że za przesłane treści i pliki odpowiadam ja.
                </span>
              </label>
              <div className="flex justify-between gap-2">
                <button type="button" className={btnGhost} onClick={() => setStep('name')}><ArrowLeft className="w-4 h-4" />Wstecz</button>
                <button type="button" className={btnPrimary} disabled={!agree || !!nameErr}
                  onClick={() => { if (agree && !nameErr) onDone(name.trim()); }}>
                  <Check className="w-4 h-4" />Wchodzę
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
