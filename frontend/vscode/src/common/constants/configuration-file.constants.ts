import { SHOW_README_ACTION_NAME } from './common.constants';

export const CONFIGURATION_FILE_UNABLE_TO_READ_ERROR_MESSAGE = `Unable to read configuration file. Please refer to the [manual](command:${SHOW_README_ACTION_NAME}?%5B%22configuration-file%22%5D) for details on configuring the file.`;
export const CONFIGURATION_FILE_NOT_VALID_ERROR_MESSAGE = `Configuration file is not valid. Please read the [manual](command:${SHOW_README_ACTION_NAME}?%5B%22configuration-file%22%5D) to solve the problem.`;
export const CONFIGURATION_UNABLE_TO_CREATE_ERROR_MESSAGE = `Unable to create/update configuration file. Please refer to the [manual](command:${SHOW_README_ACTION_NAME}?%5B%22configuration-file%22%5D) for details on configuring the file.`;
export const CONFIG_FILE_NAME = '.apihub-config.yaml';

export const CONFIGURATION_FILE_DEFAULT_VERSION = 1;