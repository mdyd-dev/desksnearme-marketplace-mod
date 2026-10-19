  /*
  handles focus for popover menus and provides fallback for firefox lacking anchor positioning

  usage:
*/



// purpose:   traps focus inside the popover menu
// arguments: 
// ************************************************************************
window.pos.modules.popover = function(container, userSettings = {}){

  // cache 'this' value not to be overwritten later
  const module = this;

  // purpose:		settings that are being used across the module
  // ------------------------------------------------------------------------
  module.settings = {};
  // popover container (dom node)
  module.settings.container = container || document.querySelector('.pos-popover');
  // popover trigger (dom node)
  module.settings.trigger = module.settings.container.querySelector('[popovertarget]');
  // id used to mark the module (string)
  module.settings.id = module.settings.trigger?.getAttribute('popovertarget') || 'pos-popover-' + Math.floor(Math.random() * 1000000);
  // popover content (dom node)
  module.settings.popover = module.settings.container.querySelector('[popover]');
  // if the popover is opened (bool)
  module.settings.opened = false;
  // menu element inside the popover (dom node)
  module.settings.menu = module.settings.popover.matches('menu') ? module.settings.popover : module.settings.popover.querySelector('menu');
  // all of the focusable elements in the menu (array)
  module.settings.focusable = [];
  // to enable debug mode (bool)
  module.settings.debug = (userSettings?.debug) ? userSettings.debug : false;



  // purpose:		initializes the component
  // ------------------------------------------------------------------------
  module.init = () => {
    pos.modules.debug(module.settings.debug, module.settings.id, 'Initializing popover menu', module.settings.container);

    module.settings.popover.addEventListener('toggle', event => {
      if(event.newState == 'open'){
        // set all the focusable menu items
        if(module.settings.menu){
          module.buildFocusableMenuItems();
        }

        // set state
        module.settings.opened = true;
        pos.modules.debug(module.settings.debug, module.settings.id, 'Popover opened', module.settings.container);

        // dispatch custom event
        document.dispatchEvent(new CustomEvent('pos-popover-opened', { bubbles: true, detail: { target: module.settings.popover, id: module.settings.id } }));
        pos.modules.debug(module.settings.debug, 'event', 'pos-popover-opened', { target: module.settings.popover, id: module.settings.id });

        // support keyboard navigation
        if(module.settings.menu){
          document.addEventListener('keydown', module.keyboard);
        }
      } else {
        // set state
        module.settings.opened = false;
        pos.modules.debug(module.settings.debug, module.settings.id, 'Popover closed', module.settings.container);

        // dispatch custom event
        document.dispatchEvent(new CustomEvent('pos-popover-closed', { bubbles: true, detail: { target: module.settings.popover, id: module.settings.id } }));
        pos.modules.debug(module.settings.debug, 'event', 'pos-popover-closed', { target: module.settings.popover, id: module.settings.id });

        // disable keyboard navigation
        if(module.settings.menu){
          document.removeEventListener('keydown', module.keyboard);
        }
      }
    });

    // if the popover is triggered by keyboard navigation, focus the first element
    if(module.settings.menu && module.settings.trigger){
      module.settings.trigger.addEventListener('keyup', event => {
        if(event.keyCode === 32 || event.key === 'Enter'){
          if(!module.settings.opened){
            module.settings.popover.addEventListener('toggle', () => {
              pos.modules.debug(module.settings.debug, module.settings.id, 'Opened using keyboard', module.settings.container);
              if(module.settings.opened){
                module.focusFirstMenuItem();
              }
            }, { once: true });
          }
        }
      });
    }

    // if user uses tab to navigate through the menu, close the popover when the focus leaves
    if(module.settings.menu){
      function hideWhenOutOfFocus(event){
        if(!module.settings.popover.contains(event.relatedTarget)){
          pos.modules.debug(module.settings.debug, module.settings.id, 'Popover lost focus, closing', module.settings.container);
          module.settings.popover.hidePopover();
        }
      }

      module.settings.popover.addEventListener('beforetoggle', event => {
        if(event.newState == 'open'){
          module.settings.popover.addEventListener('focusout', hideWhenOutOfFocus);
        } else {
          module.settings.popover.removeEventListener('focusout', hideWhenOutOfFocus);
        }
      });
    }

    // polyfill for Firefox and Safari lacking support for anchor positioning
    // can be deleted from code as is when all browsers support it
    // only applies to popovers opened via a [popovertarget] trigger - popovers positioned
    // programmatically (e.g. the @mention popup) have no trigger and manage their own position
    if(!('anchorName' in document.documentElement.style) && module.settings.trigger){
      module.settings.popover.addEventListener('toggle', event => {
        if(event.newState == 'open'){
          module.positionPopoverFallback();
          window.addEventListener('resize', popoverReposition);
        } else {
          window.removeEventListener('resize', popoverReposition);
        }
      });

      // reposition popover when browser window is resized
      let popoverRepositionDebounce;
      
      function popoverReposition(){
        clearTimeout(popoverRepositionDebounce);

        popoverRepositionDebounce = setTimeout(() => {
          module.positionPopoverFallback();

          pos.modules.debug(module.settings.debug, module.settings.id, 'Browser window resized, repositioning the popover', module.settings.container);
        }, 100);
      }
    }
  };


  // purpose:		handles keyboard navigation
  // ------------------------------------------------------------------------
  module.keyboard = event => {
    if(event.key === 'ArrowDown'){
      event.preventDefault();

      if(module.settings.menu.contains(document.activeElement)){
        if(module.settings.focusable[module.settings.focusable.indexOf(document.activeElement)+1]){
          module.focusNextMenuItem();
        } else {
          pos.modules.debug(module.settings.debug, module.settings.id, 'There is no next menu item', module.settings.container);
          module.focusFirstMenuItem();
        }
      } else {
        module.focusFirstMenuItem();
      }
    }

    if(event.key === 'ArrowUp'){
      event.preventDefault();

      if(module.settings.menu.contains(document.activeElement)){
        if(module.settings.focusable[module.settings.focusable.indexOf(document.activeElement)-1]){
          module.focusPreviousMenuItem();
        } else {
          pos.modules.debug(module.settings.debug, module.settings.id, 'There is no previous menu item', module.settings.container);
          module.focusLastMenuItem();
        }
      } else {
        module.focusLastMenuItem();
      }
    }

    if(event.key === 'Home'){
      event.preventDefault();
      module.focusFirstMenuItem();
    }

    if(event.key === 'End'){
      event.preventDefault();
      module.focusLastMenuItem();
    }
  };


  // purpose:		opens the popover menu
  // ------------------------------------------------------------------------
  module.open = () => {
    module.settings.popover.showPopover();

    pos.modules.debug(module.settings.debug, module.settings.id, 'Programatically opening popover', module.settings.container);
  };


  // purpose:		closes the popover menu
  // ------------------------------------------------------------------------
  module.close = () => {
    module.settings.popover.hidePopover();

    pos.modules.debug(module.settings.debug, module.settings.id, 'Programatically closing popover', module.settings.container);
  };


  // purpose:		builds an array of all the focusable menu items
  // ------------------------------------------------------------------------
  module.buildFocusableMenuItems = () => {
    return module.settings.focusable = Array.from(module.settings.menu.querySelectorAll('li a, li button')).filter(element => element.checkVisibility())

    pos.modules.debug(module.settings.debug, module.settings.id, 'Built focusable menu items list', module.settings.focusable);
  }


  // purpose:		focuses first visible menu item
  // ------------------------------------------------------------------------
  module.focusFirstMenuItem = () => {
    module.settings.focusable[0].focus();
    pos.modules.debug(module.settings.debug, module.settings.id, 'Focusing first visible menu item', module.settings.focusable[0]);
  };

  // purpose:		focuses last visible menu item
  // ------------------------------------------------------------------------
  module.focusLastMenuItem = () => {
    module.settings.focusable[module.settings.focusable.length-1].focus();
    pos.modules.debug(module.settings.debug, module.settings.id, 'Focusing last visible menu item', module.settings.focusable[module.settings.focusable.length-1]);
  };

  // purpose:		focuses menu item that is next to the currently focused one
  // ------------------------------------------------------------------------
  module.focusNextMenuItem = () => {
    const currentlyFocused = module.settings.focusable.indexOf(document.activeElement);
    module.settings.focusable[currentlyFocused+1].focus();
    pos.modules.debug(module.settings.debug, module.settings.id, 'Focusing next available menu item', module.settings.focusable[currentlyFocused+1]);
  };

  // purpose:		focuses menu item that is previous to the currently focused one
  // ------------------------------------------------------------------------
  module.focusPreviousMenuItem = () => {
    const currentlyFocused = module.settings.focusable.indexOf(document.activeElement);
    module.settings.focusable[currentlyFocused-1].focus();

    pos.modules.debug(module.settings.debug, module.settings.id, 'Focusing previous available menu item', module.settings.focusable[currentlyFocused-1]);
  };


  // purpose:		positions the popover relative to the trigger element
  // ------------------------------------------------------------------------
  module.positionPopoverFallback = () => {
    pos.modules.debug(module.settings.debug, module.settings.id, 'This browser does not support anchor positioning, setting the position manually', module.settings.container);

    const triggerSize = module.settings.trigger.getBoundingClientRect();
    triggerSize.offsetBottom = triggerSize.bottom + window.scrollY;
    const popoverSize = module.settings.popover.getBoundingClientRect();

    module.settings.popover.style.position = 'absolute';

    // position to top
    module.settings.popover.style.top = triggerSize.offsetBottom + 'px';

    // position to right
    if(triggerSize.left - popoverSize.width > 0){
      module.settings.popover.style.left = 'auto';
      module.settings.popover.style.right = window.innerWidth - triggerSize.right + 'px';
    }
    // position to left
    else if(triggerSize.left + popoverSize.width < window.innerWidth){
      module.settings.popover.style.right = 'auto';
      module.settings.popover.style.left = triggerSize.left + 'px';
    }
    // position to center
    else {
      module.settings.popover.style.right = 'auto';
      module.settings.popover.style.left = triggerSize.left + (triggerSize.width - popoverSize.width) / 2 + 'px';
    }
  };



  module.init();

};