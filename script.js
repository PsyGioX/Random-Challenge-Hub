// ============================================================
// RANDOM CHALLENGE HUB — MASTER SCRIPT v3.0
// Features: 5 themes, advanced wheel, streamer mode, OBS overlay,
//           chat vote, viewer wheel, timer, quick commands
// ============================================================

// ── i18n GUARD ────────────────────────────────────────────
// Fallback: if i18n.js hasn't loaded yet (e.g. direct file open),
// t() returns the last segment of the key so the UI still shows
// something readable instead of a blank.
if (typeof t !== 'function') {
    window.t = function (key, vars) {
        let s = String(key).split('.').pop().replace(/_/g, ' ');
        if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : '{' + k + '}');
        return s;
    };
}
// Re-run t() after language changes so dynamic renders pick up new lang
// NOTE: The main rch:langchange handler is in index.html and calls createTabs()
// to refresh tab labels. This fallback handles edge cases (e.g. file:// open).
window.addEventListener('rch:langchange', function () {
    // Only run if index.html's handler hasn't already rebuilt the tabs
    // (index.html's handler sets window.__rchLangHandled = true for the current event)
    if (window.__rchLangHandled) { window.__rchLangHandled = false; return; }
    if (typeof switchTab === 'function' && typeof currentTab !== 'undefined') {
        switchTab(currentTab);
    }
});

// ── GLOBAL STATE ──────────────────────────────────────────
// Безопасная загрузка из localStorage с защитой от повреждённых данных
function _safeParse(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        console.warn(`[Storage] Ошибка чтения "${key}":`, e);
        return fallback;
    }
}

let players = _safeParse('challengePlayers', []);
let games = {}; // инициализируется в init() — нормализация там

let currentTab = 'games';
let spinning = false;
let wheelSegments = [];
let currentWheelAngle = 0;
let animationId = null;
let rouletteMode = 'full';
let lastWinnerSegIdx = -1;          // индекс выигравшего сегмента для анимации удаления
let segmentScales = [];          // масштаб каждого сегмента (1 = норма, 0 = удалён)
let openDropdowns = {};
let modalCallback = null;
let audioCtx = null;
let currentTheme = localStorage.getItem('appTheme') || 'dark';
let settingsSubTab = 'speed';

// Spent tasks — elimination mode: { gameName: [task, ...], ... }
let spentTasks = _safeParse('spentTasks', {});

// Streamer state
let streamerState = {
    timerInterval: null,
    timerSeconds: 0,
    timerRunning: false,
    timerInitial: 0,
    chatMessages: [],
    voteActive: false,
    voteOptions: [],
    voteVotes: {},
    voteDuration: 30,
    voteTimer: 0,
    voteInterval: null,
    voteTitle: '',   // тема/название голосования
    subWheelList: [],
    channelName: '',
    connected: false,
    twitchWs: null,    // реальный WebSocket к Twitch IRC
    twitchStatus: 'idle',  // idle | connecting | connected | error
    // УДАЛЕНО: OAuth токен для отправки сообщений
    overlayOpen: false,
    // Новые данные для IndexedDB
    recentFollowers: [],
    recentSubscribers: [],
    chatStats: {
        totalMessages: 0,
        uniqueViewers: 0,
        mostActiveUser: '',
    }
};

// IndexedDB для сохранения данных стримера
let streamerDB = null;

// ── SECURITY UTILITIES ────────────────────────────────────
// Экранирование HTML для безопасной вставки пользовательских данных в innerHTML
function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// Экранирование для вставки строки в onclick="..." атрибуты
function escAttr(str) {
    return esc(str).replace(/`/g, '&#x60;');
}

// ── TWITCH IRC CONNECTION ─────────────────────────────────
const TWITCH_IRC = 'wss://irc-ws.chat.twitch.tv:443';

function twitchConnect(channel) {
    if (streamerState.twitchWs) {
        streamerState.twitchWs.close();
        streamerState.twitchWs = null;
    }
    if (!channel || !channel.trim()) {
        showNotification('Введите название канала', 'error');
        return;
    }
    const ch = channel.trim().toLowerCase().replace(/^#/, '');
    streamerState.channelName = ch;
    streamerState.twitchStatus = 'connecting';
    _updateConnectBtn();
    showNotification(t('streamer.connecting_to', { ch }), 'info');

    const ws = new WebSocket(TWITCH_IRC);
    streamerState.twitchWs = ws;

    ws.onopen = () => {
        // Анонимный доступ только для чтения
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send('NICK justinfan' + Math.floor(Math.random() * 80000 + 1000));
        ws.send(`JOIN #${ch}`);
    };

    ws.onmessage = (e) => {
        const raw = e.data;
        if (raw.startsWith('PING')) { ws.send('PONG :tmi.twitch.tv'); return; }
        if (raw.includes('PRIVMSG')) {
            _parseTwitchMsg(raw);
        }
        if (raw.includes(`JOIN #${ch}`) && streamerState.twitchStatus !== 'connected') {
            streamerState.twitchStatus = 'connected';
            streamerState.connected = true;
            _updateConnectBtn();
            showNotification(t('streamer.connected_msg', { ch }), 'success');
            saveStreamerData();
            updateOverlayChatData();
        }
    };

    ws.onerror = () => {
        streamerState.twitchStatus = 'error';
        streamerState.connected = false;
        _updateConnectBtn();
        showNotification(t('streamer.connect_error'), 'error');
        updateOverlayChatData();
    };

    ws.onclose = () => {
        if (streamerState.twitchStatus !== 'idle') {
            streamerState.twitchStatus = 'idle';
            streamerState.connected = false;
            _updateConnectBtn();
            updateOverlayChatData();
        }
    };
}


function twitchDisconnect() {
    if (streamerState.twitchWs) {
        streamerState.twitchWs.close();
        streamerState.twitchWs = null;
    }
    streamerState.twitchStatus = 'idle';
    streamerState.connected = false;
    _updateConnectBtn();
    showNotification(t('streamer.disconnected'), 'info');
    updateOverlayChatData();
}

// Отправка сообщений в чат недоступна без авторизации
function sendTwitchChatMessage(text) { return false; }

function _parseTwitchMsg(raw) {
    // Формат: @tags :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
    const tagsPart = raw.startsWith('@') ? raw.slice(1, raw.indexOf(' ')) : '';
    const rest = raw.startsWith('@') ? raw.slice(raw.indexOf(' ') + 1) : raw;
    const userMatch = rest.match(/^:(\w+)!/);
    const msgMatch = rest.match(/PRIVMSG #\S+ :(.+)/s);
    if (!userMatch || !msgMatch) return;

    const user = userMatch[1];
    const text = msgMatch[1].replace(/\r?\n$/, '').trim();

    // Разбираем теги (цвет, badges)
    const tags = {};
    tagsPart.split(';').forEach(t => { const [k, v] = t.split('='); if (k) tags[k] = v || '' });
    const color = tags['color'] || _randomChatColor(user);
    const isSub = tags['subscriber'] === '1';
    const isMod = tags['mod'] === '1';
    const isBroad = tags['badges'] && tags['badges'].includes('broadcaster');
    const badge = isBroad ? 'broadcaster' : isMod ? 'mod' : isSub ? 'sub' : '';

    const msgObj = { user, text, color, badge, timestamp: Date.now() };
    streamerState.chatMessages.push(msgObj);
    if (streamerState.chatMessages.length > 500) streamerState.chatMessages.shift();

    // Сохраняем в IndexedDB
    saveChatMessage(msgObj);

    // Обновляем чат-бокс если он виден
    const cb = document.getElementById('chatBox');
    if (cb) { cb.insertAdjacentHTML('beforeend', _renderOneChatMsg(msgObj)); cb.scrollTop = cb.scrollHeight; }

    // Воспроизводим звук уведомления
    playChatNotificationSound();

    // Обновляем данные для оверлея
    updateOverlayChatData();

    // Обрабатываем голосование
    if (streamerState.voteActive) {
        const num = parseInt(text.trim());
        if (num >= 1 && num <= streamerState.voteOptions.length) {
            // Каждый зритель голосует один раз (по нику)
            if (!streamerState.voteVoters) streamerState.voteVoters = {};
            if (!streamerState.voteVoters[user]) {
                streamerState.voteVoters[user] = num;
                if (streamerState.voteVotes[num]) {
                    streamerState.voteVotes[num].count++;
                    _refreshVoteUI();
                }
            }
        }
    }

    // Проверяем команды чата
    processChatCommand(user, text, { isBroad, isMod, isSub });

    // Автоматически добавляем активных пользователей в потенциальные участники колеса
    addChatUserToPool(user, { isBroad, isMod, isSub });
}

// Автоматический сбор участников чата для колеса
function addChatUserToPool(user, permissions) {
    // Инициализируем пул участников если его нет
    if (!streamerState.chatUserPool) {
        streamerState.chatUserPool = new Set();
    }

    // Добавляем пользователя в пул
    streamerState.chatUserPool.add(user);

    // Обновляем активность пользователя
    if (!streamerState.userActivity) {
        streamerState.userActivity = {};
    }

    if (!streamerState.userActivity[user]) {
        streamerState.userActivity[user] = {
            messages: 0,
            lastSeen: Date.now(),
            isSub: permissions.isSub,
            isMod: permissions.isMod,
            isBroadcaster: permissions.isBroad
        };
    }

    streamerState.userActivity[user].messages++;
    streamerState.userActivity[user].lastSeen = Date.now();

    // Сохраняем данные
    saveStreamerData();
}

// Получить список активных участников чата
function getChatParticipants(minMessages = 1, excludeMods = false) {
    if (!streamerState.userActivity) return [];

    const participants = [];
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000); // 1 час назад

    Object.entries(streamerState.userActivity).forEach(([user, data]) => {
        // Исключаем модераторов если нужно
        if (excludeMods && (data.isMod || data.isBroadcaster)) return;

        // Проверяем активность
        if (data.messages >= minMessages && data.lastSeen > oneHourAgo) {
            participants.push({
                user,
                messages: data.messages,
                isSub: data.isSub,
                isMod: data.isMod,
                lastSeen: data.lastSeen
            });
        }
    });

    // Сортируем по активности
    return participants.sort((a, b) => b.messages - a.messages);
}

function processChatCommand(user, text, permissions) {
    const { isBroad, isMod, isSub } = permissions;
    const isPrivileged = isBroad || isMod;

    // Команды только для модераторов и стримера
    if (isPrivileged) {
        if (text.toLowerCase() === '!spin') {
            quickSpin();
            return;
        }

        if (text.toLowerCase() === '!vote') {
            startVote();
            return;
        }

        if (text.toLowerCase().startsWith('!timer ')) {
            const timeMatch = text.match(/!timer (\d+)/);
            if (timeMatch) {
                const minutes = parseInt(timeMatch[1]);
                setTimerFromChat(minutes);
                return;
            }
        }

        if (text.toLowerCase() === '!addchatters') {
            addAllChattersToWheel();
            return;
        }

        if (text.toLowerCase() === '!clearwheel') {
            clearSubWheel();
            return;
        }
    }

    // Команды для всех зрителей
    if (text.toLowerCase() === '!join' || text.toLowerCase() === '!addme') {
        addSubToWheelFromChat(user);
        return;
    }

    if (text.toLowerCase() === '!commands' || text.toLowerCase() === '!help') {
        sendCommandsList();
        return;
    }
};

// Добавить всех активных участников чата в колесо
function addAllChattersToWheel() {
    const participants = getChatParticipants(1, false); // Минимум 1 сообщение, включая всех
    let added = 0;
    const addedUsers = [];

    participants.forEach(p => {
        if (!streamerState.subWheelList.includes(p.user)) {
            streamerState.subWheelList.push(p.user);
            addedUsers.push(p.user);
            added++;
        }
    });

    if (added > 0) {
        saveStreamerData();
        if (currentTab === 'streamer') switchTab('streamer');
        showNotification(t('streamer.all_chatters_added', { n: added }), 'success');
    } else {
        showNotification(t('streamer.all_already_in_wheel'), 'info');
    }
}

function addSubToWheelFromChat(user) {
    if (!streamerState.subWheelList.includes(user)) {
        streamerState.subWheelList.push(user);
        saveStreamerData();
        if (currentTab === 'streamer') switchTab('streamer');
        showNotification(t('streamer.sub_added', { name: user }), 'success');
    } else {
        showNotification(t('streamer.sub_active_count', { n: streamerState.subWheelList.length }), 'info');
    }
}

function setTimerFromChat(minutes) {
    streamerState.timerSeconds = minutes * 60;
    streamerState.timerInitial = streamerState.timerSeconds;
    updateTimerDisplay();
    showNotification(t('streamer.stats_min', { n: minutes }), 'info');
}

// Новые функции для инструментов стрима
function toggleChatSounds(enabled) {
    streamerState.chatSounds = enabled;
    saveStreamerData();
    showNotification(enabled ? t('streamer.chat_sounds_on') : t('streamer.chat_sounds_off'), 'info');
}

function toggleAutoSpin(enabled) {
    streamerState.autoSpin = enabled;
    saveStreamerData();
    showNotification(enabled ? t('streamer.autospin_on') : t('streamer.autospin_off'), 'info');
}

function playChatNotificationSound() {
    if (!streamerState.chatSounds) return;

    try {
        initAudio();
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) { }
}

