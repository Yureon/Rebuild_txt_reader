(function loginPageRuntime(){
  'use strict';
  var loginForm=document.getElementById('login-form'),registerForm=document.getElementById('register-form');
  var loginPanel=document.getElementById('login-panel'),registerPanel=document.getElementById('register-panel');
  var tabLogin=document.getElementById('tab-login'),tabRegister=document.getElementById('tab-register');
  var msgBox=document.getElementById('message'),msgTxt=document.getElementById('message-text'),modeCopy=document.getElementById('mode-copy');
  var loginBtn=document.getElementById('login-btn'),registerBtn=document.getElementById('register-btn');
  var idInput=document.getElementById('login-id'),pwInput=document.getElementById('login-pw'),capsMsg=document.getElementById('caps-msg');
  var offlineBannerText=document.getElementById('offline-banner-text');
  var LOGIN_SESSION_VERIFY_CLIENT_PASS='v391-login-session-verify-client-pass';
  var REGISTER_CLIENT_PASS='v397-signup-code-register-client-pass';
  var USER_THEME_LOGIN_PRIME_PASS='v680-login-user-theme-prime-pass';
  var ACTIVE_THEME_SCOPE_KEY='txt-reader.rebuild.activeThemeScope';
  var SCOPED_PREFIX='txt-reader.rebuild.scope.';

  function normalizeScope(value){
    var text=String(value||'').trim();
    try{text=text.normalize('NFC')}catch(_error){}
    var cleaned=text.replace(/[^a-zA-Z0-9._@-]/g,'_').slice(0,160);
    return cleaned||'';
  }
  function setActiveThemeScope(scope){
    try{localStorage.setItem(ACTIVE_THEME_SCOPE_KEY,String(scope||''))}catch(_error){}
  }
  function mergeCachedTheme(userId,prefs){
    var scope=normalizeScope(userId);
    if(!scope)return;
    setActiveThemeScope(scope);
    var key=SCOPED_PREFIX+scope+'.prefs';
    try{
      var current={};
      var raw=localStorage.getItem(key);
      if(raw){try{current=JSON.parse(raw)||{}}catch(_error){current={}}}
      localStorage.setItem(key,JSON.stringify(Object.assign({},current,prefs&&typeof prefs==='object'?prefs:{})));
      localStorage.setItem('txt-reader.theme-login-prime-pass',USER_THEME_LOGIN_PRIME_PASS);
    }catch(_error){}
  }
  function primeThemeForSession(data){
    if(String(data&&data.sessionKind||'')==='owner'){
      setActiveThemeScope('owner');
      return Promise.resolve(data);
    }
    var userId=String(data&&data.userId||'');
    if(userId)setActiveThemeScope(normalizeScope(userId));
    var controller=typeof AbortController==='function'?new AbortController():null;
    var timer=controller?setTimeout(function(){controller.abort()},1800):0;
    return fetch('/api/theme-bootstrap',{
      method:'GET',
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json'},
      signal:controller&&controller.signal
    }).then(parseResponse).then(function(result){
      if(result.ok&&result.data&&result.data.sessionKind==='user')mergeCachedTheme(result.data.userId||userId,result.data.prefs||{});
      else if(result.ok&&result.data&&result.data.sessionKind==='owner')setActiveThemeScope('owner');
      return data;
    }).catch(function(){return data}).finally(function(){if(timer)clearTimeout(timer)});
  }
  function setMode(mode){
    var isRegister=mode==='register';
    loginPanel.hidden=isRegister;registerPanel.hidden=!isRegister;
    tabLogin.classList.toggle('active',!isRegister);tabRegister.classList.toggle('active',isRegister);
    tabLogin.setAttribute('aria-selected',isRegister?'false':'true');tabRegister.setAttribute('aria-selected',isRegister?'true':'false');
    tabLogin.tabIndex=isRegister?-1:0;tabRegister.tabIndex=isRegister?0:-1;
    modeCopy.textContent=isRegister?'owner에게 받은 가입코드로 일반 독서 계정을 만드세요.':'Owner 계정 또는 발급된 일반 계정으로 로그인하세요.';
    hideMessage();setTimeout(function(){(isRegister?document.getElementById('register-id'):idInput).focus()},0);
  }
  function hideMessage(){msgBox.classList.remove('show','ok','error');msgTxt.textContent=''}
  function showMessage(message,ok){msgTxt.textContent=message||'';msgBox.classList.toggle('ok',!!ok);msgBox.classList.toggle('error',!ok);msgBox.classList.add('show')}
  function resetLoginButton(){loginBtn.disabled=false;loginBtn.removeAttribute('aria-busy');loginBtn.textContent='입장하기'}
  function resetRegisterButton(){registerBtn.disabled=false;registerBtn.removeAttribute('aria-busy');registerBtn.textContent='회원가입'}
  function parseResponse(response){return response.text().then(function(text){var data=null;try{data=text?JSON.parse(text):null}catch(_error){data={raw:text}}return{ok:response.ok,status:response.status,data:data||{},raw:text}})}
  function formatDetail(data){
    if(!data||typeof data!=='object')return'';
    var parts=[];
    if(data.error)parts.push('error='+data.error);if(data.origin)parts.push('origin='+data.origin);if(data.fetchSite)parts.push('fetchSite='+data.fetchSite);
    if(Array.isArray(data.allowedOrigins)&&data.allowedOrigins.length)parts.push('allowed='+data.allowedOrigins.join(','));
    if(data.diagnostic){var d=data.diagnostic;if(d.nodeEnv)parts.push('NODE_ENV='+d.nodeEnv);if(d.deploymentMode)parts.push('DEPLOYMENT_MODE='+d.deploymentMode);if(d.requestProtocol)parts.push('protocol='+d.requestProtocol);if(d.forwardedProto)parts.push('x-forwarded-proto='+d.forwardedProto);if(d.cloudflareVisitorScheme)parts.push('cf-visitor.scheme='+d.cloudflareVisitorScheme);if(d.cloudflareVisitorHttpsTrusted)parts.push('cf-visitor.trusted='+d.cloudflareVisitorHttpsTrusted)}
    return parts.length?' ('+parts.join(' · ')+')':'';
  }
  function errorMessage(result,fallback){var data=result&&result.data||{};var status=result&&result.status?'HTTP '+result.status+' · ':'';return status+(data.message||data.error||data.raw||fallback||'요청 실패')+formatDetail(data)}
  function verifySession(){return fetch('/api/csrf',{method:'GET',credentials:'same-origin',cache:'no-store'}).then(parseResponse).then(function(result){if(!result.ok||!result.data||!result.data.csrfToken){throw new Error(errorMessage(result,'로그인은 성공했지만 세션 쿠키 확인에 실패했습니다. HTTP + NODE_ENV=production 조합에서는 Secure 쿠키가 저장되지 않습니다.'))}return result.data})}

  loginForm.addEventListener('submit',function(event){
    event.preventDefault();
    var id=idInput.value.trim(),pw=pwInput.value;if(!id||!pw)return;
    loginBtn.disabled=true;loginBtn.setAttribute('aria-busy','true');loginBtn.textContent='확인 중';hideMessage();
    fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({id:id,pw:pw})})
      .then(parseResponse)
      .then(function(result){var data=result.data||{};if(!result.ok||!data.success)throw new Error(errorMessage(result,'로그인 실패'));try{localStorage.setItem('login_session_verify_pass',LOGIN_SESSION_VERIFY_CLIENT_PASS)}catch(_error){}loginBtn.textContent='세션 확인 중';return verifySession().then(function(){return data})})
      .then(function(data){loginBtn.textContent='테마 준비 중';return primeThemeForSession(data)})
      .then(function(data){loginBtn.textContent='✓ 입장 중';window.location.assign(data.redirectTo||'/library.html')})
      .catch(function(error){resetLoginButton();showMessage(error.message||'로그인 실패',false)});
  });

  registerForm.addEventListener('submit',function(event){
    event.preventDefault();
    var username=document.getElementById('register-id').value.trim(),password=document.getElementById('register-pw').value,passwordConfirm=document.getElementById('register-pw2').value,signupCode=document.getElementById('register-code').value.trim();
    if(!username||!password||!passwordConfirm||!signupCode)return;
    registerBtn.disabled=true;registerBtn.setAttribute('aria-busy','true');registerBtn.textContent='가입 확인 중';hideMessage();
    fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({username:username,password:password,passwordConfirm:passwordConfirm,signupCode:signupCode})})
      .then(parseResponse)
      .then(function(result){if(!result.ok||!result.data||!result.data.success)throw new Error(errorMessage(result,'회원가입 실패'));try{localStorage.setItem('register_client_pass',REGISTER_CLIENT_PASS)}catch(_error){}registerForm.reset();setMode('login');showMessage(result.data.message||'가입이 완료되었습니다. 로그인해 주세요.',true)})
      .catch(function(error){showMessage(error.message||'회원가입 실패',false)})
      .finally(resetRegisterButton);
  });

  tabLogin.onclick=function(){setMode('login')};tabRegister.onclick=function(){setMode('register')};
  idInput.addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();pwInput.focus()}});
  pwInput.addEventListener('keydown',function(event){if(event.key==='Enter')loginForm.requestSubmit()});
  pwInput.addEventListener('keyup',function(event){var isCaps=typeof event.getModifierState==='function'&&event.getModifierState('CapsLock');capsMsg.classList.toggle('show',!!isCaps)});
  window.addEventListener('online',function(){offlineBannerText.textContent='네트워크 연결 후 로그인할 수 있습니다.'});
  window.addEventListener('offline',function(){offlineBannerText.textContent='오프라인에서는 로그인할 수 없습니다.'});
  offlineBannerText.textContent=navigator.onLine?'네트워크 연결 후 로그인할 수 있습니다.':'오프라인에서는 로그인할 수 없습니다.';
  idInput.focus();
}());
