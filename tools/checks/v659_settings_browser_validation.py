#!/usr/bin/env python3
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
APP=(ROOT/'public/styles/app.css').read_text()
DEFER=(ROOT/'public/styles/deferred-ui.css').read_text()
FRAG=(ROOT/'public/fragments/deferred-ui.html').read_text()
RESULT=ROOT/'v659_browser_settings_results.json'

def build_html():
    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{APP}\n{DEFER}</style></head><body data-client-profile="library" class="settings-page-active">{FRAG}<script>
const panel=document.getElementById('settings-panel');panel.classList.add('settings-page','open');panel.dataset.settingsContext='library';panel.dataset.settingsPresentation='page';
const includesLibrary=node=>(node.dataset.settingsContexts||'').split(/\\s+/).includes('library');
for(const node of document.querySelectorAll('[data-settings-contexts]')){{const ok=includesLibrary(node);node.hidden=!ok;node.setAttribute('aria-hidden',ok?'false':'true');}}
window.showPanel=id=>{{const tabs=[...document.querySelectorAll('.sp-tab')].filter(includesLibrary);const panels=[...document.querySelectorAll('.sp-tab-panel')].filter(includesLibrary);for(const tab of tabs){{const active=tab.dataset.tab===id;tab.hidden=false;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',active?'true':'false')}}for(const p of panels){{const active=p.id===id;p.classList.toggle('active',active);p.hidden=!active;p.setAttribute('aria-hidden',active?'false':'true')}}const layout=document.getElementById('settings-page-layout');layout.dataset.mobileView='detail';layout.classList.add('is-mobile-detail');layout.classList.remove('is-mobile-index');}};
window.openReadData=()=>{{const tabs=document.getElementById('rdm-tabs');tabs.innerHTML='<button class="rdm-tab active">읽기 위치 18</button><button class="rdm-tab">북마크 18</button><button class="rdm-tab">최근 열람 18</button><button class="rdm-tab">즐겨찾기 6</button>';document.getElementById('rdm-summary').innerHTML='<span><b>18</b>개 위치</span><span><b>18</b>개 북마크</span><span><b>18</b>개 최근 열람</span><span><b>6</b>개 즐겨찾기</span>';const body=document.getElementById('rdm-body');body.innerHTML='';for(let i=0;i<18;i++){{const row=document.createElement('div');row.className='rdm-item';row.innerHTML='<div class="rdm-info"><div class="rdm-name">긴 작품 제목 '+(i+1)+' — 모바일 모달 레이아웃 검증</div><div class="rdm-meta">블럭 '+(i*31+1)+' · 방금 전</div></div><div class="rdm-actions"><button class="rdm-open">열기</button><button class="rdm-del">삭제</button></div>';body.append(row)}}const overlay=document.getElementById('read-data-overlay');overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');}};
</script></body></html>'''

results=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width,height in [(320,568),(390,844),(768,1024),(1024,768),(1440,900)]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<=430,has_touch=width<=430)
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(build_html(),wait_until='load')
        hidden_debug=page.locator('#settings-tab-debug').evaluate("e=>getComputedStyle(e).display==='none'")
        panel_visibility={}
        for panel_id in ('general-panel','viewer-panel','func-panel','data-panel'):
            page.evaluate(f"showPanel('{panel_id}')")
            panel_visibility[panel_id]=page.locator(f'#{panel_id}').evaluate("e=>!e.hidden && getComputedStyle(e).display!=='none' && e.scrollHeight>0")
        page.evaluate("showPanel('general-panel')")
        body=page.locator('#settings-panel-body')
        # Inflate with real setting-section structure and validate the designated scroll owner.
        page.evaluate("""() => { const block=document.querySelector('#general-panel .setting-block'); for(let i=0;i<18;i++){const s=document.createElement('div');s.className='sp-section';s.innerHTML='<div class="sp-label">추가 설정 '+i+'</div><div class="setting-help">긴 설정 본문과 컨트롤이 있어도 화면 비율과 세로 스크롤을 유지합니다.</div><input class="slider" type="range">';block.append(s);} }""")
        scroll=body.evaluate("e=>({scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,overflow:getComputedStyle(e).overflowY,touchAction:getComputedStyle(e).touchAction})")
        scroll_top=body.evaluate('e=>{e.scrollTop=600;return e.scrollTop}')
        content_width=page.locator('#general-panel .sp-tab-body').bounding_box()['width']
        page.evaluate("showPanel('data-panel');openReadData()")
        overlay_z=int(page.locator('#read-data-overlay').evaluate('e=>getComputedStyle(e).zIndex'))
        settings_z=int(page.locator('#settings-panel').evaluate('e=>getComputedStyle(e).zIndex'))
        modal_box=page.locator('#read-data-modal').bounding_box()
        modal_scroll=page.locator('#rdm-body').evaluate("e=>({scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,overflow:getComputedStyle(e).overflowY,touchAction:getComputedStyle(e).touchAction})")
        full_mobile=width<=760 and abs(modal_box['width']-width)<2 and abs(modal_box['height']-height)<2
        item_overflow=page.locator('#rdm-body .rdm-item').first.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
        screenshot=ROOT/f'v659-{width}x{height}-read-data.png';page.screenshot(path=str(screenshot),full_page=False)
        entry={'viewport':f'{width}x{height}','hiddenDebug':hidden_debug,'panelVisibility':panel_visibility,'settingsScroll':scroll,'settingsScrollTop':scroll_top,'contentWidth':content_width,'overlayZ':overlay_z,'settingsZ':settings_z,'modalBox':modal_box,'modalScroll':modal_scroll,'fullMobile':full_mobile,'itemNoHorizontalOverflow':item_overflow,'pageErrors':errors}
        results.append(entry)
        assert hidden_debug
        assert all(panel_visibility.values()),panel_visibility
        assert scroll['scrollHeight']>scroll['clientHeight'] and scroll['overflow'] in ('auto','scroll') and scroll_top>0
        assert content_width<=902
        assert overlay_z>settings_z
        assert modal_scroll['scrollHeight']>modal_scroll['clientHeight'] and modal_scroll['overflow'] in ('auto','scroll')
        assert item_overflow
        if width<=760: assert full_mobile
        else: assert modal_box['width']<=762 and modal_box['height']<=height-46
        assert not errors,errors
        context.close()
    browser.close()
RESULT.write_text(json.dumps({'pass':'v659-browser-settings-layout-pass','results':results},ensure_ascii=False,indent=2)+'\n')
print(RESULT.read_text())
