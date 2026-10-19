/*
  handles uploading files

  usage:
    new window.pos.modules.upload({ settings });
*/



window.pos.modules.upload = function(settings){

  // cache 'this' value not to be overwritten later
  const module = this;

  // purpose:		settings that are being used across the module
  // ------------------------------------------------------------------------
  module.settings = {};
  // uploader container (dom node)
  module.settings.container = settings.container;
  // unique id for the module
  module.settings.id = module.settings.container.id || 'pos-upload'
  // if you want to show the uppy dashboard with image editor and thumbnails (bool)
  module.settings.showDashboard = settings.showDashboard || true;
  // maximum file size in bytes for each individual file (int)
  module.settings.maxFileSize = settings.maxFileSize || 10485760;
  // total number of files that can be selected (int)
  module.settings.maxNumberOfFiles = settings.maxNumberOfFiles && parseInt(settings.maxNumberOfFiles);
  // wildcards image/* or exact mime types image/jpeg or file extensions .jpg, example: ['image/*', '.jpg', '.jpeg', '.png', '.gif'] (array)
  module.settings.allowedFileTypes = settings.allowedFileTypes;
  // template to add to DOM for each added file
  module.settings.addedFileTemplate = module.settings.container.querySelector('.pos-upload-added-file-input');
  // template to add to DOM for each removed file
  module.settings.removedFileTemplate = module.settings.container.querySelector('.pos-upload-removed-file-input');
  // if you want the photo editor (bool)
  module.settings.imageEditorEnabled = settings.imageEditorEnabled || false;
  // aspect ration for cropping the image (float)
  module.settings.aspectRatio = settings.aspectRatio || null;
  // width of the dashboard (string)
  module.settings.width = settings.width || '100%';
  // height of the dashboard (string)
  module.settings.height = settings.height || '400px';
  // debug mode enabled (bool)
  module.settings.debug = settings.debug || false;

  // uppy instance for this upload (object)
  module.settings.uppy = null;
  




  // purpose:		initializes the component
  // ------------------------------------------------------------------------
  module.init = () => {

    pos.modules.debug(module.settings.debug, module.settings.id, 'Initializing upload module', module.settings.container);

    module.startUppy();

    module.settings.container.querySelectorAll('input[type="hidden"]').forEach(async input => {
      await module.preloadFile(input.value, input.dataset.databaseId);
    });

    module.settings.container.addEventListener('pos-upload-file-uploaded', event => {
      module.addInput('added', event.detail);
    });

    module.settings.container.addEventListener('pos-upload-file-removed', event => {
      // remove the input holding the information about preloaded file
      module.removeInput(event.detail);
      // if this was a preloaded file, add the information that it was removed
      if(event.detail.file.meta.databaseId){
        module.addInput('removed', event.detail);
      }
    });

    // set the option to auto proceed after the preloaded files were loaded
    module.settings.uppy.setOptions({
      autoProceed: !module.settings.imageEditorEnabled
    });

    if(module.settings.imageEditorEnabled){
      module.settings.uppy.on('file-editor:complete', () => {
        module.settings.uppy.upload();
      });
    }

    module.settings.uppy.on('upload-success', (file, response) => {
      module.settings.container.dispatchEvent(new CustomEvent('pos-upload-file-uploaded', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, file: file, response: response, url: response.uploadURL } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-upload-file-uploaded', { target: module.settings.container, id: module.settings.id, file: file, response: response, url: response.uploadURL });
    });

    module.settings.uppy.on('file-added', (file) => {
      // if user wants to upload an image, read its dimensions and store those in metadata
      if(file.type && file.type.startsWith('image/')){
        module.getImageDimenstions(file.data).then(dimensions => {
          module.settings.uppy.setFileMeta(file.id, {
              width: dimensions.width,
              height: dimensions.height
            });
        });
      }

      module.settings.container.dispatchEvent(new CustomEvent('pos-upload-file-added', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, file: file } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-upload-file-added', { target: module.settings.container, id: module.settings.id, file: file });
    });

    module.settings.uppy.on('files-added', (files) => {
      module.settings.container.dispatchEvent(new CustomEvent('pos-upload-files-added', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, files: files } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-upload-files-added', { target: module.settings.container, id: module.settings.id, files: files });
    });

    module.settings.uppy.on('file-removed', (file) => {
      module.settings.container.dispatchEvent(new CustomEvent('pos-upload-file-removed', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, file: file } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-upload-file-removed', { target: module.settings.container, id: module.settings.id, file: file });
    });

    module.settings.uppy.on('upload', (uploadID, files) => {
      module.settings.container.dispatchEvent(new CustomEvent('pos-upload-started', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, uploadId: uploadID, files: files } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-upload-started', { target: module.settings.container, id: module.settings.id, uploadId: uploadID, files: files });
    });

    module.settings.uppy.on('complete', (result) => {
      module.settings.container.dispatchEvent(new CustomEvent('pos-upload-complete', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, result: result } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-upload-complete', { target: module.settings.container, id: module.settings.id, result: result });
    });

    module.settings.uppy.on('error', (error) => {
      module.settings.container.dispatchEvent(new CustomEvent('pos-upload-error', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, error: error } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-upload-error', { target: module.settings.container, id: module.settings.id, error: error });
    });

    module.settings.uppy.on('cancel-all', () => {
      module.settings.container.dispatchEvent(new CustomEvent('pos-upload-cancel-all', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-upload-cancel-all', { target: module.settings.container, id: module.settings.id });
    });

    module.settings.uppy.on('restriction-failed', (file, error) => {
      module.settings.container.dispatchEvent(new CustomEvent('pos-upload-restriction-failed', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, file: file, error: error } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-upload-restriction-failed', { target: module.settings.container, id: module.settings.id, file: file, error: error });
    });


    module.settings.container.dispatchEvent(new CustomEvent('pos-upload-initialized', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, settings: module.settings } }));
    pos.modules.debug(module.settings.debug, 'event', 'pos-upload-initialized', { target: module.settings.container, id: module.settings.id, settings: module.settings });

  };



  // purpose:		starts uppy instance
  // ------------------------------------------------------------------------
  module.startUppy = () => {
    
    pos.modules.debug(module.settings.debug, module.settings.id, 'Starting Uppy');

    module.settings.uppy = new pos.modules.uppy.Uppy({
      restrictions: {
        maxFileSize: module.settings.maxFileSize,
        maxNumberOfFiles: module.settings.maxNumberOfFiles,
        allowedFileTypes: module.settings.allowedFileTypes,
        maxNumberOfFiles: module.settings.maxNumberOfFiles
      },
      debug: module.settings.debug
    })
    .use(pos.modules.uppy.AwsS3, {
      getUploadParameters(file){
        const fields = {};

        for(let attribute of module.settings.container.attributes){
          if(attribute.name.startsWith('data-request-')){
            fields[attribute.name.replace('data-request-', '')] = attribute.value;
          }
        }
        fields['Content-Type'] = file.type;

        return Promise.resolve({
          method: 'POST',
          url: module.settings.container.dataset.uploadUrl,
          fields: fields,
        });
      },
    });

    if(module.settings.showDashboard){
      pos.modules.debug(module.settings.debug, module.settings.id, 'Starting dashboard', module.settings.container);
      module.settings.uppy.use(pos.modules.uppy.Dashboard, {
        id: module.settings.id,
        target: module.settings.container,
        inline: true,
        proudlyDisplayPoweredByUppy: false,
        width: module.settings.width,
        height: module.settings.height,
        hideProgressAfterFinish: true,
        showRemoveButtonAfterComplete: true,
        autoOpen: module.settings.imageEditorEnabled && 'imageEditor'
      });
    }

    if(module.settings.imageEditorEnabled){
      pos.modules.debug(module.settings.debug, module.settings.id, 'Starting image editor', module.settings.container);
      module.settings.uppy.use(pos.modules.uppy.ImageEditor, {
        cropperOptions: {
          aspectRatio: module.settings.aspectRatio
        }
      });
    }

  };


  // purpose:		puts an hidden input on the page with the URL to the uploaded file as value
  // arguments: if the file was 'added' or 'removed' (string)
  //            uploaded file data: id and url (object)
  // ------------------------------------------------------------------------
  module.addInput = (status, file) => {
    const element = status === 'added' ? document.importNode(module.settings.addedFileTemplate.content, true) : document.importNode(module.settings.removedFileTemplate.content, true);
    element.querySelector('input').value = status === 'added' ? file.url : file.file.meta.databaseId;
    element.querySelector('input').dataset.id = file.file.id;
    module.settings.container.appendChild(element);

    pos.modules.debug(module.settings.debug, module.settings.id, `Added a hidden input with the ${status === 'added' ? 'added' : 'removed'} file ${status === 'added' ? 'url' : 'id'} as a value`, document.querySelector(`[data-id="${file.file.id}"]`));
  };


  // purpose:		removes the hidden input corresponding to the removed file
  // arguments: uploaded file data: id
  // ------------------------------------------------------------------------
  module.removeInput = (file) => {
    document.querySelector(`[data-id="${file.file.id}"]`).remove();

    pos.modules.debug(module.settings.debug, module.settings.id, 'Removed a hidden input corresponding to the removed file', file.file.id);
  };


  // purpose:		perloads already uploaded files to the module
  // arguments: url to remote file (string)
  //            database id of the file (int)
  // ------------------------------------------------------------------------
  module.preloadFile = async (url, databaseId) => {
    pos.modules.debug(module.settings.debug, module.settings.id, 'Preloading a file', url);

    // fetch file from url
    const response = await fetch(url);
    const blob = await response.blob();

    const fileId = module.settings.uppy.addFile({
      name: url.split('/').pop(),
      type: blob.type,
      data: blob,
      isRemote: true,
      remote: url,
      meta: {
        databaseId: databaseId
      }
    });

    module.settings.uppy.setFileState(fileId, {
      progress: {
        uploadComplete: true,
        uploadStarted: Date.now()
      },
      uploadURL: url,
      preview: (blob.type.startsWith('image')) ? url : false
    });

    // set the uppy ids for hidden inputs corresponding to preloaded file
    document.querySelector(`[value="${url}"]`).dataset.id = fileId;
  };


  // purpose:		gets image dimensions
  // arguments: file object (file data)
  // ------------------------------------------------------------------------
  module.getImageDimenstions = file => {
    return new Promise((resolve) => {
      const fr = new FileReader;
      const dimensions = {
        width: false,
        height: false
      };

      fr.onload = function() {
        const img = new Image;
        img.onload = function() {
          dimensions.width = img.width;
          dimensions.height = img.height;
          resolve(dimensions);
        };
        img.src = fr.result;
      };

      fr.readAsDataURL(file);

      pos.modules.debug(module.settings.debug, module.settings.id, `Read image dimenstions`, { file, dimensions });
    });
  };


  module.init();

};