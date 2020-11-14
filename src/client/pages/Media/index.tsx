import { createMuiTheme, ThemeProvider } from "@material-ui/core/styles";
import React from "react";

import type { MediaLookup } from "../../utils/medialookup";
import type { ReactResult } from "../../utils/types";
import type { AuthenticatedPageProps } from "../types";
import MediaFinder from "./MediaFinder";

const theme = createMuiTheme({
  palette: {
    type: "dark",
  },
});

export interface MediaPageProps {
  readonly media: string;
  readonly lookup: MediaLookup | null;
}

export default function MediaPage(props: MediaPageProps & AuthenticatedPageProps): ReactResult {
  return <ThemeProvider theme={theme}>
    <MediaFinder {...props}/>
  </ThemeProvider>;
}
