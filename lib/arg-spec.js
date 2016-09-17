'use strict';

// Imports - Local
let AbstractValidatable = require('./abstract-validatable');

// Classes
class ArgSpec extends AbstractValidatable{
  // Constructor
  constructor(key, validator, errorCode, defaultValue) {
    super();

    this.key = key;
    this.validator = validator;
    this.errorCode = errorCode;
    this.defaultValue = defaultValue || null;

    this._validateFields();
  }

  // Methods - Protected
  _retrieveValue(args, defaultValue) {
    return args.hasOwnProperty(this.key) ? args[this.key] : defaultValue;
  }

  _validateFields() {
    if (typeof this.key !== 'string') {
      this._missingOrInvalidField('key');
    }

    if (typeof this.validator !== 'function') {
      this._missingOrInvalidField('validator');
    }

    if (typeof this.errorCode !== 'string') {
      this._missingOrInvalidField('errorCode');
    }

    if (this.defaultValue && (typeof this.defaultValue !== 'string')) {
      this._missingOrInvalidField('defaultValue');
    }
  }

  // Methods - Public
  applyOn(args, input) {
    let value = this._retrieveValue(args, this.defaultValue);

    if (!this.validator(value)) {
      throw this.errorCode;
    }

    input[this.key] = value;
  }
}

class UnnamedArgSpec extends ArgSpec {
  // Constructor
  constructor(index, key, validator, errorCode, defaultValue) {
    super(key, validator, errorCode, defaultValue);

    this.index = index;

    this._validateExtraFields();
  }

  // Methods - Protected
  _retrieveValue(args, defaultValue) {
    return (args._ && (args._.length > this.index)) ? args._[this.index] : defaultValue;
  }

  _validateExtraFields() {
    let isNumber = typeof this.index === 'number';
    let isFiniteNumber = isNumber && isFinite(this.index);
    let isFiniteInteger = isFiniteNumber && (parseInt(this.index, 10) === this.index);
    let isFinitePositiveInteger = isFiniteInteger && (this.index >= 0);

    if (!isFinitePositiveInteger) {
      this._missingOrInvalidField('index');
    }
  }
}

// Exports
module.exports = ArgSpec;
module.exports.Unnamed = UnnamedArgSpec;
