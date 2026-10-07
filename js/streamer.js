// ============================================================
// RCH Streamer module: Twitch chat (anonymous IRC), chat voting,
// timer, viewer wheel, viewer suggestions, donation sources
// (Streamlabs / DonationAlerts) and the OBS overlay bridge.
// ============================================================

const TWITCH_IRC = 'wss://irc-ws.chat.twitch.tv:443';

let streamerState = {
    // timer (timestamp based — no drift)
    timerSeconds: 0, timerInitial: 0, timerRunning: false, timerEndsAt: 0, timerInterval: null,
    // chat
    chatMessages: [], userActivity: {}, chatStats: { totalMessages: 0, uniqueViewers: 0, mostActiveUser: '' },
    chatSounds: false, autoSpin: false, sessionStartTime: 0,
    // vote
    voteActive: false, voteOptions: [], voteVotes: {}, voteVoters: {}, voteDuration: 30, voteEndsAt: 0,
    voteTimer: 0, voteInterval: null, voteTitle: '', voteSource: 'games', voteCount: 4, voteCustom: '', voteDraft: [],
    lastVote: null,
    // viewer wheel
    subWheelList: [], viewerWeight: 'equal', viewerRemoveWinner: true, viewerWinners: [],
    // suggestions
    suggestEnabled: true, suggestions: [], _suggestSeen: {},
    // twitch
    channelName: '', connected: false, twitchWs: null, twitchStatus: 'idle',
    // donation sources
    slToken: '', daToken: '', daClientId: '', alertsEnabled: true,
    autoConnect: { twitch: false, streamlabs: false, donationalerts: false },
    integ: { streamlabs: { status: 'idle', detail: '' }, donationalerts: { status: 'idle', detail: '' } },
    donations: [],
};

// ── persistence (debounced, localStorage only) ────────────
const _PERSIST = ['channelName', 'subWheelList', 'chatStats', 'chatSounds', 'autoSpin', 'sessionStartTime', 'voteDuration',
    'voteTitle', 'voteSource', 'voteCount', 'voteCustom', 'viewerWeight', 'viewerRemoveWinner', 'viewerWinners',
    'suggestEnabled', 'suggestions', 'slToken', 'daToken', 'daClientId', 'alertsEnabled', 'autoConnect'];
let _saveTimer = null;
function saveStreamerData() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_saveStreamerNow, 400);
}
function _saveStreamerNow() {
    const o = { lastSaved: Date.now() };
    _PERSIST.forEach(k => { o[k] = streamerState[k]; });
    // keep the activity table bounded
    const entries = Object.entries(streamerState.userActivity || {});
    entries.sort((a, b) => b[1].lastSeen - a[1].lastSeen);
    o.userActivity = Object.fromEntries(entries.slice(0, 400));
    try { localStorage.setItem('streamerState', JSON.stringify(o)); } catch (e) { console.warn('[streamer] save failed', e); }
}
function loadStreamerDataSync() {
    try {
        const d = JSON.parse(localStorage.getItem('streamerState') || 'null');
        if (!d) return;
        _PERSIST.concat(['userActivity']).forEach(k => { if (d[k] !== undefined) streamerState[k] = d[k]; });
        streamerState.autoConnect = Object.assign({ twitch: false, streamlabs: false, donationalerts: false }, d.autoConnect || {});
        streamerState.userActivity = streamerState.userActivity || {};
    } catch (e) { console.warn('[streamer] load failed', e); }
    if (!streamerState.sessionStartTime) streamerState.sessionStartTime = Date.now();
}
window.addEventListener('beforeunload', _saveStreamerNow);

// ── init (called from init() in script.js) ────────────────
function initStreamer() {
    loadStreamerDataSync();
    _handleOAuthReturn();
    refreshConnChips();
    // auto-reconnect sources that were connected last session
    setTimeout(() => {
        if (streamerState.autoConnect.twitch && streamerState.channelName && !_twWanted && streamerState.twitchStatus === 'idle') twitchConnect(streamerState.channelName, true);
        if (streamerState.autoConnect.streamlabs && streamerState.slToken && !_slClient) slConnect(true);
        if (streamerState.autoConnect.donationalerts && streamerState.daToken && !_daClient) daConnect(true);
    }, 600);
}

// ── TWITCH IRC ────────────────────────────────────────────
let _twTimer = null, _twAttempt = 0, _twWanted = false;

function _cleanChannel(c) { return String(c || '').trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_]/g, ''); }

function twitchConnect(channel, silent) {
    const ch = _cleanChannel(channel);
    if (!ch) { showNotification(t('streamer.enter_channel'), 'error'); return; }
    _twWanted = true; _twAttempt = 0;
    streamerState.autoConnect.twitch = true; saveStreamerData();
    _twOpen(ch, silent);
}

function _twOpen(ch, silent) {
    clearTimeout(_twTimer);
    if (streamerState.twitchWs) {
        const old = streamerState.twitchWs;
        old.onclose = old.onerror = old.onmessage = null;
        try { old.close(); } catch (e) { }
    }
    streamerState.channelName = ch;
    streamerState.twitchStatus = 'connecting';
    _updateConnectBtn();
    if (!silent && _twAttempt === 0) showNotification(t('streamer.connecting_to', { ch }), 'info');

    let ws;
    try { ws = new WebSocket(TWITCH_IRC); } catch (e) { _twScheduleRetry(ch); return; }
    streamerState.twitchWs = ws;
    ws.onopen = () => {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send('NICK justinfan' + Math.floor(Math.random() * 80000 + 1000));
        ws.send('JOIN #' + ch);
    };
    ws.onmessage = e => {
        // one websocket frame may hold several IRC lines
        String(e.data).split('\r\n').forEach(line => { if (line) _handleTwitchEvent(RCHInt.parseTwitchLine(line), ws, ch); });
    };
    ws.onerror = () => { };
    ws.onclose = () => {
        if (streamerState.twitchWs !== ws) return;
        streamerState.twitchWs = null; streamerState.connected = false;
        if (_twWanted) _twScheduleRetry(ch);
        else { streamerState.twitchStatus = 'idle'; _updateConnectBtn(); }
        updateOverlayChatData();
    };
}

function _twScheduleRetry(ch) {
    streamerState.twitchStatus = 'error'; streamerState.connected = false;
    _updateConnectBtn();
    const delay = Math.min(30000, 2000 * Math.pow(2, _twAttempt++));
    if (_twAttempt === 1) showNotification(t('streamer.connect_error'), 'error');
    _twTimer = setTimeout(() => { if (_twWanted) _twOpen(ch, true); }, delay);
}

function _handleTwitchEvent(ev, ws, ch) {
    switch (ev.kind) {
        case 'ping': ws.send('PONG :' + ev.payload); break;
        case 'reconnect': try { ws.close(); } catch (e) { } break;
        case 'join': case 'roomstate':
            if (streamerState.twitchStatus !== 'connected') {
                streamerState.twitchStatus = 'connected'; streamerState.connected = true; _twAttempt = 0;
                _updateConnectBtn();
                showNotification(t('streamer.connected_msg', { ch }), 'success');
                updateOverlayChatData();
            }
            break;
        case 'chat': _handleChat(ev); break;
        case 'usernotice': if (window.RCHAuction) RCHAuction.onTwitchNotice(ev); break;
    }
}

function twitchDisconnect() {
    _twWanted = false; clearTimeout(_twTimer);
    streamerState.autoConnect.twitch = false; saveStreamerData();
    if (streamerState.twitchWs) { const w = streamerState.twitchWs; streamerState.twitchWs = null; try { w.close(); } catch (e) { } }
    streamerState.twitchStatus = 'idle'; streamerState.connected = false;
    _updateConnectBtn();
    showNotification(t('streamer.disconnected'), 'info');
    updateOverlayChatData();
}

