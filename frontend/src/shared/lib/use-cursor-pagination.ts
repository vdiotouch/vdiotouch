import * as React from "react";

/** `page_info` as the api returns it for every cursor-paginated list. */
export interface CursorPage {
  total_pages: number;
  prev_cursor: string | null;
  next_cursor: string | null;
}

export interface Cursor {
  after?: string;
  before?: string;
}

export function useCursorPagination() {
  const [cursor, setCursor] = React.useState<Cursor>({});
  const [pageIndex, setPageIndex] = React.useState(0);

  return {
    cursor,
    pageIndex,
    next: (page?: CursorPage) => {
      if (!page?.next_cursor) return;
      setCursor({ after: page.next_cursor });
      setPageIndex((i) => i + 1);
    },
    prev: (page?: CursorPage) => {
      if (!page?.prev_cursor) return;
      setCursor({ before: page.prev_cursor });
      setPageIndex((i) => Math.max(i - 1, 0));
    },
    reset: () => {
      setCursor({});
      setPageIndex(0);
    },
  };
}
