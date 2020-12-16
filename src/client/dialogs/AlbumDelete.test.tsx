import { Method } from "../../model";
import { lastCallArgs, mockedFunction } from "../../test-helpers";
import { request } from "../api/api";
import { Album } from "../api/highlevel";
import {
  expect,
  render,
  expectChild,
  mockStore,
  mockStoreState,
  resetDOM,
  mockServerState,
  click,
  deferRequest,
} from "../test-helpers";
import AlbumDeleteDialog from "./AlbumDelete";

jest.mock("../api/api");

const mockedRequest = mockedFunction(request);

afterEach(resetDOM);

test("cancelled delete album", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
      albums: [{
        id: "album1",
        name: "Album 1",
        children: [{
          id: "album2",
          name: "Album 2",
        }],
      }],
    }]),
  }));

  let { dialogContainer } = render(<AlbumDeleteDialog album={Album.ref("album1")}/>, store);

  expect(document.title).toBe("album-delete-title");

  let message = expectChild<HTMLParagraphElement>(dialogContainer, ".MuiDialogContent-root p");
  let cancel = expectChild<HTMLButtonElement>(dialogContainer, "#confirm-dialog-cancel");

  expect(message.textContent).toEqual("album-delete-description");

  click(cancel);

  expect(mockedRequest).not.toHaveBeenCalled();
  expect(store.dispatch).toHaveBeenCalledTimes(1);

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "closeDialog",
    payload: [],
  });
});

test("accepted delete album", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
      albums: [{
        id: "album1",
        name: "Album 1",
        children: [{
          id: "album2",
          name: "Album 2",
        }],
      }],
    }]),
  }));

  let { dialogContainer } = render(<AlbumDeleteDialog album={Album.ref("album1")}/>, store);

  expect(document.title).toBe("album-delete-title");

  let accept = expectChild<HTMLButtonElement>(dialogContainer, "#confirm-dialog-accept");

  let { call, resolve } = deferRequest<Method.AlbumDelete>();

  click(accept);

  expect(await call).toEqual([Method.AlbumDelete, ["album1"]]);

  expect(store.dispatch).not.toHaveBeenCalled();

  await resolve();

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "albumDeleted",
    payload: [expect.toBeRef("album1")],
  });
});