function twitchToggleConnect(inputId) {
    if (streamerState.twitchStatus === 'connected' || streamerState.twitchStatus === 'connecting' || _twWanted) { twitchDisconnect(); return; }
    const inp = document.getElementById(inputId || 'channelNameInput') || document.querySelector('.js-channel-input');
    twitchConnect((inp && inp.value) || streamerState.channelName);
}
function updateChannelName(value) {
    streamerState.channelName = _cleanChannel(value);
    document.querySelectorAll('.js-channel-input').forEach(i => { if (i.value !== value && document.activeElement !== i) i.value = streamerState.channelName; });
    saveStreamerData();
}

function _randomChatColor(name) {
    const palette = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#67e8f9', '#a3e635', '#fb923c', '#e879f9'];
    let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
}

function _handleChat(ev) {
    const badge = ev.isBroad ? 'broadcaster' : ev.isMod ? 'mod' : ev.isVip ? 'vip' : ev.isSub ? 'sub' : '';
    const msg = { user: ev.name, login: ev.user, text: ev.text, color: ev.color || _randomChatColor(ev.user), badge, timestamp: Date.now() };
    streamerState.chatMessages.push(msg);
    if (streamerState.chatMessages.length > 300) streamerState.chatMessages.shift();

    const cb = document.getElementById('chatBox');
    if (cb) {
        if (cb.querySelector('.chat-empty')) cb.innerHTML = '';
        const stick = cb.scrollTop + cb.clientHeight >= cb.scrollHeight - 30;
        cb.insertAdjacentHTML('beforeend', _renderOneChatMsg(msg));
        while (cb.children.length > 80) cb.removeChild(cb.firstChild);
        if (stick) cb.scrollTop = cb.scrollHeight;
    }
    trackChatUser(ev);
    playChatNotificationSound();
    _scheduleOverlayChat();
    if (streamerState.voteActive) _castVote(ev.user, ev.text);
    if (window.RCHAuction) RCHAuction.onChat(ev);
    processChatCommand(ev);
}

function trackChatUser(ev) {
    const ua = streamerState.userActivity;
    const u = ua[ev.user] || (ua[ev.user] = { name: ev.name, messages: 0, lastSeen: 0, isSub: false, isMod: false });
    u.messages++; u.lastSeen = Date.now(); u.name = ev.name; u.isSub = ev.isSub; u.isMod = ev.isMod || ev.isBroad;
    const cs = streamerState.chatStats;
    cs.totalMessages++;
    cs.uniqueViewers = Object.keys(ua).length;
    const top = ua[cs.mostActiveUser];
    if (!top || u.messages >= top.messages) cs.mostActiveUser = u.name;
    saveStreamerData();
}

function getChatParticipants(minMessages = 1, excludeMods = false) {
    const since = Date.now() - 3600000, out = [];
    Object.entries(streamerState.userActivity || {}).forEach(([login, d]) => {
        if (excludeMods && d.isMod) return;
        if (d.messages >= minMessages && d.lastSeen > since) out.push({ user: d.name || login, login, messages: d.messages, isSub: d.isSub, isMod: d.isMod });
    });
    return out.sort((a, b) => b.messages - a.messages);
}

// ── CHAT COMMANDS ─────────────────────────────────────────
const _cmdCooldown = {};
function processChatCommand(ev) {
    const text = ev.text.trim();
    if (text[0] !== '!') return;
    const [cmd0, ...args] = text.split(/\s+/);
    const cmd = cmd0.toLowerCase();
    const now = Date.now();
    const priv = ev.isMod || ev.isBroad;
    const MOD_ONLY = ['!spin', '!vote', '!endvote', '!timer', '!addchatters', '!clearwheel', '!add'];
    if (MOD_ONLY.includes(cmd) && !priv) return;           // unauthorised attempts must not trigger the cooldown
    const ck = cmd + ':' + (priv ? 'm' : 'u');
    if (_cmdCooldown[ck] && now - _cmdCooldown[ck] < 1500) return;
    _cmdCooldown[ck] = now;

    if (priv) {
        if (cmd === '!spin') return chatSpinRequest(ev.name);
        if (cmd === '!vote') { if (!streamerState.voteActive) { const d = parseInt(args[0], 10); if (d >= 10 && d <= 600) streamerState.voteDuration = d; startVote(); } return; }
        if (cmd === '!endvote') { if (streamerState.voteActive) stopVote(); return; }
        if (cmd === '!timer') {
            const a = (args[0] || '').toLowerCase();
            if (a === 'stop' || a === 'pause') { if (streamerState.timerRunning) startTimer(); return; }
            const m = parseFloat(a); if (m > 0 && m <= 600) setTimerFromChat(m); return;
        }
        if (cmd === '!addchatters') return addAllChattersToWheel();
        if (cmd === '!clearwheel') return clearSubWheel();
        if (cmd === '!add' && args[0]) return addSubToWheelFromChat(args[0].replace(/^@/, ''));
    }
    if (cmd === '!join' || cmd === '!addme') return addSubToWheelFromChat(ev.name);
    if (cmd === '!task' || cmd === '!предложить') return addSuggestion(ev.name, args.join(' '));
}

function chatSpinRequest(who) {
    if (streamerState.autoSpin) { quickSpin(); return; }
    showNotification(t('st.spin_requested', { name: who }), 'info');
    playChatNotificationSound(true);
}

function addAllChattersToWheel() {
    let added = 0;
    getChatParticipants(1).forEach(p => {
        if (!_inWheel(p.user)) { streamerState.subWheelList.push(p.user); added++; }
    });
    saveStreamerData(); refreshViewerCard();
    showNotification(added ? t('streamer.all_chatters_added', { n: added }) : t('streamer.all_already_in_wheel'), added ? 'success' : 'info');
}
function _inWheel(name) { const n = String(name).toLowerCase(); return streamerState.subWheelList.some(x => x.toLowerCase() === n); }
function addSubToWheelFromChat(user) {
    user = String(user || '').trim().slice(0, 40);
    if (!user) return;
    if (_inWheel(user)) return;
    streamerState.subWheelList.push(user); saveStreamerData(); refreshViewerCard();
    showNotification(t('streamer.sub_added', { name: user }), 'success');
}
function playChatNotificationSound(force) {
    if (!force && !streamerState.chatSounds) return;
    try {
        initAudio(); if (!audioCtx) return;
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination); o.type = 'sine';
        o.frequency.setValueAtTime(800, audioCtx.currentTime); o.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        g.gain.setValueAtTime(0.05, audioCtx.currentTime); g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
        o.start(); o.stop(audioCtx.currentTime + 0.15);
    } catch (e) { }
}
function toggleChatSounds(on) { streamerState.chatSounds = on; saveStreamerData(); showNotification(on ? t('streamer.chat_sounds_on') : t('streamer.chat_sounds_off'), 'info'); }
function toggleAutoSpin(on) { streamerState.autoSpin = on; saveStreamerData(); showNotification(on ? t('streamer.autospin_on') : t('streamer.autospin_off'), 'info'); }

// ── OVERLAY BRIDGE ────────────────────────────────────────
function rchOverlay(state) { try { RCHBus.publish('overlayState', state); } catch (e) { } }
let _ovChatT = null;
function _scheduleOverlayChat() { if (_ovChatT) return; _ovChatT = setTimeout(() => { _ovChatT = null; updateOverlayChatData(); }, 250); }
function updateOverlayChatData() {
    try {
        RCHBus.publish('overlayChatData', {
            connected: streamerState.twitchStatus === 'connected', channelName: streamerState.channelName,
            messages: streamerState.chatMessages.slice(-20).map(m => ({ user: m.user, text: m.text, color: m.color, badge: m.badge })),
        });
    } catch (e) { }
}
function publishWheel(title, segs, res, winner) {
    try {
        RCHBus.publish('overlayWheel', {
            id: Date.now() + '' + Math.random(), title, winner: winner || '',
            segs: segs.map(s => ({ label: String(s.label || s.task || '').slice(0, 40), color: s.color, weight: s.weight || 1 })),
            startAngle: res.startAngle, total: res.total, duration: res.duration,
        });
    } catch (e) { }
}

