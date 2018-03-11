/*!
 * Copyright (c) 2017-2018 SILENT
 * Released under the MIT License.
 * v6.js - Simple graphics library.
 * https://github.com/silent-tempest/v6
 * p5.js:
 * https://github.com/processing/p5.js/
 */

/* jshint esversion: 5, unused: true, undef: true, noarg: true, curly: true, immed: true */
/* global Float32Array, Uint8ClampedArray, ImageData, document, platform, console */

;( function ( window, undefined ) {

'use strict';

var _ = window.peako,
    floor = Math.floor,
    round = Math.round,
    atan2 = Math.atan2,
    rand = Math.random,
    sqrt = Math.sqrt,
    cos = Math.cos,
    sin = Math.sin,
    min = Math.min,
    max = Math.max,
    pi = Math.PI,
    renderer_index = -1;

var report = ( function () {
  var reported = {};

  return function ( msg ) {
    if ( reported[ msg ] ) {
      return;
    }

    if ( typeof console != 'undefined' && console.warn ) {
      console.warn( msg );
    }

    reported[ msg ] = true;
  };
} )();

var deprecated = function ( foo, bar, baz ) {
  report( foo + ': ' + bar + ' is deprecated now and will be removed, use ' + baz + ' instead.' );
};

/**
 * Copies elements from the `b` array to `a`. This is useful when `a` is
 * TypedArray, because it's faster:
 * https://jsperf.com/set-values-to-float32array-instance
 */

// var a = [],
//     b = [ 1, 2, 3 ];
// copy_array( a, b, b.length );
// // now `a` have the same elements with `b`.

var copy_array = function ( a, b, length ) {
  while ( --length >= 0 ) {
    a[ length ] = b[ length ];
  }

  return a;
};

var get_gl_ctx_name = _.once( function () {
  var canvas = document.createElement( 'canvas' ),
      type = null,
      types, i;

  if ( typeof canvas.getContext != 'function' ) {
    canvas = null;
    return null;
  }

  types = [
    // These types from:
    // https://m.habrahabr.ru/post/112430/
    // 'moz-webgl',
    // 'webkit-3d',
    'experimental-webgl',
    'webgl'
    // From MDN:
    // https://hacks.mozilla.org/2017/01/webgl-2-lands-in-firefox/
    // WebGL 2 is not strictly backwards compatible with WebGL 1
    // https://www.khronos.org/registry/webgl/specs/latest/2.0/#4.1
    // 'webgl2'
  ];

  for ( i = types.length - 1; i >= 0; --i ) {
    try {
      if ( canvas.getContext( types[ i ] ) ) {
        type = types[ i ];
        break;
      }
    } catch ( ex ) {}
  }

  canvas = null;
  return type;
} );

var get_renderer_auto_mode = _.once( function () {
  var touchable = 'ontouchend' in window && 'ontouchmove' in window && 'ontouchstart' in window,
      safari;

  if ( typeof platform != 'undefined' && platform ) {
    safari = platform.os &&
      platform.os.family === 'iOS' &&
      platform.name === 'Safari';
  } else {
    safari = false;
  }

  if ( touchable && !safari ) {
    return 'webgl';
  }

  return '2d';
} );

var v6 = function ( opts ) {
  var mode = opts && opts.mode || dflt_opts.renderer.mode;

  if ( mode === 'auto' ) {
    mode = get_renderer_auto_mode();
  }

  if ( mode === 'webgl' ) {
    if ( get_gl_ctx_name() ) {
      return new RendererWebGL( opts );
    }

    report( "It's not possible to get the WebGL context. The 2D context will be used instead" );
  }

  return new Renderer2D( opts );
};

var settings = {
  degrees: false
};

var dflt_opts = {
  renderer: {
    settings: {
      /** Pixel density of context. */
      scale: 1,
      /** You can think that this is a `ctx.imageSmoothingEnabled`. */
      smooth: false,
      colorMode: 'rgba'
    },

    /** One of: "2d", "webgl", "auto". */
    mode: '2d',
    /**
     * MDN: Boolean that indicates if the canvas contains an alpha channel. If
     * set to false, the browser now knows that the backdrop is always opaque,
     * which can speed up drawing of transparent content and images.
     * https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
     */
    alpha: true,
    /** Will be renderer added to the DOM? */
    append: true,
    blending: true,
    antialias: true
  }
};

var dflt_draw_settings = {
  _rectAlignX:   'left',
  _rectAlignY:   'top',
  _doFill:       true,
  _doStroke:     true,
  // _fillColor:    renderer.color(),
  // _font:         new Font(),
  // todo move lineHeight to font
  _lineHeight:   14,
  _lineWidth:    2,
  // _strokeColor:  renderer.color(),
  _textAlign:    'left',
  _textBaseline: 'top'
};

// v6.map( 20, 0, 100, 0, 1 );
// // -> 0.2
// v6.map( -0.1, -1, 1, 0, 10 );
// // -> 4.5
// v6.map( 2, 0, 1, 0, 10 );
// // -> 20
// v6.map( 2, 0, 1, 0, 10, true );
// // -> 10

var map = function ( val, start1, stop1, start2, stop2, clamp ) {
  val = ( ( val - start1 ) / ( stop1 - start1 ) ) * ( stop2 - start2 ) + start2;

  if ( !clamp ) {
    return val;
  }

  if ( start2 < stop2 ) {
    return _.clamp( val, start2, stop2 );
  }

  return _.clamp( val, stop2, start2 );
};

/**
 * Returns distance between two points.
 */

// v6.dist( 0, 0, 1, 1 );
// // -> 1.4142135623730951

var dist = function ( x1, y1, x2, y2 ) {
  return sqrt( ( x2 - x1 ) * ( x2 - x1 ) + ( y2 - y1 ) * ( y2 - y1 ) );
};

/**
 * Returns the interpolated color between the `a` and `b` colors.
 */

// var
//   red = v6.hsla( 0, 50, 100 ),
//   blue = v6.rgba( 0, 0, 255 );
//
// var purple = v6.lerpColor( red, blue, 0.5 );
// // -> hsla purple color
// var purple = v6.lerpColor( 'red', 'blue', 0.5 );
// // -> rgba purple color

var lerpColor = function ( a, b, val ) {
  if ( typeof a != 'object' ) {
    a = parse_color( a );
  }

  return a.lerp( b, val );
};

/**
 * Returns the interpolated value between the `a` and `b` values.
 */

// v6.lerp( 0, 10, 0.5 );
// // -> 5

var lerp = function ( a, b, value ) {
  return a + ( b - a ) * value;
};

/**
 * Used to set the default drawing settings to a new renderer or when
 * renderer.pop() called with empty stack of saved drawing settings.
 */
var set_dflt_draw_settings = function ( obj, renderer ) {
  copy_draw_settings( obj, dflt_draw_settings );
  obj._strokeColor = renderer.color();
  obj._fillColor = renderer.color();
  obj._font = new Font();
  return obj;
};

/**
 * Copy the drawing settings from `src` to another object. When `all` is true, it
 * will also copy the nested objects: "_strokeStyle", "_fillStyle", "_font".
 */
var copy_draw_settings = function ( obj, src, all ) {
  if ( all ) {
    obj._fillColor[ 0 ]   = src._fillColor[ 0 ];
    obj._fillColor[ 1 ]   = src._fillColor[ 1 ];
    obj._fillColor[ 2 ]   = src._fillColor[ 2 ];
    obj._fillColor[ 3 ]   = src._fillColor[ 3 ];
    obj._font.style       = src._font.style;
    obj._font.variant     = src._font.variant;
    obj._font.weight      = src._font.weight;
    obj._font.size        = src._font.size;
    obj._font.family      = src._font.family;
    obj._strokeColor[ 0 ] = src._strokeColor[ 0 ];
    obj._strokeColor[ 1 ] = src._strokeColor[ 1 ];
    obj._strokeColor[ 2 ] = src._strokeColor[ 2 ];
    obj._strokeColor[ 3 ] = src._strokeColor[ 3 ];
  }

  obj._rectAlignX   = src._rectAlignX;
  obj._rectAlignY   = src._rectAlignY;
  obj._doFill       = src._doFill;
  obj._doStroke     = src._doStroke;
  obj._lineHeight   = src._lineHeight;
  obj._lineWidth    = src._lineWidth;
  obj._textAlign    = src._textAlign;
  obj._textBaseline = src._textBaseline;

  return obj;
};

var set_image_smoothing = function ( ctx, val ) {
  ctx.imageSmoothingEnabled =
    ctx.oImageSmoothingEnabled =
    ctx.msImageSmoothingEnabled =
    ctx.mozImageSmoothingEnabled =
    ctx.webkitImageSmoothingEnabled = val;

  return ctx.imageSmoothingEnabled;
};

/**
 * Used to implement the .rectAlign() method.
 */

// var
//   x = 100,
//   w = 50;
//
// x = align( x, w, 'center' );
// // -> 75

var align = function ( value, size, align ) {
  switch ( align ) {
    case 'left':
    case 'top':
      return value;
    case 'center':
    case 'middle':
      return value - size * 0.5;
    case 'right':
    case 'bottom':
      return value - size;
  }

  return 0;
};

/* FILTERS */

var filters = {
  negative: function ( data ) {
    var r = data.length - 4;

    for ( ; r >= 0; r -= 4 ) {
      data[ r ] = 255 - data[ r ];
      data[ r + 1 ] = 255 - data[ r + 1 ];
      data[ r + 2 ] = 255 - data[ r + 2 ];
    }

    return data;
  },

  contrast: function ( data ) {
    var r = data.length - 4;

    for ( ; r >= 0; r -= 4 ) {
      data[ r ] = data[ r + 1 ] = data[ r + 2 ] =
        data[ r ] * 0.299 + data[ r + 1 ] * 0.587 + data[ r + 2 ] * 0.114;
    }

    return data;
  },

  sepia: function ( data ) {
    var i = data.length - 4,
        r, g, b;

    for ( ; i >= 0; i -= 4 ) {
      r = data[ i ];
      g = data[ i + 1 ];
      b = data[ i + 2 ];
      data[ i ] = r * 0.393 + g * 0.769 + b * 0.189;
      data[ i + 1 ] = r * 0.349 + g * 0.686 + b * 0.168;
      data[ i + 2 ] = r * 0.272 + g * 0.534 + b * 0.131;
    }

    return data;
  }
};

/* TICKER */

var ticker = function ( update, render, ctx ) {
  return new Ticker( update, render, ctx );
};

var Ticker = function ( update, render, ctx ) {
  var that = this;

  // v6.ticker( render );
  if ( render == null ) {
    render = update;
    update = _.noop;
  }

  this.lastReqAnimId = 0;
  this.lastTime = 0;
  this.totalTime = 0;
  this.skipped = 0;
  this.stopped = true;
  this.update = update;
  this.render = render;

  if ( ctx === undefined ) {
    ctx = this;
  }

  this.tick = function ( now ) {
    var step = that.step,
        dt;

    if ( that.stopped ) {
      // if this call not from requestAnimationFrame
      // we do return to get deltaTime > 0
      if ( !now ) {
        that.lastReqAnimId = _.timer.request( that.tick );
        that.lastTime = _.timestamp();
        that.stopped = false;
      }

      return;
    }

    // User call, e.g. ticker.tick()
    if ( !now ) {
      now = _.timestamp();
    }

    dt = min( 1, ( now - that.lastTime ) * 0.001 );
    that.skipped += dt;
    that.totalTime += dt;

    while ( that.skipped > step && !that.stopped ) {
      that.skipped -= step;

      if ( ctx ) {
        that.update.call( ctx, step, now );
      } else {
        that.update( step, now );
      }
    }

    if ( ctx ) {
      that.render.call( ctx, dt, now );
    } else {
      that.render( dt, now );
    }

    that.lastTime = now;
    that.lastReqAnimId = _.timer.request( that.tick );
    return this;
  };
};

Ticker.prototype = {
  stop: function () {
    this.stopped = true;
    return this;
  },

  setFrameRate: function ( fps ) {
    this.step = 1 / fps;
    return this;
  },

  clear: function () {
    this.skipped = 0;
    return this;
  },

  constructor: Ticker,
  step: 1 / 60
};

/* VECTOR2D */

var vec2 = function ( x, y ) {
  return new Vector2D( x, y );
};

var Vector2D = function ( x, y ) {
  this.set( x, y );
};

Vector2D.prototype = {
  set: function ( x, y ) {
    if ( _.isObjectLike( x ) ) {
      deprecated( 'v6.Vector2D', '.set( vector )', '.setVector( vector )' );
      this.setVector( x );
    } else {
      this.x = x || 0;
      this.y = y || 0;
    }

    return this;
  },

  setVector: function ( vec ) {
    this.x = vec.x || 0;
    this.y = vec.y || 0;
    return this;
  },

  lerp: function ( x, y, val ) {
    if ( _.isObjectLike( x ) ) {
      deprecated( 'v6.Vector2D', '.lerp( vector )', '.lerpVector( vector )' );
      this.lerpVector( x, y );
    } else {
      this.x += ( x - this.x ) * val || 0;
      this.y += ( y - this.y ) * val || 0;
    }

    return this;
  },

  lerpVector: function ( vec, val ) {
    this.x += ( vec.x - this.x ) * val || 0;
    this.y += ( vec.y - this.y ) * val || 0;
    return this;
  },

  add: function ( x, y ) {
    if ( _.isObjectLike( x ) ) {
      deprecated( 'v6.Vector2D', '.add( vector )', '.addVector( vector )' );
      this.addVector( x );
    } else {
      this.x += x || 0;
      this.y += y || 0;
    }

    return this;
  },

  addVector: function ( vec ) {
    this.x += vec.x || 0;
    this.y += vec.y || 0;
    return this;
  },

  sub: function ( x, y ) {
    if ( _.isObjectLike( x ) ) {
      deprecated( 'v6.Vector2D', '.sub( vector )', '.subVector( vector )' );
      this.subVector( x );
    } else {
      this.x -= x || 0;
      this.y -= y || 0;
    }

    return this;
  },

  subVector: function ( vec ) {
    this.x -= vec.x || 0;
    this.y -= vec.y || 0;
    return this;
  },

  mult: function ( val ) {
    this.x *= val || 0;
    this.y *= val || 0;
    return this;
  },

  multVector: function ( vec ) {
    this.x *= vec.x || 0;
    this.y *= vec.y || 0;
    return this;
  },

  div: function ( val ) {
    this.x /= val || 0;
    this.y /= val || 0;
    return this;
  },

  divVector: function ( vec ) {
    this.x /= vec.x || 0;
    this.y /= vec.y || 0;
    return this;
  },

  angle: function () {
    if ( settings.degrees ) {
      return atan2( this.y, this.x ) * 180 / pi;
    }

    return atan2( this.y, this.x );
  },

  mag: function () {
    return sqrt( this.magSq() );
  },

  magSq: function () {
    return this.x * this.x + this.y * this.y;
  },

  setMag: function ( val ) {
    return this.normalize().mult( val );
  },

  normalize: function () {
    var mag = this.mag();

    if ( mag && mag !== 1 ) {
      this.div( mag );
    }

    return this;
  },

  dot: function ( x, y ) {
    if ( typeof x != 'object' || x === null ) {
      return this.x * ( x || 0 ) + this.y * ( y || 0 );
    }

    return this.x * ( x.x || 0 ) + this.y * ( x.y || 0 );
  },

  copy: function () {
    return new Vector2D( this.x, this.y );
  },

  dist: function ( vec ) {
    return dist( this.x, this.y, vec.x, vec.y );
  },

  limit: function ( value ) {
    var mag = this.magSq();

    if ( mag > value * value && ( mag = sqrt( mag ) ) ) {
      this.div( mag ).mult( value );
    }

    return this;
  },

  cross: function ( vector ) {
    return Vector2D.cross( this, vector );
  },

  toString: function () {
    return 'vec2(' +
      this.x.toFixed( 2 ) + ', ' +
      this.y.toFixed( 2 ) + ')';
  },

  rotate: function ( angle ) {
    var x = this.x,
        y = this.y,
        c, s;

    if ( settings.degrees ) {
      angle *= pi / 180;
    }

    c = cos( angle );
    s = sin( angle );

    this.x = x * c - y * s;
    this.y = x * s + y * c;

    return this;
  },

  setAngle: function ( angle ) {
    var mag = this.mag();

    if ( settings.degrees ) {
      angle *= pi / 180;
    }

    this.x = mag * cos( angle );
    this.y = mag * sin( angle );

    return this;
  },

  constructor: Vector2D
};

/* VECTOR3D */

var vec3 = function ( x, y, z ) {
  return new Vector3D( x, y, z );
};

var Vector3D = function ( x, y, z ) {
  this.set( x, y, z );
};

Vector3D.prototype = {
  set: function ( x, y, z ) {
    if ( _.isObjectLike( x ) ) {
      deprecated( 'v6.Vector3D', '.set( vector )', '.setVector( vector )' );
      this.setVector( x );
    } else {
      this.x = x || 0;
      this.y = y || 0;
      this.z = z || 0;
    }

    return this;
  },

  setVector: function ( vec ) {
    this.x = vec.x || 0;
    this.y = vec.y || 0;
    this.z = vec.z || 0;
    return this;
  },

  lerp: function ( x, y, z, val ) {
    if ( _.isObjectLike( x ) ) {
      deprecated( 'v6.Vector3D', '.lerp( vector )', '.lerpVector( vector )' );
      this.lerpVector( x, y );
    } else {
      this.x += ( x - this.x ) * val || 0;
      this.y += ( y - this.y ) * val || 0;
      this.z += ( z - this.z ) * val || 0;
    }

    return this;
  },

  lerpVector: function ( vec, val ) {
    this.x += ( vec.x - this.x ) * val || 0;
    this.y += ( vec.y - this.y ) * val || 0;
    this.z += ( vec.z - this.z ) * val || 0;
    return this;
  },

  add: function ( x, y, z ) {
    if ( _.isObjectLike( x ) ) {
      deprecated( 'v6.Vector3D', '.add( vector )', '.addVector( vector )' );
      this.addVector( x );
    } else {
      this.x += x || 0;
      this.y += y || 0;
      this.z += z || 0;
    }

    return this;
  },

  addVector: function ( vec ) {
    this.x += vec.x || 0;
    this.y += vec.y || 0;
    this.z += vec.z || 0;
    return this;
  },

  sub: function ( x, y, z ) {
    if ( _.isObjectLike( x ) ) {
      deprecated( 'v6.Vector3D', '.sub( vector )', '.subVector( vector )' );
      this.subVector( x );
    } else {
      this.x -= x || 0;
      this.y -= y || 0;
      this.z -= z || 0;
    }

    return this;
  },

  subVector: function ( vec ) {
    this.x -= vec.x || 0;
    this.y -= vec.y || 0;
    this.z -= vec.z || 0;
    return this;
  },

  mult: function ( val ) {
    this.x *= val || 0;
    this.y *= val || 0;
    this.z *= val || 0;
    return this;
  },

  multVector: function ( vec ) {
    this.x *= vec.x || 0;
    this.y *= vec.y || 0;
    this.z *= vec.z || 0;
    return this;
  },

  div: function ( val ) {
    this.x /= val || 0;
    this.y /= val || 0;
    this.z /= val || 0;
    return this;
  },

  divVector: function ( vec ) {
    this.x /= vec.x || 0;
    this.y /= vec.y || 0;
    this.z /= vec.z || 0;
    return this;
  },

  magSq: function () {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  },

  dot: function ( x, y, z ) {
    if ( typeof x != 'object' || x === null ) {
      return this.x * ( x || 0 ) +
             this.y * ( y || 0 ) +
             this.z * ( z || 0 );
    }

    return this.x * ( x.x || 0 ) +
           this.y * ( x.y || 0 ) +
           this.z * ( x.z || 0 );
  },

  copy: function () {
    return new Vector3D( this.x, this.y, this.z );
  },

  dist: function ( vec ) {
    var x = ( vec.x - this.x ),
        y = ( vec.y - this.y ),
        z = ( vec.z - this.z );

    return sqrt( x * x + y * y + z * z );
  },

  toString: function () {
    return 'vec3(' +
      this.x.toFixed( 2 ) + ', ' +
      this.y.toFixed( 2 ) + ', ' +
      this.z.toFixed( 2 ) + ')';
  },

  constructor: Vector3D
};

Vector3D.prototype.angle     = Vector2D.prototype.angle;
Vector3D.prototype.mag       = Vector2D.prototype.mag;
Vector3D.prototype.setMag    = Vector2D.prototype.setMag;
Vector3D.prototype.normalize = Vector2D.prototype.normalize;
Vector3D.prototype.limit     = Vector2D.prototype.limit;
Vector3D.prototype.rotate    = Vector2D.prototype.rotate;
Vector3D.prototype.setAngle  = Vector2D.prototype.setAngle;

_.forEach( [
  'normalize',
  'setMag',
  'rotate',
  'limit',
  'lerp',
  'mult',
  'div',
  'add',
  'sub',
  'set'
], function ( name ) {
  Vector2D[ name ] = Vector3D[ name ] =
  /* jshint evil: true */
    Function( 'vec, x, y, z, val', 'return vec.copy().' + name + '( x, y, z, val );' );
  /* jshint evil: false */
} );

Vector2D.angle = Vector3D.angle = function ( x, y ) {
  if ( settings.degrees ) {
    return atan2( y, x ) * 180 / pi;
  }

  return atan2( y, x );
};

Vector2D.random = function () {
  return Vector2D.fromAngle( rand() * ( settings.degrees ? 360 : pi * 2 ) );
};

Vector3D.random = function () {
  var angle = rand() * pi * 2,
      z = rand() * 2 - 1,
      z_base = sqrt( 1 - z * z );

  return new Vector3D( z_base * cos( angle ), z_base * sin( angle ), z );
};

Vector2D.fromAngle = function ( angle ) {
  if ( settings.degrees ) {
    angle *= pi / 180;
  }

  return new Vector2D( cos( angle ), sin( angle ) );
};

Vector3D.fromAngle = function ( angle ) {
  if ( settings.degrees ) {
    angle *= pi / 180;
  }

  return new Vector3D( cos( angle ), sin( angle ) );
};

Vector2D.cross = function ( a, b ) {
  return a.x * b.y - a.y * b.x;
};

/* COLORS */

var colors = {
  aliceblue:       'f0f8ffff', antiquewhite:         'faebd7ff',
  aqua:            '00ffffff', aquamarine:           '7fffd4ff',
  azure:           'f0ffffff', beige:                'f5f5dcff',
  bisque:          'ffe4c4ff', black:                '000000ff',
  blanchedalmond:  'ffebcdff', blue:                 '0000ffff',
  blueviolet:      '8a2be2ff', brown:                'a52a2aff',
  burlywood:       'deb887ff', cadetblue:            '5f9ea0ff',
  chartreuse:      '7fff00ff', chocolate:            'd2691eff',
  coral:           'ff7f50ff', cornflowerblue:       '6495edff',
  cornsilk:        'fff8dcff', crimson:              'dc143cff',
  cyan:            '00ffffff', darkblue:             '00008bff',
  darkcyan:        '008b8bff', darkgoldenrod:        'b8860bff',
  darkgray:        'a9a9a9ff', darkgreen:            '006400ff',
  darkkhaki:       'bdb76bff', darkmagenta:          '8b008bff',
  darkolivegreen:  '556b2fff', darkorange:           'ff8c00ff',
  darkorchid:      '9932ccff', darkred:              '8b0000ff',
  darksalmon:      'e9967aff', darkseagreen:         '8fbc8fff',
  darkslateblue:   '483d8bff', darkslategray:        '2f4f4fff',
  darkturquoise:   '00ced1ff', darkviolet:           '9400d3ff',
  deeppink:        'ff1493ff', deepskyblue:          '00bfffff',
  dimgray:         '696969ff', dodgerblue:           '1e90ffff',
  feldspar:        'd19275ff', firebrick:            'b22222ff',
  floralwhite:     'fffaf0ff', forestgreen:          '228b22ff',
  fuchsia:         'ff00ffff', gainsboro:            'dcdcdcff',
  ghostwhite:      'f8f8ffff', gold:                 'ffd700ff',
  goldenrod:       'daa520ff', gray:                 '808080ff',
  green:           '008000ff', greenyellow:          'adff2fff',
  honeydew:        'f0fff0ff', hotpink:              'ff69b4ff',
  indianred:       'cd5c5cff', indigo:               '4b0082ff',
  ivory:           'fffff0ff', khaki:                'f0e68cff',
  lavender:        'e6e6faff', lavenderblush:        'fff0f5ff',
  lawngreen:       '7cfc00ff', lemonchiffon:         'fffacdff',
  lightblue:       'add8e6ff', lightcoral:           'f08080ff',
  lightcyan:       'e0ffffff', lightgoldenrodyellow: 'fafad2ff',
  lightgrey:       'd3d3d3ff', lightgreen:           '90ee90ff',
  lightpink:       'ffb6c1ff', lightsalmon:          'ffa07aff',
  lightseagreen:   '20b2aaff', lightskyblue:         '87cefaff',
  lightslateblue:  '8470ffff', lightslategray:       '778899ff',
  lightsteelblue:  'b0c4deff', lightyellow:          'ffffe0ff',
  lime:            '00ff00ff', limegreen:            '32cd32ff',
  linen:           'faf0e6ff', magenta:              'ff00ffff',
  maroon:          '800000ff', mediumaquamarine:     '66cdaaff',
  mediumblue:      '0000cdff', mediumorchid:         'ba55d3ff',
  mediumpurple:    '9370d8ff', mediumseagreen:       '3cb371ff',
  mediumslateblue: '7b68eeff', mediumspringgreen:    '00fa9aff',
  mediumturquoise: '48d1ccff', mediumvioletred:      'c71585ff',
  midnightblue:    '191970ff', mintcream:            'f5fffaff',
  mistyrose:       'ffe4e1ff', moccasin:             'ffe4b5ff',
  navajowhite:     'ffdeadff', navy:                 '000080ff',
  oldlace:         'fdf5e6ff', olive:                '808000ff',
  olivedrab:       '6b8e23ff', orange:               'ffa500ff',
  orangered:       'ff4500ff', orchid:               'da70d6ff',
  palegoldenrod:   'eee8aaff', palegreen:            '98fb98ff',
  paleturquoise:   'afeeeeff', palevioletred:        'd87093ff',
  papayawhip:      'ffefd5ff', peachpuff:            'ffdab9ff',
  peru:            'cd853fff', pink:                 'ffc0cbff',
  plum:            'dda0ddff', powderblue:           'b0e0e6ff',
  purple:          '800080ff', red:                  'ff0000ff',
  rosybrown:       'bc8f8fff', royalblue:            '4169e1ff',
  saddlebrown:     '8b4513ff', salmon:               'fa8072ff',
  sandybrown:      'f4a460ff', seagreen:             '2e8b57ff',
  seashell:        'fff5eeff', sienna:               'a0522dff',
  silver:          'c0c0c0ff', skyblue:              '87ceebff',
  slateblue:       '6a5acdff', slategray:            '708090ff',
  snow:            'fffafaff', springgreen:          '00ff7fff',
  steelblue:       '4682b4ff', tan:                  'd2b48cff',
  teal:            '008080ff', thistle:              'd8bfd8ff',
  tomato:          'ff6347ff', turquoise:            '40e0d0ff',
  violet:          'ee82eeff', violetred:            'd02090ff',
  wheat:           'f5deb3ff', white:                'ffffffff',
  whitesmoke:      'f5f5f5ff', yellow:               'ffff00ff',
  yellowgreen:     '9acd32ff', transparent:          '00000000'
};

var regexps = {
  hsl:  /^hsl\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\u0025\s*,\s*(\d+|\d*\.\d+)\u0025\s*\)$|^\s*hsla\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\u0025\s*,\s*(\d+|\d*\.\d+)\u0025\s*,\s*(\d+|\d*\.\d+)\s*\)$/,
  rgb:  /^rgb\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*\)$|^\s*rgba\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*\)$/,
  hex:  /^#([0-9a-f]{6})([0-9a-f]{2})?$/,
  hex3: /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/
};

