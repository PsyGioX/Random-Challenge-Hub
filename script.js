// ==================== RANDOM CHALLENGE HUB ====================

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

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
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
        if (!menu.classList.contains('hidden')) {
            setTimeout(() => document.addEventListener('click', closeFloatingMenu), 100);
        }
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

    modalConfirm.onclick = () => {
        if (modalCallback) modalCallback();
        closeModal();
    };

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

    showConfirmModal('🗑️ Сброс кеша', 'Вы уверены, что хотите очистить кеш браузера? Все сохраненные данные будут удалены, и приложение вернется к настройкам по умолчанию.', 'СБРОСИТЬ КЕШ', 'ОТМЕНА', () => clearCache());
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
        saveAll();
        updateWheelSegments();
        switchTab('games');
        showNotification('✅ Кеш успешно очищен!', 'success');
    } catch (error) {
        showNotification('❌ Ошибка при очистке кеша', 'error');
    }
}

function confirmResetAll() {
    const menu = document.getElementById('floatingMenu');
    if (menu) menu.classList.add('hidden');

    showConfirmModal('🔄 Полный сброс', 'Это действие удалит ВСЕ данные: игры, задания и игроков. Восстановить данные будет невозможно.', 'СБРОСИТЬ ВСЁ', 'ОТМЕНА', () => resetAllData());
}

function resetAllData() {
    try {
        players = [];
        games = {};
        localStorage.removeItem('challengePlayers');
        localStorage.removeItem('challengeGames');
        sessionStorage.clear();

        gameFirstState = { active: false, selectedGame: null, currentPlayerIndex: 0, assignedTasks: {} };
        updateWheelSegments();
        switchTab('games');
        showNotification('🔄 Все данные полностью сброшены!', 'warning');
    } catch (error) {
        showNotification('❌ Ошибка при сбросе данных', 'error');
    }
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
    }

    content.style.animation = 'none';
    content.offsetHeight;
    content.style.animation = 'fadeInUp 0.4s ease';
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
        dropdown.classList.remove('hidden');
        if (arrow) arrow.textContent = '▼';
        openDropdowns[safeId] = true;
    } else {
        dropdown.classList.add('hidden');
        if (arrow) arrow.textContent = '▶';
        openDropdowns[safeId] = false;
    }
}

function quickAddTask(gameName) {
    const safeId = gameName.replace(/[^a-zA-Z0-9]/g, '_');
    const input = document.getElementById(`quickTask_${safeId}`);
    if (!input) return;

    const task = input.value.trim();
    if (!task) { showNotification('Введите описание задания', 'error'); return; }
    if (!games[gameName]) { showNotification('Игра не найдена', 'error'); return; }

    games[gameName].push(task);
    saveAll();
    input.value = '';
    openDropdowns[safeId] = true;

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
                <button onclick="exportData()" class="cyber-btn export-btn">📤 Экспорт данных</button>
                <button onclick="importData()" class="cyber-btn import-btn">📥 Импорт данных</button>
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
                    <div class="game-header-left">
                        <span class="dropdown-arrow" id="arrow_${safeId}">▶</span>
                        <h4 class="game-name">🎮 ${game}</h4>
                    </div>
                    <div class="game-header-right">
                        <span class="task-count">${tasks.length} заданий</span>
                        <button onclick="event.stopPropagation(); deleteGame('${game.replace(/'/g, "\\'")}')" class="delete-btn" title="Удалить игру">🗑️</button>
                    </div>
                </div>
                <div class="tasks-dropdown hidden" id="dropdown_${safeId}">
                    <div class="tasks-list">
                        ${tasks.map((task, index) => `
                            <div class="task-item">
                                <span class="task-number">#${index + 1}</span>
                                <span class="task-text">${task}</span>
                                <button onclick="deleteTask('${game.replace(/'/g, "\\'")}', ${index})" class="delete-task-btn">×</button>
                            </div>
                        `).join('')}
                    </div>
                    ${tasks.length === 0 ? '<p class="empty-text">Нет заданий</p>' : ''}
                    <div class="task-actions">
                        <input type="text" id="quickTask_${safeId}" placeholder="Быстрое задание..." class="cyber-input" onkeypress="if(event.key==='Enter') quickAddTask('${game.replace(/'/g, "\\'")}')">
                        <br><button onclick="quickAddTask('${game.replace(/'/g, "\\'")}')" class="cyber-btn add-btn" style="margin-top: 4px; width: 100%;">+ Быстрое задание</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function addGame() {
    const input = document.getElementById('newGame');
    if (!input) return;
    const name = input.value.trim();
    if (!name) { showNotification('Введите название игры', 'error'); return; }
    if (games[name]) { showNotification('Такая игра уже существует', 'warning'); return; }
    games[name] = [];
    saveAll();
    switchTab('games');
    showNotification(`Игра "${name}" добавлена`, 'success');
}

