const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const RECOVERY_READINESS_SECTION_FACTORY_SMOKE_PASS = 'v235-recovery-readiness-section-factory-smoke-pass';

async function runRecoveryReadinessSectionFactorySmoke(projectRoot) {
  if (!projectRoot) throw new Error('runRecoveryReadinessSectionFactorySmoke requires projectRoot');
  const script = String.raw`
    const makeClassList = () => ({ add(){}, remove(){}, toggle(){} });
    function FakeNode() {}
    globalThis.Node = FakeNode;
    const makeNode = (tag = 'div') => Object.assign(new FakeNode(), {
      tagName:String(tag).toUpperCase(), children:[], dataset:{}, style:{}, className:'', textContent:'', classList:makeClassList(),
      append(...items){ this.children.push(...items.flat()); },
      appendChild(item){ this.children.push(item); return item; },
      setAttribute(key, value){ this[key] = String(value); }
    });
    globalThis.document = {
      createElement(tag) { return makeNode(tag); },
      createTextNode(text) { const node = makeNode('#text'); node.textContent = String(text || ''); return node; }
    };
    const {
      createFinalStabilizationSummarySections,
      createPostStabilizationSmokeReviewSections,
      LIBRARY_VIRTUAL_READINESS_SECTION_FACTORIES_PASS
    } = await import('./public/scripts/rebuild/features/recovery/library-virtual-readiness-section-factories.mjs');
    if (LIBRARY_VIRTUAL_READINESS_SECTION_FACTORIES_PASS !== 'v235-library-virtual-readiness-section-factories-pass') throw new Error('stale section factory marker');
    const finalSections = createFinalStabilizationSummarySections({ releaseBlocking:[], deferredChecks:[], knownIssues:[], nextActions:['keep default off'] });
    if (finalSections.length !== 4) throw new Error('final stabilization sections must keep four section entries');
    if (finalSections[0][0] !== 'Release-blocking classification') throw new Error('final stabilization first section title changed');
    const smokeSections = createPostStabilizationSmokeReviewSections({ smokeChecklist:[], copyTargets:[], deferredLiveChecks:[] });
    if (smokeSections.length !== 3) throw new Error('post stabilization smoke sections must keep three section entries');
    if (smokeSections[1][0] !== 'Recovery Center JSON copy target smoke') throw new Error('copy target section title changed');
  `;
  await runModuleSmokeScript(projectRoot, script, { label: 'recovery readiness section factory smoke', timeoutMs: 8000 })
  return { pass: RECOVERY_READINESS_SECTION_FACTORY_SMOKE_PASS };
}

module.exports = {
  RECOVERY_READINESS_SECTION_FACTORY_SMOKE_PASS,
  runRecoveryReadinessSectionFactorySmoke
};
