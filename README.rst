AssetGraph-sprite
=================

A plugin (or "transform") for `AssetGraph
<http://github.com/One-com/assetgraph>`_ that optimizes CSS background
images by creating sprite images. The spriting is guided by a set of
custom CSS properties with a ``-one-sprite`` prefix.

(More docs will follow!)

Installation
------------

For creating the sprite images themselves AssetGraph-sprite uses
`node-canvas <http://github.com/LearnBoost/node-canvas>`_, which is
not a pure-node module and requires the Cairo development sources
(version 1.10 or later), `libjpeg` (version 8 or later) and
`libgif`. On Ubuntu 10.10 and above you should be able to get them
like this::

    $ sudo apt-get install libcairo2-dev libgif-dev libjpeg8-dev

Now you can proceed to install AssetGraph-sprite::

    $ npm install assetgraph-sprite

License
-------

AssetGraph-sprite is licensed under a standard 3-clause BSD license --
see the ``LICENSE``-file for details.
