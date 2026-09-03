export const DRAFT = 'draft';
export const RELEASE = 'release';
export const ARCHIVED = 'archived';
export const PUBLISHING_STATUSES = [DRAFT, RELEASE, ARCHIVED];
export const PUBLISHING_JS_PATH = 'publishing.js';
export const PUBLISHING_INPUT_DEFAULT_PATTERN = '^[A-Za-z0-9_.~\\- ]{1,}$';

export const PUBLISHING_NO_PREVIOUS_VERSION = 'No previous release version';
export const PUBLISHING_VERSIONS_LIMIT = '100';
export const PUBLISHING_PREVIOUS_VERSION_LABEL = 'Previous version:';
export const PUBLISHING_PREVIOUS_RELEASE_VERSION_LABEL = 'Previous release version:';
export const PUBLISHING_NO_PREVIOUS_VERSION_TEXT = 'No previous version';
export const PUBLISHING_NO_PREVIOUS_RELEASE_VERSION_TEXT = 'No previous release version';

export const PUBLISHING_PREVIOUS_VERSIONS_LOAD_ERROR =
    'Failed to load the list of previous versions. Check the APIHUB connection and try again.';

export const PUBLISHING_RELEASE_PREVIOUS_VERSION_REQUIRED =
    'A release version must have a release previous version';
export const PUBLISHING_LOADING_OPTION = 'Loading...';

export const PUBLISHING_WEBVIEW = 'publishingWebview';
export const STATUS_BAR_PUBLISH_MESSAGE = 'Publication to APIHUB Portal';
export const STATUS_BAR_TEXT = `$(sync~spin) ${STATUS_BAR_PUBLISH_MESSAGE}`;

export const STATUS_REFETCH_INTERVAL = 3000;
export const STATUS_REFETCH_MAX_ATTEMPTS = 2000;

export const PUBLISHING_DATA_NAME = "package.zip";

export const PUBLISHING_SUCCESSFUL_MESSAGE = "Package version was successfully published in APIHUB Portal";
export const PUBLISHING_BUTTON_LINK_MESSAGE = "Check it out";