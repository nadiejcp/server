const state = {
  scope: 'shared',
  currentDir: '',
  files: [],
  filteredFiles: [],
  previewableFiles: [],
  currentPreviewIndex: -1,
  category: 'all',
  searchQuery: '',
  sortBy: 'newest',
  viewMode: 'grid',
  serverUrl: window.location.origin
};

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, idx);
  return `${val < 10 && idx > 0 ? val.toFixed(1) : Math.round(val)} ${units[idx]}`;
}

function formatDate(ms) {
  if (!ms) return '';
  try {
    const date = new Date(ms);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' toast-error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 220);
  }, 3500);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    textArea.remove();
    return true;
  } catch {
    textArea.remove();
    return false;
  }
}

function getCategorySvg(category) {
  switch (category) {
    case 'folder':
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
    case 'video':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
    case 'audio':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    case 'document':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
    case 'code':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
    case 'archive':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
  }
}

function normalizeFileEntry(entry) {
  if (typeof entry === 'string') {
    const ext = entry.includes('.') ? entry.split('.').pop().toLowerCase() : '';
    let category = 'other';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext)) category = 'image';
    else if (['mp4', 'mkv', 'webm', 'mov'].includes(ext)) category = 'video';
    else if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'a4u'].includes(ext)) category = 'audio';
    return {
      name: entry,
      relativePath: `Archivos/${entry}`,
      scopePath: entry,
      isDirectory: false,
      size: 0,
      mtime: 0,
      ext,
      category,
      url: `./Archivos/${encodeURIComponent(entry)}`,
      downloadUrl: `/api/download?path=${encodeURIComponent(`Archivos/${entry}`)}`,
      canDelete: true
    };
  }
  return entry;
}

async function fetchServerInfo() {
  try {
    const res = await fetch('/api/info');
    if (!res.ok) return;
    const info = await res.json();
    state.serverUrl = info.url || window.location.origin;

    const lanUrlText = document.getElementById('lan-url-text');
    const modalLanUrl = document.getElementById('modal-lan-url');
    const modalCurlCmd = document.getElementById('modal-curl-cmd');
    const interfacesWrap = document.getElementById('interfaces-list-wrap');

    if (lanUrlText) lanUrlText.textContent = state.serverUrl.replace(/^https?:\/\//, '');
    if (modalLanUrl) modalLanUrl.textContent = state.serverUrl;
    if (modalCurlCmd) modalCurlCmd.textContent = `curl -F "file=@/ruta/archivo" ${state.serverUrl}/upload`;

    if (interfacesWrap && Array.isArray(info.interfaces) && info.interfaces.length > 1) {
      interfacesWrap.innerHTML = '';
      info.interfaces.forEach((iface) => {
        const row = document.createElement('div');
        row.className = 'interface-row';
        row.innerHTML = `<span>${iface.name}</span><code>http://${iface.address}:${info.port}</code>`;
        interfacesWrap.appendChild(row);
      });
    }
  } catch (err) {
    console.error('Error fetching server info:', err);
  }
}

async function fetchFiles() {
  try {
    const params = new URLSearchParams({
      scope: state.scope,
      dir: state.currentDir
    });
    const response = await fetch(`/api/files?${params.toString()}`);
    if (!response.ok) {
      throw new Error('No se pudieron cargar los archivos');
    }
    const rawFiles = await response.json();
    state.files = Array.isArray(rawFiles) ? rawFiles.map(normalizeFileEntry) : [];
    updateStats();
    renderBreadcrumbs();
    applyFiltersAndRender();
  } catch (err) {
    console.error(err);
    showToast('Error al leer los archivos del servidor', true);
  }
}

function updateStats() {
  const onlyFiles = state.files.filter((f) => !f.isDirectory);
  const imageCount = onlyFiles.filter((f) => f.category === 'image').length;
  const totalBytes = onlyFiles.reduce((acc, f) => acc + (f.size || 0), 0);

  const statTotal = document.getElementById('stat-total-files');
  const statImages = document.getElementById('stat-images-count');
  const statSize = document.getElementById('stat-total-size');

  if (statTotal) statTotal.textContent = String(onlyFiles.length);
  if (statImages) statImages.textContent = String(imageCount);
  if (statSize) statSize.textContent = formatBytes(totalBytes);
}

function renderBreadcrumbs() {
  const nav = document.getElementById('breadcrumbs');
  if (!nav) return;
  nav.innerHTML = '';

  const rootLabel = state.scope === 'repo' ? 'Repositorio' : 'Archivos Compartidos';
  const segments = state.currentDir ? state.currentDir.split('/').filter(Boolean) : [];

  const rootBtn = document.createElement('button');
  rootBtn.type = 'button';
  rootBtn.className = `breadcrumb-item${segments.length === 0 ? ' current' : ''}`;
  rootBtn.textContent = rootLabel;
  rootBtn.addEventListener('click', () => {
    state.currentDir = '';
    fetchFiles();
  });
  nav.appendChild(rootBtn);

  let accumulated = '';
  segments.forEach((seg, index) => {
    accumulated = accumulated ? `${accumulated}/${seg}` : seg;
    const targetDir = accumulated;

    const sep = document.createElement('span');
    sep.className = 'breadcrumb-sep';
    sep.textContent = '/';
    nav.appendChild(sep);

    const segBtn = document.createElement('button');
    segBtn.type = 'button';
    segBtn.className = `breadcrumb-item${index === segments.length - 1 ? ' current' : ''}`;
    segBtn.textContent = seg;
    segBtn.addEventListener('click', () => {
      state.currentDir = targetDir;
      fetchFiles();
    });
    nav.appendChild(segBtn);
  });
}

function applyFiltersAndRender() {
  const query = state.searchQuery.trim().toLowerCase();

  let list = state.files.filter((item) => {
    if (query && !item.name.toLowerCase().includes(query)) {
      return false;
    }
    if (state.category !== 'all') {
      if (item.isDirectory) return false;
      if (state.category === 'other') {
        return !['image', 'video', 'audio', 'document', 'code'].includes(item.category);
      }
      return item.category === state.category;
    }
    return true;
  });

  list.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    if (state.sortBy === 'name') {
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    }
    if (state.sortBy === 'size') {
      return (b.size || 0) - (a.size || 0);
    }
    return (b.mtime || 0) - (a.mtime || 0);
  });

  state.filteredFiles = list;
  state.previewableFiles = list.filter((item) => !item.isDirectory);
  renderFilesGrid();
}

