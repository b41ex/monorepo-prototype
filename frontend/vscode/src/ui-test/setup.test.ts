import { By, VSBrowser, ViewControl } from 'vscode-extension-tester';

const waitForWorkbench = async (): Promise<void> => {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        try {
            await driver.findElement(By.css('.monaco-workbench'));
            return true;
        } catch {
            return false;
        }
    }, 10000);
};

const dismissOverlay = async (): Promise<void> => {
    try {
        const driver = VSBrowser.instance.driver;
        await driver.executeScript(`
            const overlay = document.querySelector('.onboarding-a-overlay');
            if (overlay) { overlay.remove(); }
        `);
    } catch {
        // ignore
    }
};

const originalOpenResources = VSBrowser.prototype.openResources;
VSBrowser.prototype.openResources = async function (...resources: string[]) {
    await originalOpenResources.apply(this, resources);
    await waitForWorkbench();
    await dismissOverlay();
};

const originalOpenView = ViewControl.prototype.openView;
ViewControl.prototype.openView = async function () {
    await dismissOverlay();
    return originalOpenView.call(this);
};
