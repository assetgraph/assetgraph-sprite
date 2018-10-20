const queryString = require('querystring');
const { promisify } = require('util');
const packers = require('./packers');
const { Canvas, Image } = require('canvas-prebuilt');

// Helper for extracting all nodes defining a specific property from a postcss rule
function getProperties(container, propertyName) {
  return container.nodes.filter(node => node.prop === propertyName);
}

async function getCanvasImageFromImageAsset(imageAsset) {
  const canvasImage = new Image();
  await new Promise((resolve, reject) => {
    canvasImage.onerror = err => {
      if (err.message.includes('node-canvas was built without SVG support')) {
        err.message = 'Adding SVG images to a sprite is not possible';
      }

      err.message += ` (${imageAsset.urlOrDescription})`;
      reject(err);
    };
    canvasImage.onload = resolve;
    canvasImage.src = imageAsset.rawSrc;
  });
  return canvasImage;
}

async function getImageAssetFromCanvas(canvas, assetType, assetGraph) {
  if (assetType === 'Png') {
    const rawSrc = await promisify(cb => canvas.toBuffer(cb))();
    return {
      type: 'Png',
      rawSrc
    };
  } else {
    const rawSrc = await promisify(cb => {
      const jpegChunks = [];
      canvas
        .createJPEGStream()
        .on('data', chunk => {
          jpegChunks.push(chunk);
        })
        .on('end', () => cb(null, Buffer.concat(jpegChunks)))
        .on('error', cb);
    })();
    return {
      type: 'Jpeg',
      rawSrc
    };
  }
}

