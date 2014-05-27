/*global describe, it*/var _ = require('underscore'),
    expect = require('./unexpected-with-plugins'),
    AssetGraph = require('assetgraph'),
    spriteBackgroundImages = require('../lib/spriteBackgroundImages');

describe('spriteBackgroundImages', function () {
    it('should sprite the background images in a simple test case', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/simple/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 4);
                expect(assetGraph, 'to contain assets', 'Png', 3);
                expect(assetGraph, 'to contain asset', 'Css');
                expect(assetGraph, 'to contain relations', 'CssImage', 3);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
            })
            .run(done);
    });

    it('should handle the same simple test case again with -sprite-image-format set to jpg', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/simple/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                var cssAsset = assetGraph.findAssets({type: 'Css'})[0];
                cssAsset.parseTree.cssRules[0].style.setProperty('-sprite-image-format', 'jpg');
                cssAsset.markDirty();
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 0);

                var jpegAssets = assetGraph.findAssets({type: 'Jpeg'});
                expect(jpegAssets, 'to have length', 1);
                expect(jpegAssets[0].rawSrc.slice(6, 10).toString('ascii'), 'to equal', 'JFIF');
            })
            .run(done);
    });

    it('should process a sprite with no group selector', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/noGroupSelector/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 2);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain relations', 'CssImage', 2);
                expect(assetGraph.findAssets({type: 'Css'})[0].text, 'to match',
                               /^\.icon-foo\{background-image:url\(\d+\.png\);background-position:0 0\}\.icon-bar\{background-image:url\(\d+\.png\);background-position:-12px 0\}$/);
            })
            .run(done);
    });

    it('should handle sprites with two images where one has spriteNoGroup in its query string', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/spriteNoGroup/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 2);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain relations', 'CssImage', 2);
                expect(assetGraph.findAssets({type: 'Css'})[0].text, 'to match',
                               /^\.foo\{background-image:url\((\d+\.png)\)}\.foo-foo\{background-image:url\(\1\);background-position:0 0\}\.foo-bar\{background-position:-12px 0\}$/);
            })
            .run(done);
    });

    it('should process two sprites with -sprite-location properties in the group selector', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/spriteLocation/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 4);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 2);
                expect(assetGraph, 'to contain relations', 'CssImage', 2);

                var cssImageHrefs = _.pluck(assetGraph.findRelations({type: 'CssImage'}), 'href').sort();
                expect(cssImageHrefs[0], 'to match', /^\d+\.png\?pngquant=128$/);
                expect(cssImageHrefs[1], 'to equal', 'myImage.png?pngquant=128');
            })
            .run(done);
    });

    it('should handle an existing background-image property in the group selector', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/existingBackgroundImageInGroupSelector/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain relations', 'CssImage');
                expect(assetGraph.findAssets({type: 'Css'})[0].text, 'to match',
                               /^\.icon\{background-image:url\(\d+\.png\)!important}\.icon-foo\{background-position:0 0\}$/);
            })
            .run(done);
    });

    it('should handle an existing background property in the group selector', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/existingBackgroundInGroupSelector/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain relation', 'CssImage');
                expect(assetGraph.findAssets({type: 'Css'})[0].text, 'to match',
                               /^\.icon\{background:red url\(\d+\.png\)!important}\.icon-foo\{background-position:0 0\}$/);
            })
            .run(done);
    });

    it('should handle an existing background property in the sprite selector', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/existingBackgroundInSpriteSelector/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 3);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain relations', 'CssImage', 2);
                expect(assetGraph.findAssets({type: 'Css'})[0].text, 'to match',
                               /^\.icon\{background-image:url\((\d+\.png)\)}\.icon-foo\{background-position:0 0\}.icon-bar{background:-12px 4px}.icon-quux{background:url\(\1\) -1610px -4px}$/);
            })
            .run(done);
    });

    it('should handle existing background-position properties', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/existingBackgroundPositions/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 3);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain relations', 'CssImage', 2);
                expect(assetGraph.findAssets({type: 'Css'})[0].text, 'to match',
                               /^\.icon\{background-image:url\((\d+\.png)\)}\.icon-foo\{background-position:0 0!important\}\.icon-bar\{background-position:-112px -40px!important\}\.icon-quux\{background-image:url\(\1\);background-position:-1610px 2px!important\}$/);
            })
            .run(done);
    });

    it('should handle a background-image and a background that are !important', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/important/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 2);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain relations', 'CssImage', 2);
                expect(assetGraph.findAssets({type: 'Css'})[0].text, 'to match',
                               /^\.icon\{background-image:(url\(\d+\.png\))}\.icon-foo\{background-image:\1!important;background-position:0 0\}\.icon-bar\{background:red!important;background-position:-12px 0\}$/);
            })
            .run(done);
    });

    it('should handle broken images', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/brokenImages/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 2);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain relations', 'CssImage');
            })
            .run(done);
    });

    it('should handle images with wrong extensions', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/imagesWithWrongExtensions/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain asset', 'Jpeg');
                expect(assetGraph, 'to contain relations', 'CssImage', 2);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain no asset', 'Jpeg');
                expect(assetGraph, 'to contain relations', 'CssImage', 2);
            })
            .run(done);
    });
});
