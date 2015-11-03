/*global describe, it*/
var pluck = require('lodash.pluck'),
    expect = require('./unexpected-with-plugins'),
    AssetGraph = require('assetgraph'),
    spriteBackgroundImages = require('../lib/spriteBackgroundImages');

// Helper for extracting all nodes defining a specific property from a postcss rule
function getProperties(container, propertyName) {
    return container.nodes.filter(function (node) {
        return node.prop === propertyName;
    });
}

describe('spriteBackgroundImages', function () {
    it('should sprite the background images in a simple test case', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/simple/'})
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
            });
    });

    it('should handle the same simple test case again with -sprite-image-format set to jpg', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/simple/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                var cssAsset = assetGraph.findAssets({type: 'Css'})[0];
                cssAsset.parseTree.nodes[0].append('-sprite-image-format: jpg');
                cssAsset.markDirty();
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 0);

                var jpegAssets = assetGraph.findAssets({type: 'Jpeg'});
                expect(jpegAssets, 'to have length', 1);
                expect(jpegAssets[0].rawSrc.slice(6, 10).toString('ascii'), 'to equal', 'JFIF');
            });
    });

    it('should process a sprite with no group selector', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/noGroupSelector/'})
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
                               /^\.icon-foo \{\n    background-image: url\(sprite-.*?-\d+\.png\);\n    background-position: 0 0;\n\}\n\n\.icon-bar \{\n    background-image: url\(sprite-.*?-\d+\.png\);\n    background-position: -12px 0;\n\}\n$/);
            });
    });

    it('should handle sprites with two images where one has spriteNoGroup in its query string', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/spriteNoGroup/'})
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
                               /^\.foo \{\n    background-image: url\((sprite-.*?-\d+\.png)\);\n}\n\n\.foo-foo \{\n    background-image: url\(\1\);\n    background-position: 0 0\n\}\n\n\.foo-bar \{\n    background-position: -12px 0\n\}\n$/);
            });
    });

    it('should process two sprites with -sprite-location properties in the group selector', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/spriteLocation/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 4);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 2);
                expect(assetGraph, 'to contain relations', 'CssImage', 2);

                var cssImageHrefs = pluck(assetGraph.findRelations({type: 'CssImage'}), 'href').sort();
                expect(cssImageHrefs[0], 'to equal', 'myImage.png?pngquant=128');
                expect(cssImageHrefs[1], 'to match', /^sprite-.*?-\d+\.png\?pngquant=128$/);
            });
    });

    it('should handle an existing background-image property in the group selector', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/existingBackgroundImageInGroupSelector/'})
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
                               /^\.icon \{\n    background-image: url\(sprite-.*?-\d+\.png\) !important;\n}\n\n\.icon-foo \{\n    background-position: 0 0;\n\}\n$/);
            });
    });

    it('should handle an existing background property in the group selector', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/existingBackgroundInGroupSelector/'})
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
                               /^\.icon \{\n    background: red url\(sprite-.*?-\d+\.png\) !important;\n}\n\n\.icon-foo \{\n    background-position: 0 0;\n\}\n$/);
            });
    });

    it('should handle an existing background property in the sprite selector', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/existingBackgroundInSpriteSelector/'})
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
                               /^\.icon \{\n    background-image: url\((sprite-.*?-\d+\.png)\);\n}\n\n\.icon-foo \{\n    background-position: 0 0;\n\}\n\n.icon-bar \{\n    background: -12px 4px;\n}\n\n.icon-quux \{\n    background: url\(\1\) -1610px -4px;\n}\n$/);
            });
    });

    it('should handle existing background-position properties', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/existingBackgroundPositions/'})
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
                               /^\.icon \{\n    background-image: url\((sprite-.*?-\d+\.png)\);\n}\n\n\.icon-foo \{\n    background-position: 0 0 !important;\n\}\n\n\.icon-bar \{\n    background-position: -112px -40px !important;\n\}\n\n\.icon-quux \{\n    background-image: url\(\1\);\n    background-position: -1610px 2px !important;\n\}\n$/);
            });
    });

    it('should handle a background-image and a background that are !important', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/important/'})
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
                               /^\.icon \{\n    background-image: (url\(sprite-.*?-\d+\.png\));\n}\n\n\.icon-foo \{\n    background-image: \1 !important;\n    background-position: 0 0;\n\}\n\n\.icon-bar \{\n    background: red !important;\n    background-position: -12px 0;\n\}\n$/);
            });
    });

    it('should handle broken images', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/brokenImages/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 2);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain relations', 'CssImage');
            });
    });

    it('should handle images with wrong extensions', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/imagesWithWrongExtensions/'})
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
            });
    });

    it('should handle duplicate identical sprite group names', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/duplicateSpriteGroupName/'})
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
            });
    });

    it('should warn on identical sprite group names', function () {
        var warnings = [];

        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/duplicateSpriteGroupName/'})
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
                expect(warnings, 'to have length', 1);
            });
    });

    it('should get the background-position right when spriting a @2x image', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/retina/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Css', 1);
                expect(assetGraph, 'to contain assets', 'Png', 2);
                expect(assetGraph, 'to contain assets', { type: 'Png', devicePixelRatio: 1 }, 1);
                expect(assetGraph, 'to contain assets', { type: 'Png', devicePixelRatio: 2 }, 1);

                assetGraph.findRelations({ type: 'CssImage', node: { selector: '.regular' } }).forEach(function (relation) {
                    expect(relation.to.devicePixelRatio, 'to be', 1);
                    expect(getProperties(relation.node, 'background-size'), 'to be empty');
                });

                assetGraph.findRelations({ type: 'CssImage', node: { selector: '.retina' } }).forEach(function (relation) {
                    expect(relation.to.devicePixelRatio, 'to be', 2);
                    expect(getProperties(relation.node, 'background-size'), 'to have length', 1 );
                });
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png', 1);
                expect(assetGraph, 'to contain relations', 'CssImage', 2);
                expect(assetGraph, 'to contain relations', { type: 'CssImage', node: { selector: '.regular' } }, 1);
                expect(assetGraph, 'to contain relations', { type: 'CssImage', node: { selector: '.retina' } }, 1);

                assetGraph.findRelations({ type: 'CssImage', node: { selector: '.regular' } }).forEach(function (relation) {
                    expect(getProperties(relation.node), 'to be empty');
                });

                assetGraph.findRelations({ type: 'CssImage', node: { selector: '.retina' } }).forEach(function (relation) {
                    expect(getProperties(relation.node, 'background-size'), 'to satisfy', [ { value: '89px 59px' } ]);
                    expect(getProperties(relation.node, 'background-position'), 'to satisfy', [ { value: '-30px 0' } ]);
                });
            });
    });

    it('should sprite retina @2x inline styled backgrounds correctly', function () {
        return new AssetGraph({root: __dirname + '/../testdata/spriteBackgroundImages/retina/'})
            .loadAssets('inline-style.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Css', 3);
                expect(assetGraph, 'to contain assets', 'Png', 2);
                expect(assetGraph, 'to contain relations', 'CssImage', 4);
            })
            .queue(spriteBackgroundImages())
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png', 1);
                expect(assetGraph, 'to contain relations', 'CssImage', 1);
            });
    });
});
