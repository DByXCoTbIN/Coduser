const { EventEmitter } = require('events');
const Store = require('electron-store');

class BookmarksManager extends EventEmitter {
  constructor() {
    super();
    this.store = new Store({ name: 'bookmarks' });
    this.bookmarks = this.store.get('bookmarks', []);
    this.folders = this.store.get('folders', [
      { id: 'root', name: 'Bookmarks', parentId: null },
      { id: 'toolbar', name: 'Toolbar', parentId: 'root' },
      { id: 'menu', name: 'Menu', parentId: 'root' }
    ]);
  }

  addBookmark(bookmark) {
    const {
      url,
      title = '',
      favicon = null,
      folderId = 'root',
      position = null
    } = bookmark;

    const id = `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newBookmark = {
      id,
      url,
      title,
      favicon,
      folderId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (position !== null && position < this.bookmarks.length) {
      this.bookmarks.splice(position, 0, newBookmark);
    } else {
      this.bookmarks.push(newBookmark);
    }

    this.save();
    this.emit('bookmark-added', newBookmark);
    return newBookmark;
  }

  removeBookmark(bookmarkId) {
    const index = this.bookmarks.findIndex(b => b.id === bookmarkId);
    if (index > -1) {
      const removed = this.bookmarks.splice(index, 1)[0];
      this.save();
      this.emit('bookmark-removed', removed);
      return true;
    }
    return false;
  }

  updateBookmark(bookmarkId, updates) {
    const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
    if (bookmark) {
      Object.assign(bookmark, updates, { updatedAt: Date.now() });
      this.save();
      this.emit('bookmark-updated', bookmark);
      return bookmark;
    }
    return null;
  }

  getBookmark(bookmarkId) {
    return this.bookmarks.find(b => b.id === bookmarkId) || null;
  }

  getBookmarkByUrl(url) {
    return this.bookmarks.find(b => b.url === url) || null;
  }

  getAllBookmarks() {
    return [...this.bookmarks];
  }

  getBookmarksByFolder(folderId) {
    return this.bookmarks.filter(b => b.folderId === folderId);
  }

  searchBookmarks(query) {
    const searchLower = query.toLowerCase();
    return this.bookmarks.filter(b => 
      b.url.toLowerCase().includes(searchLower) ||
      b.title.toLowerCase().includes(searchLower)
    );
  }

  // Folder operations
  addFolder(folder) {
    const {
      name,
      parentId = 'root'
    } = folder;

    const id = `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newFolder = {
      id,
      name,
      parentId,
      createdAt: Date.now()
    };

    this.folders.push(newFolder);
    this.save();
    this.emit('folder-added', newFolder);
    return newFolder;
  }

  removeFolder(folderId) {
    // Don't allow removing root folders
    if (['root', 'toolbar', 'menu'].includes(folderId)) {
      return false;
    }

    const index = this.folders.findIndex(f => f.id === folderId);
    if (index > -1) {
      // Move bookmarks in this folder to root
      this.bookmarks.forEach(b => {
        if (b.folderId === folderId) {
          b.folderId = 'root';
        }
      });

      this.folders.splice(index, 1);
      this.save();
      this.emit('folder-removed', folderId);
      return true;
    }
    return false;
  }

  renameFolder(folderId, name) {
    const folder = this.folders.find(f => f.id === folderId);
    if (folder) {
      folder.name = name;
      this.save();
      this.emit('folder-updated', folder);
      return folder;
    }
    return null;
  }

  getFolder(folderId) {
    return this.folders.find(f => f.id === folderId) || null;
  }

  getAllFolders() {
    return [...this.folders];
  }

  getFoldersByParent(parentId) {
    return this.folders.filter(f => f.parentId === parentId);
  }

  // Move bookmark to folder
  moveToFolder(bookmarkId, folderId) {
    const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
    if (bookmark) {
      bookmark.folderId = folderId;
      bookmark.updatedAt = Date.now();
      this.save();
      this.emit('bookmark-moved', bookmark);
      return true;
    }
    return false;
  }

  // Reorder bookmarks
  reorderBookmarks(orderedIds) {
    const reordered = [];
    for (const id of orderedIds) {
      const bookmark = this.bookmarks.find(b => b.id === id);
      if (bookmark) {
        reordered.push(bookmark);
      }
    }
    this.bookmarks = reordered;
    this.save();
    this.emit('bookmarks-reordered');
    return true;
  }

  // Export bookmarks
  exportBookmarks(format = 'json') {
    if (format === 'json') {
      return JSON.stringify({
        bookmarks: this.bookmarks,
        folders: this.folders
      }, null, 2);
    }
    // Add HTML export for browser import
    if (format === 'html') {
      return this.exportAsHtml();
    }
    return null;
  }

  exportAsHtml() {
    let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
    html += '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n';
    html += '<TITLE>Bookmarks</TITLE>\n';
    html += '<H1>Bookmarks</H1>\n';
    html += '<DL><p>\n';

    for (const folder of this.folders) {
      if (folder.parentId === 'root') {
        html += `    <DT><H3>${folder.name}</H3>\n`;
        html += '    <DL><p>\n';
        
        const folderBookmarks = this.getBookmarksByFolder(folder.id);
        for (const bookmark of folderBookmarks) {
          html += `        <DT><A HREF="${bookmark.url}">${bookmark.title}</A>\n`;
        }
        
        html += '    </DL><p>\n';
      }
    }

    html += '</DL><p>\n';
    return html;
  }

  // Import bookmarks
  importBookmarks(data, format = 'json') {
    try {
      if (format === 'json') {
        const imported = JSON.parse(data);
        if (imported.bookmarks) {
          this.bookmarks = [...this.bookmarks, ...imported.bookmarks];
        }
        if (imported.folders) {
          this.folders = [...this.folders, ...imported.folders.filter(f => !['root', 'toolbar', 'menu'].includes(f.id))];
        }
        this.save();
        this.emit('bookmarks-imported');
        return true;
      }
    } catch (error) {
      console.error('Error importing bookmarks:', error);
      return false;
    }
    return false;
  }

  // Get recent bookmarks
  getRecentBookmarks(limit = 10) {
    return [...this.bookmarks]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  // Get most visited bookmarks (based on history)
  getMostVisitedBookmarks(limit = 10) {
    // This would integrate with HistoryManager
    return [...this.bookmarks].slice(0, limit);
  }

  // Check if URL is bookmarked
  isBookmarked(url) {
    return this.bookmarks.some(b => b.url === url);
  }

  // Toggle bookmark
  toggleBookmark(url, title, favicon) {
    const existing = this.getBookmarkByUrl(url);
    if (existing) {
      this.removeBookmark(existing.id);
      return false;
    } else {
      this.addBookmark({ url, title, favicon });
      return true;
    }
  }

  // Save to store
  save() {
    this.store.set('bookmarks', this.bookmarks);
    this.store.set('folders', this.folders);
  }

  // Load from store
  load() {
    this.bookmarks = this.store.get('bookmarks', []);
    this.folders = this.store.get('folders', [
      { id: 'root', name: 'Bookmarks', parentId: null },
      { id: 'toolbar', name: 'Toolbar', parentId: 'root' },
      { id: 'menu', name: 'Menu', parentId: 'root' }
    ]);
  }

  // Get statistics
  getStatistics() {
    return {
      totalBookmarks: this.bookmarks.length,
      totalFolders: this.folders.length,
      bookmarksByFolder: this.folders.map(f => ({
        folder: f.name,
        count: this.getBookmarksByFolder(f.id).length
      }))
    };
  }
}

module.exports = BookmarksManager;