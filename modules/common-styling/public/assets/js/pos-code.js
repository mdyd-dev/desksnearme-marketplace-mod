  /*
  code highlighting
*/


pos.modules.code = function(settings){

  // cache 'this' value not to be overwritten later
  const module = this;


  // purpose:		settings that are being used across the module
  // ------------------------------------------------------------------------
  module.settings = {};

  // code container (dom node)
  module.settings.container = settings.container;
  // unique id for the module (string)
  module.settings.id = settings.id;
  // to enable debug mode (bool)
  module.settings.debug = (typeof settings.debug === 'boolean') ? settings.debug : false;

  // highlightjs instance
  module.settings.highlightJs = hljs;


  // purpose:		initializes the component
  // ------------------------------------------------------------------------
  module.init = () => {
    if(!module.settings.id){
      console.error('Please provide unique ID for the code module instance', module.settings.container);
    }

    pos.modules.debug(module.settings.debug, module.settings.id, 'Initializing code tools', module.settings.container);

    module.highlight();
  }

  
  // purpose:		highlights the code
  // ------------------------------------------------------------------------
  module.highlight = () => {
    module.settings.highlightJs.highlightElement(module.settings.container);

    pos.modules.debug(module.settings.debug, module.settings.id, 'Highlighted code', module.settings.container);
  };



  module.init();

};