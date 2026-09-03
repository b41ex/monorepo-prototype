import * as path from 'path';

import { runTests } from '@vscode/test-electron';

// Idle timeout for the VS Code download. The default of 15 s aborts a ~300 MB transfer on the first
// stall on a CI runner, and the built-in retries restart the file from scratch under the same limit.
const DOWNLOAD_TIMEOUT_MS = 120_000;

async function main(): Promise<void> {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to the extension test script
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// Download VS Code, unzip it and run the integration test
		await runTests({
			timeout: DOWNLOAD_TIMEOUT_MS,
			extensionDevelopmentPath,
			extensionTestsPath,
		});
	} catch (error) {
		console.error('Failed to run tests');
		console.error(error);
		process.exit(1);
	}
}

main();
