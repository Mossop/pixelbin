/* eslint-disable prefer-arrow-callback */

import { memo } from "react";

import Icon from "./Icon";
import { MediaView } from "@/modules/types";

import "styles/components/Rating.scss";

function RatingStar({ rating, star }: { rating: number; star: number }) {
  return (
    <Icon
      className={rating >= star ? "filled" : "unfilled"}
      icon="star-filled"
    />
  );
}

export const Rating = memo(function Rating({ media }: { media: MediaView }) {
  let { rating } = media;
  if (rating === null) {
    return <div />;
  }

  return (
    <div className="c-rating">
      <RatingStar rating={rating} star={1} />
      <RatingStar rating={rating} star={2} />
      <RatingStar rating={rating} star={3} />
      <RatingStar rating={rating} star={4} />
      <RatingStar rating={rating} star={5} />
    </div>
  );
});