function showStreamStats() {
    const participants = getChatParticipants(1);
    const totalMessages = streamerState.chatStats.totalMessages;
    const uniqueViewers = streamerState.chatStats.uniqueViewers;
    const mostActive = streamerState.chatStats.mostActiveUser;
    const sessionStart = streamerState.sessionStartTime || Date.now();
    const duration = Math.round((Date.now() - sessionStart) / (1000 * 60)); // минуты

    const modal = document.getElementById('confirmModal');
    if (modal) {
        document.getElementById('modalTitle').textContent = t('streamer.stats_title');
        document.getElementById('modalMessage').innerHTML = `
            <div style="text-align:left;font-size:13px;line-height:1.6">
                <div style="margin-bottom:12px"><strong>${t('streamer.stats_session')}</strong> ${t('streamer.stats_min', { n: duration })}</div>
                <div style="margin-bottom:12px"><strong>${t('streamer.stats_messages')}</strong> ${totalMessages}</div>
                <div style="margin-bottom:12px"><strong>${t('streamer.stats_unique')}</strong> ${uniqueViewers}</div>
                <div style="margin-bottom:12px"><strong>${t('streamer.stats_most_active')}</strong> ${mostActive || t('streamer.stats_no_data')}</div>
                <div style="margin-bottom:12px"><strong>${t('streamer.stats_in_wheel')}</strong> ${streamerState.subWheelList.length}</div>
                <div style="margin-bottom:12px"><strong>${t('streamer.stats_participants')}</strong> ${t('streamer.stats_active', { n: participants.length })}</div>
                ${streamerState.voteActive ? `<div style="color:var(--accent-warning)">${t('streamer.stats_vote_active')}</div>` : ''}
            </div>
        `;
        document.getElementById('modalConfirm').textContent = t('streamer.stats_close');
        document.getElementById('modalConfirm').onclick = closeModal;
        const cancelBtn = modal.querySelector('.cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';
        modal.classList.remove('hidden');
    }
}

function exportStreamData() {
    const data = {
        sessionInfo: {
            channelName: streamerState.channelName,
            startTime: streamerState.sessionStartTime || Date.now(),
            endTime: Date.now(),
            duration: Math.round((Date.now() - (streamerState.sessionStartTime || Date.now())) / (1000 * 60))
        },
        chatStats: streamerState.chatStats,
        participants: getChatParticipants(1),
        subWheelList: streamerState.subWheelList,
        userActivity: streamerState.userActivity || {},
        recentMessages: streamerState.chatMessages.slice(-50),
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stream-data-${streamerState.channelName}-${Date.now()}.json`;
    a.click();

    showNotification(t('streamer.export_done'), 'success');
}

function resetStreamSession() {
    showConfirmModal(t('streamer.reset_confirm'), t('streamer.reset_msg'), t('streamer.reset_btn2'), t('common.cancel'), () => {
        streamerState.chatMessages = [];
        streamerState.chatStats = { totalMessages: 0, uniqueViewers: 0, mostActiveUser: '' };
        streamerState.userActivity = {};
        streamerState.chatUserPool = new Set();
        streamerState.sessionStartTime = Date.now();
        saveStreamerData();
        if (currentTab === 'streamer') switchTab('streamer');
        showNotification(t('streamer.session_reset'), 'success');
    });
}

// ── OVERLAY CHAT DATA ─────────────────────────────────────
function updateOverlayChatData() {
    const chatData = {
        connected: streamerState.twitchStatus === 'connected',
        channelName: streamerState.channelName,
        messages: streamerState.chatMessages.slice(-20), // Последние 20 сообщений
        stats: streamerState.chatStats,
        timestamp: Date.now()
    };

    try {
        localStorage.setItem('overlayChatData', JSON.stringify(chatData));
    } catch (error) {
        console.warn('Не удалось обновить данные чата для оверлея:', error);
    }
}

function _randomChatColor(name) {
    const palette = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#67e8f9', '#a3e635', '#fb923c', '#e879f9'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}

function _renderOneChatMsg(m) {
    const badgeHtml = m.badge ? `<span class="chat-badge ${esc(m.badge)}">${esc(m.badge)}</span>` : '';
    const safeColor = /^#[0-9a-fA-F]{3,6}$/.test(m.color) ? m.color : '#818cf8';
    return `<div class="chat-msg"><span class="chat-user" style="color:${safeColor}">${badgeHtml}${esc(m.user)}</span><span class="chat-text">: ${esc(m.text)}</span></div>`;
}

function _updateConnectBtn() {
    const btn = document.getElementById('chatConnectBtn');
    if (!btn) return;
    const s = streamerState.twitchStatus;
    btn.textContent = s === 'connected' ? t('streamer.disconnect_btn')
        : s === 'connecting' ? t('streamer.connecting_btn')
            : s === 'error' ? t('streamer.error_btn')
                : t('streamer.connect_btn');
    btn.className = `cyber-btn channel-connect-btn ${s === 'connected' ? 'danger-btn' : 'add-btn'}`;
    btn.disabled = s === 'connecting';
    updateStreamerUIState();
}

function updateChannelName(name) {
    streamerState.channelName = name.trim().toLowerCase().replace(/^#/, '');
    saveStreamerData();
}

function twitchToggleConnect() {
    if (streamerState.connected) {
        twitchDisconnect();
    } else {
        const channel = document.getElementById('channelNameInput')?.value?.trim();
        if (channel) {
            twitchConnect(channel);
        } else {
            showNotification('Введите название канала', 'error');
        }
    }
}

function updateStreamerUIState() {
    const isConnected = streamerState.twitchStatus === 'connected';

    // Обновляем кнопку "Все из чата"
    const addChattersBtn = document.querySelector('button[onclick="addAllChattersToWheel()"]');
    if (addChattersBtn) {
        addChattersBtn.disabled = !isConnected;
    }

    // Обновляем кнопку "Команды"
    const commandsBtn = document.querySelector('button[onclick="sendCommandsList()"]');
    if (commandsBtn) {
        commandsBtn.disabled = !isConnected;
    }

    // Обновляем кнопку "Голосование" в быстрых командах
    const voteBtn = document.querySelector('.quick-cmd-btn[onclick="startVote()"]');
    if (voteBtn) {
        voteBtn.disabled = !isConnected;
    }

    // Принудительно обновляем область голосования
    const voteArea = document.getElementById('voteArea');
    if (voteArea) {
        voteArea.innerHTML = renderVoteArea();
    }

    // Обновляем статус бар чата
    const statusBar = document.getElementById('twitchStatusBar');
    if (statusBar) {
        const statusColor = isConnected ? 'var(--accent-success)'
            : streamerState.twitchStatus === 'error' ? 'var(--accent-danger)'
                : 'var(--text-muted)';
        statusBar.style.color = statusColor;

        statusBar.innerHTML = isConnected
            ? `<span style="display:inline-flex;align-items:center;gap:5px"><span class="overlay-dot"></span> ${t('streamer.status_reading', { ch: esc(streamerState.channelName) })}</span>`
            : streamerState.twitchStatus === 'connecting' ? t('streamer.status_connecting')
                : streamerState.twitchStatus === 'error' ? t('streamer.status_error')
                    : t('streamer.status_idle');
    }
}

function _refreshVoteUI() {
    const va = document.getElementById('voteArea');
    if (va) va.innerHTML = renderVoteArea();
}

// ── INDEXEDDB для стримера ────────────────────────────────
async function initStreamerDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('StreamerDatabase', 1);

        request.onerror = () => {
            console.warn('IndexedDB недоступна, используем localStorage');
            resolve();
        };

        request.onsuccess = (event) => {
            streamerDB = event.target.result;
            loadStreamerData();

            // Инициализируем время начала сессии
            if (!streamerState.sessionStartTime) {
                streamerState.sessionStartTime = Date.now();
                saveStreamerData();
            }

            resolve();
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Хранилище для сообщений чата
            if (!db.objectStoreNames.contains('chatMessages')) {
                const chatStore = db.createObjectStore('chatMessages', { keyPath: 'id', autoIncrement: true });
                chatStore.createIndex('timestamp', 'timestamp');
                chatStore.createIndex('user', 'user');
            }

            // Хранилище для подписчиков
            if (!db.objectStoreNames.contains('subscribers')) {
                const subStore = db.createObjectStore('subscribers', { keyPath: 'user' });
                subStore.createIndex('timestamp', 'timestamp');
            }

            // Хранилище для статистики
            if (!db.objectStoreNames.contains('chatStats')) {
                db.createObjectStore('chatStats', { keyPath: 'date' });
            }
        };
    });
}

async function saveStreamerData() {
    if (!streamerDB) {
        // Fallback to localStorage
        const dataToSave = {
            channelName: streamerState.channelName,
            subWheelList: streamerState.subWheelList,
            chatStats: streamerState.chatStats,
            chatSounds: streamerState.chatSounds,
            autoSpin: streamerState.autoSpin,
            sessionStartTime: streamerState.sessionStartTime,
            lastSaved: Date.now()
        };
        localStorage.setItem('streamerState', JSON.stringify(dataToSave));
        return;
    }

    try {
        const transaction = streamerDB.transaction(['chatStats'], 'readwrite');
        const store = transaction.objectStore('chatStats');

        const data = {
            date: 'singleton',          // keyPath — одна постоянная запись
            channelName: streamerState.channelName,
            subWheelList: streamerState.subWheelList,
            chatStats: streamerState.chatStats,
            chatSounds: streamerState.chatSounds,
            autoSpin: streamerState.autoSpin,
            sessionStartTime: streamerState.sessionStartTime,
            lastUpdated: Date.now()
        };

        await store.put(data);
    } catch (error) {
        console.warn('Ошибка сохранения в IndexedDB:', error);
        // Fallback to localStorage
        const dataToSave = {
            channelName: streamerState.channelName,
            subWheelList: streamerState.subWheelList,
            chatStats: streamerState.chatStats,
            chatSounds: streamerState.chatSounds,
            autoSpin: streamerState.autoSpin,
            sessionStartTime: streamerState.sessionStartTime,
            lastSaved: Date.now()
        };
        localStorage.setItem('streamerState', JSON.stringify(dataToSave));
    }
}

async function loadStreamerData() {
    if (!streamerDB) {
        // Fallback to localStorage
        const saved = localStorage.getItem('streamerState');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                // Восстанавливаем основные данные, но не состояние подключения
                streamerState.channelName = data.channelName || '';
                streamerState.subWheelList = data.subWheelList || [];
                streamerState.chatStats = data.chatStats || streamerState.chatStats;
                streamerState.chatSounds = data.chatSounds || false;
                streamerState.autoSpin = data.autoSpin || false;
                streamerState.sessionStartTime = data.sessionStartTime || Date.now();

                // Обновляем поля ввода при загрузке
                updateChannelInput();
                updateTokenInput();
            } catch (e) {
                console.warn('Ошибка загрузки из localStorage:', e);
            }
        }
        return;
    }

    try {
        const transaction = streamerDB.transaction(['chatStats'], 'readonly');
        const store = transaction.objectStore('chatStats');
        const request = store.getAll();

        request.onsuccess = () => {
            const results = request.result;
            if (results.length > 0) {
                const data = results[0];
                streamerState.channelName = data.channelName || '';
                streamerState.subWheelList = data.subWheelList || [];
                streamerState.chatStats = data.chatStats || streamerState.chatStats;
                streamerState.chatSounds = data.chatSounds || false;
                streamerState.autoSpin = data.autoSpin || false;
                streamerState.sessionStartTime = data.sessionStartTime || Date.now();

                // Обновляем поля ввода при загрузке
                updateChannelInput();
                updateTokenInput();
            }
        };
    } catch (error) {
        console.warn('Ошибка загрузки из IndexedDB:', error);
    }
}

function showReconnectToast(channelName) {
    // Убираем предыдущий тост, если есть
    const existing = document.getElementById('reconnectToast');
    if (existing) existing.remove();

    const group = document.querySelector('.channel-input-group');
    if (!group) return;

    const toast = document.createElement('div');
    toast.id = 'reconnectToast';
    toast.className = 'reconnect-toast';
    toast.innerHTML = `
        <span>${t('streamer.reconnect_msg', { ch: channelName })}</span>
        <div class="reconnect-toast-actions">
            <button class="reconnect-toast-yes" id="reconnectYes">${t('common.yes')}</button>
            <button class="reconnect-toast-no"  id="reconnectNo">${t('common.no')}</button>
        </div>
    `;
    group.insertAdjacentElement('afterend', toast);

    const dismiss = () => {
        toast.style.transition = 'opacity 0.2s, transform 0.2s';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-4px) scale(0.97)';
        setTimeout(() => toast.remove(), 220);
    };

    document.getElementById('reconnectYes').addEventListener('click', () => {
        dismiss();
        twitchConnect(channelName);
    });
    document.getElementById('reconnectNo').addEventListener('click', dismiss);

    // Автоскрытие через 8 секунд
    setTimeout(dismiss, 8000);
}

function updateChannelInput() {
    // Обновляем поле ввода с задержкой, чтобы UI был готов
    setTimeout(() => {
        const input = document.getElementById('channelNameInput');
        if (input && streamerState.channelName) {
            input.value = streamerState.channelName;
        }
    }, 100);
}

function updateChannelName(value) {
    streamerState.channelName = value.trim();
    // Сохраняем сразу при изменении
    saveStreamerData();
}

function updateTokenInput() {
    // Обновляем поле токена с задержкой
    setTimeout(() => {
        const input = document.getElementById('twitchTokenInput');
        if (input && streamerState.twitchToken) {
            input.value = streamerState.twitchToken;
        }
    }, 100);
}

// Функции авторизации УДАЛЕНЫ
function updateTwitchToken(value) {
    console.warn('Функция авторизации недоступна');
}

// Авторизация Twitch удалена — только чтение чата (анонимный IRC)

async function saveChatMessage(message) {
    if (!streamerDB) return;

    try {
        const transaction = streamerDB.transaction(['chatMessages'], 'readwrite');
        const store = transaction.objectStore('chatMessages');

        const messageData = {
            ...message,
            timestamp: Date.now(),
            channelName: streamerState.channelName
        };

        await store.add(messageData);

        // Обновляем статистику
        updateChatStats(message.user);

    } catch (error) {
        console.warn('Ошибка сохранения сообщения:', error);
    }
}

function updateChatStats(user) {
    streamerState.chatStats.totalMessages++;

    // Подсчет уникальных зрителей
    const uniqueViewers = new Set();
    streamerState.chatMessages.forEach(msg => uniqueViewers.add(msg.user));
    streamerState.chatStats.uniqueViewers = uniqueViewers.size;

    // Самый активный пользователь
    const userCounts = {};
    streamerState.chatMessages.forEach(msg => {
        userCounts[msg.user] = (userCounts[msg.user] || 0) + 1;
    });

    let maxCount = 0;
    let mostActive = '';
    Object.entries(userCounts).forEach(([user, count]) => {
        if (count > maxCount) {
            maxCount = count;
            mostActive = user;
        }
    });

    streamerState.chatStats.mostActiveUser = mostActive;
    saveStreamerData();
}

let gameFirstState = {
    active: false, selectedGame: null,
    currentPlayerIndex: 0, assignedTasks: {}
};

let taskOnlyState = {
    selectedGame: null,
    selectedPlayer: null
};

// ── SETTINGS ──────────────────────────────────────────────
let rouletteSettings = _safeParse('rouletteSettings', null) || {
    // Speed
    spinDuration: 5000, minSpins: 5, maxSpins: 10,
    // Sound
    soundEnabled: true, soundVolume: 0.5,
    tickSoundEnabled: true, winSoundEnabled: true,
    spinSoundType: 'whoosh', // whoosh | drum | casino
    // Visual effects
    visualEffects: true, highlightWinner: true,
    shakeEffect: true, glowEffect: true, particleEffect: true,
    particleCount: 30, particleStyle: 'circle', // circle | star | confetti
    // Wheel display
    wheelSize: 420, fontSize: 12,
    groupSegments: true, maxSegments: 14,
    colorScheme: 'default',
    borderStyle: 'glow',     // glow | solid | dashed | neon
    centerIcon: '🎲',
    showSegmentIcons: false,
    pointerStyle: 'arrow',   // arrow | triangle | diamond | star
    wheelAnimation: 'ease',  // ease | bounce | linear
    // Result
    resultDisplay: 'both',   // both | popup | card
    autoClosePopup: true, popupDuration: 6000,
    // Streamer extras
    showPlayerOnWheel: false,
    announceDelay: 0,        // ms before showing result
    overlayPosition: 'top-left', // top-left | top-right | bottom-left | bottom-right
    chromaKey: false,
    // Gamer extras
    bonusRoundEnabled: false,
    bonusRoundChance: 10,    // %
    doubleSpinEnabled: false,
    blacklistEnabled: false,
    blacklistTasks: [],
    weightedSegments: false,
    removeAfterSpin: false, // убирать задание из колеса после каждой прокрутки
};

// ── COLOR SCHEMES ──────────────────────────────────────────
const COLOR_SCHEMES = {
    default: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#a855f7', '#14b8a6'],
    neon: ['#ff00ff', '#00ffff', '#ff6600', '#00ff00', '#ff0000', '#ffff00', '#ff0099', '#00ccff', '#ff3300', '#33ff00', '#cc00ff', '#00ffcc'],
    pastel: ['#a78bfa', '#67e8f9', '#86efac', '#fde68a', '#fca5a5', '#93c5fd', '#f9a8d4', '#5eead4', '#fbbf24', '#c084fc', '#6ee7b7', '#7dd3fc'],
    fire: ['#ff4500', '#ff6a00', '#ff8c00', '#ffb300', '#ffd700', '#ff2200', '#cc3300', '#ff7700', '#ff5500', '#ff9900', '#ffcc00', '#ff3300'],
    ocean: ['#0077b6', '#0096c7', '#00b4d8', '#48cae4', '#90e0ef', '#0077b6', '#023e8a', '#03045e', '#0081a7', '#00afb9', '#0cb0a9', '#006d77'],
    forest: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#1b4332', '#081c15', '#d8f3dc', '#b7e4c7', '#52b788', '#40916c', '#2d6a4f'],
    gold: ['#ffd700', '#ffb800', '#ffa500', '#ff8c00', '#e6960c', '#c47a0e', '#f5b700', '#e09b1a', '#d4a017', '#c8960c', '#b8860b', '#a07800'],
    monochrome: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#1f4068', '#1b262c', '#4a4a6a', '#6a6a9a', '#8a8abb', '#aaaacc', '#303050'],
    rainbow: ['#ff0000', '#ff7700', '#ffff00', '#00ff00', '#0000ff', '#8b00ff', '#ff00ff', '#00ffff', '#ff6600', '#33cc00', '#0066ff', '#cc00cc'],
    cyber: ['#00d4ff', '#7b2ff7', '#e040fb', '#00e676', '#ff6d00', '#448aff', '#ff5252', '#ffab40', '#00bcd4', '#69f0ae', '#ea80fc', '#ff4081'],
    twitch: ['#9147ff', '#bf94ff', '#772ce8', '#a970ff', '#6441a5', '#00e5b3', '#ff6ec7', '#ffb700', '#4b367c', '#d8a3ff', '#b9a3e3', '#6600cc'],
};

// ── PLAYER COLORS ──────────────────────────────────────────
const playerColors = {
    indigo: { gradient: 'linear-gradient(135deg,#6366f1,#818cf8)', border: '#6366f1', name: '#818cf8', label: 'Индиго' },
    purple: { gradient: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', border: '#8b5cf6', name: '#a78bfa', label: 'Фиолетовый' },
    emerald: { gradient: 'linear-gradient(135deg,#10b981,#34d399)', border: '#10b981', name: '#34d399', label: 'Изумрудный' },
    amber: { gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', border: '#f59e0b', name: '#fbbf24', label: 'Янтарный' },
    rose: { gradient: 'linear-gradient(135deg,#ec4899,#f472b6)', border: '#ec4899', name: '#f472b6', label: 'Розовый' },
    cyan: { gradient: 'linear-gradient(135deg,#06b6d4,#67e8f9)', border: '#06b6d4', name: '#67e8f9', label: 'Циан' },
    orange: { gradient: 'linear-gradient(135deg,#f97316,#fb923c)', border: '#f97316', name: '#fb923c', label: 'Оранжевый' },
    lime: { gradient: 'linear-gradient(135deg,#84cc16,#a3e635)', border: '#84cc16', name: '#a3e635', label: 'Лайм' },
    twitch: { gradient: 'linear-gradient(135deg,#9147ff,#bf94ff)', border: '#9147ff', name: '#bf94ff', label: 'Твич' },
};

// ── INIT ──────────────────────────────────────────────────
function init() {
    const ls = document.querySelector('.loading-screen');
    if (ls) ls.remove();

    // Загружаем сохранённые данные стримера сразу из localStorage как fallback
    loadStreamerDataSync();

    // Инициализируем IndexedDB для стримера
    initStreamerDB().then(() => {
        // После загрузки данных стримера, предлагаем переподключиться
        setTimeout(() => {
            if (streamerState.channelName && currentTab === 'streamer') {
                showReconnectToast(streamerState.channelName);
            }
        }, 1500); // Увеличили задержку для полной загрузки
    });

    // Загружаем и нормализуем данные игр
    const rawGames = JSON.parse(localStorage.getItem('challengeGames'));
    if (rawGames && typeof rawGames === 'object') {
        Object.entries(rawGames).forEach(([gameName, tasks]) => {
            if (!Array.isArray(tasks)) return;
            const normalized = tasks.map(t =>
                typeof t === 'string' ? t : (t && typeof t.task === 'string' ? t.task : String(t))
            ).filter(t => t && t.trim());
            // Убираем дубликаты заданий
            games[gameName] = [...new Set(normalized)];
        });
    }
    if (!Object.keys(games).length) {
        games = getDefaultGames();
    }

    // Загружаем состояние task-only режима
    const savedTaskOnlyState = localStorage.getItem('taskOnlyState');
    if (savedTaskOnlyState) {
        try {
            const data = JSON.parse(savedTaskOnlyState);
            taskOnlyState = { ...taskOnlyState, ...data };
        } catch (e) {
            console.warn('Ошибка загрузки taskOnlyState:', e);
        }
    }

    // Загружаем сохранённый режим рулетки
    const savedRouletteMode = localStorage.getItem('rouletteMode');
    if (savedRouletteMode) {
        rouletteMode = savedRouletteMode;
    }

    applyTheme(currentTheme);
    createTabs();
    createFloatingButton();
    document.addEventListener('click', e => { if (e.target.classList.contains('modal')) closeModal() });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() });
    updateWheelSegments();
}

// Синхронная загрузка данных из localStorage
function loadStreamerDataSync() {
    const saved = localStorage.getItem('streamerState');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            streamerState.channelName = data.channelName || '';
            streamerState.subWheelList = data.subWheelList || [];
            streamerState.chatStats = data.chatStats || streamerState.chatStats;
            streamerState.chatSounds = data.chatSounds || false;
            streamerState.autoSpin = data.autoSpin || false;
            streamerState.sessionStartTime = data.sessionStartTime || Date.now();

            console.log('Загружены данные стримера:', streamerState.channelName);
        } catch (e) {
            console.warn('Ошибка загрузки из localStorage:', e);
        }
    }
}

// ── THEME ──────────────────────────────────────────────────
function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('appTheme', theme);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
    // Re-render wheel if on roulette tab
    if (currentTab === 'roulette') setTimeout(renderWheel, 50);
}

// ── FLOATING BUTTON ────────────────────────────────────────
function createFloatingButton() {
    const ex = document.querySelector('.floating-actions');
    if (ex) ex.remove();
    document.body.insertAdjacentHTML('beforeend', `
        <div class="floating-actions">
            <button class="floating-btn main-btn" onclick="toggleFloatingMenu()" title="${t('floating.settings')}">⚙️</button>
            <div class="floating-menu hidden" id="floatingMenu">
                <button onclick="confirmClearCache()"  class="floating-menu-btn">${t('floating.clear_cache')}</button>
                <button onclick="confirmResetAll()"    class="floating-menu-btn">${t('floating.reset_all')}</button>
                <button onclick="window.scrollTo({top:0,behavior:'smooth'})" class="floating-menu-btn">${t('floating.scroll_top')}</button>
                <button onclick="switchTab('settings')"  class="floating-menu-btn">${t('floating.settings')}</button>
                <button onclick="switchTab('roulette')"  class="floating-menu-btn">${t('floating.roulette')}</button>
                <button onclick="switchTab('streamer')"  class="floating-menu-btn">${t('floating.streamer')}</button>
                <button onclick="openOverlayWindow()"    class="floating-menu-btn">${t('floating.overlay')}</button>
            </div>
        </div>
    `);
}
function toggleFloatingMenu() {
    const m = document.getElementById('floatingMenu');
    if (!m) return;
    m.classList.toggle('hidden');
    if (!m.classList.contains('hidden')) setTimeout(() => document.addEventListener('click', closeFloatingMenu), 100);
}
function closeFloatingMenu(e) {
    const fa = document.querySelector('.floating-actions');
    if (fa && !fa.contains(e.target)) {
        document.getElementById('floatingMenu')?.classList.add('hidden');
        document.removeEventListener('click', closeFloatingMenu);
    }
}

// ── MODALS ────────────────────────────────────────────────
function showConfirmModal(title, msg, confirmTxt, cancelTxt, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = msg;
    const btn = document.getElementById('modalConfirm');
    btn.textContent = confirmTxt || 'ПОДТВЕРДИТЬ';
    const cancelBtn = modal.querySelector('.cancel-btn');
    if (cancelBtn) cancelBtn.textContent = cancelTxt || 'ОТМЕНА';
    modalCallback = onConfirm;
    btn.onclick = () => { if (modalCallback) modalCallback(); closeModal() };
    modal.classList.remove('hidden');
}
function closeModal() {
    document.getElementById('confirmModal')?.classList.add('hidden');
    document.getElementById('wheelCustomModal')?.classList.add('hidden');
    modalCallback = null;
}

// ── SAVE / LOAD ───────────────────────────────────────────
function saveAll() {
    localStorage.setItem('challengePlayers', JSON.stringify(players));
    localStorage.setItem('challengeGames', JSON.stringify(games));
    localStorage.setItem('taskOnlyState', JSON.stringify(taskOnlyState));
    localStorage.setItem('rouletteMode', rouletteMode);
    localStorage.setItem('spentTasks', JSON.stringify(spentTasks));
}
function saveSettings() { localStorage.setItem('rouletteSettings', JSON.stringify(rouletteSettings)) }

function confirmClearCache() {
    document.getElementById('floatingMenu')?.classList.add('hidden');
    showConfirmModal(t('modal.clear_cache_title'), t('modal.clear_cache_msg'), t('modal.clear_cache_btn'), t('common.cancel'), clearCache);
}
function clearCache() {
    localStorage.removeItem('challengePlayers'); localStorage.removeItem('challengeGames'); sessionStorage.clear();
    players = []; games = getDefaultGames();
    gameFirstState = { active: false, selectedGame: null, currentPlayerIndex: 0, assignedTasks: {} };
    saveAll(); updateWheelSegments(); switchTab('games');
    showNotification(t('modal.cache_cleared'), 'success');
}
function confirmResetAll() {
    document.getElementById('floatingMenu')?.classList.add('hidden');
    showConfirmModal(t('modal.reset_all_title'), t('modal.reset_all_msg'), t('modal.reset_all_btn'), t('common.cancel'), resetAllData);
}
function resetAllData() {
    players = []; games = {};
    localStorage.removeItem('challengePlayers'); localStorage.removeItem('challengeGames'); sessionStorage.clear();
    gameFirstState = { active: false, selectedGame: null, currentPlayerIndex: 0, assignedTasks: {} };
    updateWheelSegments(); switchTab('games');
    showNotification(t('modal.all_reset'), 'warning');
}

// ── TABS ──────────────────────────────────────────────────
function createTabs(initialTab) {
    const mp = document.getElementById('mainPanel');
    if (!mp) return;
    const tab = initialTab || 'games';
    mp.innerHTML = `
        <div class="cyber-tabs">
            <button class="cyber-tab${tab === 'games' ? ' active' : ''}"    data-tab="games"    onclick="switchTab('games')">   <span class="tab-icon">🎮</span> ${t('tab.games')}</button>
            <button class="cyber-tab${tab === 'players' ? ' active' : ''}"  data-tab="players"  onclick="switchTab('players')"> <span class="tab-icon">👥</span> ${t('tab.players')} <span class="tab-badge" id="playersBadge">${players.length}</span></button>
            <button class="cyber-tab${tab === 'roulette' ? ' active' : ''}" data-tab="roulette" onclick="switchTab('roulette')"><span class="tab-icon">🎰</span> ${t('tab.roulette')}</button>
            <button class="cyber-tab${tab === 'streamer' ? ' active' : ''}" data-tab="streamer" onclick="switchTab('streamer')"><span class="tab-icon">📡</span> ${t('tab.streamer')}</button>
            <button class="cyber-tab${tab === 'stats' ? ' active' : ''}"    data-tab="stats"    onclick="switchTab('stats')">   <span class="tab-icon">📊</span> ${t('tab.stats')}</button>
            <button class="cyber-tab${tab === 'settings' ? ' active' : ''}" data-tab="settings" onclick="switchTab('settings')"><span class="tab-icon">⚙️</span> ${t('tab.settings')}</button>
        </div>
        <div class="tab-content" id="tabContent"></div>
    `;
    switchTab(tab);
}

function switchTab(name) {
    currentTab = name;
    if (name !== 'roulette') {
        // Прерываем анимацию и сбрасываем состояние вращения
        if (animationId) { cancelAnimationFrame(animationId); animationId = null }
        if (spinning) {
            spinning = false;
            // Кнопка будет пересоздана при следующем рендере рулетки — здесь просто сбрасываем флаг
        }
        gameFirstState.active = false;
        // Скрываем popup результата при смене вкладки
        const popup = document.getElementById('wheelResultPopup');
        if (popup) { popup.classList.add('hidden'); popup.style.animation = '' }
    }
    if (currentTab === 'games') saveDropdownState();
    document.querySelectorAll('.cyber-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    const badge = document.getElementById('playersBadge');
    if (badge) badge.textContent = players.length;
    const content = document.getElementById('tabContent');
    if (!content) return;
    const renders = {
        games: () => { content.innerHTML = renderGamesTab(); setTimeout(restoreDropdownState, 50) },
        players: () => { content.innerHTML = renderPlayersTab() },
        roulette: () => {
            content.innerHTML = renderRouletteTab();
            setTimeout(() => {
                gameFirstState.active && gameFirstState.selectedGame
                    ? updateWheelSegmentsForGame(gameFirstState.selectedGame)
                    : updateWheelSegments();
                renderWheel();
                refreshRouletteControls();
            }, 80);
        },
        streamer: () => {
            content.innerHTML = renderStreamerTab();
            // Обновляем состояние UI после рендера
            setTimeout(() => {
                updateStreamerUIState();
                updateChannelInput();
                updateTokenInput();

                // Предлагаем переподключение если есть сохранённый канал
                if (streamerState.channelName && streamerState.twitchStatus === 'idle') {
                    setTimeout(() => {
                        showReconnectToast(streamerState.channelName);
                    }, 500);
                }
            }, 100);
        },
        stats: () => { content.innerHTML = renderStatsTab() },
        settings: () => { content.innerHTML = renderSettingsTab() },
    };
    (renders[name] || (() => { }))();
    content.style.animation = 'none';
    void content.offsetHeight;
    content.style.animation = 'fadeInUp 0.35s ease';
}

// ── DROPDOWN STATE ────────────────────────────────────────
function saveDropdownState() {
    openDropdowns = {};
    document.querySelectorAll('.tasks-dropdown').forEach(d => {
        const id = d.id.replace('dropdown_', '');
        if (!d.classList.contains('hidden')) openDropdowns[id] = true;
    });
}
function restoreDropdownState() {
    Object.entries(openDropdowns).forEach(([id, open]) => {
        if (!open) return;
        const dd = document.getElementById(`dropdown_${id}`);
        const ar = document.getElementById(`arrow_${id}`);
        if (dd) { dd.classList.remove('hidden'); if (ar) ar.textContent = '▼' }
    });
}
function toggleGameDropdown(gameName) {
    const sid = gameName.replace(/[^a-zA-Z0-9]/g, '_');
    const dd = document.getElementById(`dropdown_${sid}`);
    const ar = document.getElementById(`arrow_${sid}`);
    if (!dd) return;
    const hidden = dd.classList.contains('hidden');
    if (hidden) {
        document.querySelectorAll('.tasks-dropdown').forEach(d => { if (d.id !== `dropdown_${sid}`) d.classList.add('hidden') });
        document.querySelectorAll('.dropdown-arrow').forEach(a => { if (a.id !== `arrow_${sid}`) a.textContent = '▶' });
        dd.classList.remove('hidden'); if (ar) ar.textContent = '▼'; openDropdowns[sid] = true;
    } else { dd.classList.add('hidden'); if (ar) ar.textContent = '▶'; openDropdowns[sid] = false }
}

// ── GAMES TAB ─────────────────────────────────────────────
function renderGamesTab() {
    return `<div class="games-panel">
        <div class="panel-section">
            <h3 class="section-title"><span class="neon-text">${t('games.add_game_title')}</span></h3>
            <div class="input-group">
                <input type="text" id="newGame" placeholder="${t('games.game_placeholder')}" class="cyber-input" onkeypress="if(event.key==='Enter')addGame()">
                <button onclick="addGame()" class="cyber-btn add-btn">${t('common.add')}</button>
            </div>
        </div>
        <div class="panel-section">
            <h3 class="section-title"><span class="neon-text">${t('games.add_task_title')}</span></h3>
            <div class="input-group">
                <select id="gameList" class="cyber-select">${Object.keys(games).map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select>
                <input type="text" id="newTask" placeholder="${t('games.task_placeholder')}" class="cyber-input" onkeypress="if(event.key==='Enter')addTask()">
                <button onclick="addTask()" class="cyber-btn add-btn">${t('common.add')}</button>
            </div>
        </div>
        <div class="panel-section">
            <h3 class="section-title">
                <span class="neon-text">${t('games.list_title')}</span>
                <span class="section-badge">${t('games.games_badge', { g: Object.keys(games).length, t: Object.values(games).reduce((s, ts) => s + ts.length, 0) })}</span>
            </h3>
            <div id="gamesList" class="games-list">${renderGamesList()}</div>
        </div>
        <div class="panel-actions">
            <button onclick="exportData()" class="cyber-btn export-btn">📤 ${t('common.export')}</button>
            <button onclick="importData()" class="cyber-btn import-btn">📥 ${t('common.import')}</button>
            <button onclick="showBulkAddModal()" class="cyber-btn primary-btn">${t('games.bulk_add')}</button>
        </div>
    </div>`;
}

function renderGamesList() {
    if (!Object.keys(games).length) return `<p class="empty-text">${t('games.empty_games')}</p>`;
    return Object.entries(games).map(([game, tasks]) => {
        const sid = game.replace(/[^a-zA-Z0-9]/g, '_');
        const escGame = esc(game);
        return `<div class="game-card">
            <div class="game-header" data-game="${escGame}" onclick="toggleGameDropdown(this.dataset.game)">
                <div class="game-header-left">
                    <span class="dropdown-arrow" id="arrow_${sid}">▶</span>
                    <h4 class="game-name">🎮 ${escGame}</h4>
                </div>
                <div class="game-header-right">
                    <span class="task-count">${t('games.tasks_count', { n: tasks.length })}</span>
                    <button data-game="${escGame}" onclick="event.stopPropagation();deleteGame(this.dataset.game)" class="delete-btn">🗑️</button>
                </div>
            </div>
            <div class="tasks-dropdown hidden" id="dropdown_${sid}">
                <div class="tasks-list">${tasks.map((tk, i) => `
                    <div class="task-item">
                        <span class="task-number">${t('games.task_number', { n: i + 1 })}</span>
                        <span class="task-text">${esc(tk)}</span>
                        <button data-game="${escGame}" data-idx="${i}" onclick="deleteTask(this.dataset.game,+this.dataset.idx)" class="delete-task-btn" title="${t('common.delete')}">×</button>
                    </div>`).join('')}
                </div>
                ${!tasks.length ? `<p class="empty-text">${t('games.empty_tasks')}</p>` : ''}
                <div class="task-actions">
                    <div class="input-group">
                        <input type="text" id="quickTask_${sid}" placeholder="${t('games.quick_placeholder')}" class="cyber-input" data-game="${escGame}" onkeypress="if(event.key==='Enter')quickAddTask(this.dataset.game)">
                        <button data-game="${escGame}" onclick="quickAddTask(this.dataset.game)" class="cyber-btn add-btn">${t('common.add')}</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function addGame() {
    const inp = document.getElementById('newGame'); if (!inp) return;
    const name = inp.value.trim();
    if (!name) return showNotification(t('games.no_game_name'), 'error');
    if (games[name]) return showNotification(t('games.game_exists'), 'warning');
    games[name] = []; saveAll(); switchTab('games');
    showNotification(t('games.added', { name }), 'success');
}
function addTask() {
    const gs = document.getElementById('gameList'), ti = document.getElementById('newTask');
    if (!gs || !ti) return;
    const game = gs.value, task = ti.value.trim();
    if (!task) return showNotification(t('games.no_task_desc'), 'error');
    if (!games[game]) return showNotification(t('games.no_game_selected'), 'error');
    if (games[game].includes(task)) return showNotification(t('games.task_exists'), 'warning');
    games[game].push(task); saveAll(); switchTab('games');
    showNotification(t('games.task_added'), 'success');
}
function quickAddTask(gameName) {
    const sid = gameName.replace(/[^a-zA-Z0-9]/g, '_');
    const inp = document.getElementById(`quickTask_${sid}`); if (!inp) return;
    const task = inp.value.trim();
    if (!task) return showNotification(t('games.no_task_desc'), 'error');
    if (!games[gameName]) return showNotification(t('games.game_not_found'), 'error');
    if (games[gameName].includes(task)) return showNotification(t('games.task_exists'), 'warning');
    games[gameName].push(task); saveAll(); inp.value = ''; openDropdowns[sid] = true;
    const c = document.getElementById('tabContent');
    if (c) { c.innerHTML = renderGamesTab(); setTimeout(restoreDropdownState, 50) }
    showNotification(t('games.task_added'), 'success');
}
function deleteGame(name) {
    showConfirmModal(t('games.delete_game_title'), t('games.delete_game_msg', { name }), t('games.delete_btn'), t('common.cancel'), () => {
        delete games[name]; saveAll(); switchTab('games');
        showNotification(t('games.game_deleted', { name }), 'warning');
    });
}
function deleteTask(gameName, idx) {
    const tk = games[gameName]?.[idx];
    showConfirmModal(t('games.delete_task_title'), t('games.delete_task_msg', { name: tk }), t('games.delete_btn'), t('common.cancel'), () => {
        games[gameName].splice(idx, 1); saveAll(); switchTab('games');
        showNotification(t('games.task_deleted'), 'warning');
    });
}
function showBulkAddModal() {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;
    document.getElementById('modalTitle').textContent = t('games.bulk_title');
    document.getElementById('modalMessage').innerHTML = `
        <div style="text-align:left">
            <select id="bulkGame" style="width:100%;margin-bottom:10px;padding:9px 12px;background:var(--bg-input);color:var(--text-primary);border:2px solid var(--border-light);border-radius:8px;font-size:13px">
                ${Object.keys(games).map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}
            </select>
            <textarea id="bulkTasks" placeholder="${t('games.bulk_hint')}" style="width:100%;height:160px;padding:10px;background:var(--bg-input);color:var(--text-primary);border:2px solid var(--border-light);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical"></textarea>
            <p style="font-size:11px;color:var(--text-muted);margin-top:6px">${t('games.bulk_hint')}</p>
        </div>`;
    const btn = document.getElementById('modalConfirm');
    btn.textContent = t('games.bulk_add_btn');
    btn.onclick = () => {
        const game = document.getElementById('bulkGame')?.value;
        const raw = document.getElementById('bulkTasks')?.value || '';
        const tasks = raw.split('\n').map(tk => tk.trim()).filter(tk => tk.length > 0);
        if (game && tasks.length) {
            const existing = games[game] || [];
            const newTasks = tasks.filter(tk => !existing.includes(tk));
            const skipped = tasks.length - newTasks.length;
            if (!newTasks.length) return showNotification(t('games.bulk_all_exist'), 'warning');
            games[game].push(...newTasks); saveAll(); closeModal(); switchTab('games');
            const msg = skipped > 0
                ? t('games.bulk_skipped', { n: newTasks.length, s: skipped })
                : t('games.bulk_added', { n: newTasks.length, game });
            showNotification(msg, 'success');
        } else { showNotification(t('games.bulk_select_hint'), 'error') }
    };
    const cancelBtn = modal.querySelector('.cancel-btn');
    if (cancelBtn) { cancelBtn.textContent = t('common.cancel'); cancelBtn.onclick = closeModal }
    modal.classList.remove('hidden');
}

// ── PLAYERS TAB ───────────────────────────────────────────
function renderPlayersTab() {
    return `<div class="players-panel">
        <div class="panel-section">
            <h3 class="section-title"><span class="neon-text">${t('players.add_title')}</span></h3>
            <div class="input-group">
                <input type="text" id="newPlayer" placeholder="${t('players.placeholder')}" class="cyber-input" onkeypress="if(event.key==='Enter')addPlayer()">
                <select id="playerColor" class="cyber-select">
                    ${Object.entries(playerColors).map(([k, v]) => `<option value="${k}">${t('color.' + k) || v.label}</option>`).join('')}
                </select>
                <button onclick="addPlayer()" class="cyber-btn add-btn">${t('common.add')}</button>
            </div>
        </div>
        <div class="panel-section">
            <h3 class="section-title">
                <span class="neon-text">${t('players.list_title')}</span>
                <span class="section-badge">${t('players.count_badge', { n: players.length })}</span>
            </h3>
            <div class="players-grid">
                ${players.length === 0 ? `<p class="empty-text">${t('players.empty')}</p>` :
            players.map((p, i) => {
                const cd = playerColors[p.color] || playerColors.indigo;
                return `<div class="player-card" style="border-color:${esc(cd.name)}">
                            <div class="player-avatar" style="background:${esc(cd.gradient)}">${esc(p.name[0].toUpperCase())}</div>
                            <div class="player-info">
                                <span class="player-name" style="color:${esc(cd.name)}">${esc(p.name)}</span>
                                <span class="player-color">${t('color.' + p.color) || esc(cd.label)}</span>
                                <span class="player-stats-mini">${t('players.stats_mini', { g: p.stats?.gamesPlayed || 0, t: p.stats?.tasksCompleted || 0 })}</span>
                            </div>
                            <button onclick="deletePlayer(${i})" class="delete-btn" title="${t('common.delete')}">🗑️</button>
                        </div>`;
            }).join('')}
            </div>
        </div>
        <div class="panel-actions">
            <button onclick="clearAllPlayers()" class="cyber-btn danger-btn" ${!players.length ? 'disabled' : ''}>${t('players.clear_all')}</button>
            <button onclick="resetAllStats()" class="cyber-btn outline-btn" ${!players.length ? 'disabled' : ''}>${t('players.reset_stats')}</button>
        </div>
    </div>`;
}

function addPlayer() {
    const ni = document.getElementById('newPlayer'), cs = document.getElementById('playerColor');
    if (!ni || !cs) return;
    const name = ni.value.trim(), color = cs.value;
    if (!name) return showNotification(t('players.no_name'), 'error');
    if (players.some(p => p.name === name)) return showNotification(t('players.exists'), 'warning');
    players.push({ name, color, stats: { gamesPlayed: 0, tasksCompleted: 0 } }); saveAll(); switchTab('players');
    showNotification(t('players.added', { name }), 'success');
}
function deletePlayer(i) {
    const name = players[i]?.name || '?';
    showConfirmModal(t('games.delete_game_title'), t('players.delete_confirm', { name }), t('players.delete_btn'), t('common.cancel'), () => {
        players.splice(i, 1); saveAll(); switchTab('players');
        showNotification(t('players.deleted', { name }), 'warning');
    });
}
function clearAllPlayers() {
    if (!players.length) return;
    showConfirmModal(t('players.clear_all'), t('players.clear_confirm', { n: players.length }), t('players.clear_btn'), t('common.cancel'), () => {
        players = []; saveAll(); switchTab('players');
        showNotification(t('players.cleared'), 'warning');
    });
}
function resetAllStats() {
    showConfirmModal(t('players.reset_stats'), t('players.reset_confirm'), t('common.reset'), t('common.cancel'), () => {
        players.forEach(p => { p.stats = { gamesPlayed: 0, tasksCompleted: 0 } }); saveAll(); switchTab('players');
        showNotification(t('players.stats_reset'), 'info');
    });
}

// ── ROULETTE TAB ──────────────────────────────────────────
function renderRouletteTab() {
    const avail = Object.entries(games).filter(([, t]) => t.length > 0);
    const gCount = Object.keys(games).length;
    const tCount = Object.values(games).reduce((s, tasks) => s + tasks.length, 0);
    let modeInfo = '', canSpin = true, wheelHidden = false;
    let spinTxt = t('roulette.spin_btn');

    if (gameFirstState.active && gameFirstState.selectedGame) {
        const curP = players[gameFirstState.currentPlayerIndex];
        const remaining = getRemainingTasksForGame(gameFirstState.selectedGame);
        const assigned = Object.keys(gameFirstState.assignedTasks).length;
        const total = players.length;
        const done = total > 0 && (assigned >= total || remaining.length === 0);
        const pct = total > 0 ? Math.round((assigned / total) * 100) : 0;
        if (done) {
            canSpin = false;
            spinTxt = t('roulette.all_done_btn');
            wheelHidden = true;
        } else if (curP) {
            spinTxt = t('roulette.spinning_for', { name: curP.name.toUpperCase() });
        }

        modeInfo = `<div class="game-first-status">
            <div class="progress-container">
                <div class="progress-header">
                    <span class="progress-label">${t('roulette.progress_label')}</span>
                    <span class="progress-value">${assigned}/${total} (${pct}%)</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            </div>
            <div class="status-card selected-game-card">
                <div class="status-card-icon">🎮</div>
                <div class="status-card-content"><span class="status-card-label">${t('roulette.selected_game')}</span><span class="status-card-value">${esc(gameFirstState.selectedGame)}</span></div>
            </div>
            ${curP && !done ? `<div class="status-card current-player-card">
                <div class="status-card-icon">👤</div>
                <div class="status-card-content"><span class="status-card-label">${t('roulette.now_spinning')}</span><span class="status-card-value" style="color:${esc(playerColors[curP.color]?.name || '#818cf8')}">${esc(curP.name)}</span></div>
            </div>` : ''}
            <div class="stats-row">
                <div class="stat-mini"><span class="stat-mini-icon">📋</span><span class="stat-mini-text">${t('roulette.remaining', { n: remaining.length })}</span></div>
                <div class="stat-mini"><span class="stat-mini-icon">✅</span><span class="stat-mini-text">${t('roulette.assigned', { n: assigned })}</span></div>
            </div>
            ${assigned > 0 ? `<div class="assigned-tasks-section">
                <div class="section-subtitle" onclick="toggleAssignedTasks()">
                    <span class="dropdown-arrow" id="assignedArrow">▶</span><span>${t('roulette.assigned_count', { n: assigned })}</span>
                </div>
                <div class="assigned-tasks-list hidden" id="assignedTasksList">
                    ${Object.entries(gameFirstState.assignedTasks).map(([pn, pt], idx) => {
            const pl = players.find(p => p.name === pn);
            const cd = playerColors[pl?.color] || playerColors.indigo;
            return `<div class="assigned-task-row">
                            <span class="assigned-task-number">#${idx + 1}</span>
                            <span class="assigned-player-name" style="color:${esc(cd.name)}">${esc(pn)}</span>
                            <span class="assigned-task-divider">→</span>
                            <span class="assigned-task-text">${esc(pt)}</span>
                        </div>`;
        }).join('')}
                </div>
            </div>` : ''}
            ${done ? `<div class="completion-notice">
                <div class="completion-icon">🎉</div>
                <p class="completion-text">${t('roulette.done_notice')}</p>
                <p class="completion-subtext">${t('roulette.done_players', { assigned, total })}</p>
                <div class="completion-actions">
                    <button onclick="showFinalResults()" class="cyber-btn add-btn">${t('roulette.btn_results')}</button>
                    <button onclick="resetGameFirstMode()" class="cyber-btn danger-btn">${t('roulette.btn_reset')}</button>
                </div>
            </div>` : ''}
        </div>`;
    }

    if (rouletteMode === 'task-only') {
        const gamesWithTasks = Object.entries(games).filter(([, tasks]) => tasks.length > 0);
        if (gamesWithTasks.length === 0) {
            canSpin = false;
            spinTxt = t('roulette.no_games');
        } else if (!taskOnlyState.selectedGame) {
            canSpin = false;
            spinTxt = t('roulette.select_game_btn');
        } else {
            spinTxt = t('roulette.spinning_for', { name: taskOnlyState.selectedGame.toUpperCase() });
        }

        modeInfo = `<div class="task-only-status">
            <div class="game-selector-section">
                <div class="section-subtitle">
                    <span class="section-icon">🎮</span>
                    <span>${t('roulette.select_game_lbl')}</span>
                </div>
                <div class="game-selector-grid">
                    ${gamesWithTasks.map(([gameName, tasks]) => `
                        <button onclick="selectGameForTaskOnly(this.dataset.gameName)"
                                data-game-name="${esc(gameName)}"
                                class="game-selector-btn ${taskOnlyState.selectedGame === gameName ? 'selected' : ''}">
                            <div class="game-selector-name">${esc(gameName)}</div>
                            <div class="game-selector-tasks">${t('games.tasks_count', { n: tasks.length })}</div>
                        </button>
                    `).join('')}
                </div>
            </div>
            <div class="player-selector-section">
                <div class="section-subtitle">
                    <span class="section-icon">👤</span>
                    <span>${t('roulette.select_player_lbl')}</span>
                </div>
                <div class="player-selector-grid">
                    <button onclick="selectPlayerForTaskOnly(this.dataset.playerName || null)"
                            data-player-name=""
                            class="player-selector-btn ${taskOnlyState.selectedPlayer === null ? 'selected' : ''}">
                        <div class="player-selector-name">🎲 ${t('roulette.any_player')}</div>
                        <div class="player-selector-desc">${t('roulette.any_player_desc')}</div>
                    </button>
                    ${players.map(player => `
                        <button onclick="selectPlayerForTaskOnly(this.dataset.playerName)"
                                data-player-name="${esc(player.name)}"
                                class="player-selector-btn ${taskOnlyState.selectedPlayer === player.name ? 'selected' : ''}">
                            <div class="player-selector-name" style="color:${esc(playerColors[player.color]?.name || '#818cf8')}">${esc(player.name)}</div>
                            <div class="player-selector-desc">${t('roulette.specific_player')}</div>
                        </button>
                    `).join('')}
                </div>
            </div>
            ${taskOnlyState.selectedGame || taskOnlyState.selectedPlayer !== null ? `
                <div class="selection-summary">
                    ${taskOnlyState.selectedGame ? `
                        <div class="status-card selected-game-card">
                            <div class="status-card-icon">🎮</div>
                            <div class="status-card-content">
                                <span class="status-card-label">${t('roulette.selected_game')}</span>
                                <span class="status-card-value">${esc(taskOnlyState.selectedGame)}</span>
                            </div>
                        </div>` : ''}
                    ${taskOnlyState.selectedPlayer !== null ? `
                        <div class="status-card selected-player-card">
                            <div class="status-card-icon">👤</div>
                            <div class="status-card-content">
                                <span class="status-card-label">${t('roulette.now_spinning')}</span>
                                <span class="status-card-value" style="color:${esc(taskOnlyState.selectedPlayer ? (playerColors[players.find(p => p.name === taskOnlyState.selectedPlayer)?.color]?.name || '#818cf8') : '#818cf8')}">${esc(taskOnlyState.selectedPlayer || t('roulette.any_player'))}</span>
                            </div>
                        </div>` : ''}
                    <div class="stats-row">
                        ${taskOnlyState.selectedGame ? `<div class="stat-mini"><span class="stat-mini-icon">📋</span><span class="stat-mini-text">${t('roulette.assigned', { n: games[taskOnlyState.selectedGame]?.length || 0 })}</span></div>` : ''}
                        <div class="stat-mini"><span class="stat-mini-icon">👥</span><span class="stat-mini-text">${t('roulette.assigned', { n: players.length }).replace(/\d+/, players.length)}</span></div>
                    </div>
                </div>` : ''}
        </div>`;
    }

    if (!gameFirstState.active && rouletteMode !== 'task-only') {
        if (rouletteMode === 'player-only' && players.length === 0) {
            canSpin = false; spinTxt = t('roulette.no_players_btn');
        }
        if (rouletteMode === 'game-only' && !Object.keys(games).some(g => games[g].length > 0)) {
            canSpin = false; spinTxt = t('roulette.no_games_only');
        }
    }

    const wsz = rouletteSettings.wheelSize;
    return `<div class="roulette-panel">
        <div class="roulette-info">
            <div class="mode-selector">
                <p class="roulette-mode">🎲 <span class="neon-text">${t('roulette.mode_label')}</span></p>
                <div class="mode-buttons">
                    <button onclick="setRouletteMode('full')" class="mode-btn ${rouletteMode === 'full' ? 'active' : ''}">
                        <span class="mode-btn-icon">🎰</span>
                        <span class="mode-btn-text">${t('roulette.mode_full')}</span>
                        <span class="mode-btn-desc">${t('roulette.mode_full_desc')}</span>
                    </button>
                    <button onclick="setRouletteMode('game-first')" class="mode-btn ${rouletteMode === 'game-first' ? 'active' : ''}">
                        <span class="mode-btn-icon">🎯</span>
                        <span class="mode-btn-text">${t('roulette.mode_game_first')}</span>
                        <span class="mode-btn-desc">${t('roulette.mode_game_first_desc')}</span>
                    </button>
                    <button onclick="setRouletteMode('player-only')" class="mode-btn ${rouletteMode === 'player-only' ? 'active' : ''}">
                        <span class="mode-btn-icon">👤</span>
                        <span class="mode-btn-text">${t('roulette.mode_player_only')}</span>
                        <span class="mode-btn-desc">${t('roulette.mode_player_only_desc')}</span>
                    </button>
                    <button onclick="setRouletteMode('task-only')" class="mode-btn ${rouletteMode === 'task-only' ? 'active' : ''}">
                        <span class="mode-btn-icon">📋</span>
                        <span class="mode-btn-text">${t('roulette.mode_task_only')}</span>
                        <span class="mode-btn-desc">${t('roulette.mode_task_only_desc')}</span>
                    </button>
                    <button onclick="setRouletteMode('game-only')" class="mode-btn ${rouletteMode === 'game-only' ? 'active' : ''}">
                        <span class="mode-btn-icon">🎮</span>
                        <span class="mode-btn-text">${t('roulette.mode_game_only')}</span>
                        <span class="mode-btn-desc">${t('roulette.mode_game_only_desc')}</span>
                    </button>
                </div>
            </div>
            <p class="roulette-hint">${getModeHint()}</p>
            ${modeInfo}
            ${!gameFirstState.active ? `<div class="pre-spin-stats">
                <div class="pre-stat-item"><span class="pre-stat-icon">🎮</span><span class="pre-stat-text">${t('tab.games')}: <strong>${gCount}</strong></span></div>
                <div class="pre-stat-item"><span class="pre-stat-icon">📋</span><span class="pre-stat-text">${t('roulette.result_task')}: <strong>${tCount}</strong></span></div>
                <div class="pre-stat-item"><span class="pre-stat-icon">👥</span><span class="pre-stat-text">${t('tab.players')}: <strong>${players.length}</strong></span></div>
            </div>` : ''}
        </div>
        <div class="wheel-and-controls">
            <div class="wheel-container" id="wheelContainer" style="${wheelHidden ? 'opacity:0;transform:scale(0.8);pointer-events:none;max-height:0;overflow:hidden;margin:0' : 'opacity:1;transform:scale(1)'}">
                <canvas id="rouletteWheel" width="${wsz}" height="${wsz}" onclick="startSpin()"></canvas>
                <div class="wheel-pointer" id="wheelPointer">${getPointerSymbol()}</div>
            </div>
            <div class="roulette-controls">
                <button onclick="startSpin()" class="cyber-btn spin-btn" ${spinning || !canSpin ? 'disabled' : ''}>${spinTxt}</button>
                ${gameFirstState.active && canSpin ? `<br><button onclick="resetGameFirstMode()" class="cyber-btn danger-btn outline-btn" style="margin-top:8px">${t('roulette.reset_mode')}</button>` : ''}
                <p class="spin-hint">${avail.length === 0 ? t('roulette.no_games') : t('roulette.ready', { g: gCount, t: tCount, p: players.length })}</p>
            </div>
            <div id="spinResult" class="spin-result hidden">
                <div class="result-card"><h3>🎯 ${t('roulette.result_task')}:</h3><div id="resultContent"></div><div id="resultActions"></div></div>
            </div>
        </div>
    </div>`;
}

function getModeHint() {
    const hints = {
        'full': t('roulette.hint_full'),
        'game-first': t('roulette.hint_game_first'),
        'player-only': t('roulette.hint_player_only'),
        'task-only': t('roulette.hint_task_only'),
        'game-only': t('roulette.hint_game_only'),
    };
    return hints[rouletteMode] || '';
}

function toggleAssignedTasks() {
    const list = document.getElementById('assignedTasksList');
    const arrow = document.getElementById('assignedArrow');
    if (!list || !arrow) return;
    const hidden = list.classList.contains('hidden');
    list.classList.toggle('hidden'); arrow.textContent = hidden ? '▼' : '▶';
}

// ── WHEEL SEGMENTS ────────────────────────────────────────
function getSegmentColor(i, total) {
    const palette = COLOR_SCHEMES[rouletteSettings.colorScheme] || COLOR_SCHEMES.default;
    return palette[i % palette.length];
}

function updateWheelSegments() {
    segmentScales = []; // сброс масштабов при обновлении сегментов
    if (rouletteMode === 'player-only') {
        if (!players.length) {
            wheelSegments = [{ label: t('wheel.no_players'), task: t('wheel.add_players'), game: '', color: '#484f58' }];
            return;
        }
        let availablePlayers = players;
        if (rouletteSettings.removeAfterSpin) {
            const spent = spentTasks['__players__'] || [];
            availablePlayers = players.filter(p => !spent.includes(p.name));
            if (!availablePlayers.length) {
                wheelSegments = [{ label: '✅', task: t('wheel.all_done'), game: '', color: '#484f58' }];
                return;
            }
        }
        wheelSegments = availablePlayers.map((p, i) => ({
            label: p.name, task: p.name, game: t('wheel.player_pick'),
            color: playerColors[p.color]?.border || getSegmentColor(i, availablePlayers.length)
        }));
        return;
    }
    if (rouletteMode === 'game-only') {
        let gameList = Object.keys(games).filter(g => games[g].length > 0);
        if (rouletteSettings.removeAfterSpin) {
            const spent = spentTasks['__games__'] || [];
            gameList = gameList.filter(g => !spent.includes(g));
        }
        if (!gameList.length) {
            wheelSegments = [{ label: '✅', task: t('wheel.all_done'), game: '', color: '#484f58' }];
        } else {
            wheelSegments = gameList.map((g, i) => ({
                label: g, task: g, game: g,
                color: getSegmentColor(i, gameList.length),
            }));
        }
        return;
    }
    if (rouletteMode === 'task-only') {
        if (taskOnlyState.selectedGame && games[taskOnlyState.selectedGame]) {
            let selectedTasks = games[taskOnlyState.selectedGame];
            if (rouletteSettings.removeAfterSpin) {
                const spent = spentTasks[taskOnlyState.selectedGame] || [];
                selectedTasks = selectedTasks.filter(t => !spent.includes(t));
            }
            if (!selectedTasks.length) {
                wheelSegments = [{ label: t('wheel.all_done'), task: t('wheel.all_done_desc'), game: taskOnlyState.selectedGame, color: '#484f58' }];
            } else {
                wheelSegments = selectedTasks.map((t, i) => ({
                    label: `#${i + 1}`,
                    task: t,
                    game: taskOnlyState.selectedGame,
                    color: getSegmentColor(i, selectedTasks.length)
                }));
            }
        } else {
            wheelSegments = [{ label: t('wheel.select_game'), task: t('wheel.select_game_desc'), game: '', color: '#484f58' }];
        }
        return;
    }
    const allTasks = [];
    Object.entries(games).forEach(([g, tasks]) => {
        if (!Array.isArray(tasks)) return;
        tasks.forEach(t => {
            // Защита от старого формата данных: задание может быть строкой или объектом
            const taskStr = typeof t === 'string' ? t : (t && typeof t.task === 'string' ? t.task : String(t));
            if (!taskStr) return;
            if (rouletteSettings.removeAfterSpin) {
                const spent = spentTasks[g] || [];
                if (spent.includes(taskStr)) return; // пропускаем выпавшие
            }
            allTasks.push({ game: g, task: taskStr });
        });
    });

    if (!allTasks.length) {
        wheelSegments = [{ label: t('wheel.no_tasks'), task: t('wheel.add_tasks'), game: '', color: '#484f58' }];
        return;
    }

    const max = rouletteSettings.groupSegments ? Math.max(1, rouletteSettings.maxSegments) : 200;
    if (allTasks.length > max) {
        // Группируем по играм: один сегмент = одна игра
        const gameMap = new Map();
        allTasks.forEach(item => {
            if (!gameMap.has(item.game)) gameMap.set(item.game, []);
            gameMap.get(item.game).push(item);
        });
        const gameEntries = [...gameMap.entries()]; // [[gameName, items[]], ...]
        const groupCount = Math.min(max, gameEntries.length);
        wheelSegments = [];
        for (let i = 0; i < groupCount; i++) {
            const [gameName, items] = gameEntries[i];
            wheelSegments.push({
                label: gameName,
                task: items[0].task,
                game: gameName,
                color: getSegmentColor(i, groupCount),
                isGroup: true,
                items: items
            });
        }
    } else {
        wheelSegments = allTasks.map((item, i) => ({
            label: item.game,
            task: item.task,
            game: item.game,
            color: getSegmentColor(i, allTasks.length)
        }));
    }
}

function updateWheelSegmentsForGame(gameName) {
    segmentScales = []; // сброс масштабов при обновлении сегментов
    const remaining = getRemainingTasksForGame(gameName);
    if (!remaining.length) {
        wheelSegments = [{ label: t('wheel.all_done'), task: t('wheel.all_done_desc'), game: gameName, color: '#484f58' }];
        return;
    }
    wheelSegments = remaining.map((t, i) => {
        const taskStr = typeof t === 'string' ? t : (t && typeof t.task === 'string' ? t.task : String(t));
        return { label: `#${i + 1}`, task: taskStr, game: gameName, color: getSegmentColor(i, remaining.length) };
    });
}

function getRemainingTasksForGame(name) {
    const used = Object.values(gameFirstState.assignedTasks);
    let tasks = (games[name] || []).filter(t => !used.includes(t));
    if (rouletteSettings.removeAfterSpin) {
        const spent = spentTasks[name] || [];
        tasks = tasks.filter(t => !spent.includes(t));
    }
    return tasks;
}

// Записываем задание как "потраченное" для данной игры
function markTaskSpent(gameName, task) {
    if (!rouletteSettings.removeAfterSpin || !gameName || !task) return;
    if (!spentTasks[gameName]) spentTasks[gameName] = [];
    if (!spentTasks[gameName].includes(task)) {
        spentTasks[gameName].push(task);
        localStorage.setItem('spentTasks', JSON.stringify(spentTasks));
    }
}

// Анимация плавного уменьшения и исчезновения сегмента
function animateSegmentRemoval(segIdx, duration, callback) {
    if (!rouletteSettings.removeAfterSpin || segIdx < 0 || segIdx >= wheelSegments.length) {
        if (callback) callback();
        return;
    }
    // Инициализируем масштабы всех сегментов в 1 если ещё не заданы
    segmentScales = wheelSegments.map((_, i) => segmentScales[i] !== undefined ? segmentScales[i] : 1);

    const startTime = Date.now();
    function step() {
        const t = Math.min((Date.now() - startTime) / duration, 1);
        // easeInOutQuad — медленно начинает И медленно заканчивает, без резкого схлопывания
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        segmentScales[segIdx] = 1 - eased;
        renderWheel();
        if (t < 1) {
            animationId = requestAnimationFrame(step);
        } else {
            segmentScales[segIdx] = 0;
            animationId = null;
            if (callback) callback();
        }
    }
    animationId = requestAnimationFrame(step);
}

// Подсчёт общего числа потраченных заданий
function countSpentTasks() {
    return Object.values(spentTasks).reduce((s, arr) => s + arr.length, 0);
}

// Уведомление когда все задания игры выпали
function checkAllTasksSpent(gameName) {
    if (!rouletteSettings.removeAfterSpin || !gameName) return;
    const total = (games[gameName] || []).length;
    const spent = (spentTasks[gameName] || []).length;
    if (total > 0 && spent >= total) {
        showNotification(t('notif.all_tasks_spent', { game: gameName }), 'warning');
    }
}

// ── WHEEL RENDER ──────────────────────────────────────────
function getPointerSymbol() {
    const sym = { arrow: '▼', triangle: '▽', diamond: '◆', star: '★', pin: '📍' };
    return sym[rouletteSettings.pointerStyle] || '▼';
}

function renderWheel() {
    const canvas = document.getElementById('rouletteWheel'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const outerR = W / 2 - 10, innerR = 32;
    ctx.clearRect(0, 0, W, H);

    if (!wheelSegments.length) return;

    // Outer decorative ring
    const ringGrd = ctx.createLinearGradient(0, 0, W, H);
    ringGrd.addColorStop(0, rouletteSettings.borderStyle === 'neon' ? '#00ffff' : (getComputedStyle(document.documentElement).getPropertyValue('--wheel-border').trim() || '#6366f1'));
    ringGrd.addColorStop(1, rouletteSettings.borderStyle === 'neon' ? '#ff00ff' : '#8b5cf6');
    ctx.beginPath(); ctx.arc(cx, cy, outerR + 12, 0, Math.PI * 2);
    if (rouletteSettings.borderStyle === 'glow' || rouletteSettings.borderStyle === 'neon') {
        ctx.shadowColor = ringGrd; ctx.shadowBlur = 20;
    }
    ctx.strokeStyle = ringGrd; ctx.lineWidth = rouletteSettings.borderStyle === 'dashed' ? 3 : 4;
    if (rouletteSettings.borderStyle === 'dashed') ctx.setLineDash([8, 4]); else ctx.setLineDash([]);
    ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);

    // Segments
    const segAngle = (Math.PI * 2) / wheelSegments.length;
    wheelSegments.forEach((seg, i) => {
        const sA = i * segAngle + currentWheelAngle;
        const eA = sA + segAngle;
        const scale = (segmentScales[i] !== undefined) ? segmentScales[i] : 1;
        if (scale <= 0) return; // полностью исчез — не рисуем

        ctx.save(); // ← сохраняем чистое состояние для каждого сегмента

        if (scale < 1) {
            // Масштабируем сегмент от его центра (сжатие к центру сегмента)
            const midAngle = sA + segAngle / 2;
            const midR = (innerR + outerR) / 2;
            const pivotX = cx + Math.cos(midAngle) * midR;
            const pivotY = cy + Math.sin(midAngle) * midR;
            ctx.translate(pivotX, pivotY);
            ctx.scale(scale, scale);
            ctx.translate(-pivotX, -pivotY);
            ctx.globalAlpha = scale;
        }

        // Segment fill with gradient
        const grd = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
        grd.addColorStop(0, seg.color + 'dd');
        grd.addColorStop(0.7, seg.color + 'bb');
        grd.addColorStop(1, seg.color + '55');
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, outerR, sA, eA); ctx.closePath();
        ctx.fillStyle = grd; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5; ctx.stroke();

        // Segment label — отдельный save/restore чтобы трансформации не накапливались
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(sA + segAngle / 2);
        ctx.fillStyle = '#fff';
        const fs = Math.max(9, rouletteSettings.fontSize);
        ctx.font = `bold ${fs}px Inter,system-ui,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 5;
        let lbl = seg.label || seg.game || '';
        if (lbl.length > 11) lbl = lbl.substring(0, 9) + '..';
        const textR = outerR * 0.68;
        ctx.fillText(lbl, textR, 0);
        if (seg.isGroup) {
            ctx.font = `${fs - 2}px Inter,system-ui,sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(`${seg.items?.length || 0} ${t('wheel.group_tasks', { n: '' }).replace(/{n}/, '')}`, textR, fs + 2);
        }
        ctx.restore(); // ← восстанавливаем после лейбла

        ctx.restore(); // ← восстанавливаем полностью чистое состояние
    });

    // Tick dots on the outer ring
    const tickCount = Math.min(wheelSegments.length * 2, 48);
    for (let i = 0; i < tickCount; i++) {
        const a = (i / tickCount) * Math.PI * 2;
        const tx = cx + (outerR + 7) * Math.cos(a), ty = cy + (outerR + 7) * Math.sin(a);
        ctx.beginPath(); ctx.arc(tx, ty, i % 2 === 0 ? 3 : 2, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? (COLOR_SCHEMES[rouletteSettings.colorScheme] || COLOR_SCHEMES.default)[0] : 'rgba(255,255,255,0.3)';
        ctx.fill();
    }

    // Center hub
    const hubGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
    hubGrd.addColorStop(0, '#ffffff'); hubGrd.addColorStop(1, '#e2e8f0');
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12;
    ctx.fillStyle = hubGrd; ctx.fill();
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--wheel-border').trim() || '#6366f1';
    ctx.strokeStyle = borderColor; ctx.lineWidth = 3; ctx.shadowBlur = 0; ctx.stroke();

    // Center icon
    ctx.font = `${innerR * 0.9}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(rouletteSettings.centerIcon || '🎲', cx, cy + 1);
}

// ── SPIN LOGIC ────────────────────────────────────────────
function setRouletteMode(mode) {
    rouletteMode = mode;
    gameFirstState = { active: false, selectedGame: null, currentPlayerIndex: 0, assignedTasks: {} };
    if (mode !== 'task-only' && mode !== 'game-only') {
        taskOnlyState.selectedGame = null;
        taskOnlyState.selectedPlayer = null;
    }
    saveAll();
    updateWheelSegments();
    switchTab('roulette');
    showNotification(`🎲 ${getModeHint()}`, 'info');
}

function resetGameFirstMode() {
    gameFirstState = { active: false, selectedGame: null, currentPlayerIndex: 0, assignedTasks: {} };
    updateWheelSegments();
    const rd = document.getElementById('spinResult'); if (rd) rd.classList.add('hidden');
    switchTab('roulette');
    showNotification(t('roulette.mode_reset'), 'info');
}

function confirmResetSpentTasks() {
    const total = countSpentTasks();
    let resetKey = 'roulette.spent_reset_btn';
    if (rouletteMode === 'player-only') resetKey = 'roulette.spent_reset_players';
    else if (rouletteMode === 'game-only') resetKey = 'roulette.spent_reset_games';
    showConfirmModal(
        '🗑️ ' + t('settings.spent_reset', { n: total }).replace(/🔄 /, ''),
        t(resetKey, { n: total }),
        t('common.reset'),
        t('common.cancel'),
        () => {
            spentTasks = {};
            localStorage.setItem('spentTasks', JSON.stringify(spentTasks));
            updateWheelSegments();
            renderWheel();
            refreshRouletteControls();
            showNotification(t('notif.spent_reset', { n: total }), 'success');
        }
    );
}

function selectGameForTaskOnly(gameName) {
    taskOnlyState.selectedGame = gameName;
    saveAll();
    const gameButtons = document.querySelectorAll('.game-selector-btn');
    gameButtons.forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.gameName === gameName);
    });
    updateGameSummary(gameName);
    updateWheelSegments();
    renderWheel();
    const spinBtn = document.querySelector('.spin-btn');
    if (spinBtn && !spinning) {
        spinBtn.disabled = false;
        spinBtn.textContent = `🎰 ${t('roulette.spinning_for', { name: gameName.toUpperCase() })}`;
    }
    showNotification(t('notif.game_selected', { name: gameName }), 'info');
}

function updateGameSummary(gameName) {
    const summarySection = document.querySelector('.selection-summary');
    if (!summarySection) {
        // Если блока summary нет, создаем его
        const taskOnlyStatus = document.querySelector('.task-only-status');
        if (taskOnlyStatus) {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'selection-summary';
            taskOnlyStatus.appendChild(summaryDiv);
        }
    }

    // Обновляем или создаем карточку с выбранной игрой — DOM API, без innerHTML
    let gameCard = document.querySelector('.selected-game-card');
    if (gameCard) {
        const valueSpan = gameCard.querySelector('.status-card-value');
        if (valueSpan) valueSpan.textContent = gameName;
    } else if (gameName) {
        const card = document.createElement('div');
        card.className = 'status-card selected-game-card';
        card.innerHTML = '<div class="status-card-icon">🎮</div><div class="status-card-content"><span class="status-card-label">Выбранная игра</span><span class="status-card-value"></span></div>';
        card.querySelector('.status-card-value').textContent = gameName;
        const sec = document.querySelector('.selection-summary');
        if (sec) sec.prepend(card);
    }

    // Обновляем количество заданий — textContent, без innerHTML
    const tasksStat = document.querySelector('.stat-mini .stat-mini-text');
    if (tasksStat && tasksStat.textContent.includes('Заданий:')) {
        tasksStat.textContent = `Заданий: ${games[gameName]?.length || 0}`;
    }
}

function selectPlayerForTaskOnly(playerName) {
    // null означает "случайный игрок"; пустая строка из dataset — тоже null
    if (playerName === '' || playerName === 'null') playerName = null;
    taskOnlyState.selectedPlayer = playerName;
    saveAll();

    // Обновляем стили кнопок через dataset — безопасно
    const buttons = document.querySelectorAll('.player-selector-btn');
    buttons.forEach(btn => {
        const btnPlayer = btn.dataset.playerName !== undefined
            ? (btn.dataset.playerName === '' ? null : btn.dataset.playerName)
            : null; // кнопка "Случайный" не имеет data-player-name
        btn.classList.toggle('selected', btnPlayer === playerName);
    });

    updatePlayerSummary(playerName);
    showNotification(t('notif.player_selected', { name: playerName || t('roulette.any_player') }), 'info');
}

function updatePlayerSummary(playerName) {
    // Обновляем или создаем карточку с выбранным игроком
    let playerCard = document.querySelector('.selected-player-card');
    if (playerCard) {
        const valueSpan = playerCard.querySelector('.status-card-value');
        if (valueSpan) {
            valueSpan.textContent = playerName || 'Случайный';
            // Обновляем цвет для конкретного игрока
            if (playerName) {
                const player = players.find(p => p.name === playerName);
                const color = playerColors[player?.color]?.name || '#818cf8';
                valueSpan.style.color = color;
            } else {
                valueSpan.style.color = '#818cf8';
            }
        }
    } else if (playerName !== null) {
        // Создаем карточку через DOM API — без innerHTML с пользовательскими данными
        const player = players.find(p => p.name === playerName);
        // Цвет только из разрешённого словаря playerColors — безопасно
        const safeColor = playerColors[player?.color]?.name || '#818cf8';

        const card = document.createElement('div');
        card.className = 'status-card selected-player-card';
        card.innerHTML = '<div class="status-card-icon">👤</div><div class="status-card-content"><span class="status-card-label">Выбранный игрок</span><span class="status-card-value"></span></div>';
        const val = card.querySelector('.status-card-value');
        val.textContent = playerName || 'Случайный';
        val.style.color = safeColor;

        const sec = document.querySelector('.selection-summary');
        if (sec) {
            const gameCard = sec.querySelector('.selected-game-card');
            gameCard ? gameCard.after(card) : sec.prepend(card);
        }
    }
}

function updateSelectedPlayerInfo(playerName) {
    // Оставлю эту функцию пустой, так как логика перенесена в updatePlayerSummary
}

function startSpin() {
    if (spinning) return;
    // Gamer: bonus round check
    if (rouletteSettings.bonusRoundEnabled && Math.random() * 100 < rouletteSettings.bonusRoundChance) {
        showNotification(t('roulette.bonus_round'), 'success');
        setTimeout(() => { executeSpin(); setTimeout(executeSpin, rouletteSettings.spinDuration + 2000) }, 200);
        return;
    }
    executeSpin();
}

function executeSpin() {
    if (spinning) return;
    // Validations
    if (rouletteMode === 'player-only' && players.length < 1) return showNotification(t('roulette.add_players'), 'error');
    if (rouletteMode === 'game-only') {
        const hasGames = Object.keys(games).some(g => games[g].length > 0);
        if (!hasGames) return showNotification(t('roulette.no_games_only'), 'error');
    }
    if (rouletteMode === 'task-only') {
        if (!taskOnlyState.selectedGame) return showNotification(t('roulette.select_game'), 'error');
        const selectedTasks = games[taskOnlyState.selectedGame];
        if (!selectedTasks || !selectedTasks.length) return showNotification(t('roulette.no_tasks_game'), 'error');
    }
    if (rouletteMode !== 'player-only' && rouletteMode !== 'task-only') {
        if (players.length < 1) return showNotification(t('roulette.add_players'), 'error');
        const allTasks = Object.values(games).flat();
        if (!allTasks.length) return showNotification(t('roulette.add_tasks'), 'error');
    }
    if (rouletteMode === 'game-first' && gameFirstState.active) {
        const rem = getRemainingTasksForGame(gameFirstState.selectedGame);
        if (!rem.length || Object.keys(gameFirstState.assignedTasks).length >= players.length) {
            return showNotification(t('roulette.all_assigned'), 'warning');
        }
    }

    spinning = true;
    const spinBtn = document.querySelector('.spin-btn'); if (spinBtn) spinBtn.disabled = true;
    document.getElementById('spinResult')?.classList.add('hidden');
    document.getElementById('wheelResultPopup')?.classList.add('hidden');

    if (rouletteMode === 'player-only') { spinPlayerOnly(); return }
    if (rouletteMode === 'task-only') { spinTaskOnly(); return }
    if (rouletteMode === 'game-only') { spinGameOnly(); return }
    if (rouletteMode === 'game-first') {
        if (!gameFirstState.active) startGameFirstInitial();
        else startGameFirstSpin();
        return;
    }
    startFullRandomMode();
}

function startFullRandomMode() {
    const gamesWithTasks = Object.entries(games).filter(([, ts]) => ts.length > 0);
    if (!gamesWithTasks.length) { showNotification(t('roulette.no_tasks_avail'), 'error'); finishSpin(); return }

    updateWheelSegments();

    // Выбираем случайный сегмент из тех, что реально нарисованы на колесе
    const ti = Math.floor(Math.random() * wheelSegments.length);
    const winSeg = wheelSegments[ti];

    // Если сегмент — группа (игра), выбираем случайное задание из неё
    let selGame, selTask;
    if (winSeg.isGroup && winSeg.items && winSeg.items.length) {
        const picked = winSeg.items[Math.floor(Math.random() * winSeg.items.length)];
        selGame = picked.game;
        selTask = picked.task;
    } else {
        selGame = winSeg.game;
        selTask = winSeg.task;
    }

    const selPlayer = players.length ? players[Math.floor(Math.random() * players.length)] : null;

    spinWheel(wheelSegments, ti, () => {
        setTimeout(() => {
            if (rouletteSettings.resultDisplay !== 'popup') showResult(selGame, selPlayer, selTask);
            showPopupResult(selGame, selPlayer, selTask);
            // Транслируем результат в overlay
            try { localStorage.setItem('overlayState', JSON.stringify({ type: 'result', game: selGame, player: selPlayer?.name || '?', task: selTask, duration: 12000 })); } catch (e) { }
            markTaskSpent(selGame, selTask);
            if (rouletteSettings.removeAfterSpin) {
                animateSegmentRemoval(lastWinnerSegIdx, 900, () => {
                    updateWheelSegments();
                    renderWheel();
                    checkAllTasksSpent(selGame);
                    updatePlayerStats(selPlayer?.name); playWinSound(); finishSpin();
                });
            } else {
                updatePlayerStats(selPlayer?.name); playWinSound(); finishSpin();
            }
        }, rouletteSettings.announceDelay || 0);
    });
}

function spinPlayerOnly() {
    if (!players.length) { finishSpin(); return }
    updateWheelSegments();
    // Если всё выпало — wheelSegments содержит заглушку
    if (wheelSegments.length === 1 && wheelSegments[0].task === t('wheel.all_done')) {
        showNotification(t('wheel.all_done'), 'info'); finishSpin(); return;
    }
    const ti = Math.floor(Math.random() * wheelSegments.length);
    spinWheel(wheelSegments, ti, () => {
        const seg = wheelSegments[ti];
        const p = players.find(pl => pl.name === seg?.task) || { name: seg?.task || '?', color: 'indigo', stats: {} };
        setTimeout(() => {
            showPopupResult('👤 Выбор игрока', p, p.name);
            if (rouletteSettings.resultDisplay !== 'popup') showResult('Выбор игрока', p, `${p.name} выбран!`);
            try { localStorage.setItem('overlayState', JSON.stringify({ type: 'result', game: '👤 ' + t('wheel.player_pick'), player: p?.name || '?', task: `${p?.name || '?'} ${t('results.player_picked', { name: '' }).trim()}`, duration: 10000 })); } catch (e) { }
            if (rouletteSettings.removeAfterSpin) {
                markTaskSpent('__players__', p.name);
                animateSegmentRemoval(lastWinnerSegIdx, 900, () => {
                    updateWheelSegments();
                    renderWheel();
                    const spentCount = (spentTasks['__players__'] || []).length;
                    if (spentCount >= players.length) showNotification(t('wheel.all_done'), 'success');
                    playWinSound(); finishSpin();
                });
            } else {
                playWinSound(); finishSpin();
            }
        }, rouletteSettings.announceDelay || 0);
    });
}

function spinGameOnly() {
    const gameList = Object.keys(games).filter(g => games[g].length > 0);
    if (!gameList.length) { showNotification(t('roulette.no_games_only'), 'error'); finishSpin(); return; }

    updateWheelSegments();
    // Если всё выпало
    if (wheelSegments.length === 1 && wheelSegments[0].task === t('wheel.all_done')) {
        showNotification(t('wheel.all_done'), 'info'); finishSpin(); return;
    }

    const ti = Math.floor(Math.random() * wheelSegments.length);

    spinWheel(wheelSegments, ti, () => {
        const selectedGame = wheelSegments[ti]?.game;
        if (!selectedGame) { finishSpin(); return; }
        setTimeout(() => {
            const fakePlayer = { name: '—', color: 'indigo' };
            showPopupResult(t('roulette.result_game_only'), fakePlayer, selectedGame);
            if (rouletteSettings.resultDisplay !== 'popup') {
                const rd = document.getElementById('spinResult');
                const rc = document.getElementById('resultContent');
                const ra = document.getElementById('resultActions');
                if (rd && rc) {
                    rc.innerHTML = `<div class="result-grid">
                        <div class="result-card-item" style="grid-column:1/-1">
                            <div class="result-card-icon">🎮</div>
                            <div class="result-card-label">${t('roulette.result_game_only')}</div>
                            <div class="result-card-value task-highlight">${esc(selectedGame)}</div>
                        </div>
                    </div>`;
                    if (ra) ra.innerHTML = `<br><button onclick="startSpin()" class="cyber-btn add-btn">${t('roulette.spin_again')}</button>`;
                    rd.classList.remove('hidden');
                    rd.style.animation = 'none'; void rd.offsetHeight; rd.style.animation = 'fadeInUp 0.5s ease';
                }
            }
            try { localStorage.setItem('overlayState', JSON.stringify({ type: 'result', game: selectedGame, player: '—', task: t('roulette.result_game_only') + ' ' + selectedGame, duration: 10000 })); } catch (e) { }
            if (rouletteSettings.removeAfterSpin) {
                markTaskSpent('__games__', selectedGame);
                animateSegmentRemoval(lastWinnerSegIdx, 900, () => {
                    updateWheelSegments();
                    renderWheel();
                    const spentCount = (spentTasks['__games__'] || []).length;
                    if (spentCount >= gameList.length) showNotification(t('wheel.all_done'), 'success');
                    if (rouletteSettings.particleEffect) createParticles();
                    playWinSound(); finishSpin();
                });
            } else {
                if (rouletteSettings.particleEffect) createParticles();
                playWinSound(); finishSpin();
            }
        }, rouletteSettings.announceDelay || 0);
    });
}

function spinTaskOnly() {
    if (!taskOnlyState.selectedGame || !games[taskOnlyState.selectedGame]) {
        showNotification('Выберите игру из списка', 'error');
        finishSpin();
        return;
    }

    // Используем отфильтрованный список — тот же что и на колесе
    updateWheelSegments();

    // Если все задания уже потрачены — wheelSegments содержит заглушку
    const availableSegs = wheelSegments.filter(s => s.task && s.task !== t('wheel.all_done_desc'));
    if (!availableSegs.length) {
        showNotification('В выбранной игре нет заданий', 'error');
        finishSpin();
        return;
    }

    // Выбираем случайный индекс из wheelSegments (уже отфильтрованы)
    const ti = Math.floor(Math.random() * wheelSegments.length);

    // Определяем игрока: выбранный конкретный или случайный
    let selectedPlayer;
    if (taskOnlyState.selectedPlayer) {
        // Конкретный игрок выбран
        const foundPlayer = players.find(p => p.name === taskOnlyState.selectedPlayer);
        selectedPlayer = foundPlayer || { name: taskOnlyState.selectedPlayer, color: 'indigo', stats: {} };
    } else {
        // Случайный игрок или "Все" если игроков нет
        selectedPlayer = players.length ? players[Math.floor(Math.random() * players.length)] : { name: 'Все', color: 'indigo', stats: {} };
    }

    spinWheel(wheelSegments, ti, () => {
        // Берём задание напрямую из выигравшего сегмента wheelSegments
        const task = wheelSegments[ti]?.task;
        if (!task) { finishSpin(); return; }
        setTimeout(() => {
            showPopupResult(taskOnlyState.selectedGame, selectedPlayer, task);
            if (rouletteSettings.resultDisplay !== 'popup') showResult(taskOnlyState.selectedGame, selectedPlayer, task);
            // Транслируем результат в overlay
            try { localStorage.setItem('overlayState', JSON.stringify({ type: 'result', game: taskOnlyState.selectedGame, player: selectedPlayer?.name || '?', task: task, duration: 12000 })); } catch (e) { }
            markTaskSpent(taskOnlyState.selectedGame, task);
            if (rouletteSettings.removeAfterSpin) {
                animateSegmentRemoval(lastWinnerSegIdx, 900, () => {
                    updateWheelSegments();
                    renderWheel();
                    checkAllTasksSpent(taskOnlyState.selectedGame);
                    playWinSound(); finishSpin();
                });
            } else {
                playWinSound(); finishSpin();
            }
        }, rouletteSettings.announceDelay || 0);
    });
}

function startGameFirstInitial() {
    const gamesWithTasks = Object.entries(games).filter(([, t]) => t.length > 0);
    if (!gamesWithTasks.length) { showNotification('Нет игр с заданиями', 'error'); finishSpin(); return }
    const selGame = gamesWithTasks[Math.floor(Math.random() * gamesWithTasks.length)][0];
    updateWheelSegments();
    // Ищем сегмент с нужной игрой прямо в wheelSegments
    let ti = wheelSegments.findIndex(s => s.game === selGame);
    if (ti < 0) ti = 0;
    spinWheel(wheelSegments, ti, () => {
        gameFirstState = { active: true, selectedGame: selGame, currentPlayerIndex: 0, assignedTasks: {} };
        // Обновляем сегменты под выбранную игру и перерисовываем колесо
        updateWheelSegmentsForGame(selGame);
        renderWheel();
        showWheel();
        // Обновляем только инфо-панель без скрытия колеса
        const infoArea = document.querySelector('.roulette-info');
        if (infoArea) {
            // пересоздаём вкладку чтобы показать статус, но колесо уже стоит
            switchTab('roulette');
        }
        showNotification(`🎮 ${t('roulette.selected_game')}: ${selGame}!`, 'success');
        if (players[0]) setTimeout(() => showNotification(`👤 ${players[0].name}`, 'info'), 1500);
        finishSpin();
    });
}

function startGameFirstSpin() {
    const curP = players[gameFirstState.currentPlayerIndex];
    if (!curP) { hideWheelSmoothly(); setTimeout(showFinalResults, 600); return }
    const remaining = getRemainingTasksForGame(gameFirstState.selectedGame);
    if (!remaining.length) { hideWheelSmoothly(); setTimeout(showFinalResults, 600); return }
    const gameOnlyTasks = remaining.map(t => ({ game: gameFirstState.selectedGame, task: t }));
    const selTask = remaining[Math.floor(Math.random() * remaining.length)];
    const ti = gameOnlyTasks.findIndex(i => i.task === selTask);
    updateWheelSegmentsForGame(gameFirstState.selectedGame); renderWheel();
    spinWheel(gameOnlyTasks, ti >= 0 ? ti : 0, () => {
        gameFirstState.assignedTasks[curP.name] = selTask;
        setTimeout(() => {
            if (rouletteSettings.resultDisplay !== 'popup') showResult(gameFirstState.selectedGame, curP, selTask);
            showPopupResult(gameFirstState.selectedGame, curP, selTask);
            // Транслируем результат в overlay
            try { localStorage.setItem('overlayState', JSON.stringify({ type: 'result', game: gameFirstState.selectedGame, player: curP?.name || '?', task: selTask, duration: 12000 })); } catch (e) { }
            markTaskSpent(gameFirstState.selectedGame, selTask);
            if (rouletteSettings.removeAfterSpin) {
                animateSegmentRemoval(lastWinnerSegIdx, 900, () => {
                    updatePlayerStats(curP.name); playWinSound();
                    gameFirstState.currentPlayerIndex++;
                    const nextP = players[gameFirstState.currentPlayerIndex];
                    const stillRem = getRemainingTasksForGame(gameFirstState.selectedGame);
                    if (!nextP || !stillRem.length) { hideWheelSmoothly(); setTimeout(showFinalResults, 700) }
                    else { switchTab('roulette'); updateWheelSegmentsForGame(gameFirstState.selectedGame); renderWheel(); showNotification(`👤 ${t('roulette.now_spinning')}: ${nextP.name}`, 'info') }
                    finishSpin();
                });
            } else {
                updatePlayerStats(curP.name); playWinSound();
                gameFirstState.currentPlayerIndex++;
                const nextP = players[gameFirstState.currentPlayerIndex];
                const stillRem = getRemainingTasksForGame(gameFirstState.selectedGame);
                if (!nextP || !stillRem.length) { hideWheelSmoothly(); setTimeout(showFinalResults, 700) }
                else { switchTab('roulette'); updateWheelSegmentsForGame(gameFirstState.selectedGame); renderWheel(); showNotification(`👤 ${t('roulette.now_spinning')}: ${nextP.name}`, 'info') }
                finishSpin();
            }
        }, rouletteSettings.announceDelay || 0);
    });
}

function hideWheelSmoothly() {
    const wc = document.getElementById('wheelContainer');
    if (wc) { wc.style.transition = 'all 0.6s ease'; wc.style.opacity = '0'; wc.style.transform = 'scale(0.8)'; wc.style.maxHeight = '0'; wc.style.overflow = 'hidden'; wc.style.margin = '0'; wc.style.pointerEvents = 'none' }
}
function showWheel() {
    const wc = document.getElementById('wheelContainer');
    if (wc) { wc.style.transition = 'all 0.5s ease'; wc.style.opacity = '1'; wc.style.transform = 'scale(1)'; wc.style.maxHeight = '600px'; wc.style.margin = ''; wc.style.pointerEvents = 'auto'; wc.style.overflow = '' }
}
function finishSpin() {
    spinning = false;
    const btn = document.querySelector('.spin-btn');
    if (btn) btn.disabled = false;
    refreshRouletteControls();
}

// Обновляет кнопки управления рулеткой прямо в DOM (без перерендера вкладки)
function refreshRouletteControls() {
    const ctrl = document.querySelector('.roulette-controls');
    if (!ctrl) return;
    // Убираем старую кнопку сброса и все br перед ней
    ctrl.querySelectorAll('.spent-reset-btn').forEach(b => {
        // удаляем предшествующий br если есть
        if (b.previousSibling && b.previousSibling.nodeName === 'BR') {
            b.previousSibling.remove();
        }
        b.remove();
    });
    // Добавляем свежую если нужна
    if (rouletteSettings.removeAfterSpin && countSpentTasks() > 0) {
        const btn = document.createElement('button');
        btn.className = 'cyber-btn danger-btn outline-btn spent-reset-btn';
        btn.style.marginTop = '8px';
        const n = countSpentTasks();
        if (rouletteMode === 'player-only') {
            btn.textContent = t('roulette.spent_reset_players', { n });
        } else if (rouletteMode === 'game-only') {
            btn.textContent = t('roulette.spent_reset_games', { n });
        } else {
            btn.textContent = t('roulette.spent_reset_btn', { n });
        }
        btn.onclick = confirmResetSpentTasks;
        const hint = ctrl.querySelector('.spin-hint');
        ctrl.insertBefore(btn, hint);
    }
}

// ── ANIMATION ENGINE ──────────────────────────────────────
function spinWheel(tasks, targetIdx, callback) {
    if (!tasks.length) { if (callback) callback(); return }
    lastWinnerSegIdx = targetIdx;
    const segAngle = (Math.PI * 2) / tasks.length;
    const targetAngle = targetIdx * segAngle + segAngle / 2; // середина целевого сегмента (от угла 0)
    const POINTER = -Math.PI / 2; // указатель сверху (12 часов)
    const spins = rouletteSettings.minSpins + Math.floor(Math.random() * (rouletteSettings.maxSpins - rouletteSettings.minSpins + 1));
    // Нужно: targetAngle + currentWheelAngle + totalRot ≡ POINTER (mod 2π)
    // → totalRot = POINTER - currentWheelAngle - targetAngle + N*2π
    const remainder = ((POINTER - currentWheelAngle - targetAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const totalRot = spins * Math.PI * 2 + remainder;
    if (rouletteSettings.soundEnabled) playSpinSound();
    animateWheel(totalRot, callback);
}

// ── Easing functions ──────────────────────────────────────
// easeOutQuint: очень плавное торможение без резкого останова
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 5) }
function easeOutBounce(t) {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
}
function easeOutElastic(t) {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
}

function getEaseFn() {
    if (rouletteSettings.wheelAnimation === 'bounce') return easeOutBounce;
    if (rouletteSettings.wheelAnimation === 'elastic') return easeOutElastic;
    if (rouletteSettings.wheelAnimation === 'linear') return t => t;
    return easeOutCubic;
}

function animateWheel(totalRotation, callback) {
    const canvas = document.getElementById('rouletteWheel');
    if (!canvas) { if (callback) callback(); return }
    const duration = rouletteSettings.spinDuration;
    const startTime = Date.now();
    const startAngle = currentWheelAngle;
    const easeFn = getEaseFn();
    let lastTickSeg = -1;

    if (rouletteSettings.visualEffects) {
        const wc = document.getElementById('wheelContainer');
        if (wc) { wc.style.transition = 'all 0.3s ease'; wc.style.transform = 'scale(1.02)' }
    }

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeFn(progress);
        currentWheelAngle = startAngle + totalRotation * eased;
        renderWheel();

        // Tick sound on segment changes (last 30%)
        if (progress > 0.7 && rouletteSettings.soundEnabled && rouletteSettings.tickSoundEnabled) {
            const seg = Math.floor((currentWheelAngle % (Math.PI * 2)) / ((Math.PI * 2) / wheelSegments.length));
            if (seg !== lastTickSeg) { lastTickSeg = seg; playTickSound() }
        }

        // Glow effect near end — плавно нарастает с 70% прогресса
        if (rouletteSettings.visualEffects && rouletteSettings.glowEffect && progress > 0.7) {
            const t = (progress - 0.7) / 0.3;  // 0→1 в диапазоне 70–100%
            const g = 6 + t * 22;              // 6px → 28px (мягко)
            const o = 0.15 + t * 0.45;          // 0.15 → 0.60 (не режет глаз)
            if (canvas) canvas.style.filter = `drop-shadow(0 0 ${g.toFixed(1)}px rgba(99,102,241,${o.toFixed(2)}))`;
        }

        if (progress < 1) {
            animationId = requestAnimationFrame(animate);
        } else {
            currentWheelAngle = (startAngle + totalRotation) % (Math.PI * 2);
            if (rouletteSettings.visualEffects && rouletteSettings.shakeEffect) shakeWheel(() => finalizeSpin(callback));
            else finalizeSpin(callback);
        }
    }
    animationId = requestAnimationFrame(animate);
}

function finalizeSpin(callback) {
    renderWheel();
    const canvas = document.getElementById('rouletteWheel');
    // Плавно убираем glow через CSS transition
    if (canvas) {
        canvas.style.transition = 'filter 0.6s ease';
        canvas.style.filter = 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))';
    }
    const wc = document.getElementById('wheelContainer');
    if (wc) { wc.style.transition = 'transform 0.4s ease'; wc.style.transform = 'scale(1)'; }
    animationId = null;
    if (rouletteSettings.visualEffects && rouletteSettings.highlightWinner) highlightWinner(callback);
    else if (callback) callback();
}

function shakeWheel(callback) {
    const canvas = document.getElementById('rouletteWheel');
    if (!canvas) { if (callback) callback(); return }
    // Плавная лёгкая вибрация — меньше амплитуда, дольше затухание
    const frames = [1.5, -1.2, 0.9, -0.6, 0.3, 0];
    let i = 0;
    function step() {
        if (i < frames.length) {
            canvas.style.transition = `transform ${i === 0 ? 80 : 70}ms ease-out`;
            canvas.style.transform = `rotate(${frames[i]}deg) scale(1)`;
            i++;
            setTimeout(step, i === 1 ? 90 : 75);
        } else {
            canvas.style.transition = 'transform 0.35s ease';
            canvas.style.transform = 'rotate(0deg) scale(1)';
            setTimeout(() => { if (callback) callback() }, 380);
        }
    }
    step();
}

function highlightWinner(callback) {
    const canvas = document.getElementById('rouletteWheel');
    if (canvas) {
        canvas.style.transition = 'all 0.5s ease';
        canvas.style.filter = 'drop-shadow(0 0 40px rgba(63,185,80,0.85)) brightness(1.18)';
        setTimeout(() => {
            canvas.style.transition = 'all 1.2s ease';
            canvas.style.filter = 'drop-shadow(0 8px 24px rgba(0,0,0,0.5)) brightness(1)';
        }, 800);
    }
    if (callback) callback();
}

// ── RESULT DISPLAY ────────────────────────────────────────
function typeWriter(el, text, speed) {
    let i = 0; el.textContent = '';
    function type() { if (i < text.length) { el.textContent += text[i]; i++; setTimeout(type, speed) } }
    type();
}

function showPopupResult(game, player, task) {
    // Берём popup из body (он туда перенесён при рендере)
    let popup = document.getElementById('wheelResultPopup');
    // Если popup ещё внутри wheel-container — перенесём в body
    if (popup && popup.closest('.wheel-container')) {
        document.body.appendChild(popup);
    }
    if (!popup) return;
    if (rouletteSettings.resultDisplay === 'card') { popup.classList.add('hidden'); return }

    const cd = playerColors[player?.color] || playerColors.indigo;
    const pg = popup.querySelector('.popup-game');
    const pp = popup.querySelector('.popup-player');
    const pt = popup.querySelector('.popup-task');

    if (pg) { pg.textContent = ''; typeWriter(pg, `🎮 ${game}`, 25) }
    if (pp) { pp.textContent = ''; setTimeout(() => typeWriter(pp, `👤 ${player?.name || '?'}`, 25), 260); pp.style.color = cd.name }
    if (pt) { pt.textContent = ''; setTimeout(() => typeWriter(pt, `⚡ ${task}`, 16), 520) }

    // Отправляем результат в чат
    // Функция отправки в чат недоступна без авторизации

    // Добавляем подсказку закрытия если её нет
    if (!popup.querySelector('.popup-close-hint')) {
        const hint = document.createElement('div');
        hint.className = 'popup-close-hint';
        hint.textContent = t('results.popup_close_hint');
        hint.onclick = () => closePopup(popup);
        popup.appendChild(hint);
    }

    popup.classList.remove('hidden');
    popup.style.animation = 'none';
    void popup.offsetHeight;
    popup.style.animation = 'popupBounce 0.55s cubic-bezier(0.175,0.885,0.32,1.275)';

    if (rouletteSettings.visualEffects && rouletteSettings.glowEffect) popup.classList.add('win');
    if (rouletteSettings.particleEffect) createParticles();

    // Закрытие по клику на затемнение
    popup._bgClickHandler = (e) => { if (e.target === popup) closePopup(popup) };
    popup.addEventListener('click', popup._bgClickHandler);

    if (rouletteSettings.autoClosePopup) {
        popup._autoCloseTimer = setTimeout(() => closePopup(popup), rouletteSettings.popupDuration);
    }
}

function closePopup(popup) {
    if (!popup) popup = document.getElementById('wheelResultPopup');
    if (!popup) return;
    if (popup._autoCloseTimer) { clearTimeout(popup._autoCloseTimer); popup._autoCloseTimer = null }
    if (popup._bgClickHandler) { popup.removeEventListener('click', popup._bgClickHandler); popup._bgClickHandler = null }
    popup.style.animation = 'popupFadeOut 0.4s ease forwards';
    popup.classList.remove('win');
    setTimeout(() => {
        popup.classList.add('hidden');
        popup.style.animation = '';
    }, 400);
}

function showResult(game, player, task) {
    if (rouletteSettings.resultDisplay === 'popup') return;
    const rd = document.getElementById('spinResult'), rc = document.getElementById('resultContent'), ra = document.getElementById('resultActions');
    if (!rd || !rc) return;
    const cd = playerColors[player?.color] || playerColors.indigo;
    rc.innerHTML = `<div class="result-grid">
        <div class="result-card-item"><div class="result-card-icon">🎮</div><div class="result-card-label">${t('roulette.result_game')}</div><div class="result-card-value">${esc(game)}</div></div>
        <div class="result-card-item"><div class="result-card-icon">👤</div><div class="result-card-label">${t('roulette.result_player')}</div><div class="result-card-value" style="color:${esc(cd.name)}">${esc(player?.name || '?')}</div></div>
        <div class="result-card-item"><div class="result-card-icon">⚡</div><div class="result-card-label">${t('roulette.result_task')}</div><div class="result-card-value task-highlight">${esc(task)}</div></div>
    </div>`;
    if (ra) {
        // Используем только безопасные статичные кнопки без пользовательских данных в обработчиках
        if (gameFirstState.active) {
            const nextP = players[gameFirstState.currentPlayerIndex];
            const rem = getRemainingTasksForGame(gameFirstState.selectedGame);
            if (nextP && rem.length > 0) {
                const btn = document.createElement('button');
                btn.className = 'cyber-btn add-btn';
                btn.style.marginTop = '8px';
                btn.textContent = t('roulette.next_player', { name: nextP.name });
                btn.onclick = startSpin;
                ra.innerHTML = '<br>';
                ra.appendChild(btn);
            } else {
                ra.innerHTML = `<br><button onclick="showFinalResults()" class="cyber-btn add-btn">${t('roulette.all_results')}</button>`;
            }
        } else {
            ra.innerHTML = `<br><button onclick="startSpin()" class="cyber-btn add-btn">${t('roulette.spin_again')}</button>`;
        }
    }
    rd.classList.remove('hidden'); rd.style.animation = 'none'; void rd.offsetHeight; rd.style.animation = 'fadeInUp 0.5s ease';
}

function showFinalResults() {
    const assigned = Object.keys(gameFirstState.assignedTasks).length;
    if (!assigned && gameFirstState.active) return showNotification('Нет назначенных заданий', 'warning');
    const unassigned = players.filter(p => !gameFirstState.assignedTasks[p.name]);
    const rd = document.getElementById('spinResult'), rc = document.getElementById('resultContent'), ra = document.getElementById('resultActions');
    if (!rd || !rc) return;
    rc.innerHTML = `
        <div class="final-result-header">
            <div class="final-game-info"><span class="final-game-icon">🎮</span><span class="final-game-name">${esc(gameFirstState.selectedGame)}</span></div>
            <div class="final-stats">
                <span class="final-stat-badge success">✅ ${assigned}</span>
                ${unassigned.length ? `<span class="final-stat-badge warning">⚠️ ${unassigned.length}</span>` : ''}
            </div>
        </div>
        <div class="final-results-list">
            <div class="final-results-title">📋 Задания (${assigned}/${players.length})</div>
            <div class="final-results-grid">
                ${Object.entries(gameFirstState.assignedTasks).map(([pn, pt], idx) => {
        const pl = players.find(p => p.name === pn);
        const cd = playerColors[pl?.color] || playerColors.indigo;
        return `<div class="final-result-row"><span class="final-result-number">#${idx + 1}</span><span class="final-result-player" style="color:${esc(cd.name)}">${esc(pn)}</span><span class="final-result-arrow">→</span><span class="final-result-task">${esc(pt)}</span></div>`;
    }).join('')}
            </div>
        </div>
        ${unassigned.length ? `<div class="unassigned-warning"><p class="unassigned-warning-title">⚠️ Без заданий</p><div class="unassigned-players-list">${unassigned.map(p => `<span class="unassigned-player-tag" style="border-color:${esc(playerColors[p.color]?.name || '#818cf8')};color:${esc(playerColors[p.color]?.name || '#818cf8')}">${esc(p.name)}</span>`).join('')}</div></div>` : ''}
    `;
    if (ra) ra.innerHTML = `<br><button onclick="resetGameFirstMode()" class="cyber-btn add-btn">${t('results.start_over')}</button><button onclick="exportResults()" class="cyber-btn export-btn">${t('results.export')}</button>`;
    rd.classList.remove('hidden'); rd.style.animation = 'none'; void rd.offsetHeight; rd.style.animation = 'fadeInUp 0.5s ease';
    switchTab('roulette');
}

// ── PARTICLES ─────────────────────────────────────────────
function createParticles() {
    const colors = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6', '#84cc16', '#f97316', '#06b6d4'];
    const count = rouletteSettings.particleCount || 30;
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const p = document.createElement('div');
            p.className = 'win-particle';
            const size = Math.random() * 10 + 6, angle = Math.random() * Math.PI * 2, vel = Math.random() * 220 + 80;
            const sx = window.innerWidth / 2, sy = window.innerHeight / 2;
            const ex = sx + Math.cos(angle) * vel, ey = sy + Math.sin(angle) * vel;
            const dur = Math.random() * 900 + 500;
            const isStar2 = rouletteSettings.particleStyle === 'star';
            p.style.cssText = `position:fixed;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random() * colors.length)]};border-radius:${isStar2 ? '2px' : '50%'};left:${sx}px;top:${sy}px;z-index:9999;pointer-events:none;animation:particleBurst ${dur}ms ease-out forwards;--end-x:${ex - sx}px;--end-y:${ey - sy}px;${isStar2 ? 'clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)' : ''}`;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), dur + 100);
        }, i * 15);
    }
}

function updatePlayerStats(name) {
    const p = players.find(x => x.name === name);
    if (p) { if (!p.stats) p.stats = { gamesPlayed: 0, tasksCompleted: 0 }; p.stats.gamesPlayed++; p.stats.tasksCompleted++; saveAll() }
}

// ── STREAMER TAB ──────────────────────────────────────────
function renderStreamerTab() {
    return `<div class="streamer-panel">
        <div class="streamer-hero">
            <span class="streamer-hero-icon">📡</span>
            <h2>${t('streamer.hero_title')}</h2>
            <p>${t('streamer.hero_desc')}</p>
        </div>
        <div class="streamer-tools-grid">

            <!-- OBS Overlay -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">🖥️</span>
                    <div><div class="streamer-tool-title">${t('streamer.obs_title')}</div><div class="streamer-tool-desc">${t('streamer.obs_desc')}</div></div>
                </div>
                <div class="overlay-url-box">
                    <input type="text" id="overlayUrlInput" readonly value="${getOverlayUrl()}" style="font-size:10px;min-width:0">
                    <button onclick="copyOverlayUrl()" class="cyber-btn primary-btn" style="padding:5px 10px;font-size:11px">📋 ${t('common.export')}</button>
                </div>
                <div class="overlay-status"><span class="overlay-dot"></span> ${t('streamer.obs_ready')}</div>
                <div class="streamer-tool-actions">
                    <button onclick="openOverlayWindow()" class="cyber-btn add-btn">${t('streamer.obs_open')}</button>
                    <button onclick="toggleChromaKey()" class="cyber-btn ${rouletteSettings.chromaKey ? 'primary-btn' : ''}">${t('streamer.obs_chroma')}</button>
                    <button onclick="showOverlaySettings()" class="cyber-btn">${t('streamer.obs_settings')}</button>
                </div>
                <div style="margin-top:10px;font-size:11px;color:var(--text-muted)">
                    ${t('streamer.obs_hint')}
                </div>
            </div>

            <!-- Chat Vote -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">🗳️</span>
                    <div><div class="streamer-tool-title">${t('streamer.vote_title')}</div><div class="streamer-tool-desc">${t('streamer.vote_desc')}</div></div>
                </div>
                <div class="channel-input-group">
                    <input type="text" id="channelNameInput" placeholder="${t('streamer.channel_placeholder')}" value="${esc(streamerState.channelName)}" oninput="updateChannelName(this.value)" onkeypress="if(event.key==='Enter')twitchToggleConnect()">
                    <button onclick="twitchToggleConnect()" class="cyber-btn ${streamerState.connected ? 'danger-btn' : 'add-btn'} channel-connect-btn" id="chatConnectBtn">
                        ${streamerState.twitchStatus === 'connected' ? t('streamer.disconnect_btn')
            : streamerState.twitchStatus === 'connecting' ? t('streamer.connecting_btn')
                : streamerState.twitchStatus === 'error' ? t('streamer.error_btn')
                    : t('streamer.connect_btn')}
                    </button>
                </div>
                <div class="channel-input-group" style="margin-bottom:8px">
                    <!-- Auth removed, read-only -->
                </div>
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px">
                    ${t('streamer.readonly_hint')}
                </div>
                <div id="twitchStatusBar" style="font-size:11px;margin:6px 0 10px;color:${streamerState.twitchStatus === 'connected' ? 'var(--accent-success)'
            : streamerState.twitchStatus === 'error' ? 'var(--accent-danger)'
                : 'var(--text-muted)'}">
                    ${streamerState.twitchStatus === 'connected'
            ? `<span style="display:inline-flex;align-items:center;gap:5px"><span class="overlay-dot"></span> ${t('streamer.status_reading', { ch: esc(streamerState.channelName) })}</span>`
            : streamerState.twitchStatus === 'connecting' ? t('streamer.status_connecting')
                : streamerState.twitchStatus === 'error' ? t('streamer.status_error')
                    : t('streamer.status_idle')}
                </div>
                <div id="voteArea">
                    ${renderVoteArea()}
                </div>
                <div style="margin-top:12px;font-size:11px;color:var(--text-muted);padding:8px;background:var(--bg-tertiary);border-radius:var(--radius-sm)">
                    💡 <strong>${t('streamer.cmd_hint_title')}</strong><br>
                    ${t('streamer.cmd_spin')}<br>
                    ${t('streamer.cmd_vote')}<br>
                    ${t('streamer.cmd_timer')}<br>
                    <br><strong>${t('streamer.cmd_viewer_title')}</strong><br>
                    ${t('streamer.cmd_join')}
                </div>
            </div>

            <!-- Timer -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">⏱️</span>
                    <div><div class="streamer-tool-title">${t('streamer.timer_title')}</div><div class="streamer-tool-desc">${t('streamer.timer_desc')}</div></div>
                </div>
                <div class="timer-display" id="timerDisplay">${formatTime(streamerState.timerSeconds || 0)}</div>
                <div class="input-group" style="margin-bottom:10px">
                    <input type="number" id="timerMinutes" placeholder="${t('streamer.timer_min')}" min="0" max="99" value="5" style="max-width:80px">
                    <input type="number" id="timerSeconds2" placeholder="${t('streamer.timer_sec')}" min="0" max="59" value="0" style="max-width:80px">
                    <button onclick="setTimer()" class="cyber-btn primary-btn">${t('streamer.timer_set_btn')}</button>
                </div>
                <div class="timer-controls">
                    <button onclick="startTimer()"  class="cyber-btn add-btn"    id="timerStartBtn">${streamerState.timerRunning ? t('streamer.timer_pause') : t('streamer.timer_start')}</button>
                    <button onclick="resetTimer()"  class="cyber-btn danger-btn">${t('streamer.timer_reset')}</button>
                    <button onclick="addTime(30)"   class="cyber-btn">${t('streamer.timer_add30')}</button>
                    <button onclick="addTime(60)"   class="cyber-btn">${t('streamer.timer_add1m')}</button>
                </div>
                <div style="margin-top:10px;font-size:11px;color:var(--text-muted)">
                    ${t('streamer.stats_messages')} ${streamerState.chatStats.totalMessages}, ${t('streamer.stats_unique').replace(':', '')} ${streamerState.chatStats.uniqueViewers}
                </div>
            </div>

            <!-- Subscriber Wheel -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">💜</span>
                    <div><div class="streamer-tool-title">${t('streamer.subwheel_title')}</div><div class="streamer-tool-desc">${t('streamer.subwheel_desc')}</div></div>
                </div>
                <div class="sub-wheel-section">
                    <div class="input-group" style="margin-bottom:8px">
                        <input type="text" id="subNameInput" placeholder="${t('streamer.sub_placeholder')}" onkeypress="if(event.key==='Enter')addSubToWheel()">
                        <button onclick="addSubToWheel()" class="cyber-btn add-btn">${t('streamer.sub_add_btn')}</button>
                    </div>
                    <div class="sub-list" id="subList">${renderSubList()}</div>
                </div>
                <div class="streamer-tool-actions">
                    <button onclick="spinSubWheel()" class="cyber-btn spin-btn" style="width:100%;font-size:12px;letter-spacing:1px;padding:12px" ${!streamerState.subWheelList.length ? 'disabled' : ''}>${t('streamer.sub_spin_btn')}</button>
                </div>
                <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
                    <button onclick="addAllChattersToWheel()" class="cyber-btn primary-btn" style="flex:1;font-size:11px" ${streamerState.twitchStatus !== 'connected' ? 'disabled' : ''}>${t('streamer.sub_all_chat')}</button>
                    ${streamerState.subWheelList.length ? `<button onclick="clearSubWheel()" class="cyber-btn danger-btn" style="flex:1;font-size:11px">${t('streamer.sub_clear')}</button>` : ''}
                </div>
            </div>

            <!-- Quick Commands -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">⚡</span>
                    <div><div class="streamer-tool-title">${t('streamer.quick_title')}</div><div class="streamer-tool-desc">${t('streamer.quick_desc')}</div></div>
                </div>
                <div class="quick-commands">
                    <button onclick="quickSpin()" class="quick-cmd-btn"><span class="cmd-icon">🎰</span><span class="cmd-label">${t('streamer.quick_spin')}</span></button>
                    <button onclick="quickCopyResult()" class="quick-cmd-btn"><span class="cmd-icon">📋</span><span class="cmd-label">${t('streamer.quick_copy')}</span></button>
                    <button onclick="quickShareResult()" class="quick-cmd-btn"><span class="cmd-icon">📤</span><span class="cmd-label">${t('streamer.quick_export')}</span></button>
                    <button onclick="switchTab('roulette')" class="quick-cmd-btn"><span class="cmd-icon">🎡</span><span class="cmd-label">${t('streamer.quick_roulette')}</span></button>
                    <button onclick="quickAddFromChat()" class="quick-cmd-btn"><span class="cmd-icon">💬</span><span class="cmd-label">${t('streamer.quick_chat')}</span></button>
                    <button onclick="openOverlayWindow()" class="quick-cmd-btn"><span class="cmd-icon">🖥️</span><span class="cmd-label">${t('streamer.quick_overlay')}</span></button>
                    <button onclick="startVote()" class="quick-cmd-btn"><span class="cmd-icon">🗳️</span><span class="cmd-label">${t('streamer.quick_vote')}</span></button>
                    <button onclick="quickResetSession()" class="quick-cmd-btn"><span class="cmd-icon">🔄</span><span class="cmd-label">${t('streamer.quick_reset')}</span></button>
                </div>
            </div>

            <!-- Chat / Twitch IRC -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">💬</span>
                    <div>
                        <div class="streamer-tool-title">${t('streamer.chat_title')}</div>
                        <div class="streamer-tool-desc">${streamerState.twitchStatus === 'connected' ? t('streamer.chat_online', { ch: streamerState.channelName }) : t('streamer.chat_real_irc')}</div>
                    </div>
                </div>
                <div class="chat-box" id="chatBox">${renderChatMessages()}</div>
                <div class="streamer-tool-actions" style="margin-top:8px">
                    <button onclick="sendCommandsList()" class="cyber-btn primary-btn" ${!streamerState.twitchToken || streamerState.twitchStatus !== 'connected' ? 'disabled' : ''}>${t('streamer.chat_commands')}</button>
                    <button onclick="clearChat()" class="cyber-btn danger-btn">${t('streamer.chat_clear')}</button>
                </div>
                ${streamerState.chatStats.mostActiveUser ? `<div style="margin-top:8px;font-size:10px;color:var(--text-muted)">${t('streamer.chat_most_active', { name: streamerState.chatStats.mostActiveUser })}</div>` : ''}
            </div>

            <!-- Stream Tools -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">🔧</span>
                    <div><div class="streamer-tool-title">${t('streamer.tools_title')}</div><div class="streamer-tool-desc">${t('streamer.tools_desc')}</div></div>
                </div>
                <div style="display:grid;gap:8px;margin-bottom:12px">
                    <div style="display:flex;gap:8px;align-items:center">
                        <label style="font-size:12px;min-width:80px">${t('streamer.sounds_label')}</label>
                        <label class="toggle-switch"><input type="checkbox" ${streamerState.chatSounds || false ? 'checked' : ''} onchange="toggleChatSounds(this.checked)"><span class="toggle-slider"></span></label>
                        <span style="font-size:11px;color:var(--text-muted)">${t('streamer.sounds_hint')}</span>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center">
                        <label style="font-size:12px;min-width:80px">${t('streamer.autospin_label')}</label>
                        <label class="toggle-switch"><input type="checkbox" ${streamerState.autoSpin || false ? 'checked' : ''} onchange="toggleAutoSpin(this.checked)"><span class="toggle-slider"></span></label>
                        <span style="font-size:11px;color:var(--text-muted)">${t('streamer.autospin_hint')}</span>
                    </div>
                </div>
                <div class="streamer-tool-actions">
                    <button onclick="showStreamStats()" class="cyber-btn">${t('streamer.stats_btn')}</button>
                    <button onclick="exportStreamData()" class="cyber-btn export-btn">${t('streamer.export_btn')}</button>
                    <button onclick="resetStreamSession()" class="cyber-btn danger-btn">${t('streamer.reset_btn')}</button>
                </div>
            </div>

        </div>
    </div>`;
}

function renderVoteArea() {
    const isReal = streamerState.twitchStatus === 'connected';
    if (!streamerState.voteActive) {
        const gameOptions = Object.keys(games).slice(0, 4);
        return `
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px">
                ${isReal
                ? `✅ ${t('streamer.status_reading', { ch: esc(streamerState.channelName) }).replace('Читаем чат', 'Чат подключён —')} зрители пишут <b>1–4</b> для голосования`
                : `⚠️ ${t('streamer.connect_first_vote')}`}
            </div>
            <div style="margin-bottom:10px">
                <input type="text" id="voteTitle" placeholder="${t('streamer.vote_topic')}"
                    value="${esc(streamerState.voteTitle || '')}"
                    oninput="streamerState.voteTitle=this.value"
                    style="width:100%;font-size:12px;padding:8px 12px;border-radius:var(--radius-md);
                           background:var(--bg-input);color:var(--text-primary);
                           border:2px solid var(--border-light);outline:none;box-sizing:border-box"
                    onfocus="this.style.borderColor='var(--border-focus)'"
                    onblur="this.style.borderColor='var(--border-light)'">
            </div>
            <div class="input-group" style="margin-bottom:10px">
                <input type="number" id="voteDuration" placeholder="sec" min="10" max="300" value="${streamerState.voteDuration}" style="max-width:80px" oninput="streamerState.voteDuration=parseInt(this.value)||30">
                <label style="font-size:12px;color:var(--text-secondary);min-width:auto">${t('streamer.vote_sec_label')}</label>
            </div>
            <div class="vote-options" style="margin-bottom:12px">
                ${gameOptions.map((g, i) => `
                    <div class="vote-option">
                        <span class="vote-option-key">${i + 1}</span>
                        <span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g)}</span>
                    </div>`).join('')}
                ${!gameOptions.length ? `<div style="font-size:12px;color:var(--text-muted)">${t('streamer.no_games_vote')}</div>` : ''}
            </div>
            <button onclick="startVote()" class="cyber-btn add-btn" style="width:100%" ${!gameOptions.length || !isReal ? 'disabled' : ''}>
                ${isReal ? t('streamer.vote_start_btn') : t('streamer.vote_connect_first')}
            </button>`;
    }

    const opts = streamerState.voteOptions || [];
    const votes = streamerState.voteVotes || {};
    const total = Object.values(votes).reduce((s, v) => s + v.count, 0) || 1;
    const voterCount = Object.keys(streamerState.voteVoters || {}).length;
    const titleHtml = streamerState.voteTitle
        ? `<div style="font-size:13px;font-weight:700;color:var(--accent-primary);
                       text-align:center;margin-bottom:8px;padding:6px 10px;
                       background:rgba(99,102,241,0.1);border-radius:var(--radius-sm);
                       border:1px solid rgba(99,102,241,0.2);word-break:break-word">
               🗳️ ${esc(streamerState.voteTitle)}
           </div>`
        : '';

    return `
        ${titleHtml}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div class="vote-timer ${streamerState.voteTimer <= 5 ? 'urgent' : ''}" id="voteCountdown" style="font-size:24px;margin:0">${t('overlay.vote_sec', { n: streamerState.voteTimer })}</div>
            <div style="font-size:11px;color:var(--text-secondary);text-align:right">
                👥 ${t('streamer.vote_voters', { n: voterCount })}
            </div>
        </div>
        <div class="vote-options">
            ${opts.map((o, i) => {
        const cnt = votes[i + 1]?.count || 0;
        const pct = Math.round((cnt / total) * 100);
        return `<div class="vote-option">
                    <span class="vote-option-key">${i + 1}</span>
                    <div style="flex:1;min-width:0">
                        <span style="font-size:11px;font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o)}</span>
                        <div class="vote-option-bar">
                            <div class="vote-option-fill" id="vf${i}" style="width:${pct}%"></div>
                        </div>
                    </div>
                    <span class="vote-option-count" id="vc${i}">${cnt} (${pct}%)</span>
                </div>`;
    }).join('')}
        </div>
        <button onclick="stopVote()" class="cyber-btn danger-btn" style="width:100%;margin-top:10px">${t('streamer.vote_stop_btn')}</button>`;
}

function startVote() {
    const gameOptions = Object.keys(games).slice(0, 4);
    if (!gameOptions.length) return showNotification(t('streamer.no_games_vote'), 'error');
    if (!streamerState.connected) return showNotification(t('streamer.connect_first_vote'), 'warning');

    // Сохраняем тему из поля ввода если оно ещё в DOM
    const titleInput = document.getElementById('voteTitle');
    if (titleInput) streamerState.voteTitle = titleInput.value.trim();

    streamerState.voteOptions = gameOptions;
    streamerState.voteVotes = {};
    streamerState.voteVoters = {};      // кто уже проголосовал
    streamerState.voteActive = true;
    streamerState.voteTimer = streamerState.voteDuration || 30;
    gameOptions.forEach((_, i) => { streamerState.voteVotes[i + 1] = { option: gameOptions[i], count: 0 } });

    const titleMsg = streamerState.voteTitle ? ` "${streamerState.voteTitle}"` : '';
    showNotification(t('streamer.vote_started', { topic: titleMsg, n: gameOptions.length }), 'success');

    // Передаём данные голосования в overlay через localStorage
    try {
        localStorage.setItem('overlayState', JSON.stringify({
            type: 'vote',
            title: streamerState.voteTitle || '',
            options: gameOptions.map(g => ({ name: g, count: 0 })),
            timer: streamerState.voteDuration || 30
        }));
    } catch (e) { }

    streamerState.voteInterval = setInterval(() => {
        streamerState.voteTimer--;

        // Обновляем таймер
        const cd = document.getElementById('voteCountdown');
        if (cd) { cd.textContent = t('overlay.vote_sec', { n: streamerState.voteTimer }); cd.className = `vote-timer${streamerState.voteTimer <= 5 ? ' urgent' : ''}` }
        // Перерисовываем только бары голосов без полного ре-рендера
        _refreshVoteBars();
        if (streamerState.voteTimer <= 0) stopVote();
    }, 1000);

    const va = document.getElementById('voteArea');
    if (va) va.innerHTML = renderVoteArea();
}

function _refreshVoteBars() {
    const opts = streamerState.voteOptions || [];
    const votes = streamerState.voteVotes || {};
    const total = Object.values(votes).reduce((s, v) => s + v.count, 0) || 1;
    opts.forEach((_, i) => {
        const cnt = votes[i + 1]?.count || 0;
        const pct = Math.round((cnt / total) * 100);
        const fill = document.getElementById(`vf${i}`);
        const cnt_el = document.getElementById(`vc${i}`);
        if (fill) fill.style.width = pct + '%';
        if (cnt_el) cnt_el.textContent = cnt + ` (${pct}%)`;
    });
}


function stopVote() {
    if (streamerState.voteInterval) { clearInterval(streamerState.voteInterval); streamerState.voteInterval = null }
    let winner = null, maxVotes = -1;
    Object.values(streamerState.voteVotes).forEach(v => {
        if (v.count > maxVotes) { maxVotes = v.count; winner = v.option }
    });
    const voterCount = Object.keys(streamerState.voteVoters || {}).length;
    streamerState.voteActive = false;
    const va = document.getElementById('voteArea');
    if (va) va.innerHTML = renderVoteArea();
    if (winner && maxVotes > 0) {
        showNotification(t('streamer.vote_winner', { name: winner, votes: maxVotes, viewers: voterCount }), 'success');
        try {
            localStorage.setItem('overlayState', JSON.stringify({
                type: 'winner',
                name: winner,
                from: t('streamer.vote_from', { n: voterCount }) + (streamerState.voteTitle ? ` · ${streamerState.voteTitle}` : '')
            }));
        } catch (e) { }
    } else {
        showNotification(t('streamer.vote_no_votes'), 'info');
        try {
            localStorage.setItem('overlayState', JSON.stringify({ type: 'idle' }));
        } catch (e) { }
    }
}

// Timer functions
function setTimer() {
    const m = parseInt(document.getElementById('timerMinutes')?.value) || 0;
    const s = parseInt(document.getElementById('timerSeconds2')?.value) || 0;
    streamerState.timerSeconds = m * 60 + s;
    streamerState.timerInitial = streamerState.timerSeconds;
    updateTimerDisplay();
}
function startTimer() {
    if (streamerState.timerRunning) {
        clearInterval(streamerState.timerInterval); streamerState.timerInterval = null;
        streamerState.timerRunning = false;
        const btn = document.getElementById('timerStartBtn'); if (btn) btn.textContent = t('streamer.timer_start');
        updateTimerDisplay(); // транслируем pause в overlay
        return;
    }
    if (streamerState.timerSeconds <= 0) return showNotification(t('streamer.timer_set_first'), 'warning');
    streamerState.timerRunning = true;
    const btn = document.getElementById('timerStartBtn'); if (btn) btn.textContent = t('streamer.timer_pause');
    updateTimerDisplay();
    streamerState.timerInterval = setInterval(() => {
        if (streamerState.timerSeconds > 0) { streamerState.timerSeconds--; updateTimerDisplay() }
        else {
            clearInterval(streamerState.timerInterval); streamerState.timerInterval = null;
            streamerState.timerRunning = false;
            const b = document.getElementById('timerStartBtn'); if (b) b.textContent = t('streamer.timer_start');
            updateTimerDisplay();
            playWinSound(); showNotification(t('streamer.timer_done'), 'warning');
        }
    }, 1000);
}
function resetTimer() {
    if (streamerState.timerInterval) { clearInterval(streamerState.timerInterval); streamerState.timerInterval = null }
    streamerState.timerRunning = false;
    streamerState.timerSeconds = streamerState.timerInitial || 0;
    const btn = document.getElementById('timerStartBtn'); if (btn) btn.textContent = t('streamer.timer_start');
    updateTimerDisplay();
}
function addTime(secs) {
    streamerState.timerSeconds += secs;
    updateTimerDisplay();
    showNotification(t('streamer.timer_added', { n: secs }), 'info');
}
function updateTimerDisplay() {
    const d = document.getElementById('timerDisplay'); if (!d) return;
    const t = streamerState.timerSeconds;
    d.textContent = formatTime(t);
    d.className = `timer-display ${t <= 30 && t > 10 ? 'warning' : ''} ${t <= 10 && t > 0 ? 'danger' : ''}`;
    // Транслируем состояние таймера в overlay
    try {
        localStorage.setItem('overlayTimer', JSON.stringify({
            seconds: streamerState.timerSeconds,
            initial: streamerState.timerInitial,
            running: streamerState.timerRunning,
            ts: Date.now()
        }));
    } catch (e) { }
}
function formatTime(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// Subscriber wheel
function renderSubList() {
    const chatParticipants = getChatParticipants(1);
    const activeCount = chatParticipants.length;
    if (!streamerState.subWheelList.length) {
        return `
            <span style="font-size:11px;color:var(--text-muted)">${t('streamer.sub_empty')}</span>
            ${activeCount > 0 ? `<div style="margin-top:6px;font-size:10px;color:var(--text-secondary)">${t('streamer.sub_active_count', { n: activeCount })}</div>` : ''}
        `;
    }
    return `
        ${streamerState.subWheelList.map((n, i) => `<span class="sub-tag" data-idx="${i}" onclick="removeSubFromWheel(+this.dataset.idx)" title="${t('common.delete')}">${esc(n)} ×</span>`).join('')}
        ${activeCount > 0 ? `<div style="margin-top:8px;font-size:10px;color:var(--text-secondary)">${t('streamer.sub_active_count', { n: activeCount })}</div>` : ''}
    `;
}
function addSubToWheel() {
    const inp = document.getElementById('subNameInput'); if (!inp) return;
    const name = inp.value.trim(); if (!name) return;
    streamerState.subWheelList.push(name); inp.value = '';
    const sl = document.getElementById('subList'); if (sl) sl.innerHTML = renderSubList();
    switchTab('streamer');
    showNotification(t('streamer.sub_added', { name }), 'info');
}
function removeSubFromWheel(i) {
    streamerState.subWheelList.splice(i, 1);
    switchTab('streamer');
}
function clearSubWheel() {
    streamerState.subWheelList = []; switchTab('streamer');
    showNotification(t('streamer.sub_cleared'), 'info');
}
function spinSubWheel() {
    if (!streamerState.subWheelList.length) return showNotification(t('streamer.sub_no_viewers'), 'error');
    const winner = streamerState.subWheelList[Math.floor(Math.random() * streamerState.subWheelList.length)];
    playWinSound();
    if (rouletteSettings.particleEffect) createParticles();
    showNotification(t('streamer.sub_winner', { name: winner }), 'success');
    const modal = document.getElementById('confirmModal');
    if (modal) {
        document.getElementById('modalTitle').textContent = t('streamer.sub_winner_title');
        document.getElementById('modalMessage').innerHTML = `<div style="text-align:center;padding:20px"><div style="font-size:48px;margin-bottom:16px">🏆</div><div style="font-size:24px;font-weight:700;color:var(--accent-primary)">${esc(winner)}</div><div style="font-size:13px;color:var(--text-muted);margin-top:8px">${t('streamer.sub_from', { n: streamerState.subWheelList.length })}</div></div>`;
        document.getElementById('modalConfirm').textContent = t('common.close');
        document.getElementById('modalConfirm').onclick = closeModal;
        const cb = modal.querySelector('.cancel-btn'); if (cb) cb.style.display = 'none';
        modal.classList.remove('hidden');
    }
}

// Chat functions
function renderChatMessages() {
    const isReal = streamerState.twitchStatus === 'connected';
    const msgs = streamerState.chatMessages;
    if (!msgs.length) {
        return `<div style="color:var(--text-muted);font-size:11px;padding:8px;text-align:center">
            ${isReal ? t('streamer.chat_waiting') : t('streamer.chat_connect_first')}
        </div>`;
    }
    return msgs.slice(-50).map(m => _renderOneChatMsg(m)).join('');
}

function sendChatMsg() {
    const inp = document.getElementById('chatMsgInput');
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) return;

    // Добавляем в локальный чат как превью
    const colors = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#67e8f9', '#a3e635'];
    const msgObj = {
        user: streamerState.channelName || 'Стример',
        text,
        color: colors[Math.floor(Math.random() * colors.length)],
        badge: 'broadcaster',
        timestamp: Date.now()
    };

    streamerState.chatMessages.push(msgObj);
    saveChatMessage(msgObj);
    inp.value = '';

    const cb = document.getElementById('chatBox');
    if (cb) {
        cb.innerHTML = renderChatMessages();
        cb.scrollTop = cb.scrollHeight;
    }

    // Обработка команд
    if (text.startsWith('!')) {
        processChatCommand(msgObj.user, text, { isBroad: true, isMod: false, isSub: false });
    }
}

// Отправка команд в чат (список команд — только локальный превью)
function sendCommandsList() {
    const commands = [
        '🎰 !spin - запустить рулетку',
        '🗳️ !vote - начать голосование',
        '⏱️ !timer N - установить таймер на N минут',
        '💜 !addchatters - добавить всех активных в колесо',
        '🗑️ !clearwheel - очистить колесо',
        '� !join / !addme - добавиться в колесо',
        '❓ !commands / !help - показать команды'
    ];

    const msgObj = {
        user: 'RCH_Bot',
        text: commands.join(' | '),
        color: '#9147ff',
        badge: '',
        timestamp: Date.now()
    };

    streamerState.chatMessages.push(msgObj);
    saveChatMessage(msgObj);

    const cb = document.getElementById('chatBox');
    if (cb) {
        cb.innerHTML = renderChatMessages();
        cb.scrollTop = cb.scrollHeight;
    }

    showNotification('📝 ' + t('streamer.chat_commands') + ' added', 'info');
}

function clearChat() {
    streamerState.chatMessages = [];
    streamerState.chatStats.totalMessages = 0;
    streamerState.chatStats.uniqueViewers = 0;
    streamerState.chatStats.mostActiveUser = '';
    saveStreamerData();

    const cb = document.getElementById('chatBox');
    if (cb) cb.innerHTML = renderChatMessages();
    showNotification(t('streamer.chat_cleared'), 'info');
}
function twitchToggleConnect() {
    const inp = document.getElementById('channelNameInput');
    if (inp) streamerState.channelName = inp.value.trim();
    if (streamerState.twitchStatus === 'connected') {
        twitchDisconnect();
    } else {
        twitchConnect(streamerState.channelName);
    }
}

// Quick commands
function quickSpin() {
    if (streamerState.autoSpin) {
        if (spinning) return showNotification(t('streamer.spinning_already'), 'warning');
        startSpin();
    } else {
        switchTab('roulette');
        setTimeout(() => { startSpin(); }, 400);
    }
}
function quickCopyResult() {
    const rc = document.getElementById('resultContent');
    if (!rc || !rc.textContent.trim()) return showNotification(t('notif.no_result_copy'), 'warning');
    navigator.clipboard.writeText(rc.innerText).then(() => showNotification(t('notif.copied'), 'success')).catch(() => showNotification(t('notif.copy_error'), 'error'));
}
function quickShareResult() { exportResults() }
function quickAddFromChat() {
    const game = Object.keys(games)[0];
    if (!game) return showNotification(t('games.no_game_selected'), 'warning');
    const chatTasks = ['Play one-handed', 'No sound for 5 min', 'Swap controls', 'Blindfolded for 2 min'];
    const task = chatTasks[Math.floor(Math.random() * chatTasks.length)];
    games[game].push(task); saveAll();
    showNotification(t('notif.task_added_to', { task, game }), 'success');
}
function quickResetSession() {
    showConfirmModal(t('streamer.reset_confirm'), t('streamer.reset_msg'), t('streamer.reset_btn2'), t('common.cancel'), () => {
        resetGameFirstMode();
        showNotification(t('streamer.session_reset'), 'success');
    });
}

// OBS Overlay
function getOverlayUrl() {
    // Формируем полный URL к overlay.html относительно текущего файла
    const base = window.location.href.replace(/[^/]*$/, '');
    return base + 'overlay.html';
}
function copyOverlayUrl() {
    navigator.clipboard.writeText(getOverlayUrl())
        .then(() => showNotification(t('streamer.url_copied'), 'success'))
        .catch(() => showNotification(t('streamer.url_copy_error'), 'error'));
}
function openOverlayWindow() {
    const url = getOverlayUrl();
    const w = window.open(url, 'obs-overlay');
    if (!w) {
        showNotification(t('streamer.overlay_blocked'), 'warning');
    } else {
        showNotification(t('streamer.overlay_opened'), 'info');
    }
}
function toggleChromaKey() {
    rouletteSettings.chromaKey = !rouletteSettings.chromaKey; saveSettings();
    showNotification(rouletteSettings.chromaKey ? t('streamer.chroma_on') : t('streamer.chroma_off'), 'info');
    switchTab('streamer');
}
function showOverlaySettings() {
    showConfirmModal(t('streamer.obs_title'),
        t('streamer.obs_hint'),
        t('streamer.obs_open'), t('common.cancel'), openOverlayWindow);
}

// ── STATS TAB ─────────────────────────────────────────────
function renderStatsTab() {
    const gTotal = Object.keys(games).length;
    const tTotal = Object.values(games).reduce((s, t) => s + t.length, 0);
    const pTotal = players.length;
    const totalSpins = players.reduce((s, p) => s + (p.stats?.gamesPlayed || 0), 0);
    const topPlayer = players.reduce((mx, p) => (p.stats?.gamesPlayed || 0) > (mx?.stats?.gamesPlayed || 0) ? p : mx, null);
    const bigGame = Object.entries(games).reduce((mx, [g, t]) => t.length > (mx?.[1]?.length || 0) ? [g, t] : mx, null);

    // Три совета дня — по одному из каждой категории
    const tipCoop = getDailyTip('coop');
    const tipComp = getDailyTip('comp');
    const tipOnline = getDailyTip('online');
    const tipFact = getDailyTip('fact');
    // Показываем 3 карточки: кооп, соревн., факт — ротируются каждый день
    const dayIdx = Math.floor(Date.now() / 86400000);
    const featuredTips = [tipCoop, tipComp, dayIdx % 2 === 0 ? tipFact : tipOnline];

    return `<div class="stats-panel">

        <!-- Счётчики -->
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${gTotal}</div><div class="stat-label">${t('stats.games')}</div></div>
            <div class="stat-card"><div class="stat-value">${tTotal}</div><div class="stat-label">${t('stats.tasks')}</div></div>
            <div class="stat-card"><div class="stat-value">${pTotal}</div><div class="stat-label">${t('stats.players')}</div></div>
            <div class="stat-card"><div class="stat-value">${totalSpins}</div><div class="stat-label">${t('stats.spins')}</div></div>
        </div>

        ${topPlayer ? `<div class="top-player">
            <h3>${t('stats.top_player_title')}</h3>
            <div class="player-highlight">
                <span class="highlight-name">${esc(topPlayer.name)}</span> —
                <span class="highlight-stats">${t('stats.top_spins', { n: topPlayer.stats?.gamesPlayed || 0 })}</span>
            </div>
        </div>` : ''}
        ${bigGame ? `<div class="top-player" style="border-color:var(--accent-success)">
            <h3>${t('stats.top_game_title')}</h3>
            <div class="player-highlight">
                <span class="highlight-name">${esc(bigGame[0])}</span> —
                <span class="highlight-stats">${t('stats.top_tasks', { n: bigGame[1].length })}</span>
            </div>
        </div>` : ''}

        <div class="top-player" style="border-color:var(--accent-primary);margin-bottom:0">
            <h3>${t('stats.tips_title')}</h3>
        </div>
        <div class="tips-grid">
            ${featuredTips.map(tip => `
                <div class="tip-card tip-cat-${esc(tip.cat)}">
                    <div class="tip-header">
                        <span class="tip-icon">${tip.icon}</span>
                        <span class="tip-tag">${esc(tip.tag)}</span>
                    </div>
                    <p class="tip-text">${esc(tip.text)}</p>
                </div>
            `).join('')}
        </div>

        <!-- Кнопки фильтра советов -->
        <div class="tips-filter" id="tipsFilter">
            <button class="tips-filter-btn active" onclick="filterTips('all',this)">${t('stats.filter_all')}</button>
            <button class="tips-filter-btn" onclick="filterTips('coop',this)">${t('stats.filter_coop')}</button>
            <button class="tips-filter-btn" onclick="filterTips('comp',this)">${t('stats.filter_comp')}</button>
            <button class="tips-filter-btn" onclick="filterTips('online',this)">${t('stats.filter_online')}</button>
            <button class="tips-filter-btn" onclick="filterTips('fact',this)">${t('stats.filter_fact')}</button>
        </div>
        <div class="tips-list" id="tipsList">
            ${renderTipsList('all')}
        </div>

        <!-- Статистика игроков -->
        <div class="players-stats">
            <h3>${t('stats.players_stats')}</h3>
            ${pTotal === 0 ? `<p class="empty-text">${t('stats.no_data')}</p>` : players.map(p => {
        const plays = p.stats?.gamesPlayed || 0;
        const maxP = Math.max(...players.map(x => x.stats?.gamesPlayed || 0), 1);
        const pct = Math.min(Math.round((plays / maxP) * 100), 100);
        const cd = playerColors[p.color] || playerColors.indigo;
        return `<div class="player-stats-row">
                    <span class="player-stats-name" style="color:${esc(cd.name)}">${esc(p.name)}</span>
                    <div class="stats-bar"><div class="stats-fill" style="width:${pct}%;background:${esc(cd.gradient)}"></div></div>
                    <span class="player-stats-count">${t('stats.n_games', { n: plays })}</span>
                </div>`;
    }).join('')}
        </div>

        <!-- Игры по заданиям -->
        <div class="players-stats">
            <h3>${t('stats.games_stats')}</h3>
            ${gTotal === 0 ? `<p class="empty-text">${t('stats.no_data')}</p>` : Object.entries(games)
            .sort(([, a], [, b]) => b.length - a.length)
            .map(([g, tasks], i) => {
                const maxT = Math.max(...Object.values(games).map(x => x.length), 1);
                const pct = Math.round((tasks.length / maxT) * 100);
                const col = COLOR_SCHEMES.default[i % COLOR_SCHEMES.default.length];
                return `<div class="player-stats-row">
                        <span class="player-stats-name">${esc(g)}</span>
                        <div class="stats-bar"><div class="stats-fill" style="width:${pct}%;background:${esc(col)}"></div></div>
                        <span class="player-stats-count">${t('stats.n_tasks_g', { n: tasks.length })}</span>
                    </div>`;
            }).join('')}
        </div>

    </div>`;
}

// Рендер списка советов для фильтра
function renderTipsList(category) {
    const pool = category === 'all' ? GAMING_TIPS : GAMING_TIPS.filter(t => t.cat === category);
    return pool.map(tip => `
        <div class="tip-list-item">
            <span class="tip-list-icon">${tip.icon}</span>
            <div class="tip-list-body">
                <span class="tip-list-tag tip-cat-${esc(tip.cat)}-tag">${esc(tip.tag)}</span>
                <p class="tip-list-text">${esc(tip.text)}</p>
            </div>
        </div>`).join('');
}

// Фильтрация советов по категории (вызывается из onclick)
function filterTips(category, btn) {
    const list = document.getElementById('tipsList');
    if (list) list.innerHTML = renderTipsList(category);
    document.querySelectorAll('.tips-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

// ── SETTINGS TAB ──────────────────────────────────────────
function renderSettingsTab() {
    return `<div class="settings-panel">
        <div class="settings-header"><h2>${t('settings.title')}</h2><p>${t('settings.subtitle')}</p></div>
        <div class="settings-subtabs">
            <button onclick="switchSettingsTab('speed')"    class="settings-subtab ${settingsSubTab === 'speed' ? 'active' : ''}">${t('settings.tab_speed')}</button>
            <button onclick="switchSettingsTab('sound')"    class="settings-subtab ${settingsSubTab === 'sound' ? 'active' : ''}">${t('settings.tab_sound')}</button>
            <button onclick="switchSettingsTab('wheel')"    class="settings-subtab ${settingsSubTab === 'wheel' ? 'active' : ''}">${t('settings.tab_wheel')}</button>
            <button onclick="switchSettingsTab('effects')"  class="settings-subtab ${settingsSubTab === 'effects' ? 'active' : ''}">${t('settings.tab_effects')}</button>
            <button onclick="switchSettingsTab('gamer')"    class="settings-subtab ${settingsSubTab === 'gamer' ? 'active' : ''}">${t('settings.tab_gamer')}</button>
            <button onclick="switchSettingsTab('streamer')" class="settings-subtab ${settingsSubTab === 'streamer' ? 'active' : ''}">${t('settings.tab_streamer')}</button>
            <button onclick="switchSettingsTab('theme')"    class="settings-subtab ${settingsSubTab === 'theme' ? 'active' : ''}">${t('settings.tab_theme')}</button>
        </div>
        <div id="settingsContent">${renderSettingsContent()}</div>
        <div class="settings-actions">
            <button onclick="resetSettings()" class="cyber-btn danger-btn">${t('settings.reset_all')}</button>
            <button onclick="applySettings()"  class="cyber-btn add-btn">${t('settings.apply_btn')}</button>
            <button onclick="exportSettings()" class="cyber-btn export-btn">${t('settings.export_btn')}</button>
            <button onclick="importSettings()" class="cyber-btn import-btn">${t('settings.import_btn')}</button>
        </div>
    </div>`;
}

function switchSettingsTab(name) {
    settingsSubTab = name;
    const sc = document.getElementById('settingsContent');
    if (sc) sc.innerHTML = renderSettingsContent();
    document.querySelectorAll('.settings-subtab').forEach(t => t.classList.toggle('active', t.textContent.includes(getSettingsTabEmoji(name))));
}
function getSettingsTabEmoji(n) {
    return { speed: '🎯', sound: '🔊', wheel: '🎡', effects: '✨', gamer: '🎮', streamer: '📡', theme: '🎨' }[n] || '';
}

function renderSettingsContent() {
    switch (settingsSubTab) {
        case 'speed': return renderSpeedSettings();
        case 'sound': return renderSoundSettings();
        case 'wheel': return renderWheelSettings();
        case 'effects': return renderEffectsSettings();
        case 'gamer': return renderGamerSettings();
        case 'streamer': return renderStreamerSettings();
        case 'theme': return renderThemeSettings();
        default: return renderSpeedSettings();
    }
}

function renderSpeedSettings() {
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">${t('settings.speed_title')}</span></h3>
        <div class="settings-group">
            ${rangeItem('spinDuration', t('settings.spin_duration'), rouletteSettings.spinDuration, 2000, 15000, 500, 'spinDuration', v => v / 1000 + 's')}
            ${rangeItem('minSpins', t('settings.min_spins'), rouletteSettings.minSpins, 1, 15, 1, 'minSpins')}
            ${rangeItem('maxSpins', t('settings.max_spins'), rouletteSettings.maxSpins, 5, 30, 1, 'maxSpins')}
            <div class="setting-item">
                <label>${t('settings.animation')}</label>
                <select onchange="updateSetting('wheelAnimation',this.value)" style="flex:1;max-width:200px">
                    <option value="ease"    ${rouletteSettings.wheelAnimation === 'ease' ? 'selected' : ''}>${t('settings.anim_ease')}</option>
                    <option value="bounce"  ${rouletteSettings.wheelAnimation === 'bounce' ? 'selected' : ''}>${t('settings.anim_bounce')}</option>
                    <option value="elastic" ${rouletteSettings.wheelAnimation === 'elastic' ? 'selected' : ''}>${t('settings.anim_elastic')}</option>
                    <option value="linear"  ${rouletteSettings.wheelAnimation === 'linear' ? 'selected' : ''}>${t('settings.anim_linear')}</option>
                </select>
            </div>
            ${rangeItem('announceDelay', t('settings.announce_delay'), rouletteSettings.announceDelay, 0, 3000, 100, 'announceDelay', v => v + 'ms')}
        </div>
    </div>`;
}

