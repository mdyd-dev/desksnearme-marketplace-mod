/*
  automatically loads content from endpoint
  and places in in the container when the trigger is clicked

  usage: new pos.modules.load({
    trigger: [dom node],
    endpoint: [string].
    target: [string]
  });
*/



window.pos.modules.load = function(settings = {}){

  // cache 'this' value not to be overwritten later
  const module = this;

  // purpose:		settings that are being used across the module
  // ------------------------------------------------------------------------
  module.settings = {};
  // module id (string)
  module.settings.id = settings?.id || `load-${settings.target}`;
  // element that triggers the loading (dom node)
  module.settings.trigger = settings?.trigger || null;
  // url of the page to load (string)
  module.settings.endpoint = settings.endpoint;
  // selector for the container to load the content into (string)
  module.settings.target = settings.target;
  // do you want to replace or append the content (string)
  module.settings.where = settings.where || 'replace';
  // trigger to run the loading process (string or array of strings)
  module.settings.triggerType = settings.triggerType || 'click';
  // method used for request
  module.settings.method = settings.method?.toLowerCase() || 'get';
  // form data that will be send with the request (FormData)
  module.settings.formData = settings.formData || null;
  // if you want to enable debug mode that logs to console (bool)
  module.settings.debug = settings.debug || false;


  // purpose:		initializes the module
  // ------------------------------------------------------------------------
  module.init = function(){
    if(typeof module.settings.trigger === 'array'){
      module.settings.trigger.forEach(trigger => {
        module.settings.trigger.addEventListener(trigger, module.load);
      });
    } else {
      module.settings.trigger.addEventListener(module.settings.triggerType, module.load);
    }
  };


  // purpose:		fetch the data and load it into the container
  // output:    updates the container content
  // ------------------------------------------------------------------------
  module.load = async function(event){
    pos.modules.debug(module.settings.debug, module.settings.id, 'Loading frame', module.settings);

    event.preventDefault();

    let queryString = '';
    if(module.settings.method === 'get' && module.settings.formData){
      queryString = '?' + (new URLSearchParams(module.settings.formData).toString());
    }

    fetch(module.settings.endpoint + queryString, {
      method: module.settings.method,
      body: module.settings.method === 'post' ? module.settings.formData : null
    })
      .then(response => response.text())
      .then(html => {
        pos.modules.debug(module.settings.debug, module.settings.id, 'Frame loaded successfully', module.settings);

        let output = (document.createRange()).createContextualFragment(html);
        const nodes = [...output.childNodes];

        if(module.settings.where === 'replace'){
          document.querySelector(module.settings.target).replaceChildren(output);
          pos.modules.debug(module.settings.debug, module.settings.id, 'Replaced the container content with fetched data', nodes);
        }
        else if(module.settings.where === 'last'){
          document.querySelector(module.settings.target).append(output);
          pos.modules.debug(module.settings.debug, module.settings.id, 'Appended fetched data to the container', nodes);
        }

        module.settings.trigger.dispatchEvent(new CustomEvent('pos-frame-loaded', { bubbles: true, detail: { ...module.settings, html: html, nodes: nodes } }));
        pos.modules.debug(module.settings.debug, 'event', `pos-frame-loaded`, { ...module.settings, html: html, nodes: nodes });
      });
  };


  // purpose:		removed event listeners and cleans up the module
  // ------------------------------------------------------------------------
  module.destroy = function(){
    if(typeof module.settings.trigger === 'array'){
      module.settings.trigger.forEach(trigger => {
        module.settings.trigger.removeEventListener(trigger, module.load);
      });
    } else {
      module.settings.trigger.removeEventListener(module.settings.triggerType, module.load);
    }

    pos.modules.debug(module.settings.debug, module.settings.id, 'Destroyed module', module.settings);
    module.settings = {};
  };



  module.init();

};