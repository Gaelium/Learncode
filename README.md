# LearnCode

Import EPUB and PDF programming books into VS Code, extract code exercises, and learn interactively with a built-in book reader, text annotations, exercise sandboxes, and progress tracking.

## Getting Started

### 1. Import a Book

Open the Command Palette (`Cmd+Shift+P`) and run **LearnCode: Import Book**.

1. **Select your book** — a file picker opens filtered to `.epub` and `.pdf` files
2. **Choose a workspace folder** — the dialog shows the book's title and defaults to the book's directory. Click "Create Workspace Here" to confirm.
3. **Wait for import** — a progress notification shows each pipeline stage (parsing, structure mapping, code detection, exercise assembly, sandbox generation)
4. **Workspace opens automatically** — VS Code opens the new workspace with the exercise sidebar populated

### 2. The Exercise Sidebar

Once a workspace is loaded, the **LearnCode** panel appears in the Activity Bar (left side). It shows a tree of all chapters from the book, each expandable to reveal the exercises found inside.

**Chapter nodes** display a completion percentage (e.g. `72%`). **Exercise nodes** show the detected language and a status icon:

| Icon | Status |
|------|--------|
| Empty circle | Not started |
| Play circle | In progress |
| Checkmark | Completed |

**Clicking an exercise** opens its main file in the editor. If the exercise was `not_started`, it automatically moves to `in_progress`.

### 3. The Book Reader

Right-click any chapter in the sidebar and choose **Open Book Reader**, or run the command from the palette. The reader opens in a side panel next to your code.

**Navigation:**
- **Previous / Next buttons** at the top and bottom of each page
- **Arrow keys**: Left/Right or PageUp/PageDown to move between pages
- **Internal links** work — clicking a cross-reference (e.g. "see Figure 7.3") navigates to the correct page and scrolls to the target
- **External links** (URLs, DOIs) open in your system browser