function renderSoundSettings() {
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">${t('settings.sound_title')}</span></h3>
        <div class="settings-group">
            ${toggleItem('soundEnabled', t('settings.sound_enable'), rouletteSettings.soundEnabled)}
            ${rangeItem('soundVolume', t('settings.sound_volume'), Math.round(rouletteSettings.soundVolume * 100), 0, 100, 5, 'soundVolume', v => v + '%')}
            ${toggleItem('tickSoundEnabled', t('settings.tick_sound'), rouletteSettings.tickSoundEnabled)}
            ${toggleItem('winSoundEnabled', t('settings.win_sound'), rouletteSettings.winSoundEnabled)}
            <div class="setting-item">
                <label>${t('settings.spin_sound_type')}</label>
                <select onchange="updateSetting('spinSoundType',this.value)" style="flex:1;max-width:200px">
                    <option value="whoosh" ${rouletteSettings.spinSoundType === 'whoosh' ? 'selected' : ''}>${t('settings.sound_whoosh')}</option>
                    <option value="drum"   ${rouletteSettings.spinSoundType === 'drum' ? 'selected' : ''}>${t('settings.sound_drum')}</option>
                    <option value="casino" ${rouletteSettings.spinSoundType === 'casino' ? 'selected' : ''}>${t('settings.sound_casino')}</option>
                </select>
            </div>
        </div>
    </div>`;
}

function renderWheelSettings() {
    const schemes = Object.keys(COLOR_SCHEMES);
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">${t('settings.wheel_title')}</span></h3>
        <div class="settings-group">
            ${rangeItem('wheelSize', t('settings.wheel_size'), rouletteSettings.wheelSize, 280, 620, 20, 'wheelSize', v => v + 'px')}
            ${rangeItem('fontSize', t('settings.font_size'), rouletteSettings.fontSize, 8, 18, 1, 'fontSize', v => v + 'px')}
            ${rangeItem('maxSegments', t('settings.max_segments'), rouletteSettings.maxSegments, 4, 32, 2, 'maxSegments')}
            ${toggleItem('groupSegments', t('settings.group_segs'), rouletteSettings.groupSegments)}
            <div class="setting-item">
                <label>${t('settings.center_icon')}</label>
                <input type="text" id="centerIconInput" value="${rouletteSettings.centerIcon || '🎲'}" maxlength="2" oninput="updateSetting('centerIcon',this.value);renderWheel()" style="max-width:80px;text-align:center;font-size:20px">
            </div>
            <div class="setting-item">
                <label>${t('settings.border_style')}</label>
                <select onchange="updateSetting('borderStyle',this.value);renderWheel()" style="flex:1;max-width:200px">
                    <option value="glow"   ${rouletteSettings.borderStyle === 'glow' ? 'selected' : ''}>${t('settings.border_glow')}</option>
                    <option value="solid"  ${rouletteSettings.borderStyle === 'solid' ? 'selected' : ''}>${t('settings.border_solid')}</option>
                    <option value="dashed" ${rouletteSettings.borderStyle === 'dashed' ? 'selected' : ''}>${t('settings.border_dashed')}</option>
                    <option value="neon"   ${rouletteSettings.borderStyle === 'neon' ? 'selected' : ''}>${t('settings.border_neon')}</option>
                </select>
            </div>
            <div class="setting-item">
                <label>${t('settings.pointer_style')}</label>
                <div class="pointer-styles">
                    ${['arrow', 'triangle', 'diamond', 'star', 'pin'].map(s => `<button onclick="updateSetting('pointerStyle','${s}');document.getElementById('wheelPointer').textContent=getPointerSymbol()" class="pointer-style-btn ${rouletteSettings.pointerStyle === s ? 'active' : ''}"><span class="pointer-style-symbol">${{ arrow: '▼', triangle: '▽', diamond: '◆', star: '★', pin: '📍' }[s]}</span><span class="pointer-style-label">${s}</span></button>`).join('')}
                </div>
            </div>
        </div>
        <h3 class="section-title" style="margin-top:16px"><span class="neon-text">${t('settings.color_schemes')}</span></h3>
        <div class="color-schemes">
            ${schemes.map(k => {
        const dots = (COLOR_SCHEMES[k] || []).slice(0, 5);
        return `<div class="color-scheme-card ${rouletteSettings.colorScheme === k ? 'active' : ''}" onclick="updateSetting('colorScheme','${k}');updateWheelSegments();renderWheel();document.querySelectorAll('.color-scheme-card').forEach(c=>c.classList.remove('active'));this.classList.add('active')">
                    <div class="color-scheme-dots">${dots.map(c => `<div class="color-scheme-dot" style="background:${c}"></div>`).join('')}</div>
                    <div class="color-scheme-name">${k}</div>
                </div>`;
    }).join('')}
        </div>
    </div>`;
}

