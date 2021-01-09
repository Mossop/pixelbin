import type { DialogTitleProps as MuiDialogTitleProps } from "@material-ui/core/DialogTitle";
import MuiDialogTitle from "@material-ui/core/DialogTitle";

import type { ReactResult } from "../../utils/types";
import Title from "../Title";

export type DialogTitleProps = MuiDialogTitleProps & {
  title: string;
};

export default function DialogTitle({
  title,
  ...props
}: DialogTitleProps): ReactResult {
  return <>
    <Title source="dialog" title={title}/>
    <MuiDialogTitle {...props}>{title}</MuiDialogTitle>
  </>;
}
