# Brauser IDE

Браузер с интегрированной IDE для разработки веб-проектов.

## Возможности

### Браузер
- Встроенный Chromium браузер
- Управление вкладками
- История и закладки
- Инструменты разработчика

### IDE
- Редактор кода на базе Monaco Editor
- Подсветка синтаксиса для 50+ языков
- Автодополнение и интеллектуальный анализ кода
- Файловый менеджер
- Встроенный терминал
- Интеграция с Git

### Серверы
- Встроенная сборка XAMPP
- Apache HTTP Server
- MySQL Database
- PHP Runtime
- PHPMyAdmin

### Инструменты разработчика
- Встроенный терминал
- Управление серверами
- Работа с базами данных
- Git интеграция

## Установка

### Из исходников

```bash
# Клонировать репозиторий
git clone https://github.com/username/brauser-ide.git
cd brauser-ide

# Установить зависимости
npm install

# Запустить в режиме разработки
npm run dev
```

### Сборка дистрибутива

```bash
# Собрать для текущей платформы
npm run build

# Упаковать в установщик
npm run package
```

## Использование

### Основные функции

1. **Открытие файла**: Ctrl+O или через меню File
2. **Сохранение файла**: Ctrl+S
3. **Новый файл**: Ctrl+N
4. **Терминал**: Ctrl+Shift+`
5. **Git**: Через меню Git или панель Source Control

### Управление серверами

1. **Запуск Apache**: Menu > Servers > Start Apache
2. **Запуск MySQL**: Menu > Servers > Start MySQL
3. **PHPMyAdmin**: Menu > Servers > Open PHPMyAdmin

### Git операции

1. **Инициализация**: Menu > Git > Initialize Repository
2. **Коммит**: Через панель Source Control
3. **Push/Pull**: Через меню Git

## Структура проекта

```
brauser-ide/
├── electron/          # Electron приложение
├── backend/           # Python backend
├── ide/               # IDE компоненты
├── servers/           # Серверные компоненты
├── assets/            # Ресурсы
├── docs/              # Документация
└── tests/             # Тесты
```

## Технологии

- **Electron** - Кроссплатформенное приложение
- **Monaco Editor** - Редактор кода
- **xterm.js** - Терминал
- **FastAPI** - Python backend
- **Apache** - HTTP сервер
- **MySQL** - База данных
- **PHP** - Язык программирования

## Разработка

### Предустановленные инструменты

- Node.js 18+
- Python 3.10+
- Git

### Команды

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Сборка
npm run build

# Тесты
npm test

# Линтинг
npm run lint
```

## Лицензия

MIT License