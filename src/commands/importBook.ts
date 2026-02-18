import * as vscode from "vscode";
import * as path from "path";
import { unzipEpub } from "../epub/unzipper";
import { parseOpf } from "../epub/opfParser";
import { initializeWorkspace, initializeWorkspacePdf } from "../workspace/workspaceInitializer";
import { parsePdfMetadata } from "../pdf/index";
import { ExerciseTreeProvider } from "../views/sidebarTreeProvider";
import { registerProject } from "./openProject";
import * as logger from "../util/logger";

export function registerImportBookCommand(
  context: vscode.ExtensionContext,
  _treeProvider: ExerciseTreeProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand("learncode.importBook", async () => {
    try {
      // Step 1: Pick book file (EPUB or PDF)
      const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { "Book Files": ["epub", "pdf"] },
        title: "Select a Book (EPUB or PDF)",
      });

      if (!fileUris || fileUris.length === 0) return;
      const bookPath = fileUris[0].fsPath;
      const ext = path.extname(bookPath).toLowerCase();
      const isPdf = ext === '.pdf';

      // Step 2: Quick-parse metadata so we can show the book title
      let bookTitle = "your book";
      try {
        if (isPdf) {
          const meta = await parsePdfMetadata(bookPath);
          bookTitle = meta.title || bookTitle;
        } else {
          const { zip, opfPath } = await unzipEpub(bookPath);
          const { metadata } = await parseOpf(zip, opfPath);
          bookTitle = metadata.title || bookTitle;
        }
      } catch {
        // Non-fatal — we'll still import, just with a generic title
      }

      // Step 3: Pick workspace directory with a clear, contextual prompt
      const config = vscode.workspace.getConfiguration("learncode");
      const defaultLocation = config.get<string>("defaultSandboxLocation");
      const bookDir = path.dirname(bookPath);

      const folderUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: defaultLocation
          ? vscode.Uri.file(defaultLocation)
          : vscode.Uri.file(bookDir),
        title: `Choose a folder for the "${bookTitle}" exercise workspace`,
        openLabel: "Create Workspace Here",
      });

      if (!folderUris || folderUris.length === 0) return;
      const sandboxDir = folderUris[0].fsPath;

      // Step 4: Run the import pipeline
      logger.info(`Importing ${bookPath} into ${sandboxDir}`);
      const result = isPdf
        ? await initializeWorkspacePdf(bookPath, sandboxDir)
        : await initializeWorkspace(bookPath, sandboxDir);

      // Step 5: Register in project list & auto-open the workspace
      const format = isPdf ? "pdf" as const : "epub" as const;
      registerProject(context, result.sandboxDir, bookTitle, format);
      vscode.window.showInformationMessage(
        `Imported "${bookTitle}" — ${result.chapterCount} chapters, ${result.exerciseCount} exercises.`,
      );
      const uri = vscode.Uri.file(result.sandboxDir);
      await vscode.commands.executeCommand("vscode.openFolder", uri);
    } catch (err) {
      logger.error("Import failed", err);
      vscode.window.showErrorMessage(
        `LearnCode: Import failed — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
}
