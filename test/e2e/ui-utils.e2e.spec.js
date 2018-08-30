'use strict';

// Imports
let chalk = require('chalk');

// Imports - Local
let CleanUper = require('../../lib/clean-uper');
let Phase = require('../../lib/phase');
let UiUtils = require('../../lib/ui-utils');

// Tests
describe('UiUtils', () => {
  let chalkEnabled;
  let uiUtils;

  beforeEach(() => {
    let cleanUper = new CleanUper();
    let errorMessages = {'test': 'TestError'};

    uiUtils = new UiUtils(cleanUper, errorMessages);

    chalkEnabled = chalk.enabled;
    chalk.enabled = false;
  });

  afterEach(() => {
    chalk.enabled = chalkEnabled;
  });

  describe('#askQuestion()', () => {
    beforeEach(() => {
      spyOn(process.stdout, 'write');
    });

    it('should display the question', done => {
      uiUtils.
        askQuestion('Why?').
        then(() => expect(process.stdout.write).toHaveBeenCalledWith('Why?')).
        then(done, done.fail);

      process.stdin.emit('data', '\n');
    });

    it('should wait for and return the answer', done => {
      uiUtils.
        askQuestion('Why?').
        then(answer => expect(answer).toBe('Because')).
        then(done, done.fail);

      process.stdin.emit('data', 'Because\n');
    });
  });

  describe('#askYesOrNoQuestion()', () => {
    beforeEach(() => {
      spyOn(process.stdout, 'write');
    });

    it('should display the question and answer options (default: no)', done => {
      uiUtils.
        askYesOrNoQuestion('Are you sure?').
        then(() => expect(process.stdout.write).toHaveBeenCalledWith('\nAre you sure? [y/N]: ')).
        then(done, done.fail);

      process.stdin.emit('data', 'y\n');
    });

    it('should display the question and answer options (default: yes)', done => {
      uiUtils.
        askYesOrNoQuestion('Any doubts?', true).
        then(() => expect(process.stdout.write).toHaveBeenCalledWith('\nAny doubts? [Y/n]: ')).
        then(done, done.fail);

      process.stdin.emit('data', '\n');
    });

    it('should reject the returned promise for "no" (default: no)', done => {
      uiUtils.
        askYesOrNoQuestion('Are you sure?').
        catch(done);

      process.stdin.emit('data', '\n');
    });

    it('should reject the returned promise for "no" (default: yes)', done => {
      uiUtils.
        askYesOrNoQuestion('Any doubts?').
        catch(done);

      process.stdin.emit('data', 'n\n');
    });
  });

  describe('#phase()', () => {
    let phase;

    beforeEach(() => {
      phase = new Phase('TEST_PHASE', 'Good for testing', null, 'test');

      spyOn(console, 'error');
      spyOn(console, 'log');
    });

    it('should do some work in the context of a phase', done => {
      let doWork = () => Promise.resolve('foo');

      uiUtils.
        phase(phase, doWork).
        then(value => {
          expect(value).toBe('foo');

          expect(console.log.calls.argsFor(0)[0]).toContain('PHASE TEST_PHASE - Good for testing');
          expect(console.log.calls.argsFor(1)[0]).toContain('done');

          expect(console.error).not.toHaveBeenCalled();
        }).
        then(done, done.fail);
    });

    it('should handle errors', done => {
      let doWork = () => Promise.reject('bar');

      uiUtils.
        phase(phase, doWork).
        catch(() => {
          expect(console.log).toHaveBeenCalledTimes(1);
          expect(console.log.calls.argsFor(0)[0]).toContain('PHASE TEST_PHASE - Good for testing');

          let errCalls = console.error.calls;
          expect(errCalls.argsFor(0)).toEqual(jasmine.arrayContaining(['bar']));
          expect(errCalls.argsFor(1)[0]).toContain('TestError');
          expect(errCalls.argsFor(1)[0]).toContain('Clean-up might or might not be needed.');
          expect(errCalls.argsFor(1)[0]).toContain('OPERATION ABORTED');

          done();
        });
    });

    describe('- Clean-up', () => {
      let doWork;
      let cleanUp;

      beforeEach(() => {
        spyOn(process.stdout, 'write');

        doWork = () => Promise.reject();
        cleanUp = jasmine.createSpy('cleanUp');

        let cleanUpTaskId = uiUtils._cleanUper.registerTask('Do some clean-up', cleanUp);

        uiUtils._cleanUper.schedule(cleanUpTaskId);
        uiUtils._cleanUper.schedule(cleanUpTaskId);
      });

      it('should be done if available and confirmed', done => {
        uiUtils.
          phase(phase, doWork).
          catch(() => {
            let logCalls = console.log.calls;
            let errCalls = console.error.calls;

            expect(logCalls.argsFor(0)[0]).toContain('PHASE TEST_PHASE - Good for testing');

            expect(errCalls.argsFor(0)[0]).toContain('TestError');
            expect(errCalls.argsFor(0)[0]).toContain('Clean-up might or might not be needed.');
            expect(errCalls.argsFor(0)[0]).toContain('OPERATION ABORTED');

            expect(logCalls.argsFor(1)[0]).toContain('PHASE X - Trying to clean up the mess');
            expect(logCalls.argsFor(2)[0]).toContain('Clean-up task: Do some clean-up');
            expect(logCalls.argsFor(3)[0]).toContain('Clean-up task: Do some clean-up');
            expect(logCalls.argsFor(4)[0]).toContain('done');

            expect(cleanUp).toHaveBeenCalledTimes(2);
            expect(uiUtils._cleanUper.hasTasks()).toBe(false);

            done();
          });

        setTimeout(() => process.stdin.emit('data', 'y\n'));
      });

      it('should be skipped (but list tasks) if not confirmed', done => {
        uiUtils.
          phase(phase, doWork).
          catch(() => {
            let logCalls = console.log.calls;
            let errCalls = console.error.calls;

            expect(logCalls.argsFor(0)[0]).toContain('PHASE TEST_PHASE - Good for testing');

            expect(errCalls.argsFor(0)[0]).toContain('TestError');
            expect(errCalls.argsFor(0)[0]).toContain('Clean-up might or might not be needed.');
            expect(errCalls.argsFor(0)[0]).toContain('OPERATION ABORTED');

            expect(logCalls.argsFor(1)[0]).toContain('OK, I\'m not doing anything');
            expect(logCalls.argsFor(1)[0]).toContain('the pending tasks (afaik) are');
            expect(logCalls.argsFor(2)[0]).toContain('Clean-up task: Do some clean-up');
            expect(logCalls.argsFor(3)[0]).toContain('Clean-up task: Do some clean-up');
            expect(cleanUp).not.toHaveBeenCalled();
            expect(uiUtils._cleanUper.hasTasks()).toBe(false);

            done();
          });

        setTimeout(() => process.stdin.emit('data', '\n'));
      });

      it('should be skipped altogether if `skipCleanUp: true`', done => {
        uiUtils.
          phase(phase, doWork, true).
          catch(() => {
            let logCalls = console.log.calls;
            let errCalls = console.error.calls;

            expect(logCalls.argsFor(0)[0]).toContain('PHASE TEST_PHASE - Good for testing');

            expect(errCalls.argsFor(0)[0]).toContain('TestError');
            expect(errCalls.argsFor(0)[0]).toContain('Clean-up might or might not be needed.');
            expect(errCalls.argsFor(0)[0]).toContain('OPERATION ABORTED');

            expect(console.log).toHaveBeenCalledTimes(1);
            expect(cleanUp).not.toHaveBeenCalled();
            expect(uiUtils._cleanUper.hasTasks()).toBe(true);

            done();
          });
      });
    });
  });
});
