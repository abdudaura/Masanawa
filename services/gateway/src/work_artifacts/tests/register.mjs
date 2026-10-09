// Node 24 executes exact TypeScript sources after erasing types. No transpiled copies or rewritten tests.
// Resolve the repository's build-style .js imports to their authored .ts file in this isolated module.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
registerHooks({resolve(specifier,context,next) {
  if (specifier.startsWith('./') && specifier.endsWith('.js') &&
      (context.parentURL?.includes('/work_artifacts/') || context.parentURL?.includes('/packages/contracts/src/'))) {
    const target=new URL(specifier.slice(0,-3)+'.ts',context.parentURL);
    if(existsSync(target)) return next(target.href,context);
  }
  return next(specifier,context);
}});
