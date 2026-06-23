// Brauser IDE - Shared Constants

export const APP_NAME = 'Brauser IDE';
export const APP_VERSION = '1.0.0';

// IPC Channels
export const IPC_CHANNELS = {
  // Browser
  BROWSER_CREATE_TAB: 'browser:create-tab',
  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_CLOSE_TAB: 'browser:close-tab',
  BROWSER_GO_BACK: 'browser:go-back',
  BROWSER_GO_FORWARD: 'browser:go-forward',
  BROWSER_RELOAD: 'browser:reload',

  // Editor
  EDITOR_OPEN_FILE: 'editor:open-file',
  EDITOR_SAVE_FILE: 'editor:save-file',
  EDITOR_CLOSE_FILE: 'editor:close-file',

  // Git
  GIT_STATUS: 'git:status',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_BRANCH: 'git:branch',
  GIT_CHECKOUT: 'git:checkout',
  GIT_LOG: 'git:log',

  // Servers
  SERVER_STATUS: 'server:status',
  SERVER_START: 'server:start',
  SERVER_STOP: 'server:stop',
  SERVER_PHPMYADMIN: 'server:phpmyadmin',

  // File System
  FS_READ: 'fs:read',
  FS_WRITE: 'fs:write',
  FS_LIST: 'fs:list',
  FS_MKDIR: 'fs:mkdir',
  FS_DELETE: 'fs:delete',
  FS_RENAME: 'fs:rename',
  FS_WATCH: 'fs:watch',

  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_CLOSE: 'terminal:close',

  // Database
  DB_QUERY: 'db:query',
  DB_LIST: 'db:list',
  DB_TABLES: 'db:tables',
  DB_DESCRIBE: 'db:describe'
} as const;

// File Extensions
export const FILE_EXTENSIONS = {
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  typescript: ['.ts', '.tsx'],
  php: ['.php'],
  html: ['.html', '.htm'],
  css: ['.css', '.scss', '.less'],
  json: ['.json'],
  markdown: ['.md', '.mdx'],
  python: ['.py'],
  ruby: ['.rb'],
  java: ['.java'],
  cpp: ['.cpp', '.c', '.h', '.hpp'],
  go: ['.go'],
  rust: ['.rs'],
  shell: ['.sh', '.bash'],
  sql: ['.sql'],
  xml: ['.xml'],
  yaml: ['.yml', '.yaml'],
  text: ['.txt']
} as const;

// Languages for Monaco Editor
export const MONACO_LANGUAGES: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.php': 'php',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.json': 'json',
  '.md': 'markdown',
  '.py': 'python',
  '.rb': 'ruby',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.go': 'go',
  '.rs': 'rust',
  '.sh': 'shell',
  '.sql': 'sql',
  '.xml': 'xml',
  '.yml': 'yaml',
  '.yaml': 'yaml'
};

// Default Ports
export const DEFAULT_PORTS = {
  APACHE: 80,
  MYSQL: 3306,
  BACKEND: 8000,
  PHPMYADMIN: 8080
} as const;

// Default Config
export const DEFAULT_CONFIG = {
  editor: {
    theme: 'vs-dark' as const,
    fontSize: 14,
    fontFamily: 'Fira Code, Consolas, monospace',
    tabSize: 4,
    wordWrap: 'off' as const,
    minimap: true,
    lineNumbers: true
  },
  servers: {
    apache: {
      port: DEFAULT_PORTS.APACHE,
      documentRoot: './public'
    },
    mysql: {
      port: DEFAULT_PORTS.MYSQL,
      host: 'localhost',
      user: 'root'
    }
  },
  git: {
    defaultBranch: 'main',
    autoFetch: true
  }
};