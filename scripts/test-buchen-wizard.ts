// Test für die reine Logik des Buchungs-Widgets (src/components/buchen/wizardLogik.ts).
// Ohne DB, ohne Server.
//
// Aufruf: npx tsx scripts/test-buchen-wizard.ts

import {
  preisVorschau, maxKinderFuerLoge, pruefeKontakt, reaktionAufAntwort, monatPlus, kalenderWochen,
  istWaehlbar, euro, datumLang, schrittFuerFeld, LEERER_KONTAKT, HINWEIS_NEUER_SCHLUESSEL,
} from '../src/components/buchen/wizardLogik'
import { symbolFuerLoge } from '../src/components/buchen/LogenSymbol'
import { dsgvoAnzeige } from '../src/lib/utils/kundeAnzeige'
import { sichereBildUrl } from '../src/lib/online-buchung/validierung'

let fehlgeschlagen = 0
function pruefe(name: string, ist: unknown, soll: unknown) {
  const ok = JSON.stringify(ist) === JSON.stringify(soll)
  if (!ok) fehlgeschlagen++
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n   ist:  ${JSON.stringify(ist)}\n   soll: ${JSON.stringify(soll)}`}`)
}

// Preise: Mindestens 6 Kinder, 3 Begleitpersonen frei (Werte aus preise.ts)
pruefe('4 Kinder Wochentag → wie 6 Kinder', preisVorschau(4, 2, false), { gesamt: 138, anzahlung: 27.6, rest: 110.4, abrechenbareKinder: 6, zahlendeErwachsene: 0 })
pruefe('10 Kinder + 5 Erw. Wochenende', preisVorschau(10, 5, true), { gesamt: 285, anzahlung: 57, rest: 228, abrechenbareKinder: 10, zahlendeErwachsene: 2 })

pruefe('max Kinder = Restkapazität', maxKinderFuerLoge({ max_kinder: 9 }), 9)
pruefe('max Kinder nie über 20', maxKinderFuerLoge({ max_kinder: 150 }), 20)

// Kontakt
const leer = pruefeKontakt(LEERER_KONTAKT)
pruefe('leeres Formular → alle Pflichtfelder (ohne Datenschutz-Haken)', Object.keys(leer).sort(), ['agb_akzeptiert', 'email', 'nachname', 'telefon', 'vorname'])
pruefe('gültiges Formular → keine Fehler', pruefeKontakt({
  ...LEERER_KONTAKT, vorname: 'Anna', nachname: 'Muster', telefon: '0151 2345 6789', email: 'anna@example.de',
  agb_akzeptiert: true,
}), {})
pruefe('ungültige E-Mail', Object.keys(pruefeKontakt({ ...LEERER_KONTAKT, email: 'anna@' })).includes('email'), true)

