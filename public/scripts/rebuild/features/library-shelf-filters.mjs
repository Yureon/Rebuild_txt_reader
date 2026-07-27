import { createEl } from '../core/utils.mjs';
import { normalizeLibraryShelfFilters, normalizeLibraryTagFacetMinCount, persistLibraryUi } from '../state/app-state.mjs';

export const LIBRARY_SHELF_FILTER_UI_PASS = 'v601-library-shelf-filter-ui-pass';
export const LIBRARY_TAG_FACET_THRESHOLD_PASS = 'v601-library-tag-facet-threshold-pass';
const TAG_RENDER_LIMIT = 180;

const FILTER_DEFS = Object.freeze([
{ key:'publicationStatuses', label:'연재 상태', element:'libraryFilterStatusOptions', labels:{ complete:'완결', ongoing:'연재·미표기' } },
{ key:'authors', label:'작가', element:'libraryFilterAuthorOptions' },
{ key:'categories', label:'폴더', element:'libraryFilterCategoryOptions' },
{ key:'tags', label:'태그', element:'libraryFilterTagOptions' },
{ key:'groupKinds', label:'구성', element:'libraryFilterGroupOptions', labels:{ single:'단일 파일', series:'회차 폴더', sequence:'분리 회차', variants:'중복·이전 판본 묶음' } }
]);

export function libraryShelfFilterCount(filters = {}) {
const normalized = normalizeLibraryShelfFilters(filters);
return Object.values(normalized).reduce((sum, values) => sum + values.length, 0);
}

export function libraryShelfFilterSignature(filters = {}) {
const normalized = normalizeLibraryShelfFilters(filters);
return FILTER_DEFS.map(def => `${def.key}:${normalized[def.key].slice().sort((a,b) => a.localeCompare(b, 'ko')).join('|')}`).join('::');
}

export function toggleLibraryShelfFilterValue(filters = {}, key = '', value = '') {
const normalized = normalizeLibraryShelfFilters(filters);
if (!Object.prototype.hasOwnProperty.call(normalized, key)) return normalized;
const text = String(value || '').trim();
if (!text) return normalized;
const values = new Set(normalized[key]);
if (values.has(text)) values.delete(text);
else values.add(text);
return normalizeLibraryShelfFilters({ ...normalized, [key]:Array.from(values) });
}

function normalizedTagDistribution(items = [], distribution = null) {
const rows = (Array.isArray(items) ? items : []).map(item => ({ value:String(item?.value || '').trim(), count:Math.max(0, Math.floor(Number(item?.count) || 0)) })).filter(item => item.value && item.count > 0);
const declared = Math.max(0, Math.floor(Number(distribution?.distinct) || 0));
const supplied = (Array.isArray(distribution?.histogram) ? distribution.histogram : []).map(item => ({ count:Math.max(0, Math.floor(Number(item?.count) || 0)), tags:Math.max(0, Math.floor(Number(item?.tags) || 0)) })).filter(item => item.count && item.tags).sort((a,b) => b.count-a.count);
const suppliedTotal = supplied.reduce((sum,item) => sum+item.tags, 0);
if (suppliedTotal && (!declared || declared === suppliedTotal)) return { histogram:supplied, tagTotal:suppliedTotal, totalUsage:supplied.reduce((sum,item) => sum+item.count*item.tags, 0) };
const counts = new Map();
rows.forEach(item => counts.set(item.count, (counts.get(item.count) || 0)+1));
return { histogram:Array.from(counts, ([count,tags]) => ({ count,tags })).sort((a,b) => b.count-a.count), tagTotal:rows.length, totalUsage:rows.reduce((sum,item) => sum+item.count,0) };
}
function tagCountAtRank(histogram, rank) {
let seen = 0;
for (const item of histogram) if ((seen += item.tags) >= rank) return Math.max(1,item.count);
return 1;
}
function tagVisibleCount(histogram, minCount) {
return histogram.reduce((sum,item) => sum+(item.count >= minCount ? item.tags : 0),0);
}
export function automaticLibraryTagFacetPolicy(items = [], distribution = null) {
const { histogram,tagTotal,totalUsage } = normalizedTagDistribution(items,distribution);
const averageUsage = tagTotal ? totalUsage/tagTotal : 0;
if (tagTotal <= 36) return { minCount:1,tagTotal,totalUsage,averageUsage,targetVisible:tagTotal,visibleEstimate:tagTotal,histogram };
const targetVisible = Math.min(tagTotal,Math.max(48,Math.min(240,Math.ceil(tagTotal*(tagTotal > 400 ? .48 : tagTotal > 160 ? .55 : .65)))));
const minimumVisible = Math.min(tagTotal,Math.max(16,Math.ceil(tagTotal*.08)));
const minCount = Math.max(1,Math.min(Math.max(tagCountAtRank(histogram,targetVisible),Math.ceil(Math.log2(averageUsage+1)/1.7)),tagCountAtRank(histogram,minimumVisible)));
return { minCount,tagTotal,totalUsage,averageUsage,targetVisible,visibleEstimate:tagVisibleCount(histogram,minCount),histogram };
}
export function automaticLibraryTagFacetMinCount(items = [], distribution = null) { return automaticLibraryTagFacetPolicy(items,distribution).minCount; }
export function effectiveLibraryTagFacetMinCount(state = {}, tagItems = state?.libraryShelfFacets?.tags) {
const setting = normalizeLibraryTagFacetMinCount(state?.libraryTagFacetMinCount);
return setting === 'auto' ? automaticLibraryTagFacetMinCount(tagItems,state?.libraryShelfTagDistribution) : Math.max(1,Number(setting) || 1);
}

