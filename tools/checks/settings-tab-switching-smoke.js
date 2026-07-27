const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const SETTINGS_TAB_SWITCHING_SMOKE_PASS = 'v233-settings-tab-switching-smoke-pass';

async function runSettingsTabSwitchingSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runSettingsTabSwitchingSmoke requires projectRoot');
  const script = String.raw`
    const { activateSettingsTab, activateSettingsTabById, getSettingsTabPanelId } = await import('./public/scripts/rebuild/features/settings/tab-switching.mjs');
    const makeClassList = () => {
      const values = new Set();
      return {
        add(value){ values.add(value); },
        remove(value){ values.delete(value); },
        contains(value){ return values.has(value); },
        toggle(value, force){
          const next = force === undefined ? !values.has(value) : !!force;
          if (next) values.add(value); else values.delete(value);
          return next;
        }
      };
    };
    const makeTab = id => ({ dataset:{ tab:id }, classList:makeClassList(), attrs:{}, setAttribute(key,value){ this.attrs[key]=String(value); }, focus(){ this.focused=true; } });
    const makePanel = id => ({ id, classList:makeClassList(), attrs:{}, scrollTop:99, setAttribute(key,value){ this.attrs[key]=String(value); } });
    const tabs = [makeTab('general-panel'), makeTab('data-panel'), makeTab('viewer-panel'), makeTab('func-panel')];
    const panels = [makePanel('general-panel'), makePanel('data-panel'), makePanel('viewer-panel'), makePanel('func-panel')];
    if (getSettingsTabPanelId(tabs[2]) !== 'viewer-panel') throw new Error('settings tab panel id resolver failed');
    if (!activateSettingsTab(tabs[2], tabs, panels)) throw new Error('settings tab activation returned false for viewer panel');
    if (!tabs[2].classList.contains('active') || !panels[2].classList.contains('active')) throw new Error('viewer tab/panel did not activate');
    if (tabs[0].classList.contains('active') || panels[0].classList.contains('active')) throw new Error('previous general tab/panel stayed active');
    if (!activateSettingsTabById('func-panel', tabs, panels)) throw new Error('settings tab activation by id returned false for func panel');
    if (!tabs[3].classList.contains('active') || !panels[3].classList.contains('active')) throw new Error('func tab/panel did not activate by id');
    if (activateSettingsTabById('missing-panel', tabs, panels) !== false) throw new Error('missing tab id must not activate');
  `;
  await runModuleSmokeScript(projectRoot, script, { label: 'settings tab switching smoke', timeoutMs: 8000 })
  return { pass: SETTINGS_TAB_SWITCHING_SMOKE_PASS };
}

module.exports = {
  SETTINGS_TAB_SWITCHING_SMOKE_PASS,
  runSettingsTabSwitchingSmoke
};