function renderEffectsSettings() {
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">${t('settings.effects_title')}</span></h3>
        <div class="settings-group">
            ${toggleItem('visualEffects', t('settings.visual_effects'), rouletteSettings.visualEffects)}
            ${toggleItem('highlightWinner', t('settings.highlight_win'), rouletteSettings.highlightWinner)}
            ${toggleItem('shakeEffect', t('settings.shake_effect'), rouletteSettings.shakeEffect)}
            ${toggleItem('glowEffect', t('settings.glow_effect'), rouletteSettings.glowEffect)}
            ${toggleItem('particleEffect', t('settings.particle_effect'), rouletteSettings.particleEffect)}
            ${rangeItem('particleCount', t('settings.particle_count'), rouletteSettings.particleCount, 10, 80, 5, 'particleCount')}
            <div class="setting-item">
                <label>${t('settings.particle_style')}</label>
                <select onchange="updateSetting('particleStyle',this.value)" style="flex:1;max-width:200px">
                    <option value="circle"   ${rouletteSettings.particleStyle === 'circle' ? 'selected' : ''}>${t('settings.particle_circle')}</option>
                    <option value="star"     ${rouletteSettings.particleStyle === 'star' ? 'selected' : ''}>${t('settings.particle_star')}</option>
                    <option value="confetti" ${rouletteSettings.particleStyle === 'confetti' ? 'selected' : ''}>${t('settings.particle_confetti')}</option>
                </select>
            </div>
            <div class="setting-item">
                <label>${t('settings.result_display')}</label>
                <select onchange="updateSetting('resultDisplay',this.value)" style="flex:1;max-width:200px">
                    <option value="both"  ${rouletteSettings.resultDisplay === 'both' ? 'selected' : ''}>${t('settings.result_both')}</option>
                    <option value="popup" ${rouletteSettings.resultDisplay === 'popup' ? 'selected' : ''}>${t('settings.result_popup')}</option>
                    <option value="card"  ${rouletteSettings.resultDisplay === 'card' ? 'selected' : ''}>${t('settings.result_card')}</option>
                </select>
            </div>
            ${toggleItem('autoClosePopup', t('settings.auto_close'), rouletteSettings.autoClosePopup)}
            ${rangeItem('popupDuration', t('settings.popup_duration'), rouletteSettings.popupDuration, 2000, 15000, 500, 'popupDuration', v => v / 1000 + 's')}
        </div>
    </div>`;
}

function renderGamerSettings() {
    const spentCount = Object.values(spentTasks).reduce((s, arr) => s + arr.length, 0);
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">${t('settings.gamer_title')}</span><span class="section-badge">PRO</span></h3>
        <div class="settings-group">
            ${toggleItem('bonusRoundEnabled', t('settings.bonus_round'), rouletteSettings.bonusRoundEnabled)}
            ${rangeItem('bonusRoundChance', t('settings.bonus_chance'), rouletteSettings.bonusRoundChance, 1, 50, 1, 'bonusRoundChance', v => v + '%')}
            ${toggleItem('weightedSegments', t('settings.weighted_segs'), rouletteSettings.weightedSegments)}
            ${toggleItem('removeAfterSpin', t('settings.remove_after'), rouletteSettings.removeAfterSpin)}
            <div class="setting-item" style="flex-direction:column;align-items:flex-start;gap:6px">
                <label style="font-size:11px;color:var(--text-muted)">${t('settings.remove_hint')}</label>
                ${spentCount > 0 ? `<button onclick="confirmResetSpentTasks()" class="cyber-btn danger-btn" style="padding:5px 14px;font-size:12px">${t('settings.spent_reset', { n: spentCount })}</button>` : `<span style="font-size:11px;color:var(--text-muted)">${t('settings.no_spent')}</span>`}
            </div>
            ${toggleItem('blacklistEnabled', t('settings.blacklist'), rouletteSettings.blacklistEnabled)}
            <div class="setting-item">
                <label style="min-width:140px">${t('settings.blacklist')} (lines)</label>
                <textarea id="blacklistInput" placeholder="${t('settings.blacklist_input')}" rows="4" style="flex:1">${(rouletteSettings.blacklistTasks || []).join('\n')}</textarea>
            </div>
            <div class="setting-item">
                <label></label>
                <button onclick="saveBlacklist()" class="cyber-btn add-btn">${t('settings.blacklist_save')}</button>
            </div>
        </div>
    </div>`;
}

