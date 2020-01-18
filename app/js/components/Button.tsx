import { Localized } from "@fluent/react";
import React from "react";

import { OptionalL10nProps } from "../l10n";
import Icon, { IconProps } from "./Icon";
import { fieldProps, FieldProps, ComponentProps } from "./shared";

type PassedProps  = {
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent) => void;
  onDragEnter?: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDragLeave?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
  tooltipL10n?: string;
} & FieldProps & OptionalL10nProps & IconProps;

type ButtonProps = ComponentProps<PassedProps>;
export class Button extends React.Component<ButtonProps> {
  public renderButtonContent(): React.ReactNode {
    if (this.props.l10n) {
      return <React.Fragment>
        <Localized id={this.props.l10n}>
          <span/>
        </Localized>
      </React.Fragment>;
    } else if (this.props.children) {
      return <span>{this.props.children}</span>;
    } else {
      return null;
    }
  }

  public renderButton(): React.ReactNode {
    let buttonProps = Object.assign(fieldProps(this.props, { className: "button" }), {
      draggable: this.props.draggable,
      onDragStart: this.props.onDragStart,
      onDragEnter: this.props.onDragEnter,
      onDragOver: this.props.onDragOver,
      onDragLeave: this.props.onDragLeave,
      onDrop: this.props.onDrop,
    });
    return <button {...buttonProps} onClick={this.props.onClick}>
      <Icon iconType={this.props.iconType} iconName={this.props.iconName}/>
      {this.renderButtonContent()}
    </button>;
  }

  public render(): React.ReactNode {
    if (this.props.tooltipL10n) {
      return <Localized id={this.props.tooltipL10n} attrs={{title: true}}>
        {this.renderButton()}
      </Localized>;
    } else {
      return this.renderButton();
    }
  }
}
