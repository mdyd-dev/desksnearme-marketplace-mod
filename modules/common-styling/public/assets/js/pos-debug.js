/*
  initializes pos modules
*/



// purpose:		debuging method that outputs data into the console
// arguments: should the function run (bool)
//            id of the module for which the debug data is printed (string)
//            textual information about what is happening (string)
//            optional data printed and parsed in the console (any)
// ------------------------------------------------------------------------
pos.modules.debug = (active, moduleId, information, data = '') => {
  if(active || pos.debug){

    if(moduleId === 'event'){
      console.log(`%c⚑%c${information}`, 'padding: .2em .5em; background-color: #000; color: #fff; border-radius: 4px;', 'margin-inline-start: .5em; padding: .2em .5em; background-color: #000; color: #fff; border-radius: 4px;', data);
    } else {
  
      const stringToColor = (string, saturation = 100, lightness = 80) => {
        let hash = 0;
        for (let i = 0; i < string.length; i++) {
          hash = string.charCodeAt(i) + ((hash << 5) - hash);
          hash = (hash & hash) * 100;
        }
        return `hsl(${(hash % 360)}, ${saturation}%, ${lightness}%)`;
      }

      console.log(`%c${moduleId}%c ${information}`, `padding: .2em .5em; background-color: ${stringToColor(moduleId)}; border-radius: 4px;`, 'all: revert;', data);
    }
  }
};