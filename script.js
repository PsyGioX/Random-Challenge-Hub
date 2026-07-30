// ==================== RANDOM CHALLENGE HUB - COMPLETE SCRIPT ====================

// Глобальные переменные
let players = JSON.parse(localStorage.getItem('challengePlayers')) || [];
let games = JSON.parse(localStorage.getItem('challengeGames')) || {

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

    ]

};

let currentTab = 'games';
let spinning = false;
let wheelSegments = [];
let currentWheelAngle = 0;
let animationId = null;
let rouletteMode = 'full';

let gameFirstState = {
    active: false,
    selectedGame: null,
    currentPlayerIndex: 0,
    assignedTasks: {}
};

let audioCtx = null;
let modalCallback = null;
let openDropdowns = {};

// Настройки рулетки
let rouletteSettings = JSON.parse(localStorage.getItem('rouletteSettings')) || {
    spinDuration: 5000,
    minSpins: 5,
    maxSpins: 10,
    soundEnabled: true,
    soundVolume: 0.5,
    tickSoundEnabled: true,
    winSoundEnabled: true,
    visualEffects: true,
    highlightWinner: true,
    shakeEffect: true,
    glowEffect: true,
    particleEffect: true,
    autoClosePopup: true,
    popupDuration: 6000,
    wheelSize: 400,
    fontSize: 11,
    groupSegments: true,
    maxSegments: 12,
    colorScheme: 'default',
    pointerStyle: 'arrow',
    resultDisplay: 'both',
};

