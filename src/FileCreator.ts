import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CSharpFileType } from './Models';

const findUpGlob = require('find-up-glob');

export class FileCreator {
    private readonly helper: FileCreatorHelper = new FileCreatorHelper();

    /**
     * 
     * @param args 
     */
    public CreateNewClass(args: any): void {
        this.createNewFile(args, CSharpFileType.Class);
    }

    /**
     * 
     * @param args 
     */
    public CreateNewInterface(args: any): void {
        this.createNewFile(args, CSharpFileType.Interface);
    }

    /**
     * Create a new file, optionally at the path specified
     * @param args
     * @param fileType  Controls configuration of the InputBox that appears for new file creation
     */
    private createNewFile(args: any, fileType: CSharpFileType): void {
        let opts: vscode.InputBoxOptions = { 
            ignoreFocusOut: true,
            validateInput: this.helper.validateFilename
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

                if (args !== null && args !== undefined) {
                    // get the project root path and then remove it from args._fsPath so it displays a relative path for the pre-filled in value
                    const projectRootPath = this.helper.getRelativePathFromArgsFolderPath(args._fsPath);
                    const relativePath = args._fsPath.replace(`${projectRootPath}${path.sep}`, '');

                    opts.value = path.join(relativePath, 'Class.cs');
                    opts.valueSelection = [opts.value.lastIndexOf(path.sep) + 1, opts.value.length - 3];
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

                if (args !== null && args !== undefined) {
                    // get the project root path and then remove it from args._fsPath so it displays a relative path for the pre-filled in value
                    const projectRootPath = this.helper.getRelativePathFromArgsFolderPath(args._fsPath);
                    const relativePath = args._fsPath.replace(`${projectRootPath}${path.sep}`, '');

                    opts.value = path.join(relativePath, 'IInterface.cs');
                    opts.valueSelection = [opts.value.lastIndexOf(path.sep) + 1, opts.value.length - 3];
                } else {
                    opts.value = 'IInterface.cs';
                    opts.valueSelection = [0, 10];
                }
                break;
            default: break;
        }

        this.promptAndSave(opts, templatePath); 
    }

    /**
     * Open an InputBox for the filename and upon submission of the InputBox save it to a new file
     * @param options 
     */
    private promptAndSave(options: vscode.InputBoxOptions, templatePath: string): void {
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

            const namespace = this.helper.getNamespace(filepath);
            const className = filepath.slice(filepath.lastIndexOf(path.sep) + 1, filepath.lastIndexOf('.'));

            if (namespace === null) {
                vscode.window.showErrorMessage('Unable to determine namespace');
                return;
            }

            // open the specified template file and edit it
            vscode.workspace.openTextDocument(templatePath).then((template: vscode.TextDocument) => {
                let text = template.getText();
                text = text.replace(FileCreatorHelper.NAMESPACE_TEMPLATE_STRING, namespace);
                text = text.replace(FileCreatorHelper.CLASS_TEMPLATE_STRING, className);
                
                // TODO: determine cursor position
                const cursorPosition = this.helper.getCursorPosition(text);
                text = text.replace(FileCreatorHelper.CURSOR_TEMPLATE_STRING, '');
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
}

class FileCreatorHelper {
    static NAMESPACE_SEPARATOR = '.';
    static CLASS_TEMPLATE_STRING = '${classname}';
    static CURSOR_TEMPLATE_STRING = '${cursor}';
    static NAMESPACE_TEMPLATE_STRING = '${namespace}';
    static ROOT_NAMESPACE_OPENING_XML_TAG = '<RootNamespace>';
    static ROOT_NAMESPACE_CLOSING_XML_TAG = '</RootNamespace>';

    /**
     * 
     * @param folderPath 
     */
    public getRelativePathFromArgsFolderPath(folderPath: string): string {
        const projectRootDirectoryDetails = this._getProjectRootDirectoryDetails(folderPath);
        return projectRootDirectoryDetails.directory;
    }

    /**
     * Get the vscode.Selection object that will set the position of our cursor in the document after openeing it
     * @param text 
     */
    public getCursorPosition(text: string): vscode.Selection {
        const cursorTemplatePos = text.indexOf(FileCreatorHelper.CURSOR_TEMPLATE_STRING);
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
    public getNamespace(filepath: string): string | null {
        const fileDir = path.dirname(filepath);

        // find our projectRootFile's path, use it to determine the projects root directory
        // we'll use that directory as the project's rootnamepsace
        try {
            const projectRootDirectoryDetails = this._getProjectRootDirectoryDetails(fileDir);
            const projectRootFileType = path.extname(projectRootDirectoryDetails.projectFile);
            let rootNamespace = null;
            // TODO: read projectRootFilePath file to determine if it has
            //      - defaultNamespace (for project.json)
            //      - RootNamespace (for csproj)
            
            const projectRootFileContents = fs.readFileSync(projectRootDirectoryDetails.projectFile, { encoding: 'utf8' });
            if (projectRootFileType === '.json') {
                const projectJson = JSON.parse(projectRootFileContents);
                try {
                    rootNamespace = projectJson.tooling.defaultNamespace;
                } catch {
                    // do nothing, it's not defined   
                }
            } else if (projectRootFileType === '.csproj') {
                const rootNamespacePos = projectRootFileContents.indexOf(FileCreatorHelper.ROOT_NAMESPACE_OPENING_XML_TAG);
                if (rootNamespacePos > -1) {
                    const rootNamespaceStart = rootNamespacePos + FileCreatorHelper.ROOT_NAMESPACE_OPENING_XML_TAG.length;
                    const rootNamespaceEnd = projectRootFileContents.indexOf(FileCreatorHelper.ROOT_NAMESPACE_CLOSING_XML_TAG);
                    rootNamespace = projectRootFileContents.substr(rootNamespaceStart, rootNamespaceEnd - rootNamespaceStart);
                }
            }

            // if no defaultNamespace/RootNamespace was found, just use the projectRootDir folder name
            if (rootNamespace === null || rootNamespace === undefined) {
                rootNamespace = projectRootDirectoryDetails.directory.substr(projectRootDirectoryDetails.directory.lastIndexOf(path.sep) + 1);
            }

            // //Users/ben/projectRoot/Something2/Something3/Test.cs ends up with Something2/Something3
            // //Users/ben/projectRoot/Test.cs ends up with blank
            let trailingNamespace = filepath.replace(`${projectRootDirectoryDetails.directory}${path.sep}`, '');
            trailingNamespace = trailingNamespace.substr(0, trailingNamespace.lastIndexOf(path.sep));

            let fileNamespace = '';
            if (trailingNamespace !== '') {
                fileNamespace = `${rootNamespace}${FileCreatorHelper.NAMESPACE_SEPARATOR}${trailingNamespace.replace(path.sep, FileCreatorHelper.NAMESPACE_SEPARATOR)}`;
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
     * Validate that the fi
     * @param filename 
     */
    public validateFilename(filename: string | undefined): string | undefined {
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



    /**
     * 
     * @param dir 
     */
    private _getProjectRootDirectoryDetails(dir: string): IProjectRootDirectoryDetails {
        let projectRootFilePathFind: string[] = findUpGlob.sync('project.json', { cwd: dir });
        if (projectRootFilePathFind === null) {
            projectRootFilePathFind = findUpGlob.sync('*.csproj', { cwd: dir });
        }
        const projectRootFilePath = projectRootFilePathFind[0];

        return {
            directory: path.dirname(projectRootFilePath),
            projectFile: projectRootFilePath
        };
    }
}

interface IProjectRootDirectoryDetails {
    directory: string;
    projectFile: string;
}