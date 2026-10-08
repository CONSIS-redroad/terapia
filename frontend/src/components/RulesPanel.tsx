// PATH: src/components/RulesPanel.tsx | REQ-ID: TERAPIA-RULES-02
// Panel „Zasady”: zasady grupy (karty), regulamin (rozwijany), numery kryzysowe, status akceptacji.
import React from 'react';
import { CheckCircle2, ChevronDown, FileText, Phone, RotateCcw, ShieldCheck } from 'lucide-react';
import { APP_TERMS, CRISIS_LINES, GROUP_RULES, RULES_VERSION } from '../demo/rules';

export const CrisisBox: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4" role="note" aria-label="Pomoc w kryzysie">
    <p className="flex items-center gap-2 font-bold text-base text-fg">
      <Phone className="w-4 h-4 text-warn" />W kryzysie nie czekaj na odpowiedź na czacie
    </p>
    {!compact && <p className="mt-1 text-sm text-fg2">Zadzwoń — te numery działają zawsze:</p>}
    <ul className="mt-3 grid gap-2 sm:grid-cols-3">
      {CRISIS_LINES.map(c => (
        <li key={c.tel}>
          <a href={`tel:${c.tel}`}
            className="tap flex flex-col justify-center rounded-xl border border-line bg-surf px-3 py-2 hover:bg-surf2">
            <span className="text-lg font-bold text-fg">{c.number}</span>
            <span className="text-xs text-mut">{c.label}{c.note ? ` — ${c.note}` : ''}</span>
          </a>
        </li>
      ))}
    </ul>
  </div>
);

function fmtAccepted(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const RulesPanel: React.FC<{ acceptedAt?: string; onShowConsent?: () => void }> = ({ acceptedAt, onShowConsent }) => (
  <div className="space-y-6 text-fg">
    <CrisisBox />

    <section aria-labelledby="rules-group">
      <h3 id="rules-group" className="flex items-center gap-2 text-lg font-bold mb-3">
        <ShieldCheck className="w-5 h-5 text-acc" />Zasady grupy
      </h3>
      <ol className="space-y-3">
        {GROUP_RULES.map((r, i) => (
          <li key={r.title} className="flex gap-3 rounded-2xl border border-line bg-surf p-4">
            <span className="shrink-0 w-9 h-9 rounded-full bg-sky-500/20 border border-sky-400/30 text-acc font-bold flex items-center justify-center" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-base text-fg">{r.title}</p>
              <p className="mt-1 text-base text-fg2 leading-relaxed">{r.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>

    <section aria-labelledby="rules-terms">
      <h3 id="rules-terms" className="flex items-center gap-2 text-lg font-bold mb-1">
        <FileText className="w-5 h-5 text-acc" />Regulamin korzystania
      </h3>
      <p className="mb-3 text-sm text-mut">Wersja robocza z {RULES_VERSION} — do weryfikacji prawnej przed startem.</p>
      <div className="space-y-2">
        {APP_TERMS.map(t => (
          <details key={t.title} className="group rounded-xl border border-line bg-surf">
            <summary className="tap flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-base text-fg">
              <span>{t.title}</span>
              <ChevronDown className="w-4 h-4 shrink-0 text-mut transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-4 pb-4 text-base text-fg2 leading-relaxed">{t.body}</p>
          </details>
        ))}
      </div>
    </section>

    <div className="rounded-2xl border border-line bg-surf2 p-4 space-y-3">
      {acceptedAt ? (
        <p className="flex items-center gap-2 text-base text-fg2">
          <CheckCircle2 className="w-5 h-5 text-ok shrink-0" />Zaakceptowano: <strong className="text-fg">{fmtAccepted(acceptedAt)}</strong>
        </p>
      ) : (
        <p className="text-base text-mut">Zasady nie zostały jeszcze potwierdzone.</p>
      )}
      {onShowConsent && (
        <button type="button" onClick={onShowConsent}
          className="tap inline-flex items-center gap-2 rounded-xl px-3 text-base font-semibold text-acc hover:bg-surf cursor-pointer">
          <RotateCcw className="w-4 h-4" />Przeczytaj i potwierdź ponownie
        </button>
      )}
    </div>
  </div>
);
