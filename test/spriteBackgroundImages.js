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
                               /^\.icon-foo\{background-image:url\(sprite-.*?-\d+\.png\);background-position:0 0\}\.icon-bar\{background-image:url\(sprite-.*?-\d+\.png\);background-position:-12px 0\}$/);
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
                               /^\.foo\{background-image:url\((sprite-.*?-\d+\.png)\)}\.foo-foo\{background-image:url\(\1\);background-position:0 0\}\.foo-bar\{background-position:-12px 0\}$/);
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
                expect(cssImageHrefs[0], 'to equal', 'myImage.png?pngquant=128');
                expect(cssImageHrefs[1], 'to match', /^sprite-.*?-\d+\.png\?pngquant=128$/);
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
                               /^\.icon\{background-image:url\(sprite-.*?-\d+\.png\)!important}\.icon-foo\{background-position:0 0\}$/);
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
                               /^\.icon\{background:red url\(sprite-.*?-\d+\.png\)!important}\.icon-foo\{background-position:0 0\}$/);
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
                               /^\.icon\{background-image:url\((sprite-.*?-\d+\.png)\)}\.icon-foo\{background-position:0 0\}.icon-bar{background:-12px 4px}.icon-quux{background:url\(\1\) -1610px -4px}$/);
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
                               /^\.icon\{background-image:url\((sprite-.*?-\d+\.png)\)}\.icon-foo\{background-position:0 0!important\}\.icon-bar\{background-position:-112px -40px!important\}\.icon-quux\{background-image:url\(\1\);background-position:-1610px 2px!important\}$/);
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
                               /^\.icon\{background-image:(url\(sprite-.*?-\d+\.png\))}\.icon-foo\{background-image:\1!important;background-position:0 0\}\.icon-bar\{background:red!important;background-position:-12px 0\}$/);
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

    it('should handle duplicate identical sprite group names', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/duplicateSpriteGroupName/'})
            .loadAssets('identical*.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Css', 2);
                expect(assetGraph, 'to contain assets', 'Png', 3);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                var cssAssets = assetGraph.findAssets({ type: 'Css'});

                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain relations', 'CssImage', 2);
                expect(cssAssets[0].text, 'to equal', cssAssets[1].text);
            })
            .run(done);
    });

    it('should warn on identical sprite group names', function (done) {
        var warnings = [];

        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/duplicateSpriteGroupName/'})
            .on('warn', function (warning) {
                warnings.push(warning);
            })
            .loadAssets('identical1.css', 'different.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Css', 2);
                expect(assetGraph, 'to contain assets', 'Png', 3);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                var cssAssets = assetGraph.findAssets({ type: 'Css'});

                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain relations', 'CssImage', 1);
                expect(cssAssets[0].text, 'not to equal', cssAssets[1].text);

                expect(warnings, 'to be a non-empty array');
                expect(warnings.length, 'to be', 1);
            })
            .run(done);
    });

    it('should get the background-position right when spriting a @2x image', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/retina/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Css', 1);
                expect(assetGraph, 'to contain assets', 'Png', 2);
                expect(assetGraph, 'to contain assets', { type: 'Png', devicePixelRatio: 1 }, 1);
                expect(assetGraph, 'to contain assets', { type: 'Png', devicePixelRatio: 2 }, 1);

                assetGraph.findRelations({ type: 'CssImage', cssRule: { selectorText: '.regular' } }).forEach(function (relation) {
                    expect(relation.to.devicePixelRatio, 'to be', 1);
                    expect(relation.cssRule.style, 'not to have property', 'background-size');
                });

                assetGraph.findRelations({ type: 'CssImage', cssRule: { selectorText: '.retina' } }).forEach(function (relation) {
                    expect(relation.to.devicePixelRatio, 'to be', 2);
                    expect(relation.cssRule.style, 'not to have property', 'background-size');
                });
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png', 1);
                expect(assetGraph, 'to contain relations', 'CssImage', 2);
                expect(assetGraph, 'to contain relations', { type: 'CssImage', cssRule: { selectorText: '.regular' } }, 1);
                expect(assetGraph, 'to contain relations', { type: 'CssImage', cssRule: { selectorText: '.retina' } }, 1);

                assetGraph.findRelations({ type: 'CssImage', cssRule: { selectorText: '.regular' } }).forEach(function (relation) {
                    expect(relation.cssRule.style, 'not to have property', 'background-size');
                });

                assetGraph.findRelations({ type: 'CssImage', cssRule: { selectorText: '.retina' } }).forEach(function (relation) {
                    expect(relation.cssRule.style, 'to have property', 'background-size');
                    expect(relation.cssRule.style.getPropertyValue('background-size'), 'to be', '88.5px 59px');
                });
            })
            .run(done);
    });
});
