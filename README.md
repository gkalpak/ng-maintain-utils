# ng-maintain-utils [![Build Status][build-status-image]][build-status]

## Description

A private collection of utilities for developing tools to help maintain (AngularJS-related) GitHub
repositories.

## Usage

_You_ should generally not use it. You would use tools built on top of it, for example:

- [ng-cla-check][ng-cla-check]
- [ng-pr-merge][ng-pr-merge]

_I_ may use it for building other tools (see above). Here is a brief overview of what's in the box:

- **`AbstractCli`:** Can serve as a base-class for creating a `Cli` object that can orchestrate the
  execution of some type of work, based on a list of "raw" command-line arguments. It can display
  version info (with `--version`), show usage instructions (with `--usage`), outline the commands
  that need to be executed to complete the task at hand (with `--instructions`) - a sort of
  "dry-run", report the beginning/end of execution, etc.

  It exposes the following (public) methods:

  - `getPhases(): Phase[]` (**abstract**): This method _must_ be overwritten and return an array of `Phase`
    objects (to be used for displaying instructions in the "dry-run" mode).
  - `run(rawArgs: string[], doWork?: ({[key: string]: string}) => any): Promise`: Parse the arguments
    and take appropriate action (see above).

  It also provides a number of "protected" methods, that can be overwritten by sub-classes:

  - `_displayExperimentalTool(): void`
  - `_displayHeader(headerTmpl: string, input: {[key: string]: string}): void`
  - `_displayInstructions(phases: Phase[], input: {[key: string]: string}): void`
  - `_displayUsage(usageMessage: string): void`
  - `_displayVersionInfo(): void`
  - `_getAndValidateInput(rawArgs: string[], argSpecs: ArgSpec[]): Promise<{[key: string]: string}>`
  - `_theHappyEnd<T>(value: T): T`
  - `_theUnhappyEnd(err: any): Promise<any>`

  Requires:
    - _config_: `Config`

- **`ArgSpec`/`ArgSpec.Unnamed`:** Represents the specification for a command-line argument. When
  applied on a parsed arguments object (such as the ones returned by `Utils#parseArgs()`) it will
  extract the corresponding argument's value (either by name (`ArgSpec`) or by position
  (`ArgSpec.Unnamed`)), fall back to a default value if necessary, vaidate the value and assign it
  to the specified `input` object under the appropriate `key`.

  Requires:
    - _index_: `number` (`ArgSpec.Unnamed` only)
    - _key_: `string`
    - _validator_: `(value: any) => boolean`
    - _errorCode_: `string`
    - _defaultValue?_: `string|boolean`

- **`CleanUper`:** A utility to help coordinate arbitrary tasks with their associated clean-up
  process.

  The general idea is this: 
  1. Schedule a task to clean up after `something`.
  2. Do `something`.
  3. ...possibly do other things here...
  4. If anything goes wrong, the app will be able to clean up (or show instructions to the user).
  5. When cleaning up after `something` is no longer necessary, unschedule the clean-up task.
  
  Provides the following methods:
  - `cleanUp(listOnly: boolean): Promise`: Perform all clean-up tasks (or just list them).
    <sub>(Either way, the clean-up task queue is emptied.)</sub>
  - `getCleanUpPhase(): Phase`: Returns a clean-up `Phase` object (suitable for `UiUtils#phase()`).
  - `hasTasks(): boolean`: Returns whether or not there are any clean-up tasks scheduled.
  - `registerTask(description: string, cb: () => Promise): TaskId`: Register a task with the
    `CleanUper`. You can use the returned, unique `TaskId` for scheduling/unscheduling the task.
  - `schedule(taskId: TaskId): void`: Schedule a clean-up task.
  - `unschedule(taskId: TaskId): void`: Schedule (the last instance of) a clean-up task.
  - `withTask(taskId: TaskId, fn: () => any): Promise`: Schedule `taskId` and execute `fn` (can also
    return a promise). If all goes well, unschedule `taskId`. If an error occurs, leave `taskId`
    in the clean-up task queue.

- **`Config`:** Creates a `Config` object based on the specified `messages` and `argSpecs` (falling
  back to some default values if necessary). It exposes the following properties:

  - `argSpecs`: A (possibly empty) array of `ArgSpec` objects.
  - `defaults`: A `{[argument: string]: string|number}` map of default values per command-line
    argument keys. <sub>(Automatically extracted for `argSpecs`.)</sub>
  - `messages`: A (possibly nested) `{[messageKey: string]: string}` map with at least the following
    messages:
    - `usage`
    - `instructionsHeaderTmpl`
    - `headerTmpl`
    - `errors`:
      - `ERROR_unexpected`
    - `warnings`:
      - `WARN_experimentalTool`
  - `versionInfo`: A `{name: string, version: string}` map with values retrieved from the main
    module's `package.json` (i.e. the first `package.json` to be found starting from the main file's
    directory and moving upwards).
  
  Requires:
    - _messages_: `{[messageKey: string]: string}`
    - _argSpecs_: `ArgSpec[]`

