/**
 * Self-Contained Bundle for MSG Viewer
 * Features: Guaranteed 3-Line Sidebar List Cards (Subject, Sender, Date/Time),
 * Robust Multi-Attribute Date Parser, Folder Selection, Multi-Language Dropdown (ES/EN),
 * High-Contrast Theme, Pure Black Print Engine, Dual Engine (Python REST API + Native JS OLE CFBF parser),
 * LZFu RTF Decompressor, HTML Sanitizer.
 */

(function () {
  const API_BASE = window.location.protocol.startsWith("http")
    ? ""
    : "http://127.0.0.1:8080";

  // 1. i18n Dictionary Map
  const translations = {
    es: {
      appTitle: "MSG Viewer",
      openMsg: "Abrir correo '.msg'",
      openFolder: "Abrir carpeta",
      printPdf: "Imprimir / PDF",
      printPdfTitle: "Imprimir correo o guardar como PDF",
      searchPlaceholder: "Buscar por asunto o remitente...",
      dropTitle: "Selecciona o arrastra un correo .msg o carpeta",
      dropDesc:
        "Haz clic en los botones o arrastra archivos de correo (.msg) o carpetas completas desde tu equipo para abrirlos de forma instantánea.",
      exploreFiles: "Explorar archivos",
      dropOverlayTitle: "Suelta los archivos o carpetas .msg aquí",
      dropOverlayDesc: "Se añadirán a la lista de mensajes de forma inmediata",
      noSubject: "(Sin asunto)",
      unknownSender: "Desconocido",
      noRecipients: "(Sin destinatarios)",
      noDate: "Sin fecha",
      labelFrom: "De:",
      labelTo: "Para:",
      labelCc: "CC:",
      labelPath: "Ruta:",
      tabHtml: "HTML ORIGINAL",
      tabText: "TEXTO PLANO",
      attachmentsTitle: "Archivos adjuntos",
      saveAll: "Guardar todo",
      btnPreview: "👁️ Ver",
      btnSave: "💾 Guardar",
      modalTitle: "Vista previa",
      modalSave: "Guardar archivo",
      modalClose: "Cerrar",
      previewNotAvailable:
        "Vista previa no disponible directamente para este formato.",
      downloadFile: "Descargar archivo",
      noBodyText: "(Este correo no contiene texto en el cuerpo)",
      noBodyHtml: "(Este correo no contiene texto en el cuerpo)",
      selectMsgAlert:
        "No se encontraron archivos con extensión .msg en la selección.",
      readErrorAlert: "No se pudo leer el archivo",
      aboutTitle: "Acerca de MSG Viewer",
      aboutCreator: "Creado por:",
      aboutContact: "Contacto:",
      aboutRepo: "Repositorio (GitHub):",
      aboutDesc:
        "Visor gratuito, offline y seguro de archivos '.msg' para Windows",
      openFolderLocation: "Abrir carpeta",
      openFolderLocationTitle: "Abrir la carpeta que contiene este archivo",
      folderOpened: "Carpeta abierta",
      pathCopied: "Ruta copiada",
      zoomIn: "Aumentar tamaño de fuente",
      zoomOut: "Disminuir tamaño de fuente",
      zoomReset: "Restablecer tamaño de fuente",
      resizeSidebar:
        "Arrastrar para cambiar el tamaño del panel (doble clic para restablecer)",
      clearAll: "Limpiar lista",
      clearAllTitle: "Eliminar todos los correos guardados de la lista",
      clearAllConfirm:
        "¿Deseas eliminar todos los correos guardados de la lista?",
      removeMsg: "Eliminar correo de la lista",
      emailCountSingular: "correo",
      emailsCountPlural: "correos",
      modalConfirm: "Aceptar",
      modalCancel: "Cancelar",
    },
    en: {
      appTitle: "MSG Viewer",
      openMsg: "Open '.msg' email",
      openFolder: "Open folder",
      printPdf: "Print / PDF",
      printPdfTitle: "Print email or save as PDF",
      searchPlaceholder: "Search by subject or sender...",
      dropTitle: "Select or drag a .msg email or folder",
      dropDesc:
        "Click the buttons or drag email files (.msg) or entire folders from your computer to open them instantly.",
      exploreFiles: "Browse files",
      dropOverlayTitle: "Drop .msg files or folders here",
      dropOverlayDesc: "They will be added to the message list immediately",
      noSubject: "(No subject)",
      unknownSender: "Unknown",
      noRecipients: "(No recipients)",
      noDate: "No date",
      labelFrom: "From:",
      labelTo: "To:",
      labelCc: "CC:",
      labelPath: "Path:",
      tabHtml: "ORIGINAL HTML",
      tabText: "PLAIN TEXT",
      attachmentsTitle: "Attachments",
      saveAll: "Save all",
      btnPreview: "👁️ View",
      btnSave: "💾 Save",
      modalTitle: "Preview",
      modalSave: "Save file",
      modalClose: "Close",
      previewNotAvailable: "Direct preview not available for this file format.",
      downloadFile: "Download file",
      noBodyText: "(This email has no body text)",
      noBodyHtml: "(This email has no body text)",
      selectMsgAlert: "No .msg files were found in the selection.",
      readErrorAlert: "Could not read file",
      aboutTitle: "About MSG Viewer",
      aboutCreator: "Created by:",
      aboutContact: "Contact:",
      aboutRepo: "Repository (GitHub):",
      aboutDesc: "Free, offline and secure '.msg' email viewer for Windows",
      openFolderLocation: "Open Folder",
      openFolderLocationTitle: "Open folder containing this file",
      folderOpened: "Folder opened",
      pathCopied: "Path copied",
      zoomIn: "Increase font size",
      zoomOut: "Decrease font size",
      zoomReset: "Reset font size",
      resizeSidebar: "Drag to resize sidebar (double-click to reset)",
      clearAll: "Clear list",
      clearAllTitle: "Remove all saved emails from list",
      clearAllConfirm: "Do you want to remove all saved emails from the list?",
      removeMsg: "Remove email from list",
      emailCountSingular: "email",
      emailsCountPlural: "emails",
      modalConfirm: "OK",
      modalCancel: "Cancel",
    },
  };

  // Helper function to format date/time string nicely
  function formatDateString(dateVal) {
    if (!dateVal) return "";
    try {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, "0");
        const mins = String(d.getMinutes()).padStart(2, "0");
        return `${day}/${month}/${year} ${hours}:${mins}`;
      }
    } catch (e) {}
    return String(dateVal);
  }

  // Clean garbled characters and unicode replacement noise
  function cleanGarbledText(str) {
    if (!str) return "";
    return str
      .replace(/\uFFFD/g, "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .trim();
  }

  // 2. Sanitizer & Escaping Functions
  function sanitizeHtml(rawHtml) {
    if (!rawHtml) return "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    const forbiddenTags = [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "base",
      "meta",
    ];
    forbiddenTags.forEach((tag) => {
      const elements = doc.querySelectorAll(tag);
      elements.forEach((el) => el.remove());
    });

    const allElements = doc.querySelectorAll("*");
    allElements.forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value.toLowerCase();

        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
        }
        if (
          (name === "href" || name === "src") &&
          value.trim().startsWith("javascript:")
        ) {
          el.removeAttribute(attr.name);
        }
      });

      if (el.tagName.toLowerCase() === "a") {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    });

    return doc.body.innerHTML;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

    const dataView = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    const compSize = dataView.getUint32(0, true);
    const rawSize = dataView.getUint32(4, true);
    const compType = dataView.getUint32(8, true);

    const isLZFu =
      (buffer[8] === 0x4c &&
        buffer[9] === 0x5a &&
        buffer[10] === 0x46 &&
        buffer[11] === 0x75) ||
      compType === 0x4145779b;
    const isUncompressed =
      compType === 0x4145779a ||
      (buffer[8] === 0x4d &&
        buffer[9] === 0x49 &&
        buffer[10] === 0x45 &&
        buffer[11] === 0x4e);

    if (isUncompressed) {
      return buffer.subarray(16, Math.min(buffer.length, 16 + rawSize));
    }

    if (!isLZFu) return null;

    const INIT_DICT_STR =
      "{\\rtf1\\ansi\\mac\\deff0\\deftab720{\\fonttbl;}{\\f0\\fnil \\froman \\fswiss \\fmodern \\fscript \\fdecor MS Sans SerifSymbolArialTimes New RomanCourier{\\colortbl\\red0\\green0\\blue0\r\n\\par \\pard\\plain\\f0\\fs20\\b\\i\\u\\tab\\tx";
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
          const offset = (token >> 4) & 0xfff;
          const length = (token & 0xf) + 2;

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
    if (!rtfBytes || rtfBytes.length === 0) return { html: "", text: "" };

    let rtfString = "";
    try {
      rtfString = new TextDecoder("windows-1252").decode(rtfBytes);
    } catch (e) {
      rtfString = new TextDecoder("utf-8").decode(rtfBytes);
    }

    // Step 1: Decode RTF hex escapes (\'xx -> character)
    let clean = rtfString.replace(/\\\'([0-9a-fA-F]{2})/g, (match, hex) => {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code);
    });

    // Step 2: Strip all RTF fallback text blocks (\htmlrtf ... \htmlrtf0) including nested blocks
    let prevClean = "";
    let iterations = 0;
    while (
      clean !== prevClean &&
      clean.includes("\\htmlrtf") &&
      iterations < 10
    ) {
      prevClean = clean;
      clean = clean.replace(/\{?\\htmlrtf[\s\S]*?\\htmlrtf0\}?/gi, "");
      iterations++;
    }

    // Step 3: Unencapsulate RTF htmltag groups {\*\htmltagXX content}
    clean = clean.replace(/\{\\\*\\htmltag\d* ?([\s\S]*?)\}/gi, "$1");
    clean = clean.replace(/\\htmltag\d* ?/gi, "");

    // Step 4: Direct search for HTML document structure (<html...</html> or <!DOCTYPE...</html> or <body...</body>)
    const htmlMatch = clean.match(
      /(<html[\s\S]*?<\/html>|<!DOCTYPE[\s\S]*?<\/html>|<body[\s\S]*?<\/body>)/i,
    );
    if (htmlMatch) {
      let cleanHtml = htmlMatch[0];
      cleanHtml = cleanHtml.replace(/\\([a-zA-Z]+)(-?\d+)? ?/g, "");
      cleanHtml = cleanHtml.replace(/>\s*[\{\}]+\s*</g, "><");
      cleanHtml = cleanHtml.replace(/>[\{\}\s]+/g, "> ");
      cleanHtml = cleanHtml.replace(/[\{\}\s]+</g, " <");
      return { html: cleanHtml, text: "" };
    }

    // Step 5: Partial HTML check (<div...>, <p...>, <table...>)
    if (clean.includes("<") && clean.includes(">")) {
      let partialHtml = clean.replace(/\\([a-zA-Z]+)(-?\d+)? ?/g, "");
      partialHtml = partialHtml.replace(/>\s*[\{\}]+\s*</g, "><");
      const subMatch = partialHtml.match(
        /(<div[\s\S]*?<\/div>|<p[\s\S]*?<\/p>|<table[\s\S]*?<\/table>)/i,
      );
      if (subMatch) {
        return {
          html: subMatch[0],
          text: cleanGarbledText(clean.replace(/<[^>]+>/g, " ")),
        };
      } else {
        return {
          html: partialHtml,
          text: cleanGarbledText(clean.replace(/<[^>]+>/g, " ")),
        };
      }
    }

    // Step 6: Fallback for Plain Text
    let plainText = rtfString
      .replace(/\\par/gi, "\n")
      .replace(/\\line/gi, "\n")
      .replace(/\\tab/gi, "\t")
      .replace(/\\\'([0-9a-fA-F]{2})/g, (match, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      .replace(/\\[a-zA-Z]+(-?\d+)? ?/g, "")
      .replace(/[{}]/g, "");

    plainText = cleanGarbledText(plainText);

    return { html: "", text: plainText };
  }

  function decodeStreamBytes(buffer, isUnicode = true) {
    if (!buffer || buffer.length === 0) return "";

    if (isUnicode) {
      try {
        const text = new TextDecoder("utf-16le")
          .decode(buffer)
          .replace(/\0/g, "");
        if (text && text.trim().length > 0 && !text.includes("\uFFFD"))
          return cleanGarbledText(text);
      } catch (e) {}
    }

    try {
      const text = new TextDecoder("windows-1252")
        .decode(buffer)
        .replace(/\0/g, "");
      if (text && text.trim().length > 0) return cleanGarbledText(text);
    } catch (e) {}

    try {
      const text = new TextDecoder("utf-8").decode(buffer).replace(/\0/g, "");
      if (text && text.trim().length > 0) return cleanGarbledText(text);
    } catch (e) {}

    return "";
  }

  // 5. OLE CFBF MSG Parser Class
  class MsgParser {
    constructor(arrayBuffer) {
      this.buffer = new Uint8Array(arrayBuffer);
      this.dataView = new DataView(arrayBuffer);
      this.isLittleEndian = true;

      const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
      for (let i = 0; i < 8; i++) {
        if (this.buffer[i] !== magic[i]) {
          throw new Error("The selected file is not a valid .msg file.");
        }
      }

      this.sectorShift = this.dataView.getUint16(30, this.isLittleEndian);
      this.sectorSize = 1 << this.sectorShift;
      this.miniSectorShift = this.dataView.getUint16(32, this.isLittleEndian);
      this.miniSectorSize = 1 << this.miniSectorShift;

      this.numFatSectors = this.dataView.getUint32(44, this.isLittleEndian);
      this.firstDirSector = this.dataView.getUint32(48, this.isLittleEndian);
      this.miniCutoffSize = this.dataView.getUint32(56, this.isLittleEndian);
      this.firstMiniFatSector = this.dataView.getUint32(
        60,
        this.isLittleEndian,
      );
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
        if (sec !== 0xfffffffe && sec !== 0xffffffff) {
          difatSectors.push(sec);
        }
      }

      let currDifatSector = this.firstDifatSector;
      while (
        currDifatSector !== 0xfffffffe &&
        currDifatSector !== 0xffffffff &&
        currDifatSector < 0xfffffffd
      ) {
        const offset = this.getSectorOffset(currDifatSector);
        for (let i = 0; i < this.sectorSize / 4 - 1; i++) {
          const sec = this.dataView.getUint32(
            offset + i * 4,
            this.isLittleEndian,
          );
          if (sec !== 0xfffffffe && sec !== 0xffffffff) {
            difatSectors.push(sec);
          }
        }
        currDifatSector = this.dataView.getUint32(
          offset + this.sectorSize - 4,
          this.isLittleEndian,
        );
      }

      for (const fatSector of difatSectors) {
        const offset = this.getSectorOffset(fatSector);
        for (let i = 0; i < this.sectorSize / 4; i++) {
          this.fat.push(
            this.dataView.getUint32(offset + i * 4, this.isLittleEndian),
          );
        }
      }
    }

    initMiniFat() {
      this.miniFat = [];
      let currSector = this.firstMiniFatSector;
      while (
        currSector !== 0xfffffffe &&
        currSector !== 0xffffffff &&
        currSector < 0xfffffffd
      ) {
        const offset = this.getSectorOffset(currSector);
        for (let i = 0; i < this.sectorSize / 4; i++) {
          this.miniFat.push(
            this.dataView.getUint32(offset + i * 4, this.isLittleEndian),
          );
        }
        currSector = this.fat[currSector];
      }
    }

    getStreamData(startSector, streamSize, isMini = false) {
      if (startSector === 0xfffffffe || startSector === 0xffffffff)
        return new Uint8Array(0);

      const result = new Uint8Array(streamSize);
      let bytesRead = 0;
      let currSector = startSector;

      if (isMini) {
        const rootSector = this.entries[0] ? this.entries[0].startSector : 0;
        const rootData = this.getStreamData(
          rootSector,
          this.entries[0] ? this.entries[0].size : 0,
          false,
        );

        while (
          currSector !== 0xfffffffe &&
          currSector !== 0xffffffff &&
          bytesRead < streamSize
        ) {
          const miniOffset = currSector * this.miniSectorSize;
          const count = Math.min(this.miniSectorSize, streamSize - bytesRead);
          result.set(
            rootData.subarray(miniOffset, miniOffset + count),
            bytesRead,
          );
          bytesRead += count;
          currSector = this.miniFat[currSector];
        }
      } else {
        while (
          currSector !== 0xfffffffe &&
          currSector !== 0xffffffff &&
          bytesRead < streamSize
        ) {
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

      while (
        currSector !== 0xfffffffe &&
        currSector !== 0xffffffff &&
        currSector < 0xfffffffd
      ) {
        const offset = this.getSectorOffset(currSector);
        for (let i = 0; i < this.sectorSize / 128; i++) {
          const entryOffset = offset + i * 128;
          const nameLen = this.dataView.getUint16(
            entryOffset + 64,
            this.isLittleEndian,
          );

          if (nameLen > 0) {
            let name = "";
            for (let j = 0; j < Math.min(nameLen - 2, 64); j += 2) {
              const charCode = this.dataView.getUint16(
                entryOffset + j,
                this.isLittleEndian,
              );
              if (charCode > 0) name += String.fromCharCode(charCode);
            }

            const type = this.buffer[entryOffset + 66];
            const startSector = this.dataView.getUint32(
              entryOffset + 116,
              this.isLittleEndian,
            );
            const size = this.dataView.getUint32(
              entryOffset + 120,
              this.isLittleEndian,
            );

            this.entries.push({ name, type, startSector, size, entryOffset });
          }
        }
        currSector = this.fat[currSector];
      }
    }

    parse() {
      const msgData = {
        subject: "",
        senderName: "",
        senderEmail: "",
        displayTo: "",
        displayCc: "",
        displayBcc: "",
        date: null,
        bodyText: "",
        bodyHtml: "",
        attachments: [],
      };

      const rootEntries = this.entries;
      let rawBodyText = null;
      let rawBodyHtml = null;
      let rawBodyRtf = null;
      let htmlIsUnicode = true;

      for (const entry of rootEntries) {
        if (!entry.name) continue;
        const isMini = entry.size < this.miniCutoffSize;

        if (entry.name.startsWith("__substg1.0_")) {
          const tagHex = entry.name.substring(12, 16).toUpperCase();
          const typeHex = entry.name.substring(16, 20).toUpperCase();
          const rawData = this.getStreamData(
            entry.startSector,
            entry.size,
            isMini,
          );

          if (tagHex === "0037") {
            msgData.subject = decodeStreamBytes(rawData, typeHex === "001F");
          } else if (tagHex === "0C1A") {
            msgData.senderName = decodeStreamBytes(rawData, typeHex === "001F");
          } else if (tagHex === "0C1F" || tagHex === "39FE") {
            const email = decodeStreamBytes(rawData, typeHex === "001F");
            if (email && email.includes("@")) msgData.senderEmail = email;
          } else if (tagHex === "0E04") {
            msgData.displayTo = decodeStreamBytes(rawData, typeHex === "001F");
          } else if (tagHex === "0E03") {
            msgData.displayCc = decodeStreamBytes(rawData, typeHex === "001F");
          } else if (tagHex === "0E02") {
            msgData.displayBcc = decodeStreamBytes(rawData, typeHex === "001F");
          } else if (
            tagHex === "0E06" ||
            tagHex === "0039" ||
            tagHex === "003B"
          ) {
            if (rawData.length >= 8 && !msgData.date) {
              const dv = new DataView(
                rawData.buffer,
                rawData.byteOffset,
                rawData.byteLength,
              );
              const low = dv.getUint32(0, true);
              const high = dv.getUint32(4, true);
              const filetimeBig = (BigInt(high) << 32n) | BigInt(low);
              if (filetimeBig > 0n) {
                const unixMs = Number(
                  (filetimeBig - 116444736000000000n) / 10000n,
                );
                if (unixMs > 0) {
                  msgData.date = new Date(unixMs).toISOString();
                }
              }
            }
          } else if (tagHex === "1000") {
            rawBodyText = { data: rawData, isUnicode: typeHex === "001F" };
          } else if (tagHex === "1013") {
            rawBodyHtml = rawData;
            htmlIsUnicode = typeHex === "001F";
          } else if (tagHex === "1009") {
            rawBodyRtf = rawData;
          }
        }
      }

      if (rawBodyHtml && rawBodyHtml.length > 0) {
        const decoded = decodeStreamBytes(rawBodyHtml, htmlIsUnicode);
        if (decoded && (decoded.includes("<") || decoded.includes(">"))) {
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
          if (extracted.text && !msgData.bodyText)
            msgData.bodyText = extracted.text;
        }
      }

      if (!msgData.bodyText && rawBodyText) {
        msgData.bodyText = decodeStreamBytes(
          rawBodyText.data,
          rawBodyText.isUnicode,
        );
      }

      if (msgData.bodyHtml && !msgData.bodyText) {
        msgData.bodyText = cleanGarbledText(
          msgData.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
        );
      } else if (msgData.bodyText && !msgData.bodyHtml) {
        const formatted = escapeHtml(msgData.bodyText)
          .replace(/\r\n/g, "<br>")
          .replace(/\n/g, "<br>");
        msgData.bodyHtml = `<html><body><div style="font-family: system-ui, -apple-system, sans-serif; font-size: 0.95rem; line-height: 1.6; color: #000000; white-space: pre-wrap;">${formatted}</div></body></html>`;
      }

      const attachmentStreams = new Map();
      for (const entry of rootEntries) {
        if (entry.name.includes("__attach_version1.0_")) {
          const parts = entry.name.split("_");
          const attachName = parts.slice(0, 4).join("_");

          if (!attachmentStreams.has(attachName)) {
            attachmentStreams.set(attachName, []);
          }
          attachmentStreams.get(attachName).push(entry);
        }
      }

      for (const [attachName, streams] of attachmentStreams.entries()) {
        let fileName = "Attachment";
        let mimeType = "application/octet-stream";
        let content = null;

        for (const stream of streams) {
          const isMini = stream.size < this.miniCutoffSize;
          const rawData = this.getStreamData(
            stream.startSector,
            stream.size,
            isMini,
          );
          const nameUpper = stream.name.toUpperCase();

          if (nameUpper.includes("3707") || nameUpper.includes("3704")) {
            fileName = decodeStreamBytes(rawData, nameUpper.endsWith("001F"));
          } else if (nameUpper.includes("370E")) {
            mimeType = decodeStreamBytes(rawData, nameUpper.endsWith("001F"));
          } else if (nameUpper.includes("3701")) {
            content = rawData;
          }
        }

        if (content && content.length > 0) {
          const cleanFileName =
            fileName.replace(/\0/g, "").trim() || "attachment.bin";
          const ext = cleanFileName.includes(".")
            ? cleanFileName.split(".").pop().toLowerCase()
            : "";

          if (!mimeType || mimeType === "application/octet-stream") {
            if (
              ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)
            )
              mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
            else if (ext === "pdf") mimeType = "application/pdf";
            else if (
              ["txt", "log", "csv", "json", "xml", "html", "js", "py"].includes(
                ext,
              )
            )
              mimeType = "text/plain";
          }

          msgData.attachments.push({
            fileName: cleanFileName,
            mimeType: mimeType.replace(/\0/g, "").trim(),
            content: content,
            size: content.length,
            extension: ext,
          });
        }
      }

      if (!msgData.senderEmail && msgData.senderName) {
        msgData.senderEmail = msgData.senderName;
      }

      return msgData;
    }
  }

  // 5. IndexedDB Storage Manager for Persistent Opened Messages
  class MsgStorage {
    constructor(dbName = "MsgViewerDB", storeName = "messages") {
      this.dbName = dbName;
      this.storeName = storeName;
      this.db = null;
      this.isSupported = typeof indexedDB !== "undefined";
    }

    async init() {
      if (!this.isSupported) return false;
      return new Promise((resolve) => {
        try {
          const request = indexedDB.open(this.dbName, 1);
          request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName, { keyPath: "id" });
            }
          };
          request.onsuccess = (e) => {
            this.db = e.target.result;
            resolve(true);
          };
          request.onerror = (err) => {
            console.warn("IndexedDB open error:", err);
            resolve(false);
          };
        } catch (e) {
          console.warn("IndexedDB initialization exception:", e);
          resolve(false);
        }
      });
    }

    async getAll() {
      if (!this.db) return [];
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction(this.storeName, "readonly");
          const store = tx.objectStore(this.storeName);
          const request = store.getAll();
          request.onsuccess = () => {
            const list = request.result || [];
            list.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
            resolve(list);
          };
          request.onerror = () => resolve([]);
        } catch (e) {
          console.warn("IndexedDB getAll failed:", e);
          resolve([]);
        }
      });
    }

    async saveMessage(msg) {
      if (!this.db || !msg) return false;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction(this.storeName, "readwrite");
          const store = tx.objectStore(this.storeName);
          store.put(msg);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          console.warn("IndexedDB saveMessage failed:", e);
          resolve(false);
        }
      });
    }

    async saveMessages(msgs) {
      if (!this.db || !msgs || msgs.length === 0) return false;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction(this.storeName, "readwrite");
          const store = tx.objectStore(this.storeName);
          msgs.forEach((m) => store.put(m));
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          console.warn("IndexedDB saveMessages failed:", e);
          resolve(false);
        }
      });
    }

    async deleteMessage(id) {
      if (!this.db || !id) return false;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction(this.storeName, "readwrite");
          const store = tx.objectStore(this.storeName);
          store.delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          console.warn("IndexedDB deleteMessage failed:", e);
          resolve(false);
        }
      });
    }

    async clearAll() {
      if (!this.db) return false;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction(this.storeName, "readwrite");
          const store = tx.objectStore(this.storeName);
          store.clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          console.warn("IndexedDB clearAll failed:", e);
          resolve(false);
        }
      });
    }
  }

  // 6. Main Application Controller Class
  class MsgViewerApp {
    constructor() {
      this.messages = [];
      this.currentMsgIndex = -1;
      this.currentPreviewAttachment = null;
      this.viewMode = "html";

      // i18n language state
      const defaultLang = "en";
      this.currentLang = localStorage.getItem("msg_viewer_lang") || defaultLang;

      // Font zoom level (60% to 250%, default 100%)
      this.fontZoom = parseInt(
        localStorage.getItem("msg_viewer_font_zoom") || "100",
        10,
      );
      if (isNaN(this.fontZoom) || this.fontZoom < 60 || this.fontZoom > 250) {
        this.fontZoom = 100;
      }

      this.storage = new MsgStorage();

      this.initDOMElements();
      this.initEventListeners();
      this.initSidebarResizer();
      this.initTheme();
      this.applyLanguage(this.currentLang);
      this.applyFontZoom();

      this.initData();
    }

    async initData() {
      try {
        await this.storage.init();
        const savedMessages = await this.storage.getAll();
        if (savedMessages && savedMessages.length > 0) {
          this.messages = savedMessages;
          this.renderSidebarList();
          const savedActiveId = localStorage.getItem("msg_viewer_active_id");
          let activeIndex = -1;
          if (savedActiveId) {
            activeIndex = this.messages.findIndex(
              (m) => m.id === savedActiveId,
            );
          }
          if (activeIndex < 0) activeIndex = this.messages.length - 1;
          this.selectMessage(activeIndex);
        }
      } catch (err) {
        console.warn("Could not load saved messages from storage:", err);
      }

      this.checkUrlParams();
    }

    t(key) {
      const dict = translations[this.currentLang] || translations.en;
      return dict[key] || key;
    }

    applyLanguage(lang) {
      if (!translations[lang]) lang = "en";
      this.currentLang = lang;
      localStorage.setItem("msg_viewer_lang", lang);
      document.documentElement.lang = lang;
      document.title = "MSG Viewer";

      // Update lang select dropdown value
      if (this.elements.langSelect) {
        this.elements.langSelect.value = lang;
      }

      // Update data-i18n text content
      const i18nElements = document.querySelectorAll("[data-i18n]");
      i18nElements.forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (key && translations[lang][key]) {
          el.textContent = translations[lang][key];
        }
      });

      // Update data-i18n-placeholder
      const i18nPlaceholders = document.querySelectorAll(
        "[data-i18n-placeholder]",
      );
      i18nPlaceholders.forEach((el) => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (key && translations[lang][key]) {
          el.placeholder = translations[lang][key];
        }
      });

      // Update data-i18n-title
      const i18nTitles = document.querySelectorAll("[data-i18n-title]");
      i18nTitles.forEach((el) => {
        const key = el.getAttribute("data-i18n-title");
        if (key && translations[lang][key]) {
          el.title = translations[lang][key];
        }
      });

      this.updateMessagesCountBadge();

      // Re-render message detail & list if currently viewing an email
      if (this.currentMsgIndex >= 0) {
        this.selectMessage(this.currentMsgIndex);
      }
    }

    initDOMElements() {
      this.elements = {
        app: document.getElementById("app"),
        dropZoneCard: document.getElementById("dropZoneCard"),
        btnExplore: document.getElementById("btnExplore"),
        btnExploreFolder: document.getElementById("btnExploreFolder"),
        fileInput: document.getElementById("fileInput"),
        folderInput: document.getElementById("folderInput"),
        dragOverlay: document.getElementById("dragOverlay"),
        sidebar: document.getElementById("sidebar"),
        sidebarResizer: document.getElementById("sidebarResizer"),
        sidebarMetaRow: document.getElementById("sidebarMetaRow"),
        messagesCountBadge: document.getElementById("messagesCountBadge"),
        btnClearAll: document.getElementById("btnClearAll"),
        fileList: document.getElementById("fileList"),
        searchInput: document.getElementById("searchInput"),
        emptyState: document.getElementById("emptyState"),
        emailDetails: document.getElementById("emailDetails"),

        emailSubject: document.getElementById("emailSubject"),
        emailSender: document.getElementById("emailSender"),
        emailTo: document.getElementById("emailTo"),
        emailCcRow: document.getElementById("emailCcRow"),
        emailCc: document.getElementById("emailCc"),
        emailPath: document.getElementById("emailPath"),
        btnOpenPathFolder: document.getElementById("btnOpenPathFolder"),

        tabHtml: document.getElementById("tabHtml"),
        tabText: document.getElementById("tabText"),
        btnFontDecrease: document.getElementById("btnFontDecrease"),
        btnFontIncrease: document.getElementById("btnFontIncrease"),
        btnFontReset: document.getElementById("btnFontReset"),
        fontZoomLevel: document.getElementById("fontZoomLevel"),

        attachmentsSection: document.getElementById("attachmentsSection"),
        attachmentsCount: document.getElementById("attachmentsCount"),
        attachmentsGrid: document.getElementById("attachmentsGrid"),
        btnDownloadAll: document.getElementById("btnDownloadAll"),

        bodyIframe: document.getElementById("bodyIframe"),
        bodyPlain: document.getElementById("bodyPlain"),

        btnOpen: document.getElementById("btnOpen"),
        btnOpenFolder: document.getElementById("btnOpenFolder"),
        btnPrint: document.getElementById("btnPrint"),
        btnThemeToggle: document.getElementById("btnThemeToggle"),
        btnAbout: document.getElementById("btnAbout"),
        iconTheme: document.getElementById("iconTheme"),
        langSelect: document.getElementById("langSelect"),

        previewModal: document.getElementById("previewModal"),
        modalFileName: document.getElementById("modalFileName"),
        modalBody: document.getElementById("modalBody"),
        modalBtnDownload: document.getElementById("modalBtnDownload"),
        modalBtnClose: document.getElementById("modalBtnClose"),

        aboutModal: document.getElementById("aboutModal"),
        aboutModalBtnClose: document.getElementById("aboutModalBtnClose"),

        confirmModal: document.getElementById("confirmModal"),
        confirmModalTitle: document.getElementById("confirmModalTitle"),
        confirmModalMessage: document.getElementById("confirmModalMessage"),
        confirmModalBtnConfirm: document.getElementById(
          "confirmModalBtnConfirm",
        ),
        confirmModalBtnCancel: document.getElementById("confirmModalBtnCancel"),
        confirmModalBtnClose: document.getElementById("confirmModalBtnClose"),
      };
    }

    initEventListeners() {
      const openFilePicker = async (e) => {
        if (e) e.stopPropagation();
        try {
          const response = await fetch(`${API_BASE}/api/pick-files`, {
            method: "POST",
          });
          if (response.ok) {
            const data = await response.json();
            if (!data.cancelled && data.messages && data.messages.length > 0) {
              await this.addMessages(data.messages);
              return;
            } else if (data.cancelled) {
              return;
            }
          }
        } catch (err) {
          console.warn(
            "Backend picker unavailable, using file input fallback:",
            err,
          );
        }
        if (this.elements.fileInput) {
          this.elements.fileInput.click();
        }
      };

      const openFolderPicker = async (e) => {
        if (e) e.stopPropagation();
        try {
          const response = await fetch(`${API_BASE}/api/pick-folder`, {
            method: "POST",
          });
          if (response.ok) {
            const data = await response.json();
            if (!data.cancelled && data.messages && data.messages.length > 0) {
              await this.addMessages(data.messages);
              return;
            } else if (data.cancelled) {
              return;
            }
          }
        } catch (err) {
          console.warn(
            "Backend folder picker unavailable, using browser picker fallback:",
            err,
          );
        }

        if (
          "showDirectoryPicker" in window &&
          window.location.protocol.startsWith("http")
        ) {
          this.handleDirectoryPicker();
        } else if (this.elements.folderInput) {
          this.elements.folderInput.click();
        }
      };

      if (this.elements.fileInput) {
        this.elements.fileInput.addEventListener("change", (e) =>
          this.handleFilesSelected(e.target.files),
        );
      }
      if (this.elements.folderInput) {
        this.elements.folderInput.addEventListener("change", (e) =>
          this.handleFilesSelected(e.target.files),
        );
      }

      if (this.elements.btnOpen) {
        this.elements.btnOpen.addEventListener("click", openFilePicker);
      }
      if (this.elements.btnOpenFolder) {
        this.elements.btnOpenFolder.addEventListener("click", openFolderPicker);
      }
      if (this.elements.btnExplore) {
        this.elements.btnExplore.addEventListener("click", openFilePicker);
      }
      if (this.elements.btnExploreFolder) {
        this.elements.btnExploreFolder.addEventListener(
          "click",
          openFolderPicker,
        );
      }
      if (this.elements.dropZoneCard) {
        this.elements.dropZoneCard.addEventListener("click", openFilePicker);
      }

      if (this.elements.btnClearAll) {
        this.elements.btnClearAll.addEventListener("click", () =>
          this.clearAllMessages(),
        );
      }

      window.addEventListener("dragover", (e) => {
        e.preventDefault();
        this.elements.dragOverlay.classList.add("active");
      });

      this.elements.dragOverlay.addEventListener("dragleave", (e) => {
        e.preventDefault();
        this.elements.dragOverlay.classList.remove("active");
      });

      window.addEventListener("drop", (e) => {
        e.preventDefault();
        this.elements.dragOverlay.classList.remove("active");
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleFilesSelected(e.dataTransfer.files);
        }
      });

      if (this.elements.searchInput) {
        this.elements.searchInput.addEventListener("input", (e) =>
          this.filterFileList(e.target.value),
        );
      }

      if (this.elements.tabHtml) {
        this.elements.tabHtml.addEventListener("click", () =>
          this.setViewMode("html"),
        );
      }
      if (this.elements.tabText) {
        this.elements.tabText.addEventListener("click", () =>
          this.setViewMode("text"),
        );
      }

      if (this.elements.btnFontDecrease) {
        this.elements.btnFontDecrease.addEventListener("click", () =>
          this.changeFontZoom(-10),
        );
      }
      if (this.elements.btnFontIncrease) {
        this.elements.btnFontIncrease.addEventListener("click", () =>
          this.changeFontZoom(10),
        );
      }
      if (this.elements.btnFontReset) {
        this.elements.btnFontReset.addEventListener("click", () =>
          this.resetFontZoom(),
        );
      }

      if (this.elements.btnThemeToggle) {
        this.elements.btnThemeToggle.addEventListener("click", () =>
          this.toggleTheme(),
        );
      }
      if (this.elements.btnAbout) {
        this.elements.btnAbout.addEventListener("click", () =>
          this.openAboutModal(),
        );
      }
      if (this.elements.langSelect) {
        this.elements.langSelect.addEventListener("change", (e) =>
          this.applyLanguage(e.target.value),
        );
      }

      if (this.elements.btnPrint) {
        this.elements.btnPrint.addEventListener("click", () => {
          if (
            this.viewMode === "html" &&
            this.elements.bodyIframe.style.display !== "none"
          ) {
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
        this.elements.btnDownloadAll.addEventListener("click", () =>
          this.downloadAllAttachments(),
        );
      }

      if (this.elements.modalBtnClose) {
        this.elements.modalBtnClose.addEventListener("click", () =>
          this.closePreviewModal(),
        );
      }
      if (this.elements.previewModal) {
        this.elements.previewModal.addEventListener("click", (e) => {
          if (e.target === this.elements.previewModal) this.closePreviewModal();
        });
      }
      if (this.elements.modalBtnDownload) {
        this.elements.modalBtnDownload.addEventListener("click", () => {
          if (this.currentPreviewAttachment)
            this.downloadAttachment(this.currentPreviewAttachment);
        });
      }

      if (this.elements.aboutModalBtnClose) {
        this.elements.aboutModalBtnClose.addEventListener("click", () =>
          this.closeAboutModal(),
        );
      }
      if (this.elements.aboutModal) {
        this.elements.aboutModal.addEventListener("click", (e) => {
          if (e.target === this.elements.aboutModal) this.closeAboutModal();
        });
      }

      if (this.elements.btnOpenPathFolder) {
        this.elements.btnOpenPathFolder.addEventListener("click", () =>
          this.openFileLocation(),
        );
      }

      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          this.closePreviewModal();
          this.closeAboutModal();
        }
      });
    }

    openAboutModal() {
      if (this.elements.aboutModal) {
        this.elements.aboutModal.classList.add("active");
      }
    }

    closeAboutModal() {
      if (this.elements.aboutModal) {
        this.elements.aboutModal.classList.remove("active");
      }
    }

    async handleDirectoryPicker() {
      try {
        const dirHandle = await window.showDirectoryPicker();
        const msgFiles = [];

        async function getFilesRecursively(handle) {
          for await (const entry of handle.values()) {
            if (
              entry.kind === "file" &&
              entry.name.toLowerCase().endsWith(".msg")
            ) {
              const file = await entry.getFile();
              msgFiles.push(file);
            } else if (entry.kind === "directory") {
              await getFilesRecursively(entry);
            }
          }
        }

        await getFilesRecursively(dirHandle);

        if (msgFiles.length === 0) {
          await this.showAlertModal({ message: this.t("selectMsgAlert") });
          return;
        }

        this.handleFilesSelected(msgFiles);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error opening folder:", err);
        }
      }
    }

    initSidebarResizer() {
      const sidebar =
        this.elements.sidebar ||
        document.getElementById("sidebar") ||
        document.querySelector(".sidebar");
      const resizer =
        this.elements.sidebarResizer ||
        document.getElementById("sidebarResizer");
      if (!sidebar || !resizer) return;

      const MIN_WIDTH = 220;
      const DEFAULT_WIDTH = 340;

      const getMaxWidth = () => {
        const mainContentWidth =
          document.querySelector(".main-content")?.clientWidth ||
          window.innerWidth;
        return Math.max(MIN_WIDTH, mainContentWidth - 320);
      };

      // Restore saved width from localStorage
      const savedWidth = parseInt(
        localStorage.getItem("msg_viewer_sidebar_width"),
        10,
      );
      if (!isNaN(savedWidth) && savedWidth >= MIN_WIDTH) {
        const maxWidth = getMaxWidth();
        const initialWidth = Math.min(
          Math.max(savedWidth, MIN_WIDTH),
          maxWidth,
        );
        sidebar.style.width = `${initialWidth}px`;
        resizer.setAttribute("aria-valuenow", initialWidth);
      }

      let isDragging = false;
      let startX = 0;
      let startWidth = 0;

      const onPointerDown = (e) => {
        if (e.button !== 0) return; // Only primary mouse button
        isDragging = true;
        startX = e.clientX;
        startWidth = sidebar.getBoundingClientRect().width;

        document.body.classList.add("is-resizing");
        resizer.classList.add("active");

        if (resizer.setPointerCapture && e.pointerId !== undefined) {
          try {
            resizer.setPointerCapture(e.pointerId);
          } catch (_) {}
        }

        window.addEventListener("pointermove", onPointerMove, {
          passive: false,
        });
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const deltaX = e.clientX - startX;
        const targetWidth = startWidth + deltaX;
        const maxWidth = getMaxWidth();
        const clampedWidth = Math.min(
          Math.max(targetWidth, MIN_WIDTH),
          maxWidth,
        );

        sidebar.style.width = `${clampedWidth}px`;
        resizer.setAttribute("aria-valuenow", Math.round(clampedWidth));
      };

      const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;

        document.body.classList.remove("is-resizing");
        resizer.classList.remove("active");

        if (resizer.releasePointerCapture && e.pointerId !== undefined) {
          try {
            resizer.releasePointerCapture(e.pointerId);
          } catch (_) {}
        }

        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);

        const currentWidth = Math.round(sidebar.getBoundingClientRect().width);
        localStorage.setItem(
          "msg_viewer_sidebar_width",
          currentWidth.toString(),
        );
      };

      resizer.addEventListener("pointerdown", onPointerDown);

      // Double-click to reset to default width
      resizer.addEventListener("dblclick", () => {
        sidebar.style.width = `${DEFAULT_WIDTH}px`;
        resizer.setAttribute("aria-valuenow", DEFAULT_WIDTH);
        localStorage.setItem(
          "msg_viewer_sidebar_width",
          DEFAULT_WIDTH.toString(),
        );
      });

      // Keyboard accessibility (ArrowLeft, ArrowRight, Home, End, Enter)
      resizer.addEventListener("keydown", (e) => {
        const step = e.shiftKey ? 50 : 20;
        const currentWidth = sidebar.getBoundingClientRect().width;
        let newWidth = currentWidth;

        if (e.key === "ArrowLeft") {
          newWidth = Math.max(MIN_WIDTH, currentWidth - step);
          e.preventDefault();
        } else if (e.key === "ArrowRight") {
          newWidth = Math.min(getMaxWidth(), currentWidth + step);
          e.preventDefault();
        } else if (e.key === "Home") {
          newWidth = MIN_WIDTH;
          e.preventDefault();
        } else if (e.key === "End") {
          newWidth = getMaxWidth();
          e.preventDefault();
        } else if (e.key === "Enter" || e.key === " ") {
          newWidth = DEFAULT_WIDTH;
          e.preventDefault();
        } else {
          return;
        }

        const rounded = Math.round(newWidth);
        sidebar.style.width = `${rounded}px`;
        resizer.setAttribute("aria-valuenow", rounded);
        localStorage.setItem("msg_viewer_sidebar_width", rounded.toString());
      });

      // Window resize adaptation
      window.addEventListener("resize", () => {
        const currentWidth = sidebar.getBoundingClientRect().width;
        const maxWidth = getMaxWidth();
        if (currentWidth > maxWidth) {
          sidebar.style.width = `${maxWidth}px`;
          resizer.setAttribute("aria-valuenow", Math.round(maxWidth));
          localStorage.setItem(
            "msg_viewer_sidebar_width",
            Math.round(maxWidth).toString(),
          );
        }
      });
    }

    initTheme() {
      const savedTheme =
        localStorage.getItem("msg_viewer_theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light");
      this.setTheme(savedTheme);
    }

    setTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("msg_viewer_theme", theme);

      if (this.elements.iconTheme) {
        if (theme === "dark") {
          this.elements.iconTheme.setAttribute(
            "d",
            "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
          );
        } else {
          this.elements.iconTheme.setAttribute(
            "d",
            "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z",
          );
        }
      }
    }

    toggleTheme() {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      this.setTheme(currentTheme === "dark" ? "light" : "dark");
    }

    async parseMsgWithServer(arrayBuffer, file) {
      try {
        const headers = { "Content-Type": "application/octet-stream" };
        if (file) {
          headers["X-File-Name"] = encodeURIComponent(file.name || "");
          headers["X-File-Size"] = String(file.size || 0);
        }
        const response = await fetch(`${API_BASE}/api/parse`, {
          method: "POST",
          headers: headers,
          body: arrayBuffer,
        });

        if (response.ok) {
          const data = await response.json();

          if (data.attachments) {
            data.attachments = data.attachments.map((att) => ({
              fileName: att.fileName,
              mimeType: att.mimeType,
              size: att.size,
              extension: att.extension,
              content: base64ToUint8Array(att.base64Content),
            }));
          }
          return data;
        }
      } catch (err) {}
      return null;
    }

    findExistingMessageIndex(msg) {
      if (!msg) return -1;
      return this.messages.findIndex((m) => {
        if (msg.id && m.id && msg.id === m.id) return true;
        if (msg.filePath && m.filePath && msg.filePath === m.filePath)
          return true;
        const sameName =
          (m.fileName || "").toLowerCase() ===
          (msg.fileName || "").toLowerCase();
        const sameSize =
          m.fileSize && msg.fileSize ? m.fileSize === msg.fileSize : true;
        const sameSubject = (m.subject || "") === (msg.subject || "");
        const sameDate = (m.date || "") === (msg.date || "");
        return sameName && sameSize && sameSubject && sameDate;
      });
    }

    async addMessages(newMsgs, targetSelectIndex = -1) {
      if (!newMsgs || newMsgs.length === 0) return;

      let firstIndex = -1;
      const toSave = [];

      for (let i = 0; i < newMsgs.length; i++) {
        const rawMsg = newMsgs[i];
        if (rawMsg.attachments) {
          rawMsg.attachments = rawMsg.attachments.map((att) => {
            if (att.base64Content && !att.content) {
              return {
                fileName: att.fileName,
                mimeType: att.mimeType,
                size: att.size,
                extension: att.extension,
                content: base64ToUint8Array(att.base64Content),
              };
            }
            return att;
          });
        }

        const existingIdx = this.findExistingMessageIndex(rawMsg);
        if (existingIdx >= 0) {
          rawMsg.id = this.messages[existingIdx].id;
          rawMsg.savedAt = Date.now();
          this.messages[existingIdx] = rawMsg;
          toSave.push(rawMsg);
          if (firstIndex === -1) firstIndex = existingIdx;
        } else {
          rawMsg.id =
            rawMsg.id ||
            "msg_" +
              Date.now() +
              "_" +
              Math.random().toString(36).substring(2, 9);
          rawMsg.savedAt = Date.now();
          this.messages.push(rawMsg);
          toSave.push(rawMsg);
          if (firstIndex === -1) firstIndex = this.messages.length - 1;
        }
      }

      await this.storage.saveMessages(toSave);
      this.renderSidebarList();

      const selectIdx = targetSelectIndex >= 0 ? targetSelectIndex : firstIndex;
      if (selectIdx >= 0 && selectIdx < this.messages.length) {
        this.selectMessage(selectIdx);
      }
    }

    async removeMessage(index) {
      if (index < 0 || index >= this.messages.length) return;
      const [removed] = this.messages.splice(index, 1);
      if (removed && removed.id) {
        await this.storage.deleteMessage(removed.id);
      }

      if (this.messages.length === 0) {
        this.currentMsgIndex = -1;
        localStorage.removeItem("msg_viewer_active_id");
        this.elements.emptyState.style.display = "flex";
        this.elements.emailDetails.style.display = "none";
      } else {
        const nextIndex = Math.min(index, this.messages.length - 1);
        this.selectMessage(nextIndex);
      }
      this.renderSidebarList();
    }

    showConfirmModal({
      title = "MSG Viewer",
      message = "",
      confirmText = this.t("modalConfirm"),
      cancelText = this.t("modalCancel"),
      isDanger = false,
    } = {}) {
      return new Promise((resolve) => {
        if (!this.elements.confirmModal) {
          resolve(confirm(message));
          return;
        }

        this.elements.confirmModalTitle.textContent = title;
        this.elements.confirmModalMessage.textContent = message;
        this.elements.confirmModalBtnConfirm.textContent = confirmText;
        this.elements.confirmModalBtnCancel.textContent = cancelText;
        this.elements.confirmModalBtnCancel.style.display = "inline-flex";

        if (isDanger) {
          this.elements.confirmModalBtnConfirm.className = "btn btn-danger";
        } else {
          this.elements.confirmModalBtnConfirm.className = "btn btn-primary";
        }

        const cleanup = (result) => {
          this.elements.confirmModal.classList.remove("active");
          this.elements.confirmModalBtnConfirm.removeEventListener(
            "click",
            onConfirm,
          );
          this.elements.confirmModalBtnCancel.removeEventListener(
            "click",
            onCancel,
          );
          this.elements.confirmModalBtnClose.removeEventListener(
            "click",
            onCancel,
          );
          this.elements.confirmModal.removeEventListener("click", onOverlay);
          window.removeEventListener("keydown", onKey);
          resolve(result);
        };

        const onConfirm = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onOverlay = (e) => {
          if (e.target === this.elements.confirmModal) cleanup(false);
        };
        const onKey = (e) => {
          if (e.key === "Escape") cleanup(false);
          else if (e.key === "Enter") cleanup(true);
        };

        this.elements.confirmModalBtnConfirm.addEventListener(
          "click",
          onConfirm,
        );
        this.elements.confirmModalBtnCancel.addEventListener("click", onCancel);
        this.elements.confirmModalBtnClose.addEventListener("click", onCancel);
        this.elements.confirmModal.addEventListener("click", onOverlay);
        window.addEventListener("keydown", onKey);

        this.elements.confirmModal.classList.add("active");
        this.elements.confirmModalBtnConfirm.focus();
      });
    }

    showAlertModal({
      title = "MSG Viewer",
      message = "",
      okText = this.t("modalConfirm"),
    } = {}) {
      return new Promise((resolve) => {
        if (!this.elements.confirmModal) {
          alert(message);
          resolve();
          return;
        }

        this.elements.confirmModalTitle.textContent = title;
        this.elements.confirmModalMessage.textContent = message;
        this.elements.confirmModalBtnConfirm.textContent = okText;
        this.elements.confirmModalBtnConfirm.className = "btn btn-primary";
        this.elements.confirmModalBtnCancel.style.display = "none";

        const cleanup = () => {
          this.elements.confirmModal.classList.remove("active");
          this.elements.confirmModalBtnConfirm.removeEventListener(
            "click",
            onOk,
          );
          this.elements.confirmModalBtnClose.removeEventListener("click", onOk);
          this.elements.confirmModal.removeEventListener("click", onOverlay);
          window.removeEventListener("keydown", onKey);
          resolve();
        };

        const onOk = () => cleanup();
        const onOverlay = (e) => {
          if (e.target === this.elements.confirmModal) cleanup();
        };
        const onKey = (e) => {
          if (e.key === "Escape" || e.key === "Enter") cleanup();
        };

        this.elements.confirmModalBtnConfirm.addEventListener("click", onOk);
        this.elements.confirmModalBtnClose.addEventListener("click", onOk);
        this.elements.confirmModal.addEventListener("click", onOverlay);
        window.addEventListener("keydown", onKey);

        this.elements.confirmModal.classList.add("active");
        this.elements.confirmModalBtnConfirm.focus();
      });
    }

    async clearAllMessages() {
      if (this.messages.length === 0) return;
      const confirmed = await this.showConfirmModal({
        title: "MSG Viewer",
        message: this.t("clearAllConfirm"),
        confirmText: this.t("modalConfirm"),
        cancelText: this.t("modalCancel"),
        isDanger: true,
      });

      if (confirmed) {
        this.messages = [];
        this.currentMsgIndex = -1;
        localStorage.removeItem("msg_viewer_active_id");
        await this.storage.clearAll();
        this.renderSidebarList();
        this.elements.emptyState.style.display = "flex";
        this.elements.emailDetails.style.display = "none";
      }
    }

    updateMessagesCountBadge() {
      const count = this.messages.length;
      if (this.elements.sidebarMetaRow) {
        this.elements.sidebarMetaRow.style.display =
          count > 0 ? "flex" : "none";
      }
      if (this.elements.messagesCountBadge) {
        const label =
          count === 1
            ? this.t("emailCountSingular")
            : this.t("emailsCountPlural");
        this.elements.messagesCountBadge.textContent = `${count} ${label}`;
      }
    }

    async handleFilesSelected(files) {
      const msgFiles = Array.from(files).filter((f) =>
        f.name.toLowerCase().endsWith(".msg"),
      );
      if (msgFiles.length === 0) {
        await this.showAlertModal({ message: this.t("selectMsgAlert") });
        return;
      }

      const loadedMessages = [];
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
          parsedData.filePath =
            parsedData.filePath ||
            file.path ||
            file.webkitRelativePath ||
            file.name;

          loadedMessages.push(parsedData);
        } catch (err) {
          console.error("Error parsing .msg file:", err);
          await this.showAlertModal({
            message: `${this.t("readErrorAlert")} ${file.name}: ${err.message}`,
          });
        }
      }

      if (loadedMessages.length > 0) {
        await this.addMessages(loadedMessages);
      }
    }

    renderSidebarList() {
      this.elements.fileList.innerHTML = "";

      this.messages.forEach((msg, idx) => {
        const hasAttach = msg.attachments && msg.attachments.length > 0;
        const item = document.createElement("div");
        item.className = `file-item ${idx === this.currentMsgIndex ? "active" : ""}`;

        const senderStr =
          msg.senderName &&
          msg.senderEmail &&
          !msg.senderName.includes(msg.senderEmail)
            ? `${msg.senderName} <${msg.senderEmail}>`
            : msg.senderName || msg.senderEmail || this.t("unknownSender");

        const dateStr = formatDateString(msg.date) || this.t("noDate");

        item.innerHTML = `
          <button class="btn-remove-item" title="${escapeHtml(this.t("removeMsg"))}" aria-label="${escapeHtml(this.t("removeMsg"))}">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <div class="file-item-subject" title="${escapeHtml(msg.subject || this.t("noSubject"))}">${escapeHtml(msg.subject || this.t("noSubject"))}</div>
          <div class="file-item-sender" title="${escapeHtml(senderStr)}">${escapeHtml(senderStr)}</div>
          <div class="file-item-date-row">
            <span class="file-item-date">${escapeHtml(dateStr)}</span>
            ${hasAttach ? `<span class="attachment-badge">📎 ${msg.attachments.length}</span>` : ""}
          </div>
        `;

        const removeBtn = item.querySelector(".btn-remove-item");
        if (removeBtn) {
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.removeMessage(idx);
          });
        }

        item.addEventListener("click", () => this.selectMessage(idx));
        this.elements.fileList.appendChild(item);
      });

      this.updateMessagesCountBadge();
    }

    filterFileList(query) {
      const q = query.toLowerCase();
      const items = this.elements.fileList.children;

      this.messages.forEach((msg, idx) => {
        const match =
          (msg.subject && msg.subject.toLowerCase().includes(q)) ||
          (msg.senderName && msg.senderName.toLowerCase().includes(q)) ||
          (msg.senderEmail && msg.senderEmail.toLowerCase().includes(q));

        if (items[idx]) {
          items[idx].style.display = match ? "flex" : "none";
        }
      });
    }

    selectMessage(index) {
      if (index < 0 || index >= this.messages.length) return;

      this.currentMsgIndex = index;
      const msg = this.messages[index];
      if (msg && msg.id) {
        localStorage.setItem("msg_viewer_active_id", msg.id);
      }

      Array.from(this.elements.fileList.children).forEach((el, i) => {
        el.classList.toggle("active", i === index);
      });

      this.elements.emptyState.style.display = "none";
      this.elements.emailDetails.style.display = "flex";

      this.elements.emailSubject.textContent =
        msg.subject || this.t("noSubject");
      this.elements.emailSender.textContent = msg.senderEmail
        ? `${msg.senderName} <${msg.senderEmail}>`
        : msg.senderName || this.t("unknownSender");
      this.elements.emailTo.textContent =
        msg.displayTo || this.t("noRecipients");

      if (msg.displayCc) {
        this.elements.emailCcRow.style.display = "contents";
        this.elements.emailCc.textContent = msg.displayCc;
      } else {
        this.elements.emailCcRow.style.display = "none";
      }

      // Populate Path Field
      const currentPath = msg.filePath || msg.fileName || "";
      if (this.elements.emailPath) {
        this.elements.emailPath.textContent = currentPath;
        this.elements.emailPath.title = currentPath;
      }

      // Render Attachment Cards Grid
      this.elements.attachmentsGrid.innerHTML = "";
      if (msg.attachments && msg.attachments.length > 0) {
        this.elements.attachmentsSection.style.display = "flex";
        this.elements.attachmentsCount.textContent = msg.attachments.length;

        msg.attachments.forEach((att) => {
          const extUpper = (att.extension || "BIN").toUpperCase();
          const card = document.createElement("div");
          card.className = "attachment-card";
          card.innerHTML = `
            <div class="attachment-info">
              <div class="attachment-icon">${escapeHtml(extUpper.substring(0, 4))}</div>
              <div class="attachment-details">
                <div class="attachment-name" title="${escapeHtml(att.fileName)}">${escapeHtml(att.fileName)}</div>
                <div class="attachment-size">${this.formatBytes(att.size)}</div>
              </div>
            </div>
            <div class="attachment-actions">
              <button class="btn btn-secondary btn-xs btn-preview">${this.t("btnPreview")}</button>
              <button class="btn btn-primary btn-xs btn-save">${this.t("btnSave")}</button>
            </div>
          `;

          card
            .querySelector(".btn-preview")
            .addEventListener("click", () => this.previewAttachment(att));
          card
            .querySelector(".btn-save")
            .addEventListener("click", () => this.downloadAttachment(att));

          this.elements.attachmentsGrid.appendChild(card);
        });
      } else {
        this.elements.attachmentsSection.style.display = "none";
      }

      this.setViewMode(this.viewMode || "html");
    }

    setViewMode(mode) {
      this.viewMode = mode;
      const msg = this.messages[this.currentMsgIndex];
      if (!msg) return;

      this.elements.tabHtml.classList.toggle("active", mode === "html");
      this.elements.tabText.classList.toggle("active", mode === "text");

      if (mode === "html") {
        this.elements.bodyIframe.style.display = "block";
        this.elements.bodyPlain.style.display = "none";

        const contentToRender =
          msg.bodyHtml ||
          (msg.bodyText
            ? `<html><body><div style="font-family: system-ui, sans-serif; padding: 16px; line-height: 1.6; color: #000000;">${escapeHtml(msg.bodyText).replace(/\n/g, "<br>")}</div></body></html>`
            : `<p>${this.t("noBodyHtml")}</p>`);
        const cleanHtml = sanitizeHtml(contentToRender);
        const fullDoc = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 16px; color: #000000; line-height: 1.6; background-color: #ffffff; zoom: ${this.fontZoom / 100}; }
              p, div, span, td, th, li, a, h1, h2, h3, h4, h5, h6 { color: #000000; }
              img { max-width: 100%; height: auto; }
              a { color: #1d4ed8; text-decoration: underline; }
              @media print {
                *, body, p, div, span, td, th, li, a, h1, h2, h3, h4, h5, h6 {
                  color: #000000 !important;
                  background: #ffffff !important;
                  zoom: 1 !important;
                }
              }
            </style>
          </head>
          <body>${cleanHtml}</body>
          </html>
        `;

        const iframeDoc =
          this.elements.bodyIframe.contentDocument ||
          this.elements.bodyIframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(fullDoc);
        iframeDoc.close();
        if (iframeDoc.body) {
          iframeDoc.body.style.zoom = String(this.fontZoom / 100);
        }
      } else {
        this.elements.bodyIframe.style.display = "none";
        this.elements.bodyPlain.style.display = "block";

        let textToShow = msg.bodyText;
        if (!textToShow && msg.bodyHtml) {
          textToShow = cleanGarbledText(
            msg.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
          );
        }
        this.elements.bodyPlain.textContent =
          textToShow || this.t("noBodyText");
      }
      this.applyFontZoom();
    }

    changeFontZoom(delta) {
      const newZoom = Math.min(250, Math.max(60, this.fontZoom + delta));
      if (newZoom !== this.fontZoom) {
        this.fontZoom = newZoom;
        localStorage.setItem("msg_viewer_font_zoom", String(this.fontZoom));
        this.applyFontZoom();
      }
    }

    resetFontZoom() {
      if (this.fontZoom !== 100) {
        this.fontZoom = 100;
        localStorage.setItem("msg_viewer_font_zoom", "100");
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
          const iframeDoc =
            this.elements.bodyIframe.contentDocument ||
            this.elements.bodyIframe.contentWindow.document;
          if (iframeDoc && iframeDoc.body) {
            iframeDoc.body.style.zoom = String(this.fontZoom / 100);
          }
        } catch (e) {
          console.warn("Could not apply zoom to iframe body:", e);
        }
      }
    }

    previewAttachment(attachment) {
      this.currentPreviewAttachment = attachment;
      this.elements.modalFileName.textContent = attachment.fileName;
      this.elements.modalBody.innerHTML = "";

      const ext = (attachment.extension || "").toLowerCase();
      const blob = new Blob([attachment.content], {
        type: attachment.mimeType,
      });
      const url = URL.createObjectURL(blob);

      if (
        ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext) ||
        attachment.mimeType.startsWith("image/")
      ) {
        const img = document.createElement("img");
        img.src = url;
        img.className = "preview-img";
        img.alt = attachment.fileName;
        this.elements.modalBody.appendChild(img);
      } else if (ext === "pdf" || attachment.mimeType === "application/pdf") {
        const iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.className = "preview-iframe";
        this.elements.modalBody.appendChild(iframe);
      } else if (
        [
          "txt",
          "log",
          "csv",
          "json",
          "xml",
          "html",
          "js",
          "py",
          "css",
          "sql",
          "md",
        ].includes(ext) ||
        attachment.mimeType.startsWith("text/")
      ) {
        const textDecoder = new TextDecoder("utf-8");
        const textContent = textDecoder.decode(attachment.content);
        const pre = document.createElement("pre");
        pre.className = "preview-text";
        pre.textContent = textContent;
        this.elements.modalBody.appendChild(pre);
      } else if (
        ["mp3", "wav", "ogg"].includes(ext) ||
        attachment.mimeType.startsWith("audio/")
      ) {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = url;
        this.elements.modalBody.appendChild(audio);
      } else if (
        ["mp4", "webm"].includes(ext) ||
        attachment.mimeType.startsWith("video/")
      ) {
        const video = document.createElement("video");
        video.controls = true;
        video.style.maxWidth = "100%";
        video.style.maxHeight = "65vh";
        video.src = url;
        this.elements.modalBody.appendChild(video);
      } else {
        const placeholder = document.createElement("div");
        placeholder.style.textAlign = "center";
        placeholder.style.padding = "40px";
        placeholder.innerHTML = `
          <div style="font-size: 3rem; margin-bottom: 12px;">📁</div>
          <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-primary);">${escapeHtml(attachment.fileName)}</div>
          <div style="color: var(--text-secondary); margin-top: 4px;">${this.t("previewNotAvailable")}</div>
          <button id="btnModalSaveInline" class="btn btn-primary" style="margin-top: 16px;">${this.t("downloadFile")} (${this.formatBytes(attachment.size)})</button>
        `;
        this.elements.modalBody.appendChild(placeholder);
        placeholder
          .querySelector("#btnModalSaveInline")
          .addEventListener("click", () => this.downloadAttachment(attachment));
      }

      this.elements.previewModal.classList.add("active");
    }

    closePreviewModal() {
      this.elements.previewModal.classList.remove("active");
      this.elements.modalBody.innerHTML = "";
      this.currentPreviewAttachment = null;
    }

    downloadAttachment(attachment) {
      const blob = new Blob([attachment.content], {
        type: attachment.mimeType || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.fileName || "attachment";
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
      if (!bytes) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }

    checkUrlParams() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        let filePath = urlParams.get("file");
        if (!filePath && window.location.hash) {
          const match = window.location.hash.match(/file=([^&]+)/);
          if (match) filePath = decodeURIComponent(match[1]);
        }
        if (filePath) {
          this.loadFileFromPath(filePath);
        }
      } catch (e) {
        console.error("Error parsing URL params:", e);
      }
    }

    async loadFileFromPath(filePath) {
      try {
        const response = await fetch(
          `${API_BASE}/api/load-file?path=${encodeURIComponent(filePath)}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.attachments) {
            data.attachments = data.attachments.map((att) => ({
              fileName: att.fileName,
              mimeType: att.mimeType,
              size: att.size,
              extension: att.extension,
              content: base64ToUint8Array(att.base64Content),
            }));
          }
          data.filePath = data.filePath || filePath;
          data.fileName =
            data.fileName || filePath.split(/[\\/]/).pop() || "message.msg";
          await this.addMessages([data]);
        }
      } catch (err) {
        console.error("Error loading file from path:", err);
      }
    }

    async openFileLocation(msg) {
      if (!msg) {
        msg = this.messages[this.currentMsgIndex];
      }
      if (!msg) return;

      const path = msg.filePath || msg.fileName || "";
      const btn = this.elements.btnOpenPathFolder;
      const originalHtml = btn ? btn.innerHTML : "";

      try {
        const response = await fetch(`${API_BASE}/api/open-folder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
              btn.classList.add("btn-success");
              btn.innerHTML = `
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                <span>${this.t("folderOpened")}</span>
              `;
              setTimeout(() => {
                btn.classList.remove("btn-success");
                btn.innerHTML = originalHtml;
              }, 2000);
            }
            return;
          }
        }
      } catch (err) {
        console.warn("Backend server not available for opening folder:", err);
      }

      // Fallback: Copy path to clipboard if server couldn't open Explorer directly
      if (navigator.clipboard && path) {
        try {
          await navigator.clipboard.writeText(path);
          if (btn) {
            btn.innerHTML = `
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
              </svg>
              <span>${this.t("pathCopied")}</span>
            `;
            setTimeout(() => {
              btn.innerHTML = originalHtml;
            }, 2000);
          }
        } catch (clipErr) {}
      }
    }
  }

  // Initialize App on Load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      window.app = new MsgViewerApp();
    });
  } else {
    window.app = new MsgViewerApp();
  }
})();
