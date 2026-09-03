import fs from 'fs';
import { Uri } from 'vscode';
import { RESOURCES_PATH, TEMPLATE_PATH } from '../common/constants/common.constants';

export const getHtmlContent = (filePath: string, data: Record<string, string | Uri>): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, content) => {
            if (err) {
                reject(err);
            }
            const filledContent = content.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] as string);
            resolve(filledContent);
        });
    });
};

export const getNonce = (): string => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

export const getElements = (extensionUri: Uri): Uri => {
    return Uri.joinPath(extensionUri, 'dist', 'bundled.js');
};

export const getJsScript = (extensionUri: Uri, jsName: string): Uri => {
    return Uri.joinPath(extensionUri, RESOURCES_PATH, 'template', 'js', jsName);
};

export const getStyle = (extensionUri: Uri): Uri => {
    return Uri.joinPath(extensionUri, RESOURCES_PATH, TEMPLATE_PATH, 'css', 'main.css');
};

export const getCodicon = (extensionUri: Uri): Uri => {
    return Uri.joinPath(extensionUri, 'dist', 'codicon.css');
};
