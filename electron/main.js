const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { execSync, spawn } = require("child_process");
const os = require("os");

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-dev-shm-usage");

let mainWindow = null;
let phpProcess = null;

// ===== Paths =====
const SERVERS_DIR = path.join(__dirname, "..", "servers");
const WWW_DIR = path.join(SERVERS_DIR, "www");
const CONFIG_DIR = path.join(SERVERS_DIR, "config");
const LOGS_DIR = path.join(SERVERS_DIR, "logs");
const STATE_FILE = path.join(app.getPath("userData"), "state.json");

// ===== State Management =====
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {}
  return { lastFolder: null, openFiles: [], recentFolders: [], previewUrl: "" };
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

let appState = loadState();

const LANG_MAP = {
  php: { ext: ["php"], lang: "php", run: "php", server: true },
  js: { ext: ["js", "mjs", "cjs"], lang: "javascript", run: "node", server: false },
  ts: { ext: ["ts", "tsx"], lang: "typescript", run: "ts-node", server: false },
  python: { ext: ["py"], lang: "python", run: "python3", server: false },
  html: { ext: ["html", "htm"], lang: "html", run: null, server: false },
  css: { ext: ["css", "scss", "less"], lang: "css", run: null, server: false },
  ruby: { ext: ["rb"], lang: "ruby", run: "ruby", server: false },
  go: { ext: ["go"], lang: "go", run: "go run", server: false },
  rust: { ext: ["rs"], lang: "rust", run: "cargo run", server: false },
  java: { ext: ["java"], lang: "java", run: "javac", server: false },
  shell: { ext: ["sh", "bash"], lang: "shell", run: "bash", server: false },
  sql: { ext: ["sql"], lang: "sql", run: null, server: false },
  json: { ext: ["json"], lang: "json", run: null, server: false },
  xml: { ext: ["xml"], lang: "xml", run: null, server: false },
  md: { ext: ["md", "mdx"], lang: "markdown", run: null, server: false },
};

function detectLanguage(filePath) {
  const ext = filePath.split(".").pop().toLowerCase();
  for (const [, info] of Object.entries(LANG_MAP)) {
    if (info.ext.includes(ext)) return info;
  }
  return { ext: [ext], lang: "plaintext", run: null, server: false };
}

function getLanguage(filePath) {
  return detectLanguage(filePath).lang;
}

function getRunner(filePath) {
  return detectLanguage(filePath).run;
}

function needsServer(filePath) {
  return detectLanguage(filePath).server;
}

// ===== Folder Scanning =====
const INDEX_FILES = [
  "index.html",
  "index.php",
  "index.htm",
  "index.js",
  "index.ts",
  "index.py",
  "app.js",
  "server.js",
  "main.py",
  "manage.py",
];
const PROJECT_MARKERS = {
  "composer.json": "php",
  "package.json": "node",
  "requirements.txt": "python",
  Gemfile: "ruby",
  "go.mod": "go",
  "Cargo.toml": "rust",
  "pom.xml": "java",
};

