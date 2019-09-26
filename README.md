# Pixelbin Server

This is the main server responsible for handing http traffic. It is comprised of a couple of parts. The organisation of these parts isn't great right now.

## `api`

This is a django application that serves the pixelbin API used by both the web application and the Lightroom plugin.

## `app/js`

This is the web application that is accessed through a browser. It is a react/redux JavaScript app and communicates with the pixelbin API.

## `app`

A dumb django application that serves only to deliver the web application's base webpage and the initial state.
