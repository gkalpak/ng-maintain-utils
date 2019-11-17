'use strict';

// Imports - Local
let CleanUper = require('../../lib/clean-uper');
let Phase = require('../../lib/phase');
let MockLogger = require('../helpers/mock-logger');

// Tests
describe('CleanUper', () => {
  let mockLogger;
  let cleanUper;

  beforeEach(() => {
    mockLogger = new MockLogger();
    cleanUper = new CleanUper(mockLogger);
  });

  describe('#cleanUp()', () => {
    let doCleanUp = () => cleanUper.cleanUp(listOnly);
    let listOnly;

    [false, true].forEach(value => {
      beforeEach(() => {
        listOnly = value;
      });

      describe(`(${value})`, () => {
        it('should always return a promise (even if no tasks are scheduled)', done => {
          let promise1 = doCleanUp();
          expect(promise1).toEqual(jasmine.any(Promise));

          let taskId = cleanUper.registerTask('foo', () => {});
          cleanUper.schedule(taskId);

          let promise2 = doCleanUp();
          expect(promise2).toEqual(jasmine.any(Promise));

          // Returning early may leave a scheduled `console.log()` in the microtask queue,
          // which may throw off the next test's expectations.
          Promise.all([promise1, promise2]).then(done, done.fail);
        });

        it('should return a resolved promise if no tasks are scheduled', done => {
          doCleanUp().then(done, done.fail);
        });

        it('should resolve the returned promise if all tasks complete successfully', done => {
          let taskId1 = cleanUper.registerTask('foo', () => {});
          let taskId2 = cleanUper.registerTask('bar', () => {});
          let taskId3 = cleanUper.registerTask('baz', () => {});
          cleanUper.schedule(taskId1);
          cleanUper.schedule(taskId2);
          cleanUper.schedule(taskId3);

          doCleanUp().then(done, done.fail);
        });

        it('should clean the `_scheduledTasks` queue', done => {
          let taskId1 = cleanUper.registerTask('foo', () => {});
          let taskId2 = cleanUper.registerTask('bar', () => {});
          let taskId3 = cleanUper.registerTask('baz', () => {});

          expect(cleanUper.hasTasks()).toBe(false);

          cleanUper.schedule(taskId1);
          cleanUper.schedule(taskId2);
          cleanUper.schedule(taskId3);

          expect(cleanUper.hasTasks()).toBe(true);

          doCleanUp().
            then(() => expect(cleanUper.hasTasks()).toBe(false)).
            then(done, done.fail);
        });

        it('should log each task\'s description to the console', done => {
          let taskId1 = cleanUper.registerTask('foo', () => {});
          let taskId2 = cleanUper.registerTask('bar', () => {});
          let taskId3 = cleanUper.registerTask('baz', () => {});

          cleanUper.schedule(taskId1);
          cleanUper.schedule(taskId2);
          cleanUper.schedule(taskId3);

          doCleanUp().
            then(() => {
              expect(mockLogger.logs.log.length).toBe(3);
              expect(mockLogger.logs.log[0][0]).toContain('baz');
              expect(mockLogger.logs.log[1][0]).toContain('bar');
              expect(mockLogger.logs.log[2][0]).toContain('foo');
            }).
            then(done, done.fail);
        });
      });
    });

    describe('(false)', () => {
      beforeEach(() => {
        listOnly = false;
      });

      it('should run all tasks consecutively', done => {
        let value = '';
        let taskId1 = cleanUper.registerTask('foo', () => value += 'foo');
        let taskId2 = cleanUper.registerTask('bar', () => value += '|');
        let taskId3 = cleanUper.registerTask('baz', () => value += 'baz');
        let taskId4 = cleanUper.registerTask('qux', () => value += 'qux');

        cleanUper.schedule(taskId1);
        cleanUper.schedule(taskId2);
        cleanUper.schedule(taskId3);
        cleanUper.schedule(taskId4);
        cleanUper.schedule(taskId2);
        cleanUper.schedule(taskId1);

        doCleanUp().
          then(() => expect(value).toBe('foo|quxbaz|foo')).
          then(done, done.fail);
      });

      it('should support returning promises from task callbacks', done => {
        let resolveFns = [null, null, null];
        let promises = resolveFns.map((_, idx) => new Promise(res => resolveFns[idx] = res));
        let callbacks = promises.map((p, idx) => jasmine.createSpy(`cb${idx}`).and.returnValue(p));

        callbacks.forEach((cb, idx) => {
          let taskId = cleanUper.registerTask(`task${idx}`, cb);
          cleanUper.schedule(taskId);
        });

        doCleanUp().then(done, done.fail);

        // eslint-disable-next-line jasmine/no-promise-without-done-fail
        Promise.resolve().
          then(letMicrotaskQueueDrain).
          then(() => {
            expect(callbacks[0]).not.toHaveBeenCalled();
            expect(callbacks[1]).not.toHaveBeenCalled();
            expect(callbacks[2]).toHaveBeenCalled();

            resolveFns[2]();
            return promises[2];
          }).
          then(letMicrotaskQueueDrain).
          then(() => {
            expect(callbacks[0]).not.toHaveBeenCalled();
            expect(callbacks[1]).toHaveBeenCalled();
            expect(callbacks[2]).toHaveBeenCalled();

            resolveFns[1]();
            return promises[1];
          }).
          then(letMicrotaskQueueDrain).
          then(() => {
            expect(callbacks[0]).toHaveBeenCalled();
            expect(callbacks[1]).toHaveBeenCalled();
            expect(callbacks[2]).toHaveBeenCalled();

            resolveFns[0]();
          });

        // Helpers
        function letMicrotaskQueueDrain() {
          return new Promise(resolve => setTimeout(resolve));
        }
      });

      it('should reject the returned promise if any task throws an error', done => {
        let taskId1 = cleanUper.registerTask('foo', () => {});
        let taskId2 = cleanUper.registerTask('bar', () => { throw 'Test'; });
        let taskId3 = cleanUper.registerTask('baz', () => {});
        cleanUper.schedule(taskId1);
        cleanUper.schedule(taskId2);
        cleanUper.schedule(taskId3);

        doCleanUp().catch(err => {
          expect(err).toBe('Test');
          done();
        });
      });

      it('should reject the returned promise if any task returns a rejection', done => {
        let taskId1 = cleanUper.registerTask('foo', () => {});
        let taskId2 = cleanUper.registerTask('bar', () => Promise.reject('Test'));
        let taskId3 = cleanUper.registerTask('baz', () => {});
        cleanUper.schedule(taskId1);
        cleanUper.schedule(taskId2);
        cleanUper.schedule(taskId3);

        doCleanUp().catch(err => {
          expect(err).toBe('Test');
          done();
        });
      });
    });

    describe('(true)', () => {
      beforeEach(() => {
        listOnly = true;
      });

      it('should not call any task callbacks', done => {
        let cb1 = jasmine.createSpy('cb1');
        let cb2 = jasmine.createSpy('cb2');
        let cb3 = jasmine.createSpy('cb3');
        let taskId1 = cleanUper.registerTask('foo', cb1);
        let taskId2 = cleanUper.registerTask('bar', cb2);
        let taskId3 = cleanUper.registerTask('baz', cb3);

        cleanUper.schedule(taskId1);
        cleanUper.schedule(taskId2);
        cleanUper.schedule(taskId3);
        cleanUper.schedule(taskId2);
        cleanUper.schedule(taskId1);

        doCleanUp().
          then(() => {
            expect(cleanUper.hasTasks()).toBe(false);
            expect(cb1).not.toHaveBeenCalled();
            expect(cb2).not.toHaveBeenCalled();
            expect(cb3).not.toHaveBeenCalled();
          }).
          then(done, done.fail);
      });
    });
  });

  describe('#getCleanUpPhase()', () => {
    it('should de a function', () => {
      expect(cleanUper.getCleanUpPhase).toEqual(jasmine.any(Function));
    });

    describe(' - Returned value', () => {
      let cleanUpPhase;

      beforeEach(() => {
        cleanUpPhase = cleanUper.getCleanUpPhase();
      });

      it('should be a `Phase` object', () => {
        expect(cleanUpPhase).toBeDefined();
        expect(cleanUpPhase).toEqual(jasmine.any(Phase));
      });

      it('should have a thought-provoking ID', () => {
        expect(cleanUpPhase.id).toBe('X');
      });

      it('should have an error message', () => {
        expect(cleanUpPhase.error).toBeDefined();
        expect(cleanUpPhase.error).toEqual(jasmine.any(String));
      });
    });
  });

  describe('#hasTasks()', () => {
    it('should return whether or not there are scheduled tasks', () => {
      let taskId1 = cleanUper.registerTask('foo', () => {});
      let taskId2 = cleanUper.registerTask('bar', () => {});

      expect(cleanUper.hasTasks()).toBe(false);

      cleanUper.schedule(taskId1);
      expect(cleanUper.hasTasks()).toBe(true);

      cleanUper.unschedule(taskId1);
      cleanUper.schedule(taskId2);
      expect(cleanUper.hasTasks()).toBe(true);

      cleanUper.unschedule(taskId2);
      expect(cleanUper.hasTasks()).toBe(false);
    });
  });

  describe('#registerTask()', () => {
    it('should make tasks available for scheduling', () => {
      let taskId = cleanUper.registerTask('foo', () => {});

      expect(() => cleanUper.schedule(taskId)).not.toThrow();
    });

    it('should support registering identical tasks', () => {
      let cb = () => {};
      let taskId1 = cleanUper.registerTask('foo', cb);
      let taskId2 = cleanUper.registerTask('foo', cb);

      expect(taskId1).not.toBe(taskId2);
    });
  });

  describe('#schedule()', () => {
    it('should only accept known task IDs', () => {
      let taskId1 = cleanUper.registerTask('foo', () => {});
      let taskId2 = Object.create(null);

      expect(() => cleanUper.schedule(taskId1)).not.toThrow();
      expect(() => cleanUper.schedule(taskId2)).toThrow();
    });

    it('should support scheduling the same task multiple times', () => {
      let taskId = cleanUper.registerTask('foo', () => {});

      expect(cleanUper._scheduledTasks.length).toBe(0);

      cleanUper.schedule(taskId);
      expect(cleanUper._scheduledTasks.length).toBe(1);

      cleanUper.schedule(taskId);
      expect(cleanUper._scheduledTasks.length).toBe(2);
      expect(cleanUper._scheduledTasks[0]).toBe(cleanUper._scheduledTasks[1]);
    });
  });

  describe('#unschedule()', () => {
    it('should only accept known task IDs', () => {
      let taskId1 = cleanUper.registerTask('foo', () => {});
      let taskId2 = Object.create(null);

      expect(() => cleanUper.unschedule(taskId1)).not.toThrow();
      expect(() => cleanUper.unschedule(taskId2)).toThrow();
    });

    it('should only unschedule the last scheduled instance', () => {
      let taskId1 = cleanUper.registerTask('foo', () => {});
      let taskId2 = cleanUper.registerTask('bar', () => {});

      cleanUper.schedule(taskId1);
      cleanUper.schedule(taskId2);
      cleanUper.schedule(taskId1);

      expect(cleanUper._scheduledTasks.length).toBe(3);
      expect(cleanUper._scheduledTasks[0].description).toBe('foo');
      expect(cleanUper._scheduledTasks[1].description).toBe('bar');
      expect(cleanUper._scheduledTasks[2].description).toBe('foo');

      cleanUper.unschedule(taskId1);

      expect(cleanUper._scheduledTasks.length).toBe(2);
      expect(cleanUper._scheduledTasks[0].description).toBe('foo');
      expect(cleanUper._scheduledTasks[1].description).toBe('bar');

      cleanUper.unschedule(taskId1);

      expect(cleanUper._scheduledTasks.length).toBe(1);
      expect(cleanUper._scheduledTasks[0].description).toBe('bar');
    });

    it('should silently do nothing if the task was not scheduled', () => {
      let taskId1 = cleanUper.registerTask('foo', () => {});
      let taskId2 = cleanUper.registerTask('bar', () => {});

      cleanUper.schedule(taskId1);

      expect(cleanUper._scheduledTasks.length).toBe(1);
      expect(cleanUper._scheduledTasks[0].description).toBe('foo');

      cleanUper.unschedule(taskId2);

      expect(cleanUper._scheduledTasks.length).toBe(1);
      expect(cleanUper._scheduledTasks[0].description).toBe('foo');
    });
  });

  describe('#withTask()', () => {
    let taskId;

    beforeEach(() => {
      taskId = cleanUper.registerTask('foo', () => {});
    });

    it('should return a promise', () => {
      let promise = cleanUper.withTask(taskId, () => {});

      expect(promise).toEqual(jasmine.any(Promise));
    });

    it('should resolve the returned promise if `fn` completes successfully', done => {
      cleanUper.
        withTask(taskId, () => 'foo').
        then(value => expect(value).toBe('foo')).
        then(done, done.fail);
    });

    it('should reject the returned promise if `fn` throws an error', done => {
      cleanUper.withTask(taskId, () => { throw 'Test'; }).then(done.fail, err => {
        expect(err).toBe('Test');

        done();
      });
    });

    it('should reject the returned promise if `fn` returns a rejection', done => {
      cleanUper.withTask(taskId, () => Promise.reject('Test')).then(done.fail, err => {
        expect(err).toBe('Test');

        done();
      });
    });

    it('should run the specified `fn` (asynchronously)', done => {
      let fn = jasmine.createSpy('fn');

      cleanUper.
        withTask(taskId, fn).
        then(() => expect(fn).toHaveBeenCalled()).
        then(done, done.fail);

      expect(fn).not.toHaveBeenCalled();
    });

    it('should have the specified task scheduled while running `fn`', done => {
      spyOn(cleanUper, 'schedule').and.callThrough();

      let fn = () => {
        expect(cleanUper.schedule).toHaveBeenCalledWith(taskId);
        expect(cleanUper.hasTasks()).toBe(true);
      };

      expect(cleanUper.schedule).not.toHaveBeenCalled();
      expect(cleanUper.hasTasks()).toBe(false);

      cleanUper.withTask(taskId, fn).then(done, done.fail);
    });

    it('should unschedule the task if `fn` completes successfully', done => {
      cleanUper.
        withTask(taskId, () => {}).
        then(() => expect(cleanUper.hasTasks()).toBe(false)).
        then(done, done.fail);

      expect(cleanUper.hasTasks()).toBe(true);
    });

    it('should leave the task scheduled if `fn` throws an error', done => {
      cleanUper.withTask(taskId, () => { throw 'Test'; }).catch(() => {
        expect(cleanUper.hasTasks()).toBe(true);

        done();
      });
    });

    it('should leave the task scheduled if `fn` returns a rejection', done => {
      cleanUper.withTask(taskId, () => Promise.reject('Test')).catch(() => {
        expect(cleanUper.hasTasks()).toBe(true);

        done();
      });
    });

    it('should wait for the promise returned by `fn`, before unscheduling the task', done => {
      let fn = () => new Promise(resolve => setTimeout(() => {
        expect(cleanUper.hasTasks()).toBe(true);
        resolve();
      }));

      cleanUper.
        withTask(taskId, fn).
        then(() => expect(cleanUper.hasTasks()).toBe(false)).
        then(done, done.fail);
    });
  });
});