function calculateSpritePadding(paddingStr, asset) {
  let padding;
  if (paddingStr) {
    // Strip units ('px' assumed)
    const tokens = [];
    paddingStr.split(/[,+]|\s+/).forEach(token => {
      const num = parseInt(token.replace(/[a-z]+$/, ''), 10);
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

  return padding.map(size =>
    Math.max(size, Math.max(asset.devicePixelRatio) - 1)
  );
}

function getRelationSpriteInfoFromIncomingRelation(incomingRelation) {
  const parsedQueryString = queryString.parse(
    incomingRelation.href.match(/\?([^#]*)/)[1]
  );
  return {
    groupName: parsedQueryString.sprite || 'default',
    noGroup: 'spriteNoGroup' in parsedQueryString,
    padding: calculateSpritePadding(
      parsedQueryString.padding,
      incomingRelation.to
    ),
    asset: incomingRelation.to
  };
}

function extractInfoFromCssRule(cssRule, propertyNamePrefix) {
  const info = {};
  cssRule.walkDecls(decl => {
    if (!propertyNamePrefix || decl.prop.startsWith(propertyNamePrefix)) {
      const keyName = decl.prop
        .substr(propertyNamePrefix.length)
        .replace(/-([a-z])/g, ($0, $1) => $1.toUpperCase());
      info[keyName] = decl.value.replace(/^(['"])(.*)\1$/, '$2');
    }
  });
  return info;
}

module.exports = () =>
  async function spriteBackgroundImages(assetGraph) {
    const spriteGroups = {};

    // Find sprite annotated images and create a data structure with their information
    for (const relation of assetGraph.findRelations({
      type: 'CssImage',
      to: { isImage: true },
      href: /\?(?:|[^#]*&)sprite(?:[=&#]|$)/
    })) {
      const relationSpriteInfo = getRelationSpriteInfoFromIncomingRelation(
        relation
      );
      const spriteGroup = (spriteGroups[
        relationSpriteInfo.groupName
      ] = spriteGroups[relationSpriteInfo.groupName] || {
        imageInfosById: {}
      });
      const imageInfo = spriteGroup.imageInfosById[relationSpriteInfo.asset.id];
      if (!imageInfo) {
        relationSpriteInfo.incomingRelations = [relation];
        spriteGroup.imageInfosById[
          relationSpriteInfo.asset.id
        ] = relationSpriteInfo;
      } else {
        imageInfo.incomingRelations.push(relation);
        for (var i = 0; i < 4; i += 1) {
          imageInfo.padding[i] = Math.max(
            relationSpriteInfo.padding[i],
            imageInfo.padding[i]
          );
        }
      }
    }

    const redefinitionErrors = {};

    // Extract sprite grouping information va -sprite- prefixed properties in stylesheets
    for (const cssAsset of assetGraph.findAssets({
      type: 'Css',
      isLoaded: true
    })) {
      cssAsset.eachRuleInParseTree(cssRule => {
        if (cssRule.type !== 'rule') {
          return;
        }
        if (getProperties(cssRule, '-sprite-selector-for-group').length > 0) {
          const spriteInfo = extractInfoFromCssRule(cssRule, '-sprite-');
          const spriteGroupName = spriteInfo.selectorForGroup;
          if (spriteInfo.location) {
            const matchLocation = spriteInfo.location.match(
              /^url\((['"]|)(.*?)\1\)$/
            );
            if (matchLocation) {
              spriteInfo.location = matchLocation[2];
            }
          }
          const group = spriteGroups[spriteGroupName];
          if (group) {
            if (!Array.isArray(group.placeHolders)) {
              group.placeHolders = [];
            }

            if (group.placeHolders.length > 0) {
              let err;

              if (
                Object.keys(group.placeHolders[0]).every(key => {
                  if (['asset', 'cssRule'].includes(key)) {
                    return true;
                  }
                  return group.placeHolders[0][key] === spriteInfo[key];
                })
              ) {
                // Queue up these errors as they tend to come in quite big bunches
                if (!Array.isArray(redefinitionErrors[spriteGroupName])) {
                  redefinitionErrors[spriteGroupName] = [];
                }
                redefinitionErrors[spriteGroupName].push(cssAsset);

                group.placeHolders.push({
                  ...spriteInfo,
                  asset: cssAsset,
                  cssRule
                });
              } else {
                err = new Error(
                  `assetgraph-sprite: Multiple differing definitions of ${spriteGroupName} sprite.\nThis is most likely an error.`
                );
                err.asset = cssAsset;

                assetGraph.warn(err);
              }
            } else {
              group.placeHolders.push({
                ...spriteInfo,
                asset: cssAsset,
                cssRule
              });
            }
          }
        }
      });
    }

    for (const spriteGroupName of Object.keys(redefinitionErrors)) {
      const message = [
        `assetgraph-sprite: Multiple identical definitions of ${spriteGroupName} sprite.`,
        'This might happen if you duplicate CSS using a preprocessor.',
        ...redefinitionErrors[spriteGroupName].map(
          asset => '    ' + asset.urlOrDescription
        )
      ].join('\n');

      const err = new Error(message);

      assetGraph.info(err);
    }

    for (const spriteGroupName of Object.keys(spriteGroups)) {
      const spriteGroup = spriteGroups[spriteGroupName];
      let imageInfos = Object.values(spriteGroup.imageInfosById);
      const spriteInfo =
        (spriteGroup.placeHolders && spriteGroup.placeHolders[0]) || {};

      const canvasImages = await Promise.all(
        imageInfos.map(imageInfo =>
          getCanvasImageFromImageAsset(imageInfo.asset)
        )
      );
      for (const [i, imageInfo] of imageInfos.entries()) {
        const canvasImage = canvasImages[i];
        Object.assign(imageInfo, {
          canvasImage,
          width: canvasImage.width,
          height: canvasImage.height
        });
      }

      const packerName =
        {
          'jim-scott': 'jimScott',
          horizontal: 'horizontal',
          vertical: 'vertical'
        }[spriteInfo.packer] || 'tryAll';

      const packingData = packers[packerName].pack(imageInfos);
      const canvas = new Canvas(packingData.width, packingData.height);
      const ctx = canvas.getContext('2d');

      if ('backgroundColor' in spriteInfo) {
        ctx.fillStyle = spriteInfo.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      imageInfos = packingData.imageInfos;
      for (const imageInfo of imageInfos) {
        ctx.drawImage(
          imageInfo.canvasImage,
          imageInfo.x,
          imageInfo.y,
          imageInfo.width,
          imageInfo.height
        );
      }
      const spriteImageType = /^jpe?g$/.test(spriteInfo.imageFormat)
        ? 'Jpeg'
        : 'Png';
      const spriteAssetConfig = await getImageAssetFromCanvas(
        canvas,
        spriteImageType,
        assetGraph
      );

      let fileName = `sprite-${spriteGroupName}-${imageInfos.length}${
        assetGraph[spriteImageType].prototype.defaultExtension
      }`;
      if (Array.isArray(spriteGroup.placeHolders)) {
        let location = spriteGroup.placeHolders[0].location;
        if (location) {
          let href;
          if (/^\?/.test(location)) {
            href = fileName + location;
          } else {
            href = location;
          }
          spriteAssetConfig.url = assetGraph.resolveUrl(assetGraph.root, href);
        }
      }
      if (!spriteAssetConfig.url) {
        spriteAssetConfig.fileName = fileName;
      }

      const spriteAsset = assetGraph.addAsset(spriteAssetConfig);
      if (Array.isArray(spriteGroup.placeHolders)) {
        for (const spriteInfo of spriteGroup.placeHolders) {
          const cssRule = spriteInfo.cssRule;
          let propertyName;
          let propertyNode;
          let tokenNumber;
          for (const candidatePropertyName of [
            'background-image',
            'background'
          ]) {
            const decls = getProperties(cssRule, candidatePropertyName);
            if (!propertyName && decls.length > 0) {
              propertyName = candidatePropertyName;
              let propertyValue = decls[0].value;
              if (propertyValue === '!important') {
                // Hack so that an existing value of "!important" will DTRT
                decls[0].important = true;
                propertyValue = 'url(...)';
              } else if (/^\s*$/.test(propertyValue)) {
                propertyValue = 'url(...)';
              } else {
                const existingUrlTokens = propertyValue.match(
                  assetGraph.CssImage.prototype.tokenRegExp
                );
                if (existingUrlTokens) {
                  tokenNumber = existingUrlTokens.length;
                }
                propertyValue += ' url(...)';
              }
              decls[0].value = propertyValue;
            }
          }
          if (propertyName) {
            propertyNode = getProperties(cssRule, propertyName)[0];
          } else {
            cssRule.append('background-image: url(...)');
            propertyNode = cssRule.last;
          }
          // I can't see why the ordering of CssImage relations should be significant...
          const relation = spriteInfo.asset.addRelation(
            {
              type: 'CssImage',
              node: cssRule,
              to: spriteAsset,
              propertyName,
              propertyNode,
              tokenNumber
            },
            'last'
          );
          relation.refreshHref();
          spriteInfo.cssRule.walkDecls(decl => {
            if (
              [
                '-sprite-selector-for-group',
                '-sprite-packer',
                '-sprite-image-format',
                '-sprite-background-color',
                '-sprite-important'
              ].includes(decl.prop)
            ) {
              decl.remove();
            }
          });

          // If background-size is set, we should update it, The correct size is now the size of the sprite:
          const backgroundSizeDecls = getProperties(
            spriteInfo.cssRule,
            'background-size'
          );
          if (backgroundSizeDecls.length > 0) {
            backgroundSizeDecls[0].value =
              packingData.width + 'px ' + packingData.height + 'px';
          }
        }
      }

      for (const imageInfo of imageInfos) {
        for (const incomingRelation of imageInfo.incomingRelations) {
          incomingRelation.from.markDirty();
          const relationSpriteInfo = getRelationSpriteInfoFromIncomingRelation(
            incomingRelation
          );
          const node = incomingRelation.node;
          const existingBackgroundPositionDecls = getProperties(
            node,
            'background-position'
          );
          const existingBackgroundDecls = getProperties(node, 'background');
          const offsets = [
            Math.round(imageInfo.x / imageInfo.asset.devicePixelRatio), // FIXME: Rounding issues?
            Math.round(imageInfo.y / imageInfo.asset.devicePixelRatio)
          ];
          let backgroundOffsetsWereUpdated = false;
          let existingOffsets;
          if (existingBackgroundDecls.length > 0) {
            // Warn if there's more than one?
            const backgroundTokens = existingBackgroundDecls[0].value.split(
              /\s+/
            );
            const positionTokenIndices = [];
            existingOffsets = [];
            for (const [
              i,
              existingBackgroundValueToken
            ] of backgroundTokens.entries()) {
              if (/^(?:-?\d+px|0)$/i.test(existingBackgroundValueToken)) {
                positionTokenIndices.push(i);
                existingOffsets.push(
                  parseInt(existingBackgroundValueToken, 10)
                );
              }
            }
            if (existingOffsets.length === 2) {
              // Patch up the existing background property by replacing the old offsets with corrected ones:
              for (let [i, offset] of offsets.entries()) {
                offset -= existingOffsets[i];
                backgroundTokens.splice(
                  positionTokenIndices[i],
                  1,
                  offset ? -offset + 'px' : '0'
                );
              }

              existingBackgroundDecls[0].value = backgroundTokens.join(' ');
              backgroundOffsetsWereUpdated = true;
            }
          }

          if (!backgroundOffsetsWereUpdated) {
            // There was no 'background' property, or it didn't contain something that looked like offsets.
            // Create or update the background-position property instead:
            let backgroundPositionImportant = false;
            if (existingBackgroundPositionDecls.length === 1) {
              // FIXME: Silently ignores other units than px
              backgroundPositionImportant =
                existingBackgroundPositionDecls[0].value === '!important' ||
                existingBackgroundPositionDecls[0].important;

              if (existingBackgroundPositionDecls[0].value !== '!important') {
                existingOffsets = existingBackgroundPositionDecls[0].value
                  .split(' ')
                  .map(item => parseInt(item, 10));
                if (
                  existingOffsets.length !== 2 ||
                  isNaN(existingOffsets[0]) ||
                  isNaN(existingOffsets[1])
                ) {
                  const err = new Error(
                    'WARNING: trying to sprite ' +
                      imageInfo.asset.url +
                      ' with background-position: ' +
                      existingBackgroundPositionDecls[0].value
                  );
                  assetGraph.warn(err);
                } else {
                  offsets[0] -= existingOffsets[0];
                  offsets[1] -= existingOffsets[1];
                }
              }
            }
            const newBackgroundPositionValue = offsets
              .map(item => (item ? -item + 'px' : '0'))
              .join(' ');
            if (existingBackgroundPositionDecls.length > 0) {
              existingBackgroundPositionDecls[0].value = newBackgroundPositionValue;
              existingBackgroundPositionDecls[0].important = backgroundPositionImportant;
            } else {
              node.append(
                'background-position: ' +
                  newBackgroundPositionValue +
                  (backgroundPositionImportant ? ' !important' : '')
              );
            }
          }

          node.walkDecls(decl => {
            if (
              [
                '-sprite-group',
                '-sprite-padding',
                '-sprite-no-group-selector',
                '-sprite-important'
              ].includes(decl.prop)
            ) {
              decl.remove();
            }
          });

          // Background-sizes change when spriting, upadte appropriately
          if (imageInfo.asset.devicePixelRatio === 1) {
            // Device pixel ratio is default. Remove property and let the defaults rule
            for (const backgroundSizeDecl of getProperties(
              incomingRelation.node,
              'background-size'
            )) {
              backgroundSizeDecl.remove();
            }
          } else {
            // Device pixel ratio is non-default, Set it explicitly with the ratio applied
            const dpr = incomingRelation.to.devicePixelRatio;

            // TODO: Figure out if rounding might become a problem
            const width = packingData.width / dpr;
            const height = packingData.height / dpr;
            const existingBackgroundSizeDecls = getProperties(
              incomingRelation.node,
              'background-size'
            );
            if (existingBackgroundSizeDecls.length > 0) {
              existingBackgroundSizeDecls[0].value = `${width}px ${height}px`;
            } else {
              incomingRelation.node.append(
                `background-size: ${width}px ${height}px`
              );
            }
          }

          if (relationSpriteInfo.noGroup || !spriteGroup.placeHolders) {
            // The user specified that this selector needs its own background-image/background
            // property pointing at the sprite rather than relying on the Html elements also being
            // matched by the sprite group's "main" selector, which would have been preferable.
            const relation = incomingRelation.from.addRelation(
              {
                type: 'CssImage',
                node: incomingRelation.node,
                propertyNode: incomingRelation.propertyNode,
                to: spriteAsset
              },
              'before',
              incomingRelation
            );
            relation.refreshHref();
            incomingRelation.remove();
          } else {
            incomingRelation.detach();
          }

          // Remove the original image if it has become an orphan:
          if (!assetGraph.findRelations({ to: incomingRelation.to }).length) {
            assetGraph.removeAsset(incomingRelation.to);
          }
        }
      }
    }
  };
