// ============================================================
// RANDOM CHALLENGE HUB — MASTER SCRIPT v3.0
// Features: 5 themes, advanced wheel, streamer mode, OBS overlay,
//           chat vote, viewer wheel, timer, quick commands
// ============================================================

// ── GLOBAL STATE ──────────────────────────────────────────
let players = JSON.parse(localStorage.getItem('challengePlayers')) || [];
let games   = {}; // инициализируется в init() — нормализация там

let currentTab  = 'games';
let spinning    = false;
let wheelSegments  = [];
let currentWheelAngle = 0;
let animationId    = null;
let rouletteMode   = 'full';
let openDropdowns  = {};
let modalCallback  = null;
let audioCtx       = null;
let currentTheme   = localStorage.getItem('appTheme') || 'dark';
let settingsSubTab = 'speed';

// Streamer state
let streamerState = {
    timerInterval: null,
    timerSeconds:  0,
    timerRunning:  false,
    timerInitial:  0,
    chatMessages:  [],
    voteActive:    false,
    voteOptions:   [],
    voteVotes:     {},
    voteDuration:  30,
    voteTimer:     0,
    voteInterval:  null,
    voteTitle:     '',   // тема/название голосования
    subWheelList:  [],
    channelName:   '',
    connected:     false,
    twitchWs:      null,    // реальный WebSocket к Twitch IRC
    twitchStatus:  'idle',  // idle | connecting | connected | error
// УДАЛЕНО: OAuth токен для отправки сообщений
    overlayOpen:   false,
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
    showNotification(`🔌 Подключение к #${ch}...`, 'info');

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
        // PING/PONG для keepalive
        if (raw.startsWith('PING')) { ws.send('PONG :tmi.twitch.tv'); return; }
        // Определяем тип сообщения
        if (raw.includes('PRIVMSG')) {
            _parseTwitchMsg(raw);
        }
        if (raw.includes(`JOIN #${ch}`) && streamerState.twitchStatus !== 'connected') {
            streamerState.twitchStatus = 'connected';
            streamerState.connected    = true;
            _updateConnectBtn();
            showNotification(`✅ Подключён к #${ch} (только чтение)`, 'success');
            saveStreamerData();
            updateOverlayChatData();
        }
    };

    ws.onerror = () => {
        streamerState.twitchStatus = 'error';
        streamerState.connected    = false;
        _updateConnectBtn();
        showNotification('❌ Ошибка подключения к Twitch', 'error');
        updateOverlayChatData();
    };

    ws.onclose = () => {
        if (streamerState.twitchStatus !== 'idle') {
            streamerState.twitchStatus = 'idle';
            streamerState.connected    = false;
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
    streamerState.connected    = false;
    _updateConnectBtn();
    showNotification('Отключено от Twitch', 'info');
    updateOverlayChatData();
}

// Отправка сообщений в чат недоступна без авторизации
function sendTwitchChatMessage(text) { return false; }

function _parseTwitchMsg(raw) {
    // Формат: @tags :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
    const tagsPart  = raw.startsWith('@') ? raw.slice(1, raw.indexOf(' ')) : '';
    const rest      = raw.startsWith('@') ? raw.slice(raw.indexOf(' ') + 1) : raw;
    const userMatch = rest.match(/^:(\w+)!/);
    const msgMatch  = rest.match(/PRIVMSG #\S+ :(.+)/s);
    if (!userMatch || !msgMatch) return;

    const user = userMatch[1];
    const text = msgMatch[1].replace(/\r?\n$/, '').trim();

    // Разбираем теги (цвет, badges)
    const tags   = {};
    tagsPart.split(';').forEach(t => { const [k,v] = t.split('='); if (k) tags[k] = v || '' });
    const color  = tags['color'] || _randomChatColor(user);
    const isSub  = tags['subscriber'] === '1';
    const isMod  = tags['mod'] === '1';
    const isBroad = tags['badges'] && tags['badges'].includes('broadcaster');
    const badge  = isBroad ? 'broadcaster' : isMod ? 'mod' : isSub ? 'sub' : '';

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
        if (currentTab === 'streamer') {
            switchTab('streamer');
        }
        showNotification(`💜 Добавлено ${added} участников из чата в колесо`, 'success');
    } else {
        showNotification('Все активные участники чата уже в колесе', 'info');
    }
}

function addSubToWheelFromChat(user) {
    if (!streamerState.subWheelList.includes(user)) {
        streamerState.subWheelList.push(user);
        saveStreamerData();
        
        // Обновляем UI если открыта вкладка стримера
        if (currentTab === 'streamer') {
            switchTab('streamer');
        }
        
        showNotification(`💜 ${user} добавлен в колесо подписчиков`, 'success');
    } else {
        showNotification(`${user} уже в колесе подписчиков`, 'info');
    }
}

function setTimerFromChat(minutes) {
    streamerState.timerSeconds = minutes * 60;
    streamerState.timerInitial = streamerState.timerSeconds;
    updateTimerDisplay();
    const message = `⏱️ Таймер установлен на ${minutes} минут`;
    showNotification(message, 'info');
}

// Новые функции для инструментов стрима
function toggleChatSounds(enabled) {
    streamerState.chatSounds = enabled;
    saveStreamerData();
    showNotification(`🔊 Звуки чата ${enabled ? 'включены' : 'выключены'}`, 'info');
}

function toggleAutoSpin(enabled) {
    streamerState.autoSpin = enabled;
    saveStreamerData();
    showNotification(`🎰 Авто-спин ${enabled ? 'включён' : 'выключен'}`, 'info');
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
    } catch(e) {}
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
        document.getElementById('modalTitle').textContent = '📊 Статистика стрима';
        document.getElementById('modalMessage').innerHTML = `
            <div style="text-align:left;font-size:13px;line-height:1.6">
                <div style="margin-bottom:12px"><strong>📺 Сессия:</strong> ${duration} минут</div>
                <div style="margin-bottom:12px"><strong>💬 Сообщений:</strong> ${totalMessages}</div>
                <div style="margin-bottom:12px"><strong>👥 Уникальных зрителей:</strong> ${uniqueViewers}</div>
                <div style="margin-bottom:12px"><strong>🔥 Самый активный:</strong> ${mostActive || 'нет данных'}</div>
                <div style="margin-bottom:12px"><strong>🎯 В колесе:</strong> ${streamerState.subWheelList.length} участников</div>
                <div style="margin-bottom:12px"><strong>💜 Доступно из чата:</strong> ${participants.length} активных</div>
                ${streamerState.voteActive ? '<div style="color:var(--accent-warning)">🗳️ Голосование активно</div>' : ''}
            </div>
        `;
        document.getElementById('modalConfirm').textContent = 'ЗАКРЫТЬ';
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
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stream-data-${streamerState.channelName}-${Date.now()}.json`;
    a.click();
    
    showNotification('📤 Данные стрима экспортированы', 'success');
}

function resetStreamSession() {
    showConfirmModal('🔄 Сброс сессии', 'Сбросить данные текущей сессии стрима?', 'СБРОСИТЬ', 'ОТМЕНА', () => {
        streamerState.chatMessages = [];
        streamerState.chatStats = { totalMessages: 0, uniqueViewers: 0, mostActiveUser: '' };
        streamerState.userActivity = {};
        streamerState.chatUserPool = new Set();
        streamerState.sessionStartTime = Date.now();
        
        saveStreamerData();
        
        if (currentTab === 'streamer') {
            switchTab('streamer');
        }
        
        showNotification('🔄 Сессия сброшена', 'success');
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
    const palette = ['#818cf8','#34d399','#fbbf24','#f472b6','#67e8f9','#a3e635','#fb923c','#e879f9'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}

function _renderOneChatMsg(m) {
    const badgeHtml = m.badge ? `<span class="chat-badge">${m.badge}</span>` : '';
    return `<div class="chat-msg"><span class="chat-user" style="color:${m.color}">${badgeHtml}${m.user}</span><span class="chat-text">: ${m.text}</span></div>`;
}

function _updateConnectBtn() {
    const btn = document.getElementById('chatConnectBtn');
    if (!btn) return;
    const s = streamerState.twitchStatus;
    btn.textContent = s === 'connected'   ? '✅ Отключиться'
                    : s === 'connecting'  ? '⏳ Подключение...'
                    : s === 'error'       ? '❌ Ошибка — retry'
                    :                       '🔌 Подключить';
    btn.className = `cyber-btn channel-connect-btn ${s === 'connected' ? 'danger-btn' : 'add-btn'}`;
    btn.disabled = s === 'connecting';
    
    // Обновляем состояние других кнопок
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
            ? `<span style="display:inline-flex;align-items:center;gap:5px"><span class="overlay-dot"></span> Читаем чат #${streamerState.channelName}</span>`
            : streamerState.twitchStatus === 'connecting' ? '⏳ Подключение к Twitch IRC...'
            : streamerState.twitchStatus === 'error' ? '❌ Не удалось подключиться'
            : 'Введите ник канала и нажмите Подключить';
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
let rouletteSettings = JSON.parse(localStorage.getItem('rouletteSettings')) || {
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
    blacklistEnabled:  false,
    blacklistTasks:    [],
    weightedSegments:  false,
};

// ── COLOR SCHEMES ──────────────────────────────────────────
const COLOR_SCHEMES = {
    default:    ['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#06b6d4','#f97316','#84cc16','#a855f7','#14b8a6'],
    neon:       ['#ff00ff','#00ffff','#ff6600','#00ff00','#ff0000','#ffff00','#ff0099','#00ccff','#ff3300','#33ff00','#cc00ff','#00ffcc'],
    pastel:     ['#a78bfa','#67e8f9','#86efac','#fde68a','#fca5a5','#93c5fd','#f9a8d4','#5eead4','#fbbf24','#c084fc','#6ee7b7','#7dd3fc'],
    fire:       ['#ff4500','#ff6a00','#ff8c00','#ffb300','#ffd700','#ff2200','#cc3300','#ff7700','#ff5500','#ff9900','#ffcc00','#ff3300'],
    ocean:      ['#0077b6','#0096c7','#00b4d8','#48cae4','#90e0ef','#0077b6','#023e8a','#03045e','#0081a7','#00afb9','#0cb0a9','#006d77'],
    forest:     ['#2d6a4f','#40916c','#52b788','#74c69d','#95d5b2','#1b4332','#081c15','#d8f3dc','#b7e4c7','#52b788','#40916c','#2d6a4f'],
    gold:       ['#ffd700','#ffb800','#ffa500','#ff8c00','#e6960c','#c47a0e','#f5b700','#e09b1a','#d4a017','#c8960c','#b8860b','#a07800'],
    monochrome: ['#1a1a2e','#16213e','#0f3460','#533483','#e94560','#1f4068','#1b262c','#4a4a6a','#6a6a9a','#8a8abb','#aaaacc','#303050'],
    rainbow:    ['#ff0000','#ff7700','#ffff00','#00ff00','#0000ff','#8b00ff','#ff00ff','#00ffff','#ff6600','#33cc00','#0066ff','#cc00cc'],
    cyber:      ['#00d4ff','#7b2ff7','#e040fb','#00e676','#ff6d00','#448aff','#ff5252','#ffab40','#00bcd4','#69f0ae','#ea80fc','#ff4081'],
    twitch:     ['#9147ff','#bf94ff','#772ce8','#a970ff','#6441a5','#00e5b3','#ff6ec7','#ffb700','#4b367c','#d8a3ff','#b9a3e3','#6600cc'],
};

// ── PLAYER COLORS ──────────────────────────────────────────
const playerColors = {
    indigo:   { gradient: 'linear-gradient(135deg,#6366f1,#818cf8)', border: '#6366f1',  name: '#818cf8', label: 'Индиго'     },
    purple:   { gradient: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', border: '#8b5cf6',  name: '#a78bfa', label: 'Фиолетовый' },
    emerald:  { gradient: 'linear-gradient(135deg,#10b981,#34d399)', border: '#10b981',  name: '#34d399', label: 'Изумрудный' },
    amber:    { gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', border: '#f59e0b',  name: '#fbbf24', label: 'Янтарный'   },
    rose:     { gradient: 'linear-gradient(135deg,#ec4899,#f472b6)', border: '#ec4899',  name: '#f472b6', label: 'Розовый'    },
    cyan:     { gradient: 'linear-gradient(135deg,#06b6d4,#67e8f9)', border: '#06b6d4',  name: '#67e8f9', label: 'Циан'       },
    orange:   { gradient: 'linear-gradient(135deg,#f97316,#fb923c)', border: '#f97316',  name: '#fb923c', label: 'Оранжевый'  },
    lime:     { gradient: 'linear-gradient(135deg,#84cc16,#a3e635)', border: '#84cc16',  name: '#a3e635', label: 'Лайм'       },
    twitch:   { gradient: 'linear-gradient(135deg,#9147ff,#bf94ff)', border: '#9147ff',  name: '#bf94ff', label: 'Твич'       },
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
                const shouldReconnect = confirm(`Переподключиться к каналу #${streamerState.channelName}?`);
                if (shouldReconnect) {
                    twitchConnect(streamerState.channelName);
                }
            }
        }, 1500); // Увеличили задержку для полной загрузки
    });

    // Загружаем и нормализуем данные игр
    const rawGames = JSON.parse(localStorage.getItem('challengeGames'));
    if (rawGames && typeof rawGames === 'object') {
        Object.entries(rawGames).forEach(([gameName, tasks]) => {
            if (!Array.isArray(tasks)) return;
            games[gameName] = tasks.map(t =>
                typeof t === 'string' ? t : (t && typeof t.task === 'string' ? t.task : String(t))
            ).filter(t => t && t.trim());
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
            <button class="floating-btn main-btn" onclick="toggleFloatingMenu()" title="Меню">⚙️</button>
            <div class="floating-menu hidden" id="floatingMenu">
                <button onclick="confirmClearCache()"  class="floating-menu-btn">🗑️ Сбросить кеш</button>
                <button onclick="confirmResetAll()"    class="floating-menu-btn">🔄 Сбросить всё</button>
                <button onclick="window.scrollTo({top:0,behavior:'smooth'})" class="floating-menu-btn">⬆️ Наверх</button>
                <button onclick="switchTab('settings')"  class="floating-menu-btn">⚙️ Настройки</button>
                <button onclick="switchTab('roulette')"  class="floating-menu-btn">🎰 Рулетка</button>
                <button onclick="switchTab('streamer')"  class="floating-menu-btn">📡 Стример</button>
                <button onclick="openOverlayWindow()"    class="floating-menu-btn">🖥️ OBS Overlay</button>
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
    document.getElementById('modalTitle').textContent   = title;
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
function saveAll()      { 
    localStorage.setItem('challengePlayers', JSON.stringify(players)); 
    localStorage.setItem('challengeGames', JSON.stringify(games));
    localStorage.setItem('taskOnlyState', JSON.stringify(taskOnlyState));
    localStorage.setItem('rouletteMode', rouletteMode);
}
function saveSettings() { localStorage.setItem('rouletteSettings', JSON.stringify(rouletteSettings)) }

function confirmClearCache() {
    document.getElementById('floatingMenu')?.classList.add('hidden');
    showConfirmModal('🗑️ Сброс кеша', 'Очистить кеш браузера? Данные вернутся к стандартным.', 'СБРОСИТЬ', 'ОТМЕНА', clearCache);
}
function clearCache() {
    localStorage.removeItem('challengePlayers'); localStorage.removeItem('challengeGames'); sessionStorage.clear();
    players = []; games = getDefaultGames();
    gameFirstState = { active:false, selectedGame:null, currentPlayerIndex:0, assignedTasks:{} };
    saveAll(); updateWheelSegments(); switchTab('games');
    showNotification('✅ Кеш очищен!', 'success');
}
function confirmResetAll() {
    document.getElementById('floatingMenu')?.classList.add('hidden');
    showConfirmModal('🔄 Полный сброс', 'Удалить ВСЕ данные? Восстановить невозможно.', 'СБРОСИТЬ ВСЁ', 'ОТМЕНА', resetAllData);
}
function resetAllData() {
    players = []; games = {};
    localStorage.removeItem('challengePlayers'); localStorage.removeItem('challengeGames'); sessionStorage.clear();
    gameFirstState = { active:false, selectedGame:null, currentPlayerIndex:0, assignedTasks:{} };
    updateWheelSegments(); switchTab('games');
    showNotification('🔄 Все данные сброшены!', 'warning');
}

// ── TABS ──────────────────────────────────────────────────
function createTabs() {
    const mp = document.getElementById('mainPanel');
    if (!mp) return;
    mp.innerHTML = `
        <div class="cyber-tabs">
            <button class="cyber-tab active" data-tab="games"    onclick="switchTab('games')">   <span class="tab-icon">🎮</span> Игры</button>
            <button class="cyber-tab"        data-tab="players"  onclick="switchTab('players')"> <span class="tab-icon">👥</span> Игроки <span class="tab-badge" id="playersBadge">${players.length}</span></button>
            <button class="cyber-tab"        data-tab="roulette" onclick="switchTab('roulette')"><span class="tab-icon">🎰</span> Рулетка</button>
            <button class="cyber-tab"        data-tab="streamer" onclick="switchTab('streamer')"><span class="tab-icon">📡</span> Стример</button>
            <button class="cyber-tab"        data-tab="stats"    onclick="switchTab('stats')">   <span class="tab-icon">📊</span> Стат</button>
            <button class="cyber-tab"        data-tab="settings" onclick="switchTab('settings')"><span class="tab-icon">⚙️</span> Настройки</button>
        </div>
        <div class="tab-content" id="tabContent"></div>
    `;
    switchTab('games');
}

function switchTab(name) {
    currentTab = name;
    if (animationId && name !== 'roulette') { cancelAnimationFrame(animationId); animationId = null }
    if (name !== 'roulette') {
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
        games:    () => { content.innerHTML = renderGamesTab();    setTimeout(restoreDropdownState, 50) },
        players:  () => { content.innerHTML = renderPlayersTab()   },
        roulette: () => {
            content.innerHTML = renderRouletteTab();
            setTimeout(() => {
                gameFirstState.active && gameFirstState.selectedGame
                    ? updateWheelSegmentsForGame(gameFirstState.selectedGame)
                    : updateWheelSegments();
                renderWheel();
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
                        const shouldReconnect = confirm(`Переподключиться к каналу #${streamerState.channelName}?`);
                        if (shouldReconnect) {
                            twitchConnect(streamerState.channelName);
                        }
                    }, 500);
                }
            }, 100);
        },
        stats:    () => { content.innerHTML = renderStatsTab()     },
        settings: () => { content.innerHTML = renderSettingsTab()  },
    };
    (renders[name] || (() => {}))();
    content.style.animation = 'none';
    void content.offsetHeight;
    content.style.animation = 'fadeInUp 0.35s ease';
}

