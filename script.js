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
// Safe Loading from localStorage with Protection Against Corrupted Data
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
let games = {}; // Initialized in init() — normalization is done there

let currentTab = 'games';
let spinning = false;
let wheelSegments = [];
let currentWheelAngle = 0;
let animationId = null;
let rouletteMode = 'full';
let lastWinnerSegIdx = -1;          // winning segment index for the removal animation
let segmentScales = [];          // the scale of each segment (1 = normal, 0 = removed)
let openDropdowns = {};
let modalCallback = null;
let audioCtx = null;
let currentTheme = localStorage.getItem('appTheme') || 'dark';
let settingsSubTab = 'speed';

// Spent tasks — elimination mode: { gameName: [task, ...], ... }
let spentTasks = _safeParse('spentTasks', {});
let spinHistory = _safeParse('spinHistory', []);
let taskDrawCount = _safeParse('taskDrawCount', {});
let bonusPending = false;

function activePlayers() { return players.filter(p => p.active !== false); }
function gid(name) { let h = 5381; const s = String(name); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'g' + (h >>> 0).toString(36); }
function isBlocked(task) {
    if (!rouletteSettings.blacklistEnabled) return false;
    const x = String(task).trim().toLowerCase();
    return (rouletteSettings.blacklistTasks || []).some(b => String(b).trim().toLowerCase() === x);
}
function taskWeight(game, task) {
    if (!rouletteSettings.weightedSegments) return 1;
    const c = taskDrawCount[game + '\u241f' + task] || 0;
    return Math.max(0.2, 1 / (1 + c));
}

