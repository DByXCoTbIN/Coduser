const { BrowserView, session } = require('electron');
const path = require('path');

class BrowserViewManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.views = new Map();
    this.activeViewId = null;
    this.viewCounter = 0;
  }

  createView(options = {}) {
    const {
      url = 'about:blank',
      partition = null,
      webPreferences = {}
    } = options;

    const viewId = `view-${++this.viewCounter}`;

    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        ...webPreferences
      }
    });

    // Set up event listeners
    view.webContents.on('did-start-loading', () => {
      this.emit('view-loading', { viewId });
    });

    view.webContents.on('did-finish-load', () => {
      const url = view.webContents.getURL();
      const title = view.webContents.getTitle();
      this.emit('view-loaded', { viewId, url, title });
    });

    view.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      this.emit('view-error', { viewId, errorCode, errorDescription });
    });

    view.webContents.on('page-title-updated', (event, title) => {
      this.emit('view-title-changed', { viewId, title });
    });

    view.webContents.on('did-navigate', (event, url) => {
      this.emit('view-navigated', { viewId, url });
    });

    view.webContents.on('did-navigate-in-page', (event, url, isInPlace) => {
      this.emit('view-navigated', { viewId, url, isInPlace });
    });

    // Handle new window requests
    view.webContents.setWindowOpenHandler(({ url }) => {
      this.emit('new-window', { viewId, url });
      return { action: 'deny' };
    });

    // Store view
    this.views.set(viewId, {
      view,
      url,
      title: '',
      isLoading: false,
      canGoBack: false,
      canGoForward: false
    });

    // Load initial URL
    if (url && url !== 'about:blank') {
      view.webContents.loadURL(url);
    }

    return viewId;
  }

  removeView(viewId) {
    const viewData = this.views.get(viewId);
    if (!viewData) return false;

    // Remove from window
    this.mainWindow.removeBrowserView(viewData.view);

    // Destroy view
    viewData.view.webContents.destroy();

    // Remove from map
    this.views.delete(viewId);

    // If this was active, switch to another
    if (this.activeViewId === viewId) {
      this.activeViewId = null;
    }

    return true;
  }

  setActiveView(viewId) {
    const viewData = this.views.get(viewId);
    if (!viewData) return false;

    // Remove current active view
    if (this.activeViewId) {
      const currentView = this.views.get(this.activeViewId);
      if (currentView) {
        this.mainWindow.removeBrowserView(currentView.view);
      }
    }

    // Set new active view
    this.mainWindow.setBrowserView(viewData.view);
    this.activeViewId = viewId;

    // Resize view to fill window
    this.resizeActiveView();

    return true;
  }

  resizeActiveView() {
    if (!this.activeViewId) return;

    const viewData = this.views.get(this.activeViewId);
    if (!viewData) return;

    const { width, height } = this.mainWindow.getContentBounds();
    
    // Calculate bounds (leave space for toolbar, tabs, etc.)
    const TOP_BAR_HEIGHT = 120; // menu + toolbar + tabs
    const BOTTOM_PANEL_HEIGHT = 200; // bottom panel
    const SIDEBAR_WIDTH = 250; // sidebar

    viewData.view.setBounds({
      x: SIDEBAR_WIDTH,
      y: TOP_BAR_HEIGHT,
      width: width - SIDEBAR_WIDTH,
      height: height - TOP_BAR_HEIGHT - BOTTOM_PANEL_HEIGHT
    });
  }

  getView(viewId) {
    return this.views.get(viewId);
  }

  getActiveView() {
    if (!this.activeViewId) return null;
    return this.views.get(this.activeViewId);
  }

  getAllViews() {
    return Array.from(this.views.entries()).map(([id, data]) => ({
      id,
      url: data.url,
      title: data.title,
      isLoading: data.isLoading,
      isActive: id === this.activeViewId
    }));
  }

  // Navigation methods
  navigate(viewId, url) {
    const viewData = this.views.get(viewId);
    if (!viewData) return false;

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      if (url.includes('.')) {
        url = `http://${url}`;
      } else {
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }

    viewData.view.webContents.loadURL(url);
    viewData.url = url;
    return true;
  }

  goBack(viewId) {
    const viewData = this.views.get(viewId || this.activeViewId);
    if (!viewData) return false;

    if (viewData.view.webContents.canGoBack()) {
      viewData.view.webContents.goBack();
      return true;
    }
    return false;
  }

  goForward(viewId) {
    const viewData = this.views.get(viewId || this.activeViewId);
    if (!viewData) return false;

    if (viewData.view.webContents.canGoForward()) {
      viewData.view.webContents.goForward();
      return true;
    }
    return false;
  }

  reload(viewId) {
    const viewData = this.views.get(viewId || this.activeViewId);
    if (!viewData) return false;

    viewData.view.webContents.reload();
    return true;
  }

  stop(viewId) {
    const viewData = this.views.get(viewId || this.activeViewId);
    if (!viewData) return false;

    viewData.view.webContents.stop();
    return true;
  }

  // Get current URL
  getCurrentUrl(viewId) {
    const viewData = this.views.get(viewId || this.activeViewId);
    if (!viewData) return null;

    return viewData.view.webContents.getURL();
  }

  // Get current title
  getCurrentTitle(viewId) {
    const viewData = this.views.get(viewId || this.activeViewId);
    if (!viewData) return null;

    return viewData.view.webContents.getTitle();
  }

  // Check navigation state
  canGoBack(viewId) {
    const viewData = this.views.get(viewId || this.activeViewId);
    if (!viewData) return false;

    return viewData.view.webContents.canGoBack();
  }

  canGoForward(viewId) {
    const viewData = this.views.get(viewId || this.activeViewId);
    if (!viewData) return false;

    return viewData.view.webContents.canGoForward();
  }

  // Event emitter
  emit(event, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`browser:${event}`, data);
    }
  }

  // Destroy all views
  destroy() {
    for (const [viewId, viewData] of this.views) {
      this.mainWindow.removeBrowserView(viewData.view);
      viewData.view.webContents.destroy();
    }
    this.views.clear();
    this.activeViewId = null;
  }
}

module.exports = BrowserViewManager;