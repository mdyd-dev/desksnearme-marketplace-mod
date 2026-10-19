/*
  positions the header popover menus relative to the trigger element
  can be removed when all browsers support anchor positioning
*/


// header popovers (dom nodes)
const popovers = document.querySelectorAll('.pos-community-header [popover]');

// start by positioning the popovers when page loads
popovers.forEach(popover => {
  positionHeaderPopoverFallback(popover, popover.parentElement.querySelector('[popovertarget]'));
});

// reposition each popover when browser widnow is resized
let headerPopoverDebounce;
window.addEventListener('resize', () => {
  clearTimeout(headerPopoverDebounce);

  headerPopoverDebounce = setTimeout(() => {
    popovers.forEach(popover => {
      positionHeaderPopoverFallback(popover, popover.parentElement.querySelector('[popovertarget]'));
    });
  }, 100);
});


// purpose:   sets the absolute position of the popover relative to the trigger element
// arguments: popover container (dom node),
//            trigger element that opens the popover (dom node)
// output:    sets the left and top position of the popover
// ------------------------------------------------------------------------
function positionHeaderPopoverFallback(popover, trigger){
  popover.style.position = 'absolute';
  popover.style.right = window.innerWidth - (trigger.getBoundingClientRect()).right + 'px';
  popover.style.top = `${trigger.bottom}px`;
}