export function debounce<T extends (...args: any[]) => void>(
    func: T,
    delay: number = 1000
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = setTimeout(() => func(...args), delay);
    };
}

export const sortStrings = (arr: string[]): string[] => {
    return [...arr].sort((a, b) => a.localeCompare(b));
};

export const delay = (milliseconds: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export const isMatchingPattern = (pattern: string, version: string): boolean => {
    const regexp = new RegExp(pattern);
    return regexp.test(version);
};
