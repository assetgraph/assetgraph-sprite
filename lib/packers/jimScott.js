/*
 * Very quick adaptation of http://pollinimini.net/blog/rectangle-packing-2d-packing
 * which is a JavaScript version of Jim Scott's original algorithm found
 * at http://www.blackpawn.com/texts/lightmaps/default.html
 *
 * It uses a binary tree to partition the space of the parent rectangle and allocate
 * the passed rectangles by dividing the partitions into filled and empty.
 */

function findCoords(node, width, height) {
  // If we are not at a leaf then go deeper
  if (node.lft) {
    // Check first the left branch if not found then go by the right
    return (
      findCoords(node.lft, width, height) || findCoords(node.rgt, width, height)
    );
  } else {
    // If already used or it's too big then return
    if (node.used || width > node.width || height > node.height) {
      return;
    }
  }
  // If it fits perfectly then use this gap
  if (width === node.width && height === node.height) {
    node.used = true;
    return {
      x: node.x,
      y: node.y
    };
  }

  // Partition vertically or horizontally:
  if (node.width - width > node.height - height) {
    node.lft = {
      x: node.x,
      y: node.y,
      width,
      height: node.height
    };
    node.rgt = {
      x: node.x + width,
      y: node.y,
      width: node.width - width,
      height: node.height
    };
  } else {
    node.lft = {
      x: node.x,
      y: node.y,
      width: node.width,
      height
    };
    node.rgt = {
      x: node.x,
      y: node.y + height,
      width: node.width,
      height: node.height - height
    };
  }
  return findCoords(node.lft, width, height);
}

exports.pack = (imageInfos, config) => {
  config = config || {};
  const root = {
    x: 0,
    y: 0,
    width: config.maxWidth || 999999,
    height: config.maxHeight || 999999
  };

  // Sort by area, descending:
  imageInfos.sort((a, b) => b.width * b.height - a.width * a.height);

  const packingData = {
    imageInfos: [],
    width: 0,
    height: 0
  };

  for (const existingImageInfo of imageInfos) {
    const imageInfo = { ...existingImageInfo };
    if (imageInfo.padding && imageInfo.padding.some(v => v > 0)) {
      throw new Error('jimScott.pack: Sprite padding not supported');
    }
    // Perform the search
    const coords = findCoords(root, imageInfo.width, imageInfo.height);
    // If fitted then recalculate the used dimensions
    if (coords) {
      packingData.width = Math.max(
        packingData.width,
        coords.x + imageInfo.width
      );
      packingData.height = Math.max(
        packingData.height,
        coords.y + imageInfo.height
      );
    } else {
      throw new Error('jimScott.pack: Cannot fit image');
    }
    Object.assign(imageInfo, coords);
    packingData.imageInfos.push(imageInfo);
  }
  return packingData;
};
