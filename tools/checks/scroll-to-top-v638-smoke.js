#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'public/scripts/scroll-to-top.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles/scroll-to-top.css'),'utf8');

(async()=>{
  const listeners={};
  const rootScroller={nodeType:1,scrollTop:520,scrollHeight:1500,clientHeight:600,isConnected:true,scrollTo(options){this.scrollTop=Number(options.top)||0;this.lastBehavior=options.behavior;}};
  let button=null;
  const body={appendChild(node){button=node;node.isConnected=true;},classList:{add(){},toggle(){},contains(){return false;}}};
  const document={
    readyState:'complete',scrollingElement:rootScroller,documentElement:{dataset:{}},body,
    getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return[];},
    createElement(){
      const events={};
      return {nodeType:1,id:'',className:'',type:'',hidden:false,textContent:'',isConnected:false,attrs:{},
        setAttribute(name,value){this.attrs[name]=String(value);},addEventListener(type,fn){events[type]=fn;},click(){events.click && events.click({target:this});}};
    },
    addEventListener(type,fn){listeners[type]=fn;}
  };
  const window={
    requestAnimationFrame(fn){Promise.resolve().then(fn);return 1;},
    setTimeout(fn){fn();return 1;},
    addEventListener(type,fn){listeners['window:'+type]=fn;},
    matchMedia(){return{matches:true};}
  };
  vm.runInNewContext(source,{console,document,window,setTimeout:window.setTimeout,clearTimeout(){}} ,{filename:'scroll-to-top.js'});
  for(let i=0;i<6;i+=1) await Promise.resolve();
  assert(button,'scroll-to-top button must be created');
  assert.equal(button.hidden,false,'button must appear after threshold');
  button.click();
  assert.equal(rootScroller.scrollTop,0,'click must scroll active root to top');
  assert.equal(rootScroller.lastBehavior,'auto','reduced-motion mode must avoid smooth animation');
  assert(['v639-scroll-to-top-overlay-pass','v641-scroll-to-top-persistent-pass','v645-scroll-to-top-reader-suppression-pass'].includes(document.documentElement.dataset.scrollToTopPass));
  assert(css.includes('.txt-reader-scroll-top') && css.includes('env(safe-area-inset-bottom)'));
  for(const page of ['index.html','login.html','library.html','metadata.html','mobile.html','site.html','admin/users.html']) {
    const html=fs.readFileSync(path.join(root,'public',page),'utf8');
    assert(html.includes('/scripts/scroll-to-top.js?v=rebuild-v679'), `${page} missing scroll button script`);
  }
  console.log(JSON.stringify({pass:'v639-scroll-to-top-overlay-pass',visible:true,scrolled:true,pages:7}));
})().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
