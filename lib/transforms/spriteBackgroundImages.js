var _ = require('underscore'),
    seq = require('seq'),
    passError = require('../util/passError'),
    AssetGraph = require('assetgraph'),
    vendorPrefix = AssetGraph.assets.Css.vendorPrefix,
    urlTools = require('assetgraph/lib/util/urlTools'),
    packers = require('../packers'),
    Canvas;

try {
    Canvas = require('canvas');
} catch (e) {}

require('bufferjs');

function getCanvasImageFromImageAsset(imageAsset, cb) {
    var canvasImage = new Canvas.Image();
    canvasImage.onerror = function (err) {
        process.nextTick(function () {
            err.message += ' (' + imageAsset.toString() + ')';
            cb(err);
        });
    };
    canvasImage.onload = function () {
        process.nextTick(function () {
            cb(null, canvasImage);
        });
    };
    canvasImage.src = imageAsset.rawSrc;
}

function getImageAssetFromCanvas(canvas, assetType, cb) {
    if (assetType === 'Png') {
        canvas.toBuffer(passError(cb, function (pngBuffer) {
            cb(null, new AssetGraph.assets.Png({
                rawSrc: pngBuffer
            }));
        }));
    } else {
        var jpegChunks = [];
        canvas.createJPEGStream().on('data', function (chunk) {
            jpegChunks.push(chunk);
        }).on('end', function () {
            cb(null, new AssetGraph.assets.Jpeg({
                rawSrc: Buffer.concat(jpegChunks)
            }));
        }).on('error', cb);
    }
}

function calculateSpritePadding(paddingStr) {
    if (paddingStr) {
        // Strip units ('px' assumed)
        var tokens = [];
        paddingStr.split(/\s+/).forEach(function (token) {
            var num = parseInt(token.replace(/[a-z]+$/, ''), 10);
            if (!isNaN(num)) {
                tokens.push(num);
            }
        });
        if (tokens.length === 4) {
            return tokens;
        } else if (tokens.length === 3) {
            return [tokens[0], tokens[1], tokens[2], tokens[1]]; // T, L+R, B
        } else if (tokens.length === 2) {
            return [tokens[0], tokens[1], tokens[0], tokens[1]]; // T+B, L+R
        } else if (tokens.length === 1) {
            return [tokens[0], tokens[0], tokens[0], tokens[0]];
        }
    }
    return [0, 0, 0, 0];
}

