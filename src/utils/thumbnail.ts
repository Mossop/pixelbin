export interface Image {
  width: number;
  height: number;
}

export function chooseSize<T extends Image>(images: T[], size: number): T | null {
  const imageSize = (image: T): number => Math.max(image.width, image.height);

  if (!images.length) {
    return null;
  }

  let sizeOrdered = [...images];
  sizeOrdered.sort((a: T, b: T): number => imageSize(a) - imageSize(b));

  let multipleOrdered = sizeOrdered.filter((image: T): boolean => {
    return imageSize(image) >= size;
  });

  if (!multipleOrdered.length) {
    return sizeOrdered[sizeOrdered.length - 1];
  }

  if (imageSize(multipleOrdered[0]) == size) {
    return multipleOrdered[0];
  }

  multipleOrdered.sort((a: T, b: T): number => {
    let aMod = imageSize(a) % size;
    let bMod = imageSize(b) % size;

    if (aMod == bMod) {
      return imageSize(b) - imageSize(a);
    }

    return aMod - bMod;
  });

  return multipleOrdered[0];
}