function scanFolder(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return { error: "Folder not found" };

    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = items.filter((i) => i.isFile()).map((i) => i.name);
    const dirs = items.filter((i) => i.isDirectory()).map((i) => i.name);

    // Find index file
    let indexFile = null;
    for (const idx of INDEX_FILES) {
      if (files.includes(idx)) {
        indexFile = idx;
        break;
      }
    }

    // Detect project type from config files
    let projectType = null;
    for (const [marker, type] of Object.entries(PROJECT_MARKERS)) {
      if (files.includes(marker)) {
        projectType = type;
        break;
      }
    }

    // Detect dominant language from files
    const langCounts = {};
    for (const f of files) {
      const ext = f.split(".").pop().toLowerCase();
      const info = detectLanguage(f);
      if (info.lang !== "plaintext") {
        langCounts[info.lang] = (langCounts[info.lang] || 0) + 1;
      }
    }
    const dominantLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Determine what server to start
    let serverType = null;
    if (projectType === "php" || dominantLang === "php" || files.some((f) => f.endsWith(".php")))
      serverType = "php";
    else if (projectType === "node" || files.includes("server.js") || files.includes("app.js"))
      serverType = "node";
    else if (projectType === "python" || files.some((f) => f.endsWith(".py")))
      serverType = "python";
    else if (files.some((f) => f.endsWith(".html") || f.endsWith(".htm"))) serverType = "static";

    // Find entry points for each language
    let entryPoints = {};
    if (files.includes("server.js")) entryPoints.node = "server.js";
    if (files.includes("app.js")) entryPoints.node = "app.js";
    if (files.includes("manage.py")) entryPoints.python = "manage.py";
    if (files.includes("main.py")) entryPoints.python = "main.py";
    if (files.includes("app.py")) entryPoints.python = "app.py";
    if (files.includes("index.php")) entryPoints.php = "index.php";

    return {
      path: dirPath,
      files,
      dirs,
      indexFile,
      projectType,
      dominantLang,
      serverType,
      entryPoints,
      langCounts,
    };
  } catch (e) {
    return { error: e.message };
  }
}

function buildPreviewUrl(folderInfo, port) {
  if (!folderInfo || folderInfo.error) return null;

  // For PHP/Node/Python projects, use HTTP server
  if (
    folderInfo.serverType === "php" ||
    folderInfo.serverType === "node" ||
    folderInfo.serverType === "python"
  ) {
    return `http://localhost:${port}`;
  }

  // For static HTML, use file:// protocol
  if (folderInfo.indexFile) {
    return `file://${path.join(folderInfo.path, folderInfo.indexFile)}`;
  }

  return null;
}

// ===== Server Management =====

function isPortUsed(port) {
  try {
    const r = execSync(
      `ss -tlnp sport = :${port} 2>/dev/null || netstat -tlnp 2>/dev/null | grep :${port}`,
      { timeout: 3000, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
    );
    return r.includes(":" + port);
  } catch {
    return false;
  }
}

function isProcessRunning(name) {
  try {
    execSync(`pgrep -x ${name}`, { timeout: 2000, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function startPhpDevServer(port = 8080, dir = WWW_DIR) {
  stopPhpDevServer();
  try {
    const php = findPhp();
    if (!php) return { success: false, error: "PHP not found" };
    if (isPortUsed(String(port))) return { success: false, error: `Port ${port} already in use` };

    // Always serve from SERVERS_DIR so phpmyadmin/ and project/ are both accessible
    const serveDir = SERVERS_DIR;

    // Create symlink: servers/active-project → user's folder
    const linkPath = path.join(SERVERS_DIR, 'active-project');
    try { fs.unlinkSync(linkPath); } catch {}
    try { fs.symlinkSync(dir, linkPath); } catch (e) {
      // If symlink fails, copy index files as fallback
      console.log('Symlink failed, using direct serve from:', dir);
    }

    phpProcess = spawn(php, ["-S", `0.0.0.0:${port}`, "-t", serveDir], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PHP_CLI_SERVER_WORKERS: "4" },
    });
    phpProcess.unref();
    phpProcess.on("error", (e) => {
      console.error("PHP server error:", e.message);
      phpProcess = null;
    });
    phpProcess.on("exit", (code) => {
      console.log("PHP server exited with code", code);
      phpProcess = null;
    });

    return new Promise((resolve) => {
      setTimeout(() => {
        if (phpProcess && !phpProcess.killed) {
          resolve({ success: true, port });
        } else if (isPortUsed(String(port))) {
          resolve({ success: true, port });
        } else {
          resolve({ success: false, error: "PHP server failed to start" });
        }
      }, 1000);
    });
  } catch (e) {
    return { success: false, error: e.message };
  }
}
      }, 1000);
    });
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function stopPhpDevServer() {
  if (phpProcess) {
    try {
      phpProcess.kill("SIGTERM");
    } catch {}
    phpProcess = null;
  }
  // Also kill any orphaned php -S processes on the port
  try {
    if (process.platform === "win32") {
      execSync("taskkill /F /IM php.exe 2>nul", { timeout: 3000, stdio: "ignore" });
    } else {
      // Kill only php -S processes, not all php
      execSync('pkill -f "php -S"', { timeout: 3000, stdio: "ignore" });
    }
  } catch {}
}