// ── DROPDOWN STATE ────────────────────────────────────────
function saveDropdownState() {
    openDropdowns = {};
    document.querySelectorAll('.tasks-dropdown').forEach(d => {
        const id = d.id.replace('dropdown_','');
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
    const sid = gameName.replace(/[^a-zA-Z0-9]/g,'_');
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
            <h3 class="section-title"><span class="neon-text">➕ ДОБАВИТЬ ИГРУ</span></h3>
            <div class="input-group">
                <input type="text" id="newGame" placeholder="Название игры..." class="cyber-input" onkeypress="if(event.key==='Enter')addGame()">
                <button onclick="addGame()" class="cyber-btn add-btn">+ Добавить</button>
            </div>
        </div>
        <div class="panel-section">
            <h3 class="section-title"><span class="neon-text">📋 ДОБАВИТЬ ЗАДАНИЕ</span></h3>
            <div class="input-group">
                <select id="gameList" class="cyber-select">${Object.keys(games).map(g=>`<option value="${g}">${g}</option>`).join('')}</select>
                <input type="text" id="newTask" placeholder="Описание задания..." class="cyber-input" onkeypress="if(event.key==='Enter')addTask()">
                <button onclick="addTask()" class="cyber-btn add-btn">+ Добавить</button>
            </div>
        </div>
        <div class="panel-section">
            <h3 class="section-title">
                <span class="neon-text">🎮 ИГРЫ И ЗАДАНИЯ</span>
                <span class="section-badge">${Object.keys(games).length} игр · ${Object.values(games).reduce((s,t)=>s+t.length,0)} заданий</span>
            </h3>
            <div id="gamesList" class="games-list">${renderGamesList()}</div>
        </div>
        <div class="panel-actions">
            <button onclick="exportData()" class="cyber-btn export-btn">📤 Экспорт</button>
            <button onclick="importData()" class="cyber-btn import-btn">📥 Импорт</button>
            <button onclick="showBulkAddModal()" class="cyber-btn primary-btn">📝 Массовое добавление</button>
        </div>
    </div>`;
}

function renderGamesList() {
    if (!Object.keys(games).length) return '<p class="empty-text">Нет добавленных игр. Добавьте первую игру!</p>';
    return Object.entries(games).map(([game, tasks]) => {
        const sid = game.replace(/[^a-zA-Z0-9]/g,'_');
        const esc = game.replace(/'/g,"\\'");
        return `<div class="game-card">
            <div class="game-header" onclick="toggleGameDropdown('${esc}')">
                <div class="game-header-left">
                    <span class="dropdown-arrow" id="arrow_${sid}">▶</span>
                    <h4 class="game-name">🎮 ${game}</h4>
                </div>
                <div class="game-header-right">
                    <span class="task-count">${tasks.length} зад.</span>
                    <button onclick="event.stopPropagation();deleteGame('${esc}')" class="delete-btn">🗑️</button>
                </div>
            </div>
            <div class="tasks-dropdown hidden" id="dropdown_${sid}">
                <div class="tasks-list">${tasks.map((t,i)=>`
                    <div class="task-item">
                        <span class="task-number">#${i+1}</span>
                        <span class="task-text">${t}</span>
                        <button onclick="deleteTask('${esc}',${i})" class="delete-task-btn" title="Удалить">×</button>
                    </div>`).join('')}
                </div>
                ${!tasks.length ? '<p class="empty-text">Нет заданий</p>' : ''}
                <div class="task-actions">
                    <div class="input-group">
                        <input type="text" id="quickTask_${sid}" placeholder="Быстрое задание..." class="cyber-input" onkeypress="if(event.key==='Enter')quickAddTask('${esc}')">
                        <button onclick="quickAddTask('${esc}')" class="cyber-btn add-btn">+ Добавить</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function addGame() {
    const inp = document.getElementById('newGame'); if (!inp) return;
    const name = inp.value.trim();
    if (!name) return showNotification('Введите название игры', 'error');
    if (games[name]) return showNotification('Такая игра уже существует', 'warning');
    games[name] = []; saveAll(); switchTab('games');
    showNotification(`🎮 Игра "${name}" добавлена`, 'success');
}
function addTask() {
    const gs = document.getElementById('gameList'), ti = document.getElementById('newTask');
    if (!gs || !ti) return;
    const game = gs.value, task = ti.value.trim();
    if (!task) return showNotification('Введите описание задания', 'error');
    if (!games[game]) return showNotification('Выберите игру', 'error');
    games[game].push(task); saveAll(); switchTab('games');
    showNotification('✅ Задание добавлено', 'success');
}
function quickAddTask(gameName) {
    const sid = gameName.replace(/[^a-zA-Z0-9]/g,'_');
    const inp = document.getElementById(`quickTask_${sid}`); if (!inp) return;
    const task = inp.value.trim();
    if (!task) return showNotification('Введите описание задания', 'error');
    if (!games[gameName]) return showNotification('Игра не найдена', 'error');
    games[gameName].push(task); saveAll(); inp.value = ''; openDropdowns[sid] = true;
    const c = document.getElementById('tabContent');
    if (c) { c.innerHTML = renderGamesTab(); setTimeout(restoreDropdownState, 50) }
    showNotification('✅ Задание добавлено', 'success');
}
function deleteGame(name) {
    showConfirmModal('🗑️ Удаление игры', `Удалить игру "${name}" и все её задания?`, 'УДАЛИТЬ', 'ОТМЕНА', () => {
        delete games[name]; saveAll(); switchTab('games');
        showNotification(`Игра "${name}" удалена`, 'warning');
    });
}
function deleteTask(gameName, idx) {
    const t = games[gameName]?.[idx];
    showConfirmModal('🗑️ Удаление задания', `Удалить задание "${t}"?`, 'УДАЛИТЬ', 'ОТМЕНА', () => {
        games[gameName].splice(idx, 1); saveAll(); switchTab('games');
        showNotification('Задание удалено', 'warning');
    });
}
function showBulkAddModal() {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;
    document.getElementById('modalTitle').textContent = '📝 Массовое добавление заданий';
    document.getElementById('modalMessage').innerHTML = `
        <div style="text-align:left">
            <select id="bulkGame" style="width:100%;margin-bottom:10px;padding:9px 12px;background:var(--bg-input);color:var(--text-primary);border:2px solid var(--border-light);border-radius:8px;font-size:13px">
                ${Object.keys(games).map(g=>`<option value="${g}">${g}</option>`).join('')}
            </select>
            <textarea id="bulkTasks" placeholder="Одно задание на строку..." style="width:100%;height:160px;padding:10px;background:var(--bg-input);color:var(--text-primary);border:2px solid var(--border-light);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical"></textarea>
            <p style="font-size:11px;color:var(--text-muted);margin-top:6px">Каждая строка — отдельное задание</p>
        </div>`;
    const btn = document.getElementById('modalConfirm');
    btn.textContent = 'ДОБАВИТЬ';
    btn.onclick = () => {
        const game = document.getElementById('bulkGame')?.value;
        const raw  = document.getElementById('bulkTasks')?.value || '';
        const tasks = raw.split('\n').map(t => t.trim()).filter(t => t.length > 0);
        if (game && tasks.length) {
            games[game].push(...tasks); saveAll(); closeModal(); switchTab('games');
            showNotification(`✅ Добавлено ${tasks.length} заданий для "${game}"`, 'success');
        } else { showNotification('Выберите игру и введите задания', 'error') }
    };
    const cancelBtn = modal.querySelector('.cancel-btn');
    if (cancelBtn) { cancelBtn.textContent = 'ОТМЕНА'; cancelBtn.onclick = closeModal }
    modal.classList.remove('hidden');
}

// ── PLAYERS TAB ───────────────────────────────────────────
function renderPlayersTab() {
    return `<div class="players-panel">
        <div class="panel-section">
            <h3 class="section-title"><span class="neon-text">➕ ДОБАВИТЬ ИГРОКА</span></h3>
            <div class="input-group">
                <input type="text" id="newPlayer" placeholder="Имя игрока..." class="cyber-input" onkeypress="if(event.key==='Enter')addPlayer()">
                <select id="playerColor" class="cyber-select">
                    ${Object.entries(playerColors).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
                </select>
                <button onclick="addPlayer()" class="cyber-btn add-btn">+ Добавить</button>
            </div>
        </div>
        <div class="panel-section">
            <h3 class="section-title">
                <span class="neon-text">👥 СПИСОК ИГРОКОВ</span>
                <span class="section-badge">${players.length} чел.</span>
            </h3>
            <div class="players-grid">
                ${players.length === 0 ? '<p class="empty-text">Нет игроков. Добавьте первого!</p>' :
                    players.map((p,i) => {
                        const cd = playerColors[p.color] || playerColors.indigo;
                        return `<div class="player-card" style="border-color:${cd.name}">
                            <div class="player-avatar" style="background:${cd.gradient}">${p.name[0].toUpperCase()}</div>
                            <div class="player-info">
                                <span class="player-name" style="color:${cd.name}">${p.name}</span>
                                <span class="player-color">${cd.label}</span>
                                <span class="player-stats-mini">🎮 ${p.stats?.gamesPlayed||0} игр · ✅ ${p.stats?.tasksCompleted||0} зад.</span>
                            </div>
                            <button onclick="deletePlayer(${i})" class="delete-btn" title="Удалить">🗑️</button>
                        </div>`;
                    }).join('')}
            </div>
        </div>
        <div class="panel-actions">
            <button onclick="clearAllPlayers()" class="cyber-btn danger-btn" ${!players.length?'disabled':''}>🗑️ Очистить список</button>
            <button onclick="resetAllStats()" class="cyber-btn outline-btn" ${!players.length?'disabled':''}>📊 Сбросить статистику</button>
        </div>
    </div>`;
}

function addPlayer() {
    const ni = document.getElementById('newPlayer'), cs = document.getElementById('playerColor');
    if (!ni || !cs) return;
    const name = ni.value.trim(), color = cs.value;
    if (!name) return showNotification('Введите имя игрока', 'error');
    if (players.some(p => p.name === name)) return showNotification('Игрок уже существует', 'warning');
    players.push({ name, color, stats: { gamesPlayed:0, tasksCompleted:0 } }); saveAll(); switchTab('players');
    showNotification(`👤 Игрок "${name}" добавлен`, 'success');
}
function deletePlayer(i) {
    const name = players[i]?.name || 'Неизвестный';
    showConfirmModal('🗑️ Удаление игрока', `Удалить игрока "${name}"?`, 'УДАЛИТЬ', 'ОТМЕНА', () => {
        players.splice(i, 1); saveAll(); switchTab('players');
        showNotification(`Игрок "${name}" удалён`, 'warning');
    });
}
function clearAllPlayers() {
    if (!players.length) return;
    showConfirmModal('🗑️ Очистка', `Удалить ВСЕХ игроков (${players.length} чел.)?`, 'ОЧИСТИТЬ', 'ОТМЕНА', () => {
        players = []; saveAll(); switchTab('players');
        showNotification('Список очищен', 'warning');
    });
}
function resetAllStats() {
    showConfirmModal('📊 Сброс статистики', 'Сбросить статистику всех игроков?', 'СБРОСИТЬ', 'ОТМЕНА', () => {
        players.forEach(p => { p.stats = { gamesPlayed:0, tasksCompleted:0 } }); saveAll(); switchTab('players');
        showNotification('Статистика сброшена', 'info');
    });
}

// ── ROULETTE TAB ──────────────────────────────────────────
function renderRouletteTab() {
    const avail = Object.entries(games).filter(([,t]) => t.length > 0);
    const gCount = Object.keys(games).length;
    const tCount = Object.values(games).reduce((s,t) => s+t.length, 0);
    let modeInfo = '', canSpin = true, spinTxt = '🎰 ЗАПУСТИТЬ РУЛЕТКУ', wheelHidden = false;

    if (gameFirstState.active && gameFirstState.selectedGame) {
        const curP      = players[gameFirstState.currentPlayerIndex];
        const remaining = getRemainingTasksForGame(gameFirstState.selectedGame);
        const assigned  = Object.keys(gameFirstState.assignedTasks).length;
        const total     = players.length;
        // done = все игроки получили задания ИЛИ задания закончились
        const done = total > 0 && (assigned >= total || remaining.length === 0);
        const pct  = total > 0 ? Math.round((assigned / total) * 100) : 0;
        if (done) {
            canSpin = false;
            spinTxt = '✅ ВСЕ ЗАДАНИЯ РАСПРЕДЕЛЕНЫ';
            wheelHidden = true;           // скрываем только когда всё готово
        } else if (curP) {
            spinTxt = `🎰 КРУТИТЬ ДЛЯ: ${curP.name.toUpperCase()}`;
            // колесо показываем — wheelHidden остаётся false
        }

        modeInfo = `<div class="game-first-status">
            <div class="progress-container">
                <div class="progress-header">
                    <span class="progress-label">Прогресс</span>
                    <span class="progress-value">${assigned}/${total} (${pct}%)</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            </div>
            <div class="status-card selected-game-card">
                <div class="status-card-icon">🎮</div>
                <div class="status-card-content"><span class="status-card-label">Выбранная игра</span><span class="status-card-value">${gameFirstState.selectedGame}</span></div>
            </div>
            ${curP && !done ? `<div class="status-card current-player-card">
                <div class="status-card-icon">👤</div>
                <div class="status-card-content"><span class="status-card-label">Сейчас крутит</span><span class="status-card-value" style="color:${playerColors[curP.color]?.name||'#818cf8'}">${curP.name}</span></div>
            </div>` : ''}
            <div class="stats-row">
                <div class="stat-mini"><span class="stat-mini-icon">📋</span><span class="stat-mini-text">Осталось: <strong>${remaining.length}</strong></span></div>
                <div class="stat-mini"><span class="stat-mini-icon">✅</span><span class="stat-mini-text">Назначено: <strong>${assigned}</strong></span></div>
            </div>
            ${assigned > 0 ? `<div class="assigned-tasks-section">
                <div class="section-subtitle" onclick="toggleAssignedTasks()">
                    <span class="dropdown-arrow" id="assignedArrow">▶</span><span>Назначено (${assigned})</span>
                </div>
                <div class="assigned-tasks-list hidden" id="assignedTasksList">
                    ${Object.entries(gameFirstState.assignedTasks).map(([pn,pt],idx)=>{
                        const pl = players.find(p=>p.name===pn);
                        const cd = playerColors[pl?.color]||playerColors.indigo;
                        return `<div class="assigned-task-row">
                            <span class="assigned-task-number">#${idx+1}</span>
                            <span class="assigned-player-name" style="color:${cd.name}">${pn}</span>
                            <span class="assigned-task-divider">→</span>
                            <span class="assigned-task-text">${pt}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : ''}
            ${done ? `<div class="completion-notice">
                <div class="completion-icon">🎉</div>
                <p class="completion-text">Все задания розданы!</p>
                <p class="completion-subtext">${assigned} из ${total} игроков</p>
                <div class="completion-actions">
                    <button onclick="showFinalResults()" class="cyber-btn add-btn">📋 Результаты</button>
                    <button onclick="resetGameFirstMode()" class="cyber-btn danger-btn">🔄 Заново</button>
                </div>
            </div>` : ''}
        </div>`;
    }

    if (rouletteMode === 'task-only') {
        const gamesWithTasks = Object.entries(games).filter(([,t]) => t.length > 0);
        if (gamesWithTasks.length === 0) {
            canSpin = false;
            spinTxt = '⚠️ НЕТ ИГР С ЗАДАНИЯМИ';
        } else if (!taskOnlyState.selectedGame) {
            canSpin = false;
            spinTxt = '📋 ВЫБЕРИТЕ ИГРУ';
        } else {
            const selectedTasks = games[taskOnlyState.selectedGame] || [];
            spinTxt = `🎰 КРУТИТЬ ЗАДАНИЯ: ${taskOnlyState.selectedGame.toUpperCase()}`;
        }
        
        modeInfo = `<div class="task-only-status">
            <div class="game-selector-section">
                <div class="section-subtitle">
                    <span class="section-icon">🎮</span>
                    <span>Выбор игры для заданий</span>
                </div>
                <div class="game-selector-grid">
                    ${gamesWithTasks.map(([gameName, tasks], index) => `
                        <button onclick="selectGameForTaskOnly(this.dataset.gameName)" 
                                data-game-name="${gameName}"
                                class="game-selector-btn ${taskOnlyState.selectedGame === gameName ? 'selected' : ''}">
                            <div class="game-selector-name">${gameName}</div>
                            <div class="game-selector-tasks">${tasks.length} заданий</div>
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div class="player-selector-section">
                <div class="section-subtitle">
                    <span class="section-icon">👤</span>
                    <span>Выбор игрока</span>
                </div>
                <div class="player-selector-grid">
                    <button onclick="selectPlayerForTaskOnly(null)" 
                            class="player-selector-btn ${taskOnlyState.selectedPlayer === null ? 'selected' : ''}">
                        <div class="player-selector-name">🎲 Случайный</div>
                        <div class="player-selector-desc">Любой игрок</div>
                    </button>
                    ${players.map(player => `
                        <button onclick="selectPlayerForTaskOnly('${player.name.replace(/'/g, "\\'")}')" 
                                class="player-selector-btn ${taskOnlyState.selectedPlayer === player.name ? 'selected' : ''}">
                            <div class="player-selector-name" style="color: ${playerColors[player.color]?.name || '#818cf8'}">${player.name}</div>
                            <div class="player-selector-desc">Конкретный игрок</div>
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
                                <span class="status-card-label">Выбранная игра</span>
                                <span class="status-card-value">${taskOnlyState.selectedGame}</span>
                            </div>
                        </div>
                    ` : ''}
                    ${taskOnlyState.selectedPlayer !== null ? `
                        <div class="status-card selected-player-card">
                            <div class="status-card-icon">👤</div>
                            <div class="status-card-content">
                                <span class="status-card-label">Выбранный игрок</span>
                                <span class="status-card-value" style="color: ${taskOnlyState.selectedPlayer ? (playerColors[players.find(p => p.name === taskOnlyState.selectedPlayer)?.color]?.name || '#818cf8') : '#818cf8'}">${taskOnlyState.selectedPlayer || 'Случайный'}</span>
                            </div>
                        </div>
                    ` : ''}
                    <div class="stats-row">
                        ${taskOnlyState.selectedGame ? `
                            <div class="stat-mini">
                                <span class="stat-mini-icon">📋</span>
                                <span class="stat-mini-text">Заданий: <strong>${games[taskOnlyState.selectedGame]?.length || 0}</strong></span>
                            </div>
                        ` : ''}
                        <div class="stat-mini">
                            <span class="stat-mini-icon">👥</span>
                            <span class="stat-mini-text">Игроков: <strong>${players.length}</strong></span>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>`;
    }

    const wsz = rouletteSettings.wheelSize;
    return `<div class="roulette-panel">
        <div class="roulette-info">
            <div class="mode-selector">
                <p class="roulette-mode">🎲 <span class="neon-text">РЕЖИМ РУЛЕТКИ</span></p>
                <div class="mode-buttons">
                    <button onclick="setRouletteMode('full')" class="mode-btn ${rouletteMode==='full'?'active':''}">
                        <span class="mode-btn-icon">🎰</span>
                        <span class="mode-btn-text">Полный рандом</span>
                        <span class="mode-btn-desc">Игра+задание+игрок</span>
                    </button>
                    <button onclick="setRouletteMode('game-first')" class="mode-btn ${rouletteMode==='game-first'?'active':''}">
                        <span class="mode-btn-icon">🎯</span>
                        <span class="mode-btn-text">Сначала игра</span>
                        <span class="mode-btn-desc">Задания для всех</span>
                    </button>
                    <button onclick="setRouletteMode('player-only')" class="mode-btn ${rouletteMode==='player-only'?'active':''}">
                        <span class="mode-btn-icon">👤</span>
                        <span class="mode-btn-text">Только игрок</span>
                        <span class="mode-btn-desc">Выбор участника</span>
                    </button>
                    <button onclick="setRouletteMode('task-only')" class="mode-btn ${rouletteMode==='task-only'?'active':''}">
                        <span class="mode-btn-icon">📋</span>
                        <span class="mode-btn-text">Только задание</span>
                        <span class="mode-btn-desc">Игра + игрок + задание</span>
                    </button>
                </div>
            </div>
            <p class="roulette-hint">${getModeHint()}</p>
            ${modeInfo}
            ${!gameFirstState.active ? `<div class="pre-spin-stats">
                <div class="pre-stat-item"><span class="pre-stat-icon">🎮</span><span class="pre-stat-text">Игр: <strong>${gCount}</strong></span></div>
                <div class="pre-stat-item"><span class="pre-stat-icon">📋</span><span class="pre-stat-text">Заданий: <strong>${tCount}</strong></span></div>
                <div class="pre-stat-item"><span class="pre-stat-icon">👥</span><span class="pre-stat-text">Игроков: <strong>${players.length}</strong></span></div>
            </div>` : ''}
        </div>
        <div class="wheel-and-controls">
            <div class="wheel-container" id="wheelContainer" style="${wheelHidden?'opacity:0;transform:scale(0.8);pointer-events:none;max-height:0;overflow:hidden;margin:0':'opacity:1;transform:scale(1)'}">
                <canvas id="rouletteWheel" width="${wsz}" height="${wsz}" onclick="startSpin()"></canvas>
                <div class="wheel-pointer" id="wheelPointer">${getPointerSymbol()}</div>
            </div>
            <div class="roulette-controls">
                <button onclick="startSpin()" class="cyber-btn spin-btn" ${spinning||!canSpin?'disabled':''}>${spinTxt}</button>
                ${gameFirstState.active && canSpin ? '<br><button onclick="resetGameFirstMode()" class="cyber-btn danger-btn outline-btn" style="margin-top:8px">🔄 Сбросить режим</button>' : ''}
                <p class="spin-hint">${avail.length===0?'⚠️ Добавьте игры с заданиями':'✅ Готово: '+gCount+' игр, '+tCount+' зад., '+players.length+' игр.'}</p>
            </div>
            <div id="spinResult" class="spin-result hidden">
                <div class="result-card"><h3>🎯 Результат:</h3><div id="resultContent"></div><div id="resultActions"></div></div>
            </div>
        </div>
    </div>`;
}

function getModeHint() {
    const hints = {
        'full':        'Случайная игра + случайное задание + случайный игрок',
        'game-first':  'Сначала выбирается игра, затем задания для каждого игрока',
        'player-only': 'Колесо выбирает только случайного игрока из списка',
        'task-only':   'Выбирается задание для выбранной игры и игрока',
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
    if (rouletteMode === 'player-only') {
        wheelSegments = players.length > 0
            ? players.map((p,i) => ({ label: p.name, task: p.name, game: 'Игрок', color: playerColors[p.color]?.border || getSegmentColor(i, players.length) }))
            : [{ label: 'Нет игроков', task: 'Добавьте игроков', game: '', color: '#484f58' }];
        return;
    }
    if (rouletteMode === 'task-only') {
        if (taskOnlyState.selectedGame && games[taskOnlyState.selectedGame]) {
            const selectedTasks = games[taskOnlyState.selectedGame];
            wheelSegments = selectedTasks.map((t,i) => ({ 
                label: `#${i+1}`, 
                task: t, 
                game: taskOnlyState.selectedGame, 
                color: getSegmentColor(i, selectedTasks.length) 
            }));
        } else {
            wheelSegments = [{ label: 'Выберите игру', task: 'Выберите игру из списка', game: '', color: '#484f58' }];
        }
        return;
    }
    const allTasks = [];
    Object.entries(games).forEach(([g, tasks]) => {
        if (!Array.isArray(tasks)) return;
        tasks.forEach(t => {
            // Защита от старого формата данных: задание может быть строкой или объектом
            const taskStr = typeof t === 'string' ? t : (t && typeof t.task === 'string' ? t.task : String(t));
            if (taskStr) allTasks.push({ game: g, task: taskStr });
        });
    });

    if (!allTasks.length) {
        wheelSegments = [{ label: 'Нет заданий', task: 'Добавьте задания', game: '', color: '#484f58' }];
        return;
    }

    const max = rouletteSettings.groupSegments ? Math.max(1, rouletteSettings.maxSegments) : 200;
    if (allTasks.length > max) {
        const groupCount = Math.min(max, allTasks.length);
        const grpSize = Math.ceil(allTasks.length / groupCount);
        wheelSegments = [];
        for (let i = 0; i < groupCount; i++) {
            const start = i * grpSize;
            if (start >= allTasks.length) break;          // не выходить за пределы
            const end = Math.min(start + grpSize, allTasks.length);
            const grp = allTasks.slice(start, end);
            if (!grp.length) break;
            wheelSegments.push({
                label: grp[0].game,
                task:  grp[0].task,
                game:  grp[0].game,
                color: getSegmentColor(i, groupCount),
                isGroup: true,
                items: grp
            });
        }
    } else {
        wheelSegments = allTasks.map((item, i) => ({
            label: item.game,
            task:  item.task,
            game:  item.game,
            color: getSegmentColor(i, allTasks.length)
        }));
    }
}

function updateWheelSegmentsForGame(gameName) {
    const remaining = getRemainingTasksForGame(gameName);
    if (!remaining.length) {
        wheelSegments = [{ label: 'Всё', task: 'Все задания розданы', game: gameName, color: '#484f58' }];
        return;
    }
    wheelSegments = remaining.map((t, i) => {
        const taskStr = typeof t === 'string' ? t : (t && typeof t.task === 'string' ? t.task : String(t));
        return { label: `#${i + 1}`, task: taskStr, game: gameName, color: getSegmentColor(i, remaining.length) };
    });
}

function getRemainingTasksForGame(name) {
    const used = Object.values(gameFirstState.assignedTasks);
    return (games[name] || []).filter(t => !used.includes(t));
}

// ── WHEEL RENDER ──────────────────────────────────────────
function getPointerSymbol() {
    const sym = { arrow:'▼', triangle:'▽', diamond:'◆', star:'★', pin:'📍' };
    return sym[rouletteSettings.pointerStyle] || '▼';
}

function renderWheel() {
    const canvas = document.getElementById('rouletteWheel'); if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2;
    const outerR = W/2 - 10, innerR = 32;
    ctx.clearRect(0, 0, W, H);

    if (!wheelSegments.length) return;

    // Outer decorative ring
    const ringGrd = ctx.createLinearGradient(0,0,W,H);
    ringGrd.addColorStop(0, rouletteSettings.borderStyle === 'neon' ? '#00ffff' : (getComputedStyle(document.documentElement).getPropertyValue('--wheel-border').trim() || '#6366f1'));
    ringGrd.addColorStop(1, rouletteSettings.borderStyle === 'neon' ? '#ff00ff' : '#8b5cf6');
    ctx.beginPath(); ctx.arc(cx,cy, outerR+12, 0, Math.PI*2);
    if (rouletteSettings.borderStyle === 'glow' || rouletteSettings.borderStyle === 'neon') {
        ctx.shadowColor = ringGrd; ctx.shadowBlur = 20;
    }
    ctx.strokeStyle = ringGrd; ctx.lineWidth = rouletteSettings.borderStyle === 'dashed' ? 3 : 4;
    if (rouletteSettings.borderStyle === 'dashed') ctx.setLineDash([8,4]); else ctx.setLineDash([]);
    ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);

    // Segments
    const segAngle = (Math.PI*2) / wheelSegments.length;
    wheelSegments.forEach((seg, i) => {
        const sA = i * segAngle + currentWheelAngle;
        const eA = sA + segAngle;

        // Segment fill with gradient
        const grd = ctx.createRadialGradient(cx,cy, innerR, cx,cy, outerR);
        grd.addColorStop(0,   seg.color + 'dd');
        grd.addColorStop(0.7, seg.color + 'bb');
        grd.addColorStop(1,   seg.color + '55');
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy, outerR, sA, eA); ctx.closePath();
        ctx.fillStyle = grd; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5; ctx.stroke();

        // Segment label
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(sA + segAngle/2);
        ctx.fillStyle = '#fff';
        const fs = Math.max(9, rouletteSettings.fontSize);
        ctx.font = `bold ${fs}px Inter,system-ui,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 5;
        let lbl = seg.label || seg.game || '';
        if (lbl.length > 11) lbl = lbl.substring(0,9) + '..';
        const textR = outerR * 0.68;
        ctx.fillText(lbl, textR, 0);
        if (seg.isGroup) {
            ctx.font = `${fs-2}px Inter,system-ui,sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(`${seg.items?.length||0} зад.`, textR, fs+2);
        }
        ctx.restore();
    });

    // Tick dots on the outer ring
    const tickCount = Math.min(wheelSegments.length * 2, 48);
    for (let i = 0; i < tickCount; i++) {
        const a = (i/tickCount)*Math.PI*2;
        const tx = cx + (outerR+7)*Math.cos(a), ty = cy + (outerR+7)*Math.sin(a);
        ctx.beginPath(); ctx.arc(tx, ty, i%2===0?3:2, 0, Math.PI*2);
        ctx.fillStyle = i%2===0 ? (COLOR_SCHEMES[rouletteSettings.colorScheme]||COLOR_SCHEMES.default)[0] : 'rgba(255,255,255,0.3)';
        ctx.fill();
    }

    // Center hub
    const hubGrd = ctx.createRadialGradient(cx,cy,0, cx,cy,innerR);
    hubGrd.addColorStop(0, '#ffffff'); hubGrd.addColorStop(1, '#e2e8f0');
    ctx.beginPath(); ctx.arc(cx,cy, innerR, 0, Math.PI*2);
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12;
    ctx.fillStyle = hubGrd; ctx.fill();
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--wheel-border').trim() || '#6366f1';
    ctx.strokeStyle = borderColor; ctx.lineWidth = 3; ctx.shadowBlur = 0; ctx.stroke();

    // Center icon
    ctx.font = `${innerR*0.9}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(rouletteSettings.centerIcon || '🎲', cx, cy+1);
}

// ── SPIN LOGIC ────────────────────────────────────────────
function setRouletteMode(mode) {
    rouletteMode = mode;
    gameFirstState = { active:false, selectedGame:null, currentPlayerIndex:0, assignedTasks:{} };
    if (mode !== 'task-only') {
        taskOnlyState.selectedGame = null;
        taskOnlyState.selectedPlayer = null;
    }
    saveAll(); // Сохраняем все изменения включая новый режим
    updateWheelSegments();
    switchTab('roulette');
    showNotification(`🎲 Режим: ${getModeHint().split(' ')[0]} ${getModeHint().split(' ')[1]||''}`, 'info');
}

function resetGameFirstMode() {
    gameFirstState = { active:false, selectedGame:null, currentPlayerIndex:0, assignedTasks:{} };
    updateWheelSegments();
    const rd = document.getElementById('spinResult'); if (rd) rd.classList.add('hidden');
    switchTab('roulette');
    showNotification('Режим сброшен', 'info');
}

function selectGameForTaskOnly(gameName) {
    taskOnlyState.selectedGame = gameName;
    saveAll();
    
    // Сразу обновляем стили кнопок игр
    const gameButtons = document.querySelectorAll('.game-selector-btn');
    gameButtons.forEach(btn => {
        if (btn.dataset.gameName === gameName) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    
    // Обновляем информацию о выбранной игре в summary блоке
    updateGameSummary(gameName);
    
    // Обновляем сегменты колеса и перерисовываем его
    updateWheelSegments();
    renderWheel();
    
    showNotification(`🎮 Выбрана игра: ${gameName}`, 'info');
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
    
    // Обновляем или создаем карточку с выбранной игрой
    let gameCard = document.querySelector('.selected-game-card');
    if (gameCard) {
        const valueSpan = gameCard.querySelector('.status-card-value');
        if (valueSpan) {
            valueSpan.textContent = gameName;
        }
    } else if (gameName) {
        // Создаем новую карточку игры
        const gameCardHTML = `
            <div class="status-card selected-game-card">
                <div class="status-card-icon">🎮</div>
                <div class="status-card-content">
                    <span class="status-card-label">Выбранная игра</span>
                    <span class="status-card-value">${gameName}</span>
                </div>
            </div>
        `;
        const summarySection = document.querySelector('.selection-summary');
        if (summarySection) {
            summarySection.insertAdjacentHTML('afterbegin', gameCardHTML);
        }
    }
    
    // Обновляем количество заданий
    let tasksStat = document.querySelector('.stat-mini .stat-mini-text');
    if (tasksStat && tasksStat.innerHTML.includes('Заданий:')) {
        tasksStat.innerHTML = `Заданий: <strong>${games[gameName]?.length || 0}</strong>`;
    }
}

function selectPlayerForTaskOnly(playerName) {
    taskOnlyState.selectedPlayer = playerName;
    saveAll();
    
    // Сразу обновляем стили кнопок игроков
    const buttons = document.querySelectorAll('.player-selector-btn');
    buttons.forEach(btn => {
        // Определяем какой игрок на кнопке
        const isRandomBtn = btn.onclick.toString().includes('null');
        const buttonPlayerName = isRandomBtn ? null : btn.querySelector('.player-selector-name').textContent;
        
        // Сравниваем с выбранным игроком
        const isSelected = (playerName === null && isRandomBtn) || 
                          (playerName !== null && buttonPlayerName === playerName);
        
        if (isSelected) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    
    // Обновляем информацию о выбранном игроке в summary блоке
    updatePlayerSummary(playerName);
    
    showNotification(`👤 Выбран игрок: ${playerName || 'Случайный'}`, 'info');
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
        // Создаем новую карточку игрока
        const player = players.find(p => p.name === playerName);
        const color = player ? (playerColors[player.color]?.name || '#818cf8') : '#818cf8';
        const displayName = playerName || 'Случайный';
        
        const playerCardHTML = `
            <div class="status-card selected-player-card">
                <div class="status-card-icon">👤</div>
                <div class="status-card-content">
                    <span class="status-card-label">Выбранный игрок</span>
                    <span class="status-card-value" style="color: ${color}">${displayName}</span>
                </div>
            </div>
        `;
        
        const summarySection = document.querySelector('.selection-summary');
        if (summarySection) {
            // Вставляем после карточки игры, если она есть
            const gameCard = summarySection.querySelector('.selected-game-card');
            if (gameCard) {
                gameCard.insertAdjacentHTML('afterend', playerCardHTML);
            } else {
                summarySection.insertAdjacentHTML('afterbegin', playerCardHTML);
            }
        }
    }
}

function updateSelectedPlayerInfo(playerName) {
    // Оставлю эту функцию пустой, так как логика перенесена в updatePlayerSummary
}

function startSpin() {
    if (spinning) return;
    // Gamer: bonus round check
    if (rouletteSettings.bonusRoundEnabled && Math.random()*100 < rouletteSettings.bonusRoundChance) {
        showNotification('🎉 БОНУС РАУНД! Двойная рулетка!', 'success');
        setTimeout(() => { executeSpin(); setTimeout(executeSpin, rouletteSettings.spinDuration + 2000) }, 200);
        return;
    }
    executeSpin();
}

function executeSpin() {
    if (spinning) return;
    // Validations
    if (rouletteMode === 'player-only' && players.length < 1) return showNotification('Добавьте игроков', 'error');
    if (rouletteMode === 'task-only') {
        if (!taskOnlyState.selectedGame) return showNotification('Выберите игру из списка', 'error');
        const selectedTasks = games[taskOnlyState.selectedGame];
        if (!selectedTasks || !selectedTasks.length) return showNotification('В выбранной игре нет заданий', 'error');
    }
    if (rouletteMode !== 'player-only' && rouletteMode !== 'task-only') {
        if (players.length < 1) return showNotification('Добавьте хотя бы одного игрока', 'error');
        const allTasks = Object.values(games).flat();
        if (!allTasks.length) return showNotification('Добавьте задания', 'error');
    }
    if (rouletteMode === 'game-first' && gameFirstState.active) {
        const rem = getRemainingTasksForGame(gameFirstState.selectedGame);
        if (!rem.length || Object.keys(gameFirstState.assignedTasks).length >= players.length) {
            return showNotification('Все задания распределены!', 'warning');
        }
    }

    spinning = true;
    const spinBtn = document.querySelector('.spin-btn'); if (spinBtn) spinBtn.disabled = true;
    document.getElementById('spinResult')?.classList.add('hidden');
    document.getElementById('wheelResultPopup')?.classList.add('hidden');

    if (rouletteMode === 'player-only')  { spinPlayerOnly();  return }
    if (rouletteMode === 'task-only')    { spinTaskOnly();    return }
    if (rouletteMode === 'game-first')   {
        if (!gameFirstState.active) startGameFirstInitial();
        else startGameFirstSpin();
        return;
    }
    startFullRandomMode();
}

function startFullRandomMode() {
    const gamesWithTasks = Object.entries(games).filter(([,t]) => t.length > 0);
    if (!gamesWithTasks.length) { showNotification('Нет игр с заданиями', 'error'); finishSpin(); return }
    const [selGame, selTasks] = gamesWithTasks[Math.floor(Math.random() * gamesWithTasks.length)];
    const selPlayer = players[Math.floor(Math.random() * players.length)];
    const selTask   = selTasks[Math.floor(Math.random() * selTasks.length)];
    updateWheelSegments();
    const allTasks = Object.entries(games).flatMap(([g,ts]) => ts.map(t=>({game:g,task:t})));
    const ti = allTasks.findIndex(i => i.game===selGame && i.task===selTask);
    spinWheel(allTasks, ti >= 0 ? ti : 0, () => {
        setTimeout(() => {
            if (rouletteSettings.resultDisplay !== 'popup') showResult(selGame, selPlayer, selTask);
            showPopupResult(selGame, selPlayer, selTask);
            updatePlayerStats(selPlayer.name); playWinSound(); finishSpin();
        }, rouletteSettings.announceDelay || 0);
    });
}

function spinPlayerOnly() {
    if (!players.length) { finishSpin(); return }
    updateWheelSegments();
    const ti = Math.floor(Math.random() * players.length);
    spinWheel(wheelSegments, ti, () => {
        const p = players[ti];
        setTimeout(() => {
            showPopupResult('👤 Выбор игрока', p, p.name);
            if (rouletteSettings.resultDisplay !== 'popup') showResult('Выбор игрока', p, `${p.name} выбран!`);
            playWinSound(); finishSpin();
        }, rouletteSettings.announceDelay || 0);
    });
}

function spinTaskOnly() {
    if (!taskOnlyState.selectedGame || !games[taskOnlyState.selectedGame]) {
        showNotification('Выберите игру из списка', 'error');
        finishSpin(); 
        return;
    }
    
    const selectedTasks = games[taskOnlyState.selectedGame];
    if (!selectedTasks.length) { 
        showNotification('В выбранной игре нет заданий', 'error');
        finishSpin(); 
        return;
    }
    
    updateWheelSegments();
    const ti = Math.floor(Math.random() * selectedTasks.length);
    
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
        const task = selectedTasks[ti];
        setTimeout(() => {
            showPopupResult(taskOnlyState.selectedGame, selectedPlayer, task);
            if (rouletteSettings.resultDisplay !== 'popup') showResult(taskOnlyState.selectedGame, selectedPlayer, task);
            playWinSound(); finishSpin();
        }, rouletteSettings.announceDelay || 0);
    });
}

function startGameFirstInitial() {
    const gamesWithTasks = Object.entries(games).filter(([,t]) => t.length > 0);
    if (!gamesWithTasks.length) { showNotification('Нет игр с заданиями', 'error'); finishSpin(); return }
    const selGame = gamesWithTasks[Math.floor(Math.random() * gamesWithTasks.length)][0];
    updateWheelSegments();
    const allTasks = Object.entries(games).flatMap(([g,ts]) => ts.map(t=>({game:g,task:t})));
    const ti = allTasks.findIndex(i => i.game === selGame);
    spinWheel(allTasks, ti >= 0 ? ti : 0, () => {
        gameFirstState = { active:true, selectedGame:selGame, currentPlayerIndex:0, assignedTasks:{} };
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
        showNotification(`🎮 Выбрана игра: ${selGame}!`, 'success');
        if (players[0]) setTimeout(() => showNotification(`👤 ${players[0].name} крутит первым`, 'info'), 1500);
        finishSpin();
    });
}

function startGameFirstSpin() {
    const curP = players[gameFirstState.currentPlayerIndex];
    if (!curP) { hideWheelSmoothly(); setTimeout(showFinalResults, 600); return }
    const remaining = getRemainingTasksForGame(gameFirstState.selectedGame);
    if (!remaining.length) { hideWheelSmoothly(); setTimeout(showFinalResults, 600); return }
    const gameOnlyTasks = remaining.map(t => ({ game: gameFirstState.selectedGame, task:t }));
    const selTask = remaining[Math.floor(Math.random() * remaining.length)];
    const ti = gameOnlyTasks.findIndex(i => i.task === selTask);
    updateWheelSegmentsForGame(gameFirstState.selectedGame); renderWheel();
    spinWheel(gameOnlyTasks, ti >= 0 ? ti : 0, () => {
        gameFirstState.assignedTasks[curP.name] = selTask;
        setTimeout(() => {
            if (rouletteSettings.resultDisplay !== 'popup') showResult(gameFirstState.selectedGame, curP, selTask);
            showPopupResult(gameFirstState.selectedGame, curP, selTask);
            updatePlayerStats(curP.name); playWinSound();
            gameFirstState.currentPlayerIndex++;
            const nextP = players[gameFirstState.currentPlayerIndex];
            const stillRem = getRemainingTasksForGame(gameFirstState.selectedGame);
            if (!nextP || !stillRem.length) { hideWheelSmoothly(); setTimeout(showFinalResults, 700) }
            else { switchTab('roulette'); updateWheelSegmentsForGame(gameFirstState.selectedGame); renderWheel(); showNotification(`👤 Очередь: ${nextP.name}`, 'info') }
            finishSpin();
        }, rouletteSettings.announceDelay || 0);
    });
}

function hideWheelSmoothly() {
    const wc = document.getElementById('wheelContainer');
    if (wc) { wc.style.transition='all 0.6s ease'; wc.style.opacity='0'; wc.style.transform='scale(0.8)'; wc.style.maxHeight='0'; wc.style.overflow='hidden'; wc.style.margin='0'; wc.style.pointerEvents='none' }
}
function showWheel() {
    const wc = document.getElementById('wheelContainer');
    if (wc) { wc.style.transition='all 0.5s ease'; wc.style.opacity='1'; wc.style.transform='scale(1)'; wc.style.maxHeight='600px'; wc.style.margin=''; wc.style.pointerEvents='auto'; wc.style.overflow='' }
}
function finishSpin() { spinning = false; const btn = document.querySelector('.spin-btn'); if (btn) btn.disabled = false }

// ── ANIMATION ENGINE ──────────────────────────────────────
function spinWheel(tasks, targetIdx, callback) {
    if (!tasks.length) { if (callback) callback(); return }
    const segAngle = (Math.PI*2) / tasks.length;
    const targetAngle = targetIdx * segAngle + segAngle/2;
    const spins = rouletteSettings.minSpins + Math.floor(Math.random() * (rouletteSettings.maxSpins - rouletteSettings.minSpins + 1));
    const totalRot = spins * Math.PI*2 + (Math.PI*2 - targetAngle);
    if (rouletteSettings.soundEnabled) playSpinSound();
    animateWheel(totalRot, callback);
}

function easeOutCubic(t)  { return 1 - Math.pow(1-t, 3) }
function easeOutBounce(t) {
    const n1=7.5625, d1=2.75;
    if (t < 1/d1)      return n1*t*t;
    if (t < 2/d1)      return n1*(t-=1.5/d1)*t+0.75;
    if (t < 2.5/d1)    return n1*(t-=2.25/d1)*t+0.9375;
    return n1*(t-=2.625/d1)*t+0.984375;
}
function easeOutElastic(t) {
    if (t===0||t===1) return t;
    return Math.pow(2,-10*t)*Math.sin((t*10-0.75)*(2*Math.PI)/3)+1;
}

function getEaseFn() {
    if (rouletteSettings.wheelAnimation === 'bounce')  return easeOutBounce;
    if (rouletteSettings.wheelAnimation === 'elastic') return easeOutElastic;
    if (rouletteSettings.wheelAnimation === 'linear')  return t => t;
    return easeOutCubic;
}

function animateWheel(totalRotation, callback) {
    const canvas = document.getElementById('rouletteWheel');
    if (!canvas) { if (callback) callback(); return }
    const duration  = rouletteSettings.spinDuration;
    const startTime = Date.now();
    const startAngle = currentWheelAngle;
    const easeFn = getEaseFn();
    let lastTickSeg = -1;

    if (rouletteSettings.visualEffects) {
        const wc = document.getElementById('wheelContainer');
        if (wc) { wc.style.transition='all 0.3s ease'; wc.style.transform='scale(1.02)' }
    }

    function animate() {
        const elapsed  = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = easeFn(progress);
        currentWheelAngle = startAngle + totalRotation * eased;
        renderWheel();

        // Tick sound on segment changes (last 30%)
        if (progress > 0.7 && rouletteSettings.soundEnabled && rouletteSettings.tickSoundEnabled) {
            const seg = Math.floor((currentWheelAngle % (Math.PI*2)) / ((Math.PI*2)/wheelSegments.length));
            if (seg !== lastTickSeg) { lastTickSeg = seg; playTickSound() }
        }

        // Glow effect near end
        if (rouletteSettings.visualEffects && rouletteSettings.glowEffect && progress > 0.85) {
            const g = 20 + (progress - 0.85) * 133;
            const o = 0.4 + (progress - 0.85) * 4;
            if (canvas) canvas.style.filter = `drop-shadow(0 0 ${g}px rgba(99,102,241,${Math.min(o,1)}))`;
        }

        if (progress < 1) {
            animationId = requestAnimationFrame(animate);
        } else {
            currentWheelAngle = (startAngle + totalRotation) % (Math.PI*2);
            if (rouletteSettings.visualEffects && rouletteSettings.shakeEffect) shakeWheel(() => finalizeSpin(callback));
            else finalizeSpin(callback);
        }
    }
    animationId = requestAnimationFrame(animate);
}

function finalizeSpin(callback) {
    renderWheel();
    const canvas = document.getElementById('rouletteWheel');
    if (canvas) canvas.style.filter = 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))';
    const wc = document.getElementById('wheelContainer');
    if (wc) wc.style.transform = 'scale(1)';
    animationId = null;
    if (rouletteSettings.visualEffects && rouletteSettings.highlightWinner) highlightWinner(callback);
    else if (callback) callback();
}

function shakeWheel(callback) {
    const canvas = document.getElementById('rouletteWheel');
    if (!canvas) { if (callback) callback(); return }
    let n = 0; const total = 5;
    function shake() {
        if (n < total*2) {
            canvas.style.transform = `rotate(${n%2===0?3:-3}deg) scale(${1+0.01*(total-n/2)})`;
            canvas.style.transition = 'all 0.04s ease'; n++;
            setTimeout(shake, 40);
        } else { canvas.style.transform='rotate(0deg) scale(1)'; canvas.style.transition='all 0.2s ease'; setTimeout(() => { if (callback) callback() }, 200) }
    }
    shake();
}

function highlightWinner(callback) {
    const canvas = document.getElementById('rouletteWheel');
    if (canvas) {
        canvas.style.transition = 'all 0.3s ease';
        canvas.style.filter = 'drop-shadow(0 0 45px rgba(63,185,80,0.9)) brightness(1.25)';
        setTimeout(() => { canvas.style.filter = 'drop-shadow(0 8px 24px rgba(0,0,0,0.5)) brightness(1)' }, 600);
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
        hint.textContent = '× нажмите чтобы закрыть';
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
        <div class="result-card-item"><div class="result-card-icon">🎮</div><div class="result-card-label">Игра</div><div class="result-card-value">${game}</div></div>
        <div class="result-card-item"><div class="result-card-icon">👤</div><div class="result-card-label">Игрок</div><div class="result-card-value" style="color:${cd.name}">${player?.name||'?'}</div></div>
        <div class="result-card-item"><div class="result-card-icon">⚡</div><div class="result-card-label">Задание</div><div class="result-card-value task-highlight">${task}</div></div>
    </div>`;
    if (ra) {
        if (gameFirstState.active) {
            const nextP = players[gameFirstState.currentPlayerIndex];
            const rem   = getRemainingTasksForGame(gameFirstState.selectedGame);
            ra.innerHTML = nextP && rem.length > 0
                ? `<br><button onclick="startSpin()" class="cyber-btn add-btn">🔄 СЛЕДУЮЩИЙ: ${nextP.name}</button>`
                : `<br><button onclick="showFinalResults()" class="cyber-btn add-btn">📋 ВСЕ РЕЗУЛЬТАТЫ</button>`;
        } else {
            ra.innerHTML = `<br><button onclick="startSpin()" class="cyber-btn add-btn">🔄 КРУТИТЬ ЕЩЁ</button>`;
        }
    }
    rd.classList.remove('hidden'); rd.style.animation='none'; void rd.offsetHeight; rd.style.animation='fadeInUp 0.5s ease';
}

