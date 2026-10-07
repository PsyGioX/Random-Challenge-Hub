// ============================================================
// RCH Auction — "point auction" in the spirit of pointauc.com
//
//  • lots are a persistent list, every lot owns an amount (money / points)
//  • bids arrive from Streamlabs, DonationAlerts and Twitch (bits, subs,
//    channel-point rewards) and add to a lot picked by #number or name
//  • a timer decides when bids are accepted (anti-sniping extends it)
//  • the winner is the leader — or the wheel: normal (slice ∝ money)
//    or dropout (eliminate one lot per spin until one is left)
//  • everything can be edited by hand: rename, +/- step, exact amount,
//    merge two lots, pin a lot between rounds, undo any bid
// ============================================================
(function () {
    'use strict';
    const KEY = 'rch_auction_v2', OLD_KEY = 'rch_auction_v1';
    const PALETTE = ['#f5a524', '#7c5cff', '#22c55e', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#3b82f6', '#a855f7', '#14b8a6', '#eab308'];
    const SRC_ICON = { streamlabs: 'cash-coin', donationalerts: 'coin', twitch: 'twitch', manual: 'person-gear', test: 'beaker' };
    const STEPS = [10, 50, 100, 500, 1000];

    const DEFAULTS = () => ({
        status: 'idle',                 // idle | running | paused | finished
        title: '', lots: [], nextNum: 1, bids: [], unassigned: [],
        endsAt: 0, remainingMs: 0, durationSec: 600,
        currency: '₽', minBid: 0, antiSnipeWindow: 15, antiSnipeExtend: 15,
        autoCreate: true, fuzzy: true, maxLots: 60,
        finishMode: 'manual',           // manual | top | wheel
        sort: 'amount',                 // amount | added
        compact: false, step: 100,
        wheel: { mode: 'normal', duration: 8, dropWeight: 'inverse', removeWinner: false },
        out: [], history: [],
        rates: { donation: 1, bit: 1, sub1: 0, sub2: 0, sub3: 0, points: 0 },
        rewardId: '', seenRewards: {},
        sources: { twitch: true, streamlabs: true, donationalerts: true },
        winner: null,
    });

    let A = load();
    function load() {
        try {
            let d = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (!d) { const o = JSON.parse(localStorage.getItem(OLD_KEY) || 'null'); if (o) d = migrate(o); }
            if (d) {
                const base = DEFAULTS(), m = Object.assign(base, d);
                m.rates = Object.assign(base.rates, d.rates || {});
                m.sources = Object.assign(base.sources, d.sources || {});
                m.wheel = Object.assign(base.wheel, d.wheel || {});
                if (m.status === 'finishing') m.status = 'running';
                m.lots.forEach(fixLot);
                return m;
            }
        } catch (e) { }
        return DEFAULTS();
    }
    /** v1 stored lots without amounts (totals were derived from the bid log). */
    function migrate(o) {
        const tot = {};
        (o.bids || []).forEach(b => { tot[b.lotId] = o.mode === 'highest' ? Math.max(tot[b.lotId] || 0, b.amount) : (tot[b.lotId] || 0) + b.amount; });
        o.lots = (o.lots || []).map(l => Object.assign({}, l, { amount: tot[l.id] || 0, pin: !!l.keep }));
        delete o.mode; o.durationSec = o.durationSec || 600; o.finishMode = o.finishMode === 'wheel' ? 'wheel' : 'top';
        return o;
    }
    function fixLot(l) {
        if (typeof l.amount !== 'number' || !isFinite(l.amount)) l.amount = 0;
        if (!l.color) l.color = PALETTE[((l.num || 1) - 1) % PALETTE.length];
    }
    let _saveT = null;
    function persist() { try { localStorage.setItem(KEY, JSON.stringify(A)); } catch (e) { } }
    function save() { clearTimeout(_saveT); _saveT = setTimeout(persist, 300); publishSoon(); }
    window.addEventListener('beforeunload', persist);

    // ── helpers ──────────────────────────────────────────
    const fmt = n => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const r2 = n => Math.round(n * 100) / 100;
    const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const remaining = () => A.status === 'running' ? Math.max(0, A.endsAt - Date.now()) : (A.status === 'paused' ? A.remainingMs : (A.status === 'idle' ? A.durationSec * 1000 : 0));
    const clock = ms => { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), p = n => String(n).padStart(2, '0'); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`; };
    const toast = (m, type) => { if (typeof showNotification === 'function') showNotification(m, type || 'info'); };
    const $ = id => document.getElementById(id);
    const lotById = id => A.lots.find(l => l.id === id);

    function lev(a, b) {
        if (a === b) return 0; const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
        let prev = Array.from({ length: n + 1 }, (_, i) => i);
        for (let i = 1; i <= m; i++) {
            const cur = [i];
            for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = cur;
        }
        return prev[n];
    }
    /** Same lot? exact, spacing/case-insensitive, or (fuzzy) one–two typos. */
    function sameName(a, b) {
        const x = norm(a), y = norm(b); if (!x || !y) return false; if (x === y) return true; if (!A.fuzzy) return false;
        const xc = x.replace(/\s/g, ''), yc = y.replace(/\s/g, ''); if (xc === yc) return true;
        const L = Math.max(xc.length, yc.length);
        return L >= 5 && Math.abs(xc.length - yc.length) <= 2 && lev(xc, yc) <= (L >= 10 ? 2 : 1);
    }
    /** Which lot does a donation message refer to? */
    function matchLot(text, lots) {
        const raw = String(text || '');
        const m = raw.match(/(?:^|\s)#\s*(\d{1,3})\b/) || raw.match(/\b(?:lot|лот)\s*#?\s*(\d{1,3})\b/i) || raw.trim().match(/^(\d{1,3})$/);
        if (m) { const l = lots.find(x => x.num === +m[1]); if (l) return l; }
        const n = norm(raw); if (!n) return null;
        for (const l of lots) if (sameName(l.name, raw)) return l;
        let best = null;
        for (const l of lots) { const ln = norm(l.name); if (ln && n.includes(ln) && (!best || ln.length > best.ln.length)) best = { l, ln }; }
        if (best) return best.l;
        if (n.length >= 3) { const c = lots.filter(l => norm(l.name).includes(n)); if (c.length === 1) return c[0]; }
        return null;
    }

    /** Display rows, totals and the leader. */
    function computed() {
        const cnt = {}; A.bids.forEach(b => { if (b.lotId) cnt[b.lotId] = (cnt[b.lotId] || 0) + 1; });
        const rows = A.lots.map(l => ({ lot: l, total: l.amount, count: cnt[l.id] || 0, out: A.out.includes(l.id) }));
        const byMoney = (a, b) => b.total - a.total || (a.lot.at || 0) - (b.lot.at || 0) || a.lot.num - b.lot.num;
        const sum = rows.reduce((s, r) => s + r.total, 0);
        const leader = rows.filter(r => r.total > 0 && !r.out).sort(byMoney)[0] || null;
        if (A.sort === 'amount') rows.sort(byMoney); else rows.sort((a, b) => a.lot.num - b.lot.num);
        rows.forEach(r => { r.pct = sum > 0 ? r.total / sum * 100 : 0; });
        return { rows, sum, leader };
    }
    function donors() {
        const d = {}; A.bids.forEach(b => { if (b.src !== 'manual' && b.amount > 0) d[b.user] = (d[b.user] || 0) + b.amount; });
        return Object.entries(d).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }

    // ── bid intake ───────────────────────────────────────
    const seen = new Set();
    function credit(lot, amount) { lot.amount = Math.max(0, r2(lot.amount + amount)); if (amount > 0) lot.at = Date.now(); }
    function createLot(name, by, amount) {
        const num = A.nextNum++;
        const lot = { id: uid(), num, name, by: by || '', amount: amount || 0, pin: false, color: PALETTE[(num - 1) % PALETTE.length], at: amount > 0 ? Date.now() : 0 };
        A.lots.push(lot); return lot;
    }
    function addBid(b) {
        if (b.id) { if (seen.has(b.id)) return; seen.add(b.id); if (seen.size > 800) seen.delete(seen.values().next().value); }
        b.amount = r2(b.amount);
        if (!(b.amount > 0)) return;
        b.ts = Date.now(); b.id = b.id || uid();
        const pend = reason => {
            A.unassigned.unshift({ id: uid(), user: b.user, amount: b.amount, src: b.src, text: b.text, ts: b.ts, reason });
            A.unassigned.length = Math.min(A.unassigned.length, 80);
            toast(t('au.toast_unassigned', { user: b.user, amount: fmt(b.amount) + ' ' + A.currency }), 'warning');
            refreshLive(); save();
        };
        if (A.status !== 'running') return pend('closed');
        if (b.amount < A.minBid) return pend('min');
        let lot = matchLot(b.text, A.lots);
        const numberOnly = /^\s*#?\s*\d{1,3}\s*$/.test(String(b.text || ''));
        if (!lot && A.autoCreate && !numberOnly) {
            const name = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 60);
            if (name.length >= 2 && A.lots.length < A.maxLots) lot = createLot(name, b.user);
        }
        if (!lot) return pend('nolot');
        credit(lot, b.amount);
        A.bids.push({ id: b.id, user: b.user, amount: b.amount, src: b.src, text: String(b.text || '').slice(0, 140), ts: b.ts, lotId: lot.id });
        if (A.bids.length > 1500) A.bids.shift();
        if (A.antiSnipeWindow > 0 && A.endsAt - Date.now() <= A.antiSnipeWindow * 1000) {
            A.endsAt = Date.now() + A.antiSnipeExtend * 1000;
            toast(t('au.toast_extended', { n: A.antiSnipeExtend }), 'info');
        }
        playBid();
        try { RCHBus.publish('overlayAlert', { id: b.id, kind: 'bid', user: b.user, amount: b.amount, currency: A.currency, lot: lot.name, num: lot.num }); } catch (e) { }
        refreshLive(); save();
    }
    function playBid() {
        try {
            if (!rouletteSettings.soundEnabled) return; initAudio(); if (!audioCtx) return;
            const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination);
            o.type = 'triangle'; o.frequency.setValueAtTime(660, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(990, audioCtx.currentTime + 0.12);
            g.gain.setValueAtTime(0.1 * rouletteSettings.soundVolume, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
            o.start(); o.stop(audioCtx.currentTime + 0.26);
        } catch (e) { }
    }

    // sources → bids
    function onDonation(d) {
        const key = d.source === 'streamlabs' ? 'streamlabs' : 'donationalerts';
        if (!A.sources[key]) { toast(`${d.user}: ${fmt(d.amount)} ${d.currency}`, 'success'); return; }
        addBid({ id: d.id, src: d.source, user: d.user, amount: d.amount * (A.rates.donation || 1), text: d.text });
    }
    function onChat(ev) {
        if (ev.isMod || ev.isBroad) { if (ev.text.trim().toLowerCase() === '!lots') announceLeaders(); }
        if (!A.sources.twitch) return;
        if (ev.rewardId) {
            A.seenRewards[ev.rewardId] = (A.seenRewards[ev.rewardId] || 0) + 1;
            if (A.rewardId && ev.rewardId === A.rewardId && A.rates.points > 0)
                addBid({ id: 'tw:' + (ev.id || uid()), src: 'twitch', user: ev.name, amount: A.rates.points, text: ev.text });
            return;
        }
        if (ev.bits > 0 && A.rates.bit > 0) {
            const text = ev.text.replace(/\b[a-z]*cheer\d+\b/gi, ' ').replace(/\s+/g, ' ').trim();
            addBid({ id: 'tw:' + (ev.id || uid()), src: 'twitch', user: ev.name, amount: ev.bits * A.rates.bit, text });
        }
    }
    function onTwitchNotice(ev) {
        if (!A.sources.twitch) return;
        const tier = RCHInt.subTier(ev.plan), rate = A.rates['sub' + tier] || 0;
        if (rate <= 0) return;
        if (['sub', 'resub', 'subgift', 'anonsubgift'].includes(ev.type))
            addBid({ id: 'tw:' + ev.id, src: 'twitch', user: ev.name, amount: rate, text: ev.text });
        else if (ev.type === 'submysterygift')
            addBid({ id: 'tw:' + ev.id, src: 'twitch', user: ev.name, amount: rate * (ev.gifts || 1), text: ev.text });
    }
    function announceLeaders() {
        const top = computed().rows.filter(r => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 3).map(r => `#${r.lot.num} ${r.lot.name} — ${fmt(r.total)}`).join(' | ');
        toast(top || t('au.no_bids'), 'info');
    }

    // ── timer lifecycle ──────────────────────────────────
    function start() {
        if (A.status === 'running') return;
        if (A.status === 'paused') { A.endsAt = Date.now() + A.remainingMs; A.status = 'running'; }
        else {
            if (A.status === 'finished') { // new round: pinned lots stay, money resets
                A.bids = []; A.unassigned = []; A.winner = null; A.out = [];
                A.lots = A.lots.filter(l => l.pin); A.lots.forEach(l => { l.amount = 0; l.at = 0; });
            }
            A.endsAt = Date.now() + A.durationSec * 1000; A.status = 'running'; A.winner = null;
        }
        rchOverlay({ type: 'idle' });
        render(); save();
    }
    function pause() { if (A.status !== 'running') return; A.remainingMs = Math.max(0, A.endsAt - Date.now()); A.status = 'paused'; render(); save(); }
    function addTime(sec) {
        if (A.status === 'running') A.endsAt += sec * 1000;
        else if (A.status === 'paused') A.remainingMs += sec * 1000;
        else if (A.status === 'finished') { A.status = 'running'; A.endsAt = Date.now() + sec * 1000; A.winner = null; }
        else A.durationSec += sec;
        render(); save();
    }
    function finish() {
        if (A.status !== 'running' && A.status !== 'paused') return;
        A.status = 'finished'; A.endsAt = 0;
        const { leader } = computed();
        render(); save();
        if (!leader) { toast(t('au.no_bids'), 'warning'); return; }
        if (A.finishMode === 'top') declareWinner(leader.lot);
        else if (A.finishMode === 'wheel') setTimeout(spinWheel, 400);
    }
    function reset() {
        showConfirmModal(t('au.reset_title'), t('au.reset_msg'), t('common.reset'), t('common.cancel'), () => {
            A.status = 'idle'; A.bids = []; A.unassigned = []; A.winner = null; A.endsAt = 0; A.out = [];
            A.lots = A.lots.filter(l => l.pin); A.lots.forEach(l => { l.amount = 0; l.at = 0; });
            rchOverlay({ type: 'idle' }); render(); save();
        });
    }
    function tick() {
        if (A.status === 'running') {
            if (Date.now() >= A.endsAt) { finish(); return; }
            const left = remaining(), c = $('auClock');
            if (c) { c.textContent = clock(left); c.classList.toggle('urgent', left <= 15000); }
            const now = Math.floor(Date.now() / 1000); if (now !== tick.last) { tick.last = now; publishNow(); }
        }
    }
    setInterval(tick, 250);

    // ── lot operations ───────────────────────────────────
    function addLotUI() {
        const i = $('auNewLot'), a = $('auNewAmount'); if (!i) return;
        const name = i.value.trim().slice(0, 60); if (!name) { i.focus(); return; }
        const amount = Math.max(0, parseFloat(String((a && a.value) || '0').replace(',', '.')) || 0);
        const same = A.lots.find(l => sameName(l.name, name));
        if (same) { if (amount > 0) adjust(same.id, amount); else toast(t('games.game_exists'), 'warning'); }
        else { const l = createLot(name, '', amount); if (amount > 0) A.bids.push({ id: uid(), user: t('pa.host'), amount, src: 'manual', text: '', ts: Date.now(), lotId: l.id }); }
        i.value = ''; if (a) a.value = ''; refreshLive(); save(); i.focus();
    }
    /** Manual change of a lot's money; logged so it can be undone from the bids list. */
    function adjust(id, delta) {
        const l = lotById(id); if (!l || !delta) return;
        const d = Math.max(delta, -l.amount); if (!d) return;
        credit(l, d);
        A.bids.push({ id: uid(), user: t('pa.host'), amount: r2(d), src: 'manual', text: '', ts: Date.now(), lotId: id });
        refreshLive(); save();
    }
    function setAmount(id, value) {
        const l = lotById(id); const v = parseFloat(String(value).replace(',', '.'));
        if (!l || !isFinite(v) || v < 0) return refreshLive();
        adjust(id, r2(v - l.amount)); refreshLive();
    }
    function rename(id, name) {
        const l = lotById(id); name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
        if (!l || !name || name === l.name) return refreshLive();
        if (A.lots.some(x => x.id !== id && norm(x.name) === norm(name))) { toast(t('games.game_exists'), 'warning'); return refreshLive(); }
        l.name = name; refreshLive(); save();
    }
    function delLot(id) {
        const l = lotById(id); if (!l) return;
        const bids = A.bids.filter(b => b.lotId === id && b.src !== 'manual');
        const go = () => {
            bids.forEach(b => A.unassigned.unshift({ id: uid(), user: b.user, amount: b.amount, src: b.src, text: b.text, ts: b.ts, reason: 'nolot' }));
            A.bids = A.bids.filter(b => b.lotId !== id); A.lots = A.lots.filter(x => x.id !== id); A.out = A.out.filter(x => x !== id);
            render(); save();
        };
        if (bids.length) showConfirmModal(t('au.del_lot_title'), t('au.del_lot_msg', { name: l.name, n: bids.length }), t('games.delete_btn'), t('common.cancel'), go); else go();
    }
    function togglePin(id) { const l = lotById(id); if (l) { l.pin = !l.pin; refreshLive(); save(); } }
    function merge(srcId, dstId) {
        const s = lotById(srcId), d = lotById(dstId); if (!s || !d || s === d) return;
        credit(d, s.amount); d.at = Math.max(d.at || 0, s.at || 0); d.pin = d.pin || s.pin;
        A.bids.forEach(b => { if (b.lotId === srcId) b.lotId = dstId; });
        A.lots = A.lots.filter(l => l.id !== srcId); A.out = A.out.filter(x => x !== srcId);
        toast(t('pa.merged', { a: s.name, b: d.name }), 'success'); refreshLive(); save();
    }
    function clearEmpty() {
        const n = A.lots.length; A.lots = A.lots.filter(l => l.amount > 0 || l.pin);
        if (A.lots.length !== n) { refreshLive(); save(); }
    }
    function assign(pid, lotId) {
        const u = A.unassigned.find(x => x.id === pid), l = lotById(lotId); if (!u || !l) return;
        credit(l, u.amount);
        A.bids.push({ id: uid(), user: u.user, amount: u.amount, src: u.src, text: u.text, ts: u.ts, lotId: l.id });
        A.unassigned = A.unassigned.filter(x => x.id !== pid); refreshLive(); save();
    }
    function dismiss(id) { A.unassigned = A.unassigned.filter(x => x.id !== id); refreshLive(); save(); }
    function newLotFromPending(id) {
        const u = A.unassigned.find(x => x.id === id); if (!u) return;
        showPromptModal(t('au.new_lot'), t('au.new_lot_prompt'), String(u.text || '').slice(0, 60), val => {
            const name = String(val || '').trim().slice(0, 60); if (!name) return;
            const l = matchLot(name, A.lots) || createLot(name, u.user); assign(id, l.id);
        });
    }
    function undoBid(id) {
        const b = A.bids.find(x => x.id === id); if (!b) return;
        const l = lotById(b.lotId); if (l) credit(l, -b.amount);
        A.bids = A.bids.filter(x => x.id !== id); refreshLive(); save();
    }
    function testBid() {
        if (A.status !== 'running') return toast(t('au.need_running'), 'warning');
        const users = ['NightWolf', 'Katya_Play', 'Mr_Dice', 'Lena', 'Ivan77'];
        const pick = A.lots.length ? A.lots[Math.floor(Math.random() * A.lots.length)] : null;
        addBid({ src: 'test', user: users[Math.floor(Math.random() * users.length)], amount: [50, 100, 150, 300, 500][Math.floor(Math.random() * 5)], text: pick ? '#' + pick.num : 'Test lot ' + A.nextNum });
    }
    function set(key, val, kind) {
        if (kind === 'num') { val = parseFloat(String(val).replace(',', '.')); if (!isFinite(val) || val < 0) val = 0; }
        if (kind === 'bool') val = !!val;
        if (key.indexOf('.') > 0) { const [a, b] = key.split('.'); A[a][b] = val; } else A[key] = val;
        if (key === 'durationSec' && A.status === 'idle') { const c = $('auClock'); if (c) c.textContent = clock(A.durationSec * 1000); }
        if (key === 'fuzzy' || key === 'sort' || key === 'compact' || key === 'currency') refreshLive();
        save();
    }
    function copyChatText() {
        const base = A.lots.length ? A.lots.slice(0, 12).map(l => `#${l.num} ${l.name}`).join(', ') : '';
        const msg = t('au.chat_text', { lots: base || t('au.chat_any') });
        navigator.clipboard.writeText(msg).then(() => toast(t('notif.copied'), 'success')).catch(() => toast(t('notif.copy_error'), 'error'));
    }

    // ── winner ───────────────────────────────────────────
    function declareWinner(lot) {
        if (!lot) return;
        A.winner = { lotId: lot.id, name: lot.name, num: lot.num, total: lot.amount, ts: Date.now() };
        A.history.unshift({ ts: Date.now(), name: lot.name, total: lot.amount, mode: A.wheel.mode });
        A.history.length = Math.min(A.history.length, 30);
        rchOverlay({ type: 'winner', name: lot.name, from: `${fmt(lot.amount)} ${A.currency}` });
        playWinSound(); if (rouletteSettings.particleEffect) createParticles();
        toast(t('au.winner_toast', { name: lot.name }), 'success');
        if (A.wheel.removeWinner) removeLotQuiet(lot.id);
        render(); save();
    }
    function removeLotQuiet(id) { A.bids = A.bids.filter(b => b.lotId !== id); A.lots = A.lots.filter(l => l.id !== id); A.out = []; }
    function winnerDone() { if (A.winner) { removeLotQuiet(A.winner.lotId); } A.winner = null; render(); save(); }
    function winnerClose() { A.winner = null; render(); save(); }
    function toRoulette() {
        const w = A.winner; if (!w || !games[w.name]) return;
        rouletteMode = 'task-only'; taskOnlyState.selectedGame = w.name; saveAll(); updateWheelSegments(); switchTab('roulette');
    }
    function addAsGame() {
        const w = A.winner; if (!w || games[w.name]) return;
        games[w.name] = []; saveAll(); toast(t('games.added', { name: w.name }), 'success'); render();
    }

    // ── wheel ────────────────────────────────────────────
    let wheelAngle = 0, spinning = false, autoDrop = false, wheelRun = null;
    function wheelRows() { return computed().rows.filter(r => r.total > 0 && !r.out); }
    function wheelSegs() {
        const rows = wheelRows(), drop = A.wheel.mode === 'dropout';
        const ws = rows.map(r => drop ? (A.wheel.dropWeight === 'inverse' ? 1 / Math.max(r.total, 0.01) : r.total) : r.total);
        const sum = ws.reduce((s, x) => s + x, 0) || 1;
        return rows.map((r, i) => ({ label: r.lot.name, sub: (ws[i] / sum * 100).toFixed(ws[i] / sum < 0.1 ? 1 : 0) + '%', color: r.lot.color, weight: ws[i], lot: r.lot }));
    }
    function drawWheel() {
        const c = $('auctionWheel'); if (!c || spinning) return;
        const segs = wheelSegs(), empty = $('auWheelEmpty'); if (empty) empty.hidden = !!segs.length;
        if (!segs.length) { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); return; }
        RCHWheel.draw(c, segs, wheelAngle, { size: 360, fontSize: 13, centerIcon: 'hammer' });
    }
    function spinWheel() {
        if (spinning) return;
        const segs = wheelSegs(), drop = A.wheel.mode === 'dropout';
        if (!segs.length) { autoDrop = false; return toast(t('pa.wheel_empty'), 'warning'); }
        if (segs.length === 1) { autoDrop = false; return declareWinner(segs[0].lot); }
        const idx = RCHWheel.pickIndex(segs), canvas = $('auctionWheel');
        const duration = Math.max(3, Math.min(40, A.wheel.duration || 8)) * 1000;
        if (A.winner) { A.winner = null; renderWinner(); }
        spinning = true; refreshWheelUi();
        const startAngle = wheelAngle;
        if (rouletteSettings.soundEnabled) playSpinSound();
        const done = ang => {
            wheelAngle = ang % RCHWheel.TAU; spinning = false;
            const seg = segs[idx];
            if (!drop) { autoDrop = false; refreshWheelUi(); return declareWinner(seg.lot); }
            A.out.push(seg.lot.id); toast(t('pa.eliminated', { name: seg.lot.name }), 'info');
            const left = wheelRows();
            save(); refreshLive();
            if (left.length <= 1) { autoDrop = false; setTimeout(() => left[0] && declareWinner(left[0].lot), 700); }
            else if (autoDrop) setTimeout(spinWheel, 1300);
        };
        if (!canvas) return done(startAngle + RCHWheel.targetRotation(segs, idx, startAngle, 5));
        wheelRun = RCHWheel.spin({
            canvas, segs, targetIdx: idx, startAngle, duration, spins: 5, drawOpts: { size: 360, fontSize: 13, centerIcon: 'hammer' },
            onTick: () => { if (rouletteSettings.tickSoundEnabled) playTickSound(); }, onDone: done,
        });
        publishWheel(A.title || t('tab.auction'), segs, { startAngle, total: wheelRun.total, duration }, segs[idx].label);
    }
    function restoreOut(id) { A.out = id ? A.out.filter(x => x !== id) : []; refreshLive(); save(); }
    function setWheelMode(m) { if (spinning) return; A.wheel.mode = m === 'dropout' ? 'dropout' : 'normal'; autoDrop = false; render(); save(); }

    // ── overlay publishing ───────────────────────────────
    let _pubT = null;
    function snapshot() {
        const { rows, sum } = computed();
        const top = rows.filter(r => r.total > 0).sort((a, b) => b.total - a.total || (a.lot.at || 0) - (b.lot.at || 0));
        return {
            status: A.status, title: A.title, currency: A.currency, endsAt: A.status === 'running' ? A.endsAt : 0,
            remainingMs: remaining(), sum, bids: A.bids.length,
            lots: top.slice(0, 8).map(r => ({ num: r.lot.num, name: r.lot.name, total: r.total, count: r.count, pct: Math.round(r.pct * 10) / 10, color: r.lot.color, out: r.out })),
            winner: A.winner ? { name: A.winner.name, total: A.winner.total } : null,
            recent: A.bids.filter(b => b.src !== 'manual').slice(-4).reverse().map(b => ({ user: b.user, amount: b.amount, lot: (lotById(b.lotId) || {}).name || '' })),
        };
    }
    function publishNow() { try { RCHBus.publish('overlayAuction', snapshot()); } catch (e) { } }
    function publishSoon() { if (_pubT) return; _pubT = setTimeout(() => { _pubT = null; publishNow(); }, 120); }

    // ── UI: pieces ───────────────────────────────────────
    const ic = (n, c) => bi(n, c);
    function lotsHtml() {
        const { rows, leader } = computed();
        if (!rows.length) return `<div class="empty-text">${ic('hammer', 'empty-ic')}<div>${esc(t('au.empty_lots'))}</div></div>`;
        const live = A.sort === 'amount';
        return rows.map((r, i) => {
            const lead = leader && leader.lot.id === r.lot.id, win = A.winner && A.winner.lotId === r.lot.id;
            const w = r.total > 0 ? Math.max(2, Math.min(100, r.pct)) : 0;
            return `<div class="pa-lot${lead ? ' lead' : ''}${win ? ' won' : ''}${r.out ? ' out' : ''}${r.lot.pin ? ' pinned' : ''}" data-id="${r.lot.id}" style="--c:${esc(r.lot.color)};--w:${w.toFixed(1)}%">
              <div class="pa-lot-fill"></div>
              <div class="pa-lot-rank">${lead ? ic('trophy-fill') : (live && r.total > 0 ? i + 1 : '·')}</div>
              <div class="pa-lot-body">
                <div class="pa-lot-name"><span class="pa-lot-num">#${r.lot.num}</span><span class="pa-lot-title" data-au="rename" data-id="${r.lot.id}" title="${esc(t('pa.rename'))}">${esc(r.lot.name)}</span>${r.lot.pin ? ic('pin-angle-fill', 'pa-pinned') : ''}${r.out ? `<span class="pa-out-tag">${esc(t('pa.out'))}</span>` : ''}</div>
                <div class="pa-lot-sub">${r.pct ? r.pct.toFixed(r.pct < 10 ? 1 : 0) + '%' : '0%'}${r.count ? ' · ' + esc(t('au.bids_n', { n: r.count })) : ''}</div>
              </div>
              <div class="pa-lot-amount" data-au="amount" data-id="${r.lot.id}" title="${esc(t('pa.edit_amount'))}">${fmt(r.total)}<small>${esc(A.currency)}</small></div>
              <div class="pa-lot-ctrl">
                <button class="icon-btn small" data-au="dec" data-id="${r.lot.id}" title="−${fmt(A.step)}">${ic('dash-lg')}</button>
                <button class="icon-btn small" data-au="inc" data-id="${r.lot.id}" title="+${fmt(A.step)}">${ic('plus-lg')}</button>
                <button class="icon-btn small" data-au="merge" data-id="${r.lot.id}" title="${esc(t('pa.merge'))}">${ic('union')}</button>
                <button class="icon-btn small${r.lot.pin ? ' on' : ''}" data-au="pin" data-id="${r.lot.id}" title="${esc(t('au.keep_lot'))}">${ic('pin-angle')}</button>
                <button class="icon-btn small" data-au="del" data-id="${r.lot.id}" title="${esc(t('common.delete'))}">${ic('trash3')}</button>
              </div></div>`;
        }).join('');
    }
    function feedHtml() {
        const items = A.bids.slice(-30).reverse(), d = donors();
        return `<div class="au-feed">${items.length ? items.map(b => {
            const l = lotById(b.lotId);
            return `<div class="feed-row"><span class="feed-src" title="${esc(b.src)}">${ic(SRC_ICON[b.src] || 'dot')}</span>
              <span class="feed-main"><span class="feed-user">${esc(b.user)}</span><span class="feed-lot muted">${ic('arrow-right-short')}${l ? '#' + l.num + ' ' + esc(l.name) : '?'}</span></span>
              <b class="feed-amt${b.amount < 0 ? ' neg' : ''}">${b.amount > 0 ? '+' : ''}${fmt(b.amount)}</b>
              <button class="icon-btn small" title="${esc(t('au.undo'))}" data-au="undo" data-id="${esc(b.id)}">${ic('arrow-counterclockwise')}</button></div>`;
        }).join('') : `<div class="muted small">${esc(t('au.no_bids'))}</div>`}</div>
        ${d.length ? `<div class="donors"><div class="muted small">${esc(t('au.top_donors'))}</div>${d.map(([u, a], i) => `<div class="feed-row"><span class="feed-src">${i + 1}</span><span class="feed-main"><span class="feed-user">${esc(u)}</span></span><b class="feed-amt">${fmt(a)}</b></div>`).join('')}</div>` : ''}`;
    }
    function pendingHtml() {
        if (!A.unassigned.length) return '';
        const opts = A.lots.map(l => `<option value="${l.id}">#${l.num} ${esc(l.name)}</option>`).join('');
        return `<section class="pa-card warn"><h3>${ic('exclamation-triangle-fill')} ${esc(t('au.unassigned_title'))} <span class="section-badge">${A.unassigned.length}</span></h3>
          <p class="muted small">${esc(t('au.unassigned_hint'))}</p>
          ${A.unassigned.slice(0, 8).map(u => `<div class="un-row"><div class="un-info"><b>${esc(u.user)}</b> <span>${fmt(u.amount)} ${esc(A.currency)}</span>
            <div class="muted small">${esc(u.text || '—')} · ${esc(t('au.reason_' + u.reason))}</div></div>
            <div class="un-actions">${A.lots.length ? `<select data-au-assign="${u.id}" aria-label="${esc(t('au.assign_to'))}"><option value="">${esc(t('au.assign_to'))}</option>${opts}</select>` : ''}
              <button class="cyber-btn" data-au="newlot" data-id="${u.id}">${ic('plus-lg')} ${esc(t('au.new_lot'))}</button>
              <button class="icon-btn" title="${esc(t('common.delete'))}" data-au="dismiss" data-id="${u.id}">${ic('x-lg')}</button></div></div>`).join('')}
          ${A.unassigned.length > 8 ? `<div class="muted small">+${A.unassigned.length - 8}</div>` : ''}</section>`;
    }
    function rewardsHtml() {
        const ids = Object.entries(A.seenRewards).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return ids.length ? `<div class="muted small">${esc(t('au.rewards_seen'))}</div><div class="chips">${ids.map(([id, n]) => `<button class="chip ${A.rewardId === id ? 'on' : ''}" onclick="RCHAuction.pickReward('${esc(id)}')">…${esc(id.slice(-6))} ×${n}</button>`).join('')}</div>` : `<div class="muted small">${esc(t('au.rewards_none'))}</div>`;
    }
    function pickReward(id) { A.rewardId = id; save(); const i = $('auRewardId'); if (i) i.value = id; refreshLive(); }

    function winnerHtml() {
        if (!A.winner) {
            if (A.status !== 'finished') return '';
            const { leader } = computed();
            if (!leader) return `<div class="au-winner none">${ic('inbox')} ${esc(t('au.no_bids'))}</div>`;
            return `<div class="au-winner leader"><div class="au-winner-icon">${ic('trophy')}</div><div class="au-winner-body"><div class="muted small">${esc(t('pa.leader'))}</div>
              <div class="au-winner-name">${esc(leader.lot.name)}</div><div class="muted">${fmt(leader.total)} ${esc(A.currency)} · ${leader.pct.toFixed(0)}%</div></div>
              <div class="au-winner-actions"><button class="cyber-btn primary-btn" data-au="pickleader">${ic('check-lg')} ${esc(t('pa.pick_leader'))}</button>
              <button class="cyber-btn" data-au="gowheel">${ic('pie-chart-fill')} ${esc(t('pa.go_wheel'))}</button></div></div>`;
        }
        const w = A.winner, g = games[w.name], exists = !!lotById(w.lotId);
        return `<div class="au-winner"><div class="au-winner-icon">${ic('trophy-fill')}</div><div class="au-winner-body"><div class="muted small">${esc(t('au.winner'))}</div>
            <div class="au-winner-name">${esc(w.name)}</div><div class="muted">${fmt(w.total)} ${esc(A.currency)}</div></div>
          <div class="au-winner-actions">${g ? (g.length ? `<button class="cyber-btn primary-btn" data-au="toroulette">${ic('dice-5-fill')} ${esc(t('au.to_roulette'))}</button>` : '') : `<button class="cyber-btn primary-btn" data-au="addgame">${ic('controller')} ${esc(t('au.add_game'))}</button>`}
            ${exists ? `<button class="cyber-btn" data-au="wdone">${ic('check2-all')} ${esc(t('pa.done_remove'))}</button>` : ''}
            <button class="icon-btn" title="${esc(t('common.cancel'))}" data-au="wclose">${ic('x-lg')}</button></div></div>`;
    }
    function renderWinner() { const w = $('auWinner'); if (w) w.innerHTML = winnerHtml(); }

    function controlsHtml() {
        const s = A.status, b = (act, cls, icon, label, extra) => `<button class="cyber-btn ${cls}" data-au="${act}" ${extra || ''}>${ic(icon)} <span>${esc(label)}</span></button>`;
        return `${s === 'idle' ? b('start', 'add-btn', 'play-fill', t('au.start')) : ''}
          ${s === 'finished' ? b('start', 'add-btn', 'arrow-repeat', t('au.new_round')) : ''}
          ${s === 'running' ? b('pause', '', 'pause-fill', t('au.pause')) : ''}
          ${s === 'paused' ? b('start', 'add-btn', 'play-fill', t('au.resume')) : ''}
          ${s === 'running' || s === 'paused' ? b('finish', 'primary-btn', 'flag-fill', t('au.finish')) : ''}
          <span class="pa-time-btns">${[30, 60, 300].map(sec => `<button class="cyber-btn" data-au="time" data-sec="${sec}">+${sec < 60 ? sec + t('au.sec') : sec / 60 + t('au.min')}</button>`).join('')}</span>
          <button class="icon-btn danger" data-au="reset" title="${esc(t('au.reset'))}">${ic('arrow-counterclockwise')}</button>`;
    }
    function toolbarHtml() {
        return `<div class="pa-toolbar">
          <div class="pa-steps" role="group" aria-label="${esc(t('pa.step'))}"><span class="muted small">${esc(t('pa.step'))}</span>${STEPS.map(s => `<button class="chip${A.step === s ? ' on' : ''}" data-au="step" data-v="${s}">${fmt(s)}</button>`).join('')}</div>
          <div class="pa-tools">
            <button class="icon-btn small${A.sort === 'amount' ? ' on' : ''}" data-au="sort" title="${esc(A.sort === 'amount' ? t('pa.sort_amount') : t('pa.sort_added'))}">${ic(A.sort === 'amount' ? 'sort-numeric-down-alt' : 'clock-history')}</button>
            <button class="icon-btn small${A.compact ? ' on' : ''}" data-au="compact" title="${esc(t('pa.compact'))}">${ic('list-ul')}</button>
            <button class="icon-btn small" data-au="clearempty" title="${esc(t('pa.clear_empty'))}">${ic('eraser-fill')}</button>
          </div></div>`;
    }
    function wheelHtml() {
        const drop = A.wheel.mode === 'dropout', left = wheelRows().length;
        const outLots = A.out.map(id => lotById(id)).filter(Boolean);
        return `<section class="pa-card pa-wheelcard">
          <div class="pa-card-head"><h3>${ic('pie-chart-fill')} ${esc(t('pa.wheel_title'))}</h3>
            <div class="pa-switch" role="group"><button class="${drop ? '' : 'on'}" data-au="wmode" data-v="normal">${esc(t('pa.mode_normal'))}</button><button class="${drop ? 'on' : ''}" data-au="wmode" data-v="dropout">${esc(t('pa.mode_dropout'))}</button></div></div>
          <div class="viewer-wheel-wrap big pa-wheel-wrap"><span class="viewer-pointer">${ic('caret-down-fill')}</span><canvas id="auctionWheel" width="360" height="360"></canvas>
            <div class="pa-wheel-empty" id="auWheelEmpty" ${left ? 'hidden' : ''}>${ic('pie-chart')}<span>${esc(t('pa.wheel_empty'))}</span></div></div>
          <div class="pa-wheel-actions">
            <button class="cyber-btn spin-btn" id="auSpin" data-au="spin" ${spinning || !left ? 'disabled' : ''}>${ic(drop ? 'x-octagon-fill' : 'arrow-clockwise')} <span>${esc(drop ? t('pa.spin_dropout') : t('pa.spin'))}</span></button>
            ${drop ? `<button class="cyber-btn" data-au="autodrop" ${spinning || left < 2 ? 'disabled' : ''}>${ic('fast-forward-fill')} ${esc(t('pa.drop_auto'))}</button>` : ''}
          </div>
          ${drop ? `<div class="pa-left muted small">${esc(t('pa.dropout_left', { n: left }))}</div>` : ''}
          ${outLots.length ? `<div class="pa-outlist"><div class="muted small">${esc(t('pa.out'))}:</div><div class="chips">${outLots.map(l => `<button class="chip" data-au="restoreone" data-id="${l.id}" title="${esc(t('pa.restore'))}">${esc(l.name)} ${ic('arrow-90deg-left')}</button>`).join('')}<button class="chip" data-au="restoreall">${esc(t('pa.restore_all'))}</button></div></div>` : ''}
          <p class="muted small pa-hint">${esc(drop ? t('pa.dropout_hint') : t('pa.normal_hint'))}</p>
          <div class="pa-wheel-opts">
            <label class="mini-field"><span>${esc(t('pa.spin_time'))}</span><input type="number" min="3" max="40" step="1" value="${A.wheel.duration}" onchange="RCHAuction.set('wheel.duration',this.value,'num')"></label>
            ${drop ? `<label class="mini-field"><span>${esc(t('pa.drop_chance'))}</span><select onchange="RCHAuction.set('wheel.dropWeight',this.value);RCHAuction.render()"><option value="inverse" ${A.wheel.dropWeight === 'inverse' ? 'selected' : ''}>${esc(t('pa.drop_inverse'))}</option><option value="amount" ${A.wheel.dropWeight === 'amount' ? 'selected' : ''}>${esc(t('pa.drop_amount'))}</option></select></label>` : ''}
          </div>
          <label class="check-row"><input type="checkbox" ${A.wheel.removeWinner ? 'checked' : ''} onchange="RCHAuction.set('wheel.removeWinner',this.checked,'bool')"> ${esc(t('pa.remove_winner'))}</label>
          ${A.history.length ? `<div class="pa-history"><div class="muted small">${esc(t('pa.history'))}</div>${A.history.slice(0, 5).map(h => `<div class="pa-hist-row">${ic(h.mode === 'dropout' ? 'x-octagon' : 'trophy-fill')}<span>${esc(h.name)}</span><b>${fmt(h.total)}</b></div>`).join('')}</div>` : ''}
        </section>`;
    }
    function refreshWheelUi() {
        const w = $('auWheelCard'); if (!w) return;
        const sp = $('auSpin'); if (sp) sp.disabled = spinning || !wheelRows().length;
        document.querySelectorAll('#auWheelCard [data-au="autodrop"],#auWheelCard [data-au="wmode"]').forEach(b => { if (spinning) b.setAttribute('disabled', ''); else if (b.dataset.au === 'wmode') b.removeAttribute('disabled'); });
    }

    function srcRow(svc, name, extra) {
        const st = streamerState.integ[svc] || { status: 'idle' };
        return `<div class="src-row"><div class="src-head"><label class="check-row"><input type="checkbox" ${A.sources[svc] ? 'checked' : ''} onchange="RCHAuction.set('sources.${svc}',this.checked,'bool')"> <b>${name}</b></label>
            <span class="conn-status js-integ-status ${st.status}" data-svc="${svc}"></span></div>${extra}</div>`;
    }
    function sourcesHtml() {
        const S = streamerState;
        const num = (k, label, step) => `<label class="mini-field"><span>${esc(label)}</span><input type="number" min="0" step="${step || 'any'}" value="${A.rates[k]}" onchange="RCHAuction.set('rates.${k}',this.value,'num')"></label>`;
        return `
        ${srcRow('twitch', 'Twitch', `<div class="channel-input-group"><input type="text" class="js-channel-input" id="auChannel" placeholder="${esc(t('streamer.channel_placeholder'))}" value="${esc(S.channelName)}" oninput="updateChannelName(this.value)" onkeypress="if(event.key==='Enter')twitchToggleConnect('auChannel')" autocomplete="off">
            <button class="cyber-btn add-btn js-twitch-btn" onclick="twitchToggleConnect('auChannel')"></button></div>
          <div class="conn-status js-twitch-status idle"></div>
          <div class="rates">${num('bit', t('au.rate_bit'))}${num('sub1', t('au.rate_sub') + ' T1')}${num('sub2', 'T2')}${num('sub3', 'T3')}${num('points', t('au.rate_points'))}</div>
          <label class="mini-field wide"><span>${esc(t('au.reward_id'))}</span><input type="text" id="auRewardId" value="${esc(A.rewardId)}" placeholder="xxxxxxxx-xxxx-…" onchange="RCHAuction.set('rewardId',this.value.trim())"></label>
          <div id="auRewards">${rewardsHtml()}</div>
          <p class="muted small">${esc(t('au.twitch_hint'))}</p>`)}
        ${srcRow('streamlabs', 'Streamlabs', `<div class="channel-input-group"><input type="password" autocomplete="off" placeholder="${esc(t('au.sl_token_ph'))}" value="${esc(S.slToken)}" onchange="setSlToken(this.value)">
            <button class="cyber-btn add-btn js-integ-btn" data-svc="streamlabs" onclick="slToggle()"></button></div>
          <p class="muted small">${esc(t('au.sl_hint'))}</p>`)}
        ${srcRow('donationalerts', 'DonationAlerts', `<div class="channel-input-group"><input type="password" autocomplete="off" placeholder="${esc(t('au.da_token_ph'))}" value="${esc(S.daToken)}" onchange="setDaToken(this.value)">
            <button class="cyber-btn add-btn js-integ-btn" data-svc="donationalerts" onclick="daToggle()"></button></div>
          <div class="channel-input-group"><input type="text" inputmode="numeric" placeholder="${esc(t('au.da_client_ph'))}" value="${esc(S.daClientId)}" onchange="setDaClientId(this.value)">
            <button class="cyber-btn" onclick="daAuthorize()">${esc(t('au.da_authorize'))}</button></div>
          <p class="muted small">${esc(t('au.da_hint', { url: location.origin + location.pathname }))}</p>`)}
        <div class="rates">${num('donation', t('au.rate_donation'))}</div>
        <p class="muted small">${bi('shield-lock')} ${esc(t('au.secret_hint'))}</p>`;
    }
    function settingsHtml() {
        const n = (k, label, val, step) => `<label class="mini-field"><span>${esc(label)}</span><input type="number" min="0" step="${step || 'any'}" value="${val}" onchange="RCHAuction.set('${k}',this.value,'num')"></label>`;
        const sel = (k, label, opts, cur) => `<label class="mini-field wide"><span>${esc(label)}</span><select onchange="RCHAuction.set('${k}',this.value)">${opts.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
        return `<div class="au-grid">
          ${sel('finishMode', t('au.f_finish'), [['manual', t('pa.finish_manual')], ['top', t('au.finish_top')], ['wheel', t('pa.finish_wheel')]], A.finishMode)}
          ${n('durationSec', t('au.f_duration'), A.durationSec, 10)}
          <label class="mini-field"><span>${esc(t('au.f_currency'))}</span><input type="text" maxlength="6" value="${esc(A.currency)}" onchange="RCHAuction.set('currency',this.value.trim())"></label>
          ${n('minBid', t('au.f_min'), A.minBid)}${n('maxLots', t('au.f_maxlots'), A.maxLots, 1)}
          ${n('antiSnipeWindow', t('au.f_snipe_window'), A.antiSnipeWindow, 1)}${n('antiSnipeExtend', t('au.f_snipe_extend'), A.antiSnipeExtend, 1)}
        </div>
        <label class="check-row"><input type="checkbox" ${A.autoCreate ? 'checked' : ''} onchange="RCHAuction.set('autoCreate',this.checked,'bool')"> ${esc(t('au.f_autocreate'))}</label>
        <label class="check-row"><input type="checkbox" ${A.fuzzy ? 'checked' : ''} onchange="RCHAuction.set('fuzzy',this.checked,'bool')"> ${esc(t('pa.fuzzy'))}</label>`;
    }

    const PANES = ['lots', 'wheel', 'bids'];
    let pane = 'lots';
    function renderTab() {
        const anySource = ['streamlabs', 'donationalerts'].some(s => streamerState.integ[s].status === 'connected') || streamerState.twitchStatus === 'connected';
        const { sum } = computed();
        return `<div class="auction-panel pa" id="auRoot" data-pane="${pane}">
          <section class="pa-top">
            <div class="pa-top-main">
              <input type="text" class="au-title" id="auTitle" placeholder="${esc(t('au.title_ph'))}" value="${esc(A.title)}" maxlength="80" oninput="RCHAuction.set('title',this.value)">
              <div class="pa-meta"><span class="au-pill ${A.status}" id="auPill">${esc(t('au.status_' + A.status))}</span>
                <span class="pa-stat" title="${esc(t('au.pool'))}">${ic('cash-stack')} <b id="auSum">${fmt(sum)} ${esc(A.currency)}</b></span>
                <span class="pa-stat" title="${esc(t('au.lots'))}">${ic('layers-fill')} <b id="auCount">${A.lots.length}</b></span></div>
            </div>
            <div class="au-clock" id="auClock">${clock(remaining())}</div>
            <div class="pa-controls" id="auControls">${controlsHtml()}</div>
          </section>
          <div id="auWinner">${winnerHtml()}</div>
          <nav class="pa-seg" role="tablist">${PANES.map(p => `<button role="tab" class="${pane === p ? 'on' : ''}" data-au="pane" data-v="${p}" aria-selected="${pane === p}">${ic({ lots: 'list-stars', wheel: 'pie-chart-fill', bids: 'receipt' }[p])}<span>${esc(t('pa.tab_' + p))}</span>${p === 'bids' && A.unassigned.length ? `<em class="pa-dot" id="auDot">${A.unassigned.length}</em>` : (p === 'lots' ? `<em class="pa-cnt" id="auCnt">${A.lots.length}</em>` : '')}</button>`).join('')}</nav>
          <div class="pa-grid">
            <section class="pa-pane pa-lots" data-pane-id="lots"><div class="pa-card">
              <div class="pa-addrow"><input type="text" id="auNewLot" maxlength="60" placeholder="${esc(t('au.lot_ph'))}" data-au-enter="addlot" autocomplete="off">
                <input type="number" id="auNewAmount" min="0" step="any" inputmode="decimal" placeholder="${esc(t('pa.amount_ph'))}" data-au-enter="addlot">
                <button class="cyber-btn add-btn" data-au="addlot"><span>${esc(t('common.add'))}</span></button></div>
              ${toolbarHtml()}
              <div class="pa-lotlist${A.compact ? ' compact' : ''}" id="auLots">${lotsHtml()}</div>
              <p class="muted small pa-howto">${ic('info-circle')} ${esc(t('au.how_to_bid'))}</p>
            </div></section>
            <div class="pa-side">
              <div class="pa-pane pa-wheel" data-pane-id="wheel" id="auWheelCard">${wheelHtml()}</div>
              <section class="pa-pane pa-bids" data-pane-id="bids">
                <div id="auUnassigned">${pendingHtml()}</div>
                <div class="pa-card"><h3>${ic('receipt')} ${esc(t('au.feed'))}</h3><div id="auFeedBox">${feedHtml()}</div>
                  <div class="pa-actions"><button class="cyber-btn" data-au="copychat">${ic('clipboard')} ${esc(t('au.copy_chat'))}</button><button class="cyber-btn" data-au="test">${ic('beaker')} ${esc(t('au.test_bid'))}</button></div></div>
              </section>
            </div>
          </div>
          <details class="pa-card pa-fold" ${anySource ? '' : 'open'}><summary><h3>${ic('plug-fill')} ${esc(t('au.sources'))}</h3></summary>${sourcesHtml()}</details>
          <details class="pa-card pa-fold"><summary><h3>${ic('sliders')} ${esc(t('au.settings'))}</h3></summary>${settingsHtml()}</details>
          <details class="pa-card pa-fold"><summary><h3>${ic('display')} ${esc(t('au.overlay'))}</h3></summary>
            <p class="muted small">${esc(t('au.overlay_hint'))}</p>
            <div class="overlay-url-box"><input type="text" readonly id="auOverlayUrl" value="${esc(getOverlayUrl('auction'))}" onfocus="this.select()"><button class="cyber-btn primary-btn" data-au="copyurl">${ic('clipboard')} ${esc(t('st.copy'))}</button></div></details>
        </div>`;
    }

    // live (partial) refresh — keeps focus, open <details> and the wheel animation intact
    let editing = false;
    function refreshLive() {
        const l = $('auLots'); if (l && !editing) l.innerHTML = lotsHtml();
        const f = $('auFeedBox'); if (f) f.innerHTML = feedHtml();
        const s = $('auSum'); if (s) s.textContent = fmt(computed().sum) + ' ' + A.currency;
        const c = $('auCount'); if (c) c.textContent = A.lots.length;
        const cn = $('auCnt'); if (cn) cn.textContent = A.lots.length;
        const u = $('auUnassigned'); if (u) u.innerHTML = pendingHtml();
        const d = $('auDot'); if (d) { d.textContent = A.unassigned.length; d.hidden = !A.unassigned.length; }
        const rw = $('auRewards'); if (rw) rw.innerHTML = rewardsHtml();
        if (!spinning) { const wc = $('auWheelCard'); if (wc && !wc.contains(document.activeElement)) wc.innerHTML = wheelHtml(); drawWheel(); }
        renderWinner();
    }
    function afterRender() {
        _updateConnectBtn(); refreshConnChips();
        ['streamlabs', 'donationalerts'].forEach(s => _setInteg(s, streamerState.integ[s].status, streamerState.integ[s].detail));
        drawWheel();
    }
    function render() {
        if (currentTab !== 'auction') { publishSoon(); return; }
        const c = $('tabContent'); if (!c) return;
        const active = document.activeElement;
        if (active && (active.id === 'auTitle' || active.classList.contains('pa-inline'))) return; // never rebuild while typing
        if (spinning) { refreshLive(); const ctr = $('auControls'); if (ctr) ctr.innerHTML = controlsHtml(); return; }
        const open = [...c.querySelectorAll('details')].map(d => d.open);
        const sy = window.scrollY;
        c.innerHTML = renderTab();
        c.querySelectorAll('details').forEach((d, i) => { if (open[i] !== undefined) d.open = open[i]; });
        afterRender(); window.scrollTo(0, sy);
    }

    // ── inline editing + lot picker ──────────────────────
    function inlineEdit(el, value, numeric, commit) {
        if (editing) return;
        editing = true;
        const input = document.createElement('input');
        input.className = 'pa-inline'; input.value = value;
        if (numeric) { input.type = 'number'; input.min = '0'; input.step = 'any'; input.inputMode = 'decimal'; } else { input.type = 'text'; input.maxLength = 60; }
        el.textContent = ''; el.appendChild(input);
        const done = ok => { if (!editing) return; editing = false; const v = input.value; if (ok) commit(v); else refreshLive(); };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') done(false); });
        input.addEventListener('blur', () => done(true));
        input.focus(); input.select();
    }
    function pickLot(title, excludeId, cb) {
        let m = $('auPick');
        if (!m) {
            m = document.createElement('div'); m.id = 'auPick'; m.className = 'modal hidden';
            m.innerHTML = '<div class="modal-content"><h3 id="auPickTitle"></h3><div class="pa-pick" id="auPickList"></div><div class="modal-actions"><button class="cyber-btn cancel-btn" id="auPickCancel"></button></div></div>';
            document.body.appendChild(m);
            m.addEventListener('click', e => { if (e.target === m || e.target.id === 'auPickCancel') m.classList.add('hidden'); });
        }
        $('auPickTitle').textContent = title; $('auPickCancel').textContent = t('common.cancel');
        const list = A.lots.filter(l => l.id !== excludeId);
        $('auPickList').innerHTML = list.length ? list.map(l => `<button class="pa-pick-item" data-pick="${l.id}" style="--c:${esc(l.color)}"><i></i><span>#${l.num} ${esc(l.name)}</span><b>${fmt(l.amount)}</b></button>`).join('') : `<div class="muted small">${esc(t('au.empty_lots'))}</div>`;
        $('auPickList').onclick = e => { const b = e.target.closest('[data-pick]'); if (!b) return; m.classList.add('hidden'); cb(b.dataset.pick); };
        m.classList.remove('hidden');
    }

    // ── event delegation (survives re-renders) ───────────
    const ACT = {
        start, pause, finish, reset, spin: spinWheel, test: testBid, copychat: copyChatText,
        addlot: addLotUI, toroulette: toRoulette, addgame: addAsGame, wdone: winnerDone, wclose: winnerClose,
        restoreall: () => restoreOut(), clearempty: clearEmpty,
        pickleader: () => { const { leader } = computed(); if (leader) declareWinner(leader.lot); },
        gowheel: () => { pane = 'wheel'; render(); setTimeout(spinWheel, 150); },
        autodrop: () => { autoDrop = true; spinWheel(); },
        sort: () => set('sort', A.sort === 'amount' ? 'added' : 'amount'),
        compact: () => { set('compact', !A.compact); const l = $('auLots'); if (l) l.classList.toggle('compact', A.compact); render(); },
        copyurl: () => navigator.clipboard.writeText($('auOverlayUrl').value).then(() => toast(t('streamer.url_copied'), 'success')).catch(() => { }),
    };
    document.addEventListener('click', e => {
        const el = e.target.closest('[data-au]'); if (!el || !el.closest('#auRoot')) return;
        const a = el.dataset.au, id = el.dataset.id, v = el.dataset.v;
        if (ACT[a]) return ACT[a](el);
        switch (a) {
            case 'inc': return adjust(id, A.step);
            case 'dec': return adjust(id, -A.step);
            case 'pin': return togglePin(id);
            case 'del': return delLot(id);
            case 'merge': { const l = lotById(id); return l && pickLot(t('pa.merge_pick', { name: l.name }), id, dst => merge(id, dst)); }
            case 'rename': { const l = lotById(id); return l && inlineEdit(el, l.name, false, val => rename(id, val)); }
            case 'amount': { const l = lotById(id); return l && inlineEdit(el, l.amount, true, val => setAmount(id, val)); }
            case 'undo': return undoBid(id);
            case 'dismiss': return dismiss(id);
            case 'newlot': return newLotFromPending(id);
            case 'step': A.step = +v; save(); return render();
            case 'time': return addTime(+el.dataset.sec);
            case 'pane': pane = PANES.includes(v) ? v : 'lots'; { const r = $('auRoot'); if (r) r.dataset.pane = pane; document.querySelectorAll('.pa-seg button').forEach(b => { b.classList.toggle('on', b.dataset.v === pane); b.setAttribute('aria-selected', b.dataset.v === pane); }); drawWheel(); } return;
            case 'wmode': return setWheelMode(v);
            case 'restoreone': return restoreOut(id);
        }
    });
    document.addEventListener('change', e => {
        const s = e.target.closest('[data-au-assign]'); if (s && s.value) assign(s.dataset.auAssign, s.value);
    });
    document.addEventListener('keydown', e => {
        const el = e.target.closest && e.target.closest('[data-au-enter]');
        if (el && e.key === 'Enter') { e.preventDefault(); ACT[el.dataset.auEnter](); }
        if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('pa-lot-title')) e.target.click();
    });

    window.renderAuctionTab = renderTab;
    window.afterAuctionRender = afterRender;
    window.addEventListener('rch:iconsready', () => { drawWheel(); });
    window.RCHAuction = {
        onDonation, onChat, onTwitchNotice, matchLot, state: () => A, computed,
        start, pause, finish, reset, addTime, addLotUI, delLot, assign, dismiss, undoBid, testBid,
        set, copyChatText, pickReward, toRoulette, addAsGame, render, addBid, spinWheel, merge, adjust,
    };
    document.addEventListener('DOMContentLoaded', () => setTimeout(publishNow, 500));
})();
