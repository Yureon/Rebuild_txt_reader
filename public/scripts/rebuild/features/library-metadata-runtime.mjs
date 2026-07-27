import { createEl, installImageFallback } from '../core/utils.mjs';
import { toast } from './ui.mjs';
import { activateModalFocus } from './ui/modal-focus-manager.mjs';

export const LIBRARY_METADATA_RUNTIME_PASS = 'v578-library-metadata-runtime-bulk-pass';
export const LIBRARY_METADATA_LOCALE_PASS = 'v643-library-metadata-locale-pass';
export const LIBRARY_METADATA_MANUAL_EDIT_PASS = 'v630-library-metadata-manual-candidate-delete-pass';

const FIELD_LABELS = Object.freeze({
  title:'제목', author:'작가', synopsis:'소개글', genres:'장르', tags:'태그',
  publicationStatus:'연재 상태', publicationYear:'출간 연도', sourceLanguage:'언어', cover:'표지'
});
const TERMINAL_JOB = new Set(['completed','failed','cancelled']);
let activeController = null;

function text(value, max = 4000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}


function manualCoverLimitBytes(source = null) {
  const raw = Number(source?.manualCoverMaxBytes);
  return Number.isFinite(raw) ? Math.max(64 * 1024, Math.min(20 * 1024 * 1024, Math.trunc(raw))) : 5 * 1024 * 1024;
}

function formatByteLimit(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value >= 1024 * 1024) return `${Math.round(value / (1024 * 1024) * 10) / 10}MB`;
  return `${Math.round(value / 1024)}KB`;
}

function autoApplyPercent(source) {
  const provider = Array.isArray(source) ? source.find(item => Number.isFinite(Number(item?.autoApplyThreshold))) || source[0] : source;
  const raw = Number(provider?.autoApplyThresholdPercent ?? (Number(provider?.autoApplyThreshold) * 100));
  return Number.isFinite(raw) ? `${Math.round(raw * 10) / 10}%` : '95%';
}

function button(label, action, extra = {}) {
  return createEl('button', { type:'button', class:`metadata-btn${extra.primary ? ' primary' : ''}${extra.danger ? ' danger' : ''}`, dataset:{ metadataAction:action }, disabled:extra.disabled ? 'disabled' : null, text:label });
}

function fieldValue(data, field) {
  if (!data) return '';
  if (field === 'cover') return data.coverUrl || '';
  const value = data[field];
  if (Array.isArray(value)) return value.join(', ');
  return value == null ? '' : String(value);
}

function availableFields(candidate) {
  const data = candidate?.data || {};
  return Object.keys(FIELD_LABELS).filter(field => {
    if (field === 'cover') return !!(data.coverAssetId && data.coverUrl);
    return Array.isArray(data[field]) ? data[field].length > 0 : data[field] != null && String(data[field]).trim() !== '';
  });
}

function ensureModal() {
  let overlay = document.getElementById('library-metadata-overlay');
  if (overlay) return overlay;
  overlay = createEl('div', { id:'library-metadata-overlay', class:'library-metadata-overlay', hidden:'hidden', dataset:{ metadataRuntimePass:LIBRARY_METADATA_RUNTIME_PASS } }, [
    createEl('section', { id:'library-metadata-modal', class:'library-metadata-modal', role:'dialog', tabindex:'-1', 'aria-modal':'true', 'aria-labelledby':'library-metadata-title' }, [
      createEl('header', { class:'library-metadata-header' }, [
        createEl('div', {}, [
          createEl('h2', { id:'library-metadata-title', text:'작품 웹 메타데이터' }),
          createEl('p', { id:'library-metadata-subtitle', class:'library-metadata-subtitle', text:'표지·소개글·태그 후보를 검토하고 적용합니다.' })
        ]),
        createEl('div', { class:'metadata-inline-actions' }, [
          createEl('a', { id:'library-metadata-page-open', class:'metadata-btn', href:'/metadata.html', text:'전용 화면' }),
          button('닫기', 'close')
        ])
      ]),
      createEl('div', { id:'library-metadata-status', class:'library-metadata-status', role:'status', 'aria-live':'polite' }),
      createEl('div', { id:'library-metadata-body', class:'library-metadata-body' })
    ])
  ]);
  document.body.append(overlay);
  return overlay;
}

function metadataCoverPreview(url, title, alt) {
  if (!url) return null;
  const fallback = () => createEl('div', {
    class:'metadata-cover-preview metadata-work-cover-fallback',
    text:(String(title || '?').trim().slice(0, 1) || '?'),
    dataset:{ assetFallback:'cover' }
  });
  return installImageFallback(
    createEl('img', { class:'metadata-cover-preview', src:url, alt, loading:'lazy', decoding:'async' }),
    fallback,
    { label:'library-metadata-cover', url }
  );
}

