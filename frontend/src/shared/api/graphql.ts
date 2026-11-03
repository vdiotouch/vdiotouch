import { GraphQLClient } from "graphql-request";
import { config } from "@/shared/lib/config";
import { authFetch } from "./session";

let client: GraphQLClient | null = null;

function getClient() {
  client ??= new GraphQLClient(`${config.apiUrl}/graphql`, {
    fetch: (input, init) => authFetch(input, init),
  });
  return client;
}

export function gql<TData, TVars extends object = object>(
  document: string,
  variables?: TVars,
): Promise<TData> {
  return getClient().request<TData>(document, variables as object | undefined);
}
