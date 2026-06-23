# Дневник разработки Brauser IDE

## 2025-01-XX - Начало проекта

### Задача: Создание структуры проекта и планирование

**Цель проекта:** Создать браузер с интегрированной IDE для разработки веб-проектов, включающий:
- Встроенный браузер на базе Electron
- IDE с интерфейсом как в VS Code
- Встроенную сборку XAMPP (Apache + MySQL + PHP)
- PHPMyAdmin для управления базами данных
- Полную интеграцию с Git

**Технические решения:**
- Electron для кроссплатформенности
- Python для backend части (управление серверами, Git)
- VS Code подобный интерфейс
- Встроенная сборка XAMPP

---

## [2025-01-XX 10:00] Создание структуры проекта

### Решения:
- Используем монорепозиторий с четкой организацией
- Основные компоненты выделены в отдельные модули
- Каждый компонент имеет свой package.json

### Созданные файлы:
- package.json - корневой конфиг
- electron/ - основное приложение
- backend/ - Python backend
- ide/ - IDE компоненты
- servers/ - управление серверами
- docs/ - документация

---

## [2025-01-XX 10:30] Детали реализации

### Electron компоненты:
- main.js - главный процесс Electron с меню и IPC
- preload.js - безопасный доступ к API из рендерера

### Python Backend:
- main.py - FastAPI сервер с API для Git, серверов, файлов, БД
- requirements.txt - зависимости Python

### IDE интерфейс:
- index.html - основной HTML файл
- styles/main.css - стили в стиле VS Code
- app.js - логика IDE (Monaco Editor, терминал, файловый менеджер)

### Конфигурация:
- .gitignore - исключения Git
- ARCHITECTURE.md - описание архитектуры
- TASKS.md - детальный план задач
- README.md - описание проекта

---

## [2025-01-XX 11:00] Архитектурные решения

### Монорепозиторий:
- Четкое разделение компонентов
- Каждый модуль может разрабатываться отдельно
- Общий конфиг для сборки

### Кроссплатформенность:
- Electron для UI (Windows, macOS, Linux)
- Python backend (кроссплатформенный)
- Встроенная сборка XAMPP для каждой ОС

### Безопасность:
- Context Isolation в Electron
- Preload скрипт для безопасного IPC
- Валидация на backend

---

## [2026-06-22 21:00] Выполнение задач по плану

### Фаза 1: Инфраструктура - ВЫПОЛНЕНА
- [x] ESLint + Prettier конфигурация (.eslintrc.json, .prettierrc)
- [x] TypeScript конфигурация (tsconfig.json)
- [x] Jest конфигурация (jest.config.js)
- [x] Shared модули (shared/types.ts, shared/constants.ts)
- [x] Electron main.js с полным меню и IPC
- [x] Electron preload.js с API для браузера, Git, серверов, файлов
- [x] Electron config.js (менеджер конфигурации)
- [x] Python Backend main.py (FastAPI, Git, серверы, файлы, БД)
- [x] Python Backend config.py (настройки)
- [x] .env.example для backend
- [x] setup.sh для backend

### Фаза 2: Браузер - ВЫПОЛНЕНА
- [x] BrowserViewManager.js - управление BrowserView
- [x] TabsManager.js - система вкладок
- [x] HistoryManager.js - история посещений
- [x] BookmarksManager.js - закладки
- [x] newtab.html - страница новых вкладок

### Фаза 3: IDE Интерфейс - ВЫПОЛНЕНА
- [x] index.html - полный HTML с меню, тулбаром, панелями
- [x] styles/main.css - основные стили (VS Code тема)
- [x] styles/editor.css - стили редактора
- [x] styles/panels.css - стили панелей
- [x] app.js - полная логика IDE:
  - Monaco Editor с темой brauser-dark
  - Подсветка синтаксиса PHP, JS, TS, Python, HTML, CSS
  - Терминал с xterm.js
  - Файловый менеджер с деревом файлов
  - Вкладки редактора
  - Git панель
  - Панель базы данных
  - Горячие клавиши
  - Контекстное меню

### Запуск проекта - УСПЕШЕН
- Electron запускается корректно с системным Electron v42.3.0
- GPU флаги добавлены для совместимости с Wayland
- Приложение открывает окно IDE