function appliedCard(applied, canEdit) {
  if (!applied) return createEl('section', { class:'metadata-section' }, [
    createEl('h3', { text:'현재 적용 정보' }),
    createEl('p', { class:'metadata-empty', text:'아직 적용된 웹 메타데이터가 없습니다.' })
  ]);
  const data = applied.data || {};
  return createEl('section', { class:'metadata-section' }, [
    createEl('div', { class:'metadata-section-heading' }, [
      createEl('h3', { text:'현재 적용 정보' }),
      canEdit ? button('적용 정보 제거', 'remove-applied', { danger:true }) : null
    ]),
    createEl('div', { class:'metadata-applied-card' }, [
      metadataCoverPreview(data.coverUrl, data.title, '적용된 작품 표지'),
      createEl('div', { class:'metadata-copy' }, [
        createEl('strong', { text:data.title || '제목 없음' }),
        data.author ? createEl('span', { text:`작가 · ${data.author}` }) : null,
        data.synopsis ? createEl('p', { text:data.synopsis }) : null,
        [...(data.genres || []), ...(data.tags || [])].length ? createEl('div', { class:'metadata-tag-list' }, [...(data.genres || []), ...(data.tags || [])].slice(0,20).map(tag => createEl('span', { text:`#${tag}` }))) : null,
        createEl('small', { text:`공급자 ${applied.providerId || '-'} · ${applied.updatedAt || applied.createdAt || ''}` })
      ])
    ])
  ]);
}

function metadataCandidateGroups(payload) {
  const groups = Array.isArray(payload?.candidateGroups) ? payload.candidateGroups.filter(Boolean) : [];
  if (groups.length) return groups;
  return (Array.isArray(payload?.candidates) ? payload.candidates : []).map(candidate => ({
    id:`legacy_${candidate.id}`,
    count:1,
    grouped:false,
    representativeId:candidate.id,
    matchScore:candidate.matchScore,
    data:candidate.data || {},
    providers:[{
      candidateId:candidate.id,
      providerId:candidate.providerId || '',
      providerName:candidate.providerName || candidate.providerId || '',
      matchScore:candidate.matchScore,
      sourceUrl:candidate.sourceUrl || '',
      hasCover:!!(candidate.data?.coverAssetId && candidate.data?.coverUrl)
    }],
    coverVariantCount:candidate.data?.coverUrl ? 1 : 0
  }));
}

function candidateProviderLinks(group) {
  const providers = Array.isArray(group?.providers) ? group.providers : [];
  if (!providers.length) return null;
  return createEl('div', { class:'metadata-candidate-provider-list' }, providers.map(provider => {
    const label = `${provider.providerName || provider.providerId || '공급자'} · ${Math.round((Number(provider.matchScore) || 0) * 100)}%`;
    return provider.sourceUrl
      ? createEl('a', { class:'metadata-candidate-provider', href:provider.sourceUrl, target:'_blank', rel:'noopener noreferrer', text:label })
      : createEl('span', { class:'metadata-candidate-provider', text:label });
  }));
}

function candidateCard(group, canEdit) {
  const data = group?.data || {};
  const fields = availableFields(group);
  const count = Math.max(1, Number(group?.count) || 1);
  const representativeId = String(group?.representativeId || '');
  const groupId = String(group?.id || '');
  const fieldNodes = fields.map(field => createEl('label', { class:'metadata-field-option' }, [
    createEl('input', { type:'checkbox', checked:'checked', value:field, dataset:{ metadataCandidateField:representativeId } }),
    createEl('span', { text:FIELD_LABELS[field] }),
    fieldValue(data, field) && field !== 'synopsis' && field !== 'cover' ? createEl('small', { text:fieldValue(data, field).slice(0,180) }) : null
  ]));
  return createEl('article', { class:`metadata-candidate${count > 1 ? ' metadata-candidate-grouped' : ''}`, dataset:{ metadataCandidateId:representativeId, metadataCandidateGroupId:groupId, metadataCandidateGroupCount:String(count) } }, [
    createEl('div', { class:'metadata-candidate-main' }, [
      metadataCoverPreview(data.coverUrl, data.title, '후보 작품 표지'),
      createEl('div', { class:'metadata-copy' }, [
        createEl('div', { class:'metadata-candidate-title-row' }, [
          createEl('strong', { text:data.title || '제목 없음' }),
          createEl('span', { class:'metadata-score', text:`일치 ${Math.round((Number(group.matchScore) || 0) * 100)}%${count > 1 ? ` · 동일 후보 ${count}개` : ''}` })
        ]),
        data.author ? createEl('span', { text:data.author }) : null,
        candidateProviderLinks(group),
        Number(group.coverVariantCount) > 1 ? createEl('small', { class:'metadata-candidate-cover-variants', text:`표지 ${Number(group.coverVariantCount)}종 · 대표 공급자 표지를 적용합니다.` }) : null,
        data.synopsis ? createEl('p', { text:data.synopsis }) : null,
        [...(data.genres || []), ...(data.tags || [])].length ? createEl('div', { class:'metadata-tag-list' }, [...(data.genres || []), ...(data.tags || [])].slice(0,20).map(tag => createEl('span', { text:`#${tag}` }))) : null
      ])
    ]),
    canEdit ? createEl('div', { class:'metadata-candidate-fields' }, fieldNodes) : null,
    canEdit ? createEl('div', { class:'metadata-inline-actions metadata-candidate-actions' }, [
      button(count > 1 ? '묶음 선택 항목 적용' : '선택 항목 적용', 'apply-candidate', { primary:true, disabled:fields.length < 1 }),
      button(count > 1 ? '묶음 전체 삭제' : '후보 삭제', 'delete-candidate', { danger:true })
    ]) : null
  ]);
}

