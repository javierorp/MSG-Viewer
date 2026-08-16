/**
 * HTML Sanitizer, Security & Inline Asset Utility for Outlook MSG Viewer
 */

export function uint8ArrayToBase64(bytes) {
  if (!bytes || bytes.length === 0) return '';
  let binary = '';
  const len = bytes.byteLength || bytes.length;
  const chunkSize = 0x8000; // 32KB chunks to prevent call stack overflow
  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    const chunk = bytes.subarray ? bytes.subarray(i, end) : bytes.slice(i, end);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64) {
  if (!base64) return new Uint8Array(0);
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function resolveInlineImages(html, attachments) {
  if (!html || !attachments || attachments.length === 0) {
    return html || '';
  }

  const cidMap = new Map();
  const fileMap = new Map();

  for (const att of attachments) {
    let base64 = att.base64Content;
    if (!base64 && att.content) {
      if (typeof att.content === 'string') {
        base64 = att.content;
      } else if (att.content instanceof Uint8Array || att.content.buffer) {
        base64 = uint8ArrayToBase64(att.content);
      }
    }
    if (!base64) continue;

    let mimeType = att.mimeType || '';
    const fileName = (att.fileName || att.longFilename || att.shortFilename || '').replace(/\0/g, '').trim();
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : (att.extension || '');

    if (!mimeType || mimeType === 'application/octet-stream') {
      const mimeMap = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
        ico: 'image/x-icon',
        tif: 'image/tiff',
        tiff: 'image/tiff',
      };
      if (mimeMap[ext]) {
        mimeType = mimeMap[ext];
      } else {
        mimeType = 'image/png';
      }
    }

    const dataUri = `data:${mimeType};base64,${base64}`;

    const addKey = (key, map) => {
      if (!key) return;
      const k = String(key).trim();
      if (!k) return;
      map.set(k.toLowerCase(), dataUri);
      const unbracketed = k.replace(/^<+|>+$/g, '').trim();
      if (unbracketed) {
        map.set(unbracketed.toLowerCase(), dataUri);
        try {
          map.set(decodeURIComponent(unbracketed).toLowerCase(), dataUri);
        } catch (_) {}
      }
      try {
        map.set(decodeURIComponent(k).toLowerCase(), dataUri);
      } catch (_) {}
    };

    if (att.contentId) addKey(att.contentId, cidMap);
    if (att.cid) addKey(att.cid, cidMap);
    if (att.contentLocation) addKey(att.contentLocation, fileMap);
    if (fileName) {
      addKey(fileName, fileMap);
      addKey(fileName, cidMap);
    }
    if (att.longFilename) {
      addKey(att.longFilename, fileMap);
      addKey(att.longFilename, cidMap);
    }
    if (att.shortFilename) {
      addKey(att.shortFilename, fileMap);
      addKey(att.shortFilename, cidMap);
    }
  }

  if (cidMap.size === 0 && fileMap.size === 0) {
    return html;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const findDataUri = (srcVal) => {
      if (!srcVal) return null;
      let raw = srcVal.trim();
      if (raw.toLowerCase().startsWith('cid:')) {
        let cid = raw.slice(4).trim().replace(/^<+|>+$/g, '');
        let match = cidMap.get(cid.toLowerCase());
        if (match) return match;
        try {
          match = cidMap.get(decodeURIComponent(cid).toLowerCase());
          if (match) return match;
        } catch (_) {}
        match = fileMap.get(cid.toLowerCase());
        if (match) return match;
      } else if (!raw.includes('://') && !raw.startsWith('data:') && !raw.startsWith('blob:') && !raw.startsWith('//') && !raw.startsWith('mailto:')) {
        let fn = raw.split(/[\\/]/).pop().trim();
        let match = fileMap.get(fn.toLowerCase()) || cidMap.get(fn.toLowerCase());
        if (match) return match;
        try {
          match = fileMap.get(decodeURIComponent(fn).toLowerCase()) || cidMap.get(decodeURIComponent(fn).toLowerCase());
          if (match) return match;
        } catch (_) {}
      }
      return null;
    };

    const images = doc.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      const dataUri = findDataUri(src);
      if (dataUri) {
        img.setAttribute('src', dataUri);
      } else {
        const alt = img.getAttribute('alt');
        const altUri = findDataUri(alt);
        if (altUri && (!src || src.toLowerCase().startsWith('cid:'))) {
          img.setAttribute('src', altUri);
        }
      }
    });

    const vmlImages = doc.querySelectorAll('imagedata, v\\:imagedata');
    vmlImages.forEach(el => {
      const src = el.getAttribute('src') || el.getAttribute('o:title') || el.getAttribute('o:href');
      const dataUri = findDataUri(src);
      if (dataUri) {
        el.setAttribute('src', dataUri);
        const newImg = doc.createElement('img');
        newImg.setAttribute('src', dataUri);
        newImg.setAttribute('style', 'max-width:100%;height:auto;display:inline-block;');
        const alt = el.getAttribute('o:title') || 'Image';
        newImg.setAttribute('alt', alt);
        if (el.parentElement) {
          el.parentElement.appendChild(newImg);
        }
      }
    });

    const styledElements = doc.querySelectorAll('[style*="cid:"], [style*="url("], [background]');
    styledElements.forEach(el => {
      const style = el.getAttribute('style');
      if (style) {
        let newStyle = style.replace(/url\(\s*(['"]?)(?:cid:)?([^'")]+)\1\s*\)/gi, (match, quote, val) => {
          const dataUri = findDataUri(val) || findDataUri('cid:' + val);
          return dataUri ? `url("${dataUri}")` : match;
        });
        el.setAttribute('style', newStyle);
      }
      const bg = el.getAttribute('background');
      if (bg) {
        const dataUri = findDataUri(bg) || findDataUri('cid:' + bg);
        if (dataUri) {
          el.setAttribute('background', dataUri);
        }
      }
    });

    const styleTags = doc.querySelectorAll('style');
    styleTags.forEach(st => {
      if (st.textContent && (st.textContent.includes('cid:') || st.textContent.includes('url('))) {
        st.textContent = st.textContent.replace(/url\(\s*(['"]?)(?:cid:)?([^'")]+)\1\s*\)/gi, (match, quote, val) => {
          const dataUri = findDataUri(val) || findDataUri('cid:' + val);
          return dataUri ? `url("${dataUri}")` : match;
        });
      }
    });

    return doc.documentElement ? doc.documentElement.outerHTML : doc.body.innerHTML;
  } catch (e) {
    console.warn("DOM-based inline image resolution error, fallback to regex:", e);
    let result = html;
    cidMap.forEach((dataUri, cid) => {
      const escapedCid = cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`(<img\\b[^>]*?\\bsrc\\s*=\\s*["'])(?:cid:)?<?${escapedCid}>?(["'])`, 'gi');
      result = result.replace(reg, `$1${dataUri}$2`);
      const cssReg = new RegExp(`(url\\s*\\(\\s*["']?)(?:cid:)?<?${escapedCid}>?(["']?\\s*\\))`, 'gi');
      result = result.replace(cssReg, `$1${dataUri}$2`);
    });
    return result;
  }
}

export function sanitizeHtml(rawHtml) {
  if (!rawHtml) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // 1. Remove dangerous script, iframe, object, embed, form, base, meta
  const forbiddenTags = ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta'];
  forbiddenTags.forEach(tag => {
    const elements = doc.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });

  // 2. Remove inline event handlers and javascript: URLs
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

  let headStyles = '';
  if (doc.head) {
    const styles = doc.head.querySelectorAll('style');
    styles.forEach(s => {
      headStyles += s.outerHTML;
    });
  }

  return (headStyles ? headStyles + '\n' : '') + (doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML);
}

export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
