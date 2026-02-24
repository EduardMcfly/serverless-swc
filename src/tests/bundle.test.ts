import path from 'node:path';
import { bundle as swcBundle } from '@swc/core';
import type { BundleOptions } from '@swc/core/spack';
import pMap from 'p-map';
import type { PartialDeep } from 'type-fest';

import { bundle } from '../bundle';

import type { Configuration, FunctionBuildResult, FunctionEntry } from '../types';
import type SwcServerlessPlugin from '../index';

jest.mock('@swc/core', () => ({
  bundle: jest.fn().mockResolvedValue({}),
}));
jest.mock('p-map');
jest.mock('fs-extra', () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const getBuild = async () => {
  return swcBundle;
};

const swcPlugin = (override?: Partial<SwcServerlessPlugin>): SwcServerlessPlugin =>
  ({
    prepare: jest.fn(),
    serverless: {
      cli: {
        log: jest.fn(),
      },
      classes: {
        Error,
      },
    },
    buildOptions: {
      concurrency: Infinity,

      target: 'node',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},

      outputFileExtension: '.js',
    },
    plugins: [],
    buildDirPath: '/workdir/.swc',
    functionEntries: [],
    log: {
      error: jest.fn(),
      warning: jest.fn(),
      notice: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      success: jest.fn(),
    },
    ...override,
  } as PartialDeep<SwcServerlessPlugin> as SwcServerlessPlugin);

beforeEach(() => {
  jest.mocked(swcBundle).mockImplementation(async (optionsArg: any) => {
    // Generate a response that will match output[file] logic
    const options = optionsArg as BundleOptions;
    if (typeof options.entry === 'string') {
      const entryName = path.basename(options.entry);
      return {
        [entryName]: {
          code: 'mock-code',
          map: 'mock-map',
        },
      };
    }
    return {};
  });
  jest.mocked(pMap).mockImplementation((entries, mapper) => {
    return Promise.all((entries as string[]).map((entry, index) => mapper(entry, index)));
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

it('should call swc only once when functions share the same entry', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler2',
      },
      functionAlias: 'func2',
    },
  ];

  await bundle.call(swcPlugin({ functionEntries }));

  const proxy = await getBuild();
  expect(proxy).toHaveBeenCalledTimes(1);
});

it('should only call swc multiple times when functions have different entries', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
    {
      entry: 'file2.ts',
      func: {
        events: [],
        handler: 'file2.handler',
      },
      functionAlias: 'func2',
    },
  ];

  await bundle.call(swcPlugin({ functionEntries }));

  const proxy = await getBuild();
  expect(proxy).toHaveBeenCalledTimes(2);
});

it('should set buildResults after compilation is complete', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
    {
      entry: 'file2.ts',
      func: {
        events: [],
        handler: 'file2.handler',
      },
      functionAlias: 'func2',
    },
  ];

  const expectedResults: FunctionBuildResult[] = [
    {
      bundlePath: 'file1.js',
      func: { events: [], handler: 'file1.handler' },
      functionAlias: 'func1',
    },
    {
      bundlePath: 'file2.js',
      func: { events: [], handler: 'file2.handler' },
      functionAlias: 'func2',
    },
  ];

  const plugin = swcPlugin({ functionEntries });

  await bundle.call(plugin);

  expect(plugin.buildResults).toStrictEqual(expectedResults);
});

it('should set the concurrency for pMap with the concurrency specified', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
  ];

  const plugin = swcPlugin({ functionEntries });

  await bundle.call(plugin);

  expect(pMap).toHaveBeenCalledWith(expect.any(Array), expect.any(Function), {
    concurrency: Infinity,
  });
});

it('should filter out non swc options', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
  ];

  const plugin = swcPlugin({ functionEntries });

  await bundle.call(plugin);

  const config: any = {
    entry: 'file1.ts',
    target: 'node',
    external: [],
    externalModules: ['aws-sdk'],
    output: {
      name: 'file1.js',
      path: '/workdir/.swc',
    },
  };

  const proxy = await getBuild();

  expect(proxy).toHaveBeenCalledWith(config);
});

describe('buildOption platform node', () => {
  it('should set buildResults buildPath after compilation is complete with default extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.js',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.js',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const plugin = swcPlugin({ functionEntries });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should set buildResults buildPath after compilation is complete with ".cjs" extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,

      target: 'node',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},

      outputFileExtension: '.cjs',
    };

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.cjs',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.cjs',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const plugin = swcPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should error when trying to use ".mjs" extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,

      target: 'node',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},

      outputFileExtension: '.mjs',
    };

    const plugin = swcPlugin({ functionEntries, buildOptions: buildOptions as any });

    const expectedError = 'ERROR: Non esm builds should not output a file with extension ".mjs".';

    try {
      await bundle.call(plugin);
    } catch (error) {
      expect(error).toHaveProperty('message', expectedError);
    }
  });
});

describe('buildOption platform neutral', () => {
  it('should set buildResults buildPath after compilation is complete with default extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,

      target: 'node',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},

      outputFileExtension: '.js',
    };

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.js',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.js',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const plugin = swcPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should set buildResults buildPath after compilation is complete with ".mjs" extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,

      target: 'node',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},

      outputFileExtension: '.mjs',
    };

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.mjs',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.mjs',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const plugin = swcPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should error when trying to use ".cjs" extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,

      target: 'node',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},

      outputFileExtension: '.cjs',
    };

    const plugin = swcPlugin({ functionEntries, buildOptions: buildOptions as any });

    const expectedError = 'ERROR: format "esm" or platform "neutral" should not output a file with extension ".cjs".';

    try {
      await bundle.call(plugin);
    } catch (error) {
      expect(error).toHaveProperty('message', expectedError);
    }
  });
});