function manualEditor(payload) {
  if (!payload.canEdit) return null;
  const coverMaxBytes = manualCoverLimitBytes(payload);
  const data = payload.applied?.data || {};
  const field = (name, label, attrs = {}) => createEl('label', { class:'metadata-manual-field' }, [
    createEl('span', { class:'metadata-manual-field-head' }, [
      createEl('span', { text:label }),
      createEl('span', { class:'metadata-manual-clear-label' }, [
        createEl('input', { type:'checkbox', dataset:{ metadataManualClearField:name }, 'aria-label':`${label} 기존 값 비우기` }),
        createEl('span', { text:'기존 값 비우기' })
      ])
    ]),
    createEl('input', { type:'text', maxlength:String(attrs.maxlength || 300), value:attrs.value ?? data[name] ?? '', placeholder:attrs.placeholder || '', dataset:{ metadataManualField:name } })
  ]);
  return createEl('details', { class:'metadata-section metadata-manual-editor', dataset:{ metadataManualForm:'1' } }, [
    createEl('summary', { class:'metadata-manual-summary' }, [
      createEl('span', { class:'metadata-manual-summary-title', text:'직접 입력' }),
      createEl('span', { class:'metadata-manual-summary-state', text:'열기' })
    ]),
    createEl('div', { class:'metadata-manual-body' }, [
      createEl('p', { class:'metadata-help', text:'입력한 항목과 선택한 표지만 덮어쓰며 비워 둔 항목은 기존 값을 유지합니다.' }),
      createEl('label', { class:'metadata-manual-cover-upload' }, [
        createEl('span', { class:'metadata-manual-field-head' }, [createEl('span', { text:'표지 이미지 업로드' }),createEl('span', { class:'metadata-manual-clear-label' }, [createEl('input', { type:'checkbox', dataset:{ metadataManualClearField:'cover' }, 'aria-label':'기존 표지 비우기' }),createEl('span', { text:'기존 표지 비우기' })])]),
        createEl('input', { type:'file', accept:'image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.avif,.bmp', dataset:{ metadataManualCoverFile:'1' } }),
        createEl('small', { text:`JPEG, PNG, WebP, GIF, AVIF, BMP · 최대 ${formatByteLimit(coverMaxBytes)}` })
      ]),
      createEl('div', { class:'metadata-manual-grid' }, [
        field('title','제목'),
        field('author','작가',{ maxlength:160 }),
        field('publicationStatus','연재 상태',{ maxlength:80, placeholder:'예: 연재 중, 완결' }),
        field('publicationYear','출간 연도',{ maxlength:4, value:data.publicationYear || '', placeholder:'예: 2026' }),
        field('sourceLanguage','언어',{ maxlength:24, placeholder:'예: ko' }),
        field('genres','장르',{ maxlength:1000, value:(data.genres || []).join(', '), placeholder:'쉼표로 구분' }),
        field('tags','태그',{ maxlength:1600, value:(data.tags || []).join(', '), placeholder:'쉼표로 구분' }),
        createEl('label', { class:'metadata-manual-field metadata-manual-synopsis' }, [
          createEl('span', { class:'metadata-manual-field-head' }, [createEl('span', { text:'소개글' }),createEl('span', { class:'metadata-manual-clear-label' }, [createEl('input', { type:'checkbox', dataset:{ metadataManualClearField:'synopsis' }, 'aria-label':'소개글 기존 값 비우기' }),createEl('span', { text:'기존 값 비우기' })])]),
          createEl('textarea', { maxlength:'8000', rows:'5', placeholder:'작품 소개를 입력하세요.', dataset:{ metadataManualField:'synopsis' } }, [data.synopsis || ''])
        ])
      ]),
      createEl('div', { class:'metadata-manual-actions' }, [
        button('입력 내용과 표지 저장', 'save-manual', { primary:true })
      ])
    ])
  ]);
}

