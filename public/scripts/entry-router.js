(function(){
  function cleanSearch(params){
    params.delete('view');
    var qs = params.toString();
    return qs ? '?' + qs : '';
  }
  function decide(){
    var params = new URLSearchParams(location.search || '');
    var forced = String(params.get('view') || '').toLowerCase();
    if (forced === 'pc' || forced === 'desktop') forced = 'site';
    if (forced === 'mobile' || forced === 'site') {
      try { localStorage.setItem('txt-reader.rebuild.preferredEntry', forced); } catch(e) {}
      return forced;
    }
    var saved = '';
    try { saved = localStorage.getItem('txt-reader.rebuild.preferredEntry') || ''; } catch(e) {}
    if (saved === 'mobile' || saved === 'site') return saved;
    var ua = navigator.userAgent || '';
    var coarse = false;
    var narrow = false;
    try { coarse = matchMedia('(hover: none) and (pointer: coarse)').matches; } catch(e) {}
    try { narrow = matchMedia('(max-width: 760px)').matches; } catch(e) {}
    var mobileUa = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
    return (mobileUa || (coarse && narrow)) ? 'mobile' : 'site';
  }
  var target = decide();
  var params = new URLSearchParams(location.search || '');
  var next = new URL(target === 'mobile' ? 'mobile.html' : 'site.html', location.href);
  next.search = cleanSearch(params);
  next.hash = location.hash || '';
  location.replace(next.toString());
})();


try {
  var siteLink = document.getElementById('entry-site-link');
  var mobileLink = document.getElementById('entry-mobile-link');
  if (siteLink) siteLink.addEventListener('click', function(){ localStorage.setItem('txt-reader.rebuild.preferredEntry','site'); });
  if (mobileLink) mobileLink.addEventListener('click', function(){ localStorage.setItem('txt-reader.rebuild.preferredEntry','mobile'); });
} catch(e) {}
