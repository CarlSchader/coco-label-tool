export class ModalManager {
  constructor(modalId) {
    this.modal = document.getElementById(modalId);
    if (!this.modal) {
      console.error(`Modal with id '${modalId}' not found`);
    }
  }

  show() {
    if (this.modal) {
      this.modal.classList.add('show');
    }
  }

  hide() {
    if (this.modal) {
      this.modal.classList.remove('show');
    }
  }

  isVisible() {
    return this.modal && this.modal.classList.contains('show');
  }

  setContent(contentElementId, html) {
    const contentElement = document.getElementById(contentElementId);
    if (contentElement) {
      contentElement.innerHTML = html;
    }
  }

  getContentElement(contentElementId) {
    return document.getElementById(contentElementId);
  }
}

export function hideAllModals(...modalManagers) {
  modalManagers.forEach((modal) => modal.hide());
}

export function createWarningListItem(title, annotatedItems, missingItems, style = {}) {
  const itemDiv = document.createElement('div');
  itemDiv.style.cssText =
    style.container ||
    'margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #30363d;';

  const titleDiv = document.createElement('div');
  titleDiv.style.cssText = style.title || 'font-weight: bold; color: #48d1cc; margin-bottom: 8px;';
  titleDiv.textContent = title;

  if (annotatedItems && annotatedItems.length > 0) {
    const annotatedDiv = document.createElement('div');
    annotatedDiv.style.cssText =
      style.annotated || 'font-size: 12px; color: #8a9199; margin-bottom: 5px;';
    annotatedDiv.innerHTML = `<span style="color: #48d1cc;">✓ Annotated:</span> ${annotatedItems.join(', ')}`;
    itemDiv.appendChild(titleDiv);
    itemDiv.appendChild(annotatedDiv);
  }

  if (missingItems && missingItems.length > 0) {
    const missingDiv = document.createElement('div');
    missingDiv.style.cssText = style.missing || 'font-size: 12px; color: #f85149;';
    missingDiv.innerHTML = `<span style="color: #f85149;">✗ Missing:</span> ${missingItems.join(', ')}`;
    if (!annotatedItems || annotatedItems.length === 0) {
      itemDiv.appendChild(titleDiv);
    }
    itemDiv.appendChild(missingDiv);
  }

  return itemDiv;
}

export function createNestedMismatchListItem(mismatch) {
  const itemDiv = document.createElement('div');
  itemDiv.style.cssText =
    'margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #30363d;';

  const innerDiv = document.createElement('div');
  innerDiv.style.cssText = 'font-size: 13px; margin-bottom: 5px;';
  innerDiv.innerHTML = `
        <span style="color: #f85149;">⚠ Inner:</span> 
        <strong style="color: #48d1cc;">${mismatch.inner.category}</strong> 
        <span style="color: #8a9199;">(${mismatch.inner.supercategory})</span> 
        <span style="color: #555;">#${mismatch.inner.id}</span>
    `;

  const outerDiv = document.createElement('div');
  outerDiv.style.cssText = 'font-size: 13px; margin-left: 20px;';
  outerDiv.innerHTML = `
        <span style="color: #8a9199;">is inside</span> 
        <strong style="color: #48d1cc;">${mismatch.outer.category}</strong> 
        <span style="color: #8a9199;">(${mismatch.outer.supercategory})</span>
        <span style="color: #555;">#${mismatch.outer.id}</span>
    `;

  itemDiv.appendChild(innerDiv);
  itemDiv.appendChild(outerDiv);

  return itemDiv;
}
