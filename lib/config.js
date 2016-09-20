'use strict';

// Imports
var path = require('path');

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
    this.versionInfo = this._initializeVersionInfo();

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

  _initializeVersionInfo() {
    let pkg = this._loadMainPackage();

    return {
      name: pkg.name || 'N/A',
      version: pkg.version || 'N/A'
    };
  }

  _isObject(obj) {
    return (obj !== null) && (typeof obj === 'object');
  }

  _isString(str) {
    return typeof str === 'string';
  }

  _loadMainPackage() {
    let pkg = {};
    let oldDirPath = require.main && require.main.filename;
    let newDirPath;

    while ((newDirPath = path.dirname(oldDirPath)) !== oldDirPath) {
      oldDirPath = newDirPath;
      let candidatePkgPath = path.join(newDirPath, 'package.json');

      try {
        pkg = require(candidatePkgPath);
        break;
      } catch (err) {
        // Ignore.
      }
    }

    return pkg;
  }

  _setMessageIfNotSet(obj, propName, value) {
    if (typeof obj[propName] !== 'string') {
      obj[propName] = value || `<no ${propName} message>`;
    }
  }

  _validateFields() {
    // Validate `messages`
    if (!this._isObject(this.messages)) {
      this._missingOrInvalidField('messages');
    }

    if (!this._isObject(this.messages.errors)) {
      this._missingOrInvalidField('messages.errors');
    }

    if (!this._isObject(this.messages.warnings)) {
      this._missingOrInvalidField('messages.warnings');
    }

    // Validate `argSpecs`
    if (!Array.isArray(this.argSpecs)) {
      this._missingOrInvalidField('argSpecs');
    }

    this.argSpecs.forEach(argSpec => {
      if (!(argSpec instanceof ArgSpec)) {
        this._missingOrInvalidField('argSpec');
      }
    });

    // Validate `defaults`
    if (!this._isObject(this.defaults)) {
      this._missingOrInvalidField('defaults');
    }

    // Validate `versionInfo`
    let vInfo = this.versionInfo;
    if (!this._isObject(vInfo) || !this._isString(vInfo.name) || !this._isString(vInfo.version)) {
      this._missingOrInvalidField('versionInfo');
    }
  }
}

// Exports
module.exports = Config;
