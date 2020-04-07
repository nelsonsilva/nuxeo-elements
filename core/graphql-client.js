import { ApolloClient } from 'apollo-client';
import { InMemoryCache, defaultDataIdFromObject } from 'apollo-cache-inmemory';
import { split } from 'apollo-link';
import { BatchHttpLink } from 'apollo-link-batch-http';
import { WebSocketLink } from 'apollo-link-ws';
import { getMainDefinition } from 'apollo-utilities';

const httpLink = new BatchHttpLink({
  uri: '/nuxeo/graphql',
  credentials: 'include',
  batchInterval: 300
});

const base64 = btoa(`Administrator:Administrator`);
const wsLink = new WebSocketLink({
  uri: `ws://localhost:4000/graphql`,
  options: {
    reconnect: true,
    connectionParams: {
      Authorization: `Authorization: Basic ${base64}`,
    },
  }
});

// using the ability to split links, you can send data to each link
// depending on what kind of operation is being sent
const link = split(
  // split based on operation type
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink,
);

window.__APOLLO_CLIENT__ = window.__APOLLO_CLIENT__ || new ApolloClient({
  cache: new InMemoryCache({
    dataIdFromObject: object => {
      if (object.__typename) {
        if (object.uid !== undefined) {
            return object.__typename + ":" + object.uid;
        }
        //if (result.changeToken !== undefined) {
        //    return result.__typename + ":" + result._id;
        //}
      }
      return defaultDataIdFromObject(object); // fall back to default handling
    }
  }),
  link,
  name: 'web-ui',
  queryDeduplication: true
});

export const client = window.__APOLLO_CLIENT__;