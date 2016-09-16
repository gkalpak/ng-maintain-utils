'use strict';

// Imports - Local
let AbstractValidatable = require('../../lib/abstract-validatable');
let Phase = require('../../lib/phase');

// Tests
describe('Phase', () => {
  it('should extend `AbstractValidatable`', () => {
    let phase = new Phase('', '');

    expect(phase).toEqual(jasmine.any(Phase));
    expect(phase).toEqual(jasmine.any(AbstractValidatable));
  });

  describe('#constructor()', () => {
    it('should initialize properties based on arguments', () => {
      let phase = new Phase('foo', 'bar', ['baz', 'qux'], 'test');

      expect(phase.id).toBe('foo');
      expect(phase.description).toBe('bar');
      expect(phase.instructions).toEqual(['baz', 'qux']);
      expect(phase.error).toBe('test');
    });

    it('should set a default value for `instructions`', () => {
      let phases = [
        new Phase('foo', 'bar'),
        new Phase('foo', 'bar', undefined),
        new Phase('foo', 'bar', null),
        new Phase('foo', 'bar', false),
        new Phase('foo', 'bar', 0),
        new Phase('foo', 'bar', ''),
      ];

      phases.forEach(phase => {
        expect(phase.instructions).toEqual([]);
      });
    });

    it('should set a default value for `error`', () => {
      let phases = [
        new Phase('foo', 'bar', []),
        new Phase('foo', 'bar', [], undefined),
        new Phase('foo', 'bar', [], null),
        new Phase('foo', 'bar', [], false),
        new Phase('foo', 'bar', [], 0),
        new Phase('foo', 'bar', [], ''),
      ];

      phases.forEach(phase => {
        expect(phase.error).toBeNull();
      });
    });

    describe('- Field validation', () => {
      let missingOrInvalidFieldSpy;

      beforeEach(() => {
        missingOrInvalidFieldSpy = spyOn(AbstractValidatable.prototype, '_missingOrInvalidField');
      });

      it('should validate `id`', () => {
        new Phase();

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('id');

        missingOrInvalidFieldSpy.calls.reset();
        new Phase(1);

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('id');
      });

      it('should validate `description`', () => {
        new Phase('');

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('description');

        missingOrInvalidFieldSpy.calls.reset();
        new Phase('', true);

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('description');
      });

      it('should validate `instructions`', () => {
        new Phase('', '');

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();

        missingOrInvalidFieldSpy.calls.reset();
        new Phase('', '', {forEach: () => {}});

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('instructions');
      });

      it('should validate each `instruction`', () => {
        new Phase('', '', ['', null]);

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('instruction');
      });

      it('should validate `error`', () => {
        new Phase('', '', []);

        expect(missingOrInvalidFieldSpy).not.toHaveBeenCalled();

        missingOrInvalidFieldSpy.calls.reset();
        new Phase('', '', [], () => {});

        expect(missingOrInvalidFieldSpy).toHaveBeenCalledWith('error');
      });
    });
  });
});
