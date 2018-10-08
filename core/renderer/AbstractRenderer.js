/* eslint lines-around-directive: off */
/* eslint lines-around-comment: off */
'use strict';
var getElementW = require( 'peako/get-element-w' );
var getElementH = require( 'peako/get-element-h' );
var constants = require( '../constants' );
var createPolygon = require( '../internal/create_polygon' );
var polygons = require( '../internal/polygons' );
var setDefaultDrawingSettings = require( './internal/set_default_drawing_settings' );
var getWebGL = require( './internal/get_webgl' );
var copyDrawingSettings = require( './internal/copy_drawing_settings' );
var align = require( './internal/align' );
var options = require( './settings' );
/**
 * Абстрактный класс рендерера.
 * @abstract
 * @constructor v6.AbstractRenderer
 * @see v6.RendererGL
 * @see v6.Renderer2D
 * @example
 * var AbstractRenderer = require( 'v6.js/core/renderer/AbstractRenderer' );
 */
function AbstractRenderer ()
{
  throw Error( 'Cannot create an instance of the abstract class (new v6.AbstractRenderer)' );
}
AbstractRenderer.prototype = {
  /**
   * Добавляет `canvas` рендерера в DOM.
   * @method v6.AbstractRenderer#appendTo
   * @param {Element} parent Элемент, в который `canvas` рендерера должен быть добавлен.
   * @chainable
   * @example
   * // Add renderer into DOM.
   * renderer.appendTo( document.body );
   */
  appendTo: function appendTo ( parent )
  {
    parent.appendChild( this.canvas );
    return this;
  },
  /**
   * Удаляет `canvas` рендерера из DOM.
   * @method v6.AbstractRenderer#destroy
   * @chainable
   * @example
   * // Remove renderer from DOM.
   * renderer.destroy();
   */
  destroy: function destroy ()
  {
    this.canvas.parentNode.removeChild( this.canvas );
    return this;
  },
  /**
   * Сохраняет текущие настройки рендерера.
   * @method v6.AbstractRenderer#push
   * @chainable
   * @example
   * // Save drawing settings (fill, lineWidth...) (push onto stack).
   * renderer.push();
   */
  push: function push ()
  {
    if ( this._stack[ ++this._stackIndex ] ) {
      copyDrawingSettings( this._stack[ this._stackIndex ], this );
    } else {
      this._stack.push( setDefaultDrawingSettings( {}, this ) );
    }
    return this;
  },
  /**
   * Восстанавливает предыдущие настройки рендерера.
   * @method v6.AbstractRenderer#pop
   * @chainable
   * @example
   * // Restore drawing settings (fill, lineWidth...) (take from stack).
   * renderer.pop();
   */
  pop: function pop ()
  {
    if ( this._stackIndex >= 0 ) {
      copyDrawingSettings( this, this._stack[ this._stackIndex-- ] );
    } else {
      setDefaultDrawingSettings( this, this );
    }
    return this;
  },
  /**
   * Изменяет размер рендерера.
   * @method v6.AbstractRenderer#resize
   * @param {number} w Новая ширина.
   * @param {number} h Новая высота.
   * @chainable
   * @example
   * // Resize renderer to 600x400.
   * renderer.resize( 600, 400 );
   */
  resize: function resize ( w, h )
  {
    var canvas = this.canvas;
    var scale = this.settings.scale;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = this.w = Math.floor( w * scale ); // eslint-disable-line no-multi-assign
    canvas.height = this.h = Math.floor( h * scale ); // eslint-disable-line no-multi-assign
    return this;
  },
  /**
   * Изменяет размер рендерера до размера `element` элемента.
   * @method v6.AbstractRenderer#resizeTo
   * @param {Element} element Элемент, до которого надо растянуть рендерер.
   * @chainable
   * @example
   * // Resize renderer to match <body /> sizes.
   * renderer.resizeTo( document.body );
   */
  resizeTo: function resizeTo ( element )
  {
    return this.resize( getElementW( element ), getElementH( element ) );
  },
  _polygon: function _polygon ( x, y, rx, ry, n, a, degrees )
  {
    var polygon = polygons[ n ];
    var matrix = this.matrix;
    if ( ! polygon ) {
      polygon = polygons[ n ] = createPolygon( n ); // eslint-disable-line no-multi-assign
    }
    if ( degrees ) {
      a *= Math.PI / 180;
    }
    matrix.save();
    matrix.translate( x, y );
    matrix.rotate( a );
    this.drawArrays( polygon, polygon.length * 0.5, null, rx, ry );
    matrix.restore();
    return this;
  },
  /**
   * Рисует многоугольник.
   * @method v6.AbstractRenderer#polygon
   * @param {number} x
   * @param {number} y
   * @param {number} r   Радиус многоугольника.
   * @param {number} n   Количество сторон многоугольника.
   * @param {number} [a] Угол поворота. В целях оптимизации вместо {@link v6.AbstractRenderer#rotate}
   *                     для поворота можно использовать этот параметр.
   * @chainable
   */
  polygon: function polygon ( x, y, r, n, a )
  {
    if ( n % 1 ) {
      n = Math.floor( n * 100 ) * 0.01;
    }
    if ( typeof a === 'undefined' ) {
      this._polygon( x, y, r, r, n, -Math.PI * 0.5 );
    } else {
      this._polygon( x, y, r, r, n, a, options.degrees );
    }
    return this;
  },
  lineWidth: function lineWidth ( number )
  {
    this._lineWidth = number;
    return this;
  },
  /**
   * Устанавливает stroke color.
   * @method v6.AbstractRenderer#stroke
   * @param {number|object|boolean} [r] Может быть {@link v6.RGBA} или {@link v6.HSLA} чтобы
   *                                    поставить stroke color. Если это boolean, то включит
   *                                    или отключит stroke color.
   * @param {number}                [g]
   * @param {number}                [b]
   * @param {number}                [a]
   * @chainable
   * @example
   * renderer.stroke( new HSLA( 0, 100, 50 ) );
   * renderer.stroke( 'magenta' );
   * renderer.stroke( 255, 0, 0, 0.5 );
   * renderer.noStroke().stroke( true );
   */
  stroke: function stroke ( r, g, b, a ) { if ( typeof r === 'undefined' ) { this._stroke(); } else if ( typeof r === 'boolean' ) { this._doStroke = r; } else { if ( typeof r === 'string' || this._strokeColor.type !== this.settings.color.type ) { this._strokeColor = new this.settings.color( r, g, b, a ); } else { this._strokeColor.set( r, g, b, a ); } this._doStroke = true; } return this; }, // eslint-disable-line brace-rules/brace-on-same-line, no-useless-concat, quotes, max-statements-per-line
  /**
   * Устанавливает fill color.
   * @method v6.AbstractRenderer#fill
   * @see {@link v6.AbstractRenderer#stroke}
   */
  fill: function fill ( r, g, b, a ) { if ( typeof r === 'undefined' ) { this._fill(); } else if ( typeof r === 'boolean' ) { this._doFill = r; } else { if ( typeof r === 'string' || this._fillColor.type !== this.settings.color.type ) { this._fillColor = new this.settings.color( r, g, b, a ); } else { this._fillColor.set( r, g, b, a ); } this._doFill = true; } return this; }, // eslint-disable-line brace-rules/brace-on-same-line, no-useless-concat, quotes, max-statements-per-line
  /**
   * @method v6.AbstractRenderer#setTransform
   * @param {number|v6.Camera} m11
   * @param {number}           [m12]
   * @param {number}           [m21]
   * @param {number}           [m22]
   * @param {number}           [dx]
   * @param {number}           [dy]
   * @chainable
   */
  setTransform: function setTransform ( m11, m12, m21, m22, dx, dy )
  {
    var position, zoom;
    if ( typeof m11 === 'object' && m11 !== null ) {
      position = m11.position;
      zoom = m11.zoom;
      this.matrix.setTransform( zoom, 0, 0, zoom, position[ 0 ] * zoom, position[ 1 ] * zoom );
    } else {
      this.matrix.setTransform( m11, m12, m21, m22, dx, dy );
    }
    return this;
  },
  /**
   * @method v6.AbstractRenderer#backgroundPositionX
   * @param  {number}   value
   * @param  {constant} [type=VALUE]
   * @chainable
   * @example
   * renderer.backgroundPositionX( constants.get( 'CENTER' ), constants.get( 'CONSTANT' ) );
   * renderer.backgroundPositionX( 0.5, constants.get( 'PERCENTAGES' ) );
   * renderer.backgroundPositionX( renderer.w / 2 );
   */
  backgroundPositionX: function backgroundPositionX ( value, type ) { if ( typeof type !== 'undefined' && type !== constants.get( 'VALUE' ) ) { if ( type === constants.get( 'CONSTANT' ) ) { type = constants.get( 'PERCENTAGES' ); if ( value === constants.get( 'LEFT' ) ) { value = 0; } else if ( value === constants.get( 'CENTER' ) ) { value = 0.5; } else if ( value === constants.get( 'RIGHT' ) ) { value = 1; } else { throw Error( 'Got unknown value. The known are: ' + "LEFT" + ', ' + "CENTER" + ', ' + "RIGHT" ); } } if ( type === constants.get( 'PERCENTAGES' ) ) { value *= this.w; } else { throw Error( 'Got unknown `value` type. The known are: VALUE, PERCENTAGES, CONSTANT' ); } } this._backgroundPositionX = value; return this; }, // eslint-disable-line brace-rules/brace-on-same-line, no-useless-concat, quotes, max-statements-per-line
  /**
   * @method v6.AbstractRenderer#backgroundPositionY
   * @param  {number}   value
   * @param  {constant} [type=VALUE]
   * @chainable
   * @example
   * renderer.backgroundPositionY( constants.get( 'MIDDLE' ), constants.get( 'CONSTANT' ) );
   * renderer.backgroundPositionY( 0.5, constants.get( 'PERCENTAGES' ) );
   * renderer.backgroundPositionY( renderer.h / 2 );
   */
  backgroundPositionY: function backgroundPositionY ( value, type ) { if ( typeof type !== 'undefined' && type !== constants.get( 'VALUE' ) ) { if ( type === constants.get( 'CONSTANT' ) ) { type = constants.get( 'PERCENTAGES' ); if ( value === constants.get( 'LEFT' ) ) { value = 0; } else if ( value === constants.get( 'CENTER' ) ) { value = 0.5; } else if ( value === constants.get( 'RIGHT' ) ) { value = 1; } else { throw Error( 'Got unknown value. The known are: ' + "TOP" + ', ' + "MIDDLE" + ', ' + "BOTTOM" ); } } if ( type === constants.get( 'PERCENTAGES' ) ) { value *= this.h; } else { throw Error( 'Got unknown `value` type. The known are: VALUE, PERCENTAGES, CONSTANT' ); } } this._backgroundPositionX = value; return this; }, // eslint-disable-line brace-rules/brace-on-same-line, no-useless-concat, quotes, max-statements-per-line
  /**
   * Отрисовывает картинку.
   * @method v6.AbstractRenderer#image
   * @param {v6.Image|v6.CompoundedImage} image
   * @param {number}                      x
   * @param {number}                      y
   * @param {number}                      [w]
   * @param {number}                      [h]
   * @chainable
   */
  image: function image ( image, x, y, w, h )
  {
    if ( image.get().loaded ) {
      if ( typeof w === 'undefined' ) {
        w = image.dw;
      }
      if ( typeof h === 'undefined' ) {
        h = image.dh;
      }
      this.drawImage( image, align( x, w, this._rectAlignX ), align( y, h, this._rectAlignY ), w, h );
    }
    return this;
  },
  closeShape: function closeShape ()
  {
    this._closeShape = true;
    return this;
  },
  /**
   * @method v6.AbstractRenderer#beginShape
   * @param {constant} [type] POINTS, LINES.
   * @chainable
   * @example
   * renderer.beginShape( { type: v6.constants.get( 'POINTS' ) } );
   */
  beginShape: function beginShape ( options )
  {
    if ( ! options ) {
      options = {};
    }
    this._vertices.length = 0;
    if ( typeof options.type === 'undefined' ) {
      this._shapeType = null;
    } else {
      this._shapeType = options.type;
    }
    return this;
  },
  /**
   * @method v6.AbstractRenderer#vertex
   * @param {number} x
   * @param {number} y
   * @chainable
   */
  vertex: function vertex ( x, y )
  {
    this._vertices.push( Math.floor( x ), Math.floor( y ) );
    return this;
  },
  /**
   * @method v6.AbstractRenderer#endShape
   * @param {object}   [options]
   * @param {boolean}  [options.close]
   * @param {constant} [options.type]
   * @chainable
   * @example
   * renderer.endShape( { close: true } );
   */
  endShape: function endShape ()
  {
    throw Error( 'not impemented now' );
  },
  /**
   * @method v6.AbstractRenderer#transform
   * @param  {number}  m11 X scale.
   * @param  {number}  m12 X skew.
   * @param  {number}  m21 Y skew.
   * @param  {number}  m22 Y scale.
   * @param  {number}  dx  X translate.
   * @param  {number}  dy  Y translate.
   * @chainable
   * @see v6.Transform#transform
   */
  transform: function transform ( m11, m12, m21, m22, dx, dy )
  {
    this.matrix.transform( m11, m12, m21, m22, dx, dy );
    return this;
  },
  /**
   * @method v6.AbstractRenderer#translate
   * @param  {number}  x - X translate.
   * @param  {number}  y - Y translate.
   * @chainable
   * @see v6.Transform#translate
   */
  translate: function translate ( x, y )
  {
    this.matrix.translate( x, y );
    return this;
  },
  /**
   * @method v6.AbstractRenderer#restore
   * @chainable
   * @see v6.Transform#restore
   */
  restore: function restore ()
  {
    this.matrix.restore();
    return this;
  },
  /**
   * @method v6.AbstractRenderer#save
   * @chainable
   * @see v6.Transform#save
   */
  save: function save ()
  {
    this.matrix.save();
    return this;
  },
  /**
   * @method v6.AbstractRenderer#scale
   * @param {number} x
   * @param {number} y
   * @chainable
   * @see v6.Transform#scale
   */
  scale: function scale ( x, y )
  {
    this.matrix.scale( x, y );
    return this;
  },
  /**
   * Устанавливает "rectAlign" настройку рендеринга.
   * @method v6.AbstractRenderer#rectAlign
   * @param {constant} value `LEFT`, `CENTER`, `RIGHT` or `TOP`, `MIDDLE`, `BOTTOM`.
   * @chainable
   * @example
   * // Set "rectAlign" drawing setting to CENTER | MIDDLE.
   * renderer.rectAlign( constants.get( 'CENTER' ) );
   * renderer.rectAlign( constants.get( 'MIDDLE' ) );
   */
  rectAlign: function rectAlign ( value )
  {
    if ( value === constants.get( 'LEFT' ) || value === constants.get( 'CENTER' ) || value === constants.get( 'RIGHT' ) ) {
      this._rectAlignX = value;
    } else if ( value === constants.get( 'TOP' ) || value === constants.get( 'MIDDLE' ) || value === constants.get( 'BOTTOM' ) ) {
      this._rectAlignY = value;
    } else {
      throw Error( 'Got unknown "rectAlign" constant. The known are: LEFT, CENTER, RIGHT, TOP, MIDDLE, BOTTOM.' );
    }
    return this;
  },
  constructor: AbstractRenderer
};
[
  [ 'noStroke', '_doStroke', 'stroke', '_stroke', '_strokeColor' ],
  [ 'noFill', '_doFill', 'fill', '_fill', '_fillColor' ]
].forEach( function ( values )
{
  AbstractRenderer.prototype[ values[ 0 ] ] = function ()
  {
    this[ values[ 1 ] ] = false;
    return this;
  };
  AbstractRenderer.prototype[ values[ 2 ] ] = function ( r, g, b, a )
  {
    if ( typeof r === 'undefined' ) {
      this[ values[ 3 ] ]();
    } else if ( typeof r === 'boolean' ) {
      this[ values[ 1 ] ] = r;
    } else {
      if ( typeof r === 'string' || this[ values[ 4 ] ].type !== this.settings.color.type ) {
        this[ values[ 4 ] ] = new this.settings.color( r, g, b, a );
      } else {
        this[ values[ 4 ] ].set( r, g, b, a );
      }
      this[ values[ 1 ] ] = true;
    }
    return this;
  };
} );
/**
 * Инициализирует рендерер на `"self"`.
 * @method v6.AbstractRenderer.create
 * @param  {v6.AbstractRenderer} self    Рендерер который надо инициализировать.
 * @param  {object}              options {@link v6.options}
 * @param  {constant}            type    Тип рендерера: `2D` или `GL`. Не может быть `AUTO`!.
 * @return {void}                        Ничего не возвращает.
 * @example <caption>Custom Renderer</caption>
 * var AbstractRenderer = require( 'v6.js/core/renderer/AbstractRenderer' );
 * var settings         = require( 'v6.js/core/renderer/settings' );
 * var constants        = require( 'v6.js/core/constants' );
 *
 * function CustomRenderer ( options )
 * {
 *   AbstractRenderer.create( this, defaults( settings, options ), constants.get( '2D' ) );
 * }
 */
