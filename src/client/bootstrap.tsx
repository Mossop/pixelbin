import CssBaseline from "@material-ui/core/CssBaseline";
import type { Theme } from "@material-ui/core/styles";
import { createMuiTheme, ThemeProvider } from "@material-ui/core/styles";
import { render as reactRender } from "react-dom";
import { Provider } from "react-redux";

import App from "./components/App";
import { TitleProvider } from "./components/Title";
import { appContainer, appURL, Url } from "./context";
import { LocalizationContext } from "./l10n/LocalizationContext";
import { buildStore } from "./store";
import { watchStore } from "./utils/navigation";

const baseTheme = createMuiTheme();

/* eslint-disable @typescript-eslint/naming-convention */
const themeOverrides = (theme: Theme): Theme => createMuiTheme({
  overrides: {
    MuiCssBaseline: {
      "@global": {
        "*": {
          fontWeight: "inherit",
          fontSize: "inherit",
          padding: 0,
          margin: 0,
          color: "inherit",
          cursor: "inherit",
        },
        "body": {
          cursor: "default",
        },
        "#title": {
          display: "none",
        },
      },
    },
    // @ts-ignore: Rating is from labs
    MuiRating: {
      root: {
        fontSize: "inherit",
      },
    },
    MuiSvgIcon: {
      root: {
        fontSize: "inherit",
      },
    },
    MuiDialogTitle: {
      root: {
        paddingTop: theme.spacing(2),
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2),
        paddingBottom: 0,
      },
    },
    MuiDialogContent: {
      root: {
        paddingBottom: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "start",
        alignItems: "stretch",
      },
    },
    MuiDialogActions: {
      root: {
        padding: theme.spacing(1),
      },
    },
  },
  props: {
    MuiDialogActions: {
      disableSpacing: true,
    },
  },
});
/* eslint-enable @typescript-eslint/naming-convention */

async function init(): Promise<void> {
  let store = buildStore();
  watchStore(store);

  reactRender(
    <Provider store={store}>
      <LocalizationContext baseurl={`${appURL(Url.L10n)}`} locales={["en-US"]}>
        <ThemeProvider theme={baseTheme}>
          <ThemeProvider theme={themeOverrides}>
            <TitleProvider defaultTitle="PixelBin">
              <CssBaseline/>
              <App/>
            </TitleProvider>
          </ThemeProvider>
        </ThemeProvider>
      </LocalizationContext>
    </Provider>,
    appContainer(),
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/naming-convention
let __webpack_nonce__ = document.querySelector("meta[property='csp-nonce']")
  ?.getAttribute("content");

void init();