function labelFor(def, value) {
return def.labels?.[value] || value;
}

function tagKey(value) {
return String(value || '').trim().toLocaleLowerCase('ko-KR');
}

function facetValues(state, def) {
const source = state?.libraryShelfFacets?.[def.key];
const selected = new Set(normalizeLibraryShelfFilters(state?.libraryShelfFilters)[def.key]);
const values = Array.isArray(source) ? source.slice() : [];
for (const value of selected) {
if (!values.some(item => String(item?.value || '') === value)) values.push({ value, count:0 });
}
if (def.key !== 'tags') return { values, total:values.length, hidden:0, minCount:1 };

const policy = automaticLibraryTagFacetPolicy(values, state?.libraryShelfTagDistribution);
const minCount = normalizeLibraryTagFacetMinCount(state?.libraryTagFacetMinCount) === 'auto'
? policy.minCount
: effectiveLibraryTagFacetMinCount(state, values);
const userDefinitions = new Set([
...(Array.isArray(state?.libraryShelfFacetUserTags) ? state.libraryShelfFacetUserTags : []),
...(Array.isArray(state?.userTags) ? state.userTags : [])
].map(tagKey).filter(Boolean));
const selectedKeys = new Set(Array.from(selected, tagKey));
const visible = values.filter(item => {
const key = tagKey(item?.value);
const count = Math.max(0, Number(item?.count) || 0);
return count >= minCount || selectedKeys.has(key) || userDefinitions.has(key);
});
const forcedBelowThreshold = new Set(visible
.filter(item => Math.max(0, Number(item?.count) || 0) < minCount)
.map(item => tagKey(item?.value))
.filter(Boolean)).size;
const distributionVisible = tagVisibleCount(policy.histogram, minCount);
return {
values:visible,
available:values.length,
total:Math.max(values.length, policy.tagTotal),
hidden:Math.max(0, policy.tagTotal - distributionVisible - forcedBelowThreshold),
minCount,
userDefinitionCount:userDefinitions.size,
policy
};
}

function mergeFacetItems(...groups) {
const out = [];
const seen = new Set();
for (const group of groups) {
for (const item of (Array.isArray(group) ? group : [])) {
const key = tagKey(item?.value);
if (!key || seen.has(key)) continue;
seen.add(key);
out.push(item);
}
}
return out;
}

