import { TreeItem, TreeItemCheckboxState, Uri } from 'vscode';
import { getMiddlePath } from '../../utils/path.utils';
import { EXTENSION_EXPLORER_OPEN_FILE_ACTION_NAME } from '../constants/common.constants';
import { FilePath } from './common.model';
import { ConfigurationId } from './configuration.model';

export class SpecificationItem extends TreeItem {
    public description: string;

    constructor(
        public readonly label: string,
        public readonly parentPath: string,
        public readonly uri: Uri,
        public readonly workspacePath: string,
        public readonly checkboxState: TreeItemCheckboxState,
    ) {
        super(uri);
        this.tooltip = label;
        this.resourceUri = uri;
        this.checkboxState = checkboxState;
        this.description = getMiddlePath(workspacePath, uri.fsPath);
        this.command = {
            command: EXTENSION_EXPLORER_OPEN_FILE_ACTION_NAME,
            title: 'Open Api Specification',
            arguments: [uri]
        };
    }
}

export class SpecificationTreeData {
    public readonly localFiles: Set<FilePath>;
    public readonly configFiles: Set<FilePath>;
    public configId: ConfigurationId;

    constructor() {
        this.localFiles = new Set<FilePath>();
        this.configFiles = new Set<FilePath>();
        this.configId = '';
    }
}
