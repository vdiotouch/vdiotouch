export const LIST_ASSETS = /* GraphQL */ `
  query ($first: Float, $before: String, $after: String, $search: String) {
    ListAsset(
      listAssetInputDto: {
        first: $first
        before: $before
        after: $after
        search: $search
      }
    ) {
      assets {
        _id
        title
        latest_status
        duration
        size
        tags
        created_at
        thumbnail_url
      }
      page_info {
        total_pages
        prev_cursor
        next_cursor
      }
    }
  }
`;

export const GET_ASSET = /* GraphQL */ `
  query ($id: String!) {
    GetAsset(getAssetInputDto: { _id: $id }) {
      _id
      title
      height
      width
      duration
      description
      status_logs {
        status
        details
        created_at
      }
      size
      tags
      created_at
      updated_at
      thumbnail_url
      latest_status
      master_playlist_url
      files {
        _id
        name
        size
        latest_status
        height
        width
        type
      }
      with_transcription
      with_transcoding
    }
  }
`;

export const CREATE_ASSET = /* GraphQL */ `
  mutation (
    $title: String
    $description: String
    $source_url: String!
    $tags: [String!]
    $with_transcoding: Boolean
    $with_transcription: Boolean
  ) {
    CreateAsset(
      createAssetInput: {
        title: $title
        source_url: $source_url
        description: $description
        tags: $tags
        with_transcoding: $with_transcoding
        with_transcription: $with_transcription
      }
    ) {
      _id
      title
    }
  }
`;

export const UPDATE_ASSET = /* GraphQL */ `
  mutation ($id: String!, $title: String, $description: String, $tags: [String!]) {
    UpdateAsset(
      _id: $id
      updateAssetInputDto: { title: $title, description: $description, tags: $tags }
    ) {
      title
      description
      tags
    }
  }
`;

export const REPROCESS_ASSET = /* GraphQL */ `
  mutation ($id: String!) {
    ReprocessAsset(reprocessAssetInputDto: { _id: $id }) {
      _id
      title
    }
  }
`;

export const DELETE_ASSET = /* GraphQL */ `
  mutation ($id: String!) {
    DeleteAsset(_id: $id)
  }
`;

export const GET_FILE_URL = /* GraphQL */ `
  query ($id: String!) {
    GetFileUrl(id: $id)
  }
`;
