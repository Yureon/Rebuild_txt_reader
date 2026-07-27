import assert from 'node:assert/strict';

class FakeClassList {
  constructor(){ this.values=new Set(); }
  add(...xs){ xs.forEach(x=>this.values.add(x)); }
  remove(...xs){ xs.forEach(x=>this.values.delete(x)); }
  toggle(x,force){ if(force===undefined){ if(this.values.has(x)){this.values.delete(x);return false;}this.values.add(x);return true;} if(force)this.values.add(x);else this.values.delete(x);return !!force; }
  contains(x){ return this.values.has(x); }
}
class FakeStyle {
  constructor(){this.props=new Map();}
  setProperty(k,v){this.props.set(k,String(v));}
  getPropertyValue(k){return this.props.get(k)||'';}
}
class FakeElement {
  constructor(id=''){this.nodeType=1;this.id=id;this.dataset={};this.style=new FakeStyle();this.classList=new FakeClassList();this.listeners=new Map();this.attributes=new Map();this.children=[];this.value='';this.textContent='';this.checked=false;this.disabled=false;this.hidden=false;}
  addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x!==fn));}
  setAttribute(k,v){this.attributes.set(k,String(v));}
  getAttribute(k){return this.attributes.get(k)??null;}
  hasAttribute(k){return this.attributes.has(k);}
  querySelectorAll(){return [];}
  append(...nodes){this.children.push(...nodes.filter(Boolean));}
  replaceChildren(...nodes){this.children=[...nodes.filter(Boolean)];}
  remove(){this.removed=true;}
  async trigger(type,extra={}){const event={target:this,currentTarget:this,preventDefault(){},...extra};return Promise.all((this.listeners.get(type)||[]).map(fn=>fn(event)));}
  click(){return this.trigger('click');}
}
const elements=new Map();
const get=(id)=>{if(!elements.has(id))elements.set(id,new FakeElement(id));return elements.get(id);};
const bgSwatch=new FakeElement();bgSwatch.dataset.previewBg='#1a1612';
const textSwatch=new FakeElement();textSwatch.dataset.previewText='#ffffff';
const body=new FakeElement('body');body.dataset={};body.append=(...nodes)=>body.children.push(...nodes);
const root=new FakeElement('html');
globalThis.Node=FakeElement; globalThis.Node.ELEMENT_NODE=1;
globalThis.NodeFilter={SHOW_TEXT:4,FILTER_REJECT:2,FILTER_ACCEPT:1};
globalThis.document={
  body,documentElement:root,
  getElementById:id=>elements.get(id)||null,
  createElement:tag=>new FakeElement(tag),
  createTextNode:text=>{const node=new FakeElement('#text');node.nodeType=3;node.nodeValue=String(text);node.textContent=String(text);return node;},
  createTreeWalker:()=>({nextNode:()=>null}),
  querySelectorAll(selector){
    if(selector==='[data-preview-bg]')return [bgSwatch];
    if(selector==='[data-preview-text]')return [textSwatch];
    return [];
  }
};
globalThis.window={setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:false})};
globalThis.requestAnimationFrame=fn=>fn();
globalThis.localStorage={data:new Map(),getItem(k){return this.data.get(k)||null;},setItem(k,v){this.data.set(k,String(v));},removeItem(k){this.data.delete(k);}};
globalThis.location={href:''};
globalThis.confirm=()=>true;

const [{bindAppearanceControls,applyPrefs},{bindDataTools},{installReadDataModal},{activateSettingsTab}] = await Promise.all([
  import('../../public/scripts/rebuild/features/settings/appearance.mjs'),
  import('../../public/scripts/rebuild/features/settings/data-tools.mjs'),
  import('../../public/scripts/rebuild/features/bookmarks/read-data-modal.mjs'),
  import('../../public/scripts/rebuild/features/settings/tab-switching.mjs')
]);

