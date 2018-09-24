# Slicknode GraphQL Client

A lightweight client to make requests to a slicknode GraphQL server. Sends GraphQL queries while automatically
adding authentication headers, refreshing access tokens in the background on expiration and with support
for authenticators. 

**Note:** If you are looking for a client to build a frontend application, we recommend using [slicknode-apollo](https://github.com/slicknode/slicknode-apollo),
the Slicknode version of the [Apollo Client](https://www.apollographql.com/client) with auth support and recommended defaults. 

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
import loginEmailPassword from 'slicknode-auth-email-password';
import Client from 'slicknode-client';

const email = 'info@slicknode.com';
const password = '12345xyz';
const client = new Client({
  endpoint: 'http://myproject.slicknode.com/'
});
client.authenticate(loginEmailPassword(email, password))
  .then(() => {
    console.log('Login was successful');
  })
  .catch(err => {
    console.log('Login failed', err.message);
  });
```

You can use any of the following authentication adapters or build your own: 

- **[Email / Password](https://github.com/slicknode/slicknode-auth-email-password):** Authentication with
email address and password

Once a user is authenticated, the slicknode client automatically takes care of
refreshing the access token in the background.

To learn more about authentication and auth tokens for Slicknode servers, check out the section for authentication in
the Slicknode documentation. 
