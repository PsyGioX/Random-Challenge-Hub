// ============================================================
// RCH Activity module — streamer toolbox built on top of the Twitch chat:
//   · chat analytics (msg/min, peak, sparkline, top chatters / words / emotes)
//   · hype & dead-chat alerts
//   · live event feed (subs, gifts, raids, bits, donations, results)
//   · chat giveaway (keyword entries, filters, animated draw, re-roll)
//   · stream goal (donations / subs / chatters / messages / manual)
//   · stream markers → chapter timestamps (Alt+M or !mark)
//   · recurring streamer reminders
//   · chat filter / search and per-viewer card
// Everything stays in the browser (localStorage key "rchActivity").
// ============================================================
(function (g) {
    'use strict';

    const KEY = 'rchActivity';
    const $ = id => document.getElementById(id);
    const tr = (k, v) => t(k, v);
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const DEFAULT_BOTS = 'nightbot, streamelements, streamlabs, moobot, fossabot, wizebot, soundalerts, sery_bot';

    const STOP = new Set(('the and for you that this with have are was but not your just what from they there them then than will would could ' +
        'about into like it\'s i\'m don\'t that\'s lol omg ' +
        'это как что так уже или для при все его еще ещё тоже только если когда меня тебя тебе мне нас вас них этот эта эти нет вот там тут чем чтобы без про был была были будет есть ' +
        'але чи що це цей яка який його вони вже тільки якщо коли мене нам вам').split(/\s+/));

    // ── state ────────────────────────────────────────────────
    const DEF = () => ({
        hypeOn: true, hypeAt: 30, idleOn: true, idleMin: 5, alertSound: true, bots: DEFAULT_BOTS,
        peak: 0, peakAt: 0, newChatters: 0, buckets: [], words: {}, emotes: {},
        feed: [], feedFilter: 'all', cnt: { subs: 0, gifts: 0, bits: 0, raids: 0, don: {} },
        markers: [], streamStart: 0,
        gw: { open: false, keyword: '!raffle', subsOnly: false, minMsgs: 0, excludeMods: true, winnersCount: 1, durationSec: 0, endsAt: 0, entrants: [], winners: [], history: [] },
        goal: { title: '', type: 'manual', target: 100, current: 0, base: 0, currency: '', reached: false },
        reminders: [],
        filter: { mode: 'all', hideCmds: false, q: '' },
    });
    let A = DEF();
    const recent = [];            // message timestamps of the last 60 s (not persisted)
    let lastHype = 0, idleFired = false, lastMsgAt = 0, tickN = 0, drawing = false, lastMystery = {};

    function load() {
        try {
            const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!d) return;
            const base = DEF();
            Object.keys(base).forEach(k => {
                if (d[k] === undefined) return;
                A[k] = (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) ? Object.assign(base[k], d[k]) : d[k];
            });
            A.cnt.don = A.cnt.don || {};
            if (A.gw.open && A.gw.endsAt && Date.now() >= A.gw.endsAt) A.gw.open = false;
            A.reminders.forEach(r => { if (r.nextAt < Date.now()) r.nextAt = Date.now() + r.every * 60000; });
        } catch (e) { console.warn('[activity] load failed', e); }
    }
    let _st = null;
    function save() { clearTimeout(_st); _st = setTimeout(saveNow, 600); }
    function saveNow() {
        const o = Object.assign({}, A);
        o.buckets = A.buckets.slice(-180);
        o.words = top(A.words, 150, true); o.emotes = top(A.emotes, 50, true);
        o.feed = A.feed.slice(0, 150);
        try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { }
    }
    g.addEventListener('beforeunload', saveNow);
    function top(obj, n, asObj) {
        const arr = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
        return asObj ? Object.fromEntries(arr) : arr;
    }

    // ── helpers ──────────────────────────────────────────────
    const botSet = () => new Set(String(A.bots || '').toLowerCase().split(/[\s,;]+/).filter(Boolean));
    const isBot = login => botSet().has(String(login || '').toLowerCase());
    function rnd(n) { const a = new Uint32Array(1); (g.crypto || window.crypto).getRandomValues(a); return Math.floor(a[0] / 4294967296 * n); }
    function pickN(arr, n) { const a = arr.slice(), out = []; for (let i = 0; i < n && a.length; i++) out.push(a.splice(rnd(a.length), 1)[0]); return out; }
    const fmtNum = n => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const hhmm = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    function clock(sec) {
        sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60, p = n => String(n).padStart(2, '0');
        return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
    }
    const sessionStart = () => A.streamStart || (streamerState && streamerState.sessionStartTime) || Date.now();
    function download(name, text, type) {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    function copy(text, okKey) {
        navigator.clipboard.writeText(text).then(() => showNotification(tr(okKey), 'success')).catch(() => showNotification(tr('notif.copy_error'), 'error'));
    }
    function beep() { try { if (A.alertSound) playChatNotificationSound(true); } catch (e) { } }

    // ── event feed ───────────────────────────────────────────
    const ICON = { sub: 'star-fill', gift: 'gift-fill', raid: 'people-fill', bits: 'gem', donation: 'cash-coin', vote: 'check2-square', wheel: 'heart-fill', spin: 'dice-5-fill',
        auction: 'hammer', giveaway: 'trophy-fill', goal: 'flag-fill', marker: 'bookmark-star-fill', first: 'person-plus-fill', hype: 'fire', idle: 'moon-stars-fill' };
    const GROUP = { money: ['sub', 'gift', 'bits', 'raid', 'donation'], game: ['vote', 'wheel', 'spin', 'giveaway', 'auction', 'goal'], chat: ['first', 'hype', 'idle', 'marker'] };
    let _feedT = null;
    function log(kind, text) {
        A.feed.unshift({ ts: Date.now(), kind, text: String(text).slice(0, 200) });
        if (A.feed.length > 150) A.feed.length = 150;
        save();
        if (!_feedT) _feedT = setTimeout(() => { _feedT = null; refreshFeed(); }, 250);
    }
    function feedHtml() {
        const f = A.feedFilter, list = A.feed.filter(e => f === 'all' || (GROUP[f] || []).includes(e.kind)).slice(0, 60);
        if (!list.length) return `<div class="muted small">${esc(tr('act.feed_empty'))}</div>`;
        return list.map(e => `<div class="act-ev k-${esc(e.kind)}"><span class="act-ev-ic">${bi(ICON[e.kind] || 'dot')}</span><span class="act-ev-text">${esc(e.text)}</span><span class="act-ev-time">${hhmm(e.ts)}</span></div>`).join('');
    }
    function countersHtml() {
        const c = A.cnt, don = Object.entries(c.don).map(([cur, v]) => `${fmtNum(v)} ${esc(cur || '')}`.trim()).join(' · ') || '0';
        const chip = (ic, label, val) => `<span class="act-chip">${bi(ic)} ${esc(label)} <b>${val}</b></span>`;
        return chip('star-fill', tr('act.cnt_subs'), c.subs) + chip('gift-fill', tr('act.cnt_gifts'), c.gifts) + chip('gem', tr('act.cnt_bits'), fmtNum(c.bits)) +
            chip('people-fill', tr('act.cnt_raids'), c.raids) + chip('cash-coin', tr('act.cnt_don'), don);
    }
    function refreshFeed() {
        const l = $('actFeedList'); if (l) l.innerHTML = feedHtml();
        const c = $('actCounters'); if (c) c.innerHTML = countersHtml();
    }

    // ── incoming events ──────────────────────────────────────
    function onChat(ev) {
        const now = Date.now(), login = ev.user;
        if (ev.bits > 0) {
            A.cnt.bits += ev.bits; log('bits', tr('act.ev_bits', { name: ev.name, n: ev.bits }));
        }
        gwEntry(ev);
        if (isBot(login)) return;
        lastMsgAt = now; idleFired = false;
        recent.push(now);
        const m = Math.floor(now / 60000), lb = A.buckets[A.buckets.length - 1];
        if (lb && lb.m === m) lb.n++; else { A.buckets.push({ m, n: 1 }); if (A.buckets.length > 180) A.buckets.shift(); }
        if (!streamerState.userActivity[login]) A.newChatters++;
        if (ev.firstMsg) log('first', tr('act.ev_first', { name: ev.name }));
        countWords(ev);
        save();
    }
    function countWords(ev) {
        const text = ev.text || '';
        if (text[0] === '!') return;
        const emoteNames = new Set();
        if (ev.emotes && !ev.action) {
            ev.emotes.split('/').forEach(part => {
                const [, ranges] = part.split(':'); if (!ranges) return;
                const [s, e] = ranges.split(',')[0].split('-').map(Number);
                const name = text.slice(s, e + 1); if (!name) return;
                emoteNames.add(name.toLowerCase()); A.emotes[name] = (A.emotes[name] || 0) + ranges.split(',').length;
            });
        }
        const ws = text.toLowerCase().match(/[\p{L}\p{N}_']{3,20}/gu) || [];
        ws.forEach(w => { if (STOP.has(w) || emoteNames.has(w) || /^\d+$/.test(w)) return; A.words[w] = (A.words[w] || 0) + 1; });
        if (Object.keys(A.words).length > 600) Object.keys(A.words).forEach(k => { if (A.words[k] <= 1) delete A.words[k]; });
    }
    function onNotice(ev) {
        const n = ev.name || ev.user;
        switch (ev.type) {
            case 'sub': A.cnt.subs++; log('sub', tr('act.ev_sub', { name: n })); goalAdd('subs', 1); break;
            case 'resub': A.cnt.subs++; log('sub', tr('act.ev_resub', { name: n, n: ev.months || 1 })); goalAdd('subs', 1); break;
            case 'subgift': case 'anonsubgift':
                A.cnt.gifts++; goalAdd('subs', 1);
                if (!lastMystery[n] || Date.now() - lastMystery[n] > 15000) log('gift', tr('act.ev_gift', { name: n, to: ev.recipient || '?' }));
                break;
            case 'submysterygift': lastMystery[n] = Date.now(); log('gift', tr('act.ev_mystery', { name: n, n: ev.gifts || 1 })); break;
            case 'raid': A.cnt.raids++; log('raid', tr('act.ev_raid', { name: n, n: ev.viewers || 0 })); break;
        }
        save();
    }
    function onDonation(d) {
        const cur = String(d.currency || '').toUpperCase(), amt = Number(d.amount) || 0;
        A.cnt.don[cur] = (A.cnt.don[cur] || 0) + amt;
        log('donation', tr('act.ev_don', { name: d.user, amount: fmtNum(amt), cur }));
        if (A.goal.type === 'donations' && (!A.goal.currency || A.goal.currency.toUpperCase() === cur)) goalAdd('donations', amt);
        save();
    }

    // ── tick ─────────────────────────────────────────────────
    function level(rate) {
        const T = Math.max(1, A.hypeAt);
        if (rate <= 0) return ['idle', 'act.level_idle']; if (rate < T * 0.25) return ['calm', 'act.level_calm'];
        if (rate < T * 0.6) return ['active', 'act.level_active']; if (rate < T) return ['hot', 'act.level_hot']; return ['fire', 'act.level_fire'];
    }
    function tick() {
        const now = Date.now();
        while (recent.length && now - recent[0] > 60000) recent.shift();
        const rate = recent.length, S = streamerState;
        if (rate > A.peak) { A.peak = rate; A.peakAt = now; save(); }
        const connected = S.twitchStatus === 'connected';
        if (A.hypeOn && connected && rate >= A.hypeAt && now - lastHype > 180000) {
            lastHype = now; beep(); showNotification(tr('act.hype_alert', { n: rate }), 'success'); log('hype', tr('act.ev_hype', { n: rate }));
        }
        if (connected) {
            if (!lastMsgAt) lastMsgAt = now;
            if (A.idleOn && !idleFired && now - lastMsgAt >= A.idleMin * 60000) {
                idleFired = true; beep(); showNotification(tr('act.idle_alert', { n: A.idleMin }), 'warning'); log('idle', tr('act.ev_idle', { n: A.idleMin }));
            }
        } else { lastMsgAt = 0; idleFired = false; }
        if (A.gw.open && A.gw.endsAt && now >= A.gw.endsAt) gwClose(true);
        A.reminders.forEach(r => {
            if (r.on && now >= r.nextAt) { r.nextAt = now + r.every * 60000; beep(); showNotification(tr('act.rm_due', { label: r.label }), 'warning'); save(); }
        });
        checkGoal();
        if ($('actKpis')) updateKpis(rate);
        if (tickN % 3 === 0) refreshBoards();
        if (tickN % 5 === 0) drawSpark();
        updateGwTimer(); updateGoalUi(); updateReminderUi();
        tickN++;
    }
    setInterval(tick, 1000);

    // ── dashboard UI ─────────────────────────────────────────
    function avg10() {
        const nowM = Math.floor(Date.now() / 60000); let sum = 0;
        A.buckets.forEach(b => { if (b.m < nowM && b.m >= nowM - 10) sum += b.n; });
        return Math.round(sum / 10 * 10) / 10;
    }
    function chatterCount() { const bots = botSet(); return Object.keys(streamerState.userActivity || {}).filter(l => !bots.has(l)).length; }
    function updateKpis(rate) {
        const S = streamerState, set = (id, v) => { const e = $(id); if (e && e.textContent !== String(v)) e.textContent = v; };
        set('kRate', rate); set('kPeak', A.peak); set('kAvg', avg10()); set('kChat', chatterCount()); set('kNew', A.newChatters); set('kTotal', fmtNum(S.chatStats.totalMessages || 0));
        const [cls, key] = level(rate), lv = $('kLevel');
        if (lv) { lv.className = 'act-level ' + cls; lv.innerHTML = bi(cls === 'fire' ? 'fire' : cls === 'idle' ? 'moon-stars-fill' : 'activity') + ' ' + esc(tr(key)); }
    }
    function drawSpark() {
        const c = $('actSpark'); if (!c) return;
        const dpr = g.devicePixelRatio || 1, w = c.clientWidth || 320, h = 72;
        if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
        const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
        const nowM = Math.floor(Date.now() / 60000), N = 30, vals = [];
        for (let i = N - 1; i >= 0; i--) { const b = A.buckets.find(q => q.m === nowM - i); vals.push(b ? b.n : 0); }
        const max = Math.max(5, A.hypeOn ? A.hypeAt : 0, ...vals), cs = getComputedStyle(document.documentElement);
        const col = cs.getPropertyValue('--accent-primary').trim() || '#818cf8', warn = cs.getPropertyValue('--accent-warning').trim() || '#fbbf24';
        const bw = w / N;
        vals.forEach((v, i) => {
            const bh = Math.max(v ? 2 : 1, Math.round(v / max * (h - 8)));
            x.globalAlpha = i === N - 1 ? 1 : (v ? 0.8 : 0.25); x.fillStyle = v >= A.hypeAt && A.hypeOn ? warn : col;
            x.fillRect(i * bw + 1, h - bh - 1, Math.max(1, bw - 2), bh);
        });
        if (A.hypeOn) {
            const y = h - 1 - A.hypeAt / max * (h - 8); x.globalAlpha = 0.6; x.strokeStyle = warn; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); x.setLineDash([]);
        }
        x.globalAlpha = 1;
    }
    function boardsData() {
        const bots = botSet();
        const chatters = Object.entries(streamerState.userActivity || {}).filter(([l]) => !bots.has(l)).sort((a, b) => b[1].messages - a[1].messages).slice(0, 10);
        return chatters;
    }
    function refreshBoards() {
        const lb = $('actLb'); if (!lb) return;
        const rows = boardsData();
        if (!rows.length) lb.innerHTML = `<div class="muted small">${esc(tr('act.no_data'))}</div>`;
        else {
            const max = rows[0][1].messages || 1;
            lb.innerHTML = rows.map(([login, d], i) => `<div class="act-lb-row"><span class="act-rank">${i + 1}</span>
              <button type="button" class="act-lb-name" data-ac="user" data-u="${esc(login)}">${esc(d.name || login)}${d.isMod ? ' ' + bi('shield-fill') : d.isSub ? ' ' + bi('star-fill') : ''}</button>
              <span class="act-lb-bar"><i style="width:${Math.round(d.messages / max * 100)}%"></i></span><b class="act-lb-n">${d.messages}</b>
              <button type="button" class="act-mini" data-ac="towheel" data-u="${esc(d.name || login)}" title="${esc(tr('act.uc_add_wheel'))}">${bi('plus-lg')}</button></div>`).join('');
        }
        const w = $('actWords'); if (w) { const tw = top(A.words, 14); w.innerHTML = tw.length ? tw.map(([k, v]) => `<span class="act-chip">${esc(k)} <b>${v}</b></span>`).join('') : `<span class="muted small">${esc(tr('act.no_data'))}</span>`; }
        const em = $('actEmotes'); if (em) { const te = top(A.emotes, 10); em.innerHTML = te.length ? te.map(([k, v]) => `<span class="act-chip">${esc(k)} <b>${v}</b></span>`).join('') : `<span class="muted small">${esc(tr('act.no_data'))}</span>`; }
    }

    // ── giveaway ─────────────────────────────────────────────
    const G = () => A.gw;
    function gwEntry(ev) {
        const gw = G(); if (!gw.open) return;
        const kw = String(gw.keyword || '').trim().toLowerCase(); if (!kw) return;
        const txt = (ev.text || '').trim().toLowerCase();
        if (txt !== kw && txt.indexOf(kw + ' ') !== 0) return;
        if (isBot(ev.user)) return;
        if (gw.excludeMods && ev.isMod) return;
        if (gw.subsOnly && !ev.isSub) return;
        if (gw.minMsgs > 0 && ((streamerState.userActivity[ev.user] || {}).messages || 0) < gw.minMsgs) return;
        if (gw.entrants.some(e => e.login === ev.user)) return;
        gw.entrants.push({ login: ev.user, name: ev.name, ts: Date.now() });
        save(); softGw();
    }
    let _gwT = null;
    function softGw() { if (_gwT) return; _gwT = setTimeout(() => { _gwT = null; refreshGwDyn(); }, 300); }
    function gwOpen() {
        const gw = G();
        if (!String(gw.keyword || '').trim()) return showNotification(tr('act.gw_need_kw'), 'warning');
        gw.open = true; gw.entrants = []; gw.winners = []; gw.endsAt = gw.durationSec > 0 ? Date.now() + gw.durationSec * 1000 : 0;
        showNotification(tr('act.gw_opened', { kw: gw.keyword }), 'success'); save(); refreshGwDyn();
    }
    function gwClose(auto) {
        const gw = G(); if (!gw.open) return;
        gw.open = false; gw.endsAt = 0;
        showNotification(tr('act.gw_closed', { n: gw.entrants.length }), auto ? 'warning' : 'info'); if (auto) beep(); save(); refreshGwDyn();
    }
    function gwDraw() {
        if (drawing) return;
        const gw = G(), pool = gw.entrants.filter(e => !gw.winners.some(w => w.login === e.login));
        if (!pool.length) return showNotification(tr(gw.entrants.length ? 'act.gw_pool_empty' : 'act.gw_no_entrants'), 'warning');
        if (gw.open) gwClose(true);
        const picked = pickN(pool, Math.min(Math.max(1, gw.winnersCount | 0), pool.length));
        drawing = true; let n = 0;
        const iv = setInterval(() => {
            const ban = $('gwBanner'); if (ban) ban.innerHTML = `<span class="winner-name">${bi('trophy-fill')} ${esc(pool[rnd(pool.length)].name)}</span>`;
            if (++n >= 24) { clearInterval(iv); done(); }
        }, 70);
        function done() {
            drawing = false;
            gw.winners.push(...picked);
            gw.history.unshift({ ts: Date.now(), kw: gw.keyword, names: picked.map(p => p.name), total: gw.entrants.length }); gw.history.length = Math.min(gw.history.length, 15);
            picked.forEach(p => log('giveaway', tr('act.ev_gw', { name: p.name })));
            showNotification(tr('act.gw_winner_toast', { name: picked.map(p => p.name).join(', ') }), 'success');
            playWinSound(); if (rouletteSettings.particleEffect) createParticles();
            save(); refreshGwDyn();
        }
    }
    function gwReroll(i) {
        const gw = G(), pool = gw.entrants.filter(e => !gw.winners.some(w => w.login === e.login));
        if (!pool.length || !gw.winners[i]) return showNotification(tr('act.gw_pool_empty'), 'warning');
        const w = pool[rnd(pool.length)]; gw.winners[i] = w; log('giveaway', tr('act.ev_gw', { name: w.name }));
        playWinSound(); save(); refreshGwDyn();
    }
    function gwToWheel() {
        let added = 0;
        G().entrants.forEach(e => { if (!_inWheel(e.name)) { streamerState.subWheelList.push(e.name); added++; } });
        saveStreamerData(); if (typeof refreshViewerCard === 'function') refreshViewerCard();
        showNotification(tr('act.gw_in_wheel', { n: added }), 'success');
    }
    function updateGwTimer() {
        const e = $('gwTimer'); if (!e) return; const gw = G();
        e.textContent = gw.open && gw.endsAt ? tr('act.gw_closes_in', { s: Math.max(0, Math.ceil((gw.endsAt - Date.now()) / 1000)) }) : '';
    }
    function gwDynHtml() {
        const gw = G(), shown = gw.entrants.slice(-40);
        return `<div class="act-gw-status ${gw.open ? 'open' : ''}"><span class="act-dot"></span><b>${esc(tr(gw.open ? 'act.gw_status_open' : 'act.gw_status_closed', { n: gw.entrants.length }))}</b> <span class="muted small" id="gwTimer"></span></div>
          <div class="streamer-tool-actions">
            ${gw.open ? `<button class="cyber-btn danger-btn" data-ac="gwclose">${bi('stop-fill')} ${esc(tr('act.gw_close'))}</button>` : `<button class="cyber-btn add-btn" data-ac="gwopen">${bi('play-fill')} ${esc(tr('act.gw_open'))}</button>`}
            <button class="cyber-btn spin-btn" data-ac="gwdraw" ${gw.entrants.length ? '' : 'disabled'}>${bi('trophy-fill')} ${esc(tr('act.gw_draw'))}</button>
            <button class="cyber-btn" data-ac="gwwheel" ${gw.entrants.length ? '' : 'disabled'}>${bi('heart-fill')} ${esc(tr('act.gw_to_wheel'))}</button>
            <button class="cyber-btn" data-ac="gwclear" ${gw.entrants.length || gw.winners.length ? '' : 'disabled'}>${bi('trash')} ${esc(tr('act.gw_clear'))}</button></div>
          <div class="viewer-banner" id="gwBanner" aria-live="polite">${gw.winners.length && !drawing ? gw.winners.map(w => `<span class="winner-name">${bi('trophy-fill')} ${esc(w.name)}</span>`).join('') : ''}</div>
          ${gw.winners.length ? `<div class="act-gw-winners">${gw.winners.map((w, i) => `<div class="act-gw-win"><b>${esc(w.name)}</b><button class="act-mini" data-ac="gwreroll" data-i="${i}" title="${esc(tr('act.gw_reroll'))}">${bi('arrow-repeat')}</button></div>`).join('')}
            <button class="cyber-btn" data-ac="gwcopy">${bi('clipboard-check')} ${esc(tr('act.gw_copy'))}</button></div>` : ''}
          <div class="muted small">${esc(tr('act.gw_entrants'))}</div>
          <div class="sub-list">${shown.length ? shown.map(e => `<span class="sub-tag" data-ac="gwrm" data-u="${esc(e.login)}" title="${esc(tr('act.gw_remove'))}">${esc(e.name)} ×</span>`).join('') + (gw.entrants.length > shown.length ? `<span class="muted small">+${gw.entrants.length - shown.length}</span>` : '') : `<span class="muted small">${esc(tr('act.gw_no_entrants'))}</span>`}</div>
          ${gw.history.length ? `<details class="act-fold"><summary>${esc(tr('act.gw_history'))}</summary>${gw.history.map(h => `<div class="muted small">${hhmm(h.ts)} · ${esc(h.kw)} · ${esc(h.names.join(', '))} (${h.total})</div>`).join('')}</details>` : ''}`;
    }
    function refreshGwDyn() { if (drawing) return; const e = $('gwDyn'); if (e) { e.innerHTML = gwDynHtml(); updateGwTimer(); } }
    function chatGiveaway(sub) {
        sub = String(sub || '').toLowerCase();
        if (sub === 'open' || sub === 'start') gwOpen(); else if (sub === 'close' || sub === 'stop') gwClose(); else if (sub === 'draw' || sub === 'pick') gwDraw();
    }

    // ── goal ─────────────────────────────────────────────────
    function goalCur() {
        const gl = A.goal, cs = streamerState.chatStats;
        if (gl.type === 'chatters') return Math.max(0, (cs.uniqueViewers || 0) - gl.base);
        if (gl.type === 'messages') return Math.max(0, (cs.totalMessages || 0) - gl.base);
        return gl.current;
    }
    function goalAdd(type, n) { if (A.goal.type === type) { A.goal.current += n; save(); checkGoal(); } }
    function checkGoal() {
        const gl = A.goal; if (gl.reached || !(gl.target > 0)) return;
        if (goalCur() >= gl.target) {
            gl.reached = true; save();
            const title = gl.title || tr('act.goal_default');
            showNotification(tr('act.goal_reached', { title }), 'success'); log('goal', tr('act.ev_goal', { title }));
            playWinSound(); if (rouletteSettings.particleEffect) createParticles();
        }
    }
    function updateGoalUi() {
        const bar = $('goalFill'); if (!bar) return;
        const gl = A.goal, cur = goalCur(), pct = gl.target > 0 ? Math.min(100, cur / gl.target * 100) : 0;
        bar.style.width = pct.toFixed(1) + '%';
        const tx = $('goalText'); if (tx) tx.textContent = `${fmtNum(cur)} / ${fmtNum(gl.target)}${gl.type === 'donations' && gl.currency ? ' ' + gl.currency.toUpperCase() : ''} · ${Math.floor(pct)}%`;
        const w = $('goalWrap'); if (w) w.classList.toggle('done', !!gl.reached);
    }
    function goalReset() {
        const gl = A.goal, cs = streamerState.chatStats;
        gl.current = 0; gl.reached = false; gl.base = gl.type === 'chatters' ? (cs.uniqueViewers || 0) : gl.type === 'messages' ? (cs.totalMessages || 0) : 0;
        save(); updateGoalUi();
    }
    function goalManual(n) { if (A.goal.type !== 'manual') return; A.goal.current = Math.max(0, A.goal.current + n); if (n < 0) A.goal.reached = false; save(); checkGoal(); updateGoalUi(); }

    // ── markers ──────────────────────────────────────────────
    function addMarker(label, by) {
        const ts = Date.now(), sec = (ts - sessionStart()) / 1000;
        label = String(label || '').replace(/\s+/g, ' ').trim().slice(0, 80) || tr('act.mk_default');
        A.markers.push({ id: uid(), ts, label, by: by || '' });
        if (A.markers.length > 200) A.markers.shift();
        log('marker', tr('act.ev_marker', { label: `${clock(sec)} ${label}` })); showNotification(tr('act.mk_added', { time: clock(sec) }), 'success');
        save(); refreshMarkers();
    }
    function markersHtml() {
        if (!A.markers.length) return `<div class="muted small">${esc(tr('act.mk_empty'))}</div>`;
        const st = sessionStart();
        return A.markers.slice().reverse().map(m => `<div class="act-mk"><b class="act-mk-t">${clock((m.ts - st) / 1000)}</b><span class="act-mk-l">${esc(m.label)}${m.by ? ` <span class="muted small">@${esc(m.by)}</span>` : ''}</span>
          <button class="act-mini" data-ac="mkdel" data-id="${esc(m.id)}" title="${esc(tr('common.delete'))}">${bi('x-lg')}</button></div>`).join('');
    }
    function refreshMarkers() { const e = $('actMarkers'); if (e) e.innerHTML = markersHtml(); }
    function chaptersText() {
        const st = sessionStart(), rows = A.markers.slice().sort((a, b) => a.ts - b.ts).map(m => ({ s: Math.max(0, Math.round((m.ts - st) / 1000)), l: m.label }));
        if (!rows.length || rows[0].s > 0) rows.unshift({ s: 0, l: tr('act.mk_start_label') });
        return rows.map(r => `${clock(r.s)} ${r.l}`).join('\n');
    }
    g.addEventListener('keydown', e => {
        if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyM' || e.key === 'm' || e.key === 'M')) { e.preventDefault(); addMarker(''); }
    });

    // ── reminders ────────────────────────────────────────────
    function addReminder(label, every) {
        label = String(label || '').trim().slice(0, 60); every = Math.round(Number(every));
        if (!label || !(every >= 1 && every <= 600)) return;
        A.reminders.push({ id: uid(), label, every, nextAt: Date.now() + every * 60000, on: true }); save(); refreshReminders();
    }
    function remindersHtml() {
        if (!A.reminders.length) return `<div class="muted small">${esc(tr('act.rm_empty'))}</div>`;
        return A.reminders.map(r => `<div class="act-rm ${r.on ? '' : 'off'}"><label class="check-row"><input type="checkbox" data-ac="rmtoggle" data-id="${esc(r.id)}" ${r.on ? 'checked' : ''}> <span>${esc(r.label)}</span></label>
          <span class="muted small">${esc(tr('act.rm_every_fmt', { n: r.every }))}</span><b class="act-rm-next" data-rm="${esc(r.id)}"></b>
          <button class="act-mini" data-ac="rmdel" data-id="${esc(r.id)}" title="${esc(tr('common.delete'))}">${bi('x-lg')}</button></div>`).join('');
    }
    function refreshReminders() { const e = $('actReminders'); if (e) { e.innerHTML = remindersHtml(); updateReminderUi(); } }
    function updateReminderUi() {
        document.querySelectorAll('.act-rm-next').forEach(el => {
            const r = A.reminders.find(x => x.id === el.dataset.rm); if (!r) return;
            el.textContent = r.on ? tr('act.rm_next', { t: clock((r.nextAt - Date.now()) / 1000) }) : tr('act.rm_off');
        });
    }

    // ── chat filter / viewer card ────────────────────────────
    function passFilter(m) {
        const f = A.filter;
        if (f.hideCmds && String(m.text || '')[0] === '!') return false;
        if (f.mode === 'subs' && !m.sub) return false;
        if (f.mode === 'mods' && !(m.mod || m.badge === 'broadcaster')) return false;
        if (f.mode === 'vip' && !m.vip) return false;
        const q = f.q.trim().toLowerCase();
        if (q && (m.text + ' ' + m.user).toLowerCase().indexOf(q) < 0) return false;
        return true;
    }
    function fmtText(text) {
        const q = A.filter.q.trim(); if (!q) return esc(text);
        const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
        return String(text).split(re).map((p, i) => i % 2 ? '<mark>' + esc(p) + '</mark>' : esc(p)).join('');
    }
    function filterActive() { const f = A.filter; return f.mode !== 'all' || f.hideCmds || !!f.q.trim(); }
    function toolbarHtml() {
        const f = A.filter, opt = (v, k) => `<option value="${v}" ${f.mode === v ? 'selected' : ''}>${esc(tr(k))}</option>`;
        return `<div class="act-chat-tools"><select data-set="filter.mode" data-rerender="chat" aria-label="${esc(tr('act.flt_all'))}">${opt('all', 'act.flt_all')}${opt('subs', 'act.flt_subs')}${opt('mods', 'act.flt_mods')}${opt('vip', 'act.flt_vip')}</select>
          <input type="search" data-set="filter.q" data-rerender="chat" value="${esc(f.q)}" placeholder="${esc(tr('act.flt_search'))}" maxlength="40" autocomplete="off">
          <label class="check-row"><input type="checkbox" data-set="filter.hideCmds" data-rerender="chat" ${f.hideCmds ? 'checked' : ''}> ${esc(tr('act.flt_hidecmd'))}</label></div>`;
    }
    function rerenderChat() {
        const cb = $('chatBox'); if (!cb || typeof renderChatMessages !== 'function') return;
        cb.innerHTML = renderChatMessages(); cb.scrollTop = cb.scrollHeight;
    }
    function openModal(title, html, okTxt, onOk) {
        const modal = $('confirmModal'); if (!modal) return;
        $('modalTitle').textContent = title; $('modalMessage').innerHTML = html;
        const b = $('modalConfirm'); b.textContent = okTxt; b.onclick = () => { if (onOk) onOk(); closeModal(); };
        const c = modal.querySelector('.cancel-btn'); if (c) { c.style.display = ''; c.textContent = tr('act.uc_close'); }
        modal.classList.remove('hidden');
    }
    function userCard(login) {
        const d = (streamerState.userActivity || {})[login]; if (!d) return;
        const name = d.name || login, rank = Object.entries(streamerState.userActivity).filter(([l]) => !isBot(l)).sort((a, b) => b[1].messages - a[1].messages).findIndex(([l]) => l === login) + 1;
        const row = (k, v) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`, inW = _inWheel(name);
        openModal(tr('act.uc_title', { name }), `<div class="kv-list">${row(tr('act.uc_messages'), d.messages)}${row(tr('act.uc_rank'), rank ? '#' + rank : '—')}
            ${row(tr('act.uc_role'), tr(d.isMod ? 'act.role_mod' : d.isSub ? 'act.role_sub' : 'act.role_viewer'))}${row(tr('act.uc_last'), hhmm(d.lastSeen))}
            ${row(tr('act.uc_in_wheel'), tr(inW ? 'act.yes' : 'act.no'))}${row(tr('act.uc_entered'), tr(G().entrants.some(e => e.login === login) ? 'act.yes' : 'act.no'))}</div>`,
            tr('act.uc_add_wheel'), () => { if (!inW) addSubToWheelFromChat(name); });
    }

    // ── session report / exports ─────────────────────────────
    function report() {
        const S = streamerState;
        return {
            peakPerMin: A.peak, peakAt: A.peak ? new Date(A.peakAt).toISOString() : null, newChatters: A.newChatters,
            topChatters: boardsData().map(([l, d]) => ({ user: d.name || l, messages: d.messages })),
            topWords: top(A.words, 15).map(([w, n]) => ({ word: w, count: n })), topEmotes: top(A.emotes, 10).map(([w, n]) => ({ emote: w, count: n })),
            counters: A.cnt, markers: A.markers.map(m => ({ time: clock((m.ts - sessionStart()) / 1000), label: m.label })),
            giveaways: A.gw.history, goal: A.goal, feed: A.feed.slice(0, 100), totals: S.chatStats,
        };
    }
    function summaryText() {
        const S = streamerState, cs = S.chatStats, dur = Math.round((Date.now() - (S.sessionStartTime || Date.now())) / 60000), L = [];
        L.push(tr('act.sum_title'));
        L.push(tr('act.sum_duration', { n: dur }));
        L.push(tr('act.sum_chat', { m: fmtNum(cs.totalMessages), c: chatterCount(), n: A.newChatters }));
        if (A.peak) L.push(tr('act.sum_peak', { n: A.peak, time: hhmm(A.peakAt) }));
        const tc = boardsData().slice(0, 3).map(([l, d]) => `${d.name || l} (${d.messages})`).join(', '); if (tc) L.push(tr('act.sum_top', { list: tc }));
        const c = A.cnt; L.push(tr('act.sum_money', { s: c.subs, g: c.gifts, b: fmtNum(c.bits), r: c.raids }));
        const don = Object.entries(c.don).map(([k, v]) => `${fmtNum(v)} ${k}`.trim()).join(', '); if (don) L.push(tr('act.sum_don', { list: don }));
        const ws = A.gw.history.slice(0, 3).flatMap(h => h.names); if (ws.length) L.push(tr('act.sum_gw', { list: ws.join(', ') }));
        if (A.markers.length) L.push(tr('act.sum_marks', { n: A.markers.length }));
        return L.join('\n');
    }
    function csvChat() {
        const q = v => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
        const rows = [['time', 'user', 'badge', 'message'].map(q).join(',')];
        (streamerState.chatMessages || []).forEach(m => rows.push([new Date(m.timestamp).toISOString(), m.user, m.badge, m.text].map(q).join(',')));
        download(`chat-${streamerState.channelName || 'session'}-${Date.now()}.csv`, '\ufeff' + rows.join('\r\n'), 'text/csv;charset=utf-8');
        showNotification(tr('act.csv_done'), 'success');
    }
    function statsHtml(row) {
        const c = A.cnt;
        return row(tr('act.kpi_peak'), `${A.peak} ${tr('act.rate_unit')}`) + row(tr('act.kpi_new'), A.newChatters) + row(tr('act.cnt_subs'), c.subs) + row(tr('act.cnt_gifts'), c.gifts) +
            row(tr('act.cnt_bits'), fmtNum(c.bits)) + row(tr('act.cnt_raids'), c.raids);
    }
    function resetChatStats() {
        A.buckets = []; A.peak = 0; A.peakAt = 0; A.newChatters = 0; A.words = {}; A.emotes = {}; recent.length = 0; A.goal.base = 0; save();
    }
    function resetSession() {
        resetChatStats(); A.feed = []; A.cnt = { subs: 0, gifts: 0, bits: 0, raids: 0, don: {} }; A.markers = []; A.streamStart = 0;
        if (A.goal.type !== 'manual' && A.goal.type !== 'donations' && A.goal.type !== 'subs') { A.goal.current = 0; A.goal.reached = false; }
        save();
    }

    // ── card rendering ───────────────────────────────────────
    function card(icon, title, desc, body, cls) {
        return `<section class="streamer-tool-card ${cls || ''}"><header class="streamer-tool-header"><span class="streamer-tool-icon">${bi(icon)}</span><div><h3 class="streamer-tool-title">${esc(title)}</h3><p class="streamer-tool-desc">${esc(desc)}</p></div></header>${body}</section>`;
    }
    const num = (path, v, min, max, w) => `<input type="number" data-set="${path}" value="${esc(v)}" min="${min}" max="${max}"${w ? ` style="max-width:${w}px"` : ''}>`;
    const chk = (path, v, label, extra) => `<label class="check-row"><input type="checkbox" data-set="${path}" ${v ? 'checked' : ''} ${extra || ''}> ${esc(label)}</label>`;

    function dashCard() {
        const kpi = (id, k) => `<div class="act-kpi"><b id="${id}">0</b><span>${esc(tr(k))}</span></div>`;
        return card('activity', tr('act.dash_title'), tr('act.dash_desc'), `
          <div class="act-kpis" id="actKpis">${kpi('kRate', 'act.rate_unit')}${kpi('kPeak', 'act.kpi_peak')}${kpi('kAvg', 'act.kpi_avg')}${kpi('kChat', 'act.kpi_chatters')}${kpi('kNew', 'act.kpi_new')}${kpi('kTotal', 'act.kpi_total')}</div>
          <div class="act-level idle" id="kLevel"></div>
          <div class="muted small">${esc(tr('act.spark_title'))}</div>
          <canvas id="actSpark" class="act-spark" height="72"></canvas>
          <div class="act-cols">
            <div><h4 class="act-h">${bi('trophy-fill')} ${esc(tr('act.top_chatters'))}</h4><div id="actLb" class="act-lb"></div></div>
            <div><h4 class="act-h">${bi('chat-quote-fill')} ${esc(tr('act.top_words'))}</h4><div id="actWords" class="act-chips"></div>
              <h4 class="act-h">${bi('emoji-smile-fill')} ${esc(tr('act.top_emotes'))}</h4><div id="actEmotes" class="act-chips"></div></div></div>
          <details class="act-fold"><summary>${bi('sliders')} ${esc(tr('act.alerts_title'))}</summary>
            ${chk('hypeOn', A.hypeOn, tr('act.hype_on'))}<div class="field-row"><label>${esc(tr('act.hype_at'))}</label>${num('hypeAt', A.hypeAt, 3, 500, 100)}</div>
            ${chk('idleOn', A.idleOn, tr('act.idle_on'))}<div class="field-row"><label>${esc(tr('act.idle_min'))}</label>${num('idleMin', A.idleMin, 1, 120, 100)}</div>
            ${chk('alertSound', A.alertSound, tr('act.alert_sound'))}
            <div class="field-row"><label>${esc(tr('act.bots'))}</label><input type="text" data-set="bots" value="${esc(A.bots)}" maxlength="300" autocomplete="off"></div></details>
          <div class="streamer-tool-actions"><button class="cyber-btn primary-btn" data-ac="summary">${bi('clipboard-data')} ${esc(tr('act.copy_summary'))}</button>
            <button class="cyber-btn export-btn" data-ac="csv">${bi('file-earmark-spreadsheet')} ${esc(tr('act.csv_btn'))}</button></div>`, 'wide');
    }
    function feedCard() {
        const o = (v, k) => `<option value="${v}" ${A.feedFilter === v ? 'selected' : ''}>${esc(tr(k))}</option>`;
        return card('list-ul', tr('act.feed_title'), tr('act.feed_desc'), `
          <div class="act-chips" id="actCounters">${countersHtml()}</div>
          <div class="field-row"><select data-set="feedFilter" data-rerender="feed">${o('all', 'act.feed_all')}${o('money', 'act.feed_money')}${o('game', 'act.feed_game')}${o('chat', 'act.feed_chat')}</select>
            <button class="cyber-btn danger-btn" data-ac="feedclear">${bi('trash')} ${esc(tr('act.feed_clear'))}</button></div>
          <div class="act-feed" id="actFeedList" role="log">${feedHtml()}</div>`);
    }
    function gwCard() {
        const gw = G();
        return card('trophy-fill', tr('act.gw_title'), tr('act.gw_desc'), `
          <div class="field-row"><label>${esc(tr('act.gw_keyword'))}</label><input type="text" data-set="gw.keyword" value="${esc(gw.keyword)}" maxlength="30" autocomplete="off" autocapitalize="off">
            <label>${esc(tr('act.gw_winners'))}</label>${num('gw.winnersCount', gw.winnersCount, 1, 10, 80)}</div>
          <div class="field-row"><label>${esc(tr('act.gw_duration'))}</label>${num('gw.durationSec', gw.durationSec, 0, 3600, 100)}
            <label>${esc(tr('act.gw_minmsgs'))}</label>${num('gw.minMsgs', gw.minMsgs, 0, 1000, 80)}</div>
          ${chk('gw.subsOnly', gw.subsOnly, tr('act.gw_subs'))}${chk('gw.excludeMods', gw.excludeMods, tr('act.gw_nomods'))}
          <div id="gwDyn">${gwDynHtml()}</div>`);
    }
    function goalCard() {
        const gl = A.goal, o = (v, k) => `<option value="${v}" ${gl.type === v ? 'selected' : ''}>${esc(tr(k))}</option>`;
        return card('flag-fill', tr('act.goal_title'), tr('act.goal_desc'), `
          <div class="field-row"><input type="text" data-set="goal.title" value="${esc(gl.title)}" placeholder="${esc(tr('act.goal_name'))}" maxlength="60" autocomplete="off"></div>
          <div class="field-row"><label>${esc(tr('act.goal_type'))}</label><select data-set="goal.type" data-rerender="goal">${o('manual', 'act.goal_t_manual')}${o('donations', 'act.goal_t_don')}${o('subs', 'act.goal_t_subs')}${o('chatters', 'act.goal_t_chat')}${o('messages', 'act.goal_t_msgs')}</select>
            <label>${esc(tr('act.goal_target'))}</label>${num('goal.target', gl.target, 1, 100000000, 110)}</div>
          ${gl.type === 'donations' ? `<div class="field-row"><label>${esc(tr('act.goal_cur'))}</label><input type="text" data-set="goal.currency" value="${esc(gl.currency)}" maxlength="5" style="max-width:90px" autocomplete="off"></div>` : ''}
          <div class="act-goal ${gl.reached ? 'done' : ''}" id="goalWrap"><div class="act-goal-bar"><i id="goalFill"></i></div><div class="act-goal-text" id="goalText"></div></div>
          <div class="streamer-tool-actions">${gl.type === 'manual' ? `<button class="cyber-btn" data-ac="goalm" data-n="-1">${bi('dash-lg')} 1</button><button class="cyber-btn add-btn" data-ac="goalm" data-n="1">${bi('plus-lg')} 1</button><button class="cyber-btn add-btn" data-ac="goalm" data-n="10">${bi('plus-lg')} 10</button>` : ''}
            <button class="cyber-btn danger-btn" data-ac="goalreset">${bi('arrow-repeat')} ${esc(tr('act.goal_reset'))}</button></div>`);
    }
    function markersCard() {
        return card('bookmark-star-fill', tr('act.mk_title'), tr('act.mk_desc'), `
          <div class="field-row"><input type="text" id="mkLabel" placeholder="${esc(tr('act.mk_placeholder'))}" maxlength="80" autocomplete="off" data-ac-enter="mkadd">
            <button class="cyber-btn add-btn" data-ac="mkadd">${bi('bookmark-plus-fill')} ${esc(tr('act.mk_add'))}</button></div>
          <p class="muted small">${esc(tr('act.mk_hotkey'))}</p>
          <div class="act-mks" id="actMarkers">${markersHtml()}</div>
          <div class="streamer-tool-actions"><button class="cyber-btn primary-btn" data-ac="mkcopy">${bi('clipboard-check')} ${esc(tr('act.mk_copy'))}</button>
            <button class="cyber-btn" data-ac="mkstart">${bi('record-circle')} ${esc(tr('act.mk_start_now'))}</button>
            <button class="cyber-btn danger-btn" data-ac="mkclear">${bi('trash')} ${esc(tr('act.mk_clear'))}</button></div>`);
    }
    function remindersCard() {
        const pre = [['act.rm_preset_water', 30], ['act.rm_preset_follow', 20], ['act.rm_preset_break', 60], ['act.rm_preset_chat', 10]];
        return card('alarm-fill', tr('act.rm_title'), tr('act.rm_desc'), `
          <div class="act-chips">${pre.map(([k, m]) => `<button class="act-chip act-chip-btn" data-ac="rmpreset" data-k="${k}" data-m="${m}">${bi('plus-lg')} ${esc(tr(k))} · ${m}</button>`).join('')}</div>
          <div class="field-row"><input type="text" id="rmLabel" placeholder="${esc(tr('act.rm_label'))}" maxlength="60" autocomplete="off" data-ac-enter="rmadd"><input type="number" id="rmEvery" min="1" max="600" value="30" style="max-width:90px" aria-label="${esc(tr('act.rm_every'))}">
            <button class="cyber-btn add-btn" data-ac="rmadd">${bi('plus-lg')} ${esc(tr('act.rm_add'))}</button></div>
          <div class="act-rms" id="actReminders">${remindersHtml()}</div>`);
    }
    function render() { return dashCard() + gwCard() + goalCard() + feedCard() + markersCard() + remindersCard(); }
    function afterRender() {
        refreshBoards(); drawSpark(); updateKpis(recent.length); updateGoalUi(); updateReminderUi(); updateGwTimer();
    }

    // ── delegated events ─────────────────────────────────────
    const ACT = {
        user: el => userCard(el.dataset.u),
        towheel: el => { addSubToWheelFromChat(el.dataset.u); },
        summary: () => copy(summaryText(), 'act.summary_copied'), csv: csvChat,
        feedclear: () => { A.feed = []; save(); refreshFeed(); },
        gwopen: gwOpen, gwclose: () => gwClose(false), gwdraw: gwDraw, gwwheel: gwToWheel,
        gwclear: () => { const gw = G(); gw.entrants = []; gw.winners = []; save(); refreshGwDyn(); },
        gwreroll: el => gwReroll(+el.dataset.i),
        gwcopy: () => copy(G().winners.map(w => w.name).join(', '), 'act.gw_copied'),
        gwrm: el => { const gw = G(); gw.entrants = gw.entrants.filter(e => e.login !== el.dataset.u); gw.winners = gw.winners.filter(e => e.login !== el.dataset.u); save(); refreshGwDyn(); },
        goalm: el => goalManual(+el.dataset.n), goalreset: goalReset,
        mkadd: () => { const i = $('mkLabel'); addMarker(i ? i.value : ''); if (i) { i.value = ''; i.focus(); } },
        mkdel: el => { A.markers = A.markers.filter(m => m.id !== el.dataset.id); save(); refreshMarkers(); },
        mkcopy: () => copy(chaptersText(), 'act.mk_copied'),
        mkstart: () => { A.streamStart = Date.now(); save(); refreshMarkers(); showNotification(tr('act.mk_start_set'), 'info'); },
        mkclear: () => { A.markers = []; save(); refreshMarkers(); },
        rmpreset: el => addReminder(tr(el.dataset.k), +el.dataset.m),
        rmadd: () => { const l = $('rmLabel'), e = $('rmEvery'); if (!l || !l.value.trim()) return; addReminder(l.value, e ? e.value : 30); l.value = ''; },
        rmdel: el => { A.reminders = A.reminders.filter(r => r.id !== el.dataset.id); save(); refreshReminders(); },
        rmtoggle: el => { const r = A.reminders.find(x => x.id === el.dataset.id); if (r) { r.on = el.checked; r.nextAt = Date.now() + r.every * 60000; save(); updateReminderUi(); } },
    };
    document.addEventListener('click', e => {
        const el = e.target.closest('[data-ac]'); if (!el) return;
        if (ACT[el.dataset.ac]) ACT[el.dataset.ac](el);
    });
    document.addEventListener('keydown', e => {
        const el = e.target.closest && e.target.closest('[data-ac-enter]');
        if (el && e.key === 'Enter') { e.preventDefault(); ACT[el.dataset.acEnter](el); }
    });
    function setPath(path, val) {
        const parts = path.split('.'); let o = A; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = val;
    }
    function onSet(e) {
        const el = e.target.closest && e.target.closest('[data-set]'); if (!el) return;
        const path = el.dataset.set;
        if (e.type === 'input' && el.type !== 'number' && el.type !== 'search' && el.type !== 'text') return;
        let v;
        if (el.type === 'checkbox') v = el.checked;
        else if (el.type === 'number') { v = Number(el.value); if (!isFinite(v)) return; v = Math.min(+el.max || v, Math.max(+el.min || 0, v)); }
        else v = el.value;
        if (path === 'goal.type') { setPath(path, v); goalReset(); }
        else setPath(path, v);
        if (path === 'goal.target') { A.goal.reached = goalCur() >= A.goal.target && A.goal.target > 0 ? A.goal.reached : false; }
        save();
        const rr = el.dataset.rerender;
        if (rr === 'chat' && e.type !== 'input') rerenderChat();
        else if (rr === 'chat') { clearTimeout(onSet._t); onSet._t = setTimeout(rerenderChat, 200); }
        else if (rr === 'feed') refreshFeed();
        else if (rr === 'goal') { const c = el.closest('.streamer-tool-card'); if (c) c.outerHTML = goalCard(); updateGoalUi(); }
    }
    document.addEventListener('change', onSet); document.addEventListener('input', onSet);

    load();
    g.RCHActivity = {
        render, afterRender, toolbarHtml, passFilter, fmtText, filterActive, onChat, onNotice, onDonation, log, addMarker, chatGiveaway,
        report, statsHtml, resetChatStats, resetSession, userCard, summaryText,
    };
})(window);
