'use strict';

// Imports - Local
let AbstractValidatable = require('./abstract-validatable');

// Classes
class Phase extends AbstractValidatable {
  // Constructor
  constructor(id, description, instructions, error) {
    super();

    this.id = id;
    this.description = description;
    this.instructions = instructions || [];
    this.error = error || null;

    this._validateFields();
  }

  // Methods - Protected
  _validateFields() {
    if (typeof this.id !== 'string') {
      this._missingOrInvalidField('id');
    }

    if (typeof this.description !== 'string') {
      this._missingOrInvalidField('description');
    }

    if (!Array.isArray(this.instructions)) {
      this._missingOrInvalidField('instructions');
    }

    this.instructions.forEach(instruction => {
      if (typeof instruction !== 'string') {
        this._missingOrInvalidField('instruction');
      }
    });

    if (this.error && (typeof this.error !== 'string')) {
      this._missingOrInvalidField('error');
    }
  }
}

// Exports
module.exports = Phase;
