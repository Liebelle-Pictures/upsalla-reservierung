// Schritt 4: Kontaktdaten und AGB (kein Newsletter-Haken, nur Hinweis auf das jährliche Angebot). Datenschutz ist keine Einwilligung
// (Art. 6 Abs. 1 lit. b DSGVO), der Hinweis steht über dem Zahlungsknopf. Das Feld "website"
// ist ein Honeypot (für Menschen unsichtbar). Turnstile sitzt in der Übersicht.
import type { InputHTMLAttributes, ReactNode } from 'react'
import { GRENZEN } from '@/lib/online-buchung/validierung'
import { TEXT_ANGEBOT_HINWEIS, type Kontakt, type KontaktFehler } from './wizardLogik'
import { Karte, SchrittTitel } from './ui'

function Feld({ id, label, fehler, hilfe, ...rest }: InputHTMLAttributes<HTMLInputElement> & { id: keyof Kontakt; label: string; fehler?: string; hilfe?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[15px] font-bold text-ups-navy">{label}</label>
      <input
        id={id}
        name={id}
        aria-invalid={!!fehler}
        aria-describedby={fehler ? `${id}-fehler` : hilfe ? `${id}-hilfe` : undefined}
        className={`block min-h-12 w-full rounded-xl bg-white px-4 py-3 text-[17px] text-ups-navy outline-none ring-2 placeholder:text-gray-400 focus:ring-ups-blau ${fehler ? 'ring-red-400' : 'ring-ups-hell'}`}
        {...rest}
      />
      {fehler ? <p id={`${id}-fehler`} className="mt-1 text-sm font-semibold text-red-700">{fehler}</p>
        : hilfe ? <p id={`${id}-hilfe`} className="mt-1 text-sm text-gray-500">{hilfe}</p> : null}
    </div>
  )
}

function Haken({ id, checked, onChange, fehler, children }: { id: keyof Kontakt; checked: boolean; onChange: (v: boolean) => void; fehler?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl py-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          aria-invalid={!!fehler}
          aria-describedby={fehler ? `${id}-fehler` : undefined}
          className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded-md accent-ups-blau"
        />
        <span className="text-[15px] leading-snug text-gray-700">{children}</span>
      </label>
      {fehler && <p id={`${id}-fehler`} className="-mt-1 ml-9 text-sm font-semibold text-red-700">{fehler}</p>}
    </div>
  )
}

export function SchrittKontakt({ kontakt, fehler, onChange }: {
  kontakt: Kontakt
  fehler: KontaktFehler
  onChange: (k: Partial<Kontakt>) => void
}) {
  return (
    <>
      <SchrittTitel titel="Eure Kontaktdaten" untertitel="Damit wir euch die Bestätigung per SMS und E-Mail schicken können." />
      <Karte>
        <div className="grid gap-4 sm:grid-cols-2">
          <Feld id="vorname" label="Vorname" autoComplete="given-name" value={kontakt.vorname} maxLength={GRENZEN.nameMax}
            onChange={e => onChange({ vorname: e.target.value })} fehler={fehler.vorname} />
          <Feld id="nachname" label="Nachname" autoComplete="family-name" value={kontakt.nachname} maxLength={GRENZEN.nameMax}
            onChange={e => onChange({ nachname: e.target.value })} fehler={fehler.nachname} />
          <Feld id="telefon" label="Handynummer" type="tel" inputMode="tel" autoComplete="tel" placeholder="0151 23456789" value={kontakt.telefon}
            onChange={e => onChange({ telefon: e.target.value })} fehler={fehler.telefon} hilfe="Hierhin schicken wir die SMS-Bestätigung." />
          <Feld id="email" label="E-Mail" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={kontakt.email}
            maxLength={GRENZEN.emailMax} onChange={e => onChange({ email: e.target.value })} fehler={fehler.email} />
        </div>

        <div className="mt-4">
          <label htmlFor="notizen" className="mb-1 block text-[15px] font-bold text-ups-navy">
            Nachricht an uns <span className="font-medium text-gray-500">(optional)</span>
          </label>
          <textarea
            id="notizen"
            name="notizen"
            rows={3}
            maxLength={GRENZEN.notizenMax}
            value={kontakt.notizen}
            onChange={e => onChange({ notizen: e.target.value })}
            placeholder="z. B. Name und Alter des Geburtstagskindes, Allergien …"
            className={`block w-full rounded-xl bg-white px-4 py-3 text-[17px] text-ups-navy outline-none ring-2 placeholder:text-gray-400 focus:ring-ups-blau ${fehler.notizen ? 'ring-red-400' : 'ring-ups-hell'}`}
          />
          {fehler.notizen && <p className="mt-1 text-sm font-semibold text-red-700">{fehler.notizen}</p>}
        </div>

        {/* Honeypot: für Menschen unsichtbar, Bots füllen es aus */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={kontakt.website} onChange={e => onChange({ website: e.target.value })} />
        </div>

        <div className="mt-5 space-y-1 border-t border-ups-hell pt-4">
          <Haken id="agb_akzeptiert" checked={kontakt.agb_akzeptiert} onChange={v => onChange({ agb_akzeptiert: v })} fehler={fehler.agb_akzeptiert}>
            Ich akzeptiere die <a href="/agb" target="_blank" rel="noopener" className="font-bold text-ups-blau underline">AGB und Stornierungsbedingungen</a>.
          </Haken>
          {/* Hinweis statt Newsletter-Haken (Bestandskunden-Angebot, Widerspruch jederzeit möglich) */}
          <p className="pt-2 text-[14px] leading-snug text-gray-600">{TEXT_ANGEBOT_HINWEIS}</p>
        </div>
      </Karte>
    </>
  )
}
