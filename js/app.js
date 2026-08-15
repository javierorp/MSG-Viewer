import { MsgParser } from './msgParser.js';
import { sanitizeHtml, escapeHtml } from './sanitizer.js';

const API_BASE = window.location.protocol.startsWith('http') ? '' : 'http://127.0.0.1:8080';

// Helper function to format sender display cleanly without duplicates
function formatSenderDisplay(name, email, fallback = 'Unknown') {
  let n = (name || '').trim();
  let e = (email || '').trim();

  // Strip surrounding angle brackets from email if present
  if (e.startsWith('<') && e.endsWith('>')) {
    e = e.slice(1, -1).trim();
  }

  // If email string contains a full 'Name <email@domain>' or '<email@domain>'
  const emailInE = e.match(/<([^>]+@[^>]+)>/);
  if (emailInE) {
    if (!n) {
      n = e.replace(/<[^>]+>/, '').replace(/^"|"$/g, '').trim();
    }
    e = emailInE[1].trim();
  }

  // If name string contains '<email@domain>'
  const emailInN = n.match(/<([^>]+@[^>]+)>/);
  if (emailInN) {
    const extractedEmail = emailInN[1].trim();
    const extractedName = n.replace(/<[^>]+>/, '').replace(/^"|"$/g, '').trim();
    if (!e || e.toLowerCase() === n.toLowerCase() || e.toLowerCase() === extractedEmail.toLowerCase()) {
      e = extractedEmail;
      n = extractedName;
    } else if (n.toLowerCase().includes(e.toLowerCase())) {
      n = extractedName;
    }
  }

  // If email is not a valid email address (no @) and name is missing, use email as name
  if (e && !e.includes('@')) {
    if (!n) n = e;
    e = '';
  }

  // If name is an email address and email is empty
  if (!e && n.includes('@') && !n.includes(' ')) {
    e = n;
    n = '';
  }

  // If name and email are identical (case-insensitive)
  if (n && e && n.toLowerCase() === e.toLowerCase()) {
    n = '';
  }

  // Both name and email present
  if (n && e) {
    if (n.includes(`<${e}>`) || n.endsWith(`(${e})`)) {
      return n;
    }
    return `${n} <${e}>`;
  }

  if (n) return n;
  if (e) return e;
  return fallback;
}

class MsgViewerApp {
  constructor() {
    this.messages = [];
    this.currentMsgIndex = -1;
    this.viewMode = 'html'; // 'html' or 'text'
    
    // Font zoom level (60% to 250%, default 100%)
    this.fontZoom = parseInt(localStorage.getItem('msg_viewer_font_zoom') || '100', 10);
    if (isNaN(this.fontZoom) || this.fontZoom < 60 || this.fontZoom > 250) {
      this.fontZoom = 100;
    }

    // UI general zoom level (70% to 200%, default 100%)
    this.uiZoom = parseInt(localStorage.getItem('msg_viewer_ui_zoom') || '100', 10);
    if (isNaN(this.uiZoom) || this.uiZoom < 70 || this.uiZoom > 200) {
      this.uiZoom = 100;
    }

    this.initDOMElements();
    this.initEventListeners();
    this.initSidebarResizer();
    this.initTheme();
    this.applyFontZoom();
    this.applyUiZoom();
    this.checkUrlParams();
  }

