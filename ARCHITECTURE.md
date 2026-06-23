# Brauser IDE - Структура проекта

## Архитектура

```
brauser-ide/
├── electron/                    # Основное Electron приложение
│   ├── main.js                 # Главный процесс Electron
│   ├── preload.js              # Preload скрипт для безопасности
│   ├── browser/                # Компоненты браузера
│   │   ├── BrowserView.js     # Основной вид браузера
│   │   ├── TabsManager.js     # Управление вкладками
│   │   ├── HistoryManager.js  # История посещений
│   │   └── BookmarksManager.js # Закладки
│   ├── window/                 # Управление окнами
│   │   ├── MainWindow.js      # Главное окно
│   │   └── WindowManager.js   # Менеджер окон
│   └── ipc/                    # Межпроцессное взаимодействие
│       ├── handlers.js        # Обработчики IPC
│       └── channels.js        # Каналы IPC
│
├── backend/                    # Python backend
│   ├── main.py                # Точка входа FastAPI
│   ├── config.py              # Конфигурация
│   ├── requirements.txt       # Зависимости Python
│   ├── servers/               # Управление серверами
│   │   ├── manager.py         # Менеджер серверов
│   │   ├── apache.py          # Управление Apache
│   │   ├── mysql.py           # Управление MySQL
│   │   └── php.py             # Управление PHP
│   ├── git/                   # Git операции
│   │   ├── manager.py         # Менеджер Git
│   │   ├── operations.py      # Операции Git
│   │   └── diff.py            # Сравнение изменений
│   ├── filesystem/            # Файловые операции
│   │   ├── manager.py         # Менеджер файлов
│   │   └── watcher.py         # Наблюдатель за файлами
│   └── database/              # Работа с БД
│       ├── manager.py         # Менеджер БД
│       └── queries.py         # Запросы к БД
│
├── ide/                        # IDE компоненты
│   ├── package.json           # Конфигурация IDE
│   ├── src/                   # Исходный код
│   │   ├── main.ts            # Точка входа
│   │   ├── editor/            # Редактор кода
│   │   │   ├── EditorManager.js
│   │   │   ├── SyntaxHighlight.js
│   │   │   └── AutoComplete.js
│   │   ├── ui/                # Пользовательский интерфейс
│   │   │   ├── Sidebar.js     # Боковая панель
│   │   │   ├── StatusBar.js   # Строка состояния
│   │   │   ├── MenuBar.js     # Меню
│   │   │   └── Toolbar.js     # Панель инструментов
│   │   ├── panels/            # Панели
│   │   │   ├── FileExplorer.js # Проводник файлов
│   │   │   ├── Terminal.js    # Встроенный терминал
│   │   │   ├── GitPanel.js    # Панель Git
│   │   │   └── DatabasePanel.js # Панель БД
│   │   └── utils/             # Утилиты
│   │       ├── fileUtils.js   # Работа с файлами
│   │       └── themeManager.js # Управление темами
│   └── styles/                # Стили
│       ├── main.css           # Основные стили
│       └── themes/            # Темы оформления
│
├── servers/                    # Серверные компоненты
│   ├── xampp/                 # Встроенная сборка XAMPP
│   │   ├── apache/           # Apache HTTP Server
│   │   ├── mysql/            # MySQL Database
│   │   ├── php/              # PHP Runtime
│   │   └── phpmyadmin/       # PHPMyAdmin
│   ├── scripts/              # Скрипты управления
│   │   ├── start.sh          # Запуск серверов
│   │   ├── stop.sh           # Остановка серверов
│   │   └── restart.sh        # Перезапуск серверов
│   └── config/               # Конфигурация серверов
│       ├── apache.conf       # Конфиг Apache
│       ├── mysql.conf        # Конфиг MySQL
│       └── php.ini           # Конфиг PHP
│
├── assets/                     # Ресурсы приложения
│   ├── icons/                 # Иконки
│   │   ├── icon.ico          # Windows иконка
│   │   ├── icon.icns         # macOS иконка
│   │   └── icon.png          # Linux иконка
│   └── images/               # Изображения
│
├── docs/                       # Документация
│   ├── README.md             # Основной README
│   ├── INSTALL.md            # Инструкция по установке
│   ├── DEVELOPMENT.md        # Разработка
│   └── API.md                # API документация
│
├── tests/                      # Тесты
│   ├── electron/             # Тесты Electron
│   ├── backend/              # Тесты backend
│   └── ide/                  # Тесты IDE
│
├── scripts/                    # Утилиты сборки
│   ├── build.js              # Скрипт сборки
│   ├── package.js            # Скрипт упаковки
│   └── release.js            # Скрипт релиза
│
├── .gitignore                 # Игнорируемые файлы
├── .eslintrc.js              # Конфигурация ESLint
├── .prettierrc              # Конфигурация Prettier
├── tsconfig.json            # Конфигурация TypeScript
├── package.json             # Корневой package.json
└── README.md                # Описание проекта
```

## Компоненты

### 1. Electron Browser
- Встраиваемый Chromium браузер
- Управление вкладками
- История и закладки
- Инструменты разработчика

### 2. IDE Interface
- Редактор кода (Monaco Editor)
- Подсветка синтаксиса
- Автодополнение
- Файловый менеджер
- Встроенный терминал

### 3. Python Backend
- Управление серверами (Apache, MySQL)
- Git операции
- Файловые операции
- API для IDE

### 4. Server Management
- Встроенная сборка XAMPP
- PHPMyAdmin
- Управление конфигурациями