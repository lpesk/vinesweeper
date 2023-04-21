# Build

You'll need to install [wasm-pack](https://github.com/rustwasm/wasm-pack) and its dependencies.
Then run `wasm-pack build --target web --no-typescript --no-pack` from the project root.

# Run locally

Just start an http server from the project root (for example, with `python3 -m http.server`). Then open `localhost:<port>` in a web browser, where `<port>` is the port number for your server.

# Debug

To enable some debugging helpers, uncomment `debugSetup()` in `main.js`. Then you can use the JS console to add and remove text from the window and start the animation on command. You can also build the project in debug or profiling mode by adding `--dev` or `--profiling` to the `wasm-pack build` command.

# Caveats

* Only tested in Chrome for now, might look unpleasant in other browers.
* Currently the simulation runs forever even after it reaches a steady state, so be sure to stop the server or close the tab when you're done.