  initDOMElements() {
    this.elements = {
      app: document.getElementById('app'),
      dropZoneCard: document.getElementById('dropZoneCard'),
      fileInput: document.getElementById('fileInput'),
      dragOverlay: document.getElementById('dragOverlay'),
      sidebar: document.getElementById('sidebar'),
      sidebarResizer: document.getElementById('sidebarResizer'),
      fileList: document.getElementById('fileList'),
      searchInput: document.getElementById('searchInput'),
      emptyState: document.getElementById('emptyState'),
      emailDetails: document.getElementById('emailDetails'),
      
      // Email Header Fields
      emailSubject: document.getElementById('emailSubject'),
      emailSender: document.getElementById('emailSender'),
      emailTo: document.getElementById('emailTo'),
      emailCcRow: document.getElementById('emailCcRow'),
      emailCc: document.getElementById('emailCc'),
      emailPath: document.getElementById('emailPath'),
      btnOpenPathFolder: document.getElementById('btnOpenPathFolder'),
      emailDate: document.getElementById('emailDate'),
      
      // View Controls & Content
      tabHtml: document.getElementById('tabHtml'),
      tabText: document.getElementById('tabText'),
      btnFontDecrease: document.getElementById('btnFontDecrease'),
      btnFontIncrease: document.getElementById('btnFontIncrease'),
      btnFontReset: document.getElementById('btnFontReset'),
      fontZoomLevel: document.getElementById('fontZoomLevel'),

      btnUiZoomDecrease: document.getElementById('btnUiZoomDecrease'),
      btnUiZoomIncrease: document.getElementById('btnUiZoomIncrease'),
      btnUiZoomReset: document.getElementById('btnUiZoomReset'),
      uiZoomLevel: document.getElementById('uiZoomLevel'),

      attachmentsBar: document.getElementById('attachmentsBar'),
      attachmentsList: document.getElementById('attachmentsList'),
      bodyWrapper: document.getElementById('bodyWrapper'),
      bodyIframe: document.getElementById('bodyIframe'),
      bodyPlain: document.getElementById('bodyPlain'),
      
      // Actions
      btnOpen: document.getElementById('btnOpen'),
      btnPrint: document.getElementById('btnPrint'),
      btnReload: document.getElementById('btnReload'),
      btnThemeToggle: document.getElementById('btnThemeToggle'),
      iconTheme: document.getElementById('iconTheme')
    };
  }

