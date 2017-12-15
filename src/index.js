/**
 * Created by Ivo Meißner on 05.08.17.
 *
 * @flow
 */

import 'isomorphic-fetch';
import 'isomorphic-form-data';

const REFRESH_TOKEN_KEY = ':auth:refreshToken';
const REFRESH_TOKEN_EXPIRES_KEY = ':auth:refreshTokenExpires';
const ACCESS_TOKEN_KEY = ':auth:accessToken';
const ACCESS_TOKEN_EXPIRES_KEY = ':auth:accessTokenExpires';

const DEFAULT_NAMESPACE = 'slicknode';

/**
 * Interface for custom storage
 */
export interface Storage {
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

export type Uploadable = File | Blob | Buffer | string;
export type UploadableMap = {[key: string]: Uploadable};

export type ClientOptions = {
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
  
  /**
   * Use a permanent access token for authentication
   */
  accessToken?: string,
}

export const REFRESH_TOKEN_MUTATION = `mutation refreshToken($token: String!) {
  refreshAuthToken(input: {refreshToken: $token}) {
    accessToken
    refreshToken
    accessTokenLifetime
    refreshTokenLifetime
  }
}`;

/**
 * In memory storage
 */
export class MemoryStorage {
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
    if (!options || typeof options.endpoint !== 'string') {
      throw new Error('You have to provide the endpoint of the GraphQL server to the client');
    }
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
   * @param files
   * @returns {Promise.<void>}
   */
  async fetch(
    query: string,
    variables?: Object = {},
    files?: UploadableMap = {}
  ): Promise<Object> {
    const authHeaders = query !== REFRESH_TOKEN_MUTATION ? await this.getAuthHeaders() : {};
    
    const config: Object = {
      method: 'POST',
      headers: {
        ...authHeaders,
        ...(this.options.headers || {})
      },
      credentials: 'same-origin',
    };
    
    // We have files, send request as multipart
    if (files && Object.keys(files).length > 0) {
      const data = new FormData();
      Object.keys(files).forEach((name => {
        const file = files[name];
        // If we have buffer or string, add filename
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(file) || typeof file === 'string') {
          // $FlowFixMe:
          data.append(name, file, 'data.bin');
        } else {
          // $FlowFixMe:
          data.append(name, file);
        }
      }));
      data.append('query', query);
      data.append('variables', JSON.stringify(variables));
      config.body = data;
    } else {
      // Send as normal POST request
      config.body = JSON.stringify({
        query,
        variables: variables || {}
      });
      config.headers['Content-Type'] = 'application/json';
      config.headers['Accept'] = 'application/json';
    }
    
    const result = await fetch(
      this.options.endpoint,
      config
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
    this.setAuthTokenSet(tokenSet);
    return tokenSet;
  }
  
  /**
   * Returns true if the client has a valid access token
   *
   * @returns {boolean}
   */
  hasAccessToken(): boolean {
    return Boolean(this.getAccessToken());
  }
  
  /**
   * Returns true if the client has a valid refresh token
   *
   * @returns {boolean}
   */
  hasRefreshToken(): boolean {
    return Boolean(this.getRefreshToken());
  }
  
  /**
   * Updates the auth token set
   * @param token
   */
  setAuthTokenSet(token: AuthTokenSet): void {
    this.setAccessToken(token.accessToken);
    this.setAccessTokenExpires(token.accessTokenLifetime * 1000 + Date.now());
    this.setRefreshToken(token.refreshToken);
    this.setRefreshTokenExpires(token.refreshTokenLifetime * 1000 + Date.now());
  }
  
  /**
   * Stores the refreshToken in the storage of the client
   * @param token
   */
  setRefreshToken(token: string) {
    const key = this.namespace + REFRESH_TOKEN_KEY;
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
    const key = this.namespace + REFRESH_TOKEN_KEY;
    return this.storage.getItem(key);
  }
  
  /**
   * Sets the time when the auth token expires
   */
  setAccessTokenExpires(timestamp: ?number) {
    const key = this.namespace + ACCESS_TOKEN_EXPIRES_KEY;
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
    const key = this.namespace + REFRESH_TOKEN_EXPIRES_KEY;
    const expires = this.storage.getItem(key);
    return expires ? parseInt(expires, 10) : null;
  }
  
  /**
   * Sets the time when the auth token expires
   */
  setRefreshTokenExpires(
    timestamp: ?number
  ): void {
    const key = this.namespace + REFRESH_TOKEN_EXPIRES_KEY;
    this.storage.setItem(key, String(timestamp));
  }
  
  /**
   * Returns the UNIX Timestamp when the access token expires
   * @returns {number|null}
   */
  getAccessTokenExpires(): ?number {
    const key = this.namespace + ACCESS_TOKEN_EXPIRES_KEY;
    const expires = this.storage.getItem(key) || null;
    return expires ? parseInt(expires, 10) : null;
  }
  
  /**
   * Writes the access token to storage
   * @param token
   */
  setAccessToken(token: string): void {
    const key = this.namespace + ACCESS_TOKEN_KEY;
    this.storage.setItem(key, token);
  }
  
  /**
   * Returns the access token, NULL if no valid token was found
   * @returns {null}
   */
  getAccessToken(): ?string {
    // Check if is expired
    if ((this.getAccessTokenExpires() || 0) < Date.now()) {
      return null;
    }
    const key = this.namespace + ACCESS_TOKEN_KEY;
    return this.storage.getItem(key) || null;
  }
  
  /**
   * Clears all tokens in the storage
   */
  logout(): void {
    this.storage.removeItem(this.namespace + REFRESH_TOKEN_KEY);
    this.storage.removeItem(this.namespace + REFRESH_TOKEN_EXPIRES_KEY);
    this.storage.removeItem(this.namespace + ACCESS_TOKEN_KEY);
    this.storage.removeItem(this.namespace + ACCESS_TOKEN_EXPIRES_KEY);
  }
  
  /**
   * Returns the headers that are required to authenticate at the GraphQL endpoint.
   * If no access tokens are available, an attempt is made to retrieve it from the backend
   * with the refreshToken
   */
  async getAuthHeaders(): Promise<Object> {
    let accessToken = this.options.accessToken || this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    
    // We have no token, try to get it from API
    if (!accessToken && refreshToken) {
      // We have refresh token but expired auth token. Refresh auth token set.
      const result = await this.fetch(REFRESH_TOKEN_MUTATION, {token: refreshToken});
      if (result && result.data && result.data.refreshAuthToken) {
        this.setAuthTokenSet(result.data.refreshAuthToken);
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
