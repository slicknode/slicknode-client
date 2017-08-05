# Slicknode GraphQL Client

A leightweight client to make requests to a slicknode GraphQL endpoint.

## Installation

The client can be installed via npm: 

    npm install -S slicknode-client

## Usage

Create a client by providing the slicknode GraphQL endpoint:

```javascript
import Client from 'slicknode-client';

const client = new Client({
  endpoint: 'http://myproject.slicknode.com/'
});

// Now you can start sending GraphQL queries
const variables = {};
const query = `query {
  viewer {
    user {
      email
    }
  }
}`;

client.fetch(query, variables)
  .then(({data, errors}) => {
    console.log('Data loaded', data);
  })
  .catch(err => {
    console.log('Something went wrong: ', err.message);
  });
```

### Authentication

By default, there are no authentication headers sent to the GraphQL server, so the
client is making requests as a guest. 

The easiest way to authenticate a user is to use one of the builtin authenticators. 
An authenticator gets an auth token set from the server which is then persisted in 
the storage of the client. By default it uses `localStorage` or an in memory storage
if `localStorage` is not available in the current runtime (e.g. NodeJS).


#### Example: Email password login

```javascript
import login from 'slicknode-client/auth/email-password';
import client from 'slicknode-client';

const email = 'info@slicknode.com';
const password = '12345';
const client = new Client({
  endpoint: 'http://myproject.slicknode.com/'
});
client.authenticate(login(email, password))
  .then(() => {
    console.log('Login was successful');
  })
  .catch(err => {
    console.log('Login failed', err.message);
  });
```

You can use any of the following authentication adapters or build your own: 

- [Email / Password login](auth/email-password.md)

Once a user is authenticated, the slicknode client automatically takes care of
refreshing the access token in the background.

The auth token set consists of an access token (to make the actual requests) and a refresh
token along with expiration times. Those are returned by every authentication mutation
in a slicknode backend. 