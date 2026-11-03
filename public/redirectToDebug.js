// TEMPORARY — delete this file + its <script> tag when done debugging.
(function() {
  'use strict';
  // Don't redirect if we're already on debug.html (avoids loops)
  if (/\/debug\.html?$/i.test(location.pathname)) return;
  // Preserve query string (e.g. ?category_id=…) if you use one
  location.replace('debug.html' + location.search + location.hash);
})();
