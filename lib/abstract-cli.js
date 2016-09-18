'use strict';

// Imports
let chalk = require('chalk');

// Imports - Local
let CleanUper = require('./clean-uper');
let UiUtils = require('./ui-utils');
let Utils = require('./utils');

// Classes
class AbstractCli {
  // Constructor
  constructor(config) {
    if (this.constructor === AbstractCli) {
      throw new Error('Trying to instantiate abstract class `AbstractCli`.');
    }

    this._config = config;

    this._cleanUper = new CleanUper();
    this._utils = new Utils();
    this._uiUtils = new UiUtils(this._cleanUper, this._config.messages.errors);
  }

  // Methods - Protected
  _displayHeader(headerTmpl, input) {
    let header = this._utils.interpolate(headerTmpl, input);
    console.log(chalk.blue.bold(header));
  }

  _displayInstructions(phases, input) {
    phases.forEach(phase => {
      let id = phase.id;
      let description = phase.description;
      let instructions = phase.instructions;

      if (!instructions.length) return;

      console.log(chalk.cyan.bold(`\n\n  PHASE ${id} - ${description}\n`));
      instructions.forEach(task => {
        task = this._utils.
          interpolate(task, input).
          replace(/`([^`]+)`/g, `${chalk.bgBlack.green('$1')}`);

        console.log(`    - ${task}`);
      });
    });
  }

  _displayUsage(usageMessage) {
    let lines = usageMessage.split('\n');
    let first = lines.shift();
    let rest = lines.join('\n');

    console.log(`${chalk.bold(first)}\n${chalk.gray(rest)}`);
  }

  _getAndValidateInput(rawArgs, argSpecs) {
    let args = this._utils.parseArgs(rawArgs);
    let input = {
      usage: !!args.usage,
      instructions: !!args.instructions
    };

    if (!input.usage) {
      try {
        argSpecs.forEach(spec => spec.applyOn(args, input));
      } catch (errorCode) {
        this._uiUtils.exitWithErrorFnGen(errorCode, true)();
      }
    }

    return input;
  }

  _theEnd(value) {
    console.log(chalk.green.bold('\n  OPERATION COMPLETED SUCCESSFULLY!'));

    return value;
  }

  // Methods - Public
  getPhases() {
    throw new Error('Missing implementation for abstract method `getPhases()`.');
  }

  run(rawArgs, doWork) {
    let input = this._getAndValidateInput(rawArgs, this._config.argSpecs);

    if (input.usage) {
      this._displayUsage(this._config.messages.usage);
      process.exit(0);

    } else if (input.instructions) {
      this._displayHeader(this._config.messages.instructionsHeaderTmpl, input);
      this._displayInstructions(this.getPhases(), input);
      process.exit(0);
    }

    this._displayHeader(this._config.messages.headerTmpl, input);

    return Promise.resolve(doWork(input)).
      then(value => this._theEnd(value)).
      catch(this._uiUtils.exitWithErrorFnGen('ERROR_unexpected'));
  }
}

// Exports
module.exports = AbstractCli;
