/* global cast, chrome */
window.__onGCastApiAvailable = function (isAvailable) {
  if (isAvailable) {
    cast.framework.CastContext.getInstance().setOptions({
      receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    });

    castState = true;

    document.dispatchEvent(new CustomEvent("cast-available"));
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
var castState = false;
