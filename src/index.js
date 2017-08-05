/**
 * Created by Ivo Meißner on 05.08.17.
 *
 * @flow
 */

const REFRESH_TOKEN_KEY = 'auth:refreshToken';
const REFRESH_TOKEN_EXPIRES_KEY = 'auth:refreshTokenExpires';
const ACCESS_TOKEN_KEY = 'auth:accessToken';
const ACCESS_TOKEN_EXPIRES_KEY = 'auth:accessTokenExpires';

const DEFAULT_NAMESPACE = 'slicknode';

/**
 * Interface for custom storage
 */
interface Storage {
  getItem(keyName: string): ?string;
  setItem(keyName: string, keyValue: string): void;
  removeItem(keyName: string): void;
  clear(): void;
}

export type AuthTokenSet = {
  accessToken: string,
  accessTokenLifetime: number,
  refreshToken: string,
  refreshTokenLifetime: number
}

export type Authenticator = (client: Client) => Promise<AuthTokenSet>;

type ClientOptions = {
  /**
   * The slicknode GraphQL endpoint URL
   */
  endpoint: string,
  
  /**
   * Headers to be sent with each request
   */
  headers?: Object,
  
  /**
   * Options that are passed to the fetch() call
   */
  options?: Object,
  
  /**
   * The storage interface to store auth tokens, default is localStorage
   */
  storage?: Storage,
  
  /**
   * The namespace under which auth tokens are stored
   */
  namespace?: string,
}

/**
 * In memory storage
 */
class MemoryStorage {
  values: Object;
  constructor() {
    this.values = {};
  }
  getItem(keyName: string): ?string {
    return this.values.hasOwnProperty(keyName) ? this.values[keyName] : null;
  }
  setItem(keyName: string, keyValue: string): void {
    this.values[keyName] = keyValue;
  }
  removeItem(keyName: string): void {
    delete this.values[keyName];
  }
  clear(): void {
    this.values = {};
  }
}

export default class Client {
  options: ClientOptions;
  storage: Storage;
  namespace: string;
  
  /**
   * Constructor
   * @param options
   */
  constructor(options: ClientOptions) {
    this.options = options;
    this.namespace = options.namespace || DEFAULT_NAMESPACE;
    this.storage = options.storage || global.localStorage || new MemoryStorage();
  }
  
  /**
   * Sends a query to the GraphQL endpoint and returns a promise that
   * resolves to the returned data
   *
   * @param query
   * @param variables
   * @returns {Promise.<void>}
   */
  async fetch(query: string, variables?: Object = {}): Promise<Object> {
    const result = await fetch(
      this.options.endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...await this.getAuthHeaders(),
          ...(this.options.headers || {})
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          query,
          variables: variables || {}
        })
      }
    );
    return await result.json();
  }
  
  /**
   * Returns a promise that resolves the response of the authenticator
   *
   * @param authenticator
   * @returns {Promise.<*>}
   */
  async authenticate(authenticator: Authenticator): Promise<*> {
    const tokenSet = await authenticator(this);
    this.updateAuthTokens(tokenSet);
    return tokenSet;
  }
  
  /**
   * Updates the auth token set
   * @param token
   */
  updateAuthTokens(token: AuthTokenSet): void {
    this.setAccessToken(token.accessToken);
    this.setAccessTokenExpires(token.accessTokenLifetime * 1000 + Date.now());
    this.setRefreshToken(token.refreshToken);
    this.setRefreshTokenExpires(token.refreshTokenLifetime * 1000 + Date.now());
  }
  
  /**
   * Stores the refreshToken either in Session or LocalStorage
   * @param token
   */
  setRefreshToken(token: string) {
    const key = this.namespace + ':' + REFRESH_TOKEN_KEY;
    this.storage.setItem(key, token);
  }

  /**
   * Returns the refresh token, NULL if none was stored yet
   * @returns {string|null}
   */
  getRefreshToken(): ?string {
    if ((this.getRefreshTokenExpires() || 0) < Date.now()) {
      return null;
    }
    const key = this.namespace + ':' + REFRESH_TOKEN_KEY;
    this.storage.getItem(key);
  }
  
  /**
   * Sets the time when the auth token expires
   */
  setAccessTokenExpires(timestamp: ?number) {
    const key = this.namespace + ':' + ACCESS_TOKEN_EXPIRES_KEY;
    if (timestamp) {
      this.storage.setItem(key, String(timestamp));
    } else {
      this.storage.removeItem(key);
    }
  }
  
  /**
   * Returns the UNIX Timestamp when the refresh token expires
   * @returns {number|null}
   */
  getRefreshTokenExpires(): ?number {
    const key = this.namespace + ':' + REFRESH_TOKEN_EXPIRES_KEY;
    const expires = this.storage.getItem(key);
    return expires ? parseInt(expires, 10) : null;
  }
  
  /**
   * Sets the time when the auth token expires
   */
  setRefreshTokenExpires(
    timestamp: ?number
  ): void {
    const key = this.namespace + ':' + REFRESH_TOKEN_EXPIRES_KEY;
    this.storage.setItem(key, String(timestamp));
  }
  
  /**
   * Returns the UNIX Timestamp when the access token expires
   * @returns {number|null}
   */
  getAccessTokenExpires(): ?number {
    const key = this.namespace + ':' + ACCESS_TOKEN_EXPIRES_KEY;
    const expires = this.storage.getItem(key) || null;
    return expires ? parseInt(expires, 10) : null;
  }
  
  /**
   * Writes the access token to storage
   * @param token
   */
  setAccessToken(token: string): void {
    const key = this.namespace + ':' + ACCESS_TOKEN_KEY;
    this.storage.setItem(key, token);
  }
  
  /**
   * Returns the access token, NULL if no valid token was found
   * @returns {null}
   */
  getAccessToken(): ?string {
    const key = this.namespace + ':' + ACCESS_TOKEN_KEY;
    return this.storage.getItem(key) || null;
  }
  
  /**
   * Clears all tokens and local storage
   */
  logout(): void {
    this.storage.clear();
  }
  
  /**
   * Returns the headers that are required to authenticate at the GraphQL endpoint.
   * If no access tokens are available, an attempt is made to retrieve it from the backend
   * with the refreshToken
   */
  async getAuthHeaders(): Promise<Object> {
    let accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    
    // We have no token, try to get it from API
    if (!accessToken && refreshToken) {
      // We have refresh token but expired auth token. Get new access token.
      const result = await fetch(
        this.options.endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            query: `mutation refreshToken($input: refreshAuthTokenInput!) {
              refreshAuthToken(input: $input) {
                accessToken
                refreshToken
                accessTokenLifetime
                refreshTokenLifetime
              }
            }`,
            variables: {
              input: {
                refreshToken: this.getRefreshToken()
              }
            }
          })
        }
      );
      const tokenData = await result.json();
      if (tokenData && tokenData.data && tokenData.data.refreshAuthToken) {
        this.updateAuthTokens(tokenData.data.refreshAuthToken);
        
        // Refetch token
        accessToken = this.getAccessToken();
      } else {
        this.logout();
      }
    }
    
    if (accessToken) {
      return {
        Authorization: `Bearer ${accessToken}`
      };
    }
    
    return {};
  }
}
