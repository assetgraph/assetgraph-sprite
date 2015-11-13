var URL = require('url'),
    queryString = require('querystring'),
    extend = require('lodash.assign'),
    values = require('lodash.values'),
    seq = require('seq'),
    passError = require('passerror'),
    packers = require('./packers'),
    Canvas;

try {
    Canvas = require('canvas');
} catch (e) {}

// Helper for extracting all nodes defining a specific property from a postcss rule
function getProperties(container, propertyName) {
    return container.nodes.filter(function (node) {
        return node.prop === propertyName;
    });
}

function getCanvasImageFromImageAsset(imageAsset, cb) {
    var canvasImage = new Canvas.Image();
    canvasImage.onerror = function (err) {
        process.nextTick(function () {
            err.message += ' (' + imageAsset.urlOrDescription + ')';
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

function calculateSpritePadding(paddingStr, asset) {
    var padding;
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
            padding = tokens;
        } else if (tokens.length === 3) {
            padding = [tokens[0], tokens[1], tokens[2], tokens[1]]; // T, L+R, B
        } else if (tokens.length === 2) {
            padding = [tokens[0], tokens[1], tokens[0], tokens[1]]; // T+B, L+R
        } else if (tokens.length === 1) {
            padding = [tokens[0], tokens[0], tokens[0], tokens[0]];
        }
    } else {
        padding = [0, 0, 0, 0];
    }

    return padding.map(function (size) {
        return Math.max(size, Math.max(asset.devicePixelRatio) - 1);
    });
}

function getRelationSpriteInfoFromIncomingRelation(incomingRelation) {
    var parsedQueryString = queryString.parse(incomingRelation.href.match(/\?([^#]*)/)[1]);
    return {
        groupName: parsedQueryString.sprite || 'default',
        noGroup: 'spriteNoGroup' in parsedQueryString,
        padding: calculateSpritePadding(parsedQueryString.padding, incomingRelation.to),
        asset: incomingRelation.to
    };
}

function extractInfoFromCssRule(cssRule, propertyNamePrefix) {
    var info = {};
    cssRule.walkDecls(function (decl) {
        if (!propertyNamePrefix || decl.prop.indexOf(propertyNamePrefix) === 0) {
            var keyName = decl.prop.substr(propertyNamePrefix.length).replace(/-([a-z])/g, function ($0, $1) {
                return $1.toUpperCase();
            });
            info[keyName] = decl.value.replace(/^([\'\"])(.*)\1$/, '$2');
        }
    });
    return info;
}


module.exports = function () {
    return function spriteBackgroundImages(assetGraph, cb) {
        if (!Canvas) {
            assetGraph.emit('warn', new Error('assetgraph-sprite: Canvas not found, skipping'));
            return cb();
        }

        // Waiting for https://github.com/LearnBoost/node-canvas/issues/52
        var cairoVersion = Canvas.cairoVersion.split('.').map(function (str) {
            return parseInt(str, 10);
        });
        if (cairoVersion[0] < 1 || cairoVersion[1] < 10) {
            assetGraph.emit('warn', new Error('assetgraph-sprite: Cannot create sprites due to missing canvas.getContext("2d").drawImage() support. Please compile node-canvas with Cairo version 1.10.0 or above.'));
            return cb();
        }

        var spriteGroups = {};

        // Find sprite annotated images and create a data structure with their information
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

        var redefinitionErrors = {};

        // Extract sprite grouping information va -sprite- prefixed properties in stylesheets
        assetGraph.findAssets({type: 'Css'}).forEach(function (cssAsset) {
            cssAsset.eachRuleInParseTree(function (cssRule) {
                if (cssRule.type !== 'rule') {
                    return;
                }
                if (getProperties(cssRule, '-sprite-selector-for-group').length > 0) {
                    var spriteInfo = extractInfoFromCssRule(cssRule, '-sprite-'),
                        spriteGroupName = spriteInfo.selectorForGroup;
                    if (spriteInfo.location) {
                        var matchLocation = spriteInfo.location.match(/^url\((['"]|)(.*?)\1\)$/);
                        if (matchLocation) {
                            spriteInfo.location = matchLocation[2];
                        }
                    }
                    var group = spriteGroups[spriteGroupName];
                    if (group) {
                        if (!Array.isArray(group.placeHolders)) {
                            group.placeHolders = [];
                        }

                        if (group.placeHolders.length > 0) {
                            var err;

                            if (Object.keys(group.placeHolders[0]).every(function (key) {
                                if (['asset', 'cssRule'].indexOf(key) !== -1) {
                                    return true;
                                }
                                return group.placeHolders[0][key] === spriteInfo[key];
                            })) {
                                // Queue up these errors as they tend to come in quite big bunches
                                if (!Array.isArray(redefinitionErrors[spriteGroupName])) {
                                    redefinitionErrors[spriteGroupName] = [];
                                }
                                redefinitionErrors[spriteGroupName].push(cssAsset);

                                group.placeHolders.push(extend(spriteInfo, {
                                    asset: cssAsset,
                                    cssRule: cssRule
                                }));
                            } else {
                                err = new Error('assetgraph-sprite: Multiple differing definitions of ' + spriteGroupName + ' sprite.\nThis is most likely an error.');
                                err.asset = cssAsset;

                                assetGraph.emit('warn', err);
                            }

                        } else {
                            group.placeHolders.push(extend(spriteInfo, {
                                asset: cssAsset,
                                cssRule: cssRule
                            }));
                        }

                    }
                }
            });
        });

        Object.keys(redefinitionErrors).forEach(function (spriteGroupName) {
            var message = [
                'assetgraph-sprite: Multiple identical definitions of ' + spriteGroupName + ' sprite.',
                'This might happen if you duplicate CSS using a preprocessor.',
                redefinitionErrors[spriteGroupName].map(function (asset) {
                    return '\t' + asset.urlOrDescription;
                }).join('\n')
            ].join('\n');

            var err = new Error(message);

            assetGraph.emit('info', err);
        });

        seq(Object.keys(spriteGroups))
            .seqEach(function (spriteGroupName) {
                var callback = this,
                    spriteGroup = spriteGroups[spriteGroupName],
                    imageInfos = values(spriteGroup.imageInfosById),
                    spriteInfo = spriteGroup.placeHolders && spriteGroup.placeHolders[0] || {},
                    packingData;

                seq(imageInfos)
                    .parMap(function (imageInfo) {
                        getCanvasImageFromImageAsset(imageInfo.asset, this);
                    })
                    .seqEach(function (canvasImage, i) {
                        extend(imageInfos[i], {
                            canvasImage: canvasImage,
                            width: canvasImage.width,
                            height: canvasImage.height
                        });
                        setImmediate(this);
                    })
                    .seq(function () {
                        var packerName = {
                            'jim-scott': 'jimScott',
                            horizontal: 'horizontal',
                            vertical: 'vertical'
                        }[spriteInfo.packer] || 'tryAll';

                        packingData =  packers[packerName].pack(imageInfos);

                        var canvas = new Canvas(packingData.width, packingData.height),
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
                        var baseUrl = assetGraph.root,
                            href = ['sprite', spriteGroupName, imageInfos.length, spriteAsset.id].join('-') + spriteAsset.defaultExtension;

                        if (Array.isArray(spriteGroup.placeHolders)) {
                            var location = spriteGroup.placeHolders[0].location;

                            if (location) {
                                if (/^[?#]/.test(location)) {
                                    href += location;
                                } else {
                                    href = location;
                                }
                            }
                        }

                        spriteAsset.url = URL.resolve(baseUrl, href);
                        assetGraph.addAsset(spriteAsset);
                        if (Array.isArray(spriteGroup.placeHolders)) {
                            spriteGroup.placeHolders.forEach(function (spriteInfo) {
                                var cssRule = spriteInfo.cssRule,
                                    relation = new assetGraph.CssImage({
                                        node: cssRule,
                                        from: spriteInfo.asset,
                                        to: spriteAsset
                                    });

                                [ 'background-image', 'background' ].forEach(function (propertyName) {
                                    var decls = getProperties(cssRule, propertyName);
                                    if (!relation.propertyName && decls.length > 0) {
                                        relation.propertyName = propertyName;
                                        var propertyValue = decls[0].value;
                                        if (propertyValue === '!important') {
                                            // Hack so that an existing value of "!important" will DTRT
                                            decls[0].important = true;
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
                                        decls[0].value = propertyValue;
                                    }
                                });
                                if (relation.propertyName) {
                                    relation.propertyNode = getProperties(cssRule, relation.propertyName)[0];
                                } else {
                                    cssRule.append('background-image: url(...)');
                                    relation.propertyNode = cssRule.last;
                                }
                                // I can't see why the ordering of CssImage relations should be significant...
                                assetGraph.addRelation(relation, 'last');
                                relation.refreshHref();
                                spriteInfo.cssRule.walkDecls(function (decl) {
                                    if (['-sprite-selector-for-group', '-sprite-packer', '-sprite-image-format', '-sprite-background-color', '-sprite-important'].indexOf(decl.prop) !== -1) {
                                        decl.remove();
                                    }
                                });


                                // If background-size is set, we should update it, The correct size is now the size of the sprite:
                                var backgroundSizeDecls = getProperties(spriteInfo.cssRule, 'background-size');
                                if (backgroundSizeDecls.length > 0) {
                                    backgroundSizeDecls[0].value = packingData.width + 'px ' + packingData.height + 'px';
                                }
                            });
                        }
                        imageInfos.forEach(function (imageInfo) {
                            imageInfo.incomingRelations.forEach(function (incomingRelation) {
                                incomingRelation.from.markDirty();
                                var relationSpriteInfo = getRelationSpriteInfoFromIncomingRelation(incomingRelation),
                                    node = incomingRelation.node,
                                    existingBackgroundPositionDecls = getProperties(node, 'background-position'),
                                    existingBackgroundDecls = getProperties(node, 'background'),
                                    backgroundOffsetsWereUpdated = false,
                                    offsets = [
                                        Math.round(imageInfo.x / imageInfo.asset.devicePixelRatio), // FIXME: Rounding issues?
                                        Math.round(imageInfo.y / imageInfo.asset.devicePixelRatio)
                                    ],
                                    existingOffsets;
                                if (existingBackgroundDecls.length > 0) {
                                    // Warn if there's more than one?
                                    var backgroundTokens = existingBackgroundDecls[0].value.split(/\s+/),
                                        positionTokenIndices = [];
                                    existingOffsets = [];
                                    backgroundTokens.forEach(function (existingBackgroundValueToken, i) {
                                        if (/^(?:-?\d+px|0)$/i.test(existingBackgroundValueToken)) {
                                            positionTokenIndices.push(i);
                                            existingOffsets.push(parseInt(existingBackgroundValueToken, 10));
                                        }
                                    });
                                    if (existingOffsets.length === 2) {
                                        // Patch up the existing background property by replacing the old offsets with corrected ones:
                                        offsets.forEach(function (offset, i) {
                                            offset -= existingOffsets[i];
                                            backgroundTokens.splice(positionTokenIndices[i], 1, offset ? -offset + 'px' : '0');
                                        });

                                        existingBackgroundDecls[0].value = backgroundTokens.join(' ');
                                        backgroundOffsetsWereUpdated = true;
                                    }
                                }

                                if (!backgroundOffsetsWereUpdated) {
                                    // There was no 'background' property, or it didn't contain something that looked like offsets.
                                    // Create or update the background-position property instead:
                                    var backgroundPositionImportant = false;
                                    if (existingBackgroundPositionDecls.length === 1) {
                                        // FIXME: Silently ignores other units than px
                                        backgroundPositionImportant = existingBackgroundPositionDecls[0].value === '!important' || existingBackgroundPositionDecls[0].important;

                                        if (existingBackgroundPositionDecls[0].value !== '!important') {
                                            existingOffsets = existingBackgroundPositionDecls[0].value.split(' ').map(function (item) {
                                                return parseInt(item, 10);
                                            });
                                            if (existingOffsets.length !== 2 || isNaN(existingOffsets[0]) || isNaN(existingOffsets[1])) {
                                                var err = new Error('WARNING: trying to sprite ' + imageInfo.asset.url + ' with background-position: ' + existingBackgroundPositionDecls[0].value);
                                                assetGraph.emit('warn', err);
                                            } else {
                                                offsets[0] -= existingOffsets[0];
                                                offsets[1] -= existingOffsets[1];
                                            }
                                        }
                                    }
                                    var newBackgroundPositionValue = offsets.map(function (item) {
                                        return item ? -item + 'px' : '0';
                                    }).join(' ');
                                    if (existingBackgroundPositionDecls.length > 0) {
                                        existingBackgroundPositionDecls[0].value = newBackgroundPositionValue;
                                        existingBackgroundPositionDecls[0].important = backgroundPositionImportant;
                                    } else {
                                        node.append('background-position: ' + newBackgroundPositionValue + (backgroundPositionImportant ? ' !important' : ''));
                                    }
                                }

                                node.walkDecls(function (decl) {
                                    if (['-sprite-group', '-sprite-padding', '-sprite-no-group-selector', '-sprite-important'].indexOf(decl.prop) !== -1) {
                                        decl.remove();
                                    }
                                });

                                // Background-sizes change when spriting, upadte appropriately
                                if (imageInfo.asset.devicePixelRatio === 1) {
                                    // Device pixel ratio is default. Remove property and let the defaults rule
                                    getProperties(incomingRelation.node, 'background-size').forEach(function (backgroundSizeDecl) {
                                        backgroundSizeDecl.remove();
                                    });
                                } else {
                                    // Device pixel ratio is non-default, Set it explicitly with the ratio applied
                                    var dpr = incomingRelation.to.devicePixelRatio;

                                    // TODO: Figure out if rounding might become a problem
                                    var width = packingData.width / dpr;
                                    var height = packingData.height / dpr;
                                    var existingBackgroundSizeDecls = getProperties(incomingRelation.node, 'background-size');
                                    if (existingBackgroundSizeDecls.length > 0) {
                                        existingBackgroundSizeDecls[0].value = width + 'px ' + height + 'px';
                                    } else {
                                        incomingRelation.node.append('background-size: ' + width + 'px ' + height + 'px');
                                    }
                                }

                                if (relationSpriteInfo.noGroup || !spriteGroup.placeHolders) {
                                    // The user specified that this selector needs its own background-image/background
                                    // property pointing at the sprite rather than relying on the Html elements also being
                                    // matched by the sprite group's "main" selector, which would have been preferable.
                                    var relation = new assetGraph.CssImage({
                                        node: incomingRelation.node,
                                        propertyNode: incomingRelation.propertyNode,
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