const playerColors = {
    'indigo': { gradient: 'linear-gradient(135deg, #6366f1, #818cf8)', border: '#6366f1', name: '#6366f1', label: 'Индиго' },
    'purple': { gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', border: '#8b5cf6', name: '#7c3aed', label: 'Фиолетовый' },
    'emerald': { gradient: 'linear-gradient(135deg, #10b981, #34d399)', border: '#10b981', name: '#059669', label: 'Изумрудный' },
    'amber': { gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)', border: '#f59e0b', name: '#d97706', label: 'Янтарный' },
    'rose': { gradient: 'linear-gradient(135deg, #ec4899, #f472b6)', border: '#ec4899', name: '#db2777', label: 'Розовый' }
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function init() {
    const loadingScreen = document.querySelector('.loading-screen');
    if (loadingScreen) loadingScreen.remove();
    createTabs();
    createFloatingButton();
    document.addEventListener('click', (e) => { if (e.target.classList.contains('modal')) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

// ==================== ПЛАВАЮЩАЯ КНОПКА ====================
function createFloatingButton() {
    const existing = document.querySelector('.floating-actions');
    if (existing) existing.remove();
    const floatingHTML = `
        <div class="floating-actions">
            <button class="floating-btn main-btn" onclick="toggleFloatingMenu()" title="Меню">⚙️</button>
            <div class="floating-menu hidden" id="floatingMenu">
                <button onclick="confirmClearCache()" class="floating-menu-btn">🗑️ Сбросить кеш</button>
                <button onclick="confirmResetAll()" class="floating-menu-btn">🔄 Сбросить всё</button>
                <button onclick="window.scrollTo({top: 0, behavior: 'smooth'})" class="floating-menu-btn">⬆️ Наверх</button>
                <button onclick="switchTab('settings')" class="floating-menu-btn">⚙️ Настройки</button>
                <button onclick="switchTab('roulette')" class="floating-menu-btn">🎰 Рулетка</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', floatingHTML);
}

function toggleFloatingMenu() {
    const menu = document.getElementById('floatingMenu');
    if (menu) {
        menu.classList.toggle('hidden');
        if (!menu.classList.contains('hidden')) setTimeout(() => document.addEventListener('click', closeFloatingMenu), 100);
    }
}

function closeFloatingMenu(e) {
    const floatingActions = document.querySelector('.floating-actions');
    if (floatingActions && !floatingActions.contains(e.target)) {
        const menu = document.getElementById('floatingMenu');
        if (menu) menu.classList.add('hidden');
        document.removeEventListener('click', closeFloatingMenu);
    }
}

// ==================== МОДАЛЬНЫЕ ОКНА ====================
function showConfirmModal(title, message, confirmText, cancelText, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalConfirm = document.getElementById('modalConfirm');
    const cancelBtn = modal?.querySelector('.cancel-btn');
    if (!modal || !modalTitle || !modalMessage || !modalConfirm) return;
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalConfirm.textContent = confirmText || 'ПОДТВЕРДИТЬ';
    if (cancelBtn) cancelBtn.textContent = cancelText || 'ОТМЕНА';
    modalCallback = onConfirm;
    modalConfirm.onclick = () => { if (modalCallback) modalCallback(); closeModal(); };
    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.add('hidden');
    modalCallback = null;
    const menu = document.getElementById('floatingMenu');
    if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
}

// ==================== СБРОС ДАННЫХ ====================
function confirmClearCache() {
    const menu = document.getElementById('floatingMenu');
    if (menu) menu.classList.add('hidden');
    showConfirmModal('🗑️ Сброс кеша', 'Очистить кеш браузера? Данные вернутся к стандартным.', 'СБРОСИТЬ', 'ОТМЕНА', () => clearCache());
}

function clearCache() {
    try {
        localStorage.removeItem('challengePlayers');
        localStorage.removeItem('challengeGames');
        sessionStorage.clear();
        players = [];
        games = {
            "Minecraft": ["Построй уродливый дом", "Играй без оружия", "Укради блок у друга"],
            "CS2": ["Беги через мид", "Играй только Deagle", "Дай странные команды"],
            "Apex": ["Прыгай в горячую зону", "Играй агрессивно", "Используй дробовик"]
        };
        gameFirstState = { active: false, selectedGame: null, currentPlayerIndex: 0, assignedTasks: {} };
        saveAll(); updateWheelSegments(); switchTab('games');
        showNotification('✅ Кеш очищен!', 'success');
    } catch (error) { showNotification('❌ Ошибка', 'error'); }
}

function confirmResetAll() {
    const menu = document.getElementById('floatingMenu');
    if (menu) menu.classList.add('hidden');
    showConfirmModal('🔄 Полный сброс', 'Удалить ВСЕ данные? Восстановить невозможно.', 'СБРОСИТЬ ВСЁ', 'ОТМЕНА', () => resetAllData());
}

function resetAllData() {
    try {
        players = []; games = {};
        localStorage.removeItem('challengePlayers');
        localStorage.removeItem('challengeGames');
        sessionStorage.clear();
        gameFirstState = { active: false, selectedGame: null, currentPlayerIndex: 0, assignedTasks: {} };
        updateWheelSegments(); switchTab('games');
        showNotification('🔄 Все данные сброшены!', 'warning');
    } catch (error) { showNotification('❌ Ошибка', 'error'); }
}

// ==================== СОХРАНЕНИЕ ДАННЫХ ====================
function saveAll() {
    localStorage.setItem('challengePlayers', JSON.stringify(players));
    localStorage.setItem('challengeGames', JSON.stringify(games));
}

// ==================== ВКЛАДКИ (TABS) ====================
function createTabs() {
    const mainPanel = document.getElementById('mainPanel');
    if (!mainPanel) return;
    mainPanel.innerHTML = `
        <div class="cyber-tabs">
            <button class="cyber-tab active" data-tab="games" onclick="switchTab('games')"><span class="tab-icon">🎮</span> Игры и задания</button>
            <button class="cyber-tab" data-tab="players" onclick="switchTab('players')"><span class="tab-icon">👥</span> Игроки (${players.length})</button>
            <button class="cyber-tab" data-tab="roulette" onclick="switchTab('roulette')"><span class="tab-icon">🎰</span> Рулетка</button>
            <button class="cyber-tab" data-tab="stats" onclick="switchTab('stats')"><span class="tab-icon">📊</span> Статистика</button>
            <button class="cyber-tab" data-tab="settings" onclick="switchTab('settings')"><span class="tab-icon">⚙️</span> Настройки</button>
        </div>
        <div class="tab-content" id="tabContent"></div>
    `;
    switchTab('games');
}

function switchTab(tabName) {
    currentTab = tabName;
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    if (tabName !== 'roulette') gameFirstState.active = false;
    if (currentTab === 'games') saveDropdownState();
    document.querySelectorAll('.cyber-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    const playersTab = document.querySelector('[data-tab="players"]');
    if (playersTab) playersTab.innerHTML = `<span class="tab-icon">👥</span> Игроки (${players.length})`;
    const content = document.getElementById('tabContent');
    if (!content) return;
    switch (tabName) {
        case 'games': content.innerHTML = renderGamesTab(); setTimeout(() => restoreDropdownState(), 50); break;
        case 'players': content.innerHTML = renderPlayersTab(); break;
        case 'roulette':
            content.innerHTML = renderRouletteTab();
            setTimeout(() => {
                if (gameFirstState.active && gameFirstState.selectedGame) updateWheelSegmentsForGame(gameFirstState.selectedGame);
                else updateWheelSegments();
                renderWheel();
            }, 100);
            break;
        case 'stats': content.innerHTML = renderStatsTab(); break;
        case 'settings': content.innerHTML = renderSettingsTab(); break;
    }
    content.style.animation = 'none'; content.offsetHeight; content.style.animation = 'fadeInUp 0.4s ease';
}

// ==================== ДРОПДАУНЫ ====================
function saveDropdownState() {
    openDropdowns = {};
    document.querySelectorAll('.tasks-dropdown').forEach(dropdown => {
        const gameId = dropdown.id.replace('dropdown_', '');
        if (!dropdown.classList.contains('hidden')) openDropdowns[gameId] = true;
    });
}

function restoreDropdownState() {
    Object.entries(openDropdowns).forEach(([gameId, isOpen]) => {
        if (isOpen) {
            const dropdown = document.getElementById(`dropdown_${gameId}`);
            const arrow = document.getElementById(`arrow_${gameId}`);
            if (dropdown) { dropdown.classList.remove('hidden'); if (arrow) arrow.textContent = '▼'; }
        }
    });
}

function toggleGameDropdown(gameName) {
    const safeId = gameName.replace(/[^a-zA-Z0-9]/g, '_');
    const dropdown = document.getElementById(`dropdown_${safeId}`);
    const arrow = document.getElementById(`arrow_${safeId}`);
    if (!dropdown) return;
    const isHidden = dropdown.classList.contains('hidden');
    if (isHidden) {
        document.querySelectorAll('.tasks-dropdown').forEach(d => { if (d.id !== `dropdown_${safeId}`) d.classList.add('hidden'); });
        document.querySelectorAll('.dropdown-arrow').forEach(a => { if (a.id !== `arrow_${safeId}`) a.textContent = '▶'; });
        dropdown.classList.remove('hidden'); if (arrow) arrow.textContent = '▼'; openDropdowns[safeId] = true;
    } else { dropdown.classList.add('hidden'); if (arrow) arrow.textContent = '▶'; openDropdowns[safeId] = false; }
}

function quickAddTask(gameName) {
    const safeId = gameName.replace(/[^a-zA-Z0-9]/g, '_');
    const input = document.getElementById(`quickTask_${safeId}`);
    if (!input) return;
    const task = input.value.trim();
    if (!task) { showNotification('Введите описание задания', 'error'); return; }
    if (!games[gameName]) { showNotification('Игра не найдена', 'error'); return; }
    games[gameName].push(task); saveAll(); input.value = ''; openDropdowns[safeId] = true;
    const content = document.getElementById('tabContent');
    if (content) { content.innerHTML = renderGamesTab(); setTimeout(() => restoreDropdownState(), 50); }
    showNotification('Задание добавлено', 'success');
}

function toggleAssignedTasks() {
    const list = document.getElementById('assignedTasksList');
    const arrow = document.getElementById('assignedArrow');
    if (!list || !arrow) return;
    if (list.classList.contains('hidden')) { list.classList.remove('hidden'); arrow.textContent = '▼'; }
    else { list.classList.add('hidden'); arrow.textContent = '▶'; }
}

// ==================== ВКЛАДКА ИГР И ЗАДАНИЙ ====================
function renderGamesTab() {
    return `
        <div class="games-panel">
            <div class="panel-section">
                <h3 class="section-title"><span class="neon-text">ДОБАВИТЬ ИГРУ</span></h3>
                <div class="input-group">
                    <input type="text" id="newGame" placeholder="Название игры..." class="cyber-input" onkeypress="if(event.key==='Enter') addGame()">
                    <br><button onclick="addGame()" class="cyber-btn add-btn">+ Добавить игру</button>
                </div>
            </div>
            <div class="panel-section">
                <h3 class="section-title"><span class="neon-text">ДОБАВИТЬ ЗАДАНИЕ</span></h3>
                <div class="input-group">
                    <select id="gameList" class="cyber-select">${Object.keys(games).map(g => `<option value="${g}">${g}</option>`).join('')}</select>
                    <input type="text" id="newTask" placeholder="Описание задания..." class="cyber-input" onkeypress="if(event.key==='Enter') addTask()">
                    <br><button onclick="addTask()" class="cyber-btn add-btn">+ Добавить задание</button>
                </div>
            </div>
            <div class="panel-section">
                <h3 class="section-title"><span class="neon-text">СПИСОК ИГР И ЗАДАНИЙ</span></h3>
                <div id="gamesList" class="games-list">${renderGamesList()}</div>
            </div>
            <div class="panel-actions">
                <button onclick="exportData()" class="cyber-btn export-btn">📤 Экспорт</button>
                <button onclick="importData()" class="cyber-btn import-btn">📥 Импорт</button>
            </div>
        </div>
    `;
}

function renderGamesList() {
    if (Object.keys(games).length === 0) return '<p class="empty-text">Нет добавленных игр</p>';
    return Object.entries(games).map(([game, tasks]) => {
        const safeId = game.replace(/[^a-zA-Z0-9]/g, '_');
        return `
            <div class="game-card">
                <div class="game-header" onclick="toggleGameDropdown('${game.replace(/'/g, "\\'")}')">
                    <div class="game-header-left"><span class="dropdown-arrow" id="arrow_${safeId}">▶</span><h4 class="game-name">🎮 ${game}</h4></div>
                    <div class="game-header-right"><span class="task-count">${tasks.length} заданий</span><button onclick="event.stopPropagation(); deleteGame('${game.replace(/'/g, "\\'")}')" class="delete-btn">🗑️</button></div>
                </div>
                <div class="tasks-dropdown hidden" id="dropdown_${safeId}">
                    <div class="tasks-list">${tasks.map((task, index) => `<div class="task-item"><span class="task-number">#${index + 1}</span><span class="task-text">${task}</span><button onclick="deleteTask('${game.replace(/'/g, "\\'")}', ${index})" class="delete-task-btn">×</button></div>`).join('')}</div>
                    ${tasks.length === 0 ? '<p class="empty-text">Нет заданий</p>' : ''}
                    <div class="task-actions"><input type="text" id="quickTask_${safeId}" placeholder="Быстрое задание..." class="cyber-input" onkeypress="if(event.key==='Enter') quickAddTask('${game.replace(/'/g, "\\'")}')"><br><button onclick="quickAddTask('${game.replace(/'/g, "\\'")}')" class="cyber-btn add-btn" style="margin-top: 4px; width: 100%;">+ Быстрое задание</button></div>
                </div>
            </div>
        `;
    }).join('');
}

function addGame() {
    const input = document.getElementById('newGame'); if (!input) return;
    const name = input.value.trim();
    if (!name) { showNotification('Введите название игры', 'error'); return; }
    if (games[name]) { showNotification('Такая игра уже существует', 'warning'); return; }
    games[name] = []; saveAll(); switchTab('games');
    showNotification(`Игра "${name}" добавлена`, 'success');
}

function addTask() {
    const gameSelect = document.getElementById('gameList'); const taskInput = document.getElementById('newTask');
    if (!gameSelect || !taskInput) return;
    const game = gameSelect.value; const task = taskInput.value.trim();
    if (!task) { showNotification('Введите описание задания', 'error'); return; }
    if (!games[game]) { showNotification('Выберите игру', 'error'); return; }
    games[game].push(task); saveAll(); switchTab('games');
    showNotification('Задание добавлено', 'success');
}

function deleteGame(gameName) {
    showConfirmModal('🗑️ Удаление игры', `Удалить игру "${gameName}" и все её задания?`, 'УДАЛИТЬ', 'ОТМЕНА', () => {
        delete games[gameName]; saveAll(); switchTab('games');
        showNotification(`Игра "${gameName}" удалена`, 'warning');
    });
}

function deleteTask(gameName, taskIndex) {
    if (!games[gameName]) return;
    const taskText = games[gameName][taskIndex];
    showConfirmModal('🗑️ Удаление задания', `Удалить задание "${taskText}"?`, 'УДАЛИТЬ', 'ОТМЕНА', () => {
        games[gameName].splice(taskIndex, 1); saveAll(); switchTab('games');
        showNotification('Задание удалено', 'warning');
    });
}

// ==================== ВКЛАДКА ИГРОКОВ ====================
function renderPlayersTab() {
    return `
        <div class="players-panel">
            <div class="panel-section">
                <h3 class="section-title"><span class="neon-text">ДОБАВИТЬ ИГРОКА</span></h3>
                <div class="input-group">
                    <input type="text" id="newPlayer" placeholder="Имя игрока..." class="cyber-input" onkeypress="if(event.key==='Enter') addPlayer()">
                    <select id="playerColor" class="cyber-select">${Object.entries(playerColors).map(([key, color]) => `<option value="${key}">${color.label}</option>`).join('')}</select>
                    <br><button onclick="addPlayer()" class="cyber-btn add-btn">+ Добавить игрока</button>
                </div>
            </div>
            <div class="panel-section">
                <h3 class="section-title"><span class="neon-text">СПИСОК ИГРОКОВ (${players.length})</span></h3>
                <div class="players-grid">${players.length === 0 ? '<p class="empty-text">Нет игроков</p>' : players.map((player, index) => { const colorData = playerColors[player.color] || playerColors['indigo']; return `<div class="player-card" style="border-color: ${colorData.name}"><div class="player-avatar" style="background: ${colorData.gradient}">${player.name[0].toUpperCase()}</div><div class="player-info"><span class="player-name" style="color: ${colorData.name}">${player.name}</span><span class="player-color">${colorData.label}</span></div><button onclick="deletePlayer(${index})" class="delete-btn">🗑️</button></div>`; }).join('')}</div>
            </div>
            <div class="panel-actions"><button onclick="clearAllPlayers()" class="cyber-btn danger-btn" ${players.length === 0 ? 'disabled' : ''}>Очистить список</button></div>
        </div>
    `;
}

function addPlayer() {
    const nameInput = document.getElementById('newPlayer'); const colorSelect = document.getElementById('playerColor');
    if (!nameInput || !colorSelect) return;
    const name = nameInput.value.trim(); const color = colorSelect.value;
    if (!name) { showNotification('Введите имя игрока', 'error'); return; }
    if (players.some(p => p.name === name)) { showNotification('Игрок уже существует', 'warning'); return; }
    players.push({ name, color, stats: { gamesPlayed: 0, tasksCompleted: 0 } }); saveAll(); switchTab('players');
    showNotification(`Игрок "${name}" добавлен`, 'success');
}

function deletePlayer(index) {
    const playerName = players[index]?.name || 'Неизвестный';
    showConfirmModal('🗑️ Удаление игрока', `Удалить игрока "${playerName}"?`, 'УДАЛИТЬ', 'ОТМЕНА', () => {
        players.splice(index, 1); saveAll(); switchTab('players');
        showNotification(`Игрок "${playerName}" удален`, 'warning');
    });
}

function clearAllPlayers() {
    if (players.length === 0) return;
    showConfirmModal('🗑️ Очистка', `Удалить ВСЕХ игроков (${players.length} чел.)?`, 'ОЧИСТИТЬ', 'ОТМЕНА', () => {
        players = []; saveAll(); switchTab('players');
        showNotification('Список очищен', 'warning');
    });
}

// ==================== ВКЛАДКА РУЛЕТКИ ====================
function renderRouletteTab() {
    const availableGames = Object.entries(games).filter(([_, tasks]) => tasks.length > 0);
    const totalGamesCount = Object.keys(games).length;
    const totalTasksCount = Object.values(games).reduce((sum, tasks) => sum + tasks.length, 0);
    let modeInfo = ''; let canSpin = true; let spinButtonText = '🎰 ЗАПУСТИТЬ РУЛЕТКУ'; let wheelHidden = false;

    if (gameFirstState.active && gameFirstState.selectedGame) {
        const currentPlayer = players[gameFirstState.currentPlayerIndex];
        const remainingTasks = getRemainingTasksForGame(gameFirstState.selectedGame);
        const assignedCount = Object.keys(gameFirstState.assignedTasks).length;
        const totalPlayersCount = players.length;
        const allPlayersAssigned = assignedCount >= totalPlayersCount;
        const noTasksLeft = remainingTasks.length === 0;
        const progressPercent = Math.round((assignedCount / totalPlayersCount) * 100);
        if (allPlayersAssigned || noTasksLeft) { canSpin = false; spinButtonText = '✅ ВСЕ ЗАДАНИЯ РАСПРЕДЕЛЕНЫ'; wheelHidden = true; }
        else if (currentPlayer) spinButtonText = `🎰 КРУТИТЬ ДЛЯ: ${currentPlayer.name}`;

        modeInfo = `
            <div class="game-first-status">
                <div class="progress-container"><div class="progress-header"><span class="progress-label">Прогресс</span><span class="progress-value">${assignedCount}/${totalPlayersCount} (${progressPercent}%)</span></div><div class="progress-bar"><div class="progress-fill" style="width: ${progressPercent}%"></div></div></div>
                <div class="status-card selected-game-card"><div class="status-card-icon">🎮</div><div class="status-card-content"><span class="status-card-label">Игра</span><span class="status-card-value">${gameFirstState.selectedGame}</span></div></div>
                ${currentPlayer && !allPlayersAssigned && !noTasksLeft ? `<div class="status-card current-player-card"><div class="status-card-icon">👤</div><div class="status-card-content"><span class="status-card-label">Крутит</span><span class="status-card-value" style="color: ${playerColors[currentPlayer?.color]?.name || '#6366f1'}">${currentPlayer.name}</span></div></div>` : ''}
                <div class="stats-row"><div class="stat-mini"><span class="stat-mini-icon">📋</span><span class="stat-mini-text">Осталось: <strong>${remainingTasks.length}</strong></span></div><div class="stat-mini"><span class="stat-mini-icon">✅</span><span class="stat-mini-text">Назначено: <strong>${assignedCount}</strong></span></div></div>
                ${assignedCount > 0 ? `<div class="assigned-tasks-section"><div class="section-subtitle" onclick="toggleAssignedTasks()"><span class="dropdown-arrow" id="assignedArrow">▶</span><span>Назначено (${assignedCount})</span></div><div class="assigned-tasks-list hidden" id="assignedTasksList">${Object.entries(gameFirstState.assignedTasks).map(([pName, pTask], idx) => { const player = players.find(p => p.name === pName); const colorData = playerColors[player?.color] || playerColors['indigo']; return `<div class="assigned-task-row"><span class="assigned-task-number">#${idx + 1}</span><span class="assigned-player-name" style="color: ${colorData.name}">${pName}</span><span class="assigned-task-divider">→</span><span class="assigned-task-text">${pTask}</span></div>`; }).join('')}</div></div>` : ''}
                ${allPlayersAssigned || noTasksLeft ? `<div class="completion-notice"><div class="completion-icon">🎉</div><p class="completion-text">Готово!</p><p class="completion-subtext">${assignedCount} из ${totalPlayersCount} игроков</p><div class="completion-actions"><br><button onclick="showFinalResults()" class="cyber-btn add-btn">📋 Результаты</button><button onclick="resetGameFirstMode()" class="cyber-btn danger-btn">🔄 Заново</button></div></div>` : ''}
            </div>
        `;
    }

    return `
        <div class="roulette-panel">
            <div class="roulette-info">
                <div class="mode-selector"><p class="roulette-mode">🎲 <span class="neon-text">РЕЖИМ</span></p><div class="mode-buttons"><button onclick="setRouletteMode('full')" class="mode-btn ${rouletteMode === 'full' ? 'active' : ''}"><span class="mode-btn-icon">🎰</span><span class="mode-btn-text">Полный рандом</span></button><button onclick="setRouletteMode('game-first')" class="mode-btn ${rouletteMode === 'game-first' ? 'active' : ''}"><span class="mode-btn-icon">🎯</span><span class="mode-btn-text">Сначала игра</span></button></div></div>
                <p class="roulette-hint">${rouletteMode === 'full' ? 'Случайная игра + задание + игрок' : 'Игра → задания для всех'}</p>
                ${modeInfo}
            </div>
            ${!gameFirstState.active ? `<div class="pre-spin-stats"><div class="pre-stat-item"><span class="pre-stat-icon">🎮</span><span class="pre-stat-text">Игр: <strong>${totalGamesCount}</strong></span></div><div class="pre-stat-item"><span class="pre-stat-icon">📋</span><span class="pre-stat-text">Заданий: <strong>${totalTasksCount}</strong></span></div><div class="pre-stat-item"><span class="pre-stat-icon">👥</span><span class="pre-stat-text">Игроков: <strong>${players.length}</strong></span></div></div>` : ''}
            <div class="wheel-container" id="wheelContainer" style="transition: all 0.5s ease; ${wheelHidden ? 'opacity: 0; transform: scale(0.8); pointer-events: none; max-height: 0; overflow: hidden; margin: 0;' : 'opacity: 1; transform: scale(1); max-height: 500px;'}">
                <canvas id="rouletteWheel" width="${rouletteSettings.wheelSize}" height="${rouletteSettings.wheelSize}"></canvas>
                <div class="wheel-pointer">▼</div>
                <div id="wheelResultPopup" class="wheel-result-popup hidden"><div class="popup-content"><div class="popup-game"></div><div class="popup-player"></div><div class="popup-task"></div></div></div>
            </div>
            <div class="roulette-controls">
                <button onclick="startSpin()" class="cyber-btn spin-btn" ${spinning || !canSpin ? 'disabled' : ''}>${spinButtonText}</button><br>
                ${gameFirstState.active && canSpin ? `<br><button onclick="resetGameFirstMode()" class="cyber-btn danger-btn outline-btn">🔄 Сбросить</button>` : ''}
                <p class="spin-hint">${availableGames.length === 0 ? '⚠️ Добавьте игры' : `✅ Готово: ${totalGamesCount} игр, ${totalTasksCount} заданий, ${players.length} игроков`}</p>
            </div>
            <div id="spinResult" class="spin-result hidden"><div class="result-card"><h3>🎯 Результат:</h3><div id="resultContent"></div><div id="resultActions"></div></div></div>
        </div>
    `;
}

function getRemainingTasksForGame(gameName) {
    const allTasks = games[gameName] || [];
    const usedTasks = Object.values(gameFirstState.assignedTasks);
    return allTasks.filter(task => !usedTasks.includes(task));
}

function setRouletteMode(mode) {
    rouletteMode = mode;
    gameFirstState = { active: false, selectedGame: null, currentPlayerIndex: 0, assignedTasks: {} };
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(mode === 'full' ? 'modeFullBtn' : 'modeGameFirstBtn')?.classList.add('active');
    updateWheelSegments(); renderWheel(); showWheel();
    const resultDiv = document.getElementById('spinResult'); if (resultDiv) resultDiv.classList.add('hidden');
    if (currentTab === 'roulette') switchTab('roulette');
    showNotification(`Режим: ${mode === 'full' ? 'Полный рандом' : 'Сначала игра'}`, 'info');
}

function resetGameFirstMode() {
    gameFirstState = { active: false, selectedGame: null, currentPlayerIndex: 0, assignedTasks: {} };
    updateWheelSegments(); renderWheel(); showWheel();
    const resultDiv = document.getElementById('spinResult'); if (resultDiv) resultDiv.classList.add('hidden');
    switchTab('roulette'); showNotification('Режим сброшен', 'info');
}

function updateWheelSegments() {
    const allTasks = [];
    Object.entries(games).forEach(([gameName, tasks]) => tasks.forEach(task => allTasks.push({ game: gameName, task })));
    wheelSegments = allTasks.map((item, index) => ({ label: item.game, task: item.task, game: item.game, color: getSegmentColor(index, allTasks.length) }));
    if (wheelSegments.length === 0) wheelSegments = [{ label: 'Нет заданий', task: 'Добавьте задания', game: 'Нет игры', color: '#94a3b8' }];
}

function updateWheelSegmentsForGame(gameName) {
    const remainingTasks = getRemainingTasksForGame(gameName);
    if (remainingTasks.length === 0) { wheelSegments = [{ label: 'Все задания розданы', task: 'Нет заданий', game: gameName, color: '#94a3b8' }]; return; }
    wheelSegments = remainingTasks.map((task, index) => ({ label: `Задание ${index + 1}`, task, game: gameName, color: getSegmentColor(index, remainingTasks.length) }));
}

function getSegmentColor(index, total) {
    const schemes = {
        default: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#06b6d4'],
        neon: ['#ff00ff', '#00ffff', '#ff6600', '#00ff00', '#ff0000', '#ffff00', '#ff0099', '#33ccff'],
        pastel: ['#a78bfa', '#67e8f9', '#86efac', '#fde68a', '#fca5a5', '#93c5fd', '#f9a8d4', '#5eead4'],
        monochrome: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#1a1a2e', '#16213e', '#0f3460'],
        gold: ['#ffd700', '#ffb800', '#ffa500', '#ff8c00', '#ffd700', '#ffb800', '#ffa500', '#ff8c00'],
    };
    const colors = schemes[rouletteSettings.colorScheme] || schemes.default;
    return colors[index % colors.length];
}

function renderWheel() {
    const canvas = document.getElementById('rouletteWheel');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2, centerY = canvas.height / 2, radius = canvas.width / 2 - 30;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const outerGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    outerGradient.addColorStop(0, '#6366f1'); outerGradient.addColorStop(0.5, '#8b5cf6'); outerGradient.addColorStop(1, '#6366f1');
    ctx.beginPath(); ctx.arc(centerX, centerY, radius + 15, 0, Math.PI * 2); ctx.strokeStyle = outerGradient; ctx.lineWidth = 4; ctx.shadowColor = '#6366f1'; ctx.shadowBlur = 25; ctx.stroke(); ctx.shadowBlur = 0;

    if (wheelSegments.length > 0) {
        const maxSegments = rouletteSettings.groupSegments ? rouletteSettings.maxSegments : 100;
        const needGrouping = wheelSegments.length > maxSegments;
        let displaySegments = wheelSegments;

        if (needGrouping) {
            const groupCount = Math.min(8, maxSegments);
            const groupSize = Math.ceil(wheelSegments.length / groupCount);
            displaySegments = [];
            for (let i = 0; i < groupCount; i++) {
                const start = i * groupSize;
                const end = Math.min(start + groupSize, wheelSegments.length);
                const group = wheelSegments.slice(start, end);
                if (group.length > 0) {
                    displaySegments.push({
                        label: `${start + 1}-${end}`,
                        task: group[0]?.task || '',
                        game: group[0]?.game || '',
                        color: getSegmentColor(i, groupCount),
                        isGroup: true,
                        items: group
                    });
                }
            }
        }

        const displayAngle = (Math.PI * 2) / displaySegments.length;
        displaySegments.forEach((segment, index) => {
            const startAngle = index * displayAngle + currentWheelAngle;
            const endAngle = startAngle + displayAngle;
            ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, radius, startAngle, endAngle); ctx.closePath();
            const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius);
            gradient.addColorStop(0, segment.color); gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.4)'); gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
            ctx.fillStyle = gradient; ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(startAngle + displayAngle / 2);
            ctx.fillStyle = '#ffffff'; ctx.font = `bold ${rouletteSettings.fontSize}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'; ctx.shadowBlur = 4;
            if (segment.isGroup) {
                ctx.fillText(`${segment.label}`, radius * 0.7, 0);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.font = `${rouletteSettings.fontSize - 3}px Inter, sans-serif`;
                ctx.fillText(`${segment.items.length} зад.`, radius * 0.7, rouletteSettings.fontSize + 2);
            } else {
                let displayLabel = segment.label;
                if (displayLabel.length > 12) displayLabel = displayLabel.substring(0, 10) + '..';
                ctx.fillText(displayLabel, radius * 0.65, 0);
            }
            ctx.restore();
        });
    }

    for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2, x = centerX + (radius + 12) * Math.cos(angle), y = centerY + (radius + 12) * Math.sin(angle);
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = i % 2 === 0 ? '#6366f1' : '#8b5cf6'; ctx.fill();
    }

    const innerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 35);
    innerGradient.addColorStop(0, '#ffffff'); innerGradient.addColorStop(1, '#f1f5f9');
    ctx.beginPath(); ctx.arc(centerX, centerY, 35, 0, Math.PI * 2); ctx.fillStyle = innerGradient; ctx.fill();
    ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#6366f1'; ctx.font = 'bold 18px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎲', centerX, centerY);
}

