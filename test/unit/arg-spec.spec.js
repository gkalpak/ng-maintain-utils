'use strict';

// Imports - Local
let AbstractValidatable = require('../../lib/abstract-validatable');
let ArgSpec = require('../../lib/arg-spec');
let UnnamedArgSpec = ArgSpec.Unnamed;

// Tests
describe('ArgSpec', () => {
  it('should extend `AbstractValidatable`', () => {
    let argSpec = new ArgSpec('', () => {}, '');

    expect(argSpec).toEqual(jasmine.any(ArgSpec));
    expect(argSpec).toEqual(jasmine.any(AbstractValidatable));
  });

  describe('#constructor()', () => {
    it('should initialize properties based on arguments', () => {
      let argSpec = new ArgSpec('foo', () => 'bar', 'baz', 'qux');

      expect(argSpec.key).toBe('foo');
      expect(argSpec.validator()).toBe('bar');
      expect(argSpec.errorCode).toBe('baz');
      expect(argSpec.defaultValue).toBe('qux');
    });

    it('should set a default value for `defaultValue`', () => {
      let argSpecs = [
        new ArgSpec('', () => {}, ''),
        new ArgSpec('', () => {}, '', undefined),
        new ArgSpec('', () => {}, '', null),
        new ArgSpec('', () => {}, '', false),
        new ArgSpec('', () => {}, '', 0),
        new ArgSpec('', () => {}, '', '')
      ];

      argSpecs.forEach(argSpec => {
        expect(argSpec.defaultValue).toBeNull();
      });
    });

    describe('- Field validation', () => {
      let missingOrInvalidFieldSpy;

      beforeEach(() => {
        missingOrInvalidFieldSpy = spyOn(AbstractValidatable.prototype, '_missingOrInvalidField');
      });

      it('should validate `key`', () => {
        new ArgSpec();

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('key');

        missingOrInvalidFieldSpy.calls.reset();
        new ArgSpec(1);

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('key');
      });

      it('should validate `validator`', () => {
        new ArgSpec('');

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('validator');

        missingOrInvalidFieldSpy.calls.reset();
        new ArgSpec('', true);

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('validator');

        missingOrInvalidFieldSpy.calls.reset();
        new ArgSpec('', '');

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('validator');
      });

      it('should validate `errorCode`', () => {
        new ArgSpec('', () => {});

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('errorCode');

        missingOrInvalidFieldSpy.calls.reset();
        new ArgSpec('', () => {}, 1);

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('errorCode');
      });

      it('should validate `defaultValue`', () => {
        new ArgSpec('', () => {}, '');

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();

        missingOrInvalidFieldSpy.calls.reset();
        new ArgSpec('', () => {}, '', 1);

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('defaultValue');
      });
    });
  });

  describe('#applyOn()', () => {
    it('should set the value on `input`', () => {
      let argSpec = new ArgSpec('foo', () => true, '');
      let args = {};
      let input = {};

      argSpec.applyOn(args, input);

      expect(input.foo).toBeDefined();
    });

    it('should retrieve the value from `args` (if present)', () => {
      let argSpec = new ArgSpec('foo', () => true, '');
      let args = {foo: 'bar'};
      let input = {};

      argSpec.applyOn(args, input);

      expect(input.foo).toBe('bar');
    });

    it('should fall back to the default value', () => {
      let argSpec = new ArgSpec('foo', () => true, '', 'bar');
      let args = {};
      let input = {};

      argSpec.applyOn(args, input);

      expect(input.foo).toBe('bar');
    });

    it('should validate the retrieved value', () => {
      let validator = jasmine.createSpy('validator').and.returnValue(true);
      let argSpec1 = new ArgSpec('foo', validator, '');
      let argSpec2 = new ArgSpec('baz', validator, '', 'qux');
      let args = {foo: 'bar'};
      let input = {};

      argSpec1.applyOn(args, input);
      argSpec2.applyOn(args, input);

      expect(validator).toHaveBeenCalledWith('bar');
      expect(validator).toHaveBeenCalledWith('qux');
    });

    it('should throw the `errorCode` if validation fails', () => {
      let argSpec = new ArgSpec('foo', () => false, 'baz');
      let args = {foo: 'bar'};
      let input = {};

      expect(() => argSpec.applyOn(args, input)).toThrow('baz');
    });
  });
});

