'use strict';

// Imports
let fs = require('fs');
let https = require('https');

// Imports - Local
let DiffHighlighter = require('./diff-highlighter');
let Utils = require('./utils');

// Classes
class GitUtils {
  // Constructor
  constructor(cleanUper, utils) {
    this._cleanUper = cleanUper;
    this._utils = utils;

    this._cleanUpTasks = {
      abortAm: this._cleanUper.registerTask(
          'Abort `git am`.',
          () => this.abortAm().catch(() => {}))
    };
  }

  // Methods - Public
  abortAm() {
    return this._utils.spawnAsPromised('git am --abort');
  }

  abortRebase() {
    return this._utils.spawnAsPromised('git rebase --abort');
  }

  checkout(branch) {
    return this._utils.spawnAsPromised(`git checkout ${branch}`);
  }

  clean(mode) {
    if (!mode) {
      mode = 'interactive';
    }

    let modeOpt = ((mode.length === 1) ? '-' : '--') + mode;

    return this._utils.spawnAsPromised(`git clean ${modeOpt}`);
  }

  countCommitsSince(commit) {
    return this._utils.execAsPromised(`git rev-list --count ${commit}..HEAD`).
      then(response => parseInt(response.toString().trim(), 10));
  }

  createBranch(branch) {
    return this._utils.spawnAsPromised(`git checkout -b ${branch}`);
  }

  deleteBranch(branch, force) {
    // Git before v2.5.0 does not understand the `--delete --force` syntax. Use `-D` instead.
    let deleteOpt = force ? '-D' : '--delete';

    return this._utils.spawnAsPromised(`git branch ${deleteOpt} ${branch}`);
  }

  diff(commit, noColor) {
    let colorOpt = noColor ? '--no-color' : '--color';

    return this._utils.spawnAsPromised(`git diff ${colorOpt} ${commit}`);
  }

  diffWithHighlight(commit) {
    let dh = new DiffHighlighter();

    return Promise.all([
      this._utils.spawnAsPromised(`git diff --no-color ${commit}`, null, dh.getInputStream()),
      this._utils.spawnAsPromised('less --no-init --raw-control-chars', dh.getOutputStream())
    ]);
  }

  getCommitMessage(commit) {
    return this._utils.execAsPromised(`git show --no-patch --format=%B ${commit}`).
      then(message => message.toString());
  }

  getLastCommitMessage() {
    return this.getCommitMessage('HEAD');
  }

  log(oneline, count, noDecorate) {
    let onelineOpt = oneline ? ' --oneline' : '';
    let countOpt = count ? ` -${count}` : '';
    let decorateOpt = noDecorate ? '--no-decorate' : '--decorate';

    return this._utils.spawnAsPromised(`git log ${decorateOpt}${onelineOpt}${countOpt}`).
      // `git log` has an exit code !== 0 if you exit before viewing all commits; ignore...
      catch(() => {});
  }

  mergePullRequest(prUrl) {
    // WARNING: Does not follow redirections :(
    //          To support redirection: this._utils.spawnAsPromised(`curl -L ${prUrl} | git am -3`)
    return new Promise((resolve, reject) => {
      let cb = res => this._cleanUper.
        withTask(this._cleanUpTasks.abortAm, () => this._utils.spawnAsPromised('git am -3', res)).
        then(resolve, reject);

      https.
        get(prUrl, cb).
        on('error', reject);
    });
  }

  pull(branch, rebase) {
    let rebaseOpt = rebase ? ' --rebase' : '';

    return this._utils.spawnAsPromised(`git pull${rebaseOpt} origin ${branch}`);
  }

  push(branch) {
    return this._utils.spawnAsPromised(`git push origin ${branch}`);
  }

  rebase(commit, interactive) {
    if (typeof commit === 'number') commit = `HEAD~${commit}`;

    let interactiveOpt = interactive ? ' --interactive' : '';

    return this._utils.spawnAsPromised(`git rebase${interactiveOpt} ${commit}`);
  }

  reset(commit, hard) {
    let hardOpt = hard ? ' --hard' : '';

    return this._utils.spawnAsPromised(`git reset${hardOpt} ${commit}`);
  }

  setLastCommitMessage(message) {
    // Hack: The only cross-platform way I could come up with
    // for programmatically setting multi-line commit messages
    let tempFile = `.temp-commit-message_${Date.now()}.txt`;
    let onSuccess = () => this.unlinkAsPromised(tempFile);
    let onError = err => {
      let finallyCb = () => Promise.reject(err);
      return this.unlinkAsPromised(tempFile).then(finallyCb, finallyCb);
    };

    return Promise.resolve().
      then(() => this.writeFileAsPromised(tempFile, message)).
      then(() => this._utils.
        spawnAsPromised(`git commit --amend --file=${tempFile}`).
        then(onSuccess, onError));
  }

  updateLastCommitMessage(getNewMessage) {
    return this.getLastCommitMessage().
      then(oldMessage => getNewMessage(oldMessage)).
      then(newMessage => this.setLastCommitMessage(newMessage));
  }
}
GitUtils.DiffHighlighter = DiffHighlighter;
GitUtils.prototype.unlinkAsPromised = Utils.prototype.asPromised(fs.unlink, fs);
GitUtils.prototype.writeFileAsPromised = Utils.prototype.asPromised(fs.writeFile, fs);

// Exports
module.exports = GitUtils;