function renderStreamerSettings() {
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">${t('settings.streamer_title')}</span><span class="section-badge">LIVE</span></h3>
        <div class="settings-group">
            ${toggleItem('showPlayerOnWheel', t('settings.player_on_wheel'), rouletteSettings.showPlayerOnWheel)}
            ${toggleItem('chromaKey', t('settings.chroma_key'), rouletteSettings.chromaKey)}
            <div class="setting-item">
                <label>${t('settings.overlay_pos')}</label>
                <select onchange="updateSetting('overlayPosition',this.value)" style="flex:1;max-width:220px">
                    <option value="top-left"     ${rouletteSettings.overlayPosition === 'top-left' ? 'selected' : ''}>${t('settings.pos_top_left')}</option>
                    <option value="top-right"    ${rouletteSettings.overlayPosition === 'top-right' ? 'selected' : ''}>${t('settings.pos_top_right')}</option>
                    <option value="bottom-left"  ${rouletteSettings.overlayPosition === 'bottom-left' ? 'selected' : ''}>${t('settings.pos_bot_left')}</option>
                    <option value="bottom-right" ${rouletteSettings.overlayPosition === 'bottom-right' ? 'selected' : ''}>${t('settings.pos_bot_right')}</option>
                    <option value="center"       ${rouletteSettings.overlayPosition === 'center' ? 'selected' : ''}>${t('settings.pos_center')}</option>
                </select>
            </div>
        </div>
    </div>`;
}

function renderThemeSettings() {
    const themes = [
        { id: 'dark', icon: '🌑', nameKey: 'settings.theme_dark' },
        { id: 'neon', icon: '💜', nameKey: 'settings.theme_neon' },
        { id: 'cyber', icon: '🔵', nameKey: 'settings.theme_cyber' },
        { id: 'streamer', icon: '📡', nameKey: 'settings.theme_streamer' },
        { id: 'pastel', icon: '🌸', nameKey: 'settings.theme_pastel' },
    ];
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">${t('settings.theme_title')}</span></h3>
        <div class="color-schemes">
            ${themes.map(th => `<div class="color-scheme-card ${currentTheme === th.id ? 'active' : ''}" onclick="applyTheme('${th.id}');document.querySelectorAll('.color-scheme-card').forEach(c=>c.classList.remove('active'));this.classList.add('active')">
                <div style="font-size:28px;margin-bottom:6px">${th.icon}</div>
                <div class="color-scheme-name">${t(th.nameKey)}</div>
            </div>`).join('')}
        </div>
        <p style="font-size:11px;color:var(--text-muted);margin-top:12px">${t('settings.theme_hint')}</p>
    </div>`;
}

