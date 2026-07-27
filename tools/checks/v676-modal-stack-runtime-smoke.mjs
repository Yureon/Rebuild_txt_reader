#!/usr/bin/env node
import assert from 'node:assert/strict';
class El{
 constructor(name){this.name=name;this.inert=false;this.attrs=new Map();this.hidden=false;this.isConnected=true;this.children=[];this.parentElement=null;}
 setAttribute(k,v){this.attrs.set(k,String(v));} getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;} removeAttribute(k){this.attrs.delete(k);} hasAttribute(k){return this.attrs.has(k);} querySelectorAll(){return [];} getClientRects(){return [1];} contains(n){return n===this;} focus(){document.activeElement=this;}
}
const listeners=new Map();
const body=new El('body'); body.children=[];
globalThis.document={body,activeElement:null,addEventListener(t,fn){listeners.set(fn,t)},removeEventListener(t,fn){listeners.delete(fn)}};
globalThis.requestAnimationFrame=fn=>fn();
const app=new El('app'),o1=new El('overlay1'),d1=new El('dialog1');o1.parentElement=body;d1.parentElement=o1;body.children=[app,o1];document.activeElement=app;
const {activateModalFocus,getActiveModalCount}=await import('../../public/scripts/rebuild/features/ui/modal-focus-manager.mjs');
const close1=activateModalFocus({overlay:o1,dialog:d1,accessibleName:'첫 번째'});
assert.equal(app.inert,true);assert.equal(o1.inert,false);
const o2=new El('overlay2'),d2=new El('dialog2');o2.parentElement=body;d2.parentElement=o2;body.children.push(o2);
const close2=activateModalFocus({overlay:o2,dialog:d2,accessibleName:'두 번째'});
assert.equal(getActiveModalCount(),2);assert.equal(app.inert,true);assert.equal(o1.inert,true);assert.equal(o2.inert,false);
close1();
assert.equal(getActiveModalCount(),1);assert.equal(app.inert,true,'background must remain inert');assert.equal(o2.inert,false,'top modal must remain interactive');
o1.isConnected=false;body.children=body.children.filter(x=>x!==o1);
close2();
assert.equal(getActiveModalCount(),0);assert.equal(app.inert,false,'background inert must restore');assert.equal(app.getAttribute('aria-hidden'),null);assert.equal(document.activeElement,app,'base focus must restore');
console.log(JSON.stringify({pass:'v676-modal-stack-runtime-smoke-pass',outOfOrderClose:true,backgroundRestored:true,focusRestored:true}));
