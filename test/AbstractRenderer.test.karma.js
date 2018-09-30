'use strict';

var defaultDrawingSettings = require( '../core/renderer/internal/default_drawing_settings' );
var AbstractRenderer       = require( '../core/renderer/AbstractRenderer' );
var Renderer2D             = require( '../core/renderer/Renderer2D' );
var RendererGL             = require( '../core/renderer/RendererGL' );
var constants              = require( '../core/constants' );

describe( 'v6.AbstractRenderer', function ()
{
  it( 'Successfully required.', function ()
  {
    AbstractRenderer.should.be.a( 'function' );
  } );

  describe( 'new v6.AbstractRenderer', function ()
  {
    it( 'Throws on attempt to create an instance.', function ()
    {
      ( function ()
      {
        return new AbstractRenderer();
      } ).should.throw( Error );
    } );
  } );

  describe( 'v6.AbstractRenderer.create', function ()
  {
    it( 'Works', function ()
    {
      var renderer = Object.create( Renderer2D.prototype );

      AbstractRenderer.create( renderer, {}, constants.get( 'RENDERER_2D' ) );

      renderer.canvas.should
        .instanceof( HTMLCanvasElement );
      renderer.context.should
        .instanceof( CanvasRenderingContext2D );
      renderer.should
        .like( defaultDrawingSettings );
    } );
  } );
} );
