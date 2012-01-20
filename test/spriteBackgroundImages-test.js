var vows = require('vows'),
    assert = require('assert'),
    AssetGraph = require('assetgraph'),
    transforms = AssetGraph.transforms;

vows.describe('Sprite background images').addBatch({
    'After loading a test case with images and spriting instructions': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages'}).queue(
                transforms.loadAssets('style.css'),
                transforms.populate()
            ).run(this.callback);
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
                assetGraph.queue(require('../lib')()).run(this.callback);
            },
            'the number of Png assets should be down to one': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
            }
        }
    },
    'After loading the same test case again, set the -one-sprite-image-format to jpg and sprite the background images': {
        topic: function () {
            new AssetGraph({root: __dirname + '/spriteBackgroundImages'}).queue(
                transforms.loadAssets('style.css'),
                transforms.populate(),
                function (assetGraph) {
                    var cssAsset = assetGraph.findAssets({type: 'Css'})[0];
                    cssAsset.parseTree.cssRules[0].style.setProperty('-one-sprite-image-format', 'jpg');
                    cssAsset.markDirty();
                },
                require('../lib')()
            ).run(this.callback);
        },
        'there should be no Png assets left in the graph': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 0);
        },
        'the graph should contain an Jpeg asset': function (assetGraph) {
            var jpegAssets = assetGraph.findAssets({type: 'Jpeg'});
            assert.equal(jpegAssets.length, 1);
            assert.equal(jpegAssets[0].rawSrc.slice(6, 10).toString('ascii'), 'JFIF');
        }
    }
})['export'](module);
