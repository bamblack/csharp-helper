import * as vscode from 'vscode';
import { IActionProvider, CSharpFileType } from '../Models';
import { FileCreator } from '../FileCreator';

export class CommandPaletteActionProvider implements IActionProvider {
    /**
     * Register the actions available in the command palette.
     */    
    public RegisterActions(): void {
        var creator = new FileCreator();

        vscode.commands.registerCommand("csharpHelper.createNewClass", creator.CreateNewClass.bind(creator));
        vscode.commands.registerCommand("csharpHelper.createNewInterface", creator.CreateNewInterface.bind(creator));
    }
}