import React, { DragEvent, PureComponent, ReactNode } from "react";

import { OptionalL10nProps, Localized } from "../l10n";
import { connect } from "../utils/component";
import { fieldProps, FieldProps } from "../utils/props";
import Icon, { IconProps } from "./Icon";

type PassedProps = {
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent) => void;
  onDragEnter?: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDragLeave?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  tooltipL10n?: string;
} & FieldProps & OptionalL10nProps & IconProps;

class Button extends PureComponent<PassedProps> {
  public renderButtonContent(): ReactNode {
    if (this.props.l10n) {
      return <Localized l10n={this.props.l10n}>
        <span/>
      </Localized>;
    } else if (this.props.children) {
      return <span>{this.props.children}</span>;
    } else {
      return null;
    }
  }

  public renderButton(): ReactNode {
    let buttonProps = Object.assign(fieldProps(this.props, { className: "button" }), {
      draggable: this.props.draggable,
      onDragStart: this.props.onDragStart,
      onDragEnter: this.props.onDragEnter,
      onDragOver: this.props.onDragOver,
      onDragLeave: this.props.onDragLeave,
      onDrop: this.props.onDrop,
    });
    return <button type="button" {...buttonProps} onClick={this.props.onClick}>
      <Icon iconStyle={this.props.iconStyle} iconName={this.props.iconName}/>
      {this.renderButtonContent()}
    </button>;
  }

  public render(): ReactNode {
    if (this.props.tooltipL10n) {
      return <Localized
        l10n={
          {
            id: this.props.tooltipL10n,
            attrs: {
              title: true,
            },
          }
        }
      >
        {this.renderButton()}
      </Localized>;
    } else {
      return this.renderButton();
    }
  }
}

export default connect<PassedProps>()(Button);
