/**
 * Created by Ivo Meißner on 05.08.17.
 *
 * @flow
 */

import type Client, {Authenticator} from '../index';

export default function (email: string, password: string): Authenticator {
  return async (client: Client) => {
    const query = `mutation LoginMutation(
      $email: String!,
      $password: String!
    ) {
      tokenSet: loginEmailPassword(input: {email: $email, password: $password}) {
        accessToken
        refreshToken
        accessTokenLifetime
        refreshTokenLifetime
      }
    }`;
    const result = await client.fetch(query, {email, password});
    if (result.data && result.data.tokenSet) {
      return result.data.tokenSet;
    }
    
    if (result.errors && result.errors.length) {
      throw new Error(result.errors[0].message);
    }
    
    throw new Error('Login failed');
  };
}
