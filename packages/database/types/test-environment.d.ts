import NodeEnvironment from "jest-environment-node";
export default class DatabaseEnvironment extends NodeEnvironment {
    setup(): Promise<void>;
    teardown(): Promise<void>;
}
