const { EventEmitter } = require('events');
const Store = require('electron-store');

class HistoryManager extends EventEmitter {
  constructor() {
    super();
    this.store = new Store({ name: 'history' });
    this.history = this.store.get('history', []);
    this.maxHistorySize = 10000;
  }

  addEntry(entry) {
    const {
      url,
      title = '',
      favicon = null,
      timestamp = Date.now()
    } = entry;

    // Don't add duplicate of last entry
    if (this.history.length > 0) {
      const lastEntry = this.history[this.history.length - 1];
      if (lastEntry.url === url) {
        return false;
      }
    }

    const historyEntry = {
      id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      title,
      favicon,
      timestamp,
      visitCount: 1
    };

    this.history.push(historyEntry);

    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    this.save();
    this.emit('history-updated', historyEntry);
    return historyEntry;
  }

  removeEntry(entryId) {
    const index = this.history.findIndex(e => e.id === entryId);
    if (index > -1) {
      this.history.splice(index, 1);
      this.save();
      this.emit('history-updated');
      return true;
    }
    return false;
  }

  clearHistory() {
    this.history = [];
    this.save();
    this.emit('history-updated');
    return true;
  }

  getHistory(options = {}) {
    const {
      limit = 100,
      offset = 0,
      startDate = null,
      endDate = null,
      searchText = null
    } = options;

    let filtered = [...this.history];

    // Filter by date range
    if (startDate) {
      filtered = filtered.filter(e => e.timestamp >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(e => e.timestamp <= endDate);
    }

    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(e => 
        e.url.toLowerCase().includes(searchLower) ||
        e.title.toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    return filtered.slice(offset, offset + limit);
  }

  searchHistory(query, limit = 50) {
    return this.getHistory({ searchText: query, limit });
  }

  getRecentHistory(limit = 20) {
    return this.getHistory({ limit });
  }

  getTodayHistory() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getHistory({ startDate: today.getTime() });
  }

  getWeekHistory() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return this.getHistory({ startDate: weekAgo.getTime() });
  }

  getMonthHistory() {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return this.getHistory({ startDate: monthAgo.getTime() });
  }

  // Get most visited URLs
  getMostVisited(limit = 10) {
    const urlCounts = new Map();
    
    for (const entry of this.history) {
      const count = urlCounts.get(entry.url) || 0;
      urlCounts.set(entry.url, count + 1);
    }

    const sorted = Array.from(urlCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sorted.map(([url, count]) => {
      const entry = this.history.find(e => e.url === url);
      return {
        url,
        title: entry?.title || '',
        visitCount: count
      };
    });
  }

  // Get favicon for URL
  getFavicon(url) {
    const entry = this.history.find(e => e.url === url);
    return entry?.favicon || null;
  }

  // Update entry title
  updateTitle(url, title) {
    const entry = this.history.find(e => e.url === url);
    if (entry) {
      entry.title = title;
      this.save();
      this.emit('history-updated', entry);
      return true;
    }
    return false;
  }

  // Update entry favicon
  updateFavicon(url, favicon) {
    const entry = this.history.find(e => e.url === url);
    if (entry) {
      entry.favicon = favicon;
      this.save();
      this.emit('history-updated', entry);
      return true;
    }
    return false;
  }

  // Export history
  exportHistory(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.history, null, 2);
    }
    // Add other formats as needed
    return null;
  }

  // Import history
  importHistory(data, format = 'json') {
    try {
      if (format === 'json') {
        const imported = JSON.parse(data);
        this.history = [...this.history, ...imported];
        this.save();
        this.emit('history-updated');
        return true;
      }
    } catch (error) {
      console.error('Error importing history:', error);
      return false;
    }
  }

  // Save to store
  save() {
    this.store.set('history', this.history);
  }

  // Load from store
  load() {
    this.history = this.store.get('history', []);
  }

  // Get statistics
  getStatistics() {
    const totalEntries = this.history.length;
    const uniqueUrls = new Set(this.history.map(e => e.url)).size;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEntries = this.history.filter(e => e.timestamp >= today.getTime()).length;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekEntries = this.history.filter(e => e.timestamp >= weekAgo.getTime()).length;

    return {
      totalEntries,
      uniqueUrls,
      todayEntries,
      weekEntries,
      oldestEntry: this.history.length > 0 ? this.history[0].timestamp : null,
      newestEntry: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null
    };
  }

  // Clear old entries
  clearOlderThan(days) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const initialCount = this.history.length;
    
    this.history = this.history.filter(e => e.timestamp >= cutoff);
    
    if (this.history.length < initialCount) {
      this.save();
      this.emit('history-updated');
      return initialCount - this.history.length;
    }
    return 0;
  }
}

module.exports = HistoryManager;