var parsed = _.create( null ),
    transparent = [ 0, 0, 0, 0 ];

var color = function ( a, b, c, d ) {
  if ( typeof a != 'string' ) {
    return new RGBA( a, b, c, d );
  }

  return parse_color( a );
};

/**
 * parse_color( '#f0f0' );
 * // -> rgba(255, 0, 255, 0)
 * parse_color( '#000000ff' );
 * // -> rgba(0, 0, 0, 1)
 * parse_color( 'magenta' );
 * // -> rgba(255, 0, 255, 1)
 * parse_color( 'transparent' );
 * // -> rgba(0, 0, 0, 0)
 * parse_color( 'hsl( 0, 100%, 50% )' );
 * // -> hsla(0, 100%, 50%, 1)
 * parse_color( 'hsla( 0, 100%, 50%, 0.5 )' );
 * // -> hsla(0, 100%, 50%, 0.5)
 */
var parse_color = function ( str ) {
  var cache = parsed[ str ] ||
    parsed[ str = _.trim( str ).toLowerCase() ];

  if ( !cache ) {
    if ( ( cache = colors[ str ] ) ) {
      cache = parsed[ str ] = new ColorData( parse_hex( cache ), RGBA );
    } else if ( ( cache = regexps.hex.exec( str ) ) ) {
      cache = parsed[ str ] = new ColorData( parse_hex( format_hex( cache ) ), RGBA );
    } else if ( ( cache = regexps.rgb.exec( str ) ) ) {
      cache = parsed[ str ] = new ColorData( compact_match( cache ), RGBA );
    } else if ( ( cache = regexps.hsl.exec( str ) ) ) {
      cache = parsed[ str ] = new ColorData( compact_match( cache ), HSLA );
    } else if ( ( cache = regexps.hex3.exec( str ) ) ) {
      cache = parsed[ str ] = new ColorData( parse_hex( format_hex( cache, true ) ), RGBA );
    } else {
      throw SyntaxError( str + " isn't valid syntax" );
    }
  }

  return new cache.constructor( cache[ 0 ], cache[ 1 ], cache[ 2 ], cache[ 3 ] );
};