// Settings helpers
function rangeItem(key, label, val, min, max, step, id, fmt) {
    const display = fmt ? fmt(val) : val;
    return `<div class="setting-item">
        <label>${label}</label>
        <div class="range-container">
            <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" oninput="updateSetting('${key}',this.value)">
            <span class="range-value" id="rv_${id}">${display}</span>
        </div>
    </div>`;
}
function toggleItem(key, label, val) {
    return `<div class="setting-item toggle-item">
        <label>${label}</label>
        <label class="toggle-switch"><input type="checkbox" ${val ? 'checked' : ''} onchange="updateSetting('${key}',this.checked)"><span class="toggle-slider"></span></label>
    </div>`;
}

function updateSetting(key, value) {
    const prev = rouletteSettings[key];
    if (typeof prev === 'number') value = Number(value);
    if (typeof prev === 'boolean') value = Boolean(value);
    // soundVolume: слайдер 0–100, хранится 0–1
    if (key === 'soundVolume') value = value / 100;
    rouletteSettings[key] = value; saveSettings();
    const el = document.getElementById(key);
    if (el && el.type === 'range') {
        const rv = document.getElementById('rv_' + key) || el.parentElement?.querySelector('.range-value');
        if (rv) {
            if (key === 'spinDuration' || key === 'popupDuration') rv.textContent = value / 1000 + 'с';
            else if (key === 'soundVolume') rv.textContent = Math.round(value * 100) + '%';
            else if (key === 'wheelSize' || key === 'fontSize') rv.textContent = value + 'px';
            else if (key === 'bonusRoundChance') rv.textContent = value + '%';
            else if (key === 'announceDelay') rv.textContent = value + 'мс';
            else rv.textContent = value;
        }
    }
    if (key === 'wheelSize') {
        const cv = document.getElementById('rouletteWheel');
        if (cv) { cv.width = Number(value); cv.height = Number(value); renderWheel() }
    }
}
function saveBlacklist() {
    const inp = document.getElementById('blacklistInput');
    if (!inp) return;
    rouletteSettings.blacklistTasks = inp.value.split('\n').map(tk => tk.trim()).filter(tk => tk);
    saveSettings(); showNotification(t('settings.blacklist_saved', { n: rouletteSettings.blacklistTasks.length }), 'success');
}
function applySettings() { saveSettings(); updateWheelSegments(); renderWheel(); showNotification(t('settings.applied'), 'success') }
function resetSettings() {
    showConfirmModal(t('settings.reset_confirm'), t('settings.reset_msg'), t('common.reset'), t('common.cancel'), () => {
        rouletteSettings = { spinDuration: 5000, minSpins: 5, maxSpins: 10, soundEnabled: true, soundVolume: 0.5, tickSoundEnabled: true, winSoundEnabled: true, spinSoundType: 'whoosh', visualEffects: true, highlightWinner: true, shakeEffect: true, glowEffect: true, particleEffect: true, particleCount: 30, particleStyle: 'circle', wheelSize: 420, fontSize: 12, groupSegments: true, maxSegments: 14, colorScheme: 'default', borderStyle: 'glow', centerIcon: '🎲', pointerStyle: 'arrow', wheelAnimation: 'ease', resultDisplay: 'both', autoClosePopup: true, popupDuration: 6000, showPlayerOnWheel: false, announceDelay: 0, overlayPosition: 'top-left', chromaKey: false, bonusRoundEnabled: false, bonusRoundChance: 10, weightedSegments: false, blacklistEnabled: false, blacklistTasks: [], removeAfterSpin: false };
        saveSettings(); switchTab('settings'); showNotification(t('settings.reset_done'), 'success');
    });
}
function exportSettings() {
    const blob = new Blob([JSON.stringify(rouletteSettings, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'roulette-settings.json'; a.click();
    showNotification(t('settings.exported'), 'success');
}
function importSettings() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = ev => {
            try {
                const d = JSON.parse(ev.target.result);
                rouletteSettings = { ...rouletteSettings, ...d };
                saveSettings(); switchTab('settings');
                showNotification(t('settings.imported'), 'success');
            } catch { showNotification(t('settings.import_error'), 'error') }
        };
        r.readAsText(f);
    };
    inp.click();
}

// ── SOUND ENGINE ──────────────────────────────────────────
function initAudio() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)() } catch (e) { } } }

