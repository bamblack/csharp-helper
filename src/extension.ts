import * as vscode from 'vscode';
import { CommandPaletteActionProvider } from './ActionProviders/CommandPaletteActionProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.debug('csharp-helper :: loading');

	const commandPaletteActionProvider = new CommandPaletteActionProvider();
	commandPaletteActionProvider.RegisterActions();

	console.debug('csharp-helper :: loaded');
}

// this method is called when your extension is deactivated
export function deactivate() {}
