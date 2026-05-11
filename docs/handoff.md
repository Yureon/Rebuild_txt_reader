## v544 app-state syntax guard handoff

- Basis ZIP: `txt_reader_multi_v543.zip`; output target: `txt_reader_multi_v544.zip`; runtime marker: `rebuild-v544`.
- User reported browser parse failure: `app-state.mjs:101 Uncaught SyntaxError: Invalid or unexpected token`.
- `public/scripts/rebuild/state/app-state.mjs` line 101 was syntactically valid under Node, but it contained a raw Korean fallback string. To remove any encoding/cache edge case, the fallback Korean literals in this module were changed to explicit Unicode escape sequences.
- All `rebuild-v543` cachebusters were bumped to `rebuild-v544`, and all existing precompressed static sidecars were regenerated.
- Verification completed: `npm run check` and `npm run smoke:quick` passed.
