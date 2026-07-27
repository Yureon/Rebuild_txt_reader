#!/usr/bin/env python3
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
APP=(ROOT/'public/styles/app.css').read_text()
DEFER=(ROOT/'public/styles/deferred-ui.css').read_text()
FRAG=(ROOT/'public/fragments/deferred-ui.html').read_text()
RESULT=ROOT/'v660_reader_tabs_browser_results.json'

def build_html():
    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{APP}\n{DEFER}</style></head><body data-client-profile="site">{FRAG}<script>
const panel=document.getElementById('settings-panel');panel.classList.add('open');panel.dataset.settingsContext='reader';panel.dataset.settingsPresentation='modal';
const includesReader=node=>(node.dataset.settingsContexts||'').split(/\\s+/).includes('reader');
for(const node of document.querySelectorAll('[data-settings-contexts]')){{const ok=includesReader(node);node.hidden=!ok;node.setAttribute('aria-hidden',ok?'false':'true');if(!ok)node.setAttribute('inert','');else node.removeAttribute('inert');}}
for(const p of document.querySelectorAll('.sp-tab-panel')){{const active=p.id==='viewer-panel';p.hidden=!active;p.classList.toggle('active',active);p.setAttribute('aria-hidden',active?'false':'true')}}
for(const t of document.querySelectorAll('.sp-tab')){{if(t.hidden)continue;const active=t.dataset.tab==='viewer-panel';t.classList.toggle('active',active);t.setAttribute('aria-selected',active?'true':'false')}}
</script></body></html>'''

results=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width,height in [(280,568),(320,568),(360,640),(390,844),(430,800),(760,900),(1024,768)]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<=430,has_touch=width<=430)
        page=context.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(build_html(),wait_until='load')
        panel=page.locator('#settings-panel')
        nav=page.locator('#settings-panel .settings-workspace-nav')
        buttons=page.locator('#settings-panel .settings-workspace-nav .sp-tab:not([hidden])')
        panel_box=panel.bounding_box(); nav_box=nav.bounding_box()
        button_boxes=[buttons.nth(i).bounding_box() for i in range(buttons.count())]
        nav_metrics=nav.evaluate("e=>({clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,overflowX:getComputedStyle(e).overflowX,display:getComputedStyle(e).display,grid:getComputedStyle(e).gridTemplateColumns})")
        labels=buttons.all_inner_texts()
        no_overflow=all(b and b['x']>=panel_box['x']-1 and b['x']+b['width']<=panel_box['x']+panel_box['width']+1 for b in button_boxes)
        text_fit=all(buttons.nth(i).evaluate("e=>e.scrollWidth<=e.clientWidth+1 && e.scrollHeight<=e.clientHeight+2") for i in range(buttons.count()))
        entry={'viewport':f'{width}x{height}','labels':labels,'panelBox':panel_box,'navBox':nav_box,'buttonBoxes':button_boxes,'navMetrics':nav_metrics,'buttonCount':buttons.count(),'buttonsInsidePanel':no_overflow,'buttonTextFits':text_fit,'pageErrors':errors}
        results.append(entry)
        assert buttons.count()==3, entry
        assert labels==['읽기 화면','조작 · 표시','개발자'], entry
        assert nav_metrics['scrollWidth']<=nav_metrics['clientWidth']+1, entry
        assert no_overflow and text_fit, entry
        assert not errors, errors
        context.close()
    browser.close()
RESULT.write_text(json.dumps({'pass':'v660-reader-tabs-browser-pass','results':results},ensure_ascii=False,indent=2)+'\n')
print(RESULT.read_text())
