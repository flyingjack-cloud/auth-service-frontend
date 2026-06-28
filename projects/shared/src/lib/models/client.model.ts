// projects/shared/src/lib/models/client.model.ts
export interface OAuthClient {
  id: number;
  clientId: string;
  clientIdIssuedAt: string;
  clientName: string;
  clientAuthenticationMethods: string;
  authorizationGrantTypes: string;
  redirectUris: string;
  scopes: string;
  description: string | null;
  avatarUrl: string | null;
  contactEmail: string | null;
}

export interface CreateClientRequest {
  clientId: string;
  clientName: string;
  clientSecret?: string;
  authorizationGrantTypes: string;
  clientAuthenticationMethods: string;
  redirectUris: string;
  scopes: string;
  requireProofKey: boolean;
  accessTokenTtlHours: number;
  refreshTokenTtlDays: number;
  description: string | null;
  avatarUrl: string | null;
  contactEmail: string | null;
}

export interface CreateClientResponse {
  client: OAuthClient;
  plainSecret: string;
}

export interface UpdateClientRequest {
  clientName?: string;
  clientSecret?: string;
  redirectUris?: string;
  accessTokenTtlHours?: number;
  refreshTokenTtlDays?: number;
  description?: string | null;
  avatarUrl?: string | null;
  contactEmail?: string | null;
}
