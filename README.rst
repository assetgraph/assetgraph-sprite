AssetGraph-sprite
=================

A plugin (or "transform") for `AssetGraph
<http://github.com/One-com/assetgraph`_ that optimizes CSS background
images by creating sprite images. The spriting is guided by a set of
custom CSS properties with a ``-one-sprite`` prefix.

Installation
------------

AssetGraph-sprite uses `node-canvas
<http://github.com/LearnBoost/node-canvas>`_ for creating the sprite
images themselves, which is not a pure-node module and requires the
Cairo development sources version 1.10 or later (`libcairo2-dev` on
Ubuntu & friends) and compilation of some glue C++-code to work.

When Cairo is in place, you can proceed to install AssetGraph-sprite:

    $ npm install assetgraph-sprite

License
-------

AssetGraph-sprite is licensed under a standard 3-clause BSD license -- see the
``LICENSE``-file for details.

