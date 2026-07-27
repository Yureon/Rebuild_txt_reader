(function(){
  'use strict';
  var pass='v574-library-entry-router-pass';
  try { document.documentElement.dataset.libraryEntryRouterPass=pass; } catch(e) {}
  var next=new URL('/library.html', window.location.origin);
  var current=new URL(window.location.href);
  current.searchParams.forEach(function(value,key){ if(key!=='profile') next.searchParams.append(key,value); });
  next.hash=current.hash || '';
  window.location.replace(next.pathname + next.search + next.hash);
})();
