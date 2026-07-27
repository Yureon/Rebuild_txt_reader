#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'../..');
const code=fs.readFileSync(path.join(root,'public/scripts/theme-boot.js'),'utf8');
function makeStyle(){const values={};return{values,setProperty(name,value){values[name]=String(value)},getPropertyValue(name){return values[name]||''},backgroundColor:'',colorScheme:''};}
function makeNode(){
  const classes=new Set();
  return{dataset:{},style:makeStyle(),classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name)},contains(name){return classes.has(name)}}};
}
function execute(storageValues){
  const rootNode=makeNode();
  const body=makeNode();
  const meta={content:'',setAttribute(name,value){if(name==='content')this.content=String(value)}};
  const listeners={};
  const document={documentElement:rootNode,body,querySelector(selector){return selector==='meta[name="theme-color"]'?meta:null},addEventListener(name,fn){listeners[name]=fn}};
  const localStorage={getItem(key){return Object.prototype.hasOwnProperty.call(storageValues,key)?storageValues[key]:null},setItem(key,value){storageValues[key]=String(value)}};
  const context={window:{matchMedia(){return{matches:false}}},document,localStorage,MutationObserver:undefined,console};
  context.globalThis=context;
  vm.runInNewContext(code,context,{filename:'theme-boot.js'});
  return{root:rootNode,body,meta,boot:context.window.__TXT_READER_BOOT_THEME__};
}
const user=execute({
  'txt-reader.rebuild.activeThemeScope':'alice',
  'txt-reader.rebuild.scope.alice.prefs':JSON.stringify({themeMode:'dark',themePresetId:'custom',themeColors:{bg:'#112233',surface:'#223344',text:'#f1f2f3',accent:'#abcdef',readerBg:'#101820',readerText:'#eeeeee'}})
});
assert.equal(user.root.dataset.themeScope,'alice');
assert.equal(user.root.dataset.theme,'dark');
assert.equal(user.root.style.values['--bg'],'#112233');
assert.equal(user.root.style.values['--surface'],'#223344');
assert.equal(user.body.style.values['--accent'],'#abcdef');
assert.equal(user.meta.content,'#112233');
assert.equal(user.boot.scope,'alice');
const owner=execute({'txt-reader.rebuild.activeThemeScope':'owner'});
assert.equal(owner.root.dataset.themeScope,'owner');
assert.equal(owner.root.style.values['--bg'],'#0d0d0d');
assert.equal(owner.root.style.values['--accent'],'#4ade80');
assert.equal(owner.boot.owner,true);
const anonymous=execute({});
assert.equal(anonymous.root.dataset.themeScope,'default');
assert.equal(anonymous.root.style.values['--bg'],'#f1ece3');
console.log(JSON.stringify({pass:'v680-theme-runtime-contract-pass',scenarios:3}));
