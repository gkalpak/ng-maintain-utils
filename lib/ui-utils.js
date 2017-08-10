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

    console.log(chalk.reset.cyan.bold(`\n\n  PHASE ${id} - ${description}...\n`));

    return doWork().
      then(output => {
        console.log(chalk.green('\n  ...done'));
        return output;
      }).
      catch(this.reportAndRejectFnGen(error || 'ERROR_unexpected', skipCleanUp));
  }

  reportAndRejectFnGen(errorOrCode, skipCleanUp) {
    let reportAndReject = extraErr => {
      let mainErrorMsg = this._errorMessages[errorOrCode] || errorOrCode || '<no error code>';
      let cleanUpMsg = chalk.gray('(Clean-up might or might not be needed.)');
      let opAbortedMsg = chalk.bold('OPERATION ABORTED!');
      let fullErrorMsg = `\n  ERROR: ${mainErrorMsg}\n         ${cleanUpMsg}\n\n  ${opAbortedMsg}`;
      let cleanUpErrorMsg = '\nSomething went wrong while cleaning up:';
      let unknownErrorMsg = this._errorMessages['ERROR_unexpected'];

      let reject = () => Promise.reject();
      let onCleanUpError = err => console.error(chalk.red(cleanUpErrorMsg), err || unknownErrorMsg);

      if (extraErr) {
        console.error('\n', extraErr);
      }
      console.error(chalk.red(fullErrorMsg));

      return (!skipCleanUp && this._cleanUper.hasTasks()) ?
        this.offerToCleanUp().catch(onCleanUpError).then(reject) :
        reject();
    };

    return reportAndReject;
  }
}

// Exports
module.exports = UiUtils;