// ── CONNECTION STATUS UI ──────────────────────────────────
function _updateConnectBtn() {
    const s = streamerState.twitchStatus;
    document.querySelectorAll('.js-twitch-btn').forEach(btn => {
        btn.textContent = s === 'connected' ? t('streamer.disconnect_btn') : s === 'connecting' ? t('st.cancel_btn') : s === 'error' ? t('st.stop_retry_btn') : t('streamer.connect_btn');
        btn.classList.toggle('danger-btn', s !== 'idle'); btn.classList.toggle('add-btn', s === 'idle');
    });
    updateStreamerUIState();
}
function updateStreamerUIState() {
    const s = streamerState.twitchStatus, ok = s === 'connected';
    document.querySelectorAll('.js-twitch-status').forEach(el => {
        el.className = 'conn-status js-twitch-status ' + s;
        el.textContent = ok ? t('streamer.status_reading', { ch: streamerState.channelName })
            : s === 'connecting' ? t('streamer.status_connecting') : s === 'error' ? t('streamer.status_error') : t('streamer.status_idle');
    });
    document.querySelectorAll('.js-needs-chat').forEach(b => { b.disabled = !ok; });
    const va = document.getElementById('voteArea'); if (va && !streamerState.voteActive) va.innerHTML = renderVoteArea();
    refreshConnChips();
}
function refreshConnChips() {
    const map = {
        twitch: streamerState.twitchStatus,
        streamlabs: streamerState.integ.streamlabs.status,
        donationalerts: streamerState.integ.donationalerts.status,
    };
    document.querySelectorAll('.conn-chip').forEach(c => {
        const st = map[c.dataset.svc] || 'idle';
        c.dataset.state = st;
        const label = { idle: t('st.state_off'), connecting: t('st.state_connecting'), connected: t('st.state_on'), error: t('st.state_error') }[st];
        c.title = c.dataset.svc + ': ' + label;
        const l = c.querySelector('.conn-label'); if (l) l.textContent = label;
    });
}

// ── DONATION SOURCES (Streamlabs / DonationAlerts) ────────
const _seenDonations = new Set();
function handleDonation(d) {
    if (_seenDonations.has(d.id)) return;
    _seenDonations.add(d.id); if (_seenDonations.size > 500) _seenDonations.delete(_seenDonations.values().next().value);
    d.ts = Date.now();
    streamerState.donations.unshift(d); streamerState.donations.length = Math.min(streamerState.donations.length, 40);
    if (streamerState.alertsEnabled) {
        try { RCHBus.publish('overlayAlert', { id: d.id + d.ts, kind: 'donation', user: d.user, amount: d.amount, currency: d.currency, text: d.text.slice(0, 160) }); } catch (e) { }
    }
    if (window.RCHAuction) RCHAuction.onDonation(d);
    else showNotification(`${d.user}: ${d.amount} ${d.currency}`, 'success');
}
function _setInteg(svc, status, detail) {
    streamerState.integ[svc] = { status, detail: detail || '' };
    refreshConnChips();
    document.querySelectorAll(`.js-integ-status[data-svc="${svc}"]`).forEach(el => {
        el.className = 'conn-status js-integ-status ' + status; el.dataset.svc = svc;
        el.textContent = status === 'connected' ? t('st.state_on') + (detail ? ' · ' + detail : '')
            : status === 'connecting' ? t('st.state_connecting') : status === 'error' ? (detail || t('st.state_error')) : t('st.state_off');
    });
    document.querySelectorAll(`.js-integ-btn[data-svc="${svc}"]`).forEach(b => {
        b.textContent = status === 'idle' ? t('streamer.connect_btn') : t('streamer.disconnect_btn');
        b.classList.toggle('danger-btn', status !== 'idle'); b.classList.toggle('add-btn', status === 'idle');
    });
}
let _slClient = null, _daClient = null;
function slConnect(silent) {
    if (!streamerState.slToken) return showNotification(t('st.need_token'), 'error');
    if (_slClient) _slClient.disconnect();
    streamerState.autoConnect.streamlabs = true; saveStreamerData();
    _slClient = RCHInt.createStreamlabsClient({
        token: streamerState.slToken,
        onStatus: (s, d) => { _setInteg('streamlabs', s, d); if (s === 'connected' && !silent) showNotification('Streamlabs: ' + t('st.state_on'), 'success'); },
        onDonation: handleDonation,
    });
    _slClient.connect();
}
function slDisconnect() { streamerState.autoConnect.streamlabs = false; saveStreamerData(); if (_slClient) _slClient.disconnect(); _slClient = null; _setInteg('streamlabs', 'idle'); }
function slToggle() { const s = streamerState.integ.streamlabs.status; if (s === 'idle') slConnect(); else slDisconnect(); }
function setSlToken(v) { streamerState.slToken = String(v).trim(); saveStreamerData(); }

function daConnect(silent) {
    if (!streamerState.daToken) return showNotification(t('st.need_token'), 'error');
    if (_daClient) _daClient.disconnect();
    streamerState.autoConnect.donationalerts = true; saveStreamerData();
    _daClient = RCHInt.createDonationAlertsClient({
        token: streamerState.daToken,
        onStatus: (s, d) => { _setInteg('donationalerts', s, d); if (s === 'connected' && !silent) showNotification('DonationAlerts: ' + t('st.state_on'), 'success'); },
        onDonation: handleDonation,
    });
    _daClient.connect();
}
function daDisconnect() { streamerState.autoConnect.donationalerts = false; saveStreamerData(); if (_daClient) _daClient.disconnect(); _daClient = null; _setInteg('donationalerts', 'idle'); }
function daToggle() { const s = streamerState.integ.donationalerts.status; if (s === 'idle') daConnect(); else daDisconnect(); }
function setDaToken(v) { streamerState.daToken = String(v).trim(); saveStreamerData(); }
function setDaClientId(v) { streamerState.daClientId = String(v).trim(); saveStreamerData(); }
function daAuthorize() {
    if (!/^\d+$/.test(streamerState.daClientId)) return showNotification(t('st.need_client_id'), 'error');
    const redirect = location.origin + location.pathname;
    location.href = 'https://www.donationalerts.com/oauth/authorize?client_id=' + encodeURIComponent(streamerState.daClientId) +
        '&redirect_uri=' + encodeURIComponent(redirect) + '&response_type=token&scope=' + encodeURIComponent('oauth-user-show oauth-donation-subscribe');
}
function _handleOAuthReturn() {
    if (!/access_token=/.test(location.hash)) return;
    const p = new URLSearchParams(location.hash.slice(1));
    const tok = p.get('access_token');
    if (tok) {
        streamerState.daToken = tok; streamerState.autoConnect.donationalerts = true; saveStreamerData();
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
        currentTab = 'auction';
        setTimeout(() => { showNotification(t('st.da_token_received'), 'success'); daConnect(true); }, 800);
    }
}

