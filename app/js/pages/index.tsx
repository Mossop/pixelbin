import React from "react";
import { connect } from "react-redux";

import Banner from "../content/Banner";
import { StoreState } from "../types";
import { loggedIn } from "../utils/helpers";
import { Page, SidebarPage } from "../components/pages";
import Sidebar from "../content/Sidebar";

interface PageProps {
  isLoggedIn: boolean;
}

function mapStateToProps(state: StoreState): PageProps {
  return {
    isLoggedIn: loggedIn(state),
  };
}

class IndexPage extends React.Component<PageProps> {
  public render(): React.ReactNode {
    if (this.props.isLoggedIn) {
      return <React.Fragment>
        <Banner/>
        <SidebarPage>
          <Sidebar/>
          <Page>
            <h1>Hello user!</h1>
          </Page>
        </SidebarPage>
      </React.Fragment>;
    } else {
      return <React.Fragment>
        <Banner/>
        <Page>
          <h1>Hello!</h1>
        </Page>
      </React.Fragment>;
    }
  }
}

export default connect(mapStateToProps)(IndexPage);