describe('UnnamedArgSpec', () => {
  it('should extend `ArgSpec`', () => {
    let unnamedArgSpec = new UnnamedArgSpec(0, '', () => {}, '');

    expect(unnamedArgSpec).toEqual(jasmine.any(UnnamedArgSpec));
    expect(unnamedArgSpec).toEqual(jasmine.any(ArgSpec));
  });

  describe('#constructor()', () => {
    it('should initialize properties based on arguments', () => {
      let unnamedArgSpec = new UnnamedArgSpec(42, 'foo', () => 'bar', 'baz', 'qux');

      expect(unnamedArgSpec.index).toBe(42);
      expect(unnamedArgSpec.key).toBe('foo');
      expect(unnamedArgSpec.validator()).toBe('bar');
      expect(unnamedArgSpec.errorCode).toBe('baz');
      expect(unnamedArgSpec.defaultValue).toBe('qux');
    });

    describe('- Field validation', () => {
      it('should delegate to `ArgSpec._validateFields()`', () => {
        spyOn(ArgSpec.prototype, '_validateFields');

        let _validateFields = ArgSpec.prototype._validateFields;
        let unnamedArgSpec = new UnnamedArgSpec(0, '', () => {}, '');

        expect(_validateFields).toHaveBeenCalled();
        expect(_validateFields.calls.mostRecent().object).toBe(unnamedArgSpec);
      });

      it('should validate `index`', () => {
        spyOn(AbstractValidatable.prototype, '_missingOrInvalidField');
        let missingOrInvalidFieldSpy = AbstractValidatable.prototype._missingOrInvalidField;

        [0, -0, 1, 1.0, 1e10, 42].forEach(index => new UnnamedArgSpec(index, '', () => {}, ''));

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();

        [
          true, '1', 'one',   // Not numeric
          NaN, Infinity,      // Not finite
          1.1, 1e-10,         // Not integer
          -1, -1e10           // Not positive
        ].forEach(index => {
          missingOrInvalidFieldSpy.calls.reset();
          new UnnamedArgSpec(index, '', () => {}, '');

          expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('index');
        });
      });
    });
  });

  describe('#applyOn()', () => {
    it('should set the value on `input`', () => {
      let unnamedArgSpec = new UnnamedArgSpec(0, 'foo', () => true, '');
      let args = {};
      let input = {};

      unnamedArgSpec.applyOn(args, input);

      expect(input.foo).toBeDefined();
    });

    it('should retrieve the value from `args._` (if present)', () => {
      let unnamedArgSpec = new UnnamedArgSpec(1, 'foo', () => true, '');
      let args = {_: ['foo', 'bar']};
      let input = {};

      unnamedArgSpec.applyOn(args, input);

      expect(input.foo).toBe('bar');
    });

    it('should fall back to the default value', () => {
      let unnamedArgSpec = new UnnamedArgSpec(1, 'foo', () => true, '', 'bar');
      let args1 = {};
      let args2 = {_: ['baz']};
      let input = {};

      unnamedArgSpec.applyOn(args1, input);
      expect(input.foo).toBe('bar');

      unnamedArgSpec.applyOn(args2, input);
      expect(input.foo).toBe('bar');
    });

    it('should validate the retrieved value', () => {
      let validator = jasmine.createSpy('validator').and.returnValue(true);
      let unnamedArgSpec1 = new UnnamedArgSpec(0, 'foo', validator, '');
      let unnamedArgSpec2 = new UnnamedArgSpec(1, 'baz', validator, '', 'qux');
      let args = {_: ['bar']};
      let input = {};

      unnamedArgSpec1.applyOn(args, input);
      unnamedArgSpec2.applyOn(args, input);

      expect(validator).toHaveBeenCalledWith('bar');
      expect(validator).toHaveBeenCalledWith('qux');
    });

    it('should throw the `errorCode` if validation fails', () => {
      let unnamedArgSpec = new UnnamedArgSpec(0, '', () => false, 'baz');
      let args = {_: ['foo']};
      let input = {};

      expect(() => unnamedArgSpec.applyOn(args, input)).toThrow('baz');
    });
  });
});
