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
    class Cli extends AbstractCli {}

    chalkEnabled = chalk.enabled;
    chalk.enabled = false;

    config = {
      argSpecs: [],
      defaults: {},
      messages: {
        usage: 'mockUsage',
        instructionsHeaderTmpl: 'mockInstructionsHeaderTmpl',
        headerTmpl: 'mockHeaderTmpl',
        errors: {},
        warnings: {}
      },
      versionInfo: {
        name: 'mockName',
        version: 'mockVersion'
      }
    };
    cli = new Cli(config);

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

  describe('#_displayExperimentalTool()', () => {
    it('should not display anything if no warning message is set in config', () => {
      cli._displayExperimentalTool();

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should display the "experimental tool" warning (retrieved from config)', () => {
      config.messages.warnings.WARN_experimentalTool = 'foo';
      cli._displayExperimentalTool();

      expect(console.log.calls.argsFor(0)[0]).toContain('foo');
    });
  });

  describe('#_displayHeader()', () => {
    beforeEach(() => {
      spyOn(cli, '_displayExperimentalTool');
      spyOn(cli, '_displayVersionInfo');
    });

    it('should call `_displayVersionInfo()` first', () => {
      console.log.and.callFake(() => expect(cli._displayVersionInfo).toHaveBeenCalled());

      cli._displayHeader('', {});

      expect(console.log).toHaveBeenCalled();
    });

    it('should call `_displayExperimentalTool()` second', () => {
      console.log.and.callFake(() => expect(cli._displayExperimentalTool).toHaveBeenCalled());
      cli._displayExperimentalTool.and.callFake(() => {
        expect(cli._displayVersionInfo).toHaveBeenCalled();
      });

      cli._displayHeader('', {});

      expect(console.log).toHaveBeenCalled();
    });

    it('should display the header (after interpolating the provided template with input)', () => {
      let input = {foo: 'baz', bar: 'qux'};

      cli._displayHeader('foo & bar', input);
      cli._displayHeader('{{ foo }} & {{ bar }}', input);

      expect(console.log.calls.argsFor(0)[0]).toContain('foo & bar');
      expect(console.log.calls.argsFor(1)[0]).toContain('baz & qux');
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
    beforeEach(() => {
      spyOn(cli, '_displayExperimentalTool');
      spyOn(cli, '_displayVersionInfo');
    });

    it('should call `_displayVersionInfo()` first', () => {
      console.log.and.callFake(() => expect(cli._displayVersionInfo).toHaveBeenCalled());

      cli._displayUsage('');

      expect(console.log).toHaveBeenCalled();
    });

    it('should call `_displayExperimentalTool()` second', () => {
      console.log.and.callFake(() => expect(cli._displayExperimentalTool).toHaveBeenCalled());
      cli._displayExperimentalTool.and.callFake(() => {
        expect(cli._displayVersionInfo).toHaveBeenCalled();
      });

      cli._displayUsage('');

      expect(console.log).toHaveBeenCalled();
    });

    it('should display the usage instructions', () => {
      let message = 'foo\nbar\nbaz\nqux';

      cli._displayUsage(message);

      expect(console.log.calls.argsFor(0)[0]).toContain(message);
    });

    it('should format the first line differently', () => {
      let message = 'foo\nbar\nbaz\nqux';

      chalk.enabled = true;
      cli._displayUsage(message);

      let logged = console.log.calls.mostRecent().args[0];

      expect(logged).not.toContain(message);
      expect(logged).toContain(`${chalk.bold('foo')}\n${chalk.gray('bar\nbaz\nqux')}`);
    });
  });

  describe('#_displayVersionInfo()', () => {
    it('should display the version info (retrieved from config)', () => {
      config.versionInfo = {name: 'foo', version: '1.2.3'};
      cli._displayVersionInfo();

      expect(console.log.calls.argsFor(0)[0]).toContain('foo');
      expect(console.log.calls.argsFor(0)[0]).toContain('1.2.3');
    });
  });

  describe('#_getAndValidateInput()', () => {
    it('should return a promise', () => {
      let promise = cli._getAndValidateInput([], []);

      expect(promise).toEqual(jasmine.any(Promise));
    });

    it('should parse the raw arguments using `_utils.parseArgs()`', done => {
      spyOn(cli._utils, 'parseArgs').and.callThrough();

      let rawArgs = [];

      cli.
        _getAndValidateInput(rawArgs, []).
        then(() => expect(cli._utils.parseArgs).toHaveBeenCalledWith(rawArgs)).
        then(done);
    });

    it('should read the `version` argument', done => {
      let promises = [
        cli._getAndValidateInput(['foo', 'bar'], []),
        cli._getAndValidateInput(['foo', '--no-version', 'bar'], []),
        cli._getAndValidateInput(['foo', '--version', 'bar'], [])
      ];

      Promise.
        all(promises).
        then(inputs => {
          expect(inputs[0].version).toBe(false);
          expect(inputs[1].version).toBe(false);
          expect(inputs[2].version).toBe(true);
        }).
        then(done);
    });

    it('should read the `usage` argument', done => {
      let promises = [
        cli._getAndValidateInput(['foo', 'bar'], []),
        cli._getAndValidateInput(['foo', '--no-usage', 'bar'], []),
        cli._getAndValidateInput(['foo', '--usage', 'bar'], [])
      ];

      Promise.
        all(promises).
        then(inputs => {
          expect(inputs[0].usage).toBe(false);
          expect(inputs[1].usage).toBe(false);
          expect(inputs[2].usage).toBe(true);
        }).
        then(done);
    });

    it('should read the `instructions` argument', done => {
      let promises = [
        cli._getAndValidateInput(['foo', 'bar'], []),
        cli._getAndValidateInput(['foo', '--no-instructions', 'bar'], []),
        cli._getAndValidateInput(['foo', '--instructions', 'bar'], [])
      ];

      Promise.
        all(promises).
        then(inputs => {
          expect(inputs[0].instructions).toBe(false);
          expect(inputs[1].instructions).toBe(false);
          expect(inputs[2].instructions).toBe(true);
        }).
        then(done);
    });

    it('should apply `argSpecs`', done => {
      let rawArgs = ['foo', 'bar', '--baz=qux'];
      let argSpecs = [
        new ArgSpec.Unnamed(0, 'foo', () => true, ''),
        new ArgSpec.Unnamed(1, 'bar', () => true, ''),
        new ArgSpec('baz', () => true, ''),
        new ArgSpec('qux', () => true, '', 'default')
      ];

      cli.
        _getAndValidateInput(rawArgs, argSpecs).
        then(input => {
          expect(input).toEqual(jasmine.objectContaining({
            foo: 'foo',
            bar: 'bar',
            baz: 'qux',
            qux: 'default'
          }));
        }).
        then(done);
    });

    it('should not apply `argSpecs` if `--version` is detected', done => {
      spyOn(ArgSpec.prototype, 'applyOn').and.callThrough();

      let rawArgs = ['foo', 'bar', '--baz=qux', '--version'];
      let argSpecs = [
        new ArgSpec.Unnamed(0, 'foo', () => true, ''),
        new ArgSpec.Unnamed(1, 'bar', () => true, ''),
        new ArgSpec('baz', () => true, ''),
        new ArgSpec('qux', () => true, '', 'default')
      ];

      cli.
        _getAndValidateInput(rawArgs, argSpecs).
        then(input => {
          expect(ArgSpec.prototype.applyOn).not.toHaveBeenCalled();
          expect(input).not.toEqual(jasmine.objectContaining({
            foo: 'foo',
            bar: 'bar',
            baz: 'qux',
            qux: 'default'
          }));
        }).
        then(done);
    });

    it('should not apply `argSpecs` if `--usage` is detected', done => {
      spyOn(ArgSpec.prototype, 'applyOn').and.callThrough();

      let rawArgs = ['foo', 'bar', '--baz=qux', '--usage'];
      let argSpecs = [
        new ArgSpec.Unnamed(0, 'foo', () => true, ''),
        new ArgSpec.Unnamed(1, 'bar', () => true, ''),
        new ArgSpec('baz', () => true, ''),
        new ArgSpec('qux', () => true, '', 'default')
      ];

      cli.
        _getAndValidateInput(rawArgs, argSpecs).
        then(input => {
          expect(ArgSpec.prototype.applyOn).not.toHaveBeenCalled();
          expect(input).not.toEqual(jasmine.objectContaining({
            foo: 'foo',
            bar: 'bar',
            baz: 'qux',
            qux: 'default'
          }));
        }).
        then(done);
    });

    it('should apply `argSpecs` if `--instructions` is detected', done => {
      let rawArgs = ['foo', 'bar', '--baz=qux', '--instructions'];
      let argSpecs = [
        new ArgSpec.Unnamed(0, 'foo', () => true, ''),
        new ArgSpec.Unnamed(1, 'bar', () => true, ''),
        new ArgSpec('baz', () => true, ''),
        new ArgSpec('qux', () => true, '', 'default')
      ];

      cli.
        _getAndValidateInput(rawArgs, argSpecs).
        then(input => {
          expect(input).toEqual(jasmine.objectContaining({
            foo: 'foo',
            bar: 'bar',
            baz: 'qux',
            qux: 'default'
          }));
        }).
        then(done);
    });

    it('should reject the returned promise if any `ArgSpec` is not satisfied', done => {
      let errorCb = jasmine.createSpy('errorCb').and.returnValue(Promise.reject('foo'));
      spyOn(cli._uiUtils, 'reportAndRejectFnGen').and.returnValue(errorCb);

      let rawArgs = ['--foo=bar'];
      let argSpecs = [new ArgSpec('foo', () => false, 'error')];

      cli.
        _getAndValidateInput(rawArgs, argSpecs).
        catch(error => {
          expect(error).toBe('foo');

          expect(cli._uiUtils.reportAndRejectFnGen).toHaveBeenCalledWith('error');
          expect(errorCb).toHaveBeenCalledWith();

          done();
        });
    });
  });

  describe('#_insertEmptyLine()', () => {
    it('should just insert an empty line', () => {
      cli._insertEmptyLine(),

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith();
    });
  });

  describe('#_theHappyEnd()', () => {
    it('should display "OPERATION COMPLETED SUCCESSFULLY"', () => {
      cli._theHappyEnd();
      cli._theHappyEnd(null);
      cli._theHappyEnd(false);
      cli._theHappyEnd(true);
      cli._theHappyEnd('foo');

      expect(console.log).toHaveBeenCalledTimes(5);
      expect(console.log.calls.argsFor(0)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
      expect(console.log.calls.argsFor(1)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
      expect(console.log.calls.argsFor(2)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
      expect(console.log.calls.argsFor(3)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
      expect(console.log.calls.argsFor(4)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
    });

    it('should forward the passed-in value', () => {
      let value = {};

      expect(cli._theHappyEnd(value)).toBe(value);
    });
  });

  describe('#_theUnhappyEnd()', () => {
    let errorCb;

    beforeEach(() => {
      errorCb = jasmine.createSpy('errorCb').and.returnValue(Promise.reject());

      spyOn(cli._uiUtils, 'reportAndRejectFnGen').and.returnValue(errorCb);
    });

    it('should not "reportAndReject" if the rejection is empty (just reject)', done => {
      cli.
        _theUnhappyEnd().
        catch(() => {
          expect(errorCb).not.toHaveBeenCalled();

          done();
        });
    });

    it('should "reportAndReject" if the rejection is non-empty', done => {
      cli.
        _theUnhappyEnd('foo').
        catch(() => {
          expect(cli._uiUtils.reportAndRejectFnGen).toHaveBeenCalledWith('ERROR_unexpected');
          expect(errorCb).toHaveBeenCalledWith('foo');

          done();
        });
    });

    it('should reject with the value returned by "reportAndReject"', done => {
      errorCb.and.returnValue(Promise.reject('foo'));

      cli.
        _theUnhappyEnd(true).
        catch(error => {
          expect(error).toBe('foo');

          done();
        });
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
      doWorkSpy = jasmine.createSpy('doWork').and.returnValue(Promise.resolve());
      input = {};

      spyOn(cli, '_getAndValidateInput').and.returnValue(input);
    });

    it('should return a promise', () => {
      let promise = cli.run([], doWorkSpy);

      expect(promise).toEqual(jasmine.any(Promise));
    });

    it('should read and validate the input', done => {
      let args = [];

      cli.
        run(args, doWorkSpy).
        then(() => expect(cli._getAndValidateInput).toHaveBeenCalledWith(args, config.argSpecs)).
        then(done);
    });

    it('should display the version info (and "return") if `--version` is detected', done => {
      spyOn(cli, '_displayVersionInfo');

      input.version = true;

      cli.
        run([], doWorkSpy).
        then(() => {
          expect(cli._displayVersionInfo).toHaveBeenCalledWith();
          expect(doWorkSpy).not.toHaveBeenCalled();
        }).
        then(done);
    });

    it('should display the usage instructions (and "return") if `--usage` is detected', done => {
      spyOn(cli, '_displayUsage');

      input.usage = true;

      cli.
        run([], doWorkSpy).
        then(() => {
          expect(cli._displayUsage).toHaveBeenCalledWith('mockUsage');
          expect(doWorkSpy).not.toHaveBeenCalled();
        }).
        then(done);
    });

    it('should display the instructions (and "return") if `--instructions` is detected', done => {
      spyOn(cli, '_displayHeader');
      spyOn(cli, '_displayInstructions').and.callFake(() => {
        expect(cli._displayHeader).toHaveBeenCalledWith('mockInstructionsHeaderTmpl', input);
      });
      spyOn(cli, 'getPhases').and.returnValue([]);

      input.instructions = true;

      cli.
        run([], doWorkSpy).
        then(() => {
          expect(cli._displayInstructions).toHaveBeenCalledWith([], input);
          expect(doWorkSpy).not.toHaveBeenCalled();
        }).
        then(done);
    });

    it('should display the header', done => {
      spyOn(cli, '_displayHeader');

      cli.
        run([], doWorkSpy).
        then(() => expect(cli._displayHeader).toHaveBeenCalledWith('mockHeaderTmpl', input)).
        then(done);
    });

    it('should do some work (based on the input)', done => {
      cli.
        run([], doWorkSpy).
        then(() => expect(doWorkSpy).toHaveBeenCalledWith(input)).
        then(done);
    });

    it('should resolve the returned promise with the value returned by `doWork()`', done => {
      doWorkSpy.and.returnValue('Test');

      cli.
        run([], doWorkSpy).
        then(value => expect(value).toBe('Test')).
        then(done);
    });

    it('should reject the returned promise with undefined', done => {
      spyOn(console, 'error');
      doWorkSpy.and.returnValue(Promise.reject('Test'));

      cli.
        run([], doWorkSpy).
        catch(error => {
          expect(error).toBeUndefined();
          done();
        });
    });

    ['Test', Promise.resolve('Test')].forEach(returnValue => {
      it('should call `_theHappyEnd()` once the work is done', done => {
        spyOn(cli, '_theHappyEnd');
        spyOn(cli, '_theUnhappyEnd');
        doWorkSpy.and.returnValue(returnValue);

        cli.
          run([], doWorkSpy).
          then(() => expect(cli._theHappyEnd).toHaveBeenCalledWith('Test')).
          then(() => expect(cli._theUnhappyEnd).not.toHaveBeenCalled()).
          then(done);
      });
    });

    it('should call `_theUnhappyEnd()` on error (with the error returned by `doWork()`)', done => {
      spyOn(cli, '_theHappyEnd');
      spyOn(cli, '_theUnhappyEnd').and.returnValue(Promise.reject());
      doWorkSpy.and.returnValue(Promise.reject('Test'));

      cli.
        run([], doWorkSpy).
        catch(() => {
          expect(cli._theUnhappyEnd).toHaveBeenCalledWith('Test');
          expect(cli._theHappyEnd).not.toHaveBeenCalledWith();

          done();
        });
    });

    it('should call `_insertEmptyLine()` at the end (no matter what)', done => {
      spyOn(console, 'error');
      spyOn(cli, '_insertEmptyLine');
      spyOn(cli, '_theUnhappyEnd').and.callFake(err => Promise.reject(err));
      spyOn(cli, 'getPhases').and.returnValue([]);
      cli._getAndValidateInput.and.returnValues(
        Promise.reject({id: 1}),
        Promise.resolve({id: 2, version: true}),
        Promise.resolve({id: 3, usage: true}),
        Promise.resolve({id: 4, instructions: true}),
        Promise.resolve({id: 5}),
        Promise.resolve({id: 6}));
      doWorkSpy.and.returnValues(Promise.resolve({id: 5}), Promise.reject({id: 6}));

      let promises = [
        // Invalid input
        cli.run([], doWorkSpy).then(() => Promise.reject(), () => Promise.resolve()),

        // --version
        cli.run([], doWorkSpy),

        // --usage
        cli.run([], doWorkSpy),

        // --instructions
        cli.run([], doWorkSpy),

        // `doWork()` resolves
        cli.run([], doWorkSpy),

        // `doWork()` rejects
        cli.run([], doWorkSpy).then(() => Promise.reject(), () => Promise.resolve())
      ];

      Promise.
        all(promises).
        then(() => expect(cli._insertEmptyLine).toHaveBeenCalledTimes(6)).
        then(done);
    });
  });
});