// ── VOTING ────────────────────────────────────────────────
function _allTasksFlat() {
    const out = [];
    Object.entries(games).forEach(([g, ts]) => ts.forEach(tk => out.push({ game: g, task: tk })));
    return out;
}
function _sample(arr, n) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
}
function buildVoteDraft() {
    const n = Math.max(2, Math.min(8, streamerState.voteCount || 4));
    let items = [];
    if (streamerState.voteSource === 'custom') {
        items = streamerState.voteCustom.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 8).map(x => ({ label: x, kind: 'custom' }));
    } else if (streamerState.voteSource === 'tasks') {
        items = _sample(_allTasksFlat(), n).map(x => ({ label: x.task, game: x.game, kind: 'task' }));
    } else {
        items = _sample(Object.keys(games).filter(g => games[g].length), n).map(g => ({ label: g, game: g, kind: 'game' }));
    }
    streamerState.voteDraft = items;
    return items;
}
function setVoteSource(v) { streamerState.voteSource = v; saveStreamerData(); buildVoteDraft(); _refreshVoteUI(); }
function setVoteCount(v) { streamerState.voteCount = parseInt(v, 10) || 4; saveStreamerData(); buildVoteDraft(); _refreshVoteUI(); }
function setVoteCustom(v) { streamerState.voteCustom = v; saveStreamerData(); buildVoteDraft(); const l = document.getElementById('voteDraftList'); if (l) l.innerHTML = _voteDraftHtml(); }
function shuffleVoteDraft() { buildVoteDraft(); _refreshVoteUI(); }
function _refreshVoteUI() { const va = document.getElementById('voteArea'); if (va) va.innerHTML = renderVoteArea(); }

function _voteDraftHtml() {
    const d = streamerState.voteDraft;
    if (!d.length) return `<div class="muted">${esc(t('streamer.no_games_vote'))}</div>`;
    return d.map((o, i) => `<div class="vote-option"><span class="vote-option-key">${i + 1}</span><span class="vote-option-name">${esc(o.label)}</span>${o.game && o.kind === 'task' ? `<span class="muted small">${esc(o.game)}</span>` : ''}</div>`).join('');
}

function renderVoteArea() {
    const S = streamerState, ok = S.twitchStatus === 'connected';
    if (S.voteActive) {
        const total = Object.values(S.voteVotes).reduce((s, v) => s + v.count, 0);
        return `
        ${S.voteTitle ? `<div class="vote-topic">${esc(S.voteTitle)}</div>` : ''}
        <div class="vote-head"><div class="vote-timer ${S.voteTimer <= 5 ? 'urgent' : ''}" id="voteCountdown">${esc(t('overlay.vote_sec', { n: S.voteTimer }))}</div>
            <div class="muted small" id="voteVoters">${esc(t('streamer.vote_voters', { n: Object.keys(S.voteVoters).length }))}</div></div>
        <div class="vote-options">${S.voteOptions.map((o, i) => {
            const c = S.voteVotes[i + 1]?.count || 0, pct = total ? Math.round(c / total * 100) : 0;
            return `<div class="vote-option"><span class="vote-option-key">${i + 1}</span>
              <div class="vote-option-body"><span class="vote-option-name">${esc(o.label)}</span><div class="vote-option-bar"><div class="vote-option-fill" id="vf${i}" style="width:${pct}%"></div></div></div>
              <span class="vote-option-count" id="vc${i}">${c} (${pct}%)</span></div>`;
        }).join('')}</div>
        <button onclick="stopVote()" class="cyber-btn danger-btn block">${esc(t('streamer.vote_stop_btn'))}</button>`;
    }
    const lv = S.lastVote;
    if (!S.voteDraft.length) buildVoteDraft();
    return `
        ${lv ? `<div class="vote-result"><div><b>${esc(lv.label)}</b><div class="muted small">${esc(lv.note)}</div></div>
            ${lv.kind === 'game' ? `<button class="cyber-btn primary-btn" onclick="applyVoteWinner()">${esc(t('st.vote_apply_game'))}</button>` : ''}
            ${lv.kind === 'task' ? `<button class="cyber-btn primary-btn" onclick="applyVoteWinner()">${esc(t('st.vote_apply_task'))}</button>` : ''}</div>` : ''}
        <div class="field-row"><label>${esc(t('st.vote_source'))}</label>
            <select onchange="setVoteSource(this.value)">
              <option value="games" ${S.voteSource === 'games' ? 'selected' : ''}>${esc(t('st.vote_src_games'))}</option>
              <option value="tasks" ${S.voteSource === 'tasks' ? 'selected' : ''}>${esc(t('st.vote_src_tasks'))}</option>
              <option value="custom" ${S.voteSource === 'custom' ? 'selected' : ''}>${esc(t('st.vote_src_custom'))}</option></select></div>
        ${S.voteSource === 'custom'
            ? `<textarea rows="4" placeholder="${esc(t('st.vote_custom_hint'))}" oninput="setVoteCustom(this.value)">${esc(S.voteCustom)}</textarea>`
            : `<div class="field-row"><label>${esc(t('st.vote_count'))}</label><input type="number" min="2" max="8" value="${S.voteCount}" onchange="setVoteCount(this.value)">
               <button class="cyber-btn" onclick="shuffleVoteDraft()" title="${esc(t('st.vote_shuffle'))}"><i class="bi bi-dice-3-fill" aria-hidden="true"></i> ${esc(t('st.vote_shuffle'))}</button></div>`}
        <div class="vote-options" id="voteDraftList">${_voteDraftHtml()}</div>
        <div class="field-row"><input type="text" id="voteTitle" placeholder="${esc(t('streamer.vote_topic'))}" value="${esc(S.voteTitle)}" oninput="streamerState.voteTitle=this.value;saveStreamerData()">
            <input type="number" id="voteDuration" min="10" max="600" value="${S.voteDuration}" style="max-width:90px" oninput="streamerState.voteDuration=parseInt(this.value)||30;saveStreamerData()"><span class="muted small">${esc(t('streamer.vote_sec_label'))}</span></div>
        <p class="muted small">${esc(t('st.vote_how'))}</p>
        <button onclick="startVote()" class="cyber-btn add-btn block" ${ok && S.voteDraft.length >= 2 ? '' : 'disabled'}>${esc(ok ? t('streamer.vote_start_btn') : t('streamer.vote_connect_first'))}</button>`;
}

