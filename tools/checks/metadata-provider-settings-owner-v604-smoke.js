#!/usr/bin/env node
const assert = require('assert');
const Module = require('module');
const PASS = 'v604-metadata-provider-settings-owner-smoke-pass';

function fakeExpress() {
  return {
    raw:() => (_req,_res,next) => next(),
    Router() {
      const router = { routes:[] };
      for (const method of ['get','post','put','delete','patch']) {
        router[method] = (routePath, ...handlers) => { router.routes.push({ method, path:routePath, handlers }); return router; };
      }
      return router;
    }
  };
}

async function invoke(handlers, req, res) {
  let index = -1;
  async function next() {
    index += 1;
    const handler = handlers[index];
    if (handler) return handler(req, res, next);
  }
  await next();
}

function makeResponse() {
  return {
    statusCode:200,
    body:null,
    headers:{},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    getHeader(name) { return this.headers[String(name).toLowerCase()]; },
    end() { return this; }
  };
}

(async () => {
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === 'express') return fakeExpress();
    return originalLoad.call(this, request, parent, isMain);
  };
  let createMetadataRouter;
  try {
    ({ createMetadataRouter } = require('../../server/routes/metadata-routes'));
  } finally {
    Module._load = originalLoad;
  }

  async function buildAndInvoke(session) {
    let writes = 0;
    const router = createMetadataRouter({
      metadataService:{
        enabled:true,
        listProviders:() => [{ id:'p', enabled:true }],
        queueStatus:() => ({}),
        async setProviderSettings(_id, patch) { writes += 1; return patch; },
        hasCoverAsset:() => false,
        canAccessCover:() => false
      },
      coverService:{ findAsset:() => null },
      libraryService:{ getLibraryCached:() => [] },
      sessionStore:{ getSession:() => session },
      accountService:{
        getUserLibraryAccess:() => ({ mode:'all', folders:[] }),
        getUserAppPermissions:() => ({ metadataAccess:true, fullSearch:true })
      },
      playwrightService:{},
      requireSameOrigin:(_req,_res,next)=>next(),
      requireCsrf:(_req,_res,next)=>next(),
      checkApiWriteLimit:()=>true
    });
    const route = router.routes.find(item => item.method === 'put' && item.path === '/metadata/providers/:providerId');
    assert(route, 'provider settings route missing');
    const req = { params:{ providerId:'p' }, body:{ enabled:false }, headers:{}, get:()=>'' };
    const res = makeResponse();
    await invoke(route.handlers, req, res);
    return { res, writes };
  }

  const full = await buildAndInvoke({ kind:'user', userId:'full' });
  assert.strictEqual(full.res.statusCode, 403, 'full-library metadata editors must not mutate global provider settings');
  assert.strictEqual(full.res.body.error, 'owner_required');
  assert.strictEqual(full.writes, 0);

  const owner = await buildAndInvoke({ kind:'owner', id:'owner' });
  assert.strictEqual(owner.res.statusCode, 200);
  assert.strictEqual(owner.writes, 1);

  const source = require('fs').readFileSync('server/routes/metadata-routes.js', 'utf8');
  assert(source.includes("router.put('/metadata/providers/:providerId', requireSameOrigin, requireCsrf, writeGuard('metadata-provider-settings', 30), requireOwner"));
  assert(source.includes('canManageProviderSettings'));
  const uiSource = require('fs').readFileSync('public/scripts/rebuild/features/library-metadata-runtime.mjs', 'utf8');
  assert(uiSource.includes('providerControls(providers, canManageProviderSettings)'));
  assert(uiSource.includes("href:'/admin/users.html#metadata'"));
  console.log(JSON.stringify({ pass:PASS, ownerWrites:owner.writes }));
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
