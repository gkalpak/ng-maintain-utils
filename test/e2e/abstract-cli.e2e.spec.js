'use strict';

// Imports
let chalk = require('chalk');

// Imports - Local
let AbstractCli = require('../../lib/abstract-cli');
let ArgSpec = require('../../lib/arg-spec');
let Config = require('../../lib/config');
let Phase = require('../../lib/phase');

// Tests
describe('AbstractCli', () => {
  let chalkEnabled = chalk.enabled;
  let config;
  let cli;

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
      getPhases() { return phases; }
    }

    config = new Config(messages, argSpecs);
    cli = new MyCli(config);

    chalk.enabled = false;

    spyOn(console, 'error');
    spyOn(console, 'log');
  });

  afterEach(() => {
    chalk.enabled = chalkEnabled;
  });

  describe('--usage', () => {
    it('should display the usage instructions (plus ver. info and "exp. tool" warning)', done => {
      let rawArgs = ['--usage'];
      let doWork = jasmine.createSpy('doWork');
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let warningMessage = config.messages.warnings.WARN_experimentalTool;
      let usageMessage = config.messages.usage;

      cli.
        run(rawArgs, doWork).
        then(() => console.log.calls.allArgs()).
        then(args => {
          expect(args[0][0]).toContain(versionMessage);
          expect(args[1][0]).toContain(warningMessage);
          expect(args[2][0]).toContain(usageMessage);
        }).
        then(done);
    });

    it('should not display the "experimental tool" warning if empty', done => {
      let rawArgs = ['--usage'];
      let doWork = jasmine.createSpy('doWork');
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let warningMessage = config.messages.warnings.WARN_experimentalTool;
      let usageMessage = config.messages.usage;

      config.messages.warnings.WARN_experimentalTool = '';

      cli.
        run(rawArgs, doWork).
        then(() => console.log.calls.allArgs()).
        then(args => {
          expect(console.log).toHaveBeenCalledTimes(2);
          expect(args[0][0]).toContain(versionMessage);
          expect(args[1][0]).not.toContain(warningMessage);
          expect(args[1][0]).toContain(usageMessage);
        }).
        then(done);
    });
  });

  describe('--instructions', () => {
    it('should display the commands that need to be run (plus ver. info and "exp. tool" warning)',
      done => {
        let rawArgs = ['--foo=foooo', 'zbabz', '--instructions'];
        let doWork = jasmine.createSpy('doWork');
        let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
        let warningMessage = config.messages.warnings.WARN_experimentalTool;
        let idx = -1;

        cli.
          run(rawArgs, doWork).
          then(() => console.log.calls.allArgs()).
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
          }).
          then(done);
      }
    );

    it('should not display the "experimental tool" warning if empty', done => {
      let rawArgs = ['--foo=foooo', 'zbabz', '--instructions'];
      let doWork = jasmine.createSpy('doWork');
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let warningMessage = config.messages.warnings.WARN_experimentalTool;

      config.messages.warnings.WARN_experimentalTool = '';

      cli.
        run(rawArgs, doWork).
        then(() => console.log.calls.allArgs()).
        then(args => {
          expect(args[0][0]).toContain(versionMessage);
          expect(args[1][0]).not.toContain(warningMessage);
          expect(args[1][0]).toContain('Instructions for foooo, rab, zbabz and null');
        }).
        then(done);
    });

    it('should reject if any argument is invalid', done => {
      let rawArgs = ['--foo=bar', '--instructions'];
      let doWork = jasmine.createSpy('doWork');
      let idx = -1;

      cli.
        run(rawArgs, doWork).
        catch(() => {
          let args = console.error.calls.allArgs();

          expect(console.log).not.toHaveBeenCalled();
          expect(args[++idx][0]).not.toContain('Instructions');
          expect(args[  idx][0]).toContain('There is a problem with your FOO');
          expect(args[  idx][0]).toContain('Clean-up might or might not be needed');
          expect(args[  idx][0]).toContain('OPERATION ABORTED');

          done();
        });
    });
  });

  describe('--no-usage --no-instructions', () => {
    it('should do some work with the input and return the result', done => {
      let rawArgs = ['--foo=foof', 'zzaabb'];
      let doWork = jasmine.createSpy('doWork').and.returnValue(42);

      cli.
        run(rawArgs, doWork).
        then(theMeaningOfLife => expect(theMeaningOfLife).toBe(42)).
        then(() => expect(doWork).toHaveBeenCalledWith(jasmine.objectContaining({
          foo: 'foof',
          bar: 'rab',
          baz: 'zzaabb',
          qux: null
        }))).
        then(done);
    });

    it('should decorate the actual work with user-engaging headers/footers', done => {
      let rawArgs = ['--foo=foof', 'zzaabb'];
      let doWork = () => console.log('Hack...hack...hack...');
      let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
      let warningMessage = config.messages.warnings.WARN_experimentalTool;
      let idx = -1;

      cli.
        run(rawArgs, doWork).
        then(() => console.log.calls.allArgs()).
        then(args => {
          expect(args[++idx][0]).toContain(versionMessage);
          expect(args[++idx][0]).toContain(warningMessage);
          expect(args[++idx][0]).toContain('Using foof, rab, zzaabb and null');
          expect(args[++idx][0]).toContain('Hack...hack...hack...');
          expect(args[++idx][0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
        }).
        then(done);
    });

    it('should reject when something goes wrong (and not report success)', done => {
      let rawArgs = ['--foo=foof', 'zzaabb'];
      let doWork = () => { throw 'Pwned'; };

      cli.
        run(rawArgs, doWork).
        catch(error => {
          expect(error).toBe('Pwned');

          console.log.calls.allArgs().forEach(args => {
            expect(args[0]).not.toContain('OPERATION COMPLETED SUCCESSFULLY');
          });

          done();
        });
    });

    it('should reject if any argument is invalid (and not do any work)', done => {
      let rawArgs = ['bbaazz'];
      let doWork = jasmine.createSpy('doWork');
      let idx = -1;

      cli.
        run(rawArgs, doWork).
        catch(() => {
          let args = console.error.calls.allArgs();

          expect(doWork).not.toHaveBeenCalled();
          expect(console.log).not.toHaveBeenCalled();

          expect(args[++idx][0]).toContain('There is a problem with your BAZ');
          expect(args[  idx][0]).toContain('Clean-up might or might not be needed');
          expect(args[  idx][0]).toContain('OPERATION ABORTED');

          done();
        });
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
            console.log(`Using ${foo} to: ${tasks}...`);

            cli._cleanUper.schedule(cleanUpTasks.foo);
            cubicle.push('foo');

            cli._cleanUper.withTask(cleanUpTasks.foo, () => cubicle.push('foo'));
          },
          bar => {
            console.log(`Using ${bar} to: ${phases[1].instructions.join(', ')}...`);

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
            console.log(`Using ${baz} to: ${phases[2].instructions.join(', ')}...`);

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
            console.log(`Using ${qux} to: ${tasks}...`);

            cli._cleanUper.unschedule(cleanUpTasks.baz);

            cubicle.push('qux');
          }
        ];
      });

      it('should work as expected when all goes well', done => {
        let input;
        let doWork = inp => {
          input = inp;
          let phases = cli.getPhases();
          let resolve = Promise.resolve.bind(Promise);

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
          then(() => console.log.calls.allArgs()).
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
          then(done);
      });

      [false, true].forEach(confirmCleanUp => {
        it(`should work as expected when errors occur (clean-up: ${confirmCleanUp})`, done => {
          spyOn(process.stdout, 'write');

          let input;
          let doWork = inp => {
            input = inp;
            let phases = cli.getPhases();
            let resolve = Promise.resolve.bind(Promise);

            return Promise.resolve().
              then(() => cli._uiUtils.phase(phases[0], () => resolve(phaseWorkFns[0](inp.foo)))).
              then(() => cli._uiUtils.phase(phases[1], () => resolve(phaseWorkFns[1](inp.bar)).
                then(() => Promise.reject('You should not have done that')))).
              then(() => cli._uiUtils.phase(phases[2], () => resolve(phaseWorkFns[2](inp.baz)))).
              then(() => cli._uiUtils.phase(phases[3], () => resolve(phaseWorkFns[3](inp.qux))));
          };

          let versionMessage = ` ${config.versionInfo.name}  v${config.versionInfo.version} `;
          let warningMessage = config.messages.warnings.WARN_experimentalTool;

          cli.
            run(['zzzab', 'qux'], doWork).
            catch(() => {
              let errArgs = console.error.calls.allArgs();
              let logArgs = console.log.calls.allArgs();
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

              expect(console.log).toHaveBeenCalledTimes(logMessages.length);
              logMessages.forEach((message, idx) => {
                [].concat(message).forEach(msg => expect(logArgs[idx][0]).toContain(msg));
              });

              expect(console.error).toHaveBeenCalledTimes(2);
              expect(errArgs[0][1]).toContain('You should not have done that');
              expect(errArgs[1][0]).toContain('Ooops, there were TWO errors');
              expect(errArgs[1][0]).toContain('Clean-up might or might not be needed');
              expect(errArgs[1][0]).toContain('OPERATION ABORTED');

              expect(cubicle).toEqual(confirmCleanUp ? [] : ['foo', 'bar']);
              expect(cli._cleanUper.hasTasks()).toBe(false);

              done();
            });

          setTimeout(() => process.stdin.emit('data', `${confirmCleanUp ? 'y' : 'n'}\n`));
        });
      });
    });
  });
});
