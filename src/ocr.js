// Texterkennung im Browser mit Tesseract.js (kostenlos). Beim ersten Mal werden rund 10 MB geladen.
let laden = null

function tesseractLaden() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract)
  if (!laden)
    laden = new Promise((ok, fail) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'
      s.onload = () => ok(window.Tesseract)
      s.onerror = () => {
        laden = null
        fail(new Error('Die Texterkennung konnte nicht geladen werden. Dafür ist Internet nötig.'))
      }
      document.head.appendChild(s)
    })
  return laden
}

export async function lieferscheinLesen(bild, fortschritt) {
  const T = await tesseractLaden()
  const { data } = await T.recognize(bild, 'deu', {
    logger: m => m.status === 'recognizing text' && fortschritt?.(Math.round(m.progress * 100)),
  })
  const text = (data?.text || '').trim()
  const d = text.match(/\b(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})\b/)
  let datum = ''
  if (d) {
    const jahr = d[3].length === 2 ? '20' + d[3] : d[3]
    datum = `${jahr}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`
  }
  const nr = text.match(/(?:Lieferschein|Liefersch\.|LS)[\s-]*(?:Nr\.?|Nummer|No\.?)?[\s:.#]*([A-Z0-9][A-Z0-9\-/]{2,})/i)
  return { text, datum, nummer: nr?.[1] ?? '' }
}
