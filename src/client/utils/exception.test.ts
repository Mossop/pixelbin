import { ErrorCode as ApiErrorCode } from "../../model";
import { expect } from "../test-helpers";
import { exception, ErrorCode, ApiError, InternalError } from "./exception";

test("exception", (): void => {
  expect((): void => {
    exception(ErrorCode.UnknownAlbum);
  }).toThrowAppError(ErrorCode.UnknownAlbum);

  let apperror = new ApiError(404, "Not Found", {
    code: ApiErrorCode.InvalidData,
    data: {
      foo: "bar",
    },
  });

  expect(apperror.l10nInfo()).toEqual({
    id: "api-error-invalid-data",
    vars: {
      foo: "bar",
    },
  });

  let internal = new InternalError(ErrorCode.UnknownCatalog);
  expect(internal.l10nInfo()).toEqual("internal-error-unknown-catalog");
});
