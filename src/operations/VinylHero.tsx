import React, { useEffect, useRef } from 'react';
import * as T from 'three';

// Home banner art: a vinyl record spinning on a platter (seen from above) and
// faint notes drifting out of it along a curved staff. Decorative only.

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const tex = (w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) => {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!, w, h);
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const startVinyl = (host: HTMLElement, dark: boolean) => {
  let r: T.WebGLRenderer;
  try { r = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch { return () => {}; } // no WebGL: banner reads fine without art
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.domElement.style.cssText = 'width:100%;height:100%;display:block';
  host.appendChild(r.domElement);

  const disposables: { dispose: () => void }[] = [];
  const keep = <D extends { dispose: () => void }>(d: D) => { disposables.push(d); return d; };
  const phys = (color: number, o: T.MeshPhysicalMaterialParameters = {}) =>
    keep(new T.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.18, ...o }));

  const sc = new T.Scene();
  const cam = new T.PerspectiveCamera(26, 2, 0.1, 60);
  cam.position.set(0, 11, 3.2);
  cam.lookAt(0, 0, 0.15);
  sc.add(new T.HemisphereLight(0xffffff, dark ? 0x1a2050 : 0xc9d2ff, dark ? 2.2 : 2.8));
  const key = new T.DirectionalLight(0xffffff, dark ? 2.2 : 2.6);
  key.position.set(-4, 8, 3);
  sc.add(key);
  const rim = new T.PointLight(0xff7a45, dark ? 30 : 18, 0, 2);
  rim.position.set(3, 2, -3);
  sc.add(rim);

  const g = new T.Group();
  g.position.x = 0.9;
  sc.add(g);

  // Platter with strobe dots on its rim.
  const platTop = keep(tex(1024, 1024, (c, w) => {
    const m = w / 2;
    c.fillStyle = dark ? '#2B3566' : '#D9DEEF'; c.fillRect(0, 0, w, w);
    c.fillStyle = dark ? '#8E9BD0' : '#7A84A8';
    for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; c.beginPath(); c.arc(m + Math.cos(a) * m * 0.955, m + Math.sin(a) * m * 0.955, 4, 0, 7); c.fill(); }
  }));
  const platSide = phys(dark ? 0x2b3566 : 0xc9d0ea, { metalness: 0.6, roughness: 0.3 });
  const platter = new T.Mesh(keep(new T.CylinderGeometry(2.2, 2.2, 0.14, 128)), [platSide, phys(0xffffff, { map: platTop, metalness: 0.4, roughness: 0.35 }), platSide]);
  platter.position.y = -0.07;
  g.add(platter);

  // Record: grooves, track gaps and the label drawn into one texture.
  let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const vinyl = keep(tex(1024, 1024, (c, w) => {
    const m = w / 2, rad = m * 0.999, label = rad * 0.34, gaps = [0.52, 0.66, 0.8];
    c.fillStyle = '#121216'; c.fillRect(0, 0, w, w);
    for (let rr = label + 6; rr < rad - 4; rr += 1.6) {
      const gap = gaps.some(q => Math.abs(rr / rad - q) < 0.008);
      const l = gap ? 10 : 16 + rnd() * 14;
      c.strokeStyle = `rgb(${l},${l},${l + 3})`; c.lineWidth = 1.2; c.beginPath(); c.arc(m, m, rr, 0, 7); c.stroke();
    }
    c.strokeStyle = '#2C2C33'; c.lineWidth = 6; c.beginPath(); c.arc(m, m, rad - 3, 0, 7); c.stroke();
    const lg = c.createRadialGradient(m - label * 0.3, m - label * 0.3, 0, m, m, label);
    lg.addColorStop(0, '#FF8A5C'); lg.addColorStop(1, '#E2492F');
    c.fillStyle = lg; c.beginPath(); c.arc(m, m, label, 0, 7); c.fill();
    c.fillStyle = '#FFF4EC'; c.textAlign = 'center';
    c.font = '700 46px "Plus Jakarta Sans", sans-serif'; c.fillText('StoryCo', m, m - 36);
    c.font = '600 22px "Plus Jakarta Sans", sans-serif'; c.fillText('AUDIO  ·  SIDE A', m, m + 58); c.fillText('33⅓ RPM', m, m + 90);
    c.fillStyle = '#1A1A1F'; c.beginPath(); c.arc(m, m, 10, 0, 7); c.fill();
  }));
  const vinylSide = phys(0x0d0d10, { roughness: 0.4 });
  const disc = new T.Mesh(keep(new T.CylinderGeometry(2, 2, 0.05, 128)), [vinylSide, phys(0xffffff, { map: vinyl, roughness: 0.22, clearcoatRoughness: 0.08 }), vinylSide]);
  disc.position.y = 0.025;
  g.add(disc);
  const spindle = new T.Mesh(keep(new T.CylinderGeometry(0.045, 0.045, 0.16, 24)), phys(0xdfe3f2, { metalness: 0.9, roughness: 0.2 }));
  spindle.position.y = 0.1;
  g.add(spindle);

  // Fixed light sheen across the grooves (does not turn with the record).
  const sheen = new T.Mesh(keep(new T.CircleGeometry(1.97, 96)), keep(new T.MeshBasicMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    map: keep(tex(512, 512, (c, w) => {
      const m = w / 2;
      c.save(); c.beginPath(); c.arc(m, m, m, 0, 7); c.clip();
      const cg = c.createConicGradient(-0.6, m, m);
      ([[0, 0], [0.06, 0.22], [0.12, 0], [0.5, 0], [0.56, 0.16], [0.62, 0], [1, 0]] as const).forEach(([o, a]) => cg.addColorStop(o, `rgba(255,255,255,${a})`));
      c.fillStyle = cg; c.fillRect(0, 0, w, w); c.restore();
      c.fillStyle = '#000'; c.beginPath(); c.arc(m, m, m * 0.36, 0, 7); c.fill();
    })),
  })));
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.y = 0.052;
  g.add(sheen);

  // Tonearm resting in the outer grooves.
  const arm = new T.Group();
  arm.position.set(2.55, 0.3, -1.45);
  g.add(arm);
  const metal = phys(0xe3e7f4, { metalness: 0.85, roughness: 0.22 });
  const base = new T.Mesh(keep(new T.CylinderGeometry(0.3, 0.34, 0.22, 40)), phys(dark ? 0x3a4478 : 0xc9d0ea, { metalness: 0.5 }));
  base.position.y = -0.2;
  arm.add(base);
  const dx = 1.05 - 2.55, dz = 0.95 + 1.45, L = Math.hypot(dx, dz);
  const swing = new T.Group();
  const armAngle = Math.atan2(-dz, dx);
  swing.rotation.y = armAngle;
  arm.add(swing);
  const tube = keep(new T.CylinderGeometry(0.035, 0.035, L, 16));
  tube.rotateZ(Math.PI / 2); tube.translate(L / 2, 0, 0);
  swing.add(new T.Mesh(tube, metal));
  const weight = new T.Mesh(keep(new T.CylinderGeometry(0.14, 0.14, 0.26, 32)), phys(0x2a2f45, { metalness: 0.6 }));
  weight.rotation.z = Math.PI / 2; weight.position.x = -0.38;
  swing.add(weight);
  const shell = new T.Mesh(keep(new T.BoxGeometry(0.34, 0.06, 0.18)), metal);
  shell.position.set(L, -0.05, 0);
  swing.add(shell);
  const cart = new T.Mesh(keep(new T.BoxGeometry(0.2, 0.08, 0.12)), phys(0xff6a3d));
  cart.position.set(L, -0.12, 0);
  swing.add(cart);

  // Soft contact shadow.
  const shadow = new T.Mesh(keep(new T.PlaneGeometry(6, 6)), keep(new T.MeshBasicMaterial({
    transparent: true, depthWrite: false, opacity: dark ? 0.9 : 0.55,
    map: keep(tex(256, 256, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(20,30,90,.45)'); gr.addColorStop(1, 'rgba(20,30,90,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    })),
  })));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.1, -0.16, 0.15);
  g.add(shadow);

  const still = reducedMotion();
  const frame = (t: number) => {
    disc.rotation.y = platter.rotation.y = -t * 1.8;
    swing.rotation.y = armAngle + Math.sin(t * 1.8) * 0.006; // the slight wobble of a real tonearm
    r.render(sc, cam);
  };
  const size = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    r.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    if (still) frame(1.2);
  };
  const ro = new ResizeObserver(size);
  ro.observe(host);
  size();
  let raf = 0;
  if (!still) {
    const t0 = performance.now();
    const loop = () => { frame((performance.now() - t0) / 1000 + 1.2); raf = requestAnimationFrame(loop); };
    loop();
  }
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    disposables.forEach(d => d.dispose());
    r.dispose();
    r.domElement.remove();
  };
};

