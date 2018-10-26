// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as path from 'path';
import { ITerminalProvider } from '@microsoft/node-core-library';
import * as TSLint from 'tslint';

import {
  CmdRunner,
  IBaseCmdTaskOptions
} from './BaseCmdTask';
import { Constants } from './Constants';
import { ToolPaths } from './ToolPaths';
import { RushStackCompilerTask } from './RushStackCompilerTask';

export type WriteFileIssueFunction = (
  filePath: string,
  line: number,
  column: number,
  errorCode: string,
  message: string
) => void;

/**
 * @public
 */
export interface ITslintCmdTaskConfig extends IBaseCmdTaskOptions {
  fileError: WriteFileIssueFunction;
  fileWarning: WriteFileIssueFunction;

  /**
   * If true, displays warnings as errors. Defaults to false.
   */
  displayAsError?: boolean;
}

/**
 * @beta
 */
export class TslintCmdTask extends RushStackCompilerTask<ITslintCmdTaskConfig> {
  private _cmdRunner: CmdRunner<ITslintCmdTaskConfig>;

  constructor(taskOptions: ITslintCmdTaskConfig, constants: Constants, terminalProvider: ITerminalProvider) {
    super(taskOptions, constants, terminalProvider);
    this._cmdRunner = new CmdRunner(
      this._constants,
      this._terminal,
      {
        packagePath: ToolPaths.tslintPackagePath,
        packageJson: ToolPaths.tslintPackageJson,
        packageBinPath: path.join('bin', 'tslint'),
        taskOptions
      }
    );
  }

  public invoke(): Promise<void> {
    if (this._customFormatterSpecified) {
      this._terminal.writeVerboseLine(
        'A custom formatter has been specified in customArgs, so the default TSLint error logging ' +
        'has been disabled.'
      );
    }

    const args: string[] = this._taskOptions.customArgs || [];

    if (!this._customFormatterSpecified) {
      // IFF no custom formatter options are specified by the rig/consumer, use the JSON formatter and
      // log errors using the GCB API
      args.push(...[
        '--format', 'json'
      ]);
    }

    args.push(...[
      '--project', this._constants.srcFolderPath
    ]);

    return this._cmdRunner.runCmd({
      args: args,
      onData: (data: Buffer) => {
        if (!this._customFormatterSpecified) {
          const dataStr: string = data.toString().trim();
          const tslintErrorLogFn: (
            filePath: string,
            line: number,
            column: number,
            errorCode: string,
            message: string
          ) => void = this._taskOptions.displayAsError
            ? this._taskOptions.fileError
            : this._taskOptions.fileWarning;

          // TSLint errors are logged to stdout
          try {
            const errors: TSLint.IRuleFailureJson[] = JSON.parse(dataStr);
            for (const error of errors) {
              const pathFromRoot: string = path.relative(this._constants.projectFolderPath, error.name);
              tslintErrorLogFn(
                pathFromRoot,
                error.startPosition.line + 1,
                error.startPosition.character + 1,
                error.ruleName,
                error.failure
              );
            }
          } catch (e) {
            // If we fail to parse the JSON, it's likely TSLint encountered an error parsing the config file,
            // or it experienced an inner error. In this case, log the output as an error regardless of the
            // displayAsError value
            this._terminal.writeErrorLine(dataStr);
          }
        }
      },
      onClose: (code: number, hasErrors: boolean, resolve: () => void, reject: (error: Error) => void) => {
        if (this._taskOptions.displayAsError && (code !== 0 || hasErrors)) {
          reject(new Error(`exited with code ${code}`));
        } else {
          resolve();
        }
      }
    });
  }

  private get _customFormatterSpecified(): boolean {
    const customArgs: string[] = this._taskOptions.customArgs || [];
    return (
      customArgs.indexOf('--formatters-dir') !== -1 ||
      customArgs.indexOf('-s') !== -1 || // Shorthand for "--formatters-dir"
      customArgs.indexOf('--format') !== -1 ||
      customArgs.indexOf('-t') !== -1 // Shorthand for "--format"
    );
  }
}
