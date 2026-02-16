import * as vscode from "vscode";
import { initializeWorkspace } from "../workspace/workspaceInitializer";
import { ExerciseTreeProvider } from "../views/sidebarTreeProvider";
import * as logger from "../util/logger";

export function registerImportBookCommand(
  _context: vscode.ExtensionContext,
  treeProvider: ExerciseTreeProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand("learncode.importBook", async () => {
    try {
      // Pick EPUB file
      const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { "EPUB Files": ["epub"] },
        title: "Select an EPUB Programming Book",
      });

      if (!fileUris || fileUris.length === 0) return;
      const epubPath = fileUris[0].fsPath;

      // Pick or create sandbox directory
      const config = vscode.workspace.getConfiguration("learncode");
      const defaultLocation = config.get<string>("defaultSandboxLocation");

      const folderUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: defaultLocation
          ? vscode.Uri.file(defaultLocation)
          : undefined,
        title: "Select Sandbox Directory (exercises will be created here)",
      });

      if (!folderUris || folderUris.length === 0) return;
      const sandboxDir = folderUris[0].fsPath;

      // Run the pipeline
      logger.info(`Importing ${epubPath} into ${sandboxDir}`);
      const result = await initializeWorkspace(epubPath, sandboxDir);

      // Show success message
      const message = `Imported ${result.chapterCount} chapters with ${result.exerciseCount} exercises.`;
      const action = await vscode.window.showInformationMessage(
        message,
        "Open Workspace",
        "OK",
      );

      if (action === "Open Workspace") {
        const uri = vscode.Uri.file(result.sandboxDir);
        await vscode.commands.executeCommand("vscode.openFolder", uri);
      } else {
        // Try to load in current workspace
        await treeProvider.loadWorkspace(result.sandboxDir);
      }
    } catch (err) {
      logger.error("Import failed", err);
      vscode.window.showErrorMessage(
        `LearnCode: Import failed — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
}
