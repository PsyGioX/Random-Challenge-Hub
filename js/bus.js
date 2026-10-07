// ============================================================
// RCH Bus — sync between the app and the OBS overlay.
// Uses BroadcastChannel (instant) + localStorage (survives reloads,
// works across windows/docks that share one browser profile).
// ============================================================
(function (g) {
    'use strict';
    const PFX = 'rch_bus:';
    let ch = null;
    try { if ('BroadcastChannel' in g) ch = new BroadcastChannel('rch-bus'); } catch (e) { }
    const subs = {};

    function publish(topic, data) {
        const msg = { topic, data, ts: Date.now() };
        try { localStorage.setItem(PFX + topic, JSON.stringify(msg)); } catch (e) { }
        try { if (ch) ch.postMessage(msg); } catch (e) { }
    }
    function last(topic) {
        try { const r = localStorage.getItem(PFX + topic); return r ? JSON.parse(r) : null; } catch (e) { return null; }
    }
    function emit(msg) {
        if (!msg || !msg.topic) return;
        (subs[msg.topic] || []).forEach(fn => { try { fn(msg.data, msg); } catch (e) { console.warn('[bus]', e); } });
    }
    /** subscribe(topic, fn, {replay:true}) — replay delivers the last stored value immediately */
    function subscribe(topic, fn, opts) {
        (subs[topic] = subs[topic] || []).push(fn);
        if (opts && opts.replay) { const m = last(topic); if (m) fn(m.data, m); }
    }
    if (ch) ch.onmessage = e => emit(e.data);
    g.addEventListener('storage', e => {
        if (!e.key || e.key.indexOf(PFX) !== 0 || !e.newValue) return;
        try { emit(JSON.parse(e.newValue)); } catch (err) { }
    });
    g.RCHBus = { publish, subscribe, last };
})(window);
