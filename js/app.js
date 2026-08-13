import { MsgParser } from './msgParser.js';
import { sanitizeHtml, escapeHtml } from './sanitizer.js';

class MsgViewerApp {
  constructor() {
    this.messages = [];
    this.currentMsgIndex = -1;
    this.viewMode = 'html'; // 'html' or 'text'
    
    this.initDOMElements();
    this.initEventListeners();
    this.initTheme();
  }

  initDOMElements() {
    this.elements = {
      app: document.getElementById('app'),
      dropZoneCard: document.getElementById('dropZoneCard'),
      fileInput: document.getElementById('fileInput'),
      dragOverlay: document.getElementById('dragOverlay'),
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
      emailDate: document.getElementById('emailDate'),
      
      // View Controls & Content
      tabHtml: document.getElementById('tabHtml'),
      tabText: document.getElementById('tabText'),
      attachmentsBar: document.getElementById('attachmentsBar'),
      attachmentsList: document.getElementById('attachmentsList'),
      bodyWrapper: document.getElementById('bodyWrapper'),
      bodyIframe: document.getElementById('bodyIframe'),
      bodyPlain: document.getElementById('bodyPlain'),
      
      // Actions
      btnOpen: document.getElementById('btnOpen'),
      btnPrint: document.getElementById('btnPrint'),
      btnThemeToggle: document.getElementById('btnThemeToggle'),
      iconTheme: document.getElementById('iconTheme')
    };
  }

  initEventListeners() {
    // File input change
    this.elements.fileInput.addEventListener('change', (e) => this.handleFilesSelected(e.target.files));
    this.elements.btnOpen.addEventListener('click', () => this.elements.fileInput.click());
    this.elements.dropZoneCard.addEventListener('click', () => this.elements.fileInput.click());

    // Drag and Drop Events on Window
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.dragOverlay.classList.add('active');
    });

    this.elements.dragOverlay.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.elements.dragOverlay.classList.remove('active');
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.dragOverlay.classList.remove('active');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleFilesSelected(e.dataTransfer.files);
      }
    });

    // Search filter
    this.elements.searchInput.addEventListener('input', (e) => this.filterFileList(e.target.value));

    // View mode tabs
    this.elements.tabHtml.addEventListener('click', () => this.setViewMode('html'));
    this.elements.tabText.addEventListener('click', () => this.setViewMode('text'));

    // Theme toggle
    this.elements.btnThemeToggle.addEventListener('click', () => this.toggleTheme());

    // Print button
    this.elements.btnPrint.addEventListener('click', () => window.print());
  }

  initTheme() {
    const savedTheme = localStorage.getItem('msg_viewer_theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.setTheme(savedTheme);
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('msg_viewer_theme', theme);
    
    if (theme === 'dark') {
      this.elements.iconTheme.setAttribute('d', 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z');
    } else {
      this.elements.iconTheme.setAttribute('d', 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z');
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    this.setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }

  async handleFilesSelected(files) {
    const msgFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.msg'));
    if (msgFiles.length === 0) {
      alert('Por favor selecciona un archivo con extensión .msg');
      return;
    }

    for (const file of msgFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const parser = new MsgParser(arrayBuffer);
        const parsedData = parser.parse();
        
        parsedData.fileName = file.name;
        parsedData.fileSize = file.size;
        
        this.messages.push(parsedData);
      } catch (err) {
        console.error('Error parseando archivo .msg:', err);
        alert(`No se pudo leer el archivo ${file.name}: ${err.message}`);
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
      item.innerHTML = `
        <div class="file-item-subject">${escapeHtml(msg.subject || '(Sin Asunto)')}</div>
        <div class="file-item-meta">
          <span class="file-item-sender">${escapeHtml(msg.senderName || msg.senderEmail || 'Desconocido')}</span>
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
      const match = (msg.subject && msg.subject.toLowerCase().includes(q)) ||
                    (msg.senderName && msg.senderName.toLowerCase().includes(q)) ||
                    (msg.senderEmail && msg.senderEmail.toLowerCase().includes(q));
      
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
    this.elements.emailSubject.textContent = msg.subject || '(Sin Asunto)';
    this.elements.emailSender.textContent = msg.senderEmail ? `${msg.senderName} <${msg.senderEmail}>` : (msg.senderName || 'Desconocido');
    this.elements.emailTo.textContent = msg.displayTo || '(Sin Destinatarios)';
    
    if (msg.displayCc) {
      this.elements.emailCcRow.style.display = 'grid';
      this.elements.emailCc.textContent = msg.displayCc;
    } else {
      this.elements.emailCcRow.style.display = 'none';
    }

    // Attachments
    this.elements.attachmentsList.innerHTML = '';
    if (msg.attachments && msg.attachments.length > 0) {
      this.elements.attachmentsBar.style.display = 'flex';
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
      this.elements.attachmentsBar.style.display = 'none';
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
            body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; color: #1e293b; line-height: 1.6; }
            img { max-width: 100%; height: auto; }
            a { color: #2563eb; }
          </style>
        </head>
        <body>${cleanHtml}</body>
        </html>
      `;
      
      const iframeDoc = this.elements.bodyIframe.contentDocument || this.elements.bodyIframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(fullDoc);
      iframeDoc.close();
    } else {
      this.elements.bodyIframe.style.display = 'none';
      this.elements.bodyPlain.style.display = 'block';
      this.elements.bodyPlain.textContent = msg.bodyText || '(Este correo no contiene texto en el cuerpo)';
    }
  }

  downloadAttachment(attachment) {
    const blob = new Blob([attachment.content], { type: attachment.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.fileName || 'adjunto';
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
}

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MsgViewerApp();
});
