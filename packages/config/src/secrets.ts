/**
 * Secret provider abstraction.
 *
 * ASSUMPTION CHANGE: Wire AwsSecretsManagerProvider, GcpSecretManagerProvider,
 * or VaultProvider here when deploying to cloud — swap via SECRET_PROVIDER env.
 */

export type SecretProvider = {
  getSecret(name: string): Promise<string | undefined>;
};

/** Default provider reads from process.env (validated at startup). */
export class EnvSecretProvider implements SecretProvider {
  async getSecret(name: string): Promise<string | undefined> {
    return process.env[name];
  }
}

let secretProvider: SecretProvider = new EnvSecretProvider();

export function setSecretProvider(provider: SecretProvider): void {
  secretProvider = provider;
}

export function getSecretProvider(): SecretProvider {
  return secretProvider;
}

export async function getSecret(name: string): Promise<string | undefined> {
  return secretProvider.getSecret(name);
}