AbstractRenderer.create = function create ( self, options, type )
{
  var context;
  /**
   * @member {HTMLCanvasElement} v6.AbstractRenderer#canvas
   */
  if ( options.canvas ) {
    self.canvas = options.canvas;
  } else {
    self.canvas = document.createElement( 'canvas' );
    self.canvas.innerHTML = 'Unable to run this application.';
  }
  if ( type === constants.get( '2D' ) ) {
    context = '2d';
  } else if ( type !== constants.get( 'GL' ) ) {
    throw Error( 'Got unknown renderer type. The known are: `2D` and `GL`' );
  } else if ( ! ( context = getWebGL() ) ) {
    throw Error( 'Cannot get WebGL context. Try to use `2D` as the renderer type or `v6.Renderer2D` instead of `v6.RendererGL`' );
  }
  /**
   * @member {object} v6.AbstractRenderer#context
   */
  self.context = self.canvas.getContext( context, {
    alpha: options.alpha
  } );
  /**
   * @member {object} v6.AbstractRenderer#settings
   */
  self.settings = options.settings;
  /**
   * @member {constant} v6.AbstractRenderer#type
   */
  self.type = type;
  /**
   * @private
   * @member {Array.<object>} v6.AbstractRenderer#_stack
   */
  self._stack = [];
  /**
   * @private
   * @member {number} v6.AbstractRenderer#_stackIndex
   */
  self._stackIndex = -1;
  /**
   * Выглядит так: `[ x1, y1, x2, y2 ]`.
   * @private
   * @member {Array.<number>} v6.AbstractRenderer#_vertices
   */
  self._vertices = [];
  if ( typeof options.appendTo === 'undefined' ) {
    self.appendTo( document.body );
  } else if ( options.appendTo !== null ) {
    self.appendTo( options.appendTo );
  }
  if ( 'w' in options || 'h' in options ) {
    self.resize( options.w || 0, options.h || 0 );
  } else if ( options.appendTo !== null ) {
    self.resizeTo( options.appendTo || document.body );
  } else {
    self.resize( 600, 400 );
  }
  setDefaultDrawingSettings( self, self );
};
/**
 * Заполняет фон рендерера цветом.
 * @virtual
 * @method v6.AbstractRenderer#backgroundColor
 * @param {number|TColor} [r]
 * @param {number}        [g]
 * @param {number}        [b]
 * @param {number}        [a]
 * @chainable
 * @example
 * // Fill renderer with "lightpink" color.
 * renderer.backgroundColor( 'lightpink' );
 */
