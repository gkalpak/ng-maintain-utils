'use strict';

// Imports
let fs = require('fs');
let https = require('https');
let stream = require('stream');

let PassThrough = stream.PassThrough;

// Imports - Local
let CleanUper = require('../../lib/clean-uper');
let GitUtils = require('../../lib/git-utils');
let Utils = require('../../lib/utils');

// Tests
describe('GitUtils', () => {
  let cleanUper;
  let utils;
  let deferred;

  beforeEach(() => {
    cleanUper = new CleanUper();
    utils = new Utils();

    deferred = {};
    ['execAsPromised', 'spawnAsPromised'].forEach(methodName => {
      let cb = () => new Promise((resolve, reject) => deferred = {resolve, reject});
      spyOn(utils, methodName).and.callFake(cb);
    });
  });

  describe('GitUtils#DiffHighlighter', () => {
    it('should be a function', () => {
      expect(GitUtils.DiffHighlighter).toEqual(jasmine.any(Function));
    });
  });

  describe('#constructor()', () => {
    it('should register an `abortAm` clean-up task', () => {
      spyOn(cleanUper, 'registerTask');
      createGitUtils();

      expect(cleanUper.registerTask).toHaveBeenCalled();
      expect(cleanUper.registerTask.calls.argsFor(0)[0]).toContain('git am');
    });
  });

  describe('#abortAm()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('abortAm');
    });

    it('should call `git am --abort`', () => {
      expectToCall('abortAm', 'git am --abort');
    });
  });

  describe('#abortRebase()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('abortRebase');
    });

    it('should call `git rebase --abort`', () => {
      expectToCall('abortRebase', 'git rebase --abort');
    });
  });

  describe('#checkout()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('checkout', ['foo']);
    });

    it('should call `git checkout <branch>`', () => {
      expectToCall('checkout', ['foo'], 'git checkout foo');
    });
  });

  describe('#countCommitsSince()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('countCommitsSince', ['foo']);
    });

    it('should call `git rev-list --count <commit>..HEAD`', () => {
      expectToCall('countCommitsSince', ['foo'], 'git rev-list --count foo..HEAD');
    });

    it('should convert the resolved value to a number', done => {
      createGitUtils().
        countCommitsSince('foo').
        then(count => expect(count).toBe(42)).
        then(done);

      deferred.resolve(' 42\n ');
    });
  });

  describe('#createBranch()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('createBranch', ['foo']);
    });

    it('should call `git checkout -b <branch>`', () => {
      expectToCall('createBranch', ['foo'], 'git checkout -b foo');
    });
  });

  describe('#deleteBranch()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('deleteBranch', ['foo']);
    });

    it('should call `git branch --delete/-D <branch>`', () => {
      expectToCall('deleteBranch', ['foo'], 'git branch --delete foo');
      expectToCall('deleteBranch', ['foo', false], 'git branch --delete foo');
      expectToCall('deleteBranch', ['foo', true], 'git branch -D foo');
    });
  });

  describe('#diff()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('diff', ['foo']);
    });

    it('should call `git diff --[no-]color <commit>`', () => {
      expectToCall('diff', ['foo'], 'git diff --color foo');
      expectToCall('diff', ['foo', false], 'git diff --color foo');
      expectToCall('diff', ['foo', true], 'git diff --no-color foo');
    });
  });

  describe('#diffWithHighlight()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('diffWithHighlight', ['foo']);
    });

    it('should call `git diff --no-color <commit>` and `less -FRX` (with a I/O streams)', () => {
      let ptStream = jasmine.any(PassThrough);

      createGitUtils().diffWithHighlight('foo');

      expect(utils.spawnAsPromised).toHaveBeenCalledTimes(2);
      expect(utils.spawnAsPromised).toHaveBeenCalledWith('git diff --no-color foo', null, ptStream);
      expect(utils.spawnAsPromised).toHaveBeenCalledWith('less -FRX', ptStream);
    });

    it('should pipe the output of `git diff ...` to the input of `less ...`', done => {
      createGitUtils().diffWithHighlight('foo');

      let outputStream = utils.spawnAsPromised.calls.argsFor(0)[2];
      let inputStream = utils.spawnAsPromised.calls.argsFor(1)[1];

      inputStream.on('data', data => {
        expect(String(data).trim()).toBe('foo');
        done();
      });

      outputStream.write('foo\n');
    });

    it('should resolve when both commands are completed', done => {
      utils.spawnAsPromised.and.returnValues(Promise.resolve(), Promise.resolve());

      createGitUtils().
        diffWithHighlight('foo').
        then(done);
    });

    it('should reject when any command errors', done => {
      utils.spawnAsPromised.and.returnValues(Promise.reject(), Promise.resolve(),
                                             Promise.resolve(), Promise.reject());

      let gitUtils = createGitUtils();

      gitUtils.diffWithHighlight('foo').
        catch(() => gitUtils.diffWithHighlight('bar')).
        catch(done);
    });
  });

  describe('#getCommitMessage()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('getCommitMessage', ['foo']);
    });

    it('should call `git show --no-patch --format=%B <commit>`', () => {
      expectToCall('getCommitMessage', ['foo'], 'git show --no-patch --format=%B foo');
    });

    it('should convert the resolved value to string', done => {
      createGitUtils().
        getCommitMessage('foo').
        then(message => expect(message).toBe('bar')).
        then(done);

      deferred.resolve({toString: () => 'bar'});
    });
  });

  describe('#getLastCommitMessage()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('getLastCommitMessage');
    });

    it('should call `git show --no-patch --format=%B HEAD`', () => {
      expectToCall('getLastCommitMessage', 'git show --no-patch --format=%B HEAD');
    });

    it('should convert the resolved value to string', done => {
      createGitUtils().
        getLastCommitMessage().
        then(message => expect(message).toBe('bar')).
        then(done);

      deferred.resolve({toString: () => 'bar'});
    });
  });

  describe('#log()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('log');
    });

    it('should call `git log --[no-]decorate [--oneline] [-<count>]`', () => {
      expectToCall('log', [], 'git log --decorate');
      expectToCall('log', [null, null, null], 'git log --decorate');
      expectToCall('log', [false, false, false], 'git log --decorate');

      expectToCall('log', [true], 'git log --decorate --oneline');
      expectToCall('log', [true, null], 'git log --decorate --oneline');
      expectToCall('log', [true, false], 'git log --decorate --oneline');
      expectToCall('log', [true, null, null], 'git log --decorate --oneline');
      expectToCall('log', [true, null, false], 'git log --decorate --oneline');
      expectToCall('log', [true, 0], 'git log --decorate --oneline');
      expectToCall('log', [true, 0, true], 'git log --no-decorate --oneline');

      expectToCall('log', [null, 42], 'git log --decorate -42');
      expectToCall('log', [false, 42], 'git log --decorate -42');
      expectToCall('log', [null, 42, null], 'git log --decorate -42');
      expectToCall('log', [null, 42, false], 'git log --decorate -42');
      expectToCall('log', [null, 42, true], 'git log --no-decorate -42');

      expectToCall('log', [true, 42], 'git log --decorate --oneline -42');
      expectToCall('log', [true, 42, null], 'git log --decorate --oneline -42');
      expectToCall('log', [true, null, true], 'git log --no-decorate --oneline');
      expectToCall('log', [true, 42, true], 'git log --no-decorate --oneline -42');
    });

    it('should ignore rejections', done => {
      createGitUtils().
        log().
        then(done);

      deferred.reject();
    });
  });

  describe('#mergePullRequest()', () => {
    let gitUtils;
    let request;
    let response;

    beforeEach(() => {
      gitUtils = createGitUtils();
      request = new PassThrough();
      response = new PassThrough();

      spyOn(https, 'get').and.callFake((_, cb) => {
        request.on('end', () => cb(response));
        return request;
      });
    });

    it('should return a promise', () => {
      expectToReturnPromise('mergePullRequest', ['foo']);
    });

    it('should request the specified URL', () => {
      gitUtils.mergePullRequest('foo');

      expect(https.get).toHaveBeenCalledWith('foo', jasmine.any(Function));
    });

    it('should reject the returned promise on request error', done => {
      gitUtils.
        mergePullRequest('foo').
        catch(err => {
          expect(err).toBe('Test');
          done();
        });

      request.emit('error', 'Test');
    });

    it('should call `git am -3` with the response as input stream', done => {
      gitUtils.mergePullRequest('foo');
      request.emit('end');

      setTimeout(() => {
        expect(utils.spawnAsPromised).toHaveBeenCalledWith('git am -3', response);

        done();
      });
    });

    it('should wrap the command call in a clean-up task', done => {
      spyOn(cleanUper, 'withTask').and.callFake((taskId, cb) => {
        expect(taskId).toBe(gitUtils._cleanUpTasks.abortAm);
        expect(cb).toEqual(jasmine.any(Function));
        expect(utils.spawnAsPromised).not.toHaveBeenCalled();

        cb();

        expect(utils.spawnAsPromised).toHaveBeenCalled();

        return Promise.resolve();
      });

      gitUtils.mergePullRequest('foo');
      request.emit('end');

      setTimeout(() => {
        expect(cleanUper.withTask).toHaveBeenCalled();

        done();
      });
    });

    it('should resolve the returned promise on success', done => {
      utils.spawnAsPromised.and.returnValue(Promise.resolve('Test'));

      gitUtils.
        mergePullRequest('foo').
        then(value => expect(value).toBe('Test')).
        then(done);

      request.emit('end');
    });

    it('should reject the returned promise on error', done => {
      utils.spawnAsPromised.and.returnValue(Promise.reject('Test'));

      gitUtils.
        mergePullRequest('foo').
        catch(err => {
          expect(err).toBe('Test');
          done();
        });

      request.emit('end');
    });
  });

  describe('#pull()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('pull', ['foo']);
    });

    it('should call `git pull [--rebase] origin <branch>`', () => {
      expectToCall('pull', ['foo'], 'git pull origin foo');
      expectToCall('pull', ['foo', false], 'git pull origin foo');
      expectToCall('pull', ['foo', true], 'git pull --rebase origin foo');
    });
  });

  describe('#push()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('push', ['foo']);
    });

    it('should call `git push origin <branch>`', () => {
      expectToCall('push', ['foo'], 'git push origin foo');
    });
  });

  describe('#rebase()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('rebase', ['foo']);
    });

    it('should call `git rebase [--interactive] <commit>`', () => {
      expectToCall('rebase', ['foo'], 'git rebase foo');
      expectToCall('rebase', ['foo', false], 'git rebase foo');
      expectToCall('rebase', ['foo', true], 'git rebase --interactive foo');
    });

    it('should use `HEAD~<commit>` if `commit` is a number', () => {
      expectToCall('rebase', [42], 'git rebase HEAD~42');
      expectToCall('rebase', [42, false], 'git rebase HEAD~42');
      expectToCall('rebase', [42, true], 'git rebase --interactive HEAD~42');
    });
  });

  describe('#reset()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('reset', ['foo']);
    });

    it('should call `git reset [--hard] <commit>`', () => {
      expectToCall('reset', ['foo'], 'git reset foo');
      expectToCall('reset', ['foo', false], 'git reset foo');
      expectToCall('reset', ['foo', true], 'git reset --hard foo');
    });
  });

  describe('#setLastCommitMessage()', () => {
    let gitUtils;

    beforeEach(() => {
      gitUtils = createGitUtils();

      spyOn(gitUtils, 'unlinkAsPromised').and.returnValue(Promise.resolve());
      spyOn(gitUtils, 'writeFileAsPromised').and.returnValue(Promise.resolve());
    });

    it('should write the message to a temporary file', done => {
      gitUtils.
        setLastCommitMessage('foo').
        then(() => expect(gitUtils.writeFileAsPromised).
            toHaveBeenCalledWith(jasmine.any(String), 'foo')).
        then(done);

      setTimeout(() => deferred.resolve());
    });

    it('should call `git commit --amend --file=<temp-file>`', done => {
      gitUtils.
        setLastCommitMessage('foo').
        then(() => gitUtils.writeFileAsPromised.calls.argsFor(0)[0]).
        then(tempFile => `git commit --amend --file=${tempFile}`).
        then(cmd => expect(utils.spawnAsPromised).toHaveBeenCalledWith(cmd)).
        then(done);

      setTimeout(() => deferred.resolve());
    });

    it('should remove the temporary file on success', done => {
      gitUtils.
        setLastCommitMessage('foo').
        then(() => gitUtils.writeFileAsPromised.calls.argsFor(0)[0]).
        then(tempFile => expect(gitUtils.unlinkAsPromised).toHaveBeenCalledWith(tempFile)).
        then(done);

      setTimeout(() => deferred.resolve());
    });

    it('should remove the temporary file on error', done => {
      gitUtils.
        setLastCommitMessage('foo').
        then(() => gitUtils.writeFileAsPromised.calls.argsFor(0)[0]).
        then(tempFile => expect(gitUtils.unlinkAsPromised).toHaveBeenCalledWith(tempFile)).
        catch(done);

      setTimeout(() => deferred.reject());
    });

    it('should return a promise', done => {
      let promise = gitUtils.setLastCommitMessage('foo').then(done);
      setTimeout(() => deferred.resolve());

      expect(promise).toEqual(jasmine.any(Promise));
    });

    describe('- Returned promise', () => {
      it('should be rejected if unable to create the temporary file', done => {
        gitUtils.writeFileAsPromised.and.returnValue(Promise.reject('test'));

        gitUtils.
          setLastCommitMessage('foo').
          catch(err => {
            expect(err).toBe('test');
            done();
          });
      });

      it('should be rejected if the spawned process errors', done => {
        gitUtils.
          setLastCommitMessage('foo').
          catch(err => {
            expect(err).toBe('test');
            done();
          });

        setTimeout(() => deferred.reject('test'));
      });

      it('should be rejected if unable to remove the temoprary file', done => {
        // Avoid `UnhandledPromiseRejectionWarning`, `PromiseRejectionHandledWarning`,
        // because of handling the rejection asynchronously (in Node.js v6.6.0).
        let rejection = Promise.reject('test');
        rejection.catch(() => {});
        gitUtils.unlinkAsPromised.and.returnValue(rejection);

        gitUtils.
          setLastCommitMessage('foo').
          catch(err => {
            expect(err).toBe('test');
            expect(gitUtils.unlinkAsPromised).toHaveBeenCalled();
            done();
          });

        setTimeout(() => deferred.resolve());
      });

      it('should be rejected with the original error even if unable to remove the temporary file',
        done => {
          // Avoid `UnhandledPromiseRejectionWarning`, `PromiseRejectionHandledWarning`,
          // because of handling the rejection asynchronously (in Node.js v6.6.0).
          let rejection = Promise.reject('test');
          rejection.catch(() => {});
          gitUtils.unlinkAsPromised.and.returnValue(rejection);

          gitUtils.
            setLastCommitMessage('foo').
            catch(err => {
              expect(err).toBe('test2');
              expect(gitUtils.unlinkAsPromised).toHaveBeenCalled();
              done();
            });

          setTimeout(() => deferred.reject('test2'));
        }
      );
    });
  });

  describe('#unlinkAsPromised()', () => {
    let unlinkAsPromised;

    beforeEach(() => {
      unlinkAsPromised = createGitUtils().unlinkAsPromised;
    });

    it('should be a function', () => {
      expect(unlinkAsPromised).toEqual(jasmine.any(Function));
    });

    it('should be an `Utils#asPromised()` wrapper around `fs.unlink()`', () => {
      // It is too late to spy on `fs.unlink()`
      expect(unlinkAsPromised.fn).toBe(fs.unlink);
      expect(unlinkAsPromised.context).toBe(fs);
    });
  });

  describe('#updateLastCommitMessage()', () => {
    let gitUtils;

    beforeEach(() => {
      gitUtils = createGitUtils();

      spyOn(gitUtils, 'getLastCommitMessage').and.returnValue(Promise.resolve('foo'));
      spyOn(gitUtils, 'setLastCommitMessage');
    });

    it('should return a promise', () => {
      expectToReturnPromise('updateLastCommitMessage', [() => {}]);
    });

    it('should retrieve the old commit message', done => {
      let getNewMessage = () => {};

      gitUtils.
        updateLastCommitMessage(getNewMessage).
        then(() => expect(gitUtils.getLastCommitMessage).toHaveBeenCalled()).
        then(done);
    });

    it('should pass the old commit message to `getNewMessage()`', done => {
      let getNewMessage = jasmine.createSpy('getNewMessage');

      gitUtils.
        updateLastCommitMessage(getNewMessage).
        then(() => expect(getNewMessage).toHaveBeenCalledWith('foo')).
        then(done);
    });

    it('should update the commit message to the value returned by `getNewMessage()`', done => {
      let getNewMessage = () => 'bar';

      gitUtils.
        updateLastCommitMessage(getNewMessage).
        then(() => expect(gitUtils.setLastCommitMessage).toHaveBeenCalledWith('bar')).
        then(done);
    });
  });

  describe('#writeFileAsPromised()', () => {
    let writeFileAsPromised;

    beforeEach(() => {
      writeFileAsPromised = createGitUtils().writeFileAsPromised;
    });

    it('should be a function', () => {
      expect(writeFileAsPromised).toEqual(jasmine.any(Function));
    });

    it('should be an `Utils#asPromised()` wrapper around `fs.writeFile()`', () => {
      // It is too late to spy on `fs.writeFile()`
      expect(writeFileAsPromised.fn).toBe(fs.writeFile);
      expect(writeFileAsPromised.context).toBe(fs);
    });
  });

  // Helpers
  function createGitUtils() {
    return new GitUtils(cleanUper, utils);
  }

  function expectToCall(methodName, args, command) {
    if (command === undefined) {
      command = args;
      args = [];
    }

    let gitUtils = createGitUtils();
    gitUtils[methodName].apply(gitUtils, args);

    let spy = utils.execAsPromised.calls.count() ?
        utils.execAsPromised :
        utils.spawnAsPromised;

    expect(spy).toHaveBeenCalledWith(command);
  }

  function expectToReturnPromise(methodName, args) {
    let gitUtils = createGitUtils();
    let promise = gitUtils[methodName].apply(gitUtils, args);

    expect(promise).toEqual(jasmine.any(Promise));
  }
});
