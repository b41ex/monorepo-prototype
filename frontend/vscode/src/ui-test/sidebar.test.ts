import { expect } from 'chai';
import { ActivityBar, SideBarView, ViewControl, ViewSection } from 'vscode-extension-tester';
import { DOCUMENTS_SECTION, ENVIRONMENT_SECTION, EXTENSION_NAME, PUBLISH_SECTION } from './constants/test.constants';

describe('Sidebar Test', () => {
    let sideBar: SideBarView;
    let viewSections: ViewSection[];

    before(async function () {
        const viewControl: ViewControl | undefined = await new ActivityBar().getViewControl(EXTENSION_NAME);
        if (!viewControl) {
            throw new Error(`${EXTENSION_NAME} extension not found`);
        }
        sideBar = await viewControl.openView();
        viewSections = (await sideBar.getContent().getSections()) ?? [];
    });

    it('Check Sidebar sections size', async () => {
        expect(viewSections).to.have.lengthOf(3);
    });

    it('Check Sidebar section sort titles', async () => {
        const viewSectionNames = await Promise.all(viewSections.map(async (section) => await section.getTitle()));
        expect(viewSectionNames).to.deep.equal([ENVIRONMENT_SECTION, DOCUMENTS_SECTION, PUBLISH_SECTION]);
    });
});
