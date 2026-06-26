// Brauser IDE - app.js
// Preview | Editor | XAMPP | Auto-lang | Terminal | State



class IDE {
  constructor() {
    this.editor = null;
    this.file = null;
    this.folder = null;
    this.models = {};
    this.tabs = [];
    this.previewUrl = '';
    this.menuVisible = false;
    this.debounce = null;
    this.serverPort = 8080;
    this.termLines = [];
    this.folderInfo = null;    // scanned folder info
    this.livePreview = false;  // live preview toggle (off by default)
    this.term = null;          // xterm.js instance
    this.termId = null;        // pty session id
    this.fitAddon = null;      // xterm fit addon
  }

  async boot() {
    await this.initMonaco();
    this.bind();
    this.bindResize();
    this.bindContext();
    this.bindAltMenu();
    this.bindIpc();
    await this.restoreState();
    this.checkServers();
    this.updateLivePreviewIndicator();
    this.initTerminal();
  }

  // ===== Monaco =====
  initMonaco() {
    return new Promise(resolve => {
      require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
      require(['vs/editor/editor.main'], () => {
        monaco.editor.defineTheme('brauser', {
          base: 'vs-dark', inherit: true,
          rules: [
            { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'C586C0' },
            { token: 'string', foreground: 'CE9178' },
            { token: 'number', foreground: 'B5CEA8' },
            { token: 'type', foreground: '4EC9B0' },
            { token: 'function', foreground: 'DCDCAA' }
          ],
          colors: { 'editor.background': '#1e1e1e', 'editor.lineHighlightBackground': '#2A2D2E', 'editor.selectionBackground': '#264F78', 'editorLineNumber.foreground': '#858585' }
        });
        this.editor = monaco.editor.create(document.getElementById('editor'), {
          value: '', language: 'php', theme: 'brauser', automaticLayout: true,
          fontSize: 14, fontFamily: "'Fira Code',Consolas,monospace",
          minimap: { enabled: true }, lineNumbers: 'on', tabSize: 4, insertSpaces: true,
          bracketPairColorization: { enabled: true }, padding: { top: 8 }
        });
        this.editor.onDidChangeCursorPosition(e => {
          document.getElementById('st-cursor').textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
        });
        this.editor.onDidChangeModelContent(() => {
          if (!this.file) return;
          this.markDirty(this.file, true);
          clearTimeout(this.debounce);
          this.debounce = setTimeout(() => this.saveAndRefresh(), 800);
        });
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => this.saveAndRefresh());
        resolve();
      });
    });
  }

  // ===== Alt Menu =====
  bindAltMenu() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Alt') { e.preventDefault(); this.menuVisible = !this.menuVisible; document.getElementById('menubar').classList.toggle('hidden', !this.menuVisible); }
    });
    document.addEventListener('click', e => { if (this.menuVisible && !e.target.closest('#menubar')) { this.menuVisible = false; document.getElementById('menubar').classList.add('hidden'); } });
  }

  // ===== IPC from native menu =====
  bindIpc() {
    if (!window.api?.on) return;
    window.api.on('new-file', () => this.newFile());
    window.api.on('open-file', () => this.openFile());
    window.api.on('open-folder', () => this.openFolder());
    window.api.on('save', () => this.saveAndRefresh());
    window.api.on('toggle-sidebar', () => { document.getElementById('sidebar').classList.toggle('expanded'); this.layoutEditor(); });
    window.api.on('toggle-terminal', () => this.toggleBottom());
    window.api.on('refresh-preview', () => this.refreshPreview());
    window.api.on('start-php-server', () => this.startPhpServer());
    window.api.on('stop-php-server', () => this.stopPhpServer());
    window.api.on('save-state-request', () => this.persistState());
  }

  // ===== State =====
  async restoreState() {
    if (!window.api?.loadState) return;
    const state = await window.api.loadState();
    if (state.lastFolder) {
      this.folder = state.lastFolder;
      document.getElementById('ws-name').innerHTML = '<i class="fas fa-chevron-down"></i> ' + this.folder.split('/').pop();
      this.refreshTree();
      // Scan folder and auto-start server
      await this.scanAndStartServer();
      // Recreate terminal with folder CWD
      if (this.term) this.createPtySession();
    }
    if (state.openFiles?.length) {
      for (const f of state.openFiles) {
        try { await this.openFileByPath(f, false); } catch {}
      }
    }
    if (state.previewUrl && !this.previewUrl) {
      this.previewUrl = state.previewUrl;
      document.getElementById('preview-url').value = this.previewUrl;
      this.refreshPreview();
    }
    if (state.livePreview !== undefined) {
      this.livePreview = state.livePreview;
      this.updateLivePreviewIndicator();
    }
    // Show "Go to Project" button if we have a URL
    this.updateGoToProject();
  }

  async persistState() {
    if (!window.api?.saveState) return;
    await window.api.saveState({
      lastFolder: this.folder,
      openFiles: this.tabs.map(t => t.path),
      previewUrl: this.previewUrl
    });
  }

  // ===== Bind =====
  bind() {
    this.on('btn-min', 'click', () => window.api?.minimize());
    this.on('btn-max', 'click', () => window.api?.maximize());
    this.on('btn-close', 'click', () => this.persistState().then(() => window.api?.close()));
    if (window.api?.onMaximized) window.api.onMaximized(m => { const b = document.getElementById('btn-max'); if (b) b.innerHTML = m ? '<i class="fas fa-clone"></i>' : '<i class="fas fa-square"></i>'; });

    this.on('btn-prev-back', 'click', () => { try { document.getElementById('preview-frame').contentWindow.history.back(); } catch {} });
    this.on('btn-prev-fwd', 'click', () => { try { document.getElementById('preview-frame').contentWindow.history.forward(); } catch {} });
    this.on('btn-prev-reload', 'click', () => this.refreshPreview());
    this.on('btn-prev-ext', 'click', () => { const u = document.getElementById('preview-url').value; if (u) window.api?.openExternal(u); });
    this.on('preview-url', 'keydown', e => { if (e.key === 'Enter') this.loadPreview(e.target.value); });

    document.querySelectorAll('.dev-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dev-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('preview-frame').className = btn.dataset.dev === 'desktop' ? '' : btn.dataset.dev;
      });
    });

    document.querySelectorAll('.sb-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const sb = document.getElementById('sidebar');
        if (!sb.classList.contains('expanded')) sb.classList.add('expanded');
        document.querySelectorAll('.sb-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.sb-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + tab.dataset.tab)?.classList.add('active');
      });
    });

    this.on('btn-new-file', 'click', () => this.newFile());
    this.on('btn-new-folder', 'click', () => this.newFolder());
    this.on('btn-refresh', 'click', () => this.refreshTree());
    this.on('w-open-folder', 'click', () => this.openFolder());
    this.on('w-go-project', 'click', () => { if (this.previewUrl) { this.loadPreview(this.previewUrl); } else if (this.folder) { this.previewUrl = 'http://localhost:' + this.serverPort; this.loadPreview(this.previewUrl); } });
    this.on('w-new-file', 'click', () => this.newFile());

    // Live preview toggle
    this.on('st-live-preview', 'click', () => {
      this.livePreview = !this.livePreview;
      this.updateLivePreviewIndicator();
      this.notify('Live Preview: ' + (this.livePreview ? 'ON' : 'OFF'), 'info');
      window.api?.saveState?.({ livePreview: this.livePreview });
    });
    this.on('btn-commit', 'click', () => this.gitCommit());
    this.on('st-servers', 'click', () => this.toggleBottom());
    this.on('btn-db-run', 'click', () => this.runDbQuery());

    // Server panel buttons
    this.on('btn-srv-php-start', 'click', () => this.startPhpServer());
    this.on('btn-srv-php-stop', 'click', () => this.stopPhpServer());
    this.on('btn-srv-mysql-start', 'click', async () => {
      const s = await window.api?.serverStatus?.();
      if (s && !s.mysqlInstalled) {
        // Show install command
        const r = await window.api?.getInstallCmd?.('mariadb');
        if (r?.cmd) { navigator.clipboard.writeText(r.cmd); this.notify('Install command copied: ' + r.cmd, 'info'); }
        else this.notify('Install MySQL/MariaDB manually', 'warning');
        return;
      }
      if (window.api?.startMysql) { this.setSrvStarting('mysql'); this.notify('Starting MySQL...', 'info'); await window.api.startMysql(); setTimeout(() => this.checkServers(), 2000); }
    });
    this.on('btn-srv-mysql-stop', 'click', async () => { if (window.api?.stopMysql) { await window.api.stopMysql(); this.notify('MySQL stopped', 'info'); this.checkServers(); } });
    this.on('btn-srv-apache-start', 'click', async () => {
      const s = await window.api?.serverStatus?.();
      if (s && !s.apacheInstalled) {
        const r = await window.api?.getInstallCmd?.('apache');
        if (r?.cmd) { navigator.clipboard.writeText(r.cmd); this.notify('Install command copied: ' + r.cmd, 'info'); }
        else this.notify('Install Apache manually', 'warning');
        return;
      }
      if (window.api?.startApache) { this.setSrvStarting('apache'); this.notify('Starting Apache...', 'info'); await window.api.startApache(); setTimeout(() => this.checkServers(), 2000); }
    });
    this.on('btn-srv-apache-stop', 'click', async () => { if (window.api?.stopApache) { await window.api.stopApache(); this.notify('Apache stopped', 'info'); this.checkServers(); } });
    this.on('btn-srv-open-www', 'click', async () => { 
      if (window.api?.openPath) { 
        const dir = window.api?.getWwwDir ? await window.api.getWwwDir() : 'servers/www';
        await window.api.openPath(dir);
      } else if (window.api?.getWwwDir) {
        const dir = await window.api.getWwwDir();
        this.folder = dir;
        document.getElementById('ws-name').innerHTML = '<i class="fas fa-chevron-down"></i> www';
        this.refreshTree();
      }
    });
    this.on('btn-srv-refresh', 'click', () => { this.checkServers(); this.notify('Status refreshed', 'info'); });
    this.on('btn-phpmyadmin', 'click', () => {
      const url = 'http://localhost/phpmyadmin/';
      this.loadPreview(url);
      if (window.api?.openExternal) setTimeout(() => window.api.openExternal(url), 200);
    });

    // Auto-refresh server status every 5 seconds
    setInterval(() => this.checkServers(), 5000);

    document.querySelectorAll('.bt').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.bt').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.bot-p').forEach(p => p.classList.remove('active'));
        document.getElementById('bp-' + tab.dataset.bp)?.classList.add('active');
        this.showBottom();
        if (tab.dataset.bp === 'terminal' && this.term) { setTimeout(() => { this.fitAddon?.fit(); this.term?.focus(); }, 50); }
      });
    });
    this.on('btn-close-bot', 'click', () => { document.getElementById('bottom').style.display = 'none'; this.layoutEditor(); });

    document.addEventListener('keydown', e => {
      if (e.altKey) return;
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); document.getElementById('sidebar').classList.toggle('expanded'); this.layoutEditor(); }
      if (e.ctrlKey && e.key === '`') { e.preventDefault(); this.toggleBottom(); }
      if (e.key === 'F5') { e.preventDefault(); this.refreshPreview(); }
    });
    window.addEventListener('resize', () => { this.layoutEditor(); this.fitAddon?.fit(); });
  }

  on(id, ev, fn) { document.getElementById(id)?.addEventListener(ev, fn); }

  // ===== Resize =====
  bindResize() {
    let drag = false;
    const vr = document.getElementById('v-resize');
    const pp = document.getElementById('preview-panel');
    const pf = document.getElementById('preview-frame');
    if (vr && pp) {
      vr.addEventListener('mousedown', e => { drag = true; if (pf) pf.classList.add('frozen'); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; e.preventDefault(); });
      document.addEventListener('mousemove', e => { if (!drag) return; const mainW = document.getElementById('main').getBoundingClientRect().width; const w = Math.max(200, Math.min(mainW - 200, e.clientX - pp.getBoundingClientRect().left)); pp.style.width = w + 'px'; pp.style.flex = 'none'; this.layoutEditor(); });
      document.addEventListener('mouseup', () => { if (pf) pf.classList.remove('frozen'); drag = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; });
    }
    const hr = document.getElementById('h-resize');
    const bp = document.getElementById('bottom');
    if (hr && bp) {
      let drag2 = false;
      hr.addEventListener('mousedown', e => { drag2 = true; document.body.style.cursor = 'ns-resize'; document.body.style.userSelect = 'none'; e.preventDefault(); });
      document.addEventListener('mousemove', e => { if (!drag2) return; bp.style.height = Math.max(80, Math.min(500, window.innerHeight - e.clientY)) + 'px'; this.layoutEditor(); this.fitAddon?.fit(); });
      document.addEventListener('mouseup', () => { drag2 = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; });
    }
  }
  layoutEditor() { this.editor?.layout(); }

  // ===== Context Menu =====
  bindContext() {
    const menu = document.getElementById('ctx');
    document.addEventListener('contextmenu', e => { if (e.target.closest('#file-tree')) { e.preventDefault(); menu.style.display = 'block'; menu.style.left = e.pageX + 'px'; menu.style.top = e.pageY + 'px'; } });
    document.addEventListener('click', () => { menu.style.display = 'none'; });
    document.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        const a = item.dataset.act;
        if (a === 'new-file') this.newFile();
        if (a === 'new-folder') this.newFolder();
        if (a === 'delete') this.deleteCurrent();
        if (a === 'rename') this.renameCurrent();
        if (a === 'copy-path' && this.file) { navigator.clipboard.writeText(this.file); this.notify('Path copied', 'info'); }
      });
    });
  }

  // ===== File Operations =====
  async openFile() {
    const p = window.api?.openFile ? await window.api.openFile() : prompt('File path:');
    if (p) await this.openFileByPath(p);
  }

  async openFileByPath(p, save = true) {
    let content = '';
    if (window.api?.readFile) {
      const r = await window.api.readFile(p);
      if (r.success) content = r.content;
      else { this.notify('Cannot read: ' + r.error, 'error'); return; }
    }
    this.file = p;
    this.addTab(p, p.split('/').pop());
    this.showEditor();
    const lang = await this.detectLang(p);
    if (!this.models[p]) this.models[p] = monaco.editor.createModel(content, lang);
    this.editor.setModel(this.models[p]);
    this.editor.focus();
    this.updateStatus();
    // Auto-preview for HTML files
    if (['html', 'htm'].includes(p.split('.').pop().toLowerCase())) {
      this.previewUrl = 'file://' + p;
      document.getElementById('preview-url').value = this.previewUrl;
      this.refreshPreview();
    }
    if (save) this.persistState();
  }

  async saveAndRefresh() {
    if (!this.file || !this.editor) return;
    if (window.api?.writeFile) {
      const r = await window.api.writeFile(this.file, this.editor.getValue());
      if (!r.success) { this.notify('Save error', 'error'); return; }
    }
    this.markDirty(this.file, false);
    this.refreshPreview();
    this.notify('Saved', 'success');
  }

  askUser(promptText, defaultValue) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
      overlay.innerHTML = `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px;min-width:300px;box-shadow:0 8px 24px rgba(0,0,0,.4);">
          <div style="font-size:12px;color:var(--fg);margin-bottom:8px;">${promptText}</div>
          <input type="text" id="prompt-input" value="${defaultValue || ''}" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--fg);padding:6px 8px;border-radius:4px;font-size:12px;outline:none;margin-bottom:10px;" autofocus>
          <div style="display:flex;gap:6px;justify-content:flex-end;">
            <button id="prompt-cancel" style="padding:4px 12px;background:var(--bg3);border:1px solid var(--border);color:var(--fg2);border-radius:4px;cursor:pointer;font-size:11px;">Cancel</button>
            <button id="prompt-ok" style="padding:4px 12px;background:var(--acc);border:none;color:#fff;border-radius:4px;cursor:pointer;font-size:11px;">OK</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('#prompt-input');
      input.focus();
      input.select();
      const close = (val) => { overlay.remove(); resolve(val); };
      overlay.querySelector('#prompt-ok').onclick = () => close(input.value.trim() || null);
      overlay.querySelector('#prompt-cancel').onclick = () => close(null);
      input.onkeydown = (e) => { if (e.key === 'Enter') close(input.value.trim() || null); if (e.key === 'Escape') close(null); };
      overlay.onclick = (e) => { if (e.target === overlay) close(null); };
    });
  }

  async newFile() {
    const name = await this.askUser('New file name (e.g. index.php):');
    if (!name) return;
    const p = this.folder ? this.folder + '/' + name : name;
    if (window.api?.writeFile) await window.api.writeFile(p, '');
    this.openFileByPath(p);
    this.refreshTree();
  }

  async newFolder() {
    const name = await this.askUser('Folder name:');
    if (!name) return;
    if (window.api?.mkdir) await window.api.mkdir(this.folder ? this.folder + '/' + name : name);
    this.refreshTree();
  }

  async deleteCurrent() {
    if (!this.file) return;
    if (!confirm('Delete ' + this.file.split('/').pop() + '?')) return;
    if (window.api?.deleteFile) await window.api.deleteFile(this.file);
    this.closeTab(this.file);
    this.file = null;
    this.refreshTree();
  }

  async renameCurrent() {
    if (!this.file) return;
    const currentName = this.file.split('/').pop();
    const n = await this.askUser('New name:', currentName);
    if (!n || n === currentName) return;
    const np = this.file.substring(0, this.file.lastIndexOf('/')) + '/' + n;
    if (window.api?.rename) await window.api.rename(this.file, np);
    delete this.models[this.file];
    this.closeTab(this.file);
    this.openFileByPath(np);
    this.refreshTree();
  }

  async openFolder() {
    const p = window.api?.openFolder ? await window.api.openFolder() : prompt('Folder path:');
    if (!p) return;
    this.folder = p;
    document.getElementById('ws-name').innerHTML = '<i class="fas fa-chevron-down"></i> ' + p.split('/').pop();
    this.refreshTree();

    // Scan folder to detect project type
    await this.scanAndStartServer();

    // Recreate terminal session with new CWD
    if (this.term) this.createPtySession();

    this.persistState();
  }

  async scanAndStartServer() {
    if (!this.folder || !window.api?.scanFolder) return;

    this.folderInfo = await window.api.scanFolder(this.folder);
    if (this.folderInfo?.error) { this.notify('Error scanning folder: ' + this.folderInfo.error, 'error'); return; }

    const info = this.folderInfo;
    this.notify(`Project: ${info.dominantLang || 'unknown'} | Index: ${info.indexFile || 'none'}`, 'info');

    // Auto-start appropriate server based on project type
    if (info.serverType === 'php') {
      this.serverPort = 8080;
      const portInput = document.getElementById('srv-php-port');
      if (portInput) portInput.value = this.serverPort;
      await this.startPhpServer();
    } else if (info.serverType === 'node') {
      this.notify('Node.js project detected. Run: node ' + (info.entryPoints?.node || 'server.js'), 'info');
    } else if (info.serverType === 'python') {
      this.notify('Python project detected. Run: python3 ' + (info.entryPoints?.python || 'main.py'), 'info');
    } else if (info.serverType === 'static') {
      // Static HTML - open directly with file://
      this.previewUrl = 'file://' + info.path + '/' + info.indexFile;
      document.getElementById('preview-url').value = this.previewUrl;
      this.refreshPreview();
    }

    // Update "Go to Project" button visibility
    this.updateGoToProject();
  }

  // ===== Language Detection =====
  async detectLang(filePath) {
    if (window.api?.detectLang) {
      const r = await window.api.detectLang(filePath);
      return r?.lang || 'plaintext';
    }
    const ext = filePath.split('.').pop().toLowerCase();
    const m = { js:'javascript',ts:'typescript',php:'php',html:'html',css:'css',json:'json',py:'python',rb:'ruby',go:'go',rs:'rust',java:'java',sh:'shell',sql:'sql',xml:'xml',md:'markdown' };
    return m[ext] || 'plaintext';
  }

  // ===== Preview =====
  refreshPreview() {
    const frame = document.getElementById('preview-frame');
    const empty = document.getElementById('preview-empty');
    const url = this.previewUrl || document.getElementById('preview-url').value;
    console.log('[PREVIEW] refreshPreview url=', url, 'this.previewUrl=', this.previewUrl);
    if (!url) { frame.style.display = 'none'; empty.style.display = 'flex'; return; }
    empty.style.display = 'none';
    frame.style.display = 'block';
    frame.src = url;
    console.log('[PREVIEW] frame.src set to', url);
  }

  loadPreview(url) {
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      url = 'http://' + url;
    }
    this.previewUrl = url;
    document.getElementById('preview-url').value = url;
    console.log('[PREVIEW] loadPreview ->', url);
    this.refreshPreview();
  }

  // ===== PHP Server =====
  async startPhpServer() {
    if (!window.api?.startPhpServer) return;
    this.setSrvStarting('php');
    this.notify('Starting PHP server...', 'info');
    const portInput = document.getElementById('srv-php-port');
    if (portInput) this.serverPort = parseInt(portInput.value) || 8080;

    // Use folder as document root if available, otherwise use www dir
    const dir = this.folder || (window.api?.getWwwDir ? await window.api.getWwwDir() : null);
    if (!dir) { this.notify('Open a folder first', 'warning'); this.checkServers(); return; }

    const r = await window.api.startPhpServer(this.serverPort, this.folder);
    if (r.success) {
    // Build URL from folderInfo if available
    if (this.folderInfo?.indexFile && this.folderInfo?.serverType === 'php') {
      this.previewUrl = 'http://localhost:' + this.serverPort + '/' + this.folderInfo.indexFile;
    } else {
      this.previewUrl = 'http://localhost:' + this.serverPort + '/';
    }
      document.getElementById('preview-url').value = this.previewUrl;
      this.notify('PHP server started on port ' + this.serverPort, 'success');
      setTimeout(() => { this.refreshPreview(); this.checkServers(); this.updateGoToProject(); }, 1500);
    } else {
      this.notify('Failed to start PHP: ' + (r.error || ''), 'error');
      this.checkServers();
    }
  }

  async stopPhpServer() {
    if (window.api?.stopPhpServer) await window.api.stopPhpServer();
    this.notify('PHP server stopped', 'info');
    this.checkServers();
  }

  // ===== File Tree =====
  async refreshTree() {
    const el = document.getElementById('file-tree');
    el.innerHTML = '';
    if (window.api?.listDir && this.folder) {
      const r = await window.api.listDir(this.folder);
      if (r.success) this.renderTree(r.items, el, 0);
    }
  }

  renderTree(items, container, depth) {
    items.sort((a, b) => a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name));
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'tree-item';
      el.style.paddingLeft = (6 + depth * 14) + 'px';
      el.innerHTML = '<i class="' + (item.isDir ? 'fas fa-folder' : this.icon(item.name)) + '"></i><span>' + item.name + '</span>';
      el.addEventListener('click', () => {
        document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
        if (item.isDir) this.toggleDir(el, item.path, depth, container);
        else this.openFileByPath(item.path);
      });
      container.appendChild(el);
    });
  }

  async toggleDir(el, p, depth) {
    const next = el.nextElementSibling;
    if (next?.classList?.contains('tree-sub')) { next.remove(); el.querySelector('i').className = 'fas fa-folder'; return; }
    el.querySelector('i').className = 'fas fa-folder-open';
    const sub = document.createElement('div');
    sub.className = 'tree-sub';
    el.after(sub);
    if (window.api?.listDir) { const r = await window.api.listDir(p); if (r.success) this.renderTree(r.items, sub, depth + 1); }
  }

  icon(name) {
    const e = name.split('.').pop().toLowerCase();
    const m = { php:'fab fa-php',js:'fab fa-js',py:'fab fa-python',html:'fab fa-html5',css:'fab fa-css3-alt',json:'fas fa-file',md:'fab fa-markdown',sql:'fas fa-database',rb:'fas fa-gem',go:'fas fa-code',rs:'fas fa-cog',java:'fab fa-java',sh:'fas fa-terminal',ts:'fas fa-code' };
    return m[e] || 'fas fa-file';
  }

  // ===== Tabs =====
  addTab(path, name) {
    if (this.tabs.find(t => t.path === path)) { this.switchTab(path); return; }
    this.tabs.push({ path, name });
    const tab = document.createElement('div');
    tab.className = 'ed-tab';
    tab.dataset.path = path;
    tab.innerHTML = '<span class="ed-tab-name">' + name + '</span><span class="ed-tab-mod">&bull;</span><button class="ed-tab-x">&times;</button>';
    tab.addEventListener('click', e => { e.target.classList.contains('ed-tab-x') ? this.closeTab(path) : this.switchTab(path); });
    document.getElementById('ed-tabs-scroll').appendChild(tab);
    this.switchTab(path);
  }

  switchTab(path) {
    document.querySelectorAll('.ed-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.ed-tab[data-path="' + CSS.escape(path) + '"]')?.classList.add('active');
    this.file = path;
    if (this.models[path]) this.editor.setModel(this.models[path]);
    this.updateStatus();

    // Live preview: auto-update when switching to HTML/PHP files
    if (this.livePreview && this.folder) {
      const ext = path.split('.').pop().toLowerCase();
      if (['html', 'htm', 'php'].includes(ext)) {
        const relativePath = path.replace(this.folder, '').replace(/^\//, '');
        if (this.previewUrl?.startsWith('http')) {
          const newUrl = 'http://localhost:' + this.serverPort + '/' + relativePath;
          this.previewUrl = newUrl;
          document.getElementById('preview-url').value = newUrl;
        } else {
          this.previewUrl = 'file://' + path;
          document.getElementById('preview-url').value = this.previewUrl;
        }
        this.refreshPreview();
      }
    }
  }

  closeTab(path) {
    const tab = document.querySelector('.ed-tab[data-path="' + CSS.escape(path) + '"]');
    if (!tab) return;
    const was = tab.classList.contains('active');
    tab.remove();
    this.tabs = this.tabs.filter(t => t.path !== path);
    if (was) {
      if (this.tabs.length > 0) this.switchTab(this.tabs[this.tabs.length - 1].path);
      else { this.file = null; document.getElementById('welcome').style.display = 'flex'; document.getElementById('editor').style.display = 'none'; }
    }
    this.persistState();
  }

  markDirty(path, dirty) { document.querySelector('.ed-tab[data-path="' + CSS.escape(path) + '"]')?.classList.toggle('modified', dirty); }

  // ===== UI =====
  showEditor() { document.getElementById('welcome').style.display = 'none'; document.getElementById('editor').style.display = 'block'; this.layoutEditor(); }
  updateStatus() { if (this.file) { document.getElementById('st-type').textContent = this.file.split('.').pop().toUpperCase(); } }

  updateLivePreviewIndicator() {
    const el = document.getElementById('st-live-preview');
    if (el) {
      el.innerHTML = '<i class="fas fa-eye"></i> Live: ' + (this.livePreview ? 'ON' : 'OFF');
      el.style.opacity = this.livePreview ? '1' : '0.6';
    }
  }

  updateGoToProject() {
    const btn = document.getElementById('w-go-project');
    if (btn && this.previewUrl) {
      btn.style.display = 'flex';
    }
  }
  toggleBottom() { const b = document.getElementById('bottom'); b.style.display = b.style.display === 'none' ? 'flex' : 'none'; this.showBottom(); }
  showBottom() { document.getElementById('bottom').style.display = 'flex'; this.layoutEditor(); setTimeout(() => this.fitAddon?.fit(), 50); }

  // ===== Menu Actions =====
  menuAction(action) {
    ({ 'new-file': () => this.newFile(), 'open-file': () => this.openFile(), 'open-folder': () => this.openFolder(), 'save': () => this.saveAndRefresh(), 'toggle-sidebar': () => { document.getElementById('sidebar').classList.toggle('expanded'); this.layoutEditor(); }, 'toggle-terminal': () => this.toggleBottom(), 'refresh-preview': () => this.refreshPreview(), 'start-php-server': () => this.startPhpServer(), 'stop-php-server': () => this.stopPhpServer(), 'phpmyadmin': () => { const u = 'http://localhost/phpmyadmin/'; if (window.api?.openExternal) window.api.openExternal(u); } })[action]?.();
  }

  // ===== Servers =====
  async checkServers() {
    if (!window.api?.serverStatus) return;
    const s = await window.api.serverStatus();
    this.updateServerPanelStatus(s);
    // Update statusbar
    const st = document.getElementById('st-server-text');
    const anyRunning = s.php || s.phpServer || s.mysql || s.apache;
    if (st) st.textContent = anyRunning ? this.runningList(s) : 'All stopped';
  }

  runningList(s) {
    const parts = [];
    if (s.php || s.phpServer) parts.push('PHP');
    if (s.mysql) parts.push('MySQL');
    if (s.apache) parts.push('Apache');
    return parts.join(', ') + ' on';
  }

  updateServerPanelStatus(s) {
    if (!s) return;
    this.setSrvStatus('php', s.phpServer, '8080');
    if (s.mysqlInstalled) {
      this.setSrvStatus('mysql', s.mysql, '3306');
    } else {
      this.setSrvNotInstalled('mysql');
    }
    if (s.apacheInstalled) {
      this.setSrvStatus('apache', s.apache, '80');
    } else {
      this.setSrvNotInstalled('apache');
    }
  }

  setSrvStatus(name, running, port) {
    const card = document.getElementById('srv-card-' + name);
    const status = document.getElementById('srv-' + name + '-status');
    const startBtn = document.getElementById('btn-srv-' + name + '-start');
    const stopBtn = document.getElementById('btn-srv-' + name + '-stop');
    if (!status) return;

    const dot = status.querySelector('.dot');
    const label = status.querySelector('.label');
    const badge = status.querySelector('.port-badge');

    if (running) {
      card?.classList.add('running');
      card?.classList.remove('starting');
      status.className = 'srv-status running';
      if (dot) dot.style.background = 'var(--ok)';
      if (label) { label.textContent = 'Running'; label.style.color = 'var(--ok)'; }
      if (badge) { badge.textContent = ':' + port; badge.style.borderColor = 'var(--ok)'; badge.style.color = 'var(--ok)'; }
      if (startBtn) startBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
    } else {
      card?.classList.remove('running', 'starting');
      status.className = 'srv-status';
      if (dot) dot.style.background = 'var(--err)';
      if (label) { label.textContent = 'Stopped'; label.style.color = 'var(--err)'; }
      if (badge) { badge.textContent = ':' + port; badge.style.borderColor = 'var(--border)'; badge.style.color = 'var(--fg2)'; }
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
    }
  }

  setSrvNotInstalled(name) {
    const card = document.getElementById('srv-card-' + name);
    const status = document.getElementById('srv-' + name + '-status');
    const startBtn = document.getElementById('btn-srv-' + name + '-start');
    const stopBtn = document.getElementById('btn-srv-' + name + '-stop');
    if (!status) return;

    card?.classList.remove('running', 'starting');
    status.className = 'srv-status';
    const dot = status.querySelector('.dot');
    const label = status.querySelector('.label');
    if (dot) dot.style.background = 'var(--fg3)';
    if (label) { label.textContent = 'Not installed'; label.style.color = 'var(--fg3)'; }
    if (startBtn) { startBtn.disabled = false; startBtn.innerHTML = '<i class="fas fa-download"></i> Install'; startBtn.className = 'btn-start install'; }
    if (stopBtn) stopBtn.disabled = true;
  }

  setSrvStarting(name) {
    const card = document.getElementById('srv-card-' + name);
    const status = document.getElementById('srv-' + name + '-status');
    if (!status) return;
    card?.classList.add('starting');
    card?.classList.remove('running');
    status.className = 'srv-status starting';
    const label = status.querySelector('.label');
    if (label) { label.textContent = 'Starting...'; label.style.color = 'var(--warn)'; }
    const startBtn = document.getElementById('btn-srv-' + name + '-start');
    const stopBtn = document.getElementById('btn-srv-' + name + '-stop');
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = true;
  }

  async updateServerPanel() {
    await this.checkServers();
  }

  // ===== Git =====
  async gitCommit() {
    const msg = document.getElementById('git-msg')?.value;
    if (!msg) { this.notify('Enter commit message', 'warning'); return; }
    if (window.api?.gitCommit && this.folder) { await window.api.gitCommit(this.folder, msg); document.getElementById('git-msg').value = ''; this.notify('Committed', 'success'); }
  }

  // ===== Terminal (xterm.js + node-pty) =====
  initTerminal() {
    if (!document.getElementById('terminal-container') || !window.Terminal) return;
    this.fitAddon = new FitAddon();
    this.term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'Fira Code',Consolas,'Courier New',monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#cccccc',
        selectionBackground: '#264f78',
        black: '#1e1e1e', red: '#f44747', green: '#4ec9b0', yellow: '#dcdcaa',
        blue: '#569cd6', magenta: '#c586c0', cyan: '#4fc1ff', white: '#d4d4d4',
        brightBlack: '#808080', brightRed: '#f44747', brightGreen: '#4ec9b0',
        brightYellow: '#dcdcaa', brightBlue: '#569cd6', brightMagenta: '#c586c0',
        brightCyan: '#4fc1ff', brightWhite: '#ffffff',
      },
      allowTransparency: false,
      scrollback: 5000,
    });
    this.term.loadAddon(this.fitAddon);
    this.term.open(document.getElementById('terminal-container'));
    this.fitAddon.fit();

    this.term.onData((data) => {
      if (this.termId != null) window.api.termWrite(this.termId, data);
    });

    window.api.onTermData((id, data) => {
      if (id === this.termId) this.term.write(data);
    });

    this.createPtySession();
  }

  async createPtySession() {
    if (!window.api?.termCreate) return;
    if (this.termId != null) { await window.api.termKill(this.termId); this.termId = null; }
    const r = await window.api.termCreate(this.folder || undefined);
    if (r.success) {
      this.termId = r.id;
      this.term.clear();
      this.term.focus();
    } else {
      this.term.write('Failed to create terminal session\r\n');
    }
  }

  runDbQuery() { this.notify('Database - start MySQL first', 'info'); }

  // ===== Notification =====
  notify(msg, type) {
    const el = document.getElementById('notif');
    el.className = 'notif ' + type;
    document.getElementById('notif-text').textContent = msg;
    el.style.display = 'flex';
    clearTimeout(this._nt);
    this._nt = setTimeout(() => { el.style.display = 'none'; }, 3000);
    document.getElementById('notif-close').onclick = () => { el.style.display = 'none'; };
  }
}

document.addEventListener('DOMContentLoaded', () => { window.ide = new IDE(); window.ide.boot(); });
