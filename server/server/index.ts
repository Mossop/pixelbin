import { MasterProcess } from "../shared/ipc/master";

export default function server(): void {
  new MasterProcess();
}
