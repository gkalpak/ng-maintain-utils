'use strict';

// Imports
let chalk = require('chalk');
let {PassThrough} = require('stream');

// Imports - Local
let CleanUper = require('../../lib/clean-uper');
let Phase = require('../../lib/phase');
let UiUtils = require('../../lib/ui-utils');
let MockLogger = require('../helpers/mock-logger');
let {reversePromise} = require('../helpers/utils');

// Tests
describe('UiUtils', () => {
  let chalkLevel;
  let mockLogger;
  let uiUtils;

  beforeEach(() => {
    mockLogger = new MockLogger();
    let cleanUper = new CleanUper(mockLogger);
    let errorMessages = {'test': 'TestError'};

    uiUtils = new UiUtils(mockLogger, cleanUper, errorMessages);

    chalkLevel = chalk.level;
    chalk.level = 0;
  });

  afterEach(() => {
    chalk.level = chalkLevel;
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
      reversePromise(uiUtils.askYesOrNoQuestion('Are you sure?')).
        then(done, done.fail);

      process.stdin.emit('data', '\n');
    });

    it('should reject the returned promise for "no" (default: yes)', done => {
      reversePromise(uiUtils.askYesOrNoQuestion('Any doubts?', true)).
        then(done, done.fail);

      process.stdin.emit('data', 'n\n');
    });
  });

  describe('#phase()', () => {
    let phase;

    beforeEach(() => {
      phase = new Phase('TEST_PHASE', 'Good for testing', null, 'test');
    });

    it('should do some work in the context of a phase', done => {
      let doWork = () => Promise.resolve('foo');

      uiUtils.
        phase(phase, doWork).
        then(value => {
          expect(value).toBe('foo');

          expect(mockLogger.logs.log[0][0]).toContain('PHASE TEST_PHASE - Good for testing');
          expect(mockLogger.logs.log[1][0]).toContain('done');

          expect(mockLogger.logs.error).toEqual([]);
        }).
        then(done, done.fail);
    });

    it('should handle errors', done => {
      let doWork = () => Promise.reject('bar');

      uiUtils.
        phase(phase, doWork).
        catch(() => {
          expect(mockLogger.logs.log.length).toBe(1);
          expect(mockLogger.logs.log[0][0]).toContain('PHASE TEST_PHASE - Good for testing');

          let errorLogs = mockLogger.logs.error;
          expect(errorLogs[0]).toEqual(jasmine.arrayContaining(['bar']));
          expect(errorLogs[1][0]).toContain('TestError');
          expect(errorLogs[1][0]).toContain('Clean-up might or might not be needed.');
          expect(errorLogs[1][0]).toContain('OPERATION ABORTED');

          done();
        });
    });

    describe('- Clean-up', () => {
      let doWork;
      let cleanUp;

      beforeEach(() => {
        spyOnProperty(process, 'stdin').and.returnValue(new PassThrough());
        spyOnProperty(process, 'stdout').and.returnValue(new PassThrough());

        doWork = () => Promise.reject();
        cleanUp = jasmine.createSpy('cleanUp');

        let cleanUpTaskId = uiUtils._cleanUper.registerTask('Do some clean-up', cleanUp);

        uiUtils._cleanUper.schedule(cleanUpTaskId);
        uiUtils._cleanUper.schedule(cleanUpTaskId);
      });

      it('should be done if available and confirmed', done => {
        reversePromise(uiUtils.phase(phase, doWork)).
          then(() => {
            let logLogs = mockLogger.logs.log;
            let errorLogs = mockLogger.logs.error;

            expect(logLogs[0][0]).toContain('PHASE TEST_PHASE - Good for testing');

            expect(errorLogs[0][0]).toContain('TestError');
            expect(errorLogs[0][0]).toContain('Clean-up might or might not be needed.');
            expect(errorLogs[0][0]).toContain('OPERATION ABORTED');

            expect(logLogs[1][0]).toContain('PHASE X - Trying to clean up the mess');
            expect(logLogs[2][0]).toContain('Clean-up task: Do some clean-up');
            expect(logLogs[3][0]).toContain('Clean-up task: Do some clean-up');
            expect(logLogs[4][0]).toContain('done');

            expect(cleanUp).toHaveBeenCalledTimes(2);
            expect(uiUtils._cleanUper.hasTasks()).toBe(false);
          }).
          then(done, done.fail);

        setTimeout(() => process.stdin.emit('data', 'y\n'));
      });

      it('should be skipped (but list tasks) if not confirmed', done => {
        reversePromise(uiUtils.phase(phase, doWork)).
          then(() => {
            let logLogs = mockLogger.logs.log;
            let errorLogs = mockLogger.logs.error;

            expect(logLogs[0][0]).toContain('PHASE TEST_PHASE - Good for testing');

            expect(errorLogs[0][0]).toContain('TestError');
            expect(errorLogs[0][0]).toContain('Clean-up might or might not be needed.');
            expect(errorLogs[0][0]).toContain('OPERATION ABORTED');

            expect(logLogs[1][0]).toContain('OK, I\'m not doing anything');
            expect(logLogs[1][0]).toContain('the pending tasks (afaik) are');
            expect(logLogs[2][0]).toContain('Clean-up task: Do some clean-up');
            expect(logLogs[3][0]).toContain('Clean-up task: Do some clean-up');

            expect(cleanUp).not.toHaveBeenCalled();
            expect(uiUtils._cleanUper.hasTasks()).toBe(false);
          }).
          then(done, done.fail);

        setTimeout(() => process.stdin.emit('data', '\n'));
      });

      it('should be skipped altogether if `skipCleanUp: true`', done => {
        reversePromise(uiUtils.phase(phase, doWork, true)).
          then(() => {
            let logLogs = mockLogger.logs.log;
            let errorLogs = mockLogger.logs.error;

            expect(logLogs[0][0]).toContain('PHASE TEST_PHASE - Good for testing');

            expect(errorLogs[0][0]).toContain('TestError');
            expect(errorLogs[0][0]).toContain('Clean-up might or might not be needed.');
            expect(errorLogs[0][0]).toContain('OPERATION ABORTED');

            expect(logLogs.length).toBe(1);

            expect(cleanUp).not.toHaveBeenCalled();
            expect(uiUtils._cleanUper.hasTasks()).toBe(true);
          }).
          then(done, done.fail);
      });
    });
  });
});