function isPhpServerRunning() {
  if (phpProcess && !phpProcess.killed) return true;
  // Check if port 8080 is in use (might be from previous session)
  return isPortUsed("8080");
}

function findPhp() {
  const candidates =
    process.platform === "win32"
      ? ["php", "C:\\php\\php.exe"]
      : ["php", "/usr/bin/php", "/usr/local/bin/php", "/opt/homebrew/bin/php"];
  for (const c of candidates) {
    try {
      execSync(`${c} --version`, { timeout: 3000, stdio: "ignore" });
      return c;
    } catch {}
  }
  return null;
}

function findNode() {
  try {
    execSync("node --version", { timeout: 3000, stdio: "ignore" });
    return "node";
  } catch {}
  return null;
}

function findPython() {
  const candidates = process.platform === "win32" ? ["python", "python3"] : ["python3", "python"];
  for (const c of candidates) {
    try {
      execSync(`${c} --version`, { timeout: 3000, stdio: "ignore" });
      return c;
    } catch {}
  }
  return null;
}

function isServiceInstalled(name) {
  try {
    if (process.platform === "linux") {
      // Check if binary exists
      try {
        execSync(`which ${name}`, { timeout: 3000, stdio: "ignore" });
        return true;
      } catch {}
      // Check package manager
      try {
        execSync(`pacman -Qi ${name} 2>/dev/null`, { timeout: 5000, stdio: "ignore" });
        return true;
      } catch {}
      try {
        execSync(`dpkg -l ${name} 2>/dev/null`, { timeout: 5000, stdio: "ignore" });
        return true;
      } catch {}
      try {
        execSync(`rpm -q ${name} 2>/dev/null`, { timeout: 5000, stdio: "ignore" });
        return true;
      } catch {}
      return false;
    }
    if (process.platform === "darwin") {
      execSync(`which ${name}`, { timeout: 3000, stdio: "ignore" });
      return true;
    }
    if (process.platform === "win32") {
      // Check common Windows paths
      const paths = [
        "C:\\xampp\\mysql\\bin\\mysqld.exe",
        "C:\\Program Files\\MySQL",
        "C:\\Program Files (x86)\\MySQL",
      ];
      return paths.some((p) => fs.existsSync(p));
    }
    return false;
  } catch {
    return false;
  }
}

function checkServers() {
  const php = !!findPhp();
  const phpServer = isPhpServerRunning();

  // Check MySQL - try multiple names
  let mysql = false;
  let mysqlInstalled = false;
  const mysqlBinaries = ["mysqld", "mysql", "mariadbd", "mariadb"];
  const mysqlServices = ["mysqld", "mysql", "mariadbd", "mariadb"];
  for (const name of mysqlBinaries) {
    if (isProcessRunning(name)) {
      mysql = true;
      break;
    }
  }
  if (!mysql) mysql = isPortUsed("3306");
  for (const name of mysqlServices) {
    if (isServiceInstalled(name)) {
      mysqlInstalled = true;
      break;
    }
  }
  // Also check if the systemd service exists
  if (!mysqlInstalled) {
    try {
      execSync("systemctl list-unit-files mariadb.service 2>/dev/null | grep -q mariadb", {
        timeout: 3000,
        stdio: "ignore",
      });
      mysqlInstalled = true;
    } catch {}
  }

  // Check Apache - try multiple names
  let apache = false;
  let apacheInstalled = false;
  const apacheBinaries = ["apache2", "httpd", "nginx", "caddy"];
  const apacheServices = ["apache2", "httpd", "nginx", "caddy"];
  for (const name of apacheBinaries) {
    if (isProcessRunning(name)) {
      apache = true;
      break;
    }
  }
  if (!apache) apache = isPortUsed("80") || isPortUsed("443");
  for (const name of apacheServices) {
    if (isServiceInstalled(name)) {
      apacheInstalled = true;
      break;
    }
  }
  // Also check if the systemd service exists
  if (!apacheInstalled) {
    try {
      execSync("systemctl list-unit-files httpd.service 2>/dev/null | grep -q httpd", {
        timeout: 3000,
        stdio: "ignore",
      });
      apacheInstalled = true;
    } catch {}
  }

  return {
    php,
    phpServer,
    mysql,
    mysqlInstalled,
    apache,
    apacheInstalled,
    platform: process.platform,
  };
}