function startVote() {
    const S = streamerState;
    if (S.twitchStatus !== 'connected') return showNotification(t('streamer.connect_first_vote'), 'warning');
    if (S.voteActive) return;
    if (!S.voteDraft.length) buildVoteDraft();
    if (S.voteDraft.length < 2) return showNotification(t('st.vote_need_two'), 'error');
    const tt = document.getElementById('voteTitle'); if (tt) S.voteTitle = tt.value.trim();
    S.voteOptions = S.voteDraft.slice();
    S.voteVotes = {}; S.voteVoters = {};
    S.voteOptions.forEach((o, i) => { S.voteVotes[i + 1] = { option: o, count: 0 }; });
    S.voteActive = true; S.lastVote = null;
    S.voteEndsAt = Date.now() + (S.voteDuration || 30) * 1000;
    S.voteTimer = S.voteDuration || 30;
    showNotification(t('streamer.vote_started', { topic: S.voteTitle ? ` "${S.voteTitle}"` : '', n: S.voteOptions.length }), 'success');
    _publishVote();
    S.voteInterval = setInterval(() => {
        S.voteTimer = Math.max(0, Math.ceil((S.voteEndsAt - Date.now()) / 1000));
        const cd = document.getElementById('voteCountdown');
        if (cd) { cd.textContent = t('overlay.vote_sec', { n: S.voteTimer }); cd.classList.toggle('urgent', S.voteTimer <= 5); }
        if (S.voteTimer <= 0) stopVote();
    }, 250);
    _refreshVoteUI();
}
let _voteOvT = null;
function _publishVote() {
    const S = streamerState;
    try {
        RCHBus.publish('overlayVote', {
            active: S.voteActive, title: S.voteTitle, endsAt: S.voteEndsAt, voters: Object.keys(S.voteVoters).length,
            options: S.voteOptions.map((o, i) => ({ name: o.label, count: S.voteVotes[i + 1]?.count || 0 })),
        });
    } catch (e) { }
}
function _castVote(user, text) {
    const S = streamerState;
    const m = text.trim().match(/^(?:!vote\s+|!)?(\d{1,2})$/i);
    if (!m) return;
    const n = parseInt(m[1], 10);
    if (n < 1 || n > S.voteOptions.length) return;
    const prev = S.voteVoters[user];
    if (prev === n) return;
    if (prev) S.voteVotes[prev].count--;
    S.voteVoters[user] = n; S.voteVotes[n].count++;
    _refreshVoteBars();
    if (!_voteOvT) _voteOvT = setTimeout(() => { _voteOvT = null; _publishVote(); }, 300);
}
function _refreshVoteBars() {
    const S = streamerState;
    const total = Object.values(S.voteVotes).reduce((s, v) => s + v.count, 0);
    S.voteOptions.forEach((_, i) => {
        const c = S.voteVotes[i + 1]?.count || 0, pct = total ? Math.round(c / total * 100) : 0;
        const f = document.getElementById('vf' + i), l = document.getElementById('vc' + i);
        if (f) f.style.width = pct + '%'; if (l) l.textContent = `${c} (${pct}%)`;
    });
    const v = document.getElementById('voteVoters'); if (v) v.textContent = t('streamer.vote_voters', { n: Object.keys(S.voteVoters).length });
}
function stopVote() {
    const S = streamerState;
    if (!S.voteActive) return;
    clearInterval(S.voteInterval); S.voteInterval = null; S.voteActive = false;
    const counts = S.voteOptions.map((_, i) => S.voteVotes[i + 1]?.count || 0);
    const max = Math.max(0, ...counts);
    const voters = Object.keys(S.voteVoters).length;
    if (max > 0) {
        const tied = counts.map((c, i) => c === max ? i : -1).filter(i => i >= 0);
        const win = S.voteOptions[tied[Math.floor(Math.random() * tied.length)]];
        const note = t('streamer.vote_from', { n: voters }) + (tied.length > 1 ? ' · ' + t('st.vote_tie', { n: tied.length }) : '') + ` · ${max}`;
        S.lastVote = { label: win.label, kind: win.kind, game: win.game, note };
        showNotification(t('streamer.vote_winner', { name: win.label, votes: max, viewers: voters }), 'success');
        rchOverlay({ type: 'winner', name: win.label, from: note });
        playWinSound(); if (rouletteSettings.particleEffect) createParticles();
    } else {
        S.lastVote = null; showNotification(t('streamer.vote_no_votes'), 'info'); rchOverlay({ type: 'idle' });
    }
    _publishVote(); _refreshVoteUI();
}
function applyVoteWinner() {
    const lv = streamerState.lastVote; if (!lv) return;
    if (lv.kind === 'game' && games[lv.label]) {
        rouletteMode = 'task-only'; taskOnlyState.selectedGame = lv.label; saveAll(); updateWheelSegments(); switchTab('roulette');
    } else if (lv.kind === 'task') {
        const p = players.length ? players[Math.floor(Math.random() * players.length)] : null;
        showPopupResult(lv.game || '—', p, lv.label);
        rchOverlay({ type: 'result', game: lv.game || '—', player: p ? p.name : '—', task: lv.label, duration: 12000 });
    }
}

// ── TIMER (timestamp based) ───────────────────────────────
function timerRemaining() {
    return streamerState.timerRunning ? Math.max(0, Math.ceil((streamerState.timerEndsAt - Date.now()) / 1000)) : streamerState.timerSeconds;
}
function setTimer() {
    const m = parseInt(document.getElementById('timerMinutes')?.value, 10) || 0;
    const s = parseInt(document.getElementById('timerSeconds2')?.value, 10) || 0;
    _timerStop(); streamerState.timerSeconds = m * 60 + s; streamerState.timerInitial = streamerState.timerSeconds;
    updateTimerDisplay(true);
}
function _timerStop() { clearInterval(streamerState.timerInterval); streamerState.timerInterval = null; streamerState.timerRunning = false; }
function startTimer() {
    const S = streamerState;
    if (S.timerRunning) { S.timerSeconds = timerRemaining(); _timerStop(); updateTimerDisplay(true); return; }
    if (S.timerSeconds <= 0) return showNotification(t('streamer.timer_set_first'), 'warning');
    S.timerRunning = true; S.timerEndsAt = Date.now() + S.timerSeconds * 1000;
    let lastShown = -1;
    S.timerInterval = setInterval(() => {
        const r = timerRemaining();
        if (r !== lastShown) { lastShown = r; updateTimerDisplay(); }
        if (r <= 0) {
            _timerStop(); S.timerSeconds = 0; updateTimerDisplay(true);
            playWinSound(); showNotification(t('streamer.timer_done'), 'warning');
        }
    }, 200);
    updateTimerDisplay(true);
}
function resetTimer() { _timerStop(); streamerState.timerSeconds = streamerState.timerInitial || 0; updateTimerDisplay(true); }
function addTime(secs) {
    const S = streamerState;
    if (S.timerRunning) S.timerEndsAt += secs * 1000; else S.timerSeconds += secs;
    S.timerInitial = Math.max(S.timerInitial, timerRemaining());
    updateTimerDisplay(true); showNotification(t('streamer.timer_added', { n: secs }), 'info');
}
function setTimerFromChat(minutes) {
    _timerStop(); streamerState.timerSeconds = Math.round(minutes * 60); streamerState.timerInitial = streamerState.timerSeconds;
    startTimer(); showNotification(t('streamer.stats_min', { n: minutes }), 'info');
}
function formatTime(s) {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = n => String(n).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}
function updateTimerDisplay() {
    const S = streamerState, r = timerRemaining();
    const d = document.getElementById('timerDisplay');
    if (d) { d.textContent = formatTime(r); d.className = 'timer-display' + (r <= 10 && r > 0 ? ' danger' : r <= 30 && r > 0 ? ' warning' : ''); }
    const b = document.getElementById('timerStartBtn'); if (b) b.textContent = S.timerRunning ? t('streamer.timer_pause') : t('streamer.timer_start');
    try { RCHBus.publish('overlayTimer', { seconds: r, initial: S.timerInitial, running: S.timerRunning, endsAt: S.timerRunning ? S.timerEndsAt : 0 }); } catch (e) { }
}