function startSpin() {
    if (spinning) return;
    if (players.length < 1) { showNotification('Добавьте игрока', 'error'); return; }
    if (rouletteMode === 'game-first' && gameFirstState.active) {
        const remainingTasks = getRemainingTasksForGame(gameFirstState.selectedGame);
        if (remainingTasks.length === 0 || Object.keys(gameFirstState.assignedTasks).length >= players.length) {
            showNotification('Все задания распределены!', 'warning'); return;
        }
    }
    const allTasks = [];
    Object.entries(games).forEach(([gameName, tasks]) => tasks.forEach(task => allTasks.push({ game: gameName, task })));
    if (allTasks.length === 0) { showNotification('Добавьте задания', 'error'); return; }
    spinning = true;
    const spinBtn = document.querySelector('.spin-btn'); if (spinBtn) spinBtn.disabled = true;
    const resultDiv = document.getElementById('spinResult'); if (resultDiv) resultDiv.classList.add('hidden');
    const popup = document.getElementById('wheelResultPopup'); if (popup) popup.classList.add('hidden');
    if (rouletteMode === 'game-first') { if (!gameFirstState.active) startGameFirstInitial(allTasks); else startGameFirstSpin(); }
    else startFullRandomMode(allTasks);
}

function startFullRandomMode(allTasks) {
    const gamesWithTasks = Object.entries(games).filter(([_, tasks]) => tasks.length > 0);
    if (gamesWithTasks.length === 0) { showNotification('Нет игр с заданиями', 'error'); finishSpin(); return; }
    const randomGameEntry = gamesWithTasks[Math.floor(Math.random() * gamesWithTasks.length)];
    const selectedGame = randomGameEntry[0], gameTasks = randomGameEntry[1];
    const selectedPlayer = players[Math.floor(Math.random() * players.length)];
    const selectedTask = gameTasks[Math.floor(Math.random() * gameTasks.length)];
    const targetIndex = allTasks.findIndex(item => item.game === selectedGame && item.task === selectedTask);
    spinWheel(allTasks, targetIndex, () => {
        if (rouletteSettings.resultDisplay !== 'popup') showResult(selectedGame, selectedPlayer, selectedTask);
        showPopupResult(selectedGame, selectedPlayer, selectedTask);
        updatePlayerStats(selectedPlayer.name); playWinSound(); finishSpin();
    });
}

