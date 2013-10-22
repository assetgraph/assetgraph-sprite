var vows = require('vows'),
    assert = require('assert'),
    _ = require('underscore'),
    AssetGraph = require('assetgraph'),
    spriteBackgroundImages = require('../lib/spriteBackgroundImages');

vows.describe('Sprite background images').addBatch({
    'After loading a simple test case with images and spriting instructions': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages/simple/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains 4 assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 4);
        },
        'the graph contains 3 Pngs': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 3);
        },
        'the graph contains one Css asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Css'}).length, 1);
        },
        'the graph contains 3 CssImage relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 3);
        },
        'then spriting the background images': {
            topic: function (assetGraph) {
                assetGraph.queue(spriteBackgroundImages()).run(this.callback);
            },
            'the number of Png assets should be down to one': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
            }
        }
    },
    'After loading the same test case again, set the -sprite-image-format to jpg and sprite the background images': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages/simple/'})
                .loadAssets('style.css')
                .populate()
                .queue(function (assetGraph) {
                    var cssAsset = assetGraph.findAssets({type: 'Css'})[0];
                    cssAsset.parseTree.cssRules[0].style.setProperty('-sprite-image-format', 'jpg');
                    cssAsset.markDirty();
                })
                .queue(spriteBackgroundImages())
                .run(this.callback);
        },
        'there should be no Png assets left in the graph': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 0);
        },
        'the graph should contain an Jpeg asset': function (assetGraph) {
            var jpegAssets = assetGraph.findAssets({type: 'Jpeg'});
            assert.equal(jpegAssets.length, 1);
            assert.equal(jpegAssets[0].rawSrc.slice(6, 10).toString('ascii'), 'JFIF');
        }
    },
    'After loading a simple test case with a sprite with no group selector': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages/noGroupSelector/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains 2 Pngs': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 2);
        },
        'then spriting the background images': {
            topic: function (assetGraph) {
                assetGraph.queue(spriteBackgroundImages()).run(this.callback);
            },
            'the number of Png assets should be down to one': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
            },
            'the graph should contain 2 CssImage relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 2);
            },
            'the stylesheet should have the expected contents': function (assetGraph) {
                assert.matches(assetGraph.findAssets({type: 'Css'})[0].text,
                               /^\.icon-foo\{background-image:url\(\d+\.png\);background-position:0 0\}\.icon-bar\{background-image:url\(\d+\.png\);background-position:-12px 0\}$/);
            }
        }
    },
    'After loading a simple test case with a sprites with two images where one has spriteNoGroup in its query string': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages/spriteNoGroup/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains 2 Pngs': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 2);
        },
        'then spriting the background images': {
            topic: function (assetGraph) {
                assetGraph.queue(spriteBackgroundImages()).run(this.callback);
            },
            'the number of Png assets should be down to one': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
            },
            'the graph should contain 2 CssImage relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 2);
            },
            'the stylesheet should have the expected contents': function (assetGraph) {
                assert.matches(assetGraph.findAssets({type: 'Css'})[0].text,
                               /^\.foo\{background-image:url\((\d+\.png)\)}\.foo-foo\{background-image:url\(\1\);background-position:0 0\}\.foo-bar\{background-position:-12px 0\}$/);
            }
        }
    },
    'After loading a simple test case with two sprites with -sprite-location properties in the group selector': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages/spriteLocation/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains 4 Pngs': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 4);
        },
        'then spriting the background images': {
            topic: function (assetGraph) {
                assetGraph.queue(spriteBackgroundImages()).run(this.callback);
            },
            'the number of Png assets should be down to 2': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 2);
            },
            'the graph should contain 2 CssImage relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 2);
            },
            'the hrefs of the CssImage relations should have the expected values': function (assetGraph) {
                var cssImageHrefs = _.pluck(assetGraph.findRelations({type: 'CssImage'}), 'href').sort();
                assert.matches(cssImageHrefs[0], /^\d+\.png\?pngquant=128$/);
                assert.equal(cssImageHrefs[1], 'myImage.png?pngquant=128');
            }
        }
    },
    'After loading a test case with an existing background-image property in the group selector': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages/existingBackgroundImageInGroupSelector/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains 1 Pngs': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
        },
        'then spriting the background images': {
            topic: function (assetGraph) {
                assetGraph.queue(spriteBackgroundImages()).run(this.callback);
            },
            'the number of Png assets should still be 1': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
            },
            'the graph should contain 1 CssImage relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 1);
            },
            'the stylesheet should have the expected contents': function (assetGraph) {
                assert.matches(assetGraph.findAssets({type: 'Css'})[0].text,
                               /^\.icon\{background-image:url\(\d+\.png\)!important}\.icon-foo\{background-position:0 0\}$/);
            }
        }
    },
    'After loading a test case with an existing background property in the group selector': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages/existingBackgroundInGroupSelector/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains 1 Png': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
        },
        'then spriting the background images': {
            topic: function (assetGraph) {
                assetGraph.queue(spriteBackgroundImages()).run(this.callback);
            },
            'the number of Png assets should still be 1': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
            },
            'the graph should contain 1 CssImage relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 1);
            },
            'the stylesheet should have the expected contents': function (assetGraph) {
                assert.matches(assetGraph.findAssets({type: 'Css'})[0].text,
                               /^\.icon\{background:red url\(\d+\.png\)!important}\.icon-foo\{background-position:0 0\}$/);
            }
        }
    },
    'After loading a test case with an existing background property in the sprite selector': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages/existingBackgroundInSpriteSelector/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains 3 Pngs': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 3);
        },
        'then spriting the background images': {
            topic: function (assetGraph) {
                assetGraph.queue(spriteBackgroundImages()).run(this.callback);
            },
            'the number of Png assets should still be 1': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
            },
            'the graph should contain 2 CssImage relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 2);
            },
            'the stylesheet should have the expected contents': function (assetGraph) {
                assert.matches(assetGraph.findAssets({type: 'Css'})[0].text,
                               /^\.icon\{background-image:url\((\d+\.png)\)}\.icon-foo\{background-position:0 0\}.icon-bar{background:-12px 4px}.icon-quux{background:url\(\1\) -1610px -4px}$/);
            }
        }
    },
    'After loading a test case with existing background-position properties': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages/existingBackgroundPositions/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains 3 Pngs': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 3);
        },
        'then spriting the background images': {
            topic: function (assetGraph) {
                assetGraph.queue(spriteBackgroundImages()).run(this.callback);
            },
            'the number of Png assets should still be 1': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
            },
            'the graph should contain 2 CssImage relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 2);
            },
            'the stylesheet should have the expected contents': function (assetGraph) {
                assert.matches(assetGraph.findAssets({type: 'Css'})[0].text,
                               /^\.icon\{background-image:url\((\d+\.png)\)}\.icon-foo\{background-position:0 0!important\}\.icon-bar\{background-position:-112px -40px!important\}\.icon-quux\{background-image:url\(\1\);background-position:-1610px 2px!important\}$/);
            }
        }
    },
    'After loading a test case with a background-image and a background that are !important': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages/important/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains 2 Pngs': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 2);
        },
        'then spriting the background images': {
            topic: function (assetGraph) {
                assetGraph.queue(spriteBackgroundImages()).run(this.callback);
            },
            'the number of Png assets should still be 1': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
            },
            'the graph should contain 2 CssImage relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 2);
            },
            'the stylesheet should have the expected contents': function (assetGraph) {
                assert.matches(assetGraph.findAssets({type: 'Css'})[0].text,
                               /^\.icon\{background-image:(url\(\d+\.png\))}\.icon-foo\{background-image:\1!important;background-position:0 0\}\.icon-bar\{background:red!important;background-position:-12px 0\}$/);
            }
        }
    },
    'After loading a test case with broken images': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages/brokenImages/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains 2 Pngs': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 2);
        },
        'then spriting the background images': {
            topic: function (assetGraph) {
                assetGraph.queue(spriteBackgroundImages()).run(this.callback);
            },
            'the number of Png assets should still be 1': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
            },
            'the graph should contain 1 CssImage relation': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 1);
            }
        }
    }
})['export'](module);
