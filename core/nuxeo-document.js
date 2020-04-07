/**
@license
(C) Copyright Nuxeo Corp. (http://nuxeo.com/)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { html } from '@polymer/polymer/lib/utils/html-tag.js';

import { client } from './graphql-client';
import gql from 'graphql-tag';
import { Debouncer } from '@polymer/polymer/lib/utils/debounce.js';
import { timeOut } from '@polymer/polymer/lib/utils/async.js';

import './nuxeo-element.js';
import './nuxeo-resource.js';

/*
const FRAGMENT = gql`
  fragment documentProperties on Document {

  }
`;
*/

const GET = gql`
  query get($id: ID, $path: String, $schemas: [String], $enrichers: Enrichers) {
    document(id: $id, path: $path) {
      uid
      path
      title
      repository
      state
      type
      parentRef
      isCheckedOut
      isRecord
      retainUntil
      hasLegalHold
      isUnderRetentionOrLegalHold
      isVersion
      isProxy
      changeToken
      isTrashed
      lastModified
      facets
      properties(schemas: $schemas)
      contextParameters(enrichers: $enrichers)
    }
  }`;

const UPDATE = gql`
  mutation update($id: ID!, $properties: JSONObject!, $schemas: [String], $enrichers: Enrichers) {
    updateDocument(id: $id, properties: $properties) {
      uid
      path
      title
      repository
      state
      type
      parentRef
      isCheckedOut
      isRecord
      retainUntil
      hasLegalHold
      isUnderRetentionOrLegalHold
      isVersion
      isProxy
      changeToken
      isTrashed
      lastModified
      facets
      properties(schemas: $schemas)
      contextParameters(enrichers: $enrichers)
    }
  }
`;

const CREATE = gql`
  mutation create($id: ID!, $properties: JSONObject!) {
    createDocument(id: $id, properties: $properties) {
      uid
      changeToken
    }
  }
`;

const DELETE = gql`
  mutation delte($id: ID!, $properties: JSONObject!) {
    deleteDocument(id: $id)
  }
`;

const MODIFIED = gql`
  subscription onDocumentModified {
    documentModified {
      docId
    }
  }
`;