function startService(name) {
  // Map friendly names to actual systemd service names
  const serviceMap = {
    apache2: "httpd",
    httpd: "httpd",
    mysqld: "mariadb",
    mysql: "mariadb",
    mariadb: "mariadb",
    mariadbd: "mariadb",
    nginx: "nginx",
  };
  const service = serviceMap[name] || name;

  try {
    if (process.platform === "linux") {
      try {
        execSync(`sudo systemctl start ${service}`, { timeout: 10000, stdio: "pipe" });
        return { success: true };
      } catch (e) {
        // Try without sudo
        try {
          execSync(`systemctl --user start ${service}`, { timeout: 10000, stdio: "pipe" });
          return { success: true };
        } catch {}
        return { success: false, error: `Could not start ${service}. May require sudo.` };
      }
    }
    if (process.platform === "darwin") {
      execSync(`brew services start ${service} 2>/dev/null || sudo apachectl start`, {
        timeout: 10000,
        stdio: "pipe",
      });
      return { success: true };
    }
    return { success: false, error: "Service management not supported on this platform" };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function stopService(name) {
  const serviceMap = {
    apache2: "httpd",
    httpd: "httpd",
    mysqld: "mariadb",
    mysql: "mariadb",
    mariadb: "mariadb",
    mariadbd: "mariadb",
    nginx: "nginx",
  };
  const service = serviceMap[name] || name;

  try {
    if (process.platform === "linux") {
      try {
        execSync(`sudo systemctl stop ${service}`, { timeout: 10000, stdio: "pipe" });
        return { success: true };
      } catch (e) {
        try {
          execSync(`systemctl --user stop ${service}`, { timeout: 10000, stdio: "pipe" });
          return { success: true };
        } catch {}
        return { success: false, error: `Could not stop ${service}. May require sudo.` };
      }
    }
    if (process.platform === "darwin") {
      execSync(`brew services stop ${service} 2>/dev/null || sudo apachectl stop`, {
        timeout: 10000,
        stdio: "pipe",
      });
      return { success: true };
    }
    return { success: false, error: "Service management not supported on this platform" };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ===== Create Window =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: "Brauser IDE",
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#1e1e1e",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      webSecurity: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, "..", "ide", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    stopPhpDevServer();
    mainWindow = null;
  });

  // Save state before close
  mainWindow.on("close", () => {
    mainWindow?.webContents.send("save-state-request");
  });

  buildMenu();
  mainWindow.setMenu(null);
  setupIPC();
}

function buildMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        { label: "New File", accelerator: "CmdOrCtrl+N", click: () => send("new-file") },
        { label: "Open File", accelerator: "CmdOrCtrl+O", click: () => send("open-file") },
        {
          label: "Open Folder",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => send("open-folder"),
        },
        { type: "separator" },
        { label: "Save", accelerator: "CmdOrCtrl+S", click: () => send("save") },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: () => send("toggle-sidebar"),
        },
        {
          label: "Toggle Terminal",
          accelerator: "CmdOrCtrl+`",
          click: () => send("toggle-terminal"),
        },
        { label: "Refresh Preview", accelerator: "F5", click: () => send("refresh-preview") },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Servers",
      submenu: [
        { label: "Start PHP Server", click: () => send("start-php-server") },
        { label: "Stop PHP Server", click: () => send("stop-php-server") },
        { type: "separator" },
        { label: "Start Apache", click: () => send("start-apache") },
        { label: "Stop Apache", click: () => send("stop-apache") },
        { type: "separator" },
        { label: "Start MySQL", click: () => send("start-mysql") },
        { label: "Stop MySQL", click: () => send("stop-mysql") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function send(channel, ...args) {
  mainWindow?.webContents.send(channel, ...args);
}

// ===== IPC =====
function setupIPC() {
  // Window
  ipcMain.handle("win:minimize", () => mainWindow?.minimize());
  ipcMain.handle("win:maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle("win:close", () => mainWindow?.close());
  mainWindow.on("maximize", () => send("win:maximized", true));
  mainWindow.on("unmaximize", () => send("win:maximized", false));

  // Menu
  let menuVisible = false;
  ipcMain.handle("menu:toggle", () => {
    menuVisible = !menuVisible;
    mainWindow?.setMenu(menuVisible ? Menu.buildFromTemplate([]) : null);
    return menuVisible;
  });

  // File System
  ipcMain.handle("fs:read", (_, p) => {
    try {
      return { success: true, content: fs.readFileSync(p, "utf-8") };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("fs:write", (_, p, c) => {
    try {
      const d = path.dirname(p);
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(p, c, "utf-8");
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("fs:list", (_, p) => {
    try {
      if (!fs.existsSync(p)) return { success: false, error: "Not found" };
      const items = fs
        .readdirSync(p, { withFileTypes: true })
        .filter((i) => !i.name.startsWith(".") && i.name !== "node_modules")
        .map((i) => ({
          name: i.name,
          path: path.join(p, i.name),
          isDir: i.isDirectory(),
          size: i.isFile() ? fs.statSync(path.join(p, i.name)).size : 0,
        }));
      return { success: true, items };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("fs:mkdir", (_, p) => {
    try {
      fs.mkdirSync(p, { recursive: true });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("fs:delete", (_, p) => {
    try {
      if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true });
      else fs.unlinkSync(p);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("fs:rename", (_, o, n) => {
    try {
      fs.renameSync(o, n);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Dialogs
  ipcMain.handle("dialog:open-file", async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ["openFile"] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle("dialog:open-folder", async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
    return r.canceled ? null : r.filePaths[0];
  });

  // Servers
  ipcMain.handle("servers:status", () => checkServers());
  ipcMain.handle("servers:start-php", (_, port, dir) => startPhpDevServer(port, dir || WWW_DIR));
  ipcMain.handle("servers:stop-php", () => {
    stopPhpDevServer();
    return { success: true };
  });
  ipcMain.handle("servers:php-running", () => isPhpServerRunning());
  ipcMain.handle("servers:start-apache", () => startService("apache2"));
  ipcMain.handle("servers:stop-apache", () => stopService("apache2"));
  ipcMain.handle("servers:start-mysql", () => startService("mysqld"));
  ipcMain.handle("servers:stop-mysql", () => stopService("mysqld"));

  // Language detection
  ipcMain.handle("lang:detect", (_, filePath) => detectLanguage(filePath));
  ipcMain.handle("lang:get", (_, filePath) => getLanguage(filePath));
  ipcMain.handle("lang:runner", (_, filePath) => getRunner(filePath));
  ipcMain.handle("lang:needs-server", (_, filePath) => needsServer(filePath));

  // State
  ipcMain.handle("state:save", (_, data) => {
    appState = { ...appState, ...data };
    saveState(appState);
    return { success: true };
  });
  ipcMain.handle("state:load", () => appState);
  ipcMain.handle("state:get-www-dir", () => WWW_DIR);

  // Folder scanning
  ipcMain.handle("folder:scan", (_, dirPath) => scanFolder(dirPath));
  ipcMain.handle("folder:build-url", (_, folderInfo, port) => buildPreviewUrl(folderInfo, port));

  // Git
  ipcMain.handle("git:status", (_, cwd) => {
    try {
      return {
        success: true,
        output: execSync("git status --porcelain", { cwd, encoding: "utf-8", timeout: 5000 }),
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("git:branch", (_, cwd) => {
    try {
      return {
        success: true,
        branch: execSync("git branch --show-current", {
          cwd,
          encoding: "utf-8",
          timeout: 5000,
        }).trim(),
      };
    } catch (e) {
      return { success: false };
    }
  });
  ipcMain.handle("git:commit", (_, cwd, msg) => {
    try {
      execSync("git add .", { cwd, timeout: 10000 });
      return {
        success: true,
        output: execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, {
          cwd,
          encoding: "utf-8",
          timeout: 10000,
        }),
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("git:init", (_, cwd) => {
    try {
      return {
        success: true,
        output: execSync("git init", { cwd, encoding: "utf-8", timeout: 5000 }),
      };
    } catch (e) {
      return { success: false };
    }
  });

  // Shell
  ipcMain.handle("shell:open", (_, url) => {
    shell.openExternal(url);
    return { success: true };
  });
  ipcMain.handle("shell:open-path", (_, p) => {
    shell.openPath(p);
    return { success: true };
  });
  ipcMain.handle("shell:get-install-cmd", (_, pkg) => {
    if (process.platform === "linux") {
      // Detect package manager
      if (fs.existsSync("/usr/bin/pacman")) return { cmd: `sudo pacman -S ${pkg}` };
      if (fs.existsSync("/usr/bin/apt")) return { cmd: `sudo apt install ${pkg}` };
      if (fs.existsSync("/usr/bin/dnf")) return { cmd: `sudo dnf install ${pkg}` };
      if (fs.existsSync("/usr/bin/zypper")) return { cmd: `sudo zypper install ${pkg}` };
    }
    return { cmd: null };
  });

  // Terminal - run command (non-blocking, streaming)
  ipcMain.handle("term:run", (_, cmd, cwd) => {
    return new Promise((resolve) => {
      const isLongRunning =
        /\b(php\s+-S|python\s+-m\s+http|node\s+server|npm\s+run\s+dev|npm\s+start|yarn\s+dev|watch|serve|forever|pm2)\b/.test(
          cmd,
        );

      if (isLongRunning) {
        // Background process - don't wait
        try {
          const parts = cmd.split(/\s+/);
          const proc = spawn(parts[0], parts.slice(1), {
            cwd: cwd || WWW_DIR,
            detached: true,
            stdio: "ignore",
            env: { ...process.env, TERM: "xterm-256color" },
          });
          proc.unref();
          resolve({ success: true, output: `[Background] ${cmd}\n[PID: ${proc.pid}]`, bg: true });
        } catch (e) {
          resolve({ success: false, output: e.message });
        }
      } else {
        // Regular command - wait for completion
        let stdout = "",
          stderr = "";
        try {
          const proc = spawn("sh", ["-c", cmd], {
            cwd: cwd || WWW_DIR,
            env: { ...process.env, TERM: "xterm-256color" },
            timeout: 30000,
          });
          proc.stdout.on("data", (d) => {
            stdout += d.toString();
          });
          proc.stderr.on("data", (d) => {
            stderr += d.toString();
          });
          proc.on("close", (code) => {
            resolve({ success: code === 0, output: stdout + (stderr ? "\n" + stderr : ""), code });
          });
          proc.on("error", (e) => {
            resolve({ success: false, output: e.message });
          });
        } catch (e) {
          resolve({ success: false, output: e.message });
        }
      }
    });
  });

  // Terminal - kill background process
  ipcMain.handle("term:kill", (_, pid) => {
    try {
      process.kill(pid, "SIGTERM");
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // Terminal - list background processes
  ipcMain.handle("term:list-bg", () => {
    return { processes: [] };
  });
}

// ===== Single Instance =====
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindow);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