// ── VIEWER WHEEL ──────────────────────────────────────────
let _viewerAngle = 0, _viewerSpinning = false;
function _viewerSegs() {
    const S = streamerState, scheme = COLOR_SCHEMES[rouletteSettings.colorScheme] || COLOR_SCHEMES.default;
    return S.subWheelList.map((name, i) => {
        const a = S.userActivity[name.toLowerCase()];
        let w = 1;
        if (S.viewerWeight === 'activity' && a) w = 1 + Math.min(4, Math.log2(1 + a.messages));
        if (S.viewerWeight === 'subs' && a && a.isSub) w = 2;
        return { label: name, color: scheme[i % scheme.length], weight: w };
    });
}
function drawViewerWheel() {
    const c = document.getElementById('viewerWheel'); if (!c) return;
    const segs = _viewerSegs();
    if (!segs.length) { const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); return; }
    RCHWheel.draw(c, segs, _viewerAngle, { size: 300, fontSize: 12, centerIcon: 'heart-fill' });
}
function renderViewerCard() {
    const S = streamerState, n = S.subWheelList.length;
    return `
      <div class="field-row"><input type="text" id="subNameInput" placeholder="${esc(t('streamer.sub_placeholder'))}" onkeypress="if(event.key==='Enter')addSubToWheel()">
        <button onclick="addSubToWheel()" class="cyber-btn add-btn">${esc(t('streamer.sub_add_btn'))}</button></div>
      <div class="viewer-stage">${n ? `<div class="viewer-wheel-wrap"><span class="viewer-pointer"><i class="bi bi-caret-down-fill" aria-hidden="true"></i></span><canvas id="viewerWheel" width="300" height="300"></canvas></div>` : ''}
        <div class="viewer-banner" id="viewerBanner" aria-live="polite"></div></div>
      <div class="sub-list">${n ? S.subWheelList.map((x, i) => `<span class="sub-tag" data-idx="${i}" onclick="removeSubFromWheel(+this.dataset.idx)" title="${esc(t('common.delete'))}">${esc(x)} ×</span>`).join('')
        : `<span class="muted small">${esc(t('streamer.sub_empty'))}</span>`}</div>
      <div class="field-row"><label>${esc(t('st.viewer_weight'))}</label>
        <select onchange="streamerState.viewerWeight=this.value;saveStreamerData();drawViewerWheel()">
          <option value="equal" ${S.viewerWeight === 'equal' ? 'selected' : ''}>${esc(t('st.weight_equal'))}</option>
          <option value="activity" ${S.viewerWeight === 'activity' ? 'selected' : ''}>${esc(t('st.weight_activity'))}</option>
          <option value="subs" ${S.viewerWeight === 'subs' ? 'selected' : ''}>${esc(t('st.weight_subs'))}</option></select></div>
      <label class="check-row"><input type="checkbox" ${S.viewerRemoveWinner ? 'checked' : ''} onchange="streamerState.viewerRemoveWinner=this.checked;saveStreamerData()"> ${esc(t('st.remove_winner'))}</label>
      <button onclick="spinSubWheel()" class="cyber-btn spin-btn block" ${n ? '' : 'disabled'}>${esc(t('streamer.sub_spin_btn'))}</button>
      <div class="field-row">
        <button onclick="addAllChattersToWheel()" class="cyber-btn primary-btn js-needs-chat" ${S.twitchStatus === 'connected' ? '' : 'disabled'}>${esc(t('streamer.sub_all_chat'))}</button>
        ${n ? `<button onclick="clearSubWheel()" class="cyber-btn danger-btn">${esc(t('streamer.sub_clear'))}</button>` : ''}</div>
      ${S.viewerWinners.length ? `<div class="muted small">${esc(t('st.winners'))}: ${S.viewerWinners.slice(0, 6).map(esc).join(', ')}</div>` : ''}`;
}
function refreshViewerCard() {
    const el = document.getElementById('viewerCard'); if (!el) return;
    el.innerHTML = renderViewerCard(); drawViewerWheel();
}
function addSubToWheel() {
    const inp = document.getElementById('subNameInput'); if (!inp) return;
    const name = inp.value.trim().slice(0, 40); if (!name) return;
    if (_inWheel(name)) { showNotification(t('streamer.all_already_in_wheel'), 'info'); return; }
    streamerState.subWheelList.push(name); saveStreamerData(); refreshViewerCard();
    const i2 = document.getElementById('subNameInput'); if (i2) i2.focus();
}
function removeSubFromWheel(i) { streamerState.subWheelList.splice(i, 1); saveStreamerData(); refreshViewerCard(); }
function clearSubWheel() { streamerState.subWheelList = []; saveStreamerData(); refreshViewerCard(); showNotification(t('streamer.sub_cleared'), 'info'); }
function spinSubWheel() {
    const S = streamerState;
    if (_viewerSpinning) return;
    if (!S.subWheelList.length) return showNotification(t('streamer.sub_no_viewers'), 'error');
    const segs = _viewerSegs();
    const target = RCHWheel.pickIndex(segs);
    const canvas = document.getElementById('viewerWheel');
    const duration = Math.max(3000, rouletteSettings.spinDuration * 0.8);
    const banner = document.getElementById('viewerBanner'); if (banner) banner.textContent = '';
    const finish = () => {
        const winner = segs[target].label;
        _viewerSpinning = false;
        playWinSound(); if (rouletteSettings.particleEffect) createParticles();
        if (banner) banner.innerHTML = `<span class="winner-name"><i class="bi bi-trophy-fill" aria-hidden="true"></i> ${esc(winner)}</span><span class="muted small">${esc(t('streamer.sub_from', { n: segs.length }))}</span>`;
        rchOverlay({ type: 'winner', name: winner, from: t('streamer.sub_from', { n: segs.length }) });
        S.viewerWinners.unshift(winner); S.viewerWinners.length = Math.min(S.viewerWinners.length, 20);
        if (S.viewerRemoveWinner) { S.subWheelList.splice(target, 1); }
        saveStreamerData();
        setTimeout(() => { if (banner && document.getElementById('viewerBanner') === banner) { const keep = banner.innerHTML; refreshViewerCard(); const nb = document.getElementById('viewerBanner'); if (nb) nb.innerHTML = keep; } }, 600);
    };
    _viewerSpinning = true;
    if (!canvas) { finish(); return; }
    if (rouletteSettings.soundEnabled) playSpinSound();
    const run = RCHWheel.spin({
        canvas, segs, targetIdx: target, startAngle: _viewerAngle, duration, spins: 5,
        drawOpts: { size: 300, fontSize: 12, centerIcon: 'heart-fill' },
        onTick: () => { if (rouletteSettings.tickSoundEnabled) playTickSound(); },
        onDone: ang => { _viewerAngle = ang % RCHWheel.TAU; finish(); },
    });
    publishWheel(t('streamer.subwheel_title'), segs, { startAngle: _viewerAngle, total: run.total, duration }, segs[target].label);
}

// ── VIEWER SUGGESTIONS ────────────────────────────────────
function addSuggestion(who, text) {
    const S = streamerState;
    if (!S.suggestEnabled) return;
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text.length < 4 || text.length > 140 || /https?:\/\/|www\./i.test(text)) return;
    const key = who.toLowerCase(), now = Date.now();
    if (S._suggestSeen[key] && now - S._suggestSeen[key] < 60000) return;
    S._suggestSeen[key] = now;
    if (S.suggestions.some(s => s.text.toLowerCase() === text.toLowerCase())) return;
    S.suggestions.push({ id: now + Math.random(), who, text });
    if (S.suggestions.length > 50) S.suggestions.shift();
    saveStreamerData(); refreshSuggestCard();
    showNotification(t('st.suggest_new', { name: who }), 'info');
}
function renderSuggestCard() {
    const S = streamerState;
    const opts = Object.keys(games).map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
    return `<label class="check-row"><input type="checkbox" ${S.suggestEnabled ? 'checked' : ''} onchange="streamerState.suggestEnabled=this.checked;saveStreamerData()"> ${esc(t('st.suggest_enable'))}</label>
      ${S.suggestions.length ? `<div class="field-row"><label>${esc(t('st.suggest_target'))}</label><select id="suggestGame">${opts}</select></div>
        <div class="suggest-list">${S.suggestions.map(s => `<div class="suggest-item"><div><div class="suggest-text">${esc(s.text)}</div><div class="muted small">${esc(s.who)}</div></div>
          <button class="cyber-btn add-btn" data-id="${s.id}" onclick="approveSuggestion(this.dataset.id)" title="${esc(t('st.approve'))}"><i class="bi bi-check-lg" aria-hidden="true"></i></button>
          <button class="cyber-btn danger-btn" data-id="${s.id}" onclick="rejectSuggestion(this.dataset.id)" title="${esc(t('common.delete'))}"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>`).join('')}</div>
        <button class="cyber-btn" onclick="streamerState.suggestions=[];saveStreamerData();refreshSuggestCard()">${esc(t('streamer.sub_clear'))}</button>`
        : `<p class="muted small">${esc(t('st.suggest_empty'))}</p>`}`;
}
function refreshSuggestCard() { const e = document.getElementById('suggestCard'); if (e) e.innerHTML = renderSuggestCard(); }
function approveSuggestion(id) {
    const S = streamerState, i = S.suggestions.findIndex(s => String(s.id) === String(id)); if (i < 0) return;
    const g = document.getElementById('suggestGame')?.value || Object.keys(games)[0];
    if (!g) return showNotification(t('games.no_game_selected'), 'warning');
    const txt = S.suggestions[i].text;
    if (!games[g].includes(txt)) { games[g].push(txt); saveAll(); updateWheelSegments(); showNotification(t('notif.task_added_to', { task: txt, game: g }), 'success'); }
    S.suggestions.splice(i, 1); saveStreamerData(); refreshSuggestCard();
}
function rejectSuggestion(id) { const S = streamerState; S.suggestions = S.suggestions.filter(s => String(s.id) !== String(id)); saveStreamerData(); refreshSuggestCard(); }

