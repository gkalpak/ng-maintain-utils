'use strict';

// Classes
class MockLogger {
  // Constructor
  constructor() {
    this.clear();
  }

  // Methods - Public
  clear() {
    this.logs = {
      debug: [],
      error: [],
      info: [],
      log: [],
      warn: [],
    };
  }

  debug(...args) { this.logs.debug.push(args); }
  error(...args) { this.logs.error.push(args); }
  info(...args) { this.logs.info.push(args); }
  log(...args) { this.logs.log.push(args); }
  warn(...args) { this.logs.warn.push(args); }
}

// Exports
module.exports = MockLogger;
