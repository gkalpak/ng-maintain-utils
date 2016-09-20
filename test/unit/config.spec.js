'use strict';

// Imports
let path = require('path');

// Imports - Local
let AbstractValidatable = require('../../lib/abstract-validatable');
let ArgSpec = require('../../lib/arg-spec');
let Config = require('../../lib/config');
let pkg = require('../../package.json');

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
      expect(config.versionInfo).toBeDefined();
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

          expect(config1.messages.errors).toBe(messages1.errors);
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

        it('should contain a `warnings` property (object)', () => {
          let messages1 = {warnings: {}};
          let messages2 = {};

          let config1 = new Config(messages1);
          let config2 = new Config(messages2);
          let config3 = new Config();

          expect(config1.messages.warnings).toBe(messages1.warnings);
          expect(config1.messages.warnings).toEqual(jasmine.any(Object));
          expect(config2.messages.warnings).toEqual(jasmine.any(Object));
          expect(config3.messages.warnings).toEqual(jasmine.any(Object));
        });

        it('should contain an `WARN_experimentalTool` warning (string)', () => {
          let messages1 = {warnings: {WARN_experimentalTool: 'foo'}};
          let messages2 = {warnings: {}};
          let messages3 = {};

          let config1 = new Config(messages1);
          let config2 = new Config(messages2);
          let config3 = new Config(messages3);
          let config4 = new Config();

          expect(config1.messages.warnings.WARN_experimentalTool).toBe('foo');
          expect(config2.messages.warnings.WARN_experimentalTool).toEqual(jasmine.any(String));
          expect(config3.messages.warnings.WARN_experimentalTool).toEqual(jasmine.any(String));
          expect(config4.messages.warnings.WARN_experimentalTool).toEqual(jasmine.any(String));
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

      describe('#versionInfo', () => {
        it('should be initialized to an object', () => {
          let config1 = new Config({}, []);
          let config2 = new Config({});
          let config3 = new Config();

          expect(config1.versionInfo).toEqual(jasmine.any(Object));
          expect(config2.versionInfo).toEqual(jasmine.any(Object));
          expect(config3.versionInfo).toEqual(jasmine.any(Object));
        });

        it('should contain `name` (string) and `version` (string)', () => {
          let config = new Config();

          expect(config.versionInfo).toEqual({
            name: jasmine.any(String),
            version: jasmine.any(String)
          });
          expect(config.versionInfo.name).toBe(pkg.name);
          expect(config.versionInfo.version).toBe(pkg.version);
        });

        it('should fall back to default values if necessary', () => {
          spyOn(path, 'join').and.returnValue('foo');

          let config = new Config();

          expect(config.versionInfo.name).toBe('N/A');
          expect(config.versionInfo.version).toBe('N/A');
        });

        it('should load `package.json` from the main directory', () => {
          spyOn(path, 'dirname').and.callThrough();

          new Config();

          expect(path.dirname).toHaveBeenCalledWith(require.main.filename);
        });

        it('should traverse upwards from the main directory (in search of `package.json`)', () => {
          spyOn(path, 'join').and.returnValue('foo');

          new Config();
          let args = path.join.calls.allArgs();
          let dir = path.dirname(require.main.filename);

          expect(args.length).toBeGreaterThan(1);

          for (let i = 0; i < args.length; i++) {
            expect(args[i][0]).toBe(dir);
            dir = path.dirname(dir);
          }
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

      it('should validate `messages.warnings`', () => {
        new Config();

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();

        missingOrInvalidFieldSpy.calls.reset();
        new Config({});

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();

        missingOrInvalidFieldSpy.calls.reset();
        new Config({warnings: () => {}});

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('messages.warnings');
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

      it('should validate `versionInfo`', () => {
        spyOn(Config.prototype, '_initializeVersionInfo');

        [
          null,
          'test',
          () => {},
          {},
          {name: {}},
          {name: 'foo'},
          {version: 123},
          {version: '1.2.3'}
        ].forEach(value => {
          Config.prototype._initializeVersionInfo.and.returnValue(value);
          missingOrInvalidFieldSpy.calls.reset();

          new Config();

          expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('versionInfo');
        });

        Config.prototype._initializeVersionInfo.and.returnValue({name: 'foo', version: '1.2.3'});
        missingOrInvalidFieldSpy.calls.reset();

        new Config();

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();
      });
    });
  });
});
