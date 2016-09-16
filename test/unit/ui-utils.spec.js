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
        then(done);

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

      Promise.all(promises).then(done);
    });

    it('should reject the returned promise if the answer is "no"', done => {
      let promises = [];

      promises.push(reversePromise(uiUtils.askYesOrNoQuestion()));
      answer('no');

      promises.push(reversePromise(uiUtils.askYesOrNoQuestion('', false)));
      answer('no');

      promises.push(reversePromise(uiUtils.askYesOrNoQuestion('', true)));
      answer('no');

      Promise.all(promises).then(done);
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

      Promise.all(yesPromises.concat(noPromises)).then(done);
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

      Promise.all(yesPromises.concat(noPromises)).then(done);
    });
  });

  describe('#exitWithErrorFnGen()', () => {
    beforeEach(() => {
      spyOn(console, 'error');
      spyOn(console, 'log');
      spyOn(process, 'exit');

      spyOn(cleanUper, 'hasTasks');
      spyOn(uiUtils, 'offerToCleanUp').and.returnValue(Promise.resolve());
    });

    it('should return a function', () => {
      let fn = uiUtils.exitWithErrorFnGen();

      expect(fn).toEqual(jasmine.any(Function));
    });

    describe('- Returned function', () => {
      it('should log to the console the specified error (if any)', () => {
        uiUtils.exitWithErrorFnGen()('Test');

        expect(console.error.calls.argsFor(0)[1]).toBe('Test');
      });

      it('should mention that clean-up might be needed', () => {
        uiUtils.exitWithErrorFnGen()();
        let message = console.error.calls.argsFor(0)[0].toLowerCase();

        expect(message).toContain('clean-up', 'might', 'needed');
      });

      it('should mention that the operation was aborted', () => {
        uiUtils.exitWithErrorFnGen()();

        expect(console.error.calls.argsFor(0)[0]).toContain('OPERATION ABORTED');
      });

      it('should retrieve the error message based on the specified `errorOrCode`', () => {
        errorMessages.foo = 'bar';
        uiUtils.exitWithErrorFnGen('foo')();

        expect(console.error.calls.argsFor(0)[0]).toContain('ERROR: bar');
      });

      it('should use `errorOrCode` itself if it does not match any error message', () => {
        uiUtils.exitWithErrorFnGen('unknown code')();

        expect(console.error.calls.argsFor(0)[0]).toContain('ERROR: unknown code');
      });

      it('should use a default error message if `errorOrCode` is falsy', () => {
        uiUtils.exitWithErrorFnGen()();
        uiUtils.exitWithErrorFnGen(null)();
        uiUtils.exitWithErrorFnGen(false)();
        uiUtils.exitWithErrorFnGen(0)();
        uiUtils.exitWithErrorFnGen('')();

        console.error.calls.allArgs().forEach(args => {
          expect(args[0]).toContain('ERROR: <no error code>');
        });
      });

      it('should offer to clean up if `cleanUper` has scheduled tasks', done => {
        cleanUper.hasTasks.and.returnValues(false, true);
        let fn = uiUtils.exitWithErrorFnGen();

        fn();
        expect(uiUtils.offerToCleanUp).not.toHaveBeenCalled();

        fn().then(done);
        expect(uiUtils.offerToCleanUp).toHaveBeenCalledTimes(1);
      });

      it('should not offer to clean up if `skipCleanUp` is `true`', () => {
        cleanUper.hasTasks.and.returnValue(true);
        let fn = uiUtils.exitWithErrorFnGen(null, true);

        fn();
        expect(uiUtils.offerToCleanUp).not.toHaveBeenCalled();
      });

      it('should exit (with error) after having cleaned up (if necessary)', done => {
        cleanUper.hasTasks.and.returnValues(false, true);
        let fn = uiUtils.exitWithErrorFnGen();

        // No clean-up
        fn();

        expect(process.exit).toHaveBeenCalledWith(1);
        process.exit.calls.reset();

        // Clean-up
        uiUtils.offerToCleanUp.and.callFake(() => {
          expect(process.exit).not.toHaveBeenCalled();
          return Promise.resolve();
        });

        fn().
          then(() => expect(process.exit).toHaveBeenCalledWith(1)).
          then(done);
      });

      it('should exit even if cleaning up errors', done => {
        cleanUper.hasTasks.and.returnValue(true);
        uiUtils.offerToCleanUp.and.callFake(() => {
          expect(process.exit).not.toHaveBeenCalled();
          return Promise.reject();
        });

        uiUtils.
          exitWithErrorFnGen()().
          then(() => expect(process.exit).toHaveBeenCalledWith(1)).
          then(done);
      });

      it('should log the error to the console when cleaning up errors', done => {
        cleanUper.hasTasks.and.returnValue(true);
        uiUtils.offerToCleanUp.and.returnValue(Promise.reject('Test'));

        uiUtils.
          exitWithErrorFnGen()().
          then(() => expect(console.error.calls.mostRecent().args[1]).toBe('Test')).
          then(done);
      });
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
        then(done);

      deferred.resolve();
    });

    it('should only display clean-up tasks if the user does not confirm', done => {
      uiUtils.
        offerToCleanUp().
        then(() => expect(uiUtils.phase).not.toHaveBeenCalled()).
        then(() => expect(cleanUper.cleanUp).toHaveBeenCalledWith(true)).
        then(done);

      deferred.reject();
    });
  });

  describe('#phase()', () => {
    let dummyDoWork;

    beforeEach(() => {
      dummyDoWork = () => new Promise(() => {});

      spyOn(console, 'log');
      spyOn(uiUtils, 'exitWithErrorFnGen');
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
        then(done);
    });

    it('should report to the console when the work is done', done => {
      let doWork = () => {
        expect(console.log.calls.mostRecent().args[0]).not.toContain('done');
        return Promise.resolve();
      };

      uiUtils.
        phase({}, doWork).
        then(() => expect(console.log.calls.mostRecent().args[0]).toContain('done')).
        then(done);
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
      uiUtils.exitWithErrorFnGen.and.returnValue(errorCb);

      uiUtils.
        phase(phase, doWork).
        then(() => expect(uiUtils.exitWithErrorFnGen.calls.argsFor(0)[0]).toBe('foo')).
        then(() => expect(errorCb).toHaveBeenCalledWith('bar')).
        then(done);
    });

    it('should fall back to a default error for the error callback', done => {
      let phase = {error: null};
      let doWork = () => Promise.reject('bar');
      let errorCb = jasmine.createSpy('errorCb');
      uiUtils.exitWithErrorFnGen.and.returnValue(errorCb);

      uiUtils.
        phase(phase, doWork).
        then(() => expect(uiUtils.exitWithErrorFnGen.calls.argsFor(0)[0]).toBe('ERROR_unexpected')).
        then(() => expect(errorCb).toHaveBeenCalledWith('bar')).
        then(done);
    });

    it('should support skipping clean-up', () => {
      uiUtils.phase({}, dummyDoWork);
      uiUtils.phase({}, dummyDoWork, false);
      uiUtils.phase({}, dummyDoWork, true);

      expect(uiUtils.exitWithErrorFnGen.calls.argsFor(0)[1]).toBeFalsy();
      expect(uiUtils.exitWithErrorFnGen.calls.argsFor(1)[1]).toBeFalsy();
      expect(uiUtils.exitWithErrorFnGen.calls.argsFor(2)[1]).toBeTruthy();
    });
  });

  // Helpers
  function reversePromise(promise) {
    // "Reverse" the promise; i.e the desired outcome is for this promise to be rejected.
    return promise.then(v => Promise.reject(v), e => Promise.resolve(e));
  }
});
