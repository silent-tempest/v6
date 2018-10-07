# v6.js

A JavaScript (ES5) library for rendering. The main feature is one API for WebGL and 2D contexts.

### Installing

Installing via [npm](https://www.npmjs.com/): `$ npm install --save github:silent-tempest/v6.js#dev`.

### Example

* Importing the library.

```javascript
var createRenderer = require( 'v6.js/core/renderer' );
var constants      = require( 'v6.js/core/constants' );
var HSLA           = require( 'v6.js/core/color/HSLA' );
var Ticker         = require( 'v6.js/core/Ticker' );
```

* Creating a renderer.

```javascript
var renderer = createRenderer( {
  settings: {
    color: HSLA
  },

  type: constants.get( 'RENDERER_AUTO' )
} );
```

* Creating a ticker.

```javascript
var ticker = new Ticker();
```

* Adding a render function to the ticker.

```javascript
ticker.on( 'render', function ()
{
  var hue = Math.floor( this.totalTime * 10 );
  renderer.background( hue, 80, 80 );
  renderer.stroke( 'white' );
  renderer.fill( 'black' );
  renderer.polygon( renderer.w / 2, renderer.h / 2, 100, 5 );
} );
```

* Starting the application.

```javascript
ticker.start();
```

* Adding auto-resize for the renderer.

```javascript
window.addEventListener( 'resize', function ()
{
  renderer.resizeTo( this );
} );
```

### Development

* `make karma:start_static_server &`

#### Before Committing

* `rm -Rf docs dist && npm run prepublish`

#### Testing

* `make mocha`
* `make karma`
* `make make karma:start &`, `make karma:run`

### License

Released under the [GPL-3.0](LICENSE).