/**
 * format_hex( [ '#000000ff', '000000', 'ff' ] );
 * // -> '000000ff'
 * format_hex( [ '#0007', '0', '0', '0', '7' ], true );
 * // -> '00000077'
 * format_hex( [ '#000', '0', '0', '0', null ], true );
 * // -> '000000ff'
 * Theoretically, because I didn't test these examples.
 */
var format_hex = function ( match, short_syntax ) {
  var r, g, b, a;

  if ( !short_syntax ) {
    return match[ 1 ] + ( match[ 2 ] || 'ff' );
  }

  r = match[ 1 ];
  g = match[ 2 ];
  b = match[ 3 ];
  a = match[ 4 ] || 'f';

  return r + r + g + g + b + b + a + a;
};

/**
 * parse_hex( '00000000' );
 * // -> [ 0, 0, 0, 0 ]
 * parse_hex( 'ff00ffff' );
 * // -> [ 255, 0, 255, 1 ]
 */
var parse_hex = function ( hex ) {
  if ( hex == 0 ) {
    return transparent;
  }

  hex = window.parseInt( hex, 16 );

  return [
    hex >> 24 & 255,
    hex >> 16 & 255,
    hex >> 8 & 255,
    ( hex & 255 ) / 255
  ];
};

/**
 * compact_match( [ 'hsl( 0, 0%, 0% )', '0', '0', '0', null, null, null, null ] );
 * // -> [ '0', '0', '0' ]
 * compact_match( [ 'rgba( 0, 0, 0, 0 )', null, null, null, '0', '0', '0', '0' ] );
 * // -> [ '0', '0', '0', '0' ]
 */
var compact_match = function ( match ) {
  if ( match[ 7 ] ) {
    return [ +match[ 4 ], +match[ 5 ], +match[ 6 ], +match[ 7 ] ];
  }

  return [ +match[ 1 ], +match[ 2 ], +match[ 3 ] ];
};

// I want to make that the methods
// of RGBA and HSLA prototypes change
// the objects on which they are called.
// For example, shade, lerp, darken, lighten...

var rgba = function ( r, g, b, a ) {
  return new RGBA( r, g, b, a );
};

var RGBA = function ( r, g, b, a ) {
  this.set( r, g, b, a );
};

RGBA.prototype.type = 'rgba';

RGBA.prototype.contrast = function () {
  return this[ 0 ] * 0.299 + this[ 1 ] * 0.587 + this[ 2 ] * 0.114;
};

RGBA.prototype.toString = function () {
  return 'rgba(' +
    this[ 0 ] + ', ' +
    this[ 1 ] + ', ' +
    this[ 2 ] + ', ' +
    this[ 3 ] + ')';
};

/**
 * .set( 'magenta' );
 * // r = 255, g = 0, b = 255, a = 1
 * .set( '#ff00ff' );
 * // r = 255, g = 0, b = 255, a = 1
 * .set( 'rgb( 0, 0, 0 )' );
 * // r = 0, g = 0, b = 0, a = 1
 * .set( 0 );
 * // ( r, g, b ) = 0, a = 1
 * .set( 0, 0 );
 * // ( r, g, b ) = 0, a = 0
 * .set( 0, 0, 0 );
 * // r = 0, g = 0, b = 0, a = 1
 * .set( 0, 0, 0, 0 );
 * // r = 0, g = 0, b = 0, a = 0
 */
RGBA.prototype.set = function ( r, g, b, a ) {
  if ( typeof r != 'string' && typeof r != 'object' || r == null ) {
    switch ( undefined ) {
      case r: a = 1; b = g = r = 0; break;
      case g: a = 1; b = g = r = floor( r ); break;
      case b: a = g; b = g = r = floor( r ); break;
      case a: a = 1; /* falls through */
      default: r = floor( r ); g = floor( g ); b = floor( b );
    }

    this[ 0 ] = r;
    this[ 1 ] = g;
    this[ 2 ] = b;
    this[ 3 ] = a;
  } else {
    if ( typeof r == 'string' ) {
      r = parse_color( r );
    }

    if ( r.type !== this.type ) {
      r = r[ this.type ]();
    }

    this[ 0 ] = r[ 0 ];
    this[ 1 ] = r[ 1 ];
    this[ 2 ] = r[ 2 ];
    this[ 3 ] = r[ 3 ];
  }

  return this;
};

/**
 * v6.rgba( 255, 0, 0 ).hsla();
 * // -> hsla(0, 100%, 50%, 1)
 */
RGBA.prototype.hsla = function () {
  var hsla = new HSLA(),
      r = this[ 0 ] / 255,
      g = this[ 1 ] / 255,
      b = this[ 2 ] / 255,
      greatest = max( r, g, b ),
      least = min( r, g, b ),
      diff = greatest - least,
      l = ( greatest + least ) * 50,
      h, s;

  if ( diff ) {
    s = l > 50 ?
      diff / ( 2 - greatest - least ) :
      diff / ( greatest + least );

    switch ( greatest ) {
      case r: h = g < b ? 1.0472 * ( g - b ) / diff + 6.2832 : 1.0472 * ( g - b ) / diff; break;
      case g: h = 1.0472 * ( b - r ) / diff + 2.0944; break;
      default: h = 1.0472 * ( r - g ) / diff + 4.1888;
    }

    h = round( h * 360 / 6.2832 );
    s = round( s * 100 );
  } else {
    h = s = 0;
  }

  hsla[ 0 ] = h;
  hsla[ 1 ] = s;
  hsla[ 2 ] = round( l );
  hsla[ 3 ] = this[ 3 ];

  return hsla;
};