function renderFacetOptions(app, def) {
const box = app?.els?.[def.element];
if (!box) return { values:[], total:0, hidden:0, minCount:1 };
const selected = new Set(normalizeLibraryShelfFilters(app.state.libraryShelfFilters)[def.key]);
const stats = facetValues(app.state, def);
let values = stats.values;
let matchingTotal = values.length;
let renderHidden = 0;
const query = def.key === 'tags' ? String(app.state.libraryTagFilterQuery || '').trim() : '';
if (def.key === 'tags') {
const queryKey = tagKey(query);
const remoteSearch = tagKey(app.state.libraryShelfTagSearch?.query) === queryKey
? app.state.libraryShelfTagSearch?.items
: [];
const selectedItems = values.filter(item => selected.has(String(item?.value || '').trim()));
const localMatches = queryKey ? values.filter(item => tagKey(item?.value).includes(queryKey)) : values;
const remoteMatches = queryKey ? (Array.isArray(remoteSearch) ? remoteSearch : []).filter(item => tagKey(item?.value).includes(queryKey)) : [];
const candidates = mergeFacetItems(selectedItems, remoteMatches, localMatches);
matchingTotal = queryKey
? Math.max(candidates.length, Number(app.state.libraryShelfTagSearch?.total) || 0)
: candidates.length;
const active = candidates.filter(item => selected.has(String(item?.value || '').trim()));
const inactive = candidates.filter(item => !selected.has(String(item?.value || '').trim()));
const room = Math.max(0, TAG_RENDER_LIMIT-active.length);
const maximumOffset = Math.max(0, inactive.length-room);
const requestedOffset = queryKey ? 0 : Math.max(0, Math.floor(Number(app.state.libraryTagRenderOffset) || 0));
const renderOffset = Math.min(maximumOffset, requestedOffset);
if (!queryKey) app.state.libraryTagRenderOffset = renderOffset;
values = mergeFacetItems(active, inactive.slice(renderOffset, renderOffset+room));
renderHidden = Math.max(0, matchingTotal-values.length);
box.dataset.tagRenderBudgetPass = 'v603-library-tag-render-budget-pass';
box.dataset.tagRendered = String(values.length);
box.dataset.tagMatchingTotal = String(matchingTotal);
}
const resultStats = { ...stats, values, matchingTotal, rendered:values.length, renderHidden, query };
if (!values.length) {
const emptyText = app.state.libraryShelfFacetsLoading
? '불러오는 중…'
: def.key === 'tags' && query
? '검색 조건에 맞는 태그가 없습니다.'
: def.key === 'tags' && stats.hidden > 0
? '현재 태그 표시 기준을 만족하는 태그가 없습니다.'
: '선택 가능한 항목이 없습니다.';
box.replaceChildren(createEl('span', { class:'library-filter-empty', text:emptyText }));
return resultStats;
}
const fragment = document.createDocumentFragment();
values.forEach(item => {
const value = String(item?.value || '').trim();
if (!value) return;
const active = selected.has(value);
fragment.append(createEl('button', {
class:`library-filter-option${active ? ' active' : ''}`,
type:'button',
'aria-pressed':active ? 'true' : 'false',
dataset:{ libraryFilterKey:def.key, libraryFilterValue:value },
title:`${def.label}: ${labelFor(def, value)}`
}, [
createEl('span', { text:labelFor(def, value) }),
createEl('span', { class:'library-filter-option-count', text:String(Math.max(0, Number(item?.count) || 0)) })
]));
});
box.replaceChildren(fragment);
return resultStats;
}

