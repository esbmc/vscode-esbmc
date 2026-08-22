import { ExtensionContext, Uri, window, workspace } from 'vscode'
import { EXAMPLE_FILE, EXAMPLE_PATH } from './examplePath'

async function exists (uri: Uri): Promise<boolean> {
  try {
    await workspace.fs.stat(uri)
    return true
  } catch {
    return false
  }
}

/**
 * Opens the bundled example. It is copied out of the extension directory
 * first: the walkthrough asks the user to edit it, and edits there would be
 * lost on the next extension update.
 */
export async function openExample (context: ExtensionContext): Promise<void> {
  const source = Uri.joinPath(context.extensionUri, ...EXAMPLE_PATH)
  const target = Uri.joinPath(context.globalStorageUri, EXAMPLE_FILE)
  try {
    if (!await exists(target)) {
      await workspace.fs.createDirectory(context.globalStorageUri)
      await workspace.fs.copy(source, target)
    }
    await window.showTextDocument(await workspace.openTextDocument(target))
  } catch (error) {
    window.showErrorMessage(`ESBMC: could not open ${EXAMPLE_FILE} (${String(error)})`)
  }
}
