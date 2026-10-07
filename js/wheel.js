// ============================================================
// RCH Wheel engine — shared by the app (index.html) and the OBS overlay.
// Draws a wheel with weighted segments, a marquee bulb ring and
// handles spin geometry. No dependencies on app globals.
// ============================================================
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RCHWheel = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    const TAU = Math.PI * 2;
    const POINTER = -Math.PI / 2; // 12 o'clock

    function weightOf(s) { return s && s.weight > 0 ? s.weight : 1; }

    /** Angular layout of segments: [{start,size,mid}] covering 0..2π by weight. */
    function layout(segs) {
        const total = segs.reduce((s, x) => s + weightOf(x), 0) || 1;
        let acc = 0;
        return segs.map(s => {
            const size = (weightOf(s) / total) * TAU;
            const o = { start: acc, size, mid: acc + size / 2 };
            acc += size;
            return o;
        });
    }

    /** Weighted random index. */
    function pickIndex(segs, rnd) {
        rnd = rnd || Math.random;
        const total = segs.reduce((s, x) => s + weightOf(x), 0);
        let r = rnd() * total;
        for (let i = 0; i < segs.length; i++) {
            r -= weightOf(segs[i]);
            if (r < 0) return i;
        }
        return Math.max(0, segs.length - 1);
    }

    /** Which segment is under the pointer for a given wheel rotation. */
    function indexAtPointer(segs, angle) {
        if (!segs.length) return -1;
        const L = layout(segs);
        const a = (((POINTER - angle) % TAU) + TAU) % TAU;
        for (let i = 0; i < L.length; i++) if (a >= L[i].start && a < L[i].start + L[i].size) return i;
        return L.length - 1;
    }

    /** Extra rotation needed so segment `idx` stops under the pointer. */
    function targetRotation(segs, idx, currentAngle, spins, jitter, rnd) {
        rnd = rnd || Math.random;
        const L = layout(segs);
        const seg = L[idx] || L[0];
        const j = (rnd() - 0.5) * (jitter === undefined ? 0.6 : jitter) * seg.size;
        const remainder = ((((POINTER - currentAngle - (seg.mid + j)) % TAU) + TAU) % TAU);
        return (spins || 0) * TAU + remainder;
    }

    const easeOutQuint = t => 1 - Math.pow(1 - t, 5);

    function withAlpha(color, a) {
        return /^#[0-9a-f]{6}$/i.test(color || '') ? color + a : color;
    }

    // theme colours (CSS variables), cached briefly because draw() runs every frame
    let _themeCache = null, _themeAt = 0;
    function themeColors() {
        const now = Date.now();
        if (_themeCache && now - _themeAt < 400) return _themeCache;
        let cs = null;
        try { cs = getComputedStyle(document.documentElement); } catch (e) { }
        const v = (n, d) => (cs && cs.getPropertyValue(n).trim()) || d;
        _themeCache = {
            border: v('--wheel-border', '#ffb938'),
            bulb: v('--wheel-bulb', '#ffcf5a'),
            band: v('--wheel-band', '#1b1f2b'),
            hub: v('--wheel-hub', '#f3efe6'),
        };
        _themeAt = now;
        return _themeCache;
    }

    /**
     * Draw the wheel.
     * o: { size, scales[], fontSize, centerIcon, bulbs, phase, spinning, labelOf(seg) }
     */
    function draw(canvas, segs, angle, o) {
        if (!canvas || !segs || !segs.length) return;
        o = o || {};
        const logical = o.size || parseInt(canvas.dataset.size, 10) || canvas.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const px = Math.round(logical * dpr);
        if (canvas.width !== px || canvas.height !== px) { canvas.width = px; canvas.height = px; }
        canvas.dataset.size = logical;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, logical, logical);

        const th = themeColors();
        const cx = logical / 2, cy = logical / 2;
        const outerEdge = logical / 2 - 2;
        const bandW = o.bulbs === false ? 6 : 20;
        const outerR = outerEdge - bandW;
        const innerR = Math.max(22, logical * 0.075);
        const scales = o.scales || [];
        const L = layout(segs);

        // ── bulb band ──
        ctx.beginPath(); ctx.arc(cx, cy, outerEdge, 0, TAU);
        ctx.arc(cx, cy, outerR, 0, TAU, true);
        ctx.fillStyle = th.band; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = th.border;
        ctx.beginPath(); ctx.arc(cx, cy, outerEdge, 0, TAU); ctx.stroke();
        if (o.bulbs !== false) {
            const n = Math.max(20, Math.min(48, Math.round(logical / 11)));
            const br = outerR + bandW / 2;
            const phase = o.spinning ? Math.floor(performance.now() / 90) : 0;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * TAU - Math.PI / 2;
                const lit = o.spinning ? ((i + phase) % 3 === 0) : (i % 2 === 0);
                ctx.beginPath(); ctx.arc(cx + Math.cos(a) * br, cy + Math.sin(a) * br, lit ? 3.4 : 2.6, 0, TAU);
                if (lit) { ctx.shadowColor = th.bulb; ctx.shadowBlur = 10; ctx.fillStyle = th.bulb; }
                else { ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.18)'; }
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }

        // ── segments ──
        const fs = Math.max(9, o.fontSize || 12) * (logical / 420 < 0.8 ? 0.85 : 1);
        segs.forEach((seg, i) => {
            const sA = L[i].start + angle, eA = sA + L[i].size;
            const scale = scales[i] !== undefined ? scales[i] : 1;
            if (scale <= 0) return;
            ctx.save();
            if (scale < 1) {
                const mid = sA + L[i].size / 2, mr = (innerR + outerR) / 2;
                const px0 = cx + Math.cos(mid) * mr, py0 = cy + Math.sin(mid) * mr;
                ctx.translate(px0, py0); ctx.scale(scale, scale); ctx.translate(-px0, -py0);
                ctx.globalAlpha = scale;
            }
            const grd = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
            grd.addColorStop(0, withAlpha(seg.color, 'f2'));
            grd.addColorStop(1, withAlpha(seg.color, 'b8'));
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, outerR, sA, eA); ctx.closePath();
            ctx.fillStyle = grd; ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2; ctx.stroke();

            // label
            const arcLen = L[i].size * outerR * 0.62;
            if (arcLen > fs * 1.15) {
                ctx.save();
                ctx.translate(cx, cy); ctx.rotate(sA + L[i].size / 2);
                const f = Math.min(fs, Math.max(8, arcLen * 0.62));
                ctx.font = `700 ${f}px Onest, Inter, system-ui, bootstrap-icons, sans-serif`;
                ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 4;
                let lbl = String((o.labelOf ? o.labelOf(seg) : (seg.label || seg.game || '')) || '');
                const maxW = outerR - innerR - 22;
                if (ctx.measureText(lbl).width > maxW) {
                    while (lbl.length > 1 && ctx.measureText(lbl + '…').width > maxW) lbl = lbl.slice(0, -1);
                    lbl = lbl.trimEnd() + '…';
                }
                ctx.fillText(lbl, outerR - 12, 0);
                if (seg.sub && arcLen > fs * 2.4) {
                    ctx.font = `500 ${Math.max(8, f - 2)}px Onest, Inter, system-ui, bootstrap-icons, sans-serif`;
                    ctx.fillStyle = 'rgba(255,255,255,0.78)';
                    ctx.fillText(String(seg.sub), outerR - 12, f + 1);
                }
                ctx.restore();
            }
            ctx.restore();
        });

        // ── hub ──
        ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, TAU);
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10;
        ctx.fillStyle = th.hub; ctx.fill(); ctx.shadowBlur = 0;
        ctx.lineWidth = 3; ctx.strokeStyle = th.border; ctx.stroke();
        // centre glyph: a Bootstrap Icons name (stored in settings) or, for old saves, plain text
        const ci = o.centerIcon || 'dice-3-fill';
        const glyph = (typeof window !== 'undefined' && typeof window.biChar === 'function' && window.biChar(ci)) || '';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#12151d';
        if (glyph) { ctx.font = `${innerR * 1.05}px bootstrap-icons`; ctx.fillText(glyph, cx, cy + 1); }
        else { ctx.font = `${innerR * 0.95}px Onest, Inter, system-ui, sans-serif`; ctx.fillText(ci.length <= 2 ? ci : '', cx, cy + 1); }
    }

    /** Standalone spin (used for auction / viewer wheels and by the overlay replay). */
    function spin(opts) {
        const o = opts;
        const ease = o.ease || easeOutQuint;
        const start = o.startAngle || 0;
        const total = o.total !== undefined ? o.total
            : targetRotation(o.segs, o.targetIdx, start, o.spins === undefined ? 6 : o.spins, o.jitter);
        const dur = o.duration || 5000;
        const t0 = performance.now();
        let raf = 0, done = false, lastIdx = -1;
        function frame(now) {
            const p = Math.min((now - t0) / dur, 1);
            const ang = start + total * ease(p);
            draw(o.canvas, o.segs, ang, Object.assign({}, o.drawOpts, { spinning: p < 1 }));
            if (o.onTick) {
                const idx = indexAtPointer(o.segs, ang);
                if (idx !== lastIdx) { lastIdx = idx; o.onTick(idx, p); }
            }
            if (p < 1) raf = requestAnimationFrame(frame);
            else { done = true; if (o.onDone) o.onDone(ang); }
        }
        raf = requestAnimationFrame(frame);
        return { total, endAngle: start + total, cancel() { if (!done) cancelAnimationFrame(raf); } };
    }

    return { TAU, POINTER, layout, pickIndex, indexAtPointer, targetRotation, draw, spin, easeOutQuint, weightOf };
});