function startGameFirstInitial(allTasks) {
    const gamesWithTasks = Object.entries(games).filter(([_, tasks]) => tasks.length > 0);
    if (gamesWithTasks.length === 0) { showNotification('Нет игр с заданиями', 'error'); finishSpin(); return; }
    const selectedGame = gamesWithTasks[Math.floor(Math.random() * gamesWithTasks.length)][0];
    updateWheelSegments(); showWheel();
    const targetIndex = allTasks.findIndex(item => item.game === selectedGame);
    spinWheel(allTasks, targetIndex >= 0 ? targetIndex : 0, () => {
        gameFirstState = { active: true, selectedGame, currentPlayerIndex: 0, assignedTasks: {} };
        updateWheelSegmentsForGame(selectedGame); renderWheel(); switchTab('roulette');
        showNotification(`🎮 Выбрана игра: ${selectedGame}!`, 'success');
        setTimeout(() => { if (players[0]) showNotification(`👤 Игрок ${players[0].name} крутит рулетку`, 'info'); }, 1500);
        finishSpin();
    });
}

function startGameFirstSpin() {
    const currentPlayer = players[gameFirstState.currentPlayerIndex];
    if (!currentPlayer) { hideWheelSmoothly(); setTimeout(() => showFinalResults(), 600); return; }
    const remainingTasks = getRemainingTasksForGame(gameFirstState.selectedGame);
    if (remainingTasks.length === 0) { showNotification('Все задания розданы!', 'warning'); hideWheelSmoothly(); setTimeout(() => showFinalResults(), 600); return; }
    const gameOnlyTasks = remainingTasks.map(task => ({ game: gameFirstState.selectedGame, task }));
    const selectedTask = remainingTasks[Math.floor(Math.random() * remainingTasks.length)];
    const targetIndex = gameOnlyTasks.findIndex(item => item.task === selectedTask);
    updateWheelSegmentsForGame(gameFirstState.selectedGame); renderWheel();
    spinWheel(gameOnlyTasks, targetIndex >= 0 ? targetIndex : 0, () => {
        gameFirstState.assignedTasks[currentPlayer.name] = selectedTask;
        if (rouletteSettings.resultDisplay !== 'popup') showResult(gameFirstState.selectedGame, currentPlayer, selectedTask);
        showPopupResult(gameFirstState.selectedGame, currentPlayer, selectedTask);
        updatePlayerStats(currentPlayer.name); playWinSound();
        gameFirstState.currentPlayerIndex++;
        const nextPlayer = players[gameFirstState.currentPlayerIndex];
        const stillRemainingTasks = getRemainingTasksForGame(gameFirstState.selectedGame);
        if (!nextPlayer || stillRemainingTasks.length === 0) { hideWheelSmoothly(); setTimeout(() => showFinalResults(), 600); }
        else { switchTab('roulette'); updateWheelSegmentsForGame(gameFirstState.selectedGame); renderWheel(); showNotification(`👤 Очередь: ${nextPlayer.name}`, 'info'); }
        finishSpin();
    });
}

