import { createEl } from '../core/utils.mjs';
import { buildTree } from './library-model.mjs';
import { createEpisodeList, createNovelItem } from './library-tree-renderer.mjs';
import { createRootDropZone } from './library-prototype-rows.mjs';
import { applyLibraryHeaderCompactState, createLibraryHeaderScrollState } from './library-header-scroll-state.mjs';

// Compatibility marker retained for the v581 workspace contract: v581-library-explorer-renderer-pass
export const LIBRARY_EXPLORER_RENDERER_PASS = 'v656-library-explorer-mobile-workspace-pass';

function normalizedPath(value) {
  return String(value || '').split('>').map(part => part.trim()).filter(Boolean);
}

function pathKey(parts) {
  return normalizedPath(Array.isArray(parts) ? parts.join('>') : parts).join('>');
}

function resolveNode(tree, parts) {
  let node = tree;
  const resolved = [];
  for (const part of parts) {
    const next = node?.folders?.get?.(part);
    if (!next) break;
    node = next;
    resolved.push(part);
  }
  return { node, parts:resolved };
}

function descendantCounts(node) {
  let folders = 0;
  let novels = Array.isArray(node?.novels) ? node.novels.length : 0;
  for (const child of node?.folders?.values?.() || []) {
    folders += 1;
    const nested = descendantCounts(child);
    folders += nested.folders;
    novels += nested.novels;
  }
  return { folders, novels };
}

function sortedFolders(node) {
  return Array.from(node?.folders?.values?.() || []).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko', { numeric:true }));
}

function sortedNovels(node) {
  return Array.from(node?.novels || []).sort((a, b) => String(a.title || a.fileName).localeCompare(String(b.title || b.fileName), 'ko', { numeric:true }));
}

function explorerFolderButton(folder, parts, selectedPath, depth = 0) {
  const nextParts = [...parts, folder.name];
  const key = pathKey(nextParts);
  const counts = descendantCounts(folder);
  return createEl('button', {
    class:`library-explorer-nav-item${key === selectedPath ? ' active' : ''}`,
    type:'button',
    style:`--explorer-depth:${Math.max(0, depth)}`,
    dataset:{ libraryExplorerFolder:key },
    title:key.replaceAll('>', ' › ')
  }, [
    createEl('span', { class:'library-explorer-nav-icon', text:'📁', 'aria-hidden':'true' }),
    createEl('span', { class:'library-explorer-nav-label', text:folder.name }),
    createEl('span', { class:'library-explorer-nav-count', text:String(counts.novels) })
  ]);
}

function selectedPathUsesFolder(selectedPath, key) {
  return selectedPath === key || selectedPath.startsWith(`${key}>`);
}

function appendFolderNavigation(container, node, parts, selectedPath, collapsedFolders, depth = 0) {
  for (const folder of sortedFolders(node)) {
    const nextParts = [...parts, folder.name];
    const key = pathKey(nextParts);
    const children = sortedFolders(folder);
    const storedCollapsed = collapsedFolders.has(key);
    const collapsed = storedCollapsed && !selectedPathUsesFolder(selectedPath, key);
    const branch = createEl('div', {
      class:`library-explorer-nav-branch${collapsed ? ' is-collapsed' : ''}`,
      style:`--explorer-depth:${Math.max(0, depth)}`,
      dataset:{ libraryExplorerBranch:key }
    });
    const row = createEl('div', { class:'library-explorer-nav-row' });
    row.append(createEl('button', {
      class:`library-explorer-nav-toggle${children.length ? '' : ' is-leaf'}`,
      type:'button',
      disabled:children.length ? false : true,
      'aria-label':children.length ? `${folder.name} 하위 폴더 ${collapsed ? '펼치기' : '접기'}` : `${folder.name} 하위 폴더 없음`,
      'aria-expanded':children.length ? (collapsed ? 'false' : 'true') : 'false',
      dataset:children.length ? { libraryExplorerToggle:key } : {},
      text:children.length ? (collapsed ? '▸' : '▾') : '·'
    }));
    row.append(explorerFolderButton(folder, parts, selectedPath, depth));
    branch.append(row);
    if (children.length) {
      const childrenBox = createEl('div', { class:'library-explorer-nav-children', hidden:collapsed ? true : false });
      if (!collapsed) appendFolderNavigation(childrenBox, folder, nextParts, selectedPath, collapsedFolders, depth + 1);
      branch.append(childrenBox);
    }
    container.append(branch);
  }
}