function addTask() {
    const gameSelect = document.getElementById('gameList');
    const taskInput = document.getElementById('newTask');
    if (!gameSelect || !taskInput) return;
    const game = gameSelect.value;
    const task = taskInput.value.trim();
    if (!task) { showNotification('Введите описание задания', 'error'); return; }
    if (!games[game]) { showNotification('Выберите игру', 'error'); return; }
    games[game].push(task);
    saveAll();
    switchTab('games');
    showNotification('Задание добавлено', 'success');
}

function deleteGame(gameName) {
    showConfirmModal('🗑️ Удаление игры', `Удалить игру "${gameName}" и все её задания?`, 'УДАЛИТЬ', 'ОТМЕНА', () => {
        delete games[gameName];
        saveAll();
        switchTab('games');
        showNotification(`Игра "${gameName}" удалена`, 'warning');
    });
}

function deleteTask(gameName, taskIndex) {
    if (!games[gameName]) return;
    const taskText = games[gameName][taskIndex];
    showConfirmModal('🗑️ Удаление задания', `Удалить задание "${taskText}"?`, 'УДАЛИТЬ', 'ОТМЕНА', () => {
        games[gameName].splice(taskIndex, 1);
        saveAll();
        switchTab('games');
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
                <div class="players-grid" id="playersGrid">
                    ${players.length === 0 ? '<p class="empty-text">Нет добавленных игроков</p>' : players.map((player, index) => {
        const colorData = playerColors[player.color] || playerColors['indigo'];
        return `<div class="player-card" style="border-color: ${colorData.name}"><div class="player-avatar" style="background: ${colorData.gradient}">${player.name[0].toUpperCase()}</div><div class="player-info"><span class="player-name" style="color: ${colorData.name}">${player.name}</span><span class="player-color">${colorData.label}</span></div><button onclick="deletePlayer(${index})" class="delete-btn">🗑️</button></div>`;
    }).join('')}
                </div>
            </div>
            <div class="panel-actions">
                <button onclick="clearAllPlayers()" class="cyber-btn danger-btn" ${players.length === 0 ? 'disabled' : ''}>Очистить список</button>
            </div>
        </div>
    `;
}

function addPlayer() {
    const nameInput = document.getElementById('newPlayer');
    const colorSelect = document.getElementById('playerColor');
    if (!nameInput || !colorSelect) return;
    const name = nameInput.value.trim();
    const color = colorSelect.value;
    if (!name) { showNotification('Введите имя игрока', 'error'); return; }
    if (players.some(p => p.name === name)) { showNotification('Игрок с таким именем уже существует', 'warning'); return; }
    players.push({ name, color, stats: { gamesPlayed: 0, tasksCompleted: 0 } });
    saveAll();
    switchTab('players');
    showNotification(`Игрок "${name}" добавлен`, 'success');
}

function deletePlayer(index) {
    const playerName = players[index]?.name || 'Неизвестный';
    showConfirmModal('🗑️ Удаление игрока', `Удалить игрока "${playerName}"?`, 'УДАЛИТЬ', 'ОТМЕНА', () => {
        players.splice(index, 1);
        saveAll();
        switchTab('players');
        showNotification(`Игрок "${playerName}" удален`, 'warning');
    });
}

function clearAllPlayers() {
    if (players.length === 0) return;
    showConfirmModal('🗑️ Очистка списка', `Удалить ВСЕХ игроков (${players.length} чел.)?`, 'ОЧИСТИТЬ ВСЕХ', 'ОТМЕНА', () => {
        players = [];
        saveAll();
        switchTab('players');
        showNotification('Список игроков очищен', 'warning');
    });
}

// ==================== ВКЛАДКА РУЛЕТКИ ====================
function renderRouletteTab() {
    const availableGames = Object.entries(games).filter(([_, tasks]) => tasks.length > 0);
    const totalGamesCount = Object.keys(games).length;
    const totalTasksCount = Object.values(games).reduce((sum, tasks) => sum + tasks.length, 0);

    let modeInfo = '';
    let canSpin = true;
    let spinButtonText = '🎰 ЗАПУСТИТЬ РУЛЕТКУ';
    let wheelHidden = false;

    if (gameFirstState.active && gameFirstState.selectedGame) {
        const currentPlayer = players[gameFirstState.currentPlayerIndex];
        const remainingTasks = getRemainingTasksForGame(gameFirstState.selectedGame);
        const assignedCount = Object.keys(gameFirstState.assignedTasks).length;
        const totalPlayersCount = players.length;
        const allPlayersAssigned = assignedCount >= totalPlayersCount;
        const noTasksLeft = remainingTasks.length === 0;
        const progressPercent = Math.round((assignedCount / totalPlayersCount) * 100);

        if (allPlayersAssigned || noTasksLeft) {
            canSpin = false;
            spinButtonText = '✅ ВСЕ ЗАДАНИЯ РАСПРЕДЕЛЕНЫ';
            wheelHidden = true;
        } else if (currentPlayer) {
            spinButtonText = `🎰 КРУТИТЬ ДЛЯ: ${currentPlayer.name}`;
        }

        modeInfo = `
            <div class="game-first-status">
                <div class="progress-container">
                    <div class="progress-header"><span class="progress-label">Прогресс распределения</span><span class="progress-value">${assignedCount}/${totalPlayersCount} (${progressPercent}%)</span></div>
                    <div class="progress-bar"><div class="progress-fill" style="width: ${progressPercent}%"></div></div>
                </div>
                <div class="status-card selected-game-card"><div class="status-card-icon">🎮</div><div class="status-card-content"><span class="status-card-label">Выбранная игра</span><span class="status-card-value">${gameFirstState.selectedGame}</span></div></div>
                ${currentPlayer && !allPlayersAssigned && !noTasksLeft ? `<div class="status-card current-player-card"><div class="status-card-icon">👤</div><div class="status-card-content"><span class="status-card-label">Сейчас крутит</span><span class="status-card-value" style="color: ${playerColors[currentPlayer?.color]?.name || '#6366f1'}">${currentPlayer.name}</span></div><div class="player-color-dot" style="background: ${playerColors[currentPlayer.color]?.name || '#6366f1'}"></div></div>` : ''}
                <div class="stats-row"><div class="stat-mini"><span class="stat-mini-icon">📋</span><span class="stat-mini-text">Осталось: <strong>${remainingTasks.length}</strong></span></div><div class="stat-mini"><span class="stat-mini-icon">✅</span><span class="stat-mini-text">Назначено: <strong>${assignedCount}</strong></span></div></div>
                ${assignedCount > 0 ? `<div class="assigned-tasks-section"><div class="section-subtitle" onclick="toggleAssignedTasks()"><span class="dropdown-arrow" id="assignedArrow">▶</span><span>Назначенные задания (${assignedCount})</span></div><div class="assigned-tasks-list hidden" id="assignedTasksList">${Object.entries(gameFirstState.assignedTasks).map(([pName, pTask], idx) => { const player = players.find(p => p.name === pName); const colorData = playerColors[player?.color] || playerColors['indigo']; return `<div class="assigned-task-row"><span class="assigned-task-number">#${idx + 1}</span><span class="assigned-player-name" style="color: ${colorData.name}">${pName}</span><span class="assigned-task-divider">→</span><span class="assigned-task-text">${pTask}</span></div>`; }).join('')}</div></div>` : ''}
                ${allPlayersAssigned || noTasksLeft ? `<div class="completion-notice"><div class="completion-icon">🎉</div><p class="completion-text">Все задания распределены!</p><p class="completion-subtext">${assignedCount} из ${totalPlayersCount} игроков получили задания</p><div class="completion-actions"><br><button onclick="showFinalResults()" class="cyber-btn add-btn">📋 ПОКАЗАТЬ РЕЗУЛЬТАТЫ</button><button onclick="resetGameFirstMode()" class="cyber-btn danger-btn">🔄 НАЧАТЬ ЗАНОВО</button></div></div>` : ''}
            </div>
        `;
    }

    return `
        <div class="roulette-panel">
            <div class="roulette-info">
                <div class="mode-selector">
                    <p class="roulette-mode">🎲 <span class="neon-text">РЕЖИМ РУЛЕТКИ</span></p>
                    <div class="mode-buttons">
                        <button onclick="setRouletteMode('full')" class="mode-btn ${rouletteMode === 'full' ? 'active' : ''}"><span class="mode-btn-icon">🎰</span><span class="mode-btn-text">Полный рандом</span><span class="mode-btn-desc">Игра + задание + игрок</span></button>
                        <button onclick="setRouletteMode('game-first')" class="mode-btn ${rouletteMode === 'game-first' ? 'active' : ''}"><span class="mode-btn-icon">🎯</span><span class="mode-btn-text">Сначала игра</span><span class="mode-btn-desc">Игра → задания для всех</span></button>
                    </div>
                </div>
                <p class="roulette-hint">${rouletteMode === 'full' ? 'Случайная игра + случайное задание + случайный игрок' : 'Сначала выбирается игра, затем каждый игрок крутит рулетку'}</p>
                ${modeInfo}
            </div>
            ${!gameFirstState.active ? `<div class="pre-spin-stats"><div class="pre-stat-item"><span class="pre-stat-icon">🎮</span><span class="pre-stat-text">Игр: <strong>${totalGamesCount}</strong></span></div><div class="pre-stat-item"><span class="pre-stat-icon">📋</span><span class="pre-stat-text">Заданий: <strong>${totalTasksCount}</strong></span></div><div class="pre-stat-item"><span class="pre-stat-icon">👥</span><span class="pre-stat-text">Игроков: <strong>${players.length}</strong></span></div></div>` : ''}
            <div class="wheel-container" id="wheelContainer" style="transition: all 0.5s ease; ${wheelHidden ? 'opacity: 0; transform: scale(0.8); pointer-events: none; max-height: 0; overflow: hidden; margin: 0;' : 'opacity: 1; transform: scale(1); max-height: 500px;'}">
                <canvas id="rouletteWheel" width="400" height="400"></canvas>
                <div class="wheel-pointer">▼</div>
                <div id="wheelResultPopup" class="wheel-result-popup hidden"><div class="popup-content"><div class="popup-game"></div><div class="popup-player"></div><div class="popup-task"></div></div></div>
            </div>
            <div class="roulette-controls">
                <button onclick="startSpin()" class="cyber-btn spin-btn" ${spinning || !canSpin ? 'disabled' : ''}>${spinButtonText}</button><br>
                ${gameFirstState.active && canSpin ? `<br><button onclick="resetGameFirstMode()" class="cyber-btn danger-btn outline-btn">🔄 Сбросить и начать заново</button>` : ''}
                <p class="spin-hint">${availableGames.length === 0 ? '⚠️ Добавьте игры с заданиями' : totalTasksCount === 0 ? '⚠️ Добавьте задания' : players.length === 0 ? '⚠️ Добавьте игроков' : `✅ Готово: ${totalGamesCount} игр, ${totalTasksCount} заданий, ${players.length} игроков`}</p>
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
    const resultDiv = document.getElementById('spinResult');
    if (resultDiv) resultDiv.classList.add('hidden');
    if (currentTab === 'roulette') switchTab('roulette');
    showNotification(`Режим: ${mode === 'full' ? 'Полный рандом' : 'Сначала игра'}`, 'info');
}

function resetGameFirstMode() {
    gameFirstState = { active: false, selectedGame: null, currentPlayerIndex: 0, assignedTasks: {} };
    updateWheelSegments(); renderWheel(); showWheel();
    const resultDiv = document.getElementById('spinResult');
    if (resultDiv) resultDiv.classList.add('hidden');
    switchTab('roulette');
    showNotification('Режим сброшен', 'info');
}

function updateWheelSegments() {
    const allTasks = [];
    Object.entries(games).forEach(([gameName, tasks]) => tasks.forEach(task => allTasks.push({ game: gameName, task })));
    wheelSegments = allTasks.map((item, index) => ({ label: item.game, task: item.task, game: item.game, color: getSegmentColor(index, allTasks.length) }));
    if (wheelSegments.length === 0) wheelSegments = [{ label: 'Нет заданий', task: 'Добавьте задания', game: 'Нет игры', color: '#94a3b8' }];
}

function updateWheelSegmentsForGame(gameName) {
    const remainingTasks = getRemainingTasksForGame(gameName);
    if (remainingTasks.length === 0) { wheelSegments = [{ label: 'Все задания розданы', task: 'Нет доступных заданий', game: gameName, color: '#94a3b8' }]; return; }
    wheelSegments = remainingTasks.map((task, index) => ({ label: `Задание ${index + 1}`, task, game: gameName, color: getSegmentColor(index, remainingTasks.length) }));
}

function getSegmentColor(index, total) {
    const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];
    return colors[index % colors.length];
}

function renderWheel() {
    const canvas = document.getElementById('rouletteWheel');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2, centerY = canvas.height / 2, radius = 170;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const outerGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    outerGradient.addColorStop(0, '#6366f1'); outerGradient.addColorStop(0.5, '#8b5cf6'); outerGradient.addColorStop(1, '#6366f1');
    ctx.beginPath(); ctx.arc(centerX, centerY, radius + 15, 0, Math.PI * 2); ctx.strokeStyle = outerGradient; ctx.lineWidth = 4; ctx.shadowColor = '#6366f1'; ctx.shadowBlur = 25; ctx.stroke(); ctx.shadowBlur = 0;

    if (wheelSegments.length > 0) {
        const segmentAngle = (Math.PI * 2) / wheelSegments.length;
        wheelSegments.forEach((segment, index) => {
            const startAngle = index * segmentAngle + currentWheelAngle, endAngle = startAngle + segmentAngle;
            ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, radius, startAngle, endAngle); ctx.closePath();
            const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius);
            gradient.addColorStop(0, segment.color); gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.4)'); gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
            ctx.fillStyle = gradient; ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 2; ctx.stroke();
            ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(startAngle + segmentAngle / 2);
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            let displayLabel = segment.label; if (displayLabel.length > 14) displayLabel = displayLabel.substring(0, 12) + '..';
            ctx.fillText(displayLabel, radius * 0.65, 0); ctx.restore();
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
    if (players.length < 1) { showNotification('Добавьте минимум 1 игрока', 'error'); return; }
    if (rouletteMode === 'game-first' && gameFirstState.active) {
        const remainingTasks = getRemainingTasksForGame(gameFirstState.selectedGame);
        const assignedCount = Object.keys(gameFirstState.assignedTasks).length;
        if (remainingTasks.length === 0 || assignedCount >= players.length) { showNotification('Все задания распределены!', 'warning'); return; }
    }

    const allTasks = [];
    Object.entries(games).forEach(([gameName, tasks]) => tasks.forEach(task => allTasks.push({ game: gameName, task })));
    if (allTasks.length === 0) { showNotification('Добавьте задания для игр', 'error'); return; }

    spinning = true;
    const spinBtn = document.querySelector('.spin-btn'); if (spinBtn) spinBtn.disabled = true;
    const resultDiv = document.getElementById('spinResult'); if (resultDiv) resultDiv.classList.add('hidden');
    const popup = document.getElementById('wheelResultPopup'); if (popup) popup.classList.add('hidden');

    if (rouletteMode === 'game-first') {
        if (!gameFirstState.active) startGameFirstInitial(allTasks);
        else startGameFirstSpin();
    } else startFullRandomMode(allTasks);
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
        showPopupResult(selectedGame, selectedPlayer, selectedTask);
        showResult(selectedGame, selectedPlayer, selectedTask);
        updatePlayerStats(selectedPlayer.name);
        playWinSound(); finishSpin();
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
        showPopupResult(gameFirstState.selectedGame, currentPlayer, selectedTask);
        showResult(gameFirstState.selectedGame, currentPlayer, selectedTask);
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
        wheelContainer.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        wheelContainer.style.opacity = '0'; wheelContainer.style.transform = 'scale(0.8)';
        wheelContainer.style.maxHeight = '0'; wheelContainer.style.margin = '0';
        wheelContainer.style.pointerEvents = 'none'; wheelContainer.style.overflow = 'hidden';
    }
}

function showWheel() {
    const wheelContainer = document.getElementById('wheelContainer');
    if (wheelContainer) {
        wheelContainer.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        wheelContainer.style.opacity = '1'; wheelContainer.style.transform = 'scale(1)';
        wheelContainer.style.maxHeight = '500px'; wheelContainer.style.margin = '';
        wheelContainer.style.pointerEvents = 'auto'; wheelContainer.style.overflow = '';
    }
}

function showFinalResults() {
    const assignedCount = Object.keys(gameFirstState.assignedTasks).length;
    if (assignedCount === 0 && gameFirstState.active) { showNotification('Нет назначенных заданий', 'warning'); return; }
    const unassignedPlayers = players.filter(p => !gameFirstState.assignedTasks[p.name]);
    if (unassignedPlayers.length > 0 && gameFirstState.active) showNotification('⚠️ Не все игроки получили задания!', 'warning');
    else if (gameFirstState.active) showNotification('🎉 Все игроки получили задания!', 'success');

    const resultDiv = document.getElementById('spinResult');
    const resultContent = document.getElementById('resultContent');
    const resultActions = document.getElementById('resultActions');
    if (!resultDiv || !resultContent) return;

    resultContent.innerHTML = `
        <div class="final-result-header">
            <div class="final-game-info"><span class="final-game-icon">🎮</span><span class="final-game-name">${gameFirstState.selectedGame}</span></div>
            <div class="final-stats"><span class="final-stat-badge success">✅ ${assignedCount} назначено</span>${unassignedPlayers.length > 0 ? `<span class="final-stat-badge warning">⚠️ ${unassignedPlayers.length} без заданий</span>` : ''}</div>
        </div>
        <div class="final-results-list">
            <div class="final-results-title">📋 Распределение заданий (${assignedCount}/${players.length})</div>
            <div class="final-results-grid">
                ${Object.entries(gameFirstState.assignedTasks).map(([pName, pTask], idx) => {
        const player = players.find(p => p.name === pName);
        const colorData = playerColors[player?.color] || playerColors['indigo'];
        return `<div class="final-result-row"><span class="final-result-number">#${idx + 1}</span><span class="final-result-player" style="color: ${colorData.name}">${pName}</span><span class="final-result-arrow">→</span><span class="final-result-task">${pTask}</span></div>`;
    }).join('')}
            </div>
        </div>
        ${unassignedPlayers.length > 0 ? `<div class="unassigned-warning"><p class="unassigned-warning-title">⚠️ Игроки без заданий</p><div class="unassigned-players-list">${unassignedPlayers.map(p => { const colorData = playerColors[p.color] || playerColors['indigo']; return `<span class="unassigned-player-tag" style="border-color: ${colorData.name}; color: ${colorData.name}">${p.name}</span>`; }).join('')}</div><p class="unassigned-warning-hint">Добавьте больше заданий для игры "${gameFirstState.selectedGame}"</p></div>` : ''}
    `;

    if (resultActions) resultActions.innerHTML = `<br><button onclick="resetGameFirstMode()" class="cyber-btn add-btn">🔄 НАЧАТЬ ЗАНОВО</button><button onclick="exportResults()" class="cyber-btn export-btn">📤 Экспортировать результаты</button>`;
    resultDiv.classList.remove('hidden');
    resultDiv.style.animation = 'none'; resultDiv.offsetHeight; resultDiv.style.animation = 'fadeInUp 0.5s ease';
    switchTab('roulette');
}

function exportResults() {
    if (!gameFirstState.selectedGame) return;
    let text = `🎮 Игра: ${gameFirstState.selectedGame}\n📋 Распределение заданий:\n────────────────────────\n`;
    Object.entries(gameFirstState.assignedTasks).forEach(([playerName, task]) => text += `👤 ${playerName}: ${task}\n`);
    text += `────────────────────────\n📅 ${new Date().toLocaleString()}\n`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `challenge-results-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
    showNotification('Результаты экспортированы', 'success');
}