function hideWheelSmoothly() {
    const wheelContainer = document.getElementById('wheelContainer');
    if (wheelContainer) {
        wheelContainer.style.transition = 'all 0.6s ease';
        wheelContainer.style.opacity = '0'; wheelContainer.style.transform = 'scale(0.8)';
        wheelContainer.style.maxHeight = '0'; wheelContainer.style.margin = '0';
        wheelContainer.style.pointerEvents = 'none'; wheelContainer.style.overflow = 'hidden';
    }
}

function showWheel() {
    const wheelContainer = document.getElementById('wheelContainer');
    if (wheelContainer) {
        wheelContainer.style.transition = 'all 0.5s ease';
        wheelContainer.style.opacity = '1'; wheelContainer.style.transform = 'scale(1)';
        wheelContainer.style.maxHeight = '500px'; wheelContainer.style.margin = '';
        wheelContainer.style.pointerEvents = 'auto'; wheelContainer.style.overflow = '';
    }
}

function showFinalResults() {
    const assignedCount = Object.keys(gameFirstState.assignedTasks).length;
    if (assignedCount === 0 && gameFirstState.active) { showNotification('Нет назначенных заданий', 'warning'); return; }
    const unassignedPlayers = players.filter(p => !gameFirstState.assignedTasks[p.name]);
    const resultDiv = document.getElementById('spinResult'), resultContent = document.getElementById('resultContent'), resultActions = document.getElementById('resultActions');
    if (!resultDiv || !resultContent) return;
    resultContent.innerHTML = `
        <div class="final-result-header"><div class="final-game-info"><span class="final-game-icon">🎮</span><span class="final-game-name">${gameFirstState.selectedGame}</span></div><div class="final-stats"><span class="final-stat-badge success">✅ ${assignedCount}</span>${unassignedPlayers.length > 0 ? `<span class="final-stat-badge warning">⚠️ ${unassignedPlayers.length}</span>` : ''}</div></div>
        <div class="final-results-list"><div class="final-results-title">📋 Задания (${assignedCount}/${players.length})</div><div class="final-results-grid">${Object.entries(gameFirstState.assignedTasks).map(([pName, pTask], idx) => { const player = players.find(p => p.name === pName); const colorData = playerColors[player?.color] || playerColors['indigo']; return `<div class="final-result-row"><span class="final-result-number">#${idx + 1}</span><span class="final-result-player" style="color: ${colorData.name}">${pName}</span><span class="final-result-arrow">→</span><span class="final-result-task">${pTask}</span></div>`; }).join('')}</div></div>
        ${unassignedPlayers.length > 0 ? `<div class="unassigned-warning"><p class="unassigned-warning-title">⚠️ Без заданий</p><div class="unassigned-players-list">${unassignedPlayers.map(p => `<span class="unassigned-player-tag" style="border-color: ${playerColors[p.color]?.name || '#6366f1'}; color: ${playerColors[p.color]?.name || '#6366f1'}">${p.name}</span>`).join('')}</div></div>` : ''}
    `;
    if (resultActions) resultActions.innerHTML = `<br><button onclick="resetGameFirstMode()" class="cyber-btn add-btn">🔄 НАЧАТЬ ЗАНОВО</button><button onclick="exportResults()" class="cyber-btn export-btn">📤 Экспорт</button>`;
    resultDiv.classList.remove('hidden'); resultDiv.style.animation = 'none'; resultDiv.offsetHeight; resultDiv.style.animation = 'fadeInUp 0.5s ease';
    switchTab('roulette');
}

function exportResults() {
    if (!gameFirstState.selectedGame) return;
    let text = `🎮 Игра: ${gameFirstState.selectedGame}\n📋 Задания:\n────────────────────────\n`;
    Object.entries(gameFirstState.assignedTasks).forEach(([playerName, task]) => text += `👤 ${playerName}: ${task}\n`);
    text += `────────────────────────\n📅 ${new Date().toLocaleString()}\n`;
    const blob = new Blob([text], { type: 'text/plain' }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `challenge-results-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url); showNotification('Результаты экспортированы', 'success');
}

