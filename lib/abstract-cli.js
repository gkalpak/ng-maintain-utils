'use strict';

// Imports
let chalk = require('chalk');

// Imports - Local
let CleanUper = require('./clean-uper');
let Logger = require('./logger');
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

    this._logger = new Logger();
    this._cleanUper = new CleanUper(this._logger);
    this._utils = new Utils(this._logger);
    this._uiUtils = new UiUtils(this._logger, this._cleanUper, this._config.messages.errors);

    if (!process.$$resetOutputStyleOnExit) {
      this._utils.resetOutputStyleOnExit(process);
    }
  }

  // Methods - Protected
  _displayExperimentalTool() {
    let wanringMessage = this._config.messages.warnings.WARN_experimentalTool;

    if (wanringMessage) {
      this._logger.log(`\n${chalk.yellow(wanringMessage)}`);
    }
  }

  _displayHeader(headerTmpl, input) {
    let header = this._utils.interpolate(headerTmpl, input);

    this._displayVersionInfo();
    this._displayExperimentalTool();
    this._logger.log(`\n${chalk.blue.bold(header)}`);
  }

  _displayInstructions(phases, input) {
    phases.forEach(phase => {
      let id = phase.id;
      let description = phase.description;
      let instructions = phase.instructions;

      if (!instructions.length) return;

      this._logger.log(chalk.cyan.bold(`\n\n  PHASE ${id} - ${description}\n`));
      instructions.forEach(task => {
        task = this._utils.
          interpolate(task, input).
          replace(/`([^`]+)`/g, `${chalk.bgBlack.green('$1')}`);

        this._logger.log(`    - ${task}`);
      });
    });
  }

  _displayUsage(usageMessage) {
    let lines = usageMessage.split('\n');
    let first = lines.shift();
    let rest = lines.join('\n');

    this._displayVersionInfo();
    this._displayExperimentalTool();
    this._logger.log(`\n${chalk.bold(first)}\n${chalk.gray(rest)}`);
  }

  _displayVersionInfo() {
    let versionInfo = this._config.versionInfo;

    let nameInStyle = chalk.bgMagenta.yellow.bold(` ${versionInfo.name} `);
    let versionInStyle = chalk.bgYellow.magenta(` v${versionInfo.version} `);

    this._logger.log(`\n ${nameInStyle}${versionInStyle} `);
  }

  _getAndValidateInput(rawArgs, argSpecs) {
    return Promise.resolve().
      then(() => {
        let args = this._utils.parseArgs(rawArgs);
        let input = {
          version: !!args.version,
          usage: !!args.usage,
          instructions: !!args.instructions
        };

        if (!input.version && !input.usage) {
          argSpecs.forEach(spec => spec.applyOn(args, input));
        }

        return input;
      }).
      catch(errorOrCode => this._uiUtils.reportAndRejectFnGen(errorOrCode)());
  }

  _insertEmptyLine() {
    this._logger.log();
  }

  _theHappyEnd(value) {
    this._logger.log(chalk.green.bold('\n  OPERATION COMPLETED SUCCESSFULLY!'));

    return value;
  }

  _theUnhappyEnd(err) {
    if (err) {
      return this._uiUtils.reportAndRejectFnGen('ERROR_unexpected')(err);
    }

    return Promise.reject();
  }

  // Methods - Public
  getPhases() {
    throw new Error('Missing implementation for abstract method `getPhases()`.');
  }

  run(rawArgs, doWork) {
    return Promise.resolve().
      then(() => this._getAndValidateInput(rawArgs, this._config.argSpecs)).
      then(input => {
        if (input.version) {
          this._displayVersionInfo();
        } else if (input.usage) {
          this._displayUsage(this._config.messages.usage);
        } else if (input.instructions) {
          this._displayHeader(this._config.messages.instructionsHeaderTmpl, input);
          this._displayInstructions(this.getPhases(), input);
        } else {
          this._displayHeader(this._config.messages.headerTmpl, input);

          return Promise.resolve().
            then(() => doWork(input)).
            then(value => this._theHappyEnd(value));
        }
      }).
      catch(err => this._theUnhappyEnd(err)).
      then(value => {
        this._insertEmptyLine();
        return value;
      }, err => {
        this._insertEmptyLine();
        return Promise.reject(err);
      });
  }
}

// Exports
module.exports = AbstractCli;