function spinWheel(tasks, targetIndex, callback) {
    if (tasks.length === 0) { if (callback) callback(); return; }
    const segmentAngle = (Math.PI * 2) / tasks.length;
    const targetAngle = targetIndex * segmentAngle + segmentAngle / 2;
    const spins = 5 + Math.floor(Math.random() * 5);
    const totalRotation = spins * Math.PI * 2 + (Math.PI * 2 - targetAngle);
    animateWheel(totalRotation, callback);
}

function finishSpin() {
    spinning = false;
    const spinBtn = document.querySelector('.spin-btn'); if (spinBtn) spinBtn.disabled = false;
}

function animateWheel(totalRotation, callback) {
    const canvas = document.getElementById('rouletteWheel');
    if (!canvas) { if (callback) callback(); return; }
    const duration = 4000, startTime = Date.now(), startAngle = currentWheelAngle;
    let tickSoundPlayed = false;

    function animate() {
        const elapsed = Date.now() - startTime, progress = Math.min(elapsed / duration, 1);
        let easeOut;
        if (progress < 0.7) easeOut = 1 - Math.pow(1 - progress / 0.7, 2);
        else if (progress < 0.9) { const p = (progress - 0.7) / 0.2; easeOut = 1 - Math.pow(1 - p, 4) * 0.3; }
        else {
            const p = (progress - 0.9) / 0.1, tickCount = 8, tickProgress = Math.floor(p * tickCount) / tickCount;
            easeOut = 0.95 + tickProgress * 0.05;
            if (!tickSoundPlayed && p > 0.5) { playTickSound(); tickSoundPlayed = true; }
        }
        currentWheelAngle = startAngle + totalRotation * easeOut;
        renderWheel();
        if (progress < 1) animationId = requestAnimationFrame(animate);
        else { currentWheelAngle = (startAngle + totalRotation) % (Math.PI * 2); renderWheel(); animationId = null; if (callback) callback(); }
    }
    playSpinSound();
    animationId = requestAnimationFrame(animate);
}

