import CssBaseline from "@material-ui/core/CssBaseline";
import { render as reactRender } from "react-dom";
import { Provider } from "react-redux";

import App from "./components/App";
import { appContainer, appURL, Url } from "./context";
import { LocalizationContext } from "./l10n/LocalizationContext";
import { buildStore } from "./store";
import { watchStore } from "./utils/navigation";

async function init(): Promise<void> {
  let store = buildStore();
  watchStore(store);

  reactRender(
    <Provider store={store}>
      <LocalizationContext baseurl={`${appURL(Url.L10n)}`} locales={["en-US"]}>
        <>
          <CssBaseline/>
          <App/>
        </>
      </LocalizationContext>
    </Provider>,
    appContainer(),
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/naming-convention
let __webpack_nonce__ = document.querySelector("meta[property='csp-nonce']")
  ?.getAttribute("content");

void init();
