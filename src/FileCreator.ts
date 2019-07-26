import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CSharpFileType } from './Models';

const findParentDir = require('find-parent-dir');
const findUpGlob = require('find-up-glob');

export class FileCreator {
    private static NAMESPACE_SEPARATOR = '.';
    private static CLASS_TEMPLATE_STRING = '${classname}';
    private static CURSOR_TEMPLATE_STRING = '${cursor}';
    private static NAMESPACE_TEMPLATE_STRING = '${namespace}';
    private static ROOT_NAMESPACE_OPENING_XML_TAG = '<RootNamespace>';
    private static ROOT_NAMESPACE_CLOSING_XML_TAG = '</RootNamespace>';

    /**
     * Create a new file, optionally at the path specified
     * @param fileType  Controls configuration of the InputBox that appears for new file creation
     * @param filePath  Path to create file at if creating in directory beneath root. Use relative path (do not include root folder in path) (Optional)
     */
    public static CreateNewFile(fileType: CSharpFileType, filePath?: string): any {
        let opts: vscode.InputBoxOptions = { 
            ignoreFocusOut: true,
            validateInput: FileCreator.validateFilename
        };

        if (fileType === undefined || fileType === null) {
            return;
        }

        const extension = vscode.extensions.getExtension('bamblack.csharp-helper') as vscode.Extension<any>;
        let templatePath: string = '';
        switch (fileType) {
            case CSharpFileType.Class:
                Object.assign(opts, { 
                    placeHolder: 'Class name', 
                    prompt: 'Please enter a name for your class'
                });

                templatePath = `${extension.extensionPath}/templates/Class.tmpl`;

                if (filePath !== undefined) {
                    opts.value = path.join(filePath, 'Class.cs');
                    opts.valueSelection = [opts.value.lastIndexOf(path.sep), opts.value.length];
                } else {
                    opts.value = 'Class.cs';
                    opts.valueSelection = [0, 5];
                }

                break;
            case CSharpFileType.Interface:
                Object.assign(opts, { 
                    placeHolder: 'Interface name', 
                    prompt: 'Please enter a name for your interface'
                });

                templatePath = `${extension.extensionPath}/templates/Interface.tmpl`;

                if (filePath !== undefined) {
                    opts.value = path.join(filePath, 'IInterface.cs');
                    opts.valueSelection = [opts.value.lastIndexOf(path.sep), opts.value.length];
                } else {
                    opts.value = 'IInterface.cs';
                    opts.valueSelection = [0, 10];
                }
                break;
            default: break;
        }

        FileCreator.promptAndSave(opts, templatePath);
            
    }

    /**
     * Get the vscode.Selection object that will set the position of our cursor in the document after openeing it
     * @param text 
     */
    private static getCursorPosition(text: string): vscode.Selection {
        const cursorTemplatePos = text.indexOf(FileCreator.CURSOR_TEMPLATE_STRING);
        const preCursor = text.substr(0, cursorTemplatePos);

        // should never be null unless our template is bad
        const lineNum = (preCursor.match(/\n/gi) as RegExpMatchArray).length;
        const charNum = preCursor.substr(preCursor.lastIndexOf('\n')).length;
        const cursorPos = new vscode.Position(lineNum, charNum);
        return new vscode.Selection(cursorPos, cursorPos);

    }