// ── CHAT PANEL ────────────────────────────────────────────
function _renderOneChatMsg(m) {
    const badge = m.badge ? `<span class="chat-badge ${esc(m.badge)}">${esc(m.badge)}</span>` : '';
    const col = /^#[0-9a-fA-F]{3,6}$/.test(m.color) ? m.color : '#818cf8';
    return `<div class="chat-msg">${badge}<span class="chat-user" style="color:${col}">${esc(m.user)}</span><span class="chat-text">: ${esc(m.text)}</span></div>`;
}
function renderChatMessages() {
    const msgs = streamerState.chatMessages;
    if (!msgs.length) return `<div class="chat-empty muted small">${esc(streamerState.twitchStatus === 'connected' ? t('streamer.chat_waiting') : t('streamer.chat_connect_first'))}</div>`;
    return msgs.slice(-60).map(_renderOneChatMsg).join('');
}
function clearChat() {
    streamerState.chatMessages = []; streamerState.chatStats = { totalMessages: 0, uniqueViewers: 0, mostActiveUser: '' };
    streamerState.userActivity = {}; saveStreamerData();
    const cb = document.getElementById('chatBox'); if (cb) cb.innerHTML = renderChatMessages();
    updateOverlayChatData(); showNotification(t('streamer.chat_cleared'), 'info');
}
function sendCommandsList() {
    const rows = ['!spin', '!vote [sec]', '!endvote', '!timer N | stop', '!addchatters', '!clearwheel', '!add name', '!join', '!task text', '!lots'].map((c, i) => `<li><code>${esc(c)}</code> — ${esc(t('st.cmd_' + i))}</li>`).join('');
    const modal = document.getElementById('confirmModal'); if (!modal) return;
    document.getElementById('modalTitle').textContent = t('streamer.chat_commands');
    document.getElementById('modalMessage').innerHTML = `<ul class="cmd-list">${rows}</ul>`;
    const b = document.getElementById('modalConfirm'); b.textContent = t('common.close'); b.onclick = closeModal;
    const c = modal.querySelector('.cancel-btn'); if (c) c.style.display = 'none';
    modal.classList.remove('hidden');
}

// ── STATS / EXPORT ────────────────────────────────────────
function showStreamStats() {
    const S = streamerState, dur = Math.round((Date.now() - (S.sessionStartTime || Date.now())) / 60000);
    const modal = document.getElementById('confirmModal'); if (!modal) return;
    document.getElementById('modalTitle').textContent = t('streamer.stats_title');
    const row = (k, v) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
    document.getElementById('modalMessage').innerHTML = `<div class="kv-list">
        ${row(t('streamer.stats_session'), t('streamer.stats_min', { n: dur }))}${row(t('streamer.stats_messages'), S.chatStats.totalMessages)}
        ${row(t('streamer.stats_unique'), S.chatStats.uniqueViewers)}${row(t('streamer.stats_most_active'), S.chatStats.mostActiveUser || t('streamer.stats_no_data'))}
        ${row(t('streamer.stats_in_wheel'), S.subWheelList.length)}${row(t('streamer.stats_participants'), t('streamer.stats_active', { n: getChatParticipants(1).length }))}</div>`;
    const b = document.getElementById('modalConfirm'); b.textContent = t('streamer.stats_close'); b.onclick = closeModal;
    const c = modal.querySelector('.cancel-btn'); if (c) c.style.display = 'none';
    modal.classList.remove('hidden');
}
function exportStreamData() {
    const S = streamerState;
    const data = {
        session: { channel: S.channelName, start: S.sessionStartTime, end: Date.now() }, chatStats: S.chatStats,
        participants: getChatParticipants(1), viewerWheel: S.subWheelList, recentMessages: S.chatMessages.slice(-50),
        donations: S.donations, exportDate: new Date().toISOString(),
    };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `stream-data-${S.channelName || 'session'}-${Date.now()}.json`; a.click();
    showNotification(t('streamer.export_done'), 'success');
}
function resetStreamSession() {
    showConfirmModal(t('streamer.reset_confirm'), t('streamer.reset_msg'), t('streamer.reset_btn2'), t('common.cancel'), () => {
        const S = streamerState;
        S.chatMessages = []; S.chatStats = { totalMessages: 0, uniqueViewers: 0, mostActiveUser: '' }; S.userActivity = {}; S.sessionStartTime = Date.now();
        saveStreamerData(); if (currentTab === 'streamer') switchTab('streamer');
        showNotification(t('streamer.session_reset'), 'success');
    });
}

// ── QUICK COMMANDS ────────────────────────────────────────
function quickSpin() {
    if (spinning) return showNotification(t('streamer.spinning_already'), 'warning');
    if (currentTab !== 'roulette') { switchTab('roulette'); setTimeout(startSpin, 450); } else startSpin();
}
function quickCopyResult() {
    const rc = document.getElementById('resultContent');
    if (!rc || !rc.textContent.trim()) return showNotification(t('notif.no_result_copy'), 'warning');
    navigator.clipboard.writeText(rc.innerText).then(() => showNotification(t('notif.copied'), 'success')).catch(() => showNotification(t('notif.copy_error'), 'error'));
}
function quickShareResult() { exportResults(); }
function quickResetSession() {
    showConfirmModal(t('streamer.reset_confirm'), t('streamer.reset_msg'), t('streamer.reset_btn2'), t('common.cancel'), () => { resetGameFirstMode(); showNotification(t('streamer.session_reset'), 'success'); });
}

// ── OBS OVERLAY LINKS ─────────────────────────────────────
function getOverlayUrl(only) {
    const base = window.location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '') + 'overlay.html';
    const q = ['obs=1']; if (only && only !== 'all') q.push('only=' + only);
    if (rouletteSettings.chromaKey) q.push('chroma=1');
    return base + '?' + q.join('&');
}
function overlayUrlChanged() {
    const sel = document.getElementById('overlayWidgetSel'), inp = document.getElementById('overlayUrlInput');
    if (sel && inp) inp.value = getOverlayUrl(sel.value);
}
function copyOverlayUrl() {
    const inp = document.getElementById('overlayUrlInput'); const url = inp ? inp.value : getOverlayUrl();
    navigator.clipboard.writeText(url).then(() => showNotification(t('streamer.url_copied'), 'success')).catch(() => showNotification(t('streamer.url_copy_error'), 'error'));
}
function openOverlayWindow() {
    const w = window.open(getOverlayUrl('all').replace('obs=1&', '').replace('?obs=1', '?preview=1'), 'obs-overlay');
    showNotification(w ? t('streamer.overlay_opened') : t('streamer.overlay_blocked'), w ? 'info' : 'warning');
}
function toggleChromaKey() {
    rouletteSettings.chromaKey = !rouletteSettings.chromaKey; saveSettings();
    showNotification(rouletteSettings.chromaKey ? t('streamer.chroma_on') : t('streamer.chroma_off'), 'info');
    switchTab('streamer');
}