const defaults={
  themeMode:'light',uiFontSize:15,brightness:100,padH:24,padV:40,readerBg:'#faf7f2',readerText:'#2a2118',themeColors:null,
  animationsMs:220,readerFontSize:18,lineHeight:2.0,width:680,fontFamily:'system',fontFamilyDevice:'',customCss:'',customCssDevice:'',
  settingsMainTab:'general-panel',viewerSubTab:'vtext-panel',funcSubTab:'fcontrol-panel',searchByFilename:false,
  preprocess:{removeNoise:false,chapterSpacing:true,collapseBreaks:false,splitDense:false,dialogueBreak:false,paragraphOptimize:false,aggressive:false},
  tapNavEnabled:true,tapDirection:'vertical',tapScrollPercent:90,tapAnim:true,tapSpeed:400,swipeNav:true,swipeThreshold:50,
  readerEpisodeBoundaryMode:'manual',showClock:true,showProgress:true,showNetwork:true,safeClockPos:'left',safeProgressPos:'right',safeNetworkPos:'auto',
  safeRemainingShow:false,safeViewportAutoFit:false,safeTopInsetExtra:0,safeBottomInsetExtra:0,safeViewportProfiles:[],safeViewportProfileId:'',clockHour12:false,clockAmPm:false,timezone:'Asia/Seoul',timezoneOffset:540,
  siteLanguage:'ko',siteCustomLanguages:[]
};
const ids=['viewer-preview-stats','viewer-preview-content','viewer-preview-size-down','viewer-preview-size-up','viewer-preview-brightness','brightness-range','brightness-val','fs-val','lh-slider','lh-value','lw-slider','lw-value','pad-h-slider','pad-h-val','pad-v-slider','pad-v-val','custom-bg','custom-text','ui-fs-val','ui-fs-slider','anim-val','anim-range','tap-nav-toggle','settings-reset-sync-btn','settings-reset-shared-btn','settings-reset-device-btn','settings-reset-sync-status','settings-reset-appearance-btn','settings-reset-controls-btn','settings-reset-preprocess-btn','settings-reset-all-btn','open-read-data-btn','read-data-overlay','read-data-modal','rdm-close-btn','rdm-tabs','rdm-summary','rdm-import-preview','rdm-body','rdm-del-all-btn','rdm-export-btn','rdm-import-btn','rdm-import-file'];
const els={};
for(const id of ids){const key=id.replace(/-([a-z0-9])/g,(_,c)=>c.toUpperCase());els[key]=get(id);}
const apiCalls={shared:[],device:[]};
const app={
  state:{prefs:structuredClone(defaults),defaults:structuredClone(defaults),deviceId:'dev-1',deviceName:'Device 1',shared:{viewerPrefs:{}},device:{prefs:{}},bookmarks:[],progress:{lastRead:null,byNovel:{},positions:{},readMeta:{}},recents:[],favorites:new Set(),userTags:[],novelById:new Map(),readDataTab:'progress'},
  els,reader:{invalidateLayout(){},persistProgress(){}},bookmarks:{persist(){}},viewportFit:{refresh(){}},lazyFeatures:{isLoaded:()=>false},
  openLayer(name){this.lastOpenedLayer=name;},closeLayer(name){this.lastClosedLayer=name;},
  api:{
    async putShared(payload){apiCalls.shared.push(payload);return {success:true,skipped:false,sharedVersion:apiCalls.shared.length,shared:{viewerPrefs:payload.viewerPrefs}};},
    async putDevice(payload){apiCalls.device.push(payload);return {success:true,skipped:false,deviceVersion:apiCalls.device.length,device:{prefs:payload.prefs}};}
  }
};


const settingsTabs=['general-panel','viewer-panel','func-panel','data-panel'].map(id=>{const tab=new FakeElement(`tab-${id}`);tab.dataset.tab=id;return tab;});
const settingsPanels=['general-panel','viewer-panel','func-panel','data-panel'].map(id=>new FakeElement(id));
assert.equal(activateSettingsTab(settingsTabs[1],settingsTabs,settingsPanels),true);
assert.equal(settingsPanels[1].hidden,false,'actual tab helper must reveal selected panel');
assert.equal(settingsPanels[0].hidden,true,'actual tab helper must hide inactive panel');
assert.equal(settingsTabs[1].getAttribute('aria-selected'),'true');

bindAppearanceControls(app);
applyPrefs(app);
const start=app.state.prefs.readerFontSize;
await els.viewerPreviewSizeUp.trigger('click');
assert.equal(app.state.prefs.readerFontSize,start+1);
els.viewerPreviewBrightness.value='113';await els.viewerPreviewBrightness.trigger('input');
assert.equal(app.state.prefs.brightness,113);
await bgSwatch.trigger('click');
assert.equal(app.state.prefs.readerBg,'#1a1612');
assert.ok(els.viewerPreviewStats.children.some(node=>String(node.textContent).includes('113%')));
assert.equal(els.tapNavToggle.checked,true,'applyPrefs must synchronize functional controls');

bindDataTools(app,{applyPrefs});
app.state.prefs.themeMode='dark';
await els.settingsResetSharedBtn.trigger('click');
await app.state.sharedSyncRequest;
assert.equal(app.state.prefs.themeMode,'light');
assert.equal(apiCalls.shared.length,1);
assert.equal(apiCalls.shared[0].viewerPrefs.themeMode,'light');
app.state.prefs.settingsMainTab='data-panel';
await els.settingsResetDeviceBtn.trigger('click');
await app.state.deviceSyncRequest;
assert.equal(app.state.prefs.settingsMainTab,'general-panel');
assert.equal(apiCalls.device.length,1);
assert.equal(apiCalls.device[0].prefs.settingsMainTab,'general-panel');
assert.match(els.settingsResetSyncStatus.textContent,/서버에 반영했습니다/);

const novel={id:'novel-1',title:'실제 독서 데이터 연결 검증',episodes:[{id:'episode-1',title:'1화'}]};
app.state.novelById.set(novel.id,novel);
app.state.progress.readMeta['novel-1-episode-1']={novelId:'novel-1',episodeId:'episode-1',globalBlockIndex:24,ts:Date.now()};
installReadDataModal(app);
await els.openReadDataBtn.trigger('click');
assert.equal(app.lastOpenedLayer,'readDataOverlay');
assert.equal(els.rdmTabs.children.length,4);
assert.ok(els.rdmBody.children.length>=1);

console.log(JSON.stringify({pass:'v659-settings-actual-bindings-runtime-pass',appearanceMutations:3,syncApiCalls:2,readDataOpenBindings:1,tabSwitchBindings:1},null,2));
