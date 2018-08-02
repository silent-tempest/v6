'use strict';

var CompoundedImage = require( './CompoundedImage' );

var report = require( './report' );

/**
 * @param {string|HTMLImageElement} url
 */
function Image ( url ) {

  this.loaded = false;

  this.x = 0;
  this.y = 0;

  if ( typeof HTMLImageElement !== 'undefined' && url instanceof HTMLImageElement ) {
    if ( url.src ) {
      if ( url.complete ) {
        this._onload();
      } else {
        report( 'new v6.Image: you should manually set the "loaded" property if you are using "new v6.Image( image )"' );
      }

      this.url = url.src;
    } else {
      this.url = '';
    }

    this.image = url;
  } else if ( typeof url === 'string' ) {
    this.image = document.createElement( 'img' );
    this.url = url;
    this.load();
  } else {
    throw TypeError( 'new v6.Image: first argument must be a string or a HTMLImageElement object' );
  }

}

Image.prototype = {
  _onload: function _onload ( e ) {

    if ( e ) {
      this.image.onload = null;
    }

    this.w = this.dw = this.image.width;
    this.h = this.dh = this.image.height;

    this.loaded = true;

  },

  /*
   * @returns {v6.Image}
   */
  load: function load ( url ) {
    if ( ! this.loaded ) {

      this.image.onload = this._onload.bind( this );

      this.image.src = this.url = ( this.url || url || '' );

    }

    return this;
  },

  /**
   * tl;dr: Just the exit-function from v6.CompoundedImage::get() recursion.
   *
   * Since v6.Image functions (static) can work with both v6.Image and
   * v6.CompoundedImage, a source object (v6.Image) can be required in them.
   * Thus, there is v6.CompoundedImage::get(), which starts a recursion through
   * intermediate objects (v6.CompoundedImage) and v6.Image::get(), which stop it
   * as the source object (v6.Image).
   *
   * @returns {v6.Image}
   * @see v6.CompoundedImage#get()
   */
  get: function get () {
    return this;
  },

  constructor: Image
};

/**
 * @param {v6.Image|v6.CompoundedImage} image
 * @param {number} w
 * @param {number} h
 * @returns {v6.CompoundedImage}
 */
Image.stretch = function stretch ( image, w, h ) {

  var x = h / image.h * image.w;

  // stretch width (keep w, change h)

  if ( x < w ) {
    h = w / image.w * image.h;

  // stretch height (change w, keep h)

  } else {
    w = x;
  }

  return new CompoundedImage( image.get(), image.x, image.y, image.w, image.h, w, h );

};

/**
 * @param {v6.Image|v6.CompoundedImage} image
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @returns {v6.CompoundedImage}
 */
Image.cut = function cut ( image, x, y, dw, dh ) {

  var w = image.w / image.dw * dw;
  var h = image.h / image.dh * dh;

  x += image.x;

  if ( x + w > image.x + image.w ) {
    throw Error( 'v6.Image.cut: cannot cut the image because the new image X or W is out of bounds' );
  }

  y += image.y;

  if ( y + h > image.y + image.h ) {
    throw Error( 'v6.Image.cut: cannot cut the image because the new image Y or H is out of bounds' );
  }

  return new CompoundedImage( image.get(), x, y, w, h, dw, dh );

};

module.exports = Image;
