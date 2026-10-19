import { Uppy, Dashboard, AwsS3, Webcam, ImageEditor } from 'https://releases.transloadit.com/uppy/v3.6.0/uppy.min.mjs';

const apiFetch = (path, options, form) =>
  fetch(path, Object.assign({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': form.dataset.csrf,
    },
  }, options)).then((r) => r.json());

const getDimensions = (file) => new Promise((resolve) => {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: null, height: null });
    img.src = fr.result;
  };
  fr.onerror = () => resolve({ width: null, height: null });
  fr.readAsDataURL(file.data);
});

const createPhoto = async (form, imageUrl, file) => {
  const dims = await getDimensions(file);
  return apiFetch('/api/photos', {
    body: JSON.stringify({ photo: {
      direct_url: imageUrl,
      photo_type: form.dataset.s3UppyPhotoType,
      object_uuid: form.dataset.s3UppyObjectUuid,
      photo_width: dims.width,
      photo_height: dims.height,
    }}),
  }, form);
};

const deletePhoto = (form, photoId) =>
  apiFetch('/api/photos', { method: 'DELETE', body: JSON.stringify({ photo: { id: photoId } }) }, form);

const loadExisting = async (uppy, photos) => {
  for (const p of photos) {
    try {
      const res = await fetch(p.photo.url);
      const blob = await res.blob();
      uppy.addFile({
        name: p.photo.file_name || ('photo-' + p.id),
        type: blob.type, data: blob, source: 'existing', meta: { photoId: p.id },
      });
    } catch (e) { /* skip unreachable existing file */ }
  }
  uppy.getFiles().forEach((f) => uppy.setFileState(f.id, {
    progress: { uploadComplete: true, percentage: 100, uploadStarted: Date.now() },
  }));
};

const setupForm = async (form) => {
  const target = form.dataset.s3UppyTarget || '#drag-drop-area';
  const maxFiles = parseInt(form.dataset.s3UppyMaxNumberOfFiles || '10', 10);
  const existing = JSON.parse(form.dataset.s3UppyPhotos || '[]') || [];
  const editorEnabled = form.dataset.s3UppyEditorEnabled === 'true';

  const uppy = new Uppy({
    autoProceed: existing.length === 0 && !editorEnabled,
    restrictions: {
      maxFileSize: 10485760,
      maxNumberOfFiles: maxFiles,
      allowedFileTypes: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'],
    },
  })
    .use(Dashboard, {
      inline: true, target, replaceTargetContent: true, showProgressDetails: true,
      width: '100%', proudlyDisplayPoweredByUppy: false,
      showRemoveButtonAfterComplete: true,
      note: form.dataset.s3UppyNote || null, autoOpenFileEditor: editorEnabled,
    })
    .use(Webcam, { target: Dashboard, modes: ['picture'] })
    .use(AwsS3, {
      shouldUseMultipart: false,
      getUploadParameters() {
        const url = form.getAttribute('action');
        const fields = Array.from(new FormData(form)).reduce((acc, [k, v]) => (acc[k] = v, acc), {});
        return Promise.resolve({ method: 'POST', url, fields });
      },
    });

  if (editorEnabled) {
    uppy.use(ImageEditor, {
      target: Dashboard,
      actions: { revert: true, rotate: true, flip: true, zoomIn: true, zoomOut: true, cropSquare: true, cropWidescreen: true },
    });
  }

  uppy.on('complete', ({ successful }) => {
    Promise.all(
      successful.filter((f) => f.source !== 'existing').map((file) => {
        const loc = file.uploadURL || (file.response && file.response.body && file.response.body.location);
        return createPhoto(form, loc, file).then((photo) => {
          uppy.setFileMeta(file.id, { photoId: photo.id });
          return photo;
        });
      })
    ).then((photos) => {
      document.dispatchEvent(new CustomEvent('listing-photos-added', { detail: { photos } }));
    });
  });

  uppy.on('file-removed', (file, reason) => {
    if (reason === 'removed-by-user' && file.meta && file.meta.photoId) {
      deletePhoto(form, file.meta.photoId);
    }
  });

  await loadExisting(uppy, existing);
  return uppy;
};

document.querySelectorAll('[data-s3-uppy-photo="form"]').forEach(setupForm);