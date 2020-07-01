import { FluentArgument } from "@fluent/bundle";
import { LocalizedProps } from "@fluent/react";

export type L10nInfo = string | LocalizedProps;
export type L10nProps = { l10n: L10nInfo };
export type OptionalL10nProps = Partial<L10nProps>;

export function l10nInfo(id: string, vars?: Record<string, FluentArgument>): L10nInfo {
  if (!vars || [...Object.entries(vars)].length == 0) {
    return id;
  }

  return {
    id,
    vars,
  };
}