// Uses in <v6.RendererWebGL>.
RGBA.prototype.rgba = function () {
  return this;
};

/**
 * v6.rgba( 100 ).lerp( 'black', 0.5 );
 * // rgba(50, 50, 50, 1)
 */
RGBA.prototype.lerp = function ( color, value ) {
  if ( typeof color != 'object' ) {
    color = parse_color( color );
  }

  if ( color.type !== 'rgba' ) {
    color = color.rgba();
  }

  return new RGBA(
    lerp( this[ 0 ], color[ 0 ], value ),
    lerp( this[ 1 ], color[ 1 ], value ),
    lerp( this[ 2 ], color[ 2 ], value ) );
};

// it requires optimization
RGBA.prototype.shade = function ( value ) {
  return this.hsla().shade( value ).rgba();
};

var hsla = function ( h, s, l, a ) {
  return new HSLA( h, s, l, a );
};

var HSLA = function ( h, s, l, a ) {
  this.set( h, s, l, a );
};

HSLA.prototype.type = 'hsla';

HSLA.prototype.toString = function () {
  return 'hsla(' +
    this[ 0 ] + ', ' +
    this[ 1 ] + '\u0025, ' +
    this[ 2 ] + '\u0025, ' +
    this[ 3 ] + ')';
};

HSLA.prototype.set = function ( h, s, l, a ) {
  if ( typeof h != 'object' && typeof h != 'string' || h == null ) {
    switch ( undefined ) {
      case h: a = 1; l = s = h = 0; break;
      case s: a = 1; l = floor( h ); s = h = 0; break;
      case l: a = s; l = floor( h ); s = h = 0; break;
      case a: a = 1; /* falls through */
      default: h = floor( h ); s = floor( s ); l = floor( l );
    }

    this[ 0 ] = h;
    this[ 1 ] = s;
    this[ 2 ] = l;
    this[ 3 ] = a;
  } else {
    if ( typeof h == 'string' ) {
      h = parse_color( h );
    }

    if ( h.type !== this.type ) {
      h = h[ this.type ]();
    }

    this[ 0 ] = h[ 0 ];
    this[ 1 ] = h[ 1 ];
    this[ 2 ] = h[ 2 ];
    this[ 3 ] = h[ 3 ];
  }

  return this;
};

var baz = function ( val, p, q ) {
  if ( val < 1 / 6 ) {
    return round( ( p + ( q - p ) * 6 * val ) * 255 );
  }

  if ( val < 0.5 ) {
    return round( q * 255 );
  }

  if ( val < 2 / 3 ) {
    return round( ( p + ( q - p ) * ( 2 / 3 - val ) * 6 ) * 255 );
  }

  return round( p * 255 );
};

HSLA.prototype.rgba = function () {
  var rgba = new RGBA(),
      h = this[ 0 ] % 360 / 360,
      s = this[ 1 ] * 0.01,
      l = this[ 2 ] * 0.01,
      q = l < 0.5 ? l * ( 1 + s ) : l + s - ( l * s ),
      p = 2 * l - q,
      tr = h + 1 / 3,
      tg = h,
      tb = h - 1 / 3;

  if ( tr < 0 ) {
    ++tr;
  }

  if ( tg < 0 ) {
    ++tg;
  }

  if ( tb < 0 ) {
   ++tb;
  }

  if ( tr > 1 ) {
    --tr;
  }

  if ( tg > 1 ) {
    --tg;
  }

  if ( tb > 1 ) {
    --tb;
  }

  rgba[ 0 ] = baz( tr, p, q );
  rgba[ 1 ] = baz( tg, p, q );
  rgba[ 2 ] = baz( tb, p, q );
  rgba[ 3 ] = this[ 3 ];

  return rgba;
};

HSLA.prototype.lerp = function ( color, value ) {
  var that = this.rgba();

  if ( typeof color != 'object' ) {
    color = parse_color( color );
  }

  if ( color.type !== 'rgba' ) {
    color = color.rgba();
  }

  return new RGBA(
    lerp( that[ 0 ], color[ 0 ], value ),
    lerp( that[ 1 ], color[ 1 ], value ),
    lerp( that[ 2 ], color[ 2 ], value ) ).hsla();
};

HSLA.prototype.contrast = function () {
  // can i make it more optimized?
  return this.rgba().contrast();
};

// it also requires optimization
HSLA.prototype.shade = function ( value ) {
  var shaded_hsl = new HSLA();
  shaded_hsl[ 0 ] = this[ 0 ];
  shaded_hsl[ 1 ] = this[ 1 ];
  shaded_hsl[ 2 ] = _.clamp( this[ 2 ] + value, 0, 100 );
  shaded_hsl[ 3 ] = this[ 3 ];
  return shaded_hsl;
};

var ColorData = function ( match, constructor ) {
  this[ 0 ] = match[ 0 ];
  this[ 1 ] = match[ 1 ];
  this[ 2 ] = match[ 2 ];
  this[ 3 ] = match[ 3 ];
  this.constructor = constructor;
};

/* FONT */

var is_global = function ( value ) {
  return value === 'inherit' || value === 'initial' || value === 'unset';
};

var is_font_style = function ( value ) {
  return value === 'normal' || value === 'italic' || value === 'oblique';
};

var is_font_variant = function ( value ) {
  return value === 'none' || value === 'normal' || value === 'small-caps';
};

var is_font_size = function ( value ) {
  return typeof value == 'number' ||
    /^(?:smaller|xx-small|x-small|small|medium|large|x-large|xx-large|larger|(\d+|\d*\.\d+)(px|em|\u0025|cm|in|mm|pc|pt|rem)?)$/.test( value );
};

var get_property_name = function ( value, name ) {
  switch ( true ) {
    case is_global( value ): return name;
    case is_font_style( value ): return 'style';
    case is_font_variant( value ): return 'variant';
    default: return 'weight';
  }
};

var font = function ( style, variant, weight, size, family ) {
  return new Font( style, variant, weight, size, family );
};

var Font = function ( style, variant, weight, size, family ) {
  this.set( style, variant, weight, size, family );
};

Font.prototype.style = Font.prototype.variant = Font.prototype.weight = 'normal';
Font.prototype.size = 'medium';
Font.prototype.family = 'sans-serif';

Font.prototype.get = function () {
  return [
    this.style, this.variant, this.weight, this.size,  this.family
  ];
};

/**
 * font.set( 'normal' );
 * font.set( 'Ubuntu' );
 * font.set( '24px', 'Ubuntu, sans-serif' );
 * font.set( 'small-caps', 'larger', 'sans-serif' );
 * font.set( 'italic', '300', '110%', 'serif' );
 * font.set( 'normal', 'normal', 'normal', 'medium', 'sans-serif' );
 */
Font.prototype.set = function ( style, variant, weight, size, family ) {
  if ( style == null ) {
    return this;
  }

  if ( typeof style != 'object' ) {
    if ( variant === undefined ) {
      if ( is_global( style ) || is_font_size( style ) ) {
        this.size = style;
      } else {
        this.family = style;
      }
    } else if ( weight === undefined ) {
      this.size = style;
      this.family = variant;
    } else if ( size === undefined ) {
      this[ get_property_name( style, 'style' ) ] = style;
      this.size = variant;
      this.family = weight;
    } else if ( family === undefined ) {
      var a = get_property_name( style, 'style' ),
          b = get_property_name( variant, a === 'style' ? 'variant' : 'weight' );

      if ( a === b ) {
        b = a === 'style' ? 'variant' : 'weight';
      }

      this[ a ] = style;
      this[ b ] = variant;
      this.size = weight;
      this.family = size;
    } else {
      this.style = style;
      this.variant = variant;
      this.weight = weight;
      this.size = size;
      this.family = family;
    }
  } else {
    this.style = style.style;
    this.variant = style.variant;
    this.weight = style.weight;
    this.size = style.size;
    this.family = style.family;
  }

  return this;
};

Font.prototype.toString = function () {
  return this.style + ' ' + this.variant + ' ' + this.weight + ' ' + ( typeof this.size == 'number' ? this.size + 'px ' : this.size + ' ' ) + this.family;
};

/* IMAGE */

var image = function ( path, x, y, w, h ) {
  return new Image( path, x, y, w, h );
};

/**
 * new v6.Image( <Image> );
 * new v6.Image( <v6.Image> );
 * new v6.Image( path to image );
 * // With the cropping:
 * new v6.Image( ..., crop x, crop y, crop w, crop h );
 * +------+
 * | 1--2 |
 * | |  | |
 * | 3--4 |
 * +------+
 * Where:
 * 1 = crop x
 * 2 = crop y
 * 3 = crop x + crop w
 * 4 = crop y + crop h
 */
var Image = function ( path, x, y, w, h ) {
  if ( path !== undefined ) {
    if ( path instanceof window.Image ) {
      this.source = path;
    } else if ( path instanceof Image ) {
      this.source = path.source;

      if ( !path.loaded ) {
        var image = this;

        _( this.source ).one( 'load', function () {
          image.set( x, y, w, h, true );
        } );
      } else {
        this.set( x, y, w, h, true );
      }
    } else {
      this.source = document.createElement( 'img' );
      this.load( path, x, y, w, h );
    }
  } else {
    this.source = document.createElement( 'img' );
  }
};

Image.prototype.x = Image.prototype.y = Image.prototype.width = Image.prototype.height = 0;
Image.prototype.loaded = false;
Image.prototype.path = '';

Image.prototype.set = function ( x, y, w, h, loaded ) {
  this.loaded = loaded;
  this.x = x ? floor( x ) : 0;
  this.y = y ? floor( y ) : 0;

  this.width = w == null ?
    floor( this.source.width - this.x ) : w ?
    floor( w ) : 0;

  this.height = h == null ?
    floor( this.source.height - this.y ) : h ?
    floor( h ) : 0;

  return this;
};

Image.prototype.load = function ( path, x, y, w, h ) {
  var image = this.set( 0, 0, 0, 0, false ),
      source = image.source;

  _( source ).one( 'load', function () {
    image.set( x, y, w, h, true );
  } );

  image.path = source.src = path;
  return image;
};

/* LOADER */

var loader = function () {
  return new Loader();
};

var Loader = function () {
  this.list = _.create( null );
};

Loader.prototype = {
  /**
   * .add( 'id', 'path.json' );
   * .add( 'path.json' );
   * .add( { id: 'path.json' } );
   * .add( [ 'path.json' ] );
   */
  add: function ( name, path ) {
    var len, i;

    if ( typeof name == 'object' ) {
      // .add( [ 'tiles.png', 'map.json' ] )
      if ( _.isArray( name ) ) {
        for ( len = name.length, i = 0; i < len; i += 2 ) {
          this.list[ name[ i ] ] = name[ i + 1 ];
        }
      // .add( { tiles: 'tiles.png', map: 'map.json' } )
      } else if ( name !== null ) {
        _.assign( this.list, name );
      // Check what are you doing!
      } else {
        throw TypeError();
      }
    // .add( 'tiles.png' )
    } else if ( path === undefined ) {
      this.list[ name ] = name;
    // .add( 'tiles', 'tiles.png' )
    } else {
      this.list[ name ] = path;
    }

    return this;
  },

  load: function () {
    return;
  },

  constructor: Loader
};

/* RENDERER2D SHAPES */

var shape = function ( draw, no_fill, no_stroke ) {
  return function ( vertices, close ) {
    var fill = !no_fill && this._doFill,
        stroke = !no_stroke && this._doStroke,
        context = this.context;

    if ( vertices.length && ( fill || stroke || no_stroke && no_fill ) ) {
      draw.call( this, context, vertices );

      if ( fill ) {
        this._fill();
      }

      if ( stroke ) {
        this._stroke( close );
      }
    }
  };
};

