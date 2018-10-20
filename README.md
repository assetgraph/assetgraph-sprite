AssetGraph-sprite
=================

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/assetgraph/assetgraph-sprite?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![NPM version](https://badge.fury.io/js/assetgraph-sprite.svg)](http://badge.fury.io/js/assetgraph-sprite)
[![Build Status](https://travis-ci.org/assetgraph/assetgraph-sprite.svg?branch=master)](https://travis-ci.org/assetgraph/assetgraph-sprite)
[![Coverage Status](https://coveralls.io/repos/assetgraph/assetgraph-sprite/badge.svg?style=flat)](https://coveralls.io/r/assetgraph/assetgraph-sprite)
[![Dependency Status](https://david-dm.org/assetgraph/assetgraph-sprite.svg)](https://david-dm.org/assetgraph/assetgraph-sprite)

A plugin (or "transform") for <a
href="http://github.com/One-com/assetgraph">AssetGraph</a> that
optimizes CSS background images by creating sprite images. The
spriting is guided by GET parameters and a set of custom CSS
properties with a `-sprite-` prefix.

You can tell AssetGraph-sprite that you want to sprite a given CSS
background image by adding a `sprite` parameter to its query string:

```css
.classone {background-image: url(images/thething.png?sprite=mySpriteGroup); }
.classtwo {background-image: url(images/theotherthing.png?sprite=mySpriteGroup); }
```

This is valid CSS and will also work fine on its own in "development
mode" without a compilation step, so you don't need to rebuild your
project all the time, except when you want to test the spriting
itself. After being run through the AssetGraph-sprite transform it
will look something like this (`123` is the id of the generated sprite
asset and could be any number):

```css
.classone { background-image: url(123.png); background-position: 0 0; }
.classtwo { background-image: url(123.png); background-position: -34px 0; }
```

Some additional parameters are supported:

#### `padding=<top>,<right>,<bottom>,<left>` ####

Adds "keepaway space" around the image in the sprite. Sometimes
useful if the background image is applied to an element that takes
up a bigger area than the background image. Supports regular CSS
padding syntax, including the shorthand variants with 1, 2, or 3
values. The only supported unit is `px`. Defaults to `0 0 0 0`.  Not
supported by the `jim-scott` packer (see the docs for
`-sprite-packer` below).

#### `spriteNoGroup` ####

Tells AssetGraph-sprite that you want this selector to contain a
`background-image` property pointing at the sprite image, even
if the sprite group has a "group selector" configured (see below).


Configuring a sprite
--------------------

If you can guarantee that the HTML elements that need to have the
background image applied are also matched by another selector, you can
save some more bytes by telling AssetGraph-sprite that it only needs
to add the `background-image` property pointing at the sprite to that
selector using the `-sprite-selector-for-group` property:

```css
.foo { -sprite-selector-for-group: mySpriteGroup; }
.classone {background-image: url(images/thething.png?sprite=mySpriteGroup); }
.classtwo {background-image: url(images/theotherthing.png?sprite=mySpriteGroup); }
```

... which compiles to:

```css
.foo { background-image: url(123.png); }
.classone { background-position: 0 0; }
.classtwo { background-position: -34px 0; }
```

AssetGraph-sprite tries to preserve as much of the original CSS as
possible, including existing `background` or `background-image`
properties in the group selector and the priority (`!important`
status), for example:

```css
.foo { -sprite-selector-for-group: mySpriteGroup; background: red !important; }
.classone { background: blue url(images/thething.png?sprite=mySpriteGroup) !important; }
```

Compiles to:

```css
.foo { background: red url(123.png) !important; }
.classone { background: blue !important; background-position: 0 0; }
```

You can tweak the generated sprite images by putting additional
`-sprite`-prefixed configuration properties into the "group
selector", for example:

```css
.foo {
    -sprite-selector-for-group: mySpriteGroup;
    -sprite-packer: horizontal;
    -sprite-background-color: #a767ac;
}
```

These options are currently supported:

#### `-sprite-packer: horizontal|vertical|jim-scott|try-all` ####

Selects the packing algorithm for the sprite. The `horizontal` and
`vertical` variants naively lay out the images one after the other.
This works well when you have a bunch of images with the same height
or width. The `jim-scott` packer is a little fancier, it's an
implementation of <a
href="http://www.blackpawn.com/texts/lightmaps/">a floor planning
algorithm</a> originally invented by Jim Scott for packing
lightmaps. The Jim Scott packer doesn't support the
`-sprite-padding` property on the individual images.  If you don't
specify `-sprite-packer`, the default is `try-all`, which runs all
the algorithms and chooses the packing that produces the smallest
sprite image (area-wise).

#### `-sprite-location: url(...)` ####

Specifies the desired location of the sprite. This is useful in
combination with the `processImages` transform if you want to
postprocess the generated sprite image:

```css
.foo {
     -sprite-selector-for-group: mySpriteGroup;
     -sprite-location: url(mySprite.png?pngquant=128);
}
.classone { background-position: 0 0; }
```

Compiles to:

```css
.foo { background: red url(mySprite.png?pngquant=128) !important; }
.classone { background-position: 0 0; }
```

#### `-sprite-image-format: png|jpg` ####

The format of the generated sprite. More will be added when <a
href="http://github.com/LearnBoost/node-canvas">node-canvas</a> gains
support for more image formats.

#### `-sprite-background-color: red|yellow|#123123|transparent|...` ####

Specifies the background color for the generated sprite image,
supports any color syntax understood by node-canvas, which is the
entire <a
href="http://www.w3.org/TR/2003/CR-css3-color-20030514/#numerical">CSS3
Color Module</a>, as far as I can tell. Defaults to `transparent`.


Installation
------------

```
$ npm install assetgraph-sprite
```

Usage
-----

Since AssetGraph-sprite is intended to be used as part of an AssetGraph
workflow, first you'll need to have AssetGraph installed to use it properly:

```
$ npm install assetgraph
```

Here's a stripped-down example that loads all CSS files in a
directory, loads all the images linked to by `background` and
`background-image` properties, sprites them according to the
`-sprite-...` instructions, then writes the resulting CSS and
all the images to a different directory:

```javascript
var AssetGraph = require('assetgraph');

new AssetGraph({root: "path/to/css/files"})
    .loadAssets('*.css')
    .populate({followRelations: {type: 'CssImage'}})
    .queue(require('assetgraph-sprite')())
    .writeAssetsToDisc({url: /^file:/}, "file:///my/output/dir")
    .run(function (err) {
        if (err) throw err;
        // All done!
    });
```

For a more elaborate example of how AssetGraph-sprite can fit in a
workflow, see the <a href="https://github.com/One-com/assetgraph-builder/blob/master/bin/buildProduction">buildProduction script in AssetGraph-builder</a>


License
-------

AssetGraph-sprite is licensed under a standard 3-clause BSD license --
see the `LICENSE`-file for details.
