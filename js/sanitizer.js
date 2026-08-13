/**
 * HTML Sanitizer & Security Utility for Outlook MSG Viewer
 */

export function sanitizeHtml(rawHtml) {
  if (!rawHtml) return '';

  // Create a detached DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // 1. Remove dangerous script, iframe, object, embed, and form elements
  const forbiddenTags = ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta'];
  forbiddenTags.forEach(tag => {
    const elements = doc.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });

  // 2. Remove inline event handlers (onerror, onload, onclick, etc.) and javascript: URLs
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    // Iterate attributes
    Array.from(el.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value.toLowerCase();

      // Check for inline event handlers
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
      // Check for javascript: links or data: uris in href/src (except safe images)
      if ((name === 'href' || name === 'src') && value.trim().startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    });

    // Ensure links open in new tab securely
    if (el.tagName.toLowerCase() === 'a') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });

  return doc.body.innerHTML;
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
