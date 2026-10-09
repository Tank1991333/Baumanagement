import { useState } from 'react'
import { add, upd, del, heute, fmtDatum, fmtEuro, zahl, bildKomprimieren } from '../store'
import { lieferscheinLesen } from '../ocr'
import { t } from '../i18n'
import { Feld, Kopf, Leer, Formular, BaustellenAuswahl } from '../ui.jsx'

const BSTATUS = { offen: 'Angefragt', bestellt: 'Bestellt', geliefert: 'Geliefert' }
const NAECHSTER = { offen: 'bestellt', bestellt: 'geliefert', geliefert: 'offen' }
const NEU_B = { artikel: '', menge: '', einheit: 'Stk.', lieferant: '', liefertermin: '', status: 'offen', preis: '', notiz: '', von: '', lieferscheinNr: '', lieferscheinFoto: '', lieferscheinText: '' }
const NEU_G = { name: '', inventarnr: '', standort: 'lager', naechstePruefung: '', notiz: '' }

export default function Material({ daten, setDaten, rechte, ich }) {
  const [bForm, setBForm] = useState(null)
  const [gForm, setGForm] = useState(null)
  const [nurOffen, setNurOffen] = useState(true)
  const [ocr, setOcr] = useState('')

  const lieferschein = async e => {
    const datei = e.target.files?.[0]
    e.target.value = ''
    if (!datei) return
    try {
      setOcr('Foto wird vorbereitet …')
      const fuerText = await bildKomprimieren(datei, 2000, 0.85)
      const klein = await bildKomprimieren(datei, 1200, 0.7)
      setBForm(x => ({ ...x, lieferscheinFoto: klein, status: 'geliefert' }))
      setOcr('Text wird erkannt … (beim ersten Mal etwas länger)')
      const erg = await lieferscheinLesen(fuerText, p => setOcr(`Text wird erkannt … ${p} %`))
      setBForm(x => ({
        ...x,
        lieferscheinText: erg.text,
        lieferscheinNr: x.lieferscheinNr || erg.nummer,
        liefertermin: erg.datum || x.liefertermin,
      }))
      setOcr(erg.nummer || erg.datum ? 'Erkannt. Bitte Nummer und Datum kurz prüfen.' : 'Text erkannt, aber keine Nummer gefunden. Bitte von Hand ergänzen.')
    } catch (err) {
      setOcr(err.message || 'Texterkennung fehlgeschlagen. Das Foto ist trotzdem gespeichert.')
    }
  }
  const bs = id => (id === 'lager' ? 'Lager / Bauhof' : daten.baustellen.find(b => b.id === id)?.name ?? '–')
  const fb = k => e => setBForm({ ...bForm, [k]: e.target.value })
  const fg = k => e => setGForm({ ...gForm, [k]: e.target.value })
  const h = heute()

  const neueBestellung = () => {
    setOcr('')
    setBForm({
      ...NEU_B,
      baustelleId: daten.baustellen.find(b => b.status === 'laufend')?.id ?? daten.baustellen[0]?.id ?? '',
      artikel: '', menge: '', einheit: 'Stk.', lieferant: '', liefertermin: '', status: 'offen', preis: '', notiz: '',
      von: ich?.name ?? '',
    })
  }

  const bSpeichern = e => {
    e.preventDefault()
    if (!bForm.artikel.trim()) return
    bForm.id ? upd(setDaten, 'bestellungen', bForm.id, bForm) : add(setDaten, 'bestellungen', bForm)
    setBForm(null)
  }
  const gSpeichern = e => {
    e.preventDefault()
    if (!gForm.name.trim()) return
    gForm.id ? upd(setDaten, 'geraete', gForm.id, gForm) : add(setDaten, 'geraete', gForm)
    setGForm(null)
  }

  const bestellungen = daten.bestellungen
    .filter(b => !nurOffen || b.status !== 'geliefert')
    .sort((a, b) => (a.liefertermin || '9999').localeCompare(b.liefertermin || '9999'))
  const offenSumme = daten.bestellungen.filter(b => b.status !== 'geliefert').reduce((s, b) => s + zahl(b.preis), 0)

  return (
    <>
      <Kopf titel="Bestellungen">
        <select value={nurOffen ? 'offen' : 'alle'} onChange={e => setNurOffen(e.target.value === 'offen')} aria-label="Filter">
          <option value="offen">Noch nicht geliefert</option>
          <option value="alle">Alle</option>
        </select>
        {!bForm && daten.baustellen.length > 0 && <button className="primaer" onClick={neueBestellung}>{t('Material anfragen')}</button>}
      </Kopf>

      {bForm && (
        <Formular
          titel={bForm.id ? 'Bestellung bearbeiten' : 'Material anfragen'}
          onSubmit={bSpeichern}
          onAbbrechen={() => setBForm(null)}
          kannLoeschen={!!bForm.id && rechte.stammdaten}
          onLoeschen={() => { del(setDaten, 'bestellungen', bForm.id); setBForm(null) }}
        >
          <Feld label="Baustelle" breit><BaustellenAuswahl daten={daten} value={bForm.baustelleId} onChange={v => setBForm({ ...bForm, baustelleId: v })} nurOffen /></Feld>
          <Feld label="Artikel *" breit><input required value={bForm.artikel} onChange={fb('artikel')} placeholder="z. B. KS-Steine 2DF, Baustahlmatten Q188" /></Feld>
          <Feld label="Menge"><input inputMode="decimal" value={bForm.menge} onChange={fb('menge')} /></Feld>
          <Feld label="Einheit">
            <select value={bForm.einheit} onChange={fb('einheit')}>
              {['Stk.', 'm', 'm²', 'm³', 't', 'kg', 'Sack', 'Palette', 'Pauschal'].map(x => <option key={x}>{x}</option>)}
            </select>
          </Feld>
          <Feld label="Gewünscht bis / Liefertermin"><input type="date" value={bForm.liefertermin} onChange={fb('liefertermin')} /></Feld>
          <Feld label="Status">
            <select value={bForm.status} onChange={fb('status')}>
              {Object.entries(BSTATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Feld>
          <Feld label="Lieferant"><input value={bForm.lieferant} onChange={fb('lieferant')} /></Feld>
          {rechte.kosten && <Feld label="Preis netto gesamt (€)"><input inputMode="decimal" value={bForm.preis} onChange={fb('preis')} /></Feld>}
          <Feld label="Angefragt von"><input value={bForm.von} onChange={fb('von')} /></Feld>
          <Feld label="Hinweis" breit><input value={bForm.notiz} onChange={fb('notiz')} placeholder="z. B. Abladen mit Kran, Zufahrt über Hof" /></Feld>
          <fieldset className="feld breit schlechtwetter">
            <legend>Lieferschein</legend>
            <div className="knopfreihe eng">
              <label className="knopf klein">
                Lieferschein fotografieren
                <input type="file" accept="image/*" capture="environment" hidden onChange={lieferschein} />
              </label>
              {ocr && <span className="leise">{ocr}</span>}
            </div>
            <div className="raster">
              <Feld label="Lieferschein-Nr."><input value={bForm.lieferscheinNr} onChange={fb('lieferscheinNr')} /></Feld>
            </div>
            {bForm.lieferscheinFoto && <img className="foto" src={bForm.lieferscheinFoto} alt="Lieferschein" />}
            {bForm.lieferscheinText && (
              <details>
                <summary className="leise">Erkannter Text</summary>
                <pre className="ocr-text">{bForm.lieferscheinText}</pre>
              </details>
            )}
          </fieldset>
        </Formular>
      )}

      {bestellungen.length === 0 ? (
        <Leer titel="Keine offenen Bestellungen" text="Der Polier fragt Material an, das Büro bestellt und hakt die Lieferung ab." />
      ) : (
        <>
          {rechte.kosten && offenSumme > 0 && <p className="fussnote">Offenes Bestellvolumen: {fmtEuro(offenSumme)}</p>}
          <ul className="liste">
            {bestellungen.map(b => (
              <li key={b.id} className="zeile">
                <button className={'marke knopfmarke status-' + b.status} onClick={() => upd(setDaten, 'bestellungen', b.id, { status: NAECHSTER[b.status] })} title="Status weiterschalten">
                  {BSTATUS[b.status]}
                </button>
                {b.status !== 'geliefert' && b.liefertermin && b.liefertermin < h && <span className="marke dringend">überfällig</span>}
                <strong>{b.menge} {b.einheit} {b.artikel}</strong>
                <span className="leise">
                  {bs(b.baustelleId)}
                  {b.liefertermin ? `, ${fmtDatum(b.liefertermin)}` : ''}
                  {b.lieferant ? `, ${b.lieferant}` : ''}
                  {b.von ? `, von ${b.von}` : ''}
                  {b.lieferscheinNr ? `, LS ${b.lieferscheinNr}` : b.lieferscheinFoto ? ', Lieferschein-Foto' : ''}
                </span>
                <button className="klein rechts" onClick={() => { setOcr(''); setBForm({ ...NEU_B, ...b }) }}>Bearbeiten</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <section className="block">
        <Kopf titel="Geräte und Maschinen">
          {!gForm && rechte.stammdaten && (
            <button onClick={() => setGForm({ name: '', inventarnr: '', standort: 'lager', naechstePruefung: '', notiz: '' })}>Gerät hinzufügen</button>
          )}
        </Kopf>

        {gForm && (
          <Formular
            titel={gForm.id ? 'Gerät bearbeiten' : 'Gerät hinzufügen'}
            onSubmit={gSpeichern}
            onAbbrechen={() => setGForm(null)}
            kannLoeschen={!!gForm.id && rechte.stammdaten}
            onLoeschen={() => { if (confirm('Gerät löschen?')) { del(setDaten, 'geraete', gForm.id); setGForm(null) } }}
          >
            <Feld label="Bezeichnung *" breit><input required value={gForm.name} onChange={fg('name')} placeholder="z. B. Minibagger 1,8 t" /></Feld>
            <Feld label="Inventarnummer"><input value={gForm.inventarnr} onChange={fg('inventarnr')} /></Feld>
            <Feld label="Nächste Prüfung (AM-VO, Elektro)"><input type="date" value={gForm.naechstePruefung} onChange={fg('naechstePruefung')} /></Feld>
            <Feld label="Notiz" breit><input value={gForm.notiz} onChange={fg('notiz')} /></Feld>
          </Formular>
        )}

        {daten.geraete.length === 0 ? (
          <Leer titel="Noch keine Geräte" text="Wer weiß, wo die Rüttelplatte steht, spart Suchfahrten. Prüftermine erscheinen 14 Tage vorher als Erinnerung." />
        ) : (
          <ul className="liste">
            {daten.geraete.map(g => (
              <li key={g.id} className="zeile geraet">
                <div className="stempel-name">
                  <strong>{g.name}{g.inventarnr ? ` (${g.inventarnr})` : ''}</strong>
                  <span className={'leise' + (g.naechstePruefung && g.naechstePruefung < h ? ' warnung' : '')}>
                    {g.naechstePruefung ? `Prüfung ${fmtDatum(g.naechstePruefung)}` : 'Kein Prüftermin'}
                    {g.notiz ? `, ${g.notiz}` : ''}
                  </span>
                </div>
                <select
                  className="standort"
                  value={g.standort}
                  onChange={e => upd(setDaten, 'geraete', g.id, { standort: e.target.value })}
                  aria-label={'Standort ' + g.name}
                >
                  <option value="lager">Lager / Bauhof</option>
                  {daten.baustellen.filter(b => b.status !== 'abgeschlossen' || b.id === g.standort).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {rechte.stammdaten && <button className="klein" onClick={() => setGForm({ ...NEU_G, ...g })}>Bearbeiten</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
