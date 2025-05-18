export function getEnv(name: string): string | null {
    const value = process.env[name];
    if (value == null) {
        // throw new Error(`Environment variable ${name} is not set`);
        return null;
    }
    return value;
}