    /**
     * Determine the namespace that should be used for the file
     * @param filepath  Absolute filepath of document being saved
     * @returns 
     */
    private static getNamespace(filepath: string): string | null {
        const fileDir = path.dirname(filepath);

        // find our projectRootFile's path, use it to determine the projects root directory
        // we'll use that directory as the project's rootnamepsace
        try {
            let projectRootFilePathFind: string[] = findUpGlob.sync('project.json', { cwd: fileDir });
            if (projectRootFilePathFind === null) {
                projectRootFilePathFind = findUpGlob.sync('*.csproj', { cwd: fileDir });
            }
            const projectRootFilePath = projectRootFilePathFind[0];

            const projectRootDir = path.dirname(projectRootFilePath);
            const projectRootFileType = path.extname(projectRootFilePath);
            let rootNamespace = null;
            // TODO: read projectRootFilePath file to determine if it has
            //      - defaultNamespace (for project.json)
            //      - RootNamespace (for csproj)
            
            const projectRootFileContents = fs.readFileSync(projectRootFilePath, { encoding: 'utf8' });
            if (projectRootFileType === '.json') {
                const projectJson = JSON.parse(projectRootFileContents);
                try {
                    rootNamespace = projectJson.tooling.defaultNamespace;
                } catch {
                    // do nothing, it's not defined   
                }
            } else if (projectRootFileType === '.csproj') {
                const rootNamespacePos = projectRootFileContents.indexOf(FileCreator.ROOT_NAMESPACE_OPENING_XML_TAG);
                if (rootNamespacePos > -1) {
                    const rootNamespaceStart = rootNamespacePos + FileCreator.ROOT_NAMESPACE_OPENING_XML_TAG.length;
                    const rootNamespaceEnd = projectRootFileContents.indexOf(FileCreator.ROOT_NAMESPACE_CLOSING_XML_TAG);
                    rootNamespace = projectRootFileContents.substr(rootNamespaceStart, rootNamespaceEnd - rootNamespaceStart);
                }
            }

            // if no defaultNamespace/RootNamespace was found, just use the projectRootDir folder name
            if (rootNamespace === null || rootNamespace === undefined) {
                rootNamespace = projectRootDir.substr(projectRootDir.lastIndexOf(path.sep) + 1);
            }

            // //Users/ben/projectRoot/Something2/Something3/Test.cs ends up with Something2/Something3
            // //Users/ben/projectRoot/Test.cs ends up with blank
            let trailingNamespace = filepath.replace(`${projectRootDir}${path.sep}`, '');
            trailingNamespace = trailingNamespace.substr(0, trailingNamespace.lastIndexOf(path.sep));

            let fileNamespace = '';
            if (trailingNamespace !== '') {
                fileNamespace = `${rootNamespace}${FileCreator.NAMESPACE_SEPARATOR}${trailingNamespace.replace(path.sep, FileCreator.NAMESPACE_SEPARATOR)}`;
            } else {
                fileNamespace = rootNamespace;
            }

            return fileNamespace;
        } catch (ex) {
            vscode.window.showErrorMessage(ex);
            return null;
        }
    }

    /**
     * Open an InputBox for the filename and upon submission of the InputBox save it to a new file
     * @param options 
     */
    private static promptAndSave(options: vscode.InputBoxOptions, templatePath: string): void {
        // only run the command if we have folders open
        if (vscode.workspace.workspaceFolders === undefined) { 
            vscode.window.showErrorMessage('A folder must be opened within the workspace to run this command!');
            return; 
        }

        // prompt for filename
        vscode.window.showInputBox(options).then((filename: string | undefined) => {
            if (filename === undefined) { return; }

            const __rootPath = (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[])[0].uri.fsPath;
            const filepath = path.join(__rootPath, filename);

            if (fs.existsSync(filepath)) {
                vscode.window.showErrorMessage(`${filepath} already exists!`);
                return;
            }

            const namespace = FileCreator.getNamespace(filepath);
            const className = filepath.slice(filepath.lastIndexOf(path.sep) + 1, filepath.lastIndexOf('.'));

            if (namespace === null) {
                vscode.window.showErrorMessage('Unable to determine namespace');
                return;
            }

            // open the specified template file and edit it
            vscode.workspace.openTextDocument(templatePath).then((template: vscode.TextDocument) => {
                let text = template.getText();
                text = text.replace(FileCreator.NAMESPACE_TEMPLATE_STRING, namespace);
                text = text.replace(FileCreator.CLASS_TEMPLATE_STRING, className);
                
                // TODO: determine cursor position
                const cursorPosition = FileCreator.getCursorPosition(text);
                text = text.replace(FileCreator.CURSOR_TEMPLATE_STRING, '');
                fs.writeFileSync(filepath, text);

                // save the edited template
                vscode.workspace.openTextDocument(filepath).then((document: vscode.TextDocument) => {
                    // display the file
                    vscode.window.showTextDocument(document).then((editor: vscode.TextEditor) => {
                        editor.selection = cursorPosition;
                    });
                });
            });
        });
    }
    
    /**
     * Validate that the fi
     * @param filename 
     */
    private static validateFilename(filename: string | undefined): string | undefined {
        if (typeof filename === 'undefined' || filename === '') {
            return 'You must type something';
        }

        // order matters for these next two checks
        // might need to be expanded to more than just '.cs'
        if (!filename.endsWith('.cs')) {
            return 'Filename must end in a calid csharp file extension';
        }

        // if it's only '.cs'
        if (filename.length === 3) {
            return 'You must provide a filename';
        }

        return undefined;
    }
}