function playSpinSound() {
    if (!rouletteSettings.soundEnabled) return;
    try {
        initAudio(); if (!audioCtx) return;
        const type = rouletteSettings.spinSoundType || 'whoosh';
        if (type === 'casino') { playCasinoSpinSound(); return }
        if (type === 'drum') { playDrumSpinSound(); return }
        // whoosh
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sawtooth'; filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, audioCtx.currentTime); filter.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 2.5);
        osc.frequency.setValueAtTime(500, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 2.5);
        gain.gain.setValueAtTime(0.06 * rouletteSettings.soundVolume, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.5);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 2.5);
    } catch (e) { }
}
function playCasinoSpinSound() {
    try {
        initAudio(); if (!audioCtx) return;
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(audioCtx.destination);
                o.type = 'triangle'; o.frequency.setValueAtTime(300 + i * 100, audioCtx.currentTime);
                g.gain.setValueAtTime(0.07 * rouletteSettings.soundVolume, audioCtx.currentTime); g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
                o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime + 0.3);
            }, i * 80);
        }
    } catch (e) { }
}
function playDrumSpinSound() {
    try {
        initAudio(); if (!audioCtx) return;
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.3, audioCtx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.05));
        const src = audioCtx.createBufferSource(), g = audioCtx.createGain();
        src.buffer = buf; src.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.3 * rouletteSettings.soundVolume, audioCtx.currentTime);
        src.start(audioCtx.currentTime);
    } catch (e) { }
}
function playTickSound() {
    if (!rouletteSettings.soundEnabled || !rouletteSettings.tickSoundEnabled) return;
    try {
        initAudio(); if (!audioCtx) return;
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.type = 'sine'; o.frequency.setValueAtTime(900, audioCtx.currentTime); o.frequency.linearRampToValueAtTime(250, audioCtx.currentTime + 0.07);
        g.gain.setValueAtTime(0.07 * rouletteSettings.soundVolume, audioCtx.currentTime); g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime + 0.1);
    } catch (e) { }
}
function playWinSound() {
    if (!rouletteSettings.soundEnabled || !rouletteSettings.winSoundEnabled) return;
    try {
        initAudio(); if (!audioCtx) return;
        const notes = [{ f: 523, d: 0.15, t: 0 }, { f: 659, d: 0.15, t: 0.15 }, { f: 784, d: 0.15, t: 0.3 }, { f: 1047, d: 0.5, t: 0.45 }];
        notes.forEach(({ f, d, t }) => {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain(), fl = audioCtx.createBiquadFilter();
            o.connect(fl); fl.connect(g); g.connect(audioCtx.destination);
            fl.type = 'lowpass'; fl.frequency.setValueAtTime(2000, audioCtx.currentTime + t);
            o.type = 'triangle'; o.frequency.setValueAtTime(f, audioCtx.currentTime + t);
            g.gain.setValueAtTime(0, audioCtx.currentTime + t); g.gain.linearRampToValueAtTime(0.12 * rouletteSettings.soundVolume, audioCtx.currentTime + t + 0.02); g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + t + d);
            o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + d + 0.1);
        });
    } catch (e) { }
}

