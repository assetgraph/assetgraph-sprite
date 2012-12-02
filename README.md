AssetGraph-sprite
=================

A plugin (or "transform") for <a
href="http://github.com/One-com/assetgraph">AssetGraph</a> that
optimizes CSS background images by creating sprite images. The
spriting is guided by a set of custom CSS properties with a
`-ag-sprite` prefix.

You can tell AssetGraph-sprite that you want to sprite a given CSS
background image by adding a `-ag-sprite-group` property to the
selector containing the `background` or `background-image` property:

```css
.classone {background-image: url(images/thething.png);      -ag-sprite-group: my-sprite-group; }
.classtwo {background-image: url(images/theotherthing.png); -ag-sprite-group: my-sprite-group; }
```

This is valid CSS and will also work fine on its own in "development
mode" without a compilation step, so you don't need to rebuild your
project all the time, except when you want to test the spriting
itself. After being run through the AssetGraph-sprite transform it
will look something like this:

```css
.classone { background-image: url(7bda8ba87d.png); background-position: 0 0; }
.classtwo { background-image: url(7bda8ba87d.png); background-position: -34px 0; }
```

Some additional properties are supported:

#### `-ag-sprite-padding: <top> <right> <bottom> <left>` ####

Adds "keepaway space" around the image in the sprite. Sometimes
useful if the background image is applied to an element that takes
up a bigger area than the background image. Supports regular CSS
padding syntax, including the shorthand variants with 1, 2, or 3
values. The only supported unit is `px`. Defaults to `0 0 0 0`.  Not
supported by the `jim-scott` packer (see the docs for
`-ag-sprite-packer` below).

#### `-ag-sprite-important: important` ####

Makes sure that the injected `background-image` property pointing
at the sprite image gets the `!important` suffix.

#### `-ag-sprite-no-group-selector: true` ####

Tells AssetGraph-sprite that you want this selector to contain a
`background-image` property pointing at the sprite image, even
if the sprite group has a "group selector" configured (see below).


Configuring a sprite
--------------------

If you can guarantee that the HTML elements that need to have the
background image applied are also matched by another selector, you can
save some more bytes by telling AssetGraph-sprite that it only needs
to add the `background-image` property pointing at the sprite to that
selector using the `-ag-sprite-selector-for-group` property:

```css
.foo { -ag-sprite-selector-for-group: my-sprite-group; }
.classone {background-image: url(images/thething.png);      -ag-sprite-group: my-sprite-group; }
.classtwo {background-image: url(images/theotherthing.png); -ag-sprite-group: my-sprite-group; }
```

Which compiles to:

```css
.foo { background-image: url(7bda8ba87d.png); }
.classone { background-position: 0 0; }
.classtwo { background-position: -34px 0; }
```

You can tweak the generated sprite images by putting additional
`-ag-sprite`-prefixed configuration properties into the "group
selector", for example:

```css
.foo {
    -ag-sprite-selector-for-group: my-sprite-group;
    -ag-sprite-packer: horizontal;
    -ag-sprite-background-color: #a767ac;
}
```

These options are currently supported:

#### `-ag-sprite-packer: horizontal|vertical|jim-scott|try-all` ####

Selects the packing algorithm for the sprite. The `horizontal` and
`vertical` variants naively lay out the images one after the other.
This works well when you have a bunch of images with the same height
or width. The `jim-scott` packer is a little fancier, it's an
implementation of <a
href="http://www.blackpawn.com/texts/lightmaps/">a floor planning
algorithm</a> originally invented by Jim Scott for packing
lightmaps. The Jim Scott packer doesn't support the
`-ag-sprite-padding` property on the individual images.  If you don't
specify `-ag-sprite-packer`, the default is `try-all`, which runs all
the algorithms and chooses the packing that produces the smallest
sprite image (area-wise).

#### `-ag-sprite-important: important` ####

Adds `!important` after the injected `background-image`. As mentioned
above this is also supported for group selector-less sprites; simply add
`-ag-sprite-important: important` to the selector containing
the `background` or `background-image` selector).

#### `-ag-sprite-image-format: png|jpg` ####

The format of the generated sprite. More will be added when <a
href="http://github.com/LearnBoost/node-canvas">node-canvas</a> gains
support for more image formats.

#### `-ag-sprite-background-color: red|yellow|#123123|transparent|...` ####

Specifies the background color for the generated sprite image,
supports any color syntax understood by node-canvas, which is the
entire <a
href="http://www.w3.org/TR/2003/CR-css3-color-20030514/#numerical">CSS3
Color Module</a>, as far as I can tell. Defaults to `transparent`.


Installation
------------

For creating the sprite images themselves AssetGraph-sprite uses <a
href="http://github.com/LearnBoost/node-canvas">node-canvas</a>, which
is not a pure-node module and requires the Cairo development sources
(version 1.10 or later), `libjpeg` (version 8 or later) and
`libgif`. On Ubuntu 10.10 and above you should be able to get them
like this:

```
$ sudo apt-get install libcairo2-dev libgif-dev libjpeg8-dev
```

Now you can proceed to install AssetGraph-sprite:

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
`-ag-sprite-...` instructions, then writes the resulting CSS and
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