  initEventListeners() {
    const openFilePicker = async (e) => {
      if (e) e.stopPropagation();
      try {
        const response = await fetch(`${API_BASE}/api/pick-files`, { method: 'POST' });
        if (response.ok) {
          const data = await response.json();
          if (!data.cancelled && data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
              this.messages.push(msg);
            });
            this.renderSidebarList();
            this.selectMessage(this.messages.length - data.messages.length);
            return;
          } else if (data.cancelled) {
            return;
          }
        }
      } catch (err) {
        console.warn('Backend picker unavailable, using fallback input:', err);
      }
      if (this.elements.fileInput) {
        this.elements.fileInput.click();
      }
    };

    const openFolderPicker = async (e) => {
      if (e) e.stopPropagation();
      try {
        const response = await fetch(`${API_BASE}/api/pick-folder`, { method: 'POST' });
        if (response.ok) {
          const data = await response.json();
          if (!data.cancelled && data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
              this.messages.push(msg);
            });
            this.renderSidebarList();
            this.selectMessage(this.messages.length - data.messages.length);
            return;
          } else if (data.cancelled) {
            return;
          }
        }
      } catch (err) {
        console.warn('Backend folder picker unavailable:', err);
      }
      if (this.elements.fileInput) {
        this.elements.fileInput.click();
      }
    };

    // File input change
    if (this.elements.fileInput) {
      this.elements.fileInput.addEventListener('change', (e) => this.handleFilesSelected(e.target.files));
    }
    if (this.elements.btnOpen) {
      this.elements.btnOpen.addEventListener('click', openFilePicker);
    }
    if (this.elements.dropZoneCard) {
      this.elements.dropZoneCard.addEventListener('click', openFilePicker);
    }

    // Drag and Drop Events on Window
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.elements.dragOverlay) this.elements.dragOverlay.classList.add('active');
    });

    if (this.elements.dragOverlay) {
      this.elements.dragOverlay.addEventListener('dragleave', (e) => {
        e.preventDefault();
        this.elements.dragOverlay.classList.remove('active');
      });
    }

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (this.elements.dragOverlay) this.elements.dragOverlay.classList.remove('active');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleFilesSelected(e.dataTransfer.files);
      }
    });

    // Search filter
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => this.filterFileList(e.target.value));
    }

    // View mode tabs
    if (this.elements.tabHtml) {
      this.elements.tabHtml.addEventListener('click', () => this.setViewMode('html'));
    }
    if (this.elements.tabText) {
      this.elements.tabText.addEventListener('click', () => this.setViewMode('text'));
    }

    if (this.elements.btnFontDecrease) {
      this.elements.btnFontDecrease.addEventListener('click', () => this.changeFontZoom(-10));
    }
    if (this.elements.btnFontIncrease) {
      this.elements.btnFontIncrease.addEventListener('click', () => this.changeFontZoom(10));
    }
    if (this.elements.btnFontReset) {
      this.elements.btnFontReset.addEventListener('click', () => this.resetFontZoom());
    }

    if (this.elements.btnUiZoomDecrease) {
      this.elements.btnUiZoomDecrease.addEventListener('click', () => this.changeUiZoom(-10));
    }
    if (this.elements.btnUiZoomIncrease) {
      this.elements.btnUiZoomIncrease.addEventListener('click', () => this.changeUiZoom(10));
    }
    if (this.elements.btnUiZoomReset) {
      this.elements.btnUiZoomReset.addEventListener('click', () => this.resetUiZoom());
    }

    window.addEventListener('keydown', (e) => {
      if (
        e.key === 'F5' ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))
      ) {
        e.preventDefault();
        window.location.reload();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
          e.preventDefault();
          this.changeUiZoom(10);
        } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          this.changeUiZoom(-10);
        } else if (e.key === '0' || e.code === 'Numpad0') {
          e.preventDefault();
          this.resetUiZoom();
        }
      }
    });

    if (this.elements.btnReload) {
      this.elements.btnReload.addEventListener('click', () => {
        window.location.reload();
      });
    }

    // Theme toggle
    if (this.elements.btnThemeToggle) {
      this.elements.btnThemeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Print button
    if (this.elements.btnPrint) {
      this.elements.btnPrint.addEventListener('click', () => {
        if (this.viewMode === 'html' && this.elements.bodyIframe.style.display !== 'none') {
          try {
            this.elements.bodyIframe.contentWindow.focus();
            this.elements.bodyIframe.contentWindow.print();
            return;
          } catch (e) {}
        }
        window.print();
      });
    }

    // Open Folder Location button
    if (this.elements.btnOpenPathFolder) {
      this.elements.btnOpenPathFolder.addEventListener('click', () => this.openFileLocation());
    }
  }

  initSidebarResizer() {
    const sidebar = this.elements.sidebar || document.getElementById('sidebar') || document.querySelector('.sidebar');
    const resizer = this.elements.sidebarResizer || document.getElementById('sidebarResizer');
    if (!sidebar || !resizer) return;

    const MIN_WIDTH = 220;
    const DEFAULT_WIDTH = 340;

    const getMaxWidth = () => {
      const mainContentWidth = document.querySelector('.main-content')?.clientWidth || window.innerWidth;
      return Math.max(MIN_WIDTH, mainContentWidth - 320);
    };

    // Restore saved width from localStorage
    const savedWidth = parseInt(localStorage.getItem('msg_viewer_sidebar_width'), 10);
    if (!isNaN(savedWidth) && savedWidth >= MIN_WIDTH) {
      const maxWidth = getMaxWidth();
      const initialWidth = Math.min(Math.max(savedWidth, MIN_WIDTH), maxWidth);
      sidebar.style.width = `${initialWidth}px`;
      resizer.setAttribute('aria-valuenow', initialWidth);
    }

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    const onPointerDown = (e) => {
      if (e.button !== 0) return; // Only primary mouse button
      isDragging = true;
      startX = e.clientX;
      startWidth = sidebar.getBoundingClientRect().width;

      document.body.classList.add('is-resizing');
      resizer.classList.add('active');

      if (resizer.setPointerCapture && e.pointerId !== undefined) {
        try {
          resizer.setPointerCapture(e.pointerId);
        } catch (_) {}
      }

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const deltaX = e.clientX - startX;
      const targetWidth = startWidth + deltaX;
      const maxWidth = getMaxWidth();
      const clampedWidth = Math.min(Math.max(targetWidth, MIN_WIDTH), maxWidth);

      sidebar.style.width = `${clampedWidth}px`;
      resizer.setAttribute('aria-valuenow', Math.round(clampedWidth));
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;

      document.body.classList.remove('is-resizing');
      resizer.classList.remove('active');

      if (resizer.releasePointerCapture && e.pointerId !== undefined) {
        try {
          resizer.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      const currentWidth = Math.round(sidebar.getBoundingClientRect().width);
      localStorage.setItem('msg_viewer_sidebar_width', currentWidth.toString());
    };

    resizer.addEventListener('pointerdown', onPointerDown);

    // Double-click to reset to default width
    resizer.addEventListener('dblclick', () => {
      sidebar.style.width = `${DEFAULT_WIDTH}px`;
      resizer.setAttribute('aria-valuenow', DEFAULT_WIDTH);
      localStorage.setItem('msg_viewer_sidebar_width', DEFAULT_WIDTH.toString());
    });

    // Keyboard accessibility (ArrowLeft, ArrowRight, Home, End, Enter)
    resizer.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 50 : 20;
      const currentWidth = sidebar.getBoundingClientRect().width;
      let newWidth = currentWidth;

      if (e.key === 'ArrowLeft') {
        newWidth = Math.max(MIN_WIDTH, currentWidth - step);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        newWidth = Math.min(getMaxWidth(), currentWidth + step);
        e.preventDefault();
      } else if (e.key === 'Home') {
        newWidth = MIN_WIDTH;
        e.preventDefault();
      } else if (e.key === 'End') {
        newWidth = getMaxWidth();
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === ' ') {
        newWidth = DEFAULT_WIDTH;
        e.preventDefault();
      } else {
        return;
      }

      const rounded = Math.round(newWidth);
      sidebar.style.width = `${rounded}px`;
      resizer.setAttribute('aria-valuenow', rounded);
      localStorage.setItem('msg_viewer_sidebar_width', rounded.toString());
    });

    // Window resize adaptation
    window.addEventListener('resize', () => {
      const currentWidth = sidebar.getBoundingClientRect().width;
      const maxWidth = getMaxWidth();
      if (currentWidth > maxWidth) {
        sidebar.style.width = `${maxWidth}px`;
        resizer.setAttribute('aria-valuenow', Math.round(maxWidth));
        localStorage.setItem('msg_viewer_sidebar_width', Math.round(maxWidth).toString());
      }
    });
  }

  initTheme() {
    const savedTheme = localStorage.getItem('msg_viewer_theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.setTheme(savedTheme);
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('msg_viewer_theme', theme);
    
    if (this.elements.iconTheme) {
      if (theme === 'dark') {
        this.elements.iconTheme.setAttribute('d', 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z');
      } else {
        this.elements.iconTheme.setAttribute('d', 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z');
      }
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    this.setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }

  async parseMsgWithServer(arrayBuffer, file) {
    try {
      const headers = { 'Content-Type': 'application/octet-stream' };
      if (file) {
        headers['X-File-Name'] = encodeURIComponent(file.name || '');
        headers['X-File-Size'] = String(file.size || 0);
      }
      const response = await fetch(`${API_BASE}/api/parse`, {
        method: 'POST',
        headers: headers,
        body: arrayBuffer,
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (err) {}
    return null;
  }

  async handleFilesSelected(files) {
    const msgFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.msg'));
    if (msgFiles.length === 0) {
      alert('Please select a file with .msg extension');
      return;
    }

    for (const file of msgFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        let parsedData = await this.parseMsgWithServer(arrayBuffer, file);

        if (!parsedData) {
          const parser = new MsgParser(arrayBuffer);
          parsedData = parser.parse();
        }
        
        parsedData.fileName = file.name;
        parsedData.fileSize = file.size;
        parsedData.filePath = parsedData.filePath || file.path || file.webkitRelativePath || file.name;
        
        this.messages.push(parsedData);
      } catch (err) {
        console.error('Error parsing .msg file:', err);
        alert(`Could not read file ${file.name}: ${err.message}`);
      }
    }

    if (this.messages.length > 0) {
      this.renderSidebarList();
      this.selectMessage(this.messages.length - msgFiles.length); // Select first newly added msg
    }
  }

  renderSidebarList() {
    this.elements.fileList.innerHTML = '';
    
    this.messages.forEach((msg, idx) => {
      const item = document.createElement('div');
      item.className = `file-item ${idx === this.currentMsgIndex ? 'active' : ''}`;
      const senderStr = formatSenderDisplay(msg.senderName, msg.senderEmail, 'Unknown');
      item.innerHTML = `
        <div class="file-item-subject">${escapeHtml(msg.subject || '(No Subject)')}</div>
        <div class="file-item-meta">
          <span class="file-item-sender">${escapeHtml(senderStr)}</span>
          <span>${msg.attachments ? msg.attachments.length + ' 📎' : ''}</span>
        </div>
      `;
      
      item.addEventListener('click', () => this.selectMessage(idx));
      this.elements.fileList.appendChild(item);
    });
  }

  filterFileList(query) {
    const q = query.toLowerCase();
    const items = this.elements.fileList.children;
    
    this.messages.forEach((msg, idx) => {
      const senderStr = formatSenderDisplay(msg.senderName, msg.senderEmail, '');
      const match = (msg.subject && msg.subject.toLowerCase().includes(q)) ||
                    (msg.senderName && msg.senderName.toLowerCase().includes(q)) ||
                    (msg.senderEmail && msg.senderEmail.toLowerCase().includes(q)) ||
                    (senderStr && senderStr.toLowerCase().includes(q));
      
      if (items[idx]) {
        items[idx].style.display = match ? 'flex' : 'none';
      }
    });
  }

  selectMessage(index) {
    if (index < 0 || index >= this.messages.length) return;
    
    this.currentMsgIndex = index;
    const msg = this.messages[index];
    
    // Update Active Class in Sidebar
    Array.from(this.elements.fileList.children).forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });

    // Show Details view, Hide Empty State
    this.elements.emptyState.style.display = 'none';
    this.elements.emailDetails.style.display = 'flex';

    // Populate Header Fields
    this.elements.emailSubject.textContent = msg.subject || '(No Subject)';
    this.elements.emailSender.textContent = formatSenderDisplay(msg.senderName, msg.senderEmail, 'Unknown');
    this.elements.emailTo.textContent = msg.displayTo || '(No Recipients)';
    
    if (msg.displayCc) {
      this.elements.emailCcRow.style.display = 'contents';
      this.elements.emailCc.textContent = msg.displayCc;
    } else {
      this.elements.emailCcRow.style.display = 'none';
    }

    // Populate Path Field
    const currentPath = msg.filePath || msg.fileName || '';
    if (this.elements.emailPath) {
      this.elements.emailPath.textContent = currentPath;
      this.elements.emailPath.title = currentPath;
    }

    // Attachments
    if (this.elements.attachmentsList) {
      this.elements.attachmentsList.innerHTML = '';
      if (msg.attachments && msg.attachments.length > 0) {
        if (this.elements.attachmentsBar) this.elements.attachmentsBar.style.display = 'flex';
        msg.attachments.forEach(att => {
          const tag = document.createElement('div');
          tag.className = 'attachment-tag';
          tag.innerHTML = `
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
            <span>${escapeHtml(att.fileName)}</span>
            <span style="opacity: 0.6; font-size: 0.75rem;">(${this.formatBytes(att.size)})</span>
          `;
          tag.addEventListener('click', () => this.downloadAttachment(att));
          this.elements.attachmentsList.appendChild(tag);
        });
      } else {
        if (this.elements.attachmentsBar) this.elements.attachmentsBar.style.display = 'none';
      }
    }

    // Set Initial View (HTML if available, else Plain Text)
    if (msg.bodyHtml) {
      this.elements.tabHtml.style.display = 'inline-block';
      this.setViewMode('html');
    } else {
      this.elements.tabHtml.style.display = 'none';
      this.setViewMode('text');
    }
  }

  setViewMode(mode) {
    this.viewMode = mode;
    const msg = this.messages[this.currentMsgIndex];
    if (!msg) return;

    this.elements.tabHtml.classList.toggle('active', mode === 'html');
    this.elements.tabText.classList.toggle('active', mode === 'text');

    if (mode === 'html' && msg.bodyHtml) {
      this.elements.bodyIframe.style.display = 'block';
      this.elements.bodyPlain.style.display = 'none';
      
      const cleanHtml = sanitizeHtml(msg.bodyHtml);
      const fullDoc = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; color: #1e293b; line-height: 1.6; zoom: ${this.fontZoom / 100}; }
            img { max-width: 100%; height: auto; }
            a { color: #2563eb; }
            @media print {
              body { zoom: 1 !important; }
            }
          </style>
        </head>
        <body>${cleanHtml}</body>
        </html>
      `;
      
      const iframeDoc = this.elements.bodyIframe.contentDocument || this.elements.bodyIframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(fullDoc);
      iframeDoc.close();
      if (iframeDoc.body) {
        iframeDoc.body.style.zoom = String(this.fontZoom / 100);
      }
    } else {
      this.elements.bodyIframe.style.display = 'none';
      this.elements.bodyPlain.style.display = 'block';
      this.elements.bodyPlain.textContent = msg.bodyText || '(This email has no body text)';
    }
    this.applyFontZoom();
  }

  changeFontZoom(delta) {
    const newZoom = Math.min(250, Math.max(60, this.fontZoom + delta));
    if (newZoom !== this.fontZoom) {
      this.fontZoom = newZoom;
      localStorage.setItem('msg_viewer_font_zoom', String(this.fontZoom));
      this.applyFontZoom();
    }
  }

  resetFontZoom() {
    if (this.fontZoom !== 100) {
      this.fontZoom = 100;
      localStorage.setItem('msg_viewer_font_zoom', '100');
      this.applyFontZoom();
    }
  }

  applyFontZoom() {
    if (this.elements.fontZoomLevel) {
      this.elements.fontZoomLevel.textContent = `${this.fontZoom}%`;
    }

    if (this.elements.bodyPlain) {
      this.elements.bodyPlain.style.fontSize = `${0.95 * (this.fontZoom / 100)}rem`;
    }

    if (this.elements.bodyIframe) {
      try {
        const iframeDoc = this.elements.bodyIframe.contentDocument || this.elements.bodyIframe.contentWindow.document;
        if (iframeDoc && iframeDoc.body) {
          iframeDoc.body.style.zoom = String(this.fontZoom / 100);
        }
      } catch (e) {
        console.warn('Could not apply zoom to iframe body:', e);
      }
    }
  }

  changeUiZoom(delta) {
    const newZoom = Math.min(200, Math.max(70, this.uiZoom + delta));
    if (newZoom !== this.uiZoom) {
      this.uiZoom = newZoom;
      localStorage.setItem('msg_viewer_ui_zoom', String(this.uiZoom));
      this.applyUiZoom();
    }
  }

  resetUiZoom() {
    if (this.uiZoom !== 100) {
      this.uiZoom = 100;
      localStorage.setItem('msg_viewer_ui_zoom', '100');
      this.applyUiZoom();
    }
  }

  applyUiZoom() {
    if (this.elements.uiZoomLevel) {
      this.elements.uiZoomLevel.textContent = `${this.uiZoom}%`;
    }
    document.documentElement.style.zoom = String(this.uiZoom / 100);
  }

  downloadAttachment(attachment) {
    const blob = new Blob([attachment.content], { type: attachment.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.fileName || 'attachment';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  checkUrlParams() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      let filePath = urlParams.get('file');
      if (!filePath && window.location.hash) {
        const match = window.location.hash.match(/file=([^&]+)/);
        if (match) filePath = decodeURIComponent(match[1]);
      }
      if (filePath) {
        this.loadFileFromPath(filePath);
      }
    } catch (e) {
      console.error('Error parsing URL params:', e);
    }
  }

  async loadFileFromPath(filePath) {
    try {
      const response = await fetch(`${API_BASE}/api/load-file?path=${encodeURIComponent(filePath)}`);
      if (response.ok) {
        const data = await response.json();
        data.filePath = data.filePath || filePath;
        data.fileName = data.fileName || filePath.split(/[\\/]/).pop() || 'message.msg';
        this.messages.push(data);
        this.renderSidebarList();
        this.selectMessage(this.messages.length - 1);
      }
    } catch (err) {
      console.error('Error loading file from path:', err);
    }
  }

  async openFileLocation(msg) {
    if (!msg) {
      msg = this.messages[this.currentMsgIndex];
    }
    if (!msg) return;

    const path = msg.filePath || msg.fileName || '';
    const btn = this.elements.btnOpenPathFolder;
    const originalHtml = btn ? btn.innerHTML : '';

    try {
      const response = await fetch(`${API_BASE}/api/open-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path }),
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          if (resData.opened && msg.filePath !== resData.opened) {
            msg.filePath = resData.opened;
            if (this.elements.emailPath) {
              this.elements.emailPath.textContent = resData.opened;
              this.elements.emailPath.title = resData.opened;
            }
          }
          if (btn) {
            btn.classList.add('btn-success');
            btn.innerHTML = `
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span>Opened</span>
            `;
            setTimeout(() => {
              btn.classList.remove('btn-success');
              btn.innerHTML = originalHtml;
            }, 2000);
          }
          return;
        }
      }
    } catch (err) {
      console.warn('Backend server not available for opening folder:', err);
    }

    if (navigator.clipboard && path) {
      try {
        await navigator.clipboard.writeText(path);
        if (btn) {
          btn.innerHTML = `
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
            </svg>
            <span>Copied</span>
          `;
          setTimeout(() => {
            btn.innerHTML = originalHtml;
          }, 2000);
        }
      } catch (clipErr) {}
    }
  }
}

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MsgViewerApp();
});
