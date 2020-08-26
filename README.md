# Pixelbin Server

This is the main server and web client for the PixelBin project. The interesting pieces are in the
[`src`](/Mossop/pixelbin/tree/main/src) directory.

The source is split into three main parts:

## [`model`](/Mossop/pixelbin/tree/main/src/model)

Holds the fundamental object model and API types used in the server and for communication with the
web client.

## [`server`](/Mossop/pixelbin/tree/main/src/server)

The server which is itself split into the [`main`](/Mossop/pixelbin/tree/main/src/server/main)
server process, the [`webserver`](/Mossop/pixelbin/tree/main/src/server/webserver) child process and
[`task-worker`](/Mossop/pixelbin/tree/main/src/server/task-worker) child process. The main server
process may spawn multiple of these child processes to handle work as demands require.

The server code also contains the shared code for accessing the database and the file storage
system.

## [`client`](/Mossop/pixelbin/tree/main/src/client)

A React/Redux based application served by the webserver which forms the web view of the PixelBin
project.