// 409-Reaktionen
pruefe('ABGELAUFEN → neuer Schlüssel', reaktionAufAntwort(409, { grund: 'ABGELAUFEN', hinweis: 'x' }), { art: 'neuer_schluessel', hinweis: HINWEIS_NEUER_SCHLUESSEL })
pruefe('SCHLUESSEL_VERWENDET → neuer Schlüssel', reaktionAufAntwort(409, { grund: 'SCHLUESSEL_VERWENDET' }).art, 'neuer_schluessel')
pruefe('SLOT_BELEGT → zurück zur Auswahl', reaktionAufAntwort(409, { grund: 'SLOT_BELEGT', hinweis: 'Vergeben.' }).art, 'zurueck_zur_auswahl')
pruefe('KAPAZITAET → zurück zur Auswahl', reaktionAufAntwort(409, { grund: 'KAPAZITAET' }).art, 'zurueck_zur_auswahl')
pruefe('LOGE_UNGUELTIG → zurück zur Auswahl', reaktionAufAntwort(409, { grund: 'LOGE_UNGUELTIG' }).art, 'zurueck_zur_auswahl')
pruefe('IN_BEARBEITUNG → wiederholen', reaktionAufAntwort(409, { grund: 'IN_BEARBEITUNG' }).art, 'wiederholen')
pruefe('BEREITS_BEZAHLT', reaktionAufAntwort(409, { grund: 'BEREITS_BEZAHLT' }).art, 'bereits_bezahlt')
pruefe('200 → weiterleiten', reaktionAufAntwort(200, { checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { art: 'weiterleiten', url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
pruefe('200 ohne https-Link → Fehler', reaktionAufAntwort(200, { checkout_url: 'javascript:alert(1)' }).art, 'fehler')
pruefe('400 telefon → Schritt 4', reaktionAufAntwort(400, { fehler: true, feld: 'telefon', hinweis: 'h' }), { art: 'feld', schritt: 4, feld: 'telefon', hinweis: 'h' })
pruefe('400 datum → Schritt 1', schrittFuerFeld('datum'), 1)
pruefe('400 turnstile → neue Sicherheitsprüfung', reaktionAufAntwort(400, { fehler: true, feld: 'turnstile_token', hinweis: 't' }), { art: 'sicherheitspruefung', hinweis: 't' })
pruefe('429 → Fehler mit Server-Hinweis', reaktionAufAntwort(429, { hinweis: 'Zu viele.' }), { art: 'fehler', hinweis: 'Zu viele.' })
pruefe('502 → Fehler mit Server-Hinweis', reaktionAufAntwort(502, { hinweis: 'Später.' }), { art: 'fehler', hinweis: 'Später.' })

// Kalender
pruefe('Monat +1 über Jahresende', monatPlus('2026-12', 1), '2027-01')
pruefe('Monat -1 über Jahresanfang', monatPlus('2027-01', -1), '2026-12')
const nov = kalenderWochen('2026-11') // 1.11.2026 ist ein Sonntag
pruefe('November 2026: 1. steht am Sonntag', nov[0], [null, null, null, null, null, null, '2026-11-01'])
pruefe('November 2026: 6 Wochen à 7', nov.map(w => w.length), [7, 7, 7, 7, 7, 7])
pruefe('wählbar nur frei/wenige', (['frei', 'wenige', 'ausgebucht', 'geschlossen', 'nicht_buchbar'] as const).map(istWaehlbar), [true, true, false, false, false])

// Formatierung
pruefe('euro ganz', euro(27), '27\u00a0€')
pruefe('euro Cent', euro(27.6), '27,60\u00a0€')
pruefe('datumLang', datumLang('2026-11-14'), 'Samstag, 14. November 2026')

// Logen-Symbole (alle 11 Logen aus der DB, Stand 31.10.2026)
pruefe('Symbole pro Loge', [
  'Anna & Elsa', 'Paw Patrol Jungs', 'Paw Patrol Mädchen', 'Marvel Spiderman', 'Safari', 'Einhorn Schloss',
  'Einhorn Regenbogen', 'Babywelt Junge', 'Babywelt Märchen', 'BBQ Zelt', 'Runde Tische unten', 'Neue Loge',
].map(symbolFuerLoge), ['schneeflocke', 'pfote_blau', 'pfote_rosa', 'netz', 'loewe', 'schloss', 'regenbogen', 'rassel', 'mond', 'zelt', 'tisch', 'ballon'])

// Kundenakte: DSGVO-Anzeige
pruefe('DSGVO Einwilligung', dsgvoAnzeige(true, 'KI LENA'), '✓ Einwilligung erteilt')
pruefe('DSGVO online angelegt', dsgvoAnzeige(false, 'ONLINE'), 'Online-Buchung (Vertrag)')
pruefe('DSGVO sonst nicht erteilt', dsgvoAnzeige(false, 'KI LENA'), '✗ Nicht erteilt')
pruefe('DSGVO ohne Reservierung', dsgvoAnzeige(false, null), '✗ Nicht erteilt')

// Logen-Fotos: nur https
pruefe('Foto https ok', sichereBildUrl('https://x.supabase.co/storage/v1/object/public/logen/safari.jpg'), 'https://x.supabase.co/storage/v1/object/public/logen/safari.jpg')
pruefe('Foto http abgelehnt', sichereBildUrl('http://example.de/a.jpg'), null)
pruefe('Foto javascript: abgelehnt', sichereBildUrl('javascript:alert(1)'), null)
pruefe('Foto leer abgelehnt', sichereBildUrl(''), null)

console.log(fehlgeschlagen ? `\n❌ ${fehlgeschlagen} Test(s) fehlgeschlagen` : '\n✅ Alle Tests grün')
process.exit(fehlgeschlagen ? 1 : 0)
