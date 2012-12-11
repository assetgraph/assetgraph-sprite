var URL = require('url'),
    queryString = require('querystring'),
    _ = require('underscore'),
    seq = require('seq'),
    passError = require('passerror'),
    packers = require('./packers'),
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

function getImageAssetFromCanvas(canvas, assetType, assetGraph, cb) {
    if (assetType === 'Png') {
        canvas.toBuffer(passError(cb, function (pngBuffer) {
            cb(null, new assetGraph.Png({
                rawSrc: pngBuffer
            }));
        }));
    } else {
        var jpegChunks = [];
        canvas.createJPEGStream().on('data', function (chunk) {
            jpegChunks.push(chunk);
        }).on('end', function () {
            cb(null, new assetGraph.Jpeg({
                rawSrc: Buffer.concat(jpegChunks)
            }));
        }).on('error', cb);
    }
}

function calculateSpritePadding(paddingStr) {
    if (paddingStr) {
        // Strip units ('px' assumed)
        var tokens = [];
        paddingStr.split(/[,+]|\s+/).forEach(function (token) {
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

function getRelationSpriteInfoFromIncomingRelation(incomingRelation) {
    var parsedQueryString = queryString.parse(incomingRelation.href.match(/\?([^#]*)/)[1]);
    return {
        groupName: parsedQueryString.sprite || 'default',
        noGroup: 'spriteNoGroup' in parsedQueryString,
        padding: calculateSpritePadding(parsedQueryString.padding),
        asset: incomingRelation.to
    };
}

function extractInfoFromCssRule(cssRule, propertyNamePrefix) {
    var info = {};
    for (var i = 0 ; i < cssRule.style.length ; i += 1) {
        var propertyName = cssRule.style[i];
        if (!propertyNamePrefix || propertyName.indexOf(propertyNamePrefix) === 0) {
            var keyName = propertyName.substr(propertyNamePrefix.length).replace(/-([a-z])/g, function ($0, $1) {
                return $1.toUpperCase();
            });
            info[keyName] = cssRule.style[propertyName].replace(/^([\'\"])(.*)\1$/, "$2");
        }
    }
    return info;
}


module.exports = function () {
    return function spriteBackgroundImages(assetGraph, cb) {
        if (!Canvas) {
            console.warn("assetgraph-sprite: Canvas not found, skipping");
            return cb();
        }

        // Waiting for https://github.com/LearnBoost/node-canvas/issues/52
        var cairoVersion = Canvas.cairoVersion.split(".").map(function (str) {
            return parseInt(str, 10);
        });
        if (cairoVersion[0] < 1 || cairoVersion[1] < 10) {
            console.warn("assetgraph-sprite: Cannot create sprites due to missing canvas.getContext('2d').drawImage() support. Please compile node-canvas with Cairo version 1.10.0 or above.");
            return cb();
        }

        var spriteGroups = {};
        assetGraph.findRelations({type: 'CssImage', to: {isImage: true}, href: /\?(?:|[^#]*&)sprite(?:[=&#]|$)/}).forEach(function (relation) {
            var relationSpriteInfo = getRelationSpriteInfoFromIncomingRelation(relation),
                spriteGroup = (spriteGroups[relationSpriteInfo.groupName] = spriteGroups[relationSpriteInfo.groupName] || {
                    imageInfosById: {}
                }),
                imageInfo = spriteGroup.imageInfosById[relationSpriteInfo.asset.id];
            if (!imageInfo) {
                relationSpriteInfo.incomingRelations = [relation];
                spriteGroup.imageInfosById[relationSpriteInfo.asset.id] = relationSpriteInfo;
            } else {
                imageInfo.incomingRelations.push(relation);
                for (var i = 0 ; i < 4 ; i += 1) {
                    imageInfo.padding[i] = Math.max(relationSpriteInfo.padding[i], imageInfo.padding[i]);
                }
            }
        });

        assetGraph.findAssets({type: 'Css'}).forEach(function (cssAsset) {
            cssAsset.eachRuleInParseTree(function (cssRule) {
                if (cssRule.type !== 1) { // cssom.CSSRule.STYLE_RULE
                    return;
                }
                if (('-sprite-selector-for-group') in cssRule.style) {
                    var spriteInfo = extractInfoFromCssRule(cssRule, '-sprite-'),
                        spriteGroupName = spriteInfo.selectorForGroup;
                    if ('location' in spriteInfo) {
                        var matchLocation = spriteInfo.location.match(/^url\((['"]|)(.*?)\1\)$/);
                        if (matchLocation) {
                            spriteInfo.location = matchLocation[2];
                        }
                    }
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
                        getImageAssetFromCanvas(canvas, /^jpe?g$/.test(spriteInfo.imageFormat) ? 'Jpeg' : 'Png', assetGraph, this);
                    })
                    .seq(function (spriteAsset) {
                        var baseUrl,
                            href = spriteAsset.id + spriteAsset.defaultExtension;
                        if (spriteGroup.placeHolder) {
                            baseUrl = spriteGroup.placeHolder.asset.nonInlineAncestor.url;
                            var location = spriteGroup.placeHolder.location;
                            if (location) {
                                if (/^[?#]/.test(location)) {
                                    href += location;
                                } else {
                                    href = location;
                                }
                            }
                        } else {
                            baseUrl = assetGraph.root;
                        }
                        spriteAsset.url = URL.resolve(baseUrl, href);
                        assetGraph.addAsset(spriteAsset);
                        if (spriteGroup.placeHolder) {
                            var cssRule = spriteGroup.placeHolder.cssRule,
                                relation = new assetGraph.CssImage({
                                    cssRule: cssRule,
                                    from: spriteGroup.placeHolder.asset,
                                    to: spriteAsset
                                });
                            ['background-image', 'background' ].forEach(function (propertyName) {
                                if (!relation.propertyName && cssRule.style[propertyName]) {
                                    relation.propertyName = propertyName;
                                    var propertyValue = cssRule.style.getPropertyValue(propertyName),
                                        propertyPriority = cssRule.style.getPropertyPriority(propertyName);
                                    if (propertyValue === '!important') {
                                        // Hack so that an existing value of "!important" will DTRT
                                        propertyPriority = 'important';
                                        propertyValue = 'url(...)';
                                    } else if (/^\s*$/.test(propertyValue)) {
                                        propertyValue = 'url(...)';
                                    } else {
                                        var existingUrlTokens = propertyValue.match(relation.tokenRegExp);
                                        if (existingUrlTokens) {
                                            relation.tokenNumber = existingUrlTokens.length;
                                        }
                                        propertyValue += ' url(...)';
                                    }
                                    cssRule.style.setProperty(propertyName, propertyValue, propertyPriority);
                                }
                            });
                            if (!relation.propertyName) {
                                relation.propertyName = 'background-image';
                                cssRule.style.setProperty('background-image', 'url(...)');
                            }
                            // I can't see why the ordering of CssImage relations should be significant...
                            assetGraph.addRelation(relation, 'last');
                            relation.refreshHref();
                            ['selector-for-group', 'packer', 'image-format', 'background-color', 'important'].forEach(function (propertyName) {
                                spriteGroup.placeHolder.cssRule.style.removeProperty('-sprite-' + propertyName);
                            });
                        }
                        imageInfos.forEach(function (imageInfo) {
                            imageInfo.incomingRelations.forEach(function (incomingRelation) {
                                incomingRelation.from.markDirty();
                                var relationSpriteInfo = getRelationSpriteInfoFromIncomingRelation(incomingRelation),
                                    style = incomingRelation.cssRule.style,
                                    existingBackgroundPositionValue = style['background-position'],
                                    backgroundPositionPriority,
                                    offsets = [
                                        imageInfo.x,
                                        imageInfo.y
                                    ];

                                if (existingBackgroundPositionValue === '!important') {
                                    // Hack so that an existing value of "!important" will DTRT
                                    backgroundPositionPriority = 'important';
                                } else if (existingBackgroundPositionValue) {
                                    backgroundPositionPriority = style.getPropertyPriority('background-position');
                                    // FIXME: Silently ignores other units than px
                                    var positions = existingBackgroundPositionValue.split(' ').map(function (item) {
                                        return parseInt(item, 10);
                                    });

                                    if (positions.length !== 2 || isNaN(positions[0]) || isNaN(positions[1])) {
                                        console.warn(
                                            'WARNING: trying to sprite',
                                            imageInfo.asset.url,
                                            'with background-position:',
                                            existingBackgroundPositionValue
                                        );
                                    } else {
                                        offsets[0] -= positions[0];
                                        offsets[1] -= positions[1];
                                    }
                                }

                                style.setProperty('background-position', offsets.map(function (item) {
                                    return item ? -item + 'px' : '0';
                                }).join(' '), backgroundPositionPriority);
                                ['group', 'padding', 'no-group-selector', 'important'].forEach(function (propertyName) {
                                    style.removeProperty('-sprite-' + propertyName);
                                });
                                if (relationSpriteInfo.noGroup || !spriteGroup.placeHolder) {
                                    // The user specified that this selector needs its own background-image/background
                                    // property pointing at the sprite rather than relying on the Html elements also being
                                    // matched by the sprite group's "main" selector, which would have been preferable.
                                    var relation = new assetGraph.CssImage({
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
                    })['catch'](callback);
            })
            .seq(function () {
                cb();
            })['catch'](cb);
    };
};
