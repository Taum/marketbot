
/**
*Check if we currently match the desktop media query (small = min-width: 640px)
*/
export const runCheckIsDesktop = () => {
  return window && window.matchMedia && window.matchMedia('(min-width: 640px)').matches;
}
