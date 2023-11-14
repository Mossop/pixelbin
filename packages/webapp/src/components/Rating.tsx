/* eslint-disable prefer-arrow-callback */

import { memo } from "react";

import Icon from "./Icon";
import { MediaView } from "@/modules/types";

export const Rating = memo(function Rating({ media }: { media: MediaView }) {
  let { rating } = media;
  if (rating === null) {
    return <div />;
  }

  return (
    <div className="c-rating">
      <div className={rating >= 1 ? "filled" : "unfilled"}>
        <Icon icon="star-fill" />
      </div>
      <div className={rating >= 2 ? "filled" : "unfilled"}>
        <Icon icon="star-fill" />
      </div>
      <div className={rating >= 3 ? "filled" : "unfilled"}>
        <Icon icon="star-fill" />
      </div>
      <div className={rating >= 4 ? "filled" : "unfilled"}>
        <Icon icon="star-fill" />
      </div>
      <div className={rating >= 5 ? "filled" : "unfilled"}>
        <Icon icon="star-fill" />
      </div>
    </div>
  );
});
