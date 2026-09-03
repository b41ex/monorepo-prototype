// @ts-check

(function () {
    const PublishingFields = {
        PACKAGE_ID: 'packageId',
        VERSION: 'version',
        STATUS: 'status',
        PREVIOUS_VERSION: 'previousVersion',
        PREVIOUS_VERSION_LABEL: 'previousVersionLabel',
        PREVIOUS_VERSION_GROUP: 'previousVersionGroup',
        LABELS: 'labels',
        PUBLISHING_BUTTON: 'publishing-button'
    };


    const LABEL_TEXT_FIELD_TYPE = 'label-text';
    updateFieldMapper.set(LABEL_TEXT_FIELD_TYPE, (fieldName, value) => {
        const field = getField(fieldName);
        if (!field) {
            return;
        }
        field.textContent = value;
    });
    typeFieldMapper.set(PublishingFields.PREVIOUS_VERSION_LABEL, LABEL_TEXT_FIELD_TYPE);

    const TITLE_FIELD_TYPE = 'title-text';
    updateFieldMapper.set(TITLE_FIELD_TYPE, (fieldName, value) => {
        const field = getField(fieldName);
        if (!field) {
            return;
        }
        if (value) {
            field.setAttribute('title', value);
        } else {
            field.removeAttribute('title');
        }
    });
    typeFieldMapper.set(PublishingFields.PREVIOUS_VERSION_GROUP, TITLE_FIELD_TYPE);

    typeFieldMapper.set(PublishingFields.PACKAGE_ID, FieldTypes.INPUT);
    typeFieldMapper.set(PublishingFields.VERSION, FieldTypes.INPUT);
    typeFieldMapper.set(PublishingFields.STATUS, FieldTypes.SINGLE_SELECT);
    typeFieldMapper.set(PublishingFields.PREVIOUS_VERSION, FieldTypes.SINGLE_SELECT_COMBOBOX);
    typeFieldMapper.set(PublishingFields.LABELS, FieldTypes.LABELS);
    typeFieldMapper.set(PublishingFields.PUBLISHING_BUTTON, FieldTypes.BUTTON);

    defaultListenersMapper.get(typeFieldMapper.get(PublishingFields.PACKAGE_ID))(PublishingFields.PACKAGE_ID);
    defaultListenersMapper.get(typeFieldMapper.get(PublishingFields.VERSION))(PublishingFields.VERSION);
    defaultListenersMapper.get(typeFieldMapper.get(PublishingFields.STATUS))(PublishingFields.STATUS);
    defaultListenersMapper.get(typeFieldMapper.get(PublishingFields.PREVIOUS_VERSION))(PublishingFields.PREVIOUS_VERSION);

    const labels = document.querySelector(`#${PublishingFields.LABELS}`);
    if (labels) {
        // @ts-ignore
        labels.addEventListener('focusout', () => {
            updateLables();
        });
        // @ts-ignore
        labels.addEventListener('keyup', ({ key }) => {
            if (key === 'Enter') {
                updateLables();
            }
        });
    }

    const publishingButton = document.querySelector(`#${PublishingFields.PUBLISHING_BUTTON}`);
    if (publishingButton) {
        publishingButton.addEventListener('click', publish);
    }

    function updateLables() {
        if (!labels) {
            return;
        }
        const shadowRoot = labels.shadowRoot;
        if (!shadowRoot) {
            return;
        }
        const input = shadowRoot.querySelector('input');
        if (!input) {
            return;
        }
        if (!input.value?.trim()?.length) {
            return;
        }
        sendFieldValue(PublishingFields.LABELS);
        // @ts-ignore
        input.value = '';
    }

    function publish() {
        vscode.postMessage({
            command: 'publish'
        });
    }
})();
