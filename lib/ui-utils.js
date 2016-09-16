'use strict';

// Imports
let chalk = require('chalk');
let readline = require('readline');

// Classes
class UiUtils {
  // Constructor
  constructor(cleanUper, errorMessages) {
    this._cleanUper = cleanUper;
    this._errorMessages = errorMessages;
  }

  // Methods - Protected
  _matchesAnswer(actual, expected) {
    let actualLc = actual.toLowerCase();
    let expectedLc = expected.toLowerCase();

    return (actualLc === expectedLc) || (actualLc === expectedLc[0]);
  }

  // Methods - Public
  askQuestion(question) {
    return new Promise(resolve => {
      var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question(question, answer => {
        rl.close();
        resolve(answer);
      });
    });
  }

  askYesOrNoQuestion(question, defaultsToYes) {
    return new Promise((resolve, reject) => {
      let optStyle = chalk.bgBlack.gray;
      let defStyle = chalk.white.bold;
      let answerOptions = optStyle(defaultsToYes ? `[${defStyle('Y')}/n]` : `[y/${defStyle('N')}]`);

      this.askQuestion(`\n${question} ${answerOptions}: ${chalk.bgWhite('')}`).then(answer => {
        let nonDefaultAnswer = defaultsToYes ? 'no' : 'yes';
        let gaveNonDefaultAnswer = this._matchesAnswer(answer, nonDefaultAnswer);
        let saidYes = (!defaultsToYes && gaveNonDefaultAnswer) ||
                      (defaultsToYes && !gaveNonDefaultAnswer);

        (saidYes ? resolve : reject)();
      });
    });
  }

  exitWithErrorFnGen(errorOrCode, skipCleanUp) {
    let exitWithError = extraErr => {
      let errMsg = this._errorMessages[errorOrCode] || errorOrCode || '<no error code>';
      let opAbortedMsg = chalk.bold('OPERATION ABORTED!');
      let cleanUpMsg = chalk.gray('(Clean-up might or might not be needed.)');

      let exit = () => process.exit(1);
      let onCleanUpError = err => console.error(chalk.red('\nSomething went wrong:'), err);

      if (extraErr) {
        console.error('\n', extraErr);
      }
      console.error(chalk.red(`\n  ERROR: ${errMsg}\n         ${cleanUpMsg}\n\n  ${opAbortedMsg}`));

      return (!skipCleanUp && this._cleanUper.hasTasks()) ?
          this.offerToCleanUp().catch(onCleanUpError).then(exit) :
          exit();
    };

    return exitWithError;
  }

  offerToCleanUp() {
    let doCleanUp = () => {
      let cleanUpPhase = this._cleanUper.getCleanUpPhase();
      let doWork = () => this._cleanUper.cleanUp();

      return this.phase(cleanUpPhase, doWork, true);
    };
    let dontCleanUp = () => Promise.resolve().
      then(() => console.log('\nOK, I\'m not doing anything. FYI, the pending tasks (afaik) are:')).
      then(() => this._cleanUper.cleanUp(true));

    return this.
      askYesOrNoQuestion(chalk.bgYellow.black('Do you want me to try to clean up for you?')).
      then(doCleanUp, dontCleanUp);
  }

  phase(phase, doWork, skipCleanUp) {
    let id = phase.id;
    let description = phase.description;
    let error = phase.error;

    console.log(chalk.cyan.bold(`\n\n  PHASE ${id} - ${description}...\n`));

    return doWork().
      then(output => {
        console.log(chalk.green('\n  ...done'));
        return output;
      }).
      catch(this.exitWithErrorFnGen(error || 'ERROR_unexpected', skipCleanUp));
  }
}

// Exports
module.exports = UiUtils;