var shapes = {
  points: shape( function ( context, vertices ) {
    var len = vertices.length,
        r = this._lineWidth,
        i = 0;

    context.fillStyle = this._strokeColor;

    for ( ; i < len; i += 2 ) {
      context.beginPath();
      context.arc( vertices[ i ], vertices[ i + 1 ], r, 0, pi * 2 );
      context.fill();
    }
  }, true, true ),

  lines: shape( function ( context, vertices ) {
    var len = vertices.length,
        i = 2;

    context.beginPath();
    context.moveTo( vertices[ 0 ], vertices[ 1 ] );

    for ( ; i < len; i += 2 ) {
      context.lineTo( vertices[ i ], vertices[ i + 1 ] );
    }
  } )
};

/* RENDERER2D */

// var SCALE = window.devicePixelRatio || 1;
//
// var options = {
//   settings: {
//     scale: SCALE // default 1
//   }, // default dflt_opts.renderer.settings
//
//   alpha : false, // default true
//   width : 100,   // default window width
//   height: 100    // default window height
// }; // default dflt_opts.renderer
//
// var renderer = new v6.Renderer2D( options );

var Renderer2D = function ( options ) {
  options = defaults( options, dflt_opts.renderer );
  create_renderer( this, '2d', options );

  /**
   * This is necessary for some methods (setTransformFromCamera), which are
   * assigned from `Renderer2D` to` RendererWebGL`.
   */
  this.matrix = this.context;

  this.state = {
    beginPath: false
  };
};

/**
 * Adds <v6.Renderer2D>.canvas to the body element.
 */
Renderer2D.prototype.add = function () {
  return document.body.appendChild( this.canvas ), this;
};

/**
 * Removes all event listeners bound to <v6.Renderer2D>.canvas (via peako.js)
 * and remove it from the html.
 */
Renderer2D.prototype.destroy = function () {
  return _( this.canvas ).off().remove(), this;
};

Renderer2D.prototype.push = function () {
  if ( this._saves_stack[ ++this._cur_save_index ] ) {
    copy_draw_settings( this._saves_stack[ this._cur_save_index ], this );
  } else {
    this._saves_stack.push( set_dflt_draw_settings( {}, this ) );
  }

  return this;
};

Renderer2D.prototype.pop = function () {
  var save = this._saves_stack[ this._cur_save_index-- ];

  if ( save ) {
    copy_draw_settings( this, save, true );
  } else {
    set_dflt_draw_settings( this, this );
  }

  return this;
};

Renderer2D.prototype.smooth = function ( value ) {
  return this.settings.smooth = set_image_smoothing( this.context, value ), this;
};

Renderer2D.prototype.resize = function ( w, h ) {
  var scale = this.settings.scale,
      canvas = this.canvas,
      $win;

  if ( w === true ) {
    $win = _( canvas.ownerDocument.defaultView );
    w = $win.width();
    h = $win.height();
  }

  // Rescale canvas
  if ( w == null ) {
    w = this._canvas_w;
    h = this._canvas_h;
  } else {
    w = this._canvas_w = floor( w );
    h = this._canvas_h = floor( h );
  }

  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = this.width = floor( w * scale );
  canvas.height = this.height = floor( h * scale );
  return this;
};

Renderer2D.prototype.backgroundColor = function ( a, b, c, d ) {
  this.context.save();
  this.context.setTransform( this.settings.scale, 0, 0, this.settings.scale, 0, 0 );
  this.context.fillStyle = this.color( a, b, c, d );
  this.context.fillRect( 0, 0, this.width, this.height );
  this.context.restore();
  return this;
};

Renderer2D.prototype.backgroundImage = function ( img ) {
  var rectAlignX = this._rectAlignX,
      rectAlignY = this._rectAlignY;

  this._rectAlignX = 'left';
  this._rectAlignY = 'top';

  if ( img.width / ( img.height / this.height ) < this.width ) {
    this.image( img, 0, 0, this.width, 'auto' );
  } else {
    this.image( img, 0, 0, 'auto', this.height );
  }

  this._rectAlignX = rectAlignX;
  this._rectAlignY = rectAlignY;
  return this;
};

Renderer2D.prototype.background = function ( a, b, c, d ) {
  return this[ a instanceof Image ?
    'backgroundImage' :
    'backgroundColor' ]( a, b, c, d );
};

Renderer2D.prototype.clear = function ( x, y, w, h ) {
  if ( x === undefined ) {
    x = y = 0;
    w = this.width;
    h = this.height;
  } else {
    x = floor( align( x, w, this._rectAlignX ) );
    y = floor( align( y, h, this._rectAlignY ) );
  }

  this.context.clearRect( x, y, w, h );
  return this;
};

Renderer2D.prototype.rect = function ( x, y, w, h ) {
  x = floor( align( x, w, this._rectAlignX ) );
  y = floor( align( y, h, this._rectAlignY ) );

  if ( this.state.beginPath ) {
    this.context.rect( x, y, w, h );
  } else {
    this.context.beginPath();
    this.context.rect( x, y, w, h );

    if ( this._doFill ) {
      this._fill();
    }

    if ( this._doStroke ) {
      this._stroke();
    }
  }

  return this;
};

Renderer2D.prototype.line = function ( x1, y1, x2, y2 ) {
  if ( this.state.beginPath ) {
    this.context.moveTo( x1, y1 );
    this.context.lineTo( x2, y2 );
  } else if ( this._doStroke ) {
    this.context.beginPath();
    this.context.moveTo( x1, y1 );
    this.context.lineTo( x2, y2 );
    this._stroke();
  }

  return this;
};

/**
 * width and height can be:
 * 'initial' (same as image.width or height)
 * 'auto' (will be calculated proportionally width or height)
 * .image( v6.image( '50x100.jpg' ), 0, 0, 'auto', 200 );
 * // Draw an image stretched to 100x200.
 */
Renderer2D.prototype.image = function ( image, x, y, width, height ) {
  if ( image == null ) {
    throw TypeError( image + ' is not an object' );
  }

  if ( image.loaded ) {
    var w = typeof width != 'string' ? width : width == 'auto' || width == 'initial' ? image.width : 0,
        h = typeof height != 'string' ? height : height == 'auto' || height == 'initial' ? image.height : 0;

    if ( width === 'auto' ) {
      w /= image.height / h;
    }

    if ( height === 'auto' ) {
      h /= image.width / w;
    }

    x = floor( align( x, w, this._rectAlignX ) );
    y = floor( align( y, h, this._rectAlignY ) );
    this.context.drawImage( image.source, image.x, image.y, image.width, image.height, x, y, w, h );
  }

  return this;
};

Renderer2D.prototype.text = function ( text, x, y, maxWidth, maxHeight ) {
  var lineHeight = this._lineHeight,
      doStroke = this._doStroke,
      doFill = this._doFill,
      ctx = this.context,
      wordsLen, maxLen, words, word, line, test, len, tmp, i, j;

  if ( !doFill && !doStroke || !( text += '' ).length ) {
    return this;
  }

  if ( maxHeight !== undefined ) {
    maxLen = floor( maxHeight / lineHeight );
  } else {
    maxLen = Infinity;
  }

  text = text.split( '\n' );

  x = floor( x );
  y = floor( y );

  if ( maxWidth !== undefined ) {
    tmp = [];

    for ( i = 0, len = text.length; i < len && tmp.length < maxLen; ++i ) {
      // Empty line
      if ( !( words = text[ i ].match( /\s+|\S+/g ) ) ) {
        tmp.push( '' );
        continue;
      }

      line = '';

      wordsLen = words.length;

      for ( j = 0; j < wordsLen && tmp.length < maxLen; ++j ) {
        word = words[ j ];
        test = line + word;

        if ( ctx.measureText( test ).width > maxWidth ) {
          tmp.push( line );
          line = word;
        } else {
          line = test;
        }
      }

      tmp.push( line );
    }

    text = tmp;
  }

  if ( text.length > maxLen ) {
    text.length = maxLen;
  }

  ctx.font = this._font.toString();
  ctx.textAlign = this._textAlign;
  ctx.textBaseline = this._textBaseline;

  if ( doFill ) {
    ctx.fillStyle = this._fillColor;
  }

  if ( doStroke ) {
    ctx.strokeStyle = this._strokeColor;
    ctx.lineWidth = this._lineWidth;
  }

  for ( i = 0, len = text.length; i < len; ++i ) {
    line = text[ i ];

    if ( doFill ) {
      ctx.fillText( line, x, y + i * lineHeight );
    }

    if ( doStroke ) {
      ctx.strokeText( line, x, y + i * lineHeight );
    }
  }

  return this;
};

Renderer2D.prototype.arc = function ( x, y, r, begin, end, anticlockwise ) {
  if ( begin === undefined ) {
    begin = 0;
    end = pi * 2;
  } else if ( settings.degrees ) {
    begin *= pi / 180;
    end *= pi / 180;
  }

  if ( !this.state.beginPath ) {
    this.context.beginPath();
    this.context.arc( x, y, r, begin, end, anticlockwise );

    if ( this._doFill ) {
      this._fill();
    }

    if ( this._doStroke ) {
      this._stroke( true );
    }
  } else {
    this.context.arc( x, y, r, begin, end, anticlockwise );
  }

  return this;
};

Renderer2D.prototype.filter = function ( filter, x, y, w, h ) {
  if ( x === undefined ) {
    x = y = 0;
    w = this.width;
    h = this.height;
  } else {
    x = floor( align( x, w, this._rectAlignX ) );
    y = floor( align( y, h, this._rectAlignY ) );
  }

  var image_data = this.context.getImageData( x, y, w, h );
  filter.call( this, image_data.data );
  this.context.putImageData( image_data, x, y );
  return this;
};

Renderer2D.prototype.font = function ( a, b, c, d, e ) {
  return this._font.set( a, b, c, d, e ), this;
};

Renderer2D.prototype.noFill = function () {
  return this._doFill = false, this;
};

Renderer2D.prototype.noStroke = function () {
  return this._doStroke = false, this;
};

Renderer2D.prototype.beginShape = function () {
  return this._vertices.length = 0, this;
};

Renderer2D.prototype.vertex = function ( x, y ) {
  return this._vertices.push( floor( x ), floor( y ) ), this;
};

Renderer2D.prototype.endShape = function ( type, close ) {
  if ( typeof type != 'string' ) {
    close = type;
    type = 'lines';
  }

  return shapes[ type ].call( this, this._vertices, close ), this;
};

Renderer2D.prototype.rectAlign = function ( x, y ) {
  if ( x != null ) {
    this._rectAlignX = x;
  }

  if ( y != null ) {
    this._rectAlignY = y;
  }

  return this;
};

Renderer2D.prototype.color = function ( a, b, c, d ) {
  if ( typeof a != 'string' ) {
    return v6[ this.settings.colorMode ]( a, b, c, d );
  }

  return v6[ this.settings.colorMode ]( parse_color( a ) );
};

Renderer2D.prototype.colorMode = function ( mode ) {
  return this.settings.colorMode = mode, this;
};

var get_polygon = function ( n ) {
  return polygons[ n ] || ( polygons[ n ] = create_polygon( n ) );
};

Renderer2D.prototype._polygon = function ( x, y, rx, ry, n, a, degrees ) {
  var polygon = get_polygon( n ),
      context = this.context;

  if ( degrees ) {
    a *= pi / 180;
  }

  context.save();
  context.translate( x, y );
  context.rotate( a );
  this.drawVertices( polygon, polygon.length * 0.5, rx, ry );
  context.restore();
  return this;
};

