import { expect } from 'chai';
import * as fs from 'fs';
import {
    ActivityBar,
    By,
    CustomTreeItem,
    Key,
    SideBarView,
    StatusBar,
    ViewControl,
    ViewSection,
    VSBrowser,
    WebElement,
    WebviewView,
    Workbench
} from 'vscode-extension-tester';
import {
    PUBLISHING_INPUT_DEFAULT_PATTERN,
    PUBLISHING_NO_PREVIOUS_VERSION,
    PUBLISHING_NO_PREVIOUS_VERSION_TEXT,
    PUBLISHING_PREVIOUS_VERSION_LABEL,
    STATUS_BAR_PUBLISH_MESSAGE
} from '../common/constants/publishing.constants';
import { EnvironmentWebviewFields } from '../common/models/environment.model';
import { PublishingFields } from '../common/models/publishing.model';
import { delay } from '../utils/common.utils';
import {
    DISABLED_ATTRIBUTE,
    INVALID_ATTRIBUTE,
    PATTERN_ATTRIBUTE,
    REQUIRED_ATTRIBUTE
} from './constants/attribute.constants';
import { LOCAL_SERVER_FULL_URL, TEST_PAT_TOKEN } from './constants/environment.constants';
import {
    CONFIG_FILE_1,
    CONFIG_FILE_2,
    CONFIG_FILE_3,
    PUBLISH_NOTIFICATION_MESSAGE
} from './constants/publishing.constants';
import {
    DOCUMENTS_SECTION,
    EXTENSION_NAME,
    PACKAGE_ID_NAME,
    PACKAGE_ID_RELEASE_NAME,
    PACKAGE_ID_VERSIONS_NAME,
    PLUGIN_SECTIONS,
    RELEASE_VERSION_PATTERN,
    VERSION_1,
    VERSION_2,
    VERSION_3,
    VERSION_LABEL
} from './constants/test.constants';
import { CONFIG_FILE_1_PATH, PETS_NAME, WORKSPACE_1_PATH } from './constants/tree.constants';
import { LabelData } from './models/label.model';
import { BUTTON_LOCATOR, SINGLE_SELECT_LOCATOR, TEXT_FIELD_LOCATOR } from './models/webview.model';
import { deleteFile } from './utils/explorer.utils';
import { clickCheckbox } from './utils/tree.utils';
import {
    clearTextField,
    clickOption,
    closeSelect,
    expandAll,
    findAsync,
    findWebElementById,
    getFieldLabels,
    getPatternMismatch,
    getSingleSelectOptions,
    getTexts,
    getTextValue,
    getWebView,
    openSelect,
    Until
} from './utils/webview.utils';

const LABELS_DATA: LabelData[] = [
    { label: 'Package Id:', required: true },
    { label: 'Version:', required: true },
    { label: 'Status:', required: true },
    { label: 'Labels:', required: false },
    { label: PUBLISHING_PREVIOUS_VERSION_LABEL, required: true }
];

const DRAFT = 'Draft';
const RELEASE = 'Release';
const ARCHIVED = 'Archived';

const RELEASE_VERSION = '2025.1';
const NONE_RELEASE_VERSION = 'none-release-version';
const BROKEN_VERSION = 'broken-version!%#';

const LABEL_NAME = 'label';
const LABEL_LONG_NAME = 'Loooooooooooooooooooooooooooong';
const LABEL_SHORT_NAME = 'S';

