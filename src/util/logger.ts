import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('LearnCode');
  }
  return outputChannel;
}

export function initLogger(): void {
  getChannel();
}

export function info(message: string): void {
  getChannel().appendLine(`[INFO] ${message}`);
}

export function warn(message: string): void {
  getChannel().appendLine(`[WARN] ${message}`);
}

export function error(message: string, err?: unknown): void {
  const errMsg = err instanceof Error ? err.message : String(err ?? '');
  getChannel().appendLine(`[ERROR] ${message}${errMsg ? ': ' + errMsg : ''}`);
}

export function debug(message: string): void {
  getChannel().appendLine(`[DEBUG] ${message}`);
}

export function show(): void {
  getChannel().show(true);
}

export function dispose(): void {
  outputChannel?.dispose();
  outputChannel = undefined;
}