function providerControls(providers, canManageProviderSettings) {
  const statusLabel = profile => {
    const status = String(profile?.status || 'unsupported');
    if (!profile?.supported) return 'Playwright 미지원';
    if (status === 'ready') return 'Playwright 로그인됨';
    if (status === 'login_active') return '로그인 진행 중';
    if (status === 'verification_required') return '성인 인증 필요';
    if (status === 'expired') return '재로그인 필요';
    if (status === 'unknown') return '프로필 확인 필요';
    return 'Playwright 미로그인';
  };
  const rows = providers.map(provider => createEl('article', { class:'metadata-provider-row', dataset:{ metadataProviderId:provider.id } }, [
    createEl('div', { class:'metadata-provider-summary' }, [
      createEl('label', {}, [
        createEl('input', { type:'checkbox', checked:provider.enabled ? 'checked' : null, disabled:canManageProviderSettings ? null : 'disabled', dataset:{ metadataProviderEnabled:provider.id } }),
        createEl('strong', { text:provider.name })
      ]),
      createEl('small', { text:provider.browserProfileSupported ? statusLabel(provider.browserProfile) : '확장 프로그램 캡처 사용 가능' })
    ]),
    canManageProviderSettings ? createEl('div', { class:'metadata-provider-actions' }, [
      createEl('label', {}, [createEl('input', { type:'checkbox', checked:provider.autoApply ? 'checked' : null, dataset:{ metadataProviderAuto:provider.id } }), createEl('span', { text:`${autoApplyPercent(provider)} 이상 자동 적용` })]),
      createEl('p', { class:'metadata-help', text:'Playwright 로그인 프로필과 전역 공급자 설정은 소유자 관리 페이지에서 설정합니다. 현재 브라우저의 로그인 세션은 Metadata Helper 확장 프로그램으로 캡처할 수 있습니다.' }),
      createEl('div', { class:'metadata-inline-actions' }, [button('설정 저장', 'save-provider'), createEl('a', { class:'metadata-btn', href:'/admin/users.html#metadata', text:'소유자 메타데이터 설정 열기' })])
    ]) : null
  ]));
  return createEl('details', { class:'metadata-section metadata-provider-settings' }, [
    createEl('summary', { text:'공급자와 로그인 방식' }),
    createEl('p', { class:'metadata-help', text:'Cookie 직접 입력 기능은 제거되었습니다. 서버 Playwright 영구 프로필 또는 Metadata Helper 확장 프로그램을 사용합니다.' }),
    ...rows
  ]);
}

function captureMetadataModalView() {
  const modal = document.getElementById('library-metadata-modal');
  const focusedCandidate = document.activeElement instanceof Element ? document.activeElement.closest('[data-metadata-candidate-id]') : null;
  const action = document.activeElement instanceof Element ? document.activeElement.closest('[data-metadata-action]') : null;
  let modalTop = 0;
  try { modalTop = Number(modal?.getBoundingClientRect?.().top) || 0; } catch {}
  let anchorId = '';
  let anchorOffset = 0;
  for (const card of Array.from(modal?.querySelectorAll?.('[data-metadata-candidate-id]') || [])) {
    let rect = null;
    try { rect = card.getBoundingClientRect?.(); } catch {}
    if (!rect || Number(rect.bottom) < modalTop + 1) continue;
    anchorId = String(card.dataset.metadataCandidateId || '');
    anchorOffset = Math.round((Number(rect.top) || modalTop) - modalTop);
    break;
  }
  return {
    scrollTop:Math.max(0,Number(modal?.scrollTop)||0),
    anchorId,
    anchorOffset,
    focusedCandidateId:String(focusedCandidate?.dataset?.metadataCandidateId || ''),
    focusedAction:String(action?.dataset?.metadataAction || '')
  };
}

function restoreMetadataModalView(snapshot) {
  if (!snapshot) return;
  requestAnimationFrame(() => {
    const modal = document.getElementById('library-metadata-modal');
    if (!modal) return;
    const anchor = snapshot.anchorId
      ? Array.from(modal.querySelectorAll?.('[data-metadata-candidate-id]') || []).find(card => String(card.dataset.metadataCandidateId || '') === snapshot.anchorId)
      : null;
    if (anchor) {
      let modalTop = 0;
      let anchorTop = 0;
      try {
        modalTop = Number(modal.getBoundingClientRect?.().top) || 0;
        anchorTop = Number(anchor.getBoundingClientRect?.().top) || modalTop;
      } catch {}
      const delta = Math.round(anchorTop - modalTop - (Number(snapshot.anchorOffset)||0));
      if (Math.abs(delta) > 1) modal.scrollTop = Math.max(0,(Number(modal.scrollTop)||0) + delta);
    } else {
      const maxTop = Math.max(0,(Number(modal.scrollHeight)||0) - (Number(modal.clientHeight)||0));
      modal.scrollTop = Math.min(maxTop,Math.max(0,Number(snapshot.scrollTop)||0));
    }
    if (snapshot.focusedCandidateId && snapshot.focusedAction) {
      const card = Array.from(modal.querySelectorAll?.('[data-metadata-candidate-id]') || []).find(item => String(item.dataset.metadataCandidateId || '') === snapshot.focusedCandidateId);
      const replacement = card?.querySelector?.(`[data-metadata-action="${snapshot.focusedAction}"]`);
      const active = document.activeElement;
      if (replacement && (!active || active === document.body || !document.contains(active))) replacement.focus({ preventScroll:true });
    }
  });
}

