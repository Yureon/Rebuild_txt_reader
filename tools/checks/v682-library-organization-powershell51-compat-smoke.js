#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { createLibraryOrganizationService } = require('../../server/services/library-organization-service');

(async () => {
  const service = createLibraryOrganizationService({
    libraryService:{
      async getLibraryCachedAsync(){
        return [
          { id:'n1', title:'작품', author:'작가', singlePath:'원본/작품.txt' },
          { id:'n2', title:'다른 작품', author:'다른 작가', singlePath:'원본/다른 작품.txt' }
        ];
      }
    }
  });
  const generated = await service.generateScript({ layout:'author-title', mode:'copy' });
  const script = generated.script;
  assert.equal(generated.pass, 'v643-library-organization-script-pass');
  assert(script.includes('#requires -Version 5.1'));
  assert(script.includes('function Get-RelativePathCompat'));
  assert(script.includes('$candidateFull.Substring($rootFull.Length)'));
  assert(script.includes('[System.StringComparison]::OrdinalIgnoreCase'));
  assert(script.includes("if ([string]::IsNullOrEmpty($relative)) { return }"));
  assert(!script.includes('[System.IO.Path]::GetRelativePath('), 'Windows PowerShell 5.1-incompatible API remained');
  assert(!script.includes('ConvertFrom-Json -AsHashtable'), 'PowerShell 7-only ConvertFrom-Json option remained');
  console.log(JSON.stringify({
    pass:'v682-library-organization-powershell51-compat-pass',
    generatedBytes:Buffer.byteLength(script),
    removedApi:'System.IO.Path.GetRelativePath',
    powershell51RuntimeExecuted:false
  }));
})().catch(error => { console.error(error); process.exit(1); });
