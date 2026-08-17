import { resolveInlineImages, uint8ArrayToBase64, base64ToUint8Array } from "./sanitizer.js";

/**
 * Pure JavaScript EML (RFC 822 / RFC 2822 / MIME) Parser
 * Handles multipart emails, quoted-printable, base64, encoded headers, inline CID images and attachments.
 */
export class EmlParser {
  constructor(data) {
    if (typeof data === 'string') {
      this.rawText = data;
      this.rawBytes = new TextEncoder().encode(data);
    } else if (data instanceof ArrayBuffer) {
      this.rawBytes = new Uint8Array(data);
      this.rawText = this.decodeBytesToText(this.rawBytes);
    } else if (data instanceof Uint8Array) {
      this.rawBytes = data;
      this.rawText = this.decodeBytesToText(this.rawBytes);
    } else {
      throw new Error('Invalid data type provided to EmlParser');
    }
  }

  decodeBytesToText(bytes, charset = 'utf-8') {
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch (_) {
      try {
        return new TextDecoder('windows-1252').decode(bytes);
      } catch (_) {
        return new TextDecoder('iso-8859-1').decode(bytes);
      }
    }
  }

  /**
   * Decode RFC 2047 MIME encoded words: =?charset?encoding?encoded_text?=
   */
  decodeMimeHeader(headerStr) {
    if (!headerStr || typeof headerStr !== 'string') return '';

    // Unfold multi-line headers first
    const unfolded = headerStr.replace(/\r?\n[ \t]+/g, ' ').trim();

    const regex = /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g;
    let result = unfolded;

    // Check if there are encoded words
    if (regex.test(unfolded)) {
      result = unfolded.replace(regex, (match, charset, encoding, text) => {
        try {
          const enc = encoding.toUpperCase();
          const cs = (charset || 'utf-8').toLowerCase().replace('windows-1252', 'windows-1252');

          if (enc === 'B') {
            const rawBin = atob(text);
            const bytes = new Uint8Array(rawBin.length);
            for (let i = 0; i < rawBin.length; i++) {
              bytes[i] = rawBin.charCodeAt(i);
            }
            return this.decodeBytesToText(bytes, cs);
          } else if (enc === 'Q') {
            // Quoted-printable in headers replaces space with '_'
            const qpText = text.replace(/_/g, '=20');
            const bytes = this.decodeQuotedPrintableToBytes(qpText);
            return this.decodeBytesToText(bytes, cs);
          }
        } catch (_) {}
        return match;
      });
    }

    return result;
  }