/**
 * Заполняет фон рендерера картинкой.
 * @virtual
 * @method v6.AbstractRenderer#backgroundImage
 * @param {v6.AbstractImage} image Картинка, которая должна использоваться для фона.
 * @chainable
 * @example
 * // Create background image.
 * var image = Image.fromURL( 'background.jpg' );
 * // Fill renderer with the image.
 * renderer.backgroundImage( Image.stretch( image, renderer.w, renderer.h ) );
 */
/**
 * Очищает контекст.
 * @virtual
 * @method v6.AbstractRenderer#clear
 * @chainable
 * @example
 * // Clear renderer's context.
 * renderer.clear();
 */
/**
 * Отрисовывает переданные вершины.
 * @virtual
 * @method v6.AbstractRenderer#drawArrays
 * @param {Float32Array|Array} verts Вершины, которые надо отрисовать. Если не передано для
 *                                   {@link v6.RendererGL}, то будут использоваться вершины из
 *                                   стандартного буфера ({@link v6.RendererGL#buffers.default}).
 * @param {number}             count Количество вершин, например: 3 для треугольника.
 * @chainable
 * @example
 * // A triangle.
 * var vertices = new Float32Array( [
 *   0, 0,
 *   1, 1,
 *   0, 1
 * ] );
 *
 * // Draw the triangle.
 * renderer.drawArrays( vertices, 3 );
 */
