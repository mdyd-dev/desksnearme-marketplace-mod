/*
  handles collapsible lists
*/


window.pos.modules.collapsible = function(userSettings){

  // cache 'this' value not to be overwritten later
  const module = this;


  // purpose:		settings that are being used across the module
  // ------------------------------------------------------------------------
  module.settings = {};
  // dialog container (dom node)
  module.settings.container = userSettings.container;
  // id used to mark the module (string)
  module.settings.id = userSettings.id || module.settings.container.id;
  // selector for toggle button selector (string)
  module.settings.toggleButtonSelector = userSettings.toggleButtonSelector || '.pos-collapsible-toggle';
  // selector for container with submenu (string)
  module.settings.childrenContainerSelector = userSettings.childrenContainerSelector || '.pos-collapsible-children';
  // to enable debug mode (bool)
  module.settings.debug = (userSettings?.debug) ? userSettings.debug : false;



  // purpose:		initializes the component
  // ------------------------------------------------------------------------
  module.init = () => {
    pos.modules.debug(module.settings.debug, module.settings.id, 'Initializing collapsible list', module.settings);

    module.settings.container.addEventListener('click', event => {
      if(event.target.matches(module.settings.toggleButtonSelector)){
        event.preventDefault();

        module.toggle(event.target.parentElement);
      }
    });

    module.settings.container.addEventListener('keydown', module.keyboard);
  };


  // purpose:		expands a submenu
  // arguments: list item that you want to expand (dom node)
  // ------------------------------------------------------------------------
  module.open = menu => {
    menu.querySelector(module.settings.childrenContainerSelector).removeAttribute('inert');
    menu.querySelector(module.settings.toggleButtonSelector).setAttribute('aria-expanded', true);

    pos.modules.debug(module.settings.debug, module.settings.id, 'Expanded menu', menu);
    document.dispatchEvent(new CustomEvent('pos-collapsible-opened', { bubbles: true, detail: { target: menu, container: module.settings.container, id: module.settings.id } }));
    pos.modules.debug(module.settings.debug, 'event', 'pos-collapsible-opened', { target: menu, container: module.settings.container, id: module.settings.id });
  };


  // purpose:		collapses a submenu
  // arguments: list item that you want to collapse (dom node)
  // ------------------------------------------------------------------------
  module.close = menu => {
    
    menu.querySelector(module.settings.childrenContainerSelector).setAttribute('inert', '');
    menu.querySelector(module.settings.childrenContainerSelector).querySelectorAll(`${module.settings.childrenContainerSelector}`).forEach(submenu => {
      pos.modules.debug(module.settings.debug, module.settings.id, 'Collapsed submenu', submenu);
      
      submenu.setAttribute('inert', '');
    });
    menu.querySelector(module.settings.toggleButtonSelector).setAttribute('aria-expanded', false);
    
    pos.modules.debug(module.settings.debug, module.settings.id, 'Collapsed menu', menu);
    document.dispatchEvent(new CustomEvent('pos-collapsible-closed', { bubbles: true, detail: { target: menu, container: module.settings.container, id: module.settings.id } }));
    pos.modules.debug(module.settings.debug, 'event', 'pos-collapsible-closed', { target: menu, container: module.settings.container, id: module.settings.id });
  };


  // purpose:   expands hidden menu or collapses already visible one
  // arguments: list item that you want to toggle (dom node)
  // ------------------------------------------------------------------------
  module.toggle = menu => {
    if(menu.querySelector(module.settings.childrenContainerSelector).inert){
      module.open(menu);
    } else {
      module.close(menu);
    }
  };


  // purpose:		handles keyboard navigation
  // ------------------------------------------------------------------------
  module.keyboard = event => {
    if(event.key === 'ArrowRight'){
      event.preventDefault();

      if(document.activeElement.parentElement.querySelector(module.settings.toggleButtonSelector)){
        module.open(event.target.parentElement);
      }
    }
    else if(event.key === 'ArrowLeft'){
      event.preventDefault();

      if(document.activeElement.parentElement.querySelector(module.settings.toggleButtonSelector)){
        module.close(event.target.parentElement);
      }
    }
  };




  module.init();

};