// ── SECURITY UTILITIES ────────────────────────────────────
// HTML Escaping for Safely Inserting User Data into innerHTML
function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// Escaping for inserting a string into onclick="..." attributes
function escAttr(str) {
    return esc(str).replace(/`/g, '&#x60;');
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
const ROULETTE_DEFAULTS = {
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
    centerIcon: 'dice-3-fill',
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
    removeAfterSpin: false, // Remove the task from the wheel after each scroll
    wheelBulbs: true,       // marquee bulb ring
    overlayWheel: true,     // replay the spin in the OBS overlay
};
let rouletteSettings = Object.assign({}, ROULETTE_DEFAULTS, _safeParse('rouletteSettings', {}));

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
    indigo: { gradient: 'linear-gradient(135deg,#6366f1,#818cf8)', border: '#6366f1', name: '#818cf8', label: 'Indigo' },
    purple: { gradient: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', border: '#8b5cf6', name: '#a78bfa', label: 'Purple' },
    emerald: { gradient: 'linear-gradient(135deg,#10b981,#34d399)', border: '#10b981', name: '#34d399', label: 'Emerald' },
    amber: { gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', border: '#f59e0b', name: '#fbbf24', label: 'Amber' },
    rose: { gradient: 'linear-gradient(135deg,#ec4899,#f472b6)', border: '#ec4899', name: '#f472b6', label: 'Pink' },
    cyan: { gradient: 'linear-gradient(135deg,#06b6d4,#67e8f9)', border: '#06b6d4', name: '#67e8f9', label: 'Cyan' },
    orange: { gradient: 'linear-gradient(135deg,#f97316,#fb923c)', border: '#f97316', name: '#fb923c', label: 'Orange' },
    lime: { gradient: 'linear-gradient(135deg,#84cc16,#a3e635)', border: '#84cc16', name: '#a3e635', label: 'Lime' },
    twitch: { gradient: 'linear-gradient(135deg,#9147ff,#bf94ff)', border: '#9147ff', name: '#bf94ff', label: 'Twitch color' },
};

// ── INIT ──────────────────────────────────────────────────
function init() {
    const ls = document.querySelector('.loading-screen');
    if (ls) ls.remove();

    initStreamer();

    // Loading and Normalizing Game Data
    const rawGames = JSON.parse(localStorage.getItem('challengeGames'));
    if (rawGames && typeof rawGames === 'object') {
        Object.entries(rawGames).forEach(([gameName, tasks]) => {
            if (!Array.isArray(tasks)) return;
            const normalized = tasks.map(t =>
                typeof t === 'string' ? t : (t && typeof t.task === 'string' ? t.task : String(t))
            ).filter(t => t && t.trim());
            // Removing Duplicate Tasks
            games[gameName] = [...new Set(normalized)];
        });
    }
    if (!Object.keys(games).length) {
        games = getDefaultGames();
    }

    // Loading the task-only mode state
    const savedTaskOnlyState = localStorage.getItem('taskOnlyState');
    if (savedTaskOnlyState) {
        try {
            const data = JSON.parse(savedTaskOnlyState);
            taskOnlyState = { ...taskOnlyState, ...data };
        } catch (e) {
            console.warn('Ошибка загрузки taskOnlyState:', e);
        }
    }

    // Load the saved roulette mode
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
    if (location.hash === '#auction') switchTab('auction');
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
            <button class="floating-btn main-btn" onclick="toggleFloatingMenu()" title="${t('floating.settings')}"><i class="bi bi-gear-fill" aria-hidden="true"></i></button>
            <div class="floating-menu hidden" id="floatingMenu">
                <button onclick="confirmClearCache()"  class="floating-menu-btn">${t('floating.clear_cache')}</button>
                <button onclick="confirmResetAll()"    class="floating-menu-btn">${t('floating.reset_all')}</button>
                <button onclick="window.scrollTo({top:0,behavior:'smooth'})" class="floating-menu-btn">${t('floating.scroll_top')}</button>
                <button onclick="switchTab('settings')"  class="floating-menu-btn">${t('floating.settings')}</button>
                <button onclick="switchTab('roulette')"  class="floating-menu-btn">${t('floating.roulette')}</button>
                <button onclick="switchTab('auction')"   class="floating-menu-btn"><i class="bi bi-hammer" aria-hidden="true"></i> ${t('tab.auction')}</button>
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
    btn.textContent = confirmTxt || 'CONFIRM';
    const cancelBtn = modal.querySelector('.cancel-btn');
    if (cancelBtn) cancelBtn.textContent = cancelTxt || 'CANCEL';
    modalCallback = onConfirm;
    btn.onclick = () => { if (modalCallback) modalCallback(); closeModal() };
    modal.classList.remove('hidden');
}
/** Text-input dialog in the project's modal style (replaces window.prompt). */
function showPromptModal(title, msg, value, onOk, okTxt) {
    let m = document.getElementById('promptModal');
    if (!m) {
        m = document.createElement('div'); m.id = 'promptModal'; m.className = 'modal hidden';
        m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
        m.innerHTML = '<div class="modal-content"><h3 id="pmTitle"></h3><p id="pmMsg"></p><input type="text" id="pmInput" maxlength="80" autocomplete="off"><div class="modal-actions"><button type="button" class="cyber-btn cancel-btn" id="pmCancel"></button><button type="button" class="cyber-btn primary-btn" id="pmOk"></button></div></div>';
        document.body.appendChild(m);
        m.addEventListener('click', e => { if (e.target === m || e.target.closest('#pmCancel')) m.classList.add('hidden'); });
        m.addEventListener('keydown', e => {
            if (e.key === 'Escape') m.classList.add('hidden');
            if (e.key === 'Enter' && e.target.id === 'pmInput') { e.preventDefault(); document.getElementById('pmOk').click(); }
        });
    }
    document.getElementById('pmTitle').textContent = title || '';
    document.getElementById('pmMsg').textContent = msg || '';
    document.getElementById('pmMsg').hidden = !msg;
    const inp = document.getElementById('pmInput'); inp.value = value || '';
    document.getElementById('pmCancel').textContent = t('common.cancel');
    const ok = document.getElementById('pmOk'); ok.textContent = okTxt || t('common.confirm');
    ok.onclick = () => { const v = inp.value; m.classList.add('hidden'); if (onOk) onOk(v); };
    m.classList.remove('hidden'); setTimeout(() => { inp.focus(); inp.select(); }, 30);
}
/** Message dialog in the project's modal style (replaces window.alert). */
function showAlertModal(title, msg) {
    let m = document.getElementById('alertModal');
    if (!m) {
        m = document.createElement('div'); m.id = 'alertModal'; m.className = 'modal hidden';
        m.setAttribute('role', 'alertdialog'); m.setAttribute('aria-modal', 'true');
        m.innerHTML = '<div class="modal-content"><h3 id="amTitle"></h3><p id="amMsg"></p><div class="modal-actions"><button type="button" class="cyber-btn primary-btn" id="amOk"></button></div></div>';
        document.body.appendChild(m);
        m.addEventListener('click', e => { if (e.target === m || e.target.id === 'amOk') m.classList.add('hidden'); });
        m.addEventListener('keydown', e => { if (e.key === 'Escape') m.classList.add('hidden'); });
    }
    document.getElementById('amTitle').textContent = title || '';
    document.getElementById('amMsg').textContent = msg || '';
    document.getElementById('amOk').textContent = t('common.ok') === 'common.ok' ? 'OK' : t('common.ok');
    m.classList.remove('hidden'); setTimeout(() => document.getElementById('amOk').focus(), 30);
}
function closeModal() {
    document.getElementById('confirmModal')?.classList.add('hidden');
    document.getElementById('promptModal')?.classList.add('hidden');
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
    spinHistory = []; taskDrawCount = {}; localStorage.removeItem('spinHistory'); localStorage.removeItem('taskDrawCount');
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
            <button class="cyber-tab${tab === 'games' ? ' active' : ''}"    data-tab="games"    onclick="switchTab('games')">   <span class="tab-icon"><i class="bi bi-controller" aria-hidden="true"></i></span> ${t('tab.games')}</button>
            <button class="cyber-tab${tab === 'players' ? ' active' : ''}"  data-tab="players"  onclick="switchTab('players')"> <span class="tab-icon"><i class="bi bi-people-fill" aria-hidden="true"></i></span> ${t('tab.players')} <span class="tab-badge" id="playersBadge">${players.length}</span></button>
            <button class="cyber-tab${tab === 'roulette' ? ' active' : ''}" data-tab="roulette" onclick="switchTab('roulette')"><span class="tab-icon"><i class="bi bi-dice-5-fill" aria-hidden="true"></i></span> ${t('tab.roulette')}</button>
            <button class="cyber-tab${tab === 'auction' ? ' active' : ''}"  data-tab="auction"  onclick="switchTab('auction')"><span class="tab-icon"><i class="bi bi-hammer" aria-hidden="true"></i></span> <span class="tab-label">${t('tab.auction')}</span></button>
            <button class="cyber-tab${tab === 'streamer' ? ' active' : ''}" data-tab="streamer" onclick="switchTab('streamer')"><span class="tab-icon"><i class="bi bi-broadcast" aria-hidden="true"></i></span> ${t('tab.streamer')}</button>
            <button class="cyber-tab${tab === 'stats' ? ' active' : ''}"    data-tab="stats"    onclick="switchTab('stats')">   <span class="tab-icon"><i class="bi bi-bar-chart-fill" aria-hidden="true"></i></span> ${t('tab.stats')}</button>
            <button class="cyber-tab${tab === 'settings' ? ' active' : ''}" data-tab="settings" onclick="switchTab('settings')"><span class="tab-icon"><i class="bi bi-gear-fill" aria-hidden="true"></i></span> ${t('tab.settings')}</button>
        </div>
        <div class="tab-content" id="tabContent"></div>
    `;
    switchTab(tab);
}

function switchTab(name) {
    currentTab = name;
    if (name !== 'roulette') {
        // Stop the animation and reset the rotation state
        if (animationId) { cancelAnimationFrame(animationId); animationId = null }
        if (spinning) {
            spinning = false;
            // The button will be recreated the next time the roulette is rendered—here, we simply clear the flag
        }
        gameFirstState.active = false;
        // Hide the results popup when switching tabs
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
        streamer: () => { content.innerHTML = renderStreamerTab(); setTimeout(afterStreamerRender, 30); },
        auction: () => { content.innerHTML = renderAuctionTab(); setTimeout(afterAuctionRender, 30); },
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
        if (dd) { dd.classList.remove('hidden'); if (ar) ar.textContent = biChar('caret-down-fill') }
    });
}
function toggleGameDropdown(gameName) {
    const sid = gid(gameName);
    const dd = document.getElementById(`dropdown_${sid}`);
    const ar = document.getElementById(`arrow_${sid}`);
    if (!dd) return;
    const hidden = dd.classList.contains('hidden');
    if (hidden) {
        document.querySelectorAll('.tasks-dropdown').forEach(d => { if (d.id !== `dropdown_${sid}`) d.classList.add('hidden') });
        document.querySelectorAll('.dropdown-arrow').forEach(a => { if (a.id !== `arrow_${sid}`) a.textContent = biChar('caret-right-fill') });
        dd.classList.remove('hidden'); if (ar) ar.textContent = biChar('caret-down-fill'); openDropdowns[sid] = true;
    } else { dd.classList.add('hidden'); if (ar) ar.textContent = biChar('caret-right-fill'); openDropdowns[sid] = false }
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
            <button onclick="exportData()" class="cyber-btn export-btn"><i class="bi bi-box-arrow-up" aria-hidden="true"></i> ${t('common.export')}</button>
            <button onclick="importData()" class="cyber-btn import-btn"><i class="bi bi-box-arrow-in-down" aria-hidden="true"></i> ${t('common.import')}</button>
            <button onclick="showBulkAddModal()" class="cyber-btn primary-btn">${t('games.bulk_add')}</button>
        </div>
    </div>`;
}

function renderGamesList() {
    if (!Object.keys(games).length) return `<p class="empty-text">${t('games.empty_games')}</p>`;
    return Object.entries(games).map(([game, tasks]) => {
        const sid = gid(game);
        const escGame = esc(game);
        return `<div class="game-card">
            <div class="game-header" data-game="${escGame}" onclick="toggleGameDropdown(this.dataset.game)">
                <div class="game-header-left">
                    <span class="dropdown-arrow" id="arrow_${sid}"><i class="bi bi-caret-right-fill" aria-hidden="true"></i></span>
                    <h4 class="game-name"><i class="bi bi-controller" aria-hidden="true"></i> ${escGame}</h4>
                </div>
                <div class="game-header-right">
                    <span class="task-count">${t('games.tasks_count', { n: tasks.length })}</span>
                    <button data-game="${escGame}" onclick="event.stopPropagation();deleteGame(this.dataset.game)" class="delete-btn"><i class="bi bi-trash3" aria-hidden="true"></i></button>
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
    const sid = gid(gameName);
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
                return `<div class="player-card ${p.active === false ? 'inactive' : ''}" style="border-color:${esc(cd.name)}">
                            <div class="player-avatar" style="background:${esc(cd.gradient)}">${esc(Array.from(p.name)[0].toUpperCase())}</div>
                            <div class="player-info">
                                <span class="player-name" style="color:${esc(cd.name)}">${esc(p.name)}</span>
                                <span class="player-color">${t('color.' + p.color) || esc(cd.label)}</span>
                                <span class="player-stats-mini">${t('players.stats_mini', { g: p.stats?.gamesPlayed || 0, t: p.stats?.tasksCompleted || 0 })}</span>
                            </div>
                            <button onclick="togglePlayerActive(${i})" class="icon-btn ${p.active === false ? '' : 'on'}" title="${esc(t('players.toggle_active'))}" aria-pressed="${p.active !== false}">${p.active === false ? bi('pause-fill') : bi('check-lg')}</button>
                            <button onclick="deletePlayer(${i})" class="delete-btn" title="${t('common.delete')}"><i class="bi bi-trash3" aria-hidden="true"></i></button>
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
        const curP = activePlayers()[gameFirstState.currentPlayerIndex];
        const remaining = getRemainingTasksForGame(gameFirstState.selectedGame);
        const assigned = Object.keys(gameFirstState.assignedTasks).length;
        const total = activePlayers().length;
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
                <div class="status-card-icon"><i class="bi bi-controller" aria-hidden="true"></i></div>
                <div class="status-card-content"><span class="status-card-label">${t('roulette.selected_game')}</span><span class="status-card-value">${esc(gameFirstState.selectedGame)}</span></div>
            </div>
            ${curP && !done ? `<div class="status-card current-player-card">
                <div class="status-card-icon"><i class="bi bi-person-fill" aria-hidden="true"></i></div>
                <div class="status-card-content"><span class="status-card-label">${t('roulette.now_spinning')}</span><span class="status-card-value" style="color:${esc(playerColors[curP.color]?.name || '#818cf8')}">${esc(curP.name)}</span></div>
            </div>` : ''}
            <div class="stats-row">
                <div class="stat-mini"><span class="stat-mini-icon"><i class="bi bi-clipboard-check" aria-hidden="true"></i></span><span class="stat-mini-text">${t('roulette.remaining', { n: remaining.length })}</span></div>
                <div class="stat-mini"><span class="stat-mini-icon"><i class="bi bi-check-circle-fill" aria-hidden="true"></i></span><span class="stat-mini-text">${t('roulette.assigned', { n: assigned })}</span></div>
            </div>
            ${assigned > 0 ? `<div class="assigned-tasks-section">
                <div class="section-subtitle" onclick="toggleAssignedTasks()">
                    <span class="dropdown-arrow" id="assignedArrow"><i class="bi bi-caret-right-fill" aria-hidden="true"></i></span><span>${t('roulette.assigned_count', { n: assigned })}</span>
                </div>
                <div class="assigned-tasks-list hidden" id="assignedTasksList">
                    ${Object.entries(gameFirstState.assignedTasks).map(([pn, pt], idx) => {
            const pl = activePlayers().find(p => p.name === pn);
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
                <div class="completion-icon"><i class="bi bi-stars" aria-hidden="true"></i></div>
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
                    <span class="section-icon"><i class="bi bi-controller" aria-hidden="true"></i></span>
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
                    <span class="section-icon"><i class="bi bi-person-fill" aria-hidden="true"></i></span>
                    <span>${t('roulette.select_player_lbl')}</span>
                </div>
                <div class="player-selector-grid">
                    <button onclick="selectPlayerForTaskOnly(this.dataset.playerName || null)"
                            data-player-name=""
                            class="player-selector-btn ${taskOnlyState.selectedPlayer === null ? 'selected' : ''}">
                        <div class="player-selector-name"><i class="bi bi-dice-3-fill" aria-hidden="true"></i> ${t('roulette.any_player')}</div>
                        <div class="player-selector-desc">${t('roulette.any_player_desc')}</div>
                    </button>
                    ${activePlayers().map(player => `
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
                            <div class="status-card-icon"><i class="bi bi-controller" aria-hidden="true"></i></div>
                            <div class="status-card-content">
                                <span class="status-card-label">${t('roulette.selected_game')}</span>
                                <span class="status-card-value">${esc(taskOnlyState.selectedGame)}</span>
                            </div>
                        </div>` : ''}
                    ${taskOnlyState.selectedPlayer !== null ? `
                        <div class="status-card selected-player-card">
                            <div class="status-card-icon"><i class="bi bi-person-fill" aria-hidden="true"></i></div>
                            <div class="status-card-content">
                                <span class="status-card-label">${t('roulette.now_spinning')}</span>
                                <span class="status-card-value" style="color:${esc(taskOnlyState.selectedPlayer ? (playerColors[activePlayers().find(p => p.name === taskOnlyState.selectedPlayer)?.color]?.name || '#818cf8') : '#818cf8')}">${esc(taskOnlyState.selectedPlayer || t('roulette.any_player'))}</span>
                            </div>
                        </div>` : ''}
                    <div class="stats-row">
                        ${taskOnlyState.selectedGame ? `<div class="stat-mini"><span class="stat-mini-icon"><i class="bi bi-clipboard-check" aria-hidden="true"></i></span><span class="stat-mini-text">${t('roulette.assigned', { n: games[taskOnlyState.selectedGame]?.length || 0 })}</span></div>` : ''}
                        <div class="stat-mini"><span class="stat-mini-icon"><i class="bi bi-people-fill" aria-hidden="true"></i></span><span class="stat-mini-text">${t('roulette.assigned', { n: activePlayers().length }).replace(/\d+/, activePlayers().length)}</span></div>
                    </div>
                </div>` : ''}
        </div>`;
    }

    if (!gameFirstState.active && rouletteMode !== 'task-only') {
        if (rouletteMode === 'player-only' && activePlayers().length === 0) {
            canSpin = false; spinTxt = t('roulette.no_players_btn');
        }
        if (rouletteMode === 'game-only' && !Object.keys(games).some(g => games[g].length > 0)) {
            canSpin = false; spinTxt = t('roulette.no_games_only');
        }
    }

    const wsz = rouletteSettings.wheelSize;
    const modeBtn = (id, icon) => `<button onclick="setRouletteMode('${id}')" class="mode-btn ${rouletteMode === id ? 'active' : ''}" aria-pressed="${rouletteMode === id}">
                        <span class="mode-btn-icon">${icon}</span>
                        <span class="mode-btn-text">${t('roulette.mode_' + id.replace('-', '_'))}</span>
                        <span class="mode-btn-desc">${t('roulette.mode_' + id.replace('-', '_') + '_desc')}</span>
                    </button>`;
    return `<div class="roulette-panel">
        <div class="mode-selector">
            <div class="mode-buttons" role="group" aria-label="${esc(t('roulette.mode_label'))}">
                ${modeBtn('full', bi('dice-5-fill'))}${modeBtn('game-first', bi('bullseye'))}${modeBtn('player-only', bi('person-fill'))}${modeBtn('task-only', bi('clipboard-check'))}${modeBtn('game-only', bi('controller'))}
            </div>
        </div>
        <div class="roulette-body">
        <div class="wheel-and-controls">
            <div class="wheel-container" id="wheelContainer" style="${wheelHidden ? 'opacity:0;transform:scale(0.8);pointer-events:none;max-height:0;overflow:hidden;margin:0' : 'opacity:1;transform:scale(1)'}">
                <canvas id="rouletteWheel" width="${wsz}" height="${wsz}" data-size="${wsz}" style="width:min(100%,${wsz}px)" onclick="startSpin()" role="img" aria-label="${esc(t('roulette.mode_label'))}"></canvas>
                <div class="wheel-pointer" id="wheelPointer">${getPointerSymbol()}</div>
            </div>
            <div class="roulette-controls">
                <button onclick="startSpin()" class="cyber-btn spin-btn" ${spinning || !canSpin ? 'disabled' : ''}>${spinTxt}</button>
                ${gameFirstState.active && canSpin ? `<div class="gf-actions"><button onclick="skipGameFirstPlayer()" class="cyber-btn outline-btn"><i class="bi bi-skip-end-fill" aria-hidden="true"></i> ${t('rf.skip_player')}</button><button onclick="resetGameFirstMode()" class="cyber-btn danger-btn outline-btn">${t('roulette.reset_mode')}</button></div>` : ''}
                <p class="spin-hint">${avail.length === 0 ? t('roulette.no_games') : t('roulette.ready', { g: gCount, t: tCount, p: activePlayers().length })}</p>
            </div>
            <div id="spinResult" class="spin-result hidden">
                <div class="result-card"><h3><i class="bi bi-bullseye" aria-hidden="true"></i> ${t('roulette.result_task')}:</h3><div id="resultContent"></div><div id="resultActions"></div></div>
            </div>
        </div>
        <div class="roulette-info">
            <p class="roulette-hint">${getModeHint()}</p>
            ${modeInfo}
            ${!gameFirstState.active ? `<div class="pre-spin-stats">
                <div class="pre-stat-item"><span class="pre-stat-icon"><i class="bi bi-controller" aria-hidden="true"></i></span><span class="pre-stat-text">${t('tab.games')}: <strong>${gCount}</strong></span></div>
                <div class="pre-stat-item"><span class="pre-stat-icon"><i class="bi bi-clipboard-check" aria-hidden="true"></i></span><span class="pre-stat-text">${t('roulette.result_task')}: <strong>${tCount}</strong></span></div>
                <div class="pre-stat-item"><span class="pre-stat-icon"><i class="bi bi-people-fill" aria-hidden="true"></i></span><span class="pre-stat-text">${t('tab.players')}: <strong>${activePlayers().length}</strong></span></div>
            </div>` : ''}
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
    list.classList.toggle('hidden'); arrow.textContent = hidden ? biChar('caret-down-fill') : biChar('caret-right-fill');
}


// ── RESULT ANNOUNCE / HISTORY ─────────────────────────────
function announceResult(game, player, task, duration) {
    rchOverlay({ type: 'result', game: String(game), player: String(player), task: String(task), duration });
    spinHistory.unshift({ ts: Date.now(), mode: rouletteMode, game: String(game), player: String(player), task: String(task) });
    if (spinHistory.length > 200) spinHistory.length = 200;
    if (rouletteMode === 'full' || rouletteMode === 'game-first' || rouletteMode === 'task-only') {
        const k = game + '\u241f' + task; taskDrawCount[k] = (taskDrawCount[k] || 0) + 1;
    }
    try { localStorage.setItem('spinHistory', JSON.stringify(spinHistory)); localStorage.setItem('taskDrawCount', JSON.stringify(taskDrawCount)); } catch (e) { }
    updatePlayerStats(player);
}

// Re-render the side info + controls without touching the wheel or the result card
function refreshRouletteInfo() {
    if (currentTab !== 'roulette') return;
    const tmp = document.createElement('div'); tmp.innerHTML = renderRouletteTab();
    ['.roulette-info', '.roulette-controls', '.mode-selector'].forEach(sel => {
        const a = document.querySelector(sel), b = tmp.querySelector(sel);
        if (a && b) a.innerHTML = b.innerHTML;
    });
    refreshRouletteControls();
}

function advanceGameFirst() {
    const P = activePlayers();
    const nextP = P[gameFirstState.currentPlayerIndex];
    const stillRem = getRemainingTasksForGame(gameFirstState.selectedGame);
    if (!nextP || !stillRem.length) { hideWheelSmoothly(); setTimeout(showFinalResults, 900); return; }
    refreshRouletteInfo();
    updateWheelSegmentsForGame(gameFirstState.selectedGame); renderWheel();
    showNotification(`${biChar('person-fill')} ${t('roulette.now_spinning')}: ${nextP.name}`, 'info');
}
function skipGameFirstPlayer() {
    if (spinning || !gameFirstState.active) return;
    gameFirstState.currentPlayerIndex++;
    advanceGameFirst();
}
function togglePlayerActive(i) {
    if (!players[i]) return;
    players[i].active = players[i].active === false;
    saveAll(); switchTab('players');
}

// ── WHEEL SEGMENTS ────────────────────────────────────────
function getSegmentColor(i, total) {
    const palette = COLOR_SCHEMES[rouletteSettings.colorScheme] || COLOR_SCHEMES.default;
    return palette[i % palette.length];
}

function updateWheelSegments() {
    segmentScales = []; // Reset scales when updating segments
    if (rouletteMode === 'game-first') {
        if (gameFirstState.active && gameFirstState.selectedGame) { updateWheelSegmentsForGame(gameFirstState.selectedGame); return; }
        const gl = Object.keys(games).filter(g => games[g].some(x => !isBlocked(x)));
        wheelSegments = gl.length
            ? gl.map((g, i) => ({ label: g, task: g, game: g, color: getSegmentColor(i, gl.length) }))
            : [{ label: t('wheel.no_tasks'), task: t('wheel.add_tasks'), game: '', color: '#484f58' }];
        return;
    }
    if (rouletteMode === 'player-only') {
        if (!activePlayers().length) {
            wheelSegments = [{ label: t('wheel.no_players'), task: t('wheel.add_players'), game: '', color: '#484f58' }];
            return;
        }
        let availablePlayers = activePlayers();
        if (rouletteSettings.removeAfterSpin) {
            const spent = spentTasks['__players__'] || [];
            availablePlayers = activePlayers().filter(p => !spent.includes(p.name));
            if (!availablePlayers.length) {
                wheelSegments = [{ label: biChar('check-circle-fill'), task: t('wheel.all_done'), game: '', color: '#484f58' }];
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
            wheelSegments = [{ label: biChar('check-circle-fill'), task: t('wheel.all_done'), game: '', color: '#484f58' }];
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
            let selectedTasks = games[taskOnlyState.selectedGame].filter(x => !isBlocked(x));
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
                    color: getSegmentColor(i, selectedTasks.length),
                    weight: taskWeight(taskOnlyState.selectedGame, t)
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
            // Protection against the old data format: a task can be a string or an object
            const taskStr = typeof t === 'string' ? t : (t && typeof t.task === 'string' ? t.task : String(t));
            if (!taskStr || isBlocked(taskStr)) return;
            if (rouletteSettings.removeAfterSpin) {
                const spent = spentTasks[g] || [];
                if (spent.includes(taskStr)) return; // We skip the ones that fell out
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
        // Group by game: one segment = one game
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
            color: getSegmentColor(i, allTasks.length),
            weight: taskWeight(item.game, item.task)
        }));
    }
}

function updateWheelSegmentsForGame(gameName) {
    segmentScales = [];
    const remaining = getRemainingTasksForGame(gameName);
    if (!remaining.length) {
        wheelSegments = [{ label: t('wheel.all_done'), task: t('wheel.all_done_desc'), game: gameName, color: '#484f58' }];
        return;
    }
    wheelSegments = remaining.map((tk, i) => ({ label: `#${i + 1}`, task: tk, game: gameName, color: getSegmentColor(i, remaining.length), weight: taskWeight(gameName, tk) }));
}

function getRemainingTasksForGame(name) {
    const used = Object.values(gameFirstState.assignedTasks);
    let tasks = (games[name] || []).filter(x => !used.includes(x) && !isBlocked(x));
    if (rouletteSettings.removeAfterSpin) {
        const spent = spentTasks[name] || [];
        tasks = tasks.filter(x => !spent.includes(x));
    }
    return tasks;
}

// Mark the task as "completed" for this game
function markTaskSpent(gameName, task) {
    if (!rouletteSettings.removeAfterSpin || !gameName || !task) return;
    if (!spentTasks[gameName]) spentTasks[gameName] = [];
    if (!spentTasks[gameName].includes(task)) {
        spentTasks[gameName].push(task);
        localStorage.setItem('spentTasks', JSON.stringify(spentTasks));
    }
}

// Animation showing a segment gradually shrinking and disappearing
function animateSegmentRemoval(segIdx, duration, callback) {
    if (!rouletteSettings.removeAfterSpin || segIdx < 0 || segIdx >= wheelSegments.length) {
        if (callback) callback();
        return;
    }
    // Initialize the scales of all segments to 1 if they haven't been set yet
    segmentScales = wheelSegments.map((_, i) => segmentScales[i] !== undefined ? segmentScales[i] : 1);

    const startTime = Date.now();
    function step() {
        const t = Math.min((Date.now() - startTime) / duration, 1);
        // easeInOutQuad — starts slowly and ends slowly, without a sudden drop
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

// Calculating the total number of completed tasks
function countSpentTasks() {
    return Object.values(spentTasks).reduce((s, arr) => s + arr.length, 0);
}

// Notification when all game tasks have been completed
function checkAllTasksSpent(gameName) {
    if (!rouletteSettings.removeAfterSpin || !gameName) return;
    const total = (games[gameName] || []).length;
    const spent = (spentTasks[gameName] || []).length;
    if (total > 0 && spent >= total) {
        showNotification(t('notif.all_tasks_spent', { game: gameName }), 'warning');
    }
}

// ── WHEEL RENDER ──────────────────────────────────────────
const CENTER_ICONS = ['dice-3-fill', 'dice-5-fill', 'bullseye', 'controller', 'joystick', 'trophy-fill', 'stars', 'lightning-charge-fill', 'fire', 'heart-fill', 'star-fill', 'gem', 'rocket-takeoff-fill', 'puzzle-fill', 'emoji-sunglasses-fill', 'hammer'];
function pickCenterIcon(name) {
    updateSetting('centerIcon', name);
    document.querySelectorAll('#centerIconPicker .icon-pick').forEach(b => b.classList.toggle('active', b.title === name));
    if (typeof renderWheel === 'function') renderWheel();
}
function getPointerSymbol() {
    const sym = { arrow: 'caret-down-fill', triangle: 'triangle', diamond: 'diamond-fill', star: 'star-fill', pin: 'geo-alt-fill' };
    return biChar(sym[rouletteSettings.pointerStyle] || 'caret-down-fill');
}

function renderWheel() {
    const canvas = document.getElementById('rouletteWheel'); if (!canvas || !wheelSegments.length) return;
    RCHWheel.draw(canvas, wheelSegments, currentWheelAngle, {
        size: rouletteSettings.wheelSize, scales: segmentScales, fontSize: rouletteSettings.fontSize,
        centerIcon: rouletteSettings.centerIcon || 'dice-3-fill', bulbs: rouletteSettings.wheelBulbs !== false, spinning,
        labelOf: seg => seg.isGroup ? `${seg.label} (${seg.items?.length || 0})` : (seg.label || seg.game || ''),
    });
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
    showNotification(`${biChar('dice-3-fill')} ${getModeHint()}`, 'info');
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
        biChar('trash3') + ' ' + t('settings.spent_reset', { n: total }).replace(/^[\uE000-\uF8FF]\s*/, ''),
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
        spinBtn.textContent = `${biChar('dice-5-fill')} ${t('roulette.spinning_for', { name: gameName.toUpperCase() })}`;
    }
    showNotification(t('notif.game_selected', { name: gameName }), 'info');
}

function updateGameSummary(gameName) {
    const summarySection = document.querySelector('.selection-summary');
    if (!summarySection) {
        // If there is no "summary" block, create one
        const taskOnlyStatus = document.querySelector('.task-only-status');
        if (taskOnlyStatus) {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'selection-summary';
            taskOnlyStatus.appendChild(summaryDiv);
        }
    }

    // Update or create a card for the selected game — DOM API, without innerHTML
    let gameCard = document.querySelector('.selected-game-card');
    if (gameCard) {
        const valueSpan = gameCard.querySelector('.status-card-value');
        if (valueSpan) valueSpan.textContent = gameName;
    } else if (gameName) {
        const card = document.createElement('div');
        card.className = 'status-card selected-game-card';
        card.innerHTML = `<div class="status-card-icon"><i class="bi bi-controller" aria-hidden="true"></i></div><div class="status-card-content"><span class="status-card-label">${esc(t('roulette.selected_game'))}</span><span class="status-card-value"></span></div>`;
        card.querySelector('.status-card-value').textContent = gameName;
        const sec = document.querySelector('.selection-summary');
        if (sec) sec.prepend(card);
    }

}

function selectPlayerForTaskOnly(playerName) {
    // null means "random player"; an empty string from the dataset is also null
    if (playerName === '' || playerName === 'null') playerName = null;
    taskOnlyState.selectedPlayer = playerName;
    saveAll();

    // Updating Button Styles Using a Dataset — Safely
    const buttons = document.querySelectorAll('.player-selector-btn');
    buttons.forEach(btn => {
        const btnPlayer = btn.dataset.playerName !== undefined
            ? (btn.dataset.playerName === '' ? null : btn.dataset.playerName)
            : null; // The "Shuffle" button does not have a data-player-name attribute
        btn.classList.toggle('selected', btnPlayer === playerName);
    });

    updatePlayerSummary(playerName);
    showNotification(t('notif.player_selected', { name: playerName || t('roulette.any_player') }), 'info');
}

function updatePlayerSummary(playerName) {
    // Update or create a card for the selected player
    let playerCard = document.querySelector('.selected-player-card');
    if (playerCard) {
        const valueSpan = playerCard.querySelector('.status-card-value');
        if (valueSpan) {
            valueSpan.textContent = playerName || t('roulette.any_player');
            // Update the color for a specific player
            if (playerName) {
                const player = players.find(p => p.name === playerName);
                const color = playerColors[player?.color]?.name || '#818cf8';
                valueSpan.style.color = color;
            } else {
                valueSpan.style.color = '#818cf8';
            }
        }
    } else if (playerName !== null) {
        // Creating a card using the DOM API—without `innerHTML` and with custom data
        const player = players.find(p => p.name === playerName);
        // Color must come only from the allowed playerColors dictionary — safe
        const safeColor = playerColors[player?.color]?.name || '#818cf8';

        const card = document.createElement('div');
        card.className = 'status-card selected-player-card';
        card.innerHTML = `<div class="status-card-icon"><i class="bi bi-person-fill" aria-hidden="true"></i></div><div class="status-card-content"><span class="status-card-label">${esc(t('roulette.now_spinning'))}</span><span class="status-card-value"></span></div>`;
        const val = card.querySelector('.status-card-value');
        val.textContent = playerName || t('roulette.any_player');
        val.style.color = safeColor;

        const sec = document.querySelector('.selection-summary');
        if (sec) {
            const gameCard = sec.querySelector('.selected-game-card');
            gameCard ? gameCard.after(card) : sec.prepend(card);
        }
    }
}

function updateSelectedPlayerInfo(playerName) {
    // I'll leave this function empty, since the logic has been moved to `updatePlayerSummary`
}

function startSpin() {
    if (spinning) return;
    if (rouletteSettings.bonusRoundEnabled && !bonusPending && Math.random() * 100 < rouletteSettings.bonusRoundChance) {
        bonusPending = true;
        showNotification(t('roulette.bonus_round'), 'success');
    }
    executeSpin();
    if (!spinning) bonusPending = false; // validation failed — no bonus
}

function executeSpin() {
    if (spinning) return;
    // Validations
    if (rouletteMode === 'player-only' && activePlayers().length < 1) return showNotification(t('roulette.add_players'), 'error');
    if (rouletteMode === 'game-only') {
        const hasGames = Object.keys(games).some(g => games[g].length > 0);
        if (!hasGames) return showNotification(t('roulette.no_games_only'), 'error');
    }
    if (rouletteMode === 'task-only') {
        if (!taskOnlyState.selectedGame) return showNotification(t('roulette.select_game'), 'error');
        const selectedTasks = games[taskOnlyState.selectedGame];
        if (!selectedTasks || !selectedTasks.length) return showNotification(t('roulette.no_tasks_game'), 'error');
    }
    if (rouletteMode !== 'player-only' && rouletteMode !== 'task-only' && rouletteMode !== 'game-only') {
        if (activePlayers().length < 1) return showNotification(t('roulette.add_players'), 'error');
        const allTasks = Object.values(games).flat();
        if (!allTasks.length) return showNotification(t('roulette.add_tasks'), 'error');
    }
    if (rouletteMode === 'game-first' && gameFirstState.active) {
        const rem = getRemainingTasksForGame(gameFirstState.selectedGame);
        if (!rem.length || Object.keys(gameFirstState.assignedTasks).length >= activePlayers().length) {
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

    // We select a random segment from those actually drawn on the wheel
    const ti = RCHWheel.pickIndex(wheelSegments);
    const winSeg = wheelSegments[ti];

    // If the segment is a group (game), select a random task from it
    let selGame, selTask;
    if (winSeg.isGroup && winSeg.items && winSeg.items.length) {
        const picked = winSeg.items[Math.floor(Math.random() * winSeg.items.length)];
        selGame = picked.game;
        selTask = picked.task;
    } else {
        selGame = winSeg.game;
        selTask = winSeg.task;
    }

    const selPlayer = activePlayers().length ? activePlayers()[Math.floor(Math.random() * activePlayers().length)] : null;

    spinWheel(wheelSegments, ti, () => {
        setTimeout(() => {
            if (rouletteSettings.resultDisplay !== 'popup') showResult(selGame, selPlayer, selTask);
            showPopupResult(selGame, selPlayer, selTask);
            // Display the result in an overlay
            announceResult(selGame, selPlayer?.name || '?', selTask, 12000);
            markTaskSpent(selGame, selTask);
            if (rouletteSettings.removeAfterSpin) {
                animateSegmentRemoval(lastWinnerSegIdx, 900, () => {
                    updateWheelSegments();
                    renderWheel();
                    checkAllTasksSpent(selGame);
                    playWinSound(); finishSpin();
                });
            } else {
                playWinSound(); finishSpin();
            }
        }, rouletteSettings.announceDelay || 0);
    });
}

function spinPlayerOnly() {
    if (!activePlayers().length) { finishSpin(); return }
    updateWheelSegments();
    // If everything is missing, `wheelSegments` contains a placeholder
    if (wheelSegments.length === 1 && wheelSegments[0].task === t('wheel.all_done')) {
        showNotification(t('wheel.all_done'), 'info'); finishSpin(); return;
    }
    const ti = RCHWheel.pickIndex(wheelSegments);
    spinWheel(wheelSegments, ti, () => {
        const seg = wheelSegments[ti];
        const p = activePlayers().find(pl => pl.name === seg?.task) || { name: seg?.task || '?', color: 'indigo', stats: {} };
        setTimeout(() => {
            showPopupResult(biChar('person-fill') + ' ' + t('wheel.player_pick'), p, p.name);
            if (rouletteSettings.resultDisplay !== 'popup') showResult(t('wheel.player_pick'), p, t('results.player_picked', { name: p.name }));
            announceResult(biChar('person-fill') + ' ' + t('wheel.player_pick'), p?.name || '?', `${p?.name || '?'} ${t('results.player_picked', { name: '' }).trim()}`, 10000);
            if (rouletteSettings.removeAfterSpin) {
                markTaskSpent('__players__', p.name);
                animateSegmentRemoval(lastWinnerSegIdx, 900, () => {
                    updateWheelSegments();
                    renderWheel();
                    const spentCount = (spentTasks['__players__'] || []).length;
                    if (spentCount >= activePlayers().length) showNotification(t('wheel.all_done'), 'success');
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
    // If everything fell out
    if (wheelSegments.length === 1 && wheelSegments[0].task === t('wheel.all_done')) {
        showNotification(t('wheel.all_done'), 'info'); finishSpin(); return;
    }

    const ti = RCHWheel.pickIndex(wheelSegments);

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
                            <div class="result-card-icon"><i class="bi bi-controller" aria-hidden="true"></i></div>
                            <div class="result-card-label">${t('roulette.result_game_only')}</div>
                            <div class="result-card-value task-highlight">${esc(selectedGame)}</div>
                        </div>
                    </div>`;
                    if (ra) ra.innerHTML = `<button onclick="startSpin()" class="cyber-btn add-btn">${t('roulette.spin_again')}</button>`;
                    rd.classList.remove('hidden');
                    rd.style.animation = 'none'; void rd.offsetHeight; rd.style.animation = 'fadeInUp 0.5s ease';
                }
            }
            announceResult(selectedGame, '—', t('roulette.result_game_only') + ' ' + selectedGame, 10000);
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
        showNotification(t('roulette.select_game'), 'error');
        finishSpin();
        return;
    }

    // Let's use the filtered list—the same one as on the wheel
    updateWheelSegments();

    // If all tasks have already been used up, `wheelSegments` contains a placeholder
    const availableSegs = wheelSegments.filter(s => s.task && s.task !== t('wheel.all_done_desc'));
    if (!availableSegs.length) {
        showNotification(t('roulette.no_tasks_game'), 'error');
        finishSpin();
        return;
    }

    // Select a random index from `wheelSegments` (already filtered)
    const ti = RCHWheel.pickIndex(wheelSegments);

    // Determining the player: specific or random
    let selectedPlayer;
    if (taskOnlyState.selectedPlayer) {
        // A specific player has been selected
        const foundPlayer = activePlayers().find(p => p.name === taskOnlyState.selectedPlayer);
        selectedPlayer = foundPlayer || { name: taskOnlyState.selectedPlayer, color: 'indigo', stats: {} };
    } else {
        // A random player, or "All" if there are no activePlayers()
        selectedPlayer = activePlayers().length ? activePlayers()[Math.floor(Math.random() * activePlayers().length)] : { name: 'All', color: 'indigo', stats: {} };
    }

    spinWheel(wheelSegments, ti, () => {
        // We retrieve the task directly from the winning segment, `wheelSegments`
        const task = wheelSegments[ti]?.task;
        if (!task) { finishSpin(); return; }
        setTimeout(() => {
            showPopupResult(taskOnlyState.selectedGame, selectedPlayer, task);
            if (rouletteSettings.resultDisplay !== 'popup') showResult(taskOnlyState.selectedGame, selectedPlayer, task);
            // Display the result in an overlay
            announceResult(taskOnlyState.selectedGame, selectedPlayer?.name || '?', task, 12000);
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
    const gamesWithTasks = Object.entries(games).filter(([, ts]) => ts.some(x => !isBlocked(x)));
    if (!gamesWithTasks.length) { showNotification(t('roulette.no_tasks_avail'), 'error'); finishSpin(); return }
    updateWheelSegments(); renderWheel();           // the wheel shows the games
    const ti = RCHWheel.pickIndex(wheelSegments);
    const selGame = wheelSegments[ti].game;
    spinWheel(wheelSegments, ti, () => {
        gameFirstState = { active: true, selectedGame: selGame, currentPlayerIndex: 0, assignedTasks: {} };
        playWinSound();
        updateWheelSegmentsForGame(selGame); renderWheel(); showWheel();
        refreshRouletteInfo();
        rchOverlay({ type: 'winner', name: selGame, from: t('roulette.selected_game') });
        showNotification(`${biChar('controller')} ${t('roulette.selected_game')}: ${selGame}!`, 'success');
        const first = activePlayers()[0];
        if (first) setTimeout(() => showNotification(`${biChar('person-fill')} ${first.name}`, 'info'), 1500);
        finishSpin();
    });
}

function startGameFirstSpin() {
    const curP = activePlayers()[gameFirstState.currentPlayerIndex];
    if (!curP) { hideWheelSmoothly(); setTimeout(showFinalResults, 600); finishSpin(); return }
    const remaining = getRemainingTasksForGame(gameFirstState.selectedGame);
    if (!remaining.length) { hideWheelSmoothly(); setTimeout(showFinalResults, 600); finishSpin(); return }
    updateWheelSegmentsForGame(gameFirstState.selectedGame); renderWheel();
    const ti = RCHWheel.pickIndex(wheelSegments);
    const selTask = wheelSegments[ti].task;
    const game = gameFirstState.selectedGame;
    spinWheel(wheelSegments, ti, () => {
        gameFirstState.assignedTasks[curP.name] = selTask;
        setTimeout(() => {
            gameFirstState.currentPlayerIndex++;   // the result card then offers the NEXT player
            if (rouletteSettings.resultDisplay !== 'popup') showResult(game, curP, selTask);
            showPopupResult(game, curP, selTask);
            announceResult(game, curP.name, selTask, 12000);
            markTaskSpent(game, selTask);
            const after = () => { playWinSound(); advanceGameFirst(); finishSpin(); };
            if (rouletteSettings.removeAfterSpin) animateSegmentRemoval(lastWinnerSegIdx, 900, after); else after();
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
    if (bonusPending) {
        bonusPending = false;
        setTimeout(() => { if (currentTab === 'roulette' && !spinning) executeSpin(); }, 1400);
    }
}

// Updates the roulette control buttons directly in the DOM (without re-rendering the tab)
function refreshRouletteControls() {
    const ctrl = document.querySelector('.roulette-controls');
    if (!ctrl) return;
    // Remove the old reset button and all the `br` tags before it
    ctrl.querySelectorAll('.spent-reset-btn').forEach(b => {
        // Remove the preceding `br` tag, if there is one
        if (b.previousSibling && b.previousSibling.nodeName === 'BR') {
            b.previousSibling.remove();
        }
        b.remove();
    });
    // Add fresh ones if needed
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
    if (!wheelSegments.length) { if (callback) callback(); return }
    lastWinnerSegIdx = targetIdx;
    const spins = rouletteSettings.minSpins + Math.floor(Math.random() * (Math.max(rouletteSettings.maxSpins, rouletteSettings.minSpins) - rouletteSettings.minSpins + 1));
    const totalRot = RCHWheel.targetRotation(wheelSegments, targetIdx, currentWheelAngle, spins, 0.6);
    if (rouletteSettings.soundEnabled) playSpinSound();
    if (rouletteSettings.overlayWheel) {
        const w = wheelSegments[targetIdx];
        publishWheel(t('tab.roulette'), wheelSegments, { startAngle: currentWheelAngle, total: totalRot, duration: rouletteSettings.spinDuration }, w.task || w.label);
    }
    animateWheel(totalRot, callback);
}

// ── Easing functions ──────────────────────────────────────
// easeOutQuint: very smooth deceleration without a sudden stop
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
        if (progress > 0.3 && rouletteSettings.soundEnabled && rouletteSettings.tickSoundEnabled) {
            const seg = RCHWheel.indexAtPointer(wheelSegments, currentWheelAngle);
            if (seg !== lastTickSeg) { lastTickSeg = seg; playTickSound() }
        }

        // Glow effect near the end — gradually increases starting at 70% progress
        if (rouletteSettings.visualEffects && rouletteSettings.glowEffect && progress > 0.7) {
            const t = (progress - 0.7) / 0.3;  // 0→1 in the range of 70–100%
            const g = 6 + t * 22;              // 6px → 28px (soft)
            const o = 0.15 + t * 0.45;          // 0.15 → 0.60 (not too bright)
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
    // Smoothly fade out the glow using a CSS transition
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
    // A smooth, gentle vibration—smaller amplitude, longer decay
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
    // We retrieve the popup from the body (it was moved there during rendering)
    let popup = document.getElementById('wheelResultPopup');
    // If the popup is still inside the `wheel-container`, move it to the `body`
    if (popup && popup.closest('.wheel-container')) {
        document.body.appendChild(popup);
    }
    if (!popup) return;
    if (rouletteSettings.resultDisplay === 'card') { popup.classList.add('hidden'); return }

    const cd = playerColors[player?.color] || playerColors.indigo;
    const pg = popup.querySelector('.popup-game');
    const pp = popup.querySelector('.popup-player');
    const pt = popup.querySelector('.popup-task');

    if (pg) { pg.textContent = ''; typeWriter(pg, `${biChar('controller')} ${game}`, 25) }
    if (pp) { pp.textContent = ''; setTimeout(() => typeWriter(pp, `${biChar('person-fill')} ${player?.name || '?'}`, 25), 260); pp.style.color = cd.name }
    if (pt) { pt.textContent = ''; setTimeout(() => typeWriter(pt, `${biChar('lightning-charge-fill')} ${task}`, 16), 520) }

    // Send the result to the chat
    // The chat send feature is not available without logging in

    // Add a close prompt if there isn't one
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

    // Close by clicking to dim
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
        <div class="result-card-item"><div class="result-card-icon"><i class="bi bi-controller" aria-hidden="true"></i></div><div class="result-card-label">${t('roulette.result_game')}</div><div class="result-card-value">${esc(game)}</div></div>
        <div class="result-card-item"><div class="result-card-icon"><i class="bi bi-person-fill" aria-hidden="true"></i></div><div class="result-card-label">${t('roulette.result_player')}</div><div class="result-card-value" style="color:${esc(cd.name)}">${esc(player?.name || '?')}</div></div>
        <div class="result-card-item"><div class="result-card-icon"><i class="bi bi-lightning-charge-fill" aria-hidden="true"></i></div><div class="result-card-label">${t('roulette.result_task')}</div><div class="result-card-value task-highlight">${esc(task)}</div></div>
    </div>`;
    if (ra) {
        // We use only secure static buttons with no user data in the handlers
        if (gameFirstState.active) {
            const nextP = activePlayers()[gameFirstState.currentPlayerIndex];
            const rem = getRemainingTasksForGame(gameFirstState.selectedGame);
            if (nextP && rem.length > 0) {
                const btn = document.createElement('button');
                btn.className = 'cyber-btn add-btn';
                btn.style.marginTop = '8px';
                btn.textContent = t('roulette.next_player', { name: nextP.name });
                btn.onclick = startSpin;
                ra.innerHTML = '';
                ra.appendChild(btn);
            } else {
                ra.innerHTML = `<button onclick="showFinalResults()" class="cyber-btn add-btn">${t('roulette.all_results')}</button>`;
            }
        } else {
            ra.innerHTML = `<button onclick="startSpin()" class="cyber-btn add-btn">${t('roulette.spin_again')}</button>`;
        }
    }
    rd.classList.remove('hidden'); rd.style.animation = 'none'; void rd.offsetHeight; rd.style.animation = 'fadeInUp 0.5s ease';
}

function showFinalResults() {
    const assigned = Object.keys(gameFirstState.assignedTasks).length;
    if (!assigned && gameFirstState.active) return showNotification(t('rf.none_assigned'), 'warning');
    const unassigned = activePlayers().filter(p => !gameFirstState.assignedTasks[p.name]);
    const rd = document.getElementById('spinResult'), rc = document.getElementById('resultContent'), ra = document.getElementById('resultActions');
    if (!rd || !rc) return;
    rc.innerHTML = `
        <div class="final-result-header">
            <div class="final-game-info"><span class="final-game-icon"><i class="bi bi-controller" aria-hidden="true"></i></span><span class="final-game-name">${esc(gameFirstState.selectedGame)}</span></div>
            <div class="final-stats">
                <span class="final-stat-badge success"><i class="bi bi-check-circle-fill" aria-hidden="true"></i> ${assigned}</span>
                ${unassigned.length ? `<span class="final-stat-badge warning"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> ${unassigned.length}</span>` : ''}
            </div>
        </div>
        <div class="final-results-list">
            <div class="final-results-title"><i class="bi bi-clipboard-check" aria-hidden="true"></i> ${t('rf.assignments')} (${assigned}/${activePlayers().length})</div>
            <div class="final-results-grid">
                ${Object.entries(gameFirstState.assignedTasks).map(([pn, pt], idx) => {
        const pl = activePlayers().find(p => p.name === pn);
        const cd = playerColors[pl?.color] || playerColors.indigo;
        return `<div class="final-result-row"><span class="final-result-number">#${idx + 1}</span><span class="final-result-player" style="color:${esc(cd.name)}">${esc(pn)}</span><span class="final-result-arrow">→</span><span class="final-result-task">${esc(pt)}</span></div>`;
    }).join('')}
            </div>
        </div>
        ${unassigned.length ? `<div class="unassigned-warning"><p class="unassigned-warning-title"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> ${t('rf.unassigned')}</p><div class="unassigned-activePlayers()-list">${unassigned.map(p => `<span class="unassigned-player-tag" style="border-color:${esc(playerColors[p.color]?.name || '#818cf8')};color:${esc(playerColors[p.color]?.name || '#818cf8')}">${esc(p.name)}</span>`).join('')}</div></div>` : ''}
    `;
    if (ra) ra.innerHTML = `<button onclick="resetGameFirstMode()" class="cyber-btn add-btn">${t('results.start_over')}</button><button onclick="exportResults()" class="cyber-btn export-btn">${t('results.export')}</button>`;
    rd.classList.remove('hidden'); rd.style.animation = 'none'; void rd.offsetHeight; rd.style.animation = 'fadeInUp 0.5s ease';
    refreshRouletteInfo(); rd.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

// ── STATS TAB ─────────────────────────────────────────────
function renderStatsTab() {
    const gTotal = Object.keys(games).length;
    const tTotal = Object.values(games).reduce((s, t) => s + t.length, 0);
    const pTotal = players.length;
    const totalSpins = players.reduce((s, p) => s + (p.stats?.gamesPlayed || 0), 0);
    const topPlayer = players.reduce((mx, p) => (p.stats?.gamesPlayed || 0) > (mx?.stats?.gamesPlayed || 0) ? p : mx, null);
    const bigGame = Object.entries(games).reduce((mx, [g, t]) => t.length > (mx?.[1]?.length || 0) ? [g, t] : mx, null);

    // Three Tips of the Day—One from Each Category
    const tipCoop = getDailyTip('coop');
    const tipComp = getDailyTip('comp');
    const tipOnline = getDailyTip('online');
    const tipFact = getDailyTip('fact');
    // We display 3 cards: co-op, competition, fact—they rotate every day
    const dayIdx = Math.floor(Date.now() / 86400000);
    const featuredTips = [tipCoop, tipComp, dayIdx % 2 === 0 ? tipFact : tipOnline];

    return `<div class="stats-panel">

        <!-- Meters -->
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

        ${renderHistoryBlock()}

        <div class="top-player" style="border-color:var(--accent-primary);margin-bottom:0">
            <h3>${t('stats.tips_title')}</h3>
        </div>
        <div class="tips-grid">
            ${featuredTips.map(tip => `
                <div class="tip-card tip-cat-${esc(tip.cat)}">
                    <div class="tip-header">
                        <span class="tip-icon">${bi(tip.icon)}</span>
                        <span class="tip-tag">${esc(tip.tag)}</span>
                    </div>
                    <p class="tip-text">${esc(tip.text)}</p>
                </div>
            `).join('')}
        </div>

        <!-- Tips Filter Buttons -->
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

        <!-- Player Statistics -->
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

        <!-- Task-Based Games -->
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


function renderHistoryBlock() {
    const rows = spinHistory.slice(0, 15);
    return `<div class="players-stats history-block">
        <h3>${t('hist.title')} <span class="section-badge">${spinHistory.length}</span></h3>
        ${rows.length ? `<div class="history-list">${rows.map(h => `<div class="history-row"><span class="history-time">${esc(new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</span>
            <span class="history-game">${esc(h.game)}</span><span class="history-player">${esc(h.player)}</span><span class="history-task">${esc(h.task)}</span></div>`).join('')}</div>
        <div class="panel-actions"><button class="cyber-btn export-btn" onclick="exportHistory()"><i class="bi bi-box-arrow-up" aria-hidden="true"></i> CSV</button><button class="cyber-btn danger-btn" onclick="clearHistory()">${t('hist.clear')}</button></div>`
            : `<p class="empty-text">${t('hist.empty')}</p>`}
    </div>`;
}
function exportHistory() {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const csv = '\ufeff' + ['time,mode,game,player,task'].concat(spinHistory.map(h => [new Date(h.ts).toISOString(), h.mode, h.game, h.player, h.task].map(q).join(','))).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'spin-history-' + Date.now() + '.csv'; a.click();
}
function clearHistory() {
    showConfirmModal(t('hist.clear'), t('hist.clear_msg'), t('common.reset'), t('common.cancel'), () => {
        spinHistory = []; taskDrawCount = {}; localStorage.setItem('spinHistory', '[]'); localStorage.setItem('taskDrawCount', '{}');
        switchTab('stats');
    });
}

// Rendering a list of tips for the filter
function renderTipsList(category) {
    const pool = category === 'all' ? GAMING_TIPS : GAMING_TIPS.filter(t => t.cat === category);
    return pool.map(tip => `
        <div class="tip-list-item">
            <span class="tip-list-icon">${bi(tip.icon)}</span>
            <div class="tip-list-body">
                <span class="tip-list-tag tip-cat-${esc(tip.cat)}-tag">${esc(tip.tag)}</span>
                <p class="tip-list-text">${esc(tip.text)}</p>
            </div>
        </div>`).join('');
}

// Filter tips by category (triggered by onclick)
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
            <button onclick="confirmClearCache()" class="cyber-btn outline-btn">${t('floating.clear_cache')}</button>
            <button onclick="confirmResetAll()" class="cyber-btn danger-btn">${t('floating.reset_all')}</button>
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
    return biChar({ speed: 'bullseye', sound: 'volume-up-fill', wheel: 'pie-chart-fill', effects: 'stars', gamer: 'controller', streamer: 'broadcast', theme: 'palette-fill' }[n] || '');
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
            ${toggleItem('wheelBulbs', t('settings.wheel_bulbs'), rouletteSettings.wheelBulbs)}
            <div class="setting-item">
                <label>${t('settings.center_icon')}</label>
                <div class="icon-picker" id="centerIconPicker" role="group">${CENTER_ICONS.map(n => `<button type="button" class="icon-pick ${(rouletteSettings.centerIcon || 'dice-3-fill') === n ? 'active' : ''}" title="${n}" onclick="pickCenterIcon('${n}')">${bi(n)}</button>`).join('')}</div>
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
                    ${['arrow', 'triangle', 'diamond', 'star', 'pin'].map(s => `<button onclick="updateSetting('pointerStyle','${s}');document.getElementById('wheelPointer').textContent=getPointerSymbol()" class="pointer-style-btn ${rouletteSettings.pointerStyle === s ? 'active' : ''}"><span class="pointer-style-symbol">${bi({ arrow: 'caret-down-fill', triangle: 'triangle', diamond: 'diamond-fill', star: 'star-fill', pin: 'geo-alt-fill' }[s])}</span><span class="pointer-style-label">${s}</span></button>`).join('')}
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
            ${toggleItem('overlayWheel', t('settings.overlay_wheel'), rouletteSettings.overlayWheel)}
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
        { id: 'dark', icon: 'moon-stars-fill', nameKey: 'settings.theme_dark' },
        { id: 'neon', icon: 'heart-fill', nameKey: 'settings.theme_neon' },
        { id: 'cyber', icon: 'circle-fill', nameKey: 'settings.theme_cyber' },
        { id: 'streamer', icon: 'broadcast', nameKey: 'settings.theme_streamer' },
        { id: 'pastel', icon: 'flower1', nameKey: 'settings.theme_pastel' },
    ];
    return `<div class="panel-section">
        <h3 class="section-title"><span class="neon-text">${t('settings.theme_title')}</span></h3>
        <div class="color-schemes">
            ${themes.map(th => `<div class="color-scheme-card ${currentTheme === th.id ? 'active' : ''}" onclick="applyTheme('${th.id}');document.querySelectorAll('.color-scheme-card').forEach(c=>c.classList.remove('active'));this.classList.add('active')">
                <div class="theme-card-icon">${bi(th.icon)}</div>
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
    // soundVolume: slider 0–100, stored as 0–1
    if (key === 'soundVolume') value = value / 100;
    rouletteSettings[key] = value; saveSettings();
    const el = document.getElementById(key);
    if (el && el.type === 'range') {
        const rv = document.getElementById('rv_' + key) || el.parentElement?.querySelector('.range-value');
        if (rv) {
            if (key === 'spinDuration' || key === 'popupDuration') rv.textContent = value / 1000 + t('unit.s');
            else if (key === 'soundVolume') rv.textContent = Math.round(value * 100) + '%';
            else if (key === 'wheelSize' || key === 'fontSize') rv.textContent = value + 'px';
            else if (key === 'bonusRoundChance') rv.textContent = value + '%';
            else if (key === 'announceDelay') rv.textContent = value + t('unit.ms');
            else rv.textContent = value;
        }
    }
    if (key === 'wheelSize') {
        const cv = document.getElementById('rouletteWheel');
        if (cv) { cv.dataset.size = value; cv.style.width = 'min(100%, ' + value + 'px)'; renderWheel() }
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
        rouletteSettings = JSON.parse(JSON.stringify(ROULETTE_DEFAULTS));
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
    showNotification(biChar('box-arrow-up') + ' ' + t('common.export'), 'success');
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
                // Mode and Theme — only valid values
                const safeModes = ['full', 'game-first', 'player-only', 'task-only', 'game-only'];
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
    let text = `RANDOM CHALLENGE HUB v4.0\n${'─'.repeat(40)}\n${t('roulette.selected_game')}: ${gameFirstState.selectedGame}\n${new Date().toLocaleString()}\n${'─'.repeat(40)}\n${t('roulette.result_task').toUpperCase()}:\n`;
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

// Returns the tip of the day (determined by date) or a random one
function getDailyTip(category) {
    const pool = category ? GAMING_TIPS.filter(t => t.cat === category) : GAMING_TIPS;
    if (!pool.length) return GAMING_TIPS[0];
    const dayIndex = Math.floor(Date.now() / 86400000); // changes every day
    return pool[dayIndex % pool.length];
}

// ── DEFAULT GAMES DATA ────────────────────────────────────
function getDefaultGames() {
    return {
    
    };
}

// ── START ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