function spinWheel(tasks, targetIndex, callback) {
    if (tasks.length === 0) { if (callback) callback(); return; }
    const segmentAngle = (Math.PI * 2) / tasks.length;
    const targetAngle = targetIndex * segmentAngle + segmentAngle / 2;
    const spins = rouletteSettings.minSpins + Math.floor(Math.random() * (rouletteSettings.maxSpins - rouletteSettings.minSpins + 1));
    const totalRotation = spins * Math.PI * 2 + (Math.PI * 2 - targetAngle);
    animateWheel(totalRotation, callback);
}

function finishSpin() { spinning = false; const spinBtn = document.querySelector('.spin-btn'); if (spinBtn) spinBtn.disabled = false; }

function animateWheel(totalRotation, callback) {
    const canvas = document.getElementById('rouletteWheel');
    if (!canvas) { if (callback) callback(); return; }
    const duration = rouletteSettings.spinDuration, startTime = Date.now(), startAngle = currentWheelAngle;
    let tickSoundPlayed = false, lastTickPhase = -1;
    if (rouletteSettings.visualEffects) { const wc = document.getElementById('wheelContainer'); if (wc) { wc.style.transition = 'all 0.3s ease'; wc.style.transform = 'scale(1.02)'; } }

    function animate() {
        const elapsed = Date.now() - startTime, progress = Math.min(elapsed / duration, 1);
        let easeOut;
        if (progress < 0.6) easeOut = progress / 0.6 * 0.85;
        else if (progress < 0.8) { const p = (progress - 0.6) / 0.2; easeOut = 0.85 + (1 - Math.pow(1 - p, 2)) * 0.1; }
        else if (progress < 0.95) {
            const p = (progress - 0.8) / 0.15, tickCount = 6, currentTick = Math.floor(p * tickCount);
            if (currentTick !== lastTickPhase) { lastTickPhase = currentTick; if (rouletteSettings.soundEnabled && rouletteSettings.tickSoundEnabled) playTickSound(); }
            easeOut = 0.95 + (currentTick / tickCount) * 0.04;
        } else { const p = (progress - 0.95) / 0.05; easeOut = 0.99 + p * 0.01; }
        currentWheelAngle = startAngle + totalRotation * easeOut; renderWheel();
        if (rouletteSettings.visualEffects && rouletteSettings.glowEffect && progress > 0.9 && canvas) {
            canvas.style.filter = `drop-shadow(0 0 ${20 + (progress - 0.9) * 200}px rgba(99, 102, 241, ${0.3 + (progress - 0.9) * 0.7}))`;
        }
        if (progress < 1) animationId = requestAnimationFrame(animate);
        else {
            currentWheelAngle = (startAngle + totalRotation) % (Math.PI * 2);
            if (rouletteSettings.visualEffects && rouletteSettings.shakeEffect) shakeWheel(() => finalizeSpin(callback));
            else finalizeSpin(callback);
        }
    }
    if (rouletteSettings.soundEnabled) playSpinSound();
    animationId = requestAnimationFrame(animate);
}

function finalizeSpin(callback) {
    renderWheel();
    const canvas = document.getElementById('rouletteWheel'); if (canvas) canvas.style.filter = 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.1))';
    const wc = document.getElementById('wheelContainer'); if (wc) wc.style.transform = 'scale(1)';
    animationId = null;
    if (rouletteSettings.visualEffects && rouletteSettings.highlightWinner) highlightWinningSegment(callback);
    else if (callback) callback();
}

function shakeWheel(callback) {
    const canvas = document.getElementById('rouletteWheel'); if (!canvas) { if (callback) callback(); return; }
    const shakeCount = 3; let shakeIndex = 0;
    function shake() {
        if (shakeIndex < shakeCount * 2) {
            const offset = (shakeIndex % 2 === 0) ? 2 : -2;
            const scale = 1 + (2 / 200) * (shakeCount - shakeIndex / 2);
            canvas.style.transform = `rotate(${offset}deg) scale(${scale})`; canvas.style.transition = 'all 0.05s ease';
            shakeIndex++; setTimeout(shake, 50);
        } else { canvas.style.transform = 'rotate(0deg) scale(1)'; canvas.style.transition = 'all 0.2s ease'; setTimeout(() => { if (callback) callback(); }, 200); }
    }
    shake();
}

