import { preLocal } from '../pre-local';

import type SwcServerlessPlugin from '../index';

const chdirSpy = jest.spyOn(process, 'chdir').mockImplementation();

afterEach(() => {
  jest.resetAllMocks();
});

it('should call chdir with the buildDirPath if the invoked function is a node function', () => {
  const swcPlugin = {
    buildDirPath: 'workdir/.build',
    serverless: {
      config: {},
    },
    options: {
      function: 'hello',
    },
    functions: {
      hello: {},
    },
  };

  preLocal.call(swcPlugin as unknown as SwcServerlessPlugin);

  expect(chdirSpy).toHaveBeenCalledWith(swcPlugin.buildDirPath);
});

it('should not call chdir if the invoked function is not a node function', () => {
  const swcPlugin = {
    buildDirPath: 'workdir/.build',
    serverless: {
      config: {},
    },
    options: {
      function: 'hello',
    },
    functions: {},
  };

  preLocal.call(swcPlugin as unknown as SwcServerlessPlugin);

  expect(chdirSpy).not.toHaveBeenCalled();
});
