/* eslint-disable jsx-a11y/alt-text */
import mime from "mime-types";
import { MediaView } from "@/modules/types";
import Icon from "./Icon";
import { url } from "@/modules/util";

const THUMBNAILS = {
  alternateTypes: ["image/webp"],
  sizes: [150, 200, 250, 300, 350, 400, 450, 500],
};

function Photo({ media }: { media: MediaView }) {
  let file = media.file;
  if (!file) {
    return (
      <div
        style={{ width: "100%", height: "100%" }}
        className="d-flex align-items-center justify-content-center"
      >
        <Icon icon="hourglass" />
      </div>
    );
  }

  let filename = media.filename;
  if (filename) {
    let pos = filename.lastIndexOf(".");
    if (pos > 0) {
      filename = filename.substring(0, pos);
    }
  } else {
    filename = "image";
  }

  let source = (mimetype: string) => {
    let extension = mime.extension(mimetype);
    let urlMimetype = mimetype.replace("/", "-");

    return url([
      "media",
      media.id,
      file!.id,
      "encoding",
      urlMimetype,
      `${filename}.${extension}`,
    ]);
  };

  return (
    <picture>
      {THUMBNAILS.alternateTypes.map((type) => (
        <source key={type} srcSet={source(type)} type={type} />
      ))}
      <img
        srcSet={source("image/jpeg")}
        className="object-fit-contain"
        style={{
          height: "100%",
          width: "100%",
        }}
      />
    </picture>
  );
}

function Overlay({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export default function MediaLayout({ media }: { media: MediaView }) {
  return (
    <main
      className="flex-grow-1 flex-shrink-1 overflow-hidden position-relative"
      data-bs-theme="dark"
    >
      <Photo media={media} />
      <Overlay className="position-absolute top-0 start-0 end-0 bottom-0">
        <div className="h-100 w-100 d-flex flex-column fs-1">
          <div className="d-flex align-items-center justify-content-between p-3 bg-body-secondary">
            <div>Date</div>
            <div>
              <Icon icon="x-circle-fill" />
            </div>
          </div>
          <div className="flex-grow-1 d-flex align-items-center justify-content-between p-3">
            <div>
              <Icon icon="arrow-left-circle-fill" />
            </div>
            <div>
              <Icon icon="arrow-right-circle-fill" />
            </div>
          </div>
          <div className="d-flex align-items-center justify-content-end p-3 bg-body-secondary">
            <div>Buttons</div>
          </div>
        </div>
      </Overlay>
    </main>
  );
}