function showFinalResults() {
    const assigned = Object.keys(gameFirstState.assignedTasks).length;
    if (!assigned && gameFirstState.active) return showNotification('Нет назначенных заданий', 'warning');
    const unassigned = players.filter(p => !gameFirstState.assignedTasks[p.name]);
    const rd = document.getElementById('spinResult'), rc = document.getElementById('resultContent'), ra = document.getElementById('resultActions');
    if (!rd || !rc) return;
    rc.innerHTML = `
        <div class="final-result-header">
            <div class="final-game-info"><span class="final-game-icon">🎮</span><span class="final-game-name">${gameFirstState.selectedGame}</span></div>
            <div class="final-stats">
                <span class="final-stat-badge success">✅ ${assigned}</span>
                ${unassigned.length ? `<span class="final-stat-badge warning">⚠️ ${unassigned.length}</span>` : ''}
            </div>
        </div>
        <div class="final-results-list">
            <div class="final-results-title">📋 Задания (${assigned}/${players.length})</div>
            <div class="final-results-grid">
                ${Object.entries(gameFirstState.assignedTasks).map(([pn,pt],idx) => {
                    const pl = players.find(p => p.name===pn);
                    const cd = playerColors[pl?.color]||playerColors.indigo;
                    return `<div class="final-result-row"><span class="final-result-number">#${idx+1}</span><span class="final-result-player" style="color:${cd.name}">${pn}</span><span class="final-result-arrow">→</span><span class="final-result-task">${pt}</span></div>`;
                }).join('')}
            </div>
        </div>
        ${unassigned.length ? `<div class="unassigned-warning"><p class="unassigned-warning-title">⚠️ Без заданий</p><div class="unassigned-players-list">${unassigned.map(p=>`<span class="unassigned-player-tag" style="border-color:${playerColors[p.color]?.name||'#818cf8'};color:${playerColors[p.color]?.name||'#818cf8'}">${p.name}</span>`).join('')}</div></div>` : ''}
    `;
    if (ra) ra.innerHTML = `<br><button onclick="resetGameFirstMode()" class="cyber-btn add-btn">🔄 НАЧАТЬ ЗАНОВО</button><button onclick="exportResults()" class="cyber-btn export-btn">📤 Экспорт</button>`;
    rd.classList.remove('hidden'); rd.style.animation='none'; void rd.offsetHeight; rd.style.animation='fadeInUp 0.5s ease';
    switchTab('roulette');
}

// ── PARTICLES ─────────────────────────────────────────────
function createParticles() {
    const colors = ['#10b981','#6366f1','#f59e0b','#ec4899','#3b82f6','#84cc16','#f97316','#06b6d4'];
    const count = rouletteSettings.particleCount || 30;
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const p = document.createElement('div');
            p.className = 'win-particle';
            const size = Math.random()*10+6, angle = Math.random()*Math.PI*2, vel = Math.random()*220+80;
            const sx = window.innerWidth/2, sy = window.innerHeight/2;
            const ex = sx + Math.cos(angle)*vel, ey = sy + Math.sin(angle)*vel;
            const dur = Math.random()*900+500;
            const isStar2 = rouletteSettings.particleStyle === 'star';
            p.style.cssText = `position:fixed;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${isStar2?'2px':'50%'};left:${sx}px;top:${sy}px;z-index:9999;pointer-events:none;animation:particleBurst ${dur}ms ease-out forwards;--end-x:${ex-sx}px;--end-y:${ey-sy}px;${isStar2?'clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)':''}`;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), dur+100);
        }, i*15);
    }
}

function updatePlayerStats(name) {
    const p = players.find(x => x.name===name);
    if (p) { if(!p.stats)p.stats={gamesPlayed:0,tasksCompleted:0}; p.stats.gamesPlayed++; p.stats.tasksCompleted++; saveAll() }
}

// ── STREAMER TAB ──────────────────────────────────────────
function renderStreamerTab() {
    return `<div class="streamer-panel">
        <div class="streamer-hero">
            <span class="streamer-hero-icon">📡</span>
            <h2>СТРИМЕР-РЕЖИМ</h2>
            <p>Продвинутые инструменты для трансляций: OBS overlay, голосование чатом, таймер, быстрые команды и подписчики</p>
        </div>
        <div class="streamer-tools-grid">

            <!-- OBS Overlay -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">🖥️</span>
                    <div><div class="streamer-tool-title">OBS OVERLAY</div><div class="streamer-tool-desc">Добавьте рулетку в OBS как Browser Source</div></div>
                </div>
                <div class="overlay-url-box">
                    <input type="text" id="overlayUrlInput" readonly value="${getOverlayUrl()}" style="font-size:10px;min-width:0">
                    <button onclick="copyOverlayUrl()" class="cyber-btn primary-btn" style="padding:5px 10px;font-size:11px">📋 Копировать</button>
                </div>
                <div class="overlay-status"><span class="overlay-dot"></span> Overlay готов к использованию</div>
                <div class="streamer-tool-actions">
                    <button onclick="openOverlayWindow()" class="cyber-btn add-btn">🖥️ Открыть Overlay</button>
                    <button onclick="toggleChromaKey()" class="cyber-btn ${rouletteSettings.chromaKey?'primary-btn':''}">🟢 Chroma Key</button>
                    <button onclick="showOverlaySettings()" class="cyber-btn">⚙️ Настройки</button>
                </div>
                <div style="margin-top:10px;font-size:11px;color:var(--text-muted)">
                    В OBS: Sources → Browser → URL выше → 400×400px
                </div>
            </div>

            <!-- Chat Vote -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">🗳️</span>
                    <div><div class="streamer-tool-title">ГОЛОСОВАНИЕ ЧАТОМ</div><div class="streamer-tool-desc">Зрители выбирают задание через чат</div></div>
                </div>
                <div class="channel-input-group">
                    <input type="text" id="channelNameInput" placeholder="Ник канала на Twitch..." value="${streamerState.channelName}" oninput="updateChannelName(this.value)" onkeypress="if(event.key==='Enter')twitchToggleConnect()">
                    <button onclick="twitchToggleConnect()" class="cyber-btn ${streamerState.connected?'danger-btn':'add-btn'} channel-connect-btn" id="chatConnectBtn">
                        ${streamerState.twitchStatus==='connected'   ? '✅ Отключиться'
                        : streamerState.twitchStatus==='connecting'  ? '⏳ Подключение...'
                        : streamerState.twitchStatus==='error'       ? '❌ Retry'
                        :                                               '🔌 Подключить'}
                    </button>
                </div>
                <div class="channel-input-group" style="margin-bottom:8px">
                    <!-- Авторизация удалена, доступно только чтение чата -->
                </div>
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px">
                    📖 Только чтение чата (без отправки сообщений)
                </div>
                <div id="twitchStatusBar" style="font-size:11px;margin:6px 0 10px;color:${
                    streamerState.twitchStatus==='connected' ? 'var(--accent-success)'
                    : streamerState.twitchStatus==='error'   ? 'var(--accent-danger)'
                    : 'var(--text-muted)'}">
                    ${streamerState.twitchStatus==='connected'
                        ? `<span style="display:inline-flex;align-items:center;gap:5px"><span class="overlay-dot"></span> Читаем чат #${streamerState.channelName} (только чтение)</span>`
                        : streamerState.twitchStatus==='connecting' ? '⏳ Подключение к Twitch IRC...'
                        : streamerState.twitchStatus==='error'      ? '❌ Не удалось подключиться'
                        : 'Введите ник канала и нажмите Подключить'}
                </div>
                <div id="voteArea">
                    ${renderVoteArea()}
                </div>
                <div style="margin-top:12px;font-size:11px;color:var(--text-muted);padding:8px;background:var(--bg-tertiary);border-radius:var(--radius-sm)">
                    💡 <strong>Команды для модераторов:</strong><br>
                    !spin - запустить рулетку<br>
                    !vote - начать голосование<br>
                    !timer N - установить таймер на N минут<br>
                    <br><strong>Команды для зрителей:</strong><br>
                    !join или !addme - добавиться в колесо подписчиков
                </div>
            </div>

            <!-- Timer -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">⏱️</span>
                    <div><div class="streamer-tool-title">ТАЙМЕР СТРИМЕРА</div><div class="streamer-tool-desc">Обратный отсчёт для испытаний (команда: !timer N)</div></div>
                </div>
                <div class="timer-display" id="timerDisplay">${formatTime(streamerState.timerSeconds||0)}</div>
                <div class="input-group" style="margin-bottom:10px">
                    <input type="number" id="timerMinutes" placeholder="Мин" min="0" max="99" value="5" style="max-width:80px">
                    <input type="number" id="timerSeconds2" placeholder="Сек" min="0" max="59" value="0" style="max-width:80px">
                    <button onclick="setTimer()" class="cyber-btn primary-btn">⏱ Установить</button>
                </div>
                <div class="timer-controls">
                    <button onclick="startTimer()"  class="cyber-btn add-btn"    id="timerStartBtn">${streamerState.timerRunning?'⏸️ Пауза':'▶️ Старт'}</button>
                    <button onclick="resetTimer()"  class="cyber-btn danger-btn">🔄 Сброс</button>
                    <button onclick="addTime(30)"   class="cyber-btn">+30с</button>
                    <button onclick="addTime(60)"   class="cyber-btn">+1м</button>
                </div>
                <div style="margin-top:10px;font-size:11px;color:var(--text-muted)">
                    Статистика: ${streamerState.chatStats.totalMessages} сообщений, ${streamerState.chatStats.uniqueViewers} уникальных зрителей
                </div>
            </div>

            <!-- Subscriber Wheel -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">💜</span>
                    <div><div class="streamer-tool-title">КОЛЕСО ПОДПИСЧИКОВ</div><div class="streamer-tool-desc">Рулетка из зрителей (команды: !join, !addchatters)</div></div>
                </div>
                <div class="sub-wheel-section">
                    <div class="input-group" style="margin-bottom:8px">
                        <input type="text" id="subNameInput" placeholder="Ник зрителя..." onkeypress="if(event.key==='Enter')addSubToWheel()">
                        <button onclick="addSubToWheel()" class="cyber-btn add-btn">+ Добавить</button>
                    </div>
                    <div class="sub-list" id="subList">${renderSubList()}</div>
                </div>
                <div class="streamer-tool-actions">
                    <button onclick="spinSubWheel()" class="cyber-btn spin-btn" style="width:100%;font-size:12px;letter-spacing:1px;padding:12px" ${!streamerState.subWheelList.length?'disabled':''}>🎰 Крутить колесо</button>
                </div>
                <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
                    <button onclick="addAllChattersToWheel()" class="cyber-btn primary-btn" style="flex:1;font-size:11px" ${streamerState.twitchStatus!=='connected'?'disabled':''}>👥 Все из чата</button>
                    ${streamerState.subWheelList.length ? `<button onclick="clearSubWheel()" class="cyber-btn danger-btn" style="flex:1;font-size:11px">🗑️ Очистить</button>` : ''}
                </div>
            </div>

            <!-- Quick Commands -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">⚡</span>
                    <div><div class="streamer-tool-title">БЫСТРЫЕ ДЕЙСТВИЯ</div><div class="streamer-tool-desc">Горячие команды для стрима</div></div>
                </div>
                <div class="quick-commands">
                    <button onclick="quickSpin()" class="quick-cmd-btn"><span class="cmd-icon">🎰</span><span class="cmd-label">Крутить!</span></button>
                    <button onclick="quickCopyResult()" class="quick-cmd-btn"><span class="cmd-icon">📋</span><span class="cmd-label">Скоп. результат</span></button>
                    <button onclick="quickShareResult()" class="quick-cmd-btn"><span class="cmd-icon">📤</span><span class="cmd-label">Экспорт</span></button>
                    <button onclick="switchTab('roulette')" class="quick-cmd-btn"><span class="cmd-icon">🎡</span><span class="cmd-label">К рулетке</span></button>
                    <button onclick="quickAddFromChat()" class="quick-cmd-btn"><span class="cmd-icon">💬</span><span class="cmd-label">Задание из чата</span></button>
                    <button onclick="openOverlayWindow()" class="quick-cmd-btn"><span class="cmd-icon">🖥️</span><span class="cmd-label">OBS Overlay</span></button>
                    <button onclick="startVote()" class="quick-cmd-btn"><span class="cmd-icon">🗳️</span><span class="cmd-label">Голосование</span></button>
                    <button onclick="quickResetSession()" class="quick-cmd-btn"><span class="cmd-icon">🔄</span><span class="cmd-label">Новая сессия</span></button>
                </div>
            </div>

            <!-- Chat / Twitch IRC -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">💬</span>
                    <div>
                        <div class="streamer-tool-title">TWITCH ЧАТ</div>
                        <div class="streamer-tool-desc">${streamerState.twitchStatus === 'connected' ? `🟢 #${streamerState.channelName} — онлайн` : 'Реальный Twitch IRC'}</div>
                    </div>
                </div>
                <div class="chat-box" id="chatBox">${renderChatMessages()}</div>
                <!-- Отправка сообщений недоступна без авторизации -->
                <div class="streamer-tool-actions" style="margin-top:8px">
                    <button onclick="sendCommandsList()" class="cyber-btn primary-btn" ${!streamerState.twitchToken || streamerState.twitchStatus!=='connected'?'disabled':''}>📝 Команды</button>
                    <button onclick="clearChat()" class="cyber-btn danger-btn">🗑️ Очистить чат</button>
                </div>
                ${streamerState.chatStats.mostActiveUser ? `<div style="margin-top:8px;font-size:10px;color:var(--text-muted)">Самый активный: ${streamerState.chatStats.mostActiveUser}</div>` : ''}
            </div>

            <!-- Stream Tools -->
            <div class="streamer-tool-card">
                <div class="streamer-tool-header">
                    <span class="streamer-tool-icon">🔧</span>
                    <div><div class="streamer-tool-title">ИНСТРУМЕНТЫ СТРИМА</div><div class="streamer-tool-desc">Дополнительные функции для трансляции</div></div>
                </div>
                <div style="display:grid;gap:8px;margin-bottom:12px">
                    <div style="display:flex;gap:8px;align-items:center">
                        <label style="font-size:12px;min-width:80px">Звук чата:</label>
                        <label class="toggle-switch"><input type="checkbox" ${streamerState.chatSounds||false?'checked':''} onchange="toggleChatSounds(this.checked)"><span class="toggle-slider"></span></label>
                        <span style="font-size:11px;color:var(--text-muted)">Уведомления о сообщениях</span>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center">
                        <label style="font-size:12px;min-width:80px">Авто-спин:</label>
                        <label class="toggle-switch"><input type="checkbox" ${streamerState.autoSpin||false?'checked':''} onchange="toggleAutoSpin(this.checked)"><span class="toggle-slider"></span></label>
                        <span style="font-size:11px;color:var(--text-muted)">Автоматический спин при !spin</span>
                    </div>
                </div>
                <div class="streamer-tool-actions">
                    <button onclick="showStreamStats()" class="cyber-btn">📊 Статистика</button>
                    <button onclick="exportStreamData()" class="cyber-btn export-btn">📤 Экспорт данных</button>
                    <button onclick="resetStreamSession()" class="cyber-btn danger-btn">🔄 Новая сессия</button>
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
                    ? `✅ Чат подключён — зрители пишут <b>1–4</b> для голосования`
                    : `⚠️ Подключите Twitch чат для голосования зрителями`}
            </div>
            <div style="margin-bottom:10px">
                <input type="text" id="voteTitle" placeholder="Тема голосования (необязательно)…"
                    value="${streamerState.voteTitle||''}"
                    oninput="streamerState.voteTitle=this.value"
                    style="width:100%;font-size:12px;padding:8px 12px;border-radius:var(--radius-md);
                           background:var(--bg-input);color:var(--text-primary);
                           border:2px solid var(--border-light);outline:none;box-sizing:border-box"
                    onfocus="this.style.borderColor='var(--border-focus)'"
                    onblur="this.style.borderColor='var(--border-light)'">
            </div>
            <div class="input-group" style="margin-bottom:10px">
                <input type="number" id="voteDuration" placeholder="Сек" min="10" max="300" value="${streamerState.voteDuration}" style="max-width:80px" oninput="streamerState.voteDuration=parseInt(this.value)||30">
                <label style="font-size:12px;color:var(--text-secondary);min-width:auto">сек голосования</label>
            </div>
            <div class="vote-options" style="margin-bottom:12px">
                ${gameOptions.map((g,i) => `
                    <div class="vote-option">
                        <span class="vote-option-key">${i+1}</span>
                        <span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g}</span>
                    </div>`).join('')}
                ${!gameOptions.length ? '<div style="font-size:12px;color:var(--text-muted)">Добавьте игры для голосования</div>' : ''}
            </div>
            <button onclick="startVote()" class="cyber-btn add-btn" style="width:100%" ${!gameOptions.length || !isReal ? 'disabled' : ''}>
                ${isReal ? '▶️ Начать голосование' : '🔌 Сначала подключите чат'}
            </button>`;
    }

    const opts  = streamerState.voteOptions || [];
    const votes = streamerState.voteVotes   || {};
    const total = Object.values(votes).reduce((s,v) => s + v.count, 0) || 1;
    const voterCount = Object.keys(streamerState.voteVoters || {}).length;
    const titleHtml = streamerState.voteTitle
        ? `<div style="font-size:13px;font-weight:700;color:var(--accent-primary);
                       text-align:center;margin-bottom:8px;padding:6px 10px;
                       background:rgba(99,102,241,0.1);border-radius:var(--radius-sm);
                       border:1px solid rgba(99,102,241,0.2);word-break:break-word">
               🗳️ ${streamerState.voteTitle}
           </div>`
        : '';

    return `
        ${titleHtml}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div class="vote-timer ${streamerState.voteTimer<=5?'urgent':''}" id="voteCountdown" style="font-size:24px;margin:0">${streamerState.voteTimer}с</div>
            <div style="font-size:11px;color:var(--text-secondary);text-align:right">
                👥 Проголосовало: <b>${voterCount}</b>
            </div>
        </div>
        <div class="vote-options">
            ${opts.map((o,i) => {
                const cnt = votes[i+1]?.count || 0;
                const pct = Math.round((cnt / total) * 100);
                return `<div class="vote-option">
                    <span class="vote-option-key">${i+1}</span>
                    <div style="flex:1;min-width:0">
                        <span style="font-size:11px;font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o}</span>
                        <div class="vote-option-bar">
                            <div class="vote-option-fill" id="vf${i}" style="width:${pct}%"></div>
                        </div>
                    </div>
                    <span class="vote-option-count" id="vc${i}">${cnt} (${pct}%)</span>
                </div>`;
            }).join('')}
        </div>
        <button onclick="stopVote()" class="cyber-btn danger-btn" style="width:100%;margin-top:10px">⏹️ Завершить</button>`;
}

function startVote() {
    const gameOptions = Object.keys(games).slice(0, 4);
    if (!gameOptions.length) return showNotification('Добавьте игры для голосования', 'error');
    if (!streamerState.connected) return showNotification('Сначала подключитесь к Twitch-каналу', 'warning');

    // Сохраняем тему из поля ввода если оно ещё в DOM
    const titleInput = document.getElementById('voteTitle');
    if (titleInput) streamerState.voteTitle = titleInput.value.trim();
    
    streamerState.voteOptions   = gameOptions;
    streamerState.voteVotes     = {};
    streamerState.voteVoters    = {};      // кто уже проголосовал
    streamerState.voteActive    = true;
    streamerState.voteTimer     = streamerState.voteDuration || 30;
    gameOptions.forEach((_,i) => { streamerState.voteVotes[i+1] = { option: gameOptions[i], count: 0 } });

    const titleMsg = streamerState.voteTitle ? ` "${streamerState.voteTitle}"` : '';
    showNotification(`🗳️ Голосование${titleMsg} началось! Зрители пишут 1–${gameOptions.length} в чате`, 'success');

    // Передаём данные голосования в overlay через localStorage
    try {
        localStorage.setItem('overlayState', JSON.stringify({
            type:    'vote',
            title:   streamerState.voteTitle || '',
            options: gameOptions.map(g => ({ name: g, count: 0 })),
            timer:   streamerState.voteDuration || 30
        }));
    } catch(e) {}

    streamerState.voteInterval = setInterval(() => {
        streamerState.voteTimer--;
        
        // Обновляем таймер
        const cd = document.getElementById('voteCountdown');
        if (cd) { cd.textContent = streamerState.voteTimer + 'с'; cd.className = `vote-timer${streamerState.voteTimer <= 5 ? ' urgent' : ''}` }
        // Перерисовываем только бары голосов без полного ре-рендера
        _refreshVoteBars();
        if (streamerState.voteTimer <= 0) stopVote();
    }, 1000);

    const va = document.getElementById('voteArea');
    if (va) va.innerHTML = renderVoteArea();
}

function _refreshVoteBars() {
    const opts   = streamerState.voteOptions || [];
    const votes  = streamerState.voteVotes   || {};
    const total  = Object.values(votes).reduce((s,v) => s + v.count, 0) || 1;
    opts.forEach((_, i) => {
        const cnt = votes[i+1]?.count || 0;
        const pct = Math.round((cnt / total) * 100);
        const fill = document.getElementById(`vf${i}`);
        const cnt_el = document.getElementById(`vc${i}`);
        if (fill)   fill.style.width   = pct + '%';
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
        const message = `🏆 Победитель: ${winner} с ${maxVotes} голос${maxVotes===1?'':'ов'} от ${voterCount} зрителей`;
        showNotification(message, 'success');

        // Передаём победителя в overlay
        try {
            localStorage.setItem('overlayState', JSON.stringify({
                type: 'winner',
                name: winner,
                from: `из голосования · ${voterCount} зрит. · ${streamerState.voteTitle||''}`
            }));
        } catch(e) {}
    } else {
        showNotification('Голосование завершено без голосов', 'info');
        try {
            localStorage.setItem('overlayState', JSON.stringify({ type: 'idle' }));
        } catch(e) {}
    }
}

// Timer functions
function setTimer() {
    const m = parseInt(document.getElementById('timerMinutes')?.value) || 0;
    const s = parseInt(document.getElementById('timerSeconds2')?.value) || 0;
    streamerState.timerSeconds = m*60 + s;
    streamerState.timerInitial = streamerState.timerSeconds;
    updateTimerDisplay();
}
function startTimer() {
    if (streamerState.timerRunning) {
        clearInterval(streamerState.timerInterval); streamerState.timerInterval = null;
        streamerState.timerRunning = false;
        const btn = document.getElementById('timerStartBtn'); if (btn) btn.textContent = '▶️ Старт';
        return;
    }
    if (streamerState.timerSeconds <= 0) return showNotification('Установите время', 'warning');
    streamerState.timerRunning = true;
    const btn = document.getElementById('timerStartBtn'); if (btn) btn.textContent = '⏸️ Пауза';
    streamerState.timerInterval = setInterval(() => {
        if (streamerState.timerSeconds > 0) { streamerState.timerSeconds--; updateTimerDisplay() }
        else {
            clearInterval(streamerState.timerInterval); streamerState.timerInterval = null;
            streamerState.timerRunning = false;
            const b = document.getElementById('timerStartBtn'); if (b) b.textContent = '▶️ Старт';
            playWinSound(); showNotification('⏱️ Время вышло!', 'warning');
        }
    }, 1000);
}
function resetTimer() {
    if (streamerState.timerInterval) { clearInterval(streamerState.timerInterval); streamerState.timerInterval = null }
    streamerState.timerRunning = false;
    streamerState.timerSeconds = streamerState.timerInitial || 0;
    const btn = document.getElementById('timerStartBtn'); if (btn) btn.textContent = '▶️ Старт';
    updateTimerDisplay();
}
function addTime(secs) {
    streamerState.timerSeconds += secs;
    updateTimerDisplay();
    showNotification(`+${secs}с добавлено`, 'info');
}
function updateTimerDisplay() {
    const d = document.getElementById('timerDisplay'); if (!d) return;
    const t = streamerState.timerSeconds;
    d.textContent = formatTime(t);
    d.className = `timer-display ${t<=30&&t>10?'warning':''} ${t<=10&&t>0?'danger':''}`;
}
function formatTime(s) {
    const m = Math.floor(s/60), sec = s%60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// Subscriber wheel
function renderSubList() {
    const chatParticipants = getChatParticipants(1);
    const activeCount = chatParticipants.length;
    
    if (!streamerState.subWheelList.length) {
        return `
            <span style="font-size:11px;color:var(--text-muted)">Добавьте зрителей...</span>
            ${activeCount > 0 ? `<div style="margin-top:6px;font-size:10px;color:var(--text-secondary)">💬 ${activeCount} активных в чате</div>` : ''}
        `;
    }
    
    return `
        ${streamerState.subWheelList.map((n,i)=>`<span class="sub-tag" onclick="removeSubFromWheel(${i})" title="Удалить">${n} ×</span>`).join('')}
        ${activeCount > 0 ? `<div style="margin-top:8px;font-size:10px;color:var(--text-secondary)">💬 ${activeCount} активных участников в чате доступно</div>` : ''}
    `;
}
function addSubToWheel() {
    const inp = document.getElementById('subNameInput'); if (!inp) return;
    const name = inp.value.trim(); if (!name) return;
    streamerState.subWheelList.push(name); inp.value = '';
    const sl = document.getElementById('subList'); if (sl) sl.innerHTML = renderSubList();
    const spinBtn = document.querySelector('.spin-btn[disabled]'); // enable if any
    switchTab('streamer'); // refresh
    showNotification(`💜 ${name} добавлен в колесо`, 'info');
}
function removeSubFromWheel(i) {
    streamerState.subWheelList.splice(i, 1);
    switchTab('streamer');
}
function clearSubWheel() {
    streamerState.subWheelList = []; switchTab('streamer');
    showNotification('Список подписчиков очищен', 'info');
}
function spinSubWheel() {
    if (!streamerState.subWheelList.length) return showNotification('Добавьте зрителей', 'error');
    const winner = streamerState.subWheelList[Math.floor(Math.random()*streamerState.subWheelList.length)];
    playWinSound();
    if (rouletteSettings.particleEffect) createParticles();
    showNotification(`🎉 Победитель: ${winner}!`, 'success');
    // Create a quick result display
    const modal = document.getElementById('confirmModal');
    if (modal) {
        document.getElementById('modalTitle').textContent = '🎉 Победитель определён!';
        document.getElementById('modalMessage').innerHTML = `<div style="text-align:center;padding:20px"><div style="font-size:48px;margin-bottom:16px">🏆</div><div style="font-size:24px;font-weight:700;color:var(--accent-primary)">${winner}</div><div style="font-size:13px;color:var(--text-muted);margin-top:8px">из ${streamerState.subWheelList.length} зрителей</div></div>`;
        document.getElementById('modalConfirm').textContent = 'ОК';
        document.getElementById('modalConfirm').onclick = closeModal;
        const cb = modal.querySelector('.cancel-btn'); if (cb) cb.style.display='none';
        modal.classList.remove('hidden');
    }
}

// Chat functions
function renderChatMessages() {
    const isReal = streamerState.twitchStatus === 'connected';
    const msgs   = streamerState.chatMessages;
    if (!msgs.length) {
        return `<div style="color:var(--text-muted);font-size:11px;padding:8px;text-align:center">
            ${isReal ? '⏳ Ожидание сообщений из чата...' : '💬 Подключите чат чтобы видеть сообщения'}
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
    const colors = ['#818cf8','#34d399','#fbbf24','#f472b6','#67e8f9','#a3e635'];
    const msgObj = {
        user: streamerState.channelName || 'Стример',
        text,
        color: colors[Math.floor(Math.random()*colors.length)],
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

    showNotification('📝 Список команд добавлен в локальный чат', 'info');
}