// ── NOTIFICATIONS ─────────────────────────────────────────
function showNotification(msg, type = 'info') {
    const c = document.getElementById('notifications'); if (!c) return;
    const n = document.createElement('div');
    n.className = `notification notification-${type}`; n.textContent = msg;
    c.appendChild(n);
    setTimeout(() => { n.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => n.remove(), 300) }, 3200);
}

// ── EXPORT / IMPORT ───────────────────────────────────────
function exportData() {
    const data = { players, games, rouletteMode, rouletteSettings, currentTheme, exportDate: new Date().toISOString(), version: '3.0' };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `challenge-hub-v3-${Date.now()}.json`; a.click();
    showNotification('📤 ' + t('common.export'), 'success');
}
function importData() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = ev => {
            try {
                const d = JSON.parse(ev.target.result);
                if (!d || typeof d !== 'object' || Array.isArray(d)) {
                    return showNotification(t('common.error'), 'error');
                }
                if (!d.players || !d.games ||
                    !Array.isArray(d.players) ||
                    typeof d.games !== 'object' || Array.isArray(d.games)) {
                    return showNotification(t('common.error'), 'error');
                }
                const safeColors = Object.keys(playerColors);
                players = d.players
                    .filter(p => p && typeof p.name === 'string' && p.name.trim())
                    .map(p => ({
                        name: String(p.name).trim().slice(0, 100),
                        color: safeColors.includes(p.color) ? p.color : 'indigo',
                        stats: {
                            gamesPlayed: Number(p.stats?.gamesPlayed) || 0,
                            tasksCompleted: Number(p.stats?.tasksCompleted) || 0,
                        }
                    }));
                games = {};
                Object.entries(d.games).forEach(([gameName, tasks]) => {
                    if (typeof gameName !== 'string' || !gameName.trim()) return;
                    if (gameName === '__proto__' || gameName === 'constructor') return;
                    if (!Array.isArray(tasks)) return;
                    games[gameName.trim().slice(0, 200)] = [...new Set(
                        tasks
                            .filter(tk => typeof tk === 'string' && tk.trim())
                            .map(tk => String(tk).trim().slice(0, 500))
                    )];
                });
                // Режим и тема — только допустимые значения
                const safeModes = ['full', 'game-first', 'player-only', 'task-only'];
                if (d.rouletteMode && safeModes.includes(d.rouletteMode)) {
                    rouletteMode = d.rouletteMode;
                }
                if (d.rouletteSettings && typeof d.rouletteSettings === 'object') {
                    rouletteSettings = { ...rouletteSettings, ...d.rouletteSettings };
                }
                const safeThemes = ['dark', 'neon', 'cyber', 'streamer', 'pastel'];
                if (d.currentTheme && safeThemes.includes(d.currentTheme)) {
                    applyTheme(d.currentTheme);
                }
                saveAll(); saveSettings(); switchTab(currentTab);
                showNotification(t('settings.imported'), 'success');
            } catch { showNotification(t('settings.import_error'), 'error') }
        };
        r.readAsText(f);
    };
    inp.click();
}
function exportResults() {
    if (!gameFirstState.selectedGame) { showNotification(t('notif.results_none'), 'warning'); return }
    let text = `🎮 RANDOM CHALLENGE HUB v3.0\n${'─'.repeat(40)}\n${t('roulette.selected_game')}: ${gameFirstState.selectedGame}\n${new Date().toLocaleString()}\n${'─'.repeat(40)}\n📋 ${t('roulette.result_task').toUpperCase()}:\n`;
    Object.entries(gameFirstState.assignedTasks).forEach(([p, task], i) => { text += `${i + 1}. ${p} → ${task}\n` });
    text += `${'─'.repeat(40)}\n${Object.keys(gameFirstState.assignedTasks).length} / ${players.length}\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = `results-${gameFirstState.selectedGame}-${Date.now()}.txt`; a.click();
    showNotification(t('notif.export_results'), 'success');
}

// ── SCROLL HELPER ─────────────────────────────────────────
function scrollToTabs() {
    document.getElementById('mainPanel')?.scrollIntoView({ behavior: 'smooth' });
}

// ── DEFAULT GAMES DATA ────────────────────────────────────

// ── GAMING TIPS & FACTS ───────────────────────────────────
// Tips are stored in translation files under the 'tips' key.
// This getter merges them at runtime so switching language updates tips immediately.
function getGamingTips() {
    const raw = (typeof t === 'function') ? t('tips') : null;
    if (Array.isArray(raw) && raw.length) return raw;
    // Fallback: return empty array — renderTipsList handles empty gracefully
    return [];
}
// Proxy so existing code using GAMING_TIPS still works
const GAMING_TIPS = new Proxy([], {
    get(_, prop) {
        const tips = getGamingTips();
        if (prop === 'length') return tips.length;
        if (prop === 'filter') return fn => tips.filter(fn);
        if (prop === 'map') return fn => tips.map(fn);
        if (prop === 'forEach') return fn => tips.forEach(fn);
        if (prop === Symbol.iterator) return () => tips[Symbol.iterator]();
        const idx = Number(prop);
        return isNaN(idx) ? tips[prop] : tips[idx];
    }
});

// Возвращает совет дня (детерминированно по дате) или случайный
function getDailyTip(category) {
    const pool = category ? GAMING_TIPS.filter(t => t.cat === category) : GAMING_TIPS;
    if (!pool.length) return GAMING_TIPS[0];
    const dayIndex = Math.floor(Date.now() / 86400000); // меняется каждый день
    return pool[dayIndex % pool.length];
}

// ── DEFAULT GAMES DATA ────────────────────────────────────
function getDefaultGames() {
    return {
        "Minecraft": [

            "Построй самый уродливый дом и защищай его как замок",
            "Играй без оружия одну ночь",
            "Укради один блок из дома друга и замени другим",
            "10 минут используй только деревянные инструменты",
            "Играй как деревенский житель",
            "Построй памятник самому бесполезному предмету",
            "Сделай секретную ловушку возле базы друга",
            "Найди алмаз, но сначала спроси разрешение",
            "Построй ферму, которая выглядит как мем",
            "Сделай музей своих ошибок",
            "Засели дом только котами",
            "Построй копию дома друга, но специально плохо",
            "Проведи экскурсию по базе голосом ведущего ТВ",
            "Выживи ночь без брони",
            "Не бегай 10 минут, только ходи",
            "Добывай ресурсы только лопатой",
            "Построй тайную базу рядом с другом",
            "Сделай другу сундук с бесполезным подарком",
            "Назови всех мобов смешными именами",
            "Построй дом только из одного типа блока",
            "Проведи день без крафта",
            "Построй трон для самого слабого моба",
            "Сделай огромную статую себя",
            "Поставь кровать в максимально опасном месте",
            "Построй портал в странном месте",
            "Помоги другому игроку 15 минут",
            "Сделай ферму в форме лица",
            "Построй секретную комнату и спрячь вход",
            "Играй 20 минут только ночью",
            "Сделай бесполезный механизм из редстоуна",
            "Построй дом на дереве",
            "Используй только найденные предметы",
            "Построй базу под землёй",
            "Сделай ловушку для друга без урона",
            "Стань фермером на 20 минут",
            "Укрась базу максимально странно",
            "Построй мини-деревню из своих домов",
            "Следующие 10 минут нельзя открывать инвентарь",
            "Сделай самый маленький дом",
            "Сделай самый высокий дом",
            "Проведи экскурсию по миру как блогер",
            "Построй памятник проигравшему игроку",
            "Играй только ночью",
            "Сделай секретный склад ресурсов",
            "Построй базу из случайных блоков"


        ],


        "CS2": [

            "Беги через мид первым",
            "Играй только с Desert Eagle",
            "Давай команде странные приказы",
            "После смерти комментируй игру как киберспортсмен",
            "Прыгай перед каждым контактом",
            "Купи AWP, но используй только нож",
            "Каждый раунд иди первым",
            "Играй как настоящий бот",
            "Кидай смешные флешки",
            "После убийства делай победную речь",
            "Первый раунд только нож",
            "Покупай самое странное оружие",
            "Каждый раунд говори фейковый план",
            "Перед выходом кричи «Я легенда»",
            "Играй раунд без брони",
            "После смерти анализируй свою ошибку",
            "Каждый раунд проверяй мид",
            "Используй только пистолет",
            "Не бери оружие врага",
            "Играй с неудобным сенсом",
            "Каждый килл сопровождай смешным звуком",
            "Придумай название каждой атаке",
            "После каждого раунда говори мотивацию",
            "Играй как новичок специально",
            "Попроси тиммейтов руководить тобой",
            "Сделай вид что ты тренер",
            "Каждый раунд выбрасывай оружие перед смертью",
            "Иди в самое опасное место карты",
            "Попробуй выиграть ножом",
            "Сделай красивый фраг",
            "Играй только с SMG",
            "Используй только дробовик",
            "Каждый раунд первым открывай дверь",
            "Перед атакой говори боевой клич",
            "Покупай оружие только после команды",
            "Не используй гранаты",
            "Используй только одну гранату за раунд",
            "Играй без звука",
            "Следи только за одним тиммейтом",
            "После каждого килла делай отчёт",
            "Поменяй стиль игры полностью",
            "Сыграй раунд максимально осторожно",
            "Сделай вид что карта новая",
            "Играй агрессивнее всех",
            "Попытайся стать MVP"


        ],


        "Apex": [

            "Прыгай в самое горячее место",
            "Используй первое найденное оружие",
            "Играй максимально агрессивно",
            "Используй дробовик",
            "Будь телохранителем тиммейта",
            "Каждый файт начинай с гранаты",
            "Не бери любимое оружие",
            "Комментируй игру как тренер",
            "Стань главным героем отряда",
            "Сделай красивую смерть",
            "Играй легендой, которой никогда не играл",
            "Не бери броню первые 5 минут",
            "Лутай только первые предметы",
            "После убийства делай речь победителя",
            "Всегда иди первым",
            "Будь главным медиком команды",
            "Охраняй одного игрока всю игру",
            "Используй только одно оружие",
            "Не используй ультимейт 10 минут",
            "Прыгай только за врагами",
            "Играй максимально рискованно",
            "После нокаута врага делай комментарий",
            "Используй только ближний бой",
            "Не бери золотой лут",
            "Каждый бой начинай с прыжка",
            "Играй как стример",
            "Делай вид что ты капитан",
            "Следуй только за одним игроком",
            "Победи максимально красиво",
            "Умри эффектно если проигрываешь",
            "Используй легенду случайно",
            "Не используй аптечки 5 минут",
            "Играй только с оружием врага",
            "Не бери щиты",
            "Каждую минуту меняй позицию",
            "Прыгай с высокой точки перед боем",
            "Стань разведчиком команды",
            "Играй максимально тихо",
            "Сделай засаду врагам",
            "Используй только дальнее оружие",
            "Не бери патроны больше одного типа",
            "Каждый бой начинай с эмоции",
            "После смерти дай анализ",
            "Играй без привычной тактики",
            "Сделай эпичную победу"
        ],

        "Valorant": [

            "Играй только с классическим пистолетом",
            "Каждый раунд говори название операции",
            "Используй способности максимально странно",
            "Иди первым на точку",
            "Играй агента которого не знаешь",
            "После каждого килла делай победную речь"

        ],


        "Marvel Rivals": [

            "Играй героем которого никогда не выбирал",
            "Каждый ульт объявляй как настоящий супергерой",
            "Спаси самого слабого игрока команды",
            "Прыгай первым в толпу врагов",
            "После каждого красивого момента кричи имя героя",
            "Играй без своей любимой способности"

        ],


        "Fortnite": [

            "Приземлись туда, где больше всего врагов",
            "Используй только первое найденное оружие",
            "Построй максимально бесполезную базу",
            "Сделай рискованный пуш на врагов",
            "Играй без любимого оружия",
            "Победи используя максимально странную тактику"

        ],


        "League of Legends": [

            "Играй чемпионом которого почти не знаешь",
            "Иди на необычную линию",
            "Собери странный билд",
            "После каждого убийства делай мини-речь",
            "Играй максимально агрессивно",
            "Помоги союзнику сделать красивый момент"

        ],


        "Dota 2": [

            "Играй героем которого никогда не выбираешь",
            "Собери максимально странные предметы",
            "Поменяй привычный стиль игры",
            "Каждые 5 минут делай смешной отчёт",
            "Играй только через рискованные действия",
            "Сделай самый необычный билд"

        ],


        "Overwatch 2": [

            "Играй персонажем которого не умеешь",
            "Каждый ульт объявляй как супергерой",
            "Защищай одного выбранного тиммейта",
            "Играй ролью которую обычно не выбираешь",
            "После смерти объясняй свою ошибку",
            "Попробуй сделать самый красивый момент игры"

        ],


        "Rainbow Six Siege": [

            "Первым открывай каждую дверь",
            "Используй гаджеты максимально странно",
            "Играй только с пистолетом",
            "Сделай неожиданный заход на точку",
            "Каждый раунд меняй стиль игры",
            "Комментируй действия как спецназовец"

        ],


        "Rocket League": [

            "Играй только через красивые удары",
            "Минуту не используй ускорение",
            "Играй роль вратаря",
            "После каждого гола делай победную речь",
            "Прыгай перед каждым ударом",
            "Попытайся забить самый нелепый гол"

        ],


        "PUBG": [

            "Приземлись рядом с самым большим количеством игроков",
            "Используй только первое найденное оружие",
            "Первые 5 минут без брони",
            "Играй максимально скрытно",
            "Сделай самый рискованный выход из зоны",
            "Попробуй победить без убийств"

        ],


        "The Finals": [

            "Разруши всё что можешь",
            "Играй только ближним оружием",
            "Сделай самый безумный заход",
            "Используй гаджеты постоянно",
            "Будь приманкой команды",
            "После смерти объясни свой великий план"

        ],


        "Dead by Daylight": [

            "Играй убийцей которого не знаешь",
            "Сделай максимально странный билд",
            "Пугай игроков вместо победы",
            "Играй максимально рискованно",
            "Используй только один навык",
            "После игры расскажи историю матча"

        ],


        "Rust": [

            "Построй максимально странную базу",
            "Поздоровайся с первым врагом",
            "Сделай ловушку для игроков",
            "Начни войну с ближайшим соседом",
            "Укрась базу максимально глупо",
            "Выживи день без оружия"

        ],


        "Escape from Tarkov": [

            "Иди в самый опасный район",
            "Возьми самое странное оружие",
            "Играй максимально осторожно",
            "После каждого боя делай анализ",
            "Не используй любимую пушку",
            "Попробуй выиграть без убийств"

        ],


        "Helldivers 2": [

            "Перед миссией кричи боевой приказ",
            "Спаси случайного союзника",
            "Используй стратагемы хаотично",
            "Беги первым в толпу врагов",
            "Сделай самый героический момент",
            "После миссии расскажи легенду своего отряда"

        ],


        "Warzone": [

            "Прыгни в самое горячее место",
            "Используй только найденное первое оружие",
            "Иди первым в каждый бой",
            "Проведи игру как командир",
            "Сделай максимально рискованный пуш",
            "Победи с самым странным оружием"

        ],


        "Teamfight Tactics": [

            "Собери максимально странную комбинацию",
            "Играй только через один класс",
            "Не покупай привычных чемпионов",
            "Сделай ставку на слабых героев",
            "Каждый раунд объясняй свою стратегию",
            "Попробуй выиграть необычным билдом"

        ],


        "World of Warcraft": [

            "Играй только необычным классом",
            "Сделай странный внешний вид персонажа",
            "Помоги случайному игроку",
            "Исследуй место где никогда не был",
            "Собери максимально смешной комплект",
            "Проведи время как обычный житель Азерота"

        ],


        "Diablo IV": [

            "Используй только странные навыки",
            "Собери необычный билд",
            "Иди в самое опасное место",
            "Не используй любимую способность",
            "Сражайся максимально красиво",
            "После победы сделай речь героя"

        ],
    };
}

// ── START ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);