'use strict';

// Imports
let util = require('util');

// Classes
class AbstractValidatable {
  // Constructor
  constructor() {
    if (this.constructor === AbstractValidatable) {
      throw new Error('Trying to instantiate abstract class `AbstractValidatable`.');
    }
  }

  // Methods - Protected
  _missingOrInvalidField(field) {
    throw new Error(`Missing or invalid field \`${field}\` on: ${this}`);
  }

  _validateFields() {
    throw new Error('Missing implementation for abstract method `_validateFields()`.');
  }

  // Methods - Public
  toString() {
    return util.format(this);
  }
}

// Exports
module.exports = AbstractValidatable;
