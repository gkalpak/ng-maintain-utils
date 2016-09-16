'use strict';

// Imports
let childProcess = require('child_process');

// Imports - Local
let Utils = require('../../lib/utils');

// Tests
describe('Utils', () => {
  let utils;

  beforeEach(() => {
    utils = new Utils();
  });

  describe('#asPromised()', () => {
    let fn;
    let context;
    let fnAsPromised;

    beforeEach(() => {
      fn = jasmine.createSpy('fn');
      context = {};
      fnAsPromised = utils.asPromised(fn, context);
    });

    it('should return a function', () => {
      expect(fnAsPromised).toEqual(jasmine.any(Function));
    });

    it('should attach the original function and context on the returned function', () => {
      expect(fnAsPromised.fn).toBe(fn);
      expect(fnAsPromised.context).toBe(context);
    });

    describe('- Returned function', () => {
      it('should return a promise', () => {
        expect(fnAsPromised()).toEqual(jasmine.any(Promise));
      });

      it('should call the original function', () => {
        expect(fn).not.toHaveBeenCalled();

        fnAsPromised();

        expect(fn).toHaveBeenCalled();
      });

      it('should bind the context (if specified)', () => {
        let ctx;

        fnAsPromised();
        ctx = fn.calls.mostRecent().object;

        expect(ctx).toBe(context);

        // Jasmine spies seem to be called in the context of `global`,
        // when no context is explicitly specified.
        utils.asPromised(function () { ctx = this; })();

        expect(ctx).toBeUndefined();
      });

      it('should pass any arguments through', () => {
        fnAsPromised('foo', 'bar');
        let args = fn.calls.mostRecent().args;

        expect(args[0]).toBe('foo');
        expect(args[1]).toBe('bar');
      });

      it('should append a callback to the arguments', () => {
        fnAsPromised('foo', 'bar');
        let args = fn.calls.mostRecent().args;

        expect(args[2]).toEqual(jasmine.any(Function));
      });

      it('should reject the returned promise with the error passed to the callback', done => {
        fn.and.callFake(cb => cb('Test'));

        fnAsPromised().catch(err => {
          expect(err).toBe('Test');
          done();
        });
      });

      it('should resolve the returned promise with the output passed to the callback', done => {
        fn.and.callFake(cb => cb(null, 'Test'));

        fnAsPromised().
          then(out => expect(out).toBe('Test')).
          then(done);
      });
    });
  });

  describe('#execAsPromised()', () => {
    it('should be a function', () => {
      expect(utils.execAsPromised).toEqual(jasmine.any(Function));
    });

    it('should be an `asPromised()` wrapper around `child_process.exec()`', () => {
      // It is too late to spy on `child_process.exec()`
      expect(utils.execAsPromised.fn).toBe(childProcess.exec);
      expect(utils.execAsPromised.context).toBe(childProcess);
    });
  });

  describe('#interpolate()', () => {
    let data;

    beforeEach(() => {
      data = {
        foo: 'bar',
        baz: 'qux',
        '': 'empty',
        '  ': 'spaces',
        ' foo ': 'bar with spaces',
        'f u n': 'fun',
        'f}u}n': 'fun'
      };
    });

    it('should replace `{{...}}`', () => {
      let input = '{{foo}}';
      let expected = 'bar';

      expect(utils.interpolate(input, data)).toBe(expected);
    });

    it('should replace all instances', () => {
      let input = ' {{foo}} {{baz}} {{foo}} ';
      let expected = ' bar qux bar ';

      expect(utils.interpolate(input, data)).toBe(expected);
    });

    it('should trim keys', () => {
      let input = '{{ foo }} {{   foo   }} {{ \t \r \n foo \n \r \t }}';
      let expected = 'bar bar bar';

      expect(utils.interpolate(input, data)).toBe(expected);
    });

    it('should accept zero-length keys (just because)', () => {
      let input = '{{}} {{  }} {{\t\r\n}}';
      let expected = 'empty empty empty';

      expect(utils.interpolate(input, data)).toBe(expected);
    });

    it('should not allow whitespace in the key', () => {
      let input = '{{f u n}}';
      let expected = '{{f u n}}';

      expect(utils.interpolate(input, data)).toBe(expected);
    });

    it('should allow `}` in the key', () => {
      let input = '{{f}u}n}}';
      let expected = 'fun';

      expect(utils.interpolate(input, data)).toBe(expected);
    });

    it('should eagerly match `}}`', () => {
      let input = '{{foo}}baz}}';
      let expected = 'barbaz}}';

      expect(utils.interpolate(input, data)).toBe(expected);
    });

    it('should replace unknown keys with "undefined"', () => {
      let input = '{{unknown}}';
      let expected = 'undefined';

      expect(utils.interpolate(input, data)).toBe(expected);
    });
  });

  describe('#parseArgs()', () => {
    it('should parse the arguments (and treat all `--xyz` ones as boolean)', () => {
      let input = [];
      let output = {_: []};

      expect(utils.parseArgs(input)).toEqual(output);

      input = ['foo', '--bar', '--baz=qux'];
      output = {_: ['foo'], bar: true, baz: 'qux'};

      expect(utils.parseArgs(input)).toEqual(output);

      input = ['foo', 'bar', '--baz', 'qux', '--foo=bar', 'baz', '--qux'];
      output = {_: ['foo', 'bar', 'qux', 'baz'], baz: true, foo: 'bar', qux: true};

      expect(utils.parseArgs(input)).toEqual(output);
    });

    it('should remove surrounding double-quotes', () => {
      let input = ['--foo="bar"', '"baz"', '"qux"'];
      let output = {_: ['baz', 'qux'], foo: 'bar'};

      expect(utils.parseArgs(input)).toEqual(output);
    });

    it('should remove surrounding single-quotes', () => {
      let input = ['--foo=\'bar\'', '\'baz\'', '\'qux\''];
      let output = {_: ['baz', 'qux'], foo: 'bar'};

      expect(utils.parseArgs(input)).toEqual(output);
    });

    it('should not remove non-matching quotes', () => {
      let input = ['"foo bar\'', '\'baz qux"', '--foo="bar\'', '--baz=\'qux"'];
      let output = {_: ['"foo bar\'', '\'baz qux"'], foo: '"bar\'', baz: '\'qux"'};

      expect(utils.parseArgs(input)).toEqual(output);
    });

    it('should not remove inner quotes', () => {
      let input = ['foo "bar"', '\'baz\' qux', '--foo=b"a"r', '--baz=q\'u\'x'];
      let output = {_: ['foo "bar"', '\'baz\' qux'], foo: 'b"a"r', baz: 'q\'u\'x'};

      expect(utils.parseArgs(input)).toEqual(output);
    });

    it('should remove the outer-most pair of quotes only', () => {
      let input = ['"\'foo bar\'"', '\'"baz qux"\'', '--foo="\'bar\'"', '--baz=\'"qux"\''];
      let output = {_: ['\'foo bar\'', '"baz qux"'], foo: '\'bar\'', baz: '"qux"'};

      expect(utils.parseArgs(input)).toEqual(output);
    });
  });

  describe('#spawnAsPromised()', () => {
    let ChildProcess = childProcess.ChildProcess;
    let spawned;

    beforeEach(() => {
      spawned = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => createMockProcess());

      let spy = spyOn(childProcess, 'spawn');
      spy.and.returnValues.apply(spy.and, spawned);
    });

    it('should spawn a process for the specified command', () => {
      utils.spawnAsPromised('foo bar');

      expect(childProcess.spawn).toHaveBeenCalledWith('foo', ['bar'], jasmine.any(Object));
    });

    it('should parse the specified command (respecting double-quoted values)', () => {
      let anyObj = jasmine.any(Object);
      let parsedArgs;

      utils.spawnAsPromised('foo     "bar" --baz --qux="foo bar" "baz qux"');
      parsedArgs = ['bar', '--baz', '--qux="foo bar"', 'baz qux'];

      expect(childProcess.spawn).toHaveBeenCalledWith('foo', parsedArgs, anyObj);

      utils.spawnAsPromised('"foo"     "bar" --baz --qux="foo bar" "baz qux"');
      parsedArgs = ['bar', '--baz', '--qux="foo bar"', 'baz qux'];

      expect(childProcess.spawn).toHaveBeenCalledWith('foo', parsedArgs, anyObj);
    });

    it('should support command "piping" (and spawn a process for each command)', () => {
      let anyObj = jasmine.any(Object);

      utils.spawnAsPromised('foo bar | bar "baz" | "baz" qux');

      expect(childProcess.spawn).toHaveBeenCalledTimes(3);

      expect(childProcess.spawn.calls.argsFor(0)).toEqual(['foo', ['bar'], anyObj]);
      expect(childProcess.spawn.calls.argsFor(1)).toEqual(['bar', ['baz'], anyObj]);
      expect(childProcess.spawn.calls.argsFor(2)).toEqual(['baz', ['qux'], anyObj]);

      expect(spawned[0].stdout.pipe.calls.argsFor(0)[0]).toBe(spawned[1].stdin);
      expect(spawned[1].stdout.pipe.calls.argsFor(0)[0]).toBe(spawned[2].stdin);
    });

    it('should use appropriate values for `stdio`', () => {
      let expectedOptions;

      utils.spawnAsPromised('foo bar');
      expectedOptions = {stdio: ['inherit', 'inherit', 'inherit']};

      expect(childProcess.spawn.calls.argsFor(0)[2]).toEqual(expectedOptions);
      childProcess.spawn.calls.reset();

      utils.spawnAsPromised('foo bar | bar "baz" | "baz" qux');
      expectedOptions = [
        {stdio: ['inherit', 'pipe', 'inherit']},
        {stdio: ['pipe', 'pipe', 'inherit']},
        {stdio: ['pipe', 'inherit', 'inherit']}
      ];

      expect(childProcess.spawn.calls.argsFor(0)[2]).toEqual(expectedOptions[0]);
      expect(childProcess.spawn.calls.argsFor(1)[2]).toEqual(expectedOptions[1]);
      expect(childProcess.spawn.calls.argsFor(2)[2]).toEqual(expectedOptions[2]);
    });

    it('should support specifying a custom input stream', () => {
      let inputStream = {pipe: jasmine.createSpy('inputStream.pipe')};
      let expectedOptions;

      utils.spawnAsPromised('foo bar', inputStream);
      expectedOptions = {stdio: ['pipe', 'inherit', 'inherit']};

      expect(childProcess.spawn.calls.argsFor(0)[2]).toEqual(expectedOptions);
      expect(inputStream.pipe).toHaveBeenCalledWith(spawned[0].stdin);
      childProcess.spawn.calls.reset();
      inputStream.pipe.calls.reset();

      utils.spawnAsPromised('foo bar | bar "baz" | "baz" qux', inputStream);
      expectedOptions = [
        {stdio: ['pipe', 'pipe', 'inherit']},
        {stdio: ['pipe', 'pipe', 'inherit']},
        {stdio: ['pipe', 'inherit', 'inherit']}
      ];

      expect(childProcess.spawn.calls.argsFor(0)[2]).toEqual(expectedOptions[0]);
      expect(childProcess.spawn.calls.argsFor(1)[2]).toEqual(expectedOptions[1]);
      expect(childProcess.spawn.calls.argsFor(2)[2]).toEqual(expectedOptions[2]);
      expect(inputStream.pipe).toHaveBeenCalledTimes(1);
      expect(inputStream.pipe.calls.argsFor(0)[0]).toBe(spawned[1].stdin);
      expect(spawned[1].stdout.pipe.calls.argsFor(0)[0]).toBe(spawned[2].stdin);
      expect(spawned[2].stdout.pipe.calls.argsFor(0)[0]).toBe(spawned[3].stdin);
    });

    it('should return a promise', () => {
      expect(utils.spawnAsPromised('foo')).toEqual(jasmine.any(Promise));
    });

    it('should reject the returned promise if a spawned process errors (single command)', done => {
      utils.spawnAsPromised('foo').
        catch(err => expect(err).toBe('Test')).
        then(done);

      spawned[0].emit('error', 'Test');
    });

    it('should reject the returned promise if a spawned process errors (piped commands)', done => {
      let promises = [];

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[0].emit('error', 'Test0');
      childProcess.spawn.calls.reset();

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[4].emit('error', 'Test1');
      childProcess.spawn.calls.reset();

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[8].emit('error', 'Test2');

      Promise.all(promises).
        then(values => expect(values).toEqual(['Test0', 'Test1', 'Test2'])).
        then(done);
    });

    it('should reject the returned promise if a spawned process exits with error', done => {
      let promises = [];

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[0].emit('exit', 1);
      childProcess.spawn.calls.reset();

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[3].emit('exit', 0);
      spawned[4].emit('exit', null, 33);
      childProcess.spawn.calls.reset();

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[6].emit('exit', 0);
      spawned[8].emit('exit', 7);

      Promise.all(promises).
        then(values => expect(values).toEqual([1, 33, 7])).
        then(done);
    });

    it('should resolve the returned promise when all spawned processes complete (single command)',
      done => {
        let resolved = jasmine.createSpy('resolved');

        utils.spawnAsPromised('foo').then(resolved);
        spawned[0].emit('exit', 0);

        // The promise's success handlers are executed asynchronously
        expect(resolved).not.toHaveBeenCalled();

        setTimeout(() => {
          expect(resolved).toHaveBeenCalled();

          done();
        });
      }
    );

    it('should resolve the returned promise when all spawned processes complete (piped commands)',
      done => {
        let resolved = jasmine.createSpy('resolved');

        utils.spawnAsPromised('foo | bar | baz').then(resolved);
        spawned[0].emit('exit', 0);

        setTimeout(() => {
          expect(resolved).not.toHaveBeenCalled();
          spawned[1].emit('exit', 0);

          setTimeout(() => {
            expect(resolved).not.toHaveBeenCalled();
            spawned[2].emit('exit', 0);

            // The promise's success handlers are executed asynchronously
            expect(resolved).not.toHaveBeenCalled();

            setTimeout(() => {
              expect(resolved).toHaveBeenCalled();

              done();
            });
          });
        });
      }
    );

    // Helpers
    function createMockProcess() {
      let proc = new ChildProcess();

      proc.stdin = {};
      proc.stdout = {pipe: jasmine.createSpy('mockProcess.stdout.pipe')};

      return proc;
    }
  });

  describe('#waitAsPromised()', () => {
    beforeEach(() => {
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should return a promise', () => {
      expect(utils.waitAsPromised()).toEqual(jasmine.any(Promise));
    });

    it('should resolve the returned promise after `period` milliseconds', done => {
      let resolved = jasmine.createSpy('resolved');
      utils.waitAsPromised(500).then(resolved);

      Promise.resolve().
        then(() => expect(resolved).not.toHaveBeenCalled()).
        then(() => jasmine.clock().tick(499)).
        then(() => expect(resolved).not.toHaveBeenCalled()).
        then(() => jasmine.clock().tick(1)).
        then(() => expect(resolved).toHaveBeenCalled()).
        then(done);
    });
  });

  // Helpers
  function reversePromise(promise) {
    // "Reverse" the promise; i.e `resolve` --> `reject`, `reject` --> `resolve`.
    return promise.then(v => Promise.reject(v), e => Promise.resolve(e));
  }
});