### Технические проблемы и решения:
1. **Electron npm пакет не скачивал бинарник** → Использован системный Electron
2. **GPU process crash в Wayland** → Добавлены флаги: --disable-gpu, --no-sandbox, --use-gl=swiftshader

---

## [2026-06-22 21:30] Изменение layout: Preview слева, Editor справа

### Что изменено:
- **Архитектура переработана**: Вместо классического VS Code layout
  - Левая панель: Live Preview (iframe с проектом)
  - Правая панель: Code Editor (Monaco)
- **Live Preview**:
  - Адресная строка с навигацией (назад/вперед/обновить)
  - Toggle устройств (Desktop/Tablet/Mobile)
  - Автообновление при сохранении файла (500ms debounce)
  - Поддержка file:// для статики, http:// для PHP
- **Auto-refresh**: При каждом сохранении (Ctrl+S) iframe перезагружается
- **Resize handles**: Можно менять пропорции preview/editor
- **Удалены**: editor.css, panels.css (все в main.css)
- **CSS полностью переписан**: одна секция main.css (~350 строк)

---

## [2026-06-22 21:55] XAMPP + Frameless + Alt-меню

### Что сделано:

#### 1. Frameless Window
- `frame: false` в BrowserWindow
- Кастомный titlebar с drag area
- Кнопки minimize/maximize/close в HTML (не стандартные OS)
- Кнопка maximize меняет иконку (square ↔ clone)

#### 2. Меню по Alt
- Меню скрыто по умолчанию (`class="hidden"`)
- При нажатии Alt — показывается/скрывается
- Все action'ы из меню отправляются через IPC: `ipcMain.on('action')`
- Клик вне меню закрывает его

#### 3. XAMPP кроссплатформенный (XamppManager)
- **Linux**: apt-get install apache2 php mysql-server
- **macOS**: brew install php mysql
- **Windows**: Проверка C:\xampp, системный PHP/MySQL
- Автоустановка при первом запуске (marker `.installed`)
- `php -S` встроенный сервер для preview
- Создание дефолтного `index.php` в www/
- API: startApache/stopApache, startMysql/stopMysql
- Статус серверов в statusbar

### Файлы:
- `electron/main.js` — переписан: frameless, XamppManager, IPC
- `electron/preload.js` — обновлён API: window, menu, xampp
- `ide/index.html` — обновлён: frameless titlebar, скрытое меню
- `ide/styles/main.css` — обновлён: стили для frameless и hidden menu
- `ide/app.js` — обновлён: Alt-menu, server commands, openFolder с PHP server

---

## [2026-06-22 22:08] Исправление ошибок + State + Terminal + XAMPP папка

### Исправлено:

#### 1. Preview не грузит мёртвые URL
- `refreshPreview()` проверяет `new URL(url)` перед загрузкой
- Если URL невалидный — показывает empty state
- Preview пуст при первом запуске (не пытается загрузить localhost:8080)

#### 2. Сохранение/восстановление проекта
- `state.json` в `userData` (lastFolder, openFiles, previewUrl)
- При закрытии окна: `save-state-request` → app.js сохраняет
- При запуске: `restoreState()` открывает последнюю папку и файлы

#### 3. Папка servers/ с XAMPP
```
servers/
├── apache/
├── mysql/
├── php/
├── phpmyadmin/
├── www/           ← project files
│   └── index.php  ← default
├── logs/
└── config/
    ├── apache.conf
    └── mysql.conf
```

#### 4. Автоопределение языка
- `detectLanguage(filePath)` — определяет по расширению
- Возвращает: language, runner, needsServer
- Поддержка: PHP, JS, TS, Python, Ruby, Go, Rust, Java, Shell, HTML, CSS, SQL

#### 5. Рабочий терминал
- HTML: `<div id="term-output">` + `<input id="term-input">`
- `termRun(cmd, cwd)` — IPC → `execSync(cmd)` → вывод
- Enter → выполнение → вывод → новый prompt
- CSS: prompt зелёный, input без рамки

#### 6. Автозапуск PHP-сервера
- При `openFolder()` автоматически стартует `php -S 0.0.0.0:8080`
- Preview URL = `http://localhost:8080`
- Preview обновляется через 1 сек после старта сервера

### Тест:
- [x] 0 ошибок при запуске
- [x] Frameless window работает
- [x] Alt menu toggle
- [x] Terminal с execSync