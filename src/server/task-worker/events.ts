import { SharedEmitter } from "../../utils";

const events = new SharedEmitter<{
  shutdown: [];
}>();

export default events;
