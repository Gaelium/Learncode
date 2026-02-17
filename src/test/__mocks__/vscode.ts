export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  label: string | undefined;
  collapsibleState: TreeItemCollapsibleState;
  iconPath?: any;
  command?: any;
  contextValue?: string;
  description?: string;
  tooltip?: string;

  constructor(label: string, collapsibleState = TreeItemCollapsibleState.None) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
}

export class EventEmitter {
  private listeners: Function[] = [];
  event = (listener: Function) => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };
  fire(data?: any) {
    this.listeners.forEach(l => l(data));
  }
  dispose() {
    this.listeners = [];
  }
}

export const Uri = {
  file: (path: string) => ({ scheme: 'file', fsPath: path, path, toString: () => `file://${path}` }),
  parse: (str: string) => ({ scheme: 'file', fsPath: str, path: str, toString: () => str }),
  joinPath: (base: any, ...parts: string[]) => {
    const joined = [base.path, ...parts].join('/');
    return Uri.file(joined);
  },
};

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}

export enum ProgressLocation {
  Notification = 15,
  SourceControl = 1,
  Window = 10,
}

export const window = {
  createOutputChannel: () => ({
    appendLine: () => {},
    show: () => {},
    dispose: () => {},
  }),
  showInformationMessage: async (..._args: any[]) => undefined,
  showWarningMessage: async (..._args: any[]) => undefined,
  showErrorMessage: async (..._args: any[]) => undefined,
  showOpenDialog: async () => undefined,
  showInputBox: async () => undefined,
  showQuickPick: async () => undefined,
  createWebviewPanel: () => ({
    webview: { html: '', onDidReceiveMessage: () => ({ dispose: () => {} }) },
    onDidDispose: () => ({ dispose: () => {} }),
    reveal: () => {},
    dispose: () => {},
  }),
  withProgress: async (_options: any, task: Function) => task({ report: () => {} }),
};

export const commands = {
  registerCommand: (_cmd: string, _handler: Function) => ({ dispose: () => {} }),
  executeCommand: async () => {},
};

export const workspace = {
  workspaceFolders: undefined as any,
  getConfiguration: () => ({
    get: (_key: string, defaultValue?: any) => defaultValue,
    update: async () => {},
  }),
  onDidChangeConfiguration: () => ({ dispose: () => {} }),
  fs: {
    readFile: async () => new Uint8Array(),
    writeFile: async () => {},
  },
};

export const env = {
  clipboard: { writeText: async () => {} },
  openExternal: async () => false,
};