function showPopupResult(game, player, task) {
    const popup = document.getElementById('wheelResultPopup');
    if (!popup) return;
    const colorData = playerColors[player.color] || playerColors['indigo'];
    const popupGame = popup.querySelector('.popup-game'), popupPlayer = popup.querySelector('.popup-player'), popupTask = popup.querySelector('.popup-task');
    if (popupGame) popupGame.textContent = `🎮 ${game}`;
    if (popupPlayer) { popupPlayer.textContent = `👤 ${player.name}`; popupPlayer.style.color = colorData.name; }
    if (popupTask) popupTask.textContent = `⚡ ${task}`;
    popup.classList.remove('hidden');
    popup.style.animation = 'none'; popup.offsetHeight; popup.style.animation = 'popupBounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    setTimeout(() => {
        if (popup) { popup.style.animation = 'popupFadeOut 0.5s ease forwards'; setTimeout(() => { popup.classList.add('hidden'); popup.style.animation = ''; }, 500); }
    }, 5000);
}

function showResult(game, player, task) {
    const resultDiv = document.getElementById('spinResult'), resultContent = document.getElementById('resultContent'), resultActions = document.getElementById('resultActions');
    if (!resultDiv || !resultContent) return;
    const colorData = playerColors[player.color] || playerColors['indigo'];
    resultContent.innerHTML = `<div class="result-grid"><div class="result-card-item game-result"><div class="result-card-icon">🎮</div><div class="result-card-label">Игра</div><div class="result-card-value">${game}</div></div><div class="result-card-item player-result"><div class="result-card-icon">👤</div><div class="result-card-label">Игрок</div><div class="result-card-value" style="color: ${colorData.name}; font-weight: 700;">${player.name}</div></div><div class="result-card-item task-result"><div class="result-card-icon">⚡</div><div class="result-card-label">Задание</div><div class="result-card-value task-highlight">${task}</div></div></div>`;
    if (resultActions) {
        if (gameFirstState.active) {
            const nextPlayer = players[gameFirstState.currentPlayerIndex], remainingTasks = getRemainingTasksForGame(gameFirstState.selectedGame);
            resultActions.innerHTML = nextPlayer && remainingTasks.length > 0 ? `<br><button onclick="startSpin()" class="cyber-btn add-btn">🔄 СЛЕДУЮЩИЙ: ${nextPlayer.name}</button>` : `<button onclick="showFinalResults()" class="cyber-btn add-btn">📋 ПОКАЗАТЬ ВСЕ РЕЗУЛЬТАТЫ</button>`;
        } else resultActions.innerHTML = `<br><button onclick="startSpin()" class="cyber-btn add-btn">🔄 КРУТИТЬ ЕЩЁ РАЗ</button>`;
    }
    resultDiv.classList.remove('hidden'); resultDiv.style.animation = 'none'; resultDiv.offsetHeight; resultDiv.style.animation = 'fadeInUp 0.5s ease';
}

