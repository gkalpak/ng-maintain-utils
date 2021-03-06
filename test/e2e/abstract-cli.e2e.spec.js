'use strict';

// Imports
let chalk = require('chalk');
let {PassThrough} = require('stream');

// Imports - Local
let AbstractCli = require('../../lib/abstract-cli');
let ArgSpec = require('../../lib/arg-spec');
let Config = require('../../lib/config');
let Logger = require('../../lib/logger');
let Phase = require('../../lib/phase');
let {reversePromise} = require('../helpers/utils');

// Tests
describe('AbstractCli', () => {
  let chalkLevel = chalk.level;
  let config;
  let cli;
  let doWork;
  let errorSpy;
  let logSpy;

  beforeEach(() => {
    let argSpecs = [
      new ArgSpec('foo', v => /^[fo]+$/.test(v), 'error_foo', 'oof'),
      new ArgSpec('bar', v => /rab/.test(v), 'error_bar', 'rab'),
      new ArgSpec.Unnamed(0, 'baz', v => /z.*a.*b/.test(v), 'error_baz', 'zab'),
      new ArgSpec.Unnamed(1, 'qux', () => true, 'error_qux')
    ];

    let messages = {
      usage: 'Just do not press the big, red button and you will be fine',
      instructionsHeaderTmpl: 'Instructions for {{ foo }}, {{ bar }}, {{ baz }} and {{ qux }}',
      headerTmpl: 'Using {{ foo }}, {{ bar }}, {{ baz }} and {{ qux }}',
      errors: {
        error_foo: 'There is a problem with your FOO',
        error_bar: 'There is a problem with your BAR',
        error_baz: 'There is a problem with your BAZ',
        error_qux: 'There is a problem with your QUX'
      }
    };

    let phases = [
      new Phase(
        'One', 'The beginning',
        ['Do this (with {{ foo }})', 'Do that (with {{ bar }})'],
        'Ooops, there was ONE error'),
      new Phase(
        'Two', 'Keep going',
        ['Do not do this', 'I warned you'],
        'Ooops, there were TWO errors'),
      new Phase(
        'Four', 'Who needs 3',
        [],
        'Ooops, there were FOUR errors'),
      new Phase(
        'Five', 'The extra mile',
        ['Do this better (with {{ baz }})', 'Do that better (with {{ qux }})'],
        'Ooops, there were FIVE errors')
    ];

    class MyCli extends AbstractCli {
      _insertEmptyLine(value, isRejection) {
        return isRejection ? Promise.reject(value) : value;
      }

      getPhases() {
        return phases;
      }
    }

    config = new Config(messages, argSpecs);
    cli = new MyCli(config);
    doWork = jasmine.createSpy('doWork');

    chalk.level = 0;

    errorSpy = spyOn(Logger.prototype, 'error');
    logSpy = spyOn(Logger.prototype, 'log');
  });

  afterEach(() => {
    chalk.level = chalkLevel;
  });

  describe('--version', () => {
    it('should display the version info (only)', done => {
      let rawArgs = ['--version'];
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let warningMessage = config.messages.warnings.WARN_experimentalTool;

      cli.
        run(rawArgs, doWork).
        then(() => logSpy.calls.allArgs()).
        then(args => {
          expect(logSpy).toHaveBeenCalledTimes(1);
          expect(args[0][0]).toContain(versionMessage);
          expect(args[0][0]).not.toContain(warningMessage);

          expect(doWork).not.toHaveBeenCalled();
        }).
        then(done, done.fail);
    });

    it('should take precedence over `--usage`', done => {
      let rawArgs = ['--usage', '--version'];
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let usageMessage = config.messages.usage;

      cli.
        run(rawArgs, doWork).
        then(() => logSpy.calls.allArgs()).
        then(args => {
          expect(logSpy).toHaveBeenCalledTimes(1);
          expect(args[0][0]).toContain(versionMessage);
          expect(args[0][0]).not.toContain(usageMessage);
        }).
        then(done, done.fail);
    });

    it('should take precedence over `--instructions`', done => {
      let rawArgs = ['--instructions', '--version'];
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let instructionsHeader = config.messages.instructionsHeaderTmpl = 'instructions header';

      cli.
        run(rawArgs, doWork).
        then(() => logSpy.calls.allArgs()).
        then(args => {
          expect(logSpy).toHaveBeenCalledTimes(1);
          expect(args[0][0]).toContain(versionMessage);
          expect(args[0][0]).not.toContain(instructionsHeader);
        }).
        then(done, done.fail);
    });
  });

  describe('--usage', () => {
    it('should display the usage instructions (plus ver. info and "exp. tool" warning)', done => {
      let rawArgs = ['--usage'];
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let warningMessage = config.messages.warnings.WARN_experimentalTool;
      let usageMessage = config.messages.usage;

      cli.
        run(rawArgs, doWork).
        then(() => logSpy.calls.allArgs()).
        then(args => {
          expect(args[0][0]).toContain(versionMessage);
          expect(args[1][0]).toContain(warningMessage);
          expect(args[2][0]).toContain(usageMessage);

          expect(doWork).not.toHaveBeenCalled();
        }).
        then(done, done.fail);
    });

    it('should not display the "experimental tool" warning if empty', done => {
      let rawArgs = ['--usage'];
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let warningMessage = config.messages.warnings.WARN_experimentalTool;
      let usageMessage = config.messages.usage;

      config.messages.warnings.WARN_experimentalTool = '';

      cli.
        run(rawArgs, doWork).
        then(() => logSpy.calls.allArgs()).
        then(args => {
          expect(logSpy).toHaveBeenCalledTimes(2);
          expect(args[0][0]).toContain(versionMessage);
          expect(args[1][0]).not.toContain(warningMessage);
          expect(args[1][0]).toContain(usageMessage);

          expect(doWork).not.toHaveBeenCalled();
        }).
        then(done, done.fail);
    });

    it('should take precedence over `--instructions`', done => {
      let rawArgs = ['--instructions', '--usage'];
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let warningMessage = config.messages.warnings.WARN_experimentalTool;
      let usageMessage = config.messages.usage;
      let instructionsHeader = config.messages.instructionsHeaderTmpl = 'instructions header';

      cli.
        run(rawArgs, doWork).
        then(() => logSpy.calls.allArgs()).
        then(args => {
          expect(logSpy).toHaveBeenCalledTimes(3);
          expect(args[0][0]).toContain(versionMessage);
          expect(args[0][0]).not.toContain(instructionsHeader);
          expect(args[1][0]).toContain(warningMessage);
          expect(args[1][0]).not.toContain(instructionsHeader);
          expect(args[2][0]).toContain(usageMessage);
          expect(args[2][0]).not.toContain(instructionsHeader);
        }).
        then(done, done.fail);
    });
  });

  describe('--instructions', () => {
    it('should display the commands that need to be run (plus ver. info and "exp. tool" warning)',
      done => {
        let rawArgs = ['--foo=foooo', 'zbabz', '--instructions'];
        let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
        let warningMessage = config.messages.warnings.WARN_experimentalTool;
        let idx = -1;

        cli.
          run(rawArgs, doWork).
          then(() => logSpy.calls.allArgs()).
          then(args => {
            expect(args[++idx][0]).toContain(versionMessage);
            expect(args[++idx][0]).toContain(warningMessage);
            expect(args[++idx][0]).toContain('Instructions for foooo, rab, zbabz and null');
            expect(args[++idx][0]).toContain('PHASE One - The beginning');
            expect(args[++idx][0]).toContain('- Do this (with foooo)');
            expect(args[++idx][0]).toContain('- Do that (with rab)');
            expect(args[++idx][0]).toContain('PHASE Two - Keep going');
            expect(args[++idx][0]).toContain('- Do not do this');
            expect(args[++idx][0]).toContain('- I warned you');
            expect(args[++idx][0]).not.toContain('PHASE Four');
            expect(args[  idx][0]).toContain('PHASE Five - The extra mile');
            expect(args[++idx][0]).toContain('- Do this better (with zbabz)');
            expect(args[++idx][0]).toContain('- Do that better (with null)');

            expect(doWork).not.toHaveBeenCalled();
          }).
          then(done, done.fail);
      }
    );

    it('should not display the "experimental tool" warning if empty', done => {
      let rawArgs = ['--foo=foooo', 'zbabz', '--instructions'];
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let warningMessage = config.messages.warnings.WARN_experimentalTool;

      config.messages.warnings.WARN_experimentalTool = '';

      cli.
        run(rawArgs, doWork).
        then(() => logSpy.calls.allArgs()).
        then(args => {
          expect(args[0][0]).toContain(versionMessage);
          expect(args[1][0]).not.toContain(warningMessage);
          expect(args[1][0]).toContain('Instructions for foooo, rab, zbabz and null');
        }).
        then(done, done.fail);
    });

    it('should reject if any argument is invalid', done => {
      let rawArgs = ['--foo=bar', '--instructions'];
      let idx = -1;

      cli.
        run(rawArgs, doWork).
        catch(() => {
          let args = errorSpy.calls.allArgs();

          expect(logSpy).not.toHaveBeenCalled();
          expect(args[++idx][0]).not.toContain('Instructions');
          expect(args[  idx][0]).toContain('There is a problem with your FOO');
          expect(args[  idx][0]).toContain('Clean-up might or might not be needed');
          expect(args[  idx][0]).toContain('OPERATION ABORTED');

          expect(doWork).not.toHaveBeenCalled();

          done();
        });
    });
  });

  describe('--no-usage --no-instructions', () => {
    it('should do some work with the input and return the result', done => {
      let rawArgs = ['--foo=foof', 'zzaabb'];
      doWork.and.returnValue(42);

      cli.
        run(rawArgs, doWork).
        then(theMeaningOfLife => expect(theMeaningOfLife).toBe(42)).
        then(() => expect(doWork).toHaveBeenCalledWith(jasmine.objectContaining({
          foo: 'foof',
          bar: 'rab',
          baz: 'zzaabb',
          qux: null
        }))).
        then(done, done.fail);
    });

    it('should decorate the actual work with user-engaging headers/footers', done => {
      let rawArgs = ['--foo=foof', 'zzaabb'];
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let warningMessage = config.messages.warnings.WARN_experimentalTool;
      let idx = -1;

      doWork = () => logSpy('Hack...hack...hack...');

      cli.
        run(rawArgs, doWork).
        then(() => logSpy.calls.allArgs()).
        then(args => {
          expect(args[++idx][0]).toContain(versionMessage);
          expect(args[++idx][0]).toContain(warningMessage);
          expect(args[++idx][0]).toContain('Using foof, rab, zzaabb and null');
          expect(args[++idx][0]).toContain('Hack...hack...hack...');
          expect(args[++idx][0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
        }).
        then(done, done.fail);
    });

    it('should reject (undefined) when something goes wrong (and not report success)', done => {
      let rawArgs = ['--foo=foof', 'zzaabb'];
      doWork = () => { throw 'Pwned'; };

      reversePromise(cli.run(rawArgs, doWork)).
        then(error => {
          expect(error).toBe(undefined);

          logSpy.calls.allArgs().forEach(args => {
            expect(args[0]).not.toContain('OPERATION COMPLETED SUCCESSFULLY');
          });
        }).
        then(done, done.fail);
    });

    it('should reject if any argument is invalid (and not do any work)', done => {
      let rawArgs = ['bbaazz'];
      let idx = -1;

      reversePromise(cli.run(rawArgs, doWork)).
        then(() => {
          let args = errorSpy.calls.allArgs();

          expect(doWork).not.toHaveBeenCalled();
          expect(logSpy).not.toHaveBeenCalled();

          expect(args[++idx][0]).toContain('There is a problem with your BAZ');
          expect(args[  idx][0]).toContain('Clean-up might or might not be needed');
          expect(args[  idx][0]).toContain('OPERATION ABORTED');
        }).
        then(done, done.fail);
    });

    describe('- Business as usual (with multiple phases and clean-ups and everything)', () => {
      let cubicle;
      let phaseWorkFns;

      beforeEach(() => {
        let phases = cli.getPhases();
        let cleanUp = thing => cubicle.splice(cubicle.lastIndexOf(thing), 1);
        let cleanUpTasks = {
          foo: cli._cleanUper.registerTask('Clean up FOO', () => cleanUp('foo')),
          bar: cli._cleanUper.registerTask('Clean up BAR', () => cleanUp('bar')),
          baz: cli._cleanUper.registerTask('Clean up BAZ', () => cleanUp('baz')),
          qux: cli._cleanUper.registerTask('Clean up QUX', () => cleanUp('qux'))
        };

        cubicle = [];
        phaseWorkFns = [
          foo => {
            let tasks = cli._utils.interpolate(phases[0].instructions.join(', '), {foo, bar: foo});
            logSpy(`Using ${foo} to: ${tasks}...`);

            cli._cleanUper.schedule(cleanUpTasks.foo);
            cubicle.push('foo');

            cli._cleanUper.withTask(cleanUpTasks.foo, () => cubicle.push('foo'));
          },
          bar => {
            logSpy(`Using ${bar} to: ${phases[1].instructions.join(', ')}...`);
            cleanUp('foo');

            cli._cleanUper.withTask(cleanUpTasks.bar, () => {
              cubicle.push('bar');
              cleanUp('bar');
            });
            cli._cleanUper.withTask(cleanUpTasks.bar, () => {
              cubicle.push('bar');
              cleanUp('bar');
            });

            cli._cleanUper.schedule(cleanUpTasks.bar);
            cubicle.push('bar');
          },
          baz => {
            logSpy(`Using ${baz} to: ${phases[2].instructions.join(', ')}...`);

            cli._cleanUper.unschedule(cleanUpTasks.bar);
            cli._cleanUper.unschedule(cleanUpTasks.foo);

            cli._cleanUper.schedule(cleanUpTasks.baz);
            cubicle.push('baz');
            cli._cleanUper.unschedule(cleanUpTasks.baz);
            cleanUp('baz');
            cli._cleanUper.schedule(cleanUpTasks.baz);
            cubicle.push('baz');
          },
          qux => {
            let tasks = cli._utils.interpolate(phases[3].instructions.join(', '), {baz: qux, qux});
            logSpy(`Using ${qux} to: ${tasks}...`);

            cli._cleanUper.unschedule(cleanUpTasks.baz);

            cubicle.push('qux');
          }
        ];
      });

      it('should work as expected when all goes well', done => {
        let input;
        doWork = inp => {
          input = inp;
          let phases = cli.getPhases();
          let resolve = Promise.resolve.bind(Promise);

          // eslint-disable-next-line jasmine/no-promise-without-done-fail
          return Promise.resolve().
            then(() => cli._uiUtils.phase(phases[0], () => resolve(phaseWorkFns[0](inp.foo)))).
            then(() => cli._uiUtils.phase(phases[1], () => resolve(phaseWorkFns[1](inp.bar)))).
            then(() => cli._uiUtils.phase(phases[2], () => resolve(phaseWorkFns[2](inp.baz)))).
            then(() => cli._uiUtils.phase(phases[3], () => resolve(phaseWorkFns[3](inp.qux))));
        };

        let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
        let warningMessage = config.messages.warnings.WARN_experimentalTool;

        cli.
          run(['zzzab', 'qux'], doWork).
          then(() => logSpy.calls.allArgs()).
          then(args => {
            let messages = [
              versionMessage,
              warningMessage,
              cli._utils.interpolate(config.messages.headerTmpl, input),
              'PHASE One - The beginning',
              'Using oof to: Do this (with oof), Do that (with oof)...',
              'done',
              'PHASE Two - Keep going',
              'Using rab to: Do not do this, I warned you...',
              'done',
              'PHASE Four - Who needs 3',
              'Using zzzab to: ...',
              'done',
              'PHASE Five - The extra mile',
              'Using qux to: Do this better (with qux), Do that better (with qux)...',
              'done',
              'OPERATION COMPLETED SUCCESSFULLY'
            ];

            messages.forEach((message, idx) => expect(args[idx][0]).toContain(message));

            expect(cubicle).toEqual(['foo', 'bar', 'baz', 'qux']);
            expect(cli._cleanUper.hasTasks()).toBe(false);
          }).
          then(done, done.fail);
      });

      [false, true].forEach(confirmCleanUp => {
        it(`should work as expected when errors occur (clean-up: ${confirmCleanUp})`, done => {
          spyOnProperty(process, 'stdin').and.returnValue(new PassThrough());
          spyOnProperty(process, 'stdout').and.returnValue(new PassThrough());

          let input;
          doWork = inp => {
            input = inp;
            let phases = cli.getPhases();
            let resolve = Promise.resolve.bind(Promise);

            /* eslint-disable jasmine/no-promise-without-done-fail */
            return resolve().
              then(() => cli._uiUtils.phase(phases[0], () => resolve(phaseWorkFns[0](inp.foo)))).
              then(() => cli._uiUtils.phase(phases[1], () => resolve(phaseWorkFns[1](inp.bar)).
                then(() => Promise.reject('You should not have done that')))).
              then(() => cli._uiUtils.phase(phases[2], () => resolve(phaseWorkFns[2](inp.baz)))).
              then(() => cli._uiUtils.phase(phases[3], () => resolve(phaseWorkFns[3](inp.qux))));
            /* eslint-enable jasmine/no-promise-without-done-fail */
          };

          let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
          let warningMessage = config.messages.warnings.WARN_experimentalTool;

          reversePromise(cli.run(['zzzab', 'qux'], doWork)).
            then(() => {
              let errArgs = errorSpy.calls.allArgs();
              let logArgs = logSpy.calls.allArgs();
              let logMessages = [
                versionMessage,
                warningMessage,
                cli._utils.interpolate(config.messages.headerTmpl, input),
                'PHASE One - The beginning',
                'Using oof to: Do this (with oof), Do that (with oof)...',
                'done',
                'PHASE Two - Keep going',
                'Using rab to: Do not do this, I warned you...'
              ].concat(confirmCleanUp ? [
                'PHASE X - Trying to clean up the mess',
                '- Clean-up task: Clean up BAR',
                '- Clean-up task: Clean up FOO',
                'done'
              ] : [
                'OK, I\'m not doing anything. FYI, the pending tasks (afaik) are',
                '- Clean-up task: Clean up BAR',
                '- Clean-up task: Clean up FOO',
              ]);

              expect(logSpy).toHaveBeenCalledTimes(logMessages.length);
              logMessages.forEach((message, idx) => {
                [].concat(message).forEach(msg => expect(logArgs[idx][0]).toContain(msg));
              });

              expect(errorSpy).toHaveBeenCalledTimes(2);
              expect(errArgs[0][1]).toContain('You should not have done that');
              expect(errArgs[1][0]).toContain('Ooops, there were TWO errors');
              expect(errArgs[1][0]).toContain('Clean-up might or might not be needed');
              expect(errArgs[1][0]).toContain('OPERATION ABORTED');

              expect(cubicle).toEqual(confirmCleanUp ? [] : ['foo', 'bar']);
              expect(cli._cleanUper.hasTasks()).toBe(false);
            }).
            then(done, done.fail);

          setTimeout(() => process.stdin.emit('data', `${confirmCleanUp ? 'y' : 'n'}\n`));
        });
      });
    });
  });
});
