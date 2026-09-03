import { Event, EventEmitter, ExtensionContext, SecretStorage } from 'vscode';
import { EXTENSION_NAME } from '../constants/common.constants';
import { debounce } from '../../utils/common.utils';

const SECRET_STORAGE_KEY = `${EXTENSION_NAME}.secret.environment`;

export interface EnvironmentData {
    host: string;
    token: string;
}

export class EnvironmentStorageService {
    private readonly _secretStorage: SecretStorage;
    private readonly _onDidChangeConfiguration: EventEmitter<EnvironmentData> = new EventEmitter();
    private readonly fireConfigurationChangeDebounced = debounce(() => this.fireConfigurationChange());
    private readonly saveEnvironmentDebounced = debounce(() => this.saveEnvironment());
    public readonly onDidChangeConfiguration: Event<EnvironmentData> = this._onDidChangeConfiguration.event;

    private _host: string = '';
    private _token: string = '';

    constructor(private readonly context: ExtensionContext) {
        this._secretStorage = this.context.secrets;
        this.loadEnvironmentFromStorage();
    }

    public async getEnvironment(): Promise<EnvironmentData> {
        return this.getLocalEnvironmentData();
    }

    public async setHost(value: string): Promise<void> {
        this._host = value;
        this.saveEnvironmentDebounced();
    }

    public async setToken(value: string): Promise<void> {
        this._token = value;
        this.saveEnvironmentDebounced();
    }

    private fireConfigurationChange(): void {
        this._onDidChangeConfiguration.fire(this.getLocalEnvironmentData());
    }

    private async saveEnvironment(): Promise<void> {
        const environmentData = this.getLocalEnvironmentData();
        const serializedData = this.serializeEnvironmentData(environmentData);
        await this._secretStorage.store(SECRET_STORAGE_KEY, serializedData);
        this.fireConfigurationChangeDebounced();
    }

    private async loadEnvironmentFromStorage(): Promise<void> {
        const storedValue = await this._secretStorage.get(SECRET_STORAGE_KEY);
        const environmentData = this.deserializeEnvironmentData(storedValue);
        this._host = environmentData.host;
        this._token = environmentData.token;
    }

    private getLocalEnvironmentData(): EnvironmentData {
        return { host: this._host, token: this._token };
    }

    private serializeEnvironmentData(data: EnvironmentData): string {
        try {
            return JSON.stringify(data);
        } catch {
            console.error('Failed to serialize environment data');
            return '';
        }
    }

    private deserializeEnvironmentData(value: string | undefined): EnvironmentData {
        try {
            return value ? JSON.parse(value) : { host: '', token: '' };
        } catch {
            console.error('Failed to deserialize environment data');
            return { host: '', token: '' };
        }
    }
}