function createFileCard(item) {
  const card = document.createElement('div');
  card.setAttribute('role', 'listitem');
  card.className = 'file-card';

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'file-thumb-wrap';

  if (item.category === 'image') {
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.name;
    img.loading = 'lazy';
    img.className = 'file-thumb-img';
    thumbWrap.appendChild(img);
  } else {
    const showcase = document.createElement('div');
    showcase.className = 'file-icon-showcase';

    const iconBox = document.createElement('div');
    iconBox.className = `file-type-icon cat-${item.category}`;
    iconBox.innerHTML = getCategorySvg(item.category);
    showcase.appendChild(iconBox);
    thumbWrap.appendChild(showcase);
  }

  if (!item.isDirectory && item.ext) {
    const badge = document.createElement('span');
    badge.className = 'ext-badge';
    badge.textContent = item.ext;
    thumbWrap.appendChild(badge);
  }

  const hoverHint = document.createElement('div');
  hoverHint.className = 'thumb-hover-hint';
  hoverHint.innerHTML = item.isDirectory
    ? `<span class="thumb-hint-pill">Abrir carpeta</span>`
    : `<span class="thumb-hint-pill">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Vista previa
      </span>`;
  thumbWrap.appendChild(hoverHint);

  const handleOpenItem = () => {
    if (item.isDirectory) {
      state.currentDir = item.scopePath;
      fetchFiles();
    } else {
      openPreviewModal(item);
    }
  };

  thumbWrap.addEventListener('click', handleOpenItem);

  const body = document.createElement('div');
  body.className = 'file-card-body';

  const info = document.createElement('div');
  info.className = 'file-info';

  const title = document.createElement('div');
  title.className = 'file-name';
  title.title = item.name;
  title.textContent = item.name;
  title.addEventListener('click', handleOpenItem);

  const meta = document.createElement('div');
  meta.className = 'file-meta';
  if (item.isDirectory) {
    meta.textContent = 'Carpeta';
  } else {
    const parts = [formatBytes(item.size)];
    if (item.mtime) parts.push(formatDate(item.mtime));
    meta.textContent = parts.join(' · ');
  }

  info.appendChild(title);
  info.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'file-actions';

  if (item.isDirectory) {
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'file-action-download';
    openBtn.innerHTML = `<span>Explorar carpeta</span>`;
    openBtn.addEventListener('click', handleOpenItem);
    actions.appendChild(openBtn);
  } else {
    const downloadLink = document.createElement('a');
    downloadLink.className = 'file-action-download';
    downloadLink.href = item.downloadUrl;
    downloadLink.setAttribute('download', item.name);
    downloadLink.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>Descargar</span>
    `;
    actions.appendChild(downloadLink);

    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'file-action-secondary';
    previewBtn.title = 'Vista previa';
    previewBtn.setAttribute('aria-label', 'Vista previa');
    previewBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    previewBtn.addEventListener('click', () => openPreviewModal(item));
    actions.appendChild(previewBtn);

    if (item.canDelete) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'file-action-secondary file-action-delete';
      deleteBtn.title = 'Eliminar archivo';
      deleteBtn.setAttribute('aria-label', 'Eliminar archivo');
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener('click', () => deleteFile(item));
      actions.appendChild(deleteBtn);
    }
  }

  body.appendChild(info);
  body.appendChild(actions);

  card.appendChild(thumbWrap);
  card.appendChild(body);
  return card;
}

function renderFilesGrid() {
  const parent = document.getElementById('listaArchivos');
  if (!parent) return;

  parent.classList.toggle('list-view', state.viewMode === 'list');
  parent.innerHTML = '';

  if (state.filteredFiles.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-state-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"></path>
        </svg>
      </div>
      <h4>No se encontraron archivos</h4>
      <p>${state.searchQuery || state.category !== 'all'
        ? 'Prueba cambiando el filtro o el término de búsqueda.'
        : 'Sube una foto, video o documento arriba o cambia a la pestaña "Todo el Repositorio".'}</p>
    `;
    parent.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  state.filteredFiles.forEach((item) => {
    fragment.appendChild(createFileCard(item));
  });
  parent.appendChild(fragment);
}

async function deleteFile(item) {
  const confirmed = window.confirm(`¿Eliminar "${item.name}" de los archivos compartidos?`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/files?path=${encodeURIComponent(item.relativePath)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo eliminar');
    }
    showToast(`Archivo "${item.name}" eliminado`);
    await fetchFiles();
  } catch (err) {
    showToast(err.message || 'Error al eliminar archivo', true);
  }
}

/* ==========================================================================
   Lightbox / File Preview Modal
   ========================================================================== */
async function openPreviewModal(item) {
  const modal = document.getElementById('preview-modal');
  const titleEl = document.getElementById('preview-title');
  const subtitleEl = document.getElementById('preview-subtitle');
  const downloadBtn = document.getElementById('preview-download-btn');
  const openRawBtn = document.getElementById('preview-open-raw');
  const contentEl = document.getElementById('preview-content');

  if (!modal || !contentEl) return;

  state.currentPreviewIndex = state.previewableFiles.findIndex(
    (f) => f.relativePath === item.relativePath
  );

  titleEl.textContent = item.name;
  subtitleEl.textContent = `${formatBytes(item.size)}${item.mtime ? ' · ' + formatDate(item.mtime) : ''}`;
  downloadBtn.href = item.downloadUrl;
  downloadBtn.setAttribute('download', item.name);
  openRawBtn.href = item.url;

  contentEl.innerHTML = '';

  if (item.category === 'image') {
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.name;
    contentEl.appendChild(img);
  } else if (item.category === 'video') {
    const video = document.createElement('video');
    video.src = item.url;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    contentEl.appendChild(video);
  } else if (item.category === 'audio') {
    const box = document.createElement('div');
    box.className = 'preview-audio-box';
    box.innerHTML = `
      <div class="file-type-icon cat-audio" style="width:4rem;height:4rem;">
        ${getCategorySvg('audio')}
      </div>
      <strong>${item.name}</strong>
    `;
    const audio = document.createElement('audio');
    audio.src = item.url;
    audio.controls = true;
    audio.autoplay = true;
    box.appendChild(audio);
    contentEl.appendChild(box);
  } else if (
    item.category === 'code' ||
    ['txt', 'md', 'csv', 'log', 'json', 'xml', 'yml', 'yaml'].includes(item.ext)
  ) {
    const pre = document.createElement('pre');
    pre.className = 'preview-text-box';
    pre.textContent = 'Cargando contenido del archivo...';
    contentEl.appendChild(pre);

    try {
      const res = await fetch(item.url);
      const text = await res.text();
      pre.textContent = text.slice(0, 100000);
    } catch {
      pre.textContent = 'No se pudo previsualizar el texto de este archivo.';
    }
  } else if (item.ext === 'pdf') {
    const iframe = document.createElement('iframe');
    iframe.src = item.url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '0.5rem';
    contentEl.appendChild(iframe);
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'preview-audio-box';
    fallback.innerHTML = `
      <div class="file-type-icon cat-${item.category}" style="width:4rem;height:4rem;">
        ${getCategorySvg(item.category)}
      </div>
      <div>
        <h4>${item.name}</h4>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-top:0.35rem;">
          Tamaño: ${formatBytes(item.size)}
        </p>
      </div>
      <a href="${item.downloadUrl}" download="${item.name}" class="btn btn-primary">
        Descargar en este dispositivo
      </a>
    `;
    contentEl.appendChild(fallback);
  }

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closePreviewModal() {
  const modal = document.getElementById('preview-modal');
  const contentEl = document.getElementById('preview-content');
  if (!modal) return;
  if (contentEl) contentEl.innerHTML = '';
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function navigatePreview(delta) {
  if (state.previewableFiles.length === 0 || state.currentPreviewIndex === -1) return;
  const total = state.previewableFiles.length;
  const nextIndex = (state.currentPreviewIndex + delta + total) % total;
  openPreviewModal(state.previewableFiles[nextIndex]);
}

/* ==========================================================================
   File Upload with Live Progress (Single & Multiple Files)
   ========================================================================== */
function uploadFilesWithProgress(fileList) {
  if (!fileList || fileList.length === 0) return;

  const porcentaje = document.getElementById('porcentaje');
  const progressNumbers = document.getElementById('progress-Numbers');
  const progressFill = document.getElementById('progress-bar-fill');
  const progressMeta = document.getElementById('progress-meta');
  const orbita = document.getElementById('orbita');

  const formData = new FormData();
  let totalSize = 0;
  for (let i = 0; i < fileList.length; i++) {
    formData.append('file', fileList[i]);
    totalSize += fileList[i].size;
  }

  const labelText = fileList.length === 1
    ? `Subiendo "${fileList[0].name}"...`
    : `Subiendo ${fileList.length} archivos...`;

  if (porcentaje) porcentaje.textContent = labelText;
  if (progressNumbers) progressNumbers.textContent = '0%';
  if (progressFill) progressFill.style.width = '0%';
  if (orbita) orbita.classList.add('active');

  const startTime = Date.now();
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/upload', true);

  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable) return;
    const percent = Math.round((event.loaded / event.total) * 100);
    const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.1);
    const speedBps = event.loaded / elapsedSec;

    if (progressNumbers) progressNumbers.textContent = `${percent}%`;
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressMeta) {
      progressMeta.innerHTML = `
        <span>${formatBytes(event.loaded)} / ${formatBytes(event.total || totalSize)}</span>
        <span>${formatBytes(speedBps)}/s</span>
      `;
    }
  };

  xhr.onload = async () => {
    if (orbita) orbita.classList.remove('active');
    try {
      const result = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 200 && xhr.status < 300 && result.success) {
        if (porcentaje) porcentaje.textContent = result.message || 'Archivo subido con éxito';
        if (progressNumbers) progressNumbers.textContent = '100%';
        if (progressFill) progressFill.style.width = '100%';
        showToast(result.message || 'Subida completada');
        if (state.scope !== 'shared') {
          setScope('shared');
        } else {
          await fetchFiles();
        }
      } else {
        throw new Error(result.message || 'Error al subir archivo');
      }
    } catch (err) {
      if (porcentaje) porcentaje.textContent = err.message || 'Error en la subida';
      showToast(err.message || 'Error al subir el archivo', true);
    }
  };

  xhr.onerror = () => {
    if (orbita) orbita.classList.remove('active');
    if (porcentaje) porcentaje.textContent = 'Error de conexión al subir el archivo';
    showToast('Error de red durante la subida', true);
  };

  xhr.send(formData);
}