function syncTagThresholdUi(app, stats = {}) {
const setting = normalizeLibraryTagFacetMinCount(app?.state?.libraryTagFacetMinCount);
if (app?.state) app.state.libraryTagFacetMinCount = setting;
if (app?.els?.libraryTagMinCount) app.els.libraryTagMinCount.value = setting;
if (!app?.els?.libraryTagThresholdNote) return;
if (app.state.libraryShelfFacetsLoading) {
app.els.libraryTagThresholdNote.textContent = '태그 사용 빈도를 계산하는 중…';
return;
}
const minCount = Math.max(1, Number(stats.minCount) || effectiveLibraryTagFacetMinCount(app.state));
const policy = stats.policy && typeof stats.policy === 'object' ? stats.policy : automaticLibraryTagFacetPolicy(app?.state?.libraryShelfFacets?.tags, app?.state?.libraryShelfTagDistribution);
const mode = setting === 'auto'
? `자동 기준 ${minCount}개 이상 · 전체 ${Math.max(0, Number(policy.tagTotal) || 0)}개 태그·평균 ${Math.max(0, Number(policy.averageUsage) || 0).toFixed(1)}회 분포 반영`
: minCount <= 1 ? '태그 빈도 제한 없음' : `${minCount}개 작품 이상`;
const hidden = Math.max(0, Number(stats.hidden) || 0);
const renderHidden = Math.max(0, Number(stats.renderHidden) || 0);
const query = String(app.state.libraryTagFilterQuery || '').trim();
const pageState = app.state.libraryShelfTagPage || {};
if (app.els.libraryTagFilterSearch && app.els.libraryTagFilterSearch.value !== query) app.els.libraryTagFilterSearch.value = query;
const searchState = app.state.libraryShelfTagSearch || {};
const activePageState = query ? searchState : pageState;
const loadedTagCount = query
? Math.max(0, Number(searchState.items?.length) || 0)
: Math.max(0, Number(app.state.libraryShelfFacets?.tags?.length) || 0);
const renderOffset = Math.max(0, Math.floor(Number(app.state.libraryTagRenderOffset) || 0));
if (app.els.libraryTagPrevious) {
app.els.libraryTagPrevious.hidden = renderOffset < 1;
app.els.libraryTagPrevious.disabled = !!activePageState.loading;
}
if (app.els.libraryTagLoadMore) {
const hasLocalNext = renderOffset + TAG_RENDER_LIMIT < Math.max(loadedTagCount, Number(stats.matchingTotal) || 0);
app.els.libraryTagLoadMore.hidden = !hasLocalNext && !activePageState.hasMore;
app.els.libraryTagLoadMore.disabled = !!activePageState.loading;
app.els.libraryTagLoadMore.textContent = activePageState.loading ? '불러오는 중…' : '다음 태그';
}
const renderNote = renderHidden ? `화면 성능을 위해 ${Math.max(0, Number(stats.rendered) || 0)}개만 표시` : '';
const searchNote = query ? `“${query}” 검색 ${Math.max(0, Number(stats.matchingTotal) || 0)}개` : '';
const pageNote = pageState.hasMore ? `현재 ${Math.max(0, Number(app.state.libraryShelfFacets?.tags?.length) || 0)}개 로드` : '';
const userNote = (Array.isArray(app.state.libraryShelfFacetUserTags) ? app.state.libraryShelfFacetUserTags.length : 0) > 0
? '사용 중인 사용자 태그는 항상 표시'
: '';
app.els.libraryTagThresholdNote.textContent = [mode, hidden ? `희소 태그 ${hidden}개 숨김` : '숨긴 태그 없음', searchNote, renderNote, pageNote, userNote].filter(Boolean).join(' · ');
app.els.libraryTagThresholdNote.dataset.tagThresholdPass = LIBRARY_TAG_FACET_THRESHOLD_PASS;
}

