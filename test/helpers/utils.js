'use strict';

// Exports
module.exports.reversePromise = reversePromise;

// Functions - Definitions
function reversePromise(promise) {
  // "Reverse" the promise: `resolve` --> `reject`, `reject` --> `resolve`
  // (I.e the desired outcome is for this promise to be rejected.)
  return promise.then(v => Promise.reject(v), e => Promise.resolve(e));
}
