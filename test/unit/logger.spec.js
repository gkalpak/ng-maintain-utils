'use strict';

// Imports - Local
let Logger = require('../../lib/logger');

// Tests
describe('GitUtils', () => {
  let logger;

  beforeEach(() => {
    logger = new Logger();
  });

  ['debug', 'error', 'info', 'log', 'warn'].forEach(method => {
    describe(`#${method}()`, () => {
      it(`should call \`console.${method}()\``, () => {
        const spy = spyOn(console, method);
        logger[method]('foo', 'bar');

        expect(spy).toHaveBeenCalledWith('foo', 'bar');
      });
    });
  });
});