function jobsSection(jobs, canEdit) {
  const list = (jobs || []).slice(0,20).map(job => createEl('li', { class:`metadata-job metadata-job-${job.status}` }, [
    createEl('div', {}, [
      createEl('strong', { text:job.novel?.title || job.type || job.id }),
      createEl('span', { text:`${job.status} · ${job.message || ''}` }),
      job.lastError ? createEl('small', { text:job.lastError }) : null
    ]),
    canEdit && ['queued','running'].includes(job.status) ? createEl('button', { type:'button', class:'metadata-btn', dataset:{ metadataAction:'cancel-job', metadataJobId:job.id }, text:'취소' }) : null
  ]));
  return createEl('details', { class:'metadata-section' }, [
    createEl('summary', { text:`최근 수집 작업 ${jobs?.length || 0}건` }),
    list.length ? createEl('ul', { class:'metadata-job-list' }, list) : createEl('p', { class:'metadata-empty', text:'수집 작업이 없습니다.' })
  ]);
}

function render(controller) {
  const body = document.getElementById('library-metadata-body');
  const subtitle = document.getElementById('library-metadata-subtitle');
  if (!body || controller.closed) return;
  const viewState = captureMetadataModalView();
  if (subtitle) subtitle.textContent = `${controller.novel.title || controller.novel.fileName || '작품'} · 외부 결과를 검토한 뒤 적용합니다.`;
  const payload = controller.payload || {};
  const canEdit = !!payload.canEdit;
  const canManageProviderSettings = !!payload.canManageProviderSettings;
  const metadataAvailableForLocale = payload.metadataAvailableForLocale !== false;
  const providers = metadataAvailableForLocale && Array.isArray(payload.providers) ? payload.providers : [];
  const candidateGroups = metadataCandidateGroups(payload);
  const candidateCount = Math.max(candidateGroups.reduce((total, group) => total + Math.max(1, Number(group.count) || 1), 0), Number(payload.candidateCount) || 0);
  const groupedCandidateCount = Math.max(0, candidateCount - candidateGroups.length);
  const collect = createEl('section', { class:'metadata-section' }, [
    createEl('div', { class:'metadata-section-heading' }, [
      createEl('h3', { text:'인터넷에서 수집' }),
      metadataAvailableForLocale && canEdit ? createEl('div', { class:'metadata-inline-actions' }, [
        button('미적용 후보 일괄 적용', 'apply-pending'),
        button('메타데이터 없는 작품 일괄 수집', 'collect-missing')
      ]) : null
    ]),
    metadataAvailableForLocale
      ? createEl('p', { class:'metadata-help', text:'자동 검색 또는 지원되는 공식 작품 URL을 사용합니다. 외부 결과는 후보로 저장되며, 강한 일치 또는 직접 URL만 자동 적용될 수 있습니다.' })
      : createEl('div', { class:'metadata-empty metadata-locale-restriction', role:'note' }, [
        createEl('strong', { text:'한국어 사이트 언어에서만 제공됩니다.' }),
        createEl('span', { text:'현재 6개 메타데이터 공급자는 한국어 웹소설 서비스 전용이므로 다른 사이트 언어에서는 표시하거나 실행하지 않습니다.' })
      ]),
    metadataAvailableForLocale
      ? (canEdit ? createEl('div', { class:'metadata-collect-controls' }, [
        createEl('div', { class:'metadata-provider-select' }, providers.map(provider => createEl('label', {}, [
          createEl('input', { type:'checkbox', value:provider.id, checked:provider.enabled ? 'checked' : null, disabled:provider.enabled ? null : 'disabled', dataset:{ metadataCollectProvider:provider.id } }),
          createEl('span', { text:provider.name })
        ]))),
        createEl('input', { id:'metadata-official-url', type:'url', inputmode:'url', maxlength:'2048', placeholder:'선택 사항: 네이버 시리즈·카카오페이지·노벨피아·문피아·조아라 공식 작품 URL' }),
        createEl('div', { class:'metadata-inline-actions' }, [button('자동 검색', 'collect-search', { primary:true }), button('공식 URL 수집', 'collect-url')])
      ]) : createEl('p', { class:'metadata-empty', text:'현재 계정은 메타데이터를 조회할 수 있지만 수집·적용 권한은 없습니다.' }))
      : null
  ]);
  body.replaceChildren(...[
    appliedCard(payload.applied, canEdit),
    manualEditor(payload),
    collect,
    createEl('section', { class:'metadata-section' }, [
      createEl('div', { class:'metadata-section-heading' }, [createEl('h3', { text:groupedCandidateCount ? `수집 후보 ${candidateCount}건 · 동일 정보 기준 ${candidateGroups.length}묶음 · 중복 ${groupedCandidateCount}건 정리` : `수집 후보 ${candidateCount}건` }), button('새로고침', 'refresh')]),
      groupedCandidateCount ? createEl('p', { class:'metadata-help', text:`내용이 같은 후보 ${groupedCandidateCount}건을 공급자 출처와 함께 묶었습니다.` }) : null,
      candidateGroups.length ? createEl('div', { class:'metadata-candidate-list' }, candidateGroups.map(group => candidateCard(group, canEdit))) : createEl('p', { class:'metadata-empty', text:'수집된 후보가 없습니다.' })
    ]),
    metadataAvailableForLocale ? providerControls(providers, canManageProviderSettings) : null,
    jobsSection(controller.jobs || [], canEdit)
  ].filter(Boolean));
  restoreMetadataModalView(viewState);
}

