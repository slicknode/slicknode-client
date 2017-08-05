# Email / Password authenticator

## Requirements

You have to have the slicknode app `auth-email-password` installed in your project.

## Example

```javascript
import login from 'slicknode-client/auth/email-password';
import Client from 'slicknode-client';

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