function highlightWinningSegment(callback) {
    const canvas = document.getElementById('rouletteWheel');
    if (canvas) { canvas.style.transition = 'all 0.3s ease'; canvas.style.filter = 'drop-shadow(0 0 40px rgba(16, 185, 129, 0.8)) brightness(1.2)'; setTimeout(() => { canvas.style.filter = 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.1)) brightness(1)'; }, 500); }
    if (callback) callback();
}

function showPopupResult(game, player, task) {
    const popup = document.getElementById('wheelResultPopup'); if (!popup) return;
    if (rouletteSettings.resultDisplay === 'card') { popup.classList.add('hidden'); return; }
    const colorData = playerColors[player.color] || playerColors['indigo'];
    const popupGame = popup.querySelector('.popup-game'), popupPlayer = popup.querySelector('.popup-player'), popupTask = popup.querySelector('.popup-task');
    if (popupGame) { popupGame.textContent = ''; typeWriter(popupGame, `🎮 ${game}`, 30); }
    if (popupPlayer) { popupPlayer.textContent = ''; setTimeout(() => typeWriter(popupPlayer, `👤 ${player.name}`, 30), 300); popupPlayer.style.color = colorData.name; }
    if (popupTask) { popupTask.textContent = ''; setTimeout(() => typeWriter(popupTask, `⚡ ${task}`, 20), 600); }
    popup.classList.remove('hidden'); popup.style.animation = 'none'; popup.offsetHeight; popup.style.animation = 'popupBounce 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    if (rouletteSettings.visualEffects && rouletteSettings.glowEffect) popup.classList.add('win');
    if (rouletteSettings.particleEffect) createWinParticles();
    if (rouletteSettings.autoClosePopup) {
        setTimeout(() => {
            if (popup) { popup.style.animation = 'popupFadeOut 0.5s ease forwards'; popup.classList.remove('win'); setTimeout(() => { popup.classList.add('hidden'); popup.style.animation = ''; }, 500); }
        }, rouletteSettings.popupDuration);
    }
}

function typeWriter(element, text, speed) { let index = 0; element.textContent = ''; function type() { if (index < text.length) { element.textContent += text.charAt(index); index++; setTimeout(type, speed); } } type(); }

function createWinParticles() {
    const colors = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6', '#84cc16'];
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const particle = document.createElement('div'); particle.className = 'win-particle';
            const size = Math.random() * 12 + 6, angle = Math.random() * Math.PI * 2, velocity = Math.random() * 200 + 100;
            const startX = window.innerWidth / 2, startY = window.innerHeight / 2;
            const endX = startX + Math.cos(angle) * velocity, endY = startY + Math.sin(angle) * velocity;
            const duration = Math.random() * 1000 + 500;
            particle.style.cssText = `position:fixed;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random() * colors.length)]};border-radius:50%;left:${startX}px;top:${startY}px;z-index:999;pointer-events:none;box-shadow:0 0 ${size * 2}px currentColor;animation:particleBurst ${duration}ms ease-out forwards;--end-x:${endX - startX}px;--end-y:${endY - startY}px;`;
            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), duration + 100);
        }, i * 20);
    }
}

function showResult(game, player, task) {
    if (rouletteSettings.resultDisplay === 'popup') return;
    const resultDiv = document.getElementById('spinResult'), resultContent = document.getElementById('resultContent'), resultActions = document.getElementById('resultActions');
    if (!resultDiv || !resultContent) return;
    const colorData = playerColors[player.color] || playerColors['indigo'];
    resultContent.innerHTML = `<div class="result-grid"><div class="result-card-item"><div class="result-card-icon">🎮</div><div class="result-card-label">Игра</div><div class="result-card-value">${game}</div></div><div class="result-card-item"><div class="result-card-icon">👤</div><div class="result-card-label">Игрок</div><div class="result-card-value" style="color: ${colorData.name};">${player.name}</div></div><div class="result-card-item"><div class="result-card-icon">⚡</div><div class="result-card-label">Задание</div><div class="result-card-value task-highlight">${task}</div></div></div>`;
    if (resultActions) {
        if (gameFirstState.active) {
            const nextPlayer = players[gameFirstState.currentPlayerIndex], remainingTasks = getRemainingTasksForGame(gameFirstState.selectedGame);
            resultActions.innerHTML = nextPlayer && remainingTasks.length > 0 ? `<br><button onclick="startSpin()" class="cyber-btn add-btn">🔄 СЛЕДУЮЩИЙ: ${nextPlayer.name}</button>` : `<br><button onclick="showFinalResults()" class="cyber-btn add-btn">📋 ВСЕ РЕЗУЛЬТАТЫ</button>`;
        } else resultActions.innerHTML = `<br><button onclick="startSpin()" class="cyber-btn add-btn">🔄 КРУТИТЬ ЕЩЁ</button>`;
    }
    resultDiv.classList.remove('hidden'); resultDiv.style.animation = 'none'; resultDiv.offsetHeight; resultDiv.style.animation = 'fadeInUp 0.5s ease';
}

function updatePlayerStats(playerName) { const player = players.find(p => p.name === playerName); if (player) { player.stats.gamesPlayed++; player.stats.tasksCompleted++; saveAll(); } }

// ==================== ВКЛАДКА СТАТИСТИКИ ====================
function renderStatsTab() {
    const totalGames = Object.keys(games).length, totalTasks = Object.values(games).reduce((sum, tasks) => sum + tasks.length, 0), totalPlayers = players.length;
    const mostActivePlayer = players.reduce((max, player) => (player.stats.gamesPlayed > (max?.stats?.gamesPlayed || 0)) ? player : max, null);
    return `<div class="stats-panel"><div class="stats-grid"><div class="stat-card"><div class="stat-value">${totalGames}</div><div class="stat-label">Игр</div></div><div class="stat-card"><div class="stat-value">${totalTasks}</div><div class="stat-label">Заданий</div></div><div class="stat-card"><div class="stat-value">${totalPlayers}</div><div class="stat-label">Игроков</div></div></div>${mostActivePlayer ? `<div class="top-player"><h3>👑 Самый активный: </h3><div class="player-highlight"><span class="highlight-name">${mostActivePlayer.name}</span> - <span class="highlight-stats">${mostActivePlayer.stats.gamesPlayed} игр</span></div></div>` : ''}<div class="players-stats"><h3>📊 Статистика</h3>${players.length === 0 ? '<p class="empty-text">Нет данных</p>' : players.map(player => `<div class="player-stats-row"><span class="player-stats-name">${player.name}</span><div class="stats-bar"><div class="stats-fill" style="width: ${Math.min(player.stats.gamesPlayed * 10, 100)}%"></div></div><span class="player-stats-count">${player.stats.gamesPlayed} игр</span></div>`).join('')}</div></div>`;
}

