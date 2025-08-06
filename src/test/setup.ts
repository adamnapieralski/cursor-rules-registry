// Use mock-require to stub the `vscode` module so unit-test files that
// `import vscode` don't blow up in a plain Node environment.
// No VS Code API is needed for our pure-logic tests, an empty object suffices.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('mock-require');

mock('vscode', {
  window: {
    createOutputChannel: () => ({
      appendLine: () => {},
      append: () => {},
      dispose: () => {},
      show: () => {},
    }),
    showErrorMessage: () => {},
    showInformationMessage: () => {},
  },
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, defaultVal?: any) => defaultVal,
    }),
    workspaceFolders: [{ uri: { fsPath: process.cwd() } }],
  },
}); 