export const LIST_WEBHOOKS = /* GraphQL */ `
  query ($first: Float, $before: String, $after: String, $search: String) {
    ListWebhook(
      listWebhookInputDto: {
        first: $first
        before: $before
        after: $after
        search: $search
      }
    ) {
      webhooks {
        _id
        url
        has_secret
        created_at
        updated_at
      }
      page_info {
        total_pages
        prev_cursor
        next_cursor
      }
    }
  }
`;

export const CREATE_WEBHOOK = /* GraphQL */ `
  mutation ($url: String!, $secret_token: String) {
    CreateWebhook(createWebhookInput: { url: $url, secret_token: $secret_token }) {
      _id
      url
      has_secret
      created_at
      updated_at
    }
  }
`;

export const UPDATE_WEBHOOK = /* GraphQL */ `
  mutation ($id: String!, $url: String, $secret_token: String) {
    UpdateWebhook(
      _id: $id
      updateWebhookInputDto: { url: $url, secret_token: $secret_token }
    ) {
      _id
      url
      has_secret
      created_at
      updated_at
    }
  }
`;

export const DELETE_WEBHOOK = /* GraphQL */ `
  mutation ($id: String!) {
    DeleteWebhook(_id: $id)
  }
`;
