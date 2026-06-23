const { EventEmitter } = require('events');

class TabsManager extends EventEmitter {
  constructor(browserViewManager) {
    super();
    this.browserViewManager = browserViewManager;
    this.tabs = new Map();
    this.activeTabId = null;
    this.tabCounter = 0;
    this.tabOrder = [];
  }

  createTab(options = {}) {
    const {
      url = 'brauser://newtab',
      title = 'New Tab',
      active = true
    } = options;

    const tabId = `tab-${++this.tabCounter}`;
    const viewId = this.browserViewManager.createView({ url });

    const tab = {
      id: tabId,
      viewId,
      url,
      title,
      favicon: null,
      isLoading: false,
      isPinned: false,
      isMuted: false,
      lastActive: Date.now()
    };

    this.tabs.set(tabId, tab);
    this.tabOrder.push(tabId);

    if (active) {
      this.setActiveTab(tabId);
    }

    this.emit('tab-created', tab);
    return tab;
  }

  removeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    // Remove browser view
    this.browserViewManager.removeView(tab.viewId);

    // Remove from tabs map
    this.tabs.delete(tabId);

    // Remove from order
    const index = this.tabOrder.indexOf(tabId);
    if (index > -1) {
      this.tabOrder.splice(index, 1);
    }

    // If this was active, switch to another
    if (this.activeTabId === tabId) {
      this.activeTabId = null;
      if (this.tabOrder.length > 0) {
        const newIndex = Math.min(index, this.tabOrder.length - 1);
        this.setActiveTab(this.tabOrder[newIndex]);
      }
    }

    this.emit('tab-removed', tabId);
    return true;
  }

  setActiveTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    // Deactivate current tab
    if (this.activeTabId) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        currentTab.lastActive = Date.now();
      }
    }

    // Activate new tab
    this.activeTabId = tabId;
    this.browserViewManager.setActiveView(tab.viewId);

    this.emit('tab-activated', tab);
    return true;
  }

  getTab(tabId) {
    return this.tabs.get(tabId);
  }

  getActiveTab() {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId);
  }

  getAllTabs() {
    return this.tabOrder.map(tabId => this.tabs.get(tabId));
  }

  getTabCount() {
    return this.tabs.size;
  }

  // Tab operations
  renameTab(tabId, title) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.title = title;
    this.emit('tab-updated', tab);
    return true;
  }

  setTabUrl(tabId, url) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.url = url;
    this.browserViewManager.navigate(tab.viewId, url);
    this.emit('tab-updated', tab);
    return true;
  }

  setTabFavicon(tabId, favicon) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.favicon = favicon;
    this.emit('tab-updated', tab);
    return true;
  }

  setTabLoading(tabId, isLoading) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.isLoading = isLoading;
    this.emit('tab-updated', tab);
    return true;
  }

  pinTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.isPinned = !tab.isPinned;
    this.emit('tab-updated', tab);
    return true;
  }

  muteTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.isMuted = !tab.isMuted;
    this.emit('tab-updated', tab);
    return true;
  }

  // Tab ordering
  moveTab(tabId, newIndex) {
    const currentIndex = this.tabOrder.indexOf(tabId);
    if (currentIndex === -1) return false;

    this.tabOrder.splice(currentIndex, 1);
    this.tabOrder.splice(newIndex, 0, tabId);

    this.emit('tabs-reordered', this.tabOrder);
    return true;
  }

  // Navigation
  navigateActive(url) {
    const activeTab = this.getActiveTab();
    if (!activeTab) return false;

    return this.setTabUrl(activeTab.id, url);
  }

  goBack() {
    const activeTab = this.getActiveTab();
    if (!activeTab) return false;

    return this.browserViewManager.goBack(activeTab.viewId);
  }

  goForward() {
    const activeTab = this.getActiveTab();
    if (!activeTab) return false;

    return this.browserViewManager.goForward(activeTab.viewId);
  }

  reload() {
    const activeTab = this.getActiveTab();
    if (!activeTab) return false;

    return this.browserViewManager.reload(activeTab.viewId);
  }

  stop() {
    const activeTab = this.getActiveTab();
    if (!activeTab) return false;

    return this.browserViewManager.stop(activeTab.viewId);
  }

  // Tab switching shortcuts
  nextTab() {
    const currentIndex = this.tabOrder.indexOf(this.activeTabId);
    if (currentIndex === -1) return false;

    const nextIndex = (currentIndex + 1) % this.tabOrder.length;
    this.setActiveTab(this.tabOrder[nextIndex]);
    return true;
  }

  previousTab() {
    const currentIndex = this.tabOrder.indexOf(this.activeTabId);
    if (currentIndex === -1) return false;

    const previousIndex = (currentIndex - 1 + this.tabOrder.length) % this.tabOrder.length;
    this.setActiveTab(this.tabOrder[previousIndex]);
    return true;
  }

  // Event handlers for browser view events
  handleViewEvent(event, data) {
    switch (event) {
      case 'view-loading':
        this.setTabLoading(data.viewId, true);
        break;
      case 'view-loaded':
        this.setTabLoading(data.viewId, false);
        this.updateTabFromView(data.viewId, data);
        break;
      case 'view-title-changed':
        this.updateTabTitle(data.viewId, data.title);
        break;
      case 'view-navigated':
        this.updateTabUrl(data.viewId, data.url);
        break;
    }
  }

  updateTabFromView(viewId, data) {
    for (const [tabId, tab] of this.tabs) {
      if (tab.viewId === viewId) {
        tab.url = data.url;
        tab.title = data.title;
        this.emit('tab-updated', tab);
        break;
      }
    }
  }

  updateTabTitle(viewId, title) {
    for (const [tabId, tab] of this.tabs) {
      if (tab.viewId === viewId) {
        tab.title = title;
        this.emit('tab-updated', tab);
        break;
      }
    }
  }

  updateTabUrl(viewId, url) {
    for (const [tabId, tab] of this.tabs) {
      if (tab.viewId === viewId) {
        tab.url = url;
        this.emit('tab-updated', tab);
        break;
      }
    }
  }

  // Restore tabs from storage
  restoreTabs(savedTabs) {
    for (const savedTab of savedTabs) {
      this.createTab({
        url: savedTab.url,
        title: savedTab.title,
        active: false
      });
    }
  }

  // Get tabs for storage
  getTabsForStorage() {
    return this.getAllTabs().map(tab => ({
      url: tab.url,
      title: tab.title,
      isPinned: tab.isPinned
    }));
  }

  // Destroy all tabs
  destroy() {
    for (const [tabId, tab] of this.tabs) {
      this.browserViewManager.removeView(tab.viewId);
    }
    this.tabs.clear();
    this.tabOrder = [];
    this.activeTabId = null;
  }
}

module.exports = TabsManager;