function setScope(newScope) {
  state.scope = newScope;
  state.currentDir = '';
  document.querySelectorAll('.scope-tab').forEach((btn) => {
    const active = btn.dataset.scope === newScope;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  fetchFiles();
}

/* ==========================================================================
   Event Listeners & Initialization
   ========================================================================== */
function initEvents() {
  const fileInput = document.getElementById('file-input');
  const dropzone = document.getElementById('dropzone');
  const windowOverlay = document.getElementById('window-drop-overlay');

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        uploadFilesWithProgress(e.target.files);
        e.target.value = '';
      }
    });
  }

  if (dropzone) {
    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-active');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        uploadFilesWithProgress(files);
      }
    });
  }

  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      dragDepth++;
      if (windowOverlay) windowOverlay.classList.add('active');
    }
  });

  window.addEventListener('dragover', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
    }
  });

  window.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0 && windowOverlay) {
      windowOverlay.classList.remove('active');
    }
  });

  window.addEventListener('drop', (e) => {
    dragDepth = 0;
    if (windowOverlay) windowOverlay.classList.remove('active');
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      uploadFilesWithProgress(e.dataTransfer.files);
    }
  });

  // Scope Tabs
  document.querySelectorAll('.scope-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetScope = tab.dataset.scope;
      if (targetScope && targetScope !== state.scope) {
        setScope(targetScope);
      }
    });
  });

  // Category Pills
  document.querySelectorAll('#category-pills .pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#category-pills .pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.category = pill.dataset.category || 'all';
      applyFiltersAndRender();
    });
  });

  // Search & Sort
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value || '';
      applyFiltersAndRender();
    });
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value || 'newest';
      applyFiltersAndRender();
    });
  }

  // View Toggle
  const gridBtn = document.getElementById('view-grid-btn');
  const listBtn = document.getElementById('view-list-btn');
  if (gridBtn && listBtn) {
    gridBtn.addEventListener('click', () => {
      state.viewMode = 'grid';
      gridBtn.classList.add('active');
      listBtn.classList.remove('active');
      renderFilesGrid();
    });
    listBtn.addEventListener('click', () => {
      state.viewMode = 'list';
      listBtn.classList.add('active');
      gridBtn.classList.remove('active');
      renderFilesGrid();
    });
  }

  // Refresh Button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchFiles();
      showToast('Lista de archivos actualizada');
    });
  }

  // Copy LAN URL Buttons
  const copyLanBtn = document.getElementById('copy-lan-btn');
  if (copyLanBtn) {
    copyLanBtn.addEventListener('click', async () => {
      const ok = await copyTextToClipboard(state.serverUrl);
      if (ok) showToast(`Enlace copiado: ${state.serverUrl}`);
    });
  }

  const modalCopyBtn = document.getElementById('modal-copy-url-btn');
  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', async () => {
      const ok = await copyTextToClipboard(state.serverUrl);
      if (ok) showToast(`Enlace copiado: ${state.serverUrl}`);
    });
  }

  // Connect Modal
  const connectBtn = document.getElementById('connect-info-btn');
  const connectModal = document.getElementById('connect-modal');
  const closeConnectBtn = document.getElementById('close-connect-btn');

  if (connectBtn && connectModal) {
    connectBtn.addEventListener('click', () => {
      connectModal.hidden = false;
      connectModal.setAttribute('aria-hidden', 'false');
    });
  }
  if (closeConnectBtn && connectModal) {
    closeConnectBtn.addEventListener('click', () => {
      connectModal.hidden = true;
      connectModal.setAttribute('aria-hidden', 'true');
    });
    connectModal.addEventListener('click', (e) => {
      if (e.target === connectModal) {
        connectModal.hidden = true;
        connectModal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // Preview Modal Controls
  const closePreviewBtn = document.getElementById('close-preview-btn');
  const previewModal = document.getElementById('preview-modal');
  const prevBtn = document.getElementById('preview-prev-btn');
  const nextBtn = document.getElementById('preview-next-btn');

  if (closePreviewBtn) closePreviewBtn.addEventListener('click', closePreviewModal);
  if (prevBtn) prevBtn.addEventListener('click', () => navigatePreview(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigatePreview(1));
  if (previewModal) {
    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal || e.target.id === 'preview-stage') {
        closePreviewModal();
      }
    });
  }

  // Touch Swipe in Lightbox for Mobile / Tablet
  const previewStage = document.getElementById('preview-stage');
  let touchStartX = 0;
  if (previewStage) {
    previewStage.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    previewStage.addEventListener('touchend', (e) => {
      const deltaX = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(deltaX) > 50) {
        navigatePreview(deltaX > 0 ? -1 : 1);
      }
    }, { passive: true });
  }

  // Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    const previewOpen = previewModal && !previewModal.hidden;
    if (previewOpen) {
      if (e.key === 'Escape') closePreviewModal();
      else if (e.key === 'ArrowLeft') navigatePreview(-1);
      else if (e.key === 'ArrowRight') navigatePreview(1);
    } else if (connectModal && !connectModal.hidden && e.key === 'Escape') {
      connectModal.hidden = true;
      connectModal.setAttribute('aria-hidden', 'true');
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initEvents();
  fetchServerInfo();
  fetchFiles();
});
