import * as assert from 'assert';
import path from 'path';
import { Uri } from 'vscode';
import { SpecificationItem } from '../../common/models/specification-item';
import {
    capitalize,
    getExtension,
    getFileDirectory,
    getMiddlePath,
    isApiSpecFile,
    isItemApiSpecFile
} from '../../utils/path.utils';
import { convertOptionsToDto } from '../../utils/publishing.utils';
import { sortStrings } from '../../utils/common.utils';

const OPTION_1 = 'option1';
const OPTION_2 = 'option2';

const NAME_1 = 'name_1';
const NAME_CAPITALIZED_1 = 'Name_1';

const YAML = 'yaml';
const YML = 'yml';
const JSON = 'json';
const DOC = 'doc';
const GQL = 'gql';
const GRAPHQL = 'graphql';

const WORKFOLDER_PATH = 'folder-name/workfolder';
const FILE_DIRECTORY_PATH = 'folder-name/workfolder/src/docs';
const FILE_YAML_PATH = 'folder-name/workfolder/src/docs/fileName.yaml';

suite('Utils', () => {
    test('convertOptionsToDto', async () => {
        let optionsDto = convertOptionsToDto([OPTION_1], '');
        assert.deepStrictEqual(optionsDto, [{ name: OPTION_1, disabled: false, selected: false }]);

        optionsDto = convertOptionsToDto([OPTION_1, OPTION_2], '');
        assert.deepStrictEqual(optionsDto, [
            { name: OPTION_1, disabled: false, selected: false },
            { name: OPTION_2, disabled: false, selected: false }
        ]);
    });

    test('getMiddlePath', async () => {
        const middlePath = getMiddlePath(WORKFOLDER_PATH, FILE_YAML_PATH);
        assert.equal(middlePath, `/src/docs/`);
    });

    test('getFileDirectory', async () => {
        const fileDirectory = getFileDirectory(FILE_YAML_PATH);
        assert.equal(fileDirectory, FILE_DIRECTORY_PATH + path.sep);
    });

    test('capitalize', async () => {
        assert.equal(capitalize(NAME_1), NAME_CAPITALIZED_1);
        assert.equal(capitalize(NAME_CAPITALIZED_1), NAME_CAPITALIZED_1);
    });

    test('getExtension', async () => {
        assert.equal(getExtension(`${NAME_1}.${YAML}`), YAML);
        assert.equal(getExtension(`${NAME_1}.${YML}`), YML);
        assert.equal(getExtension(`${NAME_1}.${JSON}`), JSON);
        assert.equal(getExtension(`${NAME_1}.${DOC}`), DOC);
    });

    test('isApiSpecFile', async () => {
        assert.equal(isApiSpecFile(YAML), true);
        assert.equal(isApiSpecFile(YML), true);
        assert.equal(isApiSpecFile(JSON), true);
        assert.equal(isApiSpecFile(DOC), false);
        assert.equal(isApiSpecFile(GQL), false);
        assert.equal(isApiSpecFile(GRAPHQL), false);
    });

    test('isItemApiSpecFile', async () => {
        const item1: SpecificationItem = new SpecificationItem(NAME_1, '', Uri.file(`${NAME_1}.${YAML}`), '', 0);
        assert.equal(isItemApiSpecFile(item1), true);

        const item2: SpecificationItem = new SpecificationItem(NAME_1, '', Uri.file(`${NAME_1}.${GRAPHQL}`), '', 0);
        assert.equal(isItemApiSpecFile(item2), false);
    });

    test('sortStrings', async () => {
        assert.deepStrictEqual(sortStrings(['b', 'a', 'c']), ['a', 'b', 'c']);
    });
});
