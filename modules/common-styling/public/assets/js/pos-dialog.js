  /*
  handles openind and closing the dialog box

  usage:
*/



// purpose:   opens and closes the dialog box
// arguments: 
// ************************************************************************
window.pos.modules.dialog = function(userSettings){
  
  // cache 'this' value not to be overwritten later
  const module = this;

  // purpose:		settings that are being used across the module
  // ------------------------------------------------------------------------
  module.settings = {};
  // dialog container (dom node)
  module.settings.container = userSettings.container;
  // modal trigger (dom node)
  module.settings.trigger = userSettings.trigger;
  // id used to mark the module (string)
  module.settings.id = userSettings.id || module.settings.trigger.dataset.dialogtarget;
  // close button (dom nodes)
  module.settings.closeButtons = userSettings.closeButtons || module.settings.container?.querySelectorAll('.pos-dialog-close');
  // to enable debug mode (bool)
  module.settings.debug = (userSettings?.debug) ? userSettings.debug : false;



  // purpose:		initializes the component
  // ------------------------------------------------------------------------
  module.init = () => {
    pos.modules.debug(module.settings.debug, module.settings.id, 'Initializing dialog', module.settings);

    if(!module.settings.container){
      console.error('Could not find dialog container with ID ' + module.settings.id + ' while it\'s trigger is present', module.settings.trigger);
    }

    module.settings.trigger.addEventListener('click', event => {
      event.preventDefault();

      module.open();
    });

    module.settings.container?.addEventListener('toggle', event => {
      if(event.newState === 'open'){
        pos.modules.debug(module.settings.debug, module.settings.id, 'Dialog opened', module.settings.container);
        document.dispatchEvent(new CustomEvent('pos-dialog-opened', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id } }));
        pos.modules.debug(module.settings.debug, 'event', 'pos-dialog-opened', { target: module.settings.container, id: module.settings.id });
      } else if(event.newState === 'closed') {
        pos.modules.debug(module.settings.debug, module.settings.id, 'Dialog closed', module.settings.container);
        document.dispatchEvent(new CustomEvent('pos-dialog-closed', { bubbles: true, detail: { target: module.settings.container, id: module.settings.id } }));
        pos.modules.debug(module.settings.debug, 'event', 'pos-dialog-closed', { target: module.settings.container, id: module.settings.id });
      }
    });
  };


  // purpose:		opens the dialog
  // ------------------------------------------------------------------------
  module.open = () => {
    module.settings.container.showModal();

    module.settings.closeButtons.forEach(button => {
      button.addEventListener('click', module.close);
    });
  };


  // purpose:		closes the dialog
  // ------------------------------------------------------------------------
  module.close = () => {
    module.settings.closeButtons.forEach(button => {
      button.addEventListener('click', module.close);
    })

    module.settings.container.close();
  }



  module.init();

};