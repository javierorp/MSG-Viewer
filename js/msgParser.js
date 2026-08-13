/**
 * Client-Side OLE CFBF (Compound File Binary Format) Parser for Outlook .msg Files
 * Parses Microsoft Outlook .msg binary files natively in pure JavaScript (ArrayBuffer).
 */

export class MsgParser {
  constructor(arrayBuffer) {
    this.buffer = new Uint8Array(arrayBuffer);
    this.dataView = new DataView(arrayBuffer);
    this.isLittleEndian = true;
    
    // Validate OLE CFBF Magic Header: D0 CF 11 E0 A1 B1 1A E1
    const magic = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    for (let i = 0; i < 8; i++) {
      if (this.buffer[i] !== magic[i]) {
        throw new Error('The selected file is not a valid Outlook .msg file.');
      }
    }

    this.sectorShift = this.dataView.getUint16(30, this.isLittleEndian);
    this.sectorSize = 1 << this.sectorShift; // Usually 512 or 4096 bytes
    this.miniSectorShift = this.dataView.getUint16(32, this.isLittleEndian);
    this.miniSectorSize = 1 << this.miniSectorShift; // Usually 64 bytes
    
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
    
    // Read first 109 DIFAT entries from header
    for (let i = 0; i < 109; i++) {
      const sec = this.dataView.getUint32(76 + i * 4, this.isLittleEndian);
      if (sec !== 0xFFFFFFFE && sec !== 0xFFFFFFFF) {
        difatSectors.push(sec);
      }
    }

    // Read additional DIFAT sectors if present
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

    // Read FAT entries
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
      // Read from Mini Stream container (Root entry stream)
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

  decodeText(buffer, isUnicode = true) {
    if (isUnicode) {
      const decoder = new TextDecoder('utf-16le');
      return decoder.decode(buffer);
    } else {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(buffer);
    }
  }

  parse() {
    const msgData = {
      subject: '(No Subject)',
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
    const propertyMap = new Map();
    const attachmentEntries = [];

    for (const entry of rootEntries) {
      if (!entry.name) continue;

      const isMini = entry.size < this.miniCutoffSize;
      
      // Property Stream tags format: __substg1.0_TAGTYPE
      if (entry.name.startsWith('__substg1.0_')) {
        const tagHex = entry.name.substring(12, 16).toUpperCase();
        const typeHex = entry.name.substring(16, 20).toUpperCase();
        const rawData = this.getStreamData(entry.startSector, entry.size, isMini);
        
        propertyMap.set(entry.name, { tagHex, typeHex, data: rawData });

        // Standard MAPI Properties mapping
        if (tagHex === '0037') { // PR_SUBJECT
          msgData.subject = this.decodeText(rawData, typeHex === '001F');
        } else if (tagHex === '0C1A') { // PR_SENDER_NAME
          msgData.senderName = this.decodeText(rawData, typeHex === '001F');
        } else if (tagHex === '0C1F' || tagHex === '39FE') { // PR_SENDER_EMAIL_ADDRESS
          const email = this.decodeText(rawData, typeHex === '001F');
          if (email && email.includes('@')) msgData.senderEmail = email;
        } else if (tagHex === '0E04') { // PR_DISPLAY_TO
          msgData.displayTo = this.decodeText(rawData, typeHex === '001F');
        } else if (tagHex === '0E03') { // PR_DISPLAY_CC
          msgData.displayCc = this.decodeText(rawData, typeHex === '001F');
        } else if (tagHex === '0E02') { // PR_DISPLAY_BCC
          msgData.displayBcc = this.decodeText(rawData, typeHex === '001F');
        } else if (tagHex === '1000') { // PR_BODY (Plain Text)
          msgData.bodyText = this.decodeText(rawData, typeHex === '001F');
        } else if (tagHex === '1009' || tagHex === '1013') { // PR_BODY_HTML
          if (typeHex === '0102' || typeHex === '001E' || typeHex === '001F') {
            msgData.bodyHtml = this.decodeText(rawData, typeHex === '001F');
          }
        } else if (tagHex === '0039') { // PR_CLIENT_SUBMIT_TIME
          // Filetime format date
        }
      }

      // Check for Attachment Storages: __attach_version1.0_#00000000
      if (entry.name.startsWith('__attach_version1.0_')) {
        attachmentEntries.push(entry);
      }
    }

    // Process attachments
    const attachmentStreams = new Map();
    for (const entry of rootEntries) {
      if (entry.name.includes('__attach_version1.0_')) {
        // Group properties by attachment folder
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

        if (nameUpper.includes('3707') || nameUpper.includes('3704')) { // PR_ATTACH_LONG_FILENAME / PR_ATTACH_FILENAME
          fileName = this.decodeText(rawData, nameUpper.endsWith('001F'));
        } else if (nameUpper.includes('370E')) { // PR_ATTACH_MIME_TAG
          mimeType = this.decodeText(rawData, nameUpper.endsWith('001F'));
        } else if (nameUpper.includes('3701')) { // PR_ATTACH_DATA_BIN
          content = rawData;
        }
      }

      if (content) {
        msgData.attachments.push({
          fileName: fileName.replace(/\0/g, '').trim(),
          mimeType: mimeType.replace(/\0/g, '').trim(),
          content: content,
          size: content.length
        });
      }
    }

    // Fallback: If no senderEmail but senderName exists
    if (!msgData.senderEmail && msgData.senderName) {
      msgData.senderEmail = msgData.senderName;
    }

    return msgData;
  }
}
