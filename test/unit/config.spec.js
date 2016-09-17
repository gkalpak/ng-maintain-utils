'use strict';

// Imports - Local
let AbstractValidatable = require('../../lib/abstract-validatable');
let ArgSpec = require('../../lib/arg-spec');
let Config = require('../../lib/config');

// Tests
describe('Config', () => {
  it('should extend `AbstractValidatable`', () => {
    let config = new Config();

    expect(config).toEqual(jasmine.any(Config));
    expect(config).toEqual(jasmine.any(AbstractValidatable));
  });

  describe('#constructor()', () => {
    it('should initialize properties', () => {
      let config = new Config();

      expect(config.messages).toBeDefined();
      expect(config.argSpecs).toBeDefined();
      expect(config.defaults).toBeDefined();
    });

    describe('- Field initialization', () => {
      describe('#messages', () => {
        it('should be initialized to an object', () => {
          let messages = {};

          let config1 = new Config(messages);
          let config2 = new Config();

          expect(config1.messages).toBe(messages);
          expect(config2.messages).toEqual(jasmine.any(Object));
        });

        ['usage', 'instructionsHeaderTmpl', 'headerTmpl'].forEach(propName => {
          it(`should contain a \`${propName}\` property (string)`, () => {
            let messages = {[propName]: 'test'};
            let config1 = new Config(messages);
            let config2 = new Config();

            expect(config1.messages[propName]).toBe('test');
            expect(config2.messages[propName]).toBe(`<no ${propName} message>`);
          });
        });

        it('should contain an `errors` property (object)', () => {
          let messages1 = {errors: {}};
          let messages2 = {};

          let config1 = new Config(messages1);
          let config2 = new Config(messages2);
          let config3 = new Config();

          expect(config1.messages.errors).toEqual(jasmine.any(Object));
          expect(config2.messages.errors).toEqual(jasmine.any(Object));
          expect(config3.messages.errors).toEqual(jasmine.any(Object));
        });

        it('should contain an `ERROR_unexpected` error (string)', () => {
          let messages1 = {errors: {ERROR_unexpected: 'foo'}};
          let messages2 = {errors: {}};
          let messages3 = {};

          let config1 = new Config(messages1);
          let config2 = new Config(messages2);
          let config3 = new Config(messages3);
          let config4 = new Config();

          expect(config1.messages.errors.ERROR_unexpected).toBe('foo');
          expect(config2.messages.errors.ERROR_unexpected).toEqual(jasmine.any(String));
          expect(config3.messages.errors.ERROR_unexpected).toEqual(jasmine.any(String));
          expect(config4.messages.errors.ERROR_unexpected).toEqual(jasmine.any(String));
        });
      });

      describe('#argSpecs', () => {
        it('should be initialized to an array', () => {
          let argSpecs = [];

          let config1 = new Config(null, argSpecs);
          let config2 = new Config();

          expect(config1.argSpecs).toEqual(jasmine.any(Array));
          expect(config2.argSpecs).toEqual(jasmine.any(Array));
        });
      });

      describe('#defaults', () => {
        it('should be initialized to an object', () => {
          let config1 = new Config({}, []);
          let config2 = new Config({});
          let config3 = new Config();

          expect(config1.defaults).toEqual(jasmine.any(Object));
          expect(config2.defaults).toEqual(jasmine.any(Object));
          expect(config3.defaults).toEqual(jasmine.any(Object));
        });

        it('should retrieve the default values from `argSpecs`', () => {
          let config = new Config(null, [
            new ArgSpec('foo1', () => {}, ''),
            new ArgSpec('foo2', () => {}, '', 'bar2'),
            new ArgSpec.Unnamed(0, 'foo3', () => {}, ''),
            new ArgSpec.Unnamed(1, 'foo4', () => {}, '', 'bar4'),
          ]);

          expect(config.defaults).toEqual({
            foo1: null,
            foo2: 'bar2',
            foo3: null,
            foo4: 'bar4',
          });
        });
      });
    });

    describe('- Field validation', () => {
      let missingOrInvalidFieldSpy;

      beforeEach(() => {
        missingOrInvalidFieldSpy = spyOn(AbstractValidatable.prototype, '_missingOrInvalidField');
      });

      it('should validate `messages`', () => {
        new Config();

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();

        missingOrInvalidFieldSpy.calls.reset();
        new Config(() => {});

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('messages');
      });

      it('should validate `messages.errors`', () => {
        new Config();

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();

        missingOrInvalidFieldSpy.calls.reset();
        new Config({});

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();

        missingOrInvalidFieldSpy.calls.reset();
        new Config({errors: () => {}});

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('messages.errors');
      });

      it('should validate `argSpecs`', () => {
        new Config();

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();

        missingOrInvalidFieldSpy.calls.reset();
        new Config(null, []);

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();

        missingOrInvalidFieldSpy.calls.reset();
        new Config(null, {forEach: () => {}});

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('argSpecs');
      });

      it('should validate each `argSpec`', () => {
        new Config(null, [new ArgSpec('', () => {}, ''), {}]);

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('argSpec');
      });

      it('should validate `defaults`', () => {
        spyOn(Config.prototype, '_initializeDefaults').and.returnValues(null, 'test', () => {});

        new Config();

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('defaults');

        missingOrInvalidFieldSpy.calls.reset();
        new Config();

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('defaults');

        missingOrInvalidFieldSpy.calls.reset();
        new Config();

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('defaults');
      });
    });
  });
});
