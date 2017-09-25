/**
 * Created by Ivo Meißner on 06.08.17.
 *
 * @flow
 */

import nock from 'nock';
import Client, {
  REFRESH_TOKEN_MUTATION
} from '../index';
import { expect } from 'chai';

const endpoint = 'https://dummyhost';

describe('Client', () => {
  it('Should send a request without auth tokens', done => {
    async function runTest() {
      const client = new Client({endpoint});
      const query = 'query Node($id: ID!) { node(id: $id) {id: "123"}}';
      const variables = {id: '123'};
      const result = {data: {node: {id: '123'}}};
      const request = nock(endpoint, {
        badheaders: [ 'Authorization' ]
      })
        .post('/', {
          query,
          variables
        })
        .reply(200, result);
      
      const clientResult = await client.fetch(
        query,
        variables
      );
      
      request.done();
      expect(result).to.deep.equal(clientResult);
    }
    runTest().then(done).catch(done);
  });
  
  it('Should upload files', done => {
    async function runTest() {
      const client = new Client({endpoint});
      const query = 'query Node($id: ID!) { node(id: $id) {id: "123"}}';
      const variables = {id: '123'};
      const result = {data: {node: {id: '123'}}};
      const request = nock(endpoint)
        .post('/', body => {
          return (
            String(body).includes('Content-Disposition: form-data; name="variables"\r\n\r\n{"id":"123"}') &&
            String(body).includes(`Content-Disposition: form-data; name="query"\r\n\r\n${query}`) &&
            String(body).includes('Content-Disposition: form-data; name="file"\r\n\r\nabcdef')
          );
        })
        .reply(200, result);
      
      const clientResult = await client.fetch(
        query,
        variables,
        {
          file: 'abcdef'
        }
      );
      
      request.done();
      expect(result).to.deep.equal(clientResult);
    }
    runTest().then(done).catch(done);
  });
  
  it('Should throw an error with no provided endpoint', () => {
    /* eslint-disable no-unused-vars */
    expect(() => {
      // $FlowFixMe:
      const client = new Client();
    }).to.throw('You have to provide the endpoint of the GraphQL server to the client');
    
    expect(() => {
      // $FlowFixMe
      const client = new Client({endpoint: 213});
    }).to.throw('You have to provide the endpoint of the GraphQL server to the client');
    /* eslint-enable no-unused-vars */
  });
  
  it('Should send access token in header', done => {
    async function runTest() {
      const client = new Client({endpoint});
      
      const accessToken = '12345abcde';
      const query = 'query Node($id: ID!) { node(id: $id) {id: "123"}}';
      const variables = {id: '123'};
      const result = {data: {node: {id: '123'}}};
      const request = nock(endpoint, {
        reqheaders: {
          Authorization: `Bearer ${accessToken}`
        }
      })
        .post('/', {
          query,
          variables
        })
        .reply(200, result);
      
      client.setAuthTokenSet({
        accessToken,
        accessTokenLifetime: 10,
        refreshToken: '213',
        refreshTokenLifetime: 10
      });
      
      const clientResult = await client.fetch(
        query,
        variables
      );
      
      request.done();
      expect(result).to.deep.equal(clientResult);
    }
    runTest().then(done).catch(done);
  });
  
  it('Should clear tokens on logout', done => {
    async function runTest() {
      const client = new Client({endpoint});
      
      const accessToken = '12345abcde';
      const query = 'query Node($id: ID!) { node(id: $id) {id: "123"}}';
      const variables = {id: '123'};
      const result = {data: {node: {id: '123'}}};
      const request = nock(endpoint, {
        badheaders: [ 'Authorization' ]
      })
        .post('/', {
          query,
          variables
        })
        .reply(200, result);
      
      client.setAuthTokenSet({
        accessToken,
        accessTokenLifetime: 10,
        refreshToken: '213',
        refreshTokenLifetime: 10
      });
      client.logout();
      
      const clientResult = await client.fetch(
        query,
        variables
      );
      
      request.done();
      expect(result).to.deep.equal(clientResult);
    }
    runTest().then(done).catch(done);
  });
  
  it('Should not send expired access token in header', done => {
    async function runTest() {
      const client = new Client({endpoint});
      
      const accessToken = '12345abcde';
      const query = 'query Node($id: ID!) { node(id: $id) {id: "123"}}';
      const variables = {id: '123'};
      const result = {data: {node: {id: '123'}}};
      const request = nock(endpoint, {
        badheaders: [ 'Authorization' ]
      })
        .post('/', {
          query,
          variables
        })
        .reply(200, result);
      
      client.setAuthTokenSet({
        accessToken,
        accessTokenLifetime: -1,
        refreshToken: '213',
        refreshTokenLifetime: -1
      });
      
      const clientResult = await client.fetch(
        query,
        variables
      );
      
      request.done();
      expect(result).to.deep.equal(clientResult);
    }
    runTest().then(done).catch(done);
  });
  
  it('Should refresh access token', done => {
    async function runTest() {
      const client = new Client({endpoint});
      

      const refreshAuthToken = {
        accessToken: 'newToken',
        accessTokenLifetime: 23,
        refreshToken: 'newRefreshToken',
        refreshTokenLifetime: 10
      };
      const refreshToken = 'refresh123';
      const refreshResult = {data: {refreshAuthToken}};
      const refreshTokenReq = nock(endpoint, {
        badheaders: [ 'Authorization' ]
      })
        .post('/', {
          query: REFRESH_TOKEN_MUTATION,
          variables: {
            token: refreshToken
          }
        })
        .reply(200, refreshResult);
      
      const query = 'query Node($id: ID!) { node(id: $id) {id: "123"}}';
      const variables = {id: '123'};
      const result = {data: {node: {id: '123'}}};
      const request = nock(endpoint, {
        reqheaders: {
          Authorization: `Bearer ${refreshAuthToken.accessToken}`
        }
      })
        .post('/', {
          query,
          variables
        })
        .reply(200, result);
        
      client.setAuthTokenSet({
        accessToken: 'expiredtoken',
        accessTokenLifetime: -1,
        refreshToken,
        refreshTokenLifetime: 10
      });
      
      const clientResult = await client.fetch(
        query,
        variables
      );
      
      refreshTokenReq.done();
      request.done();
      expect(result).to.deep.equal(clientResult);
      
      expect(client.getAccessTokenExpires()).to.be.above(Date.now());
      expect(client.getRefreshTokenExpires()).to.be.above(Date.now());
      expect(client.getRefreshToken()).to.equal(refreshAuthToken.refreshToken);
      expect(client.getAccessToken()).to.equal(refreshAuthToken.accessToken);
    }
    runTest().then(done).catch(done);
  });
});
