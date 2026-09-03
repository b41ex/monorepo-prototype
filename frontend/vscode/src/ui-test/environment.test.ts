import { expect } from 'chai';
import { ActivityBar, By, SideBarView, ViewControl, VSBrowser, WebElement, WebviewView } from 'vscode-extension-tester';
import { EnvironmentWebviewFields } from '../common/models/environment.model';
import { INVALID_ATTRIBUTE, NAME_ATTRIBUTE } from './constants/attribute.constants';
import {
    LOCAL_SERVER_FULL_URL,
    TEST_BROKEN_PAT_TOKEN,
    TEST_LOADING_PAT_TOKEN,
    TEST_PAT_TOKEN
} from './constants/environment.constants';
import { EXTENSION_NAME, PLUGIN_SECTIONS } from './constants/test.constants';
import { WORKSPACE_EMPTY_PATH } from './constants/tree.constants';
import { LabelData } from './models/label.model';
import { TEXT_FIELD_LOCATOR } from './models/webview.model';
import { clearTextField, findWebElementById, getFieldLabels, getWebView, Until } from './utils/webview.utils';

const LABELS_DATA: LabelData[] = [
    { label: 'APIHUB URL:', required: true },
    { label: 'Authentication Token:', required: true }
];

describe('Environment Webview', () => {
    let webview: WebviewView | undefined;
    let urlField: WebElement | undefined;
    let tokenField: WebElement | undefined;
    let testConnectionButton: WebElement | undefined;

    before(async () => {
        await setupEnvironment();
    });

    after(async () => {
        await webview?.switchBack();
    });

    afterEach(async () => {
        await clearFields();
    });

    const setupEnvironment = async (): Promise<void> => {
        await VSBrowser.instance.openResources(WORKSPACE_EMPTY_PATH);
        const viewControl: ViewControl | undefined = await new ActivityBar().getViewControl(EXTENSION_NAME);
        const sideBar: SideBarView | undefined = await viewControl?.openView();
        webview = await getWebView(sideBar, PLUGIN_SECTIONS.ENVIRONMENT);
        await webview?.switchToFrame();

        const textFields = await webview?.findWebElements(TEXT_FIELD_LOCATOR) ?? [];
        urlField = await findWebElementById(textFields, EnvironmentWebviewFields.URL);
        tokenField = await findWebElementById(textFields, EnvironmentWebviewFields.TOKEN);
        testConnectionButton = await webview?.findWebElement(By.css('a'));
    };

    const clearFields = async (): Promise<void> => {
        await clearTextField(urlField);
        await clearTextField(tokenField);
    };

    const fillFields = async (url: string, token: string): Promise<void> => {
        await urlField?.sendKeys(url);
        await tokenField?.sendKeys(token);
    };

    const validateTestConnectionIcon = async (expectedIcon: string): Promise<void> => {
        const icons = await webview?.findWebElements(By.css('vscode-icon')) ?? [];
        const testConnectionIcon = await findWebElementById(icons, EnvironmentWebviewFields.TEST_CONNECTION_ICON);

        const testConnectionIconType = await testConnectionIcon
            ?.getDriver()
            .wait(() => Until.getAttribute(testConnectionIcon, NAME_ATTRIBUTE, expectedIcon), 5000);

        expect(testConnectionIconType).to.equal(expectedIcon);
    };

    it('Check labels required', async () => {
        const vsLabels = await webview?.findWebElements(By.css('vscode-label')) ?? [];
        const labels: LabelData[] = await getFieldLabels(vsLabels);
        expect(labels).to.deep.equal(LABELS_DATA);
    });

    it('Check all field exist', async () => {
        expect(urlField).is.not.undefined;
        expect(tokenField).is.not.undefined;
        expect(testConnectionButton).is.not.undefined;
    });

    it('Check password button', async () => {
        await tokenField?.sendKeys(TEST_PAT_TOKEN);
        let type = await tokenField?.getAttribute('type');
        expect(type).is.equal('password');

        const icons = await webview?.findWebElements(By.css('vscode-icon')) ?? [];
        const eyeButton = await findWebElementById(icons, 'eye-icon');
        await eyeButton?.click();

        type = await tokenField?.getAttribute('type');
        expect(type).is.equal('text');
    });

    describe('Test connection', function () {
        it('Check loading icon after click test', async function () {
            await fillFields(LOCAL_SERVER_FULL_URL, TEST_LOADING_PAT_TOKEN);
            await testConnectionButton?.click();
            await validateTestConnectionIcon('loading');
            await validateTestConnectionIcon('check');
        });

        it('Check successful icon after click test', async function () {
            await fillFields(LOCAL_SERVER_FULL_URL, TEST_PAT_TOKEN);
            await testConnectionButton?.click();
            await validateTestConnectionIcon('check');
        });

        it('Check failed icon after click test', async function () {
            await fillFields(LOCAL_SERVER_FULL_URL, TEST_BROKEN_PAT_TOKEN);
            await testConnectionButton?.click();
            await validateTestConnectionIcon('close');
        });

        it('Check url field error after click test', async function () {
            await fillFields('broken_url', TEST_PAT_TOKEN);
            await testConnectionButton?.click();

            const isUrlFieldInvalid = await urlField
                ?.getDriver()
                .wait(() => Until.getAttribute(urlField, INVALID_ATTRIBUTE, 'true'), 5000);
            const isTokenFieldInvalid = await tokenField?.getAttribute(INVALID_ATTRIBUTE);

            expect(isUrlFieldInvalid).to.equal('true');
            expect(isTokenFieldInvalid).to.equal('false');
        });

        it('Check Token field error after click test', async function () {
            await fillFields(LOCAL_SERVER_FULL_URL, TEST_BROKEN_PAT_TOKEN);
            await testConnectionButton?.click();

            const isTokenFieldInvalid = await tokenField
                ?.getDriver()
                .wait(() => Until.getAttribute(tokenField, INVALID_ATTRIBUTE, 'true'), 5000);
            const isUrlFieldInvalid = await urlField?.getAttribute(INVALID_ATTRIBUTE);

            expect(isUrlFieldInvalid).to.equal('false');
            expect(isTokenFieldInvalid).to.equal('true');
        });
    });
});