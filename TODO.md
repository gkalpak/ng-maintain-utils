# TODO

Things I want to (but won't necessarily) do:


## ng-maintain-utils

>- Add `ng-backport` to 'README.md'.
?- Improve `DiffHighlighter`: More accurate highlighting with newlines
   (e.g. refined highlighting in line-diff or empty newline highlighting in word-diff).
   See also https://github.com/Microsoft/vscode/blob/a549c5c45/src/vs/base/common/diff/diff.ts


## ng-cla-check


## ng-backport

// @ECHO off ^&^& FOR ^/F %%s in ('git rev-parse HEAD') DO (@ECHO on ^&^& ECHO. ^&^& ECHO   Cherry-picking SHA: %%s ^&^& ECHO. ^&^& ECHO ---------------------------------------------------------------- ^&^& ECHO. ^&^&
// git checkout $1 ^&^& git pull --rebase origin $1 ^&^& git cherry-pick %%s ^&^& git diff origin/$1 ^&^& (git log ^|^| true) ^&^& ECHO. ^&^& ECHO ---------------------------------------------------------- ^&^& ECHO. ^&^& ECHO   ^^^>^^^>^^^>  (Don't forget to manually push the changes.^^)  ^^^<^^^<^^^<)
// git checkout $2 ^&^& git pull --rebase origin $2 ^&^& git cherry-pick $1  ^&^& git diff origin/$2 ^&^& (git log ^|^| true) ^&^& ECHO. ^&^& ECHO ---------------------------------------------------------- ^&^& ECHO. ^&^& ECHO   ^^^>^^^>^^^>  (Don't forget to manually push the changes.)  ^^^<^^^<^^^<

- feat(Backporter): ...


## ng-pr-merge

>- Integrate with `ng-backport`.


## ng-maintain

>- Integrate with `ng-backport`.