/**
 * Рисует картинку.
 * @virtual
 * @method v6.AbstractRenderer#drawImage
 * @param {v6.AbstractImage} image Картинка которую надо отрисовать.
 * @param {number}           x     "Destination X". X координата картинки.
 * @param {number}           y     "Destination Y". Y координата картинки.
 * @param {number}           w     "Destination Width". Ширина картинки.
 * @param {number}           h     "Destination Height". Высота картинки.
 * @chainable
 * @example
 * // Create image.
 * var image = Image.fromURL( '300x200.png' );
 * // Draw image.
 * renderer.drawImage( image, 0, 0, 600, 400 );
 */
/**
 * Рисует прямоугольник.
 * @virtual
 * @method v6.AbstractRenderer#rect
 * @param {number} x X координата прямоугольника.
 * @param {number} y Y координата прямоугольника.
 * @param {number} w Ширина прямоугольника.
 * @param {number} h Высота прямоугольника.
 * @chainable
 * @example
 * // Draw rectangle.
 * renderer.rect( 20, 20, 80, 80 );
 */
/**
 * Рисует круг.
 * @virtual
 * @method v6.AbstractRenderer#arc
 * @param {number} x X координата круга.
 * @param {number} y Y координата круга.
 * @param {number} r Радиус круга.
 * @chainable
 * @example
 * // Draw circle.
 * renderer.arc( 60, 60, 40 );
 */
module.exports = AbstractRenderer;
