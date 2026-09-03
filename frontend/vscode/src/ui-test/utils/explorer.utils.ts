import * as fs from 'fs';
import { ActivityBar, SideBarView, ViewSection } from 'vscode-extension-tester';
import { delay } from '../../utils/common.utils';


export const openExplorer = async (): Promise<ViewSection> => {
    const activityBar = new ActivityBar();
    const explorer = await activityBar.getViewControl('Explorer');
    await explorer?.openView();
    const sideBar = new SideBarView();
    const section = await sideBar.getContent().getSections();
    return section[0];
};

export const openFileFromExplorer = async (fileName: string): Promise<void> => {
    const section = await openExplorer();
    await delay(1000);
    const item = await section.findItem(fileName);
    await delay(1000);
    await item?.click();
    await delay(1000);
};

export const deleteFile = (path: string): void => {
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
    }
};