  /**
   * Decode Quoted-Printable string into Uint8Array bytes
   */
  decodeQuotedPrintableToBytes(qpStr) {
    // Remove soft line breaks (=\r\n or =\n)
    const cleanStr = qpStr.replace(/=\r?\n/g, '');
    const bytes = [];
    let i = 0;
    while (i < cleanStr.length) {
      if (cleanStr[i] === '=' && i + 2 < cleanStr.length) {
        const hex = cleanStr.substr(i + 1, 2);
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 3;
          continue;
        }
      }
      bytes.push(cleanStr.charCodeAt(i) & 0xff);
      i++;
    }
    return new Uint8Array(bytes);
  }

  /**
   * Parse email header block into an object with normalized lowercase keys
   */
  parseHeaders(rawHeaders) {
    const headers = {};
    const lines = rawHeaders.split(/\r?\n/);
    let currentKey = null;
    let currentValue = '';

    for (const line of lines) {
      if (/^[ \t]/.test(line)) {
        // Continuation line
        if (currentKey) {
          currentValue += ' ' + line.trim();
        }
      } else {
        if (currentKey) {
          headers[currentKey] = this.decodeMimeHeader(currentValue);
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          currentKey = line.substring(0, colonIdx).trim().toLowerCase();
          currentValue = line.substring(colonIdx + 1).trim();
        } else {
          currentKey = null;
          currentValue = '';
        }
      }
    }
    if (currentKey) {
      headers[currentKey] = this.decodeMimeHeader(currentValue);
    }
    return headers;
  }

  /**
   * Parse Content-Type or Content-Disposition into { value, params }
   */
  parseHeaderWithParams(headerValue) {
    if (!headerValue) return { value: '', params: {} };
    const parts = headerValue.split(';');
    const value = parts[0].trim().toLowerCase();
    const params = {};

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].trim();
      const eqIdx = part.indexOf('=');
      if (eqIdx > 0) {
        const paramKey = part.substring(0, eqIdx).trim().toLowerCase();
        let paramVal = part.substring(eqIdx + 1).trim();
        // Strip quotes
        if (paramVal.startsWith('"') && paramVal.endsWith('"') && paramVal.length >= 2) {
          paramVal = paramVal.slice(1, -1);
        } else if (paramVal.startsWith("'") && paramVal.endsWith("'") && paramVal.length >= 2) {
          paramVal = paramVal.slice(1, -1);
        }
        params[paramKey] = this.decodeMimeHeader(paramVal);
      }
    }
    return { value, params };
  }

  /**
   * Split raw MIME part string into headers and body
   */
  splitHeaderAndBody(rawPart) {
    const separatorMatch = rawPart.match(/\r?\n\r?\n/);
    if (!separatorMatch) {
      return { rawHeaders: rawPart, rawBody: '' };
    }
    const idx = separatorMatch.index;
    const rawHeaders = rawPart.substring(0, idx);
    const rawBody = rawPart.substring(idx + separatorMatch[0].length);
    return { rawHeaders, rawBody };
  }

  /**
   * Recursively parse a MIME part (can be single part or multipart)
   */
  parsePart(rawPart) {
    const { rawHeaders, rawBody } = this.splitHeaderAndBody(rawPart);
    const headers = this.parseHeaders(rawHeaders);
    const contentTypeInfo = this.parseHeaderWithParams(headers['content-type'] || 'text/plain');
    const dispositionInfo = this.parseHeaderWithParams(headers['content-disposition'] || '');
    const transferEncoding = (headers['content-transfer-encoding'] || '').trim().toLowerCase();
    const contentId = (headers['content-id'] || '').replace(/^<+|>+$/g, '').trim();
    const contentLocation = (headers['content-location'] || '').trim();

    const isMultipart = contentTypeInfo.value.startsWith('multipart/');
    const boundary = contentTypeInfo.params['boundary'];

    if (isMultipart && boundary) {
      const subParts = [];
      const delimiter = '--' + boundary;
      const closeDelimiter = '--' + boundary + '--';

      const rawSubParts = rawBody.split(delimiter);
      for (let i = 1; i < rawSubParts.length; i++) {
        let piece = rawSubParts[i];
        if (piece.startsWith('--') || piece.trim() === '--') {
          // Close boundary reached
          continue;
        }
        if (piece.startsWith('\r\n')) piece = piece.substring(2);
        else if (piece.startsWith('\n')) piece = piece.substring(1);

        if (piece.endsWith('\r\n')) piece = piece.slice(0, -2);
        else if (piece.endsWith('\n')) piece = piece.slice(0, -1);

        if (piece.trim()) {
          const parsedSub = this.parsePart(piece);
          subParts.push(parsedSub);
        }
      }
      return {
        headers,
        contentType: contentTypeInfo.value,
        params: contentTypeInfo.params,
        disposition: dispositionInfo,
        transferEncoding,
        contentId,
        contentLocation,
        isMultipart: true,
        parts: subParts,
        bodyText: '',
        bodyHtml: '',
        attachments: []
      };
    }

    // Single part payload processing
    const filename = dispositionInfo.params['filename'] || contentTypeInfo.params['name'] || '';
    const charset = contentTypeInfo.params['charset'] || 'utf-8';
    let decodedBytes = null;
    let decodedText = '';

    if (transferEncoding === 'base64') {
      const cleanBase64 = rawBody.replace(/[\r\n\t ]/g, '');
      try {
        decodedBytes = base64ToUint8Array(cleanBase64);
        if (contentTypeInfo.value.startsWith('text/')) {
          decodedText = this.decodeBytesToText(decodedBytes, charset);
        }
      } catch (_) {
        decodedBytes = new Uint8Array(0);
      }
    } else if (transferEncoding === 'quoted-printable') {
      decodedBytes = this.decodeQuotedPrintableToBytes(rawBody);
      decodedText = this.decodeBytesToText(decodedBytes, charset);
    } else {
      // 7bit, 8bit, binary
      decodedText = rawBody;
      decodedBytes = new TextEncoder().encode(rawBody);
    }

    return {
      headers,
      contentType: contentTypeInfo.value,
      params: contentTypeInfo.params,
      disposition: dispositionInfo,
      transferEncoding,
      contentId,
      contentLocation,
      filename,
      isMultipart: false,
      decodedBytes,
      decodedText,
      rawBody
    };
  }

  /**
   * Flatten and aggregate body text, HTML, and attachments from parsed MIME tree
   */
  collectPayloads(part, result) {
    if (part.isMultipart) {
      if (part.parts && part.parts.length > 0) {
        for (const sub of part.parts) {
          this.collectPayloads(sub, result);
        }
      }
      return;
    }

    const contentType = part.contentType || 'text/plain';
    const isAttachment =
      part.disposition.value === 'attachment' ||
      !!part.filename ||
      (part.contentId && !contentType.startsWith('text/')) ||
      (!contentType.startsWith('text/plain') && !contentType.startsWith('text/html'));

    if (isAttachment) {
      const fileName = part.filename || 'attachment.bin';
      const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
      const b64 = part.decodedBytes ? uint8ArrayToBase64(part.decodedBytes) : '';

      result.attachments.push({
        fileName: fileName,
        contentId: part.contentId || '',
        cid: part.contentId || '',
        contentLocation: part.contentLocation || '',
        mimeType: contentType || 'application/octet-stream',
        size: part.decodedBytes ? part.decodedBytes.length : 0,
        extension: ext,
        content: part.decodedBytes,
        base64Content: b64
      });
    } else {
      if (contentType === 'text/html' && !result.bodyHtml) {
        result.bodyHtml = part.decodedText || '';
      } else if (contentType === 'text/plain' && !result.bodyText) {
        result.bodyText = part.decodedText || '';
      }
    }
  }

  /**
   * Main entry point to parse EML and return structured JSON
   */
  parse() {
    const rootPart = this.parsePart(this.rawText);
    const rootHeaders = rootPart.headers || {};

    const subject = rootHeaders['subject'] || '(No Subject)';
    const fromRaw = rootHeaders['from'] || '';
    const displayTo = rootHeaders['to'] || '';
    const displayCc = rootHeaders['cc'] || '';
    const displayBcc = rootHeaders['bcc'] || '';
    const dateStr = rootHeaders['date'] || null;

    let senderName = '';
    let senderEmail = '';

    if (fromRaw) {
      const match = fromRaw.match(/^(?:"?([^"]*?)"?\s*)?<([^>]+@[^>]+)>$/);
      if (match) {
        senderName = (match[1] || '').trim();
        senderEmail = (match[2] || '').trim();
      } else if (fromRaw.includes('@') && !fromRaw.includes(' ')) {
        senderEmail = fromRaw.trim();
      } else {
        senderName = fromRaw.trim();
      }
    }

    if (senderName && senderEmail && senderName.toLowerCase() === senderEmail.toLowerCase()) {
      senderName = '';
    }

    const payloadResult = {
      bodyText: '',
      bodyHtml: '',
      attachments: []
    };

    this.collectPayloads(rootPart, payloadResult);

    // Resolve inline images (cid:) in bodyHtml
    if (payloadResult.bodyHtml && payloadResult.attachments.length > 0) {
      payloadResult.bodyHtml = resolveInlineImages(payloadResult.bodyHtml, payloadResult.attachments);
    }

    return {
      subject,
      senderName,
      senderEmail,
      displayTo,
      displayCc,
      displayBcc,
      date: dateStr,
      bodyText: payloadResult.bodyText,
      bodyHtml: payloadResult.bodyHtml,
      attachments: payloadResult.attachments
    };
  }
}
