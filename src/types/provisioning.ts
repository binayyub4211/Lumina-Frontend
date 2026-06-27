export interface NodeConfig {
  name: string;
  location: string;
  model: string;
}

export interface ProvisionPayload {
  publicKey: string;
  nodeConfig: NodeConfig;
  nonce: string;
  iat: number;
  exp: number;
}

export interface ProvisioningToken {
  /** Base64URL-encoded payload */
  payload: string;
  /** Signed payload from Freighter signAuthEntry */
  signature: string;
  /** Compact token: payload.signature */
  token: string;
  /** Expiry timestamp (ms) */
  expiresAt: number;
}

export interface ProvisionAttempt {
  id: string;
  nodeConfig: NodeConfig;
  createdAt: number;
  status: 'pending' | 'claimed' | 'expired';
  token: string;
}

export const PROVISION_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
