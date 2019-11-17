'use strict';

// Classes
class Logger {
  // Methods - Public
  debug(...args) { console.debug(...args); }
  error(...args) { console.error(...args); }
  info(...args) { console.info(...args); }
  log(...args) { console.log(...args); }
  warn(...args) { console.warn(...args); }
}

// Exports
module.exports = Logger;