Renderer2D.prototype.polygon = function ( x, y, r, n, a ) {
  // Reduce the precision (of what?)
  // for better caching functionality.
  // When `n` is `3.141592`, `n` will be `3.14`.
  if ( n % 1 ) {
    n = floor( n * 100 ) * 0.01;
  }

  if ( a === undefined ) {
    this._polygon( x, y, r, r, n, -pi * 0.5 );
  } else {
    this._polygon( x, y, r, r, n, a, settings.degrees );
  }

  return this;
};

Renderer2D.prototype.drawVertices = function ( data, length, _rx, _ry ) {
  var context, i;

  if ( length <= 2 ) {
    return this;
  }

  // this is a temporary (hopeful) solution (incomplete)
  if ( _rx == null ) {
    _rx = _ry = 1;
  }

  context = this.context;
  context.beginPath();
  context.moveTo( data[ 0 ] * _rx, data[ 1 ] * _ry );

  for ( i = 2, length *= 2; i < length; i += 2 ) {
    context.lineTo( data[ i ] * _rx, data[ i + 1 ] * _ry );
  }

  if ( this._doFill ) {
    this._fill();
  }

  if ( this._doStroke && this._lineWidth > 0 ) {
    this._stroke( true );
  }

  return this;
};

Renderer2D.prototype.point = function ( x, y ) {
  if ( this._doStroke ) {
    this.context.beginPath();
    this.context.arc( x, y, this._lineWidth * 0.5, 0, pi * 2 );
    this.context.fillStyle = this._strokeColor;
    this.context.fill();
  }

  return this;
};

Renderer2D.prototype.beginPath = function () {
  this.state.beginPath = true;
  this.context.beginPath();
  return this;
};

Renderer2D.prototype.closePath = function () {
  this.state.beginPath = false;
  this.context.closePath();
  return this;
};

Renderer2D.prototype.getImageData = function ( x, y, w, h ) {
  return this.context.getImageData( x, y, w, h );
};

Renderer2D.prototype.putImageData = function ( imageData, x, y, sx, sy, sw, sh ) {
  if ( sx !== undefined ) {
    this.context.putImageData( imageData, x, y, sx, sy, sw, sh );
  } else {
    this.context.putImageData( imageData, x, y );
  }

  return this;
};

Renderer2D.prototype.rotate = function ( angle ) {
  if ( settings.degrees ) {
    this.matrix.rotate( angle * pi / 180 );
  } else {
    this.matrix.rotate( angle );
  }

  return this;
};

Renderer2D.prototype._fill = function () {
  this.context.fillStyle = this._fillColor;
  this.context.fill();
  return this;
};

Renderer2D.prototype._stroke = function ( close ) {
  var ctx = this.context;

  if ( close ) {
    ctx.closePath();
  }

  ctx.strokeStyle = this._strokeColor;

  if ( ( ctx.lineWidth = this._lineWidth ) <= 1 ) {
    ctx.stroke();
  }

  ctx.stroke();
  return this;
};

Renderer2D.prototype.camera = function ( options ) {
  return new Camera( options, this );
};

Renderer2D.prototype.setTransformFromCamera = function ( camera ) {
  var zoom = camera.zoom[ 0 ],
      pos = camera.position;

  this.matrix.setTransform( zoom, 0, 0, zoom, pos[ 0 ] * zoom, pos[ 1 ] * zoom );
  return this;
};

_.forOwnRight( {
  fontVariant: 'variant',
  fontWeight:  'weight',
  fontFamily:  'family',
  fontStyle:   'style',
  fontSize:    'size'
}, function ( name, methodName ) {
  Renderer2D.prototype[ methodName ] =
  /* jshint evil: true */
    Function( 'value', 'return this._font.' + name + ' = value, this;' );
  /* jshint evil: false */
} );

_.forEachRight( [
  'textBaseline',
  'lineHeight',
  'lineWidth',
  'textAlign'
], function ( name ) {
  Renderer2D.prototype[ name ] =
  /* jshint evil: true */
    Function( 'value', 'return this._' + name + ' = value, this;' );
  /* jshint evil: false */
} );

/* PROGRAM */

var program = function ( context, vShader, fShader ) {
  return new Program( context, vShader, fShader );
};

var Program = function ( context, vShader, fShader ) {
  this.program = create_program( context, vShader, fShader );
  this.context = context;
  this.vShader = vShader;
  this.fShader = fShader;
  this.attributes = _.create( null );
  this.uniforms = _.create( null );
  this.samplers = [];
  this.loadedAttributes = false;
  this.loadedUniforms = false;
  this.loadAttributes();
  this.loadUniforms();
};

Program.prototype.loadAttributes = function () {
  if ( !this.loadedAttributes ) {
    var gl = this.context,
        program = this.program,
        attrs = this.attributes,
        i = gl.getProgramParameter( program, gl.ACTIVE_ATTRIBUTES ) - 1,
        info, name, attr;

    for ( ; i >= 0; --i ) {
      info = gl.getActiveAttrib( program, i );
      name = info.name;
      attr = attrs[ name ] = _.create( null );
      attr.name = name;
      attr.type = info.type;
      attr.size = info.size;
      attr.location = gl.getAttribLocation( program, name );
    }

    this.loadedAttributes = true;
  }

  return this;
};

Program.prototype.loadUniforms = function () {
  if ( !this.loadedUniforms ) {
    var gl = this.context,
        program = this.program,
        samplers = this.samplers,
        uniforms = this.uniforms,
        i = gl.getProgramParameter( program, gl.ACTIVE_UNIFORMS ) - 1,
        samplerIndex = -1,
        info, name, uniform, index;

    for ( ; i >= 0; --i ) {
      info = gl.getActiveUniform( program, i );
      name = info.name;
      uniform = _.create( null );
      uniform.size = info.size;
      uniform.type = info.type;
      uniform.location = gl.getUniformLocation( program, name );

      if ( info.size > 1 && ( index = name.indexOf( '[0]' ) ) >= 0 ) {
        name = name.slice( 0, index );
      }

      uniforms[ uniform.name = name ] = uniform;

      if ( uniform.type === gl.SAMPLER_2D ) {
        uniform.samplerIndex = ++samplerIndex;
        samplers.push( uniform );
      }
    }

    this.loadedUniforms = true;
  }

  return this;
};

Program.prototype.use = function () {
  return this.context.useProgram( this.program ), this;
};

// from p5
Program.prototype.uniform = function ( name, data ) {
  var gl = this.context,
      uniform = this.uniforms[ name ];

  switch ( uniform.type ) {
    case gl.BOOL:
      if ( data ) {
        gl.uniform1i( uniform.location, 1 );
      } else {
        gl.uniform1i( uniform.location, 0 );
      }

      break;

    case gl.INT:
      gl.uniform1i( uniform.location, data );
      break;

    case gl.FLOAT:
      if ( uniform.size > 1 ) {
        gl.uniform1fv( uniform.location, data );
      } else {
        gl.uniform1f( uniform.location, data );
      }

      break;

    case gl.FLOAT_MAT3:
      gl.uniformMatrix3fv( uniform.location, false, data );
      break;

    case gl.FLOAT_MAT4:
      gl.uniformMatrix4fv( uniform.location, false, data );
      break;

    case gl.FLOAT_VEC2:
      if ( uniform.size > 1 ) {
        gl.uniform2fv( uniform.location, data );
      } else {
        gl.uniform2f( uniform.location, data[ 0 ], data[ 1 ] );
      }

      break;

    case gl.FLOAT_VEC3:
      if ( uniform.size > 1 ) {
        gl.uniform3fv( uniform.location, data );
      } else {
        gl.uniform3f( uniform.location, data[ 0 ], data[ 1 ], data[ 2 ] );
      }

      break;

    case gl.FLOAT_VEC4:
      if ( uniform.size > 1 ) {
        gl.uniform4fv( uniform.location, data );
      } else {
        gl.uniform4f( uniform.location, data[ 0 ], data[ 1 ], data[ 2 ], data[ 3 ] );
      }

      break;

    default:
      throw TypeError( "This uniform type isn't supported for setting: " + uniform.type );
  }

  return this;
};

Program.prototype.vertexPointer = function ( index, size, type, normalized, stride, offset ) {
  this.context.enableVertexAttribArray( index );
  this.context.vertexAttribPointer( index, size, type, normalized, stride, offset );
  return this;
};

var create_program = function ( context, vShader, fShader ) {
  var program = context.createProgram();

  context.attachShader( program, vShader );
  context.attachShader( program, fShader );
  context.linkProgram( program );

  if ( !context.getProgramParameter( program, context.LINK_STATUS ) ) {
    throw Error( 'Unable to initialize the shader program' );
  }

  context.validateProgram( program );

  if ( !context.getProgramParameter( program, context.VALIDATE_STATUS ) ) {
    throw Error( 'Unable to validate the shader program' );
  }

  return program;
};

/* SHADER */

var shader = function ( v, f ) {
  return new Shader( v, f );
};

var Shader = function ( v, f ) {
  this.vShaderSource = v;
  this.fShaderSource = f;
  this.programs = _.create( null );
};

Shader.prototype.create = function ( renderer ) {
  if ( !this.programs[ renderer.index ] ) {
    this.programs[ renderer.index ] = new Program( renderer.context,
      create_shader( renderer.context, this.vShaderSource, renderer.context.VERTEX_SHADER ),
      create_shader( renderer.context, this.fShaderSource, renderer.context.FRAGMENT_SHADER ) );
  }

  return this;
};

Shader.prototype.program = function ( renderer ) {
  return this.programs[ renderer.index ];
};

var create_shader = function ( context, source, type ) {
  var shader = context.createShader( type );

  context.shaderSource( shader, source );
  context.compileShader( shader );

  if ( !context.getShaderParameter( shader, context.COMPILE_STATUS ) ) {
    throw SyntaxError( 'An error occurred compiling the shaders: ' + context.getShaderInfoLog( shader ) );
  }

  return shader;
};

var get_source = function ( script ) {
  var child = script.firstChild,
      source = '';

  while ( child ) {
    // If it's a text node.
    if ( child.nodeType == 3 ) {
      source += child.textContent;
    }

    child = child.nextSibling;
  }

  return source;
};

/**
 * Wrapper for the WebGL buffer.
 */

var buffer = function ( context ) {
  return new Buffer( context );
};

var Buffer = function ( context ) {
  this.context = context;
  this.buffer = context.createBuffer();
};

Buffer.prototype = {
  bind: function () {
  this.context.bindBuffer( this.context.ARRAY_BUFFER, this.buffer );
  return this;
  },

  data: function ( data, mode ) {
  if ( mode === undefined ) {
    this.context.bufferData( this.context.ARRAY_BUFFER, data, this.context.STATIC_DRAW );
  } else {
    this.context.bufferData( this.context.ARRAY_BUFFER, data, mode );
  }

    return this;
  },

  constructor: Buffer
};

/* TRANSFORM */

// webgl-2d transform class implementation

var Transform = function () {
  this.stack = [];
  this.matrix = mat3.identity();
};

Transform.prototype = {
  setTransform: function ( m11, m12, m21, m22, dx, dy ) {
    var matrix = this.matrix;
    matrix[ 0 ] = m11; // x scale
    matrix[ 1 ] = m12; // x skew
    matrix[ 3 ] = m21; // y skew
    matrix[ 4 ] = m22; // y scale
    matrix[ 6 ] = dx;  // x translate
    matrix[ 7 ] = dy;  // y translate
    return this;
  },

  save: function () {
    if ( this.stack[ ++this.index ] ) {
      mat3.copy( this.stack[ this.index ], this.matrix );
    } else {
      this.stack.push( mat3.clone( this.matrix ) );
    }

    return this;
  },

  restore: function () {
    // Restore the saved values.
    if ( this.stack.length ) {
      mat3.copy( this.matrix, this.stack[ this.index-- ] );
    // Set the default values.
    } else {
      mat3.setIdentity( this.matrix );
    }

    return this;
  },

  translate: function ( x, y ) {
    mat3.translate( this.matrix, x, y );
    return this;
  },

  rotate: function ( angle ) {
    mat3.rotate( this.matrix, angle );
    return this;
  },

  scale: function ( x, y ) {
    mat3.scale( this.matrix, x, y );
    return this;
  },

  transform: function ( m11, m12, m21, m22, dx, dy ) {
    var matrix = this.matrix;
    matrix[ 0 ] *= m11;
    matrix[ 1 ] *= m21;
    matrix[ 2 ] *= dx;
    matrix[ 3 ] *= m12;
    matrix[ 4 ] *= m22;
    matrix[ 5 ] *= dy;
    matrix[ 6 ] = 0;
    matrix[ 7 ] = 0;
    return this;
  },

  constructor: Transform,
  index: -1
};

