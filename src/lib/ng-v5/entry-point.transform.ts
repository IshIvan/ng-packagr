import { pipe } from 'rxjs';
import { STATE_DONE } from '../brocc/node';
import { isInAsd, isInProgress } from '../brocc/select';
import { Transform, transformFromPromise } from '../brocc/transform';
import * as log from '../util/log';
import { byEntryPoint } from './nodes';
import { ngCompileStore } from './entry-point/ts/compile-ngc.di';

/**
 * A re-write of the `transformSources()` script that transforms an entry point from sources to distributable format.
 *
 * Sources are TypeScript source files accompanied by HTML templates and xCSS stylesheets.
 * See the Angular Package Format for a detailed description of what the distributables include.
 *
 * The current transformation pipeline can be thought of as:
 *
 *  - clean
 *  - compileTs
 *  - downlevelTs
 *  - writeBundles
 *    - bundleToFesm15
 *    - bundleToFesm5
 *    - bundleToUmd
 *    - bundleToUmdMin
 *  - relocateSourceMaps
 *  - writePackage
 *   - copyStagedFiles (bundles, esm, dts, metadata, sourcemaps)
 *   - writePackageJson
 *
 * The transformation pipeline is pluggable through the dependency injection system.
 * Sub-transformations are passed to this factory function as arguments.
 *
 * @param compileTs Transformation compiling typescript sources to ES2015 modules.
 * @param writeBundles Transformation flattening ES2015 modules to ESM2015, ESM5, UMD, and minified UMD.
 * @param writePackage Transformation writing a distribution-ready `package.json` (for publishing to npm registry).
 */
export const entryPointTransformFactory = (
  compileTs: Transform,
  writeBundles: Transform,
  writePackage: Transform,
): Transform =>
  pipe(
    //tap(() => log.info(`Building from sources for entry point`)),

    transformFromPromise(async graph => {
      // Peek the first entry point from the graph
      const entryPoint = graph.find(byEntryPoint().and(isInProgress));

      ngCompileStore.push(entryPoint);

      log.msg('\n------------------------------------------------------------------------------');
      log.msg(`Building entry point '${entryPoint.data.entryPoint.moduleId}'`);
      log.msg('------------------------------------------------------------------------------');
      entryPoint.state = 'ngcc';
    }),
    // TypeScript sources compilation
    compileTs,
    // After TypeScript: bundling and write package
    writeBundles,
    writePackage,
    transformFromPromise(async graph => {
      const entryPoint = graph.find(byEntryPoint().and(isInAsd));
      entryPoint.state = STATE_DONE;
    }),

    //tap(() => log.info(`Built.`))
  );