function clearChat() {
    streamerState.chatMessages = [];
    streamerState.chatStats.totalMessages = 0;
    streamerState.chatStats.uniqueViewers = 0;
    streamerState.chatStats.mostActiveUser = '';
    saveStreamerData();
    
    const cb = document.getElementById('chatBox'); 
    if (cb) cb.innerHTML = renderChatMessages();
    showNotification('Чат очищен', 'info');
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
        // Автоматический спин без перехода на вкладку
        if (spinning) return showNotification('Рулетка уже крутится', 'warning');
        startSpin();
        // Отправка в чат недоступна без авторизации
    } else {
        // Обычный переход на вкладку рулетки
        switchTab('roulette'); 
        setTimeout(() => {
            startSpin();
            // Отправка в чат недоступна без авторизации
        }, 400);
    }
}
function quickCopyResult() {
    const rc = document.getElementById('resultContent');
    if (!rc || !rc.textContent.trim()) return showNotification('Нет результата для копирования', 'warning');
    navigator.clipboard.writeText(rc.innerText).then(()=>showNotification('📋 Скопировано!','success')).catch(()=>showNotification('Ошибка копирования','error'));
}
function quickShareResult() { exportResults() }
function quickAddFromChat() {
    const game = Object.keys(games)[0];
    if (!game) return showNotification('Сначала добавьте игру', 'warning');
    const chatTasks = ['Играй одной рукой','Без звука 5 минут','Поменяй управление','Игра вслепую 2 минуты'];
    const task = chatTasks[Math.floor(Math.random()*chatTasks.length)];
    games[game].push(task); saveAll();
    showNotification(`✅ Задание "${task}" добавлено в ${game}`, 'success');
}
function quickResetSession() {
    showConfirmModal('🔄 Новая сессия', 'Сбросить текущую сессию игры?','СБРОСИТЬ','ОТМЕНА',()=>{
        resetGameFirstMode();
        showNotification('🔄 Сессия сброшена, можно начинать заново!','success');
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
        .then(()=>showNotification('📋 URL скопирован! Вставьте в OBS Browser Source','success'))
        .catch(()=>showNotification('Ошибка копирования','error'));
}
function openOverlayWindow() {
    const url = getOverlayUrl();
    const w = window.open(url, 'obs-overlay');
    if (!w) {
        // Если браузер заблокировал popup — показываем инструкцию
        showNotification('🚫 Popup заблокирован. Скопируйте URL и откройте вручную или в OBS.', 'warning');
    } else {
        showNotification('🖥️ Overlay открыт. Добавьте URL в OBS Browser Source.', 'info');
    }
}
function toggleChromaKey() {
    rouletteSettings.chromaKey = !rouletteSettings.chromaKey; saveSettings();
    showNotification(rouletteSettings.chromaKey?'🟢 Chroma Key включён':'Chroma Key выключен','info');
    switchTab('streamer');
}
function showOverlaySettings() {
    showConfirmModal('🖥️ OBS Overlay',
        'Откройте overlay.html как Browser Source в OBS. Рекомендуемый размер: 400×400px. Включите Chroma Key если нужен прозрачный фон.',
        'ОТКРЫТЬ','ОТМЕНА', openOverlayWindow);
}

// ── STATS TAB ─────────────────────────────────────────────
function renderStatsTab() {
    const gTotal = Object.keys(games).length;
    const tTotal = Object.values(games).reduce((s,t)=>s+t.length,0);
    const pTotal = players.length;
    const topPlayer = players.reduce((mx,p)=>(p.stats?.gamesPlayed||(0))>(mx?.stats?.gamesPlayed||0)?p:mx, null);
    const bigGame = Object.entries(games).reduce((mx,[g,t])=>t.length>(mx?.[1]?.length||0)?[g,t]:mx,null);
    return `<div class="stats-panel">
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${gTotal}</div><div class="stat-label">Игр</div></div>
            <div class="stat-card"><div class="stat-value">${tTotal}</div><div class="stat-label">Заданий</div></div>
            <div class="stat-card"><div class="stat-value">${pTotal}</div><div class="stat-label">Игроков</div></div>
            <div class="stat-card"><div class="stat-value">${players.reduce((s,p)=>s+(p.stats?.gamesPlayed||0),0)}</div><div class="stat-label">Кручений</div></div>
        </div>
        ${topPlayer ? `<div class="top-player">
            <h3>👑 Самый активный игрок</h3>
            <div class="player-highlight"><span class="highlight-name">${topPlayer.name}</span> — <span class="highlight-stats">${topPlayer.stats?.gamesPlayed||0} кручений</span></div>
        </div>` : ''}
        ${bigGame ? `<div class="top-player" style="border-color:var(--accent-success)">
            <h3>🎮 Самая большая игра</h3>
            <div class="player-highlight"><span class="highlight-name">${bigGame[0]}</span> — <span class="highlight-stats">${bigGame[1].length} заданий</span></div>
        </div>` : ''}
        <div class="players-stats">
            <h3>📊 Статистика игроков</h3>
            ${pTotal===0 ? '<p class="empty-text">Нет данных</p>' : players.map(p=>{
                const plays = p.stats?.gamesPlayed||0;
                const maxP  = Math.max(...players.map(x=>x.stats?.gamesPlayed||0), 1);
                const pct   = Math.min(Math.round((plays/maxP)*100), 100);
                const cd    = playerColors[p.color]||playerColors.indigo;
                return `<div class="player-stats-row">
                    <span class="player-stats-name" style="color:${cd.name}">${p.name}</span>
                    <div class="stats-bar"><div class="stats-fill" style="width:${pct}%;background:${cd.gradient}"></div></div>
                    <span class="player-stats-count">${plays} игр</span>
                </div>`;
            }).join('')}
        </div>
        <div class="players-stats">
            <h3>🎮 Игры по количеству заданий</h3>
            ${gTotal===0 ? '<p class="empty-text">Нет игр</p>' : Object.entries(games).sort(([,a],[,b])=>b.length-a.length).map(([g,t],i)=>{
                const maxT = Math.max(...Object.values(games).map(x=>x.length), 1);
                const pct  = Math.round((t.length/maxT)*100);
                const colors = COLOR_SCHEMES.default;
                return `<div class="player-stats-row">
                    <span class="player-stats-name">${g}</span>
                    <div class="stats-bar"><div class="stats-fill" style="width:${pct}%;background:${colors[i%colors.length]}"></div></div>
                    <span class="player-stats-count">${t.length} зад.</span>
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

// ── SETTINGS TAB ──────────────────────────────────────────
function renderSettingsTab() {
    return `<div class="settings-panel">
        <div class="settings-header"><h2>⚙️ Продвинутые настройки</h2><p>Полная кастомизация рулетки под любой стиль игры</p></div>
        <div class="settings-subtabs">
            <button onclick="switchSettingsTab('speed')"    class="settings-subtab ${settingsSubTab==='speed'?'active':''}">🎯 Скорость</button>
            <button onclick="switchSettingsTab('sound')"    class="settings-subtab ${settingsSubTab==='sound'?'active':''}">🔊 Звук</button>
            <button onclick="switchSettingsTab('wheel')"    class="settings-subtab ${settingsSubTab==='wheel'?'active':''}">🎡 Колесо</button>
            <button onclick="switchSettingsTab('effects')"  class="settings-subtab ${settingsSubTab==='effects'?'active':''}">✨ Эффекты</button>
            <button onclick="switchSettingsTab('gamer')"    class="settings-subtab ${settingsSubTab==='gamer'?'active':''}">🎮 Геймер</button>
            <button onclick="switchSettingsTab('streamer')" class="settings-subtab ${settingsSubTab==='streamer'?'active':''}">📡 Стример</button>
            <button onclick="switchSettingsTab('theme')"    class="settings-subtab ${settingsSubTab==='theme'?'active':''}">🎨 Темы</button>
        </div>
        <div id="settingsContent">${renderSettingsContent()}</div>
        <div class="settings-actions">
            <button onclick="resetSettings()" class="cyber-btn danger-btn">🔄 Сбросить всё</button>
            <button onclick="applySettings()"  class="cyber-btn add-btn">✅ Применить</button>
            <button onclick="exportSettings()" class="cyber-btn export-btn">📤 Экспорт настроек</button>
            <button onclick="importSettings()" class="cyber-btn import-btn">📥 Импорт настроек</button>
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
    return {speed:'🎯',sound:'🔊',wheel:'🎡',effects:'✨',gamer:'🎮',streamer:'📡',theme:'🎨'}[n]||'';
}

function renderSettingsContent() {
    switch(settingsSubTab) {
        case 'speed':    return renderSpeedSettings();
        case 'sound':    return renderSoundSettings();
        case 'wheel':    return renderWheelSettings();
        case 'effects':  return renderEffectsSettings();
        case 'gamer':    return renderGamerSettings();
        case 'streamer': return renderStreamerSettings();
        case 'theme':    return renderThemeSettings();
        default:         return renderSpeedSettings();
    }
}

function renderSpeedSettings() {
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">🎯 СКОРОСТЬ И ФИЗИКА</span></h3>
        <div class="settings-group">
            ${rangeItem('spinDuration','Длительность кручения',rouletteSettings.spinDuration,2000,15000,500,'spinDuration',v=>v/1000+'с')}
            ${rangeItem('minSpins','Минимум оборотов',rouletteSettings.minSpins,1,15,1,'minSpins')}
            ${rangeItem('maxSpins','Максимум оборотов',rouletteSettings.maxSpins,5,30,1,'maxSpins')}
            <div class="setting-item">
                <label>Анимация вращения</label>
                <select onchange="updateSetting('wheelAnimation',this.value)" style="flex:1;max-width:200px">
                    <option value="ease"    ${rouletteSettings.wheelAnimation==='ease'?'selected':''}>Плавная (ease)</option>
                    <option value="bounce"  ${rouletteSettings.wheelAnimation==='bounce'?'selected':''}>Упругая (bounce)</option>
                    <option value="elastic" ${rouletteSettings.wheelAnimation==='elastic'?'selected':''}>Пружинная (elastic)</option>
                    <option value="linear"  ${rouletteSettings.wheelAnimation==='linear'?'selected':''}>Линейная</option>
                </select>
            </div>
            ${rangeItem('announceDelay','Задержка результата (мс)',rouletteSettings.announceDelay,0,3000,100,'announceDelay',v=>v+'мс')}
        </div>
    </div>`;
}

function renderSoundSettings() {
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">🔊 ЗВУК И АУДИО</span></h3>
        <div class="settings-group">
            ${toggleItem('soundEnabled','Включить звук',rouletteSettings.soundEnabled)}
            ${rangeItem('soundVolume','Громкость',Math.round(rouletteSettings.soundVolume*100),0,100,5,'soundVolume',v=>v+'%')}
            ${toggleItem('tickSoundEnabled','Тик при сегменте',rouletteSettings.tickSoundEnabled)}
            ${toggleItem('winSoundEnabled','Звук победы',rouletteSettings.winSoundEnabled)}
            <div class="setting-item">
                <label>Тип звука кручения</label>
                <select onchange="updateSetting('spinSoundType',this.value)" style="flex:1;max-width:200px">
                    <option value="whoosh" ${rouletteSettings.spinSoundType==='whoosh'?'selected':''}>Вращение (whoosh)</option>
                    <option value="drum"   ${rouletteSettings.spinSoundType==='drum'?'selected':''}>Барабан</option>
                    <option value="casino" ${rouletteSettings.spinSoundType==='casino'?'selected':''}>Казино</option>
                </select>
            </div>
        </div>
    </div>`;
}

function renderWheelSettings() {
    const schemes = Object.keys(COLOR_SCHEMES);
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">🎡 ВНЕШНИЙ ВИД КОЛЕСА</span></h3>
        <div class="settings-group">
            ${rangeItem('wheelSize','Размер колеса',rouletteSettings.wheelSize,280,620,20,'wheelSize',v=>v+'px')}
            ${rangeItem('fontSize','Размер текста',rouletteSettings.fontSize,8,18,1,'fontSize',v=>v+'px')}
            ${rangeItem('maxSegments','Макс. сегментов',rouletteSettings.maxSegments,4,32,2,'maxSegments')}
            ${toggleItem('groupSegments','Группировать сегменты',rouletteSettings.groupSegments)}
            <div class="setting-item">
                <label>Иконка центра</label>
                <input type="text" id="centerIconInput" value="${rouletteSettings.centerIcon||'🎲'}" maxlength="2" oninput="updateSetting('centerIcon',this.value);renderWheel()" style="max-width:80px;text-align:center;font-size:20px">
            </div>
            <div class="setting-item">
                <label>Стиль границы</label>
                <select onchange="updateSetting('borderStyle',this.value);renderWheel()" style="flex:1;max-width:200px">
                    <option value="glow"   ${rouletteSettings.borderStyle==='glow'?'selected':''}>Свечение</option>
                    <option value="solid"  ${rouletteSettings.borderStyle==='solid'?'selected':''}>Сплошная</option>
                    <option value="dashed" ${rouletteSettings.borderStyle==='dashed'?'selected':''}>Пунктир</option>
                    <option value="neon"   ${rouletteSettings.borderStyle==='neon'?'selected':''}>Неон</option>
                </select>
            </div>
            <div class="setting-item">
                <label>Стиль указателя</label>
                <div class="pointer-styles">
                    ${['arrow','triangle','diamond','star','pin'].map(s=>`<button onclick="updateSetting('pointerStyle','${s}');document.getElementById('wheelPointer').textContent=getPointerSymbol()" class="pointer-style-btn ${rouletteSettings.pointerStyle===s?'active':''}"><span class="pointer-style-symbol">${{arrow:'▼',triangle:'▽',diamond:'◆',star:'★',pin:'📍'}[s]}</span><span class="pointer-style-label">${s}</span></button>`).join('')}
                </div>
            </div>
        </div>
        <h3 class="section-title" style="margin-top:16px"><span class="neon-text">🎨 ЦВЕТОВЫЕ СХЕМЫ</span></h3>
        <div class="color-schemes">
            ${schemes.map(k=>{
                const dots = (COLOR_SCHEMES[k]||[]).slice(0,5);
                return `<div class="color-scheme-card ${rouletteSettings.colorScheme===k?'active':''}" onclick="updateSetting('colorScheme','${k}');updateWheelSegments();renderWheel();document.querySelectorAll('.color-scheme-card').forEach(c=>c.classList.remove('active'));this.classList.add('active')">
                    <div class="color-scheme-dots">${dots.map(c=>`<div class="color-scheme-dot" style="background:${c}"></div>`).join('')}</div>
                    <div class="color-scheme-name">${k}</div>
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

function renderEffectsSettings() {
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">✨ ВИЗУАЛЬНЫЕ ЭФФЕКТЫ</span></h3>
        <div class="settings-group">
            ${toggleItem('visualEffects','Визуальные эффекты',rouletteSettings.visualEffects)}
            ${toggleItem('highlightWinner','Подсветка победителя',rouletteSettings.highlightWinner)}
            ${toggleItem('shakeEffect','Тряска при остановке',rouletteSettings.shakeEffect)}
            ${toggleItem('glowEffect','Свечение колеса',rouletteSettings.glowEffect)}
            ${toggleItem('particleEffect','Частицы победы',rouletteSettings.particleEffect)}
            ${rangeItem('particleCount','Количество частиц',rouletteSettings.particleCount,10,80,5,'particleCount')}
            <div class="setting-item">
                <label>Стиль частиц</label>
                <select onchange="updateSetting('particleStyle',this.value)" style="flex:1;max-width:200px">
                    <option value="circle"   ${rouletteSettings.particleStyle==='circle'?'selected':''}>Кружки</option>
                    <option value="star"     ${rouletteSettings.particleStyle==='star'?'selected':''}>Звёзды</option>
                    <option value="confetti" ${rouletteSettings.particleStyle==='confetti'?'selected':''}>Конфетти</option>
                </select>
            </div>
            <div class="setting-item">
                <label>Показ результата</label>
                <select onchange="updateSetting('resultDisplay',this.value)" style="flex:1;max-width:200px">
                    <option value="both"  ${rouletteSettings.resultDisplay==='both'?'selected':''}>Popup + Карточка</option>
                    <option value="popup" ${rouletteSettings.resultDisplay==='popup'?'selected':''}>Только Popup</option>
                    <option value="card"  ${rouletteSettings.resultDisplay==='card'?'selected':''}>Только Карточка</option>
                </select>
            </div>
            ${toggleItem('autoClosePopup','Автозакрытие popup',rouletteSettings.autoClosePopup)}
            ${rangeItem('popupDuration','Время показа popup',rouletteSettings.popupDuration,2000,15000,500,'popupDuration',v=>v/1000+'с')}
        </div>
    </div>`;
}

function renderGamerSettings() {
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">🎮 НАСТРОЙКИ ГЕЙМЕРА</span><span class="section-badge">PRO</span></h3>
        <div class="settings-group">
            ${toggleItem('bonusRoundEnabled','🎉 Бонус-раунд (двойная рулетка)',rouletteSettings.bonusRoundEnabled)}
            ${rangeItem('bonusRoundChance','Шанс бонус-раунда',rouletteSettings.bonusRoundChance,1,50,1,'bonusRoundChance',v=>v+'%')}
            ${toggleItem('weightedSegments','⚖️ Взвешенные сегменты',rouletteSettings.weightedSegments)}
            ${toggleItem('blacklistEnabled','🚫 Чёрный список заданий',rouletteSettings.blacklistEnabled)}
            <div class="setting-item">
                <label style="min-width:140px">Чёрный список (по строкам)</label>
                <textarea id="blacklistInput" placeholder="Задание 1&#10;Задание 2" rows="4" style="flex:1">${(rouletteSettings.blacklistTasks||[]).join('\n')}</textarea>
            </div>
            <div class="setting-item">
                <label></label>
                <button onclick="saveBlacklist()" class="cyber-btn add-btn">💾 Сохранить чёрный список</button>
            </div>
        </div>
    </div>`;
}

function renderStreamerSettings() {
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">📡 НАСТРОЙКИ СТРИМЕРА</span><span class="section-badge">LIVE</span></h3>
        <div class="settings-group">
            ${toggleItem('showPlayerOnWheel','Имена игроков на колесе',rouletteSettings.showPlayerOnWheel)}
            ${toggleItem('chromaKey','🟢 Chroma Key для overlay',rouletteSettings.chromaKey)}
            <div class="setting-item">
                <label>Позиция overlay</label>
                <select onchange="updateSetting('overlayPosition',this.value)" style="flex:1;max-width:220px">
                    <option value="top-left"     ${rouletteSettings.overlayPosition==='top-left'?'selected':''}>Верх-лево</option>
                    <option value="top-right"    ${rouletteSettings.overlayPosition==='top-right'?'selected':''}>Верх-право</option>
                    <option value="bottom-left"  ${rouletteSettings.overlayPosition==='bottom-left'?'selected':''}>Низ-лево</option>
                    <option value="bottom-right" ${rouletteSettings.overlayPosition==='bottom-right'?'selected':''}>Низ-право</option>
                    <option value="center"       ${rouletteSettings.overlayPosition==='center'?'selected':''}>По центру</option>
                </select>
            </div>
        </div>
    </div>`;
}

function renderThemeSettings() {
    const themes = [
        { id:'dark',     icon:'🌑', name:'Тёмная'     },
        { id:'neon',     icon:'💜', name:'Неон'        },
        { id:'cyber',    icon:'🔵', name:'Кибер'       },
        { id:'streamer', icon:'📡', name:'Стример'     },
        { id:'pastel',   icon:'🌸', name:'Пастель'     },
    ];
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">🎨 ТЕМЫ ОФОРМЛЕНИЯ</span></h3>
        <div class="color-schemes">
            ${themes.map(t=>`<div class="color-scheme-card ${currentTheme===t.id?'active':''}" onclick="applyTheme('${t.id}');document.querySelectorAll('.color-scheme-card').forEach(c=>c.classList.remove('active'));this.classList.add('active')">
                <div style="font-size:28px;margin-bottom:6px">${t.icon}</div>
                <div class="color-scheme-name">${t.name}</div>
            </div>`).join('')}
        </div>
        <p style="font-size:11px;color:var(--text-muted);margin-top:12px">Тема применяется сразу и сохраняется при перезагрузке страницы</p>
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
        <label class="toggle-switch"><input type="checkbox" ${val?'checked':''} onchange="updateSetting('${key}',this.checked)"><span class="toggle-slider"></span></label>
    </div>`;
}

function updateSetting(key, value) {
    const prev = rouletteSettings[key];
    if (typeof prev === 'number') value = Number(value);
    if (typeof prev === 'boolean') value = Boolean(value);
    rouletteSettings[key] = value; saveSettings();
    const el = document.getElementById(key);
    if (el && el.type === 'range') {
        const rv = document.getElementById('rv_'+key) || el.parentElement?.querySelector('.range-value');
        if (rv) {
            if (key==='spinDuration'||key==='popupDuration') rv.textContent=value/1000+'с';
            else if (key==='soundVolume') rv.textContent=Math.round(value*100)+'%';
            else if (key==='wheelSize'||key==='fontSize') rv.textContent=value+'px';
            else if (key==='bonusRoundChance') rv.textContent=value+'%';
            else if (key==='announceDelay') rv.textContent=value+'мс';
            else rv.textContent=value;
        }
    }
    if (key==='wheelSize') {
        const cv = document.getElementById('rouletteWheel');
        if (cv) { cv.width=Number(value); cv.height=Number(value); renderWheel() }
    }
}
function saveBlacklist() {
    const inp = document.getElementById('blacklistInput');
    if (!inp) return;
    rouletteSettings.blacklistTasks = inp.value.split('\n').map(t=>t.trim()).filter(t=>t);
    saveSettings(); showNotification(`🚫 Чёрный список сохранён (${rouletteSettings.blacklistTasks.length} зад.)`, 'success');
}
function applySettings() { saveSettings(); updateWheelSegments(); renderWheel(); showNotification('✅ Настройки применены!', 'success') }
function resetSettings() {
    showConfirmModal('🔄 Сброс настроек','Сбросить все настройки к стандартным?','СБРОСИТЬ','ОТМЕНА',()=>{
        rouletteSettings = { spinDuration:5000,minSpins:5,maxSpins:10,soundEnabled:true,soundVolume:0.5,tickSoundEnabled:true,winSoundEnabled:true,spinSoundType:'whoosh',visualEffects:true,highlightWinner:true,shakeEffect:true,glowEffect:true,particleEffect:true,particleCount:30,particleStyle:'circle',wheelSize:420,fontSize:12,groupSegments:true,maxSegments:14,colorScheme:'default',borderStyle:'glow',centerIcon:'🎲',pointerStyle:'arrow',wheelAnimation:'ease',resultDisplay:'both',autoClosePopup:true,popupDuration:6000,showPlayerOnWheel:false,announceDelay:0,overlayPosition:'top-left',chromaKey:false,bonusRoundEnabled:false,bonusRoundChance:10,weightedSegments:false,blacklistEnabled:false,blacklistTasks:[] };
        saveSettings(); switchTab('settings'); showNotification('Настройки сброшены', 'success');
    });
}
function exportSettings() {
    const blob = new Blob([JSON.stringify(rouletteSettings,null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='roulette-settings.json'; a.click();
    showNotification('📤 Настройки экспортированы', 'success');
}
function importSettings() {
    const inp = document.createElement('input'); inp.type='file'; inp.accept='.json';
    inp.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = ev => {
            try {
                const d = JSON.parse(ev.target.result);
                rouletteSettings = {...rouletteSettings, ...d};
                saveSettings(); switchTab('settings');
                showNotification('📥 Настройки импортированы', 'success');
            } catch { showNotification('Ошибка импорта', 'error') }
        };
        r.readAsText(f);
    };
    inp.click();
}

// ── SOUND ENGINE ──────────────────────────────────────────
function initAudio() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)() } catch(e){} } }

function playSpinSound() {
    if (!rouletteSettings.soundEnabled) return;
    try {
        initAudio(); if (!audioCtx) return;
        const type = rouletteSettings.spinSoundType || 'whoosh';
        if (type === 'casino') { playCasinoSpinSound(); return }
        if (type === 'drum')   { playDrumSpinSound(); return }
        // whoosh
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sawtooth'; filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, audioCtx.currentTime); filter.frequency.linearRampToValueAtTime(400, audioCtx.currentTime+2.5);
        osc.frequency.setValueAtTime(500, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime+2.5);
        gain.gain.setValueAtTime(0.06*rouletteSettings.soundVolume, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime+2.5);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+2.5);
    } catch(e){}
}
function playCasinoSpinSound() {
    try {
        initAudio(); if (!audioCtx) return;
        for (let i=0;i<3;i++) {
            setTimeout(()=>{
                const o=audioCtx.createOscillator(),g=audioCtx.createGain();
                o.connect(g);g.connect(audioCtx.destination);
                o.type='triangle'; o.frequency.setValueAtTime(300+i*100,audioCtx.currentTime);
                g.gain.setValueAtTime(0.07*rouletteSettings.soundVolume,audioCtx.currentTime); g.gain.linearRampToValueAtTime(0,audioCtx.currentTime+0.3);
                o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime+0.3);
            },i*80);
        }
    } catch(e){}
}
function playDrumSpinSound() {
    try {
        initAudio(); if (!audioCtx) return;
        const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.3,audioCtx.sampleRate);
        const d=buf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(audioCtx.sampleRate*0.05));
        const src=audioCtx.createBufferSource(),g=audioCtx.createGain();
        src.buffer=buf; src.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.3*rouletteSettings.soundVolume,audioCtx.currentTime);
        src.start(audioCtx.currentTime);
    } catch(e){}
}
function playTickSound() {
    if (!rouletteSettings.soundEnabled || !rouletteSettings.tickSoundEnabled) return;
    try {
        initAudio(); if (!audioCtx) return;
        const o=audioCtx.createOscillator(),g=audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.type='sine'; o.frequency.setValueAtTime(900,audioCtx.currentTime); o.frequency.linearRampToValueAtTime(250,audioCtx.currentTime+0.07);
        g.gain.setValueAtTime(0.07*rouletteSettings.soundVolume,audioCtx.currentTime); g.gain.linearRampToValueAtTime(0,audioCtx.currentTime+0.1);
        o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime+0.1);
    } catch(e){}
}
function playWinSound() {
    if (!rouletteSettings.soundEnabled || !rouletteSettings.winSoundEnabled) return;
    try {
        initAudio(); if (!audioCtx) return;
        const notes=[{f:523,d:0.15,t:0},{f:659,d:0.15,t:0.15},{f:784,d:0.15,t:0.3},{f:1047,d:0.5,t:0.45}];
        notes.forEach(({f,d,t})=>{
            const o=audioCtx.createOscillator(),g=audioCtx.createGain(),fl=audioCtx.createBiquadFilter();
            o.connect(fl); fl.connect(g); g.connect(audioCtx.destination);
            fl.type='lowpass'; fl.frequency.setValueAtTime(2000,audioCtx.currentTime+t);
            o.type='triangle'; o.frequency.setValueAtTime(f,audioCtx.currentTime+t);
            g.gain.setValueAtTime(0,audioCtx.currentTime+t); g.gain.linearRampToValueAtTime(0.12*rouletteSettings.soundVolume,audioCtx.currentTime+t+0.02); g.gain.linearRampToValueAtTime(0,audioCtx.currentTime+t+d);
            o.start(audioCtx.currentTime+t); o.stop(audioCtx.currentTime+t+d+0.1);
        });
    } catch(e){}
}

