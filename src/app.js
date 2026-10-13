/* USI · AMS — boot. Loaded last, after every module has registered itself. */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.document && document.getElementById('root') && !window.__AMS_NO_MOUNT__) window.AMS.mount();
})();
