import { By, CustomTreeItem, CustomTreeSection, WebElement } from 'vscode-extension-tester';
import { TestTreeItem } from '../models/tree.model';

const getCheckbox = async (item: CustomTreeItem | undefined): Promise<WebElement | undefined> => {
    return item?.findElement(By.className('custom-view-tree-node-item-checkbox'));
};

export const getCheckboxState = async (item: CustomTreeItem | undefined): Promise<boolean> => {
    const checkbox = await getCheckbox(item);
    return (await checkbox?.getAttribute('aria-checked')) === 'true';
};

export const clickCheckbox = async (item: CustomTreeItem | undefined): Promise<void> => {
    const checkbox = await getCheckbox(item);
    return checkbox?.click();
};

export const selectCheckbox = async (item: CustomTreeItem | undefined): Promise<void> => {
    const state = await getCheckboxState(item);
    if(state){
        return;
    }
    const checkbox = await getCheckbox(item);
    return checkbox?.click();
};

export const checkItemCheckboxes = async (treeSection: CustomTreeSection | undefined): Promise<TestTreeItem[]> => {
    const items: CustomTreeItem[] = ((await treeSection?.getVisibleItems()) as CustomTreeItem[]) ?? [];
    return getTestTreeItems(items);
};

export const getTestTreeItems = async (items: CustomTreeItem[]): Promise<TestTreeItem[]> =>
    Promise.all(
        items.map(async (item) => {
            const checkbox = await getCheckboxState(item);
            let description = '';
            try {
                description = await item.getDescription();
            } catch {}
            const label = await item.getLabel();
            return {
                checkbox,
                description,
                label
            } as TestTreeItem;
        })
    );