/* MATRIX3 */

var mat3 = {
  identity: function () {
    return [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ];
  },

  setIdentity: function ( m1 ) {
    m1[ 0 ] = m1[ 4 ] = m1[ 8 ] = 1;
    m1[ 1 ] = m1[ 2 ] = m1[ 3 ] = m1[ 5 ] = m1[ 6 ] = m1[ 7 ] = 0;
    return m1;
  },

  clone: function ( m1 ) {
    return [
      m1[ 0 ], m1[ 1 ], m1[ 2 ],
      m1[ 3 ], m1[ 4 ], m1[ 5 ],
      m1[ 6 ], m1[ 7 ], m1[ 8 ]
    ];
  },

  copy: function ( m1, m2 ) {
    m1[ 0 ] = m2[ 0 ];
    m1[ 1 ] = m2[ 1 ];
    m1[ 2 ] = m2[ 2 ];
    m1[ 3 ] = m2[ 3 ];
    m1[ 4 ] = m2[ 4 ];
    m1[ 5 ] = m2[ 5 ];
    m1[ 6 ] = m2[ 6 ];
    m1[ 7 ] = m2[ 7 ];
    m1[ 8 ] = m2[ 8 ];
    return m1;
  },

  // from glMatrix
  translate: function ( m1, x, y ) {
    m1[ 6 ] = x * m1[ 0 ] + y * m1[ 3 ] + m1[ 6 ];
    m1[ 7 ] = x * m1[ 1 ] + y * m1[ 4 ] + m1[ 7 ];
    m1[ 8 ] = x * m1[ 2 ] + y * m1[ 5 ] + m1[ 8 ];
    return m1;
  },

  // from glMatrix
  rotate: function ( m1, angle ) {
    var m10 = m1[ 0 ], m11 = m1[ 1 ], m12 = m1[ 2 ],
        m13 = m1[ 3 ], m14 = m1[ 4 ], m15 = m1[ 5 ],
        x = cos( angle ),
        y = sin( angle );

    m1[ 0 ] = x * m10 + y * m13;
    m1[ 1 ] = x * m11 + y * m14;
    m1[ 2 ] = x * m12 + y * m15;
    m1[ 3 ] = x * m13 - y * m10;
    m1[ 4 ] = x * m14 - y * m11;
    m1[ 5 ] = x * m15 - y * m12;
    return m1;
  },

  // from p5
  scale: function ( m1, x, y ) {
    m1[ 0 ] *= x;
    m1[ 1 ] *= x;
    m1[ 2 ] *= x;
    m1[ 3 ] *= y;
    m1[ 4 ] *= y;
    m1[ 5 ] *= y;
    return m1;
  }
};

var dflt_shaders = {

  vert:

'precision mediump float;' +
'precision mediump int;' +
'attribute vec2 a_position;' +
'uniform vec2 u_resolution;' +
'uniform mat3 u_transform;' +

'void main () {' +
  'gl_Position = vec4( ( ( u_transform * vec3( a_position, 1.0 ) ).xy / u_resolution * 2.0 - 1.0 ) * vec2( 1, -1 ), 0, 1 );' +
'}',

  frag:

'precision mediump float;' +
'precision mediump int;' +
'uniform vec4 u_color;' +

'void main () {' +
  'gl_FragColor = vec4( u_color.rgb / 255.0, u_color.a );' +
'}',

  backgroundVert:

'precision lowp float;' +
'precision lowp int;' +
'attribute vec2 a_position;' +

'void main () {' +
  'gl_Position = vec4( a_position, 0, 1 );' +
'}',

  backgroundFrag:

'precision lowp float;' +
'precision lowp int;' +
'uniform vec4 u_color;' +

'void main () {' +
  'gl_FragColor = u_color;' +
'}'

};

var shaders = new Shader( dflt_shaders.vert, dflt_shaders.frag ),
    bg_shaders = new Shader( dflt_shaders.backgroundVert, dflt_shaders.backgroundFrag );

/**
 * In most cases, on phones (except iOS Safari)
 * `RendererWebGL` works faster than `Renderer2D`.
 */

var RendererWebGL = function ( options ) {
  options = defaults( options, dflt_opts.renderer );
  create_renderer( this, 'webgl', options );
  /** For transformation functions (scale, translate, save...). */
  this.matrix = new Transform();
  /** Standard buffer, shaders, program - will be used in most cases. */
  this.buffer = new Buffer( this.context );
  this.shaders = shaders.create( this );
  this.program = shaders.program( this );
  /** Transformation isn't supported. */
  this.backgroundBuffer = new Buffer( this.context ).bind().data( bg_verts );
  this.backgroundShaders = bg_shaders.create( this );
  this.backgroundProgram = bg_shaders.program( this );
  /** With a separate buffer, `rect` will run a little faster. (maybe add buffers for the arc?) */
  this.rectangleBuffer = new Buffer( this.context ).bind().data( rect_verts );
  /** Some weird bullshit. */
  this.blending( options.blending );
};

RendererWebGL.prototype.add     = Renderer2D.prototype.add;
RendererWebGL.prototype.destroy = Renderer2D.prototype.destroy;
RendererWebGL.prototype.push = Renderer2D.prototype.push;
RendererWebGL.prototype.pop = Renderer2D.prototype.pop;

RendererWebGL.prototype.resize = function ( w, h ) {
  Renderer2D.prototype.resize.call( this, w, h );
  this.context.viewport( 0, 0, this.width, this.height );
  return this;
};

RendererWebGL.prototype.blending = function ( blending ) {
  var gl = this.context;

  if ( blending ) {
    gl.enable( gl.BLEND );
    gl.disable( gl.DEPTH_TEST );
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.blendEquation( gl.FUNC_ADD );
  } else {
    gl.disable( gl.BLEND );
    gl.enable( gl.DEPTH_TEST );
    gl.depthFunc( gl.LEQUAL );
  }

  return this;
};

RendererWebGL.prototype._clear_color = function ( r, g, b, a ) {
  var gl = this.context;
  gl.clearColor( r, g, b, a );
  gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
  return this;
};

RendererWebGL.prototype.clearColor = function ( a, b, c, d ) {
  var rgba = this.color( a, b, c, d ).rgba();

  return this._clear_color(
    rgba[ 0 ] / 255,
    rgba[ 1 ] / 255,
    rgba[ 2 ] / 255,
    rgba[ 3 ] );
};

var bg_verts = new Float32Array( [
  -1,  1,
   1,  1,
   1, -1,
  -1, -1
] );

RendererWebGL.prototype._background_color = function ( r, g, b, a ) {
  var gl = this.context,
      backgroundProgram = this.backgroundProgram;

  this.backgroundBuffer.bind();

  backgroundProgram
    .use()
    .uniform( 'u_color', [ r, g, b, a ] )
    .vertexPointer( backgroundProgram.attributes.a_position.location, 2, gl.FLOAT, false, 0, 0 );

  gl.drawArrays( gl.TRIANGLE_FAN, 0, 4 );
  return this;
};

RendererWebGL.prototype.backgroundColor = function ( a, b, c, d ) {
  return this.clearColor( a, b, c, d );

  /* var rgba = fast_rgba( this.color( a, b, c, d ) ),
      r, g;

  r = rgba[ 0 ] / 255;
  g = rgba[ 1 ] / 255;
  b = rgba[ 2 ] / 255;
  a = rgba[ 3 ];

  return this[ a < 1 ?
    '_background_color' :
    '_clear_color' ]( r, g, b, a ); */
};

RendererWebGL.prototype.background = Renderer2D.prototype.background;

RendererWebGL.prototype.clear = function ( /* x, y, w, h */ ) {
  return this._clear_color( 0, 0, 0, 0 );
};

/**
 * `data`: Shape vertices [x1, y1, x2, y2...].
 * `length`: Number of vertices (not length of the data!).
 */
RendererWebGL.prototype.drawVertices = function ( data, length ) {
  var gl = this.context,
      program = this.program;

  if ( length <= 2 ) {
    return this;
  }

  if ( data ) {
    this.buffer
      .bind()
      .data( data );
   }

  program
    .use()
    .uniform( 'u_resolution', [ this.width, this.height ] )
    .uniform( 'u_transform', this.matrix.matrix )
    .vertexPointer( program.attributes.a_position.location, 2, gl.FLOAT, false, 0, 0 );

  if ( this._doFill ) {
    program.uniform( 'u_color', this._fillColor.rgba() );
    gl.drawArrays( gl.TRIANGLE_FAN, 0, length );
  }

  if ( this._doStroke && this._lineWidth > 0 ) {
    program.uniform( 'u_color', this._strokeColor.rgba() );
    gl.lineWidth( this._lineWidth );
    gl.drawArrays( gl.LINE_LOOP, 0, length );
  }

  return this;
};

/**
 * 1--------2
 * |        |
 * |        |
 * 4--------3
 */
var rect_verts = new Float32Array( [
  0, 0, /* 1 */
  1, 0, /* 2 */
  1, 1, /* 3 */
  0, 1  /* 4 */
] );

RendererWebGL.prototype.rect = function ( x, y, w, h ) {
  x = align( x, w, this._rectAlignX );
  y = align( y, h, this._rectAlignY );

  this.matrix
    .save()
    .translate( x, y )
    .scale( w, h );

  this.rectangleBuffer.bind();
  this.drawVertices( null, 4 );
  this.matrix.restore();
  return this;
};

RendererWebGL.prototype.line = function ( x1, y1, x2, y2 ) {
  var gl = this.context,
      buffer = this.buffer,
      program = this.program,
      vertices;

  if ( !this._doStroke || this._lineWidth <= 0 ) {
    return this;
  }

  vertices = new Float32Array( 4 );
  vertices[ 0 ] = x1;
  vertices[ 1 ] = y1;
  vertices[ 2 ] = x2;
  vertices[ 3 ] = y2;

  buffer
    .bind()
    .data( vertices );

  program
    .use()
    .uniform( 'u_color', this._strokeColor.rgba() )
    .uniform( 'u_resolution', [ this.width, this.height ] )
    .uniform( 'u_transform', this.matrix.matrix )
    .vertexPointer( program.attributes.a_position.location, 2, gl.FLOAT, false, 0, 0 );

  gl.lineWidth( this._lineWidth );
  gl.drawArrays( gl.LINE_LOOP, 0, 2 );

  return this;
};

/**
 * Cached polygons vertices.
 */
var polygons = _.create( null );

/**
 * Creates polygon vertices with `n` resolution.
 * Values will be between -1 and 1 (sin and cos uses).
 */
var create_polygon = function ( n ) {
  var i = floor( n ),
      verts = new Float32Array( i * 2 + 2 ),
      angle = pi * 2 / n,
      cur_angle;

  for ( ; i >= 0; --i ) {
    cur_angle = angle * i;
    verts[     i * 2 ] = cos( cur_angle );
    verts[ 1 + i * 2 ] = sin( cur_angle );
  }

  return verts;
};

/**
 * Draw polygon in `x` and `y` position with
 * the width (2 * `rx`) and height (2 * `ry`),
 * resolution `n`, and rotated by `a` angle.
 */
