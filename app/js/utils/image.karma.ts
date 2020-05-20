import { Image } from "./image";

const TEST_IMAGE_WIDTH = 100;
const TEST_IMAGE_HEIGHT = 80;
const TEST_IMAGE_DATA = new Uint8ClampedArray(TEST_IMAGE_WIDTH * TEST_IMAGE_HEIGHT * 4);
// eslint-disable-next-line max-len
const TEST_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABQCAYAAADvCdDvAAABPElEQVR4nO2UMQoEQQzD/P9PzxXLgfMCq5CDYNQNOCQveXl5yfuiTz3rD+gWgnYLgbmFwNxCYG4hMLcQmFsIzC0E5hYCcwuBuYXA3EJgbiEwtxCYWwjMLQTmFgJzC4G5hcDcQmBuITC3EJhbCMwtBOYWAnMLgbmFwNxCYG4hMLcQmFsIzC0E5hYCcwuBuYXA3EJgbiEwtxCYfy/B8O/HoQxgKaR5BpXsV0KazG+mcwewFNKsb6a5yX4lpMn8Zjp3AEshzfpmmpvsV0KazG+mcwewFNKsb6a5yX4lpMn8Zjp3AEshzfpmmpvsV0KazG+mcwewFNKsb6a5yX4lpMn8Zjp3AEshzfpmmpvsV0KazG+mcwewFNKsb6a5yX4lpMn8Zjp3AEshzfpmmpvsV0KazG+mcwewFNKsb6a5+QE+pNZk5Hw/FgAAAABJRU5ErkJggg==";

beforeAll((): void => {
  function set(x: number, y: number, r: number, g: number, b: number, a: number = 255): void {
    let pos = y * TEST_IMAGE_WIDTH * 4 + x * 4;
    TEST_IMAGE_DATA[pos] = r;
    TEST_IMAGE_DATA[pos + 1] = g;
    TEST_IMAGE_DATA[pos + 2] = b;
    TEST_IMAGE_DATA[pos + 3] = a;
  }

  for (let y = 0; y < TEST_IMAGE_HEIGHT / 2; y++) {
    for (let x = 0; x < TEST_IMAGE_WIDTH; x += 4) {
      set(x, y, 255, 0, 0);
      set(x + 1, y, 0, 255, 0);
      set(x + 2, y, 0, 0, 255);
      set(x + 3, y, 255, 255, 255);
    }
  }

  for (let y = TEST_IMAGE_HEIGHT / 2; y < TEST_IMAGE_HEIGHT; y += 4) {
    for (let x = 0; x < TEST_IMAGE_WIDTH; x++) {
      set(x, y, 255, 0, 0);
      set(x, y + 1, 0, 255, 0);
      set(x, y + 2, 0, 0, 255);
      set(x, y + 3, 255, 255, 255);
    }
  }
});

function compareData(
  found: Uint8ClampedArray,
  foundXOffset: number,
  foundYOffset: number,
  foundWidth: number,
  expected: Uint8ClampedArray,
  expectedXOffset: number,
  expectedYOffset: number,
  expectedWidth: number,
  expectedHeight: number,
): boolean {
  for (let y = 0; y < expectedHeight; y++) {
    for (let x = 0; x < expectedWidth; x++) {
      let foundPos = ((y + foundYOffset) * foundWidth + (x + foundXOffset)) * 4;
      let expectedPos = ((y + expectedYOffset) * expectedWidth + (x + expectedXOffset)) * 4;

      let foundPixel = found.slice(foundPos, foundPos + 4).join(", ");
      let expectedPixel = expected.slice(expectedPos, expectedPos + 4).join(", ");

      if (foundPixel != expectedPixel) {
        console.error(
          `Found mismatch at ${x} ${y}, found (${foundPixel}), expected (${expectedPixel})`,
          `Looked at found data position ${foundPos}, expected data position ${expectedPos}`,
        );
        return false;
      }
    }
  }

  return true;
}

function compareToTestData(
  data: Uint8ClampedArray,
  xOffset: number = 0,
  yOffset: number = 0,
  width: number = TEST_IMAGE_WIDTH,
): boolean {
  return compareData(
    data,
    xOffset,
    yOffset,
    width,
    TEST_IMAGE_DATA,
    0,
    0,
    TEST_IMAGE_WIDTH,
    TEST_IMAGE_HEIGHT,
  );
}

function compareCanvasToTestData(
  canvas: HTMLCanvasElement,
  xOffset: number = 0,
  yOffset: number = 0,
): boolean {
  let ctxt = canvas.getContext("2d");
  if (!ctxt) {
    throw new Error("No 2d context.");
  }

  let newData = ctxt.getImageData(0, 0, canvas.width, canvas.height);
  return compareToTestData(newData.data, xOffset, yOffset, canvas.width);
}

function compareImgToTestData(image: HTMLImageElement): boolean {
  let canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  let ctxt = canvas.getContext("2d");
  if (!ctxt) {
    throw new Error("No 2d context.");
  }

  ctxt.drawImage(image, 0, 0);

  return compareCanvasToTestData(canvas);
}

async function compareImageToTestData(image: Image): Promise<boolean> {
  let url = image.url();
  try {
    let img = document.createElement("img");
    img.src = url.get();
    await img.decode();

    return compareImgToTestData(img);
  } finally {
    url.release();
  }
}

it("image tests", async (): Promise<void> => {
  let response = await fetch(TEST_IMAGE);
  let blob = await response.blob();

  // Decoding should get the sizes correct.
  let image = await Image.decode(blob);
  expect(image.width).toBe(TEST_IMAGE_WIDTH);
  expect(image.height).toBe(TEST_IMAGE_HEIGHT);

  expect(await compareImageToTestData(image)).toBeTruthy();

  // Drawing to a canvas should yield the correct data.
  let canvas = document.createElement("canvas");
  canvas.width = TEST_IMAGE_WIDTH;
  canvas.height = TEST_IMAGE_HEIGHT;
  let context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No 2d context.");
  }

  await image.drawImage(context);
  expect(compareCanvasToTestData(canvas)).toBeTruthy();

  let url = image.url();
  let url2 = image.url();
  expect(url2).toBe(url);
  url2.release();

  let img = document.createElement("img");
  img.src = url.get();
  await img.decode();
  url.release();

  expect(compareImgToTestData(img)).toBeTruthy();

  img = document.createElement("img");
  img.src = await image.toDataUrl();
  await img.decode();

  expect(compareImgToTestData(img)).toBeTruthy();

  image = await Image.from(img);
  expect(await compareImageToTestData(image)).toBeTruthy();

  image = await Image.from(canvas);
  expect(await compareImageToTestData(image)).toBeTruthy();

  canvas = document.createElement("canvas");
  canvas.width = TEST_IMAGE_WIDTH * 2;
  canvas.height = TEST_IMAGE_HEIGHT * 2;
  context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No 2d context.");
  }

  await image.drawImage(context, TEST_IMAGE_WIDTH / 2, TEST_IMAGE_HEIGHT / 2);

  expect(compareCanvasToTestData(canvas, TEST_IMAGE_WIDTH / 2, TEST_IMAGE_HEIGHT / 2)).toBeTruthy();
});
