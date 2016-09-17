'use strict';

// Imports
let chalk = require('chalk');

// Imports - Local
let AbstractCli = require('../../lib/abstract-cli');
let ArgSpec = require('../../lib/arg-spec');
let CleanUper = require('../../lib/clean-uper');
let Phase = require('../../lib/phase');
let UiUtils = require('../../lib/ui-utils');
let Utils = require('../../lib/utils');

// Tests
describe('AbstractCli', () => {
  let chalkEnabled;
  let config;
  let cli;

  beforeEach(() => {
    class Cli extends AbstractCli {
      constructor() {
        super(config);
      }
    }

    chalkEnabled = chalk.enabled;
    chalk.enabled = false;

    config = {
      argSpecs: [],
      messages: {
        usage: 'mockUsage',
        instructionsHeaderTmpl: 'mockInstructionsHeaderTmpl',
        headerTmpl: 'mockHeaderTmpl',
        errors: {}
      }
    };
    cli = new Cli();

    spyOn(console, 'log');
  });

  afterEach(() => {
    chalk.enabled = chalkEnabled;
  });

  describe('#constructor()', () => {
    it('should not allow direct instantiation', () => {
      expect(() => new AbstractCli(config)).toThrowError();
    });

    it('should assign the specified config to a property', () => {
      expect(cli._config).toBe(config);
    });

    it('should create a `CleanUper` instance', () => {
      expect(cli._cleanUper).toEqual(jasmine.any(CleanUper));
    });

    it('should create a `Utils` instance', () => {
      expect(cli._utils).toEqual(jasmine.any(Utils));
    });

    it('should create a `UiUtils` instance', () => {
      expect(cli._uiUtils).toEqual(jasmine.any(UiUtils));
    });
  });

  describe('#_displayHeader()', () => {
    it('should display the header (after interpolating the provided template with input)', () => {
      let input = {foo: 'baz', bar: 'qux'};

      cli._displayHeader('foo & bar', input);
      cli._displayHeader('{{ foo }} & {{ bar }}', input);

      expect(console.log).toHaveBeenCalledWith('foo & bar');
      expect(console.log).toHaveBeenCalledWith('baz & qux');
    });
  });

  describe('#_displayInstructions()', () => {
    it('should display the ID and description of each phase', () => {
      let phases = [
        new Phase('foo', 'bar', ['']),
        new Phase('baz', 'qux', [''])
      ];

      cli._displayInstructions(phases, {});

      expect(console.log.calls.argsFor(0)[0]).toContain('foo');
      expect(console.log.calls.argsFor(0)[0]).toContain('bar');
      expect(console.log.calls.argsFor(2)[0]).toContain('baz');
      expect(console.log.calls.argsFor(2)[0]).toContain('qux');
    });

    it('should not display anything about phases with no instructions', () => {
      let phases = [
        new Phase('', '', []),
        new Phase('', '', [])
      ];

      cli._displayInstructions(phases, {});

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should display the instructions of each phase', () => {
      let phases = [
        new Phase('', '', ['instruction 1', 'instruction 2']),
        new Phase('', '', ['instruction 3', 'instruction 4'])
      ];

      cli._displayInstructions(phases, {});

      expect(console.log.calls.argsFor(1)[0]).toContain('instruction 1');
      expect(console.log.calls.argsFor(2)[0]).toContain('instruction 2');
      expect(console.log.calls.argsFor(4)[0]).toContain('instruction 3');
      expect(console.log.calls.argsFor(5)[0]).toContain('instruction 4');
    });

    it('should interpolate each instruction', () => {
      let phases = [
        new Phase('', '', ['foo: {{bar}}', '{{baz}}: qux'])
      ];

      cli._displayInstructions(phases, {bar: 'bar', baz: 'baz'});

      expect(console.log.calls.argsFor(1)[0]).toContain('foo: bar');
      expect(console.log.calls.argsFor(2)[0]).toContain('baz: qux');
    });

    it('should format `...` specially', () => {
      chalk.enabled = true;

      let phases = [
        new Phase('', '', ['foo `bar` baz `qux`'])
      ];

      cli._displayInstructions(phases, {});

      expect(console.log.calls.argsFor(1)[0]).not.toContain('`');
      expect(console.log.calls.argsFor(1)[0]).toMatch(/\u001b\[\S+bar\u001b\[\S+/);
      expect(console.log.calls.argsFor(1)[0]).toMatch(/\u001b\[\S+qux\u001b\[\S+/);
    });
  });

  describe('#_displayUsage()', () => {
    it('should display the usage instructions', () => {
      let message = 'foo\nbar\nbaz\nqux';

      cli._displayUsage(message);

      expect(console.log).toHaveBeenCalledWith(message);
    });

    it('should format the first line differently', () => {
      let message = 'foo\nbar\nbaz\nqux';

      chalk.enabled = true;
      cli._displayUsage(message);

      let lines = message.split('\n');
      let logged = console.log.calls.mostRecent().args[0];

      expect(logged).not.toContain(message);
      expect(logged).toContain(lines[0]);
      expect(logged).toContain(lines.slice(1).join('\n'));
    });
  });

  describe('#_getAndValidateInput()', () => {
    it('should parse the raw arguments using `_utils.parseArgs()`', () => {
      spyOn(cli._utils, 'parseArgs').and.callThrough();

      let rawArgs = [];
      cli._getAndValidateInput(rawArgs, []);

      expect(cli._utils.parseArgs).toHaveBeenCalledWith(rawArgs);
    });

    it('should read the `usage` argument', () => {
      let args;
      let input;

      args = ['foo', 'bar'];
      input = cli._getAndValidateInput(args, []);

      expect(input.usage).toBe(false);

      args = ['foo', '--no-usage', 'bar'];
      input = cli._getAndValidateInput(args, []);

      expect(input.usage).toBe(false);

      args = ['foo', '--usage', 'bar'];
      input = cli._getAndValidateInput(args, []);

      expect(input.usage).toBe(true);
    });

    it('should read the `instructions` argument', () => {
      let args;
      let input;

      args = ['foo', 'bar'];
      input = cli._getAndValidateInput(args, []);

      expect(input.instructions).toBe(false);

      args = ['foo', '--no-instructions', 'bar'];
      input = cli._getAndValidateInput(args, []);

      expect(input.instructions).toBe(false);

      args = ['foo', '--instructions', 'bar'];
      input = cli._getAndValidateInput(args, []);

      expect(input.instructions).toBe(true);
    });

    it('should apply `argSpecs`', () => {
      let args = ['foo', 'bar', '--baz=qux'];
      let argSpecs = [
        new ArgSpec.Unnamed(0, 'foo', () => true, ''),
        new ArgSpec.Unnamed(1, 'bar', () => true, ''),
        new ArgSpec('baz', () => true, ''),
        new ArgSpec('qux', () => true, '', 'default')
      ];

      let input = cli._getAndValidateInput(args, argSpecs);

      expect(input).toEqual(jasmine.objectContaining({
        foo: 'foo',
        bar: 'bar',
        baz: 'qux',
        qux: 'default'
      }));
    });

    it('should not apply `argSpecs` if `--usage` is detected', () => {
      spyOn(ArgSpec.prototype, 'applyOn').and.callThrough();

      let args = ['foo', 'bar', '--baz=qux', '--usage'];
      let argSpecs = [
        new ArgSpec.Unnamed(0, 'foo', () => true, ''),
        new ArgSpec.Unnamed(1, 'bar', () => true, ''),
        new ArgSpec('baz', () => true, ''),
        new ArgSpec('qux', () => true, '', 'default')
      ];

      let input = cli._getAndValidateInput(args, argSpecs);

      expect(ArgSpec.prototype.applyOn).not.toHaveBeenCalled();
      expect(input).not.toEqual(jasmine.objectContaining({
        foo: 'foo',
        bar: 'bar',
        baz: 'qux',
        qux: 'default'
      }));
    });

    it('should error if no PR is specified', () => {
      let errorCb = jasmine.createSpy('errorCb');
      spyOn(cli._uiUtils, 'exitWithErrorFnGen').and.returnValue(errorCb);

      let args = ['--foo=bar'];

      cli._getAndValidateInput(args, [new ArgSpec('foo', () => true, '')]);

      expect(cli._uiUtils.exitWithErrorFnGen).not.toHaveBeenCalled();
      expect(errorCb).not.toHaveBeenCalled();

      cli._getAndValidateInput(args, [new ArgSpec('foo', () => false, 'error')]);

      expect(cli._uiUtils.exitWithErrorFnGen).toHaveBeenCalledWith('error', true);
      expect(errorCb).toHaveBeenCalled();
    });
  });

  describe('#_theEnd()', () => {
    it('should display "OPERATION COMPLETED SUCCESSFULLY"', () => {
      cli._theEnd();
      cli._theEnd(null);
      cli._theEnd(false);
      cli._theEnd(true);
      cli._theEnd('foo');

      expect(console.log).toHaveBeenCalledTimes(5);
      expect(console.log.calls.argsFor(0)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
      expect(console.log.calls.argsFor(1)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
      expect(console.log.calls.argsFor(2)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
      expect(console.log.calls.argsFor(3)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
      expect(console.log.calls.argsFor(4)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
    });

    it('should forward the passed-in value', () => {
      let value = {};

      expect(cli._theEnd(value)).toBe(value);
    });
  });

  describe('#getPhases()', () => {
    it('should throw an error (unless overwritten)', () => {
      expect(() => cli.getPhases()).toThrowError(/abstract method .*`getPhases\(\)`/);

      cli.constructor.prototype.getPhases = () => {};
      expect(() => cli.getPhases()).not.toThrow();
    });
  });

  describe('#run()', () => {
    let doWorkSpy;
    let input;

    beforeEach(() => {
      doWorkSpy = jasmine.createSpy('doWork');
      doWorkSpy.and.returnValue(new Promise(() => {}));

      input = {};

      spyOn(process, 'exit');
      spyOn(cli, '_getAndValidateInput').and.returnValue(input);
    });

    it('should read and validate the input', () => {
      let args = [];
      cli.run(args, doWorkSpy);

      expect(cli._getAndValidateInput).toHaveBeenCalledWith(args, config.argSpecs);
    });

    it('should display the usage instructions (and exit) if `--usage` is detected', () => {
      spyOn(cli, '_displayUsage').and.callFake(() => {
        expect(process.exit).not.toHaveBeenCalled();
      });
      doWorkSpy.and.callFake(() => {
        // `process.exit` is being stubbed (so the process isn't really terminated),
        // but it should have been called before calling `doWork()`.
        expect(process.exit).toHaveBeenCalledWith(0);

        return new Promise(() => {});
      });

      input.usage = true;
      cli.run([], doWorkSpy);

      expect(cli._displayUsage).toHaveBeenCalled();
      expect(doWorkSpy).toHaveBeenCalled();
    });

    it('should display the instructions (and exit) if `--instructions` is detected', () => {
      spyOn(cli, '_displayHeader');
      spyOn(cli, '_displayInstructions').and.callFake(() => {
        expect(cli._displayHeader).toHaveBeenCalledWith('mockInstructionsHeaderTmpl', input);
        expect(process.exit).not.toHaveBeenCalled();
      });
      spyOn(cli, 'getPhases').and.returnValue([]);
      doWorkSpy.and.callFake(() => {
        // `process.exit` is being stubbed (so the process isn't really terminated),
        // but it should have been called before calling `doWork()`.
        expect(process.exit).toHaveBeenCalledWith(0);

        return new Promise(() => {});
      });

      input.instructions = true;
      cli.run([], doWorkSpy);

      expect(cli._displayInstructions).toHaveBeenCalledWith([], input);
      expect(doWorkSpy).toHaveBeenCalled();
    });

    it('should display the header', () => {
      spyOn(cli, '_displayHeader');

      cli.run([], doWorkSpy);

      expect(cli._displayHeader).toHaveBeenCalledWith('mockHeaderTmpl', input);
    });

    it('should do some work (based on the input)', () => {
      cli.run([], doWorkSpy);

      expect(doWorkSpy).toHaveBeenCalledWith(input);
    });

    it('should return a promise', () => {
      let promise = cli.run([], doWorkSpy);

      expect(promise).toEqual(jasmine.any(Promise));
    });

    it('should resolve the returned promise with the value returned by `doWork()`', done => {
      doWorkSpy.and.returnValue('Test');

      cli.
        run([], doWorkSpy).
        then(value => expect(value).toBe('Test')).
        then(done);
    });

    it('should call `_theEnd()` once the work is done (synchronously)', done => {
      spyOn(cli, '_theEnd');
      doWorkSpy.and.returnValue('Test');

      cli.
        run([], doWorkSpy).
        then(() => expect(cli._theEnd).toHaveBeenCalledWith('Test')).
        then(done);
    });

    it('should call `_theEnd()` once the work is done (asynchronously)', done => {
      spyOn(cli, '_theEnd');
      doWorkSpy.and.returnValue(Promise.resolve('Test'));

      cli.
        run([], doWorkSpy).
        then(() => expect(cli._theEnd).toHaveBeenCalledWith('Test')).
        then(done);
    });

    it('should attach an error callback to the returned promise', done => {
      let errorCode = 'ERROR_unexpected';
      let errorCb = jasmine.createSpy('errorCb');

      spyOn(cli._uiUtils, 'exitWithErrorFnGen').and.returnValue(errorCb);
      spyOn(cli, '_theEnd');
      doWorkSpy.and.returnValue(Promise.reject('Test'));

      cli.
        run([], doWorkSpy).
        then(() => expect(cli._theEnd).not.toHaveBeenCalled()).
        then(() => expect(cli._uiUtils.exitWithErrorFnGen).toHaveBeenCalledWith(errorCode)).
        then(() => expect(errorCb).toHaveBeenCalledWith('Test')).
        then(done);
    });
  });
});
