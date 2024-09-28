import { SlAlertProps } from "shoelace-react";

interface ToastOptions {
  duration?: number;
  onClosed?: () => void;
}

export async function showToast(
  variant: NonNullable<SlAlertProps["variant"]>,
  message: string,
  options?: ToastOptions,
) {
  await customElements.whenDefined("sl-alert");

  let icon: string;
  switch (variant) {
    case "primary":
      icon = "info-circle";
      break;
    case "success":
      icon = "check2-circle";
      break;
    case "neutral":
      icon = "gear";
      break;
    case "warning":
      icon = "exclamation-triangle";
      break;
    case "danger":
      icon = "exclamation-octagon";
      break;
  }

  let toastElement = document.createElement("sl-alert");
  if (options?.duration !== undefined) {
    toastElement.duration = options.duration;
  } else {
    toastElement.closable = true;
  }
  toastElement.variant = variant;

  let iconElement = document.createElement("sl-icon");
  iconElement.slot = "icon";
  iconElement.name = icon;

  toastElement.appendChild(iconElement);
  toastElement.appendChild(document.createTextNode(message));

  await toastElement.toast();

  if (options?.onClosed) {
    options.onClosed();
  }
}