// ── STREAMER TAB ──────────────────────────────────────────
function _chip(svc, name) {
    return `<button type="button" class="conn-chip" data-svc="${svc}" data-state="idle" onclick="switchTab('${svc === 'twitch' ? 'streamer' : 'auction'}')"><span class="conn-dot"></span><span class="conn-name">${name}</span><span class="conn-label"></span></button>`;
}
function renderStreamerTab() {
    const S = streamerState;
    const card = (icon, title, desc, body, id) => `<section class="streamer-tool-card" ${id ? `id="${id}"` : ''}>
        <header class="streamer-tool-header"><span class="streamer-tool-icon">${icon}</span><div><h3 class="streamer-tool-title">${esc(title)}</h3><p class="streamer-tool-desc">${esc(desc)}</p></div></header>${body}</section>`;
    return `<div class="streamer-panel">
      <div class="streamer-hero"><div><h2>${esc(t('streamer.hero_title'))}</h2><p>${esc(t('streamer.hero_desc'))}</p></div>
        <div class="conn-chips">${_chip('twitch', 'Twitch')}${_chip('streamlabs', 'Streamlabs')}${_chip('donationalerts', 'DonationAlerts')}</div></div>
      <div class="streamer-tools-grid">
        ${card(bi('display'), t('streamer.obs_title'), t('streamer.obs_desc'), `
          <div class="field-row"><select id="overlayWidgetSel" onchange="overlayUrlChanged()">
              ${['all', 'result', 'timer', 'chat', 'auction', 'alerts', 'wheel'].map(k => `<option value="${k}">${esc(t('st.ow_' + k))}</option>`).join('')}</select></div>
          <div class="overlay-url-box"><input type="text" id="overlayUrlInput" readonly value="${esc(getOverlayUrl('all'))}" onfocus="this.select()">
            <button onclick="copyOverlayUrl()" class="cyber-btn primary-btn"><i class="bi bi-clipboard-check" aria-hidden="true"></i> ${esc(t('st.copy'))}</button></div>
          <div class="streamer-tool-actions"><button onclick="openOverlayWindow()" class="cyber-btn add-btn">${esc(t('streamer.obs_open'))}</button>
            <button onclick="toggleChromaKey()" class="cyber-btn ${rouletteSettings.chromaKey ? 'primary-btn' : ''}">${esc(t('streamer.obs_chroma'))}</button></div>
          <p class="muted small">${esc(t('st.obs_sync_hint'))}</p>`)}

        ${card(bi('check2-square'), t('streamer.vote_title'), t('streamer.vote_desc'), `
          <div class="channel-input-group"><input type="text" class="js-channel-input" id="channelNameInput" placeholder="${esc(t('streamer.channel_placeholder'))}" value="${esc(S.channelName)}" oninput="updateChannelName(this.value)" onkeypress="if(event.key==='Enter')twitchToggleConnect('channelNameInput')" autocomplete="off" autocapitalize="off">
            <button onclick="twitchToggleConnect('channelNameInput')" class="cyber-btn add-btn js-twitch-btn"></button></div>
          <div class="conn-status js-twitch-status idle"></div>
          <p class="muted small">${esc(t('streamer.readonly_hint'))}</p>
          <div id="voteArea">${renderVoteArea()}</div>`)}

        ${card(bi('stopwatch-fill'), t('streamer.timer_title'), t('streamer.timer_desc'), `
          <div class="timer-display" id="timerDisplay">${formatTime(timerRemaining())}</div>
          <div class="field-row"><input type="number" id="timerMinutes" placeholder="${esc(t('streamer.timer_min'))}" min="0" max="999" value="5"><input type="number" id="timerSeconds2" placeholder="${esc(t('streamer.timer_sec'))}" min="0" max="59" value="0">
            <button onclick="setTimer()" class="cyber-btn primary-btn">${esc(t('streamer.timer_set_btn'))}</button></div>
          <div class="timer-controls"><button onclick="startTimer()" class="cyber-btn add-btn" id="timerStartBtn">${esc(S.timerRunning ? t('streamer.timer_pause') : t('streamer.timer_start'))}</button>
            <button onclick="resetTimer()" class="cyber-btn danger-btn">${esc(t('streamer.timer_reset'))}</button>
            <button onclick="addTime(30)" class="cyber-btn">${esc(t('streamer.timer_add30'))}</button><button onclick="addTime(60)" class="cyber-btn">${esc(t('streamer.timer_add1m'))}</button></div>`)}

        ${card(bi('heart-fill'), t('streamer.subwheel_title'), t('streamer.subwheel_desc'), '<div id="viewerCard">' + renderViewerCard() + '</div>')}

        ${card(bi('pencil-square'), t('st.suggest_title'), t('st.suggest_desc'), '<div id="suggestCard">' + renderSuggestCard() + '</div>')}

        ${card(bi('chat-dots-fill'), t('streamer.chat_title'), t('streamer.chat_real_irc'), `
          <div class="chat-box" id="chatBox" role="log">${renderChatMessages()}</div>
          <div class="streamer-tool-actions"><button onclick="sendCommandsList()" class="cyber-btn primary-btn">${esc(t('streamer.chat_commands'))}</button>
            <button onclick="clearChat()" class="cyber-btn danger-btn">${esc(t('streamer.chat_clear'))}</button></div>
          ${S.chatStats.mostActiveUser ? `<p class="muted small">${esc(t('streamer.chat_most_active', { name: S.chatStats.mostActiveUser }))}</p>` : ''}`)}

        ${card(bi('lightning-charge-fill'), t('streamer.quick_title'), t('streamer.quick_desc'), `
          <div class="quick-commands">
            <button onclick="quickSpin()" class="quick-cmd-btn"><span class="cmd-icon"><i class="bi bi-dice-5-fill" aria-hidden="true"></i></span><span class="cmd-label">${esc(t('streamer.quick_spin'))}</span></button>
            <button onclick="quickCopyResult()" class="quick-cmd-btn"><span class="cmd-icon"><i class="bi bi-clipboard-check" aria-hidden="true"></i></span><span class="cmd-label">${esc(t('streamer.quick_copy'))}</span></button>
            <button onclick="switchTab('auction')" class="quick-cmd-btn"><span class="cmd-icon"><i class="bi bi-hammer" aria-hidden="true"></i></span><span class="cmd-label">${esc(t('tab.auction'))}</span></button>
            <button onclick="startVote()" class="quick-cmd-btn js-needs-chat"><span class="cmd-icon"><i class="bi bi-check2-square" aria-hidden="true"></i></span><span class="cmd-label">${esc(t('streamer.quick_vote'))}</span></button>
            <button onclick="openOverlayWindow()" class="quick-cmd-btn"><span class="cmd-icon"><i class="bi bi-display" aria-hidden="true"></i></span><span class="cmd-label">${esc(t('streamer.quick_overlay'))}</span></button>
            <button onclick="quickResetSession()" class="quick-cmd-btn"><span class="cmd-icon"><i class="bi bi-arrow-repeat" aria-hidden="true"></i></span><span class="cmd-label">${esc(t('streamer.quick_reset'))}</span></button></div>
          <label class="check-row"><input type="checkbox" ${S.chatSounds ? 'checked' : ''} onchange="toggleChatSounds(this.checked)"> ${esc(t('streamer.sounds_label'))}</label>
          <label class="check-row"><input type="checkbox" ${S.autoSpin ? 'checked' : ''} onchange="toggleAutoSpin(this.checked)"> ${esc(t('st.autospin_label'))}</label>
          <div class="streamer-tool-actions"><button onclick="showStreamStats()" class="cyber-btn">${esc(t('streamer.stats_btn'))}</button>
            <button onclick="exportStreamData()" class="cyber-btn export-btn">${esc(t('streamer.export_btn'))}</button>
            <button onclick="resetStreamSession()" class="cyber-btn danger-btn">${esc(t('streamer.reset_btn'))}</button></div>`)}
      </div></div>`;
}
function afterStreamerRender() {
    _updateConnectBtn(); drawViewerWheel(); refreshConnChips(); updateTimerDisplay();
    const cb = document.getElementById('chatBox'); if (cb) cb.scrollTop = cb.scrollHeight;
}
