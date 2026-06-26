const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  close: () => ipcRenderer.invoke('win:close'),
  onMaximized: (cb) => ipcRenderer.on('win:maximized', (_, v) => cb(v)),

  // Menu
  toggleMenu: () => ipcRenderer.invoke('menu:toggle'),

  // Actions from native menu
  on: (channel, cb) => {
    const valid = ['new-file','open-file','open-folder','save','toggle-sidebar','toggle-terminal','refresh-preview','start-php-server','stop-php-server','start-apache','stop-apache','start-mysql','stop-mysql','save-state-request'];
    if (valid.includes(channel)) { ipcRenderer.on(channel, () => cb()); return () => ipcRenderer.removeListener(channel, () => cb()); }
  },

  // File System
  readFile: (p) => ipcRenderer.invoke('fs:read', p),
  writeFile: (p, c) => ipcRenderer.invoke('fs:write', p, c),
  listDir: (p) => ipcRenderer.invoke('fs:list', p),
  mkdir: (p) => ipcRenderer.invoke('fs:mkdir', p),
  deleteFile: (p) => ipcRenderer.invoke('fs:delete', p),
  rename: (o, n) => ipcRenderer.invoke('fs:rename', o, n),

  // Dialogs
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),

  // Servers
  serverStatus: () => ipcRenderer.invoke('servers:status'),
  startPhpServer: (port, dir) => ipcRenderer.invoke('servers:start-php', port, dir),
  stopPhpServer: () => ipcRenderer.invoke('servers:stop-php'),
  isPhpRunning: () => ipcRenderer.invoke('servers:php-running'),
  startApache: () => ipcRenderer.invoke('servers:start-apache'),
  stopApache: () => ipcRenderer.invoke('servers:stop-apache'),
  startMysql: () => ipcRenderer.invoke('servers:start-mysql'),
  stopMysql: () => ipcRenderer.invoke('servers:stop-mysql'),
  getWwwDir: () => ipcRenderer.invoke('state:get-www-dir'),

  // Language
  detectLang: (p) => ipcRenderer.invoke('lang:detect', p),
  getLang: (p) => ipcRenderer.invoke('lang:get', p),
  getRunner: (p) => ipcRenderer.invoke('lang:runner', p),
  needsServer: (p) => ipcRenderer.invoke('lang:needs-server', p),

  // State
  saveState: (data) => ipcRenderer.invoke('state:save', data),
  loadState: () => ipcRenderer.invoke('state:load'),

  // Folder scanning
  scanFolder: (p) => ipcRenderer.invoke('folder:scan', p),
  buildPreviewUrl: (info, port) => ipcRenderer.invoke('folder:build-url', info, port),

  // Git
  gitStatus: (cwd) => ipcRenderer.invoke('git:status', cwd),
  gitBranch: (cwd) => ipcRenderer.invoke('git:branch', cwd),
  gitCommit: (cwd, msg) => ipcRenderer.invoke('git:commit', cwd, msg),
  gitInit: (cwd) => ipcRenderer.invoke('git:init', cwd),

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  openPath: (p) => ipcRenderer.invoke('shell:open-path', p),
  getInstallCmd: (pkg) => ipcRenderer.invoke('shell:get-install-cmd', pkg),

  // Terminal (node-pty)
  termCreate: (cwd) => ipcRenderer.invoke('term:create', cwd),
  termWrite: (id, data) => ipcRenderer.invoke('term:write', id, data),
  termResize: (id, cols, rows) => ipcRenderer.invoke('term:resize', id, cols, rows),
  termKill: (id) => ipcRenderer.invoke('term:kill', id),
  onTermData: (cb) => ipcRenderer.on('term:data', (_, id, data) => cb(id, data)),

  platform: process.platform
});