{
  /**
   * `nuxeo-document` allows managing Documents on a Nuxeo server.
   *
   *     <nuxeo-document auto doc-path="/default-domain"></nuxeo-document>
   *
   * With `auto` set to `true`, the GET method is executed whenever
   * its `docPath` or `docId` properties are changed.
   *
   * You can trigger a method explicitly by calling `get`, `post`, `put` or `delete` on the
   * element.
   *
   * @memberof Nuxeo
   */
  class DocumentElement extends Nuxeo.Element {
    static get template() {
      return html`
        <style>
          :host {
            display: none;
          }
        </style>
        <!--apollo-query data="{{response}}" variables="[[variables]]" client="[[client]]" loading$="{{loading}}">
          <script type="application/graphql">
            query Document($id: ID, $path: String, $schemas: [String], $enrichers: [String]) {
              document(id: $id, path: $path) {
                uid
                path
                title
                repository
                state
                type
                parentRef
                isCheckedOut
                isRecord
                retainUntil
                hasLegalHold
                isUnderRetentionOrLegalHold
                isVersion
                isProxy
                changeToken
                isTrashed
                lastModified
                properties(schemas: $schemas)
                contextParameters(enrichers: $enrichers)
              }
            }
          </script>
        </apollo-query-->
        <!--
        <nuxeo-resource
          id="nxResource"
          connection-id="{{connectionId}}"
          method="{{method}}"
          auto="{{auto}}"
          path="{{path}}"
          data="{{data}}"
          enrichers="{{enrichers}}"
          params="{{params}}"
          headers="{{headers}}"
          type="{{type}}"
          response="{{response}}"
          schemas="[[schemas]]"
          sync-indexing$="[[syncIndexing]]"
          loading$="{{loading}}"
        >
        </nuxeo-resource>
        -->
      `;
    }

    static get is() {
      return 'nuxeo-document';
    }

    static get properties() {
      return {
        /** Inherited properties of nuxeo-resource: TODO -> USE EXTENDS WHEN AVAILABLE */

        /** The id of a nuxeo-connection to use. */
        connectionId: {
          type: String,
          value: '',
        },

        /** If true, automatically execute the operation when either `path` or `params` changes. */
        auto: {
          type: Boolean,
          value: false,
        },

        /** The HTTP method to use ('GET', 'POST', 'PUT', or 'DELETE'). Default is 'GET' */
        method: {
          type: String,
          value: 'get',
        },

        /** The document id. Either 'docId' or 'docPath' must be defined. */
        docId: {
          type: String,
          value: '',
        },

        /** The document path. Either 'docId' or 'docPath' must be defined. */
        docPath: {
          type: String,
          value: '',
        },

        /** The path of the resource. */
        path: {
          type: String,
          computed: '_computePath(docId, docPath)',
        },

        /** The parameters to send. */
        params: {
          type: Object,
          value: null,
        },

        /** The data to pass to the server. */
        data: {
          type: Object,
          value: null,
        },

        /** The response from the server. */
        response: {
          type: Object,
          value: null,
          notify: true,
        },

        /** The `entity-type` of the resource. */
        type: {
          type: String,
          value: '',
        },

        /** The headers of the request.
         * 'Accept': 'text/plain,application/json' is already set by default.
         */
        headers: {
          type: Object,
          value: null,
        },

        /**
         * The `content enricher` of the resource.
         * Can be an object with entity type as keys or list or string (which defaults to `document` entity type).
         */
        enrichers: {
          type: Object,
          value: {},
        },

        /**
         * List of comma separated values of the document schemas to be returned.
         * All document schemas are returned by default.
         */
        schemas: {
          type: String,
          value: '',
        },

        /**
         * If true, documents changed by the call will be reindexed synchronously server side.
         */
        syncIndexing: Boolean,

        /**
         * True while requests are in flight.
         */
        loading: {
          type: Boolean,
          notify: true,
          readOnly: true,
          value: false,
        },

        variables: {
          type: Object,
          /*
          value: () => ({
            id: '', path: '', enrichers: [], schemas: []
          }),
          
          
          computed: `_updateVariables(
            docId,
            docPath,
            params,
            enrichers,
            schemas
          )`
          */
        }
      };
    }

    static get observers() {
      return [
        '_autoGet(docId, docPath, params.*, enrichers, schemas)'
      ]
    }

    _updateVariables() {
      const { docId, docPath, enrichers, schemas } = this;
      if (!docId && !docPath) return;
      return {id: docId, path: docPath, enrichers: enrichers.document, schemas };
    }

    _autoGet() {
      if (!this.docId && !this.docPath) return;
      this._debouncer = Debouncer.debounce(this._debouncer, timeOut.after(300), () => this.get());
    }

    ready() {
      super.ready();

      // Instantiate required constructor fields

      /*
      this.$.nxResource.addEventListener('loading-changed', () => {
        this._setLoading(this.$.nxResource.loading);
      });
      */
    }

    /* Fetch the document. */
    get() {
      const { docId, docPath, schemas } = this;
      let { enrichers } = this;
      if (typeof enrichers === 'string') {
        enrichers = {document: enrichers ? enrichers.split(',') : []};
      }
      if (!docId && !docPath) return;
      return client.query({
        query: GET,
        variables: {
          id: docId,
          path: docPath,
          enrichers,
          schemas 
        }
      }).then(({ data: { document } }) => this.response = document);
    }

    /* Create the document. */
    post() {
      // this.method = 'post';
      // return this.execute();
      const { schemas } = this;
      let { enrichers } = this;
      if (typeof enrichers === 'string') {
        enrichers = {document: enrichers ? enrichers.split(',') : []};
      }
      return client.mutate({
        mutation: CREATE,
        variables: {
          path: this.docPath,
          properties: this.data.properties,
          enrichers,
          schemas
        }
      }).then(({ data: { document } }) => this.response = document);
    }

    /* 'Update the document. */
    put() {
      //this.method = 'put';
      //return this.execute();
      const { schemas } = this;
      let { enrichers } = this;
      if (typeof enrichers === 'string') {
        enrichers = {document: enrichers ? enrichers.split(',') : []};
      }
      return client.mutate({
        mutation: UPDATE,
        variables: {
          id: this.docId,
          properties: this.data.properties,
          enrichers,
          schemas
        }
      }).then(({ data: { document } }) => { console.log(document); this.response = document});
    }

    /* Delete the document. */
    remove() {
      //this.method = 'delete';
      //return this.execute();
      return client.mutate({
        mutation: DELETE,
        variables: {
          id: this.docId
        }
      }).then(({ data: { document } }) => this.response = document);
    }

    subscribe(cb) {
      const { docId } = this; 
      client.subscribe({
        query: MODIFIED,
      }).subscribe({
        next({ data }) {
          if (docId == data.documentModified.docId) {
            cb();
          }
        },
        error(err) { console.error('err', err); },
      });
    }

    /* Execute the request. */
    execute() {
      return Promise.resolve(this.data);
      // return this.$.nxResource.execute();
    }

    _computePath(docId, docPath) {
      let path = '';
      if (docId) {
        path = `/id/${docId}`;
      } else if (docPath) {
        path = `/path/${docPath}`;
      }
      return path;
    }
  }

  customElements.define(DocumentElement.is, DocumentElement);
  Nuxeo.Document = DocumentElement;
}
