import { SHOW_README_ACTION_NAME } from '../common/constants/common.constants';

export const convertToReadmeAnchor = (anchor: string): string => {
    return encodeURIComponent(JSON.stringify([anchor]));
};

export const getNavigateReadmeCommand = (anchor: string): string => {
    return `[manual](command:${SHOW_README_ACTION_NAME}?${convertToReadmeAnchor(anchor)})`;
};
