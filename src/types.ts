import type { WatchOptions } from 'chokidar';
import type { BundleOptions } from '@swc/core/spack';
import type Serverless from 'serverless';

export type ConfigFn = (sls: Serverless) => Configuration;

export type Plugins = any[];
export type ReturnPluginsFn = (sls: Serverless) => Plugins;
export type ESMPluginsModule = { default: Plugins | ReturnPluginsFn };

export interface ImprovedServerlessOptions extends Serverless.Options {
  package?: string;
}

export interface WatchConfiguration {
  pattern?: string[] | string;
  ignore?: string[] | string;
  chokidar?: WatchOptions;
}

export interface PackagerOptions {
  scripts?: string[] | string;
  noInstall?: boolean;
  ignoreLockfile?: boolean;
}

interface NodeExternalsOptions {
  allowList?: string[];
}

export type SwcOptions = Omit<BundleOptions, 'watch' | 'plugins'>;

export interface Configuration extends SwcOptions {
  external?: string[];
  resolveExtensions?: string[];
  concurrency?: number;
  zipConcurrency?: number;
  packager: PackagerId;
  packagerOptions: PackagerOptions;
  packagePath: string;
  exclude: '*' | string[];
  nativeZip: boolean;
  watch: WatchConfiguration;
  installExtraArgs: string[];
  plugins?: string | Plugin[];
  keepOutputDirectory?: boolean;
  outputWorkFolder?: string;
  outputBuildFolder?: string;
  outputFileExtension: '.js' | '.cjs' | '.mjs';
  nodeExternals?: NodeExternalsOptions;
  skipBuild?: boolean;
  skipBuildExcludeFns: string[];
  stripEntryResolveExtensions?: boolean;
}

export interface SwcFunctionDefinitionHandler extends Serverless.FunctionDefinitionHandler {
  skipSwc: boolean;
  swcEntrypoint?: string;
}

export interface FunctionEntry {
  entry: string;
  func: Serverless.FunctionDefinitionHandler | null;
  functionAlias?: string;
}

export interface FunctionBuildResult extends FunctionReference {
  bundlePath: string;
}

export interface FunctionReference {
  func: Serverless.FunctionDefinitionHandler;
  functionAlias: string;
}

interface BuildInvalidate {
  (): Promise<BuildIncremental>;
  dispose(): void;
}

interface BuildIncremental {
  rebuild: BuildInvalidate;
}

interface OldAPIResult {
  rebuild?: BuildInvalidate;
  stop?: () => void;
}

export interface FileBuildResult {
  bundlePath: string;
  entry: string;
  result: OldAPIResult;
}

export type JSONObject = any;

export interface DependenciesResult {
  stdout?: string;
  dependencies?: DependencyMap;
}

export type DependencyMap = Record<string, DependencyTree>;

export interface DependencyTree {
  version: string;
  dependencies?: DependencyMap;
  /** Indicates the dependency is available from the root node_modules folder/root of this tree */
  isRootDep?: boolean;
}

export interface IFile {
  readonly localPath: string;
  readonly rootPath: string;
}
export type IFiles = readonly IFile[];

export type PackagerId = 'npm' | 'pnpm' | 'yarn';

export type PackageJSON = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
};