- **`GitUtils`:** A collection of `Git`-related command-wrappers and utilities. Mainly spawns `Git`
  commands in a separate process and (promises to) return the output. Support for commands is added
  in an "as-needed" basis. Currently, the available commands/utilities include:

  - `abortAm(): Promise`
  - `abortRebase(): Promise`
  - `checkout(branch: string): Promise`
  - `countCommitsSince(commit: string): Promise<number>`
  - `createBranch(branch: string): Promise`
  - `deleteBranch(branch: string, force?: boolean): Promise`
  - `diff(commit: string): Promise`
  - `getCommitMessage(commit: string): Promise<string>`
  - `getLastCommitMessage(): Promise<string>`
  - `log(oneline?: boolean, count?: number): Promise`
  - `mergePullRequest(prUrl: string): Promise`
  - `pull(branch: string, rebase?: boolean): Promise`
  - `push(branch: string): Promise`
  - `rebase(commit: string|number, interactive?: boolean): Promise`
  - `reset(commit: string, hard?: boolean): Promise`
  - `setLastCommitMessage(message: string): Promise`
  - `updateLastCommitMessage(getNewMessage: (oldMessage: string) => string): Promise`

  Requires:
    - _cleanUper_: `CleanUper`
    - _utils_: `Utils`
  
- **`Phase`:** A simple wrapper for "phase" entities (with validation). A "phase" is a description
  of a unit of work, including an ID, a short description, a list of the tasks involved and an error
  message (or code) specific to this "phase".

  Requires:
    - _id_: `string`
    - _description_: `string`
    - _instructions?_: `string[]`
    - _error?_: `string` <sub>(Can be either an error message or an error code.)</sub>

- **`UiUtils`:** A collection of utilities useful for interacting with the user, including:

  - `askQuestion()`: Prompt the user with a question and (promise to) return the answer.
  - `askYesOrNoQuestion()`: Prompt the user with a yes-or-no question (e.g. a confirmation) and
    (promise to) resolve (for "yes") or reject (for "no").
  - `offerToCleanUp()`: Requests confirmation to perform the scheduled clean-up tasks. If the user
    turns the offer down, it will just list the pending tasks instead.
  - `phase()`: It will report the beginning and end of a "phase" (see `Phase`), do some work and
    properly handle possible errors (by means of `reportAndRejectFnGen()`).
  - `reportAndRejectFnGen()`: Generates a callback that will report the specified error (plus any
    extra error provided during invokation), will offer to clean up (if there are pending tasks and
    not configured otherwise) and return a rejection.
  
  Requires:
    - _cleanUper_: `CleanUper`
    - _errorMessages_: `{[errorCode: string]: string}`

- **`Utils`:** A collection of low-level, specific-purpose utilities, including:

  - `asPromised()`: Convert callback-based functions to promise-based.
  - `interpolate()`: Replace `{{...}}` placeholders in a string with values.
  - `parseArgs()`: Parse command-line arguments (and remove surrounding quotes).
  - `spawnAsPromised`: Spawn a process to run a (series of) command(s) with support for piping.
  - `waitAsPromised`: `setTimeout()` wrapped in a promise.

## Testing

The following test-types/modes are available:

- **Code-linting:** `npm run lint`  
  _Lint JavaScript files using ESLint._

- **Unit tests:** `npm run test-unit`  
  _Run all the unit tests once. These tests are quick and suitable to be run on every change._

- **E2E tests:** `npm run test-e2e`  
  _Run all the end-to-end tests once. These test may hit actual API endpoints or perform expensive
  I/O operations and are considerably slower than unit tests._

- **All tests:** `npm test` / `npm run test`  
  _Run all of the above tests (code-linting, unit tests, e2e tests). This command is automatically
  run before `npm version` and `npm publish`._

- **"Watch" mode:** `npm run test-watch`  
  _Watch all files and rerun the unit tests whenever something changes. For performance reasons,
  code-linting and e2e tests are omitted._


[build-status]: https://travis-ci.org/gkalpak/ng-maintain-utils
[build-status-image]: https://travis-ci.org/gkalpak/ng-maintain-utils.svg?branch=master
[ng-cla-check]: https://www.npmjs.com/package/@gkalpak/ng-cla-check
[ng-pr-merge]: https://www.npmjs.com/package/@gkalpak/ng-pr-merge
