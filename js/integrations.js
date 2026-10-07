// ============================================================
// RCH integrations: Twitch IRC parsing, Streamlabs Socket API,
// DonationAlerts (Centrifugo). Pure parsing + small clients, with
// injectable WebSocket/fetch so everything is unit-testable.
// ============================================================
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RCHInt = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ── Twitch IRC ─────────────────────────────────────────
    function unescapeTag(v) {
        return String(v).replace(/\\([s:rn\\])/g, (_, c) => ({ s: ' ', ':': ';', r: '\r', n: '\n', '\\': '\\' }[c]));
    }
    function parseIrc(line) {
        let rest = String(line).replace(/[\r\n]+$/, '');
        const msg = { tags: {}, prefix: '', command: '', params: [], trailing: null };
        if (rest[0] === '@') {
            const i = rest.indexOf(' ');
            if (i < 0) return msg;
            rest.slice(1, i).split(';').forEach(p => {
                const eq = p.indexOf('=');
                const k = eq < 0 ? p : p.slice(0, eq);
                if (k) msg.tags[k] = eq < 0 ? '' : unescapeTag(p.slice(eq + 1));
            });
            rest = rest.slice(i + 1).replace(/^ +/, '');
        }
        if (rest[0] === ':') {
            const i = rest.indexOf(' ');
            if (i < 0) { msg.prefix = rest.slice(1); return msg; }
            msg.prefix = rest.slice(1, i); rest = rest.slice(i + 1);
        }
        let head = rest;
        const ti = rest.indexOf(' :');
        if (ti >= 0) { msg.trailing = rest.slice(ti + 2); head = rest.slice(0, ti); }
        const parts = head.split(' ').filter(Boolean);
        msg.command = parts.shift() || '';
        msg.params = parts;
        return msg;
    }
    function parseBadges(s) {
        const m = {};
        String(s || '').split(',').forEach(b => { const [k, v] = b.split('/'); if (k) m[k] = v || '1'; });
        return m;
    }
    /** Normalise one IRC line into an event the app understands. */
    function parseTwitchLine(line) {
        const m = parseIrc(line);
        const t = m.tags;
        const login = (m.prefix.split('!')[0] || '').toLowerCase();
        switch (m.command) {
            case 'PING': return { kind: 'ping', payload: m.trailing || 'tmi.twitch.tv' };
            case 'RECONNECT': return { kind: 'reconnect' };
            case '001': case '376': return { kind: 'welcome' };
            case 'JOIN': return { kind: 'join', user: login, channel: (m.params[0] || '').replace('#', '') };
            case 'ROOMSTATE': return { kind: 'roomstate', channel: (m.params[0] || '').replace('#', '') };
            case 'NOTICE': return { kind: 'notice', text: m.trailing || '' };
            case 'PRIVMSG': {
                let text = m.trailing || '', action = false;
                if (text.indexOf('\x01ACTION ') === 0) { text = text.slice(8).replace(/\x01$/, ''); action = true; }
                const badges = parseBadges(t.badges);
                const isBroad = 'broadcaster' in badges;
                const isMod = isBroad || 'moderator' in badges || t.mod === '1';
                const isSub = 'subscriber' in badges || 'founder' in badges || t.subscriber === '1';
                return {
                    kind: 'chat', id: t.id || '', user: login, name: t['display-name'] || login,
                    text: text.trim(), color: /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : '',
                    badges, isBroad, isMod, isSub, isVip: 'vip' in badges, action,
                    bits: parseInt(t.bits, 10) || 0, rewardId: t['custom-reward-id'] || '',
                };
            }
            case 'USERNOTICE': {
                const type = t['msg-id'] || '';
                return {
                    kind: 'usernotice', type, id: t.id || '',
                    user: (t.login || login).toLowerCase(), name: t['display-name'] || t.login || login,
                    text: (m.trailing || '').trim(), plan: t['msg-param-sub-plan'] || '',
                    months: parseInt(t['msg-param-cumulative-months'], 10) || 0,
                    gifts: parseInt(t['msg-param-mass-gift-count'], 10) || 1,
                    recipient: t['msg-param-recipient-display-name'] || t['msg-param-recipient-user-name'] || '',
                    viewers: parseInt(t['msg-param-viewerCount'], 10) || 0,
                };
            }
            default: return { kind: 'other', command: m.command };
        }
    }
    function subTier(plan) { return plan === '3000' ? 3 : plan === '2000' ? 2 : 1; }

    // ── Streamlabs Socket API (socket.io v2 / engine.io v3) ─
    /** Parse one websocket text frame. */
    function parseEngineFrame(frame) {
        const f = String(frame);
        const c = f[0];
        if (c === '0') { let d = {}; try { d = JSON.parse(f.slice(1)); } catch (e) { } return { type: 'open', data: d }; }
        if (c === '1') return { type: 'close' };
        if (c === '2') return { type: 'ping' };
        if (c === '3') return { type: 'pong' };
        if (c === '4') {
            const s = f[1];
            if (s === '0') return { type: 'connect' };
            if (s === '1') return { type: 'disconnect' };
            if (s === '4') return { type: 'error', data: f.slice(2) };
            if (s === '2') {
                const body = f.slice(2).replace(/^\/[^,\[]*,?/, '').replace(/^\d+(?=\[)/, '');
                try {
                    const arr = JSON.parse(body);
                    if (Array.isArray(arr)) return { type: 'event', name: arr[0], payload: arr[1] };
                } catch (e) { }
            }
        }
        return { type: 'other' };
    }
    const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };

    function normalizeStreamlabs(payload) {
        if (!payload || payload.type !== 'donation') return [];
        const arr = Array.isArray(payload.message) ? payload.message : [payload.message];
        return arr.filter(Boolean).map(m => ({
            source: 'streamlabs',
            id: 'sl:' + String(m.id || m._id || m.donation_id || payload.event_id || (m.name + ':' + m.amount + ':' + (m.message || '')).slice(0, 80)),
            user: String(m.name || m.from || 'Anonymous'),
            amount: num(m.amount), currency: m.currency || '',
            text: String(m.message || ''), test: !!(m.isTest || payload.isTest),
        })).filter(d => d.amount > 0);
    }
    function normalizeDonationAlerts(d, fallbackCurrency) {
        if (!d || typeof d !== 'object') return null;
        const inUser = d.amount_in_user_currency;
        const amount = num(inUser !== undefined && inUser !== null ? inUser : d.amount);
        if (!(amount > 0)) return null;
        return {
            source: 'donationalerts', id: 'da:' + String(d.id !== undefined ? d.id : (d.username + d.amount + d.created_at)),
            user: String(d.username || 'Аноним'), amount,
            currency: (inUser !== undefined && inUser !== null && fallbackCurrency) ? fallbackCurrency : (d.currency || ''),
            text: String(d.message || ''), test: false,
        };
    }

    // ── generic reconnecting client scaffold ───────────────
    function makeClient(name, startFn, opts) {
        let ws = null, timer = null, wanted = false, attempt = 0, pingT = null;
        const st = s => { try { opts.onStatus && opts.onStatus(s.status, s.detail || ''); } catch (e) { } };
        const ctx = {
            setWs(w) { ws = w; }, status: (status, detail) => st({ status, detail }),
            ping(fn, ms) { clearInterval(pingT); pingT = setInterval(fn, ms); },
            ok() { attempt = 0; },
        };
        async function run() {
            clearTimeout(timer);
            st({ status: 'connecting' });
            try { await startFn(ctx, () => wanted); }
            catch (e) {
                if (e && e.fatal) { wanted = false; st({ status: 'error', detail: e.message }); return; }
                schedule(e && e.message);
            }
        }
        function schedule(reason) {
            clearInterval(pingT);
            if (!wanted) { st({ status: 'idle' }); return; }
            const delay = Math.min(30000, 2000 * Math.pow(2, attempt++));
            st({ status: 'error', detail: (reason || 'connection lost') + ' — retry ' + Math.round(delay / 1000) + 's' });
            timer = setTimeout(run, delay);
        }
        ctx.lost = schedule;
        return {
            connect() { wanted = true; attempt = 0; run(); },
            disconnect() { wanted = false; clearTimeout(timer); clearInterval(pingT); try { ws && ws.close(); } catch (e) { } ws = null; st({ status: 'idle' }); },
        };
    }

    function createStreamlabsClient(o) {
        const WS = o.WebSocket || WebSocket;
        return makeClient('streamlabs', (ctx, wanted) => new Promise(resolve => {
            if (!o.token) { const e = new Error('no token'); e.fatal = true; throw e; }
            const ws = new WS('wss://sockets.streamlabs.com/socket.io/?token=' + encodeURIComponent(o.token) + '&EIO=3&transport=websocket');
            ctx.setWs(ws);
            ws.onmessage = ev => {
                const f = parseEngineFrame(ev.data);
                if (f.type === 'open') ctx.ping(() => { try { ws.send('2'); } catch (e) { } }, Math.max(5000, (f.data.pingInterval || 25000) - 2000));
                else if (f.type === 'connect') { ctx.ok(); ctx.status('connected'); }
                else if (f.type === 'ping') ws.send('3');
                else if (f.type === 'error') { ctx.status('error', 'rejected (check Socket API token)'); }
                else if (f.type === 'event' && f.name === 'event') normalizeStreamlabs(f.payload).forEach(d => o.onDonation(d));
            };
            ws.onerror = () => { };
            ws.onclose = () => { if (wanted()) ctx.lost('disconnected'); resolve(); };
        }), o);
    }

    function createDonationAlertsClient(o) {
        const WS = o.WebSocket || WebSocket;
        const F = o.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
        const API = 'https://www.donationalerts.com/api/v1';
        return makeClient('donationalerts', async (ctx, wanted) => {
            if (!o.token) { const e = new Error('no token'); e.fatal = true; throw e; }
            const auth = { Authorization: 'Bearer ' + o.token, Accept: 'application/json' };
            const ur = await F(API + '/user/oauth', { headers: auth });
            if (ur.status === 401 || ur.status === 403) { const e = new Error('token rejected (' + ur.status + ')'); e.fatal = true; throw e; }
            if (!ur.ok) throw new Error('user/oauth ' + ur.status);
            const info = (await ur.json()).data || {};
            const chan = '$alerts:donation_' + info.id;
            await new Promise(resolve => {
                const ws = new WS('wss://centrifugo.donationalerts.com/connection/websocket');
                ctx.setWs(ws);
                let clientId = '';
                ws.onopen = () => ws.send(JSON.stringify({ params: { token: info.socket_connection_token }, id: 1 }));
                ws.onmessage = async ev => {
                    for (const line of String(ev.data).split('\n')) {
                        if (!line.trim()) continue;
                        let f; try { f = JSON.parse(line); } catch (e) { continue; }
                        if (f.id === 1) {
                            if (f.error) { ctx.status('error', 'socket: ' + (f.error.message || 'rejected')); continue; }
                            clientId = f.result && f.result.client;
                            try {
                                const sr = await F(API + '/centrifuge/subscribe', {
                                    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth),
                                    body: JSON.stringify({ channels: [chan], client: clientId }),
                                });
                                if (!sr.ok) throw new Error('subscribe ' + sr.status);
                                const tok = ((await sr.json()).channels || [])[0];
                                ws.send(JSON.stringify({ params: { channel: chan, token: tok && tok.token }, method: 1, id: 2 }));
                            } catch (e) { ctx.status('error', e.message); }
                        } else if (f.id === 2) {
                            if (f.error) ctx.status('error', 'subscribe: ' + (f.error.message || 'rejected'));
                            else { ctx.ok(); ctx.status('connected', info.name || ''); ctx.ping(() => { try { ws.send(JSON.stringify({ method: 7, id: 100 })); } catch (e) { } }, 25000); }
                        } else if (f.result && f.result.channel === chan && f.result.data) {
                            const d = normalizeDonationAlerts(f.result.data.data || f.result.data, info.main_currency || '');
                            if (d) o.onDonation(d);
                        }
                    }
                };
                ws.onerror = () => { };
                ws.onclose = () => { if (wanted()) ctx.lost('disconnected'); resolve(); };
            });
        }, o);
    }

    return { parseIrc, parseTwitchLine, subTier, parseEngineFrame, normalizeStreamlabs, normalizeDonationAlerts, createStreamlabsClient, createDonationAlertsClient };
});