function updatePlayerStats(playerName) {
    const player = players.find(p => p.name === playerName);
    if (player) { player.stats.gamesPlayed++; player.stats.tasksCompleted++; saveAll(); }
}

// ==================== ВКЛАДКА СТАТИСТИКИ ====================
function renderStatsTab() {
    const totalGames = Object.keys(games).length;
    const totalTasks = Object.values(games).reduce((sum, tasks) => sum + tasks.length, 0);
    const totalPlayers = players.length;
    const mostActivePlayer = players.reduce((max, player) => (player.stats.gamesPlayed > (max?.stats?.gamesPlayed || 0)) ? player : max, null);

    return `
        <div class="stats-panel">
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalGames}</div><div class="stat-label">Игр</div></div>
                <div class="stat-card"><div class="stat-value">${totalTasks}</div><div class="stat-label">Заданий</div></div>
                <div class="stat-card"><div class="stat-value">${totalPlayers}</div><div class="stat-label">Игроков</div></div>
            </div>
            ${mostActivePlayer ? `<div class="top-player"><h3>👑 Самый активный игрок</h3><div class="player-highlight"><span class="highlight-name">${mostActivePlayer.name}</span> - <span class="highlight-stats">${mostActivePlayer.stats.gamesPlayed} игр сыграно</span></div></div>` : ''}
            <div class="players-stats"><h3>📊 Статистика игроков</h3>${players.length === 0 ? '<p class="empty-text">Нет данных</p>' : players.map(player => `<div class="player-stats-row"><span class="player-stats-name">${player.name}</span><div class="stats-bar"><div class="stats-fill" style="width: ${Math.min(player.stats.gamesPlayed * 10, 100)}%"></div></div><span class="player-stats-count">${player.stats.gamesPlayed} игр</span></div>`).join('')}</div>
        </div>
    `;
}