RendererWebGL.prototype._polygon = function ( x, y, rx, ry, n, a, degrees ) {
  var polygon = get_polygon( n );

  if ( degrees ) {
    a *= pi / 180;
  }

  this.matrix
    .save()
    .translate( x, y )
    .rotate( a )
    .scale( rx, ry );

  this.drawVertices( polygon, polygon.length * 0.5 );
  this.matrix.restore();
  return this;
};

RendererWebGL.prototype.ellipse = function ( x, y, r1, r2 ) {
  return this._polygon( x, y, r1, r2, 24, 0 );
};

RendererWebGL.prototype.arc = function ( x, y, r ) {
  return this._polygon( x, y, r, r, 24, 0 );
};

RendererWebGL.prototype.polygon = Renderer2D.prototype.polygon;
RendererWebGL.prototype.font = Renderer2D.prototype.font;

_.forEachRight( [
  'setTransform',
  'transform',
  'translate',
  'restore',
  'scale',
  'save'
], function ( name ) {
  Renderer2D.prototype[ name ] = RendererWebGL.prototype[ name ] =
  /* jshint evil: true */
    Function( 'a, b, c, d, e, f', 'return this.matrix.' + name + '( a, b, c, d, e, f ), this;' );
  /* jshint evil: false */
} );

_.forOwnRight( {
  stroke: 'Stroke',
  fill: 'Fill'
}, function ( Name, name ) {
  var _nameColor = '_' + name + 'Color',
      _doName = '_do' + Name,
      _name = '_' + name;

  Renderer2D.prototype[ name ] = RendererWebGL.prototype[ name ] = function ( a, b, c, d ) {
    // Fill path, e.g.
    // .fill()
    if ( a === undefined ) {
      this[ _name ]();
    // Set color, e.g.
    // .fill( 'magenta' )
    } else if ( typeof a != 'boolean' ) {
      if ( typeof a == 'string' || this[ _nameColor ].type !== this.settings.colorMode ) {
        this[ _nameColor ] = this.color( a, b, c, d );
      } else {
        this[ _nameColor ].set( a, b, c, d );
      }

      this[ _doName ] = true;
    // Do or not to do
    // .fill( false ) same as .noFill()
    // But we also can enable it
    // .fill( true )
    } else {
      this[ _doName ] = a;
    }

    return this;
  };
} );

RendererWebGL.prototype.rotate = Renderer2D.prototype.rotate;
RendererWebGL.prototype.noFill = Renderer2D.prototype.noFill;
RendererWebGL.prototype.noStroke = Renderer2D.prototype.noStroke;

RendererWebGL.prototype.beginShape = function () {
  this._vertices.length = 0;
  this._vertices_is_updated = false;
  return this;
};

RendererWebGL.prototype.vertex = function ( x, y ) {
  this._vertices.push( x, y );

  if ( this._vertices_is_updated ) {
    this._vertices_is_updated = false;
  }

  return this;
};

RendererWebGL.prototype.endShape = function () {
  if ( !this._vertices_is_updated ) {
    this._vertices = copy_array(
      new Float32Array( this._vertices.length ),
      this._vertices,
      this._vertices.length );
  }

  return this.drawVertices( this._vertices, this._vertices.length * 0.5 );
};

RendererWebGL.prototype.rectAlign = Renderer2D.prototype.rectAlign;
RendererWebGL.prototype.color = Renderer2D.prototype.color;
RendererWebGL.prototype.colorMode = Renderer2D.prototype.colorMode;
RendererWebGL.prototype.lineWidth = Renderer2D.prototype.lineWidth;

// todo implement point
RendererWebGL.prototype.point = function ( x, y ) {
  return this
    .push()
    .noStroke()
    .fill( this._strokeColor )
    .arc( x, y, this._lineWidth * 0.5 )
    .pop();
};

RendererWebGL.prototype.getPixels = function ( x, y, w, h ) {
  var gl = this.context,
      pixels = new Uint8ClampedArray( w * h * 4 );

  gl.readPixels( x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels );
  return pixels;
};

RendererWebGL.prototype.getImageData = function ( x, y, w, h ) {
  return new ImageData( this.getPixels( x, y, w, h ), w, h );
};

// As I understand it, I need textures.
RendererWebGL.prototype.putImageData = function ( /* imageData, x, y, sx, sy, sw, sh */ ) {
  return this;
};

RendererWebGL.prototype.camera = Renderer2D.prototype.camera;
RendererWebGL.prototype.setTransformFromCamera = Renderer2D.prototype.setTransformFromCamera;

/* RendererWebGL.prototype.shaders = function ( shader ) {
  this.__program = shaders
    .create( this )
    .program( this );

  return this;
}; */

var defaults = function ( options, defaults ) {
  if ( options ) {
    return _.mixin( true, {}, defaults, options );
  }

  return _.mixin( true, {}, defaults );
};

/** Initializes the renderer. */
var create_renderer = function ( renderer, mode, opts ) {
  var ctx_opts = {
    alpha: opts.alpha
  },
      canv;

  renderer.settings = opts.settings;
  renderer.mode = mode;
  renderer.index = ++renderer_index;
  /** Stack of saved draw settings (push, pop). */
  renderer._saves_stack = [];
  renderer._cur_save_index = -1;
  /** Shape vertices (beginShape, vertex, endShape). */
  renderer._vertices = [];

  if ( !opts.canvas ) {
    renderer.canvas = document.createElement( 'canvas' );
    renderer.canvas.innerHTML = 'Unable to run that application. Try to update your browser.';
  } else {
    renderer.canvas = opts.canvas;
  }

  canv = renderer.canvas;

  // Set default drawing settings
  set_dflt_draw_settings( renderer, renderer );

  if ( mode === '2d' ) {
    renderer.context = canv.getContext( '2d', ctx_opts );
    renderer.smooth( renderer.settings.smooth );
  } else if ( mode === 'webgl' ) {
    if ( ( mode = get_gl_ctx_name() ) ) {
      renderer.context = canv.getContext( mode, ctx_opts );
    } else {
      throw Error( "It's not possible to get the WebGL context" );
    }
  }

  if ( opts.append ) {
    renderer.add();
  }

  if ( opts.width != null || opts.height != null ) {
    renderer.resize( opts.width, opts.height );
  } else {
    renderer.resize( true );
  }
};

/**
 * Using `Camera` class, you can easily make
 * a camera for the game (or not for the game)
 * and easily operate it.
 */

var camera = function ( options, renderer ) {
  return new Camera( options, renderer );
};

var Camera = function ( options, renderer ) {
  if ( !options ) {
    options = {};
  }

  /**
   * Numbers between 0 and 1:
   * 1 - the camera will move at the speed of light
   * 0.1 - the camera will be similar to the real operator
   */
  this.speed = options.speed || [
    1, // x speed
    1, // y speed
    1, // zoom in speed
    1  // zoom out speed
  ];

  this.zoom = options.zoom || [
    1, // zoom
    1, // min zoom (zoom out)
    1  // max zoom (zoom in)
  ];

  /**
   * Offset from the top-left corner of the
   * renderer to the `lookAt` position.
   */
  this.offset = options.offset;

  if ( renderer ) {
    if ( !this.offset ) {
      this.offset = new Vector2D( renderer.width * 0.5, renderer.height * 0.5 );
    }

    /** Uses in `sees` function. */
    this.renderer = renderer;
  } else if ( !this.offset ) {
    this.offset = new Vector2D();
  }

  this.position = [
    0, 0, // current position
    0, 0, // tranformed position of the object to be viewed
    0, 0  // not transformed position...
  ];

  /** Will be zoom in/out animation with the linear effect? */
  this.linearZoom = options.linearZoom || {
    zoomIn: true,
    zoomOut: true
  };
};

Camera.prototype = {
  /** Moves the camera to the `lookAt` position with its speed. */
  update: function ( /* dt */ ) {
    // how to use delta time here?
    var pos = this.position,
        spd = this.speed;

    if ( pos[ 0 ] !== pos[ 2 ] ) {
      pos[ 0 ] += ( pos[ 2 ] - pos[ 0 ] ) * spd[ 0 ];
    }

    if ( pos[ 1 ] !== pos[ 3 ] ) {
      pos[ 1 ] += ( pos[ 3 ] - pos[ 1 ] ) * spd[ 1 ];
    }

    return this;
  },

  /** Changes `lookAt` position. */
  lookAt: function ( at ) {
    var pos = this.position,
        off = this.offset,
        zoom = this.zoom;

    pos[ 2 ] = off.x / zoom[ 0 ] - ( pos[ 4 ] = at.x );
    pos[ 3 ] = off.y / zoom[ 0 ] - ( pos[ 5 ] = at.y );

    return this;
  },

  /** Returns vector that is passed to the `lookAt` method. */
  shouldLookAt: function () {
    return new Vector2D( this.position[ 4 ], this.position[ 5 ] );
  },

  /** At what position the camera looking now? */
  looksAt: function () {
    var zoom = this.zoom[ 0 ];

    return new Vector2D(
      ( this.offset.x - this.position[ 0 ] * zoom ) / zoom,
      ( this.offset.y - this.position[ 1 ] * zoom ) / zoom );
  },

  /** There is no need to draw something if it's not visible. */

  // if ( camera.sees( object.x, object.y, object.w, object.h ) ) {
  //   object.show();
  // }

  sees: function ( x, y, w, h, renderer ) {
    var zoom = this.zoom[ 0 ],
        off = this.offset,
        at = this.looksAt();

    if ( !renderer ) {
      renderer = this.renderer;
    }

    return x + w > at.x - off.x / zoom &&
           x     < at.x + ( renderer.width - off.x ) / zoom &&
           y + h > at.y - off.y / zoom &&
           y     < at.y + ( renderer.height - off.y ) / zoom;
  },

  /** Increases `zoom[0]` to `zoom[2]` with `speed[2]` speed. */
  zoomIn: function () {
    var zoom = this.zoom,
        spd;

    if ( zoom[ 0 ] !== zoom[ 2 ] ) {
      if ( this.linearZoom.zoomIn ) {
        spd = this.speed[ 2 ] * zoom[ 0 ];
      } else {
        spd = this.speed[ 2 ];
      }

      zoom[ 0 ] = min( zoom[ 0 ] + spd, zoom[ 2 ] );
    }
  },

  /** Decreases `zoom[0]` to `zoom[1]` with `speed[3]` speed. */
  zoomOut: function () {
    // copy-paste :(
    var zoom = this.zoom,
        spd;

    if ( zoom[ 0 ] !== zoom[ 1 ] ) {
      if ( this.linearZoom.zoomOut ) {
        spd = this.speed[ 3 ] * zoom[ 0 ];
      } else {
        spd = this.speed[ 3 ];
      }

      zoom[ 0 ] = max( zoom[ 0 ] - spd, zoom[ 1 ] );
    }
  },

  constructor: Camera
};

v6.Ticker = Ticker;
v6.Camera = Camera;
v6.Vector2D = Vector2D;
v6.Vector3D = Vector3D;
v6.RGBA = RGBA;
v6.HSLA = HSLA;
v6.Font = Font;
v6.Image = Image;
v6.Loader = Loader;
v6.Buffer = Buffer;
v6.Shader = Shader;
v6.Program = Program;
v6.Transform = Transform;
v6.Renderer2D = Renderer2D;
v6.RendererWebGL = RendererWebGL;
v6.ticker = ticker;
v6.camera = camera;
v6.vec2 = vec2;
v6.vec3 = vec3;
v6.rgba = rgba;
v6.hsla = hsla;
v6.font = font;
v6.color = color;
v6.image = image;
v6.loader = loader;
v6.colors = colors;
v6.buffer = buffer;
v6.mat3 = mat3;
v6.shader = shader;
v6.program = program;
v6.map = map;
v6.dist = dist;
v6.lerp = lerp;
v6.lerpColor = lerpColor;
v6.getShaderSource = get_source;
v6.filters = filters;
v6.shapes = shapes;
v6.options = dflt_opts;
v6.shaders = dflt_shaders;
v6.settings = settings;
window.v6 = v6;

} )( this );
