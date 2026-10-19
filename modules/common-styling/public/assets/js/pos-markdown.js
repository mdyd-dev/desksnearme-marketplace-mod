/*
  handles markdown editor

  usage:
    new pos.modules.markdown({ settings });
*/



window.pos.modules.markdown = function(settings){

  // cache 'this' value not to be overwritten later
  const module = this;


  // purpose:		settings that are being used across the module
  // ------------------------------------------------------------------------
  module.settings = {};
  // uploader container (dom node)
  module.settings.container = settings.container;
  // textarea for the content (dom node)
  module.settings.textarea = settings.textarea || module.settings.container.querySelector('textarea');
  // unique id for the module (string)
  module.settings.id = module.settings.container.id || 'pos-markdown';
  // minimum number of characters allowed in the textarea (int)
  module.settings.minlength = parseInt(settings.minlength) || parseInt(module.settings.container.dataset.minlength) || 0;
  // maximum number of characters allowed in the textarea (int)
  module.settings.maxlength = parseInt(settings.maxlength) || parseInt(module.settings.container.dataset.maxlength) || 10000;
  // errors container (dom node)
  module.settings.errorsContainer = module.settings.container.querySelector('.pos-form-errors');
  // class name that hides error on the list (string)
  module.settings.errorDisabledClass = 'pos-markdown-error-disabled';
  
  // @mention object (object)
  module.mention = {};
  // @mention settings (object)
  module.settings.mention = {};
  // container with @mentions (dom node)
  module.settings.mention.container = settings.mention?.container || module.settings.container.querySelector('.pos-markdown-mention');
  // list with @mention results (dom node)
  module.settings.mention.results = module.settings.mention.container?.querySelector('[popover]') || null;
  // instance of the popover with @mentions (object)
  module.settings.mention.popover = (module.settings.mention.results && pos.modules.active[module.settings.mention.results.id]) || null;
  // url of the api to fetch mention results (string)
  module.settings.mention.url = module.settings.mention.container?.dataset.url || null;
  // active @mention state { query, line, atCh } or null
  module.settings.mention.state = null;
  // template for @mention result (dom node)
  module.settings.mention.template = module.settings.mention.container?.querySelector('template') || null;
  // controller used to abort the in-flight search request (AbortController)
  module.settings.mention.searchController = null;
  // async function(query, signal) => [{ id, name }] — function to fetch mention results, returns array of objects with id, name and avatar
  module.settings.mention.search = settings.mention?.search || async function(query, signal){
    const response = await fetch(module.settings.mention.url + encodeURIComponent(query), { signal });
    if(!response.ok){
      throw new Error(`@mention search failed with status ${response.status}`);
    }
    const data = await response.json();
    return data.results;
  };

  // debug mode enabled (bool)
  module.settings.debug = typeof settings.debug === 'boolean' ? settings.debug : false;

  // easymde instance (object)
  module.settings.easyMde = null;
  // aborting it removes all the listeners attached outside of the editor (AbortController)
  module.settings.listeners = new AbortController();




  // purpose:		initializes the component
  // ------------------------------------------------------------------------
  module.init = () => {
    
    pos.modules.debug(module.settings.debug, module.settings.id, 'Initializing rich text editor', module.settings.container);

    // create @mention popover if mentions are enabled and it doesn't exist yet
    if(module.settings.mention.results && !module.settings.mention.popover){
      if(typeof pos.modules.popover === 'function'){
        pos.modules.debug(module.settings.debug, module.settings.id, 'No @mentions popover instance detected, creating one');

        module.settings.mention.popover = pos.modules.active[module.settings.mention.results.id] = new pos.modules.popover(module.settings.mention.container);
      } else {
        console.error(`[${module.settings.id}] pos-popover.js is not loaded, @mentions are disabled`);
      }
    }

    module.startEasyMde();

    // attach validation
    module.settings.textarea.form?.addEventListener('submit', event => {
      module.validate(event);
    }, { signal: module.settings.listeners.signal });

    // dispatch custom event
    module.settings.container.dispatchEvent(new CustomEvent('pos-markdown-initialized', { bubbles: true, detail: { module, target: module.settings.container, id: module.settings.id } }));
    pos.modules.debug(module.settings.debug, 'event', 'pos-markdown-initialized', { module, target: module.settings.container, id: module.settings.id });

  };


  // purpose:		starts EasyMDE instance
  // ------------------------------------------------------------------------
  module.startEasyMde = () => {
    pos.modules.debug(module.settings.debug, module.settings.id, 'Starting EasyMDE', module.settings.textarea);

    module.settings.easyMde = new EasyMDE({
      element: module.settings.textarea,
      renderingConfig: {
        codeSyntaxHighlighting: true
      },
      showIcons: ['code', 'table', 'upload-image'],
      spellChecker: false,
      hideIcons: ['guide', 'image', 'fullscreen'],
      uploadImage: true,
      sideBySideFullscreen: false,
      status: false,
      imageUploadFunction: module.uploadImage,
      previewImagesInEditor: true,
      previewClass: ['pos-prose', 'editor-preview']
    });

    // purpose: escape releases the TAB trap so keyboard users can navigate out
    // pressing Esc sets a flag; the capture-phase listener on the wrapper intercepts the next tab before codemirror can call preventDefault, letting the browser move focus naturally; any other key cancels the released state
    module.settings.easyMde.codemirror.addKeyMap({
      'Esc': function(){
        pos.modules.debug(module.settings.debug, module.settings.id, 'Escape pressed, releasing tab trap', module.settings.easyMde);
        module.settings.easyMde.codemirror.state.tabTrapReleased = true;
      }
    });
    
    const cmWrapper = module.settings.easyMde.codemirror.getWrapperElement();

    cmWrapper.addEventListener('keydown', function(event){
      if(module.settings.easyMde.codemirror.state.tabTrapReleased){
        if(event.key === 'Tab'){
          pos.modules.debug(module.settings.debug, module.settings.id, 'Tab trap was released, navigating focus outside of the editor', module.settings.easyMde);
          module.settings.easyMde.codemirror.state.tabTrapReleased = false;
          event.stopPropagation(); // codemirror never sees it → never calls preventDefault → browser navigates
        } else if(event.key !== 'Escape'){
          pos.modules.debug(module.settings.debug, module.settings.id, 'Re-engaging tab trap as the user resumed editing', module.settings.easyMde);
          module.settings.easyMde.codemirror.state.tabTrapReleased = false; // user resumed editing, re-engage tab trap
        }
      }
    }, true); // capture phase — fires before codemirror's listener on the inner textarea

    // purpose: sets up @mention detection and popup
    if(module.settings.mention.url && module.settings.mention.popover){
      module.mention.start();
    }

    pos.modules.debug(module.settings.debug, module.settings.id, 'EasyMDE instance created', module.settings.easyMde);
  };


  // purpose:		uploads images in the editor
  // ------------------------------------------------------------------------
  module.uploadImage = async (file, onSuccess, onError) => {
    pos.modules.debug(module.settings.debug, module.settings.id, 'Uploading image', module.settings.container);

    const fields = new FormData();

    for(let attribute of module.settings.textarea.attributes){
      if(attribute.name.startsWith('data-request-')){
        fields.append(attribute.name.replace('data-request-', ''), attribute.value)
      }
    }
    fields.append('Content-Type', file.type);
    fields.append('file', file);

    fetch(module.settings.textarea.dataset.uploadUrl, {
      method: 'POST',
      body: fields
    }).then(async response => {
      const xmlData = await response.text();

      if(response.status === 201 || response.status === 200){
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
        const fileUrl = xmlDoc.getElementsByTagName('Location')[0].textContent.indexOf('directory-uploads.uploads') ? xmlDoc.getElementsByTagName('Location')[0].textContent.replace('directory-uploads.uploads', 'files') : xmlDoc.getElementsByTagName('Location')[0].textContent; // fix for PS returning wrong file URL

        pos.modules.debug(module.settings.debug, module.settings.id, 'Image uploaded', fileUrl);
        // dispatch custom event
        module.settings.container.dispatchEvent(new CustomEvent('pos-markdown-image-uploaded', { bubbles: true, detail: { target: module.settings.container, file: { url: fileUrl } } }));
        pos.modules.debug(module.settings.debug, 'event', 'pos-markdown-image-uploaded', { target: module.settings.container, file: { url: fileUrl } });


        onSuccess(fileUrl);
      } else {
        pos.modules.debug(module.settings.debug, module.settings.id, 'Image upload failed', response);
        new pos.modules.toast('error', 'Could not upload image, please refresh the page and try again');
        onError('Upload failed');
      }
    });
  };

  // purpose:   focuses the text editor
  // ------------------------------------------------------------------------
  module.focus = () => {
    module.settings.easyMde.codemirror.focus();
    module.settings.easyMde.codemirror.setCursor(module.settings.easyMde.codemirror.lineCount(), 0);

    pos.modules.debug(module.settings.debug, module.settings.id, 'Markdown editor focused', module.settings.container);
  };


  // purpose:   resets editor state
  // ------------------------------------------------------------------------
  module.reset = () => {

    // clean value
    module.settings.easyMde.value('');

    // hide preview
    if(module.settings.easyMde.isPreviewActive()) {
      module.settings.easyMde.togglePreview();
    }

    // hide side-by-side preview
    if(module.settings.easyMde.isSideBySideActive()) {
      module.settings.easyMde.toggleSideBySide();
    }

    // clean errors
    module.settings.errorsContainer.querySelectorAll('li').forEach(li => li.classList.add(module.settings.errorDisabledClass));

    pos.modules.debug(module.settings.debug, module.settings.id, 'Cleaned the content of markdown editor', module.settings.container);
    // dispatch custom event
    module.settings.container.dispatchEvent(new CustomEvent('pos-markdown-reset', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id } }));
    pos.modules.debug(module.settings.debug, 'event', 'pos-markdown-reset', { target: module.settings.container, id: module.settings.id });
  
  };


  // purpose:   gets/sets the markdown content of the editor
  // arguments: new value to set to the editr (string)
  // returns:   current editor value
  // ------------------------------------------------------------------------
  module.value = (value) => {
    if(value){
      module.settings.easyMde.value(value);
      module.mention.reapplyMarks();

      pos.modules.debug(module.settings.debug, module.settings.id, 'Changed editor content', value);
      // dispatch custom event
      module.settings.container.dispatchEvent(new CustomEvent('pos-markdown-changed', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, value: value } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-markdown-changed', { target: module.settings.container, id: module.settings.id, value: value });
    }

    module.updateTextarea();

    return module.settings.easyMde.value();
  };


  // purpose:   updates the textarea with the markdown content
  // ------------------------------------------------------------------------
  module.updateTextarea = () => {
    module.settings.easyMde.codemirror.save();

    // dispatch custom event
    module.settings.container.dispatchEvent(new CustomEvent('pos-markdown-textarea-updated', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, textarea: module.settings.textarea, value: module.settings.textarea.value } }));
    pos.modules.debug(module.settings.debug, 'event', 'pos-markdown-textarea-updated', { target: module.settings.container, id: module.settings.id, textarea: module.settings.textarea, value: module.settings.textarea.value });

  };


  // purpose:   when EasyMDE/CodeMirror instance is created on a hidden element,
  //            it needs to be refreshed after showing up
  // ------------------------------------------------------------------------
  module.refresh = () => {
    module.settings.easyMde.codemirror.refresh();
  };


  // purpose:   removes the listeners attached outside of the editor,
  //            use when removing the editor from the page without reloading it
  // ------------------------------------------------------------------------
  module.destroy = () => {
    module.mention.hide();
    module.settings.listeners.abort();

    pos.modules.debug(module.settings.debug, module.settings.id, 'Markdown editor destroyed', module.settings.container);
  };


  // purpose:   validates the value
  // ------------------------------------------------------------------------
  module.validate = event => {
    let errors = 0;
    const length = module.value().length;

    if(length < module.settings.minlength){
      errors++;

      module.settings.container.querySelector(`[data-pos-markdown-error-minlength]`).classList.remove(module.settings.errorDisabledClass);

      pos.modules.debug(module.settings.debug, module.settings.id, 'Validating minimum length failed', { length, minlength: module.settings.minlength });
    }

    if(length > module.settings.maxlength){
      errors++;

      module.settings.container.querySelector(`[data-pos-markdown-error-maxlength]`).classList.remove(module.settings.errorDisabledClass);

      pos.modules.debug(module.settings.debug, module.settings.id, 'Validating maximum length failed', { length, maxlength: module.settings.maxlength });
    }

    if(errors){
      // dispatch custom event
      module.settings.container.dispatchEvent(new CustomEvent('pos-markdown-validation-failed', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, value: module.settings.textarea.value, errors: module.settings.errorsContainer } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-markdown-validation-failed', { target: module.settings.container, id: module.settings.id, value: module.settings.textarea.value, errors: module.settings.errorsContainer });
    } else {
      // dispatch custom event
      module.settings.container.dispatchEvent(new CustomEvent('pos-markdown-validation-passed', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id, value: module.settings.textarea.value } }));
      pos.modules.debug(module.settings.debug, 'event', 'pos-markdown-validation-passed', { target: module.settings.container, id: module.settings.id, value: module.settings.textarea.value });
    }

    if(errors){
      event.preventDefault();
      return false
    }
  };


  // purpose:   sets up @mention detection and popup
  // ------------------------------------------------------------------------
  module.mention.start = () => {
    module.settings.easyMde.codemirror.on('change', () => {
      if (module.mention.cleaningUp) return;

      module.mention.cleanupIfEditingMark();

      const cursor = module.settings.easyMde.codemirror.getCursor();
      const textBefore = module.settings.easyMde.codemirror.getLine(cursor.line).slice(0, cursor.ch);
      const atIdx = textBefore.lastIndexOf('@');

      if(atIdx === -1){
        module.mention.hide();
        return;
      }

      const charBefore = atIdx > 0 ? textBefore[atIdx - 1] : ' ';
      const query = textBefore.slice(atIdx + 1);

      if(!/\s/.test(charBefore) && atIdx > 0){
        module.mention.hide();
        return;
      }
      if(query.length < 1 || /\s/.test(query)){
        module.mention.hide();
        return;
      }

      module.settings.mention.state = { query, line: cursor.line, atCh: atIdx };
      module.mention.cancelSearch();
      module.mention.searchTimeout = setTimeout(async () => {
        const controller = module.settings.mention.searchController = new AbortController();

        try {
          const results = await module.settings.mention.search(query, controller.signal);

          // drop responses for a query that is no longer being typed (user moved on or closed the popup)
          if(controller.signal.aborted || module.settings.mention.state?.query !== query){
            return;
          }

          module.mention.renderPopup(results);
        } catch(error) {
          if(error.name === 'AbortError'){
            return;
          }

          pos.modules.debug(module.settings.debug, module.settings.id, 'Searching for @mentions failed', error);
          module.mention.hide();
        }
      }, 300);
    });

    document.addEventListener('click', e => {
      if(!module.settings.mention.results.contains(e.target)){
        module.mention.hide();
      }
    }, { signal: module.settings.listeners.signal });

    module.settings.easyMde.codemirror.addKeyMap({
      'Esc': () => {
        if(!module.settings.mention.popover.settings.opened){
          return module.settings.easyMde.codemirror.constructor.Pass;
        }

        module.mention.hide();
      },
      'Up':  () => {
        if(!module.settings.mention.popover.settings.opened){
          return module.settings.easyMde.codemirror.constructor.Pass;
        }
      },
      'Down': () => {
        if(!module.settings.mention.popover.settings.opened){
          return module.settings.easyMde.codemirror.constructor.Pass;
        }
      },
      'Enter': () => {
        if(!module.settings.mention.popover.settings.opened){
          return module.settings.easyMde.codemirror.constructor.Pass;
        }

        // the editor still has focus (arrow keys move focus into the menu, where the button handles Enter itself),
        // so pick the first result
        module.settings.mention.popover.settings.focusable[0]?.click();
      }
    });

    // the popup is positioned in document coordinates (see updatePopupPosition), so it scrolls
    // along with the page natively — no listener needed for window/page scrolling. What still
    // needs a manual reposition is the editor's own internal scroll (typing pushes lines up
    // inside CodeMirror's viewport without the page itself scrolling)...
    module.settings.easyMde.codemirror.on('scroll', () => {
      if(module.settings.mention.popover?.settings.opened) module.mention.updatePopupPosition();
    });

    // ...and the on-screen keyboard showing/hiding, which can reflow the editor (e.g. line
    // wrapping changes) even though the page didn't scroll.
    window.visualViewport?.addEventListener('resize', () => {
      if(module.settings.mention.popover?.settings.opened) module.mention.updatePopupPosition();
    }, { passive: true, signal: module.settings.listeners.signal });

    module.mention.reapplyMarks();

    pos.modules.debug(module.settings.debug, module.settings.id, 'Activated @mentions', module.settings.mention);
  };


  // purpose:   renders mention results in the popup, positioned at the cursor
  // ------------------------------------------------------------------------
  module.mention.renderPopup = (results) => {
    pos.modules.debug(module.settings.debug, module.settings.id, 'Rendering @mention results in the popover', results);

    module.settings.mention.results.innerHTML = '';

    if(!results?.length){
      module.mention.hide();
      return;
    }

    results.forEach(person => {
      const template = module.settings.mention.template.content.cloneNode(true);

      if(person.avatar){
        template.querySelector('img').src = person.avatar.photo.versions.sm;
        template.querySelector('.pos-markdown-mention-avatar-initials').remove();
      } else {
        template.querySelector('img').remove();
        const initials = (person.name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(name => name[0]).join('');
        template.querySelector('.pos-markdown-mention-avatar-initials').textContent = initials.toUpperCase();
      }
      template.querySelector('.pos-markdown-mention-name').textContent = person.name;

      template.querySelector('button').addEventListener('click', e => {
        e.preventDefault();
        module.mention.insert(person);
      });

      module.settings.mention.results.appendChild(template);
    });

    module.mention.updatePopupPosition();

    module.settings.mention.popover.buildFocusableMenuItems();

    module.settings.mention.popover.open();
  };


  // purpose:   recalculates popup position anchored to the @ character (document-relative,
  //            since the popup is `position: absolute` — see pos-markdown.css)
  // ------------------------------------------------------------------------
  module.mention.updatePopupPosition = () => {
    if(!module.settings.mention.state){
      return;
    }

    pos.modules.debug(module.settings.debug, module.settings.id, 'Updating @mention popover position', module.settings.mention.state);

    const atPos = { line: module.settings.mention.state.line, ch: module.settings.mention.state.atCh };
    // 'page' mode bakes the document scroll offset into the coordinates, matching a
    // `position: absolute` element — the browser then keeps it aligned with the caret on
    // scroll natively, instead of us recomputing viewport-relative ('window' mode) coordinates
    // on every scroll frame, which is what broke on mobile Safari with the keyboard open.
    const coords = module.settings.easyMde.codemirror.charCoords(atPos, 'page');

    module.settings.mention.results.style.left = coords.left + 'px';
    module.settings.mention.results.style.top = (coords.bottom + 4) + 'px';
  };


  // purpose:   hides the mention popup and clears state
  // ------------------------------------------------------------------------
  module.mention.hide = () => {
    module.mention.cancelSearch();

    if(module.settings.mention.popover && module.settings.mention.popover.settings.opened){
      module.settings.mention.popover.close();
    }
    module.settings.mention.state = null;
  };


  // purpose:   cancels the scheduled and in-flight @mention search
  // ------------------------------------------------------------------------
  module.mention.cancelSearch = () => {
    clearTimeout(module.mention.searchTimeout);
    module.settings.mention.searchController?.abort();
    module.settings.mention.searchController = null;
  };


  // purpose:   when a change lands inside an existing mention mark, strips @[name](id) to plain @name
  //            so backspacing or typing within the visible "@name" doesn't leave hidden markdown syntax
  // ------------------------------------------------------------------------
  module.mention.cleanupIfEditingMark = () => {
    const cm = module.settings.easyMde.codemirror;
    const cursor = cm.getCursor();

    // findMarksAt uses exclusive right boundary, so also check one char left to catch right-edge deletions
    const positions = [cursor];
    if (cursor.ch > 0) positions.push({ line: cursor.line, ch: cursor.ch - 1 });

    let mentionMark = null;
    for (const pos of positions) {
      mentionMark = cm.findMarksAt(pos).find(m => m.className === 'pos-markdown-mention-mark');
      if (mentionMark) break;
    }
    if (!mentionMark) return;

    const range = mentionMark.find();
    if (!range) return;

    const underlyingText = cm.getRange(range.from, range.to);
    if (!underlyingText.startsWith('@')) return;

    // extract the visible name from @[Name (collapse removes [, but it's still in underlying text)
    const displayName = underlyingText.startsWith('@[') ? underlyingText.slice(2) : underlyingText.slice(1);

    // find and clear the closing ](id) collapsed mark (starts exactly where the styling mark ends)
    let endPos = range.to;
    const allMarks = cm.getAllMarks();
    for (const m of allMarks) {
      if (m === mentionMark || m.className) continue;
      const mRange = m.find();
      if (!mRange || !m.collapsed) continue;
      if (mRange.from.line === range.to.line && mRange.from.ch === range.to.ch) {
        endPos = mRange.to;
        m.clear();
        break;
      }
    }

    // find and clear the opening [ collapsed mark (one char after the @ )
    for (const m of cm.getAllMarks()) {
      if (m === mentionMark || m.className) continue;
      const mRange = m.find();
      if (!mRange || !m.collapsed) continue;
      if (mRange.from.line === range.from.line && mRange.from.ch === range.from.ch + 1) {
        m.clear();
        break;
      }
    }

    mentionMark.clear();

    // replace @[name](id) with plain @name; guard flag prevents re-entry on the change this fires
    const origCh = cursor.ch;
    module.mention.cleaningUp = true;
    cm.replaceRange('@' + displayName, range.from, endPos);
    module.mention.cleaningUp = false;

    // restore cursor: removing the hidden '[' shifts positions after it back by one
    const newCh = origCh > range.from.ch + 1 ? origCh - 1 : origCh;
    cm.setCursor({ line: range.from.line, ch: newCh });
  };


  // purpose:   collapses "[" and "](id)" in a single mention so only "@Name" is visible
  // ------------------------------------------------------------------------
  module.mention.applyMark = (line, atCh, name, id) => {
    const cm = module.settings.easyMde.codemirror;
    // @[Name](id) — collapse "[" (1 char) so "@Name" is visible
    cm.markText(
      { line, ch: atCh + 1 },
      { line, ch: atCh + 2 },
      { collapsed: true, atomic: true }
    );
    // collapse "](id)" (id.length + 3 chars) so nothing after the name is visible
    cm.markText(
      { line, ch: atCh + 2 + name.length },
      { line, ch: atCh + 2 + name.length + id.length + 3 },
      { collapsed: true, atomic: true }
    );
    // style the visible "@Name" span
    cm.markText(
      { line, ch: atCh },
      { line, ch: atCh + 2 + name.length },
      { className: 'pos-markdown-mention-mark' }
    );
  };


  // purpose:   re-applies mention marks on existing content (init or programmatic value set)
  // ------------------------------------------------------------------------
  module.mention.reapplyMarks = () => {
    pos.modules.debug(module.settings.debug, module.settings.id, 'Re-applying @mention marks', module.settings.mention);

    const cm = module.settings.easyMde.codemirror;
    const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    for (let line = 0; line < cm.lineCount(); line++) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(cm.getLine(line))) !== null) {
        module.mention.applyMark(line, match.index, match[1], match[2]);
      }
    }
  };


  // purpose:   replaces the @query text with the selected mention
  // ------------------------------------------------------------------------
  module.mention.insert = (person) => {
    pos.modules.debug(module.settings.debug, module.settings.id, 'Inserting @mention to the editor', person);

    const cm = module.settings.easyMde.codemirror;
    const s = module.settings.mention.state;
    if (!s) return;
    const cursor = cm.getCursor();
    cm.replaceRange(
      `@[${person.name}](${person.id}) `,
      { line: s.line, ch: s.atCh },
      { line: cursor.line, ch: cursor.ch }
    );
    module.mention.applyMark(s.line, s.atCh, person.name, person.id);
    module.mention.hide();
    cm.focus();
  };



  module.init();

};