module.exports = function () {
    return function spriteBackgroundImages(assetGraph, cb) {
        if (!Canvas) {
            console.warn("assetgraph-sprite: Canvas not found, skipping");
        }

        // Waiting for https://github.com/LearnBoost/node-canvas/issues/52
        var cairoVersion = Canvas.cairoVersion.split(".").map(function (str) {return parseInt(str, 10);});
        if (cairoVersion[0] < 1 || cairoVersion[1] < 10) {
            console.warn("assetgraph-sprite: Cannot create sprites due to missing canvas.getContext('2d').drawImage() support. Please compile node-canvas with Cairo version 1.10.0 or above.");
            return cb();
        }

        var spriteGroups = {};
        assetGraph.findRelations({type: 'CssImage'}).forEach(function (relation) {
            var spriteInfo = AssetGraph.assets.Css.extractInfoFromRule(relation.cssRule, vendorPrefix + '-sprite-'),
                asset = relation.to;
            if (spriteInfo.group) {
                var spriteGroup = spriteGroups[spriteInfo.group];
                if (!spriteGroup) {
                    spriteGroup = spriteGroups[spriteInfo.group] = {
                        imageInfosById: {}
                    };
                }
                var imageInfo = spriteGroup.imageInfosById[asset.id],
                    padding = calculateSpritePadding(spriteInfo.padding);
                if (!imageInfo) {
                    imageInfo = spriteGroup.imageInfosById[asset.id] = {
                        padding: padding,
                        asset: asset,
                        incomingRelations: [relation]
                    };
                } else {
                    imageInfo.incomingRelations.push(relation);
                    for (var i = 0 ; i < 4 ; i += 1) {
                        imageInfo.padding[i] = Math.max(padding[i], imageInfo.padding[i]);
                    }
                }
            }
        });

        assetGraph.findAssets({type: 'Css'}).forEach(function (cssAsset) {
            AssetGraph.assets.Css.eachRuleInParseTree(cssAsset.parseTree, function (cssRule) {
                if (cssRule.type !== 1) { // cssom.CSSRule.STYLE_RULE
                    return;
                }
                if ((vendorPrefix + '-sprite-selector-for-group') in cssRule.style) {
                    var spriteInfo = AssetGraph.assets.Css.extractInfoFromRule(cssRule, vendorPrefix + '-sprite-'),
                        spriteGroupName = spriteInfo.selectorForGroup;
                    if (spriteGroupName in spriteGroups) {
                        if (spriteGroups[spriteGroupName].placeHolder) {
                            console.warn("assetgraph-sprite: Multiple definitions of " + spriteGroupName + " sprite");
                        }
                        spriteGroups[spriteGroupName].placeHolder = _.extend(spriteInfo, {
                            asset: cssAsset,
                            cssRule: cssRule
                        });
                    }
                }
            });
        });

        seq(Object.keys(spriteGroups))
            .seqEach(function (spriteGroupName) {
                var callback = this,
                    spriteGroup = spriteGroups[spriteGroupName],
                    imageInfos = _.values(spriteGroup.imageInfosById),
                    spriteInfo = spriteGroup.placeHolder || {};

                seq(imageInfos)
                    .parMap(function (imageInfo) {
                        getCanvasImageFromImageAsset(imageInfo.asset, this);
                    })
                    .seqEach(function (canvasImage, i) {
                        _.extend(imageInfos[i], {
                            canvasImage: canvasImage,
                            width: canvasImage.width,
                            height: canvasImage.height
                        });
                        this();
                    })
                    .seq(function () {
                        var packerName = {
                            'jim-scott': 'jimScott',
                            horizontal: 'horizontal',
                            vertical: 'vertical'
                        }[spriteInfo.packer] || 'tryAll';
                        var packingData = packers[packerName].pack(imageInfos),
                            canvas = new Canvas(packingData.width, packingData.height),
                            ctx = canvas.getContext('2d');
                        imageInfos = packingData.imageInfos;
                        if ('backgroundColor' in spriteInfo) {
                            ctx.fillStyle = spriteInfo.backgroundColor;
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }
                        imageInfos.forEach(function (imageInfo) {
                            ctx.drawImage(imageInfo.canvasImage, imageInfo.x, imageInfo.y, imageInfo.width, imageInfo.height);
                        });
                        getImageAssetFromCanvas(canvas, /^jpe?g$/.test(spriteInfo.imageFormat) ? 'Jpeg' : 'Png', this);
                    })
                    .seq(function (spriteAsset) {
                        spriteAsset.url = urlTools.resolveUrl(assetGraph.root, spriteAsset.id + spriteAsset.defaultExtension);
                        assetGraph.addAsset(spriteAsset);
                        if (spriteGroup.placeHolder) {
                            var cssRule = spriteGroup.placeHolder.cssRule,
                                relation = new AssetGraph.relations.CssImage({
                                    cssRule: cssRule,
                                    propertyName: 'background-image',
                                    from: spriteGroup.placeHolder.asset,
                                    to: spriteAsset
                                });
                            cssRule.style.setProperty('background-image', 'url(...)', spriteGroup.placeHolder.important && 'important');
                            // I can't see why the ordering of CssImage relations should be significant...
                            assetGraph.addRelation(relation, 'last');
                            relation.refreshHref();
                            ['selector-for-group', 'packer', 'image-format', 'background-color', 'important'].forEach(function (propertyName) {
                                 spriteGroup.placeHolder.cssRule.style.removeProperty(vendorPrefix + '-sprite-' + propertyName);
                            });
                        }
                        imageInfos.forEach(function (imageInfo) {
                            imageInfo.incomingRelations.forEach(function (incomingRelation) {
                                incomingRelation.from.markDirty();
                                var relationSpriteInfo = AssetGraph.assets.Css.extractInfoFromRule(incomingRelation.cssRule, vendorPrefix + '-sprite-'),
                                    offsets = [
                                        imageInfo.x,
                                        imageInfo.y
                                    ];

                                if (incomingRelation.cssRule.style['background-position']) {
                                    // FIXME: Silently ignores other units than px
                                    var positions = incomingRelation.cssRule.style['background-position'].split(' ').map(function (item) {
                                            return parseInt(item, 10);
                                        });

                                    if (positions.length !== 2 || isNaN(positions[0]) || isNaN(positions[1])) {
                                        console.warn(
                                            'WARNING: trying to sprite',
                                            imageInfo.asset._url.replace(imageInfo.asset.assetGraph.root, ''),
                                            'with background-position:',
                                            incomingRelation.cssRule.style['background-position']
                                        );
                                    } else {
                                        offsets[0] -= positions[0];
                                        offsets[1] -= positions[1];
                                    }
                                }

                                incomingRelation.cssRule.style.setProperty('background-position',
                                                                            offsets.map(function (item) {
                                                                                return item ? -item + 'px' : '0';
                                                                            }).join(' '),
                                                                            relationSpriteInfo.important && 'important');
                                ['group', 'padding', 'no-group-selector', 'important'].forEach(function (propertyName) {
                                    incomingRelation.cssRule.style.removeProperty(vendorPrefix + '-sprite-' + propertyName);
                                });
                                if (relationSpriteInfo.noGroupSelector || !spriteGroup.placeHolder) {
                                    // The user specified that this selector needs its own background-image/background
                                    // property pointing at the sprite rather than relying on the Html elements also being
                                    // matched by the sprite group's "main" selector, which would have been preferable.
                                    var relation = new AssetGraph.relations.CssImage({
                                        cssRule: incomingRelation.cssRule,
                                        propertyName: incomingRelation.propertyName,
                                        from: incomingRelation.from,
                                        to: spriteAsset
                                    });
                                    assetGraph.addRelation(relation, 'before', incomingRelation);
                                    relation.refreshHref();
                                    assetGraph.removeRelation(incomingRelation);
                                } else {
                                    incomingRelation.detach();
                                }

                                // Remove the original image if it has become an orphan:
                                if (!assetGraph.findRelations({to: incomingRelation.to}).length) {
                                    assetGraph.removeAsset(incomingRelation.to);
                                }
                            });
                        });
                        callback();
                    })
                    ['catch'](callback);
            })
            .seq(function () {
                cb();
            })
            ['catch'](cb);
    };
};
