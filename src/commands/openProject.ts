import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

interface KnownProject {
  path: string;
  title: string;
  format: "epub" | "pdf";
}

const KNOWN_PROJECTS_KEY = "learncode.knownProjects";

export function registerProject(
  context: vscode.ExtensionContext,
  projectPath: string,
  title: string,
  format: "epub" | "pdf",
): void {
  const projects = context.globalState.get<KnownProject[]>(KNOWN_PROJECTS_KEY, []);
  const idx = projects.findIndex((p) => p.path === projectPath);
  const entry: KnownProject = { path: projectPath, title, format };
  if (idx >= 0) {
    projects[idx] = entry;
  } else {
    projects.push(entry);
  }
  context.globalState.update(KNOWN_PROJECTS_KEY, projects);
}

export function registerOpenProjectCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand("learncode.openProject", async () => {
    const projects = context.globalState.get<KnownProject[]>(KNOWN_PROJECTS_KEY, []);

    if (projects.length === 0) {
      const action = await vscode.window.showInformationMessage(
        "No known LearnCode projects. Import a book first, or browse for an existing project folder.",
        "Browse for Folder...",
      );
      if (action === "Browse for Folder...") {
        await browseAndOpen();
      }
      return;
    }

    interface ProjectQuickPickItem extends vscode.QuickPickItem {
      projectPath?: string;
    }

    const items: ProjectQuickPickItem[] = projects.map((p) => ({
      label: p.title,
      description: p.format.toUpperCase(),
      detail: p.path,
      projectPath: p.path,
    }));

    items.push({
      label: "$(folder) Browse for folder...",
      detail: "Open an existing LearnCode project from disk",
      alwaysShow: true,
    });

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a LearnCode project to open",
    });

    if (!picked) return;

    if (!picked.projectPath) {
      await browseAndOpen();
      return;
    }

    const uri = vscode.Uri.file(picked.projectPath);
    await vscode.commands.executeCommand("vscode.openFolder", uri);
  });
}

async function browseAndOpen(): Promise<void> {
  const folderUris = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    title: "Select a LearnCode project folder",
    openLabel: "Open Project",
  });

  if (!folderUris || folderUris.length === 0) return;

  const folderPath = folderUris[0].fsPath;
  const learncodeDir = path.join(folderPath, ".learncode");

  try {
    await fs.promises.access(learncodeDir);
  } catch {
    vscode.window.showWarningMessage(
      "That folder does not contain a .learncode directory. Please select a valid LearnCode project.",
    );
    return;
  }

  const uri = vscode.Uri.file(folderPath);
  await vscode.commands.executeCommand("vscode.openFolder", uri);
}