describe('Publishing Tests', () => {
    let viewControl: ViewControl | undefined;
    let sideBar: SideBarView | undefined;
    let sections: ViewSection[] | undefined;
    let webview: WebviewView | undefined;
    let packageIdField: WebElement | undefined;
    let versionField: WebElement | undefined;
    let statusField: WebElement | undefined;
    let labelsField: WebElement | undefined;
    let previousReleaseVersion: WebElement | undefined;
    let publishingButton: WebElement | undefined;

    before(async () => {
        await setupTestEnvironment();
    });

    after(async () => {
        await cleanupTestEnvironment();
    });

    describe('Publishing Fields', function () {
        before(async () => {
            await setupPublishingFields();
        });

        after(async () => {
            await webview?.switchBack();
        });

        it('Check labels required', async () => {
            await validateLabelsRequired();
        });

        it('Check disabled fields if package Id is empty', async () => {
            await validateDisabledFieldsWhenPackageIdEmpty();
        });

        it('Check "Previous Version" set default value', async function () {
            await validatePreviousVersionDefaultValue();
        });
    });

    describe('Publishing and Environment integration', function () {
        let urlField: WebElement | undefined;
        let tokenField: WebElement | undefined;
        let testConnectionButton: WebElement | undefined;

        describe('PackageId tests', function () {
            afterEach(async () => {
                await switchAndCleanEnvironmentFields();
                await switchAndCleanPublishingFields();

                await delay(2000);
            });

            it('Check required empty Environment fields if PackageId is fill', async function () {
                await switchToPublishing();

                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await delay(2000);

                await switchToEnvironments();

                const isUrlFieldInvalid = await urlField?.getAttribute(REQUIRED_ATTRIBUTE);
                expect(isUrlFieldInvalid).to.equal('true');

                const isTokenFieldInvalid = await tokenField?.getAttribute(REQUIRED_ATTRIBUTE);
                expect(isTokenFieldInvalid).to.equal('true');
            });

            it('Check available all fields if PackageId is correct', async function () {
                await switchToEnvironments();

                await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
                await tokenField?.sendKeys(TEST_PAT_TOKEN);

                await switchToPublishing();

                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await delay(2000);

                const isPackageIdFieldNoInvalid = await packageIdField
                    ?.getDriver()
                    .wait(async () => Until.getAttribute(packageIdField, INVALID_ATTRIBUTE, 'false'), 5000);
                expect(isPackageIdFieldNoInvalid).to.equal('false');

                await checkDependentFieldsAreDisabled(false);
            });

            it('Check invalid packageId field if none exist PackageId', async function () {
                await switchToEnvironments();

                await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
                await tokenField?.sendKeys(TEST_PAT_TOKEN);

                await switchToPublishing();

                await packageIdField?.sendKeys('noneExistPackageId');

                const isPackageIdFieldInvalid = await packageIdField
                    ?.getDriver()
                    .wait(async () => Until.getAttribute(packageIdField, INVALID_ATTRIBUTE, 'true'), 5000);
                expect(isPackageIdFieldInvalid).to.equal('true');

                await checkDependentFieldsAreDisabled(true);
            });

            it('Check load PackageId after click test connection', async function () {
                await switchToPublishing();

                await packageIdField?.sendKeys(PACKAGE_ID_NAME);
                await checkDependentFieldsAreDisabled(true);

                await switchToEnvironments();

                await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
                await tokenField?.sendKeys(TEST_PAT_TOKEN);

                await testConnectionButton?.click();

                await switchToPublishing();

                const isPackageIdFieldInvalid = await packageIdField
                    ?.getDriver()
                    .wait(async () => Until.getAttribute(packageIdField, INVALID_ATTRIBUTE, 'false'), 5000);
                expect(isPackageIdFieldInvalid).to.equal('false');

                await checkDependentFieldsAreDisabled(false);
            });
        });

        describe('Publishing e2e preparation', function () {
            before(async function () {
                await switchToEnvironments();

                await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
                await tokenField?.sendKeys(TEST_PAT_TOKEN);

                await switchToPublishing();
            });

            afterEach(async () => {
                await cleanPublishingFields();
                await delay(1000);
            });

            it('Check Status Options', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await delay(2000);
                await openSelect(statusField);
                const options = await getSingleSelectOptions(statusField);
                const optionTexts = await Promise.all(options.map(async (option) => await option.getText()));

                expect(optionTexts).deep.equals([DRAFT, RELEASE, ARCHIVED]);
                await closeSelect(statusField);
            });

            it('Check changes in the Draft status pattern and validation', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await delay(2000);

                await clickOption(statusField, DRAFT);
                const statusPattern = await versionField?.getAttribute(PATTERN_ATTRIBUTE);
                expect(PUBLISHING_INPUT_DEFAULT_PATTERN).to.equals(statusPattern);

                await versionField?.sendKeys(RELEASE_VERSION);
                let isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;
                await clearTextField(versionField);

                await versionField?.sendKeys(NONE_RELEASE_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;
                await clearTextField(versionField);

                await versionField?.sendKeys(BROKEN_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;
                await clearTextField(versionField);
            });

            it('Check changes in the Release status pattern and validation', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await delay(2000);

                await clickOption(statusField, RELEASE);
                await delay(1000);
                const statusPattern = await versionField?.getAttribute(PATTERN_ATTRIBUTE);
                expect(RELEASE_VERSION_PATTERN).to.equals(statusPattern);

                await versionField?.sendKeys(RELEASE_VERSION);
                let isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;
                await clearTextField(versionField);

                await versionField?.sendKeys(NONE_RELEASE_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;
                await clearTextField(versionField);

                await versionField?.sendKeys(BROKEN_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;
                await clearTextField(versionField);
            });

            it('Check changes in the Archived status pattern and validation', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await delay(2000);

                await clickOption(statusField, ARCHIVED);
                await delay(1000);
                const statusPattern = await versionField?.getAttribute(PATTERN_ATTRIBUTE);
                expect(PUBLISHING_INPUT_DEFAULT_PATTERN).to.equals(statusPattern);

                await versionField?.sendKeys(RELEASE_VERSION);
                let isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;
                await clearTextField(versionField);

                await versionField?.sendKeys(NONE_RELEASE_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;
                await clearTextField(versionField);

                await versionField?.sendKeys(BROKEN_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;
                await clearTextField(versionField);
            });

            it('Check create some Labels be Enter and delete', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await delay(2000);

                await labelsField?.sendKeys(LABEL_NAME, Key.ENTER);
                await labelsField?.sendKeys(LABEL_LONG_NAME, Key.ENTER);
                await labelsField?.sendKeys(LABEL_SHORT_NAME, Key.ENTER);

                await delay(1000);

                let labels = await getLabels();
                let labelNames: string[] = await getTexts(labels);
                expect(labelNames).to.be.an('array').with.lengthOf(3);
                expect(labelNames).deep.equals([LABEL_NAME, LABEL_LONG_NAME, LABEL_SHORT_NAME]);

                await deleteLabel(labels[1]);
                await delay(500);
                labels = await getLabels();
                labelNames = await getTexts(labels);
                expect(labelNames).deep.equals([LABEL_NAME, LABEL_SHORT_NAME]);

                await deleteLabel(labels[1]);
                await delay(500);
                labels = await getLabels();
                labelNames = await getTexts(labels);
                expect(labelNames).deep.equals([LABEL_NAME]);

                await deleteLabel(labels[0]);
                await delay(500);
                labels = await getLabels();
                expect(labels).to.be.empty;
            });

            it('Check create Labels using focusout', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await delay(2000);

                await labelsField?.sendKeys(LABEL_NAME);
                await labelsField?.sendKeys(Key.TAB);

                await delay(1000);

                const labelFieldValue = await labelsField?.getText();
                expect(labelFieldValue).to.be.empty;

                await delay(1000);

                let labels = await getLabels();
                const labelNames = await getTexts(labels);
                expect(labelNames).to.be.an('array').with.lengthOf(1);
                expect(labelNames[0]).to.be.equals(LABEL_NAME);

                await deleteLabel(labels[0]);
                await delay(500);
                labels = await getLabels();
                expect(labels).to.be.empty;
            });

            it('Check load label from version', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await delay(2000);

                await versionField?.sendKeys(VERSION_2);

                await delay(2000);

                let labels = await getLabels();
                const labelNames = await getTexts(labels);
                expect(labelNames).to.be.an('array').with.lengthOf(1);
                expect(labelNames[0]).to.be.equals(VERSION_LABEL);

                await deleteLabel(labels[0]);
                await delay(500);
                labels = await getLabels();
                expect(labels).to.be.empty;
            });

            it('Check "Previous Version" has default value', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_VERSIONS_NAME);

                await delay(2000);

                await openSelect(previousReleaseVersion);

                const options = await getSingleSelectOptions(previousReleaseVersion);
                const optionTexts = await Promise.all(options.map(async (option) => await option.getText()));

                expect(optionTexts).deep.equals([PUBLISHING_NO_PREVIOUS_VERSION, VERSION_2, VERSION_1]);

                await options[0]?.click();

                const value = await previousReleaseVersion?.getAttribute('value');
                expect(value).is.equals(PUBLISHING_NO_PREVIOUS_VERSION);
            });

            it('Check load "Previous Version" from package', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await delay(2000);

                await openSelect(previousReleaseVersion);

                const options = await getSingleSelectOptions(previousReleaseVersion);
                const optionTexts = await Promise.all(options.map(async (option) => await option.getText()));

                expect(optionTexts).deep.equals([PUBLISHING_NO_PREVIOUS_VERSION, VERSION_2, VERSION_1]);

                await options[2]?.click();
                const value = await previousReleaseVersion?.getAttribute('value');
                expect(value).is.equals(VERSION_1);
            });

            it('Check "Previous Version" cannot select a non-existent version', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await delay(2000);

                await clickOption(previousReleaseVersion, PUBLISHING_NO_PREVIOUS_VERSION);
                await previousReleaseVersion?.sendKeys('non-existentVersion');
                await previousReleaseVersion?.sendKeys(Key.TAB + Key.TAB);

                const value = await previousReleaseVersion?.getAttribute('value');
                expect(value).is.equals(PUBLISHING_NO_PREVIOUS_VERSION);
            });

            describe('Publishing', function () {
                let statusBar: StatusBar;

                before(async function () {
                    await webview?.switchBack();
                    await VSBrowser.instance.openResources(WORKSPACE_1_PATH);
                    await prepareSections();
                    statusBar = new StatusBar();
                    await switchToPublishing();
                });

                afterEach(async function () {
                    deleteConfigFile();
                    await delay(500);
                });

                it('Check Success Publishing: Status bar, Notification, Config File', async function () {
                    await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                    await delay(2000);

                    await versionField?.sendKeys(VERSION_3);
                    await clickOption(statusField, DRAFT);

                    await labelsField?.sendKeys('Publish-test' + Key.ENTER);
                    await clickOption(previousReleaseVersion, VERSION_2);

                    await publishingButton?.click();

                    await delay(500);
                    await webview?.switchBack();

                    const statusBarText = await statusBar.getText();
                    expect(statusBarText).includes(STATUS_BAR_PUBLISH_MESSAGE);

                    await delay(2000);

                    const notifications = await new Workbench().getNotifications();
                    const notificationsText = await notifications[0].getText();
                    expect(notificationsText).is.equals(PUBLISH_NOTIFICATION_MESSAGE);

                    expect(fs.existsSync(CONFIG_FILE_1_PATH)).to.be.true;
                    const configFileContent = fs.readFileSync(CONFIG_FILE_1_PATH, 'utf-8');

                    expect(configFileContent).is.equals(CONFIG_FILE_1);

                    await webview?.switchToFrame();
                });

                it('Check re-creation Config File after Success Publishing', async function () {
                    await delay(1000);
                    fs.writeFileSync(CONFIG_FILE_1_PATH, CONFIG_FILE_2, 'utf8');
                    await delay(1000);

                    await clearTextField(packageIdField);
                    await packageIdField?.sendKeys(PACKAGE_ID_RELEASE_NAME);
                    await webview?.switchBack();

                    await expandAll(sections);
                    const treeSection = await sideBar?.getContent().getSection(DOCUMENTS_SECTION);
                    const items: CustomTreeItem[] = ((await treeSection?.getVisibleItems()) as CustomTreeItem[]) ?? [];
                    const item = await findAsync(items, async (item) => (await item.getLabel()) === PETS_NAME);
                    await VSBrowser.instance.driver.executeScript(
                        `document.querySelectorAll('.monaco-hover').forEach(el => el.remove())`
                    );
                    await clickCheckbox(item);

                    await switchToPublishing();
                    await findPublishingFields();

                    await versionField?.sendKeys(VERSION_3);
                    await clickOption(statusField, RELEASE);

                    await labelsField?.sendKeys('Publish-release-test' + Key.ENTER);

                    await clickOption(previousReleaseVersion, PUBLISHING_NO_PREVIOUS_VERSION);

                    await publishingButton?.click();
                    await delay(3000);

                    expect(fs.existsSync(CONFIG_FILE_1_PATH)).to.be.true;
                    const configFileContent = fs.readFileSync(CONFIG_FILE_1_PATH, 'utf-8');

                    expect(configFileContent).is.equals(CONFIG_FILE_3);

                    await delay(500);
                });
            });
        });

        const findEnvironmentFields = async (): Promise<void> => {
            const textFields = (await webview?.findWebElements(TEXT_FIELD_LOCATOR)) ?? [];
            urlField = await findWebElementById(textFields, EnvironmentWebviewFields.URL);
            tokenField = await findWebElementById(textFields, EnvironmentWebviewFields.TOKEN);
            testConnectionButton = await webview?.findWebElement(By.css('a'));
        };

        const switchAndCleanPublishingFields = async (): Promise<void> => {
            await switchToPublishing();

            await cleanPublishingFields();

            await webview?.switchBack();
        };

        const switchAndCleanEnvironmentFields = async (): Promise<void> => {
            await switchToEnvironments();

            await clearTextField(urlField);
            await clearTextField(tokenField);

            await webview?.switchBack();
        };

        const switchTo = async (section: PLUGIN_SECTIONS): Promise<void> => {
            await webview?.switchBack();
            await expandAll(sections ?? []);
            await switchToFrame(section);
            await delay(1000);
        };

        const switchToEnvironments = async (): Promise<void> => {
            await switchTo(PLUGIN_SECTIONS.ENVIRONMENT);
            await findEnvironmentFields();
        };

        const switchToPublishing = async (): Promise<void> => {
            await switchTo(PLUGIN_SECTIONS.PUBLISH);
            await findPublishingFields();
        };
    });

    const findPublishingFields = async (): Promise<void> => {
        const textFields = (await webview?.findWebElements(TEXT_FIELD_LOCATOR)) ?? [];
        const selectFields = (await webview?.findWebElements(SINGLE_SELECT_LOCATOR)) ?? [];
        const buttons = (await webview?.findWebElements(BUTTON_LOCATOR)) ?? [];
        packageIdField = await findWebElementById(textFields, PublishingFields.PACKAGE_ID);
        versionField = await findWebElementById(textFields, PublishingFields.VERSION);
        statusField = await findWebElementById(selectFields, PublishingFields.STATUS);
        labelsField = await findWebElementById(textFields, PublishingFields.LABELS);
        previousReleaseVersion = await findWebElementById(selectFields, PublishingFields.PREVIOUS_VERSION);
        publishingButton = await findWebElementById(buttons, PublishingFields.PUBLISHING_BUTTON);
    };

    const deleteLabel = async (label: WebElement): Promise<void> => {
        await label.click();
    };

    const getLabels = async (): Promise<WebElement[]> => {
        let labelPlaceholder;
        try {
            labelPlaceholder = await webview?.findWebElement(By.id('publishing-labels-placeholder'));
        } catch {
            return [];
        }
        return (await labelPlaceholder?.findElements(BUTTON_LOCATOR)) ?? [];
    };

    const checkDependentFieldsAreDisabled = async (isDisabled: boolean): Promise<void> => {
        const list: (string | null)[] = isDisabled ? ['true'] : ['false', null];

        const isVersionFieldDisabled = await versionField?.getAttribute(DISABLED_ATTRIBUTE);
        expect(isVersionFieldDisabled).to.be.oneOf(list);

        const isStatusFieldDisabled = await statusField?.getAttribute(DISABLED_ATTRIBUTE);
        expect(isStatusFieldDisabled).to.be.oneOf(list);

        const isLabelsFieldDisabled = await labelsField?.getAttribute(DISABLED_ATTRIBUTE);
        expect(isLabelsFieldDisabled).to.be.oneOf(list);

        const isPreviousReleaseVersionDisabled = await previousReleaseVersion?.getAttribute(DISABLED_ATTRIBUTE);
        expect(isPreviousReleaseVersionDisabled).to.be.oneOf(list);
    };

    const prepareSections = async (): Promise<void> => {
        viewControl = await new ActivityBar().getViewControl(EXTENSION_NAME);
        sideBar = await viewControl?.openView();
        sections = await sideBar?.getContent().getSections();
    };

    const cleanPublishingFields = async (): Promise<void> => {
        const fieldsToClear = [
            { field: previousReleaseVersion, name: 'previousReleaseVersion' },
            { field: versionField, name: 'versionField' },
            { field: packageIdField, name: 'packageIdField' }
        ];

        for (const { field } of fieldsToClear) {
            try {
                await clearTextField(field);
            } catch {}
        }

        try {
            const labels = await getLabels();
            for (const label of labels) {
                await deleteLabel(label);
            }
        } catch {}

        try {
            await clickOption(statusField, DRAFT);
        } catch {}
    };

    const deleteConfigFile = (): void => {
        try {
            deleteFile(CONFIG_FILE_1_PATH);
        } catch (error) {
            console.warn('Error deleting config file:', error);
        }
    };

    const switchToFrame = async (section: PLUGIN_SECTIONS): Promise<void> => {
        webview = await getWebView(sideBar, section);
        await webview?.switchToFrame();
    };

    const validateLabelsRequired = async (): Promise<void> => {
        try {
            const vsLabels = (await webview?.findWebElements(By.css('vscode-label'))) ?? [];
            const labels: LabelData[] = await getFieldLabels(vsLabels);
            expect(labels).to.deep.equal(LABELS_DATA);
        } catch (error) {
            console.error('Error in Check labels required test:', error);
            throw error;
        }
    };

    const setupTestEnvironment = async (): Promise<void> => {
        try {
            await prepareSections();
            await switchToFrame(PLUGIN_SECTIONS.PUBLISH);
            await findPublishingFields();
        } catch (error) {
            console.error('Error during setup in before hook:', error);
            throw error;
        } finally {
            await webview?.switchBack();
            deleteConfigFile();
        }
    };

    const cleanupTestEnvironment = async (): Promise<void> => {
        try {
            await webview?.switchBack();
            await switchToFrame(PLUGIN_SECTIONS.PUBLISH);
            await findPublishingFields();
            await cleanPublishingFields();
        } catch (error) {
            console.error('Error during cleanup in after hook:', error);
        } finally {
            await webview?.switchBack();
            deleteConfigFile();
            await expandAll(sections ?? []);
        }
    };

    const setupPublishingFields = async (): Promise<void> => {
        try {
            await switchToFrame(PLUGIN_SECTIONS.PUBLISH);
            await findPublishingFields();
            await clearTextField(packageIdField);
        } catch (error) {
            console.error('Error in Publishing Fields before hook:', error);
            throw error;
        }
    };

    const validateDisabledFieldsWhenPackageIdEmpty = async (): Promise<void> => {
        try {
            const isPackageIdFieldDisabled = await packageIdField?.getAttribute(DISABLED_ATTRIBUTE);
            expect(isPackageIdFieldDisabled).to.be.oneOf([false, null]);

            await delay(500);

            await checkDependentFieldsAreDisabled(true);
        } catch (error) {
            console.error('Error in Check disabled fields test:', error);
            throw error;
        }
    };

    const validatePreviousVersionDefaultValue = async (): Promise<void> => {
        try {
            const previousReleaseVersionValue = await getTextValue(previousReleaseVersion);
            expect(previousReleaseVersionValue).is.equals(PUBLISHING_NO_PREVIOUS_VERSION_TEXT);
        } catch (error) {
            console.error('Error in Check "Previous Version" test:', error);
            throw error;
        }
    };
});