function folderTile(app, folder, parts, deps = {}) {
  const nextParts = [...parts, folder.name];
  const key = pathKey(nextParts);
  const counts = descendantCounts(folder);
  const draggable = deps.libraryDraggableAttrs?.(app, 'folder', { folderKey:key }) || {};
  return createEl('article', { class:'library-explorer-folder-card', ...draggable }, [
    createEl('button', {
      class:'library-explorer-folder-open',
      type:'button',
      dataset:{ libraryExplorerFolder:key },
      title:`${folder.name} 폴더 열기`
    }, [
      createEl('span', { class:'library-explorer-folder-icon', text:'📁', 'aria-hidden':'true' }),
      createEl('span', { class:'library-explorer-folder-copy' }, [
        createEl('strong', { text:folder.name }),
        createEl('small', { text:`하위 폴더 ${counts.folders.toLocaleString('ko-KR')} · 작품 ${counts.novels.toLocaleString('ko-KR')}` })
      ])
    ]),
    createEl('button', {
      class:'library-action-btn library-explorer-folder-action',
      type:'button',
      title:'폴더 작업',
      'aria-label':`${folder.name} 폴더 작업`,
      dataset:{ type:'folder', folderKey:key },
      text:'⋯'
    })
  ]);
}

function breadcrumb(parts) {
  const nav = createEl('nav', { class:'library-explorer-breadcrumb', 'aria-label':'현재 폴더 경로' });
  nav.append(createEl('button', { type:'button', dataset:{ libraryExplorerFolder:'' }, text:'라이브러리' }));
  parts.forEach((part, index) => {
    nav.append(createEl('span', { text:'›', 'aria-hidden':'true' }));
    nav.append(createEl('button', { type:'button', dataset:{ libraryExplorerFolder:pathKey(parts.slice(0, index + 1)) }, text:part }));
  });
  return nav;
}

function renderNovelRows(app, node, deps = {}) {
  const list = createEl('div', { class:'library-explorer-novel-list', role:'list', 'aria-label':'현재 폴더 작품' });
  for (const novel of sortedNovels(node)) {
    const wrapper = createEl('div', { class:'library-explorer-novel-entry', role:'listitem' });
    wrapper.append(createNovelItem(app, novel, deps));
    if (novel.isMultiFile) wrapper.append(createEpisodeList(app, novel, deps));
    list.append(wrapper);
  }
  return list;
}