// ==================== ВКЛАДКА НАСТРОЕК ====================
function renderSettingsTab() {
    return `
        <div class="settings-panel">
            <div class="settings-header"><h2>⚙️ Продвинутые настройки</h2><p>Настройте рулетку под себя</p></div>
            <div class="panel-section"><h3 class="section-title"><span class="neon-text">🎯 Скорость</span></h3><div class="settings-group">
                <div class="setting-item"><label>Длительность</label><div class="range-container"><input type="range" id="spinDuration" min="2000" max="10000" step="500" value="${rouletteSettings.spinDuration}" oninput="updateSetting('spinDuration', this.value)"><span class="range-value">${rouletteSettings.spinDuration / 1000}с</span></div></div>
                <div class="setting-item"><label>Мин. оборотов</label><div class="range-container"><input type="range" id="minSpins" min="2" max="10" step="1" value="${rouletteSettings.minSpins}" oninput="updateSetting('minSpins', this.value)"><span class="range-value">${rouletteSettings.minSpins}</span></div></div>
                <div class="setting-item"><label>Макс. оборотов</label><div class="range-container"><input type="range" id="maxSpins" min="5" max="20" step="1" value="${rouletteSettings.maxSpins}" oninput="updateSetting('maxSpins', this.value)"><span class="range-value">${rouletteSettings.maxSpins}</span></div></div>
            </div></div>
            <div class="panel-section"><h3 class="section-title"><span class="neon-text">🔊 Звук</span></h3><div class="settings-group">
                <div class="setting-item toggle-item"><label>Звук</label><label class="toggle-switch"><input type="checkbox" ${rouletteSettings.soundEnabled ? 'checked' : ''} onchange="updateSetting('soundEnabled', this.checked)"><span class="toggle-slider"></span></label></div>
                <div class="setting-item"><label>Громкость</label><div class="range-container"><input type="range" id="soundVolume" min="0" max="100" step="5" value="${rouletteSettings.soundVolume * 100}" oninput="updateSetting('soundVolume', this.value / 100)"><span class="range-value">${Math.round(rouletteSettings.soundVolume * 100)}%</span></div></div>
            </div></div>
            <div class="panel-section"><h3 class="section-title"><span class="neon-text">✨ Эффекты</span></h3><div class="settings-group">
                <div class="setting-item toggle-item"><label>Эффекты</label><label class="toggle-switch"><input type="checkbox" ${rouletteSettings.visualEffects ? 'checked' : ''} onchange="updateSetting('visualEffects', this.checked)"><span class="toggle-slider"></span></label></div>
                <div class="setting-item toggle-item"><label>Частицы</label><label class="toggle-switch"><input type="checkbox" ${rouletteSettings.particleEffect ? 'checked' : ''} onchange="updateSetting('particleEffect', this.checked)"><span class="toggle-slider"></span></label></div>
            </div></div>
            <div class="panel-section"><h3 class="section-title"><span class="neon-text">🎨 Вид</span></h3><div class="settings-group">
                <div class="setting-item"><label>Цвета</label><select id="colorScheme" class="cyber-select" onchange="updateSetting('colorScheme', this.value)"><option value="default" ${rouletteSettings.colorScheme === 'default' ? 'selected' : ''}>Стандарт</option><option value="neon" ${rouletteSettings.colorScheme === 'neon' ? 'selected' : ''}>Неон</option><option value="pastel" ${rouletteSettings.colorScheme === 'pastel' ? 'selected' : ''}>Пастель</option><option value="gold" ${rouletteSettings.colorScheme === 'gold' ? 'selected' : ''}>Золото</option></select></div>
                <div class="setting-item"><label>Размер</label><div class="range-container"><input type="range" id="wheelSize" min="300" max="600" step="20" value="${rouletteSettings.wheelSize}" oninput="updateSetting('wheelSize', this.value)"><span class="range-value">${rouletteSettings.wheelSize}px</span></div></div>
            </div></div>
            <div class="settings-actions"><br><button onclick="resetSettings()" class="cyber-btn danger-btn">🔄 Сбросить</button><button onclick="applySettings()" class="cyber-btn add-btn">✅ Применить</button></div>
        </div>
    `;
}

function updateSetting(key, value) {
    if (typeof rouletteSettings[key] === 'number') value = Number(value);
    rouletteSettings[key] = value; saveSettings();
    const el = document.getElementById(key);
    if (el && el.type === 'range') {
        const rv = el.parentElement.querySelector('.range-value');
        if (rv) {
            if (key === 'spinDuration' || key === 'popupDuration') rv.textContent = `${value / 1000}с`;
            else if (key === 'soundVolume') rv.textContent = `${Math.round(value * 100)}%`;
            else if (key === 'wheelSize') rv.textContent = `${value}px`;
            else rv.textContent = value;
        }
    }
}

function saveSettings() { localStorage.setItem('rouletteSettings', JSON.stringify(rouletteSettings)); }

function resetSettings() {
    showConfirmModal('🔄 Сброс', 'Сбросить настройки?', 'СБРОСИТЬ', 'ОТМЕНА', () => {
        rouletteSettings = { spinDuration: 5000, minSpins: 5, maxSpins: 10, soundEnabled: true, soundVolume: 0.5, tickSoundEnabled: true, winSoundEnabled: true, visualEffects: true, highlightWinner: true, shakeEffect: true, glowEffect: true, particleEffect: true, autoClosePopup: true, popupDuration: 6000, wheelSize: 400, fontSize: 11, groupSegments: true, maxSegments: 12, colorScheme: 'default', pointerStyle: 'arrow', resultDisplay: 'both' };
        saveSettings(); switchTab('settings'); showNotification('Настройки сброшены', 'success');
    });
}

function applySettings() { saveSettings(); updateWheelSegments(); renderWheel(); showNotification('Настройки применены!', 'success'); }

// ==================== ЗВУКОВЫЕ ЭФФЕКТЫ ====================
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

function playSpinSound() {
    if (!rouletteSettings.soundEnabled) return;
    try {
        initAudio(); const duration = 2;
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sawtooth'; filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, audioCtx.currentTime); filter.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + duration);
        osc.frequency.setValueAtTime(400, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + duration);
        gain.gain.setValueAtTime(0.08 * rouletteSettings.soundVolume, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + duration);
    } catch (e) { }
}

function playTickSound() {
    if (!rouletteSettings.soundEnabled || !rouletteSettings.tickSoundEnabled) return;
    try {
        initAudio(); const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.08 * rouletteSettings.soundVolume, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.12);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) { }
}

function playWinSound() {
    if (!rouletteSettings.soundEnabled || !rouletteSettings.winSoundEnabled) return;
    try {
        initAudio(); const notes = [{ freq: 523, dur: 0.15, del: 0 }, { freq: 659, dur: 0.15, del: 0.15 }, { freq: 784, dur: 0.15, del: 0.3 }, { freq: 1047, dur: 0.4, del: 0.45 }];
        notes.forEach(({ freq, dur, del }) => {
            const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
            osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
            filter.type = 'lowpass'; filter.frequency.setValueAtTime(2000, audioCtx.currentTime + del);
            osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, audioCtx.currentTime + del);
            gain.gain.setValueAtTime(0, audioCtx.currentTime + del); gain.gain.linearRampToValueAtTime(0.1 * rouletteSettings.soundVolume, audioCtx.currentTime + del + 0.02); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + del + dur);
            osc.start(audioCtx.currentTime + del); osc.stop(audioCtx.currentTime + del + dur + 0.1);
        });
    } catch (e) { }
}

// ==================== УВЕДОМЛЕНИЯ ====================
function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications'); if (!container) return;
    const notification = document.createElement('div'); notification.className = `notification notification-${type}`; notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => { notification.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => notification.remove(), 300); }, 3000);
}

// ==================== ЭКСПОРТ/ИМПОРТ ====================
function exportData() {
    const data = { players, games, rouletteMode, rouletteSettings, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `challenge-hub-backup-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url); showNotification('Данные экспортированы', 'success');
}

function importData() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.players && data.games) {
                    players = data.players; games = data.games;
                    if (data.rouletteMode) rouletteMode = data.rouletteMode;
                    if (data.rouletteSettings) rouletteSettings = { ...rouletteSettings, ...data.rouletteSettings };
                    saveAll(); saveSettings(); switchTab(currentTab);
                    showNotification('Данные импортированы', 'success');
                } else showNotification('Неверный формат', 'error');
            } catch (error) { showNotification('Ошибка импорта', 'error'); }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', init);