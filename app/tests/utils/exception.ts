import { ApiErrorCode } from "../../js/api";
import { exception, ErrorCode, ApiError, InternalError } from "../../js/utils/exception";
import { expect } from "../helpers";

test("exception", (): void => {
  expect((): void => {
    exception(ErrorCode.UnknownAlbum);
  }).toThrowAppError(ErrorCode.UnknownAlbum);

  let apperror = new ApiError(404, "Not Found", {
    code: ApiErrorCode.CyclicStructure,
    args: {
      "foo": "bar",
    },
  });

  expect(apperror.l10nInfo()).toEqual({
    id: "api-error-cyclic-structure",
    vars: {
      "foo": "bar",
    },
  });

  let internal = new InternalError(ErrorCode.UnknownCatalog);
  expect(internal.l10nInfo()).toEqual("internal-error-unknown-catalog");
});
