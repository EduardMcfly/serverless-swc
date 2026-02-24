import assert from 'assert';
import { Predicate } from 'effect';
import { bundle as swcBundle } from '@swc/core';
import type { BundleOptions } from '@swc/core/spack';
import fs from 'fs-extra';
import pMap from 'p-map';
import path from 'path';
import { uniq } from 'ramda';

import type SwcServerlessPlugin from './index';
import { asArray, assertIsString, isESM } from './helper';
import type { Configuration, FileBuildResult, FunctionBuildResult } from './types';

const getStringArray = (input: unknown): string[] => asArray(input).filter(Predicate.isString);

export async function bundle(this: SwcServerlessPlugin): Promise<void> {
  assert(this.buildOptions, 'buildOptions is not defined');

  this.prepare();

  this.log.verbose(`Compiling to ${this.buildOptions?.target} bundle with swc...`);

  const exclude = getStringArray(this.buildOptions?.exclude);

  const optionsList: (keyof Configuration)[] = [
    'concurrency',
    'zipConcurrency',
    'exclude',
    'nativeZip',
    'packager',
    'packagePath',
    'watch',
    'keepOutputDirectory',
    'packagerOptions',
    'installExtraArgs',
    'outputFileExtension',
    'outputBuildFolder',
    'outputWorkFolder',
    'nodeExternals',
    'skipBuild',
    'skipBuildExcludeFns',
    'stripEntryResolveExtensions',
  ];

  const swcOptions = optionsList.reduce<Record<string, any>>((options, optionName) => {
    const { [optionName]: _, ...rest } = options;

    return rest;
  }, this.buildOptions) as BundleOptions;

  const config: Omit<BundleOptions, 'watch' | 'plugins' | 'entry' | 'output'> = {
    ...swcOptions,
    externalModules: [...getStringArray(this.buildOptions?.external), ...(exclude.includes('*') ? [] : exclude)],
  };

  const { buildOptions, buildDirPath } = this;

  assert(buildOptions, 'buildOptions is not defined');

  assertIsString(buildDirPath, 'buildDirPath is not a string');

  if (isESM(buildOptions) && buildOptions.outputFileExtension === '.cjs') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Serverless typings (as of v3.0.2) are incorrect
    throw new this.serverless.classes.Error(
      'ERROR: format "esm" or platform "neutral" should not output a file with extension ".cjs".'
    );
  }

  if (!isESM(buildOptions) && buildOptions.outputFileExtension === '.mjs') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Serverless typings (as of v3.0.2) are incorrect
    throw new this.serverless.classes.Error('ERROR: Non esm builds should not output a file with extension ".mjs".');
  }

  /** Build the files */
  const bundleMapper = async (entry: string): Promise<FileBuildResult> => {
    const bundlePath = entry.slice(0, entry.lastIndexOf('.')) + buildOptions.outputFileExtension;

    // TODO
    // if (this.buildCache) {
    //   const { result } = this.buildCache[entry] ?? {};
    //   if (result) {
    //     return { bundlePath, entry, result };
    //   }
    // }

    const outFile = path.basename(bundlePath);
    const options: BundleOptions = {
      ...config,
      entry,
      output: {
        path: path.join(buildDirPath, path.dirname(entry)),
        name: outFile,
      },
    };

    try {
      const result = await swcBundle(options).then((out) => out[path.basename(entry)]);

      if (!result) throw new Error(`Failed to bundle ${entry}`);

      const { code, map } = result;
      const { path: outPath, name } = options.output;
      fs.mkdirSync(outPath, { recursive: true });

      const sourceMaps = options.options?.sourceMaps ?? true;

      const outFilePath = path.join(outPath, outFile);
      let finalCode = code;

      if (map && sourceMaps === 'inline') {
        const base64Map = Buffer.from(map).toString('base64');
        finalCode += `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${base64Map}`;
      } else if (map && sourceMaps) {
        fs.writeFileSync(`${outFilePath}.map`, map);
        finalCode += `\n//# sourceMappingURL=${name}.map`;
      }

      if (finalCode) fs.writeFileSync(outFilePath, finalCode);

      return { bundlePath, entry, result };
    } catch (err: any) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Serverless typings (as of v3.0.2) are incorrect
      throw new this.serverless.classes.Error(`SWC bundle failed: ${err.message}`);
    }
  };

  // Files can contain multiple handlers for multiple functions, we want to get only the unique ones
  const uniqueFiles: string[] = uniq(this.functionEntries.map(({ entry }) => entry));

  this.log.verbose(`Compiling with concurrency: ${buildOptions.concurrency}`);

  const fileBuildResults = await pMap(uniqueFiles, bundleMapper, {
    concurrency: buildOptions.concurrency,
  });

  // Create a cache with entry as key
  this.buildCache = fileBuildResults.reduce<Record<string, FileBuildResult>>((acc, fileBuildResult) => {
    acc[fileBuildResult.entry] = fileBuildResult;

    return acc;
  }, {});

  // Map function entries back to bundles
  this.buildResults = this.functionEntries
    .map(({ entry, func, functionAlias }) => {
      const { bundlePath } = this.buildCache[entry] ?? {};

      if (typeof bundlePath !== 'string' || func === null) {
        return;
      }

      return { bundlePath, func, functionAlias };
    })
    .filter((result): result is FunctionBuildResult => typeof result === 'object');

  this.log.verbose('Compiling completed.');
}
