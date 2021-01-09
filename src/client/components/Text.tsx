import type { LocalizedProps } from "@fluent/react";
import { Localized } from "@fluent/react";
import type { BoxProps } from "@material-ui/core/Box";
import Box from "@material-ui/core/Box";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import clsx from "clsx";
import { forwardRef } from "react";

import type { ReactRef, ReactResult } from "../utils/types";

type Classes = typeof useTextStyles extends () => Record<infer K, unknown> ? K : never;

export const useTextStyles = makeStyles(() =>
  createStyles({
    sectionHeader: {
      fontSize: "2rem",
    },
    mediaInfo: {
      fontSize: "1.1rem",
    },
    text: {
      fontSize: "1.05rem",
    },
  }));

type TextBlockProps = BoxProps & {
  l10nId?: string;
  l10nVars?: LocalizedProps["vars"];
  l10nElements?: LocalizedProps["elems"];
};

function textBlock(
  name: string,
  defaultComponent: BoxProps["component"],
  textClass: Classes,
): (props: TextBlockProps) => ReactResult {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  let Element = ({
    l10nId,
    l10nElements,
    l10nVars,
    className,
    ...boxProps
  }: TextBlockProps, ref: ReactRef | null): ReactResult => {
    let classes = useTextStyles();

    let content = <Box
      // @ts-ignore
      ref={ref}
      component={defaultComponent}
      className={clsx(className, classes[textClass])}
      {...boxProps}
    />;

    if (l10nId) {
      return <Localized
        id={l10nId}
        elems={l10nElements}
        vars={l10nVars}
      >
        {content}
      </Localized>;
    }

    return content;
  };

  // @ts-ignore
  Element.displayName = name;

  return forwardRef(Element);
}

export const SectionHeader = textBlock("SectionHeader", "h2", "sectionHeader");
export const MediaInfo = textBlock("MediaInfo", "p", "mediaInfo");
export const Text = textBlock("Text", "p", "text");