**Rendering:**
- LaTeX math is rendered via KaTeX (both inline `$...$` and display `$$...$$` notation)
- Code blocks are styled as monospace with VS Code theme colors, even when the EPUB uses non-standard markup (e.g. Springer's `<div>` based code formatting)
- Images are displayed inline

**PDF support:**
- PDF books are rendered page-by-page on a canvas
- Navigate with Previous/Next buttons or enter a page number directly
- Code blocks are extracted from the PDF text content during import

### 4. Text Annotations

Select any text in the book reader to add a highlight and note. A prompt appears to enter your annotation text.

- **Add an annotation**: select text in the reader → enter a note when prompted
- **View all annotations**: run **LearnCode: View All Annotations** from the Command Palette to see all your highlights and notes across the book
- Annotations are persisted in `.learncode/annotations.json` and survive reloads

## Switching Between Projects

After importing multiple books, use **LearnCode: Open Project** to switch between them without navigating the filesystem manually.

- Open the Command Palette (`Cmd+Shift+P`) and run **LearnCode: Open Project**
- A QuickPick list shows all previously imported books with their title and format
- Select a project to open its workspace folder in VS Code
- Choose **Browse for folder...** to open an existing LearnCode project from disk

The project list is maintained automatically — every book you import and every LearnCode workspace you open is remembered across sessions. The folder-opened icon in the Exercises panel title bar provides quick access.

## Creating Worksheets

LearnCode isn't limited to auto-detected exercises. You can create custom worksheets for any topic.

### From the sidebar

Right-click a chapter and choose **New Worksheet**.

### From the title bar

Click the **+** button at the top of the Exercises panel. You'll be asked which chapter to add it to.

### Worksheet flow

1. **Pick a template type:**
   - Coding Exercise (Python, JavaScript, Rust, Go, or C/C++)
   - SQL / Database
   - Markdown Notes
   - Blank
2. **Enter a title** (e.g. "2D Rotation Matrix", "SELECT Queries")
3. The extension creates the exercise directory with starter files, adds it to `template.yaml`, and opens the main file

Worksheets persist across reloads and work with all the same features as auto-detected exercises (reset, mark complete, progress tracking).

## Exercise Management

### Mark Complete

Click the checkmark icon on any exercise row in the sidebar, or run **LearnCode: Mark Exercise Complete** from the context menu. The chapter's completion percentage updates immediately.

### Reset Exercise

Right-click an exercise and choose **Reset Exercise**. A confirmation dialog appears since this overwrites your changes. The exercise files are restored to their original template content and the status resets to `not_started`.

### Regenerate All Sandboxes

If exercise files get corrupted or deleted, run **LearnCode: Create Sandbox from Template** from the Command Palette. This regenerates all exercise directories from `template.yaml` without re-importing the book.

## Supported Languages

Auto-detected code blocks and worksheet templates support:

| Language | Main File | Run Command |
|----------|-----------|-------------|
| Python | `main.py` | `python main.py` |
| JavaScript | `index.js` | `node index.js` |
| TypeScript | `index.ts` | (uses JS template) |
| Rust | `src/main.rs` | `cargo run` |
| Go | `main.go` | `go run main.go` |
| C / C++ | `main.c` / `main.cpp` | (compile and run) |

Non-code worksheet types:

| Template | File Created | Starter Content |
|----------|-------------|-----------------|
| SQL / Database | `query.sql` | Comment with title |
| Markdown Notes | `notes.md` | Heading with title |
| Blank | `worksheet.txt` | Empty file |

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `learncode.defaultSandboxLocation` | string | `""` | Default directory for creating exercise workspaces. When set, the folder picker defaults to this location instead of the book's directory. |
| `learncode.autoOpenExercise` | boolean | `true` | Automatically open the exercise file when clicking in the sidebar. |

## Workspace Structure

After importing a book, the workspace contains:

```
my-book-workspace/
  .learncode/
    template.yaml        # Chapter/exercise definitions (the source of truth)
    progress.json        # Your completion status, timestamps, reset counts
    spine.json           # Book page order for the reader
    metadata.json        # Book title, author, language
    annotations.json     # Text annotations and highlights
    book/                # Extracted book content (HTML + images for EPUB, or text for PDF)
  ch01-introduction/
    ch01-ex01-hello-world/
      main.py            # Exercise starter code
      INSTRUCTIONS.md    # Exercise description
      .expected_output   # Expected output (if detected)
  ch02-data-structures/
    ch02-ex01-linked-list/
      ...
  shared/                # Shared files across exercises
```

## Commands Reference

| Command | Description | Available From |
|---------|-------------|----------------|
| LearnCode: Import Book | Import an EPUB or PDF book and create a workspace | Command Palette |
| LearnCode: Open Project | Switch to a previously imported book workspace | Title bar icon, Command Palette |
| LearnCode: New Worksheet | Create a custom exercise in a chapter | `+` button, chapter context menu, Command Palette |
| LearnCode: Open Exercise | Open an exercise's main file | Clicking an exercise in the sidebar |
| LearnCode: Reset Exercise | Restore exercise to original content | Exercise context menu |
| LearnCode: Mark Exercise Complete | Set exercise status to completed | Exercise inline button, context menu |
| LearnCode: Open Book Reader | Open the book reader panel (EPUB or PDF) | Chapter context menu, Command Palette |
| LearnCode: View All Annotations | View all text annotations and highlights | Command Palette |
| LearnCode: Refresh Exercise Tree | Reload the sidebar tree | Refresh button in title bar |
| LearnCode: Create Sandbox from Template | Regenerate all exercise files | Command Palette |

## How It Works

### Import Pipeline

**EPUB:**

1. **Parse EPUB** — unzips the file, reads the OPF manifest, navigation document (EPUB3 nav or NCX fallback), and extracts all content files and images
2. **Map structure** — builds a chapter/section hierarchy from the table of contents. Books organized with "Parts" (e.g. "Part I: Foundations") are handled automatically, with chapters promoted from under their Part groupings. Non-content entries (Cover, Front Matter, Back Matter) are filtered out.
3. **Detect code blocks** — scans each chapter's HTML for code: `<pre>` elements, standalone `<code>` blocks, publisher-specific markup (Springer `div.ProgramCode`, generic `programlisting`/`sourcecode` classes), and Python REPL patterns (`>>>`)
4. **Classify blocks** — categorizes each code block as an exercise, example, incremental step, output, or configuration
5. **Assemble exercises** — groups related code blocks into exercises with instructions, expected output, and bookmarks back to the source chapter
6. **Generate template** — writes `template.yaml` with the full chapter/exercise structure
7. **Create sandboxes** — generates exercise directories with starter files based on detected language
8. **Store book content** — saves EPUB HTML and images for the book reader

**PDF:**

1. **Parse outline** — extracts the PDF table of contents / bookmark tree to build chapter structure
2. **Extract text per page** — reads each page's text content
3. **Detect code blocks** — identifies code blocks from the plain text using indentation, language keywords, and formatting patterns
4. Steps 4–7 are the same as the EPUB pipeline (classify, assemble, generate template, create sandboxes)
5. **Store book content** — saves the original PDF for the canvas-based reader

### Progress Tracking

Progress is stored in `.learncode/progress.json` with per-exercise status, timestamps, and reset counts. Writes are atomic (temp file + rename) to prevent corruption. Progress survives exercise resets — the `resetCount` field tracks how many times you've started over.
