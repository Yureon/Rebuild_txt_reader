(function(global){
  'use strict';

  var PASS = 'v661-library-cleanup-plan-cache-client-pass; v657-library-cleanup-disclosure-layout-pass; v655-library-cleanup-review-guidance-pass';
  var LEGACY_VISIBLE_CANDIDATES_PASS = 'v643-library-cleanup-visible-candidates-pass';
  var plan = null;
  var bound = false;
  var previewPollTimer = 0;
  var previewPollCount = 0;
  var previewController = null;
  var MAX_PREVIEW_POLLS = 20;
  var AUTO_GROUP_BATCH = 24;
  var REVIEW_GROUP_BATCH = 12;
  var EXCLUDED_PAIR_BATCH = 40;
  var renderedAutoGroupCount = AUTO_GROUP_BATCH;
  var renderedReviewGroupCount = REVIEW_GROUP_BATCH;
  var renderedExcludedPairCount = EXCLUDED_PAIR_BATCH;

  function el(tag, attrs, children){
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(key){
      var value = attrs[key];
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'disabled') node.disabled = !!value;
      else if (key === 'onclick') node.addEventListener('click', value);
      else node.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : children ? [children] : []).filter(Boolean).forEach(function(child){
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function formatNumber(value){ return Math.max(0, Number(value) || 0).toLocaleString('ko-KR'); }
  function percent(value){ return value == null || !Number.isFinite(Number(value)) ? '—' : Math.round(Number(value) * 100) + '%'; }
  function normalizePlan(value){
    var root = value && typeof value === 'object' ? value : {};
    var summary = root.summary && typeof root.summary === 'object' ? root.summary : {};
    return Object.assign({}, root, {
      summary:summary,
      groups:Array.isArray(root.groups) ? root.groups.filter(Boolean) : [],
      reviewGroups:Array.isArray(root.reviewGroups) ? root.reviewGroups.filter(Boolean) : [],
      excludedPairs:Array.isArray(root.excludedPairs) ? root.excludedPairs.filter(Boolean) : [],
      skipped:Array.isArray(root.skipped) ? root.skipped.filter(Boolean) : []
    });
  }
  function fingerprintStatus(value){
    return value && value.summary && value.summary.fingerprintStatus && typeof value.summary.fingerprintStatus === 'object'
      ? value.summary.fingerprintStatus : null;
  }
  function clearPreviewPoll(abortRequest){
    if (previewPollTimer) clearTimeout(previewPollTimer);
    previewPollTimer = 0;
    if (abortRequest && previewController) {
      try { previewController.abort(); } catch (_) {}
      previewController = null;
    }
  }
  function nextPreviewSignal(){
    if (previewController) {
      try { previewController.abort(); } catch (_) {}
    }
    previewController = typeof AbortController === 'function' ? new AbortController() : null;
    return previewController ? previewController.signal : undefined;
  }
  function resetRenderLimits(){
    renderedAutoGroupCount = AUTO_GROUP_BATCH;
    renderedReviewGroupCount = REVIEW_GROUP_BATCH;
    renderedExcludedPairCount = EXCLUDED_PAIR_BATCH;
  }
  function cleanupSummary(children){
    return el('button', {
      type:'button',
      class:'library-cleanup-group-summary',
      'aria-expanded':'false'
    }, [el('span', { class:'library-cleanup-group-summary-layout' }, children)]);
  }

  function createDisclosure(className, summaryChildren, builder, initiallyOpen, options){
    options = options || {};
    var card = el('article', {
      class:'library-cleanup-group' + (className ? ' ' + className : ''),
      'data-cleanup-disclosure':'v657',
      'data-open':'false'
    });
    var affordance = el('span', { class:'library-cleanup-disclosure-affordance', text:options.openLabel || '내용 열기' });
    var toggle = cleanupSummary(summaryChildren.concat([affordance]));
    var body = null;
    var hydrated = false;
    function setOpen(nextOpen){
      var open = nextOpen === true;
      if (open && !hydrated) {
        hydrated = true;
        body = builder();
        body.classList.add('library-cleanup-disclosure-body');
        body.hidden = true;
        card.appendChild(body);
        card.dataset.cleanupHydrated = 'true';
      }
      card.dataset.open = open ? 'true' : 'false';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      affordance.textContent = open ? (options.closeLabel || '접기') : (options.openLabel || '내용 열기');
      if (body) body.hidden = !open;
      if (typeof options.onToggle === 'function') options.onToggle(open, card);
    }
    toggle.addEventListener('click', function(){ setOpen(card.dataset.open !== 'true'); });
    card.appendChild(toggle);
    if (initiallyOpen) setOpen(true);
    return card;
  }
  function loadMoreButton(label, remaining, handler){
    if (remaining <= 0) return null;
    return el('button', {
      type:'button',
      class:'library-cleanup-load-more',
      text:label + ' · 남은 ' + formatNumber(remaining) + '개',
      onclick:handler
    });
  }
  function renderProgress(ctx, currentPlan){
    var target = ctx.$('library-cleanup-progress');
    if (!target) return;
    var fp = fingerprintStatus(currentPlan);
    var skipped = Array.isArray(currentPlan && currentPlan.skipped) ? currentPlan.skipped : [];
    if (!fp && !skipped.length) { target.hidden = true; target.replaceChildren(); return; }
    var queue = Math.max(0, Number(fp && fp.queueLength) || 0);
    var parts = [];
    if (fp) parts.push(el('strong',{ text:'본문 fingerprint ' + formatNumber(fp.entryCount) + '개 계산됨 · 대기 ' + formatNumber(queue) + '개' }));
    if (queue > 0) parts.push(el('span',{ text:'background queue가 진행되는 동안 최대 ' + MAX_PREVIEW_POLLS + '회 자동으로 정리 후보를 갱신합니다.' }));
    if (skipped.length) parts.push(el('span',{ text:'파일 상태 확인을 건너뛴 항목 ' + formatNumber(skipped.length) + '개 · ' + skipped.slice(0,3).map(function(item){ return String(item.reason || 'unknown'); }).join(', ') }));
    target.replaceChildren.apply(target, parts);
    target.hidden = false;
  }


  function syncFilterStates(ctx){
    var scriptTargets = new Set(['library-cleanup-duplicates','library-cleanup-superseded']);
    ['library-cleanup-duplicates','library-cleanup-superseded','library-cleanup-alternate','library-cleanup-suspected'].forEach(function(id){
      var input = ctx.$(id);
      var target = document.querySelector('[data-cleanup-filter-state="' + id + '"]');
      if (!input || !target) return;
      var active = input.checked === true;
      target.textContent = active ? (scriptTargets.has(id) ? '선택됨' : '표시됨') : (scriptTargets.has(id) ? '제외됨' : '숨김');
      target.dataset.active = active ? 'true' : 'false';
      var label = input.closest('.library-cleanup-filter');
      if (label) label.dataset.active = active ? 'true' : 'false';
    });
  }

  function selectedRelations(ctx){
    var relations = [];
    if (ctx.$('library-cleanup-duplicates') && ctx.$('library-cleanup-duplicates').checked) relations.push('duplicate-copy');
    if (ctx.$('library-cleanup-superseded') && ctx.$('library-cleanup-superseded').checked) relations.push('superseded');
    return relations;
  }

  function selectedDisplayRelations(ctx){
    var relations = new Set(selectedRelations(ctx));
    if (ctx.$('library-cleanup-alternate') && ctx.$('library-cleanup-alternate').checked) relations.add('alternate-edition');
    if (ctx.$('library-cleanup-suspected') && ctx.$('library-cleanup-suspected').checked) relations.add('suspected-match');
    return relations;
  }

  function selectedCounts(ctx){
    var relations = new Set(selectedRelations(ctx));
    var groups = Array.isArray(plan && plan.groups) ? plan.groups : [];
    var candidates = groups.flatMap(function(group){ return Array.isArray(group.candidates) ? group.candidates : []; })
      .filter(function(candidate){ return relations.has(String(candidate.relation || '')); });
    return {
      groups:groups.filter(function(group){ return (group.candidates || []).some(function(candidate){ return relations.has(String(candidate.relation || '')); }); }).length,
      candidates:candidates.length
    };
  }

  function refreshSelectionState(ctx){
    syncFilterStates(ctx);
    var counts = selectedCounts(ctx);
    var relations = selectedRelations(ctx);
    var button = ctx.$('library-cleanup-download-btn');
    if (button) button.disabled = !plan || !relations.length || !counts.candidates;
    if (plan && ctx.$('library-cleanup-summary')) {
      ctx.$('library-cleanup-summary').textContent = '자동 묶음 ' + formatNumber(plan.summary && plan.summary.groupCount)
        + '개 · 격리 선택 ' + formatNumber(counts.groups) + '개 묶음 / ' + formatNumber(counts.candidates)
        + '개 파일 · 검토 후보 ' + formatNumber(plan.summary && plan.summary.suspectedMatchCount) + '쌍';
    }
  }

  function relationLabel(value){
    if (value === 'duplicate-copy') return '중복본';
    if (value === 'superseded') return '이전본';
    if (value === 'alternate-edition') return '다른 판본';
    return '검토 후보';
  }

  function similarityGrid(similarity){
    if (!similarity || !similarity.breakdown) return el('span', { class:'muted small', text:'본문 fingerprint 계산 대기 중' });
    var keys = [['title','제목'],['author','작가'],['synopsis','소개'],['prefix','본문 시작'],['middle','본문 중간'],['range','회차']];
    return el('div', { class:'library-cleanup-similarity-grid' }, keys.map(function(item){
      return el('span', {}, [el('small',{ text:item[1] }), el('strong',{ text:percent(similarity.breakdown[item[0]]) })]);
    }).concat([el('span',{ class:'library-cleanup-score' },[el('small',{text:'종합'}),el('strong',{text:percent(similarity.score)})])]));
  }

  function preferenceRequest(ctx, body, statusText){
    var status = ctx.$('library-cleanup-status');
    if (status) status.textContent = statusText;
    return ctx.jf('/api/admin/library-cleanup/preferences', { method:'POST', body:JSON.stringify(body) })
      .then(function(){ return preview(ctx); })
      .catch(function(error){
        if (status) status.textContent = '설정 저장에 실패했습니다: ' + String(error && (error.message || error.error) || error);
        throw error;
      });
  }

  function buildGroupBody(ctx, group, visibleCandidates){
    var body = el('div', { class:'library-cleanup-group-body' });
    var canonicalQuality = group.representativeQuality || {};
    var canonicalHeadChildren=[
      el('strong', { text:'대표 파일' }),
      el('span',{ class:'badge', text:canonicalQuality.manual ? '수동 고정' : '자동 선정' })
    ];
    if (canonicalQuality.manual) canonicalHeadChildren.push(el('button',{ type:'button', text:'자동 선정으로 되돌리기', onclick:function(){
      preferenceRequest(ctx,{ action:'clear-representative', groupKey:group.preferenceKey },'수동 대표 설정을 해제하는 중입니다.').catch(function(){});
    }}));
    body.appendChild(el('div', { class:'library-cleanup-canonical' }, [
      el('div',{ class:'library-cleanup-canonical-head' },canonicalHeadChildren),
      el('code', { text:String(group.canonical && group.canonical.relativePath || '-') }),
      el('small',{ class:'muted', text:(canonicalQuality.reasons || []).join(' · ') || '파일명·회차·크기·decode 품질로 선정' })
    ]));
    var candidates = el('ul', { class:'library-cleanup-candidates' });
    visibleCandidates.slice(0, 40).forEach(function(candidate){
      var actions = el('div',{ class:'library-cleanup-candidate-actions' },[
        el('button',{ type:'button', text:'대표로 지정', onclick:function(){
          preferenceRequest(ctx,{ action:'representative', groupKey:group.preferenceKey, novelId:candidate.id, planHash:String(plan && plan.planHash || '') },'대표 파일 설정을 저장하는 중입니다.').catch(function(){});
        }}),
        el('button',{ type:'button', text:'이 묶음에서 제외', onclick:function(){
          preferenceRequest(ctx,{ action:'exclude-pair', leftId:group.canonical && group.canonical.id, rightId:candidate.id, excluded:true },'묶음 제외 설정을 저장하는 중입니다.').catch(function(){});
        }})
      ]);
      var quarantineTarget = candidate.relation === 'duplicate-copy' || candidate.relation === 'superseded';
      candidates.appendChild(el('li', { class:'library-cleanup-candidate', 'data-cleanup-candidate-state':quarantineTarget ? 'selected' : 'review' }, [
        el('div',{ class:'library-cleanup-candidate-head' },[
          el('span', { class:'library-cleanup-candidate-badges' },[
            el('span', { class:'library-cleanup-relation relation-' + String(candidate.relation || ''), text:relationLabel(candidate.relation) }),
            el('span', { class:'library-cleanup-candidate-state state-' + (quarantineTarget ? 'selected' : 'review'), text:quarantineTarget ? '격리 대상' : '검토 전용' })
          ]),
          el('code', { text:String(candidate.relativePath || '') })
        ]),
        similarityGrid(candidate.similarity),
        el('small',{ class:'muted', text:'크기 ' + formatNumber(candidate.bytes) + ' bytes · 수정 ' + (candidate.mtimeMs ? new Date(candidate.mtimeMs).toLocaleString('ko-KR') : '—') }),
        actions
      ]));
    });
    body.appendChild(candidates);
    return body;
  }

  function renderGroup(ctx, group, groupIndex, displayRelations){
    var visibleCandidates = (group.candidates || []).filter(function(candidate){ return displayRelations.has(String(candidate.relation || '')); });
    if (!visibleCandidates.length) return null;
    return createDisclosure('', [
      el('span', { class:'library-cleanup-group-summary-copy' }, [
        el('span', { class:'library-cleanup-group-title', text:String(group.title || '제목 없음') }),
        el('code', { class:'library-cleanup-target-preview', text:String(group.canonical && group.canonical.relativePath || '') })
      ]),
      el('span', { class:'library-cleanup-group-count', text:'신뢰도 ' + percent(group.confidence) + ' · ' + formatNumber(visibleCandidates.length) + '개' })
    ], function(){ return buildGroupBody(ctx, group, visibleCandidates); }, groupIndex === 0);
  }

  function renderReviewGroups(ctx, list, displayRelations, limit){
    if (!displayRelations.has('suspected-match')) return { total:0, rendered:0 };
    var groups = (plan.reviewGroups || []).slice(0, 120);
    if (groups.length) list.appendChild(el('aside', { class:'library-cleanup-review-guide', role:'note' }, [
      el('strong', { text:'검토 후보는 자동 정리 대상이 아닙니다.' }),
      el('span', { text:'후보 카드를 여는 동작은 비교 정보만 표시하며 파일이나 묶음 상태를 바꾸지 않습니다.' }),
      el('span', { text:'「이 둘은 묶지 않기」를 눌렀을 때만 제외 규칙이 저장됩니다. 정리 스크립트에는 중복본·이전본으로 선택된 항목만 포함됩니다.' })
    ]));
    var visible = groups.slice(0, Math.max(0, limit || 0));
    visible.forEach(function(group){
      var disclosure = createDisclosure('library-cleanup-review-group', [
        el('span',{ class:'library-cleanup-group-summary-copy' },[
          el('span',{ class:'library-cleanup-group-title', text:String(group.title || '동일 작품 의심') }),
          el('span',{ class:'muted small', text:'자동 병합하지 않은 검토 후보' })
        ]),
        el('span',{ class:'library-cleanup-group-count', text:formatNumber((group.pairs || []).length) + '쌍' })
      ], function(){
        var body=el('div',{class:'library-cleanup-group-body'});
        (group.pairs || []).slice(0,20).forEach(function(pair){
          var left=(group.members || []).find(function(item){return String(item.id)===String(pair.leftId);}) || {};
          var right=(group.members || []).find(function(item){return String(item.id)===String(pair.rightId);}) || {};
          body.appendChild(el('div',{class:'library-cleanup-review-pair'},[
            el('div',{class:'library-cleanup-review-paths'},[
              el('code',{text:String(left.relativePath || left.title || pair.leftId)}),
              el('code',{text:String(right.relativePath || right.title || pair.rightId)})
            ]),
            similarityGrid(pair),
            el('div',{class:'library-cleanup-review-decision'},[
              el('strong',{text:'현재 상태 · 검토 전용'}),
              el('span',{text:'자동 정리·격리 대상에 포함되지 않습니다.'})
            ]),
            el('button',{type:'button',text:'다른 작품으로 표시 · 묶지 않기',onclick:function(){
              preferenceRequest(ctx,{action:'exclude-pair',leftId:pair.leftId,rightId:pair.rightId,excluded:true},'묶음 제외 설정을 저장하는 중입니다.').catch(function(){});
            }})
          ]));
        });
        return body;
      }, false, {
        openLabel:'비교 열기',
        closeLabel:'비교 접기',
        onToggle:function(open){
          var status=ctx.$('library-cleanup-status');
          if (status && open) status.textContent='검토 후보 비교를 펼쳤습니다. 아직 정리 대상에는 포함되지 않았습니다.';
        }
      });
      list.appendChild(disclosure);
    });
    return { total:groups.length, rendered:visible.length };
  }

  function renderExcludedPairs(ctx, list, limit){
    var pairs=Array.isArray(plan && plan.excludedPairs) ? plan.excludedPairs : [];
    if (!pairs.length) return { total:0, rendered:0 };
    var visible=pairs.slice(0,Math.max(0,limit || 0));
    var disclosure=createDisclosure('library-cleanup-excluded-group', [
      el('span',{class:'library-cleanup-group-summary-copy'},[
        el('span',{class:'library-cleanup-group-title',text:'자동 묶음 제외 목록'}),
        el('span',{class:'muted small',text:'잘못 제외한 항목을 다시 허용할 수 있습니다.'})
      ]),
      el('span',{class:'library-cleanup-group-count',text:formatNumber(pairs.length)+'쌍'})
    ], function(){
      var body=el('div',{class:'library-cleanup-group-body'});
      visible.forEach(function(pair){
        body.appendChild(el('div',{class:'library-cleanup-review-pair'},[
          el('div',{class:'library-cleanup-review-paths'},[
            el('code',{text:String(pair.left && (pair.left.relativePath || pair.left.title) || pair.leftId)}),
            el('code',{text:String(pair.right && (pair.right.relativePath || pair.right.title) || pair.rightId)})
          ]),
          el('button',{type:'button',text:'다시 묶음 허용',onclick:function(){
            preferenceRequest(ctx,{action:'exclude-pair',leftId:pair.leftId,rightId:pair.rightId,excluded:false},'묶음 제외 설정을 해제하는 중입니다.').catch(function(){});
          }})
        ]));
      });
      return body;
    }, false);
    list.appendChild(disclosure);
    return { total:pairs.length, rendered:visible.length };
  }

  function renderPlan(ctx, nextPlan, options){
    options = options || {};
    var previousHash = String(plan && plan.planHash || '');
    var normalizedNext = nextPlan ? normalizePlan(nextPlan) : null;
    var nextHash = String(normalizedNext && normalizedNext.planHash || '');
    if (options.resetPagination === true || previousHash !== nextHash) resetRenderLimits();
    plan = normalizedNext;
    var list = ctx.$('library-cleanup-list');
    if (!list) return;
    if (options.preserveDomOnSamePlan === true && previousHash && previousHash === nextHash) {
      if (ctx.$('library-cleanup-plan-hash')) {
        ctx.$('library-cleanup-plan-hash').textContent = '계획 ' + String(plan && plan.planHash || '').slice(0, 12);
        ctx.$('library-cleanup-plan-hash').title = String(plan && plan.planHash || '');
      }
      renderProgress(ctx, plan);
      refreshSelectionState(ctx);
      return;
    }
    list.replaceChildren();
    if (!plan) {
      list.appendChild(el('div', { class:'library-cleanup-empty-state' }, [
        el('strong',{ text:'판정 결과가 없습니다.' }),
        el('span',{ class:'muted small', text:'미리보기를 다시 실행하십시오.' })
      ]));
      renderProgress(ctx, null);
      refreshSelectionState(ctx);
      return;
    }
    var displayRelations = selectedDisplayRelations(ctx);
    var visibleGroups = plan.groups.filter(function(group){
      return (Array.isArray(group.candidates) ? group.candidates : []).some(function(candidate){ return displayRelations.has(String(candidate && candidate.relation || '')); });
    });
    var groupLimit = 200;
    var boundedGroups = visibleGroups.slice(0, groupLimit);
    var renderedGroups = boundedGroups.slice(0, Math.min(renderedAutoGroupCount, boundedGroups.length));
    var fragment = document.createDocumentFragment();
    renderedGroups.forEach(function(group, visibleIndex){
      var node = renderGroup(ctx, group, visibleIndex, displayRelations);
      if (node) fragment.appendChild(node);
    });
    list.appendChild(fragment);
    var moreGroups = loadMoreButton('다음 작품 묶음 표시', boundedGroups.length - renderedGroups.length, function(){
      renderedAutoGroupCount += AUTO_GROUP_BATCH;
      renderPlan(ctx, plan);
    });
    if (moreGroups) list.appendChild(moreGroups);

    var reviewResult = renderReviewGroups(ctx,list,displayRelations,renderedReviewGroupCount);
    var moreReviews = loadMoreButton('다음 검토 후보 표시', reviewResult.total - reviewResult.rendered, function(){
      renderedReviewGroupCount += REVIEW_GROUP_BATCH;
      renderPlan(ctx, plan);
    });
    if (moreReviews) list.appendChild(moreReviews);

    var excludedResult = renderExcludedPairs(ctx,list,renderedExcludedPairCount);
    var moreExcluded = loadMoreButton('다음 제외 항목 표시', excludedResult.total - excludedResult.rendered, function(){
      renderedExcludedPairCount += EXCLUDED_PAIR_BATCH;
      renderPlan(ctx, plan);
    });
    if (moreExcluded) list.appendChild(moreExcluded);

    var hasReview = displayRelations.has('suspected-match') && reviewResult.total;
    if (!visibleGroups.length && !hasReview && !excludedResult.total) {
      var fp = fingerprintStatus(plan);
      var pending = Math.max(0, Number(fp && fp.queueLength) || 0);
      list.appendChild(el('div',{class:'library-cleanup-empty-state'},[
        el('strong',{text:pending ? '본문 fingerprint 계산 중입니다.' : '현재 조건에 해당하는 정리 후보가 없습니다.'}),
        el('span',{class:'muted small',text:pending ? '대기열이 진행되면 이 화면이 자동 갱신됩니다.' : '관계 필터를 바꾸거나 라이브러리 스캔 상태를 확인하십시오.'})
      ]));
    }
    if (visibleGroups.length > groupLimit) {
      list.appendChild(el('div',{class:'library-cleanup-limit-note',text:'화면 성능을 위해 ' + formatNumber(visibleGroups.length) + '개 묶음 중 앞의 ' + formatNumber(groupLimit) + '개만 단계적으로 표시합니다. 다운로드 계획에는 전체 후보가 포함됩니다.'}));
    }
    if (ctx.$('library-cleanup-plan-hash')) {
      ctx.$('library-cleanup-plan-hash').textContent = '계획 ' + String(plan.planHash || '').slice(0, 12);
      ctx.$('library-cleanup-plan-hash').title = String(plan.planHash || '');
    }
    renderProgress(ctx, plan);
    refreshSelectionState(ctx);
  }

  function updatePreviewStatus(ctx, normalized, fingerprint){
    var status = ctx.$('library-cleanup-status');
    var fp = fingerprint || fingerprintStatus(normalized);
    var queue = Math.max(0, Number(fp && fp.queueLength) || 0);
    if (status) status.textContent = '미리보기 완료 · 중복 ' + formatNumber(normalized.summary && normalized.summary.duplicateCopyCount)
      + ' · 이전본 ' + formatNumber(normalized.summary && normalized.summary.supersededCount)
      + ' · 다른 판본 ' + formatNumber(normalized.summary && normalized.summary.alternateEditionCount)
      + ' · 의심 ' + formatNumber(normalized.summary && normalized.summary.suspectedMatchCount)
      + (fp ? ' · fingerprint ' + formatNumber(fp.entryCount) + '개 / 대기 ' + formatNumber(queue) : '')
      + (normalized.skipped.length ? ' · 건너뜀 ' + formatNumber(normalized.skipped.length) : '');
    return queue;
  }

  function scheduleStatusPoll(ctx){
    clearPreviewPoll(false);
    if (previewPollCount >= MAX_PREVIEW_POLLS || document.visibilityState === 'hidden') return;
    previewPollCount += 1;
    previewPollTimer = setTimeout(function(){ pollPreviewStatus(ctx).catch(function(){}); }, 1500);
  }

  function pollPreviewStatus(ctx){
    if (!plan || document.visibilityState === 'hidden') return Promise.resolve(null);
    var signal = nextPreviewSignal();
    return ctx.jf('/api/admin/library-cleanup/status?planHash=' + encodeURIComponent(String(plan.planHash || '')), { signal:signal })
      .then(function(result){
        var fp = result && result.fingerprintStatus && typeof result.fingerprintStatus === 'object' ? result.fingerprintStatus : fingerprintStatus(plan);
        var queue = updatePreviewStatus(ctx, plan, fp);
        if (result && result.refreshRecommended) return preview(ctx, { automatic:true, force:true });
        if (queue > 0) scheduleStatusPoll(ctx);
        return result;
      }).catch(function(error){
        if (error && (error.name === 'AbortError' || error.code === 'ABORT_ERR')) return null;
        var status = ctx.$('library-cleanup-status');
        if (status) status.textContent = 'fingerprint 진행 상태를 확인하지 못했습니다. 미리보기를 다시 실행하십시오.';
        throw error;
      });
  }

  function preview(ctx, options){
    options = options || {};
    var automatic = options.automatic === true;
    var force = options.force !== false;
    var button = ctx.$('library-cleanup-preview-btn');
    var status = ctx.$('library-cleanup-status');
    if (!automatic) { clearPreviewPoll(true); previewPollCount = 0; }
    if (button && !automatic) button.disabled = true;
    if (status) status.textContent = automatic
      ? '완료된 fingerprint를 반영해 정리 후보를 한 번 갱신하는 중입니다.'
      : '메타데이터, 본문 fingerprint와 현재 파일 상태를 확인하는 중입니다.';
    var signal = nextPreviewSignal();
    var url = '/api/admin/library-cleanup/plan' + (force ? '?refresh=1' : '');
    return ctx.jf(url, { signal:signal }).then(function(result){
      var normalized = normalizePlan(result);
      renderPlan(ctx, normalized, { resetPagination:!automatic, preserveDomOnSamePlan:automatic });
      var queue = updatePreviewStatus(ctx, normalized);
      clearPreviewPoll(false);
      if (queue > 0) scheduleStatusPoll(ctx);
      return normalized;
    }).catch(function(error){
      if (error && (error.name === 'AbortError' || error.code === 'ABORT_ERR')) return null;
      plan = null;
      renderPlan(ctx, null);
      if (status) status.textContent = '미리보기에 실패했습니다: ' + String(error && (error.message || error.error) || error);
      if (ctx.log) ctx.log(error);
      throw error;
    }).finally(function(){
      if (button && !automatic) button.disabled = false;
      previewController = null;
    });
  }

  function downloadScript(ctx){
    var relations = selectedRelations(ctx);
    if (!plan || !relations.length) return Promise.resolve(null);
    var button = ctx.$('library-cleanup-download-btn');
    var status = ctx.$('library-cleanup-status');
    if (button) button.disabled = true;
    if (status) status.textContent = '현재 파일 상태를 다시 확인하고 격리 스크립트를 생성하는 중입니다.';
    return ctx.jf('/api/admin/library-cleanup/script', { method:'POST', body:JSON.stringify({ relations:relations }) })
      .then(function(result){
        var blob = new Blob(['\ufeff', String(result.script || '')], { type:result.contentType || 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = String(result.fileName || 'txt-reader-library-cleanup.ps1');
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
        if (status) status.textContent = '스크립트 생성 완료 · ' + formatNumber(result.summary && result.summary.candidateCount) + '개 파일';
        return result;
      }).catch(function(error){
        if (status) status.textContent = '스크립트 생성에 실패했습니다: ' + String(error && (error.message || error.error) || error);
        if (ctx.log) ctx.log(error);
        throw error;
      }).finally(function(){ refreshSelectionState(ctx); });
  }

  function bind(ctx){
    if (bound) return;
    bound = true;
    syncFilterStates(ctx);
    var previewButton = ctx.$('library-cleanup-preview-btn');
    var downloadButton = ctx.$('library-cleanup-download-btn');
    if (previewButton) previewButton.addEventListener('click', function(){ preview(ctx).catch(function(){}); });
    if (downloadButton) downloadButton.addEventListener('click', function(){ downloadScript(ctx).catch(function(){}); });
    ['library-cleanup-duplicates','library-cleanup-superseded','library-cleanup-alternate','library-cleanup-suspected'].forEach(function(id){
      var input = ctx.$(id);
      if (input) input.addEventListener('change', function(){ if (plan) renderPlan(ctx,plan,{ resetPagination:true }); else refreshSelectionState(ctx); });
    });
    global.addEventListener('pagehide', function(){ clearPreviewPoll(true); }, { once:false });
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'hidden') clearPreviewPoll(true);
      else if (plan && Math.max(0, Number(fingerprintStatus(plan) && fingerprintStatus(plan).queueLength) || 0) > 0) scheduleStatusPoll(ctx);
    });
  }

  global.AdminLibraryCleanup = { PASS:PASS, LEGACY_VISIBLE_CANDIDATES_PASS:LEGACY_VISIBLE_CANDIDATES_PASS, bind:bind, preview:preview, renderPlan:renderPlan };
})(window);
