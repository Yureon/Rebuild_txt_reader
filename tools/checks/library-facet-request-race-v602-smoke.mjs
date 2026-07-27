#!/usr/bin/env node
import assert from 'node:assert/strict';
import { loadLibraryShelfFacets } from '../../public/scripts/rebuild/features/library-shelf-filters.mjs';

function deferred(signal, payload, delay) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(payload), delay);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once:true });
  });
}

let call = 0;
const app = {
  state:{
    libraryShelfFacetsLoaded:false,
    libraryShelfFacetsRequest:null,
    libraryShelfFacetsRequestSerial:0,
    libraryTagFacetMinCount:'auto',
    libraryShelfFilters:{}
  },
  els:{},
  api:{
    novelShelfFilters(options) {
      call += 1;
      const value = call === 1 ? 'old' : 'new';
      return deferred(options?.signal, {
        total:1,
        userTags:[],
        facets:{ authors:[], categories:[], tags:[{value,count:1}], publicationStatuses:[], groupKinds:[] },
        tagDistribution:{ distinct:1, totalUsage:1, histogram:[{count:1,tags:1}] },
        tagPage:{ loaded:1, total:1, hasMore:false, nextCursor:'' }
      }, call === 1 ? 60 : 5);
    }
  }
};

const first = loadLibraryShelfFacets(app);
const second = loadLibraryShelfFacets(app, { force:true });
await Promise.all([first, second]);
assert.deepEqual(app.state.libraryShelfFacets.tags.map(item => item.value), ['new']);
assert.equal(app.state.libraryShelfFacetsLoading, false);
assert.equal(app.state.libraryShelfFacetsRequest, null);
console.log('v602-library-facet-request-race-smoke-pass');
