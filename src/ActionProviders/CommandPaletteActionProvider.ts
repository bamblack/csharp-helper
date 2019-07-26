import * as vscode from 'vscode';
import { IActionProvider, CSharpFileType } from '../Models';
import { FileCreator } from '../FileCreator';

export class CommandPaletteActionProvider implements IActionProvider {
    /**
     * Register the actions available in the command palette.
     */    
    public RegisterActions(): void {
        vscode.commands.registerCommand("csharpHelper.createNewClass", FileCreator.CreateNewFile.bind(null, CSharpFileType.Class));
        vscode.commands.registerCommand("csharpHelper.createNewInterface", FileCreator.CreateNewFile.bind(null, CSharpFileType.Interface));
    }
}