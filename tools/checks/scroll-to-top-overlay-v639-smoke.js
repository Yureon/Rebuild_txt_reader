#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'public/scripts/scroll-to-top.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles/scroll-to-top.css'), 'utf8');

(async () => {
  const listeners = {};
  let mutationCallback = null;
  let overlayOpen = false;
  let button = null;
  const classes = new Set();
  const classList = {
    add(name){ classes.add(name); },
    contains(name){ return classes.has(name); },
    toggle(name, force){ if (force) classes.add(name); else classes.delete(name); return !!force; }
  };
  const documentScroller = { nodeType:1, scrollTop:520, scrollHeight:1600, clientHeight:600, isConnected:true, hidden:false, parentElement:null, getAttribute(){return null;}, scrollTo(options){this.scrollTop=Number(options.top)||0;} };
  const overlayRoot = { nodeType:1, scrollTop:0, scrollHeight:1400, clientHeight:500, isConnected:true, hidden:false, parentElement:null, getAttribute(){return null;}, scrollTo(options){this.scrollTop=Number(options.top)||0;this.lastBehavior=options.behavior;} };
  const body = { nodeType:1, hidden:false, isConnected:true, parentElement:null, classList, appendChild(node){button=node;node.isConnected=true;}, getAttribute(){return null;} };
  documentScroller.parentElement = body;
  overlayRoot.parentElement = body;
  const documentElement = { nodeType:1, dataset:{}, hidden:false, isConnected:true, parentElement:null, getAttribute(){return null;} };
  body.parentElement = documentElement;
  const document = {
    readyState:'complete', scrollingElement:documentScroller, documentElement, body, fullscreenElement:null,
    getElementById(){ return null; },
    querySelector(selector){ return selector === '.nav-bar' ? null : null; },
    querySelectorAll(selector){
      if (selector.startsWith('.library-metadata-overlay')) return overlayOpen ? [overlayRoot] : [];
      return [];
    },
    createElement(){
      const events={};
      return { nodeType:1, hidden:false, isConnected:false, attrs:{}, setAttribute(name,value){this.attrs[name]=String(value);}, addEventListener(type,fn){events[type]=fn;}, click(){events.click && events.click({target:this});} };
    },
    addEventListener(type,fn){ listeners[type]=fn; }
  };
  const window = {
    requestAnimationFrame(fn){ Promise.resolve().then(fn); return 1; },
    setTimeout(fn){ fn(); return 1; },
    addEventListener(type,fn){ listeners['window:'+type]=fn; },
    matchMedia(){ return { matches:true }; },
    getComputedStyle(){ return { display:'block', visibility:'visible' }; }
  };
  function MutationObserver(callback){ mutationCallback=callback; this.observe=()=>{}; }
  vm.runInNewContext(source,{ console, document, window, MutationObserver, setTimeout:window.setTimeout, clearTimeout(){} },{ filename:'scroll-to-top.js' });
  for(let i=0;i<8;i+=1) await Promise.resolve();
  assert(button && !button.hidden, 'document scroll should initially show the button');

  overlayOpen = true;
  mutationCallback && mutationCallback([]);
  for(let i=0;i<8;i+=1) await Promise.resolve();
  assert.equal(button.hidden, true, 'opening an unscrolled modal must hide the background scroll button');

  overlayRoot.scrollTop = 480;
  listeners.scroll && listeners.scroll({ target:overlayRoot });
  for(let i=0;i<8;i+=1) await Promise.resolve();
  assert.equal(button.hidden, false, 'scrolling the active modal must show the button');
  assert(classes.has('scroll-top-overlay-active'), 'overlay stacking mode must be active');
  button.click();
  assert.equal(overlayRoot.scrollTop, 0, 'button must scroll the active overlay, not the document');
  assert.equal(documentScroller.scrollTop, 520, 'background scroll position must remain unchanged');
  assert(css.includes('scroll-top-overlay-active') && css.includes('2147483200'), 'button must stack above high-z overlays');
  assert(['v639-scroll-to-top-overlay-pass','v641-scroll-to-top-persistent-pass','v645-scroll-to-top-reader-suppression-pass'].includes(document.documentElement.dataset.scrollToTopPass));
  console.log(JSON.stringify({ pass:'v639-scroll-to-top-overlay-pass', modalTargeted:true, backgroundPreserved:true }));
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