async function load(controller, quiet = false) {
  if (controller.closed) return;
  const serial = ++controller.loadSerial;
  if (!quiet) controller.setStatus('메타데이터를 불러오는 중…');
  try {
    const [payload, jobsPayload] = await Promise.all([
      controller.app.api.novelMetadata(controller.novel.id),
      controller.app.api.metadataJobs(50).catch(() => ({ jobs:[] }))
    ]);
    if (controller.closed || serial !== controller.loadSerial) return;
    controller.payload = payload;
    controller.jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
    render(controller);
    controller.setStatus(quiet ? '' : '메타데이터를 불러왔습니다.');
  } catch (error) {
    if (!controller.closed && serial === controller.loadSerial) controller.setStatus(`불러오기 실패: ${error?.message || error}`, true);
  }
}

function selectedProviderIds(root) {
  return Array.from(root.querySelectorAll('[data-metadata-collect-provider]:checked')).map(node => node.value).filter(Boolean);
}

async function pollJob(controller, jobId) {
  controller.pollToken += 1;
  const token = controller.pollToken;
  for (let count = 0; count < 240 && !controller.closed && controller.pollToken === token; count += 1) {
    const payload = await controller.app.api.metadataJob(jobId);
    const job = payload?.job;
    if (!job) break;
    controller.setStatus(`${job.message || job.status} · ${Math.round((Number(job.progress) || 0) * 100)}%${job.lastError ? ` · ${job.lastError}` : ''}`, job.status === 'failed');
    if (TERMINAL_JOB.has(job.status)) {
      await load(controller, true);
      if (job.status === 'completed' && controller.options.refreshLibrary) await controller.options.refreshLibrary();
      return job;
    }
    await new Promise(resolve => { controller.pollTimer = window.setTimeout(resolve, 1000); });
  }
  return null;
}

async function refreshLibraryPresentation(controller, response) {
  const patch = response && response.novelPatch;
  if (patch && typeof controller.options.refreshLibraryNovel === 'function') return controller.options.refreshLibraryNovel(patch);
  return controller.options.refreshLibrary?.();
}

