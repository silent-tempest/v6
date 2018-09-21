'use strict';

var getRendererType = require( './internal/get_renderer_type' );
var getWebGL        = require( './internal/get_webgl' );
var RendererGL      = require( './RendererGL' );
var Renderer2D      = require( './Renderer2D' );
var constants       = require( './constants' );
var report          = require( './report' );
var type            = require( './options' ).type;

/**
 * Создает новый рендерер.
 * @method v6.createRenderer
 * @param  {object}              options {@link v6.options}.
 * @return {v6.AbstractRenderer}
 */
function createRenderer ( options ) {
  var type_ = options && options.type || type;

  if ( type_ === constants.RENDERER_AUTO ) {
    type_ = getRendererType();
  }

  if ( type_ === constants.RENDERER_GL ) {
    if ( getWebGL() ) {
      return new RendererGL( options );
    }

    report( 'Cannot create WebGL context. Falling back to 2D.' );
  }

  if ( type_ === constants.RENDERER_2D || type_ === constants.RENDERER_GL ) {
    return new Renderer2D( options );
  }

  throw Error( 'Got unknown renderer type. The known are: `v6.constants.RENDERER_2D` and `v6.constants.RENDERER_GL`' );
}

module.exports = createRenderer;
