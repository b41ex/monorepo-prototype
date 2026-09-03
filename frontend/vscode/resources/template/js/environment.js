// @ts-ignore
(function () {
    const PASSWORD_TYPE = 'password';
    const TEXT_TYPE = 'text';
    const CLOSED_EYE_ICON = 'eye-closed';
    const EYE_ICON = 'eye';
    const ACTIVE_CLASS = 'active';

    const EnvironmentWebviewFields = {
        URL: 'url',
        TOKEN: 'token',
        TEST_CONNECTION_BUTTON: 'testConnectionButton',
        TEST_CONNECTION_ICON: 'testConnectionIcon'
    };

    const inputToken = document.querySelector(`#${EnvironmentWebviewFields.TOKEN}`);
    const togglePasswordButton = document.querySelector('#eye-icon');
    const testConnectionButton = document.querySelector('#testConnectionButton');

    typeFieldMapper.set(EnvironmentWebviewFields.URL, FieldTypes.INPUT);
    typeFieldMapper.set(EnvironmentWebviewFields.TOKEN, FieldTypes.INPUT);
    typeFieldMapper.set(EnvironmentWebviewFields.TEST_CONNECTION_BUTTON, FieldTypes.BUTTON);
    typeFieldMapper.set(EnvironmentWebviewFields.TEST_CONNECTION_ICON, FieldTypes.BUTTON);

    defaultListenersMapper.get(FieldTypes.INPUT)(EnvironmentWebviewFields.URL);

    if (inputToken) {
        defaultListenersMapper.get(FieldTypes.INPUT)(EnvironmentWebviewFields.TOKEN);
    }
    if (togglePasswordButton) {
        togglePasswordButton.addEventListener('click', updateTogglePasswordButton);
    }
    if (testConnectionButton) {
        testConnectionButton.addEventListener('click', testConnection);
    }

    function updateTogglePasswordButton() {
        if (!inputToken || !togglePasswordButton) {
            return;
        }
        // @ts-ignore
        if (inputToken.type === PASSWORD_TYPE) {
            // @ts-ignore
            inputToken.type = TEXT_TYPE;
            // @ts-ignore
            togglePasswordButton.name = CLOSED_EYE_ICON;
            togglePasswordButton.classList.add(ACTIVE_CLASS);
        } else {
            // @ts-ignore
            inputToken.type = PASSWORD_TYPE;
            // @ts-ignore
            togglePasswordButton.name = EYE_ICON;
            togglePasswordButton.classList.remove(ACTIVE_CLASS);
        }
    }

    function requestDefaultValues() {
        requestField(EnvironmentWebviewFields.URL);
        requestField(EnvironmentWebviewFields.TOKEN);
    }

    function testConnection() {
        vscode.postMessage({
            command: 'testConnection',
            payload: {
                token: getInput(EnvironmentWebviewFields.TOKEN).value,
                host: getInput(EnvironmentWebviewFields.URL).value
            }
        });
    }
    requestDefaultValues();
})();