async function handleAction(controller, action, target) {
  const app = controller.app;
  if (action === 'close') return controller.close();
  if (action === 'refresh') return load(controller);
  if (action === 'collect-search' || action === 'collect-url') {
    if (controller.payload?.metadataAvailableForLocale === false) return controller.setStatus('한국어 사이트 언어에서만 메타데이터 공급자를 사용할 수 있습니다.', true);
    const root = document.getElementById('library-metadata-body');
    const url = action === 'collect-url' ? text(document.getElementById('metadata-official-url')?.value, 2048) : '';
    if (action === 'collect-url' && !url) return controller.setStatus('공식 작품 URL을 입력하세요.', true);
    controller.setStatus('수집 작업을 등록하는 중…');
    try {
      const response = await app.api.collectNovelMetadata(controller.novel.id, { url, providerIds:selectedProviderIds(root) });
      render(controller);
      await pollJob(controller, response.job.id);
    } catch (error) { controller.setStatus(`수집 실패: ${error?.message || error}`, true); }
    return;
  }
  if (action === 'apply-pending') {
    if (controller.payload?.metadataAvailableForLocale === false) return controller.setStatus('한국어 사이트 언어에서만 메타데이터 공급자를 사용할 수 있습니다.', true);
    if (!window.confirm(`현재 접근 가능한 서재의 미적용 후보 중 일치율 ${autoApplyPercent(controller.payload?.providers)} 이상인 결과를 공급자 우선순위에 따라 일괄 적용할까요? 정확한 제목의 비모호 단일 후보는 안전 예외로 포함될 수 있습니다.`)) return;
    try {
      const response = await app.api.applyPendingMetadata();
      const manual = Number(response.manualReview) || 0;
      const manualText = manual ? ` · 검토 대기 ${manual.toLocaleString()}건` : '';
      if (!response.job) controller.setStatus(`일괄 적용할 신뢰 후보가 없습니다${manualText}.`);
      else controller.setStatus(`${Number(response.count || 0).toLocaleString()}개 작품의 후보 일괄 적용 작업을 ${response.reused ? '이어갑니다' : '등록했습니다'}${manualText}.`);
      await load(controller, true);
    } catch (error) { controller.setStatus(`후보 일괄 적용 실패: ${error?.message || error}`, true); }
    return;
  }
  if (action === 'collect-missing') {
    if (controller.payload?.metadataAvailableForLocale === false) return controller.setStatus('한국어 사이트 언어에서만 메타데이터 공급자를 사용할 수 있습니다.', true);
    if (!window.confirm('현재 접근 가능한 서재에서 메타데이터가 없는 모든 작품을 수집할까요? 작품 수 제한 없이 하나의 영속 작업으로 순차 처리합니다.')) return;
    try {
      const response = await app.api.collectMissingMetadata({ providerIds:selectedProviderIds(document.getElementById('library-metadata-body')) });
      if (!response.job) controller.setStatus('수집할 미수집 작품이 없습니다.');
      else controller.setStatus(`${Number(response.count || 0).toLocaleString()}개 작품의 전체 수집 작업을 ${response.reused ? '이어갑니다.' : '등록했습니다.'}`);
      await load(controller, true);
    } catch (error) { controller.setStatus(`전체 수집 실패: ${error?.message || error}`, true); }
    return;
  }
  if (action === 'apply-candidate') {
    const card = target.closest('[data-metadata-candidate-id]');
    const candidateId = card?.dataset?.metadataCandidateId || '';
    const candidateGroupId = card?.dataset?.metadataCandidateGroupId || '';
    const fields = Array.from(card?.querySelectorAll('[data-metadata-candidate-field]:checked') || []).map(node => node.value);
    if (!fields.length) return controller.setStatus('적용할 항목을 하나 이상 선택하세요.', true);
    try {
      const response = await app.api.applyNovelMetadata(controller.novel.id, candidateGroupId ? { candidateGroupId, fields } : { candidateId, fields });
      controller.setStatus('선택한 메타데이터를 적용했습니다.');
      await load(controller, true);
      await refreshLibraryPresentation(controller,response);
    } catch (error) { controller.setStatus(`적용 실패: ${error?.message || error}`, true); }
    return;
  }
  if (action === 'delete-candidate') {
    const card = target.closest('[data-metadata-candidate-id]');
    const candidateId = card?.dataset?.metadataCandidateId || '';
    const candidateGroupId = card?.dataset?.metadataCandidateGroupId || '';
    const grouped = Number(card?.dataset?.metadataCandidateGroupCount || 1) > 1;
    if ((!candidateGroupId && !candidateId) || !window.confirm(grouped ? '내용이 같은 이 후보 묶음을 모두 삭제할까요? 이미 적용된 정보는 유지됩니다.' : '이 수집 후보를 삭제할까요? 이미 적용된 정보는 유지됩니다.')) return;
    try {
      if (candidateGroupId) await app.api.deleteMetadataCandidateGroup(controller.novel.id,candidateGroupId);
      else await app.api.deleteMetadataCandidate(controller.novel.id,candidateId);
      controller.setStatus(grouped ? '동일 메타데이터 후보 묶음을 삭제했습니다.' : '수집 후보를 삭제했습니다.');
      await load(controller,true);
    } catch (error) { controller.setStatus(`후보 삭제 실패: ${error?.message || error}`,true); }
    return;
  }
  if (action === 'save-manual') {
    const form = target.closest('[data-metadata-manual-form]');
    const coverFile = form?.querySelector('[data-metadata-manual-cover-file]')?.files?.[0] || null;
    const values = Object.fromEntries(Array.from(form?.querySelectorAll('[data-metadata-manual-field]') || []).map(input => [input.dataset.metadataManualField, text(input.value,input.dataset.metadataManualField === 'synopsis' ? 8000 : 1600)]));
    const clearFields = Array.from(form?.querySelectorAll('[data-metadata-manual-clear-field]:checked') || []).map(input => String(input.dataset.metadataManualClearField || '')).filter(Boolean);
    const list = value => String(value || '').split(/[,;\n]/u).map(item => text(item,100)).filter(Boolean);
    const payload = {
      title:values.title, author:values.author, synopsis:values.synopsis,
      publicationStatus:values.publicationStatus,
      publicationYear:values.publicationYear ? Number(values.publicationYear) : null,
      sourceLanguage:values.sourceLanguage,
      genres:list(values.genres), tags:list(values.tags), clearFields
    };
    const coverMaxBytes = manualCoverLimitBytes(controller.payload);
    if (coverFile && coverFile.size > coverMaxBytes) return controller.setStatus(`표지 이미지는 ${formatByteLimit(coverMaxBytes)} 이하여야 합니다.`,true);
    if (!coverFile && !clearFields.length && !Object.entries(payload).some(([key,value]) => key === 'clearFields' ? false : key === 'publicationYear' ? Number.isInteger(value) : Array.isArray(value) ? value.length : !!value)) return controller.setStatus('저장할 메타데이터나 표지 이미지를 하나 이상 입력하세요.',true);
    try {
      if (coverFile) {
        controller.setStatus('표지 이미지를 업로드하는 중…');
        const uploaded = await app.api.uploadManualNovelCover(controller.novel.id,coverFile);
        payload.coverAssetId = uploaded?.cover?.assetId || '';
        if (!payload.coverAssetId) throw new Error('업로드된 표지 정보를 확인할 수 없습니다.');
      }
      const response = await app.api.saveManualNovelMetadata(controller.novel.id,payload);
      controller.setStatus(coverFile ? '직접 입력한 메타데이터와 표지를 저장했습니다.' : '직접 입력한 메타데이터를 저장했습니다.');
      await load(controller,true);
      await refreshLibraryPresentation(controller,response);
    } catch (error) { controller.setStatus(`직접 입력 저장 실패: ${error?.message || error}`,true); }
    return;
  }
  if (action === 'remove-applied') {
    if (!window.confirm('현재 적용된 웹 메타데이터를 제거할까요? 원본 TXT 파일은 변경되지 않습니다.')) return;
    try {
      const response = await app.api.deleteNovelMetadata(controller.novel.id);
      controller.setStatus('적용 정보를 제거했습니다.');
      await load(controller, true);
      await refreshLibraryPresentation(controller,response);
    } catch (error) { controller.setStatus(`제거 실패: ${error?.message || error}`, true); }
    return;
  }
  if (action === 'save-provider') {
    const row = target.closest('[data-metadata-provider-id]');
    const providerId = row?.dataset?.metadataProviderId || '';
    try {
      await app.api.updateMetadataProvider(providerId, {
        enabled:!!row.querySelector('[data-metadata-provider-enabled]')?.checked,
        autoApply:!!row.querySelector('[data-metadata-provider-auto]')?.checked
      });
      controller.setStatus('공급자 설정을 저장했습니다.');
      await load(controller, true);
    } catch (error) { controller.setStatus(`설정 저장 실패: ${error?.message || error}`, true); }
    return;
  }
  if (action === 'cancel-job') {
    try { await app.api.cancelMetadataJob(target.dataset.metadataJobId || ''); controller.setStatus('취소를 요청했습니다.'); await load(controller, true); }
    catch (error) { controller.setStatus(`취소 실패: ${error?.message || error}`, true); }
  }
}

