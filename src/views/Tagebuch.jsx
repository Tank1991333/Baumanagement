import { useState } from 'react'
import { add, upd, del, heute, fmtDatum, esc, absatz, drucken } from '../store'
import { Feld, Kopf, Leer, Formular } from '../ui.jsx'

const WETTER = ['Sonnig', 'Bewölkt', 'Regen', 'Starkregen', 'Schnee', 'Frost', 'Wind / Sturm', 'Nebel']

export default function Tagebuch({ daten, setDaten }) {
  const [form, setForm] = useState(null)
  const [filterBs, setFilterBs] = useState('alle')
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const name = id => daten.mitarbeiter.find(m => m.id === id)?.name ?? 'Unbekannt'
  const bs = id => daten.baustellen.find(b => b.id === id)

  const neu = () =>
    setForm({
      baustelleId: daten.baustellen.find(b => b.status === 'laufend')?.id ?? daten.baustellen[0]?.id ?? '',
      datum: heute(), wetter: 'Sonnig', temperatur: '', anwesend: [],
      leistungen: '', lieferungen: '', behinderungen: '', besucher: '',
    })

  const ausZeiten = () => {
    const ids = [...new Set(daten.zeiten.filter(z => z.datum === form.datum && z.baustelleId === form.baustelleId).map(z => z.mitarbeiterId))]
    const gestempelt = daten.stempel.filter(s => s.baustelleId === form.baustelleId).map(s => s.mitarbeiterId)
    setForm({ ...form, anwesend: [...new Set([...form.anwesend, ...ids, ...(form.datum === heute() ? gestempelt : [])])] })
  }

  const umschalten = id =>
    setForm({ ...form, anwesend: form.anwesend.includes(id) ? form.anwesend.filter(x => x !== id) : [...form.anwesend, id] })

  const speichern = e => {
    e.preventDefault()
    if (!form.baustelleId) return alert('Bitte eine Baustelle wählen.')
    form.id ? upd(setDaten, 'tagebuch', form.id, form) : add(setDaten, 'tagebuch', form)
    setForm(null)
  }

  const druck = t => {
    const b = bs(t.baustelleId)
    const teil = (titel, text) => (text ? `<h2>${titel}</h2><p>${absatz(text)}</p>` : '')
    drucken(`Bautagebuch ${fmtDatum(t.datum)}`, `
      <table class="k">
        <tr><td>Baustelle</td><td>${esc(b?.name ?? '–')}<br>${esc(b?.adresse ?? '')}</td></tr>
        <tr><td>Datum</td><td>${esc(fmtDatum(t.datum))}</td></tr>
        <tr><td>Wetter</td><td>${esc(t.wetter)}${t.temperatur ? `, ${esc(t.temperatur)} °C` : ''}</td></tr>
        <tr><td>Anwesend</td><td>${t.anwesend.map(id => esc(name(id))).join(', ') || '–'}</td></tr>
      </table>
      ${teil('Ausgeführte Leistungen', t.leistungen)}
      ${teil('Lieferungen und Material', t.lieferungen)}
      ${teil('Behinderungen, Störungen, Anordnungen', t.behinderungen)}
      ${teil('Besucher und Abnahmen', t.besucher)}
      <div class="sig"><div>Datum, Unterschrift Bauleitung</div><div>Datum, Unterschrift Auftraggeber</div></div>`, daten.firma)
  }

  const liste = daten.tagebuch
    .filter(t => filterBs === 'alle' || t.baustelleId === filterBs)
    .sort((a, b) => b.datum.localeCompare(a.datum))

  return (
    <>
      <Kopf titel="Bautagebuch">
        <select value={filterBs} onChange={e => setFilterBs(e.target.value)} aria-label="Baustelle filtern">
          <option value="alle">Alle Baustellen</option>
          {daten.baustellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {!form && <button className="primaer" onClick={neu}>Neuer Tagesbericht</button>}
      </Kopf>

      {form && (
        <Formular
          titel={form.id ? 'Tagesbericht bearbeiten' : 'Neuer Tagesbericht'}
          onSubmit={speichern}
          onAbbrechen={() => setForm(null)}
          kannLoeschen={!!form.id}
          onLoeschen={() => { if (confirm('Tagesbericht löschen?')) { del(setDaten, 'tagebuch', form.id); setForm(null) } }}
        >
          <Feld label="Baustelle" breit>
            <select value={form.baustelleId} onChange={f('baustelleId')}>
              {daten.baustellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Feld>
          <Feld label="Datum"><input type="date" required value={form.datum} onChange={f('datum')} /></Feld>
          <Feld label="Wetter">
            <select value={form.wetter} onChange={f('wetter')}>{WETTER.map(w => <option key={w}>{w}</option>)}</select>
          </Feld>
          <Feld label="Temperatur (°C)"><input inputMode="numeric" value={form.temperatur} onChange={f('temperatur')} /></Feld>
          <fieldset className="feld breit anwesend">
            <legend>Anwesend</legend>
            <div className="chips">
              {daten.mitarbeiter.map(m => (
                <label key={m.id} className={'chip' + (form.anwesend.includes(m.id) ? ' an' : '')}>
                  <input type="checkbox" checked={form.anwesend.includes(m.id)} onChange={() => umschalten(m.id)} />
                  {m.name}
                </label>
              ))}
            </div>
            <button type="button" className="klein" onClick={ausZeiten}>Aus Zeiterfassung übernehmen</button>
          </fieldset>
          <Feld label="Ausgeführte Leistungen" breit><textarea rows="4" value={form.leistungen} onChange={f('leistungen')} /></Feld>
          <Feld label="Lieferungen und Material" breit><textarea rows="2" value={form.lieferungen} onChange={f('lieferungen')} /></Feld>
          <Feld label="Behinderungen, Störungen, Anordnungen" breit><textarea rows="2" value={form.behinderungen} onChange={f('behinderungen')} /></Feld>
          <Feld label="Besucher und Abnahmen" breit><textarea rows="2" value={form.besucher} onChange={f('besucher')} /></Feld>
        </Formular>
      )}

      {liste.length === 0 ? (
        <Leer titel="Noch keine Tagesberichte" text="Ein Bericht pro Tag und Baustelle hilft bei Nachträgen, Behinderungsanzeigen und Streitfällen." />
      ) : (
        <div className="karten">
          {liste.map(t => (
            <article key={t.id} className="bericht">
              <div className="baustelle-kopf">
                <h3>{bs(t.baustelleId)?.name ?? '–'}</h3>
                <span className="leise">{fmtDatum(t.datum)}</span>
              </div>
              <p className="leise">
                {t.wetter}{t.temperatur ? `, ${t.temperatur} °C` : ''}, {t.anwesend.length} anwesend
              </p>
              {t.leistungen && <p className="vorschau">{t.leistungen}</p>}
              {t.behinderungen && <p className="vorschau warnung">Behinderung: {t.behinderungen}</p>}
              <div className="knopfreihe">
                <button className="klein" onClick={() => setForm({ ...t })}>Bearbeiten</button>
                <button className="klein" onClick={() => druck(t)}>Drucken / PDF</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