// Notes drift from the record (right) to where the staff fades out (left).
const STAFF = 'M420 112 C500 62, 560 152, 632 106 S742 72, 805 96';
const HEAD = <ellipse rx="6.5" ry="4.6" transform="rotate(-22)" />;
const STEM = <rect x="4.9" y="-27" width="1.8" height="27" />;
const GLYPHS = {
  eighth: <>{HEAD}{STEM}<path d="M6.7-27c6 4 10.5 8.5 6 17 1-6.5-2.2-9.5-6-11.5z" /></>,
  quarter: <>{HEAD}{STEM}</>,
  beamed: <>{HEAD}<ellipse cx="17" cy="-4" rx="6.5" ry="4.6" transform="rotate(-22 17 -4)" />{STEM}<rect x="21.9" y="-31" width="1.8" height="27" /><path d="M4.9-27 23.7-31v5L4.9-22z" /></>,
};
const NOTES: [keyof typeof GLYPHS, number, string][] = [
  ['eighth', -7, 'var(--color-brand)'], ['quarter', 3.5, '#8B5CF6'], ['beamed', -3.5, 'var(--color-warm)'], ['eighth', 7, 'var(--color-brand)'],
  ['quarter', -10.5, '#8B5CF6'], ['eighth', 0, 'var(--color-warm)'], ['beamed', 3.5, 'var(--color-brand)'],
];

