export const secrets = {
  async listSecretNames(): Promise<string[]> {
    return Object.keys(process.env).filter((name) => name.startsWith('MPESA_'));
  },
  async readSecret(name: string): Promise<string> {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not configured.`);
    return value;
  },
};
