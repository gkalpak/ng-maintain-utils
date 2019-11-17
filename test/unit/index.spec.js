'use strict';

// Imports - Local
let index = require('../../index');

// Tests
describe('index', () => {
  it('should expose all necessary classes', () => {
    expect(index).toEqual({
      AbstractCli: jasmine.any(Function),
      ArgSpec: jasmine.any(Function),
      CleanUper: jasmine.any(Function),
      Config: jasmine.any(Function),
      GitUtils: jasmine.any(Function),
      Logger: jasmine.any(Function),
      Phase: jasmine.any(Function),
      UiUtils: jasmine.any(Function),
      Utils: jasmine.any(Function)
    });
  });
});