const Staff: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = svgRef.current!;
    const path = svg.querySelector<SVGPathElement>('#ops-staff-mid')!;
    const len = path.getTotalLength();
    const notes = [...svg.querySelectorAll<SVGGElement>('[data-dy]')];
    const place = (t: number) => notes.forEach((n, i) => {
      const u = (t * 0.045 + i / notes.length) % 1;
      const p = path.getPointAtLength((1 - u) * len);
      const bob = Math.sin(t * 1.6 + i * 1.3) * 5;
      n.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(p.y + Number(n.dataset.dy) + bob).toFixed(1)}) rotate(${(Math.sin(t * 1.2 + i) * 9).toFixed(1)})`);
      n.style.opacity = (Math.sin(Math.PI * u) * 0.5).toFixed(2); // kept faint so the notes stay background
    });
    if (reducedMotion()) { place(3); return; }
    let raf = 0;
    const t0 = performance.now();
    const loop = () => { place((performance.now() - t0) / 1000); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <svg ref={svgRef} viewBox="0 0 1000 190" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none text-brand max-md:opacity-35">
      <defs>
        <linearGradient id="ops-staff-fade" gradientUnits="userSpaceOnUse" x1="420" y1="0" x2="805" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset=".35" stopColor="currentColor" stopOpacity=".32" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".45" />
        </linearGradient>
      </defs>
      {[-14, -7, 0, 7, 14].map(o => (
        <path key={o} id={o === 0 ? 'ops-staff-mid' : undefined} d={STAFF} transform={`translate(0 ${o})`} fill="none" stroke="url(#ops-staff-fade)" strokeWidth="1.3" />
      ))}
      {NOTES.map(([k, dy, color], i) => (
        <g key={i} data-dy={dy} style={{ color, opacity: 0 }} fill="currentColor">{GLYPHS[k]}</g>
      ))}
    </svg>
  );
};

export const VinylArt: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current!;
    const isDark = () => document.documentElement.classList.contains('dark');
    let dark = isDark();
    let stop = startVinyl(host, dark);
    // Re-light the scene when the theme flips.
    const mo = new MutationObserver(() => { if (isDark() === dark) return; dark = isDark(); stop(); stop = startVinyl(host, dark); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { mo.disconnect(); stop(); };
  }, []);
  return (
    <>
      <Staff />
      <div ref={hostRef} aria-hidden="true" className="absolute inset-y-0 right-0 w-1/2 pointer-events-none max-md:w-full max-md:opacity-30" />
    </>
  );
};
