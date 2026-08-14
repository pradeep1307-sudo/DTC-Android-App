const imageExtensions = /\.(jpe?g|png|webp)$/i;
const mediaGroups = {
  missions: { local: 'Local Mission', global: 'Global Missions', discipleship: 'Discipleship Ministries' },
  ministries: { kids: 'Kids Ministry', youth: 'Teen & Young Adult', men: "Men's Ministry", women: "Women's Ministry" },
  'quick-info': { worship: 'Sunday Worship', location: 'Location', call: 'Call Us' }
};
const collectionTypes = Object.keys(mediaGroups);
const state = { project: null, galleryDir: null, upcomingDir: null, backgroundsDir: null, pastorDir: null, collectionDirs: {}, collections: { missions: {}, ministries: {}, 'quick-info': {} }, activeCollection: { missions: 'local', ministries: 'kids' }, activeQuickInfo: 'worship', albums: [], eventImages: [], eventsData: [], backgroundImage: null, backgroundImages: [], pastorImages: [], activeAlbum: null, objectUrls: [] };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const statusNode = $('[data-admin-status]');
const projectButton = $('[data-select-project]');
const confirmDialog = $('[data-confirm-dialog]');
let resolveConfirmation = null;
const finishConfirmation = (confirmed) => {
  if (!resolveConfirmation) return;
  const resolve = resolveConfirmation;
  resolveConfirmation = null;
  if (confirmDialog.open) confirmDialog.close();
  resolve(confirmed);
};
const confirmDeletion = (title, message) => new Promise((resolve) => {
  if (!confirmDialog) { resolve(window.confirm(`${title}\n\n${message}`)); return; }
  if (resolveConfirmation) finishConfirmation(false);
  resolveConfirmation = resolve;
  $('[data-confirm-title]').textContent = title;
  $('[data-confirm-message]').textContent = message;
  confirmDialog.showModal();
  $('[data-confirm-delete]').focus();
});
$('[data-confirm-cancel]')?.addEventListener('click', () => finishConfirmation(false));
$('[data-confirm-delete]')?.addEventListener('click', () => finishConfirmation(true));
confirmDialog?.addEventListener('cancel', (event) => { event.preventDefault(); finishConfirmation(false); });
confirmDialog?.addEventListener('click', (event) => { if (event.target === confirmDialog) finishConfirmation(false); });
const adminDatabaseName = 'dtc-media-manager';
const adminStoreName = 'settings';

const openAdminDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(adminDatabaseName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(adminStoreName);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const readSavedProject = async () => {
  try {
    const database = await openAdminDatabase();
    return await new Promise((resolve, reject) => {
      const request = database.transaction(adminStoreName).objectStore(adminStoreName).get('project');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch { return null; }
};
const saveProject = async (project) => {
  try {
    const database = await openAdminDatabase();
    await new Promise((resolve, reject) => {
      const request = database.transaction(adminStoreName, 'readwrite').objectStore(adminStoreName).put(project, 'project');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch { /* The admin still works for this session if storage is unavailable. */ }
};
const hasProjectPermission = async (project, requestAccess = false) => {
  const options = { mode: 'readwrite' };
  if (await project.queryPermission(options) === 'granted') return true;
  return requestAccess && await project.requestPermission(options) === 'granted';
};
const notifyPublishedMedia = (type) => {
  const message = { type, updatedAt: Date.now() };
  localStorage.setItem('dtc-media-update', JSON.stringify(message));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('dtc-media-updates');
    channel.postMessage(message);
    channel.close();
  }
};
const bindDragSorting = (container, selector, onReorder) => {
  let sourceIndex = -1;
  const items = $$(selector, container);
  items.forEach((item, index) => {
    item.draggable = Boolean(state.project);
    if (!state.project) return;
    item.dataset.sortIndex = index;
    item.title = item.title || 'Drag to change order';
    item.addEventListener('dragstart', (event) => {
      sourceIndex = index;
      item.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });
    item.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      items.forEach((entry) => entry.classList.remove('is-drag-target'));
      if (index !== sourceIndex) item.classList.add('is-drag-target');
    });
    item.addEventListener('drop', async (event) => {
      event.preventDefault();
      const from = sourceIndex >= 0 ? sourceIndex : Number(event.dataTransfer.getData('text/plain'));
      items.forEach((entry) => entry.classList.remove('is-drag-target', 'is-dragging'));
      if (Number.isInteger(from) && from !== index) await onReorder(from, index);
      sourceIndex = -1;
    });
    item.addEventListener('dragend', () => {
      sourceIndex = -1;
      items.forEach((entry) => entry.classList.remove('is-drag-target', 'is-dragging'));
    });
  });
};
const moveItem = (collection, from, to) => {
  const [item] = collection.splice(from, 1);
  collection.splice(to, 0, item);
};

const setStatus = (message, detail = '', type = '') => {
  statusNode.className = `admin-status${type ? ` is-${type}` : ''}`;
  $('strong', statusNode).textContent = message;
  $('small', statusNode).textContent = detail;
};
const uploadProgress = $('[data-upload-progress]');
let uploadProgressTimer;
const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 1) return 'less than a second';
  if (seconds < 60) return `${Math.ceil(seconds)} sec`;
  return `${Math.floor(seconds / 60)} min ${Math.ceil(seconds % 60)} sec`;
};
const beginUploadProgress = (title) => {
  window.clearTimeout(uploadProgressTimer);
  uploadProgress.hidden = false;
  $('[data-upload-progress-title]').textContent = title;
  $('[data-upload-current-bar]').style.width = '0%';
  $('[data-upload-overall-bar]').style.width = '0%';
  $('[data-upload-overall-percent]').textContent = '0%';
  const startedAt = performance.now();
  return ({ file, fileIndex, totalFiles, fileBytes, completedBytes, totalBytes }) => {
    const currentPercent = file.size ? Math.round((fileBytes / file.size) * 100) : 100;
    const overallPercent = totalBytes ? Math.round((completedBytes / totalBytes) * 100) : 100;
    const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, .001);
    const bytesPerSecond = completedBytes / elapsedSeconds;
    const remainingSeconds = bytesPerSecond ? (totalBytes - completedBytes) / bytesPerSecond : 0;
    const speed = bytesPerSecond >= 1048576 ? `${(bytesPerSecond / 1048576).toFixed(1)} MB/s` : `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
    $('[data-upload-current-detail]').textContent = `${file.name} · ${currentPercent}%`;
    $('[data-upload-overall-detail]').textContent = `${fileIndex + 1} of ${totalFiles} images`;
    $('[data-upload-current-bar]').style.width = `${currentPercent}%`;
    $('[data-upload-overall-bar]').style.width = `${overallPercent}%`;
    $('[data-upload-current-progress]').setAttribute('aria-valuenow', String(currentPercent));
    $('[data-upload-overall-progress]').setAttribute('aria-valuenow', String(overallPercent));
    $('[data-upload-overall-percent]').textContent = `${overallPercent}%`;
    $('[data-upload-progress-meta]').textContent = `${speed} · ${formatDuration(elapsedSeconds)} elapsed · about ${formatDuration(remainingSeconds)} remaining`;
  };
};
const finishUploadProgress = (message) => {
  $('[data-upload-progress-title]').textContent = message;
  $('[data-upload-current-bar]').style.width = '100%';
  $('[data-upload-overall-bar]').style.width = '100%';
  $('[data-upload-overall-percent]').textContent = '100%';
  $('[data-upload-current-progress]').setAttribute('aria-valuenow', '100');
  $('[data-upload-overall-progress]').setAttribute('aria-valuenow', '100');
  $('[data-upload-progress-meta]').textContent = 'Upload complete · website manifest updated';
  uploadProgressTimer = window.setTimeout(() => { uploadProgress.hidden = true; }, 2200);
};
const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const displayName = (slug) => slug.split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
const encodePath = (...segments) => segments.map((segment) => encodeURIComponent(segment).replace(/%2F/gi, '/')).join('/');
const imageEntries = async (directory) => {
  const entries = [];
  for await (const entry of directory.values()) if (entry.kind === 'file' && imageExtensions.test(entry.name)) entries.push(entry);
  return entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
};
const applySavedOrder = (images, paths = []) => {
  const names = paths.map((path) => decodeURIComponent(path).split('/').pop());
  const rank = (image) => { const index = names.indexOf(image.name); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
  images.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, undefined, { numeric: true }));
};
const readJson = async (directory, name) => {
  try { const handle = await directory.getFileHandle(name); return JSON.parse(await (await handle.getFile()).text()); } catch { return null; }
};
const writeJson = async (directory, name, data) => {
  const handle = await directory.getFileHandle(name, { create: true });
  const writer = await handle.createWritable();
  await writer.write(`${JSON.stringify(data, null, 2)}\n`);
  await writer.close();
};
const uniqueName = async (directory, original) => {
  const clean = original.replace(/[^a-zA-Z0-9._() -]/g, '-').replace(/\s+/g, ' ').trim() || `church-photo-${Date.now()}.jpg`;
  const dot = clean.lastIndexOf('.');
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const extension = dot > 0 ? clean.slice(dot) : '';
  let candidate = clean;
  let counter = 2;
  while (true) { try { await directory.getFileHandle(candidate); candidate = `${base}-${counter}${extension}`; counter += 1; } catch { return candidate; } }
};
const copyFiles = async (directory, files, onProgress = () => {}) => {
  const images = [...files].filter((file) => imageExtensions.test(file.name));
  const totalBytes = images.reduce((total, file) => total + file.size, 0);
  let completedBytes = 0;
  const uploadedNames = [];
  const chunkSize = 512 * 1024;
  for (let fileIndex = 0; fileIndex < images.length; fileIndex += 1) {
    const file = images[fileIndex];
    const name = await uniqueName(directory, file.name);
    const target = await directory.getFileHandle(name, { create: true });
    const writer = await target.createWritable();
    let fileBytes = 0;
    while (fileBytes < file.size) {
      const chunk = file.slice(fileBytes, Math.min(file.size, fileBytes + chunkSize));
      await writer.write(chunk);
      fileBytes += chunk.size;
      onProgress({ file, fileIndex, totalFiles: images.length, fileBytes, completedBytes: completedBytes + fileBytes, totalBytes });
    }
    await writer.close();
    completedBytes += file.size;
    uploadedNames.push(name);
  }
  return uploadedNames;
};
const clearObjectUrls = () => { state.objectUrls.forEach(URL.revokeObjectURL); state.objectUrls = []; };
const previewUrl = async (handle) => { const url = URL.createObjectURL(await handle.getFile()); state.objectUrls.push(url); return url; };
const formatBytes = (bytes) => bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
const publishedImage = (path) => ({
  name: decodeURIComponent(path).split('/').pop(),
  path,
  url: new URL(`../${path}`, window.location.href).href,
  readOnly: true
});

const loadPublishedMedia = async () => {
  const cacheKey = Date.now();
  const loadManifest = async (path, fallback) => {
    try {
      const response = await fetch(`${path}?v=${cacheKey}`, { cache: 'no-store' });
      return response.ok ? await response.json() : fallback;
    } catch { return fallback; }
  };
  const [galleryManifest, eventManifest, backgroundManifest, pastorManifest, missionManifest, ministryManifest, quickInfoManifest] = await Promise.all([
    loadManifest('../assets/gallery/manifest.json', []),
    loadManifest('../assets/upcoming/manifest.json', []),
    loadManifest('../assets/backgrounds/manifest.json', {}),
    loadManifest('../assets/pastor/manifest.json', []),
    loadManifest('../assets/missions/manifest.json', {}),
    loadManifest('../assets/ministries/manifest.json', {}),
    loadManifest('../assets/quick-info/manifest.json', {})
  ]);
  if (state.project) return;
  try {
    state.albums = Array.isArray(galleryManifest) ? galleryManifest.map((album) => ({
      slug: album.slug,
      name: album.name || displayName(album.slug),
      images: Array.isArray(album.images) ? album.images.map(publishedImage) : [],
      readOnly: true
    })) : [];
    state.eventImages = Array.isArray(eventManifest) ? eventManifest.map(publishedImage) : [];
    state.backgroundImage = backgroundManifest?.homeHero ? publishedImage(backgroundManifest.homeHero) : null;
    state.backgroundImages = Array.isArray(backgroundManifest?.homeHeaderSlides) ? backgroundManifest.homeHeaderSlides.map(publishedImage) : [];
    state.pastorImages = Array.isArray(pastorManifest) ? pastorManifest.map(publishedImage) : [];
    for (const type of collectionTypes) {
      const manifest = type === 'missions' ? missionManifest : type === 'ministries' ? ministryManifest : quickInfoManifest;
      for (const key of Object.keys(mediaGroups[type])) state.collections[type][key] = Array.isArray(manifest?.[key]) ? manifest[key].map(publishedImage) : [];
    }
    state.activeAlbum = state.albums[0] || null;
    renderAlbums();
    await Promise.all([renderGallery(), renderEvents(), renderBackground(), renderPastor(), ...collectionTypes.map(renderCollections)]);
    const posterCount = state.eventImages.length;
    setStatus('Existing media loaded', `${posterCount} event poster${posterCount === 1 ? '' : 's'} available · select the project folder to make changes.`, 'ready');
  } catch (error) {
    setStatus('Some previews could not be displayed', 'Event, gallery, and background media now load independently.', 'error');
  }
};

const saveGalleryManifest = async () => {
  const manifest = state.albums.map((album) => ({ slug: album.slug, name: album.name, images: album.images.map((image) => encodePath('assets', 'gallery', album.slug, image.name)) }));
  await writeJson(state.galleryDir, 'manifest.json', manifest);
};
const saveEventManifest = async () => {
  await writeJson(state.upcomingDir, 'manifest.json', state.eventImages.map((image) => encodePath('assets', 'upcoming', image.name)));
};
const saveBackgroundManifest = async () => {
  const existing = await readJson(state.backgroundsDir, 'manifest.json') || {};
  await writeJson(state.backgroundsDir, 'manifest.json', {
    ...existing,
    homeHero: state.backgroundImage ? encodePath('assets', 'backgrounds', state.backgroundImage.name) : existing.homeHero,
    homeHeaderSlides: state.backgroundImages.map((image) => encodePath('assets', 'backgrounds', image.name))
  });
};
const savePastorManifest = async () => {
  await writeJson(state.pastorDir, 'manifest.json', state.pastorImages.map((image) => encodePath('assets', 'pastor', image.name)));
};
const saveCollectionManifest = async (type) => {
  const manifest = {};
  for (const key of Object.keys(mediaGroups[type])) manifest[key] = state.collections[type][key].map((image) => image.path || encodePath('assets', type, key, image.name));
  await writeJson(state.collectionDirs[type], 'manifest.json', manifest);
};
const loadMedia = async () => {
  clearObjectUrls();
  const assets = await state.project.getDirectoryHandle('assets');
  state.galleryDir = await assets.getDirectoryHandle('gallery', { create: true });
  state.upcomingDir = await assets.getDirectoryHandle('upcoming', { create: true });
  state.backgroundsDir = await assets.getDirectoryHandle('backgrounds', { create: true });
  state.pastorDir = await assets.getDirectoryHandle('pastor', { create: true });
  for (const type of collectionTypes) {
    state.collectionDirs[type] = await assets.getDirectoryHandle(type, { create: true });
    const manifest = await readJson(state.collectionDirs[type], 'manifest.json') || {};
    for (const key of Object.keys(mediaGroups[type])) {
      const directory = await state.collectionDirs[type].getDirectoryHandle(key, { create: true });
      const images = await imageEntries(directory);
      const localNames = new Set(images.map((image) => image.name));
      const externalImages = Array.isArray(manifest[key]) ? manifest[key].filter((path) => !localNames.has(decodeURIComponent(path).split('/').pop())).map(publishedImage) : [];
      images.push(...externalImages);
      if (Array.isArray(manifest[key])) applySavedOrder(images, manifest[key]);
      state.collections[type][key] = images;
    }
  }
  const savedGallery = await readJson(state.galleryDir, 'manifest.json');
  const names = new Map(Array.isArray(savedGallery) ? savedGallery.map((album) => [album.slug, album]) : []);
  state.albums = [];
  for await (const entry of state.galleryDir.values()) {
    if (entry.kind !== 'directory') continue;
    const images = await imageEntries(entry);
    const saved = names.get(entry.name);
    if (saved?.images?.length) applySavedOrder(images, saved.images);
    state.albums.push({ slug: entry.name, name: saved?.name || displayName(entry.name), handle: entry, images });
  }
  const albumOrder = Array.isArray(savedGallery) ? savedGallery.map((album) => album.slug) : [];
  state.albums.sort((a, b) => {
    const aIndex = albumOrder.indexOf(a.slug);
    const bIndex = albumOrder.indexOf(b.slug);
    if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
    return a.name.localeCompare(b.name);
  });
  state.eventImages = await imageEntries(state.upcomingDir);
  const savedEvents = await readJson(state.upcomingDir, 'manifest.json');
  const savedEventsData = await readJson(state.upcomingDir, 'events.json');
  state.eventsData = Array.isArray(savedEventsData) ? savedEventsData : [];
  if (Array.isArray(savedEvents)) applySavedOrder(state.eventImages, savedEvents);
  const backgroundManifest = await readJson(state.backgroundsDir, 'manifest.json');
  if (backgroundManifest?.homeHero) {
    const backgroundName = decodeURIComponent(backgroundManifest.homeHero).split('/').pop();
    try { state.backgroundImage = await state.backgroundsDir.getFileHandle(backgroundName); } catch { state.backgroundImage = null; }
  }
  state.backgroundImages = [];
  if (Array.isArray(backgroundManifest?.homeHeaderSlides)) {
    for (const path of backgroundManifest.homeHeaderSlides) {
      const name = decodeURIComponent(path).split('/').pop();
      try { state.backgroundImages.push(await state.backgroundsDir.getFileHandle(name)); } catch { /* Skip missing slide files. */ }
    }
  }
  state.pastorImages = await imageEntries(state.pastorDir);
  const pastorManifest = await readJson(state.pastorDir, 'manifest.json');
  if (Array.isArray(pastorManifest)) applySavedOrder(state.pastorImages, pastorManifest);
  if (state.activeAlbum) state.activeAlbum = state.albums.find((album) => album.slug === state.activeAlbum.slug) || null;
  await Promise.all([saveGalleryManifest(), saveEventManifest(), savePastorManifest(), ...collectionTypes.map(saveCollectionManifest)]);
  renderAlbums(); renderGallery(); renderEvents(); renderBackground(); renderPastor(); collectionTypes.forEach(renderCollections);
};

const connectProject = async (project, remember = true) => {
  await project.getFileHandle('index.html');
  await project.getDirectoryHandle('assets');
  state.project = project;
  if (remember) await saveProject(project);
  await loadMedia();
  projectButton.textContent = 'Project Connected';
  setStatus('Project connected', `${project.name} · direct publishing is ready`, 'ready');
};

const restoreSavedProject = async () => {
  if (!window.showDirectoryPicker || !window.indexedDB) return;
  const project = await readSavedProject();
  if (!project) return;
  try {
    if (await hasProjectPermission(project)) {
      await connectProject(project, false);
    } else {
      projectButton.textContent = 'Reconnect Project Folder';
      setStatus('Project folder remembered', 'Select Reconnect once to restore write access.', 'ready');
    }
  } catch {
    projectButton.textContent = 'Select Project Folder';
  }
};

const renderAlbums = () => {
  $('[data-album-total]').textContent = state.albums.length;
  const list = $('[data-album-list]');
  if (!state.albums.length) { list.innerHTML = '<p class="admin-empty">No albums yet. Create your first album above.</p>'; return; }
  list.innerHTML = state.albums.map((album) => `<div class="admin-album-row${state.project ? '' : ' is-readonly'}"><button class="admin-album-button${state.activeAlbum?.slug === album.slug ? ' is-active' : ''}" type="button" data-album="${album.slug}"><strong>${album.name}</strong><span>${album.images.length} photo${album.images.length === 1 ? '' : 's'}</span></button>${state.project ? `<button class="admin-album-delete" type="button" data-delete-album="${album.slug}" aria-label="Delete ${album.name} album" title="Delete album">×</button>` : ''}</div>`).join('');
  $$('[data-album]', list).forEach((button) => button.addEventListener('click', () => { state.activeAlbum = state.albums.find((album) => album.slug === button.dataset.album); renderAlbums(); renderGallery(); }));
  $$('[data-delete-album]', list).forEach((button) => button.addEventListener('click', () => deleteAlbum(button.dataset.deleteAlbum)));
  bindDragSorting(list, '.admin-album-row', async (from, to) => {
    moveItem(state.albums, from, to);
    await saveGalleryManifest();
    renderAlbums();
    notifyPublishedMedia('gallery');
    setStatus('Album order updated', 'The Gallery page has been refreshed with the new order.', 'ready');
  });
};
const deleteAlbum = async (slug) => {
  const album = state.albums.find((item) => item.slug === slug);
  if (!album || !state.galleryDir) {
    setStatus('Connect the project first', 'Write access is required to delete an album.', 'error');
    return;
  }
  const photoCount = album.images.length;
  const message = `Delete “${album.name}” and ${photoCount} photo${photoCount === 1 ? '' : 's'}? This permanently removes the album folder and cannot be undone.`;
  if (!await confirmDeletion(`Delete ${album.name}?`, message)) return;
  try {
    await state.galleryDir.removeEntry(album.slug, { recursive: true });
    state.albums = state.albums.filter((item) => item.slug !== slug);
    if (state.activeAlbum?.slug === slug) state.activeAlbum = state.albums[0] || null;
    await saveGalleryManifest();
    renderAlbums();
    await renderGallery();
    notifyPublishedMedia('gallery');
    setStatus('Album deleted', `${album.name} and its photos were removed from the website.`, 'ready');
  } catch (error) {
    setStatus('Album could not be deleted', 'Close any program using its files, then try again.', 'error');
  }
};
const emptyState = (title, copy, icon = '▧') => `<div class="admin-empty-state"><span aria-hidden="true">${icon}</span><h3>${title}</h3><p>${copy}</p></div>`;
const createPhotoCard = async (image, index, total, context) => {
  const template = $('#admin-photo-template').content.cloneNode(true);
  const card = $('.admin-photo', template);
  card.dataset.sortablePhoto = context;
  const file = image.readOnly ? null : await image.getFile();
  $('img', card).src = image.readOnly ? image.url : await previewUrl(image);
  $('img', card).loading = 'lazy';
  $('img', card).decoding = 'async';
  $('img', card).alt = `${context === 'gallery' ? 'Gallery photo' : context === 'events' ? 'Event poster' : context === 'backgrounds' ? 'Homepage header background' : context === 'pastor' ? 'Pastor photo' : 'Page carousel photo'} preview: ${image.name}`;
  $('.admin-photo-info strong', card).textContent = image.name;
  $('.admin-photo-info small', card).textContent = `${file ? `${formatBytes(file.size)} · ` : ''}${index + 1} of ${total}${image.readOnly ? ' · Preview' : ''}`;
  if (index === 0) card.classList.add('is-cover');
  if (context === 'backgrounds' || context === 'pastor' || context.includes(':')) {
    $('.admin-cover-badge', card).textContent = 'First slide';
    $('[data-action="cover"]', card).textContent = 'Make first';
  }
  const actions = $('.admin-photo-actions', card);
  const canEdit = Boolean(state.project && (!image.readOnly || context.includes(':')));
  actions.hidden = !canEdit;
  if (canEdit) {
    $('[data-action="cover"]', card).hidden = index === 0;
    $('[data-action="up"]', card).disabled = index === 0;
    $('[data-action="down"]', card).disabled = index === total - 1;
    $$('[data-action]', card).forEach((button) => button.addEventListener('click', () => handlePhotoAction(context, image, button.dataset.action)));
  }
  return card;
};
const renderGallery = async () => {
  const grid = $('[data-gallery-grid]');
  const upload = $('[data-gallery-upload]');
  const canEditAlbum = Boolean(state.project && state.activeAlbum);
  upload.disabled = !canEditAlbum;
  upload.closest('.admin-upload').classList.toggle('is-disabled', !canEditAlbum);
  $('[data-selected-album]').textContent = state.activeAlbum?.name || 'No album selected';
  $('[data-selected-summary]').textContent = state.activeAlbum ? `${state.activeAlbum.images.length} photo${state.activeAlbum.images.length === 1 ? '' : 's'} · drag to reorder · first image is the cover` : 'Choose an album from the left.';
  if (!state.activeAlbum) { grid.innerHTML = emptyState('Your album photos will appear here.', 'Choose or create an album, then add JPG, PNG, or WebP photos.'); return; }
  if (!state.activeAlbum.images.length) { grid.innerHTML = emptyState('This album is ready for photos.', 'Select “Add Photos” to publish the first images.'); return; }
  grid.innerHTML = '';
  for (let index = 0; index < state.activeAlbum.images.length; index += 1) grid.append(await createPhotoCard(state.activeAlbum.images[index], index, state.activeAlbum.images.length, 'gallery'));
  bindDragSorting(grid, '[data-sortable-photo="gallery"]', async (from, to) => {
    moveItem(state.activeAlbum.images, from, to);
    await saveGalleryManifest();
    clearObjectUrls();
    await renderGallery();
    renderAlbums();
    notifyPublishedMedia('gallery');
    setStatus('Photo order updated', 'The first photo is the album cover.', 'ready');
  });
};
const renderEvents = async () => {
  const grid = $('[data-event-grid]');
  const upload = $('[data-event-upload]');
  upload.disabled = !state.project;
  upload.closest('.admin-upload').classList.toggle('is-disabled', !state.project);
  if (!state.eventImages.length) { grid.innerHTML = emptyState('No event posters are published.', 'Add posters to build the Upcoming Events carousel.', '◇'); return; }
  grid.innerHTML = '';
  for (let index = 0; index < state.eventImages.length; index += 1) grid.append(await createPhotoCard(state.eventImages[index], index, state.eventImages.length, 'events'));
  bindDragSorting(grid, '[data-sortable-photo="events"]', async (from, to) => {
    moveItem(state.eventImages, from, to);
    await saveEventManifest();
    clearObjectUrls();
    await renderEvents();
    notifyPublishedMedia('events');
    setStatus('Event poster order updated', 'Open event pages have been refreshed automatically.', 'ready');
  });
};
const renderBackground = async () => {
  const preview = $('[data-background-preview]');
  const upload = $('[data-background-upload]');
  $('[data-background-total]').textContent = state.backgroundImages.length;
  upload.disabled = !state.project;
  upload.closest('.admin-upload').classList.toggle('is-disabled', !state.project);
  if (state.backgroundImages.length) {
    preview.innerHTML = '';
    for (let index = 0; index < state.backgroundImages.length; index += 1) preview.append(await createPhotoCard(state.backgroundImages[index], index, state.backgroundImages.length, 'backgrounds'));
    bindDragSorting(preview, '[data-sortable-photo="backgrounds"]', async (from, to) => {
      moveItem(state.backgroundImages, from, to);
      await saveBackgroundManifest();
      clearObjectUrls();
      await renderBackground();
      notifyPublishedMedia('background');
      setStatus('Header background order updated', 'The homepage rotation now follows this order.', 'ready');
    });
    return;
  }
  if (!state.backgroundImage) {
    preview.innerHTML = emptyState('No homepage background is published.', 'Connect the project and select “Replace Background.”', '◇');
    return;
  }
  const file = state.backgroundImage.readOnly ? null : await state.backgroundImage.getFile();
  const url = state.backgroundImage.readOnly ? state.backgroundImage.url : await previewUrl(state.backgroundImage);
  preview.innerHTML = `<img src="${url}" alt="Current homepage church-family background"><div class="admin-background-preview-meta"><strong>${state.backgroundImage.name}</strong><small>${file ? formatBytes(file.size) : 'Published image'}</small></div>`;
};
const renderPastor = async () => {
  const grid = $('[data-pastor-grid]');
  const upload = $('[data-pastor-upload]');
  $('[data-pastor-total]').textContent = state.pastorImages.length;
  upload.disabled = !state.project;
  upload.closest('.admin-upload').classList.toggle('is-disabled', !state.project);
  if (!state.pastorImages.length) { grid.innerHTML = emptyState('No pastor photos are published.', 'Connect the project and select Add Pastor Photos.', '◇'); return; }
  grid.innerHTML = '';
  for (let index = 0; index < state.pastorImages.length; index += 1) grid.append(await createPhotoCard(state.pastorImages[index], index, state.pastorImages.length, 'pastor'));
  bindDragSorting(grid, '[data-sortable-photo="pastor"]', async (from, to) => {
    moveItem(state.pastorImages, from, to);
    await savePastorManifest();
    notifyPublishedMedia('pastor');
    clearObjectUrls();
    await renderPastor();
    setStatus('Pastor photo order updated', 'The homepage transition now follows this order.', 'ready');
  });
};
const renderCollections = async (type) => {
  if (type === 'quick-info') { await renderQuickInfoManager(); return; }
  const list = $(`[data-collection-list="${type}"]`);
  const grid = $(`[data-selected-collection-grid="${type}"]`);
  const input = $(`[data-selected-collection-upload="${type}"]`);
  if (!list || !grid || !input) return;
  const key = state.activeCollection[type];
  const images = state.collections[type][key] || [];
  list.innerHTML = Object.entries(mediaGroups[type]).map(([itemKey, label]) => `<button class="admin-album-button${itemKey === key ? ' is-active' : ''}" type="button" data-collection-key="${type}:${itemKey}"><strong>${label}</strong><span>${state.collections[type][itemKey]?.length || 0} photo${state.collections[type][itemKey]?.length === 1 ? '' : 's'}</span></button>`).join('');
  $$('[data-collection-key]', list).forEach((button) => button.addEventListener('click', () => { state.activeCollection[type] = button.dataset.collectionKey.split(':')[1]; renderCollections(type); }));
  $(`[data-collection-title="${type}"]`).textContent = mediaGroups[type][key];
  $(`[data-collection-summary="${type}"]`).textContent = `${images.length} photo${images.length === 1 ? '' : 's'} · drag to reorder · first image appears first`;
  input.disabled = !state.project;
  input.dataset.collectionUpload = `${type}:${key}`;
  input.closest('.admin-upload').classList.toggle('is-disabled', !state.project);
  input.onchange = handleCollectionUpload;
  grid.innerHTML = '';
  if (!images.length) grid.innerHTML = emptyState(`No ${mediaGroups[type][key]} photos yet.`, 'Add multiple photos to start the automatic carousel.', '◇');
  else for (let index = 0; index < images.length; index += 1) grid.append(await createPhotoCard(images[index], index, images.length, `${type}:${key}`));
  bindDragSorting(grid, `[data-sortable-photo="${type}:${key}"]`, async (from, to) => {
    moveItem(images, from, to); await saveCollectionManifest(type); clearObjectUrls(); await renderCollections(type); notifyPublishedMedia(type); setStatus(`${mediaGroups[type][key]} order updated`, 'The public page now follows this image order.', 'ready');
  });
};
const renderQuickInfoManager = async () => {
  const list = $('[data-quick-info-list]');
  const grid = $('[data-quick-info-grid]');
  const input = $('[data-quick-info-upload]');
  if (!list || !grid || !input) return;
  const key = state.activeQuickInfo;
  const images = state.collections['quick-info'][key] || [];
  list.innerHTML = Object.entries(mediaGroups['quick-info']).map(([itemKey, label]) => `<button class="admin-album-button${itemKey === key ? ' is-active' : ''}" type="button" data-quick-info-key="${itemKey}"><strong>${label}</strong><span>${state.collections['quick-info'][itemKey]?.length || 0} photo${state.collections['quick-info'][itemKey]?.length === 1 ? '' : 's'}</span></button>`).join('');
  $$('[data-quick-info-key]', list).forEach((button) => button.addEventListener('click', () => { state.activeQuickInfo = button.dataset.quickInfoKey; renderQuickInfoManager(); }));
  $('[data-quick-info-title]').textContent = mediaGroups['quick-info'][key];
  $('[data-quick-info-summary]').textContent = `${images.length} photo${images.length === 1 ? '' : 's'} · drag to reorder · first image appears first`;
  input.disabled = !state.project;
  input.dataset.collectionUpload = `quick-info:${key}`;
  input.closest('.admin-upload').classList.toggle('is-disabled', !state.project);
  input.onchange = handleCollectionUpload;
  grid.innerHTML = '';
  if (!images.length) grid.innerHTML = emptyState('No photos are published.', 'Add multiple photos to start the automatic carousel.', '◇');
  else for (let index = 0; index < images.length; index += 1) grid.append(await createPhotoCard(images[index], index, images.length, `quick-info:${key}`));
  bindDragSorting(grid, '[data-sortable-photo="quick-info:' + key + '"]', async (from, to) => {
    moveItem(images, from, to); await saveCollectionManifest('quick-info'); clearObjectUrls(); await renderQuickInfoManager(); notifyPublishedMedia('quick-info'); setStatus('Card photo order updated', 'The homepage now follows this image order.', 'ready');
  });
};
const handleCollectionUpload = async (event) => {
  const [type, key] = event.target.dataset.collectionUpload.split(':');
  const files = [...event.target.files].filter((file) => imageExtensions.test(file.name));
  if (!state.collectionDirs[type] || !files.length) return;
  const directory = await state.collectionDirs[type].getDirectoryHandle(key, { create: true });
  setStatus('Adding photos…', 'Upload progress is shown below.');
  const updateProgress = beginUploadProgress(`Publishing ${mediaGroups[type][key]} photos`);
  try {
    const names = await copyFiles(directory, files, updateProgress);
    for (const name of names) state.collections[type][key].push(await directory.getFileHandle(name));
    await saveCollectionManifest(type); event.target.value = ''; clearObjectUrls(); await renderCollections(type); notifyPublishedMedia(type); finishUploadProgress('Carousel photos published'); setStatus('Photos added', `${mediaGroups[type][key]} now includes the new images.`, 'ready');
  } catch { uploadProgress.hidden = true; setStatus('Photo upload failed', 'Check folder access and available disk space, then try again.', 'error'); }
};
const handlePhotoAction = async (context, image, action) => {
  try {
  const [collectionType, collectionKey] = context.split(':');
  const isCollection = Boolean(collectionKey);
  const collection = isCollection ? state.collections[collectionType][collectionKey] : context === 'gallery' ? state.activeAlbum.images : context === 'events' ? state.eventImages : context === 'backgrounds' ? state.backgroundImages : state.pastorImages;
  const directory = isCollection ? await state.collectionDirs[collectionType].getDirectoryHandle(collectionKey) : context === 'gallery' ? state.activeAlbum.handle : context === 'events' ? state.upcomingDir : context === 'backgrounds' ? state.backgroundsDir : state.pastorDir;
  const index = collection.findIndex((entry) => entry === image);
  if (index < 0) { setStatus('Image not found', 'Reload the admin page and try again.', 'error'); return; }
  if (action === 'delete') {
    if ((context === 'backgrounds' || context === 'pastor' || isCollection) && collection.length === 1) {
      setStatus('Keep at least one image', 'Add a replacement photo before deleting the final slide.', 'error');
      return;
    }
    if (!await confirmDeletion(`Delete ${image.name}?`, 'This image will be removed from the website. This action cannot be undone.')) return;
    if (!image.readOnly) await directory.removeEntry(image.name);
    collection.splice(index, 1);
    if (context === 'events') {
      state.eventsData = state.eventsData.filter((event) => decodeURIComponent(event.image || '').split('/').pop() !== image.name);
      await writeJson(state.upcomingDir, 'events.json', state.eventsData);
    }
  } else {
    const target = action === 'cover' ? 0 : action === 'up' ? Math.max(0, index - 1) : Math.min(collection.length - 1, index + 1);
    collection.splice(index, 1); collection.splice(target, 0, image);
  }
  await (isCollection ? saveCollectionManifest(collectionType) : context === 'gallery' ? saveGalleryManifest() : context === 'events' ? saveEventManifest() : context === 'backgrounds' ? saveBackgroundManifest() : savePastorManifest());
  clearObjectUrls(); await (isCollection ? renderCollections(collectionType) : context === 'gallery' ? renderGallery() : context === 'events' ? renderEvents() : context === 'backgrounds' ? renderBackground() : renderPastor()); renderAlbums();
  notifyPublishedMedia(isCollection ? collectionType : context === 'gallery' ? 'gallery' : context === 'events' ? 'events' : context === 'backgrounds' ? 'background' : 'pastor');
  setStatus('Changes saved locally', 'Review the public page before committing and pushing.', 'ready');
  } catch (error) {
    setStatus('Change could not be saved', error?.message || 'Check project access and try again.', 'error');
  }
};

projectButton.addEventListener('click', async () => {
  if (!window.showDirectoryPicker) { setStatus('Browser not supported', 'Open this page in Microsoft Edge or Google Chrome.', 'error'); return; }
  try {
    const rememberedProject = await readSavedProject();
    const project = rememberedProject && await hasProjectPermission(rememberedProject, true)
      ? rememberedProject
      : await window.showDirectoryPicker({ id: 'dtc-project', mode: 'readwrite' });
    await connectProject(project);
    navigator.storage?.persist?.().catch(() => {});
  } catch (error) { if (error.name !== 'AbortError') setStatus('Could not open that folder', 'Choose the DTC App project folder containing index.html.', 'error'); }
});
$('[data-create-album]').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!state.galleryDir) { setStatus('Select the project first', 'The album cannot be created yet.', 'error'); return; }
  const name = new FormData(event.currentTarget).get('albumName').trim(); const slug = slugify(name);
  if (!slug) return;
  if (state.albums.some((album) => album.slug === slug)) { setStatus('Album already exists', 'Choose a different album name.', 'error'); return; }
  const handle = await state.galleryDir.getDirectoryHandle(slug, { create: true });
  state.activeAlbum = { slug, name, handle, images: [] }; state.albums.push(state.activeAlbum); state.albums.sort((a,b) => a.name.localeCompare(b.name));
  await saveGalleryManifest(); event.currentTarget.reset(); renderAlbums(); renderGallery(); notifyPublishedMedia('gallery'); setStatus('Album created', `${name} is ready for photos.`, 'ready');
});
$('[data-gallery-upload]').addEventListener('change', async (event) => {
  if (!state.activeAlbum || !event.target.files.length) return;
  setStatus('Adding photos…', 'Upload progress is shown below.');
  const updateProgress = beginUploadProgress('Publishing gallery photos');
  try {
    await copyFiles(state.activeAlbum.handle, event.target.files, updateProgress);
    event.target.value = '';
    await loadMedia();
    notifyPublishedMedia('gallery');
    finishUploadProgress('Gallery photos published');
    setStatus('Photos added', 'Gallery manifest updated automatically.', 'ready');
  } catch (error) {
    uploadProgress.hidden = true;
    setStatus('Photo upload failed', 'Check folder access and available disk space, then try again.', 'error');
  }
});
$('[data-background-upload]').addEventListener('change', async (event) => {
  const files = [...event.target.files].filter((file) => imageExtensions.test(file.name));
  if (!state.backgroundsDir || !files.length) return;
  setStatus('Publishing background…', 'Upload progress is shown below.');
  const updateProgress = beginUploadProgress('Publishing homepage header backgrounds');
  try {
    const uploadedNames = await copyFiles(state.backgroundsDir, files, updateProgress);
    for (const name of uploadedNames) state.backgroundImages.push(await state.backgroundsDir.getFileHandle(name));
    await saveBackgroundManifest();
    event.target.value = '';
    clearObjectUrls();
    await renderBackground();
    notifyPublishedMedia('background');
    finishUploadProgress('Header backgrounds published');
    setStatus('Backgrounds updated', 'The homepage rotation includes the new images.', 'ready');
  } catch (error) {
    uploadProgress.hidden = true;
    setStatus('Background upload failed', 'Check folder access and available disk space, then try again.', 'error');
  }
});
$('[data-pastor-upload]').addEventListener('change', async (event) => {
  const files = [...event.target.files].filter((file) => imageExtensions.test(file.name));
  if (!state.pastorDir || !files.length) return;
  setStatus('Publishing pastor photos…', 'Upload progress is shown below.');
  const updateProgress = beginUploadProgress('Publishing pastor photos');
  try {
    const uploadedNames = await copyFiles(state.pastorDir, files, updateProgress);
    for (const name of uploadedNames) state.pastorImages.push(await state.pastorDir.getFileHandle(name));
    await savePastorManifest();
    event.target.value = '';
    clearObjectUrls();
    await renderPastor();
    notifyPublishedMedia('pastor');
    finishUploadProgress('Pastor photos published');
    setStatus('Pastor photos updated', 'The homepage transition includes the new photos.', 'ready');
  } catch (error) {
    uploadProgress.hidden = true;
    setStatus('Pastor photo upload failed', 'Check folder access and available disk space, then try again.', 'error');
  }
});
const eventUploadInput = $('[data-event-upload]');
const eventPublishDialog = $('[data-event-publish-dialog]');
const eventPublishForm = $('[data-event-publish-form]');
let pendingEventFiles = [];
const closeEventPublisher = () => {
  pendingEventFiles = [];
  eventUploadInput.value = '';
  eventPublishDialog.close();
};
const showNextEventPublisher = () => {
  if (!pendingEventFiles.length) {
    eventUploadInput.value = '';
    return;
  }
  eventPublishForm.reset();
  $('[data-event-file-name]').textContent = `${pendingEventFiles[0].name} · ${pendingEventFiles.length} poster${pendingEventFiles.length === 1 ? '' : 's'} remaining`;
  if (!eventPublishDialog.open) eventPublishDialog.showModal();
  eventPublishForm.elements.title.focus();
};
eventUploadInput.addEventListener('change', () => {
  if (!state.upcomingDir || !eventUploadInput.files.length) return;
  pendingEventFiles = [...eventUploadInput.files].filter((file) => imageExtensions.test(file.name));
  showNextEventPublisher();
});
eventPublishForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = pendingEventFiles[0];
  if (!file) return;
  const submitButton = $('.admin-event-publish-button', eventPublishForm);
  const formData = new FormData(eventPublishForm);
  const when = String(formData.get('when'));
  const eventDate = new Date(`${when}:00`);
  if (Number.isNaN(eventDate.getTime())) return;
  submitButton.disabled = true;
  setStatus('Publishing event…', 'Poster and event details are being saved.');
  const updateProgress = beginUploadProgress(`Publishing ${file.name}`);
  try {
    const [uploadedName] = await copyFiles(state.upcomingDir, [file], updateProgress);
    const title = String(formData.get('title')).trim();
    const date = when.slice(0, 10);
    const time = eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const dateLabel = `${eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${time}`;
    const baseId = slugify(`${title}-${date}`) || `event-${Date.now()}`;
    let id = baseId;
    let suffix = 2;
    while (state.eventsData.some((item) => item.id === id)) { id = `${baseId}-${suffix}`; suffix += 1; }
    state.eventsData.unshift({
      id,
      title,
      date,
      dateLabel,
      time,
      location: String(formData.get('location')).trim(),
      image: encodePath('assets', 'upcoming', uploadedName),
      summary: String(formData.get('summary')).trim(),
      details: String(formData.get('expectations')).split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    });
    await writeJson(state.upcomingDir, 'events.json', state.eventsData);
    pendingEventFiles.shift();
    await loadMedia();
    notifyPublishedMedia('events');
    finishUploadProgress('Event published successfully');
    setStatus('Event published', `${title} is now available on the website.`, 'ready');
    eventPublishDialog.close();
    showNextEventPublisher();
  } catch (error) {
    uploadProgress.hidden = true;
    setStatus('Event could not be published', 'Check project access and try again.', 'error');
  } finally {
    submitButton.disabled = false;
  }
});
$('[data-event-publish-close]').addEventListener('click', closeEventPublisher);
$('[data-event-publish-cancel]').addEventListener('click', closeEventPublisher);
eventPublishDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeEventPublisher(); });
$$('[data-admin-tab]').forEach((tab) => tab.addEventListener('click', () => { $$('[data-admin-tab]').forEach((item) => item.setAttribute('aria-selected', String(item === tab))); $$('[data-admin-panel]').forEach((panel) => { panel.hidden = panel.dataset.adminPanel !== tab.dataset.adminTab; }); }));
window.addEventListener('beforeunload', clearObjectUrls);
const loginPanel = $('[data-admin-login]');
const loginForm = $('[data-admin-login-form]');
const loginError = $('[data-admin-login-error]');
let adminInitialized = false;
const initializeAdmin = () => {
  if (adminInitialized) return;
  adminInitialized = true;
  loadPublishedMedia().finally(restoreSavedProject);
};
const unlockAdmin = () => {
  sessionStorage.setItem('dtcAdminAuthenticated', 'true');
  document.body.classList.remove('admin-locked');
  loginPanel.hidden = true;
  initializeAdmin();
};
loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  if (formData.get('username') === 'admin' && formData.get('password') === 'admin123') {
    unlockAdmin();
    return;
  }
  loginError.textContent = 'Incorrect username or password.';
  loginForm.elements.password.value = '';
  loginForm.elements.password.focus();
});
$('[data-admin-sign-out]').addEventListener('click', () => {
  sessionStorage.removeItem('dtcAdminAuthenticated');
  window.location.reload();
});
if (sessionStorage.getItem('dtcAdminAuthenticated') === 'true') unlockAdmin();
