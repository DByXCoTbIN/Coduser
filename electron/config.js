const Store = require('electron-store');
const { DEFAULT_CONFIG } = require('../shared/constants');

class ConfigManager {
  constructor() {
    this.store = new Store({
      defaults: {
        editor: DEFAULT_CONFIG.editor,
        servers: DEFAULT_CONFIG.servers,
        git: DEFAULT_CONFIG.git,
        terminal: {
          shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
          fontSize: 14,
          fontFamily: 'Fira Code, Consolas, monospace'
        },
        window: {
          width: 1400,
          height: 900,
          x: undefined,
          y: undefined,
          isMaximized: false
        }
      }
    });
  }

  // Editor config
  getEditorConfig() {
    return this.store.get('editor');
  }

  setEditorConfig(config) {
    this.store.set('editor', { ...this.getEditorConfig(), ...config });
  }

  getEditorTheme() {
    return this.store.get('editor.theme');
  }

  setEditorTheme(theme) {
    this.store.set('editor.theme', theme);
  }

  // Server config
  getServerConfig(server) {
    return this.store.get(`servers.${server}`);
  }

  setServerConfig(server, config) {
    this.store.set(`servers.${server}`, { ...this.getServerConfig(server), ...config });
  }

  getApachePort() {
    return this.store.get('servers.apache.port');
  }

  setApachePort(port) {
    this.store.set('servers.apache.port', port);
  }

  getMySQLPort() {
    return this.store.get('servers.mysql.port');
  }

  setMySQLPort(port) {
    this.store.set('servers.mysql.port', port);
  }

  // Git config
  getGitConfig() {
    return this.store.get('git');
  }

  setGitConfig(config) {
    this.store.set('git', { ...this.getGitConfig(), ...config });
  }

  getDefaultBranch() {
    return this.store.get('git.defaultBranch');
  }

  setDefaultBranch(branch) {
    this.store.set('git.defaultBranch', branch);
  }

  // Terminal config
  getTerminalConfig() {
    return this.store.get('terminal');
  }

  setTerminalConfig(config) {
    this.store.set('terminal', { ...this.getTerminalConfig(), ...config });
  }

  getTerminalShell() {
    return this.store.get('terminal.shell');
  }

  setTerminalShell(shell) {
    this.store.set('terminal.shell', shell);
  }

  // Window config
  getWindowConfig() {
    return this.store.get('window');
  }

  setWindowConfig(config) {
    this.store.set('window', { ...this.getWindowConfig(), ...config });
  }

  // Recent files
  getRecentFiles() {
    return this.store.get('recentFiles', []);
  }

  addRecentFile(filePath) {
    const recentFiles = this.getRecentFiles();
    const filtered = recentFiles.filter(f => f !== filePath);
    filtered.unshift(filePath);
    this.store.set('recentFiles', filtered.slice(0, 10));
  }

  clearRecentFiles() {
    this.store.set('recentFiles', []);
  }

  // Recent folders
  getRecentFolders() {
    return this.store.get('recentFolders', []);
  }

  addRecentFolder(folderPath) {
    const recentFolders = this.getRecentFolders();
    const filtered = recentFolders.filter(f => f !== folderPath);
    filtered.unshift(folderPath);
    this.store.set('recentFolders', filtered.slice(0, 10));
  }

  clearRecentFolders() {
    this.store.set('recentFolders', []);
  }

  // Open files
  getOpenFiles() {
    return this.store.get('openFiles', []);
  }

  setOpenFiles(files) {
    this.store.set('openFiles', files);
  }

  // Clear all data
  clearAll() {
    this.store.clear();
  }

  // Reset to defaults
  resetToDefaults() {
    this.store.clear();
  }
}

module.exports = new ConfigManager();