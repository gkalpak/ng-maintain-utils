'use strict';

// Imports - Local
let AbstractValidatable = require('./abstract-validatable');
let ArgSpec = require('./arg-spec');

// Classes
class Config extends AbstractValidatable {
  // Constructor
  constructor(messages, argSpecs) {
    super();

    this.messages = this._initializeMessages(messages);
    this.argSpecs = this._initializeArgSpecs(argSpecs);
    this.defaults = this._initializeDefaults(this.argSpecs);

    this._validateFields();
  }

  // Methods - Protected
  _initializeArgSpecs(argSpecs) {
    return argSpecs || [];
  }

  _initializeDefaults(argSpecs) {
    let defaults = {};

    argSpecs.forEach(spec => defaults[spec.key] = spec.defaultValue);

    return defaults;
  }

  _initializeMessages(messages) {
    if (!messages) messages = {};
    if (!messages.errors) messages.errors = {};
    if (!messages.warnings) messages.warnings = {};

    [
      'usage',
      'instructionsHeaderTmpl',
      'headerTmpl'
    ].forEach(propName => this._setMessageIfNotSet(messages, propName));

    let unexpectedErrorKey = 'ERROR_unexpected';
    let unexpectedErrorMsg = 'Something went wrong (and that\'s all I know)!';
    this._setMessageIfNotSet(messages.errors, unexpectedErrorKey, unexpectedErrorMsg);

    let expToolWarningKey = 'WARN_experimentalTool';
    let expToolWarningMsg =
        ':::::::::::::::::::::::::::::::::::::::::::::\n' +
        '::  WARNING:                               ::\n' +
        '::    This is still an experimental tool.  ::\n' +
        '::    Use at your own risk!                ::\n' +
        ':::::::::::::::::::::::::::::::::::::::::::::';
    this._setMessageIfNotSet(messages.warnings, expToolWarningKey, expToolWarningMsg);

    return messages;
  }

  _setMessageIfNotSet(obj, propName, value) {
    if (typeof obj[propName] !== 'string') {
      obj[propName] = value || `<no ${propName} message>`;
    }
  }

  _validateFields() {
    if (!this.messages || (typeof this.messages !== 'object')) {
      this._missingOrInvalidField('messages');
    }

    if (!this.messages.errors || (typeof this.messages.errors !== 'object')) {
      this._missingOrInvalidField('messages.errors');
    }

    if (!this.messages.warnings || (typeof this.messages.warnings !== 'object')) {
      this._missingOrInvalidField('messages.warnings');
    }

    if (!Array.isArray(this.argSpecs)) {
      this._missingOrInvalidField('argSpecs');
    }

    this.argSpecs.forEach(argSpec => {
      if (!(argSpec instanceof ArgSpec)) {
        this._missingOrInvalidField('argSpec');
      }
    });

    if (!this.defaults || (typeof this.defaults !== 'object')) {
      this._missingOrInvalidField('defaults');
    }
  }
}

// Exports
module.exports = Config;
