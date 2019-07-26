import * as vscode from 'vscode';

export interface IActionProvider {
    RegisterActions(): void;
}

export enum CSharpFileType {
    Class = 0,
    Interface = 1
}
