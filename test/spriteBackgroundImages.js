const pluck = require('lodash.pluck');
const expect = require('./unexpected-with-plugins');
const AssetGraph = require('assetgraph');
const spriteBackgroundImages = require('../lib/spriteBackgroundImages');
const pathModule = require('path');

// Helper for extracting all nodes defining a specific property from a postcss rule
function getProperties(container, propertyName) {
  return container.nodes.filter((node) => node.prop === propertyName);
}

function unindent([str]) {
  str = str.replace(/^\n/, '');
  return str.replace(new RegExp(`^${str.match(/^\s*/)[0]}`, 'mg'), '');
}

describe('spriteBackgroundImages', () => {
  it('should sprite the background images in a simple test case', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'simple'
      ),
    });
    await assetGraph.loadAssets('style.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 4);
    expect(assetGraph, 'to contain assets', 'Png', 3);
    expect(assetGraph, 'to contain asset', 'Css');
    expect(assetGraph, 'to contain relations', 'CssImage', 3);

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png');
  });

  it('should handle the same simple test case again with -sprite-image-format set to jpg', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'simple'
      ),
    });
    await assetGraph.loadAssets('style.css');
    await assetGraph.populate();

    const cssAsset = assetGraph.findAssets({ type: 'Css' })[0];
    cssAsset.parseTree.nodes[0].append('-sprite-image-format: jpg');
    cssAsset.markDirty();

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain assets', 'Png', 0);

    const jpegAssets = assetGraph.findAssets({ type: 'Jpeg' });
    expect(jpegAssets, 'to have length', 1);
    expect(
      jpegAssets[0].rawSrc.slice(6, 10).toString('ascii'),
      'to equal',
      'JFIF'
    );
  });

  it('should process a sprite with no group selector', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'noGroupSelector'
      ),
    });
    await assetGraph.loadAssets('style.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 'Png', 2);

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png');

    expect(assetGraph, 'to contain relations', 'CssImage', 2);
    expect(
      assetGraph.findAssets({ type: 'Css' })[0].text,
      'to equal',
      unindent`
            .icon-foo {
                background-image: url(sprite-icons-2.png);background-position: 0 0;
            }

            .icon-bar {
                background-image: url(sprite-icons-2.png);background-position: -12px 0;
            }
            `
    );
  });

  it('should handle sprites with two images where one has spriteNoGroup in its query string', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'spriteNoGroup'
      ),
    });
    await assetGraph.loadAssets('style.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 'Png', 2);

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain relations', 'CssImage', 2);
    expect(
      assetGraph.findAssets({ type: 'Css' })[0].text,
      'to equal',
      unindent`
            .foo {background-image: url(sprite-foo-2.png);
            }

            .foo-foo {
                background-image: url(sprite-foo-2.png);background-position: 0 0
            }

            .foo-bar {background-position: -12px 0
            }
            `
    );
  });

  describe('with -sprite-location', function () {
    it('should process two sprites with -sprite-location properties in the group selector', async () => {
      const assetGraph = new AssetGraph({
        root: pathModule.resolve(
          __dirname,
          '..',
          'testdata',
          'spriteBackgroundImages',
          'spriteLocation'
        ),
      });
      await assetGraph.loadAssets('style.css');
      await assetGraph.populate();

      expect(assetGraph, 'to contain assets', 'Png', 4);

      await assetGraph.queue(spriteBackgroundImages());

      expect(assetGraph, 'to contain assets', 'Png', 2);
      expect(assetGraph, 'to contain relations', 'CssImage', 2);

      const cssImageHrefs = pluck(
        assetGraph.findRelations({ type: 'CssImage' }),
        'href'
      ).sort();
      expect(cssImageHrefs[0], 'to equal', 'myImage.png?pngquant=128');
      expect(
        cssImageHrefs[1],
        'to match',
        /^sprite-.*?-\d+\.png\?pngquant=128$/
      );
    });

    it('should remove the -sprite-location properties', async () => {
      const assetGraph = new AssetGraph({
        root: pathModule.resolve(
          __dirname,
          '..',
          'testdata',
          'spriteBackgroundImages',
          'spriteLocation'
        ),
      });
      const [cssAsset] = await assetGraph.loadAssets('style.css');
      await assetGraph.populate();

      await assetGraph.queue(spriteBackgroundImages());

      expect(cssAsset.text, 'not to contain', '-sprite-location');
    });
  });

  it('should handle an existing background-image property in the group selector', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'existingBackgroundImageInGroupSelector'
      ),
    });
    await assetGraph.loadAssets('style.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain asset', 'Png');
    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain relations', 'CssImage');
    expect(
      assetGraph.findAssets({ type: 'Css' })[0].text,
      'to match',
      /^\.icon \{\n {4}background-image: url\(sprite-.*?-\d+\.png\) !important;\n}\n\n\.icon-foo \{background-position: 0 0;\n\}\n$/
    );
  });

  it('should handle an existing background property in the group selector', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'existingBackgroundInGroupSelector'
      ),
    });
    await assetGraph.loadAssets('style.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain asset', 'Png');

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain relation', 'CssImage');
    expect(
      assetGraph.findAssets({ type: 'Css' })[0].text,
      'to equal',
      unindent`
        .icon {
            background: red url(sprite-icons-1.png) !important;
        }

        .icon-foo {background-position: 0 0;
        }
`
    );
  });

  it('should handle an existing background property in the sprite selector', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'existingBackgroundInSpriteSelector'
      ),
    });
    await assetGraph.loadAssets('style.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 'Png', 3);

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain relations', 'CssImage', 2);
    expect(
      assetGraph.findAssets({ type: 'Css' })[0].text,
      'to match',
      /^\.icon \{background-image: url\((sprite-.*?-\d+\.png)\);\n}\n\n\.icon-foo \{background-position: 0 0;\n\}\n\n.icon-bar \{\n {4}background: -12px 4px;\n}\n\n.icon-quux \{\n {4}background: url\(\1\) -1610px -4px;\n}\n$/
    );
  });

  it('should handle existing background-position properties', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'existingBackgroundPositions'
      ),
    });
    await assetGraph.loadAssets('style.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 'Png', 3);

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain relations', 'CssImage', 2);
    expect(
      assetGraph.findAssets({ type: 'Css' })[0].text,
      'to match',
      /^\.icon \{background-image: url\((sprite-.*?-\d+\.png)\);\n}\n\n\.icon-foo \{\n {4}background-position: 0 0 !important;\n\}\n\n\.icon-bar \{\n {4}background-position: -112px -40px !important;\n\}\n\n\.icon-quux \{\n {4}background-image: url\(\1\);\n {4}background-position: -1610px 2px !important;\n\}\n$/
    );
  });

  it('should handle a background-image and a background that are !important', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'important'
      ),
    });
    await assetGraph.loadAssets('style.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 'Png', 2);

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain relations', 'CssImage', 2);
    expect(
      assetGraph.findAssets({ type: 'Css' })[0].text,
      'to match',
      /^\.icon \{background-image: (url\(sprite-.*?-\d+\.png\));\n}\n\n\.icon-foo \{\n {4}background-image: \1 !important;background-position: 0 0;\n\}\n\n\.icon-bar \{\n {4}background: red !important;background-position: -12px 0;\n\}\n$/
    );
  });

  it('should handle broken images', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'brokenImages'
      ),
    });
    await assetGraph.loadAssets('style.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 'Png', 2);

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain relations', 'CssImage');
  });

  it('should handle images with wrong extensions', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'imagesWithWrongExtensions'
      ),
    });
    await assetGraph.loadAssets('style.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain asset', 'Jpeg');
    expect(assetGraph, 'to contain relations', 'CssImage', 2);

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain no asset', 'Jpeg');
    expect(assetGraph, 'to contain relations', 'CssImage', 2);
  });

  it('should handle duplicate identical sprite group names', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'duplicateSpriteGroupName'
      ),
    });
    await assetGraph.loadAssets('identical*.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 'Css', 2);
    expect(assetGraph, 'to contain assets', 'Png', 3);

    await assetGraph.queue(spriteBackgroundImages());

    const cssAssets = assetGraph.findAssets({ type: 'Css' });

    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain relations', 'CssImage', 2);
    expect(cssAssets[0].text, 'to equal', cssAssets[1].text);
  });

  it('should warn on identical sprite group names', async () => {
    const warnings = [];

    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'duplicateSpriteGroupName'
      ),
    });
    assetGraph.on('warn', (warning) => warnings.push(warning));

    await assetGraph.loadAssets('identical1.css', 'different.css');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 'Css', 2);
    expect(assetGraph, 'to contain assets', 'Png', 3);

    await assetGraph.queue(spriteBackgroundImages());

    const cssAssets = assetGraph.findAssets({ type: 'Css' });

    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain relations', 'CssImage', 1);
    expect(cssAssets[0].text, 'not to equal', cssAssets[1].text);

    expect(warnings, 'to be a non-empty array');
    expect(warnings, 'to have length', 1);
  });

  it('should get the background-position right when spriting a @2x image', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'retina'
      ),
    });
    await assetGraph.loadAssets('index.html');
    await assetGraph.populate();

    expect(assetGraph, 'to contain asset', 'Css');
    expect(assetGraph, 'to contain assets', 'Png', 2);
    expect(assetGraph, 'to contain asset', {
      type: 'Png',
      devicePixelRatio: 1,
    });
    expect(assetGraph, 'to contain asset', {
      type: 'Png',
      devicePixelRatio: 2,
    });

    for (const relation of assetGraph.findRelations({
      type: 'CssImage',
      node: { selector: '.regular' },
    })) {
      expect(relation.to.devicePixelRatio, 'to be', 1);
      expect(getProperties(relation.node, 'background-size'), 'to be empty');
    }

    for (const relation of assetGraph.findRelations({
      type: 'CssImage',
      node: { selector: '.retina' },
    })) {
      expect(relation.to.devicePixelRatio, 'to be', 2);
      expect(
        getProperties(relation.node, 'background-size'),
        'to have length',
        1
      );
    }

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png', 1);
    expect(assetGraph, 'to contain relations', 'CssImage', 2);
    expect(
      assetGraph,
      'to contain relations',
      { type: 'CssImage', node: { selector: '.regular' } },
      1
    );
    expect(
      assetGraph,
      'to contain relations',
      { type: 'CssImage', node: { selector: '.retina' } },
      1
    );

    for (const relation of assetGraph.findRelations({
      type: 'CssImage',
      node: { selector: '.regular' },
    })) {
      expect(getProperties(relation.node), 'to be empty');
    }

    for (const relation of assetGraph.findRelations({
      type: 'CssImage',
      node: { selector: '.retina' },
    })) {
      expect(getProperties(relation.node, 'background-size'), 'to satisfy', [
        { value: '89px 59px' },
      ]);
      expect(
        getProperties(relation.node, 'background-position'),
        'to satisfy',
        [{ value: '-30px 0' }]
      );
    }
  });

  it('should sprite retina @2x inline styled backgrounds correctly', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'retina'
      ),
    });
    await assetGraph.loadAssets('inline-style.html');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 'Css', 3);
    expect(assetGraph, 'to contain assets', 'Png', 2);
    expect(assetGraph, 'to contain relations', 'CssImage', 4);

    await assetGraph.queue(spriteBackgroundImages());

    expect(assetGraph, 'to contain asset', 'Png', 1);
    expect(assetGraph, 'to contain relations', 'CssImage', 1);
  });

  it('should error out if an SVG image is added to a sprite', async () => {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '..',
        'testdata',
        'spriteBackgroundImages',
        'svgInSprite'
      ),
    });
    await assetGraph.loadAssets('index.html');
    await assetGraph.populate();

    expect(assetGraph, 'to contain asset', 'Svg');

    await expect(
      assetGraph.queue(spriteBackgroundImages()),
      'to be rejected with',
      /are you trying to add an SVG to a sprite/
    );
  });

  describe('with padding', function () {
    describe('defined in the group selector', function () {
      it('should apply the padding', async () => {
        const assetGraph = new AssetGraph({
          root: pathModule.resolve(
            __dirname,
            '..',
            'testdata',
            'spriteBackgroundImages',
            'padding',
            'inGroupSelector'
          ),
        });
        await assetGraph.loadAssets('style.css');
        await assetGraph.populate();

        await assetGraph.queue(spriteBackgroundImages());
        const [spriteAsset] = assetGraph.findAssets({ fileName: 'sprite.png' });
        await expect(spriteAsset.rawSrc, 'to have metadata satisfying', {
          size: {
            width: 12,
            height: 90,
          },
        });
      });

      it('should remove the -sprite-padding property', async () => {
        const assetGraph = new AssetGraph({
          root: pathModule.resolve(
            __dirname,
            '..',
            'testdata',
            'spriteBackgroundImages',
            'padding',
            'inGroupSelector'
          ),
        });
        const [cssAsset] = await assetGraph.loadAssets('style.css');
        await assetGraph.populate();

        await assetGraph.queue(spriteBackgroundImages());

        expect(cssAsset.text, 'not to contain', '-sprite-padding');
      });
    });
  });
});
