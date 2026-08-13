/**
 * Self-Contained Bundle for MSG Viewer
 * Features: Guaranteed 3-Line Sidebar List Cards (Subject, Sender, Date/Time),
 * Robust Multi-Attribute Date Parser, Folder Selection, Multi-Language Dropdown (ES/EN),
 * High-Contrast Theme, Pure Black Print Engine, Dual Engine (Python REST API + Native JS OLE CFBF parser),
 * LZFu RTF Decompressor, HTML Sanitizer.
 */

(function() {
  // 1. i18n Dictionary Map
  const translations = {
    es: {
      appTitle: "MSG Viewer",
      openMsg: "Abrir Correo .msg",
      openFolder: "Abrir Carpeta",
      printPdf: "Imprimir / PDF",
      searchPlaceholder: "Buscar por asunto o remitente...",
      dropTitle: "Selecciona o arrastra un correo .msg o carpeta",
      dropDesc: "Haz clic en los botones o arrastra archivos de correo (.msg) o carpetas completas desde tu equipo para abrirlos de forma instantánea.",
      exploreFiles: "Explorar Archivos",
      dropOverlayTitle: "Suelta los archivos o carpetas .msg aquí",
      dropOverlayDesc: "Se añadirán a la lista de mensajes de forma inmediata",
      noSubject: "(Sin Asunto)",
      unknownSender: "Desconocido",
      noRecipients: "(Sin Destinatarios)",
      noDate: "Sin fecha",
      labelFrom: "De:",
      labelTo: "Para:",
      labelCc: "CC:",
      tabHtml: "HTML Original",
      tabText: "Texto Plano",
      attachmentsTitle: "Archivos Adjuntos",
      saveAll: "Guardar Todos",
      btnPreview: "👁️ Ver",
      btnSave: "💾 Guardar",
      modalTitle: "Vista Previa",
      modalSave: "Guardar Archivo",
      modalClose: "Cerrar",
      previewNotAvailable: "Vista previa no disponible directamente para este formato.",
      downloadFile: "Descargar Archivo",
      noBodyText: "(Este correo no contiene texto en el cuerpo)",
      noBodyHtml: "(Este correo no contiene texto en el cuerpo)",
      selectMsgAlert: "No se encontraron archivos con extensión .msg en la selección.",
      readErrorAlert: "No se pudo leer el archivo",
      aboutTitle: "Acerca de MSG Viewer",
      aboutCreator: "Creador:",
      aboutRepo: "Repositorio GitHub:",
      aboutDesc: "Visor gratuito, offline y seguro de archivos .msg para Windows sin necesidad de permisos de administrador."
    },
    en: {
      appTitle: "MSG Viewer",
      openMsg: "Open .msg Email",
      openFolder: "Open Folder",
      printPdf: "Print / PDF",
      searchPlaceholder: "Search by subject or sender...",
      dropTitle: "Select or drag a .msg email or folder",
      dropDesc: "Click the buttons or drag email files (.msg) or entire folders from your computer to open them instantly.",
      exploreFiles: "Browse Files",
      dropOverlayTitle: "Drop .msg files or folders here",
      dropOverlayDesc: "They will be added to the message list immediately",
      noSubject: "(No Subject)",
      unknownSender: "Unknown",
      noRecipients: "(No Recipients)",
      noDate: "No date",
      labelFrom: "From:",
      labelTo: "To:",
      labelCc: "CC:",
      tabHtml: "Original HTML",
      tabText: "Plain Text",
      attachmentsTitle: "Attachments",
      saveAll: "Save All",
      btnPreview: "👁️ View",
      btnSave: "💾 Save",
      modalTitle: "Preview",
      modalSave: "Save File",
      modalClose: "Close",
      previewNotAvailable: "Direct preview not available for this file format.",
      downloadFile: "Download File",
      noBodyText: "(This email has no body text)",
      noBodyHtml: "(This email has no body text)",
      selectMsgAlert: "No .msg files were found in the selection.",
      readErrorAlert: "Could not read file",
      aboutTitle: "About MSG Viewer",
      aboutCreator: "Creator:",
      aboutRepo: "GitHub Repository:",
      aboutDesc: "Free, offline and secure .msg email viewer for Windows without administrator permissions."
    }
  };

  // Helper function to format date/time string nicely
  function formatDateString(dateVal) {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}`;
      }
    } catch (e) {}
    return String(dateVal);
  }

  // Clean garbled characters and unicode replacement noise
  function cleanGarbledText(str) {
    if (!str) return '';
    return str
      .replace(/\uFFFD/g, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .trim();
  }

  // 2. Sanitizer & Escaping Functions
  function sanitizeHtml(rawHtml) {
    if (!rawHtml) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    const forbiddenTags = ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta'];
    forbiddenTags.forEach(tag => {
      const elements = doc.querySelectorAll(tag);
      elements.forEach(el => el.remove());
    });

    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = attr.value.toLowerCase();

        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
        if ((name === 'href' || name === 'src') && value.trim().startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      });

      if (el.tagName.toLowerCase() === 'a') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });

    return doc.body.innerHTML;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function base64ToUint8Array(base64) {
    if (!base64) return new Uint8Array(0);
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // 3. MS-OXRTFCP LZFu RTF Decompressor
  function decompressLZFu(buffer) {
    if (!buffer || buffer.length < 16) return null;

    const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const compSize = dataView.getUint32(0, true);
    const rawSize = dataView.getUint32(4, true);
    const compType = dataView.getUint32(8, true);

    const isLZFu = (buffer[8] === 0x4C && buffer[9] === 0x5A && buffer[10] === 0x46 && buffer[11] === 0x75) || compType === 0x4145779B;
    const isUncompressed = compType === 0x4145779A || (buffer[8] === 0x4D && buffer[9] === 0x49 && buffer[10] === 0x45 && buffer[11] === 0x4E);

    if (isUncompressed) {
      return buffer.subarray(16, Math.min(buffer.length, 16 + rawSize));
    }

    if (!isLZFu) return null;

    const INIT_DICT_STR = "{\\rtf1\\ansi\\mac\\deff0\\deftab720{\\fonttbl;}{\\f0\\fnil \\froman \\fswiss \\fmodern \\fscript \\fdecor MS Sans SerifSymbolArialTimes New RomanCourier{\\colortbl\\red0\\green0\\blue0\r\n\\par \\pard\\plain\\f0\\fs20\\b\\i\\u\\tab\\tx";
    const dict = new Uint8Array(4096);
    for (let i = 0; i < INIT_DICT_STR.length; i++) {
      dict[i] = INIT_DICT_STR.charCodeAt(i);
    }
    for (let i = INIT_DICT_STR.length; i < 4096; i++) {
      dict[i] = 0x20;
    }

    let writeOffset = INIT_DICT_STR.length;
    const output = new Uint8Array(rawSize);
    let outPos = 0;
    let inPos = 16;

    while (inPos < buffer.length && outPos < rawSize) {
      const flagByte = buffer[inPos++];
      
      for (let bit = 0; bit < 8; bit++) {
        if (inPos >= buffer.length || outPos >= rawSize) break;
        const isRef = (flagByte & (1 << bit)) !== 0;

        if (isRef) {
          if (inPos + 1 >= buffer.length) break;
          const b1 = buffer[inPos++];
          const b2 = buffer[inPos++];
          const token = (b1 << 8) | b2;
          const offset = (token >> 4) & 0xFFF;
          const length = (token & 0xF) + 2;

          for (let step = 0; step < length; step++) {
            if (outPos >= rawSize) break;
            const char = dict[(offset + step) % 4096];
            output[outPos++] = char;
            dict[writeOffset] = char;
            writeOffset = (writeOffset + 1) % 4096;
          }
        } else {
          const char = buffer[inPos++];
          output[outPos++] = char;
          dict[writeOffset] = char;
          writeOffset = (writeOffset + 1) % 4096;
        }
      }
    }

    return output.subarray(0, outPos);
  }

  // 4. Extract HTML or Clean Text from Decompressed RTF
  function extractHtmlFromRtf(rtfBytes) {
    if (!rtfBytes || rtfBytes.length === 0) return { html: '', text: '' };

    let rtfString = '';
    try {
      rtfString = new TextDecoder('windows-1252').decode(rtfBytes);
    } catch (e) {
      rtfString = new TextDecoder('utf-8').decode(rtfBytes);
    }

    // Step 1: Strip RTF fallback text blocks (\htmlrtf ... \htmlrtf0)
    let clean = rtfString.replace(/\\htmlrtf[\s\S]*?\\htmlrtf0/gi, '');

    // Step 2: Unencapsulate RTF htmltag groups
    clean = clean.replace(/\{\\\*\\htmltag\d* ?([\s\S]*?)\}/gi, '$1');
    clean = clean.replace(/\\htmltag\d* ?/gi, '');

    // Step 3: Decode RTF hex escapes (\'xx -> character)
    clean = clean.replace(/\\\'([0-9a-fA-F]{2})/g, (match, hex) => {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code);
    });

    // Step 4: Direct search for full HTML tags (<html...</html> or <!DOCTYPE...</html> or <body...</body>)
    const htmlMatch = clean.match(/(<html[\s\S]*?<\/html>|<!DOCTYPE[\s\S]*?<\/html>|<body[\s\S]*?<\/body>)/i);
    if (htmlMatch) {
      let cleanHtml = htmlMatch[0];
      cleanHtml = cleanHtml.replace(/\\([a-zA-Z]+)(-?\d+)? ?/g, '');
      return { html: cleanHtml, text: '' };
    }

    // Step 5: Partial HTML check (<div...>, <p...>, etc.)
    if (clean.includes('<') && clean.includes('>')) {
      let partialHtml = clean.replace(/\\([a-zA-Z]+)(-?\d+)? ?/g, '');
      const subMatch = partialHtml.match(/(<div[\s\S]*?<\/div>|<p[\s\S]*?<\/p>|<table[\s\S]*?<\/table>)/i);
      if (subMatch) {
        return { html: subMatch[0], text: cleanGarbledText(clean.replace(/<[^>]+>/g, ' ')) };
      } else {
        return { html: partialHtml, text: cleanGarbledText(clean.replace(/<[^>]+>/g, ' ')) };
      }
    }

    // Step 6: Fallback for Plain Text
    let plainText = rtfString
      .replace(/\\par/gi, '\n')
      .replace(/\\line/gi, '\n')
      .replace(/\\tab/gi, '\t')
      .replace(/\\\'([0-9a-fA-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\[a-zA-Z]+(-?\d+)? ?/g, '')
      .replace(/[{}]/g, '');

    plainText = cleanGarbledText(plainText);

    return { html: '', text: plainText };
  }

  function decodeStreamBytes(buffer, isUnicode = true) {
    if (!buffer || buffer.length === 0) return '';

    if (isUnicode) {
      try {
        const text = new TextDecoder('utf-16le').decode(buffer).replace(/\0/g, '');
        if (text && text.trim().length > 0 && !text.includes('\uFFFD')) return cleanGarbledText(text);
      } catch (e) {}
    }

    try {
      const text = new TextDecoder('windows-1252').decode(buffer).replace(/\0/g, '');
      if (text && text.trim().length > 0) return cleanGarbledText(text);
    } catch (e) {}

    try {
      const text = new TextDecoder('utf-8').decode(buffer).replace(/\0/g, '');
      if (text && text.trim().length > 0) return cleanGarbledText(text);
    } catch (e) {}

    return '';
  }

  // 5. OLE CFBF MSG Parser Class
  class MsgParser {
    constructor(arrayBuffer) {
      this.buffer = new Uint8Array(arrayBuffer);
      this.dataView = new DataView(arrayBuffer);
      this.isLittleEndian = true;
      
      const magic = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
      for (let i = 0; i < 8; i++) {
        if (this.buffer[i] !== magic[i]) {
          throw new Error('The selected file is not a valid .msg file.');
        }
      }

      this.sectorShift = this.dataView.getUint16(30, this.isLittleEndian);
      this.sectorSize = 1 << this.sectorShift;
      this.miniSectorShift = this.dataView.getUint16(32, this.isLittleEndian);
      this.miniSectorSize = 1 << this.miniSectorShift;
      
      this.numFatSectors = this.dataView.getUint32(44, this.isLittleEndian);
      this.firstDirSector = this.dataView.getUint32(48, this.isLittleEndian);
      this.miniCutoffSize = this.dataView.getUint32(56, this.isLittleEndian);
      this.firstMiniFatSector = this.dataView.getUint32(60, this.isLittleEndian);
      this.numMiniFatSectors = this.dataView.getUint32(64, this.isLittleEndian);
      this.firstDifatSector = this.dataView.getUint32(68, this.isLittleEndian);
      this.numDifatSectors = this.dataView.getUint32(72, this.isLittleEndian);

      this.initFat();
      this.initMiniFat();
      this.initDirectory();
    }

    getSectorOffset(sector) {
      return (sector + 1) * this.sectorSize;
    }

    initFat() {
      this.fat = [];
      const difatSectors = [];
      
      for (let i = 0; i < 109; i++) {
        const sec = this.dataView.getUint32(76 + i * 4, this.isLittleEndian);
        if (sec !== 0xFFFFFFFE && sec !== 0xFFFFFFFF) {
          difatSectors.push(sec);
        }
      }

      let currDifatSector = this.firstDifatSector;
      while (currDifatSector !== 0xFFFFFFFE && currDifatSector !== 0xFFFFFFFF && currDifatSector < 0xFFFFFFFD) {
        const offset = this.getSectorOffset(currDifatSector);
        for (let i = 0; i < (this.sectorSize / 4) - 1; i++) {
          const sec = this.dataView.getUint32(offset + i * 4, this.isLittleEndian);
          if (sec !== 0xFFFFFFFE && sec !== 0xFFFFFFFF) {
            difatSectors.push(sec);
          }
        }
        currDifatSector = this.dataView.getUint32(offset + this.sectorSize - 4, this.isLittleEndian);
      }

      for (const fatSector of difatSectors) {
        const offset = this.getSectorOffset(fatSector);
        for (let i = 0; i < this.sectorSize / 4; i++) {
          this.fat.push(this.dataView.getUint32(offset + i * 4, this.isLittleEndian));
        }
      }
    }

    initMiniFat() {
      this.miniFat = [];
      let currSector = this.firstMiniFatSector;
      while (currSector !== 0xFFFFFFFE && currSector !== 0xFFFFFFFF && currSector < 0xFFFFFFFD) {
        const offset = this.getSectorOffset(currSector);
        for (let i = 0; i < this.sectorSize / 4; i++) {
          this.miniFat.push(this.dataView.getUint32(offset + i * 4, this.isLittleEndian));
        }
        currSector = this.fat[currSector];
      }
    }

    getStreamData(startSector, streamSize, isMini = false) {
      if (startSector === 0xFFFFFFFE || startSector === 0xFFFFFFFF) return new Uint8Array(0);

      const result = new Uint8Array(streamSize);
      let bytesRead = 0;
      let currSector = startSector;

      if (isMini) {
        const rootSector = this.entries[0] ? this.entries[0].startSector : 0;
        const rootData = this.getStreamData(rootSector, this.entries[0] ? this.entries[0].size : 0, false);

        while (currSector !== 0xFFFFFFFE && currSector !== 0xFFFFFFFF && bytesRead < streamSize) {
          const miniOffset = currSector * this.miniSectorSize;
          const count = Math.min(this.miniSectorSize, streamSize - bytesRead);
          result.set(rootData.subarray(miniOffset, miniOffset + count), bytesRead);
          bytesRead += count;
          currSector = this.miniFat[currSector];
        }
      } else {
        while (currSector !== 0xFFFFFFFE && currSector !== 0xFFFFFFFF && bytesRead < streamSize) {
          const offset = this.getSectorOffset(currSector);
          const count = Math.min(this.sectorSize, streamSize - bytesRead);
          result.set(this.buffer.subarray(offset, offset + count), bytesRead);
          bytesRead += count;
          currSector = this.fat[currSector];
        }
      }

      return result;
    }

    initDirectory() {
      this.entries = [];
      let currSector = this.firstDirSector;
      
      while (currSector !== 0xFFFFFFFE && currSector !== 0xFFFFFFFF && currSector < 0xFFFFFFFD) {
        const offset = this.getSectorOffset(currSector);
        for (let i = 0; i < this.sectorSize / 128; i++) {
          const entryOffset = offset + i * 128;
          const nameLen = this.dataView.getUint16(entryOffset + 64, this.isLittleEndian);
          
          if (nameLen > 0) {
            let name = '';
            for (let j = 0; j < Math.min(nameLen - 2, 64); j += 2) {
              const charCode = this.dataView.getUint16(entryOffset + j, this.isLittleEndian);
              if (charCode > 0) name += String.fromCharCode(charCode);
            }
            
            const type = this.buffer[entryOffset + 66];
            const startSector = this.dataView.getUint32(entryOffset + 116, this.isLittleEndian);
            const size = this.dataView.getUint32(entryOffset + 120, this.isLittleEndian);

            this.entries.push({ name, type, startSector, size, entryOffset });
          }
        }
        currSector = this.fat[currSector];
      }
    }

    parse() {
      const msgData = {
        subject: '',
        senderName: '',
        senderEmail: '',
        displayTo: '',
        displayCc: '',
        displayBcc: '',
        date: null,
        bodyText: '',
        bodyHtml: '',
        attachments: []
      };

      const rootEntries = this.entries;
      let rawBodyText = null;
      let rawBodyHtml = null;
      let rawBodyRtf = null;
      let htmlIsUnicode = true;

      for (const entry of rootEntries) {
        if (!entry.name) continue;
        const isMini = entry.size < this.miniCutoffSize;
        
        if (entry.name.startsWith('__substg1.0_')) {
          const tagHex = entry.name.substring(12, 16).toUpperCase();
          const typeHex = entry.name.substring(16, 20).toUpperCase();
          const rawData = this.getStreamData(entry.startSector, entry.size, isMini);

          if (tagHex === '0037') {
            msgData.subject = decodeStreamBytes(rawData, typeHex === '001F');
          } else if (tagHex === '0C1A') {
            msgData.senderName = decodeStreamBytes(rawData, typeHex === '001F');
          } else if (tagHex === '0C1F' || tagHex === '39FE') {
            const email = decodeStreamBytes(rawData, typeHex === '001F');
            if (email && email.includes('@')) msgData.senderEmail = email;
          } else if (tagHex === '0E04') {
            msgData.displayTo = decodeStreamBytes(rawData, typeHex === '001F');
          } else if (tagHex === '0E03') {
            msgData.displayCc = decodeStreamBytes(rawData, typeHex === '001F');
          } else if (tagHex === '0E02') {
            msgData.displayBcc = decodeStreamBytes(rawData, typeHex === '001F');
          } else if (tagHex === '0E06' || tagHex === '0039' || tagHex === '003B') {
            if (rawData.length >= 8 && !msgData.date) {
              const dv = new DataView(rawData.buffer, rawData.byteOffset, rawData.byteLength);
              const low = dv.getUint32(0, true);
              const high = dv.getUint32(4, true);
              const filetimeBig = (BigInt(high) << 32n) | BigInt(low);
              if (filetimeBig > 0n) {
                const unixMs = Number((filetimeBig - 116444736000000000n) / 10000n);
                if (unixMs > 0) {
                  msgData.date = new Date(unixMs).toISOString();
                }
              }
            }
          } else if (tagHex === '1000') {
            rawBodyText = { data: rawData, isUnicode: typeHex === '001F' };
          } else if (tagHex === '1013') {
            rawBodyHtml = rawData;
            htmlIsUnicode = typeHex === '001F';
          } else if (tagHex === '1009') {
            rawBodyRtf = rawData;
          }
        }
      }

      if (rawBodyHtml && rawBodyHtml.length > 0) {
        const decoded = decodeStreamBytes(rawBodyHtml, htmlIsUnicode);
        if (decoded && (decoded.includes('<') || decoded.includes('>'))) {
          msgData.bodyHtml = decoded;
        } else if (decoded) {
          msgData.bodyText = decoded;
        }
      }

      if (!msgData.bodyHtml && rawBodyRtf && rawBodyRtf.length > 0) {
        const decompressed = decompressLZFu(rawBodyRtf);
        if (decompressed) {
          const extracted = extractHtmlFromRtf(decompressed);
          if (extracted.html) msgData.bodyHtml = extracted.html;
          if (extracted.text && !msgData.bodyText) msgData.bodyText = extracted.text;
        }
      }

      if (!msgData.bodyText && rawBodyText) {
        msgData.bodyText = decodeStreamBytes(rawBodyText.data, rawBodyText.isUnicode);
      }

      if (msgData.bodyHtml && !msgData.bodyText) {
        msgData.bodyText = cleanGarbledText(msgData.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
      } else if (msgData.bodyText && !msgData.bodyHtml) {
        const formatted = escapeHtml(msgData.bodyText).replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');
        msgData.bodyHtml = `<html><body><div style="font-family: system-ui, -apple-system, sans-serif; font-size: 0.95rem; line-height: 1.6; color: #000000; white-space: pre-wrap;">${formatted}</div></body></html>`;
      }

      const attachmentStreams = new Map();
      for (const entry of rootEntries) {
        if (entry.name.includes('__attach_version1.0_')) {
          const parts = entry.name.split('_');
          const attachName = parts.slice(0, 4).join('_');
          
          if (!attachmentStreams.has(attachName)) {
            attachmentStreams.set(attachName, []);
          }
          attachmentStreams.get(attachName).push(entry);
        }
      }

      for (const [attachName, streams] of attachmentStreams.entries()) {
        let fileName = 'Attachment';
        let mimeType = 'application/octet-stream';
        let content = null;

        for (const stream of streams) {
          const isMini = stream.size < this.miniCutoffSize;
          const rawData = this.getStreamData(stream.startSector, stream.size, isMini);
          const nameUpper = stream.name.toUpperCase();

          if (nameUpper.includes('3707') || nameUpper.includes('3704')) {
            fileName = decodeStreamBytes(rawData, nameUpper.endsWith('001F'));
          } else if (nameUpper.includes('370E')) {
            mimeType = decodeStreamBytes(rawData, nameUpper.endsWith('001F'));
          } else if (nameUpper.includes('3701')) {
            content = rawData;
          }
        }

        if (content && content.length > 0) {
          const cleanFileName = fileName.replace(/\0/g, '').trim() || 'attachment.bin';
          const ext = cleanFileName.includes('.') ? cleanFileName.split('.').pop().toLowerCase() : '';
          
          if (!mimeType || mimeType === 'application/octet-stream') {
            if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            else if (ext === 'pdf') mimeType = 'application/pdf';
            else if (['txt', 'log', 'csv', 'json', 'xml', 'html', 'js', 'py'].includes(ext)) mimeType = 'text/plain';
          }

          msgData.attachments.push({
            fileName: cleanFileName,
            mimeType: mimeType.replace(/\0/g, '').trim(),
            content: content,
            size: content.length,
            extension: ext
          });
        }
      }

      if (!msgData.senderEmail && msgData.senderName) {
        msgData.senderEmail = msgData.senderName;
      }

      return msgData;
    }
  }

  // 6. Main Application Controller Class
  class MsgViewerApp {
    constructor() {
      this.messages = [];
      this.currentMsgIndex = -1;
      this.currentPreviewAttachment = null;
      this.viewMode = 'html';
      
      // i18n language state
      const defaultLang = 'en';
      this.currentLang = localStorage.getItem('msg_viewer_lang') || defaultLang;

      this.initDOMElements();
      this.initEventListeners();
      this.initTheme();
      this.applyLanguage(this.currentLang);
    }

    t(key) {
      const dict = translations[this.currentLang] || translations.en;
      return dict[key] || key;
    }

    applyLanguage(lang) {
      if (!translations[lang]) lang = 'en';
      this.currentLang = lang;
      localStorage.setItem('msg_viewer_lang', lang);
      document.documentElement.lang = lang;
      document.title = "MSG Viewer";

      // Update lang select dropdown value
      if (this.elements.langSelect) {
        this.elements.langSelect.value = lang;
      }

      // Update data-i18n text content
      const i18nElements = document.querySelectorAll('[data-i18n]');
      i18nElements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && translations[lang][key]) {
          el.textContent = translations[lang][key];
        }
      });

      // Update data-i18n-placeholder
      const i18nPlaceholders = document.querySelectorAll('[data-i18n-placeholder]');
      i18nPlaceholders.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && translations[lang][key]) {
          el.placeholder = translations[lang][key];
        }
      });

      // Re-render message detail & list if currently viewing an email
      if (this.currentMsgIndex >= 0) {
        this.selectMessage(this.currentMsgIndex);
      }
    }

    initDOMElements() {
      this.elements = {
        app: document.getElementById('app'),
        dropZoneCard: document.getElementById('dropZoneCard'),
        btnExplore: document.getElementById('btnExplore'),
        btnExploreFolder: document.getElementById('btnExploreFolder'),
        fileInput: document.getElementById('fileInput'),
        folderInput: document.getElementById('folderInput'),
        dragOverlay: document.getElementById('dragOverlay'),
        fileList: document.getElementById('fileList'),
        searchInput: document.getElementById('searchInput'),
        emptyState: document.getElementById('emptyState'),
        emailDetails: document.getElementById('emailDetails'),
        
        emailSubject: document.getElementById('emailSubject'),
        emailSender: document.getElementById('emailSender'),
        emailTo: document.getElementById('emailTo'),
        emailCcRow: document.getElementById('emailCcRow'),
        emailCc: document.getElementById('emailCc'),
        
        tabHtml: document.getElementById('tabHtml'),
        tabText: document.getElementById('tabText'),
        
        attachmentsSection: document.getElementById('attachmentsSection'),
        attachmentsCount: document.getElementById('attachmentsCount'),
        attachmentsGrid: document.getElementById('attachmentsGrid'),
        btnDownloadAll: document.getElementById('btnDownloadAll'),
        
        bodyIframe: document.getElementById('bodyIframe'),
        bodyPlain: document.getElementById('bodyPlain'),
        
        btnOpen: document.getElementById('btnOpen'),
        btnOpenFolder: document.getElementById('btnOpenFolder'),
        btnPrint: document.getElementById('btnPrint'),
        btnThemeToggle: document.getElementById('btnThemeToggle'),
        btnAbout: document.getElementById('btnAbout'),
        iconTheme: document.getElementById('iconTheme'),
        langSelect: document.getElementById('langSelect'),
        
        previewModal: document.getElementById('previewModal'),
        modalFileName: document.getElementById('modalFileName'),
        modalBody: document.getElementById('modalBody'),
        modalBtnDownload: document.getElementById('modalBtnDownload'),
        modalBtnClose: document.getElementById('modalBtnClose'),

        aboutModal: document.getElementById('aboutModal'),
        aboutModalBtnClose: document.getElementById('aboutModalBtnClose')
      };
    }

    initEventListeners() {
      const openFilePicker = (e) => {
        if (e) e.stopPropagation();
        this.elements.fileInput.click();
      };

      const openFolderPicker = (e) => {
        if (e) e.stopPropagation();
        if ('showDirectoryPicker' in window && window.location.protocol.startsWith('http')) {
          this.handleDirectoryPicker();
        } else if (this.elements.folderInput) {
          this.elements.folderInput.click();
        }
      };

      if (this.elements.fileInput) {
        this.elements.fileInput.addEventListener('change', (e) => this.handleFilesSelected(e.target.files));
      }
      if (this.elements.folderInput) {
        this.elements.folderInput.addEventListener('change', (e) => this.handleFilesSelected(e.target.files));
      }

      if (this.elements.btnOpen) {
        this.elements.btnOpen.addEventListener('click', openFilePicker);
      }
      if (this.elements.btnOpenFolder) {
        this.elements.btnOpenFolder.addEventListener('click', openFolderPicker);
      }
      if (this.elements.btnExplore) {
        this.elements.btnExplore.addEventListener('click', openFilePicker);
      }
      if (this.elements.btnExploreFolder) {
        this.elements.btnExploreFolder.addEventListener('click', openFolderPicker);
      }
      if (this.elements.dropZoneCard) {
        this.elements.dropZoneCard.addEventListener('click', openFilePicker);
      }

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

      if (this.elements.searchInput) {
        this.elements.searchInput.addEventListener('input', (e) => this.filterFileList(e.target.value));
      }

      if (this.elements.tabHtml) {
        this.elements.tabHtml.addEventListener('click', () => this.setViewMode('html'));
      }
      if (this.elements.tabText) {
        this.elements.tabText.addEventListener('click', () => this.setViewMode('text'));
      }

      if (this.elements.btnThemeToggle) {
        this.elements.btnThemeToggle.addEventListener('click', () => this.toggleTheme());
      }
      if (this.elements.btnAbout) {
        this.elements.btnAbout.addEventListener('click', () => this.openAboutModal());
      }
      if (this.elements.langSelect) {
        this.elements.langSelect.addEventListener('change', (e) => this.applyLanguage(e.target.value));
      }

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

      if (this.elements.btnDownloadAll) {
        this.elements.btnDownloadAll.addEventListener('click', () => this.downloadAllAttachments());
      }

      if (this.elements.modalBtnClose) {
        this.elements.modalBtnClose.addEventListener('click', () => this.closePreviewModal());
      }
      if (this.elements.previewModal) {
        this.elements.previewModal.addEventListener('click', (e) => {
          if (e.target === this.elements.previewModal) this.closePreviewModal();
        });
      }
      if (this.elements.modalBtnDownload) {
        this.elements.modalBtnDownload.addEventListener('click', () => {
          if (this.currentPreviewAttachment) this.downloadAttachment(this.currentPreviewAttachment);
        });
      }

      if (this.elements.aboutModalBtnClose) {
        this.elements.aboutModalBtnClose.addEventListener('click', () => this.closeAboutModal());
      }
      if (this.elements.aboutModal) {
        this.elements.aboutModal.addEventListener('click', (e) => {
          if (e.target === this.elements.aboutModal) this.closeAboutModal();
        });
      }

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closePreviewModal();
          this.closeAboutModal();
        }
      });
    }

    openAboutModal() {
      if (this.elements.aboutModal) {
        this.elements.aboutModal.classList.add('active');
      }
    }

    closeAboutModal() {
      if (this.elements.aboutModal) {
        this.elements.aboutModal.classList.remove('active');
      }
    }

    async handleDirectoryPicker() {
      try {
        const dirHandle = await window.showDirectoryPicker();
        const msgFiles = [];
        
        async function getFilesRecursively(handle) {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.msg')) {
              const file = await entry.getFile();
              msgFiles.push(file);
            } else if (entry.kind === 'directory') {
              await getFilesRecursively(entry);
            }
          }
        }

        await getFilesRecursively(dirHandle);

        if (msgFiles.length === 0) {
          alert(this.t('selectMsgAlert'));
          return;
        }

        this.handleFilesSelected(msgFiles);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error opening folder:', err);
        }
      }
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

    async parseMsgWithServer(arrayBuffer) {
      const hostname = window.location.hostname || '';
      const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
      if (!isLocalHost) {
        return null;
      }
      try {
        const response = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: arrayBuffer
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.attachments) {
            data.attachments = data.attachments.map(att => ({
              fileName: att.fileName,
              mimeType: att.mimeType,
              size: att.size,
              extension: att.extension,
              content: base64ToUint8Array(att.base64Content)
            }));
          }
          return data;
        }
      } catch (err) {}
      return null;
    }

    async handleFilesSelected(files) {
      const msgFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.msg'));
      if (msgFiles.length === 0) {
        alert(this.t('selectMsgAlert'));
        return;
      }

      for (const file of msgFiles) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          let parsedData = await this.parseMsgWithServer(arrayBuffer);
          
          if (!parsedData) {
            const parser = new MsgParser(arrayBuffer);
            parsedData = parser.parse();
          }
          
          parsedData.fileName = file.name;
          parsedData.fileSize = file.size;
          
          this.messages.push(parsedData);
        } catch (err) {
          console.error('Error parsing .msg file:', err);
          alert(`${this.t('readErrorAlert')} ${file.name}: ${err.message}`);
        }
      }

      if (this.messages.length > 0) {
        this.renderSidebarList();
        this.selectMessage(this.messages.length - msgFiles.length);
      }
    }

    renderSidebarList() {
      this.elements.fileList.innerHTML = '';
      
      this.messages.forEach((msg, idx) => {
        const hasAttach = msg.attachments && msg.attachments.length > 0;
        const item = document.createElement('div');
        item.className = `file-item ${idx === this.currentMsgIndex ? 'active' : ''}`;

        const senderStr = (msg.senderName && msg.senderEmail && !msg.senderName.includes(msg.senderEmail))
          ? `${msg.senderName} <${msg.senderEmail}>`
          : (msg.senderName || msg.senderEmail || this.t('unknownSender'));

        const dateStr = formatDateString(msg.date) || this.t('noDate');

        item.innerHTML = `
          <div class="file-item-subject" title="${escapeHtml(msg.subject || this.t('noSubject'))}">${escapeHtml(msg.subject || this.t('noSubject'))}</div>
          <div class="file-item-sender" title="${escapeHtml(senderStr)}">${escapeHtml(senderStr)}</div>
          <div class="file-item-date-row">
            <span class="file-item-date">${escapeHtml(dateStr)}</span>
            ${hasAttach ? `<span class="attachment-badge">📎 ${msg.attachments.length}</span>` : ''}
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
      
      Array.from(this.elements.fileList.children).forEach((el, i) => {
        el.classList.toggle('active', i === index);
      });

      this.elements.emptyState.style.display = 'none';
      this.elements.emailDetails.style.display = 'flex';

      this.elements.emailSubject.textContent = msg.subject || this.t('noSubject');
      this.elements.emailSender.textContent = msg.senderEmail ? `${msg.senderName} <${msg.senderEmail}>` : (msg.senderName || this.t('unknownSender'));
      this.elements.emailTo.textContent = msg.displayTo || this.t('noRecipients');
      
      if (msg.displayCc) {
        this.elements.emailCcRow.style.display = 'grid';
        this.elements.emailCc.textContent = msg.displayCc;
      } else {
        this.elements.emailCcRow.style.display = 'none';
      }

      // Render Attachment Cards Grid
      this.elements.attachmentsGrid.innerHTML = '';
      if (msg.attachments && msg.attachments.length > 0) {
        this.elements.attachmentsSection.style.display = 'flex';
        this.elements.attachmentsCount.textContent = msg.attachments.length;

        msg.attachments.forEach(att => {
          const extUpper = (att.extension || 'BIN').toUpperCase();
          const card = document.createElement('div');
          card.className = 'attachment-card';
          card.innerHTML = `
            <div class="attachment-info">
              <div class="attachment-icon">${escapeHtml(extUpper.substring(0, 4))}</div>
              <div class="attachment-details">
                <div class="attachment-name" title="${escapeHtml(att.fileName)}">${escapeHtml(att.fileName)}</div>
                <div class="attachment-size">${this.formatBytes(att.size)}</div>
              </div>
            </div>
            <div class="attachment-actions">
              <button class="btn btn-secondary btn-xs btn-preview">${this.t('btnPreview')}</button>
              <button class="btn btn-primary btn-xs btn-save">${this.t('btnSave')}</button>
            </div>
          `;

          card.querySelector('.btn-preview').addEventListener('click', () => this.previewAttachment(att));
          card.querySelector('.btn-save').addEventListener('click', () => this.downloadAttachment(att));
          
          this.elements.attachmentsGrid.appendChild(card);
        });
      } else {
        this.elements.attachmentsSection.style.display = 'none';
      }

      this.setViewMode(this.viewMode || 'html');
    }

    setViewMode(mode) {
      this.viewMode = mode;
      const msg = this.messages[this.currentMsgIndex];
      if (!msg) return;

      this.elements.tabHtml.classList.toggle('active', mode === 'html');
      this.elements.tabText.classList.toggle('active', mode === 'text');

      if (mode === 'html') {
        this.elements.bodyIframe.style.display = 'block';
        this.elements.bodyPlain.style.display = 'none';
        
        const contentToRender = msg.bodyHtml || (msg.bodyText ? `<html><body><div style="font-family: system-ui, sans-serif; padding: 16px; line-height: 1.6; color: #000000;">${escapeHtml(msg.bodyText).replace(/\n/g, '<br>')}</div></body></html>` : `<p>${this.t('noBodyHtml')}</p>`);
        const cleanHtml = sanitizeHtml(contentToRender);
        const fullDoc = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 16px; color: #000000; line-height: 1.6; background-color: #ffffff; }
              p, div, span, td, th, li, a, h1, h2, h3, h4, h5, h6 { color: #000000; }
              img { max-width: 100%; height: auto; }
              a { color: #1d4ed8; text-decoration: underline; }
              @media print {
                *, body, p, div, span, td, th, li, a, h1, h2, h3, h4, h5, h6 {
                  color: #000000 !important;
                  background: #ffffff !important;
                }
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
      } else {
        this.elements.bodyIframe.style.display = 'none';
        this.elements.bodyPlain.style.display = 'block';
        
        let textToShow = msg.bodyText;
        if (!textToShow && msg.bodyHtml) {
          textToShow = cleanGarbledText(msg.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
        }
        this.elements.bodyPlain.textContent = textToShow || this.t('noBodyText');
      }
    }

    previewAttachment(attachment) {
      this.currentPreviewAttachment = attachment;
      this.elements.modalFileName.textContent = attachment.fileName;
      this.elements.modalBody.innerHTML = '';

      const ext = (attachment.extension || '').toLowerCase();
      const blob = new Blob([attachment.content], { type: attachment.mimeType });
      const url = URL.createObjectURL(blob);

      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext) || attachment.mimeType.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'preview-img';
        img.alt = attachment.fileName;
        this.elements.modalBody.appendChild(img);
      } else if (ext === 'pdf' || attachment.mimeType === 'application/pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.className = 'preview-iframe';
        this.elements.modalBody.appendChild(iframe);
      } else if (['txt', 'log', 'csv', 'json', 'xml', 'html', 'js', 'py', 'css', 'sql', 'md'].includes(ext) || attachment.mimeType.startsWith('text/')) {
        const textDecoder = new TextDecoder('utf-8');
        const textContent = textDecoder.decode(attachment.content);
        const pre = document.createElement('pre');
        pre.className = 'preview-text';
        pre.textContent = textContent;
        this.elements.modalBody.appendChild(pre);
      } else if (['mp3', 'wav', 'ogg'].includes(ext) || attachment.mimeType.startsWith('audio/')) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = url;
        this.elements.modalBody.appendChild(audio);
      } else if (['mp4', 'webm'].includes(ext) || attachment.mimeType.startsWith('video/')) {
        const video = document.createElement('video');
        video.controls = true;
        video.style.maxWidth = '100%';
        video.style.maxHeight = '65vh';
        video.src = url;
        this.elements.modalBody.appendChild(video);
      } else {
        const placeholder = document.createElement('div');
        placeholder.style.textAlign = 'center';
        placeholder.style.padding = '40px';
        placeholder.innerHTML = `
          <div style="font-size: 3rem; margin-bottom: 12px;">📁</div>
          <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-primary);">${escapeHtml(attachment.fileName)}</div>
          <div style="color: var(--text-secondary); margin-top: 4px;">${this.t('previewNotAvailable')}</div>
          <button id="btnModalSaveInline" class="btn btn-primary" style="margin-top: 16px;">${this.t('downloadFile')} (${this.formatBytes(attachment.size)})</button>
        `;
        this.elements.modalBody.appendChild(placeholder);
        placeholder.querySelector('#btnModalSaveInline').addEventListener('click', () => this.downloadAttachment(attachment));
      }

      this.elements.previewModal.classList.add('active');
    }

    closePreviewModal() {
      this.elements.previewModal.classList.remove('active');
      this.elements.modalBody.innerHTML = '';
      this.currentPreviewAttachment = null;
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
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    downloadAllAttachments() {
      const msg = this.messages[this.currentMsgIndex];
      if (!msg || !msg.attachments || msg.attachments.length === 0) return;

      msg.attachments.forEach((att, idx) => {
        setTimeout(() => {
          this.downloadAttachment(att);
        }, idx * 250);
      });
    }

    formatBytes(bytes) {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
  }

  // Initialize App on Load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.app = new MsgViewerApp();
    });
  } else {
    window.app = new MsgViewerApp();
  }
})();
