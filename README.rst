AssetGraph-sprite
=================

A plugin (or "transform") for `AssetGraph
<http://github.com/One-com/assetgraph>`_ that optimizes CSS background
images by creating sprite images. The spriting is guided by a set of
custom CSS properties with a ``-one-sprite`` prefix.

(More docs will follow!)

Installation
------------

AssetGraph-sprite uses `node-canvas
<http://github.com/LearnBoost/node-canvas>`_ for creating the sprite
images themselves, which is not a pure-node module and requires the
Cairo development sources version 1.10 or later (`libcairo2-dev` on
Ubuntu & friends) and compilation of some glue C++-code to work.

When Cairo is in place, you can proceed to install AssetGraph-sprite::

    $ npm install assetgraph-sprite

Since ``node-canvas`` currently doesn't support GIF files (`issue here
<https://github.com/LearnBoost/node-canvas/issues/78>`_),
AssetGraph-sprite will try to spawn a `GraphicsMagick
<http://graphicsmagick.org/>`_ process to convert GIFs to PNGs before
adding them to a sprite. So if you want to sprite GIFs, GraphicsMagick
must be installed and the ``gm`` command must be in your $PATH.

License
-------

AssetGraph-sprite is licensed under a standard 3-clause BSD license --
see the ``LICENSE``-file for details.