export function syncLibraryShelfFilterUi(app) {
const filters = normalizeLibraryShelfFilters(app?.state?.libraryShelfFilters);
if (app?.state) app.state.libraryShelfFilters = filters;
const count = libraryShelfFilterCount(filters);
if (app.els.libraryFilterCount) {
app.els.libraryFilterCount.textContent = String(count);
app.els.libraryFilterCount.hidden = count < 1;
}
if (app.els.libraryFilterTrigger) {
app.els.libraryFilterTrigger.classList.toggle('active', count > 0);
app.els.libraryFilterTrigger.setAttribute('aria-label', count ? `서재 필터 ${count}개 적용됨` : '서재 필터');
}
if (app.els.libraryFilterClear) app.els.libraryFilterClear.disabled = count < 1;
let tagStats = { values:[], total:0, hidden:0, minCount:effectiveLibraryTagFacetMinCount(app?.state), policy:automaticLibraryTagFacetPolicy(app?.state?.libraryShelfFacets?.tags, app?.state?.libraryShelfTagDistribution) };
FILTER_DEFS.forEach(def => {
const stats = renderFacetOptions(app, def);
if (def.key === 'tags') tagStats = stats;
});
syncTagThresholdUi(app, tagStats);
if (app.els.libraryActiveFilters) {
const fragment = document.createDocumentFragment();
FILTER_DEFS.forEach(def => filters[def.key].forEach(value => {
fragment.append(createEl('button', {
class:'library-active-filter-chip',
type:'button',
dataset:{ libraryFilterRemoveKey:def.key, libraryFilterRemoveValue:value },
title:`${labelFor(def, value)} 필터 해제`
}, [createEl('span', { text:labelFor(def, value) }), createEl('span', { 'aria-hidden':'true', text:'×' })]));
}));
app.els.libraryActiveFilters.replaceChildren(fragment);
app.els.libraryActiveFilters.hidden = count < 1;
}
if (app.els.libraryFilterStatus) {
app.els.libraryFilterStatus.textContent = app.state.libraryShelfFacetsError
? `필터 항목을 불러오지 못했습니다: ${app.state.libraryShelfFacetsError}`
: count ? `${count}개 필터 적용 중` : '같은 항목 안에서는 하나라도 일치, 다른 항목끼리는 모두 일치하는 작품을 표시합니다.';
}
return { count, filters, tagStats, pass:LIBRARY_SHELF_FILTER_UI_PASS };
}

let shelfFacetsRuntimePromise;
export async function loadLibraryShelfFacets(app, options = {}) {
shelfFacetsRuntimePromise ||= import('./library-shelf-facets-runtime.mjs');
const runtime = await shelfFacetsRuntimePromise;
return runtime.loadLibraryShelfFacetsRuntime(app, options, { syncLibraryShelfFilterUi });
}

export function installLibraryShelfFilterControls(app, on, deps = {}) {
const applyFilters = async next => {
app.state.libraryNavigationPersistedUi = null;
app.state.libraryShelfFilters = normalizeLibraryShelfFilters(next);
persistLibraryUi(app.state);
syncLibraryShelfFilterUi(app);
await deps.loadShelfPage?.(app, { reset:true, source:'facet-filter-change' });
};
let tagControlsPromise = null;
const ensureTagControls = () => {
if (!tagControlsPromise) tagControlsPromise = import('./library-tag-filter-controls.mjs').then(runtime => {
runtime.installLibraryTagFilterControlsRuntime(app, on, {
syncLibraryShelfFilterUi,
effectiveLibraryTagFacetMinCount,
loadLibraryShelfFacets
});
return runtime;
});
return tagControlsPromise;
};
on(app.els.libraryFilterTrigger, 'pointerdown', () => { ensureTagControls().catch(() => {}); });
on(app.els.libraryFilterTrigger, 'focusin', () => { ensureTagControls().catch(() => {}); });
on(app.els.libraryFilterPopover, 'toggle', () => {
if (!app.els.libraryFilterPopover?.open) return;
ensureTagControls().then(() => loadLibraryShelfFacets(app)).catch(() => {});
});
on(app.els.libraryFilterClear, 'click', () => applyFilters({}));
on(app.els.libraryFilterPopover, 'click', event => {
const target = event.target instanceof Element ? event.target : null;
const option = target?.closest?.('[data-library-filter-key][data-library-filter-value]');
if (option) {
event.preventDefault();
applyFilters(toggleLibraryShelfFilterValue(app.state.libraryShelfFilters, option.dataset.libraryFilterKey, option.dataset.libraryFilterValue));
}
});
on(app.els.libraryActiveFilters, 'click', event => {
const target = event.target instanceof Element ? event.target : null;
const chip = target?.closest?.('[data-library-filter-remove-key][data-library-filter-remove-value]');
if (!chip) return;
applyFilters(toggleLibraryShelfFilterValue(app.state.libraryShelfFilters, chip.dataset.libraryFilterRemoveKey, chip.dataset.libraryFilterRemoveValue));
});
syncLibraryShelfFilterUi(app);
}
