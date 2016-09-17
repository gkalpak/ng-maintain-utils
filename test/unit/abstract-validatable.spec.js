'use strict';

// Imports
let util = require('util');

// Imports - Local
let AbstractValidatable = require('../../lib/abstract-validatable');

// Tests
describe('AbstractValidatable', () => {
  describe('#constructor()', () => {
    it('should not allow direct instantiation', () => {
      expect(() => new AbstractValidatable()).toThrowError();
    });
  });

  describe('#_validateFields()', () => {
    it('should throw an error (unless overwritten)', () => {
      class Validatable1 extends AbstractValidatable {}
      class Validatable2 extends AbstractValidatable {
        _validateFields() {
          return 'OK';
        }
      }

      let v1 = new Validatable1();
      let v2 = new Validatable2();

      expect(() => v1._validateFields()).toThrowError(/abstract method .*`_validateFields\(\)`/);
      expect(() => v2._validateFields()).not.toThrow();
      expect(v2._validateFields()).toBe('OK');
    });
  });

  describe('#toString()', () => {
    it('should nicely format the instance', () => {
      class Validatable extends AbstractValidatable {}

      let validatable = new Validatable();

      expect(validatable.toString()).toBe(util.format(validatable));
    });
  });
});