export async function openLibraryMetadataModal(app, novel, options = {}) {
  activeController?.close?.();
  const overlay = ensureModal();
  const body = document.getElementById('library-metadata-body');
  const statusNode = document.getElementById('library-metadata-status');
  const controller = {
    app, novel, options, payload:null, jobs:[], closed:false, pollToken:0, pollTimer:0, loadSerial:0, deactivateFocus:() => {},
    setStatus(message, error = false) {
      if (!statusNode) return;
      statusNode.textContent = message || '';
      statusNode.classList.toggle('error', !!error);
      statusNode.hidden = !message;
    },
    close() {
      if (controller.closed) return;
      controller.closed = true;
      controller.pollToken += 1;
      window.clearTimeout(controller.pollTimer);
      controller.deactivateFocus();
      overlay.hidden = true;
      overlay.classList.remove('open');
      overlay.removeEventListener('click', onClick);
      activeController = null;
    }
  };
  const onClick = event => {
    if (event.target === overlay) return controller.close();
    const target = event.target instanceof Element ? event.target.closest('[data-metadata-action]') : null;
    if (!target || target.disabled || target.dataset.metadataPending === '1') return;
    target.dataset.metadataPending = '1';
    target.disabled = true;
    target.setAttribute('aria-busy','true');
    void Promise.resolve(handleAction(controller, target.dataset.metadataAction || '', target)).finally(() => {
      if (!target.isConnected) return;
      delete target.dataset.metadataPending;
      target.removeAttribute('aria-busy');
      target.disabled = false;
    });
  };
  overlay.addEventListener('click', onClick);
  overlay.hidden = false;
  overlay.classList.add('open');
  const modal = document.getElementById('library-metadata-modal');
  if (modal) modal.scrollTop = 0;
  controller.deactivateFocus = activateModalFocus({
    overlay, dialog:modal, initialFocus:modal, onRequestClose:() => controller.close(),
    returnFocus:controller.options.returnFocus?.() || document.activeElement, accessibleName:'작품 웹 메타데이터'
  });
  body?.replaceChildren(createEl('div', { class:'metadata-loading', text:'메타데이터를 불러오는 중…' }));
  activeController = controller;
  const dedicatedLink = document.getElementById('library-metadata-page-open');
  if (dedicatedLink) dedicatedLink.href = `/metadata.html?novelId=${encodeURIComponent(novel.id)}`;
  await load(controller);
  toast(app, 'info', '작품 정보', '웹 메타데이터 수집·후보 검토 화면을 열었습니다.');
  return controller;
}
