import { useEffect, useRef } from 'react'
import { Map as MapGL, Marker, NavigationControl, LngLatBounds, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(workerUrl)   // v6 ships its worker as a separate module; Vite bundles it and gives the address

// OpenFreeMap: OSM vector tiles in colour, free, no key.
const STYLE = 'https://tiles.openfreemap.org/styles/liberty'
// Family reads Latin script: English name where OSM has one, else the romanised name.
// No fallback to the local name: a street with only a Japanese name gets no label at all.
const LATIN = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], '']

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const xy = p => [p.lon, p.lat]
const line = coords => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } })

/** The first `t` (0..1) of a polyline, by length: what the drawing animation shows each frame. */
function partial(coords, t) {
  const seg = coords.slice(1).map((c, i) => Math.hypot(c[0] - coords[i][0], c[1] - coords[i][1]))
  let left = seg.reduce((a, b) => a + b, 0) * t
  const out = [coords[0]]
  for (let i = 0; i < seg.length; i++) {
    if (left >= seg[i]) { out.push(coords[i + 1]); left -= seg[i]; continue }
    const f = left / seg[i]
    out.push([coords[i][0] + (coords[i + 1][0] - coords[i][0]) * f, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * f])
    break
  }
  return out
}

/** Labels in Latin script, and no shop/restaurant icons competing with our own pins. */
function calm(map) {
  for (const l of map.getStyle().layers) {
    if (l.type !== 'symbol') continue
    if (l.id.startsWith('poi')) { map.setLayoutProperty(l.id, 'visibility', 'none'); continue }
    const field = map.getLayoutProperty(l.id, 'text-field')
    if (field && !JSON.stringify(field).includes('ref')) map.setLayoutProperty(l.id, 'text-field', LATIN)
  }
}

/**
 * The journal's one orchestrated moment: the travelled route draws itself, the road ahead
 * fades in dotted, then the map flies to the moments being shown and the newest one pulses.
 * Later `focus` changes (another day) only fly; the route is drawn once per visit.
 */
export default function RouteMap({ route, now, focus = [], newest, onPin, interactive = false, className = '' }) {
  const el = useRef(null)
  const map = useRef(null)
  const markers = useRef([])
  const drawn = useRef(null)

  useEffect(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    const done = route.filter(c => c.from <= now).map(xy)
    const ahead = [done.at(-1), ...route.filter(c => c.from > now).map(xy)].filter(Boolean)
    const bounds = route.reduce((b, c) => b.extend(xy(c)), new LngLatBounds(xy(route[0]), xy(route[0])))

    const m = new MapGL({
      container: el.current, style: STYLE, bounds, fitBoundsOptions: { padding: 28 },
      interactive, attributionControl: { compact: true }, cooperativeGestures: false,
    })
    map.current = m
    if (interactive) m.addControl(new NavigationControl({ showCompass: false }), 'top-left')
    // Start on style.load, not load: load waits for every tile, which can take seconds on a phone.
    drawn.current = new Promise(resolve => m.once('style.load', () => {
      calm(m)
      m.addSource('done', { type: 'geojson', data: line(done.slice(0, 1)) })
      m.addSource('ahead', { type: 'geojson', data: line(ahead) })
      m.addSource('cities', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: route.map(c => ({ type: 'Feature', properties: { done: c.from <= now }, geometry: { type: 'Point', coordinates: xy(c) } })) },
      })
      m.addLayer({ id: 'ahead', type: 'line', source: 'ahead', layout: { 'line-cap': 'round' },
        paint: { 'line-color': accent, 'line-width': 2.5, 'line-dasharray': [0.1, 2.4], 'line-opacity': 0, 'line-opacity-transition': { duration: 800 } } })
      m.addLayer({ id: 'done', type: 'line', source: 'done', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': accent, 'line-width': 3 } })
      m.addLayer({ id: 'cities', type: 'circle', source: 'cities',
        paint: { 'circle-radius': 4.5, 'circle-stroke-width': 2, 'circle-stroke-color': accent,
                 'circle-color': ['case', ['get', 'done'], accent, '#ffffff'] } })

      const finish = () => { m.getSource('done').setData(line(done)); m.setPaintProperty('ahead', 'line-opacity', 0.75); resolve() }
      if (still() || done.length < 2) return finish()
      // Draw over a map, not a blank: wait for the tiles, but never more than 2.5 s.
      let started = false
      const begin = () => { if (!started) { started = true; requestAnimationFrame(t0 => animate(t0)) } }
      m.once('idle', begin)
      setTimeout(begin, 2500)
      const ms = 1800
      let start
      const ease = t => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
      const frame = time => {
        if (!map.current) return
        const t = Math.min(1, (time - start) / ms)
        m.getSource('done').setData(line(partial(done, ease(t))))
        t < 1 ? requestAnimationFrame(frame) : finish()
      }
      const animate = t0 => { start = t0; frame(t0) }
    }))

    return () => { m.remove(); map.current = null }
  }, [route, now, interactive])

  const focusKey = focus.map(f => f.id).join()
  useEffect(() => {
    let cancelled = false
    drawn.current.then(() => {
      const m = map.current
      if (cancelled || !m) return
      markers.current.forEach(mk => mk.remove())
      markers.current = focus.map(f => {
        // MapLibre positions the outer element with transform; the drop/pulse animate the inner one.
        const holder = document.createElement(onPin ? 'button' : 'span')
        holder.className = 'pin-holder'
        holder.innerHTML = `<span class="pin${f.id === newest ? ' newest' : ''}"></span>`
        holder.setAttribute('aria-label', f.place.name)
        if (onPin) holder.addEventListener('click', () => onPin(f))
        return new Marker({ element: holder }).setLngLat(xy(f.place)).addTo(m)
      })
      if (!focus.length || interactive) return
      const b = focus.reduce((acc, f) => acc.extend(xy(f.place)), new LngLatBounds(xy(focus[0].place), xy(focus[0].place)))
      m.fitBounds(b, { padding: 56, maxZoom: 14, duration: still() ? 0 : 1800, essential: true })
    })
    return () => { cancelled = true }
  }, [focusKey, newest, interactive])   // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={className} aria-label="Kaart van onze route" role="img" />
}
