'use strict';

// Imports
let chalk = require('chalk');
let readline = require('readline');

// Imports - Local
let CleanUper = require('../../lib/clean-uper');
let Phase = require('../../lib/phase');
let UiUtils = require('../../lib/ui-utils');

// Tests
describe('UiUtils', () => {
  let chalkEnabled;
  let cleanUper;
  let errorMessages;
  let uiUtils;

  beforeEach(() => {
    chalkEnabled = chalk.enabled;
    chalk.enabled = false;

    cleanUper = new CleanUper();
    errorMessages = {};
    uiUtils = new UiUtils(cleanUper, errorMessages);
  });

  afterEach(() => {
    chalk.enabled = chalkEnabled;
  });

  describe('#askQuestion()', () => {
    let mockRl;

    beforeEach(() => {
      mockRl = {
        close: jasmine.createSpy('rl.close()'),
        question: jasmine.createSpy('rl.question()').and.callFake((_, cb) => mockRl.answer = cb)
      };

      spyOn(readline, 'createInterface').and.returnValue(mockRl);
    });

    it('should return a promise', () => {
      expect(uiUtils.askQuestion()).toEqual(jasmine.any(Promise));
    });

    it('should ask the specified question', () => {
      uiUtils.askQuestion('foo');

      expect(mockRl.question).toHaveBeenCalledWith('foo', jasmine.any(Function));
    });

    it('should resolve the returned promise with the received answer', done => {
      uiUtils.
        askQuestion().
        then(value => expect(value).toBe('bar')).
        then(done, done.fail);

      mockRl.answer('bar');
    });

    it('should close the interface once the answer is received', () => {
      uiUtils.askQuestion();
      expect(mockRl.close).not.toHaveBeenCalled();

      mockRl.answer();
      expect(mockRl.close).toHaveBeenCalled();
    });
  });

  describe('#askYesOrNoQuestion()', () => {
    let answer;

    beforeEach(() => {
      answer = null;
      spyOn(uiUtils, 'askQuestion').and.callFake(() => new Promise(resolve => answer = resolve));
    });

    it('should return a promise', () => {
      expect(uiUtils.askYesOrNoQuestion()).toEqual(jasmine.any(Promise));
    });

    it('should ask the specified question', () => {
      uiUtils.askYesOrNoQuestion('foo');

      expect(uiUtils.askQuestion.calls.argsFor(0)[0]).toContain('foo');
    });

    it('should append the available answer options (and highlight the default)', () => {
      uiUtils.askYesOrNoQuestion('foo');
      uiUtils.askYesOrNoQuestion('bar', false);
      uiUtils.askYesOrNoQuestion('baz', true);

      expect(uiUtils.askQuestion.calls.argsFor(0)[0]).toContain('foo [y/N]');
      expect(uiUtils.askQuestion.calls.argsFor(1)[0]).toContain('bar [y/N]');
      expect(uiUtils.askQuestion.calls.argsFor(2)[0]).toContain('baz [Y/n]');
    });

    it('should resolve the returned promise if the answer is "yes"', done => {
      let promises = [];

      promises.push(uiUtils.askYesOrNoQuestion());
      answer('yes');

      promises.push(uiUtils.askYesOrNoQuestion('', false));
      answer('yes');

      promises.push(uiUtils.askYesOrNoQuestion('', true));
      answer('yes');

      Promise.all(promises).then(done, done.fail);
    });

    it('should reject the returned promise if the answer is "no"', done => {
      let promises = [];

      promises.push(reversePromise(uiUtils.askYesOrNoQuestion()));
      answer('no');

      promises.push(reversePromise(uiUtils.askYesOrNoQuestion('', false)));
      answer('no');

      promises.push(reversePromise(uiUtils.askYesOrNoQuestion('', true)));
      answer('no');

      Promise.all(promises).then(done, done.fail);
    });

    it('should ignore case and also accept single-letter answers (default: no)', done => {
      let yesAnswers = ['y', 'Y', 'yes', 'Yes', 'yEs', 'YES'];
      let noAnswers = ['n', 'NO', 'foo', 'yesss', ''];

      let yesPromises = yesAnswers.map(ans => {
        let promise = uiUtils.askYesOrNoQuestion();
        answer(ans);

        return promise;
      });

      let noPromises = noAnswers.map(ans => {
        let promise = uiUtils.askYesOrNoQuestion();
        answer(ans);

        return reversePromise(promise);
      });

      Promise.all(yesPromises.concat(noPromises)).then(done, done.fail);
    });

    it('should ignore case and also accept single-letter answers (default: yes)', done => {
      let yesAnswers = ['y', 'YES', 'bar', 'nooo', ''];
      let noAnswers = ['n', 'N', 'no', 'No', 'nO', 'NO'];

      let yesPromises = yesAnswers.map(ans => {
        let promise = uiUtils.askYesOrNoQuestion('', true);
        answer(ans);

        return promise;
      });

      let noPromises = noAnswers.map(ans => {
        let promise = uiUtils.askYesOrNoQuestion('', true);
        answer(ans);

        return reversePromise(promise);
      });

      Promise.all(yesPromises.concat(noPromises)).then(done, done.fail);
    });
  });

  describe('#offerToCleanUp()', () => {
    let cleanUpPhase;
    let deferred;

    beforeEach(() => {
      cleanUpPhase = cleanUper.getCleanUpPhase();
      deferred = {};

      spyOn(console, 'log');
      spyOn(cleanUper, 'cleanUp');
      spyOn(cleanUper, 'getCleanUpPhase').and.returnValue(cleanUpPhase);

      spyOn(uiUtils, 'phase').and.callFake((phase, doWork, skipCleanUp) => {
        expect(phase).toBe(cleanUpPhase);
        expect(doWork).toEqual(jasmine.any(Function));
        expect(skipCleanUp).toBe(true);

        return Promise.resolve().then(doWork);
      });

      spyOn(uiUtils, 'askYesOrNoQuestion').and.callFake(question => {
        expect(question).toContain('try');
        expect(question).toContain('clean');
        expect(question).toContain('up');
        expect(question).toMatch(/\?$/);

        return new Promise((resolve, reject) => deferred = {resolve, reject});
      });
    });

    it('should return a promise', () => {
      expect(uiUtils.offerToCleanUp()).toEqual(jasmine.any(Promise));
    });

    it('should ask confirmation', () => {
      uiUtils.offerToCleanUp();

      expect(uiUtils.askYesOrNoQuestion).toHaveBeenCalled();
    });

    it('should enter phase `X` and clean up if the user confirms', done => {
      uiUtils.
        offerToCleanUp().
        then(() => expect(uiUtils.phase).toHaveBeenCalled()).
        then(() => expect(cleanUper.cleanUp).toHaveBeenCalledWith()).
        then(done, done.fail);

      deferred.resolve();
    });

    it('should only display clean-up tasks if the user does not confirm', done => {
      uiUtils.
        offerToCleanUp().
        then(() => expect(uiUtils.phase).not.toHaveBeenCalled()).
        then(() => expect(cleanUper.cleanUp).toHaveBeenCalledWith(true)).
        then(done, done.fail);

      deferred.reject();
    });
  });

  describe('#phase()', () => {
    let dummyDoWork;

    beforeEach(() => {
      dummyDoWork = () => new Promise(() => {});

      spyOn(console, 'log');
      spyOn(uiUtils, 'reportAndRejectFnGen');
    });

    it('should log the phase\'s ID and description to the console', () => {
      uiUtils.phase(new Phase('foo', 'bar'), dummyDoWork);

      expect(console.log.calls.argsFor(0)[0]).toMatch(/\WPHASE foo\W+bar\W/);
    });

    it('should only accept a `doWork` callback that returns a promise', () => {
      expect(() => uiUtils.phase({}, {})).toThrow();
      expect(() => uiUtils.phase({}, () => {})).toThrow();
      expect(() => uiUtils.phase({}, dummyDoWork)).not.toThrow();
    });

    it('should return a promise', () => {
      expect(uiUtils.phase({}, dummyDoWork)).toEqual(jasmine.any(Promise));
    });

    it('should resolve the returned promise with the value "returned" by `doWork()`', done => {
      uiUtils.
        phase({}, () => Promise.resolve('bar')).
        then(value => expect(value).toBe('bar')).
        then(done, done.fail);
    });

    it('should report to the console when the work is done', done => {
      let doWork = () => {
        expect(console.log.calls.mostRecent().args[0]).not.toContain('done');
        return Promise.resolve();
      };

      uiUtils.
        phase({}, doWork).
        then(() => expect(console.log.calls.mostRecent().args[0]).toContain('done')).
        then(done, done.fail);
    });

    it('should not report to the console if `doWork()` errors', done => {
      let doWork = () => {
        console.log.calls.reset();
        return Promise.reject();
      };

      uiUtils.
        phase({}, doWork).
        catch(() => {
          expect(console.log).not.toHaveBeenCalled();
          done();
        });
    });

    it('should set up an error callback with the appropriate error', done => {
      let phase = {error: 'foo'};
      let doWork = () => Promise.reject('bar');
      let errorCb = jasmine.createSpy('errorCb');
      uiUtils.reportAndRejectFnGen.and.returnValue(errorCb);

      uiUtils.
        phase(phase, doWork).
        then(() => expect(uiUtils.reportAndRejectFnGen.calls.argsFor(0)[0]).toBe('foo')).
        then(() => expect(errorCb).toHaveBeenCalledWith('bar')).
        then(done, done.fail);
    });

    it('should fall back to a default error for the error callback', done => {
      let phase = {error: null};
      let doWork = () => Promise.reject('bar');
      let errorCode = 'ERROR_unexpected';
      let errorCb = jasmine.createSpy('errorCb');
      uiUtils.reportAndRejectFnGen.and.returnValue(errorCb);

      uiUtils.
        phase(phase, doWork).
        then(() => expect(uiUtils.reportAndRejectFnGen.calls.argsFor(0)[0]).toBe(errorCode)).
        then(() => expect(errorCb).toHaveBeenCalledWith('bar')).
        then(done, done.fail);
    });

    it('should support skipping clean-up', () => {
      uiUtils.phase({}, dummyDoWork);
      uiUtils.phase({}, dummyDoWork, false);
      uiUtils.phase({}, dummyDoWork, true);

      expect(uiUtils.reportAndRejectFnGen.calls.argsFor(0)[1]).toBeFalsy();
      expect(uiUtils.reportAndRejectFnGen.calls.argsFor(1)[1]).toBeFalsy();
      expect(uiUtils.reportAndRejectFnGen.calls.argsFor(2)[1]).toBeTruthy();
    });
  });

  describe('#reportAndRejectFnGen()', () => {
    beforeEach(() => {
      spyOn(console, 'error');
      spyOn(console, 'log');

      spyOn(cleanUper, 'hasTasks');
      spyOn(uiUtils, 'offerToCleanUp').and.returnValue(Promise.resolve());
    });

    it('should return a function', () => {
      let fn = uiUtils.reportAndRejectFnGen();

      expect(fn).toEqual(jasmine.any(Function));
    });

    describe('- Returned function', () => {
      it('should return a promise', () => {
        let promise = reportAndReject();

        expect(promise).toEqual(jasmine.any(Promise));
      });

      it('should log to the console the specified error (if any)', () => {
        reportAndReject(null, null, 'Test');

        expect(console.error.calls.argsFor(0)[1]).toBe('Test');
      });

      it('should mention that clean-up might be needed', () => {
        reportAndReject();
        let message = console.error.calls.argsFor(0)[0].toLowerCase();

        expect(message).toContain('clean-up', 'might', 'needed');
      });

      it('should mention that the operation was aborted', () => {
        reportAndReject();

        expect(console.error.calls.argsFor(0)[0]).toContain('OPERATION ABORTED');
      });

      it('should retrieve the error message based on the specified `errorOrCode`', () => {
        errorMessages.foo = 'bar';
        reportAndReject('foo');

        expect(console.error.calls.argsFor(0)[0]).toContain('ERROR: bar');
      });

      it('should use `errorOrCode` itself if it does not match any error message', () => {
        reportAndReject('unknown code');

        expect(console.error.calls.argsFor(0)[0]).toContain('ERROR: unknown code');
      });

      it('should use a default error message if `errorOrCode` is falsy', () => {
        reportAndReject();
        reportAndReject(null);
        reportAndReject(false);
        reportAndReject(0);
        reportAndReject('');

        console.error.calls.allArgs().forEach(args => {
          expect(args[0]).toContain('ERROR: <no error code>');
        });
      });

      it('should offer to clean up if `cleanUper` has scheduled tasks', done => {
        cleanUper.hasTasks.and.returnValues(false, true);
        let fn = uiUtils.reportAndRejectFnGen();

        fn().catch(() => {});
        expect(uiUtils.offerToCleanUp).not.toHaveBeenCalled();

        fn().catch(done);
        expect(uiUtils.offerToCleanUp).toHaveBeenCalledTimes(1);
      });

      it('should not offer to clean up if `skipCleanUp` is `true`', () => {
        cleanUper.hasTasks.and.returnValue(true);
        reportAndReject(null, true);

        expect(uiUtils.offerToCleanUp).not.toHaveBeenCalled();
      });

      it('should reject the returned promise after having cleaned up (if necessary)', done => {
        cleanUper.hasTasks.and.returnValues(false, true);
        let fn = uiUtils.reportAndRejectFnGen();

        Promise.
          all([
            // No clean-up
            reversePromise(fn()),

            // Clean-up
            reversePromise(fn())
          ]).
          then(done, done.fail);
      });

      it('should log the error to the console when cleaning up errors', done => {
        cleanUper.hasTasks.and.returnValue(true);
        uiUtils.offerToCleanUp.and.returnValue(Promise.reject('Test'));

        reversePromise(uiUtils.reportAndRejectFnGen()()).
          then(() => expect(console.error.calls.mostRecent().args[1]).toBe('Test')).
          then(done, done.fail);
      });

      it('should log a generic error to the console when cleaning up rejects with no reason',
        done => {
          cleanUper.hasTasks.and.returnValue(true);
          uiUtils.offerToCleanUp.and.returnValue(Promise.reject());

          errorMessages.ERROR_unexpected = 'Wait, whaaat?';

          reversePromise(uiUtils.reportAndRejectFnGen()()).
            then(() => expect(console.error.calls.mostRecent().args[1]).toBe('Wait, whaaat?')).
            then(done, done.fail);
        }
      );
    });

    // Helpers
    function reportAndReject(errorOrCode, skipCleanUp, extraError) {
      let promise = uiUtils.reportAndRejectFnGen(errorOrCode, skipCleanUp)(extraError);

      // Avoid `UnhandledPromiseRejectionWarning` (in Node.js v6.6.0).
      promise.catch(() => {});

      return promise;
    }
  });

  // Helpers
  function reversePromise(promise) {
    // "Reverse" the promise; i.e the desired outcome is for this promise to be rejected.
    return promise.then(v => Promise.reject(v), e => Promise.resolve(e));
  }
});
