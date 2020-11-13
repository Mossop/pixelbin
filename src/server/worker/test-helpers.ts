import { EventEmitter } from "events";

import { mockedFunction } from "../../test-helpers";
import type { Obj } from "../../utils";
import type { RemoteInterface } from "./channel";
import type { ParentProcessOptions, ParentProcess } from "./parent";

export class MockChildProcess {
  public constructor(public readonly parent: MockParent, public readonly remote: Obj | undefined) {
  }

  public kill(): void {
    this.parent.emit("disconnect");
  }
}

export class MockParent extends EventEmitter {
  public constructor(public readonly remote: Obj) {
    super();
  }

  public shutdown = jest.fn();
}

export function mockNextParent<PI>(
  parentInterface: RemoteInterface<PI>,
): Promise<MockChildProcess> {
  return new Promise((resolve: (child: MockChildProcess) => void) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let { ParentProcess } = require("./parent");
    let mockParentConnect = mockedFunction(ParentProcess.connect);

    mockParentConnect.mockImplementation(
      (options?: ParentProcessOptions<unknown>): Promise<ParentProcess<unknown, unknown>> => {
        // @ts-ignore
        let mock = new MockParent(parentInterface);

        // @ts-ignore
        resolve(new MockChildProcess(mock, options?.localInterface));

        // @ts-ignore
        return mock;
      },
    );
  });
}
