import { Localized } from "@fluent/react";
import Typography from "@material-ui/core/Typography";
import React from "react";

import Banner from "../components/Banner";

interface ErrorPageProps {
  error: string;
}

export default function ErrorPage(props: ErrorPageProps): React.ReactElement | null {
  return <React.Fragment>
    <Banner/>
    <div style={{ display: "flex" }}>
      <main>
        <Localized id="error-title"><Typography variant="h1"/></Localized>
        <Localized id="error-content" vars={{ error: props.error }}>
          <Typography variant="h1"/>
        </Localized>
      </main>
    </div>
  </React.Fragment>;
}
