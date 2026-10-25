// Monochrome tactical map: Leaflet + CartoDB Dark Matter tiles (OpenStreetMap data, no API key).
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const ZAP = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function icon(kind, label, extra = '') {
  const html = {
    me: `<div class="tm-me"${extra}><div class="tm-me-cone"></div><div class="tm-me-dot"></div></div>`,
    blip: `<div class="tm-blip"><span class="tm-ring"></span><b>${esc(label)}</b></div>`,
    reveal: `<div class="tm-reveal"><b>${esc(label)}</b></div>`,
    drop: `<div class="tm-drop">${ZAP}</div>`,
    radar: `<div class="tm-radar"><span></span></div>`,
    out: `<div class="tm-out">×</div>`,
    tag: `<div class="tm-tag">${esc(label)}</div>`,
  }[kind];
  const size = { me: 44, blip: 34, reveal: 30, drop: 30, radar: 26, out: 22, tag: 22 }[kind];
  return L.divIcon({ className: 'tm-icon', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

// center/radius: the live zone · rings: [{ r, dashed, faint }] · me: { lat, lng, heading }
// pins: [{ key, kind: blip|reveal|drop|radar|out, lat, lng, label }] · trails: [{ key, pts, hunter, label }]
export default function TacticalMap({ center, radius, fitRadius, rings = [], me, pins = [], trails = [], interactive = true, className = '' }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef('');

  useEffect(() => {
    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: false,
      keyboard: false,
      zoomSnap: 0.25,
    });
    L.control.attribution({ prefix: false, position: 'bottomright' }).addAttribution(ATTRIBUTION).addTo(m);
    L.tileLayer(TILES, { subdomains: 'abcd', maxZoom: 20, detectRetina: false, crossOrigin: true }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      fitted.current = '';
    };
  }, [interactive]);

  // Frame the whole zone once (and again only if the zone itself moves).
  const fr = fitRadius || radius;
  useEffect(() => {
    const m = map.current;
    const key = `${center.lat},${center.lng},${fr}`;
    if (!m || fitted.current === key) return;
    fitted.current = key;
    m.fitBounds(L.latLng(center.lat, center.lng).toBounds(fr * 2.25), { animate: false });
  }, [center.lat, center.lng, fr, interactive]);

  // Redraw overlays only when what they show changes (the HUD re-renders 4×/s, and rebuilding
  // markers would restart their animations).
  const sig = JSON.stringify([center, Math.round(radius * 10), rings, me && [me.lat, me.lng, me.heading == null ? null : Math.round(me.heading / 4)], pins, trails]);
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const c = [center.lat, center.lng];
    rings.forEach((ring) =>
      L.circle(c, { radius: ring.r, color: '#fff', weight: 1.5, opacity: ring.faint ? 0.35 : 0.9, dashArray: ring.dashed ? '6 8' : null, fill: false, interactive: false }).addTo(g)
    );
    L.circle(c, { radius, color: '#fff', weight: 2.5, opacity: 1, fillColor: '#fff', fillOpacity: 0.05, interactive: false }).addTo(g);
    L.circleMarker(c, { radius: 3, color: '#fff', weight: 1, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(g);
    trails.forEach((t) => {
      if (!t.pts?.length) return;
      L.polyline(t.pts, { color: '#fff', weight: t.hunter ? 3 : 2, opacity: t.hunter ? 1 : 0.7, dashArray: t.hunter ? null : '2 7', lineCap: 'round', interactive: false }).addTo(
        g
      );
      L.marker(t.pts[t.pts.length - 1], { icon: icon('tag', t.label), interactive: false, keyboard: false }).addTo(g);
    });
    pins.forEach((p) => L.marker([p.lat, p.lng], { icon: icon(p.kind, p.label), interactive: false, keyboard: false, zIndexOffset: p.kind === 'blip' ? 500 : 0 }).addTo(g));
    if (me) {
      const rot = me.heading == null ? '' : ` style="--hd:${Math.round(me.heading)}deg" data-heading="1"`;
      L.marker([me.lat, me.lng], { icon: icon('me', '', rot), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(g);
    }
  }, [sig, interactive]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={`tmap h-full w-full ${className}`} data-pins={pins.length} />;
}
