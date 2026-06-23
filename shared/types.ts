// Brauser IDE - Shared Types

export interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified?: Date;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  modified: FileChange[];
  untracked: FileChange[];
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  index: string;
  worktree: string;
}

export interface ServerStatus {
  name: 'apache' | 'mysql' | 'php';
  status: 'running' | 'stopped' | 'error';
  port: number;
  pid?: number;
}

export interface TerminalConfig {
  id: string;
  name: string;
  cwd: string;
  shell: string;
}

export interface EditorConfig {
  theme: 'vs-dark' | 'vs-light' | 'hc-black';
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn';
  minimap: boolean;
  lineNumbers: boolean;
}

export interface BrauserConfig {
  editor: EditorConfig;
  terminal: TerminalConfig[];
  servers: {
    apache: { port: number; documentRoot: string };
    mysql: { port: number; host: string; user: string };
  };
  git: {
    defaultBranch: string;
    autoFetch: boolean;
  };
}

export interface DatabaseQuery {
  sql: string;
  database?: string;
}

export interface QueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  affectedRows?: number;
}