export function renderLibraryExplorerRuntime(app, box, novels, options = {}, deps = {}) {
  document.body?.classList.remove('library-header-compact');
  box.classList.remove('library-virtual-active', 'library-shelf-active');
  box.classList.add('library-explorer-active');
  delete box.dataset.libraryVirtualActive;

  const cachedTree = app.state.libraryTreeModelCache;
  const tree = cachedTree?.sourceRef === novels && cachedTree?.sourceLength === novels.length
    ? cachedTree.tree
    : buildTree(novels);
  if (!cachedTree || cachedTree.sourceRef !== novels || cachedTree.sourceLength !== novels.length) {
    app.state.libraryTreeModelCache = { sourceRef:novels, sourceLength:novels.length, tree, pass:LIBRARY_EXPLORER_RENDERER_PASS };
  }

  const requested = normalizedPath(app.state.libraryExplorerPath);
  const resolved = resolveNode(tree, requested);
  const selectedPath = pathKey(resolved.parts);
  if (selectedPath !== String(app.state.libraryExplorerPath || '')) app.state.libraryExplorerPath = selectedPath;

  const navigation = createEl('aside', { class:'library-explorer-navigation', 'aria-label':'폴더 탐색' });
  const mobileNavigationToggle = createEl('button', {
    class:'library-explorer-mobile-nav-toggle',
    type:'button',
    'aria-expanded':'false',
    'aria-controls':'library-explorer-nav-tree',
    dataset:{ libraryExplorerMobileNav:'toggle' }
  }, [
    createEl('span', { class:'library-explorer-mobile-nav-icon', text:'📁', 'aria-hidden':'true' }),
    createEl('span', { class:'library-explorer-mobile-nav-copy' }, [
      createEl('strong', { text:resolved.parts.at(-1) || '라이브러리' }),
      createEl('small', { text:selectedPath ? selectedPath.replaceAll('>', ' › ') : `${novels.length.toLocaleString('ko-KR')}개 작품` })
    ]),
    createEl('span', { class:'library-explorer-mobile-nav-chevron', text:'▾', 'aria-hidden':'true' })
  ]);
  navigation.append(mobileNavigationToggle);
  const navigationTree = createEl('div', { id:'library-explorer-nav-tree', class:'library-explorer-nav-tree' });
  navigationTree.append(createEl('button', {
    class:`library-explorer-nav-item library-explorer-root${selectedPath ? '' : ' active'}`,
    type:'button', dataset:{ libraryExplorerFolder:'' }
  }, [
    createEl('span', { class:'library-explorer-nav-icon', text:'🗂️', 'aria-hidden':'true' }),
    createEl('span', { class:'library-explorer-nav-label', text:'라이브러리' }),
    createEl('span', { class:'library-explorer-nav-count', text:String(novels.length) })
  ]));
  const explorerCollapsed = app.state.libraryExplorerCollapsedFolders instanceof Set
    ? app.state.libraryExplorerCollapsedFolders
    : (app.state.libraryExplorerCollapsedFolders = new Set());
  appendFolderNavigation(navigationTree, tree, [], selectedPath, explorerCollapsed, 0);
  navigation.append(navigationTree);

  const workspace = createEl('section', { class:'library-explorer-workspace' });
  const currentCounts = descendantCounts(resolved.node);
  workspace.append(createEl('header', { class:'library-explorer-toolbar' }, [
    breadcrumb(resolved.parts),
    createEl('div', { class:'library-explorer-folder-summary', text:`현재 위치 · 하위 폴더 ${sortedFolders(resolved.node).length.toLocaleString('ko-KR')} · 작품 ${sortedNovels(resolved.node).length.toLocaleString('ko-KR')} · 전체 ${currentCounts.novels.toLocaleString('ko-KR')}` })
  ]));

  const content = createEl('div', { class:'library-explorer-content' });
  const headerScrollState = createLibraryHeaderScrollState();
  let headerTouchY = null;
  const revealHeader = () => applyLibraryHeaderCompactState(document.body, headerScrollState.reveal(content.scrollTop));
  content.addEventListener('scroll', () => {
    applyLibraryHeaderCompactState(document.body, headerScrollState.update(content.scrollTop));
  }, { passive:true });
  content.addEventListener('wheel', event => { if (Number(event.deltaY) < -2) revealHeader(); }, { passive:true });
  content.addEventListener('touchstart', event => { headerTouchY = Number(event.touches?.[0]?.clientY); }, { passive:true });
  content.addEventListener('touchmove', event => {
    const nextY = Number(event.touches?.[0]?.clientY);
    if (Number.isFinite(nextY) && Number.isFinite(headerTouchY) && nextY - headerTouchY > 5) revealHeader();
    if (Number.isFinite(nextY)) headerTouchY = nextY;
  }, { passive:true });
  content.addEventListener('touchend', () => { headerTouchY = null; }, { passive:true });
  content.append((deps.createRootDropZone || createRootDropZone)());
  const folders = sortedFolders(resolved.node);
  if (folders.length) {
    const folderGrid = createEl('div', { class:'library-explorer-folder-grid', 'aria-label':'하위 폴더' });
    folders.forEach(folder => folderGrid.append(folderTile(app, folder, resolved.parts, deps)));
    content.append(folderGrid);
  }
  const novelsInFolder = sortedNovels(resolved.node);
  if (novelsInFolder.length) content.append(renderNovelRows(app, resolved.node, deps));
  if (!folders.length && !novelsInFolder.length) {
    content.append(createEl('div', { class:'library-explorer-empty' }, [
      createEl('span', { text:'📂', 'aria-hidden':'true' }),
      createEl('strong', { text:'이 폴더는 비어 있습니다.' }),
      createEl('small', { text:'왼쪽 폴더 목록이나 상단 경로에서 다른 위치를 선택하세요.' })
    ]));
  }
  workspace.append(content);

  box.replaceChildren(createEl('div', { class:'library-explorer-shell', dataset:{ libraryExplorerPass:LIBRARY_EXPLORER_RENDERER_PASS } }, [navigation, workspace]));
  if (options.resetScroll) box.scrollTop = 0;
  box.classList.remove('novel-list-rendering');
  return { rendered:true, mode:'explorer', path:selectedPath, folderCount:folders.length, novelCount:novelsInFolder.length, pass:LIBRARY_EXPLORER_RENDERER_PASS };
}