// ==================== ЗВУКОВЫЕ ЭФФЕКТЫ ====================
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

function playSpinSound() {
    try {
        initAudio(); const duration = 2;
        const oscillator = audioCtx.createOscillator(), gainNode = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        oscillator.connect(filter); filter.connect(gainNode); gainNode.connect(audioCtx.destination);
        oscillator.type = 'sawtooth'; filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, audioCtx.currentTime); filter.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + duration);
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime); oscillator.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + duration);
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime); gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
        oscillator.start(audioCtx.currentTime); oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) { }
}

function playTickSound() {
    try {
        initAudio();
        const oscillator = audioCtx.createOscillator(), gainNode = audioCtx.createGain();
        oscillator.connect(gainNode); gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime); oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) { }
}

function playWinSound() {
    try {
        initAudio(); const notes = [523, 659, 784, 1047], duration = 0.2;
        notes.forEach((freq, index) => {
            const oscillator = audioCtx.createOscillator(), gainNode = audioCtx.createGain();
            oscillator.connect(gainNode); gainNode.connect(audioCtx.destination);
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime + index * duration);
            gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime + index * duration);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + index * duration + 0.3);
            oscillator.start(audioCtx.currentTime + index * duration);
            oscillator.stop(audioCtx.currentTime + index * duration + 0.3);
        });
    } catch (e) { }
}

// ==================== УВЕДОМЛЕНИЯ ====================
function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    if (!container) return;
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => { notification.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => notification.remove(), 300); }, 3000);
}

// ==================== ЭКСПОРТ/ИМПОРТ ДАННЫХ ====================
function exportData() {
    const data = { players, games, rouletteMode, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `challenge-hub-backup-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    showNotification('Данные экспортированы', 'success');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.players && data.games) {
                    players = data.players; games = data.games;
                    if (data.rouletteMode) rouletteMode = data.rouletteMode;
                    saveAll(); switchTab(currentTab);
                    showNotification('Данные импортированы успешно', 'success');
                } else showNotification('Неверный формат файла', 'error');
            } catch (error) { showNotification('Ошибка при импорте', 'error'); }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ==================== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ====================
document.addEventListener('DOMContentLoaded', init);