// ── NOTIFICATIONS ─────────────────────────────────────────
function showNotification(msg, type='info') {
    const c = document.getElementById('notifications'); if (!c) return;
    const n = document.createElement('div');
    n.className = `notification notification-${type}`; n.textContent = msg;
    c.appendChild(n);
    setTimeout(()=>{ n.style.animation='slideOut 0.3s ease forwards'; setTimeout(()=>n.remove(),300) }, 3200);
}

// ── EXPORT / IMPORT ───────────────────────────────────────
function exportData() {
    const data = { players, games, rouletteMode, rouletteSettings, currentTheme, exportDate: new Date().toISOString(), version:'3.0' };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    a.download = `challenge-hub-v3-${Date.now()}.json`; a.click();
    showNotification('📤 Данные экспортированы', 'success');
}
function importData() {
    const inp = document.createElement('input'); inp.type='file'; inp.accept='.json';
    inp.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = ev => {
            try {
                const d = JSON.parse(ev.target.result);
                if (d.players && d.games) {
                    players = d.players; games = d.games;
                    if (d.rouletteMode) rouletteMode = d.rouletteMode;
                    if (d.rouletteSettings) rouletteSettings = {...rouletteSettings,...d.rouletteSettings};
                    if (d.currentTheme) applyTheme(d.currentTheme);
                    saveAll(); saveSettings(); switchTab(currentTab);
                    showNotification('📥 Данные импортированы', 'success');
                } else showNotification('Неверный формат файла', 'error');
            } catch { showNotification('Ошибка импорта', 'error') }
        };
        r.readAsText(f);
    };
    inp.click();
}
function exportResults() {
    if (!gameFirstState.selectedGame) { showNotification('Нет результатов для экспорта', 'warning'); return }
    let text = `🎮 RANDOM CHALLENGE HUB v3.0\n${'─'.repeat(40)}\nИгра: ${gameFirstState.selectedGame}\nДата: ${new Date().toLocaleString()}\n${'─'.repeat(40)}\n📋 ЗАДАНИЯ:\n`;
    Object.entries(gameFirstState.assignedTasks).forEach(([p,t],i) => { text += `${i+1}. ${p} → ${t}\n` });
    text += `${'─'.repeat(40)}\nИтого: ${Object.keys(gameFirstState.assignedTasks).length} из ${players.length} игроков\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    a.download = `results-${gameFirstState.selectedGame}-${Date.now()}.txt`; a.click();
    showNotification('📤 Результаты экспортированы', 'success');
}

// ── SCROLL HELPER ─────────────────────────────────────────
function scrollToTabs() {
    document.getElementById('mainPanel')?.scrollIntoView({behavior:'smooth'});
}

// ── DEFAULT GAMES DATA ────────────────────────────────────
function getDefaultGames() {
    return {
    "Minecraft": [
        "Построй самый уродливый дом и защищай его как замок",
        "Играй без оружия одну ночь","Укради один блок из дома друга",
        "10 минут используй только деревянные инструменты","Построй памятник самому бесполезному предмету",
        "Засели дом только котами","Построй копию дома друга, но специально плохо",
        "Проведи экскурсию по базе голосом ведущего ТВ","Выживи ночь без брони",
        "Добывай ресурсы только лопатой","Построй тайную базу рядом с другом",
        "Сделай другу сундук с бесполезным подарком","Построй дом только из одного типа блока",
        "Построй трон для самого слабого моба","Поставь кровать в максимально опасном месте",
        "Стань фермером на 20 минут","Сделай ловушку для друга без урона",
        "Построй базу под землёй","Построй дом на дереве"
    ],
    "CS2": [
        "Беги через мид первым","Играй только с Desert Eagle","Давай команде странные приказы",
        "После смерти комментируй игру как киберспортсмен","Прыгай перед каждым контактом",
        "Купи AWP, но используй только нож","Каждый раунд иди первым","Играй как настоящий бот",
        "Первый раунд только нож","Каждый раунд говори фейковый план","Играй раунд без брони",
        "После смерти анализируй свою ошибку","Используй только пистолет","Играй с неудобным сенсом",
        "Каждый килл сопровождай смешным звуком","После каждого раунда говори мотивацию"
    ],
    "Apex": [
        "Прыгай в самое горячее место","Используй первое найденное оружие","Играй максимально агрессивно",
        "Будь телохранителем тиммейта","Каждый файт начинай с гранаты","Не бери любимое оружие",
        "Стань главным медиком команды","Играй легендой которую никогда не выбирал",
        "Не бери броню первые 5 минут","После убийства делай речь победителя","Всегда иди первым",
        "Используй только одно оружие","Не используй ультимейт 10 минут","Играй максимально рискованно"
    ],
    "Valorant": [
        "Играй только с классическим пистолетом","Каждый раунд говори название операции",
        "Используй способности максимально странно","Иди первым на точку",
        "Играй агента которого не знаешь","После каждого килла делай победную речь",
        "Никаких способностей целый раунд","Только нож первые 30 секунд"
    ],
    "Fortnite": [
        "Приземлись туда, где больше всего врагов","Используй только первое найденное оружие",
        "Построй максимально бесполезную базу","Сделай рискованный пуш на врагов",
        "Играй без любимого оружия","Победи используя максимально странную тактику"
    ],
    "Overwatch 2": [
        "Играй персонажем которого не умеешь","Каждый ульт объявляй как супергерой",
        "Защищай одного выбранного тиммейта","Играй ролью которую обычно не выбираешь",
        "После смерти объясняй свою ошибку","Попробуй сделать самый красивый момент игры"
    ],
    "Rocket League": [
        "Играй только через красивые удары","Минуту не используй ускорение","Играй роль вратаря",
        "После каждого гола делай победную речь","Прыгай перед каждым ударом",
        "Попытайся забить самый нелепый гол"
    ],
    };
}

// ── START ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);