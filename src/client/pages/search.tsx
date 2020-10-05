import React from "react";

import { Query } from "../../model";
import { Catalog, Reference } from "../api/highlevel";
import Page from "../components/Page";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps } from "./types";

export interface SearchPageProps {
  catalog: Reference<Catalog>;
  query: Query;
}

export default function SearchPage(_props: SearchPageProps & AuthenticatedPageProps): ReactResult {
  return <Page/>;
}
