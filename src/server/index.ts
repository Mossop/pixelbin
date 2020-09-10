import { main } from "./main";

main(process.argv.slice(2))
  .catch((error: unknown) => {
    console.error("Server startup threw error.", error);
  });
