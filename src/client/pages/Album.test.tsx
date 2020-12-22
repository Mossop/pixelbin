import { emptyMetadata, Join, Operator, RelationType } from "../../model";
import { lastCallArgs, mockedFunction } from "../../test-helpers";
import { now } from "../../utils/datetime";
import { Album, Catalog } from "../api/highlevel";
import MediaListPage from "../components/Media/MediaListPage";
import { DialogType } from "../dialogs/types";
import {
  expect,
  mockStore,
  render,
  mockStoreState,
  mockServerState,
  resetDOM,
} from "../test-helpers";
import { MediaLookupType, useMediaLookup } from "../utils/medialookup";
import AlbumPage from "./Album";
import { PageType } from "./types";

jest.mock("../components/Media/MediaListPage");
jest.mock("../utils/medialookup", () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    // @ts-ignore
    ...jest.requireActual("../utils/medialookup"),
    useMediaLookup: jest.fn(),
  };
});

beforeEach(resetDOM);

const mockedMediaListPage = mockedFunction(MediaListPage);
mockedMediaListPage.mockReturnValue(null);
const mockedMediaLookup = mockedFunction(useMediaLookup);

test("album page", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
      albums: [{
        id: "album",
        name: "test album",
      }],
    }, {
      id: "catalog2",
      name: "Catalog 2",
    }]),
  }));

  let albumRef = Album.ref("album");

  let { rerender } = render(
    <AlbumPage user={store.state.serverState.user!} album={albumRef}/>,
    store,
  );

  expect(mockedMediaListPage).toHaveBeenCalled();

  let pageProps = lastCallArgs(mockedMediaListPage)[0];

  expect(pageProps.media).toBeUndefined();
  expect(pageProps.selectedMedia).toBeUndefined();
  expect(pageProps.selectedItem).toBe("album");

  expect(mockedMediaLookup).toHaveBeenLastCalledWith({
    type: MediaLookupType.Album,
    recursive: true,
    album: expect.toBeRef("album"),
  });

  expect(store.dispatch).not.toHaveBeenCalled();

  let dt = now();
  let media = {
    ...emptyMetadata,
    catalog: Catalog.ref("catalog"),
    file: null,
    id: "media1",
    created: dt,
    updated: dt,
    albums: [],
    tags: [],
    people: [],
  };

  pageProps.onMediaClick(media);

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "pushUIState",
    payload: [{
      page: {
        type: PageType.Album,
        album: expect.toBeRef("album"),
        selectedMedia: "media1",
      },
    }],
  });

  store.dispatch.mockClear();

  rerender(<AlbumPage
    user={store.state.serverState.user!}
    album={albumRef}
    selectedMedia="media1"
  />);

  pageProps = lastCallArgs(mockedMediaListPage)[0];

  expect(pageProps.media).toBeUndefined();
  expect(pageProps.selectedMedia).toBe("media1");
  expect(pageProps.selectedItem).toBe("album");

  expect(store.dispatch).not.toHaveBeenCalled();

  pageProps.onCloseMedia();

  expect(store.dispatch).not.toHaveBeenCalled();

  expect(pageProps.pageOptions).toHaveLength(4);
  let pageOptions = pageProps.pageOptions!;
  expect(pageOptions[0].label).toBe("banner-search");
  expect(pageOptions[1].label).toBe("banner-album-new");
  expect(pageOptions[2].label).toBe("banner-album-edit");
  expect(pageOptions[3].label).toBe("banner-album-delete");

  pageOptions[0].onClick();
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "showDialog",
    payload: [{
      type: DialogType.Search,
      catalog: expect.toBeRef("catalog"),
      query: {
        invert: false,
        type: "compound",
        join: Join.And,
        relation: RelationType.Album,
        recursive: true,
        queries: [{
          invert: false,
          type: "field",
          field: "id",
          modifier: null,
          operator: Operator.Equal,
          value: "album",
        }],
      },
    }],
  });
  store.dispatch.mockClear();

  pageOptions[1].onClick();
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "showDialog",
    payload: [{
      type: DialogType.AlbumCreate,
      parent: expect.toBeRef("album"),
    }],
  });
  store.dispatch.mockClear();

  pageOptions[2].onClick();
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "showDialog",
    payload: [{
      type: DialogType.AlbumEdit,
      album: expect.toBeRef("album"),
    }],
  });
  store.dispatch.mockClear();

  pageOptions[3].onClick();
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "showDialog",
    payload: [{
      type: DialogType.AlbumDelete,
      album: expect.toBeRef("album"),
    }],
  });
  store.dispatch.mockClear();
});
